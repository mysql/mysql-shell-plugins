/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import defaultIcon from "../../assets/images/file-icons/default.svg";

import moduleIcon from "../../assets/images/modules/module-sql.svg";
import scriptingIcon from "../../assets/images/scripting.svg";
import connectionsIcon from "../../assets/images/connections.svg";
import closeButton from "../../assets/images/close2.svg";

import React from "react";

import { ModuleBase, IModuleInfo, IModuleState, IModuleProperties } from "../ModuleBase";

import { ConnectionBrowser } from "./ConnectionBrowser";
import {
    ITabviewPage, Tabview, Button, Icon, TabPosition, defaultEditorOptions, Divider, Label, Dropdown, Image,
    ProgressIndicator, IDropdownProperties,
} from "../../components/ui";
import { DBConnectionTab, IDBConnectionTabPersistentState, IOpenEditorState } from "./DBConnectionTab";
import { ICodeEditorModel, CodeEditor, CodeEditorMode } from "../../components/ui/CodeEditor/CodeEditor";
import { Monaco } from "../../components/ui/CodeEditor";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts";
import { appParameters, requisitions } from "../../supplement/Requisitions";
import { settings } from "../../supplement/Settings/Settings";
import { DBType, IConnectionDetails, ShellInterface } from "../../supplement/ShellInterface";
import { EntityType, IDBDataEntry, IDBEditorScriptState, ISchemaTreeEntry, IToolbarItems } from ".";
import { documentTypeToIcon, IExplorerSectionState, pageTypeToIcon } from "./Explorer";

import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import {
    ICommAddConnectionEvent, ICommErrorEvent, ICommModuleAddDataEvent, ICommModuleDataContentEvent,
    ICommOpenConnectionEvent, ICommResultSetEvent, IShellResultType, IResultSetData,
} from "../../communication";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool";
import { ISqliteConnectionOptions } from "../../communication/Sqlite";
import { IMySQLConnectionOptions } from "../../communication/MySQL";
import { convertSnakeToCamelCase, uuid } from "../../utilities/helpers";
import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB";
import { EventType, ListenerEntry } from "../../supplement/Dispatch";
import { DBEditorModuleId } from "../ModuleInfo";
import { EditorLanguage, IExecutionContext, IScriptRequest } from "../../supplement";
import { webSession } from "../../supplement/WebSession";
import { ShellPromptHandler } from "../common/ShellPromptHandler";
import { parseVersion } from "../../parsing/mysql/mysql-helpers";
import { DocumentDropdownItem, IDocumentDropdownItemProperties } from "./DocumentDropdownItem";

/* eslint import/no-webpack-loader-syntax: off */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const typings = require("!!raw-loader?esModule=false!./assets/typings/scripting-runtime.d.ts");

// Details generated while adding a new tab. These are used in the render method to fill the tab page details.
interface IDBEditorTabInfo {
    details: IConnectionDetails;
    tabId: string;
    caption: string;
    suppressAbout: boolean;
}

export type IDBEditorModuleProperties = IModuleProperties;

interface IDBEditorModuleState extends IModuleState {
    editorTabs: IDBEditorTabInfo[];

    // The IDs of editors which have been changed.
    dirtyEditors: Set<string>;

    // The tab or page to activate.
    selectedPage: string;

    // Set when we need to restore a page selection that was temporarily disabled.
    lastSelectedPage?: string;

    showExplorer: boolean;
    showTabs: boolean;

    connections: IConnectionDetails[];
    connectionsLoaded: boolean;

    // Progress indicator support.
    loading: boolean;
    progressMessage: string;
}

export class DBEditorModule extends ModuleBase<IDBEditorModuleProperties, IDBEditorModuleState> {

    // The saved document state when switching tabs.
    private connectionState: Map<string, IDBConnectionTabPersistentState> = new Map();

    private workerPool: ExecutionWorkerPool;

    // For unique naming of editors.
    private editorCounter = 0;

    private scriptsTree: IDBDataEntry[] = [];

    private pendingProgress: ReturnType<typeof setTimeout> | null;

    public static get info(): IModuleInfo {
        return {
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon: moduleIcon,
        };
    }

    public constructor(props: IDBEditorModuleProperties) {
        super(props);

        this.workerPool = new ExecutionWorkerPool();

        this.state = {
            selectedPage: "",
            editorTabs: [],
            dirtyEditors: new Set(),
            showExplorer: true,
            showTabs: !appParameters.embedded,
            connections: [],
            connectionsLoaded: false,
            loading: false,
            progressMessage: "",
        };

        CodeEditor.addTypings(typings as string, "Runtime");

        void this.loadConnections();
        ShellInterface.modules.loadScriptsTree().then((tree) => {
            this.scriptsTree = tree;
        }).catch((error) => {
            void requisitions.execute("showError", ["Loading Error", "Cannot load user scripts:", String(error)]);
        });

        ListenerEntry.createByClass("webSession", { persistent: true }).then(() => {
            // A new web session was established while the module is active. That means previous editor sessions
            // are invalid now and we have to reopen new sessions.
            const { editorTabs } = this.state;

            editorTabs.forEach((tab) => {
                const state = this.connectionState.get(tab.tabId);
                if (state) {
                    void state.backend.startSession(tab.tabId).then(() => {
                        void this.reOpenConnection(state.backend, tab.details);
                    });
                }
            });
        });
    }

