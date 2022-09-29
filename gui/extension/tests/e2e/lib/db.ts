/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
    Button,
    Key as selKey,
} from "vscode-extension-tester";
import { expect } from "chai";
import { basename } from "path";

import { driver, Common, dbTreeSection, explicitWait, ociExplicitWait } from "../lib/common";

export interface IDBConnection {
    caption: string;
    description: string;
    hostname: string;
    username: string;
    port: number;
    portX: number;
    schema: string;
    password: string;
    sslMode: string | undefined;
    sslCA: string | undefined;
    sslClientCert: string | undefined;
    sslClientKey: string | undefined;
}

export class Database {

    public static getExistingConnections = async (): Promise<string[]> => {
        const sec = await Common.getSection(dbTreeSection);
        const els = await sec?.findElements(By.xpath(`//div[@role='treeitem']`));
        const connections = [];
        for (const el of els!) {
            const icon = await el.findElement(By.css(".custom-view-tree-node-item-icon")).getAttribute("style");
            if (icon.includes("connectionMySQL") || icon.includes("connectionSqlite")) {
                const text = (await el.getAttribute("aria-label")).trim();
                connections.push(text);
            }
        }

        return connections;
    };

    public static createConnection = async (dbConfig: IDBConnection): Promise<void> => {
        const createConnBtn = await Common.getSectionToolbarButton(dbTreeSection, "Create New DB Connection");
        await createConnBtn?.click();

        const editorView = new EditorView();
        const editor = await editorView.openEditor("DB Connections");
        expect(await editor.getTitle()).to.equals("DB Connections");

        await driver.switchTo().frame(0);
        await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
        await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

        const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
            10000, "Connection dialog was not loaded");
        await driver.wait(async () => {
            await newConDialog.findElement(By.id("caption")).clear();

            return !(await driver.executeScript("return document.querySelector('#caption').value"));
        }, 3000, "caption was not cleared in time");
        await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);
        await newConDialog.findElement(By.id("description")).clear();
        await newConDialog
            .findElement(By.id("description"))
            .sendKeys(dbConfig.description);
        await newConDialog.findElement(By.id("hostName")).clear();
        await newConDialog.findElement(By.id("hostName")).sendKeys(dbConfig.hostname);
        await driver.findElement(By.css("#port input")).clear();
        await driver.findElement(By.css("#port input")).sendKeys(dbConfig.port);
        await newConDialog.findElement(By.id("userName")).sendKeys(dbConfig.username);
        await newConDialog
            .findElement(By.id("defaultSchema"))
            .sendKeys(dbConfig.schema);

        await newConDialog.findElement(By.id("storePassword")).click();
        const passwordDialog = await driver.findElement(By.css(".passwordDialog"));
        await passwordDialog.findElement(By.css("input")).sendKeys(dbConfig.password);
        await passwordDialog.findElement(By.id("ok")).click();

        const okBtn = await driver.findElement(By.id("ok"));
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
        await driver.switchTo().defaultContent();
    };

    public static getWebViewConnection = async (name: string, useFrame = true): Promise<WebElement> => {

        if (useFrame) {
            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));
        }

        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(By.css("#tilesHost button"));
            for (const host of hosts) {
                try {
                    const el = await host.findElement(By.css(".textHost .tileCaption"));
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

        return db!;
    };

    public static setPassword = async (dbConfig: IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(
            By.css(".passwordDialog")), 10000, "No password dialog was found");
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

        expect(service).to.equals(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);
        expect(username).to.equals(dbConfig.username);

        expect(await title.getText()).to.equals("Open MySQL Connection");

        await dialog.findElement(By.css("input")).sendKeys(dbConfig.password);
        await dialog.findElement(By.id("ok")).click();
    };

    public static setFeedbackRequested = async (
        dbConfig: IDBConnection, value: string): Promise<void> => {

        const feedbackDialog = await driver.wait(until.elementLocated(
            By.css(".valueEditDialog")), explicitWait, "Feedback Requested dialog was not found");
        expect(await feedbackDialog.findElement(By.css(".title label")).getText()).to.equals("Feedback Requested");

        expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
            .to.contain(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);

        expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
            .to.contain("? [Y]es/[N]o/Ne[v]er (default No):");

        await feedbackDialog.findElement(By.css("input")).sendKeys(value);
        await feedbackDialog.findElement(By.id("ok")).click();
    };

    public static deleteConnection = async (dbName: string): Promise<void> => {

        await Common.selectContextMenuItem(dbTreeSection, dbName, "Delete DB Connection");

        const editorView = new EditorView();
        await driver.wait(async () => {
            const activeTab = await editorView.getActiveTab();

            return await activeTab?.getTitle() === "DB Connections";
        }, 3000, "error");

        await driver.switchTo().frame(0);
        await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
        await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

        const item = driver.findElement(By.xpath("//label[contains(text(),'" + dbName + "')]"));
        const dialog = await driver.wait(until.elementLocated(
            By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
        await dialog.findElement(By.id("accept")).click();

        await driver.wait(until.stalenessOf(item), explicitWait, "Database was not deleted");
        await driver.switchTo().defaultContent();
    };

    public static openNewNotebook = async (): Promise<void> => {
        const button = await driver.findElement(By.id("newMenuButton"));
        await button.click();
        const notebook = await driver.wait(until.elementLocated(By.id("addEditor")), 2000,
            "Scripts menu was not opened");
        await notebook.click();
    };

    public static getOutput = async (penultimate?: boolean): Promise<string> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        let context;
        if (penultimate) {
            context = zoneHosts[zoneHosts.length - 2];
        } else {
            context = zoneHosts[zoneHosts.length - 1];
        }

        let items = await context.findElements(By.css("label"));
        const otherItems = await context.findElements(By.css(".textHost span"));
        let text;

        if (items.length > 0) {
            text = await items[0].getText();
        } else if (otherItems.length > 0) {
            text = await otherItems[otherItems.length - 1].getText();
        } else {
            items = await context.findElements(By.css(".info"));
            text = await items[0].getText();
        }

        return text;
    };

    public static setEditorLanguage = async (language: string): Promise<void> => {

        const contentHost = await driver.wait(until.elementLocated(
            By.id("shellEditorHost")), 15000, "Console was not loaded");

        const textArea = await contentHost.findElement(By.css("textarea"));
        await Common.execCmd(textArea, "\\" + language.replace("my", ""));
        const result = await this.getOutput();
        switch (language) {
            case "sql": {
                expect(result).to.contain("Switching to SQL mode");
                break;
            }
            case "js": {
                expect(result).equals("Switched to JavaScript mode");
                break;
            }
            case "ts": {
                expect(result).equals("Switched to TypeScript mode");
                break;
            }
            default: {
                break;
            }
        }
    };

    public static isConnectionSuccessful = async (connection: string): Promise<boolean> => {
        await driver.switchTo().defaultContent();
        const edView = new EditorView();
        const editors = await edView.getOpenEditorTitles();
        expect(editors).to.include(connection);

        await driver.switchTo().frame(0);
        await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
        await driver.switchTo().frame(await driver.findElement(By.id("frame:DB Connections")));

        expect(await driver.findElement(By.css(".zoneHost"))).to.exist;

        return true;
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
        const buttons = await driver.findElements(By.css("#contentHost button"));
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    public static getStatementStarts = async (): Promise<number> => {
        return (await driver.findElements(By.css(".statementStart"))).length;
    };

    public static writeSQL = async (sql: string, wait?: boolean): Promise<void> => {
        const textArea = await driver.wait(until.elementLocated(By.css("textarea")),
            explicitWait, "Could not find textarea");
        const blueDots = await this.getStatementStarts();
        await textArea.sendKeys(`${sql}`);

        if (wait) {
            await driver.wait(async () => {
                return await this.getStatementStarts() > blueDots;
            }, explicitWait, `'${sql}' did not generated a statement start`);
        }

        const suggestionBox = await driver.findElements(By.css("div.contents"));
        if (suggestionBox.length > 0) {
            await textArea.sendKeys(selKey.ESCAPE);
        }
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

    public static getResultTab = async (tabName: string, onScript?: boolean): Promise<WebElement> => {
        let context;
        if (onScript) {
            context = await driver.wait(until.elementsLocated(By.id("resultPaneHost")),
                explicitWait, "Could not find #resultPaneHost");
        } else {
            context = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                explicitWait, "Could not find .zoneHost");
        }

        const tabs = await context[context.length - 1].findElements(By.css(".resultHost .tabArea div"));

        for (const tab of tabs) {
            if (await tab.getAttribute("id") !== "selectorItemstepDown" &&
                await tab.getAttribute("id") !== "selectorItemstepUp") {
                const label = await tab.findElement(By.css("label"));
                if ((await label.getAttribute("innerHTML")).includes(tabName)) {

                    return tab;
                }
            }
        }
        throw new Error(`Could not find tab '${tabName}'`);
    };

    public static getResultColumnName = async (columnName: string): Promise<WebElement | undefined> => {

        const resultHosts = await driver.wait(until.elementsLocated(By.css(".resultHost")),
            explicitWait, "No result hosts found");

        const resultSet = await driver.wait(async () => {
            return (await resultHosts[resultHosts.length - 1].findElements(By.css(".tabulator-headers")))[0];
        }, explicitWait, "No tabulator-headers detected");

        const resultHeaderRows = await driver.wait(async () => {
            return resultSet.findElements(By.css(".tabulator-col-title"));
        }, explicitWait, "No tabulator-col-title detected");

        for (const row of resultHeaderRows) {
            const rowText = await row.getAttribute("innerHTML");
            if (rowText === columnName) {
                return row;
            }
        }
    };

    public static getEditorLanguage = async (): Promise<string> => {
        const editors = await driver.findElements(By.css(".editorPromptFirst"));
        const editorClasses = (await editors[editors.length - 1].getAttribute("class")).split(" ");

        return editorClasses[2].replace("my", "");
    };

    public static setDBEditorLanguage = async (language: string): Promise<void> => {
        const curLang = await this.getEditorLanguage();
        if (curLang !== language) {
            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await Common.execCmd(textArea, "\\" + language.replace("my", ""));
            const results = await driver.findElements(By.css(".message.info"));
            switch (language) {
                case "sql": {
                    expect(await results[results.length - 1].getText()).equals("Switched to MySQL mode");
                    break;
                }
                case "js": {
                    expect(await results[results.length - 1].getText()).equals("Switched to JavaScript mode");
                    break;
                }
                case "ts": {
                    expect(await results[results.length - 1].getText()).equals("Switched to TypeScript mode");
                    break;
                }
                default: {
                    break;
                }
            }
        }
    };

    public static getResultStatus = async (isSelect?: boolean): Promise<string> => {
        let zoneHosts: WebElement[] | undefined;
        let block: WebElement;
        const obj = isSelect ? "label" : "span";

        await driver.wait(
            async (driver) => {
                zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
                    explicitWait, "No zone hosts were found");
                const about = await driver.wait(async () => {
                    return (await zoneHosts![0].findElements(By.css("span")))[0];
                }, explicitWait, "No span detected");

                // first element is usually the about info
                if ((await about.getText()).indexOf("Welcome") !== -1) {
                    zoneHosts.shift();
                }
                if (zoneHosts.length > 0) {
                    if ((await zoneHosts[0].findElements(By.css(".message.info"))).length > 0) {

                        // if language has been changed...
                        zoneHosts.shift();
                    }
                } else {
                    return false;
                }

                return zoneHosts[zoneHosts.length - 1] !== undefined;
            }, 10000, `Result Status is undefined`,
        );

        await driver.wait(async () => {
            try {
                block = await zoneHosts![zoneHosts!.length - 1].findElement(By.css(obj));

                return true;
            } catch (e) {
                return false;
            }
        }, 10000, "Result Status content was not found");

        return block!.getAttribute("innerHTML");
    };

    public static clickContextMenuItem = async (refEl: WebElement, item: string): Promise<void> => {

        await driver.wait(async () => {
            await refEl.click();
            await driver.actions().click(Button.RIGHT).perform();

            try {
                const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

                return el !== undefined;
            } catch (e) {
                return false;
            }

        }, explicitWait,
        "Context menu was not displayed");

        await driver.wait(async () => {
            try {
                const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);
                await el.click();

                return true;
            } catch (e) {
                if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                    return true;
                }
            }

        }, 3000, "Context menu is still displayed");
    };

    public static getGraphHost = async (): Promise<WebElement> => {
        const resultHosts = await driver.findElements(By.css(".zoneHost"));
        const lastResult = resultHosts[resultHosts.length - 1];

        return driver.wait(async () => {
            return lastResult.findElement(By.css(".graphHost"));
        }, 10000, "Pie Chart was not displayed");
    };

    public static hasNewPrompt = async (): Promise<boolean | undefined> => {
        let text: String;
        try {
            const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        } catch (e) {
            if (String(e).indexOf("StaleElementReferenceError") === -1) {
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

    public static getLastQueryResultId = async (): Promise<number> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        if (zoneHosts.length > 0) {
            const zones = await driver.findElements(By.css(".zoneHost"));

            return parseInt((await zones[zones.length - 1].getAttribute("monaco-view-zone")).match(/\d+/)![0], 10);
        } else {
            return 0;
        }
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

        await driver.actions().sendKeys(selKey.ESCAPE).perform();

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

    public static setRestSchema = async (schemaName: string,
        mrsService: string, requestPath: string, itemsPerPage: number,
        authentication: boolean, enabled: boolean, comments: string): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
            explicitWait, "MRS Schema dialog was not displayed");

        const inputSchemaName = await dialog.findElement(By.id("name"));
        await inputSchemaName.clear();
        await inputSchemaName.sendKeys(schemaName);

        const selectService = await dialog.findElement(By.id("service"));
        await selectService.click();
        await driver.findElement(By.id(mrsService)).click();

        const inputRequestPath = await dialog.findElement(By.id("requestPath"));
        await inputRequestPath.clear();
        await inputRequestPath.sendKeys(requestPath);

        const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
        const inputRequiresAuthClasses = await inputRequiresAuth.getAttribute("class");
        let classes = inputRequiresAuthClasses.split(" ");
        if (authentication === true) {
            if (classes.includes("unchecked")) {
                await inputRequiresAuth.findElement(By.css(".checkMark")).click();
            }
        } else {
            if (classes.includes("checked")) {
                await inputRequiresAuth.findElement(By.css(".checkMark")).click();
            }
        }

        const inputEnabled = await dialog.findElement(By.id("enabled"));
        const inputEnabledClasses = await inputEnabled.getAttribute("class");
        classes = inputEnabledClasses.split(" ");
        if (enabled === true) {
            if (classes.includes("unchecked")) {
                await inputEnabled.findElement(By.css(".checkMark")).click();
            }
        } else {
            if (classes.includes("checked")) {
                await inputEnabled.findElement(By.css(".checkMark")).click();
            }
        }

        const inputItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
        await inputItemsPerPage.clear();
        await inputItemsPerPage.sendKeys(itemsPerPage);

        const inputComments = await dialog.findElement(By.id("comments"));
        await inputComments.clear();
        await inputComments.sendKeys(comments);

        await dialog.findElement(By.id("ok")).click();
    };

    public static getCurrentEditorType = async (): Promise<string> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        const img = await selector.findElement(By.css("img"));
        const imgSrc = await img.getAttribute("src");
        const srcPath = basename(imgSrc);

        return srcPath.split(".")[0];
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
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                result = await getData();
            } else {
                throw e;
            }
        }

        return result;
    };

    public static addScript = async (scriptType: string): Promise<void> => {
        const curEditor = await this.getCurrentEditor();
        const button = await driver.findElement(By.id("newMenuButton"));
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

    public static getScriptResult = async (): Promise<string> => {
        const host = await driver.wait(until.elementLocated(By.id("resultPaneHost")),
            explicitWait, "Result pane host was not found");

        const result = await driver.wait(async () => {
            return (await host.findElements(By.css(".label")))[0];
        }, explicitWait, "Result label not found");

        return result.getText();
    };

    public static collapseAllConnections = async (): Promise<void> => {
        const connections = await this.getExistingConnections();
        for (const conn of connections) {
            await Common.toggleTreeElement(dbTreeSection, conn, false);
        }
    };

    public static reloadConnection = async (connName: string): Promise<void> => {
        const context = await Common.getTreeElement(dbTreeSection, connName);
        await driver.actions().mouseMove(context).perform();
        const btns = await context.findElements(By.css(".actions a"));
        for (const btn of btns) {
            if ((await btn.getAttribute("aria-label")) === "Reload Database Information") {
                await btn.click();

                return;
            }
        }
        throw new Error(`Could not find the Reload button on connection ${connName}`);
    };
}
