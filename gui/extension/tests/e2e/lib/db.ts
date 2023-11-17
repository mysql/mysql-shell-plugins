/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
import {
    WebElement,
    By,
    until,
    Key,
    error,
    Condition,
} from "vscode-extension-tester";
import { basename } from "path";
import { driver, Misc } from "./misc";
import * as waitUntil from "./until";
import * as constants from "./constants";
import * as interfaces from "./interfaces";
import * as locator from "./locators";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";

export class Database {

    public static setConnection = async (
        dbType: string | undefined,
        caption: string | undefined,
        description: string | undefined,
        basic: interfaces.IConnBasicMySQL | interfaces.IConnBasicSqlite | undefined,
        ssl?: interfaces.IConnSSL,
        advanced?: interfaces.IConnAdvanced,
        mds?: interfaces.IConnMDS,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait25seconds, "Connection dialog was not displayed");

        if (dbType) {
            const inDBType = await dialog.findElement(locator.dbConnectionDialog.databaseType);
            await inDBType.click();
            const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                constants.wait5seconds, "Database type popup was not found");
            await popup.findElement(By.id(dbType)).click();
        }

        if (caption) {
            const inCaption = await dialog.findElement(locator.dbConnectionDialog.caption);
            await inCaption.clear();
            await inCaption.sendKeys(caption);
        }

        if (description) {
            const inDesc = await dialog.findElement(locator.dbConnectionDialog.description);
            await inDesc.clear();
            await inDesc.sendKeys(description);
        }

        if (dbType === "MySQL") {

            if (basic) {
                await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                if ((basic as interfaces.IConnBasicMySQL).hostname) {
                    const inHostname = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
                    await inHostname.clear();
                    await inHostname.sendKeys((basic as interfaces.IConnBasicMySQL).hostname);
                }
                if ((basic as interfaces.IConnBasicMySQL).username) {
                    const inUserName = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
                    await inUserName.clear();
                    await inUserName.sendKeys((basic as interfaces.IConnBasicMySQL).username);
                }
                if ((basic as interfaces.IConnBasicMySQL).schema) {
                    const inSchema = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.defaultSchema);
                    await inSchema.clear();
                    await inSchema.sendKeys((basic as interfaces.IConnBasicMySQL).schema);
                }
                if ((basic as interfaces.IConnBasicMySQL).port) {
                    const inPort = await dialog.findElement(locator.dbConnectionDialog.mysql.basic.port);
                    await inPort.clear();
                    await inPort.sendKeys((basic as interfaces.IConnBasicMySQL).port);
                }
                if ((basic as interfaces.IConnBasicMySQL).ociBastion !== undefined) {
                    await Database.toggleCheckBox("useMDS", (basic as interfaces.IConnBasicMySQL).ociBastion);
                }
            }

            if (ssl) {
                await dialog.findElement(locator.dbConnectionDialog.sslTab).click();
                if (ssl.mode) {
                    const inMode = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.mode);
                    await inMode.click();
                    const popup = await driver.findElement(locator.dbConnectionDialog.mysql.ssl.modeList);
                    await popup.findElement(By.id(ssl.mode)).click();
                }
                if (ssl.caPath) {
                    const inCaPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.ca);
                    await inCaPath.clear();
                    await inCaPath.sendKeys(ssl.caPath);
                }
                if (ssl.clientCertPath) {
                    const inClientCertPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.cert);
                    await inClientCertPath.clear();
                    await inClientCertPath.sendKeys(ssl.clientCertPath);
                }
                if (ssl.clientKeyPath) {
                    const inClientKeyPath = await dialog.findElement(locator.dbConnectionDialog.mysql.ssl.key);
                    await inClientKeyPath.clear();
                    await inClientKeyPath.sendKeys(ssl.clientKeyPath);
                }
            }

            if (mds) {
                await dialog.findElement(locator.dbConnectionDialog.mdsTab).click();
                if (mds.profile) {
                    const inProfile = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.profileName);
                    await inProfile.click();
                    await driver.wait(until
                        .elementLocated(locator.dbConnectionDialog.mysql.mds.profileNameList), constants.wait5seconds);
                    await driver.wait(until.elementLocated(By.id(mds.profile)), constants.wait5seconds).click();
                }
                if (mds.dbSystemOCID) {
                    const inDBSystem = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbDystemId);
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.dbSystemOCID);

                    await dialog.click();
                    const dbSystemName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.dbDystemName);
                    await driver.wait(new Condition("", async () => {
                        return !(await dbSystemName.getAttribute("value")).includes("Loading");
                    }), constants.wait10seconds, "DB System name is still loading");
                }
                if (mds.bastionOCID) {
                    const inDBSystem = await dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionId);
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.bastionOCID);

                    await dialog.click();
                    const bastionName = dialog.findElement(locator.dbConnectionDialog.mysql.mds.bastionName);
                    await driver.wait(new Condition("", async () => {
                        return !(await bastionName.getAttribute("value")).includes("Loading");
                    }), constants.wait10seconds, "Bastion name is still loading");
                }
            }

        } else if (dbType === "Sqlite") {

            if (basic) {
                await dialog.findElement(locator.dbConnectionDialog.basicTab).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inPath = await dialog.findElement(locator.dbConnectionDialog.sqlite.basic.dbFilePath);
                    await inPath.clear();
                    await inPath.sendKeys((basic as interfaces.IConnBasicSqlite).dbPath);
                }
                if ((basic as interfaces.IConnBasicSqlite).dbName) {
                    const indbName = await dialog.findElement(locator.dbConnectionDialog.sqlite.basic.dbName);
                    await indbName.clear();
                    await indbName.sendKeys((basic as interfaces.IConnBasicSqlite).dbName);
                }
            }

            if (advanced) {
                await dialog.findElement(locator.dbConnectionDialog.advancedTab).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inParams = await dialog.findElement(locator.dbConnectionDialog.sqlite.advanced.otherParams);
                    await inParams.clear();
                    await inParams.sendKeys((basic as interfaces.IConnBasicSqlite).advanced.params);
                }
            }
        } else {
            throw new Error("Unknown DB Type");
        }

        await dialog.findElement(locator.dbConnectionDialog.ok).click();
    };

    public static getPromptLastTextLine = async (): Promise<String> => {
        const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
        let sentence = "";
        await driver.wait(async () => {
            try {
                const codeLineWords = await context.findElements(locator.notebook.codeEditor.editor.wordInSentence);
                if (codeLineWords.length > 0) {
                    for (const word of codeLineWords) {
                        sentence += (await word.getText()).replace("&nbsp;", " ");
                    }

                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Elements were stale");

        return sentence;
    };

    public static createConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {

        await Misc.switchBackToTopFrame();
        await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
            constants.createDBConnection);
        await driver.wait(waitUntil.tabIsOpened(constants.dbDefaultEditor), constants.wait5seconds);
        await Misc.switchToFrame();
        await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists), constants.wait10seconds);

        await Database.setConnection(
            dbConfig.dbType,
            dbConfig.caption,
            dbConfig.description,
            dbConfig.basic,
            dbConfig.ssl,
            undefined,
            dbConfig.mds,
        );

        await Misc.switchBackToTopFrame();
    };

    public static getWebViewConnection = async (name: string, useFrame = true): Promise<WebElement> => {

        if (useFrame) {
            await Misc.switchToFrame();
        }

        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);
            for (const host of hosts) {
                try {
                    const el = await (await host
                        .findElement(locator.dbConnectionOverview.dbConnection.caption)).getText();
                    if (el === name) {
                        return host;
                    }
                } catch (e) {
                    return undefined;
                }
            }

            return undefined;
        }, constants.wait5seconds, "No DB was found");

        if (useFrame) {
            await Misc.switchBackToTopFrame();
        }

        return db;
    };

    public static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated((locator.passwordDialog.exists)),
            constants.wait5seconds, "No password dialog was found");
        await dialog.findElement(locator.passwordDialog.password)
            .sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password);
        await dialog.findElement(locator.passwordDialog.ok).click();
    };

    public static existsToolbarButton = async (button: string): Promise<boolean> => {
        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return true;
            }
        }

        return false;
    };

    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    public static setNewLineOnEditor = async (): Promise<void> => {
        const getLastLineNumber = async (): Promise<number> => {
            const lineNumbers = await driver.findElements(locator.notebook.codeEditor.editor.lineNumber);
            if (lineNumbers.length === 0) {
                return 0;
            } else {
                return parseInt((await lineNumbers[lineNumbers.length - 1].getText()), 10);
            }
        };

        await driver.wait(async () => {
            try {
                const lastLineNumber = await getLastLineNumber();
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await textArea.sendKeys(Key.RETURN);

                return (await getLastLineNumber()) > lastLineNumber;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not set a new line on the editor");
    };

    public static getMouseCursorLine = async (): Promise<number> => {
        const lines = await driver.findElements(locator.notebook.codeEditor.editor.lines);
        for (let i = 0; i <= lines.length - 1; i++) {
            const curLine = await lines[i].findElements(locator.notebook.codeEditor.editor.currentLine);
            if (curLine.length > 0) {
                return i;
            }
        }
    };

    public static getLineFromWord = async (wordRef: string): Promise<number> => {
        const regex = wordRef
            .replace(/\*/g, "\\*")
            .replace(/\./g, ".*")
            .replace(/;/g, ".*")
            .replace(/\s/g, ".*");
        const lines = await driver.findElements(locator.notebook.codeEditor.editor.promptLine);
        for (let i = 0; i <= lines.length - 1; i++) {
            const lineContent = await lines[i].getAttribute("innerHTML");
            if (lineContent.match(regex)) {
                return i;
            }
        }
        throw new Error(`Could not find '${wordRef}'`);
    };

    public static isStatementStart = async (statement: string): Promise<boolean | undefined> => {

        const getLineSentence = async (ctx: WebElement): Promise<string> => {
            const spans = await ctx.findElements(locator.htmlTag.span);
            let sentence = "";
            for (const span of spans) {
                sentence += (await span.getText()).replace("&nbsp;", " ");
            }

            return sentence;
        };

        let flag: boolean | undefined;

        await driver.wait(async () => {
            try {
                const prompts = await driver.findElements(locator.notebook.codeEditor.prompt.exists);
                const sentences = await driver.findElements(locator.notebook.codeEditor.editor.sentence);
                let index = -1;

                for (let i = 0; i <= sentences.length - 1; i++) {
                    const lineSentence = await getLineSentence(sentences[i]);
                    if (lineSentence.includes(statement)) {
                        index = i;
                        break;
                    }
                }

                if (index === -1) {
                    throw new Error(`Could not find statement ${statement}`);
                }

                flag = (await prompts[index]
                    .findElements(locator.notebook.codeEditor.editor.statementStart)).length > 0;

                return true;
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Lines were stale");

        return flag;
    };

    public static findInSelection = async (flag: boolean): Promise<void> => {
        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const actions = await findWidget.findElements(locator.findWidget.actions);
        for (const action of actions) {
            if ((await action.getAttribute("title")).includes("Find in selection")) {
                const checked = await action.getAttribute("aria-checked");
                if (checked === "true") {
                    if (!flag) {
                        await action.click();
                    }
                } else {
                    if (flag) {
                        await action.click();
                    }
                }

                return;
            }
        }
    };

    public static toggleFinderReplace = async (expand: boolean): Promise<void> => {
        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const toggleReplace = await findWidget.findElement(locator.findWidget.toggleReplace);
        const isExpanded = (await findWidget.findElements(locator.findWidget.toggleReplaceExpanded)).length > 0;
        if (expand) {
            if (!isExpanded) {
                await toggleReplace.click();
            }
        } else {
            if (isExpanded) {
                await toggleReplace.click();
            }
        }
    };

    public static replacerGetButton = async (button: string): Promise<WebElement | undefined> => {
        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const replaceActions = await findWidget.findElements(locator.findWidget.replaceActions);
        for (const action of replaceActions) {
            if ((await action.getAttribute("title")).indexOf(button) !== -1) {
                return action;
            }
        }
    };

    public static closeFinder = async (): Promise<void> => {
        await driver.wait(async () => {
            const findWidget = await driver.findElements(locator.findWidget.exists);
            if (findWidget.length > 0) {
                const closeButton = await findWidget[0].findElement(locator.findWidget.close);
                await driver.executeScript("arguments[0].click()", closeButton);

                return (await driver.findElements(locator.findWidget.exists)).length === 0;
            } else {
                return true;
            }
        }, constants.wait5seconds, "Widget was not closed");
    };

    public static clickContextItem = async (item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, constants.wait5seconds, "Context menu was not displayed");

        await driver.wait(async () => {
            try {
                const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);
                await el.click();

                return !(await isCtxMenuDisplayed());
            } catch (e) {
                if (e instanceof TypeError) {
                    return true;
                }
            }
        }, constants.wait5seconds, "Context menu is still displayed");
    };

    public static getPrompts = async (): Promise<number> => {
        return (await driver.findElements(locator.notebook.codeEditor.prompt.exists)).length;
    };

    public static setRestService = async (restService: interfaces.IRestService): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(locator.mrsServiceDialog.exists),
            constants.wait5seconds, "MRS Service dialog was not displayed");

        // Main settings
        const inputServPath = await dialog.findElement(locator.mrsServiceDialog.servicePath);
        await inputServPath.clear();
        await inputServPath.sendKeys(restService.servicePath);

        await Database.toggleCheckBox("makeDefault", restService.default);
        await Database.toggleCheckBox("enabled", restService.enabled);

        // Settings
        if (restService.settings) {
            if (restService.settings.comments) {
                const inputComments = await dialog.findElement(locator.mrsServiceDialog.settings.comments);
                await inputComments.clear();
                await inputComments.sendKeys(restService.settings.comments);
            }
            if (restService.settings.hostNameFilter) {
                const inputHost = await dialog.findElement(locator.mrsServiceDialog.settings.hostNameFilter);
                await inputHost.clear();
                await inputHost.sendKeys(restService.settings.hostNameFilter);
            }
        }

        // Options
        if (restService.options) {
            await dialog.findElement(locator.mrsServiceDialog.optionsTab).click();
            const options = await dialog.findElement(locator.mrsServiceDialog.options.options);
            await options.clear();
            await options.sendKeys(restService.options);
        }
        if (restService.authentication) {
            await dialog.findElement(locator.mrsServiceDialog.authenticationTab).click();
            if (restService.authentication.authenticationPath) {
                const inputAuthPath = await dialog.findElement(locator.mrsServiceDialog.authentication.authPath);
                await inputAuthPath.clear();
                await inputAuthPath.sendKeys(restService.authentication.authenticationPath);
            }
            if (restService.authentication.redirectionUrl) {
                const authCompletedUrlInput = await dialog
                    .findElement(locator.mrsServiceDialog.authentication.authCompletedUrl);
                await authCompletedUrlInput.clear();
                await authCompletedUrlInput.sendKeys(restService.authentication.redirectionUrl);
            }
            if (restService.authentication.redirectionUrlValid) {
                const authCompletedUrlValidationInput = await dialog
                    .findElement(locator.mrsServiceDialog.authentication.authCompletedUrlValidation);
                await authCompletedUrlValidationInput.clear();
                await authCompletedUrlValidationInput.sendKeys(restService.authentication.redirectionUrlValid);
            }
            if (restService.authentication.authCompletedChangeCont) {
                const authCompletedPageContentInput = await dialog
                    .findElement(locator.mrsServiceDialog.authentication.authCompletedPageContent);
                await authCompletedPageContentInput.clear();
                await authCompletedPageContentInput.sendKeys(restService.authentication.authCompletedChangeCont);
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
                const input = await dialog.findElement(locator.mrsServiceDialog.authenticationApps.authAppsName);
                await input.clear();
                await input.sendKeys(restService.authenticationApps.name);
            }
            if (restService.authenticationApps.description) {
                const descriptionInput = await dialog
                    .findElement(locator.mrsServiceDialog.authenticationApps.authAppsDescription);
                await descriptionInput.clear();
                await descriptionInput.sendKeys(restService.authenticationApps.description);
            }
            if (restService.authenticationApps.enabled !== undefined) {
                await Database.toggleCheckBox("authApps.enabled", restService.authenticationApps.enabled);
            }
            if (restService.authenticationApps.limitToRegisteredUsers !== undefined) {
                await Database.toggleCheckBox("authApps.limitToRegisteredUsers",
                    restService.authenticationApps.limitToRegisteredUsers);

            }
            if (restService.authenticationApps.appId) {
                const appIdInput = await dialog.findElement(locator.mrsServiceDialog.authenticationApps.authAppsId);
                await appIdInput.clear();
                await appIdInput.sendKeys(restService.authenticationApps.appId);
            }
            if (restService.authenticationApps.accessToken) {
                const accessTokenInput = await dialog
                    .findElement(locator.mrsServiceDialog.authenticationApps.authAppsAccessToken);
                await accessTokenInput.clear();
                await accessTokenInput.sendKeys(restService.authenticationApps.accessToken);
            }
            if (restService.authenticationApps.customUrl) {
                const urlInput = await dialog.findElement(locator.mrsServiceDialog.authenticationApps.authAppsUrl);
                await urlInput.clear();
                await urlInput.sendKeys(restService.authenticationApps.customUrl);
            }
            if (restService.authenticationApps.customUrlForAccessToken) {
                const urlDirectAuthInput = await dialog
                    .findElement(locator.mrsServiceDialog.authenticationApps.authAppsurlDirectAuth);
                await urlDirectAuthInput.clear();
                await urlDirectAuthInput.sendKeys(restService.authenticationApps.customUrlForAccessToken);
            }
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");
    };

    public static getRestService = async (): Promise<interfaces.IRestService> => {
        const dialog = await driver.wait(until.elementLocated(locator.mrsServiceDialog.exists),
            constants.wait5seconds, "MRS Service dialog was not displayed");

        // Main settings
        const restService: interfaces.IRestService = {
            servicePath: await dialog.findElement(locator.mrsServiceDialog.servicePath).getAttribute("value"),
        };

        restService.default = await Database.getCheckBoxValue("makeDefault");
        restService.enabled = await Database.getCheckBoxValue("enabled");

        // Settings
        const restServiceSettings: interfaces.IRestServiceSettings = {};
        restServiceSettings.comments = await dialog.findElement(locator.mrsServiceDialog.settings.comments)
            .getAttribute("value");
        restServiceSettings.hostNameFilter = await dialog.findElement(locator.mrsServiceDialog.settings.hostNameFilter)
            .getAttribute("value");
        restService.settings = restServiceSettings;

        // Options
        await dialog.findElement(locator.mrsServiceDialog.optionsTab).click();
        restService.options = (await dialog.findElement(locator.mrsServiceDialog.options.options)
            .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim();

        // Authentication
        await dialog.findElement(locator.mrsServiceDialog.authenticationTab).click();
        const authentication: interfaces.IRestServiceAuthentication = {};
        authentication.authenticationPath = await dialog.findElement(locator.mrsServiceDialog.authentication.authPath)
            .getAttribute("value");
        authentication.redirectionUrl = await dialog
            .findElement(locator.mrsServiceDialog.authentication.authCompletedUrl)
            .getAttribute("value");
        authentication.redirectionUrlValid = await dialog
            .findElement(locator.mrsServiceDialog.authentication.authCompletedUrlValidation)
            .getAttribute("value");
        authentication.authCompletedChangeCont = await dialog
            .findElement(locator.mrsServiceDialog.authentication.authCompletedPageContent)
            .getAttribute("value");
        restService.authentication = authentication;

        // Authentication apps
        await dialog.findElement(locator.mrsServiceDialog.autenticationAppsTab).click();
        const authenticationApps: interfaces.IRestServiceAuthApps = {
            vendor: await dialog.findElement(locator.mrsServiceDialog.authenticationApps.vendorName)
                .findElement(locator.htmlTag.label).getText(),
            name: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsName).getAttribute("value"),
            description: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsDescription).getAttribute("value"),
            enabled: await Database.getCheckBoxValue("authApps.enabled"),
            limitToRegisteredUsers: await Database.getCheckBoxValue("authApps.limitToRegisteredUsers"),
            appId: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsId).getAttribute("value"),
            accessToken: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsAccessToken).getAttribute("value"),
            customUrl: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsUrl).getAttribute("value"),
            customUrlForAccessToken: await dialog
                .findElement(locator.mrsServiceDialog.authenticationApps.authAppsurlDirectAuth)
                .getAttribute("value"),
        };

        restService.authenticationApps = authenticationApps;

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsServiceDialog.cancel).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restService;
    };

    public static setRestSchema = async (restSchema: interfaces.IRestSchema): Promise<void> => {

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
            const inputSchemaName = await dialog.findElement(locator.mrsSchemaDialog.requestPath);
            await inputSchemaName.clear();
            await inputSchemaName.sendKeys(restSchema.restSchemaPath);
        }

        if (restSchema.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", restSchema.enabled);
        }

        if (restSchema.requiresAuth !== undefined) {
            await Database.toggleCheckBox("requiresAuth", restSchema.requiresAuth);
        }

        // Settings
        if (restSchema.settings) {
            if (restSchema.settings.schemaName) {
                const inputSchemaName = await dialog.findElement(locator.mrsSchemaDialog.settings.dbSchemaName);
                await inputSchemaName.clear();
                await inputSchemaName.sendKeys(restSchema.settings.schemaName);
            }
            if (restSchema.settings.itemsPerPage) {
                const inputItemsPerPage = await dialog.findElement(locator.mrsSchemaDialog.settings.itemsPerPage);
                await inputItemsPerPage.clear();
                await inputItemsPerPage.sendKeys(restSchema.settings.itemsPerPage);
            }
            if (restSchema.settings.comments) {
                const inputComents = await dialog.findElement(locator.mrsSchemaDialog.settings.comments);
                await inputComents.clear();
                await inputComents.sendKeys(restSchema.settings.comments);
            }
        }

        // Options
        await dialog.findElement(locator.mrsSchemaDialog.optionsTab).click();
        if (restSchema.options) {
            const inputOptions = await dialog.findElement(locator.mrsSchemaDialog.options.options);
            await inputOptions.clear();
            await inputOptions.sendKeys(restSchema.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsSchemaDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The REST Schema Dialog was not closed");

    };

    public static getRestSchema = async (): Promise<interfaces.IRestSchema> => {
        const dialog = await driver.wait(until.elementLocated(locator.mrsSchemaDialog.exists),
            constants.wait5seconds, "MRS Schema dialog was not displayed");

        // Main settings
        const restShema: interfaces.IRestSchema = {
            restServicePath: await dialog.findElement(locator.mrsSchemaDialog.serviceLabel).getText(),
            restSchemaPath: await dialog.findElement(locator.mrsSchemaDialog.requestPath).getAttribute("value"),
        };

        restShema.enabled = await Database.getCheckBoxValue("enabled");
        restShema.requiresAuth = await Database.getCheckBoxValue("requiresAuth");

        // Settings
        const restSchemaSettings: interfaces.IRestSchemaSettings = {};
        restSchemaSettings.schemaName = await dialog.findElement(locator.mrsSchemaDialog.settings.dbSchemaName)
            .getAttribute("value");
        restSchemaSettings.itemsPerPage = await dialog.findElement(locator.mrsSchemaDialog.settings.itemsPerPage)
            .getAttribute("value");
        restSchemaSettings.comments = await dialog
            .findElement(locator.mrsSchemaDialog.settings.comments).getAttribute("value");
        restShema.settings = restSchemaSettings;

        // Options
        await dialog.findElement(locator.mrsSchemaDialog.optionsTab).click();
        restShema.options = (await dialog.findElement(locator.mrsSchemaDialog.options.options).getAttribute("value"))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsSchemaDialog.cancel).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Service dialog was not closed");

        return restShema;
    };

    public static getCurrentEditorType = async (): Promise<string> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        const img = await selector.findElements(locator.htmlTag.img);
        if (img.length > 0) {
            const imgSrc = await img[0].getAttribute("src");
            const srcPath = basename(imgSrc);

            return srcPath.split(".")[0];
        } else {
            const span = await selector.findElement(locator.notebook.toolbar.editorSelector.itemIcon);

            return span.getAttribute("style");
        }
    };

    public static setRestAuthenticationApp = async (authApp: interfaces.IRestAuthenticationApp): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait10seconds, "Authentication app dialog was not displayed");

        if (authApp.vendor) {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.authVendorName).click();
            const popup = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.authVendorNameList),
                constants.wait5seconds, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.vendor)).click();
        }

        if (authApp.name) {
            const nameInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppName);
            await nameInput.clear();
            await nameInput.sendKeys(authApp.name);
        }
        if (authApp.description) {
            const descriptionInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.description);
            await descriptionInput.clear();
            await descriptionInput.sendKeys(authApp.description);
        }
        if (authApp.accessToken) {
            const accessTokenInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.accessToken);
            await accessTokenInput.clear();
            await accessTokenInput.sendKeys(authApp.accessToken);
        }
        if (authApp.appId) {
            const appIdInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppId);
            await appIdInput.clear();
            await appIdInput.sendKeys(authApp.appId);
        }
        if (authApp.customURL) {
            const urlInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppUrl);
            await urlInput.clear();
            await urlInput.sendKeys(authApp.customURL);
        }
        if (authApp.customURLforAccessToken) {
            const urlDirectAuthInput = await dialog.findElement(locator.mrsAuthenticationAppDialog.urlDirectAuth);
            await urlDirectAuthInput.clear();
            await urlDirectAuthInput.sendKeys(authApp.customURLforAccessToken);
        }

        if (authApp.defaultRole) {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.defaultRoleName).click();
            const popup = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.defaultRoleList),
                constants.wait5seconds, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.defaultRole)).click();
        }

        if (authApp.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", authApp.enabled);
            await dialog.click();
        }

        if (authApp.limitToRegisteredUsers !== undefined) {
            await Database.toggleCheckBox("limitToRegisteredUsers", authApp.limitToRegisteredUsers);
            await dialog.click();
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

    };

    public static getAuthenticationApp = async (): Promise<interfaces.IRestAuthenticationApp> => {
        const dialog = await driver.wait(until.elementLocated(locator.mrsAuthenticationAppDialog.exists),
            constants.wait10seconds, "Authentication app dialog was not displayed");

        const authenticationApp: interfaces.IRestAuthenticationApp = {
            vendor: await dialog.findElement(locator.mrsAuthenticationAppDialog.authVendorNameLabel).getText(),
            name: await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppName).getAttribute("value"),
            description: await dialog.findElement(locator.mrsAuthenticationAppDialog.description).getAttribute("value"),
            accessToken: await dialog.findElement(locator.mrsAuthenticationAppDialog.accessToken).getAttribute("value"),
            appId: await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppId).getAttribute("value"),
            customURL: await dialog.findElement(locator.mrsAuthenticationAppDialog.authAppUrl).getAttribute("value"),
            customURLforAccessToken: await dialog.findElement(locator.mrsAuthenticationAppDialog.urlDirectAuth)
                .getAttribute("value"),
            defaultRole: await dialog.findElement(locator.mrsAuthenticationAppDialog.defaultRoleNameLabel).getText(),
        };

        authenticationApp.enabled = await Database.getCheckBoxValue("enabled");
        authenticationApp.limitToRegisteredUsers = await Database.getCheckBoxValue("limitToRegisteredUsers");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsAuthenticationAppDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The Authentication App Dialog was not closed");

        return authenticationApp;
    };

    public static setRestUser = async (restUser: interfaces.IRestUser): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait10seconds, "User dialog was not displayed");

        const nameInput = await dialog.findElement(locator.mrsUserDialog.username);
        const passwordInput = await dialog.findElement(locator.mrsUserDialog.password);

        await nameInput.clear();
        await nameInput.sendKeys(restUser.username);

        await passwordInput.clear();
        await passwordInput.sendKeys(restUser.password);

        if (restUser.authenticationApp) {
            await dialog.findElement(locator.mrsUserDialog.authApp).click();
            await driver.wait(until.elementLocated(locator.mrsUserDialog.authAppList),
                constants.wait5seconds, "Auth app drop down list was not displayed");

            await driver.wait(until.elementLocated(By.id(restUser.authenticationApp)), constants.wait5seconds).click();
        }

        if (restUser.email) {
            const emailInput = await dialog.findElement(locator.mrsUserDialog.email);
            await emailInput.clear();
            await emailInput.sendKeys(restUser.email);
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
            await Database.toggleCheckBox("loginPermitted", restUser.permitLogin);
        }

        if (restUser.userOptions) {
            const appOptionsInput = await dialog.findElement(locator.mrsUserDialog.appOptions);
            await appOptionsInput.clear();
            await appOptionsInput.sendKeys(restUser.userOptions);
        }

        if (restUser.vendorUserId) {
            const vendorUserIdInput = await dialog.findElement(locator.mrsUserDialog.vendorUserId);
            await vendorUserIdInput.clear();
            await vendorUserIdInput.sendKeys(restUser.vendorUserId);
        }

        if (restUser.mappedUserId) {
            const mappedUserIdInput = await dialog.findElement(locator.mrsUserDialog.mappedUserId);
            await mappedUserIdInput.clear();
            await mappedUserIdInput.sendKeys(restUser.mappedUserId);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsUserDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");

    };

    public static getRestUser = async (): Promise<interfaces.IRestUser> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsUserDialog.exists),
            constants.wait10seconds, "User dialog was not displayed");

        const restUser: interfaces.IRestUser = {
            username: await dialog.findElement(locator.mrsUserDialog.username).getAttribute("value"),
            password: await dialog.findElement(locator.mrsUserDialog.password).getAttribute("value"),
            authenticationApp: await dialog.findElement(locator.mrsUserDialog.authAppLabel).getText(),
            email: await dialog.findElement(locator.mrsUserDialog.email).getAttribute("value"),
            assignedRoles: await dialog.findElement(locator.mrsUserDialog.rolesLabel).getText(),
            userOptions: (await dialog.findElement(locator.mrsUserDialog.appOptions)
                .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim(),
            vendorUserId: await dialog.findElement(locator.mrsUserDialog.vendorUserId).getAttribute("value"),
            mappedUserId: await dialog.findElement(locator.mrsUserDialog.mappedUserId).getAttribute("value"),
        };

        restUser.permitLogin = await Database.getCheckBoxValue("loginPermitted");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsUserDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS User dialog was not closed");

        return restUser;

    };

    public static setRestObject = async (restObject: interfaces.IRestObject): Promise<void> => {

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
            const inObjPath = await dialog.findElement(locator.mrsDbObjectDialog.requestPath);
            await inObjPath.clear();
            await inObjPath.sendKeys(restObject.restObjectPath);
        }
        if (restObject.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", restObject.enabled);
        }
        if (restObject.requiresAuth !== undefined) {
            await Database.toggleCheckBox("requiresAuth", restObject.requiresAuth);
        }
        if (restObject.jsonRelDuality) {
            if (restObject.jsonRelDuality.dbObject) {
                const inDbObj = await dialog.findElement(locator.mrsDbObjectDialog.jsonDuality.dbObject);
                await inDbObj.clear();
                await inDbObj.sendKeys(restObject.jsonRelDuality.dbObject);
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
                const inItemsPerPage = await dialog.findElement(locator.mrsDbObjectDialog.settings.itemsPerPage);
                await inItemsPerPage.clear();
                await inItemsPerPage.sendKeys(restObject.settings.itemsPerPage);
            }
            if (restObject.settings.comments) {
                const inComments = await dialog.findElement(locator.mrsDbObjectDialog.settings.comments);
                await inComments.clear();
                await inComments.sendKeys(restObject.settings.comments);
            }
            if (restObject.settings.mediaType) {
                const inMediaType = await dialog.findElement(locator.mrsDbObjectDialog.settings.mediaType);
                await inMediaType.clear();
                await inMediaType.sendKeys(restObject.settings.mediaType);
            }
            if (restObject.settings.autoDetectMediaType !== undefined) {
                await Database.toggleCheckBox("autoDetectMediaType", restObject.settings.autoDetectMediaType);
            }
        }
        if (restObject.authorization) {
            await driver.wait(async () => {
                await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab).click();

                return (await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab)
                    .getAttribute("class")).includes("selected");
            }, constants.wait5seconds, "Authorization tab was not selected");
            if (restObject.authorization.enforceRowUserOwner !== undefined) {
                await Database.toggleCheckBox("rowUserOwnershipEnforced", restObject.authorization.enforceRowUserOwner);
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
            const inputOptions = await dialog.findElement(locator.mrsDbObjectDialog.options.options);
            await inputOptions.clear();
            await inputOptions.sendKeys(restObject.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.ok).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.wait10seconds, "The MRS Object dialog was not closed");
    };

    public static getRestObject = async (): Promise<interfaces.IRestObject> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsDbObjectDialog.exists),
            constants.wait10seconds, "Edit REST Object dialog was not displayed");

        const restObject: interfaces.IRestObject = {
            restServicePath: await dialog.findElement(locator.mrsDbObjectDialog.serviceLabel).getText(),
            restSchemaPath: await dialog.findElement(locator.mrsDbObjectDialog.schemaLabel).getText(),
            restObjectPath: await dialog.findElement(locator.mrsDbObjectDialog.requestPath).getAttribute("value"),
            jsonRelDuality: {
                dbObject: await dialog
                    .findElement(locator.mrsDbObjectDialog.jsonDuality.dbObject).getAttribute("value"),
                sdkLanguage: await dialog.findElement(locator.mrsDbObjectDialog.jsonDuality.sdkLanguageLabel).getText(),
            },
        };

        restObject.enabled = await Database.getCheckBoxValue("enabled");
        restObject.requiresAuth = await Database.getCheckBoxValue("requiresAuth");

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
            comments: await dialog.findElement(locator.mrsDbObjectDialog.settings.comments).getAttribute("value"),
            mediaType: await dialog.findElement(locator.mrsDbObjectDialog.settings.mediaType).getAttribute("value"),
        };

        restObject.settings.autoDetectMediaType = await Database.getCheckBoxValue("autoDetectMediaType");

        await driver.wait(async () => {
            await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab).click();

            return (await dialog.findElement(locator.mrsDbObjectDialog.authorizationTab)
                .getAttribute("class")).includes("selected");
        }, constants.wait5seconds, "Authorization tab was not selected");
        restObject.authorization = {};

        restObject.authorization.enforceRowUserOwner = await Database.getCheckBoxValue("rowUserOwnershipEnforced");

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

    public static getCurrentEditor = async (): Promise<string> => {
        const getData = async (): Promise<string> => {
            const selector = await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
                constants.wait5seconds, "Document selector was not found");
            const label = await selector.findElement(locator.htmlTag.label);

            return label.getText();
        };

        let result: string;
        try {
            result = await getData();
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                result = await getData();
            } else {
                throw e;
            }
        }

        return result;
    };

    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.editor.autoCompleteListItem),
            constants.wait5seconds, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.ARROW_UP);

        items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.editor.autoCompleteListItem),
            constants.wait5seconds, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)] as string[];
    };

    public static isEditorStretched = async (): Promise<boolean> => {
        const editor = await driver.findElement(locator.notebook.codeEditor.editor.host);
        const style = await editor.getCssValue("height");
        const height = parseInt(style.trim().replace("px", ""), 10);

        return height > 0;
    };

    public static clearInputField = async (el: WebElement): Promise<void> => {
        await driver.wait(async () => {
            await el.click();
            if (Misc.isMacOs()) {
                await el.sendKeys(Key.chord(Key.COMMAND, "a"));
            } else {
                await el.sendKeys(Key.chord(Key.CONTROL, "a"));
            }
            await el.sendKeys(Key.BACK_SPACE);

            return (await el.getAttribute("value")).length === 0;
        }, constants.wait5seconds);

    };

    public static selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(locator.notebook.toolbar.editorSelector.item)).length >= 1;
        }, 2000, "No elements located on dropdown");

        const dropDownItems = await driver.findElements(locator.notebook.toolbar.editorSelector.item);
        for (const item of dropDownItems) {
            const name = await item.findElement(locator.htmlTag.label).getText();
            const el = await item.findElements(locator.htmlTag.img);

            let type = "";

            if (el.length > 0) {
                type = await el[0].getAttribute("src");
            } else {
                type = await item.findElement(locator.notebook.toolbar.editorSelector.itemIcon).getAttribute("style");
            }

            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
                        const selected = await selector.findElement(locator.htmlTag.label).getText();

                        return selected === editorName;
                    }, constants.wait5seconds, `${editorName} with type ${editorType} was not properly selected`);

                    await driver.wait(
                        async () => {
                            return (
                                (
                                    await driver.findElements(
                                        locator.notebook.toolbar.editorSelector.item,
                                    )
                                ).length === 0
                            );
                        },
                        2000,
                        "Dropdown list is still visible",
                    );

                    return;
                }
            }
        }
        throw new Error(`Coult not find ${editorName} with type ${editorType}`);
    };

    public static setDBConnectionCredentials = async (data: interfaces.IDBConnection,
        timeout?: number): Promise<void> => {
        await Database.setPassword(data);
        if (waitUntil.credentialHelperOk) {
            await Misc.setConfirmDialog("no", timeout);
        }
    };

    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {

        const commands = [];
        await driver.wait(async () => {
            try {
                const cmds = await driver.wait(
                    until.elementsLocated(locator.notebook.codeEditor.editor.sentence),
                    constants.wait5seconds, "No lines were found");
                for (const cmd of cmds) {
                    const spans = await cmd.findElements(locator.htmlTag.span);
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    commands.push(sentence);
                }

                return commands.length > 0;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");


        if (!commands.includes(sql)) {
            throw new Error(`Could not find the SQL statement ${sql} on the notebook`);
        }

        let foundResult = false;
        const results = await driver.findElements(locator.notebook.codeEditor.editor.result.status.exists);
        for (const result of results) {
            const text = await result.getText();
            if (text.includes(resultStatus)) {
                foundResult = true;
                break;
            }
        }

        if (!foundResult) {
            throw new Error(`Could not find the SQL result ${resultStatus} on the notebook`);
        }

    };

    public static setDataToHw = async (
        schemas?: string[],
        opMode?: string,
        output?: string,
        disableCols?: boolean,
        optimize?: boolean,
        enableMemory?: boolean,
        sqlMode?: string,
        exludeList?: string,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.hwDialog.exists),
            constants.wait5seconds, "MDS dialog was not found");
        if (schemas) {
            const schemaInput = await dialog.findElement(locator.hwDialog.schemas);
            await schemaInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.schemasList));
            for (const schema of schemas) {
                await popup.findElement(By.id(schema)).click();
            }
            await driver.actions().sendKeys(Key.ESCAPE).perform();
        }
        if (opMode) {
            const modeInput = await dialog.findElement(locator.hwDialog.mode);
            await modeInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.modeList));
            await popup.findElement(By.id(opMode)).click();
        }
        if (output) {
            const outputInput = await dialog.findElement(locator.hwDialog.output);
            await outputInput.click();
            const popup = await driver.wait(until.elementLocated(locator.hwDialog.outputList));
            await popup.findElement(By.id(output)).click();
        }
        if (disableCols) {
            const disableColsInput = await dialog.findElement(locator.hwDialog.disableUnsupportedColumns);
            await disableColsInput.click();
        }
        if (optimize) {
            const optimizeInput = await dialog.findElement(locator.hwDialog.optimizeLoadParallelism);
            await optimizeInput.click();
        }
        if (enableMemory) {
            const enableInput = await dialog.findElement(locator.hwDialog.enableMemoryCheck);
            await enableInput.click();
        }
        if (sqlMode) {
            const sqlModeInput = await dialog.findElement(locator.hwDialog.sqlMode);
            await sqlModeInput.sendKeys(sqlMode);
        }
        if (exludeList) {
            const exludeListInput = await dialog.findElement(locator.hwDialog.excludeList);
            await exludeListInput.sendKeys(exludeList);
        }

        await dialog.findElement(locator.hwDialog.ok).click();
    };

    private static toggleCheckBox = async (elId: string, checked: boolean): Promise<void> => {
        const isUnchecked = async () => {
            return (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ")
                .includes("unchecked");
        };

        if (checked && (await isUnchecked())) {
            await driver.findElement(By.id(elId)).findElement(locator.checkBox.checkMark).click();
        } else {
            if (!checked && !(await isUnchecked())) {
                await driver.findElement(By.id(elId)).findElement(locator.checkBox.checkMark).click();
            }
        }
    };

    private static getCheckBoxValue = async (elId: string): Promise<boolean> => {
        const classes = (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ");

        return !classes.includes("unchecked");
    };
}
