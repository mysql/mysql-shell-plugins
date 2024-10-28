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

import type { IDictionary } from "../app-logic/general-types.js";
import type { IEmbeddedMessage, IEmbeddedSourceType } from "../communication/index.js";
import { RequisitionPipeline } from "./RequisitionPipeline.js";
import type {
    IAppParameters, IRemoteTarget, IRequestTypeMap, IRequisitionCallbackValues, IWebviewProvider,
} from "./RequisitionTypes.js";

/** A set of values passed to the application via URL parameters and a couple other application wide values. */
export const appParameters: Map<string, string> & IAppParameters = new Map<string, string>();

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
     * @param cut If true then the event is a cut event, otherwise it is a copy event.
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
