/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { error } from "vscode-extension-tester";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import { E2EAccordionSection } from "./E2EAccordionSection";
import { E2ERestSchema } from "./E2ERestSchema";
import { RestObjectDialog } from "../WebViews/Dialogs/RestObjectDialog";

/**
 * This class represents the tree within an accordion section and its related functions
 */

export class E2ERestObject {

    /** The rest schema it belongs to */
    public parentSchema: E2ERestSchema;

    /** The tree name */
    public treeName: string | undefined;

    /** The rest service path */
    public restServicePath: string | undefined;

    /** The rest schema path */
    public restSchemaPath: string | undefined;

    /** The rest object path */
    public restObjectPath: string | undefined;

    /** The access control */
    public accessControl: string | undefined;

    /** If it requires authentication */
    public requiresAuth: boolean | undefined;

    /** The data mapping */
    public dataMapping: interfaces.IDataMapping | undefined;

    /** The settings */
    public settings: interfaces.IRestObjectSettings | undefined;

    /** The authorization */
    public authorization: interfaces.IRestObjectAuthorization | undefined;

    /** The options */
    public options: string | undefined;

    public constructor(parentSchema: E2ERestSchema, object: interfaces.IRestObject) {
        this.parentSchema = parentSchema;
        object.treeName = object.treeName ?? `/${object.dataMapping?.dbObject}`;
        this.set(object);
    }

    /**
     * Adds a rest object
     */
    public add = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const treeSchema = await dbTreeSection.tree.getElement(this.parentSchema.settings.schemaName);
        await treeSchema.expand();
        const treeTables = await dbTreeSection.tree.getElement("Tables");
        await treeTables.expand();

        const treeTable = await dbTreeSection.tree.getElement(this.dataMapping.dbObject);
        await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);
        const restObject = await RestObjectDialog.set(this)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);

                    return RestObjectDialog.set(this);
                } else {
                    throw e;
                }
            });

        if (!restObject.treeName || restObject.treeName.includes("undefined")) {
            restObject.treeName = `/${restObject.dataMapping?.dbObject}`;
        }

        this.set(restObject);
        this.parentSchema.restObjects.push(new E2ERestObject(this.parentSchema, restObject));
    };

    /**
     * Edits a rest schema
     * @param newData The new object
     */
    public edit = async (newData: interfaces.IRestObject): Promise<void> => {
        const tree = [
            this.parentSchema.parentService.treeName,
            this.parentSchema.treeName,
        ];

        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement(tree);
        const treeTable = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.editRESTObj);
        const editedObject = await RestObjectDialog.set(newData)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.editRESTObj);

                    return RestObjectDialog.set(newData);
                } else {
                    throw e;
                }
            });
        const previousObject = this.dataMapping.dbObject;
        this.set(editedObject);
        const index = this.parentSchema.restObjects.findIndex((item: interfaces.IRestObject) => {
            return item.dataMapping.dbObject === previousObject;
        });
        this.parentSchema.restObjects[index] = new E2ERestObject(this.parentSchema, editedObject);
    };

    /**
     * Opens a rest object and gets its information
     * @returns A promise resolving with the rest object
     */
    public get = async (): Promise<interfaces.IRestObject> => {
        const tree = [
            this.parentSchema.parentService.treeName,
            this.parentSchema.treeName,
        ];

        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement(tree);
        await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
            .tree.getElement(this.treeName), constants.editRESTObj);

        const object = RestObjectDialog.get()
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
                        .tree.getElement(this.treeName), constants.editRESTObj);

                    return RestObjectDialog.get();
                } else {
                    throw e;
                }
            });

        return object;
    };

    /**
     * Deletes a rest object
     */
    public delete = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const tree = [
            this.parentSchema.parentService.treeName,
            this.parentSchema.treeName,
        ];

        await dbTreeSection.tree.expandElement(tree);
        const treeTable = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.deleteRESTObj);
        this.parentSchema.restObjects = this.parentSchema.restObjects
            .filter((item: interfaces.IRestObject) => {
                return item.dataMapping.dbObject !== this.dataMapping.dbObject;
            });
    };

    /**
     * Sets a rest object
     * @param newData The new object
     */
    private set = (newData: interfaces.IRestObject): void => {
        this.treeName = newData.treeName;
        this.restServicePath = newData.restServicePath;
        this.restSchemaPath = newData.restSchemaPath;
        this.restObjectPath = newData.restObjectPath;
        this.accessControl = newData.accessControl;
        this.requiresAuth = newData.requiresAuth;
        this.dataMapping = newData.dataMapping;
        this.settings = newData.settings;
        this.authorization = newData.authorization;
        this.options = newData.options;
    };
}
