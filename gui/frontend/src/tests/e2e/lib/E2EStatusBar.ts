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

import { WebElement, until } from "selenium-webdriver";
import { driver } from "./driver.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";

/** This class represents the Status bar and all its related functions */
export class E2EStatusBar {

    /**
     * Gets the editor position on a notebook or script
     * @returns A promise resolving with the editor position on a notebook or script as a string
     */
    public getEditorPosition = async (): Promise<string> => {
        return (await driver.wait(until.elementLocated(locator.statusBar.editorPosition), constants.wait3seconds,
            "Could not find the editor position")).getText();
    };

    /**
     * Gets the editor ident on a notebook or script
     * @returns A promise resolving with the editor ident on a notebook or script as a string
     */
    public getEditorIdent = async (): Promise<string> => {
        return (await driver.wait(until.elementLocated(locator.statusBar.editorIndent), constants.wait3seconds,
            "Could not find the editor ident")).getText();
    };

    /**
     * Gets the editor EOL on a notebook or script
     * @returns A promise resolving with the editor EOL on a notebook or script as a string
     */
    public getEditorEOL = async (): Promise<string> => {
        return (await driver.wait(until.elementLocated(locator.statusBar.editorEOL), constants.wait3seconds,
            "Could not find the editor eol")).getText();
    };

    /**
     * Gets the editor language on a notebook or script
     * @returns A promise resolving with the editor language on a notebook or script as a string
     */
    public getEditorLanguage = async (): Promise<string> => {
        return (await driver.wait(until.elementLocated(locator.statusBar.editorLanguage), constants.wait3seconds,
            "Could not find the editor language")).getText();
    };

    /**
     * Gets the notifications history element
     * @returns {WebElement} A promise resolving with the notifications history element
     */
    public getNotificationsHistory = async (): Promise<WebElement> => {
        return driver.wait(until.elementLocated(locator.statusBar.bell.exists), constants.wait3seconds,
            "Could not find the notifications history icon");
    };

    /**
     * Verifies if there are notifications on the bell icon
     * @returns {Promise<boolean>} A promise resolving with true if there are new notifications, false otherwise
     */
    public hasNotifications = async (): Promise<boolean> => {
        const bell = await driver.findElements(locator.statusBar.bell.bellIcon);
        const bellDot = await driver.findElements(locator.statusBar.bell.bellIconWithDot);

        if (bell.length > 0) {
            return false;
        } else if (bellDot.length > 0) {
            return true;
        } else {
            return false;
        }
    };

    /**
     * Verifies if the silent mode is on
     * @returns {Promise<boolean>} A promise resolving with true if the silent mode is on, false otherwise
     */
    public isOnSilentMode = async (): Promise<boolean> => {
        return (await driver.findElements(locator.statusBar.bell.silentMode)).length > 0;
    };

}
