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
import { driver } from "../../lib/driver.js";
import { E2EToolbar } from "../E2EToolbar.js";
import { wait3seconds } from "../constants.js";

/**
 * This class represents the Client Connections page and all its related functions
 */
export class E2EClientConnections {

    /** The toolbar*/
    public toolbar = new E2EToolbar();

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

        const threadsConnected = await driver.findElement(clientConnectionsLocator.threadsConnected);
        const threadsRunning = await driver.findElement(clientConnectionsLocator.threadsRunning);
        const threadsCreated = await driver.findElement(clientConnectionsLocator.threadsCreated);
        const threadsCached = await driver.findElement(clientConnectionsLocator.threadsCached);
        const rejected = await driver.findElement(clientConnectionsLocator.rejected);
        const totalConnections = await driver.findElement(clientConnectionsLocator.totalConnections);
        const connectionLimit = await driver.findElement(clientConnectionsLocator.connectionLimit);
        const abortedClients = await driver.findElement(clientConnectionsLocator.abortedClients);
        const abortedConnections = await driver.findElement(clientConnectionsLocator.abortedConnections);
        const errors = await driver.findElement(clientConnectionsLocator.errors);
        const connectionsList = await driver.wait(until.elementLocated(clientConnectionsLocator.connectionsList),
            wait3seconds, `Could not find the connections table`);

        const isNotEmpty = /(.|\s)*\S(.|\s)*/;

        await driver.wait(until.elementTextMatches(threadsConnected, isNotEmpty),
            wait3seconds, `threadsConnected should not be empty`);
        await driver.wait(until.elementTextMatches(threadsRunning, isNotEmpty),
            wait3seconds, `threadsRunning should not be empty`);
        await driver.wait(until.elementTextMatches(threadsCreated, isNotEmpty),
            wait3seconds, `threadsCreated should not be empty`);
        await driver.wait(until.elementTextMatches(rejected, isNotEmpty),
            wait3seconds, `rejected should not be empty`);
        await driver.wait(until.elementTextMatches(totalConnections, isNotEmpty),
            wait3seconds, `totalConnections should not be empty`);
        await driver.wait(until.elementTextMatches(connectionLimit, isNotEmpty),
            wait3seconds, `connectionLimit should not be empty`);
        await driver.wait(until.elementTextMatches(abortedClients, isNotEmpty),
            wait3seconds, `abortedClients should not be empty`);
        await driver.wait(until.elementTextMatches(abortedConnections, isNotEmpty),
            wait3seconds, `abortedConnections should not be empty`);
        await driver.wait(until.elementTextMatches(errors, isNotEmpty),
            wait3seconds, `errors should not be empty`);


        this.threadsConnected = await threadsConnected.getText();
        this.threadsRunning = await threadsRunning.getText();
        this.threadsCreated = await threadsCreated.getText();
        this.threadsCached = await threadsCached.getText();
        this.rejected = await rejected.getText();
        this.totalConnections = await totalConnections.getText();
        this.connectionLimit = await connectionLimit.getText();
        this.abortedClients = await abortedClients.getText();
        this.abortedConnections = await abortedConnections.getText();
        this.errors = await errors.getText();
        this.connectionsList = connectionsList;
    };

}
