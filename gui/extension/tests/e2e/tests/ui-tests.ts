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
    WebDriver,
    By,
    EditorView,
    Workbench,
    OutputView,
    ActivityBar,
    until,
    BottomBarPanel,
    InputBox,
    Key as seleniumKey,
    TextEditor,
    ModalDialog,
    WebElement,
    Key,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import addContext from "mochawesome/addContext";
import fs from "fs/promises";

import { expect } from "chai";
import {
    createDBconnection,
    getLeftSection,
    getLeftSectionButton,
    IDbConnection,
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
    initTree,
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
    getDriver,
    switchToFrame,
    shellGetResult,
    shellGetResultTable,
    cleanEditor,
    shellGetTech,
    shellGetTotalRows,
    shellGetLangResult,
    isValueOnDataSet,
    reloadConnection,
} from "../lib/helpers";

import { ChildProcess } from "child_process";
import { homedir, platform } from "os";
import { join } from "path";

describe("MySQL Shell for VS Code", () => {
    let driver!: WebDriver | undefined;

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

    const conn: IDbConnection = {
        caption: "conn",
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
    };

    const shellConn: IDbConnection = {
        caption: "shellConn",
        description: "Local connection for shell",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBSHELLUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBSHELLPASSWORD),
    };

    before(async function () {
        driver = await getDriver();
        try {
            await driver!.wait(async () => {
                const activityBar = new ActivityBar();
                const controls = await activityBar.getViewControls();
                for (const control of controls) {
                    if (await control.getTitle() === "MySQL Shell for VSCode") {
                        await control.openView();

                        return true;
                    }
                }
            }, 10000, "Could not find MySQL Shell for VSCode on Activity Bar");

            await waitForExtensionChannel(driver!);
            await reloadVSCode(driver!);
            await waitForExtensionChannel(driver!);

            if (!(await isCertificateInstalled(driver!))) {
                throw new Error("Please install the certificate");
            }
        } catch(e) {
            const img = await driver!.takeScreenshot();
            try {
                await fs.access("tests/e2e/screenshots");
            } catch (e) {
                await fs.mkdir("tests/e2e/screenshots");
            }
            const imgPath = `tests/e2e/screenshots/beforeAll_MySQL Shell for VS Code_screenshot.png`;
            await fs.writeFile(imgPath, img, "base64");

            addContext(this, { title: "Failure", value: `../${imgPath}` });
            throw new Error(String(e.stack));
        }

    });

    describe("DATABASE - Toolbar action tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("DATABASE");
            }
        });

        afterEach(async function () {
            await postActions(driver!, this);

            await driver!.switchTo().defaultContent();
            const edView = new EditorView();
            await edView.closeAllEditors();
        });

        it("Create and delete a Database connection", async () => {
            let flag = false;
            try {
                await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
                await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
                await toggleSection(driver!, "MYSQL SHELL TASKS", false);

                conn.caption += String(new Date().valueOf());
                await createDBconnection(driver!, conn);
                flag = true;
                expect(await getDB(driver!, conn.caption)).to.exist;
                await reloadSection(driver!, "DATABASE");
                expect(await getTreeElement(driver!, "DATABASE", conn.caption)).to.exist;
            } catch (e) {
                throw new Error(String(e.stack));
            } finally {
                if (flag) {
                    await deleteDBConnection(driver!, conn.caption);
                }
            }
        });

        it("Open DB Connection Browser", async () => {

            const openConnBrw = await getLeftSectionButton(driver!, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();

            const editorView = new EditorView();
            const editor = await editorView.openEditor("SQL Connections");
            expect(await editor.getTitle()).to.equal("SQL Connections");

            await switchToFrame(driver!, "SQL Connections");

            expect(
                await driver!.findElement(By.id("title")).getText(),
            ).to.equal("MySQL Shell - DB Editor");

            expect(
                await driver!
                    .findElement(By.id("contentTitle"))
                    .getText(),
            ).to.equal("Database Connections");

            expect(
                await driver!
                    .findElements(
                        By.css("#tilesHost button"),
                    ),
            ).to.have.lengthOf.at.least(1);

            await driver!.switchTo().defaultContent();

            const edView = new EditorView();
            await edView.closeEditor("SQL Connections");

        });

        // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34200753
        it.skip("Connect to external MySQL Shell process", async () => {
            let prc: ChildProcess;
            try {
                prc = await startServer(driver!);
                await selectMoreActionsItem(driver!, "DATABASE", "Connect to External MySQL Shell Process");
                const input = new InputBox();
                await input.setText("http://localhost:8500");
                await input.confirm();

                let serverOutput = "";
                prc!.stdout!.on("data", (data) => {
                    serverOutput += data as String;
                });

                await driver!.wait(() => {
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

            await selectMoreActionsItem(driver!, "DATABASE", "Restart the Internal MySQL Shell Process");

            const dialog = await driver!.wait(until.elementLocated(By.css(".notification-toast-container")),
                3000, "Restart dialog was not found");

            const restartBtn = await dialog.findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]"));
            await restartBtn.click();
            await driver!.wait(until.stalenessOf(dialog), 3000, "Restart MySQL Shell dialog is still displayed");

            try {
                await driver!.wait(async () => {
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
                await bottomBar.toggle(false);
            }
        });

        it("Relaunch Welcome Wizard", async () => {

            await selectMoreActionsItem(driver!, "DATABASE", "Relaunch Welcome Wizard");

            const editor = new EditorView();
            const titles = await editor.getOpenEditorTitles();

            expect(titles).to.include.members(["Welcome to MySQL Shell"]);
            const active = await editor.getActiveTab();
            expect(await active?.getTitle()).equals("Welcome to MySQL Shell");

            await driver!.switchTo().frame(0);
            await driver!.switchTo().frame(await driver!.findElement(By.id("active-frame")));

            const text = await driver!.findElement(By.css("#page1 h3")).getText();
            expect(text).equals("Welcome to MySQL Shell for VS Code.");
            expect(await driver!.findElement(By.id("nextBtn"))).to.exist;
            await driver!.switchTo().defaultContent();
        });

    });

    describe("DATABASE - Context menu tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("DATABASE");
            }

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

            const randomCaption = String(new Date().valueOf());
            conn.caption += randomCaption;
            await createDBconnection(driver!, conn);
            expect(await getDB(driver!, conn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeEditor("SQL Connections");
            await reloadSection(driver!, "DATABASE");
            const el = await getTreeElement(driver!, "DATABASE", conn.caption);
            expect(el).to.exist;

        });

        afterEach(async function () {

            await postActions(driver!, this);

            await driver!.switchTo().defaultContent();
            await toggleTreeElement(driver!, "DATABASE", conn.caption, false);
            await toggleSection(driver!, "DATABASE", true);
            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            for (const editor of editors) {
                await edView.closeEditor(editor);
            }
        });

        it("Connection Context Menu - Open DB Connection", async () => {

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection", "Open DB Connection");

            await new EditorView().openEditor(conn.caption);

            await switchToFrame(driver!, conn.caption);

            const item = await driver!.findElement(By.css(".zoneHost"));
            expect(item).to.exist;
            await driver!.switchTo().defaultContent();

        });

        it("Connection Context Menu - Open DB Connection in New Tab", async () => {

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open DB Connection");

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
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

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            const item = await driver!.wait(until
                .elementLocated(By.css("code > span")), 10000, "MySQL Shell Console was not loaded");
            expect(await item.getText()).to.contain("Welcome to the MySQL Shell - GUI Console");
            await driver!.switchTo().defaultContent();

            await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);
            expect(await getTreeElement(driver!,
                "ORACLE CLOUD INFRASTRUCTURE", "Session to " + conn.caption)).to.exist;

        });

        it("Connection Context Menu - Edit MySQL connection", async () => {
            const aux = conn.caption;
            try {
                conn.caption = `toEdit${String(new Date().valueOf())}`;
                await createDBconnection(driver!, conn);
                expect(await getDB(driver!, conn.caption)).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("SQL Connections");
                await reloadSection(driver!, "DATABASE");

                await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection", "Edit MySQL Connection");

                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                expect(editors.includes("SQL Connections")).to.be.true;

                await switchToFrame(driver!, "SQL Connections");

                const newConDialog = await driver!.findElement(By.css(".valueEditDialog"));
                await driver!.wait(async () => {
                    await newConDialog.findElement(By.id("caption")).clear();

                    return !(await driver!.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");

                const edited = `edited${String(new Date().valueOf())}`;
                await newConDialog.findElement(By.id("caption")).sendKeys(edited);
                const okBtn = await driver!.findElement(By.id("ok"));
                await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();
                await driver!.switchTo().defaultContent();

                await driver!.wait(async () => {
                    await reloadSection(driver!, "DATABASE");
                    try {
                        await getTreeElement(driver!, "DATABASE", edited);

                        return true;
                    } catch (e) { return false; }
                }, 5000, "Database was not updated");

            } catch (e) { throw new Error(String(e.stack)); } finally { conn.caption = aux; }

        });

        it("Connection Context Menu - Duplicate this MySQL connection", async () => {

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Duplicate this MySQL Connection");

            const editorView = new EditorView();
            const editors = await editorView.getOpenEditorTitles();
            expect(editors.includes("SQL Connections")).to.be.true;

            await switchToFrame(driver!, "SQL Connections");

            const dialog = await driver!.wait(until.elementLocated(
                By.css(".valueEditDialog")), 5000, "Connection dialog was not found");
            await dialog.findElement(By.id("caption")).sendKeys("Dup");
            const okBtn = await driver!.findElement(By.id("ok"));
            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver!.switchTo().defaultContent();

            await driver!.wait(async () => {
                await reloadSection(driver!, "DATABASE");
                const db = await getLeftSection(driver!, "DATABASE");

                return (await db?.findElements(By.xpath("//div[contains(@aria-label, 'Dup')]")))!.length === 1;
            }, 10000, "Duplicated database was not found");

        });

        it("Connection Context Menu - Configure MySQL REST Service and Show MySQL System Schemas", async () => {

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);

            await selectContextMenuItem(driver!, "DATABASE",
                conn.caption, "connection", "Configure MySQL REST Service");

            await toggleSection(driver!, "MYSQL SHELL TASKS", true);

            expect(await getTreeElement(driver!,
                "MYSQL SHELL TASKS", "Configure MySQL REST Service (running)")).to.exist;

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();

            await driver!.wait(async () => {
                try {
                    const text = await outputView.getText();

                    return text.indexOf("'Configure MySQL REST Service' completed successfully") !== -1;
                } catch (e) {
                    return false;
                }

            }, 5000, "Configure MySQL REST Service was not completed");

            await bottomBar.toggle(false);

            expect(await getTreeElement(driver!, "MYSQL SHELL TASKS", "Configure MySQL REST Service (done)")).to.exist;
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);
            const item = await driver!.wait(until.elementLocated(By.xpath(
                "//div[contains(@aria-label, 'MySQL REST Service')]")),
            5000, "MySQL REST Service tree item was not found");
            await driver!.wait(until.elementIsVisible(item), 5000, "MySQL REST Service tree item was not visible");

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection", "Show MySQL System Schemas");

            await toggleTreeElement(driver!, "DATABASE", "mysql_rest_service_metadata", true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            try {
                expect(await getTreeElement(driver!, "DATABASE", "audit_log")).to.exist;
                expect(await getTreeElement(driver!, "DATABASE", "auth_app")).to.exist;
                expect(await getTreeElement(driver!, "DATABASE", "auth_user")).to.exist;
            } catch (e) {
                throw new Error(String(e.stack));
            } finally {
                await toggleTreeElement(driver!, "DATABASE", "Tables", false);
                await toggleTreeElement(driver!, "DATABASE", "mysql_rest_service_metadata", false);
            }

        });

        it("Schema Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            let editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", conn.schema, "schema",
                "Copy To Clipboard -> Name");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            let textArea = await editor.findElement(By.css("textarea"));

            if (platform() === "darwin") {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
            } else {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
            }

            let textAreaValue = await textArea.getAttribute("value");
            expect(textAreaValue).to.contain(conn.schema);

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", conn.schema, "schema",
                "Copy To Clipboard -> Create Statement");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
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
            expect(textAreaValue).to.contain("CREATE DATABASE");

            await driver!.switchTo().defaultContent();

        });

        it("Schema Context Menu - Drop Schema", async () => {

            const random = String(new Date().valueOf());
            const testSchema = `testschema${random}`;

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, `create schema ${testSchema};`);

            const zoneHost = await driver!.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css(".resultHost span span")).getText();
            expect(result).to.contain("OK");

            await driver!.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(driver!, conn.caption);

                return existsTreeElement(driver!, "DATABASE", testSchema);
            }, 5000, `${testSchema} was not found`);

            await selectContextMenuItem(driver!, "DATABASE", testSchema, "schema", "Drop Schema...");

            const ntf = await driver!.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testSchema}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testSchema}`);
            }

            const msg = await driver!.findElement(By.css(".notification-list-item-message > span"));
            await driver!.wait(until.elementTextIs(msg,
                `The object ${testSchema} has been dropped successfully.`), 3000, "Text was not found");

            await driver!.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await getLeftSection(driver!, "DATABASE");
            await reloadSection(driver!, "DATABASE");
            await driver!.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testSchema}') and contains(@role, 'treeitem')]`)))!.length === 0;
            }, 5000, `${testSchema} is still on the list`);

        });

        it("Table Context Menu - Show Data", async () => {

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            await selectContextMenuItem(driver!, "DATABASE", "actor", "table", "Show Data...");

            const ed = new EditorView();
            const activeTab = await ed.getActiveTab();
            expect(await activeTab!.getTitle()).equals(conn.caption);

            await switchToFrame(driver!, conn.caption);

            const resultHost = await driver!.wait(until.elementLocated(
                By.css(".resultHost")), 20000, "query results were not found");

            const resultStatus = await resultHost.findElement(By.css(".resultStatus label"));
            expect(await resultStatus.getText()).to.match(new RegExp(/OK, (\d+) records/));

        });

        it("Table Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            let editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", "actor", "table",
                "Copy To Clipboard -> Name");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            let textArea = await editor.findElement(By.css("textarea"));

            if (platform() === "darwin") {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
            } else {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
            }

            let textAreaValue = await textArea.getAttribute("value");
            expect(textAreaValue).to.contain("actor");

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", "actor", "table",
                "Copy To Clipboard -> Create Statement");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
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
            expect(textAreaValue).to.contain("idx_actor_last_name");

            await driver!.switchTo().defaultContent();

        });

        it("Table Context Menu - Drop Table", async () => {

            const random = String(new Date().valueOf());
            const testTable = `testtable${random}`;

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, `use ${conn.schema};`);

            let zoneHost = await driver!.findElements(By.css(".zoneHost"));
            let result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getAttribute("innerHTML");
            expect(result).to.contain(`Default schema set to \`${conn.schema}\`.`);

            const prevZoneHosts = await driver!.findElements(By.css(".zoneHost"));

            await enterCmd(driver!, textArea, `create table ${testTable} (id int, name VARCHAR(50));`);

            await driver!.wait(async () => {
                return (await driver!.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
            }, 7000, "New results block was not found");

            zoneHost = await driver!.findElements(By.css(".zoneHost"));
            result = await zoneHost[zoneHost.length - 1]
                .findElement(By.css(".resultHost span span")).getAttribute("innerHTML");
            expect(result).to.contain("OK");

            await driver!.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(driver!, conn.caption);

                return existsTreeElement(driver!, "DATABASE", testTable);
            }, 5000, `${testTable} was not found`);

            await selectContextMenuItem(driver!, "DATABASE", testTable, "table", "Drop Table...");

            const ntf = await driver!.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testTable}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testTable}`);
            }

            const msg = await driver!.findElement(By.css(".notification-list-item-message > span"));
            await driver!.wait(until.elementTextIs(msg,
                `The object ${testTable} has been dropped successfully.`), 3000, "Text was not found");

            await driver!.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await getLeftSection(driver!, "DATABASE");
            await reloadSection(driver!, "DATABASE");

            await driver!.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    "//div[contains(@aria-label, 'testTable') and contains(@role, 'treeitem')]")))!.length === 0;
            }, 5000, `${testTable} is still on the list`);

        });

        // reason: feature under dev
        it.skip("Table Context Menu - Add Table to REST Service", async () => {

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);

            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "table", "Add Table to REST Service");

            const input = new InputBox();
            expect(await input.getText()).equals("/actor");
            await input.confirm();

            await toggleTreeElement(driver!, "DATABASE", "MySQL REST Service", true);

        });

        it("View Context Menu - Show Data", async () => {
            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Views", true);

            await selectContextMenuItem(driver!, "DATABASE", "test_view", "view", "Show Data...");

            const ed = new EditorView();
            const activeTab = await ed.getActiveTab();
            expect(await activeTab!.getTitle()).equals(conn.caption);

            await switchToFrame(driver!, conn.caption);

            const resultHost = await driver!.wait(until.elementLocated(
                By.css(".resultHost")), 20000, "query results were not found");

            const resultStatus = await resultHost.findElement(By.css(".resultStatus label"));
            expect(await resultStatus.getText()).to.match(new RegExp(/OK, (\d+) records/));
        });

        it("View Context Menu - Copy name and create statement to clipboard", async () => {
            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Views", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            let editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", "test_view", "view",
                "Copy To Clipboard -> Name");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            let textArea = await editor.findElement(By.css("textarea"));

            if (platform() === "darwin") {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.COMMAND, "v"));
            } else {
                await textArea.sendKeys(seleniumKey.chord(seleniumKey.CONTROL, "v"));
            }

            let textAreaValue = await textArea.getAttribute("value");
            expect(textAreaValue).to.contain("test_view");

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "DATABASE", "test_view", "view",
                "Copy To Clipboard -> Create Statement");

            await switchToFrame(driver!, "MySQL Shell Consoles");

            editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
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
            expect(textAreaValue).to.contain("DEFINER VIEW");

            await driver!.switchTo().defaultContent();

        });

        it("View Context Menu - Drop View", async () => {
            await selectContextMenuItem(driver!, "DATABASE", conn.caption, "connection",
                "Open MySQL Shell GUI Console for this Connection");

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Views", true);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await setEditorLanguage(driver!, "sql");
            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, `use ${conn.schema};`);

            let zoneHost = await driver!.findElements(By.css(".zoneHost"));
            let result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getAttribute("innerHTML");
            expect(result).to.contain(`Default schema set to \`${conn.schema}\`.`);

            const random = String(new Date().valueOf());
            const testView = `testview${random}`;

            const prevZoneHosts = await driver!.findElements(By.css(".zoneHost"));

            await enterCmd(driver!, textArea, `CREATE VIEW ${testView} as select * from sakila.actor;`);

            await driver!.wait(async () => {
                return (await driver!.findElements(By.css(".zoneHost"))).length > prevZoneHosts.length;
            }, 7000, "New results block was not found");

            zoneHost = await driver!.findElements(By.css(".zoneHost"));
            result = await zoneHost[zoneHost.length - 1]
                .findElement(By.css(".resultHost span span")).getAttribute("innerHTML");
            expect(result).to.contain("OK");

            await driver!.switchTo().defaultContent();

            await driver?.wait(async () => {
                await reloadConnection(driver!, conn.caption);

                return existsTreeElement(driver!, "DATABASE", testView);
            }, 5000, `${testView} was not found`);

            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conn.schema, true);
            await toggleTreeElement(driver!, "DATABASE", "Views", true);

            await selectContextMenuItem(driver!, "DATABASE", testView, "view", "Drop View...");

            const ntf = await driver!.findElements(By.css(".notifications-toasts.visible"));
            if (ntf.length > 0) {
                await ntf[0].findElement(By.xpath(`//a[contains(@title, 'Drop ${testView}')]`)).click();
            } else {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Drop ${testView}`);
            }

            const msg = await driver!.findElement(By.css(".notification-list-item-message > span"));
            await driver!.wait(until.elementTextIs(msg,
                `The object ${testView} has been dropped successfully.`), 3000, "Text was not found");

            await driver!.wait(until.stalenessOf(msg), 7000, "Drop message dialog was not displayed");

            const sec = await getLeftSection(driver!, "DATABASE");
            await reloadSection(driver!, "DATABASE");

            await driver!.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    `//div[contains(@aria-label, '${testView}') and contains(@role, 'treeitem')]`)))!.length === 0;
            }, 5000, `${testView} is still on the list`);

        });

    });

    describe("DATABASE - DB Editor connection tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("DATABASE");
            }

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

            const randomCaption = String(new Date().valueOf());
            conn.caption += randomCaption;
            await createDBconnection(driver!, conn);
            expect(await getDB(driver!, conn.caption)).to.exist;
        });

        beforeEach(async () => {
            const openConnBrw = await getLeftSectionButton(driver!, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();
            await switchToFrame(driver!, "SQL Connections");
        });

        afterEach(async function () {

            await driver!.switchTo().defaultContent();

            await postActions(driver!, this);
            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            for (const editor of editors) {
                await edView.closeEditor(editor);
            }
        });

        it("Store and clear password", async () => {

            let host = await getDB(driver!, conn.caption, false);
            await driver!.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
            );

            let contextMenu = await driver!.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            await driver!.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            let conDialog = await driver!.findElement(By.css(".valueEditDialog"));
            await conDialog.findElement(By.id("storePassword")).click();
            const savePassDialog = await driver!.findElement(By.css(".visible.passwordDialog"));
            await savePassDialog.findElement(By.css("input")).sendKeys(conn.password);
            await savePassDialog.findElement(By.id("ok")).click();

            await driver!.executeScript(
                "arguments[0].click();",
                await getDB(driver!, conn.caption, false),
            );

            expect(await isDBConnectionSuccessful(driver!, conn.caption)).to.be.true;

            await closeDBconnection(driver!, conn.caption);

            const openConnBrw = await getLeftSectionButton(driver!, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();

            await switchToFrame(driver!, "SQL Connections");

            host = await getDB(driver!, conn.caption, false);

            await driver!.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
            );

            contextMenu = await driver!.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            await driver!.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            conDialog = await driver!.findElement(By.css(".valueEditDialog"));
            await conDialog.findElement(By.id("clearPassword")).click();
            await conDialog.findElement(By.id("ok")).click();

            await driver!.executeScript(
                "arguments[0].click();",
                await getDB(driver!, conn.caption, false),
            );

            expect(await driver!.findElement(By.css(".passwordDialog"))).to.exist;

        });

        it("Confirm dialog - Save password", async () => {

            await driver!.executeScript(
                "arguments[0].click();",
                await getDB(driver!, conn.caption, false),
            );

            await setDBEditorPassword(driver!, conn);

            await setConfirmDialog(driver!, conn, "yes");

            expect(await isDBConnectionSuccessful(driver!, conn.caption))
                .to.be.true;

            await closeDBconnection(driver!, conn.caption);

            const openConnBrw = await getLeftSectionButton(driver!, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();

            await switchToFrame(driver!, "SQL Connections");

            await driver!.executeScript(
                "arguments[0].click();",
                await getDB(driver!, conn.caption, false),
            );

            expect(await isDBConnectionSuccessful(driver!, conn.caption))
                .to.be.true;
        });

        it("Edit a database connection and verify errors", async () => {
            const host = await getDB(driver!, conn.caption, false);
            await driver!.executeScript(
                "arguments[0].click();",
                await host.findElement(By.id("triggerTileAction")),
            );

            const contextMenu = await driver!.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            await driver!.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            const conDialog = await driver!.findElement(By.css(".valueEditDialog"));

            const customClear = async (el: WebElement) => {
                const textLength = (await el.getAttribute("value")).length;
                for (let i = 0; i <= textLength - 1; i++) {
                    await el.sendKeys(Key.BACK_SPACE);
                    await driver!.sleep(100);
                }
            };

            await customClear(await conDialog.findElement(By.id("caption")));

            const okBtn = await conDialog.findElement(By.id("ok"));
            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const error = await driver!.wait(
                until.elementLocated(By.css("label.error")),
                2000,
            );

            expect(await error.getText()).to.equals("The caption cannot be empty");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

            await customClear(await conDialog.findElement(By.id("hostName")));

            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .to.equals("Specify a valid host name or IP address");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

            await customClear(await conDialog.findElement(By.id("userName")));

            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver!.findElement(By.id("ok")).click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .to.equals("The user name must not be empty");

            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            expect(await conDialog.findElement(By.id("ok")).isEnabled()).to.be.false;

            await driver!.findElement(By.id("cancel")).click();
        });

        it("Connect to SQLite database", async () => {
            await driver!
                .findElement(By.css(".connectionBrowser"))
                .findElement(By.id("-1"))
                .click();
            const newConDialog = await driver!.findElement(By.css(".valueEditDialog"));
            await selectDatabaseType(driver!, "Sqlite");
            await driver!.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver!.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `Sqlite DB${String(new Date().valueOf())}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(conName);

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

            const sqliteConn = await getDB(driver!, conName, false);
            expect(sqliteConn).to.exist;
            expect(await sqliteConn.findElement(By.css(".tileDescription")).getText()).to.equals(
                "Local Sqlite connection",
            );

            await driver!.executeScript(
                "arguments[0].click();",
                sqliteConn,
            );

            expect(await isDBConnectionSuccessful(driver!, conName)).to.be.true;

            await driver!.switchTo().defaultContent();
            await toggleTreeElement(driver!, "DATABASE", conn.caption, true);
            await toggleTreeElement(driver!, "DATABASE", conName, true);
            await toggleTreeElement(driver!, "DATABASE", "main", true);
            await toggleTreeElement(driver!, "DATABASE", "Tables", true);
            await hasTreeChildren(driver!, "DATABASE", "Tables", "db_connection");

            await selectContextMenuItem(driver!, "DATABASE", "db_connection", "table", "Show Data...");

            await switchToFrame(driver!, "SQL Connections");

            const result = await driver!.findElement(By.css(".zoneHost label.label"));
            expect(await result.getText()).to.contain("OK");
        });

        it("Connect to MySQL database using SSL", async () => {
            await driver!
                .findElement(By.css(".connectionBrowser"))
                .findElement(By.id("-1"))
                .click();

            const newConDialog = await driver!.findElement(By.css(".valueEditDialog"));
            await driver!.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver!.executeScript("return document.querySelector('#caption').value"));
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
                .sendKeys(String(conn.hostname));

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(String(conn.username));

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(String(conn.schema));

            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver!.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id("Require and Verify CA")).click();
            expect(await newConDialog.findElement(By.css("#sslMode label")).getText())
                .to.equals("Require and Verify CA");

            const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
            await paths[0].sendKeys(`${String(process.env.SSLCERTSPATH)}/ca-cert.pem`);
            await paths[1].sendKeys(`${String(process.env.SSLCERTSPATH)}/client-cert.pem`);
            await paths[2].sendKeys(`${String(process.env.SSLCERTSPATH)}/client-key.pem`);

            const okBtn = await driver!.findElement(By.id("ok"));
            await driver!.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const dbConn = await getDB(driver!, conName, false);
            expect(dbConn).to.exist;

            await driver!.executeScript(
                "arguments[0].click();",
                dbConn,
            );

            try {
                await setDBEditorPassword(driver!, conn);
                await setConfirmDialog(driver!, conn, "yes");
            } catch (e) {
                //continue
            }

            expect(await isDBConnectionSuccessful(driver!, conName)).to.be.true;

            const contentHost = await driver!.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

            const execSel = await getToolbarButton(driver!, "Execute selection or full script");
            await execSel?.click();

            const resultHost = await driver!.findElement(By.css(".resultHost"));
            const result = await resultHost.findElement(By.css(".resultStatus label"));
            expect(await result.getText()).to.contain("1 record retrieved");

            expect( await resultHost.findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]")) ).to.exist;
        });

    });

    describe("DATABASE - DB Editor tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("DATABASE");
            }

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

            const randomCaption = String(new Date().valueOf());
            conn.caption += randomCaption;
            await createDBconnection(driver!, conn);
            const openConnBrw = await getLeftSectionButton(driver!, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();

            await switchToFrame(driver!, "SQL Connections");

            await driver!.executeScript(
                "arguments[0].click();",
                await getDB(driver!, conn.caption, false),
            );

        });

        afterEach(async function () {
            await postActions(driver!, this);
            await pressEnter(driver!);
            await driver!.wait(async() => {
                return hasNewPrompt(driver!);
            }, 3000, "New prompt was not displayed");
        });

        after(async () => {
            await driver!.switchTo().defaultContent();
        });

        it("Multi-cursor", async () => {

            await writeSQL(driver!, "select * from sakila.actor;");
            await driver!.actions().sendKeys(Key.ENTER).perform();
            await writeSQL(driver!, "select * from sakila.address;");
            await driver!.actions().sendKeys(Key.ENTER).perform();
            await writeSQL(driver!, "select * from sakila.city;");

            await driver!.actions().keyDown(Key.ALT).perform();

            const lines = await driver!.findElements(By.css("#contentHost .editorHost .view-line"));
            lines.shift();
            let spans = await lines[0].findElements(By.css("span"));
            await spans[spans.length - 1].click();

            spans = await lines[1].findElements(By.css("span"));
            await spans[spans.length - 1].click();
            await driver!.actions().keyUp(Key.ALT).perform();

            await driver!.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver!.sleep(1000);
            await driver!.actions().sendKeys(Key.BACK_SPACE).perform();
            await driver!.sleep(1000);
            await driver!.actions().sendKeys(Key.BACK_SPACE).perform();

            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            let items = (await textArea.getAttribute("value")).split("\n");
            items.shift();
            expect(items[0].length).equals(24);
            expect(items[1].length).equals(26);
            expect(items[2].length).equals(23);

            await textArea.sendKeys("testing");

            items = (await textArea.getAttribute("value")).split("\n");
            items.shift();
            expect(items[0]).to.contain("testing");
            expect(items[1]).to.contain("testing");
            expect(items[2]).to.contain("testing");

        });

        it("Using a DELIMITER", async () => {

            await setDBEditorLanguage(driver!, "sql");

            let text = `
                DELIMITER $$
                    select 2 $$
                select 1
                `;

            text = text.trim();
            await writeSQL(driver!, text);

            await driver!.wait(async () => {
                return (await driver!.findElements(By.css(".statementStart"))).length > 1;
            }, 5000, "No blue dots were found");

            const lines = await driver!.findElements(By
                .css("#contentHost .editorHost div.margin-view-overlays > div"));

            expect(await lines[lines.length-1].findElement(By.css(".statementStart"))).to.exist;
            expect(await lines[lines.length-2].findElement(By.css(".statementStart"))).to.exist;
            expect(await lines[lines.length-3].findElement(By.css(".statementStart"))).to.exist;

            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ENTER);

            await driver!.wait(async () => {
                return (await driver!.findElements(
                    By.css("#contentHost .editorHost div.margin-view-overlays > div"))).length > lines.length;
            }, 10000, "A new line was not found");

            await driver!.wait(async () => {
                try {
                    const lines = await driver!.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                    return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length === 0;
                } catch (e) {
                    return false;
                }
            }, 5000, "Line 2 has the statement start");

            await textArea.sendKeys("select 1");

            await driver!.wait(async () => {
                try {
                    const lines = await driver!.findElements(
                        By.css("#contentHost .editorHost div.margin-view-overlays > div"));

                    return (await lines[lines.length-2].findElements(By.css(".statementStart"))).length > 0;
                } catch (e) {
                    return false;
                }
            }, 5000, "Line 2 does not have the statement start");

        });

        it("Connection toolbar buttons - Execute selection or full block", async () => {
            const contentHost = await driver!.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM ACTOR;");

            const lastId = await getLastQueryResultId(driver!);

            const execSel = await getToolbarButton(driver!, "Execute selection or full script");
            await execSel?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver!, true)).to.match(new RegExp(/(\d+) record/));
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {
            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            await writeSQL(driver!, "select * from sakila.actor;");
            await textArea.sendKeys(Key.RETURN);

            await writeSQL(driver!, "select * from sakila.address;");
            await textArea.sendKeys(Key.RETURN);

            await writeSQL(driver!, "select * from sakila.category;");

            await driver!.wait(async () => {
                return (await driver!.findElements(By.css(".statementStart"))).length >= 3;
            }, 5000, "Statement start (blue dot) was not found on all lines");

            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);

            let lastId = await getLastQueryResultId(driver!);
            let execCaret = await getToolbarButton(driver!, "Execute the statement at the caret position");
            await execCaret?.click();
            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver!, "address_id", 3)).to.exist;

            await textArea.sendKeys(Key.ARROW_UP);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);
            await textArea.sendKeys(Key.ARROW_LEFT);

            lastId = await getLastQueryResultId(driver!);
            execCaret = await getToolbarButton(driver!, "Execute the statement at the caret position");
            await execCaret?.click();

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver!, "actor_id", 3)).to.exist;

            await textArea.sendKeys(Key.ARROW_DOWN);
            await textArea.sendKeys(Key.ARROW_DOWN);

            lastId = await getLastQueryResultId(driver!);
            execCaret = await getToolbarButton(driver!, "Execute the statement at the caret position");
            await execCaret?.click();
            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultColumnName(driver!, "category_id", 3)).to.exist;

        });

        it("Connect to database and verify default schema", async () => {
            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));
            await enterCmd(driver!, textArea, "SELECT SCHEMA();");

            const resultHosts = await driver!.findElements(By.css(".resultHost"));
            const lastResult = resultHosts[resultHosts.length-1];
            const result = await lastResult.findElement(By.css(".resultStatus label"));
            expect(await result.getText()).to.contain("1 record retrieved");

            const zoneHosts = await driver!.findElements(By.css(".zoneHost"));
            expect( await (await zoneHosts[zoneHosts.length-1].findElement(By.css(".tabulator-cell"))).getText() )
                .to.equals(conn.schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {
            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            const autoCommit = await getToolbarButton(driver!, "Auto commit DB changes");
            await autoCommit?.click();

            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);

            await enterCmd(driver!, textArea,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}')`);

            const commitBtn = await getToolbarButton(driver!, "Commit DB changes");
            const rollBackBtn = await getToolbarButton(driver!, "Rollback DB changes");

            await driver!.wait(until.elementIsEnabled(commitBtn!),
                3000, "Commit button should be enabled");

            await driver!.wait(until.elementIsEnabled(rollBackBtn!),
                3000, "Commit button should be enabled");

            const execSelNew = await getToolbarButton(driver!,
                "Execute selection or full block and create a new block");
            await execSelNew?.click();

            let resultHosts = await driver!.findElements(By.css(".resultHost"));
            let lastResult = resultHosts[resultHosts.length-1];
            let result = await lastResult.findElement(By.css(".resultText span"));
            expect(await result.getText()).to.contain("OK");

            await rollBackBtn!.click();

            await enterCmd(driver!, textArea, `SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            resultHosts = await driver!.findElements(By.css(".resultHost"));
            lastResult = resultHosts[resultHosts.length-1];
            result = await lastResult.findElement(By.css(".resultText span"));
            expect(await result.getAttribute("innerHTML")).to.contain("OK, 0 records retrieved");

            await enterCmd(driver!, textArea,
                `INSERT INTO sakila.actor (first_name, last_name) VALUES ('${random}','${random}`);

            resultHosts = await driver!.findElements(By.css(".resultHost"));
            lastResult = resultHosts[resultHosts.length-1];
            result = await lastResult.findElement(By.css(".resultText span"));
            expect(await result.getAttribute("innerHTML")).to.contain("OK");

            await commitBtn!.click();

            await enterCmd(driver!, textArea,`SELECT * FROM sakila.actor WHERE first_name='${random}';`);

            resultHosts = await driver!.findElements(By.css(".resultHost"));
            lastResult = resultHosts[resultHosts.length-1];
            result = await lastResult.findElement(By.css(".resultStatus label"));
            expect(await result.getAttribute("innerHTML")).to.contain("OK, 1 record retrieved");

            await autoCommit!.click();

            await driver!.wait(
                async () => {
                    return (
                        (await commitBtn!.isEnabled()) === false &&
                            (await rollBackBtn!.isEnabled()) === false
                    );
                },
                5000,
                "Commit/Rollback DB changes button is still enabled ",
            );
        });

        it("Connection toolbar buttons - Find and Replace", async () => {

            const contentHost = await driver!.findElement(By.id("contentHost"));

            await writeSQL(driver!, `import from xpto xpto xpto`);

            const findBtn = await getToolbarButton(driver!, "Find");
            await findBtn!.click();

            const finder = await driver!.findElement(By.css(".find-widget"));

            expect(await finder.getAttribute("aria-hidden")).equals("false");

            await finder.findElement(By.css("textarea")).sendKeys("xpto");

            await findInSelection(finder, false);

            expect(
                await finder.findElement(By.css(".matchesCount")).getText(),
            ).to.match(new RegExp(/1 of (\d+)/));

            await driver!.wait(
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
            ).to.contain("import from tester xpto xpto");

            await replacer.findElement(By.css("textarea")).clear();

            await replacer.findElement(By.css("textarea")).sendKeys("testing");

            await (await replacerGetButton(replacer, "Replace All"))!.click();

            expect(
                await contentHost.findElement(By.css("textarea")).getAttribute("value"),
            ).to.contain("import from tester testing testing");

            await closeFinder(finder);

            expect(await finder.getAttribute("aria-hidden")).equals("true");

        });

        it("Switch between search tabs", async () => {

            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(driver!, textArea, "select * from sakila.actor;select * from sakila.address;");

            const result1 = await getResultTab(driver!, "Result #1");

            const result2 = await getResultTab(driver!, "Result #2");

            expect(result1).to.exist;

            expect(result2).to.exist;

            expect(await getResultColumnName(driver!, "actor_id")).to.exist;

            expect(await getResultColumnName(driver!, "first_name")).to.exist;

            expect(await getResultColumnName(driver!, "last_name")).to.exist;

            expect(await getResultColumnName(driver!, "last_update")).to.exist;

            await result2!.click();

            expect(await getResultColumnName(driver!, "address_id")).to.exist;

            expect(await getResultColumnName(driver!, "address")).to.exist;

            expect(await getResultColumnName(driver!, "address2")).to.exist;

            expect(await getResultColumnName(driver!, "district")).to.exist;

            expect(await getResultColumnName(driver!, "city_id")).to.exist;

            expect(await getResultColumnName(driver!, "postal_code")).to.exist;

            await result1!.click();

            expect(await getResultColumnName(driver!, "actor_id")).to.exist;

        });

        it("Using Math_random on js_py blocks", async () => {

            await setDBEditorLanguage(driver!, "javascript");

            const contentHost = await driver!.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(driver!, textArea, "Math.random();");

            const result2 = await getOutput(driver!);

            expect(result2).to.match(new RegExp(/(\d+).(\d+)/));

            await enterCmd(driver!, textArea, "\\typescript");

            expect(await getOutput(driver!)).equals("Switched to TypeScript mode");

            await enterCmd(driver!, textArea, "Math.random();");

            const result4 = await getOutput(driver!);

            expect(result4).to.match(new RegExp(/(\d+).(\d+)/));

            await textArea.sendKeys(Key.ARROW_UP);

            await driver!.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver!.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver!.sleep(1000);

            await textArea.sendKeys(Key.ARROW_UP);

            await driver!.sleep(1000);

            await pressEnter(driver!);

            const otherResult = await getOutput(driver!, true);

            expect(otherResult).to.match(new RegExp(/(\d+).(\d+)/));

            expect(otherResult !== result2).equals(true);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await textArea.sendKeys(Key.ARROW_DOWN);

            await pressEnter(driver!);

            const otherResult1 = await getOutput(driver!);

            expect(otherResult1).to.match(new RegExp(/(\d+).(\d+)/));

            expect(otherResult1 !== result4).equals(true);

        });

        it("Multi-line comments", async () => {

            await setDBEditorLanguage(driver!, "sql");

            const contentHost = await driver!.findElement(By.id("contentHost"));

            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(driver!, textArea, "SELECT VERSION();");

            const resultHosts = await driver?.findElements(By.css(".resultHost"));

            const txt = await (await resultHosts![resultHosts!.length-1]
                .findElement(By.css(".tabulator-cell"))).getText();

            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];

            const digits = server.split(".");

            let serverVer = digits[0];

            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];

            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];

            await enterCmd(driver!, textArea, `/*!${serverVer} select * from actor;*/`);

            expect(await getResultStatus(driver!, true)).to.match(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            const higherServer = parseInt(serverVer, 10) + 1;

            await enterCmd(driver!, textArea, `/*!${higherServer} select * from actor;*/`);

            expect(await getResultStatus(driver!)).to.contain(
                "OK, 0 records retrieved",
            );

        });

        it("Context Menu - Execute", async () => {

            await writeSQL(driver!, "select * from sakila.actor");
            const textArea = await driver!.findElement(By.css("textarea"));

            let lastId = await getLastQueryResultId(driver!);
            await clickContextMenuItem(driver!, textArea, "Execute Block");

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver!, true)).to.match(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            expect(await hasNewPrompt(driver!)).to.be.false;

            lastId = await getLastQueryResultId(driver!);

            await clickContextMenuItem(driver!, textArea, "Execute Block and Advance");

            await driver!.wait(async() => {
                return (await getLastQueryResultId(driver!)) > lastId;
            }, 3000, "No new results block was displayed");

            expect(await getResultStatus(driver!, true)).to.match(
                new RegExp(/OK, (\d+) records retrieved/),
            );

            expect(await hasNewPrompt(driver!)).to.be.true;

        });

        it("Pie Graph based on DB table", async () => {

            await setDBEditorLanguage(driver!, "ts");
            const contentHost = await driver!.findElement(By.id("contentHost"));
            const textArea = await contentHost.findElement(By.css("textarea"));

            await enterCmd(driver!, textArea, `
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

            const pieChart = await getGraphHost(driver!);

            const chartColumns = await pieChart.findElements(By.css("rect"));
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
            }

        });

    });

    describe("ORACLE CLOUD INFRASTRUCTURE tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("ORACLE CLOUD INFRASTRUCTURE");
            }

            await toggleSection(driver!, "DATABASE", false);
            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", true);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);
        });

        afterEach(async function () {

            await postActions(driver!, this);

            await driver!.switchTo().defaultContent();
            await toggleSection(driver!, "DATABASE", false);
            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", true);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

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

        after(async () => {
            await fs.unlink(join(homedir(), ".oci", "config"));
        });

        it("Configure the OCI profile list and refresh", async () => {

            const btn = await getLeftSectionButton(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "Configure the OCI Profile list");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["config"]);

            const textEditor = new TextEditor();

            const editor = await driver!.findElement(By.css("textarea"));

            // eslint-disable-next-line max-len
            await editor.sendKeys("[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmyabcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\ntenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo5mmi2z3a\nregion=us-ashburn-1\nkey_file= ~/.oci/id_rsa_e2e.pem");

            await textEditor.save();
            await reloadSection(driver!, "ORACLE CLOUD INFRASTRUCTURE");

            await driver!.wait(async () => {
                return existsTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS (us-ashburn-1)");
            }, 5000, "E2ETESTS (us-ashburn-1) tree item was not found");

        });

        it("View Config Profile Information", async () => {

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "E2ETESTS (us-ashburn-1)", "ociProfile", "View Config Profile Information");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["E2ETESTS Info.json"]);

            const textEditor = new TextEditor();
            await driver!.wait(async () => {
                return (await textEditor.getText()).length > 0;
            }, 3000, "No text was found on file");

            expect(isJson(await textEditor.getText())).to.equal(true);

        });

        // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34062646
        it("Set as New Default Config Profile", async () => {

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "E2ETESTS (us-ashburn-1)", "ociProfile", "Set as New Default Config Profile");

            expect(await isDefaultItem(driver!, "profile", "E2ETESTS (us-ashburn-1)")).to.equal(true);

            /*await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);

            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");

            const textArea = await driver!.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "mds.get.currentConfigProfile()", 60000);

            const zoneHost = await driver!.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

            expect(result).to.equal("E2ETESTS");*/

        });

        it("View Compartment Information and set it as Current", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment");

            await driver!.wait(async () => {
                return existsTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA");
            }, 10000, "QA compartment does not exist");

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "QA", "ociCompartment", "View Compartment Information");

            let editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["QA Info.json"]);

            const textEditor = new TextEditor();
            await driver!.wait(async () => {
                return (await textEditor.getText()).indexOf("{") !== -1;
            }, 5000, "No text was found inside QA Info.json");

            const json = await textEditor.getText();
            expect(isJson(json)).to.equal(true);

            const parsed = JSON.parse(json);
            const compartmentId = parsed.id;

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "QA", "ociCompartment", "Set as Current Compartment");

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            expect(await isDefaultItem(driver!, "compartment", "QA")).to.be.true;

            expect(await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", "QA")).to.be.true;

            await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);
            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

            const textArea = await driver!.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "mds.get.currentCompartmentId()", 60000);

            const zoneHost = await driver!.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

            expect(result).to.equal(compartmentId);

        });

        it("View DB System Information", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", "MDSforVSCodeExtension");

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "View DB System Information");

            await driver!.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("MDSforVSCodeExtension Info.json");
            }, 5000, "MDSforVSCodeExtension Info.json was not opened");

            const textEditor = new TextEditor();
            await driver!.wait(async () => {
                return (await textEditor.getText()).indexOf("{") !== -1;
            }, 5000, "No text was found inside MDSforVSCodeExtension Info.json");

            const json = await textEditor.getText();
            expect(isJson(json)).to.equal(true);

        });

        it("Create connection with Bastion Service", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", "MDSforVSCodeExtension");

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "Create Connection with Bastion Service");

            await driver!.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("SQL Connections");
            }, 5000, "SQL Connections was not opened");

            await driver!.wait(until.ableToSwitchToFrame(0), 5000, "not able to switch to frame 0");
            await driver!.wait(until.ableToSwitchToFrame(
                By.id("active-frame")), 5000, "not able to switch to frame active-frame");
            await driver!.wait(until.ableToSwitchToFrame(
                By.id("frame:SQL Connections")), 5000, "not able to switch to frame active-frame");

            const newConDialog = await driver!.wait(until.elementLocated(By.css(".valueEditDialog")),
                10000, "Connection dialog was not loaded");

            expect(await newConDialog.findElement(By.id("caption")).getAttribute("value"))
                .to.equal("MDSforVSCodeExtension");

            expect(await newConDialog.findElement(By.id("description")).getAttribute("value"))
                .to.equal("DB System used to test the MySQL Shell for VSCode Extension.");

            expect(await newConDialog.findElement(By.id("hostName")).getAttribute("value"))
                .to.match(new RegExp(/(\d+).(\d+).(\d+).(\d+)/));

            await newConDialog.findElement(By.id("userName")).sendKeys("dba");

            const mdsTab = await newConDialog.findElement(By.id("page3"));

            expect(mdsTab).to.exist;

            await mdsTab.click();

            await driver!.wait(async () => {
                return await driver!.findElement(By.id("mysqlDbSystemId")).getAttribute("value") !== "";
            }, 3000, "DbSystemID field was not set");

            await driver!.wait(async () => {
                return await driver!.findElement(By.id("bastionId")).getAttribute("value") !== "";
            }, 3000, "BastionID field was not set");

            await newConDialog.findElement(By.id("ok")).click();

            await driver!.switchTo().defaultContent();

            const mds = await getDB(driver!, "MDSforVSCodeExtension");

            expect(mds).to.exist;

            try {

                await switchToFrame(driver!, "SQL Connections");

                await mds.click();

                await driver!.wait(async () => {
                    const fingerprintDialog = await driver!.findElements(By.css(".visible.confirmDialog"));
                    let passwordDialog = await driver!.findElements(By.css(".visible.passwordDialog"));
                    if(fingerprintDialog.length > 0) {
                        await fingerprintDialog[0].findElement(By.id("accept")).click();
                        passwordDialog = await driver!.findElements(By.css(".visible.passwordDialog"));
                    }
                    if(passwordDialog.length > 0) {
                        await passwordDialog[0].findElement(By.css("input")).sendKeys("MySQLR0cks!");
                        await passwordDialog[0].findElement(By.id("ok")).click();

                        return true;
                    }

                    return false;
                }, 20000, "Dialogs were not displayed");

                const confirmDialog = await driver!.wait(until.elementLocated(By.css(".visible.confirmDialog")),
                    5000, "Confirm dialog was not displayed");

                await confirmDialog.findElement(By.id("refuse")).click();

                const contentHost = await driver!.wait(until.elementLocated(By.id("contentHost")),
                    20000, "Content host not visible");

                const textArea = await contentHost.findElement(By.css("textArea"));

                await enterCmd(driver!, textArea, "select version();");

                const zoneHost = await driver!.findElements(By.css(".zoneHost"));

                const result = await zoneHost[zoneHost.length - 1]
                    .findElement(By.css(".resultStatus label"));

                expect(await result.getText()).to.contain("OK");

                await driver!.switchTo().defaultContent();

                expect(await existsTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                    "Bastion4PrivateSubnetStandardVnc"))
                    .to.be.true;

                expect(await existsTreeElement(driver!, "DATABASE", "MDSforVSCodeExtension"))
                    .to.be.true;
            } catch(e) {
                throw new Error(String(e.stack));
            } finally {
                await driver!.switchTo().defaultContent();
                await toggleSection(driver!, "DATABASE", true);
                await reloadSection(driver!, "DATABASE");
                await toggleSection(driver!, "DATABASE", false);
            }
        });

        it("Start a DB System", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "Start the DB System");

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", true);
            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Start DB System (running)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }
            }, 30000, "No logs were found to check that E2ETESTS profile was loaded");

            const notifications = await new Workbench().getNotifications();
            expect(await notifications[0].getMessage()).to.contain("Are you sure you want to start the DB System");
            await notifications[0].takeAction("Yes");

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("DB System 'MDSforVSCodeExtension' did start successfully") !== -1;
                } catch (e) {
                    return false;
                }
            }, 30000, "No logs were found to check that DB System was started successfully");

            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Start DB System (done)")).to.be.true;

        });

        it("Restart a DB System (and cancel)", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "Restart the DB System");

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", true);
            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Restart DB System (running)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }
            }, 50000, "No logs were found to check that E2ETESTS profile was loaded");

            const notifications = await new Workbench().getNotifications();
            expect(await notifications[0].getMessage()).to.contain("Are you sure you want to restart the DB System");
            await notifications[0].takeAction("NO");

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Operation cancelled") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System restart was cancelled");

        });

        it("Stop a DB System (and cancel)", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "Stop the DB System");

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", true);
            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Stop DB System (running)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, 50000, "No logs were found to check that E2ETESTS profile was loaded");

            const notifications = await new Workbench().getNotifications();
            expect(await notifications[0].getMessage()).to.contain("Are you sure you want to stop the DB System");
            await notifications[0].takeAction("NO");

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Operation cancelled") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System stop was cancelled");

        });

        it("Delete a DB System (and cancel)", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MDSforVSCodeExtension", "ociDBSystem", "Delete the DB System");

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", true);
            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Delete DB System (running)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, 50000, "No logs were found to check that E2ETESTS profile was loaded");

            const notifications = await new Workbench().getNotifications();
            expect(await notifications[0].getMessage()).to.contain("Are you sure you want to delete");
            await notifications[0].takeAction("NO");

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText())
                        .indexOf("Deletion aborted") !== -1;
                } catch (e) {
                    return false;
                }

            }, 10000, "No logs were found to check that DB System deletion was cancelled");

        });

        it("Get Bastion Information and set it as current", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "Bastion4PrivateSubnetStandardVnc");

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "Bastion4PrivateSubnetStandardVnc", "ociBastion", "Get Bastion Information");

            await driver!.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("Bastion4PrivateSubnetStandardVnc Info.json");
            }, 5000, "Bastion4PrivateSubnetStandardVnc Info.json was not opened");

            const textEditor = new TextEditor();
            await driver!.wait(async () => {
                return (await textEditor.getText()).indexOf("{") !== -1;
            }, 5000, "No text was found inside Bastion4PrivateSubnetStandardVnc Info.json");

            const json = await textEditor.getText();
            expect(isJson(json)).to.equal(true);

            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "Bastion4PrivateSubnetStandardVnc", "ociBastion", "Set as Current Bastion");

            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);

            expect(await isDefaultItem(driver!, "bastion", "Bastion4PrivateSubnetStandardVnc")).to.be.true;

            await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);
            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 20000, "Console was not loaded");

            const textArea = await driver!.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "mds.get.currentBastionId()", 60000);

            const zoneHost = await driver!.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("code")).getText();

            expect(result).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "Bastion4PrivateSubnetStandardVnc");

            await toggleSection(driver!, "MYSQL SHELL TASKS", true);

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "Bastion4PrivateSubnetStandardVnc", "ociBastion", "Refresh When Bastion Reaches Active State");

            expect(await existsTreeElement(driver!,
                "MYSQL SHELL TASKS", "Refresh Bastion (running)")).to.be.true;

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("Task 'Refresh Bastion' completed successfully") !== -1;
                } catch (e) {
                    return false;
                }

            }, 20000, "Not able to verify that bastion was refreshed successfully");

            expect(await existsTreeElement(driver!,
                "MYSQL SHELL TASKS", "Refresh Bastion (done)")).to.be.true;
        });

        it("Delete Bastion", async () => {

            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE", "E2ETESTS");
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "Root Compartment", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "QA", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await toggleTreeElement(driver!, "ORACLE CLOUD INFRASTRUCTURE", "MySQLShellTesting", true);
            await waitForLoading(driver!, "ORACLE CLOUD INFRASTRUCTURE", 10000);
            await hasTreeChildren(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "MySQLShellTesting", "MDSforVSCodeExtension");

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            await selectContextMenuItem(driver!, "ORACLE CLOUD INFRASTRUCTURE",
                "Bastion4PrivateSubnetStandardVnc", "ociBastion", "Delete Bastion");

            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL TASKS", true);
            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Delete Bastion (running)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("OCI profile 'E2ETESTS' loaded.") !== -1;
                } catch (e) {
                    return false;
                }

            }, 50000, "No logs were found to check that E2ETESTS profile was loaded");

            const notifications = await new Workbench().getNotifications();
            expect(await notifications[0].getMessage()).to.contain("Are you sure you want to delete");
            await notifications[0].takeAction("NO");

            expect(await existsTreeElement(driver!, "MYSQL SHELL TASKS", "Delete Bastion (error)")).to.be.true;

            await driver!.wait(async () => {
                try {
                    return (await outputView.getText()).indexOf("Deletion aborted") !== -1;
                } catch (e) {
                    return false;
                }

            }, 5000, "No logs were found to check that Bastion Deletion was aborted");

        });

    });

    describe("MYSQL SHELL CONSOLES - Toolbar action tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("MYSQL SHELL CONSOLES");
            }

            await toggleSection(driver!, "DATABASE", false);
            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);
        });

        afterEach(async function () {

            await postActions(driver!, this);

            await driver!.switchTo().defaultContent();
            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            for (const editor of editors) {
                await edView.closeEditor(editor);
            }
        });

        it("Add a new MySQL Shell Console", async () => {

            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver!.switchTo().defaultContent();

            expect(await existsTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 1") as Boolean).to.equal(true);

            await selectContextMenuItem(driver!, "MYSQL SHELL CONSOLES", "Session 1",
                "console", "Close this MySQL Shell Console");

            expect(await existsTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 1")).to.equal(false);

        });

        it("Open the MySQL Shell Console Browser", async () => {
            const btn = await getLeftSectionButton(driver!,
                "MYSQL SHELL CONSOLES", "Open the MySQL Shell Console Browser");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            expect(await driver!.findElement(By.css("#shellModuleTabview h2")).getText())
                .to.equal("MySQL Shell - GUI Console");

            const newSession = await driver!.findElement(By.id("-1"));
            await newSession.click();

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver!.switchTo().defaultContent();

            expect(await existsTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 1")).to.equal(true);
        });

    });

    describe("MYSQL SHELL CONSOLES - Shell tests", () => {

        before(async () => {
            if (platform() === "win32") {
                await initTree("MYSQL SHELL CONSOLES");
            }

            await toggleSection(driver!, "DATABASE", false);
            await toggleSection(driver!, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver!, "MYSQL SHELL CONSOLES", true);
            await toggleSection(driver!, "MYSQL SHELL TASKS", false);

            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await switchToFrame(driver!, "MySQL Shell Consoles");

            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
        });

        afterEach(async function () {

            await postActions(driver!, this);

            const textArea = await driver!.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, `\\d`);
            await cleanEditor(driver!);

        });

        it("Open multiple sessions", async () => {

            await driver?.switchTo().defaultContent();

            const btn = await getLeftSectionButton(driver!, "MYSQL SHELL CONSOLES", "Add a New MySQL Shell Console");
            await btn.click();

            await switchToFrame(driver!, "MySQL Shell Consoles");
            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");

            await driver!.switchTo().defaultContent();
            expect(await existsTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 2") as Boolean).to.equal(true);

            await btn.click();
            await switchToFrame(driver!, "MySQL Shell Consoles");
            await driver!.wait(until.elementLocated(By.id("shellEditorHost")), 10000, "Console was not loaded");
            await driver!.switchTo().defaultContent();
            expect(await existsTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 3") as Boolean).to.equal(true);

            //SESSION1
            await switchToFrame(driver!, "MySQL Shell Consoles");
            let editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            let textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}`,
            );

            let result = await shellGetResult(driver!);

            expect(result).to.contain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`,
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "db.actor.select()");

            expect(await shellGetResultTable(driver!)).to.exist;

            //SESSION2
            await driver!.switchTo().defaultContent();
            const session2 = await getTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 2");
            await session2.click();

            await switchToFrame(driver!, "MySQL Shell Consoles");
            editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}`,
            );

            result = await shellGetResult(driver!);

            expect(result).to.contain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`,
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "db.category.select()");

            expect(await shellGetResultTable(driver!)).to.exist;

            //SESSION3
            await driver!.switchTo().defaultContent();
            const session3 = await getTreeElement(driver!, "MYSQL SHELL CONSOLES", "Session 3");
            await session3.click();

            await switchToFrame(driver!, "MySQL Shell Consoles");

            editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}`,
            );

            result = await shellGetResult(driver!);

            expect(result).to.contain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`,
            );

            editor = await driver!.findElement(By.id("shellEditorHost"));
            textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver!, textArea, "db.city.select()");

            expect(await shellGetResultTable(driver!)).to.exist;

            await driver!.switchTo().defaultContent();

            await selectContextMenuItem(driver!, "MYSQL SHELL CONSOLES", "Session 2",
                "console", "Close this MySQL Shell Console");

            await selectContextMenuItem(driver!, "MYSQL SHELL CONSOLES", "Session 3",
                "console", "Close this MySQL Shell Console");

            await switchToFrame(driver!, "MySQL Shell Consoles");
        });

        it("Connect to host", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}`,
            );

            const result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}'`,
            );

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                `Default schema set to \`${String(conn.schema)}\`.`,
            );

        });

        it("Connect to host without password", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(shellConn.username)}@${String(shellConn.hostname)}:${String(shellConn.port)}/${String(shellConn.schema)}`);

            await setDBEditorPassword(driver!, shellConn);

            await setConfirmDialog(driver!, shellConn, "no");

            const result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(shellConn.username)}@${String(shellConn.hostname)}:${String(shellConn.port)}/${String(shellConn.schema)}'`);

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                `Default schema set to \`${String(shellConn.schema)}\`.`,
            );

        });

        it("Verify help command", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}`);

            let result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}'`,
            );

            expect(result).to.contain(
                `Default schema set to \`${String(conn.schema)}\`.`,
            );

            await enterCmd(driver!, textArea, "\\h");

            result = await shellGetResult(driver!);

            expect(result).to.contain(
                "The Shell Help is organized in categories and topics.",
            );

            expect(result).to.contain("SHELL COMMANDS");
            expect(result).to.contain("\\connect");
            expect(result).to.contain("\\disconnect");
            expect(result).to.contain("\\edit");
            expect(result).to.contain("\\exit");
            expect(result).to.contain("\\help");
            expect(result).to.contain("\\history");
            expect(result).to.contain("\\js");
            expect(result).to.contain("\\nopager");
            expect(result).to.contain("\\nowarnings");
            expect(result).to.contain("\\option");
            expect(result).to.contain("\\pager");
            expect(result).to.contain("\\py");
            expect(result).to.contain("\\quit");
            expect(result).to.contain("\\reconnect");
            expect(result).to.contain("\\rehash");
            expect(result).to.contain("\\show");
            expect(result).to.contain("\\source");
            expect(result).to.contain("\\sql");
            expect(result).to.contain("\\status");
            expect(result).to.contain("\\system");
            expect(result).to.contain("\\use");
            expect(result).to.contain("\\warning");
            expect(result).to.contain("\\watch");


        });

        it("Switch session language - javascript python", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(driver!, textArea, "\\py");

            let result = await shellGetResult(driver!);

            expect(result).equals("Switching to Python mode...");

            expect(await shellGetTech(editor)).equals("python");

            await enterCmd(driver!, textArea, "\\js");

            result = await shellGetResult(driver!);

            expect(result).equals("Switching to JavaScript mode...");

            expect(await shellGetTech(editor)).equals("javascript");

        });

        it("Using db global variable", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}`);

            const result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`,
            );

            expect(result).to.contain("(X protocol)");

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                `Default schema \`${String(conn.schema)}\` accessible through db.`,
            );

            await enterCmd(driver!, textArea, "db.actor.select()");

            expect(await shellGetResultTable(driver!)).to.exist;

            expect(await shellGetTotalRows(driver!)).to.match(
                new RegExp(/(\d+) rows in set/),
            );

            await enterCmd(driver!, textArea, "db.category.select()");

            expect(await shellGetResultTable(driver!)).to.exist;

            expect(await shellGetTotalRows(driver!)).to.match(
                new RegExp(/(\d+) rows in set/),
            );

        });

        it("Using shell global variable", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `shell.connect('${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}')`);

            let result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`);

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                `Default schema \`${String(conn.schema)}\` accessible through db`,
            );

            await enterCmd(driver!, textArea, "shell.status()");

            result = await shellGetResult(driver!);

            expect(result).to.match(
                new RegExp(/MySQL Shell version (\d+).(\d+).(\d+)/),
            );

            expect(result).to.contain(`"CONNECTION":"${String(conn.hostname)} via TCP/IP"`);

            expect(result).to.contain(`"CURRENT_SCHEMA":"${String(conn.schema)}"`);

            expect(result).to.match(new RegExp(`"CURRENT_USER":"${String(conn.username)}`));

            expect(result).to.contain(`"TCP_PORT":"${String(conn.portX)}"`);

        });

        it("Using mysql mysqlx global variable", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            const cmd = `mysql.getClassicSession('${String(conn.username)}:${String(conn.password)}
                @${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}')`;

            await enterCmd(driver!, textArea, cmd.replace(/ /g,""));

            let result = await shellGetResult(driver!);

            expect(result).to.contain("&lt;ClassicSession&gt;");

            await enterCmd(driver!, textArea, "shell.disconnect()");

            result = await shellGetResult(driver!);

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `mysql.getSession('${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}')`);

            result = await shellGetResult(driver!);

            expect(result).to.contain("&lt;ClassicSession&gt;");

            await enterCmd(driver!, textArea, "shell.disconnect()");

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `mysqlx.getSession('${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}')`);

            result = await shellGetResult(driver!);

            expect(result).to.contain("&lt;Session&gt;");


        });

        it("Using util global variable", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}`);

            let result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.port)}/${String(conn.schema)}'`);

            await enterCmd(
                driver!,
                textArea,
                'util.exportTable("actor", "test.txt")',
            );

            await driver!.wait(
                async () => {
                    return (
                        (await shellGetResult(driver!)).indexOf(
                            "The dump can be loaded using",
                        ) !== -1
                    );
                },
                10000,
                "Export operation was not done in time",
            );

            result = await shellGetResult(driver!);

            expect(result).to.contain("Running data dump using 1 thread.");

            expect(result).to.match(
                new RegExp(/Total duration: (\d+)(\d+):(\d+)(\d+):(\d+)(\d+)s/),
            );

            expect(result).to.match(new RegExp(/Data size: (\d+).(\d+)(\d+) KB/));

            expect(result).to.match(new RegExp(/Rows written: (\d+)/));

            expect(result).to.match(new RegExp(/Bytes written: (\d+).(\d+)(\d+) KB/));

            expect(result).to.match(
                new RegExp(/Average throughput: (\d+).(\d+)(\d+) KB/),
            );

        });

        it("Verify collections - json format", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/world_x_cst`);

            const result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/world_x_cst'`);

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                "Default schema `world_x_cst` accessible through db.",
            );

            await enterCmd(driver!, textArea, "db.countryinfo.find()");
            expect(await shellGetLangResult(driver!)).equals("json");

        });

        // bug: https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=34241454
        it("Change schemas using menu", async () => {

            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                // eslint-disable-next-line max-len
                `\\c ${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}`);

            let result = await shellGetResult(driver!);

            expect(result).to.contain(
                // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}`);

            expect(result).to.contain("No default schema selected");

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const schemaLabel = await driver!.findElement(By.id("schema")).getText();
            expect(schemaLabel.substring(1).trim()).equals("no schema selected");

            await driver!.findElement(By.id("schema")).click();
            let menuItems = await driver!.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            const schema1 = (await menuItems[0].getText()).substring(1).trim();
            const schema2 = (await menuItems[1].getText()).substring(1).trim();
            await menuItems[0].click();
            await driver!.sleep(1000);
            result = await shellGetResult(driver!);
            expect(result).equals("Default schema `" + schema1 + "` accessible through db.");

            await driver!.findElement(By.id("schema")).click();
            menuItems = await driver!.findElements(By.css(".shellPromptSchemaMenu .menuItem .label"));
            await menuItems[1].click();
            await driver!.sleep(1000);
            result = await shellGetResult(driver!);
            expect(result).equals("Default schema `" + schema2 + "` accessible through db.");

        });

        it("Check query result content", async () => {
            const editor = await driver!.findElement(By.id("shellEditorHost"));

            await driver!.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));

            await enterCmd(
                driver!,
                textArea,
                    // eslint-disable-next-line max-len
                `shell.connect('${String(conn.username)}:${String(conn.password)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}')`);

            const result = await shellGetResult(driver!);

            expect(result).to.contain(
                    // eslint-disable-next-line max-len
                `Creating a session to '${String(conn.username)}@${String(conn.hostname)}:${String(conn.portX)}/${String(conn.schema)}'`);

            expect(result).to.match(new RegExp(/Server version: (\d+).(\d+).(\d+)/));

            expect(result).to.contain(
                `Default schema \`${String(conn.schema)}\` accessible through db`,
            );

            await enterCmd(driver!, textArea, "\\sql");

            await enterCmd(driver!, textArea, "SHOW DATABASES;");

            expect(await isValueOnDataSet(driver!, "sakila")).equals(true);

            expect(await isValueOnDataSet(driver!, "world_x_cst")).equals(true);
        });

    });

});
