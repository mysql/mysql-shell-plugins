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
import { By, Condition, Key, error, until, WebDriver } from "selenium-webdriver";
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
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

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
        driver = await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(By.id("gui.sqleditor")).click();
            const db = await DBNotebooks.createDBconnection(driver, globalConn);
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(driver, globalConn);
            await Misc.setConfirmDialog(driver, globalConn, "no");
            await driver.wait(until.elementLocated(By.id("dbEditorToolbar")),
                explicitWait * 2, "Notebook was not loaded");
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_Notebook");
            throw e;
        }
        await driver.wait(until.elementLocated(By.id("dbEditorToolbar")), explicitWait * 2, "Notebook was not loaded");

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot(driver);
        }
        await DBConnection.openNewNotebook(driver);
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });


    testFailed = false;


    it("Multi-cursor", async () => {
        try {
            await DBConnection.writeSQL(driver, "hello 1", true);
            await driver.actions().sendKeys(Key.ENTER).perform();
            await DBConnection.writeSQL(driver, "hello 2");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await DBConnection.writeSQL(driver, "hello 3");

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

            expect(await Misc.getPromptTextLine(driver, "last-2")).toContain("testing");
            expect(await Misc.getPromptTextLine(driver, "last-1")).toContain("testing");
            expect(await Misc.getPromptTextLine(driver, "last")).toContain("testing");

        } catch (e) {
            testFailed = true;
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            throw e;
        }
    });

    it("Context Menu - Execute", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));
            await Misc.execCmd(driver, textArea, "select version();", 20000, true);
            await DBConnection.writeSQL(driver, "select * from actor limit 1");
            let lastId = await DBConnection.getLastQueryResultId(driver);
            await DBConnection.clickContextItem(driver, "Execute Block");
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(driver, true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );
            expect(await DBConnection.hasNewPrompt(driver)).toBe(false);
            lastId = await DBConnection.getLastQueryResultId(driver);

            await DBConnection.clickContextItem(driver, "Execute Block and Advance");
            expect(await DBConnection.getResultStatus(driver, true)).toMatch(
                new RegExp(/OK, (\d+) record retrieved/),
            );
            expect(await DBConnection.hasNewPrompt(driver)).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {

            await DBConnection.writeSQL(driver, "select * from actor limit 1; select * from address limit 1;", true);
            const lastId = await DBConnection.getLastQueryResultId(driver);
            await (
                await DBConnection.getToolbarButton(driver, execFullBlockSql))!.click();
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 10000, "No new results block was displayed");
            const result1 = await driver.wait(async () => {
                return DBConnection.getResultTab(driver, "Result #1");
            }, 5000, "No results were found");

            const result2 = await DBConnection.getResultTab(driver, "Result #2");
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            await driver.wait(async () => {
                await result1?.click();

                return DBConnection.getResultColumnName(driver, "actor_id");
            }, explicitWait, "actor_id column was not found");

            await driver.wait(async () => {
                await result2!.click();

                return DBConnection.getResultColumnName(driver, "address_id");
            }, explicitWait, "address_id column was not found");

            await driver.wait(async () => {
                await result1?.click();

                return DBConnection.getResultColumnName(driver, "actor_id");
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
            await DBConnection.writeSQL(driver, "select * from actor limit 1");
            const lastId = await DBConnection.getLastQueryResultId(driver);
            const exeSelNew = await DBConnection.getToolbarButton(driver,
                execFullBlockSql);
            await exeSelNew?.click();
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 10000, "No new results block was displayed");
            expect(await DBConnection.getResultColumnName(driver, "actor_id")).toBeDefined();
            expect(await DBConnection.getResultColumnName(driver, "first_name")).toBeDefined();
            expect(await DBConnection.getResultColumnName(driver, "last_name")).toBeDefined();
            expect(await DBConnection.getResultColumnName(driver, "last_update")).toBeDefined();
            expect(await DBConnection.hasNewPrompt(driver)).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {
            const query1 = "select * from actor limit 1;";
            const query2 = "select * from address limit 1;";
            const query3 = "select * from category limit 1;";

            const textArea = await driver.findElement(By.css("textarea"));
            await DBConnection.writeSQL(driver, query1);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL(driver, query2);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL(driver, query3);
            await DBNotebooks.setMouseCursorAt(driver, query2);

            let execCaretBtn = await DBConnection.getToolbarButton(driver, execCaret);
            await execCaretBtn?.click();
            await driver.wait(async () => {
                await execCaretBtn?.click();

                return DBConnection.getResultColumnName(driver, "address_id") !== undefined;
            }, 3000, "No new results block was displayed");

            await DBNotebooks.setMouseCursorAt(driver, query1);
            execCaretBtn = await DBConnection.getToolbarButton(driver, execCaret);
            await driver.wait(new Condition("", async () => {
                await execCaretBtn?.click();

                return await DBConnection.getResultColumnName(driver, "actor_id") !== undefined;
            }), explicitWait, "actor_id column was not found");

            await DBNotebooks.setMouseCursorAt(driver, query3);
            execCaretBtn = await DBConnection.getToolbarButton(driver, execCaret);
            await driver.wait(new Condition("", async () => {
                await execCaretBtn?.click();

                return await DBConnection.getResultColumnName(driver, "category_id") !== undefined;
            }), explicitWait, "category_id column was not found");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {
            const autoCommitBtn = await DBConnection.getToolbarButton(driver, autoCommit);
            await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommitBtn);
            await autoCommitBtn!.click();
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            await DBConnection.writeSQL(driver,
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            const commitBtn = await DBConnection.getToolbarButton(driver, commit);
            const rollBackBtn = await DBConnection.getToolbarButton(driver, rollback);
            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");
            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            let lastId = await DBConnection.getLastQueryResultId(driver);
            let execSelNew = await DBConnection.getToolbarButton(driver,
                execFullBlockSql);
            await execSelNew?.click();
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(driver, true)).toContain("OK");
            await rollBackBtn!.click();
            await Misc.cleanPrompt(driver);
            await DBConnection.writeSQL(driver, `SELECT * FROM actor WHERE first_name='${random}';`);
            lastId = await DBConnection.getLastQueryResultId(driver);
            execSelNew = await DBConnection.getToolbarButton(driver, execFullBlockSql);
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(driver, true)).toContain(
                "OK, 0 records retrieved",
            );

            await Misc.cleanPrompt(driver);
            await DBConnection.writeSQL(driver,
                `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

            lastId = await DBConnection.getLastQueryResultId(driver);
            execSelNew = await DBConnection.getToolbarButton(driver, execFullBlockSql);
            await execSelNew?.click();

            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(driver, true)).toContain("OK");
            await commitBtn!.click();
            await Misc.cleanPrompt(driver);
            await DBConnection.writeSQL(driver, `SELECT * FROM actor WHERE first_name='${random}';`);
            lastId = await DBConnection.getLastQueryResultId(driver);
            execSelNew = await DBConnection.getToolbarButton(driver, execFullBlockSql);
            await execSelNew?.click();
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await DBConnection.getResultStatus(driver, true)).toContain(
                "OK, 1 record retrieved",
            );

            await driver.executeScript("arguments[0].scrollIntoView()", autoCommitBtn);
            await autoCommitBtn!.click();

            await driver.wait(
                async () => {
                    const commitBtn = await DBConnection.getToolbarButton(driver, commit);
                    const rollBackBtn = await DBConnection.getToolbarButton(driver, rollback);

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
            await DBConnection.writeSQL(driver, `import from xpto xpto xpto`);
            const findBtn = await DBConnection.getToolbarButton(driver, find);
            await findBtn!.click();
            const finder = await driver.wait(until.elementLocated(By.css(".find-widget")),
                explicitWait, "Finder was not found");
            expect(await finder.getAttribute("aria-hidden")).toBe("false");
            const textArea = await finder.findElement(By.css("textarea"));
            await driver.wait(until.elementIsVisible(textArea),
                explicitWait, "Finder textarea is not visible");
            await textArea.sendKeys("xpto");
            await DBConnection.findInSelection(driver, finder, false);
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

            await DBConnection.closeFinder(driver);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand Collapse schema objects", async () => {
        try {

            await DBConnection.expandCollapseMenus(driver, "open editors", false, 0);
            await DBConnection.expandCollapseMenus(driver, "scripts", false, 0);
            const sakila = await DBConnection.getSchemaObject(driver, "Schema", "sakila");
            expect(
                await (
                    await sakila!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.toggleSchemaObject(driver, "Tables", "Tables");
            const tables = await DBConnection.getSchemaObject(driver, "Tables", "Tables");

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

            expect(await DBConnection.getSchemaObject(driver, "obj", "actor")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "address")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "category")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "city")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "country")).toBeDefined();
            await DBConnection.toggleSchemaObject(driver, "Tables", "Tables");

            let attr = await (
                await DBConnection.getSchemaObject(driver, "Tables", "Tables")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await DBConnection.toggleSchemaObject(driver, "Views", "Views");
            expect(
                await (
                    await DBConnection.getSchemaObject(driver, "Views", "Views")
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await DBConnection.getSchemaObject(driver, "obj", "test_view")).toBeDefined();
            await DBConnection.toggleSchemaObject(driver, "Views", "Views");
            attr = await (
                await DBConnection.getSchemaObject(driver, "Views", "Views")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await DBConnection.toggleSchemaObject(driver, "Schema", "sakila");
            attr = await (
                await DBConnection.getSchemaObject(driver, "Schema", "sakila")
            )!.getAttribute("class");
            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand_Collapse menus", async () => {
        try {

            await DBConnection.expandCollapseMenus(driver, "open editors", true, 0);
            expect(
                await driver
                    .findElement(By.id("editorSectionHost"))
                    .findElement(By.css("div.container.section"))
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus(driver, "open editors", false, 0);
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

            await DBConnection.expandCollapseMenus(driver, "open editors", true, 0);

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

            await DBConnection.expandCollapseMenus(driver, "schemas", false, 0);

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

            await DBConnection.expandCollapseMenus(driver, "schemas", true, 0);

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

            await DBConnection.expandCollapseMenus(driver, "admin", false, 0);

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

            await DBConnection.expandCollapseMenus(driver, "admin", true, 0);

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

            await DBConnection.expandCollapseMenus(driver, "scripts", false, 0);

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

            await DBConnection.expandCollapseMenus(driver, "scripts", true, 0);

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
            await Misc.execCmd(driver, textArea, "\\javascript", undefined, true);
            await Misc.execCmd(driver, textArea, "Math.random();", undefined, true);
            const result2 = await DBConnection.getOutput(driver);
            expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));
            await Misc.execCmd(driver, textArea, "\\typescript", undefined, true);
            await Misc.execCmd(driver, textArea, "Math.random();", undefined, true);
            const result4 = await DBConnection.getOutput(driver);
            expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));
            await textArea.sendKeys(Key.ARROW_UP);
            await driver.sleep(300);
            await textArea.sendKeys(Key.ARROW_UP);
            await driver.sleep(300);
            await textArea.sendKeys(Key.ARROW_UP);
            await driver.sleep(300);
            await Misc.pressEnter(driver);

            const otherResult = await DBConnection.getOutput(driver);
            expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));
            expect(otherResult !== result2).toBe(true);
            await textArea.sendKeys(Key.ARROW_DOWN);
            await Misc.pressEnter(driver);
            await driver.wait(new Condition("", async () => {
                const otherResult1 = await DBConnection.getOutput(driver);
                try {
                    expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));

                    return otherResult1 !== result4;
                } catch (e) {
                    // continue
                }
            }), explicitWait, "results should be different");
            const otherResult1 = await DBConnection.getOutput(driver);
            expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));
            expect(otherResult1 !== result4).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Multi-line comments", async () => {
        try {

            await DBConnection.clickAdminItem(driver, "Server Status");
            await driver.wait(async () => {
                return (await DBConnection.getCurrentEditor(driver)) === "Server Status";
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

            await DBConnection.openNewNotebook(driver);
            const contentHost = await driver.wait(until.elementLocated(By.id("contentHost")),
                explicitWait, "Content host not found");
            const textArea = await contentHost.findElement(By.css("textarea"));
            await Misc.execCmd(driver, textArea, `/*!${serverVer} select * from actor limit 1;*/`, undefined, true);

            expect(await DBConnection.getResultStatus(driver, true)).toMatch(
                new RegExp(/OK, 1 record retrieved/),
            );

            const higherServer = parseInt(serverVer, 10) + 1;
            await Misc.execCmd(driver, textArea, `/*!${higherServer} select * from actor limit 1;*/`, undefined, true);
            expect(await DBConnection.getResultStatus(driver, true)).toContain(
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
            await Misc.execCmd(driver, textArea, "\\typescript", undefined, true);

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

            await Misc.execCmd(driver, textArea, cmd.trim(), undefined, true, false);
            const pieChart = await DBConnection.getGraphHost(driver);
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

            await DBConnection.writeSQL(driver, "DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL(driver, "SELECT actor_id", true);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL(driver, "FROM ", true);
            await textArea.sendKeys(Key.RETURN);
            await DBConnection.writeSQL(driver, "sakila.actor LIMIT 1 $$", true);

            expect(await DBConnection.isStatementStart(driver, "DELIMITER $$")).toBe(true);
            expect(await DBConnection.isStatementStart(driver, "SELECT actor_id")).toBe(true);
            expect(await DBConnection.isStatementStart(driver, "FROM")).toBe(false);
            expect(await DBConnection.isStatementStart(driver, "sakila.actor LIMIT 1 $$")).toBe(false);

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await DBConnection.writeSQL(driver, "select 1 $$ ");
            expect(await DBConnection.isStatementStart(driver, "select 1 $$")).toBe(true);
            const lastId = await DBConnection.getLastQueryResultId(driver);
            const exeSelNew = await DBConnection.getToolbarButton(driver,
                execFullBlockSql);
            await exeSelNew?.click();
            await driver.wait(async () => {
                return (await DBConnection.getLastQueryResultId(driver)) > lastId;
            }, 10000, "No new results block was displayed");

            await driver.wait(async () => {
                return (await DBConnection.getResultTabs(driver)).length > 0;
            }, 5000, "No results were found");

            const tabs = await DBConnection.getResultTabs(driver);
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
            expect(await DBConnection.getOpenEditor(driver, "myNewConsole")).toBeDefined();
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

            await DBConnection.selectCurrentEditor(driver, "DB Notebook", "notebook");
            await DBConnection.selectCurrentEditor(driver, "myNewConsole", "notebook");
            const console = await DBConnection.getOpenEditor(driver, "myNewConsole");
            await console!.findElement(By.css("span.codicon-close")).click();
            expect(await DBConnection.getOpenEditor(driver, "myNewConsole")).toBeUndefined();
            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toContain("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Schema autocomplete context menu", async () => {
        try {
            await DBConnection.writeSQL(driver, "select * from ");
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));
            const els = await DBNotebooks.getAutoCompleteMenuItems(driver);
            expect(els).toContain("information_schema");
            expect(els).toContain("mysql");
            expect(els).toContain("performance_schema");
            expect(els).toContain("sakila");
            expect(els).toContain("sys");
            expect(els).toContain("world_x_cst");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Save the notebook", async () => {
        try {
            const saveNotebookBtn = await DBConnection.getToolbarButton(driver, saveNotebook);
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

            const jsonResult = JSON.parse((await fs.readFile(notebook)).toString());
            expect(jsonResult.type).toBe("MySQLNotebook");
            expect(jsonResult.version).toMatch(/(\d+).(\d+)/);
            await fs.unlink(notebook).catch(() => {
                // continue
            });
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Valid and invalid json", async () => {
        try {
            const textArea = await driver.findElement(By.css("textarea"));
            await Misc.execCmd(driver, textArea, "\\typescript", undefined, true);
            await Misc.execCmd(driver, textArea, `print('{"a": "b"}')`, undefined);
            await driver.wait(async () => {
                return ShellSession.isJSON(driver);
            }, explicitWait, "Result is not a valid json");

            const zoneHosts = await driver.findElements(By.css(".zoneHost"));
            const outputHost = await zoneHosts[zoneHosts.length - 1].findElement(By.className("outputHost"));
            const rect = await outputHost.getRect();
            await driver.actions().move({
                x: rect.x,
                y: rect.y,
            }).perform();

            await zoneHosts[zoneHosts.length - 1].findElement(By.css(".copyButton"));

            await Misc.execCmd(driver, textArea, `print('{ a: b }')`, undefined);
            await ShellSession.waitForResult(driver, "{ a: b }");
            await driver.wait(async () => {
                return !(await ShellSession.isJSON(driver));
            }, explicitWait, "Result should not be a valid json");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

});
