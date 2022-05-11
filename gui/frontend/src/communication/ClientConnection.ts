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

/* eslint-disable max-classes-per-file */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { default as NodeWebSocket } from "ws";

import { CommunicationEvents, IShellRequest, IWebSessionData, Protocol } from ".";
import { appParameters, requisitions } from "../supplement/Requisitions";
import {
    dispatcher, IDispatchEventContext, ListenerEntry, eventFilterNoRequests, DispatchEvents, EventType, IDispatchEvent,
} from "../supplement/Dispatch";
import {
    convertSnakeToCamelCase, convertCamelToSnakeCase, deepEqual, sleep, strictEval, uuid,
} from "../utilities/helpers";

import { IGenericResponse } from "./GeneralEvents";

import { IDictionary } from "../app-logic/Types";

export enum ConnectionEventType {
    Open = 1,
    Close,
    Error,
    Message,
}

// Wrapper around a web socket that performs (re)connection and message scheduling.
export class ClientConnection {

    protected debugging = false;
    protected loadedScripts: Map<string, string>;

    private connectionEstablished = false;
    private autoReconnecting = false;
    private disconnecting = false;

    private reconnectTimer: ReturnType<typeof setTimeout> | null;

    private socket?: WebSocket | NodeWebSocket;

    /**
     * @returns True if the connection is established.
     */
    public get isConnected(): boolean {
        if (this.socket) {
            return this.connectionEstablished && this.socket.readyState === this.socket.OPEN;
        }

        return false;
    }

    /**
     * Used by the debugger to inject content of scripts that have been loaded.
     * For use with the execute call.
     */
    public set scripts(map: Map<string, string>) {
        this.loadedScripts = map;
    }

    /**
     * Opens a web socket connection.
     *
     * @param url The target to connect to. This is a normal http(s) target from which the websocket address is
     *            derived.
     * @param shellConfigDir The current shell configuration folder, which can be different, depending on the
     *                       current host. Only needed when running from the extension (under Node.js).
     *
     * @returns A promise which indicates success or failure.
     */
    public connect(url: URL, shellConfigDir: string): Promise<void> {
        this.disconnecting = false;

        return new Promise((resolve, reject) => {
            // If already open or connecting don't do anything.
            if (this.socket && (this.socket.readyState === this.socket.OPEN ||
                this.socket.readyState === this.socket.CONNECTING)) {
                resolve();
            } else {
                url.protocol = url.protocol.replace("http", "ws"); // ws or wss
                url.pathname = "ws1.ws";

                /* istanbul ignore next */
                if (appParameters.inDevelopment) {
                    url.port = "8000";
                }

                if (typeof WebSocket !== "undefined") {
                    const socket = new WebSocket(url.toString());

                    socket.addEventListener("close", this.onClose);
                    socket.addEventListener("message", this.onMessage);
                    socket.addEventListener("open", this.onOpen.bind(this, resolve));
                    socket.addEventListener("error", this.onError.bind(this, reject));

                    this.socket = socket;
                } else {
                    const caFile = join(shellConfigDir, "plugin_data/gui_plugin/web_certs/rootCA.crt");

                    let ca;
                    if (existsSync(caFile)) {
                        ca = readFileSync(caFile);
                    }

                    const socket = new NodeWebSocket(url.toString(), { ca });

                    socket.addEventListener("close", this.onClose);
                    socket.addEventListener("message", this.onMessage);
                    socket.addEventListener("open", this.onOpen.bind(this, resolve));
                    socket.addEventListener("error", this.onError.bind(this, reject));

                    this.socket = socket;
                }
            }
        });
    }

    /**
     * Disconnect the socket
     */
    public disconnect(): void {
        if (this.socket) {
            try {
                this.disconnecting = true;
                this.socket.close(); // Careful when specifying a code here. It must be valid or the socket will hang.
                delete this.socket;
            } catch (e) {
                /* istanbul ignore next */
                console.error("Internal error while closing websocket: " + String(e));
            }
        }
    }

    /**
     * Send a request to the shell. Create a listener so that the caller can wait for the response.
     *
     * @param request The request to send to the shell. It must use snake case for its member fields.
     * @param context Context data to supply to the listener when the response arrives.
     * @returns a listener that waits for the shell response
     */
    public sendRequest(request: IShellRequest, context: IDispatchEventContext): ListenerEntry {
        dispatcher.mapMessageContext(request.request_id, context);
        const listener = ListenerEntry.createByID(request.request_id, { filters: [eventFilterNoRequests] });

        this.socket?.send(JSON.stringify(request));

        if (!this.debugging) {
            dispatcher.triggerEvent(CommunicationEvents.generateRequestEvent(request));
        }

        return listener;
    }

    public clearState(): void {
        // no-op
    }

