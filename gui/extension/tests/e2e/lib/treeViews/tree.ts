/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
import * as waitUntil from "../until";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import * as errors from "../errors";
import { Misc, driver } from "../misc";
import { Workbench } from "../workbench";
import { Section } from "./section";
import { Os } from "../os";
import { hostname } from "os";

export class Tree {

    /**
     * Gets an element from the tree
     * @param section The section
     * @param element The element
     * @returns A promise resolving with the element
     */
    public static getElement = async (
        section: string,
        element: string | RegExp,
    ): Promise<TreeItem> => {
        let el: TreeItem;
        let reloadLabel: string;

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        if (section === constants.dbTreeSection) {
            reloadLabel = constants.reloadConnections;
        } else if (section === constants.ociTreeSection) {
            reloadLabel = constants.reloadOci;
        }

        const sectionTree = await Section.getSection(section);
        await driver.wait(waitUntil.sectionIsNotLoading(section), constants.wait20seconds);
        let reload = false;

        await driver.wait(async () => {
            try {
                if (reload) {
                    if (section === constants.dbTreeSection || section === constants.ociTreeSection) {
                        await Section.clickToolbarButton(sectionTree, reloadLabel);
                        await driver.wait(waitUntil.sectionIsNotLoading(section), constants.wait20seconds);
                    }
                }
                if (element instanceof RegExp) {
                    const treeItems = await sectionTree.getVisibleItems();
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(element) !== null) {
                            el = item;
                            break;
                        }
                    }
                } else {
                    el = await sectionTree.findItem(element, 5);
                }

                if (el === undefined) {
                    reload = true;
                } else {
                    return true;
                }
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait10seconds, `${element.toString()} on section ${section} was not found`);

        return el;
    };

