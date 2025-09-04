/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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

/* eslint-disable no-restricted-syntax */

import { existsSync } from "fs";
import * as fs from "fs/promises";
import { basename, join } from "path";
import { Condition, until, WebElement } from "selenium-webdriver";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, TestContext } from "vitest";
import * as allure from "allure-js-commons";
import { E2ECommandResultData } from "../lib/CommandResults/E2ECommandResultData.js";
import { E2ECommandResultGrid } from "../lib/CommandResults/E2ECommandResultGrid.js";
import { ConfirmDialog } from "../lib/Dialogs/ConfirmationDialog.js";
import { DatabaseConnectionDialog } from "../lib/Dialogs/DatabaseConnectionDialog.js";
import { DialogHelper } from "../lib/Dialogs/DialogHelper.js";
import { FolderDialog } from "../lib/Dialogs/FolderDialog.js";
import { PasswordDialog } from "../lib/Dialogs/PasswordDialog.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2EScript } from "../lib/E2EScript.js";
import { E2ESettings } from "../lib/E2ESettings.js";
import { E2EShellConsole } from "../lib/E2EShellConsole.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { E2EToolbar } from "../lib/E2EToolbar.js";
import { E2EMySQLAdministration } from "../lib/MySQLAdministration/E2EMySQLAdministration.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { E2ETreeItem } from "../lib/SideBar/E2ETreeItem.js";
import { E2EWorkbench } from "../lib/SideBar/E2EWorkbench.js";
import * as constants from "../lib/constants.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2EObjectStorageBrowserError } from "../lib/errors/E2EObjectStorageBrowserError.js";
import * as interfaces from "../lib/interfaces.js";
import * as locator from "../lib/locators.js";
import { Misc, shellServers } from "../lib/misc.js";
import { Os } from "../lib/os.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));
const testView = `test_view`;
const testEvent = "test_event";
const testProcedure = "test_procedure";
const testFunction = "test_function";

