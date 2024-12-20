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

import { join } from "path";
import { BottomBarPanel, ActivityBar, until } from "vscode-extension-tester";
import { expect } from "chai";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os.js";
import { Workbench } from "../lib/Workbench";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { Script } from "../lib/WebViews/Script";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";

describe("OPEN EDITORS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `e2eGlobalDBConnection`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Workbench.dismissNotifications();
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption), constants.wait5seconds);
            await Workbench.closeAllEditors();
            await new BottomBarPanel().toggle(false);
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

    afterEach(async function () {
        if (this.currentTest.state === "failed") {
            await Misc.processFailure(this);
        }
    });


    it("New Shell Notebook", async () => {

        await openEditorsTreeSection.expand();
        const treeDBConnections = await openEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
        await openEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections, constants.openNewShellConsole);
        await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
            "Shell Console was not loaded");
        const treeOEShellConsoles = await openEditorsTreeSection.tree.getElement(constants.mysqlShellConsoles);
        expect(await treeOEShellConsoles.findChildItem("Session 1"), errors.doesNotExistOnTree("Session 1")).to.exist;
    });

    it("Icon - New MySQL Script", async () => {

        await dbTreeSection.focus();
        const treeLocalConn = await dbTreeSection.tree.getElement(globalConn.caption);
        await (await dbTreeSection.tree.getActionButton(treeLocalConn,
            constants.openNewConnectionUsingNotebook)).click();
        await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait15seconds);
        const treeOEGlobalConn = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        const newMySQLScript = await openEditorsTreeSection.tree.getActionButton(treeOEGlobalConn,
            constants.newMySQLScript);
        await driver.executeScript("arguments[0].click()", newMySQLScript);
        await driver.wait(Workbench.untilCurrentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect((await new Script().toolbar.editorSelector.getCurrentEditor()).icon,
            `The current editor icon should be 'Mysql'`)
            .to.include(constants.mysqlScriptIcon);
        const treeItem = await openEditorsTreeSection.tree.getScript(/Untitled-/, constants.mysqlType);
        await (await openEditorsTreeSection.tree.getActionButton(treeItem, constants.closeEditor)).click();

    });

    it("Icon - Load SQL Script from Disk", async () => {

        const sqlScript = "setup.sql";
        const treeOEGlobalConn = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        const loadScriptFromDisk = await openEditorsTreeSection.tree.getActionButton(treeOEGlobalConn,
            constants.loadScriptFromDisk);
        await driver.executeScript("arguments[0].click()", loadScriptFromDisk);
        await Workbench.setInputPath(join(process.cwd(), "sql", sqlScript));
        await driver.wait(Workbench.untilCurrentEditorIs(new RegExp(sqlScript)), constants.wait5seconds);
        await driver.wait(openEditorsTreeSection.tree.untilExists(sqlScript), constants.wait5seconds);
        expect((await new Script().codeEditor.existsText("GEOMETRYCOLLECTION"))).to.be.true;
        const treeItem = await openEditorsTreeSection.tree.getScript(new RegExp(sqlScript), constants.mysqlType);
        await (await openEditorsTreeSection.tree.getActionButton(treeItem, constants.closeEditor)).click();

    });

    it("Context menu - New MySQL Script", async () => {

        await openEditorsTreeSection.focus();
        const item = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        await openEditorsTreeSection.tree.openContextMenuAndSelect(item, constants.newMySQLScript);
        await driver.wait(Workbench.untilCurrentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect((await new Script().toolbar.editorSelector.getCurrentEditor()).icon,
            `The current editor icon should be 'Mysql'`)
            .to.include(constants.mysqlScriptIcon);
        const treeItem = await openEditorsTreeSection.tree.getScript(/Untitled-/, constants.mysqlType);
        await (await openEditorsTreeSection.tree.getActionButton(treeItem, constants.closeEditor)).click();

    });

    it("Context menu - New JavaScript Script", async () => {

        const item = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        await openEditorsTreeSection.tree.openContextMenuAndSelect(item, constants.newJS);
        await driver.wait(Workbench.untilCurrentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect((await new Script().toolbar.editorSelector.getCurrentEditor()).icon,
            `The current editor icon should be 'scriptJs'`)
            .to.include(constants.jsScriptIcon);
        const treeItem = await openEditorsTreeSection.tree.getScript(/Untitled-/, constants.jsType);
        await (await openEditorsTreeSection.tree.getActionButton(treeItem, constants.closeEditor)).click();

    });

    it("Context menu - New TypeScript Script", async () => {

        const item = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        await openEditorsTreeSection.tree.openContextMenuAndSelect(item, constants.newTS);
        await driver.wait(Workbench.untilCurrentEditorIs(/Untitled-(\d+)/), constants.wait5seconds);
        expect((await new Script().toolbar.editorSelector.getCurrentEditor()).icon,
            `The current editor icon should be 'scriptTs'`)
            .to.include(constants.tsScriptIcon);
        const treeItem = await openEditorsTreeSection.tree.getScript(/Untitled-/, constants.tsType);
        await (await openEditorsTreeSection.tree.getActionButton(treeItem, constants.closeEditor)).click();

    });

    it("Collapse All", async () => {

        await openEditorsTreeSection.clickToolbarButton(constants.collapseAll);
        const treeVisibleItems = await (await openEditorsTreeSection.getWebElement()).getVisibleItems();
        expect(treeVisibleItems.length, `The tree items were not collapsed`).to.equals(3);
        expect(await treeVisibleItems[0].getLabel(), errors.doesNotExistOnTree(constants.dbConnectionsLabel))
            .to.equals(constants.dbConnectionsLabel);
        expect(await treeVisibleItems[1].getLabel(), errors.doesNotExistOnTree(globalConn.caption))
            .to.equals(globalConn.caption);
        expect(await treeVisibleItems[2].getLabel(), errors.doesNotExistOnTree(constants.mysqlShellConsoles))
            .to.equals(constants.mysqlShellConsoles);
    });

    it("Open DB Connection Overview", async () => {

        await (await openEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel)).click();
        await Misc.switchToFrame();
        expect(await driver.wait(until.elementLocated(locator.notebook.toolbar.editorSelector.exists),
            constants.wait10seconds, "DB Connection Overview page was not displayed")).to.exist;

    });

    it("Open DB Notebook", async () => {

        const item = await openEditorsTreeSection.tree.getElement(globalConn.caption);
        await item.expand();
        await (await openEditorsTreeSection.tree.getElement(constants.openEditorsDBNotebook)).click();
        await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait15seconds,
            "Connection was not opened");

    });

    it("Open Shell Session", async () => {

        const item = await openEditorsTreeSection.tree.getElement(constants.mysqlShellConsoles);
        await item.expand();
        await (await openEditorsTreeSection.tree.getElement("Session 1")).click();
        await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
            "Shell Console was not loaded");
        await Workbench.closeEditor(new RegExp(constants.mysqlShellConsoles));
    });

    it("Open multiple shell sessions", async () => {

        const openedSessions: number[] = [];

        for (let i = 1; i <= 3; i++) {
            const treeDBConnections = await openEditorsTreeSection.tree.getElement(constants.dbConnectionsLabel);
            await openEditorsTreeSection.tree.openContextMenuAndSelect(treeDBConnections,
                constants.openNewShellConsole);
            await driver.wait(new E2EShellConsole().untilIsOpened(), constants.wait15seconds,
                "Shell Console was not loaded");
            await driver.wait(openEditorsTreeSection.tree.untilExists(`Session ${i}`), constants.wait5seconds);
            openedSessions.push(i);
        }

    });

});