    public static getDerivedStateFromProps(props: IDBEditorModuleProperties,
        state: IDBEditorModuleState): Partial<IDBEditorModuleState> {

        const { selectedPage, loading } = state;

        let newSelection = selectedPage;
        if (!newSelection) {
            if (!loading && !appParameters.embedded) {
                newSelection = "connections";
            }
        }

        const newState = {
            selectedPage: newSelection,
        };

        return newState;
    }

    public componentDidMount(): void {
        requisitions.register("showPage", this.showPage);
        requisitions.register("openConnectionTab", this.openConnectionTab);
        requisitions.register("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.register("moduleToggle", this.toggleModule);
        requisitions.register("editorShowConnections", this.showConnections);
        requisitions.register("editorRunCommand", this.runCommand);
        requisitions.register("profileLoaded", this.profileLoaded);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("openConnectionTab", this.openConnectionTab);
        requisitions.unregister("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.unregister("moduleToggle", this.toggleModule);
        requisitions.unregister("editorShowConnections", this.showConnections);
        requisitions.unregister("editorRunCommand", this.runCommand);
        requisitions.unregister("profileLoaded", this.profileLoaded);
    }

    public render(): React.ReactNode {
        const { innerRef } = this.props;
        const {
            connections, connectionsLoaded, selectedPage, editorTabs, showExplorer, showTabs, loading,
            progressMessage, dirtyEditors,
        } = this.state;

        // Generate the main toolbar inset based on the current display mode.
        let toolbarItems: IToolbarItems | undefined;
        if (appParameters.embedded) {
            const items: Array<React.ReactElement<typeof Dropdown.Item>> = [
                <Dropdown.Item
                    id="connections"
                    key="connections"
                    caption="Connections"
                    picture={<Icon src={connectionsIcon} />}
                />,
            ];

            let showSaveButton = false;
            let needsSave = false;
            let selectedEntry: string | undefined;
            editorTabs.forEach((info: IDBEditorTabInfo) => {
                const connectionState = this.connectionState.get(info.tabId)!;

                // Add one entry per connection.
                const language = info.details.dbType === DBType.MySQL ? "mysql" : "sql";
                const icon = documentTypeToIcon.get(language) || defaultIcon;

                items.push(
                    <Dropdown.Item
                        id={info.tabId}
                        key={info.tabId}
                        caption={info.caption}
                        picture={<Icon src={icon} />}
                    />,
                );

                // After that add an entry for each open document (indented).
                connectionState.editors.forEach((entry) => {
                    let picture;
                    if (entry.state) {
                        const language = entry.state.model.getLanguageId() as EditorLanguage;
                        picture = <Image src={documentTypeToIcon.get(language) || defaultIcon} />;
                    } else {
                        const name = pageTypeToIcon.get(entry.id) || defaultIcon;
                        picture = <Icon as="span" src={name} width="20px" height="20px" />;
                    }

                    items.push((
                        <DocumentDropdownItem
                            page={info.tabId}
                            item={entry.id}
                            id={entry.id}
                            key={entry.id}
                            caption={entry.caption}
                            picture={picture}
                            style={{ marginLeft: 16 }}
                        />
                    ));

                    if (selectedPage !== "connections" && entry.id === connectionState.activeEntry) {
                        if (entry.type === EntityType.Script) {
                            showSaveButton = true;
                            needsSave = dirtyEditors.has(entry.id);
                        }
                        selectedEntry = entry.id;
                    }
                });
            });

            toolbarItems = {
                left: [
                    <Label key="mainLabel" style={{ paddingRight: "8px" }}>Editor:</Label>,
                    <Dropdown
                        id="documentSelector"
                        key="selector"
                        initialSelection={selectedEntry ?? selectedPage}
                        onSelect={this.handleSelectItem}
                    >
                        {items}
                    </Dropdown>,
                    <Divider key="firstDivider" vertical={true} thickness={1} />,
                ],
                right: [],
            };

            if (showSaveButton) {
                toolbarItems.right.push(<Button
                    id="itemSaveButton"
                    key="itemSaveButton"
                    caption="Save"
                    disabled={!needsSave}
                    onClick={this.handleEditorSave}
                />);
            }
        }

        const pages: ITabviewPage[] = [];

        let actualSelection = selectedPage;
        if (loading || !connectionsLoaded) {
            const content = <>
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    linear={false}
                />
                <Label
                    as="h4"
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </>;

            pages.push({
                icon: connectionsIcon,
                caption: "Open Connection",
                id: "progress",
                content,
            });
            actualSelection = "progress";

        } else {
            const content = (<ConnectionBrowser
                toolbarItems={toolbarItems}
                connections={connections}
                onAddConnection={this.handleAddConnection}
                onDropConnection={this.handleDropConnection}
                onPushSavedConnection={this.handlePushConnection}
            />);

            pages.push({
                icon: connectionsIcon,
                caption: "Connection Overview",
                id: "connections",
                content,
            });
        }

        editorTabs.forEach((info: IDBEditorTabInfo) => {
            const connectionState = this.connectionState.get(info.tabId)!;

            if (!toolbarItems) {
                // If no special UI is to be rendered use an editor selection dropdown.
                toolbarItems = {
                    left: [
                        <Label key="mainLabel">Editor:</Label>,
                        <Dropdown
                            id="documentSelector"
                            key="documentSelector"
                            initialSelection={connectionState.activeEntry}
                            onSelect={this.handleEditorSelectorChange}
                        >
                            {
                                connectionState.editors.map((entry) => {
                                    let picture;
                                    if (entry.state) {
                                        const language = entry.state.model.getLanguageId() as EditorLanguage;
                                        picture = <Image src={documentTypeToIcon.get(language) || defaultIcon} />;
                                    } else {
                                        const name = pageTypeToIcon.get(entry.id) || defaultIcon;
                                        picture = <Icon as="span" src={name} width="20px" height="20px" />;
                                    }

                                    return (
                                        <Dropdown.Item
                                            id={entry.id}
                                            key={entry.id}
                                            caption={entry.caption}
                                            picture={picture}
                                        />
                                    );
                                })
                            }
                        </Dropdown>,
                        <Divider key="firstDivider" vertical={true} thickness={1} />,
                    ],
                    right: [],
                };
            }

            const content = (<DBConnectionTab
                id={info.tabId}
                showAbout={!info.suppressAbout}
                workerPool={this.workerPool}
                dbType={info.details.dbType}
                connectionId={info.details.id}
                toolbarItems={toolbarItems}
                savedState={connectionState}
                showExplorer={showTabs && showExplorer}
                onHelpCommand={this.handleHelpCommand}
                onAddEditor={this.handleAddEditor}
                onRemoveEditor={this.handleRemoveEditor}
                onSelectItem={this.handleSelectEntry}
                onEditorRename={this.handleEditorRename}
                onEditorChange={this.handleEditorChange}
                onAddScript={this.handleAddScript}
                onSaveSchemaTree={this.handleSaveSchemaTree}
                onSaveExplorerState={this.handleSaveExplorerState}
                onExplorerResize={this.handleExplorerResize}
                onExplorerMenuAction={this.handleExplorerMenuAction}
            />);

            pages.push({
                icon: scriptingIcon,
                caption: info.caption,
                id: info.tabId,
                content,
                auxillary: (
                    <Button
                        id={info.tabId}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={closeButton} />
                    </Button>
                ),
            });
        });

        const className = "dbModuleTabview moduleHost";

        return <>
            <Tabview
                innerRef={innerRef}
                className={className}
                tabPosition={TabPosition.Top}
                selectedId={actualSelection}
                stretchTabs={false}
                showTabs={showTabs}
                canReorderTabs
                pages={pages}
                onSelectTab={this.handleSelectTab}
            />
        </>;
    }

    public handlePushConnection = (details: IConnectionDetails): void => {
        const { connections } = this.state;
        connections.push(details);
        this.setState({ connections });
    };


    private loadConnections(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const connections: IConnectionDetails[] = [];
            ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, "")
                .then((event: ICommResultSetEvent) => {
                    if (!event.data) {
                        resolve(false);

                        return;
                    }

                    // XXX: temporary workaround.
                    const resultData = convertSnakeToCamelCase(event.data) as IResultSetData;
                    connections.push(...resultData.rows as IConnectionDetails[]);

                    if (event.eventType === EventType.FinalResponse) {
                        resolve(true);
                        this.setState({ connections, connectionsLoaded: true });
                    }
                }).catch((event) => {
                    void requisitions.execute("showError",
                        ["Loading Error", "Cannot load DB connections:", String(event.message)]);

                    reject();
                });

        });
    }

    private handleAddConnection = (details: IConnectionDetails): void => {
        ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId, details, "")
            .then((event: ICommAddConnectionEvent) => {
                const { connections } = this.state;

                if (event.data) {
                    details.id = event.data.result.dbConnectionId;
                    connections.push(details);

                    this.setState({ connections });
                }
            });
    };

    private handleDropConnection = (connectionId: number): void => {
        const { connections } = this.state;
        const index = connections.findIndex((value: IConnectionDetails) => { return value.id === connectionId; });
        if (index > -1) {
            ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connectionId)
                .then(() => {
                    connections.splice(index, 1);
                    this.setState({ connections });

                    void this.removeTabsForConnection(connectionId);
                });
        }
    };

    private showPage = (data: { module: string; page: string; suppressAbout?: boolean }): Promise<boolean> => {
        if (data.module === DBEditorModuleId) {
            const { connectionsLoaded, connections } = this.state;

            if (data.page === "connections") {
                return this.showConnections();
            } else if (connectionsLoaded) {
                const id = parseInt(data.page, 10);
                const connection = connections.find((candidate) => { return candidate.id === id; });
                if (connection) {
                    return this.addConnectionTab(connection, false, data.suppressAbout ?? false);
                }
            }
        }

        return Promise.resolve(false);
    };

    private openConnectionTab = (data: { details: IConnectionDetails; force: boolean }): Promise<boolean> => {
        return this.addConnectionTab(data.details, data.force, false);
    };

    private setCurrentSchema = (data: { id: string; connectionId: number; schema: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            const { editorTabs } = this.state;

            // Update all editor tabs with this connection.
            editorTabs.forEach((info: IDBEditorTabInfo) => {
                if (info.details.id === data.connectionId) {
                    const connectionState = this.connectionState.get(data.id);
                    if (connectionState) {
                        if (connectionState.currentSchema !== data.schema) {
                            // Change for new editors.
                            connectionState.currentSchema = data.schema;

                            // Change existing editors.
                            connectionState.editors.forEach((state) => {
                                if (state.state) {
                                    const contexts = state.state.model.executionContexts;
                                    contexts.currentSchema = data.schema;
                                }
                            });
                        }
                    }
                }
            });

            this.setState({ editorTabs }, () => { resolve(true); });
        });
    };

    private toggleModule = (id: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const { showExplorer, selectedPage } = this.state;

            if (id === DBEditorModuleId && selectedPage !== "connections") {
                this.setState({ showExplorer: !showExplorer }, () => { resolve(true); });
            } else {
                resolve(false);
            }
        });
    };

    private showConnections = (): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ selectedPage: "connections" }, () => { resolve(true); });
            requisitions.executeRemote("selectConnectionTab", "SQL Connections");
        });
    };

    private runCommand = (details: { command: string; context: IExecutionContext }): Promise<boolean> => {
        return new Promise((resolve) => {
            switch (details.command) {
                case "sendBlockUpdates": {
                    // Called when editor changes must be sent back to a host.
                    if (details.context.linkId) {
                        requisitions.executeRemote("codeBlocksUpdate", {
                            linkId: details.context.linkId,
                            code: details.context.code,
                        });
                        resolve(true);
                    }

                    break;
                }

                default: {
                    resolve(false);
                    break;
                }
            }
        });
    };

    private profileLoaded = (): Promise<boolean> => {
        return this.loadConnections();
    };

    /**
     * Adds a new connection tab or activates an existing one.
     *
     * @param connection The connection for which to open/active the tab.
     * @param force If true then create a new tab, even if one for the same connection already exists.
     * @param suppressAbout If true then no about text is show when opening the tab.
     *
     * @returns A promise fulfilled once the connect tab is added.
     */
    private addConnectionTab = (connection: IConnectionDetails, force: boolean,
        suppressAbout: boolean): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            const { editorTabs } = this.state;

            // Count how many tabs we already have for this connection.
            // If there's any keep the last one, in case we have to re-use it.
            let counter = 1;
            let foundEntry: IDBEditorTabInfo | undefined;
            editorTabs.forEach((entry: IDBEditorTabInfo) => {
                if (entry.details.id === connection.id) {
                    ++counter;
                    foundEntry = entry;
                }
            });

            if (foundEntry && !force) {
                // We already have a tab for that connection and a new tab wasn't enforced,
                // so simply activate that existing tab.
                this.setState({ selectedPage: foundEntry.tabId }, () => {
                    resolve(true);
                });
            } else {
                const suffix = counter > 1 ? ` (${counter})` : "";
                const tabId = uuid();

                // If there's no previous editor state for this connection, create a default editor.
                const connectionState = this.connectionState.get(tabId);
                if (!connectionState) {
                    this.showProgress();

                    // Create a new module session and open a DB connection.
                    const backend = new ShellInterfaceSqlEditor();

                    const handleOutcome = (success: boolean) => {
                        if (!success) {
                            backend.closeSession().then(() => {
                                resolve(true); // Return true to indicate we handled this requisition.
                            }).catch((reason) => {
                                reject(reason);
                            });
                        } else {
                            resolve(true);
                        }
                    };

                    this.setProgressMessage("Starting editor session...");
                    backend.startSession(tabId).then(() => {
                        this.setProgressMessage("Session created, opening new connection...");

                        // Before opening the connection check the DB file, if this is an sqlite connection.
                        if (connection.dbType === DBType.Sqlite) {
                            const options = connection.options as ISqliteConnectionOptions;
                            ShellInterface.core.validatePath(options.dbFile).then(() => {
                                void this.openNewConnection(backend, tabId, suffix, connection, suppressAbout)
                                    .then((success) => {
                                        handleOutcome(success);
                                    });
                            }).catch(() => {
                                // If the path is not ok then we might have to create the DB file first.
                                ShellInterface.core.createDatabaseFile(options.dbFile).then(() => {
                                    void this.openNewConnection(backend, tabId, suffix, connection, suppressAbout)
                                        .then(() => {
                                            resolve(true);
                                        });
                                }).catch((errorEvent: ICommErrorEvent) => {
                                    void requisitions.execute("showError",
                                        ["DB Creation Error", String(errorEvent.message)]);
                                });
                            });
                        } else {
                            void this.openNewConnection(backend, tabId, suffix, connection, suppressAbout)
                                .then((success) => {
                                    handleOutcome(success);
                                });
                        }
                    }).catch((errorEvent: ICommErrorEvent) => {
                        this.hideProgress(true);
                        void requisitions.execute("showError", ["Module Session Error", String(errorEvent.message)]);
                        reject();
                    });
                } else {
                    editorTabs.push({
                        details: connection,
                        tabId,
                        caption: connection.caption + suffix,
                        suppressAbout,
                    });

                    this.setState({ editorTabs, selectedPage: tabId }, () => {
                        resolve(true);
                    });
                }
            }
        });
    };

    /**
     * Opens the given connection once all verification was done. Used when opening a connection the first time.
     *
     * @param backend The backend for the connection.
     * @param tabId The new id of the tab.
     * @param tabSuffix An additional string to add to the caption of the tab we are about to open.
     * @param connection The connection details.
     * @param suppressAbout If true then no about text is shown.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private openNewConnection(backend: ShellInterfaceSqlEditor, tabId: string, tabSuffix: string,
        connection: IConnectionDetails, suppressAbout: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            const { editorTabs } = this.state;

            backend.openConnection(connection.id).then((event: ICommOpenConnectionEvent) => {
                if (!event.data) {
                    return;
                }

                switch (event.eventType) {
                    case EventType.DataResponse: {
                        const data = event.data;
                        if (!ShellPromptHandler.handleShellPrompt(data.result as IShellResultType, data.requestId!,
                            backend)) {
                            this.setProgressMessage(event.message ?? "Loading ...");
                        }

                        break;
                    }

                    case EventType.FinalResponse: {
                        this.setProgressMessage("Connection opened, creating the editor...");

                        // Once the connection is open we can create the editor.
                        let currentSchema = "";
                        if (event.data.currentSchema) {
                            currentSchema = event.data.currentSchema;
                        } else if (connection.dbType === DBType.MySQL) {
                            currentSchema = (connection.options as IMySQLConnectionOptions).schema ?? "";
                        }

                        const info = event.data.info;
                        const sqlMode = info.sqlMode ?? settings.get("editor.sqlMode", "");
                        const serverVersion = info.version
                            ? parseVersion(info.version)
                            : settings.get("editor.dbVersion", 80024);
                        const serverEdition = info.edition ?? "";

                        const model = this.createEditorModel(backend, "", "msg", serverVersion, sqlMode, currentSchema);

                        const entryId = uuid();
                        const connectionState: IDBConnectionTabPersistentState = {
                            activeEntry: entryId,
                            currentSchema,
                            schemaTree: [],
                            explorerState: new Map(),
                            editors: [{
                                id: entryId,
                                caption: "Notebook",
                                type: EntityType.Console,
                                state: {
                                    model,
                                    viewState: null,
                                    options: defaultEditorOptions,
                                },
                                currentVersion: model.getVersionId(),
                            }],
                            scripts: this.scriptsTree,
                            backend,
                            serverVersion,
                            serverEdition,
                            sqlMode,

                            explorerWidth: -1,
                        };

                        this.connectionState.set(tabId, connectionState);

                        editorTabs.push({
                            details: connection,
                            tabId,
                            caption: connection.caption + tabSuffix,
                            suppressAbout,
                        });

                        this.hideProgress(false);
                        this.setState({ editorTabs, selectedPage: tabId, loading: false }, () => {
                            resolve(true);
                        });

                        break;
                    }

                    default: {
                        break;
                    }
                }
            }).catch((errorEvent: ICommErrorEvent) => {
                void requisitions.execute("showError", ["Connection Error", String(errorEvent.message)]);

                const { lastSelectedPage } = this.state;
                this.setState({ selectedPage: lastSelectedPage ?? "connections" }, () => { resolve(false); });
                this.hideProgress(true);
            });
        });
    }

    /**
     * Opens an existing connection again.
     *
     * @param backend The backend for the connection.
     * @param connection The connection details.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private reOpenConnection(backend: ShellInterfaceSqlEditor, connection: IConnectionDetails): Promise<boolean> {
        return new Promise((resolve, reject) => {
            backend.openConnection(connection.id).then((event: ICommOpenConnectionEvent) => {
                if (!event.data) {
                    return;
                }

                switch (event.eventType) {
                    case EventType.DataResponse: {
                        const data = event.data;
                        const result = data.result as IShellResultType;
                        if (!ShellPromptHandler.handleShellPrompt(result, data.requestId!, backend)) {
                            this.setProgressMessage(event.message ?? "Loading ...");
                        }

                        break;
                    }

                    case EventType.FinalResponse: {
                        this.setProgressMessage("Connection opened");

                        resolve(true);

                        break;
                    }

                    default: {
                        break;
                    }
                }
            }).catch((errorEvent: ICommErrorEvent) => {
                void requisitions.execute("showError", ["Connection Error", String(errorEvent.message)]);

                const { lastSelectedPage } = this.state;
                this.setState({ selectedPage: lastSelectedPage ?? "connections" });
                this.hideProgress(true);
                reject();
            });
        });
    }

    /**
     * Handles closing of a single tab (via its close button).
     *
     * @param e The mouse event.
     */
    private handleCloseTab = (e: React.SyntheticEvent): void => {
        e.stopPropagation();

        const id = (e.currentTarget as HTMLElement).id;

        void this.removeTab(id);
    };

    private async removeTab(tabId: string): Promise<boolean> {
        const { selectedPage, editorTabs } = this.state;

        // Remove all result data from the application DB.
        await ApplicationDB.removeDataByTabId(StoreType.DbEditor, tabId);

        // Remove tab info from the connection state and select another tab.
        const index = editorTabs.findIndex((info: IDBEditorTabInfo) => {
            return info.tabId === tabId;
        });

        if (index > -1) {
            const connectionState = this.connectionState.get(tabId);
            if (connectionState) {
                // Save pending changes.
                connectionState.editors.forEach((editor) => {
                    this.saveEditorIfNeeded(editor);
                });

                this.connectionState.delete(tabId);
                await connectionState.backend.closeSession();
            }

            editorTabs.splice(index, 1);
            let newSelection = selectedPage;

            if (tabId === newSelection) {
                if (index > 0) {
                    newSelection = editorTabs[index - 1].tabId;
                } else {
                    if (index >= editorTabs.length - 1) {
                        newSelection = "connections"; // The overview page cannot be closed.
                    } else {
                        newSelection = editorTabs[index + 1].tabId;
                    }
                }
            }

            this.setState({ selectedPage: newSelection, editorTabs });
        }

        return true;
    }

    /**
     * Closes all tabs that are connected using the specific connection.
     *
     * @param connectionId The id of the connection.
     *
     * @returns A promise which immediately resolves to true.
     */
    private async removeTabsForConnection(connectionId: number): Promise<boolean> {
        const { editorTabs } = this.state;

        for (const tab of editorTabs) {
            if (tab.details.id === connectionId) {
                await this.removeTab(tab.tabId);
            }
        }

        return Promise.resolve(true);
    }

    private handleSelectItem = (id: string, props: IDropdownProperties): void => {
        const list = React.Children.toArray(props.children);
        const item = list.find((entry) => {
            // eslint-disable-next-line dot-notation
            const candidateProps = entry["props"] as IDocumentDropdownItemProperties;

            return candidateProps.page && candidateProps.id === id;
        });

        if (item) {
            // eslint-disable-next-line dot-notation
            const candidateProps = item["props"] as IDocumentDropdownItemProperties;

            // For UI elements that have to show the current connection title.
            this.handleSelectTab(candidateProps.page);

            // For the content.
            this.handleSelectEntry(candidateProps.page, candidateProps.item);
        } else {
            // A connection tab or the overview tab.
            this.handleSelectTab(id);
        }
    };

    private handleEditorSave = (): void => {
        const { selectedPage } = this.state;

        const connectionState = this.connectionState.get(selectedPage);
        if (connectionState) {
            const state = connectionState.editors.find((state) => {
                return state.id === connectionState.activeEntry;
            });

            if (state) {
                this.saveEditorIfNeeded(state);
            }
        }

    };

    private handleSelectTab = (id: string): void => {
        const { selectedPage } = this.state;

        const connectionState = this.connectionState.get(selectedPage);
        if (connectionState) {
            // Save pending changes.
            connectionState.editors.forEach((editor) => {
                this.saveEditorIfNeeded(editor);
            });
        }

        this.setState({ selectedPage: id, selectedItem: undefined });

        if (id === "connections") {
            requisitions.executeRemote("selectConnectionTab", "SQL Connections");
        } else {
            const { editorTabs } = this.state;
            const tab = editorTabs.find((info) => {
                return info.tabId === id;
            });

            if (tab) {
                requisitions.executeRemote("selectConnectionTab", tab.caption);
            }
        }
    };

    private handleAddEditor = (id: string): string | undefined => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const model = this.createEditorModel(connectionState.backend, "", "msg", connectionState.serverVersion,
                connectionState.sqlMode, connectionState.currentSchema);

            const id = uuid();
            connectionState.editors.push({
                id,
                caption: `Notebook ${++this.editorCounter}`,
                type: EntityType.Console,
                state: {
                    model,
                    viewState: null,
                    options: defaultEditorOptions,
                },
                currentVersion: model.getVersionId(),
            });
            connectionState.activeEntry = id;
            this.forceUpdate();

            return id;
        }
    };

    private handleRemoveEditor = (id: string, editorId: string, doUpdate = true): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const index = connectionState.editors.findIndex((editor: IOpenEditorState) => {
                return editor.id === editorId;
            });

            if (index > -1) {
                // Make sure any pending change is sent to the backend, if that editor represents a stored script.
                this.saveEditorIfNeeded(connectionState.editors[index]);

                if (connectionState.activeEntry === editorId) {
                    // Select another editor if we're just removing the selected one.
                    if (index > 0) {
                        connectionState.activeEntry = connectionState.editors[index - 1].id;
                    } else {
                        if (index < connectionState.editors.length - 1) {
                            connectionState.activeEntry = connectionState.editors[index + 1].id;
                        }
                    }
                }

                connectionState.editors.splice(index, 1);

                if (connectionState.editors.length === 0) {
                    // Add the default editor, if the user just removed the last editor.
                    const model = this.createEditorModel(connectionState.backend, "", "msg",
                        connectionState.serverVersion, connectionState.sqlMode, connectionState.currentSchema);

                    const entryId = uuid();
                    connectionState.editors.push({
                        id: entryId,
                        caption: "Notebook",
                        type: EntityType.Console,
                        state: {
                            model,
                            viewState: null,
                            options: defaultEditorOptions,
                        },
                        currentVersion: model.getVersionId(),
                    });

                    connectionState.activeEntry = entryId;
                }

                if (doUpdate) {
                    this.forceUpdate();
                }
            }
        }
    };

    private handleEditorSelectorChange = (selectedId: string | number): void => {
        const { selectedPage } = this.state;

        this.handleSelectEntry(selectedPage, selectedId as string);
    };

    /**
     * The central method to deal with selection changes in the notebook explorer and requests to open editors/pages
     * for specific pages, which includes admin pages and external or broken out scripts.
     *
     * @param id The editor of the notebook sending this event.
     * @param entryId The unique ID of the item that will be (or is already) selected.
     * @param name An optional display name for broken out and external scripts.
     * @param content The SQL code of such scripts.
     */
    private handleSelectEntry = (id: string, entryId: string, name?: string, content?: string): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState && connectionState.activeEntry !== entryId) {
            // if there's a current editor. Save its content, if it represents a user script.
            const currentEditor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === connectionState.activeEntry;
            });

            if (currentEditor) {
                this.saveEditorIfNeeded(currentEditor);
            }

            let updateCurrentEntry = true;

            // Check if we have an open editor with the new id (administration pages like server status count here too).
            const newEditor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === entryId;
            });

            if (!newEditor) {
                // If no open editor exists, try to find a script with that id and open that.

                const script = connectionState.scripts.find((candidate: IDBDataEntry) => {
                    return candidate.id === entryId;
                }) as IDBEditorScriptState;

                if (script) {
                    if (script.dbDataId) {
                        // Defer the current entry update to the moment when script data has been loaded.
                        updateCurrentEntry = false;
                        ShellInterface.modules.getDataContent(script.dbDataId)
                            .then((event: ICommModuleDataContentEvent) => {
                                if (event.data) {
                                    this.addEditorFromScript(connectionState, script, event.data.result);

                                    connectionState.activeEntry = entryId;
                                    this.forceUpdate();
                                }
                            }).catch((event) => {
                                void requisitions.execute("showError",
                                    ["Loading Error", "Cannot load scripts content:", String(event.message)]);
                            });
                    } else {
                        // No script either? Create a new one.
                        this.addEditorFromScript(connectionState, script, "");
                    }
                } else {
                    // Must be an administration page or an external script then.
                    switch (entryId) {
                        case "serverStatus": {
                            connectionState.editors.push({
                                id: "serverStatus",
                                caption: "Server Status",
                                type: EntityType.Admin,
                                currentVersion: 0,
                            });

                            break;
                        }

                        case "clientConnections": {
                            connectionState.editors.push({
                                id: "clientConnections",
                                caption: "Client Connections",
                                type: EntityType.Admin,
                                currentVersion: 0,
                            });

                            break;
                        }

                        case "performanceDashboard": {
                            connectionState.editors.push({
                                id: "performanceDashboard",
                                caption: "Performance Dashboard",
                                type: EntityType.Admin,
                                currentVersion: 0,
                            });

                            break;
                        }

                        default: {
                            if (content) {
                                // External scripts come with their full content.
                                const script: IDBEditorScriptState = {
                                    id: entryId,
                                    caption: name ?? "Script",
                                    language: "mysql",
                                    dbDataId: -1,
                                    folderId: -1,
                                    type: EntityType.Script,
                                };
                                this.addEditorFromScript(connectionState, script, content);
                            }

                            break;
                        }
                    }

                }
            }

            if (updateCurrentEntry) {
                connectionState.activeEntry = entryId;
                this.forceUpdate();
            }
        }
    };

    /**
     * Helper method to create a new editor entry from a script entry.
     *
     * @param state The connection state, which receives the new editor.
     * @param script The script from which we create the editor.
     * @param content The script's content.
     */
    private addEditorFromScript(state: IDBConnectionTabPersistentState, script: IDBEditorScriptState,
        content: string): void {
        const model = this.createEditorModel(state.backend, content, script.language, state.serverVersion,
            state.sqlMode, state.currentSchema);

        state.editors.push({
            id: script.id,
            caption: script.caption,
            type: EntityType.Script,
            state: {
                model,
                viewState: null,
                options: defaultEditorOptions,
            },
            dbDataId: script.dbDataId,
            currentVersion: model.getVersionId(),
        });
    }

    /**
     * Checks the given editor state for editor model changes and if there were any and the editor is an instance
     * of a script then it updates the module data entry from which this script originates.
     *
     * @param editor The editor state to use for the update.
     */
    private saveEditorIfNeeded(editor: IOpenEditorState): void {
        if (editor.dbDataId && editor.state) {
            const model = editor.state.model;
            const newVersion = model.getVersionId();
            if (newVersion !== editor.currentVersion) {
                editor.currentVersion = newVersion;
                const content = model.getValue();
                if (editor.dbDataId > -1) {
                    // Represents a DB data entry.
                    ShellInterface.modules.updateData(editor.dbDataId, undefined, content);
                } else {
                    // Represents a script file from the extension.
                    const details: IScriptRequest = {
                        scriptId: editor.id,
                        content,
                    };
                    requisitions.executeRemote("editorSaveScript", details);
                }

                // Remove the editor also from the dirty editors list, to disable the save button.
                const { dirtyEditors } = this.state;

                if (dirtyEditors.delete(editor.id)) {
                    this.setState({ dirtyEditors });
                }
            }
        }
    }

    private handleEditorRename = (id: string, editorId: string, newCaption: string): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            let needsUpdate = false;
            const editor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === editorId;
            });

            if (editor) {
                editor.caption = newCaption;
                needsUpdate = true;
            }

            const script = connectionState.scripts.find((candidate: IDBDataEntry) => {
                return candidate.id === editorId;
            });

            if (script) {
                script.caption = newCaption;
                needsUpdate = true;
            }

            if (needsUpdate) {
                if (script?.dbDataId) {
                    ShellInterface.modules.updateData(script.dbDataId, script.caption);
                }

                this.forceUpdate();
            }
        }
    };

    private handleEditorChange = (id: string, editorId: string): void => {
        const { dirtyEditors } = this.state;

        if (!dirtyEditors.has(editorId)) {
            dirtyEditors.add(editorId);
            this.setState({ dirtyEditors });
        }
    };

    private handleAddScript = (id: string, language: EditorLanguage, dialect: DBType): void => {
        let editorLanguage = language;
        if (editorLanguage === "sql") {
            // Determine the actual language dialect to use here.
            switch (dialect) {
                case DBType.MySQL: {
                    editorLanguage = "mysql";
                    break;
                }

                default: {
                    break;
                }
            }
        }

        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const model = this.createEditorModel(connectionState.backend, "", editorLanguage,
                connectionState.serverVersion, connectionState.sqlMode, connectionState.currentSchema);

            let caption = "";
            while (true) {
                const newCaption = `Script ${++this.editorCounter}`;
                const existing = connectionState.scripts.findIndex((candidate) => {
                    return candidate.caption === newCaption;
                });

                if (existing === -1) {
                    caption = newCaption;
                    break;
                }
            }

            connectionState.activeEntry = id;

            // Add a data record for the new script.
            const category = ShellInterface.modules.scriptTypeFromLanguage(editorLanguage);
            if (category) {
                ShellInterface.modules.addData(caption, "", category, "scripts", "")
                    .then((event: ICommModuleAddDataEvent) => {
                        if (event.data) {
                            const moduleDataId = event.data.result;
                            const scriptId = uuid();
                            connectionState.editors.push({
                                id: scriptId,
                                caption,
                                type: EntityType.Script,
                                state: {
                                    model,
                                    viewState: null,
                                    options: defaultEditorOptions,
                                },
                                currentVersion: model.getVersionId(),
                            });

                            connectionState.scripts.push({
                                id: scriptId,
                                type: EntityType.Script,
                                caption,
                                language: editorLanguage,
                                dbDataId: moduleDataId,
                            } as IDBEditorScriptState);

                            this.forceUpdate();
                        }
                    }).catch((event) => {
                        void requisitions.execute("showError",
                            ["Data Module Error", "Cannot add new user script:", String(event.message)]);
                    });
            }
        }
    };

    private handleExplorerResize = (id: string, size: number): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.explorerWidth = size;
        }
    };

    private handleExplorerMenuAction = (id: string, actionId: string, params?: unknown): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            switch (actionId) {
                case "deleteScriptMenuItem": {
                    if (params) {
                        const data = params as IDBDataEntry;
                        const scriptIndex = connectionState.scripts.findIndex((state) => {
                            return state.id === data.id;
                        });

                        const script = scriptIndex > -1 ? connectionState.scripts[scriptIndex] : undefined;
                        if (script && script.dbDataId) {
                            // Found the script. Remove its editor, if there's one.
                            this.handleRemoveEditor(id, data.id, false);

                            ShellInterface.modules.deleteData(script.dbDataId, data.folderId)
                                .then(() => {
                                    connectionState.scripts.splice(scriptIndex, 1);
                                    this.forceUpdate();
                                }).catch((event) => {
                                    void requisitions.execute("showError",
                                        ["Data Module Error", "Cannot delete user script:", String(event.message)]);
                                });
                        }
                    }

                    break;
                }

                default: {
                    break;
                }
            }
        }
    };

    /**
     * Creates the standard model used by DB code editors. Each editor has an own model, which carries additional
     * information required by the editors.
     *
     * @param backend The interface for the current shell module session, used for running code and editor assistants.
     * @param text The initial content of the model.
     * @param language The code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     *
     * @returns The new model.
     */
    private createEditorModel(backend: ShellInterfaceSqlEditor, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string): ICodeEditorModel {

        const model = Monaco.createModel(text, language) as ICodeEditorModel;
        model.executionContexts = new ExecutionContexts(StoreType.DbEditor, serverVersion, sqlMode, currentSchema);
        model.symbols = new DynamicSymbolTable(backend, "db symbols", { allowDuplicateSymbols: true });
        model.editorMode = CodeEditorMode.Standard;

        return model;
    }

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.pendingProgress = setTimeout(() => {
            const { selectedPage } = this.state;

            this.setState({ loading: true, lastSelectedPage: selectedPage });
        }, 500);
    };

    private hideProgress = (reRender: boolean): void => {
        if (this.pendingProgress) {
            clearTimeout(this.pendingProgress);
            this.pendingProgress = null;

            if (reRender) {
                this.setState({ loading: false });
            }
        }
    };

    private handleSaveSchemaTree = (id: string, schemaTree: ISchemaTreeEntry[]): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.schemaTree = schemaTree;
        }
    };

    private handleSaveExplorerState = (id: string, state: Map<string, IExplorerSectionState>): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.explorerState = state;
        }
    };

    private handleHelpCommand = (command: string, language: EditorLanguage): string | undefined => {
        switch (language) {
            case "javascript": {
                return `The DB Editor's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value: any): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res:IResultSetRow[]) => void), params?: unknown): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "typescript": {
                return `The DB Editor's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: any): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res:IResultSetRow[]) => void), params?: unknown): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "mysql": {
                return `The DB Editor's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/`;
            }

            default:
        }
    };
}
