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

import { Condition } from "vscode-extension-tester";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import { driver, Misc } from "../Misc";
import { E2ECodeEditor } from "./E2ECodeEditor";
import { Toolbar } from "./Toolbar";
import { PasswordDialog } from "./PasswordDialog";
import { CommandResult } from "./CommandResult";

/**
 * This class represents the Script page
 */
export class Script {

    /** The toolbar*/
    public toolbar = new Toolbar();

    /**
     * Waits until the shell session is opened
     * @param connection The database connection
     * @returns A promise resolving when the shell session is opened
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {

        return new Condition(`for script to be opened`, async () => {
            const editorSelectorLocator = locator.notebook.toolbar.editorSelector.exists;
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            const existsPasswordDialog = (await driver.findElements(locator.passwordDialog.exists)).length > 0;
            if (existsPasswordDialog) {
                await PasswordDialog.setCredentials(connection);
                await driver.wait(async () => {
                    const editorSelectorExists = (await driver.findElements(editorSelectorLocator))
                        .length > 0;
                    const existsNotebook = (await driver.findElements(locator.notebook.exists)).length > 0;

                    return editorSelectorExists || existsNotebook;
                }, constants.wait15seconds, `Could not connect to '${connection.caption}'`);
            }

            return ((await this.toolbar.getCurrentEditor()).label).match(/Script/) !== null;
        });

    };

    /**
     * Executes the code within the script
     *
     * @param cmd The command
     * @param slowWriting True if the command should be written with a delay between each character
     * @returns A promise resolving with the script result
     */
    public executeCode = async (cmd: string, slowWriting = false): Promise<interfaces.ICommandResult> => {

        const codeEditor = new E2ECodeEditor(this);
        await codeEditor.write(cmd, slowWriting);
        await codeEditor.exec();
        const commandResult = new CommandResult(codeEditor, cmd);
        await commandResult.loadResult(true);

        return commandResult;

    };

    /**
     * Returns the last existing script result on the editor
     *
     * @returns A promise resolving with the script result
     */
    public getLastResult = async (): Promise<interfaces.ICommandResult> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const codeEditor = new E2ECodeEditor(this);
        const commandResult = new CommandResult(codeEditor);
        await commandResult.loadResult(true);

        return commandResult;
    };

}
