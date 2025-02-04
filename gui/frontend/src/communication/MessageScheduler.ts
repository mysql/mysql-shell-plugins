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

/// <reference path="../components/CommunicationDebugger/debugger-runtime.d.ts"/>

import { ui } from "../app-logic/UILayer.js";
import { appParameters, requisitions } from "../supplement/Requisitions.js";
import { webSession } from "../supplement/WebSession.js";
import { uuid } from "../utilities/helpers.js";
import { convertObjectKeysCamelToSnakeCase, convertObjectKeysSnakeToCamelCase } from "../utilities/string-helpers.js";

import { JsonParser } from "./JsonParser.js";
import { EventType, type IGenericResponse, type Protocol } from "./Protocol.js";
import { ShellAPIGui, multiResultAPIs, type IErrorResult, type IWebSessionData } from "./ProtocolGui.js";
import { ShellAPIMds } from "./ProtocolMds.js";
import { ShellAPIMrs } from "./ProtocolMrs.js";
import { ShellAPIMsm } from "./ProtocolMsm.js";
import type { IProtocolParameters } from "./ProtocolParameterMapper.js";
import type { IProtocolResults } from "./ProtocolResultMapper.js";
import { ResponseError } from "./ResponseError.js";

export interface IConnectionOptions {
    /** The http(s) URL to connect to. */
    url: URL,

    /** A path for MySQL shell configuration folder. */
    shellConfigDir?: string;
}

/** The type of responses returned by requests. */
type ResponseType<K extends keyof IProtocolResults> = K extends typeof multiResultAPIs[number] ?
    Array<IProtocolResults[K]> : IProtocolResults[K];

/** The type of the promise returned when sending a backend request. */
type ResponsePromise<K extends keyof IProtocolResults> = Promise<ResponseType<K>>;

/**
 * A callback for intermittent results during a request/response process.
 *
 * @param requestId The ID for the request either generated implicitly or specified in the sendRequest call.
 * @param data The data given by the current (intermediate) data response.
 */
export type DataCallback<K extends keyof IProtocolResults> = (data: IProtocolResults[K], requestId: string) => void;

/** Parameters for sending requests to the backend. */
interface ISendRequestParameters<K extends keyof IProtocolParameters> {
    /**
     * If set, this request ID is used instead of an auto generated one.
     */
    requestId?: string;

    /** The type of the request to execute. */
    requestType: K;

    /** Parameters needed for the request. */
    parameters: IProtocolParameters[K];

    /** Fields to be ignored during conversion. */
    caseConversionIgnores?: string[];

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

    /** Fields to be ignored during conversion. */
    caseConversionIgnores?: string[];

    resolve: (value: ResponseType<K>) => void;
    reject: (reason?: unknown) => void;

    onData?: DataCallback<K>;
}

type APIListType = Protocol | ShellAPIGui | ShellAPIMds | ShellAPIMrs | ShellAPIMsm | "native";

/** Wrapper around a web socket that performs (re)connection and message scheduling. */
export class MessageScheduler {
    protected static instance?: MessageScheduler;
    private static readonly multiResultList: readonly APIListType[] = multiResultAPIs;

    protected socket?: WebSocket;

    private debugging = false;
    private disconnecting = false;

    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimeout = 1000; // In milliseconds.

    private ongoingRequests = new Map<string, { protocolType: keyof IProtocolResults; }>();

    #traceEnabled = false;

    public static get get(): MessageScheduler {
        if (!MessageScheduler.instance) {
            MessageScheduler.instance = this.createInstance();
        }

        return MessageScheduler.instance;
    }

    protected constructor() {
        // Singleton pattern.
    }

    protected static createInstance(): MessageScheduler {
        return new MessageScheduler();
    }

    /**
     * @returns True if the connection is established.
     */
    public get isConnected(): boolean {
        if (this.socket) {
            return this.socket.readyState === this.socket.OPEN;
        }

        return false;
    }

    public set inDebugCall(value: boolean) {
        this.debugging = value;
    }

    public set traceEnabled(value: boolean) {
        this.#traceEnabled = value;
    }

    public get traceEnabled(): boolean {
        return this.#traceEnabled;
    }

