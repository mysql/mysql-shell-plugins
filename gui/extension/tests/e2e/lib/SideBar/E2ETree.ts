/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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

import {
    Condition, until, WebElement,
    TreeItem, EditorView, Button, error,
} from "vscode-extension-tester";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import * as errors from "../errors";
import { Misc, driver } from "../Misc";
import { Workbench } from "../Workbench";
import { E2EAccordionSection } from "./E2EAccordionSection";
import { Os } from "../Os";

/**
 * This class represents the tree within an accordion section and its related functions
 */
export class E2ETree {

    /** The accordion section which it belongs to */
    private accordionSection: E2EAccordionSection;

    public constructor(sectionElement: E2EAccordionSection) {
        this.accordionSection = sectionElement;
    }

    /**
     * Gets an element from the tree
     * @param element The element
     * @returns A promise resolving with the element
     */
    public getElement = async (element: string | RegExp): Promise<TreeItem> => {

        let el: TreeItem;

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        await driver.wait(async () => {
            try {
                if (element instanceof RegExp) {
                    const treeItems = await (await this.accordionSection.getWebElement()).getVisibleItems();
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(element) !== null) {
                            el = item;
                            break;
                        }
                    }
                } else {
                    el = await (await this.accordionSection.getWebElement()).findItem(element, 5);
                }

                return el !== undefined;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait10seconds,
            `${element.toString()} on section ${this.accordionSection.accordionSectionName} was not found`);

        return el;
    };

