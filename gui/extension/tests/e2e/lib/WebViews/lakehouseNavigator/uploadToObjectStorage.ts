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

import { Condition, WebElement, InputBox } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as locator from "../../locators";
import { ObjectStorageBrowser } from "./objectStorageBrowser";

export class UploadToObjectStorage {

    public objectStorageBrowser = new ObjectStorageBrowser();

    /**
     * Verifies if the Upload To Object Storage tab is selected
     * @returns A promise resolving to true if the tab is selected, false otherwise
     */
    public isOpened = async (): Promise<boolean> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        const tab = await driver.findElement(locator.lakeHouseNavigator.uploadToObjectStorage.tab);

        return (await tab.getAttribute("class")).includes("selected");
    };

    /**
     * Gets a button from the Files for Upload section
     * @param buttonName The button name
     * @returns A promise resolving with the button
     */
    public getFilesForUploadButton = async (buttonName: string): Promise<WebElement> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

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

    /**
     * Sets the file path into the input box
     * @param path The path for the file
     * @returns A promise resolving when the path is set
     */
    public setFilesForUploadFilePath = async (path: string): Promise<void> => {
        await Misc.switchBackToTopFrame();
        const inputBox = await InputBox.create(constants.wait3seconds);
        await inputBox.setText(path);
        await inputBox.confirm();
    };

    /**
     * Verifies if a file exists on the Files for Upload section
     * @param filename The file name
     * @returns A promise resolving wth true if the file exists, false otherwise
     */
    public existsFileForUploadFile = (filename: string): Condition<boolean> => {
        return new Condition(`for file '${filename}' to exist on Files For Upload section`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

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
}
