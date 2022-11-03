/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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
import { loadDriver, loadPage, driver } from "../../lib/engine";
import { By, until, Key } from "selenium-webdriver";
import {
    IDBConnection,
    waitForHomePage,
    getDB,
    createDBconnection,
    getToolbarButton,
    getResultStatus,
    findInSelection,
    expandFinderReplace,
    replacerGetButton,
    closeFinder,
    getSchemaObject,
    toggleSchemaObject,
    getOpenEditor,
    selectCurrentEditor,
    getResultTab,
    getResultColumnName,
    getOutput,
    enterCmd,
    pressEnter,
    setEditorLanguage,
    setDBEditorPassword,
    getGraphHost,
    clickDBEditorContextItem,
    setConfirmDialog,
    initConDialog,
    writeSQL,
    expandCollapseDBEditorMenus,
    hasNewPrompt,
    getLastQueryResultId,
    getPromptTextLine,
    cleanEditor,
    explicitWait,
    openNewNotebook,
} from "../../lib/helpers";

describe("Notebook", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `conn${new Date().valueOf()}`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
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

        await driver.findElement(By.id("gui.sqleditor")).click();

        let db = await getDB("conn");

        if (!db) {
            await initConDialog();
            await createDBconnection(globalConn, true);
            db = await getDB(globalConn.caption);
        }

        try {
            await driver.executeScript("arguments[0].click();", db);
            await setDBEditorPassword(globalConn);
            await setConfirmDialog(globalConn, "yes");
        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("dialog was found") === -1) {
                    throw e;
                }
            }
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
        await openNewNotebook();
    });

    afterAll(async () => {
        await driver.quit();
    });


    testFailed = false;


    it("Multi-cursor", async () => {
        try {

            await setEditorLanguage("sql");
            await writeSQL("select * from sakila.actor;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await writeSQL("select * from sakila.address;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await writeSQL("select * from sakila.city;");

            await driver.actions().keyDown(Key.ALT).perform();

            let lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
            lines.shift();
            let spans = await lines[0].findElements(By.css("span"));
            await spans[spans.length - 1].click();

            spans = await lines[1].findElements(By.css("span"));
            await spans[spans.length - 1].click();
            await driver.actions().keyUp(Key.ALT).perform();

            const ctx = await driver.findElement(By.css(".lines-content"));
            expect((await ctx.findElements(By.css(".current-line"))).length).toBe(3);

            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys("testing");

            const context = await driver.findElement(By.css(".monaco-editor-background"));
            lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            try {
                    // is stale ?
                await lines[lines.length-1].click();
            } catch (e) {
                    // continue
            }

            expect(await getPromptTextLine("last-2")).toContain("testing");
            expect(await getPromptTextLine("last-1")).toContain("testing");
            expect(await getPromptTextLine("last")).toContain("testing");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context Menu - Execute", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));

            await enterCmd(textArea, "select version();", 20000);

            await writeSQL("select * from actor limit 1", true);

            let lastId = await getLastQueryResultId();

            await clickDBEditorContextItem("Execute Block");

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );

            expect(await hasNewPrompt()).toBe(false);

            lastId = await getLastQueryResultId();

            await clickDBEditorContextItem("Execute Block and Advance");

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );

            expect(await hasNewPrompt()).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {

            await writeSQL("select * from actor limit 1; select * from address limit 1;", true);

            const lastId = await getLastQueryResultId();

            await (
                await getToolbarButton(
                    "Execute selection or full block and create a new block",
                )
            )!.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            const result1 = await driver.wait(async () => {
                return getResultTab("Result #1");
            }, 5000, "No results were found");

            const result2 = await getResultTab("Result #2");

            expect(result1).toBeDefined();

            expect(result2).toBeDefined();

            expect(await getResultColumnName("actor_id")).toBeDefined();

            await result2!.click();

            expect(await getResultColumnName("address_id")).toBeDefined();

            await result1!.click();

            expect(await getResultColumnName("actor_id")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify default schema", async () => {
        try {
            const defaultSchema = await driver.findElement(
                By.css("#schemaSectionHost div.marked"),
            );

            expect(await defaultSchema.findElement(By.css("label")).getText()).toBe(String(globalConn.schema));
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {

            await writeSQL("select * from actor limit 1", true);

            const lastId = await getLastQueryResultId();

            const exeSelNew = await getToolbarButton(
                "Execute selection or full block and create a new block");
            await exeSelNew?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 7000, "No new results block was displayed");

            expect(await getResultColumnName("actor_id")).toBeDefined();

            expect(await getResultColumnName("first_name")).toBeDefined();

            expect(await getResultColumnName("last_name")).toBeDefined();

            expect(await getResultColumnName("last_update")).toBeDefined();

            expect(await hasNewPrompt()).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));

            await writeSQL("select * from actor limit 1;");

            await textArea.sendKeys(Key.RETURN);

            await writeSQL("select * from address limit 1;");

            await textArea.sendKeys(Key.RETURN);

            await writeSQL("select * from category limit 1;");

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".statementStart"))).length >= 3;
            }, 3000, "Statement start (blue dot) was not found on all lines");

            const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));

            let span2Click = await lines[lines.length-2].findElement(By.css("span > span"));

            await span2Click.click();

            let lastId = await getLastQueryResultId();

            let execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName("address_id")).toBeDefined();

            span2Click = await lines[lines.length-3].findElement(By.css("span > span"));

            await span2Click.click();

            lastId = await getLastQueryResultId();

            execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName("actor_id")).toBeDefined();

            span2Click = await lines[lines.length-1].findElement(By.css("span > span"));

            await span2Click.click();

            lastId = await getLastQueryResultId();

            execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName("category_id")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {

            const autoCommit = await getToolbarButton("Auto commit DB changes");
            await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommit);
            await autoCommit!.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await writeSQL(
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            const commitBtn = await getToolbarButton("Commit DB changes");

            const rollBackBtn = await getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            let lastId = await getLastQueryResultId();

            let execSelNew = await getToolbarButton(
                "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus()).toContain("OK");

            await rollBackBtn!.click();

            await cleanEditor();

            await writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await getLastQueryResultId();

            execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus()).toContain(
                "OK, 0 records retrieved",
            );

            await cleanEditor();

            await writeSQL(
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            lastId = await getLastQueryResultId();

            execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus()).toContain("OK");

            await commitBtn!.click();

            await cleanEditor();

            await writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await getLastQueryResultId();

            execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async() => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(true)).toContain(
                "OK, 1 record retrieved",
            );

            await driver.executeScript("arguments[0].scrollIntoView()", autoCommit);
            await autoCommit!.click();

            await driver.wait(
                async () => {
                    return (
                        (await commitBtn!.isEnabled()) === false &&
                            (await rollBackBtn!.isEnabled()) === false
                    );
                },
                5000,
                "Commit/Rollback DB changes button is still enabled ",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Find and Replace", async () => {
        try {

            const contentHost = await driver.findElement(By.id("contentHost"));

            await writeSQL(`import from xpto xpto xpto`);

            const findBtn = await getToolbarButton("Find");
            await findBtn!.click();

            const finder = await driver.wait(until.elementLocated(By.css(".find-widget")),
                explicitWait, "Finder was not found");

            expect(await finder.getAttribute("aria-hidden")).toBe("false");

            const textArea = await finder.findElement(By.css("textarea"));
            await driver.wait(until.elementIsVisible(textArea),
                explicitWait, "Finder textarea is not visible");

            await textArea.sendKeys("xpto");

            await findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).toMatch(new RegExp(/1 of (\d+)/));

            await driver.wait(
                until.elementsLocated(By.css(".cdr.findMatch")),
                2000,
                "No words found",
            );

            await expandFinderReplace(finder, true);

            const replacer = await finder.findElement(By.css(".replace-part"));

            await replacer.findElement(By.css("textarea")).sendKeys("tester");

            await (await replacerGetButton(replacer, "Replace (Enter)"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toContain("import from tester xpto xpto");

            await replacer.findElement(By.css("textarea")).clear();

            await replacer.findElement(By.css("textarea")).sendKeys("testing");

            await (await replacerGetButton(replacer, "Replace All"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toContain("import from tester testing testing");

            await closeFinder(finder);

            expect(await finder.getAttribute("aria-hidden")).toBe("true");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand Collapse schema objects", async () => {
        try {

            await expandCollapseDBEditorMenus("open editors", false, 0);

            await expandCollapseDBEditorMenus("scripts", false, 0);

            const sakila = await getSchemaObject("Schema", "sakila");

            expect(
                await (
                    await sakila!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            await toggleSchemaObject("Tables", "Tables");

            const tables = await getSchemaObject("Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject("obj", "actor")).toBeDefined();

            expect(await getSchemaObject("obj", "address")).toBeDefined();

            expect(await getSchemaObject("obj", "category")).toBeDefined();

            expect(await getSchemaObject("obj", "city")).toBeDefined();

            expect(await getSchemaObject("obj", "country")).toBeDefined();

            await toggleSchemaObject("Tables", "Tables");

            let attr = await (
                await getSchemaObject("Tables", "Tables")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject("Views", "Views");

            expect(
                await (
                    await getSchemaObject("Views", "Views")
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject("obj", "test_view")).toBeDefined();

            await toggleSchemaObject("Views", "Views");

            attr = await (
                await getSchemaObject("Views", "Views")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject("Schema", "sakila");

            attr = await (
                await getSchemaObject("Schema", "sakila")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand_Collapse menus", async () => {
        try {

            await expandCollapseDBEditorMenus("open editors", true, 0);

            expect(
                await driver
                    .findElement(By.id("editorSectionHost"))
                    .findElement(By.css("div.container.section"))
                    .getAttribute("class"),
            ).toContain("expanded");

            await expandCollapseDBEditorMenus("open editors", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(By.id("editorSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Open Editors' is still expanded",
            );

            await expandCollapseDBEditorMenus("open editors", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(By.id("editorSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Open Editors' is still collapsed",
            );

            expect(
                await driver
                    .findElement(By.id("schemaSectionHost"))
                    .findElement(By.css("div.container.section"))
                    .getAttribute("class"),
            ).toContain("expanded");

            await expandCollapseDBEditorMenus("schemas", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(By.id("schemaSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Schemas' is still expanded",
            );

            await expandCollapseDBEditorMenus("schemas", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(By.id("schemaSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Schemas' is still collapsed",
            );

            await expandCollapseDBEditorMenus("admin", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(By.id("adminSectionHost"))
                            .findElement(By.css(".fixedScrollbar"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Administration' is still expanded",
            );

            await expandCollapseDBEditorMenus("admin", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(By.id("adminSectionHost"))
                            .findElement(By.css(".fixedScrollbar"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Administration' is still collapsed",
            );

            await expandCollapseDBEditorMenus("scripts", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(By.id("scriptSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Scripts' is still expanded",
            );

            await expandCollapseDBEditorMenus("scripts", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(By.id("scriptSectionHost"))
                            .findElement(By.css("div.container.section"))
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Scripts' is still collapsed",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using Math_random on js_py blocks", async () => {
        try {

            await setEditorLanguage("javascript");

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(textArea, "Math.random();");

            const result2 = await getOutput();

            expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));

            await enterCmd(textArea, "\\typescript");

            expect(await getOutput()).toBe("Switched to TypeScript mode");

            await enterCmd(textArea, "Math.random();");

            const result4 = await getOutput();

            expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await pressEnter();

            const otherResult = await getOutput(true);

            expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));

            expect(otherResult !== result2).toBe(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await pressEnter();

            const otherResult1 = await getOutput();

            expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));

            expect(otherResult1 !== result4).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Multi-line comments", async () => {
        try {

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(textArea, "SELECT VERSION();");

            const resultHosts = await driver.wait(until.elementsLocated(By.css(".resultHost")),
                explicitWait, "Result hosts not found");

            const txt = await driver.wait(until.elementLocated(async () => {
                return resultHosts[resultHosts.length-1].findElements(By.css(".tabulator-cell"));
            }), explicitWait, "Table cell was not found");

            const server = (await txt.getText()).match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await enterCmd(textArea, `/*!${serverVer} select * from actor limit 1;*/`);

            expect(await getResultStatus(true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );

            const higherServer = parseInt(serverVer, 10) + 1;

            await enterCmd(textArea, `/*!${higherServer} select * from actor limit 1;*/`);

            expect(await getResultStatus()).toContain(
                "OK, 0 records retrieved",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {

            await setEditorLanguage("ts");

            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            const cmd = `
                runSql("SELECT Name, Capital FROM world_x_cst.country limit 10",(result) => {
                    const options: IGraphOptions = {
                        series: [
                            {
                                type: "bar",
                                yLabel: "Actors",
                                data: result as IJsonGraphData,
                            }
                        ]
                    }
                    const i=0;
                    Graph.render(options);
                }
                `;

            await enterCmd(textArea, cmd.trim());

            const pieChart = await getGraphHost();

            const chartColumns = await pieChart.findElements(By.css("rect"));
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).toBeGreaterThan(0);
            }

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using a DELIMITER", async () => {
        try {

            await setEditorLanguage("sql");

            let text = `
                    DELIMITER $$
                        select 2 $$
                    select 1
                    `;

            text = text.trim();
            await writeSQL(text);

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".statementStart"))).length > 1;
            }, 5000, "No blue dots were found");

            const lines = await driver.findElements(By
                .css("#contentHost .editorHost div.margin-view-overlays > div"));

            expect(await lines[lines.length-1].findElement(By.css(".statementStart"))).toBeDefined();
            expect(await lines[lines.length-2].findElement(By.css(".statementStart"))).toBeDefined();
            expect(await lines[lines.length-3].findElement(By.css(".statementStart"))).toBeDefined();

            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ENTER);

            await driver.wait(async () => {
                return (await driver.findElements(
                    By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
            }, 5000, "A new line was not found");

            await driver.wait(async () => {
                try {
                    const lines = await driver.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                    return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length === 0;
                } catch (e) {
                    return false;
                }
            }, 5000, "Line 2 has the statement start");

            await textArea.sendKeys("select 1");

            await driver.wait(async () => {
                try {
                    const lines = await driver.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                    return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length > 0;
                } catch (e) {
                    return false;
                }
            }, 5000, "Line 2 does not have the statement start");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add a new console", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click()",
                await driver.findElement(By.id("addConsole")),
            );

            const input = await driver.wait(until.elementLocated(By.css("#editorSectionHost input")),
                explicitWait, "Editor host input was not found");

            await input.sendKeys("myNewConsole");

            await input.sendKeys(Key.ENTER);

            expect(await getOpenEditor("myNewConsole")).toBeDefined();

            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toBe("myNewConsole");

            expect(
                await driver
                    .findElement(By.css("#documentSelector img"))
                    .getAttribute("src"),
            ).toContain("shell");

            await driver
                .findElement(By.id("contentHost"))
                .findElement(By.css("textarea"))
                .sendKeys("select actor from actor");

            await selectCurrentEditor("DB Notebook", "shell");

            await selectCurrentEditor("myNewConsole", "shell");

            const console = await getOpenEditor("myNewConsole");

            await console!.findElement(By.css("span.codicon-close")).click();

            expect(await getOpenEditor("myNewConsole")).toBeUndefined();

            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toContain("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });


});
