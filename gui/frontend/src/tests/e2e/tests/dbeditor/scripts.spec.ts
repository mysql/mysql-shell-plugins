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

import { Key } from "selenium-webdriver";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { Misc } from "../../lib/misc.js";
import { basename } from "path";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as waitUntil from "../../lib/until.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { E2EStatusBar } from "../../lib/E2EStatusBar.js";

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

    const commandExecutor = new CommandExecutor();

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
            await DBNotebooks.createDataBaseConnection(globalConn);
            await driver.executeScript("arguments[0].click();", await DBNotebooks.getConnection(globalConn.caption!));
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait10seconds);
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


    it("Add_run JS script", async () => {
        try {
            await DBNotebooks.toggleSection("scripts", true, 0);
            const script = await DBNotebooks.addScript("JS");
            await DBNotebooks.selectCurrentEditor(script, "scriptJs");
            expect(await DBNotebooks.existsScript(script, "scriptJs")).toBe(true);
            expect(
                await driver
                    .findElement(locator.notebook.toolbar.exists)
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("scriptJs");

            expect(
                await driver
                    .findElement(locator.notebook.toolbar.editorSelector.exists)
                    .findElement(locator.notebook.toolbar.editorSelector.currentValue)
                    .getText(),
            ).toBe(script);

            expect(
                await (await DBNotebooks.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await DBNotebooks.getOpenEditor(script))!
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("scriptJs");

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

            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing status bar");
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.ENTER);

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await commandExecutor.clean();
            await commandExecutor.executeScript("Math.random()", true);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {
            const script = await DBNotebooks.addScript("SQL");
            await DBNotebooks.selectCurrentEditor(script, "Mysql");
            expect(await DBNotebooks.existsScript(script, "Mysql")).toBe(true);
            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.editorHost)
                    .getAttribute("data-mode-id"),
            ).toBe("mysql");

            expect(
                await driver
                    .findElement(locator.notebook.toolbar.editorSelector.exists)
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("Mysql");
            expect(
                await driver
                    .findElement(locator.notebook.toolbar.editorSelector.exists)
                    .findElement(locator.notebook.toolbar.editorSelector.currentValue)
                    .getText(),
            ).toBe(script);
            expect(
                await (await DBNotebooks.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");
            expect(
                await (await DBNotebooks.getOpenEditor(script))!
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("Mysql");

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

            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing status bar");
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.ENTER);

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await commandExecutor.clean();
            await commandExecutor.executeScript("select * from sakila.actor limit 1;", false);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run TS script", async () => {
        try {
            const script = await DBNotebooks.addScript("TS");
            await DBNotebooks.selectCurrentEditor(script, "scriptTs");
            expect(await DBNotebooks.existsScript(script, "scriptTs")).toBe(true);
            expect(
                await driver.findElement(locator.notebook.codeEditor.editor.editorHost).getAttribute("data-mode-id"),

            ).toBe("typescript");

            let src = await driver.findElement(locator.notebook.toolbar.editorSelector.exists)
                .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                .getAttribute("src");

            expect(
                src.indexOf("scriptTs") !== -1,
            ).toBe(true);

            expect(
                await driver
                    .findElement(locator.notebook.toolbar.editorSelector.exists)
                    .findElement(locator.notebook.toolbar.editorSelector.currentValue)
                    .getText(),
            ).toBe(script);

            expect(
                await (await DBNotebooks.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            src = (await (await DBNotebooks.getOpenEditor(script))!
                .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                .getAttribute("src"));

            expect(src.indexOf("scriptTs") !== -1).toBe(true);

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

            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing status bar ");
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.ENTER);

            const nextEditorPosition = await statusBar.getEditorPosition();
            groups = nextEditorPosition.match(regex);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(line);
            expect(parseInt(groups![1], 10)).toBeGreaterThan(col);

            await commandExecutor.clean();
            await commandExecutor.executeScript("Math.random()", false);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {
            await DBNotebooks.selectCurrentEditor("DB Notebook", "notebook");
            const script1 = await DBNotebooks.addScript("JS");
            await DBNotebooks.selectCurrentEditor(script1, "scriptJs");

            let textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello JavaScript')");

            const script2 = await DBNotebooks.addScript("TS");
            await DBNotebooks.selectCurrentEditor(script2, "scriptTs");
            textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello Typescript')");

            const script3 = await DBNotebooks.addScript("SQL");
            await DBNotebooks.selectCurrentEditor(script3, "Mysql");
            textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            await DBNotebooks.selectCurrentEditor(script1, "scriptJs");

            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.host)
                    .findElement(locator.notebook.codeEditor.textArea)
                    .getAttribute("value"),
            ).toBe("console.log('Hello JavaScript')");

            await DBNotebooks.selectCurrentEditor(script2, "scriptTs");

            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.host)
                    .findElement(locator.notebook.codeEditor.textArea)
                    .getAttribute("value"),
            ).toBe("console.log('Hello Typescript')");

            await DBNotebooks.selectCurrentEditor(script3, "Mysql");

            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.host)
                    .findElement(locator.notebook.codeEditor.textArea)
                    .getAttribute("value"),
            ).toBe("SELECT * FROM sakila.actor;");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await DBNotebooks.selectCurrentEditor("DB Notebook", "notebook");
        }
    });

});
