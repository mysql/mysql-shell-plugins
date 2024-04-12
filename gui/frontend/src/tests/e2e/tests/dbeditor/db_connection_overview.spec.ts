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
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { Misc, shellServers } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { basename, join } from "path";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { DialogHelper } from "../../lib/dialogHelper.js";
import * as waitUntil from "../../lib/until.js";
import { Os } from "../../lib/os.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { DatabaseConnectionDialog } from "../../lib/databaseConnectionDialog.js";

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
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, constants.wait20seconds, "Home Page was not loaded");

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

        if (!await DatabaseConnectionOverview.isOpened()) {
            await DBNotebooks.closeNotebook("current");
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Duplicate a database connection", async () => {
        try {
            await DatabaseConnectionOverview.moreActions(globalConn.caption!, constants.dupConnection);
            const duplicateConnection = Object.assign({}, globalConn);
            duplicateConnection.caption = "DuplicatedConnection";
            duplicateConnection.description = "my other connection";
            await DatabaseConnectionDialog.setConnection(duplicateConnection);
            const conn = await DBNotebooks.getConnection(duplicateConnection.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(locator.dbConnectionOverview.dbConnection.description).getText())
                .toBe(duplicateConnection.description);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a MySQL connection", async () => {
        try {
            const editConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: `connectionToEdit`,
                description: "Local connection",
                basic: {
                    hostname: String(process.env.DBHOSTNAME),
                    username: String(process.env.DBUSERNAME),
                    port: Number(process.env.DBPORT),
                    schema: "sakila",
                    password: String(process.env.DBPASSWORD),
                },
            };

            await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
            await DatabaseConnectionDialog.setConnection(editConn);
            await DatabaseConnectionOverview.moreActions(editConn.caption!, constants.editConnection);
            editConn.caption = "edited caption";
            editConn.description = "edited description";
            if (interfaces.isMySQLConnection(editConn.basic)) {
                editConn.basic.hostname = "hostname edited";
                editConn.basic.username = "username edited";
                editConn.basic.schema = "edited schema";
                editConn.basic.protocol = "mysqlx";
                editConn.basic.port = 3305;
                editConn.basic.sshTunnel = true;
                editConn.basic.ociBastion = false;
                editConn.ssl = {
                    mode: "Require",
                    ciphers: "ciphers, edited",
                    caPath: "ca edited",
                    clientCertPath: "cert edited",
                    clientKeyPath: "key edited",
                };
                editConn.ssh = {
                    uri: "edited uri",
                    privateKey: "edited private key",
                    customPath: "edited custom path",
                };
                editConn.advanced = {
                    // bug : https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=36482559
                    /*mode: {
                        ansi: true,
                        traditional: true,
                        allowInvalidDates: true,
                        ansiQuotes: true,
                        errorForDivisionByZero: true,
                        highNotPrecedence: true,
                        ignoreSpace: true,
                        noAutoValueOnZero: true,
                        noUnsignedSubtraction: true,
                        noZeroDate: true,
                        noZeroInDate: true,
                        onlyFullGroupBy: true,
                        padCharToFullLength: true,
                        pipesAsConcat: true,
                        realAsFloat: true,
                        strictAllTables: true,
                        strictTransTables: true,
                        timeTruncateFractional: true,
                    },
                    timeout: "5",*/
                    mode: {
                        ansi: false,
                        traditional: false,
                        allowInvalidDates: false,
                        ansiQuotes: false,
                        errorForDivisionByZero: false,
                        highNotPrecedence: false,
                        ignoreSpace: false,
                        noAutoValueOnZero: false,
                        noUnsignedSubtraction: false,
                        noZeroDate: false,
                        noZeroInDate: false,
                        onlyFullGroupBy: false,
                        padCharToFullLength: false,
                        pipesAsConcat: false,
                        realAsFloat: false,
                        strictAllTables: false,
                        strictTransTables: false,
                        timeTruncateFractional: false,
                    },
                    timeout: "0",
                    compression: "Required",
                    compressionLevel: "5",
                    disableHeatWave: true,
                };
            }
            delete (editConn.basic as interfaces.IConnBasicMySQL).password;
            await DatabaseConnectionDialog.setConnection(editConn);
            await DatabaseConnectionOverview.moreActions(editConn.caption, constants.editConnection);
            const verifyConn = await DatabaseConnectionDialog.getConnectionDetails(editConn.caption);
            expect(verifyConn).toStrictEqual(editConn);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("MySQL - Verify mandatory fields", async () => {
        try {
            await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();

            const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.wait5seconds, "Connection dialog was not displayed");

            const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
            const hostname = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
            await DialogHelper.clearInputField(caption);
            await DialogHelper.clearInputField(hostname);

            await conDialog.findElement(locator.dbConnectionDialog.ok).click();
            await driver.wait(async () => {
                return (await conDialog.findElements(locator.dbConnectionDialog.errorMessage)).length > 0;
            }, constants.wait5seconds, "The DB Connection dialog should have errors");

            const dialogErrors = await conDialog.findElements(locator.dbConnectionDialog.errorMessage);
            const errorMsgs = await Promise.all(
                dialogErrors.map((item: WebElement) => {
                    return item.getText();
                }));
            expect(errorMsgs).toContain("The user name must not be empty");
            expect(await caption.getAttribute("value")).toContain("New Connection");
            expect(await hostname.getAttribute("value")).toBe("localhost");
            await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("SQLite - Verify mandatory fields", async () => {
        try {
            await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
            const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.wait5seconds, "Connection dialog was not displayed");
            await conDialog.findElement(locator.dbConnectionDialog.databaseType).click();
            const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                constants.wait5seconds, "Database type popup was not found");
            await popup.findElement(locator.dbConnectionDialog.databaseTypeSqlite).click();
            const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
            await DialogHelper.clearInputField(caption);
            await conDialog.findElement(locator.dbConnectionDialog.ok).click();
            await driver.wait(async () => {
                return (await conDialog.findElements(locator.dbConnectionDialog.errorMessage)).length > 0;
            }, constants.wait5seconds, "The DB Connection dialog should have errors");
            const dialogErrors = await conDialog.findElements(locator.dbConnectionDialog.errorMessage);
            const errorMsgs = await Promise.all(
                dialogErrors.map((item: WebElement) => {
                    return item.getText();
                }));
            expect(await caption.getAttribute("value")).toContain("New Connection");
            expect(errorMsgs).toContain("Specify the path to an existing Sqlite DB file");
            await conDialog.findElement(locator.dbConnectionDialog.cancel).click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Remove a database connection", async () => {
        const localConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `connectionToRemove`,
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
            await DatabaseConnectionOverview.moreActions(localConn.caption!, constants.removeConnection);
            const dialog = await driver.findElement(locator.confirmDialog.exists);
            expect(dialog).toBeDefined();
            await driver.executeScript(
                "arguments[0].click();",
                await dialog.findElement(locator.confirmDialog.accept),
            );
            await driver.wait(waitUntil.dbConnectionDoesNotExist(localConn.caption!), constants.wait5seconds);
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
            expect(await DatabaseConnectionOverview.getSelectedTab()).toBe(sqliteConn.caption);
            await DBNotebooks.toggleSchemaObject("Schema", "main");
            const main = await DBNotebooks.getSchemaObject("Schema", "main");
            const attr = await main!.getAttribute("class");
            expect(attr.split(" ").includes("expanded")).toBe(true);
            await DBNotebooks.toggleSchemaObject("Tables", "Tables");
            const tables = await DBNotebooks.getSchemaObject("Tables", "Tables");
            expect(
                await (
                    await tables!.findElement(locator.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await DBNotebooks.cleanPrompt();
            const table = await DBNotebooks.getSchemaObject("obj", "db_connection");
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
            await driver.wait(waitUntil.dbConnectionIsOpened(sslConn), constants.wait10seconds);
            expect(await DatabaseConnectionOverview.getSelectedTab()).toBe(sslConn.caption);
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
            const browser = await driver.wait(until.elementLocated(locator.dbConnectionOverview.browser),
                constants.wait5seconds, "DB Connection Overview page was not loaded");

            await browser.findElement(locator.dbConnectionOverview.newDBConnection).click();
            const newConDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.wait5seconds);
            const hostname = await newConDialog
                .findElement(locator.dbConnectionDialog.mysql.basic.hostname);
            const hostnameValue = await hostname.getAttribute("value");
            await hostname.click();
            if (Os.isMacOs()) {
                await hostname.sendKeys(Key.chord(Key.COMMAND, "a"));
                await hostname.sendKeys(Key.chord(Key.COMMAND, "c"));
            } else {
                await hostname.sendKeys(Key.chord(Key.CONTROL, "a"));
                await hostname.sendKeys(Key.chord(Key.CONTROL, "c"));
            }

            const inputCaption = await newConDialog.findElement(locator.dbConnectionDialog.caption);

            await driver.wait(async () => {
                await inputCaption.clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");
            if (Os.isMacOs()) {
                await inputCaption.sendKeys(Key.chord(Key.COMMAND, "v"));
            } else {
                await inputCaption.sendKeys(Key.chord(Key.CONTROL, "v"));
            }

            const newValue = await inputCaption.getAttribute("value");
            expect(newValue).toBe(hostnameValue);
            const valueToCut = await inputCaption.getAttribute("value");

            if (Os.isMacOs()) {
                await hostname.sendKeys(Key.chord(Key.COMMAND, "a"));
                await hostname.sendKeys(Key.chord(Key.COMMAND, "x"));
            } else {
                await hostname.sendKeys(Key.chord(Key.CONTROL, "a"));
                await hostname.sendKeys(Key.chord(Key.CONTROL, "x"));
            }

            expect(await (await newConDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname))
                .getAttribute("value")).toBe("");

            const description = await newConDialog
                .findElement(locator.dbConnectionDialog.description);
            await description.click();

            if (Os.isMacOs()) {
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
