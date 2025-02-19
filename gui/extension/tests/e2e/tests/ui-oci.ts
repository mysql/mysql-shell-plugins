/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";
import { TestQueue } from "../lib/TestQueue";
import { E2ECommandResultData } from "../lib/WebViews/CommandResults/E2ECommandResultData";

let ociConfig: interfaces.IOciProfileConfig;
let ociTree: RegExp[];

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
    const opedEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    const tasksTreeSection = new E2EAccordionSection(constants.tasksTreeSection);

    before(async function () {

        const configs = await Misc.mapOciConfig();
        ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
            return item.name = "E2ETESTS";
        });

        ociTree = [new RegExp(`E2ETESTS \\(${ociConfig.region}\\)`),
        new RegExp("\\(Root Compartment\\)"), /QA/, /MySQLShellTesting/];
        await Misc.loadDriver();

        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);
            await Workbench.toggleBottomBar(false);
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
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Profile", () => {

        let existsInQueue = false;

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }


            await Workbench.closeAllEditors();
        });

        it("View Config Profile Information", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await ociTreeSection.openContextMenuAndSelect(`${ociConfig.name} (${ociConfig.region})`,
                constants.viewConfigProfileInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${ociConfig.name} Info.json`), constants.wait5seconds);
            expect(Misc.isJson(await new TextEditor().getText())).to.be.true;

        });

        it("Set as New Default Config Profile", async () => {

            await ociTreeSection.openContextMenuAndSelect(`${ociConfig.name} (${ociConfig.region})`,
                constants.setDefaultConfigProfile);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(`${ociConfig.name} (${ociConfig.region})`),
                constants.wait5seconds, "E2e tests is not the default item");

        });
    });

    describe("Compartment", () => {

        let compartmentId = "";
        let existsInQueue = false;

        before(async function () {
            try {
                await ociTreeSection.expandTree(ociTree);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
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

        it("View Compartment Information", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await ociTreeSection.openContextMenuAndSelect(ociTree[2], constants.viewCompartmentInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${ociTree[2].source} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened("QA Info.json"), constants.wait5seconds);
            compartmentId = JSON.parse(await new TextEditor().getText()).id;

        });

        it("Set as Current Compartment", async () => {

            await ociTreeSection.openContextMenuAndSelect(ociTree[2], constants.setCurrentCompartment);
            await driver.wait(ociTreeSection.untilTreeItemExists(`${ociTree[2].source} (Default)`),
                constants.wait5seconds);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(`${ociTree[2].source} (Default)`,
            ), constants.wait5seconds, `${ociTree[2].source} (Default) should be marked as default on the tree`);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.expandTree(slicedOciTree);
            await opedEditorsTreeSection.expand();
            await opedEditorsTreeSection.openContextMenuAndSelect(constants.dbConnectionsLabel,
                constants.openNewShellConsole);
            const shellConsole = new E2EShellConsole();
            await driver.wait(shellConsole.untilIsOpened(),
                constants.wait5seconds * 3, "Shell Console was not loaded");
            const result = await shellConsole.codeEditor
                .execute("mds.get.currentCompartmentId()") as E2ECommandResultData;
            expect(result.text).to.equal(compartmentId);

        });

    });

    describe("DB System", () => {

        let existsInQueue = false;

        before(async function () {
            try {
                await ociTreeSection.expandTree(ociTree);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }

            await Workbench.closeAllEditors();
        });

        it("View DB System Information", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(),
                constants.viewDBSystemInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait5seconds);

        });

        it("Start a DB System (and cancel)", async () => {
            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.startDBSystem);
            await tasksTreeSection.focus();

            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Start DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Start DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await ociTreeSection.focus();
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.restartDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Restart DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to restart the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Restart DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.stopDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Stop DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to stop the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Stop DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.deleteDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete DB System (running)"),
                    constants.wait5seconds);
                const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete DB System (done)"),
                    constants.wait10seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });

    });

    describe("Bastion", () => {

        let bastionId: string;
        let existsInQueue = false;

        before(async function () {
            try {
                await ociTreeSection.expandTree(ociTree);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }

            await tasksTreeSection.collapse();
        });

        it("Get Bastion Information", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.openContextMenuAndSelect(bastionName, constants.getBastionInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${bastionName} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${bastionName} Info.json`),
                constants.wait5seconds);
            bastionId = JSON.parse(await new TextEditor().getText()).id;
            await Workbench.closeEditor(new RegExp(`${bastionName} Info.json`));
            await Workbench.pushDialogButton("Don't Save");

        });

        it("Set as Current Bastion", async () => {

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.openContextMenuAndSelect(bastionName, constants.setAsCurrentBastion, undefined);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(bastionName),
                constants.wait10seconds, "Bastion is not the default item");
            await opedEditorsTreeSection.expand();

            await opedEditorsTreeSection.openContextMenuAndSelect(constants.dbConnectionsLabel,
                constants.openNewShellConsole);
            const shellConsole = new E2EShellConsole();
            await driver.wait(shellConsole.untilIsOpened(),
                constants.wait15seconds, "Shell Console was not loaded");
            const result = await shellConsole.codeEditor.execute("mds.get.currentBastionId()") as E2ECommandResultData;
            expect(result.text).to.equal(bastionId);

        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            await ociTreeSection.openContextMenuAndSelect(await treeBastion.getLabel(), constants.refreshBastion);

            await tasksTreeSection.expand();
            await Workbench.waitForOutputText("Task 'Refresh Bastion' completed successfully", constants.wait20seconds);
            await new OutputView().clearText();
            await driver.wait(tasksTreeSection.untilTreeItemExists("Refresh Bastion (done)"),
                constants.wait5seconds);

        });

        it("Delete Bastion", async () => {

            await new OutputView().clearText();
            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            await ociTreeSection.openContextMenuAndSelect(await treeBastion.getLabel(), constants.deleteBastion);
            await Workbench.waitForOutputText("OCI profile 'E2ETESTS' loaded.", constants.wait25seconds);
            await tasksTreeSection.expand();
            await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Bastion (running)"),
                constants.wait5seconds);
            const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
            await Workbench.clickOnNotificationButton(ntf, "NO");
            await Workbench.waitForOutputText("Deletion aborted", constants.wait5seconds);
            await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Bastion (error)"),
                constants.wait5seconds);
            await new OutputView().clearText();
            await new BottomBarPanel().toggle(false);

        });

    });

    describe("Compute Instance", () => {

        let existsInQueue = false;

        before(async function () {
            try {
                await ociTreeSection.expandTree(ociTree);
                await ociTreeSection.focus();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        });

        afterEach(async function () {
            if (this.currentTest?.state === "failed") {
                await Misc.processFailure(this);
            }

            if (existsInQueue) {
                await TestQueue.pop(this.currentTest.title);
                existsInQueue = false;
            }

            await Workbench.closeAllEditors();
        });

        it("View Compute Instance Information", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeComputeInstance = await ociTreeSection.getTreeItem(undefined, constants.ociComputeType);
            const computeName = await treeComputeInstance.getLabel();
            await ociTreeSection.openContextMenuAndSelect(computeName, constants.viewComputeInstanceInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${computeName} Info.json`), constants.wait5seconds);
            await Workbench.closeEditor(new RegExp(`${computeName} Info.json`));
            await Workbench.pushDialogButton("Don't Save");

        });

        it("Delete Compute Instance", async () => {

            const treeComputeInstance = await ociTreeSection.getTreeItem(undefined, constants.ociComputeType);
            const instanceLabel = await treeComputeInstance.getLabel();
            await ociTreeSection.openContextMenuAndSelect(instanceLabel, constants.deleteComputeInstance);
            try {
                await tasksTreeSection.focus();
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Compute Instance (running)"),
                    constants.wait5seconds);

                const text = `Are you sure you want to delete the instance ${instanceLabel}`;
                const ntf = await Workbench.getNotification(text, false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Compute Instance (error)"),
                    constants.wait5seconds);
            } finally {
                await tasksTreeSection.collapse();
            }

        });
    });

});
