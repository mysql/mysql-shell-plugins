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

import defaultIcon from "../../assets/images/file-icons/default.svg";

import closeIcon from "../../assets/images/close2.svg";
import connectionIconMySQL from "../../assets/images/connectionMysql.svg";
import connectionIconSQLite from "../../assets/images/connectionSqlite.svg";
import moduleIcon from "../../assets/images/modules/module-sql.svg";
import overviewPageIcon from "../../assets/images/overviewPage.svg";
import scriptingIcon from "../../assets/images/scripting.svg";

import javascriptIcon from "../../assets/images/file-icons/scriptJs.svg";
import mysqlIcon from "../../assets/images/file-icons/scriptMysql.svg";
import sqliteIcon from "../../assets/images/file-icons/scriptSqlite.svg";
import typescriptIcon from "../../assets/images/file-icons/scriptTs.svg";
import newConsoleIcon from "../../assets/images/toolbar/toolbar-new-shell-console.svg";

import newNotebookIcon from "../../assets/images/newNotebook.svg";

import { ComponentChild, createRef, toChildArray, VNode } from "preact";

import { IModuleInfo, IModuleProperties, IModuleState, ModuleBase } from "../ModuleBase.js";

import { ICodeEditorModel } from "../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../components/ui/CodeEditor/index.js";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts.js";
import {
    appParameters, IMrsAuthAppEditRequest, IMrsContentSetEditRequest, IMrsDbObjectEditRequest, IMrsSchemaEditRequest,
    IMrsSdkExportRequest,
    IMrsUserEditRequest, InitialEditor, requisitions,
} from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { DBConnectionEditorType, DBType, IConnectionDetails } from "../../supplement/ShellInterface/index.js";
import { ConnectionBrowser } from "./ConnectionBrowser.js";
import {
    DBConnectionTab, IDBConnectionTabPersistentState, IOpenEditorState, ISelectItemDetails,
} from "./DBConnectionTab.js";
import { documentTypeToIcon, IExplorerSectionState, pageTypeToIcon } from "./Explorer.js";
import {
    EntityType, IDBDataEntry, IDBEditorScriptState, ISavedGraphData, ISchemaTreeEntry, IToolbarItems,
} from "./index.js";

import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import { IMySQLConnectionOptions } from "../../communication/MySQL.js";
import {
    IOpenConnectionData, IShellPasswordFeedbackRequest, IStatusData,
} from "../../communication/ProtocolGui.js";
import { IMrsServiceData } from "../../communication/ProtocolMrs.js";
import { ISqliteConnectionOptions } from "../../communication/Sqlite.js";
import { Button } from "../../components/ui/Button/Button.js";
import { ComponentPlacement, IComponentProperties } from "../../components/ui/Component/ComponentBase.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown, IDropdownProperties } from "../../components/ui/Dropdown/Dropdown.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Image } from "../../components/ui/Image/Image.js";
import { defaultEditorOptions } from "../../components/ui/index.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { ITabviewPage, TabPosition, Tabview } from "../../components/ui/Tabview/Tabview.js";
import { parseVersion } from "../../parsing/mysql/mysql-helpers.js";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable.js";
import { EditorLanguage, IExecutionContext, INewEditorRequest } from "../../supplement/index.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { webSession } from "../../supplement/WebSession.js";
import { uuid } from "../../utilities/helpers.js";
import { ShellPromptHandler } from "../common/ShellPromptHandler.js";
import { DBEditorModuleId } from "../ModuleInfo.js";
import { MrsHub } from "../mrs/MrsHub.js";
import { DocumentDropdownItem, IDocumentDropdownItemProperties } from "./DocumentDropdownItem.js";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool.js";

import scriptingRuntime from "./assets/typings/scripting-runtime.d.ts?raw";
import type { ISqlUpdateResult } from "../../app-logic/Types.js";
import { ILakehouseNavigatorSavedState } from "./LakehouseNavigator.js";
import { IChatOptionsState } from "../../components/Chat/ChatOptions.js";

/**
 * Details generated while adding a new tab. These are used in the render method to fill the tab page details.
 */
export interface IDBEditorTabInfo {
    details: IConnectionDetails;
    tabId: string;
    caption: string;
    suppressAbout: boolean;
}

type IDBEditorModuleProperties = IModuleProperties;

export interface IDBEditorModuleState extends IModuleState {
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

    private pendingProgress: ReturnType<typeof setTimeout> | null = null;

    private actionMenuRef = createRef<Menu>();
    private mrsHubRef = createRef<MrsHub>();
    private currentTabRef = createRef<DBConnectionTab>();

    public static override get info(): IModuleInfo {
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

        void this.loadConnections();
        ShellInterface.modules.loadScriptsTree().then((tree) => {
            this.scriptsTree = tree;
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot load user scripts: " + message);
        });
    }

