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

import { until, By, error } from "selenium-webdriver";
import { driver } from "../driver.js";
import * as constants from "../constants.js";
import * as interfaces from "../interfaces.js";
import * as locator from "../locators.js";
import { DialogHelper } from "./DialogHelper.js";

/**
 * This class holds the functions to interact with the Rest object dialog
 */
export class RestObjectDialog {

    /**
     * Sets a Rest Object using the web view dialog
     * @param restObject The object
     * @returns A promise resolving when the object is set and the dialog is closed
     */
    public static set = async (restObject: interfaces.IRestObject): Promise<interfaces.IRestObject> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.exists),
            constants.wait20seconds, "Edit REST Object dialog was not displayed");

        const processColumnActivation = async (colOption: interfaces.IRestObjectColumn): Promise<void> => {
            const inColumns = await driver.wait(until
                .elementsLocated(locator.mrsDbObjectDialog.jsonDuality.dbObjJsonField),
                constants.wait5seconds);
            for (const col of inColumns) {
                if ((await col.findElement(locator.htmlTag.labelClass).getText()) === colOption.name) {
                    const isNotSelected = (await col.findElements(locator.checkBox.unchecked)).length > 0;
                    if (colOption.isSelected === true) {
                        if (isNotSelected === true) {
                            await col.findElement(locator.checkBox.checkMark).click();

                            return;
                        }
                    } else {
                        if (isNotSelected === false) {
                            await col.findElement(locator.checkBox.checkMark).click();

                            return;
                        }
                    }
                }
            }
        };

        const processColumnOption = async (colName: string, colOption: string, wantedValue: boolean): Promise<void> => {
            const inColumns = await driver.wait(until
                .elementsLocated(locator.mrsDbObjectDialog.jsonDuality.dbObjJsonField),
                constants.wait5seconds);

            for (const col of inColumns) {

                if ((await col.findElement(locator.htmlTag.labelClass).getText()) === colName) {
                    const fieldOptions = await col.findElements(locator.mrsDbObjectDialog.jsonDuality.fieldOptionIcon);

                    for (const option of fieldOptions) {
                        const inOptionName = await option.getAttribute("data-tooltip");

                        if (inOptionName === constants.rowOwnership && colOption === constants.rowOwnership) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }

                        if (inOptionName === constants.allowSorting && colOption === constants.allowSorting) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");

                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else if (inOptionIsNotSelected === false) {
                                await driver.actions().move({ origin: col }).perform();
                                await option.click();

                                return;
                            }
                        }

                        if (inOptionName === constants.preventFiltering && colOption === constants.preventFiltering) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");

                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else if (inOptionIsNotSelected === false) {
                                await driver.actions().move({ origin: col }).perform();
                                await option.click();

                                return;
                            }
                        }

                        if (inOptionName === constants.preventUpdates && colOption === constants.preventUpdates) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");

                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else if (inOptionIsNotSelected === false) {
                                await driver.actions().move({ origin: col }).perform();
                                await option.click();

                                return;
                            }
                        }

                        if (inOptionName === constants.excludeETAG && colOption === constants.excludeETAG) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");

                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else if (inOptionIsNotSelected === false) {
                                await driver.actions().move({ origin: col }).perform();
                                await option.click();

                                return;
                            }
                        }
                    }
                }
            }
        };

        if (restObject.restServicePath) {
            const inService = await dialog.findElement(locator.mrsDbObjectDialog.service);
            const isDisabled = await inService.getAttribute("disabled")
                .then(() => { return true; }).catch(() => { return false; });
            if (!isDisabled) {
                await inService.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.serviceList),
                    constants.wait5seconds, "Service list was not found");
                await popup.findElement(By.id(restObject.restServicePath)).click();
            }
        }

        if (restObject.restSchemaPath) {
            const inSchema = await dialog.findElement(locator.mrsDbObjectDialog.schema);
            const isDisabled = await inSchema.getAttribute("disabled")
                .then(() => { return true; }).catch(() => { return false; });
            if (!isDisabled) {
                await inSchema.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.schemaList),
                    constants.wait5seconds, "Schema drop down list was not found");
                await popup.findElement(By.id(restObject.restSchemaPath)).click();
            }
        }

        if (restObject.restObjectPath) {
            await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.requestPath, restObject.restObjectPath);
        }

        if (restObject.accessControl !== undefined) {
            const inAccessControl = await dialog.findElement(locator.mrsDbObjectDialog.accessControl.exists);
            await inAccessControl.click();
            const popup = await driver.wait(until
                .elementLocated(locator.mrsDbObjectDialog.accessControl.selectList.exists),
                constants.wait5seconds, "Access control drop down list was not found");
            if (restObject.accessControl === constants.accessControlEnabled) {
                await popup.findElement(locator.mrsDbObjectDialog.accessControl.selectList.enabled).click();
            } else if (restObject.accessControl === constants.accessControlDisabled) {
                await popup.findElement(locator.mrsDbObjectDialog.accessControl.selectList.disabled).click();
            } else {
                await popup.findElement(locator.mrsDbObjectDialog.accessControl.selectList.private).click();
            }
        }

        if (restObject.requiresAuth !== undefined) {
            await DialogHelper.setCheckboxValue("requiresAuth", restObject.requiresAuth);
        }

        if (restObject.jsonRelDuality) {

            if (restObject.jsonRelDuality.dbObject) {
                await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.jsonDuality.dbObject,
                    restObject.jsonRelDuality.dbObject);
            }

            if (restObject.jsonRelDuality.sdkLanguage) {
                if (restObject.jsonRelDuality.sdkLanguage !== "SDK Language") {
                    const inSdk = await dialog.findElement(locator.mrsDbObjectDialog.jsonDuality.sdkLanguage);
                    await inSdk.click();
                    const popup = await driver.wait(until
                        .elementLocated(locator.mrsDbObjectDialog.jsonDuality.sdkLanguageList),
                        constants.wait5seconds, "SDK Language drop down list was not found");
                    await popup.findElement(By.id(restObject.jsonRelDuality.sdkLanguage)).click();
                }
            }

            if (restObject.jsonRelDuality.columns) {
                for (const column of restObject.jsonRelDuality.columns) {
                    await processColumnActivation(column);
                    const colKeys = Object.keys(column).splice(0);
                    for (let i = 0; i <= colKeys.length - 1; i++) {
                        if (i >= 2) {
                            await processColumnOption(column.name!,
                                constants[colKeys[i] as keyof interfaces.IRestObjectColumn] as string,
                                (column[colKeys[i] as keyof interfaces.IRestObjectColumn] as boolean));
                        }
                    }
                }
            }

            if (restObject.jsonRelDuality.crud) {
                const processCrudItem = async (item: { name: string, value: boolean | undefined; }): Promise<void> => {
                    const crudDivs = await dialog.findElements(locator.mrsDbObjectDialog.jsonDuality.crud);
                    for (const crudDiv of crudDivs) {
                        const isInactive = (await crudDiv.getAttribute("class")).includes("deactivated");
                        const tooltip = await crudDiv.getAttribute("data-tooltip");
                        if (tooltip.toLowerCase().includes(item.name)) {
                            if (item.value === true) {
                                if (isInactive) {
                                    await crudDiv.click();
                                    break;
                                }
                            } else {
                                if (!isInactive) {
                                    await crudDiv.click();
                                    break;
                                }
                            }
                        }
                    }
                };

                for (const key of Object.keys(restObject.jsonRelDuality.crud)) {
                    try {
                        await processCrudItem({
                            name: key, value: restObject.jsonRelDuality
                                .crud[key as keyof interfaces.IRestObjectCrud],
                        });
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        } else {
                            await processCrudItem({
                                name: key, value: restObject.jsonRelDuality
                                    .crud[key as keyof interfaces.IRestObjectCrud],
                            });
                        }
                    }
                }
            }
        }

        if (restObject.settings) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsDbObjectDialog.settingsTab).click();

                return (await dialog.findElement(locator.mrsDbObjectDialog.settingsTab)
                    .getAttribute("class")).includes("selected");
            }, constants.wait5seconds, "Settings tab was not selected");

            if (restObject.settings.resultFormat) {
                const inResultFormat = await dialog
                    .findElement(locator.mrsDbObjectDialog.settings.resultFormat);
                await inResultFormat.click();
                const popup = await driver.wait(until
                    .elementLocated(locator.mrsDbObjectDialog.settings.resultFormatList),
                    constants.wait5seconds, "#crudOperationFormatPopup not found");
                await popup.findElement(By.id(restObject.settings.resultFormat)).click();
            }

            if (restObject.settings.itemsPerPage) {
                await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.settings.itemsPerPage,
                    restObject.settings.itemsPerPage);
            }

            if (restObject.settings.comments) {
                await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.settings.comments,
                    restObject.settings.comments);
            }

            if (restObject.settings.mediaType) {
                await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.settings.mediaType,
                    restObject.settings.mediaType);
            }

            if (restObject.settings.autoDetectMediaType !== undefined) {
                await DialogHelper.setCheckboxValue("autoDetectMediaType", restObject.settings.autoDetectMediaType);
            }
        }

        if (restObject.authorization) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab).click();

                return (await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab)
                    .getAttribute("class")).includes("selected");
            }, constants.wait5seconds, "Authorization tab was not selected");

            if (restObject.authorization.authStoredProcedure) {
                const inStoredPrc = await dialog
                    .findElement(locator.mrsDbObjectDialog.authorization.authStoredProcedure);
                await inStoredPrc.clear();
                await inStoredPrc.sendKeys(restObject.authorization.authStoredProcedure);
            }
        }

        if (restObject.options) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsDbObjectDialog.optionsTab).click();

                return (await dialog.findElement(locator.mrsDbObjectDialog.optionsTab)
                    .getAttribute("class")).includes("selected");
            }, constants.wait5seconds, "Options tab was not selected");

            await DialogHelper.setFieldText(dialog, locator.mrsDbObjectDialog.options.options,
                restObject.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.ok).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Object dialog was not closed");

        restObject.treeName = `${restObject.restObjectPath} (${restObject.jsonRelDuality?.dbObject})`;

        return restObject;
    };

    /**
     * Gets a Rest Object using the web view dialog
     * @returns A promise resolving with the object
     */
    public static get = async (): Promise<interfaces.IRestObject> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.exists),
            constants.wait20seconds, "Edit REST Object dialog was not displayed");

        const restObject: interfaces.IRestObject = {
            restServicePath: await dialog.findElement(locator.mrsDbObjectDialog.serviceLabel).getText(),
            restSchemaPath: await dialog.findElement(locator.mrsDbObjectDialog.schemaLabel).getText(),
            restObjectPath: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.requestPath),
            jsonRelDuality: {
                dbObject: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.jsonDuality.dbObject),
                sdkLanguage: await dialog.findElement(locator.mrsDbObjectDialog.jsonDuality.sdkLanguageLabel).getText(),
            },
        };

        const accessControlValue = (await (await dialog.findElement(locator.mrsDbObjectDialog.accessControl.exists)
            .findElement(locator.htmlTag.label)).getText()).toLowerCase();

        if (accessControlValue.includes(constants.accessControlEnabled)) {
            restObject.accessControl = constants.accessControlEnabled;
        } else if (accessControlValue.includes(constants.accessControlDisabled)) {
            restObject.accessControl = constants.accessControlDisabled;
        } else {
            restObject.accessControl = constants.accessControlPrivate;
        }

        restObject.requiresAuth = await DialogHelper.getCheckBoxValue("requiresAuth");

        const inColumns = await driver.wait(until.elementsLocated(locator.mrsDbObjectDialog.jsonDuality.dbObjJsonField),
            constants.wait5seconds);
        const restColumns: interfaces.IRestObjectColumn[] = [];
        for (const col of inColumns) {
            const restObjectColumn: interfaces.IRestObjectColumn = {
                name: await col.findElement(locator.htmlTag.labelClass).getText(),
                isSelected: !((await col.findElements(locator.checkBox.unchecked)).length > 0),
            };

            const fieldOptions = await col.findElements(locator.mrsDbObjectDialog.jsonDuality.fieldOptionIcon);
            for (const option of fieldOptions) {
                const inOptionName = await option.getAttribute("data-tooltip");
                if (inOptionName === constants.rowOwnership) {
                    restObjectColumn.rowOwnership = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.allowSorting) {
                    restObjectColumn.allowSorting = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.preventFiltering) {
                    restObjectColumn.preventFiltering = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.preventUpdates) {
                    restObjectColumn.preventUpdates = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.excludeETAG) {
                    restObjectColumn.excludeETAG = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
            }
            restColumns.push(restObjectColumn);
        }
        restObject.jsonRelDuality!.columns = restColumns;

        const restObjectCrud: interfaces.IRestObjectCrud = {
            insert: undefined,
            update: undefined,
            delete: undefined,
        };
        const crudDivs = await driver.wait(until.elementsLocated(locator.mrsDbObjectDialog.jsonDuality.crud),
            constants.wait5seconds);
        const crudKeys = Object.keys(restObjectCrud);
        for (const crudDiv of crudDivs) {
            const isInactive = (await crudDiv.getAttribute("class")).includes("deactivated");
            const tooltip = await crudDiv.getAttribute("data-tooltip");
            for (const key of crudKeys) {
                if (tooltip.toLowerCase().includes(key)) {
                    restObjectCrud[key as keyof interfaces.IRestObjectCrud] = !isInactive;
                }
            }
        }
        restObject.jsonRelDuality!.crud = restObjectCrud;

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.settingsTab).click();

            return (await dialog.findElement(locator.mrsDbObjectDialog.settingsTab)
                .getAttribute("class")).includes("selected");
        }, constants.wait5seconds, "Settings tab was not selected");
        restObject.settings = {
            resultFormat: await dialog.findElement(locator.mrsDbObjectDialog.settings.resultFormat).getText(),
            itemsPerPage: await dialog
                .findElement(locator.mrsDbObjectDialog.settings.itemsPerPage).getAttribute("value"),
            comments: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.settings.comments),
            mediaType: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.settings.mediaType),
        };

        restObject.settings.autoDetectMediaType = await DialogHelper.getCheckBoxValue("autoDetectMediaType");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab).click();

            return (await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab)
                .getAttribute("class")).includes("selected");
        }, constants.wait5seconds, "Authorization tab was not selected");

        restObject.authorization = {
            authStoredProcedure: await DialogHelper.getFieldValue(dialog,
                locator.mrsDbObjectDialog.authorization.authStoredProcedure),
        };

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.optionsTab).click();

            return (await dialog.findElement(locator.mrsDbObjectDialog.optionsTab)
                .getAttribute("class")).includes("selected");
        }, constants.wait5seconds, "Options tab was not selected");
        restObject.options = (await dialog.findElement(locator.mrsDbObjectDialog.options.options).getAttribute("value"))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.cancel).click();

            return (await DialogHelper.existsDialog()) === false;
        }, constants.wait10seconds, "The MRS Object dialog was not closed");

        restObject.treeName = `${restObject.restObjectPath} (${restObject.jsonRelDuality?.dbObject})`;

        return restObject;
    };

}
