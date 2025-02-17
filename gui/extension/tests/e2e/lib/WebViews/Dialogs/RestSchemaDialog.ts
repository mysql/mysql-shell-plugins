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
import { until, error, By } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { DialogHelper } from "./DialogHelper";

/**
 * This class aggregates the functions to interact with the Rest Schema dialog
 */
export class RestSchemaDialog {

    /**
     * Sets a Rest schema using the web view dialog
     * @param restSchema The service
     * @returns A promise resolving when the schema is set and the dialog is closed
     */
    public static set = async (restSchema?: interfaces.IRestSchema): Promise<interfaces.IRestSchema> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsSchemaDialog.exists),
            constants.wait5seconds, "MRS Schema dialog was not displayed");

        if (restSchema) {

            if (restSchema.restServicePath) {
                await driver.wait(async () => {
                    try {
                        await dialog.findElement(locator.mrsSchemaDialog.service).click();
                    } catch (e) {
                        if (!(e instanceof error.ElementClickInterceptedError)) {
                            throw e;
                        }
                    }

                    return (await driver.findElements(locator.mrsSchemaDialog.serviceList))
                        .length > 0;
                }, constants.wait5seconds, "Service drop down list was not displayed");
                const popup = await driver.findElement(locator.mrsSchemaDialog.serviceList);
                await popup.findElement(By.id(restSchema.restServicePath)).click();
            }

            if (restSchema.restSchemaPath) {
                await DialogHelper.setFieldText(dialog, locator.mrsSchemaDialog.requestPath, restSchema.restSchemaPath);
            }

            if (restSchema.accessControl !== undefined) {
                const inAccessControl = await dialog.findElement(locator.mrsSchemaDialog.accessControl.exists);
                await inAccessControl.click();
                const popup = await driver.wait(until
                    .elementLocated(locator.mrsSchemaDialog.accessControl.selectList.exists),
                    constants.wait5seconds, "Access control drop down list was not found");
                if (restSchema.accessControl === constants.accessControlEnabled) {
                    await popup.findElement(locator.mrsSchemaDialog.accessControl.selectList.enabled).click();
                } else if (restSchema.accessControl === constants.accessControlDisabled) {
                    await popup.findElement(locator.mrsSchemaDialog.accessControl.selectList.disabled).click();
                } else {
                    await popup.findElement(locator.mrsSchemaDialog.accessControl.selectList.private).click();
                }
            }

            if (restSchema.requiresAuth !== undefined) {
                await DialogHelper.setCheckboxValue("requiresAuth", restSchema.requiresAuth);
            }

            // Settings
            if (restSchema.settings) {
                if (restSchema.settings.schemaName) {
                    await DialogHelper.setFieldText(dialog, locator.mrsSchemaDialog.settings.dbSchemaName,
                        restSchema.settings.schemaName);
                }
                if (restSchema.settings.itemsPerPage) {
                    await DialogHelper.setFieldText(dialog, locator.mrsSchemaDialog.settings.itemsPerPage,
                        restSchema.settings.itemsPerPage);
                }
                if (restSchema.settings.comments) {
                    await DialogHelper.setFieldText(dialog, locator.mrsSchemaDialog.settings.comments,
                        restSchema.settings.comments);
                }
            }

            // Options
            await dialog.findElement(locator.mrsSchemaDialog.optionsTab).click();
            if (restSchema.options) {
                await DialogHelper.setFieldText(dialog, locator.mrsSchemaDialog.options.options,
                    restSchema.options);
            }

        } else {
            restSchema = await this.get(false);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsSchemaDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The REST Schema Dialog was not closed");

        return restSchema;

    };

    /**
     * Gets a Rest schema using the web view dialog
     * @param closeDialog True to close the dialog, false otherwise
     * @returns A promise resolving with the rest schema
     */
    public static get = async (closeDialog = true): Promise<interfaces.IRestSchema> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsSchemaDialog.exists),
            constants.wait20seconds, "MRS Schema dialog was not displayed");

        // Main settings
        const restSchema: interfaces.IRestSchema = {
            restServicePath: await dialog.findElement(locator.mrsSchemaDialog.serviceLabel).getText(),
            restSchemaPath: await DialogHelper.getFieldValue(dialog, locator.mrsSchemaDialog.requestPath),
        };

        const accessControlValue = (await (await dialog.findElement(locator.mrsSchemaDialog.accessControl.exists)
            .findElement(locator.htmlTag.label)).getText()).toLowerCase();

        if (accessControlValue.includes(constants.accessControlEnabled)) {
            restSchema.accessControl = constants.accessControlEnabled;
        } else if (accessControlValue.includes(constants.accessControlDisabled)) {
            restSchema.accessControl = constants.accessControlDisabled;
        } else {
            restSchema.accessControl = constants.accessControlPrivate;
        }

        restSchema.requiresAuth = await DialogHelper.getCheckBoxValue("requiresAuth");

        // Settings
        const restSchemaSettings: interfaces.IRestSchemaSettings = {};
        restSchemaSettings.schemaName = await dialog.findElement(locator.mrsSchemaDialog.settings.dbSchemaName)
            .getAttribute("value");
        restSchemaSettings.itemsPerPage = await dialog.findElement(locator.mrsSchemaDialog.settings.itemsPerPage)
            .getAttribute("value");
        restSchemaSettings.comments = await DialogHelper.getFieldValue(dialog,
            locator.mrsSchemaDialog.settings.comments);
        restSchema.settings = restSchemaSettings;

        // Options
        await dialog.findElement(locator.mrsSchemaDialog.optionsTab).click();
        restSchema.options = (await DialogHelper.getFieldValue(dialog, locator.mrsSchemaDialog.options.options))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        if (closeDialog) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsSchemaDialog.cancel).click();

                return (await DialogHelper.existsDialog()) === false;
            }, constants.wait10seconds, "The MRS Service dialog was not closed");
        }

        return restSchema;
    };

}
