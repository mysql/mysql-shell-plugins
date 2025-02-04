/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until, error } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { driver } from "./driver.js";
import { E2EToastNotification } from "./E2EToastNotification.js";

/**
 * This class represents the Script page
 */
export class E2ESettings {

    /**
     * Opened the Settings page
     */
    public open = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.settingsPage.toggle)).click();

        await driver.wait(until.elementLocated(locator.settingsPage.exists), constants.wait3seconds,
            "The Settings page was not opened");
    };

    /**
     * Closes the Settings page
     */
    public close = async (): Promise<void> => {
        await driver.wait(until.elementLocated(locator.settingsPage.toggle)).click();

        await driver.wait(async () => {
            return (await driver.findElements(locator.settingsPage.exists)).length === 0;
        }, constants.wait3seconds, "The Settings page was not closed");
    };

    /**
     * Selects the Current Theme
     * @param theme The theme
     */
    public selectCurrentTheme = async (theme: string): Promise<void> => {

        const currentThemeValue = await driver.findElement(locator.settingsPage.themeSettings.currentTheme.exists)
            .findElement(locator.htmlTag.label);

        if (await currentThemeValue.getText() !== theme) {
            const currentThemeInput = await driver.wait(until
                .elementLocated(locator.settingsPage.themeSettings.currentTheme.exists), constants.wait3seconds,
                "Could not find the Current Theme input");
            await currentThemeInput.click();
            const selectList = await driver.wait(until
                .elementLocated(locator.settingsPage.themeSettings.currentTheme.selectList.exists),
                constants.wait3seconds, "Could not find the Current Theme Select List");
            await selectList.findElement(locator.settingsPage.themeSettings.currentTheme.selectList.item(theme))
                .click();

            const notification = await new E2EToastNotification().create();
            await notification!.close();

            await driver.wait(async () => {
                const currentThemeValue = await driver
                    .findElement(locator.settingsPage.themeSettings.currentTheme.exists)
                    .findElement(locator.htmlTag.label);

                return (await currentThemeValue.getText()) === theme;
            }, constants.wait3seconds, `The Current Theme should be '${theme}'`);
        }
    };

    /**
     * Checks/Unchecks the confirmation on close checkbox
     * @param checked True to check, false to uncheck
     */
    public confirmationOnClose = async (checked: boolean): Promise<void> => {
        const isUnchecked = async (): Promise<boolean> => {
            let isUnchecked = false;

            await driver.wait(async () => {
                try {
                    const confirmationOnClose = await driver.findElement(locator.settingsPage.confirmationOnClose);
                    isUnchecked = (await confirmationOnClose.getAttribute("class")).includes("unchecked");

                    return true;
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait3seconds, "Could not verify if confirmation on close checkbox is checked");

            return isUnchecked;
        };

        if (await isUnchecked() && checked) {
            await driver.wait(async () => {
                await driver.findElement(locator.settingsPage.confirmationOnClose).click();

                return !(await isUnchecked());
            }, constants.wait5seconds, `Confirmation on close should be CHECKED`);

            const notification = await new E2EToastNotification().create();
            await notification!.close();
        }

        if (!(await isUnchecked()) && !checked) {
            await driver.wait(async () => {
                await driver.findElement(locator.settingsPage.confirmationOnClose).click();

                return isUnchecked();
            }, constants.wait5seconds, `Confirmation on close should be CHECKED`);

            const notification = await new E2EToastNotification().create();
            await notification!.close();
        }
    };
}
