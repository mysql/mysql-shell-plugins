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

/// <reference path="../components/CommunicationDebugger/debugger-runtime.d.ts"/>

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { default as NodeWebSocket } from "ws";

import {
    EventType, IGenericResponse, IWebSessionData, multiResultAPIs, Protocol, ShellAPIGui, ShellAPIMds, ShellAPIMrs,
    ResponseError, IErrorResult,
} from ".";
import { appParameters, requisitions } from "../supplement/Requisitions";
import { webSession } from "../supplement/WebSession";
import { convertCamelToSnakeCase, convertSnakeToCamelCase, uuid } from "../utilities/helpers";

import { IProtocolParameters } from "./ProtocolParameterMapper";
import { IProtocolResults } from "./ProtocolResultMapper";
import { IDictionary } from "../app-logic/Types";

export enum ConnectionEventType {
    Open = 1,
    Close,
    Error,
    Message,
}

/** The type of responses returned by requests. */
export type ResponseType<K extends keyof IProtocolResults> = K extends typeof multiResultAPIs[number] ?
    Array<IProtocolResults[K]> : IProtocolResults[K];

/** The type of the promise returned when sending a backend request. */
export type ResponsePromise<K extends keyof IProtocolResults> = Promise<ResponseType<K>>;

/**
 * A callback for intermittent results during a request/response process.
 *
 * @param requestId The ID for the request either generated implicitly or specified in the sendRequest call.
 * @param data The data given by the current (intermediate) data response.
 */
export type DataCallback<K extends keyof IProtocolResults> = (data: IProtocolResults[K], requestId: string) => void;

/** Parameters for sending requests to the backend. */
export interface ISendRequestParameters<K extends keyof IProtocolParameters> {
    /**
     * If set, this request ID is used instead of an auto generated one.
     */
    requestId?: string;

    /** The type of the request to execute. */
    requestType: K;

    /** Parameters needed for the request. */
    parameters: IProtocolParameters[K];

    /**
     * When specified this callback is used for data responses, instead of collecting and returning them in the
     * promise. In this case the promise only returns the last sent response data (if any).
     * Do not assign a function for this if you expect only a single response.
     */
    onData?: DataCallback<K>;
}

/** Keeps data and promise callbacks for an ongoing BE request together. */
interface IOngoingRequest<K extends keyof IProtocolResults> {
    /** Holds the key in the protocol result mapper. */
    protocolType: K;

    /** Data from data responses is collected here, if no callback is given. */
    result: Array<IProtocolResults[K]>;

    resolve: (value: ResponseType<K>) => void;
    reject: (reason?: unknown) => void;

    onData?: DataCallback<K>;
}

type IErrorInfo = IGenericResponse & { result: { info: string; }; };
type APIListType = Protocol | ShellAPIGui | ShellAPIMds | ShellAPIMrs | "native";

/** Wrapper around a web socket that performs (re)connection and message scheduling. */
export class MessageScheduler {
    private static instance?: MessageScheduler;
    private static readonly multiResultList: readonly APIListType[] = multiResultAPIs;

    private debugging = false;
    private traceEnabled = false;

    private connectionEstablished = false;
    private autoReconnecting = false;
    private disconnecting = false;

    private reconnectTimer: ReturnType<typeof setTimeout> | null;

    private socket?: WebSocket | NodeWebSocket;
    private ongoingRequests = new Map<string, { protocolType: keyof IProtocolResults; }>();

    public static get get(): MessageScheduler {
        if (!MessageScheduler.instance) {
            MessageScheduler.instance = new MessageScheduler();
        }

        return MessageScheduler.instance;
    }

    private constructor() {
        // Singleton pattern.
    }

    /**
     * @returns True if the connection is established.
     */
    public get isConnected(): boolean {
        if (this.socket) {
            return this.connectionEstablished && this.socket.readyState === this.socket.OPEN;
        }

        return false;
    }

    public set inDebugCall(value: boolean) {
        this.debugging = value;
    }

