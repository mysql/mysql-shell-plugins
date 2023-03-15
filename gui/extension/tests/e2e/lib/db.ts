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
    Key as selKey,
    error,
    CustomTreeSection,
    Condition,
} from "vscode-extension-tester";
import { expect } from "chai";
import { basename } from "path";

import { driver, Misc, dbTreeSection, explicitWait, ociExplicitWait, dbEditorDefaultName } from "./misc";

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

    public static createConnection = async (scope: CustomTreeSection, dbConfig: IDBConnection,
        storePassword = false): Promise<void> => {

        await Misc.clickSectionToolbarButton(scope, "Create New DB Connection");

        await Misc.switchToWebView();

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

        if (storePassword) {
            await newConDialog.findElement(By.id("storePassword")).click();
            const passwordDialog = await driver.findElement(By.css(".passwordDialog"));
            await passwordDialog.findElement(By.css("input")).sendKeys(dbConfig.password);
            await passwordDialog.findElement(By.id("ok")).click();
        }

        const okBtn = await driver.findElement(By.id("ok"));
        await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
        await okBtn.click();
        await driver.switchTo().defaultContent();
    };

    public static getWebViewConnection = async (name: string, useFrame = true,
        webView?: string): Promise<WebElement> => {

        if (useFrame) {
            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            try {
                await driver.switchTo().frame(await driver.findElement(By.id(`frame:${String(webView)}`)));
            } catch (e) {
                await driver.switchTo().frame(await driver.findElement(By.id("frame:MySQL Shell")));
            }
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

        expect(service).to.equals(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);
        expect(username).to.equals(dbConfig.username);

        expect(await title.getText()).to.equals("Open MySQL Connection");

        await dialog.findElement(By.css("input")).sendKeys(dbConfig.password);
        await dialog.findElement(By.id("ok")).click();
    };

    public static isConnectionLoaded = (): Condition<boolean> => {
        return new Condition("DB is not loaded", async () => {
            const st1 = await driver.findElements(By.css(".msg.portal"));
            const st2 = await driver.findElements(By.css("textarea"));
            const st3 = await driver.findElements(By.id("title"));

            return st1.length > 0 || st2.length > 0 || st3.length > 0;
        });
    };

    public static deleteConnection = async (dbName: string): Promise<void> => {

        const treeSection = await Misc.getSection(dbTreeSection);
        const treeItem = await treeSection.findItem(dbName, 5);
        await Misc.selectContextMenuItem(treeItem, "Delete DB Connection");

        const editorView = new EditorView();
        await driver.wait(async () => {
            const activeTab = await editorView.getActiveTab();

            return await activeTab?.getTitle() === "MySQL Shell";
        }, 3000, "error");

        await Misc.switchToWebView();

        const item = driver.findElement(By.xpath("//label[contains(text(),'" + dbName + "')]"));
        const dialog = await driver.wait(until.elementLocated(
            By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
        await dialog.findElement(By.id("accept")).click();

        await driver.wait(until.stalenessOf(item), explicitWait, "Database was not deleted");
        await driver.switchTo().defaultContent();
    };

    public static isConnectionSuccessful = (): Condition<boolean> => {
        return new Condition("", async () => {
            await driver.switchTo().defaultContent();
            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            expect(editors).to.include(dbEditorDefaultName);

            await Misc.switchToWebView();

            return (await driver.findElements(By.css(".zoneHost"))).length > 0;
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
        const buttons = await driver.findElements(By.css("#contentHost button"));
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

        await driver.wait(async () => {
            const textArea = await driver.findElement(By.css("textarea"));
            await driver.actions().contextClick(textArea).perform();

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
                if (e instanceof error.StaleElementReferenceError) {
                    return true;
                }
            }

        }, 3000, "Context menu is still displayed");
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

    public static execScript = async (cmd: string, timeout?: number): Promise<Array<string | WebElement>> => {

        const textArea = await driver?.findElement(By.css("textarea"));
        await textArea.sendKeys(cmd);
        await Misc.execOnEditor();
        timeout = timeout ?? 5000;

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
        }, timeout, `No results were found from the script execution - '${cmd}'`);

        return toReturn;
    };

    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.actions().sendKeys(selKey.ARROW_UP).perform();

        items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)];

    };

}
