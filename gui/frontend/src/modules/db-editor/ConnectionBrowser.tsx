/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import mysqlIcon from "../../assets/images/file-icons/mysql.svg";
import sqliteIcon from "../../assets/images/file-icons/sqlite.svg";

import plusIcon from "../../assets/images/plus.svg";
import editIcon from "../../assets/images/edit.svg";
import cloneIcon from "../../assets/images/clone.svg";

import path from "path";
import { ComponentChild, createRef } from "preact";
import { Children } from "preact/compat";

import {
    ValueEditDialog, IDialogValues, IDialogValidations, CommonDialogValueOption, DialogValueType, IDialogSection,
    ICallbackData,
} from "../../components/Dialogs/ValueEditDialog";
import { requisitions } from "../../supplement/Requisitions";
import { webSession } from "../../supplement/WebSession";
import { ISqliteConnectionOptions } from "../../communication/Sqlite";

import {
    IMySQLConnectionOptions, MySQLConnCompression, MySQLConnectionScheme, MySQLSqlMode, MySQLSslMode,
} from "../../communication/MySQL";
import { filterInt } from "../../utilities/string-helpers";
import { Settings } from "../../supplement/Settings/Settings";
import { IBastionSummary, IMySQLDbSystem } from "../../communication";
import {
    DialogResponseClosure, DialogType, IDialogResponse, IDictionary, IServicePasswordRequest,
} from "../../app-logic/Types";
import { ShellPromptHandler } from "../common/ShellPromptHandler";
import { IToolbarItems } from ".";
import { IMdsProfileData } from "../../communication/ProtocolMds";
import { BrowserTileType, IBrowserTileProperties } from "../../components/ui/BrowserTile/BrowserTile";
import { IButtonProperties } from "../../components/ui/Button/Button";
import { ICheckboxProperties, CheckState } from "../../components/ui/Checkbox/Checkbox";
import {
    IComponentProperties, IComponentState, ComponentBase, ComponentPlacement,
} from "../../components/ui/Component/ComponentBase";
import { ConnectionTile, IConnectionTileProperties } from "../../components/ui/ConnectionTile/ConnectionTile";
import { Container, Orientation, ContentWrap, ContentAlignment } from "../../components/ui/Container/Container";
import { FrontPage } from "../../components/ui/FrontPage/FrontPage";
import { Grid } from "../../components/ui/Grid/Grid";
import { GridCell } from "../../components/ui/Grid/GridCell";
import { Label } from "../../components/ui/Label/Label";
import { Menu } from "../../components/ui/Menu/Menu";
import { MenuItem, IMenuItemProperties } from "../../components/ui/Menu/MenuItem";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar";
import { IConnectionDetails, DBType } from "../../supplement/ShellInterface";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { ConfirmDialog } from "../../components/Dialogs/ConfirmDialog";
import { IShellPasswordFeedbackRequest } from "../../communication/ProtocolGui";

interface IConnectionBrowserProperties extends IComponentProperties {
    connections: IConnectionDetails[];
    toolbarItems?: IToolbarItems;

    onAddConnection: (details: IConnectionDetails) => void;
    onDropConnection: (connectionId: number) => void;
    onPushSavedConnection?: (details: IConnectionDetails) => void;
}

interface ILiveUpdateField {
    value: string;
    loading: boolean;
}
interface IConnectionDialogLiveUpdateFields {
    bastionName: ILiveUpdateField;
    mdsDatabaseName: ILiveUpdateField;
    profileName: string;
    dbSystemId: string;
    bastionId: ILiveUpdateField;
}

interface IConnectionBrowserState extends IComponentState {
    loading: boolean;
    progressMessage: string;
}

const editorHeading = "Database Connection Configuration";
const editorDescription = [
    "Select a database type and enter database specific connection data.",
];

export class ConnectionBrowser extends ComponentBase<IConnectionBrowserProperties, IConnectionBrowserState> {

    private static mysqlSslModeMap = new Map<MySQLSslMode, string>([
        [MySQLSslMode.Disabled, "Disable"],
        [MySQLSslMode.Preferred, "Preferred"],
        [MySQLSslMode.Required, "Require"],
        [MySQLSslMode.VerifyCA, "Require and Verify CA"],
        [MySQLSslMode.VerifyIdentity, "Require and Verify Identity"],
    ]);

    private static dbTypeToIconMap = new Map<DBType, string>([
        [DBType.Sqlite, sqliteIcon],
        [DBType.MySQL, mysqlIcon],
    ]);

    private editorRef = createRef<ValueEditDialog>();
    private actionMenuRef = createRef<Menu>();
    private hostRef = createRef<HTMLDivElement>();
    private confirmNewBastionDialogRef = createRef<ConfirmDialog>();
    private keepConnectionDialogRef = createRef<ConfirmDialog>();
    private confirmClearPasswordDialogRef = createRef<ConfirmDialog>();
    private testNotExisting = false;

    private shellSession = new ShellInterfaceShellSession();

    private currentTileDetails?: IConnectionDetails; // Set during context menu invocation.

    //private tmpShPublicKeyFile: string;
    private liveUpdateFields: IConnectionDialogLiveUpdateFields;

    private connectionId = -1;
    private ociProfileNames?: IMdsProfileData[];
    private activeOciProfileName?: string;

    private knowDbTypes: string[] = [];

    public constructor(props: IConnectionBrowserProperties) {
        super(props);

        this.liveUpdateFields = {
            bastionId: { value: "", loading: false },
            bastionName: { value: "", loading: false },
            mdsDatabaseName: { value: "", loading: false },
            profileName: "",
            dbSystemId: "",
        };

        this.state = {
            loading: false,
            progressMessage: "Trying to open connection...",
        };

        void ShellInterface.core.getDbTypes().then((list) => {
            this.knowDbTypes = list;
        });
    }

    public componentDidMount(): void {
        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("dbFileDropped", this.dbFileDropped);
        requisitions.register("addNewConnection", this.addNewConnection);
        requisitions.register("editConnection", this.editConnection);
        requisitions.register("removeConnection", this.removeConnection);
        requisitions.register("duplicateConnection", this.duplicateConnection);
        requisitions.register("acceptPassword", this.acceptPassword);
        requisitions.register("dialogResponse", this.dialogResponse);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
        requisitions.unregister("dbFileDropped", this.dbFileDropped);
        requisitions.unregister("addNewConnection", this.addNewConnection);
        requisitions.unregister("editConnection", this.editConnection);
        requisitions.unregister("removeConnection", this.removeConnection);
        requisitions.unregister("duplicateConnection", this.duplicateConnection);
        requisitions.unregister("acceptPassword", this.acceptPassword);
        requisitions.unregister("dialogResponse", this.dialogResponse);
    }

