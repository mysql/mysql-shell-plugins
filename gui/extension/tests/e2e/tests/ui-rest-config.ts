/*
 * Copyright (c) 2025 Oracle and/or its affiliates.
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
import { expect } from "chai";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { TestQueue } from "../lib/TestQueue";
import { ConfigRestServiceDialog } from "../lib/WebViews/Dialogs/ConfigRestServiceDialog";
import { E2ECommandResultData } from "../lib/WebViews/CommandResults/E2ECommandResultData";

describe("MySQL REST Service Configuration", () => {
    let existsInQueue = false;
    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: `conn-port:${parseInt(process.env.MYSQL_1110, 10)}`,
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_1110, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Os.appendToExtensionLog("beforeAll Rest Config");
            await Workbench.toggleBottomBar(false);
            Misc.removeDatabaseConnections();
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption), constants.waitForTreeItem);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption)).click();
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait1second * 10);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption), constants.waitForTreeItem);
            await Os.deleteCredentials();
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem(globalConn.caption, globalConn);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    beforeEach(async function () {
        await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
        try {
            await driver.wait(dbTreeSection.untilIsNotLoading(), constants.waitSectionNoProgressBar,
                `${constants.dbTreeSection} is still loading`);
            await Workbench.dismissNotifications();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    afterEach(async function () {
        if (this.currentTest.state === "failed") {
            await Misc.processFailure(this);
        }
        if (existsInQueue) {
            await TestQueue.pop(this.currentTest.title);
            existsInQueue = false;
        }
        await Workbench.dismissNotifications();
        const result = await new E2ENotebook().codeEditor
            .execute("DROP SCHEMA IF EXISTS mysql_rest_service_metadata;") as E2ECommandResultData;
        expect(result.text).to.match(/OK/);
        await dbTreeSection.clickToolbarButton(constants.reloadConnections);
    });

    after(async function () {
        try {
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    it("Add new Configuration with Authentication App", async () => {
        const mrsConfig: interfaces.IRestServiceConfig = {
            status: "disabled",
            authentication: {
                createDefaultApp: true,
                username: "newApp",
                password: "Guidev!1",
            },
        };
        await dbTreeSection.openContextMenuAndSelect(globalConn.caption, constants.configureInstanceForRestService);
        await ConfigRestServiceDialog.set(mrsConfig);
        await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
            constants.wait1second * 120);
        await driver.wait(dbTreeSection.untilTreeItemExists(constants.mysqlRestService), constants.waitForTreeItem);
        await dbTreeSection.expandTreeItem(constants.mysqlRestService);
        await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
        await driver.wait(dbTreeSection.untilTreeItemExists("MRS"), constants.wait1second * 5);
        expect(await dbTreeSection.treeItemExists("MySQL")).to.be.true;
    });

    it("Add new Configuration without Authentication app", async () => {
        const mrsConfig: interfaces.IRestServiceConfig = {
            status: "enabled",
            authentication: {
                createDefaultApp: false,
            },
        };
        await dbTreeSection.openContextMenuAndSelect(globalConn.caption, constants.configureInstanceForRestService);
        await ConfigRestServiceDialog.set(mrsConfig);
        await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
            constants.wait1second * 25);
        await driver.wait(dbTreeSection.untilTreeItemExists(constants.mysqlRestService), constants.waitForTreeItem);
        await dbTreeSection.expandTreeItem(constants.mysqlRestService);
        await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
        expect(await dbTreeSection.treeItemExists("MRS")).to.be.false;
        expect(await dbTreeSection.treeItemExists("MySQL")).to.be.true;
    });

    it("Edit existing configuration", async () => {
        const config: interfaces.IRestServiceConfig = {
            status: "enabled",
            authentication: {
                createDefaultApp: false,
            },
        };
        await dbTreeSection.openContextMenuAndSelect(globalConn.caption, constants.configureInstanceForRestService);
        await ConfigRestServiceDialog.set(config);
        await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
            constants.wait1second * 10);
        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.configureRestService);
        const mrsConfig: interfaces.IRestServiceConfig = {
            status: "Disabled",
            authenticationThrottling: {
                preAccountThrottling: {
                    minTimeBetweenRequests: "800",
                    maxAttemptsPerMinute: "250",
                },
                perHostThrottling: {
                    minTimeBetweenRequests: "210",
                    maxAttemptsPerMinute: "303",
                },
                throttlingGeneral: {
                    blockTimeout: "155",
                },
            },
            caches: {
                endPointResponseCache: "3M",
                staticFileCache: "5M",
                gtidCache: true,
                refreshRate: "15",
                refreshWhenIncreased: "110",
            },
            redirectsStaticContent: {
                endPointResponseCacheOptions: [{
                    name: "ack1",
                    value: "test",
                },
                {
                    name: "ack2",
                    value: "test",
                }],
                defaultRedirects: [{
                    name: "ack1",
                    value: "test",
                },
                {
                    name: "ack2",
                    value: "test",
                }],
            },
            options: `{"key11":"value12"}`,
        };
        await ConfigRestServiceDialog.set(mrsConfig);
        await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
            constants.wait1second * 10);
        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.configureRestService);
        const newConfig = await ConfigRestServiceDialog.get();
        expect(mrsConfig.status).to.equals(newConfig.status);
        expect(mrsConfig.authenticationThrottling.preAccountThrottling)
            .to.deep.equals(newConfig.authenticationThrottling.preAccountThrottling);
        expect(mrsConfig.authenticationThrottling.perHostThrottling)
            .to.deep.equals(newConfig.authenticationThrottling.perHostThrottling);
        expect(mrsConfig.authenticationThrottling.throttlingGeneral)
            .to.deep.equals(newConfig.authenticationThrottling.throttlingGeneral);
        expect(mrsConfig.caches).to.deep.equals(newConfig.caches);
        for (const option of mrsConfig.redirectsStaticContent.endPointResponseCacheOptions) {
            expect(newConfig.redirectsStaticContent.endPointResponseCacheOptions).to.deep.include(option);
        }
        for (const option of mrsConfig.redirectsStaticContent.defaultRedirects) {
            expect(newConfig.redirectsStaticContent.defaultRedirects).to.deep.include(option);
        }
        expect(mrsConfig.options).to.equals(newConfig.options);
    });

    it("Upgrade MRS version", async () => {
        await dbTreeSection.openContextMenuAndSelect(globalConn.caption, constants.configureInstanceForRestService);
        const msrVersions = (await ConfigRestServiceDialog.getMRSVersions()).reverse();
        let mrsConfig: interfaces.IRestServiceConfig = {
            currentVersion: msrVersions[0],
            authentication: {
                createDefaultApp: false,
            },
        };
        await ConfigRestServiceDialog.set(mrsConfig);
        await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
            constants.wait1second * 10);
        for (const mrsVersion of msrVersions.slice(1)) {
            mrsConfig = {
                updateToVersion: mrsVersion,
            };
            await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService,
                constants.configureRestService);
            await ConfigRestServiceDialog.set(mrsConfig);
            await driver.wait(Workbench.untilNotificationExists("MySQL REST Service configured successfully."),
                constants.wait1second * 10);
        }
    });
});
