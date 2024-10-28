/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
import { E2ETree } from "./E2ETree";

/**
 * This class represents the Accordion section element and its related functions
 */
export class E2EAccordionSection {

    /** The tree that belongs to the section */
    public tree: E2ETree;

    /** Accordion section name */
    public accordionSectionName: string;

    public constructor(sectionName: string) {
        this.accordionSectionName = sectionName;
        this.tree = new E2ETree(this);
    }

    /**
     * Gets the section web element
     * @returns A promise resolving with the element
     */
    public getWebElement = async (): Promise<CustomTreeSection> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return new SideBarView().getContent().getSection(this.accordionSectionName);
    };

    /**
     * Verifies if a section exists
     * @returns A condition resolving to true if exists, false otherwise
     */
    public untilExists = (): Condition<boolean> => {
        return new Condition(`for ${this.accordionSectionName} to exist`, async () => {
            return (await this.getWebElement()) !== undefined;
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

        await driver.wait(this.untilIsNotLoading(), constants.wait20seconds,
            `${constants.ociTreeSection} is still loading`);

        let sectionActions: WebElement;
        const thisSection = await this.getWebElement();
        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    await driver.actions().move({ origin: thisSection }).perform();
                    sectionActions = await driver
                        .findElement(locator.section.actions(this.accordionSectionName));

                    return sectionActions.isDisplayed();
                }, constants.wait5seconds, `Toolbar buttons for ${this.accordionSectionName} were not displayed`);

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
        }, constants.wait5seconds, `${button} on section '${this.accordionSectionName}' was not interactable`);

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

        const thisSection = await this.getWebElement();

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

        const treeDBSection = await new SideBarView().getContent().getSection(constants.dbTreeSection);
        const treeOCISection = await new SideBarView().getContent().getSection(constants.ociTreeSection);
        const treeOpenEditorsSection = await new SideBarView().getContent()
            .getSection(constants.openEditorsTreeSection);
        const treeTasksSection = await new SideBarView().getContent().getSection(constants.tasksTreeSection);
        await driver.actions().move({ origin: treeTasksSection }).perform();

        if ((await treeDBSection.getTitle()) === this.accordionSectionName) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeDBSection.expand();
                    await treeOCISection.collapse();
                    await treeOpenEditorsSection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.wait5seconds, `${this.accordionSectionName} was not focused`);
        } else if ((await treeOCISection.getTitle()) === this.accordionSectionName) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeOCISection.expand();
                    await treeDBSection.collapse();
                    await treeOpenEditorsSection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeOCISection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    console.log("error");
                    console.log(e);
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.wait5seconds, `${this.accordionSectionName} was not focused`);
        } else if ((await treeOpenEditorsSection.getTitle()) === this.accordionSectionName) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeOpenEditorsSection.expand();
                    await treeDBSection.collapse();
                    await treeOCISection.collapse();
                    await treeTasksSection.collapse();

                    return (await treeOpenEditorsSection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeTasksSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }
            }), constants.wait5seconds, `${this.accordionSectionName} was not focused`);
        } else if ((await treeTasksSection.getTitle()) === this.accordionSectionName) {
            await driver.wait(new Condition("", async () => {
                try {
                    await treeTasksSection.expand();
                    await treeDBSection.collapse();
                    await treeOCISection.collapse();
                    await treeOpenEditorsSection.collapse();

                    return (await treeTasksSection.isExpanded()) &&
                        !(await treeDBSection.isExpanded()) &&
                        !(await treeOCISection.isExpanded()) &&
                        !(await treeOpenEditorsSection.isExpanded());
                } catch (e) {
                    if (!(e instanceof error.TimeoutError || e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

            }), constants.wait5seconds, `${this.accordionSectionName} was not focused`);
        } else {
            throw new Error(`Unknown section: ${this.accordionSectionName}`);
        }
    };

    /**
     * Expands the section
     * @returns A promise resolving when the section is expanded
     */
    public expand = async (): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const thisSection = await this.getWebElement();
        if (!(await thisSection.isExpanded())) {
            await driver.wait(async () => {
                await thisSection.expand();

                return thisSection.isExpanded();
            }, constants.wait5seconds, `Could not expand '${this.accordionSectionName}' tree explorer`);
        }
    };

    /**
     * Collapse the section
     * @returns A promise resolving when the section is collapsed
     */
    public collapse = async (): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const thisSection = await this.getWebElement();
        if (await thisSection.isExpanded()) {
            await driver.wait(async () => {
                await thisSection.collapse();

                return (await thisSection.isExpanded()) === false;
            }, constants.wait5seconds, `Could not expand '${this.accordionSectionName}' section`);
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

        const treeDBSection = await new SideBarView().getContent().getSection(this.accordionSectionName);
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
     * Gets the database connections from the DATABASE CONNECTIONS section
     * @returns A promise resolving with the database connections
     */
    public getDatabaseConnections = async (): Promise<interfaces.ITreeDBConnection[]> => {
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
        return new Condition(`for ${this.accordionSectionName} to be loaded`, async () => {
            const sec = await this.getWebElement();
            const loading = await sec.findElements(locator.section.loadingBar);
            const activityBar = new ActivityBar();
            const icon = await activityBar.getViewControl(constants.extensionName);
            const progressBadge = await icon.findElements(locator.shellForVscode.loadingIcon);

            return (loading.length === 0) && (progressBadge.length === 0);
        });
    };

}
