/*
 * Copyright (c) 2023, 2025 Oracle and/or its affiliates.
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
import { ActivityBar, Condition, InputBox, Key, until, SideBarView } from "vscode-extension-tester";
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
import { E2ECommandResultData } from "../lib/WebViews/CommandResults/E2ECommandResultData";
import { E2ECommandResultGrid } from "../lib/WebViews/CommandResults/E2ECommandResultGrid";

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

            await Os.appendToExtensionLog("beforeAll Notebooks");

            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await dbTreeSection.focus();
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption), constants.wait5seconds);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption)).click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
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

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
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
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption);
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


            const result = await notebook.executeWithButton(query, constants.execFullBlockSql,
                true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(result.tabs.length).to.equals(2);
            expect(result.tabs[0].name).to.match(/Result/);
            expect(result.tabs[1].name).to.match(/Result/);
        });

        it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
            const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execAsText, true) as E2ECommandResultData;
            expect(result.status).to.match(/OK/);
            expect(result.text).to.match(/\|.*\|/);
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {
            const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execFullBlockSql, true);
            expect(result.status).to.match(/(\d+) record/);
            await driver.wait(notebook.codeEditor.untilNewPromptExists(), constants.wait5seconds);
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";

                await notebook.codeEditor.clean();

                const result1 = await notebook.codeEditor.execute(query1, true) as E2ECommandResultGrid;
                expect(result1.status).to.match(/OK/);

                const result2 = await notebook.codeEditor.execute(query2, true) as E2ECommandResultGrid;
                expect(result2.status).to.match(/OK/);

                let careResult = await notebook.findAndExecute(query1, result1.id) as E2ECommandResultGrid;
                expect(Array.from(careResult.columnsMap.keys()))
                    .to.deep.equals(["actor_id", "first_name", "last_name", "last_update"]);

                careResult = await notebook.findAndExecute(query2, result2.id) as E2ECommandResultGrid;
                expect(Array.from(careResult.columnsMap.keys()))
                    .to.deep.equals(["address_id", "address", "address2", "district", "city_id", "postal_code",
                        "phone", "last_update"]);
            } finally {
                cleanEditor = true;
            }
        });

        it("Switch between search tabs", async () => {
            const query = "select * from sakila.actor limit 1; select * from sakila.address limit 1;";
            const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(result.tabs.length).to.equals(2);
            expect(result.tabs[0].name).to.equals("Result #1");
            expect(result.tabs[1].name).to.equals("Result #2");
            expect(Array.from(result.columnsMap.keys()))
                .to.deep.equals(["actor_id", "first_name", "last_name", "last_update"]);
            await result.selectTab(result.tabs[1].name);
            expect(Array.from(result.columnsMap.keys()))
                .to.deep.equals(["address_id", "address", "address2", "district", "city_id", "postal_code",
                    "phone", "last_update"]);
        });

        it("Connect to database and verify default schema", async () => {

            const result = await notebook.codeEditor.execute("SELECT SCHEMA();", true);
            expect(result.status).to.match(/1 record retrieved/);
            expect(await result.resultContext.getAttribute("innerHTML"))
                .to.match(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema));
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            const autoCommitBtn = await notebook.toolbar.getButton(constants.autoCommit);
            const style = await autoCommitBtn.findElement(locator.notebook.toolbar.button.icon)
                .getAttribute("style");
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

            let resultData = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
            expect(resultData.text).to.match(/OK/);

            await rollBackBtn.click();

            // eslint-disable-next-line max-len
            let resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name='${random}';`) as E2ECommandResultGrid;
            expect(resultGrid.status).to.match(/OK/);

            resultData = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
            expect(resultData.text).to.match(/OK/);

            await commitBtn.click();

            // eslint-disable-next-line max-len
            resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`) as E2ECommandResultGrid;
            expect(resultGrid.status).to.match(/OK/);

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

            const result2 = await notebook.codeEditor
                .execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`) as E2ECommandResultData;
            expect(result2.text).to.match(/OK/);
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
                const query = "select * from sakila.actor limit 1";
                const jsCmd = "Math.random()";
                const result1 = await notebook.codeEditor.execute(query, true) as E2ECommandResultGrid;
                const block1 = result1.id;
                expect(result1.status).to.match(/OK/);
                await notebook.codeEditor.languageSwitch("\\js");
                const result2 = await notebook.codeEditor.execute(jsCmd, true) as E2ECommandResultData;
                const block2 = result2.id;
                expect(result2.text).to.match(/(\d+).(\d+)/);
                const result3 = await notebook.findAndExecute(query, block1) as E2ECommandResultGrid;
                expect(result3.status).to.match(/OK/);
                const result4 = await notebook.findAndExecute(jsCmd, block2) as E2ECommandResultData;
                expect(result4.text).to.match(/(\d+).(\d+)/);
            } finally {
                cleanEditor = true;
            }
        });

        it("Multi-line comments", async () => {
            await notebook.codeEditor.languageSwitch("\\sql ");
            const result1 = await notebook.codeEditor.execute("select version();", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/1 record retrieved/);
            const cell = result1.resultContext
                .findElement(locator.notebook.codeEditor.editor.result.grid.row.cell.exists);
            const cellText = await cell.getText();
            const server = cellText.match(/(\d+).(\d+).(\d+)/g)[0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            const result2 = await notebook.codeEditor
                .execute(`/*!${serverVer} select * from sakila.actor;*/`, true) as E2ECommandResultGrid;
            expect(result2.status).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            const result3 = await notebook.codeEditor
                .execute(`/*!${higherServer} select * from sakila.actor;*/`, true) as E2ECommandResultData;
            expect(result3.text).to.match(/OK, 0 records retrieved/);
        });

        it("Maximize and Normalize Result tab", async () => {

            await Workbench.dismissNotifications();
            const result = await notebook.codeEditor.execute("select * from sakila.actor;"
                , true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await result.maximize();
            expect((await notebook.toolbar.editorSelector.getCurrentEditor()).label).to.equals("Result #1");

            try {
                await result.normalize();
                await driver
                    .wait(until.elementLocated(locator.notebook.codeEditor.editor.result
                        .toolbar.maximize), constants.wait3seconds);
            } finally {
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                    globalConn.caption);
                await notebook.codeEditor.build();
            }
        });

        it("Pie Graph based on DB table", async () => {

            await notebook.codeEditor.languageSwitch("\\ts ");
            const result = await notebook.codeEditor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`, true) as E2ECommandResultData;

            expect(result.graph).to.exist;
            const chartColumns = await result.graph
                .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
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
            await notebook.codeEditor.write(sentence1, true);
            await notebook.codeEditor.setNewLine();
            await notebook.codeEditor.write(sentence2, true);
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
            const result = await notebook.codeEditor.execute("\\about ", true) as E2ECommandResultData;
            await driver.wait(async () => {
                await result.copyToClipboard();

                return (clipboard.readSync()).includes("Welcome");
            }, constants.wait3seconds, `'Welcome keyword' was not found on the clipboard`);

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/a_test`;
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
                await (await dbTreeSection.getTreeItemActionButton(globalConn.caption,
                    constants.openNewConnectionUsingNotebook)).click();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
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

            const result = await notebook.codeEditor.execute("SELECT VERSION();") as E2ECommandResultGrid;
            expect(result.status).to.match(/1 record retrieved/);
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

            await driver.wait(Workbench.untilExplorerFolderIsOpened("e2e"), constants.wait15seconds);
            const file = await (await new SideBarView().getContent().getSection("e2e"))
                .findItem("a_test.mysql-notebook", 3);
            await file.click();
            const input = await InputBox.create(constants.wait5seconds * 4);
            await (await input.findQuickPick(globalConn.caption)).select();
            await Workbench.openEditor("a_test.mysql-notebook");
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");
            await Workbench.closeEditor(new RegExp("a_test.mysql-notebook"), true);

        });

        it("Open the Notebook from file with connection", async () => {

            await driver.wait(Workbench.untilExplorerFolderIsOpened("e2e"), constants.wait15seconds);
            const e2eTreeSection = new E2EAccordionSection("e2e");
            await e2eTreeSection.openContextMenuAndSelect("a_test.mysql-notebook", constants.openNotebookWithConn);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await driver.wait(Workbench.untilTabIsOpened("a_test.mysql-notebook"), constants.wait5seconds);
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            const e2eTreeSection = new E2EAccordionSection("e2e");
            const file = await e2eTreeSection.getTreeItem("a_test.mysql-notebook");
            await file.click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await Workbench.openEditor("a_test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl(constants.extensionName))?.openView();
            await dbTreeSection.deleteDatabaseConnection(globalConn.caption);
            const tabs = await Workbench.getOpenEditorTitles();
            expect(tabs, errors.tabIsNotOpened("a_test.mysql-notebook")).to.not.include("a_test.mysql-notebook");

        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await dbTreeSection.getTreeDatabaseConnections();

            for (const conn of conns) {
                await dbTreeSection.deleteDatabaseConnection(conn.name, conn.isMySQL);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            const e2eTreeSection = new E2EAccordionSection("e2e");
            const file = await e2eTreeSection.getTreeItem("a_test.mysql-notebook");
            await file.click();
            await Workbench.openEditor("a_test.mysql-notebook");
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);
            await Misc.switchToFrame();
            expect(await driver.findElement(locator.htmlTag.h2).getText(), "'No connection selected' message was found")
                .to.equals("No connection selected");
            await Workbench.closeAllEditors();
            await e2eTreeSection.openContextMenuAndSelect("a_test.mysql-notebook", constants.openNotebookWithConn);
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);

        });

    });

    describe.skip("HeatWave Chat", () => {

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
        const notebook = new E2ENotebook();

        before(async function () {

            try {
                await dbTreeSection.createDatabaseConnection(heatWaveConn);
                await (await new DatabaseConnectionOverview().getConnection(heatWaveConn.caption)).click();
                await driver.wait(notebook.untilIsOpened(heatWaveConn), constants.wait10seconds);
                let result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultData;
                await driver.wait(result.heatWaveChatIsDisplayed(), constants.wait5seconds);
                result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultData;
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
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
            await notebook.codeEditor.build();
            const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultData;
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

            expect(documentTitles.join(" ")).to.include("cookbook");
        });

    });

});