    /**
     * Gets an element from the tree by its oci type
     * @param type The type (ociDbSystem, ociBastion)
     * @returns A promise resolving with the element
     */
    public getOciElementByType = async (type: string): Promise<TreeItem> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        if (type.match(/(ociDbSystem|ociBastion|ociCompute)/) !== null) {
            const thisTreeSectionElement = await this.accordionSection.getWebElement();
            const treeItems = await thisTreeSectionElement.getVisibleItems();
            for (const treeItem of treeItems) {
                const el = await treeItem.findElement(locator.section.itemIcon);
                const backImage = await el.getCssValue("background-image");
                if (backImage.match(new RegExp(type)) !== null) {
                    return treeItem;
                }
            }
            throw new Error(`Could not find the item type ${type} on section ${this
                .accordionSection.accordionSectionName}`);
        } else {
            throw new Error(`Unknown type: ${type}`);
        }
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A condition resolving to true if the element exists, false otherwise
     */
    public untilExists = (element: Array<string | RegExp> | string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element.toString()} to exist on the tree`, async () => {
            let reloadLabel: string;
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);

            if (this.accordionSection.accordionSectionName === constants.dbTreeSection ||
                this.accordionSection.accordionSectionName === constants.ociTreeSection) {

                if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
                    reloadLabel = constants.reloadConnections;
                } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                    reloadLabel = constants.reloadOci;
                }

                await this.accordionSection.clickToolbarButton(reloadLabel);
                await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            }

            if (Array.isArray(element)) {
                await this.accordionSection.tree.expandElement(element);

                return this.elementExists(element[element.length - 1]);
            } else {
                return this.elementExists(element);
            }
        });
    };

    /**
     * Verifies if an element does not exist the tree
     * @param element The element
     * @returns A condition resolving to true if the element does not exist, false otherwise
     */
    public untilDoesNotExist = (element: Array<string | RegExp> | string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element.toString()} to not exist`, async () => {
            let reloadLabel: string;
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            if (this.accordionSection.accordionSectionName === constants.dbTreeSection ||
                this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
                    reloadLabel = constants.reloadConnections;
                } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                    reloadLabel = constants.reloadOci;
                }
                await this.accordionSection.clickToolbarButton(reloadLabel);
                await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            }

            if (Array.isArray(element)) {
                const lastElement = element.pop();
                await this.accordionSection.tree.expandElement(element);

                return !(await this.elementExists(lastElement));
            } else {
                return !(await this.elementExists(element));
            }
        });
    };

    /**
     * Verifies if an element is marked as default of the tree (icon is in bold)
     * @param element The element
     * @param type The type (ociProfileCurrent, folderCurrent, ociBastionCurrent, mrsServiceDefault, schemaMySQLCurrent)
     * @returns A promise resolving with true if the element is marked as default, false otherwise
     */
    public isElementDefault = async (element: string, type: string): Promise<boolean | undefined> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const treeItem = await this.getElement(element);
        const el = await treeItem.findElement(locator.section.itemIcon);
        const backImage = await el.getCssValue("background-image");

        switch (type) {
            case "profile": {
                return backImage.includes("ociProfileCurrent");
            }
            case "compartment": {
                return backImage.includes("folderCurrent");
            }
            case "bastion": {
                return backImage.includes("ociBastionCurrent");
            }
            case "rest": {
                return backImage.includes("mrsServiceDefault");
            }
            case "schema": {
                return backImage.includes("schemaMySQLCurrent");
            }
            default: {
                break;
            }
        }
    };

    /**
     * Expands a database connection
     * @param conn The connection
     * @param password The connection password
     * @returns A promise resolving when the database connection is expanded
     */
    public expandDatabaseConnection = async (conn: TreeItem, password: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        await driver.wait(async () => {
            await conn.expand();

            return conn.isExpanded();
        }, constants.wait5seconds, `Could not expand ${await conn.getLabel()}`);

        await driver.wait(async () => {
            const inputWidget = await driver.wait(until.elementLocated(locator.inputBox.exists), 500)
                .catch(() => { return undefined; });
            if (inputWidget && (await (inputWidget as WebElement).isDisplayed())) {
                await Workbench.setInputPassword(password);

                return driver.wait(async () => {
                    return conn.hasChildren();
                }, constants.wait10seconds,
                    `${await conn.getLabel()} should have children after setting the password`);
            } else if (await conn.hasChildren()) {
                return true;
            }
        }, constants.wait20seconds,
            `The input password was not displayed nor the ${await conn.getLabel()} has children`);
    };

    /**
     * Verifies if a DBSystem is stopped
     * @param dbSystem The db system
     * @returns A promise resolving with true if the DB System is stopped, false otherwise
     */
    public isDBSystemStopped = async (dbSystem: TreeItem): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const itemIcon = await dbSystem.findElement(locator.section.itemIcon);
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.includes("ociDbSystemNotActive");
    };

    /**
     * Verifies if a MySQL Rest Service is disabled
     * @param mrsTreeItem The MRS
     * @returns A promise resolving with true if the MRS is disabled, false otherwise
     */
    public isMRSDisabled = async (mrsTreeItem: TreeItem): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const itemIcon = await mrsTreeItem.findElement(locator.section.itemIcon);
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.includes("mrsDisabled");
    };

    /**
     * Gets an action button from a tree element
     * @param treeItem The tree item
     * @param actionButton The action button d
     * @returns A promise resolving with the button
     */
    public getActionButton = async (treeItem: TreeItem, actionButton: string): Promise<WebElement> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return driver.wait(async () => {
            try {
                const btn = await treeItem.findElement(locator.section.itemAction(actionButton));

                const treeItemCoord = await treeItem.getRect();
                await driver.actions().move({
                    x: Math.floor(treeItemCoord.x),
                    y: Math.floor(treeItemCoord.y),
                }).perform();
                await driver.wait(until.elementIsVisible(btn),
                    constants.wait5seconds, `'${actionButton}' button was not visible`);

                return btn;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not get icon for '${await treeItem.getLabel()}' (button was always stale)`);
    };

    /**
     * Verifies if the router element on the tree is marked with errors (red dot on the icon)
     * @param treeItem The router item
     * @returns A promise resolving with true if the router has errors, false otherwise
     */
    public routerHasError = async (treeItem: TreeItem): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const icon = await treeItem.findElement(locator.section.itemIcon);
        const style = await icon.getAttribute("style");

        return style.includes("routerError");
    };

    /**
     * Gets a script from the OPEN EDITORS section
     * @param name The script name
     * @param type The script type
     * @returns A promise resolving with the script
     */
    public getScript = async (name: RegExp, type: string): Promise<TreeItem> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return driver.wait(new Condition("", async () => {
            try {
                const section = await this.accordionSection.getWebElement();
                const treeVisibleItems = await section.getVisibleItems();
                for (const item of treeVisibleItems) {
                    if ((await item.getLabel()).match(name) !== null) {
                        const itemIcon = await item.findElement(locator.section.itemIcon);
                        if ((await itemIcon.getAttribute("style")).includes(type)) {
                            return item;
                        }
                    }
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }), constants.wait5seconds,
            `Could not find the script '${name}' with type '${type}' on the Open Editors tree`);
    };

    /**
     * Deletes a database connection
     * @param name The database name
     * @param isMySQL If the database if mysql
     * @param verifyDelete True is the removal should be verified
     * @returns A promise resolving when the database is deleted
     */
    public deleteDatabaseConnection = async (name: string, isMySQL = true,
        verifyDelete = true): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const treeItem = await this.getElement(name);
        if (isMySQL === true) {
            await this.openContextMenuAndSelect(treeItem, constants.deleteDBConnection, constants.dbConnectionCtxMenu);
        } else {
            await this.openContextMenuAndSelect(treeItem, constants.deleteDBConnection,
                constants.dbConnectionSqliteCtxMenu);
        }

        const editorView = new EditorView();
        await driver.wait(async () => {
            const activeTab = await editorView.getActiveTab();

            return await activeTab?.getTitle() === constants.dbDefaultEditor;
        }, constants.wait3seconds, `${constants.dbDefaultEditor} tab is not selected`);

        await Misc.switchToFrame();
        const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
            constants.wait10seconds, "confirm dialog was not found");

        await dialog.findElement(locator.confirmDialog.accept).click();
        await Misc.switchBackToTopFrame();
        if (verifyDelete === true) {
            await driver.wait(this.elementExists(name), constants.wait5seconds);
        }
    };

    /**
     * Expands an element on the tree
     * @param elements The elements
     * @param loadingTimeout The timeout to load the expand
     * @returns A promise resolving when the elements are expanded
     */
    public expandElement = async (elements: Array<string | RegExp>,
        loadingTimeout = constants.wait20seconds): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const treeSection = await this.accordionSection.getWebElement();

        if (!(await treeSection.isExpanded())) {
            await treeSection.expand();
        }

        for (const item of elements) {
            const treeItem = await this.getElement(item);
            if (!(await treeItem.isExpanded())) {
                await treeItem.expand();
                await driver.wait(this.accordionSection.untilIsNotLoading(), loadingTimeout);
            }
        }
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param element The element
     * @param ctxMenuItem The context menu item
     * @param itemMap The map of the item. On macOS, the item map is required
     * @returns A promise resolving when the elements are expanded
     */
    public openContextMenuAndSelect = async (
        element: TreeItem,
        ctxMenuItem: string | string[],
        itemMap?: Map<string, number>,
    ): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        if (ctxMenuItem !== constants.openNotebookWithConn) {
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            const ociSection = new E2EAccordionSection(constants.ociTreeSection);
            await driver.wait(ociSection.untilIsNotLoading(), constants.wait20seconds);
        }

        if (element) {
            await driver.wait(async () => {
                if (Os.isMacOs()) {
                    await driver.actions()
                        .move({ origin: element })
                        .press(Button.RIGHT)
                        .pause(150)
                        .perform();

                    if (Array.isArray(ctxMenuItem)) {
                        for (const item of ctxMenuItem) {
                            await Os.selectItemMacOS(item, itemMap);
                        }
                    } else {
                        await Os.selectItemMacOS(ctxMenuItem, itemMap);
                    }

                    return true;
                } else {
                    try {
                        let ctxMenuItems: string | string[];
                        if (Array.isArray(ctxMenuItem)) {
                            ctxMenuItems = [ctxMenuItem[0], ctxMenuItem[1]];
                        } else {
                            ctxMenuItems = [ctxMenuItem];
                        }

                        const menu = await element.openContextMenu();
                        const menuItem = await menu.getItem(ctxMenuItems[0].trim());
                        const anotherMenu = await menuItem.select();
                        if (ctxMenuItems.length > 1) {
                            await (await anotherMenu.getItem(ctxMenuItems[1].trim())).select();
                        }

                        return true;
                    } catch (e) {
                        console.log(e);
                    }
                }
            }, constants.wait5seconds,
                `Could not select '${ctxMenuItem.toString()}' for tree item '${await element.getLabel()}'`);
        } else {
            throw new Error(`TreeItem for context menu '${ctxMenuItem.toString()}' is undefined`);
        }
    };

    /**
     * Configures the Rest Service for a given database connection
     * @param dbConnection The database connection
     * @returns A promise resolving when the rest service is configured
     */
    public configureMySQLRestService = async (dbConnection: interfaces.IDBConnection): Promise<void> => {
        await driver.wait(async () => {
            try {
                const treeElement = await this.getElement(dbConnection.caption);
                await this.openContextMenuAndSelect(treeElement, constants.configureREST);
                const ntf = await Workbench.getNotification(
                    `Do you want to configure this instance for MySQL REST Service Support?`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(async () => {
                    const passwordWidget = await driver.findElements(locator.inputBox.exists);
                    if (passwordWidget.length > 0) {
                        const isDisplayed = await passwordWidget[0].getCssValue("display");
                        if (isDisplayed) {
                            await Workbench.setInputPassword((dbConnection.basic as interfaces.IConnBasicMySQL)
                                .password);
                            await driver.wait(Workbench
                                .untilNotificationExists("MySQL REST Service configured successfully."),
                                constants.wait10seconds);

                            return true;
                        }
                    }
                    if (await Workbench.existsNotifications(50)) {
                        if (await Workbench.existsNotification(/MySQL REST Service configured successfully/)) {
                            return true;
                        } else {
                            throw new Error("Something wrong. Check the notification");
                        }
                    }
                }, constants.wait5seconds, "Password widget was not displayed");

                return true;
            } catch (e) {
                console.log("[DEBUG] An error occurred");
                if (await Workbench.existsNotification(/Error.*/)) {
                    console.log("Shell session error, retrying...");
                    await Workbench.dismissNotifications();
                } else {
                    throw e;
                }
            }
        }, constants.wait1minute, `There was a problem configuring the MySQL REST Service`);
    };

    /**
     * Verifies if the tree item is marked as default
     * @param treeItemName The item name on the tree
     * @param itemType The item type
     * @returns A condition resolving to true when the item is marked as default
     */
    public untilIsDefault = (treeItemName: string, itemType: string): Condition<boolean> => {
        return new Condition(`for ${treeItemName} to be marked as default`, async () => {
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait25seconds,
                `${this.accordionSection.accordionSectionName} is still loading`);

            return this.isElementDefault(treeItemName, itemType);
        });
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A promise resolving with true if the element exists, false otherwise
     */
    public elementExists = async (element: string | RegExp): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let exists: boolean;
        await driver.wait(async () => {
            try {
                if (element instanceof RegExp) {
                    const treeItems = await (await this.accordionSection.getWebElement()).getVisibleItems();
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(element) !== null) {
                            exists = true;

                            return true;
                        }
                    }
                    exists = false;

                    return true;
                } else {
                    exists = (await (await this.accordionSection.getWebElement())
                        .findItem(element, 5)) !== undefined;

                    return true;
                }
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not determine if ${element} exists`);

        return exists;
    };
}
