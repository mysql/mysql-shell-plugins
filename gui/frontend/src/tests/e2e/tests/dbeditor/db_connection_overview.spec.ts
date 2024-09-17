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

import { WebElement, until } from "selenium-webdriver";
import { Misc, shellServers } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { basename, join } from "path";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { DialogHelper } from "../../lib/dialogHelper.js";
import { Os } from "../../lib/os.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { DatabaseConnectionDialog } from "../../lib/databaseConnectionDialog.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";

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

    const notebook = new E2ENotebook();

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.executeScript("arguments[0].click()",
                await driver.wait(until.elementLocated(locator.sqlEditorPage.icon)), constants.wait5seconds);
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
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
            await notebook.close("current");
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
            const conn = await DatabaseConnectionOverview.getConnection(duplicateConnection.caption);
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
            await DatabaseConnectionOverview.createDataBaseConnection(localConn);
            await DatabaseConnectionOverview.moreActions(localConn.caption!, constants.removeConnection);
            const dialog = await driver.findElement(locator.confirmDialog.exists);
            expect(dialog).toBeDefined();
            await driver.executeScript(
                "arguments[0].click();",
                await dialog.findElement(locator.confirmDialog.accept),
            );
            expect(await DatabaseConnectionOverview.existsConnection(localConn.caption!)).toBe(false);
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
            await DatabaseConnectionOverview.createDataBaseConnection(sqliteConn);
            const conn = await DatabaseConnectionOverview.getConnection(sqliteConn.caption!);
            expect(conn).toBeDefined();
            await driver.executeScript("arguments[0].click();", conn);
            expect(await DatabaseConnectionOverview.getSelectedTab()).toBe(sqliteConn.caption);
            await notebook.explorer.toggleSchemasTreeObject("main", constants.schemaType);
            const main = await notebook.explorer.getSchemasTreeElement("main", constants.schemaType);
            const attr = await main!.getAttribute("class");
            expect(attr.split(" ").includes("expanded")).toBe(true);
            await notebook.explorer.toggleSchemasTreeObject("Tables", constants.tablesType);
            const tables = await notebook.explorer.getSchemasTreeElement("Tables", constants.tablesType);
            expect(
                await (
                    await tables!.findElement(locator.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await notebook.codeEditor.clean();
            const table = await notebook.explorer.getSchemasTreeElement("db_connection", constants.objectType);

            await driver.wait(async () => {
                await driver
                    .actions()
                    .contextClick(table)
                    .perform();

                return (await driver.findElements(locator.treeContextMenu.exists)).length > 0;
            }, constants.wait5seconds, "Context menu was not opened");

            await driver.findElement(locator.treeContextMenu.selectRows).click();
            const notebookSqlite = new E2ENotebook();
            await notebookSqlite.codeEditor.loadCommandResults();
            const result = await notebookSqlite.codeEditor.getLastExistingCommandResult(true);
            expect(result.toolbar!.status).toMatch(/OK/);
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
            await DatabaseConnectionOverview.createDataBaseConnection(sslConn);
            const conn = await DatabaseConnectionOverview.getConnection(sslConn.caption!);
            await driver.executeScript("arguments[0].click();", conn);
            await driver.wait(new E2ENotebook().untilIsOpened(sslConn), constants.wait10seconds);
            expect(await DatabaseConnectionOverview.getSelectedTab()).toBe(sslConn.caption);
            let query = `select * from performance_schema.session_status where variable_name in `;
            query += `("ssl_cipher") and variable_value like "%TLS%"`;

            const notebookSSL = new E2ENotebook();
            await notebookSSL.codeEditor.create();
            const result = await notebookSSL.codeEditor.execute(query);
            expect(result.toolbar!.status).toMatch(/1 record retrieved/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Database Connections - headless off", () => {

    let testFailed = false;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `connDBConnectionsHeadless`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: "dbuser2",
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: "dbuser2",
        },
    };

    const notebook = new E2ENotebook();

    beforeAll(async () => {
        try {
            await loadDriver(false);
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.executeScript("arguments[0].click()",
                await driver.wait(until.elementLocated(locator.sqlEditorPage.icon)), constants.wait5seconds);
            const closeHeader = await driver.findElements(locator.dbConnectionOverview.closeHeader);

            if (closeHeader.length > 0) {
                await closeHeader[0].click();
            }
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
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
            await notebook.close("current");
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Copy, cut paste into the DB Connection dialog", async () => {
        try {
            await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
            const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.wait5seconds, "Connection dialog was not displayed");
            const hostNameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
            const valueToCopy = await hostNameInput.getAttribute("value");
            await driver.wait(async () => {
                await Os.keyboardSelectAll(hostNameInput);
                await Os.keyboardCopy(hostNameInput);
                const usernameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
                await Os.keyboardPaste(usernameInput);

                return (await usernameInput.getAttribute("value")).includes(valueToCopy);
            }, constants.wait15seconds, `Could not copy paste ${valueToCopy} to user name field`);

            expect(await hostNameInput.getAttribute("value")).toBe(valueToCopy);
            const descriptionInput = await conDialog.findElement(locator.dbConnectionDialog.description);
            await DialogHelper.clearInputField(descriptionInput);
            await descriptionInput.sendKeys("testing");
            const valueToCut = await descriptionInput.getAttribute("value");
            await Os.keyboardSelectAll(descriptionInput);
            await Os.keyboardCut(descriptionInput);
            expect(await descriptionInput.getAttribute("value")).toBe("");
            const schemaInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.defaultSchema);
            await Os.keyboardPaste(schemaInput);
            expect(await schemaInput.getAttribute("value")).toBe(valueToCut);
            await conDialog.findElement(locator.dbConnectionDialog.cancel).click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