    public static override getDerivedStateFromProps(props: IDBEditorModuleProperties,
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

    public override componentDidMount(): void {
        requisitions.register("showPage", this.showPage);
        requisitions.register("openConnectionTab", this.openConnectionTab);
        requisitions.register("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.register("moduleToggle", this.toggleModule);
        requisitions.register("editorShowConnections", this.showConnections);
        requisitions.register("editorRunCommand", this.runCommand);
        requisitions.register("editorSaved", this.editorSaved);
        requisitions.register("editorClose", this.editorClose);
        requisitions.register("createNewEditor", this.createNewEditor);
        requisitions.register("profileLoaded", this.profileLoaded);
        requisitions.register("webSessionStarted", this.webSessionStarted);

        requisitions.register("connectionAdded", this.handleConnectionAdded);
        requisitions.register("connectionUpdated", this.handleConnectionUpdated);
        requisitions.register("connectionRemoved", this.handleConnectionRemoved);
        requisitions.register("refreshConnections", this.handleRefreshConnections);

        requisitions.register("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.register("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.register("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.register("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.register("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.register("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.register("showMrsSdkExportDialog", this.showMrsSdkExportDialog);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("openConnectionTab", this.openConnectionTab);
        requisitions.unregister("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.unregister("moduleToggle", this.toggleModule);
        requisitions.unregister("editorShowConnections", this.showConnections);
        requisitions.unregister("editorRunCommand", this.runCommand);
        requisitions.unregister("editorSaved", this.editorSaved);
        requisitions.unregister("editorClose", this.editorClose);
        requisitions.unregister("createNewEditor", this.createNewEditor);
        requisitions.unregister("profileLoaded", this.profileLoaded);
        requisitions.unregister("webSessionStarted", this.webSessionStarted);

        requisitions.unregister("connectionAdded", this.handleConnectionAdded);
        requisitions.unregister("connectionUpdated", this.handleConnectionUpdated);
        requisitions.unregister("connectionRemoved", this.handleConnectionRemoved);
        requisitions.unregister("refreshConnections", this.handleRefreshConnections);

        requisitions.unregister("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.unregister("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.unregister("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.unregister("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.unregister("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.unregister("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.unregister("showMrsSdkExportDialog", this.showMrsSdkExportDialog);
    }

    public override render(): ComponentChild {
        const { innerRef } = this.props;
        const {
            connections, connectionsLoaded, selectedPage, editorTabs, showExplorer, showTabs, loading,
            progressMessage,
        } = this.state;

        let sqlIcon = mysqlIcon;
        const isEmbedded = appParameters.embedded;

        // Generate the main toolbar items based on the current display mode.
        const toolbarItems: IToolbarItems = { navigation: [], execution: [], editor: [], auxillary: [] };
        if (isEmbedded) {
            const dropDownItems = [
                <Dropdown.Item
                    id="connections"
                    key="connections"
                    caption="DB Connection Overview"
                    picture={<Icon src={overviewPageIcon} />}
                />,
            ];

            let selectedEntry: string | undefined;
            editorTabs.forEach((info: IDBEditorTabInfo) => {
                const connectionState = this.connectionState.get(info.tabId)!;

                // Add one entry per connection.
                const iconName = info.details.dbType === DBType.MySQL ? connectionIconMySQL : connectionIconSQLite;

                dropDownItems.push(
                    <Dropdown.Item
                        id={info.tabId}
                        key={info.tabId}
                        caption={info.caption}
                        picture={<Icon src={iconName} />}
                    />,
                );

                // After that add an entry for each open document (indented).
                connectionState.editors.forEach((entry) => {
                    let picture;
                    if (entry.state) {
                        const language = entry.state.model.getLanguageId() as EditorLanguage;
                        const iconName = documentTypeToIcon.get(language);
                        if (language === "msg") {
                            picture = <Icon src={iconName ?? defaultIcon} />;
                        } else {
                            picture = <Image src={iconName ?? defaultIcon} />;
                        }
                    } else {
                        const name = pageTypeToIcon.get(entry.type) || defaultIcon;
                        picture = <Icon src={name} />;
                    }

                    dropDownItems.push((
                        <DocumentDropdownItem
                            page={info.tabId}
                            type={entry.type}
                            id={entry.id}
                            key={entry.id}
                            caption={entry.caption}
                            picture={picture}
                            style={{ marginLeft: 16 }}
                        />
                    ));

                    if (selectedPage === info.tabId && entry.id === connectionState.activeEntry) {
                        selectedEntry = entry.id;

                        if (info.details.dbType === DBType.Sqlite) {
                            sqlIcon = sqliteIcon;
                        }
                    }
                });
            });

            toolbarItems.navigation.push(
                <Label key="mainLabel" style={{ marginRight: "8px" }}>Editor:</Label>,
                <Dropdown
                    id="documentSelector"
                    key="selector"
                    selection={selectedEntry ?? selectedPage}
                    onSelect={this.handleSelectTabOrEntry}
                >
                    {dropDownItems}
                </Dropdown>,
            );

            if (selectedPage === "connections") {
                toolbarItems.navigation.push(
                    <Button
                        key="button1"
                        id="newConsoleMenuButton"
                        data-tooltip="Open New Shell Console"
                        style={{ marginLeft: "4px" }}
                        onClick={this.addNewConsole}
                    >
                        <Icon key="newIcon" src={newConsoleIcon} data-tooltip="inherit" />
                    </Button>,
                    <Divider key="divider2" id="actionDivider" vertical={true} thickness={1} />,
                );
            }

            toolbarItems.auxillary.push(<Button
                id="itemCloseButton"
                key="itemCloseButton"
                imageOnly
                data-tooltip="Close this Editor"
                onClick={this.handleCloseButtonClick}
            >
                <Icon src={closeIcon} data-tooltip="inherit" />
            </Button>);
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
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </>;

            pages.push({
                icon: overviewPageIcon,
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
                onUpdateConnection={this.handleUpdateConnection}
                onDropConnection={this.handleDropConnection}
                onPushSavedConnection={this.handlePushConnection}
            />);

            pages.push({
                icon: overviewPageIcon,
                caption: "Connection Overview",
                id: "connections",
                content,
            });
        }

        editorTabs.forEach((info: IDBEditorTabInfo) => {
            const connectionState = this.connectionState.get(info.tabId)!;

            if (toolbarItems.navigation.length === 0) {
                // If no special UI is to be rendered use an editor selection dropdown.
                toolbarItems.navigation.push(
                    <Label key="mainLabel" style={{ marginRight: "8px" }}>Editor:</Label>,
                    <Dropdown
                        id="documentSelector"
                        key="documentSelector"
                        selection={connectionState.activeEntry}
                        onSelect={this.handleEditorSelectorChange}
                    >
                        {
                            connectionState.editors.map((entry) => {
                                let picture;
                                if (entry.state) {
                                    const language = entry.state.model.getLanguageId() as EditorLanguage;
                                    const iconName = documentTypeToIcon.get(language);
                                    if (language === "msg") {
                                        picture = <Icon src={iconName ?? defaultIcon} />;
                                    } else {
                                        picture = <Image src={iconName ?? defaultIcon} />;
                                    }
                                } else {
                                    const name = pageTypeToIcon.get(entry.type) || defaultIcon;
                                    picture = <Icon src={name} />;
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
                );
            }

            const content = (<DBConnectionTab
                id={info.tabId}
                ref={info.tabId === actualSelection ? this.currentTabRef : undefined}
                caption={info.caption}
                showAbout={!info.suppressAbout}
                workerPool={this.workerPool}
                dbType={info.details.dbType}
                connectionId={info.details.id}
                toolbarItems={toolbarItems}
                extraLibs={[{ code: scriptingRuntime, path: "runtime" }]}
                savedState={connectionState}
                showExplorer={showTabs && showExplorer}
                onHelpCommand={this.handleHelpCommand}
                onAddEditor={this.handleAddNotebook}
                onRemoveEditor={this.handleRemoveEditor}
                onLoadScript={this.handleLoadEditor}
                onSelectItem={this.handleSelectEntry}
                onEditorRename={this.handleEditorRename}
                onEditorChange={this.handleEditorChange}
                onAddScript={this.handleAddScript}
                onSaveSchemaTree={this.handleSaveSchemaTree}
                onSaveExplorerState={this.handleSaveExplorerState}
                onSaveAdminLakehouseNavigatorState={this.handleAdminLakehouseNavigatorState}
                onExplorerResize={this.handleExplorerResize}
                onExplorerMenuAction={this.handleExplorerMenuAction}
                onGraphDataChange={this.handleGraphDataChange}
                onChatOptionsChange={this.onChatOptionsChange}
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
                        <Icon src={closeIcon} />
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
            {isEmbedded &&
                <Menu
                    key="actionMenu"
                    id="editorToolbarActionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleNewScriptClick}
                >
                    <MenuItem key="item1" id="addEditor" caption="New DB Notebook" icon={newNotebookIcon} />
                    <MenuItem key="item2" id="addSQLScript" caption="New SQL Script" icon={sqlIcon} />
                    <MenuItem key="item3" id="addTSScript" caption="New TS Script" icon={typescriptIcon} />
                    <MenuItem key="item4" id="addJSScript" caption="New JS Script" icon={javascriptIcon} />
                </Menu>
            }
            <MrsHub ref={this.mrsHubRef} />
        </>;
    }

    public handlePushConnection = (details: IConnectionDetails): void => {
        const { connections } = this.state;
        connections.push(details);
        this.setState({ connections });
    };

    protected sendSqlUpdatesFromModel = async (backend: ShellInterfaceSqlEditor,
        updates: string[]): Promise<ISqlUpdateResult> => {

        let lastIndex = 0;
        let rowCount = 0;
        try {
            await backend.startTransaction();
            for (; lastIndex < updates.length; ++lastIndex) {
                const update = updates[lastIndex];
                const result = await backend.execute(update);
                rowCount += result?.rowsAffected ?? 0;
            }
            await backend.commitTransaction();

            // Don't wait for the info message.
            void requisitions.execute("showInfo", "Changes committed successfully.");

            return { affectedRows: rowCount, errors: [] };
        } /* istanbul ignore next */ catch (reason) {
            await backend.rollbackTransaction();
            if (reason instanceof Error) {
                const errors: string[] = [];
                errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

                return { affectedRows: rowCount, errors };
            }

            throw reason;
        }
    };

    protected handleHelpCommand = (command: string, language: EditorLanguage): string | undefined => {
        switch (language) {
            case "javascript": {
                return `The DB Notebook's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value: any): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "typescript": {
                return `The DB Notebook's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: unknown): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown[]): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown[]): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "mysql": {
                return `The DB Notebook's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/`;
            }

            default:
        }
    };

    protected handleAddScript = (id: string, language: EditorLanguage, dialect?: DBType): void => {
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

            // Add a data record for the new script.
            const category = ShellInterface.modules.scriptTypeFromLanguage(editorLanguage);
            if (category) {
                ShellInterface.modules.addData(caption, "", category, "scripts", "").then((dbDataId) => {
                    const scriptId = uuid();
                    const newState = {
                        id: scriptId,
                        caption,
                        dbDataId,
                        type: EntityType.Script,
                        state: {
                            model,
                            viewState: null,
                            options: defaultEditorOptions,
                        },
                        currentVersion: model.getVersionId(),
                    };
                    connectionState.editors.push(newState);

                    connectionState.scripts.push({
                        id: scriptId,
                        type: EntityType.Script,
                        caption,
                        language: editorLanguage,
                        dbDataId,
                        folderId: 1, // TODO: determine the real folder ID.
                    } as IDBEditorScriptState);

                    connectionState.activeEntry = scriptId;
                    this.notifyRemoteEditorOpen(connectionState.connectionId, id, connectionState.dbType,
                        editorLanguage, newState);

                    this.forceUpdate();
                }).catch((reason) => {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    void requisitions.execute("showError", "Cannot add new user script: " + message);
                });
            }
        }
    };

    protected handleEditorRename = (id: string, editorId: string, newCaption: string): void => {
        const connectionState = this.connectionState.get(id);
        if (newCaption && connectionState) {
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
                    void ShellInterface.modules.updateData(script.dbDataId, script.caption);
                }

                this.forceUpdate();
            }
        }
    };

    /**
     * Removes a single editor on a connection tab.
     *
     * @param id  The id of the tab in which the editor is located.
     * @param editorId The id of the editor to remove.
     * @param doUpdate A flag telling if re-rendering is needed.
     */
    protected handleRemoveEditor = (id: string, editorId: string, doUpdate = true): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const index = connectionState.editors.findIndex((editor: IOpenEditorState) => {
                return editor.id === editorId;
            });

            if (index > -1) {
                const editor = connectionState.editors[index];

                // Make sure any pending change is sent to the backend, if that editor represents a stored script.
                this.saveEditorIfNeeded(editor);

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
                this.notifyRemoteEditorClose(connectionState.connectionId, editor.id);

                if (connectionState.editors.length === 0) {
                    // Add the default editor, if the user just removed the last editor.
                    const useNotebook = Settings.get("dbEditor.defaultEditor", "notebook") === "notebook";
                    const language = useNotebook ? "msg" : "mysql";
                    const model = this.createEditorModel(connectionState.backend, "", language,
                        connectionState.serverVersion, connectionState.sqlMode, connectionState.currentSchema);

                    const entryId = uuid();
                    const caption = `DB Notebook ${++this.editorCounter}`;
                    const newState = {
                        id: entryId,
                        caption,
                        type: useNotebook ? EntityType.Notebook : EntityType.Script,
                        state: {
                            model,
                            viewState: null,
                            options: defaultEditorOptions,
                        },
                        currentVersion: model.getVersionId(),
                    };
                    connectionState.editors.push(newState);

                    connectionState.activeEntry = entryId;
                    this.notifyRemoteEditorOpen(connectionState.connectionId, id, connectionState.dbType, language,
                        newState);
                }

                if (doUpdate) {
                    this.forceUpdate();
                }
            }
        }
    };

    protected handleExplorerMenuAction = (id: string, actionId: string, params?: unknown): void => {
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

                            ShellInterface.modules.deleteData(script.dbDataId, data.folderId).then(() => {
                                connectionState.scripts.splice(scriptIndex, 1);
                                this.forceUpdate();
                            }).catch((reason) => {
                                const message = reason instanceof Error ? reason.message : String(reason);
                                void requisitions.execute("showError", "Cannot delete user script: " + message);
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

    protected handleAddConnection = (details: IConnectionDetails): void => {
        ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId, details, "").then((connectionId) => {
            if (connectionId !== undefined) {
                const { connections } = this.state;

                details.id = connectionId;
                connections.push(details);

                this.setState({ connections });
                requisitions.executeRemote("connectionAdded", details);
            }
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot add DB connection: " + message);
        });
    };

    protected handleUpdateConnection = (details: IConnectionDetails): void => {
        ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, details).then(() => {
            this.forceUpdate();
            requisitions.executeRemote("connectionUpdated", details);
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot update DB connection: " + message);

        });
    };

    private async loadConnections(): Promise<void> {
        await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, "").then((connections) => {
            this.setState({ connections, connectionsLoaded: true });
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot load DB connections: " + message);
        });
    }

    private handleDropConnection = (connectionId: number): void => {
        const { connections } = this.state;
        const index = connections.findIndex((value: IConnectionDetails) => { return value.id === connectionId; });
        if (index > -1) {
            this.doDropConnection(index, true);
        }
    };

    /**
     * Helper to remove all tabs for a given connection.
     *
     * @param index The index of the connection in the list of connections.
     * @param sendNotification A flag to indicate if a notification should be sent to the host.
     */
    private doDropConnection = (index: number, sendNotification: boolean): void => {
        const { connections } = this.state;
        const connection = connections[index];
        void ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connection.id).then(() => {
            const connection = connections[index];

            connections.splice(index, 1);
            this.setState({ connections });

            if (sendNotification) {
                requisitions.executeRemote("connectionRemoved", connection);
            }

            void this.removeTabsForConnection(connection.id);
        });
    };

    private showPage = async (
        data: { module: string; page: string; suppressAbout?: boolean; noEditor?: boolean;
            editor?: InitialEditor; }): Promise<boolean> => {
        if (data.module === DBEditorModuleId) {
            const { connectionsLoaded, connections, editorTabs, selectedPage } = this.state;

            const id = parseInt(data.page, 10);
            const connection = connections.find((candidate) => { return candidate.id === id; });

            const doShowPage = (): Promise<boolean> => {
                if (data.page === "connections") {
                    return this.showConnections();
                } else if (connectionsLoaded) {
                    if (connection) {
                        return this.addConnectionTab(connection, false, data.suppressAbout ?? false,
                            data.noEditor ? "none" : (data.editor ?? "default"));
                    }
                }

                return Promise.resolve(false);
            };

            if (this.currentTabRef.current) {
                // See if we already have this page open. If that's the case we don't need to do anything.
                let entry;

                if (connection) { // The connection is no assigned when switching to the overview.
                    entry = editorTabs.find((entry: IDBEditorTabInfo) => {
                        return (entry.details.id === connection.id);
                    });
                }

                if (entry && entry.tabId === selectedPage) {
                    return Promise.resolve(true);
                }

                const canClose = await this.currentTabRef.current.canClose();
                if (canClose) {
                    return doShowPage();
                } else {
                    // Pretend we handled the requisition in case of a rejection, to avoid
                    // multiple attempts to open the new page while the requisition pipeline tries to resolve it.
                    return Promise.resolve(true);
                }
            } else {
                return doShowPage();
            }
        }

        return Promise.resolve(false);
    };

    private openConnectionTab = (data: {
        details: IConnectionDetails; force: boolean; initialEditor: InitialEditor;
    }): Promise<boolean> => {
        return this.addConnectionTab(data.details, data.force, false, data.initialEditor);
    };

    private setCurrentSchema = (data: { id: string; connectionId: number; schema: string; }): Promise<boolean> => {
        return new Promise((resolve) => {
            const { editorTabs } = this.state;

            // Update all editor tabs with this connection.
            editorTabs.forEach((info: IDBEditorTabInfo) => {
                if (info.details.id === data.connectionId) {
                    // Either update the current schema only for the given tab or for all tabs using the same connection
                    // id (if no tab id is given).
                    const connectionState = this.connectionState.get(data.id.length > 0 ? data.id : info.tabId);
                    if (connectionState) {
                        if (connectionState.currentSchema !== data.schema) {
                            void connectionState.backend.setCurrentSchema(data.schema);

                            // Change for chat options
                            this.onChatOptionsChange(data.id.length > 0 ? data.id : info.tabId, {
                                options: {
                                    ...connectionState.chatOptionsState.options,
                                    schemaName: data.schema,
                                },
                            });

                            // Change for new editors.
                            connectionState.currentSchema = data.schema;

                            // Change existing editors.
                            connectionState.editors.forEach((state) => {
                                if (state.state) {
                                    const contexts = state.state.model.executionContexts;
                                    if (contexts) {
                                        contexts.currentSchema = data.schema;
                                    }
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
            requisitions.executeRemote("selectConnectionTab", { connectionId: -1, page: "DB Connection Overview" });
        });
    };

    private runCommand = (details: { command: string; context: IExecutionContext; }): Promise<boolean> => {
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

    private profileLoaded = async (): Promise<boolean> => {
        await this.loadConnections();

        return true;
    };

    private webSessionStarted = async (): Promise<boolean> => {
        // A new web session was established while the module is active. That means previous editor sessions
        // are invalid now and we have to reopen new sessions.
        const { editorTabs } = this.state;

        for (const tab of editorTabs) {
            const state = this.connectionState.get(tab.tabId);
            if (state) {
                await state.backend.startSession(tab.tabId);
                await this.reOpenConnection(state.backend, tab.details);
            }
        }

        return true;
    };

    /**
     * Called when a new connection was added from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionAdded = (details: IConnectionDetails): Promise<boolean> => {
        const { connections } = this.state;
        connections.push(details);
        this.setState({ connections });

        return Promise.resolve(true);
    };

    /**
     * Called when a connection was changed from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionUpdated = (details: IConnectionDetails): Promise<boolean> => {
        const { connections } = this.state;
        const index = connections.findIndex((value: IConnectionDetails) => { return value.id === details.id; });
        if (index > -1) {
            connections[index] = details;

            this.setState({ connections });
        }

        return Promise.resolve(true);
    };

    /**
     * Called when a new connection was added from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionRemoved = (details: IConnectionDetails): Promise<boolean> => {
        const { connections } = this.state;
        const index = connections.findIndex((value: IConnectionDetails) => { return value.id === details.id; });
        if (index > -1) {
            this.doDropConnection(index, false);
        }

        return Promise.resolve(true);
    };

    private handleRefreshConnections = (): Promise<boolean> => {
        return this.loadConnections().then(() => { return true; });
    };

    private showMrsDbObjectDialog = async (request: IMrsDbObjectEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsDbObjectDialog(state.backend, request);
                }
            }
        }

        return false;
    };

    private showMrsServiceDialog = async (request?: IMrsServiceData): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsServiceDialog(state.backend, request);
                }
            }
        }

        return false;
    };

    private showMrsSchemaDialog = async (request: IMrsSchemaEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsSchemaDialog(state.backend, request.schemaName,
                        request.schema);
                }
            }
        }

        return false;
    };

    private showMrsContentSetDialog = async (request: IMrsContentSetEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsContentSetDialog(state.backend, request.directory,
                        request.contentSet, request.requestPath);
                }
            }
        }

        return false;
    };

    private showMrsAuthAppDialog = async (request: IMrsAuthAppEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsAuthAppDialog(state.backend, request.authApp,
                        request.service);
                }
            }
        }

        return false;
    };

    private showMrsUserDialog = async (request: IMrsUserEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsUserDialog(state.backend, request.authApp, request.user);
                }
            }
        }

        return false;
    };

    private showMrsSdkExportDialog = async (request: IMrsSdkExportRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const { selectedPage, editorTabs } = this.state;
            const tab = editorTabs.find((entry) => { return entry.tabId === selectedPage; });
            if (tab) {
                const state = this.connectionState.get(selectedPage);
                if (state) {
                    return this.mrsHubRef.current.showMrsSdkExportDialog(
                        state.backend, request.serviceId, request.connectionId, request.connectionDetails,
                        request.directory);
                }
            }
        }

        return false;
    };

    /**
     * Adds a new connection tab or activates an existing one.
     *
     * @param connection The connection for which to open/active the tab.
     * @param force If true then create a new tab, even if one for the same connection already exists.
     * @param suppressAbout If true then no about text is show when opening the tab.
     * @param initialEditor Indicates what type of editor to open initially.
     *
     * @returns A promise fulfilled once the connect tab is added.
     */
    private addConnectionTab = (connection: IConnectionDetails, force: boolean,
        suppressAbout: boolean, initialEditor: InitialEditor): Promise<boolean> => {
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
                        // istanbul ignore next
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
                                void this.openNewConnection(
                                    backend, tabId, suffix, connection, suppressAbout, initialEditor,
                                ).then((success) => {
                                    handleOutcome(success);
                                });
                            }).catch(() => {
                                // If the path is not ok then we might have to create the DB file first.
                                ShellInterface.core.createDatabaseFile(options.dbFile).then(() => {
                                    void this.openNewConnection(
                                        backend, tabId, suffix, connection, suppressAbout, initialEditor,
                                    ).then(() => {
                                        resolve(true);
                                    });
                                }).catch((reason) => {
                                    const message = reason instanceof Error ? reason.message : String(reason);
                                    void requisitions.execute("showError", "DB Creation Error: " + message);
                                });
                            });
                        } else {
                            void this.openNewConnection(backend, tabId, suffix, connection, suppressAbout,
                                initialEditor)
                                .then((success) => {
                                    handleOutcome(success);
                                });
                        }
                    }).catch((reason) => {
                        this.hideProgress(true);
                        const message = reason instanceof Error ? reason.message : String(reason);
                        void requisitions.execute("showError", "Module Session Error: " + message);
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

    private isStatusCodeData(response: unknown): response is IStatusData {
        return (response as IStatusData).result !== undefined;
    }

    /**
     * Opens the given connection once all verification was done. Used when opening a connection the first time.
     *
     * @param backend The backend for the connection.
     * @param tabId The new id of the tab.
     * @param tabSuffix An additional string to add to the caption of the tab we are about to open.
     * @param connection The connection details.
     * @param suppressAbout If true then no about text is shown.
     * @param initialEditor Determines what type of editor to open initially.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private async openNewConnection(backend: ShellInterfaceSqlEditor, tabId: string, tabSuffix: string,
        connection: IConnectionDetails, suppressAbout: boolean, initialEditor: InitialEditor): Promise<boolean> {

        const { editorTabs } = this.state;

        try {
            // Generate an own request ID, as we may need that for reply requests from the backend.
            const requestId = uuid();
            let connectionData: IOpenConnectionData | undefined;
            await backend.openConnection(connection.id, requestId, ((response, requestId) => {
                if (!ShellPromptHandler.handleShellPrompt(response.result as IShellPasswordFeedbackRequest, requestId,
                    backend, "Provide Password")) {
                    if (this.isStatusCodeData(response) && typeof response.result === "string") {
                        this.setProgressMessage(response.result);
                    }
                    connectionData = response.result as IOpenConnectionData;
                }
            }));

            if (!connectionData) {
                return false;
            }

            this.setProgressMessage("Connection opened, creating the editor...");

            // Once the connection is open we can create the editor.
            let currentSchema = "";
            if (connectionData.currentSchema) {
                currentSchema = connectionData.currentSchema;
            } else if (connection.dbType === DBType.MySQL) {
                currentSchema = (connection.options as IMySQLConnectionOptions).schema ?? "";
            }

            const info = connectionData.info;
            const sqlMode = info.sqlMode ?? Settings.get("editor.sqlMode", "");
            const serverVersion = info.version ? parseVersion(info.version) : Settings.get("editor.dbVersion", 80024);
            const serverEdition = info.edition ?? "";
            const heatWaveEnabled = info.heatWaveAvailable ?? false;
            const mleEnabled = info.mleAvailable ?? false;

            const entryId = uuid();
            let useNotebook;
            if (connection.settings && connection.settings.defaultEditor) {
                useNotebook = connection.settings.defaultEditor === DBConnectionEditorType.DbNotebook;
            } else {
                useNotebook = Settings.get("dbEditor.defaultEditor", "notebook") === "notebook";
            }

            // Get the execution history entries for this connection, but only fetch the first 30 chars of the code
            // for preview purposes
            const executionHistory = await backend.getExecutionHistoryEntries(connection.id, 30);

            let type: EntityType;
            if (initialEditor === undefined || initialEditor === "default") {
                type = useNotebook ? EntityType.Notebook : EntityType.Script;
            } else {
                type = initialEditor === "notebook" ? EntityType.Notebook : EntityType.Script;
            }

            const language: EditorLanguage = type === EntityType.Notebook ? "msg" : "mysql";

            const editors: IOpenEditorState[] = [];
            let newState;
            if (initialEditor !== "none") {
                const model = this.createEditorModel(backend, "", language, serverVersion, sqlMode, currentSchema);

                const editorCaption = type === EntityType.Script ? "Script" : "DB Notebook";
                newState = {
                    id: entryId,
                    caption: editorCaption,
                    type,
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    currentVersion: model.getVersionId(),
                };
                editors.push(newState);
            }

            const connectionState: IDBConnectionTabPersistentState = {
                connectionId: connection.id,
                activeEntry: entryId,
                currentSchema,
                dbType: connection.dbType,
                schemaTree: [],
                explorerState: new Map(),
                adminPageStates: {
                    lakehouseNavigatorState: {
                        autoRefreshTablesAndTasks: true,
                        activeTabId: "overview",
                    },
                },
                editors,
                scripts: this.scriptsTree,
                backend,
                serverVersion,
                serverEdition,
                sqlMode,
                heatWaveEnabled,
                mleEnabled,

                explorerWidth: -1,

                graphData: {
                    timestamp: 0,
                    activeColorScheme: "classic",
                    displayInterval: 50,
                    currentValues: new Map(),
                    computedValues: {},
                    series: new Map(),
                },

                // Chat option defaults
                chatOptionsState: {
                    chatOptionsExpanded: false,
                    chatOptionsWidth: -1,
                    options: {
                        schemaName: currentSchema !== "" ? currentSchema : undefined,
                        modelOptions: {
                            modelId: "default",
                        },
                    },
                },

                executionHistory,
                currentExecutionHistoryIndex: 0,
            };

            this.connectionState.set(tabId, connectionState);

            editorTabs.push({
                details: connection,
                tabId,
                caption: connection.caption + tabSuffix,
                suppressAbout,
            });

            if (newState) {
                this.notifyRemoteEditorOpen(connection.id, tabId, connection.dbType, language, newState);
            }
            this.hideProgress(false);
            await this.setStatePromise({ editorTabs, selectedPage: tabId, loading: false });
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Connection Error: " + message);

            const { lastSelectedPage } = this.state;
            await this.setStatePromise({ selectedPage: lastSelectedPage ?? "connections" });
            this.hideProgress(true);
        }

        return true;
    }

    /**
     * Opens an existing connection again.
     *
     * @param backend The backend for the connection.
     * @param connection The connection details.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private async reOpenConnection(backend: ShellInterfaceSqlEditor, connection: IConnectionDetails): Promise<void> {
        try {
            await backend.openConnection(connection.id, undefined, (response, requestId) => {
                if (!ShellPromptHandler.handleShellPrompt(response.result as IShellPasswordFeedbackRequest, requestId,
                    backend)) {
                    this.setProgressMessage("Loading ...");
                }
            });
            this.setProgressMessage("Connection opened");
        } /* istanbul ignore next */ catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Connection Error: " + message);

            const { lastSelectedPage } = this.state;
            this.setState({ selectedPage: lastSelectedPage ?? "connections" });
            this.hideProgress(true);

            throw reason;
        }
    }

    /**
     * Handles closing of a single tab (via its close button).
     *
     * @param e The mouse event.
     */
    private handleCloseTab = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).id;

        if (this.currentTabRef.current) {
            void this.currentTabRef.current.canClose().then((canClose) => {
                if (canClose) {
                    void this.removeTab(id);
                }
            });
        } else {
            void this.removeTab(id);
        }
    };

    /**
     * Completely removes a tab, with all its editors.
     *
     * @param tabId The ID of the tab to remove.
     *
     * @returns A promise resolving to true, when the tab removal is finished.
     */
    private async removeTab(tabId: string): Promise<boolean> {
        const { selectedPage, editorTabs } = this.state;

        // Remove all result data from the application DB.
        await ApplicationDB.removeDataByTabId(StoreType.DbEditor, tabId);

        // Remove tab info from the connection state and select another tab.
        const index = editorTabs.findIndex((info: IDBEditorTabInfo) => {
            return info.tabId === tabId;
        });

        if (index > -1) {
            // Remove the editor tab and its associated connection state, but watch out:
            // Order is important here. First remove the tab, then set the state and finally close the session.
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

            const connectionState = this.connectionState.get(tabId);
            if (connectionState) {
                this.notifyRemoteEditorClose(connectionState.connectionId);

                // Save pending changes.
                connectionState.editors.forEach((editor) => {
                    this.saveEditorIfNeeded(editor);
                    const model = editor.state?.model;
                    if (model) {
                        model.executionContexts?.dispose();
                        model.dispose();
                    }
                });

                this.connectionState.delete(tabId);
                await connectionState.backend.closeSession();
            }
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

    private handleSelectTabOrEntry = (accept: boolean, ids: Set<string>, props: IDropdownProperties): void => {
        const list = toChildArray(props.children);
        const id = [...ids][0];
        const item = list.find((entry) => {
            const candidateProps = (entry as VNode<IComponentProperties>).props as IDocumentDropdownItemProperties;

            return candidateProps.page && candidateProps.id === id;
        });

        if (item) {
            const candidateProps = (item as VNode<IComponentProperties>).props as IDocumentDropdownItemProperties;

            // For UI elements that have to show the current connection title.
            this.handleSelectTab(candidateProps.page);

            // For the content.
            this.handleSelectEntry(
                { tabId: candidateProps.page, itemId: candidateProps.id!, type: candidateProps.type });
        } else {
            // A connection tab or the overview tab.
            this.handleSelectTab(id);
        }
    };

    private addNewScript = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        if (e.target instanceof HTMLElement) {
            const rect = e.target.getBoundingClientRect();
            this.actionMenuRef.current?.open(rect, false);
        }
    };

    private addNewConsole = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();
        requisitions.executeRemote("newSession", { sessionId: -1 });
    };

    /**
     * This menu click handler is only used in the VS Code extension to offer a quick way to add new script files
     * or to open another notebook. Scripts created here are not stored in the user's script tree.
     *
     * @param e The original click event.
     * @param props The properties of the item which was clicked.
     *
     * @returns Always true (to close the menu after the click).
     */
    private handleNewScriptClick = (e: MouseEvent, props: IMenuItemProperties): boolean => {
        const { selectedPage, editorTabs } = this.state;

        const page = editorTabs.find((candidate) => {
            return candidate.tabId === selectedPage;
        });

        if (page) {
            switch (props.id) {
                case "addEditor": {
                    this.handleAddNotebook(selectedPage);

                    break;
                }

                case "addSQLScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.details.id),
                        language: page.details.dbType === DBType.MySQL ? "mysql" : "sql",
                    });

                    break;
                }

                case "addTSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.details.id),
                        language: "typescript",
                    });

                    break;
                }

                case "addJSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.details.id),
                        language: "javascript",
                    });

                    break;
                }

                default:
            }
        }

        return true;
    };

    private editorSaved = (details: { id: string, newName: string, saved: boolean; }): Promise<boolean> => {
        const { dirtyEditors } = this.state;

        if (dirtyEditors.has(details.id)) {
            if (details.saved) {
                dirtyEditors.delete(details.id);
                this.setState({ dirtyEditors });
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleCloseButtonClick = (): void => {
        const { selectedPage } = this.state;

        if (selectedPage === "connections" && this.connectionState.size === 0) {
            // Special handling for the VS Code extension. Close the webview when the user closes the overview.
            requisitions.executeRemote("closeInstance", undefined);
        }

        const connectionState = this.connectionState.get(selectedPage);
        if (connectionState) {
            void this.editorClose(
                { connectionId: connectionState.connectionId, editorId: connectionState.activeEntry });
        }
    };

    private editorClose = (details: { connectionId: number, editorId: string; }): Promise<boolean> => {
        const { editorTabs } = this.state;

        const tabId = editorTabs.find((tab) => {
            return tab.details.id === details.connectionId;
        })?.tabId;

        if (!tabId) {
            return Promise.resolve(false);
        }

        const connectionState = this.connectionState.get(tabId);
        if (connectionState) {
            // Removing an editor via the close button triggers a different behavior compared to normal close.
            // The close button is only visible when running in the VS Code extension and does not cause a default
            // editor to be created but instead triggers closing the connection (and ultimately the webview tab)
            // if the last editor (and last connection) is closed this way.
            const index = connectionState.editors.findIndex((editor: IOpenEditorState) => {
                return editor.id === details.editorId;
            });

            if (index > -1) {
                const editor = connectionState.editors[index];

                // Make sure any pending change is sent to the backend, if that editor represents a stored script.
                this.saveEditorIfNeeded(editor);

                // Select another editor.
                if (index > 0) {
                    connectionState.activeEntry = connectionState.editors[index - 1].id;
                } else {
                    if (index < connectionState.editors.length - 1) {
                        connectionState.activeEntry = connectionState.editors[index + 1].id;
                    }
                }

                connectionState.editors.splice(index, 1);

                if (connectionState.editors.length === 0) {
                    // No editor left over -> close the connection. This will also send a remote notification.
                    void this.removeTab(tabId);
                } else {
                    this.notifyRemoteEditorClose(connectionState.connectionId, editor.id);
                    this.forceUpdate();
                }

                return Promise.resolve(true);
            }
        }

        return Promise.resolve(false);
    };

    private createNewEditor = (details: INewEditorRequest): Promise<boolean> => {
        const { selectedPage } = this.state;

        // Currently this is only used to create a new notebook.
        if (details.language === "msg") {
            this.handleAddNotebook(selectedPage);
        }

        return Promise.resolve(true);
    };

    private handleSelectTab = (id: string): void => {
        if (this.currentTabRef.current) {
            void this.currentTabRef.current.canClose().then((canClose) => {
                if (canClose) {
                    this.doSwitchTab(id);
                }
            });
        } else {
            this.doSwitchTab(id);
        }
    };

    private doSwitchTab(id: string): void {
        const { selectedPage } = this.state;

        const connectionState = this.connectionState.get(selectedPage);
        if (connectionState) {
            // Save pending changes.
            connectionState.editors.forEach((editor) => {
                this.saveEditorIfNeeded(editor);
            });
        }

        this.setState({ selectedPage: id });

        if (id === "connections") {
            requisitions.executeRemote("selectConnectionTab", { connectionId: -1, page: "DB Connection Overview" });
        } else {
            const { editorTabs } = this.state;
            const tab = editorTabs.find((info) => {
                return info.tabId === id;
            });

            if (tab) {
                requisitions.executeRemote("selectConnectionTab", { connectionId: tab.details.id, page: tab.caption });
            }
        }
    }

    /**
     * This method creates a notebook and notifies the host about it.
     *
     * @param id A unique ID for the notebook.
     *
     * @returns A unique id for the new editor, if one was created.
     */
    private handleAddNotebook = (id: string): string | undefined => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const model = this.createEditorModel(connectionState.backend, "", "msg", connectionState.serverVersion,
                connectionState.sqlMode, connectionState.currentSchema);

            const editorId = uuid();
            const caption = `DB Notebook ${++this.editorCounter}`;
            const newState = {
                id: editorId,
                caption,
                type: EntityType.Notebook,
                state: {
                    model,
                    viewState: null,
                    options: defaultEditorOptions,
                },
                currentVersion: model.getVersionId(),
            };
            connectionState.editors.push(newState);

            connectionState.activeEntry = editorId;
            this.notifyRemoteEditorOpen(connectionState.connectionId, id, connectionState.dbType, "msg", newState);
            this.forceUpdate();

            return editorId;
        }
    };

    private handleLoadEditor = (id: string, editorId: string, content: string): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            const editor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === editorId;
            });

            editor?.state?.model?.setValue(content);
        }
    };

    private handleEditorSelectorChange = (accept: boolean, selectedIds: Set<string>): void => {
        const { selectedPage } = this.state;

        // Find the editor which belongs to the given id.
        const id = [...selectedIds][0];
        const connectionState = this.connectionState.get(selectedPage);
        if (connectionState) {
            const editor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === id;
            });

            if (editor && this.currentTabRef.current) {
                void this.currentTabRef.current.canClose().then((canClose) => {
                    if (canClose) {
                        this.handleSelectEntry({ tabId: selectedPage, itemId: id, type: editor.type });
                    }
                });
            }
        }
    };

