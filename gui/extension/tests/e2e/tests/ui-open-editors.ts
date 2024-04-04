/*
 * Copyright (c) 2023, 2024 Oracle and/or its affiliates.
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
import { BottomBarPanel, ActivityBar, until } from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { Shell } from "../lib/shell";
import { Notebook } from "../lib/webviews/notebook";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";

describe("OPEN EDITORS", () => {

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

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `globalDBConnection`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Workbench.dismissNotifications();
            await Workbench.toggleBottomBar(false);
            await Workbench.removeAllDatabaseConnections();
            await Section.createDatabaseConnection(globalConn);
            await Workbench.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            if (await Workbench.requiresMRSMetadataUpgrade(globalConn)) {
                await Workbench.upgradeMRSMetadata();
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            await Workbench.removeAllDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    afterEach(async function () {
        if (this.currentTest.state === "failed") {
            await Misc.processFailure(this);
        }
    });


    it("New Shell Notebook", async () => {
        const treeDBConnections = await Tree.getElement(constants.openEditorsTreeSection,
            constants.dbConnectionsLabel);
        await Tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
        await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
        const treeOEShellConsoles = await Tree.getElement(constants.openEditorsTreeSection,
            constants.mysqlShellConsoles);
        expect(await treeOEShellConsoles.findChildItem("Session 1"), errors.doesNotExistOnTree("Session 1")).to.exist;
    });

    it("Icon - New MySQL Script", async () => {
        await Section.focus(constants.dbTreeSection);
        const treeLocalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
        await (await Tree.getActionButton(treeLocalConn, constants.openNewConnection)).click();
        await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds);
        const treeOEGlobalConn = await Tree.getElement(constants.openEditorsTreeSection,
            globalConn.caption);
        const newMySQLScript = await Tree.getActionButton(treeOEGlobalConn, constants.newMySQLScript);
        await driver.executeScript("arguments[0].click()", newMySQLScript);
        await driver.wait(waitUntil.currentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect(await Notebook.getCurrentEditorType(), `The current editor type should be 'Mysql'`).to.include("Mysql");
        const treeItem = await Tree.getScript(/Untitled-/, "Mysql");
        await (await Tree.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New MySQL Script", async () => {

        await Section.focus(constants.openEditorsTreeSection);
        const item = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
        await Tree.openContextMenuAndSelect(item, constants.newMySQLScript);
        await driver.wait(waitUntil.currentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect(await Notebook.getCurrentEditorType(), `The current editor type should be 'Mysql'`).to.include("Mysql");
        const treeItem = await Tree.getScript(/Untitled-/, "Mysql");
        await (await Tree.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New JavaScript Script", async () => {

        const item = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
        await Tree.openContextMenuAndSelect(item, constants.newJS);
        await driver.wait(waitUntil.currentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect(await Notebook.getCurrentEditorType(), `The current editor type should be 'scriptJs'`)
            .to.include("scriptJs");
        const treeItem = await Tree.getScript(/Untitled-/, "scriptJs");
        await (await Tree.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New TypeScript Script", async () => {

        const item = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
        await Tree.openContextMenuAndSelect(item, constants.newTS);
        await driver.wait(waitUntil.currentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect(await Notebook.getCurrentEditorType(), `The current editor type should be 'scriptTs'`)
            .to.include("scriptTs");
        const treeItem = await Tree.getScript(/Untitled-/, "scriptTs");
        await (await Tree.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Collapse All", async () => {

        const treeOpenEditorsSection = await Section.getSection(constants.openEditorsTreeSection);
        await Section.clickToolbarButton(treeOpenEditorsSection, constants.collapseAll);
        const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
        expect(treeVisibleItems.length, `The tree items were not collapsed`).to.equals(3);
        expect(await treeVisibleItems[0].getLabel(), errors.doesNotExistOnTree(constants.dbConnectionsLabel))
            .to.equals(constants.dbConnectionsLabel);
        expect(await treeVisibleItems[1].getLabel(), errors.doesNotExistOnTree(globalConn.caption))
            .to.equals(globalConn.caption);

        expect(await treeVisibleItems[2].getLabel(), errors.doesNotExistOnTree(constants.mysqlShellConsoles))
            .to.equals(constants.mysqlShellConsoles);

    });

    it("Open DB Connection Overview", async () => {

        await (await Tree.getElement(constants.openEditorsTreeSection, constants.dbConnectionsLabel)).click();
        await Misc.switchToFrame();
        expect(await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
            constants.wait10seconds, "DB Connection Overview page was not displayed")).to.exist;

    });

    it("Open DB Notebook", async () => {

        const item = await Tree.getElement(constants.openEditorsTreeSection, globalConn.caption);
        await item.expand();
        await (await Tree.getElement(constants.openEditorsTreeSection,
            constants.openEditorsDBNotebook)).click();
        await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait15seconds,
            "Connection was not opened");

    });

    it("Open Shell Session", async () => {

        const item = await Tree.getElement(constants.openEditorsTreeSection, constants.mysqlShellConsoles);
        await item.expand();
        await (await Tree.getElement(constants.openEditorsTreeSection, "Session 1")).click();
        await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");

    });

});
