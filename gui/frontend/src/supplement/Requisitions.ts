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

import {
    EditorLanguage, IExecutionContext, INewScriptRequest, IRunQueryRequest, IScriptRequest, ISqlPageRequest,
} from ".";

import {
    IDialogRequest, IDialogResponse, IDictionary, IServicePasswordRequest, IStatusbarInfo,
} from "../app-logic/Types";
import {
    IEmbeddedMessage, IEmbeddedSourceType, IMySQLDbSystem,
} from "../communication";
import { IWebSessionData, IShellProfile, IShellPromptValues } from "../communication/ProtocolGui";

import { IThemeChangeData } from "../components/Theming/ThemeManager";
import { IEditorStatusInfo, IDBDataEntry, ISchemaTreeEntry, EntityType } from "../modules/db-editor";
import { RequisitionPipeline } from "./RequisitionPipeline";
import { IConnectionDetails, IShellSessionDetails } from "./ShellInterface";

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
                }
            }
        });
    }

    if (process.env.NODE_ENV === "test") {
        appParameters.testsRunning = true;
    } else if (process.env.NODE_ENV === "development") {
        appParameters.inDevelopment = true;
    }

    if (process.env.npm_package_name === "mysql-shell-for-vs-code" || process.env.VSCODE_PID !== undefined) {
        appParameters.inExtension = true;
    }
};

type SimpleCallback = (_: unknown) => Promise<boolean>;

export interface IOpenDialogFilters {
    [key: string]: string[];
}

/** This is essentially a copy of the VS Code OpenDialogOptions interface. */
export interface IOpenDialogOptions {
    /** Resource Id which trigger open dialog */
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

export interface IOpenFileDialogResult {
    resourceId: string;
    path: string[];
}

export interface IEditorExecutionOptions {
    startNewBlock: boolean;
    forceSecondaryEngine: boolean;
    asText: boolean;
}

/** A special set of data for the communication debugger/listener. */
export interface IDebuggerData {
    request?: INativeShellRequest;
    response?: INativeShellResponse;
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

    "updateStatusbar": (items: IStatusbarInfo[]) => Promise<boolean>;
    "profileLoaded": SimpleCallback;
    "changeProfile": (id: string | number) => Promise<boolean>;
    "statusBarButtonClick": (values: { type: string; event: MouseEvent | KeyboardEvent; }) => Promise<boolean>;
    "editorInfoUpdated": (info: IEditorStatusInfo) => Promise<boolean>;
    "themeChanged": (data: IThemeChangeData) => Promise<boolean>;
    "openConnectionTab": (data: { details: IConnectionDetails; force: boolean; }) => Promise<boolean>;
    "selectFile": (result: IOpenFileDialogResult) => Promise<boolean>;
    "showOpenDialog": (options: IOpenDialogOptions) => Promise<boolean>;

    "editorExecuteSelectedOrAll": (options: IEditorExecutionOptions) => Promise<boolean>;
    "editorExecuteCurrent": (options: IEditorExecutionOptions) => Promise<boolean>;
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
    "sqlShowDataAtPage": (data: ISqlPageRequest) => Promise<boolean>;
    "editorRunQuery": (details: IRunQueryRequest) => Promise<boolean>;
    "editorRunScript": (details: IScriptRequest) => Promise<boolean>;
    "editorEditScript": (details: IScriptRequest) => Promise<boolean>;
    "editorSaveScript": (details: IScriptRequest) => Promise<boolean>;
    "editorSaved": (details: { id: string, saved: boolean; }) => Promise<boolean>;
    "editorRenameScript": (details: IScriptRequest) => Promise<boolean>;
    "editorValidationDone": (id: string) => Promise<boolean>;
    "editorSelectStatement": (details: { contextId: string; statementIndex: number; }) => Promise<boolean>;

    /** Triggered when an execution context changes its loading state (pending, loading, waiting, idle). */
    "editorContextStateChanged": (id: string) => Promise<boolean>;

    "sqlSetCurrentSchema": (data: { id: string; connectionId: number; schema: string; }) => Promise<boolean>;
    "sqlTransactionChanged": SimpleCallback;
    "sqlTransactionEnded": SimpleCallback;

    "moduleToggle": (id: string) => Promise<boolean>;

    "sessionAdded": (session: IShellSessionDetails) => Promise<boolean>;
    "sessionRemoved": (session: IShellSessionDetails) => Promise<boolean>;
    "openSession": (session: IShellSessionDetails) => Promise<boolean>;
    "removeSession": (session: IShellSessionDetails) => Promise<boolean>;
    "newSession": (session: IShellSessionDetails) => Promise<boolean>;

    "addNewConnection": (details: { mdsData?: IMySQLDbSystem; profileName?: String; }) => Promise<boolean>;
    "removeConnection": (connectionId: number) => Promise<boolean>;
    "editConnection": (connectionId: number) => Promise<boolean>;
    "duplicateConnection": (connectionId: number) => Promise<boolean>;

    "explorerShowRows": (entry: ISchemaTreeEntry | IDBDataEntry) => Promise<boolean>;
    "explorerDoubleClick": (entry: ISchemaTreeEntry) => Promise<boolean>;

    "requestPassword": (request: IServicePasswordRequest) => Promise<boolean>;
    "acceptPassword": (result: { request: IServicePasswordRequest; password: string; }) => Promise<boolean>;
    "cancelPassword": (request: IServicePasswordRequest) => Promise<boolean>;

