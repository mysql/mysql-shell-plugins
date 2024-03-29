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

import fs from "fs/promises";
import { join, basename } from "path";
import { By, Condition, Key, error, until } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import {
    DBNotebooks,
    autoCommit,
    commit,
    execCaret,
    execFullBlockSql,
    find,
    rollback,
    saveNotebook,
} from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, driver, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";

describe("Notebook", () => {

    let testFailed = false;
    let notebook = "";

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `connNotebooks`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser2",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser2",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            const filename = basename(__filename);
            await driver.wait(async () => {
                try {
                    const url = Misc.getUrl(basename(filename));
                    console.log(`${filename} : ${url}`);
                    await Misc.loadPage(url);
                    await Misc.waitForHomePage();
                    await driver.findElement(By.id("gui.sqleditor")).click();

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 3, "Start Page was not loaded correctly");
            const db = await DBNotebooks.createDBconnection(globalConn);
            try {
                await driver.executeScript("arguments[0].click();", db);
                await Misc.setPassword(globalConn);
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("dialog was found") === -1) {
                        throw e;
                    }
                }
            }
            await driver.wait(until.elementLocated(By.id("dbEditorToolbar")),
                explicitWait * 2, "Notebook was not loaded");
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Notebook");
            throw e;
        }
        await driver.wait(until.elementLocated(By.id("dbEditorToolbar")), explicitWait * 2, "Notebook was not loaded");

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
        await DBConnection.openNewNotebook();
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
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
                await DBConnection.getToolbarButton(execFullBlockSql))!.click();

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
                await result1?.click();

                return DBConnection.getResultColumnName("actor_id");
            }, explicitWait, "actor_id column was not found");

            await driver.wait(async () => {
                await result2!.click();

                return DBConnection.getResultColumnName("address_id");
            }, explicitWait, "address_id column was not found");

            await driver.wait(async () => {
                await result1?.click();

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
                execFullBlockSql);
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

            await textArea.sendKeys(Key.ARROW_UP);
            await driver.sleep(500);

            let execCaretBtn = await DBConnection.getToolbarButton(execCaret);
            await execCaretBtn?.click();
            await driver.wait(async () => {
                await execCaretBtn?.click();

                return DBConnection.getResultColumnName("address_id") !== undefined;
            }, 3000, "No new results block was displayed");

            await textArea.sendKeys(Key.ARROW_UP);
            await driver.sleep(500);

            execCaretBtn = await DBConnection.getToolbarButton(execCaret);

            await driver.wait(new Condition("", async () => {
                await execCaretBtn?.click();

                return await DBConnection.getResultColumnName("actor_id") !== undefined;
            }), explicitWait, "actor_id column was not found");

            await textArea.sendKeys(Key.ARROW_DOWN);
            await driver.sleep(500);
            await textArea.sendKeys(Key.ARROW_DOWN);
            await driver.sleep(500);

            execCaretBtn = await DBConnection.getToolbarButton(execCaret);

            await driver.wait(new Condition("", async () => {
                await execCaretBtn?.click();

                return await DBConnection.getResultColumnName("category_id") !== undefined;
            }), explicitWait, "category_id column was not found");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {

            const autoCommitBtn = await DBConnection.getToolbarButton(autoCommit);
            await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommitBtn);
            await autoCommitBtn!.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await DBConnection.writeSQL(
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            const commitBtn = await DBConnection.getToolbarButton(commit);

            const rollBackBtn = await DBConnection.getToolbarButton(rollback);

            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            let lastId = await DBConnection.getLastQueryResultId();

            let execSelNew = await DBConnection.getToolbarButton(
                execFullBlockSql);
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain("OK");

            await rollBackBtn!.click();

            await Misc.cleanPrompt();

            await DBConnection.writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await DBConnection.getLastQueryResultId();

            execSelNew = await DBConnection.getToolbarButton(execFullBlockSql);
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

            execSelNew = await DBConnection.getToolbarButton(execFullBlockSql);
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain("OK");

            await commitBtn!.click();

            await Misc.cleanPrompt();

            await DBConnection.writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

            lastId = await DBConnection.getLastQueryResultId();

            execSelNew = await DBConnection.getToolbarButton(execFullBlockSql);
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(true)).toContain(
                "OK, 1 record retrieved",
            );

            await driver.executeScript("arguments[0].scrollIntoView()", autoCommitBtn);
            await autoCommitBtn!.click();

            await driver.wait(
                async () => {
                    const commitBtn = await DBConnection.getToolbarButton(commit);
                    const rollBackBtn = await DBConnection.getToolbarButton(rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                explicitWait,
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

            const findBtn = await DBConnection.getToolbarButton(find);
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

            await DBConnection.closeFinder();

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

            await driver.wait(async () => {
                try {
                    const treeToggle = await tables!.findElement(By.css("span.treeToggle"));

                    return ((await treeToggle.getAttribute("class")).includes("expanded"));
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError)) {
                        throw e;
                    }
                }
            }, explicitWait * 2, "Tables tree was not expaned");

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

            await Misc.pressEnter();

            await driver.wait(new Condition("", async () => {
                const otherResult1 = await DBConnection.getOutput();
                try {
                    expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));

                    return otherResult1 !== result4;
                } catch (e) {
                    // continue
                }
            }), explicitWait, "results should be different");

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

            await DBConnection.clickAdminItem("Server Status");
            await driver.wait(async () => {
                return (await DBConnection.getCurrentEditor()) === "Server Status";
            }, explicitWait, "Current Editor is not Server Status");

            const tableItems = await driver.findElements(By.css("#statusBoxHost .gridCell"));
            let server = "";
            for (let i = 0; i <= tableItems.length - 1; i++) {
                if ((await tableItems[i].getText()) === "Version:") {
                    server = (await tableItems[i + 1].getText()).match(/(\d+).(\d+).(\d+)/g)![0];
                    break;
                }
            }

            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await DBConnection.openNewNotebook();

            const contentHost = await driver.wait(until.elementLocated(By.id("contentHost")),
                explicitWait, "Content host not found");
            const textArea = await contentHost.findElement(By.css("textarea"));
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

            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await Misc.execCmd(textArea, "\\typescript", undefined, true);

            const cmd = `
const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
const options: IGraphOptions = {
    series: [
        {
            type: "bar",
            yLabel: "Actors",
            data: res as IJsonGraphData,
        }
    ]
};
Graph.render(options);
`;

            await Misc.execCmd(textArea, cmd.trim(), undefined, true, false);

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
                execFullBlockSql);
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
                    .findElement(By.css("#documentSelector .icon"))
                    .getAttribute("style"),
            ).toContain("notebook");

            await driver
                .findElement(By.id("contentHost"))
                .findElement(By.css("textarea"))
                .sendKeys("select actor from actor");

            await DBConnection.selectCurrentEditor("DB Notebook", "notebook");

            await DBConnection.selectCurrentEditor("myNewConsole", "notebook");

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

    it("Schema autocomplete context menu", async () => {

        await DBConnection.writeSQL("select * from ");

        const textArea = await driver.findElement(By.css("textarea"));

        await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));

        const els = await DBNotebooks.getAutoCompleteMenuItems();

        expect(els).toContain("information_schema");
        expect(els).toContain("mysql");
        expect(els).toContain("performance_schema");
        expect(els).toContain("sakila");
        expect(els).toContain("sys");
        expect(els).toContain("world_x_cst");

    });

    it("Save the notebook", async () => {

        const saveNotebookBtn = await DBConnection.getToolbarButton(saveNotebook);
        await saveNotebookBtn?.click();

        const outDir = process.env.USERPROFILE ?? process.env.HOME;
        await driver.wait(async () => {
            const files = await fs.readdir(String(outDir));
            for (const file of files) {
                if (file.includes(".mysql-notebook")) {
                    notebook = join(String(outDir), file);
                    try {
                        const file = await fs.readFile(notebook);
                        JSON.parse(file.toString());
                    } catch (e) {
                        // continue
                    }

                    return true;
                }
            }
        }, explicitWait, `The notebook was not correctly saved on ${String(outDir)}`);

        try {
            const jsonResult = JSON.parse((await fs.readFile(notebook)).toString());
            expect(jsonResult.type).toBe("MySQLNotebook");
            expect(jsonResult.version).toMatch(/(\d+).(\d+)/);
        } finally {
            await fs.unlink(notebook);
        }
    });

    it("Valid and invalid json", async () => {
        const textArea = await driver.findElement(By.css("textarea"));
        await Misc.execCmd(textArea, "\\typescript", undefined, true);
        await Misc.execCmd(textArea, `print('{"a": "b"}')`, undefined);
        await driver.wait(async () => {
            return ShellSession.isJSON();
        }, explicitWait, "Result is not a valid json");

        const zoneHosts = await driver.findElements(By.css(".zoneHost"));
        const outputHost = await zoneHosts[zoneHosts.length - 1].findElement(By.className("outputHost"));
        const rect = await outputHost.getRect();
        await driver.actions().move({
            x: rect.x,
            y: rect.y,
        }).perform();

        await zoneHosts[zoneHosts.length - 1].findElement(By.css(".copyButton"));

        await Misc.execCmd(textArea, `print('{ a: b }')`, undefined);
        await ShellSession.waitForResult("{ a: b }");
        await driver.wait(async () => {
            return !(await ShellSession.isJSON());
        }, explicitWait, "Result should not be a valid json");
    });

});
