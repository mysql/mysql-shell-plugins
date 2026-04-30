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

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ISavedGraphData } from "../../../../modules/db-editor/index.js";
import { PerformanceDashboard } from "../../../../modules/db-editor/PerformanceDashboard.js";
import {
    formatStatementHistogramUpperBound, parseStatementHistogramRows, statementHistogramPercentiles,
} from "../../../../modules/db-editor/performance/StatementHistogram.js";
import { Settings } from "../../../../supplement/Settings/Settings.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { nextRunLoop } from "../../test-helpers.js";

const graphData: ISavedGraphData = {
    timestamp: new Date().getTime(),
    activeColorScheme: "grays",
    displayInterval: 300,
    currentValues: new Map(),
    computedValues: {},
    series: new Map(),
};

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

describe("PerformanceDashboard report explainers", (): void => {
    beforeEach(() => {
        Settings.set("general.statementHistogramExplainerSeen", false);
        Settings.set("general.slowQueriesExplainerSeen", false);
        HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        Settings.set("general.statementHistogramExplainerSeen", false);
        Settings.set("general.slowQueriesExplainerSeen", false);
    });

    it("uses the observed upper bound in the final histogram label", () => {
        const rows = [{
            label: "> 5 s",
            timerLow: 5_000_000_000_000,
            countBucket: 10,
        }];

        expect(parseStatementHistogramRows([[
            5_000_000_000_000,
            5_400_000_000_000_000,
            10,
        ]]).at(-1)).toMatchObject({
            label: "5 s .. 2 h",
            observedTimerHigh: 5_400_000_000_000_000,
        });
        expect(formatStatementHistogramUpperBound(90_000_000_000_000)).toBe("2 m");
        expect(formatStatementHistogramUpperBound(5_400_000_000_000_000)).toBe("2 h");
        expect(formatStatementHistogramUpperBound(129_600_000_000_000_000)).toBe("2 d");
        expect(statementHistogramPercentiles(rows)[3].value).toBe("> 5 s");
        expect(statementHistogramPercentiles(rows, true).at(-1)).toEqual({
            label: "p99.9",
            tooltip: "The p99.9 estimate is above 5 s.",
            value: "> 5 s",
        });
    });

    it("walks through the statement histogram explanation", async () => {
        const backend = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService: vi.fn((query: string) => {
                if (query.includes("performance_schema.events_statements_histogram_global")) {
                    return Promise.resolve({
                        rows: [
                            [0, 100_000_000, 4],
                            [2_000_000_000, 5_000_000_000, 6],
                        ],
                    });
                }

                return Promise.resolve({ rows: [] });
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const onGraphDataChange = vi.fn<(data: ISavedGraphData) => void>();
        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
                onGraphDataChange={onGraphDataChange}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(container, "Statement Histogram");
        expect(container.querySelector("#statementHistogramExplainButton")).toBeNull();
        expect(container.querySelector(
            ".statementHistogramReport .statementHistogramBucketTrack[title=" +
            "'4 statements (40%) in this instance executed in 100 µs or less.']",
        )).toBeTruthy();
        expect(container.querySelector(
            ".statementHistogramPercentileInlineItem[data-tooltip=" +
            "'50% of statements in this instance executed in 2.5 ms or less.']",
        )).toBeTruthy();

        const percentiles = container.querySelector<HTMLElement>(".statementHistogramPercentiles")!;
        const graph = container.querySelector<HTMLElement>(".statementHistogramGraphHost")!;
        percentiles.scrollIntoView = vi.fn();
        graph.scrollIntoView = vi.fn();

        await waitFor(() => {
            expect(document.querySelector("#uiExplainer-statement-percentiles-title")).toBeTruthy();
        });
        expect(screen.getByText("1 of 2")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(await screen.findByText("Execution-time distribution")).toBeDefined();
        expect(screen.getByText("2 of 2")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Finish" }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(Settings.get("general.statementHistogramExplainerSeen", false)).toBe(true);

        unmount();
    });

    it("walks through the slow-query explanation", async () => {
        const backend = {
            isPerformanceSchemaAvailable: vi.fn(() => {
                return Promise.resolve(false);
            }),
            executeService: vi.fn((query: string) => {
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
                            ...Array<unknown>(27).fill(0),
                            "200 µs",
                            "240 µs",
                            "250 µs",
                            "2026-07-27 10:00:00",
                            "2026-07-27 11:00:00",
                        ]],
                    });
                }

                return Promise.resolve({ rows: [] });
            }),
        } as unknown as ShellInterfaceSqlEditor;
        const onGraphDataChange = vi.fn<(data: ISavedGraphData) => void>();
        const { container, unmount } = render(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
                onGraphDataChange={onGraphDataChange}
            />,
        );

        await nextRunLoop();
        await clickPerformanceReport(container, "Slow Queries");
        expect(container.querySelector("#slowQueriesExplainButton")).toBeNull();
        expect(container.querySelector("#slowQueryStatementHistogramGraph")).toBeTruthy();
        fireEvent.click(container.querySelector("#latency")!);
        expect(container.querySelector(
            ".slowQueryPercentileSummaryItem[data-tooltip=" +
            "\"95% of this statement's executions completed within this MySQL estimate.\"]",
        )).toBeTruthy();

        const table = container.querySelector<HTMLElement>(".slowQueriesReport .performanceTableHost")!;
        const details = container.querySelector<HTMLElement>(".slowQueryStatementHistogram")!;
        const percentiles = container.querySelector<HTMLElement>(".slowQueryDetailsTabsContent")!;
        const stats = container.querySelector<HTMLElement>(".slowQueryDigestSummary")!;
        table.scrollIntoView = vi.fn();
        details.scrollIntoView = vi.fn();
        percentiles.scrollIntoView = vi.fn();
        stats.scrollIntoView = vi.fn();

        expect(await screen.findByText("Top queries")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(Settings.get("general.slowQueriesExplainerSeen", false)).toBe(true);

        await clickPerformanceReport(container, "Table Sizes");
        await clickPerformanceReport(container, "Slow Queries");
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull();
        });

        unmount();

        const savedGraphData = onGraphDataChange.mock.calls.at(-1)![0];
        const restored = render(
            <PerformanceDashboard
                backend={backend}
                graphData={savedGraphData}
            />,
        );

        await nextRunLoop();
        expect(restored.container.querySelector("#performanceReportDropdown")?.textContent).toContain("Slow Queries");
        expect(screen.queryByRole("dialog")).toBeNull();

        restored.unmount();
    });
});
