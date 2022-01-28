/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { getDriver, load } from "../lib/engine";
import { By } from "selenium-webdriver";
import {
    waitForHomePage,
    setCodeEditorLanguage,
    openShellSession,
    shellGetSession,
    closeSession,
    shellEnterCmd,
    shellGetResult,
    shellGetTech,
    shellGetResultTable,
    shellGetTotalRows,
    shellGetJsonResult,
} from "../lib/helpers";

import { checkEnv, checkMySQLRunning, checkMySQLEnv, startServer } from "../lib/teardowns";

describe("MySQL Shell Sessions", function () {
    const dbConfig = {
        hostname: __DBHOSTNAME__,
        port: __DBPORT__,
        port_x: "33060",
        username: __DBUSERNAME__,
        password: __DBPASSWORD__,
        schema: "sakila",
    };

    let driver;

    beforeAll(async function () {
        try {
            __CHILD__ = await startServer();
            driver = getDriver();
            await checkEnv();
            await checkMySQLRunning();
            await checkMySQLEnv();
        } catch (e) {
            if(__CHILD__) { __CHILD__.kill(); }
            console.error(e);
            await driver.quit();
            await new Promise((resolve) => {
                return setTimeout(resolve, 500);
            });
            process.exit(1);
        }

        await load(driver);
        await waitForHomePage(driver);
        await setCodeEditorLanguage(driver, "Javascript");
    });

    beforeEach(async function () {
        await load(driver);
        await waitForHomePage(driver);
        await driver.findElement(By.id("gui.shell")).click();
        await openShellSession(driver);
    });

    afterAll(async function () {
        __CHILD__.kill();
        await driver.quit();
    });

    it("Open multiple sessions", async function () {
        expect(await driver.findElement(By.id("shellEditorHost"))).toBeDefined();

        await driver.findElement(By.id("sessions")).click();

        const session1 = await shellGetSession(driver, "1");

        expect(await session1.findElement(By.css(".tileCaption")).getText()).toBe("Session 1");

        ////

        await openShellSession(driver);

        expect(await driver.findElement(By.id("shellEditorHost"))).toBeDefined();

        await driver.findElement(By.id("sessions")).click();

        const session2 = await shellGetSession(driver, "2");

        expect(await session2.findElement(By.css(".tileCaption")).getText()).toBe("Session 2");

        ///

        await openShellSession(driver);

        expect(await driver.findElement(By.id("shellEditorHost"))).toBeDefined();

        await driver.findElement(By.id("sessions")).click();

        const session3 = await shellGetSession(driver, "3");

        expect(await session3.findElement(By.css(".tileCaption")).getText()).toBe("Session 3");

        ///CLOSE SESSIONS
        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();

        await closeSession(driver, 2);

        expect(await shellGetSession(driver, "2")).toBeUndefined();

        await closeSession(driver, 3);

        expect(await shellGetSession(driver, "3")).toBeUndefined();
    });

    it("Connect to host", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c " +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema,
        );

        const result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/sakila'",
        );

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            "Default schema set to `" + dbConfig.schema + "`.",
        );

        await shellEnterCmd(driver, textArea, "\\q");

        expect((await driver.findElements(By.id("session_1"))).length).toBe(0);
    });

    it("Connect to host without password", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c " +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema,
        );

        let dialog;

        await driver.wait(
            async function () {
                dialog = await driver.findElement(By.css("div.passwordDialog"));

                return dialog !== undefined;
            },
            5000,
            "Password dialog was not displayed",
        );

        expect(await dialog.findElement(By.css(".title .label")).getText())
            .toBe("Open MySQL Connection in Shell Session");

        await dialog.findElement(By.css("input")).sendKeys(dbConfig.password);

        await dialog.findElement(By.id("ok")).click();

        await driver.wait(
            async function () {
                return (
                    (await driver.findElements(By.css("div.passwordDialog"))).length === 0
                );
            },
            5000,
            "Password dialog is still displayed",
        );

        await driver.wait(
            async function () {
                dialog = await driver.findElement(By.css("div.valueEditDialog"));

                return dialog !== undefined;
            },
            5000,
            "Feedback Requested dialog was not displayed",
        );

        expect(
            await dialog.findElement(By.css(".label.valueTitle")).getText(),
        ).toBe(
            "Save password for '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "'? [Y]es/[N]o/Ne[v]er (default No):",
        );

        await dialog.findElement(By.id("input")).sendKeys("No");

        await dialog.findElement(By.id("ok")).click();

        await driver.wait(
            async function () {
                return (
                    (await driver.findElements(By.css("div.valueEditDialog"))).length ===
                    0
                );
            },
            5000,
            "Feedback dialog is still displayed",
        );

        const result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/sakila'",
        );

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            "Default schema set to `" + dbConfig.schema + "`.",
        );

        await shellEnterCmd(driver, textArea, "\\q");

        expect((await driver.findElements(By.id("session_1"))).length).toBe(0);
    });

    it("Verify help command", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c " +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema,
        );

        let result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema +
            "'",
        );

        expect(result).toContain(
            "Default schema set to `" + dbConfig.schema + "`.",
        );

        await shellEnterCmd(driver, textArea, "\\h");

        result = await shellGetResult(driver);

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

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    it("Switch session language (javascript/python)", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(driver, textArea, "\\py");

        let result = await shellGetResult(driver);

        expect(result).toBe("Switching to Python mode...");

        expect(await shellGetTech(editor)).toBe("python");

        await shellEnterCmd(driver, textArea, "\\js");

        result = await shellGetResult(driver);

        expect(result).toBe("Switching to JavaScript mode...");

        expect(await shellGetTech(editor)).toBe("javascript");

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    //FE does not return the rows
    xit("Using db global variable", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c mysqlx://" +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":33060/" +
            dbConfig.schema,
        );

        const result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating an X protocol session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":33060/" +
            dbConfig.schema +
            "'",
        );

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            "Default schema `" + dbConfig.schema + "` accessible through db.",
        );

        await shellEnterCmd(driver, textArea, "db.actor.select()");

        expect(await shellGetResultTable(driver)).toBeDefined();

        expect(await shellGetTotalRows(driver)).toMatch(
            new RegExp(/(\d+) rows in set/),
        );

        await shellEnterCmd(driver, textArea, "db.category.select()");

        expect(await shellGetResultTable(driver)).toBeDefined();

        expect(await shellGetTotalRows(driver)).toMatch(
            new RegExp(/(\d+) rows in set/),
        );

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    it("Using shell global variable", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "shell.connect('" +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":33060/" +
            dbConfig.schema +
            "')",
        );

        let result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":33060/" +
            dbConfig.schema +
            "'",
        );

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            "Default schema `" + dbConfig.schema + "` accessible through db",
        );

        await shellEnterCmd(driver, textArea, "shell.status()");

        result = await shellGetResult(driver);

        expect(result).toMatch(
            new RegExp(/MySQL Shell version (\d+).(\d+).(\d+)-[commercial|community]/),
        );

        expect(result).toContain('"CONNECTION":"' + dbConfig.hostname);

        expect(result).toContain('"CURRENT_SCHEMA":"' + dbConfig.schema + '"');

        expect(result).toContain('"CURRENT_USER":"' + dbConfig.username);

        expect(result).toContain('"TCP_PORT":"' + dbConfig.port);

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    it("Using mysql/mysqlx global variable", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(driver, textArea,
            `mysql.getClassicSession('${dbConfig.username}:${dbConfig.password}
            @${dbConfig.hostname}:${dbConfig.port}/${dbConfig.schema}')`);

        const result = await shellGetResult(driver);

        expect(result).toContain("ClassicSession");

        await shellEnterCmd(driver, textArea, "shell.disconnect()");

        await shellEnterCmd(
            driver,
            textArea,
            "mysql.getSession('" +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema +
            "')",
        );

        expect(result).toContain("ClassicSession");

        await shellEnterCmd(driver, textArea, "shell.disconnect()");

        await shellEnterCmd(
            driver,
            textArea,
            "mysqlx.getSession('" +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":33060/" +
            dbConfig.schema +
            "')",
        );

        expect(result).toContain("Session");

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    it("Using util global variable", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c " +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/" +
            dbConfig.schema,
        );

        let result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port +
            "/sakila'",
        );

        await shellEnterCmd(
            driver,
            textArea,
            'util.exportTable("actor", "/Users/guilhermesaraiva/Documents/test")',
        );

        await driver.wait(
            async function () {
                return (
                    (await shellGetResult(driver)).indexOf(
                        "The dump can be loaded using",
                    ) !== -1
                );
            },
            10000,
            "Export operation was not done in time",
        );

        result = await shellGetResult(driver);

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

        await closeSession(driver, 1);

        expect(await shellGetSession(driver, "1")).toBeUndefined();
    });

    it("Verify collections - json format", async function () {
        const editor = await driver.findElement(By.id("shellEditorHost"));

        await driver.executeScript(
            "arguments[0].click();",
            await editor.findElement(By.css(".current-line")),
        );

        const textArea = await editor.findElement(By.css("textArea"));

        await shellEnterCmd(
            driver,
            textArea,
            "\\c " +
            dbConfig.username +
            ":" +
            dbConfig.password +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port_x +
            "/world_x_cst",
        );

        const result = await shellGetResult(driver);

        expect(result).toContain(
            "Creating a session to '" +
            dbConfig.username +
            "@" +
            dbConfig.hostname +
            ":" +
            dbConfig.port_x +
            "/world_x_cst'",
        );

        expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

        expect(result).toContain(
            "Default schema `world_x_cst` accessible through db.",
        );

        await shellEnterCmd(driver, textArea, "db.countryinfo.find()");

        expect(JSON.parse(await shellGetJsonResult(driver))).toBeDefined();
    });
});
