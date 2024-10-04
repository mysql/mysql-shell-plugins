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

import { Condition } from "vscode-extension-tester";
import * as locator from "../../locators";
import { Misc, driver } from "../../Misc";
import { PasswordDialog } from "../Dialogs/PasswordDialog";
import * as interfaces from "../../interfaces";
import * as constants from "../../constants";
import { E2EServerStatus } from "./E2EServerStatus";
import { E2EPerformanceDashboard } from "./E2EPerformanceDashboard";
import { LakeHouseNavigator } from "./lakeHouseNavigator";
import { E2EClientConnections } from "./E2EClientConnections";

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
    public lakeHouseNavigator = new LakeHouseNavigator();

    /**
     * Verifies if the page is opened and fully loaded
     * @param connection The DB connection
     * @param page The page (Server Status, Client Connections, Performance Dashboard, Lakehouse Navigator))
     * @returns A condition resolving to true if the page is fully loaded, false otherwise
     */
    public untilPageIsOpened = (connection: interfaces.IDBConnection, page: string): Condition<boolean> => {
        return new Condition(`for Server Status to be opened`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            const isOpened = async (page: string): Promise<boolean> => {
                switch (page) {
                    case constants.serverStatus: {
                        return (await driver.findElements(locator.mysqlAdministration.serverStatus.exists)).length > 0;
                    }

                    case constants.clientConns: {
                        return (await driver.findElements(locator.mysqlAdministration.clientConnections.toolbar))
                            .length > 0;
                    }

                    case constants.perfDash: {
                        return (await driver.findElements(locator.mysqlAdministration.performanceDashboard.exists))
                            .length > 0;
                    }

                    case constants.lakehouseNavigator: {
                        return (await driver.findElements(locator.lakeHouseNavigator.exists)).length > 0;
                    }

                    default: {
                        throw new Error(`Unknown page`);
                    }
                }

            };

            if (await PasswordDialog.exists()) {
                await PasswordDialog.setCredentials(connection);

                return driver.wait(async () => {
                    return isOpened(page);
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
                return isOpened(page);
            }
        });
    };
}
