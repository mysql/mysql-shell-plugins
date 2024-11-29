/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { error, Key, until, WebElement, Condition } from "vscode-extension-tester";
import { PasswordDialog } from "./Dialogs/PasswordDialog";
import { E2ENotebook } from "./E2ENotebook";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import { Misc, driver } from "../Misc";
import { Os } from "../Os";
import * as errors from "../errors";
import { CommandResult } from "./CommandResult";
import { Script } from "./Script";
import { E2EShellConsole } from "./E2EShellConsole";

/**
 * This class represents the code editor that exist on notebooks, scripts or shell consoles
 */
export class E2ECodeEditor {

    /** The page it belongs to (it can be a notebook, script or shell console)*/
    public parent: E2ENotebook | Script | E2EShellConsole;

    /** Collection of command result ids */
    public resultIds: string[] = [];

    public constructor(parent: E2ENotebook | Script | E2EShellConsole) {
        this.parent = parent;
    }

    /**
     * Loads the code editor command results and returns the code editor object
     * @returns The last result id
     */
    public create = async (): Promise<E2ECodeEditor> => {
        await this.loadCommandResults();

        return this;
    };

    /**
     * Gets the last result id on the editor
     * @returns The last result id
     */
    public loadCommandResults = async (): Promise<void> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        await driver.wait(async () => {
            try {
                const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
                if (results.length > 0) {
                    this.resultIds = await Promise.all(results.map(async (item: WebElement) => {
                        return (await item.getAttribute("monaco-view-zone")).match(/(\d+)/)[1];
                    }));

                    return true;
                }
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not load the command results");
    };

    /**
     * Scrolls down the code editor
     */
    public scrollDown = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const scroll = await driver.findElements(locator.notebook.codeEditor.editor.scrollBar);
        if (scroll.length > 0) {
            await driver.executeScript("arguments[0].scrollBy(0, 1500)", scroll[0]);
        }
    };

    /**
     * Verifies if a word in the last query in the editor is identified as keyword
     * @param line The line of the command
     * @returns A condition resolving to true when a keyword is found, false otherwise
     */
    public untilKeywordExists = (line: string): Condition<boolean | undefined> => {
        return new Condition("for keyword to be displayed on last editor line", async () => {
            try {
                const notebookLines = await driver.findElements(locator.notebook.codeEditor.editor.editorPrompt);
                const lastLine = notebookLines[notebookLines.length - 1];
                const words = await lastLine.findElement(locator.htmlTag.span).findElements(locator.htmlTag.span);

                const firstSpanText = (await words[0].getText()).replace(/&nbsp;/g, " ");
                const firstSpanClass = await words[0].getAttribute("class");

                if (firstSpanClass.includes("mtk56") && firstSpanText === line) {
                    return false;
                } else {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        });
    };

    /**
     * Writes a command on the editor
     *
     * @param cmd The command
     * @param ignoreKeywords True to ignore and wait for keywords to be highlighted
     * @returns A promise resolving when the command is written
     */
    public write = async (cmd: string, ignoreKeywords = false): Promise<void> => {

        const lines = cmd.split("\n").map((el) => {
            return el.trim();
        }).filter((item) => {
            return item;
        });

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            try {
                const textArea = await driver.wait(until.elementLocated(locator.notebook.codeEditor.textArea),
                    constants.wait5seconds, "Could not find the textarea");
                await this.scrollDown();
                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.currentLine),
                        constants.wait2seconds, "Current line was not found"),
                );

                const maxRetries = 2;
                let retryNumber = 0;

                for (let i = 0; i <= lines.length - 1; i++) {
                    await textArea.sendKeys(lines[i]);

                    if (!ignoreKeywords) {
                        try {
                            await driver.wait(this.untilKeywordExists(lines[i]), constants.wait3seconds);
                        } catch (e) {
                            if (retryNumber <= maxRetries) {
                                await Os.keyboardDeleteLine(lines[i]);
                                i--; // repeat the line writing
                                retryNumber++;
                                continue;
                            } else {
                                throw new Error(`Could not write line '${lines[i]}' (repeated 3 times)`);
                            }
                        }
                    }

                    await this.closeSuggestionWidget();

                    if (i !== lines.length - 1 && lines.length > 1) {
                        await this.setNewLine();
                    }

                    retryNumber = 0;
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    await this.clean();
                }
            }
        }, constants.wait15seconds, `Could not write text on the code editor (StaleElementReferenceError)`);
    };

    /**
     * Cleans the editor
     * @returns A promise resolving when the editor is cleaned
     */
    public clean = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }
        await driver.wait(async () => {
            try {
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                if (Os.isMacOs()) {
                    await textArea.sendKeys(Key.chord(Key.COMMAND, "a", "a"));
                } else {
                    await textArea.sendKeys(Key.chord(Key.CONTROL, "a", "a"));
                }

                await textArea.sendKeys(Key.BACK_SPACE);
                await driver.wait(async () => {
                    return await this.getPromptLastTextLine() === "";
                }, constants.wait5seconds, "Prompt was not cleaned");

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Editor was not cleaned");

        this.resultIds = [];
    };

    /**
     * Executes a command on the editor
     *
     * @param cmd The command
     * @param searchOnExistingId Verify the result on this result id
     * @param ignoreKeywords True to ignore the keywords
     * @returns A promise resolving when the command is executed
     */
    public execute = async (
        cmd: string,
        searchOnExistingId?: string,
        ignoreKeywords = false): Promise<interfaces.ICommandResult> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'languageSwitch()'");
        }

        await this.write(cmd, ignoreKeywords);
        await this.exec();

        let commandResult: CommandResult;

        if (this.parent instanceof Script) {
            commandResult = new CommandResult(this, cmd);
            await commandResult.loadResult(true);
        } else {
            const id = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
            commandResult = new CommandResult(this, cmd, id);
            await commandResult.loadResult();
        }

        this.resultIds.push(commandResult.id);

        return commandResult;
    };

    /**
     * Executes a command on the editor using a toolbar button
     *
     * @param cmd The command
     * @param button The button to click, to trigger the execution
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithButton = async (cmd: string, button: string, searchOnExistingId?: string):
        Promise<interfaces.ICommandResult> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.findCmdAndExecute()'");
        }

        await this.write(cmd);
        await (await this.parent.toolbar.getButton(button)).click();
        const id = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
        const commandResult = new CommandResult(this, cmd, id);
        await commandResult.loadResult();
        this.resultIds.push(commandResult.id);

        return commandResult;
    };

    /**
     * Executes a command on the editor using a context menu item
     *
     * @param cmd The command
     * @param item The context menu item to click, to trigger the execution
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithContextMenu = async (
        cmd: string,
        item: string,
        searchOnExistingId?: string): Promise<interfaces.ICommandResult> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(cmd);
        await this.clickContextItem(item);
        const id = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
        const commandResult = new CommandResult(this, cmd, id);
        await commandResult.loadResult();
        this.resultIds.push(commandResult.id);

        return commandResult;
    };

    /**
     * Executes a command on the editor, setting the credentials right after the execution is triggered
     *
     * @param cmd The command
     * @param dbConnection The DB Connection to use
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeExpectingCredentials = async (
        cmd: string,
        dbConnection: interfaces.IDBConnection,
        searchOnExistingId?: string,
    ): Promise<interfaces.ICommandResult> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(cmd);
        await this.exec();
        await PasswordDialog.setCredentials(dbConnection);
        const id = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
        const commandResult = new CommandResult(this, cmd, id);
        await commandResult.loadResult();
        this.resultIds.push(commandResult.id);

        return commandResult;
    };

    /**
     * Searches for a command on the editor, and execute it,
     * using the Exec Caret button Verify the result on this result id
     * @param cmd The command
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public findAndExecute = async (cmd: string, searchOnExistingId?: string): Promise<interfaces.ICommandResult> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.setMouseCursorAt(cmd);

        if (await this.parent.toolbar.existsButton(constants.execCaret)) {
            const toolbarButton = await this.parent.toolbar.getButton(constants.execCaret);
            await driver.executeScript("arguments[0].click()", toolbarButton);
        } else {
            const button = await this.parent.toolbar.getButton(constants.execFullBlockJs);
            await driver.executeScript("arguments[0].click()", button);
        }
        const id = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
        const commandResult = new CommandResult(this, cmd, id);
        await commandResult.loadResult();

        return commandResult;
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param waitForIncomingResult Wait for a command result that will be executed
     * @returns A promise resolving with the last cmd result
     */
    public getLastExistingCommandResult = async (waitForIncomingResult = false): Promise<interfaces.ICommandResult> => {
        let commandResult: CommandResult;

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        if (waitForIncomingResult) {
            commandResult = new CommandResult(this, undefined,
                await this.getNextResultId(this.resultIds[this.resultIds.length - 1]));
        } else {
            commandResult = new CommandResult(this);
        }

        await commandResult.loadResult();

        return commandResult;
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     *
     * @param cmd The command to change the language
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public languageSwitch = async (cmd: string, searchOnExistingId?:
        string | undefined): Promise<interfaces.ICommandResult> => {
        if (!this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.execute() or others'");
        }

        await this.write(cmd);
        await this.exec();

        if (this.parent instanceof E2EShellConsole) {
            const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultIds[this.resultIds.length - 1]);
            const commandResult = new CommandResult(this, cmd, nextId);
            await commandResult.loadResult();
            this.resultIds[this.resultIds.length - 1] = commandResult.id;

            return commandResult;
        }
    };

    /**
     * Performs the keyboard combination to execute a command on the editor
     *
     * @returns A promise resolving when the command is executed
     */
    public exec = async (): Promise<void> => {
        if (Os.isMacOs()) {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.COMMAND, Key.ENTER));
        } else {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.CONTROL, Key.ENTER));
        }
    };

    /**
     * Performs the CTRL+SPACE key combination to open the suggestions menu, on the editor
     *
     * @returns A promise resolving when the suggestions menu is opened
     */
    public openSuggestionMenu = async (): Promise<void> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));
        await driver.wait(until.elementLocated(locator.suggestWidget.exists),
            constants.wait2seconds, "The suggestions menu was not displayed");
    };

    /**
     * Sets the mouse cursor at the editor line where the specified word is
     *
     * @param word The word or command
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public setMouseCursorAt = async (word: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const mouseCursorShouldBe = await this.getLineFromWord(word);
                const lines = await driver.findElements(locator.notebook.codeEditor.editor.promptLine);
                const lineSpan = await lines[mouseCursorShouldBe].findElement(locator.htmlTag.span);
                await driver.actions().doubleClick(lineSpan).perform();

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The elements were always stale - setMouseCursorAt");
    };

    /**
     * Gets the last text on the last prompt/editor line
     * @returns A promise resolving with the text
     */
    public getPromptLastTextLine = async (): Promise<string> => {
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
    public clickContextItem = async (item: string): Promise<void> => {
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
     * Gets the line number where a word is found
     * @param wordRef The word
     * @returns A promise resolving with the line number
     */
    public getLineFromWord = async (wordRef: string): Promise<number> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const lines = await driver.findElements(locator.notebook.codeEditor.editor.promptLine);
        for (let i = 0; i <= lines.length - 1; i++) {
            const match = (await lines[i].getAttribute("innerHTML")).match(/(?<=">)(.*?)(?=<\/span>)/gm);
            if (match !== null) {
                const cmdFromEditor = match.join("").replace(/&nbsp;/g, " ");
                if (cmdFromEditor === wordRef) {
                    return i;
                }
            }
        }
        throw new Error(`Could not find '${wordRef}' in the code editor`);
    };

    /**
     * Sets a new line on the notebook editor
     * @returns A promise resolving when the new line is set
     */
    public setNewLine = async (): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const getLastLineNumber = async (): Promise<number> => {
            const lineNumbers = await driver.findElements(locator.notebook.codeEditor.editor.lineNumber);

            if (lineNumbers.length === 0) {
                return 0;
            } else {
                const numbers = await Promise.all(lineNumbers.map(async (item: WebElement) => {
                    return parseInt(await item.getAttribute("innerHTML"), 10);
                }));

                return Math.max(...numbers);
            }
        };

        await driver.wait(async () => {
            try {
                const lastLineNumber = await getLastLineNumber();
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await textArea.sendKeys(Key.RETURN);
                await driver.sleep(200);

                return driver.wait(async () => {
                    return (await getLastLineNumber()) > lastLineNumber;
                }, constants.wait150MilliSeconds)
                    .catch(() => {
                        return false;
                    });
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not set a new line on the editor");
    };

    /**
     * Gets the auto complete menu items
     * @returns A promise resolving with the menu items
     */
    public getAutoCompleteMenuItems = async (): Promise<string[]> => {
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
     * Verifies if the notebook's editor has a new prompt/line
     * @returns A condition resolving to true, if the new prompt exists, false otherwise
     */
    public untilNewPromptExists = (): Condition<boolean> => {
        return new Condition(`for editor to have a new prompt`, async () => {
            const editorSentences = await driver.findElements(locator.notebook.codeEditor.editor.sentence);

            return (await (editorSentences[editorSentences.length - 1]).getAttribute("innerHTML"))
                .match(/<span><\/span>/) !== null;
        });
    };

    /**
     * Returns true if the given text exists on the editor
     * @param text The text to search for
     * @returns A promise resolving with the truthiness of the function
     */
    public existsText = async (text: string): Promise<boolean> => {
        let isTextOnEditor = false;

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        await driver.wait(async () => {
            try {
                const regex = text
                    .replace(/\*/g, "\\*")
                    .replace(/\./g, ".*")
                    .replace(/;/g, ".*")
                    .replace(/\s/g, ".*");
                const prompts = await driver.findElements(locator.notebook.codeEditor.editor.sentence);
                for (const prompt of prompts) {
                    const html = await prompt.getAttribute("innerHTML");
                    if (html.match(new RegExp(regex)) !== null) {
                        isTextOnEditor = true;
                        break;
                    }
                }

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds);

        return isTextOnEditor;
    };


    /**
     * Checks if the command is considered as "Special". Special means the command is one of the following:
     * - \\js
     * - \\javascript
     * - \\ts
     * - \\typescript
     * - \\sql
     * - \\q
     * - \\d
     * - \\py
     * - \\python
     * @param cmd The command
     * @returns A promise resolving when the command is marked as special or not special
     */
    private isSpecialCmd = (cmd: string): boolean => {
        return (cmd.match(/(\\js|\\javascript|\\ts|\\typescript|\\sql|\\q|\\d|\\py|\\python|\\chat)/)) !== null;
    };

    /**
     * Calculates and returns the next expected result id
     * If the lastResultId is undefined, it will fetch the last existing result id from the editor,
     * and calculate the next one based on it
     * @param lastResultId The last known result id
     * @returns A promise resolving with the next result id
     */
    private getNextResultId = async (lastResultId: string): Promise<string> => {
        let resultId: string;
        if (lastResultId) {
            resultId = String(parseInt(lastResultId, 10) + 1);
        } else {
            // The code editor was cleaned
            const results = await driver.wait(until.elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                constants.wait5seconds, `Could not find results to calculate the next id`);
            const result = results[results.length - 1];
            const id = (await result.getAttribute("monaco-view-zone")).match(/(\d+)/)[1];
            resultId = String(parseInt(id, 10));
        }

        return resultId;
    };

    /**
     * Closes the suggestion widget if exists
     */
    private closeSuggestionWidget = async (): Promise<void> => {
        const suggestionsWidget = await driver.wait(until.elementLocated(locator.suggestWidget.exists),
            constants.wait150MilliSeconds).catch(() => {
                // continue
            });

        if (suggestionsWidget) {
            await driver.wait(async () => {
                try {
                    await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.ESCAPE);
                    const className = await suggestionsWidget.getAttribute("class");

                    return !className.includes("visible");
                } catch (e) {
                    if (e instanceof error.StaleElementReferenceError) {
                        return true;
                    } else {
                        throw e;
                    }
                }
            }, constants.wait3seconds, "Suggestion widget was not closed");
        }
    };
}