    /**
     * Opens a web socket connection.
     *
     * @param options Details for the connection.
     *
     * @returns A promise which indicates success or failure.
     */
    public connect(options: IConnectionOptions): Promise<void> {
        this.disconnecting = false;

        // If already open or connecting don't do anything.
        if (this.socket && (this.socket.readyState === this.socket.OPEN ||
            this.socket.readyState === this.socket.CONNECTING)) {
            return Promise.resolve();
        } else {
            const target = new URL(options.url);
            target.protocol = options.url.protocol.replace("http", "ws"); // ws or wss
            target.pathname = "ws1.ws";

            /* istanbul ignore next */
            if (appParameters.inDevelopment) {
                target.port = "8000";
            }

            return new Promise((resolve, reject) => {
                const socket = this.createWebSocket(target, options);

                socket.addEventListener("close", this.onClose.bind(this, options));
                socket.addEventListener("message", this.onMessage);
                socket.addEventListener("open", this.onOpen.bind(this, resolve));
                socket.addEventListener("error", this.onError.bind(this, options, reject));

                this.socket = socket;
            });
        }
    }

    /**
     * Disconnect the socket
     */
    public disconnect(): void {
        if (this.socket) {
            // istanbul ignore catch
            try {
                this.disconnecting = true;
                this.socket.close(); // Careful when specifying a code here. It must be valid or the socket will hang.
                delete this.socket;
                this.socket = undefined;
            } catch (e) {
                console.error("Internal error while closing websocket: " + String(e));
            }
        }
    }

