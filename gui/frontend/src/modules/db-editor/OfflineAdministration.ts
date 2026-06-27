/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import type { IMySQLConnectionOptions } from "../../communication/MySQL.js";
import { ResponseError } from "../../communication/ResponseError.js";
import { DBType, type IConnectionDetails } from "../../supplement/ShellInterface/index.js";

export type OfflineProbeStatus = "available" | "unavailable" | "unknown";
export type OfflineProbeKind = "tcp" | "socket" | "pipe";

export interface IOfflineProbeResult {
    kind: OfflineProbeKind;
    status: OfflineProbeStatus;
    target: string;
    message?: string;
}

export interface IOfflineProbeRequest {
    kind: OfflineProbeKind;
    target: string;
    port?: number;
}

export type OfflineProbeBackend = (
    kind: OfflineProbeKind,
    target: string,
    port?: number,
) => Promise<IOfflineProbeResult>;

const defaultMySQLPort = 3306;
const localHosts = new Set(["", "localhost", "127.0.0.1", "::1", "[::1]"]);
const isWindows = (): boolean => {
    return globalThis.navigator.userAgent.includes("Windows");
};

export const isClientConnectionError = (error: unknown): boolean => {
    let current: unknown = error;
    while (current) {
        if (current instanceof ResponseError) {
            const code = current.info.requestState.code;

            return code !== undefined && code >= 2000 && code < 3000;
        }

        current = current instanceof Error ? current.cause : undefined;
    }

    return false;
};

export const isLocalOfflineConnectionCandidate = (details: IConnectionDetails): boolean => {
    if (details.dbType !== DBType.MySQL || details.useSSH === true || details.useMHS === true) {
        return false;
    }

    const options = details.options as IMySQLConnectionOptions;
    if (options.ssh || options["ssh-config-file"] || options["ssh-identity-file"]
        || options["ssh-public-identity-file"]) {
        return false;
    }

    const host = ((options as Partial<IMySQLConnectionOptions>).host ?? "").trim().toLowerCase();

    return Boolean(options.socket) || localHosts.has(host);
};

export const localServerProbeRequestFromConnection = (
    details: IConnectionDetails,
): IOfflineProbeRequest | undefined => {
    if (!isLocalOfflineConnectionCandidate(details)) {
        return undefined;
    }

    const options = details.options as IMySQLConnectionOptions;
    if (options.socket) {
        const kind = isWindows() ? "pipe" : "socket";

        return {
            kind,
            target: options.socket,
        };
    }

    const host = options.host || "localhost";
    const port = options.port ?? defaultMySQLPort;

    return {
        kind: "tcp",
        target: host,
        port,
    };
};

export const localServerEndpointFingerprint = (details: IConnectionDetails): string | undefined => {
    const request = localServerProbeRequestFromConnection(details);
    if (!request) {
        return undefined;
    }

    return request.kind === "tcp"
        ? `${request.kind}:${request.target}:${request.port}`
        : `${request.kind}:${request.target}`;
};

export const unknownOfflineProbeResult = (request?: IOfflineProbeRequest, error?: unknown): IOfflineProbeResult => {
    const target = request
        ? request.kind === "tcp" && request.port !== undefined ? `${request.target}:${request.port}` : request.target
        : "unknown";

    return {
        kind: request?.kind ?? "tcp",
        status: "unknown",
        target,
        message: error instanceof Error ? error.message : error === undefined ? undefined : String(error),
    };
};

export const localServerProbeFromBackend = async (
    details: IConnectionDetails,
    probe: OfflineProbeBackend,
): Promise<IOfflineProbeResult | undefined> => {
    const request = localServerProbeRequestFromConnection(details);
    if (!request) {
        return undefined;
    }

    try {
        return await probe(request.kind, request.target, request.port);
    } catch (error) {
        return unknownOfflineProbeResult(request, error);
    }
};

export const offlineProbeStatusText = (probe?: IOfflineProbeResult): string => {
    if (!probe) {
        return "Local server status was not probed";
    }

    const endpoint = probe.kind === "tcp"
        ? "TCP endpoint"
        : probe.kind === "pipe" ? "pipe endpoint" : "socket endpoint";

    return `Local ${endpoint} is ${probe.status} (${probe.target})`;
};
