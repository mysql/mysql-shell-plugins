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

import { Condition, until, WebElement, error } from "selenium-webdriver";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import * as interfaces from "../interfaces.js";
import { Misc } from "../misc.js";
import { driver } from "../driver.js";
import { PasswordDialog } from "../Dialogs/PasswordDialog.js";
import { E2EToastNotification } from "../E2EToastNotification.js";
import { ConfirmDialog } from "../Dialogs/ConfirmationDialog.js";

/**
 * This class represents the tree item within the tree
 */
export class E2ETreeItem extends WebElement {

    public caption: string | undefined;

    public subCaption: string | undefined;

    public level: number | undefined;

    public constructor(root: WebElement) {
        super(driver, root.getId());
    }

    public exists = async (): Promise<boolean> => {
        try {
            await this.getAttribute("innerHTML");

            return true;
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                return false;
            } else {
                throw e;
            }
        }
    };

    public setLevel = async (): Promise<void> => {
        const level = (await this.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];
        this.level = parseInt(level, 10);
    };

    public getCaption = async (): Promise<string> => {
        const dbItem = await this.findElements(locator.section.tree.element.dbTreeEntry);
        const genericItem = await this.findElements(locator.section.tree.element.label);

        if (dbItem.length > 0) {
            return (await dbItem[0].findElement(locator.section.tree.element.mainCaption)).getText();
        } else if (genericItem.length > 0) {
            return genericItem[0].getText();
        } else {
            throw new Error(`Could not find any items on the tree (setting caption)`);
        }
    };

    public setCaption = async (): Promise<void> => {
        this.caption = await this.getCaption();
    };

    public setSubCaption = async (): Promise<void> => {
        const dbItem = await this.findElements(locator.section.tree.element.dbTreeEntry);

        if (dbItem.length > 0) {
            this.subCaption = await (await dbItem[0].findElement(locator.section.tree.element.subCaption)).getText();
        } else {
            throw new Error(`Could not find any items on the tree (setting sub caption)`);
        }
    };

    /**
     * Verifies if the tree element has children
     * @returns A promise resolving with true if the element has children, false otherwise
     */
    public hasChildren = async (): Promise<boolean> => {
        const elementLevel = (await this.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];
        const nextSibling: WebElement | undefined = await driver
            .executeScript("return arguments[0].nextElementSibling;", this);

        if (nextSibling) {
            const siblingLevel = (await nextSibling.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];

            return parseInt(siblingLevel, 10) > parseInt(elementLevel, 10);
        } else {
            return false;
        }
    };

    public findChildItem = async (caption: string, maxLevel = 5): Promise<E2ETreeItem> => {
        let el: E2ETreeItem | undefined;

        const getNextSibling = async (el: E2ETreeItem): Promise<E2ETreeItem> => {
            let item: E2ETreeItem | undefined;

            await driver.wait(async () => {
                try {
                    const nextSibling: WebElement = await driver
                        .executeScript("return arguments[0].nextElementSibling;", el);

                    if (!nextSibling) {
                        throw new Error(`Could not find the child item '${caption}' under '${this.caption}'`);
                    }

                    item = new E2ETreeItem(nextSibling);
                    await item.setLevel();
                    await item.setCaption();

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait2seconds, `Could not get the next sibling of ${el.caption}`);

            return item!;
        };

        const rootLevel = this.level!;
        let nextTreeItem = await getNextSibling(this);

        while (nextTreeItem.level! > rootLevel && nextTreeItem.level! <= maxLevel) {
            if (nextTreeItem.caption === caption) {
                el = nextTreeItem;
                break;
            }

            nextTreeItem = await getNextSibling(nextTreeItem);
        }

        return el!;
    };

    public isExpandable = async (): Promise<boolean> => {
        return (await this.findElements(locator.section.tree.element.toggle)).length > 0;
    };

    /**
     * Verifies if the tree element is expanded
     * @returns A promise resolving with true if the section is expanded, false otherwise
     */
    public isExpanded = async (): Promise<boolean> => {
        return (await this.findElements(locator.section.tree.element.isExpanded)).length > 0;
    };

    /**
     * Collapses th is item on the tree
     * @returns A promise resolving when the elements are expanded
     */
    public collapse = async (): Promise<void> => {
        await driver.wait(async () => {
            if (await this.isExpanded()) {
                const toggle = await this.findElement(locator.section.tree.element.toggle);
                await toggle.click();
            }

            return !(await this.isExpanded());
        }, constants.wait3seconds, `Could not collapse ${this.caption}`);
    };

    /**
     * Verifies if this tree item has children
     * @returns A condition resolving with true if the element has children, false otherwise
     */
    public untilHasChildren = (): Condition<boolean> => {
        return new Condition(`for ${this.caption} to have children`, async () => {
            return this.hasChildren();
        });
    };

    /**
     * Verifies if a DBSystem is stopped
     * @returns A promise resolving with true if the DB System is stopped, false otherwise
     */
    public hasRedMark = async (): Promise<boolean> => {
        const itemIcon = await this.findElement(locator.section.tree.element.icon.exists);
        const itemStyle = await itemIcon.getCssValue("mask-image");

        return itemStyle.includes("statusDotMask");
    };

    /**
     * Gets an action button from a tree element
     * @param actionButton The action button d
     * @returns A promise resolving with the button
     */
    public getActionButton = async (actionButton: string): Promise<WebElement | undefined> => {
        let treeItemActionButton: WebElement | undefined;

        await driver.actions().move({ origin: this }).perform();

        if (actionButton === constants.openNewConnectionUsingNotebook) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.openNewConnectionUsingNotebook);
        } else if (actionButton === constants.refreshConnection) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.refreshConnection);
        } else if (actionButton === constants.newMySQLScript) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.newMySQLScript);
        } else if (actionButton === constants.loadSQLScriptFromDisk) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.loadSQLScriptFromDisk);
        } else if (actionButton === constants.closeEditor) {
            treeItemActionButton = await this
                .findElement(locator.section.tree.element.actions.closeEditor);
        }
        else {
            throw new Error(`Unknown action button ${actionButton}`);
        }

        await driver.wait(until.elementIsVisible(treeItemActionButton), constants.wait3seconds,
            `${actionButton} action button was not visible`);

        return treeItemActionButton;
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param ctxMenuItem The context menu item
     */
    public openContextMenuAndSelect = async (ctxMenuItem: string | string[]): Promise<void> => {
        const contextMenuLocator = locator.section.tree.element.contextMenu;

        await driver.wait(async () => {
            await driver.actions().contextClick(this).perform();

            return (await driver.findElements(contextMenuLocator.exists)).length > 0;
        }, constants.wait3seconds, `Context menu was not displayed on element ${this.caption}`);

        const items = await driver.findElements(contextMenuLocator.item);
        const valueToCompare = Array.isArray(ctxMenuItem) ? ctxMenuItem[0] : ctxMenuItem;

        for (const item of items) {
            const itemText = await item.getText();

            if (itemText === valueToCompare) {
                await driver.actions().move({ origin: item }).perform();

                if (Array.isArray(ctxMenuItem)) {
                    const subMenu = await driver.wait(until.elementLocated(contextMenuLocator.subMenu.exists),
                        constants.wait2seconds);
                    const subMenuItems = await subMenu.findElements(contextMenuLocator.subMenu.item);

                    for (const subMenuItem of subMenuItems) {
                        if ((await subMenuItem.getText()) === ctxMenuItem[1]) {
                            await driver.actions().move({ origin: subMenuItem }).pause(250).click().perform();

                            return;
                        }
                    }
                    break;
                } else {
                    await driver.actions().move({ origin: item }).pause(250).click().perform();

                    return;
                }
            }
        }

        throw new Error(`Could not find context menu item '${ctxMenuItem.toString()}' on element '${this.caption}'`);
    };

    /**
     * Configures the Rest Service for this tree item
     * @param dbConnection The database connection
     * @returns A promise resolving when the rest service is configured
     */
    public configureMySQLRestService = async (dbConnection: interfaces.IDBConnection): Promise<void> => {
        await this.openContextMenuAndSelect(constants.configureInstanceForMySQLRestServiceSupport);

        const dialog = await new ConfirmDialog().untilExists();
        await dialog.accept();

        await driver.wait(async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(dbConnection);
            }

            if ((await Misc.getToastNotifications()).length > 0) {
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("MySQL REST Service configured successfully.");
                await notification!.close();

                return true;
            }
        }, constants.wait10seconds, `Could not configure Rest Service for ${dbConnection.caption}`);
    };

    /**
     * Verifies if the tree item is marked as default
     * @returns A promise resolving to true when the item is marked as default
     */
    public isDefault = async (): Promise<boolean> => {
        const el = await this.findElement(locator.section.tree.element.icon.exists);
        const backImage = await el.getCssValue("mask-image");

        return backImage.match(/(Current|Default)/) !== null;
    };

    public untilIsDefault = (): Condition<boolean> => {
        return new Condition(`for ${this.caption} to be DEFAULT`, async () => {
            return this.isDefault();
        });
    };

    /**
     * Expands this item on the tree. If the dbConnection parameter is set, it will handle the connection dialog
     * @param dbConnection The db connection
     * @returns A promise resolving when the elements are expanded
     */
    public expand = async (dbConnection?: interfaces.IDBConnection): Promise<void> => {
        await driver.wait(async () => {
            if ((await this.isExpandable()) && !(await this.isExpanded())) {
                const toggle = await this.findElement(locator.section.tree.element.toggle);
                await toggle.click();

                if (dbConnection) {
                    await driver.wait(async () => {
                        if (await PasswordDialog.exists()) {
                            await PasswordDialog.setCredentials(dbConnection);

                            return driver.wait(async () => {
                                return this.hasChildren();
                            }, constants.wait15seconds, `${dbConnection.caption} should have children`);
                        } else if (await this.hasChildren()) {
                            return true;
                        }
                    }, constants.wait10seconds,
                        `The password dialog was not displayed nor the ${dbConnection.caption!} has children`);
                }
            }

            return this.isExpanded();
        }, constants.wait3seconds, `Could not expand ${this.caption}`);
    };
}
