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

import { promises as fsPromises } from "fs";
import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { By, WebElement } from "selenium-webdriver";
import { GuiConsole } from "../../lib/guiConsole";
import { ShellSession } from "../../lib/shellSession";
import { Settings } from "../../lib/settings";

describe("Sessions", () => {

    let testFailed: boolean;

    let textArea: WebElement;

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: `ClientQA test`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAMESHELL),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORDSHELL),
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
        await Settings.setStartLanguage("Shell Session", "javascript");
        await driver.findElement(By.id("gui.shell")).click();
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
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch(e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }

        await Misc.cleanPrompt();
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {

            await ShellSession.changeSchemaOnTab("world_x_cst");

            await ShellSession.waitForConnectionTabValue("schema", "world_x_cst");

            await Misc.execCmd(textArea, "db.countryinfo.find()");

            expect(await ShellSession.getLangResult()).toBe("json");

        } catch(e) {
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

            await ShellSession.waitForResult("The Shell Help is organized in categories and topics.");
            await ShellSession.waitForResult("SHELL COMMANDS");
            await ShellSession.waitForResult("\\connect");
            await ShellSession.waitForResult("\\disconnect");
            await ShellSession.waitForResult("\\edit");
            await ShellSession.waitForResult("\\exit");
            await ShellSession.waitForResult("\\help");
            await ShellSession.waitForResult("\\history");
            await ShellSession.waitForResult("\\js");
            await ShellSession.waitForResult("\\nopager");
            await ShellSession.waitForResult("\\nowarnings");
            await ShellSession.waitForResult("\\option");
            await ShellSession.waitForResult("\\pager");
            await ShellSession.waitForResult("\\py");
            await ShellSession.waitForResult("\\quit");
            await ShellSession.waitForResult("\\reconnect");
            await ShellSession.waitForResult("\\rehash");
            await ShellSession.waitForResult("\\show");
            await ShellSession.waitForResult("\\source");
            await ShellSession.waitForResult("\\sql");
            await ShellSession.waitForResult("\\status");
            await ShellSession.waitForResult("\\system");
            await ShellSession.waitForResult("\\use");
            await ShellSession.waitForResult("\\warning");
            await ShellSession.waitForResult("\\watch");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language - javascript python", async () => {
        try {

            await Misc.execCmd(textArea, "\\py");

            await ShellSession.waitForResult("Switching to Python mode...");

            expect(await ShellSession.getTech()).toBe("python");

            await Misc.execCmd(textArea, "\\js");

            await ShellSession.waitForResult("Switching to JavaScript mode...");

            expect(await ShellSession.getTech()).toBe("javascript");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {

            await Misc.execCmd(textArea, "db.actor.select().limit(1)");

            await driver.wait(async () => {
                return ShellSession.isValueOnDataSet("PENELOPE");
            }, explicitWait, "PENELOPE is not on the dataset");

            await Misc.execCmd(textArea, "db.category.select().limit(1)");

            await driver.wait(async () => {
                return ShellSession.isValueOnDataSet("Action");
            }, explicitWait, "Action is not on the dataset");


        } catch(e) {
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

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {

            await Misc.execCmd(textArea, "\\sql");

            await Misc.execCmd(textArea, "select * from actor limit 1;");

            await driver.wait(async () => {
                return ShellSession.isValueOnDataSet("PENELOPE");
            }, explicitWait, "sakila is not the the dataset");

            await Misc.execCmd(textArea, "\\js");

            await ShellSession.changeSchemaOnTab("sakila");

            await Misc.execCmd(textArea, `shell.options.resultFormat="json/raw" `);

            await driver.wait(async () => {
                return (await ShellSession.getResult()) === "json/raw";
            }, explicitWait, "mysql is not the the dataset");

            await Misc.execCmd(textArea, `shell.options.showColumnTypeInfo=false `);

            expect(await ShellSession.getResult()).toBe("false");

            await Misc.execCmd(textArea, `shell.options.resultFormat="json/pretty" `);

            expect(await ShellSession.getResult()).toBe("json/pretty");

            await Misc.execCmd(textArea, "db.category.select().limit(1)");

            const result = await ShellSession.getResult();

            expect(result).toContain(`"rows": [`);

            expect(result).toContain(`"name": "Action"`);

            await Misc.execCmd(textArea, `shell.options.resultFormat="table" `);

            expect(await ShellSession.getResult()).toBe("table");

            await Misc.execCmd(textArea, "db.category.select().limit(1)");

            expect(await driver.wait(async () => {
                return ShellSession.isValueOnDataSet("Action");
            }, explicitWait, "'Action is not on the data set'")).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

});
