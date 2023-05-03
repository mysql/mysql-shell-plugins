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
    By,
    EditorView,
    until,
    ModalDialog,
    WebElement,
    Key,
    TreeItem,
    CustomTreeSection,
    BottomBarPanel,
    Workbench,
    Condition,
} from "vscode-extension-tester";

import clipboard from "clipboardy";
import { before, after, afterEach } from "mocha";
import fs from "fs/promises";
import { expect } from "chai";
import {
    dbTreeSection,
    driver,
    explicitWait,
    Misc,
    isExtPrepared,
    dbMaxLevel,
    openEditorsMaxLevel,
    openEditorsTreeSection,
    dbConnectionsLabel,
    openEditorsDBNotebook,
    dbEditorDefaultName,
    ociExplicitWait,
} from "../lib/misc";

import { Shell } from "../lib/shell";

import {
    IDBConnection,
    IConnBasicMySQL,
    IConnSSL,
    Database,
    IConnBasicSqlite,
} from "../lib/db";


import { join } from "path";
import { platform } from "os";

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

    let treeDBSection: CustomTreeSection;
    let treeOpenEditorsSection: CustomTreeSection;

    let treeGlobalConn: TreeItem | undefined;

    before(async function () {

        try {

            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            await Misc.toggleBottomBar(false);
            
            await driver.wait(new Condition("", async () => {
                const editors = await new EditorView().getOpenEditorTitles();
                if (editors.includes(dbEditorDefaultName)){
                    await new EditorView().closeAllEditors();

                    return (await new EditorView().getOpenEditorTitles()).length === 0;
                } else {
                    return false;
                }
            }), ociExplicitWait);

            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            treeDBSection = await Misc.getSection(dbTreeSection);
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeGlobalConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);
            expect(treeGlobalConn).to.exist;

            await new BottomBarPanel().toggle(false);

            treeOpenEditorsSection = await Misc.getSection(openEditorsTreeSection);

            expect(await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel)).to.exist;

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
                await Misc.sectionFocus(dbTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
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

        after(async () => {
            await new BottomBarPanel().toggle(false);
        });

        it("Create New DB Connection", async () => {

            await Database.createConnection(localConn);

            expect(await Database.getWebViewConnection(localConn.caption)).to.exist;

            await new EditorView().closeEditor(dbEditorDefaultName);

        });

        it("Reload the connection list", async () => {

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);

            expect(treeConn).to.exist;

        });

        it("Collapse All", async () => {

            treeConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);

            await treeConn.expand();

            await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);

            const treeGlobalSchema = await treeDBSection.findItem((globalConn.basic as IConnBasicMySQL).schema,
                dbMaxLevel);
            await treeGlobalSchema.expand();

            const treeGlobalSchemaTables = await treeDBSection.findItem("Tables", dbMaxLevel);
            await treeGlobalSchemaTables.expand();

            const treeGlobalSchemaViews = await treeDBSection.findItem("Views", dbMaxLevel);
            await treeGlobalSchemaViews.expand();

            await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");

            const visibleItems = await treeDBSection.getVisibleItems();

            expect(visibleItems.length).to.equals(2);

            expect(await visibleItems[0].getLabel()).to.include("conn");

            expect(await visibleItems[1].getLabel()).to.include("conn");

        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(Misc.getMysqlshLog());

            await Misc.selectMoreActionsItem(treeDBSection, "Restart the Internal MySQL Shell Process");

            const dialog = await driver.wait(until.elementLocated(By.css(".notification-toast-container")),
                3000, "Restart dialog was not found");

            const restartBtn = await dialog.findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]"));
            await restartBtn.click();
            await driver.wait(until.stalenessOf(dialog), 3000, "Restart MySQL Shell dialog is still displayed");

            await driver.wait(async () => {
                const text = await fs.readFile(Misc.getMysqlshLog());
                if (text.includes("Registering session...")) {
                    return true;
                }
            }, 20000, "Restarting the internal MySQL Shell server went wrong");

        });

        it("Relaunch Welcome Wizard", async () => {

            await Misc.selectMoreActionsItem(treeDBSection, "Relaunch Welcome Wizard");

            const editor = new EditorView();
            const titles = await editor.getOpenEditorTitles();

            expect(titles).to.include.members(["Welcome to MySQL Shell"]);
            const active = await editor.getActiveTab();
            expect(await active.getTitle()).equals("Welcome to MySQL Shell");

            await driver.wait(until.ableToSwitchToFrame(0), explicitWait, "Not able to switch to frame 0");
            await driver.wait(until.ableToSwitchToFrame(
                By.id("active-frame")), explicitWait, "Not able to switch to frame 2");

            const text = await driver.findElement(By.css("#page1 h3")).getText();
            expect(text).equals("Welcome to MySQL Shell for VS Code.");
            expect(await driver.findElement(By.id("nextBtn"))).to.exist;

        });

        it("Reset MySQL Shell for VS Code Extension", async () => {

            await Misc.selectMoreActionsItem(treeDBSection, "Reset MySQL Shell for VS Code Extension");

            let notif = "This will completely reset the MySQL Shell for VS Code extension by ";
            notif += "deleting the web certificate and user settings directory.";

            await Misc.verifyNotification(notif);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Cancel");

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

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(openEditorsTreeSection);
                await (await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel)).click();
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
                await new EditorView().closeAllEditors();
                await Misc.sectionFocus(dbTreeSection);
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

            const conDialog = await driver.findElement(By.css(".valueEditDialog"));

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
                explicitWait, "Connection browser not found");

            await connBrowser.findElement(By.id("-1")).click();

            const sqliteConn = Object.assign({}, globalConn);
            sqliteConn.dbType = "Sqlite";
            sqliteConn.caption = `Sqlite DB${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

            if (platform() === "linux") {
                process.env.USERPROFILE = process.env.HOME;
            }

            const localSqliteBasicInfo: IConnBasicSqlite = {
                dbPath: join(String(process.env.USERPROFILE),
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

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await driver.switchTo().defaultContent();

            await Misc.sectionFocus(dbTreeSection);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            await driver.wait(new Condition("", async () => {
                const item = await treeDBSection.findItem(sqliteConn.caption, dbMaxLevel);
                if (item) {
                    await item.expand();

                    return item.isExpanded();
                }
            }), explicitWait, `${sqliteConn.caption} was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await treeDBSection.findItem("main", dbMaxLevel);
                if (item) {
                    await item.expand();

                    return item.isExpanded();
                }
            }), explicitWait, `main was not expanded`);

            await driver.wait(new Condition("", async () => {
                const item = await treeDBSection.findItem("Tables", dbMaxLevel);
                if (item) {
                    await item.expand();

                    return item.isExpanded();
                }
            }), explicitWait, `Tables was not expanded`);

            const treeDBConn = await treeDBSection.findItem("db_connection", dbMaxLevel);

            await Misc.selectContextMenuItem(treeDBConn, "Select Rows in DB Notebook");

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await driver.wait(async () => {
                return (await Misc.getCmdResultMsg(undefined)).includes("OK");
            }, explicitWait, "Result did not included 'OK'");

        });

        it("Connect to MySQL database using SSL", async () => {

            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                explicitWait, "Connection browser not found");

            await connBrowser.findElement(By.id("-1")).click();

            const sslConn = Object.assign({}, globalConn);
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

            await Database.tryCredentials(globalConn);

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            const result = await Misc.execCmd("SHOW STATUS LIKE 'Ssl_cipher';");
            expect(result[0]).to.include("1 record retrieved");
            expect(await (result[1] as WebElement)
                .findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]"))).to.exist;
        });

    });

    describe("DB Editor", () => {

        let clean = false;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(dbTreeSection);
                await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
                await Database.tryCredentials(globalConn);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(() => {
            clean = false;
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            if (clean) {
                await Misc.cleanEditor();
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {
                await Misc.writeCmd("select * from sakila.actor;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await Misc.writeCmd("select * from sakila.address;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await Misc.writeCmd("select * from sakila.city;");

                await driver.actions().keyDown(Key.ALT).perform();

                const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                lines.shift();
                let spans = await lines[0].findElements(By.css("span"));
                await spans[spans.length - 1].click();

                spans = await lines[1].findElements(By.css("span"));
                await spans[spans.length - 1].click();
                await driver.actions().keyUp(Key.ALT).perform();

                await driver.actions().sendKeys(Key.BACK_SPACE).perform();
                await driver.sleep(500);
                await driver.actions().sendKeys(Key.BACK_SPACE).perform();
                await driver.sleep(500);
                await driver.actions().sendKeys(Key.BACK_SPACE).perform();

                const contentHost = await driver.findElement(By.id("contentHost"));
                const textArea = await contentHost.findElement(By.css("textarea"));

                let items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0].length).equals(24);
                expect(items[1].length).equals(26);
                expect(items[2].length).equals(23);

                await textArea.sendKeys("testing");

                items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0]).to.include("testing");
                expect(items[1]).to.include("testing");
                expect(items[2]).to.include("testing");
            } finally {
                clean = true;
            }
        });

        it("Using a DELIMITER", async function () {

            this.retries(1);

            await Misc.cleanEditor();
            await Misc.writeCmd("DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("SELECT actor_id", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("FROM ", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("sakila.actor LIMIT 1 $$", true);

            expect(await Database.isStatementStart("DELIMITER $$")).to.be.true;
            expect(await Database.isStatementStart("SELECT actor_id")).to.be.true;
            expect(await Database.isStatementStart("FROM")).to.be.false;
            expect(await Database.isStatementStart("sakila.actor LIMIT 1 $$")).to.be.false;

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await Misc.writeCmd("select 1 $$ ");
            expect(await Database.isStatementStart("select 1 $$")).to.be.true;

            const result = await Misc.execCmd("", "Execute selection or full block and create a new block");

            expect(result[0]).to.include("OK");
            const tabs = await (result[1] as WebElement).findElements(By.css(".tabArea label"));
            expect(tabs.length).to.equals(2);
            expect(await tabs[0].getAttribute("innerHTML")).to.include("Result");
            expect(await tabs[1].getAttribute("innerHTML")).to.include("Result");

        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

            const result = await Misc.execCmd("SELECT * FROM actor;",
                "Execute selection or full block and create a new block");

            expect(result[0]).to.match(/(\d+) record/);
            expect(await Database.hasNewPrompt()).to.be.true;
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {

            try {
                const textArea = await driver.findElement(By.css("textarea"));
                await Misc.writeCmd("select * from sakila.actor limit 1;", true);
                await textArea.sendKeys(Key.RETURN);

                await Misc.writeCmd("select * from sakila.address limit 2;");
                await textArea.sendKeys(Key.RETURN);

                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ARROW_LEFT);

                let result = await Misc.execCmd("", "Execute the statement at the caret position");
                expect(await Misc.getResultColumns(result[1] as WebElement)).to.include("actor_id");

                await textArea.sendKeys(Key.ARROW_DOWN);

                await driver.sleep(150);

                result = await Misc.execCmd("", "Execute the statement at the caret position");

                expect(await Misc.getResultColumns(result[1] as WebElement)).to.include("address_id");
            } finally {
                clean = true;
            }
        });

        it("Switch between search tabs", async () => {

            const result = await Misc
                .execCmd("select * from sakila.actor limit 1; select * from sakila.address limit 1;", undefined,
                    undefined, true);

            expect(await Misc.getResultTabs(result[1] as WebElement)).to.have.members(["Result #1", "Result #2"]);

            const result1 = await Misc.getResultTab(result[1] as WebElement, "Result #1");
            const result2 = await Misc.getResultTab(result[1] as WebElement, "Result #2");

            expect(result1).to.exist;
            expect(result2).to.exist;

            expect(await Misc.getResultColumns(result[1] as WebElement)).to.have.members(["actor_id",
                "first_name", "last_name", "last_update"]);

            await result2.click();

            expect(await Misc.getResultColumns(result[1] as WebElement)).to.include.members(["address_id",
                "address", "address2", "district", "city_id", "postal_code", "phone", "last_update"]);

        });

        it("Connect to database and verify default schema", async () => {

            const result = await Misc.execCmd("SELECT SCHEMA();");
            expect(result[0]).to.include("1 record retrieved");

            expect(await ((result[1] as WebElement).findElement(By.css(".tabulator-cell"))).getText())
                .to.equals((globalConn.basic as IConnBasicMySQL).schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommit = await Database.getToolbarButton("Auto commit DB changes");
            const style = await autoCommit.findElement(By.css(".icon")).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommit.click();
            }

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await Database.getToolbarButton("Commit DB changes");
            const rollBackBtn = await Database.getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn as WebElement),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn as WebElement),
                3000, "Commit button should be enabled");

            let result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);

            expect(result[0]).to.include("OK");

            await rollBackBtn.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK, 0 records retrieved");

            result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(result[0]).to.include("OK");

            await commitBtn.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK, 1 record retrieved");

            await autoCommit.click();

            await driver.wait(
                async () => {
                    const commitBtn = await Database.getToolbarButton("Commit DB changes");
                    const rollBackBtn = await Database.getToolbarButton("Rollback DB changes");

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                            (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                explicitWait,
                "Commit/Rollback DB changes button is still enabled ",
            );

            result = await Misc.execCmd(`DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(result[0]).to.include("OK");
        });

        it("Connection toolbar buttons - Find and Replace", async () => {

            try {
                const contentHost = await driver.findElement(By.id("contentHost"));

                await Misc.writeCmd(`import from xpto xpto xpto`);

                const findBtn = await Database.getToolbarButton("Find");
                await findBtn.click();

                const finder = await driver.findElement(By.css(".find-widget"));

                expect(await finder.getAttribute("aria-hidden")).equals("false");

                await finder.findElement(By.css("textarea")).sendKeys("xpto");

                await Database.findInSelection(finder, false);

                expect(
                    await finder.findElement(By.css(".matchesCount")).getText(),
                ).to.match(/1 of (\d+)/);

                await driver.wait(
                    until.elementsLocated(By.css(".cdr.findMatch")),
                    2000,
                    "No words found",
                );

                await Database.expandFinderReplace(finder, true);

                const replacer = await finder.findElement(By.css(".replace-part"));

                await replacer.findElement(By.css("textarea")).sendKeys("tester");

                await (await Database.replacerGetButton(replacer, "Replace (Enter)")).click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester xpto xpto");

                await replacer.findElement(By.css("textarea")).clear();

                await replacer.findElement(By.css("textarea")).sendKeys("testing");

                await (await Database.replacerGetButton(replacer, "Replace All")).click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester testing testing");

                await Database.closeFinder(finder);

                expect(await finder.getAttribute("aria-hidden")).equals("true");

            } finally {
                clean = true;
            }


        });

        it("Using Math_random on js_py blocks", async () => {

            try {
                const textArea = await driver.findElement(By.css("textarea"));
                const result = await Misc.execCmd("\\js ");
                expect(result[0]).to.include("Switched to JavaScript mode");

                const result2 = await Misc.execCmd("Math.random();");
                expect(result2[0]).to.match(/(\d+).(\d+)/);

                expect((await Misc.execCmd("\\typescript "))[0]).equals("Switched to TypeScript mode");

                const result4 = await Misc.execCmd("Math.random();");

                expect(result4[0]).to.match(/(\d+).(\d+)/);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await Misc.execOnEditor();

                const otherResult = await Misc.getCmdResultMsg();

                expect(otherResult).to.match(/(\d+).(\d+)/);

                expect(otherResult !== result2[0]).equals(true);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await Misc.execOnEditor();

                const otherResult1 = await Misc.getCmdResultMsg();

                expect(otherResult1).to.match(/(\d+).(\d+)/);

                expect(otherResult1 !== result4[0]).equals(true);

            } finally {
                clean = true;
            }


        });

        it("Multi-line comments", async () => {

            let result = await Misc.execCmd("\\sql ");
            expect(result[0]).to.include("Switched to MySQL mode");

            result = await Misc.execCmd("select version();");
            expect(result[0]).to.include("1 record retrieved");

            const txt = await (result[1] as WebElement).findElement(By.css(".tabulator-cell")).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            result = await Misc.execCmd(`/*!${serverVer} select * from sakila.actor;*/`, undefined, undefined, true);

            expect(result[0]).to.match(/OK, (\d+) records retrieved/);

            const higherServer = parseInt(serverVer, 10) + 1;

            result = await Misc.execCmd(`/*!${higherServer} select * from sakila.actor;*/`, undefined, undefined, true);

            expect(result[0]).to.include("OK, 0 records retrieved");

        });

        it("Context Menu - Execute", async () => {

            let result = await Misc.execCmdByContextItem("select * from sakila.actor limit 1;", "Execute Block");

            expect(result[0]).to.match(/OK, (\d+) record retrieved/);
            expect(await Database.hasNewPrompt()).to.be.false;

            await Misc.cleanEditor();

            result = await Misc
                .execCmdByContextItem("select * from sakila.actor limit 1;", "Execute Block and Advance");

            expect(result[0]).to.match(/OK, (\d+) record retrieved/);
            expect(await Database.hasNewPrompt()).to.be.true;

        });

        it("Maximize and Normalize Result tab", async () => {

            const result = await Misc.execCmd("select * from sakila.actor;");
            expect(result[0]).to.include("OK");

            await driver.sleep(1000);

            await (result[2] as WebElement).findElement(By.id("toggleStateButton")).click();

            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), explicitWait, "Result tab was not maxized");

            expect(await Database.getCurrentEditor()).to.equals("Result #1");
            try {
                expect(await Database.isEditorStretched()).to.be.false;
                let tabArea = await driver.findElements(By.css("#resultPaneHost .resultTabview .tabArea"));
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await driver.findElement(By.id("normalizeResultStateButton")).click();
                expect(await Database.isEditorStretched()).to.be.true;
                expect(await Database.isResultTabMaximized()).to.be.false;
                tabArea = await driver.findElements(By.css("#resultPaneHost .resultTabview .tabArea"));
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await Database.selectCurrentEditor("DB Notebook", "notebook");
            }
        });

        it("Pie Graph based on DB table", async () => {

            let result = await Misc.execCmd("\\ts ");
            expect(result[0]).to.include("Switched to TypeScript mode");

            result = await Misc.execCmd(`
                runSql("SELECT Name, Capital FROM world_x_cst.country limit 10",(result) => {
                    const options: IGraphOptions = {
                        series: [
                            {
                                type: "bar",
                                yLabel: "Actors",
                                data: result as IJsonGraphData,
                            }
                        ]
                    }
                    const i=0;
                    Graph.render(options);
                }`);

            const pieChart = await (result[1] as WebElement).findElement(By.css(".graphHost"));

            const chartColumns = await pieChart.findElements(By.css("rect"));
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
            }

        });

        it("Schema autocomplete context menu", async () => {

            try {
                const result = await Misc.execCmd("\\sql ");
                expect(result[0]).to.include("Switched to MySQL mode");

                await Misc.writeCmd("select * from ");

                const textArea = await driver.findElement(By.css("textarea"));

                await textArea.sendKeys(Key.chord(Key.CONTROL, Key.SPACE));

                const els = await Database.getAutoCompleteMenuItems();

                expect(els).to.include("information_schema");
                expect(els).to.include("mysql");
                expect(els).to.include("performance_schema");
                expect(els).to.include("sakila");
                expect(els).to.include("sys");
                expect(els).to.include("world_x_cst");
            } finally {
                clean = true;
            }

        });

    });

    describe("Scripts", () => {

        let refItem: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(dbTreeSection);
                await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
                await Database.tryCredentials(globalConn);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await (await Misc.getActionButton(refItem, "Close Editor")).click();
            await Misc.switchToWebView();
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Add SQL Script", async () => {

            await Database.addScript("sql");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("Mysql");

            const result = await Database.execScript("select * from sakila.actor limit 1;");
            expect(result[0]).to.match(/OK, (\d+) record/);

            await driver.switchTo().defaultContent();

            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");

            expect(refItem).to.exist;

        });

        it("Add Typescript", async () => {

            await Database.addScript("ts");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("scriptTs");

            const result = await Database.execScript("Math.random()");
            expect(result[0]).to.match(/(\d+).(\d+)/);

            await driver.switchTo().defaultContent();

            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");

            expect(refItem).to.exist;

        });

        it("Add Javascript", async () => {

            await Database.addScript("js");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("scriptJs");

            const result = await Database.execScript("Math.random()");
            expect(result[0]).to.match(/(\d+).(\d+)/);

            await driver.switchTo().defaultContent();

            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");

            expect(refItem).to.exist;

        });

    });

    describe("MySQL Administration", () => {

        let treeMySQLAdmin: TreeItem | undefined;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(dbTreeSection);
                await treeGlobalConn.expand();
                try {
                    await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);
                } catch (e) {
                    // continue
                }

                treeMySQLAdmin = await treeDBSection.findItem("MySQL Administration", dbMaxLevel);
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
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Server Status", async () => {

            await (await treeDBSection.findItem("Server Status", dbMaxLevel)).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            await Database.tryCredentials(globalConn);
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

            const clientConn = await treeDBSection.findItem("Client Connections", dbMaxLevel);
            await clientConn.click();
            await Misc.switchToWebView();

            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Client Connections";
            }, explicitWait, "Clients Connections editor was not selected");

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

            const list = await driver.findElement(By.id("connectionList"));
            const rows = await list.findElements(By.css(".tabulator-row"));
            expect(rows.length).to.be.above(0);
        });

        it("Performance Dashboard", async () => {

            const perfDash = await treeDBSection.findItem("Performance Dashboard", dbMaxLevel);
            await perfDash.click();
            await Misc.switchToWebView();

            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Performance Dashboard";
            }, explicitWait, "Performance Dashboard editor was not selected");

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

        let treeDBConnections: TreeItem;
        let treeLocalConn: TreeItem;

        const localConn = Object.assign({}, globalConn);
        localConn.caption =  `conn${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

        before(async function() {
            try {
                await Misc.cleanCredentials();
                await Database.createConnection(localConn);
                expect(await Database.getWebViewConnection(localConn.caption, true)).to.exist;
                await new EditorView().closeEditor(dbEditorDefaultName);
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeLocalConn = await treeDBSection.findItem(localConn.caption, dbMaxLevel);
                expect(treeLocalConn).to.exist;

            } catch (e) {
                await Misc.processFailure(this);
            }
        });

        beforeEach(async function () {

            try {
                await Misc.sectionFocus(openEditorsTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
            }

        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
        });

        it("New Shell Notebook", async () => {

            treeDBConnections = await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(treeDBConnections, "Open New MySQL Shell Console");

            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            await driver.switchTo().defaultContent();

            const treeOEShellConsoles = await treeOpenEditorsSection.findItem("MySQL Shell Consoles",
                openEditorsMaxLevel);

            expect(await treeOEShellConsoles.findChildItem("Session 1")).to.exist;

        });

        it("Icon - New MySQL Notebook", async () => {

            await Misc.sectionFocus(dbTreeSection);

            await (await Misc.getActionButton(treeLocalConn, "Connect to Database")).click();

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await Database.tryCredentials(localConn);

            await driver.switchTo().defaultContent();

            await Misc.sectionFocus(openEditorsTreeSection);

            expect(await treeOpenEditorsSection.findItem(`DB Notebook (${String(localConn.caption)})`,
                openEditorsMaxLevel)).to.exist;

            await Misc.sectionFocus(dbTreeSection);

            await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await Database.tryCredentials(globalConn);

            await driver.switchTo().defaultContent();

            await new EditorView().openEditor(globalConn.caption);

            const treeOEGlobalConn = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await (await Misc.getActionButton(treeOEGlobalConn, "New MySQL Notebook")).click();

            treeOpenEditorsSection = await Misc.getSection(openEditorsTreeSection);

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "notebook");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);

            expect(await Database.getCurrentEditorType()).to.include("notebook");

            await driver.switchTo().defaultContent();

            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Icon - New MySQL Script", async () => {

            const treeOEGlobalConn = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await (await Misc.getActionButton(treeOEGlobalConn, "New MySQL Script")).click();

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("Mysql");

            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New MySQL Notebook", async () => {

            const item = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(item, "New MySQL Notebook");

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "notebook");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("notebook");

            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New MySQL Script", async () => {

            const item = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(item, "New MySQL Script");

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("Mysql");

            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New JavaScript Script", async () => {

            const item = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(item, "New JavaScript Script");

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("scriptJs");

            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Context menu - New TypeScript Script", async () => {

            const item = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(item, "New TypeScript Script");

            const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");

            expect(treeItem).to.exist;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.include("scriptTs");

            await driver.switchTo().defaultContent();
            await (await Misc.getActionButton(treeItem, "Close Editor")).click();

        });

        it("Collapse All", async () => {

            await Misc.clickSectionToolbarButton(treeOpenEditorsSection, "Collapse All");

            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();

            expect(treeVisibleItems.length).to.equals(4);

            expect(await treeVisibleItems[0].getLabel()).to.equals(dbConnectionsLabel);

            expect(await treeVisibleItems[1].getLabel()).to.equals(localConn.caption);

            expect(await treeVisibleItems[2].getLabel()).to.equals(globalConn.caption);

            expect(await treeVisibleItems[3].getLabel()).to.equals("MySQL Shell Consoles");

        });

        it("Open DB Connections", async () => {

            await (await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel)).click();

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

        });

        it("Open DB Notebook", async () => {

            const item = await treeOpenEditorsSection.findItem(globalConn.caption, openEditorsMaxLevel);

            await item.expand();

            await (await treeOpenEditorsSection.findItem(openEditorsDBNotebook, openEditorsMaxLevel)).click();

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

        });

        it("Open Shell Session", async () => {

            const item = await treeOpenEditorsSection.findItem("MySQL Shell Consoles", openEditorsMaxLevel);

            await item.expand();

            await (await treeOpenEditorsSection.findItem("Session 1", openEditorsMaxLevel)).click();

            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

        });
    });

    describe("Context menu items", () => {

        let treeGlobalSchema: TreeItem;
        let treeGlobalSchemaTables: TreeItem;
        let treeGlobalSchemaViews: TreeItem;
        let clean = false;
        let treeDup: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(dbTreeSection);

                await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");

                await treeGlobalConn.expand();
                try {
                    await Misc.setInputPassword((globalConn.basic as IConnBasicMySQL).password);
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
                await Misc.sectionFocus(dbTreeSection);
                treeDBSection = await Misc.getSection(dbTreeSection);
                treeGlobalConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);
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
                await Misc.clickSectionToolbarButton(treeDBSection, "Collapse All");
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Connect to Database", async () => {

            await Misc.selectContextMenuItem(treeGlobalConn, "Connect to Database");
            await new EditorView().openEditor(dbEditorDefaultName);
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            await Database.tryCredentials(globalConn);

            const item = await driver.wait(until.elementLocated(By.css(".zoneHost")),
                explicitWait, "zoneHost not found");

            expect(item).to.exist;

            await driver.switchTo().defaultContent();

            await treeOpenEditorsSection.expand();

            await Misc.sectionFocus(openEditorsTreeSection);

            const treeOEGlobalConn = await treeOpenEditorsSection
                .findItem(`DB Notebook (${String(globalConn.caption)})`,
                    openEditorsMaxLevel);

            expect(treeOEGlobalConn).to.exist;

        });

        it("Connect to Database in New Tab", async () => {

            await Misc.selectContextMenuItem(treeGlobalConn, "Connect to Database on New Tab");

            await new EditorView().openEditor(`${dbEditorDefaultName} (1)`);

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await Database.tryCredentials(globalConn);

            await driver.switchTo().defaultContent();

            await Misc.sectionFocus(openEditorsTreeSection);

            let treeOEMySQLShell = await treeOpenEditorsSection.findItem(dbEditorDefaultName, openEditorsMaxLevel);

            expect(treeOEMySQLShell).to.exist;

            expect(await treeOEMySQLShell.findChildItem(dbConnectionsLabel)).to.exist;

            const treeOEGlobalConn = await treeOEMySQLShell.findChildItem(globalConn.caption);

            expect(await treeOEGlobalConn.findChildItem(`DB Notebook (${String(globalConn.caption)})`)).to.exist;

            treeOEMySQLShell = await treeOpenEditorsSection.findItem(`${dbEditorDefaultName} (1)`, openEditorsMaxLevel);

            expect(treeOEMySQLShell).to.exist;

            expect(await treeOEMySQLShell.findChildItem(dbConnectionsLabel)).to.exist;

            await new EditorView().closeEditor(globalConn.caption);

            await new EditorView().closeEditor(globalConn.caption);

            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();

            expect(treeVisibleItems.length).to.equals(1);

            expect(await treeVisibleItems[0].getLabel()).to.equals(dbConnectionsLabel);

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await Misc.selectContextMenuItem(treeGlobalConn, "Open New MySQL Shell Console for this Connection");

            await new EditorView().openEditor("MySQL Shell Consoles");

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await Database.tryCredentials(globalConn);

            const item = await driver.wait(until
                .elementLocated(By.css(".zoneHost .actionLabel > span")), 10000, "MySQL Shell Console was not loaded");

            expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");

            await driver.switchTo().defaultContent();

            await treeOpenEditorsSection.expand();

            await Misc.sectionFocus(openEditorsTreeSection);

            const treeOEShellConsoles = await treeOpenEditorsSection.findItem("MySQL Shell Consoles",
                openEditorsMaxLevel);

            expect(treeOEShellConsoles).to.exist;

            expect(await treeOEShellConsoles.findChildItem(`Session to ${String(globalConn.caption)}`)).to.exist;

            await new EditorView().closeEditor("MySQL Shell Consoles");

            const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();

            expect(treeVisibleItems.length).to.equals(1);

            expect(await treeVisibleItems[0].getLabel()).to.equals(dbConnectionsLabel);

        });

        it("Edit MySQL connection", async () => {

            const localConn = Object.assign({}, globalConn);
            localConn.caption = `toEdit${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

            await Database.createConnection(localConn);

            expect(await Database.getWebViewConnection(localConn.caption, true)).to.exist;

            await new EditorView().closeEditor(dbEditorDefaultName);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            const treeLocalConn = await treeDBSection.findItem(localConn.caption, dbMaxLevel);

            await Misc.selectContextMenuItem(treeLocalConn, "Edit DB Connection");

            await new EditorView().openEditor(dbEditorDefaultName);

            await Misc.switchToWebView();

            await Database.setConnection(
                "MySQL",
                localConn.caption,
                undefined,
                undefined,
            );

            await driver.switchTo().defaultContent();

            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

                return (await treeDBSection.findItem(localConn.caption, dbMaxLevel)) !== undefined;
            }, explicitWait, "Database was not updated");

        });

        it("Duplicate this MySQL connection", async () => {

            await Misc.selectContextMenuItem(treeGlobalConn, "Duplicate this DB Connection");

            await new EditorView().openEditor(dbEditorDefaultName);

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(
                By.css(".valueEditDialog")), explicitWait, "Connection dialog was not found");

            const dup = `Dup${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

            await dialog.findElement(By.id("caption")).clear();
            await dialog.findElement(By.id("caption")).sendKeys(dup);
            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver.switchTo().defaultContent();

            await new EditorView().closeEditor(dbEditorDefaultName);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            treeDup = await treeDBSection.findItem(dup, dbMaxLevel);

            expect(treeDup).to.exist;
        });

        it("Delete DB connection", async () => {

            const dupName = await treeDup.getLabel();

            await Misc.selectContextMenuItem(treeDup, "Delete DB Connection");

            const editorView = new EditorView();
            await driver.wait(async () => {
                const activeTab = await editorView.getActiveTab();

                return await activeTab.getTitle() === dbEditorDefaultName;
            }, 3000, "error");

            try {
                await Misc.switchToWebView();

                const dialog = await driver.wait(until.elementLocated(
                    By.css(".visible.confirmDialog")), explicitWait, "confirm dialog was not found");
                await dialog.findElement(By.id("accept")).click();

                await driver.switchTo().defaultContent();

                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

                treeDBSection = await Misc.getSection(dbTreeSection);

                expect(await treeDBSection.findItem(dupName, dbMaxLevel)).to.not.exist;
            } finally {
                await new EditorView().closeEditor(dbEditorDefaultName);
            }

        });

        it("Schema - Copy name and create statement to clipboard", async () => {

            treeGlobalSchema = await treeDBSection.findItem((globalConn.basic as IConnBasicMySQL).schema, dbMaxLevel);

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(treeGlobalSchema, "Copy To Clipboard -> Name");
                await Misc.verifyNotification("The name was copied to the system clipboard");

                return clipboard.readSync() === (globalConn.basic as IConnBasicMySQL).schema;

            }), explicitWait*3, "The schema name was not copied to the clipboard");

            treeGlobalSchema = await treeDBSection.findItem((globalConn.basic as IConnBasicMySQL).schema, dbMaxLevel);

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(treeGlobalSchema, "Copy To Clipboard -> Create Statement");
                await Misc.verifyNotification("The create script was copied to the system clipboard");

                return clipboard.readSync().includes("CREATE DATABASE");

            }), explicitWait*3, "The schema create statement was not copied to the clipboard");

        });

        it("Drop Schema", async () => {

            await (await Misc.getActionButton(treeGlobalConn, "Connect to Database")).click();

            await new EditorView().openEditor(dbEditorDefaultName);

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await Database.tryCredentials(globalConn);

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testSchema = `testschema${random}`;

            let result = await Misc.execCmd("call clearSchemas();", undefined, explicitWait * 2);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`create schema ${testSchema};`);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            let treeTestSchema: TreeItem | undefined;
            await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeTestSchema = await treeDBSection.findItem(testSchema, dbMaxLevel);

                return treeTestSchema;
            }, explicitWait, `${testSchema} was not found`);

            treeGlobalSchema = await treeDBSection.findItem((globalConn.basic as IConnBasicMySQL).schema, dbMaxLevel);

            await Misc.selectContextMenuItem(treeTestSchema, "Drop Schema...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testSchema}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testSchema}`);
            }

            await Misc.verifyNotification(`The object ${testSchema} has been dropped successfully.`, true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(testSchema, dbMaxLevel)).to.not.exist;

        });

        it("Table - Select Rows in DB Notebook", async () => {

            treeGlobalSchema = await driver.wait(new Condition("", async () => {
                return treeDBSection.findItem((globalConn.basic as IConnBasicMySQL).schema, dbMaxLevel);
            }), explicitWait, `treeGlobalSchema is undefined after ${explicitWait} secs`);

            await treeGlobalSchema.expand();

            treeGlobalSchemaTables = await driver.wait(new Condition("", async () => {
                return treeDBSection.findItem("Tables", dbMaxLevel);
            }), explicitWait, `treeGlobalSchemaTables is undefined after ${explicitWait} secs`);

            await treeGlobalSchemaTables.expand();

            const actorTable = await treeDBSection.findItem("actor", dbMaxLevel);

            await Misc.selectContextMenuItem(actorTable, "Select Rows in DB Notebook");

            try {
                await new EditorView().openEditor(globalConn.caption);
                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
                const result = await Misc.getCmdResultMsg();
                expect(result).to.match(/OK/);
            } finally {
                clean = true;
            }

        });

        it("Table - Copy name and create statement to clipboard", async () => {

            const actorTable = await treeDBSection.findItem("actor", dbMaxLevel);

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(actorTable, "Copy To Clipboard -> Name");
                await Misc.verifyNotification("The name was copied to the system clipboard");

                return clipboard.readSync() === "actor";

            }), explicitWait*3, "The table name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(actorTable, "Copy To Clipboard -> Create Statement");
                await Misc.verifyNotification("The create script was copied to the system clipboard");

                return clipboard.readSync().includes("idx_actor_last_name");

            }), explicitWait*3, "The table create statement was not copied to the clipboard");

        });

        it("Drop Table", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testTable = `testtable${random}`;

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            let result = await Misc.execCmd("call clearTables();", undefined, explicitWait * 2);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`create table ${testTable} (id int, name VARCHAR(50));`);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            let treeTestTable: TreeItem | undefined;
            await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeTestTable = await treeDBSection.findItem(testTable, dbMaxLevel);

                return treeTestTable;
            }, explicitWait, `${testTable} was not found`);

            await Misc.selectContextMenuItem(treeTestTable, "Drop Table...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testTable}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testTable}`);
            }

            await Misc.verifyNotification(`The object ${testTable} has been dropped successfully.`, true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(testTable, dbMaxLevel)).to.not.exist;

        });

        it("View - Select Rows in DB Notebook", async () => {

            treeGlobalSchemaViews = await driver.wait(new Condition("", async () => {
                return treeDBSection.findItem("Views", dbMaxLevel);
            }), explicitWait, `treeGlobalSchemaTables is undefined after ${explicitWait} secs`);

            await treeGlobalSchemaViews.expand();

            const treeTestView = await treeDBSection.findItem("test_view", dbMaxLevel);

            await Misc.selectContextMenuItem(treeTestView, "Select Rows in DB Notebook");

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            const result = await Misc.getCmdResultMsg();

            expect(result).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async () => {

            const treeTestView = await treeDBSection.findItem("test_view", dbMaxLevel);

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(treeTestView, "Copy To Clipboard -> Name");
                await Misc.verifyNotification("The name was copied to the system clipboard");

                return clipboard.readSync() === "test_view";

            }), explicitWait*3, "The view name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                await Misc.selectContextMenuItem(treeTestView, "Copy To Clipboard -> Create Statement");
                await Misc.verifyNotification("The create script was copied to the system clipboard");

                return clipboard.readSync().includes("DEFINER VIEW");

            }), explicitWait*3, "The view create statement was not copied to the clipboard");

        });

        it("Drop View", async () => {

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testView = `testview${random}`;

            let result = await Misc.execCmd("call clearViews();", undefined, explicitWait * 2);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`CREATE VIEW ${testView} as select * from sakila.actor;`);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            let treeTestView: TreeItem | undefined;
            await driver.wait(async () => {
                await (await Misc.getActionButton(treeGlobalConn, "Reload Database Information")).click();
                treeTestView = await treeDBSection.findItem(testView, dbMaxLevel);

                return treeTestView;
            }, explicitWait, `${testView} was not found`);

            await treeGlobalConn.expand();
            await treeGlobalSchema.expand();
            await treeGlobalSchemaViews.expand();

            await Misc.selectContextMenuItem(treeTestView, "Drop View...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testView}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testView}`);
            }

            await Misc.verifyNotification(`The object ${testView} has been dropped successfully.`, true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(testView, dbMaxLevel)).to.not.exist;

        });

        it("Table - Show Data", async () => {

            await new EditorView().closeAllEditors();
            const actorTable = await treeDBSection.findItem("actor", dbMaxLevel);
            await Misc.selectContextMenuItem(actorTable, "Show Data");
            await new EditorView().openEditor(dbEditorDefaultName);
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            await Database.tryCredentials(globalConn);
            const result = await Database.getScriptResult();
            expect(result[0]).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), explicitWait, "Result tab was not maxized");

        });

        it("View - Show Data", async () => {

            const treeTestView = await treeDBSection.findItem("test_view", dbMaxLevel);
            await Misc.selectContextMenuItem(treeTestView, "Show Data");
            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            const result = await Database.getScriptResult();
            expect(result[0]).to.match(/OK/);
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), explicitWait, "Resulta tab was not maxized");

        });

    });

});
