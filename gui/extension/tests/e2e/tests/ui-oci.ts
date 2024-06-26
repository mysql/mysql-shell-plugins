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
import { DatabaseConnectionDialog } from "../lib/WebViews/Dialogs/DatabaseConnectionDialog";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";

let ociConfig: interfaces.IOciProfileConfig;
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
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
    const opedEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    const tasksTreeSection = new E2EAccordionSection(constants.tasksTreeSection);

    before(async function () {

        const configs = await Misc.mapOciConfig();
        ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
            return item.name = "E2ETESTS";
        });

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
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.removeAllDatabaseConnections();
            await ociTreeSection.focus();
            await ociTreeSection.clickToolbarButton(constants.configureOci);
            await driver.wait(Workbench.untilTabIsOpened("config"), constants.wait5seconds,
                "config editor was not opened");
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
            await driver.wait(Workbench.untilTabIsOpened(`${ociConfig.name} Info.json`), constants.wait5seconds);
            const textEditor = new TextEditor();
            await driver.wait(async () => {
                return Misc.isJson(await textEditor.getText());
            }, constants.wait10seconds, "No text was found on file");

        });

        it("Set as New Default Config Profile", async () => {

            const treeE2eTests = await ociTreeSection.tree.getElement(`${ociConfig.name} (${ociConfig.region})`);
            await ociTreeSection.tree.openContextMenuAndSelect(treeE2eTests, constants.setDefaultConfigProfile);
            await driver.wait(ociTreeSection.tree.untilIsDefault(`${ociConfig.name} (${ociConfig.region})`, "profile"),
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
            await driver.wait(Workbench.untilTabIsOpened(`${ociTree[2].source} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened("QA Info.json"), constants.wait5seconds);
            compartmentId = JSON.parse((await Workbench.getJsonFromTextEditor())).id;

        });

        it("Set as Current Compartment", async () => {

            const treeCompartment = await ociTreeSection.tree.getElement(ociTree[2]);
            await ociTreeSection.tree.openContextMenuAndSelect(treeCompartment, constants.setCurrentCompartment);
            await driver.wait(ociTreeSection.tree.untilExists(`${ociTree[2].source} (Default)`),
                constants.wait5seconds);
            await driver.wait(ociTreeSection.tree.untilIsDefault(`${ociTree[2].source} (Default)`,
                "compartment"),
                constants.wait5seconds, `${ociTree[2].source} (Default) should be marked as default on the tree`);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.tree.expandElement(slicedOciTree, constants.wait5seconds * 5);
            await opedEditorsTreeSection.expand();
            const treeDBConnections = await opedEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
            await opedEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                constants.openNewShellConsole);
            const shellConsole = new E2EShellConsole();
            await driver.wait(shellConsole.untilIsOpened(), constants.wait5seconds * 3, "Shell Console was not loaded");
            await shellConsole.codeEditor.create();
            const result = await shellConsole.codeEditor.execute("mds.get.currentCompartmentId()");
            expect(result.text).to.equal(compartmentId);

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
            await driver.wait(Workbench.untilTabIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
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

                const mds = await new DatabaseConnectionOverview().getConnection(dbSystemName);
                await mds.click();

                try {
                    await driver.wait(new E2ENotebook().untilIsOpened(mdsConnection), constants.wait1minute);
                } catch (e) {
                    if (String(e).match(/Tunnel/) !== null) {
                        await Workbench.closeEditor(constants.dbDefaultEditor);
                        skipTest = true;
                        this.skip();
                    }
                }

                const notebook = new E2ENotebook();
                await notebook.codeEditor.create();
                const result = await notebook.codeEditor.execute("select version();");
                expect(result.toolbar.status).to.match(/OK/);
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
                await driver.wait(tasksTreeSection.tree.untilExists("Start DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.tree.untilExists("Start DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.restartDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.tree.untilExists("Restart DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to restart the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.tree.untilExists("Restart DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.stopDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.tree.untilExists("Stop DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to stop the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.tree.untilExists("Stop DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.tree.getOciElementByType(constants.dbSystemType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeDbSystem, constants.deleteDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.tree.untilExists("Delete DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.tree.untilExists("Delete DB System (done)"),
                    constants.wait10seconds);
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
            await driver.wait(Workbench.untilTabIsOpened(`${bastionName} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${bastionName} Info.json`),
                constants.wait5seconds);
            bastionId = JSON.parse((await Workbench.getJsonFromTextEditor())).id;
            await Workbench.closeEditor(`${bastionName} Info.json`);
            await Workbench.pushDialogButton("Don't Save");

        });

        it("Set as Current Bastion", async () => {

            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.setAsCurrentBastion, undefined);
            await driver.wait(ociTreeSection.tree.untilIsDefault(bastionName, "bastion"),
                constants.wait10seconds, "Bastion is not the default item");
            await opedEditorsTreeSection.expand();
            const treeDBConnections = await opedEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
            await opedEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                constants.openNewShellConsole);
            const shellConsole = new E2EShellConsole();
            await driver.wait(shellConsole.untilIsOpened(), constants.wait15seconds, "Shell Console was not loaded");
            await shellConsole.codeEditor.create();
            const result = await shellConsole.codeEditor.execute("mds.get.currentBastionId()");
            expect(result.text).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.refreshBastion, undefined);
            await tasksTreeSection.expand();
            await Workbench.waitForOutputText("Task 'Refresh Bastion' completed successfully", constants.wait20seconds);
            await new OutputView().clearText();
            await driver.wait(tasksTreeSection.tree.untilExists("Refresh Bastion (done)"),
                constants.wait5seconds);

        });

        it("Delete Bastion", async () => {

            await new OutputView().clearText();
            const treeBastion = await ociTreeSection.tree.getOciElementByType(constants.bastionType);
            await ociTreeSection.tree.openContextMenuAndSelect(treeBastion, constants.deleteBastion);
            await tasksTreeSection.expand();
            await driver.wait(tasksTreeSection.tree.untilExists("Delete Bastion (running)"),
                constants.wait5seconds);
            await Workbench.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.wait25seconds);
            const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
            await Workbench.clickOnNotificationButton(ntf, "NO");
            await Workbench.waitForOutputText("Deletion aborted", constants.wait5seconds);
            await driver.wait(tasksTreeSection.tree.untilExists("Delete Bastion (error)"),
                constants.wait5seconds);
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
            const notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(localConn),
                constants.wait25seconds, "MDS Connection was not opened");
            await notebook.codeEditor.create();
            const result = await notebook.codeEditor.execute("select version();");
            expect(result.toolbar.status).to.match(/OK/);

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
            await driver.wait(Workbench.untilTabIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await Workbench.closeEditor(`${computeName} Info.json`);
            await Workbench.pushDialogButton("Don't Save");

        });

        it("Delete Compute Instance", async () => {

            const treeComputeInstance = await ociTreeSection.tree.getOciElementByType(constants.ociComputeType);
            const instanceLabel = await treeComputeInstance.getLabel();
            await ociTreeSection.tree.openContextMenuAndSelect(treeComputeInstance, constants.deleteComputeInstance);
            try {
                await tasksTreeSection.focus();
                await driver.wait(tasksTreeSection.tree.untilExists("Delete Compute Instance (running)"),
                    constants.wait5seconds);

                const text = `Are you sure you want to delete the instance ${instanceLabel}`;
                const ntf = await Workbench.getNotification(text, false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.tree.untilExists("Delete Compute Instance (error)"),
                    constants.wait5seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });
    });

});
