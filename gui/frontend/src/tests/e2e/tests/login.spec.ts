/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import { getDriver, load } from "../lib/engine";
import { WebDriver, By } from "selenium-webdriver";
import {
    findFreePort,
    waitForLoginPage,
} from "../lib/helpers";
import { startServer, setupServerFolder, createUser } from "../lib/env";
import { ChildProcess } from "child_process";

describe("Login", () => {
    let driver: WebDriver;
    let port: number;
    let child: ChildProcess;
    let serverPath: string;
    let testFailed = false;

    beforeAll(async () => {
        try {
            driver = await getDriver();
            port = await findFreePort();
            serverPath = await setupServerFolder(port);
            child = await startServer(driver, port, undefined);
        } catch (e) {
            if(child) { child.kill(); }
            console.error(e);
            if(driver) { await driver.quit(); }
            await new Promise((resolve) => {return setTimeout(resolve, 500);});
            process.exit(1);
        }
    });

    beforeEach(async () => {
        await load(driver, port, undefined);
        await waitForLoginPage(driver);
    });

    afterEach(async () => {
        if(testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch(e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });

    afterAll(async () => {
        child.kill();
        try {
            await fsPromises.rm(serverPath, {recursive: true});
        } catch(e) {
            //ignore exception
        }
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
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid login", async () => {
        try {
            await driver.findElement(By.id("loginUsername")).sendKeys("client");
            await driver.findElement(By.id("loginPassword")).sendKeys("client");
            await driver.findElement(By.id("loginButton")).click();

            expect( await (await driver.findElement(By.css("div.message.error"))).getText() )

                .toBe("User could not be authenticated. Incorrect username or password.") ;
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

    it("Successfull login", async () => {
        try {
            await createUser(port, "client", "client", "Administrator");

            await driver.findElement(By.id("loginUsername")).sendKeys("client");
            await driver.findElement(By.id("loginPassword")).sendKeys("client");
            await driver.findElement(By.id("loginButton")).click();

            const result = await driver.wait(async () => {
                return (await driver.findElements(By.id("mainActivityBarItemstepDown"))).length > 0;
            }, 5000, "Login was unsuccessful");

            expect(result).toBe(true);
        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

});
