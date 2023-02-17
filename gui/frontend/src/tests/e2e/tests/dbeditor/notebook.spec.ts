/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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
import { By, until, Key, WebElement, error } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks } from "../../lib/dbNotebooks";

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
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();

        let db: WebElement | undefined;
        try {
            db = await DBNotebooks.getConnection("conn");
        } catch (e) {
            db = undefined;
        }

        if (!db) {
            await DBNotebooks.initConDialog();
            db = await DBNotebooks.createDBconnection(globalConn, true);
        }

        try {
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(globalConn);
            await Misc.setConfirmDialog(globalConn, "yes");
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
            const testName = expect.getState().currentTestName?.toLowerCase().replace(/\s/g, "_") ?? "";
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
        await DBConnection.openNewNotebook();
    });

    afterAll(async () => {
        await driver.quit();
    });


    testFailed = false;


    it("Multi-cursor", async () => {
        try {

            await DBConnection.writeSQL("hello 1", true);
            await driver.actions().sendKeys(Key.ENTER).perform();
            await DBConnection.writeSQL("hello 2");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await DBConnection.writeSQL("hello 3");

            await driver.actions().keyDown(Key.ALT).perform();

            const clickLine = async (line: number): Promise<void> => {
                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                        lines.shift();
                        const spans = await lines[line].findElements(By.css("span"));
                        await spans[spans.length - 1].click();

                        return true;
                    } catch (e) {
                        // continue
                    }
                }, explicitWait, `Line ${line} is still stale`);
            };

            await clickLine(0);
            await clickLine(1);

            await driver.actions().keyUp(Key.ALT).perform();

            const ctx = await driver.findElement(By.css(".lines-content"));
            expect((await ctx.findElements(By.css(".current-line"))).length).toBe(3);

            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys("testing");

            const context = await driver.findElement(By.css(".monaco-editor-background"));
            const lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            try {
                // is stale ?
                await lines[lines.length - 1].click();
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }

            expect(await Misc.getPromptTextLine("last-2")).toContain("testing");
            expect(await Misc.getPromptTextLine("last-1")).toContain("testing");
            expect(await Misc.getPromptTextLine("last")).toContain("testing");

        } catch (e) {
            testFailed = true;
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            throw e;
        }
    });

    it("Context Menu - Execute", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));

            await Misc.execCmd(textArea, "select version();", 20000, true);

            await DBConnection.writeSQL("select * from actor limit 1");

            let lastId = await DBConnection.getLastQueryResultId();

            await DBConnection.clickContextItem("Execute Block");

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );

            expect(await DBConnection.hasNewPrompt()).toBe(false);

            lastId = await DBConnection.getLastQueryResultId();

            await DBConnection.clickContextItem("Execute Block and Advance");

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );

            expect(await DBConnection.hasNewPrompt()).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {

            await DBConnection.writeSQL("select * from actor limit 1; select * from address limit 1;", true);

            const lastId = await DBConnection.getLastQueryResultId();

            await (
                await DBConnection.getToolbarButton(
                    "Execute selection or full block and create a new block",
                )
            )!.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 10000, "No new results block was displayed");

            const result1 = await driver.wait(async () => {
                return DBConnection.getResultTab("Result #1");
            }, 5000, "No results were found");

            const result2 = await DBConnection.getResultTab("Result #2");

            expect(result1).toBeDefined();

            expect(result2).toBeDefined();

            await driver.wait(async () => {
                await result1!.click();

                return DBConnection.getResultColumnName("actor_id");
            }, explicitWait, "actor_id column was not found");

            await driver.wait(async () => {
                await result2!.click();

                return DBConnection.getResultColumnName("address_id");
            }, explicitWait, "address_id column was not found");

            await driver.wait(async () => {
                await result1!.click();

                return DBConnection.getResultColumnName("actor_id");
            }, explicitWait, "actor_id column was not found");

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

            await DBConnection.writeSQL("select * from actor limit 1");

            const lastId = await DBConnection.getLastQueryResultId();

            const exeSelNew = await DBConnection.getToolbarButton(
                "Execute selection or full block and create a new block");
            await exeSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 10000, "No new results block was displayed");

            expect(await DBConnection.getResultColumnName("actor_id")).toBeDefined();

            expect(await DBConnection.getResultColumnName("first_name")).toBeDefined();

            expect(await DBConnection.getResultColumnName("last_name")).toBeDefined();

            expect(await DBConnection.getResultColumnName("last_update")).toBeDefined();

            expect(await DBConnection.hasNewPrompt()).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));

            await DBConnection.writeSQL("select * from actor limit 1;");

            await textArea.sendKeys(Key.RETURN);

            await DBConnection.writeSQL("select * from address limit 1;");

            await textArea.sendKeys(Key.RETURN);

            await DBConnection.writeSQL("select * from category limit 1;");

            const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));

            let span2Click = await lines[lines.length - 2].findElement(By.css("span > span"));

            await span2Click.click();

            let lastId = await DBConnection.getLastQueryResultId();

            let execCaret = await DBConnection.getToolbarButton("Execute the statement at the caret position");

            await driver.wait(async () => {
                await execCaret?.click();

                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultColumnName("address_id")).toBeDefined();

            span2Click = await lines[lines.length - 3].findElement(By.css("span > span"));

            await span2Click.click();

            lastId = await DBConnection.getLastQueryResultId();

            execCaret = await DBConnection.getToolbarButton("Execute the statement at the caret position");

            await driver.wait(async () => {
                await execCaret?.click();

                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultColumnName("actor_id")).toBeDefined();

            span2Click = await lines[lines.length - 1].findElement(By.css("span > span"));

            await span2Click.click();

            lastId = await DBConnection.getLastQueryResultId();

            execCaret = await DBConnection.getToolbarButton("Execute the statement at the caret position");

            await driver.wait(async () => {
                await execCaret?.click();

                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultColumnName("category_id")).toBeDefined();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {

            const autoCommit = await DBConnection.getToolbarButton("Auto commit DB changes");
            await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommit);
            await autoCommit!.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await DBConnection.writeSQL(
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            const commitBtn = await DBConnection.getToolbarButton("Commit DB changes");

            const rollBackBtn = await DBConnection.getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            let lastId = await DBConnection.getLastQueryResultId();

            let execSelNew = await DBConnection.getToolbarButton(
                "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain("OK");

            await rollBackBtn!.click();

            await Misc.cleanPrompt();

            await DBConnection.writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await DBConnection.getLastQueryResultId();

            execSelNew = await DBConnection.getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain(
                "OK, 0 records retrieved",
            );

            await Misc.cleanPrompt();

            await DBConnection.writeSQL(
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            lastId = await DBConnection.getLastQueryResultId();

            execSelNew = await DBConnection.getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain("OK");

            await commitBtn!.click();

            await Misc.cleanPrompt();

            await DBConnection.writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await DBConnection.getLastQueryResultId();

            execSelNew = await DBConnection.getToolbarButton("Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain(
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

            await DBConnection.writeSQL(`import from xpto xpto xpto`);

            const findBtn = await DBConnection.getToolbarButton("Find");
            await findBtn!.click();

            const finder = await driver.wait(until.elementLocated(By.css(".find-widget")),
                explicitWait, "Finder was not found");

            expect(await finder.getAttribute("aria-hidden")).toBe("false");

            const textArea = await finder.findElement(By.css("textarea"));
            await driver.wait(until.elementIsVisible(textArea),
                explicitWait, "Finder textarea is not visible");

            await textArea.sendKeys("xpto");

            await DBConnection.findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).toMatch(new RegExp(/1 of (\d+)/));

            await driver.wait(
                until.elementsLocated(By.css(".cdr.findMatch")),
                2000,
                "No words found",
            );

            await DBConnection.expandFinderReplace(finder, true);

            const replacer = await finder.findElement(By.css(".replace-part"));

            await replacer.findElement(By.css("textarea")).sendKeys("tester");

            await (await DBConnection.replacerGetButton(replacer, "Replace (Enter)"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toContain("import from tester xpto xpto");

            await replacer.findElement(By.css("textarea")).clear();

            await replacer.findElement(By.css("textarea")).sendKeys("testing");

            await (await DBConnection.replacerGetButton(replacer, "Replace All"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toContain("import from tester testing testing");

            await DBConnection.closeFinder(finder);

            expect(await finder.getAttribute("aria-hidden")).toBe("true");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand Collapse schema objects", async () => {
        try {

            await DBConnection.expandCollapseMenus("open editors", false, 0);

            await DBConnection.expandCollapseMenus("scripts", false, 0);

            const sakila = await DBConnection.getSchemaObject("Schema", "sakila");

            expect(
                await (
                    await sakila!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.toggleSchemaObject("Tables", "Tables");

            const tables = await DBConnection.getSchemaObject("Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            expect(await DBConnection.getSchemaObject("obj", "actor")).toBeDefined();

            expect(await DBConnection.getSchemaObject("obj", "address")).toBeDefined();

            expect(await DBConnection.getSchemaObject("obj", "category")).toBeDefined();

            expect(await DBConnection.getSchemaObject("obj", "city")).toBeDefined();

            expect(await DBConnection.getSchemaObject("obj", "country")).toBeDefined();

            await DBConnection.toggleSchemaObject("Tables", "Tables");

            let attr = await (
                await DBConnection.getSchemaObject("Tables", "Tables")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await DBConnection.toggleSchemaObject("Views", "Views");

            expect(
                await (
                    await DBConnection.getSchemaObject("Views", "Views")
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await DBConnection.getSchemaObject("obj", "test_view")).toBeDefined();

            await DBConnection.toggleSchemaObject("Views", "Views");

            attr = await (
                await DBConnection.getSchemaObject("Views", "Views")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await DBConnection.toggleSchemaObject("Schema", "sakila");

            attr = await (
                await DBConnection.getSchemaObject("Schema", "sakila")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand_Collapse menus", async () => {
        try {

            await DBConnection.expandCollapseMenus("open editors", true, 0);

            expect(
                await driver
                    .findElement(By.id("editorSectionHost"))
                    .findElement(By.css("div.container.section"))
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus("open editors", false, 0);

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

            await DBConnection.expandCollapseMenus("open editors", true, 0);

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

            await DBConnection.expandCollapseMenus("schemas", false, 0);

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

            await DBConnection.expandCollapseMenus("schemas", true, 0);

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

            await DBConnection.expandCollapseMenus("admin", false, 0);

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

            await DBConnection.expandCollapseMenus("admin", true, 0);

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

            await DBConnection.expandCollapseMenus("scripts", false, 0);

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

            await DBConnection.expandCollapseMenus("scripts", true, 0);

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

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));
            await Misc.execCmd(textArea, "\\javascript", undefined, true);

            await Misc.execCmd(textArea, "Math.random();", undefined, true);

            const result2 = await DBConnection.getOutput();

            expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));

            await Misc.execCmd(textArea, "\\typescript", undefined, true);

            expect(await DBConnection.getOutput()).toBe("Switched to TypeScript mode");

            await Misc.execCmd(textArea, "Math.random();", undefined, true);

            const result4 = await DBConnection.getOutput();

            expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await Misc.pressEnter();

            const otherResult = await DBConnection.getOutput();

            expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));

            expect(otherResult !== result2).toBe(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await Misc.pressEnter();

            const otherResult1 = await DBConnection.getOutput();

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

            await Misc.execCmd(textArea, "SELECT VERSION();", undefined, true);

            const resultHosts = await driver.wait(until.elementsLocated(By.css(".resultHost")),
                explicitWait * 2, "Result hosts not found");

            const txt = await driver.wait(until.elementLocated(async () => {
                return resultHosts[resultHosts.length - 1].findElements(By.css(".tabulator-cell"));
            }), explicitWait * 2, "Table cell was not found");

            const server = (await txt.getAttribute("innerHTML")).match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await Misc.execCmd(textArea, `/*!${serverVer} select * from actor limit 1;*/`, undefined, true);

            expect(await DBConnection.getResultStatus(true)).toMatch(
                new RegExp(/OK, 1 record retrieved/),
            );

            const higherServer = parseInt(serverVer, 10) + 1;

            await Misc.execCmd(textArea, `/*!${higherServer} select * from actor limit 1;*/`, undefined, true);

            expect(await DBConnection.getResultStatus(true)).toContain(
                "OK, 0 records retrieved",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {

            //await DBConnection.setEditorLanguage("ts");

            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await Misc.execCmd(textArea, "\\typescript", undefined, true);

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

            await Misc.execCmd(textArea, cmd.trim(), undefined, true);

            const pieChart = await DBConnection.getGraphHost();

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

            await DBConnection.writeSQL("DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL("SELECT actor_id", true);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL("FROM ", true);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL("sakila.actor LIMIT 1 $$", true);

            expect(await DBConnection.isStatementStart("DELIMITER $$")).toBe(true);
            expect(await DBConnection.isStatementStart("SELECT actor_id")).toBe(true);
            expect(await DBConnection.isStatementStart("FROM")).toBe(false);
            expect(await DBConnection.isStatementStart("sakila.actor LIMIT 1 $$")).toBe(false);

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await DBConnection.writeSQL("select 1 $$ ");
            expect(await DBConnection.isStatementStart("select 1 $$")).toBe(true);

            const lastId = await DBConnection.getLastQueryResultId();

            const exeSelNew = await DBConnection.getToolbarButton(
                "Execute selection or full block and create a new block");
            await exeSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 10000, "No new results block was displayed");

            await driver.wait(async () => {
                return (await DBConnection.getResultTabs()).length > 0;
            }, 5000, "No results were found");

            const tabs = await DBConnection.getResultTabs();

            expect(tabs[0]).toMatch(/Result #(\d+)/);
            expect(tabs[1]).toMatch(/Result #(\d+)/);

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

            expect(await DBConnection.getOpenEditor("myNewConsole")).toBeDefined();

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

            await DBConnection.selectCurrentEditor("DB Notebook", "shell");

            await DBConnection.selectCurrentEditor("myNewConsole", "shell");

            const console = await DBConnection.getOpenEditor("myNewConsole");

            await console!.findElement(By.css("span.codicon-close")).click();

            expect(await DBConnection.getOpenEditor("myNewConsole")).toBeUndefined();

            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toContain("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
