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

import { Key, WebElement, until } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, explicitWait, shellServers } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { basename, join } from "path";
import { platform } from "os";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import { driver, loadDriver } from "../../lib/driver.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

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

            await driver.findElement(locator.sqlEditorPage.icon).click();
            await DBNotebooks.createDBconnection(globalConn);
            await driver.findElement(locator.databaseConnectionConfiguration.close).click();
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
        await driver.close();
        await driver.quit();
    });

    it("Duplicate a database connection", async () => {
        try {
            const host = await DBNotebooks.getConnection(globalConn.caption);
            await DBNotebooks.clickConnectionItem(host!, "duplicate");
            const conDialog = await driver.findElement(locator.databaseConnectionConfiguration.exists);

            await driver.wait(async () => {
                await conDialog.findElement(locator.databaseConnectionConfiguration.caption).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const dup = `Dup${String(Math.floor(Math.random() * 100))}`;
            await conDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys(dup);
            await conDialog.findElement(locator.databaseConnectionConfiguration.description).clear();
            await conDialog
                .findElement(locator.databaseConnectionConfiguration.description)
                .sendKeys("my other connection");

            const okBtn = await driver.findElement(locator.databaseConnectionConfiguration.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(locator.databaseConnectionConfiguration.exists)).length).toBe(0);
            const conn = await DBNotebooks.getConnection(dup);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnections.description).getText())
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
            let conDialog = await driver.findElement(locator.databaseConnectionConfiguration.exists);

            await driver.wait(async () => {
                await conDialog.findElement(locator.databaseConnectionConfiguration.caption).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `Wex${String(Math.floor(Math.random() * 100))}`;
            await conDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys(conName);
            await conDialog.findElement(locator.databaseConnectionConfiguration.description).clear();
            await conDialog
                .findElement(locator.databaseConnectionConfiguration.description)
                .sendKeys("Another description");

            await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname).clear();
            await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname)
                .sendKeys("1.1.1.1");
            await DBNotebooks.setProtocol("mysqlx");

            expect(await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.protocol.exists)
                .getText()).toBe("mysqlx");

            let okBtn = await driver.findElement(locator.databaseConnectionConfiguration.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            expect((await driver.findElements(locator.databaseConnectionConfiguration.exists)).length).toBe(0);
            const conn = await DBNotebooks.getConnection(conName);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnections.description).getText())
                .toBe("Another description");

            host = await DBNotebooks.getConnection(conName);
            await DBNotebooks.clickConnectionItem(host!, "edit");
            conDialog = await driver.findElement(locator.databaseConnectionConfiguration.exists);
            expect(
                await conDialog
                    .findElement(locator.databaseConnectionConfiguration.databaseType.exists)
                    .findElement(locator.htmlTag.label)
                    .getText(),
            ).toBe("MySQL");
            expect(
                await conDialog.findElement(locator.databaseConnectionConfiguration.caption).getAttribute("value"),
            ).toBe(conName);
            expect(
                await conDialog.findElement(locator.databaseConnectionConfiguration.description).getAttribute("value"),
            ).toBe("Another description");

            expect(await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.protocol.exists)
                .getText()).toBe("mysqlx");

            expect(
                await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname)
                    .getAttribute("value"),
            ).toBe("1.1.1.1");

            okBtn = await driver.findElement(locator.databaseConnectionConfiguration.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            expect((await driver.findElements(locator.databaseConnectionConfiguration.exists)).length).toBe(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a database connection and verify issues", async () => {
        try {
            const host = await DBNotebooks.getConnection(globalConn.caption);
            await DBNotebooks.clickConnectionItem(host!, "edit");
            const conDialog = await driver.findElement(locator.databaseConnectionConfiguration.exists);
            const customClear = async (el: WebElement) => {
                const textLength = (await el.getAttribute("value")).length;
                for (let i = 0; i <= textLength - 1; i++) {
                    await el.sendKeys(Key.BACK_SPACE);
                    await driver.sleep(100);
                }
            };

            await customClear(await conDialog.findElement(locator.databaseConnectionConfiguration.caption));
            const okBtn = await conDialog.findElement(locator.databaseConnectionConfiguration.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const error = await driver.wait(
                until.elementLocated(locator.databaseConnectionConfiguration.errors),
                2000,
            );

            expect(await error.getText()).toBe("The caption cannot be empty");
            await conDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys("WexQA");
            await customClear(await conDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            expect(await conDialog.findElement(locator.databaseConnectionConfiguration.errors).getText())
                .toBe("Specify a valid host name or IP address");
            await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname)
                .sendKeys("1.1.1.1");
            await customClear(await conDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.username));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(locator.databaseConnectionConfiguration.ok).click();
            expect(await conDialog.findElement(locator.databaseConnectionConfiguration.errors).getText())
                .toBe("The user name must not be empty");
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(locator.databaseConnectionConfiguration.cancel).click();
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
            const dialog = await driver.findElement(locator.confirmDialog.exists);
            expect(dialog).toBeDefined();
            await driver.executeScript(
                "arguments[0].click();",
                await dialog.findElement(locator.confirmDialog.accept),
            );
            await driver.wait(
                async () => {
                    return (await driver.findElements(locator.dbConnections
                        .existsByCaption(localConn.caption))).length === 0;
                },
                2000,
                `${localConn.caption} Database Connection still exists`,
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to SQLite database", async () => {
        try {
            const connBrowser = await driver.wait(until.elementLocated(locator.dbConnections.browser),
                explicitWait, "Connection browser was not found");
            await connBrowser.findElement(locator.dbConnections.newConnection).click();

            const newConDialog = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.exists),
                explicitWait, "Dialog was not displayed");
            await DBNotebooks.selectDBType("Sqlite");
            await driver.wait(async () => {
                await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).clear();

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

            await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys(localConn.caption);

            await newConDialog.findElement(locator.databaseConnectionConfiguration.description).clear();
            await newConDialog
                .findElement(locator.databaseConnectionConfiguration.description)
                .sendKeys("Local Sqlite connection");

            const dbPath = await driver.findElement(locator.databaseConnectionConfiguration.sqlite.basic.dbFilePath);
            let sqlitePath = join(process.cwd(), "src", "tests", "e2e",
                `port_800${String(shellServers.get(basename(__filename)))}`,
                "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");

            if (!(await Misc.fileExists(sqlitePath))) {
                sqlitePath = String(process.env.SQLITE_PATH_FILE);
            }

            await dbPath.sendKeys(sqlitePath);
            await newConDialog.findElement(locator.databaseConnectionConfiguration.sqlite.basic.dbName)
                .sendKeys("SQLite");
            await newConDialog.findElement(locator.databaseConnectionConfiguration.ok).click();
            const conn = await DBNotebooks.getConnection(localConn.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnections.description).getText()).toBe(
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
                    await tables!.findElement(locator.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await Misc.cleanPrompt();
            const table = await DBConnection.getSchemaObject("obj", "db_connection");
            await driver.wait(async () => {
                await driver
                    .actions()
                    .contextClick(table)
                    .perform();

                return (await driver.findElements(locator.treeContextMenu.exists)).length > 0;
            }, 4000, "Context menu was not opened");

            await driver.findElement(locator.treeContextMenu.selectRows).click();

            const commandExecutor = new CommandExecutor();
            await commandExecutor.loadLastExistingCommandResult();
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Connect to MySQL database using SSL", async () => {
        try {
            const connBrowser = await driver.wait(until.elementLocated(locator.dbConnections.browser),
                explicitWait, "Connection browser was not found");

            await connBrowser.findElement(locator.dbConnections.newConnection).click();
            const newConDialog = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.exists),
                explicitWait, "Dialog was not displayed");
            await driver.wait(async () => {
                await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `SSL Connection${String(Math.floor(Math.random() * 100))}`;
            await newConDialog.findElement(locator.databaseConnectionConfiguration.caption).sendKeys(conName);
            await newConDialog.findElement(locator.databaseConnectionConfiguration.description).clear();
            await newConDialog
                .findElement(locator.databaseConnectionConfiguration.description)
                .sendKeys("New SSL Connection");

            await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname).clear();

            await newConDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname)
                .sendKeys(String(globalConn.hostname));

            await newConDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.username)
                .sendKeys(String(globalConn.username));

            await newConDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.schema)
                .sendKeys(String(globalConn.schema));

            await driver.findElement(locator.databaseConnectionConfiguration.mysql.basic.port).clear();
            await driver.findElement(locator.databaseConnectionConfiguration.mysql.basic.port)
                .sendKeys(String(globalConn.port));

            await newConDialog.findElement(locator.databaseConnectionConfiguration.sslTab).click();
            await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.ssl.mode).click();
            const dropDownList = await driver
                .findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeList.exists);
            await dropDownList
                .findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeList.requireAndVerifyCA).click();
            expect(await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.ssl.modeLabel)
                .getText()).toBe("Require and Verify CA");

            const sslCaFile = await driver.findElement(locator.databaseConnectionConfiguration.mysql.ssl.ca);
            const sslCertFile = await driver.findElement(locator.databaseConnectionConfiguration.mysql.ssl.cert);
            const sslKeyFile = await driver.findElement(locator.databaseConnectionConfiguration.mysql.ssl.key);
            await sslCaFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`);
            await sslCertFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`);
            await sslKeyFile.sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`);
            const okBtn = await driver.findElement(locator.databaseConnectionConfiguration.ok);
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
            const cmdExecutor = new CommandExecutor();
            await cmdExecutor.execute(query);
            expect(cmdExecutor.getResultMessage()).toMatch(/1 record retrieved/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy, cut paste into the DB Connection dialog", async () => {
        try {
            const browser = await driver.wait(until.elementLocated(locator.dbConnections.browser),
                explicitWait, "DB Connection Overview page was not loaded");

            await browser.findElement(locator.dbConnections.newConnection).click();
            const newConDialog = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.exists),
                explicitWait);
            const hostname = await newConDialog
                .findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname);
            const hostnameValue = await hostname.getAttribute("value");
            await hostname.click();
            if (platform() === "darwin") {
                await hostname.sendKeys(Key.chord(Key.COMMAND, "a"));
                await hostname.sendKeys(Key.chord(Key.COMMAND, "c"));
            } else {
                await hostname.sendKeys(Key.chord(Key.CONTROL, "a"));
                await hostname.sendKeys(Key.chord(Key.CONTROL, "c"));
            }

            const inputCaption = await newConDialog.findElement(locator.databaseConnectionConfiguration.caption);

            await driver.wait(async () => {
                await inputCaption.clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");
            if (platform() === "darwin") {
                await inputCaption.sendKeys(Key.chord(Key.COMMAND, "v"));
            } else {
                await inputCaption.sendKeys(Key.chord(Key.CONTROL, "v"));
            }

            const newValue = await inputCaption.getAttribute("value");
            expect(newValue).toBe(hostnameValue);
            const valueToCut = await inputCaption.getAttribute("value");

            if (platform() === "darwin") {
                await hostname.sendKeys(Key.chord(Key.COMMAND, "a"));
                await hostname.sendKeys(Key.chord(Key.COMMAND, "x"));
            } else {
                await hostname.sendKeys(Key.chord(Key.CONTROL, "a"));
                await hostname.sendKeys(Key.chord(Key.CONTROL, "x"));
            }

            expect(await (await newConDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname))
                .getAttribute("value")).toBe("");

            const description = await newConDialog
                .findElement(locator.databaseConnectionConfiguration.description);
            await description.click();

            if (platform() === "darwin") {
                await description.sendKeys(Key.chord(Key.COMMAND, "v"));
            } else {
                await description.sendKeys(Key.chord(Key.CONTROL, "v"));
            }

            expect(await description.getAttribute("value")).toContain(valueToCut);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
