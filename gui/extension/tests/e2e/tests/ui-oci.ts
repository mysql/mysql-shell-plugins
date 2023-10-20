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
import fs from "fs/promises";
import { expect } from "chai";
import {
    EditorView,
    until,
    BottomBarPanel,
    TextEditor,
    ModalDialog,
} from "vscode-extension-tester";
import { driver, Misc } from "../lib/misc";
import { Database } from "../lib/db";
import { Shell } from "../lib/shell";
import * as constants from "../lib/constants";
import * as Until from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";

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
            await driver.wait(Until.extensionIsReady(), constants.wait2minutes, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.ociTreeSection);
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait20seconds,
                `${constants.ociTreeSection} is still loading`);

            await fs.writeFile(process.env.MYSQLSH_OCI_CONFIG_FILE, "");

            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            await Misc.clickSectionToolbarButton(treeOCISection,
                "Configure the OCI Profile list");

            await driver.wait(async () => {
                return (await new EditorView().getOpenEditorTitles()).includes("config");
            }, constants.wait5seconds, "config editor was not opened");

            const textEditor = new TextEditor();
            const editor = await driver.findElement(locator.notebook.codeEditor.textArea);
            let config = `[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmy`;
            config += `abcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\n`;
            config += `tenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo`;
            config += "5mmi2z3a\nregion=us-ashburn-1\nkey_file=";
            config += `${process.env.MYSQLSH_OCI_CONFIG_FILE.replace("config", "")}id_rsa_e2e.pem`;
            console.log(config);
            await driver.wait(async () => {
                await editor.sendKeys(config);
                const text = await textEditor.getText();
                if (text.includes("E2ETESTS")) {
                    await textEditor.save();

                    return true;
                }
            }, constants.wait5seconds, "Could no set the config file");

            await Misc.clickSectionToolbarButton(treeOCISection, "Reload the OCI Profile list");
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    describe("Profile", () => {

        beforeEach(async function () {
            try {
                await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                    `${constants.ociTreeSection} is still loading`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
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
            await Misc.openContextMenuItem(treeE2eTests, constants.viewConfigProfileInfo, constants.checkNewTab);
            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["E2ETESTS Info.json"]);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait10seconds, "No text was found on file");

        });

        it("Set as New Default Config Profile", async () => {

            const treeE2eTests = await Misc.getTreeElement(constants.ociTreeSection, "E2ETESTS (us-ashburn-1)");
            await Misc.openContextMenuItem(treeE2eTests, constants.setDefaultConfigProfile, undefined);
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                `${constants.ociTreeSection} is still loading`);
            await driver.wait(Until.isDefaultItem(constants.ociTreeSection, "E2ETESTS (us-ashburn-1)", "profile"),
                constants.wait5seconds, "E2e tests is not the deault item");
        });
    });

    describe("Compartment", () => {

        let compartmentId = "";

        before(async function () {
            try {
                await Misc.expandTree(constants.ociTreeSection, [
                    "E2ETESTS (us-ashburn-1)",
                    /(Root Compartment)/,
                    /QA/,
                    "MySQLShellTesting",
                ], constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
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

            const treeQA = await Misc.getTreeElement(constants.ociTreeSection, /QA/);
            await Misc.openContextMenuItem(treeQA, constants.viewCompartmentInfo, constants.checkNewTab);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("QA Info.json");
            }, constants.wait5seconds, "'QA Info.json' was not opened");

            const textEditor = new TextEditor();
            let json = "";
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);
            }, constants.wait5seconds * 2, "No text was found inside QA Info.json");

            const parsed = JSON.parse(json);
            compartmentId = parsed.id;

        });

        it("Set as Current Compartment", async () => {

            let treeQA = await Misc.getTreeElement(constants.ociTreeSection, /QA/);
            await Misc.openContextMenuItem(treeQA, constants.setCurrentCompartment, undefined);
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                `${constants.ociTreeSection} is still loading`);
            const treeOCISection = await Misc.getSection(constants.ociTreeSection);
            treeQA = await treeOCISection.findItem("QA (Default)", constants.ociMaxLevel);
            await driver.wait(Until.isDefaultItem(constants.ociTreeSection, "QA (Default)", "compartment"),
                constants.wait5seconds, "QA (Default) should be default");
            await treeQA.expand();
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait20seconds,
                `${constants.ociTreeSection} is still loading`);
            const treeShellTesting = await Misc.getTreeElement(constants.ociTreeSection, "MySQLShellTesting");
            await treeShellTesting.expand();
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait20seconds,
                `${constants.ociTreeSection} is still loading`);
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);
            await Misc.openContextMenuItem(treeDBConnections, constants.openNewShellConsole,
                constants.checkNewTabAndWebView);
            await driver.wait(Shell.isShellLoaded(), constants.wait5seconds * 3, "Shell Console was not loaded");
            const result = await Misc.execCmd("mds.get.currentCompartmentId()", undefined, 60000);
            expect(result[0]).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        before(async function () {
            try {
                await Misc.expandTree(constants.ociTreeSection, [
                    "E2ETESTS (us-ashburn-1)",
                    /(Root Compartment)/,
                    /QA/,
                    "MySQLShellTesting",
                ], constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.ociTreeSection);
                await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                    `${constants.ociTreeSection} is still loading`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
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
            await Misc.openContextMenuItem(treeDbSystem, constants.viewDBSystemInfo, constants.checkNewTab);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("MDSforVSCodeExtension Info.json");
            }, constants.wait5seconds, "MDSforVSCodeExtension Info.json was not opened");

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait5seconds, "No text was found inside MDSforVSCodeExtension Info.json");
        });

        it("Start a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContextMenuItem(treeDbSystem, constants.startDBSystem, constants.checkNotif);
            await Misc.expandTreeSection(constants.tasksTreeSection);
            try {
                expect(await Misc.existsTreeElement(constants.tasksTreeSection,
                    "Start DB System (running)")).to.be.true;
                const ntf = await Misc.getNotification("Are you sure you want to start the DB System", false);
                await Misc.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Misc.existsTreeElement(constants.tasksTreeSection, "Start DB System (done)"));
                }, constants.wait10seconds, "Start DB System (done) was not displayed");
            } finally {
                await Misc.collapseTreeSection(constants.tasksTreeSection);
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContextMenuItem(treeDbSystem, constants.restartDBSytem, constants.checkNotif);
            await Misc.expandTreeSection(constants.tasksTreeSection);
            try {
                expect(await Misc.existsTreeElement(constants.tasksTreeSection,
                    "Restart DB System (running)")).to.be.true;
                const ntf = await Misc.getNotification("Are you sure you want to restart the DB System", false);
                await Misc.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Misc.existsTreeElement(constants.tasksTreeSection, "Restart DB System (done)"));
                }, constants.wait10seconds, "Restart DB System (done) was not displayed");
            } finally {
                await Misc.collapseTreeSection(constants.tasksTreeSection);
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContextMenuItem(treeDbSystem, constants.stopDBSytem, constants.checkNotif);
            await Misc.expandTreeSection(constants.tasksTreeSection);
            try {
                expect(await Misc.existsTreeElement(constants.tasksTreeSection, "Stop DB System (running)")).to.be.true;
                const ntf = await Misc.getNotification("Are you sure you want to stop the DB System", false);
                await Misc.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Misc.existsTreeElement(constants.tasksTreeSection, "Stop DB System (done)"));
                }, constants.wait10seconds, "Stop DB System (done) was not displayed");
            } finally {
                await Misc.collapseTreeSection(constants.tasksTreeSection);
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            await Misc.openContextMenuItem(treeDbSystem, constants.deleteDBSystem, constants.checkNotif);
            await Misc.expandTreeSection(constants.tasksTreeSection);
            try {
                expect(await Misc.existsTreeElement(constants.tasksTreeSection,
                    "Delete DB System (running)")).to.be.true;
                const ntf = await Misc.getNotification("Are you sure you want to delete", false);
                await Misc.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Misc.existsTreeElement(constants.tasksTreeSection, "Delete DB System (done)"));
                }, constants.wait10seconds, "Delete DB System (done) was not displayed");
            } finally {
                await Misc.collapseTreeSection(constants.tasksTreeSection);
            }

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
                before(async function () {
                    try {
                        await Misc.expandTree(constants.ociTreeSection, [
                            "E2ETESTS (us-ashburn-1)",
                            /(Root Compartment)/,
                            /QA/,
                            "MySQLShellTesting",
                        ], constants.wait5seconds * 5);
                    } catch (e) {
                        await Misc.processFailure(this);
                        throw e;
                    }
                });
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(constants.ociTreeSection);
                await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                    `${constants.ociTreeSection} is still loading`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Misc.switchBackToTopFrame();
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection?.collapse();

        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
                await Misc.sectionFocus(constants.dbTreeSection);
                const dbConnections = await Misc.getDBConnections();
                for (const dbConnection of dbConnections) {
                    await Misc.deleteConnection(dbConnection.name, dbConnection.isMySQL, false);
                }
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Get Bastion Information and set it as current", async () => {


            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContextMenuItem(treeBastion, constants.getBastionInfo, constants.checkNewTab);
            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("Bastion4PrivateSubnetStandardVnc Info.json");
            }, constants.wait5seconds, "Bastion4PrivateSubnetStandardVnc Info.json was not opened");

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                const text = await textEditor.getText();

                return text.indexOf("{") !== -1;
            }, constants.wait5seconds, "No text was found inside Bastion4PrivateSubnetStandardVnc Info.json");

            let json: string;
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);
            }, constants.wait5seconds, "Bastion4PrivateSubnetStandardVnc Info.json content is not json");

            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await new EditorView().closeEditor("Bastion4PrivateSubnetStandardVnc Info.json");
            await new ModalDialog().pushButton("Don't Save");

            await Misc.openContextMenuItem(treeBastion, constants.setAsCurrentBastion, undefined);
            await driver.wait(Until.isNotLoading(constants.ociTreeSection), constants.wait25seconds,
                `${constants.ociTreeSection} is still loading`);

            await driver.wait(Until.isDefaultItem(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc",
                "bastion"),
                constants.wait5seconds * 2, "Bastion is not the deault item");
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);

            await Misc.openContextMenuItem(treeDBConnections, constants.openNewShellConsole,
                constants.checkNewTabAndWebView);
            await driver.wait(Shell.isShellLoaded(), constants.wait5seconds * 3, "Shell Console was not loaded");
            const result = await Misc.execCmd("mds.get.currentBastionId()", undefined, 60000);
            expect(result[0]).to.equal(bastionId);


        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContextMenuItem(treeBastion, constants.refreshBastion, undefined);
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await Misc.waitForOutputText("Task 'Refresh Bastion' completed successfully", 20000);
            await outputView.clearText();
            expect(await Misc.existsTreeElement(constants.tasksTreeSection, "Refresh Bastion (done)")).to.be.true;
        });

        it("Delete Bastion", async () => {

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();
            const treeBastion = await Misc.getTreeElement(constants.ociTreeSection, "Bastion4PrivateSubnetStandardVnc");
            await Misc.openContextMenuItem(treeBastion, constants.deleteBastion, undefined);
            const treeTasksSection = await Misc.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            expect(await Misc.existsTreeElement(constants.tasksTreeSection, "Delete Bastion (running)")).to.be.true;
            await Misc.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.wait25seconds);
            const ntf = await Misc.getNotification("Are you sure you want to delete", false);
            await Misc.clickOnNotificationButton(ntf, "NO");
            await Misc.waitForOutputText("Deletion aborted", constants.wait5seconds);
            expect(await Misc.existsTreeElement(constants.tasksTreeSection, "Delete Bastion (error)")).to.be.true;
            await outputView.clearText();
            await bottomBar.toggle(false);

        });

        it("Create connection with Bastion Service", async function () {

            const treeDbSystem = await Misc.getTreeElement(constants.ociTreeSection, "MDSforVSCodeExtension");
            if (!await Misc.isDBSystemStopped(treeDbSystem)) {
                await Misc.openContextMenuItem(treeDbSystem, constants.createConnWithBastion,
                    constants.checkNewTabAndWebView);

                const bastionConn: interfaces.IDBConnection = {
                    dbType: "MySQL",
                    caption: `MDSforVSCodeExtension`,
                    description: "DB System used to test the MySQL Shell for VSCode Extension.",
                    basic: {
                        username: "dba",
                        password: "MySQLR0cks!",
                    },
                };

                await driver.wait(Until.dbConnectionIsOpened(bastionConn),
                    constants.wait5seconds, "Connection was not opened");
                const newConDialog = await driver.wait(until.elementLocated(locator.dbConnectionDialog.exists),
                    constants.wait10seconds, "Connection dialog was not loaded");
                expect(await newConDialog.findElement(locator.dbConnectionDialog.caption).getAttribute("value"))
                    .to.equal(bastionConn.caption);
                expect(await newConDialog.findElement(locator.dbConnectionDialog.description).getAttribute("value"))
                    .to.equal(bastionConn.description);
                mdsEndPoint = await newConDialog
                    .findElement(locator.dbConnectionDialog.mysql.basic.hostname).getAttribute("value");
                expect(mdsEndPoint).to.match(/(\d+).(\d+).(\d+).(\d+)/);
                await newConDialog.findElement(locator.dbConnectionDialog.mysql.basic.username)
                    .sendKeys((bastionConn.basic as interfaces.IConnBasicMySQL).username);
                const mdsTab = await newConDialog.findElement(locator.dbConnectionDialog.mdsTab);
                expect(mdsTab).to.exist;
                await mdsTab.click();
                await driver.wait(async () => {
                    return await driver
                        .findElement(locator.dbConnectionDialog.mysql.mds.dbDystemId).getAttribute("value") !== "";
                }, 3000, "DbSystemID field was not set");
                dbSystemOCID = await driver
                    .findElement(locator.dbConnectionDialog.mysql.mds.dbDystemId).getAttribute("value");
                await driver.wait(async () => {
                    return await driver
                        .findElement(locator.dbConnectionDialog.mysql.mds.bastionId).getAttribute("value") !== "";
                }, 3000, "BastionID field was not set");
                bastionOCID = await driver
                    .findElement(locator.dbConnectionDialog.mysql.mds.bastionId).getAttribute("value");
                await newConDialog.findElement(locator.dbConnectionDialog.ok).click();
                await Misc.switchBackToTopFrame();
                const mds = await Database.getWebViewConnection(bastionConn.caption);
                expect(mds).to.exist;
                await Misc.switchToFrame();
                await mds.click();
                try {
                    await driver.wait(Until.mdsConnectionIsOpened(bastionConn), constants.wait25seconds,
                        "MDS Connection was not opened");
                } catch (e) {
                    if (String(e).match(/Tunnel/) !== null) {
                        await Misc.switchBackToTopFrame();
                        await new EditorView().closeEditor(constants.dbDefaultEditor);
                        skip = true;
                        this.skip();
                    }
                }
                const result = await Misc.execCmd("select version();", undefined, constants.wait10seconds);
                expect(result[0]).to.include("OK");
            } else {
                await Misc.openContextMenuItem(treeDbSystem, constants.startDBSystem, constants.checkNotif);
                const ntf = await Misc.getNotification("Are you sure you want to start the DB System", false);
                await Misc.clickOnNotificationButton(ntf, "Yes");
                skip = true;
                this.skip();
            }

        });

        it("Edit an existing MDS Connection", async function () {

            if (skip) {
                this.skip();
            }

            const localMDSInfo: interfaces.IConnMDS = {
                profile: "E2ETESTS",
                // eslint-disable-next-line max-len
                dbSystemOCID: "ocid1.mysqldbsystem.oc1.iad.aaaaaaaamggf5754p2fjtqhkguxpu6zgzzjyknx2irdh2exhdhkjy6y4s7va",
            };

            const mdsConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: "MDSEdited",
                mds: localMDSInfo,
            };

            await Misc.switchBackToTopFrame();
            await Misc.sectionFocus(constants.dbTreeSection);
            const treeMDSConn = await Misc.getTreeElement(constants.dbTreeSection, "MDSforVSCodeExtension");
            await Misc.openContextMenuItem(treeMDSConn, constants.editDBConnection, constants.checkNewTabAndWebView);
            await Database.setConnection(
                "MySQL",
                mdsConn.caption,
                undefined,
                undefined,
                undefined,
                undefined,
                localMDSInfo,
            );

            await Misc.switchBackToTopFrame();
            expect(await Misc.existsTreeElement(constants.dbTreeSection, mdsConn.caption)).to.be.true;

        });

        it("Create a new MDS Connection", async function () {

            if (skip) {
                this.skip();
            }

            const localConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: "LocalMDSConnection",
                description: "Local connection",
                basic: {
                    hostname: mdsEndPoint,
                    username: "dba",
                    password: "MySQLR0cks!",
                    port: 3306,
                    ociBastion: true,
                },
                mds: {
                    profile: "E2ETESTS",
                    sshPrivKey: "id_rsa_mysql_shell",
                    sshPubKey: "id_rsa_mysql_shell.pub",
                    dbSystemOCID: String(dbSystemOCID),
                    bastionOCID: String(bastionOCID),
                },
            };

            await Misc.sectionFocus(constants.dbTreeSection);

            await Database.createConnection(localConn);
            const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, localConn.caption);
            await new EditorView().closeAllEditors();
            await (await Misc.getActionButton(treeLocalConn, constants.openNewConnection)).click();
            await driver.wait(Until.mdsConnectionIsOpened(localConn),
                constants.wait10seconds, "Connection was not opened");
            const result = await Misc.execCmd("select version();", undefined, 10000);
            expect(result[0]).to.include("OK");

        });

    });

});
