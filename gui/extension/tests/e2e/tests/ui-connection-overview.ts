/*
 * Copyright (c) 2025 Oracle and/or its affiliates.
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


import { join } from "path";
import fs from "fs/promises";
import {
    BottomBarPanel, Condition,
    until, WebElement, ActivityBar,
} from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/Misc";
import { DatabaseConnectionDialog } from "../lib/WebViews/Dialogs/DatabaseConnectionDialog";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import { DialogHelper } from "../lib/WebViews/Dialogs/DialogHelper";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";
import { E2EScript } from "../lib/WebViews/E2EScript";
import { TestQueue } from "../lib/TestQueue";
import { E2ECommandResultGrid } from "../lib/WebViews/CommandResults/E2ECommandResultGrid";
import { PasswordDialog } from "../lib/WebViews/Dialogs/PasswordDialog";

describe("DB Connection Overview", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `conn-port:${parseInt(process.env.MYSQL_1107, 10)}`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1107, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const duplicateConnection: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eDuplicateFromGlobal",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1107, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const dbConnectionOverview = new DatabaseConnectionOverview();
    let existsInQueue = false;
    let sslConn: interfaces.IDBConnection;

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Os.appendToExtensionLog("beforeAll DATABASE CONNECTIONS");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Workbench.dismissNotifications();
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption), constants.waitForTreeItem);
            await new BottomBarPanel().toggle(false);

            const closeHeaderButton = await driver.findElements(locator.dbConnectionOverview.closeHeader);

            if (closeHeaderButton.length > 0) {
                await closeHeaderButton[0].click();
            }

            await dbTreeSection.clickToolbarButton(constants.collapseAll);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    beforeEach(async function () {
        await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        try {
            await dbConnectionOverview.toolbar.editorSelector
                .selectEditor(new RegExp(constants.dbConnectionsLabel));
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    afterEach(async function () {

        if (this.currentTest.state === "failed") {
            await Misc.processFailure(this);
        }

        if (existsInQueue) {
            await TestQueue.pop(this.currentTest.title);
            existsInQueue = false;
        }

    });

    after(async function () {

        try {
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });


    it("MySQL Database connection - Verify mandatory fields", async () => {

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait1second * 5, "Connection dialog was not displayed");

        const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
        const hostname = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);

        await DialogHelper.clearInputField(caption);
        await DialogHelper.clearInputField(hostname);

        await conDialog.findElement(locator.dbConnectionDialog.ok).click();
        await driver.wait(async () => {
            return (await conDialog.findElements(locator.dbConnectionDialog.errorMessage)).length > 0;
        }, constants.wait1second * 5, "The DB Connection dialog should have errors");

        const dialogErrors = await conDialog.findElements(locator.dbConnectionDialog.errorMessage);
        const errorMsgs = await Promise.all(
            dialogErrors.map((item: WebElement) => {
                return item.getText();
            }));
        expect(errorMsgs, `Could not find the error message 'The user name must not be empty' on the dialog`)
            .to.include("The user name must not be empty");
        expect(await caption.getAttribute("value"), errors.captionError("New Connection",
            await caption.getAttribute("value"))).to.include("New Connection");
        let error = `The hostname should be 'localhost'`;
        error += ` but found ${await hostname.getAttribute("value")}`;
        expect(await hostname.getAttribute("value"), error).to.equals("localhost");
        await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

    });

    it("SQLite Database connection - Verify mandatory fields", async () => {

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait1second * 5, "Connection dialog was not displayed");

        await conDialog.findElement(locator.dbConnectionDialog.databaseType).click();
        const popup = await driver.wait(until.elementLocated(locator.dbConnectionDialog.databaseTypeList),
            constants.wait1second * 5, "Database type popup was not found");
        await popup.findElement(locator.dbConnectionDialog.databaseTypeSqlite).click();

        const caption = await conDialog.findElement(locator.dbConnectionDialog.caption);
        await DialogHelper.clearInputField(caption);

        await conDialog.findElement(locator.dbConnectionDialog.ok).click();
        await driver.wait(async () => {
            return (await conDialog.findElements(locator.dbConnectionDialog.errorMessage)).length > 0;
        }, constants.wait1second * 5, "The DB Connection dialog should have errors");

        const dialogErrors = await conDialog.findElements(locator.dbConnectionDialog.errorMessage);
        const errorMsgs = await Promise.all(
            dialogErrors.map((item: WebElement) => {
                return item.getText();
            }));
        expect(await caption.getAttribute("value"), errors.captionError("New Connection",
            await caption.getAttribute("value"))).to.include("New Connection");
        expect(errorMsgs, "'Specify the path to an existing Sqlite DB file' error was not found on the dialog")
            .to.include("Specify the path to an existing Sqlite DB file");
        await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

    });

    it("Connect to SQLite database", async () => {

        const sqliteConn = Object.assign({}, globalConn);
        sqliteConn.dbType = "Sqlite";
        sqliteConn.caption = `e2eSqliteConnection`;

        if (Os.isLinux()) {
            process.env.USERPROFILE = process.env.HOME;
        }

        sqliteConn.basic = {
            dbPath: join(process.cwd(), "e2e_test.sqlite3"),
            dbName: "SQLite",
        };
        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        await DatabaseConnectionDialog.setConnection(sqliteConn);
        const sqliteWebConn = dbConnectionOverview.getConnection(sqliteConn.caption);

        await driver.executeScript(
            "arguments[0].click();",
            sqliteWebConn,
        );

        const notebook = new E2ENotebook();
        await driver.wait(notebook.untilIsOpened(sqliteConn), constants.waitConnectionOpen);
        await dbTreeSection.focus();
        await dbTreeSection.clickToolbarButton(constants.reloadConnections);
        await driver.wait(new Condition("", async () => {
            const item = await dbTreeSection.getTreeItem(sqliteConn.caption);
            await item.expand();

            return item.isExpanded();
        }), constants.wait1second * 10, `${sqliteConn.caption} was not expanded`);

        await driver.wait(new Condition("", async () => {
            const item = await dbTreeSection.getTreeItem("main");
            await item.expand();

            return item.isExpanded();
        }), constants.wait1second * 10, `main was not expanded`);

        await driver.wait(new Condition("", async () => {
            const item = await dbTreeSection.getTreeItem("Tables");
            await item.expand();

            return item.isExpanded();
        }), constants.wait1second * 10, `Tables was not expanded`);

        const result = await notebook.executeWithButton("SELECT * FROM main.db_connection;",
            constants.execFullBlockSql) as E2ECommandResultGrid;
        expect(result.status).to.match(/OK/);
    });

    it("Connect to MySQL database using SSL", async () => {

        sslConn = Object.assign({}, globalConn);
        sslConn.caption = `e2eSSLConnection`;

        sslConn.ssl = {
            mode: "Require and Verify CA",
            caPath: join(process.env.SSL_CERTIFICATES_PATH, "ca.pem"),
            clientCertPath: join(process.env.SSL_CERTIFICATES_PATH, "client-cert.pem"),
            clientKeyPath: join(process.env.SSL_CERTIFICATES_PATH, "client-key.pem"),
        };

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        await DatabaseConnectionDialog.setConnection(sslConn);
        const dbConn = dbConnectionOverview.getConnection(sslConn.caption);

        await driver.executeScript("arguments[0].click();", dbConn);
        const notebook = new E2ENotebook();
        await driver.wait(notebook.untilIsOpened(sslConn), constants.waitConnectionOpen);
        const query =
            `select * from performance_schema.session_status where variable_name in
                ("ssl_cipher") and variable_value like "%TLS%";`;

        const result = await notebook.codeEditor.execute(query) as E2ECommandResultGrid;
        expect(result.status).to.match(/1 record retrieved/);
    });

    it("Copy paste and cut paste into the DB Connection dialog", async function () {

        await TestQueue.push(this.test.title);
        existsInQueue = true;
        await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
            constants.wait1second * 5, "Connection dialog was not displayed");
        const hostNameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
        const valueToCopy = await hostNameInput.getAttribute("value");
        await driver.wait(async () => {
            await Os.keyboardSelectAll(hostNameInput);
            await Os.keyboardCopy(hostNameInput);
            const usernameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
            await Os.keyboardPaste(usernameInput);

            return (await usernameInput.getAttribute("value")).includes(valueToCopy);
        }, constants.wait1second * 15, `Could not copy paste ${valueToCopy} to user name field`);

        expect(await hostNameInput.getAttribute("value"),
            "Hostname value should stay the same after copying it to the clipboard").to.equal(valueToCopy);
        const descriptionInput = await conDialog.findElement(locator.dbConnectionDialog.description);
        await DialogHelper.clearInputField(descriptionInput);
        await descriptionInput.sendKeys("testing");
        const valueToCut = await descriptionInput.getAttribute("value");
        await Os.keyboardSelectAll(descriptionInput);
        await Os.keyboardCut(descriptionInput);
        expect(await descriptionInput.getAttribute("value"), "Description value was not cut").to.equals("");
        const schemaInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.defaultSchema);
        await Os.keyboardPaste(schemaInput);
        expect(await schemaInput.getAttribute("value"),
            "Hostname value was not pasted to the description field").to.include(valueToCut);
        await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

    });

    it("Edit a MySQL connection", async () => {

        const editConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: `e2eConnectionToEdit`,
            description: "Local connection",
            basic: {
                hostname: "localhost",
                username: String(process.env.DBUSERNAME1),
                port: 3308,
                schema: "sakila",
                password: String(process.env.DBPASSWORD1),
            },
            folderPath: {
                value: "/",
            },
        };

        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        await DatabaseConnectionDialog.setConnection(editConn);
        await dbConnectionOverview.moreActions(editConn.caption, constants.editConnection);
        editConn.caption = "e2eEditedCaption";
        editConn.description = "edited description";

        if (interfaces.isMySQLConnection(editConn.basic)) {
            editConn.basic.hostname = "hostname edited";
            editConn.basic.username = "username edited";
            editConn.basic.schema = "edited schema";
            editConn.basic.ociBastion = false;
            editConn.basic.protocol = "mysqlx";
            editConn.basic.port = 3305;
            editConn.basic.sshTunnel = true;
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
        expect(verifyConn).to.deep.equal(editConn);

    });

    it("Edit an Sqlite connection", async () => {

        const editSqliteConn: interfaces.IDBConnection = {
            dbType: "Sqlite",
            caption: `e2eSqliteConnectionToEdit`,
            description: "Local connection",
            basic: {
                dbPath: join(process.env.TEST_RESOURCES_PATH,
                    `mysqlsh-${String(process.env.TEST_SUITE)}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                dbName: "SQLite",
            },
            advanced: {
                params: "one parameter",
            },
            folderPath: {
                value: "/",
            },
        };

        const dbConnectionDialog = DatabaseConnectionDialog;
        await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
        await dbConnectionDialog.setConnection(editSqliteConn);
        await dbConnectionOverview.moreActions(editSqliteConn.caption, constants.editConnection);
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
        expect(verifyConn).to.deep.equal(editSqliteConn);

    });

    it("Duplicate a MySQL Connection", async () => {

        await dbConnectionOverview.moreActions(globalConn.caption, constants.dupConnection);
        await DatabaseConnectionDialog.setConnection(duplicateConnection);
        await driver.wait(dbConnectionOverview.untilConnectionExists(duplicateConnection.caption),
            constants.wait1second * 5);

    });

    it("Duplicate a Sqlite Connection", async () => {

        const sqliteConn: interfaces.IDBConnection = {
            dbType: "Sqlite",
            caption: `e2eSqliteConnectionToDuplicate`,
            description: "Local connection",
            basic: {
                dbPath: join(process.env.TEST_RESOURCES_PATH,
                    `mysqlsh-${String(process.env.TEST_SUITE)}`,
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
        await dbConnectionOverview.moreActions(sqliteConn.caption, constants.dupConnection);
        const duplicateSqlite: interfaces.IDBConnection = {
            dbType: "Sqlite",
            caption: "e2eDuplicateSqliteFromGlobal",
        };
        await dbConnectionDialog.setConnection(duplicateSqlite);
        await driver.wait(dbConnectionOverview.untilConnectionExists(duplicateSqlite.caption),
            constants.wait1second * 5);

    });

    it("Remove a MySQL connection", async () => {

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
        await dbConnectionOverview.moreActions(connectionToRemove.caption, constants.removeConnection);
        const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
            constants.wait1second * 5, "confirm dialog was not found");

        await dialog.findElement(locator.confirmDialog.accept).click();
        await driver.wait(dbConnectionOverview.untilConnectionDoesNotExist(connectionToRemove.caption),
            constants.wait1second * 5);

    });

    it("Remove a Sqlite connection", async () => {

        const sqliteConnectionToRemove = "e2eSqliteConnectionToDuplicate";
        await dbConnectionOverview.moreActions(sqliteConnectionToRemove, constants.removeConnection);
        const dialog = await driver.wait(until.elementLocated(locator.confirmDialog.exists),
            constants.wait1second * 5, "confirm dialog was not found");
        await dialog.findElement(locator.confirmDialog.accept).click();
        await dbTreeSection.focus();
        await driver.wait(dbTreeSection.untilIsNotLoading(), constants.waitSectionNoProgressBar);
        expect(await dbConnectionOverview.existsConnection(sqliteConnectionToRemove)).to.be.false;

    });

    it("Create new notebook", async () => {

        const connection = await dbConnectionOverview.getConnection(globalConn.caption);
        const newNotebook = await connection.findElement(locator.dbConnectionOverview.dbConnection.newNotebook);
        await driver.actions().move({ origin: newNotebook }).perform();
        await driver.wait(until.elementIsVisible(newNotebook), constants.wait1second * 5,
            "New notebook button was not visible");
        await newNotebook.click();
        await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.waitConnectionOpen);
        const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
        const dbNotebook = await openEditorsSection.getTreeItem(constants.openEditorsDBNotebook);
        expect(dbNotebook).to.exist;

    });

    it("Create new script", async () => {

        const connection = await dbConnectionOverview.getConnection("e2eDuplicateFromGlobal");
        const newScript = await connection.findElement(locator.dbConnectionOverview.dbConnection.newScript);
        await driver.actions().move({ origin: newScript }).perform();
        await driver.wait(until.elementIsVisible(newScript), constants.wait1second * 5,
            "New script button was not visible");
        await driver.executeScript("arguments[0].click()", newScript);
        await driver.wait(new E2EScript().untilIsOpened(duplicateConnection), constants.wait1second * 5);
        const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
        await openEditorsSection.focus();
        const script = await openEditorsSection.getTreeItem("Script");
        expect(script).to.exist;

    });

    it("Open new shell console", async () => {

        await driver.wait(until.elementLocated(locator.dbConnectionOverview.newConsoleButton),
            constants.wait1second * 10).click();
        await driver.wait(new E2EShellConsole().untilIsOpened(globalConn),
            constants.waitShellOpen, "Shell Console was not loaded");

    });

    it("Open 3 notebooks for the same database connection", async () => {
        const dbConnectionOverview = new DatabaseConnectionOverview();
        const connection = await dbConnectionOverview.getConnection(globalConn.caption);
        await connection.click();
        const notebook = new E2ENotebook();
        await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbConnectionsLabel));
        await dbConnectionOverview.openNotebookUsingKeyboard(globalConn.caption);

        await driver.wait(async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(globalConn);

                return true;
            }
        }, constants.wait1second * 5, "Could not find the Password Dialog for second connection");


        await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbConnectionsLabel));
        await dbConnectionOverview.openNotebookUsingKeyboard(globalConn.caption);
        await driver.wait(async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(globalConn);

                return true;
            }
        }, constants.wait1second * 5, "Could not find the Password Dialog for third connection");

        await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbConnectionsLabel));
        await dbConnectionOverview.openNotebookUsingKeyboard(globalConn.caption);
        await driver.wait(async () => {
            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(globalConn);

                return true;
            }
        }, constants.wait1second * 5, "Could not find the Password Dialog for forth connection");

        const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
        await openEditorsSection.focus();

        expect(await openEditorsSection.treeItemExists(`${globalConn.caption}`)).to.equals(true);
        expect(await openEditorsSection.treeItemExists(`${globalConn.caption} (2)`)).to.equals(true);
        expect(await openEditorsSection.treeItemExists(`${globalConn.caption} (3)`)).to.equals(true);

        await Workbench.closeAllEditors();
        expect(await openEditorsSection.treeItemExists(`${globalConn.caption}`)).to.equals(false);
        expect(await openEditorsSection.treeItemExists(`${globalConn.caption} (2)`)).to.equals(false);
        expect(await openEditorsSection.treeItemExists(`${globalConn.caption} (3)`)).to.equals(false);
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
                username: String(process.env.DBUSERNAME1),
                port: parseInt(process.env.MYSQL_1107, 10),
                schema: "sakila",
                password: String(process.env.DBPASSWORD1),
            },
        };

        const connectionOverview = new DatabaseConnectionOverview();
        let testFailed = false;

        before(async () => {
            try {
                const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
                await openEditorsSection.expand();
                await (await openEditorsSection.getTreeItem(constants.dbConnectionsLabel)).click();
                await dbTreeSection.focus();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async () => {
            try {
                await dbTreeSection.focus();
                await (await connectionOverview.getBreadCrumbLinks())[0].click();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.processFailure(this);
            }
        });

        it("Add MySQL connection to new folder", async () => {

            await dbTreeSection.focus();
            await connectionOverview.addNewConnection(dbConnection1);
            await driver.wait(connectionOverview.untilGroupExists(dbConnection1.folderPath.value),
                constants.wait1second * 5);
            await connectionOverview.joinGroup(dbConnection1.folderPath.value);
            await driver.wait(connectionOverview.untilConnectionExists(dbConnection1.caption),
                constants.wait1second * 3);

            expect(await connectionOverview.getBreadCrumb()).to.equals(`/${dbConnection1.folderPath.value}/`);
            await driver.wait(dbTreeSection.untilTreeItemExists(dbConnection1.folderPath.value),
                constants.wait1second * 5);

            await driver.wait(dbTreeSection.untilTreeItemHasChildren(dbConnection1.folderPath.value),
                constants.wait1second * 5);
            const folder = await dbTreeSection.getTreeItem(dbConnection1.folderPath.value);
            expect(await (await folder.getChildren())[0].getLabel()).to.equals(dbConnection1.caption);

        });

        it("Add MySQL connection to subfolder", async () => {

            await connectionOverview.addNewConnection(dbConnection2);
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.expandTree(dbConnection2.folderPath.value.split("/").filter((item) => {
                return item !== "";
            }));

            const group1 = dbConnection2.folderPath.value.split("/")[1];
            const group2 = dbConnection2.folderPath.value.split("/")[2];

            await connectionOverview.joinGroup(group1);
            await driver.wait(connectionOverview.untilGroupExists(group2), constants.wait1second * 5);

            await connectionOverview.joinGroup(group2);
            expect(await connectionOverview.existsConnection(dbConnection2.caption)).to.be.true;
            await driver.wait(dbTreeSection.untilTreeItemExists(group2),
                constants.wait1second * 5);

            const group2TreeItem = await dbTreeSection.getTreeItem(group2);
            expect(await (await group2TreeItem.getChildren())[0].getLabel()).to.equals(dbConnection2.caption);

        });

        it("Add Sqlite connection to new folder", async () => {

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
            await driver.wait(connectionOverview.untilGroupExists(dbConnection.folderPath.value),
                constants.wait1second * 5);
            await connectionOverview.joinGroup(dbConnection.folderPath.value);
            await driver.wait(connectionOverview.untilConnectionExists(dbConnection.caption),
                constants.wait1second * 3);

            expect(await connectionOverview.getBreadCrumb()).to.equals(`/${dbConnection.folderPath.value}/`);
            await driver.wait(dbTreeSection.untilTreeItemExists(dbConnection.folderPath.value),
                constants.wait1second * 5);

            await driver.wait(dbTreeSection.untilTreeItemHasChildren(dbConnection.folderPath.value),
                constants.wait1second * 5);

            const folder = await dbTreeSection.getTreeItem(dbConnection.folderPath.value);
            expect(await (await folder.getChildren())[0].getLabel()).to.equals(dbConnection.caption);

        });

        it("Add Sqlite connection to subfolder", async () => {

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
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.expandTree(dbConnection.folderPath.value.split("/").filter((item) => {
                return item !== "";
            }));

            const sqliteGroup1 = dbConnection.folderPath.value.split("/")[1];
            const sqliteGroup2 = dbConnection.folderPath.value.split("/")[2];

            await connectionOverview.joinGroup(sqliteGroup1);
            await driver.wait(connectionOverview.untilGroupExists(sqliteGroup2), constants.wait1second * 5);

            await connectionOverview.joinGroup(sqliteGroup2);
            expect(await connectionOverview.existsConnection(dbConnection.caption)).to.be.true;
            await driver.wait(dbTreeSection.untilTreeItemExists(sqliteGroup2),
                constants.wait1second * 5);

            await driver.wait(dbTreeSection.untilTreeItemHasChildren(sqliteGroup2),
                constants.wait1second * 5);

            const folder = await dbTreeSection.getTreeItem(sqliteGroup2);
            expect(await (await folder.getChildren())[0].getLabel()).to.equals(dbConnection.caption);

        });

        it("Add Subfolder", async () => {

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
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.openContextMenuAndSelect(dbConnection.folderPath.value,
                constants.addSubfolder);
            await Workbench.setInputPath(subFolder);
            await dbTreeSection.expandTreeItem(dbConnection.folderPath.value);
            await driver.wait(dbTreeSection.untilTreeItemExists(subFolder), constants.wait1second * 5);

        });

        it("Navigate through folders and subfolders", async () => {

            await dbTreeSection.openContextMenuAndSelect("2group", constants.addSubfolder);
            await Workbench.setInputPath("3group");
            await dbTreeSection.expandTreeItem("2group");
            await driver.wait(dbTreeSection.untilTreeItemExists("3group"), constants.wait1second * 5);

            await dbTreeSection.openContextMenuAndSelect("3group", constants.addSubfolder);
            await Workbench.setInputPath("4group");
            await dbTreeSection.expandTreeItem("3group");
            await driver.wait(dbTreeSection.untilTreeItemExists("4group"), constants.wait1second * 5);

            await (await connectionOverview.getBreadCrumbLinks())[0].click();
            await connectionOverview.joinGroup("1group");
            await connectionOverview.joinGroup("2group");
            await connectionOverview.joinGroup("3group");
            await connectionOverview.joinGroup("4group");

            // USING BACK BUTTON
            await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/3group/4group/`),
                constants.wait1second * 3);
            await driver.findElement(locator.dbConnectionOverview.back).click();
            await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/3group/`),
                constants.wait1second * 3);
            await driver.findElement(locator.dbConnectionOverview.back).click();
            await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/2group/`),
                constants.wait1second * 3);
            await driver.findElement(locator.dbConnectionOverview.back).click();
            await driver.wait(connectionOverview.untilBreadCrumbIs(`/1group/`),
                constants.wait1second * 3);
            await driver.findElement(locator.dbConnectionOverview.back).click();
            await driver.wait(connectionOverview.untilBreadCrumbIs(`/`),
                constants.wait1second * 3);

            await connectionOverview.joinGroup("1group");
            await connectionOverview.joinGroup("2group");
            await connectionOverview.joinGroup("3group");
            await connectionOverview.joinGroup("4group");

            // USING BREADCRUMB LINKS
            let breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
            await breadCrumbLinks[breadCrumbLinks.length - 2].click();
            expect(await connectionOverview.getBreadCrumb()).to.equals(`/1group/2group/3group/`);

            breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
            await breadCrumbLinks[breadCrumbLinks.length - 2].click();
            expect(await connectionOverview.getBreadCrumb()).to.equals(`/1group/2group/`);

            breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
            await breadCrumbLinks[breadCrumbLinks.length - 2].click();
            expect(await connectionOverview.getBreadCrumb()).to.equals(`/1group/`);

            breadCrumbLinks = await connectionOverview.getBreadCrumbLinks();
            await breadCrumbLinks[0].click();
            expect(await connectionOverview.getBreadCrumb()).to.equals(`/`);

        });

        it("Move MySQL connection to folder", async () => {

            const dbConnection = {
                dbType: "MySQL",
                folderPath: {
                    new: false,
                    value: `/${dbConnection1.folderPath.value}`,
                },
                basic: {
                    hostname: "localhost",
                    username: "test",
                },
            };

            await dbTreeSection.expandTree(dbConnection2.folderPath.value.split("/").filter((item) => {
                return item !== "";
            }));

            await dbTreeSection.openContextMenuAndSelect(dbConnection2.caption, constants.editDBConnection);
            await DatabaseConnectionDialog.setConnection(dbConnection);

            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.focus();
            const treeFolder = await dbTreeSection.getTreeItem(dbConnection1.folderPath.value);

            const children = await treeFolder.getChildren();
            const childrenNames: string[] = [];

            for (const child of children) {
                childrenNames.push(await child.getLabel());
            }

            expect(childrenNames).to.include(dbConnection2.caption);
            await (await connectionOverview.getGroup(dbConnection.folderPath.value.slice(1))).click();
            expect(await connectionOverview.existsConnection(dbConnection1.caption)).to.be.true;

        });

        it("Edit a folder", async () => {


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
            await dbTreeSection.openContextMenuAndSelect(dbConnection.folderPath.value, constants.editFolder);
            await Workbench.setInputPath("Edited group");
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await driver.wait(dbTreeSection.untilTreeItemExists(editedGroup), constants.waitForTreeItem);
            await driver.wait(connectionOverview.untilGroupExists(editedGroup), constants.wait1second * 5);

        });

        it("Edit subfolder", async () => {

            const editedFolderName = "Edited subfolder";
            await dbTreeSection.openContextMenuAndSelect(dbConnection2.folderPath.value.split("/")[2],
                constants.editFolder);
            await Workbench.setInputPath(editedFolderName);
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await driver.wait(dbTreeSection.untilTreeItemExists(editedFolderName), constants.waitForTreeItem);
            await connectionOverview.joinGroup(dbConnection1.folderPath.value);
            await driver.wait(connectionOverview.untilGroupExists(editedFolderName), constants.wait1second * 5);

        });

        it("Remove empty folder", async () => {

            await dbTreeSection.openContextMenuAndSelect("4group", constants.removeFolder);
            await Workbench.pushDialogButton("Delete Folder");
            await driver.wait(Workbench
                // eslint-disable-next-line max-len
                .untilNotificationExists(`The connection group "4group" has been deleted.`,
                    true, true), constants.wait1second * 5);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists("4group"));
            }, constants.wait1second * 5, "4group should not exist on the tree");

        });

        it("Remove folder with connections", async () => {

            await dbTreeSection.openContextMenuAndSelect(dbConnection1.folderPath.value,
                constants.removeFolder);
            await Workbench.pushDialogButton("Delete Folder");
            await driver.wait(Workbench
                // eslint-disable-next-line max-len
                .untilNotificationExists(`The connection group "${dbConnection1.folderPath.value}" has been deleted.`,
                    true, true), constants.wait1second * 5);
            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(dbConnection1.folderPath.value));
            }, constants.wait1second * 5, `${dbConnection1.folderPath.value} should not exist on the tree`);

        });

        it("Import MySQL Workbench DB Connections", async () => {
            try {
                const hostname = (importedDBConnection.basic as interfaces.IConnBasicMySQL).hostname;
                const port = (importedDBConnection.basic as interfaces.IConnBasicMySQL).port;
                const username = (importedDBConnection.basic as interfaces.IConnBasicMySQL).username;
                const schema = (importedDBConnection.basic as interfaces.IConnBasicMySQL).schema;

                const xml = constants.validXMLConnection
                    .replace(/<HOSTNAME>/g, hostname)
                    .replace(/<PORT>/g, String(port))
                    .replace(/<USERNAME>/g, username)
                    .replace(/<SCHEMA>/g, schema)
                    .replace(/<CAPTION>/g, importedDBConnection.caption);

                const xmlFile = join(process.cwd(), "connections.xml");
                await fs.writeFile(xmlFile, xml);

                await dbTreeSection.selectMoreActionsItem(constants.importMySQLWorkbenchConnections);
                await Workbench.setInputPath(xmlFile);
                await driver.wait(Workbench.untilNotificationExists("Imported 1 connection from MySQL Workbench."),
                    constants.wait1second * 5);

                await driver.wait(dbTreeSection.untilTreeItemExists(constants.importedConnections),
                    constants.wait1second * 5);
                await dbTreeSection.expandTreeItem(constants.importedConnections);
                await dbTreeSection.expandTreeItem(importedDBConnection.caption, importedDBConnection);

                await dbTreeSection.openContextMenuAndSelect(constants.importedConnections,
                    constants.removeFolder);
                await Workbench.pushDialogButton("Delete Folder");
                await driver.wait(Workbench
                    // eslint-disable-next-line max-len
                    .untilNotificationExists(`The connection group "${constants.importedConnections}" has been deleted.`,
                        true, true), constants.wait1second * 5);
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
                    .replace(/<HOSTNAME>/g, hostname)
                    .replace(/<PORT>/g, String(port))
                    .replace(/<SCHEMA>/g, schema);

                const xmlFile = join(process.cwd(), "invalid_connections.xml");
                await fs.writeFile(xmlFile, xml);

                await dbTreeSection.selectMoreActionsItem(constants.importMySQLWorkbenchConnections);
                await Workbench.setInputPath(xmlFile);

                await driver.wait(Workbench
                    .untilNotificationExists("Could not parse XML file: Unclosed tag: value", true, true),
                    constants.wait1second * 5);

                expect(await dbTreeSection.treeItemExists(constants.importedConnections)).to.be.false;
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

});


