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
    VSBrowser,
    WebDriver,
    By,
    EditorView,
    Workbench,
    OutputView,
    ActivityBar,
    until,
    Button,
    BottomBarPanel,
    InputBox,
    WebElement,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";

import { expect } from "chai";
import {
    createDBconnection,
    getLeftSection,
    getLeftSectionButton,
    IDbConnection,
    getDB,
    IContextMenu,
    selectItem,
    startServer,
    getTreeElement,
    toggleTreeElement,
    deleteDBConnection,
    toggleSection,
    setEditorLanguage,
    enterCmd,
} from "../lib/helpers";

import { ChildProcess } from "child_process";

describe("MySQL Shell for VS", () => {
    let browser: VSBrowser;
    let driver: WebDriver;

    const ctxMenu: IContextMenu = {
        dbActionsRestartShellProcess: 1,
        dbActionsConnectShellProcess: 2,
        dbActionsRelaunchWizard: 3,
        dbResetWelcomeWizard: 4,
        dbOpenConn: 1,
        dbOpenConnNewTab: 2,
        dbOpenConsole: 3,
        dbEdit: 5,
        dbDuplicate: 6,
        dbDelete: 7,
        dbShowSchemas: 8,
        dbLoadDumpFromDisk: 9,
        dbConfigRest: 10,
        schemaDrop: 1,
        tableShowData: 1,
        tableAddRest: 2,
        tableDrop: 3,
    };

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }

    const conn: IDbConnection = {
        caption: String(process.env.DBHOSTNAME),
        description: "Local connection to local server",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
    };

    before(async () => {
        browser = VSBrowser.instance;
        driver = browser.driver;
        await driver.manage().timeouts().implicitlyWait(5000);

        await driver.wait(async () => {
            const activityBar = new ActivityBar();
            const controls = await activityBar.getViewControls();
            for (const control of controls) {
                if (await control.getTitle() === "MySQL Shell for VSCode") {
                    await control.openView();

                    return true;
                }
            }
        }, 7000, "Could not find MySQL Shell for VSCode View");

        const editorView = new EditorView();
        await driver.wait(async () => {
            const tabs = await editorView.getOpenTabs();
            for (const tab of tabs) {
                if (await tab.getTitle() === "Welcome to MySQL Shell") {
                    return true;
                }
            }
        }, 7000, "Welcome to MySQL Shell tab was not opened");

        const workbench = new Workbench();
        await workbench.executeCommand("workbench.action.reloadWindow");
        await driver.sleep(2000);
        await driver.wait(async () => {
            return (await driver.findElements(By.xpath("//h2[contains(@title, 'MySQL Shell for VSCode')]"))).length > 0;
        }, 5000, "VS Code did not reload in time");


        const bottomBar = new BottomBarPanel();
        const outputView = await bottomBar.openOutputView();
        const select = await driver.findElement(By.xpath("//select[contains(@aria-label, 'Output Channels')]"));

        await driver.wait(async () => {
            await select.click();
            await driver.sleep(500);
            const options = await select.findElements(By.css("option"));

            for (const option of options) {
                if (await option.getAttribute("value") === "MySQL Shell for VS Code") {
                    await option.click();

                    return true;
                }
            }
        }, 7000, "MySQL Shell for VS Code channel was not found");

        await driver.wait(async () => {
            const text = await outputView.getText();
            if (text.indexOf("Mode: Single user") !== -1) {
                return true;
            }
        }, 10000, "Could not check extension load from output tab");

        await bottomBar.toggle(false);

        //close notification
        const containers = await driver.findElements(
            By.css(".notification-list-item-toolbar-container .notifications-list-container"));
        if (containers.length > 0) {
            await containers[0].findElement(By.xpath("//a[contains(@title, 'Clear Notification')]")).click();
        }

    });

    describe("DATABASE toolbar action tests", () => {

        afterEach(async () => {
            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            if (editors.includes("SQL Connections")) {
                await edView.closeEditor("SQL Connections");
            }
            if (editors.includes("Welcome to MySQL Shell")) {
                await edView.closeEditor("Welcome to MySQL Shell");
            }
        });

        it("Create and delete a Database connection", async () => {
            let flag = false;
            try {
                conn.caption += String(Math.floor(Math.random() * 100));
                await createDBconnection(driver, conn);
                flag = true;
                expect(await getDB(driver, conn.caption)).to.exist;
                const reloadConnsBtn: WebElement | undefined = await getLeftSectionButton(driver,
                    "DATABASE", "Reload the connection list");

                await reloadConnsBtn?.click();
                expect(await getTreeElement(driver, "DATABASE", conn.caption)).to.exist;
            } catch (e) {
                throw new Error(String(e));
            } finally {
                if (flag) {
                    await deleteDBConnection(driver, conn.caption, ctxMenu);
                }
            }
        });

        it("Open DB Connection Browser", async () => {

            const openConnBrw = await getLeftSectionButton(driver, "DATABASE", "Open the DB Connection Browser");
            await openConnBrw?.click();

            const editorView = new EditorView();
            const editor = await editorView.openEditor("SQL Connections");
            expect(await editor.getTitle()).to.equals("SQL Connections");

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

            expect(
                await driver.findElement(By.id("title")).getText(),
            ).to.equals("MySQL Shell - SQL Notebook");

            expect(
                await driver
                    .findElement(By.id("contentTitle"))
                    .getText(),
            ).to.equals("Database Connections");

            expect(
                await driver
                    .findElements(
                        By.css("#tilesHost button"),
                    ),
            ).to.have.lengthOf.at.least(1);

            await driver.switchTo().defaultContent();

            const edView = new EditorView();
            await edView.closeEditor("SQL Connections");

        });

        it("Restart internal MySQL Shell process", async () => {

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();

            const moreActionsBtn = await getLeftSectionButton(driver, "DATABASE", "More Actions...");
            await moreActionsBtn?.click();
            await driver.sleep(500);
            await selectItem(ctxMenu.dbActionsRestartShellProcess);

            const dialog = await driver.wait(until.elementLocated(By.css(".notification-toast-container")),
                3000, "Restart dialog was not found");

            await dialog.findElement(By.xpath("//a[contains(@title, 'Restart MySQL Shell')]")).click();

            try {
                await driver.wait(async () => {
                    const outputView = new OutputView();
                    try {
                        const text = await outputView.getText();
                        const lines = text.split("\n");
                        for (const line of lines) {
                            console.log(line);
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

        it("Connect to external MySQL Shell process", async () => {
            let prc: ChildProcess;
            try {
                prc = await startServer(driver);
                const moreActionsBtn = await getLeftSectionButton(driver, "DATABASE", "More Actions...");
                await moreActionsBtn?.click();
                await driver.sleep(500);
                await selectItem(ctxMenu.dbActionsConnectShellProcess);

                const input = new InputBox();
                await input.setText("http://localhost:8000");
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
                throw new Error(String(e));
            } finally {
                if (prc!) {
                    prc.kill();
                }
            }
        });

        it("Relaunch Welcome Wizard", async () => {

            const moreActionsBtn = await getLeftSectionButton(driver, "DATABASE", "More Actions...");
            await moreActionsBtn?.click();
            await driver.sleep(500);
            await selectItem(ctxMenu.dbActionsRelaunchWizard);

            const editor = new EditorView();
            const titles = await editor.getOpenEditorTitles();

            expect(titles).to.include.members(["Welcome to MySQL Shell"]);
            const active = await editor.getActiveTab();
            expect(await active?.getTitle()).equals("Welcome to MySQL Shell");

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));

            const text = await driver.findElement(By.css("#page1 h3")).getText();
            expect(text).equals("Welcome to MySQL Shell for VSCode.");
            expect(await driver.findElement(By.id("nextBtn"))).to.exist;
            await driver.switchTo().defaultContent();
        });

    });

    describe("DATABASE tests", () => {

        before(async () => {
            await createDBconnection(driver, conn);
            expect(await getDB(driver, conn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeEditor("SQL Connections");
            const reloadConnsBtn = await getLeftSectionButton(driver, "DATABASE", "Reload the connection list");
            await reloadConnsBtn?.click();
            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            expect(el).to.exist;
        });

        after(async () => {
            await deleteDBConnection(driver, conn.caption, ctxMenu);
        });

        afterEach(async () => {
            await driver.switchTo().defaultContent();
            const edView = new EditorView();
            const editors = await edView.getOpenEditorTitles();
            for (const editor of editors) {
                await edView.closeEditor(editor);
            }
        });

        it("Connection Context Menu - Open connection", async () => {

            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbOpenConn);

            await new EditorView().openEditor(conn.caption);

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:" + conn.caption)));
            const item = await driver.findElement(By.css("#dbEditorMainToolbar .dropdown label"));
            expect(await item.getText()).to.equals(conn.caption);
            await driver.switchTo().defaultContent();

        });

        it("Connection Context Menu - Open connection in new tab", async () => {

            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbOpenConn);

            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbOpenConnNewTab);

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

        it("Connection Context Menu - Open MySQL Console for this connection", async () => {
            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbOpenConsole);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:MySQL Shell Consoles")));
            const item = await driver.wait(until
                .elementLocated(By.css("code > span")), 10000, "MySQL Shell Console was not loaded");
            expect(await item.getText()).to.contain("Welcome to the MySQL Shell - GUI Console");
            await driver.switchTo().defaultContent();

            expect(await getTreeElement(driver, "ORACLE CLOUD INFRASTRUCTURE", "Session to " + conn.caption)).to.exist;
        });

        it("Connection Context Menu - Edit connection", async () => {
            try {
                conn.caption = "toEdit";
                await createDBconnection(driver, conn);
                expect(await getDB(driver, "toEdit")).to.exist;
                const edView = new EditorView();
                await edView.closeEditor("SQL Connections");
                const reloadConnsBtn = await getLeftSectionButton(driver, "DATABASE", "Reload the connection list");
                await reloadConnsBtn?.click();
                const el = await getTreeElement(driver, "DATABASE", conn.caption);
                expect(el).to.exist;

                await driver.actions()
                    .mouseMove(el)
                    .click(Button.RIGHT)
                    .perform();

                await driver.sleep(500);
                await selectItem(ctxMenu.dbEdit);

                const editorView = new EditorView();
                const editors = await editorView.getOpenEditorTitles();
                expect(editors.includes("SQL Connections")).to.be.true;

                await driver.switchTo().frame(0);
                await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
                await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

                const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
                await driver.wait(async () => {
                    await newConDialog.findElement(By.id("caption")).clear();

                    return !(await driver.executeScript("return document.querySelector('#caption').value"));
                }, 3000, "caption was not cleared in time");
                await newConDialog.findElement(By.id("caption")).sendKeys("EditedConn");
                const okBtn = await driver.findElement(By.id("ok"));
                await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
                await okBtn.click();
                await driver.switchTo().defaultContent();

                await driver.wait(async () => {
                    await reloadConnsBtn?.click();
                    try {
                        await getTreeElement(driver, "DATABASE", "EditedConn");

                        return true;
                    } catch (e) { return false; }
                }, 5000, "Database was not updated");

                await deleteDBConnection(driver, "EditedConn", ctxMenu);
            } catch (e) { throw new Error(String(e)); } finally { conn.caption = "Localhost"; }

        });

        it("Connection Context Menu - Duplicate connection", async () => {

            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbDuplicate);

            const editorView = new EditorView();
            const editors = await editorView.getOpenEditorTitles();
            expect(editors.includes("SQL Connections")).to.be.true;

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

            const dialog = await driver.wait(until.elementLocated(
                By.css(".valueEditDialog")), 5000, "Connection dialog was not found");
            await dialog.findElement(By.id("caption")).sendKeys("Dup");
            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();
            await driver.switchTo().defaultContent();
            const reloadConnsBtn = await getLeftSectionButton(driver, "DATABASE", "Reload the connection list");

            await driver.wait(async () => {
                await reloadConnsBtn?.click();
                const db = await getLeftSection(driver, "DATABASE");

                return (await db?.findElements(By.xpath("//div[contains(@aria-label, 'Dup')]")))!.length === 1;
            }, 10000, "Duplicated database was not found");

            await deleteDBConnection(driver, "Dup", ctxMenu);

        });

        it("Connection Context Menu - Configure MySQL REST Service and Show MySQL System Schemas", async () => {

            await toggleTreeElement(driver, "DATABASE", conn.caption);
            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbConfigRest);

            expect(await getTreeElement(driver,
                "MYSQL SHELL TASKS", "Configure MySQL REST Service (running)")).to.exist;
            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();

            await driver.wait(async () => {
                const text = await outputView.getText();

                return text.indexOf("'Configure MySQL REST Service' completed successfully") !== -1;
            }, 5000, "Configure MySQL REST Service was not completed");

            await bottomBar.toggle(false);

            expect(await getTreeElement(driver, "MYSQL SHELL TASKS", "Configure MySQL REST Service (done)")).to.exist;
            const item = await driver.wait(
                until.elementLocated(By.xpath("//div[contains(@aria-label, 'MySQL REST Service')]")), 5000,
                "MySQL REST Service tree item was not found");
            await driver.wait(until.elementIsVisible(item), 5000, "MySQL REST Service tree item was not visible");

            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbShowSchemas);

            await toggleSection(driver, "ORACLE CLOUD INFRASTRUCTURE", false);
            await toggleSection(driver, "MYSQL SHELL CONSOLES", false);
            await toggleSection(driver, "MYSQL SHELL TASKS", false);

            await toggleTreeElement(driver, "DATABASE", "mysql_rest_service_metadata");
            await toggleTreeElement(driver, "DATABASE", "Tables");

            expect(await getTreeElement(driver, "DATABASE", "audit_log")).to.exist;
            expect(await getTreeElement(driver, "DATABASE", "auth_app")).to.exist;
            expect(await getTreeElement(driver, "DATABASE", "auth_user")).to.exist;

            await toggleSection(driver, "ORACLE CLOUD INFRASTRUCTURE", true);
            await toggleSection(driver, "MYSQL SHELL CONSOLES", true);
            await toggleSection(driver, "MYSQL SHELL TASKS", true);

        });

        //feature under dev
        //it.skip("MySQL REST Service - Add REST Service", async () => {
        //    null;
        //});

        //has bug https://mybug.mysql.oraclecorp.com/orabugs/site/bug.php?id=33945767
        it.skip("Drop Schema", async () => {
            const el = await getTreeElement(driver, "DATABASE", conn.caption);
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.dbOpenConsole);

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["MySQL Shell Consoles"]);

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:MySQL Shell Consoles")));

            await setEditorLanguage(driver, "sql");
            const editor = await driver.findElement(By.id("shellEditorHost"));

            await driver.executeScript(
                "arguments[0].click();",
                await editor.findElement(By.css(".current-line")),
            );

            const textArea = await editor.findElement(By.css("textArea"));
            await enterCmd(driver, textArea, "create schema testSchema;");

            const zoneHost = await driver.findElements(By.css(".zoneHost"));
            const result = await zoneHost[zoneHost.length - 1].findElement(By.css("div.message.info")).getText();
            expect(result).to.contain("0 rows in set");

            await driver.switchTo().defaultContent();

            const reloadConnsBtn = await getLeftSectionButton(driver, "DATABASE", "Reload the connection list");
            await reloadConnsBtn?.click();

            await toggleTreeElement(driver, "DATABASE", conn.caption);
            const schema = await getTreeElement(driver, "DATABASE", "testSchema");

            await driver.actions()
                .mouseMove(schema)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.schemaDrop);

            const ntf = await driver.findElement(By.css(".notifications-toasts.visible"));
            await ntf.findElement(By.xpath("//a[contains(@title, 'Drop testSchema')]")).click();

            const msg = await driver.findElement(By.css(".notification-list-item-message > span"));
            await driver.wait(until.elementTextIs(msg,
                "The object testSchema has been dropped successfully."), 3000, "Text was not found");

            const sec = await getLeftSection(driver, "DATABASE");
            const reloadDb = await sec?.findElement(By.xpath("//a[contains(@title, 'Reload Database Information')]"));
            await reloadDb?.click();
            await driver.wait(async () => {
                return (await sec?.findElements(By.xpath(
                    "//div[contains(@aria-label, 'testSchema') and contains(@role, 'treeitem')]")))!.length === 0;
            }, 50000, "testSchema is still on the list");

        });

        it("Table Context Menu - Show Data", async () => {

            await toggleTreeElement(driver, "DATABASE", conn.caption);
            await toggleTreeElement(driver, "DATABASE", conn.schema);
            await toggleTreeElement(driver, "DATABASE", "Tables");

            const el = await getTreeElement(driver, "DATABASE", "actor");
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.tableShowData);

            const ed = new EditorView();
            const activeTab = await ed.getActiveTab();
            expect(await activeTab!.getTitle()).equals(conn.caption);

            await driver.switchTo().frame(0);
            await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
            await driver.switchTo().frame(await driver.findElement(By.id("frame:" + conn.caption)));

            const resultHost = await driver.wait(until.elementLocated(
                By.css(".resultHost")), 10000, "query results were not found");
            const resultStatus = await resultHost.findElement(By.css(".resultStatus label"));
            expect(await resultStatus.getText()).to.match(new RegExp(/OK, (\d+) records/));

        });

        //feature under dev
        it.skip("Table Context Menu - Add Table to REST Service", async () => {

            await toggleTreeElement(driver, "DATABASE", conn.caption);
            await toggleTreeElement(driver, "DATABASE", conn.schema);
            await toggleTreeElement(driver, "DATABASE", "Tables");

            const el = await getTreeElement(driver, "DATABASE", "actor");
            await driver.actions()
                .mouseMove(el)
                .click(Button.RIGHT)
                .perform();

            await driver.sleep(500);
            await selectItem(ctxMenu.tableAddRest);

            const input = new InputBox();
            expect(await input.getText()).equals("/actor");
            await input.confirm();

            await toggleTreeElement(driver, "DATABASE", "MySQL REST Service");

        });

        //it("Table Context Menu - Drop Table", async () => {
        //});

        //it("View Context Menu - Show Data", async () => {
        //});

        //it("View Context Menu - Drop View", async () => {
        //});

    });

});
