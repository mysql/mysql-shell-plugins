/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IShellInterface } from ".";
import {
    currentConnection, ICommErrorEvent, ICommObjectNamesEvent, ICommSimpleResultEvent, ICommStartSessionEvent,
    ProtocolGui, ShellAPIGui, ShellPromptResponseType,
} from "../../communication";
import { EventType, IDispatchUnknownEvent, ListenerEntry } from "../Dispatch";
import { webSession } from "../WebSession";

export type RoutineType = "function" | "procedure";

// This interface serves as utility for DB related work (DB object retrieval and so on).
// It cannot execute SQL, though. Use the SQL editor interface for that.
export class ShellInterfaceDb implements IShellInterface {

    protected moduleSessionLookupId = "";

    public get id(): string {
        return "sqlEditor";
    }

    /**
     * Starts a simple DB session for certain DB object related work.
     *
     * @param id A unique ID to identify this session.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public startSession(id: string): Promise<void> {
        this.moduleSessionLookupId = this.id + "." + id;

        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestDbStartSession();
            const listener = currentConnection.sendRequest(request, { messageClass: "startDbSession" });
            listener.then((event: ICommStartSessionEvent) => {
                if (event.data) {
                    const id = event.data.moduleSessionId;
                    webSession.setModuleSessionId(this.moduleSessionLookupId, id);

                    resolve();
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    /**
     * Closes this session and all open connections.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public closeSession(): Promise<void> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                resolve();
            } else {
                const request = ProtocolGui.getRequestDbCloseSession(id);
                currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiDbCloseSession }).then(() => {
                    webSession.setModuleSessionId(this.moduleSessionLookupId);
                    resolve();
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
            }
        });
    }

    /**
     * Opens a MySQL connection.
     * Cannot promisify this method, because of possible interaction (e.g. password requests).
     *
     * @param connectionId The SQL editor connection ID.
     *
     * @returns A listener for the response.
     */
    public openConnection(connectionId: number): ListenerEntry {
        const id = this.moduleSessionId;
        if (!id) {
            return ListenerEntry.resolve();
        }

        const request = ProtocolGui.getRequestDbOpenConnection(connectionId, id);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiDbOpenConnection });
    }

    /**
     * Returns the list of available catalog objects (schemas, engines, variables and so on).
     *
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public getCatalogObjects(type: string, filter?: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                resolve([]);
            } else {
                const names: string[] = [];
                const request = ProtocolGui.getRequestDbGetCatalogObjectNames(id, type, filter);
                currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetCatalogObjectNames })
                    .then((event: ICommObjectNamesEvent) => {
                        if (event.data?.result) {
                            names.push(...event.data.result);
                        }

                        if (event.eventType === EventType.FinalResponse) {
                            resolve(names);
                        }
                    }).catch((event: ICommErrorEvent) => {
                        reject(event.message);
                    });
            }
        });
    }

    /**
     * Returns a list of schema object names (tables, views etc.).
     *
     * @param schema The schema for which to retrieve the names.
     * @param type Which type of object to retrieve.
     * @param routineType Valid only for routines.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public getSchemaObjects(schema: string, type: string, routineType?: RoutineType,
        filter?: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                return resolve([]);
            }

            const names: string[] = [];
            const request = ProtocolGui.getRequestDbGetSchemaObjectNames(id, type, schema, filter, routineType);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetSchemaObjectNames })
                .then((event: ICommObjectNamesEvent) => {
                    if (event.data?.result) {
                        names.push(...event.data.result);
                    }

                    if (event.eventType === EventType.FinalResponse) {
                        resolve(names);
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    /**
     * Returns a list of table objects (columns, indexes and so on).
     *
     * @param schema The schema for which to retrieve the names.
     * @param table The table for which to retrieve the names.
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public getTableObjects(schema: string, table: string, type: string, filter?: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const id = this.moduleSessionId;
            if (!id) {
                resolve([]);
            } else {
                const request = ProtocolGui.getRequestDbGetTableObjectNames(id, type, schema, table, filter);

                const names: string[] = [];
                currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetTableObjectNames })
                    .then((event: ICommObjectNamesEvent) => {
                        if (event.data?.result) {
                            names.push(...event.data.result);
                        }

                        if (event.eventType === EventType.FinalResponse) {
                            resolve(names);
                        }
                    })
                    .catch((event) => {
                        reject(event.message);
                    });
            }
        });
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
     * Checks if the given path is valid and points to an existing file.
     *
     * @param path The path to check.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public validatePath(path: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = ProtocolGui.getRequestCoreValidatePath(path);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiCoreValidatePath })
                .then((event: IDispatchUnknownEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve(true);
                    }
                }).catch(() => {
                    // Intentionally not using `reject` here, as we expect an error if the given path is wrong.
                    resolve(false);
                });
        });
    }

    /**
     * Creates the database file for an sqlite3 connection. The file must not exist yet.
     *
     * @param path The path to the file to create.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public createDatabaseFile(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestCoreCreateFile(path);
            currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiCoreCreateFile })
                .then((event: IDispatchUnknownEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve();
                    }
                }).catch((event: ICommErrorEvent) => {
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
    protected get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }

}
