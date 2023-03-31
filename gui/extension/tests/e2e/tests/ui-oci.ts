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
    TreeItem,
    CustomTreeSection,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import fs from "fs/promises";
import { expect } from "chai";
import {
    ociTreeSection,
    driver,
    explicitWait,
    ociExplicitWait,
    ociTasksExplicitWait,
    Misc,
    isExtPrepared,
    ociMaxLevel,
    tasksMaxLevel,
    dbEditorDefaultName,
    openEditorsTreeSection,
    tasksTreeSection,
    dbConnectionsLabel,
    openEditorsMaxLevel,
    dbTreeSection,
    dbMaxLevel,
} from "../lib/misc";

import { Database, IConnMDS, IDBConnection, IConnBasicMySQL } from "../lib/db";
import { Shell } from "../lib/shell";
import { homedir } from "os";
import { join } from "path";

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    let treeOCISection: CustomTreeSection;
    let treeOpenEditorsSection: CustomTreeSection;
    let treeTasksSection: CustomTreeSection;

    let treeE2eTests: TreeItem | undefined;
    let treeQA: TreeItem | undefined;
    let treeDbSystem: TreeItem | undefined; treeQA;
    let treeShellTesting: TreeItem | undefined;

    before(async function () {

        try {
            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            await Misc.sectionFocus(ociTreeSection);

            await Misc.toggleBottomBar(false);

            treeOCISection = await Misc.getSection(ociTreeSection);
            treeTasksSection = await Misc.getSection(tasksTreeSection);

            await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait*2,
                `${await treeOCISection.getTitle()} is still loading`);

            const path = join(homedir(), ".oci", "config");
            await fs.writeFile(path, "");

            await Misc.clickSectionToolbarButton(treeOCISection!,
                "Configure the OCI Profile list");

            const editors = await new EditorView().getOpenEditorTitles();
            expect(editors).to.include.members(["config"]);

            const textEditor = new TextEditor();

            const editor = await driver.findElement(By.css("textarea"));

            let config = `[E2ETESTS]\nuser=ocid1.user.oc1..aaaaaaaan67cojwa52khe44xtpqsygzxlk4te6gqs7nkmy`;
            config += `abcju2w5wlxcpq\nfingerprint=15:cd:e2:11:ed:0b:97:c4:e4:41:c5:44:18:66:72:80\n`;
            config += `tenancy=ocid1.tenancy.oc1..aaaaaaaaasur3qcs245czbgrlyshd7u5joblbvmxddigtubzqcfo`;
            config += `5mmi2z3a\nregion=us-ashburn-1\nkey_file= ${String(process.env.USERPROFILE)}/.oci/id_rsa_e2e.pem`;
            await editor.sendKeys(config);

            await textEditor.save();
            await Misc.clickSectionToolbarButton(treeOCISection, "Reload the OCI Profile list");

            treeE2eTests = await treeOCISection.findItem("E2ETESTS (us-ashburn-1)", ociMaxLevel);
            await treeE2eTests?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), 250000,
                `${await treeOCISection.getTitle()} is still loading`);

            const treeRoot = await treeOCISection.findItem("/ (Root Compartment)", ociMaxLevel);
            await treeRoot.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
                `${await treeOCISection.getTitle()} is still loading`);

            treeQA = await treeOCISection.findItem("QA (Default)", ociMaxLevel);
            await treeQA?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
                `${await treeOCISection.getTitle()} is still loading`);

            treeShellTesting = await treeOCISection.findItem("MySQLShellTesting", ociMaxLevel);
            await treeShellTesting?.expand();

            await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
                `${await treeOCISection.getTitle()} is still loading`);

            treeDbSystem = await treeOCISection.findItem("MDSforVSCodeExtension", ociMaxLevel);

            expect(treeDbSystem).to.exist;

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    after(async function () {

        try {
            await treeOCISection?.collapse();
            await fs.unlink(join(homedir(), ".oci", "config"));
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

            await Misc.selectContextMenuItem(treeE2eTests!, "View Config Profile Information");

            const editors = await new EditorView().getOpenEditorTitles();

            expect(editors).to.include.members(["E2ETESTS Info.json"]);

            const textEditor = new TextEditor();
            await driver.wait(async () => {


                return (await textEditor.getText()).includes("fingerprint");
            }, ociExplicitWait, "No text was found on file");

            expect(Misc.isJson(await textEditor.getText())).to.equal(true);

        });

        it("Set as New Default Config Profile", async () => {

            await Misc.selectContextMenuItem(treeE2eTests!, "Set as New Default Config Profile");

            expect(await Misc.isDefaultItem(treeE2eTests!, "profile")).to.be.true;
        });
    });

    describe("Compartment", () => {

        let compartmentId = "";
        let treeDBConnections: TreeItem;

        before(async function (){
            try {
                treeOpenEditorsSection = await Misc.getSection(openEditorsTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
            }
        });

        beforeEach(async function () {
            try {
                await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
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

            await Misc.selectContextMenuItem(treeQA, "View Compartment Information");

            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("QA Info.json");
            }, explicitWait, "'QA Info.json' was not opened");

            const textEditor = new TextEditor();
            let json = "";
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);

            }, explicitWait*2, "No text was found inside QA Info.json");

            const parsed = JSON.parse(json);
            compartmentId = parsed.id;

        });

        it("Set as Current Compartment", async () => {

            await Misc.selectContextMenuItem(treeQA, "Set as Current Compartment");

            expect(await Misc.isDefaultItem(treeQA, "compartment")).to.be.true;

            treeQA = await treeOCISection.findItem("QA (Default)", ociMaxLevel);

            expect(treeQA).to.exist;

            await treeOpenEditorsSection.expand();

            treeDBConnections = await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(treeDBConnections, "Open New MySQL Shell Console");

            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            const result = await Misc.execCmd("mds.get.currentCompartmentId()", undefined, 60000);

            expect(result[0]).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(ociTreeSection);
                treeDbSystem = await treeOCISection.findItem("MDSforVSCodeExtension", ociMaxLevel);
                await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
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

            await Misc.selectContextMenuItem(treeDbSystem!, "View DB System Information");

            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("MDSforVSCodeExtension Info.json");
            }, explicitWait, "MDSforVSCodeExtension Info.json was not opened");


            const textEditor = new TextEditor();
            await driver.wait(async () => {
                const text = await textEditor.getText();

                return text.includes("{");
            }, explicitWait, "No text was found inside MDSforVSCodeExtension Info.json");

            let json = await textEditor.getText();
            if (Array.from(json)[0] === "a") {
                json = json.slice(1);
            }

            expect(Misc.isJson(json)).to.equal(true);


        });

        it("Start a DB System (and cancel)", async () => {

            await Misc.selectContextMenuItem(treeDbSystem, "Start the DB System");

            expect(await treeTasksSection.findItem("Start DB System (running)", tasksMaxLevel)).to.exist;

            await Misc.verifyNotification("Are you sure you want to start the DB System");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("NO");

            await driver.wait(async () => {
                return treeTasksSection.findItem("Start DB System (done)", tasksMaxLevel);
            }, ociExplicitWait, "Start DB System (done) was not displayed");
        });

        it("Restart a DB System (and cancel)", async () => {

            await Misc.selectContextMenuItem(treeDbSystem, "Restart the DB System");

            expect(await treeTasksSection.findItem("Restart DB System (running)", tasksMaxLevel)).to.exist;

            await Misc.verifyNotification("Are you sure you want to restart the DB System");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("NO");

            await driver.wait(async () => {
                return treeTasksSection.findItem("Restart DB System (done)", tasksMaxLevel);
            }, ociExplicitWait, "Restart DB System (done) was not displayed");

        });

        it("Stop a DB System (and cancel)", async () => {

            await Misc.selectContextMenuItem(treeDbSystem, "Stop the DB System");

            expect(await treeTasksSection.findItem("Stop DB System (running)", tasksMaxLevel)).to.exist;

            await Misc.verifyNotification("Are you sure you want to stop the DB System");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("NO");

            await driver.wait(async () => {
                return treeTasksSection.findItem("Stop DB System (done)", tasksMaxLevel);
            }, ociExplicitWait, "Stop DB System (done) was not displayed");

        });

        it("Delete a DB System (and cancel)", async () => {

            await Misc.selectContextMenuItem(treeDbSystem, "Delete the DB System");

            expect(await treeTasksSection.findItem("Delete DB System (running)", tasksMaxLevel)).to.exist;

            await Misc.verifyNotification("Are you sure you want to delete");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("NO");

            await driver.wait(async () => {
                return treeTasksSection.findItem("Delete DB System (done)", tasksMaxLevel);
            }, ociExplicitWait, "Delete DB System (done) was not displayed");

        });

    });

    describe("Bastion", () => {

        let treeBastion: TreeItem | undefined;
        let mdsEndPoint = "";
        let dbSystemOCID = "";
        let bastionOCID = "";
        let skip = false;

        before(async function () {
            try {
                await Misc.sectionFocus(ociTreeSection);
                treeDbSystem = await treeOCISection.findItem("MDSforVSCodeExtension", ociMaxLevel);
                treeBastion = await treeOCISection.findItem("Bastion4PrivateSubnetStandardVnc", ociMaxLevel);
                expect(treeBastion).to.exist;
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await Misc.sectionFocus(ociTreeSection);
                await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
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

        after(async function () {
            try {
                await Misc.toggleBottomBar(false);
                await treeTasksSection?.collapse();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Get Bastion Information and set it as current", async () => {

            await Misc.selectContextMenuItem(treeBastion!, "Get Bastion Information");

            await driver.wait(async () => {
                const editors = await new EditorView().getOpenEditorTitles();

                return editors.includes("Bastion4PrivateSubnetStandardVnc Info.json");
            }, explicitWait, "Bastion4PrivateSubnetStandardVnc Info.json was not opened");

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                const text = await textEditor.getText();

                return text.indexOf("{") !== -1;
            }, explicitWait, "No text was found inside Bastion4PrivateSubnetStandardVnc Info.json");

            const json = await textEditor.getText();
            expect(Misc.isJson(json)).to.equal(true);
            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await Misc.selectContextMenuItem(treeBastion!, "Set as Current Bastion");

            await driver.wait(Misc.isNotLoading(treeOCISection), ociExplicitWait,
                `${await treeOCISection.getTitle()} is still loading`);

            expect(await Misc.isDefaultItem(treeBastion!, "bastion")).to.be.true;

            await treeOpenEditorsSection.expand();

            const treeDBConnections = await treeOpenEditorsSection.findItem(dbConnectionsLabel, openEditorsMaxLevel);

            await Misc.selectContextMenuItem(treeDBConnections, "Open New MySQL Shell Console");

            await Misc.switchToWebView();

            await driver.wait(Shell.isShellLoaded(), explicitWait * 3, "Shell Console was not loaded");

            const result = await Misc.execCmd("mds.get.currentBastionId()", undefined, 60000);

            expect(result[0]).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            await Misc.selectContextMenuItem(treeBastion!, "Refresh When Bastion Reaches Active State");

            await treeTasksSection.expand();

            expect(await treeTasksSection.findItem("Refresh Bastion (running)", tasksMaxLevel)).to.exist;

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();

            await Misc.waitForOutputText("Task 'Refresh Bastion' completed successfully", 20000);

            await outputView.clearText();

            expect(await treeTasksSection.findItem("Refresh Bastion (done)", tasksMaxLevel)).to.exist;
        });

        it("Delete Bastion", async () => {

            const bottomBar = new BottomBarPanel();
            const outputView = await bottomBar.openOutputView();
            await outputView.clearText();
            treeBastion = await treeOCISection.findItem("Bastion4PrivateSubnetStandardVnc", ociMaxLevel);
            await Misc.selectContextMenuItem(treeBastion!, "Delete Bastion");

            await treeTasksSection.expand();

            expect(await treeTasksSection.findItem("Delete Bastion (running)", ociMaxLevel)).to.exist;

            await Misc.waitForOutputText("OCI profile 'E2ETESTS' loaded.", ociTasksExplicitWait);

            await Misc.verifyNotification("Are you sure you want to delete");

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("NO");

            await driver.wait(treeTasksSection.findItem("Delete Bastion (error)", ociMaxLevel),
                explicitWait, "'Delete Bastion (error)' was not found on the tree");

            await Misc.waitForOutputText("Deletion aborted", explicitWait);

            await outputView.clearText();

            await bottomBar.toggle(false);

        });

        it("Create connection with Bastion Service", async function () {

            if (!await Misc.isDBSystemStopped(treeDbSystem)) {

                await Misc.selectContextMenuItem(treeDbSystem, "Create Connection with Bastion Service");

                await driver.wait(async () => {
                    const editors = await new EditorView().getOpenEditorTitles();

                    return editors.includes(dbEditorDefaultName);
                }, explicitWait, "DB Connections was not opened");

                await Misc.switchToWebView();

                await driver.wait(Database.isConnectionLoaded(), explicitWait, "Connection was not loaded");

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
                        explicitWait, "Confirm dialog was not displayed");
                    await confirmDialog.findElement(By.id("refuse")).click();
                } catch (e) {
                        // continue
                }

                await driver.wait(Database.isConnectionLoaded(), ociExplicitWait, "Connection was not loaded");

                const result = await Misc.execCmd("select version();", undefined, 10000);

                expect(result[0]).to.include("OK");

                await driver.switchTo().defaultContent();

                expect(await treeOCISection.findItem("Bastion4PrivateSubnetStandardVnc", ociMaxLevel)).to.exist;

            } else {
                await Misc.selectContextMenuItem(treeDbSystem!, "Start the DB System");

                await Misc.verifyNotification("Are you sure you want to start the DB System");

                const workbench = new Workbench();
                const ntfs = await workbench.getNotifications();

                await ntfs[ntfs.length - 1].takeAction("Yes");

                skip = true;

                this.skip();
            }

        });

        it("Edit an existing MDS Connection", async function (){

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


            await Misc.sectionFocus(dbTreeSection);

            const treeDBSection = await Misc.getSection(dbTreeSection);

            const treeMDSConn = await treeDBSection.findItem("MDSforVSCodeExtension", dbMaxLevel);

            await Misc.selectContextMenuItem(treeMDSConn, "Edit DB Connection");

            await new EditorView().openEditor(dbEditorDefaultName);

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

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            expect(await treeDBSection.findItem(mdsConn.caption, dbMaxLevel)).to.exist;

        });

        it("Create a new MDS Connection", async function() {

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

            await Misc.sectionFocus(dbTreeSection);

            await Database.createConnection(localConn);
            const treeDBSection = await Misc.getSection(dbTreeSection);
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
            const treeLocalConn = await treeDBSection.findItem(localConn.caption, dbMaxLevel);
            expect(treeLocalConn).to.exist;

            await new EditorView().closeAllEditors();

            await (await Misc.getActionButton(treeLocalConn, "Connect to Database")).click();

            await Misc.switchToWebView();
            await driver.wait(Database.isConnectionLoaded(), explicitWait * 3, "DB Connection was not loaded");
            await Database.setPassword(localConn);
            try {
                await Misc.setConfirmDialog(localConn, "no", 30000);
            } catch (e) {
                // continue
            }

            const result = await Misc.execCmd("select version();", undefined, 10000);
            expect(result[0]).to.include("OK");

        });

    });

});
