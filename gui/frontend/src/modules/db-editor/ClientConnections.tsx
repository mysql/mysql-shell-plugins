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

import { ComponentChild, createRef, render } from "preact";

import { CellComponent, ColumnComponent, ColumnDefinition, Formatter, RowComponent } from "tabulator-tables";

import { DialogHost } from "../../app-logic/DialogHost.js";
import {
    DBDataType, DialogResponseClosure, DialogType, IColumnInfo, IDictionary,
} from "../../app-logic/general-types.js";
import { IToolbarItems } from "./index.js";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import {
    ISplitterPaneSizeInfo, SplitContainer,
} from "../../components/ui/SplitContainer/SplitContainer.js";
import { TabPosition, Tabview } from "../../components/ui/Tabview/Tabview.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { ITreeGridOptions, TreeGrid } from "../../components/ui/TreeGrid/TreeGrid.js";
import { IResultSet } from "../../script-execution/index.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType } from "../../supplement/ShellInterface/index.js";
import { convertRows, generateColumnInfo } from "../../supplement/index.js";
import { convertErrorToString, uuid } from "../../utilities/helpers.js";

interface IGlobalStatus {
    threadConnected?: number;
    threadRunning?: number;
    threadsCached?: number;
    threadsCreated?: number;
    rejected?: number;
    totalConnections?: number;
    connectionLimit?: number;
    abortedClients?: number;
    abortedConnections?: number;
    errors?: number;
}

interface IClientConnectionsProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;

    /** The user selected value for refreshs of this page. */
    // TODO: This should be stored as part of the user's preferences or the persistent state of the connection tab.
    refreshInterval?: number;

    savedState?: IClientConnectionsSavedState;
    onStateChange?: (data: Partial<IClientConnectionsSavedState>) => void;
}

export interface IClientConnectionsSavedState {
    showDetails?: boolean;
    selectedTab?: string;
    selectedConnectionId?: string;
    selectedThreadId?: string;
    connectionIdInputValue?: string;
    detailsWidth?: number;
    hideSleepingConnections?: boolean;
    hideBackgroundThreads?: boolean;
    showBackgroundThreads?: boolean;
    showFullInfoColumn?: boolean;
    connectionJumpHistory?: string[];
    connectionJumpHistoryIndex?: number;
    columnWidths?: Array<[string, number]>;
}

interface IClientConnectionsState extends IComponentState {
    resultSet: IResultSet;
    gotError: boolean;
    gotResponse: boolean;
    version?: string;
    globalStatus: IGlobalStatus;
    showDetails: boolean;
    selectedTab: string;
    selectedConnectionId?: string;
    selectedThreadId?: string;
    connectionIdInputValue?: string;
    detailsWidth: number;
    attributes?: IResultSet;
    detailsThreadId?: string;
    fullConnectionInfo?: IResultSet;
    ioByThread?: IResultSet;
    memoryByThread?: IResultSet;
    transactionDetails?: IResultSet;
    currentStatementConnectionId?: string;
    currentStatement?: IResultSet;
    statementHistoryConnectionId?: string;
    statementHistory?: IResultSet;
    locksThreadId?: string;
    metadataLocksHolding?: IResultSet;
    metadataLocksWaiting?: IResultSet;
    innodbRowLocks?: IResultSet;
    innodbRowLocksError?: string;
    summaryThreadId?: string;
    summaryErrors?: IResultSet;
    summaryStages?: IResultSet;
    summaryStatements?: IResultSet;
    summaryTransactions?: IResultSet;
    summaryWaits?: IResultSet;

    refreshInterval: number; // Default is 5s.
}

// Mapping from query field names to human readable names.
const columnNameMap = new Map<string, string>([
    ["PROCESSLIST_ID", "Id"],
    ["PROCESSLIST_USER", "User"],
    ["PROCESSLIST_HOST", "Host"],
    ["PROCESSLIST_DB", "Database"],
    ["PROCESSLIST_COMMAND", "Command"],
    ["PROCESSLIST_TIME", "Time"],
    ["PROCESSLIST_STATE", "State"],
    ["PROCESSLIST_INFO", "Info"],
    ["THREAD_ID", "Thread ID"],
    ["TYPE", "Type"],
    ["NAME", "Name"],
    ["ROLE", "Role"],
    ["INSTRUMENTED", "Instrumented"],
    ["PARENT_THREAD_ID", "Parent Thread ID"]
]);

const connectionListHiddenColumns = new Set([
    "NAME",
    "ROLE",
    "INSTRUMENTED",
    "PARENT_THREAD_ID",
    "PROCESSLIST_TIME_FORMATTED",
]);

const connectionGridHiddenColumns = new Set([
    ...connectionListHiddenColumns,
    "TYPE",
]);

const globalStatusNames = [
    "Aborted_clients",
    "Aborted_connects",
    "Connection_errors_max_connections",
    "Connections",
    "Threads_cached",
    "Threads_connected",
    "Threads_created",
    "Threads_running",
];

const globalStatusQuery = `show global status where VARIABLE_NAME in (` +
    globalStatusNames.map((name) => {
        return `'${name}'`;
    }).join(", ") + `)`;

const minimumColumnWidth = 32;

const statementWarningMetrics: Array<[string, string]> = [
    ["Created Tmp Disk Tables", "createdTmpDiskTables"],
    ["Created Tmp Tables", "createdTmpTables"],
    ["Select Full Join", "selectFullJoin"],
    ["Select Full Range Join", "selectFullRangeJoin"],
    ["Select Range", "selectRange"],
    ["Select Range Check", "selectRangeCheck"],
    ["Select Scan", "selectScan"],
    ["Sort Merge Passes", "sortMergePasses"],
    ["Sort Range", "sortRange"],
    ["Sort Rows", "sortRows"],
    ["Sort Scan", "sortScan"],
    ["No Index Used", "noIndexUsed"],
    ["No Good Index Used", "noGoodIndexUsed"],
];

type ClientConnectionIdType = "connection" | "thread";

export class ClientConnections extends ComponentBase<IClientConnectionsProperties, IClientConnectionsState> {

    private refreshTimer: ReturnType<typeof setInterval> | null = null;

    private updatingValues = false;
    private gridRef = createRef<TreeGrid>();
    private displayOptionsButtonRef = createRef<HTMLDivElement>();
    private displayOptionsMenuRef = createRef<Menu>();

    private selectedRow?: IDictionary;
    private columns: IColumnInfo[] = [];
    private attrColumns: IColumnInfo[] = [];
    private columnWidths = new Map<string, number>();

    private hideSleepingConnections = false;
    private showBackgroundThreads = false;
    private showFullInfoColumn = false;
    private connectionJumpHistory: string[] = [];
    private connectionJumpHistoryIndex = -1;
    private gotPerformanceSchema = false;

    public constructor(props: IClientConnectionsProperties) {
        super(props);

        const { savedState } = props;
        this.hideSleepingConnections = savedState?.hideSleepingConnections ?? false;
        this.showBackgroundThreads = savedState?.showBackgroundThreads ?? !(savedState?.hideBackgroundThreads ?? true);
        this.showFullInfoColumn = savedState?.showFullInfoColumn ?? false;
        this.connectionJumpHistory = [...(savedState?.connectionJumpHistory ?? [])];
        this.connectionJumpHistoryIndex = savedState?.connectionJumpHistoryIndex ?? -1;
        this.columnWidths = new Map(savedState?.columnWidths ?? []);

        this.state = {
            resultSet: {
                type: "resultSet",
                resultId: "",
                columns: [],
                data: { currentPage: 1, rows: [] },
                sql: "",
                updatable: false,
                fullTableName: "",
            },
            gotResponse: false,
            gotError: false,
            globalStatus: {},
            showDetails: savedState?.showDetails ?? false,
            selectedTab: savedState?.selectedTab ?? "propsTab",
            selectedConnectionId: savedState?.selectedConnectionId,
            selectedThreadId: savedState?.selectedThreadId,
            connectionIdInputValue: savedState?.connectionIdInputValue ?? savedState?.selectedConnectionId,
            detailsWidth: savedState?.detailsWidth ?? 430,
            refreshInterval: props.refreshInterval ?? 5000,
        };

        void this.updateValues()
            .catch((error: unknown) => {
                const message = convertErrorToString(error);
                void ui.showErrorMessage("Cannot load performance schema: " + message, {});
            });
        this.addHandledProperties("backend", "toolbarItems", "savedState", "onStateChange");
    }

    public override componentDidUpdate(prevProps: IClientConnectionsProperties, prevState: IClientConnectionsState): void {
        const { backend } = this.props;

        // If we reopen a connection a new backend is created then we need to refresh the page.
        if (backend !== prevProps.backend) {
            void this.updateValues();
        }

        if (this.state.showDetails !== prevState.showDetails ||
            this.state.selectedTab !== prevState.selectedTab ||
            this.state.selectedConnectionId !== prevState.selectedConnectionId ||
            this.state.selectedThreadId !== prevState.selectedThreadId ||
            this.state.connectionIdInputValue !== prevState.connectionIdInputValue ||
            this.state.detailsWidth !== prevState.detailsWidth) {
            this.savePresentationState();
        }

        this.updateRefreshTimer(false);
    }

    public override componentDidMount(): void {
        this.updateRefreshTimer(false);
    }

