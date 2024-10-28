/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { WebElement, until, error, Condition } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as constants from "./constants.js";
import * as interfaces from "./interfaces.js";
import * as locator from "./locators.js";
import { CommandResult } from "./CommandResult.js";
import { ConfirmDialog } from "./Dialogs/ConfirmationDialog.js";

const toolbarLocator = locator.notebook.codeEditor.editor.result.toolbar;

export class CommandResultToolbar implements interfaces.ICommandResultToolbar {

    /** The result it belongs to*/
    public result: CommandResult | undefined;

    /** The status*/
    public status: string | undefined;

    public constructor(commandResult: CommandResult) {
        this.result = commandResult;
    }

    /**
     * Sets the toolbar status message
     * @returns A promise resolving when the toolbar status message is set
     */
    public setStatus = async (): Promise<void> => {
        let status: WebElement | undefined;

        await driver.wait(async () => {
            status = await this.result!.context!.findElement(toolbarLocator.status.text);

            return (await status.getText()) !== "";
        }, constants.wait5seconds, `The status is empty for cmd ${this.result!.command}`);

        this.status = await status!.getText();
    };

    /**
     * Verifies if the toolbar status matches a message
     * @param message The message
     * @returns A condition resolving to true if the message matches the status of the toolbar, false otherwise
     */
    public untilStatusMatches = (message: RegExp): Condition<boolean> => {
        return new Condition(`for result message to match '${String(message)}'`, async () => {
            await this.result?.loadResult();

            return this.result!.toolbar!.status!.match(message) !== null;
        });
    };

    /**
     * Maximizes the result grid
     * @returns A promise resolving when the result is maximized
     */
    public maximize = async (): Promise<void> => {
        await this.result!.context!.findElement(toolbarLocator.maximize).click();
        await driver.wait(this.result!.untilIsMaximized(), constants.wait5seconds);
    };

    /**
     * Selects a view
     * @param name The view name
     * @returns A promise resolving when the view is selected
     */
    public selectView = async (name: string): Promise<void> => {
        const view = await this.result!.context!.findElement(toolbarLocator.view.exists);
        await view.click();
        await driver.wait(until.elementLocated(toolbarLocator.view.isVisible), constants.wait5seconds,
            "Could not find the result grid view drop down list");

        if (name === constants.gridView) {
            await driver.findElement(toolbarLocator.view.grid).click();
        } else if (name === constants.previewView) {
            await driver.findElement(toolbarLocator.view.preview).click();
        } else {
            throw new Error(`Could not find the view with name ${name}`);
        }

        await this.result!.loadResult();
    };

    /**
     * Gets the SQL Preview generated for a string
     * @returns A promise resolving with the sql preview
     */
    public selectSqlPreview = async (): Promise<void> => {
        await this.result!.context!.findElement(toolbarLocator.previewButton).click();
        await this.result!.loadResult();
    };

    /**
     * Clicks on the Apply Changes button of a result grid
     * @returns A promise resolving when the button is clicked
     */
    public applyChanges = async (): Promise<void> => {
        await driver.executeScript("arguments[0].click()",
            await this.result!.context!.findElement(toolbarLocator.applyButton));
        await this.result!.loadResult();
    };

    /**
     * Clicks on the Rollback Changes button of a result grid
     * @returns A promise resolving when the button is clicked
     */
    public rollbackChanges = async (): Promise<void> => {
        await this.result!.context!.findElement(toolbarLocator.rollbackButton).click();
        const dialog = await new ConfirmDialog().untilExists();
        await dialog.accept();
    };

    /**
     * Closes the current result set
     * @returns A promise resolving when the result set is closed
     */
    public closeResultSet = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    return (await this.result!.context!
                        .findElements(toolbarLocator.showActionMenu.open)).length > 0;
                }, constants.wait5seconds, "Could not find Show Actions button");

                const showActions = await this.result!.context!
                    .findElement(toolbarLocator.showActionMenu.open);
                await driver.executeScript("arguments[0].click()", showActions);

                await driver.wait(async () => {
                    return (await driver.findElements(toolbarLocator.showActionMenu.exists))
                        .length > 0;
                }, constants.wait5seconds, "Action menu was not displayed");

                const menu = await driver.findElement(toolbarLocator.showActionMenu.exists);
                await menu.findElement(toolbarLocator.showActionMenu.closeResultSet).click();

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, "Show actions button was not interactable");

        this.result!.id = String(parseInt(this.result!.id!, 10) - 1);
    };

    /**
     * Gets the edit button
     * @returns A promise resolving with the edit button
     */
    public getEditButton = async (): Promise<WebElement | undefined> => {
        return this.result?.context?.findElement(toolbarLocator.editButton);
    };

    /**
     * Starts the editing of a grid
     * @returns A promise resolving when the edit button is clicked
     */
    public edit = async (): Promise<void> => {
        await (await this.getEditButton())!.click();
    };
}
