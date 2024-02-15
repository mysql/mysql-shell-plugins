/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
import { WebElement, until, Key } from "vscode-extension-tester";
import { basename } from "path";
import { driver, Misc } from "../misc";
import * as constants from "../constants";
import * as locator from "../locators";
import * as errors from "../errors";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class Notebook {

    /**
     * Gets the last text on the last prompt/editor line
     * @returns A promise resolving with the text
     */
    public static getPromptLastTextLine = async (): Promise<String> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the text from last prompt line");

        return sentence;
    };

    /**
     * Clicks on a context menu item
     * @param item The item
     * @returns A promise resolving when the click is performed
     */
    public static clickContextItem = async (item: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, constants.wait5seconds, `Expected context menu for "${item}" was not displayed`);

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
        }, constants.wait5seconds, `Unexpected context menu continues displayed after selecting "${item}"`);
    };

    /**
     * Verifies if a toolbar button exists
     * @param button The button
     * @returns A promise resolving with true if the button exists, false otherwise
     */
    public static existsToolbarButton = async (button: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
     * Gets the line number where the mouse cursor is
     * @returns A promise resolving with the line number
     */
    public static getMouseCursorLine = async (): Promise<number> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }
        const lines = await driver.findElements(locator.notebook.codeEditor.editor.lines);
        for (let i = 0; i <= lines.length - 1; i++) {
            const curLine = await lines[i].findElements(locator.notebook.codeEditor.editor.currentLine);
            if (curLine.length > 0) {
                return i;
            }
        }
    };

    /**
     * Gets the line number where a word is found
     * @param wordRef The word
     * @returns A promise resolving with the line number
     */
    public static getLineFromWord = async (wordRef: string): Promise<number> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
        throw new Error(`Could not find '${wordRef}' in the code editor`);
    };

    /**
     * Gets a toolbar button
     * @param button The button name
     * @returns A promise resolving with the button
     */
    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
     * Sets a new line on the notebook editor
     * @returns A promise resolving when the new line is set
     */
    public static setNewLineOnEditor = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not set a new line on the editor");
    };

    /**
     * Toggles the find in selection on the find widget
     * @param flag True to enable, false otherwise
     * @returns A promise resolving when button is clicked
     */
    public static widgetFindInSelection = async (flag: boolean): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const toggleReplace = await findWidget.findElement(locator.findWidget.toggleReplace);
        const isExpanded = (await findWidget.findElements(locator.findWidget.toggleReplaceExpanded)).length > 0;
        if (expand) {
            if (!isExpanded) {
                await driver.executeScript("arguments[0].click()", toggleReplace);
            }
        } else {
            if (isExpanded) {
                await driver.executeScript("arguments[0].click()", toggleReplace);
            }
        }
    };

    /**
     * Gets the replacer buttons by their name (Replace, Replace All)
     * @param button The button name
     * @returns A promise resolving when button is returned
     */
    public static widgetGetReplacerButton = async (button: string): Promise<WebElement | undefined> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const findWidget = await driver.wait(until.elementLocated(locator.findWidget.exists), constants.wait5seconds);
        const replaceActions = await findWidget.findElements(locator.findWidget.replaceActions);
        for (const action of replaceActions) {
            if ((await action.getAttribute("title")).indexOf(button) !== -1) {
                return action;
            }
        }
    };

    /**
     * Closes the widget finder
     * @returns A promise resolving when finder is closed
     */
    public static widgetCloseFinder = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            const findWidget = await driver.findElements(locator.findWidget.exists);
            if (findWidget.length > 0) {
                const closeButton = await findWidget[0].findElement(locator.findWidget.close);
                await driver.executeScript("arguments[0].click()", closeButton);

                return (await driver.findElements(locator.findWidget.exists)).length === 0;
            } else {
                return true;
            }
        }, constants.wait5seconds, "The finder widget was not closed");
    };

    /**
     * Gets the type of the current editor
     * @returns A promise resolving with the editor type
     */
    public static getCurrentEditorType = async (): Promise<string> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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

    /**
     * Gets the name of the current editor
     * @returns A promise resolving with the editor name
     */
    public static getCurrentEditorName = async (): Promise<string> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const getData = async (): Promise<string> => {
            const selector = await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
                constants.wait5seconds, "Unable to get the current editor: not found");
            const label = await selector.findElement(locator.htmlTag.label);

            return label.getText();
        };

        let result: string;
        try {
            result = await getData();
        } catch (e) {
            if (errors.isStaleError(e as Error)) {
                result = await getData();
            } else {
                throw e;
            }
        }

        return result;
    };

    /**
     * Gets the auto complete menu items
     * @returns A promise resolving with the menu items
     */
    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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

    /**
     * Verifies if a query result is maximized
     * @returns A promise resolving with true if the query is maximized, false otherwise
     */
    public static isResultMaximized = async (): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const editor = await driver.findElement(locator.notebook.codeEditor.editor.host);
        const style = await editor.getCssValue("height");
        const height = parseInt(style.trim().replace("px", ""), 10);

        return height > 0;
    };

    /**
     * Selects the current editor
     * @param editorName The editor name
     * @param editorType The editor type
     * @param occurrenceNumber The occurrence number. Default is 1,
     * which means that it will return the first element found. If 2, it will return the second.
     * @returns A promise resolving when the editor is selected
     */
    public static selectCurrentEditor = async (editorName: RegExp, editorType: string,
        occurrenceNumber = 1): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(locator.notebook.toolbar.editorSelector.item)).length >= 1;
        }, constants.wait2seconds, "No elements located on editors dropdown list");

        const dropDownItems = await driver.findElements(locator.notebook.toolbar.editorSelector.item);
        let occurrences = 0;
        let item2click = -1;

        for (let i = 0; i <= dropDownItems.length - 1; i++) {
            const name = await dropDownItems[i].findElement(locator.htmlTag.label).getText();
            const el = await dropDownItems[i].findElements(locator.htmlTag.img);
            let type = "";
            if (el.length > 0) {
                type = await el[0].getAttribute("src");
            } else {
                type = await dropDownItems[i].findElement(locator.notebook.toolbar.editorSelector.itemIcon)
                    .getAttribute("style");
            }

            if (name.match(editorName) !== null) {
                if (type.indexOf(editorType) !== -1) {
                    occurrences++;
                    if (occurrences === occurrenceNumber) {
                        item2click = i;

                        break;
                    }
                }
            }
        }

        if (item2click === -1) {
            throw new Error(`Could not find ${editorName}, type ${editorType} on the select list`);
        }

        await (await driver.findElements(locator.notebook.toolbar.editorSelector.item))[item2click].click();
    };

    /**
     * Verifies if a sql and result status exist on the notebook
     * @param sql The sql query
     * @param resultStatus The result status
     * @returns A promise resolving when the notebook is verified
     */
    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const notebookCommands: string[] = [];
        await driver.wait(async () => {
            try {
                const commands = await driver.wait(
                    until.elementsLocated(locator.notebook.codeEditor.editor.sentence),
                    constants.wait5seconds, "No lines were found");
                for (const cmd of commands) {
                    const spans = await cmd.findElements(locator.htmlTag.span);
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    notebookCommands.push(sentence);
                }

                return commands.length > 0;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");


        if (!notebookCommands.includes(sql)) {
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

    /**
     * Verifies if a word exists on the notebook
     * @param word The word
     * @returns A promise resolving with true if the word is found, false otherwise
     */
    public static existsOnNotebook = async (word: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const commands: string[] = [];
        const regex = word
            .replace(/\*/g, "\\*")
            .replace(/\./g, ".*")
            .replace(/;/g, ".*")
            .replace(/\s/g, ".*");
        await driver.wait(async () => {
            try {
                const notebookCommands = await driver.wait(
                    until.elementsLocated(locator.notebook.codeEditor.editor.sentence),
                    constants.wait5seconds, "No lines were found");
                for (const cmd of notebookCommands) {
                    const spans = await cmd.findElements(locator.htmlTag.span);
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    commands.push(sentence);
                }

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");

        return commands.toString().match(regex) !== null;
    };

    /**
     * Scrolls down the notebook
     */
    public static scrollDown = async (): Promise<void> => {
        await driver.executeScript("arguments[0].scrollBy(0, 1500)",
            await driver.findElement(locator.notebook.codeEditor.editor.scrollBar));
    };

}
