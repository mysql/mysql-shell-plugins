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

import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { ui } from "../../../../app-logic/UILayer.js";
import { Logs } from "../../../../modules/db-editor/Logs.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";

const localConnection: IConnectionDetails = {
    id: 1,
    index: 0,
    dbType: DBType.MySQL,
    caption: "Local",
    description: "Local",
    options: {
        scheme: MySQLConnectionScheme.MySQL,
        host: "localhost",
        port: 3306,
        user: "root",
    },
};

const remoteConnection: IConnectionDetails = {
    ...localConnection,
    caption: "Remote",
    description: "Remote",
    options: {
        ...localConnection.options,
        host: "db.example.com",
    },
};

describe("Logs admin page tests", () => {
    beforeEach(() => {
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 600));
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
        vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("shows error log entries from performance_schema without a line column", async () => {
        Element.prototype.scrollIntoView = vi.fn();
        const readErrorLogFilePage = vi.fn().mockResolvedValue(undefined);
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return {
                        rows: [[2500]],
                    };
                }

                if (query.includes("SELECT DISTINCT SUBSYSTEM")) {
                    return {
                        rows: [["InnoDB"], ["Server"]],
                    };
                }

                if (query.includes("SELECT DISTINCT ERROR_CODE")) {
                    return {
                        rows: [["MY-010119"], ["MY-010931"]],
                    };
                }

                expect(query).toContain("performance_schema.error_log");

                if (query.includes("OFFSET 2000")) {
                    return {
                        rows: [
                            ["2026-05-09T12:02:00.000000Z", 4, "ERROR", "MY-010120", "Server", "last table page"],
                        ],
                    };
                }

                return {
                    rows: [
                        ["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "startup failed"],
                        ["2026-05-09T11:59:00.000000Z", 4, "Warning", "MY-010931", "InnoDB", "recovered"],
                    ],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByText, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("startup failed");
        });
        expect(container.textContent).toContain("recovered");

        expect(container.textContent).toContain("2026-05-09 12:00:00.000000Z");
        expect(container.textContent).not.toContain("2026-05-09T12:00:00.000000Z");
        expect(container.querySelector("h1")?.textContent).toBe("Error Log");
        expect(container.querySelector(".logsSubtitle")).toBeNull();
        expect(container.textContent).toContain("Showing logs from performance_schema.error_log");
        expect(readErrorLogFilePage).not.toHaveBeenCalled();
        expect([...container.querySelectorAll("#logsToolbar>.logsIconButton")].map((button) => {
            return button.getAttribute("title");
        })).toEqual(["Filter", "First Page", "Previous Page", "Next Page", "Last Page", "Refresh",
            "Show Action Menu"]);

        const headers = [...container.querySelectorAll("#logsTable .tabulator-col-title")].map((header) => {
            return header.textContent;
        });
        expect(headers).toEqual(["Timestamp", "Priority", "Error Code", "Subsystem", "Message"]);
        expect(container.querySelector("#logsTable .tabulator-row:nth-child(1)")?.classList)
            .toContain("priority-error");
        expect(container.querySelector("#logsTable .tabulator-row:nth-child(2)")?.classList)
            .toContain("priority-warning");
        expect(container.querySelector("#logsTable")?.classList.contains("treeGrid")).toBe(true);
        expect(container.querySelector(".logsSummary")).toBeNull();
        expect(container.querySelector("#logsFilterEditor")).toBeNull();

        fireEvent.click(getByTitle("Filter"));

        expect(container.querySelector("#logsFilterEditor")).not.toBeNull();
        expect([...container.querySelectorAll("#logsFilterEditor>.logsFilterField>span")].map((item) => {
            return item.textContent;
        })).toEqual(["Timestamp", "Priority", "Error Code", "Subsystem", "Message"]);
        expect([...container.querySelectorAll("#logsFilterEditor .logsFilterField:first-child option")].map((item) => {
            return item.textContent;
        })).toEqual(["Since 1h ago", "Since 2h ago", "Since 4h ago", "Since 8h ago", "Since 12h ago",
            "Since 1 day", "Since 2 days", "Since 1 week", "Since 1 month", "Since 1 year", "All"]);
        expect(container.querySelector<HTMLSelectElement>(
            "#logsFilterEditor .logsFilterField:first-child select",
        )!.value).toBe("all");
        expect(container.querySelectorAll("#logsFilterEditor input[type='checkbox']")).toHaveLength(0);
        expect(getByTitle("Priority Filter").textContent).toContain("All");

        fireEvent.click(getByTitle("Priority Filter"));

        expect([...container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(2) input[type='checkbox']")]
            .map((item) => {
                return (item as HTMLInputElement).value;
            })).toEqual(["Error", "Warning", "System", "Note"]);
        const errorPriority = container.querySelector<HTMLInputElement>(
            "#logsFilterEditor>.logsFilterField:nth-child(2) input[value='Error']",
        )!;
        expect(errorPriority.checked).toBe(false);
        fireEvent.click(errorPriority);
        expect(getByTitle("Priority Filter").textContent).toContain("Error");
        fireEvent.click(container.querySelector(
            "#logsFilterEditor>.logsFilterField:nth-child(2) input[value='Warning']",
        )!);
        expect(getByTitle("Priority Filter").textContent).toContain("2 selected");

        fireEvent.click(getByTitle("Error Code Filter"));

        expect(container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(2) input[type='checkbox']"))
            .toHaveLength(0);
        expect([...container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(3) input[type='checkbox']")]
            .map((item) => {
                return (item as HTMLInputElement).value;
            })).toEqual(["MY-010119", "MY-010931"]);

        fireEvent.click(getByTitle("Subsystem Filter"));

        expect(container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(3) input[type='checkbox']"))
            .toHaveLength(0);
        expect([...container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(4) input[type='checkbox']")]
            .map((item) => {
                return (item as HTMLInputElement).value;
            })).toEqual(["InnoDB", "Server"]);
        expect([...container.querySelectorAll("#logsFilterEditor>.logsFilterField:nth-child(3) option")].map((item) => {
            return item.textContent;
        })).toEqual([]);
        expect([...container.querySelectorAll("#logsFilterActions .button")].map((item) => {
            return item.textContent;
        }).filter(Boolean)).toEqual(["Reset", "Apply"]);
        expect(getByTitle("Previous Match")).not.toBeNull();
        expect(getByTitle("Next Match")).not.toBeNull();
        fireEvent.click(getByText("Reset"));
        expect(getByTitle("Priority Filter").textContent).toContain("All");

        fireEvent.click(getByTitle("Priority Filter"));
        fireEvent.click(container.querySelector(
            "#logsFilterEditor>.logsFilterField:nth-child(2) input[value='Error']",
        )!);
        fireEvent.click(getByTitle("Next Match"));
        await waitFor(() => {
            expect(container.querySelector("#logsTable .tabulator-row.highlighted")?.textContent)
                .toContain("startup failed");
        });
        fireEvent.click(getByTitle("Next Match"));
        await waitFor(() => {
            expect(container.querySelector("#logsTable .tabulator-row.highlighted")?.textContent)
                .toContain("startup failed");
        });
        fireEvent.click(getByText("Apply"));

        await waitFor(() => {
            expect(container.textContent).toContain("startup failed");
            expect(container.textContent).not.toContain("recovered");
            expect(getByTitle("Last Page").classList.contains("disabled")).toBe(false);
        });

        fireEvent.click(getByTitle("Filter"));

        expect(container.querySelector("#logsFilterEditor")).toBeNull();

        fireEvent.click(getByTitle("Last Page"));

        await waitFor(() => {
            expect(container.textContent).toContain("last table page");
        });

        fireEvent.click(getByTitle("First Page"));

        await waitFor(() => {
            expect(container.textContent).toContain("startup failed");
        });
    });

    it("captures the pointer when resizing the Message column", async () => {
        const backend = {
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "message"]],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const { container } = render(<Logs backend={backend} connectionDetails={localConnection} />);

        await waitFor(() => {
            expect(container.querySelector(
                ".tabulator-col[tabulator-field='data'] + .tabulator-col-resize-handle",
            )).not.toBeNull();
        });
        const handle = container.querySelector<HTMLElement>(
            ".tabulator-col[tabulator-field='data'] + .tabulator-col-resize-handle",
        )!;
        const capture = vi.fn();
        Object.defineProperty(handle, "setPointerCapture", { configurable: true, value: capture });
        const pointerDown = new MouseEvent("pointerdown", { bubbles: true });
        Object.defineProperty(pointerDown, "pointerId", { configurable: true, value: 1 });

        handle.dispatchEvent(pointerDown);

        expect(capture).toHaveBeenCalledWith(1);
    });

    it("shows the last local file-backed error log page by default", async () => {
        const readErrorLogFilePage = vi.fn()
            .mockResolvedValueOnce({
                path: "/var/lib/mysql/mysqld.err",
                isTruncated: true,
                page: 0,
                pageSize: 1000,
                totalLines: 2500,
                totalPages: 3,
                errorCodeValues: ["MY-010119", "MY-010931"],
                subsystemValues: ["InnoDB", "Server"],
                hasNext: true,
                rows: [],
            })
            .mockResolvedValueOnce({
                path: "/var/lib/mysql/mysqld.err",
                isTruncated: true,
                page: 2,
                pageSize: 1000,
                totalLines: 2500,
                totalPages: 3,
                errorCodeValues: ["MY-010119", "MY-010931"],
                subsystemValues: ["InnoDB", "Server"],
                hasNext: false,
                rows: [
                    {
                        line: 201,
                        logged: "2026-05-09T12:02:00.000000Z",
                        threadId: "0",
                        prio: "ERROR",
                        errorCode: "MY-010121",
                        subsystem: "Server",
                        data: "last page",
                    },
                ],
            })
            .mockResolvedValueOnce({
                path: "/var/lib/mysql/mysqld.err",
                isTruncated: true,
                page: 0,
                pageSize: 1000,
                totalLines: 3500,
                totalPages: 4,
                hasNext: true,
                rows: [],
            })
            .mockResolvedValueOnce({
                path: "/var/lib/mysql/mysqld.err",
                isTruncated: true,
                page: 3,
                pageSize: 1000,
                totalLines: 3500,
                totalPages: 4,
                hasNext: false,
                rows: [
                    {
                        line: 301,
                        logged: "2026-05-09T12:03:00.000000Z",
                        threadId: "0",
                        prio: "ERROR",
                        errorCode: "MY-010122",
                        subsystem: "Server",
                        data: "refreshed last page",
                    },
                ],
            })
            .mockResolvedValueOnce({
                path: "/var/lib/mysql/mysqld.err",
                isTruncated: true,
                page: 0,
                pageSize: 1000,
                totalLines: 3500,
                totalPages: 4,
                hasNext: true,
                rows: [
                    {
                        line: 1,
                        logged: "2026-05-09T12:00:00.000000Z",
                        threadId: "0",
                        prio: "ERROR",
                        errorCode: "MY-010119",
                        subsystem: "Server",
                        data: "first page",
                    },
                ],
            });
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn(() => {
                throw new Error("performance_schema.error_log is unavailable");
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("last page");
        });

        expect(container.textContent).toContain("2026-05-09 12:02:00.000000Z");
        expect(container.textContent).not.toContain("2026-05-09T12:02:00.000000Z");
        expect(readErrorLogFilePage).toHaveBeenCalledWith(0, 1000);
        expect(readErrorLogFilePage).toHaveBeenCalledWith(2, 1000);
        expect(container.textContent).toContain("Showing logs from /var/lib/mysql/mysqld.err");
        expect(container.textContent).toContain("Only the last 1 GiB of this error log is shown.");

        fireEvent.click(getByTitle("Refresh"));

        await waitFor(() => {
            expect(container.textContent).toContain("refreshed last page");
        });

        expect(readErrorLogFilePage).toHaveBeenLastCalledWith(3, 1000);

        fireEvent.click(getByTitle("First Page"));

        await waitFor(() => {
            expect(container.textContent).toContain("first page");
        });

        expect(readErrorLogFilePage).toHaveBeenCalledWith(0, 1000);
    });

    it("toggles between table-backed and file-backed error logs", async () => {
        const readErrorLogFilePage = vi.fn()
            .mockResolvedValue({
                path: "/var/lib/mysql/mysqld.err",
                page: 0,
                pageSize: 1000,
                totalLines: 1,
                totalPages: 1,
                hasNext: false,
                rows: [{
                    line: 1,
                    logged: "2026-05-09T12:00:00.000000Z",
                    threadId: "0",
                    prio: "ERROR",
                    errorCode: "MY-010119",
                    subsystem: "Server",
                    data: "file row",
                }],
            });
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "table row"]],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("table row");
        });

        fireEvent.click(getByTitle("Show Action Menu"));
        await waitFor(() => {
            expect(document.getElementById("readFromLogFile")?.textContent)
                .toContain("View Error Log File");
        });
        fireEvent.click(document.getElementById("readFromLogFile")!);

        await waitFor(() => {
            expect(container.textContent).toContain("file row");
        });
        expect(readErrorLogFilePage).toHaveBeenCalledWith(0, 1000);

        fireEvent.click(getByTitle("Show Action Menu"));
        await waitFor(() => {
            expect(document.getElementById("readFromLogFile")?.textContent)
                .toContain("View Error Log Table");
        });
        fireEvent.click(document.getElementById("readFromLogFile")!);

        await waitFor(() => {
            expect(container.textContent).toContain("table row");
        });
    });

    it("keeps the file source while refreshing and changing pages", async () => {
        const readErrorLogFilePage = vi.fn()
            .mockImplementation((page: number) => {
                return Promise.resolve({
                    path: "/var/lib/mysql/mysqld.err",
                    page,
                    pageSize: 1000,
                    totalLines: 2000,
                    totalPages: 2,
                    hasNext: page === 0,
                    rows: [{
                        line: (page * 1000) + 1,
                        logged: "2026-05-09T12:00:00.000000Z",
                        threadId: "0",
                        prio: "ERROR",
                        errorCode: "MY-010119",
                        subsystem: "Server",
                        data: `file page ${page + 1}`,
                    }],
                });
            });
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "table row"]],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("table row");
        });

        fireEvent.click(getByTitle("Show Action Menu"));
        fireEvent.click(document.getElementById("readFromLogFile")!);

        await waitFor(() => {
            expect(container.textContent).toContain("file page 2");
        });

        fireEvent.click(getByTitle("First Page"));
        await waitFor(() => {
            expect(container.textContent).toContain("file page 1");
        });

        const callsBeforeRefresh = readErrorLogFilePage.mock.calls.length;
        fireEvent.click(getByTitle("Refresh"));
        await waitFor(() => {
            expect(readErrorLogFilePage).toHaveBeenCalledTimes(callsBeforeRefresh + 1);
            expect(readErrorLogFilePage).toHaveBeenLastCalledWith(0, 1000);
        });
    });

    it("ignores stale file-page responses", async () => {
        const filePage = (data: string) => {
            return {
                path: "/var/lib/mysql/mysqld.err",
                page: 0,
                pageSize: 1000,
                totalLines: 1,
                totalPages: 1,
                hasNext: false,
                rows: [{
                    line: 1,
                    logged: "2026-05-09T12:00:00.000000Z",
                    threadId: "0",
                    prio: "ERROR",
                    errorCode: "MY-010119",
                    subsystem: "Server",
                    data,
                }],
            };
        };
        let resolveStaleResponse: ((result: ReturnType<typeof filePage>) => void) | undefined;
        const readErrorLogFilePage = vi.fn()
            .mockResolvedValueOnce(filePage("initial row"))
            .mockImplementationOnce(() => {
                return new Promise((resolve: (result: ReturnType<typeof filePage>) => void) => {
                    resolveStaleResponse = resolve;
                });
            })
            .mockResolvedValueOnce(filePage("latest row"));

        const { container, getByTitle } = render(<Logs
            backend={{ readErrorLogFilePage } as unknown as ShellInterfaceSqlEditor}
            connectionDetails={localConnection}
            offline={true}
        />);
        await waitFor(() => {
            expect(container.textContent).toContain("initial row");
        });

        fireEvent.click(getByTitle("Refresh"));
        fireEvent.click(getByTitle("Refresh"));
        await waitFor(() => {
            expect(container.textContent).toContain("latest row");
        });

        resolveStaleResponse!(filePage("stale row"));
        await waitFor(() => {
            expect(readErrorLogFilePage).toHaveBeenCalledTimes(3);
        });
        expect(container.textContent).toContain("latest row");
        expect(container.textContent).not.toContain("stale row");
    });

    it("reads cached local error log data while offline", async () => {
        const readErrorLogFilePage = vi.fn()
            .mockResolvedValue({
                path: "/var/lib/mysql/mysqld.err",
                page: 0,
                pageSize: 1000,
                totalLines: 1,
                totalPages: 1,
                hasNext: false,
                rows: [{
                    line: 1,
                    logged: "2026-05-09T12:00:00.000000Z",
                    threadId: "0",
                    prio: "ERROR",
                    errorCode: "MY-010119",
                    subsystem: "Server",
                    data: "offline row",
                }],
            });

        const { container } = render(<Logs
            backend={{ readErrorLogFilePage } as unknown as ShellInterfaceSqlEditor}
            connectionDetails={localConnection}
            offline
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("offline row");
        });
        expect(readErrorLogFilePage).toHaveBeenCalledWith(0, 1000);
    });

    it("reports when no supported error log source is available", async () => {
        const readErrorLogFilePage = vi.fn().mockResolvedValue(undefined);

        const { container } = render(<Logs
            backend={{
                executeService: vi.fn(() => {
                    throw new Error("performance_schema.error_log is unavailable");
                }),
                readErrorLogFilePage,
            } as unknown as ShellInterfaceSqlEditor}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("No supported error log sources are available.");
        });
    });

    it("returns to the error log table when the file source is unavailable", async () => {
        const readErrorLogFilePage = vi.fn().mockResolvedValue(undefined);
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "table row"]],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const { container, getByTitle } = render(<Logs backend={backend} connectionDetails={localConnection} />);

        await waitFor(() => {
            expect(container.textContent).toContain("table row");
        });
        fireEvent.click(getByTitle("Show Action Menu"));
        fireEvent.click(document.getElementById("readFromLogFile")!);

        await waitFor(() => {
            expect(container.textContent).toContain("Showing logs from the error log file");
        });
        fireEvent.click(getByTitle("Show Action Menu"));
        await waitFor(() => {
            expect(document.getElementById("readFromLogFile")?.textContent).toContain("View Error Log Table");
        });
        fireEvent.click(document.getElementById("readFromLogFile")!);

        await waitFor(() => {
            expect(container.textContent).toContain("table row");
        });
    });

    it("displays a 1024-character preview for long messages", async () => {
        const message = "x".repeat(1025);
        const backend = {
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", message]],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const { container } = render(<Logs backend={backend} connectionDetails={localConnection} />);

        await waitFor(() => {
            expect(container.querySelector(".tabulator-cell[tabulator-field='data'] span")?.textContent)
                .toBe(`${message.slice(0, 1024)}…`);
        });
        expect(container.querySelector(".tabulator-cell[tabulator-field='data'] span")?.getAttribute("data-tooltip"))
            .toBe(message);
    });

    it("copies all selected log rows from the row context menu", async () => {
        const writeToClipboard = vi.spyOn(requisitions, "writeToClipboard").mockImplementation(() => { /**/ });
        const backend = {
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[2]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [
                        ["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "first message"],
                        ["2026-05-09T11:59:00.000000Z", 4, "Warning", "MY-010931", "InnoDB", "second\tmessage"],
                    ],
                };
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const ref = createRef<Logs>();
        render(<Logs ref={ref} backend={backend} connectionDetails={localConnection} />);

        const instance = ref.current! as unknown as {
            logTableRef: { current: { getRows: () => Array<{ select: () => void }> } };
            handleLogRowContext: (event: Event, row: unknown) => void;
        };
        await waitFor(() => {
            expect(instance.logTableRef.current.getRows()).toHaveLength(2);
        });
        const rows = instance.logTableRef.current.getRows();
        rows[0].select();
        rows[1].select();
        instance.handleLogRowContext(new MouseEvent("contextmenu", { clientX: 20, clientY: 20 }), rows[0]);

        await waitFor(() => {
            expect(document.getElementById("copySelectedLogRows")).not.toBeNull();
        });
        fireEvent.click(document.getElementById("copySelectedLogRows")!);

        expect(writeToClipboard).toHaveBeenCalledWith(
            "2026-05-09 12:00:00.000000Z\tError\tMY-010119\tServer\tfirst message\n" +
            "2026-05-09 11:59:00.000000Z\tWarning\tMY-010931\tInnoDB\tsecond\tmessage",
        );
    });

    it("opens the save dialog and exports all table-backed logs", async () => {
        const exportErrorLogs = vi.fn().mockResolvedValue(undefined);
        const executeRemote = vi.spyOn(requisitions, "executeRemote").mockReturnValue(true);
        vi.spyOn(ui, "showInformationMessage").mockResolvedValue(undefined);
        const backend = {
            executeService: vi.fn((query: string) => {
                if (query.includes("COUNT(*)")) {
                    return { rows: [[1]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return {
                    rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "MY-010119", "Server", "failure"]],
                };
            }),
            exportErrorLogs,
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={remoteConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("failure");
        });

        fireEvent.click(getByTitle("Show Action Menu"));
        await waitFor(() => {
            expect(document.getElementById("exportLogs")).not.toBeNull();
        });

        expect(document.getElementById("readFromLogFile")?.classList.contains("disabled")).toBe(true);
        fireEvent.click(document.getElementById("exportLogs")!);

        expect(executeRemote).toHaveBeenCalledWith("showSaveDialog", expect.objectContaining({
            title: "Export Error Logs",
            saveLabel: "Export",
            default: "db.example.com-error.log",
        }));
        const resourceId = (executeRemote.mock.calls[0][1] as { id: string }).id;
        await requisitions.execute("selectFile", {
            resourceId,
            file: [{ path: "/tmp/exported-error.log", content: new ArrayBuffer(0) }],
        });

        expect(exportErrorLogs).toHaveBeenCalledWith("/tmp/exported-error.log");
    });

    it("does not apply draft filters when another page is loaded", async () => {
        const backend = {
            executeService: vi.fn((query: string) => {
                if (query.startsWith("show variables")) {
                    return {
                        rows: [
                            ["log_error", "/var/lib/mysql/mysqld.err"],
                            ["log_error_services", "log_sink_perfschema"],
                            ["datadir", "/var/lib/mysql/"],
                        ],
                    };
                }

                if (query.includes("COUNT(*)")) {
                    return { rows: [[1001]] };
                }

                if (query.includes("SELECT DISTINCT")) {
                    return { rows: [] };
                }

                return query.includes("OFFSET 1000")
                    ? { rows: [["2026-05-09T12:01:00.000000Z", 4, "Warning", "", "Server", "second page"]] }
                    : { rows: [["2026-05-09T12:00:00.000000Z", 4, "Error", "", "Server", "first page"]] };
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("first page");
        });
        fireEvent.click(getByTitle("Filter"));
        fireEvent.click(getByTitle("Priority Filter"));
        fireEvent.click(container.querySelector("input[value='Error']")!);
        fireEvent.click(getByTitle("Next Page"));

        await waitFor(() => {
            expect(container.textContent).toContain("second page");
        });
    });

    it("uses server epochs for timestamp filtering and match navigation", async () => {
        const now = Date.parse("2026-05-09T12:00:00Z");
        const clock = vi.spyOn(Date, "now").mockReturnValue(now);
        Element.prototype.scrollIntoView = vi.fn();
        const executeService = vi.fn((query: string) => {
            if (query.includes("SELECT DISTINCT")) {
                return { rows: [] };
            }
            if (query.includes("COUNT(*)")) {
                return { rows: [[2000]] };
            }

            expect(query).toContain("UNIX_TIMESTAMP(LOGGED)");

            return {
                rows: [["2026-05-09 01:30:00", 4, "Error", "MY-1", "Server", "recent entry",
                    Date.parse("2026-05-09T11:30:00Z") / 1000]],
            };
        });
        const backend = { executeService } as unknown as ShellInterfaceSqlEditor;
        const { container, getByText, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("recent entry");
        });
        fireEvent.click(getByTitle("Filter"));
        fireEvent.change(container.querySelector("#logsFilterEditor .logsFilterField:first-child select")!, {
            target: { value: "1h" },
        });
        fireEvent.click(getByTitle("Next Match"));
        await waitFor(() => {
            expect(container.querySelector("#logsTable .tabulator-row.highlighted")?.textContent)
                .toContain("recent entry");
        });
        fireEvent.click(getByText("Apply"));

        await waitFor(() => {
            expect(container.querySelector("#logsTable .tabulator-table")?.textContent).toContain("recent entry");
        });
        await waitFor(() => {
            expect(getByTitle("Next Page").classList.contains("disabled")).toBe(false);
        });
        clock.mockReturnValue(now + 60_000);
        fireEvent.click(getByTitle("Next Page"));
        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(
                expect.stringContaining("OFFSET 1000"), [(now / 1000) - 3600],
            );
            expect(getByTitle("First Page").classList.contains("disabled")).toBe(false);
        });
        fireEvent.click(getByTitle("Refresh"));
        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(
                expect.stringContaining("OFFSET 1000"), [(now / 1000) - 3540],
            );
        });
    });

    it("applies filters before table pagination", async () => {
        const executeService = vi.fn((query: string, params?: unknown[]) => {
            if (query.includes("SELECT DISTINCT")) {
                return { rows: [] };
            }
            if (query.includes("COUNT(*)")) {
                return { rows: [[query.includes("WHERE PRIO IN (?)") ? 1 : 1001]] };
            }
            if (query.includes("WHERE PRIO IN (?)")) {
                expect(params).toEqual(["Error"]);

                return {
                    rows: [["2026-05-09T12:00:00Z", 4, "Error", "MY-1", "Server", "matching row"]],
                };
            }

            return {
                rows: [["2026-05-09T12:01:00Z", 4, "Warning", "MY-2", "Server", "unfiltered row"]],
            };
        });
        const backend = { executeService } as unknown as ShellInterfaceSqlEditor;
        const { container, getByText, getByTitle } = render(<Logs
            backend={backend}
            connectionDetails={localConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("unfiltered row");
        });
        fireEvent.click(getByTitle("Filter"));
        fireEvent.click(getByTitle("Priority Filter"));
        fireEvent.click(container.querySelector("input[value='Error']")!);
        fireEvent.click(getByText("Apply"));

        await waitFor(() => {
            expect(container.textContent).toContain("matching row");
        });
        expect(executeService).toHaveBeenCalledWith(
            "SELECT COUNT(*) FROM performance_schema.error_log WHERE PRIO IN (?)",
            ["Error"],
        );
        expect(getByTitle("Next Page").classList.contains("disabled")).toBe(true);
    });

    it("does not read file-backed error logs for remote targets", async () => {
        const readErrorLogFilePage = vi.fn().mockResolvedValue(undefined);
        const backend = {
            readErrorLogFilePage,
            executeService: vi.fn(() => {
                throw new Error("performance_schema.error_log is unavailable");
            }),
        } as unknown as ShellInterfaceSqlEditor;

        const { container } = render(<Logs
            backend={backend}
            connectionDetails={remoteConnection}
        />);

        await waitFor(() => {
            expect(container.textContent).toContain("Error log source unavailable");
        });

        expect(container.textContent).toContain("performance_schema.error_log is unavailable");
        expect(readErrorLogFilePage).not.toHaveBeenCalled();
    });
});
