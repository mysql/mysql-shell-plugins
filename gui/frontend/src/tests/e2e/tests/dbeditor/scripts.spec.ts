/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { promises as fsPromises } from "fs";

import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks } from "../../lib/dbNotebooks";
import { By, WebElement } from "selenium-webdriver";

describe("Scripts", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `conn${new Date().valueOf()}`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();

        let db: WebElement | undefined;
        try {
            db = await DBNotebooks.getConnection("conn");
        } catch (e) {
            db = undefined;
        }

        if (!db) {
            await DBNotebooks.initConDialog();
            db = await DBNotebooks.createDBconnection(globalConn, true);
        }

        try {
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(globalConn);
            await Misc.setConfirmDialog(globalConn, "yes");
        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("dialog was found") === -1) {
                    throw e;
                }
            }
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName = Misc.currentTestName() ?? "";
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });


    afterAll(async () => {
        await driver.quit();
    });


    it("Add_run JS script", async () => {
        try {

            await DBConnection.expandCollapseMenus("scripts", true, 0);

            const script = await DBConnection.addScript("JS");

            await DBConnection.selectCurrentEditor(script, "javascript");

            expect(await DBConnection.existsScript(script, "javascript")).toBe(true);

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("javascript");

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("label"))
                    .getText(),
            ).toBe(script);

            expect(
                await (await DBConnection.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await DBConnection.getOpenEditor(script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("javascript");

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("M");
            await textArea.sendKeys("ath.random()");

            await (
                await DBConnection.getToolbarButton("Execute full script")
            )!.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult()) !== "";
            }, explicitWait, "No results from query were found");

            expect(await DBConnection.getScriptResult()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run TS script", async () => {
        try {

            const script = await DBConnection.addScript("TS");

            await DBConnection.selectCurrentEditor(script, "typescript");

            expect(await DBConnection.existsScript(script, "typescript")).toBe(true);

            expect(
                await driver.findElement(By.css(".editorHost")).getAttribute("data-mode-id"),

            ).toBe("typescript");

            let src = await driver.findElement(By.id("documentSelector")).findElement(By.css("img"))
                .getAttribute("src");

            expect(
                src.indexOf("typescript") !== -1,
            ).toBe(true);

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("label"))
                    .getText(),
            ).toBe(script);

            expect(
                await (await DBConnection.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            src = (await (await DBConnection.getOpenEditor(script))!.findElement(By.css("img"))
                .getAttribute("src"));

            expect(src.indexOf("typescript") !== -1).toBe(true);

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("M");
            await textArea.sendKeys("ath.random()");

            await (
                await DBConnection.getToolbarButton("Execute full script")
            )!.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult()) !== "";
            }, explicitWait, "No results from query were found");

            expect(await DBConnection.getScriptResult()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {

            const script = await DBConnection.addScript("SQL");

            await DBConnection.selectCurrentEditor(script, "mysql");

            expect(await DBConnection.existsScript(script, "mysql")).toBe(true);

            expect(
                await driver
                    .findElement(By.css(".editorHost"))
                    .getAttribute("data-mode-id"),
            ).toBe("mysql");

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("mysql");

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("label"))
                    .getText(),
            ).toBe(script);

            expect(
                await (await DBConnection.getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await DBConnection.getOpenEditor(script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("mysql");

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            const execCaret = await DBConnection.getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult(true)) !== "";
            }, 15000, "No results from query were found");

            expect(await DBConnection.getScriptResult(true)).toMatch(/OK, (\d+) records/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {
            await DBConnection.selectCurrentEditor("DB Notebook", "notebook");

            const script1 = await DBConnection.addScript("JS");

            try {
                await DBConnection.selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script1, "javascript");
                } else {
                    throw e;
                }
            }

            let textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello JavaScript')");

            const script2 = await DBConnection.addScript("TS");

            try {
                await DBConnection.selectCurrentEditor(script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script2, "typescript");
                } else {
                    throw e;
                }
            }

            textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello Typescript')");

            const script3 = await DBConnection.addScript("SQL");

            try {
                await DBConnection.selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script3, "mysql");
                } else {
                    throw e;
                }
            }

            textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            try {
                await DBConnection.selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script1, "javascript");
                } else {
                    throw e;

                }
            }

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("console.log('Hello JavaScript')");

            try {
                await DBConnection.selectCurrentEditor(script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script2, "typescript");
                } else {
                    throw e;
                }
            }

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("console.log('Hello Typescript')");

            try {
                await DBConnection.selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script3, "mysql");
                } else {
                    throw e;
                }
            }

            expect(
                await driver
                    .findElement(By.id("editorPaneHost"))
                    .findElement(By.css("textarea"))
                    .getAttribute("value"),
            ).toBe("SELECT * FROM sakila.actor;");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await DBConnection.selectCurrentEditor("DB Notebook", "notebook");
        }
    });

});
