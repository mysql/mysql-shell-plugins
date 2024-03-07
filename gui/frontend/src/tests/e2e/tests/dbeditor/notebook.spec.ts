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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import fs from "fs/promises";
import { basename, join } from "path";
import { Key, error, until, WebElement } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import * as waitUntil from "../../lib/until.js";
import { platform } from "os";
import { driver, loadDriver } from "../../lib/driver.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

const globalConn: IDBConnection = {
    dbType: undefined,
    caption: `connNotebooks`,
    description: "Local connection",
    hostname: String(process.env.DBHOSTNAME),
    protocol: "mysql",
    username: "dbuser2",
    port: String(process.env.DBPORT),
    portX: String(process.env.DBPORTX),
    schema: "sakila",
    password: "dbuser2",
    sslMode: undefined,
    sslCA: undefined,
    sslClientCert: undefined,
    sslClientKey: undefined,
};

describe("Notebook", () => {

    const commandExecutor = new CommandExecutor();
    let testFailed = false;
    let cleanEditor = false;

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.executeScript("arguments[0].click()", await driver.findElement(locator.sqlEditorPage.icon));
            const db = await DBNotebooks.createDBconnection(globalConn);
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(globalConn);
            await Misc.setConfirmDialog(globalConn, "no");
            await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
                explicitWait * 2, "Notebook was not loaded");
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
            await commandExecutor.clean();
            cleanEditor = false;
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    testFailed = false;

    it("Multi-cursor", async () => {
        try {
            await commandExecutor.write("hello 1", true);
            await DBNotebooks.setNewLineOnEditor();
            await commandExecutor.write("hello 2");
            await DBNotebooks.setNewLineOnEditor();
            await commandExecutor.write("hello 3");

            await driver.actions().keyDown(Key.ALT).perform();

            const clickLine = async (line: number): Promise<void> => {
                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                        lines.shift();
                        const spans = await lines[line].findElements(locator.htmlTag.span);
                        await spans[spans.length - 1].click();

                        return true;
                    } catch (e) {
                        // continue
                    }
                }, explicitWait, `Line ${line} is still stale`);
            };

            await clickLine(0);
            await clickLine(1);

            await driver.actions().keyUp(Key.ALT).perform();

            const ctx = await driver.findElement(locator.notebook.codeEditor.editor.linesContent);
            expect((await ctx.findElements(locator.notebook.codeEditor.editor.currentLine)).length).toBe(3);

            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("testing");

            const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
            const lines = await context.findElements(locator.notebook.codeEditor.editor.line);
            try {
                // is stale ?
                await lines[lines.length - 1].click();
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }

            expect(await Misc.getPromptTextLine("last-2")).toContain("testing");
            expect(await Misc.getPromptTextLine("last-1")).toContain("testing");
            expect(await Misc.getPromptTextLine("last")).toContain("testing");
        } catch (e) {
            testFailed = true;
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Context Menu - Execute", async () => {
        try {
            await commandExecutor.executeWithContextMenu("select * from actor limit 1", "Execute Block");
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt()).toBe(false);
            await commandExecutor.clean();
            await commandExecutor.executeWithContextMenu("select * from address limit 1", "Execute Block and Advance",
                false);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt()).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {
            await commandExecutor
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;", true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const resultTabs = (commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[]);
            expect(resultTabs[0].tabName).toBe("Result #1");
            expect(resultTabs[1].tabName).toBe("Result #2");
            expect(resultTabs[0].content).toMatch(/actor_id.*first_name.*last_name.*last_update/);
            expect(resultTabs[1].content)
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
            expect(await defaultSchema.getText()).toBe(String(globalConn.schema));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {
            await commandExecutor.executeWithButton("SELECT * FROM sakila.actor;", constants.execFullBlockSql);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+) record/);
            await driver.wait(waitUntil.editorHasNewPrompt(),
                constants.wait5seconds, "Editor should have a new prompt");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Execute the block and print the result as text", async () => {
        try {
            await commandExecutor.executeWithButton("SELECT * FROM sakila.actor;", constants.execAsText);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+) record/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/\|.*\|/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {
            const query1 = "select * from sakila.actor limit 1;";
            const query2 = "select * from sakila.address limit 2;";
            await commandExecutor.write(query1, true);
            await DBNotebooks.setNewLineOnEditor();
            await commandExecutor.write(query2, true);
            await commandExecutor.findAndExecute(query1);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/actor_id/);

            await commandExecutor.findAndExecute(query2, commandExecutor.getResultId());
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/address_id/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {
            const autoCommitBtn = await DBNotebooks.getToolbarButton(constants.autoCommit);
            const style = await autoCommitBtn!.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn!.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await DBNotebooks.getToolbarButton(constants.commit);
            const rollBackBtn = await DBNotebooks.getToolbarButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn!),
                constants.wait2seconds, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                constants.wait2seconds, "Commit button should be enabled");

            await commandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await rollBackBtn!.click();

            await commandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await commandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await commitBtn!.click();

            await commandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await autoCommitBtn!.click();

            await driver.wait(
                async () => {
                    const commitBtn = await DBNotebooks.getToolbarButton(constants.commit);
                    const rollBackBtn = await DBNotebooks.getToolbarButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait5seconds,
                "Commit/Rollback DB changes button is still enabled ",
            );

            await commandExecutor.execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Find and Replace", async () => {
        try {
            const contentHost = await driver.findElement(locator.notebook.exists);
            await commandExecutor.write(`import from xpto xpto xpto`);
            const findBtn = await DBNotebooks.getToolbarButton("Find");
            await findBtn!.click();
            const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                constants.wait5seconds, "Find widget does not exist");
            await driver.wait(until.elementIsVisible(finder),
                constants.wait5seconds, "Find widget was not visible");

            await finder.findElement(locator.notebook.codeEditor.textArea).sendKeys("xpto");
            await DBNotebooks.widgetFindInSelection(false);
            expect(await (await finder.findElement(locator.findWidget.matchesCount)).getText()).toMatch(/1 of (\d+)/);
            await driver.wait(
                until.elementsLocated(locator.findWidget.findMatch),
                2000,
                "No words found",
            );
            await DBNotebooks.widgetExpandFinderReplace(true);
            const replacer = await finder.findElement(locator.findWidget.replacePart);
            await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("tester");
            await (await DBNotebooks.widgetGetReplacerButton("Replace (Enter)"))!.click();
            expect(await (await contentHost.findElement(locator.notebook.codeEditor.textArea)).getAttribute("value"))
                .toContain("import from tester xpto xpto");

            await replacer.findElement(locator.notebook.codeEditor.textArea).clear();
            await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing");
            await (await DBNotebooks.widgetGetReplacerButton("Replace All"))!.click();
            expect(await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                .toContain("import from tester testing testing");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await DBNotebooks.widgetCloseFinder();
            cleanEditor = true;
        }
    });

    it("Expand Collapse schema objects", async () => {
        try {

            await DBConnection.expandCollapseMenus("open editors", false, 0);
            await DBConnection.expandCollapseMenus("scripts", false, 0);
            const sakila = await DBConnection.getSchemaObject("Schema", "sakila");
            expect(
                await (
                    await sakila!.findElement(locator.notebook.explorerHost.schemas.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.toggleSchemaObject("Tables", "Tables");
            const tables = await DBConnection.getSchemaObject("Tables", "Tables");

            await driver.wait(async () => {
                try {
                    const treeToggle = await tables!.findElement(locator.notebook.explorerHost.schemas.treeToggle);

                    return ((await treeToggle.getAttribute("class")).includes("expanded"));
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError)) {
                        throw e;
                    }
                }
            }, explicitWait * 2, "Tables tree was not expanded");

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
                    .findElement(locator.notebook.explorerHost.openEditors.exists)
                    .findElement(locator.notebook.explorerHost.openEditors.container)
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus("open editors", false, 0);
            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.openEditors.exists)
                            .findElement(locator.notebook.explorerHost.openEditors.container)
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
                            .findElement(locator.notebook.explorerHost.openEditors.exists)
                            .findElement(locator.notebook.explorerHost.openEditors.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Open Editors' is still collapsed",
            );

            expect(
                await driver
                    .findElement(locator.notebook.explorerHost.schemas.exists)
                    .findElement(locator.notebook.explorerHost.schemas.container)
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus("schemas", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.schemas.exists)
                            .findElement(locator.notebook.explorerHost.schemas.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Schemas' is still expanded",
            );

            await DBConnection.expandCollapseMenus("schemas", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.schemas.exists)
                            .findElement(locator.notebook.explorerHost.schemas.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Schemas' is still collapsed",
            );

            await DBConnection.expandCollapseMenus("admin", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.administration.exists)
                            .findElement(locator.notebook.explorerHost.administration.scrollBar)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Administration' is still expanded",
            );

            await DBConnection.expandCollapseMenus("admin", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.administration.exists)
                            .findElement(locator.notebook.explorerHost.administration.scrollBar)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Administration' is still collapsed",
            );

            await DBConnection.expandCollapseMenus("scripts", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Scripts' is still expanded",
            );

            await DBConnection.expandCollapseMenus("scripts", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                constants.wait2seconds,
                "'Scripts' is still collapsed",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Execute code on different prompt languages", async () => {
        try {
            const query = "select * from sakila.actor limit 1";
            const languageSwitch = "\\javascript ";
            const jsCmd = "Math.random()";
            await commandExecutor.execute(query);
            const block1 = commandExecutor.getResultId();
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            await commandExecutor.languageSwitch(languageSwitch);
            await commandExecutor.execute(jsCmd, undefined, block1);
            const block2 = commandExecutor.getResultId();
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
            await commandExecutor.findAndExecute(query, block1);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            await commandExecutor.findAndExecute(jsCmd, block2);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Multi-line comments", async () => {
        try {
            await commandExecutor.languageSwitch("\\sql ", true);
            await commandExecutor.execute("select version();");
            expect(commandExecutor.getResultMessage()).toMatch(/1 record retrieved/);
            const txt = await (commandExecutor.getResultContent() as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell).getText();
            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];
            await commandExecutor.execute(`/*!${serverVer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            await commandExecutor.execute(`/*!${higherServer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, 0 records retrieved/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {
            await commandExecutor.languageSwitch("\\ts ", true);
            await commandExecutor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`);

            expect(commandExecutor.getResultMessage()).toMatch(/graph/);
            const pieChart = commandExecutor.getResultContent();
            const chartColumns = await (pieChart as WebElement)
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
            await commandExecutor.languageSwitch("\\sql");
            const query =
                `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$


                    select 1 $$
                `;

            await commandExecutor.executeWithButton(query, constants.execFullBlockSql, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const content = commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[];
            expect(content.length).toBe(2);
            for (const result of content) {
                expect(result.tabName).toMatch(/Result/);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add a new console", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click()",
                await driver.findElement(locator.notebook.explorerHost.openEditors.addConsole),
            );

            const input = await driver.wait(until.elementLocated(locator.notebook.explorerHost.openEditors.textBox),
                explicitWait, "Editor host input was not found");
            if (platform() === "darwin") {
                await input.sendKeys(Key.chord(Key.COMMAND, "a"));
            } else {
                await input.sendKeys(Key.chord(Key.CONTROL, "a"));
            }
            await input.sendKeys(Key.BACK_SPACE);
            await input.sendKeys("myNewConsole");
            await input.sendKeys(Key.ENTER);
            expect(await DBConnection.getOpenEditor(/myNewConsole/)).toBeDefined();
            const documentSelector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
            const currentValue = await documentSelector
                .findElement(locator.notebook.toolbar.editorSelector.currentValue);
            expect(await currentValue.getText()).toContain("myNewConsole");
            const currentIcon = documentSelector.findElement(locator.notebook.toolbar.editorSelector.currentIcon);
            expect(await currentIcon.getAttribute("style")).toContain("notebook");
            await driver
                .findElement(locator.notebook.exists)
                .findElement(locator.notebook.codeEditor.textArea)
                .sendKeys("select actor from actor");

            await DBConnection.selectCurrentEditor(/DB Notebook/, "notebook");
            await DBConnection.selectCurrentEditor(/myNewConsole/, "notebook");
            const console = await DBConnection.getOpenEditor(/myNewConsole/);
            await console!.findElement(locator.notebook.explorerHost.openEditors.close).click();
            expect(await DBConnection.getOpenEditor(/myNewConsole/)).toBeUndefined();
            expect(
                await documentSelector.findElement(locator.notebook.toolbar.editorSelector.currentValue).getText(),
            ).toContain("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Save the notebook", async () => {
        const outDir = process.env.USERPROFILE ?? process.env.HOME;
        let notebook = "";
        try {
            await commandExecutor.clean();
            await commandExecutor.execute("SELECT VERSION();");
            expect(commandExecutor.getResultMessage()).toMatch(/1 record retrieved/);
            await (await DBNotebooks.getToolbarButton(constants.saveNotebook))!.click();
            await driver.wait(async () => {
                const files = await fs.readdir(String(outDir));
                for (const file of files) {
                    if (file.includes(".mysql-notebook")) {
                        notebook = join(String(outDir), file);
                        try {
                            const file = await fs.readFile(notebook);
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
            await fs.unlink(notebook).catch(() => {
                // continue
            });
        }
    });

    it("Valid and invalid json", async () => {
        try {
            await commandExecutor.languageSwitch("\\ts ");
            await commandExecutor.execute(`print('{"a": "b"}')`);
            await driver.wait(async () => {
                return ShellSession.isJSON();
            }, explicitWait, "Result is not a valid json");

            await commandExecutor.execute(`print('{ a: b }')`);
            expect(commandExecutor.getResultMessage()).toBe("{ a: b }");
            await driver.wait(async () => {
                return !(await ShellSession.isJSON());
            }, explicitWait, "Result should not be a valid json");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Schema autocomplete context menu", async () => {
        try {
            await commandExecutor.languageSwitch("\\sql ", true);
            await commandExecutor.write("select sak", true);
            await commandExecutor.openSuggestionMenu();
            let els = await DBNotebooks.getAutoCompleteMenuItems();
            expect(els.toString()).toMatch(/sakila/);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write("ila.", true);
            await commandExecutor.openSuggestionMenu();
            els = await DBNotebooks.getAutoCompleteMenuItems();
            expect(els.toString()).toMatch(/(actor|address|category)/);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write("actor.", true);
            await commandExecutor.openSuggestionMenu();
            els = await DBNotebooks.getAutoCompleteMenuItems();
            expect(els.toString()).toMatch(/(actor_id|first_name|last_name)/);
            await textArea.sendKeys(Key.ESCAPE);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify all mysql data types", async () => {
        try {
            await commandExecutor.clean();
            await commandExecutor.execute("SELECT * from sakila.all_data_types;");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            const row = 0;
            const booleanCell = await commandExecutor.getCellValueFromResultGrid(row, "test_boolean");
            const smallIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_smallint");
            const mediumIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumint");
            const intField = await commandExecutor.getCellValueFromResultGrid(row, "test_integer");
            const bigIntField = await commandExecutor.getCellValueFromResultGrid(row, "test_bigint");
            const decimalField = await commandExecutor.getCellValueFromResultGrid(row, "test_decimal");
            const floatFIeld = await commandExecutor.getCellValueFromResultGrid(row, "test_float");
            const doubleField = await commandExecutor.getCellValueFromResultGrid(row, "test_double");
            const dateField = await commandExecutor.getCellValueFromResultGrid(row, "test_date");
            const dateTimeField = await commandExecutor.getCellValueFromResultGrid(row, "test_datetime");
            const timeStampField = await commandExecutor.getCellValueFromResultGrid(row, "test_timestamp");
            const timeField = await commandExecutor.getCellValueFromResultGrid(row, "test_time");
            const yearField = await commandExecutor.getCellValueFromResultGrid(row, "test_year");
            const charField = await commandExecutor.getCellValueFromResultGrid(row, "test_char");
            const varCharField = await commandExecutor.getCellValueFromResultGrid(row, "test_varchar");
            const tinyTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_tinytext");
            const textField = await commandExecutor.getCellValueFromResultGrid(row, "test_text");
            const mediumTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumtext");
            const longTextField = await commandExecutor.getCellValueFromResultGrid(row, "test_longtext");
            const enumField = await commandExecutor.getCellValueFromResultGrid(row, "test_enum");
            const setFIeld = await commandExecutor.getCellValueFromResultGrid(row, "test_set");
            const jsonCell = await commandExecutor.getCellFromResultGrid(row, "test_json");
            const pointCell = await commandExecutor.getCellFromResultGrid(row, "test_point");
            const lineStringCell = await commandExecutor.getCellFromResultGrid(row, "test_linestring");
            const polygonCell = await commandExecutor.getCellFromResultGrid(row, "test_polygon");
            const multiPointCell = await commandExecutor.getCellFromResultGrid(row, "test_multipoint");
            const multiLineStringCell = await commandExecutor.getCellFromResultGrid(row,
                "test_multilinestring");
            const multiPolygonCell = await commandExecutor.getCellFromResultGrid(row, "test_multipolygon");
            const geomCollectionCell = await commandExecutor.getCellFromResultGrid(row,
                "test_geometrycollection");
            const bitCell = await commandExecutor.getCellValueFromResultGrid(row, "test_bit");

            expect(booleanCell).toMatch(/(true|false)/);
            expect(smallIntField).toMatch(/(\d+)/);
            expect(mediumIntField).toMatch(/(\d+)/);
            expect(intField).toMatch(/(\d+)/);
            expect(bigIntField).toMatch(/(\d+)/);
            expect(decimalField).toMatch(/(\d+).(\d+)/);
            expect(floatFIeld).toMatch(/(\d+).(\d+)/);
            expect(doubleField).toMatch(/(\d+).(\d+)/);
            expect(dateField).toMatch(/(\d+)\/(\d+)\/(\d+)/);
            expect(dateTimeField).toMatch(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeStampField).toMatch(/(\d+)\/(\d+)\/(\d+)/);
            expect(timeField).toMatch(/(\d+):(\d+):(\d+)/);
            expect(yearField).toMatch(/(\d+)/);
            expect(charField).toMatch(/([a-z]|[A-Z])/);
            expect(varCharField).toMatch(/([a-z]|[A-Z])/);
            expect(tinyTextField).toMatch(/([a-z]|[A-Z])/);
            expect(textField).toMatch(/([a-z]|[A-Z])/);
            expect(mediumTextField).toMatch(/([a-z]|[A-Z])/);
            expect(longTextField).toMatch(/([a-z]|[A-Z])/);
            expect(enumField).toMatch(/([a-z]|[A-Z])/);
            expect(setFIeld).toMatch(/([a-z]|[A-Z])/);
            expect(await commandExecutor.getCellIconType(jsonCell)).toBe(constants.json);
            expect(await commandExecutor.getCellIconType(pointCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(lineStringCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(polygonCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(multiPointCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(multiLineStringCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(multiPolygonCell)).toBe(constants.geometry);
            expect(await commandExecutor.getCellIconType(geomCollectionCell)).toBe(constants.geometry);
            expect(bitCell).toMatch(/(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a result grid, verify query preview and commit", async () => {

        await commandExecutor.clean();
        await commandExecutor.execute("select * from sakila.all_data_types;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        const booleanEdited = false;
        const smallIntEdited = "32761";
        const mediumIntEdited = "8388601";
        const intEdited = "3";
        const bigIntEdited = "4294967291";
        const decimalEdited = "1.70";
        const floatEdited = "10.767";
        const doubleEdited = "5.72";
        const dateEdited = "2024-01-01";
        const dateTimeEdited = "2024-01-01 15:00";
        const timeStampEdited = "2024-01-01 15:00";
        const timeEdited = "23:59";
        const yearEdited = "2030";
        const charEdited = "test_char_edited";
        const varCharEdited = "test_varchar_edited";
        const tinyTextEdited = "test_tiny_edited";
        const textEdited = "test_text_edited";
        const textMediumEdited = "test_med_edited";
        const longTextEdited = "test_long_edited";
        const enumEdited = "value2";
        const setEdited = "value2";
        const jsonEdited = '{"test": "2"}';
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
            { rowNumber: rowToEdit, columnName: "test_boolean", value: booleanEdited },
            { rowNumber: rowToEdit, columnName: "test_smallint", value: smallIntEdited },
            { rowNumber: rowToEdit, columnName: "test_mediumint", value: mediumIntEdited },
            { rowNumber: rowToEdit, columnName: "test_integer", value: intEdited },
            { rowNumber: rowToEdit, columnName: "test_bigint", value: bigIntEdited },
            { rowNumber: rowToEdit, columnName: "test_decimal", value: decimalEdited },
            { rowNumber: rowToEdit, columnName: "test_float", value: floatEdited },
            { rowNumber: rowToEdit, columnName: "test_double", value: doubleEdited },
            { rowNumber: rowToEdit, columnName: "test_date", value: dateEdited },
            { rowNumber: rowToEdit, columnName: "test_datetime", value: dateTimeEdited },
            { rowNumber: rowToEdit, columnName: "test_timestamp", value: timeStampEdited },
            { rowNumber: rowToEdit, columnName: "test_time", value: timeEdited },
            { rowNumber: rowToEdit, columnName: "test_year", value: yearEdited },
            { rowNumber: rowToEdit, columnName: "test_char", value: charEdited },
            { rowNumber: rowToEdit, columnName: "test_varchar", value: varCharEdited },
            { rowNumber: rowToEdit, columnName: "test_tinytext", value: tinyTextEdited },
            { rowNumber: rowToEdit, columnName: "test_text", value: textEdited },
            { rowNumber: rowToEdit, columnName: "test_mediumtext", value: textMediumEdited },
            { rowNumber: rowToEdit, columnName: "test_longtext", value: longTextEdited },
            { rowNumber: rowToEdit, columnName: "test_enum", value: enumEdited },
            { rowNumber: rowToEdit, columnName: "test_set", value: setEdited },
            { rowNumber: rowToEdit, columnName: "test_json", value: jsonEdited },
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
        const dateTimeToISO = Misc.convertDateToISO(dateTimeEdited);
        const timeStampToISO = Misc.convertDateToISO(timeStampEdited);
        const timeTransformed = Misc.convertTimeTo12H(timeEdited);

        const booleanField = booleanEdited ? 1 : 0;
        const expectedSqlPreview = [
            /UPDATE sakila.all_data_types SET/,
            new RegExp(`test_boolean = ${booleanField}`),
            new RegExp(`test_smallint = ${smallIntEdited}`),
            new RegExp(`test_mediumint = ${mediumIntEdited}`),
            new RegExp(`test_integer = ${intEdited}`),
            new RegExp(`test_bigint = ${bigIntEdited}`),
            new RegExp(`test_decimal = ${decimalEdited}`),
            new RegExp(`test_float = ${floatEdited}`),
            new RegExp(`test_double = ${doubleEdited}`),
            new RegExp(`test_date = '${dateEdited}'`),
            new RegExp(`test_datetime = '(${dateTimeEdited}:00|${dateTimeToISO}:00)'`),
            new RegExp(`test_timestamp = '(${timeStampEdited}:00|${timeStampToISO}:00)'`),
            new RegExp(`test_time = '(${timeEdited}|${timeTransformed})'`),
            new RegExp(`test_year = ${yearEdited}`),
            new RegExp(`test_char = '${charEdited}'`),
            new RegExp(`test_varchar = '${varCharEdited}'`),
            new RegExp(`test_tinytext = '${tinyTextEdited}'`),
            new RegExp(`test_text = '${textEdited}'`),
            new RegExp(`test_mediumtext = '${textMediumEdited}'`),
            new RegExp(`test_longtext = '${longTextEdited}'`),
            new RegExp(`test_enum = '${enumEdited}'`),
            new RegExp(`test_set = '${setEdited}'`),
            Misc.transformToMatch(`test_json = '${jsonEdited}'`),
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
        const sqlPreviewScroll = await driver
            .findElements(locator.notebook.codeEditor.editor.result.previewChanges.exists);
        for (let i = 0; i <= expectedSqlPreview.length - 1; i++) {
            if (i === 26 && sqlPreviewScroll.length > 0) {
                await driver.executeScript("arguments[0].scrollBy(0,500)", sqlPreviewScroll[0]);
            }
            expect(sqlPreview).toMatch(expectedSqlPreview[i]);
        }

        const sqlPreviewEl = await commandExecutor.getSqlPreview(true);
        await (sqlPreviewEl as WebElement).click();
        await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
        const resultGrid = commandExecutor.getResultContent() as WebElement;
        const rows = await resultGrid.findElements(locator.notebook.codeEditor.editor.result.tableRow);
        expect(await rows[rowToEdit].getAttribute("class")).toContain("tabulator-selected");
        await commandExecutor.resultGridApplyChanges();
        await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
        await driver.wait(waitUntil.rowsWereUpdated(commandExecutor), constants.wait5seconds);
        await driver.wait(waitUntil.changedResultGridCellsAreDone(commandExecutor), constants.wait5seconds);

        await commandExecutor.execute("select * from sakila.all_data_types where id = 1;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);

        const testBoolean = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_boolean");
        expect(testBoolean).toBe(booleanEdited.toString());
        const testSmallInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_smallint");
        expect(testSmallInt).toBe(smallIntEdited);
        const testMediumInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_mediumint");
        expect(testMediumInt).toBe(mediumIntEdited);
        const testInteger = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_integer");
        expect(testInteger).toBe(intEdited);
        const testBigInt = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_bigint");
        expect(testBigInt).toBe(bigIntEdited);
        const testDecimal = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_decimal");
        expect(testDecimal).toBe(decimalEdited);
        const testFloat = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_float");
        expect(testFloat).toBe(floatEdited);
        const testDouble = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_double");
        expect(testDouble).toBe(doubleEdited);
        const testDate = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_date");
        expect(testDate).toBe("01/01/2024");
        const testDateTime = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_datetime");
        expect(testDateTime).toBe("01/01/2024");
        const testTimeStamp = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_timestamp");
        expect(testTimeStamp).toBe("01/01/2024");
        const testTime = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_time");
        const convertedTime = Misc.convertTimeTo12H(timeEdited);
        expect(testTime === `${timeEdited}:00` || testTime === convertedTime).toBe(true);
        const testYear = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_year");
        expect(testYear).toBe(yearEdited);
        const testChar = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_char");
        expect(testChar).toBe(charEdited);
        const testVarChar = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_varchar");
        expect(testVarChar).toBe(varCharEdited);
        const testTinyText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_tinytext");
        expect(testTinyText).toBe(tinyTextEdited);
        const testText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_text");
        expect(testText).toBe(textEdited);
        const testMediumText = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_mediumtext");
        expect(testMediumText).toBe(textMediumEdited);
        const testLongText = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_longtext");
        expect(testLongText).toBe(longTextEdited);
        const testEnum = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_enum");
        expect(testEnum).toBe(enumEdited);
        const testSet = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_set");
        expect(testSet).toBe(setEdited);
        const testJson = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_json");
        expect(testJson).toBe(constants.json);
        const testPoint = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_point");
        expect(testPoint).toBe(constants.geometry);
        const testLineString = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_linestring");
        expect(testLineString).toBe(constants.geometry);
        const testPolygon = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_polygon");
        expect(testPolygon).toBe(constants.geometry);
        const testMultiPoint = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_multipoint");
        expect(testMultiPoint).toBe(constants.geometry);
        const testMultiLineString = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_multilinestring");
        expect(testMultiLineString).toBe(constants.geometry);
        const testMultiPolygon = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_multipolygon");
        expect(testMultiPolygon).toBe(constants.geometry);
        const testGeomCollection = await commandExecutor.getCellValueFromResultGrid(rowToEdit,
            "test_geometrycollection");
        expect(testGeomCollection).toBe(constants.geometry);
        const testBit = await commandExecutor.getCellValueFromResultGrid(rowToEdit, "test_bit");
        expect(testBit).toBe("1");

    });

    it("Edit a result grid and rollback", async () => {
        try {
            const modifiedText = "56";
            await commandExecutor.execute("select * from sakila.all_data_types;");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            await commandExecutor.editResultGridCells(
                [{
                    rowNumber: 0,
                    columnName: "test_bigint",
                    value: modifiedText,
                }]);
            await commandExecutor.resultGridRollbackChanges();
            const confirmDialog = await driver.wait(waitUntil.confirmationDialogExists("for rollback"));
            await confirmDialog!.findElement(locator.confirmDialog.accept).click();
            expect((await (commandExecutor.getResultContent() as WebElement)
                .getAttribute("innerHTML")).match(/rollbackTest/) === null).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify not editable result grids", async () => {
        try {
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

            for (const query of queries) {
                await commandExecutor.execute(query);
                expect(commandExecutor.getResultMessage()).toMatch(/OK/);
                const editBtn = await commandExecutor.getResultToolbar()
                    .findElement(locator.notebook.codeEditor.editor.result.status.toolbar.editButton);
                expect(await editBtn.getAttribute("data-tooltip")).toBe("Data not editable");
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add new row from result grid", async () => {
        try {
            await commandExecutor.execute("select * from sakila.all_data_types;");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            const booleanEdited = true;
            const smallIntEdited = "32761";
            const mediumIntEdited = "8388601";
            const intEdited = "3";
            const bigIntEdited = "4294967291";
            const decimalEdited = "1.70";
            const floatEdited = "10.767";
            const doubleEdited = "5.72";
            const dateEdited = "2024-01-01";
            const dateTimeEdited = "2024-01-01T23:59";
            const timeStampEdited = "2024-01-01T23:59";
            const timeEdited = "23:59";
            const yearEdited = "2024";
            const charEdited = "test_char_edited";
            const varCharEdited = "test_varchar_edited";
            const tinyTextEdited = "test_tiny_edited";
            const textEdited = "test_text_edited";
            const textMediumEdited = "test_med_edited";
            const longTextEdited = "test_long_edited";
            const enumEdited = "value4";
            const setEdited = "value4";
            const jsonEdited = '{"test": "2"}';
            const pointEdited = "ST_GeomFromText('POINT(1 2)')";
            const lineStringEdited = "ST_LineStringFromText('LINESTRING(0 0,1 1,2 1)')";
            const polygonEdited = "ST_GeomFromText('POLYGON((0 0,11 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')";
            const multiPointEdited = "ST_GeomFromText('MULTIPOINT(0 1, 20 20, 60 60)')";
            const multiLineStrEdited = "ST_GeomFromText('MultiLineString((2 1,2 2,3 3),(4 4,5 5))')";
            const multiPolyEd = "ST_GeomFromText('MULTIPOLYGON(((0 0,11 0,12 11,0 9,0 0)),((3 5,7 4,4 7,7 7,3 5)))')";
            const geoCollEdited = "ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2),LINESTRING(0 0,1 1,2 2,3 3,4 4))')";
            const bitEdited = "0";

            const rowToAdd: interfaces.IResultGridCell[] = [
                { columnName: "test_boolean", value: booleanEdited },
                { columnName: "test_smallint", value: smallIntEdited },
                { columnName: "test_mediumint", value: mediumIntEdited },
                { columnName: "test_integer", value: intEdited },
                { columnName: "test_bigint", value: bigIntEdited },
                { columnName: "test_decimal", value: decimalEdited },
                { columnName: "test_float", value: floatEdited },
                { columnName: "test_double", value: doubleEdited },
                { columnName: "test_date", value: dateEdited },
                { columnName: "test_datetime", value: dateTimeEdited },
                { columnName: "test_timestamp", value: timeStampEdited },
                { columnName: "test_time", value: timeEdited },
                { columnName: "test_year", value: yearEdited },
                { columnName: "test_char", value: charEdited },
                { columnName: "test_varchar", value: varCharEdited },
                { columnName: "test_tinytext", value: tinyTextEdited },
                { columnName: "test_text", value: textEdited },
                { columnName: "test_mediumtext", value: textMediumEdited },
                { columnName: "test_longtext", value: longTextEdited },
                { columnName: "test_enum", value: enumEdited },
                { columnName: "test_set", value: setEdited },
                { columnName: "test_json", value: jsonEdited },
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
                .execute(
                    "select * from sakila.all_data_types where id = (select max(id) from sakila.all_data_types);");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            const row = 0;
            const testBoolean = await commandExecutor.getCellValueFromResultGrid(row, "test_boolean");
            expect(testBoolean).toBe(booleanEdited.toString());
            const testSmallInt = await commandExecutor.getCellValueFromResultGrid(row, "test_smallint");
            expect(testSmallInt).toBe(smallIntEdited);
            const testMediumInt = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumint");
            expect(testMediumInt).toBe(mediumIntEdited);
            const testInteger = await commandExecutor.getCellValueFromResultGrid(row, "test_integer");
            expect(testInteger).toBe(intEdited);
            const testBigInt = await commandExecutor.getCellValueFromResultGrid(row, "test_bigint");
            expect(testBigInt).toBe(bigIntEdited);
            const testDecimal = await commandExecutor.getCellValueFromResultGrid(row, "test_decimal");
            expect(testDecimal).toBe(decimalEdited);
            const testFloat = await commandExecutor.getCellValueFromResultGrid(row, "test_float");
            expect(testFloat).toBe(floatEdited);
            const testDouble = await commandExecutor.getCellValueFromResultGrid(row, "test_double");
            expect(testDouble).toBe(doubleEdited);
            const testDate = await commandExecutor.getCellValueFromResultGrid(row, "test_date");
            expect(testDate).toBe("01/01/2024");
            const testDateTime = await commandExecutor.getCellValueFromResultGrid(row, "test_datetime");
            expect(testDateTime).toBe("01/01/2024");
            const testTimeStamp = await commandExecutor.getCellValueFromResultGrid(row, "test_timestamp");
            expect(testTimeStamp).toBe("01/01/2024");
            const testTime = await commandExecutor.getCellValueFromResultGrid(row, "test_time");
            const convertedTime = Misc.convertTimeTo12H(timeEdited);
            expect(testTime === `${timeEdited}:00` || testTime === convertedTime).toBe(true);
            const testYear = await commandExecutor.getCellValueFromResultGrid(row, "test_year");
            expect(testYear).toBe(yearEdited);
            const testChar = await commandExecutor.getCellValueFromResultGrid(row, "test_char");
            expect(testChar).toBe(charEdited);
            const testVarChar = await commandExecutor.getCellValueFromResultGrid(row, "test_varchar");
            expect(testVarChar).toBe(varCharEdited);
            const testTinyText = await commandExecutor.getCellValueFromResultGrid(row, "test_tinytext");
            expect(testTinyText).toBe(tinyTextEdited);
            const testText = await commandExecutor.getCellValueFromResultGrid(row, "test_text");
            expect(testText).toBe(textEdited);
            const testMediumText = await commandExecutor.getCellValueFromResultGrid(row, "test_mediumtext");
            expect(testMediumText).toBe(textMediumEdited);
            const testLongText = await commandExecutor.getCellValueFromResultGrid(row, "test_longtext");
            expect(testLongText).toBe(longTextEdited);
            const testEnum = await commandExecutor.getCellValueFromResultGrid(row, "test_enum");
            expect(testEnum).toBe(enumEdited);
            const testSet = await commandExecutor.getCellValueFromResultGrid(row, "test_set");
            expect(testSet).toBe(setEdited);
            const testJson = await commandExecutor.getCellValueFromResultGrid(row, "test_json");
            expect(testJson).toBe(constants.json);
            const testPoint = await commandExecutor.getCellValueFromResultGrid(row, "test_point");
            expect(testPoint).toBe(constants.geometry);
            const testLineString = await commandExecutor.getCellValueFromResultGrid(row, "test_linestring");
            expect(testLineString).toBe(constants.geometry);
            const testPolygon = await commandExecutor.getCellValueFromResultGrid(row, "test_polygon");
            expect(testPolygon).toBe(constants.geometry);
            const testMultiPoint = await commandExecutor.getCellValueFromResultGrid(row, "test_multipoint");
            expect(testMultiPoint).toBe(constants.geometry);
            const testMultiLineString = await commandExecutor.getCellValueFromResultGrid(row,
                "test_multilinestring");
            expect(testMultiLineString).toBe(constants.geometry);
            const testMultiPolygon = await commandExecutor.getCellValueFromResultGrid(row, "test_multipolygon");
            expect(testMultiPolygon).toBe(constants.geometry);
            const testGeomCollection = await commandExecutor.getCellValueFromResultGrid(row,
                "test_geometrycollection");
            expect(testGeomCollection).toBe(constants.geometry);
            const testBit = await commandExecutor.getCellValueFromResultGrid(row, "test_bit");
            expect(testBit).toBe("0");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Close a result set", async () => {
        try {
            await commandExecutor.execute("select * from sakila.result_sets;");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            const id = commandExecutor.getResultId();
            await commandExecutor.closeResultSet();

            await driver.wait(async () => {
                return (await driver.findElements(locator.notebook.codeEditor.editor.result.existsById(id!)))
                    .length === 0;
            }, constants.wait5seconds, `The result set was not closed`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Unsaved changes dialog on result grid", async () => {
        try {
            const script = await DBConnection.addScript("TS");
            await commandExecutor.executeScript("Math.random()", false);
            await DBConnection.selectCurrentEditor(/DB Notebook/, "notebook");

            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.result_sets");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const cellsToEdit: interfaces.IResultGridCell[] = [{
                rowNumber: 0,
                columnName: "text_field",
                value: "ping",
            }];
            await commandExecutor.editResultGridCells(cellsToEdit);

            await DBConnection.clickAdminItem("Server Status");
            let dialog = await driver.wait(waitUntil.confirmationDialogExists(
                " after switching to Server Status page")
                , constants.wait5seconds);
            expect(await (await dialog!.findElement(locator.confirmDialog.message))
                .getText())
                .toMatch(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            expect(await DBConnection.getOpenEditor(/DB Notebook/));

            await DBConnection.clickAdminItem("Client Connections");
            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to Client Connections page"),
                constants.wait5seconds);
            expect(await (await dialog!.findElement(locator.confirmDialog.message))
                .getText())
                .toMatch(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            expect(await DBConnection.getOpenEditor(/DB Notebook/));

            await DBConnection.clickAdminItem("Performance Dashboard");
            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to Performance Dashboard page"),
                constants.wait5seconds);
            expect(await (await dialog!.findElement(locator.confirmDialog.message))
                .getText())
                .toMatch(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            expect(await DBConnection.getOpenEditor(/DB Notebook/));

            const connectionBrowser = await driver.wait(until.elementLocated(locator.dbConnections.tab),
                explicitWait, "DB Connection Overview tab was not found");
            await connectionBrowser.click();

            dialog = await driver.wait(waitUntil
                .confirmationDialogExists(" after switching to DB Connections Overview page"),
                constants.wait5seconds);
            expect(await (await dialog!.findElement(locator.confirmDialog.message))
                .getText())
                .toMatch(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.cancel).click();
            await DBConnection.selectCurrentEditor(script, "scriptTs");
            dialog = await driver.wait(waitUntil.confirmationDialogExists(" after switching to a script page"),
                constants.wait5seconds);
            expect(await (await dialog!.findElement(locator.confirmDialog.message))
                .getText())
                .toMatch(/is currently being edited, do you want to commit or rollback the changes before continuing/);
            await dialog!.findElement(locator.confirmDialog.refuse).click();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Result grid context menu - Capitalize, Convert to lower, upper case and mark for deletion", async () => {
        try {
            await DBConnection.selectCurrentEditor(/DB Notebook/, "notebook");
            await commandExecutor.clean();
            await commandExecutor.execute("select * from sakila.result_sets");
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const rowNumber = 0;
            let cell = await commandExecutor.getCellFromResultGrid(0, "text_field");
            let cellValue = await cell.getText();
            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.capitalizeText);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await driver.wait(waitUntil.cellsWereChanged(commandExecutor.getResultContent() as WebElement,
                1), constants.wait5seconds);
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText()).toBe(`${cellValue.charAt(0)
                .toUpperCase()}${cellValue.slice(1)}`);
            cellValue = await cell.getText();

            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.convertTextToLowerCase);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText()).toBe(cellValue.toLowerCase());

            cellValue = await cell.getText();
            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.convertTextToUpperCase);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            cell = await commandExecutor.getCellFromResultGrid(rowNumber, "text_field");
            expect(await cell.getText()).toBe(cellValue.toUpperCase());

            await commandExecutor.openCellContextMenuAndSelect(0, "text_field",
                constants.resultGridContextMenu.toggleForDeletion);
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            const row = await commandExecutor.getRowFromResultGrid(commandExecutor.getResultContent() as WebElement, 0);
            await driver.wait(waitUntil.rowIsMarkedForDeletion(row),
                constants.wait5seconds);
            await commandExecutor.resultGridApplyChanges();

            await driver.wait(async () => {
                const resultHtml = await commandExecutor.getResult(undefined, commandExecutor.getResultId());

                return (await resultHtml!.getAttribute("outerHTML")).match(/(\d+).*updated/) !== null;
            }, constants.wait5seconds, "The row was not updated, after deletion");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

});

describe("Notebook headless off", () => {

    let testFailed = false;
    const anotherConnection: IDBConnection = {
        dbType: undefined,
        caption: `no headless`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser2",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser2",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    const commandExecutor = new CommandExecutor();

    beforeAll(async () => {
        try {
            await loadDriver(false);
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.executeScript("arguments[0].click()", await driver.findElement(locator.sqlEditorPage.icon));
            const db = await DBNotebooks.createDBconnection(anotherConnection);
            await driver.executeScript("arguments[0].click();", db);
            try {
                await Misc.setPassword(anotherConnection);
                await Misc.setConfirmDialog(anotherConnection, "no");
            } catch (e) {
                // continue
            }
            await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
                explicitWait * 2, "Notebook was not loaded");
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
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Copy to clipboard button", async () => {
        try {
            await commandExecutor.refreshCommandResult(commandExecutor.getResultId());
            await commandExecutor.copyResultToClipboard();
            expect(await driver.executeScript("return await navigator.clipboard.readText()")).toContain("Welcome");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Result grid context menu - Copy single row", async () => {
        const tableColumns = constants.dbTables[0].columns;
        await commandExecutor.execute("select * from sakila.all_data_types;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);

        let fields: string[] = [];
        let lines: string[] = [];
        const row = 0;
        const column = "test_boolean";

        // copy row
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRow);
            fields = (await Misc.readClipboard()).split(",");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row) The copied row fields do not match the table columns");

        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegexWithQuotes![i]);
        }

        // copy row with names
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNames);
            lines = (await Misc.readClipboard()).split("\n");
            fields = lines[1].split(",");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row with names) The copied row fields do not match the table columns");

        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegexWithQuotes![i]);
        }
        expect((await Misc.readClipboard()).includes(`# ${tableColumns.join(", ")}`)).toBe(true);

        // copy row unquoted
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowUnquoted);
            fields = (await Misc.readClipboard()).split(",");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row unquoted) The copied row fields do not match the table columns");

        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegex![i]);
        }

        // copy row with names, unquoted
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesUnquoted);
            lines = (await Misc.readClipboard()).split("\n");
            fields = lines[1].split(",");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row with names, unquoted) The copied row fields do not match the table columns");

        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegex![i]);
        }
        expect((await Misc.readClipboard()).includes(`# ${tableColumns.join(", ")}`)).toBe(true);

        // copy row with names, tab separated
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowWithNamesTabSeparated);
            lines = (await Misc.readClipboard()).split("\n");
            fields = lines[1].split("\t");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row with names, tab separated) The copied row fields do not match the table columns");


        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegexWithQuotes![i]);
        }
        expect((await Misc.readClipboard()).includes(`# ${tableColumns.join("\t")}`)).toBe(true);

        // copy row, tab separated
        await driver.wait(async () => {
            await commandExecutor.openCellContextMenuAndSelect(row, column,
                constants.resultGridContextMenu.copySingleRow,
                constants.resultGridContextMenu.copySingleRowContextMenu.copyRowTabSeparated);
            fields = (await Misc.readClipboard()).split("\t");

            return fields.length === tableColumns.length;
        }, constants.wait5seconds,
            "(copy row, tab separated) The copied row fields do not match the table columns");

        for (let i = 0; i <= fields.length - 1; i++) {
            expect(fields[i]).toMatch(constants.dbTables[0].columnRegexWithQuotes![i]);
        }
    });
});
