/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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
import {
    IDBDataTreeEntry, IShellModuleDataCategoriesEntry, IShellModuleDataEntry, ShellAPIGui,
} from "../../communication/ProtocolGui.js";
import { EditorLanguage } from "../index.js";

/** These are predefined data categories that always exist. */
enum StandardDataCategories {
    /** The root category for all text like data. */
    Text = 1,

    /** Direct child of Text, for all script types. */
    Script = 2,

    /** Direct child of Text, for JSON like data. */
    JSON = 3,

    /** Child of Script. */
    MySQLScript = 4,

    /** Child of Script. */
    PythonScript = 5,

    /** Child of Script. */
    JavaScriptScript = 6,

    /** Child of Script. */
    TypeScriptScript = 7,

    /** Child of Script. */
    SQLiteScript = 8,
}

export class ShellInterfaceModule {

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
     * @returns A promise resolving to the id of the added data entry.
     */
    public async addData(caption: string, content: string, dataCategoryId: number, treeIdentifier: string,
        folderPath?: string, profileId?: number): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesAddData,
            parameters: {
                args: {
                    caption,
                    content,
                    dataCategoryId,
                    treeIdentifier,
                    folderPath,
                    profileId,
                },
            },
        });

        return response.result;
    }

    /**
     * Returns a list of data entries from a given folder and the specified data category.
     *
     * @param folderId The id of the folder.
     * @param dataCategoryId The id of the data category.
     *
     * @returns A promise resolving to the list of data entries.
     */
    public async listData(folderId: number, dataCategoryId?: number): Promise<IShellModuleDataEntry[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesListData,
            parameters: {
                args: {
                    folderId,
                    dataCategoryId,
                },
            },
        });

        return response.result;
    }

    /**
     * Retrieves the content of a specific data item.
     *
     * @param dataId An id which identifies a data item (returned from list or add data).
     *
     * @returns A promise resolving to the data content.
     */
    public async getDataContent(dataId: number): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesGetDataContent,
            parameters: {
                args: {
                    id: dataId,
                },
            },
        });

        return response.result;
    }

    /**
     * Creates a new data tree in the given profile.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param profileId The id of profile
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async createProfileDataTree(treeIdentifier: string, profileId?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesCreateProfileDataTree,
            parameters: {
                args: {
                    treeIdentifier,
                    profileId,
                },
            },
        });
    }

    /**
     * Gets the complete data tree specified by the tree tree identifier, for the given profile.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param profileId The id of profile
     *
     * @returns A promise resolving to the list of tree entries.
     */
    public async getProfileDataTree(treeIdentifier: string, profileId?: number): Promise<IDBDataTreeEntry[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesGetProfileDataTree,
            parameters: {
                args: {
                    treeIdentifier,
                    profileId,
                },
            },
        });

        const result: IDBDataTreeEntry[] = [];
        response.forEach((list) => {
            result.push(...list.result);
        });

        return result;
    }

    /**
     * Creates the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param userGroupId The id of user group
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async createUserGroupDataTree(treeIdentifier: string, userGroupId?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesCreateUserGroupDataTree,
            parameters: {
                args: {
                    treeIdentifier,
                    userGroupId,
                },
            },
        });
    }

    /**
     * Gets the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree.
     * @param userGroupId The id of user group
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async getUserGroupDataTree(treeIdentifier: string, userGroupId?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesGetUserGroupDataTree,
            parameters: {
                args: {
                    treeIdentifier,
                    userGroupId,
                },
            },
        });
    }

    /**
     * Returns a list with identifiers of available data trees for a given profile.
     *
     * @param profileId The id of profile.
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async getProfileDataTreeIdentifiers(profileId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesGetProfileTreeIdentifiers,
            parameters: {
                args: {
                    profileId,
                },
            },
        });
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
     * @returns A promise which resolves when the request is finished.
     */
    public async shareDataToUserGroup(id: number, userGroupId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesShareDataToUserGroup,
            parameters: {
                args: {
                    id,
                    userGroupId,
                    readOnly,
                    treeIdentifier,
                    folderPath,
                },
            },
        });
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
     * @returns A promise which resolves when the request is finished.
     */
    public async addDataToProfile(id: number, profileId: number, readOnly: number, treeIdentifier: string,
        folderPath?: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesAddDataToProfile,
            parameters: {
                args: {
                    id,
                    profileId,
                    readOnly,
                    treeIdentifier,
                    folderPath,
                },
            },
        });
    }

    /**
     * Update data at the given module
     *
     * @param id The id of the data
     * @param caption Caption
     * @param content The content data
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async updateData(id: number, caption?: string, content?: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesUpdateData,
            parameters: {
                args: {
                    id,
                    caption,
                    content,
                },
            },
        });
    }

    /**
     * Deletes data
     *
     * @param id The id of the data
     * @param folderId The id of the folder
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async deleteData(id: number, folderId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesDeleteData,
            parameters: {
                args: {
                    id,
                    folderId,
                },
            },
        });
    }

    /**
     * Gets the list of available data categories.
     *
     * @param parentID The ID of the parent data category. If not given, the root entries are returned.
     *
     * @returns A promise resolving to the list of category entries.
     */
    public async listDataCategories(parentID?: number): Promise<IShellModuleDataCategoriesEntry[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesListDataCategories,
            parameters: {
                args: {
                    categoryId: parentID,
                },
            },
        });

        return response.result;
    }

    /**
     * Adds a new data category for data entries.
     *
     * @param category A human readable string identifying the data category.
     * @param parent Specifies the parent category to which the new category belongs. Root categories have no parent.
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async addDataCategory(category: string, parent?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesAddDataCategory,
            parameters: {
                args: {
                    name: category,
                    parentCategoryId: parent,
                },
            },
        });
    }

    /**
     * Remove a data category from the list of available data categories.
     *
     * @param categoryId The id of the data category
     *
     * @returns A promise which resolves when the request is finished.
     */
    public async removeDataCategory(categoryId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiModulesRemoveDataCategory,
            parameters: {
                args: {
                    categoryId,
                },
            },
        });
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
}
