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

import { Misc, driver, explicitWait } from "../../lib/misc";
import { By, until } from "selenium-webdriver";
import { ThemeEditor } from "../../lib/themeEditor";

describe("Main pages", () => {
    let testFailed = false;

    beforeAll(async () => {
        await Misc.loadDriver();
        try {
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await Misc.waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await Misc.waitForHomePage();
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Verify GUI Console page", async () => {
        try {
            await driver.findElement(By.id("gui.shell")).click();

            expect(await driver.findElement(By.css("#shellModuleHost #title")).getText())
                .toBe("MySQL Shell - GUI Console");

            expect(
                (await driver.findElements(By.linkText("Learn More >"))).length,
            ).toBe(1);

            expect(
                (await driver.findElements(By.linkText("Browse Tutorial >"))).length,
            ).toBe(1);

            expect((await driver.findElements(By.linkText("Read Docs >"))).length).toBe(
                1,
            );

            expect(await driver.findElement(By.css("#shellModuleHost #contentTitle")).getText()).toBe(
                "MySQL Shell Sessions",
            );

            expect((await driver.findElements(By.id("gui.shell"))).length).toBe(1);

            expect((await driver.findElements(By.id("gui.sqleditor"))).length).toBe(1);

            expect((await driver.findElements(By.id("debugger"))).length).toBe(1);

            expect((await driver.findElements(By.id("settings"))).length).toBe(1);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Connections page", async () => {
        try {
            await driver.findElement(By.id("gui.sqleditor")).click();

            expect(
                await driver.wait(until.elementLocated(By.css("#connections > .label")),
                    explicitWait, "Connection Overview was not found").getText(),
            ).toBe("Connection Overview");

            expect(
                await driver.findElement(By.css(".connectionBrowser #title")).getText(),
            ).toBe("MySQL Shell - DB Connections");

            expect(
                await driver
                    .findElement(By.css(".connectionBrowser #contentTitle"))
                    .getText(),
            ).toBe("Database Connections");

            const addButton = await driver.findElement(By.css(".connectionBrowser"),
            ).findElement(By.id("-1"));

            expect(await addButton.findElement(By.css(".tileCaption"),
            ).getAttribute("innerHTML")).toContain("New Connection");

            expect(await addButton.findElement(By.css(".tileDescription"),
            ).getAttribute("innerHTML")).toContain("Add a new database connection");

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Debugger page", async () => {
        try {
            await driver.findElement(By.id("debugger")).click();

            expect(
                await driver.findElement(By.css("#scriptSectionHost .label")).getText(),
            ).toBe("SCRIPTS");

            const outputPanel = await driver.findElements(By.id("outputPaneHost"));

            expect(outputPanel.length).toBe(1);

            const upperLabels = await outputPanel[0].findElements(
                By.css("#messageOutputHost .label"),
            );

            expect(upperLabels.length).toBe(3);

            expect(await upperLabels[0].getText()).toBe("Message");

            expect(await upperLabels[1].getText()).toBe("Tools:");

            expect(await upperLabels[2].getText()).toBe("Clear Output");

            const downLabels = await outputPanel[0].findElements(
                By.css("#inputAreaHost .label"),
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
            await driver.findElement(By.id("settings")).click();

            const settings = await driver.findElement(By.id("settingsHost"));

            const settingsTreeRows = await settings.findElements(
                By.css(".settingsTreeCell label"),
            );

            expect(await settingsTreeRows[0].getText()).toBe("Theme Settings");

            expect(await settingsTreeRows[1].getText()).toBe("Code Editor");

            expect(await settingsTreeRows[2].getText()).toBe("DB Editor");

            expect(await settingsTreeRows[3].getText()).toBe("SQL Execution");

            expect(await settingsTreeRows[4].getText()).toBe("Shell Session");

            const settingsValueList = driver.findElement(By.id("settingsValueList"));

            //click theme settings
            await settingsTreeRows[0].click();

            expect(
                await settingsValueList.findElement(By.id("theming.currentTheme")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(
                    By.xpath("//div[contains(@caption, 'Click to Open the Theme Editor')]")),
            ).toBeDefined();

            //click code editor
            await settingsTreeRows[1].click();

            expect(
                await settingsValueList.findElement(By.id("editor.wordWrap")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(By.id("editor.wordWrapColumn")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(By.id("editor.showHidden")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(By.id("editor.dbVersion")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(By.id("editor.sqlMode")),
            ).toBeDefined();

            expect(
                await settingsValueList.findElement(By.id("editor.stopOnErrors")),
            ).toBeDefined();

            //click DB Editor
            await settingsTreeRows[2].click();

            expect(
                await settingsValueList.findElement(
                    By.id("dbEditor.connectionBrowser.showGreeting"),
                ),
            ).toBeDefined();

            //click sql execution
            await settingsTreeRows[3].click();

            expect(
                await settingsValueList.findElement(By.id("sql.limitRowCount")),
            ).toBeDefined();

            //click session browser
            await settingsTreeRows[4].click();

            expect(
                await settingsValueList.findElement(By.id("shellSession.sessionBrowser.showGreeting")),
            ).toBeDefined();

            //change background color
            await settingsTreeRows[0].click();

            await ThemeEditor.selectAppColorTheme("Default Dark");

            let color = String((await Misc.getBackgroundColor())).trim();

            expect(color).toBe("#2C2C2C");

            await settingsTreeRows[0].click();

            await ThemeEditor.selectAppColorTheme("Default Light");

            color = String((await Misc.getBackgroundColor())).trim();

            expect(color).toBe("#FFFFFF");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify About page", async () => {
        try {

            if ((await driver.findElements(By.id("about"))).length === 0) {
                await driver.findElement(By.id("settings")).click();
            }

            await driver.findElement(By.id("about")).click();

            expect(await driver.findElement(By.id("headingLabel")).getAttribute("outerHTML"))
                .toContain("About MySQL Shell");

            expect((await driver.findElements(By.id("sakilaLogo"))).length).toBe(1);

            const aboutLinks = await driver.findElements(By.css("#aboutBoxLinks a"));

            expect(await aboutLinks[0].getAttribute("outerHTML")).toContain("Learn More");

            expect(await aboutLinks[1].getAttribute("outerHTML")).toContain("Browse Tutorial");

            expect(await aboutLinks[2].getAttribute("outerHTML")).toContain("Read Docs");

            const heading = await driver.wait(until.elementLocated(By.css(".gridCell.heading > label")),
                explicitWait, "Shell Build Information was not found");

            expect(await heading.getText()).toBe("Shell Build Information");

            const leftElements = await driver.findElements(By.css(".gridCell.left"));

            expect(await leftElements[0].getText()).toBe("Version:");

            expect(await leftElements[1].getText()).toBe("Architecture:");

            expect(await leftElements[2].getText()).toBe("Platform:");

            expect(await leftElements[3].getText()).toBe("Server Distribution:");

            expect(await leftElements[4].getText()).toBe("Server Version:");

            const rightElements = await driver.findElements(By.css(".gridCell.right"));

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
                    await driver.findElements(By.css(".gridCell.heading > label"))
                )[1].getText(),
            ).toBe("Frontend Information");

            expect(await leftElements[5].getText()).toBe("Version:");

            expect(await rightElements[5].getText()).toMatch(
                new RegExp(/(\d+).(\d+).(\d+)/g),
            );

            expect((await driver.findElements(By.css(".copyright"))).length).toBe(1);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Theme Editor page", async () => {
        try {
            if ((await driver.findElements(By.id("themeEditor"))).length === 0) {
                await driver.findElement(By.id("settings")).click();
            }

            await driver.findElement(By.id("themeEditor")).click();

            expect(
                await driver.findElement(By.css(".themeEditor > label")).getText(),
            ).toBe("THEME EDITOR");

            expect(
                (await driver.findElements(By.id("themeSelectorContainer"))).length,
            ).toBe(1);

            const themeEditorLabels = await driver.findElements(By.css("#themeSelectorContainer .gridCell label"));

            expect(await themeEditorLabels[0].getText()).toBe("Theme");

            expect(await themeEditorLabels[2].getText()).toBe("Color Pad");

            expect((await driver.findElements(By.id("colorPadCell"))).length).toBe(1);

            expect((await driver.findElements(By.id("syntaxColors"))).length).toBe(1);

            expect((await driver.findElements(By.id("uiColors"))).length).toBe(1);

            expect(await driver.findElement(By.id("previewTitle")).getText()).toBe(
                "THEME PREVIEW",
            );

            const themePreviewLabels = await driver.findElements(
                By.css("#previewRoot p"),
            );

            expect(await themePreviewLabels[0].getText()).toBe("Base Colors");

            expect(await themePreviewLabels[1].getText()).toBe("Window / Dialog");

            expect(await themePreviewLabels[2].getText()).toBe("Plain Text / Label");

            expect(await themePreviewLabels[3].getText()).toBe("Button");

            expect(await themePreviewLabels[4].getText()).toBe("Dropdown");

            expect(await themePreviewLabels[5].getText()).toBe("Input");

            expect(await themePreviewLabels[6].getText()).toBe("Tag List");

            expect(await themePreviewLabels[7].getText()).toBe("Progress Indicator");

            expect(await themePreviewLabels[8].getText()).toBe("Grid / Table");

            expect(await themePreviewLabels[9].getText()).toBe(
                "Activity Bar + Side Bar",
            );

            expect(await themePreviewLabels[10].getText()).toBe("Tabview");

            expect(await themePreviewLabels[11].getText()).toBe("Code Editor");

            expect(await themePreviewLabels[12].getText()).toBe(
                "Mixed Language Code Editor with Embedded Results",
            );

            expect(await themePreviewLabels[13].getText()).toBe("Browser Tiles");

            expect(await themePreviewLabels[14].getText()).toBe("Title Bar");

            expect(await themePreviewLabels[15].getText()).toBe("Menu + Menubar");

            expect(await themePreviewLabels[16].getText()).toBe("Terminal Colors");

            expect(await themePreviewLabels[17].getText()).toBe("ANSI Escapes Output Rendering");

            expect(await themePreviewLabels[18].getText()).toBe("Breadcrumb");

            expect(await themePreviewLabels[19].getText()).toBe("Symbols");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid token", async () => {
        try {
            await Misc.loadPage(`${String(process.env.SHELL_UI_HOSTNAME)}xpto`);
            const errorPanel = await driver.wait(until.elementLocated(By.css(".visible.errorPanel")),
                explicitWait, "Error label was not found");

            expect(await (await errorPanel.findElement(
                By.css(".title label"))).getText()).toBe("Communication Error");

            expect(await (await errorPanel.findElement(
                By.css(".content label"))).getText())
                .toMatch(/Could not establish a connection to the backend. Trying to reconnect in (\d+) seconds/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("No token", async () => {
        try {
            const groups = String(process.env.SHELL_UI_HOSTNAME).match(/token=(.*)/);
            await Misc.loadPage(String(process.env.SHELL_UI_HOSTNAME).replace(groups![1], ""));
            const errorPanel = await driver.wait(until.elementLocated(By.css(".visible.errorPanel")),
                explicitWait, "Error label was not found");

            expect(await (await errorPanel.findElement(
                By.css(".title label"))).getText()).toBe("Communication Error");

            expect(await (await errorPanel.findElement(
                By.css(".content label"))).getText())
                .toMatch(/Could not establish a connection to the backend. Trying to reconnect in (\d+) seconds/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