    /**
     * Activates a specific editor on a connection tab or creates new tabs for special pages, like
     * admin pages or external scripts.
     *
     * @param details The details of the selected entry.
     */
    private handleSelectEntry = (details: ISelectItemDetails): void => {
        const connectionState = this.connectionState.get(details.tabId);
        if (connectionState && connectionState.activeEntry !== details.itemId) {
            // If there's a current editor, save its content, if it represents a user script.
            const currentEditor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === connectionState.activeEntry;
            });

            if (currentEditor) {
                this.saveEditorIfNeeded(currentEditor);
            }

            let updateCurrentEntry = true;

            // Check if we have an open editor with the new id (administration pages like server status count here too).
            const newEditor = connectionState.editors.find((candidate: IOpenEditorState) => {
                return candidate.id === details.itemId;
            });

            let editorId: string;
            if (newEditor) {
                editorId = newEditor.id;
            } else {
                // If no open editor exists, try to find a script with that id and open that.
                const script = connectionState.scripts.find((candidate: IDBDataEntry) => {
                    return candidate.id === details.itemId;
                }) as IDBEditorScriptState;

                if (script) {
                    editorId = script.id;

                    if (script.dbDataId) {
                        // Defer the current entry update to the moment when script data has been loaded.
                        updateCurrentEntry = false;
                        ShellInterface.modules.getDataContent(script.dbDataId).then((content) => {
                            if (content !== undefined) {
                                this.addEditorFromScript(details.tabId, connectionState, script, content);
                                connectionState.activeEntry = details.itemId;
                                this.forceUpdate();
                            }
                        }).catch((reason) => {
                            const message = reason instanceof Error ? reason.message : String(reason);
                            void requisitions.execute("showError", "Cannot load scripts content: " + message);
                        });
                    } else {
                        // No script either? Create a new one.
                        this.addEditorFromScript(details.tabId, connectionState, script, "");
                    }
                } else {
                    editorId = details.itemId;

                    // Must be an administration page or an external script then.
                    if (details.type === EntityType.Script) {
                        // External scripts come with their full content.
                        if (details.content !== undefined) {
                            // External scripts come with their full content.
                            const script: IDBEditorScriptState = {
                                id: details.itemId,
                                caption: details.caption ?? "Script",
                                language: details.language ?? "mysql",
                                dbDataId: -1,
                                folderId: -1,
                                type: EntityType.Script,
                            };
                            this.addEditorFromScript(details.tabId, connectionState, script, details.content);
                        }
                    } else {
                        let caption = details.caption;
                        if (!caption) {
                            switch (details.type) {
                                case EntityType.Status: {
                                    caption = "Server Status";
                                    break;
                                }

                                case EntityType.Connections: {
                                    caption = "Client Connections";
                                    break;
                                }

                                case EntityType.Dashboard: {
                                    caption = "Performance Dashboard";
                                    break;
                                }

                                case EntityType.LakehouseNavigator: {
                                    caption = "Lakehouse Navigator";
                                    break;
                                }

                                default:
                            }
                        }

                        const newState = {
                            id: details.itemId,
                            caption: caption ?? "Unknown",
                            type: details.type,
                            currentVersion: 0,
                        };

                        connectionState.editors.push(newState);
                        this.notifyRemoteEditorOpen(connectionState.connectionId, details.tabId,
                            connectionState.dbType, details.language ?? "mysql",
                            newState);
                    }
                }
            }

