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

import { until } from "selenium-webdriver";
import * as constants from "./constants.js";
import * as locator from "./locators.js";
import { driver } from "./driver.js";

/**
 * This class represents the toolbar
 */
export class E2ELogin {

    /**
     * Sets the username
     * @param username The username
     */
    public setUsername = async (username: string): Promise<void> => {
        const usernameInput = await driver.findElement(locator.adminPage.username);
        await usernameInput.clear();
        await usernameInput.sendKeys(username);
    };

    /**
     * Sets the username
     * @param password The username
     */
    public setPassword = async (password: string): Promise<void> => {
        const passwordInput = await driver.findElement(locator.adminPage.password);
        await passwordInput.clear();
        await passwordInput.sendKeys(password);
    };

    /**
     * Clicks on the login button
     */
    public login = async (): Promise<void> => {
        await driver.findElement(locator.adminPage.loginButton).click();
    };

    /**
     * Gets the error on the page
     * @returns A promise resolving with the error text
     */
    public getError = async (): Promise<string> => {
        const error = await driver.wait(until.elementLocated(locator.adminPage.error),
            constants.wait10seconds, "Error was not found");

        return error.getText();
    };

}
