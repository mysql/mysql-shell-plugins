/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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
import { driver, loadDriver, loadPage } from "../../lib/engine";
import { By } from "selenium-webdriver";
import {
    waitForHomePage,
    openShellSession,
    shellGetSession,
    closeSession,
} from "../../lib/helpers";

describe("GUI Console", () => {

    let testFailed: boolean;

    beforeAll(async () => {
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }
        await driver.findElement(By.id("gui.shell")).click();
    });

    afterEach(async () => {
        if (testFailed) {
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
        await driver.quit();
    });

    it("Open multiple sessions", async () => {
        try {

            await openShellSession();
            await driver.findElement(By.id("sessions")).click();

            let session = await shellGetSession("1");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 1");
            await openShellSession();
            await driver.findElement(By.id("sessions")).click();

            session = await shellGetSession("2");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 2");

            await openShellSession();
            await driver.findElement(By.id("sessions")).click();
            session = await shellGetSession("3");
            expect(await session!.findElement(By.css(".tileCaption")).getText()).toBe("Session 3");

            await closeSession("1");
            expect(await shellGetSession("1")).toBeUndefined();
            await closeSession("2");
            expect(await shellGetSession("2")).toBeUndefined();
            await closeSession("3");
            expect(await shellGetSession("3")).toBeUndefined();

        } catch(e) {
            testFailed = true;
            throw e;
        }
    });

});