    /**
     * Gets an element from the tree by its oci type
     * @param section The section
     * @param type The type (ociDbSystem, ociBastion)
     * @returns A promise resolving with the element
     */
    public static getOciElementByType = async (section: string, type: string): Promise<TreeItem> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        if (type.match(/(ociDbSystem|ociBastion|ociCompute)/) !== null) {
            const sectionTree = await Section.getSection(section);
            const treeItems = await sectionTree.getVisibleItems();
            for (const treeItem of treeItems) {
                const el = await treeItem.findElement(locator.section.itemIcon);
                const backImage = await el.getCssValue("background-image");
                if (backImage.match(new RegExp(type)) !== null) {
                    return treeItem;
                }
            }
            throw new Error(`Could not find the item type ${type} on section ${section}`);
        } else {
            throw new Error(`Unknown type: ${type}`);
        }
    };

    /**
     * Verifies if an element exists on the tree
     * @param section The section
     * @param element The element
     * @returns A promise resolving with true if the element exists, false otherwise
     */
    public static existsElement = async (section: string, element: string | RegExp): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let reloadLabel: string;
        let exists: boolean;
        await driver.wait(async () => {
            try {
                const sectionTree = await Section.getSection(section);
                await driver.wait(waitUntil.sectionIsNotLoading(section), constants.wait20seconds);
                if (section === constants.dbTreeSection || section === constants.ociTreeSection) {
                    if (section === constants.dbTreeSection) {
                        reloadLabel = "Reload the connection list";
                    } else if (section === constants.ociTreeSection) {
                        reloadLabel = "Reload the OCI Profile list";
                    }
                    await Section.clickToolbarButton(sectionTree, reloadLabel);
                    await driver.wait(waitUntil.sectionIsNotLoading(section), constants.wait20seconds);
                }

                if (element instanceof RegExp) {
                    const treeItems = await sectionTree.getVisibleItems();
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(element) !== null) {
                            exists = true;

                            return true;
                        }
                    }
                    exists = false;

                    return true;
                } else {
                    exists = (await sectionTree.findItem(element, 5)) !== undefined;

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

    /**
     * Verifies if an element is marked as default of the tree (icon is in bold)
     * @param section The section
     * @param element The element
     * @param type The type (ociProfileCurrent, folderCurrent, ociBastionCurrent, mrsServiceDefault, schemaMySQLCurrent)
     * @returns A promise resolving with true if the element is marked as default, false otherwise
     */
    public static isElementDefault = async (
        section: string,
        element: string,
        type: string,
    ): Promise<boolean | undefined> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const treeItem = await Tree.getElement(section, element);
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
     * Expands a database connection on the tree
     * @param conn The connection
     * @param password The connection password
     * @returns A promise resolving when the database connection is expanded
     */
    public static expandDatabaseConnection = async (conn: TreeItem, password: string): Promise<void> => {
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
    public static isDBSystemStopped = async (dbSystem: TreeItem): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const itemIcon = await dbSystem.findElement(locator.section.itemIcon);
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.includes("ociDbSystemStopped");
    };

    /**
     * Verifies if a MySQL Rest Service is disabled
     * @param mrsTreeItem The MRS
     * @returns A promise resolving with true if the MRS is disabled, false otherwise
     */
    public static isMRSDisabled = async (mrsTreeItem: TreeItem): Promise<boolean> => {
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
    public static getActionButton = async (treeItem: TreeItem, actionButton: string): Promise<WebElement> => {
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
     * Verifies if the router element on the tree is marked as active (yellow dot on the icon)
     * @returns A promise resolving with true if the router is active, false otherwise
     */
    public static isRouterActive = async (): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const routerItem = await Tree.getElement(constants.dbTreeSection, new RegExp(hostname()));
        const icon = await routerItem.findElement(locator.section.itemIcon);

        return (await icon.getCssValue("background-image")).match(/router.svg/) !== null;
    };

    /**
     * Verifies if the router element on the tree is marked with errors (red dot on the icon)
     * @param treeItem The router item
     * @returns A promise resolving with true if the router has errors, false otherwise
     */
    public static routerHasError = async (treeItem: TreeItem): Promise<boolean> => {
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
    public static getScript = async (name: RegExp, type: string): Promise<TreeItem> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return driver.wait(new Condition("", async () => {
            try {
                const section = await Section.getSection(constants.openEditorsTreeSection);
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
     * Gets the database connections from the DATABASE CONNECTIONS section
     * @returns A promise resolving with the database connections
     */
    public static getDatabaseConnections = async (): Promise<interfaces.ITreeDBConnection[]> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const dbConnections: interfaces.ITreeDBConnection[] = [];
        await Misc.switchBackToTopFrame();
        await Section.focus(constants.dbTreeSection);
        await Section.clickToolbarButton(await Section.getSection(constants.dbTreeSection),
            constants.collapseAll);
        const treeItems = await driver.findElements(locator.section.item);
        for (const item of treeItems) {
            const icon = await item.findElement(locator.section.itemIcon);
            const backgroundImage = await icon.getCssValue("background-image");
            if (backgroundImage.match(/connection/) !== null || backgroundImage.match(/ociDbSystem/) !== null) {
                const itemName = await (await item.findElement(locator.section.itemName)).getText();
                let mysql = false;
                if (backgroundImage.match(/Sqlite/) === null) {
                    mysql = true;
                }
                dbConnections.push({
                    name: itemName,
                    isMySQL: mysql,
                });
            }
        }

        return dbConnections;
    };

    /**
     * Deletes a database connection
     * @param name The database name
     * @param isMySQL If the database if mysql
     * @param verifyDelete True is the removal should be verified
     * @returns A promise resolving when the database is deleted
     */
    public static deleteDatabaseConnection = async (name: string, isMySQL = true,
        verifyDelete = true): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const treeItem = await Tree.getElement(constants.dbTreeSection, name);
        if (isMySQL === true) {
            await Tree.openContextMenuAndSelect(treeItem, constants.deleteDBConnection, constants.dbConnectionCtxMenu);
        } else {
            await Tree.openContextMenuAndSelect(treeItem, constants.deleteDBConnection,
                constants.dbConnectionSqliteCtxMenu);
        }

        const editorView = new EditorView();
        await driver.wait(async () => {
            const activeTab = await editorView.getActiveTab();

            return await activeTab?.getTitle() === constants.dbDefaultEditor;
        }, 3000, `${constants.dbDefaultEditor} tab is not selected`);

        await Misc.switchToFrame();
        const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
            constants.wait10seconds, "confirm dialog was not found");

        await dialog.findElement(locator.confirmDialog.accept).click();
        await Misc.switchBackToTopFrame();
        if (verifyDelete === true) {
            await driver.wait(async () => {
                try {
                    return !(await Tree.existsElement(constants.dbTreeSection, name));
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, `${name} was not deleted`);
        }
    };

    /**
     * Expands an element on the tree
     * @param section The section
     * @param elements The elements
     * @param loadingTimeout The timeout to load the expand
     * @returns A promise resolving when the elements are expanded
     */
    public static expandElement = async (section: string, elements: Array<string | RegExp>,
        loadingTimeout = constants.wait10seconds): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const sec = await Section.getSection(section);
        if (!(await sec.isExpanded())) {
            await sec.expand();
        }

        for (const item of elements) {
            const treeItem = await Tree.getElement(section, item);
            if (!(await treeItem.isExpanded())) {
                await treeItem.expand();
                await driver.wait(waitUntil.sectionIsNotLoading(section), loadingTimeout);
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
    public static openContextMenuAndSelect = async (
        element: TreeItem,
        ctxMenuItem: string | string[],
        itemMap?: Map<string, number>,
    ): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        if (ctxMenuItem !== constants.openNotebookWithConn) {
            await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds);
            await driver.wait(waitUntil.sectionIsNotLoading(constants.ociTreeSection), constants.wait10seconds);
        }

        if (element) {
            await driver.wait(async () => {
                if (Os.isMacOs()) {
                    await driver.actions()
                        .move({ origin: element })
                        .press(Button.RIGHT)
                        .pause(500)
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
    public static configureMySQLRestService = async (dbConnection: interfaces.IDBConnection): Promise<void> => {
        await driver.wait(async () => {
            try {
                const treeElement = await this.getElement(constants.dbTreeSection, dbConnection.caption);
                await Tree.openContextMenuAndSelect(treeElement, constants.configureREST);
                const ntf = await Workbench.getNotification(
                    `Do you want to configure this instance for MySQL REST Service Support?`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(async () => {
                    const existsPasswordWidget = await driver.findElements(locator.inputBox.exists);
                    if (existsPasswordWidget) {
                        await Workbench.setInputPassword((dbConnection.basic as interfaces.IConnBasicMySQL)
                            .password);
                        await driver.wait(waitUntil
                            .notificationExists("MySQL REST Service configured successfully."),
                            constants.wait5seconds);

                        return true;
                    }
                    if (await Workbench.existsNotifications()) {
                        if (await Workbench.existsNotification(/MySQL REST Service configured successfully/)) {
                            return true;
                        } else {
                            throw new Error("Something wrong. Check notification");
                        }
                    }
                }, constants.wait5seconds, "Password widget was not displayed");

                return true;
            } catch (e) {
                console.log("[DEBUG] An error occurred");
                if (await Workbench.existsNotification(/Error.*Shell.open_session/)) {
                    console.log("Shell session error, retrying...");
                    await Workbench.dismissNotifications();
                } else {
                    throw e;
                }
            }
        }, constants.wait1minute, `There was a problem configuring the MySQL REST Service`);
    };
}
