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

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { default as NodeWebSocket } from "ws";

import { CommunicationEvents, IShellRequest, IWebSessionData } from ".";
import { appParameters, requisitions } from "../supplement/Requisitions";
import {
    dispatcher, IDispatchEventContext, ListenerEntry, eventFilterNoRequests,
} from "../supplement/Dispatch";
import { convertSnakeToCamelCase } from "../utilities/helpers";

export enum ConnectionEventType {
    Open = 1,
    Close,
    Error,
    Message,
}

/** Wrapper around a web socket that performs (re)connection and message scheduling. */
export class MessageScheduler {
    private static instance?: MessageScheduler;

    private debugging = false;

    private connectionEstablished = false;
    private autoReconnecting = false;
    private disconnecting = false;

    private reconnectTimer: ReturnType<typeof setTimeout> | null;

    private socket?: WebSocket | NodeWebSocket;

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
