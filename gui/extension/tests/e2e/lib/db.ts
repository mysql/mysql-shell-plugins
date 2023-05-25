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
    EditorView,
    until,
    Key,
    error,
    Condition,
    InputBox,
} from "vscode-extension-tester";
import { expect } from "chai";
import { basename } from "path";

import { driver, Misc, dbTreeSection, explicitWait, ociExplicitWait, credentialHelperOk } from "./misc";

export interface IConnBasicMySQL {
    hostname?: string;
    protocol?: string;
    port?: number;
    portX?: number;
    username?: string;
    password?: string;
    schema?: string;
    sshTunnel?: boolean;
    ociBastion?: boolean;
}

export interface IConnBasicSqlite {
    dbPath?: string;
    dbName?: string;
    advanced?: IConnAdvancedSqlite;
}

export interface IConnAdvancedSqlite {
    params?: string;
}

export interface IConnSSL {
    mode?: string;
    ciphers?: string;
    caPath?: string;
    clientCertPath?: string;
    clientKeyPath?: string;
}

export interface IConnAdvanced {
    mode?: string;
    timeout?: number;
    compression?: string;
    compLevel?: string;
    compAlgorithms?: string;
    disableHW?: boolean;
}

export interface IConnMDS {
    profile?: string;
    sshPrivKey?: string;
    sshPubKey?: string;
    dbSystemOCID?: string;
    bastionOCID?: string;
}

export interface IDBConnection {
    dbType?: string;
    caption?: string;
    description?: string;
    basic?: IConnBasicMySQL | IConnBasicSqlite;
    ssl?: IConnSSL;
    advanced?: IConnAdvanced;
    mds?: IConnMDS;
}

export class Database {

