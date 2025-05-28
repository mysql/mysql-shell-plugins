/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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
import { Children } from "preact/compat";

import { requisitions } from "../../supplement/Requisitions.js";

import { DialogResponseClosure, DialogType, IDialogResponse, IDictionary } from "../../app-logic/general-types.js";
import { IMySQLDbSystem } from "../../communication/index.js";
import { Breadcrumb, type IBreadCrumbSegment } from "../../components/ui/Breadcrumb/Breadcrumb.js";
import { Codicon } from "../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, type IComponentState,
} from "../../components/ui/Component/ComponentBase.js";
import {
    ConnectionTile, ConnectionTileType, IConnectionTileProperties, type ITileActionOptions,
} from "../../components/ui/ConnectionTile/ConnectionTile.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { FrontPage } from "../../components/ui/FrontPage/FrontPage.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import {
    CdmEntityType, type ConnectionDMActionList, type ConnectionDataModel, type ICdmConnectionEntry,
    type ICdmConnectionGroupEntry,
} from "../../data-models/ConnectionDataModel.js";
import { Assets } from "../../supplement/Assets.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { DBType, IConnectionDetails, type IShellSessionDetails } from "../../supplement/ShellInterface/index.js";
import { uuid } from "../../utilities/helpers.js";
import { ConnectionEditor } from "./ConnectionEditor.js";
import { DocumentContext, type DocumentContextType, type IToolbarItems } from "./index.js";

interface IConnectionBrowserProperties extends IComponentProperties {
    toolbarItems: IToolbarItems;

    onAddConnection: (entry: ICdmConnectionEntry) => void;
    onUpdateConnection: (entry: ICdmConnectionEntry) => void;
    onRemoveConnection: (entry: ICdmConnectionEntry) => void;
}

interface IConnectionBrowserState extends IComponentState {
    currentGroup?: ICdmConnectionGroupEntry;
}

export class ConnectionBrowser extends ComponentBase<IConnectionBrowserProperties, IConnectionBrowserState> {
    public static override contextType = DocumentContext;

    private static dbTypeToIconMap = new Map<DBType, string>([
        [DBType.Sqlite, Assets.db.sqliteConnectionIcon],
        [DBType.MySQL, Assets.db.mysqlConnectionIcon],
    ]);

    private editorRef = createRef<ConnectionEditor>();
    private actionMenuRef = createRef<Menu>();
    private hostRef = createRef<HTMLDivElement>();

    private currentDataModelEntry?: ICdmConnectionEntry; // Set during context menu invocation.

    public constructor(props: IConnectionBrowserProperties) {
        super(props);

        this.state = {};
        this.addHandledProperties("toolbarItems", "onAddConnection", "onUpdateConnection", "onRemoveConnection");
    }

    public override componentDidMount(): void {
        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("refreshConnectionGroup", this.refreshConnectionGroup);
        requisitions.register("dbFileDropped", this.dbFileDropped);
        requisitions.register("addNewConnection", this.addNewConnection);
        requisitions.register("editConnection", this.editConnection);
        requisitions.register("removeConnection", this.removeConnection);
        requisitions.register("duplicateConnection", this.duplicateConnection);
        requisitions.register("dialogResponse", this.dialogResponse);

        const dataModel = this.dataModel;
        if (dataModel) {
            dataModel.subscribe(this.dataModelChanged);
        }
    }

