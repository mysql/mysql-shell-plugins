/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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
import * as locator from "../../lib/locators.js";
import { until } from "selenium-webdriver";
import { basename } from "path";
import { driver, loadDriver } from "../../lib/driver.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";

describe("Login", () => {

    let testFailed = false;

    beforeAll(async () => {
        await loadDriver();
        await driver.get(String(process.env.SHELL_UI_MU_HOSTNAME));

        await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded")
            .catch(async (e) => {
                await Misc.storeScreenShot("beforeAll_Login");
                throw e;
            });
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

    it("Verify page", async () => {
        try {
            const text = await (await driver.findElement(locator.adminPage.headingText)).getText();
            expect(text).toContain("Welcome to the MySQL Shell GUI.");
            expect(text).toContain("Please provide your MySQL Shell GUI credentials to log into the shell interface.");

            const links = await driver.findElements(locator.adminPage.links);

            expect(links.length).toBe(2);

            expect(await links[0].getText()).toBe("Learn More >");
            expect(await links[1].getText()).toBe("Documentation >");

            expect(await driver.findElement(locator.adminPage.username)).toBeDefined();
            expect(await driver.findElement(locator.adminPage.password)).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid login", async () => {
        try {
            await driver.findElement(locator.adminPage.username).sendKeys("client");
            await driver.findElement(locator.adminPage.password).sendKeys("root");
            await driver.findElement(locator.adminPage.loginButton).click();

            const error = await driver.wait(until.elementLocated(locator.adminPage.error),
                constants.wait10seconds, "Error was not found");

            expect(await error.getText()).toBe("User could not be authenticated. Incorrect username or password.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Successful login", async () => {
        try {
            const username = await driver.findElement(locator.adminPage.username);
            await username.clear();
            await username.sendKeys("client");

            const password = await driver.findElement(locator.adminPage.password);
            await password.clear();
            await password.sendKeys("client");
            await driver.findElement(locator.adminPage.loginButton).click();

            const result = await driver.wait(async () => {
                return (await driver.findElements(locator.sqlEditorPage.icon)).length > 0;
            }, 5000, "Login was unsuccessful");

            expect(result).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
