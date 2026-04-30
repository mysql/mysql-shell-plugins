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

import { ComponentChild } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";

import {
    ComponentBase, IComponentProperties, IComponentState, SelectionType,
} from "../../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../../components/ui/Container/Container.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { ITreeGridOptions, TreeGrid } from "../../../components/ui/TreeGrid/TreeGrid.js";
import {
    IPerformanceReportCapabilities, ShellInterfaceSqlEditor,
} from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";

export type WaitViewId = "classes" | "events" | "host" | "user";

interface IWaitsReportProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    capabilities?: IPerformanceReportCapabilities;
    initialViewId: WaitViewId;
    onViewIdChange: (viewId: WaitViewId) => void;
}

interface IWaitsReportState extends IComponentState {
    viewId: WaitViewId;
    loading: boolean;
    error?: string;
    classRows: IWaitRow[];
    rows: IWaitRow[];
}

interface IWaitRow {
    id: string;
    label: string;
    occurrences: string;
    totalLatencyRaw: string;
    totalLatency: string;
    averageLatencyRaw: string;
    averageLatency: string;
    minimumLatencyRaw: string;
    minimumLatency: string;
    maximumLatencyRaw: string;
    maximumLatency: string;
    children?: IWaitRow[];
    childrenLoaded?: boolean;
    childrenLoading?: boolean;
    expanded?: boolean;
    message?: boolean;
}

const reports: Array<{
    id: WaitViewId;
    title: string;
    table: string;
    labelColumn: string;
    eventColumn?: string;
}> = [{
    id: "classes",
    title: "Wait Classes",
    table: "sys.x$wait_classes_global_by_latency",
    labelColumn: "event_class",
}, {
    id: "events",
    title: "All Events",
    table: "sys.x$waits_global_by_latency",
    labelColumn: "events",
}, {
    id: "host",
    title: "By Host",
    table: "sys.x$waits_by_host_by_latency",
    labelColumn: "host",
    eventColumn: "event",
}, {
    id: "user",
    title: "By User",
    table: "sys.x$waits_by_user_by_latency",
    labelColumn: "user",
    eventColumn: "event",
}];

export class WaitsReport extends ComponentBase<IWaitsReportProperties, IWaitsReportState> {

    private requestId = 0;

    public constructor(props: IWaitsReportProperties) {
        super(props);

        this.state = {
            viewId: props.initialViewId,
            loading: false,
            classRows: [],
            rows: [],
        };
        this.addHandledProperties("backend", "capabilities", "initialViewId", "onViewIdChange");
    }

    public override componentDidMount(): void {
        void this.updateValues();
    }

    public override componentDidUpdate(previousProps: IWaitsReportProperties): void {
        if (previousProps.backend !== this.props.backend || previousProps.capabilities !== this.props.capabilities) {
            void this.updateValues();
        }
    }

    public override componentWillUnmount(): void {
        ++this.requestId;
    }

