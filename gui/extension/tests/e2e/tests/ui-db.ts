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
import {
    BottomBarPanel, By, Condition, EditorView, Key, ModalDialog, TreeItem,
    until, WebElement, Workbench, error,
} from "vscode-extension-tester";

import { expect } from "chai";
import clipboard from "clipboardy";
import fs from "fs/promises";
import { after, afterEach, before } from "mocha";

import { driver, Misc } from "../lib/misc";
import { Shell } from "../lib/shell";

import {
    Database, IConnBasicMySQL, IConnBasicSqlite, IConnSSL, IDBConnection,
} from "../lib/db";

import * as constants from "../lib/constants";
import { platform } from "os";
import { join } from "path";

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

    const globalBasicInfo: IConnBasicMySQL = {
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
    };

    const globalConn: IDBConnection = {
        dbType: "MySQL",
        caption: "conn",
        description: "Local connection",
        basic: globalBasicInfo,
    };

    before(async function () {

        await Misc.loadDriver();

        try {
            await driver.wait(Misc.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            await Misc.getTreeElement(constants.openEditorsTreeSection, constants.dbConnectionsLabel);

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Toolbar", () => {

        let treeConn: TreeItem;

        const localConn = Object.assign({}, globalConn);
        localConn.caption += Math.floor(Math.random() * (9000 - 2000 + 1) + 2000);

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

            await driver.switchTo().defaultContent();
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
            treeConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);

        });

        it("Collapse All", async () => {

            treeConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await treeConn.expand();
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
            const treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as IConnBasicMySQL).schema);
            await treeGlobalSchema.expand();
            const treeGlobalSchemaTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const treeGlobalSchemaViews = await Misc.getTreeElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");
            const visibleItems = await treeDBSection.getVisibleItems();
            expect(visibleItems.length).to.equals(2);
            expect(await visibleItems[0].getLabel()).to.include("conn");
            expect(await visibleItems[1].getLabel()).to.include("conn");

        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(Misc.getMysqlshLog());
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.selectMoreActionsItem(treeDBSection, constants.restartInternalShell);
            const dialog = await driver.wait(until.elementLocated(By.css(".notification-toast-container")),
                3000, "Restart dialog was not found");
            await driver.wait(async () => {
                try {
                    const restartBtn = await dialog
                        .findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]"));
                    await restartBtn.click();

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on the Restart button");

            await driver.wait(async () => {
                const text = await fs.readFile(Misc.getMysqlshLog());
                if (text.includes("Registering session...")) {
                    return true;
                }
            }, 20000, "Restarting the internal MySQL Shell server went wrong");
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
                By.id("active-frame")), constants.explicitWait, "Not able to switch to frame 2");
            const text = await driver.findElement(By.css("#page1 h3")).getText();
            expect(text).equals("Welcome to MySQL Shell for VS Code.");
            expect(await driver.findElement(By.id("nextBtn"))).to.exist;

        });

        it("Reset MySQL Shell for VS Code Extension", async () => {

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.selectMoreActionsItem(treeDBSection, constants.resetExtension);
            let notif = "This will completely reset the MySQL Shell for VS Code extension by ";
            notif += "deleting the web certificate and user settings directory.";
            await Misc.verifyNotification(notif);
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("Cancel");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on the cancel button");
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

        let sslConn: IDBConnection;

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.openEditorsTreeSection);
                await (await Misc.getTreeElement(constants.openEditorsTreeSection,
                    constants.dbConnectionsLabel)).click();
                await Misc.switchToWebView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
            const notifications = await new Workbench().getNotifications();
            if (notifications.length > 0) {
                await notifications[notifications.length - 1].dismiss();
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await new EditorView().closeAllEditors();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });


        it("Edit a database connection and verify errors", async () => {
            const host = await Database.getWebViewConnection(globalConn.caption, false);
            await driver.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("tileMoreActionsAction")),
            );
            const contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );
            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );
            const conDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                constants.explicitWait, "Connection dialog was not displayed");
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

            expect(await error.getText()).to.equals("The caption cannot be empty");
            await conDialog.findElement(By.id("caption")).sendKeys("WexQA");
            await customClear(await conDialog.findElement(By.id("hostName")));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            expect(await conDialog.findElement(By.css(".message.error")).getText())
                .to.equals("Specify a valid host name or IP address");
            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");
            await customClear(await conDialog.findElement(By.id("userName")));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(By.id("ok")).click();
            expect(await conDialog.findElement(By.css(".message.error")).getText())
                .to.equals("The user name must not be empty");
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(By.id("cancel")).click();
        });

        it("Connect to SQLite database", async () => {

            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                constants.explicitWait, "Connection browser not found");
            await connBrowser.findElement(By.id("-1")).click();
            const sqliteConn = Object.assign({}, globalConn);
            sqliteConn.dbType = "Sqlite";
            sqliteConn.caption = `Sqlite DB${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

            if (platform() === "linux") {
                process.env.USERPROFILE = process.env.HOME;
            }

            const localSqliteBasicInfo: IConnBasicSqlite = {
                dbPath: join(constants.basePath,
                    `mysqlsh-${String(process.env.TEST_SUITE)}`,
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3"),
                dbName: "SQLite",
            };

            sqliteConn.basic = localSqliteBasicInfo;

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

            await driver.wait(Database.isConnectionLoaded(),
                constants.explicitWait * 3, "DB Connection was not loaded");
            await driver.switchTo().defaultContent();
            await Misc.sectionFocus(constants.dbTreeSection);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
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
            await Misc.openContexMenuItem(treeDBConn, constants.selectRowsInNotebook, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg(undefined)).includes("OK");
            }, constants.explicitWait, "Result did not included 'OK'");

        });

        it("Connect to MySQL database using SSL", async () => {

            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                constants.explicitWait, "Connection browser not found");

            await connBrowser.findElement(By.id("-1")).click();

            sslConn = Object.assign({}, globalConn);
            sslConn.caption = `SSL Connection${String(Math.floor(Math.random() * 100))}`;

            const localSSLInfo: IConnSSL = {
                mode: "Require and Verify CA",
                caPath: `${String(process.env.SSL_ROOT_FOLDER)}/ca-cert.pem`,
                clientCertPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`,
                clientKeyPath: `${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`,
            };

            sslConn.ssl = localSSLInfo;

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

            await Database.setDBConnectionCredentials(globalConn);
            await driver.wait(Database.isConnectionLoaded(),
                constants.explicitWait * 3, "DB Connection was not loaded");
            const result = await Misc.execCmd("SHOW STATUS LIKE 'Ssl_cipher';");
            expect(result[0]).to.include("1 record retrieved");
            expect(await (result[1] as WebElement)
                .findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]"))).to.exist;
        });

    });

    describe("MySQL Administration", () => {

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
                await treeGlobalConn.expand();
                try {
                    await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
                } catch (e) {
                    // continue
                }
                const treeMySQLAdmin = await Misc.getTreeElement(constants.dbTreeSection, "MySQL Administration");
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
            await driver.switchTo().defaultContent();
        });

        after(async function () {
            try {
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Server Status", async () => {

            await (await Misc.getTreeElement(constants.dbTreeSection, "Server Status")).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(),
                constants.explicitWait * 3, "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            expect(await Database.getCurrentEditor()).to.equals("Server Status");
            const sections = await driver.findElements(By.css(".grid .heading label"));
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

            const clientConn = await Misc.getTreeElement(constants.dbTreeSection, "Client Connections");
            await clientConn.click();
            await Misc.switchToWebView();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Client Connections";
            }, constants.explicitWait, "Clients Connections editor was not selected");
            const properties = await driver.findElements(By.css("#connectionProps label"));
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
                const list = await driver.findElement(By.id("connectionList"));
                const rows = await list.findElements(By.css(".tabulator-row"));

                return rows.length > 0;
            }, constants.explicitWait, "Connections list is empty");
        });

        it("Performance Dashboard", async () => {

            const perfDash = await Misc.getTreeElement(constants.dbTreeSection, "Performance Dashboard");
            await perfDash.click();
            await Misc.switchToWebView();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Performance Dashboard";
            }, constants.explicitWait, "Performance Dashboard editor was not selected");

            const grid = await driver.findElement(By.id("dashboardGrid"));
            const gridItems = await grid.findElements(By.css(".gridCell.title"));
            const listItems = [];

            for (const item of gridItems) {
                const label = await item.findElement(By.css("label"));
                listItems.push(await label.getAttribute("innerHTML"));
            }

            expect(listItems).to.include("Network Status");
            expect(listItems).to.include("MySQL Status");
            expect(listItems).to.include("InnoDB Status");

        });

    });

    describe("Open Editors", () => {

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
        });

        it("New Shell Notebook", async () => {
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);

            await Misc.openContexMenuItem(treeDBConnections, "Open New MySQL Shell Console", true);
            await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
            await driver.switchTo().defaultContent();
            const treeOEShellConsoles = await Misc.getTreeElement(constants.openEditorsTreeSection,
                "MySQL Shell Consoles");

            expect(await treeOEShellConsoles.findChildItem("Session 1")).to.exist;

        });

        it("Icon - New MySQL Script", async () => {

            await Misc.sectionFocus(constants.dbTreeSection);
            //const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
            await (await Misc.getActionButton(treeLocalConn, constants.openNewConnection)).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            await driver.switchTo().defaultContent();
            const treeOEGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection,
                globalConn.caption);

            await (await Misc.getActionButton(treeOEGlobalConn, "New MySQL Script")).click();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
            expect(treeItem).to.exist;
            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("Mysql");
            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New MySQL Script", async () => {

            await Misc.sectionFocus(constants.openEditorsTreeSection);
            const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContexMenuItem(item, constants.newMySQLScript, true);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("Mysql");
            await driver.switchTo().defaultContent();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
            expect(treeItem).to.exist;
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New JavaScript Script", async () => {

            const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContexMenuItem(item, "New JavaScript Script", true);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptJs");
            await driver.switchTo().defaultContent();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");
            expect(treeItem).to.exist;
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New TypeScript Script", async () => {

            const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContexMenuItem(item, "New TypeScript Script", true);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.explicitWait, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptTs");
            await driver.switchTo().defaultContent();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");
            expect(treeItem).to.exist;
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Collapse All", async () => {

            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await Misc.clickSectionToolbarButton(treeOpenEditorsSection, "Collapse All");
            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
            expect(treeVisibleItems.length).to.equals(3);
            expect(await treeVisibleItems[0].getLabel()).to.equals(constants.dbConnectionsLabel);
            expect(await treeVisibleItems[1].getLabel()).to.equals(globalConn.caption);
            expect(await treeVisibleItems[2].getLabel()).to.equals("MySQL Shell Consoles");

        });

        it("Open DB Connection Overview", async () => {

            await (await Misc.getTreeElement(constants.openEditorsTreeSection, constants.dbConnectionsLabel)).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");

        });

        it("Open DB Notebook", async () => {

            const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await item.expand();
            await (await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.openEditorsDBNotebook)).click();

            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");

        });

        it("Open Shell Session", async () => {

            const item = await Misc.getTreeElement(constants.openEditorsTreeSection, "MySQL Shell Consoles");
            await item.expand();
            await (await Misc.getTreeElement(constants.openEditorsTreeSection, "Session 1")).click();
            await Misc.switchToWebView();
            await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");

        });
    });

    describe("Context menu items", () => {

        let treeGlobalSchema: TreeItem;
        let treeGlobalSchemaTables: TreeItem;
        let treeGlobalSchemaViews: TreeItem;
        let clean = false;
        let treeDup: TreeItem;
        let treeGlobalConn: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption, true);
                await treeGlobalConn.expand();
                try {
                    await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as IConnBasicMySQL).password);
                } catch (e) {
                    // continue
                }

                await new BottomBarPanel().toggle(false);

                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.dbTreeSection);
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

            await driver.switchTo().defaultContent();
        });

        after(async function () {
            try {
                await new EditorView().closeAllEditors();
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Open Database Connection", async () => {

            await Misc.openContexMenuItem(treeGlobalConn, constants.openNewConnection, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            const item = await driver.wait(until.elementLocated(By.css(".zoneHost")),
                constants.explicitWait, "zoneHost not found");

            expect(item).to.exist;
            await driver.switchTo().defaultContent();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Misc.sectionFocus(constants.openEditorsTreeSection);
            await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await Misc.openContexMenuItem(treeGlobalConn, constants.openShellConnection, true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            const item = await driver.wait(until
                .elementLocated(By.css(".zoneHost .actionLabel > span")), 10000, "MySQL Shell Console was not loaded");
            expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");
            await driver.switchTo().defaultContent();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await Misc.sectionFocus(constants.openEditorsTreeSection);
            const treeOEShellConsoles = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.mysqlShellConsoles);
            expect(treeOEShellConsoles).to.exist;
            expect(await treeOEShellConsoles.findChildItem(`Session to ${String(globalConn.caption)}`)).to.exist;
            await new EditorView().closeEditor(constants.mysqlShellConsoles);
            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
            expect(treeVisibleItems.length).to.be.at.least(1);
            expect(await treeVisibleItems[0].getLabel()).to.equals(constants.dbConnectionsLabel);

        });

        it("Edit MySQL connection", async () => {

            const localConn = Object.assign({}, globalConn);
            localConn.caption = `toEdit${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
            await Database.createConnection(localConn);
            expect(await Database.getWebViewConnection(localConn.caption, true)).to.exist;
            await new EditorView().closeEditor(constants.dbDefaultEditor);
            const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, localConn.caption, true);
            await Misc.openContexMenuItem(treeLocalConn, constants.editDBConnection, true);
            await Database.setConnection(
                "MySQL",
                localConn.caption,
                undefined,
                undefined,
            );

            await driver.switchTo().defaultContent();
            await Misc.getTreeElement(constants.dbTreeSection, localConn.caption, true);

        });

        it("Duplicate this MySQL connection", async () => {

            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 5,
                `${await treeDBSection.getTitle()} is still loading`);
            await Misc.openContexMenuItem(treeGlobalConn, constants.duplicateConnection, true);
            const dialog = await driver.wait(until.elementLocated(
                By.css(".valueEditDialog")), constants.explicitWait, "Connection dialog was not found");

            const dup = `Dup${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
            await dialog.findElement(By.id("caption")).clear();
            await dialog.findElement(By.id("caption")).sendKeys(dup);
            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver.switchTo().defaultContent();
            await new EditorView().closeEditor(constants.dbDefaultEditor);
            treeDup = await Misc.getTreeElement(constants.dbTreeSection, dup, true);
        });

        it("Delete DB connection", async () => {
            const dupName = await treeDup.getLabel();
            await Misc.openContexMenuItem(treeDup, constants.deleteDBConnection, true);
            try {
                const dialog = await driver.wait(until.elementLocated(
                    By.css(".visible.confirmDialog")), constants.explicitWait * 3, "confirm dialog was not found");

                await dialog.findElement(By.id("accept")).click();
                await driver.switchTo().defaultContent();
                const treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await driver.wait(Misc.isNotLoading(treeDBSection), constants.ociExplicitWait * 2,
                    `${await treeDBSection.getTitle()} is still loading`);

                await driver.wait(async () => {
                    let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                    treeDBSection = await Misc.getSection(constants.dbTreeSection);
                    await driver.wait(Misc.isNotLoading(treeDBSection), constants.ociExplicitWait * 2,
                        `${await treeDBSection.getTitle()} is still loading`);
                    await treeDBSection.findItem(dupName);

                    return (await treeDBSection.findItem(dupName)) === undefined;
                }, constants.explicitWait * 3, `${dupName} was not deleted`);
            } finally {
                await new EditorView().closeEditor(constants.dbDefaultEditor);
            }

        });

        it("Schema - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                        (globalConn.basic as IConnBasicMySQL).schema);
                    await Misc.openContexMenuItem(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardName]);
                    await Misc.verifyNotification("The name was copied to the system clipboard", true);

                    return clipboard.readSync() === (globalConn.basic as IConnBasicMySQL).schema;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The schema name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                        (globalConn.basic as IConnBasicMySQL).schema);
                    await Misc.openContexMenuItem(treeGlobalSchema, [constants.copyToClipboard,
                    constants.copyToClipboardStat]);
                    await Misc.verifyNotification("The create script was copied to the system clipboard", true);

                    return clipboard.readSync().includes("CREATE DATABASE");
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The schema create statement was not copied to the clipboard");

        });

        it("Drop Schema", async () => {

            await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
            await new EditorView().openEditor(constants.dbDefaultEditor);
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testSchema = `testschema${random}`;
            let result = await Misc.execCmd("call clearSchemas();", undefined, constants.explicitWait * 2);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create schema ${testSchema};`);
            expect(result[0]).to.include("OK");
            await driver.switchTo().defaultContent();
            const treeTestSchema = await Misc.getTreeElement(constants.dbTreeSection, testSchema, true);
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as IConnBasicMySQL).schema);

            await Misc.openContexMenuItem(treeTestSchema, constants.dropSchema);
            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testSchema}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testSchema}`);
            }
            await Misc.verifyNotification(`The object ${testSchema} has been dropped successfully.`, true);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(testSchema)) === undefined;
            }, constants.explicitWait, `${testSchema} was not deleted`);

        });

        it("Table - Select Rows in DB Notebook", async () => {
            treeGlobalSchema = await Misc.getTreeElement(constants.dbTreeSection,
                (globalConn.basic as IConnBasicMySQL).schema);
            await treeGlobalSchema.expand();
            treeGlobalSchemaTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeGlobalSchemaTables.expand();
            const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
            await Misc.openContexMenuItem(actorTable, constants.selectRowsInNotebook, true);
            try {
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                    "DB Connection was not loaded");
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
                    await Misc.openContexMenuItem(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardName]);
                    await Misc.verifyNotification("The name was copied to the system clipboard");

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
                    await Misc.openContexMenuItem(actorTable, [constants.copyToClipboard,
                    constants.copyToClipboardStat]);
                    await Misc.verifyNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("idx_actor_last_name");
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }), constants.explicitWait * 3, "The table create statement was not copied to the clipboard");

        });

        it("Drop Table", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testTable = `testtable${random}`;

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            let result = await Misc.execCmd("call clearTables();", undefined, constants.explicitWait * 2);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`create table ${testTable} (id int, name VARCHAR(50));`);
            expect(result[0]).to.include("OK");
            await driver.switchTo().defaultContent();
            await driver.wait(async () => {
                try {
                    const treeTestTable = await Misc.getTreeElement(constants.dbTreeSection, testTable, true);
                    await Misc.openContexMenuItem(treeTestTable, constants.dropTable);
                    const dialog = new ModalDialog();
                    await dialog.pushButton(`Drop ${testTable}`);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError) && !(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait * 2, "Could not drop the table");
            await Misc.verifyNotification(`The object ${testTable} has been dropped successfully.`, true);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(testTable)) === undefined;
            }, constants.explicitWait, `${testTable} was not deleted`);

        });

        it("View - Select Rows in DB Notebook", async () => {
            treeGlobalSchemaViews = await Misc.getTreeElement(constants.dbTreeSection, "Views");
            await treeGlobalSchemaViews.expand();
            const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
            await Misc.openContexMenuItem(treeTestView, constants.selectRowsInNotebook, true);
            const result = await Misc.getCmdResultMsg();
            expect(result).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async () => {

            await driver.wait(new Condition("", async () => {
                try {
                    const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
                    await Misc.openContexMenuItem(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardName]);
                    await Misc.verifyNotification("The name was copied to the system clipboard");

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
                    await Misc.openContexMenuItem(treeTestView, [constants.copyToClipboard,
                    constants.copyToClipboardStat]);
                    await Misc.verifyNotification("The create script was copied to the system clipboard");

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
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testView = `testview${random}`;
            let result = await Misc.execCmd("call clearViews();", undefined, constants.explicitWait * 2);
            expect(result[0]).to.include("OK");
            result = await Misc.execCmd(`CREATE VIEW ${testView} as select * from sakila.actor;`);
            expect(result[0]).to.include("OK");
            await driver.switchTo().defaultContent();
            await treeGlobalConn.expand();
            await treeGlobalSchema.expand();
            await treeGlobalSchemaViews.expand();
            await driver.wait(async () => {
                try {
                    const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, testView, true);
                    await Misc.openContexMenuItem(treeTestView, constants.dropView);
                    const dialog = new ModalDialog();
                    await dialog.pushButton(`Drop ${testView}`);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError) && !(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait * 2, "Could not drop the view");

            await Misc.verifyNotification(`The object ${testView} has been dropped successfully.`, true);
            const treeDBSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDBSection), constants.explicitWait * 2,
                `${await treeDBSection.getTitle()} is still loading`);
            await driver.wait(async () => {
                let treeDBSection = await Misc.getSection(constants.dbTreeSection);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeDBSection = await Misc.getSection(constants.dbTreeSection);

                return (await treeDBSection.findItem(testView)) === undefined;
            }, constants.explicitWait, `${testView} was not deleted`);
        });

        it("Table - Show Data", async () => {

            await new EditorView().closeAllEditors();
            const actorTable = await Misc.getTreeElement(constants.dbTreeSection, "actor");
            await Misc.openContexMenuItem(actorTable, "Show Data", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            const result = await Database.getScriptResult(constants.explicitWait * 2);
            expect(result).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.explicitWait, "Result tab was not maxized");

        });

        it("View - Show Data", async () => {

            const treeTestView = await Misc.getTreeElement(constants.dbTreeSection, "test_view");
            await Misc.openContexMenuItem(treeTestView, "Show Data", true);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            const result = await Database.getScriptResult();
            expect(result).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.explicitWait, "Resulta tab was not maxized");

        });

    });

});
