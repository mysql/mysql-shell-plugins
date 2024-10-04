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

import { WebElement } from "selenium-webdriver";
import * as locator from "../locators.js";
import { driver } from "../driver.js";

/**
 * This class represents the Performance dashboard page and all its related functions
 */
export class E2EPerformanceDashboard {

    /** The network status*/
    public networkStatus: {
        incomingNetworkTrafficGraph: WebElement;
        incomingData: string;
        outgoingNetworkTrafficGraph: WebElement;
        outgoingData: string;
        clientConnectionsGraph: WebElement;
    } | undefined;

    /** The mysql status*/
    public mysqlStatus: {
        tableCacheGraph: WebElement;
        threadsGraph: WebElement;
        openObjectsGraph: WebElement;
        cacheEfficiency: string;
        totalOpenedTables: string;
        totalTransactions: string;
        sqlStatementsExecutedGraph: WebElement;
        totalStatements: string;
        select: string;
        insert: string;
        update: string;
        delete: string;
        create: string;
        alter: string;
        drop: string;
    } | undefined;

    /** The innodb status*/
    public innoDBStatus: {
        innoDBBufferPoolGraph: WebElement;
        checkpointAgeGraph: WebElement;
        diskReadRatioGraph: WebElement;
        readRequests: string;
        writeRequests: string;
        diskReads: string;
        innoDBDiskWritesGraph: WebElement;
        logDataWritten: string;
        logWrites: string;
        writing: string;
        innoDBDiskReadsGraph: WebElement;
        bufferWrites: string;
        reading: string;
    } | undefined;

    /**
     * Loads the Server Status page objects and attributes
     * @returns A promise resolving when the page is loaded
     */
    public create = async (): Promise<void> => {
        const performanceDashboardLocator = locator.mysqlAdministration.performanceDashboard;

        const [
            incomingNetworkTrafficGraph,
            incomingData,
            outgoingNetworkTrafficGraph,
            outgoingData,
            clientConnectionsGraph,
            tableCacheGraph,
            threadsGraph,
            openObjectsGraph,
            cacheEfficiency,
            totalOpenedTables,
            totalTransactions,
            sqlStatementsExecutedGraph,
            totalStatements,
            select,
            insert,
            update,
            deleteText,
            create,
            alter,
            drop,
            innoDBBufferPoolGraph,
            checkpointAgeGraph,
            diskReadRatioGraph,
            readRequests,
            writeRequests,
            diskReads,
            innoDBDiskWritesGraph,
            logDataWritten,
            logWrites,
            writing,
            innoDBDiskReadsGraph,
            bufferWrites,
            reading,
        ] = await Promise.all([
            await driver.findElement(performanceDashboardLocator.networkStatus.incomingNetworkTrafficGraph),
            await (await driver.findElement(performanceDashboardLocator.networkStatus.incomingData)).getText(),
            await driver.findElement(performanceDashboardLocator.networkStatus.outgoingNetworkTrafficGraph),
            await (await driver.findElement(performanceDashboardLocator.networkStatus.outgoingData)).getText(),
            await driver.findElement(performanceDashboardLocator.networkStatus.clientConnectionsGraph),
            await driver.findElement(performanceDashboardLocator.mysqlStatus.tableCacheGraph),
            await driver.findElement(performanceDashboardLocator.mysqlStatus.threadsGraph),
            await driver.findElement(performanceDashboardLocator.mysqlStatus.openObjectsGraph),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.cacheEfficiency)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.totalOpenedTables)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.totalTransactions)).getText(),
            await driver.findElement(performanceDashboardLocator.mysqlStatus.sqlStatementsExecutedGraph),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.totalStatements)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.select)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.insert)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.update)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.delete)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.create)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.alter)).getText(),
            await (await driver.findElement(performanceDashboardLocator.mysqlStatus.drop)).getText(),
            await driver.findElement(performanceDashboardLocator.innoDBStatus.innoDBBufferPoolGraph),
            await driver.findElement(performanceDashboardLocator.innoDBStatus.checkpointAgeGraph),
            await driver.findElement(performanceDashboardLocator.innoDBStatus.diskReadRatioGraph),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.readRequests)).getText(),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.writeRequests)).getText(),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.diskReads)).getText(),
            await driver.findElement(performanceDashboardLocator.innoDBStatus.innoDBDiskWritesGraph),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.logDataWritten)).getText(),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.logWrites)).getText(),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.writing)).getText(),
            await driver.findElement(performanceDashboardLocator.innoDBStatus.innoDBDiskReadsGraph),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.bufferWrites)).getText(),
            await (await driver.findElement(performanceDashboardLocator.innoDBStatus.reading)).getText(),
        ]);


        this.networkStatus = {
            incomingNetworkTrafficGraph,
            incomingData,
            outgoingNetworkTrafficGraph,
            outgoingData,
            clientConnectionsGraph,
        };

        this.mysqlStatus = {
            tableCacheGraph,
            threadsGraph,
            openObjectsGraph,
            cacheEfficiency,
            totalOpenedTables,
            totalTransactions,
            sqlStatementsExecutedGraph,
            totalStatements,
            select,
            insert,
            update,
            delete: deleteText,
            create,
            alter,
            drop,
        };

        this.innoDBStatus = {
            innoDBBufferPoolGraph,
            checkpointAgeGraph,
            diskReadRatioGraph,
            readRequests,
            writeRequests,
            diskReads,
            innoDBDiskWritesGraph,
            logDataWritten,
            logWrites,
            writing,
            innoDBDiskReadsGraph,
            bufferWrites,
            reading,
        };
    };

}
