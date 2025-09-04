/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import * as fs from "fs";
import * as path from "path";
import { Worker } from "worker_threads";

import { enumerateFiles } from "../src/utilities/file-utilities.js";
import { convertCamelToTitleCase } from "../src/utilities/string-helpers.js";

const targetFolder = path.join("./src", "oci-typings");
const copyright = `/*
 * Copyright (c) 2025 ` + // Split copyright to avoid the check for the year.
    `Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */
`;

const maxWorkers = 5;
const workerQueue = new Map<string, Promise<void>>();

class PromiseQueue {
    private pending: Array<Promise<unknown>> = [];
    private waiting: Array<() => void> = [];

    /**
     * Adds a new task, but waits if the queue is already full.
     *
     * @param task The task to add to the queue.
     *
     * @returns A promise that resolves when the task is completed.
     */
    public async add<T>(task: () => Promise<T>): Promise<T> {
        // Wait if we're at max capacity.
        if (this.pending.length >= maxWorkers) {
            await new Promise<void>((resolve) => {
                return this.waiting.push(resolve);
            });
        }

        // Wrap task to automatically remove from pending and trigger next.
        const wrapped = task().finally(() => {
            // Find the finished task in the pending array and remove it.
            void this.pending.splice(this.pending.indexOf(wrapped), 1);

            // Release next waiting task by running its resolve function.
            this.waiting.shift()?.();
        });

        this.pending.push(wrapped);

        return wrapped;
    }

    /** Called when all tasks have been added, to wait for those still running. */
    public async onIdle() {
        while (this.pending.length > 0) {
            await Promise.any(this.pending);
        }
    }
}

const runWorker = (file: string, targetName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker("./scripts/copy-oci-worker.js", { workerData: { file, targetName } });
        worker.on("message", (msg: { status: string, error: string; }) => {
            if (msg.status === "ok") {
                resolve();
            } else {
                reject(new Error(msg.error));
            }
        });

        worker.on("error", reject);
        worker.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
};

const promiseQueue = new PromiseQueue();

const processTypings = (folder: string, names: string[]) => {
    const typings = enumerateFiles(path.join("node_modules", folder), ".d.ts").filter((file) => {
        const fileName = path.basename(file, ".d.ts");

        return names.length === 0 || names.includes(fileName);
    });

    for (const file of typings) {
        const targetName = path.join(targetFolder, file.substring("node_modules".length)).replace(".d.ts", ".ts");
        const promise = promiseQueue.add(() => {
            return runWorker(file, targetName);
        });
        workerQueue.set(file, promise);
    }

    const indexTarget = path.join(targetFolder, folder);
    const indexFile = path.join(indexTarget, "index.ts");
    const indexContent = copyright + typings.map((file) => {
        const base = path.basename(file, ".d.ts");
        const targetName = `./${base}.js`;

        const nameParts = base.split("-");
        nameParts.forEach((part, index) => {
            if (nameParts[index] === "sl" || nameParts[index].startsWith("bc")) {
                nameParts[index] = nameParts[index].slice(0, 2).toUpperCase() + nameParts[index].slice(2);
            } else if (index === nameParts.length - 1 && nameParts[index] === "ip") {
                nameParts[index] = nameParts[index].toUpperCase();
            } else {
                nameParts[index] = convertCamelToTitleCase(part);
            }
        });
        const className = nameParts.join("");

        return `export type { ${className} } from "${targetName}";`;
    }).join("\n");
    fs.mkdirSync(indexTarget, { recursive: true });
    fs.writeFileSync(indexFile, indexContent);
};

/*
if (fs.existsSync(targetFolder)) {
    fs.rmSync(targetFolder, { recursive: true });
}
//*/

