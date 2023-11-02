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

import {
    error,
    Key, until,
    WebElement,
} from "vscode-extension-tester";
import { Database } from "./db";
import * as constants from "./constants";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { Misc, driver } from "./misc";
import * as Until from "./until";

/**
 * This class aggregates the functions that will execute commands on notebooks or shell sessions, as well as its results
 */
export class CommandExecutor {

    /**
     * Writes a command on the editor
     *
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving when the command is written
     */
    public static write = async (cmd: string, slowWriting?: boolean): Promise<void> => {
        await driver.wait(async () => {
            try {
                const textArea = await driver.wait(until.elementLocated(locator.notebook.codeEditor.textArea),
                    constants.wait5seconds, "Could not find the textarea");
                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.findElement(locator.notebook.codeEditor.editor.currentLine),
                );
                const lines = cmd.split("\n");
                if (slowWriting) {
                    for (let i = 0; i <= lines.length - 1; i++) {
                        lines[i] = lines[i].trim();
                        const letters = lines[i].split("");
                        for (const letter of letters) {
                            await textArea.sendKeys(letter);
                            await driver.sleep(10);
                        }
                        if (i !== lines.length - 1 && lines.length > 1) {
                            await Database.setNewLineOnEditor();
                        }
                    }

                } else {
                    for (let i = 0; i <= lines.length - 1; i++) {
                        await textArea.sendKeys(lines[i].trim());
                        if (i !== lines.length - 1 && lines.length > 1) {
                            await Database.setNewLineOnEditor();
                        }
                    }
                }

                return CommandExecutor.isTextOnEditor(lines[0]);
            } catch (e) {
                if (e instanceof error.ElementNotInteractableError) {
                    const editorLines = await driver.findElements(locator.notebook.codeEditor.editor.currentLine);
                    await editorLines[editorLines.length - 1].click();
                } else {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Text area was not interactable");

        await driver.wait(until.elementLocated(locator.suggestWidget.exists), constants.wait150MiliSeconds)
            .then(async () => {
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await textArea.sendKeys(Key.ESCAPE);
            })
            .catch(() => {
                // continue
            });
    };

    /**
     * Executes a command on the editor
     *
     * @param cmd The command
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param slowWriting True if the command should be written with a delay between each character
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static execute = async (cmd: string, lastResultId?: string, slowWriting = false,
        checkOnResultId = undefined,
    ): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.languageSwitch()'");
        }

        if (checkOnResultId) {
            nextResultId = checkOnResultId;
        } else {
            nextResultId = await CommandExecutor.getNextResultId(lastResultId);
        }
        await CommandExecutor.write(cmd, slowWriting);
        await CommandExecutor.exec();

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, cmd)).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

        return cmdResult;
    };

    /**
     * Executes a command on the editor using a toolbar button
     *
     * @param cmd The command
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param button The button to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static executeWithButton = async (cmd: string, lastResultId: string, button: string,
        slowWriting = false,
        checkOnResultId = undefined): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.languageSwitch()'");
        }
        if (button === constants.execCaret) {
            throw new Error("Please use the function 'CommandExecutor.findCmdAndExecute()'");
        }

        if (checkOnResultId) {
            nextResultId = checkOnResultId;
        } else {
            nextResultId = await CommandExecutor.getNextResultId(lastResultId);
        }

        await CommandExecutor.write(cmd, slowWriting);
        await (await Database.getToolbarButton(button)).click();

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, cmd)).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

        return cmdResult;

    };

    /**
     * Executes a command on the editor using a context menu item
     *
     * @param cmd The command
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param item The context menu item to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static executeWithContextMenu = async (cmd: string, lastResultId: string, item: string,
        slowWriting = false, checkOnResultId = undefined): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.languageSwitch()'");
        }

        if (checkOnResultId) {
            nextResultId = checkOnResultId;
        } else {
            nextResultId = await CommandExecutor.getNextResultId(lastResultId);
        }

        await CommandExecutor.write(cmd, slowWriting);
        await Database.clickContextItem(item);

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, cmd)).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

        return cmdResult;

    };

    /**
     * Executes a command on the editor, setting the credentials right after the execution is triggered
     *
     * @param cmd The command
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param dbConnection The DB Connection to use
     * @param slowWriting True if the command should be written with a delay between each character
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static executeExpectingCredentials = async (cmd: string, lastResultId: string,
        dbConnection: interfaces.IDBConnection, slowWriting = false, checkOnResultId = undefined,
    ): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.languageSwitch()'");
        }

        if (checkOnResultId) {
            nextResultId = checkOnResultId;
        } else {
            nextResultId = await CommandExecutor.getNextResultId(lastResultId);
        }

        await CommandExecutor.write(cmd, slowWriting);
        await CommandExecutor.exec();
        await Database.setDBConnectionCredentials(dbConnection);

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        await driver.sleep(300);
        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, cmd)).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

        return cmdResult;
    };

    /**
     * Searches for a command on the editor, and execute it, using the Exec Caret button on SQL commands,
     * and Execute block button on scripts
     *
     * @param cmd The command
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static findCmdAndExecute = async (cmd: string, lastResultId: string, checkOnResultId = undefined,
    ): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.languageSwitch()'");
        }

        if (checkOnResultId) {
            nextResultId = checkOnResultId;
        } else {
            nextResultId = await CommandExecutor.getNextResultId(lastResultId);
        }

        await CommandExecutor.setMouseCursorAt(cmd);

        if (await Database.existsToolbarButton(constants.execCaret)) {
            const toolbarButton = await Database.getToolbarButton(constants.execCaret);
            await toolbarButton.click();
            await driver.wait(Until.toolbarButtonIsDisabled(constants.execCaret), constants.wait5seconds);
            await driver.wait(Until.toolbarButtonIsEnabled(constants.execCaret), constants.wait5seconds);
        } else {
            await (await Database.getToolbarButton(constants.execFullBlockJs)).click();
        }

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, cmd)).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

        return cmdResult;
    };

    /**
     * Returns the last existing command result on the editor
     *
     * @param resultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @returns A promise resolving when the command is executed
     */
    public static getLastExistingCmdResult = async (resultId?: string): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;
        if (resultId) {
            nextResultId = await CommandExecutor.getNextResultId(resultId);
        }

        const cmdResult: interfaces.ICommandResult = {
            id: undefined,
            message: undefined,
            toolbar: undefined,
            content: undefined,
        };

        cmdResult.id = await (await CommandExecutor.getResult(nextResultId, "")).getAttribute("monaco-view-zone");
        cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, "");
        cmdResult.content = await CommandExecutor.getResultContent(nextResultId, "");
        cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, "");

        return cmdResult;
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     *
     * @param cmd The command to change the language
     * @param lastResultId The last known result id (for previsous command executions).
     * This parameter ensures the current command result is processed, since it will search for the next expected
     * result id.
     * @param slowWriting True if the command should be written with a delay between each character
     * @param checkOnResultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public static languageSwitch = async (cmd: string, lastResultId?: string, slowWriting = false,
        checkOnResultId = undefined): Promise<interfaces.ICommandResult> => {

        let nextResultId: string;

        if (!CommandExecutor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'CommandExecutor.execute() or others'");
        }

        if ((await CommandExecutor.isShellSession()) === true) {
            if (checkOnResultId) {
                nextResultId = checkOnResultId;
            } else {
                nextResultId = await CommandExecutor.getNextResultId(lastResultId);
            }
        }

        await CommandExecutor.write(cmd, slowWriting);
        await CommandExecutor.exec();

        if ((await CommandExecutor.isShellSession()) === true) {
            const cmdResult: interfaces.ICommandResult = {
                id: undefined,
                message: undefined,
                toolbar: undefined,
                content: undefined,
            };

            cmdResult.id = await (await CommandExecutor.getResult(nextResultId, "")).getAttribute("monaco-view-zone");
            cmdResult.message = await CommandExecutor.getResultMsg(nextResultId, cmd);
            cmdResult.content = await CommandExecutor.getResultContent(nextResultId, cmd);
            cmdResult.toolbar = await CommandExecutor.getResultToolbar(nextResultId, cmd);

            return cmdResult;
        } else {
            return undefined;
        }
    };

    /**
     * Performs the keyboard combination to execute a command on the editor
     *
     * @returns A promise resolving when the command is executed
     */
    public static exec = async (): Promise<void> => {
        if (Misc.isMacOs()) {
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
    public static openSuggestionMenu = async (): Promise<void> => {
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
    private static setMouseCursorAt = async (word: string): Promise<void> => {
        const mouseCursorIs = await Database.getMouseCursorLine();
        const mouseCursorShouldBe = await Database.getLineFromWord(word);
        const taps = mouseCursorShouldBe - mouseCursorIs;
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        if (taps > 0) {
            for (let i = 0; i < taps; i++) {
                await textArea.sendKeys(Key.ARROW_DOWN);
            }
        } else if (taps < 0) {
            for (let i = 0; i < Math.abs(taps); i++) {
                await textArea.sendKeys(Key.ARROW_UP);
            }
        }
    };

    /**
     * Checks if the command is consideres as "Special". Special means the command is one of the following:
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
    private static isSpecialCmd = (cmd: string): boolean => {
        return (cmd.match(/(\\js|\\javascript|\\ts|\\typescript|\\sql|\\q|\\d|\\py|\\python)/)) !== null;
    };

    /**
     * Returns the result block for an expected result id
     * When the nextId is undefined, the method will return the last existing comand result on the editor
     * @param nextId The next expected result id
     * @param cmd The command
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    private static getResult = async (nextId: string, cmd: string): Promise<WebElement> => {
        let result: WebElement;
        if (!nextId) { // if the editor was cleaned, return the latest result block
            const results = await driver.wait(until
                .elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                constants.wait5seconds, `Could not find last result for cmd ${cmd}`);
            result = results[results.length - 1];
        } else { // if the editor was not cleaned, search for the expected next result id
            result = await driver.wait(until
                .elementLocated(locator.notebook.codeEditor.editor.result.existsById(String(nextId))),
                constants.wait15seconds, `Could not find result id ${String(nextId)} for cmd ${cmd}`);
        }

        return result;
    };

    /**
     * Returns the message as a result of a command execution
     * If the command was a SQL query, it will return the status (ex. OK, 1 record retrieved)
     * If the command is a non SQL query, it will return the message that resulted of the command execution
     * @param id The result id to search for
     * @param cmd The command
     * @returns A promise resolving with the result message
     */
    private static getResultMsg = async (id: string, cmd: string): Promise<string | undefined> => {
        let result: WebElement;
        let resultToReturn: string;
        await driver.wait(async () => {
            try {
                result = await CommandExecutor.getResult(id, cmd);
                // select
                const statusResult = await result.findElements(locator.notebook.codeEditor.editor.result.status.text);
                // insert / delete / drop / call procedures
                // shell session text
                const textResult = await result.findElements(locator.notebook.codeEditor.editor.result.text);
                // python
                const jsonResult = await result.findElements(locator.notebook.codeEditor.editor.result.json.field);
                // python graph
                const resultGraph = await result
                    .findElements(locator.notebook.codeEditor.editor.result.graphHost.exists);
                // shell session
                const resultMsg = await result.findElements(locator.notebook.codeEditor.editor.result.status.message);
                const resultOutput = await result.findElements(locator.shellSession.result.outputText);

                if (statusResult.length > 0) {
                    resultToReturn = await statusResult[statusResult.length - 1].getText();
                } else if (textResult.length > 0) {
                    if (cmd.match(/export/) !== null) {
                        await driver.wait(async () => {
                            return (await textResult[textResult.length - 1].getText())
                                .match(/The dump can be loaded using/) !== null;
                        }, constants.wait5seconds, "Could not find on result 'The dump can be loaded using'");
                    } else if (cmd.match(/\\c.*@.*/) !== null) {
                        await driver.wait(async () => {
                            resultToReturn = await textResult[textResult.length - 1].getText();

                            return resultToReturn.match(/schema/) !== null;
                        }, constants.wait5seconds, "Could not find on result ' .'");
                    }
                    resultToReturn = await textResult[textResult.length - 1].getText();
                } else if (jsonResult.length > 0) {
                    resultToReturn = await jsonResult[jsonResult.length - 1].getText();
                } else if (resultGraph.length > 0) {
                    resultToReturn = "graph";
                } else if (resultMsg.length > 0) {
                    resultToReturn = await resultMsg[resultMsg.length - 1].getText();
                } else if (resultOutput.length > 0) {
                    for (const output of resultOutput) {
                        resultToReturn += await output.getText();
                    }
                }
                if (resultToReturn !== undefined) {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Could not find the result message");

        return resultToReturn;
    };

    /**
     * Returns the content as a result of a command execution
     * If the command was a SQL query with a SELECT statement, it will return the data set
     * If the command was a SQL query with multiples SELECT statements, it will return the data set for each one,
     * as a @string representation.
     * It can return JSON or Graphs or even text
     * @param id The result id to search for
     * @param cmd The command
     * @returns A promise resolving with the result content
     */
    private static getResultContent = async (id: string, cmd: string):
        Promise<WebElement | interfaces.ICommandTabResult[]> => {

        let result: WebElement;
        let resultContent: WebElement | interfaces.ICommandTabResult[];

        try {
            await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.hasContent),
                constants.wait150MiliSeconds);
        } catch (e) {
            return undefined;
        }

        await driver.wait(async () => {
            try {
                result = await CommandExecutor.getResult(id, cmd);
                if (CommandExecutor.expectResultTabs(cmd)) {
                    await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.tabSection.exists),
                        constants.wait5seconds, `A result tab should exist for cmd ${cmd}`);
                }

                const isTabResult = (await result
                    .findElements(locator.notebook.codeEditor.editor.result.tabSection.exists)).length > 0;
                const isTableResult = (await result.findElements(locator.notebook.codeEditor.editor.result.table))
                    .length > 0;
                const isJsonResult = (await result
                    .findElements(locator.notebook.codeEditor.editor.result.json.exists))
                    .length > 0;
                const isGraphResult = (await result
                    .findElements(locator.notebook.codeEditor.editor.result.graphHost.exists)).length > 0;
                const isText = (await result
                    .findElements(locator.notebook.codeEditor.editor.result.text)).length > 0;
                const isOutput = (await result.findElements(locator.notebook.codeEditor.editor.result.singleOutput))
                    .length > 0;

                if (isTabResult) {
                    resultContent = [];
                    const tabs = await result.findElements(locator.notebook.codeEditor.editor.result.tabSection.tab);
                    for (const tab of tabs) {
                        const resultTableRows = await result
                            .findElement(locator.notebook.codeEditor.editor.result.tableRows);
                        await tab.click();
                        await driver.wait(until.stalenessOf(resultTableRows), constants.wait2seconds,
                            "Result table was not updated");
                        await driver.wait(Until.elementLocated(result,
                            locator.notebook.codeEditor.editor.result.tableHeaders),
                            constants.wait2seconds, "Result Table headers were not loaded");
                        await driver.wait(Until.elementLocated(result,
                            locator.notebook.codeEditor.editor.result.tableCell),
                            constants.wait2seconds, "Table cells were not loaded").catch(async () => {
                                const result = await CommandExecutor.getResult(id, cmd);
                                await result.findElement(locator.notebook.codeEditor.editor.result.tableColumnTitle)
                                    .click();
                                await driver.wait(Until
                                    .elementLocated(result, locator.notebook.codeEditor.editor.result.tableCell),
                                    constants.wait2seconds, `Table cell was not set after click on column title (bug)`);
                            });
                        resultContent.push({
                            tabName: await tab.getText(),
                            content: await (await result.findElement(locator.notebook.codeEditor.editor.result.table))
                                .getAttribute("innerHTML"),
                        });
                    }
                } else if (isTableResult) {
                    await driver.wait(Until.elementLocated(result,
                        locator.notebook.codeEditor.editor.result.tableHeaders),
                        constants.wait2seconds, "Table headers were not loaded");
                    await driver.wait(Until.elementLocated(result,
                        locator.notebook.codeEditor.editor.result.tableCell),
                        constants.wait2seconds, "Table cells were not loaded").catch(async () => {
                            const result = await CommandExecutor.getResult(id, cmd);
                            await result.findElement(locator.notebook.codeEditor.editor.result.tableColumnTitle)
                                .click();
                            await driver.wait(Until
                                .elementLocated(result, locator.notebook.codeEditor.editor.result.tableCell),
                                constants.wait2seconds, `Table cell was not set after click on column title (bug)`);
                        });
                    resultContent = await result.findElement(locator.notebook.codeEditor.editor.result.table);
                } else if (isJsonResult) {
                    resultContent = await result.findElement(locator.notebook.codeEditor.editor.result.json.exists);
                } else if (isGraphResult) {
                    resultContent = await result
                        .findElement(locator.notebook.codeEditor.editor.result.graphHost.exists);
                } else if (isText) {
                    resultContent = await result.findElement(locator.notebook.codeEditor.editor.result.text);
                } else if (isOutput) {
                    return true;
                }
                if (resultContent !== undefined) {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, `Could not return the result content for cmd ${cmd}`);

        return resultContent;
    };

    /**
     * Returns the toolbar of a SQL query result
     * @param id The result id to search for
     * @param cmd The command
     * @returns A promise resolving with the result toolbar
     */
    private static getResultToolbar = async (id: string, cmd: string): Promise<WebElement> => {
        let toolbar: WebElement;
        if ((await CommandExecutor.isShellSession()) === false) {
            await driver.wait(async () => {
                try {
                    const result = await CommandExecutor.getResult(id, cmd);
                    const hasTableResult = (await result.findElements(locator.notebook.codeEditor.editor.result.table))
                        .length > 0;
                    if (hasTableResult) {
                        toolbar = result.findElement(locator.notebook.codeEditor.editor.result.status.toolbar);
                    }

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, `Could not get the result toolbar for cmd ${cmd}`);
        }

        return toolbar;
    };

    /**
     * Calculates and returns the next expected result id
     * If the lastResultId is undefined, it will fectch the last existing result id from the editor,
     * and calculate the next one based on it
     * @param lastResultId The last known result id
     * @returns A promise resolving with the next result id
     */
    private static getNextResultId = async (lastResultId: string): Promise<string> => {
        let resultId: string;
        const getNext = (item: string): string => {
            const letter = item.match(/[a-zA-Z]/)[0];
            const id = item.match(/(\d+)/)[0];
            const nextId = parseInt(id, 10) + 1;

            return `${letter}${nextId}`;
        };

        if (lastResultId) {
            resultId = getNext(lastResultId);
        } else {
            const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
            // the editor may not have any previous results at all
            if (results.length > 0) {
                const result = results[results.length - 1];
                resultId = getNext(await result.getAttribute("monaco-view-zone"));
            }
        }

        return resultId;
    };

    /**
     * Returns true if the context is within a shell session
     * @returns A promise resolving with the truthiness of the function
     */
    private static isShellSession = async (): Promise<boolean> => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    };

    /**
     * Returns true if the given text exists on the editor
     * @param text The text to search for
     * @returns A promise resolving with the truthiness of the function
     */
    private static isTextOnEditor = async (text: string): Promise<boolean> => {
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
                    if (html.match(new RegExp(regex)) !== undefined) {
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
     * Returns true if it is expected that the given command will return a result with tabs (ex. Multiple
     * select queries)
     * @param cmd The command
     * @returns A promise resolving with the truthiness of the function
     */
    private static expectResultTabs = (cmd: string): boolean => {
        if (cmd) {
            const match = cmd.match(/(select|SELECT)/g);
            if (match) {
                return match.length > 1;
            }
        }

        return false;
    };

}
