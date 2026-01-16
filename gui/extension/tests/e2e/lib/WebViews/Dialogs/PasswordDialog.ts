/*
 * Copyright (c) 2024, 2026 Oracle and/or its affiliates.
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
import { until, Condition } from "vscode-extension-tester";
import { driver, Misc } from "../../Misc";
import * as constants from "../../constants";
import * as interfaces from "../../interfaces";
import * as locator from "../../locators";
import { credentialHelperOk } from "../../Workbench";

/**
 * This class aggregates the functions that perform password dialog related operations
 */
export class PasswordDialog {

    /**
     * Verifies if the Open MySQL Connection dialog is displayed
     * 
     * @returns A promise resolving to true if the dialog is displayed, false otherwise
     */
    public static exists = async (): Promise<boolean> => {
        await Misc.switchBackToTopFrame();
        await Misc.switchToFrame();

        return (await driver.findElements(locator.passwordDialog.exists)).length > 0;
    };

    /**
     * Verifies if the Open MySQL Connection dialog is displayed
     * 
     * @returns A condition resolving to true if the dialog is displayed, false otherwise
     */
    public static untilExists = (): Condition<boolean> => {
        return new Condition("for Password dialog to exist", async () => {
            return this.exists();
        });
    };

    /**
     * Sets the database credentials on the password dialog
     * 
     * @param data The credentials
     * @param timeout The max number of time the function should wait until the connection is successful
     * @param setConfirm Weather to set the confirmation or not 
     * @returns A promise resolving when the credentials are set
     */
    public static setCredentials = async (
        data: interfaces.IDBConnection,
        timeout?: number,
        setConfirm = true): Promise<void> => {

        await this.setPassword(data);

        if (credentialHelperOk && setConfirm) {
            await this.setConfirm("no", timeout);
        }
    };

    public static untilIsLoading = (): Condition<boolean | undefined> => {
        return new Condition("for loading icon to disappear", async () => {
            return (await driver.findElements(locator.passwordDialog.loadingIcon)).length === 0;
        });
    };

    /**
     * Sets the database connection password
     * 
     * @param dbConfig The database configuration
     * @returns A promise resolving when the password is set
     */
    private static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const dialog = await driver.wait(until.elementLocated((locator.passwordDialog.exists)),
            constants.wait1second * 5, "No password dialog was found");
        await dialog.findElement(locator.passwordDialog.password)
            .sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password!);
        await dialog.findElement(locator.passwordDialog.ok).click();
    };

    /**
     * Sets the database connection confirm dialog
     * 
     * @param value The value. (Y, N, A)
     * @param timeoutDialog The time to wait for the confirm dialog
     * @returns A promise resolving when the password is set
     */
    private static setConfirm = async (value: string,
        timeoutDialog = constants.wait1second * 10): Promise<void> => {

        if (!(await Misc.insideIframe())) {
            await Misc.switchToFrame();
        }

        const confirmDialog = await driver.wait(until.elementsLocated(locator.confirmDialog.exists),
            timeoutDialog, "No confirm dialog was found");

        const noBtn = await confirmDialog[0].findElement(locator.confirmDialog.refuse);
        const yesBtn = await confirmDialog[0].findElement(locator.confirmDialog.accept);
        const neverBtn = await confirmDialog[0].findElement(locator.confirmDialog.alternative);

        switch (value) {
            case "yes": {
                await yesBtn.click();
                break;
            }
            case "no": {
                await noBtn.click();
                break;
            }
            case "never": {
                await neverBtn.click();
                break;
            }
            default: {
                break;
            }
        }
    };
}
