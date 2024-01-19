/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { Key, WebElement, WebDriver, error } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import { explicitWait } from "./misc.js";

export class ThemeEditor {

    /**
     * Selects the color theme on Theme Editor section
     *
     * @param theme name of the theme
     * @returns Promise resolving when the select is made
     */
    public static selectAppColorTheme = async (driver: WebDriver, theme: string): Promise<void> => {
        await driver.findElement(locator.themeEditorPage.themeSelectorArea.selector).click();
        const dropDownList = await driver.findElement(locator.themeEditorPage.themeSelectorArea.selectorList);
        await dropDownList.findElement(locator.searchById(theme)).click();
    };

    /**
     * Toggles a Theme Editor UI Colors menu
     *
     * @param menu Menu name
     * @param action open/close
     * @param scroll True to scroll down (menu is invisible)
     * @returns A promise resolving when the toggel is made
     */
    public static toggleUiColorsMenu = async (driver: WebDriver, menu: string,
        action: string, scroll?: boolean): Promise<void> => {
        const isTabOpened = async (tab: WebElement) => {
            return (await tab.getAttribute("class")).includes("expanded");
        };

        const themeTabView = await driver.findElement(locator.themeEditorPage.themeEditorTabs.container);

        if (scroll) {
            await driver.executeScript("arguments[0].scrollBy(0,500)",
                await themeTabView.findElement(locator.themeEditorPage.themeEditorTabs.scroll));
        }

        await driver.wait(async () => {
            const els = await themeTabView.findElements(locator.themeEditorPage.themeEditorTabs.tabElements);

            try {
                await els[0].findElement(locator.htmlTag.label).getText();

                return true;
            } catch (e) {
                return false;
            }
        }, explicitWait, "Elements are stale");

        const toggle = async () => {
            const uiColorsItems = await themeTabView
                .findElements(locator.themeEditorPage.themeEditorTabs.tabElements);
            for (let i = 0; i <= uiColorsItems.length - 1; i++) {
                if (await uiColorsItems[i].findElement(locator.htmlTag.label).getText() === menu) { //base colors
                    await driver.executeScript("arguments[0].scrollIntoView(true)",
                        await uiColorsItems[i].findElement(locator.htmlTag.label));
                    if (action === "open") {
                        if (!(await isTabOpened(uiColorsItems[i]))) {
                            await driver.wait(async () => {
                                await uiColorsItems[i].findElement(locator.themeEditorPage.themeEditorTabs.toggleElement).click();

                                return isTabOpened(uiColorsItems[i]);
                            }, 3000, `${menu} did not open`);
                        }
                    } else {
                        if (await isTabOpened(uiColorsItems[i])) {
                            await uiColorsItems[i].findElement(locator.themeEditorPage.themeEditorTabs.toggleElement).click();
                        }
                    }
                    break;
                }
            }
        };

        try {
            await toggle();
        } catch (e) {
            if (!(e instanceof error.StaleElementReferenceError)) {
                throw e;
            } else {
                await toggle();
            }
        }
    };

    /**
     * Checks if the UI Colors menu is expanded, on the Theme Editor
     *
     * @param menuName Menu name
     * @param scroll True to scroll down (menu is invisible)
     * @returns A promise resolving to true if it's expanded, false otherwise. Undefined if the menu is not found
     */
    public static isUiColorsMenuExpanded = async (
        driver: WebDriver,
        menuName: string, scroll?: boolean): Promise<boolean | undefined> => {
        const isTabOpened = async (tab: WebElement) => {
            return (await tab.getAttribute("class")).includes("expanded");
        };

        const check = async () => {
            const themeTabView = await driver.findElement(locator.themeEditorPage.themeEditorTabs.container);
            const scrollBar = await driver.findElement(locator.themeEditorPage.themeEditorTabs.scroll);
            if (scroll) {
                await driver.executeScript("arguments[0].scrollBy(0,500)", scrollBar);
            }
            const uiColorsItems = await themeTabView
                .findElements(locator.themeEditorPage.themeEditorTabs.tabElements);
            for (let i = 0; i <= uiColorsItems.length - 1; i++) {
                if (await uiColorsItems[i].findElement(locator.htmlTag.label).getText() === menuName) { //base colors
                    await driver.executeScript("arguments[0].scrollIntoView(true)",
                        await uiColorsItems[i].findElement(locator.htmlTag.label));

                    return isTabOpened(uiColorsItems[i]);
                }
            }
            const scrollPosition: number = await driver.executeScript("return arguments[0].scrollTop", scrollBar);
            if (scrollPosition === 0) {
                return false;
            } else {
                throw new Error(`Could not find the menu with name ${menuName}`);
            }
        };

        try {
            const result = await check();

            return result;
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                const result = await check();

                return result;
            } else {
                throw e;
            }
        }
    };

    /**
     * Sets the color (using the color pad) of a menu item, on the Theme Editor
     *
     * @param sectionColors Menu item name
     * @param optionId the html id of the option color
     * @param detail the field on the color pad
     * @param value the value to set
     * @param scroll True to scroll down (menu is invisible)
     * @returns A promise resolving when the set is made
     */
    public static setThemeEditorColors = async (driver: WebDriver, sectionColors: string, optionId: string,
        detail: string, value: string, scroll?: boolean): Promise<void> => {

        await ThemeEditor.toggleUiColorsMenu(driver, sectionColors, "open", scroll);

        const openColorPad = async () => {
            await driver.wait(async () => {
                await driver.findElement(locator.searchById(optionId)).click();

                return (await driver.findElements(locator.themeEditorPage.themeSelectorArea.colorPopup)).length > 0;
            }, 3000, "Color Pallete was not opened");
        };

        try {
            await openColorPad();
        } catch (e) {
            await ThemeEditor.toggleUiColorsMenu(driver, sectionColors, "open", scroll);
            await openColorPad();
        }

        const colorPopup = await driver.findElement(locator.themeEditorPage.themeSelectorArea.colorPopup);
        const colorPopupDetail = await colorPopup.findElement(locator.searchById(detail));
        await colorPopupDetail.clear();
        await colorPopupDetail.sendKeys(value);
        await colorPopupDetail.sendKeys(Key.ESCAPE);

        await driver.wait(async () => {
            return !(await ThemeEditor.isUiColorsMenuExpanded(driver, sectionColors, scroll));
        }, 7000, `${sectionColors} menu is not collapsed`);
    };

    /**
     * Returns the CSS value of a color pad
     *
     * @param position position of the color pad (1 for first, 2 for second...)
     * @returns A promise resolving with the css value
     */
    public static getColorPadCss = async (driver: WebDriver, position: number): Promise<string> => {
        const colors = await driver.findElements(locator.themeEditorPage.themeSelectorArea.colorPad.colors);
        await colors[position].click();
        const colorPopup = await driver.findElement(locator.themeEditorPage.themeSelectorArea.colorPopup);
        const value = await colorPopup.findElement(locator.searchById("hexValueInput")).getAttribute("value");
        await colorPopup.findElement(locator.searchById("hexValueInput")).sendKeys(Key.ESCAPE);

        return value;
    };

}
