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
import { WebElement, until, Key, error } from "vscode-extension-tester";
import { basename } from "path";
import { driver, Misc } from "../misc";
import * as constants from "../constants";
import * as locator from "../locators";

export class Notebook {

    /**
     * Gets the last text on the last prompt/editor line
     * @returns A promise resolving with the text
     */
    public static getPromptLastTextLine = async (): Promise<String> => {
        if ((await Misc.insideIframe()) === false) {
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
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the text from last promtp line");

        return sentence;
    };

    /**
     * Clicks on a context menu item
     * @param item The item
     * @returns A promise resolving when the click is performed
     */
    public static clickContextItem = async (item: string): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
                if (!(e instanceof error.StaleElementReferenceError)) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

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
    public static widgetGetReplacerButton = async (button: string): Promise<WebElement | undefined> => {
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
        if ((await Misc.insideIframe()) === false) {
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
            if (e instanceof error.StaleElementReferenceError) {
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
        if ((await Misc.insideIframe()) === false) {
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
     * Verifies if a query result is maximezed
     * @returns A promise resolving with true if the query is maximized, false otherwise
     */
    public static isResultMaximized = async (): Promise<boolean> => {
        if ((await Misc.insideIframe()) === false) {
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
     * @returns A promise resolving when the editor is selected
     */
    public static selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(locator.notebook.toolbar.editorSelector.item)).length >= 1;
        }, 2000, "No elements located on editors dropdown list");

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

    /**
     * Verifies if a sql and result status exist on the notebook
     * @param sql The sql query
     * @param resultStatus The result status
     * @returns A promise resolving when the notebook is verified
     */
    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

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

    /**
     * Verifies if a word exists on the notebook
     * @param word The word
     * @returns A promise resolving with true if the word is found, false otherwise
     */
    public static existsOnNotebook = async (word: string): Promise<boolean> => {
        if ((await Misc.insideIframe()) === false) {
            await Misc.switchToFrame();
        }

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
}
