/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { until, WebElement, WebDriver, error } from "selenium-webdriver";
import * as locator from "../lib/locators.js";

export class GuiConsole {

    /**
     * Opens a new Shell session, from the GUI Console page
     * Throws an exception if the session was not opened
     * @param driver The webdriver
     * @param id Id of the session. If this parameter is set, the function will open.
     * the session with the provided id
     * @returns Promise resolving when session is opened
     */
    public static openSession = async (driver: WebDriver, id?: number): Promise<void> => {
        if (id) {
            const buttons = await driver.findElements(locator.shellPage.sessions.open);
            for (const button of buttons) {
                if ((await button.getAttribute("id")) === String(id)) {
                    await button.click();
                    break;
                }
            }
        } else {
            await driver.findElement(locator.shellPage.sessions.newSession).click();
        }

        await driver.wait(
            until.elementLocated(locator.shellSession.exists),
            15000,
            "Session was not opened",
        );
    };

    /**
     * Returns the session with the provided session number, from the GUI Console page
     * @param driver The webdriver
     * @param sessionNbr the session number
     * @returns Promise resolving with the session button
     */
    public static getSession = async (driver: WebDriver, sessionNbr: string): Promise<WebElement | undefined> => {
        try {
            const buttons = await driver.findElements(locator.shellPage.sessions.tile);
            for (const button of buttons) {
                if ((await button.getAttribute("id")) === sessionNbr) {
                    return button;
                }
            }
        } catch (e) {
            if (!(e instanceof error.StaleElementReferenceError)) {
                throw e;
            }
        }
    };

}
