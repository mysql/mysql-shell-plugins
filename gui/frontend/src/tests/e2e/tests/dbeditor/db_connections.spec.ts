/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { By, Key, WebElement, until } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, driver, explicitWait, shellServers } from "../../lib/misc.js";
import { basename, join } from "path";

describe("Database Connections", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `connDBConnections`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser1",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser1",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            const filename = basename(__filename);
            await driver.wait(async () => {
                try {
                    const url = Misc.getUrl(basename(filename));
                    console.log(`${filename} : ${url}`);
                    await Misc.loadPage(url);
                    await Misc.waitForHomePage();
                    await driver.findElement(By.id("gui.sqleditor")).click();

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 3, "Start Page was not loaded correctly");

            await DBNotebooks.createDBconnection(globalConn);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_DBConnections");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }

        if (!await DBConnection.isConnectionOverviewOpened()) {
            await DBConnection.closeDBconnection("current");
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });

    it("Duplicate a database connection", async () => {
        try {
            const host = await DBNotebooks.getConnection(globalConn.caption);

            await DBNotebooks.clickConnectionItem(host!, "duplicate");

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

            const conn = await DBNotebooks.getConnection(dup);

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

            let host = await DBNotebooks.createDBconnection(localConn);

            await DBNotebooks.clickConnectionItem(host!, "edit");

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

            await DBNotebooks.setProtocol("mysqlx");

            expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

            let okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

            const conn = await DBNotebooks.getConnection(conName);

            expect(conn).toBeDefined();

            expect(await conn!.findElement(By.css(".tileDescription")).getText())
                .toBe("Another description");

            host = await DBNotebooks.getConnection(conName);

            await DBNotebooks.clickConnectionItem(host!, "edit");

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

    it("Edit a database connection and verify issues", async () => {
        try {

            const host = await DBNotebooks.getConnection(globalConn.caption);

            await DBNotebooks.clickConnectionItem(host!, "edit");

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
                until.elementLocated(By.css(".message.error")),
                2000,
            );

            expect(await error.getText()).toBe("The caption cannot be empty");

            await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

            await customClear(await conDialog.findElement(By.id("hostName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect(await conDialog.findElement(By.css(".message.error")).getText())
                .toBe("Specify a valid host name or IP address");

            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

            await customClear(await conDialog.findElement(By.id("userName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(By.id("ok")).click();

            expect(await conDialog.findElement(By.css(".message.error")).getText())
                .toBe("The user name must not be empty");

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);

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

            const host = await DBNotebooks.createDBconnection(localConn);

            await DBNotebooks.clickConnectionItem(host!, "remove");

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
                `${localConn.caption} DB still exists`,
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
            await DBNotebooks.selectDBType("Sqlite");
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

            const dbPath = await driver.findElement(By.id("dbFilePath"));
            let sqlitePath = join(process.cwd(), "src", "tests", "e2e",
                `port_800${String(shellServers.get(basename(__filename)))}`,
                "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");

            if (!(await Misc.fileExists(sqlitePath))) {
                sqlitePath = String(process.env.SQLITE_PATH_FILE);
            }

            await dbPath.sendKeys(sqlitePath);
            await newConDialog.findElement(By.id("dbName")).sendKeys("SQLite");
            await newConDialog.findElement(By.id("ok")).click();

            const conn = await DBNotebooks.getConnection(localConn.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(By.css(".tileDescription")).getText()).toBe(
                "Local Sqlite connection",
            );

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            expect(await DBConnection.getSelectedConnectionTab()).toBe(localConn.caption);

            await DBConnection.toggleSchemaObject("Schema", "main");

            const main = await DBConnection.getSchemaObject("Schema", "main");
            const attr = await main!.getAttribute("class");
            expect(attr.split(" ").includes("expanded")).toBe(true);

            await DBConnection.toggleSchemaObject("Tables", "Tables");

            const tables = await DBConnection.getSchemaObject("Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            await Misc.cleanPrompt();

            const table = await DBConnection.getSchemaObject("obj", "db_connection");

            await driver.wait(async () => {
                await driver
                    .actions()
                    .contextClick(table)
                    .perform();

                return (await driver.findElements(By.css(".noArrow.menu"))).length > 0;
            }, 4000, "Context menu was not opened");

            await driver.findElement(By.id("selectRowsMenuItem")).click();

            expect(await DBConnection.getResultStatus(true)).toContain("OK");

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

            await driver.findElement(By.css("#port input")).clear();
            await driver.findElement(By.css("#port input")).sendKeys(String(globalConn.port));

            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id("Require and Verify CA")).click();
            expect(await newConDialog.findElement(By.css("#sslMode label"))
                .getText()).toBe("Require and Verify CA");

            const sslCaFile = await driver.findElement(By.id("sslCaFile"));
            const sslCertFile = await driver.findElement(By.id("sslCertFile"));
            const sslKeyFile = await driver.findElement(By.id("sslKeyFile"));

            await sslCaFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`);
            await sslCertFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`);
            await sslKeyFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`);

            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const conn = await DBNotebooks.getConnection(conName);

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            try {
                await Misc.setPassword(globalConn);
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
                //continue
            }

            expect(await DBConnection.getSelectedConnectionTab()).toBe(conName);

            await DBConnection.setEditorLanguage("mysql");

            let query = `select * from performance_schema.session_status where variable_name in `;
            query += `("ssl_cipher") and variable_value like "%TLS%"`;

            await Misc.execCmd(await driver.findElement(By.css("textarea")), query, undefined, true, true);

            const resultHost = await driver.wait(until.elementLocated(By.css(".resultHost")),
                explicitWait, "Result host was not found");

            const result = await driver.wait(until.elementLocated(async () => {
                return resultHost.findElements(By.css(".resultStatus label"));
            }), explicitWait, "Label not found");

            expect(await result.getText()).toContain("1 record retrieved");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
