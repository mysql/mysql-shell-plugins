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

import { until, WebElement } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import { driver } from "../lib/driver.js";
import * as constants from "../lib/constants.js";

export class ShellSession {

    /**
     * Verifies if the last output result is JSON
     * @returns Promise resolving with the result language
     */
    public static isJSON = async (): Promise<boolean> => {
        await driver.wait(until.elementLocated(locator.shellSession.result.exists), constants.wait5seconds);
        const zoneHosts = await driver.findElements(locator.shellSession.result.exists);
        const zoneHost = zoneHosts[zoneHosts.length - 1];

        const json = await zoneHost.findElements(locator.shellSession.result.json);

        return json.length > 0;
    };

    /**
     * Returns the shell session tab
     * @param sessionNbr the session number
     * @returns Promise resolving with the the Session tab
     */
    public static getTab = async (sessionNbr: string): Promise<WebElement> => {
        const tabArea = await driver.findElement(locator.shellSession.result.tabs);
        await driver.wait(
            async () => {
                return (
                    (
                        await tabArea.findElements(
                            locator.shellSession.result.searchBySessionId(sessionNbr),
                        )
                    ).length > 0
                );
            },
            10000,
            "Session was not opened",
        );

        return tabArea.findElement(
            locator.shellSession.result.searchBySessionId(sessionNbr),
        );
    };

    /**
     * Closes a shell session
     * @param sessionNbr the session number
     * @returns Promise resolving when the session is closed
     */
    public static closeSession = async (sessionNbr: string): Promise<void> => {
        const tab = await ShellSession.getTab(sessionNbr);
        await tab.findElement(locator.shellSession.close).click();
    };

}
