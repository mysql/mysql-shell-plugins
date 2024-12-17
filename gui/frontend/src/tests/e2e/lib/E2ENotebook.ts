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
import { Condition, until, error, WebElement } from "selenium-webdriver";
import { driver } from "./driver.js";
import { Misc } from "./misc.js";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { E2EToolbar } from "./E2EToolbar.js";
import * as interfaces from "./interfaces.js";
import { PasswordDialog } from "./Dialogs/PasswordDialog.js";
import { ConfirmDialog } from "./Dialogs/ConfirmationDialog.js";
import { E2ETabContainer } from "./E2ETabContainer.js";
import { E2ECommandResultGrid } from "./CommandResults/E2ECommandResultGrid.js";
import { E2ECommandResultData } from "./CommandResults/E2ECommandResultData.js";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class E2ENotebook {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(1);

    /**
     * Verifies if the Notebook is opened and fully loaded
     * @param connection The database connection
     * @param timeout The timeout
     * @returns A condition resolving to true if the page is opened, false otherwise
     */
    public untilIsOpened = async (
        connection: interfaces.IDBConnection,
        timeout = constants.wait10seconds): Promise<E2ENotebook> => {

        await driver.wait(async () => {
            const confirmDialog = new ConfirmDialog();
            const existsFingerPrintDialog = await confirmDialog.exists();

            if (existsFingerPrintDialog) {
                await confirmDialog.accept();
            }

            const isOpened = async (): Promise<boolean> => {
                const notifications = await Misc.getToastNotifications();

                if (notifications.length > 0) {
                    for (const notification of notifications) {

                        if (notification!.type === "error") {
                            let errorMessage = "";

                            if (notification?.message.includes("could not be opened")) {
                                errorMessage = constants.ociFailure;
                            } else {
                                errorMessage = notification!.message;
                            }

                            throw new Error(errorMessage);
                        } else {
                            throw new Error(notification!.message);
                        }
                    }
                }

                const tabContainer = new E2ETabContainer();

                if ((await tabContainer.getTab(connection.caption!)) !== undefined) {
                    this.codeEditor = await this.codeEditor.build();

                    return true;
                } else {
                    return false;
                }
            };

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);
            }

            return isOpened();
        }, timeout, `Could not open notebook for ${connection.caption}`);

        return this;
    };

    /**
     * Verifies if a word exists on the notebook
     * @param word The word
     * @returns A promise resolving with true if the word is found, false otherwise
     */
    public untilExists = (word: string): Condition<boolean> => {
        return new Condition(`for '${word}' to exist on the notebook`, async () => {
            return this.exists(word);
        });
    };

    /**
     * Verifies if a word exists on the notebook
     * @param word The word
     * @returns A promise resolving with true if the word is found, false otherwise
     */
    public exists = async (word: string): Promise<boolean> => {
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
        }, constants.wait3seconds, "No SQL commands were found on the notebook");

        return commands.toString().match(regex) !== null;
    };

    /**
     * Executes a command on the editor using a toolbar button
     *
     * @param cmd The command
     * @param button The button to click, to trigger the execution
     * @returns A promise resolving when the command is executed
     */
    public executeWithButton = async (cmd: string, button: string):
        Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        if (this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.codeEditor.languageSwitch()'");
        }

        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.codeEditor.findCmdAndExecute()'");
        }

        await this.codeEditor.write(cmd);
        await (await this.toolbar.getButton(button))!.click();
        const commandResult = await this.codeEditor.buildResult(cmd, this.codeEditor.lastResultId! + 1);
        this.codeEditor.lastResultId!++;

        return commandResult;
    };

    /**
     * Searches for a command on the editor, and execute it,
     * using the Exec Caret button Verify the result on this result id
     * @param cmd The command
     * @param resultId Verify the result on this result id
     * @returns A promise resolving when the command is executed
     */
    public findAndExecute = async (cmd: string, resultId: number):
        Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        if (this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.codeEditor.setMouseCursorAt(cmd);

        if (await this.toolbar.existsButton(constants.execCaret)) {
            const toolbarButton = await this.toolbar.getButton(constants.execCaret);
            await driver.executeScript("arguments[0].click()", toolbarButton);
        } else {
            const button = await this.toolbar.getButton(constants.execFullBlockJs);
            await driver.executeScript("arguments[0].click()", button);
        }

        return this.codeEditor.buildResult(cmd, resultId);
    };

    /**
     * Executes a command on the editor using a context menu item
     *
     * @param cmd The command
     * @param item The context menu item to click, to trigger the execution
     * @returns A promise resolving when the command is executed
     */
    public executeWithContextMenu = async (cmd: string, item: string):
        Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        if (this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.codeEditor.languageSwitch()'");
        }

        await this.codeEditor.write(cmd);
        await this.clickContextItem(item);
        const id = this.codeEditor.lastResultId! + 1;
        const commandResult = this.codeEditor.buildResult(cmd, id);
        this.codeEditor.lastResultId!++;

        return commandResult;
    };

    /**
     * Clicks on a context menu item
     * @param item The item
     * @returns A promise resolving when the click is performed
     */
    public clickContextItem = async (item: string): Promise<void> => {
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
}