    public override componentWillUnmount(): void {
        this.savePresentationState();
        this.updateRefreshTimer(true);
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { detailsWidth, resultSet, globalStatus, gotResponse, showDetails, selectedTab, version } = this.state;

        const className = this.getEffectiveClassNames(["clientConnections"]);

        const field = this.columns.find((x) => {
            return x.title === "THREAD_ID";
        });

        const options: ITreeGridOptions = {
            layout: "fitColumns",
            verticalGridLines: false,
            horizontalGridLines: true,
            alternatingRowBackgrounds: true,
            selectionType: SelectionType.Single,
            resizableRows: false,
            selectOnMouseDown: true,
            rowHeight: 28,
            index: field?.field ?? "0",
            preserveColumnWidthsOnDataUpdate: false,
        };
        const selectedRowIndex = this.getSelectedRowRawValue("THREAD_ID");
        const selectedRows = selectedRowIndex === undefined || selectedRowIndex === null || selectedRowIndex === ""
            ? []
            : [String(selectedRowIndex)];

        const navigationItems = [...toolbarItems.navigation];
        const auxiliaryItems = [...toolbarItems.auxiliary];
        const toolbar = <Toolbar id="clientConnectionToolbar" dropShadow={false} >
            {navigationItems}
            {this.toolbarContent()}
            {auxiliaryItems}
            <div className="expander" />
            {this.displayToolbarContent()}
        </Toolbar>;
        const displayOptionsMenu = this.displayOptionsMenu();

        const connectionGrid = gotResponse ? <TreeGrid
            id="clientConnectionsGrid"
            ref={this.gridRef}
            options={options}
            columns={this.generateConnectionListColumnDefinitions(resultSet.columns)}
            tableData={resultSet.data.rows}
            selectedRows={selectedRows}
            onRowSelected={this.handleClientConnectionTreeRowSelected}
            onColumnResized={this.handleColumnResized}
        /> : undefined;
        const connectionListContent = <div id="connectionListContent">
            {toolbar}
            {displayOptionsMenu}
            <div id="connectionGridFrame">
                {connectionGrid}
            </div>
        </div>;
        const connectionDetails = <Container id="connectionDetails" orientation={Orientation.TopDown}>
            {this.getClientConnectionHeading()}
            {showDetails ? <Tabview
                id="detailsTabView"
                tabPosition={TabPosition.Top}
                tabBorderWidth={1}
                contentSeparatorWidth={2}
                onSelectTab={this.handleSelectTab}
                pages={[
                    {
                        caption: "Details",
                        id: "propsTab",
                        content: this.getClientConnectionDetails(),
                    },
                    {
                        caption: "Summary",
                        id: "summaryTab",
                        content: this.getClientConnectionSummary(),
                    },
                    {
                        caption: "Locks",
                        id: "locksTab",
                        content: this.getClientConnectionLocks(),
                    },
                    {
                        caption: "Statement",
                        id: "currentStatementTab",
                        content: this.getClientConnectionCurrentStatement(),
                    },
                    {
                        caption: "History",
                        id: "statementHistoryTab",
                        content: this.getClientConnectionStatementHistory(),
                    },
                ]}
                selectedId={selectedTab}
                stretchTabs={false}
                canReorderTabs={false}
            />
                : this.getClientConnectionListDetails()}
        </Container>;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
            >
                <div id="contentHost" className="fixedScrollbar">
                    <section id="clientConnectionsOverview">
                        <div id="clientConnectionsHeader">
                            <div className="clientConnectionsTitle">
                                <Icon src={Assets.documents.clientConnectionsIcon} id="clientConnectionsIcon" />
                                <div>
                                    <h1>Client Connections</h1>
                                    <div className="clientConnectionsVersion">{version}</div>
                                </div>
                            </div>
                            <div className="clientConnectionPrimaryMetrics">
                                <div className="clientConnectionMetric primary">
                                    <span>Threads Connected / Limit</span>
                                    <Label data-testid="threadsConnected">
                                        <span>{this.formatNumber(globalStatus.threadConnected)}</span>
                                        <span className="clientConnectionLimitValue">
                                            {this.formatNumber(globalStatus.connectionLimit)}
                                        </span>
                                    </Label>
                                    <Label data-testid="connectionsLimit" className="clientConnectionHiddenMetric">
                                        {this.formatNumber(globalStatus.connectionLimit)}
                                    </Label>
                                </div>
                            </div>
                        </div>
                        <div id="connectionProps">
                            {this.getClientConnectionInfo()}
                        </div>
                    </section>
                    <SplitContainer
                        id="connectionList"
                        splitterSize={16}
                        panes={[
                            {
                                id: "connectionGrid",
                                minSize: 320,
                                stretch: true,
                                resizable: true,
                                content: connectionListContent,
                            },
                            {
                                id: "connectionDetails",
                                minSize: 300,
                                maxSize: 820,
                                initialSize: detailsWidth,
                                content: connectionDetails,
                            },
                        ]}
                        onPaneResized={this.handleDetailsPaneResized}
                    />
                </div>
            </Container>
        );
    }

    private getClientConnectionDetails = (): ComponentChild => {
        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        return (
            <div id="clientConnectionDetails" key="propsTab">
                <Grid columns={["max-content", "minmax(0, 1fr)"]} rowGap={0} columnGap={0}>
                    <GridCell className="detailSection" columnSpan={2}>Identity</GridCell>
                    {this.detailRows([
                        ["Thread Id", "THREAD_ID"],
                        ["Name", "NAME"],
                        ["Type", "TYPE"],
                        ["User", "PROCESSLIST_USER"],
                        ["Host", "PROCESSLIST_HOST"],
                    ])}
                    <GridCell className="detailSection" columnSpan={2}>Session</GridCell>
                    {this.detailRows([
                        ["Schema", "PROCESSLIST_DB"],
                        ["Command", "PROCESSLIST_COMMAND"],
                        ["Time", "PROCESSLIST_TIME_FORMATTED"],
                        ["State", "PROCESSLIST_STATE"],
                    ])}
                    <GridCell className="detailSection" columnSpan={2}>Thread</GridCell>
                    {this.detailRows([
                        ["Role", "ROLE"],
                        ["Instrumented", "INSTRUMENTED"],
                        ["Parent Thread Id", "PARENT_THREAD_ID"],
                    ], true)}
                    {this.infoDetailRows()}
                    <GridCell className="detailSection" columnSpan={2}>Transaction</GridCell>
                    {this.transactionDetailRows()}
                </Grid>
                {this.getClientConnectionAttributes()}
            </div>
        );
    };

    private getClientConnectionHeading = (): ComponentChild => {
        const { connectionIdInputValue } = this.state;
        const user = this.getSelectedRowValue("PROCESSLIST_USER");
        const host = this.getSelectedRowValue("PROCESSLIST_HOST");
        const processId = this.getSelectedRowValue("PROCESSLIST_ID");
        const inputValue = processId ? connectionIdInputValue ?? processId : "-";
        const account = processId
            ? host ? `${user || "Unknown user"}@${host}` : user || "Unknown user"
            : "No connection selected";

        return (
            <div className="connectionDetailsSummary">
                <div className="connectionDetailsNavigation">
                    {this.connectionHistoryButton("back")}
                    {this.connectionHistoryButton("next")}
                </div>
                <span className="connectionDetailsCaption">CONNECTION_ID</span>
                <div className="connectionDetailsIdentity">
                    <span className="connectionDetailsProcessId">
                        <input
                            className="connectionDetailsProcessIdInput"
                            aria-label="Connection ID"
                            value={inputValue}
                            disabled={!processId}
                            spellcheck={false}
                            onInput={this.handleConnectionIdInput}
                            onKeyDown={this.handleConnectionIdInputKeyDown}
                        />
                    </span>
                    <div className="connectionDetailsActions">
                        {this.killToolbarContent()}
                        <Divider key="showDetailsSeparator" vertical={true} thickness={1} />
                        {this.showDetailsButton()}
                    </div>
                </div>
                <span>{account}</span>
            </div>
        );
    };

    private getClientConnectionListDetails = (): ComponentChild => {
        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const rows = this.columns
            .filter((column) => {
                return !connectionListHiddenColumns.has(column.title);
            })
            .map((column): [string, string] => {
                return [columnNameMap.get(column.title) ?? column.title, column.title];
            });

        return (
            <div id="clientConnectionDetails">
                <Grid columns={["max-content", "minmax(0, 1fr)"]} rowGap={0} columnGap={0}>
                    {this.detailRows(this.orderCompactDetailRows(rows))}
                </Grid>
            </div>
        );
    };

    private memorySummarySection = (): ComponentChild => {
        const { memoryByThread, summaryThreadId } = this.state;
        if (summaryThreadId !== this.getSelectedRowValue("THREAD_ID")) {
            return this.emptySummarySection("Memory");
        }

        const row = this.firstResultSetRow(memoryByThread);
        if (!memoryByThread || !row) {
            return this.emptySummarySection("Memory");
        }

        return (
            <section className="connectionDetailsSection">
                <h2>Memory</h2>
                <Grid className="lockDetailGrid" columns={["max-content", "minmax(0, 1fr)"]} rowGap={0} columnGap={0}>
                    {this.resultSetDetailRows(memoryByThread, row, [
                        ["Current Allocated", "currentAllocated"],
                        ["Current Used Count", "currentCountUsed"],
                        ["Average Allocation", "currentAverageAllocation"],
                        ["Maximum Allocation", "currentMaximumAllocation"],
                        ["Total Allocated", "totalAllocated"],
                    ], true)}
                </Grid>
            </section>
        );
    };

    private ioSummarySection = (): ComponentChild => {
        const { ioByThread, summaryThreadId } = this.state;
        if (summaryThreadId !== this.getSelectedRowValue("THREAD_ID")) {
            return this.emptySummarySection("I/O");
        }

        const row = this.firstResultSetRow(ioByThread);
        if (!ioByThread || !row) {
            return this.emptySummarySection("I/O");
        }

        return (
            <section className="connectionDetailsSection">
                <h2>I/O</h2>
                <Grid className="lockDetailGrid" columns={["max-content", "minmax(0, 1fr)"]} rowGap={0} columnGap={0}>
                    {this.resultSetDetailRows(ioByThread, row, [
                        ["Total Events", "total"],
                        ["Total Latency", "totalLatency"],
                        ["Minimum Latency", "minLatency"],
                        ["Average Latency", "avgLatency"],
                        ["Maximum Latency", "maxLatency"],
                    ], true)}
                </Grid>
            </section>
        );
    };

    private transactionDetailRows = (): ComponentChild[] => {
        const { detailsThreadId, transactionDetails } = this.state;
        if (detailsThreadId !== this.getSelectedRowValue("THREAD_ID")) {
            return [];
        }

        const row = this.firstResultSetRow(transactionDetails);
        if (!transactionDetails || !row) {
            return [];
        }

        return this.resultSetDetailRows(transactionDetails, row, [
            ["State", "state"],
            ["Elapsed Time", "elapsedTime"],
            ["Access Mode", "accessMode"],
            ["Isolation Level", "isolationLevel"],
        ], true);
    };

    private infoDetailRows = (): ComponentChild[] => {
        const value = this.getSelectedConnectionInfo();

        return [
            <GridCell className="detailSection connectionSqlLabel" columnSpan={2} key="infoSection">
                <span>Info</span>
                {this.sqlTextOpenButton(value, "Connection Info")}
            </GridCell>,
            <GridCell className="detailValue connectionSqlValue" columnSpan={2} key="infoValue">
                {this.sqlTextViewer(value)}
            </GridCell>,
        ];
    };

    private detailRows = (rows: Array<[string, string]>, omitEmpty = false): ComponentChild[] => {
        return rows.flatMap(([label, key]) => {
            const value = this.getDetailRowValue(key);
            if (omitEmpty && value.length === 0) {
                return [];
            }

            if (key === "PROCESSLIST_INFO") {
                return [
                    <GridCell className="detailLabel stacked connectionSqlLabel" columnSpan={2} key={`${key}Label`}>
                        <span>{label}</span>
                        {this.sqlTextOpenButton(value, "Connection Info")}
                    </GridCell>,
                    <GridCell className="detailValue connectionSqlValue" columnSpan={2} key={`${key}Value`}>
                        {this.sqlTextViewer(value)}
                    </GridCell>,
                ];
            }

            return [
                <GridCell className="detailLabel" key={`${key}Label`}>{label}</GridCell>,
                <GridCell className="detailValue" key={`${key}Value`}>
                    {this.renderDetailValue(key, value)}
                </GridCell>,
            ];
        });
    };

    private getDetailRowValue = (key: string): string => {
        if (key === "PROCESSLIST_TIME" || key === "PROCESSLIST_TIME_FORMATTED") {
            return this.formatProcesslistTime(
                this.getSelectedRowValue("PROCESSLIST_TIME_FORMATTED"),
                this.getSelectedRowValue("PROCESSLIST_TIME"),
            );
        }

        return this.getSelectedRowValue(key);
    };

    private renderDetailValue = (key: string, value: string): ComponentChild => {
        const idType = this.detailIdType(key);

        return idType ? this.connectionIdPill(value, idType) : value;
    };

    private sqlTextViewer = (value: string): ComponentChild => {
        return (
            <div className="connectionSqlTextHost">
                <textarea
                    className="connectionInfoText"
                    readOnly={true}
                    value={value}
                />
            </div>
        );
    };

    private sqlTextOpenButton = (value: string, caption: string): ComponentChild => {
        return (
            <Button
                className="connectionSqlOpenButton"
                data-tooltip="Open in SQL Editor"
                imageOnly={true}
                disabled={value.length === 0}
                onClick={this.handleOpenSqlTextInEditor(value, caption)}
            >
                <Icon src={Codicon.NewFile} data-tooltip="inherit" />
            </Button>
        );
    };

    private handleOpenSqlTextInEditor = (content: string, caption: string) => {
        return (): void => {
            void requisitions.execute("editorEditScript", {
                id: uuid(),
                caption,
                content,
                language: "mysql",
            });
        };
    };

    private detailIdType = (key: string): ClientConnectionIdType | undefined => {
        switch (key) {
            case "PROCESSLIST_ID":
            case "waitingConnectionId":
            case "waitingPid":
            case "blockingPid":
            case "holderConnectionId": {
                return "connection";
            }

            case "THREAD_ID":
            case "PARENT_THREAD_ID":
            case "holderThreadId":
            case "threadId": {
                return "thread";
            }

            default: {
                return undefined;
            }
        }
    };

    private orderCompactDetailRows = (rows: Array<[string, string]>): Array<[string, string]> => {
        const threadRows = rows.filter(([_label, key]) => {
            return key === "THREAD_ID";
        });
        const infoRows = rows.filter(([_label, key]) => {
            return key === "PROCESSLIST_INFO";
        });
        const otherRows = rows.filter(([_label, key]) => {
            return key !== "THREAD_ID" && key !== "PROCESSLIST_INFO";
        });

        return [...threadRows, ...otherRows, ...infoRows];
    };

    private getSelectedConnectionInfo = (): string => {
        const { detailsThreadId, fullConnectionInfo } = this.state;
        if (detailsThreadId !== this.getSelectedRowValue("THREAD_ID")) {
            return this.getSelectedRowValue("PROCESSLIST_INFO");
        }

        const row = this.firstResultSetRow(fullConnectionInfo);
        if (!fullConnectionInfo || !row) {
            return this.getSelectedRowValue("PROCESSLIST_INFO");
        }

        return this.getResultSetValue(fullConnectionInfo, row, "processlistInfo");
    };

    private resultSetDetailRows = (
        resultSet: IResultSet, row: IDictionary, rows: Array<[string, string]>, omitEmpty = false,
    ): ComponentChild[] => {
        return rows.flatMap(([label, key]) => {
            const value = this.getResultSetValue(resultSet, row, key);
            if (omitEmpty && value.length === 0) {
                return [];
            }

            return [
                <GridCell className="detailLabel" key={`${key}Label`}>{label}</GridCell>,
                <GridCell className="detailValue" key={`${key}Value`}>
                    {this.renderDetailValue(key, value)}
                </GridCell>,
            ];
        });
    };

    private getClientConnectionLocks = (): ComponentChild => {
        const { innodbRowLocks, innodbRowLocksError, metadataLocksHolding, metadataLocksWaiting } = this.state;

        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const innodbHolding = this.filterResultSet(innodbRowLocks, (row, resultSet) => {
            return this.getResultSetValue(resultSet, row, "role") === "blocking";
        });
        const innodbWaiting = this.firstResultSetRow(innodbRowLocks, (row, resultSet) => {
            return this.getResultSetValue(resultSet, row, "role") === "waiting";
        });
        const metadataWaiting = this.firstResultSetRow(metadataLocksWaiting);

        const options: ITreeGridOptions = {
            selectionType: SelectionType.None,
            showHeader: true,
        };

        return (
            <div id="locksInfoContainer" key="locksTab" className="connectionDetailsTabContent">
                {innodbWaiting && innodbRowLocks &&
                    <section className="connectionDetailsSection">
                        <h2>Waiting: InnoDB Row Lock</h2>
                        {this.lockDetailGrid(innodbRowLocks, innodbWaiting, [
                            ["Table", "lockedTable"],
                            ["Index", "lockedIndex"],
                            ["Waiting For", "waitAge"],
                            ["Waiting Connection", "waitingPid"],
                            ["Blocking Connection", "blockingPid"],
                            ["Blocking Transaction Age", "blockingTrxAge"],
                            ["Waiting Query", "waitingQuery"],
                            ["Blocking Query", "blockingQuery"],
                        ])}
                    </section>
                }
                {!innodbWaiting && metadataWaiting && metadataLocksWaiting &&
                    <section className="connectionDetailsSection">
                        <h2>Waiting: Metadata Lock</h2>
                        {this.lockDetailGrid(metadataLocksWaiting, metadataWaiting, [
                            ["Object", "objectName"],
                            ["Duration", "duration"],
                            ["Held By", "holderDisplay"],
                            ["Holder User", "holderUser"],
                            ["Holder Host", "holderHost"],
                            ["Holding Time", "holderTime"],
                            ["Lock", "lockType"],
                            ["Holder State", "holderState"],
                        ])}
                    </section>
                }
                {!innodbWaiting && !metadataWaiting &&
                    <p className="connectionDetailsNotice">
                        {innodbRowLocksError
                            ? "No metadata lock wait was found. InnoDB row lock details are unavailable: "
                            + innodbRowLocksError
                            : "This connection is not waiting for a metadata or InnoDB row lock."}
                    </p>
                }
                <section className="connectionDetailsSection">
                    <h2>Held Metadata Locks</h2>
                    {this.lockGrid(
                        "clientConnectionLocksHolding",
                        metadataLocksHolding,
                        this.metadataLocksHoldingColumns(metadataLocksHolding),
                        options,
                    )}
                </section>
                <section className="connectionDetailsSection">
                    <h2>Held InnoDB Row Locks</h2>
                    {innodbRowLocksError
                        ? <p>{innodbRowLocksError}</p>
                        : this.lockGrid(
                            "clientConnectionInnodbLocks",
                            innodbHolding,
                            this.innodbRowLocksHoldingColumns(innodbHolding),
                            options,
                        )}
                </section>
            </div>
        );
    };

    private lockGrid = (
        id: string, resultSet: IResultSet | undefined, columns: ColumnDefinition[], options: ITreeGridOptions,
    ): ComponentChild => {
        return resultSet && resultSet.data.rows.length > 0
            ? <TreeGrid
                key={id}
                id={id}
                options={options}
                columns={columns}
                tableData={resultSet.data.rows}
            />
            : <p>No locks.</p>;
    };

    private metadataLocksHoldingColumns = (resultSet: IResultSet | undefined): ColumnDefinition[] => {
        return this.lockColumnDefinitions(resultSet, [
            ["Object", "objectName"],
            ["Lock", "lockType"],
            ["Duration", "duration"],
            ["Waiting Connection", "waitingConnectionId"],
            ["Waiting User", "waitingUser"],
            ["Waiting Time", "waitingTime"],
        ]);
    };

    private metadataLocksWaitingColumns = (resultSet: IResultSet | undefined): ColumnDefinition[] => {
        return this.lockColumnDefinitions(resultSet, [
            ["Object", "objectName"],
            ["Lock", "lockType"],
            ["Duration", "duration"],
            ["Held By", "holderDisplay"],
            ["Holder User", "holderUser"],
            ["Holding Time", "holderTime"],
            ["Holder State", "holderState"],
        ]);
    };

    private innodbRowLocksHoldingColumns = (resultSet: IResultSet | undefined): ColumnDefinition[] => {
        return this.lockColumnDefinitions(resultSet, [
            ["Table", "lockedTable"],
            ["Index", "lockedIndex"],
            ["Wait Age", "waitAge"],
            ["Waiting Connection", "waitingPid"],
            ["Waiting Query", "waitingQuery"],
        ]);
    };

    private lockColumnDefinitions = (
        resultSet: IResultSet | undefined, definitions: Array<[string, string]>,
    ): ColumnDefinition[] => {
        return definitions.map(([title, columnTitle]) => {
            const column = resultSet?.columns.find((candidate) => {
                return candidate.title === columnTitle;
            });

            return {
                title,
                field: column?.field ?? columnTitle,
                formatter: this.lockColumnFormatter(columnTitle),
                minWidth: title.includes("Query") ? 180 : 90,
                resizable: true,
            };
        });
    };

    private lockColumnFormatter = (columnTitle: string): Formatter => {
        const idType = this.detailIdType(columnTitle);

        return idType
            ? (cell: CellComponent): HTMLElement => {
                return this.connectionIdPillElement(String(cell.getValue() ?? ""), idType);
            }
            : this.stringFormatter;
    };

    private lockDetailGrid = (
        resultSet: IResultSet, row: IDictionary, rows: Array<[string, string]>,
    ): ComponentChild => {
        return (
            <Grid className="lockDetailGrid" columns={["max-content", "minmax(0, 1fr)"]} rowGap={0} columnGap={0}>
                {rows.flatMap(([label, columnTitle]) => {
                    const value = this.getLockDetailValue(resultSet, row, columnTitle);

                    return [
                        <GridCell className="detailLabel" key={`${columnTitle}Label`}>{label}</GridCell>,
                        <GridCell className="detailValue" key={`${columnTitle}Value`}>
                            {this.renderLockDetailValue(resultSet, row, columnTitle, value)}
                        </GridCell>,
                    ];
                })}
            </Grid>
        );
    };

    private getLockDetailValue = (resultSet: IResultSet, row: IDictionary, columnTitle: string): string => {
        return this.getResultSetValue(resultSet, row, columnTitle);
    };

    private renderLockDetailValue = (
        resultSet: IResultSet, row: IDictionary, columnTitle: string, value: string,
    ): ComponentChild => {
        if (columnTitle === "holderDisplay") {
            const connectionId = this.getResultSetValue(resultSet, row, "holderConnectionId");
            const threadId = this.getResultSetValue(resultSet, row, "holderThreadId");

            return (
                <span className="connectionIdComposite">
                    {this.connectionIdPill(connectionId, "connection")}
                    {threadId && <>
                        <span className="connectionIdCompositeText">(tid:</span>
                        {this.connectionIdPill(threadId, "thread", false)}
                        <span className="connectionIdCompositeText">)</span>
                    </>}
                </span>
            );
        }

        return this.renderDetailValue(columnTitle, value);
    };

    private filterResultSet = (
        resultSet: IResultSet | undefined,
        predicate: (row: IDictionary, resultSet: IResultSet) => boolean,
    ): IResultSet | undefined => {
        if (!resultSet) {
            return undefined;
        }

        return {
            ...resultSet,
            data: {
                ...resultSet.data,
                rows: resultSet.data.rows.filter((row) => {
                    return predicate(row, resultSet);
                }),
            },
        };
    };

    private firstResultSetRow = (
        resultSet: IResultSet | undefined,
        predicate?: (row: IDictionary, resultSet: IResultSet) => boolean,
    ): IDictionary | undefined => {
        return resultSet?.data.rows.find((row) => {
            return predicate?.(row, resultSet) ?? true;
        });
    };

    private getResultSetValue = (resultSet: IResultSet, row: IDictionary, columnTitle: string): string => {
        const field = resultSet.columns.find((column) => {
            return column.title === columnTitle;
        })?.field ?? columnTitle;

        const value = row[field];

        return value === undefined || value === null ? "" : String(value);
    };

    private getConnectionRowValue = (row: IDictionary, columnTitle: string): string => {
        const field = this.columns.find((column) => {
            return column.title === columnTitle;
        })?.field ?? columnTitle;

        const value = row[field];

        return value === undefined || value === null ? "" : String(value);
    };

    private findConnectionRow = (columnTitle: string, value: string): IDictionary | undefined => {
        if (!value) {
            return undefined;
        }

        return this.state.resultSet.data.rows.find((row) => {
            return this.getConnectionRowValue(row, columnTitle) === value;
        });
    };

    private connectionIdPill = (
        value: string, idType: ClientConnectionIdType, allowJump = true,
    ): ComponentChild => {
        if (!value) {
            return "";
        }

        const jumpTarget = allowJump ? this.connectionJumpTarget(value, idType) : undefined;

        return (
            <span className={`connectionIdPill ${idType}`}>
                {idType === "thread" && <span className="connectionIdTypeMarker">T</span>}
                <span>{value}</span>
                {jumpTarget &&
                    <Button
                        className="connectionIdJumpButton"
                        data-connection-id={jumpTarget}
                        data-tooltip="Show Connection"
                        imageOnly={true}
                        onClick={this.handleConnectionIdJump}
                    >
                        <Icon src={Codicon.ArrowCircleRight} data-tooltip="inherit" />
                    </Button>}
            </span>
        );
    };

    private connectionIdPillElement = (
        value: string, idType: ClientConnectionIdType, allowJump = true, cell?: CellComponent,
    ): HTMLElement => {
        if (!allowJump) {
            const host = document.createElement("span");
            const pill = document.createElement("span");
            const isBackgroundThread = idType === "connection" && this.isBackgroundThreadCell(cell);
            pill.className = `connectionIdPill ${idType}${isBackgroundThread ? " backgroundThread" : ""}`;

            if (idType === "thread") {
                const marker = document.createElement("span");
                marker.className = "connectionIdTypeMarker";
                marker.textContent = "T";
                pill.append(marker);
            }

            const text = document.createElement("span");
            text.textContent = value;
            pill.append(text);

            if (isBackgroundThread) {
                const marker = document.createElement("span");
                marker.className = "connectionIdBackgroundMarker";
                marker.textContent = "background";
                pill.append(marker);
            }

            host.append(pill);

            return host;
        }

        const host = document.createElement("span");
        render(this.connectionIdPill(value, idType, allowJump), host);

        return host;
    };

    private isBackgroundThreadCell = (cell?: CellComponent): boolean => {
        const rowData = cell?.getRow().getData() as IDictionary | undefined;
        if (!rowData) {
            return false;
        }

        return String(rowData[this.connectionListField("TYPE")] ?? "") === "BACKGROUND";
    };

    private connectionJumpTarget = (value: string, idType: ClientConnectionIdType): string | undefined => {
        const currentConnectionId = this.getSelectedRowValue("PROCESSLIST_ID");
        const row = idType === "connection"
            ? this.findConnectionRow("PROCESSLIST_ID", value)
            : this.findConnectionRow("THREAD_ID", value);
        if (!row) {
            return undefined;
        }

        const targetConnectionId = this.getConnectionRowValue(row, "PROCESSLIST_ID");

        return targetConnectionId && targetConnectionId !== currentConnectionId ? targetConnectionId : undefined;
    };

    private connectionListField = (columnTitle: string): string => {
        return this.columns.find((column) => {
            return column.title === columnTitle;
        })?.field ?? columnTitle;
    };

    private getClientConnectionAttributes = (): ComponentChild => {
        const { attributes } = this.state;

        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const processlistId = this.getSelectedRowValue("PROCESSLIST_ID");
        const hasCurrentAttributes = this.resultSetHasColumnValue(attributes, "PROCESSLIST_ID", processlistId);

        return (
            <section className="connectionDetailsSection">
                <h2>Connection Attributes</h2>
                {hasCurrentAttributes && attributes && attributes.data.rows.length > 0
                    ? <Grid
                        className="lockDetailGrid"
                        columns={["max-content", "minmax(0, 1fr)"]}
                        rowGap={0}
                        columnGap={0}
                    >
                        {attributes.data.rows.flatMap((row) => {
                            const name = this.getResultSetValue(attributes, row, "ATTR_NAME");
                            const value = this.getResultSetValue(attributes, row, "ATTR_VALUE");

                            return [
                                <GridCell className="detailLabel" key={`${name}Label`}>{name}</GridCell>,
                                <GridCell className="detailValue" key={`${name}Value`}>{value}</GridCell>,
                            ];
                        })}
                    </Grid>
                    : <p>No attributes.</p>}
            </section>
        );
    };

    private getClientConnectionSummary = (): ComponentChild => {
        const {
            summaryErrors, summaryStages, summaryStatements, summaryThreadId, summaryTransactions, summaryWaits,
        } = this.state;

        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const currentThreadId = this.getSelectedRowValue("THREAD_ID");
        const isCurrentSummary = summaryThreadId === currentThreadId;
        const options: ITreeGridOptions = {
            layout: "fitColumns",
            rowHeight: 28,
            selectionType: SelectionType.None,
            showHeader: true,
        };

        return (
            <div id="clientConnectionSummaryHost" key="summaryTab" className="connectionDetailsTabContent">
                {this.memorySummarySection()}
                {this.ioSummarySection()}
                {this.summarySection(
                    "Top 5 Errors",
                    "clientConnectionSummaryErrors",
                    isCurrentSummary ? summaryErrors : undefined,
                    [
                        ["Error", "eventName"],
                        ["Raised", "count"],
                        ["Handled", "handled"],
                        ["SQL State", "sqlState"],
                    ],
                    options,
                )}
                {this.summarySection(
                    "Top 5 Stages",
                    "clientConnectionSummaryStages",
                    isCurrentSummary ? summaryStages : undefined,
                    this.eventSummaryColumns(),
                    options,
                )}
                {this.summarySection(
                    "Top 5 Statements",
                    "clientConnectionSummaryStatements",
                    isCurrentSummary ? summaryStatements : undefined,
                    this.eventSummaryColumns(),
                    options,
                )}
                {this.summarySection(
                    "Top 5 Transactions",
                    "clientConnectionSummaryTransactions",
                    isCurrentSummary ? summaryTransactions : undefined,
                    this.eventSummaryColumns(),
                    options,
                )}
                {this.summarySection(
                    "Top 5 Waits",
                    "clientConnectionSummaryWaits",
                    isCurrentSummary ? summaryWaits : undefined,
                    this.eventSummaryColumns(),
                    options,
                )}
            </div>
        );
    };

    private eventSummaryColumns = (): Array<[string, string]> => {
        return [
            ["Event", "eventName"],
            ["Count", "count"],
            ["Total Latency", "totalLatency"],
            ["Avg Latency", "avgLatency"],
            ["Max Latency", "maxLatency"],
        ];
    };

    private summarySection = (
        title: string,
        id: string,
        resultSet: IResultSet | undefined,
        definitions: Array<[string, string]>,
        options: ITreeGridOptions,
    ): ComponentChild => {
        return (
            <section className="connectionDetailsSection">
                <h2>{title}</h2>
                {resultSet && resultSet.data.rows.length > 0
                    ? <TreeGrid
                        key={id}
                        id={id}
                        className="summaryGrid"
                        options={options}
                        columns={this.summaryColumnDefinitions(resultSet, definitions)}
                        tableData={resultSet.data.rows}
                    />
                    : <p>No events.</p>}
            </section>
        );
    };

    private emptySummarySection = (title: string): ComponentChild => {
        return (
            <section className="connectionDetailsSection">
                <h2>{title}</h2>
                <p>No events.</p>
            </section>
        );
    };

    private summaryColumnDefinitions = (
        resultSet: IResultSet | undefined, definitions: Array<[string, string]>,
    ): ColumnDefinition[] => {
        return definitions.map(([title, columnTitle]) => {
            const column = resultSet?.columns.find((candidate) => {
                return candidate.title === columnTitle;
            });

            return {
                title,
                field: column?.field ?? columnTitle,
                formatter: this.stringFormatter,
                minWidth: title.includes("Event") || title.includes("Error") ? 180 : 90,
                resizable: true,
            };
        });
    };

    private getClientConnectionCurrentStatement = (): ComponentChild => {
        const { currentStatement } = this.state;

        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const currentStatementRow = this.firstResultSetRow(currentStatement);
        const hasCurrentStatement = currentStatement && currentStatementRow &&
            String(this.getResultSetValue(currentStatement, currentStatementRow, "isActive")) === "1";

        return (
            <div id="clientConnectionCurrentStatementHost" key="currentStatementTab" className="connectionDetailsTabContent">
                <section className="connectionDetailsSection">
                    <h2>Current Statement</h2>
                    {hasCurrentStatement
                        ? <>
                            {this.statementWarningPills(currentStatement, currentStatementRow)}
                            <Grid className="lockDetailGrid" columns={["max-content", "minmax(0, 1fr)"]}
                                rowGap={0} columnGap={0}>
                                {this.resultSetDetailRows(currentStatement, currentStatementRow, [
                                    ["Start Time", "startTime"],
                                    ["Time Elapsed", "elapsedTime"],
                                    ["Lock Time", "lockTime"],
                                    ["Warnings", "warnings"],
                                    ["Max Controlled Memory", "maxControlledMemory"],
                                    ["Max Total Memory", "maxTotalMemory"],
                                    ["Execution Engine", "executionEngine"],
                                ], true)}
                                <GridCell className="detailLabel stacked connectionSqlLabel" columnSpan={2}>
                                    <span>SQL Text</span>
                                    {this.sqlTextOpenButton(
                                        this.getResultSetValue(currentStatement, currentStatementRow, "sqlText"),
                                        "Current Statement",
                                    )}
                                </GridCell>
                                <GridCell className="detailValue connectionSqlValue" columnSpan={2}>
                                    {this.sqlTextViewer(
                                        this.getResultSetValue(currentStatement, currentStatementRow, "sqlText"),
                                    )}
                                </GridCell>
                            </Grid>
                        </>
                        : <p>Idle</p>}
                </section>
            </div>
        );
    };

    private statementWarningPills = (resultSet: IResultSet, row: IDictionary): ComponentChild => {
        const pills = statementWarningMetrics.flatMap(([label, key]) => {
            const value = this.getResultSetValue(resultSet, row, key);
            const numericValue = Number(value);
            if (!Number.isFinite(numericValue) || numericValue <= 0) {
                return [];
            }

            return [
                <span className="statementWarningPill" key={key}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                </span>,
            ];
        });

        return pills.length > 0 ? <div className="statementWarningPills">{pills}</div> : undefined;
    };

    private getClientConnectionStatementHistory = (): ComponentChild => {
        const { statementHistory } = this.state;

        if (!this.selectedRow) {
            return this.connectionDetailsEmptyMessage();
        }

        const startTimeField = statementHistory?.columns.find((x) => {
            return x.title === "startTime";
        });
        const elapsedTimeField = statementHistory?.columns.find((x) => {
            return x.title === "elapsedTime";
        });
        const sqlTextField = statementHistory?.columns.find((x) => {
            return x.title === "sqlText";
        });
        const errorField = statementHistory?.columns.find((x) => {
            return x.title === "error";
        });
        const statementColumns: ColumnDefinition[] = [
            { title: "Start Time", field: startTimeField?.field ?? "startTime", minWidth: 150, resizable: true },
            { title: "Time Elapsed", field: elapsedTimeField?.field ?? "elapsedTime", minWidth: 110, resizable: true },
            {
                title: "SQL Text",
                field: sqlTextField?.field ?? "sqlText",
                formatter: this.stringFormatter,
                minWidth: 220,
                resizable: true,
            },
            { title: "Error", field: errorField?.field ?? "error", minWidth: 180, resizable: true },
        ];
        const options: ITreeGridOptions = {
            selectionType: SelectionType.None,
            showHeader: true,
        };

        return (
            <div id="clientConnectionHistoryHost" key="statementHistoryTab" className="connectionDetailsTabContent">
                <section className="connectionDetailsSection">
                    <h2>Statement History</h2>
                    {statementHistory && statementHistory.data.rows.length > 0
                        ? <TreeGrid
                            key="clientConnectionHistory"
                            id="clientConnectionHistory"
                            options={options}
                            columns={statementColumns}
                            tableData={statementHistory.data.rows}
                        />
                        : <p>No statement history.</p>}
                </section>
            </div>
        );
    };

    private connectionDetailsEmptyMessage = (): ComponentChild => {
        return (
            <div id="clientConnectionDetails" className="connectionDetailsEmpty">
                Select a connection to show details.
            </div>
        );
    };

    private getClientConnectionInfo = (): ComponentChild => {

        const { globalStatus } = this.state;

        return (
            <>
                {this.metricTile("threadsRunning", "Threads Running", globalStatus.threadRunning)}
                {this.metricTile("threadsCached", "Threads Cached", globalStatus.threadsCached)}
                {this.metricTile("rejected", "Rejected (over limit)", globalStatus.rejected)}
                {this.metricTile("abortedClients", "Aborted Clients", globalStatus.abortedClients)}
                {this.metricTile("abortedConnections", "Aborted Connections", globalStatus.abortedConnections)}
                {this.metricTile("errors", "Errors", globalStatus.errors)}
            </>
        );
    };

    private metricTile = (id: string, label: string, value?: number, primary = false): ComponentChild => {
        const formattedValue = this.formatNumber(value);

        return (
            <div className={`clientConnectionMetric${primary ? " primary" : ""}`} key={`${id}Metric`}>
                <span>{label}</span>
                <Label data-testid={id}>{formattedValue}</Label>
            </div>
        );
    };

    private formatNumber = (value?: number): string | undefined => {
        return value === undefined ? undefined : value.toLocaleString();
    };

    private toolbarContent = (): ComponentChild[] => {
        const { refreshInterval } = this.state;

        const intervals: number[] = [1, 2, 3, 4, 5, 10, 15, 30, 0];
        const items: ComponentChild[] = [];

        intervals.forEach((value: number) => {
            items.push(
                <DropdownItem
                    id={`${value}`}
                    caption={value > 0 ? `${value} seconds` : `no refresh`}
                />,
            );
        });

        return [
            <Label key="mainLabel" style={{ marginLeft: "8px" }}>Refresh Rate:</Label>,
            <Dropdown
                id="refreshSelector"
                key="selector"
                onSelect={this.handleTimeRangeSelection}
                selection={`${refreshInterval / 1000}`}
            >
                {items}
            </Dropdown>,
            <Button
                key="refresh"
                data-tooltip="Refresh"
                imageOnly={true}
                onClick={this.handleRefresh}
            >
                <Icon src={Assets.toolbar.refreshIcon2} data-tooltip="inherit" />
            </Button>,
        ];

    };

    private killToolbarContent = (): ComponentChild[] => {
        const killDisabled = !this.canKillSelectedConnection();

        return [
            <Button
                key="killQuery"
                className="clientConnectionKillButton"
                data-tooltip="Kill Query"
                imageOnly={true}
                disabled={killDisabled}
                onClick={this.handleKillQuery}
            >
                <Icon src={Codicon.DebugStop} data-tooltip="inherit" />
            </Button>,
            <Button
                key="killConnection"
                className="clientConnectionKillButton"
                data-tooltip="Kill Connection"
                imageOnly={true}
                disabled={killDisabled}
                onClick={this.handleKillConnection}
            >
                <Icon src={Codicon.DebugDisconnect} data-tooltip="inherit" />
            </Button>,
        ];
    };

    private showDetailsButton = (): ComponentChild => {
        const { showDetails } = this.state;

        return (
            <Button
                key="showDetails"
                className={`clientConnectionShowDetailsButton${showDetails ? " active" : ""}`}
                data-tooltip={showDetails ? "Hide Details" : "Show Details"}
                imageOnly={true}
                onClick={this.handleShowDetails}
            >
                <Icon src={Assets.toolbar.infoInactiveIcon} data-tooltip="inherit" />
            </Button>
        );
    };

    private connectionHistoryButton = (direction: "back" | "next"): ComponentChild => {
        const isBack = direction === "back";

        return (
            <Button
                key={`connectionHistory${direction}`}
                className="clientConnectionHistoryButton"
                data-direction={direction}
                data-tooltip={isBack ? "Back" : "Next"}
                imageOnly={true}
                disabled={!this.canNavigateConnectionHistory(isBack ? -1 : 1)}
                onClick={this.handleConnectionHistoryButton}
            >
                <Icon src={isBack ? Codicon.ArrowLeft : Codicon.ArrowRight} data-tooltip="inherit" />
            </Button>
        );
    };

    private displayOptionsMenu = (): ComponentChild => {
        return (
            <Menu
                id="clientConnectionDisplayOptionsMenu"
                ref={this.displayOptionsMenuRef}
                placement={ComponentPlacement.BottomLeft}
                onItemClick={this.handleDisplayOptionsMenuItemClick}
            >
                <MenuItem
                    id="hideSleepingConnections"
                    command={{ title: "Hide Sleeping Connections", command: "hideSleepingConnections" }}
                    checked={this.hideSleepingConnections}
                />
                <MenuItem
                    id="hideBackgroundThreads"
                    command={{ title: "Show Background Threads", command: "showBackgroundThreads" }}
                    checked={this.showBackgroundThreads}
                />
                <MenuItem
                    id="showFullInfoColumn"
                    command={{ title: "Show Full Info Column", command: "showFullInfoColumn" }}
                    checked={this.showFullInfoColumn}
                />
            </Menu>
        );
    };

    private displayToolbarContent = (): ComponentChild => {
        return (
            <Button
                key="displayOptions"
                innerRef={this.displayOptionsButtonRef}
                data-tooltip="Display Options"
                imageOnly={true}
                onClick={this.handleShowDisplayOptionsMenu}
            >
                <Icon src={Assets.misc.settingsIcon} data-tooltip="inherit" />
            </Button>
        );
    };

    private generateConnectionListColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        return this.generateColumnDefinitions(columns.filter((column) => {
            return !connectionGridHiddenColumns.has(column.title);
        }));
    };

    private generateColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        return columns.map((info): ColumnDefinition => {
            let formatter: Formatter | undefined;
            let formatterParams = {};
            const title = columnNameMap.get(info.title) ?? info.title;
            const minWidth = minimumColumnWidth;

            switch (info.dataType.type) {
                case DBDataType.String:
                case DBDataType.Text:
                case DBDataType.MediumText:
                case DBDataType.LongText:
                case DBDataType.Geometry:
                case DBDataType.Point:
                case DBDataType.LineString:
                case DBDataType.Polygon:
                case DBDataType.GeometryCollection:
                case DBDataType.MultiPoint:
                case DBDataType.MultiLineString:
                case DBDataType.MultiPolygon:
                case DBDataType.Json:
                case DBDataType.Enum:
                case DBDataType.Set: {
                    formatter = info.title === "TYPE"
                        ? this.connectionTypeFormatter
                        : this.stringFormatter;
                    break;
                }

                case DBDataType.Date:
                case DBDataType.DateTime: {
                    formatter = "datetime";
                    break;
                }

                case DBDataType.Time: {
                    formatter = "datetime";
                    formatterParams = {
                        outputFormat: "HH:mm:ss",
                    };
                    break;
                }

                case DBDataType.Year: {
                    formatter = "datetime";
                    formatterParams = {
                        outputFormat: "YYYY",
                    };
                    break;
                }

                default: {
                    formatter = "plaintext";
                    break;
                }
            }

            const idType = this.detailIdType(info.title);
            if (idType) {
                formatter = (cell: CellComponent): HTMLElement => {
                    return this.connectionIdPillElement(String(cell.getValue() ?? ""), idType, false, cell);
                };
            }

            const definition: ColumnDefinition = {
                title,
                field: info.field,
                formatter,
                formatterParams,
                minWidth,
                resizable: true,
            };

            const width = this.columnWidths.get(info.field);
            if (width !== undefined) {
                definition.width = width;
            }

            return definition;
        });
    };

    private handleColumnResized = (column: ColumnComponent): void => {
        const field = column.getField();
        if (field) {
            this.columnWidths.set(field, column.getWidth());
            this.savePresentationState();
        }
    };

    private stringFormatter = (cell: CellComponent): string | HTMLElement => {
        let element;
        if (cell.getValue() === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            element = <Icon src={Assets.data.nullIcon} width={30} height={11} />;
            render(element, host);

            return host;
        } else {
            return cell.getValue() as string;
        }
    };

    private connectionTypeFormatter = (cell: CellComponent): string => {
        return this.formatConnectionType(String(cell.getValue() ?? ""));
    };

    private formatConnectionType = (value: string): string => {
        if (value === "FOREGROUND") {
            return "FG";
        } else if (value === "BACKGROUND") {
            return "BG";
        }

        return value;
    };

    private formatProcesslistTime = (formatted: string, seconds: string): string => {
        if (formatted.length > 0 && seconds.length > 0) {
            return `${formatted} (${seconds}s)`;
        }

        return formatted || seconds;
    };

    private updateValues = async (): Promise<void> => {
        if (this.updatingValues) {
            return;
        }

        this.updatingValues = true;
        try {
            if (!this.gotPerformanceSchema) {
                this.gotPerformanceSchema = await this.checkIsPsAvailable();
            }

            if (this.gotPerformanceSchema) {
                await this.updateProcessList();
            }
        } finally {
            this.updatingValues = false;
        }
    };

    private checkIsPsAvailable = async (): Promise<boolean> => {
        const { backend } = this.props;

        if (!backend) {
            return false;
        }

        return backend.isPerformanceSchemaAvailable();
    };

    private updateProcessList = async (): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return Promise.resolve();
        }

        const { globalStatus, version } = this.state;

        const variableNames = version ? "('max_connections')" : "('version_comment', 'max_connections')";
        const variablesPromise = backend.executeService(`show variables where VARIABLE_NAME in ${variableNames}`);
        const statusPromise = backend.executeService(globalStatusQuery);

        const cols: string[] = [];
        columnNameMap.forEach((_value, key) => {
            if (key === "PROCESSLIST_USER") {
                cols.push("IF (NAME = 'thread/sql/event_scheduler'," +
                    "'event_scheduler',t.PROCESSLIST_USER) PROCESSLIST_USER");
            } else if (key === "PROCESSLIST_INFO") {
                cols.push(this.showFullInfoColumn
                    ? "t.PROCESSLIST_INFO"
                    : "LEFT(t.PROCESSLIST_INFO, 255) PROCESSLIST_INFO");
            } else {
                if (key === "ATTR_VALUE") {
                    cols.push(`a.${key}`);
                } else {
                    cols.push(`t.${key}`);
                }
            }
        });
        cols.push("sys.format_time(t.PROCESSLIST_TIME * 1000000000000) PROCESSLIST_TIME_FORMATTED");

        const where = `WHERE 1 = 1` +
            (this.showBackgroundThreads ? "" : " AND t.TYPE <> 'BACKGROUND'") +
            (this.hideSleepingConnections ? " AND t.PROCESSLIST_COMMAND NOT LIKE 'Sleep%'" : "");

        const query = `SELECT ${cols.join(", ")} FROM performance_schema.threads t ` +
            `LEFT OUTER JOIN performance_schema.session_connect_attrs a ON ` +
            `t.processlist_id = a.processlist_id AND (a.attr_name IS NULL OR a.attr_name = 'program_name') ` +
            where;

        const resultId = uuid();
        const resultPromise = backend.executeService(query, undefined, resultId);
        const [variables, result, status] = await Promise.all([variablesPromise, resultPromise, statusPromise]);
        const nextGlobalStatus = { ...globalStatus };
        let nextVersion = version;

        if (variables) {
            const values = new Map<string, string>(variables.rows as Array<[string, string]>);
            nextVersion = version ?? values.get("version_comment") ?? "none";
            nextGlobalStatus.connectionLimit = parseInt(values.get("max_connections") ?? "0", 10);
        }

        if (result) {
            this.columns = generateColumnInfo(DBType.MySQL, result.columns);
            const rows = convertRows(this.columns, result.rows);
            const selectedThreadId = this.getSelectedRowValue("THREAD_ID") || this.state.selectedThreadId;
            const selectedConnectionId = this.getSelectedRowValue("PROCESSLIST_ID") || this.state.selectedConnectionId;
            const threadIdField = this.columns.find((column) => {
                return column.title === "THREAD_ID";
            })?.field;
            const processlistIdField = this.columns.find((column) => {
                return column.title === "PROCESSLIST_ID";
            })?.field;

            if (selectedThreadId && threadIdField) {
                this.selectedRow = rows.find((row) => {
                    const threadId = row[threadIdField];

                    return threadId !== undefined && threadId !== null &&
                        String(threadId) === selectedThreadId;
                });
            } else if (selectedConnectionId && processlistIdField) {
                this.selectedRow = rows.find((row) => {
                    const processlistId = row[processlistIdField];

                    return processlistId !== undefined && processlistId !== null &&
                        String(processlistId) === selectedConnectionId;
                });
            } else {
                this.selectedRow = undefined;
            }
            const resultSet: IResultSet = {
                type: "resultSet",
                resultId,
                sql: query,
                columns: this.columns,
                data: {
                    currentPage: 1,
                    rows,
                },
                updatable: false,
                fullTableName: "",
            };
            const nextSelectedConnectionId = this.getSelectedRowValue("PROCESSLIST_ID") || undefined;
            const nextSelectedThreadId = this.getSelectedRowValue("THREAD_ID") || undefined;
            const inputValue = this.state.connectionIdInputValue;
            const nextConnectionIdInputValue = inputValue === undefined || inputValue === selectedConnectionId
                ? nextSelectedConnectionId
                : inputValue;

            this.setState({
                resultSet,
                gotResponse: true,
                selectedConnectionId: nextSelectedConnectionId,
                selectedThreadId: nextSelectedThreadId,
                connectionIdInputValue: nextConnectionIdInputValue,
            }, () => {
                this.updateSelectedDetailsData();
            });
        }

        if (status) {
            const values = new Map<string, string>(status.rows as Array<[string, string]>);
            nextGlobalStatus.abortedClients = parseInt(values.get("Aborted_clients") ?? "0", 10);
            nextGlobalStatus.abortedConnections = parseInt(values.get("Aborted_connects") ?? "0", 10);
            nextGlobalStatus.threadConnected = parseInt(values.get("Threads_connected") ?? "0", 10);
            nextGlobalStatus.threadsCached = parseInt(values.get("Threads_cached") ?? "0", 10);
            nextGlobalStatus.threadRunning = parseInt(values.get("Threads_running") ?? "0", 10);
            nextGlobalStatus.threadsCreated = parseInt(values.get("Threads_created") ?? "0", 10);

            nextGlobalStatus.rejected = parseInt(values.get("Connection_errors_max_connections") ?? "0", 10);
            nextGlobalStatus.totalConnections = parseInt(values.get("Connections") ?? "0", 10);
            nextGlobalStatus.errors = 0;
        }

        if (variables || status) {
            this.setState({ version: nextVersion, globalStatus: nextGlobalStatus });
        }
    };

    private handleHideSleepConn = (): void => {
        this.hideSleepingConnections = !this.hideSleepingConnections;
        this.savePresentationState();
        void this.updateValues();
    };

    private handleShowBackgroundThreads = (): void => {
        this.showBackgroundThreads = !this.showBackgroundThreads;
        this.savePresentationState();
        void this.updateValues();
    };

    private handleShowFullInfoColumn = (): void => {
        this.showFullInfoColumn = !this.showFullInfoColumn;
        this.savePresentationState();
        void this.updateValues();
    };

    private handleShowDetails = (): void => {
        const { showDetails } = this.state;
        this.setState({ showDetails: !showDetails }, () => {
            this.updateSelectedDetailsData();
        });
    };

    private handleConnectionIdJump = (event: MouseEvent | KeyboardEvent): void => {
        const target = event.currentTarget as HTMLElement;
        const connectionId = target.dataset.connectionId;

        event.stopPropagation();
        if (connectionId) {
            this.jumpToConnection(connectionId);
        }
    };

    private handleConnectionHistoryButton = (event: MouseEvent | KeyboardEvent): void => {
        const target = event.currentTarget as HTMLElement;
        const direction = target.dataset.direction === "back" ? -1 : 1;

        event.stopPropagation();
        this.navigateConnectionHistory(direction);
    };

    private handleShowDisplayOptionsMenu = (event: MouseEvent | KeyboardEvent): void => {
        event.stopPropagation();

        const target = this.displayOptionsButtonRef.current;
        if (!target) {
            return;
        }

        const targetRect = event instanceof KeyboardEvent
            ? target.getBoundingClientRect()
            : this.menuAnchorRect(event.clientX, event.clientY);

        this.displayOptionsMenuRef.current?.close();
        this.displayOptionsMenuRef.current?.open(targetRect, event instanceof KeyboardEvent);
    };

    private menuAnchorRect = (x: number, y: number, width = 2, height = 2): DOMRect => {
        return {
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            toJSON: () => {
                return { x, y, width, height };
            },
        } as DOMRect;
    };

    private handleDisplayOptionsMenuItemClick = (props: IMenuItemProperties): boolean => {
        switch (props.command.command) {
            case "hideSleepingConnections": {
                this.handleHideSleepConn();
                break;
            }

            case "showBackgroundThreads": {
                this.handleShowBackgroundThreads();
                break;
            }

            case "showFullInfoColumn": {
                this.handleShowFullInfoColumn();
                break;
            }

            default:
        }

        return true;
    };

    private handleRefresh = (): void => {
        void this.updateValues();
    };

    private canKillSelectedConnection = (): boolean => {
        return Boolean(this.getSelectedRowValue("PROCESSLIST_ID")) &&
            this.connectionIdInputMatchesSelectedConnection() &&
            !this.isSelectedBackgroundThread();
    };

    private connectionIdInputMatchesSelectedConnection = (): boolean => {
        const selectedConnectionId = this.getSelectedRowValue("PROCESSLIST_ID");
        const inputValue = this.state.connectionIdInputValue ?? selectedConnectionId;

        return Boolean(selectedConnectionId) && inputValue.trim() === selectedConnectionId;
    };

    private setConnectionIdInputValue = (value: string): void => {
        this.setState({ connectionIdInputValue: value });
    };

    private handleConnectionIdInput = (event: Event): void => {
        this.setConnectionIdInputValue((event.currentTarget as HTMLInputElement).value);
    };

    private handleConnectionIdInputKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Enter") {
            this.selectEnteredConnectionId((event.currentTarget as HTMLInputElement).value);
        }
    };

    private selectEnteredConnectionId = (value = this.state.connectionIdInputValue ?? ""): void => {
        const connectionId = value.trim();
        const row = this.findConnectionRow("PROCESSLIST_ID", connectionId);
        if (!row) {
            return;
        }

        if (connectionId === this.getSelectedRowValue("PROCESSLIST_ID")) {
            this.setConnectionIdInputValue(connectionId);

            return;
        }

        this.jumpToConnection(connectionId);
    };

    private isSelectedBackgroundThread = (): boolean => {
        return this.getSelectedRowValue("TYPE") === "BACKGROUND";
    };

    private handleKillConnection = (): void => {
        if (this.isSelectedBackgroundThread()) {
            void ui.showErrorMessage(`Connection ${this.getSelectedRowValue("PROCESSLIST_ID")} ` +
                `cannot be killed`, {});

            return;
        }
        void this.confirmKill("Do you want to kill selected connection?", this.killConnection);
    };

    private handleKillQuery = (): void => {
        if (this.isSelectedBackgroundThread()) {
            void ui.showErrorMessage(`Thread ${this.getSelectedRowValue("THREAD_ID")} cannot be killed`, {});

            return;
        }
        void this.confirmKill("Do you want to kill selected query?", this.killQuery);
    };

    private confirmKill = async (prompt: string, action: () => Promise<void>): Promise<void> => {
        const response = await DialogHost.showDialog({
            id: "clientConnectionsConfirmDialog",
            type: DialogType.Confirm,
            parameters: {
                title: "MySQL Client Connections",
                prompt,
                accept: "Kill",
                refuse: "Cancel",
                default: "Cancel",
            },
        });

        if (response.closure === DialogResponseClosure.Accept) {
            await action();
        }
    };

    private killConnection = async (): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const id = this.getSelectedRowValue("PROCESSLIST_ID");
        if (id) {
            try {
                await backend.executeService(`KILL CONNECTION ${id}`);
                await this.updateValues();
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error executing KILL CONNECTION on connectionId: ${id}, ` +
                    `error: ${message}`, {});
            }
        }
    };

    private killQuery = async (): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const id = this.getSelectedRowValue("PROCESSLIST_ID");
        if (id) {
            try {
                await backend.executeService(`KILL QUERY ${id}`);
                await this.updateValues();
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error executing KILL QUERY on threadId:` +
                    `${this.selectedRow?.THREAD_ID as string}, error: ${message}`, {});
            }
        }
    };

    private handleTimeRangeSelection = async (accept: boolean, selectedIds: Set<string>): Promise<void> => {
        const refreshInterval = parseInt([...selectedIds][0], 10) * 1000;
        this.setState({ refreshInterval }, () => {
            this.updateRefreshTimer(false);
        });

        await this.updateValues();
    };

    private getSelectedRowValue = (key: string): string => {
        const value = this.getSelectedRowRawValue(key);

        return value === undefined || value === null ? "" : String(value);
    };

    private getSelectedRowRawValue = (key: string): unknown => {
        if (key && this.selectedRow) {
            const field = this.columns.find((x) => {
                return x.title === key;
            });
            if (field) {
                return this.selectedRow[field.field];
            }
        }

        return undefined;
    };

    private savePresentationState = (): void => {
        const { onStateChange } = this.props;
        if (!onStateChange) {
            return;
        }

        onStateChange({
            showDetails: this.state.showDetails,
            selectedTab: this.state.selectedTab,
            selectedConnectionId: this.state.selectedConnectionId,
            selectedThreadId: this.state.selectedThreadId,
            connectionIdInputValue: this.state.connectionIdInputValue,
            detailsWidth: this.state.detailsWidth,
            hideSleepingConnections: this.hideSleepingConnections,
            showBackgroundThreads: this.showBackgroundThreads,
            showFullInfoColumn: this.showFullInfoColumn,
            connectionJumpHistory: [...this.connectionJumpHistory],
            connectionJumpHistoryIndex: this.connectionJumpHistoryIndex,
            columnWidths: [...this.columnWidths],
        });
    };

    private jumpToConnection = (connectionId: string): void => {
        const currentConnectionId = this.getSelectedRowValue("PROCESSLIST_ID");
        const row = this.findConnectionRow("PROCESSLIST_ID", connectionId);
        if (!row || connectionId === currentConnectionId) {
            return;
        }

        this.recordConnectionHistoryNavigation(currentConnectionId, connectionId);
        this.selectConnectionRow(row);
    };

    private recordConnectionHistoryNavigation = (currentConnectionId: string, targetConnectionId: string): void => {
        const history = this.connectionJumpHistory.slice(
            0,
            Math.max(this.connectionJumpHistoryIndex + 1, 0),
        );
        if (currentConnectionId && history.at(-1) !== currentConnectionId) {
            history.push(currentConnectionId);
        }
        if (targetConnectionId && history.at(-1) !== targetConnectionId) {
            history.push(targetConnectionId);
        }

        this.connectionJumpHistory = history;
        this.connectionJumpHistoryIndex = history.length - 1;
        this.savePresentationState();
    };

    private canNavigateConnectionHistory = (direction: -1 | 1): boolean => {
        const targetIndex = this.connectionJumpHistoryIndex + direction;
        const targetConnectionId = this.connectionJumpHistory[targetIndex];

        return targetIndex >= 0 &&
            targetIndex < this.connectionJumpHistory.length &&
            this.findConnectionRow("PROCESSLIST_ID", targetConnectionId) !== undefined;
    };

    private navigateConnectionHistory = (direction: -1 | 1): void => {
        if (!this.canNavigateConnectionHistory(direction)) {
            return;
        }

        this.connectionJumpHistoryIndex += direction;
        const connectionId = this.connectionJumpHistory[this.connectionJumpHistoryIndex];
        const row = this.findConnectionRow("PROCESSLIST_ID", connectionId);
        if (row) {
            this.selectConnectionRow(row);
        }
    };

    private selectConnectionRow = (row: IDictionary): void => {
        this.selectedRow = row;
        const selectedConnectionId = this.getSelectedRowValue("PROCESSLIST_ID");
        const selectedThreadId = this.getSelectedRowValue("THREAD_ID");
        this.setState({ selectedConnectionId, selectedThreadId, connectionIdInputValue: selectedConnectionId }, () => {
            this.updateSelectedDetailsData();
        });
    };

    private handleClientConnectionTreeRowSelected = (row: RowComponent): void => {
        const selectedOldRowId = this.getSelectedRowValue("PROCESSLIST_ID");
        const selectedOldThreadId = this.getSelectedRowValue("THREAD_ID");
        this.selectedRow = row.getData() as IDictionary;
        const selectedNewRowId = this.getSelectedRowValue("PROCESSLIST_ID");
        const selectedNewThreadId = this.getSelectedRowValue("THREAD_ID");
        if (selectedOldThreadId !== selectedNewThreadId) {
            if (selectedOldRowId !== selectedNewRowId) {
                this.recordConnectionHistoryNavigation(selectedOldRowId, selectedNewRowId);
            }
            this.setState({
                selectedConnectionId: selectedNewRowId,
                selectedThreadId: selectedNewThreadId,
                connectionIdInputValue: selectedNewRowId,
            });
            this.updateSelectedDetailsData();
        }
    };

    private updateSelectedDetailsData = (): void => {
        const { selectedTab } = this.state;
        if (!this.canQuerySidebarDetails()) {
            return;
        }

        const currentSelectedRow = this.getSelectedRowValue("PROCESSLIST_ID");
        const currentSelectedThread = this.getSelectedRowValue("THREAD_ID");

        if (selectedTab === "currentStatementTab" && currentSelectedRow) {
            void this.updateCurrentStatementData(currentSelectedRow);
        } else if (selectedTab === "statementHistoryTab" && currentSelectedRow) {
            void this.updateStatementHistoryData(currentSelectedRow);
        } else if (selectedTab === "locksTab" && currentSelectedThread) {
            void this.updateLocks(parseInt(currentSelectedThread, 10));
        } else if (selectedTab === "summaryTab" && currentSelectedThread) {
            void this.updateSummaryData(currentSelectedThread);
        } else if (selectedTab === "propsTab" && currentSelectedRow && currentSelectedThread) {
            void this.updateDetailsData(currentSelectedThread, currentSelectedRow);
        }
    };

    private canQuerySidebarDetails = (): boolean => {
        const { showDetails } = this.state;

        return showDetails && this.selectedRow !== undefined;
    };

    private handleDetailsPaneResized = (info: ISplitterPaneSizeInfo[]): void => {
        const detailsPane = info.find((entry) => {
            return entry.id === "connectionDetails";
        });

        if (detailsPane) {
            this.setState({ detailsWidth: detailsPane.currentSize });
        }
    };

    private updateAttributes = async (id: string): Promise<void> => {
        const { backend } = this.props;
        if (!backend || !this.canQuerySidebarDetails()) {
            return;
        }

        const resultId = uuid();
        const query = `SELECT * FROM performance_schema.session_connect_attrs` +
            ` WHERE processlist_id = ${id} ORDER BY ORDINAL_POSITION`;
        const result = await backend.executeService(query, undefined, resultId);
        if (result) {
            this.attrColumns = generateColumnInfo(DBType.MySQL, result.columns);
            const rows = convertRows(this.attrColumns, result.rows);
            const resultSet: IResultSet = {
                type: "resultSet",
                resultId,
                sql: query,
                columns: this.attrColumns,
                data: {
                    currentPage: 1,
                    rows,
                },
                updatable: false,
                fullTableName: "",
            };
            this.setState({ attributes: resultSet });
        }

    };

    private updateDetailsData = async (threadId: string, processlistId: string): Promise<void> => {
        const { backend } = this.props;
        const { selectedTab } = this.state;
        if (!backend || !this.canQuerySidebarDetails() || selectedTab !== "propsTab") {
            return;
        }

        const transactionQuery = `SELECT STATE as state, sys.format_time(TIMER_WAIT) as elapsedTime, ` +
            `ACCESS_MODE as accessMode, ISOLATION_LEVEL as isolationLevel ` +
            `FROM performance_schema.events_transactions_current WHERE THREAD_ID = ${threadId}`;
        const fullInfoQuery = `SELECT THREAD_ID as threadId, PROCESSLIST_INFO as processlistInfo ` +
            `FROM performance_schema.threads WHERE THREAD_ID = ${threadId}`;
        const attributesPromise = this.updateAttributes(processlistId);
        const [fullConnectionInfo, transactionDetails] = await Promise.all([
            this.executeDetailsQuery(fullInfoQuery),
            this.executeDetailsQuery(transactionQuery),
        ]);
        await attributesPromise;
        this.setState({
            detailsThreadId: threadId, fullConnectionInfo, transactionDetails,
        });
    };

    private updateCurrentStatementData = async (processlistId: string): Promise<void> => {
        const { backend } = this.props;
        const { selectedTab } = this.state;
        if (!this.canQuerySidebarDetails() || selectedTab !== "currentStatementTab") {
            return;
        }

        if (!backend) {
            return;
        }

        const currentColumns = await this.getPerformanceSchemaColumns("events_statements_current");
        const currentStartTime = currentColumns.has("TIMER_START")
            ? `CASE WHEN uptime.VARIABLE_VALUE IS NULL THEN NULL ` +
            `ELSE DATE_FORMAT(DATE_ADD(DATE_SUB(NOW(6), INTERVAL uptime.VARIABLE_VALUE SECOND), ` +
            `INTERVAL esc.TIMER_START / 1000000000000 SECOND), '%Y-%m-%d %H:%i:%s.%f') END`
            : "NULL";
        const currentElapsedTime = currentColumns.has("TIMER_WAIT")
            ? "sys.format_time(esc.TIMER_WAIT)"
            : "sys.format_time(t.PROCESSLIST_TIME * 1000000000000)";
        const currentSqlText = currentColumns.has("SQL_TEXT")
            ? "COALESCE(esc.SQL_TEXT, t.PROCESSLIST_INFO)"
            : "t.PROCESSLIST_INFO";
        const currentStatementActive = currentColumns.has("END_EVENT_ID")
            ? "CASE WHEN esc.THREAD_ID IS NOT NULL AND esc.END_EVENT_ID IS NULL THEN 1 ELSE 0 END"
            : "CASE WHEN esc.THREAD_ID IS NOT NULL THEN 1 ELSE 0 END";

        const currentStatementQuery = `SELECT ${currentStatementActive} as isActive, ` +
            `${currentStartTime} as startTime, ` +
            `${currentElapsedTime} as elapsedTime, ` +
            `${currentSqlText} as sqlText, ` +
            `${this.statementColumn(currentColumns, "esc", "LOCK_TIME", "lockTime", "sys.format_time")}, ` +
            `${this.statementColumn(currentColumns, "esc", "WARNINGS", "warnings")}, ` +
            `${this.statementColumn(currentColumns, "esc", "CREATED_TMP_DISK_TABLES", "createdTmpDiskTables")}, ` +
            `${this.statementColumn(currentColumns, "esc", "CREATED_TMP_TABLES", "createdTmpTables")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SELECT_FULL_JOIN", "selectFullJoin")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SELECT_FULL_RANGE_JOIN", "selectFullRangeJoin")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SELECT_RANGE", "selectRange")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SELECT_RANGE_CHECK", "selectRangeCheck")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SELECT_SCAN", "selectScan")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SORT_MERGE_PASSES", "sortMergePasses")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SORT_RANGE", "sortRange")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SORT_ROWS", "sortRows")}, ` +
            `${this.statementColumn(currentColumns, "esc", "SORT_SCAN", "sortScan")}, ` +
            `${this.statementColumn(currentColumns, "esc", "NO_INDEX_USED", "noIndexUsed")}, ` +
            `${this.statementColumn(currentColumns, "esc", "NO_GOOD_INDEX_USED", "noGoodIndexUsed")}, ` +
            `${this.statementColumn(currentColumns, "esc", "MAX_CONTROLLED_MEMORY", "maxControlledMemory")}, ` +
            `${this.statementColumn(currentColumns, "esc", "MAX_TOTAL_MEMORY", "maxTotalMemory")}, ` +
            `${this.statementColumn(currentColumns, "esc", "EXECUTION_ENGINE", "executionEngine")} ` +
            `FROM performance_schema.threads t ` +
            `LEFT JOIN performance_schema.events_statements_current esc ON esc.THREAD_ID = t.THREAD_ID ` +
            `LEFT JOIN performance_schema.global_status uptime ON LOWER(uptime.VARIABLE_NAME) = 'uptime' ` +
            `WHERE t.PROCESSLIST_ID = ${processlistId}`;
        const currentStatement = await this.executeDetailsQuery(currentStatementQuery);
        this.setState({ currentStatement, currentStatementConnectionId: processlistId });
    };

    private updateStatementHistoryData = async (processlistId: string): Promise<void> => {
        const { backend } = this.props;
        const { selectedTab } = this.state;
        if (!this.canQuerySidebarDetails() || selectedTab !== "statementHistoryTab") {
            return;
        }

        if (!backend) {
            return;
        }

        const historyColumns = await this.getPerformanceSchemaColumns("events_statements_history");
        const historyStartTime = historyColumns.has("TIMER_START")
            ? `CASE WHEN uptime.VARIABLE_VALUE IS NULL THEN NULL ` +
            `ELSE DATE_FORMAT(DATE_ADD(DATE_SUB(NOW(6), INTERVAL uptime.VARIABLE_VALUE SECOND), ` +
            `INTERVAL esh.TIMER_START / 1000000000000 SECOND), '%Y-%m-%d %H:%i:%s.%f') END`
            : "NULL";
        const historyError = historyColumns.has("MYSQL_ERRNO") && historyColumns.has("MESSAGE_TEXT")
            ? `CASE WHEN esh.MYSQL_ERRNO = 0 THEN NULL ` +
            `ELSE CONCAT(esh.MYSQL_ERRNO, ': ', esh.MESSAGE_TEXT) END`
            : "NULL";

        const query = `SELECT ` +
            `${historyStartTime} as startTime, ` +
            `${this.statementColumn(historyColumns, "esh", "TIMER_WAIT", "elapsedTime", "sys.format_time")}, ` +
            `${this.statementColumn(historyColumns, "esh", "SQL_TEXT", "sqlText")}, ` +
            `${historyError} as \`error\` ` +
            `FROM performance_schema.threads t ` +
            `JOIN performance_schema.events_statements_history esh ON esh.THREAD_ID = t.THREAD_ID ` +
            `LEFT JOIN performance_schema.global_status uptime ON LOWER(uptime.VARIABLE_NAME) = 'uptime' ` +
            `WHERE t.PROCESSLIST_ID = ${processlistId} ORDER BY esh.EVENT_ID DESC`;
        const statementHistory = await this.executeDetailsQuery(query);
        this.setState({ statementHistory, statementHistoryConnectionId: processlistId });
    };

    private updateSummaryData = async (threadId: string): Promise<void> => {
        const { backend } = this.props;
        const { selectedTab } = this.state;
        if (!backend || !this.canQuerySidebarDetails() || selectedTab !== "summaryTab") {
            return;
        }

        const errorsQuery = `SELECT COALESCE(ERROR_NAME, CAST(ERROR_NUMBER AS CHAR)) as eventName, ` +
            "SUM_ERROR_RAISED as `count`, SUM_ERROR_HANDLED as handled, SQL_STATE as `sqlState` " +
            `FROM performance_schema.events_errors_summary_by_thread_by_error ` +
            `WHERE THREAD_ID = ${threadId} AND (SUM_ERROR_RAISED > 0 OR SUM_ERROR_HANDLED > 0) ` +
            `ORDER BY SUM_ERROR_RAISED DESC, SUM_ERROR_HANDLED DESC LIMIT 5`;
        const stagesQuery = this.threadEventSummaryQuery(
            "performance_schema.events_stages_summary_by_thread_by_event_name",
            threadId,
        );
        const statementsQuery = this.threadEventSummaryQuery(
            "performance_schema.events_statements_summary_by_thread_by_event_name",
            threadId,
        );
        const transactionsQuery = this.threadEventSummaryQuery(
            "performance_schema.events_transactions_summary_by_thread_by_event_name",
            threadId,
        );
        const waitsQuery = this.threadEventSummaryQuery(
            "performance_schema.events_waits_summary_by_thread_by_event_name",
            threadId,
        );
        const memoryQuery = `SELECT t.THREAD_ID as threadId, ` +
            "COALESCE(m.user, CONCAT_WS('@', t.PROCESSLIST_USER, t.PROCESSLIST_HOST)) as `user`, " +
            `COALESCE(m.current_count_used, 0) as currentCountUsed, ` +
            `COALESCE(m.current_allocated, sys.format_bytes(0)) as currentAllocated, ` +
            `COALESCE(m.current_avg_alloc, sys.format_bytes(0)) as currentAverageAllocation, ` +
            `COALESCE(m.current_max_alloc, sys.format_bytes(0)) as currentMaximumAllocation, ` +
            `COALESCE(m.total_allocated, sys.format_bytes(0)) as totalAllocated ` +
            `FROM performance_schema.threads t ` +
            `LEFT JOIN sys.memory_by_thread_by_current_bytes m ON m.thread_id = t.THREAD_ID ` +
            `WHERE t.THREAD_ID = ${threadId}`;
        const ioQuery = `SELECT t.THREAD_ID as threadId, ` +
            `COALESCE(i.total, 0) as total, ` +
            `COALESCE(i.total_latency, sys.format_time(0)) as totalLatency, ` +
            `COALESCE(i.min_latency, sys.format_time(0)) as minLatency, ` +
            `COALESCE(i.avg_latency, sys.format_time(0)) as avgLatency, ` +
            `COALESCE(i.max_latency, sys.format_time(0)) as maxLatency ` +
            `FROM performance_schema.threads t ` +
            `LEFT JOIN sys.io_by_thread_by_latency i ON i.thread_id = t.THREAD_ID ` +
            `WHERE t.THREAD_ID = ${threadId}`;
        const [
            ioByThread, memoryByThread, summaryErrors, summaryStages, summaryStatements, summaryTransactions,
            summaryWaits,
        ] = await Promise.all([
            this.executeOptionalDetailsQuery(ioQuery),
            this.executeOptionalDetailsQuery(memoryQuery),
            this.executeOptionalDetailsQuery(errorsQuery),
            this.executeOptionalDetailsQuery(stagesQuery),
            this.executeOptionalDetailsQuery(statementsQuery),
            this.executeOptionalDetailsQuery(transactionsQuery),
            this.executeOptionalDetailsQuery(waitsQuery),
        ]);

        this.setState({
            ioByThread,
            memoryByThread,
            summaryErrors,
            summaryStages,
            summaryStatements,
            summaryThreadId: threadId,
            summaryTransactions,
            summaryWaits,
        });
    };

    private threadEventSummaryQuery = (tableName: string, threadId: string): string => {
        return "SELECT EVENT_NAME as eventName, COUNT_STAR as `count`, " +
            `sys.format_time(SUM_TIMER_WAIT) as totalLatency, ` +
            `sys.format_time(AVG_TIMER_WAIT) as avgLatency, ` +
            `sys.format_time(MAX_TIMER_WAIT) as maxLatency ` +
            `FROM ${tableName} ` +
            `WHERE THREAD_ID = ${threadId} AND COUNT_STAR > 0 ` +
            `ORDER BY SUM_TIMER_WAIT DESC, COUNT_STAR DESC LIMIT 5`;
    };

    private executeOptionalDetailsQuery = async (query: string): Promise<IResultSet | undefined> => {
        try {
            return await this.executeDetailsQuery(query);
        } catch {
            return undefined;
        }
    };

    private getPerformanceSchemaColumns = async (tableName: string): Promise<Set<string>> => {
        const { backend } = this.props;
        if (!backend) {
            return new Set();
        }

        const result = await backend.executeService(`SELECT COLUMN_NAME FROM information_schema.columns ` +
            `WHERE TABLE_SCHEMA = 'performance_schema' AND TABLE_NAME = '${tableName}'`);

        return new Set((result?.rows as Array<[string]> | undefined)?.map(([column]) => {
            return column;
        }) ?? []);
    };

    private statementColumn = (
        columns: Set<string>, tableAlias: string, columnName: string, alias: string, formatter?: string,
    ): string => {
        if (!columns.has(columnName)) {
            return `NULL as \`${alias}\``;
        }

        const value = `${tableAlias}.${columnName}`;

        return `${formatter ? `${formatter}(${value})` : value} as \`${alias}\``;
    };

    private executeDetailsQuery = async (query: string): Promise<IResultSet | undefined> => {
        const { backend } = this.props;
        if (!backend) {
            return undefined;
        }

        const resultId = uuid();
        const result = await backend.executeService(query, undefined, resultId);
        if (!result) {
            return undefined;
        }

        const columns = generateColumnInfo(DBType.MySQL, result.columns);

        return {
            type: "resultSet",
            resultId,
            sql: query,
            columns,
            data: {
                currentPage: 1,
                rows: convertRows(columns, result.rows),
            },
            updatable: false,
            fullTableName: "",
        };
    };

    private updateLocks = async (id: number): Promise<void> => {
        const { backend } = this.props;
        if (!backend || !this.canQuerySidebarDetails()) {
            return;
        }

        const processlistId = this.getSelectedRowValue("PROCESSLIST_ID");
        const objectName = `CASE WHEN ml.OBJECT_TYPE = 'GLOBAL' THEN '<global>' ` +
            `ELSE CONCAT_WS('.', ml.OBJECT_SCHEMA, ml.OBJECT_NAME) END`;
        const matchingObject = `pending.OBJECT_TYPE <=> ml.OBJECT_TYPE ` +
            `AND pending.OBJECT_SCHEMA <=> ml.OBJECT_SCHEMA ` +
            `AND pending.OBJECT_NAME <=> ml.OBJECT_NAME`;

        const holdingQuery = `SELECT ${objectName} as objectName, ml.LOCK_TYPE as lockType, ` +
            `ml.LOCK_DURATION as duration, wt.PROCESSLIST_ID as waitingConnectionId, ` +
            `wt.PROCESSLIST_USER as waitingUser, wt.PROCESSLIST_HOST as waitingHost, ` +
            `wt.PROCESSLIST_TIME as waitingTime ` +
            `FROM performance_schema.metadata_locks ml ` +
            `LEFT JOIN performance_schema.metadata_locks pending ON ${matchingObject} ` +
            `AND pending.LOCK_STATUS = 'PENDING' ` +
            `LEFT JOIN performance_schema.threads wt ON wt.THREAD_ID = pending.OWNER_THREAD_ID ` +
            `WHERE ml.OWNER_THREAD_ID = ${id} AND ml.LOCK_STATUS = 'GRANTED'`;
        const holderDisplay = `CONCAT(ht.PROCESSLIST_ID, ' (tid: ', ht.THREAD_ID, ')')`;
        const waitingQuery = `SELECT ${objectName} as objectName, ml.LOCK_TYPE as lockType, ` +
            `ml.LOCK_DURATION as duration, ${holderDisplay} as holderDisplay, ` +
            `ht.PROCESSLIST_ID as holderConnectionId, ht.THREAD_ID as holderThreadId, ` +
            `ht.PROCESSLIST_USER as holderUser, ht.PROCESSLIST_HOST as holderHost, ` +
            `sys.format_time(ht.PROCESSLIST_TIME * 1000000000000) as holderTime, ` +
            `ht.PROCESSLIST_STATE as holderState ` +
            `FROM performance_schema.metadata_locks ml ` +
            `LEFT JOIN performance_schema.metadata_locks granted ON ` +
            `granted.OBJECT_TYPE <=> ml.OBJECT_TYPE ` +
            `AND granted.OBJECT_SCHEMA <=> ml.OBJECT_SCHEMA ` +
            `AND granted.OBJECT_NAME <=> ml.OBJECT_NAME ` +
            `AND granted.LOCK_STATUS = 'GRANTED' ` +
            `LEFT JOIN performance_schema.threads ht ON ht.THREAD_ID = granted.OWNER_THREAD_ID ` +
            `WHERE ml.OWNER_THREAD_ID = ${id} AND ml.LOCK_STATUS = 'PENDING'`;
        const innodbRole = `CASE WHEN waiting_pid = ${processlistId} THEN 'waiting' ELSE 'blocking' END`;
        const innodbQuery = `SELECT ${innodbRole} as \`role\`, ` +
            `locked_table as lockedTable, locked_index as lockedIndex, wait_age as waitAge, ` +
            `blocking_trx_age as blockingTrxAge, ` +
            `waiting_pid as waitingPid, blocking_pid as blockingPid, ` +
            `waiting_query as waitingQuery, blocking_query as blockingQuery ` +
            `FROM sys.innodb_lock_waits WHERE waiting_pid = ${processlistId} OR blocking_pid = ${processlistId}`;

        try {
            const [holding, waiting] = await Promise.all([
                this.executeDetailsQuery(holdingQuery),
                this.executeDetailsQuery(waitingQuery),
            ]);

            let innodbRowLocks: IResultSet | undefined;
            let innodbRowLocksError: string | undefined;
            try {
                innodbRowLocks = await this.executeDetailsQuery(innodbQuery);
            } catch (error) {
                innodbRowLocksError = convertErrorToString(error);
            }

            this.setState({
                innodbRowLocks,
                innodbRowLocksError,
                locksThreadId: String(id),
                metadataLocksHolding: holding,
                metadataLocksWaiting: waiting,
            });
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`Error looking up metadata lock information error: ${message}`, {});
        }
    };

    private escapeSqlString = (value: string): string => {
        // eslint-disable-next-line no-control-regex
        return value.replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, ((char) => {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\" + char;
                default:
                    return char;
            }
        }));
    };

    private handleSelectTab = (id: string): void => {
        const {
            currentStatementConnectionId, detailsThreadId, locksThreadId, statementHistoryConnectionId, summaryThreadId,
        } = this.state;
        const currentSelectedRow = this.getSelectedRowValue("PROCESSLIST_ID");
        const currentSelectedThread = this.getSelectedRowValue("THREAD_ID");

        if (!this.canQuerySidebarDetails() || !currentSelectedRow) {
            this.setState({ selectedTab: id });

            return;
        }

        if (id === "currentStatementTab") {
            if (currentStatementConnectionId !== currentSelectedRow) {
                this.setState({ selectedTab: id }, () => {
                    void this.updateCurrentStatementData(currentSelectedRow);
                });
            } else {
                this.setState({ selectedTab: id });
            }
        } else if (id === "statementHistoryTab") {
            if (statementHistoryConnectionId !== currentSelectedRow) {
                this.setState({ selectedTab: id }, () => {
                    void this.updateStatementHistoryData(currentSelectedRow);
                });
            } else {
                this.setState({ selectedTab: id });
            }
        } else if (id === "locksTab") {
            if (currentSelectedThread && locksThreadId !== currentSelectedThread) {
                void this.updateLocks(parseInt(currentSelectedThread, 10)).then(() => {
                    this.setState({ selectedTab: id });
                });
            } else {
                this.setState({ selectedTab: id });
            }
        } else if (id === "summaryTab") {
            if (currentSelectedThread && summaryThreadId !== currentSelectedThread) {
                this.setState({ selectedTab: id }, () => {
                    void this.updateSummaryData(currentSelectedThread);
                });
            } else {
                this.setState({ selectedTab: id });
            }
        } else if (id === "propsTab") {
            if (currentSelectedThread && detailsThreadId !== currentSelectedThread) {
                this.setState({ selectedTab: id }, () => {
                    void this.updateDetailsData(currentSelectedThread, currentSelectedRow);
                });
            } else {
                this.setState({ selectedTab: id });
            }
        } else {
            this.setState({ selectedTab: id });
        }
    };

    private resultSetHasColumnValue = (
        resultSet: IResultSet | undefined, columnTitle: string, value: string,
    ): boolean => {
        const field = resultSet?.columns.find((x) => {
            return x.title === columnTitle;
        });

        return !!field && resultSet?.data.rows.some((row) => {
            return (row[field.field] as string) === value;
        }) === true;
    };

    private updateRefreshTimer = (stop: boolean): void => {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (!stop) {
            const { refreshInterval } = this.state;
            if (refreshInterval > 0) {
                this.refreshTimer = setInterval(() => {
                    void this.updateValues();
                }, refreshInterval);
            }
        }
    };
}
