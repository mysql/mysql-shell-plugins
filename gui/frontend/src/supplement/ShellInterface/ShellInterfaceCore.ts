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

import { IBackendInformation } from ".";
import { MessageScheduler } from "../../communication/MessageScheduler";
import { ShellAPIGui } from "../../communication/ProtocolGui";

import { filterInt } from "../../utilities/string-helpers";

export class ShellInterfaceCore {
    /**
     * Returns information about the backend, e.g. for showing in the about box.
     *
     * @returns A promise with backend information.
     */
    public get backendInformation(): Promise<IBackendInformation | undefined> {
        return (async () => {
            const response = await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiCoreGetBackendInformation,
                parameters: {},
            });

            return {
                architecture: response.result.architecture,
                major: filterInt(response.result.major),
                minor: filterInt(response.result.minor),
                patch: filterInt(response.result.patch),
                platform: response.result.platform,
                serverDistribution: response.result.serverDistribution,
                serverMajor: filterInt(response.result.serverMajor),
                serverMinor: filterInt(response.result.serverMinor),
                serverPatch: filterInt(response.result.serverPatch),
            };
        })();
    }

    public async getLogLevel(): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiCoreGetLogLevel,
            parameters: {},
        });

        return response.result;
    }

    public async setLogLevel(logLevel: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiCoreSetLogLevel,
            parameters: { args: { logLevel } },
        });
    }

    /**
     * @returns Returns a promise resolving to a list of DB type names.
     */
    public async getDbTypes(): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbconnectionsGetDbTypes,
            parameters: {},
        });

        return response.result;
    }

    /**
     * Checks if the given path is valid and points to an existing file.
     *
     * @param path The path to check.
     *
     * @returns A promise which resolves to true if the path is valid, otherwise to false.
     */
    public async validatePath(path: string): Promise<boolean> {
        try {
            // Throws an error, if the path is invalid.
            await MessageScheduler.get.sendRequest({
                requestType: ShellAPIGui.GuiCoreValidatePath,
                parameters: { args: { path } },
            });

            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Creates the database file for an sqlite3 connection. The file must not exist yet.
     *
     * @param path The path to the file to create.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async createDatabaseFile(path: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiCoreCreateFile,
            parameters: { args: { path } },
        });
    }

    /**
     * @returns A promise resolving to a list of scripts from the backend used to unit testing and for help in the
     *          frontend communication debugger.
     */
    public async getDebuggerScriptNames(): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDebuggerGetScripts,
            parameters: {},
        });

        return response.result;
    }

    /**
     * @param path The name/path of the script.
     *
     * @returns The content of the script give by its name.
     */
    public async getDebuggerScriptContent(path: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDebuggerGetScriptContent,
            parameters: { args: { path } },
        });

        return response.result;
    }
}
