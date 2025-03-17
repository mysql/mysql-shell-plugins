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

import { Condition, error, until, WebElement, By } from "selenium-webdriver";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import * as interfaces from "../interfaces.js";
import { DatabaseConnectionDialog } from "../Dialogs/DatabaseConnectionDialog.js";
import { driver } from "../driver.js";
import { E2ETreeItem } from "./E2ETreeItem.js";
import { ConfirmDialog } from "../Dialogs/ConfirmationDialog.js";
import { PasswordDialog } from "../Dialogs/PasswordDialog.js";
import { Misc } from "../misc.js";
import { E2EToastNotification } from "../E2EToastNotification.js";

/**
 * This class represents the Accordion section element and its related functions
 */
export class E2EAccordionSection {

    /** Accordion section name */
    public accordionSectionName: string;

    public constructor(sectionName: string) {
        this.accordionSectionName = sectionName;
    }

    /**
     * Gets the section web element
     * @param sectionName The section name
     * @returns A promise resolving with the element
     */
    public get = async (sectionName?: string): Promise<WebElement | undefined> => {
        const section = sectionName ?? this.accordionSectionName;

        switch (section) {

            case constants.dbTreeSection: {
                return driver.findElement(locator.dbTreeSection.exists);
            }

            case constants.ociTreeSection: {
                return driver.findElement(locator.ociTreeSection.exists);
            }

            case constants.openEditorsTreeSection: {
                return driver.findElement(locator.openEditorsTreeSection.exists);
            }

            default: {
                throw new Error(`Unknown section ${this.accordionSectionName}`);
            }
        }
    };

