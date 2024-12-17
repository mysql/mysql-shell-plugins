/*
 * Copyright (c) 2023, 2024 Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
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
import { ActivityBar, Condition, InputBox, Key, until } from "vscode-extension-tester";
import { join } from "path";
import clipboard from "clipboardy";
import { browser, driver, Misc } from "../lib/Misc";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { E2ECodeEditorWidget } from "../lib/WebViews/E2ECodeEditorWidget";
import { HeatWaveProfileEditor } from "../lib/WebViews/MySQLAdministration/heatWaveProfileEditor";
import { TestQueue } from "../lib/TestQueue";

describe("NOTEBOOKS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eGlobalDBConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const notebook = new E2ENotebook();

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);

            if (process.env.PARALLEL) {
                await driver.wait(Misc.untilSchemaExists(constants.restServiceMetadataSchema),
                    constants.wait1minute * 2);
            }

            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption), constants.wait5seconds);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption)).click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.codeEditor.create();
            await dbTreeSection.focus();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Code Editor", () => {

        let cleanEditor = false;
        let existsInQueue = false;

        before(async function () {
            try {
                await Workbench.toggleSideBar(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
                await notebook.codeEditor.loadCommandResults();
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }

            if (cleanEditor) {
                await notebook.codeEditor.clean();
                cleanEditor = false;
            }
        });

        after(async function () {
            try {
                await Workbench.openMySQLShellForVSCode();
                const treeGlobalConn = await dbTreeSection.tree.getElement(globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {
                await notebook.codeEditor.write("select * from sakila.actor;");
                await notebook.codeEditor.setNewLine();
                await notebook.codeEditor.write("select * from sakila.address;");
                await notebook.codeEditor.setNewLine();
                await notebook.codeEditor.write("select * from sakila.city;");

                const clickLine = async (line: number): Promise<void> => {
                    await driver.wait(async () => {
                        try {
                            const lines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                            lines.shift();
                            await lines[line].click();

                            return true;
                        } catch (e) {
                            if (!(errors.isStaleError(e as Error))) {
                                throw e;
                            }
                        }
                    }, constants.wait5seconds, `Line ${line} was stale, could not click on it`);
                };

                await driver.actions().keyDown(Key.ALT).perform();
                await clickLine(0);
                await clickLine(1);
                await driver.actions().keyUp(Key.ALT).perform();
                const area = await driver.findElement(locator.notebook.codeEditor.textArea);
                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(200);
                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(200);
                await area.sendKeys(Key.BACK_SPACE);

                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                let items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0].length, "First line characters were not correctly deleted").equals(24);
                expect(items[1].length, "Second line characters were not correctly deleted").equals(26);
                expect(items[2].length, "Third line characters were not correctly deleted").equals(23);

                await textArea.sendKeys("testing");

                items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0], "First line should include the word 'testing'").to.include("testing");
                expect(items[1], "Second line should include the word 'testing'").to.include("testing");
                expect(items[2], "Third line should include the word 'testing'").to.include("testing");
            } finally {
                cleanEditor = true;
            }
        });

        it("Using a DELIMITER", async () => {

            const query =
                `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$

                    select 1 $$`;


            const result = await notebook.codeEditor.executeWithButton(query, constants.execFullBlockSql);
            expect(result.toolbar.status).to.match(/OK/);
            expect(result.tabs.length).to.equals(2);
            expect(result.tabs[0].name).to.match(/Result/);
            expect(result.tabs[1].name).to.match(/Result/);
        });

        it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
            const result = await notebook.codeEditor.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execAsText);
            expect(result.toolbar.status).to.match(/OK/);
            expect(result.text).to.match(/\|.*\|/);
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {
            const result = await notebook.codeEditor.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execFullBlockSql);
            expect(result.toolbar.status).to.match(/(\d+) record/);
            await driver.wait(notebook.codeEditor.untilNewPromptExists(), constants.wait5seconds);
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";
                await notebook.codeEditor.write(query1, true);
                await notebook.codeEditor.setNewLine();
                await notebook.codeEditor.write(query2, true);
                let result = await notebook.codeEditor.findAndExecute(query1);
                expect(result.toolbar.status).to.match(/OK/);
                let htmlGrid = await result.grid.content.getAttribute("innerHTML");
                expect(htmlGrid).to.match(/actor_id/);

                await driver.sleep(1000);
                await notebook.codeEditor.loadCommandResults();
                result = await notebook.codeEditor
                    .findAndExecute(query2, notebook.codeEditor.resultIds[notebook.codeEditor.resultIds.length - 1]);
                expect(result.toolbar.status).to.match(/OK/);
                htmlGrid = await result.grid.content.getAttribute("innerHTML");
                expect(htmlGrid).to.match(/address_id/);
            } finally {
                cleanEditor = true;
            }
        });

        it("Switch between search tabs", async () => {
            const result = await notebook.codeEditor
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;");
            expect(result.toolbar.status).to.match(/OK/);
            expect(result.tabs.length).to.equals(2);
            expect(result.tabs[0].name).to.equals("Result #1");
            expect(result.tabs[1].name).to.equals("Result #2");
            expect(await result.grid.content.getAttribute("innerHTML"))
                .to.match(/actor_id.*first_name.*last_name.*last_update/);
            await result.selectTab(result.tabs[1].name);
            expect(await result.grid.content.getAttribute("innerHTML"))
                .to.match(/address.*address2.*district.*city_id.*postal_code.*phone.*last_update/);
        });

        it("Connect to database and verify default schema", async () => {

            const result = await notebook.codeEditor.execute("SELECT SCHEMA();");
            expect(result.toolbar.status).to.match(/1 record retrieved/);
            expect(await result.grid.content.getAttribute("innerHTML"))
                .to.match(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema));
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommitBtn = await notebook.toolbar.getButton(constants.autoCommit);
            const style = await autoCommitBtn.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await notebook.toolbar.getButton(constants.commit);
            const rollBackBtn = await notebook.toolbar.getButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn),
                constants.wait3seconds, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn),
                constants.wait3seconds, "Commit button should be enabled");

            let result = await notebook.codeEditor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result.text).to.match(/OK/);

            await rollBackBtn.click();

            result = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.text).to.match(/OK/);

            result = await notebook.codeEditor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result.text).to.match(/OK/);

            await commitBtn.click();

            result = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.toolbar.status).to.match(/OK/);

            await autoCommitBtn.click();

            await driver.wait(
                async () => {
                    const commitBtn = await notebook.toolbar.getButton(constants.commit);
                    const rollBackBtn = await notebook.toolbar.getButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait5seconds,
                "Commit/Rollback DB changes button is still enabled ",
            );

            result = await notebook.codeEditor.execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.text).to.match(/OK/);
        });

        it("Connection toolbar buttons - Find and Replace", async () => {
            try {
                await notebook.codeEditor.write(`import from xpto xpto xpto`);
                const widget = await new E2ECodeEditorWidget(notebook).open();
                await widget.setTextToFind("xpto");
                await widget.toggleFinderReplace(true);
                await widget.toggleFindInSelection(false);
                await driver.wait(widget.untilMatchesCount(/1 of (\d+)/), constants.wait3seconds);
                await widget.toggleFinderReplace(true);
                await widget.setTextToReplace("tester");
                await driver.wait(async () => {
                    await widget.replace();

                    return (await driver.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                        .match(/import from tester xpto xpto/);
                }, constants.wait5seconds, "'xpto' was not replaced by tester");

                await widget.setTextToReplace("testing");
                await widget.replaceAll();

                expect(
                    await driver.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                    `'import from tester testing testing' was not found on the editor`,
                ).to.include("import from tester testing testing");
                await widget.close();
            } finally {
                cleanEditor = true;
            }

        });

        it("Execute code on different prompt languages", async () => {
            try {
                const query = "select * from sakila.actor limit 1;";
                const jsCmd = "Math.random();";
                const result1 = await notebook.codeEditor.execute(query);
                const block1 = result1.id;
                expect(result1.toolbar.status).to.match(/OK/);
                await notebook.codeEditor.languageSwitch("\\javascript ");
                const result2 = await notebook.codeEditor.execute(jsCmd);
                const block2 = result2.id;
                expect(result2.text).to.match(/(\d+).(\d+)/);
                const result3 = await notebook.codeEditor.findAndExecute(query, block1);
                expect(result3.toolbar.status).to.match(/OK/);
                const result4 = await notebook.codeEditor.findAndExecute(jsCmd, block2);
                expect(result4.text).to.match(/(\d+).(\d+)/);
            } finally {
                cleanEditor = true;
            }
        });

        it("Multi-line comments", async () => {
            await notebook.codeEditor.languageSwitch("\\sql ");
            const result1 = await notebook.codeEditor.execute("select version();");
            expect(result1.toolbar.status).to.match(/1 record retrieved/);
            const cell = result1.grid.content
                .findElement(locator.notebook.codeEditor.editor.result.grid.row.cell.exists);
            const cellText = await cell.getText();
            const server = cellText.match(/(\d+).(\d+).(\d+)/g)[0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            const result2 = await notebook.codeEditor.execute(`/*!${serverVer} select * from sakila.actor;*/`);
            expect(result2.toolbar.status).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            const result3 = await notebook.codeEditor.execute(`/*!${higherServer} select * from sakila.actor;*/`);
            expect(result3.text).to.match(/OK, 0 records retrieved/);
        });

        it("Maximize and Normalize Result tab", async () => {

            await Workbench.dismissNotifications();
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.actor;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.toolbar.maximize();
            expect((await notebook.toolbar.editorSelector.getCurrentEditor()).label,
                `The current editor name should be Result #1`)
                .to.equals("Result #1");
            try {
                let tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabs.body);
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await result.normalize();
                tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabs.body);
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                    globalConn.caption);
                await Workbench.toggleSideBar(false);
                await notebook.codeEditor.loadCommandResults();
            }
        });

        it("Pie Graph based on DB table", async () => {

            await notebook.codeEditor.languageSwitch("\\ts ");
            const result = await notebook.codeEditor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`);

            expect(result.graph).to.exist;
            const chartColumns = await result.graph
                .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10),
                    `The chart column should be fulfilled`).to.be.greaterThan(0);
            }
        });

        it("Autocomplete context menu", async () => {

            await notebook.codeEditor.languageSwitch("\\sql ");
            await notebook.codeEditor.write("select sak", true);
            await notebook.codeEditor.openSuggestionMenu();
            let els = await notebook.codeEditor.getAutoCompleteMenuItems();
            expect(els.toString(), "'sakila' was not found on the autocomplete items list").to.match(/sakila/);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.ESCAPE);
            await notebook.codeEditor.write("ila.", true);
            await notebook.codeEditor.openSuggestionMenu();
            els = await notebook.codeEditor.getAutoCompleteMenuItems();
            expect(els.toString(), "'actor', 'address', or 'category' should exist on the autocomplete items list")
                .to.match(/(actor|address|category)/);
            await textArea.sendKeys(Key.ESCAPE);
            await notebook.codeEditor.write("actor.", true);
            await notebook.codeEditor.openSuggestionMenu();
            els = await notebook.codeEditor.getAutoCompleteMenuItems();
            expect(els.toString(),
                "'actor_id', 'first_name' or 'last_name' should exist on the autocomplete items list")
                .to.match(/(actor_id|first_name|last_name)/);
            await textArea.sendKeys(Key.ESCAPE);
        });

        it("Copy paste into notebook", async function () {
            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);
            await notebook.codeEditor.clean();
            await Misc.switchBackToTopFrame();
            const filename = "users.sql";
            await browser.openResources(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", filename));
            await driver.wait(Workbench.untilTabIsOpened(filename), constants.wait5seconds);
            let textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardSelectAll(textArea);
            await Os.keyboardCopy(textArea);
            await Workbench.openEditor(globalConn.caption);
            await Misc.switchToFrame();
            textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await driver.executeScript("arguments[0].click()", textArea);
            let clipboardText = await clipboard.read();
            clipboardText = clipboardText.replace(/`|;/gm, "");
            await clipboard.write(clipboardText);
            await Os.keyboardPaste(textArea);

            const sakilaFile = await fs.readFile(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", filename));
            const fileLines = sakilaFile.toString().split("\n");

            const widget = await new E2ECodeEditorWidget(notebook).open();
            try {
                for (const line of fileLines) {
                    if (line.trim() !== "") {
                        await widget.setTextToFind(line.substring(0, 150).replace(/`|;/gm, ""));
                        await driver.wait(widget.untilMatchesCount(/1 of (\d+)/), constants.wait2seconds);
                    }
                }
            } finally {
                await widget.close();
                await Workbench.toggleSideBar(false);
            }
        });

        it("Cut paste into notebook", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const sentence1 = "select * from sakila.actor";
            const sentence2 = "select * from sakila.address";
            await notebook.codeEditor.clean();
            await notebook.codeEditor.write(sentence1);
            await notebook.codeEditor.setNewLine();
            await notebook.codeEditor.write(sentence2);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardSelectAll(textArea);
            await Os.keyboardCut(textArea);
            expect(await notebook.exists(sentence1), `${sentence1} should not exist on the notebook`)
                .to.be.false;
            expect(await notebook.exists(sentence2),
                `${sentence2} should not exist on the notebook`).to.be.false;
            await Os.keyboardPaste(textArea);
            expect(await notebook.exists(sentence1), `${sentence1} should exist on the notebook`).to.be.true;
            expect(await notebook.exists(sentence2), `${sentence2} should exist on the notebook`).to.be.true;

        });

        it("Copy to clipboard button", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("\\about");
            await result.copyToClipboard();
            await notebook.codeEditor.clean();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardPaste(textArea);
            await driver.wait(async () => {
                return notebook.exists("Welcome");
            }, constants.wait5seconds, "The text was not pasted to the notebook");

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/a_test`;
        const e2eTreeSection = new E2EAccordionSection("e2e");
        const notebook = new E2ENotebook();

        before(async function () {
            try {
                try {
                    await fs.access(`${destFile}.mysql-notebook`);
                    await fs.unlink(`${destFile}.mysql-notebook`);
                } catch (e) {
                    // continue, file does not exist
                }

                await dbTreeSection.focus();
                const treeGlobalConn = await dbTreeSection.tree.getElement(globalConn.caption);
                await (await dbTreeSection.tree.getActionButton(treeGlobalConn,
                    constants.openNewConnectionUsingNotebook)).click();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
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
                await Workbench.closeAllEditors();
                await fs.unlink(`${destFile}.mysql-notebook`);
                const activityBar = new ActivityBar();
                await (await activityBar.getViewControl(constants.extensionName))?.openView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Save Notebooks", async () => {

            const notebookEditor = await new E2ENotebook().codeEditor.create();
            const result = await notebookEditor.execute("SELECT VERSION();");
            expect(result.toolbar.status).to.match(/1 record retrieved/);
            await (await notebook.toolbar.getButton(constants.saveNotebook)).click();
            await Workbench.setInputPath(destFile);
            console.log(`destFile: ${destFile}`);
            await driver.wait(new Condition("", async () => {
                try {
                    console.log(`accessTest: ${destFile}.mysql-notebook`);
                    await fs.access(`${destFile}.mysql-notebook`);

                    return true;
                } catch (e) {
                    return false;
                }
            }), constants.wait5seconds, `File was not saved to ${process.cwd()}`);

        });

        it("Replace this Notebook with content from a file", async () => {

            await (await notebook.toolbar.getButton(constants.loadNotebook)).click();
            await Workbench.setInputPath(`${destFile}.mysql-notebook`);
            await notebook.exists("SELECT VERSION");
            await Workbench.closeAllEditors();

        });

        it("Open the Notebook from file", async () => {

            await browser.openResources(process.cwd());
            await Workbench.dismissNotifications();
            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("a_test.mysql-notebook", 3);
            await file.click();
            const input = await InputBox.create(constants.wait5seconds * 4);
            await (await input.findQuickPick(globalConn.caption)).select();
            await Workbench.openEditor("a_test.mysql-notebook");
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");
            await Workbench.closeEditor(new RegExp("a_test.mysql-notebook"), true);

        });

        it("Open the Notebook from file with connection", async () => {

            await Workbench.closeAllEditors();
            await browser.openResources(process.cwd());
            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("a_test.mysql-notebook", 3);
            await e2eTreeSection.tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await driver.wait(Workbench.untilTabIsOpened("a_test.mysql-notebook"), constants.wait5seconds);
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("a_test.mysql-notebook", 3);
            await file.click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await Workbench.openEditor("a_test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl(constants.extensionName))?.openView();
            await dbTreeSection.tree.deleteDatabaseConnection(globalConn.caption);
            const tabs = await Workbench.getOpenEditorTitles();
            expect(tabs, errors.tabIsNotOpened("a_test.mysql-notebook")).to.not.include("a_test.mysql-notebook");

        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await dbTreeSection.getDatabaseConnections();

            for (const conn of conns) {
                await dbTreeSection.tree.deleteDatabaseConnection(conn.name, conn.isMySQL);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("a_test.mysql-notebook", 3);
            await file.click();
            await Workbench.openEditor("a_test.mysql-notebook");
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);
            await Misc.switchToFrame();
            expect(await driver.findElement(locator.htmlTag.h2).getText(), "'No connection selected' message was found")
                .to.equals("No connection selected");
            await Workbench.closeAllEditors();
            await e2eTreeSection.tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);

        });

    });

    describe("HeatWave Chat", () => {

        const heatWaveConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: "e2eHeatWave Connection",
            description: "Local connection",
            basic: {
                hostname: String(process.env.HWHOSTNAME),
                username: String(process.env.HWUSERNAME),
                schema: "e2e_tests",
                password: String(process.env.HWPASSWORD),
            },
        };

        const newTask: interfaces.INewLoadingTask = {
            name: "static_cookbook",
            description: "How do cook properly",
            targetDatabaseSchema: "e2e_tests",
            formats: "PDF (Portable Document Format Files)",
        };

        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const cookbookFile = "static_cookbook.pdf";
        const notebook = new E2ENotebook();

        before(async function () {

            try {
                await dbTreeSection.createDatabaseConnection(heatWaveConn);
                await (await new DatabaseConnectionOverview().getConnection(heatWaveConn.caption)).click();
                await driver.wait(notebook.untilIsOpened(heatWaveConn), constants.wait5seconds);
                const result = await notebook.codeEditor.getLastExistingCommandResult(true);
                await driver.wait(result.heatWaveChatIsDisplayed(), constants.wait5seconds);
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

        it("Execute a query", async () => {

            const query = "How do I cook fish?";
            await Workbench.toggleSideBar(false);
            await (await notebook.toolbar.getButton(constants.showChatOptions)).click();
            const hwProfileEditor = new HeatWaveProfileEditor();
            await driver.wait(hwProfileEditor.untilIsOpened(), constants.wait5seconds);
            await hwProfileEditor.selectModel(constants.modelMistral);
            await notebook.codeEditor.languageSwitch("\\chat");
            await notebook.codeEditor.loadCommandResults();
            const result = await notebook.codeEditor.execute(query, undefined, true);
            expect(result.chat.length).to.be.greaterThan(0);

            const history = await hwProfileEditor.getHistory();
            expect(history[0].userMessage).to.equals(query);
            expect(history[0].chatBotOptions.length).to.be.greaterThan(0);
            const dbTables = await hwProfileEditor.getDatabaseTables();
            expect(dbTables).to.include(`\`${newTask.targetDatabaseSchema}\`.\`${newTask.name}\``);
            const matchedDocuments = await hwProfileEditor.getMatchedDocuments();
            expect(matchedDocuments.length).to.be.greaterThan(0);

            const documentTitles = [];
            for (const doc of matchedDocuments) {
                documentTitles.push(doc.title);
            }

            expect(documentTitles).to.include(cookbookFile);
        });

    });

});
