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

import { By, Key, WebElement } from "selenium-webdriver";
import { driver } from "../lib/misc";

export class ThemeEditor {

    /**
     * Selects the color theme on Theme Editor section
     *
     * @param theme name of the theme
     * @returns Promise resolving when the select is made
     */
    public static selectAppColorTheme = async (theme: string): Promise<void> => {
        await driver.findElement(By.id("theming.currentTheme")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        await dropDownList.findElement(By.id(theme)).click();
    };

    /**
     * Toggles a Theme Editor UI Colors menu
     *
     * @param menu Menu name
     * @param action open/close
     * @param scroll True to scroll down (menu is invisible)
     * @returns A promise resolving when the toggel is made
     */
    public static toggleUiColorsMenu = async (menu: string,
        action: string, scroll?: boolean): Promise<void> => {
        const isTabOpened = async (tab: WebElement) => {
            return (await tab.getAttribute("class")).includes("expanded");
        };

        const themeTabView = await driver.findElement(By.id("themeTabview"));

        if (scroll) {
            await driver.executeScript("arguments[0].scrollBy(0,500)",
                await driver.findElement(By.css("#themeTabview .tabulator-tableholder")));
        }

        await driver.wait(async () => {
            const els = await themeTabView.findElements(By.css(".tabulator-tableholder .tabulator-selectable"));

            try {
                await els[0].findElement(By.css("label")).getText();

                return true;
            } catch (e) {
                return false;
            }
        }, 5000, "Elements are stale");

        const toggle = async () => {
            const uiColorsItems = await themeTabView
                .findElements(By.css(".tabulator-tableholder .tabulator-selectable"));
            for (let i = 0; i <= uiColorsItems.length - 1; i++) {
                if (await uiColorsItems[i].findElement(By.css("label")).getText() === menu) { //base colors
                    await driver.executeScript("arguments[0].scrollIntoView(true)",
                        await uiColorsItems[i].findElement(By.css("label")));
                    if (action === "open") {
                        if (!(await isTabOpened(uiColorsItems[i]))) {
                            await driver.wait(async () => {
                                await uiColorsItems[i].findElement(By.css(".treeToggle")).click();

                                return isTabOpened(uiColorsItems[i]);
                            }, 3000, `${menu} did not open`);
                        }
                    } else {
                        if (await isTabOpened(uiColorsItems[i])) {
                            await uiColorsItems[i].findElement(By.css(".treeToggle")).click();
                        }
                    }
                    break;
                }
            }
        };

        try {
            await toggle();
        } catch (e) {
            if (e instanceof Error) {
                if (e.message.indexOf("StaleElementReferenceError") === -1) {
                    await toggle();
                } else {
                    throw e;
                }
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
    public static isUiColorsMenuExpanded = async(
        menuName: string, scroll?: boolean): Promise<boolean | undefined> => {
        const isTabOpened = async (tab: WebElement) => {
            return (await tab.getAttribute("class")).includes("expanded");
        };

        const check = async () => {
            const themeTabView = await driver.findElement(By.id("themeTabview"));
            const scrollBar = await driver.findElement(By.css("#themeTabview .tabulator-tableholder"));
            if (scroll) {
                await driver.executeScript("arguments[0].scrollBy(0,500)", scrollBar);
            }
            const uiColorsItems = await themeTabView
                .findElements(By.css(".tabulator-tableholder .tabulator-selectable"));
            for (let i = 0; i <= uiColorsItems.length - 1; i++) {
                if (await uiColorsItems[i].findElement(By.css("label")).getText() === menuName) { //base colors
                    await driver.executeScript("arguments[0].scrollIntoView(true)",
                        await uiColorsItems[i].findElement(By.css("label")));

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
            if (e instanceof Error) {
                if (e.message.indexOf("StaleElementReferenceError") === -1) {
                    const result = await check();

                    return result;
                } else {
                    throw e;
                }
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
    public static setThemeEditorColors = async (sectionColors: string, optionId: string,
        detail: string, value: string, scroll?: boolean): Promise<void> => {

        await ThemeEditor.toggleUiColorsMenu(sectionColors, "open", scroll);

        const openColorPad = async () => {
            await driver.wait(async () => {
                await driver.findElement(By.id(optionId)).click();

                return (await driver.findElements(By.css(".colorPopup"))).length > 0;
            }, 3000, "Color Pallete was not opened");
        };

        try {
            await openColorPad();
        } catch (e) {
            await ThemeEditor.toggleUiColorsMenu(sectionColors, "open", scroll);
            await openColorPad();
        }

        const colorPopup = await driver.findElement(By.css(".colorPopup"));
        await colorPopup.findElement(By.id(detail)).clear();
        await colorPopup.findElement(By.id(detail)).sendKeys(value);
        await colorPopup.findElement(By.id(detail)).sendKeys(Key.ESCAPE);

        await driver.wait(async () => {
            return !(await ThemeEditor.isUiColorsMenuExpanded(sectionColors, scroll));
        }, 7000, `${sectionColors} menu is not collapsed`);
    };

    /**
     * Returns the CSS value of a color pad
     *
     * @param position position of the color pad (1 for first, 2 for second...)
     * @returns A promise resolving with the css value
     */
    public static getColorPadCss = async (position: number): Promise<string> => {
        const colors = await driver.findElements(By.css("#colorPadCell > div"));
        await colors[position].click();
        const colorPopup = await driver.findElement(By.css(".colorPopup"));
        const value = await colorPopup.findElement(By.id("hexValueInput")).getAttribute("value");
        await colorPopup.findElement(By.id("hexValueInput")).sendKeys(Key.ESCAPE);

        return value;
    };

}

