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

import { By, until } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks, execCaret, execFullScript } from "../../lib/dbNotebooks";
import { IDBConnection, Misc, driver, explicitWait } from "../../lib/misc";
import { addAttach } from "jest-html-reporters/helper";
import { basename } from "path";

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

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    const url = Misc.getUrl(basename(__filename));
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.loadPage(url);
                    await Misc.waitForHomePage();
                    await driver.findElement(By.id("gui.sqleditor")).click();

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 3, "Start Page was not loaded correctly");
            const db = await DBNotebooks.createDBconnection(globalConn);

            try {
                await driver.executeScript("arguments[0].click();", db);
                await Misc.setPassword(globalConn);
                await Misc.setConfirmDialog(globalConn, "no");
            } catch (e) {
                if (e instanceof Error) {
                    if (e.message.indexOf("dialog was found") === -1) {
                        throw e;
                    }
                }
            }
            await driver.wait(until.elementLocated(By.id("dbEditorToolbar")), explicitWait * 2,
                "Notebook was not loaded");
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Scripts");
            throw e;
        }

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await addAttach({
                attach: await Misc.storeScreenShot(),
                description: "screenshot",
            });
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });


    it("Add_run JS script", async () => {
        try {

            await DBConnection.expandCollapseMenus("scripts", true, 0);

            const script = await DBConnection.addScript("JS");

            await DBConnection.selectCurrentEditor(script, "scriptJs");

            expect(await DBConnection.existsScript(script, "scriptJs")).toBe(true);

            expect(
                await driver
                    .findElement(By.id("documentSelector"))
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("scriptJs");

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
            ).toContain("scriptJs");

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("M");
            await textArea.sendKeys("ath.random()");

            await (
                await DBConnection.getToolbarButton(execFullScript)
            )!.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult()).match(/(\d+).(\d+)/);
            }, explicitWait, "No results from query were found");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run TS script", async () => {
        try {

            const script = await DBConnection.addScript("TS");

            await DBConnection.selectCurrentEditor(script, "scriptTs");

            expect(await DBConnection.existsScript(script, "scriptTs")).toBe(true);

            expect(
                await driver.findElement(By.css(".editorHost")).getAttribute("data-mode-id"),

            ).toBe("typescript");

            let src = await driver.findElement(By.id("documentSelector")).findElement(By.css("img"))
                .getAttribute("src");

            expect(
                src.indexOf("scriptTs") !== -1,
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

            expect(src.indexOf("scriptTs") !== -1).toBe(true);

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("M");
            await textArea.sendKeys("ath.random()");

            await (
                await DBConnection.getToolbarButton(execFullScript)
            )!.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult()).match(/(\d+).(\d+)/);
            }, explicitWait, "No results from query were found");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {

            const script = await DBConnection.addScript("SQL");

            await DBConnection.selectCurrentEditor(script, "Mysql");

            expect(await DBConnection.existsScript(script, "Mysql")).toBe(true);

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
            ).toContain("Mysql");

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
            ).toContain("Mysql");

            const textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            const execCaretBtn = await DBConnection.getToolbarButton(execCaret);
            await execCaretBtn?.click();

            await driver.wait(async () => {
                return (await DBConnection.getScriptResult()).match(/OK, (\d+) records/);
            }, explicitWait * 2, "No results from query were found");
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
                await DBConnection.selectCurrentEditor(script1, "scriptJs");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script1, "scriptJs");
                } else {
                    throw e;
                }
            }

            let textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello JavaScript')");

            const script2 = await DBConnection.addScript("TS");

            try {
                await DBConnection.selectCurrentEditor(script2, "scriptTs");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script2, "scriptTs");
                } else {
                    throw e;
                }
            }

            textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("c");
            await textArea.sendKeys("onsole.log('Hello Typescript')");

            const script3 = await DBConnection.addScript("SQL");

            try {
                await DBConnection.selectCurrentEditor(script3, "Mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script3, "Mysql");
                } else {
                    throw e;
                }
            }

            textArea = await driver.findElement(By.id("editorPaneHost")).findElement(By.css("textarea"));
            await textArea.sendKeys("S");
            await textArea.sendKeys("ELECT * FROM sakila.actor;");

            try {
                await DBConnection.selectCurrentEditor(script1, "scriptJs");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script1, "scriptJs");
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
                await DBConnection.selectCurrentEditor(script2, "scriptTs");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script2, "scriptTs");
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
                await DBConnection.selectCurrentEditor(script3, "Mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await DBConnection.selectCurrentEditor(script3, "Mysql");
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
