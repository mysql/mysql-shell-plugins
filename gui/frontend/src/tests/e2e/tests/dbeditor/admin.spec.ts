/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { WebDriver, until } from "selenium-webdriver";
import { Misc, explicitWait, IDBConnection } from "../../lib/misc.js";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import * as locator from "../../lib/locators.js";
import { basename } from "path";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("MySQL Administration", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `connAdmin`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        driver = await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");
            await driver.findElement(locator.sqlEditorPage.icon).click();
            const db = await DBNotebooks.createDBconnection(driver, globalConn);
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(driver, globalConn);
            await Misc.setConfirmDialog(driver, globalConn, "no");
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_Admin");
            throw e;
        }

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot(driver);
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Server Status", async () => {
        try {
            await DBConnection.clickAdminItem(driver, "Server Status");
            expect(await DBConnection.getCurrentEditor(driver)).toBe("Server Status");

            const sections = await driver?.findElements(locator.serverStatusHeadings);
            const headings = [];
            for (const section of sections) {
                headings.push(await section.getText());
            }
            expect(headings).toContain("Main Settings");
            expect(headings).toContain("Server Directories");
            expect(headings).toContain("Server Features");
            expect(headings).toContain("Server SSL");
            expect(headings).toContain("Server Authentication");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Client Connections", async () => {
        try {
            await DBConnection.clickAdminItem(driver, "Client Connections");
            expect(await DBConnection.getCurrentEditor(driver)).toBe("Client Connections");
            const properties = await driver?.findElements(locator.clientConnections.properties);
            const props = [];
            for (const item of properties) {
                props.push(await item.getAttribute("innerHTML"));
            }

            const test = props.join(",");
            expect(test).toContain("Threads Connected");
            expect(test).toContain("Threads Running");
            expect(test).toContain("Threads Created");
            expect(test).toContain("Threads Cached");
            expect(test).toContain("Rejected (over limit)");
            expect(test).toContain("Total Connections");
            expect(test).toContain("Connection Limit");
            expect(test).toContain("Aborted Clients");
            expect(test).toContain("Aborted Connections");
            expect(test).toContain("Errors");
            await driver.wait(until.elementsLocated(locator.clientConnections.connectionListRows),
                explicitWait, "Connections list items were not found");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Performance Dashboard", async () => {
        try {
            await DBConnection.clickAdminItem(driver, "Performance Dashboard");

            expect(await DBConnection.getCurrentEditor(driver)).toBe("Performance Dashboard");

            const grid = await driver?.findElement(locator.performanceDashboardGrid.exists);
            const gridItems = await grid?.findElements(locator.performanceDashboardGrid.headings);
            const listItems = [];

            for (const item of gridItems) {
                const label = await item.findElement(locator.htmlTag.label);
                listItems.push(await label.getAttribute("innerHTML"));
            }

            expect(listItems).toContain("Network Status");
            expect(listItems).toContain("MySQL Status");
            expect(listItems).toContain("InnoDB Status");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between MySQL Administration tabs", async () => {
        try {
            await DBConnection.clickAdminItem(driver, "Server Status");
            await DBConnection.clickAdminItem(driver, "Client Connections");
            await DBConnection.clickAdminItem(driver, "Performance Dashboard");

            await DBConnection.selectEditor(driver, "Server Status");
            await driver.switchTo().defaultContent();

            await DBConnection.selectEditor(driver, "Client Connections");
            await driver.switchTo().defaultContent();

            await DBConnection.selectEditor(driver, "Performance Dashboard");
            await driver.switchTo().defaultContent();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
