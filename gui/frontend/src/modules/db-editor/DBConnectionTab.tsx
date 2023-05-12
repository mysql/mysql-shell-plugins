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

import "./assets/DBEditor.css";

import { ComponentChild, createRef } from "preact";
import ts, { ScriptTarget } from "typescript";
import { clearIntervalAsync, setIntervalAsync, SetIntervalAsyncTimer } from "set-interval-async/dynamic";

import { Explorer, IExplorerSectionState } from "./Explorer";
import { IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { formatBase64ToHex, formatTime, formatWithNumber } from "../../utilities/string-helpers";
import { Notebook } from "./Notebook";
import {
    IEntityBase, EntityType, ISchemaTreeEntry, IDBDataEntry, SchemaTreeType, IToolbarItems, ISavedGraphData,
} from ".";
import { ScriptEditor } from "./ScriptEditor";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor";
import { appParameters, requisitions } from "../../supplement/Requisitions";
import { IConsoleWorkerResultData, ScriptingApi } from "./console.worker-types";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool";
import { ScriptingLanguageServices } from "../../script-execution/ScriptingLanguageServices";
import { QueryType } from "../../parsing/parser-common";
import {
    DBDataType, IColumnInfo, IDictionary, IExecutionInfo, IServicePasswordRequest, MessageType,
} from "../../app-logic/Types";
import { Settings } from "../../supplement/Settings/Settings";
import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB";
import {
    convertRows, EditorLanguage, generateColumnInfo, IRunQueryRequest, ISqlPageRequest, IScriptRequest,
} from "../../supplement";
import { ServerStatus } from "./ServerStatus";
import { ClientConnections } from "./ClientConnections";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { saveTextAsFile, selectFile, uuid } from "../../utilities/helpers";
import { IDbEditorResultSetData } from "../../communication/ProtocolGui";
import { ResponseError } from "../../communication/ResponseError";
import { IComponentProperties, IComponentState, ComponentBase } from "../../components/ui/Component/ComponentBase";
import { SplitContainer, ISplitterPaneSizeInfo } from "../../components/ui/SplitContainer/SplitContainer";
import { DBType } from "../../supplement/ShellInterface";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import {
    currentNotebookVersion, IExecutionResult, INotebookFileFormat, IResponseDataOptions, ITextResultEntry,
} from "../../script-execution";
import { ExecutionContext } from "../../script-execution/ExecutionContext";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext";
import { IMrsLoginResult } from "../mrs/sdk/MrsBaseClasses";
import { IMrsAuthRequestPayload } from "../mrs/types";

interface IResultTimer {
    timer: SetIntervalAsyncTimer<unknown[]>;
    results: Array<[IExecutionResult, IResponseDataOptions]>;
}

/**
 * Just the minimal information about existing editors.
 */
export interface ISavedEditorState {
    connectionId: number;
    editors: IOpenEditorState[];
    activeEntry: string;
    heatWaveEnabled: boolean;
}

export interface IOpenEditorState extends IEntityBase {
    state?: IEditorPersistentState;

    /** A copy of the script state data id, if this editor was created from a script. */
    dbDataId?: number;

    /** The version number of the editor model when we last saved it (for entries that are actually saved). */
    currentVersion: number;
}

export interface IDBConnectionTabPersistentState extends ISavedEditorState {
    backend: ShellInterfaceSqlEditor;

    // Informations about the connected backend (where supported).
    serverVersion: number;
    serverEdition: string;
    sqlMode: string;

    dbType: DBType;

    scripts: IDBDataEntry[];
    schemaTree: ISchemaTreeEntry[];
    explorerState: Map<string, IExplorerSectionState>;

    currentSchema: string;

    // The size to be used for the explorer pane.
    explorerWidth: number;

    /** Cached data/settings for the performance dashboard. */
    graphData: ISavedGraphData;
}

/** Selecting an item requires different data, depending on the type of the item. */
export interface ISelectItemDetails {
    /** The item's unique id. */
    itemId: string,

    /** The id of this connection tab. */
    tabId: string,

    /** The type of the item. */
    type: EntityType,

    /** For external/broken out scripts only: their language. */
    language?: EditorLanguage,

    /** For external/broken out scripts only: the script's name. */
    caption?: string,

    /** For external/broken out scripts only: the script's content. */
    content?: string;
}

interface IDBConnectionTabProperties extends IComponentProperties {
    /** The caption of this page used in the hosting tabview. */
    caption?: string;

    connectionId: number;
    dbType: DBType;
    savedState: IDBConnectionTabPersistentState;
    workerPool: ExecutionWorkerPool;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;

    showExplorer?: boolean; // If false, collapse the explorer split pane.
    showAbout: boolean;

    /** Extra libraries for the code editor that don't change. */
    extraLibs?: Array<{ code: string, path: string; }>;

    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;

    onAddEditor?: (id: string) => string | undefined;
    onRemoveEditor?: (id: string, editorId: string) => void;
    onSelectItem?: (details: ISelectItemDetails) => void;
    onEditorRename?: (id: string, editorId: string, newCaption: string) => void;

    // Sent when the content of a standalone editor changed (typing, pasting, undo/redo etc.).
    onEditorChange?: (id: string, editorId: string) => void;

    onAddScript?: (id: string, language: EditorLanguage, dbType: DBType) => void;

    onSaveSchemaTree?: (id: string, schemaTree: ISchemaTreeEntry[]) => void;
    onSaveExplorerState?: (id: string, state: Map<string, IExplorerSectionState>) => void;

    onGraphDataChange?: (id: string, data: ISavedGraphData) => void;

    onExplorerResize?: (id: string, size: number) => void;
    onExplorerMenuAction?: (id: string, itemId: string, params: unknown) => void;
}

interface IDBConnectionTabState extends IComponentState {
    errorMessage?: string;

    backend?: ShellInterfaceSqlEditor;

    // Set to true if a notebook has been loaded the app is embedded, emulating so a one editor-only mode.
    standaloneMode: boolean;
}

/** A list of parameters/options used for query execution. */
interface IQueryExecutionOptions {
    /** The backend for execution. */
    backend: ShellInterfaceSqlEditor;

    /** The context to send result to. */
    context: SQLExecutionContext;

    /** The query to execute. */
    queryType: QueryType,

    /** The original query sent by the caller (does not include an auto LIMIT clause). */
    original: string;

    /** The query to execute. */
    query: string;

    /** Parameters for the query. */
    params: string[];

    /** The index of the query being executed. */
    index: number;

    /** True if the executed query was amended with a LIMIT clause for paging. */
    explicitPaging: boolean;

    /** The current result set page that is shown. */
    currentPage: number;

    /** If given, the results of this request replace an existing result set. */
    oldResultId?: string;

    /** Render SQL results as plain text instead of interactive tables. */
    showAsText: boolean;
}

/** Metadata for the MRS SDK of the current MRS Service. */
interface IMrsServiceSdkMetadata {
    baseClasses?: string,
    code?: string,
    codeLineCount?: number;
    typeDefinitions?: string,
    schemaId?: string,
    schemaMetadataVersion?: string,
}

// A tab page for a single connection (managed by the scripting module).
export class DBConnectionTab extends ComponentBase<IDBConnectionTabProperties, IDBConnectionTabState> {
    private static aboutMessage = `Welcome to the MySQL Shell - DB Notebook.

Press %modifier%+Enter to execute the current statement.

Execute \\sql to switch to SQL, \\js to JavaScript and \\ts to TypeScript mode.
Execute \\help or \\? for help;`;

    // Currently executing contexts.
    private runningContexts = new Map<string, ExecutionContext>();

    // Timers to serialize asynchronously incoming results.
    private resultTimers = new Map<string, IResultTimer>();

    private notebookRef = createRef<Notebook>();
    private scriptRef = createRef<ScriptEditor>();

    private scriptWaiting = false;

    // True while restoring a notebook from a notebook file.
    private loadingNotebook = false;

    private cachedMrsServiceSdk: IMrsServiceSdkMetadata = {};
    private mrsLoginResult?: IMrsLoginResult;

    public constructor(props: IDBConnectionTabProperties) {
        super(props);

        this.state = {
            backend: props.savedState.backend,
            standaloneMode: false,
        };

        this.addHandledProperties("connectionId", "dbType", "savedState", "workerPool", "toolbarInset", "showExplorer",
            "showAbout", "extraLibs",
            "onHelpCommand", "onAddEditor", "onRemoveEditor", "onSelectEditor", "onChangeEditor", "onAddScript",
            "onSaveSchemaTree", "onSaveExplorerState", "onExplorerResize", "onExplorerMenuAction");

    }

    public componentDidMount(): void {
        requisitions.register("editorStopExecution", this.editorStopExecution);
        requisitions.register("editorCommit", this.editorCommit);
        requisitions.register("editorRollback", this.editorRollback);
        requisitions.register("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.register("editorRunQuery", this.editorRunQuery);
        requisitions.register("editorRunScript", this.editorRunScript);
        requisitions.register("editorInsertUserScript", this.editorInsertUserScript);
        requisitions.register("showPageSection", this.showPageSection);
        requisitions.register("editorEditScript", this.editorEditScript);
        requisitions.register("editorRenameScript", this.editorRenameScript);
        requisitions.register("acceptMrsAuthentication", this.acceptMrsAuthentication);
        requisitions.register("cancelMrsAuthentication", this.cancelMrsAuthentication);
        requisitions.register("refreshMrsServiceSdk", this.updateMrsServiceSdkCache);
        requisitions.register("editorSaveNotebook", this.editorSaveNotebook);
        requisitions.register("editorLoadNotebook", this.editorLoadNotebook);

        this.notebookRef.current?.focus();

        // Update the cachedMrsServiceSdk for the first time
        void this.updateMrsServiceSdkCache();
    }

    public componentWillUnmount(): void {
        this.resultTimers.forEach((resultTimer) => {
            void clearIntervalAsync(resultTimer.timer);
        });
        this.resultTimers.clear();

        requisitions.unregister("editorStopExecution", this.editorStopExecution);
        requisitions.unregister("editorCommit", this.editorCommit);
        requisitions.unregister("editorRollback", this.editorRollback);
        requisitions.unregister("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.unregister("editorRunQuery", this.editorRunQuery);
        requisitions.unregister("editorRunScript", this.editorRunScript);
        requisitions.unregister("editorInsertUserScript", this.editorInsertUserScript);
        requisitions.unregister("showPageSection", this.showPageSection);
        requisitions.unregister("editorEditScript", this.editorEditScript);
        requisitions.unregister("editorRenameScript", this.editorRenameScript);
        requisitions.unregister("acceptMrsAuthentication", this.acceptMrsAuthentication);
        requisitions.unregister("cancelMrsAuthentication", this.cancelMrsAuthentication);
        requisitions.unregister("refreshMrsServiceSdk", this.updateMrsServiceSdkCache);
        requisitions.unregister("editorSaveNotebook", this.editorSaveNotebook);
        requisitions.unregister("editorLoadNotebook", this.editorLoadNotebook);
    }

    public componentDidUpdate(prevProps: IDBConnectionTabProperties): void {
        const { connectionId, savedState } = this.props;

        if (connectionId !== prevProps.connectionId) {
            this.setState({
                backend: savedState.backend,
            });
        }
    }

    public render(): ComponentChild {
        const {
            toolbarItems, id, savedState, dbType, showExplorer = true, onHelpCommand, showAbout, extraLibs,
        } = this.props;
        const { backend, standaloneMode } = this.state;

        const className = this.getEffectiveClassNames(["connectionTabHost"]);

        let document;
        const activeEditor = this.findActiveEditor();
        if (activeEditor) {
            switch (activeEditor.type) {
                case EntityType.Notebook: {
                    this.scriptRef.current = null;
                    document = <Notebook
                        ref={this.notebookRef}
                        savedState={savedState}
                        backend={backend}
                        toolbarItems={toolbarItems}
                        standaloneMode={standaloneMode}
                        dbType={dbType}
                        extraLibs={extraLibs}
                        showAbout={showAbout && !this.loadingNotebook}
                        onHelpCommand={onHelpCommand}
                        onScriptExecution={this.handleExecution}
                    />;
                    break;
                }

                case EntityType.Script: {
                    this.notebookRef.current = null;
                    document = <ScriptEditor
                        id={savedState.activeEntry}
                        ref={this.scriptRef}
                        extraLibs={extraLibs}
                        savedState={savedState}
                        toolbarItems={toolbarItems}
                        standaloneMode={standaloneMode}
                        onScriptExecution={this.handleExecution}
                        onEdit={this.handleEdit}
                    />;

                    break;
                }

                case EntityType.Status: {
                    document = <ServerStatus backend={savedState.backend} toolbarItems={toolbarItems} />;

                    break;
                }

                case EntityType.Connections: {
                    document = <ClientConnections backend={savedState.backend} toolbarItems={toolbarItems} />;

                    break;
                }

                case EntityType.Dashboard: {
                    document = <PerformanceDashboard
                        backend={savedState.backend}
                        toolbarItems={toolbarItems}
                        graphData={savedState.graphData}
                        onGraphDataChange={this.handleGraphDataChange}
                    //stopAfter={10}
                    />;

                    break;
                }

                default:
            }
        }

        return (
            <SplitContainer
                className={className}
                panes={
                    [
                        {
                            id: "explorer",
                            minSize: 150,
                            initialSize: savedState.explorerWidth > -1 ? savedState.explorerWidth : 250,
                            snap: true,
                            resizable: true,
                            collapsed: !showExplorer,
                            content: (
                                <Explorer
                                    id={id}
                                    dbType={dbType}
                                    schemaTree={savedState.schemaTree}
                                    savedState={savedState.explorerState}
                                    editors={savedState.editors}
                                    scripts={savedState.scripts}
                                    selectedEntry={savedState.activeEntry}
                                    markedSchema={savedState.currentSchema}
                                    backend={savedState.backend}
                                    onSelectItem={this.handleSelectItem}
                                    onCloseItem={this.handleCloseEditor}
                                    onAddItem={this.handleAddEditor}
                                    onChangeItem={this.handleEditorRename}
                                    onAddScript={this.handleAddScript}
                                    onSaveSchemaTree={this.saveSchemaTree}
                                    onSaveExplorerState={this.saveExplorerState}
                                    onContextMenuItemClick={this.handleExplorerMenuAction}
                                />),
                        },
                        {
                            id: "content",
                            minSize: 350,
                            snap: false,
                            stretch: true,
                            content: document,
                        },
                    ]}
                onPaneResized={this.handlePaneResize}
            />
        );
    }

    private editorStopExecution = async (): Promise<boolean> => {
        const { backend } = this.state;

        if (backend) {
            // Only one query can run in a DB editor at a given time (single connection), so we stop here
            // whatever is running currently.
            await backend.killQuery();

            return true;
        }

        return false;
    };

    private editorCommit = async (): Promise<boolean> => {
        const { backend } = this.state;

        if (!backend) {
            return false;
        }

        try {
            await backend.execute("commit");
            await requisitions.execute("sqlTransactionChanged", undefined);

            // TODO: give a visual feedback (e.g. message toast) for the execution.
        } catch (reason) {
            await requisitions.execute("showError", ["Execution Error", String(reason)]);
        }

        return true;
    };

    private editorRollback = async (): Promise<boolean> => {
        const { backend } = this.state;

        if (!backend) {
            return false;
        }

        await backend.execute("rollback");
        await requisitions.execute("sqlTransactionChanged", undefined);

        // TODO: give a visual feedback (e.g. message toast) for the execution.

        return true;
    };

    private sqlShowDataAtPage = async (data: ISqlPageRequest): Promise<boolean> => {
        const pageSize = Settings.get("sql.limitRowCount", 1000);
        await this.executeQuery(data.context as SQLExecutionContext, 0, data.page, pageSize,
            { source: data.sql }, data.oldResultId);

        return true;
    };

    /**
     * Runs the given query in the active notebook. If no notebook is active, make one active.
     *
     * @param details The details about the query to run.
     *
     * @returns A promise that resolves to true if the query was run, false if the request could not be fulfilled,
     *          because a notebook must be created first.
     */
    private editorRunQuery = (details: IRunQueryRequest): Promise<boolean> => {
        if (this.notebookRef.current) {
            this.notebookRef.current.executeQuery(
                { source: details.query, params: details.parameters }, details.linkId);

            return Promise.resolve(true);
        } else {
            // Either we don't have an editor at all or the active editor is a script.
            // In both cases, we need to activate or create a notebook first.

            // Check first if we have a notebook in our editor list.
            const { savedState } = this.props;
            const notebook = savedState.editors.find((e) => {
                return e.type === EntityType.Notebook;
            });

            if (notebook) {
                // We have a notebook, so just activate it.
                this.handleSelectItem(notebook.id, notebook.type);
            } else {
                // Otherwise, create a new notebook.
                this.handleAddEditor();
            }

            // Return false to indicate that the request could not be fulfilled.
            // The requisition pipeline will then try again in a moment.
            return Promise.resolve(false);
        }
    };

    /**
     * Runs the given query in the active script editor. If no script editor is active, make one active.
     *
     * @param details The details about the query to run.
     *
     * @returns A promise that resolves to true if the query was run, false if the request could not be fulfilled,
     *          because a script editor must be created first.
     */
    private editorRunScript = async (details: IScriptRequest): Promise<boolean> => {
        if (!this.scriptWaiting) {
            this.scriptWaiting = true;
            await this.editorEditScript(details); // Doesn't really wait for the document to be created.

            return false;
        }

        if (this.scriptRef.current) {
            this.scriptWaiting = false;

            // Returns true when the script content validation was finished and the editor triggered the
            // actual execution.
            return this.scriptRef.current.executeScript(details.content, details.forceSecondaryEngine);
        }

        return false;
    };

    private editorInsertUserScript = async (data: {
        language: EditorLanguage;
        resourceId: number;
    }): Promise<boolean> => {
        try {
            const content = await ShellInterface.modules.getDataContent(data.resourceId);
            if (this.notebookRef.current) {
                this.notebookRef.current.insertScriptText(data.language, content);
            } else if (this.scriptRef.current) {
                this.scriptRef.current.insertScriptText(data.language, content);
            }
        } catch (reason) {
            await requisitions.execute("showError",
                ["Loading Error", "Cannot load scripts content:", String(reason)]);

            return false;
        }


        return true;
    };

    private showPageSection = (details: { id: string, type: EntityType; }): Promise<boolean> => {
        this.handleSelectItem(details.id, details.type);

        return Promise.resolve(true);
    };

    private editorEditScript = (details: IScriptRequest): Promise<boolean> => {
        const { id, onSelectItem } = this.props;

        onSelectItem?.({
            tabId: id ?? "",
            itemId: details.scriptId,
            type: EntityType.Script,
            language: details.language,
            caption: details.name,
            content: details.content,
        });

        return Promise.resolve(true);
    };

    private editorRenameScript = (details: IScriptRequest): Promise<boolean> => {
        const { id, onEditorRename } = this.props;

        onEditorRename?.(id ?? "", details.scriptId, details.name ?? "<untitled>");

        return Promise.resolve(true);
    };

    private addContextResultMessage = (contextId: string, message: string) => {
        const context = this.runningContexts.get(contextId);

        if (context) {
            void context.addResultData({
                type: "text",
                text: [{
                    type: MessageType.Info,
                    content: message,
                }],
            }, { resultId: "" });
        }
    };

    private cancelMrsAuthentication = (request: IServicePasswordRequest): Promise<boolean> => {
        this.notebookRef.current?.focus();

        // Clear mrsLoginResult
        this.mrsLoginResult = undefined;

        // Get payload
        const payload: IMrsAuthRequestPayload = request.payload as IMrsAuthRequestPayload;
        if (payload?.contextId) {
            this.addContextResultMessage(payload.contextId, `\nAuthentication cancelled.`);

            return Promise.resolve(true);
        } else {
            return Promise.resolve(false);
        }
    };

    private acceptMrsAuthentication = (
        data: { request: IServicePasswordRequest; password: string; }): Promise<boolean> => {

        this.notebookRef.current?.focus();

        try {
            // Get payload
            const payload: IMrsAuthRequestPayload = data.request.payload as IMrsAuthRequestPayload;

            if (data.request.service && payload.loginResult) {
                // Set mrsLoginResult so it can be appended to each following execution context
                this.mrsLoginResult = payload.loginResult;

                if (payload.contextId && data.request.user) {
                    this.addContextResultMessage(payload.contextId,
                        `\nUser '${data.request.user}' logged in successfully.`);

                    return Promise.resolve(true);
                }
            } else {
                if (payload.contextId) {
                    this.addContextResultMessage(payload.contextId, `\nAuthentication cancelled.`);
                }
            }
        } catch (reason) {
            void requisitions.execute("showError", ["Accept Password Error", String(reason)]);
        }

        return Promise.resolve(false);
    };

    /**
     * Either takes the given content and creates a new notebook with it, or asks the user to select a notebook
     * file to create the notebook from.
     *
     * @param details The details about the notebook to load.
     * @param details.content The content to load into the notebook. If undefined, the user will be asked to select
     *                        a file.
     * @param details.standalone If true, the notebook will be loaded in standalone mode, otherwise like any other
     *                           editor.
     *
     * @returns A promise that resolves to true if the notebook was loaded, false if the request could not be fulfilled.
     */
    private editorLoadNotebook = async (details?: { content: string; standalone: boolean; }): Promise<boolean> => {

        /**
         * Helper method to actually create the notebook from the given text.
         *
         * @param text The content to load into the notebook.
         */
        const createNotebook = async (text: string): Promise<void> => {
            let content: INotebookFileFormat;
            if (text.length === 0) {
                content = {
                    type: "MySQLNotebook",
                    version: currentNotebookVersion,
                    caption: "Untitled",
                    content: "",
                    options: {},
                    viewState: null,
                    contexts: [],
                };
            } else {
                try {
                    content = JSON.parse(text);
                } catch (reason) {
                    await requisitions.execute("showError", ["The notebook file is not valid JSON."]);

                    return;
                }
            }

            if (content.type !== "MySQLNotebook") {
                void requisitions.execute("showError", ["Invalid notebook content"]);
            } else {
                try {
                    this.loadingNotebook = true;

                    const editorId = this.handleAddEditor();
                    if (editorId) {
                        // Adding a new notebook will always make it the active editor.
                        const openState = this.findActiveEditor();
                        const persistentState: IEditorPersistentState | undefined = openState?.state;
                        if (persistentState) {
                            const { id } = this.props;
                            openState!.caption = content.caption;
                            persistentState.model.setValue(content.content);
                            persistentState.options = content.options;

                            // Restore the result data in the application DB.
                            const transaction = ApplicationDB.db.transaction(StoreType.DbEditor, "readwrite");
                            const objectStore = transaction.objectStore(StoreType.DbEditor);
                            for (const context of content.contexts) {
                                // Create new result IDs for the data, to avoid multiple result views pointing to the
                                // same data, for example when the same notebook is loaded twice.
                                const idMap = new Map<string, string>();
                                const result = context.state.result;
                                if (result?.type === "resultIds") {
                                    result.list.forEach((resultId, index, list) => {
                                        const newId = uuid();
                                        idMap.set(resultId, newId);
                                        list[index] = newId;
                                    });

                                    for (const data of context.data ?? []) {
                                        data.resultId = idMap.get(data.resultId) ?? "";

                                        // Also replace the tab ID in the result data.
                                        data.tabId = id!;
                                        await objectStore.add(data);
                                    }
                                }
                            }

                            setTimeout(() => {
                                this.notebookRef.current?.restoreNotebook(content);
                                this.loadingNotebook = false;
                            }, 10);
                        }
                    }

                    if (appParameters.embedded) {
                        this.setState({ standaloneMode: details?.standalone ?? false });
                    }
                } catch (e) {
                    this.loadingNotebook = false;
                    void requisitions.execute("showError", ["Error while loading notebook", String(e)]);
                }
            }
        };

        if (details === undefined) {
            // Ask the user to select a file.
            if (appParameters.embedded) {
                return requisitions.executeRemote("editorLoadNotebook", undefined);
            }

            const selection = await selectFile([".mysql-notebook"], false);
            if (selection) {
                const file = selection[0];
                const reader = new FileReader();
                reader.onload = (): void => {
                    if (typeof reader.result === "string") {
                        try {
                            void createNotebook(reader.result);
                        } catch (e) {
                            if (e instanceof Error) {
                                const message = e.toString() || "";
                                alert(`Error while parsing JSON data: \n${message}`);
                            }
                        }
                    } else {
                        void requisitions.execute("showError", ["Cannot read notebook file"]);
                    }
                };

                reader.readAsText(file, "utf-8");
            }
        } else {
            await createNotebook(details.content);
        }

        return Promise.resolve(true);
    };

    /**
     * Serializes the current notebook to a JSON string and triggers save-to-file handling.
     * This can either be handled by the browser (not allowing to specify a target path) or by the host application
     * which has more freedom to allow the user to select a target path.
     *
     * @returns A promise that resolves to true if the notebook was saved, false if the request could not be fulfilled.
     *
     */
    private editorSaveNotebook = async (): Promise<boolean> => {
        const openState = this.findActiveEditor();

        if (openState) {
            const persistentState: IEditorPersistentState | undefined = openState.state;
            if (persistentState) {
                const content: INotebookFileFormat = {
                    type: "MySQLNotebook",
                    version: currentNotebookVersion,
                    caption: openState.caption,
                    content: persistentState.model.getValue(),
                    options: persistentState.options,
                    viewState: this.notebookRef.current?.getViewState() ?? null,
                    contexts: await persistentState.model.executionContexts.collectRawState(),
                };

                const text = JSON.stringify(content, (key: string, value: unknown) => {
                    if (key === "diagnosticDecorationIDs") {
                        return undefined;
                    }

                    return value;
                }, 4);

                if (appParameters.embedded) {
                    requisitions.executeRemote("editorSaveNotebook", text);
                } else {
                    // TODO: make the file name configurable.
                    const { caption } = this.props;
                    saveTextAsFile(text, `${caption ?? "<unnamed>"} - ${openState.caption}.mysql-notebook`);
                }
            }
        }

        return Promise.resolve(true);
    };

    /**
     * Called for SQL code from a code editor. All result sets start at 0 offset in this scenario.
     *
     * @param context The context with the code to execute.
     * @param options Content and details for script execution.
     */
    private runSQLCode = async (context: SQLExecutionContext, options: IScriptExecutionOptions): Promise<void> => {
        const pageSize = Settings.get("sql.limitRowCount", 1000);

        context.clearResult();
        if (options.source) {
            if (typeof options.source !== "string") {
                options.source = context.getStatementAtPosition(options.source)?.text;
            }

            if (options.source) {
                await this.executeQuery(context, 0, 0, pageSize, options);
            }
        } else {
            const statements = context.statements;
            while (true) {
                // Allow toggling the stop-on-error during execution.
                const stopOnErrors = Settings.get("editor.stopOnErrors", true);
                const statement = statements.shift();
                if (!statement) {
                    break;
                }

                try {
                    await this.executeQuery(context, statement.index, 0, pageSize,
                        { ...options, source: statement.text });
                } catch (e) {
                    if (stopOnErrors) {
                        break;
                    } // Else ignore the error and continue.
                }
            }
        }
    };

    /**
     * Executes a single query. The query is amended with a LIMIT clause, if the given count is > 0 (the page size)
     * and no other top level LIMIT clause already exists.
     *
     * @param context The context to send results to.
     * @param index The index of the query being executed.
     * @param page The page number for the LIMIT clause.
     * @param pageSize The size of a page.
     * @param options Content and details for script execution.
     * @param oldResultId An optional ID which points to an existing result set. If given, this ID is used,
     *                    to replace that old result set with the new data. Otherwise a new result set is generated.
     *
     * @returns A promise which resolves when the query execution is finished.
     */
    private executeQuery = async (context: SQLExecutionContext, index: number, page: number, pageSize: number,
        options: IScriptExecutionOptions, oldResultId?: string): Promise<void> => {

        const sql = options.source as string;
        if (sql.trim().length === 0) {
            return;
        }

        const { backend } = this.state;

        if (backend) {
            // Extract embedded parameters.
            const services = ScriptingLanguageServices.instance;
            const queryType = await services.determineQueryType(context, sql);

            const actualParams: string[] = [];

            if (queryType === QueryType.Select && options.params) {
                const embeddedParams = await services.extractQueryParameters(sql, context.dbVersion, context.sqlMode);

                // Create a list of parameter values (order is important) out from embedded parameters.
                // Passed-in parameters can override embedded ones.
                embeddedParams.forEach((param) => {
                    const externalParam = options.params!.find((candidate) => {
                        return candidate[0] === param[0];
                    });

                    if (externalParam) {
                        actualParams.push(externalParam[1]);
                    } else {
                        actualParams.push(param[1]);
                    }
                });
            }

            if (queryType === QueryType.Select && (pageSize > 0 || options.forceSecondaryEngine)) {
                // Add a top-level LIMIT clause if paging is enabled and no such LIMIT clause
                // exists already...
                // plus one row - this way we can determine if another page exists after this one.
                const offset = page * pageSize;
                const [query, changed] = await services.preprocessStatement(context, sql, offset, pageSize + 1,
                    options.forceSecondaryEngine);
                await this.doExecution({
                    backend,
                    query,
                    original: sql,
                    queryType,
                    params: actualParams,
                    context,
                    index,
                    explicitPaging: changed,
                    currentPage: page,
                    oldResultId,
                    showAsText: options.asText ?? false,
                });
            } else {
                await this.doExecution({
                    backend,
                    query: sql,
                    original: sql,
                    queryType,
                    params: actualParams,
                    context,
                    index,
                    explicitPaging: false,
                    currentPage: page,
                    oldResultId,
                    showAsText: options.asText ?? false,
                });
            }
        }
    };

    /**
     * Implements the actual query execution and the result handling.
     *
     * @param options Details for execution.
     *
     * @returns A promise that resolves when all responses have been received.
     */
    private doExecution = async (options: IQueryExecutionOptions): Promise<void> => {

        const { id = "" } = this.props;

        let resultId = uuid();
        let replaceData = false;
        try {
            // Prepare the execution (storage, UI).
            if (options.oldResultId) {
                resultId = options.oldResultId;
                replaceData = true;

                // We are going to replace result data, instead of adding a complete new set.
                // In this case remove the old data first from the storage.
                if (resultId) {
                    void ApplicationDB.removeDataByResultIds(StoreType.DbEditor, [resultId]);
                }
            }

            // Have to keep the column definition around for all data packages, for row conversion,
            // but must store it only once (when they come in, which happens only once).
            let columns: IColumnInfo[] = [];
            let setColumns = false;

            options.context.executionStarts();
            const finalData = await options.backend.execute(options.query, options.params, undefined, (data) => {
                const { dbType } = this.props;

                let hasMoreRows = false;
                let rowCount = 0;
                let status: IExecutionInfo = { text: "" };
                let resultSummary = false;

                if (data.result.totalRowCount !== undefined) {
                    resultSummary = true;

                    rowCount = data.result.totalRowCount;

                    if (options.explicitPaging) {
                        // We added 1 to the total count for the LIMIT clause to allow determining if
                        // more pages are available. That's why we have to decrement the row count for display.
                        const pageSize = Settings.get("sql.limitRowCount", 1000);
                        if (pageSize < rowCount) {
                            --rowCount;
                            data.result.rows?.pop();

                            hasMoreRows = true;
                        }
                    }

                    status = {
                        text: `OK, ${formatWithNumber("record", rowCount)} retrieved in ` +
                            `${formatTime(data.result.executionTime)}`,
                    };

                    if (rowCount === 0) {
                        status.type = MessageType.Response;
                    }
                }

                if (data.result.columns) {
                    columns = generateColumnInfo(dbType, data.result.columns);
                    setColumns = true;
                }
                const rows = convertRows(columns, data.result.rows);

                if (options.showAsText) {
                    let content = "";
                    if (setColumns) {
                        content += options.query + "\n";
                    }

                    content += this.convertResultSetToText(rows, columns, setColumns, resultSummary);
                    this.addTimedResult(options.context, {
                        type: "text",
                        executionInfo: resultSummary ? status : undefined,
                        text: [{
                            type: MessageType.Text,
                            content,
                        }],
                    }, {
                        resultId,
                        index: options.index,
                        sql: options.original,
                        replaceData,
                    });
                } else {
                    void ApplicationDB.db.add("dbModuleResultData", {
                        tabId: id,
                        resultId,
                        rows,
                        columns: setColumns ? columns : undefined,
                        executionInfo: resultSummary ? status : undefined,
                        totalRowCount: resultSummary ? rowCount : undefined,
                        hasMoreRows,
                        currentPage: options.currentPage,
                        index: options.index,
                        sql: options.original,
                    });

                    this.addTimedResult(options.context, {
                        type: "resultSetRows",
                        rows,
                        columns: setColumns ? columns : undefined,
                        executionInfo: resultSummary ? status : undefined,
                        totalRowCount: resultSummary ? rowCount : undefined,
                        hasMoreRows,
                        currentPage: options.currentPage,
                    }, {
                        resultId,
                        index: options.index,
                        sql: options.original,
                        replaceData,
                    });
                }

                if (resultSummary) {
                    resultId = uuid();
                }

                setColumns = false;
                replaceData = false;
            });

            // Handling of the final response.
            if (finalData) {
                // const { dbType } = this.props;

                await this.handleDependentTasks(options.queryType);
            }
        } catch (reason) {
            const resultTimer = this.resultTimers.get(resultId);
            if (resultTimer) {
                await clearIntervalAsync(resultTimer.timer);
                this.resultTimers.delete(resultId);
            }

            let type = MessageType.Error;
            let content = "";

            let code = 0;
            if (reason instanceof ResponseError) {
                content = reason.info.requestState.msg;
                code = reason.info.requestState.code ?? 0;
            } else {
                content = reason as string;

            }

            if (code === 1201) {
                type = MessageType.Warning;
                content = "Cancelled: query was prematurely stopped";
            }

            this.addTimedResult(options.context, {
                type: "text",
                text: [{
                    type,
                    index: options.index,
                    content,
                    language: "ansi",
                }],
                executionInfo: { text: "" },
            }, {
                resultId,
                index: options.index,
                sql: options.original,
                replaceData,
            });

            switch (code) {
                case 3889: {
                    // Sent if a select query was executed on HeatWave, which contained a problem.
                    await this.getHeatWaveTrace(options.context, options.original, resultId);

                    break;
                }

                default:
            }
        }
    };

    private reconnect = async (context: ExecutionContext): Promise<void> => {
        const { backend } = this.state;

        if (backend) {
            try {
                await backend.reconnect();
                await context.addResultData({
                    type: "text",
                    text: [{
                        type: MessageType.Info,
                        index: 0,
                        content: "Reconnection done",
                        language: "ansi",
                    }],
                }, { resultId: "" });
            } catch (reason) {
                await context.addResultData({
                    type: "text",
                    text: [{
                        type: MessageType.Error,
                        index: 0,
                        content: String(reason),
                        language: "ansi",
                    }],
                }, { resultId: "" });
            }
        }
    };

    /**
     * Adds the given data to the result timer for the specified request ID. If no timer exists yet, one is created.
     * The timer, whenever it triggers, sends the next result to the target context.
     *
     * @param context The context to send the result data to.
     * @param data The data to send.
     * @param options Additional details for the execution.
     */
    private addTimedResult(context: ExecutionContext, data: IExecutionResult, options: IResponseDataOptions): void {
        const resultTimer = this.resultTimers.get(options.resultId);
        if (!resultTimer) {
            // Create the timer, if it doesn't exist.
            const newTimer: IResultTimer = {
                timer: setIntervalAsync(async (id: string) => {
                    const resultTimer = this.resultTimers.get(id);
                    if (resultTimer) {
                        const pendingResult = resultTimer.results.shift();
                        if (pendingResult) {
                            await context.addResultData(pendingResult[0], pendingResult[1], { showIndexes: true });
                        } else {
                            // No results left. Stop the timer.
                            void clearIntervalAsync(resultTimer.timer).then(() => {
                                this.resultTimers.delete(id);
                            });
                        }
                    }
                }, 20, options.resultId),

                results: [[data, options]],
            };

            this.resultTimers.set(options.resultId, newTimer);
        } else {
            resultTimer.results.push([data, options]);
        }
    }

    /**
     * Checks if a query affects any of our states used in the UI, like auto commit mode, SQL mode, current schema etc.
     * and triggers actions according to that.
     *
     * @param type The type of the query that just ran.
     *
     * @returns A promise which resolves when the post processing is complete.
     */
    private handleDependentTasks = async (type: QueryType): Promise<void> => {
        const { id, connectionId } = this.props;
        const { backend } = this.state;

        switch (type) {
            case QueryType.SetAutoCommit:
            case QueryType.StartTransaction:
            case QueryType.BeginWork:
            case QueryType.Commit:
            case QueryType.RollbackWork: {
                void requisitions.execute("sqlTransactionChanged", undefined);

                break;
            }

            case QueryType.Use: {
                // The user wants to change the current schema.
                // This may have failed so query the backend for the current schema and then trigger the command.
                const schema = await backend?.getCurrentSchema();
                if (schema) {
                    await requisitions.execute("sqlSetCurrentSchema", { id: id ?? "", connectionId, schema });
                }

                break;
            }

            default: {
                break;
            }
        }
    };

    private updateMrsServiceSdkCache = async (): Promise<boolean> => {
        const { backend } = this.state;

        if (backend !== undefined) {
            // Check if there is an current MRS Service set and if so, get the corresponding MRSruntime SDK
            // for that MRS Service
            try {
                const serviceMetadata = await backend.mrs.getCurrentServiceMetadata();

                // Check if there is a current MRS service set and if the cached
                if (serviceMetadata.id !== undefined) {
                    if (this.cachedMrsServiceSdk.schemaId !== serviceMetadata.id ||
                        this.cachedMrsServiceSdk.schemaMetadataVersion !== serviceMetadata.metadataVersion) {
                        // Fetch SDK BaseClasses only once
                        if (this.cachedMrsServiceSdk.baseClasses === undefined) {
                            this.cachedMrsServiceSdk.baseClasses =
                                await backend.mrs.getSdkBaseClasses("TypeScript", true);
                        }

                        // Fetch new SDK Service Classes and build full code
                        const code = this.cachedMrsServiceSdk.baseClasses + "\n" +
                            await backend.mrs.getSdkServiceClasses(serviceMetadata.id, "TypeScript", true);

                        // Update this.cachedMrsServiceSdk
                        this.cachedMrsServiceSdk = {
                            code,
                            codeLineCount: (code.match(/\n/gm) || []).length,
                            typeDefinitions: code,
                            schemaId: serviceMetadata.id,
                            schemaMetadataVersion: serviceMetadata.metadataVersion,
                        };

                        this.notebookRef.current?.addOrUpdateExtraLib(code,
                            `file:///node_modules/@types/mrsServiceSdk.d.ts`);
                        this.scriptRef.current?.addOrUpdateExtraLib(code,
                            `file:///node_modules/@types/mrsServiceSdk.d.ts`);
                    }
                } else {
                    // If no current MRS service set, clean the cachedMrsServiceSdk
                    this.cachedMrsServiceSdk = {};
                }

                return true;
            } catch (_e) {
                // Ignore exception when MRS is not configured
                return false;
            }
        } else {
            return false;
        }
    };

    /**
     * Handles all incoming execution requests from the editors.
     *
     * @param context The context containing the code to be executed.
     * @param options Content and details for script execution.
     *
     * @returns True if something was actually executed, false otherwise.
     */
    private handleExecution = async (context: ExecutionContext, options: IScriptExecutionOptions): Promise<boolean> => {
        const { workerPool } = this.props;

        const command = context.code.trim();
        if (command.length === 0) {
            return false;
        }

        this.runningContexts.set(context.id, context);

        const parts = command.split(" ");
        if (parts.length > 0) {
            const temp = parts[0].toLowerCase();
            switch (temp) {
                case "\\about": {
                    const isMac = navigator.userAgent.includes("Macintosh");
                    const content = DBConnectionTab.aboutMessage.replace("%modifier%", isMac ? "Cmd" : "Ctrl");
                    await context?.addResultData({
                        type: "text",
                        text: [{ type: MessageType.Info, content, language: "ansi" }],
                    }, { resultId: "" });

                    return true;
                }

                case "\\reconnect": {
                    await context?.addResultData({
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            content: "Reconnecting the current DB connection ...\n",
                            language: "ansi",
                        }],
                    }, { resultId: "" });
                    await this.reconnect(context);

                    return true;
                }

                default:
            }
        }

        context.clearResult();

        switch (context.language) {
            case "javascript": {
                workerPool.runTask({ api: ScriptingApi.Request, code: context.code, contextId: context.id })
                    .then((taskId: number, data: IConsoleWorkerResultData) => {
                        void this.handleTaskResult(taskId, data);
                    });

                break;
            }

            case "typescript": {
                await this.updateMrsServiceSdkCache();

                let mrsServiceSdkCode = "";
                let libCodeLineNumbers = 0;

                // Set the mrsLoginResult constant
                if (this.mrsLoginResult && this.mrsLoginResult.authApp && this.mrsLoginResult.jwt) {
                    mrsServiceSdkCode += "const mrsLoginResult = { " +
                        `authApp: "${this.mrsLoginResult.authApp}", jwt: "${this.mrsLoginResult.jwt}" };\n`;
                    libCodeLineNumbers += 1;
                }

                // Get the mrsServiceSdkCode that needs to be added before the code block
                if (this.cachedMrsServiceSdk.code !== undefined) {
                    mrsServiceSdkCode += this.cachedMrsServiceSdk.code + "\n";
                    libCodeLineNumbers += this.cachedMrsServiceSdk.codeLineCount ?? 0;

                }

                const usesAwait = context.code.includes("await ");

                // Execute the code
                workerPool.runTask({
                    api: ScriptingApi.Request,
                    // Detect if the code includes "await " and if so, wrap the code in a self-executing async function.
                    // This is done to allow direct execution of awaits on async functions.
                    // Further, the temporary string "\nexport{}\n" is removed from the code.
                    // Please note that the libCodeLineNumbers need to be adjusted accordingly.
                    // See EmbeddedPresentationInterface.tsx for details.
                    libCodeLineNumbers: libCodeLineNumbers + (usesAwait ? 1 - 2 + 2 : 0) + 1,
                    code: ts.transpile(mrsServiceSdkCode +
                        (usesAwait
                            ? "(async () => {\n" + context.code.replace("\nexport{}\n", "") + "})()"
                            : context.code), {
                        alwaysStrict: true,
                        target: ScriptTarget.ES2022,
                        inlineSourceMap: true,
                    }),
                    contextId: context.id,
                }).then((taskId: number, data: IConsoleWorkerResultData) => {
                    void this.handleTaskResult(taskId, data);
                });

                break;
            }

            case "sql":
            case "mysql": {
                await this.runSQLCode(context as SQLExecutionContext, options);

                break;
            }

            default:
        }

        return true;
    };

    /**
     * Starts a trace sequence to get details about a HeatWave error.
     * The result of that trace will be added to the given context.
     *
     * @param context The context to add the additional info.
     * @param sql The query which caused the trouble.
     * @param resultId The id of the associated result.
     */
    private async getHeatWaveTrace(context: ExecutionContext, sql: string, resultId: string): Promise<void> {
        const { backend } = this.state;

        if (!backend) {
            return;
        }

        const services = ScriptingLanguageServices.instance;
        const type = await services.determineQueryType(context, sql);
        if (type !== QueryType.ExplainStatement) {
            // If the statement is not an explain statement then make it one.
            // That avoids any large data retrieval for this trace.
            sql = "explain " + sql;
        }

        // Store the current values for the optimizer trace and enable it (if it wasn't yet).
        // Setting the offset every time is essential to trigger a reset which is required for correct results.
        try {
            await backend.execute("SET @old_optimizer_trace = @@optimizer_trace, " +
                "@old_optimizer_trace_offset = @@optimizer_trace_offset, @@optimizer_trace = \"enabled=on\", " +
                "@@optimizer_trace_offset = -2;");

            // Run the query on the primary engine.
            await backend.execute(sql);

            // Now we can read the optimizer trace to get the details.
            const result = await backend.execute("SELECT QUERY, TRACE->'$**.Rapid_Offload_Fails', " +
                "TRACE->'$**.secondary_engine_not_used' FROM INFORMATION_SCHEMA.OPTIMIZER_TRACE;");

            // Restore the previous trace status.
            await backend.execute("SET @@optimizer_trace = @old_optimizer_trace, @@optimizer_trace_offset = " +
                "@old_optimizer_trace_offset;", [], resultId);

            if (result) {
                const rows = result.rows as string[][];
                if (rows && rows.length > 0 && rows[0].length > 1) {
                    const info = (rows[0][1] ?? rows[0][2]);

                    // Remove outer braces and split into the two values.
                    const values = info.substring(2, info.length - 2).split(":");
                    if (values.length > 1) {
                        // Remove the quotes and add this text to the error info
                        // of the given context.
                        const text = values[1].trim();
                        const info: ITextResultEntry = {
                            content: "Optimizer Trace: " + text.substring(1, text.length - 1),
                            type: MessageType.Warning,
                            language: "ansi",
                        };

                        await context.addResultData({
                            type: "text",
                            text: [info],
                        }, { resultId: "" });
                    }
                }
            }
        } catch (error) {
            const info: ITextResultEntry = {
                content: "Error while getting optimizer trace:\n" + String(error),
                type: MessageType.Error,
                language: "ansi",
            };

            await context.addResultData({
                type: "text",
                text: [info],
            }, { resultId: "" });

        }
    }

    private handleEdit = (editorId?: string): void => {
        if (editorId) {
            const { id = "", onEditorChange } = this.props;

            onEditorChange?.(id, editorId);
        }
    };

    /**
     * Called when data from a task (which we have scheduled above) arrives.
     *
     * @param taskId The ID of the task. Used to add further requests to it.
     * @param data The data returned by the worker.
     *
     * @returns A promise which resolves when the result was handled.
     */
    private handleTaskResult = async (taskId: number, data: IConsoleWorkerResultData): Promise<void> => {
        const { workerPool } = this.props;
        const { backend } = this.state;

        try {
            switch (data.api) {
                case ScriptingApi.QueryStatus: {
                    const result = data.result as IResultSetData;
                    const status = `${result.requestState.type}, ` +
                        `${formatWithNumber("record", result.totalRowCount || 0)} retrieved in ` +
                        `${formatTime(result.executionTime)}`;

                    const context = this.runningContexts.get(data.contextId);
                    if (context) {
                        await context.addResultData({
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                content: status,
                                language: "ansi",
                            }],
                            executionInfo: { text: "" },
                        }, { resultId: "" });
                    }

                    break;
                }

                case ScriptingApi.Result: { // Evaluation result.
                    if (data.result && data.result !== "PENDING") {
                        const context = this.runningContexts.get(data.contextId);
                        if (context) {
                            if (data.isError) {
                                await context.addResultData({
                                    type: "text",
                                    text: [{
                                        type: MessageType.Error,
                                        content: String(data.result),
                                        language: "ansi",
                                    }],
                                    executionInfo: { type: MessageType.Error, text: "" },
                                }, { resultId: "" });
                            } else {
                                await context.addResultData({
                                    type: "text",
                                    text: [{
                                        type: MessageType.Info,
                                        content: String(data.result),
                                    }],
                                }, { resultId: "" });
                            }
                        }
                    }

                    break;
                }

                case ScriptingApi.RunSql: {
                    if (backend) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        let columns: Array<{ name: string; type: string; length: number; }> = [];
                        let rows: Array<Record<string, unknown>> = [];

                        const handleResult = (data: IDbEditorResultSetData): void => {
                            if (data.columns) {
                                columns = data.columns;
                                rows = [];
                            }

                            if (data.rows) {
                                for (const row of data.rows ?? []) {
                                    // Convert rows to objects.
                                    const rowForRes: Record<string, unknown> = {};
                                    if (Array.isArray(row)) {
                                        for (let i = 0; i < row.length; i++) {
                                            rowForRes[columns[i].name] = row[i];
                                        }
                                    }
                                    rows.push(rowForRes);
                                }
                            }
                        };

                        try {
                            const finalData = await backend.execute(data.code!, data.params as string[], uuid(),
                                (data) => {
                                    handleResult(data.result);
                                });

                            if (finalData) {
                                handleResult(finalData);
                            }

                            // Send back the result data to the worker to allow the user to act on
                            // that in their JS code. If the `final` member of the data is set to
                            // true, the task is implicitly released and freed.
                            workerPool.continueTask(taskId, {
                                api: ScriptingApi.Request,
                                result: rows,
                                contextId: data.contextId,
                                final: true,
                            });
                        } catch (reason) {
                            const context = this.runningContexts.get(data.contextId);
                            await context?.addResultData({
                                type: "text",
                                executionInfo: {
                                    type: MessageType.Error,
                                    text: `Error: ${String(reason)}`,
                                },
                            }, { resultId: "" });

                            workerPool.releaseTask(taskId);
                        }
                    }

                    break;
                }

                case ScriptingApi.RunSqlIterative: {
                    if (backend) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        try {
                            const finalData = backend.execute(data.code!, data.params as string[], undefined,
                                (intermediateData) => {
                                    // Send back the result data to the worker to allow the user to act on that in
                                    // their JS code. If the `final` member of the data is set to true, the task is
                                    // implicitly released and freed.
                                    workerPool.continueTask(taskId, {
                                        api: ScriptingApi.Request,
                                        result: intermediateData,
                                        contextId: data.contextId,
                                        final: false,
                                    });
                                });

                            workerPool.continueTask(taskId, {
                                api: ScriptingApi.Request,
                                result: finalData,
                                contextId: data.contextId,
                                final: true,
                            });

                        } catch (reason) {
                            const context = this.runningContexts.get(data.contextId);
                            await context?.addResultData({
                                type: "text",
                                executionInfo: {
                                    type: MessageType.Error,
                                    text: `Error: ${String(reason)}`,
                                },
                            }, { resultId: "" });

                            workerPool.releaseTask(taskId);
                        }
                    }

                    break;
                }

                case ScriptingApi.Print: {
                    const context = this.runningContexts.get(data.contextId);

                    if (data.value !== undefined && context) {
                        await context.addResultData({
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                content: String(data.value),
                            }],
                        }, { resultId: "" });
                    }

                    break;
                }

                case ScriptingApi.Graph: {
                    const context = this.runningContexts.get(data.contextId);
                    await context?.addResultData({
                        type: "graphData",
                        options: data.options,
                    }, { resultId: "" });

                    break;
                }

                case ScriptingApi.MrsAuthenticate: {
                    const passwordRequest: IServicePasswordRequest = {
                        requestId: "userInput",
                        service: data.serviceUrl,
                        user: data.userName,
                        payload: {
                            authPath: data.authPath,
                            authApp: data.authApp,
                            contextId: data.contextId,
                        },
                    };
                    void requisitions.execute("requestMrsAuthentication", passwordRequest);

                    break;
                }

                default: {
                    break;
                }
            }
        } catch (error) {
            const context = this.runningContexts.get(data.contextId);
            await context?.addResultData({
                type: "text",
                text: [{
                    type: MessageType.Error,
                    content: error instanceof Error ? (error.stack ?? error.message) : String(error),
                }],
                executionInfo: { type: MessageType.Error, text: "" },
            }, { resultId: "" });
        }
    };

    private handleSelectItem = (itemId: string, type: EntityType, caption?: string): void => {
        const { id = "", onSelectItem } = this.props;

        onSelectItem?.({ itemId, tabId: id, type, caption });
    };

    private handleCloseEditor = (editorId: string): void => {
        const { id, onRemoveEditor } = this.props;

        onRemoveEditor?.(id ?? "", editorId);
    };

    private handleAddEditor = (): string | undefined => {
        const { id, onAddEditor } = this.props;

        return onAddEditor?.(id ?? "");
    };

    private handleEditorRename = (editorId: string, newCaption: string): void => {
        const { id, onEditorRename } = this.props;

        onEditorRename?.(id ?? "", editorId, newCaption);
    };

    private handleAddScript = (language: EditorLanguage): void => {
        const { id, onAddScript, dbType } = this.props;

        onAddScript?.(id ?? "", language, dbType);
    };

    private saveSchemaTree = (id: string, schemaTree: ISchemaTreeEntry[]): void => {
        const { onSaveSchemaTree } = this.props;

        onSaveSchemaTree?.(id, schemaTree);
    };

    private saveExplorerState = (id: string, state: Map<string, IExplorerSectionState>): void => {
        const { onSaveExplorerState } = this.props;

        onSaveExplorerState?.(id, state);
    };

    private handleExplorerMenuAction = (id: string, actionId: string, params?: unknown): void => {
        const { connectionId } = this.props;
        const { backend } = this.state;

        const data = params as ISchemaTreeEntry;
        switch (actionId) {
            case "setDefaultMenuItem": {
                backend?.setCurrentSchema(data.qualifiedName.schema).then(() => {
                    void requisitions.execute("sqlSetCurrentSchema",
                        { id, connectionId, schema: data.qualifiedName.schema });
                }).catch((reason) => {
                    void requisitions.execute("showError", ["Cannot set default schema", String(reason)]);
                });

                break;
            }

            case "filterMenuItem": {
                break;
            }

            case "inspectorMenuItem": {
                break;
            }

            case "clipboardNameMenuItem": {
                requisitions.writeToClipboard(data.caption);
                break;
            }

            case "clipboardCreateStatementMenuItem":
            case "editorCreateStatementMenuItem": {
                let type;
                let qualifier = `\`${data.qualifiedName.schema}\`.`;
                let index = 1; // The column index in the result row.
                switch (data.type) {
                    case SchemaTreeType.Schema: {
                        type = "schema";
                        qualifier = "";
                        break;
                    }

                    case SchemaTreeType.Table: {
                        type = "table";
                        break;
                    }

                    case SchemaTreeType.View: {
                        type = "view";
                        break;
                    }

                    case SchemaTreeType.StoredFunction: {
                        index = 2;
                        type = "function";
                        break;
                    }

                    case SchemaTreeType.StoredProcedure: {
                        index = 2;
                        type = "procedure";
                        break;
                    }

                    case SchemaTreeType.Trigger: {
                        type = "trigger";
                        break;
                    }

                    case SchemaTreeType.Event: {
                        type = "event";
                        break;
                    }

                    case SchemaTreeType.User: {
                        type = "user";
                        break;
                    }

                    default:
                }

                if (type) {
                    void backend?.execute(`show create ${type} ${qualifier}\`${data.caption}\``).then((data) => {
                        const rows = data?.rows;
                        if (rows && rows.length > 0) {
                            // Returns one row with 2 columns.
                            const row = rows[0] as string[];
                            if (row.length > index) {
                                if (actionId === "clipboardCreateStatementMenuItem") {
                                    requisitions.writeToClipboard(row[index]);
                                } else {
                                    if (this.notebookRef.current) {
                                        this.notebookRef.current.insertScriptText("mysql", row[index]);
                                    } else if (this.scriptRef.current) {
                                        this.scriptRef.current.insertScriptText("sql", row[index]);
                                    }
                                }
                            }
                        }
                    });
                }

                break;
            }

            case "editorNameMenuItem": {
                break;
            }

            case "createSchemaMenuItem": {
                break;
            }

            case "alterSchemaMenuItem": {
                break;
            }

            case "dropSchemaMenuItem": {
                break;
            }

            case "refreshMenuItem": {
                break;
            }

            default: {
                // Forward any other menu action to the module.
                const { id, onExplorerMenuAction } = this.props;
                onExplorerMenuAction?.(id ?? "", actionId, params);

                break;
            }
        }
    };

    private handlePaneResize = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "explorer") {
                const { id = "", onExplorerResize } = this.props;

                onExplorerResize?.(id, value.currentSize);
            }
        });
    };

    private handleGraphDataChange = (data: ISavedGraphData): void => {
        const { id, onGraphDataChange } = this.props;

        onGraphDataChange?.(id ?? "", data);
    };

    /**
     * Converts the given tabular data into a text representation. The method updates the given column info with the
     * width of each column, if not yet done.
     *
     * @param rows The row data.
     * @param columns Column information.
     * @param started A flag indicating whether the column header must be rendered
     * @param finished A flag indicating whether the final line must be rendered.
     *
     * @returns The text representation of the given data.
     */
    private convertResultSetToText(rows: IDictionary[], columns: IColumnInfo[], started: boolean, finished: boolean) {
        let result = "";

        const convertLineBreaks = (value: string): string => {
            const result = value.replaceAll(/\r/g, "\\r");

            return result.replaceAll(/\n/g, "\\n");
        };

        // Compute the width of each column, based on the column name and the data, if not yet done.
        if (columns.length > 0 && columns[0].width === undefined) {
            columns.forEach((column: IColumnInfo) => {
                column.title = convertLineBreaks(column.title);
                column.width = column.title.length;
                switch (column.dataType.type) {
                    case DBDataType.TinyInt:
                    case DBDataType.SmallInt:
                    case DBDataType.MediumInt:
                    case DBDataType.Int:
                    case DBDataType.Bigint:
                    case DBDataType.UInteger:
                    case DBDataType.Float:
                    case DBDataType.Real:
                    case DBDataType.Double:
                    case DBDataType.Decimal: {
                        column.rightAlign = true;

                        break;
                    }

                    default:
                }
            });
        }

        rows.forEach((row) => {
            let value;
            columns.forEach((column) => {
                switch (column.dataType.type) {
                    // Binary data
                    case DBDataType.TinyBlob:
                    case DBDataType.Blob:
                    case DBDataType.MediumBlob:
                    case DBDataType.LongBlob:
                    case DBDataType.Binary:
                    case DBDataType.Varbinary: {
                        value = formatBase64ToHex(String(row[column.field]), 64);

                        break;
                    }

                    default: {
                        value = convertLineBreaks(String(row[column.field]));

                        break;
                    }
                }

                row[column.field] = value;
                const length = value.length;
                if (length > (column.width ?? 0)) {
                    column.width = length;
                }
            });
        });

        const separator = columns.reduce((previous, current) => {
            return previous + "-".repeat(current.width! + 2) + "+";
        }, "+");

        if (started) {
            // Render the column header.
            result += separator + "\n";

            const line = columns.reduce((previous, current, index) => {
                return previous + " " + current.title.padEnd(columns[index].width!) + " |";
            }, "|");
            result += line + "\n" + separator + "\n";
        }

        // Render the data.
        rows.forEach((row) => {
            const line = columns.reduce((previous, current, index) => {
                if (columns[index].rightAlign) {
                    return previous + " " + String(row[current.field]).padStart(columns[index].width!) + " |";
                }

                return previous + " " + String(row[current.field]).padEnd(columns[index].width!) + " |";
            }, "|");
            result += line + "\n";
        });

        if (finished) {
            result += separator + "\n";
        }

        return result;
    }

    /**
     * Goes through the list of open editors and returns the one that is currently active.
     * If no editor is active, the first one is returned.
     *
     * @returns The active editor or undefined, if no editor is open.
     */
    private findActiveEditor = (): IOpenEditorState | undefined => {
        const { savedState } = this.props;
        let activeEditor = savedState.editors.find(
            (entry: IOpenEditorState): boolean => {
                return entry.id === savedState.activeEntry;
            },
        );

        if (!activeEditor && savedState.editors.length > 0) {
            activeEditor = savedState.editors[0];
        }

        return activeEditor;
    };
}
