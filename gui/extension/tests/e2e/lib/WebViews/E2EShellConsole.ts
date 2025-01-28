/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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

import { until, Workbench as extWorkbench, NotificationType } from "vscode-extension-tester";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import { driver, Misc } from "../Misc";
import { E2ECodeEditor } from "./E2ECodeEditor";
import { E2EToolbar } from "./E2EToolbar";
import { PasswordDialog } from "./Dialogs/PasswordDialog";
import { E2ECommandResultData } from "./CommandResults/E2ECommandResultData";
import { E2ECommandResultGrid } from "./CommandResults/E2ECommandResultGrid";
import { credentialHelperOk, Workbench } from "../Workbench";
import { ConfirmDialog } from "./Dialogs/ConfirmationDialog";

/**
 * This class represents the Shell console
 */
export class E2EShellConsole {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(1);

    /**
     * Waits until the shell session is opened
     * @param connection The database connection
     * @param timeout The timeout
     * @returns A promise resolving when the shell session is opened
     */
    public untilIsOpened = async (
        connection?: interfaces.IDBConnection | undefined,
        timeout = constants.wait10seconds): Promise<E2EShellConsole> => {

        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        await driver.wait(async () => {
            const confirmDialog = new ConfirmDialog();
            const existsFingerPrintDialog = await confirmDialog.exists();

            if (existsFingerPrintDialog) {
                await confirmDialog.accept();
            }

            const isOpened = async (): Promise<boolean> => {
                const notifications = await new extWorkbench().getNotifications();

                if (notifications.length > 0) {
                    for (const notification of notifications) {

                        if (await notification.getType() === NotificationType.Error) {
                            throw new Error(await notification.getMessage());
                        } else {
                            await Workbench.dismissNotifications();
                            break;
                        }
                    }
                }

                if ((await driver.findElements(locator.shellConsole.editor)).length > 0) {
                    this.codeEditor = await this.codeEditor.build();

                    return true;
                } else {
                    return false;
                }
            };

            if (connection) {
                if (await PasswordDialog.exists()) {
                    await PasswordDialog.setCredentials(connection);
                }
            }

            return isOpened();
        }, timeout, `Could not open the notebook`);

        return this;
    };

    /**
     * Changes the schema using the top tab
     *
     * @param schema The schema
     * @returns A promise resolving with the command result
     */
    public changeSchema = async (schema: string): Promise<E2ECommandResultData> => {
        const tabSchema = await driver.findElement(locator.shellConsole.connectionTab.schema);
        await tabSchema.click();
        const menu = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schemaMenu),
            constants.wait5seconds, "Schema list was not displayed");
        const items = await menu.findElements(locator.shellConsole.connectionTab.schemaItem);

        for (const item of items) {
            if ((await item.getAttribute("innerHTML")).includes(schema)) {
                await item.click();
                break;
            }
        }

        await driver.wait(async () => {
            return (await driver.findElement(locator.shellConsole.connectionTab.schema).getText()).includes(schema);
        }, constants.wait5seconds, `${schema} was not selected`);

        const commandResult = await this.codeEditor.getLastExistingCommandResult(true);

        return commandResult as E2ECommandResultData;
    };

    /**
     * Deletes all stored credentials on the key chain, using shell
     * @returns A promise resolving when the command is executed
     */
    public deleteCredentials = async (): Promise<void> => {
        const cmd = "shell.deleteAllCredentials()";
        await this.codeEditor.write(cmd, false);
        await this.codeEditor.exec();

        if (!credentialHelperOk) {
            // we expect an error on the console
            await this.codeEditor.buildResult(cmd, this.codeEditor.lastResultId + 1);
            this.codeEditor.lastResultId++;
        }
    };

    /**
     * Executes a language switch on the editor (sql, python, typescript or javascript)
     *
     * @param cmd The command to change the language
     * @returns A promise resolving when the command is executed
     */
    public languageSwitch = async (cmd: string): Promise<E2ECommandResultData> => {

        if (!this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.execute() or others'");
        }

        await this.codeEditor.write(cmd);
        await this.codeEditor.exec();

        const commandResult = await this.codeEditor.buildResult(cmd, this.codeEditor.lastResultId + 1);
        this.codeEditor.lastResultId++;

        return commandResult as E2ECommandResultData;

    };

    /**
     * Executes a command on the editor, setting the credentials right after the execution is triggered
     *
     * @param cmd The command
     * @param dbConnection The DB Connection to use
     * @returns A promise resolving when the command is executed
     */
    public executeExpectingCredentials = async (cmd: string, dbConnection: interfaces.IDBConnection,
    ): Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {

        if (this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        await this.codeEditor.write(cmd);
        await this.codeEditor.exec();
        await PasswordDialog.setCredentials(dbConnection);

        const commandResult = await this.codeEditor.buildResult(cmd, this.codeEditor.lastResultId + 1);
        this.codeEditor.lastResultId++;

        return commandResult;
    };

}
