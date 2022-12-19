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
import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { By, WebElement, until } from "selenium-webdriver";
import { GuiConsole } from "../../lib/guiConsole";
import { ShellSession } from "../../lib/shellSession";
import { Settings } from "../../lib/settings";

describe("Sessions", () => {

    let testFailed: boolean;

    let editor: WebElement;

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

        editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
        uri += `${String(globalConn.portX)}/${globalConn.schema}`;

        const result = await Misc.execCmd(uri);

        uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
        uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

        expect(result[0]).toContain(uri);

        const server = await driver.wait(until.elementLocated(By.id("server")), explicitWait);
        const schema = await driver.wait(until.elementLocated(By.id("schema")), explicitWait);
        await driver.wait(until.elementTextContains(server, `${globalConn.hostname}:${String(globalConn.portX)}`),
            explicitWait, `Server tab does not contain '${globalConn.hostname}:${globalConn.port}'`);
        await driver.wait(until.elementTextContains(schema, `${globalConn.schema}`),
            explicitWait, `Schema tab does not contain '${globalConn.schema}'`);
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.processFailure();
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {

            await ShellSession.changeSchemaOnTab("world_x_cst");

            const result1 = await Misc.execCmd("db.countryinfo.find()");

            expect(await ShellSession.getLangResult(result1[1] as WebElement)).toBe("json");

            await driver.wait(ShellSession.isValueOnJsonResult(result1[1] as WebElement,"Yugoslavia"),
                explicitWait, "'Yugoslavia' is not the json result");

        } catch(e) {
            testFailed = true;
            throw e;
        } finally {
            await ShellSession.changeSchemaOnTab("sakila");
        }
    });

    it("Verify help command", async () => {
        try {

            const result = await Misc.execCmd("\\help ");

            expect(result[0]).toContain(
                "The Shell Help is organized in categories and topics.",
            );

            expect(result[0]).toContain("SHELL COMMANDS");
            expect(result[0]).toContain("\\connect");
            expect(result[0]).toContain("\\disconnect");
            expect(result[0]).toContain("\\edit");
            expect(result[0]).toContain("\\exit");
            expect(result[0]).toContain("\\help");
            expect(result[0]).toContain("\\history");
            expect(result[0]).toContain("\\js");
            expect(result[0]).toContain("\\nopager");
            expect(result[0]).toContain("\\nowarnings");
            expect(result[0]).toContain("\\option");
            expect(result[0]).toContain("\\pager");
            expect(result[0]).toContain("\\py");
            expect(result[0]).toContain("\\quit");
            expect(result[0]).toContain("\\reconnect");
            expect(result[0]).toContain("\\rehash");
            expect(result[0]).toContain("\\show");
            expect(result[0]).toContain("\\source");
            expect(result[0]).toContain("\\sql");
            expect(result[0]).toContain("\\status");
            expect(result[0]).toContain("\\system");
            expect(result[0]).toContain("\\use");
            expect(result[0]).toContain("\\warning");
            expect(result[0]).toContain("\\watch");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language - javascript python", async () => {
        try {

            let result = await Misc.execCmd("\\py ");

            expect(result[0]).toBe("Switching to Python mode...");

            expect(await ShellSession.getTech(editor)).toBe("python");

            result = await Misc.execCmd("\\js ");

            expect(result[0]).toBe("Switching to JavaScript mode...");

            expect(await ShellSession.getTech(editor)).toBe("javascript");


        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {

            const result = await Misc.execCmd("db.actor.select().limit(1)");

            expect(await ShellSession.isValueOnDataSet(result[1] as WebElement, "PENELOPE")).toBe(true);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {

            await Misc.execCmd('util.exportTable("actor", "test.txt")');

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg())?.includes("Running data dump using 1 thread.");
            }, explicitWait, "'Running data dump using 1 thread.' was not found");

            const matches = [
                /Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/,
                /Data size: (\d+).(\d+)(\d+) KB/,
                /Rows written: (\d+)/,
                /Bytes written: (\d+).(\d+)(\d+) KB/,
                /Average throughput: (\d+).(\d+)(\d+) KB/,
            ];

            for (const match of matches) {
                await driver.wait(async () => {
                    return (await Misc.getCmdResultMsg())?.match(match);
                }, explicitWait, `'${String(match)}' was not matched`);
            }

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {

            await Misc.execCmd("\\sql ");

            let result = await Misc.execCmd("SHOW DATABASES;", undefined, explicitWait*4, true);

            expect(await ShellSession.isValueOnDataSet(result[1] as WebElement, "sakila")).toBe(true);

            expect(await ShellSession.isValueOnDataSet(result[1] as WebElement, "mysql")).toBe(true);

            await Misc.execCmd("\\js ");

            result = await Misc.execCmd(`shell.options.resultFormat="json/raw" `);

            expect(result[0]).toBe("json/raw");

            result = await Misc.execCmd(`shell.options.showColumnTypeInfo=false `);

            expect(result[0]).toBe("false");

            result = await Misc.execCmd(`shell.options.resultFormat="json/pretty" `);

            expect(result[0]).toBe("json/pretty");

            await ShellSession.changeSchemaOnTab("sakila");

            result = await Misc.execCmd("db.category.select().limit(1)");

            await driver.wait(ShellSession.isValueOnJsonResult(result[1] as WebElement, "Action"),
                explicitWait, "'Action is not on the json result'");

            result = await Misc.execCmd(`shell.options.resultFormat="table" `);

            expect(result[0]).toBe("table");

            result = await Misc.execCmd("db.category.select().limit(1)");

            await driver.wait(ShellSession.isValueOnDataSet(result[1] as WebElement, "Action"),
                explicitWait, "'Action is not on the json result'");

        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

});
