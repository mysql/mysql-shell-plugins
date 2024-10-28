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

import { until, Condition } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import * as interfaces from "./interfaces.js";
import { driver } from "./driver.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import { E2EToolbar } from "./E2EToolbar.js";
import { PasswordDialog } from "./Dialogs/PasswordDialog.js";

/**
 * This class represents the Shell console
 */
export class E2EShellConsole {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(this);

    /**
     * Clicks on the button "Open New Shell Console"
     * @returns A promise resolving when the shell session is opened
     */
    public openNewShellConsole = (): Promise<void> => {
        return driver.findElement(locator.shellConsole.openNewShellConsole).click();
    };

    /**
     * Waits until the shell session is opened
     * @param connection The database connection
     * @returns A promise resolving when the shell session is opened
     */
    public untilIsOpened = (connection?: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for Shell console to be opened`, async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection!);
            }

            return (await driver.findElements(locator.shellConsole.editor)).length > 0;
        });
    };

    /**
     * Changes the schema using the top tab
     *
     * @param schema The schema
     * @returns A promise resolving with the command result
     */
    public changeSchema = async (schema: string): Promise<interfaces.ICommandResult> => {
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
        this.codeEditor.resultIds.push(commandResult.id!);

        return commandResult;
    };

}
