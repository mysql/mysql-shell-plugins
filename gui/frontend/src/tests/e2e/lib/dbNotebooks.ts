/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { until, WebElement, Key, error } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import * as constants from "../lib/constants.js";
import { driver } from "../lib/driver.js";
import * as interfaces from "../lib/interfaces.js";
import { DatabaseConnectionDialog } from "./databaseConnectionDialog.js";
import { Os } from "./os.js";

/*export const execFullBlockSql = "Execute the selection or everything in the current block and create a new block";
export const execFullBlockJs = "Execute everything in the current block and create a new block";
export const execCaret = "Execute the statement at the caret position";
export const execFullScript = "Execute full script";
export const find = "Find";
export const rollback = "Rollback DB changes";
export const commit = "Commit DB changes";
export const autoCommit = "Auto commit DB changes";
export const saveNotebook = "Save this Notebook";*/

export class DBNotebooks {

    /**
     * Creates a new database connection, from the DB Editor main page.
     * It verifies that the Connection dialog is closed, at the end.
     * @param dbConfig Database Config object
     * @returns Promise resolving with the connection created
     */
    public static createDataBaseConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const ctx = await driver.wait(until.elementLocated(locator.dbConnectionOverview.browser),
            constants.wait5seconds, "DB Connection Overview page was not loaded");

        await driver.wait(async () => {
            const isDialogVisible = (await driver.findElements(locator.dbConnectionDialog.exists))
                .length > 0;

            if (isDialogVisible) {
                return true;
            } else {
                try {
                    await ctx.findElement(locator.dbConnectionOverview.newDBConnection).click();
                } catch (e) {
                    if (!(e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

                return false;
            }
        }, constants.wait5seconds, "Connection dialog was not displayed");
        await DatabaseConnectionDialog.setConnection(dbConfig);
    };

    /**
     * Returns the WebElement that represents the DB Connection, on the DB Connection main page
     * Throws an exception if not found.
     * @param name Connection caption
     * @returns @returns Promise resolving with the DB Connection
     */
    public static getConnection = async (name: string): Promise<WebElement | undefined> => {
        return driver.wait(async () => {
            const connections = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);

            for (const connection of connections) {
                const el = await connection.findElement(locator.dbConnectionOverview.dbConnection.caption);

                if ((await el.getAttribute("innerHTML")).includes(name)) {
                    return connection;
                }
            }
        }, constants.wait5seconds, "Could not find any connection");
    };

    /**
     * Returns the autocomplete context item list
     * @returns A promise resolving when the list is fulfilled
     */
    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.autoCompleteItems),
            constants.wait5seconds, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.actions().sendKeys(Key.ARROW_UP).perform();

