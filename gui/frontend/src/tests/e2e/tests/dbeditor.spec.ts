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
import { getDriver, load } from "../lib/engine";
import { By, until, Key, WebDriver, WebElement } from "selenium-webdriver";
import {
    waitForHomePage,
    selectDatabaseType,
    selectProtocol,
    selectSSLMode,
    getDB,
    createDBconnection,
    setStartLanguage,
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
    toggleExplorerHost,
    setDBEditorPassword,
    getGraphHost,
    clickDBEditorContextItem,
    closeDBconnection,
    setConfirmDialog,
    IDbConfig,
    initConDialog,
    existsScript,
    writeSQL,
    expandCollapseSchemaMenus,
    hasNewPrompt,
    getLastQueryResultId,
    getPromptTextLine,
    cleanEditor,
} from "../lib/helpers";

const dbConfig: IDbConfig = {
    dbType: "MySQL",
    caption: "conn",
    description: "random connection",
    hostname: String(process.env.DBHOSTNAME),
    protocol: "mysql",
    port: String(process.env.DBPORT),
    username: String(process.env.DBUSERNAME),
    password: String(process.env.DBPASSWORD),
    schema: "sakila",
    showAdvanced: false,
    sslMode: "Disable",
    compression: "",
    timeout: "",
    attributes: "",
    portX: "",
};

const dbConfig1: IDbConfig = {
    dbType: "MySQL",
    caption: "conn",
    description: "random connection",
    hostname: String(process.env.DBHOSTNAME),
    protocol: "mysql",
    port: String(process.env.DBPORT),
    username: String(process.env.DBUSERNAME1),
    password: String(process.env.DBUSERNAME1),
    schema: "sakila",
    showAdvanced: false,
    sslMode: "Disable",
    compression: "",
    timeout: "",
    attributes: "",
    portX: "",
};

