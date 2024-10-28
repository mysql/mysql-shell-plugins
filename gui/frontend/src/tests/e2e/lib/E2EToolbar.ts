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
import { driver } from "./driver.js";
import { E2EEditorSelector } from "./E2EEditorSelector.js";

/**
 * This class represents the toolbar
 */
export class E2EToolbar {

    /** The editor selector*/
    public editorSelector = new E2EEditorSelector();

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
