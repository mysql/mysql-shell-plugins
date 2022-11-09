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
    OutputView,
    until,
    BottomBarPanel,
    InputBox,
    Key as seleniumKey,
    TextEditor,
    ModalDialog,
    WebElement,
    Key,
    ActivityBar,
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
    ociExplicitWait,
    ociTasksExplicitWait,
    Common,
} from "../lib/common";

import { IDBConnection, Database } from "../lib/db";
import { Shell } from "../lib/shell";

import { ChildProcess } from "child_process";
import { homedir, platform } from "os";
import { join } from "path";

describe("MySQL Shell for VS Code", () => {

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

    before(async function () {

        await Common.loadDriver();

        try {
            let activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            const openEditors = new EditorView();

            await driver.wait(async () => {
                return (await openEditors.getOpenEditorTitles()).includes("Welcome to MySQL Shell");
            }, explicitWait, "Welcome tab was not displayed");

            await Common.reloadVSCode();
            await new EditorView().closeAllEditors();
            activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            await Common.waitForExtensionChannel();

            if (!(await Common.isCertificateInstalled())) {
                throw new Error("Please install the certificate");
            }

            await Common.hideSection(consolesTreeSection, false);
        } catch (e) {
            await Common.processFailure(this);
            throw e;
        }

    });

    describe("DATABASE CONNECTIONS", () => {

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
                await Common.initTreeSection(dbTreeSection);
                await Common.toggleSection(ociTreeSection, false);
                await Common.toggleSection(consolesTreeSection, false);
                await Common.toggleSection(tasksTreeSection, false);
                await Common.toggleBottomBar(false);

                const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                globalConn.caption += randomCaption;
                await Database.createConnection(globalConn);
                expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("DB Connections");
                await Common.reloadSection(dbTreeSection);
                const el = await Common.getTreeElement(dbTreeSection, globalConn.caption);
                expect(el).to.exist;

            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }
        });

        after(async function () {
            try {
                await Common.toggleSection(dbTreeSection, false);
            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }
        });

        describe("Toolbar", () => {

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
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
                    await Common.reloadSection(dbTreeSection);
                    expect(await Common.getTreeElement(dbTreeSection, localConn.caption)).to.exist;
                } finally {
                    if (flag) {
                        await Database.deleteConnection(localConn.caption);
                    }
                }
            });

            it("Open the DB Connecion Browser", async () => {

                const openConnBrw = await Common.getSectionToolbarButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();
                const editorView = new EditorView();
                const editor = await editorView.openEditor("DB Connections");
                expect(await editor.getTitle()).to.equal("DB Connections");

                await Common.switchToWebView();

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
                    prc = await Common.startServer();
                    await Common.selectMoreActionsItem(dbTreeSection, "Connect to External MySQL Shell Process");
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

                const bottomBar = new BottomBarPanel();
                const outputView = await bottomBar.openOutputView();
                await outputView.clearText();

                await Common.selectMoreActionsItem(dbTreeSection, "Restart the Internal MySQL Shell Process");

                const dialog = await driver.wait(until.elementLocated(By.css(".notification-toast-container")),
                    3000, "Restart dialog was not found");

                const restartBtn = await dialog.findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]"));
                await restartBtn.click();
                await driver.wait(until.stalenessOf(dialog), 3000, "Restart MySQL Shell dialog is still displayed");

                try {
                    await driver.wait(async () => {
                        const outputView = new OutputView();
                        try {
                            const text = await outputView.getText();
                            const lines = text.split("\n");
                            for (const line of lines) {
                                if (line.indexOf("Registering session...") !== -1) {
                                    return true;
                                }
                            }
                        } catch (e) { return false; }
                    }, 20000, "Extension was not ready");
                } catch (e) {
                    throw new Error(String(e));
                } finally {
                    await Common.toggleBottomBar(false);
                }
            });

            it("Relaunch Welcome Wizard", async () => {

                await Common.selectMoreActionsItem(dbTreeSection, "Relaunch Welcome Wizard");

                const editor = new EditorView();
                const titles = await editor.getOpenEditorTitles();

                expect(titles).to.include.members(["Welcome to MySQL Shell"]);
                const active = await editor.getActiveTab();
                expect(await active?.getTitle()).equals("Welcome to MySQL Shell");

                await driver.switchTo().frame(0);
                await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));

                const text = await driver.findElement(By.css("#page1 h3")).getText();
                expect(text).equals("Welcome to MySQL Shell for VS Code.");
                expect(await driver.findElement(By.id("nextBtn"))).to.exist;

            });

        });

        describe("Context menu items", () => {

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                await new EditorView().closeAllEditors();

            });

            after(async function () {
                try {
                    await Database.collapseAllConnections();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            it("Connect to Database", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption, "Connect to Database");

                await new EditorView().openEditor(globalConn.caption);

                await Common.switchToWebView();

                const item = await driver.wait(until.elementLocated(By.css(".zoneHost")),
                    explicitWait, "zoneHost not found");

                expect(item).to.exist;

            });

            it("Connect to Database in New Tab", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Connect to Database");

                await Common.switchToWebView();

                await driver.wait(until.elementLocated(By.css("textarea")), explicitWait);

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Connect to Database on New Tab");

                await Common.switchToWebView();

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

            });

            it("Open MySQL Shell Console for this connection", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                const item = await driver.wait(until
                    .elementLocated(By.css("code > span")), 10000, "MySQL Shell Console was not loaded");
                expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");
                await driver.switchTo().defaultContent();

                try {
                    await Common.toggleSection(consolesTreeSection, true);
                    expect(await Common.getTreeElement(
                        ociTreeSection, `Session to ${globalConn.caption}`)).to.exist;
                } finally {
                    await Common.toggleSection(consolesTreeSection, false);
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
                expect(await Database.getWebViewConnection(localConn.caption)).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("DB Connections");
                await Common.reloadSection(dbTreeSection);

                await Common.selectContextMenuItem(dbTreeSection, localConn.caption, "Edit DB Connection");

                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                expect(editors.includes("DB Connections")).to.be.true;

                await Common.switchToWebView();

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
                    await Common.reloadSection(dbTreeSection);
                    try {
                        await Common.getTreeElement(dbTreeSection, edited);

                        return true;
                    } catch (e) { return false; }
                }, explicitWait, "Database was not updated");

            });

            it("Duplicate this MySQL connection", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Duplicate this DB Connection");

                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                expect(editors.includes("DB Connections")).to.be.true;

                await Common.switchToWebView();

                const dialog = await driver.wait(until.elementLocated(
                    By.css(".valueEditDialog")), explicitWait, "Connection dialog was not found");

                const dup = `Dup${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;

                await dialog.findElement(By.id("caption")).sendKeys(dup);
                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();
                await driver.switchTo().defaultContent();

                await driver.wait(async () => {
                    await Common.reloadSection(dbTreeSection);
                    const db = await Common.getSection(dbTreeSection);

                    return (await db?.findElements(By.xpath(`//div[contains(@aria-label, '${dup}')]`)))!.length === 1;
                }, 10000, "Duplicated database was not found");
            });

            it("Schema - Copy name and create statement to clipboard", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Tables", true);

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                let editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, globalConn.schema,
                    "Copy To Clipboard -> Name");

                await Common.switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                editor = await driver.findElement(By.id("shellEditorHost"));
                let textArea = await editor.findElement(By.css("textarea"));

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include(globalConn.schema);

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, globalConn.schema,
                    "Copy To Clipboard -> Create Statement");

                await Common.switchToWebView();

                editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                textArea = await editor.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("CREATE DATABASE");

            });

            it("Drop Schema", async () => {

                const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                const testSchema = `testschema${random}`;

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                const editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                const textArea = await editor.findElement(By.css("textArea"));

                await Common.execCmd(textArea, "call clearSchemas();", 10000);
                let result = await Database.getResultStatus();
                expect(result).to.include("OK");

                await Common.execCmd(textArea, `create schema ${testSchema};`);

                result = await Database.getResultStatus();
                expect(result).to.include("OK");

                await driver.switchTo().defaultContent();

                await driver?.wait(async () => {
                    await Database.reloadConnection(globalConn.caption);

                    return Common.existsTreeElement(dbTreeSection, testSchema);
                }, explicitWait, `${testSchema} was not found`);

                await Common.selectContextMenuItem(dbTreeSection, testSchema, "Drop Schema...");

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

                const sec = await Common.getSection(dbTreeSection);
                await Common.reloadSection(dbTreeSection);
                await driver.wait(async () => {
                    return (await sec?.findElements(By.xpath(
                        `//div[contains(@aria-label, '${testSchema}') and contains(@role, 'treeitem')]`)))!
                        .length === 0;
                }, explicitWait, `${testSchema} is still on the list`);

            });

            it("Table - Show Data", async () => {

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Tables", true);

                await Common.selectContextMenuItem(dbTreeSection, "actor", "Show Data...");

                const ed = new EditorView();
                const activeTab = await ed.getActiveTab();
                expect(await activeTab!.getTitle()).equals(globalConn.caption);

                await Common.switchToWebView();

                const resultHost = await driver.wait(until.elementLocated(
                    By.css(".resultHost")), 20000, "query results were not found");

                const resultStatus = await driver.wait(async () => {
                    return (await resultHost.findElements(By.css(".resultStatus label")))[0];
                }, explicitWait, "'.resultStatus label' did not find any element");

                expect(await resultStatus.getText()).to.match(/OK, (\d+) records/);

            });

            it("Table - Copy name and create statement to clipboard", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Tables", true);

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                let editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, "actor",
                    "Copy To Clipboard -> Name");

                await Common.switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                editor = await driver.findElement(By.id("shellEditorHost"));
                let textArea = await editor.findElement(By.css("textarea"));

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("actor");

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, "actor",
                    "Copy To Clipboard -> Create Statement");

                await Common.switchToWebView();

                editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                textArea = await editor.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("idx_actor_last_name");

            });

            it("Drop Table", async () => {

                const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                const testTable = `testtable${random}`;

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Tables", true);

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                const editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                const textArea = await editor.findElement(By.css("textArea"));

                await Common.execCmd(textArea, "call clearTables();", 10000);
                let result = await Database.getResultStatus();
                expect(result).to.include("OK");

                const prevZoneHosts = await driver.findElements(By.css(".zoneHost"));

                await Common.execCmd(textArea, `create table ${testTable} (id int, name VARCHAR(50));`, explicitWait);

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
                }, 7000, "New results block was not found");

                result = await Database.getResultStatus();
                expect(result).to.include("OK");

                await driver.switchTo().defaultContent();

                await driver?.wait(async () => {
                    await Database.reloadConnection(globalConn.caption);

                    return Common.existsTreeElement(dbTreeSection, testTable);
                }, explicitWait, `${testTable} was not found`);

                await Common.selectContextMenuItem(dbTreeSection, testTable, "Drop Table...");

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

                const sec = await Common.getSection(dbTreeSection);
                await Common.reloadSection(dbTreeSection);

                await driver.wait(async () => {
                    return (await sec?.findElements(By.xpath(
                        "//div[contains(@aria-label, 'testTable') and contains(@role, 'treeitem')]")))!.length === 0;
                }, explicitWait, `${testTable} is still on the list`);

            });

            it("View - Show Data", async () => {

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Views", true);

                await Common.selectContextMenuItem(dbTreeSection, "test_view", "Show Data...");

                const ed = new EditorView();
                const activeTab = await ed.getActiveTab();
                expect(await activeTab!.getTitle()).equals(globalConn.caption);

                await Common.switchToWebView();

                const resultHost = await driver.wait(until.elementLocated(
                    By.css(".resultHost")), 20000, "query results were not found");

                const resultStatus = await driver.wait(async () => {
                    return (await resultHost.findElements(By.css(".resultStatus label")))[0];
                }, explicitWait, "'.resultStatus label' did not find any element");

                expect(await resultStatus.getText()).to.match(/OK, (\d+) records/);
            });

            it("View - Copy name and create statement to clipboard", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Views", true);

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                let editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, "test_view",
                    "Copy To Clipboard -> Name");

                await Common.switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                editor = await driver.findElement(By.id("shellEditorHost"));
                let textArea = await editor.findElement(By.css("textarea"));

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                let textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("test_view");

                await driver.switchTo().defaultContent();

                await Common.selectContextMenuItem(dbTreeSection, "test_view",
                    "Copy To Clipboard -> Create Statement");

                await Common.switchToWebView();

                editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                if (platform() === "darwin") {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
                } else {
                    await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
                }

                textArea = await editor.findElement(By.css("textarea"));
                textAreaValue = await textArea.getAttribute("value");
                expect(textAreaValue).to.include("DEFINER VIEW");

            });

            it("Drop View", async () => {

                await Common.selectContextMenuItem(dbTreeSection, globalConn.caption,
                    "Open MySQL Shell Console for this Connection");

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Views", true);

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await Database.setEditorLanguage("sql");
                const editor = await driver.findElement(By.id("shellEditorHost"));

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                const textArea = await editor.findElement(By.css("textArea"));

                const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                const testView = `testview${random}`;

                await Common.execCmd(textArea, "call clearViews();", 10000);
                let result = await Database.getResultStatus();
                expect(result).to.include("OK");

                const prevZoneHosts = await driver.findElements(By.css(".zoneHost"));

                await Common.execCmd(textArea, `CREATE VIEW ${testView} as select * from sakila.actor;`);

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
                }, 7000, "New results block was not found");

                result = await Database.getResultStatus();
                expect(result).to.include("OK");

                await driver.switchTo().defaultContent();

                await driver?.wait(async () => {
                    await Database.reloadConnection(globalConn.caption);

                    return Common.existsTreeElement(dbTreeSection, testView);
                }, explicitWait, `${testView} was not found`);

                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, globalConn.schema, true);
                await Common.toggleTreeElement(dbTreeSection, "Views", true);

                await Common.selectContextMenuItem(dbTreeSection, testView, "Drop View...");

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

                const sec = await Common.getSection(dbTreeSection);
                await Common.reloadSection(dbTreeSection);

                await driver.wait(async () => {
                    return (await sec?.findElements(By.xpath(
                        `//div[contains(@aria-label, '${testView}') and contains(@role, 'treeitem')]`)))!.length === 0;
                }, explicitWait, `${testView} is still on the list`);

            });

        });

        describe("Database connections", () => {

            beforeEach(async function () {
                try {
                    const openConnBrw = await Common.getSectionToolbarButton(dbTreeSection,
                        "Open the DB Connection Browser");
                    await openConnBrw?.click();
                    await Common.switchToWebView();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                await new EditorView().closeAllEditors();
            });

            after(async function () {
                try {
                    await Database.collapseAllConnections();
                } catch (e) {
                    await Common.processFailure(this);
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

                await driver.executeScript(
                    "arguments[0].click();",
                    await Database.getWebViewConnection(globalConn.caption, false),
                );

                expect(await Database.isConnectionSuccessful(globalConn.caption)).to.be.true;

                await Database.closeConnection(globalConn.caption);

                const openConnBrw = await Common.getSectionToolbarButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();

                await Common.switchToWebView();

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

                await driver.executeScript(
                    "arguments[0].click();",
                    await Database.getWebViewConnection(globalConn.caption, false),
                );

                const passwordDialog = await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                    explicitWait, "Password dialog was not displayed");

                expect(passwordDialog).to.exist;

            });

            it("Confirm dialog - Save password", async () => {

                await driver.executeScript(
                    "arguments[0].click();",
                    await Database.getWebViewConnection(globalConn.caption, false),
                );

                await Database.setPassword(globalConn);

                await Common.setConfirmDialog(globalConn, "yes");

                expect(await Database.isConnectionSuccessful(globalConn.caption))
                    .to.be.true;

                await Database.closeConnection(globalConn.caption);

                const openConnBrw = await Common.getSectionToolbarButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();

                await Common.switchToWebView();

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
                await Common.reloadSection(dbTreeSection);
                await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                await Common.toggleTreeElement(dbTreeSection, sqliteConName, true);
                await Common.toggleTreeElement(dbTreeSection, "main", true);
                await Common.toggleTreeElement(dbTreeSection, "Tables", true);
                await Common.hasTreeChildren(dbTreeSection, "Tables", "db_connection");

                await Common.selectContextMenuItem(dbTreeSection, "db_connection", "Show Data...");

                await Common.switchToWebView();

                const result = await driver.wait(async () => {
                    const res = await Database.getResultStatus(true);
                    if (res.length > 0) {
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

                const contentHost = await driver.findElement(By.id("contentHost"));
                await contentHost
                    .findElement(By.css("textarea"))
                    .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

                const execSel = await Database
                    .getToolbarButton("Execute selection or full block and create a new block");
                await execSel?.click();

                const resultHost = await driver.wait(until.elementLocated(By.css(".resultHost")),
                    explicitWait, "Result host not found");

                const result = await driver.wait(async () => {
                    return (await resultHost.findElements(By.css(".resultStatus label")))[0];
                }, explicitWait, "Result was not found");

                expect(await result.getText()).to.include("1 record retrieved");

                expect(await resultHost.findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]"))).to.exist;
            });

        });

        describe("DB Editor", () => {

            let textArea: WebElement;

            before(async function () {
                try {
                    await Common.selectContextMenuItem(dbTreeSection, globalConn.caption, "Connect to Database");
                    await Common.switchToWebView();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            beforeEach(async function () {
                try {

                    textArea = await driver.wait(until.elementLocated(By.css("textarea")), explicitWait,
                        "Cound not find textarea");

                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await Database.openNewNotebook();
            });

            after(async function () {
                try {
                    await driver.switchTo().defaultContent();
                    await Common.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                    await new EditorView().closeAllEditors();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            it("Multi-cursor", async () => {

                await Database.writeSQL("select * from sakila.actor;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await Database.writeSQL("select * from sakila.address;");
                await driver.actions().sendKeys(Key.ENTER).perform();
                await Database.writeSQL("select * from sakila.city;");

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

            });

            it("Using a DELIMITER", async function () {

                this.retries(1);

                await Database.setDBEditorLanguage("sql");

                textArea = await driver.findElement(By.css("textarea"));

                await Database.writeSQL("DELIMITER $$");
                const dbEditorLines = await driver.findElements(By.css(".view-line"));
                await driver.wait(async () => {
                    if (dbEditorLines.length === (await driver.findElements(By.css(".view-line"))).length) {
                        await textArea.sendKeys(Key.RETURN);

                        return false;
                    } else {
                        return true;
                    }
                }, 3000, "New line was not found");
                await textArea.sendKeys(Key.TAB);
                await Database.writeSQL("select 2 $$", true);
                const suggestionBox = await driver.findElements(By.css("div.contents"));
                if (suggestionBox.length > 0) {
                    await textArea.sendKeys(Key.ESCAPE);
                }
                await textArea.sendKeys(Key.RETURN);
                await textArea.sendKeys(Key.TAB);
                await Database.writeSQL("select 1");

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length >= 2;
                }, 10000, "No blue dots were found");

                let lines = await driver.findElements(By
                    .css("#contentHost .editorHost div.margin-view-overlays > div"));

                try {
                    await lines[lines.length - 1].findElement(By.css(".statementStart"));
                } catch (e) {
                    //continue, may be stale
                    lines = await driver.findElements(By
                        .css("#contentHost .editorHost div.margin-view-overlays > div"));
                }

                expect((await lines[lines.length - 1].findElements(By.css(".statementStart"))).length).to.equals(0);
                expect((await lines[lines.length - 2].findElements(By.css(".statementStart"))).length).to.equals(1);
                expect((await lines[lines.length - 3].findElements(By.css(".statementStart"))).length).to.equals(1);

                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ARROW_UP);
                await textArea.sendKeys(Key.ENTER);

                await driver.wait(async () => {
                    return (await driver.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
                }, 10000, "A new line was not found");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[lines.length - 2].findElements(By.css(".statementStart"))).length === 0;
                    } catch (e) {
                        return false;
                    }
                }, explicitWait, "Line 2 has the statement start");

                await textArea.sendKeys("select 1");

                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(
                            By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                        return (await lines[lines.length - 2].findElements(By.css(".statementStart"))).length > 0;
                    } catch (e) {
                        return false;
                    }
                }, explicitWait, "Line 2 does not have the statement start");

            });

            it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

                await Database.writeSQL("SELECT * FROM ACTOR;");
                const execSel = await Database
                    .getToolbarButton("Execute selection or full block and create a new block");
                await execSel?.click();

                expect(await Database.getResultStatus(true)).to.match(/(\d+) record/);
                expect(await Database.hasNewPrompt()).to.be.true;
            });

            it("Connection toolbar buttons - Execute statement at the caret position", async () => {

                await Database.writeSQL("select * from sakila.actor;");
                await textArea.sendKeys(Key.RETURN);

                await Database.writeSQL("select * from sakila.address;");
                await textArea.sendKeys(Key.RETURN);

                await Database.writeSQL("select * from sakila.category;");

                await driver.wait(async () => {
                    return (await driver.findElements(By.css(".statementStart"))).length >= 3;
                }, explicitWait, "Statement start (blue dot) was not found on all lines");

                const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
                await lines[lines.length - 2].findElement(By.css("span > span")).click();

                let execCaret = await Database.getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                let resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

                expect(await driver.wait(async () => {
                    return Database.getResultColumnName("address_id");
                }, 3000, "address_id column does not exist")).to.exist;

                await lines[lines.length - 3].findElement(By.css("span > span")).click();

                execCaret = await Database.getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(until.stalenessOf(resultView), 3000, "Result View did not become stale");
                resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

                expect(await driver.wait(async () => {
                    return Database.getResultColumnName("actor_id");
                }, 3000, "actor_id column does not exist")).to.exist;

                await lines[lines.length - 1].findElement(By.css("span > span")).click();

                execCaret = await Database.getToolbarButton("Execute the statement at the caret position");
                await execCaret?.click();

                await driver.wait(until.stalenessOf(resultView), 3000, "Result View did not become stale");
                resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

                expect(await driver.wait(async () => {
                    return Database.getResultColumnName("category_id");
                }, 3000, "category_id column does not exist")).to.exist;

            });

            it("Switch between search tabs", async () => {

                await Database.writeSQL("select * from sakila.actor;select * from sakila.address;");
                const execCaret = await Database
                    .getToolbarButton("Execute selection or full block and create a new block");
                await execCaret?.click();

                await driver.wait(until.elementLocated(By.css(".tabArea")), explicitWait, "Tabs were not found");

                const result1 = await Database.getResultTab("Result #1");

                const result2 = await Database.getResultTab("Result #2");

                expect(result1).to.exist;

                expect(result2).to.exist;

                expect(await Database.getResultColumnName("actor_id")).to.exist;

                expect(await Database.getResultColumnName("first_name")).to.exist;

                expect(await Database.getResultColumnName("last_name")).to.exist;

                expect(await Database.getResultColumnName("last_update")).to.exist;

                await result2.click();

                expect(await Database.getResultColumnName("address_id")).to.exist;

                expect(await Database.getResultColumnName("address")).to.exist;

                expect(await Database.getResultColumnName("address2")).to.exist;

                expect(await Database.getResultColumnName("district")).to.exist;

                expect(await Database.getResultColumnName("city_id")).to.exist;

                expect(await Database.getResultColumnName("postal_code")).to.exist;

                await result1.click();

                expect(await Database.getResultColumnName("actor_id")).to.exist;

            });

            it("Connect to database and verify default schema", async () => {

                await Common.execCmd(textArea, "SELECT SCHEMA();");
                const result = await Database.getResultStatus(true);
                expect(result).to.include("1 record retrieved");

                const zoneHosts = await driver.findElements(By.css(".zoneHost"));
                expect(await (await zoneHosts[zoneHosts.length - 1].findElement(By.css(".tabulator-cell"))).getText())
                    .to.equals(globalConn.schema);
            });

            it("Connection toolbar buttons - Autocommit DB Changes", async () => {

                const autoCommit = await Database.getToolbarButton("Auto commit DB changes");
                await autoCommit?.click();

                const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

                await Common.execCmd(textArea,
                    `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

                const commitBtn = await Database.getToolbarButton("Commit DB changes");
                const rollBackBtn = await Database.getToolbarButton("Rollback DB changes");

                await driver.wait(until.elementIsEnabled(commitBtn as WebElement),
                    3000, "Commit button should be enabled");

                await driver.wait(until.elementIsEnabled(rollBackBtn as WebElement),
                    3000, "Commit button should be enabled");

                const execSelNew = await Database.getToolbarButton(
                    "Execute selection or full block and create a new block");
                await execSelNew?.click();

                expect(await Database.getResultStatus()).to.include("OK");

                await rollBackBtn!.click();

                await Common.execCmd(textArea, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

                expect(await Database.getResultStatus()).to.include("OK, 0 records retrieved");

                await Common.execCmd(textArea,
                    `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

                expect(await Database.getResultStatus()).to.include("OK");

                await commitBtn!.click();

                await Common.execCmd(textArea, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

                expect(await Database.getResultStatus(true)).to.include("OK, 1 record retrieved");

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

                const contentHost = await driver.findElement(By.id("contentHost"));

                await Database.writeSQL(`import from xpto xpto xpto`);

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

                //REPLACE

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

            });

            it("Using Math_random on js_py blocks", async () => {

                await Database.setDBEditorLanguage("javascript");

                await Common.execCmd(textArea, "Math.random();");

                const result2 = await Database.getOutput();

                expect(result2).to.match(/(\d+).(\d+)/);

                await Common.execCmd(textArea, "\\typescript");

                expect(await Database.getOutput()).equals("Switched to TypeScript mode");

                await Common.execCmd(textArea, "Math.random();");

                const result4 = await Database.getOutput();

                expect(result4).to.match(/(\d+).(\d+)/);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await textArea.sendKeys(Key.ARROW_UP);

                await driver.sleep(500);

                await Common.execOnEditor();

                const otherResult = await Database.getOutput(true);

                expect(otherResult).to.match(/(\d+).(\d+)/);

                expect(otherResult !== result2).equals(true);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await textArea.sendKeys(Key.ARROW_DOWN);

                await Common.execOnEditor();

                const otherResult1 = await Database.getOutput();

                expect(otherResult1).to.match(/(\d+).(\d+)/);

                expect(otherResult1 !== result4).equals(true);

            });

            it("Multi-line comments", async () => {

                await Database.setDBEditorLanguage("sql");

                await Common.execCmd(textArea, "SELECT VERSION();");
                const result = await Database.getResultStatus(true);
                expect(result).to.include("1 record retrieved");

                const resultHosts = await driver?.findElements(By.css(".resultHost"));

                const txt = await (await resultHosts[resultHosts.length - 1]
                    .findElement(By.css(".tabulator-cell"))).getText();

                const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

                const digits = server.split(".");

                let serverVer = digits[0];

                digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

                digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

                await Common.execCmd(textArea, `/*!${serverVer} select * from actor;*/`);

                expect(await Database.getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

                const higherServer = parseInt(serverVer, 10) + 1;

                await Common.execCmd(textArea, `/*!${higherServer} select * from actor;*/`);

                expect(await Database.getResultStatus()).to.include(
                    "OK, 0 records retrieved",
                );

            });

            it("Context Menu - Execute", async () => {

                await Database.writeSQL("select * from sakila.actor;");

                let lastId = await Database.getLastQueryResultId();
                await Database.clickContextMenuItem(textArea, "Execute Block");

                await driver.wait(async () => {
                    return (await Database.getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await Database.getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

                expect(await Database.hasNewPrompt()).to.be.false;

                lastId = await Database.getLastQueryResultId();

                await Database.clickContextMenuItem(textArea, "Execute Block and Advance");

                await driver.wait(async () => {
                    return (await Database.getLastQueryResultId()) > lastId;
                }, 3000, "No new results block was displayed");

                expect(await Database.getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

                expect(await Database.hasNewPrompt()).to.be.true;

            });

            it("Pie Graph based on DB table", async () => {

                await Database.setDBEditorLanguage("ts");

                await Common.execCmd(textArea, `
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

                const pieChart = await Database.getGraphHost();

                const chartColumns = await pieChart.findElements(By.css("rect"));
                for (const col of chartColumns) {
                    expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
                }

            });

        });

        describe("Scripts", () => {

            before(async function () {
                try {
                    await Common.selectContextMenuItem(dbTreeSection, globalConn.caption, "Connect to Database");
                    await Common.switchToWebView();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }


                await driver.findElement(By.id("itemCloseButton")).click();
                await driver.switchTo().defaultContent();
                const inputBox = new InputBox();
                await inputBox.cancel();
                await Common.switchToWebView();
            });

            after(async function () {
                try {
                    await driver.switchTo().defaultContent();
                    await Common.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                    await new EditorView().closeAllEditors();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }

            });

            it("Add SQL Script", async () => {

                await Database.addScript("sql");
                expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
                expect(await Database.getCurrentEditorType()).to.equals("mysql");

                const textArea = await driver?.findElement(By.css("textarea"));
                await textArea?.sendKeys("select * from sakila.actor");
                const exec = await Database.getToolbarButton("Execute the statement at the caret position");
                await exec?.click();
                expect(await Database.getScriptResult()).to.match(/OK, (\d+) records/);

            });

            it("Add Typescript", async () => {

                await Database.addScript("ts");
                expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
                expect(await Database.getCurrentEditorType()).to.equals("typescript");
                const textArea = await driver?.findElement(By.css("textarea"));
                await textArea?.sendKeys("Math.random()");
                const exec = await Database.getToolbarButton("Execute full script");
                await exec?.click();
                expect(await Database.getScriptResult()).to.match(/(\d+).(\d+)/);

            });

            it("Add Javascript", async () => {

                await Database.addScript("js");
                expect(await Database.getCurrentEditor()).to.match(/Untitled-(\d+)/);
                expect(await Database.getCurrentEditorType()).to.equals("javascript");
                const textArea = await driver?.findElement(By.css("textarea"));
                await textArea?.sendKeys("Math.random()");
                const exec = await Database.getToolbarButton("Execute full script");
                await exec?.click();
                expect(await Database.getScriptResult()).to.match(/(\d+).(\d+)/);

            });

        });

        describe("MySQL Administration", () => {

            before(async function () {
                try {
                    await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);
                    await Common.toggleTreeElement(dbTreeSection, "MySQL Administration", true);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver?.switchTo().defaultContent();
            });

            after(async function () {
                try {
                    await Common.toggleTreeElement(dbTreeSection, globalConn.caption, false);
                    await new EditorView().closeAllEditors();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }

            });

            it("Server Status", async () => {

                const serverSt = await Common.getTreeElement(dbTreeSection, "Server Status");
                await serverSt.click();
                await Common.switchToWebView();
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

                const clientConn = await Common.getTreeElement(dbTreeSection, "Client Connections");
                await clientConn.click();
                await Common.switchToWebView();
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

                const perfDash = await Common.getTreeElement(dbTreeSection, "Performance Dashboard");
                await perfDash.click();
                await Common.switchToWebView();
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
                    await Common.toggleTreeElement(dbTreeSection, globalConn.caption, true);

                    await Common.selectContextMenuItem(dbTreeSection,
                        globalConn.caption, "Configure MySQL REST Service");

                    await Common.verifyNotification("MySQL REST Service configured successfully.");

                    await driver.wait(async () => {
                        return Common.existsTreeElement(dbTreeSection, "MySQL REST Service");
                    }, explicitWait, "'MySQL REST Service' does not exist on the DB tree section");

                    await Common.selectContextMenuItem(
                        dbTreeSection, globalConn.caption, "Show MySQL System Schemas");

                    expect(await Common.existsTreeElement(dbTreeSection, "mysql_rest_service_metadata")).to.be.true;

                    await Common.selectContextMenuItem(dbTreeSection,
                        "MySQL REST Service", "Add REST Service...");

                    randomService = `Service${randomCaption}`;
                    await Common.switchToWebView();
                    await Database.setRestService(`/${randomService}`, "", "localhost", ["HTTP"], true, true);

                    await Common.verifyNotification("The MRS service has been created.");

                    await driver?.switchTo().defaultContent();

                    await Common.reloadSection(dbTreeSection);

                    await Common.toggleTreeElement(dbTreeSection, "MySQL REST Service", true);

                    expect(await Common.existsTreeElement(dbTreeSection, `/${randomService}`)).to.be.true;

                    await driver?.switchTo().defaultContent();
                } catch (e) {
                    await Common.processFailure(this);
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

                    await Common.processFailure(this);

                    if (notifications.length > 0) {
                        await notifications[notifications.length - 1].dismiss();
                    }
                }

                await new EditorView().closeAllEditors();
            });

            after(async function () {
                try {
                    await Common.selectContextMenuItem(dbTreeSection,
                        "mysql_rest_service_metadata", "Drop Schema...");

                    const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
                    if (ntf.length > 0) {
                        await ntf[0].findElement(By.xpath(
                            `//a[contains(@title, 'Drop mysql_rest_service_metadata')]`)).click();
                    } else {
                        const dialog = new ModalDialog();
                        await dialog.pushButton(`Drop mysql_rest_service_metadata`);
                    }

                    await Common
                        .verifyNotification("The object mysql_rest_service_metadata has been dropped successfully.");

                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            it("Set as new DEFAULT REST Service", async () => {

                await Common.selectContextMenuItem(dbTreeSection,
                    `/${randomService}`, "Set as New Default REST Service");

                await Common.verifyNotification("The MRS service has been set as the new default service.");

                expect(await Common.isDefaultItem(dbTreeSection, "rest", `/${randomService}`)).to.equal(true);
            });

            it("Edit REST Service", async () => {

                await Common.selectContextMenuItem(dbTreeSection,
                    `/${randomService}`, "Edit REST Service...");

                await Common.switchToWebView();

                await Database.setRestService(`/edited${randomService}`, "edited",
                    "localhost", [], false, false);

                await driver.switchTo().defaultContent();

                await Common.verifyNotification("The MRS service has been successfully updated.");

                await driver.wait(async () => {
                    await Common.reloadSection(dbTreeSection);

                    return (await Common.existsTreeElement(dbTreeSection, `/edited${randomService}`)) === true;

                }, 3000, `/edited${randomService} was not displayed on the tree`);

                await Common.selectContextMenuItem(dbTreeSection,
                    `/edited${randomService}`, "Edit REST Service...");

                await Common.switchToWebView();

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

                const service = await Common.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

                await Common.selectContextMenuItem(dbTreeSection,
                    "sakila", "Add Schema to REST Service");

                await Common.switchToWebView();

                await Database.setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");

                await driver.switchTo().defaultContent();

                await Common.verifyNotification("The MRS schema has been added successfully.");

                await Common.reloadSection(dbTreeSection);

                await Common.toggleTreeElement(dbTreeSection, `${service}`, true);

                expect(await Common.existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;

            });

            it("Edit REST Schema", async () => {

                const service = await Common.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

                await Common.toggleTreeElement(dbTreeSection, service, true);

                let schema = "";
                try {
                    schema = await Common.getFirstTreeChild(dbTreeSection, service);
                } catch (e) {
                    await Common.selectContextMenuItem(dbTreeSection,
                        "sakila", "Add Schema to REST Service");

                    await Common.switchToWebView();
                    const service = await Common.getFirstTreeChild(dbTreeSection, "MySQL REST Service");
                    await Database.setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");
                    await driver.switchTo().defaultContent();
                    await Common.reloadSection(dbTreeSection);
                    await Common.toggleTreeElement(dbTreeSection, `${service}`, true);
                    expect(await Common.existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;
                    schema = "sakila (/sakila)";
                }

                await Common.selectContextMenuItem(dbTreeSection,
                    schema, "Edit REST Schema...");

                await Common.switchToWebView();

                await Database.setRestSchema("sakila", `localhost${service}`, "/edited", 5, false, false, "edited");

                await driver.switchTo().defaultContent();

                await Common.verifyNotification("The MRS schema has been updated successfully.");

                await Common.reloadSection(dbTreeSection);

                await Common.selectContextMenuItem(dbTreeSection,
                    "sakila (/edited)", "Edit REST Schema...");

                await Common.switchToWebView();

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

                await Common.toggleTreeElement(dbTreeSection, "sakila (/edited)", false);

                await Common.toggleTreeElement(dbTreeSection, "sakila", true);

                await Common.toggleTreeElement(dbTreeSection, "Tables", true);

                await Common.selectContextMenuItem(dbTreeSection,
                    "actor", "Add Database Object to REST Service");

                await Common.switchToWebView();

                const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                    explicitWait, "MRS Schema dialog was not displayed");

                await dialog.findElement(By.id("ok")).click();

                await Common.verifyNotification("The MRS Database Object actor has been added successfully");

                await Common.toggleTreeElement(dbTreeSection, "sakila (/edited)", true);

                expect(await Common.existsTreeElement(dbTreeSection, "actor (/actor)")).to.be.true;
            });

            it("Delete REST Schema", async () => {

                const service = await Common.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

                await Common.toggleTreeElement(dbTreeSection, service, true);

                const schema = await Common.getFirstTreeChild(dbTreeSection, service);

                await Common.selectContextMenuItem(dbTreeSection,
                    schema, "Delete REST Schema...");

                await Common.verifyNotification("Are you sure the MRS schema sakila should be deleted?", false);

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("Yes");

                await Common.verifyNotification("The MRS schema has been deleted successfully");

                await Common.reloadSection(dbTreeSection);

                expect(await Common.existsTreeElement(dbTreeSection, schema)).to.be.false;

            });

            it("Delete REST Service", async () => {

                const service = await Common.getFirstTreeChild(dbTreeSection, "MySQL REST Service");

                await Common.selectContextMenuItem(dbTreeSection,
                    service, "Delete REST Service...");

                await Common.verifyNotification(`Are you sure the MRS service ${service} should be deleted?`);

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("Yes");

                await Common.verifyNotification("The MRS service has been deleted successfully");

                await driver.wait(async () => {
                    await Common.reloadSection(dbTreeSection);

                    return (await Common.existsTreeElement(dbTreeSection, service)) === false;

                }, 3000, `${service} is still displayed on the tree`);

            });
        });

    });

    describe("ORACLE CLOUD INFRASTRUCTURE", () => {

        before(async function () {

            try {
                await Common.initTreeSection(ociTreeSection);
                await Common.toggleSection(dbTreeSection, false);
                await Common.toggleSection(ociTreeSection, true);
                await Common.toggleSection(consolesTreeSection, false);
                await Common.toggleSection(tasksTreeSection, false);
                await Common.toggleBottomBar(false);

                const path = join(homedir(), ".oci", "config");
                await fs.writeFile(path, "");

                const btn = await Common.getSectionToolbarButton(ociTreeSection,
                    "Configure the OCI Profile list");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["config"]);

                const textEditor = new TextEditor();

                const editor = await driver.findElement(By.css("textarea"));

                let config = `[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmy`;
                config += `abcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\n`;
                config += `tenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo`;
                config += `5mmi2z3a\nregion=us-ashburn-1\nkey_file= ~/.oci/id_rsa_e2e.pem`;
                await editor.sendKeys(config);

                await textEditor.save();
                await Common.reloadSection(ociTreeSection);

                await driver.wait(async () => {
                    return Common.existsTreeElement(ociTreeSection, "E2ETESTS (us-ashburn-1)");
                }, explicitWait, "E2ETESTS (us-ashburn-1) tree item was not found");

                await Common.toggleTreeElement(ociTreeSection, "E2ETESTS*", true);

                await driver.wait(async () => {
                    return !(await Common.hasLoadingBar(ociTreeSection));
                }, 20000, "Loading bar is still displayed");

                await Common.hasTreeChildren(ociTreeSection, "E2ETESTS*");
                await Common.toggleTreeElement(ociTreeSection, "QA*", true);
                await driver.wait(async () => {
                    return !(await Common.hasLoadingBar(ociTreeSection));
                }, ociExplicitWait, "Loading bar is still displayed");
                await Common.toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
                await driver.wait(async () => {
                    return !(await Common.hasLoadingBar(ociTreeSection));
                }, ociExplicitWait, "Loading bar is still displayed");
                await Common.hasTreeChildren(ociTreeSection,
                    "MySQLShellTesting", "MDSforVSCodeExtension");

            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }

        });

        after(async function () {

            try {
                await Common.toggleSection(ociTreeSection, false);
                await fs.unlink(join(homedir(), ".oci", "config"));
            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }

        });

        describe("Profile", () => {

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                    try {
                        const dialog = new ModalDialog();
                        await dialog.pushButton("Don't Save");
                    } catch (e) {
                        //continue
                    }
                }
            });

            it("View Config Profile Information", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "E2ETESTS (us-ashburn-1)", "View Config Profile Information");

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["E2ETESTS Info.json"]);

                const textEditor = new TextEditor();
                await driver.wait(async () => {
                    return (await textEditor.getText()).length > 0;
                }, 3000, "No text was found on file");

                expect(Common.isJson(await textEditor.getText())).to.equal(true);

            });

            it("Set as New Default Config Profile", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "E2ETESTS (us-ashburn-1)", "Set as New Default Config Profile");

                expect(await Common.isDefaultItem(ociTreeSection,
                    "profile", "E2ETESTS (us-ashburn-1)")).to.equal(true);
            });
        });

        describe("Compartment", () => {

            let compartmentId = "";

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                    try {
                        const dialog = new ModalDialog();
                        await dialog.pushButton("Don't Save");
                    } catch (e) {
                        //continue
                    }
                }
            });

            after(async function () {

                try {
                    await Common.toggleSection(consolesTreeSection, false);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }

            });

            it("View Compartment Information", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "QA*", "View Compartment Information");

                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes("QA Info.json");
                }, explicitWait, "'QA Info.json' was not opened");

                const textEditor = new TextEditor();
                await driver.wait(async () => {
                    return (await textEditor.getText()).indexOf("{") !== -1;
                }, explicitWait, "No text was found inside QA Info.json");

                const json = await textEditor.getText();
                expect(Common.isJson(json)).to.equal(true);

                const parsed = JSON.parse(json);
                compartmentId = parsed.id;

            });

            it("Set as Current Compartment", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "QA*", "Set as Current Compartment");

                await driver.wait(async () => {
                    return !(await Common.hasLoadingBar(ociTreeSection));
                }, ociExplicitWait, "There is still a loading bar on OCI");

                expect(await Common.isDefaultItem(ociTreeSection, "compartment", "QA*")).to.be.true;

                expect(await Common.hasTreeChildren(ociTreeSection,
                    "E2ETESTS (us-ashburn-1)", "QA")).to.be.true;

                await Common.toggleSection(consolesTreeSection, true);
                const btn = await Common.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

                const textArea = await driver.findElement(By.css("textArea"));
                await Common.execCmd(textArea, "mds.get.currentCompartmentId()", 60000);

                const zoneHost = await driver.findElements(By.css(".zoneHost"));
                const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

                expect(result).to.equal(compartmentId);

            });

        });

        describe("DB System", () => {

            let outputView: OutputView;

            before(async function () {
                try {
                    const bottomBar = new BottomBarPanel();
                    outputView = await bottomBar.openOutputView();
                    await Common.toggleSection(tasksTreeSection, true);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            beforeEach(async function () {
                try {
                    await driver.wait(async () => {
                        return !(await Common.hasLoadingBar(ociTreeSection));
                    }, ociExplicitWait, "There is still a loading bar on OCI");
                    await outputView.clearText();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                    try {
                        const dialog = new ModalDialog();
                        await dialog.pushButton("Don't Save");
                    } catch (e) {
                        //continue
                    }
                }
            });

            after(async function () {
                try {
                    await Common.toggleBottomBar(false);
                    await Common.toggleSection(tasksTreeSection, false);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });


            it("View DB System Information", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "View DB System Information");

                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes("MDSforVSCodeExtension Info.json");
                }, explicitWait, "MDSforVSCodeExtension Info.json was not opened");

                const textEditor = new TextEditor();
                await driver.wait(async () => {
                    return (await textEditor.getText()).indexOf("{") !== -1;
                }, explicitWait, "No text was found inside MDSforVSCodeExtension Info.json");

                const json = await textEditor.getText();
                expect(Common.isJson(json)).to.equal(true);

            });

            it("Start a DB System (and cancel)", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "Start the DB System");


                expect(await Common.existsTreeElement(tasksTreeSection, "Start DB System (running)")).to.be.true;

                await Common.waitForOutputText(outputView, "OCI profile 'E2ETESTS' loaded.", 30000);

                await Common.verifyNotification("Are you sure you want to start the DB System");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("NO");

                await Common.waitForOutputText(outputView, "Operation cancelled", ociExplicitWait);

                await Common.waitForOutputText(outputView, "Task 'Start DB System' completed successfully.",
                    ociExplicitWait);

                expect(await Common.existsTreeElement(tasksTreeSection, "Start DB System (done)")).to.be.true;


            });

            it("Restart a DB System (and cancel)", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "Restart the DB System");

                expect(await Common.existsTreeElement(tasksTreeSection, "Restart DB System (running)")).to.be.true;

                await Common.waitForOutputText(outputView, "OCI profile 'E2ETESTS' loaded.", ociTasksExplicitWait);

                await outputView.clearText();

                await Common.verifyNotification("Are you sure you want to restart the DB System");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("NO");

                await Common.waitForOutputText(outputView, "Operation cancelled", ociExplicitWait);

                await Common.waitForOutputText(outputView, "Task 'Restart DB System' completed successfully.",
                    ociExplicitWait);

            });

            it("Stop a DB System (and cancel)", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "Stop the DB System");

                expect(await Common.existsTreeElement(tasksTreeSection, "Stop DB System (running)")).to.be.true;

                await Common.waitForOutputText(outputView, "OCI profile 'E2ETESTS' loaded.", ociTasksExplicitWait);

                await Common.verifyNotification("Are you sure you want to stop the DB System");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("NO");

                await Common.waitForOutputText(outputView, "Operation cancelled", ociExplicitWait);

                await Common.waitForOutputText(outputView, "Task 'Stop DB System' completed successfully.",
                    ociExplicitWait);

            });

            it("Delete a DB System (and cancel)", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "Delete the DB System");

                expect(await Common.existsTreeElement(tasksTreeSection, "Delete DB System (running)")).to.be.true;

                await Common.waitForOutputText(outputView, "OCI profile 'E2ETESTS' loaded.", ociTasksExplicitWait);

                await Common.verifyNotification("Are you sure you want to delete");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("NO");

                await Common.waitForOutputText(outputView, "Deletion aborted", ociTasksExplicitWait);

                await Common.waitForOutputText(outputView, "Task 'Delete DB System' completed successfully.",
                    ociExplicitWait);

            });

        });

        describe("Bastion", () => {

            beforeEach(async function () {
                try {
                    await driver.wait(async () => {
                        return !(await Common.hasLoadingBar(ociTreeSection));
                    }, ociExplicitWait, "There is still a loading bar on OCI");
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                await Common.toggleSection(tasksTreeSection, false);
                await Common.toggleSection(consolesTreeSection, false);
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                    try {
                        const dialog = new ModalDialog();
                        await dialog.pushButton("Don't Save");
                    } catch (e) {
                        //continue
                    }
                }

            });

            after(async function () {
                try {
                    await Common.toggleBottomBar(false);
                    await Common.toggleSection(tasksTreeSection, false);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            it("Create connection with Bastion Service", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "MDSforVSCodeExtension", "Create Connection with Bastion Service");

                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes("DB Connections");
                }, explicitWait, "DB Connections was not opened");

                await driver.wait(until.ableToSwitchToFrame(0), explicitWait, "not able to switch to frame 0");
                await driver.wait(until.ableToSwitchToFrame(
                    By.id("active-frame")), explicitWait, "not able to switch to frame active-frame");
                await driver.wait(until.ableToSwitchToFrame(
                    By.id("frame:DB Connections")), explicitWait, "not able to switch to frame active-frame");

                const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                    10000, "Connection dialog was not loaded");

                expect(await newConDialog.findElement(By.id("caption")).getAttribute("value"))
                    .to.equal("MDSforVSCodeExtension");

                expect(await newConDialog.findElement(By.id("description")).getAttribute("value"))
                    .to.equal("DB System used to test the MySQL Shell for VSCode Extension.");

                expect(await newConDialog.findElement(By.id("hostName")).getAttribute("value"))
                    .to.match(/(\d+).(\d+).(\d+).(\d+)/);

                await newConDialog.findElement(By.id("userName")).sendKeys("dba");

                const mdsTab = await newConDialog.findElement(By.id("page3"));

                expect(mdsTab).to.exist;

                await mdsTab.click();

                await driver.wait(async () => {
                    return await driver.findElement(By.id("mysqlDbSystemId")).getAttribute("value") !== "";
                }, 3000, "DbSystemID field was not set");

                await driver.wait(async () => {
                    return await driver.findElement(By.id("bastionId")).getAttribute("value") !== "";
                }, 3000, "BastionID field was not set");

                await newConDialog.findElement(By.id("ok")).click();

                await driver.switchTo().defaultContent();

                const mds = await Database.getWebViewConnection("MDSforVSCodeExtension");

                expect(mds).to.exist;

                try {

                    await Common.switchToWebView();

                    await mds.click();

                    await driver.wait(async () => {
                        const fingerprintDialog = await driver.findElements(By.css(".visible.confirmDialog"));
                        let passwordDialog = await driver.findElements(By.css(".visible.passwordDialog"));
                        if (fingerprintDialog.length > 0) {
                            await fingerprintDialog[0].findElement(By.id("accept")).click();
                            passwordDialog = await driver.findElements(By.css(".visible.passwordDialog"));
                        }
                        if (passwordDialog.length > 0) {
                            await passwordDialog[0].findElement(By.css("input")).sendKeys("MySQLR0cks!");
                            await passwordDialog[0].findElement(By.id("ok")).click();

                            return true;
                        }

                        return false;
                    }, 30000, "Dialogs were not displayed");

                    const confirmDialog = await driver.wait(until.elementLocated(By.css(".visible.confirmDialog")),
                        explicitWait, "Confirm dialog was not displayed");

                    await confirmDialog.findElement(By.id("refuse")).click();

                    const contentHost = await driver.wait(until.elementLocated(By.id("contentHost")),
                        20000, "Content host not visible");

                    const textArea = await contentHost.findElement(By.css("textArea"));

                    await Common.execCmd(textArea, "select version();", 10000);

                    const result = await Database.getResultStatus(true);

                    expect(result).to.include("OK");

                    await driver.switchTo().defaultContent();

                    expect(await Common.existsTreeElement(ociTreeSection,
                        "Bastion4PrivateSubnetStandardVnc"))
                        .to.be.true;

                    expect(await Common.existsTreeElement(dbTreeSection, "MDSforVSCodeExtension"))
                        .to.be.true;
                } finally {
                    await driver.switchTo().defaultContent();
                    await Common.toggleSection(dbTreeSection, true);
                    await Common.reloadSection(dbTreeSection);
                    await Common.toggleSection(dbTreeSection, false);
                }
            });

            it("Get Bastion Information and set it as current", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc", "Get Bastion Information");

                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes("Bastion4PrivateSubnetStandardVnc Info.json");
                }, explicitWait, "Bastion4PrivateSubnetStandardVnc Info.json was not opened");

                const textEditor = new TextEditor();
                await driver.wait(async () => {
                    return (await textEditor.getText()).indexOf("{") !== -1;
                }, explicitWait, "No text was found inside Bastion4PrivateSubnetStandardVnc Info.json");

                const json = await textEditor.getText();
                expect(Common.isJson(json)).to.equal(true);

                const parsed = JSON.parse(json);
                const bastionId = parsed.id;

                await Common.selectContextMenuItem(ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc", "Set as Current Bastion");

                await driver.wait(async () => {
                    return !(await Common.hasLoadingBar(ociTreeSection));
                }, ociExplicitWait, "There is still a loading bar on OCI");

                expect(await Common.isDefaultItem(ociTreeSection,
                    "bastion", "Bastion4PrivateSubnetStandardVnc")).to.be.true;

                await Common.toggleSection(consolesTreeSection, true);

                const btn = await Common.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

                const textArea = await driver.findElement(By.css("textArea"));
                await Common.execCmd(textArea, "mds.get.currentBastionId()", 60000);

                const zoneHost = await driver.findElements(By.css(".zoneHost"));
                const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

                expect(result).to.equal(bastionId);

            });

            it("Refresh When Bastion Reaches Active State", async () => {

                await Common.selectContextMenuItem(ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc", "Refresh When Bastion Reaches Active State");

                await Common.toggleSection(tasksTreeSection, true);

                expect(await Common.existsTreeElement(
                    tasksTreeSection, "Refresh Bastion (running)")).to.be.true;

                const bottomBar = new BottomBarPanel();
                const outputView = await bottomBar.openOutputView();

                await Common.waitForOutputText(outputView, "Task 'Refresh Bastion' completed successfully", 20000);

                await outputView.clearText();

                expect(await Common.existsTreeElement(
                    tasksTreeSection, "Refresh Bastion (done)")).to.be.true;

            });

            it("Delete Bastion", async () => {

                const bottomBar = new BottomBarPanel();
                const outputView = await bottomBar.openOutputView();
                await outputView.clearText();

                await Common.selectContextMenuItem(ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc", "Delete Bastion");

                await Common.toggleSection(tasksTreeSection, true);

                expect(await Common.existsTreeElement(tasksTreeSection, "Delete Bastion (running)")).to.be.true;

                await Common.waitForOutputText(outputView, "OCI profile 'E2ETESTS' loaded.", ociTasksExplicitWait);

                await Common.verifyNotification("Are you sure you want to delete");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("NO");

                expect(await Common.existsTreeElement(tasksTreeSection, "Delete Bastion (error)")).to.be.true;

                await Common.waitForOutputText(outputView, "Deletion aborted", explicitWait);

                await outputView.clearText();

            });

        });

    });

    describe("MYSQL SHELL CONSOLES", () => {

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
                await Common.initTreeSection(consolesTreeSection);
                await Common.toggleSection(consolesTreeSection, true);
            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }

        });

        after(async function () {
            try {
                await Common.toggleSection(consolesTreeSection, false);
            } catch (e) {
                await Common.processFailure(this);
                throw e;
            }
        });

        describe("Toolbar shell", () => {

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await driver.switchTo().defaultContent();
                await new EditorView().closeAllEditors();

            });

            it("Add a new MySQL Shell Console", async () => {

                const btn = await Common.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
                await driver.switchTo().defaultContent();

                expect(await Common.existsTreeElement(consolesTreeSection, "Session 1") as Boolean).to.equal(true);

                await Common.selectContextMenuItem(consolesTreeSection, "Session 1",
                    "Close this MySQL Shell Console");

                expect(await Common.existsTreeElement(consolesTreeSection, "Session 1")).to.equal(false);

            });

            it("Open MySQL Shell Console Browser", async () => {
                const btn = await Common.getSectionToolbarButton(
                    consolesTreeSection, "Open MySQL Shell Console Browser");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await Common.switchToWebView();

                expect(await driver.wait(until.elementLocated(By.css("#shellModuleTabview h2")),
                    explicitWait, "Title was not found").getText())
                    .to.equal("MySQL Shell - GUI Console");

                const newSession = await driver.findElement(By.id("-1"));
                await newSession.click();

                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
                await driver.switchTo().defaultContent();

                expect(await Common.existsTreeElement(consolesTreeSection, "Session 1")).to.equal(true);
            });

            it("Open multiple sessions", async () => {

                const btn = await Common.getSectionToolbarButton(consolesTreeSection, "Add a New MySQL Shell Console");

                for (let i = 1; i <= 3; i++) {
                    await btn.click();
                    await Common.switchToWebView();
                    await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
                    await driver.switchTo().defaultContent();
                    expect(await Common.existsTreeElement(consolesTreeSection, `Session ${i}`) as Boolean)
                        .to.equal(true);
                }

            });

        });

        describe("Shell database connections", () => {

            let editor: WebElement;
            let textArea: WebElement;

            const shellConn: IDBConnection = {
                caption: "shellConn",
                description: "Local connection for shell",
                hostname: String(process.env.DBHOSTNAME),
                username: String(process.env.DBSHELLUSERNAME),
                port: Number(process.env.DBPORT),
                portX: Number(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBSHELLPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            before(async function () {
                try {
                    const btn = await Common.getSectionToolbarButton(
                        consolesTreeSection, "Add a New MySQL Shell Console");
                    await btn.click();

                    const editors = await new EditorView().getOpenEditorTitles();
                    expect(editors).to.include.members(["MySQL Shell Consoles"]);

                    await Common.switchToWebView();

                    editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                        10000, "Console was not loaded");

                    textArea = await driver.findElement(By.css("textArea"));

                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await Common.execCmd(textArea, `\\d`);
                await driver.wait(async () => {
                    const text = await Shell.getServerTabStatus();

                    return text === "The session is not connected to a MySQL server";
                }, explicitWait, "Session tab text is not disconnected");

                await Common.cleanEditor();
            });

            after(async function () {
                try {
                    await driver.switchTo().defaultContent();
                    await new EditorView().closeAllEditors();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });


            it("Connect to host", async () => {

                let connUri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                connUri += `${globalConn.port}/${globalConn.schema}`;

                await Common.execCmd(textArea, connUri);

                const result = await Shell.getResult();

                connUri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
                connUri += `${globalConn.port}/${globalConn.schema}'`;

                expect(result).to.include(connUri);

                expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

                expect(result).to.include(
                    `Default schema set to \`${globalConn.schema}\`.`,
                );

                connUri = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
                connUri += ` using the classic protocol`;

                expect(await Shell.getServerTabStatus()).equals(connUri);

                expect(await Shell.getSchemaTabStatus())
                    .to.include(globalConn.schema);

            });

            it("Connect to host without password", async () => {

                let uri = `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:`;
                uri += `${String(shellConn.port)}/${String(shellConn.schema)}`;

                await Common.execCmd(

                    textArea,
                    uri);

                await Database.setPassword(shellConn);

                await Common.setConfirmDialog(shellConn, "no");

                const result = await Shell.getResult();

                uri = `Creating a session to '${String(shellConn.username)}@${String(shellConn.hostname)}:`;
                uri += `${String(shellConn.port)}/${String(shellConn.schema)}'`;

                expect(result).to.include(uri);

                expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

                expect(result).to.include(
                    `Default schema set to \`${String(shellConn.schema)}\`.`,
                );

                uri = `Connection to server ${globalConn.hostname} at port ${globalConn.port},`;
                uri += ` using the classic protocol`;

                expect(await Shell.getServerTabStatus()).equals(uri);

                expect(await Shell.getSchemaTabStatus()).to.include(globalConn.schema);

            });

            it("Connect using shell global variable", async () => {

                let uri = `shell.connect('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}')`;

                await Common.execCmd(textArea, uri);

                let result = await Shell.getResult();

                uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
                uri += `${globalConn.portX}/${globalConn.schema}'`;

                expect(result).to.include(uri);

                expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

                expect(result).to.include(
                    `Default schema \`${globalConn.schema}\` accessible through db`,
                );

                uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
                uri += ` using the X protocol`;

                expect(await Shell.getServerTabStatus()).equals(uri);

                expect(await Shell.getSchemaTabStatus())
                    .to.include(globalConn.schema);

                await Common.execCmd(textArea, "shell.status()");

                result = await Shell.getResult();

                expect(result).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

                expect(result).to.include(`"CONNECTION":"${globalConn.hostname} via TCP/IP"`);

                expect(result).to.include(`"CURRENT_SCHEMA":"${globalConn.schema}"`);

                expect(result).to.include(`"CURRENT_USER":"${globalConn.username}@${globalConn.hostname}"`);

                expect(result).to.include(`"TCP_PORT":"${globalConn.portX}"`);

            });

            it("Connect using mysql mysqlx global variable", async () => {

                let cmd = `mysql.getClassicSession('${globalConn.username}:${globalConn.password}
                    @${globalConn.hostname}:${globalConn.port}/${globalConn.schema}')`;

                await Common.execCmd(textArea, cmd.replace(/ /g, ""));

                let result = await Shell.getResult();

                expect(result).to.include("&lt;ClassicSession&gt;");

                await Common.execCmd(textArea, "shell.disconnect()");

                result = await Shell.getResult();

                cmd = `mysql.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                cmd += `${globalConn.port}/${globalConn.schema}')`;

                await Common.execCmd(textArea, cmd);

                result = await Shell.getResult();

                expect(result).to.include("&lt;ClassicSession&gt;");

                await Common.execCmd(textArea, "shell.disconnect()");

                cmd = `mysqlx.getSession('${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                cmd += `${globalConn.portX}/${globalConn.schema}')`;

                await Common.execCmd(textArea, cmd);

                result = await Shell.getResult();

                expect(result).to.include("&lt;Session&gt;");

            });

            it("Change schemas using menu", async () => {

                await Common.execCmd(
                    textArea,
                    `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:${globalConn.portX}`);

                let result = await Shell.getResult();

                expect(result).to.include(
                    `Creating a session to '${globalConn.username}@${globalConn.hostname}:${globalConn.portX}`);

                let uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
                uri += ` using the X protocol`;

                expect(await Shell.getServerTabStatus()).equals(uri);

                expect(await Shell.getSchemaTabStatus())
                    .to.include("no schema selected");

                expect(result).to.include("No default schema selected");

                await driver.executeScript(
                    "arguments[0].click();",
                    await editor.findElement(By.css(".current-line")),
                );

                const schemaLabel = await driver.findElement(By.id("schema")).getText();
                expect(schemaLabel.substring(1).trim()).equals("no schema selected");

                await Shell.changeSchemaOnTab("sakila");

                result = await Shell.getResult();

                expect(result).to.include(`Default schema \`sakila\` accessible through db.`);

                await Shell.changeSchemaOnTab("world_x_cst");

                result = await Shell.getResult();

                expect(result).to.include(`Default schema \`world_x_cst\` accessible through db.`);

            });

        });

        describe("Sessions", () => {

            let editor: WebElement;

            let textArea: WebElement;

            before(async function () {
                try {
                    const btn = await Common.getSectionToolbarButton(
                        consolesTreeSection, "Add a New MySQL Shell Console");
                    await btn.click();

                    const editors = await new EditorView().getOpenEditorTitles();
                    expect(editors).to.include.members(["MySQL Shell Consoles"]);

                    await Common.switchToWebView();

                    editor = await driver.wait(until.elementLocated(By.id("shellEditorHost")),
                        10000, "Console was not loaded");

                    await driver.executeScript(
                        "arguments[0].click();",
                        await editor.findElement(By.css(".current-line")),
                    );

                    textArea = await editor.findElement(By.css("textArea"));

                    let uri = `\\c ${globalConn.username}:${globalConn.password}@${globalConn.hostname}:`;
                    uri += `${globalConn.portX}/${globalConn.schema}`;

                    await Common.execCmd(textArea, uri);

                    const result = await Shell.getResult();

                    uri = `Creating a session to '${globalConn.username}@${globalConn.hostname}:`;
                    uri += `${globalConn.portX}/${globalConn.schema}'`;

                    expect(result).to.include(uri);

                    uri = `Connection to server ${globalConn.hostname} at port ${globalConn.portX},`;
                    uri += ` using the X protocol`;

                    expect(await Shell.getServerTabStatus()).equals(uri);

                    expect(await Shell.getSchemaTabStatus())
                        .to.include(globalConn.schema);
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            afterEach(async function () {
                if (this.currentTest?.state === "failed") {
                    await Common.processFailure(this);
                }

                await Common.cleanEditor();
            });

            after(async function () {
                try {
                    await driver.switchTo().defaultContent();
                    await new EditorView().closeAllEditors();
                } catch (e) {
                    await Common.processFailure(this);
                    throw e;
                }
            });

            it("Verify help command", async () => {

                await Common.execCmd(textArea, "\\h");

                const result = await Shell.getResult();

                expect(result).to.include(
                    "The Shell Help is organized in categories and topics.",
                );

                expect(result).to.include("SHELL COMMANDS");
                expect(result).to.include("\\connect");
                expect(result).to.include("\\disconnect");
                expect(result).to.include("\\edit");
                expect(result).to.include("\\exit");
                expect(result).to.include("\\help");
                expect(result).to.include("\\history");
                expect(result).to.include("\\js");
                expect(result).to.include("\\nopager");
                expect(result).to.include("\\nowarnings");
                expect(result).to.include("\\option");
                expect(result).to.include("\\pager");
                expect(result).to.include("\\py");
                expect(result).to.include("\\quit");
                expect(result).to.include("\\reconnect");
                expect(result).to.include("\\rehash");
                expect(result).to.include("\\show");
                expect(result).to.include("\\source");
                expect(result).to.include("\\sql");
                expect(result).to.include("\\status");
                expect(result).to.include("\\system");
                expect(result).to.include("\\use");
                expect(result).to.include("\\warning");
                expect(result).to.include("\\watch");


            });

            it("Switch session language - javascript python", async () => {

                await Common.execCmd(textArea, "\\py");

                let result = await Shell.getResult();

                expect(result).equals("Switching to Python mode...");

                expect(await Shell.getTech(editor)).equals("python");

                await Common.execCmd(textArea, "\\js");

                result = await Shell.getResult();

                expect(result).equals("Switching to JavaScript mode...");

                expect(await Shell.getTech(editor)).equals("javascript");

            });

            it("Using db global variable", async () => {

                await Common.execCmd(textArea, "db.actor.select().limit(1)");

                expect(await driver.wait(async () => {
                    return Shell.isValueOnDataSet("PENELOPE");
                }, explicitWait, "'PENELOPE is not on the data set'")).to.be.true;

                expect(await Shell.getTotalRows()).to.match(/(\d+) row in set/);

            });

            it("Using util global variable", async () => {

                await Common.execCmd(textArea, 'util.exportTable("actor", "test.txt")');

                await driver.wait(
                    async () => {
                        return (
                            (await Shell.getResult()).indexOf(
                                "The dump can be loaded using",
                            ) !== -1
                        );
                    },
                    10000,
                    "Export operation was not done in time",
                );

                const result = await Shell.getResult();
                expect(result).to.include("Running data dump using 1 thread.");
                expect(result).to.match(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);
                expect(result).to.match(/Data size: (\d+).(\d+)(\d+) KB/);
                expect(result).to.match(/Rows written: (\d+)/);
                expect(result).to.match(/Bytes written: (\d+).(\d+)(\d+) KB/);
                expect(result).to.match(/Average throughput: (\d+).(\d+)(\d+) KB/);

            });

            it("Verify collections - json format", async () => {

                await Shell.changeSchemaOnTab("world_x_cst");

                const result = await Shell.getResult();

                expect(result).to.include(`Default schema \`world_x_cst\` accessible through db.`);

                await Common.execCmd(textArea, "db.countryinfo.find()");

                expect(await Shell.getLangResult()).equals("json");

                expect(await Shell.isValueOnJsonResult("Yugoslavia")).to.be.true;

            });

            it("Check query result content", async () => {

                await Common.execCmd(textArea, "\\sql");

                await Common.execCmd(textArea, "SHOW DATABASES;");

                expect(await Shell.isValueOnDataSet("sakila")).equals(true);

                expect(await Shell.isValueOnDataSet("mysql")).equals(true);

                await Common.execCmd(textArea, "\\js");

                await Shell.changeSchemaOnTab("sakila");

                await Common.execCmd(textArea, `shell.options.resultFormat="json/raw"`);

                expect(await Shell.getResult()).to.equals("json/raw");

                await Common.execCmd(textArea, `shell.options.showColumnTypeInfo=false`);

                expect(await Shell.getResult()).to.equals("false");

                await Common.execCmd(textArea, `shell.options.resultFormat="json/pretty"`);

                expect(await Shell.getResult()).to.equals("json/pretty");

                await Common.execCmd(textArea, "db.category.select().limit(1)");

                const result = await Shell.getResult();

                expect(result).to.include(`"rows": [`);

                expect(result).to.include(`"name": "Action"`);

                await Common.execCmd(textArea, `shell.options.resultFormat="table"`);

                expect(await Shell.getResult()).to.equals("table");

                await Common.execCmd(textArea, "db.category.select().limit(1)");

                expect(await driver.wait(async () => {
                    return Shell.isValueOnDataSet("Action");
                }, explicitWait, "'Action is not on the data set'")).to.be.true;
            });

        });
    });

});
