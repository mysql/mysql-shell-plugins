/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import { WebElement, By, until } from "vscode-extension-tester";
import { driver, explicitWait } from "../lib/common";

export class Shell {

    public static getResult = async (): Promise<string> => {
        const zoneHost = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
            explicitWait, "No zone hosts were found");
        const error = await zoneHost[zoneHost.length - 1].findElements(
            By.css(".error"),
        );

        if (error.length > 0) {
            return error[error.length - 1].getText();
        } else {
            let text = "";
            let results = await zoneHost[zoneHost.length - 1].findElements(
                By.css("code span"),
            );

            if (results.length > 0) {
                for (const result of results) {
                    text += (await result.getAttribute("innerHTML")) + "\n";
                }

                return text.trim();
            } else {
                results = await zoneHost[zoneHost.length - 1].findElements(
                    By.css("span span"),
                );
                for (const result of results) {
                    text += await result.getAttribute("innerHTML");
                }

                return text.trim();
            }
        }
    };

    public static getTech = async (el: WebElement): Promise<string> => {
        const divs = await driver.wait(async () => {
            return el.findElements(By.css(".margin-view-overlays div div"));
        }, explicitWait, "'.margin-view-overlays div div' did not find anything");

        const lastDiv = divs[divs.length - 1];
        const classes = (await lastDiv.getAttribute("class")).split(" ");

        return classes[2];
    };

    public static getTotalRows = async (): Promise<string> => {
        const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
            explicitWait, "No zone hosts were found");
        const zoneHost = zoneHosts[zoneHosts.length - 1];

        return zoneHost
            .findElement(By.css(".resultStatus.containsMessage"))
            .getText();
    };

    public static getLangResult = async (): Promise<string> => {
        const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
            explicitWait, "No zone hosts were found");
        const zoneHost = zoneHosts[zoneHosts.length - 1];

        const dataLang = await zoneHost.findElement(By.css("label")).getAttribute("data-lang");

        return dataLang;
    };

    public static isValueOnJsonResult = async (value: string): Promise<boolean> => {
        const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
            explicitWait, "No zone hosts were found");
        const zoneHost = zoneHosts[zoneHosts.length - 1];
        const spans = await zoneHost.findElements(By.css("label > span > span"));

        for (const span of spans) {
            const spanText = await span.getText();
            if (spanText.includes(value)) {
                return true;
            }
        }

        return false;
    };

    public static isValueOnDataSet = async (value: String): Promise<boolean> => {
        const zoneHosts = await driver.wait(until.elementsLocated(By.css(".zoneHost")),
            explicitWait, "No zone hosts were found");
        const cells = await driver.wait(async () => {
            const cells = await zoneHosts[zoneHosts.length - 1].findElements(By.css(".zoneHost .tabulator-cell"));
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

    public static getServerTabStatus = async (): Promise<string> => {
        const server = await driver.findElement(By.id("server"));

        return server.getAttribute("data-tooltip");
    };

    public static getSchemaTabStatus = async (): Promise<string> => {
        const schema = await driver.findElement(By.id("schema"));

        return schema.getAttribute("innerHTML");
    };

    public static changeSchemaOnTab = async (schema: string): Promise<void> => {
        const tabSchema = await driver.findElement(By.id("schema"));
        await tabSchema.click();
        const menu = await driver.wait(until.elementLocated(By.css(".shellPromptSchemaMenu")),
            3000, "Schema list was not displayed");

        const items = await menu.findElements(By.css("div.menuItem"));
        for (const item of items) {
            const label = await item.findElement(By.css("label"));
            if ((await label.getAttribute("innerHTML")).includes(schema)) {
                await label.click();
                break;
            }
        }

        await driver.wait(async () => {
            return (await driver.findElement(By.id("schema")).getText()).includes(schema);
        }, 3000, `${schema} was not selected`);
    };
}


