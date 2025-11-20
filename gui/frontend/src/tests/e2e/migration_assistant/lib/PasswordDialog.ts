/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { Locator } from "@playwright/test";
import { page } from "./Misc.js";
import * as locator from "./locators.js";
import * as constants from "./constants.js";

export class PasswordDialog {

    public dialog: Locator | undefined;

    public exists = async (timeout = constants.wait1second * 3): Promise<PasswordDialog | undefined> => {
        this.dialog = page.locator(locator.passwordDialog.exists);
        try {
            await this.dialog.waitFor({ state: "visible", timeout });

            return this;
        } catch (e) {
            if (e instanceof Error) {
                return undefined;
            }
        }
    };

    public setCredentials = async (password: string): Promise<void> => {
        const input = this.dialog!.locator(locator.passwordDialog.password);
        await input.fill(password);

        const okButton = this.dialog!.locator(locator.passwordDialog.ok);
        await okButton.click();
    };

    /**
     * Cancels the connection
     * 
     * @returns A promise resolving when the cancel button is clicked
     */
    public cancel = async (): Promise<void> => {
        const cancel = this.dialog!.locator(locator.passwordDialog.cancel);
        await cancel.click();
    };
}
