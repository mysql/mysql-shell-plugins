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

import { hostname } from "os";
import { Condition, until, WebElement, error, By } from "selenium-webdriver";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import * as interfaces from "../interfaces.js";
import { Misc } from "../misc.js";
import { E2EAccordionSection } from "./E2EAccordionSection.js";
import { driver } from "../driver.js";
import { PasswordDialog } from "../Dialogs/PasswordDialog.js";
import { E2EToastNotification } from "../E2EToastNotification.js";
import { ConfirmDialog } from "../Dialogs/ConfirmationDialog.js";

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
    public getElement = async (element: string | RegExp): Promise<WebElement> => {
        let el: WebElement | undefined;
        let elementLocator: By;

        if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
            elementLocator = locator.section.tree.element.dbTreeEntry;
        } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
            elementLocator = locator.section.tree.element.ociTreeEntry;
        } else {
            elementLocator = locator.section.tree.element.openEditorTreeEntry;
        }

        await driver.wait(async () => {
            try {
                const treeItems = await (await this.accordionSection.get())!
                    .findElements(locator.section.tree.element.exists);

                if (treeItems.length > 0) {
                    for (const item of treeItems) {
                        const caption = await item.findElement(elementLocator);
                        let elementText: string;

                        if (await caption.getAttribute("id")) {
                            elementText = await caption.getText();
                        } else {
                            elementText = await (await item.findElement(locator.section.tree.element.label)).getText();
                        }

                        if (element instanceof RegExp) {
                            if (elementText.match(element) !== null) {
                                el = item;
                                break;
                            }

                        } else {
                            if (elementText === element) {
                                el = item;
                                break;
                            }
                        }
                    }

                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait2seconds,
            `Could not perform get on ${element.toString()} on section ${this.accordionSection.accordionSectionName}`);

        if (!el) {
            throw new Error(`Could not find '${element}' on section ${this.accordionSection.accordionSectionName}`);
        } else {
            return el;
        }
    };

    /**
     * Gets an element from the tree
     * @param parent The parent element
     * @param element The element
     * @returns A promise resolving with the element
     */
    public getChildElement = async (parent: string | RegExp, element: string | RegExp): Promise<WebElement> => {
        let el: WebElement | undefined;
        let elementLocator: By;

        await driver.wait(async () => {
            try {

                if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
                    elementLocator = locator.section.tree.element.dbTreeEntry;
                } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                    elementLocator = locator.section.tree.element.ociTreeEntry;
                } else {
                    elementLocator = locator.section.tree.element.openEditorTreeEntry;
                }

                const treeParentElement = await this.getElement(parent);
                const treeParentElementLevel = parseInt((await treeParentElement.getAttribute("class"))
                    .match(/tabulator-tree-level-(\d+)/)![1], 10);

                const nextSibling = async (el: WebElement): Promise<WebElement> => {
                    return driver.executeScript("return arguments[0].nextElementSibling;", el);
                };


                let refElement = await nextSibling(treeParentElement);

                if (!refElement) {
                    throw new Error(`Could not find the next sibling of ${parent}`);
                }

                while (refElement) {
                    const refElementLevel = parseInt((await refElement.getAttribute("class"))
                        .match(/tabulator-tree-level-(\d+)/)![1], 10);

                    if (refElementLevel > treeParentElementLevel) {
                        const caption = await refElement.findElement(elementLocator);
                        let elementText: string;

                        if (await caption.getAttribute("id")) {
                            elementText = await caption.getText();
                        } else {
                            elementText = await (await refElement.findElement(locator.section.tree.element.label))
                                .getText();
                        }

                        if (element instanceof RegExp) {

                            if (elementText.match(element) !== null) {
                                el = refElement;
                                break;
                            }

                        } else {
                            if (elementText === element) {
                                el = refElement;
                                break;
                            }
                        }
                        refElement = await nextSibling(refElement);
                    } else {
                        console.log(`no more after: ${await refElement.getAttribute("outerHTML")}`);
                    }

                    break;
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not find element '${element}' as child of '${parent}'`);

        return el!;
    };

    /**
     * Gets an element from the tree by its oci type
     * @param type The type (ociDbSystem, ociBastion)
     * @returns A promise resolving with the element
     */
    public getOciElementByType = async (type: string): Promise<string> => {
        let ociLabel = "";

        await driver.wait(async () => {
            try {
                if (type.match(/(ociDbSystem|ociBastion|ociCompute)/) !== null) {
                    const treeItems = await (await this.accordionSection.get())!
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

                    throw new Error(`Could not find the item type ${type} on section ${this
                        .accordionSection.accordionSectionName}`);
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
     * @param element The element
     * @returns A condition resolving to true if the element exists, false otherwise
     */
    public untilExists = (element: string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element} to exist on the tree`, async () => {
            let reloadLabel: string;
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);

            if (this.accordionSection.accordionSectionName === constants.dbTreeSection ||
                this.accordionSection.accordionSectionName === constants.ociTreeSection) {

                if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
                    reloadLabel = constants.refreshConnectionList;
                } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                    reloadLabel = constants.reloadOCIProfiles;
                }

                await this.accordionSection.clickToolbarButton(reloadLabel!);
                await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            }

            return this.elementExists(element);
        });
    };

    /**
     * Verifies if an element does not exist the tree
     * @param element The element
     * @returns A condition resolving to true if the element does not exist, false otherwise
     */
    public untilDoesNotExist = (element: string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element} to not exist on the tree`, async () => {
            let reloadLabel: string;
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            if (this.accordionSection.accordionSectionName === constants.dbTreeSection ||
                this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                if (this.accordionSection.accordionSectionName === constants.dbTreeSection) {
                    reloadLabel = constants.refreshConnectionList;
                } else if (this.accordionSection.accordionSectionName === constants.ociTreeSection) {
                    reloadLabel = constants.reloadOCIProfiles;
                }
                await this.accordionSection.clickToolbarButton(reloadLabel!);
                await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
            }

            return !(await this.elementExists(element));
        });
    };

    /**
     * Verifies if an element is marked as default of the tree (icon is in bold)
     * @param element The element
     * @param type The type (ociProfileCurrent, folderCurrent, ociBastionCurrent, mrsServiceDefault, schemaMySQLCurrent)
     * @returns A promise resolving with true if the element is marked as default, false otherwise
     */
    public isElementDefault = async (element: string, type: string): Promise<boolean | undefined> => {

        let isDefaultElement = false;
        await driver.wait(async () => {
            try {
                const treeItem = await this.getElement(element);
                const el = await treeItem.findElement(locator.section.tree.element.icon.exists);
                const backImage = await el.getCssValue("mask-image");

                switch (type) {
                    case "profile": {
                        isDefaultElement = backImage.includes("ociProfileCurrent");
                        break;
                    }
                    case "compartment": {
                        isDefaultElement = backImage.includes("folderCurrent");
                        break;
                    }
                    case "bastion": {
                        isDefaultElement = backImage.includes("ociBastionCurrent");
                        break;
                    }
                    case "rest": {
                        isDefaultElement = backImage.includes("mrsServiceDefault");
                        break;
                    }
                    case "schema": {
                        isDefaultElement = backImage.includes("schemaMySQLCurrent");
                        break;
                    }
                    default: {
                        throw new Error(`Unknown element default type ${type}`);
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not verify if tree element (${element}) is marked as default`);

        return isDefaultElement;
    };

    /**
     * Expands an element on the tree
     * @param elements The elements
     * @param loadingTimeout The timeout to load the expand
     * @returns A promise resolving when the elements are expanded
     */
    public expandElement = async (elements: Array<string | RegExp>,
        loadingTimeout = constants.wait20seconds): Promise<void> => {
        await driver.wait(async () => {
            try {
                for (let i = 0; i <= elements.length - 1; i++) {
                    if (!(await this.elementIsExpanded(elements[i]))) {
                        const treeElement = await this.getElement(elements[i]);
                        await treeElement.findElement(locator.section.tree.element.toggle).click();

                        if (i !== elements.length - 1) {
                            await driver.wait(this.untilElementHasChildren(elements[i]), loadingTimeout);
                        } else {
                            await driver.wait(this.accordionSection.untilIsNotLoading(), loadingTimeout);
                        }
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait3seconds, "Could not expand element(s)");
    };

    /**
     * Collapses a tree element
     * @param element The element name
     */
    public collapseElement = async (element: string): Promise<void> => {
        const treeElement = await this.getElement(element);
        await treeElement.findElement(locator.section.tree.element.toggle).click();
    };

    /**
     * Verifies if the tree element is expanded
     * @param element The element name
     * @returns A promise resolving with true if the section is expanded, false otherwise
     */
    public elementIsExpanded = async (element: string | RegExp): Promise<boolean> => {
        return (await (await this.getElement(element))
            .findElements(locator.section.tree.element.isExpanded)).length > 0;
    };

    /**
     * Verifies if the tree element has children
     * @param element The element name
     * @returns A promise resolving with true if the element has children, false otherwise
     */
    public hasChildren = async (element: string | RegExp): Promise<boolean> => {
        const treeElement = await this.getElement(element);
        const elementLevel = (await treeElement.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];
        const nextSibling: WebElement | undefined = await driver
            .executeScript("return arguments[0].nextElementSibling;", treeElement);
        if (nextSibling) {
            const siblingLevel = (await nextSibling.getAttribute("class")).match(/tabulator-tree-level-(\d+)/)![1];

            return parseInt(siblingLevel, 10) > parseInt(elementLevel, 10);
        } else {
            return false;
        }
    };

    /**
     * Verifies if the tree element has children
     * @param element The element name
     * @returns A condition resolving with true if the element has children, false otherwise
     */
    public untilElementHasChildren = (element: string | RegExp): Condition<boolean> => {
        return new Condition(`for ${element} to have children`, async () => {
            return this.hasChildren(element);
        });
    };

    /**
     * Expands a database connection
     * @param dbConnection The db connection
     * @returns A promise resolving when the database connection is expanded
     */
    public expandDatabaseConnection = async (dbConnection: interfaces.IDBConnection): Promise<void> => {

        await this.expandElement([dbConnection.caption!]);
        await driver.wait(async () => {
            return this.elementIsExpanded(dbConnection.caption!);
        }, constants.wait5seconds, `Could not expand ${dbConnection.caption!}`);

        await driver.wait(async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(dbConnection);

                return driver.wait(async () => {
                    return this.hasChildren(dbConnection.caption!);
                }, constants.wait15seconds, `${dbConnection.caption} should have children`);
            } else if (await this.hasChildren(dbConnection.caption!)) {
                return true;
            }
        }, constants.wait10seconds,
            `The password dialog was not displayed nor the ${dbConnection.caption!} has children`);
    };

    /**
     * Verifies if a DBSystem is stopped
     * @param dbSystem The db system
     * @returns A promise resolving with true if the DB System is stopped, false otherwise
     */
    public isDBSystemStopped = async (dbSystem: string): Promise<boolean> => {
        const treeElement = await this.getElement(dbSystem);
        const itemIcon = await treeElement.findElement(locator.section.tree.element.icon.exists);
        const itemStyle = await itemIcon.getCssValue("mask-image");

        return itemStyle.includes("statusDotMask");
    };

    /**
     * Verifies if a MySQL Rest Service is disabled
     * @param mrsTreeItem The MRS tree item name
     * @returns A promise resolving with true if the MRS is disabled, false otherwise
     */
    public isMRSDisabled = async (mrsTreeItem: string): Promise<boolean> => {
        const treeElement = await this.getElement(mrsTreeItem);

        return (await treeElement.findElements(locator.section.tree.element.icon.redDot)).length > 0;
    };

    /**
     * Gets an action button from a tree element
     * @param treeItem The tree item
     * @param actionButton The action button d
     * @returns A promise resolving with the button
     */
    public getActionButton = async (treeItem: string, actionButton: string): Promise<WebElement | undefined> => {
        let treeItemActionButton: WebElement | undefined;

        await driver.wait(async () => {
            try {
                const treeElement = await this.getElement(treeItem);
                await driver.actions().move({ origin: treeElement }).perform();

                if (actionButton === constants.openNewDatabaseConnectionOnNewTab) {
                    treeItemActionButton = await treeElement
                        .findElement(locator.section.tree.element.actions.openNewDatabaseConnection);
                } else if (actionButton === constants.refreshConnection) {
                    treeItemActionButton = await treeElement
                        .findElement(locator.section.tree.element.actions.refreshConnection);
                } else if (actionButton === constants.newMySQLScript) {
                    treeItemActionButton = await treeElement
                        .findElement(locator.section.tree.element.actions.newMySQLScript);
                } else if (actionButton === constants.loadSQLScriptFromDisk) {
                    treeItemActionButton = await treeElement
                        .findElement(locator.section.tree.element.actions.loadSQLScriptFromDisk);
                } else if (actionButton === constants.closeEditor) {
                    treeItemActionButton = await treeElement
                        .findElement(locator.section.tree.element.actions.closeEditor);
                }
                else {
                    throw new Error(`Unknown action button ${actionButton}`);
                }

                await driver.wait(until.elementIsVisible(treeItemActionButton), constants.wait3seconds,
                    `${actionButton} action button was not visible`);

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds,
            `Could not get action button ${actionButton} for tree element ${treeItem}`);

        return treeItemActionButton;
    };

    /**
     * Verifies if the router element on the tree is marked as active (yellow dot on the icon)
     * @returns A promise resolving with true if the router is active, false otherwise
     */
    public isRouterActive = async (): Promise<boolean> => {
        const treeElement = await this.getElement(new RegExp(hostname()));
        const itemIcon = await treeElement.findElement(locator.section.tree.element.icon.exists);
        const itemStyle = await itemIcon.getCssValue("mask-image");

        return itemStyle.match(/router.svg/) !== null;
    };

    /**
     * Verifies if the router element on the tree is marked with errors (red dot on the icon)
     * @returns A promise resolving with true if the router has errors, false otherwise
     */
    public routerHasError = async (): Promise<boolean> => {
        const treeElement = await this.getElement(new RegExp(hostname()));
        const itemIcon = await treeElement.findElement(locator.section.tree.element.icon.exists);
        const itemStyle = await itemIcon.getCssValue("mask-image");

        return itemStyle.includes("routerError");
    };

    /**
     * Gets a script from the OPEN EDITORS section
     * @param name The script name
     * @param type The script type
     * @returns A promise resolving with the script
     */
    public getScript = async (name: RegExp, type: string): Promise<WebElement | undefined> => {
        let script: WebElement | undefined;

        await driver.wait(new Condition("", async () => {
            try {
                const section = await this.accordionSection.get();
                const treeItems = await section!.findElements(locator.section.tree.element.openEditorTreeEntry);

                for (const item of treeItems) {

                    if ((await item.getText()).match(name) !== null) {

                        const itemIcon = await item.findElement(locator.section.tree.element.icon.exists);

                        if ((await itemIcon.getCssValue("mask-image")).includes(type)) {
                            script = item;

                            return true;
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

        return script;
    };

    /**
     * Deletes a database connection
     * @param name The database name
     * @param verifyDelete True is the removal should be verified
     * @returns A promise resolving when the database is deleted
     */
    public deleteDatabaseConnection = async (name: string, verifyDelete = true): Promise<void> => {

        await this.openContextMenuAndSelect(name, constants.deleteDBConnection);
        const dialog = await new ConfirmDialog().untilExists();
        await dialog.accept();

        if (verifyDelete === true) {
            await driver.wait(this.elementExists(name), constants.wait5seconds);
        }
    };

    /**
     * Right-clicks on an element and selects the item on the context menu
     * @param element The element
     * @param ctxMenuItem The context menu item
     */
    public openContextMenuAndSelect = async (element: string | RegExp,
        ctxMenuItem: string | string[]): Promise<void> => {
        const contextMenuLocator = locator.section.tree.element.contextMenu;

        await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);
        const ociSection = new E2EAccordionSection(constants.ociTreeSection);
        await driver.wait(ociSection.untilIsNotLoading(), constants.wait20seconds);

        await driver.wait(async () => {
            try {
                const treeElement = await this.getElement(element);
                await driver.actions().contextClick(treeElement).perform();

                return (await driver.findElements(contextMenuLocator.exists)).length > 0;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait3seconds, `Context menu was not displayed on element ${element}`);

        const items = await driver.findElements(contextMenuLocator.item);
        const valueToCompare = Array.isArray(ctxMenuItem) ? ctxMenuItem[0] : ctxMenuItem;

        for (const item of items) {
            const itemText = await item.getText();

            if (itemText === valueToCompare) {
                await driver.actions().move({ origin: item }).perform();

                if (Array.isArray(ctxMenuItem)) {
                    const subMenu = await driver.wait(until.elementLocated(contextMenuLocator.subMenu.exists));
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

        throw new Error(`Could not find context menu item '${ctxMenuItem.toString()}' on element '${element}'`);
    };

    /**
     * Configures the Rest Service for a given database connection
     * @param dbConnection The database connection
     * @returns A promise resolving when the rest service is configured
     */
    public configureMySQLRestService = async (dbConnection: interfaces.IDBConnection): Promise<void> => {
        await this.openContextMenuAndSelect(dbConnection.caption!,
            constants.configureInstanceForMySQLRestServiceSupport);

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
     * @param treeItemName The item name on the tree
     * @param itemType The item type
     * @returns A condition resolving to true when the item is marked as default
     */
    public untilIsDefault = (treeItemName: string, itemType: string): Condition<boolean | undefined> => {
        return new Condition(`for ${treeItemName} to be marked as default`, async () => {
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait25seconds,
                `${this.accordionSection.accordionSectionName} is still loading`);

            return this.isElementDefault(treeItemName, itemType);
        });
    };

    /**
     * Verifies if the router tree element is marked as active
     * @returns A condition resolving to true when router icon is active
     */
    public untilRouterIsActive = (): Condition<boolean> => {
        return new Condition(`for router icon to be active`, async () => {
            await this.accordionSection.clickToolbarButton(constants.refreshConnection);
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);

            return this.isRouterActive();
        });
    };

    /**
     * Verifies if the router tree element is marked as inactive
     * @returns A condition resolving to true when router icon is inactive
     */
    public untilRouterIsInactive = (): Condition<boolean> => {
        return new Condition(`for router icon to be inactive`, async () => {
            await this.accordionSection.clickToolbarButton(constants.refreshConnection);
            await driver.wait(this.accordionSection.untilIsNotLoading(), constants.wait20seconds);

            return !(await this.isRouterActive());
        });
    };

    /**
     * Verifies if an element exists on the tree
     * @param element The element
     * @returns A promise resolving with true if the element exists, false otherwise
     */
    public elementExists = async (element: string | RegExp): Promise<boolean> => {
        const el = await this.getElement(element).catch((e) => {
            if (String(e).includes("Could not")) {
                return undefined;
            } else {
                throw e;
            }
        });

        return el !== undefined;
    };
}
