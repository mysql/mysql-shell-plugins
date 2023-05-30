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

import { By, until, WebElement } from "selenium-webdriver";
import { driver, explicitWait } from "../lib/misc";
import { ThemeEditor } from "../lib/themeEditor";

export class Settings {

    /**
     * Sets the start language on the Settings page
     * Throws an exception if the setting is not found
     *
     * @param section DB Editor or Shell
     * @param value Language
     * @returns Promise resolving when the language is set
     */
    public static setStartLanguage = async (section: string, value: string): Promise<void> => {
        await driver.findElement(By.id("settings")).click();
        await (await Settings.getSettingArea(section))!.click();
        if (section === "DB Editor") {
            await driver.findElement(By.id("dbEditor.startLanguage")).click();
        } else {
            await driver.findElement(By.id("shellSession.startLanguage")).click();
        }

        await driver.wait(until.elementLocated(By.css(".dropdownList")));
        await driver.findElement(By.id(value)).click();
    };

    /**
     * Clicks an item on the Settings page main items section
     *
     * @param settingId Setting name
     * @returns A promise resolving when the click is made
     */
    public static clickSettingArea = async (settingId: string): Promise<void> => {
        if (settingId.indexOf("settings") !== -1) {
            await (await Settings.getSettingArea("Settings"))!.click();
        } else if (settingId.indexOf("theming.") !== -1) {
            await (await Settings.getSettingArea("Theme Settings"))!.click();
        } else if (settingId.indexOf("editor.") !== -1) {
            await (await Settings.getSettingArea("Code Editor"))!.click();
        } else if (settingId.indexOf("dbEditor.") !== -1) {
            await (await Settings.getSettingArea("DB Editor"))!.click();
        } else if (settingId.indexOf("sql") !== -1) {
            await (await Settings.getSettingArea("SQL Execution"))!.click();
        } else if (settingId.indexOf("session") !== -1) {
            await (await Settings.getSettingArea("Shell Session"))!.click();
        } else {
            throw new Error("unknown settingId: " + settingId);
        }
    };

    /**
     * Sets the default color theme, on the settings area
     *
     * @param theme theme name
     * @returns A promise resolving when the click is made
     */
    public static setCurrentTheme = async (theme: string): Promise<void> => {
        await driver.wait(until.elementLocated(By.id("settings")),
            explicitWait, "Settings button was not found").click();
        const settingsHost = await driver.wait(until.elementLocated(By.id("settingsHost")), explicitWait);
        const settingsTreeRows = await settingsHost.findElements(By.css(".settingsTreeCell label"));
        await settingsTreeRows[0].click();
        await ThemeEditor.selectAppColorTheme(theme);
    };

    /**
     * Returns the selected Setting (Theme Settings, Code Editor, etc), on the Settings page.
     * Throws an exception if the setting is not found
     *
     * @param title name of the Setting
     * @returns Promise resolving with the setting area
     */
    private static getSettingArea = async (title: string): Promise<WebElement> => {
        const settings = await driver.findElement(By.id("settingsHost"));
        const settingsTreeRows = await settings.findElements(
            By.css(".settingsTreeCell label"),
        );

        for (const setting of settingsTreeRows) {
            if ((await setting.getText()) === title) {
                return setting;
            }
        }
        throw new Error(`Could not find the setting '${title}'`);
    };

}
