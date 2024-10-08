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
import { WebElement, until } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { E2ECodeEditor } from "./E2ECodeEditor.js";
import * as interfaces from "./interfaces.js";

/**
 * This class aggregates the functions that perform operations inside notebooks
 */
export class E2EShellSession {

    /** The code editor*/
    public codeEditor = new E2ECodeEditor(this);

    /** The session id*/
    private id: string | undefined;

    public constructor(id: string) {
        this.id = id;
    }

    /**
     * Gets the GUI Console tab
     * @returns Promise resolving with the tab
     */
    public getGuiConsoleTab = async (): Promise<WebElement> => {
        return driver.findElement(locator.shellPage.guiConsoleTab);
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

    /**
     * Closes this shell session
     * @returns Promise resolving when the session is closed
     */
    public close = async (): Promise<void> => {
        const tabs = await driver.findElements(locator.shellPage.sessionTabs);

        for (const tab of tabs) {
            if (await tab.getAttribute("id") === `session_${this.id}`) {
                await tab.findElement(locator.shellSession.close).click();

                return;
            }
        }

        throw new Error(`Could not find session tab ${this.id} to close`);
    };

}
