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
import { driver, explicitWait, Misc } from "./misc";

export class ShellSession {

    /**
     * Returns the result language of a shell session query or instruction. Ex. json
     *
     * @param resultHost context result block
     * @returns Promise resolving with the result language
     */
    public static getLangResult = async (resultHost: WebElement): Promise<string> => {
        const dataLang = await resultHost.findElement(By.css("label")).getAttribute("data-lang");

        return dataLang;
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
     * @param el editor
     * @returns Promise resolving with the the session shell language
     */
    public static getTech = async (el: WebElement): Promise<string> => {
        const divs = await driver.wait(async () => {
            return el.findElements(By.css(".margin-view-overlays div div"));
        }, explicitWait, "'.margin-view-overlays div div' did not find anything");

        const lastDiv = divs[divs.length - 1];
        const classes = (await lastDiv.getAttribute("class")).split(" ");

        return classes[2];
    };

    /**
     * Verifies if a value is present on a query result data set
     *
     * @param resultHost context
     * @param value value to search for
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static isValueOnDataSet = async (resultHost: WebElement, value: String): Promise<boolean> => {
        const cells = await driver.wait(async () => {
            const cells = await resultHost.findElements(By.css(".zoneHost .tabulator-cell"));
            if (cells.length > 0) {
                return cells;
            }
        }, explicitWait, "No cells were found");

        for (const cell of cells!) {
            const text = await cell.getText();
            if (text === value) {
                return true;
            }
        }

        return false;
    };

    /**
     * Verifies if a text is present on a json result, returned by a query
     *
     * @param resultHost context
     * @param value to search for
     * @returns A promise resolving with true if exists, false otherwise
     */
    public static isValueOnJsonResult = async (resultHost: WebElement, value: string): Promise<boolean> => {
        const spans = await resultHost.findElements(By.css("label > span > span"));
        if (spans.length > 0) {
            for (const span of spans) {
                const spanText = await span.getText();
                if (spanText.includes(value)) {
                    return true;
                }
            }
        } else {
            const otherSpans = await resultHost.findElements(By.css("code > span"));
            for (const span of otherSpans) {
                const spanText = await span.getText();
                if (spanText.includes(value)) {
                    return true;
                }
            }
        }

        return false;
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

                break;
            }
        }

        await driver.wait(async () => {
            return (await Misc.getCmdResultMsg())!.includes("Default schema `" + schema + "` accessible through db");
        }, explicitWait, `Changing schema to ${schema} did not triggered a results block`);
    };

    /**
     * Returns the shell session tab
     *
     * @param sessionNbr the session number
     * @returns Promise resolving with the the Session tab
     */
    private static getTab = async (sessionNbr: string): Promise<WebElement> => {
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

}
