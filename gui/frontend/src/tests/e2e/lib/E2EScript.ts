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

import { Condition, until, error } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import * as interfaces from "./interfaces.js";
import { driver } from "./driver.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { E2EToolbar } from "./E2EToolbar.js";
import { PasswordDialog } from "./Dialogs/PasswordDialog.js";
import { CommandResult } from "./CommandResult.js";
import { ResultGrid } from "./CommandResults/ResultGrid.js";
import { ResultData } from "./CommandResults/ResultData.js";
import { Os } from "./os.js";

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

            return (currentEditor).match(/Script/) !== null ||
                (currentEditor).match(/.sql/) !== null ||
                (currentEditor).match(/.ts/) !== null ||
                (currentEditor).match(/.js/) !== null;
        });

    };

    /**
     * Returns the last existing script result on the editor
     *
     * @returns A promise resolving with the script result
     */
    public getLastResult = async (): Promise<interfaces.ICommandResult> => {
        const commandResult = new CommandResult(this.codeEditor);
        await commandResult.loadResult(true);

        return commandResult;
    };

    /**
     * Executes a command on the editor using a toolbar button
     *
     * @param cmd The command
     * @param button The button to click, to trigger the execution
     * @returns A promise resolving when the command is executed
     */
    public executeWithButton = async (cmd: string, button: string):
        Promise<ResultGrid | ResultData | undefined> => {

        if (this.codeEditor.isSpecialCmd(cmd)) {
            throw new Error("Please use the function 'this.languageSwitch()'");
        }

        if (button === constants.execCaret) {
            throw new Error("Please use the function 'this.findCmdAndExecute()'");
        }

        await this.codeEditor.write(cmd);
        await (await this.toolbar.getButton(button))!.click();
        //const id = searchOnExistingId ?? await this.codeEditor
        //    .getNextResultId(this.codeEditor.resultIds[this.codeEditor.resultIds.length - 1]);
        //const commandResult = new CommandResult(this.codeEditor, cmd, id);
        //await commandResult.loadResult();
        //this.codeEditor.resultIds.push(commandResult.id!);

        return this.codeEditor.buildResult(cmd, undefined);
    };

}
