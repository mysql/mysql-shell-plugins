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

import { until, By, Key } from "selenium-webdriver";
import { driver } from "../driver.js";
import * as constants from "../constants.js";
import * as interfaces from "../interfaces.js";
import * as locator from "../locators.js";
import { DialogHelper } from "./DialogHelper.js";

/**
 * This class holds the functions to interact with the Rest user dialog
 */
export class RestUserDialog {

    /**
     * Sets a Rest User using the web view dialog
     * @param restUser The user
     * @returns A promise resolving when the user is set and the dialog is closed
     */
    public static set = async (restUser: interfaces.IRestUser): Promise<interfaces.IRestUser> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait20seconds, "User dialog was not displayed");

        if (restUser.username) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.username, restUser.username);
        }

        if (restUser.password) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.password, restUser.password);
        }

        if (restUser.email) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.email, restUser.email);
        }
        if (restUser.assignedRoles) {
            await dialog.findElement(locator.mrsUserDialog.roles).click();
            await driver.wait(until.elementLocated(locator.mrsUserDialog.rolesList),
                constants.wait5seconds, "Roles drop down list was not displayed");

            const roles = await driver.findElement(By.id(restUser.assignedRoles));
            const rolesLabel = await roles.findElement(locator.htmlTag.label);
            const rolesLabelClass = await rolesLabel.getAttribute("class");
            if (rolesLabelClass.includes("unchecked")) {
                await roles.click();
            } else {
                await driver.wait(async () => {
                    await driver.actions().keyDown(Key.ESCAPE).keyUp(Key.ESCAPE).perform();

                    return (await driver.findElements(locator.mrsUserDialog.rolesList)).length === 0;
                }, constants.wait5seconds, "Roles drop down list was not closed");
            }
        }

        if (restUser.permitLogin !== undefined) {
            await DialogHelper.setCheckboxValue("loginPermitted", restUser.permitLogin);
        }
        if (restUser.userOptions) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.appOptions, restUser.userOptions);
        }
        if (restUser.vendorUserId) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.vendorUserId, restUser.vendorUserId);
        }
        if (restUser.mappedUserId) {
            await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.mappedUserId, restUser.mappedUserId);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsUserDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");

        return restUser;
    };

    /**
     * Gets a Rest User using the web view dialog
     * @returns A promise resolving with the user
     */
    public static get = async (): Promise<interfaces.IRestUser> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait20seconds, "User dialog was not displayed");

        const restUser: interfaces.IRestUser = {
            username: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.username),
            password: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.password),
            authenticationApp: await (await dialog.findElement(locator.mrsUserDialog.authApp)).getAttribute("value"),
            email: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.email),
            assignedRoles: await dialog.findElement(locator.mrsUserDialog.rolesLabel).getText(),
            userOptions: (await dialog.findElement(locator.mrsUserDialog.appOptions)
                .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim(),
            vendorUserId: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.vendorUserId),
            mappedUserId: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.mappedUserId),
        };

        restUser.permitLogin = await DialogHelper.getCheckBoxValue("loginPermitted");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsUserDialog.cancel).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");

        return restUser;

    };

}
