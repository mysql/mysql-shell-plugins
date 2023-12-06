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

    public static existsOnNotebook = async (word: string): Promise<boolean> => {
        const commands: string[] = [];
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

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");

        return commands.includes(word);
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

    public static toggleCheckBox = async (elId: string, checked: boolean): Promise<void> => {
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

    public static getCheckBoxValue = async (elId: string): Promise<boolean> => {
        const classes = (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ");

        return !classes.includes("unchecked");
    };
}
