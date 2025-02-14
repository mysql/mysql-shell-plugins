/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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

import { basename } from "path";
import * as fs from "fs/promises";
import { Condition, Key, until, error } from "selenium-webdriver";
import { driver, loadDriver } from "../lib/driver.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { Os } from "../lib/os.js";
import { Misc } from "../lib/misc.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import * as locator from "../lib/locators.js";
import { E2ECodeEditorWidget } from "../lib/E2ECodeEditorWidget.js";
import { E2EHeatWaveProfileEditor } from "../lib/MySQLAdministration/E2EHeatWaveProfileEditor.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { E2ECommandResultData } from "../lib/CommandResults/E2ECommandResultData.js";
import { E2ECommandResultGrid } from "../lib/CommandResults/E2ECommandResultGrid.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("NOTEBOOKS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `E2E - NOTEBOOKS`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT!, 10),
            schema: "sakila",
            password: String(process.env.DBUSERNAME1PWD),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    let notebook: E2ENotebook;

    beforeAll(async () => {
        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();

            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);

            await (await treeGlobalConn.getActionButton(
                constants.openNewDatabaseConnectionOnNewTab))!.click();
            notebook = await new E2ENotebook().untilIsOpened(globalConn);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_NOTEBOOKS");
            throw e;
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    describe("Code Editor", () => {

        let cleanEditor = false;
        let testFailed = false;
        const destFile = `${process.cwd()}/${globalConn.caption} - ${constants.dbNotebook}.mysql-notebook`;

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();

                if (!cleanEditor) {
                    await notebook.codeEditor.build();
                }
            }

            if (cleanEditor) {
                await notebook.codeEditor.clean();
                cleanEditor = false;
            }
        });

        afterAll(async () => {
            try {
                await dbTreeSection.collapse();
                await new E2ETabContainer().closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot("afterAll_CodeEditor");
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
                            if (!(e instanceof error.StaleElementReferenceError)) {
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
                cleanEditor = true;
            }
        });

        it("Using a DELIMITER", async () => {
            try {
                const query =
                    `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$

                    select 1 $$`;

                const result = await notebook.executeWithButton(query,
                    constants.execFullBlockSql) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);
                expect(result.tabs!.length).toBe(2);
                expect(result.tabs![0].name).toMatch(/Result/);
                expect(result.tabs![1].name).toMatch(/Result/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
            try {
                const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                    constants.execAsText) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);
                expect(result.text).toMatch(/\|.*\|/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {
            try {
                const result = await notebook.executeWithButton("SELECT * FROM sakila.actor;",
                    constants.execFullBlockSql) as E2ECommandResultGrid;
                expect(result.status).toMatch(/(\d+) record/);
                await driver.wait(notebook.codeEditor.untilNewPromptExists(), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";

                await notebook.codeEditor.clean();

                const result1 = await notebook.codeEditor.execute(query1) as E2ECommandResultGrid;
                expect(result1.status).toMatch(/OK/);

                const result2 = await notebook.codeEditor.execute(query2) as E2ECommandResultGrid;
                expect(result2.status).toMatch(/OK/);

                let careResult = await notebook.findAndExecute(query1, result1.id) as E2ECommandResultGrid;
                let htmlGrid = await careResult.resultContext!.getAttribute("innerHTML");
                expect(htmlGrid).toMatch(/actor_id/);

                careResult = await notebook.findAndExecute(query2, result2.id) as E2ECommandResultGrid;
                htmlGrid = await careResult.resultContext!.getAttribute("innerHTML");
                expect(htmlGrid).toMatch(/address_id/);
            } catch (e) {
                testFailed = true;
                throw e;
            } finally {
                cleanEditor = true;
            }
        });

        it("Switch between search tabs", async () => {
            try {
                const query = "select * from sakila.actor limit 1; select * from sakila.address limit 1;";
                const result = await notebook.codeEditor
                    // eslint-disable-next-line max-len
                    .execute(query) as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
                expect(result.tabs!.length).toBe(2);
                expect(result.tabs![0].name).toBe("Result #1");
                expect(result.tabs![1].name).toBe("Result #2");
                expect(Array.from(result.columnsMap!.keys()))
                    .toStrictEqual(["actor_id", "first_name", "last_name", "last_update"]);
                await result.selectTab(result.tabs![1].name);
                expect(Array.from(result.columnsMap!.keys()))
                    .toStrictEqual(["address_id", "address", "address2", "district", "city_id", "postal_code",
                        "phone", "last_update"]);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect to database and verify default schema", async () => {
            try {
                const result = await notebook.codeEditor.execute("SELECT SCHEMA();") as E2ECommandResultGrid;
                expect(result.status).toMatch(/1 record retrieved/);
                expect(await result.resultContext!.getAttribute("innerHTML"))
                    .toMatch(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema!));
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            try {
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
                    constants.wait3seconds, "Commit button should be enabled");

                await driver.wait(until.elementIsEnabled(rollBackBtn!),
                    constants.wait3seconds, "Commit button should be enabled");

                let resultData = await notebook.codeEditor
                    // eslint-disable-next-line max-len
                    .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
                expect(resultData.text).toMatch(/OK/);

                await rollBackBtn!.click();

                // eslint-disable-next-line max-len
                let resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name='${random}';`) as E2ECommandResultGrid;
                expect(resultGrid.status).toMatch(/OK/);

                resultData = await notebook.codeEditor
                    // eslint-disable-next-line max-len
                    .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`) as E2ECommandResultData;
                expect(resultData.text).toMatch(/OK/);

                await commitBtn!.click();

                // eslint-disable-next-line max-len
                resultGrid = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`) as E2ECommandResultGrid;
                expect(resultGrid.status).toMatch(/OK/);

                await autoCommitBtn!.click();

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
                expect(result2.text).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Find and Replace", async () => {
            try {
                await notebook.codeEditor.write(`import from xpto xpto xpto`, true);
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

                expect(await driver.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                    .toContain("import from tester testing testing");
                await widget.close();
            } catch (e) {
                testFailed = true;
                throw e;
            } finally {
                cleanEditor = true;
            }

        });

        it("Execute code on different prompt languages", async () => {
            try {
                const query = "select * from sakila.actor limit 1";
                const jsCmd = "Math.random()";
                const result1 = await notebook.codeEditor.execute(query) as E2ECommandResultGrid;
                const block1 = result1.id;
                expect(result1.status).toMatch(/OK/);
                await notebook.codeEditor.languageSwitch("\\js");
                const result2 = await notebook.codeEditor.execute(jsCmd) as E2ECommandResultData;
                const block2 = result2.id;
                expect(result2.text).toMatch(/(\d+).(\d+)/);
                const result3 = await notebook.findAndExecute(query, block1) as E2ECommandResultGrid;
                expect(result3.status).toMatch(/OK/);
                const result4 = await notebook.findAndExecute(jsCmd, block2) as E2ECommandResultData;
                expect(result4.text).toMatch(/(\d+).(\d+)/);
            } catch (e) {
                testFailed = true;
                throw e;
            } finally {
                cleanEditor = true;
            }
        });

        it("Multi-line comments", async () => {
            try {
                await notebook.codeEditor.languageSwitch("\\sql ");
                const result1 = await notebook.codeEditor.execute("select version();") as E2ECommandResultGrid;
                expect(result1.status).toMatch(/1 record retrieved/);
                const cell = result1.resultContext!
                    .findElement(locator.notebook.codeEditor.editor.result.grid.row.cell.exists);
                const cellText = await cell.getText();
                const server = cellText.match(/(\d+).(\d+).(\d+)/g)![0];
                const digits = server.split(".");
                let serverVer = digits[0];
                digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
                digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

                const result2 = await notebook.codeEditor
                    .execute(`/*!${serverVer} select * from sakila.actor;*/`) as E2ECommandResultGrid;
                expect(result2.status).toMatch(/OK, (\d+) records retrieved/);
                const higherServer = parseInt(serverVer, 10) + 1;
                const result3 = await notebook.codeEditor
                    .execute(`/*!${higherServer} select * from sakila.actor;*/`) as E2ECommandResultData;
                expect(result3.text).toMatch(/OK, 0 records retrieved/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Maximize and Normalize Result tab", async () => {
            try {
                const result = await notebook.codeEditor.execute("select * from sakila.actor;") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
                await result.maximize();
                expect((await notebook.toolbar.editorSelector.getCurrentEditor()).label).toBe("Result #1");

                try {
                    await result.normalize();
                    await driver
                        .wait(until.elementLocated(locator.notebook.codeEditor.editor.result
                            .toolbar.maximize), constants.wait3seconds);
                } finally {
                    await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook),
                        globalConn.caption);
                    await notebook.codeEditor.build();
                }
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Pie Graph based on DB table", async () => {
            try {
                await notebook.codeEditor.languageSwitch("\\ts ");
                const result = await notebook.codeEditor.execute(
                    `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`) as E2ECommandResultData;

                expect(result.graph).toBeDefined();
                const chartColumns = await result.graph!
                    .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
                for (const col of chartColumns) {
                    expect(parseInt(await col.getAttribute("width"), 10)).toBeGreaterThan(0);
                }
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Autocomplete context menu", async () => {
            try {
                await notebook.codeEditor.languageSwitch("\\sql ");
                await notebook.codeEditor.write("select sak", true);
                await notebook.codeEditor.openSuggestionMenu();
                let els = await notebook.codeEditor.getAutoCompleteMenuItems();
                expect(els.toString()).toMatch(/sakila/);
                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                await textArea.sendKeys(Key.ESCAPE);
                await notebook.codeEditor.write("ila.", true);
                await notebook.codeEditor.openSuggestionMenu();
                els = await notebook.codeEditor.getAutoCompleteMenuItems();
                expect(els.toString()).toMatch(/(actor|address|category)/);
                await textArea.sendKeys(Key.ESCAPE);
                await notebook.codeEditor.write("actor.", true);
                await notebook.codeEditor.openSuggestionMenu();
                els = await notebook.codeEditor.getAutoCompleteMenuItems();
                expect(els.toString()).toMatch(/(actor_id|first_name|last_name)/);
                await textArea.sendKeys(Key.ESCAPE);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Close result tabs using tab context menu", async () => {
            try {

                let query = `select "test1"; `;
                query += `select "test2"; `;
                query += `select "test3";`;

                await notebook.codeEditor.clean();
                let result = await notebook.codeEditor.execute(query) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);

                // Close
                await result.selectTabContextMenu("Result #1", constants.close);
                expect(result.tabs![0].name).toBe("Result #2");
                expect(result.tabs![1].name).toBe("Result #3");
                result = await notebook.codeEditor.execute(query) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);

                // Close others
                await result.selectTabContextMenu("Result #1", constants.closeOthers);
                expect(result.tabs).toBeUndefined();
                await driver.wait(async () => {
                    const newResult = await driver.findElements(locator.notebook.codeEditor.editor.result
                        .existsById(String(result.id)));

                    return (await newResult[0].getAttribute("innerHTML")).match(/test1/);
                }, constants.wait5seconds, `Result #3 should not have been closed`);
                result = await notebook.codeEditor.execute(query) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);

                // Close to the right
                await result.selectTabContextMenu("Result #2", constants.closeToTheRight);
                expect(result.tabs!.length).toBe(2);
                expect(result.tabs![0].name).toBe("Result #1");
                expect(result.tabs![1].name).toBe("Result #2");
                result = await notebook.codeEditor.execute(query) as E2ECommandResultData;
                expect(result.status).toMatch(/OK/);

                // Close all
                await result.selectTabContextMenu("Result #2", constants.closeAll);
                await driver.wait(async () => {
                    return (await driver.findElements(locator.notebook.codeEditor.editor.result
                        .existsById(String(result.id))))
                        .length === 0;
                }, constants.wait5seconds, `Close all did not closed all the tabs`);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Save Notebooks", async () => {
            try {
                await notebook.codeEditor.clean();
                const result = await notebook.codeEditor.execute("SELECT VERSION();") as E2ECommandResultGrid;
                expect(result.status).toMatch(/1 record retrieved/);
                await (await notebook.toolbar.getButton(constants.saveNotebook))!.click();

                await driver.wait(new Condition("", async () => {
                    try {
                        await fs.access(destFile);

                        return true;
                    } catch (e) {
                        return false;
                    }
                }), constants.wait3seconds, `Expecting file to be at: ${destFile}`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Replace this Notebook with content from a file", async () => {
            try {
                await notebook.codeEditor.clean();
                await (await notebook.toolbar.getButton(constants.loadNotebook))!.click();
                await Misc.uploadFile(destFile);
                await driver.wait(notebook.untilExists("SELECT VERSION"), constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            } finally {
                await fs.unlink(destFile).catch(() => {
                    // continue. file was not found
                });
            }
        });

    });

    xdescribe("HeatWave Chat", () => {

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
        let notebook: E2ENotebook;
        let testFailed = false;

        beforeAll(async () => {

            try {
                await dbTreeSection.focus();
                await dbTreeSection.createDatabaseConnection(heatWaveConn);
                await (await new E2EDatabaseConnectionOverview().getConnection(heatWaveConn.caption!)).click();
                notebook = await new E2ENotebook().untilIsOpened(heatWaveConn, constants.wait20seconds);
                const result = await notebook.codeEditor.getLastExistingCommandResult() as E2ECommandResultData;
                await driver.wait(result.heatWaveChatIsDisplayed(), constants.wait5seconds);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_HeatWaveChat");
                throw e;
            }

        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Execute a query", async () => {
            try {
                const query = "How do I cook fish?";
                await (await notebook.toolbar.getButton(constants.showChatOptions))!.click();
                const hwProfileEditor = new E2EHeatWaveProfileEditor();
                await driver.wait(hwProfileEditor.untilIsOpened(), constants.wait5seconds);
                await hwProfileEditor.selectModel(constants.modelMistral);
                await notebook.codeEditor.languageSwitch("\\chat");
                await notebook.codeEditor.build();
                const result = await notebook.codeEditor.execute(query, true) as E2ECommandResultData;
                expect(result.chat!.length).toBeGreaterThan(0);

                const history = await hwProfileEditor.getHistory();
                expect(history[0].userMessage).toBe(query);
                expect(history[0].chatBotOptions!.length).toBeGreaterThan(0);
                const dbTables = await hwProfileEditor.getDatabaseTables();
                expect(dbTables).toContain(`\`${newTask.targetDatabaseSchema}\`.\`${newTask.name}\``);
                const matchedDocuments = await hwProfileEditor.getMatchedDocuments();
                expect(matchedDocuments.length).toBeGreaterThan(0);

                const documentTitles = [];
                for (const doc of matchedDocuments) {
                    documentTitles.push(doc.title);
                }

                expect(documentTitles.join(" ")).toContain("cookbook");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

});

