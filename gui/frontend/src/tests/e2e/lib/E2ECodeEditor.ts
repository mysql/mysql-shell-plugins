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

import { error, Key, until, WebElement, Condition } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { driver } from "./driver.js";
import { Os } from "./os.js";
import { E2ECommandResultGrid } from "./CommandResults/E2ECommandResultGrid.js";
import { E2ECommandResultData } from "./CommandResults/E2ECommandResultData.js";

/**
 * This class represents the code editor that exist on notebooks, scripts or shell consoles
 */
export class E2ECodeEditor {

    /** The last command result id on the code editor. If undefined, it assumes the code editor is from a script */
    public lastResultId: number | undefined;

    public constructor(resultId?: number) {
        this.lastResultId = resultId;
    }

    /**
     * Loads the code editor command results and returns the code editor object
     * @returns The last result id
     */
    public build = async (): Promise<E2ECodeEditor> => {
        await this.setLastResultId();

        return this;
    };

    /**
     * Sets the last result id on the editor
     */
    public setLastResultId = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const results = await driver.wait(until
                    .elementsLocated(locator.notebook.codeEditor.editor.result.exists), constants.wait3seconds,
                    "Could not find any command results");
                this.lastResultId = parseInt((await results[results.length - 1].getAttribute("monaco-view-zone"))
                    .match(/(\d+)/)![1], 10);

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the command results");
    };

    /**
     * Scrolls down the code editor
     */
    public scrollDown = async (): Promise<void> => {
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
        await driver.wait(async () => {
            try {
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                if (Os.isMacOs()) {
                    await textArea.sendKeys(Key.chord(Key.COMMAND, "a", "a"));
                } else {
                    await textArea.sendKeys(Key.chord(Key.CONTROL, "a", "a"));
                }

                await textArea.sendKeys(Key.BACK_SPACE);

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Editor was not cleaned");

        await this.execute("\\about ", true);
    };

    /**
     * Builds a command result
     * @param cmd The command
     * @param resultId The result id. If not provided, it will build the last existing result on the editor
     * @returns A promise resolving with the result
     */
    public buildResult = async (
        cmd: string,
        resultId: number | undefined,
    ): Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {
        const result = await this.getResult(cmd, resultId);
        const resultType = await this.getResultType(cmd, result);

        if (this.expectTabs(cmd) === true) {
            const commandResult = new E2ECommandResultData(cmd, resultId!);
            commandResult.resultContext = result;
            await commandResult.setStatus();
            await commandResult.setTabs();

            return commandResult;
        }

        let commandResult: E2ECommandResultGrid | E2ECommandResultData | undefined;
        if (resultType === constants.isGrid) {
            commandResult = new E2ECommandResultGrid(cmd, resultId!);
            commandResult.resultContext = result;
            await commandResult.setStatus();
            await commandResult.setColumnsMap();
        } else {
            commandResult = new E2ECommandResultData(cmd, resultId!);
            commandResult.resultContext = result;

            switch (resultType) {

                case constants.isGridText: {
                    await commandResult.setText();
                    await commandResult.setStatus();
                    break;
                }

                case constants.isText: {
                    await commandResult.setText();
                    break;
                }

                case constants.isJson: {
                    await commandResult.setJson();
                    break;
                }

                case constants.isGraph: {
                    await commandResult.setGraph();
                    break;
                }

                case constants.isSqlPreview: {
                    await commandResult.setPreview();
                    break;
                }

                case constants.isHWAboutInfo: {
                    commandResult.isHWAboutInfo = true;
                    break;
                }

                case constants.isChat: {
                    await commandResult.setChat();
                    break;
                }

                default: {
                    break;
                }
            }
        }

        return commandResult;
    };

    /**
     * Refreshes a command result, rebuilding it
     * @param cmd The command
     * @param resultId The result id. If not provided, it will build the last existing result on the editor
     * @returns A promise resolving with the result
     */
    public refreshResult = async (
        cmd: string,
        resultId: number,
    ): Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        return this.buildResult(cmd, resultId);
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param waitForIncomingResult Wait for a command result that will be executed
     * @returns A promise resolving with the last cmd result
     */
    public getLastExistingCommandResult = async (
        waitForIncomingResult = false): Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        let commandResult: E2ECommandResultGrid | E2ECommandResultData | undefined;

        if (waitForIncomingResult) {
            commandResult = await this.buildResult("", this.lastResultId! + 1);
            this.lastResultId!++;
        } else {
            commandResult = await this.buildResult("", this.lastResultId);
        }

        return commandResult;
    };

    /**
     * Executes a command on the editor
     *
     * @param cmd The command
     * @param ignoreKeywords True to ignore the keywords
     * @returns A promise resolving when the command is executed
     */
    public execute = async (cmd: string, ignoreKeywords = false):
        Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {
        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'languageSwitch()'");
        }

        let commandResult: E2ECommandResultGrid | E2ECommandResultData | undefined;

        await this.write(cmd, ignoreKeywords);
        await this.exec();

        if (!this.lastResultId) { // its from a script
            commandResult = await this.buildResult(cmd, undefined);
        } else {
            commandResult = await this.buildResult(cmd, this.lastResultId + 1);
        }

        this.lastResultId!++;

        return commandResult;
    };


    /**
     * Gets the result block for an expected result id
     * When the nextId is undefined, the method will return the last existing command result on the editor
     * @param cmd The command
     * @param resultId The next expected result id. If undefined, it assumes it comes from a script
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public getResult = async (cmd?: string, resultId?: number): Promise<WebElement> => {
        let result: WebElement;

        if (resultId) {
            try {
                result = await driver.wait(until
                    .elementLocated(locator.notebook.codeEditor.editor.result
                        .existsById(String(resultId))),
                    constants.wait2seconds, `Could not find result id ${String(resultId)} for ${cmd}`);
            } catch (e) {
                if (e instanceof error.TimeoutError) {
                    const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);

                    if (results.length > 0) {
                        const lastId = await results[results.length - 1].getAttribute("monaco-view-zone");
                        // eslint-disable-next-line max-len
                        console.log(`[DEBUG] Could not find result id ${String(resultId)} for ${cmd}. Last id found: ${lastId}`);
                        this.lastResultId = parseInt(lastId.match(/(\d+)/)![1], 10);

                        result = results[results.length - 1];
                    } else {
                        throw new Error("[DEBUG] No results at all were found on the notebook");
                    }
                } else {
                    throw e;
                }

            }
        } else {
            return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script),
                constants.wait5seconds, `Could not find any script result, for cmd ${cmd}. Maybe this is a notebook?`);
        }

        await this.scrollDown();

        return result!;
    };

    /**
     * Gets the result type
     * @param cmd The command
     * @param context The context
     * @returns A promise resolving with the result type
     */
    public getResultType = async (cmd: string | undefined, context: WebElement): Promise<string> => {
        let type = "";

        const resultLocator = locator.notebook.codeEditor.editor.result;
        await driver.wait(async () => {
            if ((await context.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                ((await context.findElements(resultLocator.singleOutput.text.exists)).length > 0) &&
                ((await context.findElements(resultLocator.grid.status)).length > 0) &&
                (await context.findElements(resultLocator.json.pretty)).length === 0) {
                type = constants.isGridText;
            }

            if ((await context.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                ((await context.findElements(resultLocator.singleOutput.text.exists)).length > 0) &&
                (await context.findElements(resultLocator.grid.status)).length === 0 &&
                (await context.findElements(resultLocator.json.pretty)).length === 0) {
                type = constants.isText;
            }

            if ((await context.findElements(resultLocator.singleOutput.exists)).length > 0 &&
                (((await context.findElements(resultLocator.json.pretty)).length > 0) ||
                    (await context.findElements(resultLocator.json.raw)).length > 0)
            ) {
                type = constants.isJson;
            }

            if ((await context.findElements(resultLocator.graphHost.exists)).length > 0) {
                type = constants.isGraph;
            }

            if ((await context.findElements(resultLocator.grid.exists)).length > 0) {
                type = constants.isGrid;
            }

            if ((await context
                .findElements(locator.notebook.codeEditor.editor.result.previewChanges.exists)).length > 0) {
                type = constants.isSqlPreview;
            }

            if ((await context.findElements(resultLocator.chat.aboutInfo)).length > 0) {
                type = constants.isHWAboutInfo;
            }

            if ((await context.findElements(resultLocator.chat.isProcessingResult)).length > 0) {
                type = constants.isChat;
            }

            if (type !== "") {
                return true;
            }
        }, constants.wait5seconds, `Could not get the result type for ${cmd}`);

        return type;
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     *
     * @param cmd The command to change the language
     * @returns A promise resolving when the command is executed
     */
    public languageSwitch = async (cmd: string): Promise<void> => {
        if (!this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.execute() or others'");
        }

        await this.write(cmd);
        await this.exec();
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
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The elements were always stale - setMouseCursorAt");
    };

    /**
     * Sets a new line on the notebook editor
     * @returns A promise resolving when the new line is set
     */
    public setNewLine = async (): Promise<void> => {
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
                if (!(e instanceof error.StaleElementReferenceError)) {
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
                if (!(e instanceof error.StaleElementReferenceError)) {
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
    public isSpecialCmd = (cmd: string): boolean => {
        return (cmd.match(/(\\js|\\javascript|\\ts|\\typescript|\\sql|\\q|\\d|\\py|\\python|\\chat)/)) !== null;
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

    /**
     * Gets the line number where a word is found
     * @param wordRef The word
     * @returns A promise resolving with the line number
     */
    private getLineFromWord = async (wordRef: string): Promise<number> => {
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
     * Returns true if it is expected that the given command will return a result with tabs (ex. Multiple
     * select queries)
     * @param cmd The command
     * @returns A promise resolving with true if there are tabs expected, false otherwise
     */
    private expectTabs = (cmd: string): boolean => {
        if (cmd) {
            const selectMatch = cmd.match(/(select|SELECT)/g);
            const matchSpecial = cmd.match(/(UNION|INTERSECT|EXCEPT|for update|\()/g);
            if (selectMatch && selectMatch.length > 1) { // more than 1 select
                if (matchSpecial) {
                    return false;
                } else {
                    return true;
                }

            } else {
                return false;
            }
        } else {
            return false;
        }
    };

}
