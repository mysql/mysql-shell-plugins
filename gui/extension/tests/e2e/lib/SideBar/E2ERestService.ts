/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
import { Workbench } from "../Workbench";
import { E2EAccordionSection } from "./E2EAccordionSection";
import { RestServiceDialog } from "../WebViews/Dialogs/RestServiceDialog";
import { AuthenticationAppDialog } from "../WebViews/Dialogs/AuthenticationAppDialog";
import fs from "fs/promises";
import { E2ERestSchema } from "./E2ERestSchema";
import { E2EAuthenticationApp } from "./E2EAuthenticationApp";
import { E2ERestUser } from "./E2ERestUser";

/**
 * This class represents the tree within an accordion section and its related functions
 */
export class E2ERestService {

    /** The tree name */
    public treeName: string | undefined;

    /** The service path */
    public servicePath: string | undefined;

    /** True if the service is enabled, false otherwise */
    public enabled: boolean | undefined;

    /** True if the server is marked as default, false otherwise */
    public default: boolean | undefined;

    /** True if the server is published, false otherwise */
    public published: boolean | undefined;

    /** The service settings */
    public settings: interfaces.IRestServiceSettings | undefined;

    /** The service options */
    public options: string | undefined;

    /** The service authentication */
    public authentication: interfaces.IRestServiceAuthentication;

    /** The service advanced data */
    public advanced: interfaces.IRestServiceAdvanced;

    /** The service authentication apps */
    public authenticationApps: E2EAuthenticationApp[] | undefined = [];

    /** The service schemas */
    public restSchemas: E2ERestSchema[] | undefined = [];

    public constructor(restService: interfaces.IRestService) {
        if (!restService.treeName) {
            if (restService.advanced && restService.advanced.hostNameFilter) {
                restService.treeName = `${restService.servicePath} (${restService.advanced.hostNameFilter})`;
            } else {
                restService.treeName = restService.servicePath;
            }
        }

        this.set(restService);
    }

    /**
     * Creates a new rest service
     */
    public create = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
        await treeMySQLRestService.expand();
        await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.addRESTService);
        await RestServiceDialog.set(this)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.addRESTService);

                    return RestServiceDialog.set(this);
                } else {
                    throw e;
                }
            });

        if (this.settings && this.settings.mrsAdminUser) {
            const newApp = new E2EAuthenticationApp(this, {
                vendor: "MRS",
                name: "MRS",
                enabled: true,
                limitToRegisteredUsers: true,
                settings: {
                    description: "MRS Auth App",
                    defaultRole: "Full Access",
                },
            });
            newApp.users.push(new E2ERestUser(newApp, {
                username: this.settings.mrsAdminUser,
                password: this.settings.mrsAdminPassword,
                assignedRoles: "Full Access",
                authenticationApp: "MRS",
                permitLogin: true,
            }));

            this.authenticationApps.push(newApp);
        }
    };

    /**
     * Edits a rest service
     * @param restService The new service
     */
    public edit = async (restService: interfaces.IRestService): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
            .tree.getElement(this.treeName), constants.editRESTService);
        const editedRestService = await RestServiceDialog.set(restService)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
                        .tree.getElement(this.treeName), constants.editRESTService);

                    return RestServiceDialog.set(restService);
                } else {
                    throw e;
                }
            });
        this.set(editedRestService);
    };

    /**
     * Opens a rest service and gets its information
     * @returns A promise resolving with the rest service
     */
    public get = async (): Promise<interfaces.IRestService> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
            .tree.getElement(this.treeName), constants.editRESTService);

        const service = RestServiceDialog.get()
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
                        .tree.getElement(this.treeName), constants.editRESTService);

                    return RestServiceDialog.get();
                } else {
                    throw e;
                }
            });

        return service;
    };

    /**
     * Loads a rest schema from json file
     * @param schemaPath The schema path
     */
    public loadRestSchemaFromJsonFile = async (schemaPath: string): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const thisService = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(thisService, constants.loadRESTSchemaFromJSON);
        await Workbench.setInputPath(schemaPath);

        const schemaFile = (await fs.readFile(schemaPath)).toString();
        const json = JSON.parse(schemaFile);

        this.restSchemas.push(new E2ERestSchema(this, {
            treeName: `/${json.schema.name} (${json.schema.name})`,
            restServicePath: this.servicePath,
            restSchemaPath: json.schema.request_path,
            accessControl: json.schema.enabled === 0 ? constants.accessControlDisabled : constants.accessControlEnabled,
            settings: {
                schemaName: json.schema.name,
                itemsPerPage: json.schema.items_per_page,
            },
        }));
    };

    /**
     * Adds an Authentication app
     * @param data The authentication app
     */
    public addAuthenticationApp = async (data: interfaces.IRestAuthenticationApp): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const thisService = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(thisService, constants.addNewAuthApp);
        await Workbench.toggleSideBar(false);
        const authApp = await AuthenticationAppDialog.set(data)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await Workbench.toggleSideBar(true);
                    await dbTreeSection.tree.openContextMenuAndSelect(thisService, constants.addNewAuthApp);
                    await Workbench.toggleSideBar(false);

                    return AuthenticationAppDialog.set(data);
                } else {
                    throw e;
                }
            });
        await Workbench.toggleSideBar(true);
        this.authenticationApps.push(new E2EAuthenticationApp(this, authApp));
    };

    /**
     * Deletes the rest service
     */
    public delete = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const treeRestService = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeRestService, constants.deleteRESTService);
    };

    /**
     * Sets the new rest service
     * @param restService The service
     */
    private set = (restService: interfaces.IRestService): void => {
        this.treeName = restService.treeName;
        this.servicePath = restService.servicePath;
        this.enabled = restService.enabled;
        this.default = restService.default;
        this.published = restService.published;
        this.settings = restService.settings;
        this.options = restService.options;
        this.authentication = restService.authentication;
    };

}
