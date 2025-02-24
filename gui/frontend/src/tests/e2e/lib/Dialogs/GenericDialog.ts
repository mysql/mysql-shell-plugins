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

import { WebElement, until } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as locator from "../locators.js";
import * as constants from "../constants.js";

/**
 * This class aggregates the functions that perform confirm dialog related operations
 */
export class GenericDialog {

    /**
     * The dialog
     */
    public dialog: WebElement | undefined;

    /**
     * Verifies if confirm dialog exists
     * @returns A promise resolving to true if the dialog is displayed, false otherwise
     */
    public exists = async (): Promise<boolean> => {
        return (await driver.findElements(locator.genericDialog.exists)).length > 0;
    };

    /**
     * Verifies if confirm dialog exists
     * @param timeout The timeout
     * @returns A promise resolving with the dialog if the dialog exists, false otherwise
     */
    public untilExists = async (timeout = constants.wait3seconds): Promise<GenericDialog> => {
        await driver.wait(async () => {
            const dialog = await driver.findElements(locator.genericDialog.exists);

            if (dialog.length > 0) {
                this.dialog = dialog[0];

                return true;
            }
        }, timeout, `Waiting for generic dialog to exist`);

        return this;
    };

    /**
     * Selects an item from the select list
     * @param value The value to select
     */
    public selectFromList = async (value: string): Promise<void> => {
        const selectList = await driver.wait(until.elementLocated(locator.genericDialog.selectList.exists),
            constants.wait3seconds, "Could not find the select list");
        await selectList.click();
        await driver.wait(until.elementLocated(locator.genericDialog.selectList.list.exists));
        await driver.findElement(locator.genericDialog.selectList.list.item(value)).click();
    };

    /**
     * Clicks on the ok button of the dialog
     */
    public ok = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.confirmDialog.ok), constants.wait3seconds,
            "Could not find the accept button").click();
    };

    /**
     * Clicks on the accept button of the dialog
     */
    public accept = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.confirmDialog.accept), constants.wait3seconds,
            "Could not find the accept button").click();
    };

    /**
     * Clicks on the cancel button of the dialog
     */
    public cancel = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.confirmDialog.cancel), constants.wait3seconds,
            "Could not find the cancel button").click();
    };

    /**
     * Clicks on the refuse button of the dialog
     */
    public refuse = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.confirmDialog.refuse), constants.wait3seconds,
            "Could not find the refuse button").click();
    };

    /**
     * Clicks on the alternative button of the dialog
     */
    public alternative = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.confirmDialog.alternative), constants.wait3seconds,
            "Could not find the alternative button").click();
    };

}