    /**
     * Called when the socket is opened.
     *
     * @param resolve The resolver function to signal when the socket connection is available.
     */
    private onOpen = (resolve: (value: void | PromiseLike<void>) => void): void => {
        if (this.autoReconnecting) {
            this.autoReconnecting = false;

            // TODO: convert this error message to a message toast.
            void requisitions.execute("showError", [
                "Connection Recovering",
                "The connection was automatically re-establish after a failure.",
            ]);
        }

        if (this.reconnectTimer) {
            // Clear the timer for the disconnection message, since the connection is back.
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.connectionEstablished = true;
        dispatcher.triggerNotification("socketOpened");
        resolve();
    };


    /**
     * Called when the socket is closed or failed to open. Unfortunately, the given close code is always the same
     * (1006) and the close reason is always empty.
     */
    private onClose = (): void => {
        const wasConnected = this.connectionEstablished;

        this.connectionEstablished = false;
        this.autoReconnecting = false;
        dispatcher.triggerNotification("socketClosed");

        if (!this.disconnecting && !this.debugging) {
            if (wasConnected) {
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                }

                // Show the disconnection error only after 3 seconds, to allow automatic reconnection without disturbing
                // the user (which can also happen when the computer went to sleep).
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    void requisitions.execute("showError", [
                        "Browser Connection Error",
                        "The connection was interrupted unexpectedly. An automatic reconnection failed, but the " +
                        "application will continue trying to reconnect.",
                    ]);
                }, 3000);
            }
        }
    };

    private onMessage = (event: MessageEvent | NodeWebSocket.MessageEvent): void => {
        // Convert message data string to object and also convert from snake case to camel case.
        // However, ignore row data in this process, as it either comes as array (no keys to convert) or comes
        // as object, whose keys are the real column names (which must stay as is).
        if (event.data) { // Sanity check. Should never happen.
            const data = JSON.parse(event.data as string) as object;
            const serverData = convertSnakeToCamelCase(data, { ignore: ["rows"] }) as IWebSessionData;

            // Note: the context given here by the event factories is replaced by the one specified for a specific
            //       request in the sendRequest call. Only in error cases the context from here might be used.
            if (serverData.sessionUuid) {
                dispatcher.triggerEvent(CommunicationEvents.generateWebSessionEvent(serverData), this.debugging);
            } else {
                dispatcher.triggerEvent(CommunicationEvents.generateResponseEvent("serverResponse", serverData),
                    this.debugging);
            }
        }
    };

    /**
     * Called when an error occurred in the socket connection.
     *
     * @param reject The reject function to call to signal that the connection had a failure to open.
     * @param event Event that gives more info about the error.
     */
    private onError = (reject: (reason?: unknown) => void, event: Event | NodeWebSocket.ErrorEvent): void => {
        if ((event as NodeWebSocket.ErrorEvent).message) {
            reject((event as NodeWebSocket.ErrorEvent).message);
        } else {
            reject(String(event));
        }

        void requisitions.execute("showError", [
            "Communication Error",
            "Could not establish a connection to the backend.",
        ]);
    };


}

// This class not only implements the singleton pattern, but also provides some additional functionality
// used in the connection debugger.
class ClientConnectionSingleton extends ClientConnection {
    public tokens = {};

    private lastGeneratedId: string;
    private lastReceivedModuleSessionId: string;
    private lastReceivedResponse: IGenericResponse | undefined;

    public get lastGeneratedRequestId(): string {
        return this.lastGeneratedId;
    }

    public get lastModuleSessionId(): string {
        return this.lastReceivedModuleSessionId;
    }

    public get lastResponse(): IGenericResponse | undefined {
        return this.lastReceivedResponse;
    }

    public clearState(): void {
        this.tokens = {};
        this.lastGeneratedId = "";
        this.lastReceivedModuleSessionId = "";
        this.lastReceivedResponse = undefined;
    }

