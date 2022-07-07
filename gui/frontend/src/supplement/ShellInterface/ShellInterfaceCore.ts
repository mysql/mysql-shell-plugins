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

import { IBackendInformation, IShellInterface } from ".";
import {
    ICommDbTypesEvent, ICommErrorEvent, ICommShellInformationEvent, ICommSimpleResultEvent,
    MessageScheduler,
    ProtocolGui, ShellAPIGui,
} from "../../communication";

import { filterInt } from "../../utilities/string-helpers";
import { EventType, IDispatchEvent } from "../Dispatch";

export class ShellInterfaceCore implements IShellInterface {

    public readonly id = "core";

    /**
     * Returns information about the backend, e.g. for showing in the about box.
     *
     * @returns A promise with backend information.
     */
    public get backendInformation(): Promise<IBackendInformation> {
        return new Promise((resolve) => {
            const request = ProtocolGui.getRequestCoreGetBackendInformation();

            MessageScheduler.get.sendRequest(request, { messageClass: "getBackendInformation" })
                .then((event: ICommShellInformationEvent) => {
                    // istanbul ignore if
                    if (!event.data) {
                        return;
                    }

                    resolve({
                        architecture: event.data.info.architecture,
                        major: filterInt(event.data.info.major),
                        minor: filterInt(event.data.info.minor),
                        patch: filterInt(event.data.info.patch),
                        platform: event.data.info.platform,
                        serverDistribution: event.data.info.serverDistribution,
                        serverMajor: filterInt(event.data.info.serverMajor),
                        serverMinor: filterInt(event.data.info.serverMinor),
                        serverPatch: filterInt(event.data.info.serverPatch),
                    });
                });
        });
    }

    public getLogLevel(): Promise<string> {
        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestCoreGetLogLevel();
            MessageScheduler.get.sendRequest(request, { messageClass: "getLogLevel" })
                .then((event: ICommSimpleResultEvent) => {
                    resolve(event.data?.result as string);
                }).catch(/* istanbul ignore next */(errorEvent) => {
                    reject(errorEvent.message);
                });
        });

    }

    public setLogLevel(level: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestCoreSetLogLevel(level);
            MessageScheduler.get.sendRequest(request, { messageClass: "getLogLevel" })
                .then(() => {
                    resolve();
                }).catch(/* istanbul ignore next */(errorEvent) => {
                    reject(errorEvent.message);
                });
        });
    }

    /**
     * @returns Returns a promise resolving to a list of DB type names.
     */
    public getDbTypes(): Promise<string[]> {
        return new Promise((resolve) => {
            const result: string[] = [];
            const context = { messageClass: ShellAPIGui.GuiDbconnectionsGetDbTypes };
            MessageScheduler.get.sendRequest(ProtocolGui.getRequestDbconnectionsGetDbTypes(), context)
                .then((event: ICommDbTypesEvent) => {
                    // istanbul ignore else
                    if (event.data) {
                        result.push(...event.data.dbType);
                    }

                    // istanbul ignore else
                    if (event.eventType === EventType.FinalResponse) {
                        resolve(result);
                    }
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
            MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiCoreValidatePath })
                .then((event: IDispatchEvent) => {
                    // istanbul ignore else
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
            MessageScheduler.get.sendRequest(request, { messageClass: ShellAPIGui.GuiCoreCreateFile })
                .then((event: IDispatchEvent) => {
                    // istanbul ignore else
                    if (event.eventType === EventType.FinalResponse) {
                        resolve();
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

}
