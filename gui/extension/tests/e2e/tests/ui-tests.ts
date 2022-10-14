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
    createDBconnection,
    getLeftSection,
    getLeftSectionButton,
    IDBConnection,
    getDB,
    startServer,
    getTreeElement,
    toggleTreeElement,
    deleteDBConnection,
    toggleSection,
    setEditorLanguage,
    enterCmd,
    selectContextMenuItem,
    selectMoreActionsItem,
    existsTreeElement,
    waitForExtensionChannel,
    reloadVSCode,
    isCertificateInstalled,
    isJson,
    isDefaultItem,
    hasTreeChildren,
    waitForLoading,
    reloadSection,
    postActions,
    isDBConnectionSuccessful,
    closeDBconnection,
    setDBEditorPassword,
    setConfirmDialog,
    selectDatabaseType,
    getToolbarButton,
    writeSQL,
    findInSelection,
    expandFinderReplace,
    replacerGetButton,
    closeFinder,
    getResultTab,
    getResultColumnName,
    getOutput,
    pressEnter,
    setDBEditorLanguage,
    getResultStatus,
    clickContextMenuItem,
    getGraphHost,
    hasNewPrompt,
    getLastQueryResultId,
    loadDriver,
    shellGetResult,
    cleanEditor,
    shellGetTech,
    shellGetTotalRows,
    shellGetLangResult,
    isValueOnDataSet,
    reloadConnection,
    getShellServerTabStatus,
    getShellSchemaTabStatus,
    isValueOnJsonResult,
    setRestService,
    setRestSchema,
    getFirstTreeChild,
    initTreeSection,
    getExistingConnections,
    toggleBottomBar,
    openNewNotebook,
    takeScreenshot,
    dbTreeSection,
    ociTreeSection,
    consolesTreeSection,
    tasksTreeSection,
    switchToWebView,
    driver,
    getCurrentEditor,
    addScript,
    getCurrentEditorType,
    getScriptResult,
    clickTreeElement,
    selectEditor,
    waitForNotification,
    explicitWait,
    ociExplicitWait,
} from "../lib/helpers";

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

    const conn: IDBConnection = {
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
        await loadDriver();
        try {
            let activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VSCode"))?.openView();
            const openEditors = new EditorView();

            await driver.wait(async () => {
                return (await openEditors.getOpenEditorTitles()).includes("Welcome to MySQL Shell");
            }, explicitWait, "Welcome tab was not displayed");

            await reloadVSCode();
            await new EditorView().closeAllEditors();
            activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VSCode"))?.openView();
            await waitForExtensionChannel();

            if (!(await isCertificateInstalled())) {
                throw new Error("Please install the certificate");
            }
        } catch(e) {
            await takeScreenshot(this);
            throw new Error(String(e.stack));
        }

    });

    describe("DATABASE - Toolbar action tests", () => {

        before(async function () {

            try {
                await initTreeSection(dbTreeSection);
                await toggleBottomBar(false);
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        afterEach(async function () {
            try {
                await postActions(this);
                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                await edView.closeAllEditors();
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        it("Create and delete a Database connection", async () => {
            let flag = false;
            try {
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                conn.caption += String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                await createDBconnection(conn);
                flag = true;
                expect(await getDB(conn.caption)).to.exist;
                await reloadSection(dbTreeSection);
                expect(await getTreeElement(dbTreeSection, conn.caption)).to.exist;
            } catch (e) {
                throw new Error(String(e.stack));
            } finally {
                if (flag) {
                    await deleteDBConnection(conn.caption);
                }
            }
        });

        it("Open DB Connection Browser", async () => {

            const openConnBrw = await getLeftSectionButton(dbTreeSection, "Open the DB Connection Browser");
            await openConnBrw?.click();
            const editorView = new EditorView();
            const editor = await editorView.openEditor("DB Connections");
            expect(await editor.getTitle()).to.equal("DB Connections");

            await switchToWebView();

            expect(
                await driver.wait(until.elementLocated(By.id("title")), explicitWait, "Title was not found").getText(),
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

            await driver.switchTo().defaultContent();

            const edView = new EditorView();
            await edView.closeEditor("DB Connections");

        });

        // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34200753
        it.skip("Connect to external MySQL Shell process", async () => {
            let prc: ChildProcess;
            try {
                prc = await startServer();
                await selectMoreActionsItem(dbTreeSection, "Connect to External MySQL Shell Process");
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

            } catch (e) {
                throw new Error(String(e.stack));
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

            await selectMoreActionsItem(dbTreeSection, "Restart the Internal MySQL Shell Process");

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
                await toggleBottomBar(false);
            }
        });

        it("Relaunch Welcome Wizard", async () => {

            await selectMoreActionsItem(dbTreeSection, "Relaunch Welcome Wizard");

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
            await driver.switchTo().defaultContent();
        });

    });

    describe("DATABASE - Context menu tests", () => {

        before(async function () {
            try {
                await initTreeSection(dbTreeSection);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                conn.caption += randomCaption;
                await createDBconnection(conn);
                expect(await getDB(conn.caption)).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("DB Connections");
                await reloadSection(dbTreeSection);
                const el = await getTreeElement(dbTreeSection, conn.caption);
                expect(el).to.exist;

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {

            try {
                await postActions(this);

                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        after(async function () {
            try {
                await postActions(this);
                await driver.switchTo().defaultContent();
                await toggleTreeElement(dbTreeSection, conn.caption, false);
                if (await existsTreeElement(dbTreeSection, "Dup")) {
                    await toggleTreeElement(dbTreeSection, "Dup", false);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        it("Connection Context Menu - Open DB Connection", async () => {

            await selectContextMenuItem(dbTreeSection, conn.caption, "Open DB Connection");

            await new EditorView().openEditor(conn.caption);

            await switchToWebView();

            const item = await driver.wait(until.elementLocated(By.css(".zoneHost")),
                explicitWait, "zoneHost not found");
            expect(item).to.exist;
            await driver.switchTo().defaultContent();

        });

        it("Connection Context Menu - Open DB Connection in New Tab", async () => {

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open DB Connection");

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open DB Connection in New Tab");

            const editorView = new EditorView();
            const editors = await editorView.getOpenEditorTitles();

            let counter = 0;
            for (const editor of editors) {
                if (editor === conn.caption) {
                    counter++;
                }
            }
            expect(counter).to.equal(2);
        });

        it("Connection Context Menu - Open MySQL Shell GUI Console for this connection", async () => {

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            const item = await driver.wait(until
                .elementLocated(By.css("code > span")), 10000, "MySQL Shell Console was not loaded");
            expect(await item.getText()).to.include("Welcome to the MySQL Shell - GUI Console");
            await driver.switchTo().defaultContent();

            await toggleSection(consolesTreeSection, true);
            expect(await getTreeElement(
                ociTreeSection, "Session to " + conn.caption)).to.exist;

        });

        it("Connection Context Menu - Edit MySQL connection", async () => {
            const aux = conn.caption;
            try {
                conn.caption = `toEdit${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
                await createDBconnection(conn);
                expect(await getDB(conn.caption)).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("DB Connections");
                await reloadSection(dbTreeSection);

                await selectContextMenuItem(dbTreeSection, conn.caption, "Edit MySQL Connection");

                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                expect(editors.includes("DB Connections")).to.be.true;

                await switchToWebView();

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
                    await reloadSection(dbTreeSection);
                    try {
                        await getTreeElement(dbTreeSection, edited);

                        return true;
                    } catch (e) { return false; }
                }, explicitWait, "Database was not updated");

            } catch (e) { throw new Error(String(e.stack)); } finally { conn.caption = aux; }

        });

        it("Connection Context Menu - Duplicate this MySQL connection", async () => {

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Duplicate this MySQL Connection");

            const editorView = new EditorView();
            const editors = await editorView.getOpenEditorTitles();
            expect(editors.includes("DB Connections")).to.be.true;

            await switchToWebView();

            const dialog = await driver.wait(until.elementLocated(
                By.css(".valueEditDialog")), explicitWait, "Connection dialog was not found");
            await dialog.findElement(By.id("caption")).sendKeys("Dup");
            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver.switchTo().defaultContent();

            await driver.wait(async () => {
                await reloadSection(dbTreeSection);
                const db = await getLeftSection(dbTreeSection);

                return (await db?.findElements(By.xpath("//div[contains(@aria-label, 'Dup')]")))!.length === 1;
            }, 10000, "Duplicated database was not found");

        });

        it("Schema Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Tables", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            let editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.switchTo().defaultContent();

            await selectContextMenuItem(dbTreeSection, conn.schema,
                "Copy To Clipboard -> Name");

            await switchToWebView();

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
            expect(textAreaValue).to.include(conn.schema);

            await driver.switchTo().defaultContent();

            await selectContextMenuItem(dbTreeSection, conn.schema,
                "Copy To Clipboard -> Create Statement");

            await switchToWebView();

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

            await driver.switchTo().defaultContent();

        });

        it("Schema Context Menu - Drop Schema", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testSchema = `testschema${random}`;

            await toggleTreeElement(dbTreeSection, conn.caption, true);

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(textArea, "call clearSchemas();", 10000);
            let result = await shellGetResult();
            expect(result).to.include("OK");

            await enterCmd(textArea, `create schema ${testSchema};`);

            result = await shellGetResult();
            expect(result).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(conn.caption);

                return existsTreeElement(dbTreeSection, testSchema);
            }, explicitWait, `${testSchema} was not found`);

            await selectContextMenuItem(dbTreeSection, testSchema, "Drop Schema...");

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

            const sec = await getLeftSection(dbTreeSection);
            await reloadSection(dbTreeSection);
            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testSchema}') and contains(@role, 'treeitem')]`)))!.length === 0;
            }, explicitWait, `${testSchema} is still on the list`);

        });

        it("Table Context Menu - Show Data", async () => {

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Tables", true);

            await selectContextMenuItem(dbTreeSection, "actor", "Show Data...");

            const ed = new EditorView();
            const activeTab = await ed.getActiveTab();
            expect(await activeTab!.getTitle()).equals(conn.caption);

            await switchToWebView();

            const resultHost = await driver.wait(until.elementLocated(
                By.css(".resultHost")), 20000, "query results were not found");

            const resultStatus = await driver.wait(async () => {
                return (await resultHost.findElements(By.css(".resultStatus label")))[0];
            }, explicitWait, "'.resultStatus label' did not find any element");

            expect(await resultStatus.getText()).to.match(/OK, (\d+) records/);

        });

        it("Table Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Tables", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            let editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.switchTo().defaultContent();

            await selectContextMenuItem(dbTreeSection, "actor",
                "Copy To Clipboard -> Name");

            await switchToWebView();

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

            await selectContextMenuItem(dbTreeSection, "actor",
                "Copy To Clipboard -> Create Statement");

            await switchToWebView();

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

            await driver.switchTo().defaultContent();

        });

        it("Table Context Menu - Drop Table", async () => {

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testTable = `testtable${random}`;

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Tables", true);

            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(textArea, `use ${conn.schema};`, explicitWait);

            const zoneHost = await driver.findElements(By.css(".zoneHost"));
            let result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getAttribute("innerHTML");
            expect(result).to.include(`Default schema set to \`${conn.schema}\`.`);

            await enterCmd(textArea, "call clearTables();", explicitWait);
            result = await shellGetResult();
            expect(result).to.include("OK");

            const prevZoneHosts = await driver.findElements(By.css(".zoneHost"));

            await enterCmd(textArea, `create table ${testTable} (id int, name VARCHAR(50));`, explicitWait);

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
            }, 7000, "New results block was not found");

            result = await shellGetResult();
            expect(result).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(conn.caption);

                return existsTreeElement(dbTreeSection, testTable);
            }, explicitWait, `${testTable} was not found`);

            await selectContextMenuItem(dbTreeSection, testTable, "Drop Table...");

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

            const sec = await getLeftSection(dbTreeSection);
            await reloadSection(dbTreeSection);

            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    "//div[contains(@aria-label, 'testTable') and contains(@role, 'treeitem')]")))!.length === 0;
            }, explicitWait, `${testTable} is still on the list`);

        });

        it("View Context Menu - Show Data", async () => {
            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Views", true);

            await selectContextMenuItem(dbTreeSection, "test_view", "Show Data...");

            const ed = new EditorView();
            const activeTab = await ed.getActiveTab();
            expect(await activeTab!.getTitle()).equals(conn.caption);

            await switchToWebView();

            const resultHost = await driver.wait(until.elementLocated(
                By.css(".resultHost")), 20000, "query results were not found");

            const resultStatus = await driver.wait(async () => {
                return (await resultHost.findElements(By.css(".resultStatus label")))[0];
            }, explicitWait, "'.resultStatus label' did not find any element");

            expect(await resultStatus.getText()).to.match(/OK, (\d+) records/);
        });

        it("View Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Views", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            let editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.switchTo().defaultContent();

            await selectContextMenuItem(dbTreeSection, "test_view",
                "Copy To Clipboard -> Name");

            await switchToWebView();

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

            await selectContextMenuItem(dbTreeSection, "test_view",
                "Copy To Clipboard -> Create Statement");

            await switchToWebView();

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

            await driver.switchTo().defaultContent();

        });

        it("View Context Menu - Drop View", async () => {
            await selectContextMenuItem(dbTreeSection, conn.caption,
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Views", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await setEditorLanguage("sql");
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(textArea, `use ${conn.schema};`);

            const zoneHost = await driver.findElements(By.css(".zoneHost"));
            let result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getAttribute("innerHTML");
            expect(result).to.include(`Default schema set to \`${conn.schema}\`.`);

            const random = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            const testView = `testview${random}`;

            await enterCmd(textArea, "call clearViews();");
            result = await shellGetResult();
            expect(result).to.include("OK");

            const prevZoneHosts = await driver.findElements(By.css(".zoneHost"));

            await enterCmd(textArea, `CREATE VIEW ${testView} as select * from sakila.actor;`);

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
            }, 7000, "New results block was not found");

            result = await shellGetResult();
            expect(result).to.include("OK");

            await driver.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(conn.caption);

                return existsTreeElement(dbTreeSection, testView);
            }, explicitWait, `${testView} was not found`);

            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, conn.schema, true);
            await toggleTreeElement(dbTreeSection, "Views", true);

            await selectContextMenuItem(dbTreeSection, testView, "Drop View...");

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

            const sec = await getLeftSection(dbTreeSection);
            await reloadSection(dbTreeSection);

            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testView}') and contains(@role, 'treeitem')]`)))!.length === 0;
            }, explicitWait, `${testView} is still on the list`);

        });

    });

    describe("DATABASE - DB Editor connection tests", () => {

        let sqliteConName = "";

        before(async function () {
            try {

                await initTreeSection(dbTreeSection);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const connections = await getExistingConnections();
                if (connections.length > 0) {
                    conn.caption = connections[0];
                } else {
                    const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                    conn.caption += randomCaption;
                    await createDBconnection(conn);
                    expect(await getDB(conn.caption)).to.exist;
                }

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        beforeEach(async function () {
            try {
                const openConnBrw = await getLeftSectionButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();
                await switchToWebView();
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {
            try {
                await driver.switchTo().defaultContent();
                await postActions(this);
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        after(async function () {
            try {
                await toggleTreeElement(dbTreeSection, conn.caption, false);
                if (await existsTreeElement(dbTreeSection, sqliteConName)) {
                    await toggleTreeElement(dbTreeSection, sqliteConName, false);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        it("Store and clear password", async () => {

            let host = await getDB(conn.caption, false);
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
            await savePassDialog.findElement(By.css("input")).sendKeys(conn.password);
            await savePassDialog.findElement(By.id("ok")).click();

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(conn.caption, false),
            );

            expect(await isDBConnectionSuccessful(conn.caption)).to.be.true;

            await closeDBconnection(conn.caption);

            const openConnBrw = await getLeftSectionButton(dbTreeSection, "Open the DB Connection Browser");
            await openConnBrw?.click();

            await switchToWebView();

            host = await getDB(conn.caption, false);

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
                await getDB(conn.caption, false),
            );

            const passwordDialog = await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                explicitWait, "Password dialog was not displayed");

            expect(passwordDialog).to.exist;

        });

        it("Confirm dialog - Save password", async () => {

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(conn.caption, false),
            );

            await setDBEditorPassword(conn);

            await setConfirmDialog(conn, "yes");

            expect(await isDBConnectionSuccessful(conn.caption))
                .to.be.true;

            await closeDBconnection(conn.caption);

            const openConnBrw = await getLeftSectionButton(dbTreeSection, "Open the DB Connection Browser");
            await openConnBrw?.click();

            await switchToWebView();

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(conn.caption, false),
            );

            expect(await isDBConnectionSuccessful(conn.caption))
                .to.be.true;
        });

        it("Edit a database connection and verify errors", async () => {
            const host = await getDB(conn.caption, false);
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
            await selectDatabaseType("Sqlite");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            sqliteConName = `Sqlite DB${String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000))}`;
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
                sqlite = join(homedir(), ".mysqlsh-gui", "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");
            } else {
                sqlite = join(String(process.env.APPDATA), "MySQL", "mysqlsh-gui",
                    "plugin_data", "gui_plugin", "mysqlsh_gui_backend.sqlite3");
            }

            await dbPath!.sendKeys(sqlite);
            await newConDialog.findElement(By.id("dbName")).sendKeys("SQLite");
            await newConDialog.findElement(By.id("ok")).click();

            const sqliteConn = await getDB(sqliteConName, false);
            expect(sqliteConn).to.exist;
            expect(await sqliteConn.findElement(By.css(".tileDescription")).getText()).to.equals(
                "Local Sqlite connection",
            );

            await driver.executeScript(
                "arguments[0].click();",
                sqliteConn,
            );

            expect(await isDBConnectionSuccessful(sqliteConName)).to.be.true;

            await driver.switchTo().defaultContent();
            await toggleTreeElement(dbTreeSection, conn.caption, true);
            await toggleTreeElement(dbTreeSection, sqliteConName, true);
            await toggleTreeElement(dbTreeSection, "main", true);
            await toggleTreeElement(dbTreeSection, "Tables", true);
            await hasTreeChildren(dbTreeSection, "Tables", "db_connection");

            await selectContextMenuItem(dbTreeSection, "db_connection", "Show Data...");

            await switchToWebView();

            const result = await driver.wait(async () => {
                const res = await getResultStatus(true);
                if (res.length > 0) {
                    return res;
                }  else {
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
                .sendKeys(conn.hostname);

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(conn.username);

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(conn.schema);

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

            const dbConn = await getDB(conName, false);
            expect(dbConn).to.exist;

            await driver.executeScript(
                "arguments[0].click();",
                dbConn,
            );

            expect(await isDBConnectionSuccessful(conName)).to.be.true;

            const contentHost = await driver.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

            const execSel = await getToolbarButton("Execute selection or full block and create a new block");
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

    describe("DATABASE - DB Editor tests", () => {

        let textArea: WebElement;

        before(async function () {
            try {

                await initTreeSection(dbTreeSection);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const connections = await getExistingConnections();
                if (connections.length > 0) {
                    conn.caption = connections[0];
                } else {
                    const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                    conn.caption += randomCaption;
                    await createDBconnection(conn);
                    expect(await getDB(conn.caption)).to.exist;
                }

                const openConnBrw = await getLeftSectionButton(dbTreeSection,
                    "Open the DB Connection Browser");
                await openConnBrw?.click();

                await switchToWebView();

                await driver.executeScript(
                    "arguments[0].click();",
                    await getDB(conn.caption, false),
                );

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        beforeEach(async function () {
            try {

                textArea = await driver.wait(until.elementLocated(By.css("textarea")), explicitWait,
                    "Cound not find textarea");

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        afterEach(async function () {
            try {

                await postActions(this);
                await openNewNotebook();

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await toggleTreeElement(dbTreeSection, conn.caption, false);
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        it("Multi-cursor", async () => {

            await writeSQL("select * from sakila.actor;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await writeSQL("select * from sakila.address;");
            await driver.actions().sendKeys(Key.ENTER).perform();
            await writeSQL("select * from sakila.city;");

            await driver.actions().keyDown(Key.ALT).perform();

            const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
            lines.shift();
            let spans = await lines[0].findElements(By.css("span"));
            await spans[spans.length - 1].click();

            spans = await lines[1].findElements(By.css("span"));
            await spans[spans.length - 1].click();
            await driver.actions().keyUp(Key.ALT).perform();

            await driver.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver.sleep(1000);
            await driver.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver.sleep(1000);
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

        it("Using a DELIMITER", async () => {

            await setDBEditorLanguage("sql");

            textArea = await driver.findElement(By.css("textarea"));

            await writeSQL("DELIMITER $$");
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
            await writeSQL("select 2 $$", true);
            await textArea.sendKeys(Key.RETURN);
            await textArea.sendKeys(Key.TAB);
            await writeSQL("select 1");

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

            await writeSQL("SELECT * FROM ACTOR;");
            const execSel = await getToolbarButton("Execute selection or full block and create a new block");
            await execSel?.click();

            expect(await getResultStatus(true)).to.match(/(\d+) record/);
            expect(await hasNewPrompt()).to.be.true;
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {

            await writeSQL("select * from sakila.actor;");
            await textArea.sendKeys(Key.RETURN);

            await writeSQL("select * from sakila.address;");
            await textArea.sendKeys(Key.RETURN);

            await writeSQL("select * from sakila.category;");

            await driver.wait(async () => {
                return (await driver.findElements(By.css(".statementStart"))).length >= 3;
            }, explicitWait, "Statement start (blue dot) was not found on all lines");

            const lines = await driver.findElements(By.css("#contentHost .editorHost .view-line"));
            await lines[lines.length - 2].findElement(By.css("span > span")).click();

            let execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            let resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

            expect(await driver.wait(async () => {
                return getResultColumnName("address_id");
            }, 3000, "address_id column does not exist")).to.exist;

            await lines[lines.length - 3].findElement(By.css("span > span")).click();

            execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(until.stalenessOf(resultView), 3000, "Result View did not become stale");
            resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

            expect(await driver.wait(async () => {
                return getResultColumnName("actor_id");
            }, 3000, "actor_id column does not exist")).to.exist;

            await lines[lines.length - 1].findElement(By.css("span > span")).click();

            execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(until.stalenessOf(resultView), 3000, "Result View did not become stale");
            resultView = await driver.wait(until.elementLocated(By.css(".resultView")));

            expect(await driver.wait(async () => {
                return getResultColumnName("category_id");
            }, 3000, "category_id column does not exist")).to.exist;

        });

        it("Switch between search tabs", async () => {

            await writeSQL("select * from sakila.actor;select * from sakila.address;");
            const execCaret = await getToolbarButton("Execute selection or full block and create a new block");
            await execCaret?.click();

            await driver.wait(until.elementLocated(By.css(".tabArea")), explicitWait, "Tabs were not found");

            const result1 = await getResultTab("Result #1");

            const result2 = await getResultTab("Result #2");

            expect(result1).to.exist;

            expect(result2).to.exist;

            expect(await getResultColumnName("actor_id")).to.exist;

            expect(await getResultColumnName("first_name")).to.exist;

            expect(await getResultColumnName("last_name")).to.exist;

            expect(await getResultColumnName("last_update")).to.exist;

            await result2.click();

            expect(await getResultColumnName("address_id")).to.exist;

            expect(await getResultColumnName("address")).to.exist;

            expect(await getResultColumnName("address2")).to.exist;

            expect(await getResultColumnName("district")).to.exist;

            expect(await getResultColumnName("city_id")).to.exist;

            expect(await getResultColumnName("postal_code")).to.exist;

            await result1.click();

            expect(await getResultColumnName("actor_id")).to.exist;

        });

        it("Connect to database and verify default schema", async () => {

            await enterCmd(textArea, "SELECT SCHEMA();");
            const result = await getResultStatus(true);
            expect(result).to.include("1 record retrieved");

            const zoneHosts = await driver.findElements(By.css(".zoneHost"));
            expect(await (await zoneHosts[zoneHosts.length - 1].findElement(By.css(".tabulator-cell"))).getText())
                .to.equals(conn.schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommit = await getToolbarButton("Auto commit DB changes");
            await autoCommit?.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await enterCmd(textArea,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            const commitBtn = await getToolbarButton("Commit DB changes");
            const rollBackBtn = await getToolbarButton("Rollback DB changes");

            await driver.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            const execSelNew = await getToolbarButton(
                "Execute selection or full block and create a new block");
            await execSelNew?.click();

            expect(await getResultStatus()).to.include("OK");

            await rollBackBtn!.click();

            await enterCmd(textArea, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            expect(await getResultStatus()).to.include("OK, 0 records retrieved");

            await enterCmd(textArea,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            expect(await getResultStatus()).to.include("OK");

            await commitBtn!.click();

            await enterCmd(textArea, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            expect(await getResultStatus(true)).to.include("OK, 1 record retrieved");

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

            await writeSQL(`import from xpto xpto xpto`);

            const findBtn = await getToolbarButton("Find");
            await findBtn!.click();

            const finder = await driver.findElement(By.css(".find-widget"));

            expect(await finder.getAttribute("aria-hidden")).equals("false");

            await finder.findElement(By.css("textarea")).sendKeys("xpto");

            await findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).to.match(/1 of (\d+)/);

            await driver.wait(
                until.elementsLocated(By.css(".cdr.findMatch")),
                2000,
                "No words found",
            );

            //REPLACE

            await expandFinderReplace(finder, true);

            const replacer = await finder.findElement(By.css(".replace-part"));

            await replacer.findElement(By.css("textarea")).sendKeys("tester");

            await (await replacerGetButton(replacer, "Replace (Enter)"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).to.include("import from tester xpto xpto");

            await replacer.findElement(By.css("textarea")).clear();

            await replacer.findElement(By.css("textarea")).sendKeys("testing");

            await (await replacerGetButton(replacer, "Replace All"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).to.include("import from tester testing testing");

            await closeFinder(finder);

            expect(await finder.getAttribute("aria-hidden")).equals("true");

        });

        it("Using Math_random on js_py blocks", async () => {

            await setDBEditorLanguage("javascript");

            await enterCmd(textArea, "Math.random();");

            const result2 = await getOutput();

            expect(result2).to.match(/(\d+).(\d+)/);

            await enterCmd(textArea, "\\typescript");

            expect(await getOutput()).equals("Switched to TypeScript mode");

            await enterCmd(textArea, "Math.random();");

            const result4 = await getOutput();

            expect(result4).to.match(/(\d+).(\d+)/);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver.sleep(1000);

            await pressEnter();

            const otherResult = await getOutput(true);

            expect(otherResult).to.match(/(\d+).(\d+)/);

            expect(otherResult !== result2).equals(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await pressEnter();

            const otherResult1 = await getOutput();

            expect(otherResult1).to.match(/(\d+).(\d+)/);

            expect(otherResult1 !== result4).equals(true);

        });

        it("Multi-line comments", async () => {

            await setDBEditorLanguage("sql");

            await enterCmd(textArea, "SELECT VERSION();");
            const result = await getResultStatus(true);
            expect(result).to.include("1 record retrieved");

            const resultHosts = await driver?.findElements(By.css(".resultHost"));

            const txt = await (await resultHosts[resultHosts.length - 1]
                .findElement(By.css(".tabulator-cell"))).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await enterCmd(textArea, `/*!${serverVer} select * from actor;*/`);

            expect(await getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

            const higherServer = parseInt(serverVer, 10) + 1;

            await enterCmd(textArea, `/*!${higherServer} select * from actor;*/`);

            expect(await getResultStatus()).to.include(
                "OK, 0 records retrieved",
            );

        });

        it("Context Menu - Execute", async () => {

            await writeSQL("select * from sakila.actor;");

            let lastId = await getLastQueryResultId();
            await clickContextMenuItem(textArea, "Execute Block");

            await driver.wait(async () => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

            expect(await hasNewPrompt()).to.be.false;

            lastId = await getLastQueryResultId();

            await clickContextMenuItem(textArea, "Execute Block and Advance");

            await driver.wait(async () => {
                return (await getLastQueryResultId()) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(true)).to.match(/OK, (\d+) records retrieved/);

            expect(await hasNewPrompt()).to.be.true;

        });

        it("Pie Graph based on DB table", async () => {

            await setDBEditorLanguage("ts");

            await enterCmd(textArea, `
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
                }
                `);

            const pieChart = await getGraphHost();

            const chartColumns = await pieChart.findElements(By.css("rect"));
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
            }

        });

    });

    describe("DATABASE - Scripts tests", () => {

        before(async function () {
            try {

                await initTreeSection(dbTreeSection);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const connections = await getExistingConnections();
                if (connections.length > 0) {
                    conn.caption = connections[0];
                } else {
                    const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                    conn.caption += `SSL${randomCaption}`;
                    await createDBconnection(conn);
                    expect(await getDB(conn.caption)).to.exist;
                    const edView = new EditorView();
                    await edView.closeEditor("DB Connections");
                }

                await selectContextMenuItem(dbTreeSection, conn.caption,
                    "Open DB Connection");

                await switchToWebView();

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {
            try {
                await postActions(this);
                await driver.findElement(By.id("itemCloseButton")).click();
                await driver.switchTo().defaultContent();
                const inputBox = new InputBox();
                await inputBox.cancel();
                await switchToWebView();
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                await toggleTreeElement(dbTreeSection, conn.caption, false);
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        it("Add SQL Script", async () => {
            await addScript("sql");
            expect(await getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await getCurrentEditorType()).to.equals("mysql");

            const textArea = await driver?.findElement(By.css("textarea"));
            await textArea?.sendKeys("select * from sakila.actor");
            const exec = await getToolbarButton("Execute the statement at the caret position");
            await exec?.click();
            expect(await getScriptResult()).to.match(/OK, (\d+) records/);
        });

        it("Add Typescript", async () => {
            await addScript("ts");
            expect(await getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await getCurrentEditorType()).to.equals("typescript");
            const textArea = await driver?.findElement(By.css("textarea"));
            await textArea?.sendKeys("Math.random()");
            const exec = await getToolbarButton("Execute full script");
            await exec?.click();
            expect(await getScriptResult()).to.match(/(\d+).(\d+)/);
        });

        it("Add Javascript", async () => {
            await addScript("js");
            expect(await getCurrentEditor()).to.match(/Untitled-(\d+)/);
            expect(await getCurrentEditorType()).to.equals("javascript");
            const textArea = await driver?.findElement(By.css("textarea"));
            await textArea?.sendKeys("Math.random()");
            const exec = await getToolbarButton("Execute full script");
            await exec?.click();
            expect(await getScriptResult()).to.match(/(\d+).(\d+)/);
        });

    });

    describe("DATABASE - MySQL Administration tests", () => {

        before(async function () {
            try {

                await initTreeSection(dbTreeSection);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const connections = await getExistingConnections();
                if (connections.length > 0) {
                    for (const connection of connections) {
                        if (connection.includes("SSL")) {
                            conn.caption = connection;
                            break;
                        }
                    }
                }

                if (!conn.caption.includes("SSL")) {
                    const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                    conn.caption += `SSL${randomCaption}`;
                    conn.sslMode = "Require and Verify CA";
                    conn.sslCA = `${String(process.env.SSLCERTSPATH)}/ca-cert.pem`;
                    conn.sslClientCert = `${String(process.env.SSLCERTSPATH)}/client-cert.pem`;
                    conn.sslClientKey = `${String(process.env.SSLCERTSPATH)}/client-key.pem`;
                    await createDBconnection(conn);
                    expect(await getDB(conn.caption)).to.exist;
                    conn.sslMode = undefined;
                    const edView = new EditorView();
                    await edView.closeEditor("DB Connections");
                }

                await toggleTreeElement(dbTreeSection, conn.caption, true);
                await toggleTreeElement(dbTreeSection, "MySQL Administration", true);

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {
            try {
                await postActions(this);
                await driver?.switchTo().defaultContent();
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await toggleTreeElement(dbTreeSection, conn.caption, false);
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        it("Server Status", async () => {
            await clickTreeElement(dbTreeSection, "Server Status");
            await switchToWebView();
            expect(await getCurrentEditor()).to.equals("Server Status");

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

        it("Client Connections", async ()  => {
            await clickTreeElement(dbTreeSection, "Client Connections");
            await switchToWebView();
            await driver.wait(async () => {
                return await getCurrentEditor() === "Client Connections";
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
            await clickTreeElement(dbTreeSection, "Performance Dashboard");
            await switchToWebView();
            await driver.wait(async () => {
                return await getCurrentEditor() === "Performance Dashboard";
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

        it("Switch between MySQL Administration tabs", async () => {
            await clickTreeElement(dbTreeSection, "Server Status");
            await switchToWebView();
            await driver.wait(until.elementLocated(By.css("h1")), explicitWait, "Server Status title not found");
            await driver.switchTo().defaultContent();
            await clickTreeElement(dbTreeSection, "Client Connections");
            await switchToWebView();
            await driver.wait(until.elementLocated(By.id("connectionListTitle")),
                explicitWait, "Client Connections page not found");
            await driver.switchTo().defaultContent();
            await clickTreeElement(dbTreeSection, "Performance Dashboard");
            await switchToWebView();
            await driver.wait(until.elementLocated(By.id("dashboardToolbar")),
                explicitWait, "Performance Dashboard page not found");

            await selectEditor("Server Status");
            await driver.wait(until.elementLocated(By.css("h1")), explicitWait, "Server Status title not found");

            await selectEditor("Client Connections");
            await driver.wait(until.elementLocated(By.id("connectionListTitle")),
                explicitWait, "Client Connections page not found");

            await selectEditor("Performance Dashboard");
            await driver.wait(until.elementLocated(By.id("dashboardToolbar")),
                explicitWait, "Performance Dashboard page not found");
        });

    });

    describe("ORACLE CLOUD INFRASTRUCTURE tests", () => {

        before(async function () {
            try {
                await initTreeSection(ociTreeSection);
                await toggleSection(dbTreeSection, false);
                await toggleSection(ociTreeSection, true);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        afterEach(async function () {

            try {
                await postActions(this);
                await driver.switchTo().defaultContent();
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);
                await toggleSection(ociTreeSection, true);

                await toggleBottomBar(false);

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
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await fs.unlink(join(homedir(), ".oci", "config"));
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        it("Configure the OCI profile list and refresh", async () => {

            const btn = await getLeftSectionButton(ociTreeSection,
                "Configure the OCI Profile list");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["config"]);

            const textEditor = new TextEditor();

            const editor = await driver.findElement(By.css("textarea"));

            // eslint-disable-next-line max-len
            await editor.sendKeys("[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmyabcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\ntenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo5mmi2z3a\nregion=us-ashburn-1\nkey_file= ~/.oci/id_rsa_e2e.pem");

            await textEditor.save();
            await reloadSection(ociTreeSection);

            await driver.wait(async () => {
                return existsTreeElement(ociTreeSection, "E2ETESTS (us-ashburn-1)");
            }, explicitWait, "E2ETESTS (us-ashburn-1) tree item was not found");

        });

        it("View Config Profile Information", async () => {

            await selectContextMenuItem(ociTreeSection,
                "E2ETESTS (us-ashburn-1)", "View Config Profile Information");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["E2ETESTS Info.json"]);

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return (await textEditor.getText()).length > 0;
            }, 3000, "No text was found on file");

            expect(isJson(await textEditor.getText())).to.equal(true);

        });

        it("Set as New Default Config Profile", async () => {

            await selectContextMenuItem(ociTreeSection,
                "E2ETESTS (us-ashburn-1)", "Set as New Default Config Profile");

            expect(await isDefaultItem(ociTreeSection,
                "profile", "E2ETESTS (us-ashburn-1)")).to.equal(true);
        });

        it("View Compartment Information and set it as Current", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);

            await waitForLoading(ociTreeSection, 20000);

            await hasTreeChildren(ociTreeSection, "E2ETESTS*", undefined);

            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);

            await waitForLoading(ociTreeSection, 10000);

            await hasTreeChildren(ociTreeSection, "Root Compartment*", undefined);

            await driver.wait(async () => {
                return existsTreeElement(ociTreeSection, "QA*");
            }, 10000, "QA compartment does not exist");

            await selectContextMenuItem(ociTreeSection,
                "QA*", "View Compartment Information");

            let editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["QA Info.json"]);

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return (await textEditor.getText()).indexOf("{") !== -1;
            }, explicitWait, "No text was found inside QA Info.json");

            const json = await textEditor.getText();
            expect(isJson(json)).to.equal(true);

            const parsed = JSON.parse(json);
            const compartmentId = parsed.id;

            await selectContextMenuItem(ociTreeSection,
                "QA*", "Set as Current Compartment");

            await waitForLoading(ociTreeSection, 10000);

            expect(await isDefaultItem(ociTreeSection, "compartment", "QA*")).to.be.true;

            expect(await hasTreeChildren(ociTreeSection,
                "E2ETESTS (us-ashburn-1)", "QA")).to.be.true;

            await toggleSection(consolesTreeSection, true);
            const btn = await getLeftSectionButton(consolesTreeSection, "Add a New MySQL Shell Console");
            await btn.click();

            editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

            const textArea = await driver.findElement(By.css("textArea"));
            await enterCmd(textArea, "mds.get.currentCompartmentId()", 60000);

            const zoneHost = await driver.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

            expect(result).to.equal(compartmentId);

        });

        it("View DB System Information", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);

            await waitForLoading(ociTreeSection, 10000);

            await hasTreeChildren(ociTreeSection, "E2ETESTS*", undefined);

            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);

            await waitForLoading(ociTreeSection, 10000);

            await toggleTreeElement(ociTreeSection, "QA*", true);

            await waitForLoading(ociTreeSection, 10000);

            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);

            await waitForLoading(ociTreeSection, 10000);

            await hasTreeChildren(ociTreeSection, "MySQLShellTesting", "MDSforVSCodeExtension");

            await selectContextMenuItem(ociTreeSection,
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
            expect(isJson(json)).to.equal(true);

        });

        it("Create connection with Bastion Service", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "MySQLShellTesting", "MDSforVSCodeExtension");

            await selectContextMenuItem(ociTreeSection,
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

            const mds = await getDB("MDSforVSCodeExtension");

            expect(mds).to.exist;

            try {

                await switchToWebView();

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

                await enterCmd(textArea, "select version();", 10000);

                const result = await getResultStatus(true);

                expect(result).to.include("OK");

                await driver.switchTo().defaultContent();

                expect(await existsTreeElement(ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc"))
                    .to.be.true;

                expect(await existsTreeElement(dbTreeSection, "MDSforVSCodeExtension"))
                    .to.be.true;
            } catch (e) {
                throw new Error(String(e.stack));
            } finally {
                await driver.switchTo().defaultContent();
                await toggleSection(dbTreeSection, true);
                await reloadSection(dbTreeSection);
                await toggleSection(dbTreeSection, false);
            }
        });

        it("Start a DB System", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(ociTreeSection,
                "MDSforVSCodeExtension", "Start the DB System");

            await toggleSection(ociTreeSection, false);
            await toggleSection(tasksTreeSection, true);
            expect(await existsTreeElement(tasksTreeSection, "Start DB System (running)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }
            }, 30000, "No logs were found to check that E2ETESTS profile was loaded");

            const ntf = await waitForNotification();

            expect(await ntf.getMessage()).to.include("Are you sure you want to start the DB System");

            await ntf.takeAction("Yes");

            await driver.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("DB System 'MDSforVSCodeExtension' did start successfully") !== -1;
                } catch (e) {
                    return false;
                }
            }, 30000, "No logs were found to check that DB System was started successfully");

            expect(await existsTreeElement(tasksTreeSection, "Start DB System (done)")).to.be.true;

        });

        it("Restart a DB System (and cancel)", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(ociTreeSection,
                "MDSforVSCodeExtension", "Restart the DB System");

            await toggleSection(ociTreeSection, false);
            await toggleSection(tasksTreeSection, true);
            expect(await existsTreeElement(tasksTreeSection, "Restart DB System (running)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }
            }, ociExplicitWait, "No logs were found to check that E2ETESTS profile was loaded");

            const ntf = await waitForNotification();

            expect(await ntf.getMessage()).to.include("Are you sure you want to restart the DB System");

            await ntf.takeAction("NO");

            await driver.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Operation cancelled") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System restart was cancelled");

        });

        it("Stop a DB System (and cancel)", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(ociTreeSection,
                "MDSforVSCodeExtension", "Stop the DB System");

            await toggleSection(ociTreeSection, false);
            await toggleSection(tasksTreeSection, true);
            expect(await existsTreeElement(tasksTreeSection, "Stop DB System (running)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, ociExplicitWait, "No logs were found to check that E2ETESTS profile was loaded");

            const ntf = await waitForNotification();
            expect(await ntf.getMessage()).to.include("Are you sure you want to stop the DB System");

            await ntf.takeAction("NO");

            await driver.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Operation cancelled") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System stop was cancelled");

        });

        it("Delete a DB System (and cancel)", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(ociTreeSection,
                "MDSforVSCodeExtension", "Delete the DB System");

            await toggleSection(ociTreeSection, false);
            await toggleSection(tasksTreeSection, true);
            expect(await existsTreeElement(tasksTreeSection, "Delete DB System (running)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, ociExplicitWait, "No logs were found to check that E2ETESTS profile was loaded");

            const ntf = await waitForNotification();
            expect(await ntf.getMessage()).to.include("Are you sure you want to delete");
            await ntf.takeAction("NO");

            await driver.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Deletion aborted") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System deletion was cancelled");

        });

        it("Get Bastion Information and set it as current", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "Bastion4PrivateSubnetStandardVnc");

            await selectContextMenuItem(ociTreeSection,
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
            expect(isJson(json)).to.equal(true);

            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await selectContextMenuItem(ociTreeSection,
                "Bastion4PrivateSubnetStandardVnc", "Set as Current Bastion");

            await waitForLoading(ociTreeSection, 10000);

            expect(await isDefaultItem(ociTreeSection,
                "bastion", "Bastion4PrivateSubnetStandardVnc")).to.be.true;

            await toggleSection(consolesTreeSection, true);
            const btn = await getLeftSectionButton(consolesTreeSection, "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

            const textArea = await driver.findElement(By.css("textArea"));
            await enterCmd(textArea, "mds.get.currentBastionId()", 60000);

            const zoneHost = await driver.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

            expect(result).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "Bastion4PrivateSubnetStandardVnc");

            await toggleSection(tasksTreeSection, false);

            await selectContextMenuItem(ociTreeSection,
                "Bastion4PrivateSubnetStandardVnc", "Refresh When Bastion Reaches Active State");

            await toggleSection(tasksTreeSection, true);

            expect(await existsTreeElement(
                tasksTreeSection, "Refresh Bastion (running)")).to.be.true;

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("Task 'Refresh Bastion' completed successfully") !== -1;
                } catch (e) {
                    return false;
                }

            }, 20000, "Not able to verify that bastion was refreshed successfully");

            expect(await existsTreeElement(
                tasksTreeSection, "Refresh Bastion (done)")).to.be.true;
        });

        it("Delete Bastion", async () => {

            await toggleTreeElement(ociTreeSection, "E2ETESTS*", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection, "E2ETESTS*");
            await toggleTreeElement(ociTreeSection, "Root Compartment*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "QA*", true);
            await waitForLoading(ociTreeSection, 10000);
            await toggleTreeElement(ociTreeSection, "MySQLShellTesting", true);
            await waitForLoading(ociTreeSection, 10000);
            await hasTreeChildren(ociTreeSection,
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(ociTreeSection,
                "Bastion4PrivateSubnetStandardVnc", "Delete Bastion");

            await toggleSection(ociTreeSection, false);
            await toggleSection(tasksTreeSection, true);
            expect(await existsTreeElement(tasksTreeSection, "Delete Bastion (running)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, ociExplicitWait, "No logs were found to check that E2ETESTS profile was loaded");

            const ntf = await waitForNotification();
            expect(await ntf.getMessage()).to.include("Are you sure you want to delete");
            await ntf.takeAction("NO");

            expect(await existsTreeElement(tasksTreeSection, "Delete Bastion (error)")).to.be.true;

            await driver.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("Deletion aborted") !== -1;
                } catch (e) {
                    return false;
                }

            }, explicitWait, "No logs were found to check that Bastion Deletion was aborted");

        });

    });

    describe("MYSQL SHELL CONSOLES - Toolbar action tests", () => {

        before(async function () {
            try {
                await initTreeSection(consolesTreeSection);
                await toggleSection(dbTreeSection, false);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, true);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {

            try {
                await postActions(this);
                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        it("Add a new MySQL Shell Console", async () => {

            const btn = await getLeftSectionButton(consolesTreeSection, "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver.switchTo().defaultContent();

            expect(await existsTreeElement(consolesTreeSection, "Session 1") as Boolean).to.equal(true);

            await selectContextMenuItem(consolesTreeSection, "Session 1",
                "Close this MySQL Shell Console");

            expect(await existsTreeElement(consolesTreeSection, "Session 1")).to.equal(false);

        });

        it("Open MySQL Shell Console Browser", async () => {
            const btn = await getLeftSectionButton(
                consolesTreeSection, "Open MySQL Shell Console Browser");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToWebView();

            expect(await driver.wait(until.elementLocated(By.css("#shellModuleTabview h2")),
                explicitWait, "Title was not found").getText())
                .to.equal("MySQL Shell - GUI Console");

            const newSession = await driver.findElement(By.id("-1"));
            await newSession.click();

            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver.switchTo().defaultContent();

            expect(await existsTreeElement(consolesTreeSection, "Session 1")).to.equal(true);
        });

    });

    describe("MYSQL SHELL CONSOLES - Shell tests", () => {

        before(async function () {
            try {
                await initTreeSection(consolesTreeSection);
                await toggleSection(dbTreeSection, false);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, true);
                await toggleSection(tasksTreeSection, false);

                await toggleBottomBar(false);

                const btn = await getLeftSectionButton(
                    consolesTreeSection, "Add a New MySQL Shell Console");
                await btn.click();

                const editors = await new EditorView().getOpenEditorTitles();
                expect(editors).to.include.members(["MySQL Shell Consoles"]);

                await switchToWebView();

                await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        afterEach(async function () {
            try {
                await postActions(this);
                const textArea = await driver.findElement(By.css("textArea"));
                await enterCmd(textArea, `\\d`);
                await driver.wait(async () => {
                    const text = await getShellServerTabStatus();

                    return text === "The session is not connected to a MySQL server";
                }, explicitWait, "Session tab text is not disconnected");

                await cleanEditor();

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await driver.switchTo().defaultContent();
                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        it("Open multiple sessions", async () => {

            await driver?.switchTo().defaultContent();

            const btn = await getLeftSectionButton(consolesTreeSection, "Add a New MySQL Shell Console");
            await btn.click();

            await switchToWebView();
            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");

            await driver.switchTo().defaultContent();
            expect(await existsTreeElement(consolesTreeSection, "Session 2") as Boolean).to.equal(true);

            await btn.click();
            await switchToWebView();
            await driver.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver.switchTo().defaultContent();
            expect(await existsTreeElement(consolesTreeSection, "Session 3") as Boolean).to.equal(true);

            //SESSION1
            await switchToWebView();
            let editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            let textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}`,
            );

            let result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            //SESSION2
            await driver.switchTo().defaultContent();
            const session2 = await getTreeElement(consolesTreeSection, "Session 2");
            await session2.click();

            await switchToWebView();
            editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}`,
            );

            result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            //SESSION3
            await driver.switchTo().defaultContent();
            const session3 = await getTreeElement(consolesTreeSection, "Session 3");
            await session3.click();

            await switchToWebView();

            editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}`,
            );

            result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

        });

        it("Connect to host", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.port}/${conn.schema}`,
            );

            const result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.port}/${conn.schema}'`,
            );

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema set to \`${conn.schema}\`.`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.port}, using the classic protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

        });

        it("Connect to host without password", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            let uri = `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}`;

            await enterCmd(

                textArea,
                uri);

            await setDBEditorPassword(shellConn);

            await setConfirmDialog(shellConn, "no");

            const result = await shellGetResult();

            uri = `Creating a session to '${String(shellConn.username)}@${String(shellConn.hostname)}:`;
            uri += `${String(shellConn.port)}/${String(shellConn.schema)}'`;

            expect(result).to.include(uri);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema set to \`${String(shellConn.schema)}\`.`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.port}, using the classic protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

        });

        it("Verify help command", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.port}/${conn.schema}`);

            let result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.port}/${conn.schema}'`,
            );

            expect(result).to.include(
                `Default schema set to \`${conn.schema}\`.`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.port}, using the classic protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            await enterCmd(textArea, "\\h");

            result = await shellGetResult();

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

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(textArea, "\\py");

            let result = await shellGetResult();

            expect(result).equals("Switching to Python mode...");

            expect(await shellGetTech(editor)).equals("python");

            await enterCmd(textArea, "\\js");

            result = await shellGetResult();

            expect(result).equals("Switching to JavaScript mode...");

            expect(await shellGetTech(editor)).equals("javascript");

        });

        it("Using db global variable", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}`);

            const result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            expect(result).to.include("(X protocol)");

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema \`${conn.schema}\` accessible through db.`,
            );

            await enterCmd(textArea, "db.actor.select()");

            expect(await shellGetLangResult()).equals("json");

            expect(await isValueOnJsonResult("PENELOPE")).to.be.true;

            expect(await shellGetTotalRows()).to.match(/Query OK, (\d+) rows affected/);

        });

        it("Using shell global variable", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `shell.connect('${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}')`);

            let result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema \`${conn.schema}\` accessible through db`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            await enterCmd(textArea, "shell.status()");

            result = await shellGetResult();

            expect(result).to.match(/MySQL Shell version (\d+).(\d+).(\d+)/);

            expect(result).to.include(`"CONNECTION":"${conn.hostname} via TCP/IP"`);

            expect(result).to.include(`"CURRENT_SCHEMA":"${conn.schema}"`);

            expect(result).to.include(`"CURRENT_USER":"${conn.username}@${conn.hostname}"`);

            expect(result).to.include(`"TCP_PORT":"${conn.portX}"`);

        });

        it("Using mysql mysqlx global variable", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            const cmd = `mysql.getClassicSession('${conn.username}:${conn.password}
                @${conn.hostname}:${conn.port}/${conn.schema}')`;

            await enterCmd(textArea, cmd.replace(/ /g, ""));

            let result = await shellGetResult();

            expect(result).to.include("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            result = await shellGetResult();

            await enterCmd(

                textArea,
                `mysql.getSession('${conn.username}:${conn.password}@${conn.hostname}:${conn.port}/${conn.schema}')`);

            result = await shellGetResult();

            expect(result).to.include("&lt;ClassicSession&gt;");

            await enterCmd(textArea, "shell.disconnect()");

            await enterCmd(

                textArea,
                `mysqlx.getSession('${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}')`);

            result = await shellGetResult();

            expect(result).to.include("&lt;Session&gt;");

        });

        it("Using util global variable", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.port}/${conn.schema}`);

            let result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.port}/${conn.schema}'`);

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.port}, using the classic protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            await enterCmd(

                textArea,
                'util.exportTable("actor", "test.txt")',
            );

            await driver.wait(
                async () => {
                    return (
                        (await shellGetResult()).indexOf(
                            "The dump can be loaded using",
                        ) !== -1
                    );
                },
                10000,
                "Export operation was not done in time",
            );

            result = await shellGetResult();

            expect(result).to.include("Running data dump using 1 thread.");

            expect(result).to.match(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/);

            expect(result).to.match(/Data size: (\d+).(\d+)(\d+) KB/);

            expect(result).to.match(/Rows written: (\d+)/);

            expect(result).to.match(/Bytes written: (\d+).(\d+)(\d+) KB/);

            expect(result).to.match(/Average throughput: (\d+).(\d+)(\d+) KB/);

        });

        it("Verify collections - json format", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/world_x_cst`);

            const result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/world_x_cst'`);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                "Default schema `world_x_cst` accessible through db.",
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include("world_x_cst");

            await enterCmd(textArea, "db.countryinfo.find()");

            expect(await shellGetLangResult()).equals("json");

            expect(await isValueOnJsonResult("Yugoslavia")).to.be.true;

        });

        it("Change schemas using menu", async () => {

            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `\\c ${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}`);

            let result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}`);

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include("no schema selected");

            expect(result).to.include("No default schema selected");

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).equals("no schema selected");

            await driver.findElement(By.id("schema")).click();
            let menuItems = await driver.wait(until.elementsLocated(By.css(".shellPromptSchemaMenu .menuItem .label")),
                explicitWait, ".shellPromptSchemaMenu .menuItem .label did not find anything");
            const schema1 = (await menuItems[0].getText()).substring(1).trim();
            const schema2 = (await menuItems[1].getText()).substring(1).trim();
            await menuItems[0].click();
            await driver.sleep(1000);
            result = await shellGetResult();
            expect(result).equals("Default schema `" + schema1 + "` accessible through db.");

            await driver.findElement(By.id("schema")).click();
            menuItems = await driver.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            await menuItems[1].click();
            await driver.sleep(1000);
            result = await shellGetResult();
            expect(result).equals("Default schema `" + schema2 + "` accessible through db.");

        });

        it("Check query result content", async () => {
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(

                textArea,
                `shell.connect('${conn.username}:${conn.password}@${conn.hostname}:${conn.portX}/${conn.schema}')`);

            const result = await shellGetResult();

            expect(result).to.include(
                `Creating a session to '${conn.username}@${conn.hostname}:${conn.portX}/${conn.schema}'`);

            expect(result).to.match(/Server version: (\d+).(\d+).(\d+)/);

            expect(result).to.include(
                `Default schema \`${conn.schema}\` accessible through db`,
            );

            expect(await getShellServerTabStatus())
                .equals(`Connection to server ${conn.hostname} at port ${conn.portX}, using the X protocol`);

            expect(await getShellSchemaTabStatus())
                .to.include(conn.schema);

            await enterCmd(textArea, "\\sql");

            await enterCmd(textArea, "SHOW DATABASES;");

            expect(await isValueOnDataSet("sakila")).equals(true);

            expect(await isValueOnDataSet("mysql")).equals(true);

            await enterCmd(textArea, "\\js");

            await enterCmd(textArea, "db.category.select()");

            expect(await shellGetLangResult()).equals("json");

            expect(await isValueOnJsonResult("Action")).to.be.true;
        });

    });

    describe("REST API tests", () => {

        let randomService = "";

        before(async function () {
            try {
                await initTreeSection(dbTreeSection);
                await toggleSection(dbTreeSection, true);
                await toggleSection(ociTreeSection, false);
                await toggleSection(consolesTreeSection, false);
                await toggleSection(tasksTreeSection, false);

                let randomCaption = "";
                const connections = await getExistingConnections();
                if (connections.length > 0) {
                    conn.caption = connections[0];
                    randomCaption = connections[0];
                } else {
                    const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                    conn.caption += randomCaption;
                    await createDBconnection(conn);
                    expect(await getDB(conn.caption)).to.exist;
                    const edView = new EditorView();
                    await edView.closeEditor("DB Connections");
                    await reloadSection(dbTreeSection);
                    const el = await getTreeElement(dbTreeSection, conn.caption);
                    expect(el).to.exist;
                }

                await toggleTreeElement(dbTreeSection, conn.caption, true);

                await selectContextMenuItem(dbTreeSection,
                    conn.caption, "Configure MySQL REST Service");

                await toggleSection(tasksTreeSection, true);

                expect(await getTreeElement(
                    tasksTreeSection, "Configure MySQL REST Service (running)")).to.exist;

                const bottomBar = new BottomBarPanel();
                const outputView = await bottomBar.openOutputView();

                await driver.wait(async () => {
                    try {
                        const text = await outputView.getText();

                        return text.indexOf("'Configure MySQL REST Service' completed successfully") !== -1;
                    } catch (e) {
                        return false;
                    }

                }, explicitWait, "Configure MySQL REST Service was not completed");

                await toggleBottomBar(false);

                expect(await getTreeElement(
                    tasksTreeSection, "Configure MySQL REST Service (done)")).to.exist;
                await toggleSection(tasksTreeSection, false);
                const item = await driver.wait(until.elementLocated(By.xpath(
                    "//div[contains(@aria-label, 'MySQL REST Service')]")),
                explicitWait, "MySQL REST Service tree item was not found");
                await driver.wait(until.elementIsVisible(item), explicitWait,
                    "MySQL REST Service tree item was not visible");

                await selectContextMenuItem(
                    dbTreeSection, conn.caption, "Show MySQL System Schemas");

                expect(await existsTreeElement(dbTreeSection, "mysql_rest_service_metadata")).to.be.true;

                await selectContextMenuItem(dbTreeSection,
                    "MySQL REST Service", "Add REST Service...");

                randomService = `Service${randomCaption}`;
                await switchToWebView();
                await setRestService(`/${randomService}`, "", "localhost", true, true, true, true);

                await driver?.switchTo().defaultContent();

                await reloadSection(dbTreeSection);

                await toggleTreeElement(dbTreeSection, "MySQL REST Service", true);

                expect(await existsTreeElement(dbTreeSection, `/${randomService}`)).to.be.true;

                await driver?.switchTo().defaultContent();
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }

        });

        afterEach(async function () {
            try {
                await driver.switchTo().defaultContent();
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await postActions(this);

                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].dismiss();
                }

                const edView = new EditorView();
                const editors = await edView.getOpenEditorTitles();
                for (const editor of editors) {
                    await edView.closeEditor(editor);
                }
            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        after(async function () {
            try {
                await selectContextMenuItem(dbTreeSection,
                    "mysql_rest_service_metadata", "Drop Schema...");

                const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
                if (ntf.length > 0) {
                    await ntf[0].findElement(By.xpath(
                        `//a[contains(@title, 'Drop mysql_rest_service_metadata')]`)).click();
                } else {
                    const dialog = new ModalDialog();
                    await dialog.pushButton(`Drop mysql_rest_service_metadata`);
                }

                const ntfs = await waitForNotification();
                expect(await ntfs.getMessage())
                    .to.include("The object mysql_rest_service_metadata has been dropped successfully.");

            } catch (e) {
                await takeScreenshot(this);
                throw new Error(String(e.stack));
            }
        });

        it("Set as new DEFAULT REST Service", async () => {

            await selectContextMenuItem(dbTreeSection,
                `/${randomService}`, "Set as New Default REST Service");

            const ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include("The MRS service has been set as the new default service.");

            await ntf.dismiss();

            expect(await isDefaultItem(dbTreeSection, "rest", `/${randomService}`)).to.equal(true);
        });

        it("Edit REST Service", async () => {

            await selectContextMenuItem(dbTreeSection,
                `/${randomService}`, "Edit REST Service...");

            await switchToWebView();

            await setRestService(`/edited${randomService}`, "edited", "localhost", false, false, false, false);

            await driver.switchTo().defaultContent();

            await driver.wait(async () => {
                await reloadSection(dbTreeSection);

                return (await existsTreeElement(dbTreeSection, `/edited${randomService}`)) === true;

            }, 3000, `/edited${randomService} was not displayed on the tree`);

            await selectContextMenuItem(dbTreeSection,
                `/edited${randomService}`, "Edit REST Service...");

            await switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                explicitWait, "MRS Service dialog was not displayed");
            const inputServName = await dialog.findElement(By.id("serviceName"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputHost = await dialog.findElement(By.id("hostName"));
            const inputHttps = await dialog.findElement(By.id("protocolHTTPS"));
            const inputHttp = await dialog.findElement(By.id("protocolHTTP"));

            const inputMrsEnabled = await dialog.findElement(By.id("enabled"));

            const httpsClasses = (await inputHttps.getAttribute("class")).split(" ");
            const httpClasses = (await inputHttp.getAttribute("class")).split(" ");

            const mrsEnabledClasses = (await inputMrsEnabled.getAttribute("class")).split(" ");

            expect(await inputServName.getAttribute("value")).equals(`/edited${randomService}`);
            expect(await inputComments.getAttribute("value")).equals("edited");
            expect(await inputHost.getAttribute("value")).equals("localhost");
            expect(httpsClasses).to.include("unchecked");
            expect(httpClasses).to.include("unchecked");

            expect(mrsEnabledClasses).to.include("unchecked");

        });

        it("Add a REST Service Schema", async () => {

            const service = await getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await selectContextMenuItem(dbTreeSection,
                "sakila", "Add Schema to REST Service");

            await switchToWebView();

            await setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");

            await driver.switchTo().defaultContent();

            await reloadSection(dbTreeSection);

            await toggleTreeElement(dbTreeSection, `${service}`, true);

            expect(await existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;

        });

        it("Edit REST Schema", async () => {

            const service = await getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await toggleTreeElement(dbTreeSection, service, true);

            let schema = "";
            try {
                schema = await getFirstTreeChild(dbTreeSection, service);
            } catch (e) {
                await selectContextMenuItem(dbTreeSection,
                    "sakila", "Add Schema to REST Service");

                await switchToWebView();
                const service = await getFirstTreeChild(dbTreeSection, "MySQL REST Service");
                await setRestSchema("sakila", `localhost${service}`, "/sakila", 1, true, true, "sakila");
                await driver.switchTo().defaultContent();
                await reloadSection(dbTreeSection);
                await toggleTreeElement(dbTreeSection, `${service}`, true);
                expect(await existsTreeElement(dbTreeSection, "sakila (/sakila)")).to.be.true;
                schema = "sakila (/sakila)";
            }

            await selectContextMenuItem(dbTreeSection,
                schema, "Edit REST Schema...");

            await switchToWebView();

            await setRestSchema("sakila", `localhost${service}`, "/edited", 5, false, false, "edited");

            await driver.switchTo().defaultContent();

            await reloadSection(dbTreeSection);

            await selectContextMenuItem(dbTreeSection,
                "sakila (/edited)", "Edit REST Schema...");

            await switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

            const inputSchemaName = await dialog.findElement(By.id("name"));
            const inputRequestPath = await dialog.findElement(By.id("requestPath"));
            const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
            const inputEnabled = await dialog.findElement(By.id("enabled"));
            const inputItemsPerPage = await dialog.findElement(By.css("#itemsPerPage input"));
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

            await toggleTreeElement(dbTreeSection, "sakila (/edited)", false);

            await toggleTreeElement(dbTreeSection, "sakila", true);

            await toggleTreeElement(dbTreeSection, "Tables", true);

            await selectContextMenuItem(dbTreeSection,
                "actor", "Add Table to REST Service");

            const input = new InputBox();
            expect(await input.getText()).equals("/actor");
            await input.confirm();

            const ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include(`The Table actor has been added successfully.`);

            await ntf.dismiss();

            await toggleTreeElement(dbTreeSection, "sakila (/edited)", true);

            expect(await existsTreeElement(dbTreeSection, "actor (/actor)")).to.be.true;
        });

        it("Delete REST Schema", async () => {

            const service = await getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await toggleTreeElement(dbTreeSection, service, true);

            const schema = await getFirstTreeChild(dbTreeSection, service);

            await selectContextMenuItem(dbTreeSection,
                schema, "Delete REST Schema...");

            let ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include(`Are you sure the MRS schema sakila should be deleted?`);

            await ntf.takeAction("Yes");

            ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include(`The MRS schema has been deleted successfully.`);

            await ntf.dismiss();

            await reloadSection(dbTreeSection);

            expect(await existsTreeElement(dbTreeSection, schema)).to.be.false;

        });

        it("Delete REST Service", async () => {

            const service = await getFirstTreeChild(dbTreeSection, "MySQL REST Service");

            await selectContextMenuItem(dbTreeSection,
                service, "Delete REST Service...");

            let ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include(`Are you sure the MRS service ${service} should be deleted?`);

            await ntf.takeAction("Yes");

            ntf = await waitForNotification();

            expect(await ntf.getMessage())
                .to.include(`The MRS service has been deleted successfully.`);

            await ntf.dismiss();

            await driver.wait(async () => {
                await reloadSection(dbTreeSection);

                return (await existsTreeElement(dbTreeSection, service)) === false;

            }, 3000, `${service} is still displayed on the tree`);

        });
    });

});
