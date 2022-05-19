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
import { platform } from "os";
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
    getConnectionTab,
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
    setFeedbackRequested,
    IDbConfig,
    setDBEditorStartLang,
    initConDialog,
    existsScript,
    writeSQL,
} from "../lib/helpers";

const dbConfig: IDbConfig = {
    dbType: "MySQL",
    caption: "conn",
    description: "random connection",
    hostname: process.env.DBHOSTNAME,
    protocol: "mysql",
    port: process.env.DBPORT,
    username: process.env.DBUSERNAME,
    password: process.env.DBPASSWORD,
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
    hostname: process.env.DBHOSTNAME,
    protocol: "mysql",
    port: process.env.DBPORT,
    username: process.env.DBUSERNAME1,
    password: process.env.DBUSERNAME1,
    schema: "sakila",
    showAdvanced: false,
    sslMode: "Disable",
    compression: "",
    timeout: "",
    attributes: "",
    portX: "",
};

describe("DB Editor", () => {
    let driver: WebDriver;
    let testFailed = false;

    beforeAll(async () => {
        driver = await getDriver();
    });

    beforeEach(async () => {
        await load(driver, String(process.env.SHELL_UI_HOSTNAME));
        await waitForHomePage(driver);
        await driver.findElement(By.id("gui.sqleditor")).click();
        await initConDialog(driver);
    });

    afterEach(async () => {
        dbConfig.caption = "conn";
        if(testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch(e) {
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

            expect(await (await getConnectionTab(driver, "1")).getText())
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
        } catch(e) {
            testFailed = true;
            throw e;
        }

    });

    it("Feedback Requested - Save password", async () => {
        try {
            await driver.findElement(By.id("gui.sqleditor")).click();
            dbConfig1.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig1, false, true);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig1.caption),
            );

            await setDBEditorPassword(driver, dbConfig1);

            await setFeedbackRequested(driver, dbConfig1, "Y");


            expect(await (await getConnectionTab(driver, "1")).getText())
                .toBe(dbConfig1.caption);

            await closeDBconnection(driver, dbConfig1.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig1.caption),
            );

            expect(await (await getConnectionTab(driver, "1")).getText())
                .toBe(dbConfig1.caption);

        } catch(e) {
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

            expect(await (await getConnectionTab(driver, "1")).getText()).toBe(conName);

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

            expect(await getResultStatus(driver, 1, true)).toContain("OK");

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
            expect(await resultHeaderRows[4].getText()).toBe("options");
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
                await setFeedbackRequested(driver, dbConfig, "Y");
            } catch (e) {
                //continue
            }

            expect(await (await getConnectionTab(driver, "1")).getText()).toBe(conName);
            await toggleExplorerHost(driver, "close");
            await setEditorLanguage(driver, "mysql");

            const contentHost = await driver.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

            const execSel = await getToolbarButton(driver, "Execute selection or full block");
            await execSel?.click();

            const resultHost = await driver.findElement(By.css(".resultHost"));
            const xpath = "//div[contains(@tabulator-field, 'Variable_name') and contains(@role, 'gridcell')]";
            const variableNameCol = await resultHost.findElement(By.xpath(xpath));

            const xpath1 = "//div[contains(@tabulator-field, 'Value') and contains(@role, 'gridcell')]";
            const valueCol = await resultHost.findElement(By.xpath(xpath1));

            await driver.wait(until.elementTextContains(variableNameCol, "Ssl_cipher"),
                3000, "No ssl cipher");

            expect(await valueCol.getText()).toMatch(new RegExp(/TLS_(.*)/));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    describe("SQL Database connections", () => {

        beforeEach(async () => {
            await driver.findElement(By.id("gui.sqleditor")).click();
            dbConfig.caption += String(new Date().valueOf());
            await createDBconnection(driver, dbConfig);
        });

        afterEach(() => {
            dbConfig.caption = "conn";
        });

        it("Connect to database and verify default schema", async () => {
            try {

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

                const defaultSchema = await driver.findElement(
                    By.css("#schemaSectionHost div.marked"),
                );

                expect(await defaultSchema.findElement(By.css("label")).getText()).toBe(String(dbConfig.schema));
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Connection toolbar buttons - Execute selection or full block", async () => {
            try {

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

                await writeSQL(driver, "select * from sakila.actor");

                const execSel = await getToolbarButton(driver, "Execute selection or full block");
                await execSel?.click();

                const resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                const resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("actor_id");

                expect(await resultHeaderRows[1].getText()).toBe("first_name");

                expect(await resultHeaderRows[2].getText()).toBe("last_name");

                expect(await resultHeaderRows[3].getText()).toBe("last_update");

                expect(
                    (await driver.findElements(By.css(".resultHost .tabulator-row")))
                        .length > 0,
                ).toBe(true);

                expect((await driver.findElements(By.css(".editorPromptFirst"))).length).toBe(3);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
            try {

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(
                    dbConfig.caption,
                );

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

                await writeSQL(driver, "select * from sakila.actor");

                const exeSelNew = await getToolbarButton(driver,
                    "Execute selection or full block and create a new block");
                await exeSelNew?.click();

                const resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                const resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("actor_id");

                expect(await resultHeaderRows[1].getText()).toBe("first_name");

                expect(await resultHeaderRows[2].getText()).toBe("last_name");

                expect(await resultHeaderRows[3].getText()).toBe("last_update");

                expect(
                    (await driver.findElements(By.css(".resultHost .tabulator-row")))
                        .length > 0,
                ).toBe(true);

                expect((await driver.findElements(By.css(".editorPromptFirst"))).length).toBe(4);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            try {

                await setStartLanguage(driver, "DB Editor", "typescript");

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

                const textArea = await driver.findElement(By.css("textarea"));

                await writeSQL(driver, "select * from sakila.actor;");

                await textArea.sendKeys(Key.RETURN);

                await writeSQL(driver, "select * from sakila.address;");

                await textArea.sendKeys(Key.RETURN);

                await writeSQL(driver, "select * from sakila.category;");

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length === 3;
                }, 3000, "Statement start (blue dot) was not found on all lines");

                await textArea.sendKeys(Key.ARROW_UP);

                await textArea.sendKeys(Key.ARROW_LEFT);

                await textArea.sendKeys(Key.ARROW_LEFT);

                await textArea.sendKeys(Key.ARROW_LEFT);

                let execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
                await execCaret?.click();

                let resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                let resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("address_id");

                await textArea.sendKeys(Key.ARROW_UP);

                await textArea.sendKeys(Key.ARROW_LEFT);

                await textArea.sendKeys(Key.ARROW_LEFT);

                await textArea.sendKeys(Key.ARROW_LEFT);

                execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
                await execCaret?.click();

                await driver.sleep(1000);

                resultSet = driver.wait(
                    until.elementLocated(By.css(".resultHost .tabulator-headers")),
                    1000);

                resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("actor_id");

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                execCaret = await getToolbarButton(driver, "Execute the statement at the caret position");
                await execCaret?.click();

                await driver.sleep(1000);

                resultSet = driver.wait(
                    until.elementLocated(By.css(".resultHost .tabulator-headers")),
                    1000);

                resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("category_id");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            try {

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

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

                let execSelNew = await getToolbarButton(driver,
                    "Execute selection or full block and create a new block");
                await execSelNew?.click();

                expect(await getResultStatus(driver, 1)).toContain("OK");

                await rollBackBtn!.click();

                await writeSQL(driver, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

                execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
                await execSelNew?.click();

                expect(await getResultStatus(driver, 2)).toContain(
                    "OK, 0 records retrieved",
                );

                await writeSQL(driver,
                    `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}`);

                execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
                await execSelNew?.click();

                expect(await getResultStatus(driver, 3)).toContain("OK");

                await commitBtn!.click();

                await writeSQL(driver, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

                execSelNew = await getToolbarButton(driver, "Execute selection or full block and create a new block");
                await execSelNew?.click();

                expect(await getResultStatus(driver, 4, true)).toContain(
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

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                const contentHost = await driver.findElement(By.id("contentHost"));

                await writeSQL(driver, `select from sakila sakila sakila`);

                const findBtn = await getToolbarButton(driver, "Find");
                await findBtn!.click();

                const finder = await driver.findElement(By.css(".find-widget"));

                expect(await finder.getAttribute("aria-hidden")).toBe("false");

                await finder.findElement(By.css("textarea")).sendKeys("sakila");

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
                ).toContain("select from tester sakila sakila");

                await replacer.findElement(By.css("textarea")).clear();

                await replacer.findElement(By.css("textarea")).sendKeys("testing");

                await (await replacerGetButton(replacer, "Replace All"))!.click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).toContain("select from tester testing testing");

                await closeFinder(finder);

                expect(await finder.getAttribute("aria-hidden")).toBe("true");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Expand Collapse schema objects", async () => {
            try {

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

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

        //TO FINISH
        it("Add_run JS script", async () => {
            try {

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

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
                    await getToolbarButton(driver, "Execute selection or full script")
                )!.click();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        //TO FINISH
        it("Add_run TS script", async () => {
            try {

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

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
                    await getToolbarButton(driver, "Execute selection or full script")
                )!.click();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add_run SQL script", async () => {
            try {

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(
                    dbConfig.caption,
                );

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

                await (
                    await getToolbarButton(driver, "Execute selection or full script")
                )!.click();

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
            }
        });

        it("Switch between scripts", async () => {
            try {
                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

                const script1 = await addScript(driver, "JS");

                await selectCurrentEditor(driver, script1, "javascript");

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("console.log('Hello JavaScript')");

                const script2 = await addScript(driver, "TS");

                await selectCurrentEditor(driver, script2, "typescript");

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("console.log('Hello Typescript')");

                const script3 = await addScript(driver, "SQL");

                await selectCurrentEditor(driver, script3, "mysql");

                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .sendKeys("SELECT * FROM sakila.actor;");

                await selectCurrentEditor(driver, script1, "javascript");

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("console.log('Hello JavaScript')");

                await selectCurrentEditor(driver, script2, "typescript");

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("console.log('Hello Typescript')");

                await selectCurrentEditor(driver, script3, "mysql");

                expect(
                    await driver
                        .findElement(By.id("editorPaneHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value"),
                ).toBe("SELECT * FROM sakila.actor;");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Expand_Collapse menus", async () => {
            try {
                const expandCollapse = async (
                    elToClick: WebElement,
                    elToVerify: WebElement,
                    visible: boolean,
                    retries: number,
                ) => {
                    if (retries === 3) {
                        throw new Error("Error on expanding collapse");
                    }
                    try {
                        await elToClick.click();
                        if (!visible) {
                            await driver.wait(
                                until.elementIsNotVisible(elToVerify),
                                3000,
                                "Element is still visible",
                            );
                        } else {
                            await driver.wait(
                                until.elementIsVisible(elToVerify),
                                3000,
                                "Element is still not visible",
                            );
                        }
                    } catch (e) {
                        await driver.sleep(1000);
                        await expandCollapse(elToClick, elToVerify, visible, retries + 1);
                    }
                };

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

                expect(
                    await driver
                        .findElement(By.id("editorSectionHost"))
                        .findElement(By.css("div.container.section"))
                        .getAttribute("class"),
                ).toContain("expanded");

                await expandCollapse(
                    await driver
                        .findElement(By.id("editorSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver.findElement(By.id("standardConsole")),
                    false,
                    0,
                );

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
                    "Element 1 is still expanded",
                );

                await expandCollapse(
                    await driver
                        .findElement(By.id("editorSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver.findElement(By.id("standardConsole")),
                    true,
                    0,
                );

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
                    "Element 2 is still expanded",
                );

                expect(
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css("div.container.section"))
                        .getAttribute("class"),
                ).toContain("expanded");

                await expandCollapse(
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css(".tabulator-table")),
                    false,
                    0,
                );

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
                    "Element 3 is still expanded",
                );

                await expandCollapse(
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver
                        .findElement(By.id("schemaSectionHost"))
                        .findElement(By.css(".tabulator-table")),
                    true,
                    0,
                );

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
                    "Element 4 is still expanded",
                );

                await expandCollapse(
                    await driver
                        .findElement(By.id("scriptSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver
                        .findElement(By.id("scriptSectionHost"))
                        .findElement(By.css(".tabulator-table")),
                    false,
                    0,
                );

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
                    "Element 5 is still expanded",
                );

                await expandCollapse(
                    await driver
                        .findElement(By.id("scriptSectionHost"))
                        .findElement(By.css("div.container.section label")),
                    await driver
                        .findElement(By.id("scriptSectionHost"))
                        .findElement(By.css(".tabulator-table")),
                    true,
                    0,
                );

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
                    "Element 6 is still expanded",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add a new console", async () => {
            try {
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(dbConfig.caption);

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

                await selectCurrentEditor(driver, "Standard Console", "shell");

                expect(
                    (await driver
                        .findElement(By.id("contentHost"))
                        .findElement(By.css("textarea"))
                        .getAttribute("value")).trim(),
                ).toBe("\\about");

                await selectCurrentEditor(driver, "myNewConsole", "shell");

                const console = await getOpenEditor(driver, "myNewConsole");

                await console!.findElement(By.css("span.codicon-close")).click();

                expect(await getOpenEditor(driver, "myNewConsole")).toBeUndefined();

                expect(
                    await driver.findElement(By.css("#documentSelector label")).getText(),
                ).toBe("Standard Console");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Switch between search tabs", async () => {
            try {
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(
                    dbConfig.caption,
                );

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

                await writeSQL(driver, "select * from sakila.actor;select * from sakila.address;");

                await (
                    await getToolbarButton(
                        driver,
                        "Execute selection or full block and create a new block",
                    )
                )!.click();

                const result1 = await getResultTab(driver, "Result #1");

                const result2 = await getResultTab(driver, "Result #2");

                expect(result1).toBeDefined();

                expect(result2).toBeDefined();

                expect(await getResultColumnName(driver, "actor_id")).toBeDefined();

                expect(await getResultColumnName(driver, "first_name")).toBeDefined();

                expect(await getResultColumnName(driver, "last_name")).toBeDefined();

                expect(await getResultColumnName(driver, "last_update")).toBeDefined();

                await result2!.click();

                expect(await getResultColumnName(driver, "address_id")).toBeDefined();

                expect(await getResultColumnName(driver, "address")).toBeDefined();

                expect(await getResultColumnName(driver, "address2")).toBeDefined();

                expect(await getResultColumnName(driver, "district")).toBeDefined();

                expect(await getResultColumnName(driver, "city_id")).toBeDefined();

                expect(await getResultColumnName(driver, "postal_code")).toBeDefined();

                await result1!.click();

                expect(await getResultColumnName(driver, "actor_id")).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        //bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34179455
        xit("Using Math_random on js_py blocks", async () => {
            try {
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(
                    dbConfig.caption,
                );

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "javascript");

                const contentHost = await driver.findElement(By.id("contentHost"));

                const textArea = await contentHost.findElement(By.css("textarea"));

                await enterCmd(driver, textArea, "Math.random();");

                const result2 = await getOutput(driver, 2);

                expect(result2).toMatch(new RegExp(/(\d+).(\d+)/));

                await enterCmd(driver, textArea, "\\typescript");

                expect(await getOutput(driver, 3)).toBe("Switched to TypeScript mode");

                await enterCmd(driver, textArea, "Math.random();");

                const result4 = await getOutput(driver, 4);

                expect(result4).toMatch(new RegExp(/(\d+).(\d+)/));

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(1000);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(1000);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(1000);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(1000);

                await pressEnter(driver);

                const otherResult = await getOutput(driver, 3);

                expect(otherResult).toMatch(new RegExp(/(\d+).(\d+)/));

                expect(otherResult !== result2).toBe(true);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await pressEnter(driver);

                const otherResult1 = await getOutput(driver, 4);

                expect(otherResult1).toMatch(new RegExp(/(\d+).(\d+)/));

                expect(otherResult1 !== result4).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Using a DELIMITER", async () => {
            try {
                await setStartLanguage(driver, "DB Editor", "sql");
                await driver.findElement(By.id("gui.shell")).click();
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText()).toBe(
                    dbConfig.caption,
                );

                await toggleExplorerHost(driver, "close");

                const line2Click = await driver.findElements(By.css("#contentHost .view-line"));
                await line2Click[line2Click.length - 1].click();

                let key;
                if (platform() === "darwin") {
                    key = Key.COMMAND;
                } else {
                    key = Key.CONTROL;
                }

                await driver.actions()
                    .keyDown(key)
                    .keyDown(Key.SHIFT)
                    .keyDown(Key.ARROW_UP)
                    .keyUp(key)
                    .keyUp(Key.SHIFT)
                    .keyUp(Key.ARROW_UP)
                    .perform();

                await driver.actions()
                    .keyDown(Key.BACK_SPACE)
                    .keyUp(Key.BACK_SPACE)
                    .perform();


                let text = `
                DELIMITER $$
                    select 2 $$
                select 1
                `;

                text = text.trim();
                await writeSQL(driver, text);

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length > 1;
                }, 5000, "No blue dots were found");

                const lines = await driver.findElements(By
                    .css("#contentHost .editorHost div.margin-view-overlays > div"));

                expect(lines.length).toBe(3);

                expect(await lines[0].findElement(By.css(".statementStart"))).toBeDefined();
                expect(await lines[1].findElement(By.css(".statementStart"))).toBeDefined();
                expect(await lines[2].findElement(By.css(".statementStart"))).toBeDefined();

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));
                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ENTER);

                await driver.wait(async () => {
                    return (await driver.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
                }, 2000, "A new line was not found");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[2].findElements(By.css(".statementStart"))).length === 0;
                    } catch (e) {
                        return false;
                    }
                }, 5000, "Line 2 has the statement start");

                await textArea.sendKeys("select 1");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[2].findElements(By.css(".statementStart"))).length > 0;
                    } catch (e) {
                        return false;
                    }
                }, 5000, "Line 2 does not have the statement start");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Multi-line comments", async () => {
            try {
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await setEditorLanguage(driver, "mysql");

                const contentHost = await driver.findElement(By.id("contentHost"));

                const textArea = await contentHost.findElement(By.css("textarea"));

                await enterCmd(driver, textArea, "SELECT VERSION();");

                const txt = await (await driver.findElement(By.css(".resultHost .tabulator-cell"))).getText();

                const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

                const digits = server.split(".");

                let serverVer = digits[0];

                digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

                digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

                await enterCmd(driver, textArea, `/*!${serverVer} select * from actor;*/`);

                expect(await getResultStatus(driver, 2, true)).toMatch(
                    new RegExp(/OK, (\d+) records retrieved/),
                );

                const higherServer = parseInt(serverVer, 10) + 1;

                await enterCmd(driver, textArea, `/*!${higherServer} select * from actor;*/`);

                expect(await getResultStatus(driver, 3)).toContain(
                    "OK, 0 records retrieved",
                );
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await writeSQL(driver, "select * from sakila.actor;");
                await driver.actions().keyDown(Key.ENTER).keyUp(Key.ENTER).perform();
                await writeSQL(driver, "select * from sakila.address;");
                await driver.actions().keyDown(Key.ENTER).keyUp(Key.ENTER).perform();
                await writeSQL(driver, "select * from sakila.city;");

                await driver.actions().keyDown(Key.ALT).perform();

                const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                lines.shift();
                let spans = await lines[0].findElements(By.css("span"));
                await spans[spans.length - 1].click();

                spans = await lines[1].findElements(By.css("span"));
                await spans[spans.length - 1].click();
                await driver.actions().keyUp(Key.ALT).perform();

                await driver.actions().keyDown(Key.BACK_SPACE).keyUp(Key.BACK_SPACE).perform();
                await driver.sleep(1000);
                await driver.actions().keyDown(Key.BACK_SPACE).keyUp(Key.BACK_SPACE).perform();
                await driver.sleep(1000);
                await driver.actions().keyDown(Key.BACK_SPACE).keyUp(Key.BACK_SPACE).perform();

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));

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
            }
        });

        it("Context Menu - Execute", async () => {
            try {
                await setDBEditorStartLang(driver, "sql");

                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                await writeSQL(driver, "select * from sakila.actor");

                await clickDBEditorContextItem(driver, "Execute Block");

                let resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                let resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("actor_id");
                expect(await resultHeaderRows[1].getText()).toBe("first_name");
                expect(await resultHeaderRows[2].getText()).toBe("last_name");
                expect(await resultHeaderRows[3].getText()).toBe("last_update");
                expect(
                    (await driver.findElements(By.css(".resultHost .tabulator-row")))
                        .length > 0,
                ).toBe(true);

                expect((await driver.findElements(By.css(".editorPromptFirst"))).length).toBe(2);

                if(platform() === "darwin") {
                    await writeSQL(driver, Key.chord(Key.COMMAND, "a"));
                } else {
                    await writeSQL(driver, Key.chord(Key.CONTROL, "a"));
                }

                await driver.actions()
                    .keyDown(Key.BACK_SPACE)
                    .keyUp(Key.BACK_SPACE)
                    .pause(1000)
                    .perform();

                await writeSQL(driver, "select * from sakila.city");
                await clickDBEditorContextItem(driver, "Execute Block and Advance");

                await driver.sleep(1000);

                resultSet = await driver.findElement(
                    By.css(".resultHost .tabulator-headers"),
                );

                resultHeaderRows = await resultSet.findElements(
                    By.css(".tabulator-col-title"),
                );

                expect(await resultHeaderRows[0].getText()).toBe("city_id");
                expect(await resultHeaderRows[1].getText()).toBe("city");
                expect(await resultHeaderRows[2].getText()).toBe("country_id");
                expect(await resultHeaderRows[3].getText()).toBe("last_update");
                expect(
                    (await driver.findElements(By.css(".resultHost .tabulator-row")))
                        .length > 0,
                ).toBe(true);

                expect((await driver.findElements(By.css(".editorPromptFirst"))).length).toBe(3);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Pie Graph based on DB table", async () => {
            try {
                await setDBEditorStartLang(driver, "typescript");
                await driver.findElement(By.id("gui.sqleditor")).click();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(driver, dbConfig.caption),
                );

                try {
                    await setDBEditorPassword(driver, dbConfig);
                    await setFeedbackRequested(driver, dbConfig, "Y");
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        if (e.message.indexOf("dialog was found") === -1) {
                            throw e;
                        }
                    }
                }

                expect(await (await getConnectionTab(driver, "1")).getText())
                    .toBe(dbConfig.caption);

                await toggleExplorerHost(driver, "close");

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));

                await enterCmd(driver, textArea, `
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
                    const graph = new Graph();
                    graph.render(options);
                }
                `);

                const pieChart = await getGraphHost(driver, 1);

                const chartColumns = await pieChart.findElements(By.css("rect"));
                for(const col of chartColumns) {
                    expect(parseInt(await col.getAttribute("width"), 10)).toBeGreaterThan(0);
                }

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });
    });
});
