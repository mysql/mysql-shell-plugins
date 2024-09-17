/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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
 * MERCHANTABILITY or itNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import * as fs from "fs/promises";
import { basename, join } from "path";
import { Key, error, until } from "selenium-webdriver";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { driver, loadDriver } from "../../lib/driver.js";
import { Os } from "../../lib/os.js";
import { E2EStatusBar } from "../../lib/E2EStatusBar.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";
import { E2ECodeEditorWidget } from "../../lib/E2ECodeEditorWidget.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

const globalConn: interfaces.IDBConnection = {
    dbType: "MySQL",
    caption: `connNotebooks`,
    description: "Local connection",
    basic: {
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser2",
        port: parseInt(process.env.DBPORT!, 10),
        portX: parseInt(process.env.DBPORTX!, 10),
        schema: "sakila",
        password: "dbuser2",
    },
};

describe("Notebook", () => {

    const notebook = new E2ENotebook();
    let testFailed = false;
    let cleanEditor = false;

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.executeScript("arguments[0].click()",
                await driver.wait(until.elementLocated(locator.sqlEditorPage.icon)), constants.wait5seconds);
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
            const dbConnection = await DatabaseConnectionOverview.getConnection(globalConn.caption!);
            await driver.actions().move({ origin: dbConnection }).perform();
            await driver.executeScript("arguments[0].click()", dbConnection);
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.codeEditor.loadCommandResults();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Notebook");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
        if (cleanEditor) {
            await notebook.codeEditor.clean();
            cleanEditor = false;
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    testFailed = false;

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
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Verify status bar", async () => {
        try {
            const statusBar = new E2EStatusBar();
            const editorPosition = await statusBar.getEditorPosition();
            const regex = new RegExp(/Ln (\d+), Col (\d+)/);
            expect(editorPosition).toMatch(regex);
            let groups = editorPosition.match(regex);
            const line = parseInt(groups![1], 10);
            const col = parseInt(groups![2], 10);
            expect(await statusBar.getEditorIdent()).toMatch(/Spaces: (\d+)/);
            expect(await statusBar.getEditorEOL()).toBe("LF");
            expect(await statusBar.getEditorLanguage()).toBe("mixed/mysql");
            await notebook.codeEditor.setNewLine();
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(" ");
            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![2], 10)).toBeGreaterThan(col);

            await notebook.codeEditor.languageSwitch("\\javascript ");
            expect(await statusBar.getEditorLanguage()).toBe("mixed/javascript");
            await notebook.codeEditor.languageSwitch("\\typescript ");
            expect(await statusBar.getEditorLanguage()).toBe("mixed/typescript");
            await notebook.codeEditor.languageSwitch("\\sql ");
            expect(await statusBar.getEditorLanguage()).toBe("mixed/mysql");
        } catch (e) {
            testFailed = true;
            throw e;
        }


    });

    it("Context Menu - Execute", async () => {
        try {
            let result = await notebook.codeEditor
                .executeWithContextMenu("select * from actor limit 1", "Execute Block");
            expect(result.toolbar!.status).toMatch(/OK, (\d+) record retrieved/);
            expect(await notebook.codeEditor.hasNewPrompt()).toBe(false);
            await notebook.codeEditor.clean();
            result = await notebook.codeEditor
                .executeWithContextMenu("select * from address limit 1", "Execute Block and Advance",
                    false);
            expect(result.toolbar?.status).toMatch(/OK, (\d+) record retrieved/);
            await driver.wait(async () => {
                return notebook.codeEditor.hasNewPrompt();
            }, constants.wait3seconds, "The code editor should have a new prompt");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {
            const result = await notebook.codeEditor
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;", true);
            expect(result.toolbar?.status).toMatch(/OK/);
            expect(result.tabs?.length).toBe(2);
            expect(result.tabs![0].name).toBe("Result #1");
            expect(result.tabs![1].name).toBe("Result #2");
            expect(await result.grid!.content!.getAttribute("innerHTML"))
                .toMatch(/actor_id.*first_name.*last_name.*last_update/);
            await result.selectTab(result.tabs![1].name);
            expect(await result.grid!.content!.getAttribute("innerHTML"))
                .toMatch(/address.*address2.*district.*city_id.*postal_code.*phone.*last_update/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify default schema", async () => {
        try {
            const defaultSchema = await driver.findElement(
                locator.notebook.explorerHost.schemas.default,
            );
            expect(await defaultSchema.getText()).toBe(String((globalConn.basic as interfaces.IConnBasicMySQL).schema));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
        try {
            const result = await notebook.codeEditor.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execAsText);
            expect(result.toolbar!.status).toMatch(/OK/);
            expect(result.text).toMatch(/\|.*\|/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {
            const result = await notebook.codeEditor.executeWithButton("SELECT * FROM sakila.actor;",
                constants.execFullBlockSql);
            expect(result.toolbar!.status).toMatch(/(\d+) record/);
            await driver.wait(notebook.codeEditor.untilNewPromptExists(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {
            const query1 = "select * from sakila.actor limit 1;";
            const query2 = "select * from sakila.address limit 2;";
            await notebook.codeEditor.write(query1, true);
            await notebook.codeEditor.setNewLine();
            await notebook.codeEditor.write(query2, true);
            let result = await notebook.codeEditor.findAndExecute(query1);
            expect(result.toolbar!.status).toMatch(/OK/);
            let htmlGrid = await result.grid!.content!.getAttribute("innerHTML");
            expect(htmlGrid).toMatch(/actor_id/);

            await driver.sleep(1000);
            await notebook.codeEditor.loadCommandResults();
            result = await notebook.codeEditor
                .findAndExecute(query2, notebook.codeEditor.resultIds[notebook.codeEditor.resultIds.length - 1]);
            expect(result.toolbar!.status).toMatch(/OK/);
            htmlGrid = await result.grid!.content!.getAttribute("innerHTML");
            expect(htmlGrid).toMatch(/address_id/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {
            const autoCommitBtn = await notebook.toolbar.getButton(constants.autoCommit);
            const style = await autoCommitBtn!.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
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

            let result = await notebook.codeEditor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result.text).toMatch(/OK/);

            await rollBackBtn!.click();

            result = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.text).toMatch(/OK/);

            result = await notebook.codeEditor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result.text).toMatch(/OK/);

            await commitBtn!.click();

            result = await notebook.codeEditor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.toolbar!.status).toMatch(/OK/);

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

            result = await notebook.codeEditor.execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(result.text).toMatch(/OK/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
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

    it("Explorer - Expand and collapse schema tree elements", async () => {
        try {

            await notebook.explorer.toggleSection(constants.openEditors, false);
            await notebook.explorer.toggleSection(constants.mysqlAdministration, false);
            await notebook.explorer.toggleSection(constants.scripts, false);
            const sakila = await notebook.explorer.getSchemasTreeElement("sakila", constants.schemaType);
            expect(
                await (
                    await sakila!.findElement(locator.notebook.explorerHost.schemas.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await notebook.explorer.toggleSchemasTreeObject("Tables", constants.tablesType);
            const tables = await notebook.explorer.getSchemasTreeElement("Tables", constants.tablesType);

            await driver.wait(async () => {
                try {
                    const treeToggle = await tables!.findElement(locator.notebook.explorerHost.schemas.treeToggle);

                    return ((await treeToggle.getAttribute("class")).includes("expanded"));
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError)) {
                        throw e;
                    }
                }
            }, constants.wait10seconds, "Tables tree was not expanded");

            expect(await notebook.explorer.getSchemasTreeElement("actor", constants.objectType)).toBeDefined();
            expect(await notebook.explorer.getSchemasTreeElement("address", constants.objectType)).toBeDefined();
            expect(await notebook.explorer.getSchemasTreeElement("category", constants.objectType)).toBeDefined();
            expect(await notebook.explorer.getSchemasTreeElement("city", constants.objectType)).toBeDefined();
            expect(await notebook.explorer.getSchemasTreeElement("country", constants.objectType)).toBeDefined();
            await notebook.explorer.toggleSchemasTreeObject("Tables", "Tables");

            let attr = await (
                await notebook.explorer.getSchemasTreeElement("Tables", constants.tablesType)
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await notebook.explorer.toggleSchemasTreeObject("Views", constants.viewsType);
            expect(
                await (
                    await notebook.explorer.getSchemasTreeElement("Views", constants.viewsType)
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await notebook.explorer.getSchemasTreeElement("test_view", constants.objectType)).toBeDefined();
            await notebook.explorer.toggleSchemasTreeObject("Views", constants.viewsType);
            attr = await (
                await notebook.explorer.getSchemasTreeElement("Views", constants.viewsType)
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await notebook.explorer.toggleSchemasTreeObject("sakila", constants.schemaType);
            attr = await (
                await notebook.explorer.getSchemasTreeElement("sakila", constants.schemaType)
            )!.getAttribute("class");
            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Explorer - Expand and collapse sections", async () => {
        try {
            await notebook.explorer.toggleSection(constants.openEditors, true);
            await notebook.explorer.toggleSection(constants.openEditors, false);
            await notebook.explorer.toggleSection(constants.openEditors, true);
            await notebook.explorer.toggleSection(constants.schemas, false);
            await notebook.explorer.toggleSection(constants.schemas, true);
            await notebook.explorer.toggleSection(constants.mysqlAdministration, false);
            await notebook.explorer.toggleSection(constants.mysqlAdministration, true);
            await notebook.explorer.toggleSection(constants.scripts, false);
            await notebook.explorer.toggleSection(constants.scripts, true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Execute code on different prompt languages", async () => {
        try {
            const query = "select * from sakila.actor limit 1";
            const jsCmd = "Math.random()";
            const result1 = await notebook.codeEditor.execute(query);
            const block1 = result1.id;
            expect(result1.toolbar!.status).toMatch(/OK/);
            await notebook.codeEditor.languageSwitch("\\javascript ");
            const result2 = await notebook.codeEditor.execute(jsCmd);
            const block2 = result2.id;
            expect(result2.text).toMatch(/(\d+).(\d+)/);
            const result3 = await notebook.codeEditor.findAndExecute(query, block1);
            expect(result3.toolbar!.status).toMatch(/OK/);
            const result4 = await notebook.codeEditor.findAndExecute(jsCmd, block2);
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
            await notebook.codeEditor.languageSwitch("\\sql ", true);
            const result1 = await notebook.codeEditor.execute("select version();");
            expect(result1.toolbar?.status).toMatch(/1 record retrieved/);
            const cell = result1.grid!.content!
                .findElement(locator.notebook.codeEditor.editor.result.grid.row.cell.exists);
            const cellText = await cell.getText();
            const server = cellText.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            const result2 = await notebook.codeEditor.execute(`/*!${serverVer} select * from sakila.actor;*/`, true);
            expect(result2.toolbar!.status).toMatch(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            const result3 = await notebook.codeEditor.execute(`/*!${higherServer} select * from sakila.actor;*/`, true);
            expect(result3.text).toMatch(/OK, 0 records retrieved/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {
            await notebook.codeEditor.languageSwitch("\\ts ", true);
            const result = await notebook.codeEditor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`);

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

    it("Using a DELIMITER", async () => {
        try {
            const query =
                `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$


                    select 1 $$
                `;

            await notebook.codeEditor.languageSwitch("\\sql ", true);
            const result = await notebook.codeEditor.executeWithButton(query, constants.execFullBlockSql);
            expect(result.toolbar!.status).toMatch(/OK/);
            expect(result.tabs!.length).toBe(2);
            expect(result.tabs![0].name).toMatch(/Result/);
            expect(result.tabs![1].name).toMatch(/Result/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add a new console", async () => {
        try {
            const newConsole = "myNewConsole";
            await notebook.explorer.addNewConsole(newConsole);
            expect(await notebook.explorer.getOpenEditor(new RegExp(newConsole))).toBeDefined();
            expect((await notebook.toolbar.getCurrentEditor())?.label).toBe(newConsole);
            await notebook.codeEditor.write("select actor from actor");
            await notebook.toolbar.selectEditor(/DB Notebook/);
            await notebook.toolbar.selectEditor(new RegExp(newConsole));
            await notebook.explorer.closeConsole(newConsole);
            expect((await notebook.toolbar.getCurrentEditor())?.label).toBe("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Save the notebook", async () => {
        const outDir = process.env.USERPROFILE ?? process.env.HOME;
        let notebookFile = "";
        try {
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("SELECT VERSION();");
            expect(result.toolbar!.status).toMatch(/1 record retrieved/);
            await (await notebook.toolbar.getButton(constants.saveNotebook))!.click();
            await driver.wait(async () => {
                const files = await fs.readdir(String(outDir));
                for (const file of files) {
                    if (file.includes(".mysql-notebook")) {
                        notebookFile = join(String(outDir), file);
                        try {
                            const file = await fs.readFile(notebookFile);
                            JSON.parse(file.toString());

                            return true;
                        } catch (e) {
                            // continue
                        }
                    }
                }
            }, constants.wait10seconds, `No file with extension '.mysql-notebook' was found at ${outDir}`);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await fs.unlink(notebookFile).catch(() => {
                // continue
            });
        }
    });

    it("Schema autocomplete context menu", async () => {
        try {
            await notebook.codeEditor.languageSwitch("\\sql ", true);
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

    it("Valid and invalid json", async () => {
        try {
            await notebook.codeEditor.clean();
            await notebook.codeEditor.languageSwitch("\\ts ");
            let result = await notebook.codeEditor.execute(`print('{"a": "b"}')`);
            expect(result.json).toBeDefined();

            result = await notebook.codeEditor.execute(`print('{ a: b }')`);
            expect(result.json).toBeUndefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Notebook headless off", () => {

    let testFailed = false;
    const anotherConnection: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `no headless`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: "dbuser2",
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: "dbuser2",
        },
    };

    const notebook = new E2ENotebook();

    beforeAll(async () => {
        try {
            await loadDriver(false);
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");

            await driver.executeScript("arguments[0].click()",
                await driver.wait(until.elementLocated(locator.sqlEditorPage.icon)), constants.wait5seconds);

            await DatabaseConnectionOverview.createDataBaseConnection(anotherConnection);
            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(anotherConnection.caption!));
            await driver.wait(new E2ENotebook().untilIsOpened(anotherConnection), constants.wait10seconds);
            await notebook.codeEditor.loadCommandResults();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Notebook");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Copy to clipboard button", async () => {
        try {
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("\\about ");
            await result.copyToClipboard();
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await Os.keyboardPaste(textArea);
            await driver.wait(async () => {
                return notebook.exists("Welcome");
            }, constants.wait5seconds, "The text was not pasted to the notebook");
            expect(await driver.executeScript("return await navigator.clipboard.readText()")).toContain("Welcome");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Result grid context menu - Copy single row", async () => {
        try {
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.actor limit 1;");
            expect(result.toolbar!.status).toMatch(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy row.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRow(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row failed`);

            // Copy row with names.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRowWithNames(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names failed`);

            // Copy row unquoted.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRowUnquoted(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row unquoted failed`);

            // Copy row with names, unquoted.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRowWithNamesUnquoted(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, unquoted failed`);

            // Copy row with names, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRowWithNamesTabSeparated(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row with names, tab separated failed`);

            // Copy row, tab separated.
            await driver.wait(async () => {
                const copy = await result.grid!.copyRowTabSeparated(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy row, tab separated failed`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Result grid context menu - Copy multiple rows", async () => {
        try {
            const maxRows = 2;
            const result = await notebook.codeEditor
                .execute(`select * from sakila.actor limit ${maxRows};`);
            expect(result.toolbar!.status).toMatch(/OK/);

            const row = 0;
            const column = "first_name";

            // Copy all rows.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRows(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows failed`);

            // Copy all rows with names.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRowsWithNames(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names failed`);

            // Copy all rows unquoted.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRowsUnquoted(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows unquoted failed`);

            // Copy all rows with names unquoted.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRowsWithNamesUnquoted(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names unquoted failed`);

            // Copy all rows with names tab separated.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRowsWithNamesTabSeparated(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows with names tab separated failed`);

            // Copy all rows tab separated.
            await driver.wait(async () => {
                const copy = await result.grid!.copyAllRowsTabSeparated(row, column);
                const clipboard = await Os.getClipboardContent();

                if (copy.toString() === clipboard.toString()) {
                    return true;
                } else {
                    console.log(`expected: ${copy.toString()}. Got from clipboard: ${clipboard.toString()}`);
                }
            }, constants.wait10seconds, `Copy all rows tab separated failed`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Result grid context menu - Copy field, copy field unquoted, set field to null", async () => {
        try {
            await notebook.codeEditor.clean();
            const result = await notebook.codeEditor.execute("select * from sakila.result_sets;");
            expect(result.toolbar!.status).toMatch(/OK/);

            const row = 0;
            const allColumns = Array.from(result.grid!.columnsMap!.keys());

            for (let i = 1; i <= allColumns.length - 1; i++) {

                await driver.wait(async () => {
                    const copy = await result.grid!.copyField(row, String(allColumns[i]));
                    const clip = await Os.readClipboard();

                    if (copy.toString().match(new RegExp(clip.toString()))) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field failed");

                await driver.wait(async () => {
                    const copy = await result.grid!.copyFieldUnquoted(row, String(allColumns[i]));
                    const clip = await Os.readClipboard();

                    if (copy.toString() === clip.toString()) {
                        return true;
                    } else {
                        console.log(`expected: ${copy.toString()}. Got from clipboard: ${clip.toString()}`);
                    }
                }, constants.wait10seconds, "Copy field unquoted failed");

                await result.grid!.openCellContextMenuAndSelect(row, String(allColumns[i]),
                    constants.resultGridContextMenu.setFieldToNull);
                expect(await result.grid!.getCellValue(row, String(allColumns[i]))).toBe(constants.isNull);
            }

            await result.toolbar!.rollbackChanges();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });
});
