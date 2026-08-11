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

import { ComponentChild, createRef } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../../components/ui/Component/ComponentBase.js";
import { Button } from "../../../components/ui/Button/Button.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { TabPosition, Tabview } from "../../../components/ui/Tabview/Tabview.js";
import { ITreeGridOptions, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import { IUIExplainerStep, UIExplainer } from "../../../components/ui/UIExplainer/UIExplainer.js";
import { ScriptingLanguageServices } from "../../../script-execution/ScriptingLanguageServices.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { ProfileState } from "../../../supplement/ProfileState.js";
import {
    IPerformanceReportCapabilities, ShellInterfaceSqlEditor,
} from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uuid } from "../../../utilities/helpers.js";
import {
    IStatementHistogramRow, parseStatementHistogramRows, StatementHistogram,
} from "./StatementHistogram.js";

export type StatementDetailGroupId = "activity" | "latency" | "resources" | "results" | "access";
type SlowQueryOrderCriteria = "executions" | "totalLatency" | "averageLatency" | "maximumLatency";
type SlowQueryLimit = 10 | 20 | 50 | 100 | 200 | 500;
type SlowQueryTimeRange = "15m" | "30m" | "1h" | "2h" | "3h" | "4h" | "8h" | "12h" |
    "24h" | "48h" | "week" | "month" | "none";

interface ISlowQueriesReportProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    capabilities?: IPerformanceReportCapabilities;
    initialDetailGroupId: StatementDetailGroupId;
    onDetailGroupIdChange: (groupId: StatementDetailGroupId) => void;
}

interface ISlowQueriesReportState extends IComponentState {
    loading: boolean;
    error?: string;
    rows: ISlowQueryRow[];
    selectedId?: string;
    detailsLoading: boolean;
    detailsError?: string;
    summary: IStatementSummaryEntry[];
    histogramRows: IStatementHistogramRow[];
    percentiles: IStatementPercentileEntry[];
    detailGroupId: StatementDetailGroupId;
    orderCriteria: SlowQueryOrderCriteria;
    queryLimit: SlowQueryLimit;
    timeRange: SlowQueryTimeRange;
}

interface ISlowQueryRow {
    id: string;
    schema: string;
    digest: string;
    query: string;
    executions: string;
    totalLatency: string;
    averageLatency: string;
    maximumLatency: string;
    rowsSent: string;
    rowsExamined: string;
    temporaryTables: string;
    fullScan: string;
}

interface IStatementSummaryEntry {
    label: string;
    value: string;
}

interface IStatementPercentileEntry extends IStatementSummaryEntry {
    tooltip: string;
}

const accessLabels = new Set([
    "Full Joins", "Full Range Joins", "Range Selects", "Range Checks", "Select Scans",
    "No Index Used", "No Good Index Used",
]);
const temporaryLabels = new Set([
    "Disk Temp Tables", "Temp Tables", "Sort Merge Passes", "Sort Range", "Sort Rows", "Sort Scan",
]);
const detailGroups: Array<{
    id: StatementDetailGroupId;
    caption: string;
    labels: Set<string>;
}> = [{
    id: "activity",
    caption: "Activity",
    labels: new Set(["Executions", "First Seen", "Last Seen"]),
}, {
    id: "latency",
    caption: "Latency",
    labels: new Set(["Total Latency", "Min Latency", "Avg Latency", "Max Latency"]),
}, {
    id: "resources",
    caption: "Resources",
    labels: new Set(["Lock Time", "CPU Time", "Max Controlled Memory", "Max Total Memory"]),
}, {
    id: "results",
    caption: "Results",
    labels: new Set(["Errors", "Warnings", "Rows Affected", "Rows Sent", "Rows Examined"]),
}, {
    id: "access",
    caption: "Access & Sort",
    labels: new Set([...accessLabels, ...temporaryLabels]),
}];

