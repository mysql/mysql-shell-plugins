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
import { WebDriver } from "selenium-webdriver";
import { basename } from "path";
import { Misc, explicitWait } from "../../lib/misc.js";
import { GuiConsole } from "../../lib/guiConsole.js";
import { ShellSession } from "../../lib/shellSession.js";
import * as locator from "../../lib/locators.js";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("GUI Console", () => {

    let testFailed: boolean;

    beforeAll(async () => {
        driver = await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    console.log(`${basename(__filename)} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");
            await driver.findElement(locator.shellPage.icon).click();
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_GuiConsole");
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
        await driver.quit();
    });

    it("Open multiple sessions", async () => {
        try {
            await GuiConsole.openSession(driver);
            await driver.findElement(locator.shellPage.guiConsoleTab).click();

            let session = await GuiConsole.getSession(driver, "1");
            expect(await session!.findElement(locator.shellPage.sessions.caption).getText()).toBe("Session 1");
            await GuiConsole.openSession(driver);
            await driver.findElement(locator.shellPage.guiConsoleTab).click();

            session = await GuiConsole.getSession(driver, "2");
            expect(await session!.findElement(locator.shellPage.sessions.caption).getText()).toBe("Session 2");

            await GuiConsole.openSession(driver);
            await driver.findElement(locator.shellPage.guiConsoleTab).click();
            session = await GuiConsole.getSession(driver, "3");
            expect(await session!.findElement(locator.shellPage.sessions.caption).getText()).toBe("Session 3");

            await ShellSession.closeSession(driver, "1");
            await driver.wait(async () => {
                return (await GuiConsole.getSession(driver, "1")) === undefined;
            }, explicitWait, "Session 1 was not closed");

            await ShellSession.closeSession(driver, "2");
            await driver.wait(async () => {
                return (await GuiConsole.getSession(driver, "2")) === undefined;
            }, explicitWait, "Session 2 was not closed");

            await ShellSession.closeSession(driver, "3");
            await driver.wait(async () => {
                return (await GuiConsole.getSession(driver, "3")) === undefined;
            }, explicitWait, "Session 3 was not closed");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
