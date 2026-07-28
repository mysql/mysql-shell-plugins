/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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
import { Button } from "../../components/ui/Button/Button.js";
import { Breadcrumb, type IBreadCrumbSegment } from "../../components/ui/Breadcrumb/Breadcrumb.js";
import { IUIExplainerStep, UIExplainer } from "../../components/ui/UIExplainer/UIExplainer.js";

import { MySQLConnectionScheme } from "../../communication/MySQL.js";
import { Codicon } from "../../components/ui/Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, type IComponentState,
} from "../../components/ui/Component/ComponentBase.js";
import {
    ConnectionTile, ConnectionTileType, IConnectionTileProperties, type IConnectionTileTag,
    type ITileActionOptions,
} from "../../components/ui/ConnectionTile/ConnectionTile.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Image } from "../../components/ui/Image/Image.js";
import { HelpLinkList } from "../../components/ui/HelpLinkList/HelpLinkList.js";
import { Label, TextAlignment } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import {
    CdmEntityType, type ConnectionDMActionList, type ConnectionDataModel, type ICdmConnectionEntry,
    type ICdmConnectionGroupEntry,
} from "../../data-models/ConnectionDataModel.js";
import { Assets } from "../../supplement/Assets.js";
import { IConnectionInfo } from "../../supplement/RequisitionTypes.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ProfileState } from "../../supplement/ProfileState.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import {
    DBType, IConnectionDetails, IFolderPath, type IShellSessionDetails,
} from "../../supplement/ShellInterface/index.js";
import {
    convertErrorToString, loadFileAsText, saveTextAsFile, selectFileInBrowser, uuid,
} from "../../utilities/helpers.js";
import { formatWithNumber } from "../../utilities/string-helpers.js";
import { ConnectionProcessor } from "../common/ConnectionProcessor.js";
import { ConnectionEditor } from "./ConnectionEditor.js";
import { ConnectionTags, connectionTagsChangedKey } from "./ConnectionTags.js";
import { DocumentContext, type DocumentContextType, type IToolbarItems } from "./index.js";
import { startMigrationAssistantWithValidatedPassword } from "./SidebarCommandHandler.js";
import { ui } from "../../app-logic/UILayer.js";
import {
    LegacyConfigurationImportPanel,
} from "../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportPanel.js";
import { hasElectronHostBridge } from "../../supplement/ElectronDesktop.js";
import { helpUrlMap } from "../../supplement/index.js";
import { webSession } from "../../supplement/WebSession.js";
import { ConnectionBrowserPanel } from "./ConnectionBrowserPanel.js";

interface IConnectionBrowserProperties extends IComponentProperties {
    toolbarItems: IToolbarItems;
    showToolbar?: boolean;

    onAddConnection: (entry: ICdmConnectionEntry) => void | Promise<void>;
    onUpdateConnection: (entry: ICdmConnectionEntry) => void;
    onRemoveConnection: (entry: ICdmConnectionEntry) => void;
}

interface IConnectionBrowserState extends IComponentState {
    currentGroup?: ICdmConnectionGroupEntry;
    moveTargetGroups: ICdmConnectionGroupEntry[];
    showMoveToRoot: boolean;
    tourActive: boolean;
}

interface IConnectionBrowserExportEntry {
    dbType: DBType;
    caption: string;
    description: string;
    options: IDictionary;
    folderPath: string;
    useSSH?: boolean;
    useMHS?: boolean;
    settings?: IConnectionDetails["settings"];
    tags?: string[];
}

interface IConnectionBrowserExportFile {
    version: 1;
    connectionTags?: Record<string, string>;
    connections: IConnectionBrowserExportEntry[];
}

export class ConnectionBrowser extends ComponentBase<IConnectionBrowserProperties, IConnectionBrowserState> {
    public static override contextType = DocumentContext;

    private static dbTypeToIconMap = new Map<DBType, string>([
        [DBType.Sqlite, Assets.db.sqliteConnectionIcon],
        [DBType.MySQL, Assets.db.mysqlConnectionIcon],
    ]);

    private editorRef = createRef<ConnectionEditor>();
    private connectionActionMenuRef = createRef<Menu>();
    private groupActionMenuRef = createRef<Menu>();
    private browserActionMenuRef = createRef<Menu>();
    private hostRef = createRef<HTMLDivElement>();
    private newConnectionButtonRef = createRef<HTMLDivElement>();
    private newFolderButtonRef = createRef<HTMLDivElement>();
    private connectionTileTargetRef = createRef<HTMLElement>();
    private workspaceSelectorTargetRef = createRef<HTMLElement>();
    private homeTourRef = createRef<UIExplainer>();
    private currentActionMenuEntry?: ICdmConnectionEntry | ICdmConnectionGroupEntry;
    private actionMenuRequestId = 0;
    private readonly homeTourSteps: IUIExplainerStep[] = [{
        id: "new-connection",
        target: this.newConnectionButtonRef,
        title: "Add a database connection",
        content: "Start here to add a new MySQL connection to your home screen.",
        placement: ComponentPlacement.BottomLeft,
    }, {
        id: "connection-tile",
        target: this.connectionTileTargetRef,
        title: "Open a connection",
        content: "Select a connection tile to manage that database or execute SQL.",
        placement: ComponentPlacement.BottomLeft,
    }, {
        id: "workspace-switcher",
        target: this.workspaceSelectorTargetRef,
        title: "Switch workspaces",
        content: "Use the titlebar switcher to change connections or return to the home workspace.",
        placement: ComponentPlacement.BottomLeft,
    }, {
        id: "new-folder",
        target: this.newFolderButtonRef,
        title: "Organize connections",
        content: "Use the new folder button to organize connections into groups.",
        placement: ComponentPlacement.BottomRight,
    }];

