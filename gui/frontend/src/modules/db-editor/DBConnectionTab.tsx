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

import "./assets/DBEditor.css";

import { ComponentChild, createRef } from "preact";
import { SetIntervalAsyncTimer, clearIntervalAsync, setIntervalAsync } from "set-interval-async/dynamic";
import ts, { ScriptTarget } from "typescript";

import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import { ui } from "../../app-logic/UILayer.js";
import {
    DBDataType, IColumnInfo, IDictionary, IServicePasswordRequest, IStatusInfo, MessageType,
} from "../../app-logic/general-types.js";
import {
    ITableColumn, IDbEditorResultSetData,
    type ISqlEditorHistoryEntry,
} from "../../communication/ProtocolGui.js";
import { IMdsChatData, IMdsChatStatus } from "../../communication/ProtocolMds.js";
import { ResponseError } from "../../communication/ResponseError.js";
import { ChatOptionAction, ChatOptions, IChatOptionsState } from "../../components/Chat/ChatOptions.js";
import { IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { SplitContainer } from "../../components/ui/SplitContainer/SplitContainer.js";
import { type ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import {
    OdmEntityType, type IOdmShellSessionEntry, type IOdmStandaloneDocumentEntry, type LeafDocumentEntry,
    type OpenDocumentDataModel,
} from "../../data-models/OpenDocumentDataModel.js";
import { getRouterPortForConnection } from "../../modules/mrs/mrs-helpers.js";
import { QueryType } from "../../parsing/parser-common.js";
import { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import { ScriptingLanguageServices } from "../../script-execution/ScriptingLanguageServices.js";
import {
    IExecutionResult, INotebookFileFormat, IResponseDataOptions, ITextResultEntry, LoadingState, currentNotebookVersion,
} from "../../script-execution/index.js";
import {
    IEditorExtendedExecutionOptions, IMrsDbObjectEditRequest, IMrsSchemaEditRequest, type IColumnDetails,
    type IOpenFileDialogResult,
} from "../../supplement/RequisitionTypes.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import {
    EditorLanguage, IScriptRequest, ISqlPageRequest, convertRows, generateColumnInfo,
    getColumnsMetadataForEmptyResultSet,
    parseSchemaTable,
} from "../../supplement/index.js";
import { convertErrorToString, saveTextAsFile, selectFile, uuid } from "../../utilities/helpers.js";
import { formatBase64ToHex, formatTime, formatWithNumber } from "../../utilities/string-helpers.js";
import { IMrsLoginResult } from "../mrs/sdk/MrsBaseClasses.js";
import { IMrsAuthRequestPayload } from "../mrs/types.js";
import { ClientConnections } from "./ClientConnections.js";
import { ILakehouseNavigatorSavedState, ILakehouseNavigatorState, LakehouseNavigator } from "./LakehouseNavigator.js";
import { Notebook } from "./Notebook.js";
import { PerformanceDashboard } from "./PerformanceDashboard.js";
import { ScriptEditor } from "./ScriptEditor.js";
import { ServerStatus } from "./ServerStatus.js";
import { IConsoleWorkerResultData, ScriptingApi } from "./console.worker-types.js";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool.js";
import { DBEditorContext, ISavedGraphData, IToolbarItems } from "./index.js";

const errorRexExp = new RegExp(`(You have an error in your SQL syntax; check the manual that corresponds to your ` +
    `MySQL server version for the right syntax to use near '(.*)' at line )(\\d+)`);
const leadingLineBreaksRegExp = new RegExp(`^\\s*\\n+`);

interface IResultTimer {
    timer: SetIntervalAsyncTimer<unknown[]>;
    results: Array<[IExecutionResult, IResponseDataOptions]>;
}

/**
 * Just the minimal information about existing editors.
 */
export interface ISavedEditorState {
    readonly documentStates: IOpenDocumentState[];

    /** The ID of the document which is active currently. */
    activeEntry: string;

    /**
     * Set when heatwave is available and enabled for the hosting connection.
     * This flag is duplicated from that connection's details, to avoid having a dependency on the connection.
     */
    readonly heatWaveEnabled: boolean;

    mleEnabled: boolean;
}

/** A record holding state for an open document. */
export interface IOpenDocumentState {
    readonly document: LeafDocumentEntry | IOdmStandaloneDocumentEntry | IOdmShellSessionEntry;

    readonly state?: IEditorPersistentState;

    /** The version number of the editor model when we last saved it (for entries that are actually saved). */
    currentVersion: number;
}

export interface IAdminPageStates {
    lakehouseNavigatorState: ILakehouseNavigatorState;
}

/**
 * Comprises states related to a connection's UI presentation, like editor settings, the current editor model version,
 * the title of the editor and others.
 */
export interface IConnectionPresentationState extends ISavedEditorState {
    /** The list of documents this tab currently shows (notebooks, script editors and admin pages). */
    readonly documents: LeafDocumentEntry[];

    adminPageStates: IAdminPageStates;

    /** Cached data/settings for the performance dashboard. */
    graphData: ISavedGraphData;

    chatOptionsState: IChatOptionsState;
    executionHistory: ISqlEditorHistoryEntry[];
    currentExecutionHistoryIndex: number;
    executionHistoryUnsavedCode?: string;
    executionHistoryUnsavedCodeLanguage?: string;
}

/** Selecting an item requires different data, depending on the type of the item. */
export interface ISelectItemDetails {
    document: LeafDocumentEntry | IOdmStandaloneDocumentEntry | IOdmShellSessionEntry;

    /** The id of this connection tab. */
    tabId: string,

    /** For external/broken out scripts only: the script's content. */
    content?: string;
}

interface IDBConnectionTabProperties extends IComponentProperties {
    /** The caption of this page used in the hosting tabview. */
    caption?: string;

    connection?: ICdmConnectionEntry;
    savedState: IConnectionPresentationState;
    workerPool: ExecutionWorkerPool;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;

    showExplorer?: boolean; // If false, collapse the explorer split pane.
    showAbout: boolean;

    /** Extra libraries for the code editor that don't change. */
    extraLibs?: Array<{ code: string, path: string; }>;

    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;

    onAddEditor?: (id: string) => string | undefined;
    onSelectItem?: (details: ISelectItemDetails) => void;
    onEditorRename?: (id: string, editorId: string, newCaption: string) => void;

    /** Sent when the content of a standalone editor changed (typing, pasting, undo/redo etc.). */
    onEditorChange?: (id: string, editorId: string) => void;

    /** Triggered when new text has to be loaded for a script editor. */
    onLoadScript?: (id: string, editorId: string, content: string) => void;

    /** Triggered when new text has to be loaded for a script editor. */
    onSaveScript?: (id: string, editorId: string, content: string) => void;

    onGraphDataChange?: (id: string, data: ISavedGraphData) => void;

    onSaveAdminLakehouseNavigatorState?: (id: string, data: Partial<ILakehouseNavigatorSavedState>) => void;
    onChatOptionsChange?: (id: string, data: Partial<IChatOptionsState>) => void;
}

interface IDBConnectionTabState extends IComponentState {
    errorMessage?: string;

    /** Set to true if a notebook has been loaded the app is embedded, emulating so a one editor-only mode. */
    standaloneMode: boolean;

    genAiStatus?: IMdsChatStatus;
}

/** A list of parameters/options used for query execution. */
export interface IQueryExecutionOptions {
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

    /** Allow editing the result set in the UI. */
    updatable: boolean;

    /** If the query is a simple SELECT, involving only 1 table then its fully qualified name is stored here. */
    fullTableName?: string;

    /** The names of all columns that are part of the primary key in the table, if the query is updatable. */
    pkColumns?: string[];
}

/** Metadata for the MRS SDK of the current MRS Service. */
interface IMrsServiceSdkMetadata {
    serviceUrl?: string,
    baseClasses?: string,
    code?: string,
    codeLineCount?: number;
    schemaId?: string,
    schemaMetadataVersion?: string,
}

// A tab page for a single connection (managed by the scripting module).
export class DBConnectionTab extends ComponentBase<IDBConnectionTabProperties, IDBConnectionTabState> {
    private static aboutMessage = `Welcome to the MySQL Shell - DB Notebook.

Press %modifier%+Enter to execute the code block.

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

    // The global object that holds the properties which can be accessed across code blocks
    #globalScriptingObject: IDictionary = {};

    // This is set during rendering to have it available in code outside of the render method.
    // Another way would be to access it using `this.context as DBEditorContextType`, but for some unknown reason
    // that doesn't work in this component.
    #documentDataModel: OpenDocumentDataModel | undefined;

    public constructor(props: IDBConnectionTabProperties) {
        super(props);

        this.state = {
            standaloneMode: false,
        };

        this.addHandledProperties("connectionId", "dbType", "savedState", "workerPool", "toolbarInset", "showExplorer",
            "showAbout", "extraLibs",
            "onHelpCommand", "onAddEditor", "onLoadEditor", "onRemoveEditor", "onSelectEditor", "onChangeEditor",
            "onSaveSchemaTree", "onSaveExplorerState", "onExplorerResize", "onExplorerMenuAction");

    }

    public override componentDidMount(): void {
        requisitions.register("editorStopExecution", this.editorStopExecution);
        requisitions.register("editorCommit", this.editorCommit);
        requisitions.register("editorRollback", this.editorRollback);
        requisitions.register("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.register("editorRunCode", this.editorRunCode);
        requisitions.register("editorRunScript", this.editorRunScript);
        requisitions.register("editorEditScript", this.editorEditScript);
        requisitions.register("editorLoadScript", this.editorLoadScript);
        requisitions.register("editorRenameScript", this.editorRenameScript);
        requisitions.register("acceptMrsAuthentication", this.acceptMrsAuthentication);
        requisitions.register("cancelMrsAuthentication", this.cancelMrsAuthentication);
        requisitions.register("refreshMrsServiceSdk", this.updateMrsServiceSdkCache);
        requisitions.register("editorSaveNotebook", this.editorSaveNotebook);
        requisitions.register("editorLoadNotebook", this.editorLoadNotebook);
        requisitions.register("showLakehouseNavigator", this.showLakehouseNavigator);
        requisitions.register("showChatOptions", this.showChatOptions);
        requisitions.register("selectFile", this.selectFile);

        const { id, connection } = this.props;
        if (connection) {
            const details = connection.details;
            requisitions.executeRemote("sqlSetCurrentSchema",
                { id: id ?? "", connectionId: details.id, schema: connection.currentSchema });
        }

        this.notebookRef.current?.focus();

        // Update the cachedMrsServiceSdk for the first time
        void this.updateMrsServiceSdkCache();

        // Check if HeatWave GenAI Chat is available
        void this.getGenAiStatus();
    }

    public override componentWillUnmount(): void {
        this.resultTimers.forEach((resultTimer) => {
            void clearIntervalAsync(resultTimer.timer);
        });
        this.resultTimers.clear();

        const { id, connection } = this.props;

        if (connection) {
            requisitions.executeRemote("sqlSetCurrentSchema",
                { id: id ?? "", connectionId: connection.details.id, schema: "" });
        }

        requisitions.unregister("editorStopExecution", this.editorStopExecution);
        requisitions.unregister("editorCommit", this.editorCommit);
        requisitions.unregister("editorRollback", this.editorRollback);
        requisitions.unregister("sqlShowDataAtPage", this.sqlShowDataAtPage);
        requisitions.unregister("editorRunCode", this.editorRunCode);
        requisitions.unregister("editorRunScript", this.editorRunScript);
        requisitions.unregister("editorEditScript", this.editorEditScript);
        requisitions.unregister("editorLoadScript", this.editorLoadScript);
        requisitions.unregister("editorRenameScript", this.editorRenameScript);
        requisitions.unregister("acceptMrsAuthentication", this.acceptMrsAuthentication);
        requisitions.unregister("cancelMrsAuthentication", this.cancelMrsAuthentication);
        requisitions.unregister("refreshMrsServiceSdk", this.updateMrsServiceSdkCache);
        requisitions.unregister("editorSaveNotebook", this.editorSaveNotebook);
        requisitions.unregister("editorLoadNotebook", this.editorLoadNotebook);
        requisitions.unregister("showLakehouseNavigator", this.showLakehouseNavigator);
        requisitions.unregister("showChatOptions", this.showChatOptions);
        requisitions.unregister("selectFile", this.selectFile);
    }

    public override componentDidUpdate(prevProps: IDBConnectionTabProperties): void {
        const { id, connection } = this.props;

        if (connection) {
            const details = connection.details;
            if (details.id !== prevProps.connection?.details.id) {
                requisitions.executeRemote("sqlSetCurrentSchema",
                    { id: id ?? "", connectionId: details.id, schema: connection.currentSchema });
            }
        }
    }

    public render(): ComponentChild {
        const { connection, toolbarItems, savedState, onHelpCommand, showAbout, extraLibs } = this.props;
        const { standaloneMode, genAiStatus } = this.state;

        const className = this.getEffectiveClassNames(["connectionTabHost"]);

        return <DBEditorContext.Consumer>{(context) => {
            this.#documentDataModel = context?.documentDataModel;

            let document;
            const activeEditor = this.findActiveEditor();
            if (activeEditor && connection) {
                switch (activeEditor.document.type) {
                    case OdmEntityType.Notebook: {
                        this.scriptRef.current = null;
                        document = <Notebook
                            ref={this.notebookRef}
                            savedState={savedState}
                            backend={connection.backend}
                            toolbarItemsTemplate={toolbarItems}
                            standaloneMode={standaloneMode}
                            dbType={connection.details.dbType}
                            extraLibs={extraLibs}
                            showAbout={showAbout && !this.loadingNotebook}
                            fontSize={appParameters.editorFontSize}
                            onHelpCommand={onHelpCommand}
                            onScriptExecution={this.handleExecution}
                            onContextLanguageChange={this.handleContextLanguageChange}
                            onNavigateHistory={this.handleNavigateHistory}
                        />;

                        const chatOptionsExpanded = savedState.chatOptionsState.chatOptionsExpanded;
                        let initialSize = 0;
                        if (savedState.chatOptionsState.chatOptionsWidth > -1) {
                            initialSize = savedState.chatOptionsState.chatOptionsWidth;
                        }

                        document = <SplitContainer
                            className={className}
                            panes={
                                [
                                    {
                                        id: "notebook",
                                        minSize: 350,
                                        snap: false,
                                        stretch: true,
                                        resizable: chatOptionsExpanded,
                                        content: document,
                                    },
                                    {
                                        id: "chatOptions",
                                        minSize: 340,
                                        initialSize,
                                        snap: true,
                                        collapsed: !chatOptionsExpanded,
                                        content: chatOptionsExpanded ? (
                                            <ChatOptions savedState={savedState.chatOptionsState}
                                                genAiStatus={genAiStatus}
                                                onChatOptionsStateChange={this.updateChatOptionsState}
                                                onAction={this.handleChatAction}
                                                currentSchema={connection.currentSchema} />) : undefined,
                                    },
                                ]}
                        />;
                        break;
                    }

                    case OdmEntityType.Script: {
                        this.notebookRef.current = null;
                        document = <ScriptEditor
                            id={savedState.activeEntry}
                            ref={this.scriptRef}
                            extraLibs={extraLibs}
                            savedState={savedState}
                            connectionId={connection.details.id}
                            toolbarItemsTemplate={toolbarItems}
                            standaloneMode={standaloneMode}
                            fontSize={appParameters.editorFontSize}
                            onScriptExecution={this.handleExecution}
                            onEdit={this.handleEdit}
                        />;

                        break;
                    }

                    case OdmEntityType.AdminPage: {
                        switch (activeEditor.document.pageType) {
                            case "serverStatus": {
                                document = <ServerStatus
                                    backend={connection?.backend}
                                    toolbarItems={toolbarItems}
                                />;

                                break;
                            }

                            case "clientConnections": {
                                document = <ClientConnections
                                    backend={connection?.backend}
                                    toolbarItems={toolbarItems}
                                />;

                                break;
                            }

                            case "performanceDashboard": {
                                document = <PerformanceDashboard
                                    backend={connection?.backend}
                                    toolbarItems={toolbarItems}
                                    graphData={savedState.graphData}
                                    onGraphDataChange={this.handleGraphDataChange}

                                //stopAfter={10}
                                />;

                                break;
                            }

                            case "lakehouseNavigator": {
                                document = <LakehouseNavigator
                                    backend={connection?.backend}
                                    toolbarItems={toolbarItems}
                                    savedState={savedState.adminPageStates.lakehouseNavigatorState}
                                    onLakehouseNavigatorStateChange={this.handleLakehouseNavigatorStateChange} />;

                                break;
                            }

                            default:
                        }

                        break;
                    }

                    default:
                }
            }

            return document;
        }}
        </DBEditorContext.Consumer>;
    }

    /**
     * @returns true if this tab can be deactivated/closed, false if not.
     */
    public canClose(): Promise<boolean> {
        // Only if a notebook is active, we need to check if it can be closed.
        if (this.notebookRef.current) {
            return this.notebookRef.current.canClose();
        }

        return Promise.resolve(true);
    }

    private editorStopExecution = async (): Promise<boolean> => {
        const { connection } = this.props;

        if (connection) {
            // Only one query can run in a DB editor at a given time (single connection), so we stop here
            // whatever is running currently.
            await connection.backend.killQuery();

            return true;
        }

        return false;
    };

    private editorCommit = async (): Promise<boolean> => {
        const { connection } = this.props;

        if (!connection) {
            return false;
        }

        try {
            await connection.backend.execute("commit");
            await requisitions.execute("sqlTransactionChanged", undefined);

            void ui.showInformationMessage("Commit successful.", {});
        } catch (reason) /* istanbul ignore next */ {
            const message = convertErrorToString(reason);
            await ui.showErrorMessage(`Error while committing changes: ${message}`, {});
        }

        return true;
    };

    private editorRollback = async (): Promise<boolean> => {
        const { connection } = this.props;

        if (!connection) {
            return false;
        }

        await connection.backend.execute("rollback");
        await requisitions.execute("sqlTransactionChanged", undefined);

        void ui.showInformationMessage("Rollback successful.", {});

        return true;
    };

    private sqlShowDataAtPage = async (data: ISqlPageRequest): Promise<boolean> => {
        let pageSize = Settings.get("sql.limitRowCount", 1000);
        if (pageSize < 1 || pageSize > 100000) {
            pageSize = 1000;
        }

        await this.executeQuery(data.context as SQLExecutionContext, 0, data.page, pageSize, {}, data.sql,
            data.oldResultId);

        return true;
    };

    /**
     * Runs the given code in the active notebook. If no notebook is active, make one active.
     *
     * @param options The details about the code to run.
     *
     * @returns A promise that resolves to true if the code was executed, false if the request could not be fulfilled,
     *          because a notebook must be created first.
     */
    private editorRunCode = async (options: IEditorExtendedExecutionOptions): Promise<boolean> => {
        if (this.notebookRef.current) {
            if (options.language === "mysql") {
                await this.notebookRef.current.executeQueries({ params: options.params }, options.code, options.linkId);
            }

            return Promise.resolve(true);
        } else {
            // Either we don't have an editor at all or the active editor is a script.
            // In both cases, we need to activate or create a notebook first.

            // Check first if we have a notebook in our editor list.
            const { savedState } = this.props;
            const state = savedState.documentStates.find((e) => {
                return e.document.type === OdmEntityType.Notebook;
            });

            if (state) {
                // We have a notebook, so just activate it.
                await this.handleSelectItem(state.document);
            } else {
                // Otherwise, create a new notebook.
                await this.handleAddEditor();
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
            return this.scriptRef.current.executeWithMaximizedResult(details.content, details.forceSecondaryEngine);
        }

        return false;
    };

    private editorEditScript = (details: IScriptRequest): Promise<boolean> => {
        const { id, onSelectItem, connection } = this.props;

        // Create a new document entry for the script. Its parent will be set by the editor module.
        if (this.#documentDataModel) {
            const script = this.#documentDataModel.openDocument(undefined, {
                type: OdmEntityType.Script,
                parameters: {
                    pageId: id!,
                    id: uuid(),
                    connection: connection!.details,
                    caption: details.caption,
                    language: details.language,
                },
            });

            if (script) {
                onSelectItem?.({
                    tabId: id ?? "",
                    document: script,
                    content: details.content,
                });
            }
        }

        return Promise.resolve(true);
    };

    private editorLoadScript = (details: IScriptRequest): Promise<boolean> => {
        const { id, onLoadScript: onLoadEditor } = this.props;

        onLoadEditor?.(id ?? "", details.id, details.content);

        return Promise.resolve(true);
    };

    private editorRenameScript = (details: IScriptRequest): Promise<boolean> => {
        const { id, onEditorRename } = this.props;

        onEditorRename?.(id ?? "", details.id, details.caption);

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

    private cancelMrsAuthentication = async (request: IServicePasswordRequest): Promise<boolean> => {
        this.notebookRef.current?.focus();

        // Clear mrsLoginResult
        this.mrsLoginResult = undefined;

        // Manually trigger a refresh of the cached
        this.cachedMrsServiceSdk.schemaMetadataVersion = undefined;
        await this.updateMrsServiceSdkCache();

        // Get payload
        const payload: IMrsAuthRequestPayload = request.payload as IMrsAuthRequestPayload;
        if (payload?.contextId) {
            this.addContextResultMessage(payload.contextId, `\nAuthentication cancelled.`);

            return Promise.resolve(true);
        } else {
            return Promise.resolve(false);
        }
    };

    private acceptMrsAuthentication = async (
        data: { request: IServicePasswordRequest; password: string; }): Promise<boolean> => {

        this.notebookRef.current?.focus();

        try {
            // Get payload
            const payload: IMrsAuthRequestPayload = data.request.payload as IMrsAuthRequestPayload;

            if (data.request.service && payload.loginResult) {
                // Set mrsLoginResult so it can be added to each following execution context
                this.mrsLoginResult = payload.loginResult;

                // Manually trigger a refresh of the cached
                this.cachedMrsServiceSdk.schemaMetadataVersion = undefined;
                await this.updateMrsServiceSdkCache();

                if (payload.contextId && data.request.user) {
                    this.addContextResultMessage(payload.contextId,
                        `\nUser '${data.request.user}' logged in successfully.`);

                    return Promise.resolve(true);
                }
            } else /* istanbul ignore next */ {
                if (payload.contextId) {
                    this.addContextResultMessage(payload.contextId, `\nAuthentication cancelled.`);
                }
            }
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Accept Password Error: ${message}`, {});
        }

        return Promise.resolve(false);
    };

    /**
     * Either takes the given content and replaces the current notebook with it, or asks the user to select a notebook
     * file to load the content from.
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
                    caption: "",
                    content: "",
                    options: {},
                    viewState: null,
                    contexts: [],
                };
            } else {
                try {
                    content = JSON.parse(text);
                } catch (reason) {
                    void ui.showErrorMessage("The notebook file is not valid JSON.", {});

                    return;
                }
            }

            if (content.type !== "MySQLNotebook") {
                void ui.showErrorMessage("Invalid notebook content", {});
            } else {
                try {
                    this.loadingNotebook = true;

                    let openState = this.findActiveEditor();
                    if (!openState) {
                        const editorId = await this.handleAddEditor();
                        if (editorId) {
                            // Adding a new notebook will always make it the active editor.
                            openState = this.findActiveEditor();
                        }
                    }

                    const persistentState: IEditorPersistentState | undefined = openState?.state;
                    if (persistentState) {
                        const { id } = this.props;

                        // Replace the default caption with the one from the notebook file.
                        if (content.caption) {
                            openState!.document.caption = content.caption;
                        }
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

                    if (appParameters.embedded) {
                        this.setState({ standaloneMode: details?.standalone ?? false });
                    }
                } catch (error) {
                    this.loadingNotebook = false;
                    const message = convertErrorToString(error);
                    void ui.showErrorMessage(`Error while loading notebook: ${message}`, {});
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
                        void ui.showErrorMessage("Cannot read notebook file.", {});
                    }
                };

                reader.readAsText(file, "utf-8");
            }
        } else {
            await createNotebook(details.content);
        }

        return Promise.resolve(true);
    };

    private showLakehouseNavigator = async (): Promise<boolean> => {
        const { id, connection } = this.props;

        if (id && connection) {
            const document = this.#documentDataModel?.openDocument(undefined, {
                type: OdmEntityType.AdminPage,
                parameters: {
                    pageId: id,
                    id: uuid(),
                    connection: connection?.details,
                    pageType: "lakehouseNavigator",
                    caption: "Lakehouse Navigator",
                },
            });

            if (document) {
                void this.handleSelectItem(document);
            }
        }

        return Promise.resolve(true);
    };

    private showChatOptions = async (_: unknown): Promise<boolean> => {
        const { savedState, id, onChatOptionsChange } = this.props;

        if (id && onChatOptionsChange) {
            onChatOptionsChange(id, { chatOptionsExpanded: !savedState.chatOptionsState.chatOptionsExpanded });
        }

        return Promise.resolve(true);
    };

    /**
     * Serializes the current notebook to a JSON string and triggers save-to-file handling.
     * This can either be handled by the browser (not allowing to specify a target path) or by the host application
     * which has more freedom to allow the user to select a target path.
     *
     * @param source If set to "viaKeyboardShortcut" the requisition was sent from a keyboard shortcut
     *
     * @returns A promise that resolves to true if the notebook was saved, false if the request could not be fulfilled.
     *
     */
    private editorSaveNotebook = async (source?: string): Promise<boolean> => {
        const openState = this.findActiveEditor();

        if (openState) {
            const persistentState: IEditorPersistentState | undefined = openState.state;
            if (persistentState && persistentState.model.executionContexts) {
                const content: INotebookFileFormat = {
                    type: "MySQLNotebook",
                    version: currentNotebookVersion,
                    caption: openState.document.caption,
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
                    if (source === undefined) {
                        requisitions.executeRemote("editorSaveNotebook", text);
                    } else {
                        requisitions.executeRemote("editorSaveNotebookInPlace", text);
                    }
                } else {
                    // TODO: make the file name configurable.
                    const { caption } = this.props;
                    saveTextAsFile(text, `${caption ?? "<unnamed>"} - ${openState.document.caption}.mysql-notebook`);
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
        const { savedState, connection } = this.props;

        if (!connection?.backend) {
            return;
        }

        let pageSize = Settings.get("sql.limitRowCount", 1000);
        if (pageSize < 1 || pageSize > 100000) {
            pageSize = 1000;
        }

        await context.clearResult();
        if (savedState.mleEnabled) {
            // Reset MLE console log.
            void await connection.backend.execute("SELECT mle_session_reset()");
        }

        let statementCount = 0;
        let errorCount = 0;
        const startTime = Date.now();

        if (options.source) {
            const sql = (await context.getStatementAtPosition(options.source))?.text;

            await this.executeQuery(context, 0, 0, pageSize, options, sql ?? "");
        } else {
            const statements = await context.getExecutableStatements();

            // Count all statements that actually hold SQL to execute (ignoring statements only containing whitespace)
            const nonEmptyStatements = statements.filter((statement) => {
                return statement.text.trim() !== "";
            });
            statementCount = nonEmptyStatements.length;

            while (true) {
                // Allow toggling the stop-on-error during execution.
                const stopOnErrors = Settings.get("editor.stopOnErrors", true);
                const statement = statements.shift();
                if (!statement) {
                    break;
                }

                try {
                    await this.executeQuery(context, statement.index, 0, pageSize,
                        options, statement.text);
                } catch (e) {
                    errorCount += 1;
                    if (stopOnErrors) {
                        break;
                    } // Else ignore the error and continue.
                }

            }
        }

        // If MLE is enabled, collect all console.log() output and all errors.
        if (savedState.mleEnabled) {
            const consoleLog = await connection.backend.execute(`SELECT mle_session_state("stdout")`);
            if (consoleLog && consoleLog.rows && consoleLog.rows.length > 0
                && (consoleLog.rows[0] as string[])[0] !== "") {
                for (const row of consoleLog.rows) {
                    const outString = String((row as string[])[0]);
                    void await context.addResultData({
                        type: "text",
                        text: [{
                            type: MessageType.Info,
                            index: -1,
                            content: outString.trim() + "\n",
                            language: "json",
                        }],
                    }, { resultId: "" });
                }
            }

            const stackTrace = await connection?.backend?.execute(`SELECT mle_session_state("stack_trace")`);
            if (stackTrace && stackTrace.rows && stackTrace.rows.length > 0
                && (stackTrace.rows[0] as string[])[0] !== "") {
                for (const row of stackTrace.rows) {
                    const outString = String((row as string[])[0]);
                    void await context.addResultData({
                        type: "text",
                        text: [{
                            type: MessageType.Error,
                            index: -1,
                            content: outString.replace("<js> ", "Exception Stack Trace: ").trim() + "\n",
                            language: "ini",
                        }],
                    }, { resultId: "" });
                }
            }
        }

        const activeEditor = this.findActiveEditor();
        if (activeEditor?.document.type === OdmEntityType.Script && statementCount > 1) {
            const duration = formatTime((Date.now() - startTime) / 1000);
            const infoStr = errorCount > 0
                ? `, ${errorCount} error${errorCount > 1 ? "s" : ""} occurred.`
                : " successfully.";
            const symbol = errorCount > 0 ? "✕" : "✓";
            this.addTimedResult(context, {
                type: "text",
                text: [{
                    type: (errorCount > 0) ? MessageType.Error : MessageType.Success,
                    index: -1,
                    content: `${symbol} SQL Script execution completed in ${duration}. ` +
                        `${statementCount} statement${statementCount > 1 ? "s" : ""} executed${infoStr}`,
                    language: "ansi",
                }],
            }, { resultId: "" });
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
     * @param sql The query to execute.
     * @param oldResultId An optional ID which points to an existing result set. If given, this ID is used,
     *                    to replace that old result set with the new data. Otherwise a new result set is generated.
     *
     * @returns A promise which resolves when the query execution is finished.
     */
    private executeQuery = async (context: SQLExecutionContext, index: number, page: number, pageSize: number,
        options: IScriptExecutionOptions, sql: string, oldResultId?: string): Promise<void> => {

        if (sql.trim().length === 0) {
            return;
        }

        const { connection } = this.props;

        if (connection) {
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
                const result = await services.preprocessStatement(context, sql, offset, pageSize + 1,
                    options.forceSecondaryEngine);

                let pkColumns: string[] | undefined;
                if (result.updatable && result.fullTableName) {
                    pkColumns = await this.getPrimaryKeyColumns(result.fullTableName);
                }

                await this.doExecution({
                    query: result.query,
                    original: sql,
                    queryType,
                    params: actualParams,
                    context,
                    index,
                    explicitPaging: result.changed,
                    currentPage: page,
                    oldResultId,
                    showAsText: options.asText ?? false,
                    updatable: result.updatable,
                    fullTableName: result.fullTableName,
                    pkColumns,
                });
            } else {
                await this.doExecution({
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
                    updatable: false,
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
        const { id = "", connection } = this.props;

        let resultId = uuid();
        let replaceData = false;
        let subIndex: number | undefined;
        if (options.queryType === QueryType.Call) {
            subIndex = 0;
        }
        let exceptionThrown;

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
            const columnsMetadata = await getColumnsMetadataForEmptyResultSet(
                options.fullTableName, options.queryType, connection!.details.dbType, connection!.backend,
            );

            // Have to keep the column definition around for all data packages, for row conversion,
            // but must store it only once (when they come in, which happens only once).
            let columns: IColumnInfo[] = [];
            let setColumns = false;

            options.context.executionStarts();
            await connection!.backend.execute(options.query, options.params, undefined, (data) => {
                let hasMoreRows = false;
                let rowCount = 0;
                let status: IStatusInfo = { text: "" };
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

                    if (data.result.rowsAffected) {
                        status = {
                            text: `OK, ${formatWithNumber("row", data.result.rowsAffected)} affected in ` +
                                `${formatTime(data.result.executionTime)}`,
                        };
                    } else {
                        status = {
                            text: `OK, ${formatWithNumber("record", rowCount)} retrieved in ` +
                                `${formatTime(data.result.executionTime)}`,
                        };
                    }
                }

                if (!data.result.columns && rowCount === 0 && columnsMetadata.length) {
                    data.result.columns = columnsMetadata;
                }

                if (data.result.columns) {
                    columns = generateColumnInfo(connection!.details.dbType, data.result.columns);
                    setColumns = true;

                    // Check if all PK columns are part of the columns list.
                    if (options.updatable && options.fullTableName) {
                        if (options.pkColumns && options.pkColumns.length > 0) {
                            for (const pkColumn of options.pkColumns) {
                                const column = columns.find((c) => { return c.title === pkColumn; });
                                if (!column) {
                                    options.updatable = false;
                                    break;
                                } else {
                                    column.inPK = true;
                                }
                            }
                        } else {
                            // No primary key columns found -> table is not updatable.
                            options.updatable = false;
                        }
                    }
                }
                const rows = convertRows(columns, data.result.rows);

                if (options.showAsText) {
                    let content = "";
                    if (setColumns) {
                        let query = options.query.trim();
                        if (!query.endsWith(";")) {
                            query += ";";
                        }
                        content += `sql> ${query}\n`;
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
                        subIndex,
                        sql: options.original,
                        updatable: options.updatable,
                        fullTableName: options.fullTableName,
                    });

                    // Add row data directly to the context. Not via a timed result, as we need to ensure
                    // proper ordering of data rendering and column info updates that follow below.
                    void options.context.addResultData({
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
                        subIndex,
                        sql: options.original,
                        replaceData,
                        updatable: options.updatable,
                        fullTableName: options.fullTableName,
                    }, undefined, options.queryType);
                }

                if (resultSummary) {
                    // Trigger column details update for this result set.
                    if (options.queryType === QueryType.Select) {
                        if (options.updatable && !options.showAsText && options.fullTableName) {
                            const columnNames = columns.map((c) => { return c.title; });

                            // Don't wait for the update.
                            void this.updateColumnDetails(resultId, options.fullTableName, columnNames);
                        }
                    }

                    resultId = uuid();
                    if (options.queryType === QueryType.Call) {
                        ++subIndex!;
                    }
                }

                setColumns = false;
                replaceData = false;
            });

            this.handleDependentTasks(options);
        } catch (reason) {
            exceptionThrown = reason;

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
                if (reason.info.requestState.code) {
                    code = reason.info.requestState.code;
                } else {
                    // No code, but we have a message. Try to find a code in the message.
                    const match = content.match(/MySQL Error \((\d+)\)/);
                    if (match) {
                        code = parseInt(match[1], 10);
                    }

                    const scriptingErrorPrefix = "ScriptingError: ClassicSession.run_sql: \n";
                    if (content.startsWith(scriptingErrorPrefix)) {
                        content = content.substring(scriptingErrorPrefix.length).trim();
                        if (content.startsWith("Exception: ")) {
                            content = `ERROR: ${content.substring(11)}`;
                        }
                    }
                }
            } else {
                content = reason as string;

            }

            switch (code) {
                case 1201: {
                    type = MessageType.Warning;
                    content = "Cancelled: query was prematurely stopped";

                    break;
                }

                case 1064: { // Syntax error with line number.
                    // Replace the line number in the error message with the one that corresponds to the offset
                    // of the current query in the executing block.
                    const match = content.match(errorRexExp);
                    if (match) {
                        // First parse the given error line (they are one-based).
                        let line = parseInt(match[3], 10);

                        // Then add the offset of the query within the block. The query index is one-based too.
                        const statements = await options.context.getExecutableStatements();
                        const statement = statements[options.index - 1];
                        if (statement) {
                            line += statement.line;

                            // And we also have to account for leading line breaks, as they are not counted in the
                            // query.
                            const leadingLineBreaks = statement.text.match(leadingLineBreaksRegExp);
                            if (leadingLineBreaks) {
                                line += leadingLineBreaks[0].length;
                            }
                        }

                        content = content.replace(errorRexExp, (_str, group1: string) => {
                            return `${group1}${line}`;
                        });
                    }

                    break;
                }

                default:
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

        if (exceptionThrown !== undefined) {
            throw new Error(String(exceptionThrown));
        }
    };

    private runChatQuery = async (context: SQLExecutionContext, _options: IScriptExecutionOptions): Promise<void> => {
        const { savedState, connection } = this.props;

        // If there is no current chat, init the current chat options
        let currentChatOptions = savedState.chatOptionsState.options ?? {
            conversationId: uuid(),
            reportProgress: true,
        };

        if (connection && connection.backend.moduleSessionId) {
            const chatQueryId = context.id;
            currentChatOptions.reRun = false;
            if (currentChatOptions.chatHistory &&
                currentChatOptions.chatHistory.find((entry) => {
                    return entry.chatQueryId === chatQueryId;
                })) {
                currentChatOptions.reRun = true;
            }

            try {
                let tokens = "";

                // Take the current chat options, but set the chatQueryId
                const options: IDictionary = {
                    ...currentChatOptions,
                    chatQueryId,
                };
                context.presentation.executionStarts(LoadingState.Waiting);
                void await connection.backend.mhs.executeChatRequest(
                    context.code, connection.backend.moduleSessionId, options, (data) => {
                        let info;
                        const chatData = data.result.data;
                        if (chatData) {
                            if (chatData.error) {
                                this.addTimedResult(context, {
                                    type: "chat",
                                    error: chatData.error,
                                    chatQueryId,
                                }, {
                                    resultId: chatQueryId,
                                });

                                return;
                            }

                            currentChatOptions = {
                                ...currentChatOptions,
                                ...chatData,
                                info: undefined,
                            };

                            if (chatData.info) {
                                info = chatData.info;
                            }
                            if (chatData.usage) {
                                info = `Used ${chatData.usage?.usedUnits.inputTokens} input tokens, ` +
                                    `${chatData.usage?.usedUnits.outputTokens} output tokens.`;
                            }

                            // If tokens come in, concatenate them
                            if (chatData.token) {
                                tokens += chatData.token.replaceAll("\\n", "\n");
                                currentChatOptions.token = undefined;
                            } else if (chatData.response) {
                                tokens = chatData.response;
                                currentChatOptions.response = undefined;
                            }

                            void context.addResultData({
                                type: "chat",
                                chatQueryId,
                                info,
                                answer: tokens.trim(),
                                options: currentChatOptions as IDictionary,
                                chatOptionsVisible: savedState.chatOptionsState.chatOptionsExpanded,
                                updateOptions: this.updateChatOptionsState,
                            }, {
                                resultId: chatQueryId,
                            }).then(() => {
                                // Store chat options and refresh UI
                                this.updateChatOptionsState({ options: currentChatOptions });
                            });

                        }
                    });
            } catch (reason) {
                let content: string;

                if (reason instanceof ResponseError) {
                    content = reason.info.requestState.msg;
                } else {
                    content = reason as string;
                }

                const shellErrorHeader = "ScriptingError: genai.chat: \nException: ";
                if (content.startsWith(shellErrorHeader)) {
                    content = "Error: " + content.substring(shellErrorHeader.length);
                }

                this.addTimedResult(context, {
                    type: "chat",
                    chatQueryId,
                    error: content,
                }, {
                    resultId: chatQueryId,
                });
            }
        }
    };

    private updateChatOptionsState = (data: Partial<IChatOptionsState>): void => {
        const { id, onChatOptionsChange } = this.props;

        if (id && onChatOptionsChange) {
            onChatOptionsChange(id, data);
        }
    };

    private reconnect = async (context: ExecutionContext): Promise<void> => {
        const { connection } = this.props;

        if (connection) {
            try {
                await connection.backend.reconnect();
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
     * @param options The query execution options.
     */
    private handleDependentTasks = (options: IQueryExecutionOptions): void => {
        const { id, connection } = this.props;

        switch (options.queryType) {
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
                void connection?.backend.getCurrentSchema().then((schema) => {
                    if (schema) {
                        const details = connection.details;
                        requisitions.executeRemote("sqlSetCurrentSchema",
                            { id: id ?? "", connectionId: details.id, schema });
                        void requisitions.execute("sqlSetCurrentSchema",
                            { id: id ?? "", connectionId: details.id, schema });
                    }
                });

                break;
            }

            case QueryType.RestUse:
            case QueryType.Rest: {
                // Enforce a refresh of the MRS Sdk Cache
                this.cachedMrsServiceSdk.schemaMetadataVersion = undefined;
                void this.updateMrsServiceSdkCache().then(() => {
                    void requisitions.executeRemote("refreshConnection", undefined);
                });

                break;
            }

            default: {
                break;
            }
        }
    };

    /**
     * Helper to asynchronously update the column details for the given table.
     *
     * @param requestId The ID of the request that got results and needs the column info update.
     * @param fullTableName The full name of the table to update the column details for.
     * @param columnNames The names of all columns in the result set.
     */
    private async updateColumnDetails(requestId: string, fullTableName: string,
        columnNames: string[]): Promise<void> {
        const { connection } = this.props;

        const { schema, table } = await parseSchemaTable(fullTableName, connection?.backend);

        // Get all column names.
        const tableColumns = await connection?.backend.getTableObjectNames(schema, table, "Column");

        // Retrieve the column details for each column in the result set.
        const details: IColumnDetails = {
            resultId: requestId,
            columns: [],
        };

        for (const tableColumn of tableColumns ?? []) {
            if (columnNames.includes(tableColumn)) {
                const info = await connection?.backend.getTableObject(schema, table, "Column", tableColumn);
                if (info) {
                    details.columns.push({
                        inPK: info.isPk === 1,
                        default: info.default,
                        nullable: info.notNull === 0,
                        autoIncrement: info.autoIncrement === 1,
                    });
                }
            }
        }

        await requisitions.execute("sqlUpdateColumnInfo", details);
    }

    /**
     * Retrieves all columns that are part of the primary key for the given table.
     *
     * @param fullTableName The full name of the table to get the primary key columns for.
     *
     * @returns A promise that resolves to an array of column names that are part of the primary key.
     */
    private async getPrimaryKeyColumns(fullTableName: string): Promise<string[]> {
        const { connection } = this.props;

        const { schema, table } = await parseSchemaTable(fullTableName, connection?.backend);

        return connection?.backend.getTableObjectNames(schema, table, "Primary Key") ?? [];
    }

    private updateMrsServiceSdkCache = async (): Promise<boolean> => {
        const { connection } = this.props;

        if (connection) {
            // Check if there is an current MRS Service set and if so, get the corresponding MRSruntime SDK
            // for that MRS Service
            const statusBarItem = ui.createStatusBarItem();
            try {
                statusBarItem.text = "$(loading~spin) Checking MRS status ...";
                const serviceMetadata = await connection.backend.mrs.getCurrentServiceMetadata();

                // Check if there is a current MRS service set and if the cached
                if (serviceMetadata.id !== undefined && serviceMetadata.id !== null &&
                    serviceMetadata.hostCtx !== undefined && serviceMetadata.hostCtx !== null &&
                    serviceMetadata.metadataVersion !== undefined) {
                    if (this.cachedMrsServiceSdk.schemaId !== serviceMetadata.id ||
                        this.cachedMrsServiceSdk.schemaMetadataVersion !== serviceMetadata.metadataVersion) {
                        let firstLoad = false;
                        let authenticated = false;
                        let code = "";

                        // Add the mrsLoginResult constant at top, if defined
                        if (this.mrsLoginResult && this.mrsLoginResult.authApp && this.mrsLoginResult.jwt) {
                            code = "const mrsLoginResult = { " +
                                `authApp: "${this.mrsLoginResult.authApp}", jwt: "${this.mrsLoginResult.jwt}" };\n`;
                            authenticated = true;
                        }

                        // Fetch SDK BaseClasses only once
                        if (this.cachedMrsServiceSdk.baseClasses === undefined) {
                            statusBarItem.text = "$(loading~spin) Loading MRS SDK Base Classes ...";
                            this.cachedMrsServiceSdk.baseClasses =
                                await connection.backend.mrs.getSdkBaseClasses("TypeScript", true);
                            firstLoad = true;
                        }

                        // Fetch new SDK Service Classes and build full code
                        statusBarItem.text = `$(loading~spin) ${firstLoad
                            ? "Loading"
                            : "Refreshing"} MRS SDK for ${serviceMetadata.hostCtx}...`;
                        if (this.cachedMrsServiceSdk.serviceUrl === undefined) {
                            if (!serviceMetadata.hostCtx.toLowerCase().startsWith("http")) {
                                const service = await connection.backend.mrs.getService(
                                    serviceMetadata.id, null, null, null, null);
                                const routerPort = getRouterPortForConnection(connection.details.id);

                                this.cachedMrsServiceSdk.serviceUrl =
                                    `https://localhost:${routerPort}${service.urlContextRoot}`;
                            } else {
                                this.cachedMrsServiceSdk.serviceUrl = serviceMetadata.hostCtx;
                            }
                        }

                        code += this.cachedMrsServiceSdk.baseClasses + "\n" +
                            await connection.backend.mrs.getSdkServiceClasses(
                                serviceMetadata.id, "TypeScript", true, this.cachedMrsServiceSdk.serviceUrl);

                        // Update this.cachedMrsServiceSdk
                        this.cachedMrsServiceSdk.code = code;
                        this.cachedMrsServiceSdk.codeLineCount = (code.match(/\n/gm) ?? []).length + 1;
                        this.cachedMrsServiceSdk.schemaId = serviceMetadata.id;
                        this.cachedMrsServiceSdk.schemaMetadataVersion = serviceMetadata.metadataVersion;

                        const libVersionNotebook = this.notebookRef.current?.addOrUpdateExtraLib(
                            this.cachedMrsServiceSdk.code, `mrsServiceSdk.d.ts`) ?? 0;
                        this.scriptRef.current?.addOrUpdateExtraLib(
                            this.cachedMrsServiceSdk.code, `mrsServiceSdk.d.ts`);

                        const action = firstLoad ? "loaded" : ("refreshed (v" + String(libVersionNotebook) + ")");
                        const authInfo = authenticated ? " User authenticated." : "";
                        void ui.setStatusBarMessage(`MRS SDK for ${serviceMetadata.hostCtx} has been ` +
                            `${action}.${authInfo}`);
                    }
                    statusBarItem.dispose();
                } else if (serviceMetadata.metadataVersion !== undefined) {
                    // If no current MRS service set, clean the cachedMrsServiceSdk and just load the MRS runtime
                    // management code
                    this.cachedMrsServiceSdk = {};

                    statusBarItem.text = "$(loading~spin) Loading MRS Management Classes ...";

                    const code = await connection.backend.mrs.getRuntimeManagementCode();
                    this.cachedMrsServiceSdk.codeLineCount = (code.match(/\n/gm) ?? []).length + 1;

                    this.cachedMrsServiceSdk.code = code;

                    this.notebookRef.current?.addOrUpdateExtraLib(code, `mrsServiceSdk.d.ts`);
                    this.scriptRef.current?.addOrUpdateExtraLib(code, `mrsServiceSdk.d.ts`);

                    statusBarItem.dispose();
                    ui.setStatusBarMessage(`MRS Management Classes have been loaded.`);
                } else {
                    // If MRS is not enabled, just clear the statusbar
                    statusBarItem.dispose();
                }

                return true;
            } catch (e) {
                statusBarItem.dispose();

                // Ignore exception when MRS is not configured.
                const message = convertErrorToString(e);
                void ui.showErrorMessage(`MRS SDK Error: ${message}`, {});

                return false;
            }
        } else {
            return false;
        }
    };

    private getGenAiStatus = async () => {
        const { connection } = this.props;

        if (connection?.backend?.moduleSessionId) {
            const genAiStatus = await connection.backend.mhs.getMdsGetGenAiStatus(connection.backend.moduleSessionId);
            this.setState({ genAiStatus });
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
        const { workerPool, savedState, connection } = this.props;

        const command = context.code?.trim() ?? "";
        if (command.length === 0) {
            return false;
        }

        this.runningContexts.set(context.id, context);

        const parts = command.split(" ");
        if (parts.length > 0) {
            const temp = parts[0].toLowerCase();
            switch (temp) {
                case "\\about": {
                    if (savedState.heatWaveEnabled) {
                        await context?.addResultData({
                            type: "about",
                            title: "HeatWave Chat",
                        }, { resultId: "" });
                    } else {
                        const isMac = navigator.userAgent.includes("Macintosh");
                        const content = DBConnectionTab.aboutMessage.replace("%modifier%", isMac ? "Cmd" : "Ctrl");
                        await context?.addResultData({
                            type: "text",
                            text: [{ type: MessageType.Info, content, language: "ansi" }],
                        }, { resultId: "" });
                    }

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

        await context.clearResult();

        // Store this execution in the ExecutionHistory list for the connection in the backend database
        if (connection && connection.backend) {
            try {
                await connection.backend?.addExecutionHistoryEntry(connection.details.id, context.code,
                    context.language);

                // Reset the currentExecutionHistoryIndex
                savedState.currentExecutionHistoryIndex = 0;

                this.forceUpdate();
            } catch (error) {
                const message = convertErrorToString(error);
                void ui.showErrorMessage(`Unable to create execution history entry. Error: ${message}`, {});
            }
        }

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

                const usesAwait = context.code.includes("await ");

                // Execute the code
                workerPool.runTask({
                    api: ScriptingApi.Request,
                    // Detect if the code includes "await " and if so, wrap the code in a self-executing async function.
                    // This is done to allow direct execution of awaits on async functions.
                    // Further, the temporary string "\nexport{}\n" is removed from the code.
                    // Please note that the libCodeLineNumbers need to be adjusted accordingly.
                    // See EmbeddedPresentationInterface.tsx for details.
                    libCodeLineNumbers: (this.cachedMrsServiceSdk.codeLineCount
                        ? this.cachedMrsServiceSdk.codeLineCount - 1 : 0) +
                        (usesAwait ? 1 - 2 + 2 : 0),
                    code: ts.transpile((this.cachedMrsServiceSdk.code ?? "") +
                        (usesAwait
                            ? "(async () => {\n" + context.code + "})()"
                            : context.code), {
                        alwaysStrict: true,
                        target: ScriptTarget.ES2022,
                        inlineSourceMap: true,
                    }),
                    contextId: context.id,
                    globalScriptingObject: this.#globalScriptingObject,
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

            case "text": {
                await this.runChatQuery(context as SQLExecutionContext, options);
                break;
            }

            default:
        }

        return true;
    };

    private handleContextLanguageChange = (context: ExecutionContext, language: EditorLanguage): void => {
        const { savedState, onChatOptionsChange, id } = this.props;

        switch (language) {
            case "text": {
                if (!savedState.chatOptionsState.chatOptionsExpanded && onChatOptionsChange !== undefined
                    && id) {
                    onChatOptionsChange(id, { chatOptionsExpanded: true });
                }

                break;
            }

            default:
        }
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
        const { connection } = this.props;

        if (!connection) {
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
            await connection.backend.execute("SET @old_optimizer_trace = @@optimizer_trace, " +
                "@old_optimizer_trace_offset = @@optimizer_trace_offset, @@optimizer_trace = \"enabled=on\", " +
                "@@optimizer_trace_offset = -2;");

            // Run the query on the primary engine.
            await connection.backend.execute(sql);

            // Now we can read the optimizer trace to get the details.
            const result = await connection.backend.execute("SELECT QUERY, TRACE->'$**.Rapid_Offload_Fails', " +
                "TRACE->'$**.secondary_engine_not_used' FROM INFORMATION_SCHEMA.OPTIMIZER_TRACE;");

            // Restore the previous trace status.
            await connection.backend.execute("SET @@optimizer_trace = @old_optimizer_trace, " +
                "@@optimizer_trace_offset = @old_optimizer_trace_offset;", [], resultId);

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
        const { workerPool, connection } = this.props;

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
                    if (connection) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        let columns: ITableColumn[] = [];
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
                            const finalData = await connection.backend.execute(data.code!, data.params as string[],
                                uuid(), (data) => {
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
                    if (connection) {
                        // Make sure the task we are running currently on, stays assigned to this loop.
                        workerPool.retainTask(taskId);

                        try {
                            const finalData = await connection.backend.execute(data.code!, data.params as string[],
                                undefined, (intermediateData) => {
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

                case ScriptingApi.SetGlobalObjectProperty: {
                    const context = this.runningContexts.get(data.contextId);

                    if (data.name !== undefined && context) {
                        this.#globalScriptingObject[data.name] = data.value;
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

                case ScriptingApi.MrsPrintSdkCode: {
                    const context = this.runningContexts.get(data.contextId);

                    if (this.cachedMrsServiceSdk.code && context) {
                        const sdkCode = this.cachedMrsServiceSdk.code;
                        const codeLines = sdkCode.split("\n");
                        let formattedSdkCode = "";
                        let lnCounter = 1;
                        for (const ln of codeLines) {
                            formattedSdkCode += `${lnCounter++} `.padStart(5, " ")
                                + ln.replaceAll("\t", " ".repeat(2)) + "\n";
                        }

                        await context.addResultData({
                            type: "text",
                            text: [{
                                type: MessageType.Info,
                                content: formattedSdkCode,
                            }],
                        }, { resultId: "" });
                    }

                    break;
                }

                case ScriptingApi.MrsSetCurrentService: {
                    if (connection && data.serviceId && typeof data.serviceId === "string") {
                        await connection.backend.mrs.setCurrentService(data.serviceId);

                        await this.updateMrsServiceSdkCache();

                        void requisitions.executeRemote("refreshConnection", undefined);
                    }

                    break;
                }

                case ScriptingApi.MrsEditService: {
                    if (connection && data.serviceId && typeof data.serviceId === "string") {
                        const service = await connection.backend.mrs.getService(data.serviceId, null, null, null, null);
                        if (service !== undefined) {
                            void requisitions.execute("showMrsServiceDialog", service);
                        }

                    } else {
                        void requisitions.execute("showMrsServiceDialog", undefined);
                    }

                    break;
                }

                case ScriptingApi.MrsExportServiceSdk: {
                    if (connection && data.serviceId && typeof data.serviceId === "string") {
                        const service = await connection.backend.mrs.getService(data.serviceId, null, null, null, null);
                        if (service !== undefined) {
                            void requisitions.execute("showMrsSdkExportDialog", {
                                serviceId: data.serviceId,
                                connectionId: connection.details.id,
                            });
                        }

                    }

                    break;
                }

                case ScriptingApi.MrsAddContentSet: {
                    if (connection && data.serviceId && typeof data.serviceId === "string") {
                        const service = await connection.backend.mrs.getService(data.serviceId, null, null, null, null);
                        if (service !== undefined) {
                            void requisitions.execute("showMrsContentSetDialog", {
                                serviceId: data.serviceId,
                                directory: data.directory,
                                connectionId: connection.details.id,
                            });
                        }

                    }

                    break;
                }

                case ScriptingApi.MrsSetServiceUrl: {
                    // Reset the cache to trigger a complete reload
                    this.cachedMrsServiceSdk = {
                        serviceUrl: data.serviceUrl,
                    };
                    await this.updateMrsServiceSdkCache();

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

                case ScriptingApi.MrsEditSchema: {
                    if (connection && data.schemaId && typeof data.schemaId === "string") {
                        const schema = await connection.backend.mrs.getSchema(data.schemaId);
                        if (schema !== undefined) {
                            const editRequest: IMrsSchemaEditRequest = {
                                schemaName: schema.name,
                                schema,
                            };
                            void requisitions.execute("showMrsSchemaDialog", editRequest);
                        }

                    }

                    break;
                }

                case ScriptingApi.MrsEditDbObject: {
                    if (connection && data.dbObjectId && typeof data.dbObjectId === "string") {
                        const dbObject = await connection.backend.mrs.getDbObject(data.dbObjectId);
                        if (dbObject !== undefined) {
                            const editRequest: IMrsDbObjectEditRequest = {
                                dbObject,
                                createObject: false,
                            };
                            void requisitions.execute("showMrsDbObjectDialog", editRequest);
                        }

                    }

                    break;
                }

                case ScriptingApi.MrsRefreshSdkCode: {
                    this.cachedMrsServiceSdk.schemaMetadataVersion = undefined;

                    await this.updateMrsServiceSdkCache();

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

    private handleSelectItem = async (
        entry: LeafDocumentEntry | IOdmStandaloneDocumentEntry | IOdmShellSessionEntry): Promise<void> => {
        const { id = "", onSelectItem } = this.props;

        const canClose = await this.canClose();
        if (canClose) {
            return onSelectItem?.({ tabId: id, document: entry });
        }
    };

    private handleAddEditor = (): Promise<string | undefined> => {
        const { id, onAddEditor } = this.props;

        return new Promise((resolve) => {
            void this.canClose().then((canClose) => {
                if (canClose) {
                    resolve(onAddEditor?.(id ?? ""));
                }
            });
        });
    };

    private handleGraphDataChange = (data: ISavedGraphData): void => {
        const { id, onGraphDataChange } = this.props;

        onGraphDataChange?.(id ?? "", data);
    };

    private handleLakehouseNavigatorStateChange = (data: Partial<ILakehouseNavigatorSavedState>): void => {
        const { id, onSaveAdminLakehouseNavigatorState } = this.props;

        onSaveAdminLakehouseNavigatorState?.(id ?? "", data);
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
                        value = String(row[column.field]);

                        break;
                    }
                }

                row[column.field] = value;
                let length = value.length;

                // Check if the value has line breaks, if so, find the longest line
                if (/\r|\n/.exec(value)) {
                    let maxLength = 0;
                    const lines = value.split(/\r|\n/);
                    for (const ln of lines) {
                        if (ln.length > maxLength) {
                            maxLength = ln.length;
                        }
                    }
                    length = maxLength;
                }
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

                if (/\r|\n/.exec(String(row[current.field]))) {
                    let multiLineStr = previous;
                    let pre = "| ";
                    let post = " ";
                    columns.forEach((c, i) => {
                        if (i < index) {
                            pre += `${" ".repeat(c.width!)} | `;
                        } else if (i > index) {
                            post += `${" ".repeat(c.width!)} | `;
                        }
                    });

                    pre = pre.slice(0, -1);
                    post = post.slice(0, -1);

                    const lines = String(row[current.field]).split(/\r|\n/);
                    lines.forEach((ln, i) => {
                        if (i > 0) {
                            multiLineStr += pre;
                        }
                        multiLineStr += ` ${ln}${" ".repeat(columns[index].width! - ln.length)} |`;
                        if (i < lines.length - 1) {
                            multiLineStr += post + "\n";
                        }
                    });

                    return multiLineStr;
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
    private findActiveEditor = (): IOpenDocumentState | undefined => {
        const { savedState } = this.props;
        let activeEditor = savedState.documentStates.find((entry): boolean => {
            return entry.document.id === savedState.activeEntry;
        });

        if (!activeEditor && savedState.documentStates.length > 0) {
            activeEditor = savedState.documentStates[0];
        }

        return activeEditor;
    };

    private handleChatAction = (action: ChatOptionAction, _options?: IMdsChatData): void => {
        const { savedState } = this.props;

        switch (action) {
            case ChatOptionAction.SaveChatOptions: {
                if (appParameters.embedded) {
                    const options = {
                        id: "saveChatOptions",
                        title: "Save Chat Profile",
                        saveLabel: "Save",
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            HeatWaveChatOptions: ["json"],
                        },
                    };
                    requisitions.executeRemote("showSaveDialog", options);
                }

                break;
            }
            case ChatOptionAction.LoadChatOptions: {
                if (appParameters.embedded) {
                    const options = {
                        id: "loadChatOptions",
                        title: "Load Chat Profile",
                        saveLabel: "Load",
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            HeatWaveChatOptions: ["json"],
                        },
                    };
                    requisitions.executeRemote("showOpenDialog", options);
                }

                break;
            }
            case ChatOptionAction.StartNewChat: {
                // Start new chat but keep schemaName and modelId
                this.updateChatOptionsState({
                    options: {
                        schemaName: savedState.chatOptionsState.options?.schemaName,
                        modelOptions: {
                            modelId: savedState.chatOptionsState.options?.modelOptions?.modelId,
                        },
                    },
                });

                break;
            }

            default:
        }
    };

    private selectFile = async (fileResult: IOpenFileDialogResult): Promise<boolean> => {
        const { savedState, id, connection, onChatOptionsChange } = this.props;

        switch (fileResult.resourceId) {
            case "saveChatOptions": {
                if (fileResult.path.length === 1) {
                    // Save Chat Profile options
                    const options: IDictionary = {
                        ...savedState.chatOptionsState.options,
                    };
                    try {
                        void await connection?.backend.mhs.saveMdsChatOptions(fileResult.path[0], options);

                        void ui.showInformationMessage(
                            `The HeatWave options have been saved successfully to ${fileResult.path[0]}`, {});
                    } catch (reason) /* istanbul ignore next */ {
                        let content: string;

                        if (reason instanceof ResponseError) {
                            content = reason.info.requestState.msg;
                        } else {
                            content = reason as string;
                        }

                        const shellErrorHeader = "ScriptingError: genai.save_chat_options: \nException: ";
                        if (content.startsWith(shellErrorHeader)) {
                            content = "Error: " + content.substring(shellErrorHeader.length);
                        }

                        void ui.showErrorMessage(content, {});
                    }
                }


                break;
            }

            case "loadChatOptions": {
                if (fileResult.path.length === 1) {
                    try {
                        // Load Chat Profile options
                        const options = await connection?.backend.mhs.loadMdsChatOptions(fileResult.path[0]);

                        if (id && onChatOptionsChange) {
                            onChatOptionsChange(id, { options });

                            void ui.showInformationMessage(
                                `The HeatWave options have been loaded successfully from ${fileResult.path[0]}`, {});
                        }
                    } catch (reason) /* istanbul ignore next */ {
                        let content: string;

                        if (reason instanceof ResponseError) {
                            content = reason.info.requestState.msg;
                        } else {
                            content = reason as string;
                        }

                        const shellErrorHeader = "ScriptingError: genai.load_chat_options: \nException: ";
                        if (content.startsWith(shellErrorHeader)) {
                            content = "Error: " + content.substring(shellErrorHeader.length);
                        }

                        void ui.showErrorMessage(content, {});
                    }
                }
                break;
            }

            default:
        }

        return Promise.resolve(true);
    };

    private handleNavigateHistory = (backwards: boolean): void => {
        const { savedState, connection } = this.props;

        if (!this.notebookRef.current) {
            return;
        }

        if (connection) {
            const currentContext = this.notebookRef.current.currentContext;

            // Store the unsaved current block code before moving back in history.
            if (savedState.currentExecutionHistoryIndex === 0 && backwards) {
                savedState.executionHistoryUnsavedCode = currentContext?.code;
                savedState.executionHistoryUnsavedCodeLanguage = currentContext?.language;
            }

            // Restore unsaved current block code when the user moves forward to the current statement again
            if (savedState.currentExecutionHistoryIndex === 1 && !backwards) {
                const historyEntry = {
                    index: savedState.currentExecutionHistoryIndex,
                    code: savedState.executionHistoryUnsavedCode ?? "",
                    languageId: savedState.executionHistoryUnsavedCodeLanguage ?? "sql",
                    currentTimestamp: new Date().toISOString(),
                };

                this.notebookRef.current?.restoreHistoryState(historyEntry);
                savedState.currentExecutionHistoryIndex = 0;
            } else {
                // Load the next/prev history entry and restore the state in the notebook.
                savedState.currentExecutionHistoryIndex += backwards ? +1 : -1;
                void connection.backend.getExecutionHistoryEntry(connection.details.id,
                    savedState.currentExecutionHistoryIndex - 1).then((historyEntry) => {
                        this.notebookRef.current?.restoreHistoryState(historyEntry);
                    });
            }
        }
    };
}
