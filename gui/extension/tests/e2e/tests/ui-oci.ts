/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import { E2ERecording } from "../lib/E2ERecording";
import "../setup/global-hooks";

let ociConfig: interfaces.IOciProfileConfig | undefined;
let ociTree: RegExp[];

describe("ORACLE CLOUD INFRASTRUCTURE", () => {

    const ociTreeSection = new E2EAccordionSection(constants.ociTreeSection);
    const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    const tasksTreeSection = new E2EAccordionSection(constants.tasksTreeSection);

    before(async function () {

        const configs = await Misc.mapOciConfig();
        ociConfig = configs.find((item: interfaces.IOciProfileConfig) => {
            return item.name = String(process.env.MYSQLSH_OCI_CONFIG_PROFILE);
        });

        ociTree = [new RegExp(`${process.env.MYSQLSH_OCI_CONFIG_PROFILE} \\(${ociConfig!.region}\\)`),
        new RegExp("\\(Root Compartment\\)"), /QA/, /MySQLShellTesting/];
        await Misc.loadDriver();
        const localE2eRecording = new E2ERecording(this.test!.title!);
        let hookResult = "passed";

        try {
            await localE2eRecording!.start();
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Workbench.toggleBottomBar(false);
            await ociTreeSection.focus();
            await ociTreeSection.clickToolbarButton(constants.configureOci);
            await driver.wait(Workbench.untilTabIsOpened("config"), constants.wait1second * 10,
                "config editor was not opened");
            await ociTreeSection.clickToolbarButton(constants.reloadOci);
        } catch (e) {
            hookResult = "failed";
            throw e;
        } finally {
            await Misc.processResult(this, localE2eRecording, hookResult);
        }

    });

    after(async function () {
        Misc.removeDatabaseConnections();
    });

    describe("Profile", () => {

        let existsInQueue = false;

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        it("View Config Profile Information", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await ociTreeSection.openContextMenuAndSelect(`${ociConfig!.name} (${ociConfig!.region})`,
                constants.viewConfigProfileInfo);
            await driver.wait(Workbench.untilTabIsOpened(`${ociConfig!.name} Info.json`), constants.wait1second * 10);
            expect(Misc.isJson(await new TextEditor().getText())).to.be.true;
            await Workbench.closeAllEditors();
        });

        it("Set as New Default Config Profile", async () => {

            await ociTreeSection.openContextMenuAndSelect(`${ociConfig!.name} (${ociConfig!.region})`,
                constants.setDefaultConfigProfile, undefined, false);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(`${ociConfig!.name} (${ociConfig!.region})`),
                constants.wait1second * 5, "E2e tests is not the default item");
            await Workbench.closeAllEditors();
        });
    });

    describe("Compartment", () => {

        let compartmentId = "";
        let existsInQueue = false;

        before(async function () {
            let hookResult = "passed";
            const localE2eRecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await ociTreeSection.expandTree(ociTree, constants.wait1minute);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        after(async function () {
            await new EditorView().closeAllEditors();
        });

        it("View Compartment Information", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await ociTreeSection.openContextMenuAndSelect(ociTree[2], constants.viewCompartmentInfo, undefined, false);
            await driver.wait(Workbench.untilTabIsOpened(`${ociTree[2].source} Info.json`), constants.wait1second * 10);
            await driver.wait(Workbench.untilJsonFileIsOpened("QA Info.json"), constants.wait1second * 10);
            compartmentId = JSON.parse(await new TextEditor().getText()).id;
            await Workbench.closeAllEditors();
        });

        it("Set as Current Compartment", async () => {

            await ociTreeSection.openContextMenuAndSelect(ociTree[2], constants.setCurrentCompartment, undefined, false);
            await driver.wait(ociTreeSection.untilTreeItemExists(`${ociTree[2].source} (Default)`),
                constants.waitForTreeItem);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(`${ociTree[2].source} (Default)`,
            ), constants.wait1second * 5, `${ociTree[2].source} (Default) should be marked as default on the tree`);

            const slicedOciTree = ociTree;
            slicedOciTree.splice(0, 2);
            await ociTreeSection.expandTree(slicedOciTree, constants.wait1minute);
            await openEditorsTreeSection.expand();
            await openEditorsTreeSection.openContextMenuAndSelect(constants.dbConnectionsLabel,
                constants.openNewShellConsole);
            const shellConsole = new E2EShellConsole();
            await driver.wait(shellConsole.untilIsOpened(),
                constants.wait1second * 5 * 3, "Shell Console was not loaded");
            const result = await shellConsole.codeEditor
                .execute("mds.get.currentCompartmentId()") as E2ECommandResultData;
            expect(result.text).to.equal(compartmentId);
            await Workbench.closeAllEditors();
        });

    });

    describe("DB System", () => {

        let existsInQueue = false;

        before(async function () {
            let hookResult = "passed";
            const localE2eRecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await ociTreeSection.expandTree(ociTree, constants.wait1minute);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        it("View DB System Information", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(),
                constants.viewDBSystemInfo, undefined, false);
            await driver.wait(Workbench.untilTabIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait1second * 10);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${await treeDbSystem.getLabel()} Info.json`),
                constants.wait1second * 10);
            await Workbench.closeAllEditors();
        });

        it("Start a DB System (and cancel)", async () => {
            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.startDBSystem);
            await tasksTreeSection.focus();

            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Start DB System (running)"),
                    constants.waitForTreeItem);
                const ntf = await Workbench.getNotification("Are you sure you want to start the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Start DB System (done)"),
                    constants.waitForTreeItem);
            } finally {
                await ociTreeSection.focus();
                await Workbench.closeAllEditors();
            }

        });

        it("Restart a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.restartDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Restart DB System (running)"),
                    constants.waitForTreeItem);
                const ntf = await Workbench.getNotification("Are you sure you want to restart the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Restart DB System (done)"),
                    constants.waitForTreeItem);
            } finally {
                await tasksTreeSection.collapse();
                await Workbench.closeAllEditors();
            }

        });

        it("Stop a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.stopDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Stop DB System (running)"),
                    constants.waitForTreeItem);
                const ntf = await Workbench.getNotification("Are you sure you want to stop the DB System", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Stop DB System (done)"),
                    constants.waitForTreeItem);
            } finally {
                await tasksTreeSection.collapse();
                await Workbench.closeAllEditors();
            }

        });

        it("Delete a DB System (and cancel)", async () => {

            const treeDbSystem = await ociTreeSection.getTreeItem(undefined, constants.dbSystemType);
            await ociTreeSection.openContextMenuAndSelect(await treeDbSystem.getLabel(), constants.deleteDBSystem);
            await tasksTreeSection.expand();
            try {
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete DB System (running)"),
                    constants.waitForTreeItem);
                const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete DB System (done)"),
                    constants.waitForTreeItem);
            } finally {
                await tasksTreeSection.collapse();
                await Workbench.closeAllEditors();
            }

        });

    });

    describe("Bastion", () => {

        let bastionId: string;
        let existsInQueue = false;

        before(async function () {
            let hookResult = "passed";
            const localE2eRecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await ociTreeSection.expandTree(ociTree, constants.wait1minute);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        beforeEach(async () => {
            await ociTreeSection.focus();
        });

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        it("Get Bastion Information", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.openContextMenuAndSelect(bastionName, constants.getBastionInfo, undefined, false);
            await driver.wait(Workbench.untilTabIsOpened(`${bastionName} Info.json`), constants.wait1second * 10);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${bastionName} Info.json`),
                constants.wait1second * 10);
            bastionId = JSON.parse(await new TextEditor().getText()).id;
            await Workbench.closeEditor(new RegExp(`${bastionName} Info.json`));
            await Workbench.pushDialogButton("Don't Save");
            await tasksTreeSection.collapse();
        });

        it("Set as Current Bastion", async () => {

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            const bastionName = await treeBastion.getLabel();
            await ociTreeSection.openContextMenuAndSelect(bastionName, constants.setAsCurrentBastion, undefined, false);
            await driver.wait(ociTreeSection.untilIsNotLoading(), constants.waitSectionNoProgressBar);
            await driver.wait(ociTreeSection.untilTreeItemIsDefault(bastionName),
                constants.wait1second * 10, "Bastion is not the default item");
            await openEditorsTreeSection.expand();

            await (await openEditorsTreeSection.getTreeItem(constants.dbConnectionsLabel)).click();
            await new DatabaseConnectionOverview().openNewShellSession();

            const result = await new E2EShellConsole().codeEditor
                .execute("mds.get.currentBastionId()") as E2ECommandResultData;
            expect(result.text).to.equal(bastionId);
            await tasksTreeSection.collapse();
        });

        it("Refresh When Bastion Reaches Active State", async () => {

            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            await ociTreeSection.openContextMenuAndSelect(await treeBastion.getLabel(), constants.refreshBastion);

            await tasksTreeSection.expand();
            await Workbench.waitForOutputText("Task 'Refresh Bastion' completed successfully",
                constants.wait1second * 20);
            await new OutputView().clearText();
            await driver.wait(tasksTreeSection.untilTreeItemExists("Refresh Bastion (done)"),
                constants.waitForTreeItem);
            await tasksTreeSection.collapse();
        });

        it("Delete Bastion", async () => {

            await new OutputView().clearText();
            const treeBastion = await ociTreeSection.getTreeItem(undefined, constants.bastionType);
            await ociTreeSection.openContextMenuAndSelect(await treeBastion.getLabel(), constants.deleteBastion);
            await Workbench.waitForOutputText(`OCI profile '${process.env.MYSQLSH_OCI_CONFIG_PROFILE}' loaded.`, constants.wait1second * 25);
            await tasksTreeSection.expand();
            await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Bastion (running)"),
                constants.waitForTreeItem);
            await driver.wait(Workbench.untilNotificationExists("Are you sure you want to delete", false),
                constants.wait1second * 15);
            const ntf = await Workbench.getNotification("Are you sure you want to delete", false);
            await Workbench.clickOnNotificationButton(ntf, "NO");
            await Workbench.waitForOutputText("Deletion aborted", constants.wait1second * 5);
            await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Bastion (error)"),
                constants.waitForTreeItem);
            await new OutputView().clearText();
            await new BottomBarPanel().toggle(false);
            await tasksTreeSection.collapse();
        });

    });

    describe("Compute Instance", () => {

        let existsInQueue = false;

        before(async function () {
            const localE2eRecording = new E2ERecording(this.test!.title!);
            let hookResult = "passed";
            try {
                await localE2eRecording!.start();
                await ociTreeSection.expandTree(ociTree, constants.wait1minute);
                await ociTreeSection.focus();
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });

        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        it("View Compute Instance Information", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const treeComputeInstance = await ociTreeSection.getTreeItem(undefined, constants.ociComputeType);
            const computeName = await treeComputeInstance.getLabel();
            await ociTreeSection.openContextMenuAndSelect(computeName, constants.viewComputeInstanceInfo, undefined, false);
            await driver.wait(Workbench.untilTabIsOpened(`${computeName} Info.json`), constants.wait1second * 10);
            await driver.wait(Workbench.untilJsonFileIsOpened(`${computeName} Info.json`), constants.wait1second * 10);
            await Workbench.closeEditor(new RegExp(`${computeName} Info.json`));
            await Workbench.pushDialogButton("Don't Save");
            await Workbench.closeAllEditors();
        });

        it("Delete Compute Instance", async () => {

            await ociTreeSection.focus();
            const treeComputeInstance = await ociTreeSection.getTreeItem(undefined, constants.ociComputeType);
            const instanceLabel = await treeComputeInstance.getLabel();
            await ociTreeSection.openContextMenuAndSelect(instanceLabel, constants.deleteComputeInstance);
            try {
                await tasksTreeSection.focus();
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Compute Instance (running)"),
                    constants.waitForTreeItem);

                const text = `Are you sure you want to delete the instance ${instanceLabel}`;
                const ntf = await Workbench.getNotification(text, false);
                await Workbench.clickOnNotificationButton(ntf, "NO");
                await tasksTreeSection.focus();
                await driver.wait(tasksTreeSection.untilTreeItemExists("Delete Compute Instance (error)"),
                    constants.waitForTreeItem);
            } finally {
                await tasksTreeSection.collapse();
                await Workbench.closeAllEditors();
            }

        });
    });

});