    public constructor(props: IConnectionBrowserProperties) {
        super(props);

        this.state = {
            moveTargetGroups: [],
            showMoveToRoot: false,
            tourActive: false,
        };
        this.addHandledProperties("toolbarItems", "showToolbar", "onAddConnection", "onUpdateConnection",
            "onRemoveConnection");
    }

    public override componentDidMount(): void {
        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("profileStateChanged", this.handleProfileStateChanged);
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
        requisitions.unregister("profileStateChanged", this.handleProfileStateChanged);
        requisitions.unregister("refreshConnectionGroup", this.refreshConnectionGroup);
        requisitions.unregister("dbFileDropped", this.dbFileDropped);
        requisitions.unregister("addNewConnection", this.addNewConnection);
        requisitions.unregister("editConnection", this.editConnection);
        requisitions.unregister("removeConnection", this.removeConnection);
        requisitions.unregister("duplicateConnection", this.duplicateConnection);
        requisitions.unregister("dialogResponse", this.dialogResponse);
    }

    public render(): ComponentChild {
        const { toolbarItems, showToolbar = true } = this.props;
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
                icon={Assets.toolbar.pagePreviousIcon}
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
                        tags={this.connectionTileTags(root.details)}
                        type={ConnectionTileType.Open}
                        draggable
                        onAction={this.handleTileAction}

                    //onTileReorder={this.handleTileReorder}
                    />,
                );
            }
        });

        const showBreadcrumb = currentGroup !== undefined || currentList.some((entry) => {
            return entry.type === CdmEntityType.ConnectionGroup;
        });
        const path: IBreadCrumbSegment[] = [];
        let runner = currentGroup;
        while (runner) {
            if (runner.folderPath.id !== 1 && runner.folderPath.caption !== "/") {
                path.unshift({
                    id: runner.folderPath.id,
                    caption: runner.caption,
                    selected: false,
                });
            }

            runner = runner.parent;
        }

        path.unshift({ id: 1, caption: "Home", selected: false });
        const currentSegment = path[path.length - 1];
        currentSegment.disabled = true;

        // If toolbar items are given, render a toolbar with them.
        const toolbar = showToolbar
            ? <Toolbar id="connectionOverviewToolbar" dropShadow={false} >
                {toolbarItems.navigation}
                <div className="expander" />
                {toolbarItems.auxiliary}
            </Toolbar>
            : null;

        const contentTitle = "Database Connections";
        const showGreeting = ProfileState.get("dbEditor.connectionBrowser.showGreeting", true);
        const showHomeTour = hasElectronHostBridge();
        const showTourSample = showHomeTour && this.state.tourActive && !this.hasSavedConnections();
        const productVersion = globalThis.MSG_VERSION_NUMBER;

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
                    id="connectionTileActionMenu"
                    ref={this.connectionActionMenuRef}
                    placement={ComponentPlacement.BottomRight}
                    onItemClick={this.handleConnectionMenuItemClick}
                >
                    <MenuItem command={{
                        title: "Connect with New SQL Script",
                        command: "open:script",
                    }} icon={Codicon.CloudUpload} />
                    <MenuItem command={{
                        title: "Connect with New Notebook",
                        command: "open:notebook",
                    }} icon={Codicon.CloudUpload} />
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem command={{ title: "Edit Connection…", command: "edit" }}
                        icon={Assets.misc.editIcon} />
                    <MenuItem
                        command={{ title: "Duplicate Connection…", command: "duplicate" }}
                        icon={Assets.misc.cloneIcon}
                    />
                    {this.renderMoveToFolderMenu()}
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem command={{
                        title: "Start MySQL Cloud Migration Assistant",
                        command: "msg.startMySQLCloudMigrationAssistant",
                    }} icon={Codicon.CloudUpload} />
                    <MenuItem command={{
                        title: "Open New MySQL Shell Console for this Connection",
                        command: "msg.newSessionUsingConnection",
                    }} icon={Codicon.Terminal} />
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem id="remove" command={{ title: "Delete Connection…", command: "remove" }} />
                </Menu>
                <Menu
                    id="groupTileActionMenu"
                    ref={this.groupActionMenuRef}
                    placement={ComponentPlacement.BottomRight}
                    onItemClick={this.handleGroupMenuItemClick}
                >
                    {this.currentActionMenuEntry?.parent && this.renderMoveToFolderMenu()}
                    {this.currentActionMenuEntry?.parent && <MenuItem command={{ title: "-", command: "" }} />}
                    <MenuItem command={{ title: "Delete Folder…", command: "removeFolder" }}
                        icon={Assets.misc.close2Icon} />
                </Menu>
                <Menu
                    id="connectionBrowserActionMenu"
                    ref={this.browserActionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleBrowserActionMenuClick}
                >
                    <MenuItem command={{ title: "Export Connections...", command: "exportConnections" }} />
                    <MenuItem command={{ title: "Import Connections...", command: "importConnections" }} />
                    <MenuItem command={{
                        title: "Import MySQL Workbench 8 connections file...",
                        command: "importWorkbenchConnections",
                    }} />
                </Menu>
                <Container
                    id="connectionBrowserContent"
                    orientation={Orientation.TopDown}
                >
                    {showGreeting && <>
                        <ConnectionBrowserPanel
                            id="connectionBrowserGreeting"
                            className="connectionBrowserGreeting"
                            closeButtonId="closeGreetingButton"
                            onClose={this.handleCloseGreeting}
                        >
                            <Container
                                id="greetingHeader"
                                orientation={Orientation.TopDown}
                                mainAlignment={ContentAlignment.Center}
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Image id="workbenchLogo" src={Assets.modules.appIcon} alt="MySQL Workbench" />
                                <Label id="title" textAlignment={TextAlignment.Center}>
                                    Welcome to MySQL Workbench
                                </Label>
                            </Container>
                            <Label id="greetingDescription" textAlignment={TextAlignment.Center}>
                                {`This is the all new MySQL Workbench${productVersion ? ` ${productVersion}` : ""}. ` +
                                    "It supersedes MySQL Workbench 8.0 and the MySQL Shell for VS Code Extension."}
                            </Label>
                            <Label id="greetingDescription" textAlignment={TextAlignment.Center}>
                                {`The new MySQL Workbench fully supports MySQL ` +
                                    "Server versions 8.4 and newer. Note: some functionality may not be available or " +
                                    "be fully compatible with the legacy MySQL Server 8.0."}
                            </Label>
                            <Container
                                id="linksHost"
                                orientation={Orientation.LeftToRight}
                                mainAlignment={ContentAlignment.Center}
                                wrap={ContentWrap.Wrap}
                            >
                                <HelpLinkList helpUrlMap={helpUrlMap} />
                                {showHomeTour && <a
                                    href="#"
                                    id="startHomeTourLink"
                                    onClick={this.handleStartHomeTour}
                                >
                                    Take a tour &gt;
                                </a>}
                            </Container>
                        </ConnectionBrowserPanel>
                    </>}
                    <LegacyConfigurationImportPanel
                        onConnectionsImported={this.refreshImportedConnections}
                    />
                    <ConnectionBrowserPanel
                        id="connectionBrowserConnectionsPanel"
                        className="connectionBrowserConnectionsPanel"
                    >
                        <Container
                            id="frontPageHeading"
                            orientation={Orientation.TopDown}
                            fixedScrollbars={false}
                            crossAlignment={ContentAlignment.Start}
                        >
                            <Container
                                id="contentTitleRow"
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Label id="contentTitle" caption={contentTitle} />
                                <div className="expander" />
                                <Button
                                    id="newConnectionButton"
                                    innerRef={this.newConnectionButtonRef}
                                    imageOnly
                                    data-tooltip="New Connection"
                                    onClick={this.handleNewConnectionClick}
                                >
                                    <Icon src={Codicon.Add} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="newFolderButton"
                                    innerRef={this.newFolderButtonRef}
                                    imageOnly
                                    data-tooltip="New Folder"
                                    onClick={() => {
                                        void this.handleNewFolderClick();
                                    }}
                                >
                                    <Icon src={Assets.file.newFolderIcon} data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="connectionBrowserActionsButton"
                                    imageOnly
                                    data-tooltip="More Actions"
                                    onClick={this.handleBrowserActionsClick}
                                >
                                    <Icon src={Codicon.KebabHorizontal} data-tooltip="inherit" />
                                </Button>
                            </Container>
                            {showBreadcrumb && (
                                <Breadcrumb
                                    id="connectionBrowserBreadcrumb"
                                    className="connectionBrowserBreadcrumb"
                                    path={path}
                                    separator=">"
                                    onSelect={this.handleSelectPath}
                                />
                            )}
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
                            {showTourSample && <ConnectionTile
                                tileId="homeTourLocalhost"
                                key="homeTourLocalhost"
                                caption="localhost"
                                description="Local MySQL server"
                                icon={ConnectionBrowser.dbTypeToIconMap.get(DBType.MySQL)!}
                                type={ConnectionTileType.Open}
                                onAction={this.handleTourSampleAction}
                            />}
                        </Container>
                    </ConnectionBrowserPanel>
                </Container>
                {showHomeTour && <UIExplainer
                    ref={this.homeTourRef}
                    onClose={this.handleHomeTourClose}
                    steps={this.homeTourSteps}
                />}
            </Container >
        );
    }

    private addNewConnection = (details: {
        mdsData?: IMySQLDbSystem; profileName?: string;
        user?: string;
    }): Promise<boolean> => {
        const options = details.mdsData as ITileActionOptions & { profileName?: string; user?: string; } | undefined;
        if (options) {
            options.profileName = details.profileName;
            options.user = details.user;
        }
        this.doHandleTileAction("new", undefined, options);

        return Promise.resolve(true);
    };

    private handleNewConnectionClick = (): void => {
        this.doHandleTileAction("new", undefined, undefined);
    };

    private handleStartHomeTour = (event: MouseEvent): void => {
        event.preventDefault();

        this.setState({ tourActive: true }, () => {
            this.connectionTileTargetRef.current = this.hostRef.current?.querySelector<HTMLElement>(
                "#homeTourLocalhost, .connectionTile:not(.group):not(.back)",
            ) ?? null;
            this.workspaceSelectorTargetRef.current = document.getElementById("workspaceSelector");

            if (!this.homeTourRef.current?.start()) {
                this.setState({ tourActive: false });
            }
        });
    };

    private handleHomeTourClose = (): void => {
        this.connectionTileTargetRef.current = null;
        this.workspaceSelectorTargetRef.current = null;
        this.setState({ tourActive: false });
    };

    private handleTourSampleAction = (): void => {
        // The localhost tile is only an instructional preview and is not a saved connection.
    };

    private hasSavedConnections = (
        entries: Array<ICdmConnectionEntry | ICdmConnectionGroupEntry> = this.roots,
    ): boolean => {
        return entries.some((entry) => {
            return entry.type === CdmEntityType.Connection || this.hasSavedConnections(entry.entries);
        });
    };

    private handleNewFolderClick = async (): Promise<void> => {
        const { currentGroup } = this.state;
        const folderName = await this.promptForFolderName(currentGroup);
        if (!folderName) {
            return;
        }

        try {
            await ShellInterface.dbConnections.addFolderPath(
                webSession.currentProfileId,
                folderName,
                currentGroup?.folderPath.id,
            );

            const rootGroup = await this.dataModel?.groupFromPath("/");
            const group = currentGroup ?? rootGroup;
            await group?.refresh?.();
            if (group) {
                void requisitions.executeRemote("refreshConnectionGroup", group.folderPath);
            }
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot create folder: " + message);
        }
    };

    private editConnection = async (connectionInfo: IConnectionInfo): Promise<boolean> => {
        const { connectionId, folderPath } = connectionInfo;
        const connections = await this.dataModel?.connectionList(folderPath);
        const connection = connections?.find((candidate) => {
            return candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("edit", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private removeConnection = async (connectionInfo: IConnectionInfo): Promise<boolean> => {
        const { connectionId, folderPath } = connectionInfo;
        const connections = await this.dataModel?.connectionList(folderPath);

        const connection = connections?.find((candidate) => {
            return candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("remove", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private duplicateConnection = async (connectionInfo: IConnectionInfo): Promise<boolean> => {
        const { connectionId, folderPath } = connectionInfo;
        const connections = await this.dataModel?.connectionList(folderPath);

        const connection = connections?.find((candidate) => {
            return candidate.details.id === connectionId;
        });

        if (connection) {
            this.doHandleTileAction("duplicate", connection, undefined);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): boolean => {
        if (entry?.key === "dbEditor.connectionBrowser.showGreeting"
            || entry?.key === "dbEditor.connectionBrowser.sortFoldersFirst"
            || entry?.key === connectionTagsChangedKey) {
            if (entry.key === connectionTagsChangedKey) {
                ConnectionTags.updateCache(entry.value);
            }

            this.forceUpdate();

            return true;
        }

        return false;
    };

    private handleProfileStateChanged = (): Promise<boolean> => {
        this.forceUpdate();

        return Promise.resolve(true);
    };

    private connectionTileTags(details: IConnectionDetails): IConnectionTileTag[] {
        const tags = details.tags ?? (details.settings?.badge ? [details.settings.badge] : []);
        if (tags.length === 0) {
            return [];
        }

        const badges = ConnectionTags.getCached();

        return tags.flatMap((tag) => {
            const color = badges[tag];
            if (typeof color !== "string" || color.length === 0) {
                return [];
            }

            return [{
                caption: tag,
                backgroundColor: color,
                foregroundColor: ConnectionTags.foreground(color),
            }];
        });
    }

    /**
     * Triggered when one specific or all top level groups need to be refreshed.
     * Refreshing the top level groups also means to refresh all top level connections.
     *
     * @param data Details of the connection group to refresh.
     *
     * @returns A promise that resolves to `true`.
     */
    private refreshConnectionGroup = async (data?: IFolderPath): Promise<boolean> => {
        if (data?.id !== undefined && data.id >= 0) {
            const context = this.context as DocumentContextType | undefined;
            if (context) {
                const group = await context.connectionsDataModel.findConnectionGroupEntryById(data.id, data.caption);
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

    private refreshImportedConnections = async (): Promise<void> => {
        const context = this.context as DocumentContextType | undefined;
        if (context) {
            await context.connectionsDataModel.reloadConnections();
            this.forceUpdate();
        }
    };

    private handleCloseGreeting = (): void => {
        ProfileState.set("dbEditor.connectionBrowser.showGreeting", false);
        ProfileState.saveState(true);
    };

    private dbFileDropped = async (fileName: string): Promise<boolean> => {
        // First remove drop zone.
        if (this.hostRef.current) {
            this.hostRef.current.classList.remove("dropTarget");
        }

        if (!this.dataModel) {
            return Promise.resolve(false);
        }

        const folderPath = this.generateFolderPathFromCurrentGroup();
        const connections = await this.dataModel.connectionList(folderPath);
        const caption = `New Connection ${connections.length}`;
        const description = "A new Database Connection";

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

    private handleBrowserActionsClick = (e: MouseEvent | KeyboardEvent): void => {
        const targetRect = e instanceof MouseEvent
            ? new DOMRect(e.clientX, e.clientY, 2, 2)
            : (e.currentTarget as HTMLElement).getBoundingClientRect();

        this.browserActionMenuRef.current?.open(targetRect, false, {});
    };

    private handleBrowserActionMenuClick = (props: IMenuItemProperties): boolean => {
        if (props.children && Children.count(props.children) > 0) {
            return false;
        }

        switch (props.command.command) {
            case "exportConnections": {
                void this.exportConnections();

                return true;
            }

            case "importConnections": {
                void this.importConnections();

                return true;
            }

            case "importWorkbenchConnections": {
                void this.importWorkbenchConnections();

                return true;
            }

            default: {
                return false;
            }
        }
    };

    private handleConnectionMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (!props.children || Children.count(props.children) === 0) {
            const command = props.command.command;
            if (this.currentActionMenuEntry?.type !== CdmEntityType.Connection) {
                return false;
            }

            if (command.startsWith("move:")) {
                void this.handleMoveToFolderAction(command, this.currentActionMenuEntry);
            } else {
                this.doHandleTileAction(command, this.currentActionMenuEntry, {});
            }

            return true;
        }

        return false;
    };

    private handleGroupMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (!props.children || Children.count(props.children) === 0) {
            if (this.currentActionMenuEntry?.type !== CdmEntityType.ConnectionGroup) {
                return false;
            }

            if (props.command.command.startsWith("move:")) {
                void this.handleMoveGroupToFolderAction(props.command.command, this.currentActionMenuEntry);

                return true;
            }

            if (props.command.command === "removeFolder") {
                this.confirmFolderRemoval(this.currentActionMenuEntry);

                return true;
            }
        }

        return false;
    };

    private handleTileAction = (action: string, props: IConnectionTileProperties | undefined,
        options: unknown): void => {

        const tileProps = props!;
        if (action === "new") {
            this.doHandleTileAction(action, undefined, options as IDictionary);
        } else {
            this.doHandleTileAction(action, tileProps.entry, options as IDictionary);
        }
    };

    private doHandleTileAction = (action: string, entry: ICdmConnectionEntry | ICdmConnectionGroupEntry | undefined,
        options?: ITileActionOptions): void => {

        if (action === "menu") {
            const anchorRect = options?.anchorRect
                ?? (options?.target instanceof HTMLElement ? options.target.getBoundingClientRect() : undefined);
            if (entry && anchorRect) {
                void this.openTileActionMenu(entry, anchorRect);
            }

            return;
        }

        let dbType: DBType | undefined;

        if (entry?.type === CdmEntityType.Connection) {
            dbType = entry.details.dbType;
        } else if (action === "new") {
            let connectionDetails: IConnectionDetails | undefined;
            if (options?.id !== undefined) {
                const { id, endpoints, displayName, description, compartmentId, profileName, user } = options;
                let host;
                if (endpoints && Array.isArray(endpoints) && endpoints.length > 0) {
                    host = endpoints[0].ipAddress;
                }

                connectionDetails = {
                    id: -1,
                    index: 0,
                    caption: displayName ?? "",
                    dbType: DBType.MySQL,
                    description: description ?? "",
                    useMHS: true,
                    useSSH: false,
                    options: {
                        user,

                        "compartment-id": compartmentId,
                        "mysql-db-system-id": id,
                        "profile-name": profileName ?? "DEFAULT",

                        // Disable support for bastion to be stored in freeform tags for the time being
                        // "bastion-id": (options.freeformTags as IDictionary)?.bastionId ?? undefined,
                        host,
                        "scheme": MySQLConnectionScheme.MySQL,
                    },
                };
            }

            void this.editorRef.current?.show(DBType.MySQL, true, this.generateFolderPathFromCurrentGroup(),
                connectionDetails);

            return;
        } else {
            // Can only be group activation. If entry is undefined, we have to go up one level.
            if (!entry) {
                let { currentGroup } = this.state;
                if (currentGroup?.parent) { // Just a sanity check. You cannot go up on root level.
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
            case "edit": {
                void this.editorRef.current?.show(dbType, false, "", entry.details);
                break;
            }

            case "duplicate": {
                void this.editorRef.current?.show(dbType, true, "", entry.details);

                break;
            }

            case "remove": {
                this.confirmTileRemoval(entry);

                break;
            }

            case "open":
            case "open:script":
            case "open:notebook": {
                // In the standalone/Electron frontend, match the sidebar behavior and always
                // open a fresh connection page for notebook/script actions.
                const createNewWorkspace = true;
                const initialEditor = action === "open:script"
                    ? "script"
                    : action === "open:notebook" ? "notebook" : options?.editor ?? "default";

                void requisitions.execute("openConnectionWorkspace",
                    {
                        connection: entry,
                        createNewWorkspace,
                        initialEditor,
                    });

                // Notify the wrapper, if there's one, in case it has to update UI for the changed page.
                requisitions.executeRemote("selectConnectionWorkspace", { connectionId: entry.details.id });

                break;
            }

            case "msg.newSessionUsingConnection": {
                const details: IShellSessionDetails = {
                    sessionId: uuid(),
                    dbConnectionId: entry.details.id,
                    caption: entry.caption,
                };
                void requisitions.execute("openSession", details);
                break;
            }

            case "msg.startMySQLCloudMigrationAssistant": {
                if (hasElectronHostBridge()) {
                    void startMigrationAssistantWithValidatedPassword(entry.details);
                } else {
                    void ui.showErrorMessage("Not implemented.", {});
                }
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

    private confirmFolderRemoval = (entry: ICdmConnectionGroupEntry): void => {
        setTimeout(() => {
            void this.showFolderRemovalDialog(entry);
        }, 0);
    };

    private showFolderRemovalDialog = async (entry: ICdmConnectionGroupEntry): Promise<void> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return;
        }

        await entry.refresh?.();
        const flatList = await dataModel.flattenGroupList(entry);
        const isEmptyFolder = flatList.connections.length === 0 && flatList.groups.length === 1;

        if (isEmptyFolder) {
            await this.deleteFolder(entry);

            return;
        }

        let description: string[] = [];
        const prompt = `Are you sure you want to remove the folder "${entry.caption}", including all its ` +
            `contents? This operation cannot be reverted!`;
        let groupString = "";
        if (flatList.groups.length > 1) {
            groupString = formatWithNumber("subfolder", flatList.groups.length - 1);
        }

        let connectionString = "";
        if (flatList.connections.length > 0) {
            connectionString = formatWithNumber("connection", flatList.connections.length);
        }

        if (groupString && connectionString) {
            description = [`The folder contains ${groupString} and ${connectionString}.`];
        } else if (groupString) {
            description = [`The folder contains ${groupString}.`];
        } else {
            description = [`The folder contains ${connectionString}.`];
        }

        void requisitions.execute("showDialog", {
            type: DialogType.Confirm,
            id: "deleteFolder",
            parameters: {
                prompt,
                refuse: "Cancel",
                accept: "Delete Folder",
                default: "Cancel",
            },
            description,
            data: { entry },
        });
    };

    private openTileActionMenu = async (entry: ICdmConnectionEntry | ICdmConnectionGroupEntry,
        anchorRect: DOMRect): Promise<void> => {
        const requestId = ++this.actionMenuRequestId;

        const moveTargetGroups = await this.getMoveTargetGroups(entry);
        if (requestId !== this.actionMenuRequestId) {
            return;
        }

        this.currentActionMenuEntry = entry;
        this.setState({
            moveTargetGroups,
            showMoveToRoot: entry.type === CdmEntityType.Connection
                ? !this.isConnectionInRoot(entry)
                : !this.isGroupInRoot(entry),
        }, () => {
            if (requestId === this.actionMenuRequestId) {
                if (entry.type === CdmEntityType.Connection) {
                    this.connectionActionMenuRef.current?.open(anchorRect, false);
                } else {
                    this.groupActionMenuRef.current?.open(anchorRect, false);
                }
            }
        });
    };

    private exportConnections = async (): Promise<void> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return;
        }

        const { currentGroup } = this.state;
        const basePath = this.connectionGroupPath(currentGroup);
        const connections = await dataModel.connectionList(basePath);
        const exportFile: IConnectionBrowserExportFile = {
            version: 1,
            connectionTags: ConnectionTags.getCached(),
            connections: connections.map((connection) => {
                return this.createConnectionExportEntry(connection.details, basePath);
            }),
        };

        saveTextAsFile(JSON.stringify(exportFile, undefined, 4), "mysql-connections.json");
    };

    private importConnections = async (): Promise<void> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return;
        }

        try {
            const files = await selectFileInBrowser([".json"], false);
            if (!files?.length) {
                return;
            }

            const content = await loadFileAsText(files[0]);
            const importedFile = this.parseConnectionExportFile(content);
            const basePath = this.connectionGroupPath(this.state.currentGroup);
            if (importedFile.connectionTags) {
                await ConnectionTags.set({
                    ...importedFile.connectionTags,
                    ...ConnectionTags.getCached(),
                });
            }

            for (const importedConnection of importedFile.connections) {
                const details: IConnectionDetails = {
                    id: -1,
                    index: -1,
                    dbType: importedConnection.dbType,
                    caption: importedConnection.caption,
                    description: importedConnection.description,
                    options: importedConnection.options,
                    folderPath: this.resolveImportedFolderPath(basePath, importedConnection.folderPath),
                    useSSH: importedConnection.useSSH,
                    useMHS: importedConnection.useMHS,
                    settings: importedConnection.settings,
                    tags: importedConnection.tags,
                };

                await ConnectionProcessor.addConnection(dataModel.createConnectionEntry(details), dataModel);
            }
        } catch (reason) {
            void requisitions.execute("showError", "Cannot import DB connections: " + convertErrorToString(reason));
        }
    };

    private importWorkbenchConnections = async (): Promise<void> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return;
        }

        const files = await selectFileInBrowser([".xml"], false);
        if (!files?.length) {
            return;
        }

        const content = await loadFileAsText(files[0]);
        await ConnectionProcessor.importMySQLWorkbenchConnections(content, dataModel);
    };

    private createConnectionExportEntry = (details: IConnectionDetails,
        basePath: string): IConnectionBrowserExportEntry => {
        return {
            dbType: details.dbType,
            caption: details.caption,
            description: details.description,
            options: this.sanitizeForExport(details.options) as IDictionary,
            folderPath: this.getRelativeFolderPath(details.folderPath ?? "/", basePath),
            useSSH: details.useSSH,
            useMHS: details.useMHS,
            settings: details.settings,
            tags: details.tags,
        };
    };

    private sanitizeForExport = (value: unknown): unknown => {
        if (Array.isArray(value)) {
            return value.map((entry) => {
                return this.sanitizeForExport(entry);
            });
        }

        if (value && typeof value === "object") {
            const sanitized: IDictionary = {};
            Object.entries(value).forEach(([key, entry]) => {
                if (!/password|passphrase|secret|token|private.*key|credential/i.test(key)) {
                    sanitized[key] = this.sanitizeForExport(entry);
                }
            });

            return sanitized;
        }

        return value;
    };

    private parseConnectionExportFile = (content: string): IConnectionBrowserExportFile => {
        const parsed = JSON.parse(content) as Partial<IConnectionBrowserExportFile>;
        if (parsed.version !== 1 || !Array.isArray(parsed.connections)) {
            throw new Error("Invalid connection export file.");
        }

        const connections = parsed.connections.map((entry) => {
            const options = entry.options as unknown;
            if (typeof entry.caption !== "string"
                || typeof entry.description !== "string"
                || !Object.values(DBType).includes(entry.dbType)
                || !options
                || typeof options !== "object") {
                throw new Error("Invalid connection export file.");
            }

            return {
                dbType: entry.dbType,
                caption: entry.caption,
                description: entry.description,
                options: options as IDictionary,
                folderPath: typeof entry.folderPath === "string" ? entry.folderPath : "/",
                useSSH: entry.useSSH,
                useMHS: entry.useMHS,
                settings: entry.settings,
                tags: Array.isArray(entry.tags)
                    ? entry.tags.filter((tag) => {
                        return typeof tag === "string";
                    })
                    : undefined,
            };
        });

        return {
            version: 1,
            connectionTags: this.parseConnectionTagDefinitions(parsed.connectionTags),
            connections,
        };
    };

    private parseConnectionTagDefinitions = (tags: unknown): Record<string, string> | undefined => {
        if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
            return undefined;
        }

        const result: Record<string, string> = {};
        Object.entries(tags).forEach(([caption, color]) => {
            const tagCaption = caption.trim();
            if (tagCaption.length > 0 && typeof color === "string" && color.trim().length > 0) {
                result[tagCaption] = color.trim();
            }
        });

        return result;
    };

    private getRelativeFolderPath = (folderPath: string, basePath: string): string => {
        const normalizedFolderPath = this.normalizeFolderPath(folderPath);
        const normalizedBasePath = this.normalizeFolderPath(basePath);
        if (normalizedBasePath === "/") {
            return normalizedFolderPath;
        }

        if (normalizedFolderPath === normalizedBasePath) {
            return "/";
        }

        if (normalizedFolderPath.startsWith(`${normalizedBasePath}/`)) {
            return normalizedFolderPath.substring(normalizedBasePath.length);
        }

        return normalizedFolderPath;
    };

    private resolveImportedFolderPath = (basePath: string, folderPath: string): string => {
        const normalizedBasePath = this.normalizeFolderPath(basePath);
        const normalizedFolderPath = this.normalizeFolderPath(folderPath);
        if (normalizedFolderPath === "/") {
            return normalizedBasePath;
        }

        return normalizedBasePath === "/" ? normalizedFolderPath : `${normalizedBasePath}${normalizedFolderPath}`;
    };

    private normalizeFolderPath = (folderPath: string): string => {
        const trimmed = folderPath.trim();
        if (trimmed.length === 0 || trimmed === "/") {
            return "/";
        }

        return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
    };

    private getMoveTargetGroups = async (
        entry: ICdmConnectionEntry | ICdmConnectionGroupEntry,
    ): Promise<ICdmConnectionGroupEntry[]> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return [];
        }

        const excludedFolderIds = new Set<number>();
        if (entry.parent) {
            excludedFolderIds.add(entry.parent.folderPath.id);
        }
        if (entry.type === CdmEntityType.ConnectionGroup) {
            const groupsToMove = await dataModel.flattenGroupList(entry);
            for (const group of groupsToMove.groups) {
                excludedFolderIds.add(group.folderPath.id);
            }
        }

        const groups = await dataModel.groupList("/");

        return groups
            .filter((group) => {
                return !excludedFolderIds.has(group.folderPath.id);
            })
            .sort((left, right) => {
                return this.connectionGroupPath(left).localeCompare(this.connectionGroupPath(right));
            });
    };

    private handleMoveToFolderAction = async (action: string, entry: ICdmConnectionEntry): Promise<void> => {
        try {
            const move = await this.resolveMoveTarget(action, entry);
            if (!move) {
                return;
            }

            const updatedConnection = {
                ...entry.details,
                folderPath: this.connectionGroupPath(move.targetGroup),
            };

            await ShellInterface.dbConnections.updateDbConnection(
                webSession.currentProfileId,
                updatedConnection,
                move.targetGroup.folderPath.id,
            );
            await this.refreshMovedGroups(move.oldGroup, move.targetGroup);
            void requisitions.executeRemote("connectionUpdated", updatedConnection);
        } catch (reason) {
            this.showMoveError("Cannot move DB connection", reason);
        }
    };

    private handleMoveGroupToFolderAction = async (action: string, entry: ICdmConnectionGroupEntry): Promise<void> => {
        try {
            const move = await this.resolveMoveTarget(action, entry);
            if (!move) {
                return;
            }

            await ShellInterface.dbConnections.moveFolder(entry.folderPath.id, move.targetGroup.folderPath.id);
            await this.refreshMovedGroups(move.oldGroup, move.targetGroup);
        } catch (reason) {
            this.showMoveError("Cannot move folder", reason);
        }
    };

    private resolveMoveTarget = async (
        action: string,
        entry: ICdmConnectionEntry | ICdmConnectionGroupEntry,
    ): Promise<{ oldGroup: ICdmConnectionGroupEntry; targetGroup: ICdmConnectionGroupEntry; } | undefined> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return undefined;
        }

        const rootGroup = await dataModel.groupFromPath("/");
        const oldGroup = entry.parent ?? rootGroup;
        let targetGroup = rootGroup;
        if (action === "move:newFolder") {
            const folderName = await this.promptForFolderName(entry.parent);
            if (!folderName) {
                return undefined;
            }

            await ShellInterface.dbConnections.addFolderPath(
                webSession.currentProfileId,
                folderName,
                entry.parent?.folderPath.id,
            );

            const parentPath = this.connectionGroupPath(entry.parent);
            const folderPath = parentPath === "/" ? `/${folderName}` : `${parentPath}/${folderName}`;
            targetGroup = await dataModel.groupFromPath(folderPath);
        } else if (action !== "move:root") {
            const folderId = Number.parseInt(action.substring("move:folder:".length), 10);
            const { moveTargetGroups } = this.state;
            targetGroup = moveTargetGroups.find((group) => {
                return group.folderPath.id === folderId;
            }) ?? rootGroup;
        }

        if (oldGroup.folderPath.id === targetGroup.folderPath.id) {
            return undefined;
        }

        return { oldGroup, targetGroup };
    };

    private refreshMovedGroups = async (oldGroup: ICdmConnectionGroupEntry,
        targetGroup: ICdmConnectionGroupEntry): Promise<void> => {
        await oldGroup.refresh?.();
        if (targetGroup !== oldGroup) {
            await targetGroup.refresh?.();
        }

        void requisitions.executeRemote("refreshConnectionGroup", oldGroup.folderPath);
        if (targetGroup !== oldGroup) {
            void requisitions.executeRemote("refreshConnectionGroup", targetGroup.folderPath);
        }
    };

    private showMoveError = (operation: string, reason: unknown): void => {
        const message = reason instanceof Error ? reason.message : String(reason);
        void requisitions.execute("showError", `${operation}: ${message}`);
    };

    private deleteFolder = async (entry: ICdmConnectionGroupEntry): Promise<void> => {
        const dataModel = this.dataModel;
        if (!dataModel) {
            return;
        }

        try {
            await entry.refresh?.();
            const flatList = await dataModel.flattenGroupList(entry);

            for (const connection of flatList.connections.reverse()) {
                await dataModel.dropItem(connection);
                await dataModel.removeEntry(connection);
            }

            for (const group of flatList.groups.reverse()) {
                await dataModel.dropItem(group);
                await dataModel.removeEntry(group);
            }

            void ui.showInformationMessage(`The connection group "${entry.caption}" has been deleted.`, {});
        } catch (reason) {
            void ui.showErrorMessage(`Error while executing the command: ${convertErrorToString(reason)}`, {});
        }
    };

    private promptForFolderName = async (parentGroup?: ICdmConnectionGroupEntry): Promise<string | undefined> => {
        let value = "folder";
        while (true) {
            const name = await ui.showInputBox(
                "Create New Folder",
                "Folder name",
                "Enter the name of the new folder.",
                value,
            );

            const folderName = name?.trim();
            if (!folderName) {
                return undefined;
            }

            if (!this.folderNameExists(parentGroup, folderName)) {
                return folderName;
            }

            value = folderName;
            await ui.showErrorMessage(`A folder named "${folderName}" already exists here.`, {});
        }
    };

    private folderNameExists = (parentGroup: ICdmConnectionGroupEntry | undefined, folderName: string): boolean => {
        const entries = parentGroup?.entries ?? this.roots;

        return entries.some((entry) => {
            return entry.type === CdmEntityType.ConnectionGroup
                && entry.caption.localeCompare(folderName, undefined, { sensitivity: "base" }) === 0;
        });
    };

    private isConnectionInRoot = (entry?: ICdmConnectionEntry): boolean => {
        return !entry?.parent || entry.parent.folderPath.id === 1;
    };

    private isGroupInRoot = (entry?: ICdmConnectionGroupEntry): boolean => {
        return !entry?.parent || entry.parent.folderPath.id === 1;
    };

    private renderMoveToFolderMenu = (): ComponentChild => {
        const { moveTargetGroups, showMoveToRoot } = this.state;

        return <MenuItem command={{ title: "Move to Folder", command: "" }} icon={Assets.file.folderIcon}>
            {showMoveToRoot && <MenuItem command={{ title: "/", command: "move:root" }} />}
            {moveTargetGroups.map((group) => {
                return <MenuItem
                    key={`moveToFolder${group.folderPath.id}`}
                    command={{
                        title: this.connectionGroupPath(group),
                        command: `move:folder:${group.folderPath.id}`,
                    }}
                />;
            })}
            {(showMoveToRoot || moveTargetGroups.length > 0) && <MenuItem command={{ title: "-", command: "" }} />}
            <MenuItem command={{ title: "New Folder…", command: "move:newFolder" }} />
        </MenuItem>;
    };

    private connectionGroupPath = (group?: ICdmConnectionGroupEntry): string => {
        if (!group || group.folderPath.id === 1) {
            return "/";
        }

        const parts: string[] = [];
        let runner: ICdmConnectionGroupEntry | undefined = group;
        while (runner && runner.folderPath.id !== 1) {
            parts.unshift(runner.caption);
            runner = runner.parent;
        }

        return `/${parts.join("/")}`;
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
            const entry = response.data?.entry as ICdmConnectionEntry | undefined;
            if (entry && response.closure === DialogResponseClosure.Accept && this.dataModel) {
                const { onRemoveConnection } = this.props;
                onRemoveConnection(entry);
            }

            return Promise.resolve(true);
        }

        if (response.id === "deleteFolder") {
            const entry = response.data?.entry as ICdmConnectionGroupEntry | undefined;
            if (entry && response.closure === DialogResponseClosure.Accept) {
                await this.deleteFolder(entry);
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleAddConnection = (details: IConnectionDetails): void => {
        const { onAddConnection } = this.props;

        const model = this.dataModel;
        if (model) {
            void onAddConnection(model.createConnectionEntry(details));
        }
    };

    private handleUpdateConnection = (details: IConnectionDetails): void => {
        const { onUpdateConnection } = this.props;

        const model = this.dataModel;
        if (model) {
            void model.findConnectionEntryById(details.id, details.folderPath).then((entry) => {
                return entry ?? model.findConnectionEntryById(details.id);
            }).then((entry) => {
                if (entry) {
                    onUpdateConnection({ ...entry, details });
                    this.forceUpdate();
                }
            });
        }
    };

    private get roots(): Array<ICdmConnectionEntry | ICdmConnectionGroupEntry> {
        return (this.context as DocumentContextType | undefined)?.connectionsDataModel.roots ?? [];
    }

    private get dataModel(): ConnectionDataModel | undefined {
        return (this.context as DocumentContextType | undefined)?.connectionsDataModel;
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
