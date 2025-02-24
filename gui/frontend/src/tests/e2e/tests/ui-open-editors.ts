/*
 * Copyright (c) 2023, 2025 Oracle and/or its affiliates.
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

import { join, basename } from "path";
import { Misc } from "../lib/misc.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { E2EScript } from "../lib/E2EScript.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { E2ETabContainer } from "../lib/E2ETabContainer.js";
import { E2ESettings } from "../lib/E2ESettings.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("OPEN EDITORS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `E2E - OPEN EDITORS`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT!, 10),
            schema: "sakila",
            password: String(process.env.DBUSERNAME1PWD),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
    let notebook: E2ENotebook;
    let testFailed = false;

    beforeAll(async () => {

        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            const settings = new E2ESettings();
            await settings.open();
            await settings.selectCurrentTheme(constants.darkModern);
            await settings.close();

            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_OPEN_EDITORS");
            throw e;
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    it("Add new console", async () => {
        try {
            await openEditorsTreeSection.focus();
            await openEditorsTreeSection.clickToolbarButton(constants.addConsole);
            await driver.wait(new E2ETabContainer().untilTabIsOpened("Session 1"), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Icon - New MySQL Script", async () => {
        try {
            await dbTreeSection.focus();
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.openNewConnectionUsingNotebook))!.click();
            notebook = await new E2ENotebook().untilIsOpened(globalConn);
            await openEditorsTreeSection.focus();
            const treeOpenEditorsGlobalConn = await openEditorsTreeSection.getTreeItem(globalConn.caption!);
            const newMySQLScript = await treeOpenEditorsGlobalConn.getActionButton(constants.newMySQLScript);

            await driver.executeScript("arguments[0].click()", newMySQLScript);
            const currentEditor = await new E2EScript().toolbar.editorSelector.getCurrentEditor();
            const scriptName = "Script 2";
            expect(currentEditor.label).toBe(scriptName);
            expect(currentEditor.icon).toContain(constants.mysqlScriptIcon);
            const treeScript = await openEditorsTreeSection.getTreeItem(scriptName);
            await (await treeScript.getActionButton(constants.closeEditor))!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Icon - Load SQL Script from Disk", async () => {
        try {
            const sqlScript = "users.sql";
            const treeOpenEditorsGlobalConn = await openEditorsTreeSection.getTreeItem(globalConn.caption!);
            const loadScriptFromDisk = await treeOpenEditorsGlobalConn.getActionButton(
                constants.loadSQLScriptFromDisk);
            await driver.executeScript("arguments[0].click()", loadScriptFromDisk);
            await Misc.uploadFile(join(process.cwd(), "src", "tests", "e2e", "sql", sqlScript));
            const currentEditor = await new E2EScript().toolbar.editorSelector.getCurrentEditor();
            expect(currentEditor.label).toBe(sqlScript);

            await driver.wait(openEditorsTreeSection.untilTreeItemExists(sqlScript), constants.wait5seconds);
            expect((await new E2EScript().codeEditor.existsText("CREATE USER"))).toBe(true);
            const treeSqlScript = await openEditorsTreeSection.getTreeItem(sqlScript);
            await (await treeSqlScript.getActionButton(constants.closeEditor))!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context menu - New MySQL Script", async () => {
        try {
            await openEditorsTreeSection.focus();
            await openEditorsTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.newMySQLScript);
            const currentEditor = await new E2EScript().toolbar.editorSelector.getCurrentEditor();
            const scriptName = "Script 3";
            expect(currentEditor.label).toBe(scriptName);
            expect(currentEditor.icon).toContain(constants.mysqlScriptIcon);
            const treeSqlScript = await openEditorsTreeSection.getTreeItem(scriptName);
            await (await treeSqlScript.getActionButton(constants.closeEditor))!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context menu - New JavaScript Script", async () => {
        try {
            await openEditorsTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.newJS);
            const currentEditor = await new E2EScript().toolbar.editorSelector.getCurrentEditor();
            const scriptName = "Script 4";
            expect(currentEditor.label).toBe(scriptName);
            expect(currentEditor.icon).toContain(constants.jsType);
            const treeSqlScript = await openEditorsTreeSection.getTreeItem(scriptName);
            await (await treeSqlScript.getActionButton(constants.closeEditor))!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Context menu - New TypeScript Script", async () => {
        try {
            await openEditorsTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.newTS);
            const currentEditor = await new E2EScript().toolbar.editorSelector.getCurrentEditor();
            const scriptName = "Script 5";
            expect(currentEditor.label).toBe(scriptName);
            expect(currentEditor.icon).toContain(constants.tsType);
            const treeSqlScript = await openEditorsTreeSection.getTreeItem(scriptName);
            await (await treeSqlScript.getActionButton(constants.closeEditor))!.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Open DB Connection Overview", async () => {
        try {
            await (await openEditorsTreeSection.getTreeItem(constants.dbConnectionOverview)).click();
            expect((await new E2EDatabaseConnectionOverview().toolbar.editorSelector.getCurrentEditor()).label)
                .toBe(constants.dbConnectionOverview);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Open DB Notebook", async () => {
        try {
            await (await openEditorsTreeSection.getTreeItem(`${constants.dbNotebook} 1`)).click();
            expect((await notebook.toolbar.editorSelector.getCurrentEditor()).label).toBe(`${constants.dbNotebook} 1`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
