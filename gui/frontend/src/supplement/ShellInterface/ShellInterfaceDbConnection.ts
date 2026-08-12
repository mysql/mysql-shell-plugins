/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { MessageScheduler } from "../../communication/MessageScheduler.js";
import { IShellDictionary } from "../../communication/Protocol.js";
import { ShellAPIGui } from "../../communication/ProtocolGui.js";
import { ui } from "../../app-logic/UILayer.js";
import type { ILegacyConfigurationImportReport }
    from "../../app-logic/LegacyConfigurationImport/LegacyConfigurationImportTypes.js";
import { IConnectionDetails, IFolderPath } from "./index.js";
import { ShellInteractiveInterface } from "./ShellInteractiveInterface.js";

export type ConnectionsAndFoldersList = Array<IConnectionDetails | IFolderPath>;

/** Interface for connection management. */
export class ShellInterfaceDbConnection {
    private interactive = new ShellInteractiveInterface();

    /**
     * Imports non-secret classic Workbench connection definitions.
     *
     * @param profileId The target profile.
     * @param xmlContent The selected Workbench connections XML.
     *
     * @returns The import report.
     */
    public async importWorkbenchConnections(
        profileId: number,
        xmlContent: string,
    ): Promise<ILegacyConfigurationImportReport> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsImportWorkbenchConnections,
            parameters: {
                args: {
                    profileId,
                    xmlContent,
                },
            },
        });

        return response.result as ILegacyConfigurationImportReport;
    }

    /**
     * Adds a new database connection to a profile.
     *
     * @param profileId The id of the profile.
     * @param connection An object holding all data of the connection.
     * @param folderPathId The folder path id used for grouping and nesting connections.
     *
     * @returns A promise resolving to the tuple containing (connection_id, folder_path_id, index).
     */
    public async addDbConnection(profileId: number, connection: IConnectionDetails,
        folderPathId?: number): Promise<[number, number, number]> {
        const connectionPayload = {
            dbType: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: connection.options as IShellDictionary,
            settings: (connection.settings ?? {}) as IShellDictionary,
            tags: connection.tags ?? null,
        };

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsAddDbConnection,
            parameters: {
                args: {
                    profileId,
                    connection: connectionPayload,
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
        const connectionPayload = {
            dbType: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: connection.options as IShellDictionary,
            settings: (connection.settings ?? {}) as IShellDictionary,
            tags: connection.tags ?? null,
        };

        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateDbConnection,
            parameters: {
                args: {
                    profileId,
                    connectionId: connection.id,
                    connection: connectionPayload,
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
     * @param profileId The id of the profile owning the connection.
     * @returns A promise resolving to the details of the requested connection or undefined, if no connection with the
     *          given identifier exists.
     */
    public async getDbConnection(connectionId: number, profileId?: number): Promise<IConnectionDetails | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsGetDbConnection,
            parameters: { args: { dbConnectionId: connectionId, profileId } },
        });

        return response.result;
    }

    /**
     * Tests whether a database connection can be opened.
     *
     * @param connection The connection id or connection details to validate.
     * @param password The password to use for validation.
     */
    public async testConnection(connection: number | IConnectionDetails, password?: string): Promise<void> {
        await this.interactive.sendInteractiveRequest({
            requestType: ShellAPIGui.GuiDbConnectionsTestConnection,
            parameters: {
                args: {
                    connection: typeof connection === "number"
                        ? connection
                        : {
                            dbType: connection.dbType,
                            caption: connection.caption,
                            description: connection.description,
                            options: connection.options as IShellDictionary,
                            settings: (connection.settings ?? {}) as IShellDictionary,
                            tags: [],
                        },
                    password,
                },
            },
            onData: (response) => {
                const message = response.result as unknown;
                const { result, attributes } = (
                    typeof message === "object" && message !== null && "attributes" in message
                        ? message
                        : response
                ) as {
                    result?: unknown;
                    attributes?: { auth?: unknown; };
                };
                if (typeof result === "string" && attributes?.auth === "authentication_webauthn") {
                    void ui.showInformationMessage(result, {});

                    return Promise.resolve(true);
                }

                return Promise.resolve(false);
            },
        });
    }

    /**
     * Lists the connection tag definitions for the given profile.
     *
     * @param profileId The id of the profile.
     *
     * @returns A promise resolving to a mapping from tag caption to tag color.
     */
    public async listConnectionTags(profileId: number): Promise<Record<string, string>> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListConnectionTags,
            parameters: { args: { profileId } },
        });

        return response.result;
    }

    /**
     * Updates the connection tag definitions for the given profile.
     *
     * @param profileId The id of the profile.
     * @param tags A mapping from tag caption to tag color.
     *
     * @returns A promise which resolves when the request was concluded.
     */
    public async updateConnectionTags(profileId: number, tags: Record<string, string>): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateConnectionTags,
            parameters: { args: { profileId, tags } },
        });
    }

    /**
     * Adds a new folder path.
     *
     * @param profileId The id of the profile.
     * @param caption The caption of the folder.
     * @param parentFolderId The id of the parent folder, optional.
     * @param settings Optional settings for the folder path, can be used to store additional metadata.
     * @param settings.color The color of the folder path, optional.
     *
     * @returns A promise resolving to the id of the new folder path.
     */
    public async addFolderPath(profileId: number, caption: string, parentFolderId?: number,
        settings?: { color: string; },
    ): Promise<IFolderPath> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsAddFolderPath,
            parameters: {
                args: { profileId, caption, parentFolderId, settings: settings ?? { color: "" } },
            },
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
     * @param recursive If True, returns all nested subfolders; if False, returns only immediate children.
     *
     * @returns A promise resolving to the list of folder paths.
     */
    public async listFolderPaths(parentFolderId?: number, recursive?: boolean): Promise<IFolderPath[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListFolderPaths,
            parameters: { args: { parentFolderId, recursive } },
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
    public async listAll(profileId: number, folderId?: number): Promise<ConnectionsAndFoldersList> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListAll,
            parameters: { args: { profileId, folderId } },
        });

        // The list comes with a type field in each entry, just for this specific API.
        return response.result;
    }
}