    "showAbout": SimpleCallback;
    "showThemeEditor": SimpleCallback;
    "showPreferences": SimpleCallback;
    "showModule": (module: string) => Promise<boolean>;
    "showPage": (data: { module: string; page: string; }) => Promise<boolean>;
    "showPageSection": (type: EntityType) => Promise<boolean>;

    "showDialog": (request: IDialogRequest) => Promise<boolean>;
    "dialogResponse": (response: IDialogResponse) => Promise<boolean>;

    "settingsChanged": (entry?: { key: string; value: unknown; }) => Promise<boolean>;
    "updateShellPrompt": (values: IShellPromptValues) => Promise<boolean>;

    "refreshOciTree": SimpleCallback;
    "refreshConnections": (data?: IDictionary) => Promise<boolean>;
    "selectConnectionTab": (page: string) => Promise<boolean>;

    "codeBlocksUpdate": (data: { linkId: number; code: string; }) => Promise<boolean>;

    "showError": (values: string[]) => Promise<boolean>;

    "connectedToUrl": (url?: URL) => Promise<boolean>;
    "refreshSessions": (sessions: IShellSessionDetails[]) => Promise<boolean>;
    "closeInstance": SimpleCallback;
    "createNewScript": (request: INewScriptRequest) => Promise<boolean>;

    "dbFileDropped": (fileName: string) => Promise<boolean>;

    "hostThemeChange": (data: { css: string; themeClass: string; }) => Promise<boolean>;

    /** A list of requests that must be executed sequentially. */
    "job": (job: Array<IRequestListEntry<keyof IRequestTypeMap>>) => Promise<boolean>;

    /** Pass text around (e.g. for debugging). */
    "message": (message: string) => Promise<boolean>;

    "debugger": (data: IDebuggerData) => Promise<boolean>;
}

/** A function that can be use to send messages between host and client parts in embedded scenarios. */
interface IRemoteTarget {
    postMessage: (data: IEmbeddedMessage, origin: string) => void;
}

/** A generic type to extract the (single) callback parameter type from the callback map. */
export type IRequisitionCallbackValues<K extends keyof IRequestTypeMap> = Parameters<IRequestTypeMap[K]>[0];

export interface IRequestListEntry<K extends keyof IRequestTypeMap> {
    requestType: K;
    parameter: IRequisitionCallbackValues<K>;
}

/**
 *  Management class for requests and messages sent between various parts of the application. It allows to schedule
 * tasks and trigger notifications to multiple subscribed receivers.
 *  It uses request types which specify a single specific request in the application.
 */
export class RequisitionHub {

    // A list of callbacks associated with a specific request.
    private registry = new Map<keyof IRequestTypeMap, Array<IRequestTypeMap[keyof IRequestTypeMap]>>();

    private remoteTarget?: IRemoteTarget;
    private source: IEmbeddedSourceType;

    // Created and held here to keep it alive. It works via job subscriptions, not direct calls.
    private requestPipeline: RequisitionPipeline;

    public constructor(source: IEmbeddedSourceType = "app", target?: IRemoteTarget) {
        this.source = source;
        this.requestPipeline = new RequisitionPipeline(this);

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

                        // Additionally, we have to take care for clipboard actions here.
                        // We cannot access the clipboard in this nested iframe, so we send the text to the
                        // extension, which can write to the clipboard.
                        if (e.metaKey && (e.key === "c" || e.key === "x")) {
                            const selection = window.getSelection();
                            if (selection) {
                                this.writeToClipboard(selection.toString());
                                const element = document.activeElement;
                                if (e.key === "x" && (element instanceof HTMLInputElement
                                    || element instanceof HTMLTextAreaElement)) {
                                    if (element.selectionStart !== null) {
                                        const oldValue = element.value;
                                        const caret = Math.min(element.selectionStart, element.selectionEnd ?? 1000);
                                        element.value = oldValue.substring(0, element.selectionStart) + oldValue
                                            .substring(element.selectionEnd as number ?? element.selectionStart);

                                        element.selectionStart = caret;
                                        element.selectionEnd = caret;
                                    }
                                }
                            }
                        }
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

            /* eslint-enable @typescript-eslint/no-explicit-any */

        }
    }

    public static get instance(): RequisitionHub {
        return new RequisitionHub();
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
            const message: IEmbeddedMessage = {
                source: this.source,
                command: requestType,
                data: parameter as IDictionary,
            };

            this.remoteTarget.postMessage(message, "*");

            return true;
        }

        return false;
    };

    /**
     * Schedules a remote message to all subscribed callbacks.
     *
     * @param message The message to distribute.
     */
    public handleRemoteMessage(message: IEmbeddedMessage): void {
        if (message.command === "paste" && message.data) {
            // Special handling for incoming paste events.
            const element = document.activeElement;
            const text = message.data.text as string;
            if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
                const oldValue = element.value;
                const start = element.selectionStart ?? oldValue.length;
                element.value = oldValue.substring(0, start) + text +
                    oldValue.substring(element.selectionEnd ?? start);

                element.selectionStart = start + text.length; // Set the caret at the end of the new text.
                element.selectionEnd = start + text.length;

                const event = new Event("input", { bubbles: true });
                element.dispatchEvent(event);
            }

            return;
        }

        const requestType = message.command as keyof IRequestTypeMap;
        const parameter = message.data as IRequisitionCallbackValues<typeof requestType>;

        const list = this.registry.get(requestType);
        if (list) {
            list.forEach((callback) => {
                void callback(parameter as never);
            });
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

            this.remoteTarget?.postMessage(message, "*");
        } else {
            void navigator.clipboard.writeText(text);
        }
    }
}

parseAppParameters();

export const requisitions = RequisitionHub.instance;
