/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until, WebElement, error } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import * as interfaces from "./interfaces.js";
import { driver } from "./driver.js";

/**
 * This class represents the toolbar
 */
export class Toolbar {

    /**
     * Verifies if a toolbar button exists
     * @param button The button
     * @returns A promise resolving with true if the button exists, false otherwise
     */
    public existsButton = async (button: string): Promise<boolean> => {
        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return true;
            }
        }

        return false;
    };

    /**
     * Gets a toolbar button
     * @param button The button name
     * @returns A promise resolving with the button
     */
    public getButton = async (button: string): Promise<WebElement | undefined> => {
        const toolbar = await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
            constants.wait5seconds, "Toolbar was not found");
        const buttons = await toolbar.findElements(locator.notebook.toolbar.button.exists);
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    /**
     * Gets the current editor
     * @returns A promise resolving with the editor
     */
    public getCurrentEditor = async (): Promise<interfaces.ICurrentEditor | undefined> => {
        let editor: interfaces.ICurrentEditor | undefined;
        await driver.wait(async () => {
            try {
                const selector = await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
                    constants.wait5seconds, "Unable to get the current editor: not found");
                const label = await selector.findElement(locator.notebook.toolbar.editorSelector.currentValue.label);
                const image = await selector.findElements(locator.notebook.toolbar.editorSelector.currentValue.image);
                const icon = await selector.findElements(locator.notebook.toolbar.editorSelector.currentValue.icon);
                let content: string;
                if (image.length > 0) {
                    content = await image[0].getAttribute("src");
                } else if (icon.length > 0) {
                    content = await icon[0].getCssValue("mask-image");
                }

                editor = {
                    label: await label.getText(),
                    icon: content!.match(/assets\/(.*)-/)![1],
                };

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, "Could not get the current editor values");

        return editor;
    };

    /**
     * Selects the current editor
     * @param editorName The editor name
     * @param parentConnection The name of the parent connection
     * @returns A promise resolving when the editor is selected
     */
    public selectEditor = async (editorName: RegExp, parentConnection?: string): Promise<void> => {
        const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
        await driver.executeScript("arguments[0].click()", selector);

        const list = await driver.wait(until
            .elementLocated(locator.notebook.toolbar.editorSelector.list.exists),
            constants.wait2seconds, "The editor list was not displayed");

        await driver.wait(async () => {
            return (await list.findElements(locator.notebook.toolbar.editorSelector.list.item)).length >= 1;
        }, constants.wait2seconds, "No elements located on editors dropdown list");

        await driver.wait(async () => {
            try {
                let listItems = await driver.findElements(locator.notebook.toolbar.editorSelector.list.item);

                if (parentConnection) {
                    let startIndex = -1;
                    let endIndex = -1;

                    for (let i = 0; i <= listItems.length - 1; i++) {
                        const isConnection = await listItems[i].getAttribute("id") !== "connections" &&
                            await listItems[i].getAttribute("type") === null;

                        if (isConnection) {
                            const label = await (await listItems[i].findElement(locator.htmlTag.label)).getText();
                            if (label === parentConnection) {

                                startIndex = i;
                                break;
                            }
                        }
                    }

                    for (let i = startIndex + 1; i <= listItems.length - 1; i++) {
                        const isConnection = await listItems[i].getAttribute("id") !== "connections" &&
                            await listItems[i].getAttribute("type") === null;

                        if (isConnection) {
                            endIndex = i;
                            break;
                        }
                    }

                    listItems = listItems.slice(startIndex + 1, endIndex);

                    for (let i = 0; i <= listItems.length - 1; i++) {
                        const label = await (listItems[i].findElement(locator.htmlTag.label)).getText();
                        if (label.match(editorName) !== null) {
                            await listItems[i].click();
                            break;
                        }
                    }
                } else {
                    for (const item of listItems) {
                        const itemText = await (await item.findElement(locator.htmlTag.label)).getText();

                        if (itemText.match(editorName) !== null) {
                            await item.click();
                        }
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not select the editor ${editorName}`);
    };

    /**
     * Closes the current editor
     */
    public closeCurrentEditor = async (): Promise<void> => {
        try {
            await driver.findElement(locator.notebook.toolbar.closeEditor).click();
        } catch (e) {
            if (e instanceof error.ElementNotInteractableError) {
                const closeEditor = await driver.wait(until
                    .elementLocated(locator.notebook.toolbar.closeEditor), constants.wait5seconds);
                await driver.wait(until.elementIsVisible(closeEditor), constants.wait5seconds);
                await closeEditor.click();
            } else {
                throw e;
            }
        }
    };
}
