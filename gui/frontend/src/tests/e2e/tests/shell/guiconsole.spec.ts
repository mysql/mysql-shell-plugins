/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
import { basename } from "path";
import { Misc } from "../../lib/misc.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { E2EGuiConsole } from "../../lib/E2EGuiConsole.js";
import * as locator from "../../lib/locators.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("GUI Console", () => {

    let testFailed: boolean;

    beforeAll(async () => {
        try {
            await loadDriver();
            await driver.get(url);
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.findElement(locator.shellPage.icon).click();
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_GuiConsole");
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

    it("Open multiple sessions", async () => {
        try {
            const guiConsole = new E2EGuiConsole();

            await guiConsole.openSession();
            await (await guiConsole.sessions[0].getGuiConsoleTab()).click();
            await driver.wait(guiConsole.untilSessionExists("1"), constants.wait3seconds);

            await guiConsole.openSession();
            await (await guiConsole.sessions[1].getGuiConsoleTab()).click();
            await driver.wait(guiConsole.untilSessionExists("2"), constants.wait3seconds);

            await guiConsole.openSession();
            await (await guiConsole.sessions[2].getGuiConsoleTab()).click();
            await driver.wait(guiConsole.untilSessionExists("3"), constants.wait3seconds);

            await guiConsole.sessions[0].close();
            await driver.wait(guiConsole.untilSessionDoesNotExist("1"), constants.wait3seconds);

            await guiConsole.sessions[1].close();
            await driver.wait(guiConsole.untilSessionDoesNotExist("2"), constants.wait3seconds);

            await guiConsole.sessions[2].close();
            await driver.wait(guiConsole.untilSessionDoesNotExist("3"), constants.wait3seconds);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
