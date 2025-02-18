/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { CellComponent, ColumnDefinition, Formatter, RowComponent } from "tabulator-tables";

import {
    DBDataType, DialogResponseClosure, DialogType, IColumnInfo, IDialogRequest, IDialogResponse, IDictionary,
} from "../../app-logic/general-types.js";
import { IToolbarItems } from "./index.js";

import { ui } from "../../app-logic/UILayer.js";
import { IPromptReplyBackend } from "../../communication/Protocol.js";
import { Button } from "../../components/ui/Button/Button.js";
import {
    ComponentBase, IComponentProperties, IComponentState, SelectionType,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
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
}

interface IClientConnectionsState extends IComponentState {
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

export class ClientConnections extends ComponentBase<IClientConnectionsProperties, IClientConnectionsState> {

    private static readonly sampleInterval = 5000;
    private refreshTimer: ReturnType<typeof setInterval> | null = null;
    private gridRef = createRef<TreeGrid>();
    private interval = ClientConnections.sampleInterval;
    private selectedRow?: IDictionary;
    private columns: IColumnInfo[] = [];
    private attrColumns: IColumnInfo[] = [];

    private hideSleepingConnections = true;
    private noFullInfo = false;
    private hideBackgroundThreads = true;
    private gotPerformanceSchema = false;

    public constructor(props: IClientConnectionsProperties) {
        super(props);

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
            showDetails: false,
            selectedTab: "propsTab",
            waitingText: "This connection is not waiting for any locks.",
        };

        this.checkIsPsAvailable()
            .then((val: boolean) => {
                if (val) {
                    this.gotPerformanceSchema = true;
                    void this.updateValues();
                }
            })
            .catch((error) => {
                const message = convertErrorToString(error);
                void ui.showErrorMessage("Cannot load performance schema: " + message, {});
            });
        this.addHandledProperties("backend", "toolbarItems");
    }

    public override componentDidUpdate(prevProps: IClientConnectionsProperties, _prevState: IComponentState): void {
        const { backend } = this.props;

        // If we reopen a connection a new backend is created then we need to refresh the page.
        if (backend !== prevProps.backend) {
            void this.updateValues();
        }
    }

    public override componentDidMount(): void {
        this.refreshTimer = setInterval(() => {
            void this.updateValues();
        }, ClientConnections.sampleInterval);
        requisitions.register("dialogResponse", this.handleDialogResponse);
    }

