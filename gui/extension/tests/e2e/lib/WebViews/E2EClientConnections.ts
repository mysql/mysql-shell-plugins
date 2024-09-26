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

import { Condition, WebElement } from "vscode-extension-tester";
import * as locator from "../locators";
import { Misc, driver } from "../Misc";
import { PasswordDialog } from "./Dialogs/PasswordDialog";
import * as interfaces from "../interfaces";
import * as constants from "../constants";

/**
 * This class represents the Client Connections page and all its related functions
 */
export class E2EClientConnections {

    /** The threads connected*/
    public threadsConnected: string;

    /** The threads running*/
    public threadsRunning: string;

    /** The threads created*/
    public threadsCreated: string;

    /** The threads cached*/
    public threadsCached: string;

    /** Rejected*/
    public rejected: string;

    /** The total connections*/
    public totalConnections: string;

    /** The connections limit*/
    public connectionLimit: string;

    /** The aborted clients*/
    public abortedClients: string;

    /** The aborted connections*/
    public abortedConnections: string;

    /** The errors*/
    public errors: string;

    /** The connections list*/
    public connectionsList: WebElement;


    /**
     * Verifies if the Server Status page is opened and fully loaded
     * @param connection The DB connection
     * @returns A condition resolving to true if the page is fully loaded, false otherwise
     */
    public untilIsOpened = (connection: interfaces.IDBConnection): Condition<boolean> => {
        return new Condition(`for Server Status to be opened`, async () => {
            await Misc.switchBackToTopFrame();
            await Misc.switchToFrame();

            const isOpened = async (): Promise<boolean> => {
                return (await driver.findElements(locator.mysqlAdministration.clientConnections.toolbar)).length > 0;
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

    /**
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {
        const clientConnectionsLocator = locator.mysqlAdministration.clientConnections;
        this.threadsConnected = await (await driver.findElement(clientConnectionsLocator.threadsConnected)).getText();
        this.threadsRunning = await (await driver.findElement(clientConnectionsLocator.threadsRunning)).getText();
        this.threadsCreated = await (await driver.findElement(clientConnectionsLocator.threadsCreated)).getText();
        this.threadsCached = await (await driver.findElement(clientConnectionsLocator.threadsCached)).getText();
        this.rejected = await (await driver.findElement(clientConnectionsLocator.rejected)).getText();
        this.totalConnections = await (await driver.findElement(clientConnectionsLocator.totalConnections)).getText();
        this.connectionLimit = await (await driver.findElement(clientConnectionsLocator.connectionLimit)).getText();
        this.abortedClients = await (await driver.findElement(clientConnectionsLocator.abortedClients)).getText();
        this.abortedConnections = await (await driver.findElement(clientConnectionsLocator.abortedConnections))
            .getText();
        this.errors = await (await driver.findElement(clientConnectionsLocator.errors)).getText();
        this.connectionsList = await driver.findElement(clientConnectionsLocator.connectionsList);
    };

}
