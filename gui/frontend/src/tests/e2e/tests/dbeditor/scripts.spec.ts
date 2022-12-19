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

import { Misc, driver, IDBConnection, explicitWait } from "../../lib/misc";
import { DBConnection } from "../../lib/dbConnection";
import { DBNotebooks } from "../../lib/dbNotebooks";
import { By, WebElement, error } from "selenium-webdriver";

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
            await Misc.processFailure();
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


            const result = await DBConnection.execScript("Math.random();");

            expect(result[0]).toMatch(/(\d+).(\d+)/);
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

            const result = await DBConnection.execScript("Math.random();");

            expect(result[0]).toMatch(/(\d+).(\d+)/);
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

            const result = await DBConnection.execScript("select * from sakila.actor limit 1;", explicitWait*3);
            expect(result[0]).toMatch(/OK, (\d+) record/);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between scripts", async () => {
        try {
            await DBConnection.selectCurrentEditor("DB Notebook", "shell");

            const script1 = await DBConnection.addScript("JS");

            try {
                await DBConnection.selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    await DBConnection.selectCurrentEditor(script1, "javascript");
                } else {
                    throw e;
                }
            }

            await Misc.writeCmd("c");
            await Misc.writeCmd("onsole.log('Hello JavaScript')");

            const script2 = await DBConnection.addScript("TS");

            try {
                await DBConnection.selectCurrentEditor(script2, "typescript");
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    await DBConnection.selectCurrentEditor(script2, "typescript");
                } else {
                    throw e;
                }
            }

            await Misc.writeCmd("c");
            await Misc.writeCmd("onsole.log('Hello TypeScript')");

            const script3 = await DBConnection.addScript("SQL");

            try {
                await DBConnection.selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    await DBConnection.selectCurrentEditor(script3, "mysql");
                } else {
                    throw e;
                }
            }

            await Misc.writeCmd("s");
            await Misc.writeCmd("elect * from sakila.actor;");

            try {
                await DBConnection.selectCurrentEditor(script1, "javascript");
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
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
                if (e instanceof error.StaleElementReferenceError) {
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
            ).toBe("console.log('Hello TypeScript')");

            try {
                await DBConnection.selectCurrentEditor(script3, "mysql");
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
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
            ).toBe("select * from sakila.actor;");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await DBConnection.selectCurrentEditor("DB Notebook", "shell");
        }
    });

});
