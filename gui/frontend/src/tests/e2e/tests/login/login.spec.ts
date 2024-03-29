/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
import { Misc, explicitWait, driver } from "../../lib/misc.js";
import { By, until } from "selenium-webdriver";
import { basename } from "path";

describe("Login", () => {

    let testFailed = false;

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            try {
                await Misc.loadPage(String(process.env.SHELL_UI_MU_HOSTNAME));
                await Misc.waitForLoginPage();
            } catch (e) {
                await driver.navigate().refresh();
                await Misc.waitForLoginPage();
            }
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Login");
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
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.quit();
    });

    it("Verify page", async () => {
        try {
            const text = await (await driver.findElement(By.id("headingSubLabel"))).getText();
            expect(text).toContain("Welcome to the MySQL Shell GUI.");
            expect(text).toContain("Please provide your MySQL Shell GUI credentials to log into the shell interface.");

            const links = await driver.findElements(By.css("#loginDialogLinks a"));

            expect(links.length).toBe(3);

            expect(await links[0].getText()).toBe("Learn More >");
            expect(await links[1].getText()).toBe("Browse Tutorial >");
            expect(await links[2].getText()).toBe("Read Docs >");

            expect(await driver.findElement(By.id("loginUsername"))).toBeDefined();
            expect(await driver.findElement(By.id("loginPassword"))).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid login", async () => {
        try {
            await driver.findElement(By.id("loginUsername")).sendKeys("client");
            await driver.findElement(By.id("loginPassword")).sendKeys("root");
            await driver.findElement(By.id("loginButton")).click();

            const error = await driver.wait(until.elementLocated(By.css("div.message.error")),
                explicitWait * 2, "Error was not found");

            expect(await error.getText()).toBe("User could not be authenticated. Incorrect username or password.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Successfull login", async () => {
        try {
            const username = await driver.findElement(By.id("loginUsername"));
            await username.clear();
            await username.sendKeys("client");

            const password = await driver.findElement(By.id("loginPassword"));
            await password.clear();
            await password.sendKeys("client");
            await driver.findElement(By.id("loginButton")).click();

            const result = await driver.wait(async () => {
                return (await driver.findElements(By.id("mainActivityBarItemstepDown"))).length > 0;
            }, 5000, "Login was unsuccessful");

            expect(result).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
