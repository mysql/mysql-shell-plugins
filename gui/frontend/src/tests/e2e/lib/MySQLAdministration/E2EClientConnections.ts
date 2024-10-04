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

import { WebElement, until } from "selenium-webdriver";
import * as locator from "../locators.js";
import { driver } from "../driver.js";
import * as constants from "../constants.js";

/**
 * This class represents the Client Connections page and all its related functions
 */
export class E2EClientConnections {

    /** The threads connected*/
    public threadsConnected: string | undefined;

    /** The threads running*/
    public threadsRunning: string | undefined;

    /** The threads created*/
    public threadsCreated: string | undefined;

    /** The threads cached*/
    public threadsCached: string | undefined;

    /** Rejected*/
    public rejected: string | undefined;

    /** The total connections*/
    public totalConnections: string | undefined;

    /** The connections limit*/
    public connectionLimit: string | undefined;

    /** The aborted clients*/
    public abortedClients: string | undefined;

    /** The aborted connections*/
    public abortedConnections: string | undefined;

    /** The errors*/
    public errors: string | undefined;

    /** The connections list*/
    public connectionsList: WebElement | undefined;

    /**
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {

        const clientConnectionsLocator = locator.mysqlAdministration.clientConnections;
        await driver.wait(until.elementTextMatches(await driver.findElement(clientConnectionsLocator.threadsConnected),
            /(\d+)/), constants.wait3seconds);

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
