/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { Condition } from "vscode-extension-tester";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import { driver, Misc } from "../Misc";
import { E2ECodeEditor } from "./E2ECodeEditor";
import { E2EToolbar } from "./E2EToolbar";
import { PasswordDialog } from "./Dialogs/PasswordDialog";
import { E2ECommandResultData } from "./CommandResults/E2ECommandResultData";
import { E2ECommandResultGrid } from "./CommandResults/E2ECommandResultGrid";

/**
 * This class represents the Script page
 */
export class E2EScript {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    public codeEditor = new E2ECodeEditor();

    /**
     * Waits until the shell session is opened
     * @param connection The database connection
     * @returns A promise resolving when the shell session is opened
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {

        return new Condition(`for script to be opened`, async () => {
            const editorSelectorLocator = locator.notebook.toolbar.editorSelector.exists;

            if (!(await Misc.insideIframe())) {
                await Misc.switchToFrame();
            }

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);
                await driver.wait(async () => {
                    const editorSelectorExists = (await driver.findElements(editorSelectorLocator))
                        .length > 0;
                    const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

                    return editorSelectorExists || existsNotebook;
                }, constants.wait15seconds, `Could not connect to '${connection.caption}'`);
            }

            const currentEditor = (await this.toolbar.editorSelector.getCurrentEditor()).label;
            const regex = /(Script|.sql|.ts|.js|Data)/;

            return (currentEditor).match(regex) !== null;
        });

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
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.findCmdAndExecute()'");
        }

        await this.codeEditor.write(cmd);
        await (await this.toolbar.getButton(button)).click();

        return this.codeEditor.buildResult(cmd, undefined);
    };

    /**
     * Returns the result on the editor
     *
     * @returns A promise resolving with the script result
     */
    public getResult = async (): Promise<E2ECommandResultGrid | E2ECommandResultData | undefined> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        return this.codeEditor.buildResult("", undefined);
    };

}
