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

import { WebElement } from "vscode-extension-tester";
import * as locator from "../../locators";
import { driver } from "../../Misc";

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
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {

        const clientConnectionsLocator = locator.mysqlAdministration.clientConnections;

        const [
            threadsConnected,
            threadsRunning,
            threadsCreated,
            threadsCached,
            rejected,
            totalConnections,
            connectionLimit,
            abortedClients,
            abortedConnections,
            errors,
            connectionsList,
        ] = await Promise.all([
            await (await driver.findElement(clientConnectionsLocator.threadsConnected)).getText(),
            await (await driver.findElement(clientConnectionsLocator.threadsRunning)).getText(),
            await (await driver.findElement(clientConnectionsLocator.threadsCreated)).getText(),
            await (await driver.findElement(clientConnectionsLocator.threadsCached)).getText(),
            await (await driver.findElement(clientConnectionsLocator.rejected)).getText(),
            await (await driver.findElement(clientConnectionsLocator.totalConnections)).getText(),
            await (await driver.findElement(clientConnectionsLocator.connectionLimit)).getText(),
            await (await driver.findElement(clientConnectionsLocator.abortedClients)).getText(),
            await (await driver.findElement(clientConnectionsLocator.abortedConnections)).getText(),
            await (await driver.findElement(clientConnectionsLocator.errors)).getText(),
            await driver.findElement(clientConnectionsLocator.connectionsList),
        ]);


        this.threadsConnected = threadsConnected;
        this.threadsRunning = threadsRunning;
        this.threadsCreated = threadsCreated;
        this.threadsCached = threadsCached;
        this.rejected = rejected;
        this.totalConnections = totalConnections;
        this.connectionLimit = connectionLimit;
        this.abortedClients = abortedClients;
        this.abortedConnections = abortedConnections;
        this.errors = errors;
        this.connectionsList = connectionsList;
    };

}
