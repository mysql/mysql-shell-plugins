/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { basename } from "path";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";
import { E2EMySQLAdministration } from "../../lib/MySQLAdministration/E2EMySQLAdministration.js";
import { Toolbar } from "../../lib/Toolbar.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("MySQL Administration", () => {

    let testFailed = false;

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `connAdmin`,
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            protocol: "mysql",
            username: String(process.env.DBUSERNAME),
            port: parseInt(process.env.DBPORT!, 10),
            portX: parseInt(process.env.DBPORTX!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    const notebook = new E2ENotebook();
    const toolbar = new Toolbar();
    const mysqlAdministration = new E2EMySQLAdministration();

    beforeAll(async () => {
        await loadDriver();
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds, "Home page was not loaded");
            await driver.findElement(locator.sqlEditorPage.icon).click();
            await DatabaseConnectionOverview.createDataBaseConnection(globalConn);
            await driver.executeScript("arguments[0].click();",
                await DatabaseConnectionOverview.getConnection(globalConn.caption!));
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_Admin");
            throw e;
        }
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Server Status", async () => {
        try {
            await (await notebook.explorer.getMySQLAdminElement(constants.serverStatus)).click();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.serverStatus),
                constants.wait15seconds);
            expect((await toolbar.getCurrentEditor())!.label).toBe(constants.serverStatus);

            await mysqlAdministration.serverStatus.create();
            expect(mysqlAdministration.serverStatus.host).not.toBe("");
            expect(mysqlAdministration.serverStatus.socket).toMatch(/(\.sock|MySQL|none)/);
            expect(mysqlAdministration.serverStatus.port).toMatch(/(\d+)/);
            expect(mysqlAdministration.serverStatus.version).toMatch(/(\d+).(\d+).(\d+)/);
            expect(mysqlAdministration.serverStatus.compiledFor).not.toBe("");
            expect(mysqlAdministration.serverStatus.configurationFile).not.toBe("");
            expect(mysqlAdministration.serverStatus.runningSince)
                .toMatch(/(\d+) (day|days), (\d+) (hour|hours), (\d+) (minute|minutes)/);
            expect(mysqlAdministration.serverStatus.baseDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
            expect(mysqlAdministration.serverStatus.dataDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
            expect(mysqlAdministration.serverStatus.pluginsDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
            expect(mysqlAdministration.serverStatus.tempDirectory).toMatch(/((?:[^\\/]*\/)*)(.*)/);
            expect(mysqlAdministration.serverStatus.errorLog!.checked).toBe(true);
            expect(mysqlAdministration.serverStatus.errorLog!.path).toMatch(/((?:[^\\/]*\/)*)(.*)/);
            expect(typeof mysqlAdministration.serverStatus.generalLog!.checked).toBe("boolean");
            expect(mysqlAdministration.serverStatus.generalLog!.path).not.toBe("");
            expect(typeof mysqlAdministration.serverStatus.slowQueryLog!.checked).toBe("boolean");
            expect(mysqlAdministration.serverStatus.slowQueryLog!.path).not.toBe("");
            expect(typeof mysqlAdministration.serverStatus.performanceSchema).toBe("boolean");
            expect(typeof mysqlAdministration.serverStatus.threadPool).toBe("boolean");
            expect(mysqlAdministration.serverStatus.memCachedPlugin).not.toBe("");
            expect(mysqlAdministration.serverStatus.semiSyncRepPlugin).not.toBe("");
            expect(typeof mysqlAdministration.serverStatus.pamAuthentication).toBe("boolean");
            expect(typeof mysqlAdministration.serverStatus.passwordValidation).toBe("boolean");
            expect(typeof mysqlAdministration.serverStatus.auditLog).toBe("boolean");
            expect(mysqlAdministration.serverStatus.firewall).not.toBe("");
            expect(mysqlAdministration.serverStatus.firewallTrace).not.toBe("");
            expect(mysqlAdministration.serverStatus.sslCa).toMatch(/.pem/);
            expect(mysqlAdministration.serverStatus.sslCert).toMatch(/.pem/);
            expect(mysqlAdministration.serverStatus.sslKey).toMatch(/.pem/);
            expect(mysqlAdministration.serverStatus.privateKey).toBe("private_key.pem");
            expect(mysqlAdministration.serverStatus.publicKey).toBe("public_key.pem");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Client Connections", async () => {
        try {
            await driver.executeScript("arguments[0].click()",
                await notebook.explorer.getMySQLAdminElement(constants.clientConnections));
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.clientConnections),
                constants.wait15seconds);
            expect((await toolbar.getCurrentEditor())!.label).toBe(constants.clientConnections);

            await mysqlAdministration.clientConnections.create();
            expect(mysqlAdministration.clientConnections.threadsConnected).toMatch(/Threads Connected: (\d+)/);
            expect(mysqlAdministration.clientConnections.threadsRunning).toMatch(/Threads Running: (\d+)/);
            expect(mysqlAdministration.clientConnections.threadsCreated).toMatch(/Threads Created: (\d+)/);
            expect(mysqlAdministration.clientConnections.rejected).toMatch(/Rejected \(over limit\):/);
            expect(mysqlAdministration.clientConnections.totalConnections).toMatch(/Total Connections: (\d+)/);
            expect(mysqlAdministration.clientConnections.connectionLimit).toMatch(/Connection Limit: (\d+)/);
            expect(mysqlAdministration.clientConnections.abortedClients).toMatch(/Aborted Clients: (\d+)/);
            expect(mysqlAdministration.clientConnections.abortedConnections).toMatch(/Aborted Connections: (\d+)/);
            expect(mysqlAdministration.clientConnections.errors).toMatch(/Errors: (\d+)/);
            expect((await mysqlAdministration.clientConnections.connectionsList!
                .findElements(locator.mysqlAdministration.clientConnections.tableRow)).length).toBeGreaterThan(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Performance Dashboard", async () => {
        try {
            await (await notebook.explorer.getMySQLAdminElement(constants.performanceDashboard)).click();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.performanceDashboard),
                constants.wait15seconds);
            expect((await toolbar.getCurrentEditor())!.label).toBe(constants.performanceDashboard);

            await mysqlAdministration.performanceDashboard.create();
            expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingNetworkTrafficGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.networkStatus!.incomingData).toMatch(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingNetworkTrafficGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.networkStatus!.outgoingData).toMatch(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.tableCacheGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.threadsGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.openObjectsGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.cacheEfficiency).toMatch(/(\d+)%/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalOpenedTables).toMatch(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalTransactions).toMatch(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.sqlStatementsExecutedGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.totalStatements).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.select).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.insert).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.update).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.delete).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.create).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.alter).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus!.drop).toMatch(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBBufferPoolGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.checkpointAgeGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReadRatioGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.readRequests).toMatch(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writeRequests).toMatch(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.diskReads).toMatch(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskWritesGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logDataWritten).toMatch(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.logWrites).toMatch(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.writing).toMatch(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.innoDBDiskReadsGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.bufferWrites).toMatch(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus!.reading).toMatch(/(\d+) B\/s/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
