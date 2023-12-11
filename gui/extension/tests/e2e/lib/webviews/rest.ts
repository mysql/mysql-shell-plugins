/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { By, until, Key, error } from "vscode-extension-tester";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import { driver, Misc } from "../misc";
import * as constants from "../constants";
import * as interfaces from "../interfaces";
import * as locator from "../locators";
import { DialogHelper } from "./dialogHelper";

export class Rest {

    /**
     * Sets a Rest service using the web view dialog
     * @param restService The service
     * @returns A promise resolving when the service is set and the dialog is closed
     */
    public static setService = async (restService: interfaces.IRestService): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
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
            await dialog.findElement(locator.mrsServiceDialog.autenticationAppsTab).click();
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
                    locator.mrsServiceDialog.authenticationApps.authAppsurlDirectAuth,
                    restService.authenticationApps.customUrlForAccessToken);
            }
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");
    };

    /**
     * Gets a Rest service using the web view dialog
     * @returns A promise resolving with the rest service
     */
    public static getService = async (): Promise<interfaces.IRestService> => {
        if ((await Misc.insideIframe()) === false) {
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
        await dialog.findElement(locator.mrsServiceDialog.autenticationAppsTab).click();
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
                locator.mrsServiceDialog.authenticationApps.authAppsurlDirectAuth),
        };

        restService.authenticationApps = authenticationApps;

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.cancel).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restService;
    };

    /**
     * Sets a Rest schema using the web view dialog
     * @param restSchema The service
     * @returns A promise resolving when the schema is set and the dialog is closed
     */
    public static setSchema = async (restSchema: interfaces.IRestSchema): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsSchemaDialog.exists),
            constants.wait5seconds, "MRS Schema dialog was not displayed");

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

        if (restSchema.enabled !== undefined) {
            await DialogHelper.setCheckboxValue("enabled", restSchema.enabled);
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

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsSchemaDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The REST Schema Dialog was not closed");

    };

    /**
     * Gets a Rest schema using the web view dialog
     * @returns A promise resolving with the rest schema
     */
    public static getSchema = async (): Promise<interfaces.IRestSchema> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsSchemaDialog.exists),
            constants.wait5seconds, "MRS Schema dialog was not displayed");

        // Main settings
        const restShema: interfaces.IRestSchema = {
            restServicePath: await dialog.findElement(locator.mrsSchemaDialog.serviceLabel).getText(),
            restSchemaPath: await DialogHelper.getFieldValue(dialog, locator.mrsSchemaDialog.requestPath),
        };

        restShema.enabled = await DialogHelper.getCheckBoxValue("enabled");
        restShema.requiresAuth = await DialogHelper.getCheckBoxValue("requiresAuth");

        // Settings
        const restSchemaSettings: interfaces.IRestSchemaSettings = {};
        restSchemaSettings.schemaName = await dialog.findElement(locator.mrsSchemaDialog.settings.dbSchemaName)
            .getAttribute("value");
        restSchemaSettings.itemsPerPage = await dialog.findElement(locator.mrsSchemaDialog.settings.itemsPerPage)
            .getAttribute("value");
        restSchemaSettings.comments = await DialogHelper.getFieldValue(dialog,
            locator.mrsSchemaDialog.settings.comments);
        restShema.settings = restSchemaSettings;

        // Options
        await dialog.findElement(locator.mrsSchemaDialog.optionsTab).click();
        restShema.options = (await DialogHelper.getFieldValue(dialog, locator.mrsSchemaDialog.options.options))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsSchemaDialog.cancel).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restShema;
    };

    /**
     * Sets a Rest Authentication App using the web view dialog
     * @param authApp The authentication app
     * @returns A promise resolving when the authentication app is set and the dialog is closed
     */
    public static setAuthenticationApp = async (authApp: interfaces.IRestAuthenticationApp): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait10seconds, "Authentication app dialog was not displayed");

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

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

    };

    /**
     * Gets a Rest Authentication App using the web view dialog
     * @returns A promise resolving with the authentication app
     */
    public static getAuthenticationApp = async (): Promise<interfaces.IRestAuthenticationApp> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait10seconds, "Authentication app dialog was not displayed");

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

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

        return authenticationApp;
    };

    /**
     * Sets a Rest User using the web view dialog
     * @param restUser The user
     * @returns A promise resolving when the user is set and the dialog is closed
     */
    public static setUser = async (restUser: interfaces.IRestUser): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait10seconds, "User dialog was not displayed");

        await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.username, restUser.username);
        await DialogHelper.setFieldText(dialog, locator.mrsUserDialog.password, restUser.password);

        if (restUser.authenticationApp) {
            await dialog.findElement(locator.mrsUserDialog.authApp).click();
            await driver.wait(until.elementLocated(locator.mrsUserDialog.authAppList),
                constants.wait5seconds, "Auth app drop down list was not displayed");

            await driver.wait(until.elementLocated(By.id(restUser.authenticationApp)), constants.wait5seconds).click();
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
                    await keyboard.type(nutKey.Escape);

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

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");
    };

    /**
     * Gets a Rest User using the web view dialog
     * @returns A promise resolving with the user
     */
    public static getUser = async (): Promise<interfaces.IRestUser> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait10seconds, "User dialog was not displayed");

        const restUser: interfaces.IRestUser = {
            username: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.username),
            password: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.password),
            authenticationApp: await dialog.findElement(locator.mrsUserDialog.authAppLabel).getText(),
            email: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.email),
            assignedRoles: await dialog.findElement(locator.mrsUserDialog.rolesLabel).getText(),
            userOptions: (await dialog.findElement(locator.mrsUserDialog.appOptions)
                .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim(),
            vendorUserId: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.vendorUserId),
            mappedUserId: await DialogHelper.getFieldValue(dialog, locator.mrsUserDialog.mappedUserId),
        };

        restUser.permitLogin = await DialogHelper.getCheckBoxValue("loginPermitted");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsUserDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");

        return restUser;

    };

    /**
     * Sets a Rest Object using the web view dialog
     * @param restObject The object
     * @returns A promise resolving when the object is set and the dialog is closed
     */
    public static setObject = async (restObject: interfaces.IRestObject): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.exists),
            constants.wait10seconds, "Edit REST Object dialog was not displayed");

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
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
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
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
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
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
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
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
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
        if (restObject.enabled !== undefined) {
            await DialogHelper.setCheckboxValue("enabled", restObject.enabled);
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
                            await processColumnOption(column.name,
                                constants[colKeys[i]] as string, (column[colKeys[i]] as boolean));
                        }
                    }
                }
            }
            if (restObject.jsonRelDuality.crud) {
                const processCrudItem = async (item: { name: string, value: boolean }): Promise<void> => {
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
                        await processCrudItem({ name: key, value: restObject.jsonRelDuality.crud[key] });
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        } else {
                            await processCrudItem({ name: key, value: restObject.jsonRelDuality.crud[key] });
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
            if (restObject.authorization.enforceRowUserOwner !== undefined) {
                await DialogHelper.setCheckboxValue("rowUserOwnershipEnforced",
                    restObject.authorization.enforceRowUserOwner);
            }
            if (restObject.authorization.rowOwnerShipField) {
                const inOwner = await dialog
                    .findElement(locator.mrsDbObjectDialog.authorization.rowOwnershipField);
                await inOwner.click();
                const popup = await driver.wait(until
                    .elementLocated(locator.mrsDbObjectDialog.authorization.rowUserOwnershipFieldList),
                    constants.wait5seconds, "#rowUserOwnershipColumnPopup not found");
                await popup.findElement(By.id(restObject.authorization.rowOwnerShipField)).click();
            }
            if (restObject.authorization.customStoredProcedure) {
                const inStoredPrc = await dialog
                    .findElement(locator.mrsDbObjectDialog.authorization.authStoredProcedure);
                await inStoredPrc.clear();
                await inStoredPrc.sendKeys(restObject.authorization.customStoredProcedure);
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

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Object dialog was not closed");
    };

    /**
     * Gets a Rest Object using the web view dialog
     * @returns A promise resolving with the object
     */
    public static getObject = async (): Promise<interfaces.IRestObject> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.exists),
            constants.wait10seconds, "Edit REST Object dialog was not displayed");

        const restObject: interfaces.IRestObject = {
            restServicePath: await dialog.findElement(locator.mrsDbObjectDialog.serviceLabel).getText(),
            restSchemaPath: await dialog.findElement(locator.mrsDbObjectDialog.schemaLabel).getText(),
            restObjectPath: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.requestPath),
            jsonRelDuality: {
                dbObject: await DialogHelper.getFieldValue(dialog, locator.mrsDbObjectDialog.jsonDuality.dbObject),
                sdkLanguage: await dialog.findElement(locator.mrsDbObjectDialog.jsonDuality.sdkLanguageLabel).getText(),
            },
        };

        restObject.enabled = await DialogHelper.getCheckBoxValue("enabled");
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
        restObject.jsonRelDuality.columns = restColumns;

        const restObjectCrud: interfaces.IRestObjectCrud = {
            create: undefined,
            read: undefined,
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
                    restObjectCrud[key] = !isInactive;
                }
            }
        }
        restObject.jsonRelDuality.crud = restObjectCrud;

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
        restObject.authorization = {};

        restObject.authorization.enforceRowUserOwner = await DialogHelper.getCheckBoxValue("rowUserOwnershipEnforced");

        restObject.authorization.rowOwnerShipField = await dialog
            .findElement(locator.mrsDbObjectDialog.authorization.rowUserOwnershipColumnLabel)
            .getText();
        restObject.authorization.customStoredProcedure = await dialog
            .findElement(locator.mrsDbObjectDialog.authorization.authStoredProcedure)
            .getAttribute("value");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.optionsTab).click();

            return (await dialog.findElement(locator.mrsDbObjectDialog.optionsTab)
                .getAttribute("class")).includes("selected");
        }, constants.wait5seconds, "Options tab was not selected");
        restObject.options = (await dialog.findElement(locator.mrsDbObjectDialog.options.options).getAttribute("value"))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Object dialog was not closed");

        return restObject;
    };

    /**
     * Sets a MRS SDK using the web view dialog
     * @param data The MRS data
     * @returns A promise resolving when the MRS data is set and the dialog is closed
     */
    public static setExportMRSSDK = async (data: interfaces.IExportMRSSDK): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated(locator.mrsSdkDialog.exists), constants.wait5seconds,
            "Export MRS SDK dialog was not found");

        if (data) {
            if (data.directory) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.directory, data.directory);
            }
            if (data.url) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.serviceUrl, data.url);
            }
            if (data.apiLanguage) {
                const inputSdkLanguage = await dialog.findElement(locator.mrsSdkDialog.sdkLanguage);
                await inputSdkLanguage.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsSdkDialog.sdkLanguageList));
                await popup.findElement(By.id(data.apiLanguage)).click();
                await driver.actions().sendKeys(Key.ESCAPE).perform();
            }
            if (data.appBaseClass) {
                const inputAppBaseClass = await dialog.findElement(locator.mrsSdkDialog.appBaseClass);
                await inputAppBaseClass.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsSdkDialog.appBaseClassList));
                await popup.findElement(By.id(data.appBaseClass)).click();
                await driver.actions().sendKeys(Key.ESCAPE).perform();
            }
            if (data.sdkFileHeader) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.sdkFileHeader, data.sdkFileHeader);
            }
        }

        await dialog.findElement(locator.mrsSdkDialog.ok).click();
    };
}