describe("DATABASE CONNECTIONS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `E2E - DATABASE CONNECTIONS`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(globalThis.testConfig!.DBUSERNAME1),
            port: parseInt(String(globalThis.testConfig!.MYSQL_PORT), 10),
            schema: "sakila",
            password: String(globalThis.testConfig!.DBUSERNAME1PWD),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    beforeAll(async () => {

        await loadDriver(true);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(url), constants.wait20seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();
            await dbTreeSection.focus();
        } catch (e) {
            await Misc.storeScreenShot(undefined, "beforeAll_DATABASE_CONNECTIONS");
            allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
            throw e;
        }

    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    describe("Toolbar", () => {

        let testFailed = false;

        afterEach(async (context: TestContext) => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot(context);
            }
        });

        it("Create new DB Connection", async () => {
            try {
                await dbTreeSection.createDatabaseConnection(globalConn);
                await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait2seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Collapse All", async () => {
            try {
                await dbTreeSection.expandTreeItem(globalConn);
                await dbTreeSection.expandTree([
                    String((globalConn.basic as interfaces.IConnBasicMySQL).schema),
                    "Tables",
                ]);

                await dbTreeSection.expandTreeItem("Views");
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                const treeElements = await dbTreeSection.getVisibleTreeItems();
                expect(treeElements.length).toBe(1);
                expect(await treeElements[0].getAttribute("class")).toContain("tabulator-tree-level-0");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Connection Overview", () => {

        const dbConnectionOverview = new E2EDatabaseConnectionOverview();
        let testFailed = false;

        beforeAll(async () => {

            try {
                await new E2ETabContainer().closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot(undefined, "beforeAll_Connection_Overview");
                allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
                throw e;
            }

        });

        let sslConn: interfaces.IDBConnection;

        beforeEach(async (context: TestContext) => {
            try {
                await (await new E2ETabContainer().getTab(constants.connectionOverview))!.click();
            } catch (e) {
                await Misc.storeScreenShot(context);
                throw e;
            }

        });

        afterEach(async (context: TestContext) => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot(context);
            }
        });

        it("MySQL Database connection - Verify mandatory fields", async () => {
            try {
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                    constants.wait5seconds, "Connection dialog was not displayed");

                await DialogHelper.clearInputField(conDialog, locator.dbConnectionDialog.caption);
                await DialogHelper.clearInputField(conDialog, locator.dbConnectionDialog.mysql.basic.hostname);

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

                const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
                const hostname = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
                expect(await caption.getAttribute("value")).toContain("New Connection");
                expect(await hostname.getAttribute("value")).toBe("localhost");
                await conDialog.findElement(locator.dbConnectionDialog.cancel).click();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("SQLite Database connection - Verify mandatory fields", async () => {
            try {
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                    constants.wait5seconds, "Connection dialog was not displayed");

                await conDialog.findElement(locator.dbConnectionDialog.databaseType).click();
                const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
                    constants.wait5seconds, "Database type popup was not found");
                await popup.findElement(locator.dbConnectionDialog.databaseTypeSqlite).click();

                await DialogHelper.clearInputField(conDialog, locator.dbConnectionDialog.caption);
                await conDialog.findElement(locator.dbConnectionDialog.ok).click();
                await driver.wait(async () => {
                    return (await conDialog.findElements(locator.dbConnectionDialog.errorMessage)).length > 0;
                }, constants.wait5seconds, "The DB Connection dialog should have errors");

                const dialogErrors = await conDialog.findElements(locator.dbConnectionDialog.errorMessage);
                const errorMsgs = await Promise.all(
                    dialogErrors.map((item: WebElement) => {
                        return item.getText();
                    }));

                const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
                expect(await caption.getAttribute("value")).toContain("New Connection");
                expect(errorMsgs).toContain("Specify the path to an existing Sqlite DB file");
                await conDialog.findElement(locator.dbConnectionDialog.cancel).click();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect to MySQL database using SSL", async () => {
            try {
                sslConn = Object.assign({}, globalConn);
                sslConn.caption = `e2eSSLConnection`;

                sslConn.ssl = {
                    mode: "Require and Verify CA",
                    caPath: join(String(globalThis.testConfig!.SSL_ROOT_FOLDER), "ca.pem"),
                    clientCertPath: join(String(globalThis.testConfig!.SSL_ROOT_FOLDER), "client-cert.pem"),
                    clientKeyPath: join(String(globalThis.testConfig!.SSL_ROOT_FOLDER), "client-key.pem"),
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(sslConn);
                const dbConn = dbConnectionOverview.getConnection(sslConn.caption);

                await driver.executeScript("arguments[0].click();", dbConn);
                const notebook = await new E2ENotebook().untilIsOpened(sslConn);
                const query = `select * from performance_schema.session_status
                where variable_name in ("ssl_cipher") and variable_value like "%TLS%";`;

                const result = await notebook.codeEditor.execute(query) as E2ECommandResultGrid;
                expect(result.status).toMatch(/1 record retrieved/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Connect to SQLite database", async () => {
            try {
                const sqliteConn = Object.assign({}, globalConn);
                sqliteConn.dbType = "Sqlite";
                sqliteConn.caption = `e2eSqliteConnection`;

                const dbPath = join(process.cwd(), "src", "tests", "e2e",
                    `port_${String(shellServers.get(basename(__filename)))}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");

                if (!existsSync(dbPath)) {
                    throw new Error(`SQLite file not found at '${dbPath}'`);
                }

                sqliteConn.basic = {
                    dbPath,
                    dbName: "SQLite",
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(sqliteConn);
                const sqliteWebConn = dbConnectionOverview.getConnection(sqliteConn.caption);

                await driver.executeScript("arguments[0].click();", sqliteWebConn);
                const notebook = await new E2ENotebook().untilIsOpened(sqliteConn);
                const result = await notebook.executeWithButton("SELECT * FROM main.db_connection;",
                    constants.execFullBlockSql) as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit a MySQL connection", async () => {
            try {
                const editConn: interfaces.IDBConnection = {
                    dbType: "MySQL",
                    caption: `e2eConnectionToEdit`,
                    description: "Local connection",
                    basic: {
                        hostname: "localhost",
                        username: String(globalThis.testConfig!.DBUSERNAME1),
                        port: parseInt(String(globalThis.testConfig!.MYSQL_PORT), 10),
                        schema: "sakila",
                        password: String(globalThis.testConfig!.DBUSERNAME1PWD),
                    },
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(editConn);
                await dbConnectionOverview.moreActions(editConn.caption!, constants.editConnection);
                editConn.caption = "e2eEditedCaption";
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
                    editConn.folderPath = {
                        value: "/",
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
                        timeout: "5",
                        compression: "Required",
                        compressionLevel: "5",
                        disableHeatWave: true,
                    };
                }
                delete (editConn.basic as interfaces.IConnBasicMySQL).password;
                const dbConnectionDialog = DatabaseConnectionDialog;
                await dbConnectionDialog.setConnection(editConn);
                await dbConnectionOverview.moreActions(editConn.caption, constants.editConnection);
                const verifyConn = await dbConnectionDialog.getConnectionDetails();
                expect(verifyConn).toStrictEqual(editConn);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit an Sqlite connection", async () => {
            try {
                const editSqliteConn: interfaces.IDBConnection = {
                    dbType: "Sqlite",
                    caption: `e2eSqliteConnectionToEdit`,
                    description: "Local connection",
                    basic: {
                        dbPath: join(process.cwd(), "src", "tests", "e2e",
                            `port_800${String(shellServers.get(basename(__filename)))}`,
                            "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                        dbName: "SQLite",
                    },
                    advanced: {
                        params: "one parameter",
                    },
                };

                const dbConnectionDialog = DatabaseConnectionDialog;
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await dbConnectionDialog.setConnection(editSqliteConn);
                await dbConnectionOverview.moreActions(editSqliteConn.caption!, constants.editConnection);
                editSqliteConn.caption = "e2eEditedSqliteCaption";
                editSqliteConn.description = "edited sqlite description";
                editSqliteConn.folderPath = {
                    value: "/",
                };

                if (interfaces.isSQLiteConnection(editSqliteConn.basic)) {
                    editSqliteConn.basic.dbPath = "edited path";
                    // https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=36492230
                    // editConn.basic.dbName = "edited name";
                }

                if (interfaces.isAdvancedSqlite(editSqliteConn.advanced)) {
                    editSqliteConn.advanced.params = "another param";
                }

                await dbConnectionDialog.setConnection(editSqliteConn);
                await dbConnectionOverview.moreActions(editSqliteConn.caption, constants.editConnection);
                const verifyConn = await dbConnectionDialog.getConnectionDetails();
                delete (verifyConn.basic as interfaces.IConnBasicSqlite).dbName;
                delete (editSqliteConn.basic as interfaces.IConnBasicSqlite).dbName;
                expect(verifyConn).toStrictEqual(editSqliteConn);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Duplicate a MySQL Connection", async () => {
            try {
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(globalConn);

                await dbConnectionOverview.moreActions(globalConn.caption!, constants.dupConnection);
                const duplicate: interfaces.IDBConnection = {
                    dbType: "MySQL",
                    caption: "e2eDuplicateFromGlobal",
                    basic: {
                        hostname: "localhost",
                        username: String(globalThis.testConfig!.DBUSERNAME1),
                    },
                };
                await DatabaseConnectionDialog.setConnection(duplicate);

                await driver.wait(dbConnectionOverview.untilConnectionExists(duplicate.caption!),
                    constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Duplicate a Sqlite Connection", async () => {
            try {
                const sqliteConn: interfaces.IDBConnection = {
                    dbType: "Sqlite",
                    caption: `e2eSqliteConnectionToDuplicate`,
                    description: "Local connection",
                    basic: {
                        dbPath: join(process.cwd(), "src", "tests", "e2e",
                            `port_800${String(shellServers.get(basename(__filename)))}`,
                            "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                        dbName: "SQLite",
                    },
                    advanced: {
                        params: "one parameter",
                    },
                };

                const dbConnectionDialog = DatabaseConnectionDialog;
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await dbConnectionDialog.setConnection(sqliteConn);
                await dbConnectionOverview.moreActions(sqliteConn.caption!, constants.dupConnection);
                const duplicateSqlite: interfaces.IDBConnection = {
                    dbType: "Sqlite",
                    caption: "e2eDuplicateSqliteFromGlobal",
                };
                await dbConnectionDialog.setConnection(duplicateSqlite);
                await driver.wait(dbConnectionOverview.untilConnectionExists(duplicateSqlite.caption!),
                    constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Remove a MySQL connection", async () => {
            try {
                const connectionToRemove: interfaces.IDBConnection = {
                    dbType: "MySQL",
                    caption: `e2eConnectionToRemove`,
                    description: "Local connection",
                    basic: {
                        hostname: "localhost",
                        username: String(globalThis.testConfig!.DBUSERNAME1),
                    },
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(connectionToRemove);
                await dbConnectionOverview.moreActions(connectionToRemove.caption!, constants.removeConnection);
                const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
                    constants.wait5seconds, "confirm dialog was not found");

                await dialog.findElement(locator.confirmDialog.accept).click();
                await new E2EToolbar().editorSelector.selectEditor(/DB Connection Overview/);
                expect(await dbConnectionOverview.existsConnection(connectionToRemove.caption!)).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Remove a Sqlite connection", async () => {
            try {
                const sqliteConnToRemove: interfaces.IDBConnection = {
                    dbType: "Sqlite",
                    caption: `e2eSqliteConnectionToEdit`,
                    description: "Local connection",
                    basic: {
                        dbPath: join(process.cwd(), "src", "tests", "e2e",
                            `port_800${String(shellServers.get(basename(__filename)))}`,
                            "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                        dbName: "SQLite",
                    },
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(sqliteConnToRemove);
                await dbConnectionOverview.moreActions(sqliteConnToRemove.caption!, constants.removeConnection);
                const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
                    constants.wait5seconds, "confirm dialog was not found");

                await dialog.findElement(locator.confirmDialog.accept).click();
                await new E2EToolbar().editorSelector.selectEditor(/DB Connection Overview/); // TO REMOVE
                expect(await dbConnectionOverview.existsConnection(sqliteConnToRemove.caption!)).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Create new notebook", async () => {
            try {
                await new E2ETabContainer().closeAllTabs();
                const connection = await dbConnectionOverview.getConnection(globalConn.caption!);
                const newNotebook = await connection.findElement(locator.dbConnectionOverview.dbConnection.newNotebook);
                await driver.actions().move({ origin: newNotebook }).perform();
                await driver.wait(until.elementIsVisible(newNotebook), constants.wait5seconds,
                    "New notebook button was not visible");
                await newNotebook.click();
                await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait5seconds);
                const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await openEditorsSection.focus();
                await driver.wait(openEditorsSection.untilTreeItemExists(constants.dbNotebook),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Create new script", async () => {
            try {
                await dbTreeSection.focus();
                await new E2ETabContainer().closeAllTabs();
                const connection = await dbConnectionOverview.getConnection("e2eDuplicateFromGlobal");
                const newScript = await connection.findElement(locator.dbConnectionOverview.dbConnection.newScript);
                await driver.actions().move({ origin: newScript }).perform();
                await driver.wait(until.elementIsVisible(newScript), constants.wait5seconds,
                    "New script button was not visible");
                await driver.executeScript("arguments[0].click()", newScript);
                await driver.wait(new E2EScript().untilIsOpened(globalConn), constants.wait5seconds);
                const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await openEditorsSection.focus();
                await driver.wait(openEditorsSection.untilTreeItemExists("Script"),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Open new shell console", async () => {
            try {
                await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
                    constants.wait10seconds).click();
                await driver.wait(new E2EShellConsole().untilIsOpened(globalConn),
                    constants.wait15seconds, "Shell Console was not loaded");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Close connections using tab context menu", async () => {
            const e2eConn1: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: `e2eConnection1`,
                description: "Local connection",
                basic: {
                    hostname: "localhost",
                    username: String(globalThis.testConfig!.DBUSERNAME1),
                    port: parseInt(String(globalThis.testConfig!.MYSQL_PORT), 10),
                    schema: "sakila",
                    password: String(globalThis.testConfig!.DBUSERNAME1PWD),
                },
            };

            const e2eConn2: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: `e2eConnection2`,
                description: "Local connection",
                basic: {
                    hostname: "localhost",
                    username: String(globalThis.testConfig!.DBUSERNAME1),
                    port: parseInt(String(globalThis.testConfig!.MYSQL_PORT), 10),
                    schema: "sakila",
                    password: String(globalThis.testConfig!.DBUSERNAME1PWD),
                },
            };

            try {
                const tabContainer = new E2ETabContainer();
                await tabContainer.closeAllTabs();

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(e2eConn1);
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(e2eConn2);

                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(globalConn.caption!));
                await new E2ENotebook().untilIsOpened(globalConn);
                await tabContainer.selectTab(constants.connectionOverview);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(e2eConn1.caption!));
                await new E2ENotebook().untilIsOpened(e2eConn1);
                await tabContainer.selectTab(constants.connectionOverview);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(e2eConn2.caption!));
                await new E2ENotebook().untilIsOpened(e2eConn2);
                await tabContainer.selectTab(constants.connectionOverview);

                // Close
                await tabContainer.selectTabContextMenu(e2eConn1.caption!, constants.close);
                expect(await tabContainer.tabExists(e2eConn1.caption!)).toBe(false);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(e2eConn1.caption!));
                await new E2ENotebook().untilIsOpened(e2eConn1);
                await tabContainer.selectTab(constants.connectionOverview);

                // Close others
                await tabContainer.selectTabContextMenu(e2eConn1.caption!, constants.closeOthers);
                await driver.wait(tabContainer.untilTabDoesNotExists(e2eConn2.caption!), constants.wait3seconds);
                expect(await tabContainer.tabExists(globalConn.caption!)).toBe(false);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(globalConn.caption!));
                await new E2ENotebook().untilIsOpened(globalConn);
                await tabContainer.selectTab(constants.connectionOverview);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(e2eConn2.caption!));
                await new E2ENotebook().untilIsOpened(e2eConn2);
                await tabContainer.selectTab(constants.connectionOverview);

                // Close to the right
                await tabContainer.selectTabContextMenu(globalConn.caption!, constants.closeToTheRight);
                expect(await tabContainer.tabExists(e2eConn2.caption!)).toBe(false);
                expect(await tabContainer.tabExists(e2eConn1.caption!)).toBe(true);
                await driver.executeScript("arguments[0].click();",
                    await dbConnectionOverview.getConnection(e2eConn2.caption!));
                await new E2ENotebook().untilIsOpened(e2eConn2);

                // Close All
                await tabContainer.selectTabContextMenu(globalConn.caption!, constants.closeAll);
                await driver.wait(tabContainer.untilTabDoesNotExists(e2eConn1.caption!), constants.wait3seconds,
                    `Tab ${e2eConn1.caption!} should have been closed`);
                await driver.wait(tabContainer.untilTabDoesNotExists(e2eConn2.caption!), constants.wait3seconds,
                    `Tab ${e2eConn2.caption!} should have been closed`);
                await driver.wait(tabContainer.untilTabDoesNotExists(globalConn.caption!), constants.wait3seconds,
                    `Tab ${globalConn.caption!} should have been closed`);
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Open 3 notebooks for the same database connection", async () => {
            try {
                const tabContainer = new E2ETabContainer();
                const connection = await dbConnectionOverview.getConnection(globalConn.caption!);
                await connection.click();
                await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait5seconds);
                await tabContainer.selectTab(constants.connectionOverview);

                await new E2EDatabaseConnectionOverview().openNotebookUsingKeyboard(globalConn.caption!);
                await driver.wait(async () => {
                    if (await PasswordDialog.exists()) {
                        await PasswordDialog.setCredentials(globalConn);

                        return true;
                    }
                }, constants.wait5seconds, "Could not find the Password Dialog for second connection");

                await tabContainer.selectTab(constants.connectionOverview);
                await new E2EDatabaseConnectionOverview().openNotebookUsingKeyboard(globalConn.caption!);
                await driver.wait(async () => {
                    if (await PasswordDialog.exists()) {
                        await PasswordDialog.setCredentials(globalConn);

                        return true;
                    }
                }, constants.wait5seconds, "Could not find the Password Dialog for third connection");

                await tabContainer.selectTab(constants.connectionOverview);
                await new E2EDatabaseConnectionOverview().openNotebookUsingKeyboard(globalConn.caption!);
                await driver.wait(async () => {
                    if (await PasswordDialog.exists()) {
                        await PasswordDialog.setCredentials(globalConn);

                        return true;
                    }
                }, constants.wait5seconds, "Could not find the Password Dialog for forth connection");

                await driver.wait(async () => {
                    return (await tabContainer.getTabs()).length === 5;
                }, constants.wait3seconds, "5 tabs should be opened");

                const openedTabs = await tabContainer.getTabs();
                expect(openedTabs).toContain(`${globalConn.caption}`);
                expect(openedTabs).toContain(`${globalConn.caption} (2)`);
                expect(openedTabs).toContain(`${globalConn.caption} (3)`);

                const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await openEditorsSection.focus();

                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption}`)).toBe(true);
                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption} (2)`)).toBe(true);
                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption} (3)`)).toBe(true);

                await tabContainer.closeAllTabs();
                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption}`)).toBe(false);
                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption} (2)`)).toBe(false);
                expect(await openEditorsSection.existsTreeItem(`${globalConn.caption} (3)`)).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        describe("DB Connection Groups", () => {

            const dbConnection1: interfaces.IDBConnection = {
                caption: `E2E - CONNECTION 1`,
                dbType: "MySQL",
                folderPath: {
                    new: true,
                    value: "group1",
                },
                basic: {
                    hostname: "localhost",
                    username: "test",
                },
            };

            const dbConnection2: interfaces.IDBConnection = {
                caption: `E2E - CONNECTION 2`,
                dbType: "MySQL",
                folderPath: {
                    new: true,
                    value: "/group1/group2",
                },
                basic: {
                    hostname: "localhost",
                    username: "test",
                },
            };

            const importedDBConnection: interfaces.IDBConnection = {
                caption: "Imported Connection",
                dbType: "MySQL",
                basic: {
                    hostname: "localhost",
                    username: String(globalThis.testConfig!.DBUSERNAME1),
                    port: parseInt(globalThis.testConfig!.MYSQL_PORT, 10),
                    schema: "sakila",
                    password: String(globalThis.testConfig!.DBUSERNAME1PWD),
                },
            };

            const connectionOverview = new E2EDatabaseConnectionOverview();
            let testFailed = false;

            beforeAll(async () => {
                try {
                    await dbTreeSection.focus();
                    await new E2ETabContainer().closeAllTabs();
                } catch (e) {
                    await Misc.storeScreenShot(undefined, "beforeAll_DBConnection_Groups");
                    allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
                    throw e;
                }
            });

            beforeEach(async (context: TestContext) => {
                try {
                    await (await connectionOverview.getBreadCrumbLinks())[0].click();
                } catch (e) {
                    await Misc.storeScreenShot(context);
                    throw e;
                }
            });

            afterEach(async (context: TestContext) => {
                if (testFailed) {
                    testFailed = false;
                    await Misc.storeScreenShot(context);
                }
            });

            afterAll(async () => {
                try {
                    await Misc.dismissNotifications();
                } catch (e) {
                    await Misc.storeScreenShot(undefined, "afterAll_DB Connection Groups");
                    throw e;
                }
            });

            it("Add MySQL connection to new folder", async () => {
                try {

                    await connectionOverview.addNewConnection(dbConnection1);
                    await driver.wait(connectionOverview.untilGroupExists(dbConnection1.folderPath!.value!),
                        constants.wait5seconds);
                    await connectionOverview.joinGroup(dbConnection1.folderPath!.value!);
                    await driver.wait(connectionOverview.untilConnectionExists(dbConnection1.caption!),
                        constants.wait3seconds);

                    expect(await connectionOverview.getBreadCrumb()).toBe(`/${dbConnection1.folderPath!.value}/`);
                    expect(await dbTreeSection.existsTreeItem(dbConnection1.folderPath!.value!)).toBe(true);
                    expect((await dbTreeSection.getTreeItemChildren(dbConnection1.folderPath!.value!))[0].caption)
                        .toBe(dbConnection1.caption);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Add MySQL connection to subfolder", async () => {
                try {
                    await connectionOverview.addNewConnection(dbConnection2);
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await dbTreeSection.expandTree(dbConnection2.folderPath!.value!.split("/").filter((item) => {
                        return item !== "";
                    }));

                    const group1 = dbConnection2.folderPath!.value!.split("/")[1];
                    const group2 = dbConnection2.folderPath!.value!.split("/")[2];

                    await connectionOverview.joinGroup(group1);
                    await driver.wait(connectionOverview.untilGroupExists(group2), constants.wait5seconds);
                    await connectionOverview.joinGroup(group2);
                    expect(await connectionOverview.existsConnection(dbConnection2.caption!)).toBe(true);
                    expect(await dbTreeSection.existsTreeItem(group2)).toBe(true);
                    expect((await dbTreeSection.getTreeItemChildren(group2))[0].caption!)
                        .toBe(dbConnection2.caption);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Add Sqlite connection to new folder", async () => {
                try {
                    const dbConnection: interfaces.IDBConnection = {
                        caption: `E2E - SQLITE CONNECTION 1`,
                        dbType: "Sqlite",
                        folderPath: {
                            new: true,
                            value: "sqliteGroup1",
                        },
                        basic: {
                            dbPath: "test",
                        },
                    };

                    await connectionOverview.addNewConnection(dbConnection);
                    expect(await connectionOverview.existsGroup(dbConnection.folderPath!.value!)).toBe(true);
                    await connectionOverview.joinGroup(dbConnection.folderPath!.value!);
                    await driver.wait(connectionOverview.untilConnectionExists(dbConnection.caption!),
                        constants.wait3seconds);

                    expect(await connectionOverview.getBreadCrumb()).toBe(`/${dbConnection.folderPath!.value}/`);
                    expect(await dbTreeSection.existsTreeItem(dbConnection.folderPath!.value!)).toBe(true);
                    expect((await dbTreeSection.getTreeItemChildren(dbConnection.folderPath!.value!))[0].caption)
                        .toBe(dbConnection.caption);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Add Sqlite connection to subfolder", async () => {
                try {
                    const dbConnection: interfaces.IDBConnection = {
                        caption: `E2E - SQLITE CONNECTION 2`,
                        dbType: "Sqlite",
                        folderPath: {
                            new: true,
                            value: "/sqliteGroup1/sqliteGroup2",
                        },
                        basic: {
                            dbPath: "test",
                        },
                    };

                    await connectionOverview.addNewConnection(dbConnection);
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await dbTreeSection.expandTree(dbConnection.folderPath!.value!.split("/").filter((item) => {
                        return item !== "";
                    }));

                    const sqliteGroup1 = dbConnection.folderPath!.value!.split("/")[1];
                    const sqliteGroup2 = dbConnection.folderPath!.value!.split("/")[2];

                    await connectionOverview.joinGroup(sqliteGroup1);
                    expect(await connectionOverview.existsGroup(sqliteGroup2)).toBe(true);
                    await connectionOverview.joinGroup(sqliteGroup2);
                    expect(await connectionOverview.existsConnection(dbConnection.caption!)).toBe(true);
                    expect(await dbTreeSection.existsTreeItem(sqliteGroup2)).toBe(true);
                    expect((await dbTreeSection.getTreeItemChildren(sqliteGroup2))[0].caption!)
                        .toBe(dbConnection.caption);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Add Subfolder", async () => {
                try {
                    const dbConnection: interfaces.IDBConnection = {
                        caption: `E2E - CONN 1`,
                        dbType: "MySQL",
                        folderPath: {
                            new: true,
                            value: "1group",
                        },
                        basic: {
                            hostname: "localhost",
                            username: "test",
                        },
                    };

                    const subFolder = "2group";

                    await connectionOverview.addNewConnection(dbConnection);
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await dbTreeSection.openContextMenuAndSelect(dbConnection.folderPath!.value!,
                        constants.addSubfolder);
                    await FolderDialog.setFolderValue(subFolder);
                    await FolderDialog.ok();
                    await dbTreeSection.expandTreeItem(dbConnection.folderPath!.value!);
                    await driver.wait(dbTreeSection.untilTreeItemExists(subFolder), constants.wait5seconds);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Navigate through folders and subfolders", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect("2group", constants.addSubfolder);
                    await FolderDialog.setFolderValue("3group");
                    await FolderDialog.ok();
                    await dbTreeSection.expandTreeItem("2group");
                    await driver.wait(dbTreeSection.untilTreeItemExists("3group"), constants.wait5seconds);

                    await dbTreeSection.openContextMenuAndSelect("3group", constants.addSubfolder);
                    await FolderDialog.setFolderValue("4group");
                    await FolderDialog.ok();
                    await dbTreeSection.expandTreeItem("3group");
                    expect(await dbTreeSection.existsTreeItem("4group")).toBe(true);

                    await (await connectionOverview.getBreadCrumbLinks())[0].click();
                    await connectionOverview.joinGroup("1group");
                    await connectionOverview.joinGroup("2group");
                    await connectionOverview.joinGroup("3group");
                    await connectionOverview.joinGroup("4group");

                    // USING BACK BUTTON
                    await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/3group/4group/`),
                        constants.wait3seconds);
                    await driver.findElement(locator.dbConnectionOverview.back).click();
                    await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/3group/`),
                        constants.wait3seconds);
                    await driver.findElement(locator.dbConnectionOverview.back).click();
                    await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/`),
                        constants.wait3seconds);
                    await driver.findElement(locator.dbConnectionOverview.back).click();
                    await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/`),
                        constants.wait3seconds);
                    await driver.findElement(locator.dbConnectionOverview.back).click();
                    await driver.wait(connectionOverview.untilBreadCrumbIs(`/`),
                        constants.wait3seconds);

                    await connectionOverview.joinGroup("1group");
                    await connectionOverview.joinGroup("2group");
                    await connectionOverview.joinGroup("3group");
                    await connectionOverview.joinGroup("4group");

                    // USING BREADCRUMB LINKS
                    let breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
                    await breadCrumbLinks[breadCrumbLinks.length - 2].click();
                    expect(await connectionOverview.getBreadCrumb()).toBe(`/1group/2group/3group/`);

                    breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
                    await breadCrumbLinks[breadCrumbLinks.length - 2].click();
                    expect(await connectionOverview.getBreadCrumb()).toBe(`/1group/2group/`);

                    breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
                    await breadCrumbLinks[breadCrumbLinks.length - 2].click();
                    expect(await connectionOverview.getBreadCrumb()).toBe(`/1group/`);

                    breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
                    await breadCrumbLinks[0].click();
                    expect(await connectionOverview.getBreadCrumb()).toBe(`/`);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Move MySQL connection to folder", async () => {
                try {
                    const dbConnection = {
                        dbType: "MySQL",
                        folderPath: {
                            new: false,
                            value: `/${dbConnection1.folderPath!.value!}`,
                        },
                        basic: {
                            hostname: "localhost",
                            username: "test",
                        },
                    };

                    await dbTreeSection.expandTree(dbConnection2.folderPath!.value!.split("/").filter((item) => {
                        return item !== "";
                    }));

                    await dbTreeSection.openContextMenuAndSelect(dbConnection2.caption!, constants.editDBConnection);
                    await DatabaseConnectionDialog.setConnection(dbConnection);

                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    expect((await dbTreeSection.getTreeItemChildren(dbConnection1.folderPath!.value!))
                        .map((item: E2ETreeItem) => {
                            return item.caption;
                        })).toContain(dbConnection2.caption!);

                    await (await connectionOverview.getGroup(dbConnection.folderPath.value.slice(1))).click();
                    expect(await connectionOverview.existsConnection(dbConnection1.caption!)).toBe(true);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Edit a folder", async () => {
                try {

                    const dbConnection: interfaces.IDBConnection = {
                        caption: `E2E - DB CONNECTION`,
                        dbType: "MySQL",
                        folderPath: {
                            new: true,
                            value: "groupToEdit",
                        },
                        basic: {
                            hostname: "localhost",
                            username: "test",
                        },
                    };

                    const editedGroup = "Edited group";
                    await connectionOverview.addNewConnection(dbConnection);
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await dbTreeSection.openContextMenuAndSelect(dbConnection.folderPath!.value!, constants.editFolder);
                    await FolderDialog.setFolderValue("Edited group");
                    await FolderDialog.ok();
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    expect(await dbTreeSection.existsTreeItem(editedGroup)).toBe(true);
                    expect(await connectionOverview.existsGroup(editedGroup)).toBe(true);

                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Edit subfolder", async () => {
                try {
                    const editedFolderName = "Edited subfolder";
                    await dbTreeSection.openContextMenuAndSelect(dbConnection2.folderPath!.value!.split("/")[2],
                        constants.editFolder);
                    await FolderDialog.setFolderValue(editedFolderName);
                    await FolderDialog.ok();
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    expect(await dbTreeSection.existsTreeItem(editedFolderName)).toBe(true);
                    await connectionOverview.joinGroup(dbConnection1.folderPath!.value!);
                    expect(await connectionOverview.existsGroup(editedFolderName)).toBe(true);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Remove empty folder", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect("4group", constants.removeFolder);
                    const dialog = await new ConfirmDialog().untilExists();
                    await dialog.accept();
                    const notification = await new E2EToastNotification().create();
                    expect(notification!.message)
                        .toBe(`The connection group "4group" has been deleted.`);
                    await notification!.close();
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Remove folder with connections", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(dbConnection1.folderPath!.value!,
                        constants.removeFolder);
                    const dialog = await new ConfirmDialog().untilExists();
                    await dialog.accept();
                    const notification = await new E2EToastNotification().create();
                    expect(notification?.message)
                        .toBe(`The connection group "${dbConnection1.folderPath!.value!}" has been deleted.`);
                    await notification?.close();
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Import MySQL Workbench DB Connections", async () => {
                try {
                    const hostname = (importedDBConnection.basic as interfaces.IConnBasicMySQL).hostname;
                    const port = (importedDBConnection.basic as interfaces.IConnBasicMySQL).port;
                    const username = (importedDBConnection.basic as interfaces.IConnBasicMySQL).username;
                    const schema = (importedDBConnection.basic as interfaces.IConnBasicMySQL).schema;

                    const xml = constants.validXMLConnection
                        .replace(/<HOSTNAME>/g, String(hostname))
                        .replace(/<PORT>/g, String(port))
                        .replace(/<USERNAME>/g, String(username))
                        .replace(/<SCHEMA>/g, String(schema))
                        .replace(/<CAPTION>/g, importedDBConnection.caption!);

                    const xmlFile = join(process.cwd(), "connections.xml");
                    await fs.writeFile(xmlFile, xml);

                    await new E2EWorkbench().selectFromSubmenu("Import MySQL Workbench Connections");
                    await driver.wait(until.elementLocated(locator.fileSelect),
                        constants.wait5seconds, "Could not find the input file box").sendKeys(xmlFile);
                    let notification = await new E2EToastNotification().create();
                    expect(notification!.message).toBe("Imported 1 connection from MySQL Workbench.");
                    await notification!.close();
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await driver.wait(dbTreeSection.untilTreeItemExists(constants.importedConnections),
                        constants.wait5seconds);
                    await dbTreeSection.expandTreeItem(constants.importedConnections);
                    await dbTreeSection.expandTreeItem(importedDBConnection);

                    await dbTreeSection.openContextMenuAndSelect(constants.importedConnections,
                        constants.removeFolder);
                    const dialog = await new ConfirmDialog().untilExists();
                    await dialog.accept();
                    notification = await new E2EToastNotification().create();
                    await notification?.close();
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Import MySQL Workbench DB Connections from an invalid XML", async () => {
                try {
                    const hostname = (importedDBConnection.basic as interfaces.IConnBasicMySQL).hostname;
                    const port = (importedDBConnection.basic as interfaces.IConnBasicMySQL).port;
                    const schema = (importedDBConnection.basic as interfaces.IConnBasicMySQL).schema;

                    const xml = constants.invalidXMLConnection
                        .replace(/<HOSTNAME>/g, String(hostname))
                        .replace(/<PORT>/g, String(port))
                        .replace(/<SCHEMA>/g, String(schema));

                    const xmlFile = join(process.cwd(), "invalid_connections.xml");
                    await fs.writeFile(xmlFile, xml);

                    await new E2EWorkbench().selectFromSubmenu("Import MySQL Workbench Connections");
                    await driver.wait(until.elementLocated(locator.fileSelect),
                        constants.wait5seconds, "Could not find the input file box").sendKeys(xmlFile);
                    const notification = await new E2EToastNotification().create();
                    expect(notification!.type).toBe(constants.notificationError);
                    expect(notification!.message).toBe("Could not parse XML file: Unclosed tag: value");
                    await notification!.close();
                    expect(await dbTreeSection.existsTreeItem(constants.importedConnections)).toBe(false);
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

        });

    });

    describe("MySQL Administration", () => {

        const mysqlAdministration = new E2EMySQLAdministration();
        const toolbar = new E2EToolbar();
        let testFailed = false;

        beforeAll(async () => {
            try {
                Os.deleteShellCredentials();
                await dbTreeSection.focus();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                await dbTreeSection.expandTreeItem(globalConn);
                await dbTreeSection.expandTreeItem(constants.mysqlAdministrationTreeElement);
            } catch (e) {
                await Misc.storeScreenShot(undefined, "beforeAll_MySQLAdministration");
                allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
                throw e;
            }

        });

        afterEach(async (context: TestContext) => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot(context);
            }
        });

        afterAll(async () => {
            try {
                await dbTreeSection.collapseTreeItem(globalConn.caption!);
                await new E2ETabContainer().closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot(undefined, "afterAll_MySQLAdministration");
                throw e;
            }

        });

        it("Server Status", async () => {
            try {
                await (await dbTreeSection.getTreeItem(constants.serverStatus)).click();
                await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn),
                    constants.wait15seconds);
                expect((await toolbar.editorSelector.getCurrentEditor()).label).toBe(constants.serverStatus);

                await mysqlAdministration.serverStatus.create();
                expect(mysqlAdministration.serverStatus.host).not.toBe("");
                expect(mysqlAdministration.serverStatus.socket).toMatch(/(\.sock|MySQL)/);
                expect(mysqlAdministration.serverStatus.port).toMatch(/(\d+)/);
                expect(mysqlAdministration.serverStatus.version).toMatch(/(\d+).(\d+).(\d+)/);
                expect(mysqlAdministration.serverStatus.compiledFor).not.toBe("");
                expect(mysqlAdministration.serverStatus.configurationFile).not.toBe("");
                expect(mysqlAdministration.serverStatus.runningSince)
                    .toMatch(/(\d+) (day|days), (\d+) (hour|hours), (\d+) (minute|minutes)/);
                expect(mysqlAdministration.serverStatus.baseDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
                expect(mysqlAdministration.serverStatus.dataDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
                expect(mysqlAdministration.serverStatus.pluginsDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
                expect(mysqlAdministration.serverStatus.tempDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
                expect(mysqlAdministration.serverStatus.errorLog!.checked).toBe(true);
                expect(mysqlAdministration.serverStatus.errorLog!.path).toMatch(/((?:[^\\/]*\/)*)(.*)/);
                expect(typeof mysqlAdministration.serverStatus.generalLog!.checked).toBe("boolean");
                expect(mysqlAdministration.serverStatus.generalLog!.path).not.toBe("");
                expect(typeof mysqlAdministration.serverStatus.slowQueryLog!.checked).toBe("boolean");
                expect(mysqlAdministration.serverStatus.slowQueryLog!.path).not.toBe("");
                expect(typeof mysqlAdministration.serverStatus.performanceSchema).toBe("boolean");
                expect(typeof mysqlAdministration.serverStatus.threadPool).toBe("boolean");
                expect(mysqlAdministration.serverStatus.memCachedPlugin).not.toBe("");
                expect(mysqlAdministration.serverStatus.semiSyncRepPlugin).not.toBe("");
                expect(typeof mysqlAdministration.serverStatus.pamAuthentication).toBe("boolean");
                expect(typeof mysqlAdministration.serverStatus.passwordValidation).toBe("boolean");
                expect(typeof mysqlAdministration.serverStatus.auditLog).toBe("boolean");
                expect(mysqlAdministration.serverStatus.firewall).not.toBe("");
                expect(mysqlAdministration.serverStatus.firewallTrace).not.toBe("");
                expect(mysqlAdministration.serverStatus.sslCa).toMatch(/.pem/);
                expect(mysqlAdministration.serverStatus.sslCert).toMatch(/.pem/);
                expect(mysqlAdministration.serverStatus.sslKey).toMatch(/.pem/);
                expect(mysqlAdministration.serverStatus.privateKey).toBe("private_key.pem");
                expect(mysqlAdministration.serverStatus.publicKey).toBe("public_key.pem");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Client Connections", async () => {
            try {
                await (await dbTreeSection.getTreeItem(constants.clientConnections)).click();
                await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn),
                    constants.wait15seconds);
                expect((await toolbar.editorSelector.getCurrentEditor()).label).toBe(constants.clientConnections);

                await mysqlAdministration.clientConnections.create();
                expect(mysqlAdministration.clientConnections.threadsConnected).toMatch(/Threads Connected: (\d+)/);
                expect(mysqlAdministration.clientConnections.threadsRunning).toMatch(/Threads Running: (\d+)/);
                expect(mysqlAdministration.clientConnections.threadsCreated).toMatch(/Threads Created: (\d+)/);
                expect(mysqlAdministration.clientConnections.rejected).toMatch(/Rejected \(over limit\):/);
                expect(mysqlAdministration.clientConnections.totalConnections).toMatch(/Total Connections: (\d+)/);
                expect(mysqlAdministration.clientConnections.connectionLimit).toMatch(/Connection Limit: (\d+)/);
                expect(mysqlAdministration.clientConnections.abortedClients).toMatch(/Aborted Clients: (\d+)/);
                expect(mysqlAdministration.clientConnections.abortedConnections).toMatch(/Aborted Connections: (\d+)/);
                expect(mysqlAdministration.clientConnections.errors).toMatch(/Errors: (\d+)/);
                expect((await mysqlAdministration.clientConnections.connectionsList!
                    .findElements(locator.mysqlAdministration.clientConnections.tableRow)).length).toBeGreaterThan(0);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Performance Dashboard - MLE Disabled", async () => {
            try {
                await (await dbTreeSection.getTreeItem(constants.performanceDashboard)).click();
                await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn),
                    constants.wait15seconds);
                expect(await mysqlAdministration.performanceDashboard.tabExists(constants.perfDashMLETab)).toBe(false);

                await mysqlAdministration.performanceDashboard.loadServerPerformance();
                expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingNetworkTrafficGraph)
                    .toBeDefined();
                expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingData).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingNetworkTrafficGraph)
                    .toBeDefined();
                expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingData).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.tableCacheGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.threadsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.openObjectsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.cacheEfficiency).toMatch(/(\d+)%/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalOpenedTables).toMatch(/(\d+)/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalTransactions).toMatch(/(\d+)/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.sqlStatementsExecutedGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalStatements).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.select).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.insert).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.update).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.delete).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.create).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.alter).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.drop).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBBufferPoolGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.checkpointAgeGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReadRatioGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.readRequests).toMatch(/(\d+) pages\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writeRequests).toMatch(/(\d+) pages\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReads).toMatch(/(\d+) #\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskWritesGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logDataWritten).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logWrites).toMatch(/(\d+) #\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writing).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskReadsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.bufferWrites).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.reading).toMatch(/(\d+) B\/s/);
                await new E2ETabContainer().closeAllTabs();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Performance Dashboard - MLE Enabled", async () => {
            try {
                let treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.openNewConnectionUsingNotebook))!.click();
                let notebook = await new E2ENotebook().untilIsOpened(globalConn);
                let result = await notebook.codeEditor
                    .execute(`INSTALL COMPONENT "file://component_mle";`) as E2ECommandResultData;
                expect(result.text).toMatch(/OK/);

                await new E2ETabContainer().closeAllTabs();
                treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                await dbTreeSection.expandTreeItem(globalConn);
                await dbTreeSection.expandTreeItem(constants.mysqlAdministrationTreeElement);

                await driver.wait(async () => {
                    await (await dbTreeSection.getTreeItem(constants.performanceDashboard)).click();
                    try {
                        await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn), constants.wait3seconds);

                        return true;
                    } catch (e) {
                        if (!String(e).includes("Waiting for MySQL Administration page to be opened")) {
                            throw e;
                        }
                    }
                }, constants.wait15seconds, `Could not open ${constants.performanceDashboard} page`);

                expect((await toolbar.editorSelector.getCurrentEditor()).label).toBe(constants.performanceDashboard);
                await driver.wait(mysqlAdministration.performanceDashboard.untilTabExists(constants.perfDashServerTab),
                    constants.wait3seconds);
                await driver.wait(mysqlAdministration.performanceDashboard.untilTabExists(constants.perfDashMLETab),
                    constants.wait3seconds);
                expect(await mysqlAdministration.performanceDashboard.tabIsSelected(constants.perfDashServerTab))
                    .toBe(true);

                await mysqlAdministration.performanceDashboard.loadServerPerformance();
                expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingNetworkTrafficGraph)
                    .toBeDefined();

                expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingData).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingNetworkTrafficGraph)
                    .toBeDefined();
                expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingData).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.tableCacheGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.threadsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.openObjectsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.cacheEfficiency).toMatch(/(\d+)%/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalOpenedTables).toMatch(/(\d+)/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalTransactions).toMatch(/(\d+)/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.sqlStatementsExecutedGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalStatements).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.select).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.insert).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.update).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.delete).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.create).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.alter).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.mysqlStatus!.drop).toMatch(/(\d+)\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBBufferPoolGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.checkpointAgeGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReadRatioGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.readRequests).toMatch(/(\d+) pages\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writeRequests).toMatch(/(\d+) pages\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReads).toMatch(/(\d+) #\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskWritesGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logDataWritten).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logWrites).toMatch(/(\d+) #\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writing).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskReadsGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.bufferWrites).toMatch(/(\d+) B\/s/);
                expect(mysqlAdministration.performanceDashboard.innoDBStatus!.reading).toMatch(/(\d+) B\/s/);

                await (await mysqlAdministration.performanceDashboard.getTab(constants.perfDashMLETab))!.click();
                await mysqlAdministration.performanceDashboard.loadMLEPerformance();
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.heapUsageGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleStatus).toBe("Inactive");
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleMaxHeapSize)
                    .toMatch(/(\d+).(\d+) GB/);
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleHeapUtilizationGraph).toBeDefined();
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.currentHeapUsage).toBe("0%");

                await mysqlAdministration.performanceDashboard.toolbar.editorSelector
                    .selectEditor(new RegExp(constants.dbNotebook));

                notebook = await new E2ENotebook().untilIsOpened(globalConn);

                const jsFunction =
                    `CREATE FUNCTION IF NOT EXISTS js_pow(arg1 INT, arg2 INT)
                    RETURNS INT DETERMINISTIC LANGUAGE JAVASCRIPT
                    AS
                    $$
                    let x = Math.pow(arg1, arg2)
                    return x
                    $$;
                `;

                result = await notebook.executeWithButton(jsFunction,
                    constants.execFullBlockSql) as E2ECommandResultData;
                expect(result.text).toMatch(/OK/);
                const result1 = await notebook.codeEditor.execute("SELECT js_pow(2,3);") as E2ECommandResultGrid;
                expect(result1.status).toMatch(/OK/);
                await new E2ETabContainer().closeAllTabs();
                await (await dbTreeSection.getTreeItem(constants.performanceDashboard)).click();

                await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn), constants.wait15seconds);
                await (await mysqlAdministration.performanceDashboard.getTab(constants.perfDashMLETab))!.click();
                await mysqlAdministration.performanceDashboard.loadMLEPerformance();
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleStatus).toBe("Active");
                const currentHeap = await driver
                    .findElement(locator.mysqlAdministration.performanceDashboard.mleStatus.currentHeapUsage);
                await driver.executeScript("arguments[0].scrollIntoView()", currentHeap);
                expect(mysqlAdministration.performanceDashboard.mlePerformance!.currentHeapUsage
                    .match(/(\d+)/)![1]).toMatch(/(\d+)/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        describe("Lakehouse Navigator", () => {

            let skipTest = false;

            const heatWaveConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: "e2eHeatWave Connection",
                description: "Local connection",
                basic: {
                    hostname: String(globalThis.testConfig!.HWHOSTNAME),
                    username: String(globalThis.testConfig!.HWUSERNAME),
                    schema: "e2e_tests",
                    password: String(globalThis.testConfig!.HWPASSWORD),
                },
            };

            const newTask: interfaces.INewLoadingTask = {
                name: "qa_cookbook_fe",
                description: "How do cook properly",
                targetDatabaseSchema: "e2e_tests",
                formats: "PDF (Portable Document Format Files)",
            };

            const fileToUpload = "qa_cookbook_fe.pdf";
            const tabContainer = new E2ETabContainer();

            beforeAll(async () => {
                try {
                    await tabContainer.closeAllTabs();
                    await dbTreeSection.clickToolbarButton(constants.collapseAll);
                    await dbTreeSection.createDatabaseConnection(heatWaveConn);
                    await dbTreeSection.expandTreeItem(heatWaveConn);
                    await dbTreeSection.expandTreeItem(constants.mysqlAdministrationTreeElement);
                    await (await dbTreeSection.getTreeItem(constants.lakeHouseNavigator)).click();

                    await driver.wait(mysqlAdministration.untilPageIsOpened(heatWaveConn),
                        constants.wait15seconds);

                    await dbTreeSection.expandTreeItem((heatWaveConn.basic as interfaces.IConnBasicMySQL).schema!);
                    await dbTreeSection.expandTreeItem("Tables");

                    if (await dbTreeSection.existsTreeItem(newTask.name!)) {
                        await dbTreeSection.openContextMenuAndSelect(newTask.name!, constants.dropTable);
                        const dialog = await driver.wait(until.elementLocated(
                            locator.confirmDialog.exists), constants.wait15seconds, "confirm dialog was not found");
                        await dialog.findElement(locator.confirmDialog.accept).click();
                        await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(newTask.name!),
                            constants.wait5seconds);
                    }
                } catch (e) {
                    await Misc.storeScreenShot(undefined, "beforeAll_LakehouseNavigator");
                    allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
                    throw e;
                }

            });

            afterEach(async (context: TestContext) => {
                if (testFailed) {
                    testFailed = false;
                    await Misc.storeScreenShot(context);
                }
            });

            afterAll(async () => {
                try {
                    await mysqlAdministration.lakeHouseNavigator.toolbar.editorSelector
                        .selectEditor(new RegExp(constants.dbNotebook));
                    const notebook = await new E2ENotebook().untilIsOpened(heatWaveConn);
                    let query = `DROP TABLE IF EXISTS ${(heatWaveConn.basic as interfaces.IConnBasicMySQL).schema}`;
                    query += `.${newTask.name};`;
                    await notebook.codeEditor.execute(query);
                } catch (e) {
                    await Misc.storeScreenShot(undefined, "afterAll_LakehouseNavigator");
                    throw e;
                }
            });

            it("Upload data to object storage", async () => {
                try {
                    const uploadToObjectStorage = mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage;
                    await driver.wait(mysqlAdministration.lakeHouseNavigator.overview.untilIsOpened(),
                        constants.wait3seconds);
                    await driver.wait(new Condition(`for editor to be ${constants.lakeHouseNavigatorEditor}`,
                        async () => {
                            return (await mysqlAdministration.lakeHouseNavigator.toolbar.editorSelector
                                .getCurrentEditor()).label === constants.lakeHouseNavigatorEditor;
                        }), constants.wait3seconds);
                    await mysqlAdministration.lakeHouseNavigator.overview.clickUploadFiles();
                    await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                        constants.wait25seconds);
                    await uploadToObjectStorage.objectStorageBrowser.selectOciProfile("HEATWAVE");
                    await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
                    await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                        constants.wait25seconds);

                    await uploadToObjectStorage.objectStorageBrowser
                        .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"])
                        .catch((e: unknown) => {
                            if (e instanceof E2EObjectStorageBrowserError) {
                                skipTest = true;
                            }
                        });

                    if (skipTest) {
                        skipTest = false;

                        return;
                    }

                    await uploadToObjectStorage.addFiles(join(process.cwd(), "..", "extension",
                        "tests", "e2e", "lakehouse_nav_files", fileToUpload));

                    await uploadToObjectStorage.objectStorageBrowser.checkItem("upload");
                    await uploadToObjectStorage.startFileUpload();
                    const notification = await new E2EToastNotification().create(undefined, constants.wait10seconds);
                    expect(notification!.message).toBe("The files have been uploaded successfully.");
                    await notification!.close();
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Load into Lakehouse", async () => {
                try {

                    const loadIntoLakehouse = mysqlAdministration.lakeHouseNavigator.loadIntoLakehouse;
                    await mysqlAdministration.lakeHouseNavigator.selectTab(constants.loadIntoLakeHouseTab);
                    await driver.wait(loadIntoLakehouse.objectStorageBrowser.untilItemsAreLoaded(),
                        constants.wait10seconds);
                    await mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                        .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"])
                        .catch((e: unknown) => {
                            if (e instanceof E2EObjectStorageBrowserError) {
                                skipTest = true;
                            }
                        });

                    if (skipTest) {
                        return;
                    }

                    expect(await loadIntoLakehouse.objectStorageBrowser.existsItem(fileToUpload)).toBe(true);
                    await loadIntoLakehouse.objectStorageBrowser.checkItem(fileToUpload);
                    await driver.wait(loadIntoLakehouse.untilExistsLoadingTask(fileToUpload), constants.wait5seconds);
                    await loadIntoLakehouse.setNewLoadingTask(newTask);
                    await loadIntoLakehouse.startLoadingTask();
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

            it("Lakehouse Tables", async () => {
                try {
                    if (skipTest) {
                        return;
                    }

                    const lakehouseTables = mysqlAdministration.lakeHouseNavigator.lakehouseTables;
                    await driver.wait(lakehouseTables.untilIsOpened(), constants.wait15seconds);
                    expect(await lakehouseTables.getDatabaseSchemas()).toContain(newTask.targetDatabaseSchema);
                    await driver.wait(lakehouseTables.untilExistsLakeHouseTable(newTask.name!),
                        constants.wait10seconds);
                    await driver.wait(lakehouseTables.untilLakeHouseTableIsLoading(newTask.name!),
                        constants.wait1minute);

                    let latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
                    expect(latestTable!.hasProgressBar).toBe(true);
                    expect(latestTable!.loaded).toMatch(/(\d+)%/);
                    expect(latestTable!.hasLoadingSpinner).toBe(true);
                    expect(latestTable!.rows).toBe("-");
                    expect(latestTable!.size).toBe("-");
                    expect(latestTable!.date).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                    expect(latestTable!.comment).toBe(newTask.description);

                    await driver.wait(lakehouseTables.untilLakeHouseTableIsLoaded(newTask.name!),
                        constants.wait1minute * 2);
                    latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
                    expect(latestTable!.hasProgressBar).toBe(false);
                    expect(latestTable!.loaded).toBe("Yes");
                    expect(latestTable!.hasLoadingSpinner).toBe(false);
                    expect(latestTable!.rows).toMatch(/(\d+)/);
                    expect(latestTable!.size).toMatch(/(\d+).(\d+) (KB|MB)/);
                    expect(latestTable!.date).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                    expect(latestTable!.comment).toBe(newTask.description);

                    await driver.wait(async () => {
                        const tasks = await lakehouseTables.getLakeHouseTasks();
                        if (tasks.length > 0) {
                            for (const task of tasks) {
                                if (task.status === `Loading ${newTask.name}` && task.status !== "COMPLETED") {
                                    return false;
                                }
                            }
                            console.log(tasks);

                            return true;
                        }
                    }, constants.wait10seconds, `There are still tasks RUNNING`);

                    const tasks = await lakehouseTables.getLakeHouseTasks();

                    console.log("-----------");
                    console.log(tasks);
                    if (tasks.length > 0) {
                        for (const task of tasks) {
                            if (task.name === `Loading ${newTask.name}`) {
                                await driver.wait(lakehouseTables.untilLakeHouseTaskIsCompleted(task.name),
                                    constants.wait10seconds);
                                expect(task.name).toBe(`Loading ${newTask.name}`);
                                expect(task.startTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                                expect(task.endTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                                expect(task.message).toBe("Task completed.");
                                break;
                            }
                        }
                    } else {
                        // disabled validation
                        //throw new Error(`There are not any new tasks to verify`);
                    }
                } catch (e) {
                    testFailed = true;
                    throw e;
                }
            });

        });

    });

    describe("Tree context menu items", () => {

        const dumpFolder = join(constants.workspace, "dump");
        const tableToDrop = `table_to_drop`;

        const dup = "duplicatedConnection";
        let testFailed = false;
        const tabContainer = new E2ETabContainer();

        beforeAll(async () => {

            try {
                Os.deleteShellCredentials();
                await dbTreeSection.focus();
                await new E2ETabContainer().closeAllTabs();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                await dbTreeSection.expandTreeItem(globalConn);
            } catch (e) {
                await Misc.storeScreenShot(undefined, "beforeAll_TreeContextMenuItems");
                allure.attachment("Failure Stacktrace", (e as Error).stack!, "text/plain");
                throw e;
            }

        });

        afterEach(async (context: TestContext) => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot(context);
            }
        });

        afterAll(async () => {
            await fs.rm(dumpFolder, { force: true, recursive: true });
        });

        it("DB Connection - Load SQL Script from Disk", async () => {
            try {
                await tabContainer.closeAllTabs();
                const script = new E2EScript();
                const sqlScript = "2_sakila_cst.sql";
                const destFile = join(process.cwd(), "src", "tests", "e2e", "sql", sqlScript);
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.loadSQLScriptFromDisk);
                await Misc.uploadFile(destFile);
                await driver.wait(script.untilIsOpened(globalConn), constants.wait30seconds);
                await driver.wait(async () => {
                    return ((await script.toolbar.editorSelector.getCurrentEditor()).label) === sqlScript;
                }, constants.wait5seconds, `Current editor is not ${sqlScript}`);
                expect((await script.toolbar.editorSelector.getCurrentEditor()).icon)
                    .toContain(constants.mysqlScriptIcon);

                const scriptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                expect(scriptLines.length).toBeGreaterThan(0);
                await script.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook),
                    globalConn.caption);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Open New Database Connection", async () => {
            try {
                await tabContainer.closeAllTabs();
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.openNewDatabaseConnection);
                await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait15seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Edit MySQL connection", async () => {
            try {
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                const localConn = Object.assign({}, globalConn);
                localConn.caption = `e2eConnectionToEdit2`;
                await dbTreeSection.createDatabaseConnection(localConn);
                await new E2EDatabaseConnectionOverview().getConnection(localConn.caption);
                await dbTreeSection.openContextMenuAndSelect(localConn.caption, constants.editDBConnection);
                await DatabaseConnectionDialog.setConnection(localConn);
                await driver.wait(dbTreeSection.untilTreeItemExists(localConn.caption), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Duplicate this MySQL connection", async () => {
            try {
                const dupConn = Object.assign({}, globalConn);
                dupConn.caption = dup;
                await dbTreeSection.focus();
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.duplicateThisDBConnection);
                await DatabaseConnectionDialog.setConnection(dupConn);
                await driver.wait(dbTreeSection.untilTreeItemExists(dup), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Delete DB connection", async () => {
            try {
                await dbTreeSection.focus();
                await dbTreeSection.openContextMenuAndSelect(dup, constants.deleteDBConnection);
                const dialog = await driver.wait(until.elementLocated(
                    locator.confirmDialog.exists), constants.wait15seconds, "confirm dialog was not found");
                await dialog.findElement(locator.confirmDialog.accept).click();
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(dup), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Show MySQL System Schemas", async () => {
            try {
                await dbTreeSection.expandTreeItem(globalConn);
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.showMySQLSystemSchemas);
                await driver.wait(dbTreeSection.untilTreeItemExists("mysql"), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Open MySQL Shell Console for this connection", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!,
                    constants.openNewMySQLShellConsoleForThisConnection);
                await driver.wait(new E2EShellConsole().untilIsOpened(globalConn), constants.wait15seconds);
                const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await openEditorsSection.focus();

                const children = await openEditorsSection.getTreeItemChildren(constants.mysqlShellConsoles);
                const childrenNames = (await Promise.all(children)).map((el: E2ETreeItem) => {
                    return el.caption;
                });

                expect(childrenNames).toContain(`Session to ${String(globalConn.caption)}`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Schema - Set as Current Database Schema", async () => {
            try {
                await dbTreeSection.focus();
                await dbTreeSection.expandTreeItem(globalConn);
                await tabContainer.closeAllTabs();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.openNewConnectionUsingNotebook))!.click();
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);

                await dbTreeSection.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                    .schema!, constants.setAsCurrentDatabaseSchema);
                let treeSakila = await dbTreeSection.getTreeItem("sakila");
                await driver.wait(treeSakila.untilIsDefault(), constants.wait3seconds);
                await (await tabContainer.getTab(globalConn.caption!))!.click();

                let result = await notebook.codeEditor.execute("select database();") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
                expect(await result.resultContext!.getAttribute("innerHTML"))
                    .toMatch(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema!));

                await dbTreeSection.openContextMenuAndSelect("world_x_cst", constants.setAsCurrentDatabaseSchema);
                const treeWorldSchema = await dbTreeSection.getTreeItem("world_x_cst");
                await driver.wait(treeWorldSchema.untilIsDefault(), constants.wait3seconds);
                expect(await treeSakila.isDefault()).toBe(false);

                await (await tabContainer.getTab(globalConn.caption!))!.click();
                await notebook.codeEditor.clean();
                result = await notebook.codeEditor.execute("select database();") as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
                expect(await result.resultContext!.getAttribute("innerHTML")).toMatch(/world_x_cst/);
                await tabContainer.closeAllTabs();
                await driver.wait(async () => {
                    const treeWorldSchema = await dbTreeSection.getTreeItem("world_x_cst");

                    return !(await treeWorldSchema.isDefault());
                }, constants.wait5seconds, "world_x_cst should not be the default");
                treeSakila = await dbTreeSection.getTreeItem("sakila");
                expect(await treeSakila.isDefault()).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Schema - Send to SQL Editor", async () => {
            try {
                await dbTreeSection.focus();
                await tabContainer.closeAllTabs();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.openNewConnectionUsingNotebook))!.click();
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);
                const schemaName = (globalConn.basic as interfaces.IConnBasicMySQL).schema!;

                await dbTreeSection.openContextMenuAndSelect(schemaName,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);

                await driver.wait(notebook.untilExists(schemaName), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(schemaName,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);

                await driver.wait(notebook.untilExists("CREATE DATABASE"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Table - Select Rows", async () => {
            try {
                await dbTreeSection.expandTree([
                    (globalConn.basic as interfaces.IConnBasicMySQL).schema!,
                    "Tables",
                ]);

                await dbTreeSection.openContextMenuAndSelect("actor", constants.selectRows);
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);
                const result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Table - Send to SQL Editor", async () => {
            try {
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);

                await dbTreeSection.openContextMenuAndSelect(tableToDrop,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(tableToDrop), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(tableToDrop,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);
                await driver.wait(notebook.untilExists("CREATE TABLE"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View - Select Rows", async () => {
            try {
                await dbTreeSection.expandTreeItem((globalConn.basic as interfaces.IConnBasicMySQL).schema!);
                await dbTreeSection.collapseTreeItem("Tables");
                await dbTreeSection.expandTreeItem("Views");
                await driver.wait(dbTreeSection.untilTreeItemHasChildren("Views"), constants.wait5seconds);
                await dbTreeSection.openContextMenuAndSelect(testView, constants.selectRows);
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);
                const result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultGrid;
                expect(result.status).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View - Send to SQL Editor", async () => {
            try {
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);
                await dbTreeSection.openContextMenuAndSelect(testView,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testView), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(testView,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);
                await driver.wait(notebook.untilExists("DEFINER VIEW"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Functions - Send to SQL Editor", async () => {
            try {
                await dbTreeSection.collapseTreeItem("Tables");
                await dbTreeSection.expandTreeItem("Functions");

                await driver.wait(dbTreeSection.untilTreeItemHasChildren("Functions"), constants.wait5seconds);
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);

                await dbTreeSection.openContextMenuAndSelect(testFunction,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testFunction), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(testFunction,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);
                await driver.wait(notebook.untilExists("DEFINER FUNCTION"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Events - Send to SQL Editor", async () => {
            try {
                await dbTreeSection.expandTreeItem("Events");
                await driver.wait(dbTreeSection.untilTreeItemHasChildren("Events"), constants.wait5seconds);
                const notebook = await new E2ENotebook().untilIsOpened(globalConn);

                await dbTreeSection.openContextMenuAndSelect(testEvent,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testEvent), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(testEvent,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);
                await driver.wait(notebook.untilExists("DEFINER EVENT"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Procedures - Send to SQL Editor", async () => {
            try {
                await dbTreeSection.expandTreeItem("Procedures");
                await driver.wait(dbTreeSection.untilTreeItemHasChildren("Procedures"), constants.wait5seconds);

                const notebook = await new E2ENotebook().untilIsOpened(globalConn);
                await dbTreeSection.openContextMenuAndSelect(testProcedure,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testProcedure), constants.wait3seconds);
                await dbTreeSection.openContextMenuAndSelect(testProcedure,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.createStatement]);
                await driver.wait(notebook.untilExists("CREATE DEFINER"), constants.wait3seconds);
                await notebook.codeEditor.clean();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

});
