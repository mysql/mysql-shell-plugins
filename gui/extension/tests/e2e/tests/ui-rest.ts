/*
 * Copyright (c) 2022, 2024 Oracle and/or its affiliates.
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
import * as fs from "fs/promises";
import { expect } from "chai";
import { BottomBarPanel, ModalDialog } from "vscode-extension-tester";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import { hostname } from "os";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { RestServiceDialog } from "../lib/WebViews/Dialogs/RestServiceDialog";
import { RestObjectDialog } from "../lib/WebViews/Dialogs/RestObjectDialog";
import { RestSchemaDialog } from "../lib/WebViews/Dialogs/RestSchemaDialog";
import { AuthenticationAppDialog } from "../lib/WebViews/Dialogs/AuthenticationAppDialog";
import { RestUserDialog } from "../lib/WebViews/Dialogs/RestUserDialog";
import { ExportSDKDialog } from "../lib/WebViews/Dialogs/ExportSDKDialog";
import { TestQueue } from "../lib/TestQueue";


describe("MySQL REST Service", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eGlobalConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const schemaToDump = "dummyschema";
    const tableToDump = "abc";
    const actorTable = "actor";
    let routerPort: string;
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);
            await Workbench.toggleBottomBar(false);
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption), constants.wait5seconds);
            await (await new DatabaseConnectionOverview().getConnection(globalConn.caption)).click();
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption), constants.wait5seconds);
            await Os.deleteCredentials();
            await dbTreeSection.tree.configureMySQLRestService(globalConn);
            const treeGlobalConn = await dbTreeSection.tree.getElement(globalConn.caption);
            await dbTreeSection.tree.expandDatabaseConnection(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await dbTreeSection.tree.openContextMenuAndSelect(treeGlobalConn, constants.showSystemSchemas);
            await driver.wait(dbTreeSection.tree.untilExists("mysql_rest_service_metadata"), constants.wait5seconds);
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Main Context Menus", () => {

        before(async () => {
            await Os.deleteCredentials();
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        after(async function () {
            try {
                routerPort = await Os.getValueFromRouterConfigFile("port");
                await new BottomBarPanel().toggle(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Disable MySQL REST Service", async () => {

            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.disableRESTService);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.reloadConnections);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await dbTreeSection.tree.isMRSDisabled(treeMySQLRestService)) === true;
            }, constants.wait5seconds, "MySQL REST Service was not disabled");
        });

        it("Enable MySQL REST Service", async () => {

            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.enableRESTService);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.reloadConnections);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await dbTreeSection.tree.isMRSDisabled(treeMySQLRestService)) === false;
            }, constants.wait5seconds, "MySQL REST Service was not enabled");

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            Os.killRouterFromTerminal();
            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await treeMySQLRestService.expand();
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.bootstrapRouter);
            await Workbench.waitForTerminalText("Please enter MySQL password for root:", constants.wait10seconds);
            await Workbench.execOnTerminal((globalConn.basic as interfaces.IConnBasicMySQL).password,
                constants.wait10seconds);
            await Workbench.waitForTerminalText("JWT secret:", constants.wait10seconds);
            await Workbench.execOnTerminal("1234", constants.wait10seconds);
            await Workbench.waitForTerminalText("Once the MySQL Router is started", constants.wait10seconds);
            expect(await Workbench.terminalHasErrors(), "Terminal has errors").to.be.false;
            await driver.wait(dbTreeSection.tree.untilExists(new RegExp(hostname())), constants.wait5seconds);
            const router = await dbTreeSection.tree.getElement(new RegExp(hostname()));
            expect(await dbTreeSection.tree.routerHasError(router), "Please update Router").to.be.false;
            await driver.wait(dbTreeSection.tree.untilRouterIsInactive(), constants.wait20seconds);
            await Os.setRouterConfigFile({
                sinks: "filelog",
            });
        });

        it("Start Local MySQL Router Instance", async () => {

            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await treeMySQLRestService.expand();
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.startRouter);
            await driver.wait(dbTreeSection.tree.untilRouterIsActive(), constants.wait20seconds);
        });

        it("Stop Local MySQL Router Instance", async () => {
            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await treeMySQLRestService.expand();
            await fs.truncate(await Os.getRouterLogFile());
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.stopRouter);
            await driver.wait(dbTreeSection.tree.untilRouterIsInactive(), constants.wait20seconds);
        });

        it("Browse the MySQL REST Service Documentation", async () => {

            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.browseRESTDocs);
            try {
                await driver.wait(async () => {
                    await Misc.switchBackToTopFrame();
                    await Misc.switchToFrame();
                    const titles = await driver.findElements(locator.mrsDocumentation.title);
                    for (const title of titles) {
                        if ((await title.getText()).includes("MRS Developer's Guide")) {
                            return true;
                        }
                    }
                }, constants.wait5seconds, "Could not find the title 'MRS Developer's Guide'");
            } finally {
                await Workbench.closeEditor(new RegExp(constants.mrsDocs));
            }
        });

    });

    describe("Service Context Menus", () => {

        const globalService: interfaces.IRestService = {
            servicePath: `/service1`,
            enabled: true,
            published: true,
            default: false,
            settings: {
                mrsAdminUser: "testUser",
                mrsAdminPassword: "testPassword",
                comments: "testing",
            },
            authentication: {
                redirectionUrl: "localhost:8000",
                redirectionUrlValid: "(.*)",
                authCompletedChangeCont: "<html>",
            },
            authenticationApps: {
                vendor: "MRS",
                name: "MRS",
                description: "testing",
                enabled: false,
                limitToRegisteredUsers: false,
                appId: "OAuth2",
                accessToken: "1234",
                customUrl: "http://testing",
                customUrlForAccessToken: "http://testing/1234",
            },
        };

        let serviceToEdit: interfaces.IRestService = {
            servicePath: `/service2`,
            enabled: false,
            default: false,
            settings: {
                hostNameFilter: "localhost",
                comments: "testing",
            },
            authentication: {
                redirectionUrl: "localhost:8000",
                redirectionUrlValid: "(.*)",
                authCompletedChangeCont: "<html>",
            },
            authenticationApps: {
                vendor: "MRS",
                name: "test",
                description: "testing",
                enabled: false,
                limitToRegisteredUsers: false,
                appId: "OAuth2",
                accessToken: "1234",
                customUrl: "http://testing",
                customUrlForAccessToken: "http://testing/1234",
            },
        };

        const sakilaRestSchema: interfaces.IRestSchema = {
            restSchemaPath: `/sakila`,
            accessControl: constants.accessControlEnabled,
            requiresAuth: false,
            settings: {
                schemaName: "sakila",
                itemsPerPage: "35",
                comments: "Hello",
            },
        };

        const worldRestSchema: interfaces.IRestSchema = {
            restSchemaPath: `/world_x_cst`,
            accessControl: constants.accessControlEnabled,
            requiresAuth: false,
            settings: {
                schemaName: "world_x_cst",
                itemsPerPage: "35",
                comments: "Hello",
            },
        };

        const restSchemaToDump: interfaces.IRestSchema = {
            restSchemaPath: `/${schemaToDump}`,
            settings: {
                schemaName: schemaToDump,
            },
        };

        let restAuthenticationApp: interfaces.IRestAuthenticationApp = {
            vendor: "MRS",
            name: "new app",
            description: "this is an authentication app",
            accessToken: "1234test",
            appId: "1234",
            customURL: "http://localhost",
            customURLforAccessToken: "http://localhost/1234",
            defaultRole: "Full Access",
            enabled: true,
            limitToRegisteredUsers: true,
        };

        let restUser: interfaces.IRestUser = {
            username: "gui",
            password: "testing",
            authenticationApp: restAuthenticationApp.name,
            email: "user@oracle.com",
            assignedRoles: undefined,
            userOptions: "",
            permitLogin: true,
            vendorUserId: "1234",
            mappedUserId: "testing",
        };

        let tableToEdit: interfaces.IRestObject = {
            restSchemaPath: sakilaRestSchema.restSchemaPath,
            jsonRelDuality: {
                dbObject: tableToDump,
            },
        };

        const destDumpSchema = join(constants.workspace, restSchemaToDump.settings.schemaName);
        const destDumpTable = join(constants.workspace, tableToDump);
        const destDumpSdk = join(constants.workspace, "dump.sdk");
        let existsInQueue = false;

        before(async function () {
            try {
                globalService.settings.hostNameFilter = `localhost:${routerPort}`;
                sakilaRestSchema.restServicePath = globalService.settings.hostNameFilter;
                sakilaRestSchema.restServicePath += globalService.servicePath;
                worldRestSchema.restServicePath = globalService.settings.hostNameFilter;
                worldRestSchema.restServicePath += globalService.servicePath;
                restSchemaToDump.restServicePath = globalService.settings.hostNameFilter;
                restSchemaToDump.restServicePath += globalService.servicePath;
                tableToEdit.restServicePath = globalService.settings.hostNameFilter;
                tableToEdit.restServicePath += globalService.servicePath;

                const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
                await treeMySQLRestService.expand();
                const services = [globalService, serviceToEdit];
                for (const service of services) {
                    await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.addRESTService);
                    await RestServiceDialog.set(service);
                    await driver.wait(Workbench.untilNotificationExists("The MRS service has been created"),
                        constants.wait20seconds);

                    await driver.wait(dbTreeSection.tree
                        .untilExists(`${service.settings.hostNameFilter}${service.servicePath}`),
                        constants.wait10seconds);
                }
                await dbTreeSection.focus();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
                await Workbench.dismissNotifications();
            } catch (e) {
                await Misc.processFailure(this);
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
        });

        after(async () => {
            await fs.rm(destDumpSdk, { force: true, recursive: true });
        });

        it("Edit REST Service", async () => {
            let treeRandomService = await dbTreeSection.tree.getElement(
                `${serviceToEdit.settings.hostNameFilter}${serviceToEdit.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.editRESTService);
            const editedService = {
                servicePath: `/edited`,
                enabled: true,
                default: true,
                settings: {
                    hostNameFilter: "127.0.0.1",
                    comments: "change testing",
                },
                options: `{"test":"value"}`,
                authentication: {
                    authenticationPath: "/authenticationPath",
                    redirectionUrl: "localhost:8001",
                    redirectionUrlValid: "(.*)(.*)",
                    authCompletedChangeCont: "<body>",
                },
            };

            await RestServiceDialog.set(editedService);
            await driver.wait(Workbench.untilNotificationExists("The MRS service has been successfully updated."),
                constants.wait10seconds);
            await driver.wait(dbTreeSection.tree
                .untilExists(`${editedService.settings.hostNameFilter}${editedService.servicePath}`),
                constants.wait10seconds);
            treeRandomService = await dbTreeSection.tree.getElement(
                `${editedService.settings.hostNameFilter}${editedService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.editRESTService);
            const service = await RestServiceDialog.get();
            expect(editedService).to.deep.equal(service);
            serviceToEdit = editedService;

        });

        it("Add REST Service Schemas", async () => {

            const schemas = [sakilaRestSchema, worldRestSchema, restSchemaToDump];

            for (const schema of schemas) {
                const treeSchema = await dbTreeSection.tree.getElement(schema.settings.schemaName);
                await dbTreeSection.tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);
                await RestSchemaDialog.set(schema);
                await driver.wait(Workbench.untilNotificationExists("The MRS schema has been added successfully."),
                    constants.wait10seconds);
                const treeService = await dbTreeSection.tree.getElement(
                    `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
                await treeService.expand();
                await driver.wait(dbTreeSection.tree
                    .untilExists(`${schema.restSchemaPath} (${schema.settings.schemaName})`),
                    constants.wait10seconds);
            }

        });

        it("Edit REST Schema", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await dbTreeSection.tree.getElement(String(randomServiceLabel));
            await treeService.expand();
            const treeRestSchemaToEdit = await dbTreeSection.tree.getElement(
                `${worldRestSchema.restSchemaPath} (${worldRestSchema.settings.schemaName})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRestSchemaToEdit,
                constants.editRESTSchema);

            const editedSchema = {
                restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                restSchemaPath: `/schemaEdited`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                settings: {
                    schemaName: "schemaEdited",
                    itemsPerPage: "5",
                    comments: "Hi",
                },
                options: `{"test":"value"}`,
            };

            await RestSchemaDialog.set(editedSchema);
            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been updated successfully"),
                constants.wait10seconds);
            const treeEdited = await dbTreeSection.tree.getElement(
                `${editedSchema.restSchemaPath} (${editedSchema.settings.schemaName})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeEdited, constants.editRESTSchema);
            const thisSchema = await RestSchemaDialog.get();
            expect(thisSchema).to.deep.equal(editedSchema);

        });

        it("Set as Current REST Service", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.setAsCurrentREST);
            await driver.wait(Workbench
                .untilNotificationExists("The MRS service has been set as the new default service."),
                constants.wait10seconds);
            await driver.wait(dbTreeSection.tree.untilIsDefault(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                "rest"), constants.wait5seconds, "REST Service tree item did not became default");
        });

        it("Add Tables to REST Service", async () => {

            const treeRestSakila = await dbTreeSection.tree.getElement(
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await treeRestSakila.collapse();
            const treeSakila = await dbTreeSection.tree.getElement(sakilaRestSchema.settings.schemaName);
            await treeSakila.expand();
            const treeTables = await dbTreeSection.tree.getElement("Tables");
            await treeTables.expand();

            const tables = ["actor", "address", tableToDump];

            for (const table of tables) {
                const treeTable = await dbTreeSection.tree.getElement(table);
                await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);
                await RestObjectDialog.set({
                    restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                });
                await driver.wait(Workbench
                    .untilNotificationExists(`The MRS Database Object ${table} was updated successfully`),
                    constants.wait5seconds);
                await treeRestSakila.expand();
                await driver.wait(dbTreeSection.tree.untilExists(`/${table} (${table})`), constants.wait5seconds);
            }

        });

        it("Dump Rest Schema to Json file", async () => {

            const treeMySQLRestSchema = await dbTreeSection.tree.getElement(
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);
            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema, constants.dumpRESTSchemaToJSON);
            await Workbench.setInputPath(destDumpSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema has been dumped successfully`),
                constants.wait5seconds);
            await fs.access(`${destDumpSchema}.mrs.json`);
        });

        it("Dump REST Object to JSON file", async () => {

            const treeDumpTable = await dbTreeSection.tree.getElement(
                `/${tableToDump} (${tableToDump})`);
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeDumpTable, constants.dumpRESTObjToJSON);
            await Workbench.setInputPath(destDumpTable);
            await driver.wait(Workbench
                .untilNotificationExists(`The REST Database Object has been dumped successfully`),
                constants.wait5seconds);
            await fs.access(`${destDumpTable}.mrs.json`);

        });

        it("Edit REST Object", async () => {

            const treeTable = await dbTreeSection.tree.getElement(`/${tableToDump} (${tableToDump})`);
            const editedObject: interfaces.IRestObject = {
                restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                restSchemaPath: sakilaRestSchema.restSchemaPath,
                restObjectPath: `/editedObject`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                jsonRelDuality: {
                    dbObject: "abc",
                    //sdkLanguage: "TypeScript",
                    sdkLanguage: "SDK Language",
                    columns: [{
                        name: "id",
                        isSelected: false,
                        rowOwnership: false,
                        allowSorting: true,
                        preventFiltering: true,
                        //preventUpdates: true,
                        preventUpdates: false,
                        excludeETAG: false,
                    },
                    {
                        name: "name",
                        isSelected: false,
                        rowOwnership: true,
                        allowSorting: true,
                        preventFiltering: true,
                        //preventUpdates: true,
                        preventUpdates: false,
                        excludeETAG: true,
                    }],
                    crud: {
                        insert: false,
                        update: false,
                        delete: false,
                    },
                },
                settings: {
                    resultFormat: "MEDIA",
                    itemsPerPage: "25",
                    comments: "This is a dummy comment",
                    mediaType: "Media",
                    autoDetectMediaType: true,
                },
                authorization: {
                    authStoredProcedure: "testProcedure",
                },
                options: `{"test":"value"}`,
            };
            await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.editRESTObj);
            await RestObjectDialog.set(editedObject);
            let ntf = `The MRS Database Object ${editedObject.jsonRelDuality.dbObject}`;
            ntf += ` was updated successfully`;
            await driver.wait(Workbench.untilNotificationExists(ntf), constants.wait5seconds);
            const treeEdited = await dbTreeSection.tree.getElement(
                `${editedObject.restObjectPath} (${editedObject.jsonRelDuality.dbObject})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeEdited, constants.editRESTObj);
            const thisObject = await RestObjectDialog.get();
            expect(thisObject).to.deep.equal(editedObject);
            tableToEdit = editedObject;

        });

        it("Copy REST Object Request Path to Clipboard", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const actorTree = await dbTreeSection.tree.getElement(`/${actorTable} (${actorTable})`);
            await dbTreeSection.tree.openContextMenuAndSelect(actorTree, constants.copyRESTObjReqPath);
            const url = `https://${sakilaRestSchema.restServicePath}${sakilaRestSchema.restSchemaPath}/${actorTable}`;
            await driver.wait(async () => {
                console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);

                if (clipboard.readSync() !== url) {
                    await dbTreeSection.tree.openContextMenuAndSelect(actorTree, constants.copyRESTObjReqPath);
                    await driver.wait(Workbench
                        .untilNotificationExists("The DB Object Path was copied to the system clipboard"),
                        constants.wait5seconds);
                } else {
                    return true;
                }
            }, constants.wait15seconds, `${url} was not found on the clipboard`);

        });

        it("Delete REST Object", async () => {

            const treeTableToDump = await dbTreeSection.tree.getElement(
                `${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeTableToDump, constants.deleteRESTObj);
            await driver.wait(Workbench.untilModalDialogIsOpened(), constants.wait10seconds);
            await new ModalDialog().pushButton(`Delete DB Object`);
            await driver.wait(Workbench.untilNotificationExists("The REST DB Object abc has been deleted"),
                constants.wait5seconds);
            await driver.wait(dbTreeSection.tree
                .untilDoesNotExist(`${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`),
                constants.wait5seconds);

        });

        it("Delete REST Schema", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await treeRandomService.expand();
            const treeMySQLRestSchema = await dbTreeSection.tree.getElement(
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);

            // first we click to delete the schema but we change our mind later (BUG#35377927)
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema, constants.deleteRESTSchema);
            const txt = `Are you sure the MRS schema ${restSchemaToDump.settings.schemaName} should be deleted?`;
            let ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "No");
            let itemName = `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`;
            await driver.wait(dbTreeSection.tree.untilExists(itemName), constants.wait5seconds);

            // now we try again, but we really want to delete the schema
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema, constants.deleteRESTSchema);
            ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been deleted successfully"),
                constants.wait5seconds);
            itemName = `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`;
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(itemName), constants.wait5seconds);

        });

        it("Load REST Schema from JSON file", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.loadRESTSchemaFromJSON);
            await Workbench.setInputPath(`${destDumpSchema}.mrs.json`);
            await driver.wait(Workbench.untilNotificationExists("The REST Schema has been loaded successfully"),
                constants.wait5seconds);
            const itemName = `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`;
            await driver.wait(dbTreeSection.tree.untilExists(itemName), constants.wait5seconds);

        });

        it("Export Rest Service SDK files", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.exportRestSdk);

            await fs.rm(destDumpSdk, { force: true, recursive: true });
            await Workbench.setInputPath(destDumpSdk);
            await ExportSDKDialog.set(undefined);
            await driver.wait(Workbench.untilNotificationExists("MRS SDK Files exported successfully"),
                constants.wait5seconds);
            const files = await fs.readdir(destDumpSdk);
            expect(files.length, `No exported files found at ${destDumpSdk}`).to.be.greaterThan(0);

        });

        it("Load REST Object from JSON file", async () => {

            const treeMySQLRestSchema = await dbTreeSection.tree.getElement(
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema, constants.loadRESTObjFromJSON);
            await Workbench.setInputPath(`${destDumpTable}.mrs.json`);
            await driver.wait(Workbench
                .untilNotificationExists("The REST Database Object has been loaded successfully"),
                constants.wait5seconds);
            await driver.wait(dbTreeSection.tree.untilExists(`/${tableToDump} (${tableToDump})`),
                constants.wait5seconds);

        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = await dbTreeSection.tree.getElement(
                `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.deleteAuthenticationApp);
            const ntf = await Workbench.getNotification(
                `Are you sure the MRS authentication app ${globalService.authenticationApps.name} should be deleted`,
                false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            let notification = `The MRS Authentication App ${globalService.authenticationApps.name}`;
            notification += ` has been deleted`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait5seconds);

            const itemName = `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`;
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(itemName), constants.wait5seconds);

        });

        it.skip("Add New REST Authentication App", async () => {

            let treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.addNewAuthApp);
            await Workbench.toggleSideBar(false);
            await AuthenticationAppDialog.set(restAuthenticationApp);
            await Workbench.toggleSideBar(true);
            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been added"),
                constants.wait5seconds);
            treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await treeRandomService.expand();
            await driver.wait(dbTreeSection.tree
                .untilExists(`${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`),
                constants.wait5seconds);

        });

        it.skip("Add User", async () => {

            let treeAuthApp = await dbTreeSection.tree.getElement(
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.addRESTUser);
            await RestUserDialog.set(restUser);
            await driver.wait(Workbench.untilNotificationExists("The MRS User has been added"),
                constants.wait5seconds);
            treeAuthApp = await dbTreeSection.tree.getElement(
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await driver.wait(async () => {
                await treeAuthApp.expand();

                return (await treeAuthApp.isExpanded()) && (await treeAuthApp.getChildren()).length > 0;
            }, constants.wait10seconds,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor}) was not expanded`);
            await driver.wait(dbTreeSection.tree.untilExists(restUser.username), constants.wait5seconds);

        });

        it.skip("Edit Authentication App", async () => {

            let treeAuthApp = await dbTreeSection.tree.getElement(
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp);

            const editedApp: interfaces.IRestAuthenticationApp = {
                vendor: "Facebook",
                name: "another new app",
                description: "this is another authentication app",
                accessToken: "111test",
                appId: "0000",
                customURL: "http://127.0.0.1",
                customURLforAccessToken: "http://127.0.0.1/1234",
                defaultRole: "Full Access",
                enabled: false,
                limitToRegisteredUsers: false,
            };

            await Workbench.toggleSideBar(false);
            await AuthenticationAppDialog.set(editedApp);
            await Workbench.toggleSideBar(true);
            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been updated"),
                constants.wait5seconds);
            treeAuthApp = await dbTreeSection.tree.getElement(
                `${editedApp.name} (${editedApp.vendor})`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp);
            await Workbench.toggleSideBar(false);
            const authApp = await AuthenticationAppDialog.get();
            await Workbench.toggleSideBar(true);
            expect(editedApp).to.deep.equal(authApp);
            restAuthenticationApp = editedApp;

        });

        it.skip("Edit User", async () => {

            const treeAuthApp = await dbTreeSection.tree.getElement(
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await treeAuthApp.expand();
            let treeUser = await dbTreeSection.tree.getElement(restUser.username);
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);
            const editedUser: interfaces.IRestUser = {
                username: "testUser",
                password: "[Stored Password]",
                authenticationApp: restAuthenticationApp.name,
                email: "testuser@oracle.com",
                assignedRoles: undefined,
                userOptions: `{"test":"value"}`,
                permitLogin: false,
                vendorUserId: "123467",
                mappedUserId: "stillTesting",
            };

            await RestUserDialog.set(editedUser);
            await driver.wait(Workbench.untilNotificationExists(`The MRS User has been updated`),
                constants.wait5seconds);
            treeUser = await dbTreeSection.tree.getElement(editedUser.username);
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);
            const user = await RestUserDialog.get();
            editedUser.assignedRoles = "Full Access";
            expect(editedUser).to.deep.equal(user);
            restUser = editedUser;
        });

        it.skip("Delete User", async () => {

            const treeUser = await dbTreeSection.tree.getElement(restUser.username);
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser, constants.deleteRESTUser);
            const ntf = await Workbench
                .getNotification(`Are you sure the MRS user ${restUser.username} should be deleted`,
                    false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(Workbench.untilNotificationExists(`The MRS User ${restUser.username} has been deleted`),
                constants.wait5seconds);
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(restUser.username), constants.wait5seconds);

        });

        it("MRS Service Documentation", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(
                `${globalService.settings.hostNameFilter}${globalService.servicePath}`);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.mrsServiceDocs);
            await driver.wait(async () => {
                await Misc.switchBackToTopFrame();
                await Misc.switchToFrame();

                return (await driver.findElements(locator.mrsDocumentation.restServiceProperties)).length > 0;
            }, constants.wait5seconds, "MRS Service Docs tab was not opened");
            await Workbench.closeEditor(new RegExp(constants.mrsDocs));

        });

        it("Delete REST Services", async () => {

            const services = [globalService, serviceToEdit];
            for (const service of services) {
                const treeRestService = await dbTreeSection.tree.getElement(
                    `${service.settings.hostNameFilter}${service.servicePath}`);
                await dbTreeSection.tree.openContextMenuAndSelect(treeRestService, constants.deleteRESTService);
                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                    constants.wait5seconds);
                await driver.wait(dbTreeSection.tree
                    .untilDoesNotExist(`${service.servicePath} (${service.settings.hostNameFilter})`),
                    constants.wait5seconds);
            }

        });

    });

    describe("CRUD Operations", () => {

        let actorId: string;
        let response: Response;

        const crudService: interfaces.IRestService = {
            servicePath: `/crudService`,
            published: true,
            enabled: true,
            settings: {
                hostNameFilter: "",
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
            jsonRelDuality: {
                crud: {
                    insert: true,
                    update: true,
                    delete: true,
                },
            },
        };

        let baseUrl: string;

        before(async function () {
            try {
                crudService.settings.hostNameFilter = `127.0.0.1:${routerPort}`;
                crudSchema.restServicePath = `${crudService.settings.hostNameFilter}${crudService.servicePath}`;
                crudObject.restServicePath = `${crudService.settings.hostNameFilter}${crudService.servicePath}`;
                baseUrl = `https://${crudService.settings.hostNameFilter}`;
                baseUrl += `${crudService.servicePath}${crudSchema.restSchemaPath}`;

                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
                await Os.deleteCredentials();
                let treeMySQLRestService = await dbTreeSection.tree.getElement(
                    constants.mysqlRestService);
                await treeMySQLRestService.expand();
                await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.addRESTService);
                await RestServiceDialog.set(crudService);
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been created."),
                    constants.wait5seconds);
                await driver.wait(async () => {
                    const refSchema = await dbTreeSection.tree.getElement(
                        crudSchema.settings.schemaName);
                    await refSchema.expand();

                    return (await refSchema.isExpanded()) && (refSchema.hasChildren());
                }, constants.wait5seconds, "sakila tree item was not expanded");
                const treeSchema = await dbTreeSection.tree.getElement(crudSchema.settings.schemaName);
                await dbTreeSection.tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);
                await RestSchemaDialog.set(crudSchema);
                await driver.wait(Workbench.untilNotificationExists("The MRS schema has been added successfully."),
                    constants.wait5seconds);
                const treeService = await dbTreeSection.tree.getElement(
                    `${crudService.settings.hostNameFilter}${crudService.servicePath}`);
                await treeService.expand();
                await driver.wait(dbTreeSection.tree
                    .untilExists(`${crudSchema.restSchemaPath} (${crudSchema.settings.schemaName})`),
                    constants.wait5seconds);
                await (await dbTreeSection.tree.getElement("Tables")).expand();
                const treeTable = await dbTreeSection.tree.getElement(
                    crudObject.restObjectPath.replace("/", ""));
                await dbTreeSection.tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);
                await RestObjectDialog.set(crudObject);
                let ntf = `The MRS Database Object ${crudObject.restObjectPath.replace("/", "")}`;
                ntf += ` was updated successfully`;
                await driver.wait(Workbench.untilNotificationExists(ntf),
                    constants.wait5seconds);

                // Check Router
                await fs.truncate(await Os.getRouterLogFile());
                treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
                await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.startRouter);
                await driver.wait(dbTreeSection.tree.untilRouterIsActive(), constants.wait20seconds);
                console.log("Using router service:");
                console.log(crudService);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        after(async function () {
            try {
                const treeMySQLRestService = await dbTreeSection.tree.getElement(
                    constants.mysqlRestService);
                await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.killRouters);
                const router = await dbTreeSection.tree.getElement(new RegExp(hostname()));
                const routerName = await router.getLabel();
                await dbTreeSection.tree.openContextMenuAndSelect(router, constants.deleteRouter);
                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS router ${routerName} should be deleted?`,
                        false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS Router has been deleted successfully."),
                    constants.wait5seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }
        });

        it("Get schema metadata", async () => {
            console.log(`fetching: ${baseUrl}/metadata-catalog`);
            response = await fetch(`${baseUrl}/metadata-catalog`);
            const data = await response.json();
            expect(response.ok, `response should be OK`).to.be.true;
            expect(data.items, "response data does not have any items").to.exist;
        });

        it("Get object metadata", async () => {
            console.log(`fetching: ${baseUrl}/metadata-catalog${crudObject.restObjectPath}`);
            response = await fetch(`${baseUrl}/metadata-catalog${crudObject.restObjectPath}`);
            const data = await response.json();
            expect(response.ok, `response should be OK`).to.be.true;
            expect(data.name).equals(`/${crudObject.restObjectPath.replace("/", "")}`);
            expect(data.primaryKey[0]).to.equals("actorId");
        });

        it("Get object data", async () => {
            console.log(`fetching: ${baseUrl}${crudObject.restObjectPath}`);
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

    });

});
