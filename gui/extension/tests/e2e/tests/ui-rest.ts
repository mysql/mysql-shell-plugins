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
import { ModalDialog } from "vscode-extension-tester";
import clipboard from "clipboardy";
import { driver, Misc } from "../lib/Misc";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection";
import { Os } from "../lib/Os";
import { Workbench } from "../lib/Workbench";
import { DatabaseConnectionOverview } from "../lib/WebViews/DatabaseConnectionOverview";
import * as constants from "../lib/constants";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import { E2ENotebook } from "../lib/WebViews/E2ENotebook";
import { ExportSDKDialog } from "../lib/WebViews/Dialogs/ExportSDKDialog";
import { TestQueue } from "../lib/TestQueue";
import { RestServiceDialog } from "../lib/WebViews/Dialogs/RestServiceDialog";
import { RestSchemaDialog } from "../lib/WebViews/Dialogs/RestSchemaDialog";
import { RestObjectDialog } from "../lib/WebViews/Dialogs/RestObjectDialog";
import { AuthenticationAppDialog } from "../lib/WebViews/Dialogs/AuthenticationAppDialog";
import { RestUserDialog } from "../lib/WebViews/Dialogs/RestUserDialog";
import { E2ELogger } from "../lib/E2ELogger";
import { E2ECommandResultData } from "../lib/WebViews/CommandResults/E2ECommandResultData";

const sakilaRestSchema: interfaces.IRestSchema = {
    restSchemaPath: `/sakila`,
    accessControl: constants.accessControlEnabled,
    settings: {
        schemaName: "sakila",
        itemsPerPage: "35",
        comments: "Hello",
    },
};