    public override componentWillUnmount(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        requisitions.unregister("dialogResponse", this.handleDialogResponse);
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { resultSet, gotResponse, showDetails, selectedTab } = this.state;

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

        const navigationItems = [...toolbarItems.navigation];
        const auxiliaryItems = [...toolbarItems.auxiliary];
        const toolbar = <Toolbar id="clientConnectionToolbar" dropShadow={false} >
            {navigationItems}
            {this.toolbarContent()}
            <div className="expander" />
            {auxiliaryItems}
        </Toolbar>;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
            >
                {toolbar}
                <Container id="contentHost" orientation={Orientation.TopDown}>
                    <Container
                        id="connectionProps"
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Start}
                        wrap={ContentWrap.Wrap}
                    >
                        {connectionProps}
                    </Container>
                    <Container id="connectionListTitle" orientation={Orientation.TopDown}>
                        <Divider />
                        <Label>Client Connection List</Label>
                    </Container>
                    <Container id="connectionList" orientation={Orientation.LeftToRight}>
                        {
                            gotResponse && <TreeGrid
                                ref={this.gridRef}
                                style={{ fontSize: "10pt" }}
                                options={options}
                                columns={this.generateColumnDefinitions(resultSet.columns)}
                                tableData={resultSet.data.rows}
                                selectedRows={[this.getSelectedRowValue("PROCESSLIST_ID")]}
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
                                    onSelectTab={void this.handleSelectTab}
                                    pages={[
                                        {
                                            caption: "Details",
                                            id: "propsTab",
                                            content: this.getClientConnectionDetails(),
                                            icon: Assets.file.mysqlIcon,
                                        },
                                        {
                                            caption: "Locks",
                                            id: "locksTab",
                                            content: this.getClientConnectionLocks(),
                                            icon: Assets.file.mysqlIcon,
                                        },
                                        {
                                            caption: "Attributes",
                                            id: "attrTab",
                                            content: this.getClientConnectionAttributes(),
                                            icon: Assets.file.mysqlIcon,
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

    private getClientConnectionDetails = (): ComponentChild => {

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

    private getClientConnectionLocks = (): ComponentChild => {
        const { waitingText, grantedLocks } = this.state;

        const columns: ColumnDefinition[] = [
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

    private getClientConnectionAttributes = (): ComponentChild => {
        const { attributes } = this.state;

        const nameField = this.attrColumns.find((x) => { return x.title === "ATTR_NAME"; });
        const valueField = this.attrColumns.find((x) => { return x.title === "ATTR_VALUE"; });
        const columns: ColumnDefinition[] = [
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

    private getClientConnectionInfo = (): ComponentChild[] => {

        const { globalStatus } = this.state;

        return [
            <Label data-testid="threadsConnected" key="threadConnectedLabel">
                Threads Connected: {globalStatus.threadConnected}</Label>,
            <Label data-testid="threadsRunning" key="threadRunningLabel">
                Threads Running: {globalStatus.threadRunning}</Label>,
            <Label data-testid="threadsCreated" key="threadsCreatedLabel">
                Threads Created: {globalStatus.threadsCreated}</Label>,
            <Label data-testid="threadsCached" key="threadsCachedLabel">
                Threads Cached: {globalStatus.threadsCached}</Label>,
            <Label data-testid="rejected" key="rejectedLabel">
                Rejected (over limit): {globalStatus.rejected}</Label>,
            <Label data-testid="totalConnections" key="totalConnectionsLabel">
                Total Connections: {globalStatus.totalConnections}</Label>,
            <Label data-testid="connectionsLimit" key="connectionsLimitLabel">
                Connection Limit: {globalStatus.connectionLimit}</Label>,
            <Label data-testid="abortedClients" key="abortedClientsLabel">
                Aborted Clients: {globalStatus.abortedClients}</Label>,
            <Label data-testid="abortedConnections" key="abortedConnectionsLabel">
                Aborted Connections: {globalStatus.abortedConnections}</Label>,
            <Label data-testid="errors" key="errorsLabel">Errors: {globalStatus.errors}</Label>,
        ];
    };

    private toolbarContent = (): ComponentChild[] => {
        const { showDetails } = this.state;

        const showDetailsIcon = showDetails
            ? Assets.toolbar.showDetailsActiveIcon
            : Assets.toolbar.showDetailsInactiveIcon;
        const hideSleepConnectionsIcon = this.hideSleepingConnections
            ? Assets.toolbar.sleepingConnsActiveIcon
            : Assets.toolbar.sleepingConnsInactiveIcon;
        const noFullInfoIcon = this.noFullInfo
            ? Assets.toolbar.infoActiveIcon
            : Assets.toolbar.infoInactiveIcon;
        const hideBackgroundThreadsIcon = this.hideBackgroundThreads
            ? Assets.toolbar.backgroundThreadsActiveIcon
            : Assets.toolbar.backgroundThreadsInactiveIcon;

        const intervals: number[] = [0.5, 1, 2, 3, 4, 5, 10, 15, 30, 0];
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
                onSelect={void this.handleTimeRangeSelection}
                selection={`${this.interval / 1000}`}
            >
                {items}
            </Dropdown>,
            <Divider vertical={true} thickness={1} key="refreshSeparator" />,
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
            <Divider vertical={true} thickness={1} key="filterSeparator" />,
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
            <Divider vertical={true} thickness={1} key="actionSeparator" />,
            <Button
                disabled={this.selectedRow ? false : true}
                key="killQuery"
                data-tooltip="Kill Query"
                imageOnly={true}
                onClick={this.handleKillQuery}
            >
                <Icon src={Assets.toolbar.killQueryIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                disabled={this.selectedRow ? false : true}
                key="killCOnnection"
                data-tooltip="Kill Connection"
                imageOnly={true}
                onClick={this.handleKillConnection}
            >
                <Icon src={Assets.toolbar.killConnectionIcon} data-tooltip="inherit" />
            </Button>,
        ];

    };

    private generateColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        return columns.map((info): ColumnDefinition => {
            let formatter: Formatter | undefined;
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


    private updateValues = async (): Promise<void> => {
        if (this.gotPerformanceSchema) {
            await this.updateProcessList();
        }
    };

    private checkIsPsAvailable = async (): Promise<boolean> => {
        const { backend } = this.props;

        if (!backend) {
            return false;
        }

        const result = await backend.execute("select @@performance_schema");
        if (!result) {
            return false;
        }

        return (result.rows !== undefined) && result.rows.length > 0 && result.rows[0] !== undefined;
    };

    private updateProcessList = async (): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return Promise.resolve();
        }

        const { globalStatus, version } = this.state;

        if (!version) {
            const result = await backend.execute("show variables where VARIABLE_NAME like '%version_comment%'");
            if (result) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);
                const value = `${values.get("version_comment") ?? "none"}`;
                this.setState({ version: value });
            }
        }

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

        const resultId = uuid();
        const result = await backend.execute(query, undefined, resultId);
        if (result) {
            this.columns = generateColumnInfo(DBType.MySQL, result.columns);
            const rows = convertRows(this.columns, result.rows);
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

            this.setState({ resultSet, gotResponse: true });
        }

        const status = await backend.execute("show global status");
        if (status) {
            const values = new Map<string, string>(status.rows as Array<[string, string]>);
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
    };

    private handleHideSleepConn = (): void => {
        this.hideSleepingConnections = !this.hideSleepingConnections;
        void this.updateValues();
    };

    private handleHideBkgThreads = (): void => {
        this.hideBackgroundThreads = !this.hideBackgroundThreads;
        void this.updateValues();
    };

    private handleNoFullInfo = (): void => {
        this.noFullInfo = !this.noFullInfo;
        void this.updateValues();
    };

    private handleShowDetails = (): void => {
        const { showDetails } = this.state;
        this.setState({ showDetails: !showDetails });
    };

    private handleKillConnection = (): void => {
        if ((this.selectedRow?.TYPE as string) === "BACKGROUND") {
            void ui.showErrorMessage(`Connection ${this.getSelectedRowValue("PROCESSLIST_ID")} ` +
                `cannot be killed`, {});

            return;
        }
        this.showDialog("killConnection", "MySQL Client Connections", "Do you want to kill selected connection?");
    };

    private handleKillQuery = (): void => {
        if ((this.selectedRow?.TYPE as string) === "BACKGROUND") {
            void ui.showErrorMessage(`Thread ${this.getSelectedRowValue("THREAD_ID")} cannot be killed`, {});

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

    private killConnection = async (): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const id = this.getSelectedRowValue("PROCESSLIST_ID");
        if (id) {
            try {
                await backend.execute(`KILL CONNECTION ${id}`);
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
                await backend.execute(`KILL QUERY ${id}`);
                await this.updateValues();
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error executing KILL QUERY on threadId:` +
                    `${this.selectedRow?.THREAD_ID as string}, error: ${message}`, {});
            }
        }
    };

    private handleTimeRangeSelection = async (selectedIds: Set<string>): Promise<void> => {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        this.interval = parseInt([...selectedIds][0], 10) * 1000;

        await this.updateValues();
        if (this.interval > 0) {
            this.refreshTimer = setInterval(() => {
                void this.updateValues();
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

    private handleClientConnectionTreeRowSelected = (row: RowComponent): void => {
        const selectedOldRowId = this.getSelectedRowValue("PROCESSLIST_ID");
        this.selectedRow = row.getData() as IDictionary;
        if (selectedOldRowId !== this.getSelectedRowValue("PROCESSLIST_ID")) {
            this.setState({ selectedTab: "propsTab" });
        }
    };

    private updateAttributes = async (id: string): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const resultId = uuid();
        const query = `SELECT * FROM performance_schema.session_connect_attrs` +
            ` WHERE processlist_id = ${id} ORDER BY ORDINAL_POSITION`;
        const result = await backend.execute(query, undefined, resultId);
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

    private updateLocks = async (id: number): Promise<void> => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const query = `SELECT * FROM performance_schema.metadata_locks WHERE owner_thread_id = ${id}`;
        const result = await backend.execute(query);
        if (result) {
            const columns = generateColumnInfo(DBType.MySQL, result.columns);
            const rows = convertRows(columns, result.rows);
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
    };

    private generatePendingLocksInfo = (subQuery: string, type: string, duration: string, objectName: string): void => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const query = `SELECT OWNER_THREAD_ID as ownerThreadId FROM performance_schema.metadata_locks` +
            `WHERE ${subQuery} AND LOCK_STATUS = 'GRANTED'`;
        backend.execute(query).then((result) => {
            if (result) {
                const columns = generateColumnInfo(DBType.MySQL, result.columns);
                const rows = convertRows(columns, result.rows);
                const owners: string[] = [];
                rows.forEach((item) => {
                    owners.push(item.ownerThreadId as string);
                });

                const waitingText = `The connection is waiting for a lock on` +
                    `\n${type.toLowerCase()} ${objectName},\nheld by thread(s) ${owners.join(", ")}.` +
                    `\nType: ${type}\nDuration: ${duration}`;

                this.setState({ waitingText });
            }
        }).catch((reason) => {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error looking up metadata lock information error: ${message}`, {});
        });
    };

    private generateGrantedLocksInfo = (subQuery: string, type: string, duration: string,
        objectName: string): void => {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const resultId = uuid();
        const query = `SELECT OWNER_THREAD_ID as threadId, LOCK_TYPE as type, LOCK_DURATION as duration ` +
            `FROM performance_schema.metadata_locks WHERE ${subQuery} AND LOCK_STATUS = 'PENDING'`;
        backend.execute(query, undefined, resultId).then((result) => {
            if (result) {
                const columns = generateColumnInfo(DBType.MySQL, result.columns);
                const rows = convertRows(columns, result.rows);
                rows.unshift({ threadId: objectName, type, duration });

                const resultSet: IResultSet = {
                    type: "resultSet",
                    resultId,
                    sql: query,
                    columns,
                    data: {
                        currentPage: 1,
                        rows,
                    },
                    updatable: false,
                    fullTableName: "",
                };
                this.setState({ grantedLocks: resultSet });
            }
        }).catch((error: Error) => {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`Error looking up metadata lock information error: ${message}`, {});
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

    private handleDialogResponse = async (response: IDialogResponse): Promise<boolean> => {
        if (response?.id !== "clientConnectionsConfirmDialog") {
            return Promise.resolve(false);
        }

        const backend = response.data?.backend as IPromptReplyBackend;
        if (backend) {
            switch (response.type) {
                case DialogType.Confirm: {
                    if (response.closure === DialogResponseClosure.Accept) {
                        if (response.data?.id === "killConnection") {
                            await this.killConnection();

                            return true;
                        } else if (response.data?.id === "killQuery") {
                            await this.killQuery();

                            return true;
                        }
                    }
                    break;
                }

                default:
            }
        }

        return false;
    };

    private handleSelectTab = async (id: string): Promise<void> => {
        const { attributes, grantedLocks } = this.state;
        const currentSelectedRow = this.getSelectedRowValue("PROCESSLIST_ID");
        const currentSelectedThread = this.getSelectedRowValue("THREAD_ID");

        if (id === "attrTab") {
            const field = attributes?.columns.find((x) => { return x.title === "PROCESSLIST_ID"; });
            if (!attributes || !field ||
                (field && attributes?.data.rows[0][field.field] as string !== currentSelectedRow)) {
                await this.updateAttributes(currentSelectedRow);
            }
        } else if (id === "locksTab") {
            const field = grantedLocks?.columns.find((x) => { return x.title === "THREAD_ID"; });
            if (!grantedLocks || !field ||
                (field && grantedLocks?.data.rows[0][field.field] as string !== currentSelectedThread)) {
                await this.updateLocks(parseInt(currentSelectedThread, 10));
            }
        }

        this.setState({ selectedTab: id });
    };
}
