/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { getDriver, load } from "../lib/engine";
import { By } from "selenium-webdriver";
import {
    waitForHomePage,
    selectAppColorTheme,
    getBackgroundColor,
} from "../lib/helpers";
import { checkEnv, startServer } from "../lib/teardowns";

describe("Main pages", function () {
    let driver;
    beforeAll(async function () {
        try {
            __CHILD__ = await startServer();
            driver = getDriver();
            await checkEnv();
        } catch (e) {
            if(__CHILD__) { __CHILD__.kill(); }
            console.error(e);
            await driver.quit();
            await new Promise((resolve) => {return setTimeout(resolve, 500);});
            process.exit(1);
        }
    });

    beforeEach(async function () {
        await load(driver);
        await waitForHomePage(driver);
    });

    afterAll(async function () {
        __CHILD__.kill();
        await driver.quit();
    });

    it("Verify GUI Console page", async function () {
        expect(await driver.findElement(By.id("title")).getText())
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

        expect(await driver.findElement(By.id("contentTitle")).getText()).toBe(
            "MySQL Shell Sessions",
        );

        expect((await driver.findElements(By.id("gui.shell"))).length).toBe(1);

        expect((await driver.findElements(By.id("gui.sqleditor"))).length).toBe(1);

        expect((await driver.findElements(By.id("debugger"))).length).toBe(1);

        expect((await driver.findElements(By.id("settings"))).length).toBe(1);
    });

    it("Verify Connections page", async function () {
        await driver.findElement(By.id("gui.sqleditor")).click();

        expect(
            await driver.findElement(By.css("#connections > .label")).getText(),
        ).toBe("Connections");

        expect(
            await driver.findElement(By.css(".connectionBrowser #title")).getText(),
        ).toBe("MySQL Shell - SQL Editor");

        expect(
            await driver
                .findElement(By.css(".connectionBrowser #contentTitle"))
                .getText(),
        ).toBe("Database Connections");

        expect(
            await driver
                .findElement(
                    By.css(".connectionBrowser #tilesHost button .tileCaption"),
                )
                .getText(),
        ).toBe("New Connection");

        expect(
            await driver
                .findElement(
                    By.css(".connectionBrowser #tilesHost button .tileDescription"),
                )
                .getText(),
        ).toBe("Add a new database connection");
    });

    it("Verify Debugger page", async function () {
        await driver.findElement(By.id("debugger")).click();

        expect(
            await driver.findElement(By.css("#scriptSectionHost .label")).getText(),
        ).toBe("SCRIPTS", "[TS:" + Error().lineNumber + "]");

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

        await driver.findElement(By.id("debugger")).click();

        expect((await driver.findElements(By.id("sessions"))).length).toBe(1);
    });

    it("Verify Settings page", async function () {
        await driver.findElement(By.id("settings")).click();

        const settings = await driver.findElement(By.id("settingsHost"));

        const settingsTreeRows = await settings.findElements(
            By.css(".settingsTreeCell label"),
        );

        expect(await settingsTreeRows[0].getText()).toBe("Settings");

        expect(await settingsTreeRows[1].getText()).toBe("Theme Settings");

        expect(await settingsTreeRows[2].getText()).toBe("Code Editor");

        expect(await settingsTreeRows[3].getText()).toBe("Connection Browser");

        expect(await settingsTreeRows[4].getText()).toBe("SQL Execution");

        expect(await settingsTreeRows[5].getText()).toBe("Shell Session Browser");

        const settingsValueList = driver.findElement(By.id("settingsValueList"));

        //click settings
        await settingsTreeRows[0].click();

        expect(
            await settingsValueList.findElement(By.id("settings.autoSaveInterval")),
        ).toBeDefined();

        //click theme settings
        await settingsTreeRows[1].click();

        expect(
            await settingsValueList.findElement(By.id("theming.currentTheme")),
        ).toBeDefined();

        //click code editor
        await settingsTreeRows[2].click();

        expect(
            await settingsValueList.findElement(By.id("dbEditor.startLanguage")),
        ).toBeDefined();

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

        //click connection browser
        await settingsTreeRows[3].click();

        expect(
            await settingsValueList.findElement(
                By.id("connectionBrowser.showGreeting"),
            ),
        ).toBeDefined();

        //click sql execution
        await settingsTreeRows[4].click();

        expect(
            await settingsValueList.findElement(By.id("sql.limitRowCount")),
        ).toBeDefined();

        //click session browser
        await settingsTreeRows[5].click();

        expect(
            await settingsValueList.findElement(By.id("sessionBrowser.showGreeting")),
        ).toBeDefined();

        //change background color
        await settingsTreeRows[1].click();

        await selectAppColorTheme(driver, "Default Dark");

        expect(
            (
                await getBackgroundColor(driver, driver.findElement(By.css("html")))
            ).trim(),
        ).toBe("#2C2C30");

        await settingsTreeRows[1].click();

        await selectAppColorTheme(driver, "Default Light");

        expect(
            (
                await getBackgroundColor(driver, driver.findElement(By.css("html")))
            ).trim(),
        ).toBe("#FFFFFF");
    });

    it("Verify About page", async function () {
        await driver.findElement(By.id("settings")).click();

        await driver.findElement(By.id("about")).click();

        expect(await driver.findElement(By.id("headingLabel")).getText())
            .toBe("About MySQL Shell");

        expect((await driver.findElements(By.id("sakilaLogo"))).length).toBe(1);

        const aboutLinks = await driver.findElements(By.css("#aboutBoxLinks a"));

        expect(await aboutLinks[0].getText()).toBe("Learn More >");

        expect(await aboutLinks[1].getText()).toBe("Browse Tutorial >");

        expect(await aboutLinks[2].getText()).toBe("Read Docs >");

        expect(
            await (
                await driver.findElements(By.css(".gridCell.heading > label"))
            )[0].getText(),
        ).toBe("Shell Build Information");

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

        expect(await rightElements[3].getText()).toContain(
            "MySQL Enterprise Server",
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

        await driver.executeScript(
            "arguments[0].click();",
            await driver.findElement(By.id("closeButton")),
        );

        expect((await driver.findElements(By.id("sessions"))).length).toBe(1);
    });

    it("Verify Theme Editor page", async function () {
        await driver.findElement(By.id("settings")).click();

        await driver.findElement(By.id("themeEditor")).click();

        expect(
            await driver.findElement(By.css(".themeEditor > label")).getText(),
        ).toBe("THEME EDITOR");

        expect(
            (await driver.findElements(By.id("themeSelectorContainer"))).length,
        ).toBe(1);

        const themeEditorLabels = await driver.findElements(
            By.css(".themeEditor .gridCell h2"),
        );

        expect(await themeEditorLabels[0].getText()).toBe("Theme");

        expect(await themeEditorLabels[1].getText()).toBe("Color Pad");

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

        expect(await themePreviewLabels[7].getText()).toBe("Grid / Table");

        expect(await themePreviewLabels[8].getText()).toBe(
            "Activity Bar + Side Bar",
        );

        expect(await themePreviewLabels[9].getText()).toBe("Tabview");

        expect(await themePreviewLabels[10].getText()).toBe("Code Editor");

        expect(await themePreviewLabels[11].getText()).toBe(
            "Mixed Language Code Editor with Embedded Results",
        );

        expect(await themePreviewLabels[12].getText()).toBe("Browser Tiles");

        expect(await themePreviewLabels[13].getText()).toBe("Title Bar");

        expect(await themePreviewLabels[14].getText()).toBe("Menu + Menubar");

        expect(await themePreviewLabels[15].getText()).toBe("Terminal");

        expect(await themePreviewLabels[16].getText()).toBe("Breadcrumb");

        expect(await themePreviewLabels[17].getText()).toBe("Symbols");

        await driver.executeScript(
            "arguments[0].click();",
            await driver.findElement(By.id("closeButton")),
        );

        expect((await driver.findElements(By.id("sessions"))).length).toBe(1);
    });

    describe("Theme Editor", function () {
        beforeEach(async function () {
            await load();
            await waitForHomePage(driver);
        });

        afterAll(async function () {
            await driver.quit();
        });

        xit("UI Colors - Base Colors", async function () { });

        xit("UI Colors - Window/Dialog Colors", async function () { });

        xit("UI Colors - Popup Colors", async function () { });

        xit("UI Colors - Text Colors (except code editors)", async function () { });

        xit("UI Colors - Button Colors", async function () { });
    });
});
