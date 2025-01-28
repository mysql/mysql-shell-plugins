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

import { WebElement, Condition, until } from "selenium-webdriver";
import { driver } from "../../Misc";
import * as constants from "../../constants.js";
import * as locator from "../../locators.js";
import * as interfaces from "../../interfaces.js";
import { E2ECodeEditor } from "../E2ECodeEditor.js";

const resultLocator = locator.notebook.codeEditor.editor.result;

/**
 * This class represents a command result and all its related functions
 */
export abstract class E2ECommandResult {

    /** The command text*/
    #command: string;

    /** monaco-view-zone id number*/
    #id: number;

    /** Result context*/
    #resultContext: WebElement | undefined;

    /** Result tabs*/
    #tabs: interfaces.ICommandResultTab[] | undefined;

    public constructor(command: string, id: number) {
        this.#id = id;
        this.#command = command;
    }

    /**
     * Gets the command
     * @returns The command
     */
    public get command(): string {
        return this.#command;
    }

    /**
     * Gets the id
     * @returns The id
     */
    public get id(): number {
        return this.#id;
    }

    /**
     * Gets the result context
     * @returns The result context
     */
    public get resultContext(): WebElement | undefined {
        return this.#resultContext;
    }

    /**
     * Gets the tabs
     * @returns The tabs
     */
    public get tabs(): interfaces.ICommandResultTab[] | undefined {
        return this.#tabs;
    }

    /**
     * Sets the result context
     * @param context The result context
     */
    public set resultContext(context: WebElement) {
        this.#resultContext = context;
    }

    /**
     * Sets the id
     * @param newId The new id
     */
    public set id(newId: number) {
        this.#id = newId;
    }

    /**
     * Verifies if the result is maximized
     * @returns A condition resolving to true if the result is maximized, false otherwise
     */
    public untilIsMaximized = (): Condition<boolean> => {
        return new Condition(`for result to be maximized`, async () => {
            const editor = await driver.findElements(locator.notebook.codeEditor.editor.host);

            return (await driver.findElements(resultLocator.toolbar.normalize)).length > 0 && editor.length > 0;
        });
    };

    /**
     * Normalize the result grid
     * @returns A promise resolving when the result is normalized
     */
    public normalize = async (): Promise<void> => {
        await driver.findElement(resultLocator.toolbar.normalize).click();
        await driver.wait(this.untilIsNormalized(), constants.wait5seconds);
    };

    /**
     * Verifies if the result is maximized
     * @returns A condition resolving to true if the result is maximized, false otherwise
     */
    public untilIsNormalized = (): Condition<boolean> => {
        return new Condition(`for result to be normalized`, async () => {
            return (await driver.findElements(resultLocator.toolbar.maximize)).length > 0;
        });
    };

    /**
     * Sets the result grids
     * @returns A promise resolving with the graph
     */
    public setTabs = async (): Promise<void> => {
        const tabLocator = locator.notebook.codeEditor.editor.result.tabs;

        const tabContext = await driver.wait(async () => {
            const tabs = await this.resultContext.findElements(tabLocator.exists);
            if (tabs.length > 0) {
                return tabs[0];
            }
        }, constants.wait5seconds, `Could not find the tabs for cmd ${this.command}`);

        const tabsToGrab: interfaces.ICommandResultTab[] = [];
        const existingTabs = await tabContext.findElements(tabLocator.tab);
        for (const existingTab of existingTabs) {
            tabsToGrab.push({
                name: await (await existingTab.findElement(locator.htmlTag.label)).getText(),
                element: existingTab,
            });
        }

        if (tabsToGrab.length > 0) {
            this.#tabs = tabsToGrab;
        } else {
            throw new Error(`The number of tabs should be at least 1, for cmd ${this.command}`);
        }
    };

    /**
     * Right-clicks on the tab and selects an item from the context menu
     * @param tabName The tab name
     * @param menuItem The menu item
     * @returns Promise resolving when the menu item is clicked
     */
    public selectTabContextMenu = async (tabName: string, menuItem: string): Promise<void> => {
        if (this.#tabs.length > 0) {
            const tab = this.#tabs.filter((item: interfaces.ICommandResultTab) => {
                return item.name === tabName;
            });

            await driver.actions().move({ origin: tab[0].element }).contextClick().perform();
            await driver.wait(until.elementLocated(locator.notebook.codeEditor.editor.result.tabs.exists),
                constants.wait3seconds, `Could not find the context menu for tab '${tabName}'`);

            if (menuItem === constants.close) {
                await driver.findElement(locator.notebook.codeEditor.editor.result.tabs.contextMenu.close).click();
            } else if (menuItem === constants.closeAll) {
                await driver.findElement(locator.notebook.codeEditor.editor.result.tabs.contextMenu.closeAll).click();
            } else if (menuItem === constants.closeToTheRight) {
                await driver.findElement(locator.notebook.codeEditor.editor.result.tabs.contextMenu.closeRight).click();
            } else if (menuItem === constants.closeOthers) {
                await driver.findElement(locator.notebook.codeEditor.editor.result.tabs.contextMenu.closeOthers)
                    .click();
            } else {
                throw new Error(`Unknown context menu item ${menuItem}`);
            }

            this.resultContext = await new E2ECodeEditor().getResult(this.command, this.id);
            const tabLocator = locator.notebook.codeEditor.editor.result.tabs;
            const tabs = await this.resultContext.findElements(tabLocator.exists);

            if (tabs.length > 0) {
                await this.setTabs();
            } else {
                this.#tabs = undefined;
            }

        } else {
            throw new Error(`The result has no tabs`);
        }
    };

}
