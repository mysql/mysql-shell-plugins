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

import { Condition } from "selenium-webdriver";
import * as locator from "../locators.js";
import { driver } from "../../lib/driver.js";
import { PasswordDialog } from "../Dialogs/PasswordDialog.js";
import * as interfaces from "../interfaces.js";
import * as constants from "../constants.js";
import { E2EServerStatus } from "./E2EServerStatus.js";
import { E2EPerformanceDashboard } from "./E2EPerformanceDashboard.js";
import { E2ELakeHouseNavigator } from "./E2ELakeHouseNavigator.js";
import { E2EClientConnections } from "./E2EClientConnections.js";
import { E2ETabContainer } from "../E2ETabContainer.js";

/**
 * This class represents the MySQL Administration pages and all its related functions
 */
export class E2EMySQLAdministration {

    /** The Server Status page */
    public serverStatus = new E2EServerStatus();

    /** The Client Connections page */
    public clientConnections = new E2EClientConnections();

    /** The Performance Dashboard page */
    public performanceDashboard = new E2EPerformanceDashboard();

    /** The Lakehouse Navigator page */
    public lakeHouseNavigator = new E2ELakeHouseNavigator();

    /**
     * Verifies if the page is opened and fully loaded
     * @param connection The DB connection
     * @returns A condition resolving to true if the page is fully loaded, false otherwise
     */
    public untilPageIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for MySQL Administration page to be opened`, async () => {

            const isOpened = async (): Promise<boolean> => {
                const tabContainer = new E2ETabContainer();

                return tabContainer.tabExists(connection.caption!);
            };

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);

                return driver.wait(async () => {
                    return isOpened();
                }, constants.wait10seconds).catch(async () => {
                    const existsErrorDialog = (await driver.findElements(locator.errorDialog.exists)).length > 0;
                    if (existsErrorDialog) {
                        const errorDialog = await driver.findElement(locator.errorDialog.exists);
                        const errorMsg = await errorDialog.findElement(locator.errorDialog.message);
                        throw new Error(await errorMsg.getText());
                    } else {
                        throw new Error("Unknown error");
                    }
                });
            } else {
                return isOpened();
            }
        });
    };
}
