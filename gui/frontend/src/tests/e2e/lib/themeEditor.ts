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

import { Key, WebElement, WebDriver, error } from "selenium-webdriver";
import * as locator from "../lib/locators.js";
import { driver } from "../lib/driver.js";
import * as constants from "../lib/constants.js";

export class ThemeEditor {

    /**
     * Selects the color theme on Theme Editor section
     * @param theme name of the theme
     * @returns Promise resolving when the select is made
     */
    public static selectAppColorTheme = async (theme: string): Promise<void> => {
        await driver.findElement(locator.themeEditorPage.themeSelectorArea.selector).click();
        const dropDownList = await driver.findElement(locator.themeEditorPage.themeSelectorArea.selectorList);
        await dropDownList.findElement(locator.searchById(theme)).click();
    };
}