    /**
     * Clicks a section toolbar button
     * @param button The button
     * @returns A promise resolving when the button is clicked
     */
    public clickToolbarButton = async (button: string): Promise<void> => {
        await driver.wait(this.untilIsNotLoading(), constants.wait20seconds,
            `${constants.ociTreeSection} is still loading`);

        let sectionActions: WebElement;
        const thisSection = await this.get();
        let sectionLocator: By;

        if (this.accordionSectionName === constants.dbTreeSection) {
            sectionLocator = locator.dbTreeSection.exists;
        } else if (this.accordionSectionName === constants.ociTreeSection) {
            sectionLocator = locator.ociTreeSection.exists;
        } else {
            sectionLocator = locator.openEditorsTreeSection.exists;
        }

        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    await driver.actions().move({ origin: thisSection }).perform();
                    sectionActions = await driver
                        .findElement(sectionLocator);

                    return sectionActions.isDisplayed();
                }, constants.wait5seconds, `Toolbar buttons for ${this.accordionSectionName} were not displayed`);

                switch (button) {

                    case constants.createNewDatabaseConnection: {
                        await thisSection?.findElement(locator.dbTreeSection.actions.createNewDatabaseConnection)
                            .click();
                        break;
                    }

                    case constants.refreshConnectionList: {
                        await thisSection?.findElement(locator.dbTreeSection.actions.refreshConnections)
                            .click();
                        break;
                    }

                    case constants.collapseAll: {
                        await thisSection?.findElement(locator.dbTreeSection.actions.collapseAll)
                            .click();
                        break;
                    }

                    case constants.addConsole: {
                        await thisSection?.findElement(locator.openEditorsTreeSection.actions.addConsole)
                            .click();
                        break;
                    }

                    case constants.reloadOCIProfiles: {
                        await thisSection?.findElement(locator.ociTreeSection.actions.refreshOCIProfiles)
                            .click();
                        break;
                    }

                    default: {
                        break;
                    }

                }

                return true;
            } catch (e) {
                if (!(e instanceof error.ElementNotInteractableError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `${button} on section '${this.accordionSectionName}' was not interactable`);

    };

    /**
     * Creates a database connection from the DATABASE CONNECTIONS section toolbar
     * @param dbConfig The database configuration data
     * @returns A promise resolving when the connection is created
     */
    public createDatabaseConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        await this.clickToolbarButton(constants.createNewDatabaseConnection);
        await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists), constants.wait10seconds);
        await DatabaseConnectionDialog.setConnection(dbConfig);
    };

    /**
     * Focus the section, by expanding the section and collapsing all the other sections
     * @returns A promise resolving when the section is focused
     */
    public focus = async (): Promise<void> => {

        const sections = [
            constants.openEditorsTreeSection,
            constants.dbTreeSection,
            constants.ociTreeSection,
        ];

        await driver.wait(async () => {
            try {
                for (const section of sections) {
                    section !== this.accordionSectionName ? await this.collapse(section) : await this.expand(section);
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError) &&
                    !(e instanceof error.ElementClickInterceptedError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not focus on section ${this.accordionSectionName}`);

    };

    /**
     * Verifies if the section is expanded
     * @param section The section name. Default is this section
     * @returns A promise resolving with true if the section is expanded, false otherwise
     */
    public isExpanded = async (section?: string): Promise<boolean> => {
        return (await (await this.get(section))!.findElements(locator.section.isExpanded)).length > 0;
    };

    /**
     * Expands the section
     * @param section The section name. Default is this section
     * @returns A promise resolving when the section is expanded
     */
    public expand = async (section?: string): Promise<void> => {

        if (!await this.isExpanded(section)) {
            await driver.wait(async () => {
                await (await this.get(section))!.findElement(locator.section.toggle).click();
                await driver.sleep(150);

                return this.isExpanded(section);
            }, constants.wait3seconds, `Could not expand ${this.accordionSectionName} section`);
        }
    };

    /**
     * Collapse the section
     * @param section The section name. Default is this section
     * @returns A promise resolving when the section is collapsed
     */
    public collapse = async (section?: string): Promise<void> => {
        if (await this.isExpanded(section)) {
            await driver.wait(async () => {
                await (await this.get(section))!.findElement(locator.section.toggle).click();
                await driver.sleep(150);

                return !(await this.isExpanded(section));
            }, constants.wait3seconds, `Could not collapse ${this.accordionSectionName} section`);
        }
    };

    /**
     * Gets the database connections from the DATABASE CONNECTIONS section
     * @returns A promise resolving with the database connections
     */
    public getDatabaseConnections = async (): Promise<interfaces.ITreeDBConnection[]> => {

        const dbConnections: interfaces.ITreeDBConnection[] = [];
        await this.focus();
        await this.clickToolbarButton(constants.collapseAll);
        const treeItems = await (await this.get())!.findElements(locator.section.tree.element.exists);
        for (const item of treeItems) {
            const icon = await item.findElement(locator.section.tree.element.icon.exists);
            const backgroundImage = await icon.getCssValue("mask-image");
            if (backgroundImage.match(/connection/) !== null || backgroundImage.match(/ociDbSystem/) !== null) {
                const itemName = await (await item.findElement(locator.section.tree.element.dbTreeEntry)).getText();
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
     * Gets all the visible elements in the tree
     * @returns A promise resolving with the elements
     */
    public getVisibleTreeItems = async (): Promise<WebElement[]> => {
        return (await this.get())!.findElements(locator.section.tree.element.exists);
    };

    /**
     * Verifies if the section is not loading
     * @returns A condition resolving to true if the section is not loading, false otherwise
     */
    public untilIsNotLoading = (): Condition<boolean> => {
        return new Condition(`for ${this.accordionSectionName} to be loaded`, async () => {
            return (await (await this.get())!.findElements(locator.section.loadingBar)).length === 0;
        });
    };

    /**
     * Gets an item from the tree
     * @param caption The caption
     * @param subCaption The sub caption
     * @returns A promise resolving with the item
     */
    public getTreeItem = async (caption: string, subCaption?: string): Promise<E2ETreeItem> => {
        let el: E2ETreeItem | undefined;
        let rootItemLocator: By;

        if (this.accordionSectionName === constants.dbTreeSection) {
            rootItemLocator = locator.section.tree.element.dbTreeEntry;
        } else if (this.accordionSectionName === constants.ociTreeSection) {
            rootItemLocator = locator.section.tree.element.ociTreeEntry;
        } else {
            rootItemLocator = locator.section.tree.element.openEditorTreeEntry;
        }

        await driver.wait(async () => {
            try {
                const treeItems = await this.getVisibleTreeItems();

                if (treeItems.length > 0) {
                    for (const item of treeItems) {
                        const webElement = await item.findElement(rootItemLocator);

                        if (this.accordionSectionName === constants.dbTreeSection) {
                            const refCaption = await (await webElement
                                .findElement(locator.section.tree.element.mainCaption)).getText();

                            if (subCaption) {
                                const refSubCaption = await (await webElement
                                    .findElement(locator.section.tree.element.subCaption)).getText()
                                    .catch((e) => {
                                        if (e instanceof error.NoSuchElementError) {
                                            return undefined;
                                        }
                                    });

                                if (refSubCaption === subCaption && refCaption === caption) {
                                    el = new E2ETreeItem(item);
                                    await el.setLevel();
                                    await el.setCaption();
                                    await el.setSubCaption();
                                    await el.isEnabled(); // is it stale ?

                                    return true;
                                }
                            }

                            if (refCaption === caption) {
                                el = new E2ETreeItem(item);
                                await el.setLevel();
                                await el.setCaption();
                                await el.isEnabled(); // is it stale ?

                                return true;
                            }
                        } else {
                            const refCaption = await (await webElement
                                .findElement(locator.section.tree.element.label)).getText();

                            if (refCaption === caption) {
                                el = new E2ETreeItem(item);
                                await el.setLevel();
                                await el.setCaption();
                                await el.isEnabled(); // is it stale ?

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
        }, constants.wait5seconds,
            `Could not find '${caption}' on section ${this.accordionSectionName}`);

        return el!;
    };

    /**
     * Expands an item on the tree
     * @param data The caption or the database connection
     */
    public expandTreeItem = async (data: string | interfaces.IDBConnection): Promise<void> => {
        const action = async () => {
            await driver.wait(async () => {

                const refCaption = typeof data === "string" ? data : data.caption;

                if ((await this.isTreeItemExpandable(refCaption!))) {
                    if (!(await this.isTreeItemExpanded(refCaption!))) {
                        const treeItem = await this.getTreeItem(refCaption!);
                        const toggle = await treeItem.findElement(locator.section.tree.element.toggle);
                        await toggle.click();

                        if (typeof data !== "string") {
                            await driver.wait(async () => {
                                if (await PasswordDialog.exists()) {
                                    await PasswordDialog.setCredentials(data);

                                    return driver.wait(async () => {
                                        return this.treeItemHasChildren(data.caption!);
                                    }, constants.wait15seconds, `${data.caption} should have children`);
                                } else if (await this.treeItemHasChildren(data.caption!)) {
                                    return true;
                                }
                            }, constants.wait10seconds,
                                `The password dialog was not displayed nor the ${data.caption!} has children`);
                        }
                    }

                    return this.isExpanded();
                } else {
                    return true;
                }
            }, constants.wait5seconds, `Could not expand ${data.toString()}`);
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });
    };

    /**
     * Right-clicks on an element to open the context menu
     * @param caption The tree item caption
     */
    public openContextMenu = async (caption: string): Promise<void> => {
        const contextMenuLocator = locator.section.tree.element.contextMenu;

        const action = async () => {
            const treeItem = await this.getTreeItem(caption);
            await driver.wait(async () => {
                await driver.actions()
                    .move({ origin: treeItem })
                    .contextClick(treeItem)
                    .perform();

                return (await driver.findElements(contextMenuLocator.exists)).length > 0;
            }, constants.wait3seconds, `Context menu was not displayed on element ${caption}`);
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });
    };

    /**
     * Selects the item on the context menu
     * @param ctxMenuItem The context menu item
     */
    public selectFromContextMenu = async (ctxMenuItem: string | string[]): Promise<void> => {
        const contextMenuLocator = locator.section.tree.element.contextMenu;
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

        throw new Error(`Could not find context menu item '${ctxMenuItem.toString()}'`);
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param caption Tree item caption
     * @param ctxMenuItem The context menu item
     */
    public openContextMenuAndSelect = async (caption: string, ctxMenuItem: string | string[]): Promise<void> => {
        const action = async () => {
            await this.openContextMenu(caption);
            await this.selectFromContextMenu(ctxMenuItem);
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError ||
                (String(e).includes(`Could not find context menu item`))
            ) {
                await action();
            } else {
                throw e;
            }
        });
    };

    /**
     * Gets an element from the tree by its oci type
     * @param type The type (ociDbSystem, ociBastion)
     * @returns A promise resolving with the element
     */
    public getOciTreeItemByType = async (type: string): Promise<string> => {
        let ociLabel = "";

        await driver.wait(async () => {
            try {
                if (type.match(/(ociDbSystem|ociBastion|ociCompute)/) !== null) {
                    const treeItems = await (await this.get())!
                        .findElements(locator.section.tree.element.ociTreeEntry);

                    for (const treeItem of treeItems) {
                        const el = await treeItem.findElement(locator.section.tree.element.icon.exists);
                        const backImage = await el.getCssValue("mask-image");
                        if (backImage.match(new RegExp(type)) !== null) {
                            const label = await treeItem.findElement(locator.section.tree.element.label);
                            ociLabel = await label.getText();

                            return true;
                        }
                    }

                    throw new Error(`Could not find the item type ${type} on section ${this.accordionSectionName}`);
                } else {
                    throw new Error(`Unknown type: ${type}`);
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not get the oci element by type`);

        return ociLabel;
    };

    /**
     * Verifies if an element exists on the tree
     * @param caption The element caption
     * @returns A promise resolving to true if the element exists, false otherwise
     */
    public existsTreeItem = async (caption: string): Promise<boolean> => {
        let exists = false;
        let rootItemLocator: By;

        if (this.accordionSectionName === constants.dbTreeSection) {
            rootItemLocator = locator.section.tree.element.dbTreeEntry;
        } else if (this.accordionSectionName === constants.ociTreeSection) {
            rootItemLocator = locator.section.tree.element.ociTreeEntry;
        } else {
            rootItemLocator = locator.section.tree.element.openEditorTreeEntry;
        }

        const action = async () => {
            const treeItems = await this.getVisibleTreeItems();

            if (treeItems.length > 0) {

                for (const item of treeItems) {
                    const webElement = await item.findElement(rootItemLocator);

                    if (this.accordionSectionName === constants.dbTreeSection) {

                        const refCaption = await (await webElement
                            .findElement(locator.section.tree.element.mainCaption)).getText();

                        if (refCaption === caption) {
                            exists = true;
                            break;
                        }
                    } else {
                        const refCaption = await (await webElement
                            .findElement(locator.section.tree.element.label)).getText();

                        if (refCaption === caption) {
                            exists = true;
                            break;
                        }
                    }
                }
            }
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });

        return exists;
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A condition resolving to true if the element exists, false otherwise
     */
    public untilTreeItemExists = (element: string): Condition<boolean> => {
        return new Condition(`for ${element} to exist on the tree`, async () => {
            return this.existsTreeItem(element);
        });
    };

    /**
     * Verifies if an element does not exist on the tree
     * @param element The element
     * @returns A condition resolving to true if the element does not exist, false otherwise
     */
    public untilTreeItemDoesNotExists = (element: string): Condition<boolean> => {
        return new Condition(`for ${element} to not exist on the tree`, async () => {
            return !(await this.existsTreeItem(element));
        });
    };

    /**
     * Expands a tree
     * @param tree The elements to expand
     * @param timeout The amount of time to wait until each tree element has children
     */
    public expandTree = async (tree: string[], timeout = constants.wait10seconds): Promise<void> => {
        for (const item of tree) {
            await driver.wait(async () => {
                try {
                    await driver.wait(this.untilTreeItemHasChildren(item), timeout);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, `Could not expand tree ${tree.toString()}`);
        }
    };

    /**
     * Verifies if the tree element has children
     * @param caption The tree item caption
     * @returns A promise resolving with true if the element has children, false otherwise
     */
    public treeItemHasChildren = async (caption: string): Promise<boolean> => {
        await this.expandTreeItem(caption);

        return (await this.getTreeItemChildren(caption)).length > 0;
    };

    /**
     * Gets the tree items under the current item. It expands the current item
     * @param caption The tree item caption
     * @returns A promise resolving with the child items of the current item
     */
    public getTreeItemChildren = async (caption: string): Promise<E2ETreeItem[]> => {

        let items: E2ETreeItem[] = [];

        const getNextSibling = async (el: E2ETreeItem, rootLevel: number): Promise<E2ETreeItem> => {
            let item: E2ETreeItem | undefined;

            const nextSibling: WebElement = await driver
                .executeScript("return arguments[0].nextElementSibling;", el);

            if (nextSibling) {
                item = new E2ETreeItem(nextSibling);
                await item.setLevel();

                if (item.level === rootLevel + 1) {
                    await item.setCaption();
                } else {
                    item = undefined;
                }
            }

            return item!;
        };

        const action = async () => {
            await this.expandTreeItem(caption);

            const treeItem = await this.getTreeItem(caption);
            const rootLevel = treeItem.level!;
            let nextSibling = await getNextSibling(treeItem, rootLevel);

            while (nextSibling) {
                items.push(nextSibling);
                nextSibling = await getNextSibling(nextSibling, rootLevel);
            }
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                items = [];
                await action();
            } else {
                throw e;
            }
        });


        return items;
    };

    /**
     * Verifies if the tree element can be expanded
     * @param caption The tree item caption
     * @returns A promise resolving with true if the element can be expanded, false otherwise
     */
    public isTreeItemExpandable = async (caption: string): Promise<boolean> => {
        let isExpandable = false;

        const action = async () => {
            const treeItem = await this.getTreeItem(caption);
            isExpandable = (await treeItem.findElements(locator.section.tree.element.toggle)).length > 0;
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });

        return isExpandable;
    };

    /**
     * Verifies if the tree element is expanded
     * @param caption The tree item caption
     * @returns A promise resolving with true if the section is expanded, false otherwise
     */
    public isTreeItemExpanded = async (caption: string): Promise<boolean> => {
        let isExpanded = false;

        const action = async () => {
            const treeItem = await this.getTreeItem(caption);
            isExpanded = (await treeItem.findElements(locator.section.tree.element.isExpanded)).length > 0;
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });

        return isExpanded;

    };

    /**
     * Collapses th is item on the tree
     * @param caption The tree item caption
     */
    public collapseTreeItem = async (caption: string): Promise<void> => {
        const action = async () => {
            await driver.wait(async () => {
                if (await this.isTreeItemExpanded(caption)) {
                    const toggle = await (await this.getTreeItem(caption))
                        .findElement(locator.section.tree.element.toggle);
                    await toggle.click();
                }

                return !(await this.isTreeItemExpanded(caption));
            }, constants.wait3seconds, `Could not collapse ${caption}`);
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });
    };

    /**
     * Verifies if this tree item has children
     * @param caption The tree item caption
     * @returns A condition resolving with true if the element has children, false otherwise
     */
    public untilTreeItemHasChildren = (caption: string): Condition<boolean> => {
        return new Condition(`for ${caption} to have children`, async () => {
            return (await this.getTreeItemChildren(caption)).length > 0;
        });
    };

    /**
     * Configures the Rest Service for this tree item
     * @param caption The tree item caption
     * @param dbConnection The database connection
     * @returns A promise resolving when the rest service is configured
     */
    public configureMySQLRestService = async (
        caption: string,
        dbConnection: interfaces.IDBConnection): Promise<void> => {
        await this.openContextMenuAndSelect(caption, constants.configureInstanceForMySQLRestServiceSupport);

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
     * @param caption The tree item caption
     * @returns A promise resolving to true when the item is marked as default
     */
    public treeItemIsDefault = async (caption: string): Promise<boolean> => {
        let isDefault = false;

        const action = async () => {
            const treeItem = await this.getTreeItem(caption);
            isDefault = await treeItem.isDefault();
        };

        await action().catch(async (e: Error) => {
            if (e instanceof error.StaleElementReferenceError) {
                await action();
            } else {
                throw e;
            }
        });

        return isDefault;
    };

    /**
     * Verifies if the tree item is marked as default
     * @param caption The tree item caption
     * @returns A condition resolving to true when the item is marked as default
     */
    public untilTreeItemIsDefault = (caption: string): Condition<boolean> => {
        return new Condition(`for ${caption} to be default`, async () => {
            return this.treeItemIsDefault(caption);
        });
    };

}
