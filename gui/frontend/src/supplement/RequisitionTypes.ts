/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import type {
    EditorLanguage, IExecutionContext, INewEditorRequest, IScriptRequest, ISqlPageRequest,
} from "./index.js";

import type {
    IDialogRequest, IDialogResponse, IDictionary, IServicePasswordRequest,
} from "../app-logic/general-types.js";
import type { IEmbeddedMessage, IMySQLDbSystem } from "../communication/index.js";
import type { IShellProfile, IShellPromptValues, IWebSessionData } from "../communication/ProtocolGui.js";
import type {
    IMrsAuthAppData, IMrsContentSetData, IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../communication/ProtocolMrs.js";

import type { IThemeChangeData } from "../components/Theming/ThemeManager.js";
import type { StatusBarAlignment } from "../components/ui/Statusbar/StatusBarItem.js";
import type { ConnectionDataModelEntry, ICdmConnectionEntry } from "../data-models/ConnectionDataModel.js";
import type { AdminPageType } from "../data-models/data-model-types.js";
import type { OdmEntityType } from "../data-models/OpenDocumentDataModel.js";
import type { IConnectionDetails, IShellSessionDetails } from "./ShellInterface/index.js";

export interface IAppParameters {
    /** Indicates if the app runs under control of a wrapper app (a web client control embedded in a desktop app). */
    embedded?: boolean;

    /** Indicates if the app runs in the VS Code extension. */
    inExtension?: boolean;

    /** Set when debugging of the web app (not the extension) is ongoing. */
    inDevelopment?: boolean;

    /** Indicates if unit tests are running. */
    testsRunning?: boolean;

    /** The communication debugger is by default off while running tests. This flag allows to switch it on. */
    launchWithDebugger?: boolean;

    /** The application font size as requested */
    fontSize?: number;

    /** The font size for the code editors */
    editorFontSize?: number;
}

export type SimpleCallback = (_: unknown) => Promise<boolean>;

/**
 * Information to use when frontend components want to update their statusbar items.
 * Only used in embedded scenarios.
 */
export interface IUpdateStatusBarItem {
    /**
     * A unique identifier for the item. If `show` is specified as state and no item with the given id is found,
     * a new item will be created. In all other cases the request is ignored if the id is not valid.
     */
    id: string;

    /** What to do with the item? Create and show it, show it, hide it, dispose of it or keep the current state. */
    state: "show" | "hide" | "dispose" | "keep";

    /**
     * The text to show. If nothing is given the current text stays.
     */
    text?: string;

    alignment?: StatusBarAlignment;

    priority?: number;

    /** The text of the tooltip. If nothing is given the current tooltip is kept as is. */
    tooltip?: string;

    /** A timeout to auto hide the item, when given. Only considered when a new item is created. */
    timeout?: number;
}

export interface IOpenDialogFilters {
    [key: string]: string[];
}

/** This is essentially a copy of the VS Code OpenDialogOptions interface. */
export interface IOpenDialogOptions {
    /** A unique ID which identifies the request. */
    id?: string;

    /** The resource the dialog shows when opened. */
    default?: string;

    /** A human-readable string for the open button. */
    openLabel?: string;

    /** Allow to select files, defaults to `true`. */
    canSelectFiles?: boolean;

    /** Allow to select folders, defaults to `false`. */
    canSelectFolders?: boolean;

    /** Allow to select many files or folders. */
    canSelectMany?: boolean;

    /**
     *  A set of file filters that are used by the dialog. For example:
     * 'Images': ['png', 'jpg']
     *  'TypeScript': ['ts', 'tsx']
     */
    filters?: IOpenDialogFilters;

    /**
     * Dialog title. This parameter might be ignored, as not all operating systems display a title on
     * open dialogs (for example, macOS).
     */
    title?: string;
}

/** This is essentially a copy of the VS Code SaveDialogOptions interface. */
export interface ISaveDialogOptions {
    /** A unique ID which identifies the request. */
    id?: string;

    /**
     * The resource the dialog shows when opened.
     */
    default?: string;

    /**
     * A human-readable string for the save button.
     */
    saveLabel?: string;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human-readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *     'Images': ['png', 'jpg']
     *     'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[]; };

    /**
     * Dialog title.
     *
     * This parameter might be ignored, as not all operating systems display a title on save dialogs
     * (for example, macOS).
     */
    title?: string;
}

/** The structure describing the files the user selected when running the open dialog in the application host. */
export interface IOpenFileDialogResult {
    resourceId: string;
    path: string[];
}

/**
 * Options for all code execution requests. They are usually executed in the currently active execution context
 * (in the code editor), but can also be executed in a different context (like for chats).
 */
export interface IEditorCommonExecutionOptions {
    /** If true then execute only the statement at the caret position. This is valid only for SQL like languages. */
    atCaret?: boolean;

    /** If true, move the caret to the next block.If there's no block, create a new one first. */
    advance?: boolean;

    /** Tells the executor to add a hint to SELECT statements to use the secondary engine(usually HeatWave). */
    forceSecondaryEngine?: boolean;

    /** When true render the query and the result as plain text. */
    asText?: boolean;

    /** Any additional named parameters for placeholders in the code. */
    params?: Array<[string, string]>;

    /** An explicit context to execute in. */
    context?: IExecutionContext;
}

/**
 * Options for executing code in special situations (code broadcast, menu commands, extension code blocks etc.)
 * where the actual execution happens in another context (which is determined dynamically).
 */
export interface IEditorExtendedExecutionOptions extends IEditorCommonExecutionOptions {
    /** The language of the code in the text field. */
    language: EditorLanguage;

    /** The code to execute. */
    code: string;

    linkId?: number;
}

/** Details when executing an embedded SQL query. */
export interface ICodeBlockExecutionOptions {
    /** Mandatory: the id of the code block. */
    linkId: number;

    /** The id of the connection to use for execution. */
    connectionId: number;

    /** The tile to use if the request required opening a new notebook. */
    caption: string;

    /** The statement to execute. */
    query: string;

    /** Any additional named parameters for placeholders in the code. */
    params?: Array<[string, string]>;
}

/** A special set of data for the communication debugger/listener. */
export interface IDebuggerData {
    request?: INativeShellRequest;
    response?: INativeShellResponse;
}

/** The data sent when opening an editor. */
export interface IDocumentOpenData {
    /** The id of the page which will host the new document. Can be a connection tab or a standalone tab. */
    readonly pageId: string;

    /** Has to be set to allow creating a data model entry for the document, if needed. */
    readonly connection?: IConnectionDetails;

    /**
     * Details about the document that's being handled. This can be used to create data model entries.
     */
    readonly documentDetails: {
        /** The id to use for the new document. For standalone documents this is the same as the pageId. */
        readonly id: string;

        readonly type: OdmEntityType;

        /** Only used for admin entity types. */
        readonly pageType?: AdminPageType;

        /** Only used for script entries. */
        readonly language?: EditorLanguage;

        readonly caption: string;
        readonly alternativeCaption?: string;
    };
}

/** The data sent when an editor is being closed by the app. */
export interface IDocumentCloseData {
    /** The id of the hosting page for the connection. */
    readonly pageId: string;

    /**
     * The document that is being closed. For standalone documents this is the same as the pageId.
     * If no id is given it means the tab itself is being closed.
     */
    readonly id?: string;

    /**
     * Set for all documents that require a connection (like notebooks). This is useful for code parts that track
     * documents per connection.
     */
    readonly connectionId?: number;
}

/**
 * A web view provider is a class that hosts the application in embedded scenarios. For browser based situations
 * no provider is used (or necessary). There's always exactly one provider per app instance.
 */
export interface IWebviewProvider {
    caption: string;

    close(): void;
    runCommand<K extends keyof IRequestTypeMap>(requestType: K, parameter: IRequisitionCallbackValues<K>,
        caption: string, reveal: boolean): Promise<boolean>;
}

/**
 * The request sent from a webview provider to the app requisition instance, when it received notifications
 * from its local requisition instance.
 */
export interface IProxyRequest {
    /** The provider which sent this request. */
    provider: IWebviewProvider;

    /** The request to be forwarded. */
    original: IRequestListEntry<keyof IRequestTypeMap>;
}

export type InitialEditor = "default" | "none" | "notebook" | "script";

export interface IMrsDbObjectEditRequest extends IDictionary {
    dbObject: IMrsDbObjectData;
    createObject: boolean;
}

export interface IMrsSchemaEditRequest extends IDictionary {
    schemaName?: string;
    schema?: IMrsSchemaData;
}

export interface IMrsContentSetEditRequest extends IDictionary {
    directory?: string;
    contentSet?: IMrsContentSetData;
    requestPath?: string;
}

export interface IMrsAuthAppEditRequest extends IDictionary {
    authApp?: IMrsAuthAppData;
    service?: IMrsServiceData;
}

export interface IMrsUserEditRequest extends IDictionary {
    authApp: IMrsAuthAppData;
    user?: IMrsUserData;
}

export interface IMrsSdkExportRequest extends IDictionary {
    serviceId: string;
    connectionId: number;
    connectionDetails?: IConnectionDetails;
    directory?: string;
}

/**
 * Information about the columns of a result set that must be determined separately.
 * When a new result set is opened, only limited column information is available (mostly the title and order).
 * For other tasks we need more details, like if a column is part of the primary key, if it's nullable, etc.
 */
export interface IColumnDetails {
    resultId: string;
    columns: Array<{
        /** Is this column part of the primary key? */
        inPK: boolean;

        autoIncrement: boolean;

        /** Can values of this column be set to null? */
        nullable: boolean;

        /** The default value as defined in the table creation. */
        default?: unknown;
    }>;
}

/** Defines an interface to use for executing remote requisition requests. */
export interface IRemoteTarget {
    /** Remote target is a HTML window (usually the host in embedded scenarios). */
    postMessage?: (data: IEmbeddedMessage, origin: string) => void;

    /** Remote target is code that does different handling of a request, like sending it out to yet another target. */
    broadcastRequest?: <K extends keyof IRequestTypeMap>(sender: IWebviewProvider | undefined,
        requestType: K, parameter: IRequisitionCallbackValues<K>) => Promise<void>;
}

/** A generic type to extract the (single) callback parameter type from the callback map. */
export type IRequisitionCallbackValues<K extends keyof IRequestTypeMap> = Parameters<IRequestTypeMap[K]>[0];

export interface IRequestListEntry<K extends keyof IRequestTypeMap> {
    requestType: K;
    parameter: IRequisitionCallbackValues<K>;
}

/**
 * Describes a job entry, which is a request that must be executed sequentially.
 */
export interface IJobEntry<K extends keyof IRequestTypeMap> {
    requestType: K;
    parameter: Parameters<IRequestTypeMap[K]>[0];
}

export interface IHostThemeData {
    css: string;
    themeClass: string;
    themeName: string;
    themeId: string;
}

/**
 * A map containing possible requests and their associated callback.
 * The return value in the promise determines if the request was handled or not.
 *
 * Watch out when adding new callbacks! There must be exactly one parameter, because of the way we extract parameters
 * in `IRequisitionCallbackValues`.
 */
export interface IRequestTypeMap {
    "applicationDidStart": SimpleCallback;
    "applicationWillFinish": SimpleCallback;
    "socketStateChanged": (connected: boolean) => Promise<boolean>;
    "webSessionStarted": (data: IWebSessionData) => Promise<boolean>;
    "userAuthenticated": (activeProfile: IShellProfile) => Promise<boolean>;

    "profileLoaded": SimpleCallback;
    "changeProfile": (id: string | number) => Promise<boolean>;

    "statusBarButtonClick": (values: { type: string; event: MouseEvent | KeyboardEvent; }) => Promise<boolean>;
    "updateStatusBarItem": (details: IUpdateStatusBarItem) => Promise<boolean>;

    "themeChanged": (data: IThemeChangeData) => Promise<boolean>;

    /** Used only within the frontend, to open or activate a connection tab for the given connection entry. */
    "openConnectionTab": (
        data: { connection: ICdmConnectionEntry; force: boolean; initialEditor: InitialEditor; }) => Promise<boolean>;

    "selectFile": (result: IOpenFileDialogResult) => Promise<boolean>;
    "showOpenDialog": (options: IOpenDialogOptions) => Promise<boolean>;
    "showSaveDialog": (options: ISaveDialogOptions) => Promise<boolean>;

    "sqlShowDataAtPage": (data: ISqlPageRequest) => Promise<boolean>;

    /** Sent when new column details are available for a specific result set. */
    "sqlUpdateColumnInfo": (data: IColumnDetails) => Promise<boolean>;

    "editorCaretMoved": (position: { lineNumber: number; column: number; }) => Promise<boolean>;
    "editorExecuteSelectedOrAll": (options: IEditorCommonExecutionOptions) => Promise<boolean>;
    "editorExecute": (options: IEditorCommonExecutionOptions) => Promise<boolean>;
    "editorExecuteCurrent": (options: IEditorCommonExecutionOptions) => Promise<boolean>;
    "editorExecuteOnHost": (options: IEditorExtendedExecutionOptions) => Promise<boolean>;
    "editorFind": SimpleCallback;
    "editorFormat": SimpleCallback;
    "editorRunCommand": (details: { command: string; context: IExecutionContext; }) => Promise<boolean>;
    "editorToggleStopExecutionOnError": (active: boolean) => Promise<boolean>;
    "editorStopExecution": SimpleCallback;
    "editorToggleAutoCommit": SimpleCallback;
    "editorExecuteExplain": SimpleCallback;
    "editorCommit": SimpleCallback;
    "editorRollback": SimpleCallback;

    /** Execute a piece of code in the given language. */
    "editorRunCode": (options: IEditorExtendedExecutionOptions) => Promise<boolean>;

    /** A special version of editorRunCode, where the script text is loaded into a standalone script editor. */
    "editorRunScript": (details: IScriptRequest) => Promise<boolean>;

    /** Loads the given text into a script editor. */
    "editorEditScript": (details: IScriptRequest) => Promise<boolean>;
    "editorLoadScript": (details: IScriptRequest) => Promise<boolean>;
    "editorSaveScript": (details: IScriptRequest) => Promise<boolean>;
    "editorSaved": (details: { id: string, newName: string, saved: boolean; }) => Promise<boolean>;
    "editorRenameScript": (details: IScriptRequest) => Promise<boolean>;
    "editorValidationDone": (id: string) => Promise<boolean>;
    "editorSelectStatement": (details: { contextId: string; statementIndex: number; }) => Promise<boolean>;

    /**
     * Triggers saving the content of the current notebook to a file. The actual behavior depends on the context and
     * the given `content` parameter.
     *
     * In the frontend: The data in the  `content` is ignored. Instead the content of the current notebook will be
     * serialized and either sent to the remote backend (if the app is embedded, using the same requisition type),
     * which will save it to a file, or the app will save it by itself, using the browser's download API.
     *
     * In the host (if the app is embedded): The `content` parameter must contain the serialized content of the
     * notebook, which will be saved to a file, using a file picker provided by host (usually the native OS file
     * selector). If `content` is empty, nothing happens.
     */
    "editorSaveNotebook": (content?: string) => Promise<boolean>;
    "editorSaveNotebookInPlace": (content?: string) => Promise<boolean>;

    /**
     * Triggers loading a notebook from a file. The actual behavior depends on the context and the given `details`
     * parameter.
     *
     * In the frontend: If `details` is given, it will be used to create a new notebook document in the editor. If
     * there's no content given, the user will be prompted to select a file. If the app runs in a browser, the
     * browser's file picker will be used and file content will be loaded into a new notebook document. If the app
     * runs in an embedded context, this request will be forwarded to the host.
     *
     * In the host (if the app is embedded): The `details` parameter is ignored and instead the host will prompt the
     * user to select a file. The file content will replace the current notebook document (the request can only be sent
     * when a notebook is active).
     */
    "editorLoadNotebook": (details?: { content: string, standalone: boolean; }) => Promise<boolean>;

    /** Sent when a document is to be closed. */
    "closeDocument": (details: { connectionId?: number; documentId: string; }) => Promise<boolean>;

    /** Triggered when an execution context changes its loading state (pending, loading, waiting, idle). */
    "editorContextStateChanged": (id: string) => Promise<boolean>;

    /** Triggered by the application after a document was opened. */
    "documentOpened": (data: IDocumentOpenData) => Promise<boolean>;

    /** Triggered by the application before a document is closed. */
    "documentClosed": (data: IDocumentCloseData) => Promise<boolean>;

    /** Sent when a connection data model entry needs an update of its MRS services. */
    "updateMrsRoot": (connectionId: string) => Promise<boolean>;

    /** Sent when a document is to be selected. */
    "selectDocument": (details: { connectionId: number, documentId: string; }) => Promise<boolean>;

    /** Sent to tell the host that the content of an editor has changed. */
    "editorChanged": SimpleCallback;

    /** Sent to insert text into an editor. */
    "editorInsertText": (text: string) => Promise<boolean>;

    "sqlSetCurrentSchema": (data: { id: string; connectionId: number; schema: string; }) => Promise<boolean>;
    "sqlTransactionChanged": SimpleCallback;
    "sqlTransactionEnded": SimpleCallback;

    "sessionAdded": (session: IShellSessionDetails) => Promise<boolean>;
    "sessionRemoved": (session: IShellSessionDetails) => Promise<boolean>;
    "openSession": (session: IShellSessionDetails) => Promise<boolean>;
    "removeSession": (session: IShellSessionDetails) => Promise<boolean>;
    "newSession": (session: IShellSessionDetails) => Promise<boolean>;

    /** Triggers adding a new connection. */
    "addNewConnection": (details: { mdsData?: IMySQLDbSystem; profileName?: string; }) => Promise<boolean>;

    /** Triggers removing a connection */
    "removeConnection": (connectionId: number) => Promise<boolean>;

    /** Triggers editing a connection */
    "editConnection": (connectionId: number) => Promise<boolean>;

    /** Triggers duplicating a connection */
    "duplicateConnection": (connectionId: number) => Promise<boolean>;

    /** Sent when a connection was added. This is more effective than refreshing all connections. */
    "connectionAdded": (details: IConnectionDetails) => Promise<boolean>;

    /** Sent when a connection was edited. */
    "connectionUpdated": (details: IConnectionDetails) => Promise<boolean>;

    /** Sent when a connection was removed. */
    "connectionRemoved": (details: IConnectionDetails) => Promise<boolean>;

    /** Do whatever default action is set for a connection data model entry. */
    "connectionItemDefaultAction": (entry: ConnectionDataModelEntry) => Promise<boolean>;

    "requestPassword": (request: IServicePasswordRequest) => Promise<boolean>;
    "acceptPassword": (data: { request: IServicePasswordRequest; password: string; }) => Promise<boolean>;
    "cancelPassword": (request: IServicePasswordRequest) => Promise<boolean>;

    "requestMrsAuthentication": (request: IServicePasswordRequest) => Promise<boolean>;
    "acceptMrsAuthentication": (data: { request: IServicePasswordRequest; password: string; }) => Promise<boolean>;
    "cancelMrsAuthentication": (request: IServicePasswordRequest) => Promise<boolean>;
    "refreshMrsServiceSdk": SimpleCallback;

    "showAbout": SimpleCallback;
    "showThemeEditor": SimpleCallback;
    "showPreferences": SimpleCallback;
    "showModule": (module: string) => Promise<boolean>;
    "showPage": (
        data: { module: string; page: string; editor?: InitialEditor; suppressAbout?: boolean; }) => Promise<boolean>;

    "openDocument": (data: IDocumentOpenData) => Promise<boolean>;

    "showDialog": (request: IDialogRequest) => Promise<boolean>;
    "dialogResponse": (response: IDialogResponse) => Promise<boolean>;

    "settingsChanged": (entry?: { key: string; value: unknown; }) => Promise<boolean>;
    "updateShellPrompt": (values: IShellPromptValues) => Promise<boolean>;

    "refreshOciTree": SimpleCallback;

    /** Used to refresh a connection (if `data` is assigned) or all connections (if not). */
    "refreshConnection": (data?: ICdmConnectionEntry) => Promise<boolean>;

    /** Triggered when the list of connections has been updated and is now available. */
    "connectionsUpdated": SimpleCallback;

    "selectConnectionTab": (details: { connectionId: number; }) => Promise<boolean>;

    /** Update extension code blocks. */
    "codeBlocksUpdate": (data: { linkId: number; code: string; }) => Promise<boolean>;

    /** Execute an embedded extension code block. */
    "executeCodeBlock": (options: ICodeBlockExecutionOptions) => Promise<boolean>;

    /** Shows a blocking (modal) error panel. */
    "showFatalError": (values: string[]) => Promise<boolean>;

    /** Adds a new error notification notification. */
    "showError": (message: string) => Promise<boolean>;

    /** Adds a new warning notification notification. */
    "showWarning": (message: string) => Promise<boolean>;

    /** Adds a new information notification notification. */
    "showInfo": (message: string) => Promise<boolean>;

    "connectedToUrl": (url?: URL) => Promise<boolean>;
    "refreshSessions": (sessions: IShellSessionDetails[]) => Promise<boolean>;
    "closeInstance": SimpleCallback;

    /** Creates a new editor (script or notebook) with optional content. */
    "createNewEditor": (request: INewEditorRequest) => Promise<boolean>;

    "dbFileDropped": (fileName: string) => Promise<boolean>;

    "hostThemeChange": (data: IHostThemeData) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS service. */
    "showMrsServiceDialog": (data?: IMrsServiceData) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS schema. */
    "showMrsSchemaDialog": (data: IMrsSchemaEditRequest) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS DB object. */
    "showMrsDbObjectDialog": (data: IMrsDbObjectEditRequest) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS content set. */
    "showMrsContentSetDialog": (data: IMrsContentSetEditRequest) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS authentication app. */
    "showMrsAuthAppDialog": (data: IMrsAuthAppEditRequest) => Promise<boolean>;

    /** Shows the dialog to create or update an MRS user. */
    "showMrsUserDialog": (data: IMrsUserEditRequest) => Promise<boolean>;

    "showMrsSdkExportDialog": (data: IMrsSdkExportRequest) => Promise<boolean>;

    /** A list of requests that must be executed sequentially. */
    "job": (job: Array<IJobEntry<keyof IRequestTypeMap>>) => Promise<boolean>;

    "showLakehouseNavigator": SimpleCallback;
    "showChatOptions": SimpleCallback;

    /**
     * A request which is a re-post of another request.
     * Used to handle notifications from multiple application instances (each represented by a web view provider).
     */
    "proxyRequest": (request: IProxyRequest) => Promise<boolean>;

    /** Pass text around (e.g. for debugging). */
    "message": (message: string) => Promise<boolean>;

    "debugger": (data: IDebuggerData) => Promise<boolean>;
}
