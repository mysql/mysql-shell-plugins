/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { By, until, WebElement } from "selenium-webdriver";
import { driver } from "./misc";

export class GuiConsole {

    /**
     * Opens a new Shell session, from the GUI Console page
     * Throws an exception if the session was not opened
     *
     * @param id Id of the session. If this parameter is set, the function will open.
     * the session with the provided id
     * @returns Promise resolving when session is opened
     */
    public static openSession = async (id?: number): Promise<void> => {
        if (id) {
            const buttons = await driver.findElements(By.css("#shellModuleHost #tilesHost button"));
            for (const button of buttons) {
                if ( (await button.getAttribute("id")) === String(id) ) {
                    await button.click();
                    break;
                }
            }
        } else {
            await driver.findElement(By.css("#shellModuleHost #\\-1")).click();
        }

        await driver.wait(
            until.elementLocated(By.id("shellEditorHost")),
            15000,
            "Session was not opened",
        );
    };

    /**
     * Returns the session with the provided session number, from the GUI Console page
     *
     * @param sessionNbr the session number
     * @returns Promise resolving with the session button
     */
    public static getSession = async (sessionNbr: string): Promise<WebElement | undefined> => {
        try {
            const buttons = await driver.findElements(By.css("#shellModuleHost #tilesHost button"));
            for (const button of buttons) {
                if ((await button.getAttribute("id")) === sessionNbr) {
                    return button;
                }
            }
        } catch (e) {
            if (typeof e === "object" && String(e).includes("StaleElementReferenceError")) {
                return undefined;
            } else {
                throw e;
            }
        }
    };

}
