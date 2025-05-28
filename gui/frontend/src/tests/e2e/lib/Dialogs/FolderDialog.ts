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

import { until } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as locator from "../locators.js";
import * as constants from "../constants.js";

/**
 * This class aggregates the functions that perform folder dialog related operations
 */
export class FolderDialog {

    /**
     * Sets the folder dialog value
     * @param value The value to set
     */
    public static setFolderValue = async (value: string): Promise<void> => {
        const folderPathDialog = await driver.wait(until.elementLocated(locator.createNewFolderDialog.exists),
            constants.wait3seconds, "Could not find the Create Folder dialog");
        const path = await folderPathDialog
            .findElement(locator.createNewFolderDialog.name);
        await path.clear();
        await path.sendKeys(value);
    };

    /**
     * Clicks on the ok button of the dialog
     */
    public static ok = async (): Promise<void> => {
        const folderPathDialog = await driver.wait(until.elementLocated(locator.createNewFolderDialog.exists),
            constants.wait3seconds, "Could not find the Create Folder dialog");
        await folderPathDialog.findElement(locator.createNewFolderDialog.ok).click();
    };

    /**
     * Clicks on the cancel button of the dialog
     */
    public static cancel = async (): Promise<void> => {
        const folderPathDialog = await driver.wait(until.elementLocated(locator.createNewFolderDialog.exists),
            constants.wait3seconds, "Could not find the Create Folder dialog");
        await folderPathDialog.findElement(locator.createNewFolderDialog.cancel).click();
    };

}
