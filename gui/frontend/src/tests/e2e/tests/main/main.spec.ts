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

import { until } from "selenium-webdriver";
import { basename } from "path";
import { Misc } from "../../lib/misc.js";
import { ThemeEditor } from "../../lib/themeEditor.js";
import * as locator from "../../lib/locators.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Main pages", () => {
    let testFailed = false;

    beforeAll(async () => {
        await loadDriver();
        await driver.get(url);

        await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded")
            .catch(async (e) => {
                await Misc.storeScreenShot("beforeAll_Main");
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

    it("Verify GUI Console page", async () => {
        try {
            await driver.findElement(locator.shellPage.icon).click();
            expect(await driver.findElement(locator.shellPage.title).getText())
                .toBe("MySQL Shell - GUI Console");
            expect((await driver.findElements(locator.shellPage.links.learnMore)).length).toBe(1);
            expect((await driver.findElements(locator.shellPage.links.docs)).length).toBe(1);
            expect(await driver.findElement(locator.shellPage.contentTitle).getText())
                .toBe("MySQL Shell Sessions");
            expect((await driver.findElements(locator.shellPage.icon)).length).toBe(1);
            expect((await driver.findElements(locator.sqlEditorPage.icon)).length).toBe(1);
            expect((await driver.findElements(locator.debuggerPage.icon)).length).toBe(1);
            expect((await driver.findElements(locator.settingsPage.icon)).length).toBe(1);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Connections page", async () => {
        try {
            await driver.findElement(locator.sqlEditorPage.icon).click();
            expect(
                await driver.wait(until.elementLocated(locator.sqlEditorPage.tabName),
                    constants.wait5seconds, "Connection Overview was not found").getText(),
            ).toBe("Connection Overview");
            expect(
                await driver.findElement(locator.sqlEditorPage.title).getText(),
            ).toBe("MySQL Shell - DB Connections");
            expect(
                await driver
                    .findElement(locator.sqlEditorPage.contentTitle)
                    .getText(),
            ).toBe("Database Connections");
            const addButton = await driver.findElement(locator.dbConnectionOverview.newDBConnection);
            expect(await addButton.findElement(locator.dbConnectionOverview.dbConnection.caption,
            ).getAttribute("innerHTML")).toContain("New Connection");
            expect(await addButton.findElement(locator.dbConnectionOverview.dbConnection.description,
            ).getAttribute("innerHTML")).toContain("Add a new database connection");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Debugger page", async () => {
        try {
            await driver.findElement(locator.debuggerPage.icon).click();
            expect(
                await driver.findElement(locator.debuggerPage.scripts).getText(),
            ).toBe("SCRIPTS");
            const outputPanel = await driver.findElements(locator.debuggerPage.outputHost);
            expect(outputPanel.length).toBe(1);
            const upperLabels = await outputPanel[0].findElements(
                locator.debuggerPage.toolbar.item,
            );
            expect(upperLabels.length).toBe(3);
            expect(await upperLabels[0].getText()).toBe("Message");
            expect(await upperLabels[1].getText()).toBe("Tools:");
            expect(await upperLabels[2].getText()).toBe("Clear Output");
            const downLabels = await outputPanel[0].findElements(
                locator.debuggerPage.inputConsoleItem,
            );
            expect(downLabels.length).toBe(6);
            expect(await downLabels[0].getText()).toBe("INPUT CONSOLE");
            expect(await downLabels[1].getText()).toBe("Execute Script");
            expect(await downLabels[2].getText()).toBe("Clear Script");
            expect(await downLabels[3].getText()).toBe("Connect");
            expect(await downLabels[4].getText()).toBe("Disconnect");
            expect(await downLabels[5].getText()).toBe("Clear Context");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Settings page", async () => {
        try {
            await driver.findElement(locator.settingsPage.icon).click();
            const settings = await driver.findElement(locator.settingsPage.exists);
            const settingsTreeRows = await settings.findElements(
                locator.settingsPage.menuItem,
            );
            expect(await settingsTreeRows[0].getText()).toBe("Theme Settings");
            expect(await settingsTreeRows[1].getText()).toBe("Code Editor");
            expect(await settingsTreeRows[2].getText()).toBe("DB Editor");
            expect(await settingsTreeRows[3].getText()).toBe("SQL Execution");
            expect(await settingsTreeRows[4].getText()).toBe("Shell Session");
            const settingsValueList = driver.findElement(locator.settingsPage.settingsList.exists);

            //click theme settings
            await settingsTreeRows[0].click();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.currentTheme),
            ).toBeDefined();

            //click code editor
            await settingsTreeRows[1].click();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.wordWrap),
            ).toBeDefined();
            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.wordWrapColumn.exists),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.invisibleCharacters),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.mysqlDBVersion),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.sqlMode),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.stopOnErrors),
            ).toBeDefined();

            //click DB Editor
            await settingsTreeRows[2].click();

            expect(
                await settingsValueList.findElement(
                    locator.settingsPage.settingsList.dbEditorShowGreeting,
                ),
            ).toBeDefined();

            //click sql execution
            await settingsTreeRows[3].click();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.limitRowCount),
            ).toBeDefined();

            //click session browser
            await settingsTreeRows[4].click();

            expect(
                await settingsValueList.findElement(locator.settingsPage.settingsList.shellShowGreeting),
            ).toBeDefined();

            //change background color
            await settingsTreeRows[0].click();
            await ThemeEditor.selectAppColorTheme("Dark Modern");
            let color = String((await Misc.getBackgroundColor(driver))).trim();
            expect(color).toBe("#1f1f1f");
            await settingsTreeRows[0].click();
            await ThemeEditor.selectAppColorTheme("Light Modern");
            color = String((await Misc.getBackgroundColor(driver))).trim();
            expect(color).toBe("#ffffff");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify About page", async () => {
        try {

            if ((await driver.findElements(locator.aboutPage.tab)).length === 0) {
                await driver.findElement(locator.settingsPage.icon).click();
            }

            await driver.findElement(locator.aboutPage.tab).click();
            expect(await driver.findElement(locator.aboutPage.title).getAttribute("outerHTML"))
                .toContain("About MySQL Shell");
            expect((await driver.findElements(locator.aboutPage.sakilaLogo)).length).toBe(1);
            const aboutLinks = await driver.findElements(locator.aboutPage.links);
            expect(await aboutLinks[0].getAttribute("outerHTML")).toContain("Learn More");
            expect(await aboutLinks[1].getAttribute("outerHTML")).toContain("Documentation");
            const heading = await driver.wait(until.elementLocated(locator.aboutPage.otherTitle),
                constants.wait5seconds, "Shell Build Information was not found");
            expect(await heading.getText()).toBe("Shell Build Information");
            const leftElements = await driver.findElements(locator.aboutPage.leftTableCells);
            expect(await leftElements[0].getText()).toBe("Version:");
            expect(await leftElements[1].getText()).toBe("Architecture:");
            expect(await leftElements[2].getText()).toBe("Platform:");
            expect(await leftElements[3].getText()).toBe("Server Distribution:");
            expect(await leftElements[4].getText()).toBe("Server Version:");
            const rightElements = await driver.findElements(locator.aboutPage.rightTableCells);
            expect(await rightElements[0].getText()).toMatch(
                new RegExp(/(\d+).(\d+).(\d+)/g),
            );
            expect((await rightElements[1].getText()) !== "").toBe(true);
            expect((await rightElements[2].getText()) !== "").toBe(true);
            expect(await rightElements[3].getText()).toMatch(
                new RegExp(/MySQL (.*) Server/),
            );
            expect(await rightElements[4].getText()).toMatch(
                new RegExp(/(\d+).(\d+).(\d+)/g),
            );
            expect(
                await (
                    await driver.findElements(locator.aboutPage.otherTitle)
                )[1].getText(),
            ).toBe("Frontend Information");
            expect(await leftElements[5].getText()).toBe("Version:");
            expect(await rightElements[5].getText()).toMatch(
                new RegExp(/(\d+).(\d+).(\d+)/g),
            );
            expect((await driver.findElements(locator.aboutPage.copyright)).length).toBe(1);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
