/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import { getDriver, load } from "../lib/engine";
import { By, until, Key } from "selenium-webdriver";
import {
    waitForHomePage,
    selectDatabaseType,
    selectProtocol,
    selectSSLMode,
    getDB,
    createDBconnection,
    setCodeEditorLanguage,
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
} from "../lib/helpers";

import {
    execMySQL,
    checkEnv,
    checkMySQLRunning,
    checkMySQLEnv,
    startServer,
    cleanDataDir,
} from "../lib/teardowns";

const dbConfig = {
    dbType: "MySQL",
    caption: "ClientQA test",
    description: "my connection",
    hostname: __DBHOSTNAME__,
    protocol: "mysql",
    port: __DBPORT__,
    username: __DBUSERNAME__,
    password: __DBPASSWORD__,
    schema: "sakila",
    showAdvanced: false,
    sslMode: "Disable",
    compression: "",
    timeout: "",
    attributes: "",
};

describe("MySQL Editor", function () {
    let driver;
    beforeAll(async function () {
        try {
            await checkEnv();
            await checkMySQLRunning();
            await checkMySQLEnv();
        } catch (e) {
            console.error(e);
            await new Promise((resolve) => {
                return setTimeout(resolve, 500);
            });
            process.exit(1);
        }
    });

    beforeEach(async function () {
        __CHILD__= await startServer();
        driver = getDriver();
        await load(driver);
        await waitForHomePage(driver);
        await driver.findElement(By.id("gui.sqleditor")).click();
        expect(
            await driver.findElement(By.css(".connectionBrowser #title")).getText(),
        ).toBe("MySQL Shell - SQL Editor");
    });

    afterEach(async function () {
        await driver.close();
        await cleanDataDir();
        __CHILD__.kill();
    });

    afterAll(async function () {
        await driver.quit();
    });

    fit("Create a new database connection", async function () {
        await driver
            .findElement(By.css(".connectionBrowser"))
            .findElement(By.id("-1"))
            .click();

        const newConDialog = await driver.findElement(By.css(".valueEditDialog"));

        expect(
            await newConDialog
                .findElement(By.css(".verticalCenterContent label"))
                .getText(),
        ).toBe("Database Connection Configuration");

        await newConDialog.findElement(By.id("caption")).clear();

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
            .sendKeys(dbConfig.hostname);

        expect(
            await newConDialog.findElement(By.id("hostName")).getAttribute("value"),
        ).toBe(dbConfig.hostname);

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

        await driver.findElement(By.css("#port input")).sendKeys(dbConfig.port);

        expect(
            await newConDialog
                .findElement(By.css("#port input"))
                .getAttribute("value"),
        ).toBe(dbConfig.port);

        await newConDialog
            .findElement(By.id("userName"))
            .sendKeys(dbConfig.username);

        expect(
            await newConDialog.findElement(By.id("userName")).getAttribute("value"),
        ).toBe(dbConfig.username);

        await newConDialog
            .findElement(By.id("password"))
            .sendKeys(dbConfig.password);

        expect(
            await newConDialog.findElement(By.id("password")).getAttribute("value"),
        ).toBe(dbConfig.password);

        await newConDialog
            .findElement(By.id("defaultSchema"))
            .sendKeys(dbConfig.schema);

        expect(
            await newConDialog
                .findElement(By.id("defaultSchema"))
                .getAttribute("value"),
        ).toBe(dbConfig.schema);

        await selectDatabaseType(driver, "Sqlite");

        expect(
            await newConDialog.findElement(By.css("#databaseType label")).getText(),
        ).toBe("Sqlite");

        await selectDatabaseType(driver, dbConfig.dbType);

        expect(
            await newConDialog.findElement(By.css("#databaseType label")).getText(),
        ).toBe(dbConfig.dbType);

        if (!dbConfig.showAdvanced) {
            await driver.findElement(By.id("ok")).click();

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

            await driver.findElement(By.id("ok")).click();

            expect(
                (await driver.findElements(By.css(".valueEditDialog"))).length,
            ).toBe(0);
        }

        const conn = await getDB(driver, dbConfig.caption);

        expect(conn).toBeDefined();

        expect(await conn.findElement(By.css(".tileDescription")).getText()).toBe(
            dbConfig.description,
        );
    });

    it("Duplicate a database connection", async function () {
        await createDBconnection(driver, dbConfig);

        const host = await getDB(driver, dbConfig.caption);

        await driver.executeScript(
            "arguments[0].click();",
            await host.findElement(By.id("triggerTileAction")),
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

        await conDialog.findElement(By.id("caption")).clear();

        await conDialog.findElement(By.id("caption")).sendKeys("ClientQA - other");

        await conDialog.findElement(By.id("description")).clear();

        await conDialog
            .findElement(By.id("description"))
            .sendKeys("my other connection");

        await driver.findElement(By.id("ok")).click();

        expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

        const conn = await getDB(driver, "ClientQA - other");

        expect(conn).toBeDefined();

        expect(await conn.findElement(By.css(".tileDescription")).getText())
            .toBe("my other connection");
    });

    it("Edit a database connection", async function () {
        await createDBconnection(driver, dbConfig);

        let host = await getDB(driver, dbConfig.caption);

        await driver.executeScript(
            "arguments[0].click();",
            await host.findElement(By.id("triggerTileAction")),
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

        await conDialog.findElement(By.id("caption")).clear();

        await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

        await conDialog.findElement(By.id("description")).clear();

        await conDialog
            .findElement(By.id("description"))
            .sendKeys("Another description");

        await conDialog.findElement(By.id("hostName")).clear();

        await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

        await selectProtocol(driver, "mysqlx");

        expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

        await driver.findElement(By.id("ok")).click();

        expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

        const conn = await getDB(driver, "WexQA");

        expect(conn).toBeDefined();

        expect(await conn.findElement(By.css(".tileDescription")).getText())
            .toBe("Another description");

        host = await getDB(driver, "WexQA");

        await driver.executeScript(
            "arguments[0].click();",
            await host.findElement(By.id("triggerTileAction")),
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
        ).toBe("WexQA");

        expect(
            await conDialog.findElement(By.id("description")).getAttribute("value"),
        ).toBe("Another description");

        expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

        expect(
            await conDialog.findElement(By.id("hostName")).getAttribute("value"),
        ).toBe("1.1.1.1");

        await driver.findElement(By.id("ok")).click();

        expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);
    });

    it("Edit a database connection and verify errors", async function () {
        await createDBconnection(driver, dbConfig);

        const host = await getDB(driver, dbConfig.caption);

        await driver.executeScript(
            "arguments[0].click();",
            await host.findElement(By.id("triggerTileAction")),
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

        const customClear = async (el) => {
            const textLength = (await el.getAttribute("value")).length;
            for (let i = 0; i <= textLength - 1; i++) {
                el.sendKeys(Key.BACK_SPACE);
            }
        };

        await customClear(await conDialog.findElement(By.id("caption")));

        await conDialog.findElement(By.id("ok")).click();

        const error = await driver.wait(
            until.elementLocated(By.css("label.error")),
            2000,
        );

        expect(await error.getText()).toBe("The caption cannot be empty");

        expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

        await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

        await customClear(await conDialog.findElement(By.id("hostName")));

        await driver.findElement(By.id("ok")).click();

        expect(await conDialog.findElement(By.css("label.error")).getText())
            .toBe("Specify a valid host name or IP address");

        expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

        await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

        await customClear(await conDialog.findElement(By.id("userName")));

        await driver.findElement(By.id("ok")).click();

        expect(await conDialog.findElement(By.css("label.error")).getText())
            .toBe("The user name must not be empty");

        expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

        await driver.findElement(By.id("cancel")).click();
    });

    it("Remove a database connection", async function () {
        await createDBconnection(driver, dbConfig);

        const host = await getDB(driver, dbConfig.caption);

        await driver.executeScript(
            "arguments[0].click();",
            await host.findElement(By.id("triggerTileAction")),
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
            async function () {
                return (await getDB(driver, dbConfig.caption)) === undefined;
            },
            2000,
            "DB still exists",
        );
    });

    describe("Database connections", function () {
        let query;

        beforeEach(async function () {
            query = "";
            await setCodeEditorLanguage(driver, "SQL");
            await driver.findElement(By.id("gui.sqleditor")).click();
            if (!(await getDB(driver, dbConfig.caption))) {
                await createDBconnection(driver, dbConfig);
            }
        });

        afterEach(async function () {
            if (query !== "") {
                await execMySQL(dbConfig, query);
            }
        });

        it("Connect to database and verify default schema", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

            const defaultSchema = await driver.findElement(
                By.css("#schemaSectionHost div.marked"),
            );

            expect(await defaultSchema.findElement(By.css("label")).getText()).toBe(dbConfig.schema);
        });

        it("Connection toolbar buttons - Execute selection or full block", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText())
                .toBe(dbConfig.caption);

            const contentHost = await driver.findElement(By.id("contentHost"));

            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("select * from sakila.actor");

            await (
                await getToolbarButton(driver, "Execute selection or full block")
            ).click();

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

            expect(
                (await contentHost.findElements(By.css(".editorPromptFirst"))).length,
            ).toBe(1);
        });

        it("Connection toolbar buttons - Execute selection or full block and create new block", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(
                dbConfig.caption,
            );

            const contentHost = await driver.findElement(By.id("contentHost"));

            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("select * from sakila.actor");

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

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

            expect(
                (await contentHost.findElements(By.css(".editorPromptFirst"))).length,
            ).toBe(2);
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText())
                .toBe(dbConfig.caption);

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await textArea.sendKeys("select * from sakila.actor;");

            await textArea.sendKeys(Key.RETURN);

            await textArea.sendKeys("select * from sakila.address;");

            await textArea.sendKeys(Key.RETURN);

            await textArea.sendKeys("select * from sakila.category;");

            await textArea.sendKeys(Key.ARROW_UP);

            await textArea.sendKeys(Key.ARROW_LEFT);

            await textArea.sendKeys(Key.ARROW_LEFT);

            await textArea.sendKeys(Key.ARROW_LEFT);

            await (
                await getToolbarButton(
                    driver,
                    "Execute the statement at the caret position",
                )
            ).click();

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

            await (
                await getToolbarButton(
                    driver,
                    "Execute the statement at the caret position",
                )
            ).click();

            resultSet = driver.wait(
                until.elementLocated(By.css(".resultHost .tabulator-headers")),
                1000);

            resultHeaderRows = await resultSet.findElements(
                By.css(".tabulator-col-title"),
            );

            expect(await resultHeaderRows[0].getText()).toBe("actor_id");

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await (
                await getToolbarButton(
                    driver,
                    "Execute the statement at the caret position",
                )
            ).click();

            resultSet = driver.wait(
                until.elementLocated(By.css(".resultHost .tabulator-headers")),
                1000);

            resultHeaderRows = await resultSet.findElements(
                By.css(".tabulator-col-title"),
            );

            expect(await resultHeaderRows[0].getText()).toBe("category_id");
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async function () {
            query = "DELETE from sakila.actor where first_name = 'ClientQA';";

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText())
                .toBe(dbConfig.caption);

            await (await getToolbarButton(driver, "Auto commit DB changes")).click();

            const contentHost = await driver.findElement(By.id("contentHost"));

            let textArea = await contentHost.findElement(By.css("textarea"));

            await textArea.sendKeys(
                "INSERT INTO sakila.actor (first_name, last_name) VALUES ('ClientQA','ClientQA')",
            );

            const commitBtn = await getToolbarButton(driver, "Commit DB changes");

            const rollBackBtn = await getToolbarButton(driver, "Rollback DB changes");

            expect(await commitBtn.isEnabled()).toBe(true);

            expect(await rollBackBtn.isEnabled()).toBe(true);

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

            expect(await getResultStatus(driver, 1)).toContain("OK");

            await rollBackBtn.click();

            textArea = (await contentHost.findElements(By.css("textarea")))[0];

            await textArea.sendKeys(
                "SELECT * FROM sakila.actor WHERE first_name='ClientQA';",
            );

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

            expect(await getResultStatus(driver, 2)).toContain(
                "OK, 0 records retrieved",
            );

            await textArea.sendKeys(
                "INSERT INTO sakila.actor (first_name, last_name) VALUES ('ClientQA','ClientQA')",
            );

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

            expect(await getResultStatus(driver, 3)).toContain("OK");

            await commitBtn.click();

            await textArea.sendKeys(
                "SELECT * FROM sakila.actor WHERE first_name='ClientQA';",
            );

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

            expect(await getResultStatus(driver, 4)).toContain(
                "OK, 1 record retrieved",
            );

            await (await getToolbarButton(driver, "Auto commit DB changes")).click();

            await driver.wait(
                async function () {
                    return (
                        (await commitBtn.isEnabled()) === false &&
                        (await rollBackBtn.isEnabled()) === false
                    );
                },
                5000,
                "Commit/Rollback DB changes button is still enabled ",
            );
        });

        it("Connection toolbar buttons - Find and Replace", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText())
                .toBe(dbConfig.caption);

            const contentHost = await driver.findElement(By.id("contentHost"));

            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("select from sakila sakila sakila");

            await (await getToolbarButton(driver, "Find")).click();

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

            await (await replacerGetButton(replacer, "Replace (Enter)")).click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toBe("select from tester sakila sakila");

            await replacer.findElement(By.css("textarea")).clear();

            await replacer.findElement(By.css("textarea")).sendKeys("testing");

            await (await replacerGetButton(replacer, "Replace All")).click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).toBe("select from tester testing testing");

            await closeFinder(finder);

            expect(await finder.getAttribute("aria-hidden")).toBe("true");
        });

        it("Expand/Collapse schema objects", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText())
                .toBe(dbConfig.caption);

            expect(
                await (
                    await getSchemaObject(driver, "Schema", "sakila")
                ).getAttribute("class"),
            ).toContain("expanded");

            await toggleSchemaObject(driver, "Tables", "Tables");

            expect(
                await (
                    await getSchemaObject(driver, "Tables", "Tables")
                ).getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject(driver, "obj", "actor")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "address")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "category")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "city")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "country")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "customer")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "film")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "film_actor")).toBeDefined();

            expect(
                await getSchemaObject(driver, "obj", "film_category"),
            ).toBeDefined();

            const scroll = await driver
                .findElement(By.id("schemaSectionHost"))
                .findElement(By.css(".tabulator-tableHolder"));

            await driver.executeScript("arguments[0].scrollBy(0,500)", scroll);

            expect(await getSchemaObject(driver, "obj", "film_text")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "inventory")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "language")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "payment")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "rental")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "staff")).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "store")).toBeDefined();

            await driver.executeScript("arguments[0].scrollBy(0,-500)", scroll);

            await toggleSchemaObject(driver, "Tables", "Tables");

            let attr = await (
                await getSchemaObject(driver, "Tables", "Tables")
            ).getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject(driver, "Views", "Views");

            expect(
                await (
                    await getSchemaObject(driver, "Views", "Views")
                ).getAttribute("class"),
            ).toContain("expanded");

            expect(await getSchemaObject(driver, "obj", "actor_info")).toBeDefined();

            expect(
                await getSchemaObject(driver, "obj", "customer_list"),
            ).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "film_list")).toBeDefined();

            expect(
                await getSchemaObject(driver, "obj", "nicer_but_slower_film_list"),
            ).toBeDefined();

            expect(
                await getSchemaObject(driver, "obj", "sales_by_film_category"),
            ).toBeDefined();

            expect(
                await getSchemaObject(driver, "obj", "sales_by_store"),
            ).toBeDefined();

            expect(await getSchemaObject(driver, "obj", "staff_list")).toBeDefined();

            await toggleSchemaObject(driver, "Views", "Views");

            attr = await (
                await getSchemaObject(driver, "Views", "Views")
            ).getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);

            await toggleSchemaObject(driver, "Schema", "sakila");

            attr = await (
                await getSchemaObject(driver, "Schema", "sakila")
            ).getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        });

        //TO FINISH
        it("Add/run JS script", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

            await addScript(driver, "JS");

            const context = await driver.findElement(By.id("scriptSectionHost"));

            expect(
                await context.findElement(By.css("div.content img")).getAttribute("src"),
            ).toContain("javascript");

            expect(
                await context.findElement(By.css("div.content span")).getText(),
            ).toBe("Script 1");

            expect(
                await driver
                    .findElement(By.css("div.editorHost > div"))
                    .getAttribute("data-mode-id"),
            ).toBe("javascript");

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
            ).toBe("Script 1");

            expect(
                await (await getOpenEditor(driver, "Script 1")).getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(driver, "Script 1"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("javascript");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Javascript')");

            await (
                await getToolbarButton(driver, "Execute selection or full script")
            ).click();
        });

        //TO FINISH
        it("Add/run TS script", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

            await addScript(driver, "TS");

            const context = await driver.findElement(By.id("scriptSectionHost"));

            expect(
                await context.findElement(By.css("div.content img")).getAttribute("src"),
            ).toContain("typescript");

            expect(
                await context.findElement(By.css("div.content span")).getText(),
            ).toBe("Script 1");

            expect(
                await driver
                    .findElement(By.css("div.editorHost > div"))
                    .getAttribute("data-mode-id"),
            ).toBe("typescript");

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("typescript");

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("label"))
                    .getText(),
            ).toBe("Script 1");

            expect(
                await (await getOpenEditor(driver, "Script 1")).getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(driver, "Script 1"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("typescript");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Typescript')");

            await (
                await getToolbarButton(driver, "Execute selection or full script")
            ).click();
        });

        it("Add/run SQL script", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(
                dbConfig.caption,
            );

            await addScript(driver, "SQL");

            const context = await driver.findElement(By.id("scriptSectionHost"));

            expect(
                await context.findElement(By.css("div.content img")).getAttribute("src"),
            ).toContain("mysql");

            expect(
                await context.findElement(By.css("div.content span")).getText(),
            ).toBe("Script 1");

            expect(
                await driver
                    .findElement(By.css("div.editorHost > div"))
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
            ).toBe("Script 1");

            expect(
                await (await getOpenEditor(driver, "Script 1")).getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(driver, "Script 1"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("mysql");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            await (
                await getToolbarButton(driver, "Execute selection or full script")
            ).click();

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
        });

        it("Switch between scripts", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

            await addScript(driver, "JS");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Javascript')");

            await addScript(driver, "TS");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Typescript')");

            await addScript(driver, "SQL");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            await selectCurrentEditor(driver, "Script 1", "javascript");

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("console.log('Hello Javascript')");

            await selectCurrentEditor(driver, "Script 2", "typescript");

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("console.log('Hello Typescript')");

            await selectCurrentEditor(driver, "Script 3", "mysql");

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("SELECT * FROM sakila.actor;");
        });

        it("Expand/Collapse menus", async function () {
            const expandCollapse = async (
                elToClick,
                elToVerify,
                visible,
                retries,
            ) => {
                if (retries === 3) {
                    throw "Error on expanding collapse";
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

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

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
                0,
            );

            await driver.wait(
                async function () {
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
                async function () {
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
                async function () {
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
                async function () {
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
                    .findElement(By.css(".accordionItem")),
                false,
                0,
            );

            await driver.wait(
                async function () {
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
                    .findElement(By.css(".accordionItem")),
                true,
                0,
            );

            await driver.wait(
                async function () {
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
        });

        it("Add a new console", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(dbConfig.caption);

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
                await driver
                    .findElement(By.id("contentHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("");

            await selectCurrentEditor(driver, "myNewConsole", "shell");

            const console = await getOpenEditor(driver, "myNewConsole");

            await console.findElement(By.css("span.codicon-close")).click();

            expect(await getOpenEditor(driver, "myNewConsole")).toBeUndefined();

            expect(
                await driver.findElement(By.css("#documentSelector label")).getText(),
            ).toBe("Standard Console");
        });

        it("Switch between search tabs", async function () {
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(
                dbConfig.caption,
            );

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await textArea.sendKeys(
                "select * from sakila.actor;select * from sakila.address;",
            );
            await driver.sleep(1000);
            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();

            const result1 = await getResultTab(driver, "Result 1");

            const result2 = await getResultTab(driver, "Result 2");

            expect(result1).toBeDefined();

            expect(result2).toBeDefined();

            expect( await getResultColumnName(driver, "actor_id") ).toBeDefined();

            expect( await getResultColumnName(driver, "first_name") ).toBeDefined();

            expect( await getResultColumnName(driver, "last_name") ).toBeDefined();

            expect( await getResultColumnName(driver, "last_update") ).toBeDefined();

            await result2.click();

            expect( await getResultColumnName(driver, "address_id") ).toBeDefined();

            expect( await getResultColumnName(driver, "address") ).toBeDefined();

            expect( await getResultColumnName(driver, "address2") ).toBeDefined();

            expect( await getResultColumnName(driver, "district") ).toBeDefined();

            expect( await getResultColumnName(driver, "city_id") ).toBeDefined();

            expect( await getResultColumnName(driver, "postal_code") ).toBeDefined();

            expect( await getResultColumnName(driver, "phone") ).toBeDefined();

            await result1.click();

            expect( await getResultColumnName(driver, "actor_id") ).toBeDefined();

            expect( await getResultColumnName(driver, "first_name") ).toBeDefined();

            expect( await getResultColumnName(driver, "last_name") ).toBeDefined();

            expect( await getResultColumnName(driver, "last_update") ).toBeDefined();
        });

        it("Standard functions", async function (){
            await driver.executeScript(
                "arguments[0].click();",
                await getDB(driver, dbConfig.caption),
            );

            expect(await (await getConnectionTab(driver, 1)).getText()).toBe(
                dbConfig.caption,
            );

            const contentHost = await driver.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await textArea.sendKeys(
                "Math.random();",
            );

            await (
                await getToolbarButton(
                    driver,
                    "Execute selection or full block and create a new block",
                )
            ).click();
        });

    });
});
