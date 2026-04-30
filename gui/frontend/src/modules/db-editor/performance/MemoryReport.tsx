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
import { ColumnDefinition } from "tabulator-tables";

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

export type MemoryViewId = "thread" | "host" | "user";

interface IMemoryReportProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    capabilities?: IPerformanceReportCapabilities;
    initialViewId: MemoryViewId;
    onViewIdChange: (viewId: MemoryViewId) => void;
}

interface IMemoryReportState extends IComponentState {
    viewId: MemoryViewId;
    loading: boolean;
    error?: string;
    globalTotal: string;
    innoDBBufferPool: IMemoryGlobalEntry[];
    rows: IMemoryUsageRow[];
}

interface IMemoryGlobalEntry {
    name: string;
    currentAllocated: string;
}

interface IMemoryUsageRow {
    id: string;
    label: string;
    detail?: string;
    currentCountUsed: string;
    currentAllocated: string;
    currentAvgAlloc: string;
    currentMaxAlloc: string;
    totalAllocated: string;
}

const reports: Array<{
    id: MemoryViewId;
    title: string;
    table: string;
    labelColumn: string;
    detailColumn?: string;
}> = [{
    id: "thread",
    title: "Usage by Thread",
    table: "sys.memory_by_thread_by_current_bytes",
    labelColumn: "thread_id",
    detailColumn: "user",
}, {
    id: "host",
    title: "Usage by Host",
    table: "sys.memory_by_host_by_current_bytes",
    labelColumn: "host",
}, {
    id: "user",
    title: "Usage by User",
    table: "sys.memory_by_user_by_current_bytes",
    labelColumn: "user",
}];

