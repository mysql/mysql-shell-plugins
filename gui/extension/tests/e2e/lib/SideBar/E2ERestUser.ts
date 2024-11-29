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
import { E2EAccordionSection } from "./E2EAccordionSection";
import { E2EAuthenticationApp } from "./E2EAuthenticationApp";
import { RestUserDialog } from "../WebViews/Dialogs/RestUserDialog";

/**
 * This class represents the tree within an accordion section and its related functions
 */

export class E2ERestUser implements interfaces.IRestUser {

    /** The Authentication App it belongs to */
    public parentAuthApp: E2EAuthenticationApp | undefined;

    /** The user name */
    public username: string | undefined;

    /** The password */
    public password: string | undefined;

    /** The Authentication app */
    public authenticationApp: string | undefined;

    /** The email */
    public email: string | undefined;

    /** The assigned roles */
    public assignedRoles: string | undefined;

    /** The user options */
    public userOptions: string | undefined;

    /** The permit login flag */
    public permitLogin: boolean | undefined;

    /** The vendor user id */
    public vendorUserId: string | undefined;

    /** The mapped user id */
    public mappedUserId: string | undefined;

    public constructor(authApp: E2EAuthenticationApp, user: interfaces.IRestUser) {
        this.parentAuthApp = authApp;
        this.set(user);
    }

    /**
     * Edits a user
     * @param newUser The new user
     */
    public edit = async (newUser: interfaces.IRestUser): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

        const tree = [
            this.parentAuthApp.parentService.treeName,
            this.parentAuthApp.treeName,
            this.username,
        ];

        await dbTreeSection.tree.expandElement(tree);
        const treeUser = await dbTreeSection.tree.getElement(this.username);
        await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);
        const previousUser = this.username;
        const editedUser = await RestUserDialog.set(newUser)
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);

                    return RestUserDialog.set(newUser);
                } else {
                    throw e;
                }
            });
        const index = this.parentAuthApp.users.findIndex((item: interfaces.IRestUser) => {
            return item.username === previousUser;
        });
        this.parentAuthApp.users[index] = new E2ERestUser(this.parentAuthApp, editedUser);

    };

    /**
     * Opens a rest user and gets its information
     * @returns A promise resolving with the rest user
     */
    public get = async (): Promise<interfaces.IRestUser> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const tree = [
            this.parentAuthApp.parentService.treeName,
            this.parentAuthApp.treeName,
            this.username,
        ];

        await dbTreeSection.tree.expandElement(tree);
        await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
            .tree.getElement(this.username), constants.editRESTUser);

        const user = RestUserDialog.get()
            .catch(async (e) => {
                if (e instanceof error.TimeoutError) {
                    await dbTreeSection.tree.openContextMenuAndSelect(await dbTreeSection
                        .tree.getElement(this.username), constants.editRESTUser);

                    return RestUserDialog.get();
                } else {
                    throw e;
                }
            });

        return user;
    };


    /**
     * Deletes a user
     */
    public delete = async (): Promise<void> => {
        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const tree = [
            this.parentAuthApp.parentService.treeName,
            this.parentAuthApp.treeName,
            this.username,
        ];

        await dbTreeSection.tree.expandElement(tree);
        const treeUser = await dbTreeSection.tree.getElement(this.username);
        await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.deleteRESTUser);
        this.parentAuthApp.users = this.parentAuthApp.users
            .filter((item: interfaces.IRestUser) => {
                return item.username !== this.username;
            });
    };

    /**
     * Sets a user
     * @param newUser The new user
     */
    private set = (newUser: interfaces.IRestUser): void => {
        this.username = newUser.username;
        this.password = newUser.password;
        this.email = newUser.email;
        this.assignedRoles = newUser.assignedRoles;
        this.userOptions = newUser.userOptions;
        this.permitLogin = newUser.permitLogin;
        this.vendorUserId = newUser.vendorUserId;
        this.mappedUserId = newUser.mappedUserId;
    };

}
