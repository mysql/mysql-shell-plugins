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

import * as fs from "fs/promises";
import { mkdir, writeFile } from "fs/promises";
import { WebDriver, error, Condition, until } from "selenium-webdriver";
import * as constants from "../lib/constants.js";
import { driver } from "../lib/driver.js";
import * as locator from "../lib/locators.js";
import { E2EToastNotification } from "./E2EToastNotification.js";
import { IOciProfileConfig } from "./interfaces.js";

export const feLog = "fe.log";
export const shellServers = new Map([
    ["ui-db.ts", 8000],
    ["ui-misc.ts", 8001],
    ["ui-notebook.ts", 8002],
    ["ui-oci.ts", 8003],
    ["ui-open-editors.ts", 8004],
    ["ui-rest.ts", 8005],
    ["ui-result-grids.ts", 8006],
    ["ui-shell.ts", 8007],
    ["ui-misc.ts", 8008],
    ["ui-clipboard.ts", 8009],
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
            url += `:${String(port)}/?token=${String(process.env.TOKEN)}`;
        } else {
            url += `:${String(process.env.HOSTNAME_PORT)}/?token=${String(process.env.TOKEN)}`;
        }

        return String(url);
    };

    /**
     * Waits until the homepage loads
     * @returns A promise resolving when the page is loaded
     */
    public static untilHomePageIsLoaded = (): Condition<boolean> => {
        return new Condition("for home page to be loaded", async () => {
            const url = await driver.getCurrentUrl();

            if (url.includes("token")) {
                return driver.wait(until.elementLocated(locator.pageIsLoaded), constants.wait3seconds)
                    .then(() => {
                        return true;
                    }).catch(async () => {
                        await driver.navigate().refresh();
                        await driver.sleep(3000);

                        return false;
                    });
            } else {
                return driver.wait(until.elementLocated(locator.loginPage.sakilaLogo), constants.wait3seconds)
                    .then(() => {
                        return true;
                    }).catch(async () => {
                        await driver.navigate().refresh();
                        await driver.sleep(3000);

                        return false;
                    });
            }
        });
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
     * @param wait True to wait for notifications to be displayed, false otherwise
     *  @returns A promise resolving with the notifications
     */
    public static getToastNotifications = async (wait = false): Promise<Array<E2EToastNotification | undefined>> => {

        const toastNotifications: Array<E2EToastNotification | undefined> = [];

        await driver.wait(async () => {
            try {
                const notifications = await driver.findElements(locator.toastNotification.exists);
                for (const notification of notifications) {
                    const id = await notification.getAttribute("id");
                    toastNotifications.push(await new E2EToastNotification().create(id));
                }

                if (wait) {
                    return toastNotifications.length > 0;
                } else {
                    return true;
                }
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    if (e instanceof error.NoSuchElementError && !(String(e.stack).includes("toast-"))) {
                        throw e;
                    }
                }
            }
        }, constants.wait2seconds, "Could not find any notifications");

        return toastNotifications;
    };

    /**
     * Closes all the existing notifications
     * @param ignoreErrors True to ignore notifications with errors, false otherwise
     */
    public static dismissNotifications = async (ignoreErrors = false): Promise<void> => {
        await driver.wait(async () => {
            const notifications = await this.getToastNotifications();

            if (ignoreErrors) {
                for (const notification of notifications) {
                    await notification!.close();
                }
            } else {
                for (const notification of notifications) {
                    if (notification!.type !== "error") {
                        await notification!.close();
                    } else {
                        throw new Error(`Notification error: ${notification!.message}`);
                    }
                }
            }

            return (await this.getToastNotifications()).length === 0;
        }, constants.wait5seconds, "Could not dismiss all notifications");
    };

    /**
     * Uploads a file
     * @param path The path to the file
     */
    public static uploadFile = async (path: string): Promise<void> => {
        await driver.wait(until
            .elementLocated(locator.fileSelect),
            constants.wait5seconds, "Could not find the input file box")
            .sendKeys(path);
    };

    /**
     * Reads the oci configuration file from process.env.MYSQLSH_OCI_CONFIG_FILE and maps it
     * into a key=value pair object
     *  @returns A promise resolving with the configuration object
     */
    public static mapOciConfig = async (): Promise<IOciProfileConfig[]> => {
        const config = await fs.readFile(String(process.env.MYSQLSH_OCI_CONFIG_FILE), "utf-8");
        const configLines = config.split("\n");
        const ociConfig: IOciProfileConfig[] = [];
        for (let line of configLines) {
            line = line.trim();
            if (line.length > 0) {
                if (line.match(/\[.*\]/) !== null) {
                    ociConfig.push({
                        name: line.match(/\[(.*)\]/)![1],
                    });
                } else {
                    let [key, val] = line.split("=");
                    key = key.trim();
                    val = val.trim();
                    if (key === "key_file") {
                        key = "keyFile";
                    }
                    ociConfig[ociConfig.length - 1][key as keyof IOciProfileConfig] = val;
                }
            }
        }

        return ociConfig;
    };

}
