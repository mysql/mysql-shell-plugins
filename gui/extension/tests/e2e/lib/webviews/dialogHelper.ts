/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
import { By, WebElement, Locator } from "vscode-extension-tester";
import { driver, Misc } from "../misc";
import * as locator from "../locators";

export class DialogHelper {

    /**
     * Sets a checkbox value
     * @param id The web element id
     * @param checked True to check, false otherwise
     * @returns A promise resolving with the text
     */
    public static setCheckboxValue = async (id: string, checked: boolean): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const isUnchecked = async () => {
            return (await driver.findElement(By.id(id)).getAttribute("class")).split(" ")
                .includes("unchecked");
        };

        if (checked && (await isUnchecked())) {
            await driver.findElement(By.id(id)).findElement(locator.checkBox.checkMark).click();
        } else {
            if (!checked && !(await isUnchecked())) {
                await driver.findElement(By.id(id)).findElement(locator.checkBox.checkMark).click();
            }
        }
    };

    /**
     * Gets a checkbox value
     * @param id The web element id
     * @returns A promise resolving with the checkbox value (true if checked, false otherwise)
     */
    public static getCheckBoxValue = async (id: string): Promise<boolean> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const classes = (await driver.findElement(By.id(id)).getAttribute("class")).split(" ");

        return !classes.includes("unchecked");
    };

    /**
     * Sets a text on an input field, by clearing it first
     * @param dialog The dialog where the input belongs to
     * @param fieldLocator The field locator
     * @param text The text
     * @returns A promise resolving when the field it cleared
     */
    public static setFieldText = async (dialog: WebElement, fieldLocator: Locator, text: string): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const field = await dialog.findElement(fieldLocator);
        const fieldValue = await field.getAttribute("value");
        if (fieldValue.trim() !== "") {
            if (fieldValue !== text) {
                await Misc.clearInputField(field);
                await field.sendKeys(text);
            }
        } else {
            await field.sendKeys(text);
        }
    };

    /**
     * Gets the value from an input field
     * @param dialog The dialog where the input belongs to
     * @param fieldLocator The field locator
     * @returns A promise resolving when the field text is returned
     */
    public static getFieldValue = async (dialog: WebElement, fieldLocator: Locator): Promise<string> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }
        const field = await dialog.findElement(fieldLocator);

        return field.getAttribute("value");
    };

}
