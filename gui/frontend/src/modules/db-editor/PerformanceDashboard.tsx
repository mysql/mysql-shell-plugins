/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import clientConnections from "../../assets/images/admin/clientConnections.svg";
import innodb from "../../assets/images/databaseEngine.svg";
import mysql from "../../assets/images/schemaMySQL.svg";

import { ComponentChild } from "preact";

import { GraphHost } from "../../components/graphs/GraphHost.js";
import { ColorScheme, ISavedGraphData, IToolbarItems } from "./index.js";

import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Tabview } from "../../components/ui/Tabview/Tabview.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { formatBytes } from "../../utilities/string-helpers.js";

enum MarkerType {
    None,
    Incoming,
    Outgoing,
    Select,
    DML,
    DDL,
}

// A color scheme consists of 8 colors: receiving, sending, connections, pie value, pie no value, select, DML, DDL.
const colorSchemes = new Map<ColorScheme, string[]>([
    ["classic", ["#42BECC", "#FF8C00", "#6CC190", "#7CC150", "#666666", "#FFC300", "#546FC6", "#C178CD"]],
    ["delectable", ["#334858", "#cd595a", "#94938f", "#a3a7a6", "#dbc5b0", "#f8dfc2", "#f9ebdf", "#ffd4b0"]],
    ["trello", ["#0079bf", "#70b500", "#ff9f1a", "#eb5a46", "#f2d600", "#c377e0", "#ff78cb", "#00c2e0"]],
    ["brewing", ["#E40C2B", "#11ABC1", "#DF3062", "#F5B935", "#4BAC3F", "#8DB48E", "#4D724D", "#44449B"]],
    ["light", ["#A8E6CE", "#DCEDC2", "#FFD3B5", "#FFAAA6", "#FF8C94", "#A8FFCE", "#FFC380", "#A6AAFF"]],
    ["lively", ["#A7226E", "#EC2049", "#F26B38", "#2F9599", "#F7DB4F", "#45ADA8", "#547980", "#C8C8A9"]],
    ["grays", ["#FFFF", "#E7E7E7", "#D1D1D1", "#B6B6B6", "#9B9B9B", "#767676", "#6C6C6C", "#515151"]],
]);


interface IPerformanceDashboardProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;

    graphData: ISavedGraphData;

    /** A value that allows to stop collecting data after there were as many updates as given here. */
    stopAfter?: number;

    onGraphDataChange?: (data: ISavedGraphData) => void;
}

interface IPerformanceDashboardState extends IComponentState {
    graphData: ISavedGraphData;
    mleEnabled: boolean;
    activeTabId: string;
}

const enum Color {
    Receiving = 0,
    Sending,
    Connections,
    PieValue,
    PieNoValue,
    Select,
    DML,
    DDL,
}

export class PerformanceDashboard extends ComponentBase<IPerformanceDashboardProperties, IPerformanceDashboardState> {

    // The interval (in ms) after which new samples are taken.
    private static readonly sampleInterval = 3000;

    private refreshTimer: ReturnType<typeof setInterval> | null = null;

    private hasPSAccess = false;
    private updates = 0;

    private variableNames = [
        "Bytes_received",
        "Bytes_sent",
        "Threads_cached",
        "Threads_connected",
        "Threads_created",
        "Threads_running",
        "Table_open_cache_hits",
        "Table_open_cache_hits",
        "Table_open_cache_misses",

        "Open_files",
        "Open_streams",
        "Open_table_definitions",
        "Open_tables",
        "Opened_table_definitions",
        "Opened_tables",

        "Innodb_buffer_pool_read_requests",
        "Innodb_buffer_pool_write_requests",
        "Innodb_buffer_pool_reads",
        "Innodb_buffer_pool_bytes_data",
        "Innodb_page_size",
        "Innodb_buffer_pool_pages_total",
        "Innodb_os_log_written",
        "Innodb_log_writes",
        "Innodb_dblwr_writes",
        "Innodb_data_written",
        "Innodb_data_read",
        "innodb_log_file_size",
        "Innodb_log_files_in_group",

        "Com_select",
        "Com_insert",
        "Com_update",
        "Com_delete",
        "Com_create_db",
        "Com_create_event",
        "Com_create_function",
        "Com_create_index",
        "Com_create_procedure",
        "Com_create_server",
        "Com_create_table",
        "Com_create_trigger",
        "Com_create_udf",
        "Com_create_user",
        "Com_create_view",
        "Com_alter_db",
        "Com_alter_db_upgrade",
        "Com_alter_event",
        "Com_alter_function",
        "Com_alter_procedure",
        "Com_alter_server",
        "Com_alter_table",
        "Com_alter_tablespace",
        "Com_alter_user",
        "Com_drop_db",
        "Com_drop_event",
        "Com_drop_function",
        "Com_drop_index",
        "Com_drop_procedure",
        "Com_drop_server",
        "Com_drop_table",
        "Com_drop_trigger",
        "Com_drop_user",
        "Com_drop_view",

        "Com_begin",
        "Com_commit",
        "Com_release_savepoint",
        "Com_rollback",
        "Com_rollback_to_savepoint",
        "Com_savepoint",
        "mle_memory_used",
        "mle_status",
        "mle_memory_max",
    ];

    public constructor(props: IPerformanceDashboardProperties) {
        super(props);

        this.state = {
            graphData: {
                timestamp: new Date().getTime(),
                activeColorScheme: "classic",
                displayInterval: 50,
                currentValues: new Map(),
                computedValues: {},
                series: new Map(),
            },
            mleEnabled: false,
            activeTabId: "serverTab",
        };

        // Get the initial values to allow computing changes on each query step.
        // But first check if the user has access to the performance_schema.
        props.backend?.execute("select * from performance_schema.log_status").then(() => {
            this.hasPSAccess = true;
            void this.queryAndUpdate();
        }).catch(() => {
            void this.queryAndUpdate();
        });
    }

