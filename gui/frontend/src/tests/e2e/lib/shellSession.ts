/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { By, until, WebElement, error, WebDriver } from "selenium-webdriver";
import { explicitWait } from "./misc.js";

export class ShellSession {

    /**
     * Returns the result of a shell session query or instruction
     *
     * @returns Promise resolving whith the result
     *
     */
    public static getResult = async (driver: WebDriver): Promise<string> => {
        let text = "";
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        if (zoneHosts.length > 0) {
            const actions = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".actionLabel"));
            if (actions.length > 0) {
                for (const action of actions) {
                    const spans = await action.findElements(By.css("span"));
                    for (const span of spans) {
                        text += `${await span.getText()}\r\n`;
                    }
                }
            } else {
                // Query results
                const resultStatus = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".resultStatus .info"));
                if (resultStatus.length > 0) {
                    text = await resultStatus[0].getText();
                }
            }
        } else {
            throw new Error("Could not find any zone hosts");
        }

        return text;
    };

    /**
     * Returns the result of a shell session query or instruction that should generate a json result
     *
     * @returns Promise resolving whith the result
     *
     */
    public static getJsonResult = async (driver: WebDriver): Promise<string> => {
        const results = await driver.findElements(By.css(".zoneHost .jsonView .arrElem"));

        return results[results.length - 1].getAttribute("innerHTML");
    };

    /**
     * Verifies if the last output result is JSON
     *
     * @returns Promise resolving with the result language
     */
    public static isJSON = async (driver: WebDriver): Promise<boolean> => {
        await driver.wait(until.elementLocated(By.css(".zoneHost")), explicitWait);
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const zoneHost = zoneHosts[zoneHosts.length - 1];

        const json = await zoneHost.findElements(By.css(".outputHost .jsonView"));

        return json.length > 0;
    };

    /**
     * Returns the shell session tab
     *
     * @param sessionNbr the session number
     * @returns Promise resolving with the the Session tab
     */
    public static getTab = async (driver: WebDriver, sessionNbr: string): Promise<WebElement> => {
        const tabArea = await driver.findElement(By.css(".tabArea"));
        await driver.wait(
            async () => {
                return (
                    (
                        await tabArea.findElements(
                            By.xpath("//div[contains(@id, 'session_" + sessionNbr + "')]"),
                        )
                    ).length > 0
                );
            },
            10000,
            "Session was not opened",
        );

        return tabArea.findElement(
            By.xpath("//div[contains(@id, 'session_" + sessionNbr + "')]"),
        );
    };

    /**
     * Closes a shell session
     *
     * @param sessionNbr the session number
     * @returns Promise resolving when the session is closed
     */
    public static closeSession = async (driver: WebDriver, sessionNbr: string): Promise<void> => {
        const tab = await ShellSession.getTab(driver, sessionNbr);
        await tab.findElement(By.css(".closeButton")).click();
    };

    /**
     * Returns the Shell tech/language after switching to javascript/python/mysql
     *
     * @returns Promise resolving with the the session shell language
     */
    public static getTech = async (driver: WebDriver): Promise<string> => {
        const editorsPrompt = await driver.findElements(By.css(".editorPromptFirst"));
        const lastEditorClasses = await editorsPrompt[editorsPrompt.length - 1].getAttribute("class");

        return lastEditorClasses.split(" ")[2];
    };

    /**
     * Verifies if a value is present on a query result data set
     *
     * @param value value to search for
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static isValueOnDataSet = async (driver: WebDriver, value: string): Promise<boolean | undefined> => {
        const checkValue = async (): Promise<boolean | undefined> => {
            const zoneHosts = await driver.findElements(By.css(".zoneHost"));
            const cells = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".zoneHost .tabulator-cell"));
            for (const cell of cells) {
                const text = await cell.getText();
                if (text === value) {
                    return true;
                }
            }
        };

        return driver.wait(async () => {
            try {
                return await checkValue();
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, explicitWait, "");
    };

    /**
     * Returns the text within the server tab on a shell session
     *
     * @returns A promise resolving with the text on the tab
     */
    public static getServerTabStatus = async (driver: WebDriver): Promise<string> => {
        const server = await driver.findElement(By.id("server"));

        return server.getAttribute("data-tooltip");
    };

    /**
     * Returns the text within the schema tab on a shell session
     *
     * @returns A promise resolving with the text on the tab
     */
    public static getSchemaTabStatus = async (driver: WebDriver): Promise<string> => {
        const schema = await driver.findElement(By.id("schema"));

        return schema.getAttribute("innerHTML");
    };

    /**
     * Verifies if a text is present on a json result, returned by a query
     *
     * @param value value to search for
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static isValueOnJsonResult = async (driver: WebDriver, value: string): Promise<boolean> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const zoneHost = zoneHosts[zoneHosts.length - 1];
        const spans = await zoneHost.findElements(By.css("label > span > span"));

        for (const span of spans) {
            const spanText = await span.getText();
            if (spanText.indexOf(value) !== -1) {
                return true;
            }
        }

        return false;
    };

    /**
     * Waits for the text or regexp to include/match the result of a shell session query or instruction
     *
     * @param text text of regexp to verify
     * @param isJson true if expected result should be json
     * @returns Promise resolving when the text or the regexp includes/matches the query result
     *
     */
    public static waitForResult = async (driver: WebDriver, text: string | RegExp, isJson = false): Promise<void> => {
        let result: string;
        await driver.wait(async () => {
            if (typeof text === "object") {
                return (await ShellSession.getResult(driver)).match(text);
            } else {
                if (isJson) {
                    result = await ShellSession.getJsonResult(driver);
                } else {
                    result = await ShellSession.getResult(driver);
                }

                return result.includes(text);
            }
        }, explicitWait, `'${String(text)}' was not found on result`);
    };

    /**
     * Waits for the connection tab (server/schema) includes the given text
     *
     * @param tab server or schema
     * @param text to verify
     * @returns Promise resolving when the text of the tab includes the given text
     *
     */
    public static waitForConnectionTabValue = async (driver: WebDriver, tab: string, text: string): Promise<void> => {
        if (tab === "server") {
            await driver.wait(async () => {
                return (await ShellSession.getServerTabStatus(driver)).includes(text);
            }, explicitWait, `'${text}' was not found on the server tab`);
        } else {
            await driver.wait(async () => {
                return (await ShellSession.getSchemaTabStatus(driver)).includes(text);
            }, explicitWait, `'${text}' was not found on the schema tab`);
        }
    };

    /**
     * Clicks on the schema tab and selects a new schema
     *
     * @param schema schema to choose
     * @returns Promise resolving when the new schema is selected
     *
     */
    public static changeSchemaOnTab = async (driver: WebDriver, schema: string): Promise<void> => {
        await driver.findElement(By.id("schema")).click();
        const menuItems = await driver.wait(until.elementsLocated(By.css(".shellPromptSchemaMenu .menuItem .label")),
            explicitWait, "Menu items were not found");

        for (const item of menuItems) {
            const label = await item.getText();
            if (label.includes(schema)) {
                await item.click();

                return;
            }
        }

        await ShellSession.waitForResult(driver, "Default schema `" + schema + "` accessible through db.");
    };

}