    public static setConnection = async (
        dbType: string | undefined,
        caption: string | undefined,
        description: string | undefined,
        basic: IConnBasicMySQL | IConnBasicSqlite | undefined,
        ssl?: IConnSSL,
        advanced?: IConnAdvanced,
        mds?: IConnMDS,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.css(".visible.valueEditDialog")),
            explicitWait, "Connection dialog was not displayed");

        if (dbType) {
            const inDBType = await dialog.findElement(By.id("databaseType"));
            await inDBType.click();
            const popup = await driver.findElement(By.id("databaseTypePopup"));
            await popup.findElement(By.id(dbType)).click();
        }

        if (caption) {
            const inCaption = await dialog.findElement(By.id("caption"));
            await inCaption.clear();
            await inCaption.sendKeys(caption);
        }

        if (description) {
            const inDesc = await dialog.findElement(By.id("description"));
            await inDesc.clear();
            await inDesc.sendKeys(description);
        }

        if (dbType === "MySQL") {

            if (basic) {
                await dialog.findElement(By.id("page0")).click();
                if ((basic as IConnBasicMySQL).hostname) {
                    const inHostname = await dialog.findElement(By.id("hostName"));
                    await inHostname.clear();
                    await inHostname.sendKeys((basic as IConnBasicMySQL).hostname);
                }
                if ((basic as IConnBasicMySQL).username) {
                    const inUserName = await dialog.findElement(By.id("userName"));
                    await inUserName.clear();
                    await inUserName.sendKeys((basic as IConnBasicMySQL).username);
                }
                if ((basic as IConnBasicMySQL).schema) {
                    const inSchema = await dialog.findElement(By.id("defaultSchema"));
                    await inSchema.clear();
                    await inSchema.sendKeys((basic as IConnBasicMySQL).schema);
                }
                if ((basic as IConnBasicMySQL).ociBastion !== undefined) {
                    const inBastion = await dialog.findElement(By.id("useMDS"));
                    const classes = await inBastion.getAttribute("class");
                    if (classes.includes("unchecked")) {
                        if ((basic as IConnBasicMySQL).ociBastion) {
                            await inBastion.click();
                        }
                    } else {
                        if (!(basic as IConnBasicMySQL).ociBastion) {
                            await inBastion.click();
                        }
                    }
                }
            }

            if (ssl) {
                await dialog.findElement(By.id("page1")).click();
                if (ssl.mode) {
                    const inMode = await dialog.findElement(By.id("sslMode"));
                    await inMode.click();
                    const popup = await driver.findElement(By.id("sslModePopup"));
                    await popup.findElement(By.id(ssl.mode)).click();
                }
                if (ssl.caPath) {
                    const inCaPath = await dialog.findElement(By.id("sslCaFile"));
                    await inCaPath.clear();
                    await inCaPath.sendKeys(ssl.caPath);
                }
                if (ssl.clientCertPath) {
                    const inClientCertPath = await dialog.findElement(By.id("sslCertFile"));
                    await inClientCertPath.clear();
                    await inClientCertPath.sendKeys(ssl.clientCertPath);
                }
                if (ssl.clientKeyPath) {
                    const inClientKeyPath = await dialog.findElement(By.id("sslKeyFile"));
                    await inClientKeyPath.clear();
                    await inClientKeyPath.sendKeys(ssl.clientKeyPath);
                }
            }

            if (mds) {
                await dialog.findElement(By.id("page3")).click();
                if (mds.profile) {
                    const inProfile = await dialog.findElement(By.id("profileName"));
                    await inProfile.click();
                    const popup = await driver.findElement(By.id("profileNamePopup"));
                    await popup.findElement(By.id(mds.profile)).click();
                }
                if (mds.dbSystemOCID) {
                    const inDBSystem = await dialog.findElement(By.id("mysqlDbSystemId"));
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.dbSystemOCID);

                    await dialog.click();
                    const dbSystemName = dialog.findElement(By.id("mysqlDbSystemName"));
                    await driver.wait(new Condition("", async () => {
                        return !(await dbSystemName.getAttribute("value")).includes("Loading");
                    }), ociExplicitWait, "DB System name is still loading");
                }
                if (mds.bastionOCID) {
                    const inDBSystem = await dialog.findElement(By.id("bastionId"));
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.bastionOCID);

                    await dialog.click();
                    const bastionName = dialog.findElement(By.id("bastionName"));
                    await driver.wait(new Condition("", async () => {
                        return !(await bastionName.getAttribute("value")).includes("Loading");
                    }), ociExplicitWait, "Bastion name is still loading");
                }
            }

        } else if (dbType === "Sqlite") {

            if (basic) {
                await dialog.findElement(By.id("page0")).click();
                if ((basic as IConnBasicSqlite).dbPath) {
                    const inPath = await dialog.findElement(By.id("dbFilePath"));
                    await inPath.clear();
                    await inPath.sendKeys((basic as IConnBasicSqlite).dbPath);
                }
                if ((basic as IConnBasicSqlite).dbName) {
                    const indbName = await dialog.findElement(By.id("dbName"));
                    await indbName.clear();
                    await indbName.sendKeys((basic as IConnBasicSqlite).dbName);
                }
            }

            if (advanced) {
                await dialog.findElement(By.id("page1")).click();
                if ((basic as IConnBasicSqlite).dbPath) {
                    const inParams = await dialog.findElement(By.id("otherParameters"));
                    await inParams.clear();
                    await inParams.sendKeys((basic as IConnBasicSqlite).advanced.params);
                }
            }
        } else {
            throw new Error("Unknown DB Type");
        }

        await dialog.findElement(By.id("ok")).click();
    };

    public static createConnection = async (dbConfig: IDBConnection): Promise<void> => {

        await driver.switchTo().defaultContent();
        await Misc.clickSectionToolbarButton(await Misc.getSection(dbTreeSection), "Create New DB Connection");
        await Misc.switchToWebView();
        await Database.setConnection(
            dbConfig.dbType,
            dbConfig.caption,
            dbConfig.description,
            dbConfig.basic,
            dbConfig.ssl,
            undefined,
            dbConfig.mds,
        );

        await driver.switchTo().defaultContent();
    };

    public static getWebViewConnection = async (name: string, useFrame = true): Promise<WebElement> => {

        if (useFrame) {
            await Misc.switchToWebView();
        }

        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(By.css("#tilesHost .connectionTile"));
            for (const host of hosts) {
                try {
                    const el = await host.findElement(By.css(".tileCaption"));
                    if ((await el.getText()) === name) {
                        return host;
                    }
                } catch (e) {
                    return undefined;
                }
            }

            return undefined;
        }, explicitWait, "No DB was found");

        if (useFrame) {
            await driver.switchTo().defaultContent();
        }

        return db;
    };

    public static setPassword = async (dbConfig: IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(
            By.css(".passwordDialog")), explicitWait, "No password dialog was found");
        const title = await dialog.findElement(By.css(".title .label"));
        const gridDivs = await dialog.findElements(By.css("div.grid > div"));

        let service;
        let username;
        for (let i = 0; i <= gridDivs.length - 1; i++) {
            if (await gridDivs[i].getText() === "Service:") {
                service = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
            }
            if (await gridDivs[i].getText() === "User Name:") {
                username = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
            }
        }

        let uri = `${String((dbConfig.basic as IConnBasicMySQL).username)}`;
        uri += `@${String((dbConfig.basic as IConnBasicMySQL).hostname)}:`;
        uri += (dbConfig.basic as IConnBasicMySQL).port;

        expect(service).to.equals(uri);
        expect(username).to.equals((dbConfig.basic as IConnBasicMySQL).username);

        expect(await title.getText()).to.equals("Open MySQL Connection");

        await dialog.findElement(By.css("input")).sendKeys((dbConfig.basic as IConnBasicMySQL).password);
        await dialog.findElement(By.id("ok")).click();
    };

    public static isConnectionLoaded = (): Condition<boolean> => {
        return new Condition("DB is not loaded", async () => {
            const st1 = await driver.findElements(By.css(".msg.portal"));
            const st2 = await driver.findElements(By.css("textarea"));
            const st3 = await driver.findElements(By.id("title"));
            const st4 = await driver.findElements(By.id("resultPaneHost"));

            return st1.length > 0 || st2.length > 0 || st3.length > 0 || st4.length > 0;
        });
    };

    public static closeConnection = async (name: string): Promise<void> => {
        await driver.switchTo().defaultContent();
        const edView = new EditorView();
        const editors = await edView.getOpenEditorTitles();
        for (const editor of editors) {
            if (editor === name) {
                await edView.closeEditor(editor);
                break;
            }
        }
    };

    public static selectDatabaseType = async (value: string): Promise<void> => {
        await driver.findElement(By.id("databaseType")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        const els = await dropDownList.findElements(By.css("div"));
        if (els.length > 0) {
            await dropDownList.findElement(By.id(value)).click();
        }
    };

    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        const buttons = await driver.findElements(By.css("#contentHost .msg.button"));
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    public static isStatementStart = async (statement: string): Promise<boolean | undefined> => {

        const getLineSentence = async (ctx: WebElement): Promise<string> => {
            const spans = await ctx.findElements(By.css("span"));
            let sentence = "";
            for (const span of spans) {
                sentence += (await span.getText()).replace("&nbsp;", " ");
            }

            return sentence;
        };

        let flag: boolean | undefined;

        await driver.wait(async () => {
            try {
                const leftSideLines = await driver.findElements(By.css(".margin-view-overlays > div"));
                const rightSideLines = await driver.findElements(
                    By.css(".view-lines.monaco-mouse-cursor-text > div > span"));

                let index = -1;

                for (let i = 0; i <= rightSideLines.length - 1; i++) {
                    const lineSentence = await getLineSentence(rightSideLines[i]);
                    if (lineSentence.includes(statement)) {
                        index = i;
                        break;
                    }
                }

                if (index === -1) {
                    throw new Error(`Could not find statement ${statement}`);
                }

                flag = (await leftSideLines[index].findElements(By.css(".statementStart"))).length > 0;

                return true;
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, explicitWait, "Lines were stale");

        return flag;
    };

    public static findInSelection = async (el: WebElement, flag: boolean): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if ((await action.getAttribute("title")).indexOf("Find in selection") !== -1) {
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

    public static expandFinderReplace = async (el: WebElement, flag: boolean): Promise<void> => {
        const divs = await el.findElements(By.css("div"));
        for (const div of divs) {
            if ((await div.getAttribute("title")) === "Toggle Replace") {
                const expanded = await div.getAttribute("aria-expanded");
                if (flag) {
                    if (expanded === "false") {
                        await div.click();
                    }
                } else {
                    if (expanded === "true") {
                        await div.click();
                    }
                }
            }
        }
    };

    public static replacerGetButton = async (el: WebElement, button: string): Promise<WebElement | undefined> => {
        const replaceActions = await el.findElements(
            By.css(".replace-actions div"),
        );
        for (const action of replaceActions) {
            if ((await action.getAttribute("title")).indexOf(button) !== -1) {
                return action;
            }
        }
    };

    public static closeFinder = async (el: WebElement): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
                await action.click();
            }
        }
    };

    public static clickContextItem = async (item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(By.css("textarea"));
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, explicitWait, "Context menu was not displayed");

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
        }, explicitWait, "Context menu is still displayed");
    };

    public static hasNewPrompt = async (): Promise<boolean | undefined> => {
        let text: String;
        try {
            const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                throw new Error(String(e.stack));
            } else {
                await driver.sleep(500);
                const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
                text = await lastPrompt.getText();
            }
        }

        return String(text).length === 0;
    };

    public static setRestService = async (
        serviceName: string,
        comments: string,
        hostname: string,
        protocols: string[],
        mrsDefault: boolean,
        mrsEnabled: boolean): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
            explicitWait, "MRS Service dialog was not displayed");

        const inputServPath = await dialog.findElement(By.id("servicePath"));
        await inputServPath.clear();
        await inputServPath.sendKeys(serviceName);

        const inputComments = await dialog.findElement(By.id("comments"));
        await inputComments.clear();
        await inputComments.sendKeys(comments);

        const inputHost = await dialog.findElement(By.id("hostName"));
        await inputHost.clear();
        await inputHost.sendKeys(hostname);

        const protocolsSelect = await driver.findElement(By.id("protocols"));
        await protocolsSelect.click();

        await driver.wait(until.elementLocated(By.id("protocolsPopup")), ociExplicitWait,
            "Protocols Drop down list was not opened");

        const availableProtocols = await driver.findElements(By.css("#protocolsPopup div.dropdownItem"));
        for (const prt of availableProtocols) {
            const item = await prt.getAttribute("id");
            if (protocols.includes(item)) {
                const isUnchecked = (await (await prt.findElement(By.css("label"))).getAttribute("class"))
                    .includes("unchecked");
                if (isUnchecked) {
                    await prt.click();
                }
            } else {
                const isUnchecked = (await (await prt.findElement(By.css("label"))).getAttribute("class"))
                    .includes("unchecked");
                if (!isUnchecked) {
                    await prt.click();
                }
            }
        }

        await driver.actions().sendKeys(Key.ESCAPE).perform();

        const inputMrsDef = await dialog.findElement(By.id("makeDefault"));
        const inputMrsDefClasses = await inputMrsDef.getAttribute("class");
        let classes = inputMrsDefClasses.split(" ");
        if (mrsDefault === true) {
            if (classes.includes("unchecked")) {
                await inputMrsDef.findElement(By.css(".checkMark")).click();
            }
        } else {
            if (classes.includes("checked")) {
                await inputMrsDef.findElement(By.css(".checkMark")).click();
            }
        }

        const inputMrsEnabled = await dialog.findElement(By.id("enabled"));
        const inputMrsEnabledClasses = await inputMrsEnabled.getAttribute("class");
        classes = inputMrsEnabledClasses.split(" ");
        if (mrsEnabled === true) {
            if (classes.includes("unchecked")) {
                await inputMrsEnabled.findElement(By.css(".checkMark")).click();
            }
        } else {
            if (classes.includes("checked")) {
                await inputMrsEnabled.findElement(By.css(".checkMark")).click();
            }
        }

        await dialog.findElement(By.id("ok")).click();
    };

    public static setRestSchema = async (
        mrsService?: string,
        schemaName?: string,
        requestPath?: string,
        itemsPerPage?: number,
        authentication?: boolean,
        enabled?: boolean,
        comments?: string): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
            explicitWait, "MRS Schema dialog was not displayed");

        if (schemaName) {
            const inputSchemaName = await dialog.findElement(By.id("name"));
            await inputSchemaName.clear();
            await inputSchemaName.sendKeys(schemaName);
        }
        if (mrsService) {
            const selectService = await dialog.findElement(By.id("service"));
            await selectService.click();
            const mrsServiceArr = mrsService.split("|");
            for (const item of mrsServiceArr) {
                try {
                    await driver.findElement(By.id(item)).click();
                    break;
                } catch (e) {
                    // continue
                }
            }
        }
        if (requestPath) {
            const inputRequestPath = await dialog.findElement(By.id("requestPath"));
            await inputRequestPath.clear();
            await inputRequestPath.sendKeys(requestPath);
        }
        if (authentication !== undefined) {
            const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
            const inputRequiresAuthClasses = await inputRequiresAuth.getAttribute("class");
            const classes = inputRequiresAuthClasses.split(" ");
            if (authentication === true) {
                if (classes.includes("unchecked")) {
                    await inputRequiresAuth.findElement(By.css(".checkMark")).click();
                }
            } else {
                if (!classes.includes("unchecked")) {
                    await inputRequiresAuth.findElement(By.css(".checkMark")).click();
                }
            }
        }
        if (enabled !== undefined) {
            const inputEnabled = await dialog.findElement(By.id("enabled"));
            const inputEnabledClasses = await inputEnabled.getAttribute("class");
            const classes = inputEnabledClasses.split(" ");
            if (enabled === true) {
                if (classes.includes("unchecked")) {
                    await inputEnabled.findElement(By.css(".checkMark")).click();
                }
            } else {
                if (!classes.includes("unchecked")) {
                    await inputEnabled.findElement(By.css(".checkMark")).click();
                }
            }
        }
        if (itemsPerPage) {
            const inputItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
            await inputItemsPerPage.clear();
            await inputItemsPerPage.sendKeys(itemsPerPage);
        }
        if (comments) {
            const inputComments = await dialog.findElement(By.id("comments"));
            await inputComments.clear();
            await inputComments.sendKeys(comments);
        }
        await dialog.findElement(By.id("ok")).click();
    };

    public static getCurrentEditorType = async (): Promise<string> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        const img = await selector.findElements(By.css("img"));
        if (img.length > 0) {
            const imgSrc = await img[0].getAttribute("src");
            const srcPath = basename(imgSrc);

            return srcPath.split(".")[0];
        } else {
            const span = await selector.findElement(By.css(".msg.icon"));

            return span.getAttribute("style");
        }

    };

    public static setAuthenticationApp = async (
        vendor?: string,
        name?: string,
        description?: string,
        accessToken?: string,
        appId?: string,
        customUrl?: string,
        customUrlAccToken?: string,
        defaultRole?: string,
        enabled?: boolean,
        limitUsers?: boolean,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
            explicitWait * 2, "Authentication app dialog was not displayed");

        if (vendor) {
            await dialog.findElement(By.id("authVendorName")).click();
            const popup = await driver.wait(until.elementLocated(By.id("authVendorNamePopup")),
                explicitWait, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(vendor)).click();
        }


        if (name) {
            const nameInput = await dialog.findElement(By.id("name"));
            await nameInput.clear();
            await nameInput.sendKeys(name);
        }
        if (description) {
            const descriptionInput = await dialog.findElement(By.id("description"));
            await descriptionInput.clear();
            await descriptionInput.sendKeys(description);
        }
        if (accessToken) {
            const accessTokenInput = await dialog.findElement(By.id("accessToken"));
            await accessTokenInput.clear();
            await accessTokenInput.sendKeys(accessToken);
        }
        if (appId) {
            const appIdInput = await dialog.findElement(By.id("appId"));
            await appIdInput.clear();
            await appIdInput.sendKeys(appId);
        }
        if (customUrl) {
            const urlInput = await dialog.findElement(By.id("url"));
            await urlInput.clear();
            await urlInput.sendKeys(customUrl);
        }
        if (customUrlAccToken) {
            const urlDirectAuthInput = await dialog.findElement(By.id("urlDirectAuth"));
            await urlDirectAuthInput.clear();
            await urlDirectAuthInput.sendKeys(customUrlAccToken);
        }

        if (defaultRole) {
            await dialog.findElement(By.id("defaultRoleName")).click();
            const popup = await driver.wait(until.elementLocated(By.id("defaultRoleNamePopup")),
                explicitWait, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(defaultRole)).click();
        }

        if (enabled !== undefined) {
            const enabledInput = await dialog.findElement(By.id("enabled"));
            const status = await enabledInput.getAttribute("class");
            if (status.includes("unchecked")) {
                if (enabled) {
                    await enabledInput.click();
                }
            } else {
                if (!enabled) {
                    await enabledInput.click();
                }
            }

            await dialog.click();
        }

        if (limitUsers !== undefined) {
            const limitInput = await dialog.findElement(By.id("limitToRegisteredUsers"));
            const status = await limitInput.getAttribute("class");
            if (status.includes("unchecked")) {
                if (limitUsers) {
                    await limitInput.click();
                }
            } else {
                if (!limitUsers) {
                    await limitInput.click();
                }
            }

            await dialog.click();
        }

        await dialog.findElement(By.id("ok")).click();

    };

    public static setUser = async (
        name: string,
        password: string,
        authApp?: string,
        email?: string,
        roles?: string,
        permitLogin?: boolean,
        options?: string,
        vendorUserId?: string,
        mappedUserId?: string,
    ): Promise<void> => {


        const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
            explicitWait * 2, "User dialog was not displayed");

        const nameInput = await dialog.findElement(By.id("name"));
        const passwordInput = await dialog.findElement(By.id("authString"));

        await nameInput.clear();
        await nameInput.sendKeys(name);

        await passwordInput.clear();
        await passwordInput.sendKeys(password);

        if (authApp) {
            await dialog.findElement(By.id("authApp")).click();
            const popup = await driver.wait(until.elementLocated(By.id("authAppPopup")),
                explicitWait, "Auth app drop down list was not displayed");

            await popup.findElement(By.id(authApp)).click();
        }

        if (email) {
            const emailInput = await dialog.findElement(By.id("email"));
            await emailInput.clear();
            await emailInput.sendKeys(email);
        }

        if (roles) {
            await dialog.findElement(By.id("roles")).click();
            const popup = await driver.wait(until.elementLocated(By.id("rolesPopup")),
                explicitWait, "Roles drop down list was not displayed");

            const rolesLabel = await popup.findElement(By.css(`#${roles} label`));
            const rolesLabelClass = await rolesLabel.getAttribute("class");
            if (rolesLabelClass.includes("unchecked")) {
                await rolesLabel.click();
            } else {
                await dialog.click();
            }
        }

        if (permitLogin !== undefined) {
            const inputPermitLogin = await dialog.findElement(By.id("loginPermitted"));
            const inputPermitLoginClass = await inputPermitLogin.getAttribute("class");
            if (inputPermitLoginClass.includes("unchecked")) {
                if (permitLogin) {
                    await inputPermitLogin.click();
                }
            } else {
                if (!permitLogin) {
                    await inputPermitLogin.click();
                }
            }
        }

        if (options) {
            const appOptionsInput = await dialog.findElement(By.id("appOptions"));
            await appOptionsInput.clear();
            await appOptionsInput.sendKeys(options);
        }

        if (vendorUserId) {
            const vendorUserIdInput = await dialog.findElement(By.id("vendorUserId"));
            await vendorUserIdInput.clear();
            await vendorUserIdInput.sendKeys(vendorUserId);
        }

        if (mappedUserId) {
            const mappedUserIdInput = await dialog.findElement(By.id("mappedUserId"));
            await mappedUserIdInput.clear();
            await mappedUserIdInput.sendKeys(mappedUserId);
        }

        await dialog.findElement(By.id("ok")).click();

    };

    public static setRestObject = async (
        service?: string,
        restObjPath?: string,
        dbObjName?: string,
        crud?: string[],
        enabled?: boolean,
        requiresAuth?: boolean,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsDbObjectDialog")),
            explicitWait * 2, "Edit REST Object dialog was not displayed");

        if (service) {
            const inService = await dialog.findElement(By.id("service"));
            await inService.click();
            const popup = await driver.wait(until.elementLocated(By.id("servicePopup")),
                explicitWait, "#servicePopup not found");
            await popup.findElement(By.id(service)).click();
        }
        if (restObjPath) {
            const inObjPath = await dialog.findElement(By.id("requestPath"));
            await inObjPath.clear();
            await inObjPath.sendKeys(restObjPath);
        }
        if (dbObjName) {
            const inObjName = await dialog.findElement(By.id("name"));
            await inObjName.clear();
            await inObjName.sendKeys(restObjPath);
        }
        if (crud) {
            const els2click = [];
            const crudDivs = await dialog.findElements(By.css(".crudIconsDiv img"));
            for (const crudDiv of crudDivs) {
                const isActive = (await crudDiv.getAttribute("src")).includes("Active");
                const name = await crudDiv.getAttribute("data-tooltip");
                if (crud.includes(name)) {
                    if (!isActive) {
                        els2click.push(name);
                    }
                } else {
                    if (isActive) {
                        els2click.push(name);
                    }
                }
            }
            for (const el of els2click) {
                const crudDivs = await dialog.findElements(By.css(".crudIconsDiv img"));
                for (const crudDiv of crudDivs) {
                    const name = await crudDiv.getAttribute("data-tooltip");
                    if (name === el) {
                        await crudDiv.click();
                        break;
                    }
                }
            }
        }
        if (enabled !== undefined) {
            const inEnabled = await dialog.findElement(By.id("enabled"));
            if (enabled === true) {
                const isUnchecked = (await inEnabled.getAttribute("class")).includes("unchecked");
                if (isUnchecked) {
                    await inEnabled.click();
                }
            } else {
                const isUnchecked = (await inEnabled.getAttribute("class")).includes("unchecked");
                if (!isUnchecked) {
                    await inEnabled.click();
                }
            }
        }
        if (requiresAuth !== undefined) {
            const inAuth = await dialog.findElement(By.id("requiresAuth"));
            if (requiresAuth === true) {
                const isUnchecked = (await inAuth.getAttribute("class")).includes("unchecked");
                if (isUnchecked) {
                    await inAuth.click();
                }
            } else {
                const isUnchecked = (await inAuth.getAttribute("class")).includes("unchecked");
                if (!isUnchecked) {
                    await inAuth.click();
                }
            }
        }

        await dialog.findElement(By.id("ok")).click();
    };

    public static getCurrentEditor = async (): Promise<string> => {
        const getData = async (): Promise<string> => {
            const selector = await driver.wait(until.elementLocated(By.id("documentSelector")),
                explicitWait, "Document selector was not found");
            const label = await selector.findElement(By.css("label"));

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

    public static addScript = async (scriptType: string): Promise<void> => {
        const curEditor = await this.getCurrentEditor();
        const button = await driver.findElement(By.id("newScriptMenuButton"));
        await button.click();
        let locator = "";
        switch (scriptType) {
            case "sql": {
                locator = "addSQLScript";
                break;
            }
            case "ts": {
                locator = "addTSScript";
                break;
            }
            case "js": {
                locator = "addJSScript";
                break;
            }
            default: {
                break;
            }
        }

        const script = await driver.wait(until.elementLocated(By.id(locator)), 2000, "Scripts menu was not opened");
        await script.click();
        await driver.wait(async () => {
            const nextEditor = await this.getCurrentEditor();

            return nextEditor !== curEditor;
        }, 3000, "Current editor did not changed");
    };

    public static execScript = async (cmd: string, timeout?: number): Promise<Array<string | WebElement>> => {

        const textArea = await driver?.findElement(By.css("textarea"));
        await textArea.sendKeys(cmd);
        await Misc.execOnEditor();
        timeout = timeout ?? 5000;

        return Database.getScriptResult(timeout);
    };

    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.findElement(By.css("textarea")).sendKeys(Key.ARROW_UP);

        items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)] as string[];

    };

    public static isEditorStretched = async (): Promise<boolean> => {
        const editor = await driver.findElement(By.id("editorPaneHost"));
        const style = await editor.getCssValue("height");
        const height = parseInt(style.trim().replace("px", ""), 10);

        return height > 0;
    };

    public static getScriptResult = async (timeout?: number): Promise<Array<string | WebElement>> => {
        const toReturn: Array<string | WebElement> = [];
        await driver.wait(async () => {
            const resultHost = await driver.findElements(By.css(".resultHost"));
            if (resultHost.length > 0) {
                const resultStatus = await resultHost[0].findElements(By.css(".resultStatus .label"));
                if (resultStatus.length > 0) {
                    toReturn.push(await resultStatus[0].getAttribute("innerHTML"));
                    toReturn.push(await resultHost[0].findElement(By.css(".resultTabview")));

                    return true;
                }

                const content = await resultHost[0].findElements(By.css(".actionLabel span"));
                if (content.length) {
                    toReturn.push(await content[0].getAttribute("innerHTML"));

                    return true;
                }
            }
        }, timeout, `No results were found`);

        return toReturn;
    };

    public static isResultTabMaximized = async (): Promise<boolean> => {
        return (await driver.findElements(By.id("normalizeResultStateButton"))).length > 0;
    };

    public static selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(By.css("div.visible.dropdownList > div"))).length > 1;
        }, 2000, "No elements located on dropdown");

        const dropDownItems = await driver.findElements(
            By.css("div.visible.dropdownList > div"),
        );

        for (const item of dropDownItems) {
            const name = await item.findElement(By.css("label")).getText();
            const el = await item.findElements(By.css("img"));

            let type = "";

            if (el.length > 0) {
                type = await el[0].getAttribute("src");
            } else {
                type = await item.findElement(By.css(".msg.icon")).getAttribute("style");
            }

            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selector = await driver.findElement(By.id("documentSelector"));
                        const selected = await selector.findElement(By.css("label")).getText();

                        return selected === editorName;
                    }, explicitWait, `${editorName} with type ${editorType} was not properly selected`);

                    await driver.wait(
                        async () => {
                            return (
                                (
                                    await driver.findElements(
                                        By.css("div.visible.dropdownList > div"),
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

    public static setDBConnectionCredentials = async (data: IDBConnection, timeout?: number): Promise<void> => {
        await Database.setPassword(data);
        if (credentialHelperOk) {
            await Misc.setConfirmDialog(data, "no", timeout);
        }
    };

    public static setInputPath = async (path: string): Promise<void> => {
        const input = await InputBox.create();
        await input.setText(path);
        await input.confirm();
    };

    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {

        const commands = [];
        await driver.wait(async () => {
            try {
                const cmds = await driver.wait(
                    until.elementsLocated(By.css(".view-lines.monaco-mouse-cursor-text > div > span")),
                    explicitWait, "No lines were found");
                for (const cmd of cmds) {
                    const spans = await cmd.findElements(By.css("span"));
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
        }, explicitWait, "No SQL commands were found on the notebook");


        if (!commands.includes(sql)) {
            throw new Error(`Could not find the SQL statement ${sql} on the notebook`);
        }

        let foundResult = false;
        const results = await driver.findElements(By.css(".resultStatus"));
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
}
