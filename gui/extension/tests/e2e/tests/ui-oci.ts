/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
    BottomBarPanel,
    TextEditor,
    ModalDialog,
    error,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import fs from "fs/promises";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { Database, IConnMDS, IDBConnection, IConnBasicMySQL } from "../lib/db";
import { Shell } from "../lib/shell";
import * as constants from "../lib/constants";

if (!process.env.MYSQLSH_OCI_CONFIG_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_CONFIG_FILE");
}
if (!process.env.MYSQLSH_OCI_RC_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_RC_FILE");
}

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    before(async function () {

        await Misc.loadDriver();

        try {
            await driver.wait(Misc.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.ociTreeSection);
            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 2,
                `${await treeOCISection.getTitle()} is still loading`);

            await fs.writeFile(process.env.MYSQLSH_OCI_CONFIG_FILE, "");

            await Misc.clickSectionToolbarButton(treeOCISection,
                "Configure the OCI Profile list");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["config"]);
            const textEditor = new TextEditor();
            const editor = await driver.findElement(By.css("textarea"));
            let config = `[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmy`;
            config += `abcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\n`;
            config += `tenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo`;
            config += "5mmi2z3a\nregion=us-ashburn-1\nkey_file=";
            config += `${process.env.MYSQLSH_OCI_CONFIG_FILE.replace("config", "")}id_rsa_e2e.pem`;
            console.log(config);
            await editor.sendKeys(config);
            await textEditor.save();
            await Misc.clickSectionToolbarButton(treeOCISection, "Reload the OCI Profile list");

            const treeE2eTests = await Misc.getTreeElement(constants.ociTreeSection, "E2ETESTS (us-ashburn-1)");
            await treeE2eTests?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), 250000,
                `${await treeOCISection.getTitle()} is still loading`);

            const treeRoot = await treeOCISection.findItem("/ (Root Compartment)", constants.ociMaxLevel) ||
                await treeOCISection.findItem("/ (Root Compartment) (Default)", constants.ociMaxLevel);
            await treeRoot.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 20,
                `${await treeOCISection.getTitle()} is still loading`);

            const treeQA = await treeOCISection.findItem("QA", constants.ociMaxLevel) ||
                await treeOCISection.findItem("QA (Default)", constants.ociMaxLevel);
            await treeQA?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 20,
                `${await treeOCISection.getTitle()} is still loading`);

            const treeShellTesting = await Misc.getTreeElement(constants.ociTreeSection, "MySQLShellTesting");
            await treeShellTesting?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 20,
                `${await treeOCISection.getTitle()} is still loading`);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    describe("Profile", () => {

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
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

            const treeE2eTests = await Misc.getTreeElement(constants.ociTreeSection, "E2ETESTS (us-ashburn-1)");
            await Misc.openContexMenuItem(treeE2eTests, constants.viewConfigProfileInfo);
            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["E2ETESTS Info.json"]);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.ociExplicitWait, "No text was found on file");

        });

        it("Set as New Default Config Profile", async () => {

            const treeE2eTests = await Misc.getTreeElement(constants.ociTreeSection, "E2ETESTS (us-ashburn-1)");
            await Misc.openContexMenuItem(treeE2eTests, constants.setDefaultConfigProfile);
            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                `${await treeOCISection.getTitle()} is still loading`);
            await driver.wait(async () => {
                return Misc.isDefaultItem(treeE2eTests, "profile");
            }, constants.explicitWait * 2, "E2e tests is not the deault item");

        });
    });

    describe("Compartment", () => {

        let compartmentId = "";

        beforeEach(async function () {
            try {
                const treeOCISection = await Misc.getSection(constants.ociTreeSection);
                await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                    `${await treeOCISection.getTitle()} is still loading`);
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
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("View Compartment Information", async () => {

            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            const treeQA = await treeOCISection.findItem("QA", constants.ociMaxLevel) ||
                await treeOCISection.findItem("QA (Default)", constants.ociMaxLevel);
            await Misc.openContexMenuItem(treeQA, constants.viewCompartmentInfo);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("QA Info.json");
            }, constants.explicitWait, "'QA Info.json' was not opened");

            const textEditor = new TextEditor();
            let json = "";
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);
            }, constants.explicitWait * 2, "No text was found inside QA Info.json");

            const parsed = JSON.parse(json);
            compartmentId = parsed.id;

        });

        it("Set as Current Compartment", async () => {

            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            let treeQA = await treeOCISection.findItem("QA", constants.ociMaxLevel) ||
                await treeOCISection.findItem("QA (Default)", constants.ociMaxLevel);
            await Misc.openContexMenuItem(treeQA, constants.setCurrentCompartment);
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                `${await treeOCISection.getTitle()} is still loading`);
            treeQA = await treeOCISection.findItem("QA (Default)", constants.ociMaxLevel);
            expect(await Misc.isDefaultItem(treeQA, "compartment")).to.be.true;
            await treeQA.expand();
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 20,
                `${await treeOCISection.getTitle()} is still loading`);
            const treeShellTesting = await Misc.getTreeElement(constants.ociTreeSection, "MySQLShellTesting");
            await treeShellTesting.expand();
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 20,
                `${await treeOCISection.getTitle()} is still loading`);

            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);
            await Misc.openContexMenuItem(treeDBConnections, constants.openNewShellConsole, undefined, true);
            await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
            const result = await Misc.execCmd("mds.get.currentCompartmentId()", undefined, 60000);
            expect(result[0]).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.ociTreeSection);
                const treeOCISection = await Misc.getSection(constants.ociTreeSection);
                await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                    `${await treeOCISection.getTitle()} is still loading`);
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

        it("View DB System Information", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeDbSystem, constants.viewDBSystemInfo);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("MDSforVSCodeExtension Info.json");
            }, constants.explicitWait, "MDSforVSCodeExtension Info.json was not opened");

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.explicitWait, "No text was found inside MDSforVSCodeExtension Info.json");
        });

        it("Start a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeDbSystem, constants.startDBSystem);
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Start DB System (running)")).to.exist;
            await Misc.verifyNotification("Are you sure you want to start the DB System");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("NO");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await driver.wait(async () => {
                return treeTasksSection.findItem("Start DB System (done)", constants.tasksMaxLevel);
            }, constants.ociExplicitWait, "Start DB System (done) was not displayed");
        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeDbSystem, constants.restartDBSytem);
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Restart DB System (running)")).to.exist;
            await Misc.verifyNotification("Are you sure you want to restart the DB System");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("NO");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await driver.wait(async () => {
                const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);

                return treeTasksSection.findItem("Restart DB System (done)", constants.tasksMaxLevel);
            }, constants.ociExplicitWait, "Restart DB System (done) was not displayed");

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeDbSystem, constants.stopDBSytem);
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Stop DB System (running)")).to.exist;
            await Misc.verifyNotification("Are you sure you want to stop the DB System");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("NO");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await driver.wait(async () => {
                return Misc.getTreeElement(constants.tasksTreeSection, "Stop DB System (done)");
            }, constants.ociExplicitWait, "Stop DB System (done) was not displayed");

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeDbSystem, constants.deleteDBSystem);
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Delete DB System (running)")).to.exist;
            await Misc.verifyNotification("Are you sure you want to delete");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("NO");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await driver.wait(async () => {
                const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);

                return treeTasksSection.findItem("Delete DB System (done)", constants.tasksMaxLevel);
            }, constants.ociExplicitWait, "Delete DB System (done) was not displayed");

        });

    });

    describe("Bastion", () => {

        let mdsEndPoint = "";
        let dbSystemOCID = "";
        let bastionOCID = "";
        let skip = false;

        before(async function () {
            try {
                await Misc.sectionFocus(constants.ociTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.ociTreeSection);
                const treeOCISection = await Misc.getSection(constants.ociTreeSection);
                await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                    `${await treeOCISection.getTitle()} is still loading`);
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
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection?.collapse();

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

        it("Get Bastion Information and set it as current", async () => {

            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContexMenuItem(treeBastion, constants.getBastionInfo);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("Bastion4PrivateSubnetStandardVnc Info.json");
            }, constants.explicitWait, "Bastion4PrivateSubnetStandardVnc Info.json was not opened");

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                const text = await textEditor.getText();

                return text.indexOf("{") !== -1;
            }, constants.explicitWait, "No text was found inside Bastion4PrivateSubnetStandardVnc Info.json");

            let json: string;
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);
            }, constants.explicitWait, "Bastion4PrivateSubnetStandardVnc Info.json content is not json");

            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await Misc.openContexMenuItem(treeBastion, constants.setAsCurrentBastion);
            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            await driver.wait(Misc.isNotLoading(treeOCISection), constants.ociExplicitWait * 3,
                `${await treeOCISection.getTitle()} is still loading`);

            await driver.wait(async () => {
                return Misc.isDefaultItem(treeBastion, "bastion");
            }, constants.explicitWait * 2, "Bastion is not the deault item");

            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);

            await Misc.openContexMenuItem(treeDBConnections, constants.openNewShellConsole);
            await Misc.switchToWebView();
            await driver.wait(Shell.isShellLoaded(), constants.explicitWait * 3, "Shell Console was not loaded");
            const result = await Misc.execCmd("mds.get.currentBastionId()", undefined, 60000);
            expect(result[0]).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContexMenuItem(treeBastion, constants.refreshBastion);
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await Misc.waitForOutputText("Task 'Refresh Bastion' completed successfully", 20000);
            await outputView.clearText();
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Refresh Bastion (done)")).to.exist;
        });

        it("Delete Bastion", async () => {

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();
            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContexMenuItem(treeBastion, constants.deleteBastion);
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            expect(await Misc.getTreeElement(constants.tasksTreeSection, "Delete Bastion (running)")).to.exist;
            await Misc.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.ociTasksExplicitWait);
            await Misc.verifyNotification("Are you sure you want to delete");
            await driver.wait(async () => {
                try {
                    const workbench = new Workbench();
                    const ntfs = await workbench.getNotifications();
                    await ntfs[ntfs.length - 1].takeAction("NO");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.ElementNotInteractableError)) {
                        throw e;
                    }
                }
            }, constants.explicitWait, "Could not click on notification button");
            await driver.wait(Misc.getTreeElement(constants.tasksTreeSection, "Delete Bastion (error)"),
                constants.explicitWait, "'Delete Bastion (error)' was not found on the tree");

            await Misc.waitForOutputText("Deletion aborted", constants.explicitWait);
            await outputView.clearText();
            await bottomBar.toggle(false);

        });

        it("Create connection with Bastion Service", async function () {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            if (!await Misc.isDBSystemStopped(treeDbSystem)) {
                await Misc.openContexMenuItem(treeDbSystem, constants.createConnWithBastion);
                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes(constants.dbDefaultEditor);
                }, constants.explicitWait, "DB Connection Overview was not opened");

                await Misc.switchToWebView();
                await driver.wait(Database.isConnectionLoaded(), constants.explicitWait, "Connection was not loaded");
                const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                    10000, "Connection dialog was not loaded");

                expect(await newConDialog.findElement(By.id("caption")).getAttribute("value"))
                    .to.equal("MDSforVSCodeExtension");
                expect(await newConDialog.findElement(By.id("description")).getAttribute("value"))
                    .to.equal("DB System used to test the MySQL Shell for VSCode Extension.");
                mdsEndPoint = await newConDialog.findElement(By.id("hostName")).getAttribute("value");
                expect(mdsEndPoint).to.match(/(\d+).(\d+).(\d+).(\d+)/);
                await newConDialog.findElement(By.id("userName")).sendKeys("dba");
                const mdsTab = await newConDialog.findElement(By.id("page3"));
                expect(mdsTab).to.exist;
                await mdsTab.click();
                await driver.wait(async () => {
                    return await driver.findElement(By.id("mysqlDbSystemId")).getAttribute("value") !== "";
                }, 3000, "DbSystemID field was not set");
                dbSystemOCID = await driver.findElement(By.id("mysqlDbSystemId")).getAttribute("value");
                await driver.wait(async () => {
                    return await driver.findElement(By.id("bastionId")).getAttribute("value") !== "";
                }, 3000, "BastionID field was not set");
                bastionOCID = await driver.findElement(By.id("bastionId")).getAttribute("value");
                await newConDialog.findElement(By.id("ok")).click();
                await driver.switchTo().defaultContent();
                const mds = await Database.getWebViewConnection("MDSforVSCodeExtension");
                expect(mds).to.exist;
                await Misc.switchToWebView();
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

                try {
                    const confirmDialog = await driver.wait(until.elementLocated(By.css(".visible.confirmDialog")),
                        constants.explicitWait, "Confirm dialog was not displayed");
                    await confirmDialog.findElement(By.id("refuse")).click();
                } catch (e) {
                    // continue
                }

                await driver.wait(Database.isConnectionLoaded(),
                    constants.ociExplicitWait, "Connection was not loaded");
                const result = await Misc.execCmd("select version();", undefined, 10000);
                expect(result[0]).to.include("OK");
                await driver.switchTo().defaultContent();
                expect(await Misc.getTreeElement(constants.ociTreeSection,
                    "Bastion4PrivateSubnetStandardVnc")).to.exist;

            } else {
                await Misc.openContexMenuItem(treeDbSystem, constants.startDBSystem);
                await Misc.verifyNotification("Are you sure you want to start the DB System");
                await driver.wait(async () => {
                    try {
                        const workbench = new Workbench();
                        const ntfs = await workbench.getNotifications();
                        await ntfs[ntfs.length - 1].takeAction("Yes");

                        return true;
                    } catch (e) {
                        if (!(e instanceof error.ElementNotInteractableError)) {
                            throw e;
                        }
                    }
                }, constants.explicitWait, "Could not click on notification button");
                skip = true;
                this.skip();
            }

        });

        it("Edit an existing MDS Connection", async function () {

            if (skip) {
                this.skip();
            }

            const localMDSInfo: IConnMDS = {
                profile: "E2ETESTS",
                // eslint-disable-next-line max-len
                dbSystemOCID: "ocid1.mysqldbsystem.oc1.iad.aaaaaaaamggf5754p2fjtqhkguxpu6zgzzjyknx2irdh2exhdhkjy6y4s7va",
            };

            const mdsConn: IDBConnection = {
                dbType: "MySQL",
                caption: "MDSEdited",
                mds: localMDSInfo,
            };


            await Misc.sectionFocus(constants.dbTreeSection);
            const treeMDSConn = await Misc.getTreeElement(constants.dbTreeSection, "MDSforVSCodeExtension");
            await Misc.openContexMenuItem(treeMDSConn, constants.editDBConnection);
            await new EditorView().openEditor(constants.dbDefaultEditor);
            await Misc.switchToWebView();
            await Database.setConnection(
                "MySQL",
                mdsConn.caption,
                undefined,
                undefined,
                undefined,
                undefined,
                localMDSInfo,
            );

            await driver.switchTo().defaultContent();
            const treeDbSection = await Misc.getSection(constants.dbTreeSection);
            await driver.wait(Misc.isNotLoading(treeDbSection), constants.ociExplicitWait * 2,
                `${await treeDbSection.getTitle()} is still loading`);
            await Misc.getTreeElement(constants.dbTreeSection, mdsConn.caption, true);

        });

        it("Create a new MDS Connection", async function () {

            if (skip) {
                this.skip();
            }

            const localBasicInfo: IConnBasicMySQL = {
                hostname: mdsEndPoint,
                username: "dba",
                password: "MySQLR0cks!",
                port: 3306,
                ociBastion: true,
            };

            const localMDSInfo: IConnMDS = {
                profile: "E2ETESTS",
                sshPrivKey: "id_rsa_mysql_shell",
                sshPubKey: "id_rsa_mysql_shell.pub",
                dbSystemOCID: String(dbSystemOCID),
                bastionOCID: String(bastionOCID),
            };

            const localConn: IDBConnection = {
                dbType: "MySQL",
                caption: "LocalMDSConnection",
                description: "Local connection",
                basic: localBasicInfo,
                mds: localMDSInfo,
            };

            await Misc.sectionFocus(constants.dbTreeSection);

            await Database.createConnection(localConn);
            const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, localConn.caption, true);
            await new EditorView().closeAllEditors();
            await (await Misc.getActionButton(treeLocalConn, constants.openNewConnection)).click();
            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(localConn, 30000);
            const result = await Misc.execCmd("select version();", undefined, 10000);
            expect(result[0]).to.include("OK");

        });

    });

});
