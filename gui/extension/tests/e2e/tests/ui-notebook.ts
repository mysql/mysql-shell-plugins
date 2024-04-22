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
import {
    ActivityBar, Condition, CustomTreeSection, InputBox, Key, TreeItem,
    until, WebElement,
} from "vscode-extension-tester";
import { join } from "path";
import clipboard from "clipboardy";
import { browser, driver, Misc } from "../lib/misc";
import { Notebook } from "../lib/webviews/notebook";
import { CommandExecutor } from "../lib/cmdExecutor";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { DatabaseConnectionOverview } from "../lib/webviews/dbConnectionOverview";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import { DialogHelper } from "../lib/webviews/dialogHelper";
import * as errors from "../lib/errors";

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
        caption: "globalDBConnection",
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
        caption: "anotherDBConnection",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await Workbench.removeAllDatabaseConnections();
            await Section.createDatabaseConnection(anotherConn);
            await Section.createDatabaseConnection(globalConn);
            await (await DatabaseConnectionOverview.getConnection(globalConn.caption)).click();
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait10seconds);
            await Section.focus(constants.dbTreeSection);
            if (await Workbench.requiresMRSMetadataUpgrade(globalConn)) {
                await Workbench.upgradeMRSMetadata();
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            await Workbench.removeAllDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("DB Editor", () => {

        const commandExecutor = new CommandExecutor();
        let cleanEditor = false;

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
                commandExecutor.reset();
            }
            if (cleanEditor) {
                await commandExecutor.clean();
                cleanEditor = false;
            }
        });

        after(async function () {
            try {
                await Workbench.openMySQLShellForVSCode();
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {
                await commandExecutor.write("select * from sakila.actor;");
                await Notebook.setNewLineOnEditor();
                await commandExecutor.write("select * from sakila.address;");
                await Notebook.setNewLineOnEditor();
                await commandExecutor.write("select * from sakila.city;");

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

            await commandExecutor.executeWithButton(query, constants.execFullBlockSql);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const content = commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[];
            expect(content.length, "The result should have 2 tabs").to.equals(2);
            for (const result of content) {
                expect(result.tabName, `The result tab name should match ${result.tabName}`).to.match(/Result/);
            }

        });

        it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
            await commandExecutor.executeWithButton("SELECT * FROM sakila.actor;", constants.execAsText);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("(\\d+) record",
                commandExecutor.getResultMessage())).to.match(/(\d+) record/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .to.match(/\|.*\|/);
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

            await commandExecutor.executeWithButton("SELECT * FROM sakila.actor;", constants.execFullBlockSql);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("(\\d+) record",
                commandExecutor.getResultMessage())).to.match(/(\d+) record/);
            await driver.wait(waitUntil.editorHasNewPrompt(),
                constants.wait5seconds, "Editor should have a new prompt");
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";
                await commandExecutor.write(query1, true);
                await Notebook.setNewLineOnEditor();
                await commandExecutor.write(query2, true);
                await commandExecutor.findAndExecute(query1);
                expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                    commandExecutor.getResultMessage())).to.match(/OK/);
                expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                    errors.queryDataSetError("actor_id"))
                    .to.match(/actor_id/);
                await driver.sleep(1000);
                await commandExecutor.findAndExecute(query2, commandExecutor.getResultId());
                expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                    errors.queryDataSetError("address_id"))
                    .to.match(/address_id/);
            } finally {
                cleanEditor = true;
            }
        });

        it("Switch between search tabs", async () => {

            await commandExecutor
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;", true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const resultTabs = (commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[]);
            expect(resultTabs[0].tabName, `First result tab name should be Result #1`).to.equals("Result #1");
            expect(resultTabs[1].tabName, `Second result tab name should be Result #2`).to.equals("Result #2");
            let error = "The result set should contain columns actor_id,";
            error += " first_name, last_name and last_update";
            expect(resultTabs[0].content, error).to.match(/actor_id.*first_name.*last_name.*last_update/);
            error = "The result set should contain columns address,";
            error += " address2, district, city_id, postal_code, phone and last_update";
            expect(resultTabs[1].content, error)
                .to.match(/address.*address2.*district.*city_id.*postal_code.*phone.*last_update/);
        });

        it("Connect to database and verify default schema", async () => {

            await commandExecutor.execute("SELECT SCHEMA();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("1 record retrieved",
                commandExecutor.getResultMessage()))
                .to.match(/1 record retrieved/);
            expect(await ((commandExecutor.getResultContent() as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell)).getText(),
                errors.queryDataSetError((globalConn.basic as interfaces.IConnBasicMySQL).schema))
                .to.equals((globalConn.basic as interfaces.IConnBasicMySQL).schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommitBtn = await Notebook.getToolbarButton(constants.autoCommit);
            const style = await autoCommitBtn.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await Notebook.getToolbarButton(constants.commit);
            const rollBackBtn = await Notebook.getToolbarButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn),
                constants.wait3seconds, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn),
                constants.wait3seconds, "Commit button should be enabled");

            await commandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            await rollBackBtn.click();

            await commandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            await commandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            await commitBtn.click();

            await commandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            await autoCommitBtn.click();

            await driver.wait(
                async () => {
                    const commitBtn = await Notebook.getToolbarButton(constants.commit);
                    const rollBackBtn = await Notebook.getToolbarButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait5seconds,
                "Commit/Rollback DB changes button is still enabled ",
            );

            await commandExecutor.execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
        });

        it("Connection toolbar buttons - Find and Replace", async () => {
            try {
                const contentHost = await driver.findElement(locator.notebook.exists);
                await commandExecutor.write(`import from xpto xpto xpto`);
                const findBtn = await Notebook.getToolbarButton("Find");
                await findBtn.click();
                const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                    constants.wait5seconds, "Find widget was not displayed");
                await finder.findElement(locator.notebook.codeEditor.textArea).sendKeys("xpto");
                await Notebook.widgetFindInSelection(false);
                expect(
                    await finder.findElement(locator.findWidget.matchesCount).getText(), `No matches found for xpto`,
                ).to.match(/1 of (\d+)/);
                await driver.wait(
                    until.elementsLocated(locator.findWidget.findMatch),
                    constants.wait2seconds,
                    "No words found",
                );
                await Notebook.widgetExpandFinderReplace(true);
                const replacer = await finder.findElement(locator.findWidget.replacePart);
                await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("tester");
                await driver.wait(async () => {
                    await (await Notebook.widgetGetReplacerButton("Replace (Enter)")).click();

                    return (await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                        .match(/import from tester xpto xpto/);
                }, constants.wait5seconds, "'xpto' was not replaced by tester");

                await replacer.findElement(locator.notebook.codeEditor.textArea).clear();
                await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing");
                await (await Notebook.widgetGetReplacerButton("Replace All")).click();
                expect(
                    await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                    `'import from tester testing testing' was not found on the editor`,
                ).to.include("import from tester testing testing");
                await Notebook.widgetCloseFinder();
            } finally {
                cleanEditor = true;
            }

        });

        it("Execute code on different prompt languages", async () => {
            try {
                const query = "select * from sakila.actor limit 1";
                const languageSwitch = "\\javascript ";
                const jsCmd = "Math.random()";
                await commandExecutor.execute(query);
                const block1 = commandExecutor.getResultId();
                expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                    commandExecutor.getResultMessage())).to.match(/OK/);
                await commandExecutor.languageSwitch(languageSwitch);
                await commandExecutor.execute(jsCmd, undefined, block1);
                const block2 = commandExecutor.getResultId();
                expect(commandExecutor.getResultMessage(), `The query result is not a number`).to.match(/(\d+).(\d+)/);
                await commandExecutor.findAndExecute(query, block1);
                expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                    commandExecutor.getResultMessage())).to.match(/OK/);
                await commandExecutor.findAndExecute(jsCmd, block2);
                expect(commandExecutor.getResultMessage(), `The query result is not a number`).to.match(/(\d+).(\d+)/);
            } finally {
                cleanEditor = true;
            }
        });

        it("Multi-line comments", async () => {

            await commandExecutor.languageSwitch("\\sql ", true);
            await commandExecutor.execute("select version();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("1 record retrieved",
                commandExecutor.getResultMessage())).to.match(/1 record retrieved/);
            const txt = await (commandExecutor.getResultContent() as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell).getText();
            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];
            await commandExecutor.execute(`/*!${serverVer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK, (\\d+) records retrieved",
                commandExecutor.getResultMessage())).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            await commandExecutor.execute(`/*!${higherServer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK, 0 records retrieved",
                commandExecutor.getResultMessage())).to.match(/OK, 0 records retrieved/);

        });

        it("Maximize and Normalize Result tab", async () => {

            await commandExecutor.execute("select * from sakila.actor;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            await (commandExecutor.getResultToolbar())
                .findElement(locator.notebook.codeEditor.editor.result.status.maximize).click();
            await driver.wait(waitUntil.resultTabIsMaximized(), constants.wait5seconds);

            expect(await Notebook.getCurrentEditorName(), `The current editor name should be Result #1`)
                .to.equals("Result #1");
            try {
                expect(await Notebook.isResultMaximized(), "The the result set should not be maximized").to.be.false;
                let tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabSection.body);
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await driver.findElement(locator.notebook.codeEditor.editor.result.status.normalize).click();
                expect(await Notebook.isResultMaximized(), "The result set should be maximized").to.be.true;
                await driver.wait(waitUntil.resultTabIsNormalized, constants.wait5seconds);
                tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabSection.body);
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await Notebook.selectCurrentEditor(new RegExp(constants.openEditorsDBNotebook), "notebook");
                await commandExecutor.synchronizeResultId();
            }
        });

        it("Pie Graph based on DB table", async () => {
            await commandExecutor.languageSwitch("\\ts ", true);
            await commandExecutor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`);

            expect(commandExecutor.getResultMessage(), "Not graph was found").to.match(/graph/);
            const pieChart = commandExecutor.getResultContent();
            const chartColumns = await (pieChart as WebElement)
                .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10),
                    `The chart column should be fulfilled`).to.be.greaterThan(0);
            }

        });

        it("Autocomplete context menu", async () => {

            await commandExecutor.languageSwitch("\\sql ", true);
            await commandExecutor.write("select sak", true);
            await commandExecutor.openSuggestionMenu();
            let els = await Notebook.getAutoCompleteMenuItems();
            expect(els.toString(), "'sakila' was not found on the autocomplete items list").to.match(/sakila/);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write("ila.", true);
            await commandExecutor.openSuggestionMenu();
            els = await Notebook.getAutoCompleteMenuItems();
            expect(els.toString(), "'actor', 'address', or 'category' should exist on the autocomplete items list")
                .to.match(/(actor|address|category)/);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write("actor.", true);
            await commandExecutor.openSuggestionMenu();
            els = await Notebook.getAutoCompleteMenuItems();
            expect(els.toString(),
                "'actor_id', 'first_name' or 'last_name' should exist on the autocomplete items list")
                .to.match(/(actor_id|first_name|last_name)/);
            await textArea.sendKeys(Key.ESCAPE);
        });

        it("Copy paste into notebook", async () => {
            await commandExecutor.clean();
            await Misc.switchBackToTopFrame();
            const filename = "users.sql";
            await browser.openResources(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", filename));
            await driver.wait(waitUntil.tabIsOpened(filename), constants.wait5seconds);
            let textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardSelectAll(textArea);
            await Os.keyboardCopy(textArea);
            await Workbench.openEditor(`${constants.openEditorsDBNotebook} (${globalConn.caption})`);
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
            const findBtn = await Notebook.getToolbarButton("Find");
            await findBtn.click();
            const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                constants.wait5seconds, "Find widget was not displayed");
            const finderTextArea = await finder.findElement(locator.notebook.codeEditor.textArea);
            for (const line of fileLines) {
                if (line.trim() !== "") {
                    await finderTextArea.sendKeys(line.substring(0, 150).replace(/`|;/gm, ""));
                    expect(
                        await finder.findElement(locator.findWidget.matchesCount).getText(),
                        `${line} was not found on the editor`,
                    ).to.match(/1 of (\d+)/);
                    await DialogHelper.clearInputField(finderTextArea);
                }
            }
        });

        it("Cut paste into notebook", async () => {
            const sentence1 = "select * from sakila.actor";
            const sentence2 = "select * from sakila.address";
            await Notebook.widgetCloseFinder();
            await commandExecutor.clean();
            await commandExecutor.write(sentence1);
            await Notebook.setNewLineOnEditor();
            await commandExecutor.write(sentence2);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardSelectAll(textArea);
            await Os.keyboardCut(textArea);
            expect(await Notebook.existsOnNotebook(sentence1), `${sentence1} should not exist on the notebook`)
                .to.be.false;
            expect(await Notebook.existsOnNotebook(sentence2),
                `${sentence2} should not exist on the notebook`).to.be.false;
            await Os.keyboardPaste(textArea);
            expect(await Notebook.existsOnNotebook(sentence1), `${sentence1} should exist on the notebook`).to.be.true;
            expect(await Notebook.existsOnNotebook(sentence2), `${sentence2} should exist on the notebook`).to.be.true;
        });

        it("Copy to clipboard button", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("\\about ");
            await commandExecutor.copyResultToClipboard();
            await commandExecutor.clean();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardPaste(textArea);
            await driver.wait(async () => {
                return Notebook.existsOnNotebook("Welcome");
            }, constants.wait5seconds, "The text was not pasted to the notebook");
        });

        it("Verify mysql data types - integer columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("SELECT * from sakila.all_data_types_ints;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const booleanCell = await commandExecutor.getCellValueFromResultGrid(row, "test_boolean");
            const smallIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_smallint");
            const mediumIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumint");
            const intField = await commandExecutor.getCellValueFromResultGrid(row, "test_integer");
            const bigIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_bigint");
            const decimalField = await commandExecutor.getCellValueFromResultGrid(row, "test_decimal");
            const floatFIeld = await commandExecutor.getCellValueFromResultGrid(row, "test_float");
            const doubleField = await commandExecutor.getCellValueFromResultGrid(row, "test_double");

            expect(booleanCell, "The cell should have a select list").to.match(/(true|false)/);
            expect(smallIntField, errors.incorrectCellValue("SMALLINT")).to.match(/(\d+)/);
            expect(mediumIntField, errors.incorrectCellValue("MEDIUMINT")).to.match(/(\d+)/);
            expect(intField, errors.incorrectCellValue("INT")).to.match(/(\d+)/);
            expect(bigIntField, errors.incorrectCellValue("BIGINT")).to.match(/(\d+)/);
            expect(decimalField, errors.incorrectCellValue("DECIMAL")).to.match(/(\d+).(\d+)/);
            expect(floatFIeld, errors.incorrectCellValue("FLOAT")).to.match(/(\d+).(\d+)/);
            expect(doubleField, errors.incorrectCellValue("DOUBLE")).to.match(/(\d+).(\d+)/);
        });

        it("Verify mysql data types - date columns", async () => {
            await commandExecutor.execute("SELECT * from sakila.all_data_types_dates;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const dateField = await commandExecutor.getCellValueFromResultGrid(row, "test_date");
            const dateTimeField = await commandExecutor.getCellValueFromResultGrid(row, "test_datetime");
            const timeStampField = await commandExecutor.getCellValueFromResultGrid(row, "test_timestamp");
            const timeField = await commandExecutor.getCellValueFromResultGrid(row, "test_time");
            const yearField = await commandExecutor.getCellValueFromResultGrid(row, "test_year");

            expect(dateField, errors.incorrectCellValue("DATE")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(dateTimeField, errors.incorrectCellValue("DATETIME")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeStampField, errors.incorrectCellValue("TIMESTAMP")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeField, errors.incorrectCellValue("TIME")).to.match(/(\d+):(\d+):(\d+)/);
            expect(yearField, errors.incorrectCellValue("YEAR")).to.match(/(\d+)/);
        });

        it("Verify mysql data types - char columns", async () => {
            await commandExecutor.execute("SELECT * from sakila.all_data_types_chars;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const charField = await commandExecutor.getCellValueFromResultGrid(row, "test_char");
            const varCharField = await commandExecutor.getCellValueFromResultGrid(row, "test_varchar");
            const tinyTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_tinytext");
            const textField = await commandExecutor.getCellValueFromResultGrid(row, "test_text");
            const mediumTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumtext");
            const longTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_longtext");
            const enumField = await commandExecutor.getCellValueFromResultGrid(row, "test_enum");
            const setFIeld = await commandExecutor.getCellValueFromResultGrid(row, "test_set");

            expect(charField, errors.incorrectCellValue("CHAR")).to.match(/([a-z]|[A-Z])/);
            expect(varCharField, errors.incorrectCellValue("VARCHAR")).to.match(/([a-z]|[A-Z])/);
            expect(tinyTextField, errors.incorrectCellValue("TINYTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(textField, errors.incorrectCellValue("TEXT")).to.match(/([a-z]|[A-Z])/);
            expect(mediumTextField, errors.incorrectCellValue("MEDIUMTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(longTextField, errors.incorrectCellValue("LONGTEXT")).to.match(/([a-z]|[A-Z])/);
            expect(enumField, errors.incorrectCellValue("ENUM")).to.match(/([a-z]|[A-Z])/);
            expect(setFIeld, errors.incorrectCellValue("SET")).to.match(/([a-z]|[A-Z])/);
            expect(await commandExecutor.getCellIconType(row, "test_json"), "The cell should have a JSON icon")
                .to.equals(constants.json);
        });

        it("Verify mysql data types - blob columns", async () => {
            await commandExecutor.execute("SELECT * from sakila.all_data_types_blobs;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const binaryField = await commandExecutor.getCellValueFromResultGrid(row, "test_binary");
            const varBinaryField = await commandExecutor.getCellValueFromResultGrid(row, "test_varbinary");

            expect(await commandExecutor.getCellIconType(row, "test_tinyblob")).to.equals(constants.blob);
            expect(await commandExecutor.getCellIconType(row, "test_blob")).to.equals(constants.blob);
            expect(await commandExecutor.getCellIconType(row, "test_mediumblob")).to.equals(constants.blob);
            expect(await commandExecutor.getCellIconType(row, "test_longblob")).to.equals(constants.blob);
            expect(binaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
            expect(varBinaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
        });

        it("Verify mysql data types - geometry columns", async () => {
            await commandExecutor.execute("SELECT * from sakila.all_data_types_geometries;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const bitCell = await commandExecutor.getCellValueFromResultGrid(row, "test_bit");
            expect(await commandExecutor.getCellIconType(row, "test_point"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_linestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_polygon"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_multipoint"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_multilinestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_multipolygon"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await commandExecutor.getCellIconType(row, "test_geometrycollection"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(bitCell, errors.incorrectCellValue("BIT")).to.match(/(\d+)/);
        });

        it("Edit a result grid, verify query preview and commit - integer columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_ints;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const booleanEdited = false;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.70";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";

            const rowToEdit = 0;
            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_boolean", value: booleanEdited },
                { rowNumber: rowToEdit, columnName: "test_smallint", value: smallIntEdited },
                { rowNumber: rowToEdit, columnName: "test_mediumint", value: mediumIntEdited },
                { rowNumber: rowToEdit, columnName: "test_integer", value: intEdited },
                { rowNumber: rowToEdit, columnName: "test_bigint", value: bigIntEdited },
                { rowNumber: rowToEdit, columnName: "test_decimal", value: decimalEdited },
                { rowNumber: rowToEdit, columnName: "test_float", value: floatEdited },
                { rowNumber: rowToEdit, columnName: "test_double", value: doubleEdited },
            ];
            await commandExecutor.editResultGridCells(cellsToEdit);
            const booleanField = booleanEdited ? 1 : 0;
            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_ints SET/,
                new RegExp(`test_boolean = ${booleanField}`),
                new RegExp(`test_smallint = ${smallIntEdited}`),
                new RegExp(`test_mediumint = ${mediumIntEdited}`),
                new RegExp(`test_integer = ${intEdited}`),
                new RegExp(`test_bigint = ${bigIntEdited}`),
                new RegExp(`test_decimal = ${decimalEdited}`),
                new RegExp(`test_float = ${floatEdited}`),
                new RegExp(`test_double = ${doubleEdited}`),
                /WHERE id = 1;/,
            ];
            const sqlPreview = await commandExecutor.getSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(sqlPreview).to.match(expectedSqlPreview[i]);
            }
            const sqlPreviewEl = await commandExecutor.getSqlPreview(true);
            await driver.actions().doubleClick(sqlPreviewEl as WebElement).perform();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const resultGrid = commandExecutor.getResultContent() as WebElement;
            const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
            expect(await rows[rowToEdit].getAttribute("class"),
                "The row should be highlighted after clicking on the SQL Preview link")
                .to.include("tabulator-selected");

            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);

            await commandExecutor.execute("select * from sakila.all_data_types_ints where id = 1;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const testBoolean = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);
        });

        it("Edit a result grid, verify query preview and commit - date columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_dates;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
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
            await commandExecutor.editResultGridCells(cellsToEdit);
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
            const sqlPreview = await commandExecutor.getSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(sqlPreview).to.match(expectedSqlPreview[i]);
            }
            const sqlPreviewEl = await commandExecutor.getSqlPreview(true);
            await driver.actions().doubleClick(sqlPreviewEl as WebElement).perform();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const resultGrid = commandExecutor.getResultContent() as WebElement;
            const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
            expect(await rows[rowToEdit].getAttribute("class"),
                "The row should be highlighted after clicking on the SQL Preview link")
                .to.include("tabulator-selected");

            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);

            await commandExecutor.execute("select * from sakila.all_data_types_dates where id = 1;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const testDate = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);
        });

        it("Edit a result grid, verify query preview and commit - char columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_chars;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value2";
            const setEdited = "value2";
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
            await commandExecutor.editResultGridCells(cellsToEdit);

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
                /WHERE id = 1;/,
            ];
            const sqlPreview = await commandExecutor.getSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(sqlPreview).to.match(expectedSqlPreview[i]);
            }
            const sqlPreviewEl = await commandExecutor.getSqlPreview(true);
            await driver.actions().doubleClick(sqlPreviewEl as WebElement).perform();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const resultGrid = commandExecutor.getResultContent() as WebElement;
            const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
            expect(await rows[rowToEdit].getAttribute("class"),
                "The row should be highlighted after clicking on the SQL Preview link")
                .to.include("tabulator-selected");

            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);

            await commandExecutor.execute("select * from sakila.all_data_types_chars where id = 1;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const testChar = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(constants.json);
        });

        it("Edit a result grid, verify query preview and commit - geometry columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_geometries;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPoly = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEd = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "1";
            const rowToEdit = 0;

            const cellsToEdit: interfaces.IResultGridCell[] = [
                { rowNumber: rowToEdit, columnName: "test_point", value: pointEdited },
                { rowNumber: rowToEdit, columnName: "test_linestring", value: lineStringEdited },
                { rowNumber: rowToEdit, columnName: "test_polygon", value: polygonEdited },
                { rowNumber: rowToEdit, columnName: "test_multipoint", value: multiPointEdited },
                { rowNumber: rowToEdit, columnName: "test_multilinestring", value: multiLineStrEdited },
                { rowNumber: rowToEdit, columnName: "test_multipolygon", value: multiPoly },
                { rowNumber: rowToEdit, columnName: "test_geometrycollection", value: geoCollEd },
                { rowNumber: rowToEdit, columnName: "test_bit", value: bitEdited },
            ];
            await commandExecutor.editResultGridCells(cellsToEdit);

            const expectedSqlPreview = [
                /UPDATE sakila.all_data_types_geometries SET/,
                Misc.transformToMatch(`test_point = ${pointEdited}`),
                Misc.transformToMatch(`test_linestring = ${lineStringEdited}`),
                Misc.transformToMatch(`test_polygon = ${polygonEdited}`),
                Misc.transformToMatch(`test_multipoint = ${multiPointEdited}`),
                Misc.transformToMatch(`test_multilinestring = ${multiLineStrEdited}`),
                Misc.transformToMatch(`test_multipolygon = ${multiPoly}`),
                Misc.transformToMatch(`test_geometrycollection = ${geoCollEd}`),
                new RegExp(`test_bit = b'${bitEdited}' WHERE id = 1;`),
            ];
            const sqlPreview = await commandExecutor.getSqlPreview();
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(sqlPreview).to.match(expectedSqlPreview[i]);
            }
            const sqlPreviewEl = await commandExecutor.getSqlPreview(true);
            await driver.actions().doubleClick(sqlPreviewEl as WebElement).perform();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const resultGrid = commandExecutor.getResultContent() as WebElement;
            const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
            expect(await rows[rowToEdit].getAttribute("class"),
                "The row should be highlighted after clicking on the SQL Preview link")
                .to.include("tabulator-selected");

            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);

            await commandExecutor.execute("select * from sakila.all_data_types_geometries where id = 1;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const testPoint = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
                "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
                "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
                "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("1");
        });

        it("Edit a result grid and rollback", async () => {
            const modifiedText = "56";
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_ints;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            await commandExecutor.editResultGridCells(
                [{
                    rowNumber: 0,
                    columnName: "test_integer",
                    value: modifiedText,
                }]);
            await commandExecutor.resultGridRollbackChanges();
            const confirmDialog = await driver.wait(waitUntil.confirmationDialogExists("for rollback"));
            await confirmDialog.findElement(locator.confirmDialog.accept).click();
            expect((await (commandExecutor.getResultContent() as WebElement)
                .getAttribute("innerHTML")).match(/rollbackTest/) === null,
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
            await commandExecutor.clean();
            for (const query of queries) {
                await commandExecutor.execute(query);
                expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                    commandExecutor.getResultMessage())).to.match(/OK/);
                const editBtn = await commandExecutor.getResultToolbar()
                    .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.editButton);
                expect(await editBtn.getAttribute("data-tooltip"),
                    `'${query}' should not be editable`).to.equal("Data not editable");
            }
        });

        it("Add new row on result grid - integer columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_ints;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const booleanEdited = true;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.70";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_boolean", value: booleanEdited },
                { columnName: "test_smallint", value: smallIntEdited },
                { columnName: "test_mediumint", value: mediumIntEdited },
                { columnName: "test_integer", value: intEdited },
                { columnName: "test_bigint", value: bigIntEdited },
                { columnName: "test_decimal", value: decimalEdited },
                { columnName: "test_float", value: floatEdited },
                { columnName: "test_double", value: doubleEdited },
            ];

            await commandExecutor.addResultGridRow(rowToAdd);
            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);
            await commandExecutor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_ints where id = (select max(id) from sakila.all_data_types_ints);");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;

            const testBoolean = await commandExecutor.getCellValueFromResultGrid(row, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await commandExecutor.getCellValueFromResultGrid(row, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await commandExecutor.getCellValueFromResultGrid(row, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await commandExecutor.getCellValueFromResultGrid(row, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await commandExecutor.getCellValueFromResultGrid(row, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await commandExecutor.getCellValueFromResultGrid(row, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await commandExecutor.getCellValueFromResultGrid(row, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);
        });

        it("Add new row on result grid - date columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_dates;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
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

            await commandExecutor.addResultGridRow(rowToAdd);
            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);
            await commandExecutor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_dates where id = (select max(id) from sakila.all_data_types_dates);");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const testDate = await commandExecutor.getCellValueFromResultGrid(row, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await commandExecutor.getCellValueFromResultGrid(row, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await commandExecutor.getCellValueFromResultGrid(row, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await commandExecutor.getCellValueFromResultGrid(row, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await commandExecutor.getCellValueFromResultGrid(row, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Add new row on result grid - char columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_chars;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value4";
            const setEdited = "value4";
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

            await commandExecutor.addResultGridRow(rowToAdd);
            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);
            await commandExecutor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_chars where id = (select max(id) from sakila.all_data_types_chars);");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const testChar = await commandExecutor.getCellValueFromResultGrid(row, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await commandExecutor.getCellValueFromResultGrid(row, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await commandExecutor.getCellValueFromResultGrid(row, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await commandExecutor.getCellValueFromResultGrid(row, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await commandExecutor.getCellValueFromResultGrid(row, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await commandExecutor.getCellValueFromResultGrid(row, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await commandExecutor.getCellValueFromResultGrid(row, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await commandExecutor.getCellValueFromResultGrid(row, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(constants.json);

        });

        it("Add new row on result grid - geometry columns", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.all_data_types_geometries;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPolyEd = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEdited = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "0";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_point", value: pointEdited },
                { columnName: "test_linestring", value: lineStringEdited },
                { columnName: "test_polygon", value: polygonEdited },
                { columnName: "test_multipoint", value: multiPointEdited },
                { columnName: "test_multilinestring", value: multiLineStrEdited },
                { columnName: "test_multipolygon", value: multiPolyEd },
                { columnName: "test_geometrycollection", value: geoCollEdited },
                { columnName: "test_bit", value: bitEdited },
            ];

            await commandExecutor.addResultGridRow(rowToAdd);
            await commandExecutor.resultGridApplyChanges();
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
            await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);
            await commandExecutor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_geometries where id = (select max(id) from sakila.all_data_types_geometries);");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const row = 0;
            const testPoint = await commandExecutor.getCellValueFromResultGrid(row, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await commandExecutor.getCellValueFromResultGrid(row, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await commandExecutor.getCellValueFromResultGrid(row, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await commandExecutor.getCellValueFromResultGrid(row, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await commandExecutor.getCellValueFromResultGrid(row, "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await commandExecutor.getCellValueFromResultGrid(row, "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await commandExecutor.getCellValueFromResultGrid(row, "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await commandExecutor.getCellValueFromResultGrid(row, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("0");

        });

        it("Close a result set", async () => {
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.result_sets;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const id = commandExecutor.getResultId();
            await commandExecutor.closeResultSet();

            await driver.wait(async () => {
                return (await driver.findElements(locator.notebook.codeEditor.editor.result.existsById(id)))
                    .length === 0;
            }, constants.wait5seconds, `The result set was not closed`);
        });

        it("Unsaved changes dialog on result grid", async () => {
            await Workbench.openMySQLShellForVSCode();
            const openEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
            await openEditorsSection.expand();
            const treeOEGlobalConn = await Tree.getElement(constants.openEditorsTreeSection,
                globalConn.caption);
            await (await Tree.getActionButton(treeOEGlobalConn, constants.newMySQLScript)).click();
            expect(await Tree.getScript(/Untitled-/, "Mysql")).to.exist;
            const anotherConnection = await Tree.getElement(constants.dbTreeSection, anotherConn.caption);

            await Tree.openContextMenuAndSelect(anotherConnection, constants.openNewConnection);
            await driver.wait(waitUntil.existsPasswordDialog(), constants.wait5seconds);
            await driver.wait(waitUntil.dbConnectionIsOpened(anotherConn), constants.wait5seconds);
            await Tree.expandElement(constants.dbTreeSection, [new RegExp(constants.mysqlAdmin)]);
            await Notebook.selectCurrentEditor(new RegExp(constants.openEditorsDBNotebook), "notebook");
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.result_sets;", undefined,
                (parseInt(commandExecutor.getResultId(), 10) - 2) as unknown as string);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const cellsToEdit: interfaces.IResultGridCell[] = [
                {
                    rowNumber: 0,
                    columnName: "text_field",
                    value: "ping",
                }];
            await commandExecutor.editResultGridCells(cellsToEdit);

            await (await Tree.getElement(constants.dbTreeSection, constants.serverStatus)).click();
            let dialog = await driver.wait(waitUntil.confirmationDialogExists(" after switching to Server Status page")
                , constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(waitUntil.currentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await (await Tree.getElement(constants.dbTreeSection, constants.clientConns)).click();
            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to Client Connections page"), constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(waitUntil.currentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await (await Tree.getElement(constants.dbTreeSection, constants.perfDash)).click();
            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to Performance Dashboard page"), constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(waitUntil.currentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait5seconds);

            await Notebook.selectCurrentEditor(/DB Connection Overview/, "overviewPage");
            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to DB Connections Overview page"), constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();

            await Notebook.selectCurrentEditor(/Untitled-(\d+)/, "Mysql");
            dialog = await driver.wait(waitUntil.confirmationDialogExists(" after switching to a script page"),
                constants.wait5seconds);
            expect(await (await dialog.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog.findElement(locator.confirmDialog.cancel).click();
        });

        it("Result grid context menu - Capitalize, Convert to lower, upper case and mark for deletion", async () => {
            await Notebook.selectCurrentEditor(new RegExp(constants.openEditorsDBNotebook), "notebook");
            await commandExecutor.execute("select * from sakila.result_sets;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            const rowNumber = 0;
            let cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            let cellValue = await cell.getText();
            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.capitalizeText);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.cellsWereChanged(commandExecutor.getResultContent() as WebElement,
                1), constants.wait5seconds);
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText(),
                `The cell value was not capitalized`).to.equals(`${cellValue.charAt(0)
                    .toUpperCase()
                    }${cellValue.slice(1)}`);
            cellValue = await cell.getText();

            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.convertTextToLowerCase);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText(), "The cell value was not converted to lower case")
                .to.equals(cellValue.toLowerCase());

            cellValue = await cell.getText();
            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.convertTextToUpperCase);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText(), "The cell value was not converted to upper case")
                .to.equals(cellValue.toUpperCase());

            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.toggleForDeletion);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const row = await commandExecutor.getRowFromResultGrid(commandExecutor.getResultContent() as WebElement, 0);
            await driver.wait(waitUntil.rowIsMarkedForDeletion(row),
                constants.wait5seconds);
            await commandExecutor.resultGridApplyChanges();

            await driver.wait(async () => {
                const resultHtml = await commandExecutor.getResult(undefined, commandExecutor.getResultId());

                return (await resultHtml.getAttribute("outerHTML")).match(/(\d+).*updated/) !== null;
            }, constants.wait5seconds, "The row was not updated, after deletion");
        });

        it("Result grid context menu - Copy single row", async () => {
            const table = 2;
            const tableColumns = constants.dbTables[table].columns;
            await commandExecutor.execute("select * from sakila.all_data_types_chars;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            let fields: string[];
            let lines: string[];
            const row = 0;
            const column = "test_text";

            // Copy row.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRow);
                fields = clipboard.readSync().split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row) The copied row fields do not match the table columns");

            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)}`)
                    .to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
            }

            // Copy row with names.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNames);
                lines = clipboard.readSync().split("\n");
                fields = lines[1].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row with names) The copied row fields do not match the table columns");

            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row with names) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table]
                        .name, i)}`).to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
            }
            expect(clipboard.readSync().includes(`# ${tableColumns.join(", ")}`)).to.be.true;

            // Copy row unquoted.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRowUnquoted);
                fields = clipboard.readSync().split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row unquoted) The copied row fields do not match the table columns");

            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row unquoted) Copy error on column ${Misc.getDbTableColumnName(constants
                        .dbTables[table].name, i)}`).to.match(constants.dbTables[table].columnRegex[i]);

            }

            // Copy row with names, unquoted.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesUnquoted);
                lines = clipboard.readSync().split("\n");
                fields = lines[1].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row with names, unquoted) The copied row fields do not match the table columns");

            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row with names, unquoted) Copy error on column ${Misc.getDbTableColumnName(constants
                        .dbTables[table].name,
                        i)}`).to.match(constants.dbTables[table].columnRegex[i]);
            }
            expect(clipboard.readSync().includes(`# ${tableColumns.join(", ")}`)).to.be.true;

            // Copy row with names, tab separated.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesTabSeparated);
                lines = clipboard.readSync().split("\n");
                fields = lines[1].split("\t");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row with names, tab separated) The copied row fields do not match the table columns");


            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row with names, tab separated) Copy error on column ${Misc.getDbTableColumnName(constants
                        .dbTables[table].name,
                        i)}`).to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
            }
            expect(clipboard.readSync().includes(`# ${tableColumns.join("\t")}`)).to.be.true;

            // Copy row, tab separated.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copySingleRow,
                    constants.resultGridContextMenu.copySingleRowContextMenu.copyRowTabSeparated);
                fields = clipboard.readSync().split("\t");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy row, tab separated) The copied row fields do not match the table columns");

            for (let i = 0; i <= fields.length - 1; i++) {
                expect(fields[i],
                    `(copy row, tab separated) Copy error on column ${Misc.getDbTableColumnName(constants
                        .dbTables[table].name, i)}`).to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
            }
        });

        it("Result grid context menu - Copy multiple rows", async () => {
            const table = 6;
            const tableColumns = constants.dbTables[table].columns;
            await commandExecutor.execute("select * from sakila.actor limit 3;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            let fields: string[];
            let lines: string[];
            const row = 0;
            const column = "actor_id";

            // Copy all rows.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRows);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[0].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows) All result grid rows were not copied").to.equals(3);

            for (let lineIdx = 0; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split(",");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
                }
            }

            // Copy all rows with names.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNames);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[1].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows with names) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows with names) All result grid rows were not copied").to.equals(4);

            for (let lineIdx = 1; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split(",");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows with names) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
                }
            }

            // Copy all rows unquoted.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsUnquoted);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[0].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows unquoted) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows unquoted) All result grid rows were not copied").to.equals(3);

            for (let lineIdx = 0; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split(",");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows unquoted) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[table].columnRegex[i]);
                }
            }

            // Copy all rows with names unquoted.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNamesUnquoted);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[1].split(",");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows with names unquoted) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows with names unquoted) All result grid rows were not copied")
                .to.equals(4);

            for (let lineIdx = 1; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split(",");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows with names unquoted) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[table].columnRegex[i]);
                }
            }

            // Copy all rows with names tab separated.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsWithNamesTabSeparated);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[1].split("\t");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows with names tab separated) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows with names tab separated) All result grid rows were not copied")
                .to.equals(4);

            for (let lineIdx = 1; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split("\t");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows with names tab separated) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[2].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[2].columnRegexWithQuotes[i]);
                }
            }

            // Copy all rows tab separated.
            await driver.wait(async () => {
                await commandExecutor.openCellContextMenuAndSelect(row, column,
                    constants.resultGridContextMenu.copyMultipleRows,
                    constants.resultGridContextMenu.copyMultipleRowsContextMenu.copyAllRowsTabSeparated);
                lines = clipboard.readSync().split("\n").filter((el) => {
                    return el !== "";
                });
                fields = lines[0].split("\t");

                return fields.length === tableColumns.length;
            }, constants.wait5seconds,
                "(copy all rows tab separated) The copied row fields do not match the table columns");

            expect(lines.length, "(copy all rows tab separated) All result grid rows were not copied").to.equals(3);

            for (let lineIdx = 0; lineIdx <= lines.length - 1; lineIdx++) {
                fields = lines[lineIdx].split("\t");
                for (let i = 0; i <= fields.length - 1; i++) {
                    expect(fields[i],
                        // eslint-disable-next-line max-len
                        `(copy all rows tab separated) Copy error on column ${Misc.getDbTableColumnName(constants.dbTables[table].name, i)} for line ${lineIdx}`)
                        .to.match(constants.dbTables[table].columnRegexWithQuotes[i]);
                }
            }
        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async () => {
            const table = 2;
            await commandExecutor.clean();
            const tableColumns = constants.dbTables[table].columns;
            await commandExecutor.execute("select * from sakila.all_data_types_chars;");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

            const row = 0;
            let err: string;
            for (let i = 1; i <= tableColumns.length - 1; i++) {
                err += `Copy field on column: ${tableColumns[i]} did not match `;
                err += constants.dbTables[table].columnRegexWithQuotes[i];
                await driver.wait(async () => {
                    await commandExecutor.openCellContextMenuAndSelect(row, tableColumns[i],
                        constants.resultGridContextMenu.copyField);

                    return clipboard.readSync().match(constants.dbTables[table].columnRegexWithQuotes[i]) !== null;
                }, constants.wait5seconds, err);

                err = `Copy field unquoted on column: ${tableColumns[i]} did not match `;
                err += constants.dbTables[table].columnRegex[i];

                await driver.wait(async () => {
                    await commandExecutor.openCellContextMenuAndSelect(row, tableColumns[i],
                        constants.resultGridContextMenu.copyFieldUnquoted);
                    if (clipboard.readSync() === "") {
                        clipboard.writeSync(" ");
                    }

                    return clipboard.readSync().match(constants.dbTables[table].columnRegex[i]) !== null;
                }, constants.wait5seconds, err);

                await commandExecutor.openCellContextMenuAndSelect(row, tableColumns[i],
                    constants.resultGridContextMenu.setFieldToNull);
                expect(await commandExecutor.getCellValueFromResultGrid(row, tableColumns[i]),
                    `Set field to null (${tableColumns[i]})`)
                    .to.equals(constants.isNull);
            }
        });
    });

    describe("Scripts", () => {

        let refItem: TreeItem;
        const commandExecutor = new CommandExecutor();

        before(async function () {
            try {
                await Os.deleteCredentials();
                await Section.focus(constants.dbTreeSection);
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await (await Tree.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
                await Section.focus(constants.openEditorsTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await (await Tree.getActionButton(refItem, "Close Editor")).click();
        });

        after(async function () {
            try {
                await Section.focus(constants.dbTreeSection);
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Add SQL Script", async () => {

            const treeGlobalConn = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.newMySQLScript);
            await driver.wait(async () => {
                return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor does not match Untitled-(*)");
            expect(await Notebook.getCurrentEditorType(), "The current editor type should be 'Mysql'")
                .to.include("Mysql");
            await commandExecutor.executeScript("select * from sakila.actor limit 1;", undefined);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK, (\\d+) record",
                commandExecutor.getResultMessage())).to.match(/OK, (\d+) record/);
            refItem = await Tree.getScript(/Untitled-/, "Mysql");
        });

        it("Add Typescript", async () => {
            const treeGlobalConn = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.newTS);
            await driver.wait(async () => {
                return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor is not Untitled-(*)");
            expect(await Notebook.getCurrentEditorType(), "The current editor type should be 'scriptTs'")
                .to.include("scriptTs");
            await commandExecutor.executeScript("Math.random()", undefined);
            expect(commandExecutor.getResultMessage(), "Query result is not a number").to.match(/(\d+).(\d+)/);
            refItem = await Tree.getScript(/Untitled-/, "scriptTs");
        });

        it("Add Javascript", async () => {

            const treeGlobalConn = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.newJS);
            await driver.wait(async () => {
                return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor does not match Untitled-(*)");
            expect(await Notebook.getCurrentEditorType(), "The current editor type should be 'scriptJs'")
                .to.include("scriptJs");
            await commandExecutor.executeScript("Math.random()", undefined);
            expect(commandExecutor.getResultMessage(), "Query result is not a number").to.match(/(\d+).(\d+)/);
            refItem = await Tree.getScript(/Untitled-/, "scriptJs");

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

                await Section.focus(constants.dbTreeSection);
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await (await Tree.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
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

        it("Save Notebook", async () => {

            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("SELECT VERSION();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("1 record retrieved",
                commandExecutor.getResultMessage())).to.match(/1 record retrieved/);
            await (await Notebook.getToolbarButton(constants.saveNotebook)).click();
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

            await (await Notebook.getToolbarButton(constants.loadNotebook)).click();
            await Workbench.setInputPath(`${destFile}.mysql-notebook`);
            await Notebook.verifyNotebook("SELECT VERSION();", "1 record retrieved");
            await Workbench.closeAllEditors();

        });

        it("Open the Notebook from file", async () => {

            await browser.openResources(process.cwd());
            await Workbench.dismissNotifications();
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Section.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");

            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();

            const input = await InputBox.create(constants.wait5seconds * 4);
            await (await input.findQuickPick(globalConn.caption)).select();
            await Workbench.openEditor("test.mysql-notebook");

            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Notebook.verifyNotebook("SELECT VERSION();", "1 record retrieved");
            await Workbench.closeEditor("test.mysql-notebook", true);

        });

        it("Open the Notebook from file with connection", async () => {

            await Workbench.closeAllEditors();
            await browser.openResources(process.cwd());
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Section.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await Tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await driver.wait(waitUntil.tabIsOpened("test.mysql-notebook"), constants.wait5seconds);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Notebook.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Section.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Workbench.openEditor("test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl(constants.extensionName))?.openView();
            await Tree.deleteDatabaseConnection(globalConn.caption);
            const tabs = await Workbench.getOpenEditorTitles();
            expect(tabs, errors.tabIsNotOpened("test.mysql-notebook")).to.not.include("test.mysql-notebook");
        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await Tree.getDatabaseConnections();

            for (const conn of conns) {
                await Tree.deleteDatabaseConnection(conn.name, conn.isMySQL);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Section.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await Workbench.openEditor("test.mysql-notebook");
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);
            await Misc.switchToFrame();
            expect(await driver.findElement(locator.htmlTag.h2).getText(), "'No connection selected' message was found")
                .to.equals("No connection selected");
            await Workbench.closeAllEditors();
            await Tree.openContextMenuAndSelect(file, constants.openNotebookWithConn);
            await Workbench.getNotification("Please create a MySQL Database Connection first.", undefined, true);
        });

    });

});
