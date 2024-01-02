/*
 * Copyright (c) 2022, 2024 Oracle and/or its affiliates.
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

import { join } from "path";
import * as fs from "fs/promises";
import { expect } from "chai";
import { Workbench as extWorkbench, BottomBarPanel, ModalDialog } from "vscode-extension-tester";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/misc";
import { Section } from "../lib/treeViews/section";
import { Tree } from "../lib/treeViews/tree";
import { Rest } from "../lib/webviews/rest";
import { Os } from "../lib/os";
import { Workbench } from "../lib/workbench";
import { DatabaseConnection } from "../lib/webviews/dbConnection";
import { hostname } from "os";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as waitUntil from "../lib/until";
import * as locator from "../lib/locators";

describe("MySQL REST Service", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "globalConnection",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    const schemaToDump = "dummyschema";
    const tableToDump = "abc";
    const actorTable = "actor";

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(waitUntil.extensionIsReady(), constants.wait2minutes);
            await Workbench.toggleBottomBar(false);
            await Section.focus(constants.dbTreeSection);
            await Section.createDatabaseConnection(globalConn);
            await (await DatabaseConnection.getConnection(globalConn.caption)).click();
            await driver.wait(waitUntil.dbConnectionIsOpened(globalConn), constants.wait10seconds);
            expect(await Tree.existsElement(constants.dbTreeSection, globalConn.caption)).to.be.true;
            await Os.deleteCredentials();
            if (await Workbench.requiresMRSMetadataUpgrade(globalConn)) {
                await Workbench.upgradeMRSMetadata();
            }
            const treeGlobalConn = await Tree.getElement(constants.dbTreeSection, globalConn.caption);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.configureREST);
            const ntf = await Workbench.getNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(async () => {
                const inputWidget = await driver.findElements(locator.inputBox.exists);
                const hasNotifications = (await new extWorkbench().getNotifications()).length > 0;
                if (hasNotifications) {
                    return true;
                } else if (inputWidget.length > 0) {
                    if (await inputWidget[0].isDisplayed()) {
                        await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
                    }
                }
            }, constants.wait10seconds, `MySQL REST Service was not configured`);
            await driver.wait(waitUntil.notificationExists("MySQL REST Service configured successfully."),
                constants.wait5seconds);
            await Tree.openContextMenuAndSelect(treeGlobalConn, constants.showSystemSchemas, undefined);
            expect(await Tree.existsElement(constants.dbTreeSection, "mysql_rest_service_metadata")).to.be.true;
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            await Os.prepareExtensionLogsForExport(process.env.TEST_SUITE);
            const dbConnections = await Tree.getDatabaseConnections();
            for (const dbConnection of dbConnections) {
                await Tree.deleteDatabaseConnection(dbConnection.name, dbConnection.isMySQL, false);
            }
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
                await new BottomBarPanel().toggle(false);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Disable MySQL REST Service", async () => {

            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.disableRESTService, undefined);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds,
                `${constants.dbTreeSection} is still loading`);
            await driver.wait(waitUntil.notificationExists("MySQL REST Service configured successfully."),
                constants.wait5seconds);
            await driver.wait(async () => {
                await Section.clickToolbarButton(await Section.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await Tree.isMRSDisabled(treeMySQLRESTService)) === true;
            }, constants.wait5seconds, "MySQL REST Service was not disabled");
            expect(await Tree.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.enableRESTService, undefined);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds,
                `${constants.dbTreeSection} is still loading`);
            await driver.wait(waitUntil.notificationExists("MySQL REST Service configured successfully."),
                constants.wait5seconds);
            await driver.wait(async () => {
                await Section.clickToolbarButton(await Section.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await Tree.isMRSDisabled(treeMySQLRESTService)) === false;
            }, constants.wait5seconds, "MySQL REST Service was not enabled");

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            Os.killRouterFromTerminal();
            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await treeMySQLRESTService.expand();
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.bootstrapRouter);
            await Workbench.waitForTerminalText("Please enter MySQL password for root:", constants.wait10seconds);
            await Workbench.execOnTerminal((globalConn.basic as interfaces.IConnBasicMySQL).password,
                constants.wait10seconds);
            await Workbench.waitForTerminalText("JWT secret:", constants.wait10seconds);
            await Workbench.execOnTerminal("1234", constants.wait10seconds);
            await Workbench.waitForTerminalText("Once the MySQL Router is started", constants.wait10seconds);
            expect(await Workbench.terminalHasErrors()).to.be.false;
            expect(await Tree.existsElement(constants.dbTreeSection, new RegExp(hostname()))).to.be.true;
            const router = await Tree.getElement(constants.dbTreeSection, new RegExp(hostname()));
            expect(await Tree.routerHasError(router), "Please update Router").to.be.false;
            await driver.wait(waitUntil.routerIconIsInactive(), constants.wait20seconds);
            await Os.setRouterConfigFile({
                sinks: "filelog",
            });

        });

        it("Start Local MySQL Router Instance", async () => {

            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await treeMySQLRESTService.expand();
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.startRouter);
            await driver.wait(waitUntil.routerIconIsActive(), constants.wait20seconds);
        });

        it("Stop Local MySQL Router Instance", async () => {
            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await treeMySQLRESTService.expand();
            await fs.truncate(await Os.getRouterLogFile());
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.stopRouter);
            await driver.wait(waitUntil.routerIconIsInactive(), constants.wait20seconds);
        });

        it("Browse the MySQL REST Service Documentation", async () => {

            const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
            await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.browseRESTDocs);
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
                await Workbench.closeEditor(constants.mrsDocs);
            }
        });

    });

    describe("Service Context Menus", () => {

        const globalService: interfaces.IRestService = {
            servicePath: `/service1`,
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
            restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
            restSchemaPath: `/sakila`,
            enabled: true,
            requiresAuth: false,
            settings: {
                schemaName: "sakila",
                itemsPerPage: "35",
                comments: "Hello",
            },
        };

        const worldRestSchema: interfaces.IRestSchema = {
            restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
            restSchemaPath: `/world_x_cst`,
            enabled: true,
            requiresAuth: false,
            settings: {
                schemaName: "world_x_cst",
                itemsPerPage: "35",
                comments: "Hello",
            },
        };

        const restSchemaToDump: interfaces.IRestSchema = {
            restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
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
            restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
            restSchemaPath: sakilaRestSchema.restSchemaPath,
            jsonRelDuality: {
                dbObject: tableToDump,
            },
        };

        const destDumpSchema = join(constants.workspace, restSchemaToDump.settings.schemaName);
        const destDumpTable = join(constants.workspace, tableToDump);
        const destDumpSdk = join(constants.workspace, "dump.sdk");

        before(async function () {
            try {
                const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection,
                    constants.mysqlRestService);
                await treeMySQLRESTService.expand();
                const services = [globalService, serviceToEdit];
                for (const service of services) {
                    await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.addRESTService);
                    await Rest.setService(service);
                    await driver.wait(waitUntil.notificationExists("The MRS service has been created"),
                        constants.wait5seconds);
                    expect(await Tree.existsElement(constants.dbTreeSection,
                        `${service.servicePath} (${service.settings.hostNameFilter})`)).to.be.true;
                }
                await Section.focus(constants.dbTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            try {
                await driver.wait(waitUntil.sectionIsNotLoading(constants.dbTreeSection), constants.wait10seconds,
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
        });

        after(async () => {
            await fs.rm(destDumpSdk, { force: true, recursive: true });
        });

        it("Edit REST Service", async () => {

            let treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${serviceToEdit.servicePath} (${serviceToEdit.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.editRESTService);
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
                authenticationApps: {
                    vendor: "Google",
                    name: "testing",
                    description: "testing description",
                    enabled: true,
                    limitToRegisteredUsers: true,
                    appId: "OAuth3",
                    accessToken: "12345",
                    customUrl: "http://testingTest",
                    customUrlForAccessToken: "http://testing/123456",
                },
            };

            await Rest.setService(editedService);
            await driver.wait(waitUntil.notificationExists("The MRS service has been successfully updated."),
                constants.wait5seconds);
            treeRandomService = await Tree
                .getElement(constants.dbTreeSection,
                    `${editedService.servicePath} (${editedService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.editRESTService);
            const service = await Rest.getService();
            expect(editedService).to.deep.equal(service);
            serviceToEdit = editedService;

        });

        it("Add REST Service Schemas", async () => {

            const schemas = [sakilaRestSchema, worldRestSchema, restSchemaToDump];

            for (const schema of schemas) {
                const treeSchema = await Tree.getElement(constants.dbTreeSection, schema.settings.schemaName);
                await Tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);
                await Rest.setSchema(schema);
                await driver.wait(waitUntil.notificationExists("The MRS schema has been added successfully."),
                    constants.wait5seconds);
                const treeService = await Tree.getElement(constants.dbTreeSection,
                    `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
                await treeService.expand();
                expect(await Tree.existsElement(constants.dbTreeSection,
                    `${schema.restSchemaPath} (${schema.settings.schemaName})`)).to.exist;
            }

        });

        it("Edit REST Schema", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await Tree.getElement(constants.dbTreeSection, String(randomServiceLabel));
            await treeService.expand();
            const treeRestSchemaToEdit = await Tree.getElement(constants.dbTreeSection,
                `${worldRestSchema.restSchemaPath} (${worldRestSchema.settings.schemaName})`);
            await Tree.openContextMenuAndSelect(treeRestSchemaToEdit,
                constants.editRESTSchema);

            const editedSchema = {
                restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                restSchemaPath: `/schemaEdited`,
                enabled: false,
                requiresAuth: true,
                settings: {
                    schemaName: "schemaEdited",
                    itemsPerPage: "5",
                    comments: "Hi",
                },
                options: `{"test":"value"}`,
            };

            await Rest.setSchema(editedSchema);
            await driver.wait(waitUntil.notificationExists("The MRS schema has been updated successfully"),
                constants.wait5seconds);
            const treeEdited = await Tree.getElement(constants.dbTreeSection,
                `${editedSchema.restSchemaPath} (${editedSchema.settings.schemaName})`);
            await Tree.openContextMenuAndSelect(treeEdited, constants.editRESTSchema);
            const thisSchema = await Rest.getSchema();
            expect(thisSchema).to.deep.equal(editedSchema);

        });

        it("Set as Current REST Service", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.setAsCurrentREST);
            await driver.wait(waitUntil.notificationExists("The MRS service has been set as the new default service."),
                constants.wait5seconds);
            await driver.wait(waitUntil.isDefaultItem(constants.dbTreeSection
                , `${globalService.servicePath} (${globalService.settings.hostNameFilter})`,
                "rest"), constants.wait5seconds, "REST Service tree item did not became default");
        });

        it("Add Tables to REST Service", async () => {

            const treeRestSakila = await Tree.getElement(constants.dbTreeSection,
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await treeRestSakila.collapse();
            const treeSakila = await Tree.getElement(constants.dbTreeSection, sakilaRestSchema.settings.schemaName);
            await treeSakila.expand();
            const treeTables = await Tree.getElement(constants.dbTreeSection, "Tables");
            await treeTables.expand();

            const tables = ["actor", "address", tableToDump];

            for (const table of tables) {
                const treeTable = await Tree.getElement(constants.dbTreeSection, table);
                await Tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);
                await Rest.setObject({
                    restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                });
                await driver.wait(waitUntil
                    .notificationExists(`The MRS Database Object ${table} was updated successfully`),
                    constants.wait5seconds);
                await treeRestSakila.expand();
                expect(await Tree.existsElement(constants.dbTreeSection, `/${table} (${table})`)).to.be.true;
            }

        });

        it("Dump Rest Schema to Json file", async () => {

            const treeMySQLRESTSchema = await Tree.getElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);
            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await Tree.openContextMenuAndSelect(treeMySQLRESTSchema, constants.dumpRESTSchemaToJSON);
            await Workbench.setInputPath(destDumpSchema);
            await driver.wait(waitUntil.notificationExists(`The REST Schema has been dumped successfully`),
                constants.wait5seconds);
            await fs.access(`${destDumpSchema}.mrs.json`);
        });

        it("Dump REST Object to JSON file", async () => {

            const treeDumpTable = await Tree.getElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`);
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await Tree.openContextMenuAndSelect(treeDumpTable, constants.dumpRESTObjToJSON);
            await Workbench.setInputPath(destDumpTable);
            await driver.wait(waitUntil.notificationExists(`The REST Database Object has been dumped successfully`),
                constants.wait5seconds);
            await fs.access(`${destDumpTable}.mrs.json`);

        });

        it("Edit REST Object", async () => {
            const treeTable = await Tree.getElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`);
            const editedObject: interfaces.IRestObject = {
                restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                restSchemaPath: sakilaRestSchema.restSchemaPath,
                restObjectPath: `/editedObject`,
                enabled: false,
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
                        create: false,
                        read: false,
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
                    enforceRowUserOwner: true,
                    rowOwnerShipField: "name",
                    customStoredProcedure: "TEST",
                },
                options: `{"test":"value"}`,
            };
            await Tree.openContextMenuAndSelect(treeTable, constants.editRESTObj);
            await Rest.setObject(editedObject);
            let ntf = `The MRS Database Object ${editedObject.jsonRelDuality.dbObject}`;
            ntf += ` was updated successfully`;
            await driver.wait(waitUntil.notificationExists(ntf), constants.wait5seconds);
            const treeEdited = await Tree.getElement(constants.dbTreeSection,
                `${editedObject.restObjectPath} (${editedObject.jsonRelDuality.dbObject})`);
            await Tree.openContextMenuAndSelect(treeEdited, constants.editRESTObj);
            const thisObject = await Rest.getObject();
            expect(thisObject).to.deep.equal(editedObject);
            tableToEdit = editedObject;
        });

        it("Copy REST Object Request Path to Clipboard", async () => {
            const actorTree = await Tree.getElement(constants.dbTreeSection,
                `/${actorTable} (${actorTable})`);
            await Tree.openContextMenuAndSelect(actorTree, constants.copyRESTObjReqPath);
            await driver.wait(waitUntil.notificationExists("The DB Object was copied to the system clipboard"),
                constants.wait5seconds);
            const expected = `${sakilaRestSchema.restServicePath}${sakilaRestSchema.restSchemaPath}/${actorTable}`;
            await driver.wait(() => {
                return clipboard.readSync() === expected;
            }, constants.wait5seconds, `${expected} was not found on the clipboard`);

        });

        it("Delete REST Object", async () => {

            const treeTableToDump = await Tree.getElement(constants.dbTreeSection,
                `${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`);
            await Tree.openContextMenuAndSelect(treeTableToDump, constants.deleteRESTObj);
            await driver.wait(waitUntil.modalDialogIsOpened(), constants.wait5seconds);
            await new ModalDialog().pushButton(`Delete DB Object`);
            await driver.wait(waitUntil.notificationExists("The REST DB Object abc has been deleted"),
                constants.wait5seconds);
            expect(await Tree.existsElement(constants.dbTreeSection,
                `${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`)).to.be.false;

        });

        it("Delete REST Schema", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await treeRandomService.expand();
            const treeMySQLRESTSchema = await Tree.getElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);

            // first we click to delete the schema but we change our mind later (BUG#35377927)
            await Tree.openContextMenuAndSelect(treeMySQLRESTSchema, constants.deleteRESTSchema);
            const txt = `Are you sure the MRS schema ${restSchemaToDump.settings.schemaName} should be deleted?`;
            let ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "No");
            expect(await Tree.existsElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.true;

            // now we try again, but we really want to delete the schema
            await Tree.openContextMenuAndSelect(treeMySQLRESTSchema, constants.deleteRESTSchema);
            ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(waitUntil.notificationExists("The MRS schema has been deleted successfully"),
                constants.wait5seconds);
            expect(await Tree.existsElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.false;
        });

        it("Load REST Schema from JSON file", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.loadRESTSchemaFromJSON);
            await Workbench.setInputPath(`${destDumpSchema}.mrs.json`);
            await driver.wait(waitUntil.notificationExists("The REST Schema has been loaded successfully"),
                constants.wait5seconds);
            expect(await Tree.existsElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.true;

        });

        it("Export Rest Service SDK files", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.exportRESTSDK);

            await fs.rm(destDumpSdk, { force: true, recursive: true });
            await Workbench.setInputPath(destDumpSdk);
            await Rest.setExportMRSSDK(undefined);
            await driver.wait(waitUntil.notificationExists("MRS SDK Files exported successfully"),
                constants.wait5seconds);
            const files = await fs.readdir(destDumpSdk);
            expect(files.length).to.be.greaterThan(0);
        });

        it("Load REST Object from JSON file", async () => {

            const treeMySQLRESTSchema = await Tree.getElement(constants.dbTreeSection,
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await Tree.openContextMenuAndSelect(treeMySQLRESTSchema, constants.loadRESTObjFromJSON);
            await Workbench.setInputPath(`${destDumpTable}.mrs.json`);
            await driver.wait(waitUntil.notificationExists("The REST Database Object has been loaded successfully"),
                constants.wait5seconds);
            expect(await Tree.existsElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`)).to.be.true;

        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`);
            await Tree.openContextMenuAndSelect(treeAuthApp, constants.deleteAuthenticationApp);
            const ntf = await Workbench.getNotification(
                `Are you sure the MRS authentication app ${globalService.authenticationApps.name} should be deleted`,
                false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            let notif = `The MRS Authentication App ${globalService.authenticationApps.name}`;
            notif += ` has been deleted`;
            await driver.wait(waitUntil.notificationExists(notif), constants.wait5seconds);

            expect(await Tree.existsElement(constants.dbTreeSection,
                `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`)).to.be.false;

        });

        it("Add New Authentication App", async () => {

            let treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.addNewAuthApp);
            await Rest.setAuthenticationApp(restAuthenticationApp);
            await driver.wait(waitUntil.notificationExists("The MRS Authentication App has been added"),
                constants.wait5seconds);
            treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await treeRandomService.expand();
            expect(await Tree.existsElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`)).to.be.true;

        });

        it("Add User", async () => {

            let treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await Tree.openContextMenuAndSelect(treeAuthApp, constants.addRESTUser);
            await Rest.setUser(restUser);
            await driver.wait(waitUntil.notificationExists("The MRS User has been added"),
                constants.wait5seconds);
            treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await driver.wait(async () => {
                await treeAuthApp.expand();

                return (await treeAuthApp.isExpanded()) && (await treeAuthApp.getChildren()).length > 0;
            }, constants.wait10seconds,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor}) was not expanded`);
            expect(await Tree.existsElement(constants.dbTreeSection, restUser.username)).to.be.true;

        });

        it("Edit Authentication App", async () => {

            let treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await Tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp);

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

            await Rest.setAuthenticationApp(editedApp);
            await driver.wait(waitUntil.notificationExists("The MRS Authentication App has been updated"),
                constants.wait5seconds);
            treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${editedApp.name} (${editedApp.vendor})`);
            await Tree.openContextMenuAndSelect(treeAuthApp, constants.editAuthenticationApp);
            const authApp = await Rest.getAuthenticationApp();
            expect(editedApp).to.deep.equal(authApp);
            restAuthenticationApp = editedApp;

        });

        it("Edit User", async () => {

            const treeAuthApp = await Tree.getElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await treeAuthApp.expand();
            let treeUser = await Tree.getElement(constants.dbTreeSection, restUser.username);
            await Tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);
            const editedUser: interfaces.IRestUser = {
                username: "testuser",
                password: "[Stored Password]",
                authenticationApp: restAuthenticationApp.name,
                email: "testuser@oracle.com",
                assignedRoles: undefined,
                userOptions: `{"test":"value"}`,
                permitLogin: false,
                vendorUserId: "123467",
                mappedUserId: "stilltesting",
            };

            await Rest.setUser(editedUser);
            await driver.wait(waitUntil.notificationExists(`The MRS User has been updated`),
                constants.wait5seconds);
            treeUser = await Tree.getElement(constants.dbTreeSection, editedUser.username);
            await Tree.openContextMenuAndSelect(treeUser, constants.editRESTUser);
            const user = await Rest.getUser();
            editedUser.assignedRoles = "Full Access";
            expect(editedUser).to.deep.equal(user);
            restUser = editedUser;
        });

        it("MRS Service Documentation", async () => {

            const treeRandomService = await Tree.getElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Tree.openContextMenuAndSelect(treeRandomService, constants.mrsServiceDocs);
            await driver.wait(async () => {
                await Misc.switchBackToTopFrame();
                await Misc.switchToFrame();

                return (await driver.findElements(locator.mrsDocumentation.restServiceProperties)).length > 0;
            }, constants.wait5seconds, "MRS Service Docs tab was not opened");
            await Workbench.closeEditor(constants.mrsDocs);

        });

        it("Delete User", async () => {

            const treeUser = await Tree.getElement(constants.dbTreeSection, restUser.username);
            await Tree.openContextMenuAndSelect(treeUser, constants.deleteRESTUser);
            const ntf = await Workbench
                .getNotification(`Are you sure the MRS user ${restUser.username} should be deleted`,
                    false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(waitUntil.notificationExists(`The MRS User ${restUser.username} has been deleted`),
                constants.wait5seconds);
            expect(await Tree.existsElement(constants.dbTreeSection, restUser.username)).to.be.false;
        });

        it("Delete REST Services", async () => {

            const services = [globalService, serviceToEdit];
            for (const service of services) {
                const treeRestService = await Tree.getElement(constants.dbTreeSection,
                    `${service.servicePath} (${service.settings.hostNameFilter})`);
                await Tree.openContextMenuAndSelect(treeRestService, constants.deleteRESTService);
                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(waitUntil.notificationExists("The MRS service has been deleted successfully"),
                    constants.wait5seconds);
                expect(await Tree.existsElement(constants.dbTreeSection,
                    `${service.servicePath} (${service.settings.hostNameFilter})`)).to.be.false;
            }

        });

    });

    describe("CRUD Operations", () => {

        let actorId: string;
        let response: Response;

        const crudService: interfaces.IRestService = {
            servicePath: `/crudService`,
            enabled: true,
            settings: {
                hostNameFilter: `127.0.0.1:8444`,
            },
        };

        const crudSchema: interfaces.IRestSchema = {
            restServicePath: `${crudService.settings.hostNameFilter}${crudService.servicePath}`,
            restSchemaPath: `/sakila`,
            enabled: true,
            requiresAuth: false,
            settings: {
                schemaName: "sakila",
            },
        };

        const crudObject: interfaces.IRestObject = {
            restServicePath: `${crudService.settings.hostNameFilter}${crudService.servicePath}`,
            requiresAuth: false,
            restObjectPath: "/actor",
            jsonRelDuality: {
                crud: {
                    create: true,
                    read: true,
                    update: true,
                    delete: true,
                },
            },
        };

        let baseUrl = `https://${crudService.settings.hostNameFilter}`;
        baseUrl += `${crudService.servicePath}${crudSchema.restSchemaPath}`;

        before(async function () {
            try {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
                await Os.deleteCredentials();
                let treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection,
                    constants.mysqlRestService);
                await treeMySQLRESTService.expand();
                await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.addRESTService);
                await Rest.setService(crudService);
                await driver.wait(waitUntil.notificationExists("The MRS service has been created."),
                    constants.wait5seconds);
                await driver.wait(async () => {
                    const refSchema = await Tree.getElement(constants.dbTreeSection,
                        crudSchema.settings.schemaName);
                    await refSchema.expand();

                    return (await refSchema.isExpanded()) && (refSchema.hasChildren());
                }, constants.wait5seconds, "sakila tree item was not expanded");
                const treeSchema = await Tree.getElement(constants.dbTreeSection, crudSchema.settings.schemaName);
                await Tree.openContextMenuAndSelect(treeSchema, constants.addSchemaToREST);
                await Rest.setSchema(crudSchema);
                await driver.wait(waitUntil.notificationExists("The MRS schema has been added successfully."),
                    constants.wait5seconds);
                const treeService = await Tree.getElement(constants.dbTreeSection,
                    `${crudService.servicePath} (${crudService.settings.hostNameFilter})`);
                await treeService.expand();
                expect(await Tree.existsElement(constants.dbTreeSection,
                    `${crudSchema.restSchemaPath} (${crudSchema.settings.schemaName})`)).to.exist;
                await (await Tree.getElement(constants.dbTreeSection, "Tables")).expand();
                const treeTable = await Tree.getElement(constants.dbTreeSection,
                    crudObject.restObjectPath.replace("/", ""));
                await Tree.openContextMenuAndSelect(treeTable, constants.addDBObjToREST);
                await Rest.setObject(crudObject);
                let ntf = `The MRS Database Object ${crudObject.restObjectPath.replace("/", "")}`;
                ntf += ` was updated successfully`;
                await driver.wait(waitUntil.notificationExists(ntf),
                    constants.wait5seconds);

                // Check Router
                await fs.truncate(await Os.getRouterLogFile());
                treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection, constants.mysqlRestService);
                await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.startRouter, undefined);
                await driver.wait(waitUntil.routerIconIsActive(), constants.wait20seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        after(async function () {
            try {
                const treeMySQLRESTService = await Tree.getElement(constants.dbTreeSection,
                    constants.mysqlRestService);
                await Tree.openContextMenuAndSelect(treeMySQLRESTService, constants.killRouters, undefined);
                const router = await Tree.getElement(constants.dbTreeSection, new RegExp(hostname()));
                const routerName = await router.getLabel();
                await Tree.openContextMenuAndSelect(router, constants.deleteRouter, undefined);
                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS router ${routerName} should be deleted?`,
                        false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                expect(await Tree.existsElement(constants.dbTreeSection, routerName)).to.be.false;
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Get schema metadata", async () => {
            response = await fetch(`${baseUrl}/metadata-catalog`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items).to.exist;
        });

        it("Get object metadata", async () => {
            response = await fetch(`${baseUrl}/metadata-catalog/${crudObject.restObjectPath.replace("/", "")}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.name).equals(`/${crudObject.restObjectPath.replace("/", "")}`);
            expect(data.primaryKey[0]).to.equals("actor_id");
        });

        it("Get object data", async () => {
            response = await fetch(`${baseUrl}/${crudObject.restObjectPath.replace("/", "")}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items[0].firstName).to.equals("PENELOPE");
        });

        it("Insert table row", async () => {
            response = await fetch(`${baseUrl}/${crudObject.restObjectPath.replace("/", "")}`, {
                method: "post",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON.stringify({ firstName: "Doctor", lastName: "Testing" }),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            expect(response.ok).to.be.true;
            actorId = data.actorId;
            expect(data.actorId).to.exist;
            expect(data.firstName).to.equals("Doctor");
            expect(data.lastName).to.equals("Testing");
            expect(data.lastUpdate).to.exist;
        });

        it("Update table row", async () => {
            response = await fetch(`${baseUrl}/${crudObject.restObjectPath.replace("/", "")}/${actorId}`, {
                method: "put",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: JSON
                    .stringify({ firstName: "Mister", lastName: "Test", lastUpdate: "2023-06-23 13:32:54" }),
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
            response = await fetch(`${baseUrl}/${crudObject.restObjectPath.replace("/", "")}?q={${query}}`,
                { method: "delete" });
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.itemsDeleted).to.equals(1);
        });

        it("Filter object data", async () => {
            const query = `"firstName":"PENELOPE"`;
            response = await fetch(`${baseUrl}/${crudObject.restObjectPath.replace("/", "")}?q={${query}}`);
            const data = await response.json();
            expect(response.ok).to.be.true;
            expect(data.items).to.exist;
        });

    });

});
