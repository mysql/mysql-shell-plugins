/*
 * Copyright (c) 2023 Oracle and/or its affiliates.
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
import { expect } from "chai";
import {
    ActivityBar, BottomBarPanel, By, Condition, CustomTreeSection, EditorView, InputBox, Key, TreeItem,
    until, WebElement, ModalDialog,
} from "vscode-extension-tester";
import { browser, driver, Misc } from "../lib/misc";
import { Database } from "../lib/db";
import * as constants from "../lib/constants";
import { Until } from "../lib/until";
import * as interfaces from "../lib/interfaces";

describe("NOTEBOOKS", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBSHELLUSERNAME) {
        throw new Error("Please define the environment variable DBSHELLUSERNAME");
    }
    if (!process.env.DBSHELLPASSWORD) {
        throw new Error("Please define the environment variable DBSHELLPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }
    if (!process.env.SSL_ROOT_FOLDER) {
        throw new Error("Please define the environment variable SSL_ROOT_FOLDER");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {

        await Misc.loadDriver();

        try {
            await driver.wait(Until.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            expect(await Misc.existsTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel)).to.be.true;
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("DB Editor", () => {

        let clean = false;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(Database.isConnectionLoaded(),
                    constants.explicitWait * 3, "DB Connection was not loaded");
                await Database.setDBConnectionCredentials(globalConn);
                await driver.wait(until.elementLocated(By.css("textarea")), constants.explicitWait,
                    "Db editor text area was not found");
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(() => {
            clean = false;
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            if (clean) {
                await Misc.cleanEditor();
            }
        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {
                const area = await driver.findElement(By.css("textarea"));
                await Misc.writeCmd("select * from sakila.actor;");
                await area.sendKeys(Key.ENTER);
                await Misc.writeCmd("select * from sakila.address;");
                await area.sendKeys(Key.ENTER);
                await Misc.writeCmd("select * from sakila.city;");

                const getLines = async (): Promise<WebElement[]> => {
                    const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                    lines.shift();

                    return lines;
                };

                await driver.actions().keyDown(Key.ALT).perform();

                let spans = await (await getLines())[0].findElements(By.css("span"));
                await spans[spans.length - 1].click();

                spans = await (await getLines())[1].findElements(By.css("span"));
                await spans[spans.length - 1].click();
                await driver.actions().keyUp(Key.ALT).perform();

                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(500);
                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(500);
                await area.sendKeys(Key.BACK_SPACE);

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));

                let items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0].length).equals(24);
                expect(items[1].length).equals(26);
                expect(items[2].length).equals(23);

                await textArea.sendKeys("testing");

                items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0]).to.include("testing");
                expect(items[1]).to.include("testing");
                expect(items[2]).to.include("testing");
            } finally {
                clean = true;
            }
        });

        it("Using a DELIMITER", async function () {

            this.retries(1);

            await Misc.cleanEditor();
            await Misc.writeCmd("DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("SELECT actor_id", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("FROM ", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("sakila.actor LIMIT 1 $$", true);

            expect(await Database.isStatementStart("DELIMITER $$")).to.be.true;
            expect(await Database.isStatementStart("SELECT actor_id")).to.be.true;
            expect(await Database.isStatementStart("FROM")).to.be.false;
            expect(await Database.isStatementStart("sakila.actor LIMIT 1 $$")).to.be.false;

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await Misc.writeCmd("select 1 $$ ");
            expect(await Database.isStatementStart("select 1 $$")).to.be.true;

            const result = await Misc.execCmd("", constants.execFullBlockSql);

            expect(result[0]).to.include("OK");
            let tabs: WebElement[];
            await driver.wait(async () => {
                try {
                    tabs = await (result[1] as WebElement).findElements(By.css(".tabArea label"));

                    return tabs.length === 2;
                } catch (e) {
                    return false;
                }
            }, constants.explicitWait, "No result tabs were found on result");

            expect(await tabs[0].getAttribute("innerHTML")).to.include("Result");
            expect(await tabs[1].getAttribute("innerHTML")).to.include("Result");

        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

            const result = await Misc.execCmd("SELECT * FROM sakila.actor;", constants.execFullBlockSql);
            expect(result[0]).to.match(/(\d+) record/);
            expect(await Database.hasNewPrompt()).to.be.true;
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
                await driver.wait(async () => {
                    try {
                        return (await Misc.getResultColumns(result[1] as WebElement)).includes("actor_id");
                    } catch (e) {
                        return false;
                    }
                }, constants.explicitWait, "actor_id was not found");
                await textArea.sendKeys(Key.ARROW_DOWN);
                await driver.sleep(500);
                result = await Misc.execCmd("", "Execute the statement at the caret position");
                await driver.wait(async () => {
                    try {
                        return (await Misc.getResultColumns(result[1] as WebElement)).includes("address_id");
                    } catch (e) {
                        return false;
                    }
                }, constants.explicitWait, "address_id was not found");
            } finally {
                clean = true;
            }
        });

        it("Switch between search tabs", async () => {

            const result = await Misc
                .execCmd("select * from sakila.actor limit 1; select * from sakila.address limit 1;", undefined,
                    undefined, true);
            expect(await Misc.getResultTabs(result[1] as WebElement)).to.have.members(["Result #1", "Result #2"]);
            const result1 = await Misc.getResultTab(result[1] as WebElement, "Result #1");
            const result2 = await Misc.getResultTab(result[1] as WebElement, "Result #2");
            expect(result1).to.exist;
            expect(result2).to.exist;
            expect(await Misc.getResultColumns(result[1] as WebElement)).to.have.members(["actor_id",
                "first_name", "last_name", "last_update"]);
            await result2.click();
            expect(await Misc.getResultColumns(result[1] as WebElement)).to.include.members(["address_id",
                "address", "address2", "district", "city_id", "postal_code", "phone", "last_update"]);

        });

        it("Connect to database and verify default schema", async () => {

            const result = await Misc.execCmd("SELECT SCHEMA();");
            expect(result[0]).to.include("1 record retrieved");
            expect(await ((result[1] as WebElement).findElement(By.css(".tabulator-cell"))).getText())
                .to.equals((globalConn.basic as interfaces.IConnBasicMySQL).schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommitBtn = await Database.getToolbarButton(constants.autoCommit);
            const style = await autoCommitBtn.findElement(By.css(".icon")).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await Database.getToolbarButton(constants.commit);
            const rollBackBtn = await Database.getToolbarButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn),
                3000, "Commit button should be enabled");

            let result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);

            expect(result[0]).to.include("OK");

            await rollBackBtn.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK, 0 records retrieved");

            result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result[0]).to.include("OK");

            await commitBtn.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK, 1 record retrieved");

            await autoCommitBtn.click();

            await driver.wait(
                async () => {
                    const commitBtn = await Database.getToolbarButton(constants.commit);
                    const rollBackBtn = await Database.getToolbarButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.explicitWait,
                "Commit/Rollback DB changes button is still enabled ",
            );

            result = await Misc.execCmd(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK");
        });

        it("Connection toolbar buttons - Find and Replace", async () => {

            try {
                const contentHost = await driver.findElement(By.id("contentHost"));
                await Misc.writeCmd(`import from xpto xpto xpto`);
                const findBtn = await Database.getToolbarButton("Find");
                await findBtn.click();
                const finder = await driver.findElement(By.css(".find-widget"));
                expect(await finder.getAttribute("aria-hidden")).equals("false");
                await finder.findElement(By.css("textarea")).sendKeys("xpto");
                await Database.findInSelection(finder, false);
                expect(
                    await finder.findElement(By.css(".matchesCount")).getText(),
                ).to.match(/1 of (\d+)/);
                await driver.wait(
                    until.elementsLocated(By.css(".cdr.findMatch")),
                    2000,
                    "No words found",
                );
                await Database.expandFinderReplace(finder, true);
                const replacer = await finder.findElement(By.css(".replace-part"));
                await replacer.findElement(By.css("textarea")).sendKeys("tester");
                await (await Database.replacerGetButton(replacer, "Replace (Enter)")).click();
                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester xpto xpto");

                await replacer.findElement(By.css("textarea")).clear();
                await replacer.findElement(By.css("textarea")).sendKeys("testing");
                await (await Database.replacerGetButton(replacer, "Replace All")).click();
                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester testing testing");
                await Database.closeFinder(finder);
                expect(await finder.getAttribute("aria-hidden")).equals("true");

            } finally {
                clean = true;
            }

        });

        it("Using Math_random on js_py blocks", async () => {

            try {
                const textArea = await driver.findElement(By.css("textarea"));
                const result = await Misc.execCmd("\\js ");
                expect(result[0]).to.include("Switched to JavaScript mode");
                const result2 = await Misc.execCmd("Math.random();");
                expect(result2[0]).to.match(/(\d+).(\d+)/);
                expect((await Misc.execCmd("\\typescript "))[0]).equals("Switched to TypeScript mode");
                const result4 = await Misc.execCmd("Math.random();");
                expect(result4[0]).to.match(/(\d+).(\d+)/);
                await textArea.sendKeys(Key.ARROW_UP);
                await driver.sleep(500);
                await textArea.sendKeys(Key.ARROW_UP);
                await driver.sleep(500);
                await textArea.sendKeys(Key.ARROW_UP);
                await driver.sleep(500);
                await Misc.execOnEditor();
                const otherResult = await Misc.getCmdResultMsg();
                expect(otherResult).to.match(/(\d+).(\d+)/);
                expect(otherResult !== result2[0]).equals(true);
                await textArea.sendKeys(Key.ARROW_DOWN);
                await driver.sleep(500);
                await Misc.execOnEditor();
                await driver.wait(async () => {
                    try {
                        const otherResult1 = await Misc.getCmdResultMsg();
                        expect(otherResult1).to.match(/(\d+).(\d+)/);

                        return otherResult1 !== result4[0];
                    } catch (e) {
                        return false;
                    }
                }, constants.explicitWait, `Results should be different`);
            } finally {
                clean = true;
            }


        });

        it("Multi-line comments", async () => {

            let result = await Misc.execCmd("\\sql ");
            expect(result[0]).to.include("Switched to MySQL mode");
            result = await Misc.execCmd("select version();");
            expect(result[0]).to.include("1 record retrieved");
            const txt = await (result[1] as WebElement).findElement(By.css(".tabulator-cell")).getText();
            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];
            result = await Misc.execCmd(`/*!${serverVer} select * from sakila.actor;*/`, undefined, undefined, true);
            expect(result[0]).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            result = await Misc.execCmd(`/*!${higherServer} select * from sakila.actor;*/`, undefined, undefined, true);
            expect(result[0]).to.include("OK, 0 records retrieved");

        });

        it("Context Menu - Execute", async () => {

            let result = await Misc.execCmdByContextItem("select * from sakila.actor limit 1;", "Execute Block");
            expect(result[0]).to.match(/OK, (\d+) record retrieved/);
            expect(await Database.hasNewPrompt()).to.be.false;
            await Misc.cleanEditor();
            result = await Misc
                .execCmdByContextItem("select * from sakila.actor limit 1;", "Execute Block and Advance");
            expect(result[0]).to.match(/OK, (\d+) record retrieved/);
            expect(await Database.hasNewPrompt()).to.be.true;

        });

        it("Maximize and Normalize Result tab", async () => {

            const result = await Misc.execCmd("select * from sakila.actor;");
            expect(result[0]).to.include("OK");
            await driver.sleep(1000);
            await (result[2] as WebElement).findElement(By.id("toggleStateButton")).click();
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.explicitWait, "Result tab was not maxized");

            expect(await Database.getCurrentEditor()).to.equals("Result #1");
            try {
                expect(await Database.isEditorStretched()).to.be.false;
                let tabArea = await driver.findElements(By.css("#resultPaneHost .resultTabview .tabArea"));
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await driver.findElement(By.id("normalizeResultStateButton")).click();
                expect(await Database.isEditorStretched()).to.be.true;
                expect(await Database.isResultTabMaximized()).to.be.false;
                tabArea = await driver.findElements(By.css("#resultPaneHost .resultTabview .tabArea"));
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await Database.selectCurrentEditor("DB Notebook", "notebook");
            }
        });

        it("Pie Graph based on DB table", async () => {

            let result = await Misc.execCmd("\\ts ");
            expect(result[0]).to.include("Switched to TypeScript mode");
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
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
            }

        });

        it("Schema autocomplete context menu", async () => {

            try {
                const result = await Misc.execCmd("\\sql ");
                expect(result[0]).to.include("Switched to MySQL mode");
                await Misc.writeCmd("select * from ");
                const textArea = await driver.findElement(By.css("textarea"));
                await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));
                const els = await Database.getAutoCompleteMenuItems();
                expect(els).to.include("information_schema");
                expect(els).to.include("mysql");
                expect(els).to.include("performance_schema");
                expect(els).to.include("sakila");
                expect(els).to.include("sys");
                expect(els).to.include("world_x_cst");
            } finally {
                clean = true;
            }
        });

    });

    describe("Scripts", () => {

        let refItem: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                await Database.setDBConnectionCredentials(globalConn);
                await Misc.switchBackToTopFrame();
                await Misc.sectionFocus(constants.openEditorsTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await (await Misc.getActionButton(refItem, "Close Editor")).click();
        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Add SQL Script", async () => {

            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newMySQLScript, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("Mysql");
            const result = await Database.execScript("select * from sakila.actor limit 1;");
            expect(result).to.match(/OK, (\d+) record/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
            expect(refItem).to.exist;
        });

        it("Add Typescript", async () => {
            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newTS, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptTs");
            const result = await Database.execScript("Math.random()");
            expect(result).to.match(/(\d+).(\d+)/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");
            expect(refItem).to.exist;
        });

        it("Add Javascript", async () => {

            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newJS, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptJs");
            const result = await Database.execScript("Math.random()");
            expect(result).to.match(/(\d+).(\d+)/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");
            expect(refItem).to.exist;

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/test`;

        before(async function () {
            try {
                try {
                    await fs.access(`${destFile}.mysql-notebook`);
                    await fs.unlink(`${destFile}.mysql-notebook`);
                } catch (e) {
                    // continue, file does not exist
                }

                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
                await Database.setDBConnectionCredentials(globalConn);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
                await fs.unlink(`${destFile}.mysql-notebook`);
                const activityBar = new ActivityBar();
                await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Save Notebook", async () => {

            const result = await Misc.execCmd("SELECT VERSION();", undefined, constants.explicitWait * 2);
            expect(result[0]).to.include("1 record retrieved");
            await (await Database.getToolbarButton(constants.saveNotebook)).click();
            await Misc.switchBackToTopFrame();
            await Misc.setInputPath(destFile);
            await driver.wait(new Condition("", async () => {
                try {
                    await fs.access(`${destFile}.mysql-notebook`);

                    return true;
                } catch (e) {
                    return false;
                }
            }), constants.explicitWait, `File was not saved to ${process.cwd()}`);
        });

        it("Replace this Notebook with content from a file", async () => {

            await Misc.switchToFrame();
            await Misc.cleanEditor();
            await (await Database.getToolbarButton(constants.loadNotebook)).click();
            await Misc.switchBackToTopFrame();
            await Misc.setInputPath(`${destFile}.mysql-notebook`);
            await Misc.switchToFrame();
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Open the Notebook from file", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();
            await browser.openResources(process.cwd());
            await Misc.dismissNotifications();
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.explicitWait, "E2E section was not found");


            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();

            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await new EditorView().openEditor("test.mysql-notebook");

            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Open the Notebook from file with connection", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();
            await browser.openResources(process.cwd());
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.explicitWait, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await Misc.openContextMenuItem(file, constants.openNotebookWithConn, constants.checkInput);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await new EditorView().openEditor("test.mysql-notebook");
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeEditor("test.mysql-notebook");

            // The file may be dirty
            try {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Don't Save`);
            } catch (e) {
                // continue
            }

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.explicitWait, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            await Misc.switchBackToTopFrame();
            await new EditorView().openEditor("test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            await Misc.deleteConnection(globalConn.caption);
            const tabs = await new EditorView().getOpenEditorTitles();
            expect(tabs).to.not.include("test.mysql-notebook");
        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await Misc.getTreeDBConnections();

            for (const conn of conns) {
                await Misc.deleteConnection(conn);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.explicitWait, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await new EditorView().openEditor("test.mysql-notebook");
            await Misc.getNotification("Please create a MySQL Database Connection first.");
            await Misc.switchToFrame();
            expect(await driver.findElement(By.css("h2")).getText()).to.equals("No connection selected");

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();

            await Misc.openContextMenuItem(file, constants.openNotebookWithConn, constants.checkNotif);
            await Misc.getNotification("Please create a MySQL Database Connection first.");
        });

    });

});
