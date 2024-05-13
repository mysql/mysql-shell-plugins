/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
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
    BottomBarPanel,
    TextEditor,
    OutputView,
} from "vscode-extension-tester";
import { driver, Misc } from "../lib/Misc";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import { DatabaseConnectionDialog } from "../lib/WebViews/DatabaseConnectionDialog";
import { Shell } from "../lib/Shell";
import { CommandExecutor } from "../lib/CommandExecutor";
import { AccordionSection } from "../lib/SideBar/AccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as errors from "../lib/errors";

let ociConfig: { [key: string]: string; };
let ociTree: RegExp[];

if (!process.env.MYSQLSH_OCI_CONFIG_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_CONFIG_FILE");
}
if (!process.env.MYSQLSH_OCI_RC_FILE) {
    throw new Error("Please define the environment variable MYSQLSH_OCI_RC_FILE");
}

if (!process.env.OCI_BASTION_USERNAME) {
    throw new Error("Please define the environment variable OCI_BASTION_USERNAME");
}

if (!process.env.OCI_BASTION_PASSWORD) {
    throw new Error("Please define the environment variable OCI_BASTION_PASSWORD");
}

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    let dbSystemID: string;
    let bastionID: string;
    let mdsEndPoint: string;
    let skipTest = false;
    const dbTreeSection = new AccordionSection(constants.dbTreeSection);
    const ociTreeSection = new AccordionSection(constants.ociTreeSection);
    const opedEditorsTreeSection = new AccordionSection(constants.openEditorsTreeSection);
    const tasksTreeSection = new AccordionSection(constants.tasksTreeSection);

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
            await dbTreeSection.removeAllDatabaseConnections();
            await dbTreeSection.focus();
            await ociTreeSection.clickToolbarButton(constants.configureOci);
            await driver.wait(async () => {
                return (await new EditorView().getOpenEditorTitles()).includes("config");
            }, constants.wait5seconds, "config editor was not opened");
            await ociTreeSection.clickToolbarButton(constants.reloadOci);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }

    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            await dbTreeSection.removeAllDatabaseConnections();
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

            await Workbench.closeAllEditors();
        });

        it("View Config Profile Information", async () => {

            const treeE2eTests = await ociTreeSection.tree.getElement(`${ociConfig.name} (${ociConfig.region})`);
            await ociTreeSection.tree.openContextMenuAndSelect(treeE2eTests, constants.viewConfigProfileInfo);
            await driver.wait(waitUntil.tabIsOpened(`${ociConfig.name} Info.json`), constants.wait5seconds);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait10seconds, "No text was found on file");

        });

        it("Set as New Default Config Profile", async () => {

            const treeE2eTests = await ociTreeSection.tree.getElement(`${ociConfig.name} (${ociConfig.region})`);
            await ociTreeSection.tree.openContextMenuAndSelect(treeE2eTests, constants.setDefaultConfigProfile);
            await driver.wait(ociTreeSection.tree.isDefaultItem(`${ociConfig.name} (${ociConfig.region})`, "profile"),
                constants.wait5seconds, "E2e tests is not the default item");
        });
    });

    describe("Compartment", () => {

        let compartmentId = "";

        before(async function () {
            try {
                await ociTreeSection.tree.expandElement(ociTree, constants.wait25seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Workbench.closeAllEditors();
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

            const treeCompartment = await ociTreeSection.tree.getElement(ociTree[2]);
            await ociTreeSection.tree.openContextMenuAndSelect(treeCompartment, constants.viewCompartmentInfo);
            await driver.wait(waitUntil.tabIsOpened(`${ociTree[2].source} Info.json`), constants.wait5seconds);
            await driver.wait(waitUntil.jsonFileIsOpened("QA Info.json"), constants.wait5seconds);
            const textEditor = new TextEditor();
            const json = await textEditor.getText();
            const parsed = JSON.parse(json);
            compartmentId = parsed.id;

        });

        it("Set as Current Compartment", async () => {

            const treeCompartment = await ociTreeSection.tree.getElement(ociTree[2]);
            await ociTreeSection.tree.openContextMenuAndSelect(treeCompartment, constants.setCurrentCompartment);
            await driver.wait(ociTreeSection.tree.isDefaultItem(`${ociTree[2].source} (Default)`,
                "compartment"),
                constants.wait5seconds, `${ociTree[2].source} (Default) should be marked as default on the tree`);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.tree.expandElement(slicedOciTree, constants.wait5seconds * 5);
            await opedEditorsTreeSection.expand();
            const treeDBConnections = await opedEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
            await opedEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                constants.openNewShellConsole);
            await driver.wait(Shell.isShellLoaded(), constants.wait5seconds * 3, "Shell Console was not loaded");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("mds.get.currentCompartmentId()");
            expect(commandExecutor.getResultMessage(), errors.queryResultError(compartmentId,
                commandExecutor.getResultMessage())).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        before(async function () {
            try {
                await ociTreeSection.tree.expandElement(ociTree, constants.wait5seconds * 5);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Workbench.closeAllEditors();
        });

        it("View DB System Information", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.viewDBSystemInfo);
            await driver.wait(waitUntil.tabIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);
            await driver.wait(waitUntil.jsonFileIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);

        });

        it("Create connection with Bastion Service", async function () {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            const dbSystemName = await treeDbSystem.getLabel();
            if (!await ociTreeSection.tree.isDBSystemStopped(treeDbSystem)) {
                await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.createConnWithBastion);
                const mdsConnection = await DatabaseConnectionDialog.getConnectionDetails();
                expect(mdsConnection.caption).to.equals(dbSystemName);
                expect(mdsConnection.description)
                    .equals("DB System used to test the MySQL Shell for VSCode Extension.");
                if (interfaces.isMySQLConnection(mdsConnection.basic)) {
                    expect(mdsConnection.basic.hostname).to.match(/(\d+).(\d+).(\d+).(\d+)/);
                    mdsEndPoint = mdsConnection.basic.hostname;
                    mdsConnection.basic.username = constants.bastionUsername;
                    mdsConnection.basic.password = constants.bastionPassword;
                    dbSystemID = mdsConnection.mds.dbSystemOCID;
                    bastionID = mdsConnection.mds.bastionOCID;
                    mdsConnection.advanced = undefined;
                    mdsConnection.mds = undefined;
                    mdsConnection.ssh = undefined;
                    mdsConnection.ssl = undefined;
                    await DatabaseConnectionDialog.setConnection(mdsConnection);
                } else {
                    throw new Error("The MDS connection should be a MySQL type");
                }

                const mds = await DatabaseConnectionOverview.getConnection(dbSystemName);
                await mds.click();

                try {
                    await driver.wait(waitUntil.mdsConnectionIsOpened(mdsConnection), constants.wait1minute);
                } catch (e) {
                    if (String(e).match(/Tunnel/) !== null) {
                        await Workbench.closeEditor(constants.dbDefaultEditor);
                        skipTest = true;
                        this.skip();
                    }
                }

                const commandExecutor = new CommandExecutor();
                await commandExecutor.execute("select version();");
                expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                    commandExecutor.getResultMessage())).to.match(/OK/);
            } else {
                await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.startDBSystem);
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                skipTest = true;
                this.skip();
            }

        });

        it("Start a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.startDBSystem);
            await tasksTreeSection.expand();
            try {
                expect(await tasksTreeSection.tree.existsElement("Start DB System (running)"),
                    errors.doesNotExistOnTree("Start DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (tasksTreeSection.tree.existsElement("Start DB System (done)"));
                }, constants.wait10seconds, "Start DB System (done) was not displayed");
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.restartDBSystem);
            await tasksTreeSection.expand();
            try {
                expect(await tasksTreeSection.tree.existsElement("Restart DB System (running)"),
                    errors.doesNotExistOnTree("Restart DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to restart the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (tasksTreeSection.tree.existsElement("Restart DB System (done)"));
                }, constants.wait10seconds, "Restart DB System (done) was not displayed");
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.stopDBSystem);
            await tasksTreeSection.expand();
            try {
                expect(await tasksTreeSection.tree.existsElement("Stop DB System (running)"),
                    errors.doesNotExistOnTree("Stop DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to stop the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (tasksTreeSection.tree.existsElement("Stop DB System (done)"));
                }, constants.wait10seconds, "Stop DB System (done) was not displayed");
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.deleteDBSystem);
            await tasksTreeSection.expand();
            try {
                expect(await tasksTreeSection.tree.existsElement("Delete DB System (running)"),
                    errors.doesNotExistOnTree("Delete DB System (running)")).to.be.true;
                const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (tasksTreeSection.tree.existsElement("Delete DB System (done)"));
                }, constants.wait10seconds, "Delete DB System (done) was not displayed");
            } finally {
                await tasksTreeSection.collapse();
            }

        });

    });

    describe("Bastion", () => {

        let bastionId: string;

        before(async function () {
            try {
                await ociTreeSection.tree.expandElement(ociTree, constants.wait25seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await tasksTreeSection.collapse();
        });

        it("Get Bastion Information", async () => {

            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.getBastionInfo);
            await driver.wait(waitUntil.tabIsOpened(`${bastionName} Info.json`), constants.wait5seconds);
            await driver.wait(waitUntil.jsonFileIsOpened(`${bastionName} Info.json`),
                constants.wait5seconds);
            const textEditor = new TextEditor();
            const json = await textEditor.getText();
            const parsed = JSON.parse(json);
            bastionId = parsed.id;

            await Workbench.closeEditor(`${bastionName} Info.json`);
            await Workbench.pushDialogButton("Don't Save");

        });

        it("Set as Current Bastion", async () => {
            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.setAsCurrentBastion, undefined);
            await driver.wait(ociTreeSection.tree.isDefaultItem(bastionName, "bastion"),
                constants.wait10seconds, "Bastion is not the default item");
            await opedEditorsTreeSection.expand();
            const treeDBConnections = await opedEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
            await opedEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                constants.openNewShellConsole);
            await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("mds.get.currentBastionId()");
            expect(commandExecutor.getResultMessage(), errors.queryResultError(bastionId,
                commandExecutor.getResultMessage())).to.equal(bastionId);
        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.refreshBastion, undefined);
            await tasksTreeSection.expand();
            await Workbench.waitForOutputText("Task 'Refresh Bastion' completed successfully", constants.wait20seconds);
            await new OutputView().clearText();
            expect(await tasksTreeSection.tree.existsElement("Refresh Bastion (done)"),
                errors.doesNotExistOnTree("Refresh Bastion (done)")).to.be.true;
        });

        it("Delete Bastion", async () => {
            await new OutputView().clearText();
            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.deleteBastion, undefined);
            await tasksTreeSection.expand();
            expect(await tasksTreeSection.tree.existsElement("Delete Bastion (running)"),
                errors.doesNotExistOnTree("Delete Bastion (running)")).to.be.true;
            await Workbench.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.wait25seconds);
            const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
            await Workbench.clickOnNotificationButton(ntf, "NO");
            await Workbench.waitForOutputText("Deletion aborted", constants.wait5seconds);
            expect(await tasksTreeSection.tree.existsElement("Delete Bastion (error)"),
                errors.doesNotExistOnTree("Delete Bastion (error)")).to.be.true;
            await new OutputView().clearText();
            await new BottomBarPanel().toggle(false);

        });

        it("Create a new MDS Connection", async function () {

            if (skipTest) {
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
                    sshPrivateKey: "id_rsa_mysql_shell",
                    sshPublicKey: "id_rsa_mysql_shell.pub",
                    dbSystemOCID: dbSystemID,
                    bastionOCID: bastionID,
                },
            };

            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(localConn);
            const treeLocalConn = await dbTreeSection.tree.getElement(localConn.caption);
            await new EditorView().closeAllEditors();
            await (await dbTreeSection.tree.getActionButton(treeLocalConn, constants.openNewConnection)).click();
            await driver.wait(waitUntil.mdsConnectionIsOpened(localConn),
                constants.wait25seconds, "Connection was not opened");
            const commandExecutor = new CommandExecutor();
            await commandExecutor.execute("select version();");
            expect(commandExecutor.getResultMessage(), errors.queryResultError("OK",
                commandExecutor.getResultMessage())).to.match(/OK/);

        });

    });

    describe("Compute Instance", () => {

        before(async function () {
            try {
                await ociTreeSection.tree.expandElement(ociTree, constants.wait25seconds);
                await ociTreeSection.focus();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            await Workbench.closeAllEditors();
        });

        it("View Compute Instance Information", async () => {
            const treeComputeInstance = await ociTreeSection.tree.getOciElementByType(constants.ociComputeType);
            const computeName = await treeComputeInstance.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeComputeInstance, constants.viewComputeInstanceInfo);
            await driver.wait(waitUntil.tabIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await driver.wait(waitUntil.jsonFileIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await Workbench.closeEditor(`${computeName} Info.json`);
            await Workbench.pushDialogButton("Don't Save");
        });

        it("Delete Compute Instance", async () => {
            const treeComputeInstance = await ociTreeSection.tree.getOciElementByType(constants.ociComputeType);
            const instanceLabel = await treeComputeInstance.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeComputeInstance, constants.deleteComputeInstance);
            try {
                const msg = "Delete Compute Instance (running)";
                expect(await tasksTreeSection.tree.existsElement(msg),
                    errors.doesNotExistOnTree(msg)).to.be.true;

                const text = `Are you sure you want to delete the instance ${instanceLabel}`;
                const ntf = await Workbench.getNotification(text, false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(async () => {
                    return (tasksTreeSection.tree.existsElement("Delete Compute Instance (error)"));
                }, constants.wait10seconds, "Delete Compute Instance (error)");
            } finally {
                await tasksTreeSection.collapse();
            }
        });
    });

});
