/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import { Condition, CustomTreeSection, error, SideBarView, until, WebElement } from "vscode-extension-tester";
import * as constants from "../constants";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";
import * as waitUntil from "../until";
import * as locator from "../locators";
import * as interfaces from "../interfaces";
import { DatabaseConnection } from "../webviews/dbConnection";
import { Misc, driver } from "../misc";
import { Os } from "../os";
import { Workbench } from "..//workbench";

export class Section {

    /**
     * Gets a section
     * @param name The name of the section
     * @returns A promise resolving with the section
     */
    public static getSection = async (name: string): Promise<CustomTreeSection> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        return new SideBarView().getContent().getSection(name);
    };

    /**
     * Clicks a section toolbar button
     * @param section The section
     * @param button The button
     * @returns A promise resolving when the button is clicked
     */
    public static clickToolbarButton = async (section: CustomTreeSection, button: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        let sectionActions: WebElement;
        await driver.wait(async () => {
            try {
                await driver.wait(async () => {
                    await driver.actions().move({ origin: section }).perform();
                    sectionActions = await driver
                        .findElement(locator.section.actions(await section.getTitle()));

                    return sectionActions.isDisplayed();
                }, constants.wait5seconds, `Toolbar buttons for ${await section.getTitle()} were not displayed`);

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
        }, constants.wait5seconds, `${button} on section '${await section.getTitle()}' was not interactable`);

    };

    /**
     * Selects an item from the "More Actions" context menu
     * @param section The section
     * @param item The item
     * @returns A promise resolving when the button is clicked
     */
    public static selectMoreActionsItem = async (
        section: CustomTreeSection,
        item: string,
    ): Promise<void> => {

        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const button = await section?.getAction("More Actions...");

        await driver.wait(async () => {
            await section.click();

            return button?.isDisplayed();
        }, constants.wait5seconds, `'More Actions...' button was not visible`);

        if (Os.isMacOs()) {
            const moreActions = await section.findElement(locator.section.moreActions);
            await moreActions.click();
            await driver.sleep(500);
            const taps = Misc.getValueFromMap(item);
            for (let i = 0; i <= taps - 1; i++) {
                await keyboard.type(nutKey.Down);
            }
            await keyboard.type(nutKey.Enter);
        } else {
            const moreActions = await section?.moreActions();
            const moreActionsItem = await moreActions?.getItem(item);
            await moreActionsItem?.select();
        }
    };

    /**
     * Creates a database connection from the DATABASE CONNECTIONS toolbar
     * @param dbConfig The database configuration data
     * @returns A promise resolving when the connection is created
     */
    public static createDatabaseConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        await Section.clickToolbarButton(await Section.getSection(constants.dbTreeSection),
            constants.createDBConnection);
        await driver.wait(waitUntil.tabIsOpened(constants.dbDefaultEditor), constants.wait5seconds);
        await Misc.switchToFrame();
        await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists), constants.wait10seconds);

        await DatabaseConnection.setConnection(
            dbConfig.dbType,
            dbConfig.caption,
            dbConfig.description,
            dbConfig.basic,
            dbConfig.ssl,
            undefined,
            dbConfig.mds,
        );

    };

    /**
     * Focus a section, by expanding the section and collapsing all the otehrs
     * @param section The section
     * @returns A promise resolving when the section is focused
     */
    public static focus = async (section: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const treeDBSection = await Section.getSection(constants.dbTreeSection);
        const treeOCISection = await Section.getSection(constants.ociTreeSection);
        const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
        const treeTasksSection = await Section.getSection(constants.tasksTreeSection);
        await driver.actions().move({ origin: treeTasksSection }).perform();

        if ((await treeDBSection.getTitle()) === section) {
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
            }), constants.wait5seconds, `${section} was not focused`);
        } else if ((await treeOCISection.getTitle()) === section) {
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
            }), constants.wait5seconds, `${section} was not focused`);
        } else if ((await treeOpenEditorsSection.getTitle()) === section) {
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
            }), constants.wait5seconds, `${section} was not focused`);
        } else if ((await treeTasksSection.getTitle()) === section) {
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

            }), constants.wait5seconds, `${section} was not focused`);
        } else {
            throw new Error(`Unknow section: ${section}`);
        }
    };

    /**
     * Expand a section
     * @param section The section
     * @returns A promise resolving when the section is expanded
     */
    public static expand = async (section: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }

        const sec = await Section.getSection(section);
        if (!(await sec.isExpanded())) {
            await driver.wait(async () => {
                await sec.expand();

                return sec.isExpanded();
            }, constants.wait5seconds, `Could not expand '${section}' section`);
        }
    };

    /**
     * Collapse a section
     * @param section The section
     * @returns A promise resolving when the section is collapsed
     */
    public static collapse = async (section: string): Promise<void> => {
        if ((await Misc.insideIframe())) {
            await Misc.switchBackToTopFrame();
        }
        const sec = await Section.getSection(section);
        if (await sec.isExpanded()) {
            await driver.wait(async () => {
                await sec.collapse();

                return (await sec.isExpanded()) === false;
            }, constants.wait5seconds, `Could not expand '${section}' section`);
        }
    };

    /**
     * Restarts MySQL Shell from the toolbar context mnenu
     * @returns A promise resolving when MySQL Shell is restarted
     */
    public static restartShell = async (): Promise<void> => {
        const existsRootHost = async (): Promise<boolean> => {
            return (await driver.findElements(locator.contextMenu.exists)).length > 0;
        };

        const treeDBSection = await Section.getSection(constants.dbTreeSection);
        await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait5seconds);
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
                            if (e instanceof error.StaleElementReferenceError) {
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

}
