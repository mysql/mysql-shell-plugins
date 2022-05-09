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
import { getDriver, load } from "../lib/engine";
import { By, WebDriver } from "selenium-webdriver";
import {
    waitForHomePage,
    setStartLanguage,
    openShellSession,
    shellGetSession,
    closeSession,
    enterCmd,
    shellGetResult,
    shellGetTech,
    shellGetResultTable,
    shellGetTotalRows,
    shellGetLangResult,
    setDBEditorPassword,
    setFeedbackRequested,
    IDbConfig,
} from "../lib/helpers";

const dbConfig: IDbConfig = {
    dbType: "MySQL",
    caption: "ClientQA test",
    description: "my connection",
    hostname: process.env.DBHOSTNAME,
    protocol: "mysql",
    port: process.env.DBPORT,
    username: process.env.DBUSERNAME,
    password: process.env.DBPASSWORD,
    schema: "sakila",
    showAdvanced: false,
    sslMode: "Disable",
    compression: "",
    timeout: "",
    attributes: "",
    clearPassword: false,
    portX: "33060",
};

describe("MySQL Shell Sessions", () => {

    let driver: WebDriver;
    let testFailed: boolean;

    beforeAll(async () => {
        driver = await getDriver();
        await load(driver, String(process.env.SHELL_UI_HOSTNAME));
        await waitForHomePage(driver);
        await setStartLanguage(driver, "Shell Session", "javascript");
    });

    beforeEach(async () => {
        await load(driver, String(process.env.SHELL_UI_HOSTNAME));
        await waitForHomePage(driver);
        await driver.findElement(By.id("gui.shell")).click();
        await openShellSession(driver);
    });

    afterEach(async () => {
        if(testFailed) {
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
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Open multiple sessions", async () => {
        try {
            await driver.findElement(By.id("sessions")).click();
            const session1 = await shellGetSession(driver, "1");
            expect(await session1!.findElement(By.css(".tileCaption")).getText()).toBe("Session 1");
            await openShellSession(driver);
            await driver.findElement(By.id("sessions")).click();

            const session2 = await shellGetSession(driver, "2");
            expect(await session2!.findElement(By.css(".tileCaption")).getText()).toBe("Session 2");
            await openShellSession(driver);
            await driver.findElement(By.id("sessions")).click();

            const session3 = await shellGetSession(driver, "3");
            expect(await session3!.findElement(By.css(".tileCaption")).getText()).toBe("Session 3");

            await closeSession(driver, "1");
            expect(await shellGetSession(driver, "1")).toBeUndefined();
            await closeSession(driver, "2");
            expect(await shellGetSession(driver, "2")).toBeUndefined();
            await closeSession(driver, "3");
            expect(await shellGetSession(driver, "3")).toBeUndefined();
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}`,
            );

            const result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}'`,
            );

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema set to \`${String(dbConfig.schema)}\`.`,
            );

            await enterCmd(driver, textArea, "\\q");

            expect((await driver.findElements(By.id("session_1"))).length).toBe(0);
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
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}`);

            await setDBEditorPassword(driver, dbConfig);

            await setFeedbackRequested(driver, dbConfig, "N");

            const result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}'`);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema set to \`${String(dbConfig.schema)}\`.`,
            );

            await enterCmd(driver, textArea, "\\q");

            expect((await driver.findElements(By.id("session_1"))).length).toBe(0);
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}`);

            let result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}'`,
            );

            expect(result).toContain(
                `Default schema set to \`${String(dbConfig.schema)}\`.`,
            );

            await enterCmd(driver, textArea, "\\h");

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

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            await enterCmd(driver, textArea, "\\py");

            let result = await shellGetResult(driver);

            expect(result).toBe("Switching to Python mode...");

            expect(await shellGetTech(editor)).toBe("python");

            await enterCmd(driver, textArea, "\\js");

            result = await shellGetResult(driver);

            expect(result).toBe("Switching to JavaScript mode...");

            expect(await shellGetTech(editor)).toBe("javascript");

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/${String(dbConfig.schema)}`);

            const result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/${String(dbConfig.schema)}'`,
            );

            expect(result).toContain("(X protocol)");

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema \`${String(dbConfig.schema)}\` accessible through db.`,
            );

            await enterCmd(driver, textArea, "db.actor.select()");

            expect(await shellGetResultTable(driver)).toBeDefined();

            expect(await shellGetTotalRows(driver)).toMatch(
                new RegExp(/(\d+) rows in set/),
            );

            await enterCmd(driver, textArea, "db.category.select()");

            expect(await shellGetResultTable(driver)).toBeDefined();

            expect(await shellGetTotalRows(driver)).toMatch(
                new RegExp(/(\d+) rows in set/),
            );

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `shell.connect('${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/${String(dbConfig.schema)}')`);

            let result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/${String(dbConfig.schema)}'`);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                `Default schema \`${String(dbConfig.schema)}\` accessible through db`,
            );

            await enterCmd(driver, textArea, "shell.status()");

            result = await shellGetResult(driver);

            expect(result).toMatch(
                new RegExp(/MySQL Shell version (\d+).(\d+).(\d+)/),
            );

            expect(result).toContain(`"CONNECTION":"${String(dbConfig.hostname)} via TCP/IP"`);

            expect(result).toContain(`"CURRENT_SCHEMA":"${String(dbConfig.schema)}"`);

            expect(result).toMatch(new RegExp(`"CURRENT_USER":"${String(dbConfig.username)}`));

            expect(result).toContain(`"TCP_PORT":"${String(dbConfig.portX)}"`);

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            const cmd = `mysql.getClassicSession('${String(dbConfig.username)}:${String(dbConfig.password)}
            @${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}')`;

            await enterCmd(driver, textArea, cmd.replace(/ /g,""));

            let result = await shellGetResult(driver);

            expect(result).toContain("&lt;ClassicSession&gt;");

            await enterCmd(driver, textArea, "shell.disconnect()");

            result = await shellGetResult(driver);

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `mysql.getSession('${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}')`);

            result = await shellGetResult(driver);

            expect(result).toContain("&lt;ClassicSession&gt;");

            await enterCmd(driver, textArea, "shell.disconnect()");

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `mysqlx.getSession('${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/${String(dbConfig.schema)}')`);

            result = await shellGetResult(driver);

            expect(result).toContain("&lt;Session&gt;");

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}`);

            let result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.port)}/${String(dbConfig.schema)}'`);

            await enterCmd(
                driver,
                textArea,
                'util.exportTable("actor", "test.txt")',
            );

            await driver.wait(
                async () => {
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

            await closeSession(driver, "1");

            expect(await shellGetSession(driver, "1")).toBeUndefined();
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

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/world_x_cst`);

            const result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}/world_x_cst'`);

            expect(result).toMatch(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).toContain(
                "Default schema `world_x_cst` accessible through db.",
            );

            await enterCmd(driver, textArea, "db.countryinfo.find()");
            expect(await shellGetLangResult(driver)).toBe("json");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34139151
    xit("Change schemas using menu", async () => {
        try {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(dbConfig.username)}:${String(dbConfig.password)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}`);

            let result = await shellGetResult(driver);

            expect(result).toContain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(dbConfig.username)}@${String(dbConfig.hostname)}:${String(dbConfig.portX)}`);

            expect(result).toContain("No default schema selected");

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
            result = await shellGetResult(driver);
            expect(result).toBe("Default schema `" + schema1 + "` accessible through db.");

            await driver.findElement(By.id("schema")).click();
            menuItems = await driver.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            await menuItems[1].click();
            await driver.sleep(1000);
            result = await shellGetResult(driver);
            expect(result).toBe("Default schema `" + schema2 + "` accessible through db.");
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });
});
