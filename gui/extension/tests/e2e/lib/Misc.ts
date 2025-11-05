/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import fs from "fs/promises";
import { Database } from "sqlite3";
import addContext from "mochawesome/addContext";
import { join } from "path";
import { ITimeouts, until, VSBrowser, WebDriver, WebElement } from "vscode-extension-tester";
import { existsSync, rmSync } from "fs";
import { Workbench } from "./Workbench";
import * as constants from "./constants";
import * as locator from "./locators";
import * as interfaces from "./interfaces";
import { E2ELogger } from "./E2ELogger";
import { E2ERecording } from "./E2ERecording";
import { Os } from "./Os";
export let driver: WebDriver;
export let browser: VSBrowser;
export let screenSize: string;

export class Misc {

    /**
     * Verifies if the current window handler is inside an iframe
     * 
     * @returns A promise resolving with true if the current window is inside an iframe, false otherwise
     */
    public static insideIframe = async (): Promise<boolean> => {
        return driver.executeScript("return (window.location !== window.parent.location);");
    };

    /**
     * Process the result: If a recording exists, stops it and links it to the test context, otherwise, 
     * it takes a screenshots
     * 
     * @param testContext The test context
     * @param recording The recording object
     * @param testResult The test result
     */
    public static processResult = async (
        testContext: Mocha.Context,
        recording: E2ERecording,
        testResult?: string,
    ): Promise<void> => {

        await recording.stop();

        let result: string | undefined;
        if (!testResult) {
            if (testContext.currentTest) {
                result = testContext.currentTest.state;
            } else {
                console.log(testContext);
                throw new Error(`Could not determine test result`);
            }
        } else {
            result = testResult;
        }

        const testTitle = testContext.currentTest ? testContext.currentTest.title : testContext.test!.title;

        if (!Os.isWindows()) {
            if (result === "passed") {
                rmSync(recording.videoPath!);
            } else {
                addContext(testContext, {
                    title: "TEST FAILURE VIDEO",
                    value: `../videos/${recording.videoName}`
                });
            }
        }

        if (result === "failed") {
            await Workbench.expandNotifications();
            const img = await driver.takeScreenshot();
            const ssDir = join(process.cwd(), "screenshots");
            if (!existsSync(ssDir)) {
                await fs.mkdir(ssDir);
            }

            const imgPath = join(ssDir, `${String(testTitle)}_screenshot.png`);
            await fs.writeFile(imgPath, img, "base64");
            addContext(testContext, {
                title: "TEST FAILURE SCREENSHOT",
                value: `../screenshots/${String(testTitle)}_screenshot.png`
            });
        }
    };

    /**
     * Switches the window handler to the current visible iframe
     * 
     * @returns A promise resolving when the window handler is switched to the iframe
     */
    public static switchToFrame = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                let visibleDiv: WebElement;
                await driver.wait(async () => {
                    const divs = await driver.findElements(locator.iframe.container);
                    for (const div of divs) {
                        const visibility = await div.getCssValue("visibility");
                        if (visibility.includes("visible")) {
                            visibleDiv = div;

                            return true;
                        }
                    }
                }, constants.wait1second * 5, "Could not find a visible iframe div");
                const parentIframe = await visibleDiv!.findElement(locator.iframe.exists);
                await driver.wait(Workbench.untilWebViewIsReady(parentIframe), constants.wait1second * 10);
                await driver.wait(until.ableToSwitchToFrame(parentIframe),
                    constants.wait1second * 5, "Could not enter the first iframe");
                const activeFrame = await driver.wait(until.elementLocated(locator.iframe.exists),
                    constants.wait1second * 5, "Web View content was not loaded");
                await driver.wait(until.ableToSwitchToFrame(activeFrame),
                    constants.wait1second * 5, "Could not enter the active iframe");
                const iframe = await driver.findElements(locator.iframe.exists);
                if (iframe.length > 0) {
                    await driver.wait(until.ableToSwitchToFrame(iframe[0]),
                        constants.wait150MilliSeconds);
                }

