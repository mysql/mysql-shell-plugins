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

import { driver } from "../../lib/driver.js";
import * as locator from "../locators.js";
import { Condition } from "selenium-webdriver";

export class Overview {

    /**
     * Verifies if the Overview tab is selected
     * @returns A promise resolving to true if the tab is selected, false otherwise
     */
    public untilIsOpened = (): Condition<boolean> => {
        return new Condition("for Overview page to be opened", async () => {
            const tab = await driver.findElement(locator.lakeHouseNavigator.overview.tab);

            return (await tab.getAttribute("class")).includes("selected");
        });
    };

    /**
     * Clicks on the Upload Files button
     * @returns A promise resolving when the Upload Files button is clicked
     */
    public clickUploadFiles = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.overview.uploadFiles).click();
    };

    /**
     * Clicks on the Start Load button
     * @returns A promise resolving when the Start Load button is clicked
     */
    public clickStartLoad = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.overview.startLoad).click();
    };

    /**
     * Clicks on the Manage Lakehouse button
     * @returns A promise resolving when the Manage Lakehouse button is clicked
     */
    public clickManageLakehouse = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.overview.manageLakeHouse).click();
    };
}
