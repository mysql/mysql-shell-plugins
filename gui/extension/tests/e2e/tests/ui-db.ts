/*
 * Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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
import { platform } from "os";
import { join } from "path";
import fs from "fs/promises";
import {
    BottomBarPanel, Condition, EditorView, Key, ModalDialog, TreeItem,
    until, WebElement, Workbench, error, ActivityBar,
} from "vscode-extension-tester";
import { expect } from "chai";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/misc";
import { Database } from "../lib/db";
import * as constants from "../lib/constants";
import * as Until from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";

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
            await driver.wait(Until.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Misc.dismissNotifications();
            await Misc.toggleBottomBar(false);
            await Database.createConnection(globalConn);
            const edView = new EditorView();
            await edView.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            if (await Misc.requiresMRSMetadataUpgrade(globalConn)) {
                await Misc.upgradeMRSMetadata();
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            const dbConnections = await Misc.getDBConnections();
            for (const dbConnection of dbConnections) {
                await Misc.deleteConnection(dbConnection.name, dbConnection.isMySQL, false);
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Toolbar", () => {

        let treeConn: TreeItem;

        const localConn = Object.assign({}, globalConn);
        localConn.caption = `localDBConnection`;

        before(async function () {
            try {
                await Misc.sectionFocus(constants.dbTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            const notifications = await new Workbench().getNotifications();
            if (notifications.length > 0) {
                await notifications[notifications.length - 1].dismiss();
            }

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();
        });

        after(async function () {
            try {
                await new BottomBarPanel().toggle(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Create New DB Connection", async () => {

            await Database.createConnection(localConn);
            expect(await Database.getWebViewConnection(localConn.caption)).to.exist;
            await new EditorView().closeEditor(constants.dbDefaultEditor);

        });

        it("Reload the connection list", async () => {

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
            expect(await Misc.existsTreeElement(constants.dbTreeSection, globalConn.caption)).to.be.true;

        });

        it("Collapse All", async () => {

            treeConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.expandDBConnectionTree(treeConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            const treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await treeGlobalSchema.expand();
            const treeGlobalSchemaTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const treeGlobalSchemaViews = await Misc.getTreeElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, constants.collapseAll);
            const visibleItems = await treeDBSection.getVisibleItems();
            expect(visibleItems.length).to.equals(2);
            expect(await visibleItems[0].getLabel()).equals(globalConn.caption);
            expect(await visibleItems[1].getLabel()).equals(localConn.caption);

        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(Misc.getMysqlshLog());
            await Misc.restartShell();

            try {
                await driver.wait(async () => {
                    const text = await fs.readFile(Misc.getMysqlshLog());
                    if (text.includes("Registering session...")) {
                        return true;
                    }
                }, 20000, "Restarting the internal MySQL Shell server went wrong");
            } finally {
                console.log("<<<<MySQLSH Logs>>>>");
                await Misc.writeMySQLshLogs();
            }

        });

        it("Relaunch Welcome Wizard", async () => {

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.selectMoreActionsItem(treeDBSection, constants.relaunchWelcomeWizard);
            const editor = new EditorView();
            const titles = await editor.getOpenEditorTitles();
            expect(titles).to.include.members(["Welcome to MySQL Shell"]);
            const active = await editor.getActiveTab();
            expect(await active.getTitle()).equals("Welcome to MySQL Shell");
            await driver.wait(until.ableToSwitchToFrame(0), constants.explicitWait, "Not able to switch to frame 0");
            await driver.wait(until.ableToSwitchToFrame(
                locator.iframe.isActive), constants.explicitWait, "Not able to switch to frame 2");
            const text = await driver.findElement(locator.welcomeWizard.title).getText();
            expect(text).equals("Welcome to MySQL Shell for VS Code.");
            expect(await driver.findElement(locator.welcomeWizard.nextButton)).to.exist;

        });

        it("Reset MySQL Shell for VS Code Extension", async () => {

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.selectMoreActionsItem(treeDBSection, constants.resetExtension);
            let notif = "This will completely reset the MySQL Shell for VS Code extension by ";
            notif += "deleting the web certificate and user settings directory.";
            const ntf = await Misc.getNotification(notif, false);
            await Misc.clickOnNotificationButton(ntf, "Cancel");

        });
    });

    describe("Database connections", () => {

        before(async function () {
            try {
                await Misc.cleanCredentials();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        let sslConn: interfaces.IDBConnection;

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.openEditorsTreeSection);
                await (await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel)).click();
                await Misc.switchToFrame();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
            const notifications = await new Workbench().getNotifications();
            if (notifications.length > 0) {
                await notifications[notifications.length - 1].dismiss();
            }
        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, constants.collapseAll);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });


        it("Edit a database connection and verify errors", async () => {
            const host = await Database.getWebViewConnection(globalConn.caption, false);
            await driver.executeScript(
                "arguments[0].click();",
                await host.findElement(locator.dbConnectionOverview.dbConnection.moreActions),
            );
            const contextMenu = await driver.wait(
                until.elementLocated(locator.dbConnectionOverview.dbConnection.contextMenu),
                2000,
            );
            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(locator.dbConnectionOverview.dbConnection.moreActionsMenu.editConnection),
            );
            const conDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                constants.explicitWait, "Connection dialog was not displayed");
            const customClear = async (el: WebElement) => {
                const textLength = (await el.getAttribute("value")).length;
                for (let i = 0; i <= textLength - 1; i++) {
                    await el.sendKeys(Key.BACK_SPACE);
                    await driver.sleep(100);
                }
            };

            await customClear(await conDialog.findElement(locator.dbConnectionDialog.caption));
            const okBtn = await conDialog.findElement(locator.dbConnectionDialog.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const error = await driver.wait(
                until.elementLocated(locator.dbConnectionDialog.errorMessage),
                2000,
            );

            expect(await error.getText()).to.equals("The caption cannot be empty");
            await conDialog.findElement(locator.dbConnectionDialog.caption).sendKeys("WexQA");
            await customClear(await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            expect(await conDialog.findElement(locator.dbConnectionDialog.errorMessage).getText())
                .to.equals("Specify a valid host name or IP address");
            await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.hostname).sendKeys("1.1.1.1");
            await customClear(await conDialog.findElement(locator.dbConnectionDialog.mysql.basic.username));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(locator.dbConnectionDialog.ok).click();
            expect(await conDialog.findElement(locator.dbConnectionDialog.errorMessage).getText())
                .to.equals("The user name must not be empty");
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(locator.dbConnectionDialog.cancel).click();
        });

        it("Connect to SQLite database", async () => {
            const connBrowser = await driver.wait(until.elementLocated(locator.dbConnectionOverview.browser),
                constants.explicitWait, "Connection browser not found");
            await connBrowser.findElement(locator.dbConnectionOverview.newDBConnection).click();
            const sqliteConn = Object.assign({}, globalConn);
            sqliteConn.dbType = "Sqlite";
            sqliteConn.caption = `SqliteConnection`;

            if (platform() === "linux") {
                process.env.USERPROFILE = process.env.HOME;
            }

            sqliteConn.basic = {
                dbPath: join(constants.basePath,
                    `mysqlsh-${String(process.env.TEST_SUITE)}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                dbName: "SQLite",
            };

            await Database.setConnection(
                sqliteConn.dbType,
                sqliteConn.caption,
                undefined,
                sqliteConn.basic,
            );

            const sqliteWebConn = await Database.getWebViewConnection(sqliteConn.caption, false);
            expect(sqliteWebConn).to.exist;

            await driver.executeScript(
                "arguments[0].click();",
                sqliteWebConn,
            );

            await driver.wait(Until.dbConnectionIsOpened(),
                constants.explicitWait * 3, "DB Connection was not opened");
            await Misc.switchBackToTopFrame();
            await Misc.sectionFocus(constants.dbTreeSection);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, constants.reloadConnections);
            await driver.wait(new Condition("", async () => {
                const item = await Misc.getTreeElement(constants.dbTreeSection, sqliteConn.caption);
                await item.expand();

                return item.isExpanded();
            }), constants.explicitWait * 2, `${sqliteConn.caption} was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await Misc.getTreeElement(constants.dbTreeSection, "main");
                await item.expand();

                return item.isExpanded();
            }), constants.explicitWait * 2, `main was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
                await item.expand();

                return item.isExpanded();
            }), constants.explicitWait * 2, `Tables was not expanded`);

            const treeDBConn = await Misc.getTreeElement(constants.dbTreeSection, "db_connection");
            await Misc.openContextMenuItem(treeDBConn, constants.selectRowsInNotebook, constants.checkNewTabAndWebView);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg(undefined)).includes("OK");
            }, constants.explicitWait, "Result did not included 'OK'");

        });

        it("Connect to MySQL database using SSL", async () => {

            const connBrowser = await driver.wait(until.elementLocated(locator.dbConnectionOverview.browser),
                constants.explicitWait, "Connection browser not found");

            await connBrowser.findElement(locator.dbConnectionOverview.newDBConnection).click();

            sslConn = Object.assign({}, globalConn);
            sslConn.caption = `SSLConnection`;

            sslConn.ssl = {
                mode: "Require and Verify CA",
                caPath: `${String(process.env.SSL_ROOT_FOLDER)}/ca-cert.pem`,
                clientCertPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`,
                clientKeyPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`,
            };

            await Database.setConnection(
                sslConn.dbType,
                sslConn.caption,
                undefined,
                sslConn.basic,
                sslConn.ssl,
            );

            const dbConn = await Database.getWebViewConnection(sslConn.caption, false);
            expect(dbConn).to.exist;

            await driver.executeScript(
                "arguments[0].click();",
                dbConn,
            );

            let query = `select * from performance_schema.session_status where variable_name in `;
            query += `("ssl_cipher") and variable_value = "TLS_AES_256_GCM_SHA384"`;

            await Database.setDBConnectionCredentials(globalConn);
            await driver.wait(Until.dbConnectionIsSuccessful(),
                constants.explicitWait * 3, "DB Connection was not successful");
            const result = await Misc.execCmd(query, undefined, constants.queryWaits, true);
            expect(result[0]).to.include("1 record retrieved");

        });

    });

    describe("MySQL Administration", () => {

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await Misc.expandDBConnectionTree(treeGlobalConn,
                    (globalConn.basic as interfaces.IConnBasicMySQL).password);

                const treeMySQLAdmin = await Misc.getTreeElement(constants.dbTreeSection, constants.mysqlAdmin);
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
            await Misc.switchBackToTopFrame();
        });

        after(async function () {
            try {
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Server Status", async () => {

            await (await Misc.getTreeElement(constants.dbTreeSection, constants.serverStatus)).click();
            expect(await new EditorView().getOpenEditorTitles()).to.include(constants.serverStatus);
            await driver.wait(Until.dbConnectionIsOpened(),
                constants.explicitWait * 3, "DB Connection was not opened");
            await Database.setDBConnectionCredentials(globalConn);
            expect(await Database.getCurrentEditor()).to.equals(constants.serverStatus);
            const sections = await driver.findElements(locator.mysqlAdministration.section);
            const headings = [];
            for (const section of sections) {
                headings.push(await section.getText());
            }
            expect(headings).to.include("Main Settings");
            expect(headings).to.include("Server Directories");
            expect(headings).to.include("Server Features");
            expect(headings).to.include("Server SSL");
            expect(headings).to.include("Server Authentication");
        });

        it("Client Connections", async () => {

            const clientConn = await Misc.getTreeElement(constants.dbTreeSection, constants.clientConns);
            await clientConn.click();
            expect(await new EditorView().getOpenEditorTitles()).to.include(constants.clientConns);
            await Misc.switchToFrame();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === constants.clientConns;
            }, constants.explicitWait, "Clients Connections editor was not selected");
            const properties = await driver.findElements(locator.mysqlAdministration.clientConnections.properties);
            const props = [];
            for (const item of properties) {
                props.push(await item.getAttribute("innerHTML"));
            }

            const test = props.join(",");
            expect(test).to.include("Threads Connected");
            expect(test).to.include("Threads Running");
            expect(test).to.include("Threads Created");
            expect(test).to.include("Threads Cached");
            expect(test).to.include("Rejected (over limit)");
            expect(test).to.include("Total Connections");
            expect(test).to.include("Connection Limit");
            expect(test).to.include("Aborted Clients");
            expect(test).to.include("Aborted Connections");
            expect(test).to.include("Errors");
            await driver.wait(async () => {
                const list = await driver.findElement(locator.mysqlAdministration.clientConnections.connectionsList);
                const rows = await list.findElements(locator.mysqlAdministration.clientConnections.tableRow);

                return rows.length > 0;
            }, constants.explicitWait, "Connections list is empty");
        });

        it("Performance Dashboard", async () => {

            const perfDash = await Misc.getTreeElement(constants.dbTreeSection, constants.perfDash);
            await perfDash.click();
            expect(await new EditorView().getOpenEditorTitles()).to.include(constants.perfDash);
            await Misc.switchToFrame();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === constants.perfDash;
            }, constants.explicitWait, "Performance Dashboard editor was not selected");

            const grid = await driver.findElement(locator.mysqlAdministration.performanceDashboard.dashboardGrid);
            const gridItems = await grid.findElements(locator.mysqlAdministration.performanceDashboard.gridItems);
            const listItems = [];

            for (const item of gridItems) {
                const label = await item.findElement(locator.htmlTag.label);
                listItems.push(await label.getAttribute("innerHTML"));
            }

            expect(listItems).to.include("Network Status");
            expect(listItems).to.include("MySQL Status");
            expect(listItems).to.include("InnoDB Status");

        });

    });

    describe("Context menu items", () => {

        let treeGlobalSchema: TreeItem;
        let treeGlobalSchemaTables: TreeItem;
        let treeGlobalSchemaViews: TreeItem;
        let clean = false;
        let treeGlobalConn: TreeItem;
        const dumpFolder = join(constants.workspace, "dump");
        const testSchema = `testschema`;
        const testTable = `testtable`;
        const testView = `testview`;
        const dup = "duplicatedConnection";

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, constants.collapseAll);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await Misc.expandDBConnectionTree(treeGlobalConn,
                    (globalConn.basic as interfaces.IConnBasicMySQL).password);
                await new BottomBarPanel().toggle(false);
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            if (clean) {
                try {
                    await Misc.cleanEditor();
                } catch (e) {
                    // continue
                }
            }
            await Misc.switchBackToTopFrame();
        });

        after(async function () {
            try {
                await new EditorView().closeAllEditors();
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, constants.collapseAll);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Set this DB Connection as Default", async () => {

            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.setDBConnDefault, constants.checkNotif);
            await Misc.getNotification(`"${globalConn.caption}" has been set as default DB Connection`);

        });

        it("Open Database Connection", async () => {

            await Misc.openContextMenuItem(treeGlobalConn, constants.openNewConnection,
                constants.checkNewTabAndWebView);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                "DB Connection was not opened");
            await Database.setDBConnectionCredentials(globalConn);
            await driver.wait(Until.dbConnectionIsSuccessful(), constants.explicitWait * 3,
                "DB Connection was not successful");
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Misc.sectionFocus(constants.openEditorsTreeSection);
            expect(await Misc.existsTreeElement(constants.openEditorsTreeSection, globalConn.caption)).to.be.true;

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await Misc.openContextMenuItem(treeGlobalConn, constants.openShellConnection,
                constants.checkNewTabAndWebView);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                "DB Connection was not opened");
            await Database.setDBConnectionCredentials(globalConn);
            const item = await driver.wait(until
                .elementLocated(locator.shellConsole.editor), 10000, "MySQL Shell Console was not loaded");
            expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Misc.sectionFocus(constants.openEditorsTreeSection);
            const treeOEShellConsoles = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.mysqlShellConsoles);
            expect(treeOEShellConsoles).to.exist;
            expect(await treeOEShellConsoles.findChildItem(`Session to ${String(globalConn.caption)}`)).to.exist;
            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
            expect(treeVisibleItems.length).to.be.at.least(1);
            expect(await treeVisibleItems[0].getLabel()).to.equals(constants.dbConnectionsLabel);

        });

        it("Edit MySQL connection", async () => {

            const localConn = Object.assign({}, globalConn);
            localConn.caption = `connectionToEdit`;
            await Database.createConnection(localConn);
            expect(await Database.getWebViewConnection(localConn.caption, true)).to.exist;
            const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, localConn.caption);
            await Misc.openContextMenuItem(treeLocalConn, constants.editDBConnection,
                constants.checkNewTabAndWebView);
            await Database.setConnection(
                "MySQL",
                localConn.caption,
                undefined,
                undefined,
            );

            await Misc.switchBackToTopFrame();
            expect(await Misc.existsTreeElement(constants.dbTreeSection, localConn.caption)).to.be.true;

        });

        it("Duplicate this MySQL connection", async () => {

            await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 5,
                `${constants.dbTreeSection} is still loading`);
            await Misc.sectionFocus(constants.dbTreeSection);
            treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.duplicateConnection,
                constants.checkNewTabAndWebView);
            const dialog = await driver.wait(until.elementLocated(
                locator.dbConnectionDialog.exists), constants.explicitWait, "Connection dialog was not found");

            await dialog.findElement(locator.dbConnectionDialog.caption).clear();
            await dialog.findElement(locator.dbConnectionDialog.caption).sendKeys(dup);
            const okBtn = await driver.findElement(locator.dbConnectionDialog.ok);
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await Misc.switchBackToTopFrame();
            await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 5,
                `${constants.dbTreeSection} is still loading`);
            await driver.wait(async () => {
                return (await Misc.existsTreeElement(constants.dbTreeSection, dup)) === true;
            }, constants.explicitWait, `${dup} does not exist on the tree`);
        });

        it("Delete DB connection", async () => {
            await Misc.sectionFocus(constants.dbTreeSection);
            const treeDup = await Misc.getTreeElement(constants.dbTreeSection, dup);
            await Misc.openContextMenuItem(treeDup, constants.deleteDBConnection, constants.checkWebViewDialog);
            const dialog = await driver.wait(until.elementLocated(
                locator.confirmDialog.exists), constants.explicitWait * 3, "confirm dialog was not found");

            await dialog.findElement(locator.confirmDialog.accept).click();
            await Misc.switchBackToTopFrame();
            await driver.wait(async () => {
                return (await Misc.existsTreeElement(constants.dbTreeSection, dup)) === false;
            }, constants.explicitWait, `${dup} was not deleted`);
        });

        it("Load SQL Script from Disk", async () => {
            const destFile = join(constants.workspace, "gui", "frontend", "src", "tests", "e2e", "sql", "sakila.sql");
            await Misc.openContextMenuItem(treeGlobalConn, constants.loadScriptFromDisk, constants.checkInput);
            await Misc.setInputPath(destFile);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 4,
                "DB Connection was not opened");
            if (await Database.requiresCredentials()) {
                await Database.setDBConnectionCredentials(globalConn);
            }
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()) === "sakila.sql";
            }, constants.explicitWait, "Current editor is not sakila.sql");
            expect(await Database.getCurrentEditorType()).to.include("Mysql");
            const scriptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
            expect(scriptLines.length).to.be.greaterThan(0);
            await Database.selectCurrentEditor("DB Notebook", "notebook");
        });

        it("Dump Schema to Disk", async () => {
            await Misc.switchBackToTopFrame();
            treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.expandDBConnectionTree(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToFrame();
            let result = await Misc.execCmd(`drop schema if exists \`${testSchema}\`;`,
                constants.execFullBlockSql, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create schema ${testSchema};`, undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd("SET GLOBAL local_infile = 'ON';", undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            await Misc.switchBackToTopFrame();
            const treeTestSchema = await Misc.getTreeElement(constants.dbTreeSection, testSchema);
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);

            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await Misc.openContextMenuItem(treeTestSchema, constants.dumpSchemaToDisk, constants.checkInput);
            await Misc.setInputPath(dumpFolder);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Misc.waitForOutputText(`Task 'Dump Schema ${testSchema} to Disk' completed successfully`,
                constants.explicitWait * 2);
            const files = await fs.readdir(dumpFolder);
            expect(files.length).to.be.greaterThan(0);
            await Misc.sectionFocus(constants.tasksTreeSection);
            expect(await Misc.existsTreeElement(constants.tasksTreeSection,
                `Dump Schema ${testSchema} to Disk (done)`)).to.be.true;
            await Misc.sectionFocus(constants.dbTreeSection);
            await Misc.switchToFrame();
            result = await Misc.execCmd(`drop schema ${testSchema};`, undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
        });

        it("Load Dump from Disk", async () => {
            await Misc.switchBackToTopFrame();
            await Misc.sectionFocus(constants.dbTreeSection);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
            await Misc.openContextMenuItem(treeGlobalConn, constants.loadDumpFromDisk, constants.checkInput);
            await Misc.setInputPath(dumpFolder);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Misc.waitForOutputText(/Task 'Loading Dump .* from Disk' completed successfully/,
                constants.explicitWait * 2);
            await Misc.sectionFocus(constants.tasksTreeSection);
            expect(await Misc.existsTreeElement(constants.tasksTreeSection, /Loading Dump (.*) \(done\)/)).to.be.true;
            await Misc.sectionFocus(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
            expect(await Misc.existsTreeElement(constants.dbTreeSection, testSchema)).to.be.true;
            await Misc.switchToFrame();
            const result = await Misc.execCmd(`drop schema ${testSchema};`, undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
        });

        it("Dump Schema to Disk for MySQL Database Service", async () => {
            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToFrame();
            let result = await Misc.execCmd(`drop schema if exists \`${testSchema}\`;`,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create schema ${testSchema};`, undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            await Misc.switchBackToTopFrame();
            const treeTestSchema = await Misc.getTreeElement(constants.dbTreeSection, testSchema);
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);

            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await Misc.openContextMenuItem(treeTestSchema, constants.dumpSchemaToDiskToServ, constants.checkInput);
            await Misc.setInputPath(dumpFolder);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Misc.waitForOutputText(`Task 'Dump Schema ${testSchema} to Disk' completed successfully`,
                constants.explicitWait * 2);
            const files = await fs.readdir(dumpFolder);
            expect(files.length).to.be.greaterThan(0);
            await Misc.sectionFocus(constants.tasksTreeSection);
            expect(await Misc.existsTreeElement(constants.tasksTreeSection,
                `Dump Schema ${testSchema} to Disk (done)`)).to.be.true;
        });

        it("Load Data to HeatWave Cluster", async () => {
            await Misc.sectionFocus(constants.dbTreeSection);
            const sakilaItem = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await Misc.openContextMenuItem(sakilaItem, constants.loadDataToHW, constants.checkNewTabAndWebView);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                "DB Connection was not opened");
            await Database.setDataToHw();
            await Misc.switchBackToTopFrame();
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Misc.getNotification("The data load to the HeatWave cluster operation has finished");

        });

        it("Schema - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                        (globalConn.basic as interfaces.IConnBasicMySQL).schema);
                    await Misc.openContextMenuItem(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.checkNotif, constants.schemaCtxMenu);
                    await Misc.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === (globalConn.basic as interfaces.IConnBasicMySQL).schema;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The schema name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                        (globalConn.basic as interfaces.IConnBasicMySQL).schema);
                    await Misc.openContextMenuItem(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.checkNotif, constants.schemaCtxMenu);
                    await Misc.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("CREATE DATABASE");
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The schema create statement was not copied to the clipboard");

        });

        it("Drop Schema", async () => {

            await Misc.switchToFrame();
            let result = await Misc.execCmd(`drop schema if exists \`${testSchema}\`;`,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create schema ${testSchema};`, undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            await Misc.switchBackToTopFrame();
            const treeTestSchema = await Misc.getTreeElement(constants.dbTreeSection, testSchema);
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);

            await Misc.openContextMenuItem(treeTestSchema, constants.dropSchema, undefined);
            const ntfs = await new Workbench().getNotifications();
            if (ntfs.length > 0) {
                await Misc.clickOnNotificationButton(ntfs[ntfs.length - 1], `Drop ${testSchema}')]`);
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testSchema}`);
            }
            await Misc.getNotification(`The object ${testSchema} has been dropped successfully.`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, testSchema)).to.be.false;

        });

        it("Table - Select Rows in DB Notebook", async () => {
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as interfaces.IConnBasicMySQL).schema);
            await treeGlobalSchema.expand();
            treeGlobalSchemaTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
            await Misc.openContextMenuItem(actorTable, constants.selectRowsInNotebook, constants.checkNewTabAndWebView);
            try {
                await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                    "DB Connection was not opened");
                const result = await Misc.getCmdResultMsg();
                expect(result).to.match(/OK/);
            } finally {
                clean = true;
            }

        });

        it("Table - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
                    await Misc.openContextMenuItem(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.checkNotif, constants.dbObjectCtxMenu);
                    await Misc.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === "actor";
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The table name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
                    await Misc.openContextMenuItem(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.checkNotif, constants.dbObjectCtxMenu);
                    await Misc.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("idx_actor_last_name");
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The table create statement was not copied to the clipboard");

        });

        it("Drop Table", async () => {

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToFrame();
            let result = await Misc.execCmd(`drop table if exists \`${testTable}\`;`,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create table ${testTable} (id int, name VARCHAR(50));`,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            await Misc.switchBackToTopFrame();
            const treeTestTable = await Misc.getTreeElement(constants.dbTreeSection, testTable);
            await Misc.openContextMenuItem(treeTestTable, constants.dropTable, constants.checkDialog);
            const dialog = new ModalDialog();
            await dialog.pushButton(`Drop ${testTable}`);
            await Misc.getNotification(`The object ${testTable} has been dropped successfully.`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, testTable)).to.be.false;

        });

        it("View - Select Rows in DB Notebook", async () => {
            treeGlobalSchemaViews = await Misc.getTreeElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
            await Misc.openContextMenuItem(treeTestView, constants.selectRowsInNotebook,
                constants.checkNewTabAndWebView);
            const result = await Misc.getCmdResultMsg();
            expect(result).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
                    await Misc.openContextMenuItem(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.checkNotif, constants.dbObjectCtxMenu);
                    await Misc.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === "test_view";
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }

            }), constants.explicitWait * 3, "The view name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
                    await Misc.openContextMenuItem(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.checkNotif, constants.dbObjectCtxMenu);
                    await Misc.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DEFINER VIEW");
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The view create statement was not copied to the clipboard");

        });

        it("Drop View", async () => {

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToFrame();
            let result = await Misc.execCmd(`drop view if exists \`${testView}\``,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`CREATE VIEW ${testView} as select * from sakila.actor;`,
                undefined, constants.queryWaits);
            expect(result[0]).to.include("OK");
            await Misc.switchBackToTopFrame();
            await Misc.expandDBConnectionTree(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await treeGlobalSchema.expand();
            await treeGlobalSchemaViews.expand();
            const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, testView);
            await Misc.openContextMenuItem(treeTestView, constants.dropView, constants.checkDialog);
            const dialog = new ModalDialog();
            await dialog.pushButton(`Drop ${testView}`);
            await Misc.getNotification(`The object ${testView} has been dropped successfully.`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, testView)).to.be.false;
        });

        it("Table - Show Data", async () => {

            const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
            await Misc.openContextMenuItem(actorTable, "Show Data", constants.checkNewTabAndWebView);
            const result = await Database.getScriptResult(constants.explicitWait * 2);
            expect(result).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.explicitWait, "Result tab was not maxized");

        });

        it("View - Show Data", async function () {
            this.retries(1);

            const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
            await Misc.openContextMenuItem(treeTestView, "Show Data", constants.checkNewTabAndWebView);
            await driver.wait(Until.dbConnectionIsOpened(), constants.explicitWait * 3,
                "DB Connection was not opened");
            const result = await Database.getScriptResult();
            expect(result).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.explicitWait, "Resulta tab was not maxized");

        });

    });

});
