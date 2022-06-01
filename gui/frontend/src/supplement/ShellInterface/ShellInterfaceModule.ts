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

import {
    ProtocolGui, currentConnection, ICommModuleDataEvent, ICommDataTreeContentEvent, IDBDataTreeEntry,
} from "../../communication";
import { EventType, ListenerEntry } from "../Dispatch";
import { EditorLanguage } from "..";
import { IShellInterface } from ".";
import { EntityType, IDBEditorScriptState, IFolderEntity, IDBDataEntry } from "../../modules/SQLNotebook";

// These are predefined data categories that always exist.
export enum StandardDataCategories {
    Text = 1,             // The root category for all text like data.
    Script = 2,           // Direct child of Text, for all script types.
    JSON = 3,             // Direct child of Text, for JSON like data.
    MySQLScript = 4,      // Child of Script.
    PythonScript = 5,     // Child of Script.
    JavaScriptScript = 6, // Child of Script.
    TypeScriptScript = 7, // Child of Script.
    SQLiteScript = 8,     // Child of Script.
}

export class ShellInterfaceModule implements IShellInterface {

    public readonly id = "module";

    // Mappings between script category ids and editor languages.
    private scriptCategoryToLanguage = new Map<number, EditorLanguage>([
        [StandardDataCategories.MySQLScript, "mysql"],
        [StandardDataCategories.PythonScript, "python"],
        [StandardDataCategories.JavaScriptScript, "javascript"],
        [StandardDataCategories.TypeScriptScript, "typescript"],
        [StandardDataCategories.SQLiteScript, "sql"],
        [StandardDataCategories.JSON, "json"],
    ]);

    private languageToScriptCategory = new Map<EditorLanguage, number>([
        ["mysql", StandardDataCategories.MySQLScript],
        ["python", StandardDataCategories.PythonScript],
        ["javascript", StandardDataCategories.JavaScriptScript],
        ["typescript", StandardDataCategories.TypeScriptScript],
        ["sql", StandardDataCategories.SQLiteScript],
        ["json", StandardDataCategories.JSON],
    ]);

    /**
     * Creates a new data record in the data tree given by the tree identifier.
     *
     * @param caption The data caption.
     * @param content The content of data module.
     * @param dataCategoryId The id of data category.
     * @param treeIdentifier The identifier of the tree.
     * @param folderPath The folder path f.e. "/scripts/server1"
     * @param profileId The id of profile
     *
     * @returns The generated shell request record.
     */
    public addData(caption: string, content: string, dataCategoryId: number, treeIdentifier: string,
        folderPath?: string, profileId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddData(caption, content, dataCategoryId,
            treeIdentifier, folderPath, profileId);

        return currentConnection.sendRequest(request, { messageClass: "addData" });
    }

    /**
     * Returns a list of data IDs from a given folder and the specified data category.
     *
     * @param folderId The id of the folder.
     * @param dataCategoryId The id of the data category.
     *
     * @returns A listener for the response.
     */
    public listData(folderId: number, dataCategoryId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesListData(folderId, dataCategoryId);

        return currentConnection.sendRequest(request, { messageClass: "listData" });
    }

    /**
     * Retrieves the content of a specific data item.
     *
     * @param dataId An id which identifies a data item (returned from list or add data).
     *
     * @returns A listener for the response.
     */
    public getDataContent(dataId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesGetDataContent(dataId);

        return currentConnection.sendRequest(request, { messageClass: "getDataContent" });
    }

    /**
     * Creates a new data tree in the given profile.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param profileId The id of profile
     *
     * @returns A listener for the response.
     */
    public createProfileDataTree(treeIdentifier: string, profileId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesCreateProfileDataTree(treeIdentifier, profileId);

        return currentConnection.sendRequest(request, { messageClass: "createProfileDataTree" });
    }

    /**
     * Gets the complete data tree specified by the tree tree identifier, for the given profile.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param profileId The id of profile
     *
     * @returns A listener for the response.
     */
    public getProfileDataTree(treeIdentifier: string, profileId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesGetProfileDataTree(treeIdentifier, profileId);

        return currentConnection.sendRequest(request, { messageClass: "getProfileDataTree" });
    }

