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
import {
    Condition,
    logging,
    WebElement,
    Locator,
    Workbench as extWorkbench,
    NotificationType,
    error,
    ModalDialog,
    TextEditor,
} from "vscode-extension-tester";
import { join } from "path";
import fs from "fs/promises";
import * as constants from "./constants";
import { Misc, driver } from "./Misc";
import { Notebook } from "./WebViews/Notebook";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { PasswordDialog } from "./WebViews/PasswordDialog";
import { Os } from "./Os";
import { Workbench } from "./Workbench";
import * as errors from "../lib/errors";
import { CommandExecutor } from "./CommandExecutor";

export let credentialHelperOk = true;

/**
 * Waits until the Modal dialog is opened
 * @returns A promise resolving when the model dialog is opened
 */
export const modalDialogIsOpened = (): Condition<boolean> => {
    return new Condition(`for vscode dialog to be opened`, async () => {
        try {
            const dialog = new ModalDialog();

            return (await dialog.getMessage()).length > 0;
        } catch (e) {
            if (!(e instanceof error.NoSuchElementError) &&
                !(errors.isStaleError(e as Error)) &&
                !(e instanceof error.ElementNotInteractableError)
            ) {
                throw e;
            }
        }
    });
};

/**
 * Waits until the tab is opened
 * @param tabName The tab name
 * @returns A promise resolving when the tab is opened
 */
export const tabIsOpened = (tabName: string): Condition<boolean> => {
    return new Condition(`for ${tabName} to be opened`, async () => {
        return (await Workbench.getOpenEditorTitles()).includes(tabName);
    });
};

/**
 * Waits until the editor selector exists, which means that the front end is loaded
 * @returns A promise resolving when the front end is loaded
 */
export const isFELoaded = (): Condition<boolean> => {
    return new Condition("for Frontend to be loaded", async () => {
        return (await driver.findElements(locator.notebook.toolbar.editorSelector.exists)).length > 0;
    });
};

/**
 * Waits until the database connection is successful
 * @returns A promise resolving when the database connection is successful
 */
const dbConnectionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for DB Connection is successful", async () => {
        const editorSelectorExists = (await driver.findElements(locator.notebook.toolbar.editorSelector.exists))
            .length > 0;
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

        return editorSelectorExists || existsNotebook;
    });
};

/**
 * Waits until the web view is ready to be used
 * @param iframe The iframe
 * @returns A promise resolving when the web view is ready
 */
export const webViewIsReady = (iframe: WebElement): Condition<boolean> => {
    return new Condition("for web view to be ready", async () => {
        return (await iframe.getAttribute("class")).includes("webview ready");
    });
};

/**
 * Waits until the current editor is the one expected
 * @param editor The editor name
 * @returns A promise resolving when the editor is the one expected
 */
export const currentEditorIs = (editor: RegExp): Condition<boolean> => {
    return new Condition(`current editor to be ${editor.toString()}`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        return (await Notebook.getCurrentEditorName()).match(editor) !== null;
    });
};

/**
 * Waits until the shell session is successful
 * @returns A promise resolving when the shell session is successful
 */
const shellSessionIsSuccessful = (): Condition<boolean> => {
    return new Condition("for Shell connection to be successful", async () => {
        return (await driver.findElements(locator.shellSession.exists)).length > 0;
    });
};

/**
 * Waits until the password dialog exists
 * @returns A promise resolving when the password dialog exists
 */