    public static override getDerivedStateFromProps(newProps: IPerformanceDashboardProperties,
        state: IPerformanceDashboardState): IPerformanceDashboardState {
        const { graphData } = newProps;

        if (graphData.series.size === 0) {
            // Initial call here. Initialize all fields.
            const maximumSampleCount = 200;

            const date = new Date();
            let timestamp = date.getTime() - maximumSampleCount * PerformanceDashboard.sampleInterval;

            const initialData: IXYDatum[] = [];
            const sqlStatementsData: IXYDatum[] = [];
            for (let i = 0; i < maximumSampleCount; ++i) {
                initialData.push({ xValue: timestamp });

                sqlStatementsData.push({ xValue: timestamp, group: "select" });
                sqlStatementsData.push({ xValue: timestamp, group: "dml" });
                sqlStatementsData.push({ xValue: timestamp, group: "ddl" });

                timestamp += PerformanceDashboard.sampleInterval;
            }

            graphData.computedValues = {
                tableCacheEfficiency: 0,
                threadsCached: 0,
                threadsConnected: 0,
                threadsCreated: 0,
                threadsRunning: 0,

                openFiles: 0,
                openStreams: 0,
                openTableDefinitions: 0,
                openTables: 0,
                openedTableDefinitions: 0,
                openedTables: 0,

                trxBegin: 0,
                trxCommit: 0,
                trxReleaseSavepoint: 0,
                trxRollback: 0,
                trxRollbackToSavepoint: 0,
                trxSavepoint: 0,

                selects: 0,
                creates: 0,
                inserts: 0,
                updates: 0,
                deletes: 0,
                alters: 0,
                drops: 0,
                totalStatements: 0,

                innoDBBufferPoolUsage: -1,
                innoDBBufferReads: 0,
                innoDBBufferWrites: 0,
                innoDBBufferDiskReads: 0,
                innoDBRedoLogDataWritten: 0,
                innoDBRedoLogWrites: 0,
                innoDBDoubleWriteBufferWrites: 0,
                innoDBDataWritten: 0,
                innoDBDataRead: 0,
                innoDBBufferReadRatio: -1,

                checkpointAge: -1,
            };

            graphData.series = new Map([
                ["incomingNetworkData", [...initialData]],
                ["outgoingNetworkData", [...initialData]],
                ["clientConnectionsData", [...initialData]],
                ["sqlStatementsData", sqlStatementsData],
                ["innoDBDiskWritesData", [...initialData]],
                ["innoDBDiskReadsData", [...initialData]],
                ["mleHeapUsageData", [...initialData]],
            ]);
        }

        return { graphData, mleEnabled: state.mleEnabled, activeTabId: state.activeTabId };
    }

    public override componentDidMount(): void {
        this.refreshTimer = setInterval(() => {
            const { stopAfter } = this.props;

            ++this.updates;
            if (stopAfter && this.updates >= stopAfter && this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }

            void this.queryAndUpdate();
        }, PerformanceDashboard.sampleInterval);
    }

    public override componentWillUnmount(): void {
        const { onGraphDataChange } = this.props;
        const { graphData } = this.state;

        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        onGraphDataChange?.({
            ...graphData,
            series: new Map<string, IXYDatum[]>(),
        });
    }

    public render(): ComponentChild {
        const { toolbarItems, graphData } = this.props;
        const { mleEnabled, activeTabId } = this.state;

        const toolbar = <Toolbar id="dashboardToolbar" dropShadow={false} >
            {toolbarItems?.navigation}
            <Label caption="Graph Colors:" style={{ marginLeft: "8px" }} />
            <Dropdown
                id="graphColorsDropdown"
                selection={graphData.activeColorScheme}
                onSelect={this.handleColorsSelection}
            >
                <DropdownItem caption="Classic" id="classic" />
                <DropdownItem caption="Light" id="light" />
                <DropdownItem caption="Lively" id="lively" />
                <DropdownItem caption="Delectable" id="delectable" />
                <DropdownItem caption="Trello" id="trello" />
                <DropdownItem caption="Brewing" id="brewing" />
                <DropdownItem caption="Gray Tones" id="grays" />
            </Dropdown>
            <Label caption="Time Range:" />
            <Dropdown
                id="timeRangeDropdown"
                selection={String(graphData.displayInterval)}
                onSelect={this.handleTimeRangeSelection}
            >
                <DropdownItem caption="150 sec" id="50" />
                <DropdownItem caption="5 min" id="100" />
                <DropdownItem caption="10 min" id="200" />
            </Dropdown>
            <div className="expander" />
            {toolbarItems?.auxillary}
        </Toolbar>;


        const className = this.getEffectiveClassNames(["performanceDashboard"]);
        const pages = [
            {
                id: "serverTab",
                caption: "Server Performance",
                tooltip: "MySQL Server Performance",
                content: (
                    <Grid
                        id="dashboardGrid"
                        columns={["33%", "33%", "33%"]}
                        equalHeight={false}
                        columnGap={12}
                        rowGap={30}
                    >
                        {this.renderNetworkStatus(1)}
                        {this.renderMySQLStatus(2)}
                        {this.renderInnoDBStatus(3)}
                    </Grid>
                ),
            },
            {
                id: "mleTab",
                caption: "MLE Performance",
                tooltip: "MLE Performance",
                content: (
                    <Grid
                        id="dashboardGrid"
                        columns={["33%", "33%", "33%"]}
                        equalHeight={false}
                        columnGap={12}
                        rowGap={30}
                    >
                        {this.renderMleStatus(1)}
                    </Grid>
                ),
            },
        ];

        return <Container
                className={className}
                orientation={Orientation.TopDown}
            >
                {toolbar}
                <Tabview
                    showTabs={mleEnabled}
                    pages={pages}
                    selectedId={activeTabId}
                    onSelectTab={this.handleSelectTab}
                />
            </Container>;
    }

    private handleSelectTab = (id: string): void => {
        this.setState({ activeTabId: id });
    };

