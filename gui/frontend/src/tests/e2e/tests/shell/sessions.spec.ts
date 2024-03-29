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

import { By, WebElement } from "selenium-webdriver";
import { basename } from "path";

import { GuiConsole } from "../../lib/guiConsole.js";
import { IDBConnection, Misc, driver, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";

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

        await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    const url = Misc.getUrl(basename(__filename));
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.loadPage(url);
                    await Misc.waitForHomePage();
                    await driver.findElement(By.id("gui.shell")).click();

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 3, "Start Page was not loaded correctly");

            await GuiConsole.openSession();
            const editor = await driver.findElement(By.id("shellEditorHost"));
            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}`;

            await Misc.execCmd(textArea, uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await ShellSession.waitForResult(uri);
            await ShellSession.waitForResult("(X protocol)");
            await ShellSession.waitForResult(/Server version: (\d+).(\d+).(\d+)/);
            await ShellSession.waitForResult(`Default schema \`${globalConn.schema}\` accessible through db.`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            await ShellSession.waitForConnectionTabValue("server", toCheck);
            await ShellSession.waitForConnectionTabValue("schema", globalConn.schema);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Sessions");
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
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {
            await ShellSession.changeSchemaOnTab("world_x_cst");
            await ShellSession.waitForConnectionTabValue("schema", "world_x_cst");
            await Misc.execCmd(textArea, "db.countryinfo.find()");
            await driver.wait(async () => {
                return ShellSession.isJSON();
            }, explicitWait, "JSON was not found on the result");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await ShellSession.changeSchemaOnTab("sakila");
            await ShellSession.waitForConnectionTabValue("schema", "sakila");
        }
    });

    it("Verify help command", async () => {
        try {
            textArea = await driver.findElement(By.css("textarea"));
            await Misc.execCmd(textArea, "\\h");
            await ShellSession.waitForResult("Displays the main SQL help categories");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language", async () => {
        try {
            await Misc.execCmd(textArea, "\\py");
            await ShellSession.waitForResult("Switching to Python mode...");
            expect(await ShellSession.getTech()).toBe("python");
            await Misc.execCmd(textArea, "\\js");
            await ShellSession.waitForResult("Switching to JavaScript mode...");
            expect(await ShellSession.getTech()).toBe("javascript");
            await Misc.execCmd(textArea, "\\sql");
            await ShellSession.waitForResult("Switching to SQL mode...");
            expect(await ShellSession.getTech()).toBe("mysql");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {
            await driver.wait(async () => {
                await Misc.execCmd(textArea, "select * from actor limit 1;", undefined, undefined, true);

                return driver.wait(async () => {
                    return ShellSession.isValueOnDataSet("PENELOPE");
                }, 2000).catch(() => {
                    // continue
                }).then(() => { return true; });
            }, explicitWait * 2, "Query result was empty");
            await Misc.execCmd(textArea, "\\js");
            await ShellSession.changeSchemaOnTab("sakila");
            await Misc.execCmd(textArea, `shell.options.resultFormat="json/raw" `);
            await ShellSession.waitForResult("json/raw");
            await Misc.execCmd(textArea, `shell.options.showColumnTypeInfo=false `);
            await ShellSession.waitForResult("false", true);
            await Misc.execCmd(textArea, `shell.options.resultFormat="json/pretty" `);
            await ShellSession.waitForResult("json/pretty");
            await Misc.execCmd(textArea, "db.category.select().limit(1)");
            await driver.wait(async () => {
                try {
                    const result = await ShellSession.getJsonResult();

                    return (result.includes("category_id")) &&
                        (result.includes("name")) &&
                        (result.includes("last_update"));

                } catch (e) {
                    return false;
                }
            }, explicitWait, "json content was not found");
            await Misc.execCmd(textArea, `shell.options.resultFormat="table" `);
            await ShellSession.waitForResult("table");

            await driver.wait(async () => {
                await Misc.execCmd(textArea, "db.category.select().limit(1)", undefined, undefined, true);

                return driver.wait(async () => {
                    return ShellSession.isValueOnDataSet("Action");
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
            await Misc.execCmd(textArea, "db.actor.select().limit(1)");
            await ShellSession.waitForResult(/1 row in set/);
            await Misc.execCmd(textArea, "db.category.select().limit(1)");
            await ShellSession.waitForResult(/1 row in set/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {
            await Misc.execCmd(textArea, 'util.exportTable("actor", "test.txt")');
            await ShellSession.waitForResult("The dump can be loaded using");
            await ShellSession.waitForResult("Running data dump using 1 thread.");
            await ShellSession.waitForResult(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);
            await ShellSession.waitForResult(/Data size: (\d+).(\d+)(\d+) KB/);
            await ShellSession.waitForResult(/Rows written: (\d+)/);
            await ShellSession.waitForResult(/Bytes written: (\d+).(\d+)(\d+) KB/);
            await ShellSession.waitForResult(/Average throughput: (\d+).(\d+)(\d+) KB/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