    public override componentWillUnmount(): void {

        const dataModel = this.dataModel;
        if (dataModel) {
            dataModel.unsubscribe(this.dataModelChanged);
        }

        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
        requisitions.unregister("refreshConnectionGroup", this.refreshConnectionGroup);
        requisitions.unregister("dbFileDropped", this.dbFileDropped);
        requisitions.unregister("addNewConnection", this.addNewConnection);
        requisitions.unregister("editConnection", this.editConnection);
        requisitions.unregister("removeConnection", this.removeConnection);
        requisitions.unregister("duplicateConnection", this.duplicateConnection);
        requisitions.unregister("dialogResponse", this.dialogResponse);
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { currentGroup } = this.state;

        const className = this.getEffectiveClassNames(["connectionBrowser"]);

        let currentList = currentGroup ? currentGroup.entries : this.roots;
        const foldersFirst = Settings.get("dbEditor.connectionBrowser.sortFoldersFirst", true);
        if (foldersFirst) {
            currentList = Array.from(currentList); // Sort only the copy, not the original list.
            currentList.sort((a, b) => {
                const aIsGroup = a.type === CdmEntityType.ConnectionGroup ? 0 : 1;
                const bIsGroup = b.type === CdmEntityType.ConnectionGroup ? 0 : 1;

                return aIsGroup - bIsGroup;
            });
        }

        const tiles = [];

        if (currentGroup) {
            tiles.push(<ConnectionTile
                tileId={"-2"}
                key={-2}
                caption={"Back"}
                description={"Go up one folder level"}
                icon={Codicon.ChevronLeft}
                type={ConnectionTileType.Back}
                onAction={this.handleTileAction}
            />);
        }

        currentList.forEach((root) => {
            if (root.type === CdmEntityType.ConnectionGroup) {
                tiles.push(
                    <ConnectionTile
                        tileId={root.id}
                        key={root.id}
                        entry={root}
                        caption={root.caption}
                        description={"Connection Group"}
                        icon={Assets.file.folderIcon}
                        type={ConnectionTileType.Group}
                        draggable
                        onAction={this.handleTileAction}

                    //onTileReorder={this.handleTileReorder}
                    />,
                );
            } else {
                tiles.push(
                    <ConnectionTile
                        tileId={root.id}
                        key={root.details.id}
                        entry={root}
                        caption={root.caption}
                        description={root.details.description}
                        icon={ConnectionBrowser.dbTypeToIconMap.get(root.details.dbType)!}
                        type={ConnectionTileType.Open}
                        draggable
                        onAction={this.handleTileAction}

                    //onTileReorder={this.handleTileReorder}
                    />,
                );
            }
        });

        // Generate a string version of the folder path.
        let folderPath = "";
        const path: IBreadCrumbSegment[] = [];
        let runner = currentGroup;
        while (runner) {
            path.unshift({ id: runner.folderPath.id, caption: runner.caption + " / ", selected: false });
            if (folderPath.length > 0) {
                folderPath = "/" + folderPath;
            }
            folderPath = runner.caption + folderPath;

            runner = runner.parent;
        }

        if (path.length === 0) {
            path.unshift({ id: 1, caption: "/", selected: false });
        }

        const dataModel = this.dataModel;
        if (dataModel) {
            tiles.push(
                <ConnectionTile
                    tileId={"-1"}
                    key={-1}
                    entry={dataModel.createConnectionEntry({
                        id: -1,
                        dbType: DBType.MySQL,
                        useSSH: false,
                        useMHS: false,
                        caption: "New Connection",
                        description: "Add a new database connection",
                        options: {
                            dbFile: "",
                            dbName: "",
                        },
                        folderPath,
                        index: -1,
                    })}
                    caption="New Connection"
                    description="Add a new database connection"
                    icon={Assets.misc.plusIcon}
                    type={ConnectionTileType.CreateNew}
                    onAction={this.handleTileAction}

                //onTileReorder={this.handleTileReorder}
                />,
            );
        }

        // If toolbar items are given, render a toolbar with them.
        const toolbar = <Toolbar id="connectionOverviewToolbar" dropShadow={false} >
            {toolbarItems.navigation}
            <div className="expander" />
            {toolbarItems.auxiliary}
        </Toolbar>;

        const contentTitle = "Database Connections";

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                wrap={ContentWrap.NoWrap}
            >
                {toolbar}
                <ConnectionEditor
                    ref={this.editorRef}
                    id="connectionEditor"
                    onAddConnection={this.handleAddConnection}
                    onUpdateConnection={this.handleUpdateConnection}
                />
                <Menu
                    id="tileActionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleMenuItemClick}
                >
                    <MenuItem command={{ title: "Edit Connection…", command: "edit" }} icon={Assets.misc.editIcon} />
                    <MenuItem
                        command={{ title: "Duplicate Connection…", command: "duplicate" }}
                        icon={Assets.misc.cloneIcon}
                    />
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem command={{
                        title: "Open New MySQL Shell Console for this Connection",
                        command: "msg.newSessionUsingConnection",
                    }} icon={Codicon.Terminal} />
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem id="remove" command={{ title: "Remove Connection…", command: "remove" }} />
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
                    <Container
                        id="frontPageContent"
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Label id="contentTitle" caption={contentTitle} />
                        <Breadcrumb
                            path={path}
                            onSelect={this.handleSelectPath}
                        />
                    </Container>
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

    private addNewConnection = (details: { mdsData?: IMySQLDbSystem; profileName?: string; }): Promise<boolean> => {
        const options = details.mdsData as ITileActionOptions & { profileName?: string; };
        if (options) {
            options.profileName = details.profileName;
        }
        this.doHandleTileAction("new", undefined, options);

        return Promise.resolve(true);
    };

    private editConnection = (connectionId: number): Promise<boolean> => {
        const connections = this.dataModel?.connectionList;
        const connection = connections?.find((candidate) => {
            return candidate.type === CdmEntityType.Connection && candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("edit", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private removeConnection = (connectionId: number): Promise<boolean> => {
        const connections = this.dataModel?.connectionList;

        const connection = connections?.find((candidate) => {
            return candidate.type === CdmEntityType.Connection && candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("remove", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private duplicateConnection = (connectionId: number): Promise<boolean> => {
        const connections = this.dataModel?.connectionList;

        const connection = connections?.find((candidate) => {
            return candidate.type === CdmEntityType.Connection && candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("duplicate", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (entry?.key === "dbEditor.connectionBrowser.showGreeting"
            || entry?.key === "dbEditor.connectionBrowser.sortFoldersFirst") {
            this.forceUpdate();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    /**
     * Triggered when one specific or all top level groups need to be refreshed.
     * Refreshing the top level groups also means to refresh all top level connections.
     *
     * @param groupId The id of the group to refresh. If not provided, the top level groups are refreshed.
     *
     * @returns A promise that resolves to `true`.
     */
    private refreshConnectionGroup = async (groupId?: number): Promise<boolean> => {
        if (groupId !== undefined && groupId >= 0) {
            const context = this.context as DocumentContextType;
            if (context) {
                const group = context.connectionsDataModel.findConnectionGroupEntryById(groupId);
                if (group) {
                    await group.refresh?.();
                    this.forceUpdate();
                } else {
                    await context.connectionsDataModel.reloadConnections();
                }
            }
        }

        return Promise.resolve(true);
    };

    private handleCloseGreeting = (): void => {
        Settings.set("dbEditor.connectionBrowser.showGreeting", false);
    };

    private dbFileDropped = (fileName: string): Promise<boolean> => {
        // First remove drop zone.
        if (this.hostRef.current) {
            this.hostRef.current.classList.remove("dropTarget");
        }

        if (!this.dataModel) {
            return Promise.resolve(false);
        }

        const connections = this.dataModel?.connectionList;
        const caption = `New Connection ${connections.length}`;
        const description = "A new Database Connection";
        const folderPath = this.generateFolderPathFromCurrentGroup();

        // Don't wait here. The editor will be shown asynchronously.
        void this.editorRef.current?.show(DBType.Sqlite, true, "", {
            id: -1,
            dbType: DBType.Sqlite,
            caption,
            description,
            useMHS: false,
            useSSH: false,
            options: {
                dbFile: fileName,
            },
            folderPath,
            index: -1,
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

    private handleMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (!props.children || Children.count(props.children) === 0) {
            const command = props.command.command;
            this.doHandleTileAction(command, this.currentDataModelEntry, {});

            return true;
        }

        return false;
    };

    private handleTileAction = (action: string, props: IConnectionTileProperties | undefined,
        options: unknown): void => {

        const tileProps = props as IConnectionTileProperties;
        if (action === "new") {
            this.doHandleTileAction(action, undefined, options as IDictionary);
        } else {
            this.doHandleTileAction(action, tileProps?.entry, options as IDictionary);
        }
    };

    private doHandleTileAction = (action: string, entry: ICdmConnectionEntry | ICdmConnectionGroupEntry | undefined,
        options?: ITileActionOptions): void => {

        let dbType: DBType | undefined;

        if (entry?.type === CdmEntityType.Connection) {
            dbType = entry?.details ? entry.details.dbType : DBType.MySQL;
        } else if (action === "new") {
            void this.editorRef.current?.show(DBType.MySQL, true, this.generateFolderPathFromCurrentGroup());

            return;
        } else {
            // Can only be group activation. If entry is undefined, we have to go up one level.
            if (!entry) {
                let { currentGroup } = this.state;
                if (currentGroup && currentGroup.parent) { // Just a sanity check. You cannot go up on root level.
                    currentGroup = currentGroup.parent;
                    void currentGroup.refresh?.().then(() => {
                        if (currentGroup!.folderPath.caption === "/") {
                            // This is the root group - no parent.
                            currentGroup = undefined;
                        }

                        this.setState({ currentGroup });
                    });
                }
            } else {
                void entry.refresh?.().then(() => {
                    this.setState({ currentGroup: entry });
                });
            }

            return;
        }

        switch (action) {
            case "menu": {
                this.currentDataModelEntry = entry;
                if (options && options.target instanceof HTMLElement) {
                    const rect = options.target.getBoundingClientRect();
                    this.actionMenuRef.current?.open(rect, false);
                }
                break;
            }

            case "edit": {
                void this.editorRef.current?.show(dbType, false, "", entry.details);
                break;
            }

            case "duplicate": {
                void this.editorRef.current?.show(dbType, true, "", entry.details);

                break;
            }

            case "remove": {
                if (entry) {
                    this.confirmTileRemoval(entry);
                }

                break;
            }

            case "open": {
                if (entry) {
                    void requisitions.execute("openConnectionTab",
                        {
                            connection: entry,
                            force: options?.newTab as boolean ?? false,
                            initialEditor: options?.editor as ("notebook" | "script"),
                        });

                    // Notify the wrapper, if there's one, in case it has to update UI for the changed page.
                    requisitions.executeRemote("selectConnectionTab",
                        { connectionId: entry?.details.id });
                }

                break;
            }

            case "msg.newSessionUsingConnection": {
                const details: IShellSessionDetails = {
                    sessionId: uuid(),
                    dbConnectionId: entry?.details.id,
                    caption: entry?.caption,
                };
                void requisitions.execute("openSession", details);
                break;
            }

            default: {
                break;
            }
        }
    };

    private confirmTileRemoval = (entry: ICdmConnectionEntry): void => {
        setTimeout(() => {
            void requisitions.execute("showDialog", {
                type: DialogType.Confirm,
                id: "deleteConnection",
                parameters: {
                    prompt: `You are about to remove the connection "${entry.details.caption}" from the list.`,
                    refuse: "Cancel",
                    accept: "Confirm",
                    default: "Cancel",
                },
                data: { entry },
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

    private dialogResponse = async (response: IDialogResponse): Promise<boolean> => {
        if (response.id === "deleteConnection") {
            const entry = response.data?.entry as ICdmConnectionEntry;
            if (entry && response.closure === DialogResponseClosure.Accept && this.dataModel) {
                const { onRemoveConnection } = this.props;
                onRemoveConnection(entry);
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleAddConnection = (details: IConnectionDetails): void => {
        const { onAddConnection } = this.props;

        const model = this.dataModel;
        if (model) {
            onAddConnection(model.createConnectionEntry(details));
        }
    };

    private handleUpdateConnection = (details: IConnectionDetails): void => {
        const { onUpdateConnection } = this.props;

        const model = this.dataModel;
        if (model) {
            const entry = model.findConnectionEntryById(details.id);
            if (entry) {
                onUpdateConnection(entry);
                this.forceUpdate();
            }
        }
    };

    private get roots(): Array<ICdmConnectionEntry | ICdmConnectionGroupEntry> {
        return (this.context as DocumentContextType)?.connectionsDataModel.roots ?? [];
    }

    private get dataModel(): ConnectionDataModel | undefined {
        return (this.context as DocumentContextType)?.connectionsDataModel;
    }

    private dataModelChanged = (actions: Readonly<ConnectionDMActionList>): void => {
        if (actions.length === 1) {
            // Check if our current group was removed.
            const { currentGroup } = this.state;

            const action = actions[0];
            if (action.action === "remove" && action.entry === currentGroup) {
                if (currentGroup?.parent) {
                    this.setState({
                        currentGroup: currentGroup.parent.folderPath.id === 1 ? undefined : currentGroup.parent,
                    });
                }
            }
        }

        this.forceUpdate();
    };

    private handleSelectPath = (path: number[]): void => {
        const dataModel = this.dataModel;
        if (dataModel) {
            const group = dataModel.findConnectionGroupById(path);
            if (group) {
                // Set undefined for the root group.
                this.setState({ currentGroup: group.folderPath.id === 1 ? undefined : group });
            }
        }
    };

    private generateFolderPathFromCurrentGroup(): string {
        const { currentGroup } = this.state;

        const path: string[] = [];
        let runner = currentGroup;
        while (runner) {
            path.unshift(runner.caption);
            runner = runner.parent;
        }

        return path.join("/");
    }
}
