/*
 * Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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
import {
    Workbench,
    until,
    BottomBarPanel,
    ModalDialog,
    EditorView,
} from "vscode-extension-tester";
import { driver, Misc } from "../lib/misc";
import { Database } from "../lib/db";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as Until from "../lib/until";
import * as locator from "../lib/locators";
import { hostname } from "os";
import clipboard from "clipboardy";

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
            await Misc.cleanCredentials();
            await driver.wait(Until.extensionIsReady(), constants.extensionReadyWait, "Extension was not ready");
            await Misc.toggleBottomBar(false);
            await Misc.sectionFocus(constants.dbTreeSection);
            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            await Database.createConnection(globalConn);
            await Misc.switchBackToTopFrame();
            let treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            const conn = await Database.getWebViewConnection(globalConn.caption, true);
            await Misc.switchToFrame();
            await driver.executeScript("arguments[0].click();", conn);
            await driver.wait(Database.isConnectionLoaded(), constants.explicitWait * 3,
                "DB Connection was not loaded");
            await Database.setDBConnectionCredentials(globalConn);
            let result = await Misc.execCmd("DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;",
                undefined, constants.explicitWait * 2);
            expect(result[0]).to.match(/OK/);
            const query = `DROP TABLE IF EXISTS ${tableToDump}; CREATE TABLE ${tableToDump} (id int,name VARCHAR(50));`;
            result = await Misc.execCmd(query);
            expect(result[0]).to.match(/OK/);
            const sql = `DROP SCHEMA IF EXISTS \`${schemaToDump}\`; CREATE SCHEMA \`${schemaToDump}\`;`;
            result = await Misc.execCmd(sql);
            expect(result[0]).to.match(/OK/);
            await Misc.switchBackToTopFrame();
            treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.expandDBConnectionTree(treeGlobalConn,
                (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await Misc.openContextMenuItem(treeGlobalConn, constants.configureREST, constants.checkNotif);
            const ntf = await Misc.getNotification(
                `Do you want to configure this instance for MySQL REST Service Support?`, false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(async () => {
                const inputWidget = await driver.findElements(locator.inputBox.exists);
                const hasNotifications = (await new Workbench().getNotifications()).length > 0;
                if (hasNotifications) {
                    return true;
                } else if (inputWidget.length > 0) {
                    if (await inputWidget[0].isDisplayed()) {
                        await Misc.setInputPassword(treeGlobalConn,
                            (globalConn.basic as interfaces.IConnBasicMySQL).password);
                    }
                }
            }, constants.explicitWait * 2, `MySQL REST Service was not configured`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            await Misc.openContextMenuItem(treeGlobalConn, constants.showSystemSchemas, undefined);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, "mysql_rest_service_metadata")).to.be.true;
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            const dbConnections = await Misc.getDBConnections();
            for (const dbConnection of dbConnections) {
                await Misc.deleteConnection(dbConnection.name, dbConnection.isMySQL);
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Main Context Menus", () => {

        before(async function () {
            try {
                await Misc.cleanCredentials();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await Misc.switchBackToTopFrame();
            if (this.currentTest.state === "failed") {
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await Misc.processFailure(this);

                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].dismiss();
                }
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

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.disableRESTService, constants.checkInput);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);

                return (await Misc.isMRSDisabled(treeMySQLRESTService)) === true;
            }, constants.explicitWait, "MySQL REST Service was not disabled");
            expect(await Misc.isMRSDisabled(treeMySQLRESTService)).to.equals(true);
        });

        it("Enable MySQL REST Service", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.enableRESTService, constants.checkInput);
            await Misc.setInputPassword(treeGlobalConn, (globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("MySQL REST Service configured successfully.");
            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);

                return (await Misc.isMRSDisabled(treeMySQLRESTService)) === false;
            }, constants.explicitWait, "MySQL REST Service was not enabled");

        });

        it("Bootstrap Local MySQL Router Instance", async () => {

            expect(await Misc.isRouterInstalled(), "Please install MySQL Router manually").to.be.true;
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.bootstrapRouter, constants.checkTerminal);
            await Misc.waitForTerminalText("Please enter MySQL password for root:", constants.explicitWait * 2);
            await Misc.execOnTerminal((globalConn.basic as interfaces.IConnBasicMySQL).password,
                constants.explicitWait * 2);
            await Misc.waitForTerminalText("JWT secret:", constants.explicitWait * 2);
            await Misc.execOnTerminal("1234", constants.explicitWait * 2);
            await Misc.waitForTerminalText("Once the MySQL Router is started", constants.explicitWait * 2);
            expect(await Misc.terminalHasErrors()).to.be.false;
            expect(await Misc.existsTreeElement(constants.dbTreeSection, new RegExp(hostname()))).to.be.true;

        });

        it("Start Local MySQL Router Instance", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await treeMySQLRESTService.expand();
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.startRouter, constants.checkTerminal);
            await Misc.waitForTerminalText(
                "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                constants.explicitWait * 2);

            expect(await Misc.terminalHasErrors()).to.be.false;
            await driver.wait(async () => {
                const treeRouter = await Misc.getTreeElement(constants.dbTreeSection, new RegExp(hostname()));
                await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);

                return (await Misc.isRouterActive(treeRouter)) === true;
            }, constants.explicitWait * 4, `Router did not became active`);

        });

        it("Browse the MySQL REST Service Documentation", async () => {

            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.browseRESTDocs,
                constants.checkNewTabAndWebView);
            try {
                await driver.wait(async () => {
                    const titles = await driver.findElements(locator.mrsDocumentation.title);
                    for (const title of titles) {
                        if (await title.getText() === "MRS Developer's Guide") {
                            return true;
                        }
                    }
                }, constants.explicitWait, "Could not find the title 'MRS Developer's Guide'");
            } finally {
                await Misc.switchBackToTopFrame();
                await new EditorView().closeEditor(constants.mrsDocs);
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

        before(async function () {
            try {
                const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await treeMySQLRESTService.expand();

                const services = [globalService, serviceToEdit];

                for (const service of services) {
                    await Misc.openContextMenuItem(treeMySQLRESTService, constants.addRESTService,
                        constants.checkWebViewDialog);
                    await Database.setRestService(service);

                    await Misc.switchBackToTopFrame();
                    await Misc.getNotification("The MRS service has been created");
                    expect(await Misc.existsTreeElement(constants.dbTreeSection,
                        `${service.servicePath} (${service.settings.hostNameFilter})`)).to.be.true;
                }
                await Misc.sectionFocus(constants.dbTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await Misc.switchBackToTopFrame();
            if (this.currentTest.state === "failed") {
                await Misc.expandNotifications();
                await Misc.processFailure(this);
                await Misc.dismissNotifications();
            }
        });

        it("Edit REST Service", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${serviceToEdit.servicePath} (${serviceToEdit.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.editRESTService, constants.checkWebViewDialog);
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

            await Database.setRestService(editedService);

            await Misc.switchBackToTopFrame();
            await Misc.getNotification("The MRS service has been successfully updated.");
            treeRandomService = await Misc
                .getTreeElement(constants.dbTreeSection,
                    `${editedService.servicePath} (${editedService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.editRESTService, constants.checkWebViewDialog);
            const service = await Database.getRestService();
            expect(editedService).to.deep.equal(service);
            serviceToEdit = editedService;

        });

        it("Add REST Service Schemas", async () => {

            const schemas = [sakilaRestSchema, worldRestSchema, restSchemaToDump];

            for (const schema of schemas) {
                const treeSchema = await Misc.getTreeElement(constants.dbTreeSection, schema.settings.schemaName);
                await Misc.openContextMenuItem(treeSchema, constants.addSchemaToREST, constants.checkWebViewDialog);
                await Database.setRestSchema(schema);
                await Misc.switchBackToTopFrame();
                await Misc.getNotification("The MRS schema has been added successfully.");
                const treeService = await Misc.getTreeElement(constants.dbTreeSection,
                    `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
                await treeService.expand();
                expect(await Misc.existsTreeElement(constants.dbTreeSection,
                    `${schema.restSchemaPath} (${schema.settings.schemaName})`)).to.exist;
            }

        });

        it("Edit REST Schema", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            const randomServiceLabel = await treeRandomService.getLabel();
            const treeService = await Misc.getTreeElement(constants.dbTreeSection, String(randomServiceLabel));
            await treeService.expand();
            const treeRestSchemaToEdit = await Misc.getTreeElement(constants.dbTreeSection,
                `${worldRestSchema.restSchemaPath} (${worldRestSchema.settings.schemaName})`);
            await Misc.openContextMenuItem(treeRestSchemaToEdit,
                constants.editRESTSchema, constants.checkWebViewDialog);

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

            await Database.setRestSchema(editedSchema);
            await Misc.switchBackToTopFrame();
            await Misc.getNotification("The MRS schema has been updated successfully");
            const treeEdited = await Misc.getTreeElement(constants.dbTreeSection,
                `${editedSchema.restSchemaPath} (${editedSchema.settings.schemaName})`);
            await Misc.openContextMenuItem(treeEdited, constants.editRESTSchema, constants.checkWebViewDialog);
            const thisSchema = await Database.getRestSchema();
            expect(thisSchema).to.deep.equal(editedSchema);

        });

        it("Set as Current REST Service", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.setAsCurrentREST, constants.checkNotif);
            await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                `${constants.dbTreeSection} is still loading`);
            await Misc.getNotification("The MRS service has been set as the new default service.");
            await driver.wait(async () => {
                return Misc.isDefaultItem(constants.dbTreeSection,
                    `${globalService.servicePath} (${globalService.settings.hostNameFilter})`,
                    "rest");
            }, constants.explicitWait, "REST Service tree item did not became default");
        });

        it("Add Tables to REST Service", async () => {

            const treeRestSakila = await Misc.getTreeElement(constants.dbTreeSection,
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await treeRestSakila.collapse();
            const treeSakila = await Misc.getTreeElement(constants.dbTreeSection, sakilaRestSchema.settings.schemaName);
            await treeSakila.expand();
            const treeTables = await Misc.getTreeElement(constants.dbTreeSection, "Tables");
            await treeTables.expand();

            const tables = ["actor", "address", tableToDump];

            for (const table of tables) {
                const treeTable = await Misc.getTreeElement(constants.dbTreeSection, table);
                await Misc.openContextMenuItem(treeTable, constants.addDBObjToREST, constants.checkNewTabAndWebView);
                await Database.setRestObject({
                    restServicePath: `${globalService.settings.hostNameFilter}${globalService.servicePath}`,
                });
                await Misc.switchBackToTopFrame();
                await Misc.getNotification(`The MRS Database Object ${table} was updated successfully`);
                await treeRestSakila.expand();
                expect(await Misc.existsTreeElement(constants.dbTreeSection, `/${table} (${table})`)).to.be.true;
            }

        });

        it("Dump Rest Schema to Json file", async () => {

            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);
            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.dumpRESTSchemaToJSON, constants.checkInput);
            await Misc.setInputPath(destDumpSchema);
            await Misc.getNotification(`The REST Schema has been dumped successfully`);
            await fs.access(`${destDumpSchema}.mrs.json`);
        });

        it("Dump REST Object to JSON file", async () => {

            const treeDumpTable = await Misc.getTreeElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`);
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await Misc.openContextMenuItem(treeDumpTable, constants.dumpRESTObjToJSON, constants.checkInput);
            await Misc.setInputPath(destDumpTable);
            await Misc.getNotification(`The REST Database Object has been dumped successfully`);
            await fs.access(`${destDumpTable}.mrs.json`);

        });

        it("Edit REST Object", async () => {
            const treeTable = await Misc.getTreeElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`);
            const editedObject: interfaces.IRestObject = {
                //restServicePath: `${serviceToEdit.settings.hostNameFilter}${serviceToEdit.servicePath}`,
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
            await Misc.openContextMenuItem(treeTable, constants.editRESTObj, constants.checkWebViewDialog);
            await Database.setRestObject(editedObject);
            await Misc.switchBackToTopFrame();
            const ntf = `The MRS Database Object ${editedObject.jsonRelDuality.dbObject} was updated successfully`;
            await Misc.getNotification(ntf);
            const treeEdited = await Misc.getTreeElement(constants.dbTreeSection,
                `${editedObject.restObjectPath} (${editedObject.jsonRelDuality.dbObject})`);
            await Misc.openContextMenuItem(treeEdited, constants.editRESTObj, constants.checkWebViewDialog);
            const thisObject = await Database.getRestObject();
            expect(thisObject).to.deep.equal(editedObject);
            tableToEdit = editedObject;
        });

        it("Copy REST Object Request Path to Clipboard", async () => {
            const actorTree = await Misc.getTreeElement(constants.dbTreeSection,
                `/${actorTable} (${actorTable})`);

            await Misc.openContextMenuItem(actorTree, constants.copyRESTObjReqPath, constants.checkNotif);
            expect(await Misc.getNotification("The DB Object was copied to the system clipboard")).to.exist;
            const expected = `${sakilaRestSchema.restServicePath}${sakilaRestSchema.restSchemaPath}/${actorTable}`;
            await driver.wait(() => {
                return clipboard.readSync() === expected;
            }, constants.explicitWait, `${expected} was not found on the clipboard`);

        });

        it("Delete REST Object", async () => {

            const treeTableToDump = await Misc.getTreeElement(constants.dbTreeSection,
                `${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`);
            await Misc.openContextMenuItem(treeTableToDump, constants.deleteRESTObj, constants.checkDialog);
            const dialog = new ModalDialog();
            await dialog.pushButton(`Delete DB Object`);
            await Misc.getNotification(`The REST DB Object abc has been deleted`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${tableToEdit.restObjectPath} (${tableToEdit.jsonRelDuality.dbObject})`)).to.be.false;

        });

        it("Delete REST Schema", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await treeRandomService.expand();
            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`);

            // first we click to delete the schema but we change our mind later (BUG#35377927)
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, constants.checkNotif);
            const txt = `Are you sure the MRS schema ${restSchemaToDump.settings.schemaName} should be deleted?`;
            let ntf = await Misc.getNotification(txt, false);
            await Misc.clickOnNotificationButton(ntf, "No");
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.true;

            // now we try again, but we really want to delete the schema
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.deleteRESTSchema, constants.checkNotif);
            ntf = await Misc.getNotification(txt, false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification("The MRS schema has been deleted successfully");
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.false;
        });

        it("Load REST Schema from JSON file", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.loadRESTSchemaFromJSON, constants.checkInput);
            await Misc.setInputPath(`${destDumpSchema}.mrs.json`);
            await Misc.getNotification("The REST Schema has been loaded successfully");
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${restSchemaToDump.restSchemaPath} (${restSchemaToDump.settings.schemaName})`)).to.be.true;

        });

        it("Export Rest Service SDK files", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.exportRESTSDK, constants.checkInput);
            const dest = join(process.cwd(), "dump.sdk");
            await fs.rm(dest, { force: true, recursive: true });
            await Misc.setInputPath(dest);
            await Misc.getNotification("MRS Service REST Files exported successfully");
            const files = await fs.readdir(dest);
            expect(files.length).to.be.greaterThan(0);
        });

        it("Load REST Object from JSON file", async () => {

            const treeMySQLRESTSchema = await Misc.getTreeElement(constants.dbTreeSection,
                `${sakilaRestSchema.restSchemaPath} (${sakilaRestSchema.settings.schemaName})`);
            await Misc.openContextMenuItem(treeMySQLRESTSchema, constants.loadRESTObjFromJSON, constants.checkInput);
            await Misc.setInputPath(`${destDumpTable}.mrs.json`);
            await Misc.getNotification("The REST Database Object has been loaded successfully");
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `/${tableToDump} (${tableToDump})`)).to.be.true;

        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`);
            await Misc.openContextMenuItem(treeAuthApp, constants.deleteAuthenticationApp, constants.checkNotif);
            const ntf = await Misc.getNotification(
                `Are you sure the MRS authentication app ${globalService.authenticationApps.name} should be deleted`,
                false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            const test = `The MRS Authentication App ${globalService.authenticationApps.name} has been deleted`;
            await Misc.getNotification(test);
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${globalService.authenticationApps.name} (${globalService.authenticationApps.vendor})`)).to.be.false;

        });

        it("Add New Authentication App", async () => {

            let treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.addNewAuthApp, constants.checkWebViewDialog);
            await Database.setRestAuthenticationApp(restAuthenticationApp);
            await Misc.switchBackToTopFrame();
            await Misc.getNotification("The MRS Authentication App has been added");
            treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await treeRandomService.expand();
            expect(await Misc.existsTreeElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`)).to.be.true;

        });

        it("Add User", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await Misc.openContextMenuItem(treeAuthApp, constants.addRESTUser, constants.checkWebViewDialog);
            await Database.setRestUser(restUser);
            await Misc.switchBackToTopFrame();
            await Misc.getNotification("The MRS User has been added");
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await driver.wait(async () => {
                await treeAuthApp.expand();

                return (await treeAuthApp.isExpanded()) && (await treeAuthApp.getChildren()).length > 0;
            }, constants.explicitWait * 2,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor}) was not expanded`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, restUser.username)).to.be.true;

        });

        it("Edit Authentication App", async () => {

            let treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await Misc.openContextMenuItem(treeAuthApp, constants.editAuthenticationApp, constants.checkWebViewDialog);

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

            await Database.setRestAuthenticationApp(editedApp);
            await Misc.switchBackToTopFrame();
            await Misc.getNotification("The MRS Authentication App has been updated");
            treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${editedApp.name} (${editedApp.vendor})`);
            await Misc.openContextMenuItem(treeAuthApp, constants.editAuthenticationApp, constants.checkWebViewDialog);
            const authApp = await Database.getAuthenticationApp();
            expect(editedApp).to.deep.equal(authApp);
            restAuthenticationApp = editedApp;

        });

        it("Edit User", async () => {

            const treeAuthApp = await Misc.getTreeElement(constants.dbTreeSection,
                `${restAuthenticationApp.name} (${restAuthenticationApp.vendor})`);
            await treeAuthApp.expand();
            let treeUser = await Misc.getTreeElement(constants.dbTreeSection, restUser.username);
            await Misc.openContextMenuItem(treeUser, constants.editRESTUser, constants.checkWebViewDialog);
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

            await Database.setRestUser(editedUser);
            await Misc.switchBackToTopFrame();
            await Misc.getNotification(`The MRS User has been updated`);
            treeUser = await Misc.getTreeElement(constants.dbTreeSection, editedUser.username);
            await Misc.openContextMenuItem(treeUser, constants.editRESTUser, constants.checkWebViewDialog);
            const user = await Database.getRestUser();
            editedUser.assignedRoles = "Full Access";
            expect(editedUser).to.deep.equal(user);
            restUser = editedUser;
        });

        it("MRS Service Documentation", async () => {

            const treeRandomService = await Misc.getTreeElement(constants.dbTreeSection,
                `${globalService.servicePath} (${globalService.settings.hostNameFilter})`);
            await Misc.openContextMenuItem(treeRandomService, constants.mrsServiceDocs,
                constants.checkNewTabAndWebView);
            await driver.wait(until
                .elementLocated(locator.mrsDocumentation.restServiceProperties), constants.explicitWait);
            await Misc.switchBackToTopFrame();
            await new EditorView().closeEditor(constants.mrsDocs);

        });

        it("Delete User", async () => {

            const treeUser = await Misc.getTreeElement(constants.dbTreeSection, restUser.username);
            await Misc.openContextMenuItem(treeUser, constants.deleteRESTUser, constants.checkNotif);
            const ntf = await Misc.getNotification(`Are you sure the MRS user ${restUser.username} should be deleted`,
                false);
            await Misc.clickOnNotificationButton(ntf, "Yes");
            await Misc.getNotification(`The MRS User ${restUser.username} has been deleted`);
            expect(await Misc.existsTreeElement(constants.dbTreeSection, restUser.username)).to.be.false;
        });

        it("Delete REST Services", async () => {

            const services = [globalService, serviceToEdit];
            for (const service of services) {
                const treeRestService = await Misc.getTreeElement(constants.dbTreeSection,
                    `${service.servicePath} (${service.settings.hostNameFilter})`);
                await Misc.openContextMenuItem(treeRestService, constants.deleteRESTService, constants.checkNotif);
                const ntf = await Misc
                    .getNotification(`Are you sure the MRS service ${service.servicePath} should be deleted`, false);
                await Misc.clickOnNotificationButton(ntf, "Yes");
                await Misc.getNotification("The MRS service has been deleted successfully");
                expect(await Misc.existsTreeElement(constants.dbTreeSection,
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
                hostNameFilter: "127.0.0.1:8443",
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
                await Misc.cleanCredentials();
                let treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await treeMySQLRESTService.expand();
                await Misc.openContextMenuItem(treeMySQLRESTService, constants.addRESTService,
                    constants.checkNewTabAndWebView);
                await Database.setRestService(crudService);
                await Misc.switchBackToTopFrame();
                await Misc.getNotification("The MRS service has been created.");
                await driver.wait(async () => {
                    const refSchema = await Misc.getTreeElement(constants.dbTreeSection,
                        crudSchema.settings.schemaName);
                    await refSchema.expand();

                    return (await refSchema.isExpanded()) && (refSchema.hasChildren());
                }, constants.explicitWait, "sakila tree item was not expanded");
                const treeSchema = await Misc.getTreeElement(constants.dbTreeSection, crudSchema.settings.schemaName);
                await Misc.openContextMenuItem(treeSchema, constants.addSchemaToREST, constants.checkWebViewDialog);
                await Database.setRestSchema(crudSchema);
                await Misc.switchBackToTopFrame();
                await Misc.getNotification("The MRS schema has been added successfully.");
                const treeService = await Misc.getTreeElement(constants.dbTreeSection,
                    `${crudService.servicePath} (${crudService.settings.hostNameFilter})`);
                await treeService.expand();
                expect(await Misc.existsTreeElement(constants.dbTreeSection,
                    `${crudSchema.restSchemaPath} (${crudSchema.settings.schemaName})`)).to.exist;
                await (await Misc.getTreeElement(constants.dbTreeSection, "Tables")).expand();
                const treeTable = await Misc.getTreeElement(constants.dbTreeSection,
                    crudObject.restObjectPath.replace("/", ""));
                await Misc.openContextMenuItem(treeTable, constants.addDBObjToREST, constants.checkWebViewDialog);
                await Database.setRestObject(crudObject);
                await Misc.switchBackToTopFrame();
                let ntf = `The MRS Database Object ${crudObject.restObjectPath.replace("/", "")}`;
                ntf += ` was updated successfully`;
                await Misc.getNotification(ntf);

                // Check Router
                treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
                await Misc.openContextMenuItem(treeMySQLRESTService, constants.startRouter, undefined);
                await Misc.waitForTerminalText(
                    "Start accepting connections for routing routing:bootstrap_x_rw listening on",
                    constants.explicitWait * 2);
                await driver.wait(async () => {
                    const treeRouter = await Misc.getTreeElement(constants.dbTreeSection, new RegExp(hostname()));
                    await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
                        constants.reloadConnections);
                    await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                        `${constants.dbTreeSection} is still loading`);

                    return (await Misc.isRouterActive(treeRouter)) === true;
                }, constants.explicitWait * 4, `Router did not became active`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                if (response) {
                    console.log("---CURL RESULT---");
                    console.log(response.status);
                    console.log(response.json());
                }
                await Misc.processFailure(this);
            }
            response = undefined;
        });

        after(async () => {
            const treeMySQLRESTService = await Misc.getTreeElement(constants.dbTreeSection, "MySQL REST Service");
            await Misc.openContextMenuItem(treeMySQLRESTService, constants.stopRouter, constants.checkTerminal);
            await Misc.waitForTerminalText(["mysqlrouter\\stop", "Unloading all plugins"], constants.explicitWait * 2);
            await driver.wait(async () => {
                const treeRouter = await Misc.getTreeElement(constants.dbTreeSection, new RegExp(hostname()));
                await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
                    constants.reloadConnections);
                await driver.wait(Until.isNotLoading(constants.dbTreeSection), constants.explicitWait * 2,
                    `${constants.dbTreeSection} is still loading`);

                return (await Misc.isRouterActive(treeRouter)) === false;
            }, constants.explicitWait * 3, `Router did not became inactive`);

            await Misc.openContextMenuItem(treeMySQLRESTService, constants.killRouters, undefined);
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
                body: JSON.stringify({ firstName: "Mister", lastName: "Test", lastUpdate: "2023-06-23 13:32:54" }),
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
