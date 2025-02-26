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
    Condition, CustomTreeSection, error, SideBarView, until, WebElement,
    ActivityBar,
    ViewSection,
    TreeItem,
    Button,
    EditorView,
} from "vscode-extension-tester";
import { keyboard, Key as nutKey } from "@nut-tree-fork/nut-js";
import * as constants from "../constants";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import * as errors from "../errors";
import { DatabaseConnectionDialog } from "../WebViews/Dialogs/DatabaseConnectionDialog";
import { Misc, driver } from "../Misc";
import { Os } from "../Os";
import { Workbench } from "../Workbench";

/**
 * This class represents the Accordion section element and its related functions
 */
export class E2EAccordionSection {

    /** Accordion section name */
    public name: string;

    public constructor(sectionName: string) {
        this.name = sectionName;
    }

    /**
     * Verifies if a section exists
     * @returns A condition resolving to true if exists, false otherwise
     */
    public untilExists = (): Condition<boolean> => {
        return new Condition(`for ${this.name} to exist`, async () => {
            return (await new SideBarView().getContent().getSection(this.name)) !== undefined;
        });
    };

    /**
     * Clicks a section toolbar button
     * @param button The button
     * @returns A promise resolving when the button is clicked
     */
    public clickToolbarButton = async (button: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        await driver.wait(this.untilIsNotLoading(), constants.wait20seconds);

        let sectionActions: WebElement;
        const thisSection = await new SideBarView().getContent().getSection(this.name);
        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    await driver.actions().move({ origin: thisSection }).perform();
                    sectionActions = await driver
                        .findElement(locator.section.actions(this.name));

                    return sectionActions.isDisplayed();
                }, constants.wait5seconds, `Toolbar buttons for ${this.name} were not displayed`);

                const actionItems = await sectionActions.findElements(locator.htmlTag.li);

                for (const action of actionItems) {
                    const title = await action.getAttribute("title");

                    if (title === button) {
                        await action.findElement(locator.htmlTag.a).click();

                        return true;
                    }
                }
            } catch (e) {
                if (!(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `${button} on section '${this.name}' was not interactable`);

    };

    /**
     * Selects an item from the "More Actions" context menu
     * @param item The item
     * @returns A promise resolving when the button is clicked
     */
    public selectMoreActionsItem = async (item: string): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const thisSection = await new SideBarView().getContent().getSection(this.name);

        const button = await thisSection.getAction("More Actions...");

        await driver.wait(async () => {
            await thisSection.click();

            return button?.isDisplayed();
        }, constants.wait5seconds, `'More Actions...' button was not visible`);

        if (Os.isMacOs()) {
            const moreActions = await thisSection.findElement(locator.section.moreActions);
            await moreActions.click();
            await driver.sleep(500);
            const taps = Misc.getValueFromMap(item);
            for (let i = 0; i <= taps - 1; i++) {
                await keyboard.type(nutKey.Down);
            }
            await keyboard.type(nutKey.Enter);
        } else {
            const moreActions = await thisSection.moreActions();
            const moreActionsItem = await moreActions?.getItem(item);
            await moreActionsItem?.select();
        }
    };

    /**
     * Creates a database connection from the DATABASE CONNECTIONS section toolbar
     * @param dbConfig The database configuration data
     * @returns A promise resolving when the connection is created
     */
    public createDatabaseConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        await this.clickToolbarButton(constants.createDBConnection);
        const regex = new RegExp(`(${constants.dbDefaultEditor}|${constants.openEditorsDBNotebook})`);
        await driver.wait(Workbench.untilTabIsOpened(regex), constants.wait5seconds);
        await Misc.switchToFrame();
        await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists), constants.wait10seconds);
        await DatabaseConnectionDialog.setConnection(dbConfig);
    };

    /**
     * Focus the section, by expanding the section and collapsing all the other sections
     * @returns A promise resolving when the section is focused
     */
    public focus = async (): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const sections = [
            constants.dbTreeSection,
            constants.ociTreeSection,
            constants.openEditorsTreeSection,
            constants.tasksTreeSection,
        ];

        for (const sectionName of sections) {
            await driver.wait(async () => {
                const section = await new SideBarView().getContent().getSection(sectionName);

                if (await section.getTitle() === this.name) {
                    await this.expand(sectionName);

                    return section.isExpanded();
                } else {
                    await this.collapse(sectionName);

                    return !(await section.isExpanded());
                }
            }, constants.wait5seconds, `Could not focus on ${this.name}`);

        }
    };

    /**
     * Expands the section
     * @param sectionName The section name
     * @returns A promise resolving when the section is expanded
     */
    public expand = async (sectionName?: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let section: ViewSection;

        if (section) {
            section = await new SideBarView().getContent().getSection(sectionName);
        } else {
            section = await new SideBarView().getContent().getSection(this.name);
        }

        if (!(await section.isExpanded())) {
            await driver.wait(async () => {
                await driver.executeScript("arguments[0].click()", await section.findElement(locator.section.toggle));

                return section.isExpanded();
            }, constants.wait5seconds, `Could not expand '${this.name}' tree explorer`);
        }
    };

    /**
     * Collapse the section
     * @param sectionName The section name
     * @returns A promise resolving when the section is collapsed
     */
    public collapse = async (sectionName?: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let section: ViewSection;

        if (sectionName) {
            section = await new SideBarView().getContent().getSection(sectionName);
        } else {
            section = await new SideBarView().getContent().getSection(this.name);
        }

        if (await section.isExpanded()) {
            await driver.wait(async () => {
                await driver.executeScript("arguments[0].click()", await section.findElement(locator.section.toggle));

                return !(await section.isExpanded());
            }, constants.wait5seconds, `Could not collapse '${this.name}' tree explorer`);
        }
    };

    /**
     * Restarts MySQL Shell from the DATABASE CONNECTIONS section toolbar context menu
     * @returns A promise resolving when MySQL Shell is restarted
     */
    public restartShell = async (): Promise<void> => {
        const existsRootHost = async (): Promise<boolean> => {
            return (await driver.findElements(locator.contextMenu.exists)).length > 0;
        };

        const treeDBSection = await new SideBarView().getContent().getSection(this.name);
        await driver.wait(this.untilIsNotLoading, constants.wait5seconds);
        await treeDBSection.click();
        const moreActions = await treeDBSection.findElement(locator.section.moreActions);
        await moreActions.click();

        if (Os.isMacOs()) {
            await keyboard.type(nutKey.Right);
            await keyboard.type(nutKey.Enter);
        } else {
            const rootHost = await driver.findElement(locator.contextMenu.exists);
            const shadowRoot = await rootHost.getShadowRoot();
            const menu = await shadowRoot.findElement(locator.contextMenu.menuContainer);
            const menuItems = await menu.findElements(locator.contextMenu.menuItem);
            for (const item of menuItems) {
                if ((await item.getText()) === constants.restartInternalShell) {
                    await driver.wait(async () => {
                        try {
                            await item.click();

                            return (await existsRootHost()) === false;
                        } catch (e) {
                            if (errors.isStaleError(e as Error)) {
                                return true;
                            }
                        }
                    }, constants.wait5seconds, "Could not click on Restart MySQL Shell");
                    break;
                }
            }
        }
        const notification = await Workbench.getNotification("This will close all MySQL Shell tabs", false);
        await Workbench.clickOnNotificationButton(notification, "Restart MySQL Shell");
        await driver.wait(async () => {
            return Os.findOnMySQLShLog(/Info/);
        }, constants.wait5seconds * 3, "Shell server did not start");
    };

    /**
     * Gets the tree items that are database connections from the DATABASE CONNECTIONS section
     * @returns A promise resolving with the database connections
     */
    public getTreeDatabaseConnections = async (): Promise<interfaces.ITreeDBConnection[]> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const dbConnections: interfaces.ITreeDBConnection[] = [];
        await Misc.switchBackToTopFrame();
        await this.focus();
        await this.clickToolbarButton(constants.collapseAll);
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
     * Verifies if the section is not loading
     * @returns A condition resolving to true if the section is not loading, false otherwise
     */
    public untilIsNotLoading = (): Condition<boolean> => {
        return new Condition(`for ${this.name} to be loaded`, async () => {
            const sec = await new SideBarView().getContent().getSection(this.name);
            const loading = await sec.findElements(locator.section.loadingBar);
            const activityBar = new ActivityBar();
            const icon = await activityBar.getViewControl(constants.extensionName);
            const progressBadge = await icon.findElements(locator.shellForVscode.loadingIcon);

            return (loading.length === 0) && (progressBadge.length === 0);
        });
    };

    /**
     * Gets an element from the tree
     * @param element The element
     * @param type The element type
     * @returns A promise resolving with the element
     */
    public getTreeItem = async (element: string | RegExp, type?: string): Promise<TreeItem> => {
        let el: TreeItem;

        if (!element && !type) {
            throw new Error(`element or type should be defined`);
        }

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const section: CustomTreeSection = await new SideBarView().getContent().getSection(this.name);

        await driver.wait(async () => {
            try {
                if (type) {
                    const treeItems = await section.getVisibleItems();

                    for (const item of treeItems) {
                        const itemIcon = await item.findElement(locator.section.itemIcon);
                        const backgroundImage = await itemIcon.getCssValue("background-image");

                        if (backgroundImage.match(new RegExp(type)) !== null) {
                            el = item;
                            break;
                        }
                    }
                } else {
                    if (element instanceof RegExp) {
                        const treeItems = await section.getVisibleItems();

                        for (const item of treeItems) {
                            if ((await item.getLabel()).match(element) !== null) {
                                el = item;
                                break;
                            }
                        }
                    } else {
                        el = await section.findItem(element, 5);
                    }
                }

                return el !== undefined;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait10seconds,
            `${element ? element.toString() : type} on section ${this.name} was not found`);

        return el;
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A promise resolving to true if the element exists, false otherwise
     */
    public treeItemExists = async (element: string | RegExp): Promise<boolean> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let exists = false;
        const section: CustomTreeSection = await new SideBarView().getContent().getSection(this.name);

        await driver.wait(async () => {
            try {
                const treeItems = await section.getVisibleItems();

                if (element instanceof RegExp) {
                    for (const item of treeItems) {
                        if ((await item.getLabel()).match(element) !== null) {
                            exists = true;
                            break;
                        }
                    }
                } else {
                    for (const item of treeItems) {
                        if ((await item.getLabel()) === element) {
                            exists = true;
                            break;
                        }
                    }
                }

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait10seconds, `Unable to verify if ${element.toString()} on section ${this.name} exists`);

        return exists;
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A condition resolving to true if the element exists, false otherwise
     */
    public untilTreeItemExists = (element: string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element.toString()} to exist on the tree`, async () => {
            return this.treeItemExists(element);
        });
    };

    /**
     * Verifies if an element is marked as default of the tree (icon is in bold)
     * @param element The element
     * @returns A promise resolving with true if the element is marked as default, false otherwise
     */
    public treeItemIsDefault = async (element: string | RegExp): Promise<boolean> => {
        let isDefault = false;

        await driver.wait(async () => {
            try {
                const treeItem = await this.getTreeItem(element);
                const el = await treeItem.findElement(locator.section.itemIcon);
                const backImage = await el.getCssValue("background-image");
                isDefault = backImage.match(/(Current|Default)/) !== null;

                return true;
            } catch (e) {
                if (!(errors.isStaleError(e as Error))) {
                    throw e;
                }
            }
        }, constants.wait3seconds, `Could not find if ${element} is default`);

        return isDefault;
    };

    /**
     * Verifies if an element is marked as default of the tree (icon is in bold)
     * @param element The element
     * @returns A condition resolving with true if the element is marked as default, false otherwise
     */
    public untilTreeItemIsDefault = (element: string): Condition<boolean> => {
        return new Condition(`for ${element} to be default`, async () => {
            return this.treeItemIsDefault(element);
        });
    };

    /**
     * Expands a tree item. If the dbConfig is set, it means the tree item is a db connection,
     * and it will handle the connection credentials
     * @param element The element
     * @param dbConfig The db configuration
     */
    public expandTreeItem = async (element: string | RegExp, dbConfig?: interfaces.IDBConnection): Promise<void> => {
        let treeItem = await this.getTreeItem(element);
        await treeItem.expand();

        if (dbConfig) {
            await driver.wait(async () => {
                try {
                    const inputWidget = await driver.wait(until.elementLocated(locator.inputBox.exists), 500)
                        .catch(() => { return undefined; });

                    if (inputWidget && (await (inputWidget as WebElement).isDisplayed())) {
                        await Workbench.setInputPassword((dbConfig.basic as interfaces.IConnBasicMySQL).password);

                        return driver.wait(async () => {
                            return treeItem.hasChildren();
                        }, constants.wait10seconds,
                            `${await treeItem.getLabel()} should have children after setting the password`);
                    } else if (await treeItem.hasChildren()) {
                        return true;
                    }
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    } else {
                        treeItem = await this.getTreeItem(element);
                    }
                }
            }, constants.wait20seconds,
                `The input password was not displayed nor the ${await treeItem.getLabel()} has children`);
        }
    };

    /**
     * Verifies if the tree item has a red mark on it
     * @param element The element
     * @returns A promise resolving to true if the tree item has a red mark, false otherwise
     */
    public treeItemHasRedMark = async (element: string | RegExp): Promise<boolean> => {
        const treeItem = await this.getTreeItem(element);
        const itemIcon = await treeItem.findElement(locator.section.itemIcon);
        const itemStyle = await itemIcon.getAttribute("style");

        return itemStyle.match(/(NotActive|Disabled|Stopped)/) !== null;
    };

    /**
     * Verifies if the tree item has a red mark on it
     * @param element The element
     * @returns A condition resolving to true if the tree item has a red mark, false otherwise
     */
    public untilTreeItemHasRedMark = (element: string): Condition<boolean> => {
        return new Condition(`for ${element} to have a red mark`, async () => {
            return this.treeItemHasRedMark(element);
        });
    };

    /**
     * Gets an action button from a tree element
     * @param element The tree item name
     * @param actionButton The action button d
     * @returns A promise resolving with the button
     */
    public getTreeItemActionButton = async (element: string, actionButton: string): Promise<WebElement> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return driver.wait(async () => {
            try {
                const treeItem = await this.getTreeItem(element);
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
        }, constants.wait5seconds, `Could not get icon for '${element}' (button was always stale)`);
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param element The element name
     * @param ctxMenuItem The context menu item
     * @param itemMap The map of the item. On macOS, the item map is required
     */
    public openContextMenuAndSelect = async (
        element: string | RegExp,
        ctxMenuItem: string | string[],
        itemMap?: Map<string, number>,
    ): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const treeItem = await this.getTreeItem(element);

        if (ctxMenuItem !== constants.openNotebookWithConn) {
            await driver.wait(this.untilIsNotLoading(), constants.wait1minute);
            const ociSection = new E2EAccordionSection(constants.ociTreeSection);
            await driver.wait(ociSection.untilIsNotLoading(), constants.wait20seconds);
        }

        if (element) {
            await driver.wait(async () => {
                if (Os.isMacOs()) {
                    await driver.actions()
                        .move({ origin: treeItem })
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

                        const menu = await treeItem.openContextMenu();
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
                `Could not select '${ctxMenuItem.toString()}' for tree item '${await treeItem.getLabel()}'`);
        } else {
            throw new Error(`TreeItem for context menu '${ctxMenuItem.toString()}' is undefined`);
        }
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

        if (isMySQL === true) {
            await this.openContextMenuAndSelect(name, constants.deleteDBConnection, constants.dbConnectionCtxMenu);
        } else {
            await this.openContextMenuAndSelect(name, constants.deleteDBConnection,
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
            await driver.wait(async () => {
                return !(await this.treeItemExists(name));
            }, constants.wait5seconds, `Tree item ${name} still exists in the tree`);
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

                await this.openContextMenuAndSelect(dbConnection.caption, constants.configureREST);
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
     * Expands a tree
     * @param tree The elements to expand
     * @param timeout The timeout to wait for each element to have children
     */
    public expandTree = async (tree: string[] | RegExp[], timeout = constants.wait10seconds): Promise<void> => {
        for (const item of tree) {
            await driver.wait(async () => {
                try {
                    const treeItem = await this.getTreeItem(item);

                    if (!(await treeItem.isExpanded())) {
                        if (await treeItem.isExpandable()) {
                            await treeItem.expand();
                            await driver.wait(async () => {
                                return treeItem.hasChildren();
                            }, timeout, `Waiting for ${item} to have children`);
                        }
                    }

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait15seconds, `Could not expand tree ${tree.toString()}`);
        }
    };

}
