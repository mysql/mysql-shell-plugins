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
import { ActivityBar, Condition, InputBox, Key, until, SideBarView, error, WebElement } from "vscode-extension-tester";
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
import { E2ELogger } from "../lib/E2ELogger";
import { E2ERecording } from "../lib/E2ERecording";
import "../setup/global-hooks";

describe("NOTEBOOKS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `conn-port:${parseInt(process.env.MYSQL_1107!, 10)}`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1107!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const anotherConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eAnotherDBConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1107!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const notebook = new E2ENotebook();

    before(async function () {
        let hookResult = "passed";
        await Misc.loadDriver();
        const localE2eRecording = new E2ERecording(this.test!.title!);
        try {
            if (!Os.isWindows()) {
                await localE2eRecording!.start();
            }
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Os.appendToExtensionLog("beforeAll Notebooks");
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await dbTreeSection.createDatabaseConnection(anotherConn);
            await dbTreeSection.focus();
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.waitForTreeItem);
            await driver.wait(dbTreeSection.untilTreeItemExists(anotherConn.caption!), constants.waitForTreeItem);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption!)).click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
        } catch (e) {
            hookResult = "failed";
            throw e;
        } finally {
            await Misc.processResult(this, localE2eRecording, hookResult);
        }
    });

    after(async function () {
        Misc.removeDatabaseConnections();
    });

    describe("Code Editor", () => {

        let existsInQueue = false;

        before(async function () {
            const localE2eRecording = new E2ERecording(this.test!.title!);
            let hookResult = "passed";
            try {
                if (!Os.isWindows()) {
                    await localE2eRecording!.start();
                }
                await Workbench.toggleSideBar(false);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
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
                    }, constants.wait1second * 5, `Line ${line} was stale, could not click on it`);
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
                await notebook.codeEditor.clean();
            }
        });

        it("Result grid cell tooltips - integer columns", async function () {

            const rowNumber = 0;
            const tableColumns: string[] = [];
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about", true);
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_ints limit 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.sleep(1000);

            for (const key of result.columnsMap!.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    try {
                        await result.reduceCellWidth(rowNumber, tableColumns[i]);
                    } catch (e) {
                        if (String(e).includes("The cell width was not reduced")) {
                            E2ELogger.error(`Error, trying to reduce with js on '${tableColumns[i]}'`);
                            await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                        } else {
                            throw e;
                        }
                    }
                }
                const cellText = await result.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait1second * 3);
            }

        });

        it("Result grid cell tooltips - date columns", async function () {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_dates where id = 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.sleep(1000);

            const tableColumns: string[] = [];
            for (const key of result.columnsMap!.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    try {
                        await result.reduceCellWidth(rowNumber, tableColumns[i]);
                    } catch (e) {
                        if (String(e).includes("The cell width was not reduced")) {
                            E2ELogger.error(`Error, trying to reduce with js on '${tableColumns[i]}'`);
                            await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                        } else {
                            throw e;
                        }
                    }
                }

                const cellText = await result.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait1second * 3);
            }

        });

        it("Result grid cell tooltips - char columns", async function () {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about", true);
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_chars where id = 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.sleep(1000);

            const tableColumns: string[] = [];
            for (const key of result.columnsMap!.keys()) {
                tableColumns.push(key);
            }

            for (let i = 1; i <= tableColumns.length - 1; i++) {
                try {
                    await result.reduceCellWidth(rowNumber, tableColumns[i]);
                } catch (e) {
                    if (String(e).includes("The cell width was not reduced")) {
                        E2ELogger.error(`Error, trying to reduce with js on '${tableColumns[i]}'`);
                        await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                    } else {
                        throw e;
                    }
                }

                const cellText = await result.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait1second * 3);
            }

        });

        it("Result grid cell tooltips - binary and varbinary columns", async function () {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about", true);
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_blobs limit 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.sleep(1000);

            const tableColumns: string[] = [];
            for (const key of result.columnsMap!.keys()) {
                tableColumns.push(key);
            }

            for (let i = 5; i <= tableColumns.length - 1; i++) {
                if (i === tableColumns.length - 1) {
                    await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                } else {
                    try {
                        await result.reduceCellWidth(rowNumber, tableColumns[i]);
                    } catch (e) {
                        if (String(e).includes("The cell width was not reduced")) {
                            E2ELogger.error(`Error, trying to reduce with js on '${tableColumns[i]}'`);
                            await result.reduceCellWidth(rowNumber, tableColumns[i], "js");
                        } else {
                            throw e;
                        }
                    }
                }

                const cellText = await result.getCellValue(rowNumber, tableColumns[i]);
                await driver.wait(result.untilCellTooltipIs(rowNumber, tableColumns[i], cellText),
                    constants.wait1second * 3);
            }

        });

        it("Result grid cell tooltips - bit column", async function () {

            const rowNumber = 0;
            await notebook.codeEditor.clean();
            await notebook.codeEditor.execute("\\about");
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_geometries;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.sleep(1000);

            const column = "test_bit";
            await result.reduceCellWidth(rowNumber, column);
            const cellText = await result.getCellValue(rowNumber, column);
            await driver.wait(result.untilCellTooltipIs(rowNumber, column, cellText), constants.wait1second * 3);

        });

        it("Copy paste into notebook", async function () {

            this.retries(2);
            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);
            await notebook.codeEditor.clean();
            await Misc.switchBackToTopFrame();
            const filename = "1_users.sql";
            await browser.openResources(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", filename));
            await driver.wait(Workbench.untilTabIsOpened(filename), constants.wait1second * 5);
            await Os.keyboardSelectAll();
            await Os.keyboardCopy();
            await Workbench.openEditor(globalConn.caption!);
            let clipboardText = await clipboard.read();
            clipboardText = clipboardText.replace(/`|;/gm, "");
            await clipboard.write(clipboardText);
            await Misc.switchToFrame();

            const promptLine = await driver.findElement(locator.notebook.codeEditor.editor.promptLine);
            await promptLine.click();
            await Os.keyboardPaste();

            const sakilaFile = await fs.readFile(join(constants.workspace, "gui", "frontend",
                "src", "tests", "e2e", "sql", filename));
            const fileLines = sakilaFile.toString().split("\n");

            const widget = await new E2ECodeEditorWidget(notebook).open();
            try {
                for (const line of fileLines) {
                    if (line.trim() !== "") {
                        await widget.setTextToFind(line.substring(0, 150).replace(/`|;/gm, ""));
                        await driver.wait(widget.untilMatchesCount(/1 of (\d+)/), constants.wait1second * 2);
                    }
                }
            } finally {
                await widget.close();
                await Workbench.toggleSideBar(false);
            }
        });

        it("Cut paste into notebook", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const sentence1 = "select * from sakila.actor";
            const sentence2 = "select * from sakila.address";
            await notebook.codeEditor.clean();
            await notebook.codeEditor.write(sentence1, true);
            await notebook.codeEditor.setNewLine();
            await notebook.codeEditor.write(sentence2, true);
            await Os.keyboardSelectAll();
            await Os.keyboardCut();
            expect(await notebook.exists(sentence1), `${sentence1} should not exist on the notebook`)
                .to.be.false;
            expect(await notebook.exists(sentence2),
                `${sentence2} should not exist on the notebook`).to.be.false;
            const promptLine = await driver.findElement(locator.notebook.codeEditor.editor.promptLine);
            await promptLine.click();
            await Os.keyboardPaste();

            await driver.wait(notebook.untilExists(sentence1), constants.wait1second * 5);
            await driver.wait(notebook.untilExists(sentence2), constants.wait1second * 5);
        });

        it("Result grid context menu - Copy field, copy field unquoted, set field to null", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const allColumns = Array.from(result.columnsMap!.keys());

            for (let i = 1; i <= allColumns.length - 1; i++) {

                await driver.wait(async () => {
                    try {
                        const copy = await result.copyField(row, String(allColumns[i]));
                        const clip = clipboard.readSync();

                        if (copy.toString().match(new RegExp(clip.toString()))) {
                            return true;
                        } else {
                            E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                        }
                    } catch (e) {
                        // the clipboard can have content with special chars from other tests
                        if (!(e instanceof SyntaxError)) {
                            throw e;
                        }
                    }
                }, constants.wait1second * 10, "Copy field failed");

                await driver.wait(async () => {
                    try {
                        const copy = await result.copyFieldUnquoted(row, String(allColumns[i]));
                        const clip = clipboard.readSync();

                        if (copy.toString() === clip.toString()) {
                            return true;
                        } else {
                            E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                        }
                    } catch (e) {
                        // the clipboard can have content with special chars from other tests
                        if (!(e instanceof SyntaxError)) {
                            throw e;
                        }
                    }
                }, constants.wait1second * 10, "Copy field unquoted failed");

                await result.openCellContextMenuAndSelect(row, String(allColumns[i]),
                    constants.resultGridContextMenu.setFieldToNull);
                expect(await result.getCellValue(row, String(allColumns[i])),
                    `Set field to null (${String(allColumns[i])})`)
                    .to.equals(constants.isNull);
            }

            await result.rollbackChanges();

        });

        it("Result grid context menu - Capitalize, Convert to lower, upper case and mark for deletion", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            const rowNumber = 0;
            const rowColumn = "text_field";

            const originalCellValue = await result.getCellValue(rowNumber, rowColumn);
            await result.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.capitalizeText);
            await driver.wait(result.untilCellsWereChanged(1), constants.wait1second * 5);

            const capitalizedCellValue = await result.getCellValue(rowNumber, rowColumn);
            expect(capitalizedCellValue,
                `The cell value was not capitalized`).to.equals(`${originalCellValue.charAt(0)
                    .toUpperCase()
                    }${originalCellValue.slice(1)}`);

            await result.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToLowerCase);

            const lowerCaseCellValue = await result.getCellValue(rowNumber, rowColumn);
            expect(lowerCaseCellValue, "The cell value was not converted to lower case")
                .to.equals(capitalizedCellValue.toLowerCase());

            await result.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.convertTextToUpperCase);

            const upperCaseCellValue = await result.getCellValue(rowNumber, rowColumn);
            expect(upperCaseCellValue, "The cell value was not converted to upper case")
                .to.equals(lowerCaseCellValue.toUpperCase());

            await result.openCellContextMenuAndSelect(0, rowColumn,
                constants.resultGridContextMenu.toggleForDeletion);
            await driver.wait(result.untilRowIsMarkedForDeletion(rowNumber), constants.wait1second * 5);
            await result.rollbackChanges();
        });

        it("Result grid context menu - Copy single row", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const result = await notebook.codeEditor
                .execute("select * from sakila.actor limit 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy row.
            await driver.wait(async () => {
                const copy = await result.copyRow(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row failed`);

            // Copy row with names.
            await driver.wait(async () => {
                const copy = await result.copyRowWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row with names failed`);

            // Copy row unquoted.
            await driver.wait(async () => {
                const copy = await result.copyRowUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row unquoted failed`);

            // Copy row with names, unquoted.
            await driver.wait(async () => {
                const copy = await result.copyRowWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row with names, unquoted failed`);

            // Copy row with names, tab separated.
            await driver.wait(async () => {
                const copy = await result.copyRowWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row with names, tab separated failed`);

            // Copy row, tab separated.
            await driver.wait(async () => {
                const copy = await result.copyRowTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy row, tab separated failed`);

        });

        it("Result grid context menu - Copy multiple rows", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const maxRows = 2;
            const result = await notebook.codeEditor
                .execute(`select * from sakila.actor limit ${maxRows};`, true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy all rows.
            await driver.wait(async () => {
                const copy = await result.copyAllRows(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy all rows failed`);

            // Copy all rows with names.
            await driver.wait(async () => {
                const copy = await result.copyAllRowsWithNames(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy all rows with names failed`);

            // Copy all rows unquoted.
            await driver.wait(async () => {
                const copy = await result.copyAllRowsUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy all rows unquoted failed`);

            // Copy all rows with names unquoted.
            await driver.wait(async () => {
                const copy = await result.copyAllRowsWithNamesUnquoted(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy all rows with names unquoted failed`);

            // Copy all rows with names tab separated.
            await driver.wait(async () => {
                const copy = await result.copyAllRowsWithNamesTabSeparated(row, column);
                const clipboard = Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    E2ELogger.debug(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait1second * 10, `Copy all rows with names tab separated failed`);

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
            expect(result.tabs!.length).to.equals(2);
            expect(result.tabs![0].name).to.match(/Result/);
            expect(result.tabs![1].name).to.match(/Result/);
        });

        it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
            const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execAsText, true) as E2ECommandResultData;
            expect(result.text).to.match(/OK/);
            expect(result.text).to.match(/\|.*\|/);
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {
            const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execFullBlockSql, true);
            expect(result!.status).to.match(/(\d+) record/);
            await driver.wait(notebook.codeEditor.untilNewPromptExists(), constants.wait1second * 5);
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async function () {
            this.retries(2);
            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";

                await notebook.codeEditor.clean();

                const result1 = await notebook.codeEditor.execute(query1, true) as E2ECommandResultGrid;
                expect(result1.status).to.match(/OK/);

                const result2 = await notebook.codeEditor.execute(query2, true) as E2ECommandResultGrid;
                expect(result2.status).to.match(/OK/);

                let careResult = await notebook.findAndExecute(query1, result1.id) as E2ECommandResultGrid;
                expect(Array.from(careResult.columnsMap!.keys()))
                    .to.deep.equals(["actor_id", "first_name", "last_name", "last_update"]);

                careResult = await notebook.findAndExecute(query2, result2.id) as E2ECommandResultGrid;
                expect(Array.from(careResult.columnsMap!.keys()))
                    .to.deep.equals(["address_id", "address", "address2", "district", "city_id", "postal_code",
                        "phone", "last_update"]);
            } finally {
                await notebook.codeEditor.clean();
            }
        });

        it("Switch between search tabs", async () => {
            const query = "select * from sakila.actor limit 1; select * from sakila.address limit 1;";
            const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(result.tabs!.length).to.equals(2);
            expect(result.tabs![0].name).to.equals("Result #1");
            expect(result.tabs![1].name).to.equals("Result #2");
            expect(Array.from(result.columnsMap!.keys()))
                .to.deep.equals(["actor_id", "first_name", "last_name", "last_update"]);
            await result.selectTab(result.tabs![1].name);
            expect(Array.from(result.columnsMap!.keys()))
                .to.deep.equals(["address_id", "address", "address2", "district", "city_id", "postal_code",
                    "phone", "last_update"]);
        });

        it("Connect to database and verify default schema", async () => {

            const result = await notebook.codeEditor.execute("SELECT SCHEMA();", true);
            expect(result!.status).to.match(/1 record retrieved/);
            expect(await result!.resultContext!.getAttribute("innerHTML"))
                .to.match(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema!));
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            const autoCommitBtn = await notebook.toolbar.getButton(constants.autoCommit);
            const style = await autoCommitBtn!.findElement(locator.notebook.toolbar.button.icon)
                .getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn!.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await notebook.toolbar.getButton(constants.commit);
            const rollBackBtn = await notebook.toolbar.getButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn!),
                constants.wait1second * 3, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                constants.wait1second * 3, "Commit button should be enabled");

            let resultData = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
            expect(resultData.text).to.match(/OK/);

            await rollBackBtn!.click();

            // eslint-disable-next-line max-len
            let resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name='${random}';`) as E2ECommandResultGrid;
            expect(resultGrid.status).to.match(/OK/);

            resultData = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
            expect(resultData.text).to.match(/OK/);

            await commitBtn!.click();

            // eslint-disable-next-line max-len
            resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`) as E2ECommandResultGrid;
            expect(resultGrid.status).to.match(/OK/);

            await autoCommitBtn!.click();

            await driver.wait(
                async () => {
                    const commitBtn = await notebook.toolbar.getButton(constants.commit);
                    const rollBackBtn = await notebook.toolbar.getButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait1second * 5,
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
                await driver.wait(widget.untilMatchesCount(/1 of (\d+)/), constants.wait1second * 3);
                await widget.toggleFinderReplace(true);
                await widget.setTextToReplace("tester");
                await driver.wait(async () => {
                    await widget.replace();

                    return (await driver.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                        .match(/import from tester xpto xpto/);
                }, constants.wait1second * 5, "'xpto' was not replaced by tester");

                await widget.setTextToReplace("testing");
                await widget.replaceAll();

                expect(
                    await driver.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                    `'import from tester testing testing' was not found on the editor`,
                ).to.include("import from tester testing testing");
                await widget.close();
            } finally {
                await notebook.codeEditor.clean();
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
                await notebook.codeEditor.clean();
            }
        });

        it("Multi-line comments", async () => {
            await notebook.codeEditor.languageSwitch("\\sql ");
            const result1 = await notebook.codeEditor.execute("select version();", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/1 record retrieved/);

            let cell: WebElement;
            let cellText: string;

            await driver.wait(async () => {
                try {
                    cell = result1.resultContext!
                        .findElement(locator.notebook.codeEditor.editor.result.grid.row.cell.exists);
                    cellText = await cell.getText();

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait1second * 3, "Could not get the cell text");

            const server = cellText!.match(/(\d+).(\d+).(\d+)/g)![0];
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
                        .toolbar.maximize), constants.wait1second * 3);
            } finally {
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                    globalConn.caption!);
                await notebook.codeEditor.build();
            }
        });

        it("Pie Graph based on DB table", async () => {

            await notebook.codeEditor.clean();
            await notebook.codeEditor.languageSwitch("\\ts ");
            const result = await notebook.codeEditor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`, true) as E2ECommandResultData;

            expect(result.graph).to.exist;
            const chartColumns = await result.graph!
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

        it("Copy to clipboard button", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("\\about ", true) as E2ECommandResultData;
            await driver.wait(async () => {
                await result.copyToClipboard();

                return (clipboard.readSync()).includes("Welcome");
            }, constants.wait1second * 3, `'Welcome keyword' was not found on the clipboard`);

        });

        it("Verify mysql data types - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.languageSwitch("\\sql ");
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_ints;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            const row = 0;
            const smallIntField = await result.getCellValue(row, "test_smallint");
            const mediumIntField = await result.getCellValue(row, "test_mediumint");
            const intField = await result.getCellValue(row, "test_integer");
            const bigIntField = await result.getCellValue(row, "test_bigint");
            const decimalField = await result.getCellValue(row, "test_decimal");
            const floatFIeld = await result.getCellValue(row, "test_float");
            const doubleField = await result.getCellValue(row, "test_double");
            const booleanCell = await result.getCellValue(row, "test_boolean");

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
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_dates;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const dateField = await result.getCellValue(row, "test_date");
            const dateTimeField = await result.getCellValue(row, "test_datetime");
            const timeStampField = await result.getCellValue(row, "test_timestamp");
            const timeField = await result.getCellValue(row, "test_time");
            const yearField = await result.getCellValue(row, "test_year");

            expect(dateField, errors.incorrectCellValue("DATE")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(dateTimeField, errors.incorrectCellValue("DATETIME")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeStampField, errors.incorrectCellValue("TIMESTAMP")).to.match(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeField, errors.incorrectCellValue("TIME")).to.match(/(\d+):(\d+):(\d+)/);
            expect(yearField, errors.incorrectCellValue("YEAR")).to.match(/(\d+)/);
        });

        it("Verify mysql data types - char columns", async () => {
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_chars;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const charField = await result.getCellValue(row, "test_char");
            const varCharField = await result.getCellValue(row, "test_varchar");
            const tinyTextField = await result.getCellValue(row, "test_tinytext");
            const textField = await result.getCellValue(row, "test_text");
            const mediumTextField = await result.getCellValue(row, "test_mediumtext");
            const longTextField = await result.getCellValue(row, "test_longtext");
            const enumField = await result.getCellValue(row, "test_enum");
            const setFIeld = await result.getCellValue(row, "test_set");
            const jsonField = await result.getCellValue(row, "test_json");

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
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_blobs;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const binaryField = await result.getCellValue(row, "test_binary");
            const varBinaryField = await result.getCellValue(row, "test_varbinary");

            expect(await result.getCellIconType(row, "test_tinyblob")).to.equals(constants.blob);
            expect(await result.getCellIconType(row, "test_blob")).to.equals(constants.blob);
            expect(await result.getCellIconType(row, "test_mediumblob")).to.equals(constants.blob);
            expect(await result.getCellIconType(row, "test_longblob")).to.equals(constants.blob);
            expect(binaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
            expect(varBinaryField, errors.incorrectCellValue("BINARY")).to.match(/0x/);
        });

        it("Verify mysql data types - geometry columns", async () => {
            const result = await notebook.codeEditor
                .execute("SELECT * from sakila.all_data_types_geometries;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const row = 0;
            const bitCell = await result.getCellValue(row, "test_bit");
            expect(await result.getCellIconType(row, "test_point"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_linestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_polygon"), "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_multipoint"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_multilinestring"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_multipolygon"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(await result.getCellIconType(row, "test_geometrycollection"),
                "The cell should have a GEOMETRY icon")
                .to.equals(constants.geometry);
            expect(bitCell, errors.incorrectCellValue("BIT")).to.match(/(\d+)/);
        });

        it("Edit a result grid, verify query preview and commit - integer columns", async () => {

            await notebook.codeEditor.clean();
            await notebook.codeEditor.languageSwitch("\\sql ");
            let result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const booleanEdited = false;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "2147483611";
            const bigIntEdited = "4294967291";
            const decimalEdited = "300.70509";
            const floatEdited = "10.767";
            const doubleEdited = "500.72123";

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

            await result.editCells(cellsToEdit, constants.doubleClick);
            result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultGrid;
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

            await result.selectSqlPreview();
            const result1 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultData;
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result1.preview!.text).to.match(expectedSqlPreview[i]);
            }

            await result1.clickSqlPreviewContent();
            const result2 = await notebook.codeEditor
                .refreshResult(result1.command, result1.id) as E2ECommandResultGrid;
            await driver.wait(result2.untilRowIsHighlighted(rowToEdit), constants.wait1second * 5);

            await result2.applyChanges();
            await driver.wait(result2.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5)
                .catch(async (e) => {
                    await result2.selectSqlPreview();
                    await Workbench.dismissNotifications();

                    throw e;
                });

            await Workbench.getNotification("Changes committed successfully.");
            const result3 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints where id = 1;") as E2ECommandResultGrid;
            expect(result3.status).to.match(/OK/);
            const testBoolean = await result3.getCellValue(rowToEdit, "test_boolean");
            expect(testBoolean).to.equals(booleanEdited.toString());
            const testSmallInt = await result3.getCellValue(rowToEdit, "test_smallint");
            expect(testSmallInt).to.equals(smallIntEdited);
            const testMediumInt = await result3.getCellValue(rowToEdit, "test_mediumint");
            expect(testMediumInt).to.equals(mediumIntEdited);
            const testInteger = await result3.getCellValue(rowToEdit, "test_integer");
            expect(testInteger).to.equals(intEdited);
            const testBigInt = await result3.getCellValue(rowToEdit, "test_bigint");
            expect(testBigInt).to.equals(bigIntEdited);
            const testDecimal = await result3.getCellValue(rowToEdit, "test_decimal");
            expect(testDecimal).to.equals(decimalEdited);
            const testFloat = await result3.getCellValue(rowToEdit, "test_float");
            expect(testFloat).to.equals(floatEdited);
            const testDouble = await result3.getCellValue(rowToEdit, "test_double");
            expect(testDouble).to.equals(doubleEdited);

        });

        it("Edit a result grid, verify query preview and commit - date columns", async () => {

            let result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_dates;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const dateEdited = "2045-01-01";
            const dateTimeEdited = "2026-01-01 15:45";
            const timeStampEdited = "2026-01-01 15:45";
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
            await result.editCells(cellsToEdit, constants.doubleClick);
            result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultGrid;
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

            await result.selectSqlPreview();
            const result1 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultData;
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result1.preview!.text).to.match(expectedSqlPreview[i]);
            }

            await result1.clickSqlPreviewContent();
            const result2 = await notebook.codeEditor
                .refreshResult(result1.command, result1.id) as E2ECommandResultGrid;

            await driver.wait(result2.untilRowIsHighlighted(rowToEdit), constants.wait1second * 5);
            await result.applyChanges();
            await driver.wait(result2.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5)
                .catch(async (e) => {
                    await result2.selectSqlPreview();
                    await Workbench.dismissNotifications();

                    throw e;
                });
            await Workbench.getNotification("Changes committed successfully.");

            const result3 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_dates where id = 1;") as E2ECommandResultGrid;
            expect(result3.status).to.match(/OK/);

            const testDate = await result3.getCellValue(rowToEdit, "test_date");
            expect(testDate).to.equals("01/01/2045");
            const testDateTime = await result3.getCellValue(rowToEdit, "test_datetime");
            expect(testDateTime).to.equals("01/01/2026");
            const testTimeStamp = await result3.getCellValue(rowToEdit, "test_timestamp");
            expect(testTimeStamp).to.equals("01/01/2026");
            const testTime = await result3.getCellValue(rowToEdit, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime).to.equals(true);
            const testYear = await result3.getCellValue(rowToEdit, "test_year");
            expect(testYear).to.equals(yearEdited);
        });

        it("Edit a result grid, verify query preview and commit - char columns", async () => {

            let result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_chars where id = 2;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

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
            await result.editCells(cellsToEdit, constants.doubleClick);
            result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultGrid;
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

            await result.selectSqlPreview();
            const result1 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultData;
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result1.preview!.text).to.match(expectedSqlPreview[i]);
            }

            await result1.clickSqlPreviewContent();
            const result2 = await notebook.codeEditor
                .refreshResult(result1.command, result1.id) as E2ECommandResultGrid;
            await driver.wait(result.untilRowIsHighlighted(rowToEdit), constants.wait1second * 5);
            await result.applyChanges();
            await driver.wait(result2.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5)
                .catch(async (e) => {
                    await result2.selectSqlPreview();
                    await Workbench.dismissNotifications();

                    throw e;
                });
            await Workbench.getNotification("Changes committed successfully.");

            const result3 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_chars where id = 2;", true) as E2ECommandResultGrid;
            expect(result3.status).to.match(/OK/);
            const testChar = await result3.getCellValue(rowToEdit, "test_char");
            expect(testChar).to.equals(charEdited);
            const testVarChar = await result3.getCellValue(rowToEdit, "test_varchar");
            expect(testVarChar).to.equals(varCharEdited);
            const testTinyText = await result3.getCellValue(rowToEdit, "test_tinytext");
            expect(testTinyText).to.equals(tinyTextEdited);
            const testText = await result3.getCellValue(rowToEdit, "test_text");
            expect(testText).to.equals(textEdited);
            const testMediumText = await result3.getCellValue(rowToEdit, "test_mediumtext");
            expect(testMediumText).to.equals(textMediumEdited);
            const testLongText = await result3.getCellValue(rowToEdit, "test_longtext");
            expect(testLongText).to.equals(longTextEdited);
            const testEnum = await result3.getCellValue(rowToEdit, "test_enum");
            expect(testEnum).to.equals(enumEdited);
            const testSet = await result3.getCellValue(rowToEdit, "test_set");
            expect(testSet).to.equals(setEdited);
            const testJson = await result3.getCellValue(rowToEdit, "test_json");
            expect(testJson).to.equals(jsonEdited);
        });

        it("Edit a result grid, verify query preview and commit - geometry columns", async () => {

            let result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_geometries;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

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
            await result.editCells(cellsToEdit, constants.doubleClick);
            result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultGrid;

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

            await result.selectSqlPreview();
            const result1 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultData;
            for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
                expect(result1.preview!.text).to.match(expectedSqlPreview[i]);
            }

            await result1.clickSqlPreviewContent();
            const result2 = await notebook.codeEditor
                .refreshResult(result1.command, result1.id) as E2ECommandResultGrid;
            await driver.wait(result.untilRowIsHighlighted(rowToEdit), constants.wait1second * 5);
            await result.applyChanges();
            await driver.wait(result2.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5)
                .catch(async (e) => {
                    await result2.selectSqlPreview();
                    await Workbench.dismissNotifications();

                    throw e;
                });
            await Workbench.getNotification("Changes committed successfully.");

            const result3 = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_geometries where id = 1;", true) as E2ECommandResultGrid;
            expect(result3.status).to.match(/OK/);

            const testPoint = await result3.getCellValue(rowToEdit, "test_point");
            expect(testPoint).to.equals(constants.geometry);
            const testLineString = await result3.getCellValue(rowToEdit, "test_linestring");
            expect(testLineString).to.equals(constants.geometry);
            const testPolygon = await result3.getCellValue(rowToEdit, "test_polygon");
            expect(testPolygon).to.equals(constants.geometry);
            const testMultiPoint = await result3.getCellValue(rowToEdit, "test_multipoint");
            expect(testMultiPoint).to.equals(constants.geometry);
            const testMultiLineString = await result3.getCellValue(rowToEdit, "test_multilinestring");
            expect(testMultiLineString).to.equals(constants.geometry);
            const testMultiPolygon = await result3.getCellValue(rowToEdit, "test_multipolygon");
            expect(testMultiPolygon).to.equals(constants.geometry);
            const testGeomCollection = await result3.getCellValue(rowToEdit, "test_geometrycollection");
            expect(testGeomCollection).to.equals(constants.geometry);
            const testBit = await result.getCellValue(rowToEdit, "test_bit");
            expect(testBit).to.equals("16383");
        });

        it("Select a Result Grid View", async () => {

            let result = await notebook.codeEditor.execute("select * from sakila.actor;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await result.editCells([{
                rowNumber: 0,
                columnName: "first_name",
                value: "changed",
            }], constants.doubleClick);
            result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultGrid;

            await result.selectView(constants.previewView);
            const result1 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultData;

            expect(result1.preview).to.exist;
            await result.selectView(constants.gridView);
            const result2 = await notebook.codeEditor
                .refreshResult(result.command, result.id) as E2ECommandResultGrid;
            expect(result2).to.exist;
            await result.rollbackChanges();

        });

        it("Edit a result grid using the keyboard", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            await result.startFocus();
            await result.editCells([
                { rowNumber: 0, columnName: "text_field", value: "edited" },
            ], constants.pressEnter);

            const refKey = Os.isMacOs() ? Key.COMMAND : Key.META;

            await driver.actions()
                .keyDown(refKey)
                .keyDown(Key.ALT)
                .pause(300)
                .keyDown(Key.ENTER)
                .keyUp(Key.ENTER)
                .keyUp(refKey)
                .keyUp(Key.ALT)
                .perform();

            await driver.wait(Workbench.untilNotificationExists("Changes committed successfully", true),
                constants.wait1second * 2);

            await Misc.switchToFrame();
            await result.startFocus();

            await result.editCells([
                { rowNumber: 0, columnName: "int_field", value: "25" },
            ], constants.pressEnter);

            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.chord(refKey, Key.ALT, Key.ESCAPE));

            const confirmDialog = await driver.wait(Workbench.untilConfirmationDialogExists("for rollback"),
                constants.wait1second * 2);
            await confirmDialog!.findElement(locator.confirmDialog.accept).click();

        });

        it("Edit a result grid using the Start Editing button", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            if (Os.isWindows()) {
                await driver.sleep(3000);
            }

            await result.editCells([
                { rowNumber: 0, columnName: "text_field", value: "other edited" },
                { rowNumber: 0, columnName: "int_field", value: "30" },
            ], constants.editButton);

            const refKey = Os.isMacOs() ? Key.COMMAND : Key.META;

            await driver.actions()
                .keyDown(refKey)
                .keyDown(Key.ALT)
                .pause(300)
                .keyDown(Key.ENTER)
                .keyUp(Key.ENTER)
                .keyUp(refKey)
                .keyUp(Key.ALT)
                .perform();

            await driver.wait(Workbench.untilNotificationExists("Changes committed successfully", true),
                constants.wait1second * 2);

        });

        it("Edit a result grid and rollback", async () => {
            const modifiedText = "56";
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await result.editCells(
                [{
                    rowNumber: 0,
                    columnName: "test_integer",
                    value: modifiedText,
                }], constants.doubleClick);

            await result.rollbackChanges();
            expect((await result.resultContext!.getAttribute("innerHTML")).match(/rollbackTest/) === null,
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
                const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultGrid;
                expect(result.status).to.match(/OK/);
                const editBtn = await result.getEditButton();
                expect(await editBtn!.getAttribute("data-tooltip"),
                    `'${query}' should not be editable`).to.equal("Data not editable");
            }

        });

        it("Add new row on result grid - integer columns", async () => {

            await Workbench.toggleSideBar(false);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            const booleanEdited = true;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.12345";
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

            await result.addRow(rowToAdd);
            await result.applyChanges();

            await driver.wait(result.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_ints where id = (select max(id) from sakila.all_data_types_ints);", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);

            const row = 0;

            const testBoolean = await result1.getCellValue(row, "test_boolean");
            expect(testBoolean, errors.incorrectCellValue("BOOLEAN")).to.equals(booleanEdited.toString());
            const testSmallInt = await result1.getCellValue(row, "test_smallint");
            expect(testSmallInt, errors.incorrectCellValue("SMALLINT")).to.equals(smallIntEdited);
            const testMediumInt = await result1.getCellValue(row, "test_mediumint");
            expect(testMediumInt, errors.incorrectCellValue("MEDIUMINT")).to.equals(mediumIntEdited);
            const testInteger = await result1.getCellValue(row, "test_integer");
            expect(testInteger, errors.incorrectCellValue("INT")).to.equals(intEdited);
            const testBigInt = await result1.getCellValue(row, "test_bigint");
            expect(testBigInt, errors.incorrectCellValue("BIGINT")).to.equals(bigIntEdited);
            const testDecimal = await result1.getCellValue(row, "test_decimal");
            expect(testDecimal, errors.incorrectCellValue("DECIMAL")).to.equals(decimalEdited);
            const testFloat = await result1.getCellValue(row, "test_float");
            expect(testFloat, errors.incorrectCellValue("FLOAT")).to.equals(floatEdited);
            const testDouble = await result1.getCellValue(row, "test_double");
            expect(testDouble, errors.incorrectCellValue("DOUBLE")).to.equals(doubleEdited);

        });

        it("Add new row on result grid - date columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_dates;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
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

            await result.addRow(rowToAdd);
            await result.applyChanges();
            await driver.wait(result.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5);

            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_dates where id = (select max(id) from sakila.all_data_types_dates);") as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);
            const row = 0;
            const testDate = await result1.getCellValue(row, "test_date");
            expect(testDate, errors.incorrectCellValue("DATE")).to.equals("01/01/2024");
            const testDateTime = await result1.getCellValue(row, "test_datetime");
            expect(testDateTime, errors.incorrectCellValue("DATETIME")).to.equals("01/01/2024");
            const testTimeStamp = await result1.getCellValue(row, "test_timestamp");
            expect(testTimeStamp, errors.incorrectCellValue("TIMESTAMP")).to.equals("01/01/2024");
            const testTime = await result1.getCellValue(row, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime,
                errors.incorrectCellValue("TIME")).to.equals(true);
            const testYear = await result1.getCellValue(row, "test_year");
            expect(testYear, errors.incorrectCellValue("YEAR")).to.equals(yearEdited);

        });

        it("Add new row on result grid - char columns", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_chars;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

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

            await result.addRow(rowToAdd);
            await result.applyChanges();

            await driver.wait(result.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5);
            const result1 = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_chars where id = (select max(id) from sakila.all_data_types_chars);", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);

            const row = 0;
            const testChar = await result1.getCellValue(row, "test_char");
            expect(testChar, errors.incorrectCellValue("CHAR")).to.equals(charEdited);
            const testVarChar = await result1.getCellValue(row, "test_varchar");
            expect(testVarChar, errors.incorrectCellValue("VARCHAR")).to.equals(varCharEdited);
            const testTinyText = await result1.getCellValue(row, "test_tinytext");
            expect(testTinyText, errors.incorrectCellValue("TINYTEXT")).to.equals(tinyTextEdited);
            const testText = await result1.getCellValue(row, "test_text");
            expect(testText, errors.incorrectCellValue("TINYTEXT")).to.equals(textEdited);
            const testMediumText = await result1.getCellValue(row, "test_mediumtext");
            expect(testMediumText, errors.incorrectCellValue("MEDIUMTEXT")).to.equals(textMediumEdited);
            const testLongText = await result1.getCellValue(row, "test_longtext");
            expect(testLongText, errors.incorrectCellValue("LONGTEXT")).to.equals(longTextEdited);
            const testEnum = await result1.getCellValue(row, "test_enum");
            expect(testEnum, errors.incorrectCellValue("ENUM")).to.equals(enumEdited);
            const testSet = await result1.getCellValue(row, "test_set");
            expect(testSet, errors.incorrectCellValue("SET")).to.equals(setEdited);
            const testJson = await result1.getCellValue(row, "test_json");
            expect(testJson, errors.incorrectCellValue("JSON")).to.equals(jsonEdited);

        });

        it("Add new row on result grid - geometry columns", async () => {

            await notebook.codeEditor.clean();
            let result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_geometries;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

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

            await result.addRow(rowToAdd);
            await result.applyChanges();

            await driver.wait(result.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 5);
            result = await notebook.codeEditor
                // eslint-disable-next-line max-len
                .execute("select * from sakila.all_data_types_geometries where id = (select max(id) from sakila.all_data_types_geometries);", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            const row = 0;
            const testPoint = await result.getCellValue(row, "test_point");
            expect(testPoint, errors.incorrectCellValue("GEOMETRY")).to.equals(constants.geometry);
            const testLineString = await result.getCellValue(row, "test_linestring");
            expect(testLineString, errors.incorrectCellValue("LINESTRING")).to.equals(constants.geometry);
            const testPolygon = await result.getCellValue(row, "test_polygon");
            expect(testPolygon, errors.incorrectCellValue("POLYGON")).to.equals(constants.geometry);
            const testMultiPoint = await result.getCellValue(row, "test_multipoint");
            expect(testMultiPoint, errors.incorrectCellValue("MULTIPOINT")).to.equals(constants.geometry);
            const testMultiLineString = await result.getCellValue(row, "test_multilinestring");
            expect(testMultiLineString, errors.incorrectCellValue("MULTILINESTRING")).to.equals(constants.geometry);
            const testMultiPolygon = await result.getCellValue(row, "test_multipolygon");
            expect(testMultiPolygon, errors.incorrectCellValue("MULTIPOLYGON")).to.equals(constants.geometry);
            const testGeomCollection = await result.getCellValue(row, "test_geometrycollection");
            expect(testGeomCollection, errors.incorrectCellValue("GEOMCOLLECTION")).to.equals(constants.geometry);
            const testBit = await result.getCellValue(row, "test_bit");
            expect(testBit, errors.incorrectCellValue("BIT")).to.equals("16127");

        });

        it("Close a result set", async () => {

            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.actor limit 1;", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

            const id = result.id;
            await result.closeResultSet();

            await driver.wait(async () => {
                return (await driver.findElements(locator.notebook.codeEditor.editor.result.existsById(String(id))))
                    .length === 0;
            }, constants.wait1second * 5, `The result set was not closed`);
            await notebook.codeEditor.clean();

        });

        it("Refresh result grid after cell update", async () => {
            await notebook.codeEditor.clean();
            const result1 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);

            const result2 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result2.status).to.match(/OK/);

            await result2.editCells([
                { rowNumber: 0, columnName: "text_field", value: "this value was edited" },
            ], constants.doubleClick);
            await result2.applyChanges();

            await result1.refresh();
            await driver.wait(result1.untilCellValueIs(0, "text_field", "this value was edited"),
                constants.wait1second * 5);
        });

        it("Refresh result grid after adding a row", async () => {
            await notebook.codeEditor.clean();
            const result1 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);

            const result2 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result2.status).to.match(/OK/);

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "text_field", value: "this is a new value" },
            ];

            const prevRows = await result1.getRows();
            await result2.addRow(rowToAdd);
            await result2.applyChanges();
            await driver.wait(result2.untilStatusMatches(/(\d+).*updated/), constants.wait1second * 3);

            await result1.refresh();

            await driver.wait(async () => {
                return ((await result1.getRows()).length) > prevRows.length;
            }, constants.wait1second * 3, `Number of rows is still ${prevRows.length}`);
        });

        it("Refresh result grid after row deletion", async () => {
            const deleteQuery = "delete from sakila.result_sets where text_field = 'this is a new value';";

            const result1 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);

            const result2 = await notebook.codeEditor
                .execute("select * from sakila.result_sets;", true) as E2ECommandResultGrid;
            expect(result2.status).to.match(/OK/);

            const prevRows = await result1.getRows();
            const result3 = await notebook.codeEditor.execute(deleteQuery, true) as E2ECommandResultData;
            expect(result3.text).to.match(/OK/);
            await (await notebook.toolbar.getButton(constants.commit))!.click();

            await result1.refresh();
            await driver.wait(async () => {
                return ((await result1.getRows()).length) < prevRows.length;
            }, constants.wait1second * 3, `Number of rows is still ${prevRows.length}`);
        });

        it("Unsaved changes dialog on result grid", async () => {

            await Workbench.openMySQLShellForVSCode();
            const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await openEditorsSection.expand();
            await Workbench.dismissNotifications();

            await openEditorsSection.clickTreeItemActionButton(globalConn.caption!,
                constants.newMySQLScript);

            await dbTreeSection.openContextMenuAndSelect(anotherConn.caption!, constants.openNewConnection);
            const anotherConnNotebook = new E2ENotebook();
            await driver.wait(anotherConnNotebook.untilIsOpened(anotherConn), constants.wait1second * 5);

            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            await dbTreeSection.expandTreeItem(new RegExp(constants.mysqlAdmin));
            await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                globalConn.caption!);
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor
                .execute("select * from sakila.all_data_types_ints where id = 1;", true) as E2ECommandResultGrid;

            expect(result.status).to.match(/OK/);
            const cellsToEdit: interfaces.IResultGridCell[] = [
                {
                    rowNumber: 0,
                    columnName: "test_smallint",
                    value: "32751",
                }];
            await result.editCells(cellsToEdit, constants.doubleClick);

            await (await dbTreeSection.getTreeItem(constants.serverStatus)).click();
            let dialog = await driver
                .wait(Workbench.untilConfirmationDialogExists(" after switching to Server Status page")
                    , constants.wait1second * 5);
            expect(await (await dialog!.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog!), constants.wait1second * 3, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait1second * 5);
            await (await dbTreeSection.getTreeItem(constants.clientConns)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Client Connections page"),
                constants.wait1second * 5);
            expect(await (await dialog!.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog!), constants.wait1second * 3, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait1second * 5);

            await (await dbTreeSection.getTreeItem(constants.perfDash)).click();
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to Performance Dashboard page"),
                constants.wait1second * 5);
            expect(await (await dialog!.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog!), constants.wait1second * 3, "The dialog was not closed");
            await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(constants.openEditorsDBNotebook)),
                constants.wait1second * 5);

            await notebook.toolbar.editorSelector.selectEditor(/DB Connection Overview/);
            dialog = await driver.wait(Workbench
                .untilConfirmationDialogExists(" after switching to DB Connections Overview page"),
                constants.wait1second * 5);
            expect(await (await dialog!.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            await driver.wait(until.stalenessOf(dialog!), constants.wait1second * 3, "The dialog was not closed");

            await notebook.toolbar.editorSelector.selectEditor(/Untitled-(\d+)/, globalConn.caption!);
            dialog = await driver.wait(Workbench.untilConfirmationDialogExists(" after switching to a script page"),
                constants.wait1second * 5);
            expect(await (await dialog!.findElement(locator.confirmDialog.msg))
                .getText())
                .to.match(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.refuse).click();
            await driver.wait(until.stalenessOf(dialog!), constants.wait1second * 3, "The dialog was not closed");

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/a_test`;
        const notebook = new E2ENotebook();
        let e2eRecording: E2ERecording;

        before(async function () {
            let hookResult = "passed";
            const localE2eRecording = new E2ERecording(this.test!.title!);
            try {
                if (!Os.isWindows()) {
                    await localE2eRecording!.start();
                }
                await Workbench.openMySQLShellForVSCode();
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook));
                try {
                    await fs.access(`${destFile}.mysql-notebook`);
                    await fs.unlink(`${destFile}.mysql-notebook`);
                } catch (e) {
                    // continue, file does not exist
                }

                await notebook.codeEditor.clean();
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        after(async function () {
            const localE2eRecording = new E2ERecording(this.currentTest!.title);
            try {
                if (!Os.isWindows()) {
                    await localE2eRecording!.start();
                }
                await Workbench.closeAllEditors();
                await fs.unlink(`${destFile}.mysql-notebook`);
                const activityBar = new ActivityBar();
                await (await activityBar.getViewControl(constants.extensionName))?.openView();
            } finally {
                await Misc.processResult(this, localE2eRecording);
            }
        });

        it("Save Notebooks", async () => {

            const result = await notebook.codeEditor.execute("SELECT VERSION();", true) as E2ECommandResultGrid;
            expect(result.status).to.match(/1 record retrieved/);
            await (await notebook.toolbar.getButton(constants.saveNotebook))!.click();
            await Workbench.setInputPath(destFile);

            await driver.wait(new Condition(`for ${destFile}.mysql-notebook to exist`, async () => {
                try {
                    E2ELogger.info(`accessTest: ${destFile}.mysql-notebook`);
                    await fs.access(`${destFile}.mysql-notebook`);

                    return true;
                } catch (e) {
                    return false;
                }
            }), constants.wait1second * 5, `File was not saved to ${process.cwd()}`);

        });

        it("Replace this Notebook with content from a file", async () => {

            await driver.wait(async () => {
                try {
                    const loadNotebook = await notebook.toolbar.getButton(constants.loadNotebook);
                    await driver.actions().move({ origin: loadNotebook }).perform();
                    await driver.executeScript("arguments[0].click();", loadNotebook);
                    await Workbench.setInputPath(`${destFile}.mysql-notebook`);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.TimeoutError)) {
                        throw e;
                    }
                }
            }, constants.wait1second * 15, "Input path box was not displayed");

            await notebook.exists("SELECT VERSION");

        });

        it("Open the Notebook from file with connection", async function () {

            this.retries(2);
            await Workbench.closeAllEditors();
            await driver.wait(Workbench.untilExplorerFolderIsOpened("e2e"), constants.wait1second * 15);
            const e2eTreeSection = new E2EAccordionSection("e2e");

            await e2eTreeSection.openContextMenuAndSelect("a_test.mysql-notebook",
                constants.openNotebookWithConn);
            const input = await InputBox.create(constants.wait1second * 5);
            await driver.wait(async () => {
                try {
                    await input.selectQuickPick(globalConn.caption!);

                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    } else {
                        return true;
                    }
                }
            }, constants.wait1second * 5, "Could not select the quick pick");

            await driver.wait(Workbench.untilTabIsOpened("a_test.mysql-notebook"), constants.wait1second * 20);
            try {
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait1second * 5);
            } catch (e) {
                await Misc.switchBackToTopFrame();
                await Misc.switchToFrame();
                const connOverview = new DatabaseConnectionOverview();
                const conn = await connOverview.getConnection(globalConn.caption!);
                await conn.click();
            }

            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait1second * 5);
            await notebook.exists("SELECT VERSION");

        });

        it("Open the Notebook from file", async function () {

            this.retries(2);
            await Workbench.closeAllEditors();
            await driver.wait(Workbench.untilExplorerFolderIsOpened("e2e"), constants.wait1second * 15);
            const file = await (await new SideBarView().getContent().getSection("e2e"))
                .findItem("a_test.mysql-notebook", 3);
            await file!.click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);
            await Workbench.openEditor("a_test.mysql-notebook");
            await notebook.exists("SELECT VERSION");

        });

        it("Auto close notebook tab when DB connection is deleted", async function () {

            this.retries(2);
            const e2eTreeSection = new E2EAccordionSection("e2e");
            const file = await e2eTreeSection.getTreeItem("a_test.mysql-notebook");
            await file.click();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);
            await Workbench.openEditor("a_test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl(constants.extensionName))?.openView();
            await dbTreeSection.deleteDatabaseConnection(globalConn.caption!);
            const tabs = await Workbench.getOpenEditorTitles();
            expect(tabs, errors.tabIsNotOpened("a_test.mysql-notebook")).to.not.include("a_test.mysql-notebook");

        });

        it("Open the Notebook from file with no DB connections", async function () {

            this.retries(2);
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
        const notebook = new E2ENotebook();
        let e2eRecording: E2ERecording;

        before(async function () {
            const localE2eRecording = new E2ERecording(this.test!.title!);
            let hookResult = "passed";
            try {
                if (!Os.isWindows()) {
                    await localE2eRecording!.start();
                }
                await dbTreeSection.createDatabaseConnection(heatWaveConn);
                await (await new DatabaseConnectionOverview().getConnection(heatWaveConn.caption!)).click();
                await driver.wait(notebook.untilIsOpened(heatWaveConn), constants.waitConnectionOpen);
                let result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultData;
                await driver.wait(result.heatWaveChatIsDisplayed(), constants.wait1second * 5);
                result = await notebook.codeEditor.refreshResult(result.command, result.id) as E2ECommandResultData;
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        it("Execute a query", async () => {

            const query = "How do I cook fish?";
            await Workbench.toggleSideBar(false);
            await (await notebook.toolbar.getButton(constants.showChatOptions))!.click();
            const hwProfileEditor = new HeatWaveProfileEditor();
            await driver.wait(hwProfileEditor.untilIsOpened(), constants.wait1second * 5);
            await hwProfileEditor.selectModel(constants.modelMistral);
            await notebook.codeEditor.languageSwitch("\\chat");
            await notebook.codeEditor.build();
            const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultData;
            expect(result.chat!.length).to.be.greaterThan(0);

            const history = await hwProfileEditor.getHistory();
            expect(history[0].userMessage).to.equals(query);
            expect(history[0].chatBotOptions!.length).to.be.greaterThan(0);
            const dbTables = await hwProfileEditor.getDatabaseTables();
            expect(dbTables).to.include(`\`${newTask.targetDatabaseSchema}\`.\`${newTask.name}\``);
            const matchedDocuments = await hwProfileEditor.getMatchedDocuments();
            expect(matchedDocuments.length).to.be.greaterThan(0);

            const documentTitles: string[] = [];
            for (const doc of matchedDocuments) {
                documentTitles.push(doc.title!);
            }

            expect(documentTitles.join(" ")).to.include("cookbook");
        });

    });

});