    public render(): ComponentChild {
        const { classRows, error, loading, rows, viewId } = this.state;
        const totalLatency = classRows.reduce((sum, row) => {
            return sum + Number(row.totalLatencyRaw);
        }, 0);

        return <Container
            className="performanceDashboardReport waitReport"
            orientation={Orientation.TopDown}
        >
            <Container
                className="performanceStatusReportHeader"
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.SpaceBetween}
                crossAlignment={ContentAlignment.Center}
            >
                {!error && <div className="waitSummaryHost">
                    <div className="waitSummaryCaption" data-tooltip="Since Performance Schema reset">
                        Share of total wait latency by class*
                    </div>
                    <div className="waitSummary">
                        {classRows.map((row) => {
                            const percentage = totalLatency > 0
                                ? (Number(row.totalLatencyRaw) / totalLatency) * 100
                                : 0;

                            return <div className="waitSummaryItem" key={row.id}>
                                <span data-tooltip={row.label}>{row.label}</span>
                                <div className="waitSummaryValues">
                                    <strong>{formatPercentage(percentage)}</strong>
                                    <div className="waitSummaryLatencies">
                                        <small>Avg {row.averageLatency}</small>
                                        <small>Min {row.minimumLatency}</small>
                                        <small>Max {row.maximumLatency}</small>
                                    </div>
                                </div>
                            </div>;
                        })}
                    </div>
                </div>}
                <Container
                    className="waitHeaderActions"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Dropdown
                        id="waitReportDropdown"
                        selection={viewId}
                        onSelect={this.handleViewSelection}
                    >
                        {reports.map((report) => {
                            return <DropdownItem key={report.id} caption={report.title} id={report.id} />;
                        })}
                    </Dropdown>
                </Container>
            </Container>
            {error && <div className="waitReportError">{error}</div>}
            {!error && loading && rows.length === 0 &&
                <div className="waitReportEmpty">Loading...</div>}
            {!error && !loading && rows.length === 0 &&
                <div className="waitReportEmpty">
                    No timed wait data found. Relevant Performance Schema instrumentation may be disabled.
                </div>}
            {!error && rows.length > 0 &&
                <div className="performanceTableHost">
                    <TreeGrid
                        id="waitPerformanceGrid"
                        className="performanceTableGrid"
                        options={this.tableOptions()}
                        columns={this.tableColumns()}
                        tableData={rows}
                        onRowExpanded={this.handleRowExpanded}
                        onRowCollapsed={this.handleRowCollapsed}
                        isRowExpanded={this.isRowExpanded}
                    />
                </div>}
        </Container>;
    }

    public refresh(): void {
        void this.updateValues();
    }

    private selectedReport(): typeof reports[number] {
        return reports.find((report) => {
            return report.id === this.state.viewId;
        }) ?? reports[0];
    }

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        if (this.props.capabilities && (!this.props.capabilities.performanceSchema || !this.props.capabilities.waits)) {
            ++this.requestId;
            this.setState({
                loading: false,
                error: "Waits report requires the sys schema and Performance Schema wait views.",
                classRows: [],
                rows: [],
            });

            return;
        }

        const requestId = ++this.requestId;
        const viewId = this.state.viewId;
        const report = this.selectedReport();
        const grouped = report.eventColumn !== undefined;
        const averageExpression = "ifnull(sum(total_latency) / nullif(sum(total), 0), 0)";
        const rowQuery = grouped
            ? `select ${report.labelColumn}, sum(total), sum(total_latency), ` +
                `sys.format_time(sum(total_latency)), ${averageExpression}, ` +
                `sys.format_time(${averageExpression}), null, null, max(max_latency), ` +
                `sys.format_time(max(max_latency)) from ${report.table} group by ${report.labelColumn} ` +
                "order by sum(total_latency) desc limit 20"
            : `select ${report.labelColumn}, total, total_latency, sys.format_time(total_latency), ` +
                "avg_latency, sys.format_time(avg_latency), " +
                (viewId === "classes"
                    ? "min_latency, sys.format_time(min_latency), "
                    : "null, null, ") +
                `max_latency, sys.format_time(max_latency) from ${report.table} ` +
                "order by total_latency desc limit 100";
        const classQuery = "select event_class, total, total_latency, sys.format_time(total_latency), " +
            "avg_latency, sys.format_time(avg_latency), min_latency, sys.format_time(min_latency), " +
            "max_latency, sys.format_time(max_latency) from sys.x$wait_classes_global_by_latency " +
            "order by total_latency desc limit 100";
        this.setState({ loading: true, error: undefined });

        try {
            const classResultPromise = backend.executeService(classQuery);
            const rowResultPromise = viewId === "classes"
                ? classResultPromise
                : backend.executeService(rowQuery);
            const [classResult, rowResult] = await Promise.all([classResultPromise, rowResultPromise]);
            if (requestId !== this.requestId || this.state.viewId !== viewId) {
                return;
            }

            this.setState({
                loading: false,
                classRows: this.parseRows(classResult?.rows),
                rows: this.parseRows(rowResult?.rows, grouped),
            });
        } catch (reason) {
            if (requestId !== this.requestId || this.state.viewId !== viewId) {
                return;
            }

            this.setState({
                loading: false,
                error: String(reason),
                classRows: [],
                rows: [],
            });
        }
    }

    private async loadChildren(parent: IWaitRow, viewId: WaitViewId): Promise<IWaitRow[]> {
        const { backend } = this.props;
        const report = reports.find((candidate) => {
            return candidate.id === viewId;
        });
        if (!backend || !report?.eventColumn) {
            return [];
        }

        const query = `select ${report.eventColumn}, total, total_latency, sys.format_time(total_latency), ` +
            "avg_latency, sys.format_time(avg_latency), null, null, max_latency, " +
            `sys.format_time(max_latency) from ${report.table} where ${report.labelColumn} <=> ` +
            "? order by total_latency desc limit 50";
        const result = await backend.executeService(query, [parent.label === "-" ? null : parent.label]);

        return this.parseRows(result?.rows, false, parent.id);
    }

    private parseRows(rows?: unknown[], grouped = false, parentId?: string): IWaitRow[] {
        return (rows ?? []).map((row, index) => {
            const values = row as unknown[];
            const label = cell(values[0]);
            const id = `${parentId ? `${parentId}.` : ""}${label}.${index}`;
            const result: IWaitRow = {
                id,
                label,
                occurrences: cell(values[1]),
                totalLatencyRaw: cell(values[2]),
                totalLatency: cell(values[3]),
                averageLatencyRaw: cell(values[4]),
                averageLatency: cell(values[5]),
                minimumLatencyRaw: cell(values[6]),
                minimumLatency: cell(values[7]),
                maximumLatencyRaw: cell(values[8]),
                maximumLatency: cell(values[9]),
            };
            if (grouped) {
                result.children = [messageRow(id, "Expand to load wait events")];
            }

            return result;
        });
    }

    private tableOptions(): ITreeGridOptions {
        const result: ITreeGridOptions = {
            layout: "fitColumns",
            verticalGridLines: false,
            horizontalGridLines: true,
            alternatingRowBackgrounds: true,
            selectionType: SelectionType.Single,
            resizableRows: false,
            selectOnMouseDown: true,
            rowHeight: 28,
            index: "id",
        };
        if (this.state.viewId === "host" || this.state.viewId === "user") {
            result.treeColumn = "label";
            result.childKey = "children";
            result.expandedLevels = [false];
        }

        return result;
    }

    private tableColumns(): ColumnDefinition[] {
        const { viewId } = this.state;
        const labelTitle = viewId === "classes"
            ? "Event Class"
            : viewId === "events" ? "Event" : viewId === "host" ? "Host / Event" : "User / Event";
        const columns: ColumnDefinition[] = [{
            title: labelTitle,
            field: "label",
            minWidth: 240,
            resizable: true,
            formatter: this.labelFormatter,
        }, {
            title: "Occurrences",
            field: "occurrences",
            minWidth: 110,
            hozAlign: "right",
            resizable: true,
            sorter: "number",
        }, this.latencyColumn("Total Latency", "totalLatencyRaw", "totalLatency"),
        this.latencyColumn("Average Latency", "averageLatencyRaw", "averageLatency")];
        if (viewId === "classes") {
            columns.push(this.latencyColumn("Minimum Latency", "minimumLatencyRaw", "minimumLatency"));
        }
        columns.push(this.latencyColumn("Maximum Latency", "maximumLatencyRaw", "maximumLatency"));

        return columns;
    }

    private latencyColumn(title: string,
        rawField: "totalLatencyRaw" | "averageLatencyRaw" | "minimumLatencyRaw" | "maximumLatencyRaw",
        displayField: "totalLatency" | "averageLatency" | "minimumLatency" | "maximumLatency"): ColumnDefinition {
        return {
            title,
            field: rawField,
            minWidth: 125,
            hozAlign: "right",
            resizable: true,
            sorter: "number",
            formatter: (cellComponent: CellComponent): string => {
                const data = cellComponent.getRow().getData() as IWaitRow;

                return data[displayField];
            },
        };
    }

    private labelFormatter = (cellComponent: CellComponent): HTMLElement => {
        const data = cellComponent.getRow().getData() as IWaitRow;
        const element = document.createElement("span");

        element.className = data.message ? "waitRowMessage" : "waitNameCell";
        element.textContent = data.label;
        if (!data.message) {
            element.dataset.tooltip = data.label;
        }

        return element;
    };

    private handleViewSelection = (accept: boolean, selectedIds: Set<string>): void => {
        if (!accept) {
            return;
        }

        const viewId = [...selectedIds][0] as WaitViewId;
        ++this.requestId;
        this.setState({ viewId, rows: [] }, () => {
            this.props.onViewIdChange(viewId);
            void this.updateValues();
        });
    };

    private handleRowExpanded = (row: RowComponent, level: number): void => {
        const { viewId } = this.state;
        const data = row.getData() as IWaitRow;
        if (level !== 0 || (viewId !== "host" && viewId !== "user")) {
            return;
        }
        if (data.childrenLoaded || data.childrenLoading) {
            this.updateRow(data.id, { expanded: true });

            return;
        }

        this.updateRow(data.id, {
            children: [messageRow(data.id, "Loading...")],
            childrenLoading: true,
            expanded: true,
        });
        void this.loadExpandedRow(data, viewId);
    };

    private handleRowCollapsed = (row: RowComponent, level: number): void => {
        if (level === 0) {
            this.updateRow((row.getData() as IWaitRow).id, { expanded: false });
        }
    };

    private isRowExpanded = (row: RowComponent, level: number): boolean => {
        return level === 0 && Boolean((row.getData() as IWaitRow).expanded);
    };

    private async loadExpandedRow(data: IWaitRow, viewId: WaitViewId): Promise<void> {
        let children: IWaitRow[];
        try {
            children = await this.loadChildren(data, viewId);
            if (children.length === 0) {
                children = [messageRow(data.id, "No timed wait events found")];
            }
        } catch (reason) {
            children = [messageRow(data.id, `Unable to load wait events: ${String(reason)}`)];
        }
        if (this.state.viewId !== viewId) {
            return;
        }

        this.updateRow(data.id, {
            children,
            childrenLoaded: true,
            childrenLoading: false,
        });
    }

    private updateRow(id: string, data: Partial<IWaitRow>): void {
        this.setState((state) => {
            return {
                rows: state.rows.map((row) => {
                    return row.id === id ? { ...row, ...data } : row;
                }),
            };
        });
    }

}

const cell = (value: unknown): string => {
    return value === null || value === undefined || value === "" ? "-" : String(value);
};

const formatPercentage = (value: number): string => {
    if (value > 0 && value < 0.1) {
        return "<0.1%";
    }

    return `${value.toLocaleString("en", { maximumFractionDigits: 1 })}%`;
};

const messageRow = (parentId: string, message: string): IWaitRow => {
    return {
        id: `${parentId}.message`,
        label: message,
        occurrences: "-",
        totalLatencyRaw: "-",
        totalLatency: "-",
        averageLatencyRaw: "-",
        averageLatency: "-",
        minimumLatencyRaw: "-",
        minimumLatency: "-",
        maximumLatencyRaw: "-",
        maximumLatency: "-",
        message: true,
    };
};
