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
import { ExportSDKDialog } from "../lib/WebViews/Dialogs/ExportSDKDialog";
import { TestQueue } from "../lib/TestQueue";
import { E2ERestService } from "../lib/SideBar/E2ERestService";
import { E2ERestSchema } from "../lib/SideBar/E2ERestSchema";
import { E2ERestObject } from "../lib/SideBar/E2ERestObject";
import { existsSync } from "fs";

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
    let routerPort: string;
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    before(async function () {

        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.wait1minute * 2);
            await Workbench.toggleBottomBar(false);
            Misc.removeDatabaseConnections();

            await dbTreeSection.focus();
            await dbTreeSection.clickToolbarButton(constants.reloadConnections);
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

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
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
            await dbTreeSection.tree.expandElement([constants.mysqlRestService]);
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.disableRESTService);
            await Workbench.setInputPassword((globalConn.basic as interfaces.IConnBasicMySQL).password);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.reloadConnections);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
                await dbTreeSection.tree.expandElement([constants.mysqlRestService]);

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
            await dbTreeSection.tree.expandElement([constants.mysqlRouters]);
            await driver.wait(dbTreeSection.tree.untilExists(new RegExp(hostname())), constants.wait5seconds);
            const router = await dbTreeSection.tree.getElement(new RegExp(hostname()));
            expect(await dbTreeSection.tree.routerHasError(router), "Please update Router").to.be.false;
            await Os.setRouterConfigFile({
                sinks: "filelog",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                logging_folder: process.cwd(),
            });
        });

        it("Start Local MySQL Router Instance", async () => {

            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await treeMySQLRestService.expand();
            const logFile = await Os.getRouterLogFile();

            if (existsSync(logFile)) {
                await fs.truncate(logFile);
            }

            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.startRouter);
            await driver.wait(Os.untilRouterLogFileExists(), constants.wait5seconds);
            await driver.wait(Os.untilRouterIsActive(), constants.wait20seconds);
        });

        it("Stop Local MySQL Router Instance", async () => {
            const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
            await treeMySQLRestService.expand();
            await fs.truncate(await Os.getRouterLogFile());
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.stopRouter);
            await driver.wait(Os.untilRouterIsInactive(), constants.wait20seconds);
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
            servicePath: `/globalService`,
            enabled: true,
            default: false,
            published: false,
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
        };

        const serviceToEdit: interfaces.IRestService = {
            treeName: ``,
            servicePath: `/serviceToEdit`,
            enabled: true,
            default: false,
            settings: {
                comments: "testing",
            },
            authentication: {
                redirectionUrl: "localhost:8000",
                redirectionUrlValid: "(.*)",
                authCompletedChangeCont: "<html>",
            },
            advanced: {
                hostNameFilter: "localhost",
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
            treeName: `/${schemaToDump} (${schemaToDump})`,
            restSchemaPath: `/${schemaToDump}`,
            settings: {
                schemaName: schemaToDump,
            },
        };

        const restAuthenticationApp: interfaces.IRestAuthenticationApp = {
            treeName: `new app (${constants.vendorOCIOAuth2})`,
            vendor: constants.vendorOCIOAuth2,
            name: "new app",
            enabled: true,
            limitToRegisteredUsers: true,
            settings: {
                description: "this is an authentication app",
                defaultRole: "Full Access",
            },
            oauth2settings: {
                appId: "1234",
                appSecret: "1234test",
                customURL: "http://localhost",
                customURLforAccessToken: "http://localhost/1234",
            },
            options: `{ "name": "test options" }`,
        };

        const restUser: interfaces.IRestUser = {
            username: "gui",
            authenticationApp: restAuthenticationApp.name,
            email: "user@oracle.com",
            assignedRoles: undefined,
            userOptions: "",
            permitLogin: true,
            vendorUserId: "1234",
            mappedUserId: "testing",
        };

        const destDumpSchema = join(process.cwd(), restSchemaToDump.settings.schemaName);
        const destDumpTable = join(process.cwd(), tableToDump);
        const destDumpSdk = join(process.cwd(), "dump.sdk");
        let existsInQueue = false;

        const restGlobalService = new E2ERestService(globalService);
        const restServiceToEdit = new E2ERestService(serviceToEdit);

        before(async function () {
            try {
                const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
                await treeMySQLRestService.expand();

                const services = [restGlobalService, restServiceToEdit];

                for (const service of services) {
                    await service.create();
                    await driver.wait(Workbench.untilNotificationExists("The MRS service has been created"),
                        constants.wait20seconds);
                    await driver.wait(dbTreeSection.tree.untilExists(service.treeName), constants.wait10seconds);
                }
                await dbTreeSection.focus();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
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

            await Workbench.dismissNotifications();
        });

        after(async () => {
            await fs.rm(destDumpSdk, { force: true, recursive: true });
        });

        it("Set as Current REST Service", async () => {

            const treeService = await dbTreeSection.tree.getElement(restGlobalService.treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeService, constants.setAsCurrentREST);
            await driver.wait(Workbench
                .untilNotificationExists("The MRS service has been set as the new default service."),
                constants.wait10seconds);
            await driver.wait(dbTreeSection.tree.untilIsDefault(restGlobalService.treeName, "rest"),
                constants.wait5seconds, "REST Service tree item did not became default");

        });

        it("Add REST Service Schemas", async () => {

            const schemas = [
                sakilaRestSchema,
                worldRestSchema,
                restSchemaToDump,
            ];

            for (const schema of schemas) {
                await new E2ERestSchema(restGlobalService, schema).add();
                await driver.wait(Workbench.untilNotificationExists("The MRS schema has been added successfully."),
                    constants.wait10seconds);

                await dbTreeSection.tree.expandElement([restGlobalService.treeName]);
                await driver.wait(dbTreeSection.tree
                    .untilExists(restGlobalService.restSchemas[restGlobalService.restSchemas.length - 1].treeName),
                    constants.wait10seconds);
            }

        });

        it("Add Tables to REST Service", async () => {

            const tables: interfaces.IRestObject[] = [
                { dataMapping: { dbObject: "actor" } },
                { dataMapping: { dbObject: "address" } },
                { dataMapping: { dbObject: tableToDump } },
            ];

            await dbTreeSection.tree.expandElement([restGlobalService.restSchemas[0].treeName]);

            for (const table of tables) {
                await new E2ERestObject(restGlobalService.restSchemas[0], table).add();

                let notification = `The MRS Database Object ${table.dataMapping.dbObject}`;
                notification += " was successfully updated";
                await driver.wait(Workbench.untilNotificationExists(notification), constants.wait5seconds);

                await driver.wait(dbTreeSection.tree
                    .untilExists(restGlobalService.restSchemas[0].restObjects[restGlobalService.restSchemas[0]
                        .restObjects.length - 1].treeName), constants.wait5seconds);
            }

        });

        it("Service - Dump to Disk - Create Statements", async () => {

            let dumpedService = join(process.cwd(), "dumpedService.mrs.sql");
            const treeService = await dbTreeSection.tree.getElement(restGlobalService.treeName);
            await fs.rm(dumpedService, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                [constants.dumpToDisk, constants.exportCreateServiceStatement], constants.restServiceCtxMenu);
            await Workbench.setInputPath(dumpedService);
            await driver.wait(Workbench.untilNotificationExists(`The REST Service SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedService);
            let fileData = (await fs.readFile(dumpedService)).toString();
            expect(fileData).to.match(new RegExp(restGlobalService.servicePath));

            await fs.unlink(dumpedService);
            dumpedService = join(process.cwd(), "dumpedServiceAllObjects.mrs.sql");
            await fs.rm(dumpedService, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                [constants.dumpToDisk, constants.exportCreateServiceStatementAll], constants.restServiceCtxMenu);
            await Workbench.setInputPath(dumpedService);
            await driver.wait(Workbench.untilNotificationExists(`The REST Service SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedService);
            fileData = (await fs.readFile(dumpedService)).toString();
            expect(fileData).to.match(new RegExp(restGlobalService.servicePath));
            expect(fileData).to.match(new RegExp(sakilaRestSchema.restSchemaPath));
            expect(fileData).to.match(/actor/);
            expect(fileData).to.match(/address/);
            await fs.unlink(dumpedService);

        });

        it("Service - Copy to clipboard - Create Statements", async () => {

            const treeService = await dbTreeSection.tree.getElement(restGlobalService.treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                [constants.copyToClipboard, constants.copyCreateServiceStatement], constants.restServiceCtxMenu);

            let regex = new RegExp(`CREATE REST SERVICE ${restGlobalService.servicePath}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                        [constants.copyToClipboard, constants.copyCreateServiceStatement],
                        constants.restServiceCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Service create statement was not copied to the clipboard");

            await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                [constants.copyToClipboard, constants.copyCreateServiceStatementAll], constants.restServiceCtxMenu);

            regex = new RegExp(`CREATE REST SERVICE ${restGlobalService.servicePath}`);
            const regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${sakilaRestSchema.restSchemaPath}`);
            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null &&
                    clipboardContent.match(regexSchema) === null &&
                    clipboardContent.match(regexObject) === null
                ) {

                    console.log(`[DEBUG] clipboard content: ${clipboardContent}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                        [constants.copyToClipboard, constants.copyCreateServiceStatementAll],
                        constants.restServiceCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Service create statement with all objects was not copied to the clipboard");

        });

        it("Schema - Dump to Disk - Create Statements", async () => {

            let dumpedSchema = join(process.cwd(), "dumpedSchema.mrs.sql");
            const treeSakilaSchema = await dbTreeSection.tree.getElement(restGlobalService.restSchemas[0].treeName);
            await fs.rm(dumpedSchema, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                [constants.dumpToDisk, constants.exportCreateSchemaStatement], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(dumpedSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedSchema);
            let fileData = (await fs.readFile(dumpedSchema)).toString();
            expect(fileData).to.match(new RegExp(restGlobalService.restSchemas[0].restSchemaPath));

            await fs.unlink(dumpedSchema);
            dumpedSchema = join(process.cwd(), "dumpedSchemaAllObjects.mrs.sql");
            await fs.rm(dumpedSchema, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                [constants.dumpToDisk, constants.exportCreateSchemaStatementAll], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(dumpedSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedSchema);
            fileData = (await fs.readFile(dumpedSchema)).toString();
            expect(fileData).to.match(new RegExp(sakilaRestSchema.restSchemaPath));
            expect(fileData).to.match(/actor/);
            expect(fileData).to.match(/address/);
            await fs.unlink(dumpedSchema);
        });

        it("Schema - Copy to clipboard - Create Statements", async () => {

            const treeSakilaSchema = await dbTreeSection.tree.getElement(restGlobalService.restSchemas[0].treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                [constants.copyToClipboard, constants.copyCreateSchemaStatement], constants.restSchemaCtxMenu);

            let regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${restGlobalService.restSchemas[0]
                .restSchemaPath}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regexSchema) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                        [constants.copyToClipboard, constants.copyCreateSchemaStatement],
                        constants.restSchemaCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Schema Create statement was not copied to the clipboard");

            await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                [constants.copyToClipboard, constants.copyCreateSchemaStatementAll], constants.restSchemaCtxMenu);

            regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${sakilaRestSchema.restSchemaPath}`);
            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (
                    clipboardContent.match(regexSchema) === null &&
                    clipboardContent.match(regexObject) === null
                ) {

                    console.log(`[DEBUG] clipboard content: ${clipboardContent}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeSakilaSchema,
                        [constants.copyToClipboard, constants.copyCreateSchemaStatementAll],
                        constants.restSchemaCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Schema Create statement with all objects was not copied to the clipboard");

        });

        it("Object - Dump to Disk - Create Statements", async () => {

            const dumpedObject = join(process.cwd(), "dumpedObject.mrs.sql");
            const treeObject = await dbTreeSection.tree
                .getElement(restGlobalService.restSchemas[0].restObjects[0].treeName);
            await fs.rm(dumpedObject, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeObject,
                [constants.dumpToDisk, constants.createStatement3Dots], constants.restObjCtxMenu);
            await Workbench.setInputPath(dumpedObject);
            await driver.wait(Workbench.untilNotificationExists(`The REST DB OBJECT SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedObject);
            const fileData = (await fs.readFile(dumpedObject)).toString();
            expect(fileData).to.match(new RegExp(restGlobalService.restSchemas[0].restObjects[0].dataMapping.dbObject));
            await fs.unlink(dumpedObject);

        });

        it("Object - Copy to clipboard - Create Statements", async () => {

            const treeObject = await dbTreeSection.tree
                .getElement(restGlobalService.restSchemas[0].restObjects[0].treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeObject,
                [constants.copyToClipboard, constants.createStatement], constants.restObjCtxMenu);

            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regexObject) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeObject,
                        [constants.copyToClipboard, constants.createStatement], constants.restObjCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Object create statement was not copied to the clipboard");

        });

        it("Add and Link New REST Authentication App", async () => {

            await restGlobalService.addAndLinkAuthenticationApp(restAuthenticationApp);
            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been added"),
                constants.wait5seconds);
            await dbTreeSection.tree.expandElement([constants.restAuthenticationApps]);
            await driver.wait(dbTreeSection.tree.untilExists(restAuthenticationApp.treeName), constants.wait5seconds);
        });

        it("Add User", async () => {

            await dbTreeSection.tree.collapseElement(restGlobalService.treeName);
            await restGlobalService.authenticationApps[1].addUser(restUser);
            await driver.wait(Workbench.untilNotificationExists(`The MRS User "${restUser.username}" has been added`),
                constants.wait5seconds);
            await dbTreeSection.tree.expandElement([restGlobalService.authenticationApps[1].treeName]);
            await driver.wait(dbTreeSection.tree.untilExists(restGlobalService.authenticationApps[1].treeName),
                constants.wait5seconds);
        });

        it("Edit REST Service", async () => {
            const editedService = {
                servicePath: `/edited`,
                enabled: true,
                default: true,
                settings: {
                    comments: "change testing",
                },
                options: `{"test":"value"}`,
                authentication: {
                    authenticationPath: "/authenticationPath",
                    redirectionUrl: "localhost:8001",
                    redirectionUrlValid: "(.*)(.*)",
                    authCompletedChangeCont: "<body>",
                },
                advanced: {
                    hostNameFilter: "127.0.0.1",
                },
            };

            await dbTreeSection.tree.expandElement([restGlobalService.treeName]);
            await restServiceToEdit.edit(editedService);
            await driver.wait(Workbench.untilNotificationExists("The MRS service has been successfully updated."),
                constants.wait10seconds);
            await driver.wait(dbTreeSection.tree.untilExists(restServiceToEdit.treeName));
            expect(await restServiceToEdit.get()).to.deep.equal(editedService);
        });

        it("Edit REST Schema", async () => {
            const worldSchema = restGlobalService.restSchemas[1];
            const editedSchema = {
                restServicePath: worldSchema.restServicePath,
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

            await worldSchema.edit(editedSchema);
            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been updated successfully."),
                constants.wait10seconds);

            await driver.wait(dbTreeSection.tree.untilExists(worldSchema.treeName), constants.wait10seconds);
            expect(await worldSchema.get()).to.deep.equal(editedSchema);
        });

        it("Edit REST Object", async () => {

            const abcTable = restGlobalService.restSchemas[0].restObjects[2];

            const editedObject: interfaces.IRestObject = {
                treeName: "/editedObject",
                restServicePath: abcTable.parentSchema.restServicePath,
                restSchemaPath: sakilaRestSchema.restSchemaPath,
                restObjectPath: `/editedObject`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                dataMapping: {
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

            await abcTable.edit(editedObject);

            let notification = `The MRS Database Object ${editedObject.dataMapping.dbObject}`;
            notification += ` was successfully updated`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait5seconds);
            await driver.wait(dbTreeSection.tree.untilExists(abcTable.treeName), constants.wait5seconds);
            expect(await abcTable.get()).to.deep.equal(editedObject);
        });

        it("Edit Authentication App", async () => {

            const authAppToEdit = restGlobalService.authenticationApps[0];
            const editedApp: interfaces.IRestAuthenticationApp = {
                treeName: `another new app (${constants.vendorOCIOAuth2})`,
                vendor: constants.vendorOCIOAuth2,
                name: "another new app",
                enabled: false,
                limitToRegisteredUsers: false,
                settings: {
                    description: "this is another authentication app",
                    defaultRole: "Full Access",
                },
                oauth2settings: {
                    appId: "0000",
                    appSecret: "111test",
                    customURL: "http://127.0.0.1",
                    customURLforAccessToken: "http://127.0.0.1/1234",
                },
                options: `{"name":"option123"}`,
            };

            await dbTreeSection.tree.collapseElement(globalService.treeName);
            await authAppToEdit.edit(editedApp);
            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been updated"),
                constants.wait5seconds);

            await driver.wait(dbTreeSection.tree.untilExists(editedApp.treeName), constants.wait5seconds);
            expect(await authAppToEdit.get()).to.deep.equal(editedApp);
        });

        it("Edit User", async () => {

            const userToEdit = restGlobalService.authenticationApps[0].users[0];

            const editedUser: interfaces.IRestUser = {
                username: "testUser",
                authenticationApp: userToEdit.parentAuthApp.name,
                email: "testuser@oracle.com",
                assignedRoles: "Full Access",
                userOptions: `{"test":"value"}`,
                permitLogin: false,
                vendorUserId: "123467",
                mappedUserId: "stillTesting",
            };
            await userToEdit.edit(editedUser);

            await driver.wait(Workbench
                .untilNotificationExists(`The MRS User "${editedUser.username}" has been updated.`),
                constants.wait5seconds);

            await dbTreeSection.tree.expandElement([restGlobalService.authenticationApps[0].treeName]);

            await driver.wait(dbTreeSection.tree.untilExists(editedUser.username), constants.wait5seconds);
            const userInfo = await userToEdit.get();
            editedUser.password = "[Stored Password]";
            expect(userInfo).to.deep.equal(editedUser);
        });

        it("Dump Rest Schema to Json file", async () => {

            await dbTreeSection.tree.expandElement([restGlobalService.treeName]);
            const dummySchema = restGlobalService.restSchemas[2];
            const treeMySQLRestSchema = await dbTreeSection.tree.getElement(dummySchema.treeName);
            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestSchema,
                [constants.dumpToDisk, constants.dumpRESTSchemaToJSON], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(destDumpSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema has been dumped successfully`),
                constants.wait5seconds);
            await fs.access(`${destDumpSchema}.mrs.json`);
        });

        it("Dump REST Object to JSON file", async () => {

            const tree = [
                restGlobalService.treeName,
                restGlobalService.restSchemas[0].treeName,
            ];

            await dbTreeSection.tree.expandElement(tree);
            const treeTableToDump = restGlobalService.restSchemas[0].restObjects[2].treeName;
            const treeDumpTable = await dbTreeSection.tree.getElement(treeTableToDump);
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeDumpTable,
                [constants.dumpToDisk, constants.restObjectToJSONFile], constants.restObjCtxMenu);
            await Workbench.setInputPath(destDumpTable);
            await driver.wait(Workbench
                .untilNotificationExists(`The REST Database Object has been dumped successfully`),
                constants.wait5seconds);
            console.log(`Dumped to: ${destDumpTable}.mrs.json`);
            await fs.access(`${destDumpTable}.mrs.json`);

        });

        it("Copy REST Object Request Path to Clipboard", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeActor = restGlobalService.restSchemas[0].restObjects[0].treeName;
            const actorTree = await dbTreeSection.tree.getElement(treeActor);
            await dbTreeSection.tree.openContextMenuAndSelect(actorTree,
                [constants.copyToClipboard, constants.restObjectRequestPath], constants.restObjCtxMenu);

            const servicePath = restGlobalService.servicePath;
            const schemaPath = restGlobalService.restSchemas[0].restSchemaPath;
            const actorTable = restGlobalService.restSchemas[0].restObjects[0].dataMapping.dbObject;

            const url = `https://localhost.*${servicePath}${schemaPath}/${actorTable}`;
            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(new RegExp(url)) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(actorTree,
                        [constants.copyToClipboard, constants.restObjectRequestPath], constants.restObjCtxMenu);
                    await driver.wait(Workbench
                        .untilNotificationExists("The DB Object Path was copied to the system clipboard"),
                        constants.wait5seconds);
                } else {
                    return true;
                }
            }, constants.wait15seconds, `${url} was not found on the clipboard`);

        });

        it("Authentication App - Dump to disk - Create statements", async () => {

            let dumpedAuthApp = join(process.cwd(), "dumpedAuthApp.mrs.sql");
            await fs.rm(dumpedAuthApp, { recursive: true, force: true });
            await dbTreeSection.tree.collapseElement(constants.restAuthenticationApps);
            const treeAuthApp = await dbTreeSection.tree.getElement(restGlobalService.authenticationApps[0].treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                [constants.dumpToDisk, constants.createStatement3Dots], constants.restAppCtxMenu1);
            await Workbench.setInputPath(dumpedAuthApp);
            await driver.wait(Workbench.untilNotificationExists(`The REST Authentication App SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedAuthApp);
            let fileData = (await fs.readFile(dumpedAuthApp)).toString();

            let regex = new RegExp(`CREATE OR REPLACE REST AUTH APP "${restGlobalService.authenticationApps[0]
                .name}"`);
            expect(fileData).to.match(regex);

            await fs.unlink(dumpedAuthApp);
            dumpedAuthApp = join(process.cwd(), "dumpedAuthAppAllObjects.mrs.sql");
            await fs.rm(dumpedAuthApp, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                [constants.dumpToDisk, constants.createStatementIncludingAllObjects3Dots], constants.restAppCtxMenu1);
            await Workbench.setInputPath(dumpedAuthApp);
            await driver.wait(Workbench.untilNotificationExists(`The REST Authentication App SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedAuthApp);
            fileData = (await fs.readFile(dumpedAuthApp)).toString();

            expect(fileData).to.match(regex);
            regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0].users[0]
                .username}"`);
            expect(fileData).to.match(regex);
            await fs.unlink(dumpedAuthApp);

        });

        it("Authentication App - Copy to clipboard - Create Statements", async () => {

            const treeAuthApp = await dbTreeSection.tree.getElement(restGlobalService.authenticationApps[0].treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                [constants.copyToClipboard, constants.createStatement], constants.restAppCtxMenu1);

            let regex = new RegExp(`CREATE OR REPLACE REST AUTH APP "${restGlobalService.authenticationApps[0]
                .name}"`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                        [constants.copyToClipboard, constants.createStatement], constants.restAppCtxMenu1);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "Authentication app Create statement was not copied to the clipboard");

            await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                [constants.copyToClipboard, constants.createStatementIncludingAllObjects], constants.restAppCtxMenu1);

            regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0].users[0]
                .username}"`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboardContent}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeAuthApp,
                        [constants.copyToClipboard, constants.createStatementIncludingAllObjects],
                        constants.restAppCtxMenu1);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds,
                "Authentication app Create statement with all objects was not copied to the clipboard");

        });

        it("User - Dump to disk - Create statements", async () => {

            let dumpedUser = join(process.cwd(), "dumpedUser.mrs.sql");
            await dbTreeSection.tree.expandElement([constants.restAuthenticationApps]);
            const treeUser = await dbTreeSection.tree
                .getElement(restGlobalService.authenticationApps[0].users[0].username);
            await fs.rm(dumpedUser, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                [constants.dumpToDisk, constants.createStatement3Dots], constants.restUserCtxMenu);
            await Workbench.setInputPath(dumpedUser);
            await driver.wait(Workbench.untilNotificationExists(`The REST User SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedUser);
            let fileData = (await fs.readFile(dumpedUser)).toString();

            let regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0].users[0]
                .username}"`);
            expect(fileData).to.match(regex);

            await fs.unlink(dumpedUser);
            dumpedUser = join(process.cwd(), "dumpedAuthAppAllObjects.mrs.sql");
            await fs.rm(dumpedUser, { recursive: true, force: true });
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                [constants.dumpToDisk, constants.createStatementIncludingAllObjects3Dots], constants.restUserCtxMenu);
            await Workbench.setInputPath(dumpedUser);
            await driver.wait(Workbench.untilNotificationExists(`The REST User SQL was exported`),
                constants.wait5seconds);
            await fs.access(dumpedUser);
            fileData = (await fs.readFile(dumpedUser)).toString();

            expect(fileData).to.match(regex);
            regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0].users[0]
                .username}"`);

            expect(fileData).to.match(regex);
            expect(fileData).to.match(/GRANT REST ROLE/);
            await fs.unlink(dumpedUser);

        });

        it("User - Copy to clipboard - Create Statements", async () => {

            const treeUser = await dbTreeSection.tree.getElement(restGlobalService.authenticationApps[0]
                .users[0].username);
            await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                [constants.copyToClipboard, constants.createStatement], constants.restUserCtxMenu);

            let regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0]
                .users[0].username}"`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    console.log(`[DEBUG] clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                        [constants.copyToClipboard, constants.createStatement], constants.restUserCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds, "User Create statement was not copied to the clipboard");

            await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                [constants.copyToClipboard, constants.createStatementIncludingAllObjects], constants.restUserCtxMenu);

            regex = new RegExp(`CREATE OR REPLACE REST USER "${restGlobalService.authenticationApps[0].users[0]
                .username}"`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null && clipboardContent.match(/GRANT REST ROLE/)) {

                    console.log(`[DEBUG] clipboard content: ${clipboardContent}`);
                    await dbTreeSection.tree.openContextMenuAndSelect(treeUser,
                        [constants.copyToClipboard, constants.createStatementIncludingAllObjects],
                        constants.restUserCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait5seconds);

                return true;
            }, constants.wait5seconds,
                "User Create statement with all objects was not copied to the clipboard");

        });

        it("Delete User", async () => {

            const treeUser = restGlobalService.authenticationApps[0].users[0].username;
            await restGlobalService.authenticationApps[0].users[0].delete();

            const ntf = await Workbench
                .getNotification(`Are you sure the MRS user ${treeUser} should be deleted`,
                    false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(Workbench.untilNotificationExists(`The MRS User ${treeUser} has been deleted`),
                constants.wait5seconds);

            const tree = [
                restGlobalService.treeName,
                restGlobalService.authenticationApps[0].treeName,
                treeUser,
            ];
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(tree), constants.wait5seconds);

        });

        it("Delete Authentication App", async () => {

            const treeAuthApp = restGlobalService.authenticationApps[0];
            await dbTreeSection.tree.collapseElement(globalService.treeName);
            await restGlobalService.authenticationApps[0].delete();
            const ntf = await Workbench.getNotification(
                `Are you sure the MRS authentication app ${treeAuthApp.name} should be deleted`, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            let notification = `The MRS Authentication App ${treeAuthApp.name}`;
            notification += ` has been deleted`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait5seconds);
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(treeAuthApp.treeName), constants.wait5seconds);
            await dbTreeSection.tree.expandElement([restGlobalService.treeName]);

            const tree = [
                restGlobalService.treeName,
                treeAuthApp.treeName,
            ];

            await driver.wait(dbTreeSection.tree.untilDoesNotExist(tree), constants.wait5seconds);
        });

        it("Delete REST Object", async () => {

            await dbTreeSection.tree.expandElement([globalService.treeName]);
            const treeObject = restGlobalService.restSchemas[0].restObjects[2].treeName;
            const objectName = restGlobalService.restSchemas[0].restObjects[2].dataMapping.dbObject;
            await restGlobalService.restSchemas[0].restObjects[2].delete();
            await driver.wait(Workbench.untilModalDialogIsOpened(), constants.wait10seconds);
            await new ModalDialog().pushButton(`Delete DB Object`);
            await driver.wait(Workbench.untilNotificationExists(`The REST DB Object ${objectName} has been deleted`,
                false), constants.wait5seconds);

            const tree = [
                restGlobalService.treeName,
                restGlobalService.restSchemas[0].treeName,
                treeObject,
            ];

            await driver.wait(dbTreeSection.tree.untilDoesNotExist(tree), constants.wait5seconds);
        });

        it("Delete REST Schema", async () => {

            const dummySchema = restGlobalService.restSchemas[2];
            const treeSchema = dummySchema.treeName;
            const schemaName = dummySchema.settings.schemaName;

            await dummySchema.delete();
            const txt = `Are you sure the MRS schema ${schemaName} should be deleted?`;
            const ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");

            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been deleted successfully"),
                constants.wait5seconds);

            const tree = [
                restGlobalService.treeName,
                treeSchema,
            ];

            await driver.wait(dbTreeSection.tree.untilDoesNotExist(tree), constants.wait5seconds);
        });

        it("Load REST Schema from JSON file", async () => {

            await restGlobalService.loadRestSchemaFromJsonFile(`${destDumpSchema}.mrs.json`);
            await driver.wait(Workbench.untilNotificationExists("The REST Schema has been loaded successfully"),
                constants.wait5seconds);

            const tree = [
                restGlobalService.treeName,
                restGlobalService.restSchemas[restGlobalService.restSchemas.length - 1].treeName,
            ];

            await driver.wait(dbTreeSection.tree.untilExists(tree), constants.wait5seconds);

        });

        it("Dump to Disk - Rest Service SDK files", async () => {

            const treeService = await dbTreeSection.tree.getElement(restGlobalService.treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeService,
                [constants.dumpToDisk, constants.restClientSDKFiles], constants.restServiceCtxMenu);
            await fs.rm(destDumpSdk, { force: true, recursive: true });
            await Workbench.setInputPath(destDumpSdk);
            await ExportSDKDialog.set(undefined);
            await driver.wait(Workbench.untilNotificationExists("MRS SDK Files exported successfully"),
                constants.wait5seconds);
            const files = await fs.readdir(destDumpSdk);
            expect(files.length, `No exported files found at ${destDumpSdk}`).to.be.greaterThan(0);

        });

        it("Load REST Object from JSON file", async () => {

            await restGlobalService.restSchemas[0].loadRestObjectFromJsonFile(`${destDumpTable}.mrs.json`);
            await driver.wait(Workbench
                .untilNotificationExists("The REST Database Object has been loaded successfully"),
                constants.wait5seconds);

            const objectFile = (await fs.readFile(`${destDumpTable}.mrs.json`)).toString();
            const json = JSON.parse(objectFile);

            const tree = [
                restGlobalService.treeName,
                restGlobalService.restSchemas[0].treeName,
                json.object.request_path,
            ];
            await driver.wait(dbTreeSection.tree.untilExists(tree), constants.wait10seconds);
        });

        it("MRS Service Documentation", async () => {

            const treeRandomService = await dbTreeSection.tree.getElement(restGlobalService.treeName);
            await dbTreeSection.tree.openContextMenuAndSelect(treeRandomService, constants.mrsServiceDocs);
            await driver.wait(async () => {
                await Misc.switchBackToTopFrame();
                await Misc.switchToFrame();

                return (await driver.findElements(locator.mrsDocumentation.restServiceProperties)).length > 0;
            }, constants.wait5seconds, "MRS Service Docs tab was not opened");
            await Workbench.closeEditor(new RegExp(constants.mrsDocs));

        });

        it("Delete REST Services", async () => {

            const services = [
                restGlobalService,
                restServiceToEdit,
            ];

            for (const service of services) {
                await service.delete();
                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                    constants.wait5seconds);
                await driver.wait(dbTreeSection.tree.untilDoesNotExist(service.treeName), constants.wait5seconds);
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
            advanced: {
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

        before(async function () {
            try {
                await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
                crudService.advanced.hostNameFilter = `127.0.0.1:${routerPort}`;
                crudSchema.restServicePath = `${crudService.advanced.hostNameFilter}${crudService.servicePath}`;
                crudObject.restServicePath = `${crudService.advanced.hostNameFilter}${crudService.servicePath}`;
                baseUrl = `https://${crudService.advanced.hostNameFilter}`;
                baseUrl += `${crudService.servicePath}${crudSchema.restSchemaPath}`;

                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
                await Os.deleteCredentials();

                const crudRestService = new E2ERestService(crudService);
                await crudRestService.create();
                const crudRestSchema = new E2ERestSchema(crudRestService, crudSchema);
                await crudRestSchema.add();
                await Workbench.dismissNotifications();
                await dbTreeSection.clickToolbarButton(constants.reloadConnections);
                await dbTreeSection.tree.expandElement([crudRestService.treeName, crudRestSchema.treeName]);
                await dbTreeSection.tree.collapseElement(constants.restAuthenticationApps);
                await new E2ERestObject(crudRestSchema, crudObject).add();
                await Workbench.dismissNotifications();

                // Check Router
                await fs.truncate(await Os.getRouterLogFile());
                const treeMySQLRestService = await dbTreeSection.tree.getElement(constants.mysqlRestService);
                await dbTreeSection.tree.openContextMenuAndSelect(treeMySQLRestService, constants.startRouter);
                await driver.wait(Os.untilRouterIsActive(), constants.wait20seconds);
                console.log("Using router service:");
                console.log(crudService);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(async function () {
            await Os.appendToExtensionLog(String(this.currentTest.title) ?? process.env.TEST_SUITE);
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