const slowQueryOrderCriteria: Array<{
    id: SlowQueryOrderCriteria;
    caption: string;
    column: string;
}> = [{
    id: "executions",
    caption: "By Executions",
    column: "exec_count",
}, {
    id: "totalLatency",
    caption: "By Total Latency",
    column: "total_latency",
}, {
    id: "averageLatency",
    caption: "By Average Latency",
    column: "avg_latency",
}, {
    id: "maximumLatency",
    caption: "By Maximum Latency",
    column: "max_latency",
}];

const slowQueryLimits: SlowQueryLimit[] = [10, 20, 50, 100, 200, 500];
const slowQueryTimeRanges: Array<{
    id: SlowQueryTimeRange;
    caption: string;
    interval?: string;
}> = [{
    id: "15m",
    caption: "Seen in the last 15min",
    interval: "15 MINUTE",
}, {
    id: "30m",
    caption: "Seen in the last 30min",
    interval: "30 MINUTE",
}, {
    id: "1h",
    caption: "Seen in the last 1h",
    interval: "1 HOUR",
}, {
    id: "2h",
    caption: "Seen in the last 2h",
    interval: "2 HOUR",
}, {
    id: "3h",
    caption: "Seen in the last 3h",
    interval: "3 HOUR",
}, {
    id: "4h",
    caption: "Seen in the last 4h",
    interval: "4 HOUR",
}, {
    id: "8h",
    caption: "Seen in the last 8h",
    interval: "8 HOUR",
}, {
    id: "12h",
    caption: "Seen in the last 12h",
    interval: "12 HOUR",
}, {
    id: "24h",
    caption: "Seen in the last 24h",
    interval: "24 HOUR",
}, {
    id: "48h",
    caption: "Seen in the last 48h",
    interval: "48 HOUR",
}, {
    id: "week",
    caption: "Seen in the last week",
    interval: "1 WEEK",
}, {
    id: "month",
    caption: "Seen in the last month",
    interval: "1 MONTH",
}, {
    id: "none",
    caption: "No limit",
}];

const tableOptions: ITreeGridOptions = {
    layout: "fitColumns",
    verticalGridLines: false,
    horizontalGridLines: true,
    alternatingRowBackgrounds: true,
    selectionType: SelectionType.Single,
    resizableRows: false,
    selectOnMouseDown: true,
    rowHeight: 20,
    index: "id",
    updateDataOnComponentUpdate: false,
};

export class SlowQueriesReport extends ComponentBase<ISlowQueriesReportProperties, ISlowQueriesReportState> {

    private readonly explainerRef = createRef<UIExplainer>();
    private readonly tableRef = createRef<HTMLDivElement>();
    private readonly detailsRef = createRef<HTMLDivElement>();
    private readonly percentilesRef = createRef<HTMLDivElement>();
    private readonly statsRef = createRef<HTMLDivElement>();
    private readonly explainerSteps: IUIExplainerStep[] = [{
        id: "slow-query-table",
        target: this.tableRef,
        title: "Top queries",
        content: "Rows group executions of the same normalized statement and are ordered by average latency.",
        placement: ComponentPlacement.BottomLeft,
    }, {
        id: "slow-query-details",
        target: this.detailsRef,
        title: "Selected query details",
        content: "Selecting a row loads its latency percentiles, execution statistics, and performance signals here.",
        placement: ComponentPlacement.TopLeft,
    }, {
        id: "slow-query-percentiles",
        target: this.percentilesRef,
        title: "Latency percentiles",
        content: "The Latency tab includes estimates of the time within which 95%, 99%, and 99.9% of this " +
            "statement's executions completed.",
        placement: ComponentPlacement.BottomRight,
    }, {
        id: "slow-query-stats",
        target: this.statsRef,
        title: "Statement metrics",
        content: "These tabs organize the selected digest's activity, latency, resources, results, access paths, " +
            "and temporary work.",
        placement: ComponentPlacement.TopRight,
    }];
    private listRequestId = 0;
    private tableDataVersion = 0;
    private detailsRequestId = 0;
    private explainerSeen = ProfileState.get("general.slowQueriesExplainerSeen", false);

