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

import { until, Condition, error } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { driver } from "./driver.js";
import { E2EShellSession } from "./E2EShellSession.js";

/**
 * This class represents the Shell console
 */
export class E2EGuiConsole {

    public sessions: E2EShellSession[] = [];

    /**
     * Opens a new Shell session, from the GUI Console page
     * Throws an exception if the session was not opened
     * @param id Id of the session. If this parameter is set, the function will open.
     * the session with the provided id
     * @returns Promise resolving when session is opened
     */
    public openSession = async (id?: number): Promise<void> => {
        if (id) {
            const buttons = await driver.findElements(locator.shellPage.sessions.open);
            for (const button of buttons) {
                if ((await button.getAttribute("id")) === String(id)) {
                    await button.click();
                    break;
                }
            }
        } else {
            await driver.executeScript("arguments[0].click()",
                await driver.wait(until.elementLocated(locator.shellPage.sessions.newSession),
                    constants.wait5seconds, "New session button was not found"));

            await driver.wait(
                until.elementLocated(locator.shellSession.exists),
                constants.wait10seconds,
                "Session was not opened",
            );

            const sessions = await driver.findElements(locator.shellPage.sessionTabs);
            const lastSessionId = await sessions[sessions.length - 1].getAttribute("id");
            this.sessions?.push(new E2EShellSession(lastSessionId.replace("session_", "")));
        }
    };

    /**
     * Verifies if a session exists on the Gui Console
     * @param id the session id
     * @returns Promise resolving with true if the session exists, false otherwise
     */
    public untilSessionExists = (id: string): Condition<boolean> => {
        return new Condition(`for session ${id} to exist`, async () => {
            try {
                const sessions = await driver.findElements(locator.shellPage.sessions.exists);
                for (const session of sessions) {
                    if ((await session.getAttribute("id")) === id) {
                        return true;
                    }
                }

                return false;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    return false;
                }
            }
        });
    };

    /**
     * Verifies if a session doest not exist on the Gui Console
     * @param id the session id
     * @returns Promise resolving with true if the session exists, false otherwise
     */
    public untilSessionDoesNotExist = (id: string): Condition<boolean> => {
        return new Condition(`for session ${id} to not exist`, async () => {
            try {
                const sessions = await driver.findElements(locator.shellPage.sessions.exists);
                for (const session of sessions) {
                    if ((await session.getAttribute("id")) === id) {
                        return false;
                    }
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                } else {
                    return false;
                }
            }
        });
    };

}