describe("MySQL REST Service", () => {

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "e2eGlobalConnection",
        description: "Local connection",
        basic: {
            hostname: "localhost",
            username: String(process.env.DBUSERNAME1),
            port: parseInt(process.env.MYSQL_REST_PORT, 10),
            schema: "sakila",
            password: String(process.env.DBPASSWORD1),
        },
    };

    const tableToDump = "abc";
    const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

    before(async function () {
        await Misc.loadDriver();
        try {
            await driver.wait(Workbench.untilExtensionIsReady(), constants.waitForExtensionReady);
            await Os.appendToExtensionLog("beforeAll Rest");
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

    after(async function () {
        try {
            Misc.removeDatabaseConnections();
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("Rest Services", () => {

        let service1: interfaces.IRestService = {
            servicePath: `/service1`,
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
        };

        let existsInQueue = false;
        const destDumpSdk = join(process.cwd(), "dump.sdk");

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
        });

        after(async () => {
            await fs.rm(destDumpSdk, { force: true, recursive: true });
        });

        it("Browse the MySQL REST Service Documentation", async () => {

            await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.browseRESTDocs);
            try {
                await driver.wait(async () => {
                    await Misc.switchBackToTopFrame();
                    await Misc.switchToFrame();
                    const titles = await driver.findElements(locator.mrsDocumentation.title);
                    for (const title of titles) {
                        if ((await title.getText()).includes("MySQL REST Service - Reference Manual")) {
                            return true;
                        }
                    }
                }, constants.wait1second * 5, "Could not find the title 'MySQL REST Service - Reference Manual'");
            } finally {
                await Workbench.closeEditor(new RegExp(constants.mrsDocs));
            }
        });

        it("Create a Rest Service", async () => {
            await dbTreeSection.focus();
            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
            await treeMySQLRestService.expand();

            await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
            service1 = await RestServiceDialog.set(service1);
            await driver.wait(Workbench.untilNotificationExists("The MRS service has been created"),
                constants.wait1second * 20);
            await driver.wait(dbTreeSection.untilTreeItemExists(service1.servicePath), constants.waitForTreeItem);
        });

        it("Set as Current", async () => {
            await dbTreeSection.setCurrentRestService(service1.servicePath);
            await driver.wait(dbTreeSection.untilTreeItemIsDefault(service1.servicePath),
                constants.wait1second * 5, "REST Service tree item did not became default");
        });

        it("Copy to clipboard - Create Statements", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                [constants.copyToClipboard, constants.copyCreateServiceStatement], constants.restServiceCtxMenu);

            let regex = new RegExp(`CREATE OR REPLACE REST SERVICE ${service1.servicePath}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                        [constants.copyToClipboard, constants.copyCreateServiceStatement],
                        constants.restServiceCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Service create statement was not copied to the clipboard");

            await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                [constants.copyToClipboard, constants.copyCreateServiceStatementAll], constants.restServiceCtxMenu);

            regex = new RegExp(`CREATE OR REPLACE REST SERVICE ${service1.servicePath}`);
            const regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${sakilaRestSchema.restSchemaPath}`);
            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null &&
                    clipboardContent.match(regexSchema) === null &&
                    clipboardContent.match(regexObject) === null
                ) {

                    E2ELogger.debug(`clipboard content: ${clipboardContent}`);
                    await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                        [constants.copyToClipboard, constants.copyCreateServiceStatementAll],
                        constants.restServiceCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Service create statement with all objects was not copied to the clipboard");

        });

        it("Dump to Disk - Rest Service SDK files", async () => {

            await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                [constants.dumpToDisk, constants.restClientSDKFiles], constants.restServiceCtxMenu);
            await fs.rm(destDumpSdk, { force: true, recursive: true });
            await Workbench.setInputPath(destDumpSdk);
            await ExportSDKDialog.set(undefined);
            await driver.wait(Workbench.untilNotificationExists("MRS SDK Files exported successfully"),
                constants.wait1second * 5);
            const files = await fs.readdir(destDumpSdk);
            expect(files.length, `No exported files found at ${destDumpSdk}`).to.be.greaterThan(0);

        });

        it("MRS Service Documentation", async () => {

            await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.mrsServiceDocs);
            await driver.wait(async () => {
                await Misc.switchBackToTopFrame();
                await Misc.switchToFrame();

                return (await driver.findElements(locator.mrsDocumentation.restServiceProperties)).length > 0;
            }, constants.wait1second * 5, "MRS Service Docs tab was not opened");
            await Workbench.closeEditor(new RegExp(constants.mrsDocs));

        });

        it("Edit a Rest Service", async () => {
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
            };

            await dbTreeSection.expandTreeItem(service1.servicePath);
            await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.editRESTService);
            service1 = await RestServiceDialog.set(editedService);

            await driver.wait(Workbench.untilNotificationExists("The MRS service has been successfully updated."),
                constants.wait1second * 10);

            const treeName = `${service1.servicePath}`;
            await driver.wait(dbTreeSection.untilTreeItemExists(treeName), constants.waitForTreeItem);

            await dbTreeSection.openContextMenuAndSelect(treeName, constants.editRESTService);

            const thisService = await RestServiceDialog.get();
            expect(editedService).to.deep.equal(thisService);
        });

        it("Delete REST Service", async () => {

            await dbTreeSection.openContextMenuAndSelect(new RegExp(service1.servicePath),
                constants.deleteRESTService);

            const ntf = await Workbench
                .getNotification(`Are you sure the MRS service ${service1.servicePath} should be deleted`, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                constants.wait1second * 5);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(service1.servicePath));
            }, constants.wait1second * 3, `Item ${service1.servicePath} should not exist on the tree`);
        });

    });

    describe("Rest Schemas", () => {

        const service2: interfaces.IRestService = {
            servicePath: `/service2`,
            restSchemas: [
                {
                    restServicePath: `/service2`,
                    restSchemaPath: `/sakila`,
                    accessControl: constants.accessControlEnabled,
                    settings: {
                        schemaName: "sakila",
                        itemsPerPage: "35",
                        comments: "Hello",
                    },
                },
                {
                    restServicePath: `/service2`,
                    restSchemaPath: `/world_x_cst`,
                    accessControl: constants.accessControlEnabled,
                    settings: {
                        schemaName: "world_x_cst",
                        itemsPerPage: "35",
                        comments: "Hello",
                    },
                },
            ],
        };

        let existsInQueue = false;
        const schemaToDump = "dummyschema";
        const destDumpSchema = join(process.cwd(), schemaToDump);

        before(async () => {
            try {
                await dbTreeSection.focus();
                const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
                await treeMySQLRestService.expand();
                const children = await treeMySQLRestService.getChildren();

                for (const child of children) {
                    await child.collapse();
                }
                await (await dbTreeSection.getTreeItem("sakila")).collapse();

                const notebook = new E2ENotebook();
                const result = await notebook.codeEditor
                    .execute(`CREATE REST SERVICE ${service2.servicePath}`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption,
                    constants.reloadDataBaseInformation);
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
        });

        after(async function () {
            try {
                await dbTreeSection.openContextMenuAndSelect(new RegExp(service2.servicePath),
                    constants.deleteRESTService);

                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service2.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                    constants.wait1second * 5);

                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(service2.servicePath));
                }, constants.wait1second * 3, `Item ${service2.servicePath} should not exist on the tree`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Add REST Service Schemas", async () => {

            for (let i = 0; i <= service2.restSchemas.length - 1; i++) {
                await dbTreeSection.openContextMenuAndSelect(service2.restSchemas[i].settings.schemaName,
                    constants.addSchemaToREST);

                service2.restSchemas[i] = await RestSchemaDialog.set(service2.restSchemas[i]);
                await driver.wait(Workbench.untilNotificationExists("The MRS schema has been added successfully."),
                    constants.wait1second * 10);

                await dbTreeSection.expandTreeItem(service2.servicePath);
                const schemaTreeName = `${service2.restSchemas[i].restSchemaPath} (${service2.restSchemas[i]
                    .settings.schemaName})`;
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption,
                    constants.reloadDataBaseInformation);
                await driver.wait(dbTreeSection.untilTreeItemExists(schemaTreeName), constants.waitForTreeItem);
            }

        });

        it("Schema - Dump to Disk", async () => {

            await dbTreeSection.setCurrentRestService(service2.servicePath);

            await dbTreeSection.expandTreeItem(service2.servicePath);
            const dummySchema = service2.restSchemas[1];
            const schemaTreeName = `${dummySchema.restSchemaPath} (${dummySchema.settings.schemaName})`;
            await fs.rm(`${destDumpSchema}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(schemaTreeName,
                [constants.dumpToDisk, constants.dumpRESTSchemaToJSON], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(destDumpSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema has been dumped successfully`),
                constants.wait1second * 5);
            await fs.access(`${destDumpSchema}.mrs.json`);

            let dumpedSchema = join(process.cwd(), "dumpedSchema.mrs.sql");
            const treeSchema = `${service2.restSchemas[0].restSchemaPath} (${service2.restSchemas[0]
                .settings.schemaName})`;
            await fs.rm(dumpedSchema, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(treeSchema,
                [constants.dumpToDisk, constants.dumpCreateSchemaStatement], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(dumpedSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedSchema);
            let fileData = (await fs.readFile(dumpedSchema)).toString();
            expect(fileData).to.match(new RegExp(service2.restSchemas[0].restSchemaPath));

            await fs.unlink(dumpedSchema);
            dumpedSchema = join(process.cwd(), "dumpedSchemaAllObjects.mrs.sql");
            await fs.rm(dumpedSchema, { recursive: true, force: true });

            await (await dbTreeSection.getTreeItem("sakila")).expand();
            await (await dbTreeSection.getTreeItem("Tables")).expand();
            await dbTreeSection.openContextMenuAndSelect("actor", constants.addDBObjToREST);
            await RestObjectDialog.set();
            const notification = `The MRS Database Object actor was successfully updated`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait1second * 5);

            await dbTreeSection.openContextMenuAndSelect(treeSchema,
                [constants.dumpToDisk, constants.dumpCreateSchemaStatementAllObjects], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(dumpedSchema);
            await driver.wait(Workbench.untilNotificationExists(`The REST Schema SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedSchema);
            fileData = (await fs.readFile(dumpedSchema)).toString();
            expect(fileData).to.match(new RegExp(sakilaRestSchema.restSchemaPath));
            expect(fileData).to.match(/actor/);
            await fs.unlink(dumpedSchema);
        });

        it("Schema - Copy to clipboard - Create Statements", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeSchema = `${service2.restSchemas[0].restSchemaPath} (${service2.restSchemas[0]
                .settings.schemaName})`;
            await dbTreeSection.openContextMenuAndSelect(treeSchema,
                [constants.copyToClipboard, constants.copyCreateSchemaStatement], constants.restSchemaCtxMenu);

            let regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${service2.restSchemas[0]
                .restSchemaPath}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regexSchema) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(treeSchema,
                        [constants.copyToClipboard, constants.copyCreateSchemaStatement],
                        constants.restSchemaCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Schema Create statement was not copied to the clipboard");

            await dbTreeSection.openContextMenuAndSelect(treeSchema,
                [constants.copyToClipboard, constants.copyCreateSchemaStatementAll], constants.restSchemaCtxMenu);

            regexSchema = new RegExp(`CREATE OR REPLACE REST SCHEMA ${sakilaRestSchema.restSchemaPath}`);
            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (
                    clipboardContent.match(regexSchema) === null &&
                    clipboardContent.match(regexObject) === null
                ) {

                    E2ELogger.debug(`clipboard content: ${clipboardContent}`);
                    await dbTreeSection.openContextMenuAndSelect(treeSchema,
                        [constants.copyToClipboard, constants.copyCreateSchemaStatementAll],
                        constants.restSchemaCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Schema Create statement with all objects was not copied to the clipboard");

        });

        it("Delete REST Schema", async () => {

            const treeSchema = `${service2.restSchemas[1].restSchemaPath} (${service2.restSchemas[1]
                .settings.schemaName})`;
            await dbTreeSection.openContextMenuAndSelect(treeSchema, constants.deleteRESTSchema);

            const txt = `Are you sure the MRS schema ${service2.restSchemas[1]
                .settings.schemaName} should be deleted?`;
            const ntf = await Workbench.getNotification(txt, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");

            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been deleted successfully"),
                constants.wait1second * 5);

            await dbTreeSection.expandTreeItem(service2.servicePath);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(treeSchema));
            }, constants.wait1second * 3, `Item ${treeSchema} should not exist on the tree`);
        });

        it("Load REST Schema from JSON file", async () => {

            await dbTreeSection.openContextMenuAndSelect(service2.servicePath,
                [constants.loadFromDisk, constants.restSchemaFromJSONFile], constants.restServiceCtxMenu);
            await Workbench.setInputPath(`${destDumpSchema}.mrs.json`);

            await driver.wait(Workbench.untilNotificationExists("The REST Schema has been loaded successfully"),
                constants.wait1second * 5);

            await dbTreeSection.expandTreeItem(service2.servicePath);
            const schemaToLoad = service2.restSchemas[1];
            await driver.wait(dbTreeSection.untilTreeItemExists(`${schemaToLoad.restSchemaPath} (${schemaToLoad.settings
                .schemaName})`), constants.waitForTreeItem);

        });

        it("Edit REST Schema", async () => {
            const worldSchema = service2.restSchemas[1];
            const editedSchema = {
                restServicePath: worldSchema.restServicePath,
                restSchemaPath: `/schemaEdited`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: false,
                settings: {
                    schemaName: "schemaEdited",
                    itemsPerPage: "5",
                    comments: "Hi",
                },
                options: `{"test":"value"}`,
            };

            let treeName = `${worldSchema.restSchemaPath} (${worldSchema.settings.schemaName})`;
            await dbTreeSection.openContextMenuAndSelect(treeName, constants.editRESTSchema);
            service2.restSchemas[1] = await RestSchemaDialog.set(editedSchema);

            await driver.wait(Workbench.untilNotificationExists("The MRS schema has been updated successfully."),
                constants.wait1second * 10);

            treeName = `${editedSchema.restSchemaPath} (${editedSchema.settings.schemaName})`;
            await driver.wait(dbTreeSection.untilTreeItemExists(treeName), constants.waitForTreeItem);

            await dbTreeSection.openContextMenuAndSelect(treeName, constants.editRESTSchema);
            expect(await RestSchemaDialog.get()).to.deep.equal(editedSchema);
        });

    });

    describe("Rest Objects", () => {

        const service3: interfaces.IRestService = {
            servicePath: `/service3`,
            restSchemas: [
                {
                    restServicePath: `/service3`,
                    restSchemaPath: `/sakila`,
                    accessControl: constants.accessControlEnabled,
                    requiresAuth: false,
                    settings: {
                        schemaName: "sakila",
                    },
                    restObjects: [
                        {
                            restObjectPath: "/actor",
                            dataMapping: {
                                dbObject: "actor",
                            },
                        },
                        {
                            restObjectPath: "/address",
                            dataMapping: {
                                dbObject: "address",
                            },
                        },
                    ],
                },
            ],
        };

        const destDumpTable = join(process.cwd(), tableToDump);
        let existsInQueue = false;

        before(async () => {
            try {
                await dbTreeSection.focus();
                const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
                await treeMySQLRestService.expand();

                const children = await treeMySQLRestService.getChildren();

                for (const child of children) {
                    await child.collapse();
                }

                await (await dbTreeSection.getTreeItem("sakila")).collapse();

                const notebook = new E2ENotebook();
                let result = await notebook.codeEditor
                    .execute(`CREATE REST SERVICE ${service3.servicePath};`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                result = await notebook.codeEditor
                    .execute(`CREATE REST SCHEMA ${service3.restSchemas[0].restSchemaPath} 
                        ON SERVICE ${service3.servicePath} 
                        FROM \`${service3.restSchemas[0].settings.schemaName}\`;`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption,
                    constants.reloadDataBaseInformation);
                await dbTreeSection.expandTreeItem(service3.servicePath);
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

        after(async function () {
            try {
                await dbTreeSection.openContextMenuAndSelect(new RegExp(service3.servicePath),
                    constants.deleteRESTService);

                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service3.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                    constants.wait1second * 5);

                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(service3.servicePath));
                }, constants.wait1second * 3, `Item ${service3.servicePath} should not exist on the tree`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Add Object to Rest Service", async () => {

            const tables = ["actor", "address"];

            await dbTreeSection.expandTreeItem(service3.restSchemas[0].settings.schemaName);
            await dbTreeSection.expandTreeItem("Tables");
            const schemaTreeName = `${service3.restSchemas[0].restSchemaPath} (${service3.restSchemas[0]
                .settings.schemaName})`;
            await dbTreeSection.expandTreeItem(schemaTreeName);

            for (const table of tables) {

                await dbTreeSection.openContextMenuAndSelect(table, constants.addDBObjToREST);
                await RestObjectDialog.set({
                    restServicePath: service3.servicePath,
                });

                let notification = `The MRS Database Object ${table}`;
                notification += " was successfully updated";
                await driver.wait(Workbench.untilNotificationExists(notification), constants.wait1second * 5);
                await (await dbTreeSection.getTreeItem(`${service3.restSchemas[0]
                    .restSchemaPath} (${service3.restSchemas[0].settings.schemaName})`)).expand();
                await driver.wait(dbTreeSection.untilTreeItemExists(`/${table}`), constants.waitForTreeItem);
            }

        });

        it("Object - Dump to Disk", async () => {

            const tree = [
                service3.servicePath,
                `${service3.restSchemas[0].restSchemaPath} (${service3.restSchemas[0].settings.schemaName})`,
            ];

            await dbTreeSection.expandTree(tree);
            const treeTableToDump = service3.restSchemas[0].restObjects[0].restObjectPath;
            await fs.rm(`${destDumpTable}.mrs.json`, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(treeTableToDump,
                [constants.dumpToDisk, constants.restObjectToJSONFile], constants.restObjCtxMenu);
            await Workbench.setInputPath(destDumpTable);
            await driver.wait(Workbench
                .untilNotificationExists(`The REST Database Object has been dumped successfully`),
                constants.wait1second * 5);
            E2ELogger.info(`Dumped to: ${destDumpTable}.mrs.json`);
            await fs.access(`${destDumpTable}.mrs.json`);

            const dumpedObject = join(process.cwd(), "dumpedObject.mrs.sql");
            const objectTreeName = `/${service3.restSchemas[0].restObjects[0].dataMapping.dbObject}`;

            await fs.rm(dumpedObject, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(objectTreeName,
                [constants.dumpToDisk, constants.dumpCreateObjectStatement], constants.restObjCtxMenu);
            await Workbench.setInputPath(dumpedObject);
            await driver.wait(Workbench.untilNotificationExists(`The REST DB OBJECT SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedObject);
            const fileData = (await fs.readFile(dumpedObject)).toString();
            expect(fileData).to.match(new RegExp(service3.restSchemas[0].restObjects[0].dataMapping.dbObject));
            await fs.unlink(dumpedObject);

        });

        it("Object - Copy to clipboard", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            const treeActor = service3.restSchemas[0].restObjects[0].restObjectPath;
            await dbTreeSection.openContextMenuAndSelect(treeActor,
                [constants.copyToClipboard, constants.restObjectRequestPath], constants.restObjCtxMenu);

            const servicePath = service3.servicePath;
            const schemaPath = service3.restSchemas[0].restSchemaPath;
            const actorTable = service3.restSchemas[0].restObjects[0].restObjectPath;

            const url = `https://localhost.*${servicePath}${schemaPath}${actorTable}`;
            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(new RegExp(url)) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(treeActor,
                        [constants.copyToClipboard, constants.restObjectRequestPath], constants.restObjCtxMenu);
                    await driver.wait(Workbench
                        .untilNotificationExists("The DB Object Path was copied to the system clipboard"),
                        constants.wait1second * 5);
                } else {
                    return true;
                }
            }, constants.wait1second * 15, `${url} was not found on the clipboard`);


            const objectTreeName = `/${service3.restSchemas[0].restObjects[0].dataMapping.dbObject}`;
            await dbTreeSection.openContextMenuAndSelect(objectTreeName,
                [constants.copyToClipboard, constants.copyCreateRestObjSt], constants.restObjCtxMenu);

            const regexObject = new RegExp(`CREATE OR REPLACE REST VIEW /actor`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regexObject) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(objectTreeName,
                        [constants.copyToClipboard, constants.copyCreateRestObjSt], constants.restObjCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Object create statement was not copied to the clipboard");

        });

        it("Edit REST Object", async () => {
            const actorTable = service3.restSchemas[0].restObjects[0];

            const editedObject: interfaces.IRestObject = {
                restServicePath: service3.servicePath,
                restSchemaPath: service3.restSchemas[0].restSchemaPath,
                restObjectPath: `/editedObject`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                dataMapping: {
                    dbObject: service3.restSchemas[0].restObjects[0].dataMapping?.dbObject,
                    //sdkLanguage: "TypeScript",
                    sdkLanguage: "SDK Language",
                    columns: [
                        {
                            name: "actorId",
                            isSelected: true,
                            rowOwnership: false,
                            allowSorting: true,
                            preventFiltering: true,
                            //preventUpdates: true,
                            preventUpdates: false,
                            excludeETAG: false,
                        },
                        {
                            name: "firstName",
                            isSelected: false,
                            rowOwnership: false,
                            allowSorting: true,
                            preventFiltering: true,
                            //preventUpdates: true,
                            preventUpdates: false,
                            excludeETAG: true,
                        },
                        {
                            name: "lastName",
                            isSelected: false,
                            rowOwnership: false,
                            allowSorting: true,
                            preventFiltering: true,
                            //preventUpdates: true,
                            preventUpdates: false,
                            excludeETAG: true,
                        },
                        {
                            name: "lastUpdate",
                            isSelected: true,
                            rowOwnership: true,
                            allowSorting: true,
                            preventFiltering: true,
                            //preventUpdates: true,
                            preventUpdates: false,
                            excludeETAG: true,
                        },
                    ],
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

            const schemaTreeName = `${service3.restSchemas[0].restSchemaPath} (${service3.restSchemas[0]
                .settings.schemaName})`;
            await dbTreeSection.expandTreeItem(schemaTreeName);
            await dbTreeSection.openContextMenuAndSelect(actorTable.restObjectPath, constants.editRESTObj);
            service3.restSchemas[0].restObjects[0] = await RestObjectDialog.set(editedObject);

            let notification = `The MRS Database Object ${editedObject.dataMapping.dbObject}`;
            notification += ` was successfully updated`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait1second * 5);

            await driver.wait(dbTreeSection.untilTreeItemExists(service3.restSchemas[0].restObjects[0]
                .restObjectPath), constants.waitForTreeItem);

            await dbTreeSection.openContextMenuAndSelect(service3.restSchemas[0].restObjects[0]
                .restObjectPath, constants.editRESTObj);
            expect(await RestObjectDialog.get()).to.deep.equal(editedObject);
        });

        it("Delete REST Object", async () => {

            await dbTreeSection.expandTreeItem(service3.servicePath);
            const objectName = service3.restSchemas[0].restObjects[0].restObjectPath;

            const schema = service3.restSchemas[0].settings.schemaName;
            await dbTreeSection.expandTree([service3.servicePath,
            `${service3.restSchemas[0].restSchemaPath} (${schema})`]);

            await dbTreeSection.openContextMenuAndSelect(objectName, constants.deleteRESTObj);

            await driver.wait(Workbench.untilModalDialogIsOpened(), constants.wait1second * 10);
            await new ModalDialog().pushButton(`Delete DB Object`);
            await driver.wait(Workbench
                .untilNotificationExists(`The REST DB Object ${service3.restSchemas[0].restObjects[0]
                    .dataMapping.dbObject} has been deleted`,
                    false), constants.wait1second * 5);

            const tree = [
                service3.servicePath,
                `${service3.restSchemas[0].restSchemaPath} (${service3.restSchemas[0].settings.schemaName})`,
            ];
            await dbTreeSection.expandTree(tree);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(objectName));
            }, constants.wait1second * 3, `Item ${objectName} should not exist on the tree`);
        });

        it("Load REST Object from JSON file", async () => {

            const schema = service3.restSchemas[0].settings.schemaName;
            await dbTreeSection.expandTree([service3.servicePath,
            `${service3.restSchemas[0].restSchemaPath} (${schema})`]);
            await dbTreeSection.openContextMenuAndSelect(`${service3.restSchemas[0].restSchemaPath} (${schema})`,
                [constants.loadFromDisk, constants.restObjectFromJSONFile], constants.restSchemaCtxMenu);
            await Workbench.setInputPath(`${destDumpTable}.mrs.json`);

            await driver.wait(Workbench
                .untilNotificationExists("The REST Database Object has been loaded successfully"),
                constants.wait1second * 5);

            const objectFile = (await fs.readFile(`${destDumpTable}.mrs.json`)).toString();
            const json = JSON.parse(objectFile);

            const tree = [
                service3.servicePath,
                `${service3.restSchemas[0].restSchemaPath} (${schema})`,
            ];

            await dbTreeSection.expandTree(tree);
            await driver.wait(dbTreeSection.untilTreeItemExists(json.object.request_path as string),
                constants.waitForTreeItem);
        });

    });

    describe("Rest Authentication Apps", () => {

        const service4: interfaces.IRestService = {
            servicePath: `/service4`,
            authenticationApps: [
                {
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
                    user: [
                        {
                            username: "gui",
                            email: "user@oracle.com",
                            assignedRoles: undefined,
                            userOptions: "",
                            permitLogin: true,
                            vendorUserId: "1234",
                            mappedUserId: "testing",
                        },
                    ],
                },
            ],
        };

        let existsInQueue = false;

        before(async () => {
            try {
                await dbTreeSection.focus();
                const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
                await treeMySQLRestService.expand();

                const children = await treeMySQLRestService.getChildren();

                for (const child of children) {
                    await child.collapse();
                }

                await (await dbTreeSection.getTreeItem("sakila")).collapse();

                const notebook = new E2ENotebook();
                const result = await notebook.codeEditor
                    .execute(`CREATE REST SERVICE ${service4.servicePath};`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption,
                    constants.reloadDataBaseInformation);
                await dbTreeSection.setCurrentRestService(service4.servicePath);
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

        after(async function () {
            try {
                await dbTreeSection.openContextMenuAndSelect(new RegExp(service4.servicePath),
                    constants.deleteRESTService);

                const ntf = await Workbench
                    .getNotification(`Are you sure the MRS service ${service4.servicePath} should be deleted`, false);
                await Workbench.clickOnNotificationButton(ntf, "Yes");
                await driver.wait(Workbench.untilNotificationExists("The MRS service has been deleted successfully"),
                    constants.wait1second * 5);

                await driver.wait(async () => {
                    return !(await dbTreeSection.treeItemExists(service4.servicePath));
                }, constants.wait1second * 3, `Item ${service4.servicePath} should not exist on the tree`);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Add and Link New REST Authentication App", async () => {

            await dbTreeSection.openContextMenuAndSelect(service4.servicePath, constants.addAndLinkNewAuthApp);
            service4.authenticationApps = [await AuthenticationAppDialog.set(service4.authenticationApps[0])];
            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been added"),
                constants.wait1second * 5);
            await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
            await driver.wait(dbTreeSection.untilTreeItemExists(service4.authenticationApps[0].name),
                constants.waitForTreeItem);
        });

        it("Authentication App - Dump to disk", async () => {

            let dumpedAuthApp = join(process.cwd(), "dumpedAuthApp.mrs.sql");
            await fs.rm(dumpedAuthApp, { recursive: true, force: true });
            await (await dbTreeSection.getTreeItem(constants.restAuthenticationApps)).expand();
            await dbTreeSection.expandTreeItem(service4.servicePath);

            await dbTreeSection.openContextMenuAndSelect([service4.servicePath, service4.authenticationApps[0].name],
                [constants.dumpToDisk, constants.dumpCreateRestAuthAppStatement], constants.restAppCtxMenu1);
            await Workbench.setInputPath(dumpedAuthApp);
            await driver.wait(Workbench.untilNotificationExists(`The REST Authentication App SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedAuthApp);
            let fileData = (await fs.readFile(dumpedAuthApp)).toString();

            let regex = new RegExp(`CREATE OR REPLACE REST AUTH APP \`${service4.authenticationApps[0].name}`);
            expect(fileData).to.match(regex);

            await fs.unlink(dumpedAuthApp);
            dumpedAuthApp = join(process.cwd(), "dumpedAuthAppAllObjects.mrs.sql");
            await fs.rm(dumpedAuthApp, { recursive: true, force: true });

            await (await dbTreeSection.getTreeItem(constants.restAuthenticationApps)).expand();
            await dbTreeSection.openContextMenuAndSelect([constants.restAuthenticationApps,
            service4.authenticationApps[0].name], constants.addRESTUser);

            await RestUserDialog.set(service4.authenticationApps[0].user[0]);
            await driver.wait(Workbench.untilNotificationExists(`The MRS User "${service4.authenticationApps[0].user[0]
                .username}" has been added`),
                constants.wait1second * 5);

            await (await dbTreeSection.getTreeItem(service4.servicePath)).expand();
            await dbTreeSection.openContextMenuAndSelect([service4.servicePath, service4.authenticationApps[0].name],
                [constants.dumpToDisk, constants.dumpCreateRestAuthAppStatementAll], constants.restAppCtxMenu1);
            await Workbench.setInputPath(dumpedAuthApp);
            await driver.wait(Workbench.untilNotificationExists(`The REST Authentication App SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedAuthApp);
            fileData = (await fs.readFile(dumpedAuthApp)).toString();

            expect(fileData).to.match(regex);
            regex = new RegExp(`CREATE OR REPLACE REST USER \`${service4.authenticationApps[0].user[0].username}`);

            expect(fileData).to.match(regex);
            await fs.unlink(dumpedAuthApp);

        });

        it("Authentication App - Copy to clipboard", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await (await dbTreeSection.getTreeItem(constants.restAuthenticationApps)).collapse();
            await dbTreeSection.expandTreeItem(service4.servicePath);

            await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps[0].name,
                [constants.copyToClipboard, constants.copyCreateRestAuthAppStatement], constants.restAppCtxMenu1);

            let regex = new RegExp(`CREATE OR REPLACE REST AUTH APP \`${service4.authenticationApps[0]
                .name}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps[0].name,
                        [constants.copyToClipboard, constants.copyCreateRestAuthAppStatement],
                        constants.restAppCtxMenu1);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "Authentication app Create statement was not copied to the clipboard");

            await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps[0].name,
                [constants.copyToClipboard, constants.copyCreateRestAuthAppStatementAll], constants.restAppCtxMenu1);

            regex = new RegExp(`CREATE OR REPLACE REST USER \`${service4.authenticationApps[0].user[0].username}`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboardContent}`);
                    await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps[0].name,
                        [constants.copyToClipboard, constants.copyCreateRestAuthAppStatementAll],
                        constants.restAppCtxMenu1);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5,
                "Authentication app Create statement with all objects was not copied to the clipboard");

        });

        it("Edit Authentication App", async () => {

            const authAppToEdit = service4.authenticationApps[0];
            const editedApp: interfaces.IRestAuthenticationApp = {
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

            await (await dbTreeSection.getTreeItem(service4.servicePath)).collapse();
            await (await dbTreeSection.getTreeItem(constants.restAuthenticationApps)).expand();

            await dbTreeSection.openContextMenuAndSelect(authAppToEdit.name, constants.editAuthenticationApp);
            service4.authenticationApps[0] = await AuthenticationAppDialog.set(editedApp);

            await driver.wait(Workbench.untilNotificationExists("The MRS Authentication App has been updated"),
                constants.wait1second * 5);

            await driver.wait(dbTreeSection.untilTreeItemExists(editedApp.name), constants.waitForTreeItem);
            await dbTreeSection.openContextMenuAndSelect(editedApp.name, constants.editAuthenticationApp);

            const app = await AuthenticationAppDialog.get();
            expect(app).to.deep.equal(editedApp);
        });

        it("Delete Authentication App", async () => {

            const authAppToDelete = service4.authenticationApps[0].name;
            await (await dbTreeSection.getTreeItem(service4.servicePath)).collapse();
            await dbTreeSection.openContextMenuAndSelect(authAppToDelete, constants.deleteAuthenticationApp);

            const ntf = await Workbench.getNotification(
                `Are you sure the MRS authentication app ${authAppToDelete} should be deleted`, false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            let notification = `The MRS Authentication App ${authAppToDelete}`;
            notification += ` has been deleted`;
            await driver.wait(Workbench.untilNotificationExists(notification), constants.wait1second * 5);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(authAppToDelete));
            }, constants.wait1second * 3, `Item ${authAppToDelete} should not exist on the tree`);

            await dbTreeSection.expandTreeItem(service4.servicePath);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(authAppToDelete));
            }, constants.wait1second * 3, `Item ${authAppToDelete} should not exist on the tree`);

        });

    });

    describe("Rest Users", () => {

        const service5: interfaces.IRestService = {
            servicePath: `/service5`,
            authenticationApps: [
                {
                    vendor: constants.mrs,
                    name: "MRS",
                    enabled: true,
                    limitToRegisteredUsers: true,
                    settings: {
                        description: "this is an authentication app",
                        defaultRole: "Full Access",
                    },
                    options: `{ "name": "test options" }`,
                    user: [{
                        username: "gui",
                        password: "MySQLR0cks!",
                        authenticationApp: "MRS",
                        email: "user@oracle.com",
                        assignedRoles: undefined,
                        userOptions: "",
                        permitLogin: true,
                        vendorUserId: "1234",
                        mappedUserId: "testing",
                    }],
                },
            ],
        };

        let existsInQueue = false;

        before(async () => {
            try {
                await dbTreeSection.focus();
                const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
                await treeMySQLRestService.expand();

                const children = await treeMySQLRestService.getChildren();

                for (const child of children) {
                    await child.collapse();
                }

                await (await dbTreeSection.getTreeItem("sakila")).collapse();

                const notebook = new E2ENotebook();
                let result = await notebook.codeEditor
                    .execute(`CREATE REST SERVICE ${service5.servicePath};`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                result = await notebook.codeEditor
                    .execute(`CREATE OR REPLACE REST AUTHENTICATION APP "${service5.authenticationApps[0].name}"
                        VENDOR ${service5.authenticationApps[0].vendor};`) as E2ECommandResultData;
                expect(result.text).to.match(/OK/);
                await dbTreeSection.clickTreeItemActionButton(globalConn.caption,
                    constants.reloadDataBaseInformation);
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
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

        it("Add User", async () => {

            await (await dbTreeSection.getTreeItem(service5.servicePath)).collapse();
            await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].name,
                constants.addRESTUser);
            service5.authenticationApps[0].user = [await RestUserDialog.set(service5.authenticationApps[0].user[0])];

            await driver.wait(Workbench.untilNotificationExists(`The MRS User "${service5.authenticationApps[0].user[0]
                .username}" has been added`),
                constants.wait1second * 5);
            await dbTreeSection.expandTreeItem(service5.authenticationApps[0].name);
            await driver.wait(dbTreeSection.untilTreeItemExists(service5.authenticationApps[0].user[0].username),
                constants.waitForTreeItem);
        });

        it("Edit User", async () => {

            const userToEdit = service5.authenticationApps[0].user[0];

            const editedUser: interfaces.IRestUser = {
                username: "testUser",
                password: "MySQLR0cks!",
                authenticationApp: service5.authenticationApps[0].name,
                email: "testuser@oracle.com",
                assignedRoles: "Full Access",
                userOptions: `{"test":"value"}`,
                permitLogin: false,
                vendorUserId: "123467",
                mappedUserId: "stillTesting",
            };

            await dbTreeSection.expandTreeItem(service5.authenticationApps[0].name);
            await dbTreeSection.openContextMenuAndSelect(userToEdit.username, constants.editRESTUser);
            service5.authenticationApps[0].user[0] = await RestUserDialog.set(editedUser);

            await driver.wait(Workbench
                .untilNotificationExists(`The MRS User "${editedUser.username}" has been updated.`),
                constants.wait1second * 5);

            await dbTreeSection.expandTreeItem(service5.authenticationApps[0].name);

            await driver.wait(dbTreeSection.untilTreeItemExists(editedUser.username), constants.waitForTreeItem);
            await dbTreeSection.openContextMenuAndSelect(editedUser.username, constants.editRESTUser);

            const userInfo = await RestUserDialog.get();
            editedUser.password = "[Stored Password]";
            expect(userInfo).to.deep.equal(editedUser);
        });

        it("User - Dump to disk", async () => {

            let dumpedUser = join(process.cwd(), "dumpedUser.mrs.sql");
            await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);

            await fs.rm(dumpedUser, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                [constants.dumpToDisk, constants.dumpCreateRestUserStatement], constants.restUserCtxMenu);
            await Workbench.setInputPath(dumpedUser);
            await driver.wait(Workbench.untilNotificationExists(`The REST User SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedUser);
            let fileData = (await fs.readFile(dumpedUser)).toString();

            let regex = new RegExp(`CREATE OR REPLACE REST USER \`${service5.authenticationApps[0].user[0]
                .username}`);
            expect(fileData).to.match(regex);

            await fs.unlink(dumpedUser);
            dumpedUser = join(process.cwd(), "dumpedAuthAppAllObjects.mrs.sql");
            await fs.rm(dumpedUser, { recursive: true, force: true });
            await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                [constants.dumpToDisk, constants.dumpCreateRestUserStatementAll], constants.restUserCtxMenu);
            await Workbench.setInputPath(dumpedUser);
            await driver.wait(Workbench.untilNotificationExists(`The REST User SQL was exported`),
                constants.wait1second * 5);
            await fs.access(dumpedUser);
            fileData = (await fs.readFile(dumpedUser)).toString();

            expect(fileData).to.match(regex);
            regex = new RegExp(`CREATE OR REPLACE REST USER \`${service5.authenticationApps[0].user[0]
                .username}`);

            expect(fileData).to.match(regex);
            expect(fileData).to.match(/GRANT REST ROLE/);
            await fs.unlink(dumpedUser);

        });

        it("User - Copy to clipboard - Create Statements", async function () {

            await TestQueue.push(this.test.title);
            existsInQueue = true;
            await driver.wait(TestQueue.poll(this.test.title), constants.queuePollTimeout);

            await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                [constants.copyToClipboard, constants.copyCreateRestUserStatement], constants.restUserCtxMenu);

            let regex = new RegExp(`CREATE OR REPLACE REST USER \`${service5.authenticationApps[0]
                .user[0].username}`);

            await driver.wait(async () => {
                if (clipboard.readSync()
                    .match(regex) === null) {

                    E2ELogger.debug(`clipboard content: ${clipboard.readSync()}`);
                    await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                        [constants.copyToClipboard, constants.copyCreateRestUserStatement], constants.restUserCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5, "User Create statement was not copied to the clipboard");

            await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                [constants.copyToClipboard, constants.copyCreateRestUserStatementAll], constants.restUserCtxMenu);

            regex = new RegExp(`CREATE OR REPLACE REST USER \`${service5.authenticationApps[0].user[0]
                .username}`);

            await driver.wait(async () => {
                const clipboardContent = clipboard.readSync();

                if (clipboardContent.match(regex) === null && clipboardContent.match(/GRANT REST ROLE/)) {

                    E2ELogger.debug(`clipboard content: ${clipboardContent}`);
                    await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps[0].user[0].username,
                        [constants.copyToClipboard, constants.copyCreateRestUserStatementAll],
                        constants.restUserCtxMenu);

                    return false;
                }

                await driver.wait(Workbench
                    .untilNotificationExists(`The CREATE statement was copied to the system clipboard`),
                    constants.wait1second * 5);

                return true;
            }, constants.wait1second * 5,
                "User Create statement with all objects was not copied to the clipboard");

        });

        it("Delete User", async () => {

            const userToDelete = service5.authenticationApps[0].user[0].username;
            await dbTreeSection.openContextMenuAndSelect(userToDelete, constants.deleteRESTUser);

            const ntf = await Workbench
                .getNotification(`Are you sure the MRS user ${userToDelete} should be deleted`,
                    false);
            await Workbench.clickOnNotificationButton(ntf, "Yes");
            await driver.wait(Workbench.untilNotificationExists(`The MRS User ${userToDelete} has been deleted`),
                constants.wait1second * 5);

            await dbTreeSection.expandTreeItem(service5.authenticationApps[0].name);

            await driver.wait(async () => {
                return !(await dbTreeSection.treeItemExists(userToDelete));
            }, constants.wait1second * 3, `Item ${userToDelete} should not exist on the tree`);
        });

    });

});
