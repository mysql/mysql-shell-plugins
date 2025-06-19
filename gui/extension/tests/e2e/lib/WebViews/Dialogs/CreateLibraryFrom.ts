/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { WebElement, until } from "vscode-extension-tester";
import { Workbench } from "../../Workbench";
import { driver, Misc } from "../../Misc";
import * as locator from "../../locators.js";
import * as constants from "../../constants.js";

/**
 * This class aggregates the functions that perform create library dialog related operations
 */
export class CreateLibraryDialog {

    /**
     * The dialog
     */
    public dialog: WebElement | undefined;

    /**
     * Verifies if confirm dialog exists
     *
     * @param timeout The timeout
     * @returns A promise resolving with the dialog if the dialog exists, false otherwise
     */
    public untilExists = async (timeout = constants.wait1second * 3): Promise<CreateLibraryDialog> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();
        await driver.wait(async () => {
            const dialog = await driver.findElements(locator.createLibraryDialog.exists);

            if (dialog.length > 0) {
                this.dialog = dialog[0];

                return true;
            }
        }, timeout, `Waiting for Create Library dialog to exist`);

        return this;
    };

    /**
     * Sets the schema name
     *
     * @param name The schema name
     * @returns A promise resolving when the schema name is set
     */
    public setSchemaName = async (name: string): Promise<void> => {
        const input = await this.dialog.findElement(locator.createLibraryDialog.schemaName);
        await input.clear();
        await input.sendKeys(name);
    };

    /**
     * Sets the library name
     *
     * @param name The library name
     * @returns A promise resolving when the library name is set
     */
    public setLibraryName = async (name: string): Promise<void> => {
        const input = await this.dialog.findElement(locator.createLibraryDialog.libraryName);
        await input.clear();
        await input.sendKeys(name);
    };

    /**
     * Selects the library name
     *
     * @param name The library name
     * @returns A promise resolving when the library name is set
     */
    public setLanguage = async (name: string): Promise<void> => {
        await this.dialog.findElement(locator.createLibraryDialog.language.exists).click();
        await driver.wait(until.elementLocated(locator.createLibraryDialog.language.selectList.exists),
            constants.wait1second * 3);
        await driver.findElement(locator.createLibraryDialog.language.selectList.item(name)).click();
    };

    /**
     * Selects the load from
     * @param name The load from
     * @returns A promise resolving when the load from is set
     */
    public setLoadFrom = async (name: string): Promise<void> => {
        await this.dialog.findElement(locator.createLibraryDialog.loadFrom.exists).click();
        await driver.wait(until.elementLocated(locator.createLibraryDialog.loadFrom.selectList.exists), constants.wait1second * 3);
        await driver.findElement(locator.createLibraryDialog.loadFrom.selectList.item(name)).click();
    };

    /**
     * Sets the comment
     *
     * @param comment The comment
     * @returns A promise resolving when the library name is set
     */
    public setComment = async (comment: string): Promise<void> => {
        const input = await this.dialog.findElement(locator.createLibraryDialog.comment);
        await input.clear();
        await input.sendKeys(comment);
    };

    /**
     * Sets the URL
     *
     * @param url The url
     * @returns A promise resolving when the library url is set
     */
    public setURL = async (url: string): Promise<void> => {
        const input = await this.dialog.findElement(locator.createLibraryDialog.url);
        await input.clear();
        await input.sendKeys(url);
    };

    /**
     * Sets the path
     *
     * @param path The path
     * @returns A promise resolving when the path is set
     */
    public setPath = async (path: string): Promise<void> => {
        await (await this.dialog.findElement(locator.createLibraryDialog.path)).click();
        await Workbench.setInputPath(path);
        await Misc.switchToFrame();
    };

    /**
     * Clicks on the accept button of the dialog
     */
    public ok = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.createLibraryDialog.ok), constants.wait1second * 3,
            "Could not find the accept button").click();
    };

    /**
     * Clicks on the cancel button of the dialog
     */
    public cancel = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.createLibraryDialog.cancel), constants.wait1second * 3,
            "Could not find the cancel button").click();
    };
}