    public render(): ComponentChild {
        const { connections, toolbarItems } = this.props;
        const { loading, progressMessage } = this.state;

        const className = this.getEffectiveClassNames(["connectionBrowser"]);

        const tiles = [];
        connections.forEach((connection) => {
            if (connection) {
                tiles.push(
                    <ConnectionTile
                        tileId={connection.id}
                        key={connection.id}
                        details={connection}
                        caption={connection.caption}
                        description={connection.description}
                        icon={ConnectionBrowser.dbTypeToIconMap.get(connection.dbType)!}
                        type={BrowserTileType.Open}
                        draggable
                        onAction={this.handleTileAction}
                    //onTileReorder={this.handleTileReorder}
                    />,
                );

            }
        });

        tiles.push(
            <ConnectionTile
                tileId={-1}
                key={-1}
                details={{
                    id: -1,
                    dbType: DBType.MySQL,
                    useSSH: false,
                    useMDS: false,
                    caption: "New Connection",
                    description: "Add a new database connection",
                    options: {
                        dbFile: "",
                        dbName: "",
                    },
                }}
                caption="New Connection"
                description="Add a new database connection"
                icon={plusIcon}
                type={BrowserTileType.CreateNew}
                onAction={this.handleTileAction}
            //onTileReorder={this.handleTileReorder}
            />,
        );

        const linkMap = new Map<string, string>();
        linkMap.set("Learn More >", "https://blogs.oracle.com/mysql/post/introducing-mysql-shell-for-vs-code");
        linkMap.set("Browse Tutorial >", "https://www.mysql.com");
        linkMap.set("Read Docs >", "https://www.mysql.com");

        // If toolbar items are given, render a toolbar with them.
        let toolbar: ComponentChild | undefined;
        if (toolbarItems) {
            toolbar = <Toolbar
                id="connectionOverviewToolbar"
                dropShadow={false}
            >
                {toolbarItems.left}
                <div className="expander" />
                {toolbarItems.right}
            </Toolbar>;
        }

        const customFooter = loading ? <>
            <Container
                className={className}
                orientation={Orientation.LeftToRight}
                wrap={ContentWrap.NoWrap}
            >
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    indicatorWidth={25}
                    indicatorHeight={25}
                    stroke={1}
                    linear={false}
                />
                <Label
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </Container>
        </> : undefined;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                wrap={ContentWrap.NoWrap}
            >
                {toolbar}
                <ConfirmDialog
                    ref={this.confirmNewBastionDialogRef}
                    id="confirmNewBastionDialog"
                    onClose={this.handleCreateNewBastion}
                />
                <ConfirmDialog
                    ref={this.keepConnectionDialogRef}
                    id="keepConnectionDialogRef"
                    onClose={this.handleKeepConnection}
                />
                <ValueEditDialog
                    ref={this.editorRef}
                    id="connectionEditor"
                    onValidate={this.validateConnectionValues}
                    onClose={this.handleOptionsDialogClose}
                    //advancedAction={this.testConnection}
                    //advancedActionCaption="Test connection"
                    onSelectTab={this.handleTabSelect}
                    customFooter={customFooter}
                />
                <ConfirmDialog
                    ref={this.confirmClearPasswordDialogRef}
                    id="confirmClearPasswordDlg"
                />
                <Menu
                    id="tileActionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMenuItemClick}
                >
                    <MenuItem id="edit" caption="Edit Connection…" icon={editIcon} />
                    <MenuItem id="duplicate" caption="Duplicate Connection…" icon={cloneIcon} />
                    <MenuItem caption="-" />
                    <MenuItem id="shareConnection" caption="Share Connection" icon={cloneIcon} disabled >
                        <MenuItem id="shareWithUser" caption="With User..." icon={cloneIcon} />
                        <MenuItem caption="-" />
                        <MenuItem id="profile1" caption="Profile 1" icon={cloneIcon} />
                        <MenuItem id="profile2" caption="Profile 2" icon={cloneIcon} />
                        <MenuItem id="profile3" caption="Profile 3" icon={cloneIcon} />
                    </MenuItem>
                    <MenuItem id="copyConnection" caption="Copy Connection to Profile" icon={cloneIcon} disabled >
                        <MenuItem id="profile1" caption="Profile 1" icon={cloneIcon} />
                    </MenuItem>
                    <MenuItem caption="-" />
                    <MenuItem id="remove" caption="Remove Connection…" />
                </Menu>
                <FrontPage
                    showGreeting={Settings.get("dbEditor.connectionBrowser.showGreeting", true)}
                    caption="MySQL Shell - DB Notebooks"
                    description={"DB Notebooks are modern editors for working with databases. They can be used to " +
                        "create and manage databases schema objects, write SQL queries and scripts, and work with " +
                        "data.\n\n" +
                        "Click on a Database Connection to open a new DB Notebook."
                    }
                    helpUrls={linkMap}
                    onCloseGreeting={this.handleCloseGreeting}
                >
                    <Label id="contentTitle" caption="Database Connections" />
                    <Container
                        innerRef={this.hostRef}
                        id="tilesHost"
                        orientation={Orientation.LeftToRight}
                        wrap={ContentWrap.Wrap}
                        onDrop={this.handleDrop}
                        onDragOver={this.handleDragOver}
                        onDragEnter={this.handleDragEnter}
                        onDragLeave={this.handleDragLeave}
                    >
                        {tiles}
                    </Container>
                </FrontPage>
            </Container>
        );
    }

    private addNewConnection = (details: { mdsData?: IMySQLDbSystem; profileName?: String; }): Promise<boolean> => {
        const options = details.mdsData as IDictionary;
        if (options) {
            options.profileName = details.profileName;
        }
        this.connectionId = -1;
        this.doHandleTileAction("new", undefined, options);

        return Promise.resolve(true);
    };

    private editConnection = (connectionId: number): Promise<boolean> => {
        const { connections } = this.props;

        const details = connections.find((candidate) => { return candidate.id === connectionId; });

        if (details) {
            this.connectionId = details.id;
            this.doHandleTileAction("edit", details, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private removeConnection = (connectionId: number): Promise<boolean> => {
        const { connections } = this.props;

        const details = connections.find((candidate) => { return candidate.id === connectionId; });
        if (details) {
            this.doHandleTileAction("remove", details, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private duplicateConnection = (connectionId: number): Promise<boolean> => {
        const { connections } = this.props;

        const details = connections.find((candidate) => { return candidate.id === connectionId; });
        if (details) {
            this.connectionId = -1;
            this.doHandleTileAction("duplicate", details, undefined);
            requisitions.executeRemote("refreshConnections", undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (entry?.key === "dbEditor.connectionBrowser.showGreeting") {
            this.forceUpdate();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleCloseGreeting = (): void => {
        Settings.set("dbEditor.connectionBrowser.showGreeting", false);
    };

    private dbFileDropped = (fileName: string): Promise<boolean> => {
        // First remove drop zone.
        if (this.hostRef.current) {
            this.hostRef.current.classList.remove("dropTarget");
        }

        const { connections } = this.props;

        const caption = `New Connection ${connections.length}`;
        const description = "A new Database Connection";

        this.createEditConnection(DBType.Sqlite, true, {
            id: -1,
            dbType: DBType.Sqlite,
            caption,
            description,
            useMDS: false,
            useSSH: false,
            options: {
                dbFile: fileName,
            },
        });

        return Promise.resolve(true);
    };

    /**
     * Called for most drag operations, except when we are in a native wrapper and a file was dropped here.
     * In that case a notification is sent (dbFileDropped).
     *
     * @param e The original drag event.
     */
    private handleDrop = (e: DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        (e.currentTarget as HTMLElement).classList.remove("dropTarget");
    };

    private handleDragOver = (e: DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer) {
            const hasFiles = e.dataTransfer.types.includes("Files");
            e.dataTransfer.dropEffect = hasFiles ? "link" : "move";
        }
    };

    private handleDragEnter = (e: DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "linkMove";
            const hasFiles = e.dataTransfer.types.includes("Files");
            if (hasFiles) {
                (e.currentTarget as HTMLElement).classList.add("dropTarget");
            }
        }
    };

    private handleDragLeave = (e: DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        (e.currentTarget as HTMLElement).classList.remove("dropTarget");
    };

    private handleMenuItemClick = (_e: MouseEvent, props: IMenuItemProperties): boolean => {
        if (!props.children || Children.count(props.children) === 0) {
            this.doHandleTileAction(props.id || "", this.currentTileDetails, {});

            return true;
        }

        return false;
    };

    private handleTileAction = (action: string, props: IBrowserTileProperties | undefined,
        options: unknown): void => {

        const tileProps = props as IConnectionTileProperties;
        this.doHandleTileAction(action, tileProps?.details, options as IDictionary);
    };

    private doHandleTileAction = (action: string, details: IConnectionDetails | undefined,
        options?: IDictionary): void => {
        const dbType = details?.dbType ?? DBType.MySQL;

        switch (action) {
            case "menu": {
                this.currentTileDetails = details;
                if (options && options.target instanceof HTMLElement) {
                    const rect = options.target.getBoundingClientRect();
                    this.actionMenuRef.current?.open(rect, false);
                }
                break;
            }

            case "edit": {
                this.createEditConnection(dbType, false, details);
                break;
            }

            case "new": {
                if (options && options.id !== undefined) {
                    let host;
                    if (options.endpoints && Array.isArray(options.endpoints) && options.endpoints.length > 0) {
                        host = options.endpoints[0].ipAddress;
                    }

                    const connectionDetails: IConnectionDetails = {
                        id: -1,
                        caption: options.displayName as string ?? "",
                        dbType: DBType.MySQL,
                        description: options.description as string ?? "",
                        useMDS: true,
                        useSSH: false,
                        options: {
                            /* eslint-disable @typescript-eslint/naming-convention */
                            "compartment-id": options.compartmentId,
                            "mysql-db-system-id": options.id,
                            "profile-name": options.profileName ?? "DEFAULT",
                            // Disable support for bastion to be stored in freeform tags for the time being
                            // "bastion-id": (options.freeformTags as IDictionary)?.bastionId ?? undefined,
                            host,
                            "scheme": MySQLConnectionScheme.MySQL,
                            /* eslint-enable @typescript-eslint/naming-convention */
                        },
                    };
                    this.createEditConnection(dbType, true, connectionDetails);

                } else {
                    this.createEditConnection(dbType, true);
                }
                break;
            }

            case "duplicate": {
                this.createEditConnection(dbType, true, details);

                break;
            }

            case "remove": {
                if (details) {
                    this.confirmTileRemoval(details);
                }

                break;
            }

            case "open": {
                if (details) {
                    void requisitions.execute("openConnectionTab",
                        { details, force: options?.newTab as boolean ?? false });

                    // Notify the wrapper, if there's one, in case it has to update UI for the changed page.
                    requisitions.executeRemote("selectConnectionTab", details?.caption);
                }

                break;
            }

            default: {
                break;
            }
        }
    };

    private confirmTileRemoval = (connection: IConnectionDetails): void => {
        setTimeout(() => {
            void requisitions.execute("showDialog", {
                type: DialogType.Confirm,
                id: "deleteConnection",
                parameters: {
                    prompt: `You are about to remove the connection "${connection.caption}" from the list.`,
                    refuse: "Cancel",
                    accept: "Confirm",
                    default: "Cancel",
                },
                data: { connection },
            });
        }, 0);
    };

    private confirmBastionCreation = (connection?: IConnectionDetails): void => {
        if (this.confirmNewBastionDialogRef.current) {
            this.confirmNewBastionDialogRef.current.show(
                (<Container orientation={Orientation.TopDown}>
                    <Grid columns={["auto"]} columnGap={5}>
                        <GridCell crossAlignment={ContentAlignment.Stretch}>
                            There is no Bastion in the compartment of this MySQL DB System that can be used.<br /><br />
                        </GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Stretch}>
                            Do you want to create a new Bastion in the compartment of the MySQL DB System?
                        </GridCell>
                    </Grid>
                </Container>),
                {
                    refuse: "Cancel",
                    accept: "Create New Bastion",
                },
                "Create New Bastion",
                undefined,
                { connection },
            );
        }

    };

    private handleCreateNewBastion = (closure: DialogResponseClosure, values?: IDictionary): void => {
        if (closure === DialogResponseClosure.Accept && values) {
            const details = values.connection as IConnectionDetails;
            const contexts: string[] = [DBType.MySQL];
            if (details.useSSH) {
                contexts.push("useSSH");
            }

            // Push useMDS to display the MDS tab
            contexts.push("useMDS");

            this.beginValueUpdating("Loading...", "bastionName");
            this.beginValueUpdating("Loading...", "mysqlDbSystemName");
            this.beginValueUpdating("Loading...", "bastionId");

            this.editorRef.current?.show(
                this.generateEditorConfig(details),
                {
                    contexts,
                    title: editorHeading,
                    description: editorDescription,
                },
                {
                    createNew: !(details.id > 0),
                    details,
                });
            this.editorRef.current?.preventConfirm(true);

            this.setProgressMessage("Waiting up to 5 minutes for the bastion to be created.");
            this.showProgress();
            setTimeout(() => {
                // Update the OCI tree to show the bastion that is created.
                requisitions.executeRemote("refreshOciTree", undefined);
            }, 8000);

            this.createBastion().then((summary) => {
                if (summary) {
                    requisitions.executeRemote("refreshOciTree", undefined);
                    this.updateInputValue(summary.id, "bastionId");
                    this.updateInputValue(summary.name, "bastionName");
                    this.hideProgress();
                    this.editorRef.current?.preventConfirm(false);
                }
            }).catch(() => {
                requisitions.executeRemote("refreshOciTree", undefined);
                this.updateInputValue("<error loading bastion name data>", "bastionName");
                this.hideProgress();
                this.editorRef.current?.preventConfirm(true);
            });

            this.shellSession.mds.getMdsMySQLDbSystem(this.liveUpdateFields.profileName,
                this.liveUpdateFields.dbSystemId)
                .then((system) => {
                    if (system) {
                        this.updateInputValue(system.displayName, "mysqlDbSystemName");
                    }
                })
                .catch(() => {
                    this.editorRef.current?.updateInputValue("<error loading database OCI name data>",
                        "mysqlDbSystemName");
                });
        }
    };

    private confirmKeepConnection = (connection?: IConnectionDetails): void => {
        if (this.keepConnectionDialogRef.current) {
            this.keepConnectionDialogRef.current.show(
                (<Container orientation={Orientation.TopDown}>
                    <Grid columns={["auto"]} columnGap={5}>
                        <GridCell className="right" crossAlignment={ContentAlignment.Stretch}>
                            A successful MySQL connection was made with the parameters defined for this connection.
                        </GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Stretch}>
                            Do you want to save connection the MySQL DB System?
                        </GridCell>
                    </Grid>
                </Container>),
                {
                    refuse: "Cancel",
                    accept: "Save",
                },
                "MySQL Connection Testing",
                undefined,
                { connection },
            );
        }

    };

    private successConnectionInfo = (connection?: IConnectionDetails): void => {
        if (this.keepConnectionDialogRef.current) {
            this.keepConnectionDialogRef.current.show(
                (<Container orientation={Orientation.TopDown}>
                    <Grid columns={["auto"]} columnGap={5}>
                        <GridCell className="right" crossAlignment={ContentAlignment.Stretch}>
                            A successful MySQL connection was made with the parameters defined for this connection.
                        </GridCell>
                    </Grid>
                </Container>),
                { accept: "OK" },
                "MySQL Connection Testing",
                undefined,
                { connection },
            );
        }

    };

    private handleKeepConnection = (closure: DialogResponseClosure, values?: IDictionary): void => {
        const details = values?.connection as IConnectionDetails;
        if (closure === DialogResponseClosure.Accept) {
            const { onPushSavedConnection } = this.props;
            onPushSavedConnection?.(details);
            requisitions.executeRemote("refreshConnections", undefined);
        } else {
            this.dropTempConnection(details?.id);
        }
    };

    // TODO: change tile reorder to use module state not settings.
    /**
     * Triggered after the user dragged one tile onto another. This is used to reorder tiles.
     *
     * @param draggedTileId The id of the tile that has been dragged.
     * @param props The properties of the tile onto which the other tile was dropped.
     */
    /*
    private handleTileReorder = (draggedTileId: number, props: IConnectionTileProperties): void => {
        // Note: the "New Connection" tile cannot be dragged, but can be a drag target.
        if (draggedTileId !== props.tileId) {
            const { connectionOrder } = this.state;

            const sourceIndex = connectionOrder.findIndex((id: number) => id === draggedTileId);
            let targetIndex = connectionOrder.findIndex((id: number) => id === props.details.id);

            // Now move the dragged tile into the place where the target tile is located, moving the target tile
            // and others following it one place up.
            if (targetIndex === -1) {
                // Dragged onto the "New Connection" tile - move the dragged tile to the end.
                const elements = connectionOrder.splice(sourceIndex, 1);
                connectionOrder.push(...elements);
            } else {
                if (sourceIndex + 1 !== targetIndex) {
                    if (sourceIndex < targetIndex) {
                        --targetIndex; // -1 because after removal of the source connection all indexes are moved down.
                    }
                    const elements = connectionOrder.splice(sourceIndex, 1);
                    connectionOrder.splice(targetIndex, 0, ...elements);
                }
            }

            this.setState({ connectionOrder });
        }
    };*/

    /**
     * Triggers the connection editor to create a new connection.
     *
     * @param dbTypeName The name of the database type we start with.
     * @param newConnection True if connection is creating
     * @param details An optional set of tile properties.
     */
    private createEditConnection = (dbTypeName: string, newConnection: boolean, details?: IConnectionDetails): void => {
        this.liveUpdateFields.bastionName.value = "";
        this.liveUpdateFields.mdsDatabaseName.value = "";
        this.liveUpdateFields.profileName = "";
        this.liveUpdateFields.bastionId.value = "";
        this.liveUpdateFields.dbSystemId = "";
        this.connectionId = details?.id ?? -1;

        // Initializes useMDS/useSSH to have the tabs be shown or hidden based on the saved connection options
        if (details?.dbType === DBType.MySQL) {
            const optionsMySQL = details.options as IMySQLConnectionOptions;
            details.useMDS = optionsMySQL["mysql-db-system-id"] !== undefined;
            details.useSSH = optionsMySQL.ssh !== undefined;
        }

        if (this.editorRef.current) {
            if (details && details.options["bastion-id"] && details.options["profile-name"]
                && details.options["mysql-db-system-id"]) {
                // We have bastion id and mds database id.
                this.liveUpdateFields.profileName = details.options["profile-name"] as string;
                this.liveUpdateFields.bastionId.value = details.options["bastion-id"] as string;
                this.liveUpdateFields.dbSystemId = details.options["mysql-db-system-id"] as string;
                this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, details);
            } else if (details && !details.options["bastion-id"] && details.options["profile-name"]
                && details.options["mysql-db-system-id"]) {

                const profileName = details.options["profile-name"] as string;
                const dbSystemId = details.options["mysql-db-system-id"] as string;
                const compartmentId = details.options["compartment-id"] as string;
                delete details.options["compartment-id"];

                // We have only profileName and mds database id, but no bastion id.
                this.liveUpdateFields.profileName = profileName;
                this.liveUpdateFields.dbSystemId = dbSystemId;

                // Get all available bastions that are in the same compartment as the DbSystem but ensure that
                // these bastions are valid for the specific DbSystem by having a matching target_subnet_id
                void this.shellSession.mds.getMdsBastions(profileName, compartmentId, dbSystemId).then((bastions) => {
                    if (bastions.length > 0) {
                        // If there is a bastion in the same compartment
                        details.options["bastion-id"] = bastions[0].id;
                        this.liveUpdateFields.bastionId.value = details.options["bastion-id"] as string;
                        this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, details);
                    } else {
                        this.confirmBastionCreation(details);
                    }
                });
            } else {
                // A connection dialog without MySQL DB system id.
                // Activate the SSH/MDS contexts as needed
                const contexts: string[] = [dbTypeName];
                if (details?.useSSH) {
                    contexts.push("useSSH");
                }

                if (details?.useMDS) {
                    contexts.push("useMDS");
                }

                this.editorRef.current.show(
                    this.generateEditorConfig(details),
                    {
                        contexts,
                        title: editorHeading,
                        description: editorDescription,
                    },
                    {
                        createNew: newConnection,
                        details,
                    });
            }
        }
    };

    private loadMdsAdditionalDataAndShowConnectionDlg = ((dbTypeName: string, newConnection: boolean,
        details?: IConnectionDetails): void => {
        const contexts: string[] = [dbTypeName];
        if (details?.useMDS) {
            contexts.push("useMDS");
        }

        if (details?.useSSH) {
            contexts.push("useSSH");
        }

        this.beginValueUpdating("Loading...", "bastionName");
        this.beginValueUpdating("Loading...", "mysqlDbSystemName");
        this.editorRef.current?.show(
            this.generateEditorConfig(details),
            {
                contexts,
                title: editorHeading,
                description: editorDescription,
            },
            {
                createNew: newConnection,
                details,
            },
        );

        this.shellSession.mds.getMdsBastion(this.liveUpdateFields.profileName, this.liveUpdateFields.bastionId.value)
            .then((summary) => {
                if (summary) {
                    this.updateInputValue(summary.name, "bastionName");
                }
            }).catch(() => {
                this.updateInputValue("<error loading bastion name data>", "bastionName");
            });

        this.shellSession.mds.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, this.liveUpdateFields.dbSystemId)
            .then((system) => {
                if (system) {
                    this.updateInputValue(system.displayName, "mysqlDbSystemName");
                }
            })
            .catch(() => {
                this.updateInputValue("<error loading database OCI name data>", "mysqlDbSystemName");
            });
    });

    private validateConnectionValues = (closing: boolean, values: IDialogValues,
        data?: IDictionary): IDialogValidations => {

        const result: IDialogValidations = {
            requiredContexts: [],
            messages: {},
        };

        const generalSection = values.sections.get("general")!.values;
        const informationSection = values.sections.get("information")!.values;
        const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;
        //const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        //const mysqlSsSection = values.sections.get("ssl")!.values;
        const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
        //const mysqlSshSection = values.sections.get("ssh")!.values;

        /*if (mysqlDetailsSection.useMDS.value as boolean === false) {
            mysqlSshSection.sshPublicKeyFile.options = [DialogValueOption.Disabled];
            this.tmpShPublicKeyFile = mysqlSshSection.sshPublicKeyFile.value as string;
            mysqlSshSection.sshPublicKeyFile.value = "";
        } else {
            mysqlSshSection.sshPublicKeyFile.options = [DialogValueOption.Resource];
            mysqlSshSection.sshPublicKeyFile.value = this.tmpShPublicKeyFile;
        }*/

        const isSqlite = generalSection.databaseType.value === "Sqlite";
        const isMySQL = generalSection.databaseType.value === "MySQL";

        if (!isSqlite && !isMySQL) {
            result.messages.databaseType = "Select one of the database types for your connection";
        }

        if (!informationSection.caption.value) {
            if (closing) {
                result.messages.caption = "The caption cannot be empty";
            }
        } else {
            // Check duplicate captions.
            const { connections } = this.props;
            const details = connections.find((element: IConnectionDetails) => {
                return element.caption === informationSection.caption.value;
            });

            // The caption can be the same if it is the one from the connection that is currently being edited.
            if (details && (String(details.id) !== values.id || data?.createNew)) {
                result.messages.caption = "A connection with that caption exists already";
            }
        }

        if (isSqlite) {
            if (closing && !sqliteDetailsSection.dbFilePath.value) {
                result.messages.dbFilePath = "Specify the path to an existing Sqlite DB file";
            } else if (sqliteDetailsSection.dbFilePath.value) {
                // See if we have a valid file name.
                const fileName = sqliteDetailsSection.dbFilePath.value as string;
                try {
                    new URL("file:///" + fileName); // Can throw.
                } catch (e) {
                    result.messages.dbFilePath = "Invalid file path";
                }
            }
        } else if (isMySQL) {
            if (closing) {
                const host = mysqlDetailsSection.hostName.value as string;
                if (!host || host.length === 0) {
                    result.messages.hostName = "Specify a valid host name or IP address";
                }

                const user = mysqlDetailsSection.userName.value as string;
                if (!user || user.length === 0) {
                    result.messages.userName = "The user name must not be empty";
                }
            }

            if (typeof mysqlDetailsSection.port.value === "number") {
                const port = this.checkValidInt(mysqlDetailsSection.port.value);
                if (port === undefined || isNaN(port) || port < 0) {
                    result.messages.timeout = "The port must be a valid integer >= 0";
                }

            }

            if (typeof mysqlAdvancedSection.timeout.value === "number") {
                const timeout = this.checkValidInt(mysqlAdvancedSection.timeout.value);
                if (timeout === undefined || isNaN(timeout) || timeout < 0) {
                    result.messages.timeout = "The timeout must be a valid integer >= 0";
                }
            }
        }

        return result;
    };

    private handleOptionsDialogClose = (closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
        callbackData?: ICallbackData): void => {
        if (closure === DialogResponseClosure.Accept) {
            const generalSection = values.sections.get("general")!.values;
            const informationSection = values.sections.get("information")!.values;
            const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;
            const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
            const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
            const mdsAdvancedSection = values.sections.get("mdsAdvanced")!.values;
            const mysqlSshSection = values.sections.get("ssh")!.values;
            const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
            const mysqlSslSection = values.sections.get("ssl")!.values;

            const isSqlite = generalSection.databaseType.value === "Sqlite";
            const isMySQL = generalSection.databaseType.value === "MySQL";

            let details: IConnectionDetails | undefined = data?.details as IConnectionDetails;
            const dbType: DBType = DBType[generalSection.databaseType.value as string];

            if (data?.createNew) {
                details = {
                    id: 0, // Will be replaced with the ID returned from the BE call.
                    dbType,
                    caption: informationSection.caption.value as string,
                    description: informationSection.description.value as string,
                    useSSH: false,
                    useMDS: false,
                    options: {},
                };

                if (isSqlite) {
                    details.options = {
                        dbFile: "",
                        otherParameters: sqliteAdvancedSection.otherParameters.value as string,
                    } as ISqliteConnectionOptions;
                } else if (isMySQL) {
                    details.options = {
                        scheme: MySQLConnectionScheme.MySQL,
                        host: "localhost",
                    } as IMySQLConnectionOptions;
                }
            }

            if (details) {
                details.dbType = dbType;
                details.useMDS = mysqlDetailsSection.useMDS.value as boolean;
                details.useSSH = mysqlDetailsSection.useSSH.value as boolean;
                details.caption = informationSection.caption.value as string;
                details.description = informationSection.description.value as string;

                // TODO: use current active nesting group, once available.
                // details.folderPath = ...

                if (isSqlite) {
                    details.options = {
                        dbFile: sqliteDetailsSection.dbFilePath.value as string,

                        // Not "as string", to allow undefined too.
                        otherParameters: sqliteAdvancedSection.otherParameters.value,
                    } as ISqliteConnectionOptions;
                } else if (isMySQL) {
                    let sshKeyFile;
                    if (details.useSSH && mysqlSshSection.sshKeyFile.value !== "") {
                        sshKeyFile = mysqlSshSection.sshKeyFile.value;
                    }
                    if (details.useMDS && mdsAdvancedSection.sshKeyFile.value !== "") {
                        sshKeyFile = mdsAdvancedSection.sshKeyFile.value;
                    }
                    let sshKeyFilePublic;
                    if (details.useMDS && mdsAdvancedSection.sshPublicKeyFile.value !== "") {
                        sshKeyFilePublic = mdsAdvancedSection.sshPublicKeyFile.value;
                    }
                    const useSsl = mysqlSslSection.sslMode.value !== MySQLSslMode.Disabled;
                    let mode;
                    if (useSsl) {
                        ConnectionBrowser.mysqlSslModeMap.forEach((value: string, key: MySQLSslMode) => {
                            if (value === mysqlSslSection.sslMode.value) {
                                mode = key;
                            }
                        });
                    }

                    const compressionAlgorithms = Array.isArray(mysqlAdvancedSection.compressionAlgorithms.value)
                        ? mysqlAdvancedSection.compressionAlgorithms.value.join(",")
                        : undefined;

                    details.options = {
                        /* eslint-disable @typescript-eslint/naming-convention */
                        "scheme": mysqlDetailsSection.scheme.value as MySQLConnectionScheme,
                        "host": mysqlDetailsSection.hostName.value as string,
                        "port": mysqlDetailsSection.port.value as number,
                        "user": mysqlDetailsSection.userName.value as string,
                        "schema": mysqlDetailsSection.defaultSchema.value as string,
                        // "useSSL": useSsl ? undefined : "no",
                        "ssl-mode": mode ?? undefined,
                        "ssl-ca": mysqlSslSection.sslCaFile.value as string,
                        "ssl-cert": mysqlSslSection.sslCertFile.value as string,
                        "ssl-key": mysqlSslSection.sslKeyFile.value as string,
                        "ssl-cipher": mysqlSslSection.sslCipher.value as string,
                        "compression": (mysqlAdvancedSection.compression.value !== "")
                            ? mysqlAdvancedSection.compression.value as MySQLConnCompression : undefined,
                        "compression-algorithms": compressionAlgorithms,
                        "compression-level": mysqlAdvancedSection.compressionLevel.value as number,
                        //useAnsiQuotes: section5.ansiQuotes.value,
                        //enableClearTextAuthPlugin: section5.clearTextAuth.value,
                        "connection-timeout": mysqlAdvancedSection.timeout.value,
                        //sqlMode: section5.sqlMode.value,
                        "ssh": details.useSSH ? mysqlSshSection.ssh.value as string : undefined,
                        //"ssh-password": details.useSSH ? mysqlSshSection.sshPassword.value : undefined,
                        "ssh-identity-file": sshKeyFile as string,
                        "ssh-config-file": details.useSSH
                            ? mysqlSshSection.sshConfigFilePath.value as string
                            : undefined,
                        "ssh-public-identity-file": sshKeyFilePublic as string,
                        "profile-name": details.useMDS ? mdsAdvancedSection.profileName.value as string : undefined,
                        "bastion-id": details.useMDS ? mdsAdvancedSection.bastionId.value as string : undefined,
                        "mysql-db-system-id": details.useMDS
                            ? mdsAdvancedSection.mysqlDbSystemId.value as string : undefined,
                        "disable-heat-wave-check": mysqlAdvancedSection.disableHeatwaveCheck.value as boolean,
                        /* eslint-enabled @typescript-eslint/naming-convention */
                    };
                }

                if (callbackData?.onAddConnection) {
                    callbackData?.onAddConnection(details);
                } else if (data?.createNew) {
                    const { onAddConnection } = this.props;
                    onAddConnection(details);
                    requisitions.executeRemote("refreshConnections", undefined);
                } else {
                    void ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, details)
                        .then(() => {
                            this.forceUpdate();
                            requisitions.executeRemote("refreshConnections", undefined);
                        });
                }
            }

        }
    };

    /**
     * Generates the object to be used for the value editor.
     *
     * @param details The properties of an existing connection or undefined for a new one.
     *
     * @returns The necessary dialog values to edit this connection.
     */
    private generateEditorConfig = (details?: IConnectionDetails): IDialogValues => {
        const { connections } = this.props;

        const caption = `New Connection ${connections.length + 1}`;
        const description = "A new Database Connection";

        details = details || { // Default for new connections is MySQL.
            id: -1,
            dbType: DBType.MySQL,
            caption,
            description,
            useSSH: false,
            useMDS: false,
            options: {
                host: "localhost",
                port: 3306,
                scheme: MySQLConnectionScheme.MySQL,
            },
        };

        // In the dialog config we have to provide values for each DB type, because the user can switch the type.
        // However the specific option object for the not-used DB type is initialized to default values only.
        const isSqlite = details.dbType === DBType.Sqlite;
        const isMySQL = details.dbType === DBType.MySQL;

        let optionsMySQL: IMySQLConnectionOptions;
        let optionsSqlite: ISqliteConnectionOptions;
        if (isSqlite) {
            optionsSqlite = details.options as ISqliteConnectionOptions;
            if (!optionsSqlite.dbName || optionsSqlite.dbName.trim() === "") {
                if (optionsSqlite.dbFile.endsWith(".sqlite3")) {
                    optionsSqlite.dbName = path.basename(optionsSqlite.dbFile, ".sqlite3");
                } else {
                    optionsSqlite.dbName = path.basename(optionsSqlite.dbFile, ".sqlite");
                }
            }

            optionsMySQL = {
                scheme: MySQLConnectionScheme.MySQL,
                host: "localhost",
            };
        } else if (isMySQL) {
            optionsSqlite = {
                dbFile: "",
                dbName: "",
            };
            optionsMySQL = details.options as IMySQLConnectionOptions;
            details.useMDS = optionsMySQL["mysql-db-system-id"] !== undefined;
            details.useSSH = optionsMySQL.ssh !== undefined;
        } else {
            optionsSqlite = {
                dbFile: "",
                dbName: "",
            };
            optionsMySQL = {
                scheme: MySQLConnectionScheme.MySQL,
                host: "localhost",
            };
        }

        const generalSection: IDialogSection = {
            values: {
                databaseType: {
                    type: "choice",
                    caption: "Database Type:",
                    value: details.dbType,
                    choices: this.knowDbTypes,
                    onChange: (value: DialogValueType, dialog: ValueEditDialog): void => {
                        const availableNames = [...this.knowDbTypes]; // Need a copy.
                        const index = availableNames.findIndex((name) => {
                            return name === value as string;
                        });
                        availableNames.splice(index, 1);
                        dialog.updateActiveContexts({
                            add: [value as string],
                            remove: availableNames,
                        });
                    },
                },
                databaseTypeDescription: {
                    type: "description",
                    caption: " ", // To vertically align the description with the type drop down.
                    value: "Choose a type for this database connection",
                },
            },
        };

        const informationSection: IDialogSection = {
            values: {
                caption: {
                    type: "text",
                    caption: "Caption:",
                    value: details.caption,
                    placeholder: "<enter a unique caption>",
                    options: [CommonDialogValueOption.AutoFocus],
                },
                description: {
                    type: "text",
                    caption: "Description:",
                    value: details.description,
                    placeholder: "<describe the connection>",
                },
            },
        };

        const sqliteDetailsSection: IDialogSection = {
            contexts: ["Sqlite"],
            caption: "Basic",
            groupName: "groupSqlite",
            values: {
                dbFilePath: {
                    type: "resource",
                    caption: "Database Path:",
                    value: optionsSqlite.dbFile,
                    filters: { "SQLite 3": ["sqlite3", "sqlite"] },
                    placeholder: "<Enter the DB file location>",
                    horizontalSpan: 8,
                },
                dbName: {
                    type: "text",
                    caption: "Database Name:",
                    value: optionsSqlite.dbName,
                    placeholder: "<enter a database name>",
                },
            },
        };

        const sqliteAdvancedSection: IDialogSection = {
            contexts: ["Sqlite"],
            caption: "Advanced",
            groupName: "groupSqlite",
            values: {
                otherParameters: {
                    type: "text",
                    caption: "Other Parameters:",
                    value: optionsSqlite.otherParameters,
                    horizontalSpan: 8,
                    multiLine: true,
                },
            },
        };

        const detailsHeaderSection: IDialogSection = {
            caption: "Connection Details",
            values: {
            },
        };

        const mysqlDetailsSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "Basic",
            groupName: "group1",
            values: {
                hostName: {
                    type: "text",
                    caption: "Host Name or IP Address",
                    value: optionsMySQL.host,
                    horizontalSpan: 4,
                },
                scheme: {
                    type: "choice",
                    caption: "Protocol",
                    value: optionsMySQL.scheme,
                    choices: [MySQLConnectionScheme.MySQL, MySQLConnectionScheme.MySQLx],
                    horizontalSpan: 2,
                },
                port: {
                    type: "number",
                    caption: "Port",
                    value: optionsMySQL.port ?? 3306,
                    horizontalSpan: 2,
                },
                userName: {
                    type: "text",
                    caption: "User Name",
                    value: optionsMySQL.user,
                    horizontalSpan: 4,
                },
                storePassword: {
                    type: "button",
                    value: "Store Password",
                    onClick: this.storePassword,
                    horizontalSpan: 2,
                },
                clearPassword: {
                    type: "button",
                    value: "Clear Password",
                    onClick: this.clearPassword,
                    horizontalSpan: 2,
                },
                defaultSchema: {
                    type: "text",
                    caption: "Default Schema",
                    value: optionsMySQL.schema,
                    horizontalSpan: 4,
                },
                connectionTunnelingTitle: {
                    type: "description",
                    caption: "Tunneling Options",
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                useSSH: {
                    type: "boolean",
                    caption: "Connect using SSH Tunnel",
                    value: details.useSSH === true,
                    horizontalSpan: 4,
                    onChange: (value: boolean, dialog: ValueEditDialog): void => {
                        const contexts = {
                            add: value ? ["useSSH"] : [],
                            remove: value ? [] : ["useSSH"],
                        };
                        dialog.updateActiveContexts(contexts);
                    },
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                useMDS: {
                    type: "boolean",
                    caption: "Connect using OCI Bastion service",
                    value: details.useMDS === true,
                    onChange: (value: boolean, dialog: ValueEditDialog): void => {
                        // The MDS tab should be shown/hidden based on the checkbox value
                        const contexts = {
                            add: value ? ["useMDS"] : [],
                            remove: value ? [] : ["useMDS"],
                        };
                        dialog.updateActiveContexts(contexts);

                        if (value) {
                            this.shellSession.mds.getMdsConfigProfiles().then((profiles) => {
                                this.fillProfileDropdown(profiles);
                            }).catch((reason) => {
                                void requisitions.execute("showError", ["Error while loading OCI profiles",
                                    String(reason.message)]);
                            });
                        }
                    },
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        const mysqlSslSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "SSL",
            groupName: "group1",
            values: {
                sslMode: {
                    type: "choice",
                    caption: "SSL Mode",
                    value: ConnectionBrowser.mysqlSslModeMap
                        .get(optionsMySQL["ssl-mode"] ?? MySQLSslMode.Preferred),
                    choices: Array.from(ConnectionBrowser.mysqlSslModeMap.values()),
                    horizontalSpan: 3,
                },
                sslCipher: {
                    type: "text",
                    caption: "Permitted ciphers (optional, comma separated list)",
                    value: optionsMySQL["ssl-cipher"] as string,
                    horizontalSpan: 5,
                },
                sslCaFile: {
                    type: "resource",
                    caption: "Path to Certificate Authority file for SSL",
                    value: optionsMySQL["ssl-ca"],
                    horizontalSpan: 8,
                },
                sslCertFile: {
                    type: "resource",
                    caption: "Path to Client Certificate file for SSL",
                    value: optionsMySQL["ssl-cert"],
                    horizontalSpan: 8,
                },
                sslKeyFile: {
                    type: "resource",
                    caption: "Path to Client Key file for SSL",
                    value: optionsMySQL["ssl-key"],
                    horizontalSpan: 8,
                },
            },
        };

        const mysqlSshSection: IDialogSection = {
            contexts: ["MySQL", "useSSH"],
            caption: "SSH Tunnel",
            groupName: "group1",
            values: {
                ssh: {
                    type: "text",
                    caption: "SSH URI (<user>@<host>:22)",
                    value: optionsMySQL.ssh,
                    horizontalSpan: 4,
                },
                sshKeyFile: {
                    type: "resource",
                    caption: "SSH Private Key File",
                    value: optionsMySQL["ssh-identity-file"] ?? "id_rsa",
                    horizontalSpan: 4,
                },
                sshConfigFilePath: {
                    type: "resource",
                    caption: "Custom Path for the SSH Configuration File",
                    value: optionsMySQL["ssh-config-file"],
                    horizontalSpan: 8,
                },
            },
        };

        const mysqlAdvancedSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "Advanced",
            groupName: "group1",
            values: {
                // ansiQuotes: {
                //     caption: "Use ANSI Quotes to Quote Identifiers",
                //     value: optionsMySQL.useAnsiQuotes ?? false,
                //     options: [DialogValueOption.Grouped],
                // },
                // clearTextAuth: {
                //     caption: "Enable ClearText Authentication",
                //     value: optionsMySQL.enableClearTextAuthPlugin ?? false,
                //     options: [DialogValueOption.Grouped],
                // },
                sqlMode: {
                    type: "checkList",
                    caption: "SQL Mode",
                    value: optionsMySQL["sql-mode"] as string[],
                    checkList: Object.keys(MySQLSqlMode).map((k) => {
                        const result: ICheckboxProperties = {
                            id: k.toString(),
                            caption: MySQLSqlMode[k],
                            checkState: CheckState.Unchecked,
                        };

                        return { data: result };
                    }),
                    horizontalSpan: 4,
                    verticalSpan: 3,
                },
                timeout: {
                    type: "number",
                    caption: "Connection Timeout",
                    value: optionsMySQL["connect-timeout"],
                    horizontalSpan: 4,
                },
                compression: {
                    type: "choice",
                    caption: "Compression",
                    value: optionsMySQL.compression,
                    choices: Object.keys(MySQLConnCompression),
                    horizontalSpan: 2,
                    optional: true,
                },
                compressionLevel: {
                    type: "number",
                    caption: "Compression Level",
                    value: optionsMySQL["compression-level"] ?? 3,
                    horizontalSpan: 2,

                },
                compressionAlgorithms: {
                    type: "set",
                    caption: "Compression Algorithms",
                    value: optionsMySQL["compression-algorithms"]?.split(","),
                    tagSet: ["zstd", "zlib", "lz4", "uncompressed"],
                    horizontalSpan: 4,
                },
                disableHeatwaveCheckTitle: {
                    type: "description",
                    caption: "Connection Startup Checks",
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                disableHeatwaveCheck: {
                    type: "boolean",
                    caption: "Disable HeatWave Check",
                    value: optionsMySQL["disable-heat-wave-check"] ?? false,
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                others: {
                    type: "matrix",
                    caption: "Other Connection Options",
                    value: this.parseConnectionAttributes(optionsMySQL["connection-attributes"] ?? {}),
                    horizontalSpan: 8,
                },
            },
        };

        this.activeOciProfileName = optionsMySQL["profile-name"];

        const mdsAdvancedSection: IDialogSection = {
            contexts: ["MySQL", "useMDS"],
            caption: "MDS/Bastion Service",
            groupName: "group1",
            values: {
                profileName: {
                    type: "choice",
                    caption: "Profile Name",
                    value: this.activeOciProfileName,
                    horizontalSpan: 4,
                    choices: this.ociProfileNames ? this.ociProfileNames.map((item) => { return item.profile; }) : [],
                    onChange: this.handleProfileNameChange,
                },
                databaseTypeDescription: {
                    type: "description",
                    caption: " ", // To vertically align the description with the type drop down.
                    value: "",
                },
                sshKeyFile: {
                    type: "resource",
                    caption: "SSH Private Key File",
                    value: optionsMySQL["ssh-identity-file"] ?? "id_rsa_mysql_shell",
                    horizontalSpan: 4,
                },
                sshPublicKeyFile: {
                    type: "resource",
                    caption: "SSH Public Key File",
                    value: details.useMDS ? optionsMySQL["ssh-public-identity-file"] ?? "id_rsa_mysql_shell.pub" : "",
                    horizontalSpan: 4,
                    options: !details.useMDS ? [CommonDialogValueOption.Disabled] : [],
                },
                mysqlDbSystemId: {
                    type: "text",
                    caption: "MySQL DB System OCID",
                    value: optionsMySQL["mysql-db-system-id"],
                    horizontalSpan: 8,
                    onFocusLost: this.handleDbSystemIdChange,
                },
                bastionId: {
                    type: "text",
                    caption: "Bastion OCID",
                    value: this.liveUpdateFields.bastionId.value,
                    horizontalSpan: 8,
                    showLoading: this.liveUpdateFields.bastionId.loading,
                    onFocusLost: this.handleBastionIdChange,
                },
                mysqlDbSystemName: {
                    type: "text",
                    caption: "MySQL DB System Name",
                    value: this.liveUpdateFields.mdsDatabaseName.value,
                    showLoading: this.liveUpdateFields.mdsDatabaseName.loading,
                    options: [CommonDialogValueOption.Disabled],
                    horizontalSpan: 4,
                },
                bastionName: {
                    type: "text",
                    caption: "Bastion Name",
                    value: this.liveUpdateFields.bastionName.value,
                    showLoading: this.liveUpdateFields.mdsDatabaseName.loading,
                    options: [CommonDialogValueOption.Disabled],
                    horizontalSpan: 4,
                },
            },
        };

        return {
            id: String(details.id),
            sections: new Map<string, IDialogSection>([
                ["general", generalSection],
                ["information", informationSection],
                ["detailsHeaderSection", detailsHeaderSection],
                ["sqliteDetails", sqliteDetailsSection],
                ["sqliteAdvanced", sqliteAdvancedSection],
                ["mysqlDetails", mysqlDetailsSection],
                ["ssl", mysqlSslSection],
                ["mysqlAdvanced", mysqlAdvancedSection],
                ["ssh", mysqlSshSection],
                ["mdsAdvanced", mdsAdvancedSection],
            ]),
        };
    };

    private handleBastionIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.bastionId.value || forceUpdate) {
            this.liveUpdateFields.bastionId.value = value;
            this.beginValueUpdating("Loading...", "bastionName");

            this.shellSession.mds.getMdsBastion(this.liveUpdateFields.profileName, value).then((summary) => {
                if (summary) {
                    this.updateInputValue(summary.name, "bastionName");
                }
            }).catch((reason) => {
                this.updateInputValue(reason as string, "bastionName");
            });
        }
    };

    private handleDbSystemIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.dbSystemId || forceUpdate) {
            this.liveUpdateFields.dbSystemId = value;
            this.beginValueUpdating("Loading...", "mysqlDbSystemName");

            this.shellSession.mds.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, value).then((system) => {
                if (system) {
                    this.updateInputValue(system.displayName, "mysqlDbSystemName");
                }
            }).catch((reason) => {
                void requisitions.execute("showError", ["Get Mds Database Error", reason as string]);
                this.updateInputValue("<error loading mds database info>",
                    "mysqlDbSystemName");
            });
        }
    };

    private handleProfileNameChange = (value: DialogValueType, dialog: ValueEditDialog): void => {
        const entry = value as string;
        if (this.liveUpdateFields.profileName !== entry) {
            this.liveUpdateFields.profileName = entry;
            this.handleBastionIdChange(this.liveUpdateFields.bastionId.value, dialog, true);
            this.handleDbSystemIdChange(this.liveUpdateFields.dbSystemId, dialog, true);
        }
    };

    private handleTabSelect = (id: string): void => {
        if (id === "MDS") {
            this.shellSession.mds.getMdsConfigProfiles().then((profiles) => {
                this.fillProfileDropdown(profiles);
            }).catch((reason) => {
                void requisitions.execute("showError", ["Error when loading OCI profiles", String(reason)]);
            });
        }
    };

    private fillProfileDropdown(profiles: IMdsProfileData[] | undefined) {
        this.ociProfileNames = profiles;
        const items = this.ociProfileNames?.map((item) => { return item.profile; }) ?? [];
        const found = this.ociProfileNames?.find((item) => { return item.isCurrent === true; });
        if (!this.activeOciProfileName) {
            this.activeOciProfileName = found?.profile;
            this.liveUpdateFields.profileName = this.activeOciProfileName ?? "";
        } else {
            const profile = items.find((item) => { return item === this.activeOciProfileName; });
            if (!profile) {
                items.unshift(this.activeOciProfileName);
            }
        }
        items.unshift(" ");
        this.editorRef.current?.updateDropdownValue(items, this.activeOciProfileName ?? "", "profileName");
    }

    private async createBastion(): Promise<IBastionSummary | undefined> {
        try {
            const summary = await this.shellSession.mds.createBastion(this.liveUpdateFields.profileName,
                this.liveUpdateFields.dbSystemId, true);

            return summary;
        } catch (reason) {
            void requisitions.execute("showError", ["Create Bastion Error", String(reason)]);
            this.updateInputValue("<failed to create default bastion>", "bastionName");
            this.editorRef.current?.updateInputValue("<failed to create default bastion>", "bastionId");

            throw reason;
        }
    }

    private parseConnectionAttributes(value: { [key: string]: string; }): IDictionary[] {
        return Object.entries(value).map((entry) => {
            return { key: entry[0], value: entry[1] };
        });
    }

    /**
     * Helper function to check if a dialog value is actually an integer number.
     *
     * @param value The value to check.
     *
     * @returns The value as number, if
     */
    private checkValidInt(value: DialogValueType): number | undefined {
        if (typeof value === "number") {
            if (Math.trunc(value) !== value) {
                return undefined;
            }
        } else {
            const result = filterInt(value?.toString());
            if (isNaN(result) || result < 0) {
                return undefined;
            }
        }

        return value as number;
    }

    private beginValueUpdating = (value: string, valueId: string): void => {
        switch (valueId) {
            case "bastionName": {
                this.liveUpdateFields.bastionName.loading = true;
                this.liveUpdateFields.bastionName.value = value;
                break;
            }

            case "bastionId": {
                this.liveUpdateFields.bastionId.loading = true;
                this.liveUpdateFields.bastionId.value = value;
                break;
            }

            case "mysqlDbSystemName": {
                this.liveUpdateFields.mdsDatabaseName.loading = true;
                this.liveUpdateFields.mdsDatabaseName.value = value;
                break;
            }

            default:
        }
        this.editorRef.current?.beginValueUpdating(value, valueId);
    };

    private updateInputValue = (value: string, valueId: string): void => {
        switch (valueId) {
            case "bastionName": {
                this.liveUpdateFields.bastionName.loading = false;
                this.liveUpdateFields.bastionName.value = value;
                break;
            }
            case "bastionId": {
                this.liveUpdateFields.bastionId.loading = false;
                this.liveUpdateFields.bastionId.value = value;
                break;
            }
            case "mysqlDbSystemName": {
                this.liveUpdateFields.mdsDatabaseName.loading = false;
                this.liveUpdateFields.mdsDatabaseName.value = value;
                break;
            }
            default: {
                break;
            }
        }
        this.editorRef.current?.updateInputValue(value, valueId);
    };

    private storePassword = (_id: string, values: IDialogValues): void => {
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const user = mysqlDetailsSection.userName.value as string;
        const host = mysqlDetailsSection.hostName.value as string;
        const port = mysqlDetailsSection.port.value as string;
        if (user && host) {
            const passwordRequest: IServicePasswordRequest = {
                requestId: "userInput",
                caption: "Open MySQL Connection",
                service: `${user}@${host}:${port}`,
                user,
            };
            void requisitions.execute("requestPassword", passwordRequest);
        } else {
            void requisitions.execute("showError", ["Missing Mandatory Fields",
                "User, Host and port cannot be empty."]);
        }
    };

    private clearPassword = (_id: string, values: IDialogValues): void => {
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const user = mysqlDetailsSection.userName.value as string;
        const host = mysqlDetailsSection.hostName.value as string;
        const port = mysqlDetailsSection.port.value as string;
        if (user && host) {
            ShellInterface.users.clearPassword(`${user}@${host}:${port}`).then(() => {
                if (this.confirmClearPasswordDialogRef.current) {
                    this.confirmClearPasswordDialogRef.current.show(
                        (<Container orientation={Orientation.TopDown}>
                            <Grid columns={["auto"]} columnGap={5}>
                                <GridCell crossAlignment={ContentAlignment.Stretch}>
                                    Password was cleared.
                                </GridCell>
                            </Grid>
                        </Container>),
                        { accept: "OK" },
                        "Password Cleared",
                    );
                    // TODO: show message for success, once we have message toasts.
                }
            }).catch((reason) => {
                void requisitions.execute("showError", ["Clear Password Error", String(reason.message)]);
            });
        }
    };

    private acceptPassword = async (
        data: { request: IServicePasswordRequest; password: string; }): Promise<boolean> => {
        if (data.request.service) {
            try {
                await ShellInterface.users.storePassword(data.request.service, data.password);
            } catch (reason) {
                void requisitions.execute("showError", ["Accept Password Error", String(reason)]);
            }

            return true;
        }

        return false;
    };

    private testConnection = (values: IDialogValues, buttonProps: IButtonProperties): void => {
        const { connections } = this.props;
        switch (buttonProps?.caption) {
            case "Abort":
                this.hideProgress();
                this.editorRef.current?.changeAdvActionText("Test connection");
                break;
            default: {
                this.editorRef.current?.preventConfirm(true);
                if (this.connectionId !== -1) {
                    this.testNotExisting = false;
                    const details = connections.find((candidate) => { return candidate.id === this.connectionId; });
                    this.runTest(details);
                } else {
                    // First create connection, then open and test.
                    // At the end open confirm dialog with question: keep or delete connection.
                    this.testNotExisting = true;
                    const result = this.validateConnectionValues(true, values, { creteNew: true });
                    if (Object.keys(result.messages).length > 0) {
                        let problems = "";
                        Object.keys(result.messages).forEach((name: string) => {
                            problems += `${result.messages[name]}; `;
                        });
                        void requisitions.execute("showError", ["Missing Connection Details", problems]);
                        this.editorRef.current?.preventConfirm(false);
                        this.hideProgress();
                        this.editorRef.current?.changeAdvActionText("Test connection");
                    } else {
                        this.handleOptionsDialogClose(DialogResponseClosure.Accept, values, { createNew: true },
                            { onAddConnection: this.saveAndTestConnection } as ICallbackData);
                    }
                }
            }
        }
    };

    private saveAndTestConnection = (details: IConnectionDetails): void => {
        ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId, details).then((connectionId) => {
            if (connectionId) {
                details.id = connectionId;
                this.connectionId = details.id;
                this.runTest(details);
            }
        }).catch((event) => {
            void requisitions.execute("showError",
                ["Add Connection Error", "Cannot add DB connection:", String(event.message)]);

        });
    };

    private dropTempConnection = (connectionId: number): void => {
        void ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connectionId).then(() => {
            this.testNotExisting = false;
            this.connectionId = -1;
        });
    };

    private runTest(details?: IConnectionDetails) {
        const backend = new ShellInterfaceSqlEditor();
        this.showProgress();
        if (details) {
            const id = `${details.caption}.ID-${this.connectionId}`;
            this.editorRef.current?.changeAdvActionText("Abort");
            this.setProgressMessage("Starting session...");
            backend.startSession(id).then(() => {
                this.setProgressMessage("Session created, opening connection...");

                // Before opening the connection check the DB file, if this is an sqlite connection.
                if (details.dbType === DBType.Sqlite) {
                    const options = details.options as ISqliteConnectionOptions;
                    ShellInterface.core.validatePath(options.dbFile).then(() => {
                        void this.testOpenConnection(backend, details);
                    }).catch(() => {
                        // If the path is not ok then we might have to create the DB file first.
                        ShellInterface.core.createDatabaseFile(options.dbFile).then(() => {
                            void this.testOpenConnection(backend, details);
                        }).catch((reason) => {
                            void requisitions.execute("showError", ["Connection Error", String(reason)]);
                            if (this.testNotExisting) {
                                this.dropTempConnection(this.connectionId);
                            }
                        });
                    });
                } else {
                    void this.testOpenConnection(backend, details);
                }
                this.hideProgress();
                this.editorRef.current?.changeAdvActionText(undefined);
                this.editorRef.current?.preventConfirm(false);
            }).catch((reason) => {
                if (this.testNotExisting) {
                    this.dropTempConnection(this.connectionId);
                }
                void requisitions.execute("showError", ["Connection Error", String(reason)]);
                this.editorRef.current?.changeAdvActionText(undefined);
                this.hideProgress();
                this.editorRef.current?.preventConfirm(false);
            });
        }
    }

    private async testOpenConnection(backend: ShellInterfaceSqlEditor, connection: IConnectionDetails): Promise<void> {
        try {
            await backend.openConnection(connection.id, undefined, ((response, requestId) => {
                if (!ShellPromptHandler.handleShellPrompt(response.result as IShellPasswordFeedbackRequest, requestId,
                    backend, "Provide Password")) {
                    this.setProgressMessage("Loading ...");
                }
            }));

            this.setProgressMessage("Test connection successfully.");
            if (this.testNotExisting) {
                this.confirmKeepConnection(connection);
            } else {
                this.successConnectionInfo(connection);
            }

            this.hideProgress();
            this.editorRef.current?.changeAdvActionText(undefined);
        } catch (reason) {
            await requisitions.execute("showError", ["Connection Error", String(reason)]);
            if (this.testNotExisting) {
                this.dropTempConnection(this.connectionId);
            }

            this.hideProgress();
            this.editorRef.current?.changeAdvActionText(undefined);

            throw reason;
        }
    }

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.setState({ loading: true });
    };

    private hideProgress = (): void => {
        this.setState({ loading: false, progressMessage: "" });
    };

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (response.id === "deleteConnection") {
            const details = response.data?.connection as IConnectionDetails;
            if (details && response.closure === DialogResponseClosure.Accept) {
                const { onDropConnection } = this.props;

                onDropConnection(details.id);
                requisitions.executeRemote("refreshConnections", undefined);
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

}