    /**
     * Creates the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param userGroupId The id of user group
     *
     * @returns A listener for the response.
     */
    public createUserGroupDataTree(treeIdentifier: string, userGroupId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesCreateUserGroupDataTree(treeIdentifier, userGroupId);

        return currentConnection.sendRequest(request, { messageClass: "createUserGroupDataTree" });
    }

    /**
     * Gets the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param userGroupId The id of user group
     *
     * @returns A listener for the response.
     */
    public getUserGroupDataTree(treeIdentifier: string, userGroupId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesGetUserGroupDataTree(treeIdentifier, userGroupId);

        return currentConnection.sendRequest(request, { messageClass: "getUserGroupDataTree" });
    }

    /**
     * Returns a list with identifiers of available data trees for a given profile.
     *
     * @param profileId The id of profile.
     *
     * @returns A listener for the response.
     */
    public getProfileDataTreeIdentifiers(profileId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesGetProfileTreeIdentifiers(profileId);

        return currentConnection.sendRequest(request, { messageClass: "getProfileDataTreeIdentifiers" });
    }

    /**
     * Shares data to user group
     *
     * @param id The id of the data
     * @param userGroupId The id of user group
     * @param readOnly The flag that specifies whether the data is read only
     * @param treeIdentifier The identifier of the tree.
     * @param folderPath The folder path f.e. "/scripts/server1"
     *
     * @returns The generated shell request record.
     */
    public shareDataToUserGroup(id: number, userGroupId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesShareDataToUserGroup(id, userGroupId, readOnly,
            treeIdentifier, folderPath);

        return currentConnection.sendRequest(request, { messageClass: "shareDataToUserGroup" });
    }

    /**
     * Shares data to user group
     *
     * @param id The id of the data
     * @param profileId The id of profile
     * @param readOnly The flag that specifies whether the data is read only
     * @param treeIdentifier The identifier of the tree.
     * @param folderPath The folder path f.e. "/scripts/server1"
     *
     * @returns The generated shell request record.
     */
    public addDataToProfile(id: number, profileId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddDataToProfile(id, profileId, readOnly,
            treeIdentifier, folderPath);

        return currentConnection.sendRequest(request, { messageClass: "addDataToProfile" });
    }

    /**
     * Update data at the given module
     *
     * @param id The id of the data
     * @param caption Caption
     * @param content The content data
     *
     * @returns The generated shell request record.
     */
    public updateData(id: number, caption?: string, content?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesUpdateData(id, caption, content);

        return currentConnection.sendRequest(request, { messageClass: "updateData" });
    }

    /**
     * Deletes data
     *
     * @param id The id of the data
     * @param folderId The id of the folder
     *
     * @returns A listener for the response.
     */
    public deleteData(id: number, folderId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesDeleteData(id, folderId);

        return currentConnection.sendRequest(request, { messageClass: "deleteData" });
    }

    /**
     * Gets the list of available data categories.
     *
     * @param parentID The ID of the parent data category. If not given, the root entries are returned.
     *
     * @returns A listener for the response.
     */
    public listDataCategories(parentID?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesListDataCategories(parentID);

        return currentConnection.sendRequest(request, { messageClass: "listDataCategories" });
    }

    /**
     * Adds a new data category for data entries.
     *
     * @param category A human readable string identifying the data category.
     * @param parent Specifies the parent category to which the new category belongs. Root categories have no parent.
     *
     * @returns A listener for the response.
     */
    public addDataCategory(category: string, parent?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddDataCategory(category, parent);

        return currentConnection.sendRequest(request, { messageClass: "addDataCategory" });
    }

    /**
     * Remove a data category from the list of available data categories.
     *
     * @param categoryId The id of the data category
     *
     * @returns Returns OK on success. On failure, returns and error.
     */
    public removeDataCategory(categoryId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesRemoveDataCategory(categoryId);

        return currentConnection.sendRequest(request, { messageClass: "removeDataCategory" });
    }

    /**
     * Returns the resource id of one of the script types, depending on the given language.
     *
     * @param language The language for which to return the script type.
     *
     * @returns A value which identifies a module data script resource or undefined if no such type exists.
     */
    public scriptTypeFromLanguage(language: EditorLanguage): number | undefined {
        return this.languageToScriptCategory.get(language);
    }

