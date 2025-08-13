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
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import { driver } from "../driver.js";
/**
 * This class represents the Workbench page object
 */
export class E2EWorkbench {
    /**
     * Selects a context menu item from the Workbench submenu
     * 
     *  @param itemName The context menu item name
     */
    public selectFromSubmenu = async (itemName: string): Promise<void> => {
        await driver.findElement(locator.workbench.openSubmenu).click();
        await driver.wait(until.elementLocated(locator.workbench.submenu.exists),
            constants.wait3seconds, "Workbench submenu was not found");
        const items = await driver.findElements(locator.workbench.submenu.item);
        for (const item of items) {
            const text = await item.getText();
            if (text === itemName) {
                await item.click();

                return;
            }
        }
        throw new Error(`Could not find the submenu item ${itemName}`);
    };
}
