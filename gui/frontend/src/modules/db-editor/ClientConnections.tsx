/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import nullIcon from "../../assets/images/null.svg";
import mysqlIcon from "../../assets/images/admin/mysql-logo.svg";

import hideSleepConnectionsActiveIcon from "../../assets/images/toolbar/toolbar-sleeping_conns-active.svg";
import hideSleepConnectionsInactiveIcon from "../../assets/images/toolbar/toolbar-sleeping_conns-inactive.svg";
import noFullInfoActiveIcon from "../../assets/images/toolbar/toolbar-info-active.svg";
import noFullInfoInactiveIcon from "../../assets/images/toolbar/toolbar-info-inactive.svg";
import hideBackgroundThreadsActiveIcon from "../../assets/images/toolbar/toolbar-background_threads-active.svg";
import hideBackgroundThreadsInactiveIcon from "../../assets/images/toolbar/toolbar-background_threads-inactive.svg";
import showDetailsActiveIcon from "../../assets/images/toolbar/toolbar-show_details-active.svg";
import showDetailsInactiveIcon from "../../assets/images/toolbar/toolbar-show_details-inactive.svg";
import killConnectionIcon from "../../assets/images/toolbar/toolbar-kill_connection.svg";
import killQueryIcon from "../../assets/images/toolbar/toolbar-kill_query.svg";


import React from "react";
import { IToolbarItems } from ".";
import {
    DBDataType, DialogResponseClosure, DialogType, IColumnInfo, IDialogRequest,
    IDialogResponse, IDictionary,
} from "../../app-logic/Types";
import { ICommResultSetEvent, IPromptReplyBackend } from "../../communication";

import {
    Component, Container, ContentAlignment, IComponentProperties, IComponentState, Icon, ITreeGridOptions,
    Orientation, SelectionType, Tabulator, TreeGrid, Toolbar, Button, Label, Dropdown,
    ContentWrap, Tabview, TabPosition, Grid, GridCell,
} from "../../components/ui";
import { IResultSet } from "../../script-execution";
import { EventType } from "../../supplement/Dispatch";
import { DBType, ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";
import { render } from "preact";
import { convertRows, generateColumnInfo } from "../../supplement";
import { requisitions } from "../../supplement/Requisitions";

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

export interface IClientConnectionsProperties extends IComponentProperties {
    backend: ShellInterfaceSqlEditor;

    // Top level toolbar items, to be integrated with page specific ones.
    toolbarItems?: IToolbarItems;
}

export interface IClientConnectionsState extends IComponentState {
    resultSet: IResultSet;
    gotError: boolean;
    gotResponse: boolean;
    version?: string;
    globalStatus: IGlobalStatus;
    showDetails: boolean;
    selectedTab: string;
    attributes?: IResultSet;
    grantedLocks?: IResultSet;
    waitingText: string;
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
    ["THREAD_ID", "Thread ID"],
    ["TYPE", "Type"],
    ["NAME", "Name"],
    ["PARENT_THREAD_ID", "Parent Thread ID"],
    ["INSTRUMENTED", "Instrumented"],
    ["PROCESSLIST_INFO", "Info"],
]);

export class ClientConnections extends Component<IClientConnectionsProperties, IClientConnectionsState> {

    private static readonly sampleInterval = 5000;
    private refreshTimer: ReturnType<typeof setInterval>;
    private gridRef = React.createRef<TreeGrid>();
    private interval = ClientConnections.sampleInterval;
    private selectedRow?: IDictionary;
    private columns: IColumnInfo[] = [];
    private attrColumns: IColumnInfo[] = [];

    private hideSleepingConnections = true;
    private noFullInfo = false;
    private hideBackgroundThreads = true;

