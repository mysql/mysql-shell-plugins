/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until } from "selenium-webdriver";
import { basename } from "path";
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { E2EToastNotification } from "../../lib/E2EToastNotification.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Token", () => {
    let testFailed = false;

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Main");
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
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Invalid token", async () => {
        try {
            const invalidToken = `${String(url)}xpto`;
            await driver.get(invalidToken);

            expect(driver.wait(until.elementsLocated(locator.pageIsLoading), constants.wait5seconds,
                "Blank page was not displayed")).toBeDefined();

            const notification = await new E2EToastNotification().create();
            expect(notification.type).toBe("error");

            let regex = "Could not establish a connection to the backend.";
            regex += " Make sure you use valid user credentials and the MySQL Shell is running.";
            regex += " Trying to reconnect in (\\d+) seconds.";

            expect(notification.message).toMatch(new RegExp(regex));
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("No token", async () => {
        try {
            const noToken = String(url).replace(String(process.env.TOKEN), "");
            await driver.get(noToken);

            expect(driver.wait(until.elementsLocated(locator.adminPage.headingText), constants.wait5seconds,
                "Login page was not displayed")).toBeDefined();

            const notification = await new E2EToastNotification().create();
            expect(notification.type).toBe("error");

            let regex = "Could not establish a connection to the backend.";
            regex += " Make sure you use valid user credentials and the MySQL Shell is running.";
            regex += " Trying to reconnect in (\\d+) seconds.";

            expect(notification.message).toMatch(new RegExp(regex));
            await notification.close();
            await driver.wait(notification.untilIsClosed(), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
