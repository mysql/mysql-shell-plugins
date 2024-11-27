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

import {
    EditorLanguage, IExecutionContext, INewEditorRequest, IScriptRequest, ISqlPageRequest,
} from "./index.js";

import {
    IDialogRequest, IDialogResponse, IDictionary, IServicePasswordRequest,
} from "../app-logic/Types.js";
import type { IEmbeddedMessage, IEmbeddedSourceType, IMySQLDbSystem } from "../communication/index.js";
import { IShellProfile, IShellPromptValues, IWebSessionData } from "../communication/ProtocolGui.js";
import type {
    IMrsAuthAppData, IMrsContentSetData, IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../communication/ProtocolMrs.js";

import { IHostThemeData, IThemeChangeData } from "../components/Theming/ThemeManager.js";
import { EntityType, ISchemaTreeEntry } from "../modules/db-editor/index.js";
import { RequisitionPipeline } from "./RequisitionPipeline.js";
import { DBType, IConnectionDetails, IShellSessionDetails } from "./ShellInterface/index.js";
import type { StatusBarAlignment } from "../components/ui/Statusbar/StatusBarItem.js";

export const appParameters: Map<string, string> & IAppParameters = new Map<string, string>();

interface IAppParameters {
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

/**
 * Determines if the app is embedded and wires up message handlers for sending and receiving wrapper messages.
 * It also converts URL parameters to a map, for consumption in the app.
 */
const parseAppParameters = (): void => {
    if (typeof window !== "undefined") {
        const queryParts = window.location.search.substring(1).split("&");
        queryParts.forEach((part) => {
            const elements = part.split("=");
            if (elements.length > 1) {
                appParameters.set(elements[0], elements[1]);

                if (elements[0] === "app") {
                    appParameters.embedded = true;
                } else if (elements[0] === "fontSize") {
                    const fontSize = parseInt(elements[1], 10);
                    if (!isNaN(fontSize)) {
                        appParameters.fontSize = fontSize;
                    }
                } else if (elements[0] === "editorFontSize") {
                    const fontSize = parseInt(elements[1], 10);
                    if (!isNaN(fontSize)) {
                        appParameters.editorFontSize = fontSize;
                    }
                }
            }
        });
    }

    if (process.env.NODE_ENV === "test") {
        appParameters.testsRunning = true;
    } else if (process.env.NODE_ENV === "development") {
        appParameters.inDevelopment = true;
    }

    // Test Explorer tests also run under VS Code control, but must not be treated as embedded.
    if (process.env.VSCODE_PID !== undefined && process.env.JEST_WORKER_ID === undefined) {
        appParameters.inExtension = true;
    }
};

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
 * Options for all code execution requests. They are always bound to a specific execution context, when used.
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

    /** The specific context to execute. If omitted, the current context will be used. */
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
export interface IEditorOpenChangeData {
    opened: true;

    /** A unique id of the connection to which the editor belongs. */
    connectionId: number,

    /** The connection's title. */
    connectionCaption: string;

    /** The connection's type. */
    dbType: DBType;

    /** A unique id of the editor. */
    editorId: string,

    /** The editor's title. */
    editorCaption: string,

    /** The editor's language. */
    language: EditorLanguage;

    /** The type of the page. */
    editorType: EntityType;
}

/** The data sent when an editor is being closed by the app. */
export interface IEditorCloseChangeData {
    opened: false;

    /** A unique id of the connection to which the editor belongs. */
    connectionId: number,

    /** The id of the entry to remove. If empty close all entries from the connection. */
    editorId?: string,
}

export interface IWebviewProvider {
    caption: string;

    close(): void;
    runCommand<K extends keyof IRequestTypeMap>(requestType: K, parameter: IRequisitionCallbackValues<K>,
        caption: string, settingName: string): Promise<boolean>;
}

/**
 * The request sent from a webview provider to the app requisition instance, when it received notifications
 * from its local requisition instance. Only used in embedded scenarios.
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

/**
 * The map containing possible requests and their associated callback.
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
    "openConnectionTab": (
        data: { details: IConnectionDetails; force: boolean; initialEditor: InitialEditor; }) => Promise<boolean>;
    "selectFile": (result: IOpenFileDialogResult) => Promise<boolean>;
    "showOpenDialog": (options: IOpenDialogOptions) => Promise<boolean>;
    "showSaveDialog": (options: ISaveDialogOptions) => Promise<boolean>;

    "sqlShowDataAtPage": (data: ISqlPageRequest) => Promise<boolean>;

    /** Sent when new column details are available for a specific result set. */
    "sqlUpdateColumnInfo": (data: IColumnDetails) => Promise<boolean>;

    "editorCaretMoved": (position: { lineNumber: number; column: number; }) => Promise<boolean>;
    "editorExecuteSelectedOrAll": (options: IEditorCommonExecutionOptions) => Promise<boolean>;
    "editorExecute": (options: IEditorCommonExecutionOptions) => Promise<boolean>;
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
    "editorShowConnections": SimpleCallback;
    "editorInsertUserScript": (data: { language: EditorLanguage; resourceId: number; }) => Promise<boolean>;

    /** Execute a piece of code in the given language. */
    "editorRunCode": (options: IEditorExtendedExecutionOptions) => Promise<boolean>;

    "editorRunScript": (details: IScriptRequest) => Promise<boolean>;
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

    /** Sent by the host to trigger close handling of an editor. */
    "editorClose": (details: { connectionId: number; editorId: string; }) => Promise<boolean>;

    /** Triggered when an execution context changes its loading state (pending, loading, waiting, idle). */
    "editorContextStateChanged": (id: string) => Promise<boolean>;

    /** Triggered by the application when an editor was opened or closed. */
    "editorsChanged": (details: IEditorOpenChangeData | IEditorCloseChangeData) => Promise<boolean>;

    /** Sent by the application when an editor was selected. */
    "editorSelect": (details: { connectionId: number, editorId: string; }) => Promise<boolean>;

    /** Sent to tell the host that the content of an editor has changed. */
    "editorChanged": SimpleCallback;

    "sqlSetCurrentSchema": (data: { id: string; connectionId: number; schema: string; }) => Promise<boolean>;
    "sqlTransactionChanged": SimpleCallback;
    "sqlTransactionEnded": SimpleCallback;

    "moduleToggle": (id: string) => Promise<boolean>;

    "sessionAdded": (session: IShellSessionDetails) => Promise<boolean>;
    "sessionRemoved": (session: IShellSessionDetails) => Promise<boolean>;
    "openSession": (session: IShellSessionDetails) => Promise<boolean>;
    "removeSession": (session: IShellSessionDetails) => Promise<boolean>;
    "newSession": (session: IShellSessionDetails) => Promise<boolean>;

    /** Triggers adding a new connection. */
    "addNewConnection": (details: { mdsData?: IMySQLDbSystem; profileName?: String; }) => Promise<boolean>;

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

    "explorerDoubleClick": (entry: ISchemaTreeEntry) => Promise<boolean>;

    "requestPassword": (request: IServicePasswordRequest) => Promise<boolean>;
    "acceptPassword": (data: { request: IServicePasswordRequest; password: string; }) => Promise<boolean>;
    "cancelPassword": (request: IServicePasswordRequest) => Promise<boolean>;

    "requestMrsAuthentication": (request: IServicePasswordRequest) => Promise<boolean>;
    "acceptMrsAuthentication": (data: { request: IServicePasswordRequest; password: string; }) => Promise<boolean>;
    "cancelMrsAuthentication": (request: IServicePasswordRequest) => Promise<boolean>;
    "refreshMrsServiceSdk": SimpleCallback;

    "showAbout": SimpleCallback;
    "showPreferences": SimpleCallback;
    "showModule": (module: string) => Promise<boolean>;
    "showPage": (data: { module: string; page: string; noEditor?: boolean; }) => Promise<boolean>;
    "showPageSection": (details: { id: string, type: EntityType; }) => Promise<boolean>;

    "showDialog": (request: IDialogRequest) => Promise<boolean>;
    "dialogResponse": (response: IDialogResponse) => Promise<boolean>;

    "settingsChanged": (entry?: { key: string; value: unknown; }) => Promise<boolean>;
    "updateShellPrompt": (values: IShellPromptValues) => Promise<boolean>;

    "refreshOciTree": SimpleCallback;
    "refreshConnections": (data?: IDictionary) => Promise<boolean>;

    /** Triggered when the list of connections has been updated and is now available. */
    "connectionsUpdated": SimpleCallback;
    "selectConnectionTab": (details: { connectionId: number, page: string; }) => Promise<boolean>;

    /** Update extension code blocks. */
    "codeBlocksUpdate": (data: { linkId: number; code: string; }) => Promise<boolean>;

    /** Execute an embedded extension code block. */
    "executeCodeBlock": (options: ICodeBlockExecutionOptions) => Promise<boolean>;

    "showFatalError": (values: string[]) => Promise<boolean>;
    "showError": (message: string) => Promise<boolean>;
    "showWarning": (message: string) => Promise<boolean>;
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
    "job": (job: Array<IRequestListEntry<keyof IRequestTypeMap>>) => Promise<boolean>;

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

/** Defines an interface to use for executing remote requisition requests. */
interface IRemoteTarget {
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
 * Management class for requests and messages sent between various parts of the application. It allows to schedule
 * tasks and trigger notifications to multiple subscribed receivers.
 * It uses request types which specify a single specific request in the application.
 */
export class RequisitionHub {

    // A list of callbacks associated with a specific request.
    private registry = new Map<keyof IRequestTypeMap, Array<IRequestTypeMap[keyof IRequestTypeMap]>>();

    private remoteTarget?: IRemoteTarget;
    private source: IEmbeddedSourceType;

    // Created and held here to keep it alive. It works via job subscriptions, not direct calls.
    private requestPipeline: RequisitionPipeline;

    public constructor(source: IEmbeddedSourceType = "app") {
        this.source = source;
        this.requestPipeline = new RequisitionPipeline(this);

        this.setRemoteTarget(); // Use the default target.
    }

    /**
     * Creates a new instance of the requisition hub with default parameters.
     *
     * @returns A new instance of the requisition hub.
     */
    public static get instance(): RequisitionHub {
        return new RequisitionHub();
    }

    /**
     * Injects the remote end for sending messages to the host.
     *
     * @param target The remote target to use for sending/broadcasting messages. If undefined, the environment
     *               is examined to find a suitable target, which is usually a message handler in the host.
     */
    public setRemoteTarget(target?: IRemoteTarget): void {
        if (target) {
            this.remoteTarget = target;
        } else if (typeof window !== "undefined") {
            /* eslint-disable @typescript-eslint/no-explicit-any */

            // If no explicit target is given determine one from special values.
            if ((window as any).webkit) {
                this.remoteTarget = (window as any).webkit.messageHandlers.hostChannel;
            } else {
                const chrome = (window as any).chrome;
                if (chrome && chrome.webview) {
                    this.remoteTarget = chrome.webview;
                }
            }

            if (this.remoteTarget) {
                // If a remote target is set it means we are embedded in a native application using
                // an embedded browser client. Define an own function in this scenario, which the hosts can
                // call via JavaScript.
                (window as any).onNativeMessage = (message: IEmbeddedMessage): void => {
                    this.handleRemoteMessage(message);
                };

                /* eslint-enable @typescript-eslint/no-explicit-any */

            } else {
                // Here we know the app is running in a browser. This can be a standalone browser or a web view
                // in Visual Studio Code. In all these cases we can just send messages to the parent window.
                this.remoteTarget = window.parent;

                window.addEventListener("message", (message: MessageEvent) => {
                    // Handle only our own messages and ignore others here.
                    if (message.data.source !== "app") {
                        this.handleRemoteMessage(message.data as IEmbeddedMessage);
                    }
                });

                if (appParameters.embedded) {
                    // If we are running embedded in VS Code, we have to forward keyboard events, to allow VS Code
                    // to handle these, if needed.
                    // See extension code (WebviewProvider.ts) how these messages are treated.
                    document.addEventListener("keydown", (e) => {
                        const obj = {
                            source: this.source,
                            command: "keydown",
                            altKey: e.altKey,
                            code: e.code,
                            ctrlKey: e.ctrlKey,
                            isComposing: e.isComposing,
                            key: e.key,
                            location: e.location,
                            metaKey: e.metaKey,
                            repeat: e.repeat,
                            shiftKey: e.shiftKey,
                        };

                        // Forward event to the window parent, which will forward to VS Code.
                        window.parent.postMessage(obj, "*");
                    });

                    document.addEventListener("keyup", (e) => {
                        const obj = {
                            type: "keyup",
                            altKey: e.altKey,
                            code: e.code,
                            ctrlKey: e.ctrlKey,
                            isComposing: e.isComposing,
                            key: e.key,
                            location: e.location,
                            metaKey: e.metaKey,
                            repeat: e.repeat,
                            shiftKey: e.shiftKey,
                        };

                        window.parent.postMessage(obj, "*");
                    });
                }
            }
        }
    }

    /**
     * Stores a callback with a given request type for later execution.
     *
     * @param requestType The request type for which to call the given callback. Must not be empty.
     * @param callback The callback to trigger when request with the given id is to be executed.
     */
    public register = <K extends keyof IRequestTypeMap>(requestType: K, callback: IRequestTypeMap[K]): void => {
        if (!this.registry.has(requestType)) {
            this.registry.set(requestType, [callback]);
        } else {
            const list = this.registry.get(requestType)!;

            // Add only if not already there.
            const index = list.findIndex((entry) => {
                return entry === callback;
            });

            if (index === -1) {
                // Push to the head to make later registrations get notifications sooner than earlier registrations.
                // Usually, the later a handler is registered, the more specialized it is.
                list.unshift(callback);
            }
        }
    };

    /**
     * Removes one or more callbacks from the request registry.
     *
     * - With no request type and no callback the entire registry is cleared.
     * - If no callback is given, remove all callbacks for the given request type.
     * - Otherwise remove all occurrences of the callback for the given request type.
     *
     * @param requestType If specified then remove only callbacks for that specific id.
     * @param callback If specified remove all registered entries with the specific callback (filtered by requestType).
     */
    public unregister = <K extends keyof IRequestTypeMap>(requestType?: K, callback?: IRequestTypeMap[K]): void => {
        if (!requestType) {
            this.registry.clear();

            return;
        }

        const list = this.registry.get(requestType);
        if (list) {
            const newList = list.filter((candidate) => {
                return candidate !== callback;
            });

            if (newList.length > 0) {
                this.registry.set(requestType, newList);
            } else {
                this.registry.delete(requestType);
            }
        }
    };

    /**
     * Returns the number of registrations for a given requisition. Useful mostly for tests.
     *
     * @param requestType The type for which to return the count.
     *
     * @returns The number registered callbacks.
     */
    public registrations = <K extends keyof IRequestTypeMap>(requestType: K): number => {
        const list = this.registry.get(requestType);

        return list?.length ?? 0;
    };

    /**
     * Execute a list of registered callbacks for a request.
     *
     * @param requestType The request type for which to execute the registered callbacks.
     * @param parameter The value required for the callbacks.
     *
     * @returns A promise which is resolved when all callbacks are resolved.
     */
    public execute = async <K extends keyof IRequestTypeMap>(requestType: K,
        parameter: IRequisitionCallbackValues<K>): Promise<boolean> => {
        const list = this.registry.get(requestType);
        if (list) {
            const promises: Array<Promise<boolean>> = [];
            list.forEach((callback) => {
                // TypeScript cannot interpret the generic values type correctly and widens it here to an intersection
                // type, with the result that it complains that it cannot assign the original union type to this
                // (wrong) intersection type.
                // See also https://stackoverflow.com/questions/55933800/typescript-unexpected-intersection.
                // And even worse: if there are callbacks with a mix of simple types (e.g. string and boolean), this
                // intersection type becomes `never`, which requires that explicit cast here.
                promises.push(callback(parameter as never));
            });

            const results = await Promise.all(promises);

            // Return a true value for the promise if at least one callback handled the request.
            return Promise.resolve(results.some((value) => {
                return value;
            }));
        }

        return Promise.resolve(false);
    };

    /**
     * A specialized execution function for remote calls. It will use messaging to communicate to a possible host or
     * embedded site.
     *
     * @param requestType The request type for which to execute the registered callbacks.
     * @param parameter The value required for the callbacks.
     *
     * @returns True if a remote target exists, otherwise false.
     */
    public executeRemote = <K extends keyof IRequestTypeMap>(requestType: K,
        parameter: IRequisitionCallbackValues<K>): boolean => {

        if (this.remoteTarget) {
            if (this.remoteTarget.postMessage) {
                const message: IEmbeddedMessage = {
                    source: this.source,
                    command: requestType,
                    data: parameter as IDictionary,
                };

                this.remoteTarget.postMessage(message, "*");
            } else if (this.remoteTarget.broadcastRequest) {
                // Broadcasts are the way to send requests from a host to all embedded web views.
                // So, they have per definition no sending web view provider.
                void this.remoteTarget.broadcastRequest(undefined, requestType, parameter);
            }

            return true;
        }

        return false;
    };

    /**
     * A combination of local and remote execution. The actual execution depends on the provider parameter.
     * If it is undefined, the request is executed locally and remotely. Otherwise it is executed only remotely.
     *
     * @param provider If assigned specifies the source of the request. This is used to avoid sending the request
     *                 back to the same provider.
     * @param requestType The request type for which to execute the registered callbacks.
     * @param parameter The value required for the callbacks.
     *
     * @returns True if any of the callbacks returned true, otherwise false.
     */
    public broadcastRequest = async <K extends keyof IRequestTypeMap>(provider: IWebviewProvider | undefined,
        requestType: K, parameter: IRequisitionCallbackValues<K>): Promise<boolean> => {

        let result = false;

        if (!provider) {
            result ||= await this.execute(requestType, parameter);
        }

        if (this.remoteTarget?.broadcastRequest) {
            await this.remoteTarget.broadcastRequest(provider, requestType, parameter);
            result = true;
        } else {
            result ||= this.executeRemote(requestType, parameter);
        }


        return result;
    };

    /**
     * Schedules a remote message to all subscribed callbacks.
     *
     * @param message The message to distribute.
     */
    public handleRemoteMessage(message: IEmbeddedMessage): void {
        switch (message.command) {
            case "paste": {
                const text = message.data?.["text/plain"] as string ?? "";
                const element = document.activeElement;
                if (element) {
                    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                        const oldValue = element.value;
                        const start = element.selectionStart ?? oldValue.length;
                        element.value = oldValue.substring(0, start) + text +
                            oldValue.substring(element.selectionEnd ?? start);

                        element.selectionStart = start + text.length; // Set the caret at the end of the new text.
                        element.selectionEnd = start + text.length;

                        // Send an input event to trigger internal handling of the change.
                        const event = new Event("input", { bubbles: true });
                        element.dispatchEvent(event);
                    }
                }

                break;
            }

            case "cut": {
                this.handleCutCopy(true);

                break;
            }

            case "copy": {
                this.handleCutCopy(false);

                break;
            }

            default: {
                const requestType = message.command as keyof IRequestTypeMap;
                const parameter = message.data as IRequisitionCallbackValues<typeof requestType>;

                const list = this.registry.get(requestType);
                if (list) {
                    list.forEach((callback) => {
                        void callback(parameter as never);
                    });
                }
            }
        }
    }

    /**
     * Clipboard access is limited and must be handled differently, depending on whether running in embedded mode
     * or standalone.
     *
     * @param text The text to write to the clipboard.
     */
    public writeToClipboard(text: string): void {
        if (appParameters.embedded) {
            const message = {
                source: this.source,
                command: "writeClipboard",
                text,
            };

            this.remoteTarget?.postMessage?.(message, "*");
        } else if (navigator.clipboard && window.isSecureContext) {
            // Some browser limit access to the clipboard in unsecure contexts.
            void navigator.clipboard.writeText(text);
        } else if (document.execCommand) {
            // The follow code is a workaround for browsers that do not support the clipboard API or do not allow
            // clipboard access in unsecure contexts. It uses a deprecated API, which might be removed in the future.
            const element = document.createElement("textarea");
            element.value = text;
            element.style.position = "fixed"; // Avoid scrolling to bottom.
            document.body.appendChild(element);
            element.focus();
            element.select();
            document.execCommand("copy");
            document.body.removeChild(element);
        }
    }

    /**
     * Handles cut and copy events in the application, which require special handling in embedded mode.
     *
     * @param cut A flag indicating if the event is a cut or copy event.
     */
    private handleCutCopy(cut: boolean): void {
        const selection = window.getSelection();
        if (selection) {
            this.writeToClipboard(selection.toString());
            const element = document.activeElement;
            if (cut && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
                if (element.selectionStart !== null) {
                    const oldValue = element.value;
                    const caret = Math.min(element.selectionStart, element.selectionEnd ?? 1000);
                    element.value = oldValue.substring(0, element.selectionStart) + oldValue
                        .substring(element.selectionEnd as number ?? element.selectionStart);

                    element.selectionStart = caret;
                    element.selectionEnd = caret;

                    // Send an input event to trigger internal handling of the change.
                    const event = new Event("input", { bubbles: true });
                    element.dispatchEvent(event);
                }
            }
        }
    }
}

parseAppParameters();

export const requisitions = RequisitionHub.instance;
