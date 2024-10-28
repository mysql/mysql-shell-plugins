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

import * as locator from "./locators.js";
import { driver } from "./driver.js";
import { Os } from "./os.js";
import { Condition } from "selenium-webdriver";

/**
 * This class represents the text editor
 */
export class E2ETextEditor {

    /**
     * Gets the text inside the active text editor
     * @returns A promise resolving with the text
     */
    public getText = async (): Promise<string> => {
        const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
        await Os.keyboardSelectAll(textArea);
        await Os.keyboardCopy();

        return Os.readClipboard();
    };

    /**
     * Verifies if the text editor is a json file
     * @returns A promise resolving with the text
     */
    public untilIsJson = (): Condition<boolean> => {
        return new Condition("for document to be json", async () => {
            try {
                JSON.parse(await this.getText());

                return true;
            } catch (e) {
                console.error(e);

                return false;
            }
        });
    };
}