    public set traceMessages(value: boolean) {
        this.traceEnabled = value;
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
                this.socket = undefined;
            } catch (e) {
                /* istanbul ignore next */
                console.error("Internal error while closing websocket: " + String(e));
            }
        }
    }

    /**
     * Sends a request to the backend and returns a promise for the expected responses.
     *
     * @param details The type and parameters for the request.
     * @param useExecute A flag to indicate this is actually an execute request, but in the simple form.
     * @param caseConversionIgnores Ignore case conversions for items in this list
     *
     * @returns A promise resolving with a list of responses or a single response received from the backend.
     */
    public sendRequest<K extends keyof IProtocolResults>(
        details: ISendRequestParameters<K>, useExecute = true,
        caseConversionIgnores: string[] = []): ResponsePromise<K> {

        return this.constructAndSendRequest(useExecute, caseConversionIgnores, {
            ...details,
        });
    }

    /**
     * Sends a request to the backend which is not processed in any way (camel case conversion etc.).
     * This is mostly useful for communication debugging.
     *
     * @param details The raw request structure.
     * @param callback A callback for intermediate results.
     *
     * @returns A promise resolving with a single response received from the backend.
     */
    public sendRawRequest(details: INativeShellRequest,
        callback?: DataCallback<"native">): Promise<INativeShellResponse> {
        details.request_id = details.request_id ?? uuid();

        return new Promise((resolve, reject) => {
            if (this.traceEnabled) {
                void requisitions.execute("debugger", { request: details });
            }

            const ongoingRequest: IOngoingRequest<"native"> = {
                protocolType: "native",
                result: [],
                resolve,
                reject,
                onData: callback,
            };
            this.ongoingRequests.set(details.request_id, ongoingRequest);

            this.socket?.send(JSON.stringify(details));
        });
    }

    /**
     * First entry point for messages sent from the backend. The message is parsed and converted to camel case keys.
     * Depending on the response event type the result of this conversion is then returned in the associated promise
     * or scheduled via the given callback.
     *
     * @param event The event containing the data sent by the backend.
     */
    private onMessage = (event: MessageEvent | NodeWebSocket.MessageEvent): void => {
        const response = this.convertDataToResponse(event.data);

        if (response) {
            if (this.isWebSessionData(response) && !this.debugging) {
                void requisitions.execute("webSessionStarted", response);
            } else if (response.requestId) {
                const record = this.ongoingRequests.get(response.requestId);
                if (record) {
                    const ongoing = record as IOngoingRequest<typeof record.protocolType>;
                    const data = response as IProtocolResults[typeof record.protocolType];

                    switch (response.eventType) {
                        case EventType.DataResponse: {
                            // Some APIs do not return error responses, but data responses with an error field
                            // and/or message. We have to handle them here manually.
                            if (this.isErrorInfo(response)) {
                                const index = response.result.info.indexOf("ERROR:");
                                if (index > -1) {
                                    const error = response.result.info.substring(index);

                                    this.ongoingRequests.delete(response.requestId);
                                    ongoing.reject(error);

                                    break;
                                }
                            }

                            // It's a normal data response.
                            if (ongoing.onData) {
                                ongoing.onData(data, response.requestId);
                            } else {
                                ongoing.result.push(data);
                            }

                            break;
                        }

                        case EventType.FinalResponse: {
                            // For now we treat the final response like a done response, as not all responses
                            // use the "done" field yet.
                            this.ongoingRequests.delete(response.requestId);

                            if (MessageScheduler.multiResultList.includes(record.protocolType)) {
                                ongoing.result.push(data);
                                ongoing.resolve(ongoing.result);
                            } else {
                                ongoing.resolve(data);
                            }

                            break;
                        }

                        case EventType.DoneResponse: {
                            this.ongoingRequests.delete(response.requestId);
                            ongoing.resolve(ongoing.result);

                            break;
                        }

                        case EventType.ErrorResponse: {
                            this.ongoingRequests.delete(response.requestId);

                            // There are differences in how error responses are structured. Sometimes they have a
                            // nested requestState field.
                            const result = (data as IDictionary).result as object;
                            if (result && "requestState" in result) {
                                ongoing.reject(new ResponseError(result as IErrorResult));
                            } else {
                                ongoing.reject(new ResponseError(data as IErrorResult));
                            }

                            break;
                        }

                        default:
                    }
                }
            }
        }
    };

    /**
     * This is the core method to send a request to the backend.
     *
     * @param isExecuteRequest True if the request must be sent as execution request.
     * @param caseConversionIgnores Ignore case conversions for items in this list
     * @param details The type and parameters for the request.
     *
     * @returns A promise resolving with a list of responses received from the backend.
     */
    private constructAndSendRequest<K extends keyof IProtocolResults>(isExecuteRequest: boolean,
        caseConversionIgnores: string[],
        details: ISendRequestParameters<K>): ResponsePromise<K> {

        const requestId = details.requestId ?? uuid();

        return new Promise((resolve, reject) => {
            const record = {
                requestId,
                request: (isExecuteRequest ? "execute" : details.requestType),
                command: (isExecuteRequest ? details.requestType : undefined),
                ...details.parameters,
            };

            caseConversionIgnores = caseConversionIgnores.concat(["rows"]);

            const data = convertCamelToSnakeCase(record, { ignore: caseConversionIgnores }) as INativeShellRequest;

            if (this.traceEnabled) {
                void requisitions.execute("debugger", { request: data });
            }

            const ongoingRequest: IOngoingRequest<K> = {
                protocolType: details.requestType,
                result: [],
                resolve,
                reject,
                onData: details.onData,
            };
            this.ongoingRequests.set(requestId, ongoingRequest);

            this.socket?.send(JSON.stringify(data));
        });
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
        void requisitions.execute("socketStateChanged", true).then(() => {
            resolve();
        });
    };


    /**
     * Called when the socket is closed or failed to open. Unfortunately, the given close code is always the same
     * (1006) and the close reason is always empty.
     */
    private onClose = (): void => {
        const wasConnected = this.connectionEstablished;

        this.connectionEstablished = false;
        this.autoReconnecting = false;

        webSession.clearSessionData();
        void requisitions.execute("socketStateChanged", false);

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

    /**
     * Processes the raw backend data record and converts it to a response usable in the application.
     * This involves convert snake casing to camel case and determining the type of the response.
     *
     * @param data The data received by the web socket.
     *
     * @returns The generated response object. Can be undefined if the incoming data does not conform to the expected
     *          format.
     */
    private convertDataToResponse = (data: unknown): IGenericResponse | undefined => {
        if (!data || !(typeof data === "string")) {
            return undefined;
        }

        const responseObject = JSON.parse(data) as INativeShellResponse;
        if (this.traceEnabled) {
            void requisitions.execute("debugger", { response: responseObject });
        }

        const response = convertSnakeToCamelCase(responseObject, { ignore: ["rows"] }) as IGenericResponse;

        switch (response.requestState.type) {
            case "ERROR": {
                response.eventType = EventType.ErrorResponse;
                break;
            }

            case "PENDING": {
                if (response.requestState.msg === "Execution started...") {
                    response.eventType = EventType.StartResponse; // Carries no result data.
                } else {
                    response.eventType = EventType.DataResponse;
                }
                break;
            }

            case "OK": {
                if (response.done) {
                    response.eventType = EventType.DoneResponse;
                } else {
                    response.eventType = EventType.FinalResponse;
                }
                break;
            }

            default: {
                response.eventType = EventType.Unknown;
                break;
            }
        }

        return response;
    };

    private isErrorInfo(response: IGenericResponse): response is IErrorInfo {
        return (response as IErrorInfo).result && (response as IErrorInfo).result.info !== undefined;
    }

    private isWebSessionData(response: unknown): response is IWebSessionData {
        return (response as IWebSessionData).sessionUuid !== undefined;
    }
}
