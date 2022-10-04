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
import { By } from "selenium-webdriver";
import {
    waitForHomePage,
    setStartLanguage,
    openShellSession,
    shellGetSession,
    closeSession,
    enterCmd,
    shellGetResult,
    shellGetTech,
    shellGetTotalRows,
    shellGetLangResult,
    setDBEditorPassword,
    setConfirmDialog,
    cleanEditor,
    isValueOnDataSet,
    getShellServerTabStatus,
    getShellSchemaTabStatus,
    isValueOnJsonResult,
    IDBConnection,
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

            const result = await shellGetResult();
            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;
            expect(result).toContain(toCheck);
            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema set to \`${globalConn.schema}\`.`,
            );

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;
            expect(await getShellServerTabStatus()).toBe(toCheck);
            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);

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

            const result = await shellGetResult();

            let uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            expect(result).toContain(uri);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema set to \`${globalConn.schema}\`.`,
            );

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            expect(await getShellServerTabStatus()).toBe(toCheck);
            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);


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

            let result = await shellGetResult();
            let toCheck = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            toCheck += `${globalConn.port}/${globalConn.schema}'`;

            expect(result).toContain(toCheck);

            expect(result).toContain(
                `Default schema set to \`${globalConn.schema}\`.`,
            );

            toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port}`;
            toCheck += `, using the classic protocol`;

            expect(await getShellServerTabStatus()).toBe(toCheck);
            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);

            await enterCmd(textArea, "\\h");

            result = await shellGetResult();

            expect(result).toContain(
                "The Shell Help is organized in categories and topics.",
            );

            expect(result).toContain("SHELL COMMANDS");
            expect(result).toContain("\\connect");
            expect(result).toContain("\\disconnect");
            expect(result).toContain("\\edit");
            expect(result).toContain("\\exit");
            expect(result).toContain("\\help");
            expect(result).toContain("\\history");
            expect(result).toContain("\\js");
            expect(result).toContain("\\nopager");
            expect(result).toContain("\\nowarnings");
            expect(result).toContain("\\option");
            expect(result).toContain("\\pager");
            expect(result).toContain("\\py");
            expect(result).toContain("\\quit");
            expect(result).toContain("\\reconnect");
            expect(result).toContain("\\rehash");
            expect(result).toContain("\\show");
            expect(result).toContain("\\source");
            expect(result).toContain("\\sql");
            expect(result).toContain("\\status");
            expect(result).toContain("\\system");
            expect(result).toContain("\\use");
            expect(result).toContain("\\warning");
            expect(result).toContain("\\watch");

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

            let result = await shellGetResult();

            expect(result).toBe("Switching to Python mode...");

            expect(await shellGetTech()).toBe("python");

            await enterCmd(textArea, "\\js");

            result = await shellGetResult();

            expect(result).toBe("Switching to JavaScript mode...");

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

            const result = await shellGetResult();

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            expect(result).toContain(uri);

            expect(result).toContain("(X protocol)");

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema \`${globalConn.schema}\` accessible through db.`,
            );

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;
            expect(await getShellServerTabStatus()).toBe(toCheck);

            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);

            await enterCmd(textArea, "db.actor.select()");

            expect(await shellGetLangResult()).toBe("json");

            expect(await isValueOnJsonResult("PENELOPE")).toBe(true);

            expect(await shellGetTotalRows()).toMatch(/Query OK, (\d+) rows affected/);

            await enterCmd(textArea, "db.category.select()");

            expect(await shellGetLangResult()).toBe("json");

            expect(await isValueOnJsonResult("Action")).toBe(true);

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

            let result = await shellGetResult();

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}'`;

            expect(result).toContain(uri);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema \`${globalConn.schema}\` accessible through db`,
            );

            let toCheck = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            toCheck += `, using the X protocol`;

            expect(await getShellServerTabStatus()).toBe(toCheck);
            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);

            await enterCmd(textArea, "shell.status()");

            result = await shellGetResult();

            expect(result).toMatch(
                new RegExp(/MySQL Shell version (\d+).(\d+).(\d+)/),
            );

            expect(result).toContain(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

            expect(result).toContain(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

            expect(result).toMatch(new RegExp(`"CURRENT_USER":"${globalConn.username}`));

            expect(result).toContain(`"TCP_PORT":"${String(globalConn.portX)}"`);

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

            let result = await shellGetResult();

            expect(result).toContain("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            result = await shellGetResult();

            let uri = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            result = await shellGetResult();

            expect(result).toContain("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            uri = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
            uri += `${String(globalConn.portX)}/${globalConn.schema}')`;

            await enterCmd(
                textArea,
                uri);

            result = await shellGetResult();

            expect(result).toContain("&lt;Session&gt;");

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

            let result = await shellGetResult();

            uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            uri += `${globalConn.port}/${globalConn.schema}'`;

            expect(result).toContain(
                uri);

            let toCheck = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
            toCheck += ` using the classic protocol`;
            expect(await getShellServerTabStatus()).toBe(toCheck);

            expect(await getShellSchemaTabStatus()).toContain(globalConn.schema);

            await enterCmd(
                textArea,
                'util.exportTable("actor", "test.txt")',
            );

            await driver.wait(
                async () => {
                    return (
                        (await shellGetResult()).indexOf(
                            "The dump can be loaded using",
                        ) !== -1
                    );
                },
                10000,
                "Export operation was not done in time",
            );

            result = await shellGetResult();

            expect(result).toContain("Running data dump using 1 thread.");

            expect(result).toMatch(
                new RegExp(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/),
            );

            expect(result).toMatch(new RegExp(/Data size: (\d+).(\d+)(\d+) KB/));

            expect(result).toMatch(new RegExp(/Rows written: (\d+)/));

            expect(result).toMatch(new RegExp(/Bytes written: (\d+).(\d+)(\d+) KB/));

            expect(result).toMatch(
                new RegExp(/Average throughput: (\d+).(\d+)(\d+) KB/),
            );

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

            const result = await shellGetResult();

            text = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
            text += `${String(globalConn.portX)}/world_x_cst'`;
            expect(result).toContain(text);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                "Default schema `world_x_cst` accessible through db.",
            );

            text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;
            expect(await getShellServerTabStatus()).toBe(text);

            expect(await getShellSchemaTabStatus()).toContain("world_x_cst");

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

            let result = await shellGetResult();

            expect(result).toContain(
                `Creating a session to '${globalConn.username}@${globalConn.hostname}:${String(globalConn.portX)}`);

            expect(result).toContain("No default schema selected");

            let text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
            text += `, using the X protocol`;

            expect(await getShellServerTabStatus()).toBe(text);

            expect(await getShellSchemaTabStatus()).toContain("no schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect( schemaLabel.substring(1).trim() ).toBe("no schema selected");

            await driver.findElement(By.id("schema")).click();
            let menuItems = await driver.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            const schema1 = (await menuItems[0].getText()).substring(1).trim();
            const schema2 = (await menuItems[1].getText()).substring(1).trim();
            await menuItems[0].click();
            await driver.sleep(1000);
            result = await shellGetResult();
            expect(result).toBe("Default schema `" + schema1 + "` accessible through db.");

            await driver.findElement(By.id("schema")).click();
            menuItems = await driver.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            await menuItems[1].click();
            await driver.sleep(1000);
            result = await shellGetResult();
            expect(result).toBe("Default schema `" + schema2 + "` accessible through db.");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Check query result content", async () => {
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

        const result = await shellGetResult();

        let text = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
        text += `${String(globalConn.portX)}/${globalConn.schema}'`;
        expect(result).toContain(text);

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            `Default schema \`${globalConn.schema}\` accessible through db`,
        );

        text = `Connection to server ${globalConn.hostname} at port ${String(globalConn.portX)}`;
        text += `, using the X protocol`;
        expect(await getShellServerTabStatus()).toBe(text);

        expect(await getShellSchemaTabStatus())
            .toContain(globalConn.schema);

        await enterCmd(textArea, "\\sql");

        await enterCmd(textArea, "SHOW DATABASES;");

        expect(await isValueOnDataSet("sakila")).toBe(true);

        expect(await isValueOnDataSet("mysql")).toBe(true);

        await enterCmd(textArea, "\\js");

        await enterCmd(textArea, "db.actor.select()");

        expect(await shellGetLangResult()).toBe("json");

        expect(await isValueOnJsonResult("PENELOPE")).toBe(true);
    });

});
