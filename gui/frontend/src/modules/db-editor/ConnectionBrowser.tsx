/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import mysqlIcon from "../../assets/images/connectionMysql.svg";
import sqliteIcon from "../../assets/images/connectionSqlite.svg";

import plusIcon from "../../assets/images/plus.svg";
import editIcon from "../../assets/images/edit.svg";
import cloneIcon from "../../assets/images/clone.svg";

import { ComponentChild, createRef } from "preact";
import { Children } from "preact/compat";

import { requisitions } from "../../supplement/Requisitions.js";

import { MySQLConnectionScheme } from "../../communication/MySQL.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { IMySQLDbSystem } from "../../communication/index.js";
import {
    DialogResponseClosure, DialogType, IDialogResponse, IDictionary, IServicePasswordRequest,
} from "../../app-logic/Types.js";
import { IToolbarItems } from "./index.js";
import {
    BrowserTileType, IBrowserTileProperties, ITileActionOptions,
} from "../../components/ui/BrowserTile/BrowserTile.js";
import {
    IComponentProperties, ComponentBase, ComponentPlacement,
} from "../../components/ui/Component/ComponentBase.js";
import { ConnectionTile, IConnectionTileProperties } from "../../components/ui/ConnectionTile/ConnectionTile.js";
import { Container, Orientation, ContentWrap } from "../../components/ui/Container/Container.js";
import { FrontPage } from "../../components/ui/FrontPage/FrontPage.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { MenuItem, IMenuItemProperties } from "../../components/ui/Menu/MenuItem.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { IConnectionDetails, DBType } from "../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ConnectionEditor } from "./ConnectionEditor.js";

interface IConnectionBrowserProperties extends IComponentProperties {
    connections: IConnectionDetails[];
    toolbarItems: IToolbarItems;

    onAddConnection: (details: IConnectionDetails) => void;
    onUpdateConnection: (details: IConnectionDetails) => void;
    onDropConnection: (connectionId: number) => void;
    onPushSavedConnection?: (details: IConnectionDetails) => void;
}

export class ConnectionBrowser extends ComponentBase<IConnectionBrowserProperties> {

    private static dbTypeToIconMap = new Map<DBType, string>([
        [DBType.Sqlite, sqliteIcon],
        [DBType.MySQL, mysqlIcon],
    ]);

    private editorRef = createRef<ConnectionEditor>();
    private actionMenuRef = createRef<Menu>();
    private hostRef = createRef<HTMLDivElement>();

    private currentTileDetails?: IConnectionDetails; // Set during context menu invocation.

    public constructor(props: IConnectionBrowserProperties) {
        super(props);

        this.addHandledProperties("connections", "toolbarItems", "onAddConnection", "onUpdateConnection",
            "onDropConnection", "onPushSavedConnection");
    }

    public override componentDidMount(): void {
        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("dbFileDropped", this.dbFileDropped);
        requisitions.register("addNewConnection", this.addNewConnection);
        requisitions.register("editConnection", this.editConnection);
        requisitions.register("removeConnection", this.removeConnection);
        requisitions.register("duplicateConnection", this.duplicateConnection);
        requisitions.register("acceptPassword", this.acceptPassword);
        requisitions.register("dialogResponse", this.dialogResponse);
    }

    public override componentWillUnmount(): void {
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
        const { connections, toolbarItems, onAddConnection, onUpdateConnection } = this.props;

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

        // If toolbar items are given, render a toolbar with them.
        const toolbar = <Toolbar id="connectionOverviewToolbar" dropShadow={false} >
            {toolbarItems.navigation}
            <div className="expander" />
            {toolbarItems.auxillary}
        </Toolbar>;

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                wrap={ContentWrap.NoWrap}
            >
                {toolbar}
                < ConnectionEditor
                    ref={this.editorRef}
                    id="connectionEditor"
                    connections={connections}
                    onAddConnection={onAddConnection}
                    onUpdateConnection={onUpdateConnection}
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
                    caption="MySQL Shell - DB Connections"
                    description={
                        "Welcome to the MySQL Shell for VS Code extension.\n\n" +
                        "Click the [New Connection] tile to add a new database connection. Click a " +
                        "[Database Connection] tile to open a new DB Notebook.\n\n" +
                        "DB Notebooks are modern editors for working with databases. You can use them to " +
                        "create and manage databases schema objects, write SQL queries and scripts, and work with " +
                        "data."
                    }
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
        this.doHandleTileAction("new", undefined, options);

        return Promise.resolve(true);
    };

    private editConnection = (connectionId: number): Promise<boolean> => {
        const { connections } = this.props;

        const details = connections.find((candidate) => { return candidate.id === connectionId; });

        if (details) {
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
            this.doHandleTileAction("duplicate", details, undefined);

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

        // Don't wait here. The editor will be shown asynchronously.
        void this.editorRef.current?.show(DBType.Sqlite, true, {
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
        options?: ITileActionOptions): void => {
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
                void this.editorRef.current?.show(dbType, false, details);
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
                    void this.editorRef.current?.show(dbType, true, connectionDetails);

                } else {
                    void this.editorRef.current?.show(dbType, true);
                }
                break;
            }

            case "duplicate": {
                void this.editorRef.current?.show(dbType, true, details);

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
                        {
                            details,
                            force: options?.newTab as boolean ?? false,
                            initialEditor: options?.editor as ("notebook" | "script"),
                        });

                    // Notify the wrapper, if there's one, in case it has to update UI for the changed page.
                    requisitions.executeRemote("selectConnectionTab",
                        { connectionId: details?.id, page: "" });
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

    private acceptPassword = async (
        data: { request: IServicePasswordRequest; password: string; }): Promise<boolean> => {
        if (data.request.service) {
            try {
                await ShellInterface.users.storePassword(data.request.service, data.password);
            } catch (reason) {
                void requisitions.execute("showFatalError", ["Accept Password Error", String(reason)]);
            }

            return true;
        }

        return false;
    };

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (response.id === "deleteConnection") {
            const details = response.data?.connection as IConnectionDetails;
            if (details && response.closure === DialogResponseClosure.Accept) {
                const { onDropConnection } = this.props;

                onDropConnection(details.id);
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

}
