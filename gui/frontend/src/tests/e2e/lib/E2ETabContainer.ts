/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { Condition, WebElement, error, until } from "selenium-webdriver";
import * as locator from "./locators.js";
import { driver } from "./driver.js";
import * as constants from "./constants.js";

/**
 * This class represents the tab container
 */
export class E2ETabContainer {

    /**
     * Gets a tab
     * 
     * @param name The tab name
     * @returns A promise resolving with the tab
     */
    public getTab = async (name: string | RegExp): Promise<WebElement | undefined> => {
        let tabRef: WebElement | undefined;

        await driver.wait(async () => {
            try {
                const tabs = await driver.findElements(locator.tab.exists);

                if (tabs.length > 0) {
                    for (const tab of tabs) {
                        const label = await (await tab.findElement(locator.tab.label)).getText();

                        if (name instanceof RegExp) {
                            if (label.match(name) !== null) {
                                tabRef = tab;

                                return true;
                            }
                        } else {
                            if (label === name) {
                                tabRef = tab;

                                return true;
                            }
                        }
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not get tab ${name}`);

        return tabRef!;
    };

    /**
     * Gets the tab names
     * 
     * @returns A promise resolving with the existing tab names
     */
    public getTabs = async (): Promise<string[]> => {

        const getTabsText = async (): Promise<string[]> => {
            const tabs = await driver.findElements(locator.tab.exists);

            return Promise.all(tabs.map(async (item: WebElement) => {
                return (await item.findElement(locator.tab.label)).getAttribute("innerHTML");
            }));
        };

        let tabTexts: string[];

        await driver.wait(async () => {
            try {
                tabTexts = await getTabsText();

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not get the tabs text`);

        return tabTexts!.filter((item: string) => {
            return item !== "INPUT CONSOLE";
        });
    };

    /**
     * Selects a tab
     * 
     * @param name The tab name
     */
    public selectTab = async (name: string | RegExp): Promise<void> => {
        const action = async (): Promise<void> => {
            await driver.wait(async () => {
                await (await this.getTab(name))!.click();
                const tab = await this.getTab(name);

                return (await tab!.getAttribute("class")).includes("selected");
            }, constants.wait5seconds, `'${name}' was not selected`);
        };

        await action().catch(async (e: unknown) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });
    };

    /**
     * Verifies if a tab exists
     * 
     * @param name The tab name
     * @returns A condition resolving to true if the tab exists, false otherwise
     */
    public untilTabExists = (name: string | RegExp): Condition<boolean> => {
        return new Condition(`for tab '${name}' to exist`, async () => {
            return this.tabExists(name);
        });
    };

    /**
     * Verifies if a tab does not exists
     * 
     * @param name The tab name
     * @returns A condition resolving to true if the tab does not exists, false otherwise
     */
    public untilTabDoesNotExists = (name: string | RegExp): Condition<boolean> => {
        return new Condition(`for tab '${name}' to not exist`, async () => {
            return !(await this.tabExists(name));
        });
    };

    /**
     * Verifies if a tab exists
     * 
     * @param name The tab name
     * @returns A condition resolving to true if the tab is opened, false otherwise
     */
    public untilTabIsOpened = (name: string | RegExp): Condition<boolean> => {
        return new Condition(`for tab '${name}' to be opened`, async () => {
            return (await this.getTab(name)) !== undefined;
        });
    };

    /**
     * Closes a tab
     * 
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

                for (let i = 0; i <= tabs.length - 1; i++) {
                    const html = await tabs[i].getAttribute("outerHTML");

                    if (html.match(new RegExp(constants.connectionOverview)) === null) {
                        await tabs[i].findElement(locator.tab.close)
                            .then(async (el) => {
                                await el.click();
                            })
                            .catch(() => {
                                // continue
                            });
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not close all tabs");
    };

    /**
     * Right-clicks on the tab and selects an item from the context menu
     * 
     * @param tabName The tab name
     * @param menuItem The menu item
     * @returns Promise resolving when the menu item is clicked
     */
    public selectTabContextMenu = async (tabName: string, menuItem: string): Promise<void> => {
        const tab = await this.getTab(tabName);
        await driver.actions().move({ origin: tab }).contextClick().perform();
        await driver.wait(until.elementLocated(locator.tab.contextMenu.exists),
            constants.wait3seconds, `Could not find the context menu for tab '${tabName}'`);

        if (menuItem === constants.close) {
            await driver.findElement(locator.tab.contextMenu.close).click();
        } else if (menuItem === constants.closeAll) {
            await driver.findElement(locator.tab.contextMenu.closeAll).click();
        } else if (menuItem === constants.closeToTheRight) {
            await driver.findElement(locator.tab.contextMenu.closeRight).click();
        } else if (menuItem === constants.closeOthers) {
            await driver.findElement(locator.tab.contextMenu.closeOthers).click();
        } else {
            throw new Error(`Unknown context menu item ${menuItem}`);
        }
    };

    /**
     * Verifies if a tab exists
     * 
     * @param name The tab name
     * @returns A condition resolving to true if the tab exists, false otherwise
     */
    public tabExists = async (name: string | RegExp): Promise<boolean> => {
        let exists = false;

        await driver.wait(async () => {
            try {
                const tabs = await driver.findElements(locator.tab.exists);

                for (const tab of tabs) {
                    const label = await (await tab.findElement(locator.tab.label)).getText();

                    if (name instanceof RegExp) {
                        if (label.match(name) !== null) {
                            exists = true;
                            break;
                        }
                    } else {
                        if (label === name) {
                            exists = true;
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
        }, constants.wait5seconds, `Could not verify if tab '${name}' exists (StaleElementReferenceError)`);

        return exists;
    };
}
