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
import { Condition, until, error } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { Toolbar } from "./Toolbar.js";
import * as interfaces from "./interfaces.js";
import { PasswordDialog } from "./Dialogs/PasswordDialog.js";
import { Misc } from "./misc.js";
import { Explorer } from "./Explorer.js";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class E2ENotebook {

    /** The explorer*/
    public explorer = new Explorer();

    /** The toolbar*/
    public toolbar = new Toolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(this);

    /**
     * Waits until the MDS connection is opened
     * @param connection The database connection
     * @returns A promise resolving when the MDS connection is opened
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for connection ${connection.caption} to be opened`, async () => {
            const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
            const existsFingerPrintDialog = (await driver.findElements(locator.confirmDialog.exists)).length > 0;

            if (existsFingerPrintDialog) {
                await driver.findElement(locator.confirmDialog.accept).click();
            }

            if (existsPasswordDialog) {
                await PasswordDialog.setCredentials(connection);
                await driver.wait(this.untilDbConnectionIsSuccessful(), constants.wait10seconds).catch(async () => {
                    const existsErrorDialog = (await driver.findElements(locator.errorDialog.exists)).length > 0;
                    if (existsErrorDialog) {
                        const errorDialog = await driver.findElement(locator.errorDialog.exists);
                        const errorMsg = await errorDialog.findElement(locator.errorDialog.message);
                        throw new Error(await errorMsg.getText());
                    } else {
                        throw new Error("Unknown error");
                    }
                });
            }

            const existsGenericDialog = (await driver.findElements(locator.genericDialog.exists)).length > 0;
            const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

            return existsNotebook || existsGenericDialog;
        });
    };

    /**
     * Verifies if a sql and result status exist on the notebook
     * @param sql The sql query
     * @param resultStatus The result status
     * @returns A promise resolving when the notebook is verified
     */
    public verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {
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
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");


        if (!notebookCommands.includes(sql)) {
            throw new Error(`Could not find the SQL statement ${sql} on the notebook`);
        }

        let foundResult = false;
        const results = await driver.findElements(locator.notebook.codeEditor.editor.result.toolbar.status.exists);
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
    public existsOnNotebook = async (word: string): Promise<boolean> => {
        const commands: string[] = [];
        const regex = Misc.transformToMatch(word);
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
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");

        return commands.toString().match(regex) !== null;
    };

    public close = async (name: string): Promise<void> => {

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
     * Waits until the database connection is successful
     * @returns A promise resolving when the database connection is successful
     */
    private untilDbConnectionIsSuccessful = (): Condition<boolean> => {
        return new Condition("for DB Connection is successful", async () => {
            const editorSelectorExists = (await driver.findElements(locator.notebook.toolbar.editorSelector.exists))
                .length > 0;
            const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

            return editorSelectorExists || existsNotebook;
        });
    };

}
