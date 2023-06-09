/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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
import { Misc, driver, explicitWait } from "../../lib/misc";
import { By } from "selenium-webdriver";
import { GuiConsole } from "../../lib/guiConsole";
import { ShellSession } from "../../lib/shellSession";
import { addAttach } from "jest-html-reporters/helper";

describe("GUI Console", () => {

    let testFailed: boolean;

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            try {
                await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
                await Misc.waitForHomePage();
            } catch (e) {
                await driver.navigate().refresh();
                await Misc.waitForHomePage();
            }
            await driver.findElement(By.id("gui.shell")).click();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_GuiConsole");
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
        await driver.quit();
    });

    it("Open multiple sessions", async () => {
        try {

            await GuiConsole.openSession();
            await driver.findElement(By.id("sessions")).click();

            let session = await GuiConsole.getSession("1");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 1");
            await GuiConsole.openSession();
            await driver.findElement(By.id("sessions")).click();

            session = await GuiConsole.getSession("2");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 2");

            await GuiConsole.openSession();
            await driver.findElement(By.id("sessions")).click();
            session = await GuiConsole.getSession("3");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 3");

            await ShellSession.closeSession("1");
            await driver.wait(async () => {
                return (await GuiConsole.getSession("1")) === undefined;
            }, explicitWait, "Session 1 was not closed");

            await ShellSession.closeSession("2");
            await driver.wait(async () => {
                return (await GuiConsole.getSession("2")) === undefined;
            }, explicitWait, "Session 2 was not closed");

            await ShellSession.closeSession("3");
            await driver.wait(async () => {
                return (await GuiConsole.getSession("3")) === undefined;
            }, explicitWait, "Session 3 was not closed");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
