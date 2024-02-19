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

import { until, Key, WebElement, error, WebDriver } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import * as interfaces from "../lib/interfaces.js";
import * as constants from "../lib/constants.js";
import { DBNotebooks } from "../lib/dbNotebooks.js";
import { DBConnection } from "./dbConnection.js";
import { platform } from "os";
import * as waitUntil from "./until.js";
import { Misc } from "../lib/misc.js";

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
     * @param driver The webdriver
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving when the command is written
     */
    public write = async (driver: WebDriver, cmd: string, slowWriting?: boolean): Promise<void> => {
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
                            await DBNotebooks.setNewLineOnEditor(driver);
                        }
                    }

                } else {
                    for (let i = 0; i <= lines.length - 1; i++) {
                        await textArea.sendKeys(lines[i].trim());
                        if (i !== lines.length - 1 && lines.length > 1) {
                            await DBNotebooks.setNewLineOnEditor(driver);
                        }
                    }
                }

                return this.isTextOnEditor(driver, lines[0]);
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
     * @param driver The webdriver
     * @returns A promise resolving when the editor is cleaned
     */
    public clean = async (driver: WebDriver): Promise<void> => {
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
                    return await DBNotebooks.getPromptLastTextLine(driver) === "";
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
     * @param driver The webdriver
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving with the script result
     */
    public executeScript = async (driver: WebDriver, cmd: string, slowWriting: boolean): Promise<void> => {
        await this.write(driver, cmd, slowWriting);
        await this.exec(driver);
        await driver.sleep(constants.wait1second); // mandatory since there is no zoneHost id on scripts
        await this.setResultMessage(driver, cmd, undefined, true);
        await this.setResultContent(driver, cmd, undefined, true);
        await this.setResultToolbar(driver, cmd, undefined, true);
    };

    /**
     * Executes a command on the editor
     * @param driver The webdriver
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @param noOutput True if the command will generate no output, false otherwise
     * @returns A promise resolving when the command is executed
     */
    public execute = async (driver: WebDriver, cmd: string, slowWriting = false, searchOnExistingId?: string,
        noOutput = false):
        Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'languageSwitch()'");
        }

        await this.write(driver, cmd, slowWriting);
        await this.exec(driver);
        if (!noOutput) {
            const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
            await this.setResultMessage(driver, cmd, nextId);
            await this.setResultContent(driver, cmd, nextId);
            await this.setResultToolbar(driver, cmd, nextId);
            if (nextId) {
                this.setResultId(nextId);
            }
        }
    };

    /**
     * Executes a command on the editor using a toolbar button
     * @param driver The webdriver
     * @param cmd The command
     * @param button The button to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithButton = async (driver: WebDriver, cmd: string, button: string,
        slowWriting = false, searchOnExistingId?: string):
        Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }
        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.findCmdAndExecute()'");
        }

        await this.write(driver, cmd, slowWriting);
        const toolbarButton = await DBNotebooks.getToolbarButton(driver, button);
        await toolbarButton!.click();

        const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
        await this.setResultMessage(driver, cmd, nextId);
        await this.setResultContent(driver, cmd, nextId);
        await this.setResultToolbar(driver, cmd, nextId);
        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a command on the editor using a context menu item
     * @param driver The webdriver
     * @param cmd The command
     * @param item The context menu item to click, to trigger the execution
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeWithContextMenu = async (driver: WebDriver, cmd: string, item: string,
        slowWriting = false, searchOnExistingId?: string): Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(driver, cmd, slowWriting);
        await DBConnection.clickContextItem(driver, item);

        const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
        await this.setResultMessage(driver, cmd, nextId);
        await this.setResultContent(driver, cmd, nextId);
        await this.setResultToolbar(driver, cmd, nextId);
        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a command on the editor, setting the credentials right after the execution is triggered
     * @param driver The webdriver
     * @param cmd The command
     * @param dbConnection The DB Connection to use
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public executeExpectingCredentials = async (driver: WebDriver, cmd: string, dbConnection: interfaces.IDBConnection,
        slowWriting = false, searchOnExistingId?: string): Promise<void> => {

        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.write(driver, cmd, slowWriting);
        await this.exec(driver);
        await DBConnection.setCredentials(driver, dbConnection);

        const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
        await this.setResultMessage(driver, cmd, nextId);
        await this.setResultContent(driver, cmd, nextId);
        await this.setResultToolbar(driver, cmd, nextId);
        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Searches for a command on the editor, and execute it, using the Exec Caret button on SQL commands,
     * and Execute block button on scripts
     * @param driver The webdriver
     * @param cmd The command
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public findAndExecute = async (driver: WebDriver, cmd: string, searchOnExistingId?: string): Promise<void> => {
        if (this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }
        await this.setMouseCursorAt(driver, cmd);

        if (await DBNotebooks.existsToolbarButton(driver, constants.execCaret)) {
            const toolbarButton = await DBNotebooks.getToolbarButton(driver, constants.execCaret);
            await toolbarButton!.click();
            await driver.wait(waitUntil.toolbarButtonIsDisabled(driver, constants.execCaret), constants.wait5seconds);
            await driver.wait(waitUntil.toolbarButtonIsEnabled(driver, constants.execCaret), constants.wait5seconds);
        } else {
            await (await DBNotebooks.getToolbarButton(driver, constants.execFullBlockJs))!.click();
        }
        const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
        await this.setResultMessage(driver, cmd, nextId);
        await this.setResultContent(driver, cmd, nextId);
        await this.setResultToolbar(driver, cmd, nextId);
        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param driver The webdriver
     * @param reset Resets the result id of the current object
     * @returns A promise resolving with the last cmd result
     */
    public loadLastExistingCommandResult = async (driver: WebDriver, reset = false): Promise<void> => {
        if (reset) {
            this.setResultId(undefined);
        }
        const nextId = await this.getNextResultId(driver, this.resultId);
        await this.setResultMessage(driver, undefined, nextId);
        await this.setResultContent(driver, undefined, nextId);
        await this.setResultToolbar(driver, undefined, nextId);
        if (nextId) {
            this.setResultId(nextId);
        }
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     * @param driver The webdriver
     * @param cmd The command to change the language
     * @param slowWriting True if the command should be written with a delay between each character
     * @param searchOnExistingId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public languageSwitch = async (driver: WebDriver, cmd: string, slowWriting = false, searchOnExistingId?:
        string | undefined): Promise<void> => {
        if (!this.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.execute() or others'");
        }
        await this.write(driver, cmd, slowWriting);
        await this.exec(driver);

        if ((await this.isShellSession(driver)) === true) {
            const nextId = searchOnExistingId ?? await this.getNextResultId(driver, this.resultId);
            await this.setResultMessage(driver, cmd, nextId);
            await this.setResultContent(driver, cmd, nextId);
            await this.setResultToolbar(driver, cmd, nextId);
            if (nextId) {
                this.setResultId(nextId);
            }
        }
    };

    /**
     * Changes the schema using the top tab
     * @param driver The webdriver
     * @param schema The schema
     * @returns A promise resolving with the command result
     */
    public changeSchemaOnTab = async (driver: WebDriver, schema: string): Promise<void> => {
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

        await this.loadLastExistingCommandResult(driver);
    };

    /**
     * Performs the keyboard combination to execute a command on the editor
     * @param driver The webdriver
     * @returns A promise resolving when the command is executed
     */
    public exec = async (driver: WebDriver): Promise<void> => {
        if (platform() === "darwin") {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.COMMAND, Key.ENTER));
        } else {
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.chord(Key.CONTROL, Key.ENTER));
        }
    };

    /**
     * Performs the CTRL+SPACE key combination to open the suggestions menu, on the editor
     * @param driver The webdriver
     * @returns A promise resolving when the suggestions menu is opened
     */
    public openSuggestionMenu = async (driver: WebDriver): Promise<void> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));
        await driver.wait(until.elementLocated(locator.suggestWidget.exists),
            constants.wait2seconds, "The suggestions menu was not displayed");
    };

    /**
     * Returns the last existing script result on the editor
     * @param driver The webdriver
     * @returns A promise resolving with the script result
     */
    public loadLastScriptResult = async (driver: WebDriver): Promise<void> => {
        await this.setResultMessage(driver, undefined, undefined, true);
        await this.setResultContent(driver, undefined, undefined, true);
        await this.setResultToolbar(driver, undefined, undefined, true);
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
     * @param driver The webdriver
     */
    public synchronizeResultId = async (driver: WebDriver): Promise<void> => {
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
     * @param driver The webdriver
     * @param word The word or command
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public setMouseCursorAt = async (driver: WebDriver, word: string): Promise<void> => {
        const mouseCursorIs = await DBNotebooks.getMouseCursorLine(driver);
        const mouseCursorShouldBe = await DBNotebooks.getLineFromWord(driver, word);
        const taps = mouseCursorShouldBe - mouseCursorIs!;
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        if (taps > 0) {
            for (let i = 0; i < taps; i++) {
                await textArea.sendKeys(Key.ARROW_DOWN);
                await driver.sleep(300);
            }
        } else if (taps < 0) {
            for (let i = 0; i < Math.abs(taps); i++) {
                await textArea.sendKeys(Key.ARROW_UP);
                await driver.sleep(300);
            }
        }
    };

    /**
     * Updates the object with the last existing command result on the editor
     * @param driver The webdriver
     * @param resultId The result id to load
     * @returns A promise resolving with the last cmd result
     */
    public refreshCommandResult = async (driver: WebDriver, resultId: string | undefined): Promise<void> => {
        await this.setResultMessage(driver, undefined, resultId);
        await this.setResultContent(driver, undefined, resultId);
        await this.setResultToolbar(driver, undefined, resultId);
        this.setResultId(resultId);
    };

    /**
     * Edits a cell of a result grid
     * @param driver The webdriver
     * @param cells The result grid cells
     * @returns A promise resolving when the new value is set
     */
    public editResultGridCells = async (driver: WebDriver, cells: interfaces.IResultGridCell[]): Promise<void> => {
        await driver.wait(waitUntil.resultGridIsEditable(this.getResultToolbar()),
            constants.wait5seconds);
        for (let i = 0; i <= cells.length - 1; i++) {
            const cell = await this.getCellFromResultGrid(driver, cells[i].rowNumber!, cells[i].columnNumber);
            const expectInput = typeof cells[i].value === "string";
            await driver.actions().doubleClick(cell).perform();
            await driver.wait(waitUntil.cellIsEditable(driver, this, cells[i].rowNumber!, cells[i].columnNumber,
                expectInput), constants.wait5seconds);
            if (expectInput) {
                const input = await cell!.findElement(locator.htmlTag.input);
                const isDateTime = (await cell!
                    .findElements(locator.notebook.codeEditor.editor.result.tableCellDateTime)).length > 0;
                if (!isDateTime) {
                    await Misc.clearInputField(driver, input);
                    await input.sendKeys(cells[i].value as string);
                } else {
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cells[i].value as string);
                }
            } else {
                await this.setCellCheckBoxValue(driver, cells[i].rowNumber, cells[i].columnNumber,
                    cells[i].value as boolean);
            }
            await driver.findElement(locator.mainActivityBar).click();
            await this.refreshCommandResult(driver, this.getResultId());
            await driver.wait(waitUntil.cellsWereChanged((this
                .getResultContent() as WebElement), i + 1), constants.wait5seconds);
        }
    };

    /**
     * Gets a cell of a result grid
     * @param driver The webdriver
     * @param gridRow The row number. If the row number is -1, the function returns the last added row
     * @param gridRowCellNumber The cell number
     * @returns A promise resolving with the cell
     */
    public getCellFromResultGrid = async (driver: WebDriver, gridRow: number,
        gridRowCellNumber: number): Promise<WebElement | undefined> => {
        let cells: WebElement[];
        let cellToReturn: WebElement | undefined;
        await driver.wait(async () => {
            try {
                await this.refreshCommandResult(driver, this.getResultId());
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
                cellToReturn = cells[gridRowCellNumber];

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "The cell or result grid was stale");

        return cellToReturn;
    };

    /**
     * Gets the cell icon type
     * @param cell The result grid cell
     * @returns A promise resolving with the cell icon type
     */
    public getCellIconType = async (cell: WebElement): Promise<string | undefined> => {
        const img = await cell.findElements(locator.notebook.codeEditor.editor.result.tableCellIcon);
        if (img.length > 0) {
            const icon = (await img[0].getAttribute("style")).match(/assets\/(.*)-/)![1];

            return icon;
        } else {
            const checkbox = await cell.findElements(locator.notebook.codeEditor.editor.result.tableCellCheckBox);
            if (checkbox.length > 0) {
                return "checkbox";
            }
        }
    };

    /**
     * Closes the current result set
     * @param driver The webdriver
     * @returns A promise resolving when the result set is closed
     */
    public closeResultSet = async (driver: WebDriver): Promise<void> => {
        await this.getResultToolbar()
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.open).click();
        const menu = await driver.wait(until
            .elementLocated(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.exists),
            constants.wait5seconds, "Action menu was not displayed");
        await menu
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.showActionMenu.closeResultSet)
            .click();
        this.setResultId((parseInt(this.getResultId()!, 10) - 1) as unknown as string);
    };

    /**
     * Adds a row into a result grid
     * @param driver The webdriver
     * @param cells The cells
     * @returns A promise resolving when the new value is set
     */
    public addResultGridRow = async (driver: WebDriver, cells: interfaces.IResultGridCell[]): Promise<void> => {
        await this.clickAddNewRowButton(driver);
        await driver.wait(waitUntil.rowWasAdded(this.getResultContent() as WebElement), constants.wait5seconds);

        for (const cell of cells) {
            const refCell = await this.getCellFromResultGrid(driver, -1, cell.columnNumber);
            const expectInput = typeof cell.value === "string";
            await driver.actions().doubleClick(refCell).perform();
            await driver.wait(waitUntil.cellIsEditable(driver, this, -1, cell.columnNumber,
                expectInput), constants.wait5seconds);
            if (expectInput) {
                const input = await refCell!.findElement(locator.htmlTag.input);
                const isDateTime = (await refCell!
                    .findElements(locator.notebook.codeEditor.editor.result.tableCellDateTime)).length > 0;
                if (!isDateTime) {
                    await Misc.clearInputField(driver, input);
                    await input.sendKeys(cell.value as string);
                } else {
                    await driver.executeScript("arguments[0].value=arguments[1]", input, cell.value as string);
                }
            } else {
                await this.setCellCheckBoxValue(driver, -1, cell.columnNumber, cell.value as boolean);
            }
            await driver.findElement(locator.mainActivityBar).click();
        }

        await this.refreshCommandResult(driver, this.getResultId());
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
     * Gets the SQL Preview generated for a string
     * @param driver The webdriver
     * @returns A promise resolving with the sql preview
     */
    public getSqlPreview = async (driver: WebDriver): Promise<string> => {
        await this.getResultToolbar()
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.previewButton).click();
        await this.refreshCommandResult(driver, this.getResultId());
        const sqlPreview = this.getResultContent() as WebElement;
        const words = await sqlPreview.findElements(locator.notebook.codeEditor.editor.result.previewChanges.words);
        let toReturn = "";
        for (const word of words) {
            toReturn += (await word.getText()).replace("&nbsp;", " ");
        }

        return toReturn;
    };

    /**
     * Opens the context menu for a result grid cell and selects a value from the menu
     * @param driver The webdriver
     * @param cell The cell
     * @param contextMenuItem The menu item to select
     * @returns A promise resolving when menu item is clicked
     */
    public openCellContextMenuAndSelect = async (driver: WebDriver, cell: WebElement,
        contextMenuItem: string): Promise<void> => {
        await driver.actions().contextClick(cell).perform();
        const contextMenu = await driver.wait(until
            .elementLocated(locator.notebook.codeEditor.editor.result.cellContextMenu.exists),
            constants.wait5seconds, "Cell context menu was not displayed");
        switch (contextMenuItem) {
            case constants.capitalizeText: {
                await contextMenu.findElement(locator.notebook.codeEditor.editor.result.cellContextMenu.capitalize)
                    .click();
                break;
            }
            case constants.convertTextToLowerCase: {
                await contextMenu.findElement(locator.notebook.codeEditor.editor.result.cellContextMenu.lowerCase)
                    .click();
                break;
            }
            case constants.convertTextToUpperCase: {
                await contextMenu.findElement(locator.notebook.codeEditor.editor.result.cellContextMenu.upperCase)
                    .click();
                break;
            }
            case constants.toggleForDeletion: {
                await contextMenu
                    .findElement(locator.notebook.codeEditor.editor.result.cellContextMenu.toggleForDeletion).click();
                break;
            }
            default: {
                break;
            }
        }
    };

    /**
     * Clicks on the Apply Changes button of a result grid
     * @param driver The webdriver
     * @param verifyUpdate True to verify if the changes were applied
     * @returns A promise resolving when the button is clicked
     */
    public resultGridApplyChanges = async (driver: WebDriver, verifyUpdate = false): Promise<void> => {
        const applyButton = await this.getResultToolbar()
            .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.applyButton);
        if (verifyUpdate) {
            await driver.wait(async () => {
                await applyButton.click();
                await this.refreshCommandResult(driver, this.getResultId());

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
     * @param driver The webdriver
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @returns A promise resolving when the mouse cursor is placed at the desired spot
     */
    public getResult = async (driver: WebDriver, cmd?: string, searchOnExistingId?: string):
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
                throw e;
            } else {
                console.log("[DEBUG] No results at all were found on the notebook");
            }

            throw e;
        }
    };

    /**
     * Clicks the Copy result to clipboard button, on text result sets
     * @param driver The webdriver
     * @returns A promise resolving when the button is clicked
     */
    public copyResultToClipboard = async (driver: WebDriver): Promise<void> => {
        const context = await this.getResult(driver, undefined, this.getResultId());
        const output = await context!.findElement(locator.notebook.codeEditor.editor.result.singleOutput.exists);
        await driver.actions().move({ origin: output }).perform();
        await context!.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy).click();
    };

    /**
     * Clicks the add new row button in a result grid, by moving the mouse to the table headers to display the button
     * @param driver The webdriver
     * @returns A promise resolving when the button is clicked
     */
    private clickAddNewRowButton = async (driver: WebDriver): Promise<void> => {
        const context = await this.getResult(driver, undefined, this.getResultId());
        await driver.wait(async () => {
            const tableHeader = await context!.findElement(locator.notebook.codeEditor.editor.result.tableHeaders);
            await driver.actions().move({ origin: tableHeader }).perform();

            return (await context!
                .findElements(locator.notebook.codeEditor.editor.result.status.toolbar.addNewRowButton))
                .length > 0;
        }, constants.wait5seconds, "Add new button was not displayed");

        await (context!).findElement(locator.notebook.codeEditor.editor.result.status.toolbar.addNewRowButton).click();
    };

    /**
     * Sets a check box value on a result grid cell checkbox
     * @param driver The webdriver
     * @param rowNumber The row number
     * @param columnNumber The column number
     * @param value True to check, false to uncheck or null/undefined
     * @returns A promise resolving when the value of the checkbox is set
     */
    private setCellCheckBoxValue = async (driver: WebDriver, rowNumber: number | undefined,
        columnNumber: number, value: boolean): Promise<void> => {
        let mappedCheckValue: string;
        if (value === true) {
            mappedCheckValue = "checked";
        } else if (value === false) {
            mappedCheckValue = "unchecked";
        } else {
            mappedCheckValue = "indeterminate";
        }

        const getCheckBox = async () => {
            const cell = await this.getCellFromResultGrid(driver, rowNumber!, columnNumber);

            return cell!.findElement(locator.notebook.codeEditor.editor.result.tableCellCheckBox);
        };

        const getCheckBoxValue = async () => {
            const checkBox = await getCheckBox();
            const checkBoxClasses = (await checkBox.getAttribute("class")).split(" ");
            if (checkBoxClasses[checkBoxClasses.length - 1] === "checkbox") {
                return "unchecked";
            }

            return checkBoxClasses[checkBoxClasses.length - 1];
        };

        const setCheckBoxValue = async (value: string) => {
            await driver.wait(async () => {
                const checkBox = await getCheckBox();
                const checkMark = await checkBox.findElement(locator.htmlTag.span);
                await checkMark.click();

                return (await getCheckBoxValue()) === value;
            }, constants.wait5seconds, `Could not set the checkbox value to ${value}`);
        };

        if ((await getCheckBoxValue()) !== mappedCheckValue) {
            await setCheckBoxValue(mappedCheckValue);
        }
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
     * @param driver The webdriver
     * @returns A promise resolving with the result block
     */
    private getResultScript = async (driver: WebDriver): Promise<WebElement> => {
        return driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.script));
    };

    /**
     * Sets the message as a result of a command execution
     * If the command was a SQL query, it will return the status (ex. OK, 1 record retrieved)
     * If the command is a non SQL query, it will return the message that resulted of the command execution
     * @param driver The webdriver
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result message
     */
    private setResultMessage = async (driver: WebDriver, cmd?: string, searchOnExistingId?: string, fromScript = false):
        Promise<void> => {

        let result: WebElement | undefined;
        let resultToReturn: string;
        await driver.wait(async () => {
            try {
                result = fromScript ? await this
                    .getResultScript(driver) : await this.getResult(driver, cmd, searchOnExistingId);
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
     * @param driver The webdriver
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result content
     */
    private setResultContent = async (driver: WebDriver, cmd?: string, searchOnExistingId?: string, fromScript = false):
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
                    .getResultScript(driver) : await this.getResult(driver, cmd, searchOnExistingId);
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
                                        .getResultScript(driver) : await this.getResult(driver, cmd,
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
                    const isTableResult = (await result!
                        .findElements(locator.notebook.codeEditor.editor.result.tableHeaders))
                        .length > 0;
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
                    if (isTableResult) {
                        await driver.wait(waitUntil.elementLocated(result!,
                            locator.notebook.codeEditor.editor.result.tableCell),
                            constants.wait2seconds, "Table cells were not loaded").catch(async () => {
                                const result = await this.getResult(driver, cmd, searchOnExistingId);
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
                if (!(e instanceof error.StaleElementReferenceError) ||
                    !(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not return the result content for cmd ${cmd}`);

        this.content = resultContent;
    };

    /**
     * Sets the toolbar of a SQL query result
     * @param driver The webdriver
     * @param cmd The command
     * @param searchOnExistingId The next expected result id
     * @param fromScript If the result is from a script execution
     * @returns A promise resolving with the result toolbar
     */
    private setResultToolbar = async (driver: WebDriver, cmd?: string, searchOnExistingId?: string, fromScript = false):
        Promise<void> => {

        let toolbar!: WebElement;
        if ((await this.isShellSession(driver)) === false) {
            await driver.wait(async () => {
                try {
                    const result = fromScript ? await this
                        .getResultScript(driver) : await this.getResult(driver, cmd, searchOnExistingId);
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
     * @param driver The webdriver
     * @param lastResultId The last known result id
     * @returns A promise resolving with the next result id
     */
    private getNextResultId = async (driver: WebDriver, lastResultId: string | undefined):
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
     * @param driver The webdriver
     * @returns A promise resolving with the truthiness of the function
     */
    private isShellSession = async (driver: WebDriver): Promise<boolean> => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    };

    /**
     * Returns true if the given text exists on the editor
     * @param driver The webdriver
     * @param text The text to search for
     * @returns A promise resolving with the truthiness of the function
     */
    private isTextOnEditor = async (driver: WebDriver, text: string): Promise<boolean> => {
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
}
