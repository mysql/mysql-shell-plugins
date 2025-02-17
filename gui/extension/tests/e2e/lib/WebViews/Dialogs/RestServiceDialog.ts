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
import { until } from "vscode-extension-tester";
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
    public static set = async (restService: interfaces.IRestService): Promise<interfaces.IRestService> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsServiceDialog.exists),
            constants.wait20seconds, "MRS Service dialog was not displayed");

        // Main settings
        await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.servicePath, restService.servicePath);
        await DialogHelper.setCheckboxValue("makeDefault", restService.default);
        await DialogHelper.setCheckboxValue("enabled", restService.enabled);
        await DialogHelper.setCheckboxValue("published", restService.published ?? true);

        // Settings
        if (restService.settings) {
            if (restService.settings.mrsAdminUser) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.mrsAdminUser,
                    restService.settings.mrsAdminUser);
            }

            if (restService.settings.mrsAdminPassword) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.mrsAdminUserPassword,
                    restService.settings.mrsAdminPassword);
            }

            if (restService.settings.comments) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.comments,
                    restService.settings.comments);
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

        if (restService.advanced) {
            await dialog.findElement(locator.mrsServiceDialog.advancedTab).click();
            if (restService.advanced.hostNameFilter) {
                await DialogHelper.setFieldText(dialog, locator.mrsServiceDialog.settings.hostNameFilter,
                    restService.advanced.hostNameFilter);
            }
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restService;
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
            constants.wait20seconds, "MRS Service dialog was not displayed");

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

        await dialog.findElement(locator.mrsServiceDialog.advancedTab).click();
        const hostnameFilter = await DialogHelper.getFieldValue(dialog,
            locator.mrsServiceDialog.settings.hostNameFilter);

        if (hostnameFilter !== "") {
            restService.advanced = {
                hostNameFilter: hostnameFilter,
            };
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.cancel).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restService;
    };

}
