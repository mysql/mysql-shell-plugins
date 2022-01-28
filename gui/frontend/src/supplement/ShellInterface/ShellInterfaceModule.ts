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
    ProtocolGui, currentConnection, IShellModuleDataCategoriesEntry, ICommModuleDataEvent,
    ICommListDataCategoriesEvent, ICommModuleAddDataCategoryEvent, ICommDataTreeContentEvent, IDBDataTreeEntry,
} from "../../communication";
import { EventType, ListenerEntry } from "../Dispatch";
import { EditorLanguage } from "..";
import { IShellInterface } from ".";
import { EntityType, IDBEditorScriptState, IFolderEntity, IModuleDataEntry } from "../../modules/scripting";

export class ShellInterfaceModule implements IShellInterface {

    // Loaded categories per module.
    private moduleDataCategories = new Map<string, IShellModuleDataCategoriesEntry[]>();

    // Mappings between script category ids and editor languages.
    private scriptCategoryToLanguage = new Map<number, EditorLanguage>();
    private languageToScriptCategory = new Map<EditorLanguage, number>();

    public constructor(public moduleName: string) {
    }

    /**
     * Creates a new Module Data record for the given module
     * and associates it to the active user profile and personal user group.
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
    public addModuleData(caption: string, content: string, dataCategoryId: number, treeIdentifier: string,
        folderPath?: string, profileId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddData(caption, content, dataCategoryId,
            treeIdentifier, folderPath, profileId);

        return currentConnection.sendRequest(request, { messageClass: "addModuleData" });
    }

    /**
     * Get list of data
     *
     * @param folderId The id of the folder
     * @param dataCategoryId The id of the category
     *
     * @returns The generated shell request record.
     */
    public listModuleData(folderId: number, dataCategoryId?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesListData(folderId, dataCategoryId);

        return currentConnection.sendRequest(request, { messageClass: "listModuleData" });
    }

    /**
     * Retrieves the content of a specific data item.
     *
     * @param moduleDataId An id which identifies a module data item (returned from list or add module data).
     *
     * @returns A listener for the response
     */
    public getModuleDataContent(moduleDataId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesGetDataContent(moduleDataId);

        return currentConnection.sendRequest(request, { messageClass: "getModuleDataContent" });
    }


    /**
     * Creates a new data tree in the given profile.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param profileId The id of profile
     *
     * @returns The id of the root folder.
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
     * @returns The list of all folders in data tree.
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
     * @returns The id of the root folder.
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
     * @returns The list of all folders in data tree.
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
     * @returns The list of tree identifiers.
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
    public shareModuleDataToUserGroup(id: number, userGroupId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesShareDataToUserGroup(id, userGroupId, readOnly,
            treeIdentifier, folderPath);

        return currentConnection.sendRequest(request, { messageClass: "shareModuleDataToUserGroup" });
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
    public addModuleDataToProfile(id: number, profileId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddDataToProfile(id, profileId, readOnly,
            treeIdentifier, folderPath);

        return currentConnection.sendRequest(request, { messageClass: "addModuleDataToProfile" });
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
    public updateModuleData(id: number, caption?: string, content?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesUpdateData(id, caption, content);

        return currentConnection.sendRequest(request, { messageClass: "updateModuleData" });
    }

    /**
     * Deletes data
     *
     * @param id The id of the data
     * @param folderId The id of the folder
     *
     * @returns The generated shell request record.
     */
    public deleteModuleData(id: number, folderId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesDeleteData(id, folderId);

        return currentConnection.sendRequest(request, { messageClass: "deleteModuleData" });
    }

    /**
     * Gets the list of available data categories for this module
     *
     * @param moduleId The id of the module, e.g. 'gui.sqleditor'.
     * @param parentName The name of the parent data category. If not given, the root entries are returned.
     *
     * @returns The list of available data categories
     */
    public listModuleDataCategories(moduleId: string, parentName?: string): ListenerEntry {
        const request = ProtocolGui.getRequestModulesListDataCategories(moduleId, parentName);

        return currentConnection.sendRequest(request, { messageClass: "listModuleDataCategories" });
    }

