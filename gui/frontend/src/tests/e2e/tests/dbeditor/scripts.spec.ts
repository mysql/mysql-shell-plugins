/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { Misc } from "../../lib/misc.js";
import { basename } from "path";
import * as locator from "../../lib/locators.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { E2EStatusBar } from "../../lib/E2EStatusBar.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { E2EScript } from "../../lib/E2EScript.js";

const url = Misc.getUrl(basename(basename(__filename)));

describe("Scripts", () => {

    let testFailed = false;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `connScripts`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: "dbuser3",
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: "dbuser3",
        },
    };

    const notebook = new E2ENotebook();

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.wait(async () => {
                try {
                    await Misc.waitForHomePage(url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, constants.wait20seconds, "Home Page was not loaded");

            await driver.findElement(locator.sqlEditorPage.icon).click();
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(globalConn.caption!));
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.explorer.toggleSection(constants.scripts, true);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Scripts");
            throw e;
        }

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });


    it("Create and run a JS script", async () => {
        try {

            const jsScript = await notebook.explorer.addScript("JS");
            await notebook.toolbar.selectEditor(new RegExp(jsScript));

            expect(await notebook.explorer.existsScript(jsScript, "scriptJs")).toBe(true);

            const statusBar = new E2EStatusBar();
            const editorPosition = await statusBar.getEditorPosition();
            const regex = new RegExp(/Ln (\d+), Col (\d+)/);
            expect(editorPosition).toMatch(regex);
            let groups = editorPosition.match(regex);
            const line = parseInt(groups![1], 10);
            const col = parseInt(groups![2], 10);
            expect(await statusBar.getEditorIdent()).toMatch(/Spaces: (\d+)/);
            expect(await statusBar.getEditorEOL()).toBe("LF");
            expect(await statusBar.getEditorLanguage()).toBe("javascript");

            const scriptObj = new E2EScript();
            await scriptObj.codeEditor.write("testing status bar");
            await scriptObj.codeEditor.setNewLine();

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await scriptObj.codeEditor.clean();
            const result = await scriptObj.codeEditor.execute("Math.random()");
            expect(result.text).toMatch(/(\d+).(\d+)/);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Create and run a SQL script", async () => {
        try {
            const sqlScript = await notebook.explorer.addScript("SQL");
            await notebook.toolbar.selectEditor(new RegExp(sqlScript));
            expect(await notebook.explorer.existsScript(sqlScript, "Mysql")).toBe(true);

            const statusBar = new E2EStatusBar();
            const editorPosition = await statusBar.getEditorPosition();
            const regex = new RegExp(/Ln (\d+), Col (\d+)/);
            expect(editorPosition).toMatch(regex);
            let groups = editorPosition.match(regex);
            const line = parseInt(groups![1], 10);
            const col = parseInt(groups![2], 10);
            expect(await statusBar.getEditorIdent()).toMatch(/Spaces: (\d+)/);
            expect(await statusBar.getEditorEOL()).toBe("LF");
            expect(await statusBar.getEditorLanguage()).toBe("mysql");

            const scriptObj = new E2EScript();
            await scriptObj.codeEditor.write("testing status bar");
            await scriptObj.codeEditor.setNewLine();

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await scriptObj.codeEditor.clean();
            const result = await scriptObj.codeEditor.execute("select * from sakila.actor limit 1;", false);
            expect(result.toolbar!.status).toMatch(/OK, (\d+) record/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Create and run a TS script", async () => {
        try {
            const tsScript = await notebook.explorer.addScript("TS");
            await notebook.toolbar.selectEditor(new RegExp(tsScript));
            expect(await notebook.explorer.existsScript(tsScript, "scriptTs")).toBe(true);

            const statusBar = new E2EStatusBar();
            const editorPosition = await statusBar.getEditorPosition();
            const regex = new RegExp(/Ln (\d+), Col (\d+)/);
            expect(editorPosition).toMatch(regex);
            let groups = editorPosition.match(regex);
            const line = parseInt(groups![1], 10);
            const col = parseInt(groups![2], 10);
            expect(await statusBar.getEditorIdent()).toMatch(/Spaces: (\d+)/);
            expect(await statusBar.getEditorEOL()).toBe("LF");
            expect(await statusBar.getEditorLanguage()).toBe("typescript");

            const scriptObj = new E2EScript();
            await scriptObj.codeEditor.write("testing status bar");
            await scriptObj.codeEditor.setNewLine();

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await scriptObj.codeEditor.clean();
            const result = await scriptObj.codeEditor.execute("Math.random()");
            expect(result.text).toMatch(/(\d+).(\d+)/);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {

            await notebook.toolbar.selectEditor(new RegExp(constants.dbNotebook));
            const jsScript = await notebook.explorer.addScript("JS");
            await notebook.toolbar.selectEditor(new RegExp(jsScript));

            const jsScriptObj = new E2EScript();
            const jsCode = "Hello JavaScript";
            await jsScriptObj.codeEditor.write(jsCode);

            const tsScript = await notebook.explorer.addScript("TS");
            await notebook.toolbar.selectEditor(new RegExp(tsScript));

            const tsScriptObj = new E2EScript();
            const tsCode = "Hello TypeScript";
            await tsScriptObj.codeEditor.write(tsCode);

            const sqlScript = await notebook.explorer.addScript("SQL");
            await notebook.toolbar.selectEditor(new RegExp(sqlScript));

            const sqlScriptObj = new E2EScript();
            const sqlCode = "SELECT * FROM sakila.actor;";
            await sqlScriptObj.codeEditor.write(sqlCode);

            await notebook.toolbar.selectEditor(new RegExp(jsScript));
            expect(await jsScriptObj.codeEditor.existsText(jsCode)).toBe(true);

            await notebook.toolbar.selectEditor(new RegExp(tsScript));
            expect(await tsScriptObj.codeEditor.existsText(tsCode)).toBe(true);

            await notebook.toolbar.selectEditor(new RegExp(sqlScript));
            expect(await sqlScriptObj.codeEditor.existsText(sqlCode)).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
