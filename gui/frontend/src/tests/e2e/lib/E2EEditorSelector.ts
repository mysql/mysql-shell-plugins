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

import { until, error, WebElement } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import * as interfaces from "./interfaces.js";
import { driver } from "./driver.js";

/**
 * This class represents the toolbar
 */
export class E2EEditorSelector {

    /**
     * Gets the current editor
     * @returns A promise resolving with the editor
     */
    public getCurrentEditor = async (): Promise<interfaces.ICurrentEditor> => {

        let editor: interfaces.ICurrentEditor;
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

        return editor!;
    };

    /**
     * Selects the current editor
     * @param editorName The editor name
     * @param parentConnection The name of the parent connection
     * @returns A promise resolving when the editor is selected
     */
    public selectEditor = async (editorName: RegExp, parentConnection?: string): Promise<void> => {
        await driver.wait(async () => {
            try {
                const selector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
                await driver.executeScript("arguments[0].click()", selector);

                const list = await driver.wait(until
                    .elementLocated(locator.notebook.toolbar.editorSelector.list.exists),
                    constants.wait2seconds, "The editor list was not displayed");

                await driver.wait(async () => {
                    return (await list.findElements(locator.notebook.toolbar.editorSelector.list.item)).length >= 1;
                }, constants.wait2seconds, "No elements located on editors dropdown list");

                let listItems = await driver.findElements(locator.notebook.toolbar.editorSelector.list.item);

                const isConnection = async (item: WebElement): Promise<boolean> => {
                    const icon = await item.findElements(locator.notebook.toolbar.editorSelector.currentValue.icon);

                    if (icon.length > 0) {
                        return (await icon[0].getCssValue("mask-image")).includes("connection");
                    }

                    return false;
                };

                if (parentConnection) {
                    let startIndex: number | undefined;
                    let endIndex = listItems.length - 1;

                    for (let i = 0; i <= listItems.length - 1; i++) {
                        if (await isConnection(listItems[i])) {
                            const label = await (await listItems[i].findElement(locator.htmlTag.label)).getText();
                            if (label === parentConnection) {

                                startIndex = i;
                                break;
                            }
                        }
                    }

                    if (!startIndex) {
                        throw new Error(`Could not find startIndex`);
                    }

                    for (let i = startIndex + 1; i <= listItems.length - 1; i++) {
                        if (await isConnection(listItems[i])) {
                            endIndex = i;
                            break;
                        }
                    }

                    if (!endIndex) {
                        throw new Error(`Could not find endIndex`);
                    }

                    listItems = listItems.slice(startIndex + 1, endIndex);

                    for (let i = 0; i <= listItems.length - 1; i++) {
                        const label = await (listItems[i].findElement(locator.htmlTag.label)).getText();

                        if (label.match(editorName) !== null) {
                            await listItems[i].click();

                            return true;
                        }
                    }
                } else {
                    for (const listItem of listItems) {
                        const itemText = await (await listItem.findElement(locator.htmlTag.label)).getText();

                        if (itemText.match(editorName) !== null) {
                            await listItem.click();

                            return true;
                        }
                    }
                }

                throw new Error(`Could not find editor name ${editorName}`);
            } catch (e) {
                console.log(e);
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.wait5seconds, `Could not select ${editorName} from the select list`);
    };
}
