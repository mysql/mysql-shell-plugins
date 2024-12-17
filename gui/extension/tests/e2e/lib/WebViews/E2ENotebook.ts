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
import { Condition, until, Workbench as extWorkbench, NotificationType } from "vscode-extension-tester";
import { driver, Misc } from "../Misc";
import * as constants from "../constants";
import * as locator from "../locators";
import * as errors from "../errors";
import { E2ECodeEditor } from "./E2ECodeEditor";
import { Toolbar } from "./Toolbar";
import * as interfaces from "../interfaces";
import { PasswordDialog } from "./Dialogs/PasswordDialog";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class E2ENotebook {

    /** The toolbar*/
    public toolbar = new Toolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(this);

    /**
     * Verifies if the Notebook is opened and fully loaded
     * @param connection The database connection
     * @returns A condition resolving to true if the page is opened, false otherwise
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for connection ${connection.caption} to be opened`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            const existsFingerPrintDialog = (await driver.findElements(locator.confirmDialog.exists)).length > 0;

            if (existsFingerPrintDialog) {
                await driver.findElement(locator.confirmDialog.accept).click();
            }

            const isOpened = async (): Promise<boolean> => {
                await Misc.switchBackToTopFrame();
                const notifications = await new extWorkbench().getNotifications();

                if (notifications.length > 0) {

                    for (const notification of notifications) {

                        if (await notification.getType() === NotificationType.Error) {
                            let errorMessage = "";

                            if ((await notification.getMessage()).includes("could not be opened")) {
                                errorMessage = constants.ociFailure;
                            } else {
                                errorMessage = await notification.getMessage();
                            }

                            throw new Error(errorMessage);
                        } else {
                            throw new Error(await notification.getMessage());
                        }
                    }
                } else {
                    await Misc.switchToFrame();
                }

                const existsScript = (await driver.findElements(locator.notebook.codeEditor.editor.host))
                    .length > 0;
                const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

                return existsScript || existsNotebook;
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
    public exists = async (word: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

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
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "No SQL commands were found on the notebook");

        return commands.toString().match(regex) !== null;
    };

}
