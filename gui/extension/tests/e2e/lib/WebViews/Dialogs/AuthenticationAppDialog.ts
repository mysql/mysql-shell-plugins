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
import { until, By } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { DialogHelper } from "./DialogHelper";

/**
 * This class holds the functions to interact with the Authentication app dialog
 */
export class AuthenticationAppDialog {

    /**
     * Sets a Rest Authentication App using the web view dialog
     * @param authApp The authentication app
     * @returns A promise resolving when the authentication app is set and the dialog is closed
     */
    public static set = async (authApp: interfaces.IRestAuthenticationApp): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait20seconds, "Authentication app dialog was not displayed");

        if (authApp.vendor) {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.authVendorName).click();
            const popup = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.authVendorNameList),
                constants.wait5seconds, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.vendor)).click();
        }

        if (authApp.name) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.authAppName, authApp.name);
        }
        if (authApp.description) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.description,
                authApp.description);
        }
        if (authApp.accessToken) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.accessToken,
                authApp.accessToken);
        }
        if (authApp.appId) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.authAppId, authApp.appId);
        }
        if (authApp.customURL) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.authAppUrl, authApp.customURL);
        }
        if (authApp.customURLforAccessToken) {
            await DialogHelper.setFieldText(dialog, locator.mrsAuthenticationAppDialog.urlDirectAuth,
                authApp.customURLforAccessToken);
        }
        if (authApp.defaultRole) {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.defaultRoleName).click();
            const popup = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.defaultRoleList),
                constants.wait5seconds, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.defaultRole)).click();
        }

        if (authApp.enabled !== undefined) {
            await DialogHelper.setCheckboxValue("enabled", authApp.enabled);
            await dialog.click();
        }

        if (authApp.limitToRegisteredUsers !== undefined) {
            await DialogHelper.setCheckboxValue("limitToRegisteredUsers", authApp.limitToRegisteredUsers);
            await dialog.click();
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

    };

    /**
     * Gets a Rest Authentication App using the web view dialog
     * @returns A promise resolving with the authentication app
     */
    public static get = async (): Promise<interfaces.IRestAuthenticationApp> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait20seconds, "Authentication app dialog was not displayed");

        const authenticationApp: interfaces.IRestAuthenticationApp = {
            vendor: await dialog.findElement(locator.mrsAuthenticationAppDialog.authVendorNameLabel).getText(),
            name: await DialogHelper.getFieldValue(dialog, locator.mrsAuthenticationAppDialog.authAppName),
            description: await DialogHelper.getFieldValue(dialog, locator.mrsAuthenticationAppDialog.description),
            accessToken: await DialogHelper.getFieldValue(dialog, locator.mrsAuthenticationAppDialog.accessToken),
            appId: await DialogHelper.getFieldValue(dialog, locator.mrsAuthenticationAppDialog.authAppId),
            customURL: await DialogHelper.getFieldValue(dialog, locator.mrsAuthenticationAppDialog.authAppUrl),
            customURLforAccessToken: await dialog.findElement(locator.mrsAuthenticationAppDialog.urlDirectAuth)
                .getAttribute("value"),
            defaultRole: await dialog.findElement(locator.mrsAuthenticationAppDialog.defaultRoleNameLabel).getText(),
        };

        authenticationApp.enabled = await DialogHelper.getCheckBoxValue("enabled");
        authenticationApp.limitToRegisteredUsers = await DialogHelper.getCheckBoxValue("limitToRegisteredUsers");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

        return authenticationApp;
    };

}
