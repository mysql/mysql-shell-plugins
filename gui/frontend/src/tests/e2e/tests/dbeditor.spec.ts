/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { promises as fsPromises } from "fs";
import { loadDriver, loadPage, driver } from "../lib/engine";
import { By, until, Key, WebElement } from "selenium-webdriver";
import {
    IDBConnection,
    waitForHomePage,
    selectDatabaseType,
    selectProtocol,
    getDB,
    createDBconnection,
    getSelectedConnectionTab,
    getToolbarButton,
    getResultStatus,
    findInSelection,
    expandFinderReplace,
    replacerGetButton,
    closeFinder,
    getSchemaObject,
    toggleSchemaObject,
    addScript,
    getOpenEditor,
    selectCurrentEditor,
    getResultTab,
    getResultColumnName,
    getOutput,
    enterCmd,
    pressEnter,
    setEditorLanguage,
    setDBEditorPassword,
    getGraphHost,
    clickDBEditorContextItem,
    closeDBconnection,
    setConfirmDialog,
    initConDialog,
    existsScript,
    writeSQL,
    expandCollapseDBEditorMenus,
    hasNewPrompt,
    getLastQueryResultId,
    getPromptTextLine,
    cleanEditor,
    getScriptResult,
    isConnectionOverviewOpened,
    clickAdminItem,
    getCurrentEditor,
    selectEditor,
    explicitWait,
    openNewNotebook,
} from "../lib/helpers";

