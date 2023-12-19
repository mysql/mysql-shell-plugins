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

import { expect } from "chai";
import {
    EditorView,
    until,
    BottomBarPanel,
    TextEditor,
    OutputView,
} from "vscode-extension-tester";
import { driver, Misc } from "../lib/misc";
import { DatabaseConnection } from "../lib/webviews/dbConnection";
import { Shell } from "../lib/shell";
import { CommandExecutor } from "../lib/cmdExecutor";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";

let ociConfig: { [key: string]: string };
let ociTree: RegExp[];

if (!process.env.MYSQLSH_OCI_CONFIG_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_CONFIG_FILE");
}
if (!process.env.MYSQLSH_OCI_RC_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_RC_FILE");
}

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    before(async function () {

        ociConfig = await Misc.mapOciConfig();

        ociTree = [
            `${ociConfig.name} (${ociConfig.region})`,
            "(Root Compartment)"]
            .concat(process.env.OCI_OBJECTS_PATH.split("/")).map((el: string) => {
                return new RegExp(el
                    .replace(/\(/g, "\\(")
                    .replace(/\)/g, "\\)"),
                );
            });

        await Misc.loadDriver();

        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await Section.focus(constants.ociTreeSection);
            const treeOCISection = await Section.getSection(constants.ociTreeSection);
            await Section.clickToolbarButton(treeOCISection,
                "Configure the OCI Profile list");

            await driver.wait(async () => {
                return (await new EditorView().getOpenEditorTitles()).includes("config");
            }, constants.wait5seconds, "config editor was not opened");
            await Section.clickToolbarButton(treeOCISection, "Reload the OCI Profile list");
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
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

            const editors = await Workbench.getOpenEditorTitles();
            for (const editor of editors) {
                await Workbench.closeEditor(editor);
                try {
                    await Workbench.pushDialogButton("Don't Save");
                } catch (e) {
                    //continue
                }
            }
        });

        it("View Config Profile Information", async () => {

            const treeE2eTests = await Tree.getElement(constants.ociTreeSection,
                `${ociConfig.name} (${ociConfig.region})`);
            await Tree.openContextMenuAndSelect(treeE2eTests, constants.viewConfigProfileInfo);
            await driver.wait(waitUntil.tabIsOpened(`${ociConfig.name} Info.json`), constants.wait5seconds);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait10seconds, "No text was found on file");

        });

        it("Set as New Default Config Profile", async () => {

            const treeE2eTests = await Tree.getElement(constants.ociTreeSection,
                `${ociConfig.name} (${ociConfig.region})`);
            await Tree.openContextMenuAndSelect(treeE2eTests, constants.setDefaultConfigProfile, undefined);
            await driver.wait(waitUntil.isDefaultItem(constants.ociTreeSection,
                `${ociConfig.name} (${ociConfig.region})`, "profile"),
                constants.wait5seconds, "E2e tests is not the deault item");
        });
    });

    describe("Compartment", () => {

        let compartmentId = "";

        before(async function () {
            try {
                await Tree.expandElement(constants.ociTreeSection, ociTree, constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            const editors = await Workbench.getOpenEditorTitles();
            for (const editor of editors) {
                await Workbench.closeEditor(editor);
                try {
                    await Workbench.pushDialogButton("Don't Save");
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
            const treeComparment = await Tree.getElement(constants.ociTreeSection, ociTree[2]);
            await Tree.openContextMenuAndSelect(treeComparment, constants.viewCompartmentInfo);
            await driver.wait(waitUntil.tabIsOpened(`${ociTree[2].source} Info.json`), constants.wait5seconds);
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

            const treeCompartment = await Tree.getElement(constants.ociTreeSection, ociTree[2]);
            await Tree.openContextMenuAndSelect(treeCompartment, constants.setCurrentCompartment, undefined);
            await driver.wait(waitUntil.isDefaultItem(constants.ociTreeSection, `${ociTree[2].source} (Default)`,
                "compartment"),
                constants.wait5seconds, `${ociTree[2].source} (Default) should be marked as default on the tree`);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await Tree.expandElement(constants.ociTreeSection, slicedOciTree, constants.wait5seconds * 5);
            const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);
            await Tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
            await driver.wait(Shell.isShellLoaded(), constants.wait5seconds * 3, "Shell Console was not loaded");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("mds.get.currentCompartmentId()");
            expect(commandExecutor.getResultMessage()).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        before(async function () {
            try {
                await Tree.expandElement(constants.ociTreeSection, ociTree, constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            const editors = await Workbench.getOpenEditorTitles();
            for (const editor of editors) {
                await Workbench.closeEditor(editor);
                try {
                    await Workbench.pushDialogButton("Don't Save");
                } catch (e) {
                    //continue
                }
            }
        });

        it("View DB System Information", async () => {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeDbSystem, constants.viewDBSystemInfo);
            await driver.wait(waitUntil.tabIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait5seconds, `No text was found inside ${await treeDbSystem.getLabel()} Info.json`);
        });

        it("Start a DB System (and cancel)", async () => {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeDbSystem, constants.startDBSystem);
            await Section.expand(constants.tasksTreeSection);
            try {
                expect(await Tree.existsElement(constants.tasksTreeSection,
                    "Start DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Tree.existsElement(constants.tasksTreeSection, "Start DB System (done)"));
                }, constants.wait10seconds, "Start DB System (done) was not displayed");
            } finally {
                await Section.collapse(constants.tasksTreeSection);
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeDbSystem, constants.restartDBSytem);
            await Section.expand(constants.tasksTreeSection);
            try {
                expect(await Tree.existsElement(constants.tasksTreeSection,
                    "Restart DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to restart the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Tree.existsElement(constants.tasksTreeSection, "Restart DB System (done)"));
                }, constants.wait10seconds, "Restart DB System (done) was not displayed");
            } finally {
                await Section.collapse(constants.tasksTreeSection);
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeDbSystem, constants.stopDBSytem);
            await Section.expand(constants.tasksTreeSection);
            try {
                expect(await Tree.existsElement(constants.tasksTreeSection, "Stop DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to stop the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Tree.existsElement(constants.tasksTreeSection, "Stop DB System (done)"));
                }, constants.wait10seconds, "Stop DB System (done) was not displayed");
            } finally {
                await Section.collapse(constants.tasksTreeSection);
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeDbSystem, constants.deleteDBSystem);
            await Section.expand(constants.tasksTreeSection);
            try {
                expect(await Tree.existsElement(constants.tasksTreeSection,
                    "Delete DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (Tree.existsElement(constants.tasksTreeSection, "Delete DB System (done)"));
                }, constants.wait10seconds, "Delete DB System (done) was not displayed");
            } finally {
                await Section.collapse(constants.tasksTreeSection);
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
                await Tree.expandElement(constants.ociTreeSection, ociTree, constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            const treeTasksSection = await Section.getSection(constants.tasksTreeSection);
            await treeTasksSection?.collapse();

        });

        after(async function () {
            try {
                await Workbench.closeAllEditors();
                await Section.focus(constants.dbTreeSection);
                const dbConnections = await Tree.getDatabaseConnections();
                for (const dbConnection of dbConnections) {
                    await Tree.deleteDatabaseConnection(dbConnection.name, dbConnection.isMySQL, false);
                }
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Get Bastion Information and set it as current", async () => {

            const treeBastion = await Tree.getOciElementByType(constants.ociTreeSection, constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await Tree.openContextMenuAndSelect(treeBastion, constants.getBastionInfo);
            await driver.wait(waitUntil.tabIsOpened(`${bastionName} Info.json`), constants.wait5seconds);

            const textEditor = new TextEditor();
            await driver.wait(async () => {
                const text = await textEditor.getText();

                return text.indexOf("{") !== -1;
            }, constants.wait5seconds, `No text was found inside the ${bastionName} Info.json file`);

            let json: string;
            await driver.wait(async () => {
                json = await textEditor.getText();

                return Misc.isJson(json);
            }, constants.wait5seconds, "Bastion json file content is not json");

            const parsed = JSON.parse(json);
            const bastionId = parsed.id;

            await Workbench.closeEditor(`${bastionName} Info.json`);
            await Workbench.pushDialogButton("Don't Save");
            await Tree.openContextMenuAndSelect(treeBastion, constants.setAsCurrentBastion, undefined);
            await driver.wait(waitUntil.isDefaultItem(constants.ociTreeSection, bastionName,
                "bastion"),
                constants.wait10seconds, "Bastion is not the deault item");
            const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
                constants.dbConnectionsLabel);

            await Tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
            await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("mds.get.currentBastionId()");
            expect(commandExecutor.getResultMessage()).to.equal(bastionId);


        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await Tree.getOciElementByType(constants.ociTreeSection, constants.bastionType);
            await Tree.openContextMenuAndSelect(treeBastion, constants.refreshBastion, undefined);
            const treeTasksSection = await Section.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            await Workbench.waitForOutputText("Task 'Refresh Bastion' completed successfully", constants.wait20seconds);
            await new OutputView().clearText();
            expect(await Tree.existsElement(constants.tasksTreeSection, "Refresh Bastion (done)")).to.be.true;
        });

        it("Delete Bastion", async () => {
            await new OutputView().clearText();
            const treeBastion = await Tree.getOciElementByType(constants.ociTreeSection, constants.bastionType);
            await Tree.openContextMenuAndSelect(treeBastion, constants.deleteBastion, undefined);
            const treeTasksSection = await Section.getSection(constants.tasksTreeSection);
            await treeTasksSection.expand();
            expect(await Tree.existsElement(constants.tasksTreeSection, "Delete Bastion (running)")).to.be.true;
            await Workbench.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.wait25seconds);
            const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
            await Workbench.clickOnNotificationButton(ntf, "NO");
            await Workbench.waitForOutputText("Deletion aborted", constants.wait5seconds);
            expect(await Tree.existsElement(constants.tasksTreeSection, "Delete Bastion (error)")).to.be.true;
            await new OutputView().clearText();
            await new BottomBarPanel().toggle(false);

        });

        it("Create connection with Bastion Service", async function () {

            const treeDbSystem = await Tree.getOciElementByType(constants.ociTreeSection, constants.dbSystemType);
            const dbSystemName = await treeDbSystem.getLabel();
            if (!await Tree.isDBSystemStopped(treeDbSystem)) {
                await Tree.openContextMenuAndSelect(treeDbSystem, constants.createConnWithBastion);

                const bastionConn: interfaces.IDBConnection = {
                    dbType: "MySQL",
                    caption: dbSystemName,
                    description: "DB System used to test the MySQL Shell for VSCode Extension.",
                    basic: {
                        username: constants.bastionUsername,
                        password: constants.bastionPassword,
                    },
                };

                await driver.wait(waitUntil.dbConnectionIsOpened(bastionConn),
                    constants.wait5seconds);
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
                }, constants.wait5seconds, "DbSystemID field was not set");
                dbSystemOCID = await driver
                    .findElement(locator.dbConnectionDialog.mysql.mds.dbDystemId).getAttribute("value");
                await driver.wait(async () => {
                    return await driver
                        .findElement(locator.dbConnectionDialog.mysql.mds.bastionId).getAttribute("value") !== "";
                }, constants.wait5seconds, "BastionID field was not set");
                bastionOCID = await driver
                    .findElement(locator.dbConnectionDialog.mysql.mds.bastionId).getAttribute("value");
                await newConDialog.findElement(locator.dbConnectionDialog.ok).click();
                const mds = await DatabaseConnection.getConnection(bastionConn.caption);
                expect(mds).to.exist;
                await mds.click();
                try {
                    await driver.wait(waitUntil.mdsConnectionIsOpened(bastionConn), constants.wait25seconds);
                } catch (e) {
                    if (String(e).match(/Tunnel/) !== null) {
                        await Workbench.closeEditor(constants.dbDefaultEditor);
                        skip = true;
                        this.skip();
                    }
                }
                const commandExecutor = new CommandExecutor();
                await commandExecutor.execute("select version();");
                expect(commandExecutor.getResultMessage()).to.match(/OK/);
            } else {
                await Tree.openContextMenuAndSelect(treeDbSystem, constants.startDBSystem);
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                skip = true;
                this.skip();
            }

        });

        it("Edit an existing MDS Connection", async function () {

            this.retries(1);

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

            await Section.focus(constants.dbTreeSection);
            const treeMDSConn = await Tree.getOciElementByType(constants.dbTreeSection, constants.dbSystemType);
            await Tree.openContextMenuAndSelect(treeMDSConn, constants.editDBConnection);
            await DatabaseConnection.setConnection(
                "MySQL",
                mdsConn.caption,
                undefined,
                undefined,
                undefined,
                undefined,
                localMDSInfo,
            );

            expect(await Tree.existsElement(constants.dbTreeSection, mdsConn.caption)).to.be.true;
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
                    username: constants.bastionUsername,
                    password: constants.bastionPassword,
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

            await Section.focus(constants.dbTreeSection);

            await Section.createDatabaseConnection(localConn);
            const treeLocalConn = await Tree.getElement(constants.dbTreeSection, localConn.caption);
            await new EditorView().closeAllEditors();
            await (await Tree.getActionButton(treeLocalConn, constants.openNewConnection)).click();
            await driver.wait(waitUntil.mdsConnectionIsOpened(localConn),
                constants.wait25seconds, "Connection was not opened");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("select version();");
            expect(commandExecutor.getResultMessage()).to.match(/OK/);

        });

    });

});
