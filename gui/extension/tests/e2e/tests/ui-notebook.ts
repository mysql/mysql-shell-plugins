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
import { LakeHouseNavigator } from "../lib/WebViews/lakehouseNavigator/lakeHouseNavigator";
import { HeatWaveProfileEditor } from "../lib/WebViews/lakehouseNavigator/heatWaveProfileEditor";
import { TestQueue } from "../lib/TestQueue";

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
    if (!process.env.SSL_ROOT_FOLDER) {
        throw new Error("Please define the environment variable SSL_ROOT_FOLDER");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eGlobalDBConnection",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };
    const anotherConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eAnotherDBConnection",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const notebook = new E2ENotebook();

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait2minutes);

            if (process.env.PARALLEL) {
                await driver.wait(Misc.untilSchemaExists(constants.restServiceMetadataSchema), constants.wait2minutes);
            }

            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await dbTreeSection.createDatabaseConnection(anotherConn);
            await driver.wait(dbTreeSection.tree.untilExists(anotherConn.caption), constants.wait5seconds);
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


                    select 1 $$
                `;

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
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;", true);
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
                const query = "select * from sakila.actor limit 1";
                const jsCmd = "Math.random()";
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
            await notebook.codeEditor.languageSwitch("\\sql ", true);
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

            const result2 = await notebook.codeEditor.execute(`/*!${serverVer} select * from sakila.actor;*/`, true);
            expect(result2.toolbar.status).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            const result3 = await notebook.codeEditor.execute(`/*!${higherServer} select * from sakila.actor;*/`, true);
            expect(result3.text).to.match(/OK, 0 records retrieved/);
        });

        it("Maximize and Normalize Result tab", async () => {

            const result = await notebook.codeEditor.execute("select * from sakila.actor;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.toolbar.maximize();
            expect((await notebook.toolbar.getCurrentEditor()).label, `The current editor name should be Result #1`)
                .to.equals("Result #1");
            try {
                let tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabs.body);
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await result.normalize();
                tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabs.body);
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await notebook.toolbar.selectEditor(new RegExp(constants.openEditorsDBNotebook), globalConn.caption);
                await Workbench.toggleSideBar(false);
                await notebook.codeEditor.loadCommandResults();
            }
        });

        it("Pie Graph based on DB table", async () => {

            await notebook.codeEditor.languageSwitch("\\ts ", true);
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

            await notebook.codeEditor.languageSwitch("\\sql ", true);
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
            const result = await notebook.codeEditor.execute("\\about ");
            await result.copyToClipboard();
            await notebook.codeEditor.clean();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardPaste(textArea);
            await driver.wait(async () => {
                return notebook.exists("Welcome");
            }, constants.wait5seconds, "The text was not pasted to the notebook");

        });

        it("Verify mysql data types - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);
            const row = 0;
            const smallIntField = await result.grid.getCellValue(row, "test_smallint");
            const mediumIntField = await result.grid.getCellValue(row, "test_mediumint");
            const intField = await result.grid.getCellValue(row, "test_integer");
            const bigIntField = await result.grid.getCellValue(row, "test_bigint");
            const decimalField = await result.grid.getCellValue(row, "test_decimal");
            const floatFIeld = await result.grid.getCellValue(row, "test_float");
            const doubleField = await result.grid.getCellValue(row, "test_double");
            const booleanCell = await result.grid.getCellValue(row, "test_boolean");

            expect(smallIntField, errors.incorrectCellValue("SMALLINT")).to.match(/(\d+)/);
            expect(mediumIntField, errors.incorrectCellValue("MEDIUMINT")).to.match(/(\d+)/);
            expect(intField, errors.incorrectCellValue("INT")).to.match(/(\d+)/);
            expect(bigIntField, errors.incorrectCellValue("BIGINT")).to.match(/(\d+)/);
            expect(decimalField, errors.incorrectCellValue("DECIMAL")).to.match(/(\d+).(\d+)/);
            expect(floatFIeld, errors.incorrectCellValue("FLOAT")).to.match(/(\d+).(\d+)/);
            expect(doubleField, errors.incorrectCellValue("DOUBLE")).to.match(/(\d+).(\d+)/);
            expect(booleanCell, "The cell should have a select list").to.match(/(true|false)/);

        });

        it("Verify mysql data types - date columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const dateField = await result.grid.getCellValue(row, "test_date");
            const dateTimeField = await result.grid.getCellValue(row, "test_datetime");
            const timeStampField = await result.grid.getCellValue(row, "test_timestamp");
            const timeField = await result.grid.getCellValue(row, "test_time");
            const yearField = await result.grid.getCellValue(row, "test_year");

            expect(dateField, errors.incorrectCellValue("DATE")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(dateTimeField, errors.incorrectCellValue("DATETIME")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeStampField, errors.incorrectCellValue("TIMESTAMP")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeField, errors.incorrectCellValue("TIME")).to.match(/(\d+):(\d+):(\d+)/);
            expect(yearField, errors.incorrectCellValue("YEAR")).to.match(/(\d+)/);
        });

        it("Verify mysql data types - char columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_chars;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const charField = await result.grid.getCellValue(row, "test_char");
            const varCharField = await result.grid.getCellValue(row, "test_varchar");
            const tinyTextField = await result.grid.getCellValue(row, "test_tinytext");
            const textField = await result.grid.getCellValue(row, "test_text");
            const mediumTextField = await result.grid.getCellValue(row, "test_mediumtext");
            const longTextField = await result.grid.getCellValue(row, "test_longtext");
            const enumField = await result.grid.getCellValue(row, "test_enum");
            const setFIeld = await result.grid.getCellValue(row, "test_set");
            const jsonField = await result.grid.getCellValue(row, "test_json");

            expect(charField, errors.incorrectCellValue("CHAR")).to.match(/([a-z]|[A-Z])/);
            expect(varCharField, errors.incorrectCellValue("VARCHAR")).to.match(/([a-z]|[A-Z])/);
            expect(tinyTextField, errors.incorrectCellValue("TINYTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(textField, errors.incorrectCellValue("TEXT")).to.match(/([a-z]|[A-Z])/);
            expect(mediumTextField, errors.incorrectCellValue("MEDIUMTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(longTextField, errors.incorrectCellValue("LONGTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(enumField, errors.incorrectCellValue("ENUM")).to.match(/([a-z]|[A-Z])/);
            expect(setFIeld, errors.incorrectCellValue("SET")).to.match(/([a-z]|[A-Z])/);
            expect(jsonField).to.match(/\{.*\}/);
        });

        it("Verify mysql data types - blob columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_blobs;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const binaryField = await result.grid.getCellValue(row, "test_binary");
            const varBinaryField = await result.grid.getCellValue(row, "test_varbinary");

            expect(await result.grid.getCellIconType(row, "test_tinyblob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_blob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_mediumblob")).to.equals(constants.blob);
            expect(await result.grid.getCellIconType(row, "test_longblob")).to.equals(constants.blob);
            expect(binaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
            expect(varBinaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
        });

        it("Verify mysql data types - geometry columns", async () => {
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const bitCell = await result.grid.getCellValue(row, "test_bit");
            expect(await result.grid.getCellIconType(row, "test_point"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_linestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_polygon"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multipoint"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multilinestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_multipolygon"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.grid.getCellIconType(row, "test_geometrycollection"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(bitCell, errors.incorrectCellValue("BIT")).to.match(/(\d+)/);
        });

        it("Result grid context menu - Capitalize, Convert to lower, upper case and mark for deletion", async () => {

            await notebook.toolbar.selectEditor(new RegExp(constants.openEditorsDBNotebook), globalConn.caption);
            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);
            const rowNumber = 0;
            const rowColumn = "text_field";

            const originalCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.capitalizeText);
            await driver.wait(result.grid.untilCellsWereChanged(1), constants.wait5seconds);

            const capitalizedCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(capitalizedCellValue,
                `The cell value was not capitalized`).to.equals(`${originalCellValue.charAt(0)
                    .toUpperCase()
                    }${originalCellValue.slice(1)}`);

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToLowerCase);

            const lowerCaseCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(lowerCaseCellValue, "The cell value was not converted to lower case")
                .to.equals(capitalizedCellValue.toLowerCase());

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToUpperCase);

            const upperCaseCellValue = await result.grid.getCellValue(rowNumber, rowColumn);
            expect(upperCaseCellValue, "The cell value was not converted to upper case")
                .to.equals(lowerCaseCellValue.toUpperCase());

            await result.grid.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.toggleForDeletion);
            await driver.wait(result.grid.untilRowIsMarkedForDeletion(rowNumber), constants.wait5seconds);
            await result.toolbar.rollbackChanges();
        });

        it("Result grid context menu - Copy single row", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy row.
            await driver.wait(async () => {
                const copy = await result.grid.copyRow(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row failed`);

            // Copy row with names.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names failed`);

            // Copy row unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row unquoted failed`);

            // Copy row with names, unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, unquoted failed`);

            // Copy row with names, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, tab separated failed`);

            // Copy row, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyRowTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row, tab separated failed`);

        });

        it("Result grid context menu - Copy multiple rows", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const maxRows = 2;
            const result = await notebook.codeEditor
                .execute(`select * from sakila.actor limit ${maxRows};`);
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy all rows.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRows(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows failed`);

            // Copy all rows with names.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names failed`);

            // Copy all rows unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows unquoted failed`);

            // Copy all rows with names unquoted.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names unquoted failed`);

            // Copy all rows with names tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names tab separated failed`);

            // Copy all rows tab separated.
            await driver.wait(async () => {
                const copy = await result.grid.copyAllRowsTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows tab separated failed`);

        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar.status).to.match(/OK/);

            const row = 0;
            const allColumns = Array.from(result.grid.columnsMap.keys());

            for (let i = 1; i <= allColumns.length - 1; i++) {

                await driver.wait(async () => {
                    const copy = await result.grid.copyField(row, String(allColumns[i]));
                    const clip = clipboard.readSync();

                    if (copy.toString().match(new RegExp(clip.toString()))) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field failed");

                await driver.wait(async () => {
                    const copy = await result.grid.copyFieldUnquoted(row, String(allColumns[i]));
                    const clip = clipboard.readSync();

                    if (copy.toString() === clip.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field unquoted failed");

                await result.grid.openCellContextMenuAndSelect(row, String(allColumns[i]),
                    constants.resultGridContextMenu.setFieldToNull);
                expect(await result.grid.getCellValue(row, String(allColumns[i])),
                    `Set field to null (${String(allColumns[i])})`)
                    .to.equals(constants.isNull);
            }

            await result.toolbar.rollbackChanges();

        });

        it("Select a Result Grid View", async () => {

            const result = await notebook.codeEditor.execute("select * from sakila.actor;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.grid.editCells([{
                rowNumber: 0,
                columnName: "first_name",
                value: "changed",
            }]);

            await result.toolbar.selectView(constants.previewView);
            expect(result.preview).to.exist;
            await result.toolbar.selectView(constants.gridView);
            expect(result.preview).to.not.exist;
            expect(result.grid).to.exist;
            await result.toolbar?.rollbackChanges();

        });

        it("Edit a result grid, verify query preview and commit - integer columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);

            const booleanEdited = false;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "1201";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.70";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_smallint", value: smallIntEdited },
                { rowNumber: rowToEdit, columnName: "test_mediumint", value: mediumIntEdited },
                { rowNumber: rowToEdit, columnName: "test_integer", value: intEdited },
                { rowNumber: rowToEdit, columnName: "test_bigint", value: bigIntEdited },
                { rowNumber: rowToEdit, columnName: "test_decimal", value: decimalEdited },
                { rowNumber: rowToEdit, columnName: "test_float", value: floatEdited },
                { rowNumber: rowToEdit, columnName: "test_double", value: doubleEdited },
                { rowNumber: rowToEdit, columnName: "test_boolean", value: booleanEdited },
            ];

            await result.grid.editCells(cellsToEdit);
            const booleanField = booleanEdited ? 1 : 0;
            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_ints SET/,
                new RegExp(`test_smallint = ${smallIntEdited}`),
                new RegExp(`test_mediumint = ${mediumIntEdited}`),
                new RegExp(`test_integer = ${intEdited}`),
                new RegExp(`test_bigint = ${bigIntEdited}`),
                new RegExp(`test_decimal = ${decimalEdited}`),
                new RegExp(`test_float = ${floatEdited}`),
                new RegExp(`test_double = ${doubleEdited}`),
                new RegExp(`test_boolean = ${booleanField}`),
                /WHERE id = 1;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);

            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);
            const testBoolean = await result1.grid.getCellValue(rowToEdit, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await result1.grid.getCellValue(rowToEdit, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await result1.grid.getCellValue(rowToEdit, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await result1.grid.getCellValue(rowToEdit, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await result1.grid.getCellValue(rowToEdit, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await result1.grid.getCellValue(rowToEdit, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await result1.grid.getCellValue(rowToEdit, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await result1.grid.getCellValue(rowToEdit, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);

        });

        it("Edit a result grid, verify query preview and commit - date columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);

            const dateEdited = "2024-01-01";
            const dateTimeEdited = "2024-01-01 15:00";
            const timeStampEdited = "2024-01-01 15:00";
            const timeEdited = "23:59";
            const yearEdited = "2030";

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_date", value: dateEdited },
                { rowNumber: rowToEdit, columnName: "test_datetime", value: dateTimeEdited },
                { rowNumber: rowToEdit, columnName: "test_timestamp", value: timeStampEdited },
                { rowNumber: rowToEdit, columnName: "test_time", value: timeEdited },
                { rowNumber: rowToEdit, columnName: "test_year", value: yearEdited },
            ];
            await result.grid.editCells(cellsToEdit);
            const dateTimeToISO = Misc.convertDateToISO(dateTimeEdited);
            const timeStampToISO = Misc.convertDateToISO(timeStampEdited);
            const timeTransformed = Misc.convertTimeTo12H(timeEdited);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_dates SET/,
                new RegExp(`test_date = '${dateEdited}'`),
                new RegExp(`test_datetime = '(${dateTimeEdited}:00|${dateTimeToISO}:00)'`),
                new RegExp(`test_timestamp = '(${timeStampEdited}:00|${timeStampToISO}:00)'`),
                new RegExp(`test_time = '(${timeEdited}|${timeTransformed})'`),
                new RegExp(`test_year = ${yearEdited}`),
                /WHERE id = 1;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_dates where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);

            const testDate = await result1.grid.getCellValue(rowToEdit, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await result1.grid.getCellValue(rowToEdit, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await result1.grid.getCellValue(rowToEdit, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await result1.grid.getCellValue(rowToEdit, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await result1.grid.getCellValue(rowToEdit, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Edit a result grid, verify query preview and commit - char columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_chars where id = 2;");
            expect(result.toolbar.status).to.match(/OK/);

            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value2_dummy_dummy_dummy";
            const setEdited = "value2_dummy_dummy_dummy";
            const jsonEdited = '{"test": "2"}';

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_char", value: charEdited },
                { rowNumber: rowToEdit, columnName: "test_varchar", value: varCharEdited },
                { rowNumber: rowToEdit, columnName: "test_tinytext", value: tinyTextEdited },
                { rowNumber: rowToEdit, columnName: "test_text", value: textEdited },
                { rowNumber: rowToEdit, columnName: "test_mediumtext", value: textMediumEdited },
                { rowNumber: rowToEdit, columnName: "test_longtext", value: longTextEdited },
                { rowNumber: rowToEdit, columnName: "test_enum", value: enumEdited },
                { rowNumber: rowToEdit, columnName: "test_set", value: setEdited },
                { rowNumber: rowToEdit, columnName: "test_json", value: jsonEdited },
            ];
            await result.grid.editCells(cellsToEdit);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_chars SET/,
                new RegExp(`test_char = '${charEdited}'`),
                new RegExp(`test_varchar = '${varCharEdited}'`),
                new RegExp(`test_tinytext = '${tinyTextEdited}'`),
                new RegExp(`test_text = '${textEdited}'`),
                new RegExp(`test_mediumtext = '${textMediumEdited}'`),
                new RegExp(`test_longtext = '${longTextEdited}'`),
                new RegExp(`test_enum = '${enumEdited}'`),
                new RegExp(`test_set = '${setEdited}'`),
                Misc.transformToMatch(`test_json = '${jsonEdited}'`),
                /WHERE id = 2;/,
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_chars where id = 2;");
            expect(result1.toolbar.status).to.match(/OK/);
            const testChar = await result1.grid.getCellValue(rowToEdit, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await result1.grid.getCellValue(rowToEdit, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await result1.grid.getCellValue(rowToEdit, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await result1.grid.getCellValue(rowToEdit, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await result1.grid.getCellValue(rowToEdit, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await result1.grid.getCellValue(rowToEdit, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await result1.grid.getCellValue(rowToEdit, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await result1.grid.getCellValue(rowToEdit, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await result1.grid.getCellValue(rowToEdit, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(jsonEdited);

        });

        it("Edit a result grid, verify query preview and commit - geometry columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPoly = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEd = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "11111111111111";
            const rowToEdit = 0;

            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_point", value: pointEdited },
                { rowNumber: rowToEdit, columnName: "test_bit", value: bitEdited },
                { rowNumber: rowToEdit, columnName: "test_linestring", value: lineStringEdited },
                { rowNumber: rowToEdit, columnName: "test_polygon", value: polygonEdited },
                { rowNumber: rowToEdit, columnName: "test_multipoint", value: multiPointEdited },
                { rowNumber: rowToEdit, columnName: "test_multilinestring", value: multiLineStrEdited },
                { rowNumber: rowToEdit, columnName: "test_multipolygon", value: multiPoly },
                { rowNumber: rowToEdit, columnName: "test_geometrycollection", value: geoCollEd },
            ];
            await result.grid.editCells(cellsToEdit);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_geometries SET/,
                new RegExp(`test_bit = b'${bitEdited}'`),
                Misc.transformToMatch(`test_point = ${pointEdited}`),
                Misc.transformToMatch(`test_linestring = ${lineStringEdited}`),
                Misc.transformToMatch(`test_polygon = ${polygonEdited}`),
                Misc.transformToMatch(`test_multipoint = ${multiPointEdited}`),
                Misc.transformToMatch(`test_multilinestring = ${multiLineStrEdited}`),
                Misc.transformToMatch(`test_multipolygon = ${multiPoly}`),
                Misc.transformToMatch(`test_geometrycollection = ${geoCollEd}`),
                new RegExp(`WHERE id = 1;`),
            ];

            await result.toolbar.selectSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result.preview.text).to.match(expectedSqlPreview[i]);
            }

            await result.clickSqlPreviewContent();
            await driver.wait(result.grid.untilRowIsHighlighted(rowToEdit), constants.wait5seconds);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_geometries where id = 1;");
            expect(result1.toolbar.status).to.match(/OK/);

            const testPoint = await result1.grid.getCellValue(rowToEdit, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await result1.grid.getCellValue(rowToEdit, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await result1.grid.getCellValue(rowToEdit, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await result1.grid.getCellValue(rowToEdit, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await result1.grid.getCellValue(rowToEdit,
                "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await result1.grid.getCellValue(rowToEdit,
                "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await result1.grid.getCellValue(rowToEdit,
                "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await result.grid.getCellValue(rowToEdit, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("16383");
        });

        it("Result grid cell tooltips - integer columns", async () => {

            const rowNumber = 0;
            const tableColumns: string[] = [];

            await notebook.toolbar.selectEditor(new RegExp(constants.openEditorsDBNotebook), globalConn.caption);
            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_ints limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }
                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - date columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_dates where id = 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - char columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_chars where id = 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);
            }

        });

        it("Result grid cell tooltips - binary and varbinary columns", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_blobs limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const tableColumns: string[] = [];
            for (const key of result.grid.columnsMap.keys()) {
                tableColumns.push(key);
            }

            for (let i = 5; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    await result.grid.reduceCellWidth(rowNumber, tableColumns[i]);
                }

                const cellText = await result.grid.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.grid.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait3seconds);

            }

        });

        it("Result grid cell tooltips - bit column", async () => {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor.execute("SELECT * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const column = "test_bit";
            await result.grid.reduceCellWidth(rowNumber, column);
            const cellText = await result.grid.getCellValue(rowNumber, column);
            await driver.wait(result.grid.untilCellTooltipIs(rowNumber, column, cellText), constants.wait3seconds);

        });

        it("Edit a result grid and rollback", async () => {
            const modifiedText = "56";
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types;");
            expect(result.toolbar.status).to.match(/OK/);
            await result.grid.editCells(
                [{
                    rowNumber: 0,
                    columnName: "test_integer",
                    value: modifiedText,
                }]);

            await result.toolbar.rollbackChanges();
            expect((await result.grid.content.getAttribute("innerHTML")).match(/rollbackTest/) === null,
                `${modifiedText} should not exist on the cell`).to.be.true;

        });

        it("Verify not editable result grids", async () => {

            const queries = [
                "select count(address_id) from sakila.address GROUP by city_id having count(address_id) > 0;",
                "SELECT actor_id FROM sakila.actor INNER JOIN sakila.address ON actor.actor_id = address.address_id;",
                "select first_name from sakila.actor UNION SELECT address_id from sakila.address;",
                "select actor_id from sakila.actor INTERSECT select address_id from sakila.address;",
                "select first_name from sakila.actor EXCEPT select address from sakila.address;",
                "SELECT COUNT(*) FROM DUAL;",
                `select * from sakila.actor where actor_id =
                                (select address_id from sakila.address where address_id = 1) for update;`,
                "select (actor_id*2), first_name as calculated from sakila.actor;",
            ];
            await notebook.codeEditor.clean();
            for (const query of queries) {
                const result = await notebook.codeEditor.execute(query);
                expect(result.toolbar.status).to.match(/OK/);
                const editBtn = await result.toolbar.getEditButton();
                expect(await editBtn.getAttribute("data-tooltip"),
                    `'${query}' should not be editable`).to.equal("Data not editable");
            }

        });

        it("Add new row on result grid - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_ints;");
            expect(result.toolbar.status).to.match(/OK/);
            const booleanEdited = true;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.70";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_smallint", value: smallIntEdited },
                { columnName: "test_mediumint", value: mediumIntEdited },
                { columnName: "test_integer", value: intEdited },
                { columnName: "test_bigint", value: bigIntEdited },
                { columnName: "test_decimal", value: decimalEdited },
                { columnName: "test_float", value: floatEdited },
                { columnName: "test_double", value: doubleEdited },
                { columnName: "test_boolean", value: booleanEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_ints where id = (select max(id) from sakila.all_data_types_ints);");
            expect(result1.toolbar.status).to.match(/OK/);

            const row = 0;

            const testBoolean = await result1.grid.getCellValue(row, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await result1.grid.getCellValue(row, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await result1.grid.getCellValue(row, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await result1.grid.getCellValue(row, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await result1.grid.getCellValue(row, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await result1.grid.getCellValue(row, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await result1.grid.getCellValue(row, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await result1.grid.getCellValue(row, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);

        });

        it("Add new row on result grid - date columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_dates;");
            expect(result.toolbar.status).to.match(/OK/);
            const dateEdited = "2024-01-01";
            const dateTimeEdited = "2024-01-01 15:00";
            const timeStampEdited = "2024-01-01 15:00";
            const timeEdited = "23:59";
            const yearEdited = "2024";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_date", value: dateEdited },
                { columnName: "test_datetime", value: dateTimeEdited },
                { columnName: "test_timestamp", value: timeStampEdited },
                { columnName: "test_time", value: timeEdited },
                { columnName: "test_year", value: yearEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();
            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);

            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_dates where id = (select max(id) from sakila.all_data_types_dates);");
            expect(result1.toolbar.status).to.match(/OK/);
            const row = 0;
            const testDate = await result1.grid.getCellValue(row, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await result1.grid.getCellValue(row, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await result1.grid.getCellValue(row, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await result1.grid.getCellValue(row, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await result1.grid.getCellValue(row, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Add new row on result grid - char columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types_chars;");
            expect(result.toolbar.status).to.match(/OK/);

            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value4_dummy_dummy_dummy";
            const setEdited = "value4_dummy_dummy_dummy";
            const jsonEdited = '{"test": "2"}';

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_char", value: charEdited },
                { columnName: "test_varchar", value: varCharEdited },
                { columnName: "test_tinytext", value: tinyTextEdited },
                { columnName: "test_text", value: textEdited },
                { columnName: "test_mediumtext", value: textMediumEdited },
                { columnName: "test_longtext", value: longTextEdited },
                { columnName: "test_enum", value: enumEdited },
                { columnName: "test_set", value: setEdited },
                { columnName: "test_json", value: jsonEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_chars where id = (select max(id) from sakila.all_data_types_chars);");
            expect(result1.toolbar.status).to.match(/OK/);

            const row = 0;
            const testChar = await result1.grid.getCellValue(row, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await result1.grid.getCellValue(row, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await result1.grid.getCellValue(row, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await result1.grid.getCellValue(row, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await result1.grid.getCellValue(row, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await result1.grid.getCellValue(row, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await result1.grid.getCellValue(row, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await result1.grid.getCellValue(row, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await result1.grid.getCellValue(row, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(jsonEdited);

        });

        it("Add new row on result grid - geometry columns", async () => {

            await notebook.codeEditor.clean();
            let result = await notebook.codeEditor.execute("select * from sakila.all_data_types_geometries;");
            expect(result.toolbar.status).to.match(/OK/);

            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPolyEd = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEdited = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "11111011111111";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_bit", value: bitEdited },
                { columnName: "test_point", value: pointEdited },
                { columnName: "test_linestring", value: lineStringEdited },
                { columnName: "test_polygon", value: polygonEdited },
                { columnName: "test_multipoint", value: multiPointEdited },
                { columnName: "test_multilinestring", value: multiLineStrEdited },
                { columnName: "test_multipolygon", value: multiPolyEd },
                { columnName: "test_geometrycollection", value: geoCollEdited },
            ];

            await result.grid.addRow(rowToAdd);
            await result.toolbar.applyChanges();

            await driver.wait(result.toolbar.untilStatusMatches(/(\d+).*updated/), constants.wait5seconds);
            result = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_geometries where id = (select max(id) from sakila.all_data_types_geometries);");
            expect(result.toolbar.status).to.match(/OK/);
            const row = 0;
            const testPoint = await result.grid.getCellValue(row, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await result.grid.getCellValue(row, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await result.grid.getCellValue(row, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await result.grid.getCellValue(row, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await result.grid.getCellValue(row, "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await result.grid.getCellValue(row, "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await result.grid.getCellValue(row, "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await result.grid.getCellValue(row, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("16127");

        });

        it("Close a result set", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
            expect(result.toolbar.status).to.match(/OK/);

            const id = result.id;
            await result.toolbar.closeResultSet();

            await driver.wait(async () => {
                return (await driver.findElements(locator.notebook.codeEditor.editor.result.existsById(id)))
                    .length === 0;
            }, constants.wait5seconds, `The result set was not closed`);
            await notebook.codeEditor.clean();

        });

        it("Unsaved changes dialog on result grid", async () => {

            await Workbench.openMySQLShellForVSCode();
            const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await openEditorsSection.expand();
            const openEditorsGlobalConn = await openEditorsSection.tree.getElement(globalConn.caption);
            await (await openEditorsGlobalConn.getActionButton(constants.newMySQLScript)).click();
            const anotherConnection = await dbTreeSection.tree
                .getElement(anotherConn.caption);
            await dbTreeSection.tree.openContextMenuAndSelect(anotherConnection, constants.openNewConnection);
            const anotherConnNotebook = new E2ENotebook();
            await driver.wait(anotherConnNotebook.untilIsOpened(anotherConn), constants.wait5seconds);
            const treeConn = await dbTreeSection.tree.getElement(globalConn.caption);
            await dbTreeSection.tree.expandDatabaseConnection(treeConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await dbTreeSection.tree.expandElement([new RegExp(constants.mysqlAdmin)]);
            await notebook.toolbar.selectEditor(new RegExp(constants.openEditorsDBNotebook), globalConn.caption);
            await driver.wait(anotherConnNotebook.untilIsOpened(anotherConn), constants.wait5seconds);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.all_data_types where test_id = 1;",
                undefined,
                (parseInt(notebook.codeEditor.resultIds[notebook.codeEditor.resultIds.length - 1],
                    10) - 2) as unknown as string);
            expect(result.toolbar.status).to.match(/OK/);
            const cellsToEdit: interfaces.IResultGridCell[] = [
                {
                    rowNumber: 0,
                    columnName: "test_smallint",
                    value: "32751",
                }];
            await result.grid.editCells(cellsToEdit);

            await (await dbTreeSection.tree.getElement(constants.serverStatus)).click();
            let dialog = await driver
                .wait(Workbench.untilConfirmationDialogExists(" after switching to Server Status page")
                    , constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);
            await (await dbTreeSection.tree.getElement(constants.clientConns)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Client Connections page"), constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await (await dbTreeSection.tree.getElement(constants.perfDash)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Performance Dashboard page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await notebook.toolbar.selectEditor(/DB Connection Overview/);
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to DB Connections Overview page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");

            await notebook.toolbar.selectEditor(/Untitled-(\d+)/, globalConn.caption);
            dialog = await driver.wait(Workbench.untilConfirmationDialogExists(" after switching to a script page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.refuse).click();
            await driver.wait(until.stalenessOf(dialog), constants.wait3seconds, "The dialog was not closed");

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/test`;
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
                await (await dbTreeSection.tree.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
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
            const file = await (await e2eTreeSection.getWebElement()).findItem("test.mysql-notebook", 3);
            await file.click();
            const input = await InputBox.create(constants.wait5seconds * 4);
            await (await input.findQuickPick(globalConn.caption)).select();
            await Workbench.openEditor("test.mysql-notebook");
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");
            await Workbench.closeEditor("test.mysql-notebook", true);

        });

        it("Open the Notebook from file with connection", async () => {

            await Workbench.closeAllEditors();
            await browser.openResources(process.cwd());
            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("test.mysql-notebook", 3);
            await e2eTreeSection.tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await driver.wait(Workbench.untilTabIsOpened("test.mysql-notebook"), constants.wait5seconds);
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await notebook.exists("SELECT VERSION");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("test.mysql-notebook", 3);
            await file.click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
            await Workbench.openEditor("test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl(constants.extensionName))?.openView();
            await dbTreeSection.tree.deleteDatabaseConnection(globalConn.caption);
            const tabs = await Workbench.getOpenEditorTitles();
            expect(tabs, errors.tabIsNotOpened("test.mysql-notebook")).to.not.include("test.mysql-notebook");

        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await dbTreeSection.getDatabaseConnections();

            for (const conn of conns) {
                await dbTreeSection.tree.deleteDatabaseConnection(conn.name, conn.isMySQL);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            await driver.wait(e2eTreeSection.untilExists(), constants.wait5seconds);
            const file = await (await e2eTreeSection.getWebElement()).findItem("test.mysql-notebook", 3);
            await file.click();
            await Workbench.openEditor("test.mysql-notebook");
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);
            await Misc.switchToFrame();
            expect(await driver.findElement(locator.htmlTag.h2).getText(), "'No connection selected' message was found")
                .to.equals("No connection selected");
            await Workbench.closeAllEditors();
            await e2eTreeSection.tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);

        });

    });

    describe("Lakehouse Navigator", () => {

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
            name: "cookbook",
            description: "How do cook properly",
            targetDatabaseSchema: "e2e_tests",
            formats: "PDF (Portable Document Format Files)",
        };

        const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
        const lakeHouseNavigator = new LakeHouseNavigator();
        const cookbookFile = "cookbook.pdf";
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

        after(async function () {
            try {
                await lakeHouseNavigator.toolbar.selectEditor(new RegExp(constants.lakeHouseNavigatorEditor),
                    "lakehouseNavigator");
                await lakeHouseNavigator.selectTab(constants.lakeHouseTablesTab);
                await lakeHouseNavigator.lakehouseTables.deleteLakeHouseTable(newTask.name);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Upload data to object storage", async () => {

            await Workbench.toggleSideBar(false);
            await (await notebook.toolbar.getButton(constants.openLakeHouseNavigator)).click();
            await driver.wait(lakeHouseNavigator.untilIsOpened(), constants.wait5seconds);
            await lakeHouseNavigator.overview.clickUploadFiles();
            await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.selectOciProfile("HEATWAVE");
            await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
            await driver.wait(lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                constants.wait15seconds);
            await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
            await (await lakeHouseNavigator.uploadToObjectStorage.getFilesForUploadButton(constants.addFiles)).click();
            await lakeHouseNavigator.uploadToObjectStorage.setFilesForUploadFilePath(join(process.cwd(), cookbookFile));
            await driver.wait(lakeHouseNavigator.uploadToObjectStorage.untilExistsFileForUploadFile(cookbookFile),
                constants.wait10seconds);
            await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.checkItem("upload");
            await (await lakeHouseNavigator.uploadToObjectStorage.getFilesForUploadButton(constants.startFileUpload))
                .click();
            await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
            await driver.wait(lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                constants.wait10seconds);
            expect(await lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser.existsItem(cookbookFile))
                .to.be.true;
            await driver.wait(Workbench.untilNotificationExists("The files have been uploaded successfully"),
                constants.wait20seconds);

        });

        it("Load into Lakehouse", async () => {

            await lakeHouseNavigator.selectTab(constants.loadIntoLakeHouseTab);
            await driver.wait(lakeHouseNavigator.loadIntoLakehouse.objectStorageBrowser.untilItemsAreLoaded(),
                constants.wait10seconds);
            expect(await lakeHouseNavigator.loadIntoLakehouse.objectStorageBrowser.existsItem(cookbookFile),
                `'${cookbookFile}' was not found`).to.be.true;
            await lakeHouseNavigator.loadIntoLakehouse.objectStorageBrowser.checkItem(cookbookFile);
            await driver.wait(lakeHouseNavigator.loadIntoLakehouse.untilExistsLoadingTask(cookbookFile),
                constants.wait5seconds);
            await lakeHouseNavigator.loadIntoLakehouse.setNewLoadingTask(newTask);
            await lakeHouseNavigator.loadIntoLakehouse.startLoadingTask();

        });

        it("Lakehouse Tables", async () => {

            await driver.wait(lakeHouseNavigator.lakehouseTables.untilIsOpened(), constants.wait15seconds);
            expect(await lakeHouseNavigator.lakehouseTables.getDatabaseSchemas())
                .to.contain(newTask.targetDatabaseSchema);
            await driver.wait(lakeHouseNavigator.lakehouseTables.untilExistsLakeHouseTable(newTask.name),
                constants.wait10seconds);
            await driver.wait(lakeHouseNavigator.lakehouseTables.untilLakeHouseTableIsLoading(newTask.name),
                constants.wait25seconds);

            let latestTable = await lakeHouseNavigator.lakehouseTables.getLakehouseTable(newTask.name);
            expect(latestTable.hasProgressBar).to.be.true;
            expect(latestTable.loaded).to.match(/(\d+)%/);
            expect(latestTable.hasLoadingSpinner).to.be.true;
            expect(latestTable.rows).to.equals("-");
            expect(latestTable.size).to.equals("-");
            expect(latestTable.date).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTable.comment).to.equals(newTask.description);

            let latestTask = await lakeHouseNavigator.lakehouseTables.getLatestTask();
            expect(latestTask.name).to.equals(`Loading ${newTask.name}`);
            expect(latestTask.status).to.equals("RUNNING");
            expect(latestTask.startTime).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTask.endTime).to.match(/((\d+)-(\d+)-(\d+) (\d+):(\d+)|-)/);
            expect(latestTask.message).to.equals("Loading in progress...");

            await driver.wait(lakeHouseNavigator.lakehouseTables.untilLakeHouseTableIsLoaded(newTask.name),
                constants.wait2minutes);

            latestTable = await lakeHouseNavigator.lakehouseTables.getLakehouseTable(newTask.name);
            expect(latestTable.hasProgressBar).to.be.false;
            expect(latestTable.loaded).to.equals("Yes");
            expect(latestTable.hasLoadingSpinner).to.be.false;
            expect(latestTable.rows).to.match(/(\d+)/);
            expect(latestTable.size).to.match(/(\d+).(\d+) KB/);
            expect(latestTable.date).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTable.comment).to.equals(newTask.description);

            await driver.wait(lakeHouseNavigator.lakehouseTables.untilLakeHouseTaskIsCompleted(latestTask.id),
                constants.wait10seconds);

            latestTask = await lakeHouseNavigator.lakehouseTables.getLatestTask();
            expect(latestTask.name).to.equals(`Loading ${newTask.name}`);
            expect(latestTask.hasProgressBar).to.be.false;
            expect(latestTask.status).to.equals("COMPLETED");
            expect(latestTask.startTime).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTask.endTime).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTask.message).to.equals("Task completed.");

        });

        it("HeatWave Chat", async () => {

            await lakeHouseNavigator.toolbar
                .selectEditor(new RegExp(constants.openEditorsDBNotebook), heatWaveConn.caption);
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait3seconds);
            const query = "How do I cook some waffles?";
            await Workbench.toggleSideBar(false);
            await (await notebook.toolbar.getButton(constants.showChatOptions)).click();
            const hwProfileEditor = new HeatWaveProfileEditor();
            await driver.wait(hwProfileEditor.untilIsOpened(), constants.wait5seconds);
            await hwProfileEditor.selectModel(constants.modelMistral);
            await notebook.codeEditor.languageSwitch("\\chat");
            await notebook.codeEditor.loadCommandResults();
            const result = await notebook.codeEditor.execute(query);
            expect(result.chat.length).to.be.greaterThan(0);

            const history = await hwProfileEditor.getHistory();
            expect(history[0].userMessage).to.equals(query);
            expect(history[0].chatBotOptions.length).to.be.greaterThan(0);
            const dbTables = await hwProfileEditor.getDatabaseTables();
            expect(dbTables[0]).to.equals(`\`${newTask.targetDatabaseSchema}\`.\`${newTask.name}\``);
            const matchedDocuments = await hwProfileEditor.getMatchedDocuments();
            expect(matchedDocuments.length).to.be.greaterThan(0);

            for (const doc of matchedDocuments) {
                expect(doc.title).to.equals(cookbookFile);
            }

        });

    });

});