    /**
     * Collects a list of script data entries.
     *
     * @param profileId The profile for which to load the scripts (default profile, if undefined).
     *
     * @returns A promise which resolves with the script details.
     */
    public async loadScriptsTree(profileId?: number): Promise<IDBDataEntry[]> {
        return this.loadScriptTreeEntries(StandardDataCategories.Script, profileId);
    }

    /**
     * Loads all entries from the "scripts" subtree.
     *
     * @param categoryId The ID of the module data category for the "Script" type.
     * @param profileId The ID of the profile for which to load the tree.
     *
     * @returns A promise resolving to a list of script state entries, comprising the tree.
     */
    private async loadScriptTreeEntries(categoryId: number, profileId?: number): Promise<IDBDataEntry[]> {
        const dataTree = await this.loadDataTree("scripts", profileId);

        const createTree = async (parentId: number, target: IDBDataEntry[]): Promise<void> => {
            const result = dataTree.filter((entry, index, arr) => {
                if (entry.parentFolderId === parentId) {
                    arr.splice(index, 1);

                    return true;
                }

                return false;
            });

            for await (const entry of result) {
                const entries = await this.loadScriptStates(entry.id, categoryId);
                await createTree(entry.id, entries);

                target.push({
                    id: "",
                    folderId: parentId,
                    moduleDataId: entry.id,
                    caption: entry.caption,
                    children: entries,
                    type: EntityType.Folder,
                } as IFolderEntity);
            }

        };

        const result: IDBDataEntry[] = [];
        if (dataTree.length > 0 && dataTree[0].caption === "scripts") {
            // The first entry is the always present root folder, which we do not show in the UI.

            // First load the root (non-folder) data entries.
            const root = dataTree.shift();
            if (root) {
                const states = await this.loadScriptStates(root.id, categoryId);
                result.push(...states);

                // Then create the remaining tree.
                await createTree(root.id, result);
            }
        }

        return result;
    }

    /**
     * Promisified version of `getProfileDataTree`.
     *
     * @param treeIdentifier The identifier of the data tree to load.
     * @param profileId The id of the profile for which to load the data structure.
     *
     * @returns A promise which resolves with the requested list.
     */
    private loadDataTree(treeIdentifier: string, profileId?: number): Promise<IDBDataTreeEntry[]> {
        return new Promise((resolve, reject) => {
            this.getProfileDataTree(treeIdentifier, profileId).then((treeIdentEvent: ICommDataTreeContentEvent) => {
                const result = treeIdentEvent.data?.result;

                const list: IDBDataTreeEntry[] = [];
                switch (treeIdentEvent.eventType) {
                    case EventType.DataResponse: {
                        if (result) {
                            list.push(...result);
                        }

                        break;
                    }
                    case EventType.FinalResponse:
                        if (result) {
                            list.push(...result);
                        }

                        resolve(list);

                        break;

                    default:
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    /**
     * Constructs script state entries from script data entries.
     *
     * @param folderId The ID of the folder from which to load the items.
     * @param dataCategoryId The ID of the data category, which determines the data items to load.
     *
     * @returns A list of state entries for all found data entries.
     */
    private loadScriptStates = (folderId: number, dataCategoryId: number): Promise<IDBEditorScriptState[]> => {
        return new Promise((resolve, reject) => {
            const listData: IDBEditorScriptState[] = [];
            this.listData(folderId, dataCategoryId).then((scriptEvent: ICommModuleDataEvent) => {
                if (!scriptEvent.data) {
                    return;
                }

                switch (scriptEvent.eventType) {
                    case EventType.DataResponse:
                    case EventType.FinalResponse: {
                        listData.push(...scriptEvent.data.result.map((entry) => {
                            // The language depends on the data category.
                            const language = this.scriptCategoryToLanguage.get(entry.dataCategoryId) ?? "mysql";

                            return {
                                id: `script-${entry.id}`,
                                folderId,
                                type: EntityType.Script,
                                caption: entry.caption,
                                language,
                                moduleDataId: entry.id,
                            };
                        }));

                        if (scriptEvent.eventType === EventType.FinalResponse) {
                            resolve(listData);
                        }

                        break;
                    }

                    default: {
                        break;
                    }
                }
            }).catch((event) => {
                reject(String(event.message));
            });
        });
    };
}

