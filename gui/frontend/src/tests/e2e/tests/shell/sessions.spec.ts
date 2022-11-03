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
import { driver, loadDriver, loadPage } from "../../lib/engine";
import { By, WebElement } from "selenium-webdriver";
import {
    waitForHomePage,
    setStartLanguage,
    openShellSession,
    enterCmd,
    shellGetTech,
    shellGetTotalRows,
    shellGetLangResult,
    cleanEditor,
    isValueOnDataSet,
    isValueOnJsonResult,
    IDBConnection,
    waitForShellResult,
    waitForConnectionTabValue,
    explicitWait,
    changeSchemaOnTab,
} from "../../lib/helpers";

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
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }
        await setStartLanguage("Shell Session", "javascript");
        await driver.findElement(By.id("gui.shell")).click();
        await openShellSession();

        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        textArea = await editor.findElement(By.css("textArea"));

        let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
        uri += `${String(globalConn.portX)}/${globalConn.schema}`;

        await enterCmd(textArea, uri);

        uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
        uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

        await waitForShellResult(uri);
        await waitForShellResult("(X protocol)");
        await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
        await waitForShellResult(`Default schema \`${globalConn.schema}\` accessible through db.`);

        let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
        toCheck += `, using the X protocol`;

        await waitForConnectionTabValue("server", toCheck);
        await waitForConnectionTabValue("schema", globalConn.schema);
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

        await cleanEditor();
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Verify collections - json format", async () => {
        try {

            await changeSchemaOnTab("world_x_cst");

            await waitForConnectionTabValue("schema", "world_x_cst");

            await enterCmd(textArea, "db.countryinfo.find()");

            expect(await shellGetLangResult()).toBe("json");

        } catch(e) {
            testFailed = true;
            throw e;
        } finally {
            await changeSchemaOnTab("sakila");
            await waitForConnectionTabValue("schema", "sakila");
        }
    });

    it("Verify help command", async () => {
        try {

            textArea = await driver.findElement(By.css("textarea"));

            await enterCmd(textArea, "\\h");

            await waitForShellResult("The Shell Help is organized in categories and topics.");
            await waitForShellResult("SHELL COMMANDS");
            await waitForShellResult("\\connect");
            await waitForShellResult("\\disconnect");
            await waitForShellResult("\\edit");
            await waitForShellResult("\\exit");
            await waitForShellResult("\\help");
            await waitForShellResult("\\history");
            await waitForShellResult("\\js");
            await waitForShellResult("\\nopager");
            await waitForShellResult("\\nowarnings");
            await waitForShellResult("\\option");
            await waitForShellResult("\\pager");
            await waitForShellResult("\\py");
            await waitForShellResult("\\quit");
            await waitForShellResult("\\reconnect");
            await waitForShellResult("\\rehash");
            await waitForShellResult("\\show");
            await waitForShellResult("\\source");
            await waitForShellResult("\\sql");
            await waitForShellResult("\\status");
            await waitForShellResult("\\system");
            await waitForShellResult("\\use");
            await waitForShellResult("\\warning");
            await waitForShellResult("\\watch");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch session language - javascript python", async () => {
        try {

            await enterCmd(textArea, "\\py");

            await waitForShellResult("Switching to Python mode...");

            expect(await shellGetTech()).toBe("python");

            await enterCmd(textArea, "\\js");

            await waitForShellResult("Switching to JavaScript mode...");

            expect(await shellGetTech()).toBe("javascript");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using db global variable", async () => {
        try {

            await enterCmd(textArea, "db.actor.select().limit(1)");

            expect(await shellGetLangResult()).toBe("json");

            await driver.wait(async () => {
                return isValueOnJsonResult("PENELOPE");
            }, explicitWait, "PENELOPE is on the the JSON result");

            expect(await shellGetTotalRows()).toMatch(/Query OK, (\d+) rows affected/);

            await enterCmd(textArea, "db.category.select().limit(1)");

            expect(await shellGetLangResult()).toBe("json");

            await driver.wait(async () => {
                return isValueOnJsonResult("Action");
            }, explicitWait, "Action is on the the JSON result");

            expect(await shellGetTotalRows()).toMatch(/Query OK, (\d+) rows affected/);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {

            await enterCmd(textArea, 'util.exportTable("actor", "test.txt")');

            await waitForShellResult("The dump can be loaded using");

            await waitForShellResult("Running data dump using 1 thread.");

            await waitForShellResult(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);

            await waitForShellResult(/Data size: (\d+).(\d+)(\d+) KB/);

            await waitForShellResult(/Rows written: (\d+)/);

            await waitForShellResult(/Bytes written: (\d+).(\d+)(\d+) KB/);

            await waitForShellResult(/Average throughput: (\d+).(\d+)(\d+) KB/);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {

            await enterCmd(textArea, "\\sql");

            await enterCmd(textArea, "SHOW DATABASES;");

            await driver.wait(async () => {
                return isValueOnDataSet("sakila");
            }, explicitWait, "sakila is not on the dataset");

            await driver.wait(async () => {
                return isValueOnDataSet("mysql");
            }, explicitWait, "mysql is not on the dataset");

            await enterCmd(textArea, "\\js");

            await enterCmd(textArea, "db.actor.select().limit(1)");

            expect(await shellGetLangResult()).toBe("json");

            await driver.wait(async () => {
                return isValueOnJsonResult("PENELOPE");
            }, explicitWait, "PENELOPE is on the the JSON result");

        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

});
