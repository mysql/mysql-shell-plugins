/*
 * Copyright (c) 2023 Oracle and/or its affiliates.
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
    BottomBarPanel, EditorView,
    ActivityBar, until,
} from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/misc";
import { Shell } from "../lib/shell";
import { Notebook } from "../lib/webviews/notebook";
import * as constants from "../lib/constants";
import * as waitUntil from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";

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
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `globalDBConnenction`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes, "Extension was not ready");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Misc.dismissNotifications();
            await Misc.toggleBottomBar(false);
            await Misc.createConnection(globalConn);
            const edView = new EditorView();
            await edView.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            if (await Misc.requiresMRSMetadataUpgrade(globalConn)) {
                await Misc.upgradeMRSMetadata();
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Misc.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            const dbConnections = await Misc.getDBConnections();
            for (const dbConnection of dbConnections) {
                await Misc.deleteConnection(dbConnection.name, dbConnection.isMySQL, false);
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    afterEach(async function () {
        if (this.currentTest.state === "failed") {
            await Misc.processFailure(this);
        }

        await Misc.switchBackToTopFrame();
    });


    it("New Shell Notebook", async () => {
        const treeDBConnections = await Misc.getTreeElement(constants.openEditorsTreeSection,
            constants.dbConnectionsLabel);
        await Misc.openContextMenuItem(treeDBConnections, constants.openNewShellConsole,
            constants.checkNewTabAndWebView);
        await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");
        await Misc.switchBackToTopFrame();
        const treeOEShellConsoles = await Misc.getTreeElement(constants.openEditorsTreeSection,
            constants.mysqlShellConsoles);

        expect(await treeOEShellConsoles.findChildItem("Session 1")).to.exist;

    });

    it("Icon - New MySQL Script", async () => {

        await Misc.sectionFocus(constants.dbTreeSection);
        const treeLocalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
        await (await Misc.getActionButton(treeLocalConn, constants.openNewConnection)).click();
        await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait5seconds);
        await Misc.switchBackToTopFrame();
        const treeOEGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection,
            globalConn.caption);

        await (await Misc.getActionButton(treeOEGlobalConn, "New MySQL Script")).click();
        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
        expect(treeItem).to.exist;
        await new EditorView().openEditor(globalConn.caption);
        await Misc.switchToFrame();
        expect(await Notebook.getCurrentEditorName()).to.match(/Untitled-(\d+)/);
        expect(await Notebook.getCurrentEditorType()).to.include("Mysql");
        await Misc.switchBackToTopFrame();
        await (await Misc.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New MySQL Script", async () => {

        await Misc.sectionFocus(constants.openEditorsTreeSection);
        const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
        await Misc.openContextMenuItem(item, constants.newMySQLScript, constants.checkNewTabAndWebView);
        await driver.wait(async () => {
            return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
        }, constants.wait5seconds, "Current editor is not Untitled-(*)");
        expect(await Notebook.getCurrentEditorType()).to.include("Mysql");
        await Misc.switchBackToTopFrame();
        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
        expect(treeItem).to.exist;
        await (await Misc.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New JavaScript Script", async () => {

        const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
        await Misc.openContextMenuItem(item, constants.newJS, constants.checkNewTabAndWebView);
        await driver.wait(async () => {
            return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
        }, constants.wait5seconds, "Current editor is not Untitled-(*)");
        expect(await Notebook.getCurrentEditorType()).to.include("scriptJs");
        await Misc.switchBackToTopFrame();
        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");
        expect(treeItem).to.exist;
        await (await Misc.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Context menu - New TypeScript Script", async () => {

        const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
        await Misc.openContextMenuItem(item, constants.newTS, constants.checkNewTabAndWebView);
        await driver.wait(async () => {
            return (await Notebook.getCurrentEditorName()).match(/Untitled-(\d+)/);
        }, constants.wait5seconds, "Current editor is not Untitled-(*)");
        expect(await Notebook.getCurrentEditorType()).to.include("scriptTs");
        await Misc.switchBackToTopFrame();
        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        const treeItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");
        expect(treeItem).to.exist;
        await (await Misc.getActionButton(treeItem, "Close Editor")).click();

    });

    it("Collapse All", async () => {

        const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
        await Misc.clickSectionToolbarButton(treeOpenEditorsSection, constants.collapseAll);
        const treeVisibleItems = await treeOpenEditorsSection.getVisibleItems();
        expect(treeVisibleItems.length).to.equals(3);
        expect(await treeVisibleItems[0].getLabel()).to.equals(constants.dbConnectionsLabel);
        expect(await treeVisibleItems[1].getLabel()).to.equals(globalConn.caption);
        expect(await treeVisibleItems[2].getLabel()).to.equals(constants.mysqlShellConsoles);

    });

    it("Open DB Connection Overview", async () => {

        await (await Misc.getTreeElement(constants.openEditorsTreeSection, constants.dbConnectionsLabel)).click();
        await Misc.switchToFrame();
        expect(await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
            constants.wait10seconds, "DB Connection Overview page was not displayed")).to.exist;

    });

    it("Open DB Notebook", async () => {

        const item = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
        await item.expand();
        await (await Misc.getTreeElement(constants.openEditorsTreeSection,
            constants.openEditorsDBNotebook)).click();
        await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait5seconds,
            "Connection was not opened");

    });

    it("Open Shell Session", async () => {

        const item = await Misc.getTreeElement(constants.openEditorsTreeSection, constants.mysqlShellConsoles);
        await item.expand();
        await (await Misc.getTreeElement(constants.openEditorsTreeSection, "Session 1")).click();
        await Misc.switchToFrame();
        await driver.wait(Shell.isShellLoaded(), constants.wait15seconds, "Shell Console was not loaded");

    });

});
