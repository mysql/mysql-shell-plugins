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
import { By, Key, until, WebDriver, WebElement } from "selenium-webdriver";
import {
    waitForHomePage,
    selectAppColorTheme,
    getBackgroundColor,
    setThemeEditorColors,
    getElementStyle,
    toggleUiColorsMenu,
    rgbToHex,
    getColorPadCss,
} from "../lib/helpers";
import { platform } from "os";

const dragAndDrop = `
function createEvent(typeOfEvent) {
    var event =document.createEvent("CustomEvent");
    event.initCustomEvent(typeOfEvent,true, true, null);
    event.dataTransfer = {
        data: {},
        setData (key, value) {
            this.data[key] = value;
        },
        getData (key) {
            return this.data[key];
        }};

    return event;
}

function dispatchEvent(element, event,transferData) {
    if (transferData !== undefined) {
        event.dataTransfer = transferData;
    }
    if (element.dispatchEvent) {
        element.dispatchEvent(event);
    } else if (element.fireEvent) {
        element.fireEvent("on" + event.type, event);
    }
}

function simulateHTML5DragAndDrop(element, destination) {
    var dragStartEvent =createEvent("dragstart");
    dispatchEvent(element, dragStartEvent);
    var dropEvent = createEvent("drop");
    dispatchEvent(destination, dropEvent,dragStartEvent.dataTransfer);
    var dragEndEvent = createEvent("dragend");
    dispatchEvent(element, dragEndEvent,dropEvent.dataTransfer);
}

var source = arguments[0];
var destination = arguments[1];
simulateHTML5DragAndDrop(source,destination);
`;