    public constructor(props: ISlowQueriesReportProperties) {
        super(props);

        this.state = {
            loading: false,
            rows: [],
            detailsLoading: false,
            summary: [],
            histogramRows: [],
            percentiles: [],
            detailGroupId: props.initialDetailGroupId,
            orderCriteria: "averageLatency",
            queryLimit: 20,
            timeRange: "none",
        };
        this.addHandledProperties("backend", "capabilities", "initialDetailGroupId", "onDetailGroupIdChange");
    }

    public override componentDidMount(): void {
        void this.updateValues();
    }

    public override componentDidUpdate(previousProps: ISlowQueriesReportProperties): void {
        if (previousProps.backend !== this.props.backend || previousProps.capabilities !== this.props.capabilities) {
            void this.updateValues();
        }
    }

    public override componentWillUnmount(): void {
        ++this.listRequestId;
        ++this.detailsRequestId;
    }

    public render(): ComponentChild {
        const {
            detailGroupId, detailsError, detailsLoading, error, histogramRows, loading, percentiles, rows,
            selectedId, summary,
        } = this.state;
        const selected = rows.find((row) => {
            return row.id === selectedId;
        });
        const detailPages = detailGroups.map((group) => {
            const entries: Array<IStatementSummaryEntry | IStatementPercentileEntry> = summary.filter((entry) => {
                return group.labels.has(entry.label);
            });
            if (group.id === "latency") {
                entries.push(...percentiles);
            }

            return {
                id: group.id,
                caption: group.caption,
                content: group.id === "access"
                    ? <div className="slowQueryDigestSummaryColumns">
                        {[{
                            caption: "Access",
                            labels: accessLabels,
                        }, {
                            caption: "Temp & Sort",
                            labels: temporaryLabels,
                        }].map((column) => {
                            return <div className="slowQueryDigestSummaryColumn" key={column.caption}>
                                <div className="slowQueryDigestSummaryColumnTitle">{column.caption}</div>
                                <div className="slowQueryDigestSummary">
                                    {this.renderEntries(entries.filter((entry) => {
                                        return column.labels.has(entry.label);
                                    }))}
                                </div>
                            </div>;
                        })}
                    </div>
                    : <div className="slowQueryDigestSummary">{this.renderEntries(entries)}</div>,
            };
        });

        return <Container
            className="performanceDashboardReport slowQueriesReport"
            orientation={Orientation.TopDown}
        >
            {error && <div className="slowQueriesReportError">{error}</div>}
            {!error && loading && rows.length === 0 &&
                <div className="slowQueriesReportEmpty">Loading...</div>}
            {!error && !loading && rows.length === 0 &&
                <div className="slowQueriesReportEmpty">No statement analysis rows found.</div>}
            {!error && rows.length > 0 &&
                <>
                    <Container
                        className="performanceStatusReportHeader slowQueriesReportHeader"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.SpaceBetween}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <div className="slowQueriesReportHeaderControls">
                            <Dropdown
                                id="slowQueriesLimitDropdown"
                                selection={String(this.state.queryLimit)}
                                onSelect={this.handleLimitSelection}
                            >
                                {slowQueryLimits.map((limit) => {
                                    return <DropdownItem
                                        key={limit}
                                        caption={`Top ${limit} Queries`}
                                        id={String(limit)}
                                    />;
                                })}
                            </Dropdown>
                            <Dropdown
                                id="slowQueriesOrderDropdown"
                                selection={this.state.orderCriteria}
                                onSelect={this.handleOrderSelection}
                            >
                                {slowQueryOrderCriteria.map((criteria) => {
                                    return <DropdownItem
                                        key={criteria.id}
                                        caption={criteria.caption}
                                        id={criteria.id}
                                    />;
                                })}
                            </Dropdown>
                        </div>
                        <Dropdown
                            id="slowQueriesTimeRangeDropdown"
                            selection={this.state.timeRange}
                            onSelect={this.handleTimeRangeSelection}
                        >
                            {slowQueryTimeRanges.map((range) => {
                                return <DropdownItem
                                    key={range.id}
                                    caption={range.caption}
                                    id={range.id}
                                />;
                            })}
                        </Dropdown>
                    </Container>
                    <div ref={this.tableRef} className="performanceTableHost slowQueriesTableHost">
                        <TreeGrid
                            key={this.tableDataVersion}
                            id="slowQueriesPerformanceGrid"
                            className="performanceTableGrid"
                            options={tableOptions}
                            columns={this.tableColumns()}
                            tableData={rows}
                            selectedRows={selectedId === undefined ? undefined : [selectedId]}
                            onRowSelected={this.handleRowSelected}
                        />
                    </div>
                    <div ref={this.detailsRef} className="slowQueryStatementHistogram">
                        <div className="slowQueryStatementHistogramHeader">
                            <h3>Selected Statement Details</h3>
                        </div>
                        {detailsError && <div className="slowQueriesReportError">{detailsError}</div>}
                        {!detailsError && detailsLoading && summary.length === 0 &&
                            <div className="slowQueriesReportEmpty">Loading details...</div>}
                        {!detailsError && !detailsLoading && summary.length === 0 &&
                            <div className="slowQueriesReportEmpty">No details found for the selected statement.</div>}
                        {!detailsError && summary.length > 0 &&
                            <div className="slowQueryStatementHistogramDetails">
                                <div className="slowQueryStatementPrimary">
                                    <div className="slowQueryStatementHistogramQuery">
                                        <div className="slowQueryStatementHistogramQueryText">{selected?.query}</div>
                                        <Button
                                            className="slowQuerySqlOpenButton"
                                            data-tooltip="Open in SQL Editor"
                                            imageOnly
                                            disabled={!selected?.query}
                                            onClick={this.handleOpenInEditor(selected?.query)}
                                        >
                                            <Icon src={Codicon.NewFile} data-tooltip="inherit" />
                                        </Button>
                                    </div>
                                    {histogramRows.length > 0 &&
                                        <div className="statementHistogramGraphHost">
                                            <StatementHistogram
                                                id="slowQueryStatementHistogramGraph"
                                                rows={histogramRows}
                                            />
                                        </div>}
                                </div>
                                <div ref={this.statsRef} className="slowQueryDetailsTabs">
                                    <div ref={this.percentilesRef} className="slowQueryDetailsTabsContent">
                                        <Tabview
                                            id="slowQueryDetailsTabview"
                                            tabPosition={TabPosition.Top}
                                            tabBorderWidth={1}
                                            contentSeparatorWidth={2}
                                            pages={detailPages}
                                            selectedId={detailGroupId}
                                            stretchTabs
                                            onSelectTab={this.handleDetailGroupSelection}
                                        />
                                    </div>
                                </div>
                            </div>}
                    </div>
                    {percentiles.length > 0 && summary.length > 0 &&
                        <UIExplainer
                            ref={this.explainerRef}
                            onClose={this.handleExplainerClose}
                            steps={this.explainerSteps}
                        />}
                </>}
        </Container>;
    }

    public refresh(): void {
        void this.updateValues();
    }

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        if (this.props.capabilities && (!this.props.capabilities.performanceSchema ||
            !this.props.capabilities.slowQueries)) {
            ++this.listRequestId;
            ++this.detailsRequestId;
            this.setState({
                loading: false,
                error: "Slow Queries requires the sys schema and statement Performance Schema tables.",
                selectedId: undefined,
                detailsLoading: false,
                detailsError: undefined,
                rows: [],
                summary: [],
                histogramRows: [],
                percentiles: [],
            });

            return;
        }

        const requestId = ++this.listRequestId;
        ++this.detailsRequestId;
        this.setState({
            loading: true,
            error: undefined,
            detailsError: undefined,
            summary: [],
            histogramRows: [],
            percentiles: [],
        });
        try {
            const timeRange = slowQueryTimeRanges.find((range) => {
                return range.id === this.state.timeRange;
            });
            const timeRangeFilter = timeRange?.interval
                ? ` where last_seen >= now() - interval ${timeRange.interval}`
                : "";
            const result = await backend.executeService("select db, digest, query, exec_count, " +
                "sys.format_time(total_latency), sys.format_time(avg_latency), sys.format_time(max_latency), " +
                "rows_sent, rows_examined, tmp_tables, full_scan from sys.x$statement_analysis" +
                timeRangeFilter + " " +
                `order by ${this.orderColumn()} desc limit ${this.state.queryLimit}`);
            const rows = this.parseRows(result?.rows);
            if (requestId !== this.listRequestId) {
                return;
            }

            ++this.tableDataVersion;
            this.setState({
                loading: false,
                selectedId: rows[0]?.id,
                rows,
            });
            if (rows.length > 0) {
                void this.updateDetails(rows[0]);
            }
        } catch (reason) {
            if (requestId !== this.listRequestId) {
                return;
            }

            this.setState({
                loading: false,
                error: String(reason),
                selectedId: undefined,
                summary: [],
                histogramRows: [],
                percentiles: [],
                rows: [],
            });
        }
    }

    private async updateDetails(row: ISlowQueryRow): Promise<void> {
        const { backend } = this.props;
        const requestId = ++this.detailsRequestId;
        if (!backend || row.digest === "-") {
            this.setState({
                detailsLoading: false,
                detailsError: undefined,
                summary: [],
                histogramRows: [],
                percentiles: [],
            });

            return;
        }

        this.setState({ detailsLoading: true, detailsError: undefined });
        try {
            const rowFilter = "where schema_name <=> ? and digest = ?";
            const params = [row.schema === "-" ? null : row.schema, row.digest];
            const [histogramResult, summaryResult] = await Promise.all([
                backend.executeService("select bucket_timer_low, bucket_timer_high, count_bucket " +
                    "from performance_schema.events_statements_histogram_by_digest " +
                    `${rowFilter} order by bucket_timer_low`, params),
                backend.executeService("select count_star, sys.format_time(sum_timer_wait), " +
                    "sys.format_time(min_timer_wait), sys.format_time(avg_timer_wait), " +
                    "sys.format_time(max_timer_wait), sys.format_time(sum_lock_time), sum_errors, sum_warnings, " +
                    "sum_rows_affected, sum_rows_sent, sum_rows_examined, sum_created_tmp_disk_tables, " +
                    "sum_created_tmp_tables, sum_select_full_join, sum_select_full_range_join, sum_select_range, " +
                    "sum_select_range_check, sum_select_scan, sum_sort_merge_passes, sum_sort_range, sum_sort_rows, " +
                    "sum_sort_scan, sum_no_index_used, sum_no_good_index_used, sys.format_time(sum_cpu_time), " +
                    "sys.format_bytes(max_controlled_memory), sys.format_bytes(max_total_memory), " +
                    "sys.format_time(quantile_95), sys.format_time(quantile_99), sys.format_time(quantile_999), " +
                    `first_seen, last_seen from performance_schema.events_statements_summary_by_digest ${rowFilter}`,
                params),
            ]);
            if (requestId !== this.detailsRequestId) {
                return;
            }

            this.setState({
                detailsLoading: false,
                summary: this.parseSummary(summaryResult?.rows),
                histogramRows: parseStatementHistogramRows(histogramResult?.rows),
                percentiles: this.parsePercentiles(summaryResult?.rows),
            }, this.startExplainer);
        } catch (reason) {
            if (requestId !== this.detailsRequestId) {
                return;
            }

            this.setState({
                detailsLoading: false,
                detailsError: String(reason),
                summary: [],
                histogramRows: [],
                percentiles: [],
            });
        }
    }

    private parseRows(rows?: unknown[]): ISlowQueryRow[] {
        return (rows ?? []).map((row, index) => {
            const values = row as unknown[];

            return {
                id: `${cell(values[0])}.${index}.${cell(values[2])}`,
                schema: cell(values[0]),
                digest: cell(values[1]),
                query: cell(values[2]),
                executions: cell(values[3]),
                totalLatency: cell(values[4]),
                averageLatency: cell(values[5]),
                maximumLatency: cell(values[6]),
                rowsSent: cell(values[7]),
                rowsExamined: cell(values[8]),
                temporaryTables: cell(values[9]),
                fullScan: cell(values[10]),
            };
        });
    }

    private parseSummary(rows?: unknown[]): IStatementSummaryEntry[] {
        const values = (rows?.[0] ?? []) as unknown[];
        if (values.length === 0) {
            return [];
        }

        const labels = [
            "Executions", "Total Latency", "Min Latency", "Avg Latency", "Max Latency", "Lock Time", "Errors",
            "Warnings", "Rows Affected", "Rows Sent", "Rows Examined", "Disk Temp Tables", "Temp Tables",
            "Full Joins", "Full Range Joins", "Range Selects", "Range Checks", "Select Scans", "Sort Merge Passes",
            "Sort Range", "Sort Rows", "Sort Scan", "No Index Used", "No Good Index Used", "CPU Time",
            "Max Controlled Memory", "Max Total Memory",
        ];
        const result = labels.map((label, index) => {
            return { label, value: cell(values[index]) };
        });
        result.splice(1, 0,
            { label: "First Seen", value: cell(values[30]) },
            { label: "Last Seen", value: cell(values[31]) });

        return result;
    }

    private parsePercentiles(rows?: unknown[]): IStatementPercentileEntry[] {
        const values = (rows?.[0] ?? []) as unknown[];
        if (values.length === 0) {
            return [];
        }

        return [{
            label: "p95",
            tooltip: "95% of this statement's executions completed within this MySQL estimate.",
            value: cell(values[27]),
        }, {
            label: "p99",
            tooltip: "99% of this statement's executions completed within this MySQL estimate.",
            value: cell(values[28]),
        }, {
            label: "p99.9",
            tooltip: "99.9% of this statement's executions completed within this MySQL estimate.",
            value: cell(values[29]),
        }];
    }

    private renderEntries(entries: Array<IStatementSummaryEntry | IStatementPercentileEntry>): ComponentChild[] {
        return entries.map((entry) => {
            const percentile = "tooltip" in entry;

            return <div
                className={`slowQueryDigestSummaryItem${percentile ? " slowQueryPercentileSummaryItem" : ""}`}
                data-tooltip={percentile ? entry.tooltip : undefined}
                key={entry.label}
            >
                <span data-tooltip={percentile ? "inherit" : undefined}>{entry.label}</span>
                <strong data-tooltip={percentile ? "inherit" : undefined}>{entry.value}</strong>
            </div>;
        });
    }

    private orderColumn(): string {
        return slowQueryOrderCriteria.find((criteria) => {
            return criteria.id === this.state.orderCriteria;
        })?.column ?? "avg_latency";
    }

    private tableColumns(): ColumnDefinition[] {
        return [
            { title: "Statement", field: "query", minWidth: 220, resizable: true },
            { title: "Schema", field: "schema", minWidth: 110, resizable: true },
            { title: "Executions", field: "executions", minWidth: 100, hozAlign: "right", resizable: true },
            { title: "Total Latency", field: "totalLatency", minWidth: 120, hozAlign: "right", resizable: true },
            { title: "Avg Latency", field: "averageLatency", minWidth: 110, hozAlign: "right", resizable: true },
            { title: "Max Latency", field: "maximumLatency", minWidth: 110, hozAlign: "right", resizable: true },
            { title: "Rows Sent", field: "rowsSent", minWidth: 100, hozAlign: "right", resizable: true },
            { title: "Rows Examined", field: "rowsExamined", minWidth: 120, hozAlign: "right", resizable: true },
            { title: "Temp Tables", field: "temporaryTables", minWidth: 110, hozAlign: "right", resizable: true },
            {
                title: "Full Scan",
                field: "fullScan",
                minWidth: 90,
                formatter: fullScanFormatter,
                resizable: true,
            },
        ];
    }

    private handleRowSelected = (row: RowComponent): void => {
        const selected = row.getData() as ISlowQueryRow;
        if (selected.id !== this.state.selectedId) {
            this.setState({ selectedId: selected.id });
            void this.updateDetails(selected);
        }
    };

    private handleDetailGroupSelection = (id: string): void => {
        const detailGroupId = id as StatementDetailGroupId;
        this.setState({ detailGroupId });
        this.props.onDetailGroupIdChange(detailGroupId);
    };

    private handleOrderSelection = (accept: boolean, selectedIds: Set<string>): void => {
        if (!accept) {
            return;
        }

        const orderCriteria = [...selectedIds][0] as SlowQueryOrderCriteria;
        if (!slowQueryOrderCriteria.some((criteria) => {
            return criteria.id === orderCriteria;
        }) ||
            orderCriteria === this.state.orderCriteria) {
            return;
        }

        ++this.listRequestId;
        this.setState({ orderCriteria, rows: [] }, () => {
            void this.updateValues();
        });
    };

    private handleLimitSelection = (accept: boolean, selectedIds: Set<string>): void => {
        if (!accept) {
            return;
        }

        const queryLimit = Number([...selectedIds][0]) as SlowQueryLimit;
        if (!slowQueryLimits.includes(queryLimit) || queryLimit === this.state.queryLimit) {
            return;
        }

        ++this.listRequestId;
        this.setState({ queryLimit, rows: [] }, () => {
            void this.updateValues();
        });
    };

    private handleTimeRangeSelection = (accept: boolean, selectedIds: Set<string>): void => {
        if (!accept) {
            return;
        }

        const timeRange = [...selectedIds][0] as SlowQueryTimeRange;
        if (!slowQueryTimeRanges.some((range) => {
            return range.id === timeRange;
        }) || timeRange === this.state.timeRange) {
            return;
        }

        ++this.listRequestId;
        this.setState({ timeRange, rows: [] }, () => {
            void this.updateValues();
        });
    };

    private handleOpenInEditor = (content?: string) => {
        return (): void => {
            if (content) {
                void this.openInEditor(content);
            }
        };
    };

    private async openInEditor(content: string): Promise<void> {
        let editorContent = content;
        try {
            editorContent = await ScriptingLanguageServices.instance.reformatSQL(content);
        } catch {
            editorContent = content;
        }

        await requisitions.execute("editorEditScript", {
            id: uuid(),
            caption: "Selected Slow Query",
            content: editorContent,
            language: "mysql",
        });
    }

    private startExplainer = (): void => {
        const { detailsError, detailsLoading, percentiles, rows, summary } = this.state;
        if (!detailsError && !detailsLoading && rows.length > 0 && percentiles.length > 0 &&
            summary.length > 0 && !this.explainerSeen && !this.explainerRef.current?.isOpen) {
            this.explainerRef.current?.start();
        }
    };

    private handleExplainerClose = (): void => {
        this.explainerSeen = true;
        ProfileState.set("general.slowQueriesExplainerSeen", true);
        ProfileState.saveState();
    };

}

const cell = (value: unknown): string => {
    return value === null || value === undefined || value === "" ? "-" : String(value);
};

export const fullScanFormatter = (cellComponent: CellComponent): HTMLElement => {
    const value = String(cellComponent.getValue() ?? "-");
    const badge = document.createElement("span");
    if (value !== "-" && value !== "0" && value !== "") {
        badge.className = "performanceFullScanBadge";
        badge.textContent = "FULL SCAN";
    }

    return badge;
};