    public async doSend(data: IShellRequest): Promise<IGenericResponse> {
        return new Promise((resolve) => {
            const request = Protocol.getStandardRequest(data.request, data);

            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;

                resolve({
                    requestId: data.request_id,
                    requestState: { type: "error", msg: "No response from backend in 3 seconds" },
                });
            }, 3000);

            const setLastResponse = (event: IDictionary): void => {
                clearTimeout(timer);
                if (!timedOut) { // Ignore results from timed-out responses.
                    this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                    if ((event.data as IDictionary).moduleSessionId) {
                        this.lastReceivedModuleSessionId = (event.data as IDictionary).moduleSessionId as string;
                    }
                    resolve(this.lastReceivedResponse);
                }

            };

            this.sendRequest(request, { messageClass: "debugger" }).then((event) => {
                setLastResponse(event as IDictionary);
            }).catch((event) => {
                setLastResponse(event as IDictionary);
            });
        });
    }

    /**
     * Awaitable method to send a request to the backend.
     * Note: the returned promise can only be used to wait for the first response. If there are more you have to use
     *       `getNextSequentialResponse` until it returns no value anymore.
     *
     * @param data The request details.
     * @returns A promise to handle the response of the server.
     */
    public async send(data: IShellRequest): Promise<IGenericResponse> {
        let result;
        try {
            this.debugging = true;

            result = await this.doSend(data);
        } finally {
            this.debugging = false;
        }

        return result;
    }

    /**
     * Generates a new uuid that can be used in communication requests.
     *
     * @returns The new request ID.
     */
    public generateRequestId(): string {
        this.lastGeneratedId = uuid();

        return this.lastGeneratedId;
    }

    public log(output: string): void {
        const event = DispatchEvents.baseEvent(EventType.Notification, { output }, undefined, "debugger");
        dispatcher.triggerEvent(event);
    }

    /**
     * Validation (test) function to determine if two responses are equal. The comparison is recursively done on a
     * field-by-field basis, so that the order of the fields doesn't matter. Additionally, special values are supported
     * to guide and enhance the comparison process. See the fields/functions: `ignore` and `matchRegexp`.
     *
     * The function will send the comparison result to the log as comments.
     *
     * @param actual A single response received from the backend.
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateResponse(actual?: IGenericResponse, expected?: IGenericResponse, responseIndex?: number): boolean {
        const result = deepEqual(expected, actual);
        const indexText = responseIndex !== undefined ? ` (response ${responseIndex})` : "";
        if (result) {
            this.log(`/* Validation successful${indexText}. */`);

            return true;
        } else {
            this.log(`/* WARNING: values differ${indexText}.\nActual:
${JSON.stringify(actual, undefined, 4)}
Expected:\n${JSON.stringify(expected, undefined, 4)}\n*/`);

            return false;
        }
    }

    /**
     * Convenience function to validate the last received response. It uses `validateResponse` to do the actual work.
     *
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateLastResponse(expected: IGenericResponse, responseIndex?: number): boolean {
        return this.validateResponse(this.lastReceivedResponse, expected, responseIndex);
    }

    /**
     * Sends the specified request to the backend and waits for the responses. Fulfills the returned promise when all
     * responses arrived or a timeout of 3 seconds happened, whatever comes first.
     *
     * @param data The request to send.
     * @param expected A list of responses to compare to. The function will not fulfill the promise until the same
     *                 number of responses have been received, as there are items in this list. If not enough responses
     *                 came in during a specific time frame (3 secs currently) the validation will fail.
     *                 Any extraneous response is ignored, once all items in the expected list have been processed.
     */
    public async sendAndValidate(data: IShellRequest, expected: IGenericResponse[]): Promise<void> {
        if (expected.length === 0) {
            this.log("/* WARNING: No expectations found. */");
        }

        this.debugging = true;
        try {
            const request = Protocol.getStandardRequest(data.request, data);

            let currentIndex = 0;
            this.lastReceivedResponse = undefined;
            let failed = false;

            this.sendRequest(request, { messageClass: "debuggerValidate" }).then((event: IDispatchEvent) => {
                // Ignore any extraneous responses.
                if (currentIndex < expected.length) {
                    this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                    failed = failed ||
                        !this.validateResponse(this.lastReceivedResponse, expected[currentIndex], currentIndex++);

                    if (event.data.moduleSessionId) {
                        this.lastReceivedModuleSessionId = event.data.moduleSessionId as string;
                    }
                }
            }).catch((event) => {
                this.lastReceivedResponse = convertCamelToSnakeCase(event.data as object) as IGenericResponse;
                failed = true;

                // No error printout here. The debugger has a global event listener doing that.
            });

            let attempt = 0;
            while (attempt++ < 10 && !failed && currentIndex < expected.length) {
                await sleep(300);
            }

            if (failed) {
                this.log("/* WARNING: At least one validation failed. */");
            } else if (currentIndex < expected.length) {
                this.log("/* WARNING: Validation incomplete. Not enough responses came in during the timeout of 3 " +
                    "seconds. */");
            } else {
                this.log("/* All validations succeeded. */");
            }
        } finally {
            this.debugging = false;
        }
    }

    /**
     * Loads the script at the given path and executes it.
     *
     * @param path The path to the script to execute.
     */
    public async execute(path: string): Promise<void> {
        const code = this.loadedScripts.get(path);
        if (!code) {
            this.log("/* ERROR: Code of " + path + " not found. */");

            return;
        }

        try {
            await strictEval("(async () => {" + code + "})()");
        } catch (e) {
            throw new Error(String(e) + " (" + path + ")");
        }
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be ignored
     * when comparing the owning object/array to another object/array.
     *
     * @returns A special symbol.
     */
    public get ignore(): object {
        return {
            symbol: Symbol("ignore"),
        };
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be matched against
     * the given pattern, when comparing the owning object/array to another object/array.
     *
     * @param pattern The pattern to match.
     * @returns A special symbol.
     */
    public matchRegexp(pattern: string): object {
        return {
            symbol: Symbol("regex"),
            parameters: pattern,
        };
    }

    /**
     * Returns a marker value which indicates that the member in an object or array should be matched against
     * the given list, when comparing the owning object/array to another object/array.
     *
     * @param list The list to match.
     * @param full A flag stating if
     * @returns A special symbol.
     */
    public matchList(list: unknown[], full = true): object {
        return {
            symbol: Symbol("list"),
            parameters: { list, full },
        };
    }

}

export const currentConnection: ClientConnection = new ClientConnectionSingleton();