describe("Main pages", () => {
    let driver: WebDriver;
    let testFailed = false;

    beforeAll(async () => {
        driver = await getDriver();
        try {
            await load(driver, String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage(driver);
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage(driver);
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");

            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Verify GUI Console page", async () => {
        try {
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
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify Connections page", async () => {
        try {
            await driver.findElement(By.id("gui.sqleditor")).click();

            expect(
                await driver.findElement(By.css("#connections > .label")).getText(),
            ).toBe("Connection Overview");

            expect(
                await driver.findElement(By.css(".connectionBrowser #title")).getText(),
            ).toBe("MySQL Shell - DB Editor");

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
                    By.xpath("//button[contains(@caption, 'Click to Open the Theme Editor')]")),
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

            await selectAppColorTheme(driver, "Default Dark");

            let color = String((await getBackgroundColor(driver))).trim();

            expect(color).toBe("#2C2C2C");

            await settingsTreeRows[0].click();

            await selectAppColorTheme(driver, "Default Light");

            color = String((await getBackgroundColor(driver))).trim();

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

            expect(await themePreviewLabels[16].getText()).toBe("Terminal");

            expect(await themePreviewLabels[17].getText()).toBe("Breadcrumb");

            expect(await themePreviewLabels[18].getText()).toBe("Symbols");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Invalid token", async () => {
        try {
            await load(driver, `${String(process.env.SHELL_UI_HOSTNAME)}xpto`);
            const errorPanel = await driver.findElement(By.css(".visible.errorPanel"));

            expect(await (await errorPanel.findElement(
                By.css(".title label"))).getText()).toBe("Communication Error");

            expect(await (await errorPanel.findElement(
                By.css(".content label"))).getText()).toBe("Could not establish a connection to the backend.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("No token", async () => {
        try {
            const groups = String(process.env.SHELL_UI_HOSTNAME).match(/token=(.*)/);
            await load(driver, String(process.env.SHELL_UI_HOSTNAME).replace(groups![1], ""));
            const errorPanel = await driver.findElement(By.css(".visible.errorPanel"));

            expect(await (await errorPanel.findElement(
                By.css(".title label"))).getText()).toBe("Communication Error");

            expect(await (await errorPanel.findElement(
                By.css(".content label"))).getText()).toBe("Could not establish a connection to the backend.");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("Theme Editor", () => {
    let driver: WebDriver;
    let testFailed = false;
    let themeLabel = "";

    beforeAll(async () => {
        driver = await getDriver();
        try {
            await load(driver, String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage(driver);
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage(driver);
        }
        await driver.findElement(By.id("settings")).click();
        await driver.findElement(By.id("themeEditor")).click();
        await driver.findElement(By.css(".themeSelector")).click();
        await driver.findElement(By.id("Default Dark")).click();
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");

            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }
    });

    afterAll(async () => {
        await driver.quit();
    });

    it("Drag and drop - Color Pad to Base colors", async () => {
        try {

            let colors = await driver.findElements(By.css("#colorPadCell > div"));

            const uiColors = await driver.findElement(By.id("uiColors"));
            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            const colorPad0 = await getColorPadCss(driver, 0);

            await toggleUiColorsMenu(driver, "Base Colors", "open");

            let focusBorder = await driver.findElement(By.css("#--focusBorder > div"));

            try {
                await driver.executeScript(dragAndDrop, colors[0], focusBorder);
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await toggleUiColorsMenu(driver, "Base Colors", "open");
                    focusBorder = await driver.findElement(By.css("#--focusBorder > div"));
                    colors = await driver.findElements(By.css("#colorPadCell > div"));
                    await driver.executeScript(dragAndDrop, colors[0], focusBorder);
                } else {
                    throw e;
                }
            }

            await focusBorder.click();
            let colorPopup = await driver.findElement(By.css(".colorPopup"));
            const focusBorderColor = await colorPopup.findElement(By.id("hexValueInput")).getAttribute("value");
            await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

            expect(focusBorderColor).toBe(colorPad0);

            let element = await driver.findElement(By.css(".manualFocus"));
            let elStyle = String(await getElementStyle(driver, element, "outlineColor"));
            let arr = elStyle.match(/(\d+)/gm);
            let hex = rgbToHex(arr![0], arr![1], arr![2]);

            expect(colorPad0).toContain(hex);

            const colorPad1 = await getColorPadCss(driver, 1);

            await toggleUiColorsMenu(driver, "Base Colors", "open");

            let foreground = await driver.findElement(By.css("#--foreground > div"));
            colors = await driver.findElements(By.css("#colorPadCell > div"));
            await driver.executeScript(dragAndDrop, colors[1], foreground);
            await driver.wait(until.stalenessOf(foreground), 3000, "foreground did not became stale");

            await toggleUiColorsMenu(driver, "Base Colors", "open");
            foreground = await driver.findElement(By.css("#--foreground > div"));

            await foreground.click();
            colorPopup = await driver.findElement(By.css(".colorPopup"));
            const foregroundColor = await colorPopup.findElement(By.id("hexValueInput")).getAttribute("value");
            await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

            expect(colorPad1).toBe(foregroundColor);

            element = await driver.findElement(By.xpath("//h2[contains(text(), 'Theme')]"));
            elStyle = String(await getElementStyle(driver, element, "color"));
            arr = elStyle.match(/(\d+)/gm);
            hex = rgbToHex(arr![0], arr![1], arr![2]);

            expect(colorPad1).toContain(hex);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Drag and drop - Base colors to Color Pad", async () => {
        try {
            let colors = await driver.findElements(By.css("#colorPadCell > div"));

            const uiColors = await driver.findElement(By.id("uiColors"));
            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Base Colors", "open");

            let focusBorder = await driver.findElement(By.css("#--focusBorder > div"));
            await focusBorder.click();
            let colorPopup = await driver.findElement(By.css(".colorPopup"));
            const refColor = await colorPopup.findElement(By.id("hexValueInput")).getAttribute("value");
            await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

            try {
                await driver.executeScript(dragAndDrop, focusBorder, colors[0]);
            } catch (e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    await toggleUiColorsMenu(driver, "Base Colors", "open");
                    focusBorder = await driver.findElement(By.css("#--focusBorder > div"));
                    colors = await driver.findElements(By.css("#colorPadCell > div"));
                    await driver.executeScript(dragAndDrop, focusBorder, colors[0]);
                } else {
                    throw e;
                }
            }

            let colorPad0 = "";
            try {
                colorPad0 = await getColorPadCss(driver, 0);
            } catch(e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    colorPad0 = await getColorPadCss(driver, 0);
                } else {
                    throw e;
                }
            }

            expect(colorPad0).toBe(refColor);

            await driver.wait(async() => {
                try {
                    await toggleUiColorsMenu(driver, "Base Colors", "open");
                    const foreground = await driver.findElement(By.css("#--foreground > div"));
                    await foreground.click();

                    return (await driver.findElements(By.css(".colorPopup"))).length > 0;
                } catch (e) {
                    return false;
                }

            }, 3000, "Color pad was not opened");

            colorPopup = await driver.findElement(By.css(".colorPopup"));
            const foregroundColor = await (await colorPopup.findElement(By.id("hexValueInput")))
                .getAttribute("value");

            await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

            await toggleUiColorsMenu(driver, "Base Colors", "open");
            const foreground = await driver.findElement(By.css("#--foreground > div"));

            await driver.executeScript(dragAndDrop, foreground, colors[1]);

            let colorPad1 = "";
            try {
                colorPad1 = await getColorPadCss(driver, 1);
            } catch(e) {
                if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                    colorPad1 = await getColorPadCss(driver, 1);
                } else {
                    throw e;
                }
            }

            expect(colorPad1).toBe(foregroundColor);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Base Colors", async () => {
        try {
            const menuName = "Base Colors";
            const uiColors = await driver.findElement(By.id("uiColors"));
            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, menuName, "open");

            let element = await driver.findElement(By.css(".manualFocus"));
            let elStyle = await getElementStyle(driver, element, "outlineColor");

            await setThemeEditorColors(driver, menuName, "--focusBorder", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "outlineColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.css("body"));
            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, menuName, "--foreground", "luminanceInput", "84");

            element = await driver.findElement(By.css("#previewRoot label.description"));
            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, menuName, "--descriptionForeground", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
            await toggleUiColorsMenu(driver, menuName, "close");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Window Dialog Colors", async () => {
        try {
            //WINDOW/DIALOG COLORS
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Window/Dialog Colors", "open");

            let element = await driver.findElement(By.css("#dialogHost .msg.dialog"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Window/Dialog Colors",
                "--window-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.css("#dialogHost .header"));
            elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Window/Dialog Colors",
                "--window-headerBackground", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            await toggleUiColorsMenu(driver, "Window/Dialog Colors", "close");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Popup Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Popup Colors", "open");
            await driver.findElement(By.id("--popup-border")).click();
            let element = await driver.findElement(By.css(".colorPopup"));
            let elStyle = await getElementStyle(driver, element, "borderColor");
            await element.findElement(By.id("luminanceInput")).sendKeys(Key.ESCAPE);

            await setThemeEditorColors(driver, "Popup Colors", "--popup-border", "luminanceInput", "84");

            await toggleUiColorsMenu(driver, "Popup Colors", "open");
            await driver.findElement(By.id("--popup-border")).click();
            element = await driver.findElement(By.css(".colorPopup"));

            expect(await getElementStyle(driver, element, "borderColor") !== elStyle).toBe(true);

            await element.findElement(By.id("luminanceInput")).sendKeys(Key.ESCAPE);

            await toggleUiColorsMenu(driver, "Popup Colors", "open");
            await driver.findElement(By.id("--popup-border")).click();
            element = await driver.findElement(By.css(".colorPopup"));
            elStyle = await getElementStyle(driver, element, "backgroundColor");
            await element.findElement(By.id("luminanceInput")).sendKeys(Key.ESCAPE);

            await setThemeEditorColors(driver, "Popup Colors", "--popup-background", "luminanceInput", "84");

            await toggleUiColorsMenu(driver, "Popup Colors", "open");

            await driver.findElement(By.id("--popup-background")).click();
            element = await driver.findElement(By.css(".colorPopup"));

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            await element.findElement(By.id("luminanceInput")).sendKeys(Key.ESCAPE);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Button Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Button Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Button')]")));

            let element = await driver.findElement(By.id("button1"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Button Colors", "--button-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.id("button1"));
            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Button Colors", "--button-foreground", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);

            await toggleUiColorsMenu(driver, "Button Colors", "close");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Dropdown Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Dropdown Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.css("#previewRoot .dropdown")));

            let element = await driver.findElement(By.css("#previewRoot .dropdown"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Dropdown Colors", "--dropdown-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.css("#previewRoot .dropdown"));

            await driver.actions().move({
                x: parseInt(String(
                    (await element.findElement(By.css("label")).getRect()).x), 10),
                y: parseInt(String((await element.findElement(By.css("label")).getRect()).y), 10),
            }).perform();
            await driver.sleep(1000);

            elStyle = await getElementStyle(driver, element, "backgroundColor");

            await driver.actions().move({
                x: parseInt(String((await uiColors.getRect()).x), 10),
                y: parseInt(String((await uiColors.getRect()).y), 10),
            }).perform();
            await driver.sleep(1000);

            await setThemeEditorColors(driver, "Dropdown Colors",
                "--dropdown-hoverBackground", "luminanceInput", "15");

            element = await driver.findElement(By.css("#previewRoot .dropdown"));

            await driver.actions().move({
                x: parseInt(
                    String((await element.findElement(By.css("label")).getRect()).x), 10),
                y: parseInt(String((await element.findElement(By.css("label")).getRect()).y), 10),
            }).perform();
            await driver.sleep(1000);

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            await toggleUiColorsMenu(driver, "Dropdown Colors", "close");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Input Controls Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Input Controls Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Input')]")));

            let element = await driver.findElement(By.xpath("//input[contains(@placeholder, 'Enter something')]"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Input Controls Colors",
                "--input-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.xpath("//input[contains(@placeholder, 'Enter something')]"));
            elStyle = await getElementStyle(driver, element, "borderColor");

            await setThemeEditorColors(driver, "Input Controls Colors", "--input-border", "luminanceInput", "21");

            expect(await getElementStyle(driver, element, "borderColor") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Tag Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Tag Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Tag List')]")));

            let element = (await driver.findElements(By.css("label.tag")))[0];
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Tag Colors", "--tag-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = (await driver.findElements(By.css("label.tag")))[0];
            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Tag Colors", "--tag-foreground", "luminanceInput", "21");

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Progress Bar Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Progress Bar Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Progress Indicator')]")));

            const element = (await driver.findElements(By.css(".msg.progressIndicatorHost .linear")))[0];
            const elStyle = await getElementStyle(driver, element, "background");

            await setThemeEditorColors(driver, "Progress Bar Colors",
                "--progressBar-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "background") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - List Tree Grid Table Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "List / Tree / Grid / Table Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Grid / Table')]")));

            const element = (await driver
                .findElements(By.css(".msg.treeGrid.tabulator .tabulator-row.tabulator-selected .tabulator-cell"))
            )[0];


            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "List / Tree / Grid / Table Colors",
                "--list-activeSelectionBackground", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "List / Tree / Grid / Table Colors",
                "--list-activeSelectionForeground", "luminanceInput", "84");
            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Activity Bar Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Activity Bar Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Activity Bar + Side Bar')]")));

            let element = await driver.findElement(By.id("mainActivityBar"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Activity Bar Colors",
                "--activityBar-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.css(".msg.activityBar"));
            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Activity Bar Colors",
                "--activityBar-foreground", "luminanceInput", "84");
            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Side Bar Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Side Bar Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Activity Bar + Side Bar')]")));

            const element = await driver.findElement(By.id("sidebar1"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Side Bar Colors", "--sideBar-background", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Side Bar Colors", "--sideBar-foreground", "luminanceInput", "84");
            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Tabview Group Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Tabview (Group) Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Tabview')]")));

            const element = (await driver.findElements(By.css("#appHostPaneHost .tabArea")))[0];
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Tabview (Group) Colors",
                "--editorGroupHeader-tabsBackground", "luminanceInput", "84");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, uiColors, "backgroundColor");

            await setThemeEditorColors(driver, "Tabview (Group) Colors",
                "--tab-activeBackground", "luminanceInput", "84");
            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Editor Colors, except syntax highlighting", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Editor Colors, except syntax highlighting", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Code Editor')]")));

            const element = (await driver.findElements(By.css(".monaco-editor")))[0];
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Editor Colors, except syntax highlighting",
                "--editor-background", "luminanceInput", "90");

            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "backgroundColor") !== elStyle;
            }, 5000, "backgroundColor did not changed on editor")).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Editor Colors, except syntax highlighting",
                "--editor-foreground", "luminanceInput", "84");
            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "color") !== elStyle;
            }, 5000, "color did not changed on editor")).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Scrollbar Slider Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Scrollbar (Slider) Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Code Editor')]")));

            const element = (await driver.findElements(By.css(".monaco-editor .scroll-decoration")))[0];
            const elStyle = await getElementStyle(driver, element, "boxShadow");

            await setThemeEditorColors(driver, "Scrollbar (Slider) Colors",
                "--scrollbar-shadow", "luminanceInput", "55");

            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "boxShadow") !== elStyle;
            }, 3000, "boxShadow did not changed on editor")).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Hint Info Tooltip Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Hint / Info / Tooltip Colors", "open");

            const element = await driver.findElement(By.id("button3"));

            const isTooltipDisplayed = async () => {
                return (await driver.findElements(By.css(".tooltip"))).length > 0;
            };

            await driver.actions().move({
                x: parseInt(String((await element.getRect()).x), 10),
                y: parseInt(String((await element.getRect()).y), 10),
            }).perform();

            await driver.wait(isTooltipDisplayed(), 3000, "Tooltip was not displayed");

            let elStyle = await getElementStyle(driver, await driver.findElement(By.css(".tooltip")), "color");

            await setThemeEditorColors(driver, "Hint / Info / Tooltip Colors",
                "--tooltip-foreground", "luminanceInput", "55");

            await driver.actions().move({
                x: parseInt(String((await element.getRect()).x), 10),
                y: parseInt(String((await element.getRect()).y), 10),
            }).perform();

            await driver.wait(isTooltipDisplayed(), 3000, "Tooltip was not displayed");

            expect(await getElementStyle(driver, await driver.findElement(By.css(".tooltip")),
                "color") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, await driver
                .findElement(By.css(".tooltip")), "backgroundColor");

            await setThemeEditorColors(driver, "Hint / Info / Tooltip Colors",
                "--tooltip-background", "luminanceInput", "55");

            await driver.actions().move({
                x: parseInt(String((await element.getRect()).x), 10),
                y: parseInt(String((await element.getRect()).y), 10),
            }).perform();

            await driver.wait(isTooltipDisplayed(), 3000, "Tooltip was not displayed");

            expect(await getElementStyle(driver, await driver.findElement(By.css(".tooltip")),
                "backgroundColor") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Status Bar Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Status Bar Colors", "open");

            const element = await driver.findElement(By.css(".statusbar"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Status Bar Colors",
                "--statusBar-background", "luminanceInput", "55");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Status Bar Colors",
                "--statusBar-foreground", "luminanceInput", "55");

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Browser Tile Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Browser Tile Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Browser Tiles')]")));

            const element = (await driver.findElements(By.css("button.browserTile")))[1];
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Browser Tile Colors",
                "--browserTile-background", "luminanceInput", "30");

            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "backgroundColor") !== elStyle;
            }, 3000, "background color did not changed")).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Browser Tile Colors",
                "--browserTile-foreground", "luminanceInput", "55");

            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "color") !== elStyle;
            }, 3000, "background color did not changed")).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Title Bar Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Title Bar Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Title Bar')]")));


            const element = await driver.findElement(By.css("#toolbar1"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Title Bar Colors",
                "--titleBar-activeBackground", "luminanceInput", "55");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Title Bar Colors",
                "--titleBar-activeForeground", "luminanceInput", "55");

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Menu Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Menu Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Menu + Menubar')]")));


            let element = await driver.findElement(By.css(".menubar"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Menu Colors",
                "--menubar-background", "luminanceInput", "55");

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            element = await driver.findElement(By.css("#fileMenu label"));

            await driver.actions().move({
                x: parseInt(String((await element.getRect()).x), 10),
                y: parseInt(String((await element.getRect()).y), 10),
            }).perform();
            await driver.sleep(1000);

            elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Menu Colors",
                "--menubar-selectionForeground", "luminanceInput", "55");

            await driver.actions().move({
                x: parseInt(String((await element.getRect()).x), 10),
                y: parseInt(String((await element.getRect()).y), 10),
            }).perform();
            await driver.sleep(1000);
            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Integrated Terminal Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await toggleUiColorsMenu(driver, "Integrated Terminal Colors", "open", true);

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Terminal')]")));

            const element = await driver.findElement(By.id("terminalPreview"));
            let elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Integrated Terminal Colors",
                "--terminal-background", "luminanceInput", "55");

            await driver.executeScript("arguments[0].scrollBy(0,500)",
                await driver.findElement(By.css("#themeTabview .tabulator-tableholder")));

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);

            elStyle = await getElementStyle(driver, element, "borderColor");

            await setThemeEditorColors(driver, "Integrated Terminal Colors",
                "--terminal-border", "luminanceInput", "55", true);

            expect(await getElementStyle(driver, element, "borderColor") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Breadcrumb Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await driver.executeScript("arguments[0].scrollBy(0,500)",
                await driver.findElement(By.css("#themeTabview .tabulator-tableholder")));

            await toggleUiColorsMenu(driver, "Breadcrumb Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Breadcrumb')]")));

            let element = await driver.findElement(By.id("base"));
            let elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Breadcrumb Colors",
                "--breadcrumb-foreground", "luminanceInput", "55", true);

            expect(await getElementStyle(driver, element, "color") !== elStyle).toBe(true);

            element = await driver.findElement(By.id("breadcrumb1"));

            elStyle = await getElementStyle(driver, element, "backgroundColor");

            await setThemeEditorColors(driver, "Breadcrumb Colors",
                "--breadcrumb-background", "luminanceInput", "55", true);

            expect(await getElementStyle(driver, element, "backgroundColor") !== elStyle).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("UI Colors - Icon Colors", async () => {
        try {
            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await driver.executeScript("arguments[0].scrollBy(0,500)",
                await driver.findElement(By.css("#themeTabview .tabulator-tableholder")));

            await toggleUiColorsMenu(driver, "Icon Colors", "open");

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Symbols')]")));

            const element = await driver.findElement(By.css(".codicon-symbol-array"));
            const elStyle = await getElementStyle(driver, element, "color");

            await setThemeEditorColors(driver, "Icon Colors",
                "--symbolIcon-arrayForeground", "luminanceInput", "55", true);

            expect(await driver.wait(async () => {
                return await getElementStyle(driver, element, "color") !== elStyle;
            }, 3000, "foreground color did not changed")).toBe(true);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Syntax Colors - Change scope selector settings", async () => {
        try {
            await driver.findElement(By.css(".themeSelector")).click();
            await driver.findElement(By.id("Default Dark")).click();

            const syntaxColors = await driver.findElement(By.id("syntaxColors"));
            await syntaxColors.click();

            await driver.executeScript("arguments[0].scrollIntoView(true)",
                await driver.findElement(By.xpath("//p[contains(text(), 'Code Editor')]")));

            const items = await driver.findElements(By.css(".syntaxEntryHost"));

            expect(items.length).toBeGreaterThan(0);

            const findItem = async (name: string, it: number, limit: number): Promise<WebElement | undefined> => {
                if (it < limit) {
                    const items = await driver.findElements(By.css(".syntaxEntryHost"));
                    for (const item of items) {
                        await driver.executeScript("arguments[0].scrollIntoView(true)", item);
                        if (await item.findElement(By.css(".tagInput label")).getText() === name) {
                            return item;
                        }
                    }

                    return findItem(name, it + 1, limit);
                } else {
                    throw new Error("Could not find the item: " + name);
                }
            };

            const clearInput = async (input: WebElement): Promise<void> => {
                await input.click();
                if (platform() === "darwin") {
                    await input.sendKeys(Key.chord(Key.COMMAND, "a"));
                } else {
                    await input.sendKeys(Key.chord(Key.CONTROL, "a"));
                }
                await input.sendKeys(Key.BACK_SPACE);
            };

            const getCodeEditorWord = async (name: string): Promise<WebElement | undefined> => {
                const editor = await driver.findElement(By.css(".editorHost"));
                const words = await editor.findElements(By.xpath("//span[contains(@class, 'mtk')]"));
                for (const word of words) {
                    if (await word.getText() === name) {
                        return word;
                    }
                }
            };


            let identifier = await findItem("identifier", 1, 8);
            await driver.executeScript("arguments[0].scrollIntoView(true)", identifier);

            const bold = await identifier!.findElement(By.css("#bold > span"));
            let refKeyword = await getCodeEditorWord("initialDiameter");
            await bold.click();
            await driver.wait(until.stalenessOf(refKeyword!), 3000, "keyword did not become stale");

            await driver.wait(until.stalenessOf(identifier!), 5000, "'identifier' did not become stale'");
            expect(await driver.wait(async (driver) => {
                const element = await getCodeEditorWord("initialDiameter");
                const elStyle = await getElementStyle(driver, element!, "fontWeight");

                return String(elStyle) === "700";
            }, 3000, "Destination element is not bolded"));

            identifier = await findItem("identifier", 1, 8);
            const italic = await identifier!.findElement(By.css("#italic > span"));
            refKeyword = await getCodeEditorWord("initialDiameter");
            await italic.click();
            await driver.wait(until.stalenessOf(refKeyword!), 3000, "keyword did not become stale");

            await driver.wait(until.stalenessOf(identifier!), 5000, "'identifier' did not become stale'");

            expect(await driver.wait(async (driver) => {
                const element = await getCodeEditorWord("initialDiameter");
                const elStyle = await getElementStyle(driver, element!, "fontStyle");

                return String(elStyle) === "italic";
            }, 3000, "Destination element is not in italic"));

            identifier = await findItem("identifier", 1, 8);
            const underline = await identifier!.findElement(By.css("#underline > span"));
            refKeyword = await getCodeEditorWord("initialDiameter");
            await underline.click();
            await driver.wait(until.stalenessOf(refKeyword!), 3000, "keyword did not become stale");

            await driver.wait(until.stalenessOf(identifier!), 5000, "'identifier' did not become stale'");

            expect(await driver.wait(async (driver) => {
                const element = await getCodeEditorWord("initialDiameter");
                const elStyle = await getElementStyle(driver, element!, "textDecoration");

                return String(elStyle).indexOf("underline") !== -1;
            }, 3000, "Destination element is not underlined"));

            identifier = await findItem("identifier", 1, 8);
            const foreground = await identifier!.findElement(By.id("foreground"));
            await foreground.click();
            const colorPopup = await driver.findElement(By.css(".colorPopup"));
            const hexValue = colorPopup.findElement(By.id("hexValueInput"));
            await clearInput(hexValue);

            await hexValue.sendKeys("#C1D9C6");
            refKeyword = await getCodeEditorWord("initialDiameter");
            await hexValue.sendKeys(Key.ENTER);

            await driver.wait(until.stalenessOf(refKeyword!), 3000, "keyword did not become stale");

            refKeyword = await getCodeEditorWord("initialDiameter");

            await hexValue.sendKeys(Key.ESCAPE);
            await driver.wait(until.stalenessOf(refKeyword!), 3000, "keyword did not become stale");

            expect(await driver.wait(async (driver) => {
                const element = await getCodeEditorWord("initialDiameter");
                const elStyle = String(await getElementStyle(driver, element!, "color"));
                const arr = elStyle.match(/(\d+)/gm);
                const hex = rgbToHex(arr![0], arr![1], arr![2]);

                return hex.toUpperCase() === "#C1D9C6";
            }, 3000, "Foreground color was not changed on destination"));

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Create and change theme", async () => {
        try {
            //CREATE THEME
            const create = await driver.findElement(By.xpath("//button[contains(@data-tooltip, 'Duplicate')]"));
            await create.click();
            const dialog = await driver.findElement(By.css(".valueEditDialog"));
            const theme = await dialog.findElement(By.id("themeName"));
            await theme.clear();
            const themeName = `theme${String(new Date().valueOf())}`;
            await theme.sendKeys(themeName);
            themeLabel = themeName;
            await dialog.findElement(By.id("ok")).click();

            const uiColors = await driver.findElement(By.id("uiColors"));

            const uiColorsClasses = (await uiColors.getAttribute("class")).split(" ");
            if (!uiColorsClasses.includes("selected")) {
                await uiColors.click();
            }

            await setThemeEditorColors(driver, "Activity Bar Colors",
                "--activityBar-background", "luminanceInput", "50");

            await setThemeEditorColors(driver, "Activity Bar Colors",
                "--activityBar-foreground", "luminanceInput", "90");

            const element = await driver.findElement(By.id("mainActivityBar"));
            const elBackgrd = await getElementStyle(driver, element, "backgroundColor");
            const elFgrd = await getElementStyle(driver, element, "color");
            await driver.sleep(2000);

            //CHANGE BACKGROUND COLOR
            await driver.findElement(By.css(".themeSelector")).click();
            await driver.findElement(By.id("Default Light")).click();
            expect(await driver.wait(async () => {
                return await driver.findElement(
                    By.css(".themeSelector label")).getText() === "Default Light";
            }, 5000, "Theme was not changed to Default Light")).toBe(true);

            expect(String(await getBackgroundColor(driver)).trim()).toBe("#FFFFFF");
            expect(await getElementStyle(driver, element, "backgroundColor") !== elBackgrd).toBe(true);
            expect(await getElementStyle(driver, element, "color") !== elFgrd).toBe(true);

            await driver.findElement(By.css(".themeSelector")).click();
            await driver.findElement(By.id("Default Dark")).click();
            expect(await driver.wait(async () => {
                return await driver.findElement(
                    By.css(".themeSelector label")).getText() === "Default Dark";
            }, 3000, "Theme was not changed to Default Dark")).toBe(true);
            expect(String(await getBackgroundColor(driver)).trim()).toBe("#2C2C2CFF");

            await driver.findElement(By.css(".themeSelector")).click();
            await driver.findElement(By.id(themeName)).click();
            expect(await driver.wait(async () => {
                return await driver.findElement(
                    By.css(".themeSelector label")).getText() === themeName;
            }, 3000, `Theme was not changed to ${themeName}`)).toBe(true);

            expect(await getElementStyle(driver, element, "backgroundColor")).toBe(elBackgrd);
            expect(await getElementStyle(driver, element, "color")).toBe(elFgrd);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete theme", async () => {
        try {

            await driver.findElement(By.css(".themeSelector")).click();
            let dropDownList = await driver.findElement(By.css(".dropdownList"));
            if ((await dropDownList.findElements(By.id(themeLabel))).length === 0) {
                const create = await driver.findElement(By.xpath("//button[contains(@data-tooltip, 'Duplicate')]"));
                await create.click();
                const dialog = await driver.findElement(By.css(".valueEditDialog"));
                const theme = await dialog.findElement(By.id("themeName"));
                await theme.clear();
                themeLabel = `theme${String(new Date().valueOf())}`;

                await theme.sendKeys(themeLabel);
                await dialog.findElement(By.id("ok")).click();

                await driver.wait(async () => {
                    return await driver.findElement(
                        By.css(".themeSelector label")).getText() === themeLabel;
                }, 3000, `Theme was not changed to '${themeLabel}'`);
            } else {
                await dropDownList.findElement(By.id(themeLabel)).click();
            }

            const delBtn = await driver.findElement(By.xpath("//button[contains(@data-tooltip, 'Delete')]"));
            await driver.executeScript("arguments[0].click()", delBtn);

            await driver.wait(async () => {
                try {
                    return (await driver.findElement(
                        By.css(".themeSelector label")).getText()).indexOf("Default") !== -1;
                } catch (e) {
                    if (typeof e === "string" && e.includes("StaleElementReferenceError")) {
                        return false;
                    } else {
                        throw e;
                    }
                }
            }, 5000, "Theme was not changed to Default Light, after delete");

            await driver.findElement(By.css(".themeSelector")).click();

            dropDownList = await driver.findElement(By.css(".dropdownList"));

            expect((await dropDownList.findElements(By.id(themeLabel))).length).toBe(0);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });
});
