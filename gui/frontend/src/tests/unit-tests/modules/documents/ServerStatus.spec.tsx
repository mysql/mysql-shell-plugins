/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MySQLConnectionScheme, type IMySQLConnectionOptions } from "../../../../communication/MySQL.js";
import { ServerStatus } from "../../../../modules/db-editor/ServerStatus.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { nextRunLoop } from "../../test-helpers.js";

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

describe("Server status module tests", (): void => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("Test ServerStatus instantiation", async () => {
        const backend = new ShellInterfaceSqlEditor();
        const { container, unmount } = render(
            <ServerStatus backend={backend}
                runStatus="running"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();
        expect(container).toMatchSnapshot("ServerStatus1");

        backend.closeSession().catch(() => {
            throw new Error("Close session failed");
        });
        await nextRunLoop();
        expect(container).toMatchSnapshot("ServerStatus2");

        unmount();
    });

    it("renders live server status values", async () => {
        const executeService = vi.fn((sql: string) => {
            switch (sql) {
                case "select 1": {
                    return Promise.resolve();
                }

                case "show variables": {
                    return Promise.resolve({
                        rows: [
                            ["hostname", "localhost"],
                            ["port", "3306"],
                            ["server_id", "42"],
                            ["server_uuid", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
                            ["datadir", "/usr/local/mysql/data"],
                            ["version_comment", "MySQL Community Server"],
                            ["version", "8.4.0"],
                            ["log_bin", "ON"],
                            ["password", "should not be cached"],
                        ],
                    });
                }

                case "show global status": {
                    return Promise.resolve({
                        rows: [["Innodb_redo_log_enabled", "ON"]],
                    });
                }

                case "show plugins": {
                    return Promise.resolve({ rows: [] });
                }

                default: {
                    return Promise.resolve(undefined);
                }
            }
        });
        const backend = {
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTestId, unmount } = render(
            <ServerStatus backend={backend}
                connectionDetails={connectionDetails()}
                runStatus="running"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await waitFor(() => {
            expect(getByTestId("version").textContent).toBe("MySQL Community Server (8.4.0)");
        });
        expect(container.querySelectorAll(".serverStatusSummaryItem")).toHaveLength(3);
        expect(getByTestId("serverId").textContent).toBe("42");
        expect(getByTestId("serverUuid").textContent).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        expect(getByTestId("redoLogStatus").closest("#serverModeStatus")).not.toBeNull();
        expect(getByTestId("binaryLogStatus").closest("#serverModeStatus")).not.toBeNull();

        unmount();
    });

    it("renders live server status values for remote connections", async () => {
        const executeService = vi.fn((sql: string) => {
            return Promise.resolve(sql === "show variables" ? {
                rows: [
                    ["hostname", "db.example.com"],
                    ["port", "3306"],
                ],
            } : { rows: [] });
        });
        const backend = {
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const { getByTestId, unmount } = render(
            <ServerStatus backend={backend}
                connectionDetails={connectionDetails({ host: "db.example.com" })}
                runStatus="running"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await waitFor(() => {
            expect(getByTestId("host").textContent).toBe("db.example.com");
        });

        unmount();
    });

    it("renders offline status without backend queries", async () => {
        const executeService = vi.fn();
        const backend = {
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByText, getByTestId, unmount } = render(
            <ServerStatus backend={backend}
                runStatus="offline"
                offlineProbeStatus="Local TCP endpoint is unavailable (localhost:3306)"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();

        expect(getByText("offline")).toBeDefined();
        expect(getByTestId("version").textContent).toBe("none");
        expect(getByText("Local TCP endpoint is unavailable (localhost:3306)")).toBeDefined();
        expect(getByTestId("offlineServerBanner").textContent).toBe(
            "Offline or unreachable server. No live MySQL connection is available. " +
            "Cached server status data is not available.",
        );
        expect(container.querySelectorAll(".serverStatusSummaryItem")).toHaveLength(3);
        expect(executeService).not.toHaveBeenCalled();

        unmount();
    });

    it("renders cached offline status rows without backend queries", async () => {
        vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-27T02:00:00+00:00"));
        const executeService = vi.fn();
        const getOfflineServerStatusCache = vi.fn().mockResolvedValue({
            updatedAt: "2026-06-27T00:00:00+00:00",
            isLocal: true,
            sysvars: [
                { name: "hostname", value: "localhost" },
                { name: "port", value: "3306" },
                { name: "server_id", value: "84" },
                { name: "server_uuid", value: "ffffffff-1111-2222-3333-444444444444" },
                { name: "version_comment", value: "MySQL Community Server" },
                { name: "version", value: "8.4.0" },
                { name: "datadir", value: "/usr/local/mysql/data" },
                { name: "general_log", value: "OFF" },
            ],
        });
        const backend = {
            executeService,
            getOfflineServerStatusCache,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTestId, unmount } = render(
            <ServerStatus backend={backend}
                connectionDetails={connectionDetails()}
                runStatus="offline"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await waitFor(() => {
            expect(getByTestId("host").textContent).toBe("localhost");
        });

        expect(getOfflineServerStatusCache).toHaveBeenCalledOnce();
        expect(getByTestId("version").textContent).toBe("MySQL Community Server (8.4.0)");
        expect(getByTestId("serverId").textContent).toBe("84");
        expect(getByTestId("serverUuid").textContent).toBe("ffffffff-1111-2222-3333-444444444444");
        expect(getByTestId("cacheAge").textContent).toBe("2 hours ago");
        expect(getByTestId("offlineServerBanner").textContent).toBe(
            "Offline or unreachable server. No live MySQL connection is available. " +
            "Showing cached server status data from 2 hours ago.",
        );
        expect(container.querySelectorAll(".serverStatusSummaryItem")).toHaveLength(3);
        expect(getByTestId("dataDir").textContent).toBe("/usr/local/mysql/data");
        expect(getByTestId("generalLog").textContent).toBe("off");
        expect(container.querySelector("#serverFeatures")).toBeNull();
        expect(container.querySelector("#serverSsl")).toBeNull();
        expect(container.querySelector("#firewall")).toBeNull();
        expect(executeService).not.toHaveBeenCalled();

        unmount();
    });

    it("omits offline status boxes when no cached values are available", async () => {
        const executeService = vi.fn();
        const getOfflineServerStatusCache = vi.fn().mockResolvedValue(undefined);
        const backend = {
            executeService,
            getOfflineServerStatusCache,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, unmount } = render(
            <ServerStatus backend={backend}
                connectionDetails={connectionDetails()}
                runStatus="offline"
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await nextRunLoop();

        expect(container.querySelectorAll(".serverStatusCard")).toHaveLength(0);
        expect(executeService).not.toHaveBeenCalled();

        unmount();
    });

});
