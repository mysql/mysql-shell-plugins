/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { Condition, WebElement } from "selenium-webdriver";
import * as locator from "./locators.js";
import { driver } from "./driver.js";

/**
 * This class represents the communication debugger page
 */
export class E2EDebugger {

    /**
     * Verifies if the debugger page is opened
     * @returns A condition resolving to true if the page is opened, false otherwise
     */
    public static untilIsOpened = (): Condition<boolean> => {
        return new Condition(`for Debugger page to be opened`, async () => {
            return (await driver.findElements(locator.e2eDebugger.exists)).length > 0;
        });
    };

    /**
     * Gets an item from the scripts tree
     * @param name The item name
     * @returns A promise resolving with the item
     */
    public static getTreeItem = async (name: string): Promise<WebElement> => {
        const treeItems = await driver.findElements(locator.e2eDebugger.scripts.treeItem);

        for (const item of treeItems) {
            const label = await (await item.findElement(locator.htmlTag.label)).getText();

            if (label === name) {
                return item;
            }
        }

        throw new Error(`Could not find item '${name}'`);
    };
}
