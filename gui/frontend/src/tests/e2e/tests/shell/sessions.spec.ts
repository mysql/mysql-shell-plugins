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

import { WebElement, WebDriver } from "selenium-webdriver";
import { basename } from "path";
import { GuiConsole } from "../../lib/guiConsole.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";
import * as locator from "../../lib/locators.js";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Sessions", () => {

    let testFailed: boolean;

    let textArea: WebElement;

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser1",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser1",
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
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(locator.shellPage.icon).click();
            await GuiConsole.openSession(driver);
            const editor = await driver.findElement(locator.shellSession.exists);
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(locator.shellSession.currentLine),
            );

            textArea = await editor.findElement(locator.shellSession.textArea);

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}`;

            await Misc.execCmd(driver, textArea, uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await ShellSession.waitForResult(driver, uri);
            await ShellSession.waitForResult(driver, "(X protocol)");
            await ShellSession.waitForResult(driver, /Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(driver, `Default schema \`${globalConn.schema}\` accessible through db.`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            await ShellSession.waitForConnectionTabValue(driver, "server", toCheck);
            await ShellSession.waitForConnectionTabValue(driver, "schema", globalConn.schema);
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_Sessions");
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
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {
            await ShellSession.changeSchemaOnTab(driver, "world_x_cst");
            await ShellSession.waitForConnectionTabValue(driver, "schema", "world_x_cst");
            await Misc.execCmd(driver, textArea, "db.countryinfo.find()");
            await driver.wait(async () => {
                return ShellSession.isJSON(driver);
            }, explicitWait, "JSON was not found on the result");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await ShellSession.changeSchemaOnTab(driver, "sakila");
            await ShellSession.waitForConnectionTabValue(driver, "schema", "sakila");
        }
    });

    it("Verify help command", async () => {
        try {
            textArea = await driver.findElement(locator.shellSession.textArea);
            await Misc.execCmd(driver, textArea, "\\h");
            await ShellSession.waitForResult(driver, "Displays the main SQL help categories");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language", async () => {
        try {
            await Misc.execCmd(driver, textArea, "\\py");
            await ShellSession.waitForResult(driver, "Switching to Python mode...");
            expect(await ShellSession.getTech(driver)).toBe("python");
            await Misc.execCmd(driver, textArea, "\\js");
            await ShellSession.waitForResult(driver, "Switching to JavaScript mode...");
            expect(await ShellSession.getTech(driver)).toBe("javascript");
            await Misc.execCmd(driver, textArea, "\\sql");
            await ShellSession.waitForResult(driver, "Switching to SQL mode...");
            expect(await ShellSession.getTech(driver)).toBe("mysql");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {
            await driver.wait(async () => {
                await Misc.execCmd(driver, textArea, "select * from actor limit 1;", undefined, undefined, true);

                return driver.wait(async () => {
                    return ShellSession.isValueOnDataSet(driver, "PENELOPE");
                }, 2000).catch(() => {
                    // continue
                }).then(() => { return true; });
            }, explicitWait * 2, "Query result was empty");
            await Misc.execCmd(driver, textArea, "\\js");
            await ShellSession.changeSchemaOnTab(driver, "sakila");
            await Misc.execCmd(driver, textArea, `shell.options.resultFormat="json/raw" `);
            await ShellSession.waitForResult(driver, "json/raw");
            await Misc.execCmd(driver, textArea, `shell.options.showColumnTypeInfo=false `);
            await ShellSession.waitForResult(driver, "false", true);
            await Misc.execCmd(driver, textArea, `shell.options.resultFormat="json/pretty" `);
            await ShellSession.waitForResult(driver, "json/pretty");
            await Misc.execCmd(driver, textArea, "db.category.select().limit(1)");
            await driver.wait(async () => {
                try {
                    const result = await ShellSession.getJsonResult(driver);

                    return (result.includes("category_id")) &&
                        (result.includes("name")) &&
                        (result.includes("last_update"));

                } catch (e) {
                    return false;
                }
            }, explicitWait, "json content was not found");
            await Misc.execCmd(driver, textArea, `shell.options.resultFormat="table" `);
            await ShellSession.waitForResult(driver, "table");

            await driver.wait(async () => {
                await Misc.execCmd(driver, textArea, "db.category.select().limit(1)", undefined, undefined, true);

                return driver.wait(async () => {
                    return ShellSession.isValueOnDataSet(driver, "Action");
                }, 2000).catch(() => {
                    // continue
                }).then(() => { return true; });
            }, explicitWait * 2, "Query result was empty");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {
            await Misc.execCmd(driver, textArea, "db.actor.select().limit(1)");
            await ShellSession.waitForResult(driver, /1 row in set/);
            await Misc.execCmd(driver, textArea, "db.category.select().limit(1)");
            await ShellSession.waitForResult(driver, /1 row in set/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {
            await Misc.execCmd(driver, textArea, 'util.exportTable("actor", "test.txt")');
            await ShellSession.waitForResult(driver, "The dump can be loaded using");
            await ShellSession.waitForResult(driver, "Running data dump using 1 thread.");
            await ShellSession.waitForResult(driver, /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);
            await ShellSession.waitForResult(driver, /Data size: (\d+).(\d+)(\d+) KB/);
            await ShellSession.waitForResult(driver, /Rows written: (\d+)/);
            await ShellSession.waitForResult(driver, /Bytes written: (\d+).(\d+)(\d+) KB/);
            await ShellSession.waitForResult(driver, /Average throughput: (\d+).(\d+)(\d+) KB/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
