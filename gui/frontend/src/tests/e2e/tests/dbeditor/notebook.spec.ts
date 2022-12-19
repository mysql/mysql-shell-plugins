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

import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { By, until, Key, WebElement, error } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks } from "../../lib/dbNotebooks";

describe("Notebook", () => {

    let testFailed = false;
    let clearEditor = false;

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

            await driver.wait(until.elementLocated(By.css("#appHostPaneHost .codeEditor.focused")),
                explicitWait, "Code Editor was not found or is not interactable");
        } catch (e) {
            if (!String(e).includes("dialog was found")) {
                throw e;
            }

        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.processFailure();
        }
        if (clearEditor) {
            clearEditor = false;
            await Misc.cleanPrompt();
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Multi-cursor", async () => {
        try {

            await Misc.writeCmd("select * from sakila.actor;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await Misc.writeCmd("select * from sakila.address;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await Misc.writeCmd("select * from sakila.city;");

            await driver.actions().keyDown(Key.ALT).perform();

            const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
            lines.shift();
            let spans = await lines[0].findElements(By.css("span"));
            await spans[spans.length - 1].click();

            spans = await lines[1].findElements(By.css("span"));
            await spans[spans.length - 1].click();
            await driver.actions().keyUp(Key.ALT).perform();

            await driver.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver.sleep(500);
            await driver.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver.sleep(500);
            await driver.actions().sendKeys(Key.BACK_SPACE).perform();

            const contentHost = await driver.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            let items = (await textArea.getAttribute("value")).split("\n");
            items.shift();
            expect(items[0].length).toBe(24);
            expect(items[1].length).toBe(26);
            expect(items[2].length).toBe(23);

            await textArea.sendKeys("testing");

            items = (await textArea.getAttribute("value")).split("\n");
            items.shift();
            expect(items[0]).toContain("testing");
            expect(items[1]).toContain("testing");
            expect(items[2]).toContain("testing");

        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            clearEditor = true;
        }
    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {

            try {
                const result = await Misc.execCmd("select * from actor limit 1;",
                    "Execute selection or full block and create a new block", explicitWait*4);

                expect(result[0]).toMatch(/(\d+) record/);
                expect(await DBConnection.hasNewPrompt()).toBe(true);
            } catch (e) {
                if (e instanceof error.TimeoutError) {
                    await Misc.cleanPrompt();
                    const result = await Misc.execCmd("select * from actor limit 1;",
                        "Execute selection or full block and create a new block", explicitWait*4);

                    expect(result[0]).toMatch(/(\d+) record/);
                    expect(await DBConnection.hasNewPrompt()).toBe(true);
                } else {
                    throw e;
                }
            }

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context Menu - Execute", async () => {
        try {

            let result = await Misc.execCmdByContextItem("select * from actor limit 1", "Execute Block");

            expect(result[0]).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt()).toBe(false);

            await Misc.cleanPrompt();

            result = await Misc.execCmdByContextItem("select * from actor limit 1", "Execute Block and Advance");

            expect(result[0]).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt()).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {

        try {
            const result = await Misc
                .execCmd("select * from sakila.actor limit 1; select * from sakila.address limit 1;",
                    undefined, undefined, true);

            expect(await Misc.getResultTabs(result[1] as WebElement))
                .toEqual(expect.arrayContaining(["Result #1", "Result #2"]));

            const result1 = await Misc.getResultTab(result[1] as WebElement, "Result #1");
            const result2 = await Misc.getResultTab(result[1] as WebElement, "Result #2");

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();

            expect(await Misc.getResultColumns(result[1] as WebElement)).toEqual(expect.arrayContaining(["actor_id",
                "first_name", "last_name", "last_update"]));

            await result2!.click();

            expect(await Misc.getResultColumns(result[1] as WebElement)).toEqual(expect.arrayContaining(["address_id",
                "address", "address2", "district", "city_id", "postal_code", "phone", "last_update"]));

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify default schema", async () => {
        try {
            const result = await Misc.execCmd("SELECT SCHEMA();");
            expect(result[0]).toContain("1 record retrieved");

            expect(await ((result[1] as WebElement).findElement(By.css(".tabulator-cell"))).getText())
                .toContain(globalConn.schema);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));
            await Misc.writeCmd("select * from sakila.actor limit 1;", true);
            await textArea.sendKeys(Key.RETURN);

            await Misc.writeCmd("select * from sakila.address limit 2;");
            await textArea.sendKeys(Key.RETURN);

            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_LEFT);

            let result = await Misc.execCmd("", "Execute the statement at the caret position");

            expect(await Misc.getResultColumns(result[1] as WebElement)).toContain("actor_id");

            await textArea.sendKeys(Key.ARROW_DOWN);
            await driver.sleep(500);

            result = await Misc.execCmd("", "Execute the statement at the caret position");

            expect(await Misc.getResultColumns(result[1] as WebElement)).toContain("address_id");

        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            clearEditor = true;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {

            const autoCommit = await DBConnection.getToolbarButton("Auto commit DB changes");
            const style = await autoCommit?.findElement(By.css("div")).getAttribute("style");
            if (style?.includes("toolbar-auto_commit-active")) {
                await autoCommit?.click();
            }

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await DBConnection.getToolbarButton("Commit DB changes");
            const rollBackBtn = await DBConnection.getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn as WebElement),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn as WebElement),
                3000, "Commit button should be enabled");

            let result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            expect(result[0]).toContain("OK");

            await rollBackBtn!.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name='${random}';`);
            expect(result[0]).toContain("OK, 0 records retrieved");

            result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);
            expect(result[0]).toContain("OK");

            await commitBtn!.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name='${random}';`);
            expect(result[0]).toContain("OK, 1 record retrieved");

            await autoCommit!.click();

            await driver.wait(
                async () => {
                    return (
                        (await commitBtn!.isEnabled()) === false &&
                        (await rollBackBtn!.isEnabled()) === false
                    );
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

            await Misc.writeCmd(`import from xpto xpto xpto`);

            const findBtn = await DBConnection.getToolbarButton("Find");
            await findBtn!.click();

            const finder = await driver.findElement(By.css(".find-widget"));

            expect(await finder.getAttribute("aria-hidden")).toBe("false");

            await driver.wait(async () => {
                try {
                    await finder.findElement(By.css("textarea")).sendKeys("xpto");

                    return true;
                } catch (e) {
                    if (e instanceof error.ElementNotInteractableError) {
                        return false;
                    } else {
                        throw e;
                    }
                }
            }, explicitWait, "Finder text box was not interactable");

            await DBConnection.findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).toMatch(/1 of (\d+)/);

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
        } finally {
            clearEditor = true;
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
            const textArea = await driver.findElement(By.css("textarea"));
            const result = await Misc.execCmd("\\js ");
            expect(result[0]).toContain("Switched to JavaScript mode");

            const result2 = await Misc.execCmd("Math.random();");
            expect(result2[0]).toMatch(/(\d+).(\d+)/);

            expect((await Misc.execCmd("\\typescript "))[0]).toBe("Switched to TypeScript mode");

            const result4 = await Misc.execCmd("Math.random();");

            expect(result4[0]).toMatch(/(\d+).(\d+)/);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(500);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(500);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(500);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(500);

            await Misc.execOnEditor();

            const otherResult = await Misc.getCmdResultMsg();

            expect(otherResult).toMatch(/(\d+).(\d+)/);

            expect(otherResult !== result2[0]).toBe(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await Misc.execOnEditor();

            const otherResult1 = await Misc.getCmdResultMsg();

            expect(otherResult1).toMatch(/(\d+).(\d+)/);

            expect(otherResult1 !== result4[0]).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            clearEditor = true;
        }
    });

    it("Multi-line comments", async () => {
        try {

            let result = await Misc.execCmd("\\sql ");
            expect(result[0]).toContain("Switched to MySQL mode");

            result =  await Misc.execCmd("SELECT VERSION();");
            expect(result[0]).toContain("1 record retrieved");

            const txt = await (result[1] as WebElement).findElement(By.css(".tabulator-cell")).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            result = await Misc.execCmd(`/*!${serverVer} select * from actor;*/`);

            expect(result[0]).toMatch(/OK, (\d+) records retrieved/);

            const higherServer = parseInt(serverVer, 10) + 1;

            result = await Misc.execCmd(`/*!${higherServer} select * from actor;*/`);

            expect(result[0]).toContain("OK, 0 records retrieved");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {

            let  result = await Misc.execCmd("\\ts ");
            expect(result[0]).toContain("Switched to TypeScript mode");

            result = await Misc.execCmd(`
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
                }`);

            const pieChart = await (result[1] as WebElement).findElement(By.css(".graphHost"));

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

            let result = await Misc.execCmd("\\sql ");
            expect(result[0]).toContain("Switched to MySQL mode");

            await Misc.writeCmd("DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("select actor_id ", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("from ");
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("sakila.actor limit 1 $$ ");

            expect(await DBConnection.isStatementStart("DELIMITER $$")).toBe(true);
            expect(await DBConnection.isStatementStart("select actor_id")).toBe(true);
            expect(await DBConnection.isStatementStart("from")).toBe(false);
            expect(await DBConnection.isStatementStart("sakila.actor limit 1 $$")).toBe(false);

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await Misc.writeCmd("select 1 $$ ");
            expect(await DBConnection.isStatementStart("select 1 $$")).toBe(true);

            result = await Misc
                .execCmd("", "Execute selection or full block and create a new block");

            expect(result[0]).toContain("OK");
            let tabs: WebElement[] | undefined;
            await driver.wait(async () => {
                tabs = await (result[1] as WebElement).findElements(By.css(".tabArea label"));

                return tabs.length === 2;
            }, explicitWait, "Result content should contain tabs");

            expect(await tabs![0].getAttribute("innerHTML")).toContain("Result");
            expect(await tabs![1].getAttribute("innerHTML")).toContain("Result");
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
