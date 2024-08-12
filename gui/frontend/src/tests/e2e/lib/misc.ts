/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { mkdir, writeFile } from "fs/promises";
import { until, WebDriver, error, Condition, WebElement } from "selenium-webdriver";
import * as constants from "../lib/constants.js";
import { driver } from "../lib/driver.js";
import * as locator from "../lib/locators.js";
import { E2EToastNotification } from "./E2EToastNotification.js";

export const feLog = "fe.log";
export const shellServers = new Map([
    ["admin.spec.ts", 0],
    ["db_connection_overview.spec.ts", 1],
    ["notebook.spec.ts", 1],
    ["scripts.spec.ts", 1],
    ["main.spec.ts", 0],
    ["guiconsole.spec.ts", 0],
    ["sessions.spec.ts", 2],
    ["shell_connections.spec.ts", 2],
    ["notifications.spec.ts", 2],
]);

export class Misc {

    /**
     * Waits until a page loads
     *
     * @param filename filename of the test suite
     * @returns A promise resolving when the url is set
     */
    public static getUrl = (filename: string): string => {
        let url = process.env.SHELL_UI_HOSTNAME;

        if (process.env.MAX_WORKERS) {
            const port = shellServers.get(filename);
            url += `:800${String(port)}/?token=${String(process.env.TOKEN)}`;
        } else {
            url += `:${String(process.env.HOSTNAME_PORT)}/?token=${String(process.env.TOKEN)}`;
        }

        return String(url);
    };

    /**
     * Waits until the homepage loads
     * @param url URL of the page
     * @param loginPage True if the home page is expected to be the login page, false otherwise
     * @returns A promise resolving when the page is loaded
     */
    public static waitForHomePage = async (url: string, loginPage = false): Promise<void> => {
        await driver.get(url);

        if (loginPage) {
            await driver.wait(until.elementLocated(locator.loginPage.sakilaLogo), 10000, "Sakila logo was not found");
        } else {
            await driver.wait(until.elementLocated(locator.mainActivityBar), 10000, "Activity bar was not found");
        }
    };

    /**
     * Returns the background color of the page
     * @param driver The webdriver
     * @returns Promise resolving to the background color
     */
    public static getBackgroundColor = async (driver: WebDriver): Promise<string> => {
        const script =
            "return window.getComputedStyle(document.getElementById('root')).getPropertyValue('--background'); ";

        return driver.executeScript(script);
    };

    /**
     * Retrieves the name of the current test and returns it with some transformations applied.
     *
     * @returns The adjusted test name.
     */
    public static currentTestName(): string | undefined {
        return expect.getState().currentTestName?.toLowerCase().replace(/\s/g, "_");
    }

    /**
     * Takes a screen shot of the current browser window and stores it on disk.
     * @param name test name
     * @returns file path
     */
    public static async storeScreenShot(name?: string): Promise<string> {
        const img = await driver.takeScreenshot();
        let testName = "";

        if (!name) {
            testName = Misc.currentTestName() ?? "<unknown test>";
        } else {
            testName = name;
        }

        await mkdir("src/tests/e2e/screenshots", { recursive: true });
        await writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");

        return `screenshots/${testName}_screenshot.png`;
    }

    /**
     * Transforms a given string into a string with escaped characters to be used as regex
     * @param value The word
     *  @returns A regex with escaped characters
     */
    public static transformToMatch = (value: string): RegExp => {
        const regex = value
            .replace(/\*/g, "\\*")
            .replace(/\./g, ".*")
            .replace(/;/g, ".*")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}")
            .replace(/\s/g, ".*");

        return new RegExp(regex);
    };

    /**
     * Converts a time to a 12h time string (AM/PM)
     * @param time The time
     * @returns The converted time
     */
    public static convertTimeTo12H = (time: string): string => {
        const timeString12hr = new Date("1970-01-01T" + time + "Z")
            .toLocaleTimeString("en-US",
                { timeZone: "UTC", hour12: true, hour: "numeric", minute: "numeric", second: "numeric" },
            );

        return timeString12hr;
    };

    /**
     * Converts a date to ISO format
     * @param date The date
     * @returns The converted date
     */
    public static convertDateToISO = (date: string): string => {
        const toReturn = new Date(date).toISOString();
        const splitted = toReturn.split("T");

        return `${splitted[0]} ${splitted[1].replace(":00.000Z", "")}`;
    };

    /**
     * Gets the toast notification displayed on the page
     *  @returns A promise resolving with the notifications
     */
    public static getToastNotifications = async (): Promise<E2EToastNotification[]> => {

        const toastNotifications: E2EToastNotification[] = [];

        await driver.wait(async () => {
            try {
                const notifications = await driver.findElements(locator.toastNotification.exists);
                for (const notification of notifications) {
                    const id = await notification.getAttribute("id");
                    toastNotifications.push(await new E2EToastNotification().create(id));
                }

                return true;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    if (e instanceof error.NoSuchElementError && !(String(e.stack).includes("toast-"))) {
                        throw e;
                    }
                }
            }
        }, constants.wait10seconds, "Never going to hit here");

        return toastNotifications;
    };

    /**
     * Verifies if the confirmation dialog exists
     * @param context The context
     * @returns A condition resolving to true when the confirmation dialog exists
     */
    public static untilConfirmationDialogExists = (context?: string): Condition<WebElement | undefined> => {
        let msg = "for confirmation dialog to be displayed";
        if (context) {
            msg += ` ${context}`;
        }

        return new Condition(msg, async () => {
            const confirmDialog = await driver.findElements(locator.confirmDialog.exists);
            if (confirmDialog) {
                return confirmDialog[0];
            }
        });
    };

    /**
     * Waits until the confirmation dialog exists
     * @param context The context
     * @returns A promise resolving when the confirmation dialog exists
     */
    public untilConfirmationDialogExists = (context?: string): Condition<WebElement | undefined> => {
        let msg = "for confirmation dialog to be displayed";
        if (context) {
            msg += ` ${context}`;
        }

        return new Condition(msg, async () => {
            const confirmDialog = await driver.findElements(locator.confirmDialog.exists);

            if (confirmDialog) {
                return confirmDialog[0];
            }
        });
    };
}
