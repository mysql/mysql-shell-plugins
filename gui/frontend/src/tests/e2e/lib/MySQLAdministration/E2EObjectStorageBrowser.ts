/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { until, Condition, WebElement, error } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";

const objStorageItem = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
    .objectStorageItem.item;

export class E2EObjectStorageBrowser {

    /**
     * Selects an OCI profile
     * @param ociProfileName The profile name
     * @returns A promise resolving when the profile is selected
     */
    public selectOciProfile = async (ociProfileName: string): Promise<void> => {
        const objStorageBrowser = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser;
        await driver.findElement(objStorageBrowser.ociProfile)
            .click();
        const list = await driver.wait(until
            .elementLocated(objStorageBrowser.ociProfileList.exists),
            constants.wait5seconds, "OCI Profile List was not found");
        await (await list.findElement(objStorageBrowser.ociProfileList.item(ociProfileName))).click();
        await driver.wait(this.untilItemsAreLoaded(), constants.wait30seconds,
            "Object Storage Browser items are still loading");
    };

    /**
     * Waits until all Object Storage items are loaded
     * @returns A promise resolving when the Object Storage items are loaded
     */
    public untilItemsAreLoaded = (): Condition<boolean> => {
        return new Condition(`for Object Storage items to be loaded`, async () => {
            const isLoadingLocator = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                .objectStorageItem.item.isLoading;

            return (await driver.findElements(isLoadingLocator)).length === 0;
        });
    };

