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
import { until, error, By } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { DialogHelper } from "./DialogHelper";

/**
 * This class holds the functions to interact with the Rest service dialog
 */
export class RestServiceDialog {

    /**
     * Sets a Rest service using the web view dialog
     * @param restService The service
     * @returns A promise resolving when the service is set and the dialog is closed
     */
    public static set = async (restService: interfaces.IRestService): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsServiceDialog.exists),
            constants.wait5seconds, "MRS Service dialog was not displayed");

        // Main settings
        await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.servicePath, restService.servicePath);
        await DialogHelper.setCheckboxValue("makeDefault", restService.default);
        await DialogHelper.setCheckboxValue("enabled", restService.enabled);

        // Settings
        if (restService.settings) {
            if (restService.settings.comments) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.comments,
                    restService.settings.comments);
            }
            if (restService.settings.hostNameFilter) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.hostNameFilter,
                    restService.settings.hostNameFilter);
            }
        }

        // Options
        if (restService.options) {
            await dialog.findElement(locator.mrsServiceDialog.optionsTab).click();
            await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.options.options,
                restService.options);
        }
        if (restService.authentication) {
            await dialog.findElement(locator.mrsServiceDialog.authenticationTab).click();
            if (restService.authentication.authenticationPath) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authentication.authPath,
                    restService.authentication.authenticationPath);
            }
            if (restService.authentication.redirectionUrl) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authentication.authCompletedUrl,
                    restService.authentication.redirectionUrl);

            }
            if (restService.authentication.redirectionUrlValid) {
                await DialogHelper.setFieldText(dialog,
                    locator.mrsServiceDialog.authentication.authCompletedUrlValidation,
                    restService.authentication.redirectionUrlValid);
            }
            if (restService.authentication.authCompletedChangeCont) {
                await DialogHelper.setFieldText(dialog,
                    locator.mrsServiceDialog.authentication.authCompletedPageContent,
                    restService.authentication.authCompletedChangeCont);
            }
        }
        if (restService.authenticationApps) {
            await dialog.findElement(locator.mrsServiceDialog.authenticationAppsTab).click();
            if (restService.authenticationApps.vendor) {
                await driver.wait(async () => {
                    try {
                        await dialog.findElement(locator.mrsServiceDialog.authenticationApps.vendorName).click();
                    } catch (e) {
                        if (!(e instanceof error.ElementClickInterceptedError)) {
                            throw e;
                        }
                    }

                    return (await driver.findElements(locator.mrsServiceDialog.authenticationApps.vendorNameList))
                        .length > 0;
                }, constants.wait5seconds, "Vendor drop down list was not displayed");

                const popup = await driver.findElement(locator.mrsServiceDialog.authenticationApps.vendorNameList);
                await popup.findElement(By.id(restService.authenticationApps.vendor)).click();
            }
            if (restService.authenticationApps.name) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authenticationApps.authAppsName,
                    restService.authenticationApps.name);
            }
            if (restService.authenticationApps.description) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authenticationApps.authAppsDescription,
                    restService.authenticationApps.description);
            }
            if (restService.authenticationApps.enabled !== undefined) {
                await DialogHelper.setCheckboxValue("authApps.enabled", restService.authenticationApps.enabled);
            }
            if (restService.authenticationApps.limitToRegisteredUsers !== undefined) {
                await DialogHelper.setCheckboxValue("authApps.limitToRegisteredUsers",
                    restService.authenticationApps.limitToRegisteredUsers);

            }
            if (restService.authenticationApps.appId) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authenticationApps.authAppsId,
                    restService.authenticationApps.appId);
            }
            if (restService.authenticationApps.accessToken) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authenticationApps.authAppsAccessToken,
                    restService.authenticationApps.accessToken);
            }
            if (restService.authenticationApps.customUrl) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.authenticationApps.authAppsUrl,
                    restService.authenticationApps.customUrl);
            }
            if (restService.authenticationApps.customUrlForAccessToken) {
                await DialogHelper.setFieldText(dialog,
                    locator.mrsServiceDialog.authenticationApps.authAppsUrlDirectAuth,
                    restService.authenticationApps.customUrlForAccessToken);
            }
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");
    };

    /**
     * Gets a Rest service using  the web view dialog
     * @returns A promise resolving the rest service
     */
    public static get = async (): Promise<interfaces.IRestService> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsServiceDialog.exists),
            constants.wait5seconds, "MRS Service dialog was not displayed");

        // Main settings
        const restService: interfaces.IRestService = {
            servicePath: await DialogHelper.getFieldValue(dialog, locator.mrsServiceDialog.servicePath),
        };

        restService.default = await DialogHelper.getCheckBoxValue("makeDefault");
        restService.enabled = await DialogHelper.getCheckBoxValue("enabled");

        // Settings

        const restServiceSettings: interfaces.IRestServiceSettings = {};
        restServiceSettings.comments = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.settings.comments);
        restServiceSettings.hostNameFilter = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.settings.hostNameFilter);
        restService.settings = restServiceSettings;

        // Options
        await dialog.findElement(locator.mrsServiceDialog.optionsTab).click();
        restService.options = (await DialogHelper.getFieldValue(dialog, locator.mrsServiceDialog.options.options))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        // Authentication
        await dialog.findElement(locator.mrsServiceDialog.authenticationTab).click();
        const authentication: interfaces.IRestServiceAuthentication = {};
        authentication.authenticationPath = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.authentication.authPath);
        authentication.redirectionUrl = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.authentication.authCompletedUrl);
        authentication.redirectionUrlValid = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.authentication.authCompletedUrlValidation);
        authentication.authCompletedChangeCont = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.authentication.authCompletedPageContent);
        restService.authentication = authentication;

        // Authentication apps
        await dialog.findElement(locator.mrsServiceDialog.authenticationAppsTab).click();
        const authenticationApps: interfaces.IRestServiceAuthApps = {
            vendor: await dialog.findElement(locator.mrsServiceDialog.authenticationApps.vendorName)
                .findElement(locator.htmlTag.label).getText(),
            name: await DialogHelper.getFieldValue(dialog, locator.mrsServiceDialog.authenticationApps.authAppsName),
            description: await DialogHelper.getFieldValue(dialog,
                locator.mrsServiceDialog.authenticationApps.authAppsDescription),
            enabled: await DialogHelper.getCheckBoxValue("authApps.enabled"),
            limitToRegisteredUsers: await DialogHelper.getCheckBoxValue("authApps.limitToRegisteredUsers"),
            appId: await DialogHelper.getFieldValue(dialog, locator.mrsServiceDialog.authenticationApps.authAppsId),
            accessToken: await DialogHelper.getFieldValue(dialog,
                locator.mrsServiceDialog.authenticationApps.authAppsAccessToken),
            customUrl: await DialogHelper.getFieldValue(dialog,
                locator.mrsServiceDialog.authenticationApps.authAppsUrl),
            customUrlForAccessToken: await DialogHelper.getFieldValue(dialog,
                locator.mrsServiceDialog.authenticationApps.authAppsUrlDirectAuth),
        };

        restService.authenticationApps = authenticationApps;

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.cancel).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restService;
    };

}
