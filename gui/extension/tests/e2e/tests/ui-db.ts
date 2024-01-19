/*
 * Copyright (c) 2022, 2024 Oracle and/or its affiliates.
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
import { join } from "path";
import fs from "fs/promises";
import {
    BottomBarPanel, Condition, TreeItem,
    until, WebElement, Workbench as extWorkbench, ActivityBar, CustomTreeItem,
} from "vscode-extension-tester";
import { expect } from "chai";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/misc";
import { DatabaseConnection } from "../lib/webviews/dbConnection";
import { Notebook } from "../lib/webviews/notebook";
import { CommandExecutor } from "../lib/cmdExecutor";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import { DialogHelper } from "../lib/webviews/dialogHelper";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";

describe("DATABASE CONNECTIONS", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBSHELLUSERNAME) {
        throw new Error("Please define the environment variable DBSHELLUSERNAME");
    }
    if (!process.env.DBSHELLPASSWORD) {
        throw new Error("Please define the environment variable DBSHELLPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }
    if (!process.env.SSL_ROOT_FOLDER) {
        throw new Error("Please define the environment variable SSL_ROOT_FOLDER");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `globalDBConnenction`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Workbench.dismissNotifications();
            await Workbench.toggleBottomBar(false);
            await Workbench.removeAllDatabaseConnections();
            await Section.createDatabaseConnection(globalConn);
            await Workbench.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            if (await Workbench.requiresMRSMetadataUpgrade(globalConn)) {
                await Workbench.upgradeMRSMetadata();
            }
            await Section.focus(constants.dbTreeSection);
        } catch (e) {
            await Misc.processFailure(this);
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            await Workbench.removeAllDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Toolbar", () => {

        let treeConn: TreeItem;

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        it("Reload the connection list", async () => {

            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.clickToolbarButton(treeDBSection, "Reload the connection list");
            expect(await Tree.existsElement(constants.dbTreeSection, globalConn.caption),
                errors.doesNotExistOnTree(globalConn.caption)).to.be.true;

        });

        it("Collapse All", async () => {

            treeConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            await Tree.expandDatabaseConnection(treeConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            const treeGlobalSchema = await Tree.getElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await treeGlobalSchema.expand();
            const treeGlobalSchemaTables = await Tree.getElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const treeGlobalSchemaViews = await Tree.getElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.clickToolbarButton(treeDBSection, constants.collapseAll);
            let visibleItems: CustomTreeItem[];
            await driver.wait(async () => {
                visibleItems = await treeDBSection.getVisibleItems();
                if (visibleItems.length > 0) {
                    for (const item of visibleItems) {
                        if (await item.getAttribute("aria-level") !== "1") {
                            return false;
                        }
                    }

                    return true;
                }
            }, constants.wait5seconds, "The tree is not fully collapsed");
        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(Os.getMysqlshLog());
            await Section.restartShell();

            try {
                await driver.wait(async () => {
                    const text = await fs.readFile(Os.getMysqlshLog());
                    if (text.includes("Registering session...")) {
                        return true;
                    }
                }, 20000, "Restarting the internal MySQL Shell server went wrong");
            } finally {
                console.log("<<<<MySQLSH Logs>>>>");
                await Os.writeMySQLshLogs();
            }

        });

        it("Relaunch Welcome Wizard", async () => {
            await Workbench.closeAllEditors();
            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.selectMoreActionsItem(treeDBSection, constants.relaunchWelcomeWizard);
            await driver.wait(waitUntil.tabIsOpened(constants.welcomeTab), constants.wait5seconds);
            const active = await Workbench.getActiveTab();
            let error = `The active tab should be ${constants.welcomeTab}`;
            error += `, but found ${await active.getTitle()}`;
            expect(await active.getTitle(), error).equals(constants.welcomeTab);
            await driver.wait(until.ableToSwitchToFrame(0), constants.wait5seconds, "Not able to switch to frame 0");
            await driver.wait(until.ableToSwitchToFrame(
                locator.iframe.isActive), constants.wait5seconds, "Not able to switch to frame 2");
            const text = await driver.findElement(locator.welcomeWizard.title).getText();
            expect(text, `The Welcome wizard title should be ${constants.welcome}, but found ${text}`)
                .equals(constants.welcome);
            expect(await driver.findElement(locator.welcomeWizard.nextButton),
                `Next button does not exist on the welcome wizard`).to.exist;

        });

        it("Reset MySQL Shell for VS Code Extension", async () => {
            await Workbench.closeAllEditors();
            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.selectMoreActionsItem(treeDBSection, constants.resetExtension);
            let notif = "This will completely reset the MySQL Shell for VS Code extension by ";
            notif += "deleting the web certificate and user settings directory.";
            const ntf = await Workbench.getNotification(notif, false);
            await Workbench.clickOnNotificationButton(ntf, constants.cancel);

        });
    });

    describe("Database connections", () => {

        before(async function () {
            try {
                await new BottomBarPanel().toggle(false);
                await Os.deleteCredentials();
                await Section.focus(constants.openEditorsTreeSection);
                await (await Tree.getElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel)).click();
                await Misc.switchToFrame();
                await driver.wait(until.elementLocated(locator.dbConnectionOverview.exists),
                    constants.wait10seconds, "DB Connection Overview page was not displayed");
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        let sslConn: interfaces.IDBConnection;

        beforeEach(async function () {
            try {
                await Notebook.selectCurrentEditor("DB Connection Overview", "overviewPage");
                await driver.findElement(locator.dbConnectionOverview.newDBConnection).click();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        after(async () => {
            await Workbench.openMySQLShellForVSCode();
        });

        it("MySQL - Verify mandatory fields", async () => {

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
            expect(errorMsgs, `Could not find the error message 'The user name must not be empty' on the dialog`)
                .to.include("The user name must not be empty");
            expect(await caption.getAttribute("value"), errors.captionError("New Connection",
                await caption.getAttribute("value"))).to.include("New Connection");
            let error = `The hostname should be 'localhost'`;
            error += ` but found ${await hostname.getAttribute("value")}`;
            expect(await hostname.getAttribute("value"), error).to.equals("localhost");
            await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

        });

        it("SQLite - Verify mandatory fields", async () => {

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
            expect(await caption.getAttribute("value"), errors.captionError("New Connection",
                await caption.getAttribute("value"))).to.include("New Connection");
            expect(errorMsgs, "'Specify the path to an existing Sqlite DB file' error was not found on the dialog")
                .to.include("Specify the path to an existing Sqlite DB file");
            await conDialog.findElement(locator.dbConnectionDialog.cancel).click();

        });

        it("Connect to SQLite database", async () => {

            const sqliteConn = Object.assign({}, globalConn);
            sqliteConn.dbType = "Sqlite";
            sqliteConn.caption = `SqliteConnection`;

            if (Os.isLinux()) {
                process.env.USERPROFILE = process.env.HOME;
            }

            sqliteConn.basic = {
                dbPath: join(process.env.TEST_RESOURCES_PATH,
                    `mysqlsh-${String(process.env.TEST_SUITE)}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                dbName: "SQLite",
            };

            await DatabaseConnection.setConnection(
                sqliteConn.dbType,
                sqliteConn.caption,
                undefined,
                sqliteConn.basic,
            );

            const sqliteWebConn = await DatabaseConnection.getConnection(sqliteConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                sqliteWebConn,
            );

            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            const commandExecutor = new CommandExecutor();
            await Section.focus(constants.dbTreeSection);
            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.clickToolbarButton(treeDBSection, constants.reloadConnections);
            await driver.wait(new Condition("", async () => {
                const item = await Tree.getElement(constants.dbTreeSection, sqliteConn.caption);
                await item.expand();

                return item.isExpanded();
            }), constants.wait10seconds, `${sqliteConn.caption} was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await Tree.getElement(constants.dbTreeSection, "main");
                await item.expand();

                return item.isExpanded();
            }), constants.wait10seconds, `main was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await Tree.getElement(constants.dbTreeSection, "Tables");
                await item.expand();

                return item.isExpanded();
            }), constants.wait10seconds, `Tables was not expanded`);

            const treeDBConn = await Tree.getElement(constants.dbTreeSection, "db_connection");
            await Tree.openContextMenuAndSelect(treeDBConn, constants.selectRowsInNotebook);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await commandExecutor.loadLastExistingCommandResult();
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage()))
                .to.match(/OK/);

        });

        it("Connect to MySQL database using SSL", async () => {

            sslConn = Object.assign({}, globalConn);
            sslConn.caption = `SSLConnection`;

            sslConn.ssl = {
                mode: "Require and Verify CA",
                caPath: String(process.env.SSL_CA_CERT_PATH),
                clientCertPath: String(process.env.SSL_CLIENT_CERT_PATH),
                clientKeyPath: String(process.env.SSL_CLIENT_KEY_PATH),
            };

            await DatabaseConnection.setConnection(
                sslConn.dbType,
                sslConn.caption,
                undefined,
                sslConn.basic,
                sslConn.ssl,
            );

            const dbConn = await DatabaseConnection.getConnection(sslConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                dbConn,
            );

            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            const query =
                `select * from performance_schema.session_status where variable_name in 
                ("ssl_cipher") and variable_value like "%TLS%" `;
            const cmdExecutor = new CommandExecutor();
            await cmdExecutor.execute(query);
            expect(cmdExecutor.getResultMessage(), errors.queryResultError("1 record retrieved",
                cmdExecutor.getResultMessage()))
                .to.match(/1 record retrieved/);

        });

        it("Copy paste and cut paste into the DB Connection dialog", async () => {
            const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.wait5seconds, "Connection dialog was not displayed");
            const hostNameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname);
            const valueToCopy = await hostNameInput.getAttribute("value");
            await Os.keyboardSelectAll(hostNameInput);
            await Os.keyboardCopy(hostNameInput);
            const usernameInput = await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.username);
            await Os.keyboardPaste(usernameInput);
            expect(await usernameInput.getAttribute("value"), "Hostname value was not copied to the username field")
                .to.include(valueToCopy);
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
        });

    });

    describe("MySQL Administration", () => {

        before(async function () {
            try {
                await Os.deleteCredentials();
                await Workbench.closeAllEditors();
                await Section.focus(constants.dbTreeSection);
                const treeDBSection = await Section.getSection(constants.dbTreeSection);
                await Section.clickToolbarButton(treeDBSection, constants.collapseAll);
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await Tree.expandDatabaseConnection(treeGlobalConn,
                    (globalConn.basic as interfaces.IConnBasicMySQL).password);

                const treeMySQLAdmin = await Tree.getElement(constants.dbTreeSection, constants.mysqlAdmin);
                await treeMySQLAdmin.expand();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        after(async function () {
            try {
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Server Status", async () => {

            await (await Tree.getElement(constants.dbTreeSection, constants.serverStatus)).click();
            expect(await Workbench.getOpenEditorTitles(), errors.tabIsNotOpened(constants.serverStatus))
                .to.include(constants.serverStatus);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            expect(await Notebook.getCurrentEditorName(), `The current editor name should be ${constants.serverStatus}`)
                .to.equals(constants.serverStatus);
            const sections = await driver.findElements(locator.mysqlAdministration.section);
            const headings = [];
            for (const section of sections) {
                headings.push(await section.getText());
            }
            expect(headings, errors.missingTitle("Main Settings")).to.include("Main Settings");
            expect(headings, errors.missingTitle("Server Directories")).to.include("Server Directories");
            expect(headings, errors.missingTitle("Server Features")).to.include("Server Features");
            expect(headings, errors.missingTitle("Server SSL")).to.include("Server SSL");
            expect(headings, errors.missingTitle("Server Authentication")).to.include("Server Authentication");
        });

        it("Client Connections", async () => {

            const clientConn = await Tree.getElement(constants.dbTreeSection, constants.clientConns);
            await clientConn.click();
            expect(await Workbench.getOpenEditorTitles(), errors.tabIsNotOpened(constants.clientConns))
                .to.include(constants.clientConns);
            await driver.wait(async () => {
                return await Notebook.getCurrentEditorName() === constants.clientConns;
            }, constants.wait5seconds, "Clients Connections editor was not selected");
            const properties = await driver.findElements(locator.mysqlAdministration.clientConnections.properties);
            const props = [];
            for (const item of properties) {
                props.push(await item.getAttribute("innerHTML"));
            }

            const test = props.join(",");
            expect(test, errors.missingTitle("Threads Connected")).to.include("Threads Connected");
            expect(test, errors.missingTitle("Threads Running")).to.include("Threads Running");
            expect(test, errors.missingTitle("Threads Created")).to.include("Threads Created");
            expect(test, errors.missingTitle("Threads Cached")).to.include("Threads Cached");
            expect(test, errors.missingTitle("Rejected (over limit)")).to.include("Rejected (over limit)");
            expect(test, errors.missingTitle("Total Connections")).to.include("Total Connections");
            expect(test, errors.missingTitle("Connection Limit")).to.include("Connection Limit");
            expect(test, errors.missingTitle("Aborted Clients")).to.include("Aborted Clients");
            expect(test, errors.missingTitle("Aborted Connections")).to.include("Aborted Connections");
            expect(test, errors.missingTitle("Errors")).to.include("Errors");
            await driver.wait(async () => {
                const list = await driver.findElement(locator.mysqlAdministration.clientConnections.connectionsList);
                const rows = await list.findElements(locator.mysqlAdministration.clientConnections.tableRow);

                return rows.length > 0;
            }, constants.wait5seconds, "Connections list is empty");
        });

        it("Performance Dashboard", async () => {

            const perfDash = await Tree.getElement(constants.dbTreeSection, constants.perfDash);
            await perfDash.click();
            expect(await Workbench.getOpenEditorTitles(), errors.tabIsNotOpened(constants.perfDash))
                .to.include(constants.perfDash);
            await driver.wait(async () => {
                return await Notebook.getCurrentEditorName() === constants.perfDash;
            }, constants.wait5seconds, "Performance Dashboard editor was not selected");

            const grid = await driver.findElement(locator.mysqlAdministration.performanceDashboard.dashboardGrid);
            const gridItems = await grid.findElements(locator.mysqlAdministration.performanceDashboard.gridItems);
            const listItems = [];

            for (const item of gridItems) {
                const label = await item.findElement(locator.htmlTag.label);
                listItems.push(await label.getAttribute("innerHTML"));
            }

            expect(listItems, errors.missingTitle("Network Status")).to.include("Network Status");
            expect(listItems, errors.missingTitle("MySQL Status")).to.include("MySQL Status");
            expect(listItems, errors.missingTitle("InnoDB Status")).to.include("InnoDB Status");

        });

    });

    describe("Context menu items", () => {

        let treeGlobalSchema: TreeItem;
        let treeGlobalSchemaTables: TreeItem;
        let treeGlobalSchemaViews: TreeItem;
        let treeGlobalConn: TreeItem;
        const dumpFolder = join(constants.workspace, "dump");
        const dumpSchemaToDisk = `dump_schema_to_disk`;
        const schemaForMySQLDBService = "schema_for_mysql_db_service";
        const schemaToDrop = "schema_to_drop";
        const tableToDrop = `table_to_drop`;
        const testView = `test_view`;
        const viewToDrop = "view_to_drop";
        const testRoutine = "test_routine";
        const testEvent = "test_event";
        const dup = "duplicatedConnection";
        const commandExecutor = new CommandExecutor();

        before(async function () {
            try {
                await Os.deleteCredentials();
                await Section.focus(constants.dbTreeSection);
                const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
                const treeDBSection = await Section.getSection(constants.dbTreeSection);
                await Section.clickToolbarButton(treeDBSection, constants.collapseAll);
                await Tree.expandDatabaseConnection(treeGlobalConn,
                    (globalConn.basic as interfaces.IConnBasicMySQL).password);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
                commandExecutor.reset();
            }
        });

        after(async () => {
            await fs.rm(dumpFolder, { force: true, recursive: true });
        });

        it("Set this DB Connection as Default", async () => {

            const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.setDBConnDefault);
            await Workbench.getNotification(`"${globalConn.caption}" has been set as default DB Connection`);

        });

        it("Open Database Connection", async () => {

            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.openNewConnection);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);

            const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Section.focus(constants.openEditorsTreeSection);
            expect(await Tree.existsElement(constants.openEditorsTreeSection, globalConn.caption)).to.be.true;

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.openShellConnection);
            await driver.wait(waitUntil.shellSessionIsOpened(globalConn), constants.wait15seconds);
            const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Section.focus(constants.openEditorsTreeSection);
            const treeOEShellConsoles = await Tree.getElement(constants.openEditorsTreeSection,
                constants.mysqlShellConsoles);
            expect(await treeOEShellConsoles.findChildItem(`Session to ${String(globalConn.caption)}`),
                errors.doesNotExistOnTree(`Session to ${String(globalConn.caption)}`)).to.exist;
            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
            expect(treeVisibleItems.length, "No tree items were found on OPEN EDITORS section").to.be.at.least(1);
            expect(await treeVisibleItems[0].getLabel(), errors.doesNotExistOnTree(constants.dbConnectionsLabel))
                .to.equals(constants.dbConnectionsLabel);

        });

        it("Edit MySQL connection", async () => {

            const localConn = Object.assign({}, globalConn);
            localConn.caption = `connectionToEdit`;
            await Section.createDatabaseConnection(localConn);
            await DatabaseConnection.getConnection(localConn.caption);
            const treeLocalConn = await Tree.getElement(constants.dbTreeSection, localConn.caption);
            await Tree.openContextMenuAndSelect(treeLocalConn, constants.editDBConnection);
            await DatabaseConnection.setConnection(
                "MySQL",
                localConn.caption,
                undefined,
                undefined,
            );
            expect(await Tree.existsElement(constants.dbTreeSection, localConn.caption),
                errors.doesNotExistOnTree(localConn.caption)).to.be.true;

        });

        it("Duplicate this MySQL connection", async () => {

            await Section.focus(constants.dbTreeSection);
            treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.duplicateConnection);
            await DatabaseConnection.setConnection(undefined, dup);
            await driver.wait(async () => {
                return (await Tree.existsElement(constants.dbTreeSection, dup)) === true;
            }, constants.wait5seconds, `${dup} does not exist on the tree`);
        });

        it("Delete DB connection", async () => {
            await Section.focus(constants.dbTreeSection);
            const treeDup = await Tree.getElement(constants.dbTreeSection, dup);
            await Tree.openContextMenuAndSelect(treeDup, constants.deleteDBConnection);
            await Misc.switchToFrame();
            const dialog = await driver.wait(until.elementLocated(
                locator.confirmDialog.exists), constants.wait15seconds, "confirm dialog was not found");
            await dialog.findElement(locator.confirmDialog.accept).click();
            await driver.wait(async () => {
                return (await Tree.existsElement(constants.dbTreeSection, dup)) === false;
            }, constants.wait5seconds, `${dup} was not deleted`);
        });

        it("Load SQL Script from Disk", async () => {
            const destFile = join(constants.workspace, "gui", "frontend", "src", "tests", "e2e", "sql", "sakila.sql");
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.loadScriptFromDisk);
            await Workbench.setInputPath(destFile);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await driver.wait(async () => {
                return (await Notebook.getCurrentEditorName()) === "sakila.sql";
            }, constants.wait5seconds, "Current editor is not sakila.sql");
            let error = `The current editor type should be 'Mysql',`;
            error += ` but found ${await Notebook.getCurrentEditorType()}`;
            expect(await Notebook.getCurrentEditorType(), error).to.include("Mysql");
            const scriptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
            expect(scriptLines.length, "The script was not loaded. No lines found on the editor").to.be.greaterThan(0);
            await Notebook.selectCurrentEditor("DB Notebook", "notebook");
            await commandExecutor.syncronizeResultId();
        });

        it("Set as Current Database Schema", async () => {

            treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            await Tree.expandDatabaseConnection(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            const treeSchema = await Tree.getElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await Tree.openContextMenuAndSelect(treeSchema, constants.setCurrentDBSchema, undefined);
            await driver.wait(waitUntil.isDefaultItem(constants.dbTreeSection, "sakila", "schema"),
                constants.wait5seconds);
            await (await Tree.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
            await Workbench.openEditor(globalConn.caption);
            await commandExecutor.execute("SELECT DATABASE();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError((globalConn.basic as interfaces.IConnBasicMySQL).schema))
                .to.match(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema));
            const otherSchema = await Tree.getElement(constants.dbTreeSection, "world_x_cst");
            await Tree.openContextMenuAndSelect(otherSchema, constants.setCurrentDBSchema, undefined);
            await driver.wait(waitUntil.isDefaultItem(constants.dbTreeSection, "world_x_cst", "schema"),
                constants.wait5seconds);
            expect(await Tree.isElementDefault(constants.dbTreeSection, "sakila", "schema"),
                errors.notDefault("sakila")).to.be.false;
            await Workbench.openEditor(globalConn.caption);
            await commandExecutor.execute("SELECT DATABASE();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"),
                errors.queryDataSetError("world_x_cst"))
                .to.match(/world_x_cst/);
            await Workbench.closeAllEditors();
            await driver.wait(async () => {
                return !(await Tree.isElementDefault(constants.dbTreeSection, "world_x_cst", "schema"));
            }, constants.wait5seconds, "world_x_cst should not be the default");
            expect(await Tree.isElementDefault(constants.dbTreeSection, "sakila", "schema"),
                errors.isDefault("sakila")).to.be.false;

        });

        it("Dump Schema to Disk", async () => {
            const treeTestSchema = await Tree.getElement(constants.dbTreeSection, dumpSchemaToDisk);
            treeGlobalSchema = await Tree.getElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await Tree.openContextMenuAndSelect(treeTestSchema, constants.dumpSchemaToDisk);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Workbench.waitForOutputText(`Task 'Dump Schema ${dumpSchemaToDisk} to Disk' completed successfully`,
                constants.wait10seconds);
            const files = await fs.readdir(dumpFolder);
            expect(files.length, `The dump did not exported any files to ${dumpFolder}`).to.be.greaterThan(0);
            await Section.focus(constants.tasksTreeSection);
            expect(await Tree.existsElement(constants.tasksTreeSection,
                `Dump Schema ${dumpSchemaToDisk} to Disk (done)`),
                errors.doesNotExistOnTree(`Dump Schema ${dumpSchemaToDisk} to Disk (done)`)).to.be.true;
            await Section.focus(constants.dbTreeSection);
            await Tree.openContextMenuAndSelect(treeTestSchema, constants.dropSchema, undefined);
            await Workbench.pushDialogButton(`Drop ${dumpSchemaToDisk}`);
            await Workbench.getNotification(`The object ${dumpSchemaToDisk} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, dumpSchemaToDisk),
                errors.existsOnTree(dumpSchemaToDisk)).to.be.false;
        });

        it("Load Dump from Disk", async () => {

            const treeDBSection = await Section.getSection(constants.dbTreeSection);
            await Section.clickToolbarButton(treeDBSection, constants.reloadConnections);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.loadDumpFromDisk);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Workbench.waitForOutputText(/Task 'Loading Dump .* from Disk' completed successfully/,
                constants.wait10seconds);
            await Section.focus(constants.tasksTreeSection);
            expect(await Tree.existsElement(constants.tasksTreeSection, /Loading Dump (.*) \(done\)/),
                errors.doesNotExistOnTree("Loading Dump * (done)")).to.be.true;
            await Section.focus(constants.dbTreeSection);
            await Section.clickToolbarButton(treeDBSection, constants.reloadConnections);
            expect(await Tree.existsElement(constants.dbTreeSection, dumpSchemaToDisk),
                errors.doesNotExistOnTree(dumpSchemaToDisk)).to.be.true;

        });

        it("Dump Schema to Disk for MySQL Database Service", async () => {
            const treeTestSchema = await Tree.getElement(constants.dbTreeSection, schemaForMySQLDBService);
            treeGlobalSchema = await Tree.getElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);

            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await Tree.openContextMenuAndSelect(treeTestSchema, constants.dumpSchemaToDiskToServ);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Workbench
                .waitForOutputText(`Task 'Dump Schema ${schemaForMySQLDBService} to Disk' completed successfully`,
                    constants.wait10seconds);
            const files = await fs.readdir(dumpFolder);
            expect(files.length, `The dump did not exported any files to ${dumpFolder}`).to.be.greaterThan(0);
            await Section.focus(constants.tasksTreeSection);
            expect(await Tree.existsElement(constants.tasksTreeSection,
                `Dump Schema ${schemaForMySQLDBService} to Disk (done)`),
                errors.doesNotExistOnTree(`Dump Schema ${schemaForMySQLDBService} to Disk (done)`)).to.be.true;
        });

        it("Load Data to HeatWave Cluster", async () => {
            await Section.focus(constants.dbTreeSection);
            const sakilaItem = await Tree.getElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await Tree.openContextMenuAndSelect(sakilaItem, constants.loadDataToHW);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await DatabaseConnection.setDataToHeatWave();
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Workbench.getNotification("The data load to the HeatWave cluster operation has finished");
            await new BottomBarPanel().toggle(false);
        });

        it("Drop Schema", async () => {

            const treeTestSchema = await Tree.getElement(constants.dbTreeSection, schemaToDrop);
            await Tree.openContextMenuAndSelect(treeTestSchema, constants.dropSchema, undefined);
            const ntfs = await new extWorkbench().getNotifications();
            if (ntfs.length > 0) {
                await Workbench.clickOnNotificationButton(ntfs[ntfs.length - 1], `Drop ${schemaToDrop}')]`);
            } else {
                await Workbench.pushDialogButton(`Drop ${schemaToDrop}`);
            }
            await Workbench.getNotification(`The object ${schemaToDrop} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, schemaToDrop),
                errors.existsOnTree(schemaToDrop)).to.be.false;

        });

        it("Schema - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Tree.getElement(constants.dbTreeSection,
                        (globalConn.basic as interfaces.IConnBasicMySQL).schema);
                    await Tree.openContextMenuAndSelect(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.schemaCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === (globalConn.basic as interfaces.IConnBasicMySQL).schema;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The schema name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Tree.getElement(constants.dbTreeSection,
                        (globalConn.basic as interfaces.IConnBasicMySQL).schema);
                    await Tree.openContextMenuAndSelect(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.schemaCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("CREATE DATABASE");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The schema create statement was not copied to the clipboard");

        });

        it("Table - Select Rows in DB Notebook", async () => {
            await treeGlobalSchema.expand();
            treeGlobalSchemaTables = await Tree.getElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const actorTable = await Tree.getElement(constants.dbTreeSection, "actor");
            await Tree.openContextMenuAndSelect(actorTable, constants.selectRowsInNotebook);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait10seconds);
            await commandExecutor.loadLastExistingCommandResult(true);
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

        });

        it("Table - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    const actorTable = await Tree.getElement(constants.dbTreeSection, "actor");
                    await Tree.openContextMenuAndSelect(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === "actor";
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The table name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const actorTable = await Tree.getElement(constants.dbTreeSection, "actor");
                    await Tree.openContextMenuAndSelect(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("idx_actor_last_name");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The table create statement was not copied to the clipboard");

        });

        it("Drop Table", async () => {

            const treeTestTable = await Tree.getElement(constants.dbTreeSection, tableToDrop);
            await Tree.openContextMenuAndSelect(treeTestTable, constants.dropTable);
            await Workbench.pushDialogButton(`Drop ${tableToDrop}`);
            await Workbench.getNotification(`The object ${tableToDrop} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, tableToDrop),
                errors.existsOnTree(tableToDrop)).to.be.false;

        });

        it("View - Select Rows in DB Notebook", async () => {
            treeGlobalSchemaViews = await Tree.getElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeTestView = await Tree.getElement(constants.dbTreeSection, testView);
            await Tree.openContextMenuAndSelect(treeTestView, constants.selectRowsInNotebook);
            await commandExecutor.loadLastExistingCommandResult();
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async () => {
            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestView = await Tree.getElement(constants.dbTreeSection, testView);
                    await Tree.openContextMenuAndSelect(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === testView;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }

            }), constants.wait15seconds, "The view name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestView = await Tree.getElement(constants.dbTreeSection, testView);
                    await Tree.openContextMenuAndSelect(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DEFINER VIEW");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The view create statement was not copied to the clipboard");

        });

        it("Drop View", async () => {

            await Tree.expandDatabaseConnection(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await treeGlobalSchema.expand();
            await treeGlobalSchemaViews.expand();
            const treeTestView = await Tree.getElement(constants.dbTreeSection, viewToDrop);
            await Tree.openContextMenuAndSelect(treeTestView, constants.dropView);
            await Workbench.pushDialogButton(`Drop ${viewToDrop}`);
            await Workbench.getNotification(`The object ${viewToDrop} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, viewToDrop),
                errors.doesNotExistOnTree(viewToDrop)).to.be.false;
        });

        it("Table - Show Data", async () => {

            const actorTable = await Tree.getElement(constants.dbTreeSection, "actor");
            await Tree.openContextMenuAndSelect(actorTable, constants.showData);
            await commandExecutor.loadLastScriptResult();
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            await driver.wait(waitUntil.resultTabIsMaximized(), constants.wait5seconds);

        });

        it("View - Show Data", async () => {

            const treeTestView = await Tree.getElement(constants.dbTreeSection, testView);
            await Tree.openContextMenuAndSelect(treeTestView, constants.showData);
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await commandExecutor.loadLastScriptResult();
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);
            await driver.wait(waitUntil.resultTabIsMaximized(), constants.wait5seconds);

        });

        it("Routines - Clipboard", async () => {
            const treeRoutines = await Tree.getElement(constants.dbTreeSection, "Routines");
            await treeRoutines.expand();
            expect(await Tree.existsElement(constants.dbTreeSection, testRoutine),
                errors.doesNotExistOnTree(testRoutine)).to.be.true;
            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestRoutine = await Tree.getElement(constants.dbTreeSection, testRoutine);
                    await Tree.openContextMenuAndSelect(treeTestRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.routinesCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === testRoutine;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }

            }), constants.wait15seconds, "The routine name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestRoutine = await Tree.getElement(constants.dbTreeSection, testRoutine);
                    await Tree.openContextMenuAndSelect(treeTestRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("CREATE DEFINER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds, "The routine create statement was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestRoutine = await Tree.getElement(constants.dbTreeSection, testRoutine);
                    await Tree.openContextMenuAndSelect(treeTestRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardStatDel], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DELIMITER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds,
                "The routine create statement with delimiters was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestRoutine = await Tree.getElement(constants.dbTreeSection, testRoutine);
                    await Tree.openContextMenuAndSelect(treeTestRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardDropStatDel], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DROP") && clipboard.readSync().includes("DELIMITER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait15seconds,
                "The routine drop & create statement with delimiters was not copied to the clipboard");
        });

        it("Routines - Drop Routine", async () => {
            const treeTables = await Tree.getElement(constants.dbTreeSection, "Tables");
            await treeTables.collapse();
            const treeTestRoutine = await Tree.getElement(constants.dbTreeSection, testRoutine);
            await Tree.openContextMenuAndSelect(treeTestRoutine, constants.dropStoredRoutine);
            await Workbench.pushDialogButton(`Drop ${testRoutine}`);
            await Workbench.getNotification(`The object ${testRoutine} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, testRoutine),
                errors.existsOnTree(testRoutine)).to.be.false;
        });

        it("Drop Event", async () => {
            const treeRoutines = await Tree.getElement(constants.dbTreeSection, "Routines");
            await treeRoutines.collapse();
            const treeEvents = await Tree.getElement(constants.dbTreeSection, "Events");
            await treeEvents.expand();
            expect(await Tree.existsElement(constants.dbTreeSection, testEvent),
                errors.doesNotExistOnTree(testEvent)).to.be.true;
            const treeTestEvent = await Tree.getElement(constants.dbTreeSection, testEvent);
            await Tree.openContextMenuAndSelect(treeTestEvent, constants.dropEvent);
            await Workbench.pushDialogButton(`Drop ${testEvent}`);
            await Workbench.getNotification(`The object ${testEvent} has been dropped successfully.`);
            expect(await Tree.existsElement(constants.dbTreeSection, testEvent),
                errors.existsOnTree(testEvent)).to.be.false;
        });

    });

});
