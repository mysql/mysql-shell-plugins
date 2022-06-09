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
    ICommErrorEvent, ICommObjectNamesEvent, ICommStartSessionEvent, IShellDbConnection,
    MessageScheduler,
    ProtocolGui, ShellAPIGui,
} from "../../communication";
import { EventType } from "../Dispatch";
import { webSession } from "../WebSession";

export type RoutineType = "function" | "procedure";

// This interface serves as utility for DB related work (DB object retrieval and so on).
// It cannot execute SQL, though. Use the SQL editor interface for that.
export class ShellInterfaceDb implements IShellInterface {

    protected moduleSessionLookupId = "";

    public get id(): string {
        return "dbSession";
    }

    /**
     * Starts a simple DB session for certain DB object related work.
     *
     * @param id A unique ID to identify this session.
     * @param connection Either the ID of a stored DB editor connection or a set of credentials for an ad hoc
     *                   connection.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public startSession(id: string, connection: number | IShellDbConnection): Promise<void> {
        this.moduleSessionLookupId = this.id + "." + id;

        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestDbStartSession(connection);
            const listener = MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiDbStartSession });
            listener.then((event: ICommStartSessionEvent) => {
                // istanbul ignore else
                if (event.eventType === EventType.FinalResponse) {
                    const id = event.data.result.moduleSessionId;
                    webSession.setModuleSessionId(this.moduleSessionLookupId, id);

                    resolve();
                }
            }).catch(/* istanbul ignore next */(event: ICommErrorEvent) => {
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
                MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiDbCloseSession }).then(() => {
                    webSession.setModuleSessionId(this.moduleSessionLookupId);
                    resolve();
                }).catch(/* istanbul ignore next */(event: ICommErrorEvent) => {
                    reject(event.message);
                });
            }
        });
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
                MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetCatalogObjectNames })
                    .then((event: ICommObjectNamesEvent) => {
                        if (event.data?.result) {
                            names.push(...event.data.result);
                        }

                        if (event.eventType === EventType.FinalResponse) {
                            resolve(names);
                        }
                    }).catch(/* istanbul ignore next */(event: ICommErrorEvent) => {
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
            MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetSchemaObjectNames })
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
                MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiDbGetTableObjectNames })
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

    protected get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }

}
