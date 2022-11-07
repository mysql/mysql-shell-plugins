/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { promises as fsPromises } from "fs";
import { By, until } from "selenium-webdriver";
import { Misc, explicitWait, driver, IDBConnection } from "../../lib/misc";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks } from "../../lib/dbNotebooks";

describe("MySQL Administration", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `conn${new Date().valueOf()}`,
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
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();
        let db = await DBNotebooks.getDB("conn");

        if (!db) {
            await DBNotebooks.initConDialog();
            await DBNotebooks.createDBconnection(globalConn, true);
            db = await DBNotebooks.getDB(globalConn.caption);
        }

        try {
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(globalConn);
            await Misc.setConfirmDialog(globalConn, "yes");
        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("dialog was found") === -1) {
                    throw e;
                }
            }
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });


    afterAll(async () => {
        await driver.quit();
    });


    it("Server Status", async () => {
        try {
            await DBConnection.clickAdminItem("Server Status");
            expect(await DBConnection.getCurrentEditor()).toBe("Server Status");

            const sections = await driver?.findElements(By.css(".grid .heading label"));
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

    it("Client Connections", async ()  => {
        try {
            await DBConnection.clickAdminItem("Client Connections");

            expect(await DBConnection.getCurrentEditor()).toBe("Client Connections");

            const properties = await driver?.findElements(By.css("#connectionProps label"));
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

            await driver.wait(until.elementsLocated(By.css("#connectionList .tabulator-row")),
                explicitWait, "Connections list items were not found");

        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Performance Dashboard", async () => {
        try {
            await DBConnection.clickAdminItem("Performance Dashboard");

            expect(await DBConnection.getCurrentEditor()).toBe("Performance Dashboard");

            const grid = await driver?.findElement(By.id("dashboardGrid"));
            const gridItems = await grid?.findElements(By.css(".gridCell.title"));
            const listItems = [];

            for (const item of gridItems) {
                const label = await item.findElement(By.css("label"));
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
            await DBConnection.clickAdminItem("Server Status");
            await DBConnection.clickAdminItem("Client Connections");
            await DBConnection.clickAdminItem("Performance Dashboard");

            await DBConnection.selectEditor("Server Status");
            await driver.switchTo().defaultContent();

            await DBConnection.selectEditor("Client Connections");
            await driver.switchTo().defaultContent();

            await DBConnection.selectEditor("Performance Dashboard");
            await driver.switchTo().defaultContent();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
