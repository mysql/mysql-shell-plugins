/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { until, By, Key } from "selenium-webdriver";
import { driver } from "../driver.js";
import * as constants from "../constants.js";
import * as interfaces from "../interfaces.js";
import * as locator from "../locators.js";
import { DialogHelper } from "./DialogHelper.js";

/**
 * This class aggregates the functions that perform operations related to the Export SDK dialog
 */
export class ExportSDKDialog {

    /**
     * Sets a MRS SDK using the web view dialog
     * @param data The MRS data
     * @returns A promise resolving when the MRS data is set and the dialog is closed
     */
    public static set = async (data: interfaces.IExportMrsSdk): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(locator.mrsSdkDialog.exists), constants.wait10seconds,
            "Export MRS SDK dialog was not found");

        if (data) {
            if (data.directory) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.directory, data.directory);
            }
            if (data.url) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.serviceUrl, data.url);
            }
            if (data.apiLanguage) {
                const inputSdkLanguage = await dialog.findElement(locator.mrsSdkDialog.sdkLanguage);
                await inputSdkLanguage.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsSdkDialog.sdkLanguageList));
                await popup.findElement(By.id(data.apiLanguage)).click();
                await driver.actions().sendKeys(Key.ESCAPE).perform();
            }
            if (data.appBaseClass) {
                const inputAppBaseClass = await dialog.findElement(locator.mrsSdkDialog.appBaseClass);
                await inputAppBaseClass.click();
                const popup = await driver.wait(until.elementLocated(locator.mrsSdkDialog.appBaseClassList));
                await popup.findElement(By.id(data.appBaseClass)).click();
                await driver.actions().sendKeys(Key.ESCAPE).perform();
            }
            if (data.sdkFileHeader) {
                await DialogHelper.setFieldText(dialog, locator.mrsSdkDialog.sdkFileHeader, data.sdkFileHeader);
            }
        }

        await dialog.findElement(locator.mrsSdkDialog.ok).click();
    };
}