describe("DB Editor - Managing Connections", () => {
    let driver: WebDriver;
    let testFailed = false;

    beforeAll(async () => {
        driver = await getDriver();
    });

    beforeEach(async () => {
        try {
            await load(driver, String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage(driver);
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage(driver);
        }

        await driver.findElement(By.id("gui.sqleditor")).click();
        await initConDialog(driver);
    });

    afterEach(async () => {
        dbConfig.caption = "conn";
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
        await driver.quit();
    });

    it("Create a new database connection", async () => {
        try {

            dbConfig.caption += String(new Date().valueOf());
            await driver.findElement(By.css(".connectionBrowser")).findElement(By.id("-1")).click();
            const newConDialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(
                await newConDialog
                    .findElement(By.css(".verticalCenterContent label"))
                    .getAttribute("innerHTML"),
            ).toContain("Database Connection Configuration");

            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);

            expect(
                await newConDialog.findElement(By.id("caption")).getAttribute("value"),
            ).toBe(dbConfig.caption);

            await newConDialog.findElement(By.id("description")).clear();

            await newConDialog
                .findElement(By.id("description"))
                .sendKeys(dbConfig.description);

            expect(
                await newConDialog.findElement(By.id("description")).getAttribute("value"),
            ).toBe(dbConfig.description);

            await newConDialog.findElement(By.id("hostName")).clear();

            await newConDialog
                .findElement(By.id("hostName"))
                .sendKeys(String(dbConfig.hostname));

            expect(
                await newConDialog.findElement(By.id("hostName")).getAttribute("value"),
            ).toBe(String(dbConfig.hostname));

            await selectProtocol(driver, "mysqlx");

            expect(
                await newConDialog.findElement(By.css("#scheme label")).getText(),
            ).toBe("mysqlx");

            await selectProtocol(driver, dbConfig.protocol);

            expect(
                await newConDialog.findElement(By.css("#scheme label")).getText(),
            ).toBe(dbConfig.protocol);

            await driver.findElement(By.css("#port input")).clear();

            await driver.findElement(By.css("#port input")).sendKeys("1111");

            expect(
                await newConDialog
                    .findElement(By.css("#port input"))
                    .getAttribute("value"),
            ).toBe("1111");

            await driver.findElement(By.css("#port input")).clear();

            await driver.findElement(By.css("#port input")).sendKeys(String(dbConfig.port));

            expect(
                await newConDialog
                    .findElement(By.css("#port input"))
                    .getAttribute("value"),
            ).toBe(String(dbConfig.port));

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(String(dbConfig.username));

            expect(
                await newConDialog.findElement(By.id("userName")).getAttribute("value"),
            ).toBe(String(dbConfig.username));

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(String(dbConfig.schema));

            expect(
                await newConDialog
                    .findElement(By.id("defaultSchema"))
                    .getAttribute("value"),
            ).toBe(String(dbConfig.schema));

            await selectDatabaseType(driver, "Sqlite");

            expect(
                await newConDialog.findElement(By.css("#databaseType label")).getText(),
            ).toBe("Sqlite");

            await selectDatabaseType(driver, dbConfig.dbType);

            expect(
                await newConDialog.findElement(By.css("#databaseType label")).getText(),
            ).toBe(dbConfig.dbType);

            if (!dbConfig.showAdvanced) {
                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect(
                    (await driver.findElements(By.css(".valueEditDialog"))).length,
                ).toBe(0);
            } else {
                await driver.executeScript(
                    "arguments[0].click();",
                    await newConDialog.findElement(By.css(".checkMark")),
                );

                expect(
                    await newConDialog.findElement(By.css("#page0 label")).getText(),
                ).toBe("SSL");

                expect(
                    await newConDialog.findElement(By.css("#page1 label")).getText(),
                ).toBe("Advanced");

                await selectSSLMode(driver, "Disable");

                expect(
                    await newConDialog.findElement(By.css("#sslMode label")).getText(),
                ).toBe("Disable");

                await selectSSLMode(driver, "Preferred");

                expect(
                    await newConDialog.findElement(By.css("#sslMode label")).getText(),
                ).toBe("Preferred");

                await selectSSLMode(driver, "Require");

                expect(
                    await newConDialog.findElement(By.css("#sslMode label")).getText(),
                ).toBe("Require");

                await selectSSLMode(driver, "Require and Verify CA");

                expect(
                    await newConDialog.findElement(By.css("#sslMode label")).getText(),
                ).toBe("Require and Verify CA");

                await selectSSLMode(driver, "Require and Verify Identity");

                expect(
                    await newConDialog.findElement(By.css("#sslMode label")).getText(),
                ).toBe("Require and Verify Identity");

                if (dbConfig.sslMode) {
                    await selectSSLMode(driver, dbConfig.sslMode);

                    expect(
                        await newConDialog.findElement(By.css("#sslMode label")).getText(),
                    ).toBe(dbConfig.sslMode);
                } else {
                    await selectSSLMode(driver, "Disable");

                    expect(
                        await newConDialog.findElement(By.css("#sslMode label")).getText(),
                    ).toBe("Disable");
                }

                await newConDialog.findElement(By.id("page1")).click();

                expect(
                    (await newConDialog.findElements(By.id("compressionType"))).length,
                ).toBe(1);

                expect((await newConDialog.findElements(By.id("timeout"))).length).toBe(
                    1,
                );

                expect((await newConDialog.findElements(By.id("others"))).length).toBe(1);

                if (dbConfig.compression) {
                    await newConDialog
                        .findElement(By.id("compressionType"))
                        .sendKeys(dbConfig.compression);
                }

                if (dbConfig.timeout) {
                    await newConDialog
                        .findElement(By.id("timeout"))
                        .sendKeys(dbConfig.timeout);
                }

                if (dbConfig.attributes) {
                    await newConDialog
                        .findElement(By.id("others"))
                        .sendKeys(dbConfig.attributes);
                }

                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();

                expect(
                    (await driver.findElements(By.css(".valueEditDialog"))).length,
                ).toBe(0);
            }

            const conn = await getDB(driver, dbConfig.caption);

            expect(conn).toBeDefined();

            expect(await conn!.findElement(By.css(".tileDescription")).getText()).toBe(
                dbConfig.description,
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Store and clear Password", async () => {

        try {
            await driver.findElement(By.id("gui.sqleditor")).click();
            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig, true);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getSelectedConnectionTab(driver)).getText())
                .toBe(dbConfig.caption);

            await closeDBconnection(driver, dbConfig.caption);

            const host = await getDB(driver, dbConfig.caption);

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
            await conDialog.findElement(By.id("clearPassword")).click();
            await conDialog.findElement(By.id("ok")).click();

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await driver.findElement(By.css(".passwordDialog"))).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Confirm dialog - Save password", async () => {
        try {
            await driver.findElement(By.id("gui.sqleditor")).click();
            dbConfig1.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig1, false, true);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig1.caption),
            );

            await setDBEditorPassword(driver, dbConfig1);

            await setConfirmDialog(driver, dbConfig1, "yes");


            expect(await (await getSelectedConnectionTab(driver)).getText())
                .toBe(dbConfig1.caption);

            await closeDBconnection(driver, dbConfig1.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig1.caption),
            );

            expect(await (await getSelectedConnectionTab(driver)).getText())
                .toBe(dbConfig1.caption);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Duplicate a database connection", async () => {
        try {

            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig);

            const host = await getDB(driver, dbConfig.caption);

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

            const conn = await getDB(driver, dup);

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

            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig);

            let host = await getDB(driver, dbConfig.caption);

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

            await selectProtocol(driver, "mysqlx");

            expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

            let okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

            const conn = await getDB(driver, conName);

            expect(conn).toBeDefined();

            expect(await conn!.findElement(By.css(".tileDescription")).getText())
                .toBe("Another description");

            host = await getDB(driver, conName);

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

            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig);

            const host = await getDB(driver, dbConfig.caption);

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

            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig);

            const host = await getDB(driver, dbConfig.caption);

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
                        By.xpath("//label[contains(text(), '" + dbConfig.caption + "')]"))).length === 0;
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
            await driver
                .findElement(By.css(".connectionBrowser"))
                .findElement(By.id("-1"))
                .click();
            const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
            await selectDatabaseType(driver, "Sqlite");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            dbConfig.caption += String(new Date().valueOf());
            const conName = `Sqlite DB${String(new Date().valueOf())}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(conName);

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

            const conn = await getDB(driver, conName);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(By.css(".tileDescription")).getText()).toBe(
                "Local Sqlite connection",
            );

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            expect(await (await getSelectedConnectionTab(driver)).getText()).toBe(conName);

            await toggleSchemaObject(driver, "Schema", "main");

            const main = await getSchemaObject(driver, "Schema", "main");
            const attr = await main!.getAttribute("class");
            expect(attr.split(" ").includes("expanded")).toBe(true);

            await toggleSchemaObject(driver, "Tables", "Tables");

            const tables = await getSchemaObject(driver, "Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            const table = await getSchemaObject(driver, "obj", "db_connection");

            await driver.wait(async () => {
                await driver
                    .actions()
                    .contextClick(table)
                    .perform();

                return (await driver.findElements(By.css(".noArrow.menu"))).length > 0;
            }, 4000, "Context menu was not opened");

            await driver.findElement(By.id("selectRowsMenuItem")).click();

            expect(await getResultStatus(driver, true)).toContain("OK");

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

            await driver
                .findElement(By.css(".connectionBrowser"))
                .findElement(By.id("-1"))
                .click();

            const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
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
                .sendKeys(String(dbConfig.hostname));

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(String(dbConfig.username));

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(String(dbConfig.schema));

            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id("Require and Verify CA")).click();
            expect(await newConDialog.findElement(By.css("#sslMode label")).getText()).toBe("Require and Verify CA");

            const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
            await paths[0].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`);
            await paths[1].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`);
            await paths[2].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`);

            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const conn = await getDB(driver, conName);
            expect(conn).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            try {
                await setDBEditorPassword(driver, dbConfig);
                await setConfirmDialog(driver, dbConfig, "yes");
            } catch (e) {
                //continue
            }

            expect(await (await getSelectedConnectionTab(driver)).getText()).toBe(conName);
            await toggleExplorerHost(driver, "close");
            await setEditorLanguage(driver, "mysql");

            const contentHost = await driver.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

            const execSel = await getToolbarButton(driver, "Execute selection or full block");
            await execSel?.click();

            const resultHost = await driver.findElement(By.css(".resultHost"));
            const result = await resultHost.findElement(By.css(".resultStatus label"));
            expect(await result.getText()).toContain("1 record retrieved");

            expect( await resultHost.findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]")) ).toBeDefined();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("DB Editor - Core Tests", () => {

    let driver: WebDriver;
    let testFailed = false;

    beforeAll(async () => {
        driver = await getDriver();

        try {
            await load(driver, String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage(driver);
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage(driver);
        }

        await setStartLanguage(driver, "DB Editor", "sql");

        await driver.findElement(By.id("gui.sqleditor")).click();
        await initConDialog(driver);

        dbConfig.caption += String(new Date().valueOf());
        await createDBconnection(driver, dbConfig);
        await driver.executeScript(
            "arguments[0].click();",
            await getDB(driver, dbConfig.caption),
        );
        try {
            await setDBEditorPassword(driver, dbConfig);
            await setConfirmDialog(driver, dbConfig, "yes");
        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("dialog was found") === -1) {
                    throw e;
                }
            }
        }
        expect(await (await getSelectedConnectionTab(driver)).getText()).toBe(dbConfig.caption);
    });

    afterEach(async () => {
        dbConfig.caption = "conn";
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

        await cleanEditor(driver);
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Multi-cursor", async () => {
        try {

            await setEditorLanguage(driver, "sql");

            await writeSQL(driver!, "select * from sakila.actor;");
            await driver!.actions().sendKeys(Key.ENTER).perform();
            await writeSQL(driver!, "select * from sakila.address;");
            await driver!.actions().sendKeys(Key.ENTER).perform();
            await writeSQL(driver!, "select * from sakila.city;");

            await driver!.actions().keyDown(Key.ALT).perform();

            const lines = await driver!.findElements(By.css("#contentHost .editorHost .view-line"));
            lines.shift();
            let spans = await lines[0].findElements(By.css("span"));
            await spans[spans.length - 1].click();

            spans = await lines[1].findElements(By.css("span"));
            await spans[spans.length - 1].click();
            await driver!.actions().keyUp(Key.ALT).perform();

            const ctx = await driver.findElement(By.css(".lines-content"));
            expect((await ctx.findElements(By.css(".current-line"))).length).toBe(3);

            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys("testing");

            expect(await getPromptTextLine(driver, "last-2")).toContain("testing");
            expect(await getPromptTextLine(driver, "last-1")).toContain("testing");
            expect(await getPromptTextLine(driver, "last")).toContain("testing");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {

            await writeSQL(driver, "select * from sakila.actor; select * from sakila.address;");

            const lastId = await getLastQueryResultId(driver!);

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            )!.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            const result1 = await driver.wait(async () => {
                return getResultTab(driver, "Result #1");
            }, 5000, "No results were found");

            const result2 = await getResultTab(driver, "Result #2");

            expect(result1).toBeDefined();

            expect(result2).toBeDefined();

            expect(await getResultColumnName(driver, "actor_id")).toBeDefined();

            await result2!.click();

            expect(await getResultColumnName(driver, "address_id")).toBeDefined();

            await result1!.click();

            expect(await getResultColumnName(driver, "actor_id")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context Menu - Execute", async () => {
        try {

            await writeSQL(driver!, "select * from sakila.actor");

            let lastId = await getLastQueryResultId(driver!);

            await clickDBEditorContextItem(driver!, "Execute Block");

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver!, true)).toMatch(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            expect(await hasNewPrompt(driver!)).toBe(false);

            lastId = await getLastQueryResultId(driver!);

            await clickDBEditorContextItem(driver!, "Execute Block and Advance");

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver!, true)).toMatch(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            expect(await hasNewPrompt(driver!)).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to database and verify default schema", async () => {
        try {

            const defaultSchema = await driver.findElement(
                By.css("#schemaSectionHost div.marked"),
            );

            expect(await defaultSchema.findElement(By.css("label")).getText()).toBe(String(dbConfig.schema));
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {

            await toggleExplorerHost(driver, "close");

            await writeSQL(driver, "select * from sakila.actor");

            const lastId = await getLastQueryResultId(driver!);

            const exeSelNew = await getToolbarButton(driver,
                "Execute selection or full block and create a new block");
            await exeSelNew?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver, "actor_id")).toBeDefined();

            expect(await getResultColumnName(driver, "first_name")).toBeDefined();

            expect(await getResultColumnName(driver, "last_name")).toBeDefined();

            expect(await getResultColumnName(driver, "last_update")).toBeDefined();

            expect(await hasNewPrompt(driver)).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {

            const textArea = await driver.findElement(By.css("textarea"));

            await writeSQL(driver, "select * from sakila.actor;");

            await textArea.sendKeys(Key.RETURN);

            await writeSQL(driver, "select * from sakila.address;");

            await textArea.sendKeys(Key.RETURN);

            await writeSQL(driver, "select * from sakila.category;");

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".statementStart"))).length >= 3;
            }, 3000, "Statement start (blue dot) was not found on all lines");

            await textArea.sendKeys(Key.ARROW_UP);

            await textArea.sendKeys(Key.ARROW_LEFT);

            await textArea.sendKeys(Key.ARROW_LEFT);

            await textArea.sendKeys(Key.ARROW_LEFT);

            let lastId = await getLastQueryResultId(driver!);

            let execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
            await execCaret?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver, "address_id")).toBeDefined();

            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);

            lastId = await getLastQueryResultId(driver!);

            execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
            await execCaret?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver, "actor_id")).toBeDefined();

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            lastId = await getLastQueryResultId(driver!);

            execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
            await execCaret?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver, "category_id")).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {

            const autoCommit = await getToolbarButton(driver, "Auto commit DB changes");
            await driver.executeScript("arguments[0].scrollIntoView(true)", autoCommit);
            await autoCommit!.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await writeSQL(driver,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            const commitBtn = await getToolbarButton(driver, "Commit DB changes");

            const rollBackBtn = await getToolbarButton(driver, "Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            let lastId = await getLastQueryResultId(driver!);

            let execSelNew = await getToolbarButton(driver,
                "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver)).toContain("OK");

            await rollBackBtn!.click();

            await writeSQL(driver, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            lastId = await getLastQueryResultId(driver!);

            execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver)).toContain(
                "OK, 0 records retrieved",
            );

            await writeSQL(driver,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}`);

            lastId = await getLastQueryResultId(driver!);

            execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver)).toContain("OK");

            await commitBtn!.click();

            await writeSQL(driver, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            lastId = await getLastQueryResultId(driver!);

            execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
            await execSelNew?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver, true)).toContain(
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

            await writeSQL(driver, `import from xpto xpto xpto`);

            const findBtn = await getToolbarButton(driver, "Find");
            await findBtn!.click();

            const finder = await driver.findElement(By.css(".find-widget"));

            expect(await finder.getAttribute("aria-hidden")).toBe("false");

            await finder.findElement(By.css("textarea")).sendKeys("xpto");

            await findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).toMatch(new RegExp(/1 of (\d+)/));

            await driver.wait(
                until.elementsLocated(By.css(".cdr.findMatch")),
                2000,
                "No words found",
            );

            //REPLACE

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

            await toggleExplorerHost(driver, "open");

            await expandCollapseSchemaMenus(driver, "open editors", false, 0);

            await expandCollapseSchemaMenus(driver, "scripts", false, 0);

            const sakila = await getSchemaObject(driver, "Schema", "sakila");

            expect(
                await (
                    await sakila!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            await toggleSchemaObject(driver, "Tables", "Tables");

            const tables = await getSchemaObject(driver, "Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject(driver, "obj", "actor")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "address")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "category")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "city")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "country")).toBeDefined();

            await toggleSchemaObject(driver, "Tables", "Tables");

            let attr = await (
                await getSchemaObject(driver, "Tables", "Tables")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject(driver, "Views", "Views");

            expect(
                await (
                    await getSchemaObject(driver, "Views", "Views")
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject(driver, "obj", "test_view")).toBeDefined();

            await toggleSchemaObject(driver, "Views", "Views");

            attr = await (
                await getSchemaObject(driver, "Views", "Views")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject(driver, "Schema", "sakila");

            attr = await (
                await getSchemaObject(driver, "Schema", "sakila")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand_Collapse menus", async () => {
        try {

            await toggleExplorerHost(driver, "open");

            await expandCollapseSchemaMenus(driver, "open editors", true, 0);

            expect(
                await driver
                    .findElement(By.id("editorSectionHost"))
                    .findElement(By.css("div.container.section"))
                    .getAttribute("class"),
            ).toContain("expanded");

            await expandCollapseSchemaMenus(driver, "open editors", false, 0);

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

            await expandCollapseSchemaMenus(driver, "open editors", true, 0);

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

            await expandCollapseSchemaMenus(driver, "schemas", false, 0);

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

            await expandCollapseSchemaMenus(driver, "schemas", true, 0);

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

            await expandCollapseSchemaMenus(driver, "admin", false, 0);

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

            await expandCollapseSchemaMenus(driver, "admin", true, 0);

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

            await expandCollapseSchemaMenus(driver, "scripts", false, 0);

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

            await expandCollapseSchemaMenus(driver, "scripts", true, 0);

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

            await setEditorLanguage(driver, "javascript");

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(driver, textArea, "Math.random();");

            const result2 = await getOutput(driver);

            expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));

            await enterCmd(driver, textArea, "\\typescript");

            expect(await getOutput(driver)).toBe("Switched to TypeScript mode");

            await enterCmd(driver, textArea, "Math.random();");

            const result4 = await getOutput(driver);

            expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(300);

            await pressEnter(driver);

            const otherResult = await getOutput(driver, true);

            expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));

            expect(otherResult !== result2).toBe(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await pressEnter(driver);

            const otherResult1 = await getOutput(driver);

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

            await enterCmd(driver, textArea, "SELECT VERSION();");

            const resultHosts = await driver.findElements(By.css(".resultHost"));

            const txt = await (await resultHosts[resultHosts.length-1]
                .findElement(By.css(".tabulator-cell"))).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await enterCmd(driver, textArea, `/*!${serverVer} select * from actor;*/`);

            expect(await getResultStatus(driver, true)).toMatch(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            const higherServer = parseInt(serverVer, 10) + 1;

            await enterCmd(driver, textArea, `/*!${higherServer} select * from actor;*/`);

            expect(await getResultStatus(driver)).toContain(
                "OK, 0 records retrieved",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {

            await setEditorLanguage(driver, "ts");

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

            await enterCmd(driver, textArea, cmd.trim());

            const pieChart = await getGraphHost(driver);

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
            await setEditorLanguage(driver, "sql");

            await toggleExplorerHost(driver, "close");

            let text = `
                DELIMITER $$
                    select 2 $$
                select 1
                `;

            text = text.trim();
            await writeSQL(driver!, text);

            await driver!.wait(async () => {
                return (await driver!.findElements(By.css(".statementStart"))).length > 1;
            }, 5000, "No blue dots were found");

            const lines = await driver!.findElements(By
                .css("#contentHost .editorHost div.margin-view-overlays > div"));

            expect(await lines[lines.length-1].findElement(By.css(".statementStart"))).toBeDefined();
            expect(await lines[lines.length-2].findElement(By.css(".statementStart"))).toBeDefined();
            expect(await lines[lines.length-3].findElement(By.css(".statementStart"))).toBeDefined();

            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ENTER);

            await driver!.wait(async () => {
                return (await driver!.findElements(
                    By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
            }, 5000, "A new line was not found");

            await driver!.wait(async () => {
                try {
                    const lines = await driver!.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                    return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length === 0;
                } catch (e) {
                    return false;
                }
            }, 5000, "Line 2 has the statement start");

            await textArea.sendKeys("select 1");

            await driver!.wait(async () => {
                try {
                    const lines = await driver!.findElements(
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

            await toggleExplorerHost(driver, "open");

            await driver.executeScript(
                "arguments[0].click()",
                await driver.findElement(By.id("addConsole")),
            );

            const input = await driver
                .findElement(By.id("editorSectionHost"))
                .findElement(By.css("input"));

            await input.sendKeys("myNewConsole");

            await input.sendKeys(Key.ENTER);

            expect(await getOpenEditor(driver, "myNewConsole")).toBeDefined();

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
                .sendKeys("select actor from sakila.actor");

            await selectCurrentEditor(driver, "Notebook", "shell");

            await selectCurrentEditor(driver, "myNewConsole", "shell");

            const console = await getOpenEditor(driver, "myNewConsole");

            await console!.findElement(By.css("span.codicon-close")).click();

            expect(await getOpenEditor(driver, "myNewConsole")).toBeUndefined();

            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toBe("Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    //TO FINISH
    it("Add_run JS script", async () => {
        try {

            await toggleExplorerHost(driver, "open");

            await expandCollapseSchemaMenus(driver, "scripts", true, 0);

            const script = await addScript(driver, "JS");

            await selectCurrentEditor(driver, script, "javascript");

            expect(await existsScript(driver, script, "javascript")).toBe(true);

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
                await (await getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(driver, script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("javascript");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello JavaScript')");

            await (
                await getToolbarButton(driver, "Execute full script")
            )!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    //TO FINISH
    it("Add_run TS script", async () => {
        try {

            await toggleExplorerHost(driver, "open");

            const script = await addScript(driver, "TS");

            await selectCurrentEditor(driver, script, "typescript");

            expect(await existsScript(driver, script, "typescript")).toBe(true);

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
                await (await getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");

            src = (await (await getOpenEditor(driver, script))!.findElement(By.css("img"))
                .getAttribute("src"));

            expect(src.indexOf("typescript") !== -1).toBe(true);

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Typescript')");

            await (
                await getToolbarButton(driver, "Execute full script")
            )!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {

            await toggleExplorerHost(driver, "open");

            const script = await addScript(driver, "SQL");

            await selectCurrentEditor(driver, script, "mysql");

            expect(await existsScript(driver, script, "mysql")).toBe(true);

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
                await (await getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(driver, script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("mysql");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            await pressEnter(driver);

            await driver.wait(
                until.elementsLocated(By.css("#resultPaneHost .tabulator-col-title")),
                3000,
                "Results were not found",
            );

            const columns = await driver.findElements(
                By.css("#resultPaneHost .tabulator-col-title"),
            );

            expect(await columns[0].getText()).toBe("actor_id");

            expect(await columns[1].getText()).toBe("first_name");

            expect(await columns[2].getText()).toBe("last_name");

            expect(await columns[3].getText()).toBe("last_update");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await selectCurrentEditor(driver, "Notebook", "shell");
        }
    });

    it("Switch between scripts", async () => {
        try {

            const script1 = await addScript(driver, "JS");

            try {
                await selectCurrentEditor(driver, script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script1, "javascript");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello JavaScript')");

            const script2 = await addScript(driver, "TS");

            try {
                await selectCurrentEditor(driver, script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script2, "typescript");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Typescript')");

            const script3 = await addScript(driver, "SQL");

            try {
                await selectCurrentEditor(driver, script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script3, "mysql");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            try {
                await selectCurrentEditor(driver, script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script1, "javascript");
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
                await selectCurrentEditor(driver, script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script2, "typescript");
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
                await selectCurrentEditor(driver, script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(driver, script3, "mysql");
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
            await selectCurrentEditor(driver, "Notebook", "shell");
        }
    });
});
