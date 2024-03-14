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
import { Misc, explicitWait, shellServers } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { basename, join } from "path";
import { platform } from "os";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { DialogHelper } from "../../lib/dialogHelper.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Database Connections", () => {

    let testFailed = false;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `connDBConnections`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: "dbuser1",
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: "dbuser1",
        },
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
            await DBNotebooks.createDataBaseConnection(globalConn);
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
            const host = await DBNotebooks.getConnection(globalConn.caption!);
            await DBNotebooks.clickConnectionItem(host!, "duplicate");
            const duplicateConnection = Object.assign({}, globalConn);
            duplicateConnection.caption = "DuplicatedConnection";
            duplicateConnection.description = "my other connection";
            await DBNotebooks.setConnection(duplicateConnection);
            const conn = await DBNotebooks.getConnection(duplicateConnection.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnections.description).getText())
                .toBe(duplicateConnection.description);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a database connection", async () => {
        try {
            const editedConnection = Object.assign({}, globalConn);
            editedConnection.caption = "editedConnection";
            editedConnection.description = "new description";

            await DBNotebooks.createDataBaseConnection(editedConnection);
            const host = await DBNotebooks.getConnection(editedConnection.caption);
            await DBNotebooks.clickConnectionItem(host!, "edit");
            await DBNotebooks.setConnection(editedConnection);
            const conn = await DBNotebooks.getConnection(editedConnection.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnections.description).getText())
                .toBe(editedConnection.description);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("MySQL - Verify mandatory fields", async () => {
        try {
            await driver.findElement(locator.dbConnections.newConnection).click();

            const conDialog = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.exists),
                constants.wait5seconds, "Connection dialog was not displayed");

            const caption = await conDialog.findElement(locator.databaseConnectionConfiguration.caption);
            const hostname = await conDialog.findElement(locator.databaseConnectionConfiguration.mysql.basic.hostname);
            await DialogHelper.clearInputField(caption);
            await DialogHelper.clearInputField(hostname);

            await conDialog.findElement(locator.databaseConnectionConfiguration.ok).click();
            await driver.wait(async () => {
                return (await conDialog.findElements(locator.databaseConnectionConfiguration.errors)).length > 0;
            }, constants.wait5seconds, "The DB Connection dialog should have errors");

            const dialogErrors = await conDialog.findElements(locator.databaseConnectionConfiguration.errors);
            const errorMsgs = await Promise.all(
                dialogErrors.map((item: WebElement) => {
                    return item.getText();
                }));
            expect(errorMsgs).toContain("The user name must not be empty");
            expect(await caption.getAttribute("value")).toContain("New Connection");
            expect(await hostname.getAttribute("value")).toBe("localhost");
            await conDialog.findElement(locator.databaseConnectionConfiguration.cancel).click();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("SQLite - Verify mandatory fields", async () => {
        await driver.findElement(locator.dbConnections.newConnection).click();
        const conDialog = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.exists),
            constants.wait5seconds, "Connection dialog was not displayed");
        await conDialog.findElement(locator.databaseConnectionConfiguration.databaseType.exists).click();
        const popup = await driver.wait(until.elementLocated(locator.databaseConnectionConfiguration.databaseType.list),
            constants.wait5seconds, "Database type popup was not found");
        await popup.findElement(locator.databaseConnectionConfiguration.databaseType.databaseTypeSqlite).click();
        const caption = await conDialog.findElement(locator.databaseConnectionConfiguration.caption);
        await DialogHelper.clearInputField(caption);
        await conDialog.findElement(locator.databaseConnectionConfiguration.ok).click();
        await driver.wait(async () => {
            return (await conDialog.findElements(locator.databaseConnectionConfiguration.errors)).length > 0;
        }, constants.wait5seconds, "The DB Connection dialog should have errors");
        const dialogErrors = await conDialog.findElements(locator.databaseConnectionConfiguration.errors);
        const errorMsgs = await Promise.all(
            dialogErrors.map((item: WebElement) => {
                return item.getText();
            }));
        expect(await caption.getAttribute("value")).toContain("New Connection");
        expect(errorMsgs).toContain("Specify the path to an existing Sqlite DB file");
        await conDialog.findElement(locator.databaseConnectionConfiguration.cancel).click();
    });

    it("Remove a database connection", async () => {
        const localConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `conn${new Date().valueOf()}`,
            description: "Local connection",
            basic: {
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: String(process.env.DBUSERNAME),
                port: parseInt(process.env.DBPORT!, 10),
                portX: parseInt(process.env.DBPORTX!, 10),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
            },
        };
        try {
            await DBNotebooks.createDataBaseConnection(localConn);
            const host = await DBNotebooks.getConnection(localConn.caption!);
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
                        .existsByCaption(localConn.caption!))).length === 0;
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
        const sqliteConn: interfaces.IDBConnection = {
            dbType: "Sqlite",
            caption: `Sqlite DB${String(new Date().valueOf())}`,
            description: "Local connection",
            basic: {
                dbName: "SQLite",
                dbPath: join(process.cwd(), "src", "tests", "e2e",
                    `port_800${String(shellServers.get(basename(__filename)))}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
            },
        };

        try {
            await DBNotebooks.createDataBaseConnection(sqliteConn);
            const conn = await DBNotebooks.getConnection(sqliteConn.caption!);
            expect(conn).toBeDefined();
            await driver.executeScript("arguments[0].click();", conn);
            expect(await DBConnection.getSelectedConnectionTab()).toBe(sqliteConn.caption);
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
        const sslConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `sslConnection`,
            description: "Local connection",
            basic: {
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: "dbuser1",
                port: parseInt(process.env.DBPORT!, 10),
                portX: parseInt(process.env.DBPORTX!, 10),
                schema: "sakila",
                password: "dbuser1",
            },
            ssl: {
                mode: "Require and Verify CA",
                caPath: `${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`,
                clientCertPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`,
                clientKeyPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`,
            },
        };
        try {
            await DBNotebooks.createDataBaseConnection(sslConn);
            const conn = await DBNotebooks.getConnection(sslConn.caption!);
            await driver.executeScript("arguments[0].click();", conn);

            try {
                await Misc.setPassword(globalConn);
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
                //continue
            }

            expect(await DBConnection.getSelectedConnectionTab()).toBe(sslConn.caption);
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
