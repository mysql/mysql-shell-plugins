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

import { IConnectionDetails, IFolderPath } from "./index.js";
import { IDictionary } from "../../app-logic/general-types.js";
import { MessageScheduler } from "../../communication/MessageScheduler.js";
import { IShellDictionary } from "../../communication/Protocol.js";
import { ShellAPIGui } from "../../communication/ProtocolGui.js";

/** Interface for connection management. */
export class ShellInterfaceDbConnection {

    public readonly id = "dbConnection";

    /**
     * Adds a new database connection to a profile.
     *
     * @param profileId The id of the profile.
     * @param connection An object holding all data of the connection.
     * @param folderPathId The folder path id used for grouping and nesting connections, optional
     *
     * @returns A promise resolving to the id of the new connection.
     */
    public async addDbConnection(profileId: number, connection: IConnectionDetails,
        folderPathId: number | undefined = undefined): Promise<number | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsAddDbConnection,
            parameters: {
                args: {
                    profileId,
                    connection: {
                        dbType: connection.dbType,
                        caption: connection.caption,
                        description: connection.description,
                        options: connection.options as IDictionary,
                        settings: (connection.settings ?? {}) as IShellDictionary,
                    },
                    folderPathId,
                },
            },
        });

        return response.result;
    }

    /**
     * Updates the connection data in the backend.
     *
     * @param profileId The id of the profile.
     * @param connection An object holding all data of the connection.
     * @param folderPathId The folder path id used for grouping and nesting connections.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async updateDbConnection(profileId: number, connection: IConnectionDetails,
        folderPathId: number | undefined = undefined): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateDbConnection,
            parameters: {
                args: {
                    profileId,
                    connectionId: connection.id,
                    connection: {
                        dbType: connection.dbType,
                        caption: connection.caption,
                        description: connection.description,
                        options: connection.options as IShellDictionary,
                        settings: (connection.settings ?? {}) as IShellDictionary,
                    },
                    folderPathId,
                },
            },
        });
    }

    /**
     * Removes a database connection from a profile.
     *
     * @param profileId The id of the profile.
     * @param connectionId The connection to remove.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async removeDbConnection(profileId: number, connectionId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsRemoveDbConnection,
            parameters: { args: { profileId, connectionId } },
        });
    }

    /**
     * Returns all database connections of a given profile and in a given folder path.
     *
     * @param profileId The id of the profile.
     * @param folderPathId The folder path id used for grouping and nesting connections.
     *
     * @returns A promise which resolves to the list of existing connections.
     */
    public async listDbConnections(profileId: number,
        folderPathId: number | undefined = undefined): Promise<IConnectionDetails[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListDbConnections,
            parameters: { args: { profileId, folderPathId } },
        });

        const result: IConnectionDetails[] = [];
        response.forEach((entry) => {
            result.push(...entry.result);
        });

        return result;
    }

    /**
     * @param connectionId The id of the connection.
     *
     * @returns A promise resolving to the details of the requested connection or undefined, if no connection with the
     *          given identifier exists.
     */
    public async getDbConnection(connectionId: number): Promise<IConnectionDetails | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsGetDbConnection,
            parameters: { args: { dbConnectionId: connectionId } },
        });

        return response.result;
    }

    /**
     * Adds a new folder path.
     *
     * @param profileId The id of the profile.
     * @param caption The caption of the folder.
     * @param parentFolderId The id of the parent folder, optional.
     *
     * @returns A promise resolving to the id of the new folder path.
     */
    public async addFolderPath(profileId: number, caption: string, parentFolderId?: number): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsAddFolderPath,
            parameters: { args: { profileId, caption, parentFolderId } },
        });

        return response.result;
    }

    /**
     * Removes a folder path.
     *
     * @param folderPathId The id of the folder path to remove.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async removeFolderPath(folderPathId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsRemoveFolderPath,
            parameters: { args: { folderPathId } },
        });
    }

    /**
     * Renames a folder path.
     *
     * @param folderPathId The id of the folder path to rename.
     * @param newCaption The new caption for the folder path.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async renameFolderPath(folderPathId: number, newCaption: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsRenameFolderPath,
            parameters: { args: { folderPathId, newCaption } },
        });
    }

    /**
     * Moves a folder path to a new parent folder.
     *
     * @param folderPathId The id of the folder path to move.
     * @param newParentFolderId The id of the new parent folder.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async moveFolder(folderPathId: number, newParentFolderId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsMoveFolder,
            parameters: { args: { folderPathId, newParentFolderId } },
        });
    }

    /**
     * Lists folder paths.
     *
     * @param parentFolderId The id of the parent folder to list child folders, optional.
     *
     * @returns A promise resolving to the list of folder paths.
     */
    public async listFolderPaths(parentFolderId?: number): Promise<IFolderPath[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListFolderPaths,
            parameters: { args: { parentFolderId } },
        });

        return response.result;
    }

    /**
     * Lists all connections and folder paths for the given profile and folder.
     *
     * @param profileId The id of the profile.
     * @param folderId The id of the folder, optional (for None use root folder).
     *
     * @returns A promise resolving to a list of dictionaries containing connections and folders sorted by index.
     */
    public async listAll(profileId: number, folderId?: number): Promise<Array<IConnectionDetails | IFolderPath>> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListAll,
            parameters: { args: { profileId, folderId } },
        });

        return response.result;
    }
}
