/*
 * Copyright (c) 2022, 2025 Oracle and/or its affiliates.
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


import { join } from "path";
import fs from "fs/promises";
import {
    BottomBarPanel, Condition, TreeItem,
    until, Workbench as extWorkbench, ActivityBar, CustomTreeItem,
    SideBarView, CustomTreeSection, error,
} from "vscode-extension-tester";
import { expect } from "chai";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/Misc";
import { DatabaseConnectionDialog } from "../lib/WebViews/Dialogs/DatabaseConnectionDialog";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import * as errors from "../lib/errors";
import { E2EShellConsole } from "../lib/WebViews/E2EShellConsole";
import { E2EScript } from "../lib/WebViews/E2EScript";
import { E2EToolbar } from "../lib/WebViews/E2EToolbar";
import { TestQueue } from "../lib/TestQueue";
import { E2EMySQLAdministration } from "../lib/WebViews/MySQLAdministration/E2EMySQLAdministration";
import { E2ECommandResultGrid } from "../lib/WebViews/CommandResults/E2ECommandResultGrid";
import { E2ECommandResultData } from "../lib/WebViews/CommandResults/E2ECommandResultData";
import { E2ELogger } from "../lib/E2ELogger";
import { CreateLibraryDialog } from "../lib/WebViews/Dialogs/CreateLibraryFrom";
import { E2ERecording } from "../lib/E2ERecording";
import "../setup/global-hooks";

describe("DATABASE CONNECTIONS", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `conn-port:${parseInt(process.env.MYSQL_1107!, 10)}`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1107!, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    before(async function () {
        let hookResult = "passed";
        await Misc.loadDriver();
        const localE2eRecording = new E2ERecording(this.test!.title!);
        try {
            await localE2eRecording!.start();
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Os.appendToExtensionLog("beforeAll DATABASE CONNECTIONS");
            const activityBare = new ActivityBar();
            await (await activityBare.getViewControl(constants.extensionName))?.openView();
            await Workbench.dismissNotifications();
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.waitForTreeItem);
            await Workbench.closeAllEditors();
            await new BottomBarPanel().toggle(false);
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
        } catch (e) {
            hookResult = "failed";
            throw e;
        } finally {
            await Misc.processResult(this, localE2eRecording, hookResult);
        }

    });

    after(async function () {
        Misc.removeDatabaseConnections();
    });

    describe("Toolbar", () => {

        it("Reload the connection list", async () => {

            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.waitForTreeItem);

        });

        it("Collapse All", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            const treeGlobalSchema = await dbTreeSection.getTreeItem((globalConn.basic as interfaces.IConnBasicMySQL)
                .schema!);

            await treeGlobalSchema.expand();
            const treeGlobalSchemaTables = await dbTreeSection.getTreeItem("Tables");
            await treeGlobalSchemaTables.expand();
            const treeGlobalSchemaViews = await dbTreeSection.getTreeItem("Views");
            await treeGlobalSchemaViews.expand();
            const treeDBSection: CustomTreeSection = await new SideBarView().getContent()
                .getSection(constants.dbTreeSection);
            await dbTreeSection.clickToolbarButton(constants.collapseAll);

            let visibleItems: CustomTreeItem[];
            await driver.wait(async () => {
                visibleItems = await treeDBSection.getVisibleItems();
                if (visibleItems.length > 0) {
                    for (const item of visibleItems) {
                        if (await item.getAttribute("aria-level") !== "1") {
                            return false;
                        }
                    }

                    return true;
                }
            }, constants.wait1second * 5, "The tree is not fully collapsed");
        });

        it("Restart internal MySQL Shell process", async () => {

            await fs.truncate(Os.getMysqlshLog());
            await dbTreeSection.selectMoreActionsItem(constants.restartInternalShell);
            const notification = await Workbench.getNotification("This will close all MySQL Shell tabs", false);
            await Workbench.clickOnNotificationButton(notification, "Restart MySQL Shell");
            await driver.wait(async () => {
                return Os.findOnMySQLShLog(/Info/);
            }, constants.wait1second * 5 * 3, "Shell server did not start");

            try {
                await driver.wait(async () => {
                    const text = await fs.readFile(Os.getMysqlshLog());
                    if (text.includes("Registering session...")) {
                        return true;
                    }
                }, constants.wait1second * 20, "Restarting the internal MySQL Shell server went wrong");
            } finally {
                E2ELogger.info("<<<<MySQLSH Logs>>>>");
                await Os.writeMySQLshLogs();
            }

        });

        it("Relaunch Welcome Wizard", async () => {

            await dbTreeSection.selectMoreActionsItem(constants.relaunchWelcomeWizard);
            await driver.wait(Workbench.untilTabIsOpened(constants.welcomeTab), constants.wait1second * 5);
            const active = await Workbench.getActiveTab();
            let error = `The active tab should be ${constants.welcomeTab}`;
            error += `, but found ${await active!.getTitle()}`;
            expect(await active!.getTitle(), error).equals(constants.welcomeTab);
            await driver.wait(until.ableToSwitchToFrame(0), constants.wait1second * 5, "Not able to switch to frame 0");
            await driver.wait(until.ableToSwitchToFrame(
                locator.iframe.isActive), constants.wait1second * 5, "Not able to switch to frame 2");
            const text = await driver.findElement(locator.welcomeWizard.title).getText();
            expect(text, `The Welcome wizard title should be ${constants.welcome}, but found ${text}`)
                .equals(constants.welcome);
            expect(await driver.findElement(locator.welcomeWizard.nextButton),
                `Next button does not exist on the welcome wizard`).to.exist;

        });

        it("Reset MySQL Shell for VS Code Extension", async () => {

            await Workbench.closeAllEditors();
            await dbTreeSection.selectMoreActionsItem(constants.resetExtension);
            let notification = "This will completely reset the MySQL Shell for VS Code extension by ";
            notification += "deleting the web certificate and optionally deleting the user settings directory.";
            const ntf = await Workbench.getNotification(notification, false);
            await Workbench.clickOnNotificationButton(ntf, constants.cancel);

        });
    });

    describe("MySQL Administration (Server)", () => {

        const mysqlAdministration = new E2EMySQLAdministration();
        const toolbar = new E2EToolbar();

        before(async function () {
            let hookResult = "passed";
            await Os.appendToExtensionLog("beforeAll MySQL Administration");
            const localE2eRecording: E2ERecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await Os.deleteCredentials();
                await Workbench.closeAllEditors();
                await dbTreeSection.focus();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);

                const treeMySQLAdmin = await dbTreeSection.getTreeItem(constants.mysqlAdmin);
                await treeMySQLAdmin.expand();
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }

        });

        after(async function () {
            const localE2eRecording = new E2ERecording(this.currentTest!.title);
            try {
                await localE2eRecording!.start();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
            } finally {
                await Misc.processResult(this, localE2eRecording);
            }
        });

        it("Server Status", async () => {

            await (await dbTreeSection.getTreeItem(constants.serverStatus)).click();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.serverStatus),
                constants.wait1second * 15);
            expect((await toolbar.editorSelector.getCurrentEditor()).label,
                `The current editor name should be ${constants.serverStatus}`)
                .to.equals(constants.serverStatus);

            await mysqlAdministration.serverStatus.create();
            expect(mysqlAdministration.serverStatus.host).to.not.equals("");
            expect(mysqlAdministration.serverStatus.socket).to.match(/(\.sock|MySQL)/);
            expect(mysqlAdministration.serverStatus.port).to.match(/(\d+)/);
            expect(mysqlAdministration.serverStatus.version).to.match(/(\d+).(\d+).(\d+)/);
            expect(mysqlAdministration.serverStatus.compiledFor).to.not.equals("");
            expect(mysqlAdministration.serverStatus.configurationFile).to.not.equals("");
            expect(mysqlAdministration.serverStatus.runningSince)
                .to.match(/((\d+) (day|days), (\d+) (hour|hours), (\d+) (minute|minutes)|none)/);
            expect(mysqlAdministration.serverStatus.baseDirectory).to.match(/(\\\w+|\/\w+)/);
            expect(mysqlAdministration.serverStatus.dataDirectory).to.match(/(\\\w+|\/\w+)/);
            expect(mysqlAdministration.serverStatus.pluginsDirectory).to.match(/(\\\w+|\/\w+)/);
            expect(mysqlAdministration.serverStatus.tempDirectory).to.match(/(\\\w+|\/\w+)/);
            expect(mysqlAdministration.serverStatus.errorLog.checked).to.be.true;
            expect(mysqlAdministration.serverStatus.errorLog.path).to.match(/(\\\w+|\/\w+)/);
            expect(typeof mysqlAdministration.serverStatus.generalLog.checked).to.equals("boolean");
            expect(mysqlAdministration.serverStatus.generalLog.path).to.not.equals("");
            expect(typeof mysqlAdministration.serverStatus.slowQueryLog.checked).to.equals("boolean");
            expect(mysqlAdministration.serverStatus.slowQueryLog.path).to.not.equals("");
            expect(typeof mysqlAdministration.serverStatus.performanceSchema).to.equals("boolean");
            expect(typeof mysqlAdministration.serverStatus.threadPool).to.equals("boolean");
            expect(mysqlAdministration.serverStatus.memCachedPlugin).to.not.equals("");
            expect(mysqlAdministration.serverStatus.semiSyncRepPlugin).to.not.equals("");
            expect(typeof mysqlAdministration.serverStatus.pamAuthentication).to.equals("boolean");
            expect(typeof mysqlAdministration.serverStatus.passwordValidation).to.equals("boolean");
            expect(typeof mysqlAdministration.serverStatus.auditLog).to.equals("boolean");
            expect(mysqlAdministration.serverStatus.firewall).to.not.equals("");
            expect(mysqlAdministration.serverStatus.firewallTrace).to.not.equals("");
            expect(mysqlAdministration.serverStatus.sslCa.endsWith(".pem")).to.be.true;
            expect(mysqlAdministration.serverStatus.sslCert.endsWith(".pem")).to.be.true;
            expect(mysqlAdministration.serverStatus.sslKey.endsWith(".pem")).to.be.true;
            expect(mysqlAdministration.serverStatus.privateKey).to.equals("private_key.pem");
            expect(mysqlAdministration.serverStatus.publicKey).to.equals("public_key.pem");

        });

        it("Client Connections", async () => {

            await (await dbTreeSection.getTreeItem(constants.clientConns)).click();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.clientConns),
                constants.wait1second * 15);
            expect((await toolbar.editorSelector.getCurrentEditor()).label,
                `The current editor name should be ${constants.clientConns}`)
                .to.equals(constants.clientConns);

            await mysqlAdministration.clientConnections.create();
            expect(mysqlAdministration.clientConnections.threadsConnected).to.match(/Threads Connected: (\d+)/);
            expect(mysqlAdministration.clientConnections.threadsRunning).to.match(/Threads Running: (\d+)/);
            expect(mysqlAdministration.clientConnections.threadsCreated).to.match(/Threads Created: (\d+)/);
            expect(mysqlAdministration.clientConnections.rejected).to.match(/Rejected \(over limit\):/);
            expect(mysqlAdministration.clientConnections.totalConnections).to.match(/Total Connections: (\d+)/);
            expect(mysqlAdministration.clientConnections.connectionLimit).to.match(/Connection Limit: (\d+)/);
            expect(mysqlAdministration.clientConnections.abortedClients).to.match(/Aborted Clients: (\d+)/);
            expect(mysqlAdministration.clientConnections.abortedConnections).to.match(/Aborted Connections: (\d+)/);
            expect(mysqlAdministration.clientConnections.errors).to.match(/Errors: (\d+)/);
            expect((await mysqlAdministration.clientConnections.connectionsList
                .findElements(locator.mysqlAdministration.clientConnections.tableRow)).length).to.be.greaterThan(0);
        });

        it("Performance Dashboard - MLE Disabled", async () => {

            const mleDisabledConn: interfaces.IDBConnection = {
                dbType: "MySQL",
                caption: `conn-port:${parseInt(process.env.MYSQL_1109!, 10)}`,
                description: "Local connection",
                basic: {
                    hostname: "localhost",
                    username: String(process.env.DBUSERNAME1),
                    port: parseInt(process.env.MYSQL_1109!, 10),
                    schema: "sakila",
                    password: String(process.env.DBPASSWORD1),
                },
            };

            await dbTreeSection.clickToolbarButton(constants.collapseAll);
            await Workbench.closeAllEditors();
            await dbTreeSection.createDatabaseConnection(mleDisabledConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(mleDisabledConn.caption!), constants.waitForTreeItem);
            await dbTreeSection.clickTreeItemActionButton(mleDisabledConn.caption!,
                constants.openNewConnectionUsingNotebook);
            await driver.wait(new E2ENotebook().untilIsOpened(mleDisabledConn), constants.waitConnectionOpen);
            await dbTreeSection.expandTreeItem(mleDisabledConn.caption!, mleDisabledConn);
            const treeMySQLAdmin = await dbTreeSection.getTreeItem(constants.mysqlAdmin);
            await dbTreeSection.focus();
            await treeMySQLAdmin.expand();
            await (await dbTreeSection.getTreeItem(constants.perfDash)).click();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.perfDash),
                constants.wait1second * 15);
            expect(await mysqlAdministration.performanceDashboard.tabExists(constants.perfDashMLETab)).to.be.false;

            await mysqlAdministration.performanceDashboard.loadServerPerformance();
            expect(mysqlAdministration.performanceDashboard.networkStatus.incomingNetworkTrafficGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.networkStatus.incomingData).to.match(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.networkStatus.outgoingNetworkTrafficGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.networkStatus.outgoingData).to.match(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.tableCacheGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.threadsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.openObjectsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.cacheEfficiency).to.match(/(\d+)%/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalOpenedTables).to.match(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalTransactions).to.match(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.sqlStatementsExecutedGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalStatements).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.select).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.insert).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.update).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.delete).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.create).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.alter).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.drop).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBBufferPoolGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.checkpointAgeGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.diskReadRatioGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.readRequests).to.match(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.writeRequests).to.match(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.diskReads).to.match(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBDiskWritesGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.logDataWritten).to.match(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.logWrites).to.match(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.writing).to.match(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBDiskReadsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.bufferWrites).to.match(/(\d+) B\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.reading).to.match(/(\d+) B\/s/);
            await Workbench.closeEditor(new RegExp(constants.perfDash));

        });

        it("Performance Dashboard - MLE Enabled", async () => {

            await Workbench.closeAllEditors();
            await dbTreeSection.clickToolbarButton(constants.collapseAll);
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            const treeMySQLAdmin = await dbTreeSection.getTreeItem(constants.mysqlAdmin);
            await treeMySQLAdmin.expand();

            const perfDash = await dbTreeSection.getTreeItem(constants.perfDash);
            await driver.actions().doubleClick(perfDash).perform();
            await driver.wait(mysqlAdministration.untilPageIsOpened(globalConn, constants.perfDash),
                constants.wait1second * 15);
            expect((await toolbar.editorSelector.getCurrentEditor()).label,
                `The current editor name should be ${constants.perfDash}`)
                .to.equals(constants.perfDash);

            await driver.wait(async () => {
                return mysqlAdministration.performanceDashboard.tabExists(constants.perfDashServerTab);
            }, constants.wait1second * 5, `${constants.perfDashServerTab} tab was not found`);

            expect(await mysqlAdministration.performanceDashboard.tabExists(constants.perfDashMLETab)).to.be.true;
            expect(await mysqlAdministration.performanceDashboard.tabIsSelected(constants.perfDashServerTab))
                .to.be.true;

            await mysqlAdministration.performanceDashboard.loadServerPerformance();
            expect(mysqlAdministration.performanceDashboard.networkStatus.incomingNetworkTrafficGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.networkStatus.incomingData).to.match(/(\d+) (KB|B)\/s/);
            expect(mysqlAdministration.performanceDashboard.networkStatus.outgoingNetworkTrafficGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.networkStatus.outgoingData).to.match(/(\d+) (KB|B)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.tableCacheGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.threadsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.openObjectsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.cacheEfficiency).to.match(/(\d+)%/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalOpenedTables).to.match(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalTransactions).to.match(/(\d+)/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.sqlStatementsExecutedGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.totalStatements).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.select).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.insert).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.update).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.delete).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.create).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.alter).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.mysqlStatus.drop).to.match(/(\d+)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBBufferPoolGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.checkpointAgeGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.diskReadRatioGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.readRequests).to.match(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.writeRequests).to.match(/(\d+) pages\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.diskReads).to.match(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBDiskWritesGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.logDataWritten).to.match(/(\d+) (KB|B)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.logWrites).to.match(/(\d+) #\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.writing).to.match(/(\d+) (KB|B)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.innoDBDiskReadsGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.bufferWrites).to.match(/(\d+) (KB|B)\/s/);
            expect(mysqlAdministration.performanceDashboard.innoDBStatus.reading).to.match(/(\d+) (KB|B)\/s/);
            await mysqlAdministration.performanceDashboard.selectTab(constants.perfDashMLETab);

            await driver.wait(async () => {
                await mysqlAdministration.performanceDashboard.loadMLEPerformance();

                return mysqlAdministration.performanceDashboard.mlePerformance.mleStatus === "Inactive";
            }, constants.wait1second * 5, "MLE Status should be Inactive");

            expect(mysqlAdministration.performanceDashboard.mlePerformance.heapUsageGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mlePerformance.mleStatus).to.equals("Inactive");
            expect(mysqlAdministration.performanceDashboard.mlePerformance.mleMaxHeapSize).to.match(/(\d+).(\d+) GB/);
            expect(mysqlAdministration.performanceDashboard.mlePerformance.mleHeapUtilizationGraph).to.exist;
            expect(mysqlAdministration.performanceDashboard.mlePerformance.currentHeapUsage).to.equals("0%");

            await Workbench.closeAllEditors();
            const openEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await (await openEditorsSection.getTreeItem(constants.dbConnectionsLabel)).click();
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption!)).click();

            const notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);

            const jsFunction =
                `CREATE FUNCTION IF NOT EXISTS js_pow(arg1 INT, arg2 INT)
                    RETURNS INT DETERMINISTIC LANGUAGE JAVASCRIPT
                    AS
                    $$
                    let x = Math.pow(arg1, arg2)
                    return x
                    $$;`;


            const result = await notebook.executeWithButton(jsFunction,
                constants.execFullBlockSql) as E2ECommandResultData;
            expect(result.text).to.match(/OK/);

            const result1 = await notebook.codeEditor.execute("SELECT js_pow(2,3);") as E2ECommandResultGrid;
            expect(result1.status).to.match(/OK/);
            await Workbench.closeEditor(new RegExp(constants.dbDefaultEditor));
            await (await dbTreeSection.getTreeItem(constants.perfDash)).click();
            await mysqlAdministration.performanceDashboard.selectTab(constants.perfDashMLETab);

            await driver.wait(async () => {
                await mysqlAdministration.performanceDashboard.loadMLEPerformance();

                return mysqlAdministration.performanceDashboard.mlePerformance.mleStatus === "Active";
            }, constants.wait1second * 5, "MLE Status should be Active");

            const currentHeap = await driver
                .findElement(locator.mysqlAdministration.performanceDashboard.mleStatus.currentHeapUsage);
            await driver.executeScript("arguments[0].scrollIntoView()", currentHeap);
            expect(parseInt(mysqlAdministration.performanceDashboard.mlePerformance.currentHeapUsage
                .match(/(\d+)/)![1], 10)).to.match(/(\d+)/);
        });

    });

    describe("MySQL Administration (Lakehouse Navigator)", () => {

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
            name: "qa_cookbook_ext",
            description: "How do cook properly",
            targetDatabaseSchema: "e2e_tests",
            formats: "PDF (Portable Document Format Files)",
        };

        const fileToUpload = "qa_cookbook_ext.pdf";
        const mysqlAdministration = new E2EMySQLAdministration();

        before(async function () {
            let hookResult = "passed";
            await Os.appendToExtensionLog("beforeAll Lakehouse Navigator");
            const localE2eRecording: E2ERecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                await dbTreeSection.createDatabaseConnection(heatWaveConn);
                await dbTreeSection.expandTreeItem(heatWaveConn.caption!, heatWaveConn);
                const treeMySQLAdmin = await dbTreeSection.getTreeItem(constants.mysqlAdmin);
                await treeMySQLAdmin.expand();
                await dbTreeSection.focus();
                await (await dbTreeSection.getTreeItem(constants.lakehouseNavigator)).click();
                await driver.wait(mysqlAdministration.untilPageIsOpened(heatWaveConn, constants.lakehouseNavigator),
                    constants.wait1second * 15);
                expect(await Workbench.getOpenEditorTitles(), errors.tabIsNotOpened(constants.lakehouseNavigator))
                    .to.include(`${constants.lakehouseNavigator} (${heatWaveConn.caption})`);
                await dbTreeSection.focus();
                await (await dbTreeSection.getTreeItem((heatWaveConn.basic as interfaces.IConnBasicMySQL)
                    .schema!)).expand();
                await (await dbTreeSection.getTreeItem("Tables")).expand();

                if (await dbTreeSection.treeItemExists(newTask.name!)) {
                    await dbTreeSection.openContextMenuAndSelect(newTask.name!, constants.dropTable);
                    await Workbench.pushDialogButton(`Drop ${newTask.name}`);
                    await Workbench.getNotification(`The object ${newTask.name} has been dropped successfully.`);

                    await driver.wait(async () => {
                        return !(await dbTreeSection.treeItemExists(newTask.name!));
                    }, constants.wait1second * 5, `Waiting for ${newTask.name} to not exist`);
                }
                await Workbench.toggleSideBar(false);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }

        });

        after(async function () {
            const localE2eRecording = new E2ERecording(this.currentTest!.title);
            try {
                await localE2eRecording!.start();
                await Workbench.toggleSideBar(true);
                await (await dbTreeSection.getTreeItem((heatWaveConn.basic as interfaces.IConnBasicMySQL)
                    .schema!)).expand();
                await (await dbTreeSection.getTreeItem("Tables")).expand();
                await dbTreeSection.clickTreeItemActionButton(heatWaveConn.caption!,
                    constants.reloadDataBaseInformation);
                await driver.wait(dbTreeSection.untilTreeItemExists(newTask.name!), constants.waitForTreeItem);

                await dbTreeSection.openContextMenuAndSelect(newTask.name!, constants.dropTable);
                await Workbench.pushDialogButton(`Drop ${newTask.name}`);
                await Workbench.getNotification(`The object ${newTask.name} has been dropped successfully.`);
                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(newTask.name!));
                }, constants.wait1second * 5, `Waiting for ${newTask.name} to not exist`);
                await Workbench.closeAllEditors();
            } finally {
                await Misc.processResult(this, localE2eRecording);
            }
        });

        it("Upload data to object storage", async () => {

            const uploadToObjectStorage = mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage;

            await driver.wait(mysqlAdministration.lakeHouseNavigator.overview.untilIsOpened(),
                constants.wait1second * 3);
            await driver.wait(new Condition(`for editor to be ${constants.lakeHouseNavigatorEditor}`, async () => {
                return (await mysqlAdministration.lakeHouseNavigator.toolbar.editorSelector
                    .getCurrentEditor()).label === constants.lakeHouseNavigatorEditor;
            }), constants.wait1second * 3);

            await mysqlAdministration.lakeHouseNavigator.overview.clickUploadFiles();
            await uploadToObjectStorage.objectStorageBrowser.selectOciProfile("HEATWAVE");
            await uploadToObjectStorage.objectStorageBrowser.refreshObjectStorageBrowser();
            await driver.wait(uploadToObjectStorage.objectStorageBrowser.untilItemsAreLoaded(),
                constants.wait1minute);

            await uploadToObjectStorage.objectStorageBrowser
                .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);

            await (await mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage
                .getFilesForUploadButton(constants.addFiles)).click();
            await uploadToObjectStorage.setFilesForUploadFilePath(join(process.cwd(), "lakehouse_nav_files",
                fileToUpload));
            await driver.wait(uploadToObjectStorage.untilExistsFileForUploadFile(fileToUpload),
                constants.wait1second * 10);
            await uploadToObjectStorage.objectStorageBrowser.checkItem("upload");
            await (await uploadToObjectStorage.getFilesForUploadButton(constants.startFileUpload)).click();
            await driver.wait(Workbench.untilNotificationExists("The files have been uploaded successfully"),
                constants.wait1second * 20);
        });

        it("Load into Lakehouse", async () => {

            const loadIntoLakehouse = mysqlAdministration.lakeHouseNavigator.loadIntoLakehouse;
            await mysqlAdministration.lakeHouseNavigator.selectTab(constants.loadIntoLakeHouseTab);
            await driver.wait(loadIntoLakehouse.objectStorageBrowser.untilItemsAreLoaded(),
                constants.wait1second * 10);
            await mysqlAdministration.lakeHouseNavigator.uploadToObjectStorage.objectStorageBrowser
                .openObjectStorageCompartment(["HeatwaveAutoML", "genai-shell-test", "upload"]);
            expect(await loadIntoLakehouse.objectStorageBrowser.existsItem(fileToUpload),
                `'${fileToUpload}' was not found`).to.be.true;
            await loadIntoLakehouse.objectStorageBrowser.checkItem(fileToUpload);
            await driver.wait(loadIntoLakehouse.untilExistsLoadingTask(fileToUpload), constants.wait1second * 5);
            await loadIntoLakehouse.setNewLoadingTask(newTask);
            await loadIntoLakehouse.startLoadingTask();

        });

        it("Lakehouse Tables", async () => {

            const lakehouseTables = mysqlAdministration.lakeHouseNavigator.lakehouseTables;
            await driver.wait(lakehouseTables.untilIsOpened(), constants.wait1second * 15);
            expect(await lakehouseTables.getDatabaseSchemas()).to.contain(newTask.targetDatabaseSchema);
            await driver.wait(lakehouseTables.untilExistsLakeHouseTable(newTask.name!), constants.wait1second * 10);
            await driver.wait(lakehouseTables.untilLakeHouseTableIsLoading(newTask.name!), constants.wait1minute);

            let latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
            expect(latestTable!.hasProgressBar).to.be.true;
            expect(latestTable!.loaded).to.match(/(\d+)%/);
            expect(latestTable!.hasLoadingSpinner).to.be.true;
            expect(latestTable!.rows).to.equals("-");
            expect(latestTable!.size).to.equals("-");
            expect(latestTable!.date).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTable!.comment).to.equals(newTask.description);

            await driver.wait(lakehouseTables.untilLakeHouseTableIsLoaded(newTask.name!), constants.wait1minute * 2);
            latestTable = await lakehouseTables.getLakehouseTable(newTask.name!);
            expect(latestTable!.hasProgressBar).to.be.false;
            expect(latestTable!.loaded).to.equals("Yes");
            expect(latestTable!.hasLoadingSpinner).to.be.false;
            expect(latestTable!.rows).to.match(/(\d+)/);
            expect(latestTable!.size).to.match(/(\d+).(\d+) (KB|MB)/);
            expect(latestTable!.date).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
            expect(latestTable!.comment).to.equals(newTask.description);

            await driver.wait(lakehouseTables.untilLakeHouseTasksAreCompleted(),
                constants.wait1second * 10);
            const tasks = await lakehouseTables.getLakeHouseTasks();

            if (tasks.length > 0) {
                for (const task of tasks) {
                    if (task.name === `Loading ${newTask.name}`) {
                        expect(task.name).to.equals(`Loading ${newTask.name}`);
                        expect(task.status).to.equals("COMPLETED");
                        expect(task.startTime).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                        expect(task.endTime).to.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
                        expect(task.message).to.equals("Task completed.");
                        break;
                    }
                }
            } else {
                // disabled verification
                //throw new Error(`There are not any new tasks to verify`);
            }
        });

    });

    describe("Tree context menu items", () => {

        let treeGlobalSchema: TreeItem;
        let treeGlobalSchemaTables: TreeItem;
        let treeGlobalSchemaViews: TreeItem;
        let treeGlobalConn: TreeItem;
        const dumpFolder = join(constants.workspace, "dump");
        const dumpSchemaToDisk = `dump_schema_to_disk`;
        const schemaForMySQLDbService = "schema_for_mysql_db_service";
        const schemaToDrop = "schema_to_drop";
        const tableToDrop = `table_to_drop`;
        const testView = `test_view`;
        const viewToDrop = "view_to_drop";
        const testRoutine = "test_function";
        const testEvent = "test_event";
        const dup = "duplicatedConnection";
        const tasksTreeSection = new E2EAccordionSection(constants.tasksTreeSection);
        let existsInQueue = false;
        const storedFunction = "storedFunction";
        const storedJSFunction = "storedJSFunction";

        before(async function () {
            let hookResult = "passed";
            await Os.appendToExtensionLog("beforeAll Tree context menu items");
            const localE2eRecording: E2ERecording = new E2ERecording(this.test!.title!);
            try {
                await localE2eRecording!.start();
                await Os.deleteCredentials();
                await dbTreeSection.focus();
                treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.collapse();
                await Workbench.closeAllEditors();
                await dbTreeSection.clickToolbarButton(constants.collapseAll);
                await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            } catch (e) {
                hookResult = "failed";
                throw e;
            } finally {
                await Misc.processResult(this, localE2eRecording, hookResult);
            }
        });


        afterEach(async function () {
            if (existsInQueue) {
                await TestQueue.pop(this.currentTest!.title);
                existsInQueue = false;
            }
        });

        after(async () => {
            await fs.rm(dumpFolder, { force: true, recursive: true });
        });

        it("Set this DB Connection as Default", async () => {

            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.setDBConnDefault);
            await driver.wait(Workbench
                .untilNotificationExists(`"${globalConn.caption!}" has been set as default DB Connection`),
                constants.wait1second * 10);

        });

        it("Open Database Connection", async () => {

            await driver.wait(async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.openNewConnection);
                    await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait1second * 6);

                    return true;
                } catch (e) {
                    if (!(e instanceof error.TimeoutError)) {
                        throw e;
                    }
                }
            }, constants.wait1second * 20, "Could not open the database connection");

        });

        it("Open MySQL Shell Console for this connection", async () => {

            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.openShellConnection);
            await driver.wait(new E2EShellConsole().untilIsOpened(globalConn), constants.waitShellOpen);
            const treeOpenEditorsSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await treeOpenEditorsSection.expand();
            await treeOpenEditorsSection.focus();
            const treeOEShellConsoles = await treeOpenEditorsSection.getTreeItem(constants.mysqlShellConsoles);
            expect(await treeOEShellConsoles.findChildItem(`Session to ${String(globalConn.caption!)}`),
                errors.doesNotExistOnTree(`Session to ${String(globalConn.caption!)}`)).to.exist;

        });

        it("Edit MySQL connection from the tree", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.clickToolbarButton(constants.collapseAll);
            const localConn = Object.assign({}, globalConn);
            localConn.caption = `e2eConnectionToEdit`;
            await dbTreeSection.createDatabaseConnection(localConn);
            await new DatabaseConnectionOverview().getConnection(localConn.caption);
            await dbTreeSection.openContextMenuAndSelect(localConn.caption, constants.editDBConnection);
            await DatabaseConnectionDialog.setConnection(localConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(localConn.caption), constants.waitForTreeItem);

        });

        it("Duplicate a MySQL connection from the tree", async () => {

            const dupConn = Object.assign({}, globalConn);
            dupConn.caption = dup;
            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.duplicateConnection);
            await DatabaseConnectionDialog.setConnection(dupConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(dup), constants.waitForTreeItem);

        });

        it("Delete MySQL connection from the tree", async () => {

            await dbTreeSection.focus();

            for (const connection of [dup, "e2eConnectionToEdit"]) {
                await dbTreeSection.openContextMenuAndSelect(connection, constants.deleteDBConnection);
                await Misc.switchToFrame();
                const dialog = await driver.wait(until.elementLocated(
                    locator.confirmDialog.exists), constants.wait1second * 15, "confirm dialog was not found");
                await dialog.findElement(locator.confirmDialog.accept).click();
                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(connection));
                }, constants.wait1second * 5, `Waiting for ${connection} to not exist on the tree`);
            }

        });

        it("Load SQL Script from Disk", async () => {

            const e2eScript = new E2EScript();
            const script = "2_sakila_cst.sql";
            const destFile = join(constants.workspace, "gui", "frontend", "src", "tests", "e2e", "sql", script);
            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.loadScriptFromDisk);
            await Workbench.setInputPath(destFile);
            await driver.wait(e2eScript.untilIsOpened(globalConn), constants.wait1second * 15);
            await driver.wait(async () => {
                return ((await e2eScript.toolbar.editorSelector.getCurrentEditor()).label) === script;
            }, constants.wait1second * 5, `Current editor is not ${script}`);
            let error = `The current editor type should be 'Mysql',`;
            error += ` but found ${(await e2eScript.toolbar.editorSelector.getCurrentEditor()).icon}`;
            expect((await e2eScript.toolbar.editorSelector.getCurrentEditor()).icon, error)
                .to.include(constants.mysqlScriptIcon);
            const scriptLines = await driver.findElements(locator.notebook.codeEditor.editor.line);
            expect(scriptLines.length, "The script was not loaded. No lines found on the editor").to.be.greaterThan(0);
            await e2eScript.toolbar.editorSelector.selectEditor(new RegExp(constants.openEditorsDBNotebook),
                globalConn.caption!);

        });

        it("Set as Current Database Schema", async () => {

            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            await dbTreeSection.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL).schema!,
                constants.setCurrentDBSchema, undefined, false);
            await driver.wait(dbTreeSection.untilTreeItemIsDefault("sakila"), constants.wait1second * 5);
            await dbTreeSection.clickTreeItemActionButton(globalConn.caption!,
                constants.openNewConnectionUsingNotebook);
            await Workbench.openEditor(globalConn.caption!);

            const notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);

            await notebook.codeEditor.clean();
            let result = await notebook.codeEditor.execute("select database();") as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(await result.resultContext!.getAttribute("innerHTML"))
                .to.match(new RegExp((globalConn.basic as interfaces.IConnBasicMySQL).schema!));

            await dbTreeSection.openContextMenuAndSelect("world_x_cst", constants.setCurrentDBSchema, undefined, false);
            await driver.wait(dbTreeSection.untilTreeItemIsDefault("world_x_cst"), constants.wait1second * 5);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemIsDefault("sakila"));
            }, constants.wait1second * 3, `sakila should not be the default schema on the tree`);

            await Workbench.openEditor(globalConn.caption!);
            await notebook.codeEditor.clean();
            result = await notebook.codeEditor.execute("select database();") as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(await result.resultContext!.getAttribute("innerHTML")).to.match(/world_x_cst/);
            await Workbench.closeAllEditors();

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemIsDefault("world_x_cst"));
            }, constants.wait1second * 5, "world_x_cst should not be the default");

            expect(await dbTreeSection.treeItemIsDefault("sakila"), errors.isDefault("sakila")).to.be.false;
        });

        it("Dump Schema to Disk", async () => {

            treeGlobalSchema = await dbTreeSection.getTreeItem((globalConn.basic as interfaces.IConnBasicMySQL)
                .schema!);
            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await dbTreeSection.openContextMenuAndSelect(dumpSchemaToDisk,
                [constants.dumpToDisk, constants.databaseSchemaDump], constants.schemaCtxMenu);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password!);
            await Workbench.waitForOutputText(`Task 'Dump Schema ${dumpSchemaToDisk} to Disk' completed successfully`,
                constants.wait1second * 10);
            const files = await fs.readdir(dumpFolder);
            expect(files.length, `The dump did not exported any files to ${dumpFolder}`).to.be.greaterThan(0);
            await tasksTreeSection.focus();
            await driver.wait(tasksTreeSection.untilTreeItemExists(`Dump Schema ${dumpSchemaToDisk} to Disk (done)`),
                constants.waitForTreeItem);
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);

            await dbTreeSection.openContextMenuAndSelect(dumpSchemaToDisk, constants.dropSchema);
            await Workbench.pushDialogButton(`Drop ${dumpSchemaToDisk}`);
            await Workbench.getNotification(`The object ${dumpSchemaToDisk} has been dropped successfully.`);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(dumpSchemaToDisk));
            }, constants.waitForTreeItem, `${dumpSchemaToDisk} should not exist on the tree`);

        });

        it("Load Dump from Disk", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.loadDumpFromDisk);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password!);
            await Workbench.waitForOutputText(/Task 'Loading Dump .* from Disk' completed successfully/,
                constants.wait1second * 10);
            await driver.wait(dbTreeSection.untilTreeItemExists(dumpSchemaToDisk), constants.waitForTreeItem);

        });

        it("Dump Schema to Disk for MySQL Database Service", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await fs.rm(dumpFolder, { force: true, recursive: true });
            await fs.mkdir(dumpFolder);
            await dbTreeSection.openContextMenuAndSelect(schemaForMySQLDbService,
                [constants.dumpToDisk, constants.databaseSchemaDumpRest], constants.schemaCtxMenu);
            await Workbench.setInputPath(dumpFolder);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password!);
            await Workbench
                .waitForOutputText(`Task 'Dump Schema ${schemaForMySQLDbService} to Disk for MDS' completed successfully`,
                    constants.wait1second * 10);
            const files = await fs.readdir(dumpFolder);
            expect(files.length, `The dump did not exported any files to ${dumpFolder}`).to.be.greaterThan(0);
        });

        it("Load Data to HeatWave Cluster", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL).schema!,
                constants.loadDataToHW);
            await DatabaseConnectionDialog.setDataToHeatWave();
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password!);
            await Workbench.getNotification("The data load to the HeatWave cluster operation has finished");
            await new BottomBarPanel().toggle(false);

        });

        it("Drop Schema", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect(schemaToDrop, constants.dropSchema);
            const ntfs = await new extWorkbench().getNotifications();

            if (ntfs.length > 0) {
                await Workbench.clickOnNotificationButton(ntfs[ntfs.length - 1], `Drop ${schemaToDrop}')]`);
            } else {
                await Workbench.pushDialogButton(`Drop ${schemaToDrop}`);
            }

            await Workbench.getNotification(`The object ${schemaToDrop} has been dropped successfully.`);
            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(schemaToDrop));
            }, constants.wait1second * 5, `${schemaToDrop} should not exist on the tree`);
        });

        it("Schema - Copy name and create statement to clipboard", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                        .schema!, [constants.copyToClipboard,
                        constants.copyToClipboardName], constants.schemaCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync() === (globalConn.basic as interfaces.IConnBasicMySQL).schema;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The schema name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect((globalConn.basic as interfaces.IConnBasicMySQL)
                        .schema!, [constants.copyToClipboard,
                        constants.copyToClipboardStat], constants.schemaCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().includes("CREATE DATABASE");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The schema create statement was not copied to the clipboard");

        });

        it("Table - Select Rows in DB Notebook", async () => {

            treeGlobalSchema = await dbTreeSection.getTreeItem((globalConn.basic as interfaces.IConnBasicMySQL)
                .schema!);
            await dbTreeSection.focus();
            await treeGlobalSchema.expand();
            treeGlobalSchemaTables = await dbTreeSection.getTreeItem("Tables");
            await treeGlobalSchemaTables.expand();
            await Workbench.closeAllEditors();
            await dbTreeSection.openContextMenuAndSelect("actor", constants.selectRowsInNotebook);
            const notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);
            const result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);

        });

        it("Table - Copy name and create statement to clipboard", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await dbTreeSection.focus();

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect("actor", [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync() === "actor";
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The table name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect("actor", [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().includes("idx_actor_last_name");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The table create statement was not copied to the clipboard");

        });

        it("Drop Table", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect(tableToDrop, constants.dropTable);
            await Workbench.pushDialogButton(`Drop ${tableToDrop}`);
            await Workbench.getNotification(`The object ${tableToDrop} has been dropped successfully.`);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(tableToDrop));
            }, constants.wait1second * 3, `${tableToDrop} should not exist on the tree`);
        });

        it("View - Select Rows in DB Notebook", async () => {

            await dbTreeSection.focus();
            treeGlobalSchemaViews = await dbTreeSection.getTreeItem("Views");
            await treeGlobalSchemaViews.expand();
            await Workbench.closeAllEditors();
            await dbTreeSection.openContextMenuAndSelect(testView, constants.selectRowsInNotebook);
            const notebook = new E2ENotebook();
            await driver.wait(notebook.untilIsOpened(globalConn), constants.waitConnectionOpen);
            const result = await notebook.codeEditor.getLastExistingCommandResult(true) as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            expect(result.status).to.match(/OK, (\d+) records/);
        });

        it("View - Copy name and create statement to clipboard", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await dbTreeSection.focus();
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testView, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync() === testView;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The view name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testView, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.dbObjectCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().includes("DEFINER VIEW");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 25, "The view create statement was not copied to the clipboard");

        });

        it("Drop View", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            await treeGlobalSchema.expand();
            await treeGlobalSchemaViews.expand();
            await dbTreeSection.openContextMenuAndSelect(viewToDrop, constants.dropView);
            await Workbench.pushDialogButton(`Drop ${viewToDrop}`);
            await Workbench.getNotification(`The object ${viewToDrop} has been dropped successfully.`);
            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(viewToDrop));
            }, constants.wait1second * 3, `${viewToDrop} should not exist on the tree`);
        });

        it("Table - Show Data", async () => {

            await dbTreeSection.focus();
            await Workbench.closeAllEditors();
            await dbTreeSection.openContextMenuAndSelect("actor", constants.showData);
            const e2eScript = new E2EScript();
            await driver.wait(e2eScript.untilIsOpened(globalConn), constants.waitConnectionOpen);
            const result = await e2eScript.getResult() as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.wait(result.untilIsMaximized(), constants.wait1second * 5);

        });

        it("View - Show Data", async () => {

            await dbTreeSection.focus();
            await Workbench.closeAllEditors();
            await dbTreeSection.openContextMenuAndSelect(testView, constants.showData);
            const script = new E2EScript();
            await driver.wait(script.untilIsOpened(globalConn), constants.wait1second * 15);
            const result = await script.getResult() as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await driver.wait(result.untilIsMaximized(), constants.wait1second * 5);
        });

        it("Functions - Clipboard", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            await dbTreeSection.focus();
            await (await dbTreeSection.getTreeItem("performance_schema")).collapse();

            await (await dbTreeSection.getTreeItem("Tables")).collapse();
            const treeRoutines = await dbTreeSection.getTreeItem("Functions");
            await treeRoutines.expand();
            await driver.wait(dbTreeSection.untilTreeItemExists(testRoutine), constants.waitForTreeItem);
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardName], constants.routinesCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");

                    return clipboard.readSync() === testRoutine;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }

            }), constants.wait1second * 15, "The routine name was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardStat], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("CREATE DEFINER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 15, "The routine create statement was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardStatDel], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DELIMITER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 15,
                "The routine create statement with delimiters was not copied to the clipboard");

            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(testRoutine, [constants.copyToClipboard,
                    constants.copyToClipboardDropStatDel], constants.routinesCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");

                    return clipboard.readSync().includes("DROP") && clipboard.readSync().includes("DELIMITER");
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 15,
                "The routine drop & create statement with delimiters was not copied to the clipboard");

        });

        it("Create Stored Function", async () => {

            await dbTreeSection.expandTreeItem("sakila");
            await dbTreeSection.openContextMenuAndSelect("Functions", constants.createStoredFunction);
            await Workbench.setInputPath(storedFunction);
            const script = new E2EScript();
            await driver.wait(script.untilIsOpened(globalConn), constants.wait1second * 10);
            await driver.wait(async () => {
                return script.toolbar.existsButton(constants.execFullScript);
            }, constants.wait1second * 5, `Could not find button '${constants.execFullScript}'`);

            await (await script.toolbar.getButton(constants.execFullScript))!.click();

            await driver.wait(async () => {
                return (await script.getResult() as E2ECommandResultGrid).status !== undefined;
            }, constants.wait1second * 5, `Result status is undefined`);

            const result = await script.getResult() as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await Workbench.closeAllEditors();
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem("Functions");
            await driver.wait(dbTreeSection.untilTreeItemExists(storedFunction), constants.wait1second * 5);

        });

        it("Create Stored Javascript Function", async () => {

            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect("Functions", constants.createStoredJSFunction);
            await Workbench.setInputPath(storedJSFunction);
            const script = new E2EScript();
            await driver.wait(script.untilIsOpened(globalConn), constants.wait1second * 10);
            await driver.wait(async () => {
                return script.toolbar.existsButton(constants.execFullScript);
            }, constants.wait1second * 5, `Could not find button '${constants.execFullScript}'`);
            await (await script.toolbar.getButton(constants.execFullScript))!.click();

            await driver.wait(async () => {
                return (await script.getResult() as E2ECommandResultGrid).status !== undefined;
            }, constants.wait1second * 5, `Result status is undefined`);

            const result = await script.getResult() as E2ECommandResultGrid;
            expect(result.status).to.match(/OK/);
            await Workbench.closeAllEditors();
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem("Functions");
            await driver.wait(dbTreeSection.untilTreeItemExists(storedJSFunction), constants.wait1second * 5);
        });

        it("Functions - Drop Functions", async () => {

            for (const routine of [storedFunction, storedJSFunction]) {
                await dbTreeSection.openContextMenuAndSelect(routine, constants.dropStoredRoutine);
                await Workbench.pushDialogButton(`Drop ${routine}`);
                await Workbench.getNotification(`The object ${routine} has been dropped successfully.`);
                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(routine));
                }, constants.wait1second * 3, `${routine} should not exist on the tree`);
            }
        });

        it("Drop Event", async () => {

            const treeRoutines = await dbTreeSection.getTreeItem("Functions");
            await treeRoutines.collapse();
            const treeEvents = await dbTreeSection.getTreeItem("Events");
            await treeEvents.expand();
            await driver.wait(dbTreeSection.untilTreeItemExists(testEvent), constants.waitForTreeItem);
            await dbTreeSection.openContextMenuAndSelect(testEvent, constants.dropEvent);
            await Workbench.pushDialogButton(`Drop ${testEvent}`);
            await Workbench.getNotification(`The object ${testEvent} has been dropped successfully.`);
            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(testEvent));
            }, constants.wait1second * 3, `${testEvent} should not exist on the tree`);

        });

        it("Create JavaScript Library", async () => {

            await dbTreeSection.clickToolbarButton(constants.collapseAll);
            await Workbench.closeAllEditors();
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);

            const library = "test_js_library";
            await dbTreeSection.expandTreeItem("sakila");
            await dbTreeSection.expandTreeItem("Libraries");
            await dbTreeSection.openContextMenuAndSelect(constants.libraries, constants.createJSLibrary);
            await Workbench.setInputPath(library);
            const e2eScript = new E2EScript();
            await driver.wait(e2eScript.untilIsOpened(globalConn), constants.wait1second * 10);
            const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await driver.wait(openEditorsTreeSection.untilTreeItemExists("New Library"), constants.wait1second * 5);
            await openEditorsTreeSection.collapse();
            await (await e2eScript.toolbar.getButton(constants.execFullScript))!.click();
            await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);
            await driver.wait(dbTreeSection.untilTreeItemExists(library), constants.wait1second * 5);

        });

        it("Create JavaScript Library From File", async () => {

            const library = "test_js_library_from_file";
            await fs.writeFile(join(process.cwd(), `${library}.js`), `
                export function f(x, y) { return x + y; }
                export function g() { return 42; }
            `);
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem("sakila");
            await dbTreeSection.expandTreeItem("Libraries");
            await dbTreeSection.openContextMenuAndSelect(constants.libraries, constants.createLibraryFrom);
            await driver.wait(new E2EScript().untilIsOpened(globalConn), constants.wait1second * 10);
            const createLibraryDialog = await new CreateLibraryDialog().untilExists();
            await createLibraryDialog.setLibraryName(library);
            await createLibraryDialog.setPath(join(process.cwd(), `${library}.js`));
            await createLibraryDialog.ok();
            Workbench.untilNotificationExists(`JavaScript library ${library} successfully created!`);
            await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);
            await driver.wait(dbTreeSection.untilTreeItemExists(library), constants.wait1second * 5);

        });

        it("Create JavaScript Library From URL", async () => {

            const library = "test_js_library_from_url";
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem("sakila");
            await dbTreeSection.expandTreeItem("Libraries");
            await dbTreeSection.openContextMenuAndSelect(constants.libraries, constants.createLibraryFrom);
            await driver.wait(new E2EScript().untilIsOpened(globalConn), constants.wait1second * 10);
            const createLibraryDialog = await new CreateLibraryDialog().untilExists();
            await createLibraryDialog.setLibraryName(library);
            await createLibraryDialog.setLoadFrom("URL");
            await createLibraryDialog.setURL("https://cdn.jsdelivr.net/npm/validator@13.15.15/+esm");
            await createLibraryDialog.ok();
            Workbench.untilNotificationExists(`JavaScript library ${library} successfully created!`);

            await driver.wait(async () => {
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);

                return dbTreeSection.treeItemExists(library);
            }, constants.wait1second * 5, `${library} does not exist on the tree`);
        });

        it("Create WebAssembly Library From File", async () => {

            const libraryFile = "library.wasm";
            const libraryName = "test_web_assembly_from_file";
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem("sakila");
            await dbTreeSection.expandTreeItem("Libraries");
            await dbTreeSection.openContextMenuAndSelect(constants.libraries, constants.createLibraryFrom);
            await driver.wait(new E2EScript().untilIsOpened(globalConn), constants.wait1second * 10);
            const createLibraryDialog = await new CreateLibraryDialog().untilExists();
            await createLibraryDialog.setLibraryName(libraryName);
            await createLibraryDialog.setLanguage("WebAssembly");
            await createLibraryDialog.setPath(join(process.cwd(), "test_files", `${libraryFile}`));
            await createLibraryDialog.ok();
            Workbench.untilNotificationExists(`WebAssembly library ${libraryName} successfully created!`);
            await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);
            await driver.wait(dbTreeSection.untilTreeItemExists(libraryName), constants.wait1second * 5);

        });

        it("Edit Library", async () => {

            const library = "test_js_library";
            const newLibrary = "new_test_js_library";
            await Workbench.closeAllEditors();
            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect(library, constants.editLibrary);
            const e2eScript = new E2EScript();
            await driver.wait(e2eScript.untilIsOpened(globalConn), constants.wait1second * 10);
            const openEditorsTreeSection = new E2EAccordionSection(constants.openEditorsTreeSection);
            await driver.wait(openEditorsTreeSection.untilTreeItemExists("Edit Library"), constants.wait1second * 5);
            await openEditorsTreeSection.collapse();
            await e2eScript.codeEditor.clean();
            await e2eScript.codeEditor.write(`
            DELIMITER ;
            DROP LIBRARY \`sakila\`.\`${library}\`;
            CREATE LIBRARY \`sakila\`.\`${newLibrary}\`
                LANGUAGE JAVASCRIPT
            AS $$
            export function f(x, y) { return x + y; }
            export function g() { return 42; }
            $$;
            DELIMITER ;`);
            await (await e2eScript.toolbar.getButton(constants.execFullScript))!.click();
            await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);
            await dbTreeSection.focus();
            await driver.wait(dbTreeSection.untilTreeItemExists(newLibrary), constants.wait1second * 5);
        });

        it("Library - Copy to Clipboard", async function () {

            await TestQueue.push(this.test!.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test!.title), constants.queuePollTimeout);

            const libraryName = "test_js_library_from_file";

            await dbTreeSection.focus();
            // NAME
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(libraryName,
                        [constants.copyToClipboard, constants.copyToClipboardName], constants.libraryCtxMenu);
                    await Workbench.getNotification("The name was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync() === libraryName;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 10, "The Library name was not copied to the clipboard");

            // CREATE STATEMENT
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(libraryName,
                        [constants.copyToClipboard, constants.copyToClipboardStat], constants.libraryCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().match(/CREATE LIBRARY/) !== null;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 10, "The Create Statement was not copied to the clipboard");

            // CREATE STATEMENT WITH DELIMITERS
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(libraryName,
                        [constants.copyToClipboard, constants.copyToClipboardStatDel], constants.libraryCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().match(/DELIMITER[\s\S]*?CREATE LIBRARY/) !== null;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 10, "The Create Statement with DELIMITERS was not copied to the clipboard");

            // DROP & CREATE STATEMENT WITH DELIMITERS
            await driver.wait(new Condition("", async () => {
                try {
                    await dbTreeSection.openContextMenuAndSelect(libraryName,
                        [constants.copyToClipboard, constants.copyToClipboardDropStatDel], constants.libraryCtxMenu);
                    await Workbench.getNotification("The create script was copied to the system clipboard");
                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);

                    return clipboard.readSync().match(/DELIMITER[\s\S]*?DROP.*[\s\S]*?CREATE LIBRARY/) !== null;
                } catch (e) {
                    if (!(errors.isStaleError(e as Error))) {
                        throw e;
                    }
                }
            }), constants.wait1second * 10, "Drop & Create Statement with DELIMITERS was not copied to the clipboard");

        });

        it("Drop Library", async () => {

            const libraryName = "test_js_library_from_file";
            await dbTreeSection.focus();
            await dbTreeSection.openContextMenuAndSelect(libraryName, constants.dropLibrary);
            await Workbench.pushDialogButton(`Drop ${libraryName}`);
            await driver.wait(Workbench
                .untilNotificationExists(`The object ${libraryName} has been dropped successfully`));

            await driver.wait(async () => {
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption!,
                    constants.reloadDataBaseInformation);

                return !(await dbTreeSection.treeItemExists(libraryName));
            }, constants.wait1second * 5, `${libraryName} should not exist on the tree`);

        });

    });

});