    /**
     * Sends a request to the backend and returns a promise for the expected responses.
     *
     * @param details The type and parameters for the request.
     * @param useExecute A flag to indicate this is actually an execute request, but in the simple form.
     *
     * @returns A promise resolving with a list of responses or a single response received from the backend.
     */
    public sendRequest<K extends keyof IProtocolResults>(
        details: ISendRequestParameters<K>, useExecute = true): ResponsePromise<K> {

        return this.constructAndSendRequest(useExecute, { ...details });
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
     * Creates a web socket for the given options.
     *
     * @param target The endpoint to connect the socket to.
     * @param options Details for the connection.
     *
     * @returns A new websocket instance.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected createWebSocket(target: URL, options: IConnectionOptions): WebSocket {
        return new WebSocket(target);
    }

    /**
     * First entry point for messages sent from the backend. The message is parsed and converted to camel case keys.
     * Depending on the response event type the result of this conversion is then returned in the associated promise
     * or scheduled via the given callback.
     *
     * @param event The event containing the data sent by the backend.
     */
    private onMessage = (event: MessageEvent): void => {
        const nativeResponse = this.parseResponse(event.data);

        if (nativeResponse) {
            if (this.isWebSessionData(nativeResponse) && !this.debugging) {
                const response = convertObjectKeysSnakeToCamelCase(nativeResponse) as IWebSessionData;
                void requisitions.execute("webSessionStarted", response);
            } else if (nativeResponse.request_id) {
                const record = this.ongoingRequests.get(nativeResponse.request_id);
                if (record) {
                    const ongoing = record as IOngoingRequest<typeof record.protocolType>;

                    const response = convertObjectKeysSnakeToCamelCase(nativeResponse,
                        { ignore: ongoing.caseConversionIgnores }) as IGenericResponse;

                    switch (response.eventType) {
                        case EventType.DataResponse: {
                            // It's a normal data response.
                            if (ongoing.onData) {
                                ongoing.onData(response, response.requestId);
                            } else {
                                ongoing.result.push(response);
                            }

                            break;
                        }

                        case EventType.EndResponse: {
                            if (MessageScheduler.multiResultList.includes(record.protocolType)) {
                                ongoing.result.push(response);
                                ongoing.resolve(ongoing.result);
                            } else {
                                ongoing.resolve(response);
                            }

                            break;
                        }

                        case EventType.FinalResponse: {
                            this.ongoingRequests.delete(response.requestId);
                            if (MessageScheduler.multiResultList.includes(record.protocolType) ||
                                ongoing.result.length === 0) {
                                ongoing.resolve(ongoing.result);
                            } else {
                                ongoing.resolve(ongoing.result[0]);
                            }

                            break;
                        }

                        case EventType.ErrorResponse: {
                            this.ongoingRequests.delete(response.requestId);
                            ongoing.reject(new ResponseError(response as IErrorResult));

                            break;
                        }

                        case EventType.CancelResponse: {
                            this.ongoingRequests.delete(response.requestId);
                            ongoing.resolve([]);

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
     * @param details The type and parameters for the request.
     *
     * @returns A promise resolving with a list of responses received from the backend.
     */
    private constructAndSendRequest<K extends keyof IProtocolResults>(isExecuteRequest: boolean,
        details: ISendRequestParameters<K>): ResponsePromise<K> {

        const requestId = details.requestId ?? uuid();

        return new Promise((resolve, reject) => {
            const record = {
                requestId,
                request: (isExecuteRequest ? "execute" : details.requestType),
                command: (isExecuteRequest ? details.requestType : undefined),
                ...details.parameters,
            };

            const data = convertObjectKeysCamelToSnakeCase(record,
                { ignore: details.caseConversionIgnores }) as INativeShellRequest;

            if (this.traceEnabled) {
                void requisitions.execute("debugger", { request: data });
            }

            const ongoingRequest: IOngoingRequest<K> = {
                protocolType: details.requestType,
                result: [],
                caseConversionIgnores: details.caseConversionIgnores,
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
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;

            void ui.showInformationMessage("Connection to the backend established.", {});
        }
        this.reconnectTimeout = 1000;

        void requisitions.execute("socketStateChanged", true).then(() => {
            resolve();
        });
    };

    /**
     * Called when the socket is closed or failed to open. Unfortunately, the given close code is always the same
     * (1006) and the close reason is always empty.
     *
     * @param options The options used to open the websocket. Needed for automatic reconnect.
     */
    private onClose = (options: IConnectionOptions): void => {
        webSession.clearSessionData();
        void requisitions.execute("socketStateChanged", false);

        if (!this.disconnecting && !this.debugging) {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }

            this.reconnectTimer = setTimeout(() => {
                // Do not clear the timer variable here as indicator in case we need another reconnection attempt.
                void this.connect(options);
            }, this.reconnectTimeout);
        }
    };

    /**
     * Called when an error occurred in the socket connection.
     *
     * @param options The options used to open the websocket. Needed for automatic reconnect.
     * @param reject The reject function to call to signal that the connection had a failure to open.
     * @param event Event that gives more info about the error.
     */
    private onError = (options: IConnectionOptions, reject: (reason?: string) => void, event: Event): void => {
        reject(JSON.stringify(event, undefined, 4));

        this.reconnectTimeout *= 2;
        if (this.reconnectTimer) {
            // This was a automatic reconnection attempt and failed. So, try again with a higher
            // timeout value.
            this.reconnectTimer = setTimeout(() => {
                void this.connect(options);
            }, this.reconnectTimeout);
        }

        void ui.showErrorMessage(`Could not establish a connection to the backend. Make sure you ` +
            `use valid user credentials and the MySQL Shell is running. Trying to reconnect in ` +
            `${this.reconnectTimeout / 1000} seconds.`, {});
    };

    /**
     * Processes the raw backend data record and converts it to a response usable in the application.
     * It returns an object with the response type and the data received.
     *
     * @param data The data received by the web socket.
     *
     * @returns The generated response object. Can be undefined if the incoming data does not conform to the expected
     *          format.
     */
    private parseResponse = (data: unknown): INativeShellResponse | undefined => {
        if (!data || !(typeof data === "string")) {
            return undefined;
        }

        try {
            const responseObject = JsonParser.parseJson(data) as INativeShellResponse;
            if (this.traceEnabled) {
                void requisitions.execute("debugger", { response: responseObject });
            }

            switch (responseObject.request_state.type) {
                case "ERROR": {
                    responseObject.event_type = EventType.ErrorResponse;
                    break;
                }

                case "PENDING": {
                    if (responseObject.request_state.msg === "Execution started...") {
                        responseObject.event_type = EventType.StartResponse; // Carries no result data.
                    } else {
                        responseObject.event_type = EventType.DataResponse;
                    }
                    break;
                }

                case "OK": {
                    if (responseObject.done) {
                        responseObject.event_type = EventType.FinalResponse;
                    } else {
                        responseObject.event_type = EventType.EndResponse;
                    }

                    break;
                }

                case "CANCELLED": {
                    responseObject.event_type = EventType.CancelResponse;
                    break;
                }

                default: {
                    responseObject.event_type = EventType.Unknown;
                    break;
                }
            }

            return responseObject;
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void ui.showErrorMessage(`Could not parse JSON response from MySQL Shell (${message}).`, {});
        }
    };

    private isWebSessionData(response: unknown): response is IWebSessionData {
        const candidate = response as object;

        return ("session_uuid" in candidate) && candidate.session_uuid !== undefined;
    }
}
