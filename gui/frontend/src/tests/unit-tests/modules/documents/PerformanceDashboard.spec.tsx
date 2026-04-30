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

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { CellComponent, RowComponent } from "tabulator-tables";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ISavedGraphData } from "../../../../modules/db-editor/index.js";
import { MemoryReport } from "../../../../modules/db-editor/performance/MemoryReport.js";
import { PerformanceDashboard } from "../../../../modules/db-editor/PerformanceDashboard.js";
import {
    fullScanFormatter, SlowQueriesReport,
} from "../../../../modules/db-editor/performance/SlowQueriesReport.js";
import { ScriptingLanguageServices } from "../../../../script-execution/ScriptingLanguageServices.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { Settings } from "../../../../supplement/Settings/Settings.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("PerformanceDashboard Tests", (): void => {
    beforeEach(() => {
        Settings.set("general.statementHistogramExplainerSeen", true);
        Settings.set("general.slowQueriesExplainerSeen", true);
    });

    const performanceReportItems = (): HTMLElement[] => {
        const popups = document.querySelectorAll<HTMLElement>("#performanceReportDropdownPopup");
        const popup = popups[popups.length - 1];

        return Array.from(popup.querySelectorAll<HTMLElement>(".dropdownItem"));
    };

    const clickPerformanceReport = async (container: HTMLElement, title: string): Promise<void> => {
        fireEvent.click(container.querySelector("#performanceReportDropdown")!);

        const report = await waitFor(() => {
            const item = performanceReportItems().find((candidate) => {
                return candidate.textContent?.includes(title) === true;
            });

            expect(item).toBeTruthy();

            return item!;
        });

        fireEvent.click(report);
        await nextRunLoop();
    };

    const clickWaitView = async (container: HTMLElement, title: string): Promise<void> => {
        fireEvent.click(container.querySelector("#waitReportDropdown")!);

        const report = await waitFor(() => {
            const popups = document.querySelectorAll<HTMLElement>("#waitReportDropdownPopup");
            const popup = popups[popups.length - 1];
            const item = Array.from(popup.querySelectorAll<HTMLElement>(".dropdownItem")).find((candidate) => {
                return candidate.textContent?.includes(title) === true;
            });

            expect(item).toBeTruthy();

            return item!;
        });

        fireEvent.click(report);
        await nextRunLoop();
    };

    const backend = new ShellInterfaceSqlEditor();

    it("Test PerformanceDashboard instantiation", async () => {
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
            />,
        );

        await nextRunLoop();

        expect(container).matchSnapshot();

        unmount();
    });

    it("switches between performance reports", async () => {
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(container, "Table Sizes");

        expect(container.querySelector("#performanceReportDropdown")?.textContent).toContain("Table Sizes");
        expect(container.querySelector("#performanceReportDropdown .performanceReportDropdownSummary")?.textContent)
            .toBe("Data and index storage grouped by schema.");
        expect(container.querySelector(".mysqlInspector")).toBeTruthy();

        fireEvent.click(container.querySelector("#performanceReportDropdown")!);
        const reportItems = performanceReportItems();
        expect(reportItems).toHaveLength(5);
        expect(Array.from(reportItems).map((item) => {
            return item.querySelector(".performanceReportDropdownTitle")?.textContent;
        })).toEqual(expect.arrayContaining([
            "Memory",
            "Waits",
            "Statement Histogram",
            "Slow Queries",
            "Table Sizes",
        ]));
        expect(Array.from(reportItems).map((item) => {
            return item.textContent;
        })).toContain("Table SizesData and index storage grouped by schema.");
        fireEvent.click(container.querySelector("#performanceReportDropdown")!);

        expect(container.querySelector(".performanceHeadingActions #mysqlInspectorRefreshButton")).toBeTruthy();

        unmount();
    });

    it("restores the selected report after remounting", async () => {
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };
        const onGraphDataChange = vi.fn<(data: ISavedGraphData) => void>();

        const firstRender = render(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
                onGraphDataChange={onGraphDataChange}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(firstRender.container, "Table Sizes");
        expect(onGraphDataChange.mock.calls.at(-1)![0].performanceDashboardState?.activeReportId)
            .toBe("tableSizes");
        firstRender.unmount();

        const savedGraphData = onGraphDataChange.mock.calls.at(-1)![0];
        const secondRender = render(
            <PerformanceDashboard
                backend={backend}
                graphData={savedGraphData}
            />,
        );

        await nextRunLoop();
        expect(secondRender.container.querySelector("#performanceReportDropdown")?.textContent)
            .toContain("Table Sizes");

        secondRender.unmount();
    });

    it("renders memory usage report from sys views", async () => {
        const onGraphDataChange = vi.fn<(data: ISavedGraphData) => void>();
        const executeService = vi.fn((query: string) => {
            if (query.includes("sys.memory_global_by_current_bytes")) {
                return Promise.resolve({
                    rows: [["memory/innodb/buf_buf_pool", "128.00 MiB"]],
                });
            }

            if (query.includes("sys.memory_global_total")) {
                return Promise.resolve({ rows: [["256.00 MiB"]] });
            }

            if (query.includes("sys.memory_by_thread_by_current_bytes")) {
                return Promise.resolve({
                    rows: [[123, "app@localhost", 10, "32.00 MiB", "3.20 MiB", "16.00 MiB", "64.00 MiB"]],
                });
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithMemory = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backendWithMemory}
                graphData={graphData}
                onGraphDataChange={onGraphDataChange}
            />,
        );

        await nextRunLoop();

        await clickPerformanceReport(container, "Memory");

        expect(await screen.findByText("Total Allocated Memory")).toBeDefined();
        expect(await screen.findByText("256.00 MiB")).toBeDefined();
        expect(screen.getByText("memory/innodb/buf_buf_pool")).toBeDefined();
        expect(screen.getByText("128.00 MiB")).toBeDefined();
        expect(screen.getAllByText("Usage by Thread").length).toBeGreaterThan(0);
        expect(container.querySelector(".performanceHeadingActions #memoryRefreshButton")).toBeTruthy();
        await waitFor(() => {
            expect(container.querySelector("#memoryPerformanceGrid.performanceTableGrid")).toBeTruthy();
        });
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("limit 20"));

        const callCount = executeService.mock.calls.length;
        fireEvent.click(container.querySelector("#memoryRefreshButton")!);
        await screen.findByText("256.00 MiB");
        expect(executeService.mock.calls.length).toBeGreaterThan(callCount);

        unmount();

        const restored = render(
            <PerformanceDashboard
                backend={backendWithMemory}
                graphData={onGraphDataChange.mock.calls.at(-1)![0]}
            />,
        );

        expect(restored.container.querySelector("#performanceReportDropdown")?.textContent).toContain("Memory");
        expect(await screen.findByText("memory/innodb/buf_buf_pool")).toBeDefined();
        expect(await screen.findByText("128.00 MiB")).toBeDefined();

        restored.unmount();
    });

    it("ignores stale memory results after changing the selected view", async () => {
        let resolveThread!: (value: { rows: unknown[][] }) => void;
        let resolveHost!: (value: { rows: unknown[][] }) => void;
        const threadResult = new Promise<{ rows: unknown[][] }>((resolve) => {
            resolveThread = resolve;
        });
        const hostResult = new Promise<{ rows: unknown[][] }>((resolve) => {
            resolveHost = resolve;
        });
        const executeService = vi.fn((query: string) => {
            if (query.includes("sys.memory_by_thread_by_current_bytes")) {
                return threadResult;
            }
            if (query.includes("sys.memory_by_host_by_current_bytes")) {
                return hostResult;
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithMemory = {
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(false),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;
        const reportRef = createRef<MemoryReport>();
        const { unmount } = render(
            <MemoryReport
                ref={reportRef}
                backend={backendWithMemory}
                initialViewId="thread"
                onViewIdChange={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
                "sys.memory_by_thread_by_current_bytes",
            ));
        });

        const report = reportRef.current as unknown as {
            state: {
                viewId: "thread" | "host" | "user";
                rows: Array<{ label: string }>;
            };
            updateValues: () => Promise<void>;
        };
        report.state.viewId = "host";
        const hostUpdate = report.updateValues();
        resolveHost({ rows: [["db-host", 1, "1 B", "1 B", "1 B", "1 B"]] });
        await hostUpdate;
        await waitFor(() => {
            expect(report.state.rows[0]?.label).toBe("db-host");
        });

        resolveThread({ rows: [[123, "app@localhost", 1, "2 B", "2 B", "2 B", "2 B"]] });
        await nextRunLoop();
        expect(report.state.rows[0]?.label).toBe("db-host");

        unmount();
    });

    it("renders cumulative wait summaries and scoped wait views", async () => {
        const onGraphDataChange = vi.fn<(data: ISavedGraphData) => void>();
        const executeService = vi.fn((query: string, params?: unknown[]) => {
            if (query.startsWith("select event_class")) {
                return Promise.resolve({
                    rows: [
                        [
                            "wait/io/file", 51805, 2620000000000, "2.62 s", 50480000, "50.48 us",
                            0, "0 ps", 52350000000, "52.35 ms",
                        ],
                        [
                            "wait/io/table", 1440, 40000000000, "40.00 ms", 27780000, "27.78 us",
                            0, "0 ps", 25870000000, "25.87 ms",
                        ],
                    ],
                });
            }

            if (query.startsWith("select events")) {
                return Promise.resolve({
                    rows: [[
                        "wait/io/file/innodb/innodb_log_file", 3196, 999090000000, "999.09 ms",
                        312590000, "312.59 us", null, null, 52350000000, "52.35 ms",
                    ]],
                });
            }

            if (query.startsWith("select host, sum(total)")) {
                return Promise.resolve({
                    rows: [[
                        "db'o", 8272, 1240000000000, "1.24 s", 149900000, "149.90 us",
                        null, null, 52350000000, "52.35 ms",
                    ]],
                });
            }

            if (query.includes("where host <=>")) {
                if (params?.[0] === "bad") {
                    return Promise.reject(new Error("child wait data unavailable"));
                }

                return Promise.resolve({
                    rows: [[
                        "wait/io/file/sql/io_cache", 38088, 812510000000, "812.51 ms",
                        21300000, "21.30 us", null, null, 18650000000, "18.65 ms",
                    ]],
                });
            }

            if (query.startsWith("select user, sum(total)")) {
                return Promise.resolve({
                    rows: [[
                        "root", 40123, 920000000000, "920.00 ms", 22930000, "22.93 us",
                        null, null, 25670000000, "25.67 ms",
                    ]],
                });
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithWaits = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const dashboardRef = createRef<PerformanceDashboard>();
        const { container, unmount } = render(
            <PerformanceDashboard
                ref={dashboardRef}
                backend={backendWithWaits}
                graphData={graphData}
                onGraphDataChange={onGraphDataChange}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(container, "Waits");

        expect(await screen.findByText("98.5%")).toBeDefined();
        expect(screen.getByText("1.5%")).toBeDefined();
        expect(screen.getByText("Avg 50.48 us")).toBeDefined();
        expect(screen.getByText("Avg 27.78 us")).toBeDefined();
        expect(screen.getAllByText("Min 0 ps")).toHaveLength(2);
        expect(screen.getByText("Max 52.35 ms")).toBeDefined();
        expect(screen.getByText("Max 25.87 ms")).toBeDefined();
        const waitSummaryCaption = screen.getByText("Share of total wait latency by class*");
        expect(waitSummaryCaption).toBeDefined();
        expect(waitSummaryCaption.getAttribute("data-tooltip")).toBe("Since Performance Schema reset");
        expect(container.querySelector(".performanceHeadingActions #waitRefreshButton")).toBeTruthy();
        await waitFor(() => {
            expect(container.querySelector("#waitPerformanceGrid.performanceTableGrid")).toBeTruthy();
        });
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "from sys.x$wait_classes_global_by_latency order by total_latency desc limit 100",
        ));
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("sys.format_time(total_latency)"));

        await clickWaitView(container, "All Events");
        expect(container.querySelector("#waitReportDropdown")?.textContent).toContain("All Events");
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "from sys.x$waits_global_by_latency order by total_latency desc limit 100",
        ));

        await clickWaitView(container, "By Host");
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "from sys.x$waits_by_host_by_latency group by host",
        ));
        expect(screen.getByText("98.5%")).toBeDefined();
        expect(screen.getByText("Avg 50.48 us")).toBeDefined();

        await clickWaitView(container, "By User");
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "from sys.x$waits_by_user_by_latency group by user",
        ));

        const waitReport = (dashboardRef.current as unknown as {
            waitsReportRef: {
                current: {
                    state: {
                        viewId: string;
                        rows: Array<{
                            id: string;
                            expanded?: boolean;
                            children?: Array<{ label: string }>;
                            childrenLoaded?: boolean;
                            childrenLoading?: boolean;
                        }>;
                    };
                    tableColumns: () => Array<{ title: string; field: string; sorter?: string }>;
                    handleRowExpanded: (row: RowComponent, level: number) => void;
                    handleRowCollapsed: (row: RowComponent, level: number) => void;
                    isRowExpanded: (row: RowComponent, level: number) => boolean;
                };
            };
        }).waitsReportRef.current;
        waitReport.state.viewId = "classes";
        const waitTableColumns = waitReport.tableColumns();
        expect(waitTableColumns.find((column) => {
            return column.title === "Total Latency";
        })).toMatchObject({ field: "totalLatencyRaw", sorter: "number" });
        expect(waitTableColumns.find((column) => {
            return column.title === "Occurrences";
        })).toMatchObject({ field: "occurrences", sorter: "number" });

        const parent = {
            id: "db'o.0",
            label: "db'o",
            occurrences: "8272",
            totalLatencyRaw: "1240000000000",
            totalLatency: "1.24 s",
            averageLatencyRaw: "149900000",
            averageLatency: "149.90 us",
            minimumLatencyRaw: "-",
            minimumLatency: "-",
            maximumLatencyRaw: "52350000000",
            maximumLatency: "52.35 ms",
        };
        const row = {
            getData: () => {
                return parent;
            },
        } as unknown as RowComponent;
        const selectedWaitViewId = waitReport.state.viewId;
        const selectedWaitRows = waitReport.state.rows;
        waitReport.state.viewId = "host";
        waitReport.state.rows = [parent];
        waitReport.handleRowExpanded(row, 0);
        await waitFor(() => {
            expect(waitReport.state.rows[0].expanded).toBe(true);
        });
        await waitFor(() => {
            expect(waitReport.state.rows[0].children).toEqual([expect.objectContaining({
                label: "wait/io/file/sql/io_cache",
            })]);
            expect(waitReport.state.rows[0].childrenLoaded).toBe(true);
            expect(waitReport.state.rows[0].childrenLoading).toBe(false);
        });
        expect(executeService).toHaveBeenCalledWith(
            expect.stringContaining("where host <=> ?"),
            ["db'o"],
        );
        const loadedRow = {
            getData: () => {
                return waitReport.state.rows[0];
            },
        } as unknown as RowComponent;
        expect(waitReport.isRowExpanded(loadedRow, 0)).toBe(true);
        waitReport.handleRowCollapsed(loadedRow, 0);
        await waitFor(() => {
            expect(waitReport.state.rows[0].expanded).toBe(false);
        });

        const failedParent = {
            ...parent,
            id: "bad.0",
            label: "bad",
            childrenLoaded: false,
            childrenLoading: false,
        };
        const failedRow = {
            getData: () => {
                return failedParent;
            },
        } as unknown as RowComponent;
        waitReport.state.rows = [failedParent];
        waitReport.handleRowExpanded(failedRow, 0);
        await waitFor(() => {
            expect(waitReport.state.rows[0].children).toEqual([expect.objectContaining({
                label: "Unable to load wait events: Error: child wait data unavailable",
            })]);
        });
        waitReport.state.viewId = selectedWaitViewId;
        waitReport.state.rows = selectedWaitRows;

        unmount();

        const savedState = onGraphDataChange.mock.calls.at(-1)![0].performanceDashboardState;
        expect(savedState?.activeReportId).toBe("waits");
        expect(savedState?.waitViewId).toBe("user");

        const restored = render(
            <PerformanceDashboard
                backend={backendWithWaits}
                graphData={onGraphDataChange.mock.calls.at(-1)![0]}
            />,
        );

        expect(restored.container.querySelector("#performanceReportDropdown")?.textContent).toContain("Waits");
        expect(restored.container.querySelector("#waitReportDropdown")?.textContent).toContain("By User");
        restored.unmount();
    });

    it("renders wait empty and error states", async () => {
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };
        const emptyBackend = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService: vi.fn((query: string) => {
                return Promise.resolve(query.startsWith("select sys.format_time(sum(total_latency))")
                    ? { rows: [[null, null, null, null]] }
                    : { rows: [] });
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const empty = render(
            <PerformanceDashboard
                backend={emptyBackend}
                graphData={graphData}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(empty.container, "Waits");
        expect(await screen.findByText(
            "No timed wait data found. Relevant Performance Schema instrumentation may be disabled.",
        )).toBeDefined();
        empty.unmount();

        const errorBackend = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService: vi.fn(() => {
                return Promise.reject(new Error("wait data unavailable"));
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const failed = render(
            <PerformanceDashboard
                backend={errorBackend}
                graphData={graphData}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(failed.container, "Waits");
        expect(await screen.findByText("Error: wait data unavailable")).toBeDefined();
        failed.unmount();
    });

    it("shows a capability error when a performance report is unavailable", async () => {
        const executeService = vi.fn(() => {
            return Promise.resolve({ rows: [] });
        });
        const backendWithUnavailableWaits = {
            executeService,
            getPerformanceReportCapabilities: vi.fn().mockResolvedValue({
                performanceSchema: true,
                logStatus: true,
                memory: true,
                waits: false,
                slowQueries: true,
                statementHistogram: true,
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backendWithUnavailableWaits}
                graphData={graphData}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(container, "Waits");

        expect(await screen.findByText(
            "Waits report requires the sys schema and Performance Schema wait views.",
        )).toBeDefined();
        expect(executeService).not.toHaveBeenCalledWith(expect.stringContaining("sys.x$wait_classes"));

        unmount();
    });

    it("renders slow query report from sys statement analysis", async () => {
        const executeService = vi.fn((query: string) => {
            if (query.includes("sys.x$statement_analysis")) {
                return Promise.resolve({
                    rows: [[
                        "sakila",
                        "digest-1",
                        "select * from rental where customer_id = ?",
                        42,
                        "2.10 s",
                        "50.00 ms",
                        "120.00 ms",
                        84,
                        4200,
                        3,
                        "*",
                    ]],
                });
            }

            if (query.includes("performance_schema.events_statements_histogram_by_digest")) {
                return Promise.resolve({
                    rows: [
                        [0, 100_000_000, 3],
                        [100_000_000, 250_000_000, 7],
                    ],
                });
            }

            if (query.includes("performance_schema.events_statements_summary_by_digest")) {
                return Promise.resolve({
                    rows: [[
                        10,
                        "1.00 s",
                        "5.00 ms",
                        "100.00 ms",
                        "250.00 ms",
                        "10.00 ms",
                        1,
                        2,
                        3,
                        42,
                        420,
                        4,
                        5,
                        6,
                        7,
                        8,
                        9,
                        10,
                        11,
                        12,
                        13,
                        14,
                        15,
                        16,
                        "20.00 ms",
                        "1.00 MiB",
                        "2.00 MiB",
                        "200.00 µs",
                        "240.00 µs",
                        "250.00 µs",
                        "2026-07-27 10:00:00",
                        "2026-07-27 11:00:00",
                    ]],
                });
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithSlowQueries = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backendWithSlowQueries}
                graphData={graphData}
            />,
        );

        await nextRunLoop();

        await clickPerformanceReport(container, "Slow Queries");

        await waitFor(() => {
            expect(container.querySelector("#slowQueriesPerformanceGrid.performanceTableGrid")).toBeTruthy();
        });
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("limit 20"));
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("avg_latency desc"));
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("sys.format_time"));
        await waitFor(() => {
            expect(screen.getByText("Selected Statement Details")).toBeTruthy();
            expect(container.querySelector("#slowQueryStatementHistogramGraph")).toBeTruthy();
        });
        expect(executeService).toHaveBeenCalledWith(
            expect.stringContaining("performance_schema.events_statements_histogram_by_digest"),
            ["sakila", "digest-1"],
        );
        expect(executeService).toHaveBeenCalledWith(
            expect.stringContaining("performance_schema.events_statements_summary_by_digest"),
            ["sakila", "digest-1"],
        );
        expect(container.querySelector(".slowQueryDigestSummary")).toBeTruthy();
        expect(screen.getByText("First Seen")).toBeTruthy();
        expect(screen.getByText("2026-07-27 10:00:00")).toBeTruthy();
        expect(screen.getByText("Last Seen")).toBeTruthy();
        expect(screen.getByText("2026-07-27 11:00:00")).toBeTruthy();

        fireEvent.click(container.querySelector("#latency")!);
        expect(screen.getAllByText("Total Latency").length).toBeGreaterThan(0);
        expect(screen.getByText("Min Latency")).toBeTruthy();
        expect(screen.getByText("Avg Latency")).toBeTruthy();
        expect(screen.getByText("Max Latency")).toBeTruthy();
        const percentileSelector = ".slowQueryStatementHistogram .slowQueryPercentileSummaryItem";
        expect(container.querySelectorAll(percentileSelector)).toHaveLength(3);
        expect(screen.getByText("p95").getAttribute("data-tooltip")).toBe("inherit");
        expect(screen.getByText("200.00 µs").getAttribute("data-tooltip")).toBe("inherit");
        expect(screen.getByText("p99")).toBeTruthy();
        expect(screen.getByText("240.00 µs")).toBeTruthy();
        expect(screen.getByText("p99.9")).toBeTruthy();
        expect(screen.getByText("250.00 µs")).toBeTruthy();

        fireEvent.click(container.querySelector("#resources")!);
        expect(screen.getByText("CPU Time")).toBeTruthy();
        expect(screen.getByText("Max Total Memory")).toBeTruthy();

        fireEvent.click(container.querySelector("#results")!);
        expect(screen.getByText("Rows Examined")).toBeTruthy();

        fireEvent.click(container.querySelector("#access")!);
        expect(screen.getByText("No Good Index Used")).toBeTruthy();
        expect(screen.getByText("Disk Temp Tables")).toBeTruthy();
        expect(screen.getByText("Sort Scan")).toBeTruthy();
        expect(container.querySelectorAll(".slowQueryDigestSummaryColumn")).toHaveLength(2);
        expect([...container.querySelectorAll(".slowQueryDigestSummaryColumnTitle")].map((element) => {
            return element.textContent;
        })).toEqual(["Access", "Temp & Sort"]);
        const executeRequisition = vi.spyOn(requisitions, "execute").mockResolvedValue(undefined);
        vi.spyOn(ScriptingLanguageServices.instance, "reformatSQL").mockResolvedValue(
            "SELECT *\nFROM rental\nWHERE customer_id = ?",
        );
        fireEvent.click(container.querySelector(".slowQuerySqlOpenButton")!);
        await waitFor(() => {
            expect(executeRequisition).toHaveBeenCalledWith("editorEditScript", expect.objectContaining({
                caption: "Selected Slow Query",
                content: "SELECT *\nFROM rental\nWHERE customer_id = ?",
                language: "mysql",
            }));
        });
        const cellWithValue = (value: string): CellComponent => {
            return { getValue: () => {
                return value;
            } } as CellComponent;
        };
        expect(fullScanFormatter(cellWithValue("*")).textContent).toBe("FULL SCAN");
        expect(fullScanFormatter(cellWithValue("-")).textContent).toBe("");
        expect(fullScanFormatter(cellWithValue("0")).textContent).toBe("");

        const callCount = executeService.mock.calls.length;
        fireEvent.click(container.querySelector("#slowQueriesRefreshButton")!);
        await waitFor(() => {
            expect(container.querySelector("#slowQueriesPerformanceGrid.performanceTableGrid")).toBeTruthy();
        });
        expect(executeService.mock.calls.length).toBeGreaterThan(callCount);

        unmount();
    });

    it("ignores stale slow-query details after selecting another row", async () => {
        let resolveFirst!: (value: { rows: unknown[][] }) => void;
        let resolveSecond!: (value: { rows: unknown[][] }) => void;
        const firstSummary = new Promise<{ rows: unknown[][] }>((resolve) => {
            resolveFirst = resolve;
        });
        const secondSummary = new Promise<{ rows: unknown[][] }>((resolve) => {
            resolveSecond = resolve;
        });
        const executeService = vi.fn((query: string, params?: unknown[]) => {
            if (query.includes("events_statements_summary_by_digest")) {
                return params?.[1] === "digest-first" ? firstSummary : secondSummary;
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithSlowQueries = {
            isPerformanceSchemaAvailable: vi.fn().mockResolvedValue(false),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;
        const reportRef = createRef<SlowQueriesReport>();
        const { unmount } = render(
            <SlowQueriesReport
                ref={reportRef}
                backend={backendWithSlowQueries}
                initialDetailGroupId="activity"
                onDetailGroupIdChange={vi.fn()}
            />,
        );
        const report = reportRef.current as unknown as {
            state: {
                selectedId?: string;
                summary: Array<{ value: string }>;
            };
            updateDetails: (row: Record<string, string>) => Promise<void>;
        };
        const row = (id: string, digest: string): Record<string, string> => {
            return {
                id,
                schema: "schema-with-'quote",
                digest,
                query: "select 1",
                executions: "1",
                totalLatency: "1 s",
                averageLatency: "1 s",
                maximumLatency: "1 s",
                rowsSent: "1",
                rowsExamined: "1",
                temporaryTables: "0",
                fullScan: "0",
            };
        };

        report.state.selectedId = "first";
        const firstUpdate = report.updateDetails(row("first", "digest-first"));
        report.state.selectedId = "second";
        const secondUpdate = report.updateDetails(row("second", "digest-second"));
        resolveSecond({ rows: [[222, ...Array.from({ length: 31 }, () => {
            return "-";
        })]] });
        await secondUpdate;
        await waitFor(() => {
            expect(report.state.summary[0]?.value).toBe("222");
        });

        resolveFirst({ rows: [[111, ...Array.from({ length: 31 }, () => {
            return "-";
        })]] });
        await firstUpdate;
        expect(report.state.summary[0]?.value).toBe("222");
        expect(executeService).toHaveBeenCalledWith(
            expect.stringContaining("schema_name <=> ? and digest = ?"),
            ["schema-with-'quote", "digest-second"],
        );

        unmount();
    });

    it("renders statement histogram from performance schema buckets", async () => {
        const executeService = vi.fn((query: string) => {
            if (query.includes("performance_schema.events_statements_histogram_global")) {
                return Promise.resolve({
                    rows: [
                        [0, 100_000_000, 4],
                        [2_000_000_000, 5_000_000_000, 6],
                    ],
                });
            }

            return Promise.resolve({ rows: [] });
        });
        const backendWithHistogram = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService,
        } as unknown as ShellInterfaceSqlEditor;

        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backendWithHistogram}
                graphData={graphData}
            />,
        );

        await nextRunLoop();

        expect(screen.getAllByText("Statement Histogram").length).toBeGreaterThan(0);
        await waitFor(() => {
            expect(container.querySelector("#statementHistogramGraph")).toBeTruthy();
        });
        await waitFor(() => {
            expect(container.querySelector(
                ".statementHistogramBucketTrack[title='4 statements (40%) in this instance executed in " +
                "100 µs or less.']",
            )).toBeTruthy();
            expect(container.querySelector(
                ".statementHistogramBucketTrack[title=" +
                "'10 statements (100%) in this instance executed in 5 ms or less.']",
            )).toBeTruthy();
        });
        expect(screen.getByText("p50")).toBeTruthy();
        expect(screen.getByText("2.5 ms")).toBeTruthy();
        expect(screen.getByText("p90")).toBeTruthy();
        expect(screen.getByText("4.5 ms")).toBeTruthy();
        expect(screen.getByText("p95")).toBeTruthy();
        expect(screen.getByText("4.75 ms")).toBeTruthy();
        expect(screen.getByText("p99")).toBeTruthy();
        expect(screen.getByText("4.95 ms")).toBeTruthy();
        expect(screen.getByText("p99.9")).toBeTruthy();
        expect(screen.getByText("5 ms")).toBeTruthy();
        expect(container.querySelector(
            ".statementHistogramPercentileInlineItem[data-tooltip=" +
            "'50% of statements in this instance executed in 2.5 ms or less.']",
        )).toBeTruthy();
        expect(container.querySelector(
            ".statementHistogramPercentileInlineItem[data-tooltip=" +
            "'99% of statements in this instance executed in 4.95 ms or less.']",
        )).toBeTruthy();
        expect(container.querySelector(
            ".statementHistogramPercentileInlineItem[data-tooltip=" +
            "'99.9% of statements in this instance executed in 5 ms or less.']",
        )).toBeTruthy();
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "performance_schema.events_statements_histogram_global",
        ));
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining(
            "order by bucket_timer_low",
        ));

        const callCount = executeService.mock.calls.length;
        fireEvent.click(container.querySelector("#statementHistogramRefreshButton")!);
        await waitFor(() => {
            expect(container.querySelector("#statementHistogramGraph")).toBeTruthy();
        });
        expect(executeService.mock.calls.length).toBeGreaterThan(callCount);

        unmount();
    });

    it("restores the MLE Status selection when MLE is available", async () => {
        const backendWithMle = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService: vi.fn((query: string) => {
                if (query.includes("show global status")) {
                    return Promise.resolve({
                        rows: [
                            ["mle_memory_used", "50"],
                            ["mle_status", "ON"],
                        ],
                    });
                }

                if (query.includes("SHOW GLOBAL VARIABLES LIKE 'mle.memory_max'")) {
                    return Promise.resolve({ rows: [["mle.memory_max", "1024"]] });
                }

                return Promise.resolve({ rows: [] });
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
            performanceDashboardState: {
                activeReportId: "mleStatus",
                memoryViewId: "thread",
                waitViewId: "classes",
                slowQueryDetailGroupId: "activity",
            },
        };

        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backendWithMle}
                graphData={graphData}
            />,
        );

        await nextRunLoop();
        await nextRunLoop();
        await waitFor(() => {
            expect(container.querySelector("#performanceReportDropdown")?.textContent).toContain("MLE Status");
        });
        fireEvent.click(container.querySelector("#performanceReportDropdown")!);
        await waitFor(() => {
            expect(performanceReportItems().some((item) => {
                return item.querySelector(".performanceReportDropdownTitle")?.textContent === "MLE Status";
            })).toBe(true);
        });

        fireEvent.click(container.querySelector("#performanceReportDropdown")!);
        expect(container.querySelector("#performanceReportDropdown .performanceReportDropdownSummary")?.textContent)
            .toBe("MLE heap usage and runtime state.");

        unmount();
    });
});
