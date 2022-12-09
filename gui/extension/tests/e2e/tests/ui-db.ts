/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
    Workbench,
    until,
    InputBox,
    Key as seleniumKey,
    ModalDialog,
    WebElement,
    Key,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import fs from "fs/promises";
import { expect } from "chai";
import {
    dbTreeSection,
    ociTreeSection,
    consolesTreeSection,
    tasksTreeSection,
    driver,
    explicitWait,
    Misc,
    mysqlshLog,
    isExtPrepared,
} from "../lib/misc";

import { IDBConnection, Database } from "../lib/db";

import { ChildProcess } from "child_process";
import { homedir, platform } from "os";
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
    if (!process.env.SSLCERTSPATH) {
        throw new Error("Please define the environment variable SSLCERTSPATH");
    }

    const globalConn: IDBConnection = {
        caption: "conn",
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    before(async function () {

        try {
            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            await Misc.initTreeSection(dbTreeSection);
            await Misc.toggleSection(ociTreeSection, false);
            await Misc.toggleSection(consolesTreeSection, false);
            await Misc.toggleSection(tasksTreeSection, false);
            await Misc.toggleBottomBar(false);

            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await Misc.reloadSection(dbTreeSection);
            const el = await Misc.getTreeElement(dbTreeSection, globalConn.caption);
            expect(el).to.exist;

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Misc.toggleSection(dbTreeSection, false);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Toolbar", () => {

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
            await new EditorView().closeAllEditors();

        });


        it("Create and delete a Database connection", async () => {
            const localConn: IDBConnection = {
                caption: `conn${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                username: String(process.env.DBUSERNAME),
                port: Number(process.env.DBPORT),
                portX: Number(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            let flag = false;

            try {
                await Database.createConnection(localConn);
                flag = true;
                expect(await Database.getWebViewConnection(localConn.caption)).to.exist;
                await Misc.reloadSection(dbTreeSection);
                expect(await Misc.getTreeElement(dbTreeSection, localConn.caption)).to.exist;
            } finally {
                if (flag) {
                    await Database.deleteConnection(localConn.caption);
                }
            }
        });

        it("Open the DB Connecion Browser", async () => {

            const openConnBrw = await Misc.getSectionToolbarButton(dbTreeSection,
                "Open the DB Connection Browser");
            await openConnBrw?.click();

            await Misc.switchToWebView();

            expect(
                await driver.wait(until.elementLocated(By.id("title")),
                    explicitWait, "Title was not found").getText(),
            ).to.equal("MySQL Shell - DB Notebooks");

            expect(
                (await driver
                    .findElement(By.id("contentTitle"))
                    .getText()).toUpperCase())
                .to.equal(dbTreeSection);

            expect(
                await driver
                    .findElements(
                        By.css("#tilesHost button"),
                    ),
            ).to.have.lengthOf.at.least(1);

        });

        // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34200753
        it.skip("Connect to external MySQL Shell process", async () => {
            let prc: ChildProcess;
            try {
                prc = await Misc.startServer();
                await Misc.selectMoreActionsItem(dbTreeSection, "Connect to External MySQL Shell Process");
                const input = new InputBox();
                await input.setText("http://localhost:8500");
                await input.confirm();

                let serverOutput = "";
                prc!.stdout!.on("data", (data) => {
                    serverOutput += data as String;
                });

                await driver.wait(() => {
                    if (serverOutput.indexOf(
                        "Registering session") !== -1) {
                        return true;
                    }
                }, 10000, "External process was not successful");

            } finally {
                if (prc!) {
                    prc!.kill();
                }
            }
        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(mysqlshLog);

            await Misc.selectMoreActionsItem(dbTreeSection, "Restart the Internal MySQL Shell Process");

            const dialog = await driver.wait(until.elementLocated(By.css(".notification-toast-container")),
                3000, "Restart dialog was not found");

            const restartBtn = await dialog.findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]"));
            await restartBtn.click();
            await driver.wait(until.stalenessOf(dialog), 3000, "Restart MySQL Shell dialog is still displayed");

            await driver.wait(async () => {
                const text = await fs.readFile(mysqlshLog);
                if (text.includes("Registering session...")) {
                    return true;
                }
            }, 20000, "Restarting the internal MySQL Shell server went wrong");

        });

        it("Relaunch Welcome Wizard", async () => {

            await Misc.selectMoreActionsItem(dbTreeSection, "Relaunch Welcome Wizard");

            const editor = new EditorView();
            const titles = await editor.getOpenEditorTitles();

            expect(titles).to.include.members(["Welcome to MySQL Shell"]);
            const active = await editor.getActiveTab();
            expect(await active?.getTitle()).equals("Welcome to MySQL Shell");

            await driver.wait(until.ableToSwitchToFrame(0), explicitWait, "Not able to switch to frame 0");
            await driver.wait(until.ableToSwitchToFrame(
                By.id("active-frame")), explicitWait, "Not able to switch to frame 2");

            const text = await driver.findElement(By.css("#page1 h3")).getText();
            expect(text).equals("Welcome to MySQL Shell for VS Code.");
            expect(await driver.findElement(By.id("nextBtn"))).to.exist;

        });
    });

    describe("Context menu items", () => {

        before(async () => {
            await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, true);
            await Misc.toggleTreeElement(dbTreeSection, globalConn.schema, true);
            await Misc.toggleTreeElement(dbTreeSection, "Tables", true);
            await Misc.toggleTreeElement(dbTreeSection, "Views", true);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
        });

        after(async function () {
            try {
                await new EditorView().closeAllEditors();
                await Database.collapseAllConnections();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Connect to Database", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, globalConn.caption, "Connect to Database");

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            const item = await driver.wait(until.elementLocated(By.css(".zoneHost")),
                explicitWait, "zoneHost not found");

            expect(item).to.exist;

        });

        it("Connect to Database in New Tab", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, globalConn.caption,
                "Connect to Database on New Tab");

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait);

            await driver.switchTo().defaultContent();

            await driver.wait(async () => {
                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                let counter = 0;
                for (const editor of editors) {
                    if (editor === globalConn.caption) {
                        counter++;
                    }
                }

                return counter === 2;
            }, 5000, "DB Connection second tab was not opened");

            await new EditorView().closeEditor(globalConn.caption);

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, globalConn.caption,
                "Open MySQL Shell Console for this Connection");

            await new EditorView().openEditor("MySQL Shell Consoles");

            await Misc.switchToWebView();

            const item = await driver.wait(until
                .elementLocated(By.css("code > span")), 10000, "MySQL Shell Console was not loaded");

            expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");
            await driver.switchTo().defaultContent();

            try {
                await Misc.toggleSection(consolesTreeSection, true);
                expect(await Misc.getTreeElement(
                    ociTreeSection, `Session to ${globalConn.caption}`)).to.exist;
            } finally {
                await Misc.toggleSection(consolesTreeSection, false);
            }

        });

        it("Edit MySQL connection", async () => {

            const localConn: IDBConnection = {
                caption: `toEdit${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                username: String(process.env.DBUSERNAME),
                port: Number(process.env.DBPORT),
                portX: Number(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            await Database.createConnection(localConn);

            expect(await Database.getWebViewConnection(localConn.caption, true, globalConn.caption)).to.exist;

            const edView = new EditorView();
            await edView.closeEditor("DB Connections");

            await Misc.reloadSection(dbTreeSection);

            await Misc.selectContextMenuItem(dbTreeSection, localConn.caption, "Edit DB Connection");

            await new EditorView().openEditor("DB Connections");

            await Misc.switchToWebView();

            const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not found");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const edited = `edited${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(edited);
            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver.switchTo().defaultContent();

            await driver.wait(async () => {
                await Misc.reloadSection(dbTreeSection);
                try {
                    await Misc.getTreeElement(dbTreeSection, edited);

                    return true;
                } catch (e) { return false; }
            }, explicitWait, "Database was not updated");

        });

        it("Duplicate this MySQL connection", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, globalConn.caption,
                "Duplicate this DB Connection");

            await new EditorView().openEditor("DB Connections");

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

            await driver.wait(async () => {
                await Misc.reloadSection(dbTreeSection);
                const db = await Misc.getSection(dbTreeSection);

                return (await db?.findElements(By.xpath(`//div[contains(@aria-label, '${dup}')]`)))!.length === 1;
            }, 10000, "Duplicated database was not found");
        });

        it("Schema - Copy name and create statement to clipboard", async () => {

            await Database.connectToDatabase(globalConn.caption);

            await Misc.selectContextMenuItem(dbTreeSection, globalConn.schema,
                "Copy To Clipboard -> Name");

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            let textArea = await driver.wait(until.elementLocated(By.css("textarea")),
                explicitWait, "Text are not found");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            try {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include(globalConn.schema);

                await driver.switchTo().defaultContent();

                await Misc.selectContextMenuItem(dbTreeSection, globalConn.schema,
                    "Copy To Clipboard -> Create Statement");

                await new EditorView().openEditor(globalConn.caption);
                await Misc.switchToWebView();
                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.findElement(By.css(".current-line")),
                );

                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                textArea = await driver.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("CREATE DATABASE");
            } finally {
                await Misc.cleanEditor();
            }


        });

        it("Drop Schema", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testSchema = `testschema${random}`;

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "DB Editor was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );


            let result = await Misc.execCmd("call clearSchemas();", explicitWait * 2);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`create schema ${testSchema};`);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await Database.reloadConnection(globalConn.caption);

                return Misc.existsTreeElement(dbTreeSection, testSchema);
            }, explicitWait, `${testSchema} was not found`);

            await Misc.selectContextMenuItem(dbTreeSection, testSchema, "Drop Schema...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testSchema}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testSchema}`);
            }

            const msg = await driver.wait(until.elementLocated(By.css(".notification-list-item-message > span")),
                explicitWait, "Notification not found");
            await driver.wait(until.elementTextIs(msg,
                `The object ${testSchema} has been dropped successfully.`), explicitWait, "Text was not found");

            await driver.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await Misc.getSection(dbTreeSection);
            await Misc.reloadSection(dbTreeSection);
            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testSchema}') and contains(@role, 'treeitem')]`)))!
                    .length === 0;
            }, explicitWait, `${testSchema} is still on the list`);


        });

        it("Table - Show Data", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, "actor", "Show Data...");

            try {
                await new EditorView().openEditor(globalConn.caption);
                await Misc.switchToWebView();
                const result = await Misc.getLastCmdResult();
                expect(result).to.match(/OK, (\d+) records/);
            } finally {
                await Misc.cleanEditor();
            }

        });

        it("Table - Copy name and create statement to clipboard", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, "actor",
                "Copy To Clipboard -> Name");

            await new EditorView().openEditor(globalConn.caption);

            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "DB Editor was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            let textArea = await driver.findElement(By.css("textarea"));

            try {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("actor");

                await driver.switchTo().defaultContent();

                await Misc.selectContextMenuItem(dbTreeSection, "actor",
                    "Copy To Clipboard -> Create Statement");

                await new EditorView().openEditor(globalConn.caption);
                await Misc.switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.findElement(By.css(".current-line")),
                );

                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                textArea = await driver.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("idx_actor_last_name");
            } finally {
                await Misc.cleanEditor();
            }
        });

        it("Drop Table", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testTable = `testtable${random}`;

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "DB Editor was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            let result = await Misc.execCmd("call clearTables();", 10000);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`create table ${testTable} (id int, name VARCHAR(50));`, explicitWait);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await Database.reloadConnection(globalConn.caption);

                return Misc.existsTreeElement(dbTreeSection, testTable);
            }, explicitWait, `${testTable} was not found`);

            await Misc.selectContextMenuItem(dbTreeSection, testTable, "Drop Table...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testTable}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testTable}`);
            }

            const msg = await driver.wait(until.elementLocated(By.css(".notification-list-item-message > span")),
                explicitWait, "Notification not found");
            await driver.wait(until.elementTextIs(msg,
                `The object ${testTable} has been dropped successfully.`), explicitWait, "Text was not found");

            await driver.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await Misc.getSection(dbTreeSection);
            await Misc.reloadSection(dbTreeSection);

            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    "//div[contains(@aria-label, 'testTable') and contains(@role, 'treeitem')]")))!.length === 0;
            }, explicitWait, `${testTable} is still on the list`);

        });

        it("View - Show Data", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, "test_view", "Show Data...");

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            const result = await Misc.getLastCmdResult();

            expect(result).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async () => {

            await Misc.selectContextMenuItem(dbTreeSection, "test_view",
                "Copy To Clipboard -> Name");

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "DB Editor was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            try {
                let textArea = await driver.findElement(By.css("textarea"));

                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("test_view");

                await driver.switchTo().defaultContent();

                await Misc.selectContextMenuItem(dbTreeSection, "test_view",
                    "Copy To Clipboard -> Create Statement");

                await new EditorView().openEditor(globalConn.caption);
                await Misc.switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await driver.findElement(By.css(".current-line")),
                );

                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));

                textArea = await driver.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("DEFINER VIEW");
            } finally {
                await Misc.cleanEditor();
            }

        });

        it("Drop View", async () => {

            await new EditorView().openEditor(globalConn.caption);
            await Misc.switchToWebView();

            await driver.wait(until.elementLocated(By.css("textarea")), explicitWait, "DB Editor was not loaded");

            await driver.executeScript(
                "arguments[0].click();",
                await driver.findElement(By.css(".current-line")),
            );

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testView = `testview${random}`;

            let result = await Misc.execCmd("call clearViews();", explicitWait * 2);
            expect(result[0]).to.include("OK");

            result = await Misc.execCmd(`CREATE VIEW ${testView} as select * from sakila.actor;`);
            expect(result[0]).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await Database.reloadConnection(globalConn.caption);

                return Misc.existsTreeElement(dbTreeSection, testView);
            }, explicitWait, `${testView} was not found`);

            await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, true);
            await Misc.toggleTreeElement(dbTreeSection, globalConn.schema, true);
            await Misc.toggleTreeElement(dbTreeSection, "Views", true);

            await Misc.selectContextMenuItem(dbTreeSection, testView, "Drop View...");

            const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testView}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testView}`);
            }

            const msg = await driver.wait(until.elementLocated(By.css(".notification-list-item-message > span")),
                explicitWait, "Notification not found");
            await driver.wait(until.elementTextIs(msg,
                `The object ${testView} has been dropped successfully.`), 3000, "Text was not found");

            await driver.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await Misc.getSection(dbTreeSection);
            await Misc.reloadSection(dbTreeSection);

            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testView}') and contains(@role, 'treeitem')]`)))!.length === 0;
            }, explicitWait, `${testView} is still on the list`);

        });

    });

    describe("Database connections", () => {

        beforeEach(async function () {
            try {
                const openConnBrw = await Misc.getSectionToolbarButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();
                await Misc.switchToWebView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.switchTo().defaultContent();
        });

        after(async function () {
            try {
                await new EditorView().closeAllEditors();
                await Database.collapseAllConnections();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Store and clear password", async () => {

            let host = await Database.getWebViewConnection(globalConn.caption, false);
            await driver.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
            );

            let contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            let conDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await conDialog.findElement(By.id("storePassword")).click();
            const savePassDialog = await driver.findElement(By.css(".visible.passwordDialog"));
            await savePassDialog.findElement(By.css("input")).sendKeys(globalConn.password);
            await savePassDialog.findElement(By.id("ok")).click();
            await conDialog.findElement(By.id("ok")).click();

            await driver.executeScript(
                "arguments[0].click();",
                await Database.getWebViewConnection(globalConn.caption, false),
            );

            expect(await Database.isConnectionSuccessful(globalConn.caption)).to.be.true;

            await Database.closeConnection(globalConn.caption);

            const openConnBrw = await Misc.getSectionToolbarButton(dbTreeSection,
                "Open the DB Connection Browser");
            await openConnBrw?.click();

            await Misc.switchToWebView();

            host = await Database.getWebViewConnection(globalConn.caption, false);

            await driver.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
            );

            contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            conDialog = await driver.findElement(By.css(".valueEditDialog"));
            await conDialog.findElement(By.id("clearPassword")).click();

            const confirmDialog = await driver.wait(until.elementLocated(By.css(".confirmDialog")),
                explicitWait, "Confirm dialog was not displayed");
            const confirmText = await confirmDialog.findElement(By.css(".content > div > div > div"));
            expect(await confirmText.getText()).to.equals("Password was cleared.");
            await confirmDialog.findElement(By.id("accept")).click();
            await driver.wait(until.stalenessOf(confirmDialog), 3000, "Confirm dialog was not closed");
            await conDialog.findElement(By.id("ok")).click();

            await driver.executeScript(
                "arguments[0].click();",
                await Database.getWebViewConnection(globalConn.caption, false),
            );

            const passwordDialog = await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                explicitWait, "Password dialog was not displayed");

            expect(passwordDialog).to.exist;
            await passwordDialog.findElement(By.id("cancel")).click();
            await driver.wait(until.elementLocated(By.css(".errorPanel button")), explicitWait,
                "Cancellation error dialog was not found").click();
        });

        it("Confirm dialog - Save password", async () => {

            await driver.executeScript(
                "arguments[0].click();",
                await Database.getWebViewConnection(globalConn.caption, false),
            );

            await Database.setPassword(globalConn);

            await Misc.setConfirmDialog(globalConn, "yes");

            expect(await Database.isConnectionSuccessful(globalConn.caption))
                .to.be.true;

            await Database.closeConnection(globalConn.caption);

            const openConnBrw = await Misc.getSectionToolbarButton(dbTreeSection,
                "Open the DB Connection Browser");
            await openConnBrw?.click();

            await Misc.switchToWebView();

            await driver.executeScript(
                "arguments[0].click();",
                await Database.getWebViewConnection(globalConn.caption, false),
            );

            expect(await Database.isConnectionSuccessful(globalConn.caption))
                .to.be.true;
        });

        it("Edit a database connection and verify errors", async () => {
            const host = await Database.getWebViewConnection(globalConn.caption, false);
            await driver.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
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
                until.elementLocated(By.css("label.error")),
                2000,
            );

            expect(await error.getText()).to.equals("The caption cannot be empty");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

            await customClear(await conDialog.findElement(By.id("hostName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .to.equals("Specify a valid host name or IP address");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

            await customClear(await conDialog.findElement(By.id("userName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(By.id("ok")).click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .to.equals("The user name must not be empty");

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await driver.findElement(By.id("cancel")).click();
        });

        it("Connect to SQLite database", async () => {

            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                explicitWait, "Connection browser not found");

            await connBrowser.findElement(By.id("-1")).click();

            const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await Database.selectDatabaseType("Sqlite");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const sqliteConName = `Sqlite DB${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(sqliteConName);

            await newConDialog.findElement(By.id("description")).clear();
            await newConDialog
                .findElement(By.id("description"))
                .sendKeys("Local Sqlite connection");

            const inputs = await newConDialog.findElements(By.css("input.msg.input"));
            let dbPath: WebElement;
            for (const input of inputs) {
                if (!(await input.getAttribute("id"))) {
                    dbPath = input;
                }
            }

            let sqlite = "";
            if (platform() === "darwin") {
                sqlite = join(homedir(), ".mysqlsh-gui",
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");
            } else {
                sqlite = join(String(process.env.APPDATA), "MySQL", "mysqlsh-gui",
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");
            }

            await dbPath!.sendKeys(sqlite);
            await newConDialog.findElement(By.id("dbName")).sendKeys("SQLite");
            await newConDialog.findElement(By.id("ok")).click();

            const sqliteConn = await Database.getWebViewConnection(sqliteConName, false);
            expect(sqliteConn).to.exist;
            expect(await sqliteConn.findElement(By.css(".tileDescription")).getText()).to.equals(
                "Local Sqlite connection",
            );

            await driver.executeScript(
                "arguments[0].click();",
                sqliteConn,
            );

            expect(await Database.isConnectionSuccessful(sqliteConName)).to.be.true;

            await driver.switchTo().defaultContent();
            await Misc.reloadSection(dbTreeSection);
            await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, true);
            await Misc.toggleTreeElement(dbTreeSection, sqliteConName, true);
            await Misc.toggleTreeElement(dbTreeSection, "main", true);
            await Misc.toggleTreeElement(dbTreeSection, "Tables", true);
            await Misc.hasTreeChildren(dbTreeSection, "Tables", "db_connection");

            await Misc.selectContextMenuItem(dbTreeSection, "db_connection", "Show Data...");

            await Misc.switchToWebView();

            const result = await driver.wait(async () => {
                const res = await Misc.getLastCmdResult();
                if (res!.length > 0) {
                    return res;
                } else {
                    return false;
                }
            }, explicitWait, "No results were found");

            expect(result).to.include("OK");
        });

        it("Connect to MySQL database using SSL", async () => {
            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                explicitWait, "Connection browser not found");

            await connBrowser.findElement(By.id("-1")).click();

            const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `SSL Connection${String(Math.floor(Math.random() * 100))}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(conName);

            await newConDialog.findElement(By.id("description")).clear();

            await newConDialog
                .findElement(By.id("description"))
                .sendKeys("New SSL Connection");

            await newConDialog.findElement(By.id("hostName")).clear();

            await newConDialog
                .findElement(By.id("hostName"))
                .sendKeys(globalConn.hostname);

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(globalConn.username);

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(globalConn.schema);

            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id("Require and Verify CA")).click();
            expect(await newConDialog.findElement(By.css("#sslMode label")).getText())
                .to.equals("Require and Verify CA");

            const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
            await paths[0].sendKeys(`${String(process.env.SSLCERTSPATH)}/ca-cert.pem`);
            await paths[1].sendKeys(`${String(process.env.SSLCERTSPATH)}/client-cert.pem`);
            await paths[2].sendKeys(`${String(process.env.SSLCERTSPATH)}/client-key.pem`);

            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const dbConn = await Database.getWebViewConnection(conName, false);
            expect(dbConn).to.exist;

            await driver.executeScript(
                "arguments[0].click();",
                dbConn,
            );

            expect(await Database.isConnectionSuccessful(conName)).to.be.true;

            const result = await Misc.execCmd("SHOW STATUS LIKE 'Ssl_cipher';");

            expect(result[0]).to.include("1 record retrieved");

            expect(await (result[1] as WebElement)
                .findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]"))).to.exist;
        });

    });

    describe("DB Editor", () => {

        before(async function () {
            try {
                await Database.connectToDatabase(globalConn.caption);
                await Misc.switchToWebView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, false);
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
                await Misc.cleanEditor();
            }
        });

        it("Using a DELIMITER", async () => {

            await Misc.cleanEditor();
            await Misc.writeCmd("DELIMITER $$ ", true);
            const textArea = await driver.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("SELECT ACTOR_ID", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("FROM ", true);
            await textArea.sendKeys(Key.RETURN);
            await Misc.writeCmd("SAKILA.ACTOR LIMIT 1 $$", true);

            expect(await Database.isStatementStart("DELIMITER $$")).to.be.true;
            expect(await Database.isStatementStart("SELECT ACTOR_ID")).to.be.true;
            expect(await Database.isStatementStart("FROM")).to.be.false;
            expect(await Database.isStatementStart("SAKILA.ACTOR LIMIT 1 $$")).to.be.false;

            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.RETURN);

            await Misc.writeCmd("select 1 $$ ");
            expect(await Database.isStatementStart("select 1 $$")).to.be.true;

            const result = await Database
                .execQueryByToolbarButton("Execute selection or full block and create a new block");

            expect(result[0]).to.include("OK");
            const tabs = await (result[1] as WebElement).findElements(By.css(".tabArea label"));
            expect(tabs.length).to.equals(2);
            expect(await tabs[0].getAttribute("innerHTML")).to.include("Result");
            expect(await tabs[1].getAttribute("innerHTML")).to.include("Result");
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

            const result = await Database.execQueryByToolbarButton(
                "Execute selection or full block and create a new block", "SELECT * FROM ACTOR;");

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

                let result = await Database.execQueryByToolbarButton("Execute the statement at the caret position");
                expect(await Misc.getResultColumns(result[1] as WebElement)).to.include("actor_id");

                await textArea.sendKeys(Key.ARROW_DOWN);

                result = await Database.execQueryByToolbarButton("Execute the statement at the caret position");

                expect(await Misc.getResultColumns(result[1] as WebElement)).to.include("address_id");
            } finally {
                await Misc.cleanEditor();
            }
        });

        it("Switch between search tabs", async () => {

            const result = await Misc
                .execCmd("select * from sakila.actor limit 1; select * from sakila.address limit 1;", undefined, true);

            expect(await Misc.getResultTabs(result[1] as WebElement)).to.have.members(["Result #1", "Result #2"]);

            const result1 = await Misc.getResultTab(result[1] as WebElement, "Result #1");
            const result2 = await Misc.getResultTab(result[1] as WebElement, "Result #2");

            expect(result1).to.exist;
            expect(result2).to.exist;

            expect(await Misc.getResultColumns(result[1] as WebElement)).to.have.members(["actor_id",
                "first_name", "last_name", "last_update"]);

            await result2!.click();

            expect(await Misc.getResultColumns(result[1] as WebElement)).to.include.members(["address_id",
                "address", "address2", "district", "city_id", "postal_code", "phone", "last_update"]);

        });

        it("Connect to database and verify default schema", async () => {

            const result = await Misc.execCmd("SELECT SCHEMA();");
            expect(result[0]).to.include("1 record retrieved");

            expect(await ((result[1] as WebElement).findElement(By.css(".tabulator-cell"))).getText())
                .to.equals(globalConn.schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommit = await Database.getToolbarButton("Auto commit DB changes");
            const style = await autoCommit?.findElement(By.css("div")).getAttribute("style");
            if (style?.includes("toolbar-auto_commit-active")) {
                await autoCommit?.click();
            }

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await Database.getToolbarButton("Commit DB changes");
            const rollBackBtn = await Database.getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn as WebElement),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn as WebElement),
                3000, "Commit button should be enabled");

            let result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            expect(result[0]).to.include("OK");

            await rollBackBtn!.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name='${random}';`);
            expect(result[0]).to.include("OK, 0 records retrieved");

            result = await Misc
                .execCmd(`INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);
            expect(result[0]).to.include("OK");

            await commitBtn!.click();

            result = await Misc.execCmd(`SELECT * FROM sakila.actor WHERE first_name='${random}';`);
            expect(result[0]).to.include("OK, 1 record retrieved");

            await autoCommit!.click();

            await driver.wait(
                async () => {
                    return (
                        (await commitBtn!.isEnabled()) === false &&
                        (await rollBackBtn!.isEnabled()) === false
                    );
                },
                explicitWait,
                "Commit/Rollback DB changes button is still enabled ",
            );
        });

        it("Connection toolbar buttons - Find and Replace", async () => {

            try {
                const contentHost = await driver.findElement(By.id("contentHost"));

                await Misc.writeCmd(`import from xpto xpto xpto`);

                const findBtn = await Database.getToolbarButton("Find");
                await findBtn!.click();

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

                await (await Database.replacerGetButton(replacer, "Replace (Enter)"))!.click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester xpto xpto");

                await replacer.findElement(By.css("textarea")).clear();

                await replacer.findElement(By.css("textarea")).sendKeys("testing");

                await (await Database.replacerGetButton(replacer, "Replace All"))!.click();

                expect(
                    await contentHost.findElement(By.css("textarea")).getAttribute("value"),
                ).to.include("import from tester testing testing");

                await Database.closeFinder(finder);

                expect(await finder.getAttribute("aria-hidden")).equals("true");

            } finally {
                await Misc.cleanEditor();
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

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await Misc.execOnEditor();

                const otherResult = await Misc.getLastCmdResult();

                expect(otherResult).to.match(/(\d+).(\d+)/);

                expect(otherResult !== result2[0]).equals(true);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await Misc.execOnEditor();

                const otherResult1 = await Misc.getLastCmdResult();

                expect(otherResult1).to.match(/(\d+).(\d+)/);

                expect(otherResult1 !== result4[0]).equals(true);

            } finally {
                await Misc.cleanEditor();
            }


        });

        it("Multi-line comments", async () => {

            let result = await Misc.execCmd("\\sql ");
            expect(result[0]).to.include("Switched to MySQL mode");

            result =  await Misc.execCmd("SELECT VERSION();");
            expect(result[0]).to.include("1 record retrieved");

            const txt = await (result[1] as WebElement).findElement(By.css(".tabulator-cell")).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            result = await Misc.execCmd(`/*!${serverVer} select * from actor;*/`);

            expect(result[0]).to.match(/OK, (\d+) records retrieved/);

            const higherServer = parseInt(serverVer, 10) + 1;

            result = await Misc.execCmd(`/*!${higherServer} select * from actor;*/`);

            expect(result[0]).to.include("OK, 0 records retrieved");

        });

        it("Context Menu - Execute", async () => {

            const textArea = await driver.findElement(By.css("textarea"));
            await Misc.writeCmd("select * from sakila.actor;");

            let lastId = await Database.getLastQueryResultId();
            await Database.clickContextMenuItem(textArea, "Execute Block");

            await driver.wait(async () => {
                return (await Database.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await Misc.getLastCmdResult()).to.match(/OK, (\d+) records retrieved/);

            expect(await Database.hasNewPrompt()).to.be.false;

            lastId = await Database.getLastQueryResultId();

            await Database.clickContextMenuItem(textArea, "Execute Block and Advance");

            await driver.wait(async () => {
                return (await Database.getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await Misc.getLastCmdResult()).to.match(/OK, (\d+) records retrieved/);

            expect(await Database.hasNewPrompt()).to.be.true;

        });

        it("Pie Graph based on DB table", async () => {

            let  result = await Misc.execCmd("\\ts ");
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

    });

    describe("Scripts", () => {

        before(async function () {
            try {
                await Database.connectToDatabase(globalConn.caption);
                await Misc.switchToWebView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver.findElement(By.id("itemCloseButton")).click();
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Add SQL Script", async () => {

            await Database.addScript("sql");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.equals("mysql");

            const result = await Database.execScript("select * from sakila.actor limit 1;");
            expect(result[0]).to.match(/OK, (\d+) record/);

        });

        it("Add Typescript", async () => {

            await Database.addScript("ts");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.equals("typescript");

            const result = await Database.execScript("Math.random()");
            expect(result[0]).to.match(/(\d+).(\d+)/);

        });

        it("Add Javascript", async () => {

            await Database.addScript("js");
            expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await Database.getCurrentEditorType()).to.equals("javascript");

            const result = await Database.execScript("Math.random()");
            expect(result[0]).to.match(/(\d+).(\d+)/);

        });

    });

    describe("MySQL Administration", () => {

        before(async function () {
            try {
                await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Misc.toggleTreeElement(dbTreeSection, "MySQL Administration", true);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await driver?.switchTo().defaultContent();
        });

        after(async function () {
            try {
                await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Server Status", async () => {

            const serverSt = await Misc.getTreeElement(dbTreeSection, "Server Status");
            await serverSt.click();
            await Misc.switchToWebView();
            expect(await Database.getCurrentEditor()).to.equals("Server Status");

            const sections = await driver?.findElements(By.css(".grid .heading label"));
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

            const clientConn = await Misc.getTreeElement(dbTreeSection, "Client Connections");
            await clientConn.click();
            await Misc.switchToWebView();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Client Connections";
            }, explicitWait, "Clients Connections editor was not selected");

            const properties = await driver?.findElements(By.css("#connectionProps label"));
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

            const list = await driver?.findElement(By.id("connectionList"));
            const rows = await list?.findElements(By.css(".tabulator-row"));
            expect(rows.length).to.be.above(0);
        });

        it("Performance Dashboard", async () => {

            const perfDash = await Misc.getTreeElement(dbTreeSection, "Performance Dashboard");
            await perfDash.click();
            await Misc.switchToWebView();
            await driver.wait(async () => {
                return await Database.getCurrentEditor() === "Performance Dashboard";
            }, explicitWait, "Performance Dashboard editor was not selected");

            const grid = await driver?.findElement(By.id("dashboardGrid"));
            const gridItems = await grid?.findElements(By.css(".gridCell.title"));
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

    describe("REST API", () => {

        let randomService = "";

        before(async function () {
            try {
                const randomCaption = "";
                await Misc.toggleTreeElement(dbTreeSection, globalConn.caption, true);

                await Misc.selectContextMenuItem(dbTreeSection,
                    globalConn.caption, "Configure Instance for MySQL REST Service Support");

                await Misc.verifyNotification("MySQL REST Service configured successfully.");

                await driver.wait(async () => {
                    return Misc.existsTreeElement(dbTreeSection, "MySQL REST Service");
                }, explicitWait, "'MySQL REST Service' does not exist on the DB tree section");

                await Misc.selectContextMenuItem(
                    dbTreeSection, globalConn.caption, "Show MySQL System Schemas");

                expect(await Misc.existsTreeElement(dbTreeSection, "mysql_rest_service_metadata")).to.be.true;

                await Misc.selectContextMenuItem(dbTreeSection,
                    "MySQL REST Service", "Add REST Service...");

                randomService = `Service${randomCaption}`;
                await Misc.switchToWebView();
                await Database.setRestService(`/${randomService}`, "", "localhost", ["HTTP"], true, true);

                await Misc.verifyNotification("The MRS service has been created.");

                await driver?.switchTo().defaultContent();

                await Misc.reloadSection(dbTreeSection);

                await Misc.toggleTreeElement(dbTreeSection, "MySQL REST Service", true);

                expect(await Misc.existsTreeElement(dbTreeSection, `/${randomService}`)).to.be.true;

                await driver?.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await driver.switchTo().defaultContent();
            if (this.currentTest?.state === "failed") {
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await Misc.processFailure(this);

                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].dismiss();
                }
            }

            await new EditorView().closeAllEditors();
        });

        after(async function () {
            try {
                await Misc.selectContextMenuItem(dbTreeSection,
                    "mysql_rest_service_metadata", "Drop Schema...");

                const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
                if (ntf.length > 0) {
                    await ntf[0].findElement(By.xpath(
                        `//a[contains(@title, 'Drop mysql_rest_service_metadata')]`)).click();
                } else {
                    const dialog = new ModalDialog();
                    await dialog.pushButton(`Drop mysql_rest_service_metadata`);
                }

                await Misc
                    .verifyNotification("The object mysql_rest_service_metadata has been dropped successfully.");

            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Set as new DEFAULT REST Service", async () => {

            await Misc.selectContextMenuItem(dbTreeSection,
                `/${randomService}`, "Set as New Default REST Service");

            await Misc.verifyNotification("The MRS service has been set as the new default service.");

            expect(await Misc.isDefaultItem(dbTreeSection, "rest", `/${randomService}`)).to.equal(true);
        });

        it("Edit REST Service", async () => {

            await Misc.selectContextMenuItem(dbTreeSection,
                `/${randomService}`, "Edit REST Service...");

            await Misc.switchToWebView();

            await Database.setRestService(`/edited${randomService}`, "edited",
                "localhost", [], false, false);

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS service has been successfully updated.");

            await driver.wait(async () => {
                await Misc.reloadSection(dbTreeSection);

                return (await Misc.existsTreeElement(dbTreeSection, `/edited${randomService}`)) === true;

            }, 3000, `/edited${randomService} was not displayed on the tree`);

            await Misc.selectContextMenuItem(dbTreeSection,
                `/edited${randomService}`, "Edit REST Service...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                explicitWait, "MRS Service dialog was not displayed");
            const inputServPath = await dialog.findElement(By.id("servicePath"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputHost = await dialog.findElement(By.id("hostName"));

            const protocols = await dialog.findElements(By.css("#protocols label.tag"));
            const inputMrsEnabled = await dialog.findElement(By.id("enabled"));

            const mrsEnabledClasses = (await inputMrsEnabled.getAttribute("class")).split(" ");

            expect(protocols.length).to.equals(0);
            expect(await inputServPath.getAttribute("value")).equals(`/edited${randomService}`);
            expect(await inputComments.getAttribute("value")).equals("edited");
            expect(await inputHost.getAttribute("value")).equals("localhost");
            expect(mrsEnabledClasses).to.include("unchecked");

        });

        it("Add a REST Service Schema", async () => {

            const service = await Misc.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await Misc.selectContextMenuItem(dbTreeSection,
                "sakila", "Add Schema to REST Service");

            await Misc.switchToWebView();

            await Database.setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been added successfully.");

            await Misc.reloadSection(dbTreeSection);

            await Misc.toggleTreeElement(dbTreeSection, `${service}`, true);

            expect(await Misc.existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;

        });

        it("Edit REST Schema", async () => {

            const service = await Misc.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await Misc.toggleTreeElement(dbTreeSection, service, true);

            let schema = "";
            try {
                schema = await Misc.getFirstTreeChild(dbTreeSection, service);
            } catch (e) {
                await Misc.selectContextMenuItem(dbTreeSection,
                    "sakila", "Add Schema to REST Service");

                await Misc.switchToWebView();
                const service = await Misc.getFirstTreeChild(dbTreeSection, "MySQL REST Service");
                await Database.setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");
                await driver.switchTo().defaultContent();
                await Misc.reloadSection(dbTreeSection);
                await Misc.toggleTreeElement(dbTreeSection, `${service}`, true);
                expect(await Misc.existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;
                schema = "sakila (/sakila)";
            }

            await Misc.selectContextMenuItem(dbTreeSection,
                schema, "Edit REST Schema...");

            await Misc.switchToWebView();

            await Database.setRestSchema("sakila", `localhost${service}`, "/edited", 5, false, false, "edited");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been updated successfully.");

            await Misc.reloadSection(dbTreeSection);

            await Misc.selectContextMenuItem(dbTreeSection,
                "sakila (/edited)", "Edit REST Schema...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

            const inputSchemaName = await dialog.findElement(By.id("name"));
            const inputRequestPath = await dialog.findElement(By.id("requestPath"));
            const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
            const inputEnabled = await dialog.findElement(By.id("enabled"));
            const inputItemsPerPage = await dialog.findElement(By.css("#itemsPerPage"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputRequiresAuthClasses = (await inputRequiresAuth.getAttribute("class")).split(" ");
            const inputEnabledClasses = (await inputEnabled.getAttribute("class")).split(" ");

            expect(await inputSchemaName.getAttribute("value")).equals("sakila");
            expect(await inputRequestPath.getAttribute("value")).equals("/edited");
            expect(inputRequiresAuthClasses).to.include("unchecked");
            expect(inputEnabledClasses).to.include("unchecked");
            expect(await inputItemsPerPage.getAttribute("value")).equals("5");
            expect(await inputComments.getAttribute("value")).equals("edited");

        });

        it("Add Table to REST Service", async () => {

            await Misc.toggleTreeElement(dbTreeSection, "sakila (/edited)", false);

            await Misc.toggleTreeElement(dbTreeSection, "sakila", true);

            await Misc.toggleTreeElement(dbTreeSection, "Tables", true);

            await Misc.selectContextMenuItem(dbTreeSection,
                "actor", "Add Database Object to REST Service");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

            await dialog.findElement(By.id("ok")).click();

            await Misc.verifyNotification("The MRS Database Object actor has been added successfully");

            await Misc.toggleTreeElement(dbTreeSection, "sakila (/edited)", true);

            expect(await Misc.existsTreeElement(dbTreeSection, "actor (/actor)")).to.be.true;
        });

        it("Delete REST Schema", async () => {

            const service = await Misc.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await Misc.toggleTreeElement(dbTreeSection, service, true);

            const schema = await Misc.getFirstTreeChild(dbTreeSection, service);

            await Misc.selectContextMenuItem(dbTreeSection,
                schema, "Delete REST Schema...");

            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted?", false);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS schema has been deleted successfully");

            await Misc.reloadSection(dbTreeSection);

            expect(await Misc.existsTreeElement(dbTreeSection, schema)).to.be.false;

        });

        it("Delete REST Service", async () => {

            const service = await Misc.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await Misc.selectContextMenuItem(dbTreeSection,
                service, "Delete REST Service...");

            await Misc.verifyNotification(`Are you sure the MRS service ${service} should be deleted?`);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS service has been deleted successfully");

            await driver.wait(async () => {
                await Misc.reloadSection(dbTreeSection);

                return (await Misc.existsTreeElement(dbTreeSection, service)) === false;

            }, 3000, `${service} is still displayed on the tree`);

        });
    });

});