describe("DB Editor", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `conn${new Date().valueOf()}`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();
        await initConDialog();
        await createDBconnection(globalConn, true);
    });

    afterAll(async () => {
        await driver.quit();
    });

    describe("Managing Connections", () => {

        testFailed = false;

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                const img = await driver.takeScreenshot();
                const testName: string = expect.getState().currentTestName
                    .toLowerCase().replace(/\s/g, "_");
                try {
                    await fsPromises.access("src/tests/e2e/screenshots");
                } catch (e) {
                    await fsPromises.mkdir("src/tests/e2e/screenshots");
                }
                await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
            }

            if (!await isConnectionOverviewOpened()) {
                await closeDBconnection("current");
            }
        });

        it("Store and clear Password", async () => {

            try {

                const host = await getDB(globalConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                const contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("edit")),
                );

                const conDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                    explicitWait, "Dialog was not displayed");
                await conDialog.findElement(By.id("clearPassword")).click();
                await conDialog.findElement(By.id("ok")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(globalConn.caption),
                );

                expect(await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                    explicitWait, "Password dialog was not displayed")).toBeDefined();
                await driver.findElement(By.id("cancel")).click();
                const error = await driver.wait(until.elementLocated(By.css(".errorPanel button")),
                    explicitWait, "Error panel was not displayed");

                await error.click();
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Confirm dialog - Save password", async () => {
            try {

                const localConn: IDBConnection = {
                    dbType: undefined,
                    caption:  `conn${new Date().valueOf()}`,
                    description: "Local connection",
                    hostname: String(process.env.DBHOSTNAME),
                    protocol: "mysql",
                    username: String(process.env.DBUSERNAME1),
                    port: String(process.env.DBPORT),
                    portX: String(process.env.DBPORTX),
                    schema: "sakila",
                    password: String(process.env.DBUSERNAME1),
                    sslMode: undefined,
                    sslCA: undefined,
                    sslClientCert: undefined,
                    sslClientKey: undefined,
                };

                await createDBconnection(localConn, false, true);

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(localConn.caption),
                );

                await setDBEditorPassword(localConn);

                await setConfirmDialog(localConn, "yes");

                expect(await (await getSelectedConnectionTab()).getText())
                    .toBe(localConn.caption);

                await closeDBconnection(localConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(localConn.caption),
                );

                expect(await (await getSelectedConnectionTab()).getText())
                    .toBe(localConn.caption);

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Duplicate a database connection", async () => {
            try {

                const host = await getDB(globalConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                const contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("duplicate")),
                );

                const conDialog = await driver.findElement(By.css(".valueEditDialog"));

                await driver.wait(async () => {
                    await conDialog.findElement(By.id("caption")).clear();

                    return !(await driver.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");

                const dup = `Dup${String(Math.floor(Math.random() * 100))}`;

                await conDialog.findElement(By.id("caption")).sendKeys(dup);

                await conDialog.findElement(By.id("description")).clear();

                await conDialog
                    .findElement(By.id("description"))
                    .sendKeys("my other connection");

                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

                const conn = await getDB(dup);

                expect(conn).toBeDefined();

                expect(await conn!.findElement(By.css(".tileDescription")).getText())
                    .toBe("my other connection");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit a database connection", async () => {
            try {

                const localConn: IDBConnection = {
                    dbType: undefined,
                    caption: `conn${new Date().valueOf()}`,
                    description: "Local connection",
                    hostname: String(process.env.DBHOSTNAME),
                    protocol: "mysql",
                    username: String(process.env.DBUSERNAME),
                    port: String(process.env.DBPORT),
                    portX: String(process.env.DBPORTX),
                    schema: "sakila",
                    password: String(process.env.DBPASSWORD),
                    sslMode: undefined,
                    sslCA: undefined,
                    sslClientCert: undefined,
                    sslClientKey: undefined,
                };

                await createDBconnection(localConn);

                let host = await getDB(localConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                let contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("edit")),
                );

                let conDialog = await driver.findElement(By.css(".valueEditDialog"));

                await driver.wait(async () => {
                    await conDialog.findElement(By.id("caption")).clear();

                    return !(await driver.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");

                const conName = `Wex${String(Math.floor(Math.random() * 100))}`;

                await conDialog.findElement(By.id("caption")).sendKeys(conName);

                await conDialog.findElement(By.id("description")).clear();

                await conDialog
                    .findElement(By.id("description"))
                    .sendKeys("Another description");

                await conDialog.findElement(By.id("hostName")).clear();

                await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

                await selectProtocol("mysqlx");

                expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

                let okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

                const conn = await getDB(conName);

                expect(conn).toBeDefined();

                expect(await conn!.findElement(By.css(".tileDescription")).getText())
                    .toBe("Another description");

                host = await getDB(conName);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("edit")),
                );

                conDialog = await driver.findElement(By.css(".valueEditDialog"));

                expect(
                    await conDialog.findElement(By.css("#databaseType label")).getText(),
                ).toBe("MySQL");

                expect(
                    await conDialog.findElement(By.id("caption")).getAttribute("value"),
                ).toBe(conName);

                expect(
                    await conDialog.findElement(By.id("description")).getAttribute("value"),
                ).toBe("Another description");

                expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

                expect(
                    await conDialog.findElement(By.id("hostName")).getAttribute("value"),
                ).toBe("1.1.1.1");

                okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit a database connection and verify errors", async () => {
            try {

                const host = await getDB(globalConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                const contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("edit")),
                );

                const conDialog = await driver.findElement(By.css(".valueEditDialog"));

                const customClear = async (el: WebElement) => {
                    const textLength = (await el.getAttribute("value")).length;
                    for (let i = 0; i <= textLength - 1; i++) {
                        await el.sendKeys(Key.BACK_SPACE);
                        await driver.sleep(100);
                    }
                };

                await customClear(await conDialog.findElement(By.id("caption")));

                const okBtn = await conDialog.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                const error = await driver.wait(
                    until.elementLocated(By.css("label.error")),
                    2000,
                );

                expect(await error.getText()).toBe("The caption cannot be empty");

                expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

                await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

                await customClear(await conDialog.findElement(By.id("hostName")));

                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect(await conDialog.findElement(By.css("label.error")).getText())
                    .toBe("Specify a valid host name or IP address");

                expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

                await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

                await customClear(await conDialog.findElement(By.id("userName")));

                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await driver.findElement(By.id("ok")).click();

                expect(await conDialog.findElement(By.css("label.error")).getText())
                    .toBe("The user name must not be empty");

                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

                await driver.findElement(By.id("cancel")).click();
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Remove a database connection", async () => {
            try {

                const localConn: IDBConnection = {
                    dbType: undefined,
                    caption: `conn${new Date().valueOf()}`,
                    description: "Local connection",
                    hostname: String(process.env.DBHOSTNAME),
                    protocol: "mysql",
                    username: String(process.env.DBUSERNAME),
                    port: String(process.env.DBPORT),
                    portX: String(process.env.DBPORTX),
                    schema: "sakila",
                    password: String(process.env.DBPASSWORD),
                    sslMode: undefined,
                    sslCA: undefined,
                    sslClientCert: undefined,
                    sslClientKey: undefined,
                };

                await createDBconnection(localConn);

                const host = await getDB(localConn.caption);

                await driver.executeScript(
                    "arguments[0].click();",
                    await host!.findElement(By.id("triggerTileAction")),
                );

                const contextMenu = await driver.wait(
                    until.elementLocated(By.css(".noArrow.menu")),
                    2000,
                );

                expect(contextMenu).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await contextMenu.findElement(By.id("remove")),
                );

                const dialog = await driver.findElement(By.css(".confirmDialog"));

                expect(dialog).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    await dialog.findElement(By.id("accept")),
                );

                await driver.wait(
                    async () => {
                        return (await driver.findElements(
                            By.xpath("//label[contains(text(), '" + localConn.caption + "')]"))).length === 0;
                    },
                    2000,
                    "DB still exists",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect to SQLite database", async () => {
            try {
                const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                    explicitWait, "Connection browser was not found");
                await connBrowser.findElement(By.id("-1")).click();

                const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                    explicitWait, "Dialog was not displayed");
                await selectDatabaseType("Sqlite");
                await driver.wait(async () => {
                    await newConDialog.findElement(By.id("caption")).clear();

                    return !(await driver.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");

                const localConn: IDBConnection = {
                    dbType: undefined,
                    caption: `Sqlite DB${String(new Date().valueOf())}`,
                    description: "Local connection",
                    hostname: String(process.env.DBHOSTNAME),
                    protocol: "mysql",
                    username: String(process.env.DBUSERNAME),
                    port: String(process.env.DBPORT),
                    portX: String(process.env.DBPORTX),
                    schema: "sakila",
                    password: String(process.env.DBPASSWORD),
                    sslMode: undefined,
                    sslCA: undefined,
                    sslClientCert: undefined,
                    sslClientKey: undefined,
                };

                await newConDialog.findElement(By.id("caption")).sendKeys(localConn.caption);

                await newConDialog.findElement(By.id("description")).clear();
                await newConDialog
                    .findElement(By.id("description"))
                    .sendKeys("Local Sqlite connection");

                const inputs = await newConDialog.findElements(By.css("input.msg.input"));
                let dbPath: WebElement;
                for (const input of inputs) {
                    if (!(await input.getAttribute("id"))) {
                        dbPath = input;
                    }
                }

                await dbPath!.sendKeys(String(process.env.SQLITE_PATH_FILE));
                await newConDialog.findElement(By.id("dbName")).sendKeys("SQLite");
                await newConDialog.findElement(By.id("ok")).click();

                const conn = await getDB(localConn.caption);
                expect(conn).toBeDefined();
                expect(await conn!.findElement(By.css(".tileDescription")).getText()).toBe(
                    "Local Sqlite connection",
                );

                await driver.executeScript(
                    "arguments[0].click();",
                    conn,
                );

                expect(await (await getSelectedConnectionTab()).getText()).toBe(localConn.caption);

                await toggleSchemaObject("Schema", "main");

                const main = await getSchemaObject("Schema", "main");
                const attr = await main!.getAttribute("class");
                expect(attr.split(" ").includes("expanded")).toBe(true);

                await toggleSchemaObject("Tables", "Tables");

                const tables = await getSchemaObject("Tables", "Tables");

                expect(
                    await (
                        await tables!.findElement(By.css("span.treeToggle"))
                    ).getAttribute("class"),
                ).toContain("expanded");

                const table = await getSchemaObject("obj", "db_connection");

                await driver.wait(async () => {
                    await driver
                        .actions()
                        .contextClick(table)
                        .perform();

                    return (await driver.findElements(By.css(".noArrow.menu"))).length > 0;
                }, 4000, "Context menu was not opened");

                await driver.findElement(By.id("selectRowsMenuItem")).click();

                expect(await getResultStatus(true)).toContain("OK");

                const resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                const resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("id");
                expect(await resultHeaderRows[1].getText()).toBe("db_type");
                expect(await resultHeaderRows[2].getText()).toBe("caption");
                expect(await resultHeaderRows[3].getText()).toBe("description");
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Connect to MySQL database using SSL", async () => {
            try {
                const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                    explicitWait, "Connection browser was not found");

                await connBrowser.findElement(By.id("-1")).click();

                const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                    explicitWait, "Dialog was not displayed");
                await driver.wait(async () => {
                    await newConDialog.findElement(By.id("caption")).clear();

                    return !(await driver.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");

                const conName = `SSL Connection${String(Math.floor(Math.random() * 100))}`;
                await newConDialog.findElement(By.id("caption")).sendKeys(conName);

                await newConDialog.findElement(By.id("description")).clear();

                await newConDialog
                    .findElement(By.id("description"))
                    .sendKeys("New SSL Connection");

                await newConDialog.findElement(By.id("hostName")).clear();

                await newConDialog
                    .findElement(By.id("hostName"))
                    .sendKeys(String(globalConn.hostname));

                await newConDialog
                    .findElement(By.id("userName"))
                    .sendKeys(String(globalConn.username));

                await newConDialog
                    .findElement(By.id("defaultSchema"))
                    .sendKeys(String(globalConn.schema));

                await newConDialog.findElement(By.id("page1")).click();
                await newConDialog.findElement(By.id("sslMode")).click();
                const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
                await dropDownList.findElement(By.id("Require and Verify CA")).click();
                expect(await newConDialog.findElement(By.css("#sslMode label"))
                    .getText()).toBe("Require and Verify CA");

                const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
                await paths[0].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`);
                await paths[1].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`);
                await paths[2].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`);

                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                const conn = await getDB(conName);
                expect(conn).toBeDefined();

                await driver.executeScript(
                    "arguments[0].click();",
                    conn,
                );

                try {
                    await setDBEditorPassword(globalConn);
                    await setConfirmDialog(globalConn, "yes");
                } catch (e) {
                    //continue
                }

                expect(await (await getSelectedConnectionTab()).getText()).toBe(conName);

                await setEditorLanguage("mysql");

                const contentHost = await driver.findElement(By.id("contentHost"));
                await contentHost
                    .findElement(By.css("textarea"))
                    .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

                const execSel = await getToolbarButton("Execute selection or full block and create a new block");
                await execSel?.click();

                const resultHost = await driver.wait(until.elementLocated(By.css(".resultHost")),
                    explicitWait, "Result host was not found");

                const result = await driver.wait(until.elementLocated(async () => {
                    return resultHost.findElements(By.css(".resultStatus label"));
                }), explicitWait, "Label not found");

                expect(await result.getText()).toContain("1 record retrieved");

                expect( await resultHost.findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]")) )
                    .toBeDefined();

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Core Tests", () => {

        testFailed = false;

        beforeAll(async () => {

            try {
                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(globalConn.caption),
                );
                await setDBEditorPassword(globalConn);
                await setConfirmDialog(globalConn, "yes");
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("dialog was found") === -1) {
                        throw e;
                    }
                }
            }
            expect(await (await getSelectedConnectionTab()).getText()).toBe(globalConn.caption);
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                const img = await driver.takeScreenshot();
                const testName: string = expect.getState().currentTestName
                    .toLowerCase().replace(/\s/g, "_");
                try {
                    await fsPromises.access("src/tests/e2e/screenshots");
                } catch (e) {
                    await fsPromises.mkdir("src/tests/e2e/screenshots");
                }
                await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
            }
            await openNewNotebook();
        });

        afterAll(async () => {
            await closeDBconnection("current");
        });

        it("Multi-cursor", async () => {
            try {

                await setEditorLanguage("sql");
                await writeSQL("select * from sakila.actor;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await writeSQL("select * from sakila.address;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await writeSQL("select * from sakila.city;");

                await driver.actions().keyDown(Key.ALT).perform();

                let lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                lines.shift();
                let spans = await lines[0].findElements(By.css("span"));
                await spans[spans.length - 1].click();

                spans = await lines[1].findElements(By.css("span"));
                await spans[spans.length - 1].click();
                await driver.actions().keyUp(Key.ALT).perform();

                const ctx = await driver.findElement(By.css(".lines-content"));
                expect((await ctx.findElements(By.css(".current-line"))).length).toBe(3);

                const textArea = await driver.findElement(By.css("textarea"));
                await textArea.sendKeys("testing");

                const context = await driver.findElement(By.css(".monaco-editor-background"));
                lines = await context.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                try {
                    // is stale ?
                    await lines[lines.length-1].click();
                } catch (e) {
                    // continue
                }

                expect(await getPromptTextLine("last-2")).toContain("testing");
                expect(await getPromptTextLine("last-1")).toContain("testing");
                expect(await getPromptTextLine("last")).toContain("testing");

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Context Menu - Execute", async () => {
            try {

                const textArea = await driver.findElement(By.css("textarea"));

                await enterCmd(textArea, "select version();", 20000);

                await writeSQL("select * from actor limit 1", true);

                let lastId = await getLastQueryResultId();

                await clickDBEditorContextItem("Execute Block");

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus(true)).toMatch(
                    new RegExp(/OK, (\d+) record retrieved/),
                );

                expect(await hasNewPrompt()).toBe(false);

                lastId = await getLastQueryResultId();

                await clickDBEditorContextItem("Execute Block and Advance");

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus(true)).toMatch(
                    new RegExp(/OK, (\d+) record retrieved/),
                );

                expect(await hasNewPrompt()).toBe(true);

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Switch between search tabs", async () => {
            try {

                await writeSQL("select * from actor limit 1; select * from address limit 1;", true);

                const lastId = await getLastQueryResultId();

                await (
                    await getToolbarButton(
                        "Execute selection or full block and create a new block",
                    )
                )!.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                const result1 = await driver.wait(async () => {
                    return getResultTab("Result #1");
                }, 5000, "No results were found");

                const result2 = await getResultTab("Result #2");

                expect(result1).toBeDefined();

                expect(result2).toBeDefined();

                expect(await getResultColumnName("actor_id")).toBeDefined();

                await result2!.click();

                expect(await getResultColumnName("address_id")).toBeDefined();

                await result1!.click();

                expect(await getResultColumnName("actor_id")).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Verify default schema", async () => {
            try {
                const defaultSchema = await driver.findElement(
                    By.css("#schemaSectionHost div.marked"),
                );

                expect(await defaultSchema.findElement(By.css("label")).getText()).toBe(String(globalConn.schema));
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
            try {

                await writeSQL("select * from actor limit 1", true);

                const lastId = await getLastQueryResultId();

                const exeSelNew = await getToolbarButton(
                    "Execute selection or full block and create a new block");
                await exeSelNew?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 7000, "No new results block was displayed");

                expect(await getResultColumnName("actor_id")).toBeDefined();

                expect(await getResultColumnName("first_name")).toBeDefined();

                expect(await getResultColumnName("last_name")).toBeDefined();

                expect(await getResultColumnName("last_update")).toBeDefined();

                expect(await hasNewPrompt()).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {

                const textArea = await driver.findElement(By.css("textarea"));

                await writeSQL("select * from actor limit 1;");

                await textArea.sendKeys(Key.RETURN);

                await writeSQL("select * from address limit 1;");

                await textArea.sendKeys(Key.RETURN);

                await writeSQL("select * from category limit 1;");

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length >= 3;
                }, 3000, "Statement start (blue dot) was not found on all lines");

                const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));

                let span2Click = await lines[lines.length-2].findElement(By.css("span > span"));

                await span2Click.click();

                let lastId = await getLastQueryResultId();

                let execCaret = await getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultColumnName("address_id")).toBeDefined();

                span2Click = await lines[lines.length-3].findElement(By.css("span > span"));

                await span2Click.click();

                lastId = await getLastQueryResultId();

                execCaret = await getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultColumnName("actor_id")).toBeDefined();

                span2Click = await lines[lines.length-1].findElement(By.css("span > span"));

                await span2Click.click();

                lastId = await getLastQueryResultId();

                execCaret = await getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultColumnName("category_id")).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            try {

                const autoCommit = await getToolbarButton("Auto commit DB changes");
                await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommit);
                await autoCommit!.click();

                const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

                await writeSQL(
                    `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

                const commitBtn = await getToolbarButton("Commit DB changes");

                const rollBackBtn = await getToolbarButton("Rollback DB changes");

                await driver.wait(until.elementIsEnabled(commitBtn!),
                    3000, "Commit button should be enabled");

                await driver.wait(until.elementIsEnabled(rollBackBtn!),
                    3000, "Commit button should be enabled");

                let lastId = await getLastQueryResultId();

                let execSelNew = await getToolbarButton(
                    "Execute selection or full block and create a new block");
                await execSelNew?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus()).toContain("OK");

                await rollBackBtn!.click();

                await cleanEditor();

                await writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

                lastId = await getLastQueryResultId();

                execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
                await execSelNew?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus()).toContain(
                    "OK, 0 records retrieved",
                );

                await cleanEditor();

                await writeSQL(
                    `INSERT INTO actor (first_name, last_name) VALUES ("${random}","${random}");`);

                lastId = await getLastQueryResultId();

                execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
                await execSelNew?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus()).toContain("OK");

                await commitBtn!.click();

                await cleanEditor();

                await writeSQL(`SELECT * FROM actor WHERE first_name='${random}';`);

                lastId = await getLastQueryResultId();

                execSelNew = await getToolbarButton("Execute selection or full block and create a new block");
                await execSelNew?.click();

                await driver.wait(async() => {
                    return (await getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await getResultStatus(true)).toContain(
                    "OK, 1 record retrieved",
                );

                await driver.executeScript("arguments[0].scrollIntoView()", autoCommit);
                await autoCommit!.click();

                await driver.wait(
                    async () => {
                        return (
                            (await commitBtn!.isEnabled()) === false &&
                            (await rollBackBtn!.isEnabled()) === false
                        );
                    },
                    5000,
                    "Commit/Rollback DB changes button is still enabled ",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Find and Replace", async () => {
            try {

                const contentHost = await driver.findElement(By.id("contentHost"));

                await writeSQL(`import from xpto xpto xpto`);

                const findBtn = await getToolbarButton("Find");
                await findBtn!.click();

                const finder = await driver.wait(until.elementLocated(By.css(".find-widget")),
                    explicitWait, "Finder was not found");

                expect(await finder.getAttribute("aria-hidden")).toBe("false");

                const textArea = await finder.findElement(By.css("textarea"));
                await driver.wait(until.elementIsVisible(textArea),
                    explicitWait, "Finder textarea is not visible");

                await textArea.sendKeys("xpto");

                await findInSelection(finder, false);

                expect(
                    await finder.findElement(By.css(".matchesCount")).getText(),
                ).toMatch(new RegExp(/1 of (\d+)/));

                await driver.wait(
                    until.elementsLocated(By.css(".cdr.findMatch")),
                    2000,
                    "No words found",
                );

                await expandFinderReplace(finder, true);

                const replacer = await finder.findElement(By.css(".replace-part"));

                await replacer.findElement(By.css("textarea")).sendKeys("tester");

                await (await replacerGetButton(replacer, "Replace (Enter)"))!.click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).toContain("import from tester xpto xpto");

                await replacer.findElement(By.css("textarea")).clear();

                await replacer.findElement(By.css("textarea")).sendKeys("testing");

                await (await replacerGetButton(replacer, "Replace All"))!.click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).toContain("import from tester testing testing");

                await closeFinder(finder);

                expect(await finder.getAttribute("aria-hidden")).toBe("true");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Expand Collapse schema objects", async () => {
            try {

                await expandCollapseDBEditorMenus("open editors", false, 0);

                await expandCollapseDBEditorMenus("scripts", false, 0);

                const sakila = await getSchemaObject("Schema", "sakila");

                expect(
                    await (
                        await sakila!.findElement(By.css("span.treeToggle"))
                    ).getAttribute("class"),
                ).toContain("expanded");

                await toggleSchemaObject("Tables", "Tables");

                const tables = await getSchemaObject("Tables", "Tables");

                expect(
                    await (
                        await tables!.findElement(By.css("span.treeToggle"))
                    ).getAttribute("class"),
                ).toContain("expanded");

                expect(await getSchemaObject("obj", "actor")).toBeDefined();

                expect(await getSchemaObject("obj", "address")).toBeDefined();

                expect(await getSchemaObject("obj", "category")).toBeDefined();

                expect(await getSchemaObject("obj", "city")).toBeDefined();

                expect(await getSchemaObject("obj", "country")).toBeDefined();

                await toggleSchemaObject("Tables", "Tables");

                let attr = await (
                    await getSchemaObject("Tables", "Tables")
                )!.getAttribute("class");

                expect(attr.split(" ").includes("expanded") === false).toBe(true);

                await toggleSchemaObject("Views", "Views");

                expect(
                    await (
                        await getSchemaObject("Views", "Views")
                    )!.getAttribute("class"),
                ).toContain("expanded");

                expect(await getSchemaObject("obj", "test_view")).toBeDefined();

                await toggleSchemaObject("Views", "Views");

                attr = await (
                    await getSchemaObject("Views", "Views")
                )!.getAttribute("class");

                expect(attr.split(" ").includes("expanded") === false).toBe(true);

                await toggleSchemaObject("Schema", "sakila");

                attr = await (
                    await getSchemaObject("Schema", "sakila")
                )!.getAttribute("class");

                expect(attr.split(" ").includes("expanded") === false).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Expand_Collapse menus", async () => {
            try {

                await expandCollapseDBEditorMenus("open editors", true, 0);

                expect(
                    await driver
                        .findElement(By.id("editorSectionHost"))
                        .findElement(By.css("div.container.section"))
                        .getAttribute("class"),
                ).toContain("expanded");

                await expandCollapseDBEditorMenus("open editors", false, 0);

                await driver.wait(
                    async () => {
                        return !(
                            await driver
                                .findElement(By.id("editorSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Open Editors' is still expanded",
                );

                await expandCollapseDBEditorMenus("open editors", true, 0);

                await driver.wait(
                    async () => {
                        return (
                            await driver
                                .findElement(By.id("editorSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Open Editors' is still collapsed",
                );

                expect(
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css("div.container.section"))
                        .getAttribute("class"),
                ).toContain("expanded");

                await expandCollapseDBEditorMenus("schemas", false, 0);

                await driver.wait(
                    async () => {
                        return !(
                            await driver
                                .findElement(By.id("schemaSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Schemas' is still expanded",
                );

                await expandCollapseDBEditorMenus("schemas", true, 0);

                await driver.wait(
                    async () => {
                        return (
                            await driver
                                .findElement(By.id("schemaSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Schemas' is still collapsed",
                );

                await expandCollapseDBEditorMenus("admin", false, 0);

                await driver.wait(
                    async () => {
                        return !(
                            await driver
                                .findElement(By.id("adminSectionHost"))
                                .findElement(By.css(".fixedScrollbar"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Administration' is still expanded",
                );

                await expandCollapseDBEditorMenus("admin", true, 0);

                await driver.wait(
                    async () => {
                        return (
                            await driver
                                .findElement(By.id("adminSectionHost"))
                                .findElement(By.css(".fixedScrollbar"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Administration' is still collapsed",
                );

                await expandCollapseDBEditorMenus("scripts", false, 0);

                await driver.wait(
                    async () => {
                        return !(
                            await driver
                                .findElement(By.id("scriptSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Scripts' is still expanded",
                );

                await expandCollapseDBEditorMenus("scripts", true, 0);

                await driver.wait(
                    async () => {
                        return (
                            await driver
                                .findElement(By.id("scriptSectionHost"))
                                .findElement(By.css("div.container.section"))
                                .getAttribute("class")
                        ).includes("expanded");
                    },
                    2000,
                    "'Scripts' is still collapsed",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Using Math_random on js_py blocks", async () => {
            try {

                await setEditorLanguage("javascript");

                const contentHost = await driver.findElement(By.id("contentHost"));

                const textArea = await contentHost.findElement(By.css("textarea"));

                await enterCmd(textArea, "Math.random();");

                const result2 = await getOutput();

                expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));

                await enterCmd(textArea, "\\typescript");

                expect(await getOutput()).toBe("Switched to TypeScript mode");

                await enterCmd(textArea, "Math.random();");

                const result4 = await getOutput();

                expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(300);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(300);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(300);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(300);

                await pressEnter();

                const otherResult = await getOutput(true);

                expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));

                expect(otherResult !== result2).toBe(true);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await pressEnter();

                const otherResult1 = await getOutput();

                expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));

                expect(otherResult1 !== result4).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Multi-line comments", async () => {
            try {

                const contentHost = await driver.findElement(By.id("contentHost"));

                const textArea = await contentHost.findElement(By.css("textarea"));

                await enterCmd(textArea, "SELECT VERSION();");

                const resultHosts = await driver.wait(until.elementsLocated(By.css(".resultHost")),
                    explicitWait, "Result hosts not found");

                const txt = await driver.wait(until.elementLocated(async () => {
                    return resultHosts[resultHosts.length-1].findElements(By.css(".tabulator-cell"));
                }), explicitWait, "Table cell was not found");

                const server = (await txt.getText()).match(/(\d+).(\d+).(\d+)/g)![0];

                const digits = server.split(".");

                let serverVer = digits[0];

                digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

                digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

                await enterCmd(textArea, `/*!${serverVer} select * from actor limit 1;*/`);

                expect(await getResultStatus(true)).toMatch(
                    new RegExp(/OK, (\d+) record retrieved/),
                );

                const higherServer = parseInt(serverVer, 10) + 1;

                await enterCmd(textArea, `/*!${higherServer} select * from actor limit 1;*/`);

                expect(await getResultStatus()).toContain(
                    "OK, 0 records retrieved",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Pie Graph based on DB table", async () => {
            try {

                await setEditorLanguage("ts");

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));

                const cmd = `
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
                }
                `;

                await enterCmd(textArea, cmd.trim());

                const pieChart = await getGraphHost();

                const chartColumns = await pieChart.findElements(By.css("rect"));
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

                await setEditorLanguage("sql");

                let text = `
                    DELIMITER $$
                        select 2 $$
                    select 1
                    `;

                text = text.trim();
                await writeSQL(text);

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length > 1;
                }, 5000, "No blue dots were found");

                const lines = await driver.findElements(By
                    .css("#contentHost .editorHost div.margin-view-overlays > div"));

                expect(await lines[lines.length-1].findElement(By.css(".statementStart"))).toBeDefined();
                expect(await lines[lines.length-2].findElement(By.css(".statementStart"))).toBeDefined();
                expect(await lines[lines.length-3].findElement(By.css(".statementStart"))).toBeDefined();

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));
                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ENTER);

                await driver.wait(async () => {
                    return (await driver.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
                }, 5000, "A new line was not found");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length === 0;
                    } catch (e) {
                        return false;
                    }
                }, 5000, "Line 2 has the statement start");

                await textArea.sendKeys("select 1");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length > 0;
                    } catch (e) {
                        return false;
                    }
                }, 5000, "Line 2 does not have the statement start");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add a new console", async () => {
            try {

                await driver.executeScript(
                    "arguments[0].click()",
                    await driver.findElement(By.id("addConsole")),
                );

                const input = await driver.wait(until.elementLocated(By.css("#editorSectionHost input")),
                    explicitWait, "Editor host input was not found");

                await input.sendKeys("myNewConsole");

                await input.sendKeys(Key.ENTER);

                expect(await getOpenEditor("myNewConsole")).toBeDefined();

                expect(
                    await driver.findElement(By.css("#documentSelector label")).getText(),
                ).toBe("myNewConsole");

                expect(
                    await driver
                        .findElement(By.css("#documentSelector img"))
                        .getAttribute("src"),
                ).toContain("shell");

                await driver
                    .findElement(By.id("contentHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("select actor from actor");

                await selectCurrentEditor("DB Notebook", "shell");

                await selectCurrentEditor("myNewConsole", "shell");

                const console = await getOpenEditor("myNewConsole");

                await console!.findElement(By.css("span.codicon-close")).click();

                expect(await getOpenEditor("myNewConsole")).toBeUndefined();

                expect(
                    await driver.findElement(By.css("#documentSelector label")).getText(),
                ).toContain("DB Notebook");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Scripts tests", () => {

        testFailed = false;

        beforeAll(async () => {
            try {
                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(globalConn.caption),
                );
                await setDBEditorPassword(globalConn);
                await setConfirmDialog(globalConn, "yes");
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("dialog was found") === -1) {
                        throw e;
                    }
                }
            }
            expect(await (await getSelectedConnectionTab()).getText()).toBe(globalConn.caption);
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                const img = await driver.takeScreenshot();
                const testName: string = expect.getState().currentTestName
                    .toLowerCase().replace(/\s/g, "_");
                try {
                    await fsPromises.access("src/tests/e2e/screenshots");
                } catch (e) {
                    await fsPromises.mkdir("src/tests/e2e/screenshots");
                }
                await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
            }
        });

        afterAll(async () => {
            await closeDBconnection("current");
        });

        it("Add_run JS script", async () => {
            try {

                await expandCollapseDBEditorMenus("scripts", true, 0);

                const script = await addScript("JS");

                await selectCurrentEditor(script, "javascript");

                expect(await existsScript(script, "javascript")).toBe(true);

                expect(
                    await driver
                        .findElement(By.id("documentSelector"))
                        .findElement(By.css("img"))
                        .getAttribute("src"),
                ).toContain("javascript");

                expect(
                    await driver
                        .findElement(By.id("documentSelector"))
                        .findElement(By.css("label"))
                        .getText(),
                ).toBe(script);

                expect(
                    await (await getOpenEditor(script))!.getAttribute("class"),
                ).toContain("selected");

                expect(
                    await (await getOpenEditor(script))!
                        .findElement(By.css("img"))
                        .getAttribute("src"),
                ).toContain("javascript");

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("Math.random()");

                await (
                    await getToolbarButton("Execute full script")
                )!.click();

                expect(await getScriptResult()).toMatch(/(\d+).(\d+)/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add_run TS script", async () => {
            try {

                const script = await addScript("TS");

                await selectCurrentEditor(script, "typescript");

                expect(await existsScript(script, "typescript")).toBe(true);

                expect(
                    await driver.findElement(By.css(".editorHost")).getAttribute("data-mode-id"),

                ).toBe("typescript");

                let src = await driver.findElement(By.id("documentSelector")).findElement(By.css("img"))
                    .getAttribute("src");

                expect(
                    src.indexOf("typescript") !== -1,
                ).toBe(true);

                expect(
                    await driver
                        .findElement(By.id("documentSelector"))
                        .findElement(By.css("label"))
                        .getText(),
                ).toBe(script);

                expect(
                    await (await getOpenEditor(script))!.getAttribute("class"),
                ).toContain("selected");

                src = (await (await getOpenEditor(script))!.findElement(By.css("img"))
                    .getAttribute("src"));

                expect(src.indexOf("typescript") !== -1).toBe(true);

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("Math.random()");

                await (
                    await getToolbarButton("Execute full script")
                )!.click();

                expect(await getScriptResult()).toMatch(/(\d+).(\d+)/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add_run SQL script", async () => {
            try {

                const script = await addScript("SQL");

                await selectCurrentEditor(script, "mysql");

                expect(await existsScript(script, "mysql")).toBe(true);

                expect(
                    await driver
                        .findElement(By.css(".editorHost"))
                        .getAttribute("data-mode-id"),
                ).toBe("mysql");

                expect(
                    await driver
                        .findElement(By.id("documentSelector"))
                        .findElement(By.css("img"))
                        .getAttribute("src"),
                ).toContain("mysql");

                expect(
                    await driver
                        .findElement(By.id("documentSelector"))
                        .findElement(By.css("label"))
                        .getText(),
                ).toBe(script);

                expect(
                    await (await getOpenEditor(script))!.getAttribute("class"),
                ).toContain("selected");

                expect(
                    await (await getOpenEditor(script))!
                        .findElement(By.css("img"))
                        .getAttribute("src"),
                ).toContain("mysql");

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("SELECT * FROM sakila.actor;");

                const execCaret = await getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(async () => {
                    return (await getScriptResult()) !== "";
                }, 15000, "No results from query were found");

                expect(await getScriptResult()).toMatch(/OK, (\d+) records/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Switch between scripts", async () => {
            try {
                await selectCurrentEditor("DB Notebook", "shell");

                const script1 = await addScript("JS");

                try {
                    await selectCurrentEditor(script1, "javascript");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script1, "javascript");
                    } else {
                        throw e;
                    }
                }

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("console.log('Hello JavaScript')");

                const script2 = await addScript("TS");

                try {
                    await selectCurrentEditor(script2, "typescript");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script2, "typescript");
                    } else {
                        throw e;
                    }
                }

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("console.log('Hello Typescript')");

                const script3 = await addScript("SQL");

                try {
                    await selectCurrentEditor(script3, "mysql");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script3, "mysql");
                    } else {
                        throw e;
                    }
                }

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("SELECT * FROM sakila.actor;");

                try {
                    await selectCurrentEditor(script1, "javascript");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script1, "javascript");
                    } else {
                        throw e;

                    }
                }

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("console.log('Hello JavaScript')");

                try {
                    await selectCurrentEditor(script2, "typescript");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script2, "typescript");
                    } else {
                        throw e;
                    }
                }

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("console.log('Hello Typescript')");

                try {
                    await selectCurrentEditor(script3, "mysql");
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        await selectCurrentEditor(script3, "mysql");
                    } else {
                        throw e;
                    }
                }

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("SELECT * FROM sakila.actor;");
            } catch (e) {
                testFailed = true;
                throw e;
            } finally {
                await selectCurrentEditor("DB Notebook", "shell");
            }
        });

    });

    describe("MySQL Administration", () => {

        testFailed = false;

        beforeAll(async () => {
            try {
                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(globalConn.caption),
                );
                await setDBEditorPassword(globalConn);
                await setConfirmDialog(globalConn, "yes");
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("dialog was found") === -1) {
                        throw e;
                    }
                }
            }
            expect(await (await getSelectedConnectionTab()).getText()).toBe(globalConn.caption);
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                const img = await driver.takeScreenshot();
                const testName: string = expect.getState().currentTestName
                    .toLowerCase().replace(/\s/g, "_");
                try {
                    await fsPromises.access("src/tests/e2e/screenshots");
                } catch (e) {
                    await fsPromises.mkdir("src/tests/e2e/screenshots");
                }
                await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
            }
        });

        it("Server Status", async () => {
            try {
                await clickAdminItem("Server Status");
                expect(await getCurrentEditor()).toBe("Server Status");

                const sections = await driver?.findElements(By.css(".grid .heading label"));
                const headings = [];
                for (const section of sections) {
                    headings.push(await section.getText());
                }
                expect(headings).toContain("Main Settings");
                expect(headings).toContain("Server Directories");
                expect(headings).toContain("Server Features");
                expect(headings).toContain("Server SSL");
                expect(headings).toContain("Server Authentication");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Client Connections", async ()  => {
            try {
                await clickAdminItem("Client Connections");

                expect(await getCurrentEditor()).toBe("Client Connections");

                const properties = await driver?.findElements(By.css("#connectionProps label"));
                const props = [];
                for (const item of properties) {
                    props.push(await item.getAttribute("innerHTML"));
                }

                const test = props.join(",");

                expect(test).toContain("Threads Connected");
                expect(test).toContain("Threads Running");
                expect(test).toContain("Threads Created");
                expect(test).toContain("Threads Cached");
                expect(test).toContain("Rejected (over limit)");
                expect(test).toContain("Total Connections");
                expect(test).toContain("Connection Limit");
                expect(test).toContain("Aborted Clients");
                expect(test).toContain("Aborted Connections");
                expect(test).toContain("Errors");

                await driver.wait(until.elementsLocated(By.css("#connectionList .tabulator-row")),
                    explicitWait, "Connections list items were not found");

            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Performance Dashboard", async () => {
            try {
                await clickAdminItem("Performance Dashboard");

                expect(await getCurrentEditor()).toBe("Performance Dashboard");

                const grid = await driver?.findElement(By.id("dashboardGrid"));
                const gridItems = await grid?.findElements(By.css(".gridCell.title"));
                const listItems = [];

                for (const item of gridItems) {
                    const label = await item.findElement(By.css("label"));
                    listItems.push(await label.getAttribute("innerHTML"));
                }

                expect(listItems).toContain("Network Status");
                expect(listItems).toContain("MySQL Status");
                expect(listItems).toContain("InnoDB Status");

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Switch between MySQL Administration tabs", async () => {
            try {
                await clickAdminItem("Server Status");
                await clickAdminItem("Client Connections");
                await clickAdminItem("Performance Dashboard");

                await selectEditor("Server Status");
                await driver.switchTo().defaultContent();

                await selectEditor("Client Connections");
                await driver.switchTo().defaultContent();

                await selectEditor("Performance Dashboard");
                await driver.switchTo().defaultContent();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });
    });

});
