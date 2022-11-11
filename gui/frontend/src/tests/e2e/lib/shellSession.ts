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
import { driver, explicitWait } from "./misc";

export class ShellSession {

    /**
     * Returns the result of a shell session query or instruction
     *
     * @returns Promise resolving whith the result
     *
     */
    public static getResult = async (): Promise<string> => {
        const zoneHost = await driver.findElements(By.css(".zoneHost"));
        const error = await zoneHost[zoneHost.length - 1].findElements(
            By.css(".error"),
        );

        if (error.length > 0) {
            return error[error.length - 1].getText();
        } else {
            let text = "";
            let results = await zoneHost[zoneHost.length - 1].findElements(By.css("code span"));

            if (results.length > 0) {
                try {
                    for (const result of results) {
                        text += (await result.getAttribute("innerHTML")) + "\n";
                    }
                } catch (e) {
                    results = await zoneHost[zoneHost.length - 1].findElements(By.css("code span"));
                    for (const result of results) {
                        text += (await result.getAttribute("innerHTML")) + "\n";
                    }
                }

                return text.trim();
            } else {
                results = await zoneHost[zoneHost.length - 1].findElements(By.css("span span"));

                try {
                    for (const result of results) {
                        text += await result.getAttribute("innerHTML");
                    }
                } catch (e) {
                    results = await zoneHost[zoneHost.length - 1].findElements(By.css("span span"));
                    for (const result of results) {
                        text += await result.getAttribute("innerHTML");
                    }
                }

                return text.trim();
            }
        }
    };

    /**
     * Returns the result language of a shell session query or instruction. Ex. json
     *
     * @returns Promise resolving with the result language
     */
    public static getLangResult = async (): Promise<string> => {
        await driver.wait(until.elementLocated(By.css(".zoneHost")), 2000);
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const zoneHost = zoneHosts[zoneHosts.length - 1];

        const dataLang = await (await zoneHost.findElement(By.css("label"))).getAttribute("data-lang");

        return dataLang;
    };

    /**
     * Returns the shell session tab
     *
     * @param sessionNbr the session number
     * @returns Promise resolving with the the Session tab
     */
    public static getTab = async (sessionNbr: string): Promise<WebElement> => {
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
    public static closeSession = async (sessionNbr: string): Promise<void> => {
        const tab = await ShellSession.getTab(sessionNbr);
        await tab.findElement(By.css(".closeButton")).click();
    };

    /**
     * Returns the Shell tech/language after switching to javascript/python/mysql
     *
     * @returns Promise resolving with the the session shell language
     */
    public static getTech = async (): Promise<string> => {
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
    public static isValueOnDataSet = async (value: string): Promise<boolean> => {
        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const cells = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".zoneHost .tabulator-cell"));
        for (const cell of cells) {
            const text = await cell.getText();
            if (text === value) {
                return true;
            }
        }

        return false;
    };

    /**
     * Returns the text within the server tab on a shell session
     *
     * @returns A promise resolving with the text on the tab
     */
    public static getServerTabStatus = async (): Promise<string> => {
        const server = await driver.findElement(By.id("server"));

        return server.getAttribute("data-tooltip");
    };

    /**
     * Returns the text within the schema tab on a shell session
     *
     * @returns A promise resolving with the text on the tab
     */
    public static getSchemaTabStatus = async (): Promise<string> => {
        const schema = await driver.findElement(By.id("schema"));

        return schema.getAttribute("innerHTML");
    };

    /**
     * Verifies if a text is present on a json result, returned by a query
     *
     * @param value value to search for
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static isValueOnJsonResult = async (value: string): Promise<boolean> => {
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
     * @returns Promise resolving when the text or the regexp includes/matches the query result
     *
     */
    public static waitForResult = async (text: string | RegExp): Promise<void> => {
        await driver.wait(async () => {
            if (typeof text === "object") {
                return (await ShellSession.getResult()).match(text);
            } else {
                return (await ShellSession.getResult()).includes(String(text));
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
    public static waitForConnectionTabValue = async (tab: string, text: string): Promise<void> => {
        if (tab === "server") {
            await driver.wait(async () => {
                return (await ShellSession.getServerTabStatus()).includes(text);
            }, explicitWait, `'${text}' was not found on result`);
        } else {
            await driver.wait(async () => {
                return (await ShellSession.getSchemaTabStatus()).includes(text);
            }, explicitWait, `'${text}' was not found on result`);
        }
    };

    /**
     * Clicks on the schema tab and selects a new schema
     *
     * @param schema schema to choose
     * @returns Promise resolving when the new schema is selected
     *
     */
    public static changeSchemaOnTab = async (schema: string): Promise<void> => {
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

        await ShellSession.waitForResult("Default schema `" + schema + "` accessible through db.");
    };

}
