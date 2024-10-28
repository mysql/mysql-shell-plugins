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

import { Condition, WebElement, until } from "selenium-webdriver";
import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import { E2EObjectStorageBrowser } from "./E2EObjectStorageBrowser.js";

export class E2EUploadToObjectStorage {

    public objectStorageBrowser = new E2EObjectStorageBrowser();

    /**
     * Verifies if the Upload To Object Storage tab is selected
     * @returns A promise resolving to true if the tab is selected, false otherwise
     */
    public isOpened = async (): Promise<boolean> => {
        const tab = await driver.findElement(locator.lakeHouseNavigator.uploadToObjectStorage.tab);

        return (await tab.getAttribute("class")).includes("selected");
    };

    /**
     * Add files
     * @param path The file location
     */
    public addFiles = async (path: string): Promise<void> => {
        const button = await this.getFilesForUploadButton(constants.addFiles);
        await driver.wait(async () => {
            return !(await button.getAttribute("class")).includes("disabled");
        }, constants.wait3seconds, `${constants.addFiles} button is disabled`);

        await button.click();
        await driver.wait(until.elementLocated(locator.fileSelect),
            constants.wait5seconds, "Could not find the input file box").sendKeys(path);

        const splittedPath = path.split("/");
        await driver.wait(this.untilExistsFileForUploadFile(splittedPath[splittedPath.length - 1]));
    };

    /**
     * Clicks on the Start File Upload button
     */
    public startFileUpload = async (): Promise<void> => {
        const button = await this.getFilesForUploadButton(constants.startFileUpload);
        await driver.wait(async () => {
            return !(await button.getAttribute("class")).includes("disabled");
        }, constants.wait3seconds, `${constants.addFiles} button is disabled`);

        await button.click();

        await driver.wait(async () => {
            return (await button.getAttribute("class")).includes("disabled");
        }, constants.wait3seconds, `${constants.addFiles} button should be disabled after clicking it`);
    };

    /**
     * Verifies if a file exists on the Files for Upload section
     * @param filename The file name
     * @returns A promise resolving wth true if the file exists, false otherwise
     */
    private untilExistsFileForUploadFile = (filename: string): Condition<boolean | undefined> => {
        return new Condition(`for file '${filename}' to exist on Files For Upload section`, async () => {
            const fileLocator = locator.lakeHouseNavigator.uploadToObjectStorage.filesForUpload.file;
            const files = await driver.findElements(fileLocator);

            for (const file of files) {
                const caption = await file.getText();
                if (caption === filename) {
                    return true;
                }
            }
        });
    };

    /**
     * Gets a button from the Files for Upload section
     * @param buttonName The button name
     * @returns A promise resolving with the button
     */
    private getFilesForUploadButton = async (buttonName: string): Promise<WebElement> => {
        const buttons = await driver
            .findElements(locator.lakeHouseNavigator.uploadToObjectStorage.filesForUpload.button);
        for (const button of buttons) {
            const label = await button.findElement(locator.htmlTag.label);
            if (await label.getText() === buttonName) {
                return button;
            }
        }

        throw new Error(`Could not find button '${buttonName}'`);
    };
}
