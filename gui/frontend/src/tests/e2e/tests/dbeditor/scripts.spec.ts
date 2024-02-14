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

import { until, WebDriver } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { basename } from "path";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";

let driver: WebDriver;
const url = Misc.getUrl(basename(basename(__filename)));

describe("Scripts", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `connScripts`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser3",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser3",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    const commandExecutor = new CommandExecutor();

    beforeAll(async () => {
        driver = await Misc.loadDriver();
        try {
            const filename = basename(__filename);
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.findElement(locator.sqlEditorPage.icon).click();
            const db = await DBNotebooks.createDBconnection(driver, globalConn);
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(driver, globalConn);
            await Misc.setConfirmDialog(driver, globalConn, "no");
            await driver.wait(until.elementLocated(locator.notebook.toolbar.exists), explicitWait * 2,
                "Notebook was not loaded");
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_Scripts");
            throw e;
        }

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot(driver);
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });


    it("Add_run JS script", async () => {
        try {
            await DBConnection.expandCollapseMenus(driver, "scripts", true, 0);
            const script = await DBConnection.addScript(driver, "JS");
            await DBConnection.selectCurrentEditor(driver, script, "scriptJs");
            expect(await DBConnection.existsScript(driver, script, "scriptJs")).toBe(true);
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
                await (await DBConnection.getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await DBConnection.getOpenEditor(driver, script))!
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("scriptJs");

            await commandExecutor.executeScript(driver, "Math.random()", false);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {
            const script = await DBConnection.addScript(driver, "SQL");
            await DBConnection.selectCurrentEditor(driver, script, "Mysql");
            expect(await DBConnection.existsScript(driver, script, "Mysql")).toBe(true);
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
                await (await DBConnection.getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");
            expect(
                await (await DBConnection.getOpenEditor(driver, script))!
                    .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                    .getAttribute("src"),
            ).toContain("Mysql");
            await commandExecutor.executeScript(driver, "select * from sakila.actor limit 1;", false);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run TS script", async () => {
        try {
            const script = await DBConnection.addScript(driver, "TS");
            await DBConnection.selectCurrentEditor(driver, script, "scriptTs");
            expect(await DBConnection.existsScript(driver, script, "scriptTs")).toBe(true);
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
                await (await DBConnection.getOpenEditor(driver, script))!.getAttribute("class"),
            ).toContain("selected");

            src = (await (await DBConnection.getOpenEditor(driver, script))!
                .findElement(locator.notebook.toolbar.editorSelector.currentImage)
                .getAttribute("src"));

            expect(src.indexOf("scriptTs") !== -1).toBe(true);

            await commandExecutor.executeScript(driver, "Math.random()", false);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {
            await DBConnection.selectCurrentEditor(driver, "DB Notebook", "notebook");
            const script1 = await DBConnection.addScript(driver, "JS");
            await DBConnection.selectCurrentEditor(driver, script1, "scriptJs");

            let textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello JavaScript')");

            const script2 = await DBConnection.addScript(driver, "TS");
            await DBConnection.selectCurrentEditor(driver, script2, "scriptTs");
            textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello Typescript')");

            const script3 = await DBConnection.addScript(driver, "SQL");
            await DBConnection.selectCurrentEditor(driver, script3, "Mysql");
            textArea = await driver.findElement(locator.notebook.codeEditor.editor.host)
                .findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            await DBConnection.selectCurrentEditor(driver, script1, "scriptJs");

            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.host)
                    .findElement(locator.notebook.codeEditor.textArea)
                    .getAttribute("value"),
            ).toBe("console.log('Hello JavaScript')");

            await DBConnection.selectCurrentEditor(driver, script2, "scriptTs");

            expect(
                await driver
                    .findElement(locator.notebook.codeEditor.editor.host)
                    .findElement(locator.notebook.codeEditor.textArea)
                    .getAttribute("value"),
            ).toBe("console.log('Hello Typescript')");

            await DBConnection.selectCurrentEditor(driver, script3, "Mysql");

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
            await DBConnection.selectCurrentEditor(driver, "DB Notebook", "notebook");
        }
    });

});
