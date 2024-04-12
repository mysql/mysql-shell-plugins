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

import { until } from "selenium-webdriver";
import { Misc } from "../../lib/misc.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import * as locator from "../../lib/locators.js";
import { basename } from "path";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as waitUntil from "../../lib/until.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("MySQL Administration", () => {

    let testFailed = false;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `connAdmin`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: String(process.env.DBUSERNAME),
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.wait(async () => {
                try {
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, constants.wait20seconds, "Home Page was not loaded");
            await driver.findElement(locator.sqlEditorPage.icon).click();
            await DBNotebooks.createDataBaseConnection(globalConn);
            await driver.executeScript("arguments[0].click();", await DBNotebooks.getConnection(globalConn.caption!));
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait10seconds);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Admin");
            throw e;
        }

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Server Status", async () => {
        try {
            await DBNotebooks.clickAdminItem("Server Status");
            expect(await DBNotebooks.getCurrentEditor()).toBe("Server Status");

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
            await DBNotebooks.clickAdminItem("Client Connections");
            expect(await DBNotebooks.getCurrentEditor()).toBe("Client Connections");
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
                constants.wait5seconds, "Connections list items were not found");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Performance Dashboard", async () => {
        try {
            await DBNotebooks.clickAdminItem("Performance Dashboard");
            expect(await DBNotebooks.getCurrentEditor()).toBe("Performance Dashboard");

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
            await DBNotebooks.clickAdminItem("Server Status");
            await DBNotebooks.clickAdminItem("Client Connections");
            await DBNotebooks.clickAdminItem("Performance Dashboard");

            await DBNotebooks.selectEditor("Server Status");
            await driver.switchTo().defaultContent();

            await DBNotebooks.selectEditor("Client Connections");
            await driver.switchTo().defaultContent();

            await DBNotebooks.selectEditor("Performance Dashboard");
            await driver.switchTo().defaultContent();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
