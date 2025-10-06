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

import * as fs from "fs/promises";
import { expect } from "chai";
import { hostname } from "os";
import { existsSync } from "fs";
import { Os } from "../lib/Os";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Workbench } from "../lib/Workbench";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { RestServiceDialog } from "../lib/WebViews/Dialogs/RestServiceDialog";
import { RestSchemaDialog } from "../lib/WebViews/Dialogs/RestSchemaDialog";
import { RestObjectDialog } from "../lib/WebViews/Dialogs/RestObjectDialog";
import { E2ERecording } from "../lib/E2ERecording";

let actorId: string;
let response: Response;

const crudService: interfaces.IRestService = {
    servicePath: `/crudService`,
    published: true,
    enabled: true,
    advanced: {
    },
};

const crudSchema: interfaces.IRestSchema = {
    restSchemaPath: `/sakila`,
    accessControl: constants.accessControlEnabled,
    requiresAuth: false,
    settings: {
        schemaName: "sakila",
    },
};

const crudObject: interfaces.IRestObject = {
    requiresAuth: false,
    restObjectPath: "/actor",
    dataMapping: {
        dbObject: "actor",
        crud: {
            insert: true,
            update: true,
            delete: true,
        },
    },
};

let baseUrl: string;

describe("Router", () => {

    const globalConn: interfaces.IDBConnection = {
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

    let routerPort: string | undefined;
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);
    let e2eRecording: E2ERecording | undefined = new E2ERecording();

    before(async function () {

        await Misc.loadDriver();
        const localE2eRecording: E2ERecording = new E2ERecording();
        let hookResult = "passed";
        try {
            await localE2eRecording!.start(this.test!.title!);
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Workbench.toggleBottomBar(false);
            Misc.removeDatabaseConnections();

            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.waitForTreeItem);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption!)).click();
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait1second * 10);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.waitForTreeItem);
            await Os.deleteCredentials();
            await dbTreeSection.focus();
            await dbTreeSection.expandTreeItem(globalConn.caption!, globalConn);
            await Workbench.dismissNotifications();
        } catch (e) {
            hookResult = "failed";
            throw e;
        } finally {
            await Misc.processResult(this, localE2eRecording, hookResult);
        }
    });

    beforeEach(async function () {
        await Os.appendToExtensionLog(String(this.currentTest!.title) ?? process.env.TEST_SUITE);
        await e2eRecording!.start(this.currentTest!.title);
    });

    afterEach(async function () {
        await Misc.processResult(this, e2eRecording);
    });

    after(async function () {
        const localE2eRecording: E2ERecording = new E2ERecording();
        try {
            await localE2eRecording!.start(this.currentTest!.title);
            await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.killRouters);
            Misc.removeDatabaseConnections();
        } finally {
            await Misc.processResult(this, localE2eRecording);
        }
    });


    it("Bootstrap Local MySQL Router Instance", async () => {

        Os.killRouterFromTerminal();
        const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
        await treeMySQLRestService.expand();
        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.bootstrapRouter);
        await Workbench.waitForTerminalText("Please enter MySQL password for root:", constants.wait1second * 10);
        await Workbench.execOnTerminal((globalConn.basic as interfaces.IConnBasicMySQL).password!,
            constants.wait1second * 10);
        await Workbench.waitForTerminalText("JWT secret:", constants.wait1second * 10);
        await Workbench.execOnTerminal("1234", constants.wait1second * 10);
        await Workbench.waitForTerminalText("Once the MySQL Router is started", constants.wait1second * 10);
        expect(await Workbench.terminalHasErrors(), "Terminal has errors").to.be.false;
        await dbTreeSection.expandTreeItem(constants.mysqlRouters);
        await dbTreeSection.clickTreeItemActionButton(globalConn.caption!, constants.reloadDataBaseInformation);
        await driver.wait(dbTreeSection.untilTreeItemExists(new RegExp(hostname())), constants.waitForTreeItem);
        await Os.setRouterConfigFile({
            sinks: "filelog",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            logging_folder: process.cwd(),
        });
        routerPort = await Os.getValueFromRouterConfigFile("port");
    });

    it("Create the Rest Service with the Router hostname", async () => {

        crudSchema.restServicePath = crudService.servicePath;
        crudObject.restServicePath = crudService.servicePath;
        baseUrl = `https://127.0.0.1:${routerPort}`;
        baseUrl += `${crudService.servicePath}${crudSchema.restSchemaPath}`;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
        await RestServiceDialog.set(crudService);
        await driver.wait(Workbench.untilNotificationExists("The MRS service has been created"),
            constants.wait1second * 20);
        await dbTreeSection.expandTreeItem(constants.mysqlRestService);
        await dbTreeSection.openContextMenuAndSelect(new RegExp(crudService.servicePath),
            constants.setAsCurrentREST);
        await driver.wait(Workbench
            .untilNotificationExists("The MRS service has been set as the new default service."),
            constants.wait1second * 10);

        await dbTreeSection.openContextMenuAndSelect(crudSchema.settings!.schemaName!, constants.addSchemaToREST);
        await RestSchemaDialog.set(crudSchema);
        await driver.wait(Workbench.untilNotificationExists("The MRS schema has been added successfully."),
            constants.wait1second * 10);

        await dbTreeSection.clickToolbarButton(constants.reloadConnections);
        await driver.wait(dbTreeSection.untilIsNotLoading(), constants.waitSectionNoProgressBar);
        await dbTreeSection.expandTreeItem(new RegExp(crudService.servicePath));
        await dbTreeSection.expandTreeItem(new RegExp(crudSchema.restSchemaPath!));

        await (await dbTreeSection.getTreeItem(constants.restAuthenticationApps)).collapse();
        await dbTreeSection.expandTreeItem(crudSchema.settings!.schemaName!);
        await dbTreeSection.expandTreeItem("Tables");

        await dbTreeSection.openContextMenuAndSelect(crudObject.dataMapping!.dbObject!,
            constants.addDBObjToREST);
        await RestObjectDialog.set(crudObject);
        await Workbench.dismissNotifications();
    });

    it("Start Local MySQL Router Instance", async () => {

        const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
        await treeMySQLRestService.expand();
        const logFile = await Os.getRouterLogFile();

        if (existsSync(logFile)) {
            await fs.truncate(logFile);
        }

        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.startRouter);
        await driver.wait(Os.untilRouterLogFileExists(), constants.wait1second * 5);
        await driver.wait(Os.untilRouterIsActive(), constants.wait1second * 20);
    });

    it("Get object data", async () => {
        response = await fetch(`${baseUrl}${crudObject.restObjectPath}`);
        const data = await response.json();
        expect(response.ok, `response should be OK`).to.be.true;
        expect(data.items[0].firstName).to.equals("PENELOPE");
    });

    it("Insert table row", async () => {
        response = await fetch(`${baseUrl}${crudObject.restObjectPath}`, {
            method: "post",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            body: JSON.stringify({
                firstName: "Doctor", lastName: "Testing",
                lastUpdate: "2023-01-01 00:02:00",
            }),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        expect(response.ok, `response should be OK`).to.be.true;
        actorId = data.actorId;
        expect(data.actorId).to.exist;
        expect(data.firstName).to.equals("Doctor");
        expect(data.lastName).to.equals("Testing");
        expect(data.lastUpdate).to.exist;
    });

    it("Update table row", async () => {

        const bodyContent = JSON.stringify({
            actorId,
            firstName: "Mister",
            lastName: "Test",
            lastUpdate: "2023-06-23 13:32:54",
        });

        response = await fetch(encodeURI(`${baseUrl}${crudObject.restObjectPath}/${actorId}`), {
            method: "PUT",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            body: bodyContent,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();

        expect(actorId).to.exist;
        expect(data.firstName).to.equals("Mister");
        expect(data.lastName).to.equals("Test");
        expect(data.lastUpdate).to.exist;
    });

    it("Delete table row", async () => {
        const query = `"actorId":${actorId}`;
        response = await fetch(encodeURI(`${baseUrl}${crudObject.restObjectPath}?q={${query}}`),
            {
                method: "delete",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });

        const data = await response.json();
        expect(response.ok, `response should be OK`).to.be.true;
        expect(data.itemsDeleted).to.equals(1);
    });

    it("Filter object data", async () => {
        const query = `"firstName":"PENELOPE"`;
        response = await fetch(encodeURI(`${baseUrl}${crudObject.restObjectPath}?q={${query}}`),
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            },
        );
        const data = await response.json();
        expect(response.ok, `response should be OK`).to.be.true;
        expect(data.items).to.exist;
    });

    it("Stop Local MySQL Router Instance", async () => {
        const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
        await treeMySQLRestService.expand();
        await fs.truncate(await Os.getRouterLogFile());
        await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.stopRouter,
            undefined, false);
        await driver.wait(Os.untilRouterIsInactive(), constants.wait1second * 20);
    });

    it("Delete Router", async () => {
        await dbTreeSection.expandTreeItem(constants.mysqlRouters);
        const router = await dbTreeSection.getTreeItem(new RegExp(hostname()));
        const routerName = await router.getLabel();
        await dbTreeSection.openContextMenuAndSelect(routerName, constants.deleteRouter);
        const ntf = await Workbench
            .getNotification(`Are you sure the MRS router ${routerName} should be deleted?`,
                false);
        await Workbench.clickOnNotificationButton(ntf, "Yes");
        await driver.wait(Workbench.untilNotificationExists("The MRS Router has been deleted successfully."),
            constants.wait1second * 5);
        await dbTreeSection.clickToolbarButton(constants.reloadConnections);
        expect(await dbTreeSection.treeItemHasRedMark(constants.mysqlRestService)).to.equals(false);
    });

});
