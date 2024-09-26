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
    };

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
    };

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
    };


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
                return (await driver.findElements(locator.mysqlAdministration.performanceDashboard.exists)).length > 0;
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
        const performanceDashboardLocator = locator.mysqlAdministration.performanceDashboard;
        this.networkStatus = {
            incomingNetworkTrafficGraph: await driver
                .findElement(performanceDashboardLocator.networkStatus.incomingNetworkTrafficGraph),
            incomingData: await (await driver
                .findElement(performanceDashboardLocator.networkStatus.incomingData)).getText(),
            outgoingNetworkTrafficGraph: await driver
                .findElement(performanceDashboardLocator.networkStatus.outgoingNetworkTrafficGraph),
            outgoingData: await (await driver
                .findElement(performanceDashboardLocator.networkStatus.outgoingData)).getText(),
            clientConnectionsGraph: await driver
                .findElement(performanceDashboardLocator.networkStatus.clientConnectionsGraph),
        };

        this.mysqlStatus = {
            tableCacheGraph: await driver
                .findElement(performanceDashboardLocator.mysqlStatus.tableCacheGraph),
            threadsGraph: await driver
                .findElement(performanceDashboardLocator.mysqlStatus.threadsGraph),
            openObjectsGraph: await driver
                .findElement(performanceDashboardLocator.mysqlStatus.openObjectsGraph),
            cacheEfficiency: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.cacheEfficiency)).getText(),
            totalOpenedTables: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.totalOpenedTables)).getText(),
            totalTransactions: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.totalTransactions)).getText(),
            sqlStatementsExecutedGraph: await driver
                .findElement(performanceDashboardLocator.mysqlStatus.sqlStatementsExecutedGraph),
            totalStatements: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.totalStatements)).getText(),
            select: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.select)).getText(),
            insert: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.insert)).getText(),
            update: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.update)).getText(),
            delete: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.delete)).getText(),
            create: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.create)).getText(),
            alter: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.alter)).getText(),
            drop: await (await driver
                .findElement(performanceDashboardLocator.mysqlStatus.drop)).getText(),
        };

        this.innoDBStatus = {
            innoDBBufferPoolGraph: await driver
                .findElement(performanceDashboardLocator.innoDBStatus.innoDBBufferPoolGraph),
            checkpointAgeGraph: await driver
                .findElement(performanceDashboardLocator.innoDBStatus.checkpointAgeGraph),
            diskReadRatioGraph: await driver
                .findElement(performanceDashboardLocator.innoDBStatus.diskReadRatioGraph),
            readRequests: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.readRequests)).getText(),
            writeRequests: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.writeRequests)).getText(),
            diskReads: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.diskReads)).getText(),
            innoDBDiskWritesGraph: await driver
                .findElement(performanceDashboardLocator.innoDBStatus.innoDBDiskWritesGraph),
            logDataWritten: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.logDataWritten)).getText(),
            logWrites: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.logWrites)).getText(),
            writing: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.writing)).getText(),
            innoDBDiskReadsGraph: await driver
                .findElement(performanceDashboardLocator.innoDBStatus.innoDBDiskReadsGraph),
            bufferWrites: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.bufferWrites)).getText(),
            reading: await (await driver
                .findElement(performanceDashboardLocator.innoDBStatus.reading)).getText(),
        };
    };

}