if (!fs.existsSync(targetFolder)) {
    console.log("Processing OCI type definitions...");

    processTypings("oci-bastion/lib/model", [
        "bastion", "bastion-summary", "port-forwarding-session-target-resource-details", "session", "session-summary",
        "instance", "shape", "bastion-lifecycle-state", "bastion-dns-proxy-status", "target-resource-details",
        "dynamic-port-forwarding-session-target-resource-details", "managed-ssh-session-target-resource-details",
        "public-key-details", "session-lifecycle-state",
    ]);

    processTypings("oci-core/lib/model", [
        "instance", "shape", "instance-options", "instance-availability-config", "preemptible-instance-config-details",
        "instance-shape-config", "instance-source-via-image-details", "instance-source-via-boot-volume-details",
        "instance-agent-config", "launch-options", "amd-milan-bm-platform-config", "amd-rome-bm-platform-config",
        "intel-skylake-bm-platform-config", "amd-rome-bm-gpu-platform-config", "intel-icelake-bm-platform-config",
        "amd-vm-platform-config", "intel-vm-platform-config", "generic-bm-platform-config",
        "amd-milan-bm-gpu-platform-config", "shape-ocpu-options", "shape-memory-options",
        "shape-networking-bandwidth-options", "shape-max-vnic-attachment-options", "shape-platform-config-options",
        "shape-alternative-object", "platform-config", "instance-agent-plugin-config-details",
        "instance-source-details", "instance-source-details", "instance-source-image-filter-details",
        "terminate-preemption-action", "shape-secure-boot-options;", "shape-measured-boot-options",
        "shape-trusted-platform-module-options", "shape-numa-nodes-per-socket-platform-options",
        "shape-memory-encryption-options", "shape-symmetric-multi-threading-enabled-platform-options",
        "shape-access-control-service-enabled-platform-options", "shape-virtual-instructions-enabled-platform-options",
        "shape-input-output-memory-management-unit-enabled-platform-options", "percentage-of-cores-enabled-options",
        "preemption-action", "shape-secure-boot-options", "compute-bare-metal-host-placement-constraint-details",
        "host-group-placement-constraint-details", "placement-constraint-details", "licensing-config",
    ]);

    processTypings("oci-identity/lib/model", [
        "compartment",
    ]);

    processTypings("oci-mysql/lib/model", [
        "db-system", "shape-summary", "db-system-placement", "heat-wave-cluster-summary", "backup-policy",
        "db-system-source-from-backup", "db-system-source-from-pitr", "db-system-source-from-none",
        "db-system-source-import-from-url", "db-system-endpoint", "channel-summary", "maintenance-details",
        "deletion-policy-details", "crash-recovery-status", "database-management-status", "secure-connection-details",
        "point-in-time-recovery-details", "certificate-generation-type", "db-system-source", "channel-target-dbSystem",
        "channel-source-mysql", "pitr-policy", "channel-source", "pem-ca-certificate", "error-on-anonymous-handling",
        "assign-manual-uuid-handling", "assign-target-uuid-handling", "anonymous-transactions-handling",
        "channel-target-db-system", "ca-certificate", "channel-target", "channel-filter", "rest-details",
        "data-storage", "customer-contact", "read-endpoint-details", "soft-delete", "copy-policy",
        "rest-configuration-type", "encrypt-data-details", "key-generation-type",
    ]);

    processTypings("oci-loadbalancer/lib/model", [
        "load-balancer", "ip-address", "shape-details", "listener", "hostname", "s-sl-cipher-suite", "certificate",
        "backend-set", "path-route-set", "rule-set", "routing-policy", "backend", "health-checker",
        "s-sl-Configuration", "session-persistence-configuration-details", "s-sl-configuration",
        "l-bcookie-session-persistence-configuration-details", "rule", "routing-rule", "path-route",
        "connection-configuration", "reserved-ip", "path-match-type", "action",
    ]);

    processTypings("oci-objectstorage/lib/model", [
        "bucket-summary", "list-objects", "object-summary", "storage-tier", "archival-state",
    ]);

    await promiseQueue.onIdle();

    console.log("done\n");
} else {
    console.log("OCI Types target folder exists, skipping...");
}
