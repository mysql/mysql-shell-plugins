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

import { Condition, WebElement, error } from "selenium-webdriver";
import * as locator from "./locators.js";
import { driver } from "./driver.js";
import { wait5seconds } from "./constants.js";

/**
 * This class represents the tab container
 */
export class E2ETabContainer {

    /**
     * Gets a tab
     * @param name The tab name
     * @returns A promise resolving with the tab
     */
    public getTab = async (name: string | RegExp): Promise<WebElement | undefined> => {
        let tabRef: WebElement | undefined;

        await driver.wait(async () => {
            try {
                const tabs = await driver.findElements(locator.tab.exists);

                for (const tab of tabs) {
                    const label = await (await tab.findElement(locator.tab.label)).getText();

                    if (name instanceof RegExp) {
                        if (label.match(name) !== null) {
                            tabRef = tab;
                            break;
                        }
                    } else {
                        if (label === name) {
                            tabRef = tab;
                            break;
                        }
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, wait5seconds, `Could not get tab ${name}`);

        return tabRef;
    };

    /**
     * Verifies if a tab exists
     * @param name The tab name
     * @returns A condition resolving to true if the tab is opened, false otherwise
     */
    public untilTabIsOpened = (name: string | RegExp): Condition<boolean> => {
        return new Condition(``, async () => {
            return (await this.getTab(name)) !== undefined;
        });
    };

    /**
     * Closes a tab
     * @param name The tab name
     */
    public closeTab = async (name: string | RegExp): Promise<void> => {
        const tab = await this.getTab(name);
        await (await tab!.findElement(locator.tab.close)).click();
    };

    /**
     * Closes all tabs
     */
    public closeAllTabs = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                const tabs = await driver.findElements(locator.tab.exists);

                for (const tab of tabs) {
                    const id = await tab.getAttribute("id");

                    if (id.match(/(\d+)/)) {
                        await (await tab.findElement(locator.tab.close)).click();
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, wait5seconds, "Could not close all tabs");
    };
}