    /**
     * Adds a new data type for module data to the given module.
     *
     * @param moduleId The module id.
     * @param category A human readable string identifying the category.
     * @param parent Specifies the parent category to which the new category belongs. Root categories have no parent.
     *
     * @returns A listener for the response.
     */
    public addModuleDataCategory(moduleId: string, category: string, parent?: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesAddDataCategory(category, moduleId, parent);

        return currentConnection.sendRequest(request, { messageClass: "addModuleDataCategory" });
    }

    /**
     * Remove a data category from the list of available data categories for this module
     *
     * @param categoryId The id of the data category
     *
     * @returns Returns OK on success. On failure, returns and error.
     */
    public removeModuleDataCategory(categoryId: number): ListenerEntry {
        const request = ProtocolGui.getRequestModulesRemoveDataCategory(categoryId);

        return currentConnection.sendRequest(request, { messageClass: "removeModuleDataCategory" });
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
     * Collects a list of details from user scripts in the specified module.
     *
     * @param moduleId The module id.
     * @param profileId The profile for which to load the scripts (default profile, if undefined).
     *
     * @returns A promise which resolves with the script details.
     */
    public async loadScriptsTree(moduleId: string, profileId?: number): Promise<IModuleDataEntry[]> {
        const scriptCategoryId = await this.getScriptDataCategoryId(moduleId);

        if (scriptCategoryId > -1) {
            return this.loadScriptTreeEntries(scriptCategoryId, profileId);
        }

        return [];
    }

    /**
     * Checks if all module data categories exist, which we need here. If there's any missing, create it.
     *
     * @param moduleId The ID of the module for which to check the data.
     *
     * @returns A promise that resolves to the ID of the top level script data category or -1 if we cannot find that.
     */
    private getScriptDataCategoryId = async (moduleId: string): Promise<number> => {
        if (!this.moduleDataCategories.has(moduleId)) {
            // Start with root entries.
            let categories = await this.retrieveModuleDataCategories(moduleId);

            const checkAndAdd = async (name: string, parent?: number): Promise<number> => {
                const existingCategory = categories?.find((value) => {
                    return value.name === name;
                });

                if (!existingCategory) {
                    const id = await this.addDataCategory(moduleId, name, parent);
                    categories.push({
                        id,
                        name,
                        parentCategoryId: parent,
                    });

                    return id;
                } else {
                    return existingCategory?.id;
                }
            };

            // Do the checks and create what's missing.
            const parentId = await checkAndAdd("Scripts");

            // Now that we know we a Scripts root entry we can add sub entries if necessary.
            categories = await this.retrieveModuleDataCategories(moduleId, "Scripts");
            await checkAndAdd("MySQL Script", parentId);

            await checkAndAdd("Python Script", parentId);
            await checkAndAdd("JavaScript Script", parentId);
            await checkAndAdd("TypeScript Script", parentId);
            await checkAndAdd("SQLite Script", parentId);
            await checkAndAdd("JSON", parentId);

            // Fill our type mappings category id <-> type maps.
            categories.forEach((row) => {
                switch (row.name) {
                    case "MySQL Script": {
                        this.scriptCategoryToLanguage.set(row.id, "mysql");
                        this.languageToScriptCategory.set("mysql", row.id);
                        break;
                    }

                    case "Python Script": {
                        this.scriptCategoryToLanguage.set(row.id, "python");
                        this.languageToScriptCategory.set("python", row.id);
                        break;
                    }

                    case "JavaScript Script": {
                        this.scriptCategoryToLanguage.set(row.id, "javascript");
                        this.languageToScriptCategory.set("javascript", row.id);
                        break;
                    }

                    case "TypeScript Script": {
                        this.scriptCategoryToLanguage.set(row.id, "typescript");
                        this.languageToScriptCategory.set("typescript", row.id);
                        break;
                    }

                    case "SQLite Script": {
                        this.scriptCategoryToLanguage.set(row.id, "sql");
                        this.languageToScriptCategory.set("sql", row.id);
                        break;
                    }

                    case "JSON": {
                        this.scriptCategoryToLanguage.set(row.id, "json");
                        this.languageToScriptCategory.set("json", row.id);
                        break;
                    }

                    default: {
                        break;
                    }
                }
            });
            this.moduleDataCategories.set(moduleId, categories);
        }

        const categories = this.moduleDataCategories.get(moduleId);
        const scriptsCategory = categories?.find((value) => {
            return value.name === "Scripts";
        });

        return Promise.resolve(scriptsCategory?.id ?? -1);
    };

    /**
     * Loads all entries from the "scripts" subtree.
     *
     * @param categoryId The ID of the module data category for the "Script" type.
     * @param profileId The ID of the profile for which to load the tree.
     *
     * @returns A promise resolving to a list of script state entries, comprising the tree.
     */
    private async loadScriptTreeEntries(categoryId: number, profileId?: number): Promise<IModuleDataEntry[]> {
        const dataTree = await this.loadDataTree("scripts", profileId);

        const createTree = async (parentId: number, target: IModuleDataEntry[]): Promise<void> => {
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

        const result: IModuleDataEntry[] = [];
        if (dataTree.length > 0 && dataTree[0].caption === "scripts") {
            // The first entry is the always present root folder, which we do not show in the UI.

            // First load the root (non-folder) data entries.
            const root = dataTree.shift();
            const states = await this.loadScriptStates(root!.id, categoryId);
            result.push(...states);

            // Then create the remaining tree.
            await createTree(root!.id, result);
        }

        return result;
    }

    /**
     * Promisified version of `addModuleDataCategory`.
     *
     * @param moduleId The module id.
     * @param category A human readable string identifying the category.
     * @param parentCategoryId Specifies the parent category to which the new category belongs.
     *                          Root categories have no parent.
     *
     * @returns A promise that resolves to the ID of the new category.
     */
    private addDataCategory = (moduleId: string, category: string, parentCategoryId?: number): Promise<number> => {
        return new Promise((resolve, reject) => {
            this.addModuleDataCategory(moduleId, category, parentCategoryId)
                .then((event: ICommModuleAddDataCategoryEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        resolve(event.data?.result ?? -1);
                    }

                }).catch((event) => {
                    reject(String(event.message));
                });
        });
    };

    /**
     * Promisified version of `listModuleDataCategories`.
     *
     * @param moduleId The ID of the module for which to get the data categories.
     * @param parentName The name of the parent category (the root is assumed if not given).
     *
     * @returns A list of existing module data categories.
     */
    private retrieveModuleDataCategories = (moduleId: string,
        parentName?: string): Promise<IShellModuleDataCategoriesEntry[]> => {
        return new Promise((resolve, reject) => {
            const list: IShellModuleDataCategoriesEntry[] = [];
            this.listModuleDataCategories(moduleId, parentName).then((event: ICommListDataCategoriesEvent) => {
                const categories = event.data?.result;
                switch (event.eventType) {
                    case EventType.DataResponse: {
                        if (categories) {
                            list.push(...categories);
                        }

                        break;
                    }

                    case EventType.FinalResponse: {
                        if (categories) {
                            list.push(...categories);
                        }
                        resolve(list);

                        break;
                    }

                    default:
                }
            }).catch((event) => {
                reject(String(event.message));
            });
        });
    };

    /**
     * Promisified version of `getModuleDataTreeForProfile`.
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
     * Constructs script state entries from script module data entries.
     *
     * @param folderId The ID of the folder from which to load the items.
     * @param dataCategoryId The ID of the data category, which determines which of the data items to load.
     *
     * @returns A list of state entries for all found data entries.
     */
    private loadScriptStates = (folderId: number, dataCategoryId: number): Promise<IDBEditorScriptState[]> => {
        return new Promise((resolve, reject) => {
            const listData: IDBEditorScriptState[] = [];
            this.listModuleData(folderId, dataCategoryId).then((scriptEvent: ICommModuleDataEvent) => {
                if (!scriptEvent.data) {
                    return;
                }

                switch (scriptEvent.eventType) {
                    case EventType.DataResponse:
                    case EventType.FinalResponse: {
                        listData.push(...scriptEvent.data.result.map((entry) => {
                            // The language depends on the data type.
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

