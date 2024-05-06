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

import { until, Key, WebElement, error } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import * as interfaces from "../lib/interfaces.js";
import * as constants from "../lib/constants.js";
import { DBNotebooks } from "../lib/dbNotebooks.js";
import { OpenConnectionDialog } from "./openConnectionDialog.js";
import { platform } from "os";
import * as waitUntil from "./until.js";
import { Misc } from "./misc.js";
import { driver } from "../lib/driver.js";
import { Os } from "./os.js";

/**
 * This class aggregates the functions that will execute commands on notebooks or shell sessions, as well as its results
 */
export class CommandExecutor {

    /** monaco-view-zone id number*/
    private resultId: string | undefined = "";

    /** Data set result message. Eg. OK, 1 record retrieved, or shell command result */
    private message = "";

    /** Data set or json result set or multiple queries result sets */
    private content: WebElement | interfaces.ICommandTabResult[];

    /** Toolbar of a data set */
    private toolbar: WebElement;

    /** The last executed command */
    private command: string;

    public constructor() {
        this.resultId = "1";
    }

    /**
     * Sets the last known result id to undefined, to force the command executor to grab the first id on the editor
     */
    public reset = (): void => {
        this.resultId = undefined;
    };

    /**
     * Writes a command on the editor
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving when the command is written
     */
    public write = async (cmd: string, slowWriting?: boolean): Promise<void> => {
        this.command = cmd;
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
                            await DBNotebooks.setNewLineOnEditor();
                        }
                    }

                } else {
                    for (let i = 0; i <= lines.length - 1; i++) {
                        await textArea.sendKeys(lines[i].trim());
                        if (i !== lines.length - 1 && lines.length > 1) {
                            await DBNotebooks.setNewLineOnEditor();
                        }
                    }
                }

                return this.isTextOnEditor(lines[0]);
            } catch (e) {

                if (e instanceof error.ElementNotInteractableError) {
                    const editorLines = await driver.findElements(locator.notebook.codeEditor.editor.currentLine);
                    await editorLines[editorLines.length - 1].click();
                } else if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }

            }
        }, constants.wait5seconds, "Text area was not interactable");

        await driver.wait(until.elementLocated(locator.suggestWidget.exists), constants.wait150MilliSeconds)
            .then(async () => {
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await textArea.sendKeys(Key.ESCAPE);
            })
            .catch(() => {
                // continue
            });
    };

    /**
     * Cleans the editor
     * @returns A promise resolving when the editor is cleaned
     */
    public clean = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);

                if (platform() === "darwin") {
                    await textArea.sendKeys(Key.chord(Key.COMMAND, "a", "a"));
                } else {
                    await textArea.sendKeys(Key.chord(Key.CONTROL, "a", "a"));
                }

                await textArea.sendKeys(Key.BACK_SPACE);
                await driver.wait(async () => {
                    return await DBNotebooks.getPromptLastTextLine() === "";
                }, constants.wait5seconds, "Prompt was not cleaned");

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Editor was not cleaned");

        this.reset();
    };

    /**
     * Executes a script on the editor
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving with the script result
     */
    public executeScript = async (cmd: string, slowWriting: boolean): Promise<void> => {
        await this.write(cmd, slowWriting);
        await this.exec();
        await driver.sleep(constants.wait1second); // mandatory since there is no zoneHost id on scripts
        await this.setResultMessage(cmd, undefined, true);
        await this.setResultContent(cmd, undefined, true);
        await this.setResultToolbar(cmd, undefined, true);
    };

    /**
     * Deletes all stored credentials on the key chain, using shell
     * @returns A promise resolving when the command is executed
     */
    public deleteCredentials = async (): Promise<void> => {
        const cmd = "shell.deleteAllCredentials()";
        await this.write(cmd, false);
        await this.exec();

        if (!(await Os.existsCredentialHelper())) {
            // we expect an error on the console
            const nextId = await this.getNextResultId(this.resultId);
            await this.setResultMessage(cmd, nextId);
            await this.setResultContent(cmd, nextId);
            await this.setResultToolbar(cmd, nextId);
            if (nextId) {
                this.setResultId(nextId);
            }
        }
    };

    /**
     * Executes a command on the editor
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @param noOutput True if the command will generate no output, false otherwise
     * @returns A promise resolving when the command is executed
     */
    public execute = async (cmd: string, slowWriting = false, searchOnExistingId?: string,
        noOutput = false):
        Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'languageSwitch()'");
        }

        await this.write(cmd, slowWriting);
        await this.exec();

        if (!noOutput) {
            const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
            await this.setResultMessage(cmd, nextId);
            await this.setResultContent(cmd, nextId);
            await this.setResultToolbar(cmd, nextId);
            if (nextId) {
                this.setResultId(nextId);
            }
        }
    };

    /**
     * Executes a command on the editor using a toolbar button
     * @param cmd The command
     * @param button The button to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithButton = async (cmd: string, button: string,
        slowWriting = false, searchOnExistingId?: string):
        Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.findCmdAndExecute()'");
        }

        await this.write(cmd, slowWriting);
        const toolbarButton = await DBNotebooks.getToolbarButton(button);
        await toolbarButton!.click();

        const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
        await this.setResultMessage(cmd, nextId);
        await this.setResultContent(cmd, nextId);
        await this.setResultToolbar(cmd, nextId);

        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a command on the editor using a context menu item
     * @param cmd The command
     * @param item The context menu item to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithContextMenu = async (cmd: string, item: string,
        slowWriting = false, searchOnExistingId?: string): Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(cmd, slowWriting);
        await DBNotebooks.clickContextItem(item);

        const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
        await this.setResultMessage(cmd, nextId);
        await this.setResultContent(cmd, nextId);
        await this.setResultToolbar(cmd, nextId);

        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a command on the editor, setting the credentials right after the execution is triggered
     * @param cmd The command
     * @param dbConnection The DB Connection to use
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeExpectingCredentials = async (cmd: string, dbConnection: interfaces.IDBConnection,
        slowWriting = false, searchOnExistingId?: string): Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(cmd, slowWriting);
        await this.exec();
        await OpenConnectionDialog.setCredentials(dbConnection);

        const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
        await this.setResultMessage(cmd, nextId);
        await this.setResultContent(cmd, nextId);
        await this.setResultToolbar(cmd, nextId);

        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Searches for a command on the editor, and execute it, using the Exec Caret button on SQL commands,
     * and Execute block button on scripts
     * @param cmd The command
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public findAndExecute = async (cmd: string, searchOnExistingId?: string): Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }
        await this.setMouseCursorAt(cmd);

        if (await DBNotebooks.existsToolbarButton(constants.execCaret)) {
            const toolbarButton = await DBNotebooks.getToolbarButton(constants.execCaret);
            await driver.wait(async () => {
                try {
                    await toolbarButton?.click();
                    await driver.wait(async () => {
                        return (await toolbarButton?.getAttribute("class"))?.includes("disabled");
                    }, constants.wait5seconds, `repeat - disabled`);
                    await driver.wait(async () => {
                        return !((await toolbarButton?.getAttribute("class"))?.includes("disabled"));
                    }, constants.wait5seconds, `repeat - enabled`);

                    return true;
                } catch (e) {
                    if (!String(e).includes("repeat")) {
                        throw e;
                    } else {
                        console.log(`[DEBUG] ${String(e)}`);
                        console.log("------");
                    }
                }
            }, constants.wait5seconds, "There was a problem clicking the Exec caret button");
        } else {
            await (await DBNotebooks.getToolbarButton(constants.execFullBlockJs))!.click();
        }

        const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
        await this.setResultMessage(cmd, nextId);
        await this.setResultContent(cmd, nextId);
        await this.setResultToolbar(cmd, nextId);

        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param reset Resets the result id of the current object
     * @returns A promise resolving with the last cmd result
     */
    public loadLastExistingCommandResult = async (reset = false): Promise<void> => {

        if (reset) {
            this.setResultId(undefined);
        }

        const nextId = await this.getNextResultId(this.resultId);
        await this.setResultMessage(undefined, nextId);
        await this.setResultContent(undefined, nextId);
        await this.setResultToolbar(undefined, nextId);

        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     * @param cmd The command to change the language
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public languageSwitch = async (cmd: string, slowWriting = false, searchOnExistingId?:
        string | undefined): Promise<void> => {

        if (!this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.execute() or others'");
        }

        await this.write(cmd, slowWriting);
        await this.exec();

        if ((await this.isShellSession()) === true) {
            const nextId = searchOnExistingId ?? await this.getNextResultId(this.resultId);
            await this.setResultMessage(cmd, nextId);
            await this.setResultContent(cmd, nextId);
            await this.setResultToolbar(cmd, nextId);
            if (nextId) {
                this.setResultId(nextId);
            }
        }
    };

    /**
     * Changes the schema using the top tab
     * @param schema The schema
     * @returns A promise resolving with the command result
     */
    public changeSchemaOnTab = async (schema: string): Promise<void> => {
        const tabSchema = await driver.findElement(locator.shellSession.schema);
        await tabSchema.click();
        const menu = await driver.wait(until.elementLocated(locator.shellSession.tabContextMenu),
            constants.wait5seconds, "Schema list was not displayed");
        const items = await menu.findElements(locator.shellSession.tabContextMenuItem);
        for (const item of items) {
            if ((await item.getAttribute("innerHTML")).includes(schema)) {
                await item.click();
                break;
            }
        }

        await driver.wait(async () => {
            return (await driver.findElement(locator.shellSession.schema).getText()).includes(schema);
        }, constants.wait5seconds, `${schema} was not selected`);

        await this.loadLastExistingCommandResult();
    };

    /**
     * Performs the keyboard combination to execute a command on the editor
     * @returns A promise resolving when the command is executed
     */
    public exec = async (): Promise<void> => {

        if (platform() === "darwin") {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.COMMAND, Key.ENTER));
        } else {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.CONTROL, Key.ENTER));
        }

    };

    /**
     * Performs the CTRL+SPACE key combination to open the suggestions menu, on the editor
     * @returns A promise resolving when the suggestions menu is opened
     */
    public openSuggestionMenu = async (): Promise<void> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));
        await driver.wait(until.elementLocated(locator.suggestWidget.exists),
            constants.wait2seconds, "The suggestions menu was not displayed");
    };

    /**
     * Returns the last existing script result on the editor
     * @returns A promise resolving with the script result
     */
    public loadLastScriptResult = async (): Promise<void> => {
        await this.setResultMessage(undefined, undefined, true);
        await this.setResultContent(undefined, undefined, true);
        await this.setResultToolbar(undefined, undefined, true);
    };

    /**
     * Gets the command result id
     * @returns The result id
     */
    public getResultId = (): string | undefined => {
        return this.resultId;
    };

    /**
     * Fetches the last result id that exists on the editor and updates the current object result id
     */
    public synchronizeResultId = async (): Promise<void> => {
        const lastEditorResults = await driver.wait(until
            .elementsLocated(locator.notebook.codeEditor.editor.result.exists),
            constants.wait5seconds, "Could not find any results for sync");
        const id = (await lastEditorResults[lastEditorResults.length - 1].getAttribute("monaco-view-zone"))
            .match(/(\d+)/)![1];

        this.setResultId(id);
    };

    /**
     * Gets the last known result message
     * @returns The message
     */
    public getResultMessage = (): string => {
        return this.message;
    };

    /**
     * Gets the last known result content
     * @returns The content
     */
    public getResultContent = (): WebElement | interfaces.ICommandTabResult[] => {
        return this.content;
    };

    /**
     * Gets the last known result toolbar
     * @returns The toolbar
     */
    public getResultToolbar = (): WebElement => {
        return this.toolbar;
    };

    /**
     * Sets the mouse cursor at the editor line where the specified word is
     * @param word The word or command
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public setMouseCursorAt = async (word: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const currentLine = await driver.findElement(locator.notebook.codeEditor.editor.currentLine);
                const mouseCursorShouldBe = await DBNotebooks.getLineFromWord(word);
                const lines = await driver.findElements(locator.notebook.codeEditor.editor.editorPrompt);
                const lineSpan = await lines[mouseCursorShouldBe!].findElement(locator.htmlTag.span);
                await driver.actions().doubleClick(lineSpan).perform();

                return driver.wait(until.stalenessOf(currentLine), constants.wait2seconds)
                    .then(() => {
                        return true;
                    }).catch(() => {
                        return false;
                    });
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Could not place the mouse cursor at the correct spot");
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param resultId The result id to load
     * @returns A promise resolving with the last cmd result
     */
    public refreshCommandResult = async (resultId: string | undefined): Promise<void> => {
        await this.setResultMessage(undefined, resultId);
        await this.setResultContent(undefined, resultId);
        await this.setResultToolbar(undefined, resultId);
        this.setResultId(resultId);
    };

    /**
     * Edits a cell of a result grid
     * @param cells The result grid cells
     * @returns A promise resolving when the new value is set
     */
    public editResultGridCells = async (cells: interfaces.IResultGridCell[]): Promise<void> => {
        await driver.wait(waitUntil.resultGridIsEditable(this.getResultToolbar()),
            constants.wait5seconds);

        const performEdit = async (cellRef: interfaces.IResultGridCell): Promise<void> => {
            let isDate: boolean = false;

            await this.startEditCell(cellRef.rowNumber!, cellRef.columnName, cellRef.value);
            const cell = await this.getCellFromResultGrid(cellRef.rowNumber!,
                cellRef.columnName); // avoid stale
            const expectInput = typeof cellRef.value === "string";

            if (expectInput) {
                let input: WebElement;
                const inputBox = await cell.findElements(locator.htmlTag.input);
                const textArea = await cell.findElements(locator.htmlTag.textArea);
                if (inputBox.length > 0) {
                    input = inputBox[0];
                } else if (textArea.length > 0) {
                    input = textArea[0];
                } else {
                    throw new Error(`Could not find an input nor a textarea when editing cell for ${cellRef
                        .columnName}`);
                }

                const isDateTime = (await cell
                    .findElements(locator.notebook.codeEditor.editor.result.tableCellDateTime)).length > 0;

                if (!isDateTime) {
                    isDate = false;
                    const upDownInput = await cell
                        .findElement(locator.notebook.codeEditor.editor.result.tableCellUpDownInput).catch(() => {
                            return undefined;
                        });

                    if (!upDownInput) {
                        await this.clearCellInputField(input);
                        await input.sendKeys(cellRef.value as string);
                    } else {
                        await driver.executeScript("arguments[0].value=arguments[1]", input, cellRef.value as string);
                    }

                } else {
                    isDate = true;
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cellRef.value as string);
                }
            } else {
                await this.setCellBooleanValue(cellRef.rowNumber!, cellRef.columnName,
                    cellRef.value as boolean);
            }
            await this.saveCellChanges("edit", cellRef.rowNumber!, cellRef.columnName);
            await this.refreshCommandResult(this.getResultId());

            if (isDate) {
                await driver.wait(async () => {
                    return (await this.getCellValueFromResultGrid(cellRef.rowNumber!,
                        cellRef.columnName)) !== "Invalid Date";
                }, constants.wait2seconds, `Invalid Date was found after inserting value '${cellRef.value}'`);
            }
            await driver.wait(async () => {
                const cell = await this.getCellFromResultGrid(cellRef.rowNumber!, cellRef.columnName);

                return (await cell.getAttribute("class")).includes("changed");
            }, constants.wait2seconds,
                `Yellow background does not exist on cell after inserting value '${cellRef.value}'`);
        };


        for (const cell of cells) {
            await driver.wait(async () => {
                try {
                    await performEdit(cell);

                    return true;
                } catch (err) {
                    if (err instanceof error.StaleElementReferenceError) {
                        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                        await textArea.sendKeys(Key.ESCAPE);
                    } else {
                        throw err;
                    }
                }
            }, constants.wait10seconds, `The cell on column ${cell.columnName} was always stale`);
        }
    };

    /**
     * Gets a cell of a result grid
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridColumn The column
     * @returns A promise resolving with the cell
     */
    public getCellFromResultGrid = async (
        gridRow: number,
        gridColumn: string): Promise<WebElement> => {
        let cells: WebElement[];
        let cellToReturn: WebElement | undefined;
        const table = this.getTableFromCommand();

        await driver.wait(async () => {
            try {
                await this.refreshCommandResult(this.getResultId());
                const resultGrid = this.getResultContent() as WebElement;

                if (gridRow === -1) {
                    const addedTableRows = await resultGrid
                        .findElements(locator.notebook.codeEditor.editor.result.addedTableRow);
                    cells = await addedTableRows[addedTableRows.length - 1]
                        .findElements(locator.notebook.codeEditor.editor.result.tableCell);
                } else {
                    const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
                    cells = await rows[gridRow].findElements(locator.notebook.codeEditor.editor.result.tableCell);
                }

                cellToReturn = cells[Misc.getDbTableColumnIndex(table, gridColumn)];

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The cell or result grid was stale");

        if (!cellToReturn) {
            throw new Error(`Could not find cell on table '${table}' on row '${gridRow}' and column '${gridColumn}'`);
        } else {
            return cellToReturn;
        }
    };

    /**
     * Gets the value of a cell out of a result grid
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridColumn The column
     * @returns A promise resolving with the cell value.
     */
    public getCellValueFromResultGrid = async (gridRow: number,
        gridColumn: string): Promise<string> => {
        let toReturn: string = "";

        await driver.wait(async () => {
            try {
                const cell = await this.getCellFromResultGrid(gridRow, gridColumn);
                await driver.executeScript("arguments[0].scrollIntoView()", cell);
                const isSelectList = (await cell
                    .findElements(locator.notebook.codeEditor.editor.result.tableCellSelectList.exists))
                    .length > 0;
                const isIcon = (await cell.findElements(locator.notebook.codeEditor.editor.result.tableCellIcon))
                    .length > 0;

                if (isSelectList) {
                    const selectList = cell
                        .findElement(locator.notebook.codeEditor.editor.result.tableCellSelectList.exists);

                    toReturn = await (await selectList.findElement(locator.htmlTag.label)).getText();
                } else if (isIcon) {
                    const img = await cell.findElements(locator.notebook.codeEditor.editor.result.tableCellIcon);
                    const icon = (await img[0].getAttribute("style")).match(/assets\/data-(.*)-/)![1];
                    toReturn = icon;
                } else {
                    await driver.executeScript("arguments[0].scrollIntoView()", cell);

                    toReturn = await cell.getText();
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Cell ${gridColumn} was always stale`);

        return toReturn;
    };

    /**
     * Gets the cell icon type
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridColumn The column
     * @returns A promise resolving with the cell icon type
     */
    public getCellIconType = async (gridRow: number, gridColumn: string): Promise<string | undefined> => {
        let icon: string | undefined;
        await driver.wait(async () => {
            try {
                const cell = await this.getCellFromResultGrid(gridRow, gridColumn);
                const img = await cell.findElements(locator.notebook.codeEditor.editor.result.tableCellIcon);
                icon = (await img[0].getAttribute("style")).match(/assets\/data-(.*)-/)![1];

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError) &&
                    !(String(e).includes("No node with given id found"))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Unable to get the cell icon type");

        return icon;
    };

    /**
     * Closes the current result set
     * @returns A promise resolving when the result set is closed
     */
    public closeResultSet = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.wait(waitUntil.elementLocated(this.getResultToolbar(),
                    locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.open),
                    constants.wait5seconds, "Could not find Show Actions button");
                const showActions = await this.getResultToolbar()
                    .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.open);
                await driver.executeScript("arguments[0].click()", showActions);

                const menu = await driver.wait(until
                    .elementLocated(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.exists),
                    constants.wait5seconds, "Action menu was not displayed");
                await menu
                    .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.closeResultSet)
                    .click();

                return true;
            } catch (e) {
                if (!(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Show actions button was not interactable");
    };


    /**
     * Adds a row into a result grid
     * @param cells The cells
     * @returns A promise resolving when the new value is set
     */
    public addResultGridRow = async (cells: interfaces.IResultGridCell[]): Promise<void> => {
        await driver.wait(async () => {
            return this.clickAddNewRowButton().then(async () => {
                return driver.wait(waitUntil.rowWasAdded(this.getResultContent() as WebElement),
                    constants.wait2seconds).then(() => {
                        return true;
                    })
                    .catch(() => {
                        // repeat
                    });
            });
        }, constants.wait10seconds, "The new row was not added");

        const performAdd = async (cell: interfaces.IResultGridCell): Promise<void> => {
            let isDate = false;

            const refCell = await this.getCellFromResultGrid(-1, cell.columnName);
            const expectInput = typeof cell.value === "string";
            await this.startEditCell(-1, cell.columnName, cell.value);

            if (expectInput) {
                let input: WebElement;
                const inputBox = await refCell.findElements(locator.htmlTag.input);
                const textArea = await refCell.findElements(locator.htmlTag.textArea);

                if (inputBox.length > 0) {
                    input = inputBox[0];
                } else if (textArea.length > 0) {
                    input = textArea[0];
                } else {
                    throw new Error(`Could not find an input nor a textarea when editing cell for ${cell
                        .columnName}`);
                }

                const isDateTime = (await refCell
                    .findElements(locator.notebook.codeEditor.editor.result.tableCellDateTime)).length > 0;

                if (!isDateTime) {
                    isDate = false;
                    const upDownInput = await refCell
                        .findElement(locator.notebook.codeEditor.editor.result.tableCellUpDownInput).catch(() => {
                            return undefined;
                        });

                    if (!upDownInput) {
                        await this.clearCellInputField(input);
                        await input.sendKeys(cell.value as string);
                    } else {
                        await driver.executeScript("arguments[0].value=arguments[1]",
                            input, cell.value as string);
                    }

                } else {
                    isDate = true;
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cell.value as string);
                }
            } else {
                await this.setCellBooleanValue(-1, cell.columnName, cell.value as boolean);
            }

            await this.saveCellChanges("add", -1, cell.columnName);

            if (isDate) {
                await driver.wait(async () => {
                    return (await this.getCellValueFromResultGrid(-1, cell.columnName)) !== "Invalid Date";
                }, constants.wait2seconds, `Invalid Date was found after inserting value '${cell.value}'`);
            }
        };

        for (const cell of cells) {
            await driver.wait(async () => {
                try {
                    await performAdd(cell);

                    return true;
                } catch (err) {
                    if (err instanceof error.StaleElementReferenceError) {
                        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                        await textArea.sendKeys(Key.ESCAPE);
                    } else {
                        throw err;
                    }
                }
            }, constants.wait10seconds, `The cell on column ${cell.columnName} was always stale`);
        }

        await this.refreshCommandResult(this.getResultId());
    };

    /**
     * Gets a cell of a result grid
     * @param resultGrid The result grid
     * @param gridRow The row number or the row as WebElement
     * @returns A promise resolving with the row
     */
    public getRowFromResultGrid = async (resultGrid: WebElement, gridRow: number): Promise<WebElement> => {
        const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);

        return rows[gridRow];
    };

    /**
     * Sets a result grid cell with
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowColumn The column
     * @param width The width of the cell. Defaults to 40px
     * @returns A promise resolving when the cell is resized
     */
    public setResultGridCellWidth = async (gridRow: number, gridRowColumn: string, width = "40"): Promise<void> => {
        await driver.wait(async () => {
            try {
                let cell = await this.getCellFromResultGrid(gridRow, gridRowColumn);
                await driver.executeScript(`arguments[0].setAttribute("style", "width: ${width}px; height: 20px;")`,
                    cell);
                cell = await this.getCellFromResultGrid(gridRow, gridRowColumn);

                return (await cell.getCssValue("width")).includes(`${width}px`);
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not resize result grid cell on column ${gridRowColumn}`);
    };

    /**
     * Gets a cell tooltip
     * @param gridRow The row number
     * @param columnName The column name
     * @returns A promise resolving with the cell tooltip
     */
    public getCellTooltip = async (gridRow: number, columnName: string): Promise<string | undefined> => {
        const cell = await this.getCellFromResultGrid(gridRow, columnName);
        await driver.actions().move({
            origin: cell,
            x: -5,
            y: -5,
        }).perform();

        return driver.wait(async () => {
            const tooltip = await driver.findElements(locator.notebook.codeEditor.tooltip);
            if (tooltip.length > 0) {
                return tooltip[0].getText();
            }
        }, constants.wait5seconds, `Could not find tooltip for cell on row '${gridRow}' and column '${columnName}'`);
    };

    /**
     * Gets the SQL Preview generated for a string
     * @param returnWebEl True to return the sql preview web element
     * @returns A promise resolving with the sql preview
     */
    public getSqlPreview = async (returnWebEl = false): Promise<string | WebElement> => {
        if (!returnWebEl) {
            await this.getResultToolbar()
                .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.previewButton).click();
            await this.refreshCommandResult(this.getResultId());
            const sqlPreview = this.getResultContent() as WebElement;

            const words = await sqlPreview.findElements(locator.notebook.codeEditor.editor.result.previewChanges.words);
            let toReturn = "";

            for (const word of words) {
                toReturn += (await word.getText()).replace("&nbsp;", " ");
            }

            return toReturn;
        } else {
            return this.getResultContent() as WebElement;
        }
    };

    /**
     * Opens the context menu for a result grid cell and selects a value from the menu
     * @param gridRow The row number
     * @param columnName The column name
     * @param contextMenuItem The menu item to select
     * @param subContextMenuItem The sub menu item to select
     * @returns A promise resolving when menu item is clicked
     */
    public openCellContextMenuAndSelect = async (gridRow: number, columnName: string,
        contextMenuItem: string,
        subContextMenuItem?: string): Promise<void> => {

        const cellContextMenu = locator.notebook.codeEditor.editor.result.cellContextMenu;
        await driver.wait(async () => {
            try {
                const cell = await this.getCellFromResultGrid(gridRow, columnName);
                await driver
                    // eslint-disable-next-line max-len
                    .executeScript("arguments[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 }));"
                        , cell);
                const contextMenu = await driver.wait(until
                    .elementLocated(cellContextMenu.exists),
                    constants.wait5seconds, "Cell context menu was not displayed");
                switch (contextMenuItem) {

                    case constants.resultGridContextMenu.capitalizeText: {
                        await contextMenu.findElement(cellContextMenu.capitalize)
                            .click();
                        break;
                    }

                    case constants.resultGridContextMenu.convertTextToLowerCase: {
                        await contextMenu.findElement(cellContextMenu.lowerCase)
                            .click();
                        break;
                    }

                    case constants.resultGridContextMenu.convertTextToUpperCase: {
                        await contextMenu.findElement(cellContextMenu.upperCase)
                            .click();
                        break;
                    }

                    case constants.resultGridContextMenu.toggleForDeletion: {
                        await contextMenu
                            .findElement(cellContextMenu.toggleForDeletion).click();
                        break;
                    }

                    case constants.resultGridContextMenu.copySingleRow: {
                        const copySingleRow = await contextMenu
                            .findElement(cellContextMenu.copySingleRow.exists);
                        await driver.actions().move({ origin: copySingleRow }).perform();
                        await driver.wait(until
                            .elementLocated(cellContextMenu.copySingleRow.subMenu.exists),
                            constants.wait3seconds, "Sub menu context was not displayed");
                        switch (subContextMenuItem) {

                            case constants.resultGridContextMenu.copySingleRowContextMenu.copyRow: {
                                await driver.findElement(cellContextMenu.copySingleRow.subMenu.copyRow).click();
                                break;
                            }

                            case constants.resultGridContextMenu.copySingleRowContextMenu.copyRowTabSeparated: {
                                await driver.findElement(cellContextMenu.copySingleRow.subMenu.copyRowTabSeparated)
                                    .click();
                                break;
                            }

                            case constants.resultGridContextMenu.copySingleRowContextMenu.copyRowUnquoted: {
                                await driver.findElement(cellContextMenu.copySingleRow.subMenu.copyRowUnquoted).click();
                                break;
                            }

                            case constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNames: {
                                await driver.findElement(cellContextMenu.copySingleRow.subMenu.copyRowWithNames)
                                    .click();
                                break;
                            }

                            case constants.resultGridContextMenu.copySingleRowContextMenu
                                .copyRowWithNamesTabSeparated: {
                                    await driver.findElement(cellContextMenu.copySingleRow.subMenu
                                        .copyRowWithNamesTabSeparated)
                                        .click();
                                    break;
                                }

                            case constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesUnquoted: {
                                await driver.findElement(cellContextMenu.copySingleRow.subMenu.copyRowWithNamesUnquoted)
                                    .click();
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                        break;
                    }
                    case constants.resultGridContextMenu.copyMultipleRows: {
                        const copyAllRows = await contextMenu
                            .findElement(cellContextMenu.copyAllRows.exists);
                        await driver.actions().move({ origin: copyAllRows }).perform();
                        await driver.wait(until
                            .elementLocated(cellContextMenu.copyAllRows.subMenu.exists),
                            constants.wait3seconds, "Sub menu context was not displayed");
                        switch (subContextMenuItem) {

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRows: {
                                await driver.findElement(cellContextMenu.copyAllRows.subMenu.copyAllRows).click();
                                break;
                            }

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsTabSeparated: {
                                await driver.findElement(cellContextMenu.copyAllRows.subMenu.copyAllRowsTabSeparated)
                                    .click();
                                break;
                            }

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsUnquoted: {
                                await driver.findElement(cellContextMenu.copyAllRows.subMenu.copyAllRowsUnquoted)
                                    .click();
                                break;
                            }

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNames: {
                                await driver.findElement(cellContextMenu.copyAllRows.subMenu.copyAllRowsWithNames)
                                    .click();
                                break;
                            }

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu
                                .copyAllRowsWithNamesTabSeparated: {
                                    await driver.findElement(cellContextMenu.copyAllRows.subMenu
                                        .copyAllRowsWithNamesTabSeparated)
                                        .click();
                                    break;
                                }

                            case constants.resultGridContextMenu.copyMultipleRowsContextMenu
                                .copyAllRowsWithNamesUnquoted: {
                                    await driver.findElement(cellContextMenu.copyAllRows.subMenu
                                        .copyAllRowsWithNamesUnquoted)
                                        .click();
                                    break;
                                }
                            default: {
                                break;
                            }
                        }
                        break;
                    }

                    case constants.resultGridContextMenu.copyField: {
                        await driver.findElement(cellContextMenu.copyField).click();
                        break;
                    }

                    case constants.resultGridContextMenu.copyFieldUnquoted: {
                        await driver.findElement(cellContextMenu.copyFieldUnquoted).click();
                        break;
                    }

                    case constants.resultGridContextMenu.setFieldToNull: {
                        const setToNull = await driver.findElement(cellContextMenu.setFieldToNull);
                        await setToNull.click();

                        return driver.wait(async () => {
                            return (await driver.findElements(cellContextMenu.setFieldToNull)).length === 0;
                        }, constants.wait150MilliSeconds)
                            .then(() => {
                                return true;
                            })
                            .catch(async () => {
                                await this.getResultToolbar().click();

                                return false;
                            });
                    }
                    default: {
                        break;
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The cell or the context menu were always stale");
    };

    /**
     * Clicks on the Apply Changes button of a result grid
     * @param verifyUpdate True to verify if the changes were applied
     * @returns A promise resolving when the button is clicked
     */
    public resultGridApplyChanges = async (verifyUpdate = false): Promise<void> => {
        const applyButton = await this.getResultToolbar()
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.applyButton);

        if (verifyUpdate) {
            await driver.wait(async () => {
                await applyButton.click();
                await this.refreshCommandResult(this.getResultId());

                return this.getResultMessage().match(/(\d+).*updated/) !== null;
            }, constants.wait5seconds, "'row(s) updated' was not found on result message'");
        } else {
            await applyButton.click();
        }
    };

    /**
     * Clicks on the Rollback Changes button of a result grid
     * @returns A promise resolving when the button is clicked
     */
    public resultGridRollbackChanges = async (): Promise<void> => {
        await this.getResultToolbar()
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.rollbackButton).click();
    };

    /**
     * Returns the result block for an expected result id
     * When the nextId is undefined, the method will return the last existing command result on the editor
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public getResult = async (cmd?: string, searchOnExistingId?: string):
        Promise<WebElement | undefined> => {

        cmd = cmd ?? "last result";
        let result: WebElement;
        try {

            if (searchOnExistingId) {
                result = await driver.wait(until
                    .elementLocated(locator.notebook.codeEditor.editor.result.existsById(String(searchOnExistingId))),
                    constants.wait10seconds, `Could not find result id ${String(searchOnExistingId)} for ${cmd}`);
            } else {
                const results = await driver.wait(until
                    .elementsLocated(locator.notebook.codeEditor.editor.result.exists),
                    constants.wait10seconds, `Could not find results for ${cmd}`);
                const id = (await results[results.length - 1]
                    .getAttribute("monaco-view-zone")).match(/(\d+)/)![1];
                this.setResultId(id);
                result = results[results.length - 1];
            }

            return result;
        } catch (e) {
            const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);

            if (results.length > 0) {
                console.log(`[DEBUG] Last result id found: ${await results[results.length - 1]
                    .getAttribute("monaco-view-zone")}`);

                return results[results.length - 1];
            } else {
                console.log("[DEBUG] No results at all were found on the notebook");
                throw e;
            }
        }
    };

    /**
     * Clicks the Copy result to clipboard button, on text result sets
     * @returns A promise resolving when the button is clicked
     */
    public copyResultToClipboard = async (): Promise<void> => {
        const context = await this.getResult(undefined, this.getResultId());
        const output = await context!.findElement(locator.notebook.codeEditor.editor.result.singleOutput.exists);
        await driver.actions().move({ origin: output }).perform();
        await context!.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy).click();
    };

    /**
     * Clicks the add new row button in a result grid, by moving the mouse to the table headers to display the button
     * @returns A promise resolving when the button is clicked
     */
    private clickAddNewRowButton = async (): Promise<void> => {
        const context = await this.getResult(undefined, this.getResultId());
        await driver.wait(async () => {
            const tableHeader = await context!.findElement(locator.notebook.codeEditor.editor.result.tableHeaders);
            await driver.actions().move({ origin: tableHeader }).perform();

            return (await context!
                .findElements(locator.notebook.codeEditor.editor.result.status.toolbar.addNewRowButton))
                .length > 0;
        }, constants.wait5seconds, "Add new button was not displayed");

        const addNewRowLocator = locator.notebook.codeEditor.editor.result.status.toolbar.addNewRowButton;
        const addNewRow = context!.findElement(addNewRowLocator);
        await driver.executeScript("arguments[0].click()", addNewRow);
    };

    /**
     * Sets a boolean value on a cell
     * @param rowNumber The row number
     * @param columnName The column name
     * @param value The value
     * @returns A promise resolving when the value is set
     */
    private setCellBooleanValue = async (rowNumber: number,
        columnName: string, value: boolean): Promise<void> => {

        const cell = await this.getCellFromResultGrid(rowNumber, columnName);
        const selectList = cell.findElement(locator.notebook.codeEditor.editor.result.tableCellSelectList.exists);
        await selectList.click();
        await driver.wait(async () => {
            return (await driver
                .findElements(locator.notebook.codeEditor.editor.result.tableCellSelectList.list.exists))
                .length > 0;
        }, constants.wait2seconds, "List was not displayed");
        const list = await driver
            .findElement(locator.notebook.codeEditor.editor.result.tableCellSelectList.list.exists);
        const items = await list
            .findElements(locator.notebook.codeEditor.editor.result.tableCellSelectList.list.item);

        for (const item of items) {
            const itemName = await item.getText();
            if (itemName === value.toString()) {
                await item.click();

                return;
            }
        }
        throw new Error(`Could not find '${value}' on the select list`);
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
        return (cmd.match(/(\\js|\\javascript|\\ts|\\typescript|\\sql|\\py|\\python)/)) !== null;
    };

    /**
     * Returns the result block from a script execution
     * @returns A promise resolving with the result block
     */
    private getResultScript = async (): Promise<WebElement> => {
        return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script));
    };

    /**
     * Sets the message as a result of a command execution
     * If the command was a SQL query, it will return the status (ex. OK, 1 record retrieved)
     * If the command is a non SQL query, it will return the message that resulted of the command execution
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result message
     */
    private setResultMessage = async (cmd?: string, searchOnExistingId?: string, fromScript = false):
        Promise<void> => {

        let result: WebElement | undefined;
        let resultToReturn: string;
        await driver.wait(async () => {
            try {
                result = fromScript ? await this
                    .getResultScript() : await this.getResult(cmd, searchOnExistingId);
                // select
                const statusResult = await result!.findElements(locator.notebook.codeEditor.editor.result.status.text);
                // insert / delete / drop / call procedures
                // shell session text
                const textResult = await result!.findElements(locator.notebook.codeEditor.editor.result.text.exists);
                // python
                const jsonResult = await result!.findElements(locator.notebook.codeEditor.editor.result.json.field);
                // python graph
                const resultGraph = await result!
                    .findElements(locator.notebook.codeEditor.editor.result.graphHost.exists);
                // shell session
                const resultMsg = await result!.findElements(locator.notebook.codeEditor.editor.result.status.message);
                const resultOutput = await result!.findElements(locator.shellSession.result.outputText);

                await driver.executeScript("arguments[0].scrollBy(0, 1500)",
                    await driver.findElement(locator.notebook.codeEditor.editor.scrollBar));

                if (statusResult.length > 0) {
                    resultToReturn = await statusResult[statusResult.length - 1].getAttribute("innerHTML");
                } else if (textResult.length > 0) {
                    if (cmd) {
                        if (cmd.match(/export/) !== null) {
                            await driver.wait(async () => {
                                return (await textResult[textResult.length - 1].getAttribute("innerHTML"))
                                    .match(/The dump can be loaded using/) !== null;
                            }, constants.wait5seconds, "Could not find on result 'The dump can be loaded using'");
                            resultToReturn = await textResult[textResult.length - 1].getAttribute("innerHTML");
                        } else if (cmd.match(/(\\c|connect).*@.*/) !== null) {
                            await driver.wait(async () => {
                                resultToReturn = await textResult[textResult.length - 1].getAttribute("innerHTML");

                                return resultToReturn.match(/schema/) !== null;
                            }, constants.wait5seconds, "Could not find on result ' .'");
                            resultToReturn = await textResult[textResult.length - 1].getAttribute("innerHTML");
                        } else if (cmd.match(/(\\d|\\disconnect)/)) {
                            return await driver.wait(async () => {
                                return (await textResult[textResult.length - 1].getAttribute("innerHTML"))
                                    .match(/Already disconnected/) !== null;
                            }, constants.wait2seconds)
                                .then(async () => {
                                    return textResult[textResult.length - 1].getAttribute("innerHTML");
                                })
                                .catch(() => {
                                    return true;
                                });
                        }
                        else {
                            if (textResult.length > 1) {
                                for (const text of textResult) {
                                    resultToReturn += `${await text.getText()}\n`;
                                }
                            } else {
                                resultToReturn = await textResult[textResult.length - 1].getAttribute("innerHTML");
                            }
                        }
                    } else {
                        if (textResult.length > 1) {
                            for (const text of textResult) {
                                resultToReturn += `${await text.getText()}\n`;
                            }
                        } else {
                            resultToReturn = await textResult[textResult.length - 1].getAttribute("innerHTML");
                        }
                    }
                } else if (jsonResult.length > 0) {
                    resultToReturn = await jsonResult[jsonResult.length - 1].getAttribute("innerHTML");
                } else if (resultGraph.length > 0) {
                    resultToReturn = "graph";
                } else if (resultMsg.length > 0) {
                    resultToReturn = await resultMsg[resultMsg.length - 1].getAttribute("innerHTML");
                } else if (resultOutput.length > 0) {
                    if (cmd!.match(/mysql.*Session/) !== null) {
                        await driver.wait(async () => {
                            for (const output of resultOutput) {
                                const text = (await output.getText()).trim();
                                if (text !== "" && text !== "undefined") {
                                    resultToReturn += await output.getText();
                                } else {
                                    return false;
                                }
                            }

                            return true;
                        }, constants.wait5seconds, "Could not find on result ' .'");
                    } else {
                        for (const output of resultOutput) {
                            resultToReturn += await output.getText();
                        }
                    }
                }

                if (resultToReturn !== undefined && resultToReturn !== "") {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not find the result message");

        this.message = resultToReturn!;
    };

    /**
     * Sets the content as a result of a command execution
     * If the command was a SQL query with a SELECT statement, it will return the data set
     * If the command was a SQL query with multiples SELECT statements, it will return the data set for each one,
     * as a @string representation.
     * It can return JSON or Graphs or even text
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result content
     */
    private setResultContent = async (cmd?: string, searchOnExistingId?: string, fromScript = false):
        Promise<void> => {

        let result: WebElement | undefined;
        let resultContent!: WebElement | interfaces.ICommandTabResult[];

        try {
            await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.hasContent),
                constants.wait150MilliSeconds);
        } catch (e) {
            return undefined;
        }

        await driver.wait(async () => {
            try {
                result = fromScript ? await this
                    .getResultScript() : await this.getResult(cmd, searchOnExistingId);

                if (this.expectResultTabs(cmd!)) {
                    resultContent = [];
                    await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.tabSection.exists),
                        constants.wait5seconds, `A result tab should exist for cmd ${cmd}`);
                    const tabs = await result!.findElements(locator.notebook.codeEditor.editor.result.tabSection.tab);

                    for (const tab of tabs) {
                        // is data set ?
                        const tableRows = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.tableRows)
                            .catch(() => { return undefined; });
                        // is output text ?
                        const outputText = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.textOutput)
                            .catch(() => { return undefined; });
                        await tab.click();

                        if (tableRows) {
                            await driver.wait(until.stalenessOf(tableRows), constants.wait2seconds,
                                "Result table was not updated");
                            await driver.wait(waitUntil.elementLocated(result!,
                                locator.notebook.codeEditor.editor.result.tableHeaders),
                                constants.wait2seconds, "Result Table headers were not loaded");
                            await driver.wait(waitUntil.elementLocated(result!,
                                locator.notebook.codeEditor.editor.result.tableCell),
                                constants.wait2seconds, "Table cells were not loaded").catch(async () => {
                                    const result = fromScript ? await this
                                        .getResultScript() : await this.getResult(cmd,
                                            searchOnExistingId);
                                    await result!
                                        .findElement(locator.notebook.codeEditor.editor.result.tableColumnTitle)
                                        .click();
                                    await driver.wait(waitUntil
                                        .elementLocated(result!, locator.notebook.codeEditor.editor.result.tableCell),
                                        constants.wait2seconds,
                                        `Table cell was not set after click on column title (bug)`);

                                    return false;
                                });
                            resultContent.push({
                                tabName: await tab.getText(),
                                content: await (await result!
                                    .findElement(locator.notebook.codeEditor.editor.result.table))
                                    .getAttribute("innerHTML"),
                            });
                        } else if (outputText) {
                            resultContent.push({
                                tabName: await tab.getText(),
                                content: await (outputText).getText(),
                            });
                        }
                    }
                } else {
                    const isJsonResult = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.json.exists))
                        .length > 0;
                    const isGraphResult = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.graphHost.exists)).length > 0;
                    const isText = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.text.exists)).length > 0;
                    const isOutput = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.singleOutput.exists))
                        .length > 0;
                    const sqlPreview = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.previewChanges.exists))
                        .length > 0;
                    const isTableResult = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.tableHeaders))
                        .length > 0;

                    if (isTableResult) {
                        await driver.wait(waitUntil.elementLocated(result!,
                            locator.notebook.codeEditor.editor.result.tableCell),
                            constants.wait2seconds, "Table cells were not loaded").catch(async () => {
                                const result = await this.getResult(cmd, searchOnExistingId);
                                await result!.findElement(locator.notebook.codeEditor.editor.result.tableColumnTitle)
                                    .click();
                                await driver.wait(waitUntil
                                    .elementLocated(result!, locator.notebook.codeEditor.editor.result.tableCell),
                                    constants.wait2seconds, `Table cell was not set after click on column title (bug)`);
                            });
                        resultContent = await result!.findElement(locator.notebook.codeEditor.editor.result.table);
                    } else if (isJsonResult) {
                        resultContent = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.json.exists);
                    } else if (isGraphResult) {
                        resultContent = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.graphHost.exists);
                    } else if (isText) {
                        resultContent = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.text.exists);
                    } else if (isOutput) {
                        return true;
                    } else if (sqlPreview) {
                        resultContent = await result!
                            .findElement(locator.notebook.codeEditor.editor.result.previewChanges.exists);
                    }
                }

                if ((resultContent instanceof WebElement && resultContent !== undefined) ||
                    (resultContent.length > 0)) {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementNotInteractableError) &&
                    !(String(e).includes("No node with given id found"))
                ) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not return the result content for cmd ${cmd}`);

        this.content = resultContent;
    };

    /**
     * Sets the toolbar of a SQL query result
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result toolbar
     */
    private setResultToolbar = async (cmd?: string, searchOnExistingId?: string, fromScript = false):
        Promise<void> => {

        let toolbar!: WebElement;

        if ((await this.isShellSession()) === false) {
            await driver.wait(async () => {
                try {
                    const result = fromScript ? await this
                        .getResultScript() : await this.getResult(cmd, searchOnExistingId);
                    const hasTableResult = (await result!.findElements(locator.notebook.codeEditor.editor.result.table))
                        .length > 0;

                    if (hasTableResult) {
                        toolbar = result!.findElement(locator.notebook.codeEditor.editor.result.status.toolbar.exists);
                    }

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, `Could not get the result toolbar for cmd ${cmd}`);
        }

        this.toolbar = toolbar;
    };

    /**
     * Calculates and returns the next expected result id
     * If the lastResultId is undefined, it will fetch the last existing result id from the editor,
     * and calculate the next one based on it
     * @param lastResultId The last known result id
     * @returns A promise resolving with the next result id
     */
    private getNextResultId = async (lastResultId: string | undefined):
        Promise<string | undefined> => {
        let resultId: string;

        if (lastResultId) {
            resultId = String(parseInt(lastResultId, 10) + 1);
        } else {
            const results = await driver.findElements(locator.notebook.codeEditor.editor.result.exists);
            // the editor may not have any previous results at all (it has been cleaned)

            if (results.length > 0) {
                const result = results[results.length - 1];
                const id = (await result.getAttribute("monaco-view-zone")).match(/(\d+)/)![1];
                resultId = String(parseInt(id, 10));
            } else {
                return undefined;
            }
        }

        return resultId;
    };

    /**
     * Returns true if the context is within a shell session
     * @returns A promise resolving with the truthiness of the function
     */
    private isShellSession = async (): Promise<boolean> => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    };

    /**
     * Returns true if the given text exists on the editor
     * @param text The text to search for
     * @returns A promise resolving with the truthiness of the function
     */
    private isTextOnEditor = async (text: string): Promise<boolean> => {
        let isTextOnEditor = false;
        await driver.wait(async () => {
            try {
                const regex = text
                    .replace(/\*/g, "\\*")
                    .replace(/\./g, ".*")
                    .replace(/;/g, ".*")
                    .replace(/\s/g, ".*");

                const prompts = await driver.findElements(locator.notebook.codeEditor.editor.editorLine);
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
    private expectResultTabs = (cmd: string): boolean | undefined => {

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
        }
    };
    /**
     * Sets the last known result id
     * @param id The result id
     */
    private setResultId = (id: string | undefined): void => {
        this.resultId = id;
    };

    /**
     * Clears an input field
     * @param el The element
     * @returns A promise resolving when the field is cleared
     */
    private clearCellInputField = async (el: WebElement): Promise<void> => {
        await driver.wait(async () => {
            await driver.executeScript("arguments[0].click()", el);

            if (Os.isMacOs()) {
                await el.sendKeys(Key.chord(Key.COMMAND, "a"));
            } else {
                await el.sendKeys(Key.chord(Key.CONTROL, "a"));
            }

            await el.sendKeys(Key.BACK_SPACE);

            return (await el.getAttribute("value")).length === 0;
        }, constants.wait5seconds, `${await el.getId()} was not cleaned`);
    };

    /**
     * Gets the table from the last executed query
     * @returns The table name
     */
    private getTableFromCommand = (): string => {
        const keywords = this.command.split(" ");

        for (let i = 0; i <= keywords.length - 1; i++) {

            if (keywords[i].match(/(from|FROM)/) !== null) {

                if (keywords[i + 1].includes(".")) {
                    return (keywords[i + 1].split("."))[1].replace(";", "");
                } else {
                    return keywords[i + 1].replace(";", "");
                }
            }

        }
        throw new Error(`Could not get the table from command ${this.command}`);
    };

    /**
     * Starts to edit a cell
     * @param rowNumber The row number
     * @param columnName The column name
     * @param valueToEdit The value to insert
     * @returns The table name
     */
    private startEditCell = async (rowNumber: number, columnName: string,
        valueToEdit: string | number | boolean): Promise<void> => {
        const cell = await this.getCellFromResultGrid(rowNumber, columnName);
        const expectInput = typeof valueToEdit === "string";
        await driver.wait(async () => {
            await driver
                .executeScript("arguments[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));", cell);
            try {
                const cell = await this.getCellFromResultGrid(rowNumber, columnName);
                const isEditable = (await cell.getAttribute("class")).includes("tabulator-editing");

                if (expectInput) {
                    if (isEditable) {
                        return (await cell.findElements(locator.htmlTag.input)).length > 0 ||
                            (await cell.findElements(locator.htmlTag.textArea)).length > 0;
                    }
                } else {
                    return (await cell.getAttribute("class")).includes("changed") || isEditable;
                }
            } catch (e) {

                if (!(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not start editing cell on column ${columnName}`);
    };

    /**
     * Saves the changes on a cell
     * @param action The action that was made before saving the cell value (edit/add)
     * @param rowNumber The row number
     * @param columnName The column name
     * @returns The table name
     */
    private saveCellChanges = async (action: string, rowNumber: number, columnName: string): Promise<void> => {
        await driver.wait(async () => {
            await driver.findElement(locator.mainActivityBar).click();
            const cell = await this.getCellFromResultGrid(rowNumber, columnName);

            if (action === "edit") {
                return (await cell.getAttribute("class")).includes("changed");
            } else {
                return (await cell.getAttribute("class")).includes("tabulator-editing") === false;
            }
        }, constants.wait5seconds, `Unable to save changes on cell, with row ${rowNumber} and column ${columnName}`);
    };
}
