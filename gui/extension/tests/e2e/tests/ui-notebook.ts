/*
 * Copyright (c) 2023, 2024 Oracle and/or its affiliates.
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
    ActivityBar, Condition, CustomTreeSection, InputBox, Key, TreeItem,
    until, WebElement, ModalDialog,
} from "vscode-extension-tester";
import { join } from "path";
import clipboard from "clipboardy";
import { browser, driver, Misc } from "../lib/misc";
import { Notebook } from "../lib/webviews/notebook";
import { CommandExecutor } from "../lib/cmdExecutor";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { DatabaseConnection } from "../lib/webviews/dbConnection";
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
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
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
            portX: Number(process.env.DBPORTX),
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
            await Section.createDatabaseConnection(globalConn);
            await (await DatabaseConnection.getConnection(globalConn.caption)).click();
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
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn),
                3000, "Commit button should be enabled");

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
                    2000,
                    "No words found",
                );
                await Notebook.widgetExpandFinderReplace(true);
                const replacer = await finder.findElement(locator.findWidget.replacePart);
                await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("tester");
                await (await Notebook.widgetGetReplacerButton("Replace (Enter)")).click();
                expect(
                    await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                    `'import from tester xpto xpto' was not found on the editor`,
                ).to.include("import from tester xpto xpto");

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
                await Notebook.selectCurrentEditor("DB Notebook", "notebook");
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
            await browser.openResources(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", "sakila.sql"));
            await driver.wait(waitUntil.tabIsOpened("sakila.sql"));
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
                "src", "tests", "e2e", "sql", "sakila.sql"));
            const fileLines = sakilaFile.toString().split("\n");
            const findBtn = await Notebook.getToolbarButton("Find");
            await findBtn.click();
            const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                constants.wait5seconds, "Find widget was not displayed");
            const finderTextArea = await finder.findElement(locator.notebook.codeEditor.textArea);
            for (const line of fileLines) {
                await finderTextArea.sendKeys(line.substring(0, 150).replace(/`|;/gm, ""));
                expect(
                    await finder.findElement(locator.findWidget.matchesCount).getText(),
                    `${line} was not found on the editor`,
                ).to.match(/1 of (\d+)/);
                await DialogHelper.clearInputField(finderTextArea);
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
            const host = await driver.findElement(locator.notebook.codeEditor.editor.result.exists);
            expect(await host.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy)).to.exist;
            const output = await host.findElement(locator.notebook.codeEditor.editor.result.singleOutput.exists);
            await driver.actions().move({ origin: output }).perform();
            await host.findElement(locator.notebook.codeEditor.editor.result.singleOutput.copy).click();
            await commandExecutor.clean();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardPaste(textArea);
            expect(await Notebook.existsOnNotebook("Welcome")).to.be.true;
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
            await driver.wait(new Condition("", async () => {
                try {
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

        });

        it("Open the Notebook from file", async () => {

            await Workbench.closeAllEditors();
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

            await Workbench.closeEditor("test.mysql-notebook");
            // The file may be dirty
            try {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Don't Save`);
            } catch (e) {
                // continue
            }

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