            if (updateCurrentEntry) {
                connectionState.activeEntry = details.itemId;
                requisitions.executeRemote("editorSelect", { connectionId: connectionState.connectionId, editorId });

                this.forceUpdate();
            }
        } else if (connectionState) {
            // Even if the active page does not change, we have to notify the remote side.
            // Otherwise there's no notification when the user switches between multiple tabs.
            requisitions.executeRemote("editorSelect",
                { connectionId: connectionState.connectionId, editorId: details.itemId });
        }
    };

    /**
     * Helper method to create a new editor entry from a script entry.
     *
     * @param tabId The id of the connection tab.
     * @param state The connection state, which receives the new editor.
     * @param script The script from which we create the editor.
     * @param content The script's content.
     */
    private addEditorFromScript(tabId: string, state: IDBConnectionTabPersistentState, script: IDBEditorScriptState,
        content: string): void {
        const model = this.createEditorModel(state.backend, content, script.language, state.serverVersion,
            state.sqlMode, state.currentSchema);

        const newState = {
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
        };
        state.editors.push(newState);
        this.notifyRemoteEditorOpen(state.connectionId, tabId, state.dbType, script.language, newState);
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

                let wasSaved = false;
                if (editor.dbDataId > -1) {
                    // Represents a DB data entry.
                    void ShellInterface.modules.updateData(editor.dbDataId, undefined, content);
                    wasSaved = true;
                }

                if (wasSaved) {
                    // Remove the editor also from the dirty editors list, to disable the save button.
                    const { dirtyEditors } = this.state;

                    if (dirtyEditors.delete(editor.id)) {
                        this.setState({ dirtyEditors });
                    }
                }
            }
        }
    }

    private handleEditorChange = (id: string, editorId: string): void => {
        const { dirtyEditors } = this.state;

        if (!dirtyEditors.has(editorId)) {
            dirtyEditors.add(editorId);
            this.setState({ dirtyEditors });
        }
    };

    private handleExplorerResize = (id: string, size: number): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.explorerWidth = size;
        }
    };

    private handleGraphDataChange = (id: string, data: ISavedGraphData) => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.graphData = data;
        }

        this.forceUpdate();
    };

    private onChatOptionsChange = (id: string, data: Partial<IChatOptionsState>): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.chatOptionsState = {
                ...connectionState.chatOptionsState,
                ...data,
            };
        }

        this.forceUpdate();
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
        const model: ICodeEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.DbEditor,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                runUpdates: this.sendSqlUpdatesFromModel.bind(this, backend),
            }),
            symbols: new DynamicSymbolTable(backend, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Standard,
        });

        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

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
            connectionState.explorerState = new Map([...connectionState.explorerState, ...state]);
        }
        this.forceUpdate();
    };

    private handleAdminLakehouseNavigatorState = (
        id: string, data: Partial<ILakehouseNavigatorSavedState>): void => {
        const connectionState = this.connectionState.get(id);
        if (connectionState) {
            connectionState.adminPageStates.lakehouseNavigatorState = {
                ...connectionState.adminPageStates.lakehouseNavigatorState,
                ...data,
            };
        }
    };

    private notifyRemoteEditorOpen(connectionId: number, tabId: string, dbType: DBType, language: EditorLanguage,
        state: IOpenEditorState) {
        const { editorTabs } = this.state;
        const tab = editorTabs.find((info) => {
            return info.tabId === tabId;
        });

        requisitions.executeRemote("editorsChanged", {
            opened: true,
            connectionId,
            connectionCaption: tab?.caption ?? "Unknown",
            dbType,
            editorId: state.id,
            editorCaption: state.caption,
            language,
            editorType: state.type,
        });
    }

    /**
     * Sends a notification to outer host (if any) that an editor has been closed.
     *
     * @param connectionId The id of the connection.
     * @param editorId The id of the editor to close. If not specified, all editors of the connection will be closed.
     */
    private notifyRemoteEditorClose(connectionId: number, editorId?: string) {
        requisitions.executeRemote("editorsChanged", {
            opened: false,
            connectionId,
            editorId,
        });
    }
}
