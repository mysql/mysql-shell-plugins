/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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


import fs from "fs/promises";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import { Workbench } from "../Workbench";
import { E2EAccordionSection } from "./E2EAccordionSection";
import { E2ERestService } from "./E2ERestService";
import { RestSchemaDialog } from "../WebViews/Dialogs/RestSchemaDialog";
import { E2ERestObject } from "./E2ERestObject";
import { error } from "vscode-extension-tester";

/**
 * This class represents the tree within an accordion section and its related functions
 */
export class E2ERestSchema {

    /** The rest service it belongs to */
    public parentService: E2ERestService;

    /** The tree name */
    public treeName: string | undefined;

    /** The service path */
    public restServicePath: string | undefined;

    /** The schema path */
    public restSchemaPath: string | undefined;

    /** The schema access control */
    public accessControl: string | undefined;

    /** The schema auth requirement */
    public requiresAuth: boolean | undefined;

    /** The schema settings */
    public settings: interfaces.IRestSchemaSettings | undefined;

    /** The schema options */
    public options: string | undefined;

    /** The schema rest objects */
    public restObjects: E2ERestObject[] | undefined = [];

    public constructor(restService: E2ERestService, restSchema: interfaces.IRestSchema) {
        this.parentService = restService;
        restSchema.treeName = restSchema.treeName ??
            `/${restSchema.settings.schemaName} (${restSchema.settings.schemaName})`;

        if (restService.advanced && restService.advanced.hostNameFilter) {
            restSchema.restServicePath = `${restService.advanced.hostNameFilter}${restService.servicePath}`;
        } else {
            restSchema.restServicePath = restService.servicePath;
        }

        this.set(restSchema);
    }

    /**
     * Adds a rest schema
     */
    public add = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const treeSchema = await dbTreeSection.tree.getElement(this.settings.schemaName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);
        const restSchema = await RestSchemaDialog.set(this)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);

                    return RestSchemaDialog.set(this);
                } else {
                    throw e;
                }
            });

        if (!restSchema.treeName || restSchema.treeName.includes("undefined")) {
            restSchema.treeName = `/${restSchema.settings.schemaName} (${restSchema.settings.schemaName})`;
        }

        this.set(restSchema);
        this.parentService.restSchemas.push(new E2ERestSchema(this.parentService, restSchema));
    };

    /**
     * Edits a rest schema
     * @param newData The new schema
     */
    public edit = async (newData: interfaces.IRestSchema): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.clickToolbarButton(constants.reloadConnections);
        const parentService = await dbTreeSection.tree.getElement(this.parentService.treeName);
        await parentService.expand();
        const thisSchema = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(thisSchema, constants.editRESTSchema);
        const previousSchema = this.settings.schemaName;
        const editedSchema = await RestSchemaDialog.set(newData).catch(async (e) => {
            if (e instanceof error.TimeoutError) {
                await dbTreeSection.tree.openContextMenuAndSelect(thisSchema, constants.editRESTSchema);
                const editedSchema = await RestSchemaDialog.set(newData);

                return editedSchema;
            } else {
                throw e;
            }
        });
        this.set(editedSchema);
        const index = this.parentService.restSchemas.findIndex((item: interfaces.IRestSchema) => {
            return item.settings.schemaName === previousSchema;
        });
        this.parentService.restSchemas[index] = new E2ERestSchema(this.parentService, editedSchema);
    };

    /**
     * Opens a rest schema and gets its information
     * @returns A promise resolving with the rest schema
     */
    public get = async (): Promise<interfaces.IRestSchema> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const parentService = await dbTreeSection.tree.getElement(this.parentService.treeName);
        await parentService.expand();
        await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
            .tree.getElement(this.treeName), constants.editRESTSchema);

        const schema = RestSchemaDialog.get()
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
                        .tree.getElement(this.treeName), constants.editRESTSchema);

                    return RestSchemaDialog.get();
                } else {
                    throw e;
                }
            });

        return schema;
    };

    /**
     * Loads a rest object from a json file
     * @param objectPath The object path
     */
    public loadRestObjectFromJsonFile = async (objectPath: string): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const tree = [this.parentService.treeName, this.treeName];
        await dbTreeSection.tree.expandElement(tree);
        const treeSchema = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeSchema,
            [constants.loadFromDisk, constants.restObjectFromJSONFile], constants.restSchemaCtxMenu);
        await Workbench.setInputPath(objectPath);
        const objectFile = (await fs.readFile(objectPath)).toString();
        const json = JSON.parse(objectFile);
        this.restObjects.push(new E2ERestObject(this, {
            treeName: `/${json.object.name}`,
            restServicePath: this.parentService.servicePath,
            restSchemaPath: this.restSchemaPath,
            restObjectPath: json.object.request_path,
            accessControl: json.object.enabled === 0 ? constants.accessControlDisabled : constants.accessControlEnabled,
            requiresAuth: json.object.requires_auth === 1 ? true : false,
            dataMapping: {
                dbObject: json.object.name,
                crud: {
                    insert: (json.object.crud_operations as string[]).includes("INSERT"),
                    update: (json.object.crud_operations as string[]).includes("UPDATE"),
                    delete: (json.object.crud_operations as string[]).includes("DELETE"),
                },
            },
            settings: {
                resultFormat: json.object.format,
                itemsPerPage: json.object.items_per_page,
                comments: json.object.comments,
                mediaType: json.object.media_type,
                autoDetectMediaType: json.object.auto_detect_media_type === 0 ? false : true,
            },
            authorization: {
                authStoredProcedure: json.object.auth_stored_procedure,
            },
            options: json.object.options,
        }));

        for (const object of json.object.objects[0].fields) {
            this.restObjects[0].dataMapping.columns = [{
                name: object.name,
                isSelected: object.enabled,
                rowOwnership: false,
                allowSorting: object.allow_sorting,
                preventFiltering: object.allow_filtering,
                preventUpdates: object.no_update,
                excludeETAG: object.no_check,
            }];
        }
    };

    /**
     * Deletes a rest schema
     */
    public delete = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement([this.parentService.treeName]);
        const treeMySQLRestSchema = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema, constants.deleteRESTSchema);
        this.parentService.restSchemas = this.parentService.restSchemas
            .filter((item: interfaces.IRestSchema) => {
                return item.settings.schemaName !== this.settings.schemaName;
            });
    };

    /**
     * Sets a rest schema
     * @param newData The new schema
     */
    private set = (newData: interfaces.IRestSchema): void => {
        this.treeName = newData.treeName;
        this.restServicePath = newData.restServicePath;
        this.restSchemaPath = newData.restSchemaPath;
        this.accessControl = newData.accessControl;
        this.requiresAuth = newData.requiresAuth;
        this.settings = newData.settings;
    };

}
