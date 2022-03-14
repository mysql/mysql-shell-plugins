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
    currentConnection, ICommDbTypesEvent, ICommShellInformationEvent, ICommSimpleResultEvent, ProtocolGui, ShellAPIGui,
} from "../../communication";

import { filterInt } from "../../utilities/string-helpers";
import { EventType } from "../Dispatch";

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

            currentConnection.sendRequest(request, { messageClass: "getBackendInformation" })
                .then((event: ICommShellInformationEvent) => {
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
            currentConnection.sendRequest(request, { messageClass: "getLogLevel" })
                .then((event: ICommSimpleResultEvent) => {
                    resolve(event.data?.result as string);
                }).catch((errorEvent) => {
                    reject(errorEvent.message);
                });
        });

    }

    public setLogLevel(level: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = ProtocolGui.getRequestCoreSetLogLevel(level);
            currentConnection.sendRequest(request, { messageClass: "getLogLevel" })
                .then(() => {
                    resolve();
                }).catch((errorEvent) => {
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
            currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsGetDbTypes(), context)
                .then((event: ICommDbTypesEvent) => {
                    if (event.data) {
                        result.push(...event.data.dbType);
                    }

                    if (event.eventType === EventType.FinalResponse) {
                        resolve(result);
                    }
                });
        });
    }
}