const tableOptions: ITreeGridOptions = {
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

export class MemoryReport extends ComponentBase<IMemoryReportProperties, IMemoryReportState> {

    private requestId = 0;

    public constructor(props: IMemoryReportProperties) {
        super(props);

        this.state = {
            viewId: props.initialViewId,
            loading: false,
            globalTotal: "0 B",
            innoDBBufferPool: [],
            rows: [],
        };
        this.addHandledProperties("backend", "capabilities", "initialViewId", "onViewIdChange");
    }

    public override componentDidMount(): void {
        void this.updateValues();
    }

    public override componentDidUpdate(previousProps: IMemoryReportProperties): void {
        if (previousProps.backend !== this.props.backend || previousProps.capabilities !== this.props.capabilities) {
            void this.updateValues();
        }
    }

    public override componentWillUnmount(): void {
        ++this.requestId;
    }

    public render(): ComponentChild {
        const { error, globalTotal, innoDBBufferPool, loading, rows, viewId } = this.state;
        const report = this.selectedReport();

        return <Container
            className="performanceDashboardReport memoryReport"
            orientation={Orientation.TopDown}
        >
            <Container
                className="performanceStatusReportHeader"
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.SpaceBetween}
                crossAlignment={ContentAlignment.Center}
            >
                {!error && <div className="memorySummary">
                    <div className="memorySummaryItem">
                        <span>Total Allocated Memory</span>
                        <strong>{globalTotal}</strong>
                    </div>
                    {innoDBBufferPool.map((entry) => {
                        return (
                            <div className="memorySummaryItem" key={entry.name}>
                                <span>{entry.name}</span>
                                <strong>{entry.currentAllocated}</strong>
                            </div>
                        );
                    })}
                </div>}
                <Container
                    className="memoryHeaderActions"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Dropdown
                        id="memoryReportDropdown"
                        selection={viewId}
                        onSelect={this.handleViewSelection}
                    >
                        {reports.map((candidate) => {
                            return <DropdownItem key={candidate.id} caption={candidate.title} id={candidate.id} />;
                        })}
                    </Dropdown>
                </Container>
            </Container>
            {error && <div className="memoryReportError">{error}</div>}
            {!error && loading && rows.length === 0 &&
                <div className="memoryReportEmpty">Loading...</div>}
            {!error && !loading && rows.length === 0 &&
                <div className="memoryReportEmpty">No memory usage rows found.</div>}
            {!error && rows.length > 0 &&
                <div className="performanceTableHost">
                    <TreeGrid
                        id="memoryPerformanceGrid"
                        className="performanceTableGrid"
                        options={tableOptions}
                        columns={this.tableColumns(report.title)}
                        tableData={rows}
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

        if (this.props.capabilities && (!this.props.capabilities.performanceSchema ||
            !this.props.capabilities.memory)) {
            ++this.requestId;
            this.setState({
                loading: false,
                error: "Memory report requires the sys schema and Performance Schema memory views.",
                globalTotal: "0 B",
                innoDBBufferPool: [],
                rows: [],
            });

            return;
        }

        const requestId = ++this.requestId;
        const viewId = this.state.viewId;
        const report = this.selectedReport();
        const usageColumns = [
            report.labelColumn,
            report.detailColumn,
            "current_count_used",
            "current_allocated",
            "current_avg_alloc",
            "current_max_alloc",
            "total_allocated",
        ].filter((column): column is string => {
            return column !== undefined;
        }).join(", ");
        this.setState({ loading: true, error: undefined });

        try {
            const [globalResult, innoDBResult, usageResult] = await Promise.all([
                backend.executeService("select total_allocated from sys.memory_global_total"),
                backend.executeService("select event_name, current_alloc from sys.memory_global_by_current_bytes " +
                    "where event_name like 'memory/innodb/buf_buf_pool%' order by event_name"),
                backend.executeService(`select ${usageColumns} from ${report.table} limit 20`),
            ]);
            if (requestId !== this.requestId || this.state.viewId !== viewId) {
                return;
            }

            const globalRows = (globalResult?.rows ?? []) as unknown[][];
            this.setState({
                loading: false,
                globalTotal: cell(globalRows[0]?.[0]),
                innoDBBufferPool: this.parseGlobalEntries(innoDBResult?.rows),
                rows: this.parseUsageRows(usageResult?.rows, report),
            });
        } catch (reason) {
            if (requestId !== this.requestId || this.state.viewId !== viewId) {
                return;
            }

            this.setState({
                loading: false,
                error: String(reason),
                innoDBBufferPool: [],
                rows: [],
            });
        }
    }

    private parseGlobalEntries(rows?: unknown[]): IMemoryGlobalEntry[] {
        return (rows ?? []).map((row) => {
            const values = row as unknown[];

            return {
                name: cell(values[0]),
                currentAllocated: cell(values[1]),
            };
        });
    }

    private parseUsageRows(rows: unknown[] | undefined, report: typeof reports[number]): IMemoryUsageRow[] {
        return (rows ?? []).map((row, index) => {
            const values = row as unknown[];
            const hasDetail = report.detailColumn !== undefined;
            const offset = hasDetail ? 1 : 0;

            return {
                id: `${cell(values[0])}.${hasDetail ? cell(values[1]) : ""}.${index}`,
                label: cell(values[0]),
                detail: hasDetail ? cell(values[1]) : undefined,
                currentCountUsed: cell(values[1 + offset]),
                currentAllocated: cell(values[2 + offset]),
                currentAvgAlloc: cell(values[3 + offset]),
                currentMaxAlloc: cell(values[4 + offset]),
                totalAllocated: cell(values[5 + offset]),
            };
        });
    }

    private tableColumns(title: string): ColumnDefinition[] {
        return [
            { title, field: "label", minWidth: 130, resizable: true },
            { title: "Detail", field: "detail", minWidth: 130, resizable: true },
            { title: "Current Count", field: "currentCountUsed", minWidth: 110, hozAlign: "right", resizable: true },
            {
                title: "Current Allocated",
                field: "currentAllocated",
                minWidth: 130,
                hozAlign: "right",
                resizable: true,
            },
            {
                title: "Average Allocation",
                field: "currentAvgAlloc",
                minWidth: 140,
                hozAlign: "right",
                resizable: true,
            },
            {
                title: "Maximum Allocation",
                field: "currentMaxAlloc",
                minWidth: 140,
                hozAlign: "right",
                resizable: true,
            },
            { title: "Total Allocated", field: "totalAllocated", minWidth: 130, hozAlign: "right", resizable: true },
        ];
    }

    private handleViewSelection = (accept: boolean, selectedIds: Set<string>): void => {
        if (!accept) {
            return;
        }

        const viewId = [...selectedIds][0] as MemoryViewId;
        this.setState({ viewId }, () => {
            this.props.onViewIdChange(viewId);
            void this.updateValues();
        });
    };

}

const cell = (value: unknown): string => {
    return value === null || value === undefined || value === "" ? "-" : String(value);
};
