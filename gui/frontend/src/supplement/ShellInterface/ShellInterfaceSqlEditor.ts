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

import { EventType, ListenerEntry } from "../Dispatch";
import {
    ProtocolGui, currentConnection, ICommErrorEvent, ICommStartSessionEvent, ShellAPIGui, ICommSimpleResultEvent,
    ShellPromptResponseType,
} from "../../communication";
import { webSession } from "../WebSession";
import { settings } from "../Settings/Settings";
import { ShellInterfaceDb, ShellInterfaceMds, ShellInterfaceMrs } from ".";

export class ShellInterfaceSqlEditor extends ShellInterfaceDb {

    public mds: ShellInterfaceMds = new ShellInterfaceMds();
    public mrs: ShellInterfaceMrs = new ShellInterfaceMrs();

    public get id(): string {
        return "sqlEditor";
    }

    /**
     * @returns a flag which indicates if a session was opened already.
     */
    public get hasSession(): boolean {
        return this.moduleSessionId !== undefined;
    }

    /**
     * Begins a new session for a specific SQL editor. This overrides the underlying DB session handling.
     *
     * @param id A value identifying the SQL editor.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public startSession(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.moduleSessionLookupId = this.id + "." + id;
            this.mrs.moduleSessionLookupId = this.moduleSessionLookupId;

            if (this.hasSession) {
                resolve();
            }

            const request = ProtocolGui.getRequestSqleditorStartSession();
            const listener = currentConnection.sendRequest(request,
                { messageClass: ShellAPIGui.GuiSqleditorStartSession });

            listener.then((event: ICommStartSessionEvent) => {
                if (event.data) {
                    webSession.setModuleSessionId(this.moduleSessionLookupId, event.data.moduleSessionId);

                    resolve();
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    /**
     * Closes this editor session and all open connections.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public closeSession(): Promise<void> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                resolve();
            } else {
                const request = ProtocolGui.getRequestSqleditorCloseSession(id);
                currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorCloseSession })
                    .then(() => {
                        webSession.setModuleSessionId(this.moduleSessionLookupId);
                        resolve();
                    }).catch((event: ICommErrorEvent) => {
                        reject(event.message);
                    });
            }
        });
    }

    /**
     * Returns information of how the modules should be displayed in the gui.
     *
     * @returns A listener for the response
     */
    public getGuiModuleDisplayInfo(): ListenerEntry {
        const request = ProtocolGui.getRequestSqleditorGetGuiModuleDisplayInfo();

        return currentConnection.sendRequest(request, { messageClass: "getModuleDisplayInfo" });
    }

    /**
     * Returns true as this extension object holds the backend implementation of a gui module.
     *
     * @returns A listener for the response
     */
    public isGuiModuleBackend(): ListenerEntry {
        const request = ProtocolGui.getRequestSqleditorIsGuiModuleBackend();

        return currentConnection.sendRequest(request, { messageClass: "isGuiModuleBackend" });
    }

    /**
     * Opens the database connection.
     *
     * @param dbConnectionId The id of the db connection.
     *
     * @returns A listener for the response
     */
    public openConnection(dbConnectionId: number): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorOpenConnection(dbConnectionId, id);

        return currentConnection.sendRequest(request, { messageClass: "openConnection" });
    }

    /**
     * Executes the given SQL.
     *
     * @param sql The sql command to execute.
     * @param params The module session the function should operate on.
     *
     * @returns A listener for the response
     */
    public execute(sql: string, params?: string[]): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorExecute(sql, id, params,
            { rowPacketSize: settings.get("sql.rowPacketSize", 1000) });

        return currentConnection.sendRequest(request, { messageClass: "execute" });
    }

    /**
     * Reconnects the database connection.
     *
     * @returns A listener for the response
     */
    public reconnect(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorReconnect(id);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorReconnect });
    }

    /**
     * Stops the currently running query (if there's any).
     *
     * @returns A listener for the response
     */
    public killQuery(): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestSqleditorKillQuery(id);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorKillQuery });
    }

    /**
     * Sets the auto commit mode for the current connection.
     * Note: this mode can implicitly be changed by executing certain SQL code (begin, set autocommit, rollback, etc.).
     *
     * @param value A flag indicating if the mode should be enabled or disabled.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public setAutoCommit(value: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                return resolve();
            }

            const request = ProtocolGui.getRequestSqleditorSetAutoCommit(id, value);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorSetAutoCommit })
                .then((event: ICommSimpleResultEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve();
                    }
                })
                .catch((event) => {
                    reject(event.message);
                });
        });
    }

    /**
     * Returns the current auto commit mode, if supported.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public getAutoCommit(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                return resolve(false);
            }

            const request = ProtocolGui.getRequestSqleditorGetAutoCommit(id);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorGetAutoCommit })
                .then((event: ICommSimpleResultEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve((event.data?.result as number) !== 0);
                    }
                })
                .catch((event) => {
                    reject(event.message);
                });
        });
    }

    /**
     * Returns the current default schema, if supported.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public getCurrentSchema(): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                return resolve("");
            }

            const request = ProtocolGui.getRequestSqleditorGetCurrentSchema(id);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorGetCurrentSchema })
                .then((event: ICommSimpleResultEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve(event.data ? event.data.result as string : "");
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    /**
     * Sets the current default schema, if supported.
     *
     * @param schema The schema to set as the default.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public setCurrentSchema(schema: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                return resolve();
            }

            const request = ProtocolGui.getRequestSqleditorSetCurrentSchema(id, schema);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiSqleditorSetCurrentSchema })
                .then((event: ICommSimpleResultEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve();
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    /**
     * Sends a reply from the user back to the backend (e.g. passwords, choices etc.).
     *
     * @param requestId The same request ID that was used to request input from the user.
     * @param type Indicates if the user accepted the request or cancelled it.
     * @param reply The reply from the user.
     *
     * @returns A listener for the response.
     */
    public sendReply(requestId: string, type: ShellPromptResponseType, reply: string): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestPromptReply(requestId, type, reply, id);

        return currentConnection.sendRequest(request, { messageClass: "sendReply" });
    }
}
