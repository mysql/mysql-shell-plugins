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

import { error } from "vscode-extension-tester";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import { Workbench } from "../Workbench";
import { E2EAccordionSection } from "./E2EAccordionSection";
import { E2ERestService } from "./E2ERestService";
import { AuthenticationAppDialog } from "../WebViews/Dialogs/AuthenticationAppDialog";
import { RestUserDialog } from "../WebViews/Dialogs/RestUserDialog";
import { E2ERestUser } from "./E2ERestUser";

/**
 * This class represents the tree within an accordion section and its related functions
 */

export class E2EAuthenticationApp {

    /** The rest service it belongs to */
    public parentService: E2ERestService;

    /** The tree name */
    public treeName: string | undefined;

    /** The vendor */
    public vendor: string | undefined;

    /** The authentication app name */
    public name: string | undefined;

    /** True if the Authentication app is enabled */
    public enabled: boolean | undefined;

    /** True if the Authentication app is limited to registered users */
    public limitToRegisteredUsers: boolean | undefined;

    /** The authentication app settings */
    public settings: {
        /** The authentication app description */
        description?: string | undefined;
        /** The authentication app default role */
        defaultRole?: string | undefined;
    } | undefined;

    /** The authentication app settings */
    public oauth2settings: {
        /** The authentication app app id */
        appId?: string | undefined;
        /** The authentication app secret */
        appSecret?: string | undefined;
        /** The authentication app custom url */
        customURL?: string | undefined;
        /** The authentication app custom url for access token */
        customURLforAccessToken?: string | undefined;
    } | undefined;

    /** The authentication app options */
    public options?: string;

    /** The authentication app users */
    public users?: E2ERestUser[] | undefined = [];

    public constructor(restService: E2ERestService, authApp: interfaces.IRestAuthenticationApp) {
        this.parentService = restService;
        authApp.treeName = authApp.name;
        this.set(authApp);
    }

    /**
     * Adds an authentication app
     */
    public add = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const restAuthenticationApps = await dbTreeSection.tree.getElement(constants.restAuthenticationApps);
        await dbTreeSection.tree.openContextMenuAndSelect(restAuthenticationApps, constants.addNewAuthenticationApp);
        await Workbench.toggleSideBar(false);
        const newApp = await AuthenticationAppDialog.set(this)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await Workbench.toggleSideBar(true);
                    await dbTreeSection.tree.openContextMenuAndSelect(restAuthenticationApps,
                        constants.addNewAuthenticationApp);
                    await Workbench.toggleSideBar(false);

                    return AuthenticationAppDialog.set(this);
                } else {
                    throw e;
                }
            });
        await Workbench.toggleSideBar(true);

        if (!newApp.treeName || newApp.treeName.includes("undefined")) {
            newApp.treeName = `${newApp.name} (${newApp.vendor})`;
        }

        this.set(newApp);
        this.parentService.authenticationApps.push(new E2EAuthenticationApp(this.parentService, newApp));
    };

    /**
     * Edits an authentication app
     * @param newData The new authentication app
     */
    public edit = async (newData: interfaces.IRestAuthenticationApp): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement([this.parentService.treeName]);
        const treeAuthApp = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp,
            constants.restAppCtxMenu2);
        await Workbench.toggleSideBar(false);
        const editedAuthApp = await AuthenticationAppDialog.set(newData)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await Workbench.toggleSideBar(true);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp,
                        constants.restAppCtxMenu2);
                    await Workbench.toggleSideBar(false);

                    return AuthenticationAppDialog.set(newData);
                } else {
                    throw e;
                }
            });
        await Workbench.toggleSideBar(true);
        const previousApp = this.name;
        this.set(editedAuthApp);
        const index = this.parentService.authenticationApps.findIndex((item: interfaces.IRestAuthenticationApp) => {
            return item.name === previousApp;
        });
        this.parentService.authenticationApps[index] = new E2EAuthenticationApp(this.parentService, editedAuthApp);
    };

    /**
     * Adds a user
     * @param userData The new user
     */
    public addUser = async (userData: interfaces.IRestUser): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement([this.parentService.treeName]);
        const treeAuthApp = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.addRESTUser,
            constants.restAppCtxMenu2);
        const user = await RestUserDialog.set(userData)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.addRESTUser,
                        constants.restAppCtxMenu2);

                    return RestUserDialog.set(userData);
                } else {
                    throw e;
                }
            });
        this.users.push(new E2ERestUser(this, user));
    };

    /**
     * Opens a rest object and gets its information
     * @returns A promise resolving with the rest object
     */
    public get = async (): Promise<interfaces.IRestAuthenticationApp> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement([this.parentService.treeName]);
        const element = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(element, constants.editAuthenticationApp);
        await Workbench.toggleSideBar(false);
        const authApp = await AuthenticationAppDialog.get()
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await Workbench.toggleSideBar(true);
                    await dbTreeSection.tree.openContextMenuAndSelect(element, constants.editAuthenticationApp);
                    await Workbench.toggleSideBar(false);

                    return AuthenticationAppDialog.get();
                } else {
                    throw e;
                }
            });
        await Workbench.toggleSideBar(true);

        return authApp;
    };

    /**
     * Deletes an authentication app
     */
    public delete = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        await dbTreeSection.tree.expandElement([this.parentService.treeName]);
        const treeAuthApp = await dbTreeSection.tree.getElement(this.treeName);
        await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.deleteAuthenticationApp,
            constants.restAppCtxMenu2);
        this.parentService.authenticationApps = this.parentService.authenticationApps
            .filter((item: interfaces.IRestAuthenticationApp) => {
                return item.name !== this.name;
            });
    };

    /**
     * Sets an authentication app
     * @param newData The authentication app
     */
    private set = (newData: interfaces.IRestAuthenticationApp): void => {
        this.treeName = newData.treeName;
        this.vendor = newData.vendor;
        this.name = newData.name;
        this.enabled = newData.enabled;
        this.limitToRegisteredUsers = newData.limitToRegisteredUsers;
        this.settings = newData.settings;
        this.oauth2settings = newData.oauth2settings;
        this.options = newData.options;
    };

}
