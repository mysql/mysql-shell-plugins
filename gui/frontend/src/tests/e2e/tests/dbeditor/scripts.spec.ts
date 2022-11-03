/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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
import { loadDriver, loadPage, driver } from "../../lib/engine";
import { By } from "selenium-webdriver";
import {
    IDBConnection,
    waitForHomePage,
    getDB,
    createDBconnection,
    getToolbarButton,
    addScript,
    getOpenEditor,
    selectCurrentEditor,
    setDBEditorPassword,
    setConfirmDialog,
    initConDialog,
    existsScript,
    expandCollapseDBEditorMenus,
    getScriptResult,
} from "../../lib/helpers";

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
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();
        let db = await getDB("conn");

        if (!db) {
            await initConDialog();
            await createDBconnection(globalConn, true);
            db = await getDB(globalConn.caption);
        }

        try {
            await driver.executeScript("arguments[0].click();", db);
            await setDBEditorPassword(globalConn);
            await setConfirmDialog(globalConn, "yes");
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
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
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

            await expandCollapseDBEditorMenus("scripts", true, 0);

            const script = await addScript("JS");

            await selectCurrentEditor(script, "javascript");

            expect(await existsScript(script, "javascript")).toBe(true);

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
                await (await getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("javascript");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("Math.random()");

            await (
                await getToolbarButton("Execute full script")
            )!.click();

            expect(await getScriptResult()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run TS script", async () => {
        try {

            const script = await addScript("TS");

            await selectCurrentEditor(script, "typescript");

            expect(await existsScript(script, "typescript")).toBe(true);

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
                await (await getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            src = (await (await getOpenEditor(script))!.findElement(By.css("img"))
                .getAttribute("src"));

            expect(src.indexOf("typescript") !== -1).toBe(true);

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("Math.random()");

            await (
                await getToolbarButton("Execute full script")
            )!.click();

            expect(await getScriptResult()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add_run SQL script", async () => {
        try {

            const script = await addScript("SQL");

            await selectCurrentEditor(script, "mysql");

            expect(await existsScript(script, "mysql")).toBe(true);

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
                await (await getOpenEditor(script))!.getAttribute("class"),
            ).toContain("selected");

            expect(
                await (await getOpenEditor(script))!
                    .findElement(By.css("img"))
                    .getAttribute("src"),
            ).toContain("mysql");

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            const execCaret = await getToolbarButton("Execute the statement at the caret position");
            await execCaret?.click();

            await driver.wait(async () => {
                return (await getScriptResult()) !== "";
            }, 15000, "No results from query were found");

            expect(await getScriptResult()).toMatch(/OK, (\d+) records/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {
            await selectCurrentEditor("DB Notebook", "shell");

            const script1 = await addScript("JS");

            try {
                await selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script1, "javascript");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello JavaScript')");

            const script2 = await addScript("TS");

            try {
                await selectCurrentEditor(script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script2, "typescript");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("console.log('Hello Typescript')");

            const script3 = await addScript("SQL");

            try {
                await selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script3, "mysql");
                } else {
                    throw e;
                }
            }

            await driver
                .findElement(By.id("editorPaneHost"))
                .findElement(By.css("textarea"))
                .sendKeys("SELECT * FROM sakila.actor;");

            try {
                await selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script1, "javascript");
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
                await selectCurrentEditor(script2, "typescript");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script2, "typescript");
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
                await selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await selectCurrentEditor(script3, "mysql");
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
            await selectCurrentEditor("DB Notebook", "shell");
        }
    });

});