        items = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.autoCompleteItems),
            constants.wait5seconds, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)];
    };

    /**
     * Gets the line number where a word is found
     * @param wordRef The word
     * @returns A promise resolving with the line number
     */
    public static getLineFromWord = async (wordRef: string): Promise<number | undefined> => {
        let line: number | undefined;
        await driver.wait(async () => {
            try {
                const lines = await driver.findElements(locator.notebook.codeEditor.editor.editorPrompt);

                for (let i = 0; i <= lines.length - 1; i++) {
                    const match = (await lines[i].getAttribute("innerHTML")).match(/(?<=">)(.*?)(?=<\/span>)/gm);

                    if (match !== null) {
                        const cmdFromEditor = match.join("").replace(/&nbsp;/g, " ");
                        if (cmdFromEditor === wordRef) {
                            line = i;

                            return true;
                        }
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The lines were always stale");

        if (line === undefined) {
            throw new Error(`Could not find the line of word ${wordRef}`);
        } else {
            return line;
        }
    };

    /**
     * Sets a new line on the notebook editor
     * @returns A promise resolving when the new line is set
     */
    public static setNewLineOnEditor = async (): Promise<void> => {
        let newLineNumber: number;
        const getLastLineNumber = async (): Promise<number> => {
            await driver.wait(async () => {
                try {
                    const lineNumbers = await driver.findElements(locator.notebook.codeEditor.editor.lineNumber);

                    if (lineNumbers.length === 0) {
                        return 0;
                    } else {
                        const numbers = await Promise.all(
                            lineNumbers.map(async (lineNumber: WebElement) => {
                                return parseInt(await lineNumber.getAttribute("innerHTML"), 10);
                            }));

                        newLineNumber = Math.max(...numbers);

                        return true;
                    }
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, "Line numbers were stale");

            return newLineNumber;
        };

        await driver.wait(async () => {
            const lastLineNumber = await getLastLineNumber();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.ESCAPE); // close the suggestions menu if exists
            await textArea.sendKeys(Key.ENTER);
            await driver.sleep(500);

            return (await getLastLineNumber()) > lastLineNumber;
        }, constants.wait5seconds, "Could not set a new line on the editor");
    };

    /**
     * Gets the last text on the last prompt/editor line
     * @returns A promise resolving with the text
     */
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
        }, constants.wait5seconds, "Could not get the text from last prompt line");

        return sentence;
    };

    /**
     * Gets a toolbar button
     * @param button The button name
     * @returns A promise resolving with the button
     */
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

    /**
     * Verifies if a toolbar button exists
     * @param button The button
     * @returns A promise resolving with true if the button exists, false otherwise
     */
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

    /**
     * Toggles the find in selection on the find widget
     * @param flag True to enable, false otherwise
     * @returns A promise resolving when button is clicked
     */
    public static widgetFindInSelection = async (flag: boolean): Promise<void> => {
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

    /**
     * Expands or collapses the find and replace on the find widget
     * @param expand True to expand, false to collapse
     * @returns A promise resolving when replacer is expanded or collapsed
     */
    public static widgetExpandFinderReplace = async (expand: boolean): Promise<void> => {
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

    /**
     * Gets the replacer buttons by their name (Replace, Replace All)
     * @param button The button name
     * @returns A promise resolving when button is returned
     */
    public static widgetGetReplacerButton = async (button: string):
        Promise<WebElement | undefined> => {
        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const replaceActions = await findWidget.findElements(locator.findWidget.replacerActions);

        for (const action of replaceActions) {

            if ((await action.getAttribute("aria-label")).indexOf(button) !== -1) {
                return action;
            }
        }
    };

    /**
     * Closes the widget finder
     * @returns A promise resolving when finder is closed
     */
    public static widgetCloseFinder = async (): Promise<void> => {
        await driver.wait(async () => {
            const findWidget = await driver.findElements(locator.findWidget.exists);

            if (findWidget.length > 0) {
                const closeButton = await findWidget[0].findElement(locator.findWidget.close);
                await driver.executeScript("arguments[0].click()", closeButton);
                const widget = await driver.findElement(locator.findWidget.exists);

                return (await widget.getAttribute("class")).includes("visible") === false;
            } else {
                return true;
            }
        }, constants.wait5seconds, "The finder widget was not closed");
    };

    /**
     * Returns the prompt text within a line, on the prompt
     * @param prompt last (last line), last-1 (line before the last line), last-2 (line before the 2 last lines)
     * @returns Promise resolving with the text on the selected line
     */
    public static getPromptTextLine = async (prompt: string): Promise<String> => {
        const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);

        let position: number;
        let tags;
        switch (prompt) {

            case "last": {
                position = 1;
                break;
            }

            case "last-1": {
                position = 2;
                break;
            }

            case "last-2": {
                position = 3;
                break;
            }

            default: {
                throw new Error("Error getting line");
            }

        }

        let sentence = "";
        await driver.wait(async () => {
            try {
                const lines = await context.findElements(locator.notebook.codeEditor.editor.editorPrompt);
                const words = locator.htmlTag.mix(locator.htmlTag.span.value, locator.htmlTag.span.value);

                if (lines.length > 0) {
                    tags = await lines[lines.length - position].findElements(words);
                    for (const tag of tags) {
                        sentence += (await tag.getText()).replace("&nbsp;", " ");
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

    /**
     * Removes all the existing text on the prompt
     * @returns A promise resolving when the clean is made
     */
    public static cleanPrompt = async (): Promise<void> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);

        if (Os.isMacOs()) {
            await textArea
                .sendKeys(Key.chord(Key.COMMAND, "a", "a"));
        } else {
            await textArea
                .sendKeys(Key.chord(Key.CONTROL, "a", "a"));
        }

        await textArea.sendKeys(Key.BACK_SPACE);
        await driver.wait(async () => {
            return await DBNotebooks.getPromptTextLine("last") === "";
        }, constants.wait5seconds, "Prompt was not cleaned");
    };

    /**
     * Closes the current opened notebook tab, or an existing notebook tab
     * Throws an exception if the existing connection tab is not found
     * @param name Connection tab name
     * @returns Promise resolving when the connection is closed
     */
    public static closeNotebook = async (name: string): Promise<void> => {

        if (name === "current") {
            const tab = await driver.findElement(locator.notebook.connectionTab.opened);
            await tab.findElement(locator.notebook.connectionTab.close).click();
        } else {
            const tabs = await driver.findElements(locator.notebook.connectionTab.exists);

            for (const tab of tabs) {
                const text = await tab.findElement(locator.htmlTag.label).getAttribute("innerHTML");

                if (text.trim() === name) {
                    await tab.findElement(locator.notebook.connectionTab.close).click();

                    return;
                }
            }
            throw new Error(`Could not find connection tab with name '${name}'`);
        }
    };

    /**
     * Returns an object/item within the schema section on the DB Editor
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static getSchemaObject = async (
        objType: string,
        objName: string): Promise<WebElement | undefined> => {
        const scrollSection = await driver.wait(until.elementLocated(locator.notebook.explorerHost.schemas.scroll),
            constants.wait5seconds, "Table scroll was not found");

        await driver.executeScript("arguments[0].scrollBy(0,-1000)", scrollSection);

        const sectionHost = await driver.findElement(locator.notebook.explorerHost.schemas.exists);
        let level: number;
        switch (objType) {
            case "Schema":
                level = 0;
                break;
            case "Tables":
            case "Views":
            case "Routines":
            case "Events":
            case "Triggers":
            case "Foreign keys":
            case "Indexes":
                level = 1;
                break;
            default:
                level = 2;
        }

        await driver.wait(
            async () => {
                try {
                    const objects = await sectionHost.findElements(
                        locator.notebook.explorerHost.schemas.objectByLevel(level),
                    );

                    return (
                        (await objects[0].findElement(locator.htmlTag.label).getText()) !==
                        "loading..."
                    );
                } catch (e) {
                    return true;
                }
            },
            constants.wait5seconds,
            "Still loading",
        );

        const findItem = async (scrollNumber: number): Promise<WebElement | undefined> => {

            if (scrollNumber <= 4) {
                const sectionHost = await driver.findElement(locator.notebook.explorerHost.schemas.exists);
                const objects = await sectionHost.findElements(
                    locator.notebook.explorerHost.schemas.objectByLevel(level),
                );
                let ref;
                try {

                    for (const object of objects) {
                        ref = object.findElement(locator.htmlTag.label);
                        await driver.executeScript("arguments[0].scrollIntoView(true);", ref);

                        if (await ref.getText() === objName) {
                            return object;
                        }
                    }
                } catch (e) { null; }

                return findItem(scrollNumber + 1);
            } else {
                return undefined;
            }
        };

        const item: WebElement | undefined = await findItem(0);

        return item;
    };

    /**
     * Toggles (expand or collapse) a schema object/item on the DB Editor
     * @param objType Schema/Tables/Views/Routines/Events/Triggers/Foreign Keys/Indexes
     * @param objName Name of the object
     * @returns Promise resolving with the object
     */
    public static toggleSchemaObject = async (objType: string, objName: string): Promise<void> => {
        const obj = await this.getSchemaObject(objType, objName);
        const toggle = await obj!.findElement(locator.notebook.explorerHost.schemas.treeToggle);
        await driver.executeScript("arguments[0].click()", toggle);
        await driver.sleep(1000);
    };

    /**
     * Adds a script on the DB Editor
     * @param scriptType JS/TS/SQL
     * @returns Promise resolving with the name of the created script
     */
    public static addScript = async (scriptType: string): Promise<string> => {
        let toReturn = "";

        await driver.wait(async () => {
            try {
                const context = await driver.findElement(locator.notebook.explorerHost.scripts.exists);
                const items = await context.findElements(locator.notebook.explorerHost.scripts.script);
                await driver.executeScript(
                    "arguments[0].click()",
                    await context.findElement(locator.notebook.explorerHost.scripts.addScript),
                );
                const menu = await driver.findElement(locator.notebook.explorerHost.scripts.contextMenu.exists);

                switch (scriptType) {

                    case "JS": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addJSScript).click();
                        break;
                    }

                    case "TS": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addTSScript).click();
                        break;
                    }

                    case "SQL": {
                        await menu.findElement(locator.notebook.explorerHost.scripts.contextMenu.addSQLScript).click();
                        break;
                    }

                    default: {
                        break;
                    }

                }

                await driver.wait(async () => {
                    return (await context.findElements(locator.notebook.explorerHost.scripts.script))
                        .length > items.length;
                }, constants.wait5seconds, "No script was created");
                const entries = await context.findElements(locator.notebook.explorerHost.schemas.object);
                toReturn = await entries[entries.length - 1].getText();

                return true;
            } catch (e) {
                return false;
            }
        }, constants.wait10seconds, "No script was created");

        return toReturn;
    };

    /**
     * Checks if a script exists on the DB Editor
     * @param scriptName Script name
     * @param scriptType javascript/typescript/mysql
     * @returns Promise resolving with true if exists, false otherwise
     */
    public static existsScript = async (scriptName: string, scriptType: string):
        Promise<boolean> => {
        const context = await driver.findElement(locator.notebook.explorerHost.scripts.exists);
        const items = await context.findElements(locator.notebook.explorerHost.scripts.script);

        for (const item of items) {
            const label = await (await item.findElement(locator.notebook.explorerHost.scripts.object)).getText();
            const src = await (await item.findElement(locator.notebook.explorerHost.scripts.objectImage))
                .getAttribute("src");

            if (label === scriptName && src.indexOf(scriptType) !== -1) {
                return true;
            }
        }

        return false;
    };

    /**
     * Returns the opened editor
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public static getOpenedEditor = async (editor: string | RegExp): Promise<WebElement | undefined> => {
        const context = await driver.findElement(locator.notebook.explorerHost.openEditors.exists);
        const editors = await context.findElements(
            locator.notebook.explorerHost.openEditors.item,
        );

        for (const refEditor of editors) {

            if ((await refEditor.findElement(locator.htmlTag.label).getText()).match(editor) !== null) {
                return refEditor;
            }
        }
    };

    /**
     * Selects an editor from the drop down list on the DB Editor
     * @param editorName Editor name
     * @param editorType javascript/typescript/mysql
     * @returns Promise resolving when the select is made
     */
    public static selectCurrentEditor = async (editorName: string | RegExp, editorType: string):
        Promise<void> => {

        await driver.wait(async () => {
            try {
                const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
                await driver.executeScript("arguments[0].click()", selector);
                await driver.wait(async () => {
                    return (await driver.findElements(locator.notebook.toolbar.editorSelector.items)).length > 1;
                }, constants.wait5seconds, "No elements located on dropdown");

                const dropDownItems = await driver.findElements(locator.notebook.toolbar.editorSelector.items);

                for (const item of dropDownItems) {
                    const name = await item.findElement(locator.htmlTag.label).getText();
                    const el = await item.findElements(locator.htmlTag.img);

                    let type = "";

                    if (el.length > 0) {
                        type = await el[0].getAttribute("src");
                    } else {
                        type = await item.findElement(locator.notebook.toolbar.editorSelector.iconType)
                            .getAttribute("style");
                    }

                    if (name.match(editorName) !== null) {
                        if (type.indexOf(editorType) !== -1) {
                            await item.click();

                            return true;
                        }
                    }
                }
                throw new Error(`Could not find ${editorName} with type ${editorType}`);
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The elements were always stale selecting the editor");
    };

    /**
     * Clicks on the notebook context menu
     * @param item Context menu item name
     * @returns A promise resolving when the click is made
     */
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

    /**
     * Expand or Collapses a menu on the DB Editor
     * @param section section name (open editors/schemas/admin/scripts)
     * @param expand True to expand, false to collapse
     * @param retries number of retries to try to expand or collapse
     * @returns A promise resolving when the expand or collapse is made
     */
    public static toggleSection = async (section: string, expand: boolean,
        retries: number): Promise<void> => {
        if (retries === 3) {
            throw new Error(`Max retries reached on expanding collapse '${section}'`);
        }
        try {
            let elToClick;
            let elToVerify;

            switch (section) {

                case "open editors": {
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.openEditors.exists)
                        .findElement(locator.notebook.explorerHost.openEditors.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver.findElement(locator.notebook.explorerHost.openEditors.item);
                    break;
                }

                case "schemas": {
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.schemas.exists)
                        .findElement(locator.notebook.explorerHost.schemas.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.schemas.exists)
                        .findElement(locator.notebook.explorerHost.schemas.table);
                    break;
                }

                case "admin": {
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.administration.exists)
                        .findElement(locator.notebook.explorerHost.administration.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.administration.exists)
                        .findElement(locator.notebook.explorerHost.administration.item);
                    break;
                }

                case "scripts": {
                    elToClick = await driver
                        .findElement(locator.notebook.explorerHost.scripts.exists)
                        .findElement(locator.notebook.explorerHost.scripts.container)
                        .findElement(locator.htmlTag.label);
                    elToVerify = await driver
                        .findElement(locator.notebook.explorerHost.scripts.exists)
                        .findElements(locator.notebook.explorerHost.scripts.table);
                    if (elToVerify.length === 0) {
                        elToVerify = await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.item);
                    } else {
                        elToVerify = elToVerify[0];
                    }
                    break;
                }

                default: {
                    break;
                }
            }

            if (!expand) {

                if (await elToVerify?.isDisplayed()) {
                    await elToClick?.click();
                    await driver.wait(
                        until.elementIsNotVisible(elToVerify as WebElement),
                        constants.wait2seconds,
                        "Element is still visible",
                    );
                }
            } else {

                if (!await elToVerify?.isDisplayed()) {
                    await elToClick?.click();
                    await driver.wait(
                        until.elementIsNotVisible(elToVerify as WebElement),
                        constants.wait2seconds,
                        "Element is still visible",
                    );
                }
            }
        } catch (e) {
            await driver.sleep(1000);
            await this.toggleSection(section, expand, retries + 1);
        }
    };

    /**
     * Scrolls down on the DB Editor
     * @returns A promise resolving when the scroll is made
     */
    public static promptScrollDown = async (): Promise<void> => {
        const el = await driver.findElement(locator.notebook.codeEditor.scroll);
        await driver.executeScript("arguments[0].scrollBy(0, 5000)", el);
    };

    /**
     * Verifies if a new prompt exists on the DB Editor
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static hasNewPrompt = async (): Promise<boolean> => {
        let text: String;
        try {
            await this.promptScrollDown();
            const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
            const prompts = await context.findElements(locator.notebook.codeEditor.editor.editorPrompt);
            const lastPrompt = await prompts[prompts.length - 1]
                .findElement(locator.htmlTag.span)
                .findElement(locator.htmlTag.span);
            text = await lastPrompt.getText();
        } catch (e) {

            if (e instanceof Error) {

                if (String(e).indexOf("StaleElementReferenceError") === -1) {
                    throw new Error(String(e.stack));
                } else {
                    await driver.sleep(500);
                    const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
                    const prompts = await context
                        .findElements(locator.notebook.codeEditor.editor.editorPrompt);
                    const lastPrompt = await prompts[prompts.length - 1]
                        .findElement(locator.htmlTag.span)
                        .findElement(locator.htmlTag.span);
                    text = await lastPrompt.getText();
                }
            }
        }

        return String(text!).length === 0;
    };

    /**
     * Clicks on an item under the MySQL Administration section, on the DB Editor
     * @param item Item name
     * @returns A promise resolving when the click is made
     */
    public static clickAdminItem = async (item: string): Promise<void> => {
        const els = await driver.wait(until.elementsLocated(locator.notebook.explorerHost.administration.itemToClick),
            constants.wait5seconds, "Admin section not found");

        for (const el of els) {
            const label = await el.getText();

            if (label === item) {
                await el.click();

                return;
            }
        }
        throw new Error(`Could not find the item '${item}'`);
    };

    /**
     * Returns the current selected Editor, on the select list, on the notebook
     * @returns A promise resolving with the editor
     */
    public static getCurrentEditor = async (): Promise<string> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        const label = await selector.findElement(locator.htmlTag.label);

        return label.getText();
    };

    /**
     * Selects an Editor from the drop down list, on the DB Editor
     * @param editor The editor
     * @returns A promise resolving when the select is made
     */
    public static selectEditor = async (editor: string): Promise<void> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await selector.click();
        const items = await driver.findElements(locator.notebook.toolbar.editorSelector.items);

        for (const item of items) {
            const label = await item.findElement(locator.htmlTag.label);
            const text = await label.getAttribute("innerHTML");

            if (text === editor) {
                await item.click();

                return;
            }
        }
        throw new Error(`Could not find ${editor}`);
    };

    /**
     * Returns the opened editor
     * @param editor Editor name
     * @returns Promise resolving with the Editor
     */
    public static getOpenEditor = async (editor: string | RegExp): Promise<WebElement | undefined> => {
        const context = await driver.findElement(locator.notebook.explorerHost.openEditors.exists);
        const editors = await context.findElements(
            locator.notebook.explorerHost.openEditors.item,
        );

        for (const refEditor of editors) {
            const label = await refEditor.findElement(locator.htmlTag.label).getText();

            if (label.match(editor) !== null) {
                return refEditor;
            }
        }
    };


}
