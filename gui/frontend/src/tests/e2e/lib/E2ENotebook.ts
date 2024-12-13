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
import { Misc } from "./misc.js";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { E2EToolbar } from "./E2EToolbar.js";
import * as interfaces from "./interfaces.js";
import { PasswordDialog } from "./Dialogs/PasswordDialog.js";
import { ConfirmDialog } from "./Dialogs/ConfirmationDialog.js";
import { E2ETabContainer } from "./E2ETabContainer.js";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class E2ENotebook {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(this);

    /**
     * Verifies if the Notebook is opened and fully loaded
     * @param connection The database connection
     * @returns A condition resolving to true if the page is opened, false otherwise
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for connection ${connection.caption} to be opened`, async () => {
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

                return (await tabContainer.getTab(connection.caption!)) !== undefined;
            };

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);
            }

            return isOpened();
        });
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
}
