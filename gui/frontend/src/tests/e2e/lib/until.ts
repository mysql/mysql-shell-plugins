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

import { Condition, WebElement, Locator, error } from "selenium-webdriver";
import { DBNotebooks } from "./dbNotebooks.js";
import * as locator from "./locators.js";
import { CommandExecutor } from "./cmdExecutor.js";
import * as constants from "./constants.js";
import { driver } from "./driver.js";
import { OpenConnectionDialog } from "./openConnectionDialog.js";
import * as interfaces from "../lib/interfaces.js";
import { DatabaseConnectionOverview } from "../lib/databaseConnectionOverview.js";

export const toolbarButtonIsDisabled = (button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be disabled`, async () => {
        const btn = await DBNotebooks.getToolbarButton(button);

        return (await btn!.getAttribute("class")).includes("disabled");
    });
};

export const toolbarButtonIsEnabled = (button: string): Condition<boolean> => {
    return new Condition(`for button ${button} to be enabled`, async () => {
        const btn = await DBNotebooks.getToolbarButton(button);

        return !(await btn!.getAttribute("class")).includes("disabled");
    });
};

export const elementLocated = (context: WebElement, locator: Locator): Condition<boolean> => {
    return new Condition(`for element ${String(locator)} to be found`, async () => {
        return (await context.findElements(locator)).length > 0;
    });
};

export const editorHasNewPrompt = (): Condition<boolean> => {
    return new Condition(`for editor to have a new prompt`, async () => {
        const editorSentences = await driver.findElements(locator.notebook.codeEditor.editor.editorLine);

        return (await (editorSentences[editorSentences.length - 1]).getAttribute("innerHTML"))
            .match(/<span><\/span>/) !== null;
    });
};

export const resultGridIsEditable = (resultGrid: WebElement): Condition<boolean> => {
    return new Condition(`for result grid to be editable`, async () => {
        const edit = await resultGrid.findElement(locator.notebook.codeEditor.editor.result.status.toolbar.editButton);

        return (await edit.getAttribute("class")).includes("disabled") === false;
    });
};

export const cellIsEditable = (commandExecutor: CommandExecutor, rowNumber: number,
    columnName: string, expectInput: boolean): Condition<boolean | undefined> => {
    return new Condition(`for row to be editable`, async () => {
        return driver.wait(async () => {
            try {
                const cell = await commandExecutor.getCellFromResultGrid(rowNumber, columnName);
                const isEditable = (await cell.getAttribute("class")).includes("tabulator-editing");

                if (expectInput) {
                    if (isEditable) {
                        return (await cell.findElements(locator.htmlTag.input)).length > 0;
                    }
                } else {
                    return (await cell.getAttribute("class")).includes("changed") || isEditable;
                }

            } catch (e) {

                if (!(e instanceof error.StaleElementReferenceError) ||
                    !(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `The cell (${rowNumber}, ${columnName}) was not editable`);
    });
};

export const cellsWereChanged = (resultGrid: WebElement, changed: number): Condition<boolean> => {
    return new Condition(`for changed ${changed} cells to be marked has changed (yellow background)`, async () => {
        return (await resultGrid
            .findElements(locator.notebook.codeEditor.editor.result.changedTableCell)).length === changed;
    });
};

export const rowWasAdded = (resultGrid: WebElement): Condition<boolean> => {
    return new Condition(`for added table row`, async () => {
        return (await resultGrid.findElements(locator.notebook.codeEditor.editor.result.addedTableRow)).length > 0;
    });
};

export const rowsWereUpdated = (commandExecutor: CommandExecutor): Condition<boolean> => {
    return new Condition(`for result message to match 'rows updated'`, async () => {
        await commandExecutor.refreshCommandResult(commandExecutor.getResultId());

        return commandExecutor.getResultMessage().match(/(\d+).*updated/) !== null;
    });
};

export const changedResultGridCellsAreDone = (commandExecutor: CommandExecutor): Condition<boolean> => {
    return new Condition(`for yellow background on result grid cells to not be displayed`, () => {
        return commandExecutor.getResultMessage().match(/(\d+).*updated/) !== null;
    });
};

export const rowIsMarkedForDeletion = (row: WebElement): Condition<boolean> => {
    return new Condition(`for row to be marked for deletion`, async () => {
        return (await row.getAttribute("class")).includes("deleted");
    });
};

export const confirmationDialogExists = (context?: string): Condition<WebElement | undefined> => {
    let msg = "for confirmation dialog to be displayed";
    if (context) {
        msg += ` ${context}`;
    }

    return new Condition(msg, async () => {
        const confirmDialog = await driver.findElements(locator.confirmDialog.exists);

        if (confirmDialog) {
            return confirmDialog[0];
        }
    });
};

const dbConnectionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for DB Connection is successful", async () => {
        const editorSelectorExists = (await driver.findElements(locator.notebook.toolbar.editorSelector.exists))
            .length > 0;
        const notebookExists = (await driver.findElements(locator.notebook.exists)).length > 0;

        return editorSelectorExists || notebookExists;
    });
};

export const dbConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for DB connection ${connection.caption} to be opened`, async () => {
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;

        if (existsPasswordDialog) {
            await OpenConnectionDialog.setCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(), constants.wait10seconds);
        }

        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;
        const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;

        return existsNotebook || existsGenericDialog;
    });
};

export const dbConnectionDoesNotExist = (dbConnection: string): Condition<boolean> => {
    return new Condition(`for DB Connection ${dbConnection} to not exist`, async () => {
        return !(await DatabaseConnectionOverview.existsConnection(dbConnection));
    });
};