                return true;
            } catch (e: unknown) {
                if (e instanceof Error && !e.message.includes("target frame detached")) {
                    throw e;
                }
            }
        }, constants.wait1second * 10, "target frame detached");
    };

    /**
     * Switches back to the top window frame (gets out of the iframe)
     * 
     * @returns A promise resolving when the window handler is switched to the top frame
     */
    public static switchBackToTopFrame = async (): Promise<void> => {
        await driver.wait(async () => {
            try {
                await driver.switchTo().defaultContent();

                return true;
            } catch (e) {
                if (e instanceof Error && !e.message.includes("target frame detached")) {
                    throw e;
                }
            }
        }, constants.wait1second * 5, "Could not switch back to top frame");
    };

    /**
     * Verifies if the text is a json by parsing it
     * 
     * @param text The text
     * @returns A promise resolving with true if the text is json, false otherwise
     */
    public static isJson = (text: string): boolean => {
        try {
            JSON.parse(text);

            return true;
        } catch (e) {
            console.error(e);

            return false;
        }
    };

    /**
     * Loads the webdriver by creating the corresponding object
     * 
     * @returns A promise resolving when the webdriver object is loaded
     */
    public static loadDriver = async (): Promise<void> => {
        const timeout: ITimeouts = { implicit: 0 };
        let counter = 0;
        while (counter <= 10) {
            try {
                browser = VSBrowser.instance;
                await browser.waitForWorkbench();
                driver = browser.driver;
                await driver.manage().setTimeouts(timeout);
                const screenWidth = await driver.executeScript("return window.screen.width");
                const screenHeight = await driver.executeScript("return window.screen.height");
                screenSize = `${screenWidth}x${screenHeight}`;

                return;
            } catch (e) {
                if (String(e).match(/(target frame detached|DevToolsActivePort)/) === null) {
                    throw e;
                } else {
                    E2ELogger.info("Retrying the browser creation...");
                }

                counter++;
            }
        }
    };

    /**
     * Gets a value from a map
     * 
     * @param item The item
     * @param map The map
     *  @returns A promise resolving when the webdriver object is loaded
     */
    public static getValueFromMap = (item: string, map?: Map<string, number>): number | undefined => {
        if (map) {
            return map.get(item);
        } else {
            const objects = Object.entries(constants);
            for (const object of objects) {
                for (const obj of object) {
                    if (obj instanceof Map) {
                        if (obj.has(item)) {
                            return obj.get(item);
                        }
                    }
                }
            }
            throw new Error(`Could not find ${item} on any map`);
        }
    };

    /**
     * Reads the oci configuration file from process.env.MYSQLSH_OCI_CONFIG_FILE and maps it
     * into a key=value pair object
     * 
     *  @returns A promise resolving with the configuration object
     */
    public static mapOciConfig = async (): Promise<interfaces.IOciProfileConfig[]> => {
        const config = await fs.readFile(process.env.MYSQLSH_OCI_CONFIG_FILE!, "utf-8");
        const configLines = config.split("\n");
        const ociConfig: interfaces.IOciProfileConfig[] = [];
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
                    ociConfig[ociConfig.length - 1][key] = val;
                }
            }
        }

        return ociConfig;
    };

    /**
     * Transforms a given string into a string with escaped characters to be used as regex
     * 
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
     * 
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
     * 
     * @param date The date
     * @returns The converted date
     */
    public static convertDateToISO = (date: string): string => {
        const toReturn = new Date(date).toISOString();
        const splitted = toReturn.split("T");

        return `${splitted[0]} ${splitted[1].replace(":00.000Z", "")}`;
    };

    /**
     * Removes all database connections on the tree using sqlite3 directly
     */
    public static removeDatabaseConnections = (): void => {
        const sqliteFile = join(process.env.MYSQLSH_GUI_CUSTOM_CONFIG_DIR!, "plugin_data", "gui_plugin",
            "mysqlsh_gui_backend.sqlite3");

        const queries = [
            "DELETE FROM main.profile_has_db_connection",
            "DELETE FROM main.db_connection",
            "DELETE FROM main.folder_path WHERE caption <> '/'",
            "DELETE FROM main.session",
        ];

        if (existsSync(sqliteFile)) {
            const sqlite = new Database(sqliteFile);

            for (const query of queries) {
                sqlite.run(query);
            }
            sqlite.close();
        } else {
            throw new Error(`Could not find the sqlite file. Expected location: ${sqliteFile}`);
        }

    };

}
