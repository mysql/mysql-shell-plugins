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
import * as locator from "../../lib/locators.js";
import { basename } from "path";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";

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

    const notebook = new E2ENotebook();

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.findElement(locator.sqlEditorPage.icon).click();
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(globalConn.caption!));
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
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
            await (await notebook.explorer.getMySQLAdminElement(constants.serverStatus)).click();
            expect((await notebook.toolbar.getCurrentEditor())?.label).toBe(constants.serverStatus);

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
            await (await notebook.explorer.getMySQLAdminElement(constants.clientConnections)).click();
            expect((await notebook.toolbar.getCurrentEditor())?.label).toBe(constants.clientConnections);

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
            await (await notebook.explorer.getMySQLAdminElement(constants.performanceDashboard)).click();
            expect((await notebook.toolbar.getCurrentEditor())?.label).toBe(constants.performanceDashboard);

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
            await (await notebook.explorer.getMySQLAdminElement(constants.serverStatus)).click();
            await (await notebook.explorer.getMySQLAdminElement(constants.clientConnections)).click();
            await (await notebook.explorer.getMySQLAdminElement(constants.performanceDashboard)).click();

            await notebook.toolbar.selectEditor(new RegExp(constants.serverStatus));
            await notebook.toolbar.selectEditor(new RegExp(constants.clientConnections));
            await notebook.toolbar.selectEditor(new RegExp(constants.performanceDashboard));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