    public constructor(props: IClientConnectionsProperties) {
        super(props);

        this.state = {
            resultSet: {
                head: { requestId: "", sql: "" },
                data: { requestId: "", currentPage: 1, columns: [], rows: [] },
            },
            gotResponse: false,
            gotError: false,
            globalStatus: {},
            showDetails: false,
            selectedTab: "propsTab",
            waitingText: "This connection is not waiting for any locks.",
        };

        this.updateValues();
        this.addHandledProperties("backend");
    }

    public componentDidUpdate(prevProps: IClientConnectionsProperties, _prevState: IComponentState): void {
        const { backend } = this.props;

        // If we reopen a connection a new backend is created then we need to refresh the page.
        if (backend !== prevProps.backend) {
            this.updateValues();
        }
    }

    public componentDidMount(): void {
        this.refreshTimer = setInterval(() => {
            this.updateValues();
        }, ClientConnections.sampleInterval);
        requisitions.register("dialogResponse", this.handleDialogResponse);
    }

    public componentWillUnmount(): void {
        clearInterval(this.refreshTimer);
        requisitions.unregister("dialogResponse", this.handleDialogResponse);
    }

    public render(): React.ReactNode {
        const { toolbarItems } = this.props;
        const { resultSet, gotResponse, version, showDetails, selectedTab } = this.state;

        const className = this.getEffectiveClassNames(["clientConnections"]);

        const field = this.columns.find((x) => { return x.title === "PROCESSLIST_ID"; });

        const options: ITreeGridOptions = {
            layout: "fitColumns",
            verticalGridLines: true,
            horizontalGridLines: true,
            alternatingRowBackgrounds: true,
            selectionType: SelectionType.Single,
            resizableRows: true,
            index: field?.field ?? "0",
        };

        const connectionProps = this.getClientConnectionInfo();

        // If toolbar items are given, render a toolbar with them.
        const toolbar = <Toolbar id="clientConnectionToolbar" dropShadow={false} >
            {toolbarItems?.left}
            {this.toolbarContent()}
            <div className="expander" />
            {toolbarItems?.right}
        </Toolbar>;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
            >
                {toolbar}
                <Container id="contentHost" orientation={Orientation.TopDown}>
                    <Grid columns={2} rowGap={12} columnGap={12}>
                        <GridCell key="cellLogo" className="left">
                            <Icon src={mysqlIcon} id="mysqlLogo" />
                        </GridCell>
                        <GridCell
                            orientation={Orientation.TopDown}
                            key="serverInfo"
                            className="right"
                        >
                            <Label as="h1">Client Connections</Label>
                            <Label as="h2">{version}</Label>
                        </GridCell>
                    </Grid>
                    <Container
                        id="connectionProps"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Start}
                        wrap={ContentWrap.Wrap}
                    >
                        {connectionProps}
                    </Container>
                    <Container id="connectionList" orientation={Orientation.LeftToRight}>
                        {
                            gotResponse && <TreeGrid
                                ref={this.gridRef}
                                style={{ fontSize: "10pt" }}
                                options={options}
                                columns={this.generateColumnDefinitions(resultSet.data.columns)}
                                tableData={resultSet.data.rows}
                                selectedIds={[this.getSelectedRowValue("PROCESSLIST_ID")]}
                                onRowSelected={this.handleClientConnectionTreeRowSelected}
                            />
                        }
                        {
                            showDetails && <Container id="connectionDetails" orientation={Orientation.TopDown}>
                                <Tabview
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
                                            icon: mysqlIcon,
                                        },
                                        {
                                            caption: "Locks",
                                            id: "locksTab",
                                            content: this.getClientConnectionLocks(),
                                            icon: mysqlIcon,
                                        },
                                        {
                                            caption: "Attributes",
                                            id: "attrTab",
                                            content: this.getClientConnectionAttributes(),
                                            icon: mysqlIcon,
                                        },

                                    ]}
                                    selectedId={selectedTab}
                                    stretchTabs={false}
                                    canReorderTabs={false}
                                />
                            </Container>
                        }
                    </Container>
                </Container>
            </Container>
        );
    }

    private getClientConnectionDetails = (): React.ReactNode => {

        return (
            this.selectedRow && <Grid id="clientConnectionDetails" columns={2} rowGap={5} columnGap={12}>
                <GridCell>Processlist Id</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_ID"))}</GridCell>
                <GridCell>Thread Id </GridCell>
                <GridCell>{(this.getSelectedRowValue("THREAD_ID"))}</GridCell>
                <GridCell>Name</GridCell>
                <GridCell>{(this.getSelectedRowValue("NAME"))}</GridCell>
                <GridCell>Type</GridCell>
                <GridCell>{(this.getSelectedRowValue("TYPE"))}</GridCell>
                <GridCell>User</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_USER"))}</GridCell>
                <GridCell>Host</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_HOST"))}</GridCell>
                <GridCell>Schema</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_DB"))}</GridCell>
                <GridCell>Command</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_COMMAND"))}</GridCell>
                <GridCell>Time</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_TIME"))}</GridCell>
                <GridCell>State</GridCell>
                <GridCell>{(this.getSelectedRowValue("PROCESSLIST_STATE"))}</GridCell>
                <GridCell>Role</GridCell>
                <GridCell>{(this.getSelectedRowValue("ROLE"))}</GridCell>
                <GridCell>Instrumented</GridCell>
                <GridCell>{(this.getSelectedRowValue("INSTRUMENTED"))}</GridCell>
                <GridCell>Parent Thread Id</GridCell>
                <GridCell>{(this.getSelectedRowValue("PARENT_THREAD_ID"))}</GridCell>
            </Grid>);
    };

    private getClientConnectionLocks = (): React.ReactNode => {
        const { waitingText, grantedLocks } = this.state;

        const columns: Tabulator.ColumnDefinition[] = [
            { title: "Thread Id", field: "threadId" },
            { title: "Type", field: "type" },
            { title: "Duration", field: "duration" },
        ];

        const options: ITreeGridOptions = {
            selectionType: SelectionType.None,
            showHeader: true,
        };

        const lockContent = (
            <TreeGrid
                id="clientConnectionLocks"
                style={{ fontSize: "10pt" }}
                options={options}
                columns={columns}
                tableData={grantedLocks?.data.rows}
            />
        );

        return (
            this.selectedRow && <Container
                id="locksInfoContainer"
                orientation={Orientation.TopDown}
            >
                <Label>
                    Metadata locks (MDL) protect concurrent access to\nobject metadata (not table row/data locks)
                </Label>
                <Label id="grantedInfo">Granted Locks (and threads waiting on them)</Label>
                <Label>Locks this connection currently owns and\nconnections that are waiting for them.</Label>

                {lockContent}

                <Label id="pendingInfo">Pending Locks</Label>
                <Label>{waitingText}</Label>
            </Container>
        );
    };

    private getClientConnectionAttributes = (): React.ReactNode => {
        const { attributes } = this.state;

        const nameField = this.attrColumns.find((x) => { return x.title === "ATTR_NAME"; });
        const valueField = this.attrColumns.find((x) => { return x.title === "ATTR_VALUE"; });
        const columns: Tabulator.ColumnDefinition[] = [
            { title: "Name", field: nameField?.field ?? "1" },
            { title: "Value", field: valueField?.field ?? "2" },
        ];

        const options: ITreeGridOptions = {
            selectionType: SelectionType.None,
            showHeader: true,
        };

        return (
            attributes && <TreeGrid
                id="clientConnectionAttributes"
                style={{ fontSize: "10pt" }}
                options={options}
                columns={columns}
                tableData={attributes?.data.rows}
            />
        );
    };

    private getClientConnectionInfo = (): React.ReactNode[] => {

        const { globalStatus } = this.state;

        return [
            <Label key="mainLabel">Threads Connected: {globalStatus.threadConnected}</Label>,
            <Label key="mainLabel">Threads Running: {globalStatus.threadRunning}</Label>,
            <Label key="mainLabel">Threads Created: {globalStatus.threadsCreated}</Label>,
            <Label key="mainLabel">Threads Cached: {globalStatus.threadsCached}</Label>,
            <Label key="mainLabel">Rejected (over limit): {globalStatus.rejected}</Label>,
            <Label key="mainLabel">Total Connections: {globalStatus.totalConnections}</Label>,
            <Label key="mainLabel">Connection Limit: {globalStatus.connectionLimit}</Label>,
            <Label key="mainLabel">Aborted Clients: {globalStatus.abortedClients}</Label>,
            <Label key="mainLabel">Aborted Connections: {globalStatus.abortedConnections}</Label>,
            <Label key="mainLabel">Errors: {globalStatus.errors}</Label>,
        ];
    };

    private toolbarContent = (): React.ReactNode[] => {
        const { showDetails } = this.state;

        const showDetailsIcon = showDetails ? showDetailsActiveIcon : showDetailsInactiveIcon;
        const hideSleepConnectionsIcon = this.hideSleepingConnections ?
            hideSleepConnectionsActiveIcon : hideSleepConnectionsInactiveIcon;
        const noFullInfoIcon = this.noFullInfo ? noFullInfoActiveIcon : noFullInfoInactiveIcon;
        const hideBackgroundThreadsIcon = this.hideBackgroundThreads ?
            hideBackgroundThreadsActiveIcon : hideBackgroundThreadsInactiveIcon;

        const intervals: number[] = [0.5, 1, 2, 3, 4, 5, 10, 15, 30, 0];
        const items: React.ReactElement[] = [];

        intervals.forEach((value: number) => {
            items.push(
                <Dropdown.Item
                    id={`${value}`}
                    caption={value > 0 ? `${value} seconds` : `no refresh`}
                />,
            );
        });

        return [
            <Label key="mainLabel">Refresh Rate:</Label>,
            <Dropdown
                id="refreshSelector"
                key="selector"
                onSelect={this.handleTimeRangeSelection}
                initialSelection={`${this.interval / 1000}`}
            >
                {items}
            </Dropdown>,
            <Button
                key="hideSleepConn"
                data-tooltip="Hide sleeping connections"
                imageOnly={true}
                onClick={this.handleHideSleepConn}
            >
                <Icon src={hideSleepConnectionsIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="hideBkgThreads"
                data-tooltip="Hide background threads"
                imageOnly={true}
                onClick={this.handleHideBkgThreads}
            >
                <Icon src={hideBackgroundThreadsIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="noFullInfo"
                data-tooltip="Don't load full thread info"
                imageOnly={true}
                onClick={this.handleNoFullInfo}
            >
                <Icon src={noFullInfoIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="showDetails"
                data-tooltip="Show/Hide Details"
                imageOnly={true}
                onClick={this.handleShowDetails}
            >
                <Icon src={showDetailsIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                disabled={this.selectedRow ? false : true}
                key="killQuery"
                data-tooltip="Kill Query"
                imageOnly={true}
                onClick={this.handleKillQuery}
            >
                <Icon src={killQueryIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                disabled={this.selectedRow ? false : true}
                key="killCOnnection"
                data-tooltip="Kill Connection"
                imageOnly={true}
                onClick={this.handleKillConnection}
            >
                <Icon src={killConnectionIcon} data-tooltip="inherit" />
            </Button>,
        ];

    };

    private generateColumnDefinitions = (columns: IColumnInfo[]): Tabulator.ColumnDefinition[] => {
        return columns.map((info): Tabulator.ColumnDefinition => {
            let formatter: Tabulator.Formatter | undefined;
            let formatterParams = {};
            let minWidth = 50;

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
                    formatter = this.stringFormatter;
                    minWidth = 150;
                    break;
                }

                case DBDataType.Date:
                case DBDataType.DateTime:
                case DBDataType.DateTime_f: {
                    formatter = "datetime";
                    break;
                }

                case DBDataType.Time:
                case DBDataType.Time_f: {
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

            return {
                title: columnNameMap.get(info.title) ?? info.title,
                field: info.field,
                formatter,
                formatterParams,
                minWidth,
                resizable: true,
            };
        });
    };

    private stringFormatter = (cell: Tabulator.CellComponent): string | HTMLElement => {
        let element;
        if (cell.getValue() === null) {
            const host = document.createElement("div");
            host.className = "iconHost";

            element = <Icon src={nullIcon} width={30} height={11} />;
            render(element, host);

            return host;
        } else {
            return cell.getValue() as string;
        }
    };


    private updateValues = (): void => {

        this.checkIsPsAvailable()
            .then((val: boolean) => {
                if (val) {
                    this.updateProcessList();
                }
            })
            .catch((error) => {
                void requisitions.execute("showError",
                    ["Loading Error", "Cannot load performance schema:", String(error)]);
            });
    };

    private checkIsPsAvailable = (): Promise<boolean> => {
        const { backend } = this.props;

        return new Promise((resolve, reject) => {
            backend.execute("select @@performance_schema").then((event: ICommResultSetEvent) => {
                if (event.eventType === EventType.FinalResponse) {
                    if (event.data.result.rows?.[0]) {
                        resolve(true);
                    } else {
                        resolve(true);
                    }
                }
            }).catch(() => {
                reject(false);
            });
        });
    };

    private updateProcessList = (): void => {
        const { backend } = this.props;
        const { globalStatus } = this.state;

        const cols: string[] = [];
        columnNameMap.forEach((_value, key) => {
            if (key === "PROCESSLIST_USER") {
                cols.push("IF (NAME = 'thread/sql/event_scheduler'," +
                    "'event_scheduler',t.PROCESSLIST_USER) PROCESSLIST_USER");
            } else if (key === "INFO" && this.noFullInfo) {
                cols.push("SUBSTR(t.INFO, 0, 255) INFO");
            } else {
                if (key === "ATTR_VALUE") {
                    cols.push(`a.${key}`);
                } else {
                    cols.push(`t.${key}`);
                }
            }
        });

        const where = `WHERE 1 = 1` +
            `${this.hideBackgroundThreads ? " AND t.TYPE <> 'BACKGROUND'" : ""}` +
            `${this.hideSleepingConnections ? " AND t.PROCESSLIST_COMMAND NOT LIKE 'Sleep%'" : ""}`;

        const query = `SELECT ${cols.join(", ")} FROM performance_schema.threads t ` +
            `LEFT OUTER JOIN performance_schema.session_connect_attrs a ON ` +
            `t.processlist_id = a.processlist_id AND (a.attr_name IS NULL OR a.attr_name = 'program_name') ${where}`;

        backend.execute(query).then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                this.columns = generateColumnInfo(DBType.MySQL, event.data.result.columns);
                const rows = convertRows(this.columns, event.data.result.rows);
                const resultSet = {
                    head: {
                        requestId: event.data.requestId ?? "",
                        sql: query,
                    },
                    data: {
                        requestId: event.data.requestId ?? "",
                        currentPage: 1,
                        columns: this.columns,
                        rows,
                    },
                };

                this.setState({ resultSet, gotResponse: true });
            }
        });

        backend.execute("show variables where VARIABLE_NAME like '%version_comment%'")
            .then((event: ICommResultSetEvent) => {
                if (event.eventType === EventType.FinalResponse) {
                    const values = new Map<string, string>(event.data.rows as Array<[string, string]>);
                    const version = `${values.get("version_comment") ?? "none"}`;

                    this.setState({ version });
                }
            });

        backend.execute("show global status").then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const values = new Map<string, string>(event.data.rows as Array<[string, string]>);
                globalStatus.abortedClients = parseInt(`${values.get("Aborted_clients") ?? "0"}`, 10);
                globalStatus.abortedConnections = parseInt(`${values.get("Aborted_connects") ?? "0"}`, 10);
                globalStatus.threadConnected = parseInt(`${values.get("Threads_connected") ?? "0"}`, 10);
                globalStatus.threadsCached = parseInt(`${values.get("Threads_cached") ?? "0"}`, 10);
                globalStatus.threadRunning = parseInt(`${values.get("Threads_running") ?? "0"}`, 10);
                globalStatus.threadsCreated = parseInt(`${values.get("Threads_created") ?? "0"}`, 10);

                globalStatus.abortedConnections =
                    parseInt(`${values.get("Connection_errors_max_connections") ?? "0"}`, 10);
                globalStatus.totalConnections = parseInt(`${values.get("Connections") ?? "0"}`, 10);
                globalStatus.connectionLimit = 0;
                globalStatus.errors = 0;

                this.setState({ globalStatus });
            }
        });
    };


    private handleHideSleepConn = (): void => {
        this.hideSleepingConnections = !this.hideSleepingConnections;
        this.updateValues();
    };

    private handleHideBkgThreads = (): void => {
        this.hideBackgroundThreads = !this.hideBackgroundThreads;
        this.updateValues();
    };

    private handleNoFullInfo = (): void => {
        this.noFullInfo = !this.noFullInfo;
        this.updateValues();
    };

    private handleShowDetails = (): void => {
        const { showDetails } = this.state;
        this.setState({ showDetails: !showDetails });
    };

    private handleKillConnection = (): void => {
        if ((this.selectedRow?.TYPE as string) === "BACKGROUND") {
            void requisitions.execute("showError", ["Error Killing Connection",
                `Connection ${this.getSelectedRowValue("PROCESSLIST_ID")} cannot be killed`]);

            return;
        }
        this.showDialog("killConnection", "MySQL Client Connections", "Do you want to kill selected connection?");
    };

    private handleKillQuery = (): void => {
        if ((this.selectedRow?.TYPE as string) === "BACKGROUND") {
            void requisitions.execute("showError", ["Error Killing Query",
                `Thread ${this.getSelectedRowValue("THREAD_ID")} cannot be killed`]);

            return;
        }
        this.showDialog("killQuery", "MySQL Client Connections", "Do you want to kill selected query?");
    };

    private showDialog = (id: string, title: string, message: string): void => {
        const { backend } = this.props;
        const refuse = "Cancel";
        const accept = "Kill";
        const payLoad = { id };
        const replies = new Map<DialogResponseClosure, string>([
            [DialogResponseClosure.Accept, accept],
            [DialogResponseClosure.Decline, refuse],
        ]);
        const request: IDialogRequest = {
            id: "clientConnectionsConfirmDialog",
            type: DialogType.Confirm,
            title,
            description: [message],
            parameters: {
                accept,
                refuse,
            },
            data: { ...payLoad, backend, replies },
        };

        void requisitions.execute("showDialog", request);
    };

    private killConnection = (): void => {
        const { backend } = this.props;
        const id = this.getSelectedRowValue("PROCESSLIST_ID");
        if (id) {
            backend.execute(`KILL CONNECTION ${id}`).then((event: ICommResultSetEvent) => {
                if (event.eventType === EventType.FinalResponse) {
                    this.updateValues();
                }
            }).catch((error: Error) => {
                void requisitions.execute("showError", ["Error Killing Query",
                    `Error executing KILL CONNECTION on connectionId: ${id}, error: ${error.message}`]);
            });
        }
    };

    private killQuery = (): void => {
        const { backend } = this.props;
        const id = this.getSelectedRowValue("PROCESSLIST_ID");
        if (id) {
            backend.execute(`KILL QUERY ${id}`).then((event: ICommResultSetEvent) => {
                if (event.eventType === EventType.FinalResponse) {
                    this.updateValues();
                }
            }).catch((error: Error) => {
                void requisitions.execute("showError", ["Error Killing Query",
                    `Error executing KILL QUERY on threadId:` +
                    `${this.selectedRow?.THREAD_ID as string}, error: ${error.message}`]);
            });
        }
    };

    private handleTimeRangeSelection = (selectedId: string): void => {
        clearInterval(this.refreshTimer);
        this.interval = parseInt(selectedId, 10) * 1000;
        this.updateValues();
        if (this.interval > 0) {
            this.refreshTimer = setInterval(() => {
                this.updateValues();
            }, this.interval);
        }
    };

    private getSelectedRowValue = (key: string): string => {
        if (key && this.selectedRow) {
            const field = this.columns.find((x) => { return x.title === key; });
            if (field) {
                return this.selectedRow[field.field] as string ?? "";
            }
        }

        return "";
    };

    private handleClientConnectionTreeRowSelected = (row: Tabulator.RowComponent): void => {
        const selectedOldRowId = this.getSelectedRowValue("PROCESSLIST_ID");
        this.selectedRow = row.getData() as IDictionary;
        if (selectedOldRowId !== this.getSelectedRowValue("PROCESSLIST_ID")) {
            this.setState({ selectedTab: "propsTab" });
        }
    };

    private updateAttributes = (id: string): void => {
        const { backend } = this.props;

        const query = `SELECT * FROM performance_schema.session_connect_attrs` +
            ` WHERE processlist_id = ${id} ORDER BY ORDINAL_POSITION`;
        backend.execute(query).then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                this.attrColumns = generateColumnInfo(DBType.MySQL, event.data.result.columns);
                const rows = convertRows(this.attrColumns, event.data.result.rows);
                const resultSet = {
                    head: {
                        requestId: event.data.requestId ?? "",
                        sql: query,
                    },
                    data: {
                        requestId: event.data.requestId ?? "",
                        currentPage: 1,
                        columns: this.attrColumns,
                        rows,
                    },
                };
                this.setState({ attributes: resultSet });
            }
        });
    };

    private updateLocks = (id: number): void => {
        const { backend } = this.props;

        const query = `SELECT * FROM performance_schema.metadata_locks WHERE owner_thread_id = ${id}`;
        backend.execute(query).then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const columns = generateColumnInfo(DBType.MySQL, event.data.result.columns);
                const rows = convertRows(columns, event.data.result.rows);
                const statusField = columns.find((x) => { return x.title === "LOCK_STATUS"; });
                const typeField = columns.find((x) => { return x.title === "OBJECT_TYPE"; });
                const schemaField = columns.find((x) => { return x.title === "OBJECT_SCHEMA"; });
                const nameField = columns.find((x) => { return x.title === "OBJECT_NAME"; });
                const durationField = columns.find((x) => { return x.title === "LOCK_DURATION"; });

                rows.forEach((item) => {
                    const status = item[statusField?.field ?? 0] as string;
                    const type = item[typeField?.field ?? 0] as string;
                    const schema = item[schemaField?.field ?? 0] as string;
                    const name = item[nameField?.field ?? 3] as string;
                    const duration = item[durationField?.field ?? 0] as string;
                    let objectName = "";
                    if (type === "GLOBAL") {
                        objectName = "<global>";
                    } else {
                        objectName = [schema, name].filter(Boolean).join(".");
                    }
                    let query = `OBJECT_TYPE = '${type}'`;
                    if (schema) {
                        query += ` AND OBJECT_SCHEMA = '${this.escapeSqlString(schema)}'`;
                    }
                    if (name) {
                        query += ` AND OBJECT_NAME = '${name}'`;
                    }
                    switch (status) {
                        case "PENDING":
                            this.generatePendingLocksInfo(query, type, duration, objectName);
                            break;
                        case "GRANTED":
                            this.generateGrantedLocksInfo(query, type, duration, objectName);
                            break;
                        default:
                            break;
                    }
                });
            }
        });
    };

    private generatePendingLocksInfo = (subQuery: string, type: string, duration: string, objectName: string): void => {
        const { backend } = this.props;

        const query = `SELECT OWNER_THREAD_ID as ownerThreadId FROM performance_schema.metadata_locks` +
            `WHERE ${subQuery} AND LOCK_STATUS = 'GRANTED'`;
        backend.execute(query).then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const columns = generateColumnInfo(DBType.MySQL, event.data.result.columns);
                const rows = convertRows(columns, event.data.result.rows);
                const owners: string[] = [];
                rows.forEach((item) => {
                    owners.push(item.ownerThreadId as string);
                });

                const waitingText = `The connection is waiting for a lock on` +
                    `\n${type.toLowerCase()} ${objectName},\nheld by thread(s) ${owners.join(", ")}.` +
                    `\nType: ${type}\nDuration: ${duration}`;


                this.setState({ waitingText });
            }
        }).catch((error: Error) => {
            void requisitions.execute("showError", ["Lookup Metadata Locks",
                `Error looking up metadata lock information error: ${error.message}`]);
        });
    };

    private generateGrantedLocksInfo = (subQuery: string, type: string, duration: string,
        objectName: string): void => {
        const { backend } = this.props;

        const query = `SELECT OWNER_THREAD_ID as threadId, LOCK_TYPE as type, LOCK_DURATION as duration ` +
            `FROM performance_schema.metadata_locks WHERE ${subQuery} AND LOCK_STATUS = 'PENDING'`;
        backend.execute(query).then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const columns = generateColumnInfo(DBType.MySQL, event.data.result.columns);
                const rows = convertRows(columns, event.data.result.rows);
                rows.unshift({ threadId: objectName, type, duration });

                const resultSet = {
                    head: {
                        requestId: event.data.requestId ?? "",
                        sql: query,
                    },
                    data: {
                        requestId: event.data.requestId ?? "",
                        currentPage: 1,
                        columns,
                        rows,
                    },
                };
                this.setState({ grantedLocks: resultSet });
            }
        }).catch((error: Error) => {
            void requisitions.execute("showError", ["Lookup Metadata Locks",
                `Error looking up metadata lock information error: ${error.message}`]);
        });
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

    private handleDialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (response?.id !== "clientConnectionsConfirmDialog") {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            const backend = response.data?.backend as IPromptReplyBackend;
            if (backend) {
                switch (response.type) {
                    case DialogType.Confirm: {
                        if (response.closure === DialogResponseClosure.Accept) {
                            if (response.data?.id === "killConnection") {
                                this.killConnection();
                                resolve(true);
                            } else if (response.data?.id === "killQuery") {
                                this.killQuery();
                                resolve(true);
                            }
                        }
                        break;
                    }

                    default:
                        resolve(false);
                        break;
                }
            }
        });
    };

    private handleSelectTab = (id: string): void => {
        const { attributes, grantedLocks } = this.state;
        const currentSelectedRow = this.getSelectedRowValue("PROCESSLIST_ID");
        const currentSelectedThread = this.getSelectedRowValue("THREAD_ID");
        if (id === "attrTab") {
            const field = attributes?.data.columns.find((x) => { return x.title === "PROCESSLIST_ID"; });
            if (!attributes || !field ||
                (field && attributes?.data.rows[0][field.field] as string !== currentSelectedRow)) {
                this.updateAttributes(currentSelectedRow);
            }
        }
        if (id === "locksTab") {
            const field = grantedLocks?.data.columns.find((x) => { return x.title === "THREAD_ID"; });
            if (!grantedLocks || !field ||
                (field && grantedLocks?.data.rows[0][field.field] as string !== currentSelectedThread)) {
                this.updateLocks(parseInt(currentSelectedThread, 10));
            }
        }
        this.setState({ selectedTab: id });
    };
}
