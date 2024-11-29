/*
 * Copyright (c) 2024 Oracle and/or its affiliates.
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

import { join, basename } from "path";
import { existsSync } from "fs";
import * as fs from "fs/promises";
import { Condition, until, WebElement } from "selenium-webdriver";
import { Misc, shellServers } from "../lib/misc.js";
import { DatabaseConnectionDialog } from "../lib/Dialogs/DatabaseConnectionDialog.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import { DialogHelper } from "../lib/Dialogs/DialogHelper.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import * as locator from "../lib/locators.js";
import { E2EShellConsole } from "../lib/E2EShellConsole.js";
import { E2EScript } from "../lib/E2EScript.js";
import { E2EToolbar } from "../lib/E2EToolbar.js";
import { E2EMySQLAdministration } from "../lib/MySQLAdministration/E2EMySQLAdministration.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { E2ESettings } from "../lib/E2ESettings.js";

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
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT!, 10),
            schema: "sakila",
            password: String(process.env.DBUSERNAME1PWD),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    beforeAll(async () => {

        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();
            await dbTreeSection.focus();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_DATABASE_CONNECTIONS");
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

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("Create new DB Connection", async () => {
            try {
                await dbTreeSection.createDatabaseConnection(globalConn);
                await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait2seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Collapse All", async () => {
            try {
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree
                    .expandElement([String((globalConn.basic as interfaces.IConnBasicMySQL).schema)]);
                await dbTreeSection.tree.expandElement(["Tables"]);
                await dbTreeSection.tree.expandElement(["Views"]);
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                const treeElements = await dbTreeSection.getTreeElements();
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
                const closeHeaderButton = await driver.findElements(locator.dbConnectionOverview.closeHeader);
                if (closeHeaderButton.length > 0) {
                    await closeHeaderButton[0].click();
                }
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_Connection_Overview");
                throw e;
            }

        });

        let sslConn: interfaces.IDBConnection;

        beforeEach(async () => {
            try {
                await driver.findElement(locator.dbConnectionOverview.tab).click();
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_Connection_Overview");
                throw e;
            }

        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }
        });

        it("MySQL Database connection - Verify mandatory fields", async () => {
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

        it("SQLite Database connection - Verify mandatory fields", async () => {
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

        it("Connect to SQLite database", async () => {
            try {
                const sqliteConn = Object.assign({}, globalConn);
                sqliteConn.dbType = "Sqlite";
                sqliteConn.caption = `e2eSqliteConnection`;

                if (Os.isLinux()) {
                    process.env.USERPROFILE = process.env.HOME;
                }

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
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(sqliteConn), constants.wait15seconds);
                await notebook.codeEditor.loadCommandResults();
                const result = await notebook.codeEditor.executeWithButton("SELECT * FROM main.db_connection;",
                    constants.execFullBlockSql);
                expect(result.toolbar!.status).toMatch(/OK/);
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
                    caPath: join(process.env.SSL_ROOT_FOLDER!, "ca.pem"),
                    clientCertPath: join(process.env.SSL_ROOT_FOLDER!, "client-cert.pem"),
                    clientKeyPath: join(process.env.SSL_ROOT_FOLDER!, "client-key.pem"),
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(sslConn);
                const dbConn = dbConnectionOverview.getConnection(sslConn.caption);

                await driver.executeScript("arguments[0].click();", dbConn);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(sslConn), constants.wait15seconds);
                const query = `select * from performance_schema.session_status
                where variable_name in ("ssl_cipher") and variable_value like "%TLS%";`;

                await notebook.codeEditor.create();
                const result = await notebook.codeEditor.execute(query);
                expect(result.toolbar!.status).toMatch(/1 record retrieved/);
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
                        username: String(process.env.DBUSERNAME1),
                        port: 3308,
                        schema: "sakila",
                        password: String(process.env.DBUSERNAME1PWD),
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
                    editConn.basic.ociBastion = true;
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
                    editConn.mds = {
                        profile: "E2ETESTS",
                        sshPrivateKey: "edited private key",
                        sshPublicKey: "edited public key",
                        // eslint-disable-next-line max-len
                        dbSystemOCID: "ocid1.mysqldbsystem.oc1.iad.aaaaaaaakj7775hxfupaggyci4x2nze45gaqyhcufae23fm5fl2bynwy4tpq",
                        // eslint-disable-next-line max-len
                        bastionOCID: "ocid1.bastion.oc1.iad.amaaaaaaumfjfyaaectz7jrnfnuses2qc6qvg6ksseu6i2xfow2cnqpbn44q",
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
                        username: String(process.env.DBUSERNAME1),
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
                        username: String(process.env.DBUSERNAME1),
                    },
                };

                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
                await DatabaseConnectionDialog.setConnection(connectionToRemove);
                await dbConnectionOverview.moreActions(connectionToRemove.caption!, constants.removeConnection);
                const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
                    constants.wait5seconds, "confirm dialog was not found");

                await dialog.findElement(locator.confirmDialog.accept).click();
                await driver.navigate().refresh();
                await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
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
                expect(await openEditorsSection.tree.getElement(constants.dbNotebook)).toBeDefined();
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
                expect(await openEditorsSection.tree.getElement("Script")).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Open new shell console", async () => {
            try {
                await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
                    constants.wait10seconds).click();
                await driver.wait(new E2EShellConsole().untilIsOpened(),
                    constants.wait15seconds, "Shell Console was not loaded");
            } catch (e) {
                testFailed = true;
                throw e;
            }
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
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.expandElement([constants.mysqlAdministrationTreeElement]);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_MySQLAdministration");
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
            try {
                await dbTreeSection.tree.collapseElement(globalConn.caption!);
                await new E2ETabContainer().closeAllTabs();
            } catch (e) {
                await Misc.storeScreenShot("afterAll_MySQLAdministration");
                throw e;
            }

        });

        it("Server Status", async () => {
            try {
                await (await dbTreeSection.tree.getElement(constants.serverStatus))!.click();
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
                await (await dbTreeSection.tree.getElement(constants.clientConnections))!.click();
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
                await (await dbTreeSection.tree.getElement(constants.performanceDashboard))!.click();
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
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab))!.click();
                let notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.loadCommandResults();
                let result = await notebook.codeEditor.execute(`INSTALL COMPONENT "file://component_mle";`);
                expect(result.text).toMatch(/OK/);

                await new E2ETabContainer().closeAllTabs();
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.refreshConnection))!.click();
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.expandElement([constants.mysqlAdministrationTreeElement]);

                await (await dbTreeSection.tree.getElement(constants.performanceDashboard))!.click();
                await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn),
                    constants.wait15seconds);
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

                notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.loadCommandResults();

                const jsFunction =
                    `CREATE FUNCTION IF NOT EXISTS js_pow(arg1 INT, arg2 INT)
                    RETURNS INT DETERMINISTIC LANGUAGE JAVASCRIPT
                    AS
                    $$
                    let x = Math.pow(arg1, arg2)
                    return x
                    $$;
                `;

                result = await notebook.codeEditor.executeWithButton(jsFunction, constants.execFullBlockSql);
                expect(result.text).toMatch(/OK/);
                result = await notebook.codeEditor.execute("SELECT js_pow(2,3);");
                expect(result.toolbar!.status).toMatch(/OK/);
                await new E2ETabContainer().closeAllTabs();
                await (await dbTreeSection.tree.getElement(constants.performanceDashboard))!.click();
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

            const heatWaveConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: "e2eHeatWave Connection",
                description: "Local connection",
                basic: {
                    hostname: String(process.env.HWHOSTNAME),
                    username: String(process.env.HWUSERNAME),
                    schema: "e2e_tests",
                    password: String(process.env.HWPASSWORD),
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
                    await dbTreeSection.tree.expandDatabaseConnection(heatWaveConn);
                    await dbTreeSection.tree.expandElement([constants.mysqlAdministrationTreeElement]);
                    await (await dbTreeSection.tree.getElement(constants.lakeHouseNavigator))!.click();
                    expect(tabContainer.getTab(constants.lakeHouseNavigator)).toBeDefined();

                    await driver.wait(mysqlAdministration.untilPageIsOpened(heatWaveConn),
                        constants.wait15seconds);

                    await dbTreeSection.tree.expandElement([(heatWaveConn.basic as interfaces.IConnBasicMySQL)
                        .schema!]);
                    await dbTreeSection.tree.expandElement(["Tables"]);

                    if (await dbTreeSection.tree.elementExists(newTask.name!)) {
                        await dbTreeSection.tree.openContextMenuAndSelect(newTask.name!, constants.dropTable);
                        const dialog = await driver.wait(until.elementLocated(
                            locator.confirmDialog.exists), constants.wait15seconds, "confirm dialog was not found");
                        await dialog.findElement(locator.confirmDialog.accept).click();
                        await driver.wait(dbTreeSection.tree.untilDoesNotExist(newTask.name!), constants.wait5seconds);
                    }
                } catch (e) {
                    await Misc.storeScreenShot("beforeAll_LakehouseNavigator");
                    throw e;
                }

            });

            afterAll(async () => {
                try {
                    await mysqlAdministration.lakeHouseNavigator.toolbar.editorSelector
                        .selectEditor(new RegExp(constants.dbNotebook));
                    const notebook = new E2ENotebook();
                    await notebook.codeEditor.loadCommandResults();
                    let query = `DROP TABLE IF EXISTS ${(heatWaveConn.basic as interfaces.IConnBasicMySQL).schema}`;
                    query += `.${newTask.name};`;
                    await notebook.codeEditor.execute(query);
                } catch (e) {
                    await Misc.storeScreenShot("afterAll_LakehouseNavigator");
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
                    await uploadToObjectStorage.objectStorageBrowser.selectOciProfile("HEATWAVE");
                    await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
                    await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                        constants.wait25seconds);

                    await uploadToObjectStorage.objectStorageBrowser
                        .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
                    await uploadToObjectStorage.addFiles(join(process.cwd(), "..", "extension",
                        "tests", "e2e", "lakehouse_nav_files", fileToUpload));
                    await uploadToObjectStorage.objectStorageBrowser.checkItem("upload");
                    await uploadToObjectStorage.startFileUpload();
                    const notification = await new E2EToastNotification().create(undefined, constants.wait10seconds);
                    expect(notification!.message).toBe("The files have been uploaded successfully.");
                    await notification!.close();
                    await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
                    await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                        constants.wait20seconds);
                    expect(await uploadToObjectStorage.objectStorageBrowser.existsItem(fileToUpload)).toBe(true);
                } catch (e) {
                    await Misc.storeScreenShot();
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
                        .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
                    expect(await loadIntoLakehouse.objectStorageBrowser.existsItem(fileToUpload)).toBe(true);
                    await loadIntoLakehouse.objectStorageBrowser.checkItem(fileToUpload);
                    await driver.wait(loadIntoLakehouse.untilExistsLoadingTask(fileToUpload), constants.wait5seconds);
                    await loadIntoLakehouse.setNewLoadingTask(newTask);
                    await loadIntoLakehouse.startLoadingTask();
                } catch (e) {
                    await Misc.storeScreenShot();
                    throw e;
                }
            });

            it("Lakehouse Tables", async () => {
                try {
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

                    const latestTask = await lakehouseTables.getLatestTask();
                    await driver.wait(lakehouseTables.untilLakeHouseTaskIsCompleted(latestTask!.id!),
                        constants.wait20seconds);
                    expect(latestTask!.name).toBe(`Loading ${newTask.name}`);
                    expect(latestTask!.hasProgressBar).toBe(false);
                    expect(latestTask!.status).toBe("COMPLETED");
                    expect(latestTask!.startTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                    expect(latestTask!.endTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                    expect(latestTask!.message).toBe("Task completed.");
                } catch (e) {
                    await Misc.storeScreenShot();
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
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_TreeContextMenuItems");
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
            await fs.rm(dumpFolder, { force: true, recursive: true });
        });

        it("DB Connection - Open New Database Connection", async () => {
            try {
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!,
                    constants.openNewDatabaseConnection);
                await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait15seconds);
                await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait5seconds);
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
                await dbTreeSection.tree.openContextMenuAndSelect(localConn.caption, constants.editDBConnection);
                await DatabaseConnectionDialog.setConnection(localConn);
                await driver.wait(dbTreeSection.tree.untilExists(localConn.caption), constants.wait5seconds);
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
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!,
                    constants.duplicateThisDBConnection);
                await DatabaseConnectionDialog.setConnection(dupConn);
                await driver.wait(dbTreeSection.tree.untilExists(dup), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Delete DB connection", async () => {
            try {
                await dbTreeSection.focus();
                await dbTreeSection.tree.openContextMenuAndSelect(dup, constants.deleteDBConnection);
                const dialog = await driver.wait(until.elementLocated(
                    locator.confirmDialog.exists), constants.wait15seconds, "confirm dialog was not found");
                await dialog.findElement(locator.confirmDialog.accept).click();
                await driver.wait(dbTreeSection.tree.untilDoesNotExist(dup), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Show MySQL System Schemas", async () => {
            try {
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!,
                    constants.showMySQLSystemSchemas);
                await driver.wait(dbTreeSection.tree.untilExists("mysql"), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Load SQL Script from Disk", async () => {
            try {
                const notebook = new E2ENotebook();
                const script = "sakila_cst.sql";
                const destFile = join(process.cwd(), "src", "tests", "e2e", "sql", script);
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!, constants.loadSQLScriptFromDisk);
                await Misc.uploadFile(destFile);
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait15seconds);
                await driver.wait(async () => {
                    return ((await notebook.toolbar.editorSelector.getCurrentEditor()).label) === script;
                }, constants.wait5seconds, `Current editor is not ${script}`);
                expect((await notebook.toolbar.editorSelector.getCurrentEditor()).icon)
                    .toContain(constants.mysqlScriptIcon);

                const scriptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                expect(scriptLines.length).toBeGreaterThan(0);
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook),
                    globalConn.caption);

                await notebook.codeEditor.loadCommandResults();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("DB Connection - Open MySQL Shell Console for this connection", async () => {
            try {
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!,
                    constants.openNewMySQLShellConsoleForThisConnection);
                await driver.wait(new E2EShellConsole().untilIsOpened(globalConn), constants.wait15seconds);
                const treeOpenEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await treeOpenEditorsSection.focus();

                expect(await treeOpenEditorsSection.tree.getChildElement(constants.mysqlShellConsoles,
                    `Session to ${String(globalConn.caption)}`)).toBeDefined();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Schema - Set as Current Database Schema", async () => {
            try {
                await dbTreeSection.focus();
                await (await tabContainer.getTab(globalConn.caption!))!.click();
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                    .schema!, constants.setAsCurrentDatabaseSchema);
                await driver.wait(dbTreeSection.tree.untilIsDefault("sakila", "schema"), constants.wait5seconds);
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab))!.click();
                await (await tabContainer.getTab(globalConn.caption!))!.click();

                const notebook = new E2ENotebook();
                await notebook.codeEditor.create();
                let result = await notebook.codeEditor.execute("select database();");
                expect(result.toolbar!.status).toMatch(/OK/);
                expect(await result.grid!.content!.getAttribute("innerHTML"))
                    .toMatch(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema!));
                await dbTreeSection.tree.openContextMenuAndSelect("world_x_cst", constants.setAsCurrentDatabaseSchema);
                await driver.wait(dbTreeSection.tree.untilIsDefault("world_x_cst", "schema"), constants.wait5seconds);
                expect(await dbTreeSection.tree.isElementDefault("sakila", "schema")).toBe(false);
                await (await tabContainer.getTab(globalConn.caption!))!.click();
                await notebook.codeEditor.clean();
                result = await notebook.codeEditor.execute("select database();");
                expect(result.toolbar!.status).toMatch(/OK/);
                expect(await result.grid!.content!.getAttribute("innerHTML")).toMatch(/world_x_cst/);
                await tabContainer.closeAllTabs();
                await driver.wait(async () => {
                    return !(await dbTreeSection.tree.isElementDefault("world_x_cst", "schema"));
                }, constants.wait5seconds, "world_x_cst should not be the default");
                expect(await dbTreeSection.tree.isElementDefault("sakila", "schema")).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Schema - Send to SQL Editor", async () => {
            try {
                await (await dbTreeSection.tree.getActionButton(globalConn.caption!,
                    constants.openNewDatabaseConnectionOnNewTab))!.click();
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                const schemaName = (globalConn.basic as interfaces.IConnBasicMySQL).schema!;
                await dbTreeSection.tree.openContextMenuAndSelect(schemaName,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(schemaName), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(schemaName,
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
                await dbTreeSection.tree.expandElement([(globalConn.basic as interfaces.IConnBasicMySQL).schema!]);
                await dbTreeSection.tree.expandElement(["Tables"]);
                await dbTreeSection.tree.openContextMenuAndSelect("actor", constants.selectRows);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.create();
                const result = await notebook.codeEditor.getLastExistingCommandResult(true);
                expect(result.toolbar!.status).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Table - Send to SQL Editor", async () => {
            try {
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(tableToDrop,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(tableToDrop), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(tableToDrop,
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
                await dbTreeSection.tree.expandElement([(globalConn.basic as interfaces.IConnBasicMySQL).schema!]);
                await dbTreeSection.tree.expandElement(["Views"]);
                await dbTreeSection.tree.openContextMenuAndSelect(testView, constants.selectRows);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await notebook.codeEditor.create();
                const result = await notebook.codeEditor.getLastExistingCommandResult(true);
                expect(result.toolbar!.status).toMatch(/OK/);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("View - Send to SQL Editor", async () => {
            try {
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testView,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testView), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testView,
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
                await dbTreeSection.tree.collapseElement("Tables");
                await dbTreeSection.tree.expandElement(["Functions"]);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testFunction,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testFunction), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testFunction,
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
                await dbTreeSection.tree.expandElement(["Events"]);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testEvent,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testEvent), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testEvent,
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
                await dbTreeSection.tree.expandElement(["Procedures"]);
                const notebook = new E2ENotebook();
                await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testProcedure,
                    [constants.sendToSQLEditor.exists, constants.sendToSQLEditor.name]);
                await driver.wait(notebook.untilExists(testProcedure), constants.wait3seconds);
                await dbTreeSection.tree.openContextMenuAndSelect(testEvent,
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

