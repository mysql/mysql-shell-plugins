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

import { basename, join } from "path";
import { Condition } from "selenium-webdriver";
import { Misc } from "../../lib/misc.js";
import * as locator from "../../lib/locators.js";
import { driver, loadDriver } from "../../lib/driver.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import { Os } from "../../lib/os.js";
import { DatabaseConnectionOverview } from "../../lib/databaseConnectionOverview.js";
import { E2ENotebook } from "../../lib/E2ENotebook.js";
import { E2EMySQLAdministration } from "../../lib/MySQLAdministration/E2EMySQLAdministration.js";
import { Toolbar } from "../../lib/Toolbar.js";
import { E2EToastNotification } from "../../lib/E2EToastNotification.js";

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

    it("Performance Dashboard - MLE Disabled", async () => {
        try {
            await driver.executeScript("arguments[0].click()",
                await notebook.explorer.getMySQLAdminElement(constants.performanceDashboard));
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.performanceDashboard),
                constants.wait15seconds);
            expect(await mysqlAdministration.performanceDashboard.tabExists(constants.perfDashMLETab)).toBe(false);

            await mysqlAdministration.performanceDashboard.loadServerPerformance();
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

    it("Performance Dashboard - MLE Enabled", async () => {
        try {
            await mysqlAdministration.performanceDashboard.editorSelector
                .selectEditor(new RegExp(constants.dbNotebook));
            let notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.codeEditor.loadCommandResults();
            let result = await notebook.codeEditor.execute(`INSTALL COMPONENT "file://component_mle";`);
            expect(result.text).toMatch(/OK/);

            await mysqlAdministration.performanceDashboard.editorSelector
                .selectEditor(new RegExp(constants.performanceDashboard));
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.performanceDashboard),
                constants.wait15seconds);

            await driver.wait(mysqlAdministration.performanceDashboard.untilTabExists(constants.perfDashServerTab),
                constants.wait3seconds);
            await driver.wait(mysqlAdministration.performanceDashboard.untilTabExists(constants.perfDashMLETab),
                constants.wait3seconds);
            expect(await mysqlAdministration.performanceDashboard.tabIsSelected(constants.perfDashServerTab))
                .toBe(true);

            await mysqlAdministration.performanceDashboard.loadServerPerformance();
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

            await (await mysqlAdministration.performanceDashboard.getTab(constants.perfDashMLETab))!.click();
            await mysqlAdministration.performanceDashboard.loadMLEPerformance();
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.heapUsageGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleStatus).toBe("Inactive");
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleMaxHeapSize).toMatch(/(\d+).(\d+) GB/);
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleHeapUtilizationGraph).toBeDefined();
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.currentHeapUsage).toBe("0%");

            await mysqlAdministration.performanceDashboard.editorSelector
                .selectEditor(new RegExp(constants.dbNotebook));
            notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.wait10seconds);
            await notebook.codeEditor.loadCommandResults();

            const jsFunction =
                `CREATE FUNCTION js_pow(arg1 INT, arg2 INT) 
                RETURNS INT DETERMINISTIC LANGUAGE JAVASCRIPT 
                AS 
                $$
                let x = Math.pow(arg1, arg2)
                return x
                $$; 
            `;

            result = await notebook.codeEditor.executeWithButton(jsFunction, constants.execFullBlockSql);
            expect(result.text).toMatch(/OK/);
            result = await notebook.codeEditor.execute("SELECT js_pow(2,3);");
            expect(result.toolbar!.status).toMatch(/OK/);
            await mysqlAdministration.performanceDashboard.editorSelector
                .selectEditor(new RegExp(constants.performanceDashboard));

            await (await mysqlAdministration.performanceDashboard.getTab(constants.perfDashMLETab))!.click();
            await mysqlAdministration.performanceDashboard.loadMLEPerformance();
            expect(mysqlAdministration.performanceDashboard.mlePerformance!.mleStatus).toBe("Active");
            const currentHeap = await driver
                .findElement(locator.mysqlAdministration.performanceDashboard.mleStatus.currentHeapUsage);
            await driver.executeScript("arguments[0].scrollIntoView()", currentHeap);
            expect(parseInt(mysqlAdministration.performanceDashboard.mlePerformance!.currentHeapUsage
                .match(/(\d+)/)![1], 10)).toBeGreaterThan(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    describe("Lakehouse Navigator", () => {

        const heatWaveConn: interfaces.IDBConnection = {
            dbType: "MySQL",
            caption: "e2eHeatWave Connection",
            description: "Local connection",
            basic: {
                hostname: String(process.env.HWHOSTNAME),
                username: String(process.env.HWUSERNAME),
                schema: "e2e_tests",
                password: String(process.env.HWPASSWORD),
            },
        };

        const newTask: interfaces.INewLoadingTask = {
            name: "qa_cookbook_fe",
            description: "How do cook properly",
            targetDatabaseSchema: "e2e_tests",
            formats: "PDF (Portable Document Format Files)",
        };

        const fileToUpload = "qa_cookbook_fe.pdf";

        const notebook = new E2ENotebook();

        beforeAll(async () => {
            try {
                await notebook.close("current");
                await DatabaseConnectionOverview.createDataBaseConnection(heatWaveConn);
                await driver.executeScript("arguments[0].click();",
                    await DatabaseConnectionOverview.getConnection(heatWaveConn.caption!));
                await driver.wait(notebook.untilIsOpened(heatWaveConn), constants.wait10seconds);
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook));
                await notebook.codeEditor.loadCommandResults();
                const result = await notebook.codeEditor
                    .execute(`DROP TABLE IF EXISTS ${(heatWaveConn.basic as interfaces.IConnBasicMySQL)
                        .schema!}.${newTask.name!}`, true);
                expect(result.text).toMatch(/OK/);
                await (await notebook.explorer.getMySQLAdminElement(constants.lakeHouseNavigator)).click();
                expect((await toolbar.getCurrentEditor())!.label).toBe(constants.lakeHouseNavigatorEditor);
                await driver.wait(mysqlAdministration.untilPageIsOpened(heatWaveConn, constants.lakeHouseNavigator),
                    constants.wait15seconds);
                await notebook.explorer.toggle(false);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_LakeHouse");
                throw e;
            }

        });

        afterAll(async () => {
            try {
                await notebook.toolbar.editorSelector.selectEditor(new RegExp(constants.dbNotebook));
                await notebook.codeEditor.loadCommandResults();
                const result = await notebook.codeEditor
                    .execute(`DROP TABLE IF EXISTS ${(heatWaveConn.basic as interfaces.IConnBasicMySQL)
                        .schema!}.${newTask.name!}`, true);
                expect(result.text).toMatch(/OK/);
            } catch (e) {
                await Misc.storeScreenShot("afterAll_LakeHouse");
                throw e;
            }
        });

        it("Upload data to object storage", async () => {
            try {
                const uploadToObjectStorage = mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage;
                await driver.wait(mysqlAdministration.lakeHouseNavigator.overview.untilIsOpened(),
                    constants.wait3seconds);
                await driver.wait(new Condition(`for editor to be ${constants.lakeHouseNavigatorEditor}`, async () => {
                    return (await mysqlAdministration.lakeHouseNavigator.toolbar.editorSelector
                        .getCurrentEditor()).label === constants.lakeHouseNavigatorEditor;
                }), constants.wait3seconds);

                await mysqlAdministration.lakeHouseNavigator.overview.uploadFiles();
                await uploadToObjectStorage.objectStorageBrowser.selectOciProfile("HEATWAVE");
                await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
                await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                    constants.wait15seconds);

                await uploadToObjectStorage.objectStorageBrowser
                    .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
                await (await mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage
                    .getFilesForUploadButton(constants.addFiles)).click();
                await uploadToObjectStorage.setFilesForUploadFilePath(join(process.cwd(), "..", "extension", "tests",
                    "e2e", "lakehouse_nav_files", fileToUpload));
                await driver.wait(uploadToObjectStorage.untilExistsFileForUploadFile(fileToUpload),
                    constants.wait10seconds);
                await uploadToObjectStorage.objectStorageBrowser.checkItem("upload");
                await (await uploadToObjectStorage.getFilesForUploadButton(constants.startFileUpload)).click();
                const notification = await new E2EToastNotification().create();
                expect(notification.type).toBe("info");
                expect(notification.message).toBe("The files have been uploaded successfully.");
                await notification.close();
                await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
                await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                    constants.wait10seconds);
                expect(await uploadToObjectStorage.objectStorageBrowser.existsItem(fileToUpload)).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Load into Lakehouse", async () => {
            try {
                const loadIntoLakehouse = mysqlAdministration.lakeHouseNavigator.loadIntoLakehouse;
                await mysqlAdministration.lakeHouseNavigator.selectTab(constants.loadIntoLakeHouseTab);
                await driver.wait(loadIntoLakehouse.objectStorageBrowser.untilItemsAreLoaded(),
                    constants.wait10seconds);
                await mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                    .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
                expect(await loadIntoLakehouse.objectStorageBrowser.existsItem(fileToUpload)).toBe(true);
                await loadIntoLakehouse.objectStorageBrowser.checkItem(fileToUpload);
                await driver.wait(loadIntoLakehouse.untilExistsLoadingTask(fileToUpload), constants.wait5seconds);
                await loadIntoLakehouse.setNewLoadingTask(newTask);
                await loadIntoLakehouse.startLoadingTask();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Lakehouse Tables", async () => {
            try {
                const lakehouseTables = mysqlAdministration.lakeHouseNavigator.lakehouseTables;
                await driver.wait(lakehouseTables.untilIsOpened(), constants.wait15seconds);
                expect(await lakehouseTables.getDatabaseSchemas()).toContain(newTask.targetDatabaseSchema);
                await driver.wait(lakehouseTables.untilExistsLakeHouseTable(newTask.name!), constants.wait10seconds);
                await driver.wait(lakehouseTables.untilLakeHouseTableIsLoading(newTask.name!), constants.wait1minute);

                let latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
                expect(latestTable!.hasProgressBar).toBe(true);
                expect(latestTable!.loaded).toMatch(/(\d+)%/);
                expect(latestTable!.hasLoadingSpinner).toBe(true);
                expect(latestTable!.rows).toBe("-");
                expect(latestTable!.size).toBe("-");
                expect(latestTable!.date).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                expect(latestTable!.comment).toBe(newTask.description);

                await driver.wait(lakehouseTables.untilLakeHouseTableIsLoaded(newTask.name!), constants.wait2minutes);
                latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
                expect(latestTable!.hasProgressBar).toBe(false);
                expect(latestTable!.loaded).toBe("Yes");
                expect(latestTable!.hasLoadingSpinner).toBe(false);
                expect(latestTable!.rows).toMatch(/(\d+)/);
                expect(latestTable!.size).toMatch(/(\d+).(\d+) (KB|MB)/);
                expect(latestTable!.date).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                expect(latestTable!.comment).toBe(newTask.description);

                const latestTask = await lakehouseTables.getLatestTask();
                await driver.wait(lakehouseTables.untilLakeHouseTaskIsCompleted(latestTask!.id!),
                    constants.wait10seconds);
                expect(latestTask!.name).toBe(`Loading ${newTask.name}`);
                expect(latestTask!.hasProgressBar).toBe(false);
                expect(latestTask!.status).toBe("COMPLETED");
                expect(latestTask!.startTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                expect(latestTask!.endTime).toMatch(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                expect(latestTask!.message).toBe("Task completed.");
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });
    });
});
