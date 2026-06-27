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

import { describe, expect, it, vi } from "vitest";

import { MySQLConnectionScheme, type IMySQLConnectionOptions } from "../../../../communication/MySQL.js";
import { ResponseError } from "../../../../communication/ResponseError.js";
import {
    isLocalOfflineConnectionCandidate, localServerEndpointFingerprint, localServerProbeFromBackend,
    localServerProbeRequestFromConnection, offlineProbeStatusText, unknownOfflineProbeResult,
} from "../../../../modules/db-editor/OfflineAdministration.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";

const connectionDetails = (options: Partial<IMySQLConnectionOptions> = {},
    details: Partial<IConnectionDetails> = {}): IConnectionDetails => {
    return {
        id: 1,
        dbType: DBType.MySQL,
        caption: "Local MySQL",
        description: "Local MySQL",
        folderPath: "/",
        index: 0,
        options: {
            scheme: MySQLConnectionScheme.MySQL,
            user: "root",
            host: "localhost",
            port: 3306,
            ...options,
        },
        ...details,
    };
};

describe("Offline administration helpers", () => {
    it("accepts local MySQL connections without tunnels", () => {
        expect(isLocalOfflineConnectionCandidate(connectionDetails())).toBe(true);
        expect(isLocalOfflineConnectionCandidate(connectionDetails({ host: "127.0.0.1" }))).toBe(true);
        expect(isLocalOfflineConnectionCandidate(connectionDetails({ host: "::1" }))).toBe(true);
        expect(isLocalOfflineConnectionCandidate(connectionDetails({ host: "[::1]" }))).toBe(true);
        const socketDetails = connectionDetails({ host: "", socket: "/tmp/mysql.sock" });
        expect(isLocalOfflineConnectionCandidate(socketDetails)).toBe(true);
    });

    it("rejects remote, tunneled, and non-MySQL connections", () => {
        expect(isLocalOfflineConnectionCandidate(connectionDetails({ host: "db.example.com" }))).toBe(false);
        expect(isLocalOfflineConnectionCandidate(connectionDetails({ ssh: "ssh://localhost" }, { useSSH: true })))
            .toBe(false);
        expect(isLocalOfflineConnectionCandidate(connectionDetails({}, { useMHS: true }))).toBe(false);
        expect(isLocalOfflineConnectionCandidate({
            ...connectionDetails(),
            dbType: DBType.Sqlite,
        })).toBe(false);
    });

    it("builds backend TCP probe requests for local TCP targets", () => {
        expect(localServerProbeRequestFromConnection(connectionDetails())).toEqual({
            kind: "tcp",
            target: "localhost",
            port: 3306,
        });
    });

    it("builds stable endpoint fingerprints for cache lookups", () => {
        expect(localServerEndpointFingerprint(connectionDetails())).toBe("tcp:localhost:3306");
        expect(localServerEndpointFingerprint(connectionDetails({ socket: "/tmp/mysql.sock" })))
            .toBe("socket:/tmp/mysql.sock");
    });

    it("builds backend path probe requests for socket targets", () => {
        expect(localServerProbeRequestFromConnection(connectionDetails({ socket: "/tmp/mysql.sock" }))).toEqual({
            kind: "socket",
            target: "/tmp/mysql.sock",
        });
    });

    it("calls backend probes for local TCP targets", async () => {
        const probe = vi.fn().mockResolvedValue({
            kind: "tcp",
            status: "unavailable",
            target: "localhost:3306",
        });

        await expect(localServerProbeFromBackend(connectionDetails(), probe)).resolves.toEqual({
            kind: "tcp",
            status: "unavailable",
            target: "localhost:3306",
        });
        expect(probe).toHaveBeenCalledWith("tcp", "localhost", 3306);
    });

    it("calls backend probes for socket targets", async () => {
        const probe = vi.fn().mockResolvedValue({
            kind: "socket",
            status: "available",
            target: "/tmp/mysql.sock",
        });

        await expect(localServerProbeFromBackend(connectionDetails({ socket: "/tmp/mysql.sock" }), probe))
            .resolves.toEqual({
                kind: "socket",
                status: "available",
                target: "/tmp/mysql.sock",
            });
        expect(probe).toHaveBeenCalledWith("socket", "/tmp/mysql.sock", undefined);
    });

    it("builds unknown probe results when backend probes fail", () => {
        expect(unknownOfflineProbeResult({
            kind: "tcp",
            target: "localhost",
            port: 3306,
        }, new Error("probe failed"))).toMatchObject({
            kind: "tcp",
            status: "unknown",
            target: "localhost:3306",
            message: "probe failed",
        });
    });

    it("keeps offline mode available if the backend probe rejects", async () => {
        await expect(localServerProbeFromBackend(connectionDetails(), vi.fn().mockRejectedValue(
            new Error("backend failed"),
        ))).resolves.toEqual({
            kind: "tcp",
            status: "unknown",
            target: "localhost:3306",
            message: "backend failed",
        });
    });

    it("formats probe states for server status", () => {
        expect(offlineProbeStatusText({ kind: "tcp", status: "available", target: "localhost:3306" }))
            .toBe("Local TCP endpoint is available (localhost:3306)");
        expect(offlineProbeStatusText({ kind: "socket", status: "unavailable", target: "/tmp/mysql.sock" }))
            .toBe("Local socket endpoint is unavailable (/tmp/mysql.sock)");
    });

    it("can inspect nested response error client codes", () => {
        const responseError = new ResponseError({ requestState: { msg: "No server", code: 2003 } });
        const error = new Error("Wrapped", { cause: responseError });

        expect(error.cause).toBe(responseError);
    });
});
