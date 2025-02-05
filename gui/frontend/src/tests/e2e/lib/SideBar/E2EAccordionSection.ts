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
                                    await el.isDisplayed(); // is it stale ?

                                    return true;
                                }
                            }

                            if (refCaption === caption) {
                                el = new E2ETreeItem(item);
                                await el.setLevel();
                                await el.setCaption();
                                await el.isDisplayed(); // is it stale ?

                                return true;
                            }
                        } else {
                            const refCaption = await (await webElement
                                .findElement(locator.section.tree.element.label)).getText();

                            if (refCaption === caption) {
                                el = new E2ETreeItem(item);
                                await el.setLevel();
                                await el.setCaption();
                                await el.isDisplayed(); // is it stale ?

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
        }, constants.wait3seconds,
            `Could not find '${caption}' on section ${this.accordionSectionName}`);

        return el!;
    };

    /**
     * Gets an element from the tree by its oci type
     * @param type The type (ociDbSystem, ociBastion)
     * @returns A promise resolving with the element
     */
    public getOciItemByType = async (type: string): Promise<string> => {
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

        await driver.wait(async () => {
            try {
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

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait3seconds,
            `Could not find '${caption}' on section ${this.accordionSectionName}`);

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
        return new Condition(`for ${element} to exist on the tree`, async () => {
            return !(await this.existsTreeItem(element));
        });
    };

    /**
     * Expands a tree
     * @param tree The elements to expand
     */
    public expandTree = async (tree: string[]): Promise<void> => {
        for (const item of tree) {
            await driver.wait(async () => {
                try {
                    const treeItem = await this.getTreeItem(item);

                    if (await treeItem.isExpandable()) {
                        await treeItem.expand();
                        await driver.wait(treeItem.untilHasChildren(), constants.wait10seconds);

                        return true;
                    }
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait5seconds, `Could not expand tree ${tree.toString()}`);
        }
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param treeItemCaption The tree item caption
     * @param ctxMenuItem The context menu item
     */
    public openContextMenuAndSelect = async (
        treeItemCaption: string,
        ctxMenuItem: string | string[]): Promise<void> => {

        await driver.wait(async () => {
            try {
                const treeItem = await this.getTreeItem(treeItemCaption);
                await treeItem.openContextMenuAndSelect(ctxMenuItem);

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not select '${ctxMenuItem.toString()}' for tree item ${treeItemCaption}`);

    };

}
