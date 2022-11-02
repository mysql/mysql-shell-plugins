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
import { driver, loadDriver, loadPage } from "../lib/engine";
import { By, until } from "selenium-webdriver";
import {
    waitForHomePage,
    setStartLanguage,
    openShellSession,
    shellGetSession,
    closeSession,
    enterCmd,
    shellGetTech,
    shellGetTotalRows,
    shellGetLangResult,
    setDBEditorPassword,
    setConfirmDialog,
    cleanEditor,
    isValueOnDataSet,
    getShellServerTabStatus,
    isValueOnJsonResult,
    IDBConnection,
    waitForShellResult,
    waitForConnectionTabValue,
    explicitWait,
} from "../lib/helpers";

describe("MySQL Shell Sessions", () => {

    let testFailed: boolean;

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

        const textArea = await driver.findElement(By.css("textArea"));
        await enterCmd(textArea, `\\d`);
        await driver.wait(async () => {
            return (await driver.findElements(By.css(".shellPromptItem"))).length === 1;
        }, 2000, "There are still more than 1 tab after disconnect");
        expect(await getShellServerTabStatus()).toBe("The session is not connected to a MySQL server");
        await cleanEditor();
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Open multiple sessions", async () => {
        try {
            await driver.findElement(By.id("sessions")).click();
            const session1 = await shellGetSession("1");
            expect(await session1!.findElement(By.css(".tileCaption")).getText()).toBe("Session 1");
            await openShellSession();
            await driver.findElement(By.id("sessions")).click();

            const session2 = await shellGetSession("2");
            expect(await session2!.findElement(By.css(".tileCaption")).getText()).toBe("Session 2");
            await openShellSession();
            await driver.findElement(By.id("sessions")).click();

            const session3 = await shellGetSession("3");
            expect(await session3!.findElement(By.css(".tileCaption")).getText()).toBe("Session 3");

            await closeSession("1");
            expect(await shellGetSession("1")).toBeUndefined();
            await closeSession("2");
            expect(await shellGetSession("2")).toBeUndefined();
            await openShellSession(3);
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;

            await enterCmd(
                textArea,
                uri,
            );

            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(toCheck);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema set to \`${globalConn.schema}\`.`);

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to host without password", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                textArea,
                `\\c ${globalConn.username}@${globalConn.hostname}:${globalConn.port}/${globalConn.schema}`);

            await setDBEditorPassword(globalConn);

            await setConfirmDialog(globalConn, "no");

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(uri);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema set to \`${globalConn.schema}\`.`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);


        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify help command", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;

            await enterCmd(
                textArea,
                uri);

            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(toCheck);
            await waitForShellResult(`Default schema set to \`${globalConn.schema}\`.`);

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

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
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

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
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}`;

            await enterCmd(
                textArea,
                uri);

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

    it("Using shell global variable", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await waitForShellResult(uri);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult(`Default schema \`${globalConn.schema}\` accessible through db`);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

            await enterCmd(textArea, "shell.status()");

            await waitForShellResult(/MySQL Shell version (\d+).(\d+).(\d+)/);

            await waitForShellResult(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            await waitForShellResult(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            await waitForShellResult(new RegExp(`"CURRENT_USER":"${globalConn.username}`));

            await waitForShellResult(`"TCP_PORT":"${String(globalConn.portX)}"`);

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using mysql mysqlx global variable", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            const cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
            @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

            await enterCmd(textArea, cmd.replace(/ /g,""));

            await waitForShellResult("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            let uri = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            await waitForShellResult("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            uri = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            await waitForShellResult("&lt;Session&gt;");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using util global variable", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}`;

            await enterCmd(
                textArea,
                uri);

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            await waitForShellResult(uri);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
            toCheck += ` using the classic protocol`;


            await waitForConnectionTabValue("server", toCheck);
            await waitForConnectionTabValue("schema", globalConn.schema);

            await enterCmd(
                textArea,
                'util.exportTable("actor", "test.txt")',
            );

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

    it("Verify collections - json format", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let text = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            text += `${String(globalConn.portX)}/world_x_cst`;
            await enterCmd(textArea, text);

            text = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            text += `${String(globalConn.portX)}/world_x_cst'`;

            await waitForShellResult(text);
            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);
            await waitForShellResult("Default schema `world_x_cst` accessible through db.");

            text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            await waitForConnectionTabValue("server", text);
            await waitForConnectionTabValue("schema", "world_x_cst");

            await enterCmd(textArea, "db.countryinfo.find()");
            expect(await shellGetLangResult()).toBe("json");

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Change schemas using menu", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                textArea,
                `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${String(globalConn.portX)}`);

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}`;

            await waitForShellResult(uri);

            await waitForShellResult("No default schema selected");

            let text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            await waitForConnectionTabValue("server", text);
            await waitForConnectionTabValue("schema", "no schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect( schemaLabel.substring(1).trim() ).toBe("no schema selected");

            await driver.findElement(By.id("schema")).click();
            let menuItems = await driver.wait(until.elementsLocated(By.css(".shellPromptSchemaMenu .menuItem .label")),
                explicitWait, "Menu items were not found");
            const schema1 = (await menuItems[0].getText()).substring(1).trim();
            const schema2 = (await menuItems[1].getText()).substring(1).trim();
            await menuItems[0].click();

            await waitForShellResult("Default schema `" + schema1 + "` accessible through db.");

            await driver.findElement(By.id("schema")).click();
            menuItems = await driver.wait(until.elementsLocated(By.css(".shellPromptSchemaMenu .menuItem .label")),
                explicitWait, "Menu items were not found");
            await menuItems[1].click();

            await waitForShellResult("Default schema `" + schema2 + "` accessible through db.");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            let text = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            text += `${String(globalConn.portX)}/${globalConn.schema}'`;

            await waitForShellResult(text);

            await waitForShellResult(/Server version: (\d+).(\d+).(\d+)/);

            await waitForShellResult(`Default schema \`${globalConn.schema}\` accessible through db`);

            text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            await waitForConnectionTabValue("server", text);

            await waitForConnectionTabValue("schema", globalConn.schema);

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