export const existsPasswordDialog = (): Condition<boolean> => {
    return new Condition(`for password dialog to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        return (await driver.findElements(locator.passwordDialog.exists)).length > 0;
    });
};

/**
 * Waits until the database connection is opened
 * @param connection The database connection
 * @returns A promise resolving when the database connection is opened
 */
export const dbConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for DB connection ${connection.caption} to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await PasswordDialog.setCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(), constants.wait15seconds);
        }
        const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;
        const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;

        return existsNotebook || existsGenericDialog;
    });
};

/**
 * Waits until the script is opened
 * @param connection The database connection
 * @returns A promise resolving when the script is opened
 */
export const scriptIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for script to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await PasswordDialog.setCredentials(connection);
            await driver.wait(dbConnectionIsSuccessful(), constants.wait15seconds);
        }

        return (await Notebook.getCurrentEditorName()).match(/Script/) !== null;
    });
};

/**
 * Waits until the MDS connection is opened
 * @param connection The database connection
 * @returns A promise resolving when the MDS connection is opened
 */
export const mdsConnectionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for MDS connection ${connection.caption} to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        const existsFingerPrintDialog = (await driver.findElements(locator.confirmDialog.exists)).length > 0;
        const existsEditor = (await driver.findElements(locator.notebook.codeEditor.textArea)).length > 0;
        const existsErrorDialog = (await driver.findElements(locator.errorDialog.exists)).length > 0;
        if (existsFingerPrintDialog) {
            await driver.findElement(locator.confirmDialog.accept).click();
        }
        if (existsPasswordDialog) {
            await PasswordDialog.setCredentials(connection);
        }
        if (existsErrorDialog) {
            const errorDialog = await driver.findElement(locator.errorDialog.exists);
            const errorMsg = await errorDialog.findElement(locator.errorDialog.message);
            throw new Error(await errorMsg.getText());
        }

        return existsEditor;
    });
};

/**
 * Waits until the shell session is opened
 * @param connection The database connection
 * @returns A promise resolving when the shell session is opened
 */
export const shellSessionIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
    return new Condition(`for Shell session ${connection.caption} to be opened`, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();
        const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
        if (existsPasswordDialog) {
            await PasswordDialog.setCredentials(connection);
            await driver.wait(shellSessionIsSuccessful(),
                constants.wait15seconds, "Shell session was not successful");
        }

        return (await driver.findElements(locator.shellConsole.editor)).length > 0;
    });
};

/**
 * Waits until the element is located within a context
 * @param context The context
 * @param locator The locator
 * @returns A promise resolving when the element is located
 */
export const elementLocated = (context: WebElement, locator: Locator): Condition<boolean> => {
    return new Condition(`for element ${String(locator)} to be found`, async () => {
        return (await context.findElements(locator)).length > 0;
    });
};

/**
 * Waits until the result tab of a query is maximized
 * @returns A promise resolving when the result tab is maximized
 */
export const resultTabIsMaximized = (): Condition<boolean> => {
    return new Condition(`for result tab to be maximized`, async () => {
        return (await driver.findElements(locator.notebook.codeEditor.editor.result.status.normalize)).length > 0;
    });
};

/**
 * Waits until the result tab of a query is normalized
 * @returns A promise resolving when the result tab is normalized
 */
export const resultTabIsNormalized = (): Condition<boolean> => {
    return new Condition(`for result tab to be maximized`, async () => {
        return (await driver.findElements(locator.notebook.codeEditor.editor.result.status.normalize)).length === 0;
    });
};

/**
 * Waits until the notebook's editor has a new prompt/line
 * @returns A promise resolving when the new prompt exists
 */
export const editorHasNewPrompt = (): Condition<boolean> => {
    return new Condition(`for editor to have a new prompt`, async () => {
        const editorSentences = await driver.findElements(locator.notebook.codeEditor.editor.sentence);

        return (await (editorSentences[editorSentences.length - 1]).getAttribute("innerHTML"))
            .match(/<span><\/span>/) !== null;
    });
};

/**
 * Waits until the notification exists
 * @param notification The notification
 * @param dismiss True to close the notification, false otherwise
 * @param expectFailure True if it expects a notification with failure/error
 * @returns A promise resolving when the notification exists
 */
export const notificationExists = (notification: string, dismiss = true,
    expectFailure = false): Condition<boolean> => {
    return new Condition(`for notification '${notification}' to be displayed`, async () => {
        try {
            if (Misc.insideIframe) {
                await Misc.switchBackToTopFrame();
            }

            const escapedText = notification.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            const ntfs = await new extWorkbench().getNotifications();
            for (const ntf of ntfs) {
                if (expectFailure === false) {
                    if (await ntf.getType() === NotificationType.Error) {
                        throw new Error("There is a notification with error");
                    }
                }
                if ((await ntf.getMessage()).match(new RegExp(escapedText)) !== null) {
                    if (dismiss) {
                        await Workbench.dismissNotifications();
                    }

                    return true;
                } else {
                    console.warn(`Found notification: ${await ntf.getMessage()}`);
                }
            }
        } catch (e) {
            if (!errors.isStaleError(e as Error)) {
                throw e;
            }
        }
    });
};

/**
 * Waits until the MySQL Shell for VS Code extension is fully loaded and ready to be tested
 * @returns A promise resolving when the extension is ready
 */
export const extensionIsReady = (): Condition<boolean> => {
    return new Condition("for the Extension to be ready", async () => {
        let tryNumber = 1;
        const feLoadTries = 3;
        let feWasLoaded = false;

        const loadTry = async (): Promise<void> => {
            console.log("<<<<Try to load FE>>>>>");
            await driver.wait(tabIsOpened("Welcome"), constants.wait10seconds, "Welcome tab was not opened");
            await Workbench.openMySQLShellForVSCode();
            await driver.wait(tabIsOpened(constants.dbDefaultEditor), constants.wait25seconds,
                `${constants.dbDefaultEditor} tab was not opened`);
            await Misc.switchToFrame();
            await driver.wait(isFELoaded(), constants.wait15seconds);
            console.log("<<<<FE was loaded successfully>>>>>");
        };

        while (tryNumber <= feLoadTries) {
            try {
                await loadTry();
                feWasLoaded = true;
                break;
            } catch (e) {
                tryNumber++;
                await Misc.switchBackToTopFrame();
                await Workbench.reloadVSCode();
            }
        }

        if (feWasLoaded === false) {
            console.log("<<<<MYSQLSH Logs>>>>");
            await Os.writeMySQLshLogs();
            const logs = driver.manage().logs();
            console.log("<<<<<DEV TOOLS Console log>>>>");
            console.log(await logs.get(logging.Type.BROWSER));

            const text = `Extension was not loaded successfully after ${feLoadTries} tries. Check the logs.`;
            // one last try to recover
            const path = join(await Os.getExtensionOutputLogsFolder(), constants.feLogFile);
            const output = (await fs.readFile(path)).toString();
            console.log("-----OUTPUT LOGS------");
            console.log(output);
            throw new Error(text);
        }

        credentialHelperOk = await Os.findOnMySQLShLog(/Failed to initialize the default helper/);
        credentialHelperOk = !credentialHelperOk;
        await Workbench.dismissNotifications();
        await Misc.switchBackToTopFrame();

        return true;
    });

};

/**
 * Waits until the a result grid cell is editable
 * @param commandExecutor The command executor object
 * @param rowNumber The row number
 * @param columnName The column name
 * @param expectInput True if the when the cell is editable, an input box is displayed
 * @returns A promise resolving when the extension is ready
 */
export const cellIsEditable = (commandExecutor: CommandExecutor, rowNumber: number,
    columnName: string, expectInput: boolean): Condition<boolean> => {
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

/**
 * Waits until the result grid is editable
 * @param resultGrid The result grid
 * @returns A promise resolving when the result grid is editable
 */
export const resultGridIsEditable = (resultGrid: WebElement): Condition<boolean> => {
    return new Condition(`for result grid to be editable`, async () => {
        const edit = await resultGrid.findElement(locator.notebook.codeEditor.editor.result.status.toolbar.editButton);

        return (await edit.getAttribute("class")).includes("disabled") === false;
    });
};

/**
 * Waits until the result grid cells were changed
 * @param resultGrid The result grid
 * @param changed The expected number of changed cells
 * @returns A promise resolving when the cells were changed
 */
export const cellsWereChanged = (resultGrid: WebElement, changed: number): Condition<boolean> => {
    return new Condition(`for changed ${changed} cells to be marked has changed (yellow background)`, async () => {
        return (await resultGrid
            .findElements(locator.notebook.codeEditor.editor.result.changedTableCell)).length === changed;
    });
};

/**
 * Waits until a row was added to a result grid
 * @param resultGrid The result grid
 * @returns A promise resolving when the row was added
 */
export const rowWasAdded = (resultGrid: WebElement): Condition<boolean> => {
    return new Condition(`for added table row`, async () => {
        return (await resultGrid.findElements(locator.notebook.codeEditor.editor.result.addedTableRow)).length > 0;
    });
};

/**
 * Waits until the rows were updated on a result grid
 * @param commandExecutor The command executor
 * @returns A promise resolving when rows were updated
 */
export const rowsWereUpdated = (commandExecutor: CommandExecutor): Condition<boolean> => {
    return new Condition(`for result message to match 'rows updated'`, async () => {
        await commandExecutor.refreshCommandResult(commandExecutor.getResultId());

        return commandExecutor.getResultMessage().match(/(\d+).*updated/) !== null;
    });
};

/**
 * Waits until the message "x number of rows were updated" is displayed on the result grid toolbar
 * @param commandExecutor The command executor
 * @returns A promise resolving when the message is displayed
 */
export const changedResultGridCellsAreDone = (commandExecutor: CommandExecutor): Condition<boolean> => {
    return new Condition(`for yellow background on result grid cells to not be displayed`, () => {
        return commandExecutor.getResultMessage().match(/(\d+).*updated/) !== null;
    });
};

/**
 * Waits until the row is marked for deletion (red background)
 * @param row The row
 * @returns A promise resolving when the row is marked for deletion
 */
export const rowIsMarkedForDeletion = (row: WebElement): Condition<boolean> => {
    return new Condition(`for row to be marked for deletion`, async () => {
        return (await row.getAttribute("class")).includes("deleted");
    });
};

/**
 * Waits until the confirmation dialog exists
 * @param context The context
 * @returns A promise resolving when the confirmation dialog exists
 */
export const confirmationDialogExists = (context?: string): Condition<WebElement> => {
    let msg = "for confirmation dialog to be displayed";
    if (context) {
        msg += ` ${context}`;
    }

    return new Condition(msg, async () => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const confirmDialog = await driver.findElements(locator.confirmDialog.exists);
        if (confirmDialog) {
            return confirmDialog[0];
        }
    });
};

/**
 * Waits until the database connection exists on the db connection overview page
 * @param dbConnection The database connection
 * @returns A promise resolving when the database connection exists
 */
export const existsOnDBConnectionOverview = (dbConnection: string): Condition<boolean> => {
    return new Condition(`${dbConnection} to exist`, async () => {
        const hosts = await driver.findElements(locator.dbConnectionOverview.dbConnection.tile);
        for (const host of hosts) {
            const el = await (await host
                .findElement(locator.dbConnectionOverview.dbConnection.caption)).getText();
            if (el === dbConnection) {
                return true;
            }
        }
    });
};

/**
 * Waits until the cell tooltip is equal to the expected value
 * @param commandExecutor The command executor
 * @param rowNumber The row number
 * @param rowColumn The column name
 * @param expectedTooltip The expected tooltip
 * @returns A promise resolving when the tooltip is equal to the expected value
 */
export const cellTooltipIs = (
    commandExecutor: CommandExecutor,
    rowNumber: number,
    rowColumn: string,
    expectedTooltip: string): Condition<boolean> => {
    return new Condition(` tooltip to be '${expectedTooltip}'`, async () => {
        const tooltip = await commandExecutor.getCellTooltip(rowNumber, rowColumn);

        return tooltip.replace(/\s/g, "") === expectedTooltip.replace(/\s/g, "");
    });
};

/**
 * Waits until a tab with json content to be opened
 * @param filename The file name
 * @returns A promise resolving when the tab with json content is opened
 */
export const jsonFileIsOpened = (filename: string): Condition<boolean> => {
    return new Condition(`${filename} to be opened`, async () => {
        const textEditor = new TextEditor();
        const json = await textEditor.getText();
        if (json.includes("{")) {
            return Misc.isJson(json);
        }
    });
};