    private renderNetworkStatus(gridColumn: number): ComponentChild[] {
        const { graphData } = this.state;

        const colors = colorSchemes.get(graphData.activeColorScheme)!;
        const incomingNetworkData = graphData.series.get("incomingNetworkData") ?? [];
        const outgoingNetworkData = graphData.series.get("outgoingNetworkData") ?? [];
        const clientConnectionsData = graphData.series.get("clientConnectionsData") ?? [];

        const timestamp = new Date().getTime();
        const xDomain: [number, number] = [
            timestamp - PerformanceDashboard.sampleInterval * graphData.displayInterval,
            timestamp,
        ];
        let yDomain = this.findYDomainValues(incomingNetworkData, 0);

        const incomingGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "networkStatus1",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Receiving]],
                    marginLeft: 80,
                    xDomain,
                    yDomain,
                    yFormat: this.formatTrafficValue,
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.trafficTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: incomingNetworkData,
                },
            ],

        };

        yDomain = this.findYDomainValues(outgoingNetworkData, 0);
        const outgoingGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "networkStatus2",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Sending]],
                    marginLeft: 80,
                    xDomain,
                    yDomain,
                    yFormat: this.formatTrafficValue,
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.trafficTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: outgoingNetworkData,
                },
            ],
        };

        const connectionsGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "networkStatus3",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Connections]],
                    marginLeft: 80,
                    xDomain,
                    curve: "StepBefore",
                    yTickCount: 6,
                    tooltip: this.connectionsTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: clientConnectionsData,
                },
            ],
        };

        const currentIncoming = incomingNetworkData[incomingNetworkData.length - 1].yValue ?? 0;
        const currentOutgoing = outgoingNetworkData[outgoingNetworkData.length - 1].yValue ?? 0;

        const cells: ComponentChild[] = [];
        cells.push(
            <GridCell
                className="title"
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 1 }}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon className="sectionIcon" src={clientConnections} />
                <Label>Network Status</Label>
                <Label>
                    Statistics for network traffic sent and received by the MySQL server over the client connections.
                </Label>
            </GridCell >,
            <GridCell className="separated" orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 2 }}>
                <Label className="subTitle">Incoming Network Traffic</Label>
                <GraphHost
                    options={incomingGraphOptions}
                />
                {this.renderNameValuePair("Incoming Data", this.formatTrafficValue(currentIncoming),
                    MarkerType.Incoming, "Number of bytes received by the MySQL server at the network level.")}
            </GridCell >,
            <GridCell className="separated" orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 3 }}>
                <Label className="subTitle">Outgoing Network Traffic</Label>
                <GraphHost
                    options={outgoingGraphOptions}
                />
                {this.renderNameValuePair("Outgoing Data", this.formatTrafficValue(currentOutgoing),
                    MarkerType.Outgoing, "Number of bytes sent by the MySQL server at the network level.")}
            </GridCell>,
            <GridCell className="separated" orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 4 }}>
                <Label className="subTitle">Client Connections</Label>
                <GraphHost
                    options={connectionsGraphOptions}
                />
                <div className="placeholder" />
            </GridCell>,
        );

        return cells;
    }

    private renderMySQLStatus(gridColumn: number): ComponentChild[] {
        const { graphData } = this.state;

        const colors = colorSchemes.get(graphData.activeColorScheme)!;
        const {
            tableCacheEfficiency, selects, inserts, updates, deletes, creates, alters, drops,
            totalStatements, threadsCached, threadsConnected, threadsCreated, threadsRunning,
            openFiles, openStreams, openTableDefinitions, openTables, openedTableDefinitions, openedTables,
            trxBegin, trxCommit, trxReleaseSavepoint, trxRollback, trxRollbackToSavepoint, trxSavepoint,
        } = graphData.computedValues;

        const sqlStatementsData = graphData.series.get("sqlStatementsData");

        const values = [{ name: "Cache Efficiency", value: 0 }, { name: "Cache Misses", value: 0 }];
        if (tableCacheEfficiency > 0) {
            values[0].value = tableCacheEfficiency;
            values[1].value = 1 - tableCacheEfficiency;
        }

        const tableCacheGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "sqlStatus1",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[Color.PieValue], colors[Color.PieNoValue]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltipPercent,
                    data: values,
                },
            ],
        };

        const threadsGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "sqlStatus2",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[0], colors[1], colors[2], colors[5]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltip,
                    data: [
                        { name: "Threads Running", value: threadsRunning },
                        { name: "Threads Connected", value: threadsConnected },
                        { name: "Threads Cached", value: threadsCached },
                        { name: "Threads Created", value: threadsCreated },
                    ],
                },
            ],
        };

        const openFilesGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "sqlStatus3",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[0], colors[1], colors[2], colors[5], colors[3], colors[6]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltip,
                    data: [
                        { name: "Open Files", value: openFiles },
                        { name: "Open Streams", value: openStreams },
                        { name: "Open Table Definitions", value: openTableDefinitions },
                        { name: "Open Tables", value: openTables },
                        { name: "Total Opened Tabled Definitions", value: openedTableDefinitions },
                        { name: "Total Opened Tables", value: openedTables },
                    ],
                },
            ],
        };

        const transactionGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "sqlStatus4",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[0], colors[1], colors[2], colors[5], colors[3], colors[6]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltip,
                    data: [
                        { name: "Begin", value: trxBegin },
                        { name: "Commit", value: trxCommit },
                        { name: "Release Savepoint", value: trxReleaseSavepoint },
                        { name: "Rollback", value: trxRollback },
                        { name: "Rollback to Savepoint", value: trxRollbackToSavepoint },
                        { name: "Savepoint", value: trxSavepoint },
                    ],
                },
            ],
        };

        const timestamp = new Date().getTime();
        const xDomain: [number, number] = [
            timestamp - PerformanceDashboard.sampleInterval * graphData.displayInterval,
            timestamp,
        ];

        const statementsGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "sqlStatus5",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Select], colors[Color.DML], colors[Color.DDL]],
                    marginLeft: 80,
                    xDomain,
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.statementsTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: sqlStatementsData,
                },
            ],
        };

        const cells: ComponentChild[] = [];
        cells.push(
            <GridCell
                className="title"
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 1 }}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon className="sectionIcon" src={mysql} />
                <Label>MySQL Status</Label>
                <Label>
                    Primary MySQL server activity and performance statistics.
                </Label>
            </GridCell>,
            <GridCell className="separated" orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 2 }}>
                <Grid columns={2} rowGap={12} style={{ marginBottom: "8px" }}>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Table Cache</Label>
                        <GraphHost
                            id="tableCacheGraph"
                            options={tableCacheGraphOptions}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Threads</Label>
                        <GraphHost
                            id="threadsGraph"
                            options={threadsGraphOptions}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Open Objects</Label>
                        <GraphHost
                            id="openFilesGraph"
                            options={openFilesGraphOptions}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Transactions</Label>
                        <GraphHost
                            id="transactionGraph"
                            options={transactionGraphOptions}
                        />
                    </GridCell>
                </Grid>
                {this.renderNameValuePair("Cache Efficiency", `${(tableCacheEfficiency * 100).toFixed(0)}%`,
                    MarkerType.None, "Cache for minimizing the number of times MySQL opens database tables when " +
                "accessed.")}

                {this.renderNameValuePair("Total Opened Tables", `${openedTables.toLocaleString("en")}`,
                    MarkerType.None, "Total number of opened tables.")}

                {this.renderNameValuePair("Total Transactions", `${trxBegin.toLocaleString("en")}`,
                    MarkerType.None, "Total number of started transactions.")}

            </GridCell>,
            <GridCell
                className="separated"
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 3 }}
            >
                <Label className="subTitle">SQL Statements Executed</Label>
                <GraphHost
                    options={statementsGraphOptions}
                />
                {this.renderNameValuePair("Total Statements", `${totalStatements}/s`,
                    MarkerType.None, "Total number of statements executed.")}
            </GridCell>,
            <GridCell className="separated" orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 4 }}>
                <Grid id="selectGrid" columns={2}>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("SELECT", `${selects.toFixed(0)}/s`, MarkerType.Select,
                            "SELECT Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}></GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("INSERT", `${inserts.toFixed(0)}/s`, MarkerType.DML,
                            "INSERT Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("CREATE", `${creates.toFixed(0)}/s`, MarkerType.DDL,
                            "CREATE Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("UPDATE", `${updates.toFixed(0)}/s`, MarkerType.DML,
                            "UPDATE Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("ALTER", `${alters.toFixed(0)}/s`, MarkerType.DDL,
                            "ALTER Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("DELETE", `${deletes.toFixed(0)}/s`, MarkerType.DML,
                            "DELETE Statements Executed")}
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        {this.renderNameValuePair("DROP", `${drops.toFixed(0)}/s`, MarkerType.DDL,
                            "DROP Statements Executed")}
                    </GridCell>
                </Grid >
            </GridCell >,
        );

        return cells;
    }

    private renderInnoDBStatus(gridColumn: number): ComponentChild[] {
        const { graphData } = this.state;

        const colors = colorSchemes.get(graphData.activeColorScheme)!;
        const innoDBBufferPoolUsage = graphData.computedValues.innoDBBufferPoolUsage;
        const innoDBBufferReads = graphData.computedValues.innoDBBufferReads;
        const innoDBBufferWrites = graphData.computedValues.innoDBBufferWrites;
        const innoDBBufferDiskReads = graphData.computedValues.innoDBBufferDiskReads;
        const innoDBRedoLogDataWritten = graphData.computedValues.innoDBRedoLogDataWritten;
        const innoDBRedoLogWrites = graphData.computedValues.innoDBRedoLogWrites;
        const innoDBDoubleWriteBufferWrites = graphData.computedValues.innoDBDoubleWriteBufferWrites;
        const innoDBDataWritten = graphData.computedValues.innoDBDataWritten;
        const innoDBDataRead = graphData.computedValues.innoDBDataRead;
        const checkpointAge = graphData.computedValues.checkpointAge;
        const innoDBBufferReadRatio = graphData.computedValues.innoDBBufferReadRatio;

        const innoDBDiskWritesData = graphData.series.get("innoDBDiskWritesData") ?? [];
        const innoDBDiskReadsData = graphData.series.get("innoDBDiskReadsData") ?? [];

        const bufferPoolGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "innoDBStatus1",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    rotation: "0deg",
                    colors: [colors[Color.PieValue], colors[Color.PieNoValue]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltipPercent,
                    data: [
                        { name: "Buffer Pool Usage", value: innoDBBufferPoolUsage < 0 ? 0 : innoDBBufferPoolUsage },
                        { name: "Unused", value: innoDBBufferPoolUsage < 0 ? 0 : 1 - innoDBBufferPoolUsage },
                    ],
                },
            ],
        };

        // A value < 0 indicates that no value has been read yet. Start with all 0 allow an animation when
        // values arrive.
        let sync = checkpointAge < 0 ? 0 : 0.125;
        let async = checkpointAge < 0 ? 0 : 0.125;
        let available = checkpointAge < 0 ? 0 : 1 - checkpointAge - 0.25;
        if (available < 0) {
            async += available;
            available = 0;
        }

        if (async < 0) {
            sync += async;
            async = 0;
        }

        const checkpointAgeGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "innoDBStatus2",
                    type: "pie",
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[0], colors[1], colors[3], colors[5]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltipPercent,
                    data: [
                        { name: "Checkpoint Age", value: checkpointAge < 0 ? 0 : checkpointAge },
                        { name: "Available Range", value: available },
                        { name: "Async Flush Range", value: async },
                        { name: "Sync Flush Range", value: sync },
                    ],
                },
            ],
        };

        const diskReadRatioGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "innoDBStatus3",
                    type: "pie",
                    borderRadius: 8,
                    radius: [60, 130],
                    showValues: false,
                    colors: [colors[Color.PieValue], colors[Color.PieNoValue]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltipPercent,
                    data: [
                        { name: "Disk Reads", value: innoDBBufferReadRatio < 0 ? 0 : innoDBBufferReadRatio },
                        { name: "Memory Reads", value: innoDBBufferReadRatio < 0 ? 0 : 1 - innoDBBufferReadRatio },
                    ],
                },
            ],
        };

        const timestamp = new Date().getTime();
        const xDomain: [number, number] = [
            timestamp - PerformanceDashboard.sampleInterval * graphData.displayInterval,
            timestamp,
        ];

        const diskWritesGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "innoDBStatus4",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Sending]],
                    marginLeft: 80,
                    xDomain,
                    yFormat: this.formatTrafficValue,
                    yDomain: this.findYDomainValues(innoDBDiskWritesData, 0),
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.trafficTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: innoDBDiskWritesData,
                },
            ],
        };

        const diskReadsGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "innoDBStatus5",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Receiving]],
                    marginLeft: 80,
                    xDomain,
                    yFormat: this.formatTrafficValue,
                    yDomain: this.findYDomainValues(innoDBDiskReadsData, 0),
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.trafficTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: innoDBDiskReadsData,
                },
            ],

        };

        const cells: ComponentChild[] = [];
        cells.push(
            <GridCell
                className="title"
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 1 }}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon className="sectionIcon" src={innodb} />
                <Label>InnoDB Status</Label>
                <Label>
                    Overview of the InnoDB buffer pool and disk activity generated by the InnoDB storage engine.
                </Label>
            </GridCell>,
            <GridCell orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 2 }}>
                <Grid columns={2} rowGap={12} equalHeight={true} style={{ marginBottom: "8px" }}>
                    <GridCell orientation={Orientation.TopDown} columnSpan={2} style={{ padding: "0 25%" }}>
                        <Label className="pieTitle">InnoDB Buffer Pool</Label>
                        <GraphHost
                            id="bufferPoolGraph"
                            options={bufferPoolGraphOptions}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Checkpoint Age</Label>
                        <GraphHost
                            id="threadsGraph"
                            options={checkpointAgeGraphOptions}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label className="pieTitle">Disk Read Ratio</Label>
                        <GraphHost
                            id="openFilesGraph"
                            options={diskReadRatioGraphOptions}
                        />
                    </GridCell>
                </Grid>
                {this.renderNameValuePair("Read Requests", `${innoDBBufferReads.toFixed(0)} pages/s`,
                    MarkerType.Incoming, "The number of logical read requests InnoDB has done to the buffer pool.")}
                {this.renderNameValuePair("Write Requests", `${innoDBBufferWrites.toFixed(0)} pages/s`,
                    MarkerType.Outgoing, "The number of logical write requests InnoDB has done to the buffer pool.")}
                {this.renderNameValuePair("Disk Reads", `${innoDBBufferDiskReads.toFixed(0)} #/s`, MarkerType.Incoming,
                    "The number of logical reads that InnoDB could not satisfy from the buffer " +
                    "pool, and had to read directly from the disk.")}
            </GridCell>,
            <GridCell orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 3 }}>
                <Label className="subTitle">InnoDB Disk Writes</Label>
                <GraphHost
                    options={diskWritesGraphOptions}
                />
                {this.renderNameValuePair("Log data written", this.formatTrafficValue(innoDBRedoLogDataWritten),
                    MarkerType.Outgoing, "The number of bytes written to the InnoDB redo log files.")}
                {this.renderNameValuePair("Log writes", `${innoDBRedoLogWrites.toFixed(0)} #/s`, MarkerType.Outgoing,
                    "The number of physical writes to the InnoDB redo log file.")}
                {this.renderNameValuePair("Writing", this.formatTrafficValue(innoDBDataWritten), MarkerType.Incoming,
                    "Total amount of data in bytes written in file operations by the InnoDB storage engine.")}
            </GridCell>,
            <GridCell orientation={Orientation.TopDown} style={{ gridColumn, gridRow: 4 }}>
                <Label className="subTitle">InnoDB Disk Reads</Label>
                <GraphHost
                    options={diskReadsGraphOptions}
                />
                {this.renderNameValuePair("Buffer Writes", this.formatTrafficValue(innoDBDoubleWriteBufferWrites),
                    MarkerType.Outgoing, "The number of double-write operations that have been performed.")}
                {this.renderNameValuePair("Reading", this.formatTrafficValue(innoDBDataRead), MarkerType.Incoming,
                    "Total amount of data in bytes read in file operations by the InnoDB storage engine.")}
            </GridCell>,
        );

        return cells;
    }

    // MLE Component status info
    private renderMleStatus(gridColumn: number): ComponentChild[] {
        const { graphData } = this.state;

        const colors = colorSchemes.get(graphData.activeColorScheme)!;
        const mleMemoryUsed = graphData.currentValues.get("mle_memory_used") as number;
        const mleMemoryUsedPie = mleMemoryUsed / 100;
        const mleStatus = graphData.currentValues.get("mle_status");
        const mleMemoryMax = graphData.currentValues.get("mle_memory_max") as number;

        const mleHeapUsageData = graphData.series.get("mleHeapUsageData") ?? [];

        const values = [
            { name: "Heap usage", value: mleMemoryUsedPie },
            { name: "Unused heap", value: 1 - mleMemoryUsedPie },
        ];

        const heapUsageGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "mleHeapUsage",
                    type: "pie",
                    radius: [70, 150],
                    showValues: false,
                    rotation: "0deg",
                    colors: [colors[0], colors[1]],
                    transformation: { x: "50%", y: "50%", width: 400, height: 300 },
                    tooltip: this.pieTooltipPercent,
                    data: values,
                },
            ],
        };

        const timestamp = new Date().getTime();
        const xDomain: [number, number] = [
            timestamp - PerformanceDashboard.sampleInterval * graphData.displayInterval,
            timestamp,
        ];

        const yDomain = this.findYDomainValues(mleHeapUsageData, 0);

        const mleHeapUtilizationGraphOptions: IGraphOptions = {
            viewport: { left: 0, top: 0, width: 400, height: 300 },
            series: [
                {
                    id: "mleHeapUtilization",
                    type: "line",
                    strokeWidth: 2,
                    colors: [colors[Color.Receiving]],
                    marginLeft: 80,
                    xDomain,
                    yDomain,
                    yFormat: this.formatValueToPercentage,
                    curve: "Linear",
                    yTickCount: 6,
                    tooltip: this.mleHeapUsageTooltip,
                    transformation: { x: 0, y: 0, width: 400, height: 300 },
                    data: mleHeapUsageData,
                },
            ],
        };

        const cells: ComponentChild[] = [];
        cells.push(
            <GridCell
                className="title"
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 1 }}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon className="sectionIcon" src={innodb} />
                <Label>MLE Status</Label>
                <Label>Overview of the MLE Component.</Label>
            </GridCell>,
            <GridCell
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 2 }}
            >
                <Grid columns={1} rowGap={12} equalHeight={true}>
                    <GridCell
                        orientation={Orientation.TopDown}
                        columnSpan={2}
                        style={{ padding: "0 25%" }}
                    >
                        <Label className="pieTitle" style={{ padding: "5% 0" }}>
                        Heap Usage vs Unused heap
                        </Label>
                        <GraphHost
                        id="heapUsageGraph"
                        options={heapUsageGraphOptions}
                        />
                    </GridCell>
                    <GridCell
                        orientation={Orientation.TopDown}
                        style={{ gridRow: 2 }}
                    >
                        {this.renderNameValuePair(
                        "MLE status",
                        `${mleStatus}`,
                        MarkerType.None,
                        "MLE status",
                        )}
                        {this.renderNameValuePair(
                        "MLE max heap size",
                        `${formatBytes(mleMemoryMax)}`,
                        MarkerType.None,
                        "MLE max heap size",
                        )}
                    </GridCell>
                </Grid>
            </GridCell>,
            <GridCell
                orientation={Orientation.TopDown}
                style={{ gridColumn, gridRow: 3 }}
            >
                <Label className="subTitle">MLE Heap utilization</Label>
                <GraphHost options={mleHeapUtilizationGraphOptions} />
                {this.renderNameValuePair(
                "Current Heap Usage",
                this.formatValueToPercentage(mleMemoryUsed),
                MarkerType.None,
                "Current Heap Usage",
                )}
            </GridCell>,
        );

        return cells;
    }

    private renderNameValuePair(name: string, value: string, type: MarkerType, tooltip: string): ComponentChild {
        const { graphData } = this.props;

        const colors = colorSchemes.get(graphData.activeColorScheme)!;

        let marker;
        switch (type) {
            case MarkerType.Select: {
                marker = <Label className="marker" style={{ color: colors[Color.Select] }}>▌</Label>;
                break;
            }

            case MarkerType.DML: {
                marker = <Label className="marker" style={{ color: colors[Color.DML] }}>▌</Label>;
                break;
            }

            case MarkerType.DDL: {
                marker = <Label className="marker" style={{ color: colors[Color.DDL] }}>▌</Label>;
                break;
            }

            default:
        }

        return (
            <Container className="nameValuePair" data-tooltip={tooltip} >
                <Label className="nameLabel ellipsis" data-tooltip="inherit">{name}</Label>
                <Label className="valueLabel ellipsis" data-tooltip="inherit">
                    {value}</Label>
                {marker}
            </Container>
        );
    }

    private async queryAndUpdate(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const list = this.variableNames.join("\",\"");
        try {
            const result = await backend.execute(`show global status where variable_name in ("${list}")`);
            const mleMemoryMax = await backend.execute(`SELECT @@mle.memory_max`);
            if (result && result.rows) {
                const variables = result.rows as Array<[string, string]>;
                try {
                    if (mleMemoryMax && mleMemoryMax.rows) {
                        const mleMemoryMaxValue = mleMemoryMax.rows as Array<[[number]]>;
                        variables.push([
                          "mle_memory_max",
                          mleMemoryMaxValue[0][0].toString(),
                        ]);
                        this.setState({ mleEnabled: true });
                    }
                    variables.forEach((variable) => {
                      if (variable[0] === "mle_memory_used") {
                        const value = Number(variable[1]);
                        if (value > 100) {
                          variable[1] = "100";
                        }
                      }
                    });
                }
                catch(_) {
                  this.setState({ mleEnabled: false });
                }

                if (this.hasPSAccess) {
                    const data = await backend.execute(`SELECT STORAGE_ENGINES->>'$."InnoDB"."LSN"' - ` +
                        `STORAGE_ENGINES->>'$."InnoDB"."LSN_checkpoint"' FROM performance_schema.log_status`);

                    if (data && data.rows && data.rows.length > 0) {
                        const row = data.rows[0] as number[];
                        this.updateData(variables, row[0]);
                    }
                } else {
                    this.updateData(variables);
                }
            }
        } catch (_) {
            // Update with empty data, to show unreachable servers etc.
            this.updateData([]);
        }
    }

    /**
     * Updates all stat values we want to show.
     *
     * @param data The original query data.
     * @param lsnDiff A computed value for the log sequence number.
     */
    private updateData(data: Array<[string, string]>, lsnDiff = 0): void {
        const { onGraphDataChange } = this.props;
        const { graphData } = this.state;

        const oldValues = graphData.currentValues;
        const incomingNetworkData = graphData.series.get("incomingNetworkData") ?? [];
        const outgoingNetworkData = graphData.series.get("outgoingNetworkData") ?? [];
        const clientConnectionsData = graphData.series.get("clientConnectionsData") ?? [];
        const sqlStatementsData = graphData.series.get("sqlStatementsData") ?? [];
        const innoDBDiskWritesData = graphData.series.get("innoDBDiskWritesData") ?? [];
        const innoDBDiskReadsData = graphData.series.get("innoDBDiskReadsData") ?? [];
        const mleHeapUsageData = graphData.series.get("mleHeapUsageData") ?? [];


        const currentValues = this.extractCurrentValues(data);
        const time = new Date();
        const timestamp = time.getTime();

        const timeDiff = (timestamp - graphData.timestamp) / 1000; // In seconds.
        const relativeValue = (name: string): number => {
            const oldValue = oldValues.get(name) ?? currentValues.get(name) ?? 0;
            const newValue = currentValues.get(name) ?? 0;

            return (newValue - oldValue) / timeDiff;
        };

        incomingNetworkData.shift();
        incomingNetworkData.push({
            xValue: timestamp,
            yValue: relativeValue("Bytes_received"),
        });

        outgoingNetworkData.shift();
        outgoingNetworkData.push({
            xValue: timestamp,
            yValue: relativeValue("Bytes_sent"),
        });

        clientConnectionsData.shift();
        clientConnectionsData.push({
            xValue: timestamp,
            yValue: currentValues.get("Threads_connected"),
        });

        mleHeapUsageData.shift();
        mleHeapUsageData.push({
            xValue: timestamp,
            yValue: currentValues.get("mle_memory_used"),
        });

        const threadsCached = currentValues.get("Threads_cached") ?? 0;
        const threadsConnected = currentValues.get("Threads_connected") ?? 0;
        const threadsCreated = currentValues.get("Threads_created") ?? 0;
        const threadsRunning = currentValues.get("Threads_running") ?? 0;

        const openFiles = currentValues.get("Open_files") ?? 0;
        const openStreams = currentValues.get("Open_streams") ?? 0;
        const openTableDefinitions = currentValues.get("Open_table_definitions") ?? 0;
        const openTables = currentValues.get("Open_tables") ?? 0;
        const openedTableDefinitions = currentValues.get("Opened_table_definitions") ?? 0;
        const openedTables = currentValues.get("Opened_tables") ?? 0;

        const trxBegin = currentValues.get("Com_begin") ?? 0;
        const trxCommit = currentValues.get("Com_commit") ?? 0;
        const trxReleaseSavepoint = currentValues.get("Com_release_savepoint") ?? 0;
        const trxRollback = currentValues.get("Com_rollback") ?? 0;
        const trxRollbackToSavepoint = currentValues.get("Com_rollback_to_savepoint") ?? 0;
        const trxSavepoint = currentValues.get("Com_savepoint") ?? 0;

        const selects = Math.round(relativeValue("Com_select"));
        const inserts = Math.round(relativeValue("Com_insert"));
        const updates = Math.round(relativeValue("Com_update"));
        const deletes = Math.round(relativeValue("Com_delete"));
        const creates = Math.round(relativeValue("Com_create_db") + relativeValue("Com_create_event") +
            relativeValue("Com_create_function") + relativeValue("Com_create_index") +
            relativeValue("Com_create_procedure") + relativeValue("Com_create_server") +
            relativeValue("Com_create_table") + relativeValue("Com_create_trigger") + relativeValue("Com_create_udf") +
            relativeValue("Com_create_user") + relativeValue("Com_create_view"));
        const alters = Math.round(relativeValue("Com_alter_db") + relativeValue("Com_alter_db_upgrade") +
            relativeValue("Com_alter_event") + relativeValue("Com_alter_function") +
            relativeValue("Com_alter_procedure") + relativeValue("Com_alter_server") +
            relativeValue("Com_alter_table") + relativeValue("Com_alter_tablespace") + relativeValue("Com_alter_user"));
        const drops = Math.round(relativeValue("Com_drop_db") + relativeValue("Com_drop_event") +
            relativeValue("Com_drop_function") + relativeValue("Com_drop_index") + relativeValue("Com_drop_procedure") +
            relativeValue("Com_drop_server") + relativeValue("Com_drop_table") + relativeValue("Com_drop_trigger") +
            relativeValue("Com_drop_user") + relativeValue("Com_drop_view"));

        const totalStatements = selects + inserts + updates + deletes + creates + alters + drops;

        sqlStatementsData.shift();
        sqlStatementsData.shift();
        sqlStatementsData.shift();
        sqlStatementsData.push({
            xValue: timestamp,
            yValue: selects,
            group: "select",
        });
        sqlStatementsData.push({
            xValue: timestamp,
            yValue: inserts + updates + deletes,
            group: "dml",
        });
        sqlStatementsData.push({
            xValue: timestamp,
            yValue: creates + alters + drops,
            group: "ddl",
        });

        const hits = currentValues.get("Table_open_cache_hits") ?? 0;
        const misses = currentValues.get("Table_open_cache_misses") ?? 1;
        const tableCacheEfficiency = hits / (hits + misses);

        const dataSize = currentValues.get("Innodb_buffer_pool_bytes_data") ?? 0;
        const innoDBPageSize = currentValues.get("Innodb_page_size") ?? 0;
        const totalPageCount = currentValues.get("Innodb_buffer_pool_pages_total") ?? 0;
        const innoDBBufferPoolUsage = dataSize / innoDBPageSize / totalPageCount;

        const innoDBBufferReads = relativeValue("Innodb_buffer_pool_read_requests");
        const innoDBBufferWrites = relativeValue("Innodb_buffer_pool_write_requests");
        const innoDBBufferDiskReads = relativeValue("Innodb_buffer_pool_reads");
        const innoDBBufferReadRatio = innoDBBufferReads === 0 ? 0 : innoDBBufferDiskReads / innoDBBufferReads;

        const innoDBRedoLogDataWritten = relativeValue("Innodb_os_log_written");
        const innoDBRedoLogWrites = relativeValue("Innodb_log_writes");
        const innoDBDoubleWriteBufferWrites = relativeValue("Innodb_dblwr_writes");
        const innoDBDataWritten = relativeValue("Innodb_data_written");
        const innoDBDataRead = relativeValue("Innodb_data_read");

        innoDBDiskWritesData.shift();
        innoDBDiskWritesData.push({
            xValue: timestamp,
            yValue: innoDBDataWritten,
        });

        innoDBDiskReadsData.shift();
        innoDBDiskReadsData.push({
            xValue: timestamp,
            yValue: innoDBDataRead,
        });

        const logFileSize = currentValues.get("Innodb_log_file_size") ?? 1;
        const logFilesInGroup = currentValues.get("Innodb_log_files_in_group") ?? 1;
        const checkpointAge = lsnDiff / logFileSize * logFilesInGroup;

        onGraphDataChange?.({
            timestamp,
            activeColorScheme: graphData.activeColorScheme,
            displayInterval: graphData.displayInterval,
            currentValues,
            computedValues: {
                threadsCached,
                threadsConnected,
                threadsCreated,
                threadsRunning,

                openFiles,
                openStreams,
                openTableDefinitions,
                openTables,
                openedTableDefinitions,
                openedTables,

                trxBegin,
                trxCommit,
                trxReleaseSavepoint,
                trxRollback,
                trxRollbackToSavepoint,
                trxSavepoint,

                tableCacheEfficiency,
                totalStatements,

                selects,
                creates,
                inserts,
                updates,
                deletes,
                alters,
                drops,

                innoDBBufferPoolUsage,
                innoDBBufferReads,
                innoDBBufferWrites,
                innoDBBufferDiskReads,

                innoDBRedoLogDataWritten,
                innoDBRedoLogWrites,
                innoDBDoubleWriteBufferWrites,
                innoDBDataWritten,
                innoDBDataRead,
                innoDBBufferReadRatio,

                checkpointAge,
            },
            series: new Map([
                ["incomingNetworkData", incomingNetworkData],
                ["outgoingNetworkData", outgoingNetworkData],
                ["clientConnectionsData", clientConnectionsData],
                ["sqlStatementsData", sqlStatementsData],
                ["innoDBDiskWritesData", innoDBDiskWritesData],
                ["innoDBDiskReadsData", innoDBDiskReadsData],
                ["mleHeapUsageData", mleHeapUsageData],
            ]),
        });
    }

    private extractCurrentValues(values: Array<[string, string]>): Map<string, number> {
        const variables = new Map(values);

        const result = new Map<string, number>();
        this.variableNames.forEach((name) => {
            const value = Number(variables.get(name));
            if (!isNaN(value)) {
                result.set(name, parseInt(variables.get(name) ?? "0", 10));
            } else {
                result.set(name, variables.get(name) as unknown as number);
            }
        });

        return result;
    }

    private formatTrafficValue = (domainValue: d3.NumberValue): string => {
        return `${formatBytes(domainValue.valueOf())}/s`;
    };

    private formatValueToPercentage = (value: d3.NumberValue): string => {
        return `${Number(value)}%`;
    };

    /**
     * Generates a human readable string from the given time difference.
     *
     * @param diff The time span to print (in milliseconds).
     *
     * @returns The formatted string.
     */
    private formatTimeDifference = (diff: number): string => {
        if (diff < 1000) {
            return "now";
        }

        let seconds = Math.floor(diff / 1000);
        if (seconds < 120) {
            return `${seconds}s ago`;
        }

        let minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;

        if (minutes < 60) {
            if (seconds === 0) {
                return `${minutes}m ago`;
            }

            return `${minutes}m ${seconds}s ago`;
        }

        const hours = Math.floor(minutes / 60);
        minutes = minutes % 60;

        if (minutes === 0) {
            return `${hours}h ago`;
        }

        return `${hours}h ${minutes}m ago`;
    };

    /**
     * Determines the highest domain value in a list of data points
     *
     * @param values The values to check.
     * @param min A value which specifies the minimal value for the domain.
     *
     * @returns The domain values for the given data set, with values rounded towards the nearest outer power of
     *          2 value.
     */
    private findYDomainValues(values: IXYDatum[], min?: number): [number, number] {
        let largest = min ?? -1e100;
        let smallest = min ?? 1e100;

        values.forEach((datum) => {
            if (datum.yValue) {
                if (datum.yValue < smallest) {
                    smallest = datum.yValue;
                }
                if (datum.yValue > largest) {
                    largest = datum.yValue;
                }
            }
        });

        if (smallest > largest) {
            const temp = smallest;
            smallest = largest;
            largest = temp;
        }

        if (smallest !== 0) {
            const smallestSign = Math.sign(smallest);
            smallest = Math.abs(smallest);

            const temp = Math.log(smallest) / Math.log(2);
            const lowerExponent = smallestSign < 0 ? Math.ceil(temp) : Math.floor(temp);

            smallest = smallestSign * Math.pow(2, lowerExponent);
        }

        if (largest !== 0) {
            const largestSign = Math.sign(largest);
            largest = Math.abs(largest);

            const temp = Math.ceil(Math.log(largest) / Math.log(2));
            const upperExponent = largestSign < 0 ? Math.floor(temp) : Math.ceil(temp);

            largest = largestSign * Math.pow(2, upperExponent);
        }

        if (smallest === 0 && largest === 0) {
            return [0, 10];
        }


        return [smallest, largest];
    }

    private get trafficTooltip(): ITooltipOptions {
        return {
            format: (datum): string => {
                if (this.isPieDatum(datum)) {
                    return "";
                }

                if (datum.yValue === undefined) {
                    return "";
                }

                const currentTimestamp = new Date().getTime();
                const timestamp = datum.xValue instanceof Date ? datum.xValue.getTime() : datum.xValue;
                const diff = currentTimestamp - timestamp;

                return `${this.formatTimeDifference(diff)}\n${this.formatTrafficValue(datum.yValue)}`;
            },
            position: { left: 200, top: 20 },
        };
    }

    private get mleHeapUsageTooltip(): ITooltipOptions {
        return {
            format: (datum): string => {
                if (this.isPieDatum(datum)) {
                    return "";
                }

                if (datum.yValue === undefined) {
                    return "";
                }

                const currentTimestamp = new Date().getTime();
                const timestamp = datum.xValue instanceof Date ? datum.xValue.getTime() : datum.xValue;
                const diff = currentTimestamp - timestamp;

                return `${this.formatTimeDifference(diff)}\n${this.formatValueToPercentage(datum.yValue)}`;
            },
            position: { left: 200, top: 20 },
        };
    }

    private get pieTooltip(): ITooltipOptions {
        return {
            format: (datum): string => {
                if (this.isPieDatum(datum)) {
                    const value = datum.value.toLocaleString("en");
                    if (datum.name) {
                        return `${datum.name}: ${value}`;
                    }

                    return `${datum.value}`;
                }

                return "";
            },
        };
    }

    private get pieTooltipPercent(): ITooltipOptions {
        return {
            format: (datum): string => {
                if (this.isPieDatum(datum)) {
                    const value = (datum.value * 100).toFixed(2);
                    if (datum.name) {
                        return `${datum.name}: ${value}%`;
                    }

                    return `${value}%`;
                }

                return "";
            },
        };
    }

    private get connectionsTooltip(): ITooltipOptions {
        return {
            format: (datum): string => {
                if (this.isPieDatum(datum)) {
                    return "";
                }

                if (datum.yValue === undefined) {
                    return "";
                }

                const currentTimestamp = new Date().getTime();
                const timestamp = datum.xValue instanceof Date ? datum.xValue.getTime() : datum.xValue;
                const diff = currentTimestamp - timestamp;

                return `${this.formatTimeDifference(diff)}\n${datum.yValue} connections`;
            },
            position: { left: 200, top: 20 },
        };
    }

    private get statementsTooltip(): ITooltipOptions {
        return {
            format: (datum, index, data?: Array<IXYDatum | IPieDatum>): string => {
                if (this.isPieDatum(datum) || index === undefined || data === undefined) {
                    return "";
                }

                if (datum.yValue === undefined) {
                    return "";
                }

                const currentTimestamp = new Date().getTime();
                const timestamp = datum.xValue instanceof Date ? datum.xValue.getTime() : datum.xValue;
                const diff = currentTimestamp - timestamp;

                // The data contains actually 3 series. There are 3 values (select, DML, DDL) per timestamp.
                index = Math.floor(index / 3) * 3;
                const xyData = data as IXYDatum[];

                return `${this.formatTimeDifference(diff)}\n${xyData[index].yValue!} SELECT\n` +
                    `${xyData[index + 1].yValue!} DML\n${xyData[index + 2].yValue!} DDL`;
            },
            position: { left: 200, top: 20 },
        };
    }

    private isPieDatum(datum: unknown): datum is IPieDatum {
        return (datum as IPieDatum).value !== undefined;
    }

    private handleColorsSelection = (accept: boolean, values: Set<string>): void => {
        const { onGraphDataChange, graphData } = this.props;

        onGraphDataChange?.({ ...graphData, activeColorScheme: [...values][0] as ColorScheme });
    };

    private handleTimeRangeSelection = (accept: boolean, selectedIds: Set<string>): void => {
        const { onGraphDataChange, graphData } = this.props;

        onGraphDataChange?.({ ...graphData, displayInterval: parseInt([...selectedIds][0], 10) });
    };

}