    /**
     * Gets an object storage item on a specific level
     * @param itemName The item name
     * @param level The item level
     * @returns A promise resolving when the compartments are expanded and loaded
     */
    public getItem = async (itemName: string, level?: string): Promise<WebElement> => {
        let items: WebElement[];
        let itemToReturn: WebElement;

        await driver.wait(async () => {
            try {
                const objStorageBrowser = await driver
                    .findElement(locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.exists);

                if (level) {
                    items = await objStorageBrowser.findElements(objStorageItem.existsByLevel(level));
                } else {
                    items = await objStorageBrowser.findElements(objStorageItem.exists);
                }

                for (const item of items) {
                    const caption = await (item.findElement(objStorageItem.caption)).getText();

                    if (caption.includes(itemName)) {
                        itemToReturn = item;

                        return true;
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait15seconds, `Could not get item '${itemName}' on the Object Storage Browser`);

        return itemToReturn!;
    };

    /**
     * Verifies if an object storage item exists
     * @param itemName The item name
     * @param level The item level
     * @returns A promise resolving when the compartments are expanded and loaded
     */
    public existsItem = async (itemName: string, level?: string): Promise<boolean> => {
        let items: WebElement[];
        let exists = false;

        await driver.wait(async () => {
            try {
                const objStorageBrowser = await driver
                    .findElement(locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.exists);

                if (level) {
                    items = await objStorageBrowser.findElements(objStorageItem.existsByLevel(level));
                } else {
                    items = await objStorageBrowser.findElements(objStorageItem.exists);
                }

                for (const item of items) {
                    const caption = await (item.findElement(objStorageItem.caption)).getText();

                    if (caption.includes(itemName)) {
                        exists = true;
                        break;
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not verify existence of item '${itemName}' on the Object Storage Browser`);

        return exists;
    };

    /**
     * Verifies if the tree element has children
     * @param caption The item caption
     * @returns A condition resolving to true if the element has children, false otherwise
     */
    public untilItemHasChildren = (caption: string): Condition<boolean> => {
        return new Condition(`for ${caption} to have children`, async () => {
            try {
                const element = await this.getItem(caption);
                const elementLevel = (await element.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];
                const nextSibling: WebElement | undefined = await driver
                    .executeScript("return arguments[0].nextElementSibling;", element);

                if (nextSibling) {
                    const siblingLevel = (await nextSibling.getAttribute("class"))
                        .match(/tabulator-tree-level-(\d+)/)![1];

                    return parseInt(siblingLevel, 10) > parseInt(elementLevel, 10);
                } else {
                    return false;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    return false;
                }
            }
        });

    };

    /**
     * Verifies if the tree element is expanded
     * @param caption The item caption
     * @returns A condition resolving to true if the element is expanded, false otherwise
     */
    public itemIsExpanded = async (caption: string): Promise<boolean> => {
        let isExpanded = false;

        await driver.wait(async () => {
            try {
                const item = await this.getItem(caption);
                const itemToggle = await item.findElement(objStorageItem.treeToggle);
                isExpanded = (await (itemToggle.getAttribute("class"))).includes("expanded");

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not verify if item '${caption}' is expanded`);

        return isExpanded;
    };

    /**
     * Verifies if the tree element can be expanded
     * @param caption The item caption
     * @returns A promise resolving to true if the element can be expanded, false otherwise
     */
    public itemIsExpandable = async (caption: string): Promise<boolean> => {
        let isExpandable = false;

        await driver.wait(async () => {
            try {
                const item = await this.getItem(caption);
                isExpandable = (await item.findElements(objStorageItem.treeToggle)).length > 0;

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not verify if item '${caption}' is expanded`);

        return isExpandable;
    };

    /**
     * Expands the tree item
     * @param caption The item caption
     */
    public expandItem = async (caption: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const item = await this.getItem(caption);

                if (!(await this.itemIsExpanded(caption))) {
                    const itemToggle = await item.findElement(objStorageItem.treeToggle);
                    await driver.executeScript("arguments[0].click()", itemToggle);

                    return this.itemIsExpanded(caption);
                } else {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not expand item '${caption}'`);

    };

    /**
     * Expands object storage compartments
     * @param path The compartments as a tree path
     * @returns A promise resolving when the compartments are expanded and loaded
     */
    public openObjectStorageCompartment = async (path: string[]): Promise<void> => {
        const scrollTable = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.scroll;

        for (let i = 0; i <= path.length - 1; i++) {

            if (i === path.length - 1) {
                await driver.executeScript("arguments[0].scrollBy(0, 150)",
                    await driver.findElement(scrollTable));
            }

            await driver.wait(async () => {
                try {
                    if (await this.itemIsExpandable(path[i])) {
                        await this.expandItem(path[i]);
                        await driver.wait(this.untilItemHasChildren(path[i]), constants.wait20seconds);
                        await driver.wait(this.untilItemsAreLoaded(), constants.wait15seconds,
                            ` ${path[i + 1]} to be loaded`);

                        return true;
                    }
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        if (String(e).includes("Could not get item")) {
                            if (path[i - 1]) {
                                if (!(await this.itemIsExpanded(path[i - 1]))) {
                                    i--;
                                } else {
                                    (e as Error).message = `${(e as Error).message}. Parent item was not expanded`;
                                    throw e;
                                }
                            } else {
                                throw e;
                            }
                        } else {
                            throw e;
                        }
                    }
                }
            }, constants.wait20seconds, `Could not open the tree ${path.toString()} on Object Storage Browser`);
        }
    };

    /**
     * Clicks on the object storage item checkbox
     * @param itemName The item name
     * @returns A promise resolving when the checkbox is clicked
     */
    public checkItem = async (itemName: string): Promise<void> => {

        const untilItemIsChecked = (): Condition<boolean> => {
            return new Condition(`waiting for '${itemName}' to be checked`, async () => {
                const objectStorageItem = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                    .objectStorageItem;
                const item = await this.getItem(itemName);
                await driver.executeScript("arguments[0].scrollIntoView()", item);
                const checkbox = await item.findElement(objectStorageItem.item.checkbox);

                return (await checkbox.getAttribute("class")).includes("checked");
            });
        };

        await driver.wait(async () => {
            try {
                const objectStorageItem = locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                    .objectStorageItem;
                const item = await this.getItem(itemName);
                await driver.executeScript("arguments[0].scrollIntoView()", item);
                const checkbox = await item.findElement(objectStorageItem.item.checkbox);
                let isChecked = false;
                await driver.executeScript("arguments[0].click()", checkbox);
                await driver.sleep(500);
                await driver.wait(untilItemIsChecked(), constants.wait3seconds)
                    .then(() => {
                        isChecked = true;
                    })
                    .catch((e) => {
                        console.log(e);
                    });

                if (!isChecked) {
                    return false;
                } else {
                    return driver.wait(async () => {
                        const path = await driver
                            .findElements(locator.lakeHouseNavigator.uploadToObjectStorage.filesForUpload.path);
                        if (path.length > 0) {
                            return (await path[0].getAttribute("value")).includes(itemName);
                        }

                        const loadingTasks = await driver
                            .findElements(locator.lakeHouseNavigator.loadIntoLakeHouse.newLoadingTask
                                .loadingTaskItem.caption);
                        if (loadingTasks.length > 0) {
                            return (await loadingTasks[0].getText()).includes(itemName);
                        }
                    }, constants.wait2seconds, "checkbox was not checked")
                        .then(() => {
                            return true;
                        })
                        .catch(() => {
                            return false;
                        });
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait10seconds, `Could not check the item '${itemName}'`);
    };

    /**
     * Clicks on the refresh button of the Object Storage Browser
     * @returns A promise resolving when Object Storage Browser is refreshed
     */
    public refreshObjectStorageBrowser = async (): Promise<void> => {
        await driver.findElement(locator.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.refresh)
            .click();
    };
}
