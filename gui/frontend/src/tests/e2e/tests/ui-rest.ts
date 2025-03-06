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

import { error, Key } from "selenium-webdriver";
import { basename } from "path";
import { Misc } from "../lib/misc.js";
import { driver, loadDriver } from "../lib/driver.js";
import { E2EAccordionSection } from "../lib/SideBar/E2EAccordionSection.js";
import { Os } from "../lib/os.js";
import * as constants from "../lib/constants.js";
import * as interfaces from "../lib/interfaces.js";
import { E2ENotebook } from "../lib/E2ENotebook.js";
import { RestServiceDialog } from "../lib/Dialogs/RestServiceDialog.js";
import { RestObjectDialog } from "../lib/Dialogs/RestObjectDialog.js";
import { RestSchemaDialog } from "../lib/Dialogs/RestSchemaDialog.js";
import { AuthenticationAppDialog } from "../lib/Dialogs/AuthenticationAppDialog.js";
import { RestUserDialog } from "../lib/Dialogs/RestUserDialog.js";
import { E2EDatabaseConnectionOverview } from "../lib/E2EDatabaseConnectionOverview.js";
import { E2EToastNotification } from "../lib/E2EToastNotification.js";
import { ConfirmDialog } from "../lib/Dialogs/ConfirmationDialog.js";
import { TestQueue } from "../lib/TestQueue.js";
import { E2ETreeItem } from "../lib/SideBar/E2ETreeItem.js";
import { GenericDialog } from "../lib/Dialogs/GenericDialog.js";

const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

const globalConn: interfaces.IDBConnection = {
    dbType: "MySQL",
    caption: `E2E - REST SERVICE`,
    description: "Local connection",
    basic: {
        hostname: "localhost",
        username: String(process.env.DBUSERNAME1),
        port: parseInt(process.env.MYSQL_PORT!, 10),
        schema: "sakila",
        password: String(process.env.DBUSERNAME1PWD),
    },
};

const dbTreeSection = new E2EAccordionSection(constants.dbTreeSection);

let testFailed = false;

describe("MYSQL REST SERVICE", () => {

    beforeAll(async () => {

        await loadDriver(true);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await dbTreeSection.focus();
            await dbTreeSection.createDatabaseConnection(globalConn);
            await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
            await (await new E2EDatabaseConnectionOverview().getConnection(globalConn.caption!)).click();
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
            Os.deleteShellCredentials();

            await dbTreeSection.expandTreeItem(globalConn);
            await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.showSystemSchemas);

            if (!(await dbTreeSection.existsTreeItem("mysql_rest_service_metadata"))) {
                await dbTreeSection.configureMySQLRestService(globalConn.caption!, globalConn);
            }

            await dbTreeSection.expandTreeItem(constants.mysqlRestService);
        } catch (e) {
            await Misc.storeScreenShot("beforeAll_MysqlRESTService");
            throw e;
        }
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    describe("MySQL Rest Service Context menu", () => {

        const service: interfaces.IRestService = {
            servicePath: `/service`,
            name: "service",
            enabled: true,
            default: false,
            restSchemas: [
                {
                    restServicePath: `/service`,
                    restSchemaPath: `/sakila`,
                    accessControl: constants.accessControlPrivate,
                    settings: {
                        schemaName: "sakila",
                    },
                    restObjects: [
                        {
                            accessControl: constants.accessControlPrivate,
                            restObjectPath: "/actor",
                            dataMapping: {
                                dbObject: "actor",
                            },
                        },
                        {
                            accessControl: constants.accessControlPrivate,
                            restObjectPath: "/address",
                            dataMapping: {
                                dbObject: "address",
                            },
                        },
                    ],
                },
            ],
        };

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_ServiceContextMenus");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });


        it("Disable MySQL REST Service", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.disableRESTService);

                await driver.wait(async () => {
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                        `${constants.dbTreeSection} is still loading`);
                    const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);

                    return (await treeMySQLRestService.hasRedMark()) === true;
                }, constants.wait5seconds, "MySQL REST Service was not disabled");

                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("MySQL REST Service configured successfully.");
                await notification!.close();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Enable MySQL REST Service", async () => {
            try {

                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.enableRESTService);
                await driver.wait(async () => {
                    await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                    await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                        `${constants.dbTreeSection} is still loading`);
                    const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);

                    return (await treeMySQLRestService.hasRedMark()) === false;
                }, constants.wait5seconds, "MySQL REST Service was not enabled");
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("MySQL REST Service configured successfully.");
                await notification!.close();
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Show Private Items", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                await RestServiceDialog.set(service);
                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();

                await dbTreeSection.openContextMenuAndSelect(service.restSchemas![0].settings!.schemaName!,
                    constants.addSchemaToREST);
                await RestSchemaDialog.set(service.restSchemas![0]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been added successfully.");
                await notification!.close();

                await dbTreeSection.expandTree([
                    service.restSchemas![0].settings!.schemaName!,
                    "Tables",
                ]);

                await dbTreeSection.openContextMenuAndSelect(service.restSchemas![0].restObjects![0]
                    .dataMapping!.dbObject!, constants.addDBObjToREST);
                await RestObjectDialog.set({
                    restServicePath: service.servicePath,
                });

                const notifications = await Misc.getToastNotifications(true);
                const messages = notifications.map((item: E2EToastNotification | undefined) => {
                    return item!.message;
                });

                expect(messages)
                    .toContain(`The MRS Database Object ${service.restSchemas![0].restObjects![0]
                        .dataMapping!.dbObject} was successfully updated.`);
                await Promise.all([
                    notifications.map((item: E2EToastNotification | undefined) => {
                        return item!.close();
                    }),
                ]);

                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.showPrivateItems);
                await dbTreeSection.expandTreeItem(service.servicePath);
                expect(await dbTreeSection.existsTreeItem(`${service.restSchemas![0].restSchemaPath} (${service
                    .restSchemas![0].settings!.schemaName})`)).toBe(true);
                await dbTreeSection.expandTreeItem(`${service.restSchemas![0].restSchemaPath} (${service
                    .restSchemas![0].settings!.schemaName})`);
                await driver.wait(dbTreeSection.untilTreeItemExists(service.restSchemas![0].restObjects![0]
                    .restObjectPath!), constants.wait3seconds);

                await dbTreeSection.openContextMenu(constants.mysqlRestService);
                await driver.actions().keyDown(Key.ALT).perform();
                await dbTreeSection.selectFromContextMenu(constants.hidePrivateItems);
                await driver.actions().keyUp(Key.ALT).perform();

                expect(await dbTreeSection.existsTreeItem(service.servicePath)).toBe(true);
                await driver.wait(async () => {
                    try {
                        const children = await dbTreeSection.getTreeItemChildren(service.servicePath);

                        return children.length === 0;
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        }
                    }
                }, constants.wait5seconds, `${service.servicePath} should have private child elements not visible`);
            } catch (e) {
                testFailed = true;
                throw e;
            }

        });

        it("Browse the MySQL REST Service Documentation", async () => {
            let browserTabs: string[] = [];
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.browseRESTDocs);
                await driver.wait(async () => {
                    browserTabs = await driver.getAllWindowHandles();
                    if (browserTabs.length > 1) {
                        await driver.switchTo().window(browserTabs[1]);

                        return true;
                    }
                }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

                expect(await driver.getCurrentUrl())
                    .toContain("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/");

                await driver.close();
                await driver.switchTo().window(browserTabs[0]);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Rest Services", () => {

        let service1: interfaces.IRestService = {
            servicePath: `/service1`,
            name: "service1",
            enabled: true,
            default: false,
            settings: {
                mrsAdminUser: "testUser",
                mrsAdminPassword: "MySQLR0cks!",
                comments: "testing",
            },
            authentication: {
                redirectionUrl: "localhost:8000",
                redirectionUrlValid: "(.*)",
                authCompletedChangeCont: "<html>",
            },
        };

        const authenticationApp = {
            vendor: "MRS",
            name: "test",
            enabled: false,
            limitToRegisteredUsers: false,
            settings: {
                description: "testing",
            },
        };

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_Rest_Services");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });

        it("Create Rest Service", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                service1 = await RestServiceDialog.set(service1);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service1.servicePath),
                    constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Set as Current REST Service", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.setAsCurrentREST);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been set as the new default service.");
                await notification!.close();

                await driver.wait(async () => {
                    try {
                        const treeGlobalService = await dbTreeSection.getTreeItem(service1.servicePath);

                        return treeGlobalService.isDefault();
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        }
                    }
                }, constants.wait3seconds, `${service1.servicePath} was not marked as DEFAULT`);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit REST Service", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.editRESTService);

                const editedService = {
                    servicePath: `/edited`,
                    name: "edited",
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

                service1 = await RestServiceDialog.set(editedService);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been successfully updated.");
                await notification!.close();

                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                await driver.wait(dbTreeSection.untilTreeItemExists(service1.servicePath), constants.wait10seconds);
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.editRESTService);
                expect(editedService).toStrictEqual(await RestServiceDialog.get());
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add and Link New REST Authentication App", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.addLinkAuthApp);
                await AuthenticationAppDialog.set(authenticationApp);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS Authentication App has been added.");
                await notification!.close();

                await dbTreeSection.expandTreeItem(service1.servicePath);
                await driver.wait(dbTreeSection.untilTreeItemExists(authenticationApp.name),
                    constants.wait5seconds);

                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);

                const children = await dbTreeSection.getTreeItemChildren(constants.restAuthenticationApps);
                const childrenNames = (await Promise.all(children)).map((el: E2ETreeItem) => {
                    return el.caption;
                });

                expect(childrenNames).toContain(authenticationApp.name);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Unlink REST Authentication App", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(authenticationApp.name,
                    constants.unlinkRestAuthenticationApp);
                await new ConfirmDialog().accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe(`The MRS Authentication App "${authenticationApp
                    .name}" has been unlinked.`);
                await notification!.close();
                await dbTreeSection.collapseTreeItem(constants.restAuthenticationApps);
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(authenticationApp.name),
                    constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Link REST Authentication App", async () => {
            try {
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath,
                    constants.linkRestAuthenticationApp);
                const dialog = await new GenericDialog().untilExists();
                await dialog.selectFromList(authenticationApp.name);
                await dialog.ok();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message)
                    .toBe(`The MRS Authentication App has been linked to service ${service1.name}`);
                await notification!.close();
                await dbTreeSection.collapseTreeItem(constants.restAuthenticationApps);
                await driver.wait(dbTreeSection.untilTreeItemExists(authenticationApp.name),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Delete REST Services", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service1.servicePath, constants.deleteRESTService);
                await (await new ConfirmDialog().untilExists()).accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been deleted successfully.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(service1.servicePath),
                    constants.wait5seconds);

            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Rest Schemas", () => {

        let service2: interfaces.IRestService = {
            servicePath: `/service2`,
            enabled: true,
            name: "service2",
            restSchemas: [
                {
                    restServicePath: `/service2`,
                    restSchemaPath: `/sakila`,
                    accessControl: constants.accessControlEnabled,
                    requiresAuth: false,
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
                    requiresAuth: false,
                    settings: {
                        schemaName: "world_x_cst",
                        itemsPerPage: "35",
                        comments: "Hello",
                    },
                },
            ],
        };

        beforeAll(async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                service2 = await RestServiceDialog.set(service2);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service2.servicePath),
                    constants.wait5seconds);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_Rest_Schemas");
                throw e;
            }
        });

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_Rest_Schemas");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });

        afterAll(async () => {
            try {
                await dbTreeSection.collapseTreeItem(service2.servicePath);
            } catch (e) {
                await Misc.storeScreenShot("afterAll_Rest_Schemas");
                throw e;
            }
        });

        it("Add REST Service Schemas", async () => {
            try {
                for (let i = 0; i <= service2.restSchemas!.length - 1; i++) {
                    await dbTreeSection.openContextMenuAndSelect(service2.restSchemas![i].settings!.schemaName!,
                        constants.addSchemaToREST);
                    service2.restSchemas![i] = await RestSchemaDialog.set(service2.restSchemas![i]);
                    const notification = await new E2EToastNotification().create();
                    expect(notification!.message).toBe("The MRS schema has been added successfully.");
                    await notification!.close();
                    await dbTreeSection.expandTreeItem(service2.servicePath);
                    await driver.wait(dbTreeSection.untilTreeItemExists(`${service2.restSchemas![i]
                        .restSchemaPath} (${service2.restSchemas![i].settings?.schemaName})`),
                        constants.wait10seconds);
                }
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit REST Schema", async () => {
            try {
                await dbTreeSection.expandTreeItem(service2.servicePath);
                await dbTreeSection.openContextMenuAndSelect(`${service2.restSchemas![1]
                    .restSchemaPath} (${service2.restSchemas![1].settings?.schemaName})`, constants.editRESTSchema);

                const editedSchema: interfaces.IRestSchema = {
                    restServicePath: service2.servicePath,
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

                service2.restSchemas![service2.restSchemas!
                    .length - 1] = await RestSchemaDialog.set(editedSchema);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been updated successfully.");
                await notification!.close();

                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                await dbTreeSection.openContextMenuAndSelect(`${service2.restSchemas![1]
                    .restSchemaPath} (${service2.restSchemas![1].settings?.schemaName})`, constants.editRESTSchema);
                const thisSchema = await RestSchemaDialog.get();
                expect(thisSchema).toStrictEqual(editedSchema);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Delete REST Schema", async () => {
            try {

                await dbTreeSection.expandTreeItem(service2.servicePath);
                await dbTreeSection.expandTreeItem(`${service2.restSchemas![0]
                    .restSchemaPath} (${service2.restSchemas![0].settings?.schemaName})`);

                await dbTreeSection.openContextMenuAndSelect(`${service2.restSchemas![0]
                    .restSchemaPath} (${service2.restSchemas![0].settings?.schemaName})`, constants.deleteRESTSchema);

                const dialog = await new ConfirmDialog().untilExists();
                await dialog.accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been deleted successfully.");
                await notification!.close();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                expect(await dbTreeSection.existsTreeItem(`${service2.restSchemas![0]
                    .restSchemaPath} (${service2.restSchemas![0].settings?.schemaName})`)).toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Rest Objects", () => {

        let service3: interfaces.IRestService = {
            servicePath: `/service3`,
            name: "service3",
            enabled: true,
            restSchemas: [
                {
                    restServicePath: `/service3`,
                    restSchemaPath: `/sakila`,
                    accessControl: constants.accessControlEnabled,
                    requiresAuth: false,
                    settings: {
                        schemaName: "sakila",
                        itemsPerPage: "35",
                        comments: "Hello",
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

        beforeAll(async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                service3 = await RestServiceDialog.set(service3);
                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service3.servicePath), constants.wait5seconds);
                await dbTreeSection.expandTreeItem(service3.servicePath);

                await dbTreeSection.openContextMenuAndSelect(service3.restSchemas![0].settings!.schemaName!,
                    constants.addSchemaToREST);
                service3.restSchemas![0] = await RestSchemaDialog.set(service3.restSchemas![0]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been added successfully.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(`${service3.restSchemas![0]
                    .restSchemaPath} (${service3.restSchemas![0].settings?.schemaName})`),
                    constants.wait10seconds);

                await dbTreeSection.openContextMenuAndSelect(service3.servicePath, constants.setAsCurrentREST);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been set as the new default service.");
                await notification!.close();
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_Rest_Objects");
                throw e;
            }
        });

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_Rest_Objects");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });

        afterAll(async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service3.servicePath, constants.deleteRESTService);
                await (await new ConfirmDialog().untilExists()).accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been deleted successfully.");
                await notification!.close();
            } catch (e) {
                await Misc.storeScreenShot("afterAll_Rest_Objects");
                throw e;
            }
        });

        it("Add Tables to REST Service", async () => {
            try {
                await dbTreeSection.expandTree([
                    service3.restSchemas![0].settings!.schemaName!,
                    "Tables",
                ]);

                for (const table of service3.restSchemas![0].restObjects!) {
                    await Misc.dismissNotifications();
                    await dbTreeSection.openContextMenuAndSelect(table.dataMapping!.dbObject!,
                        constants.addDBObjToREST);

                    await RestObjectDialog.set({
                        restServicePath: service3.servicePath,
                    });

                    const notifications = await Misc.getToastNotifications(true);
                    const messages = notifications.map((item: E2EToastNotification | undefined) => {
                        return item!.message;
                    });

                    expect(messages)
                        .toContain(`The MRS Database Object ${table.dataMapping!.dbObject} was successfully updated.`);
                    await Promise.all([
                        notifications.map((item: E2EToastNotification | undefined) => {
                            return item!.close();
                        }),
                    ]);

                    await dbTreeSection.expandTreeItem((`${service3.restSchemas![0]
                        .restSchemaPath} (${service3.restSchemas![0].settings?.schemaName})`));
                    await driver.wait(dbTreeSection.untilTreeItemExists(table.restObjectPath!), constants.wait5seconds);
                }
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit REST Object", async () => {
            try {
                const editedObject: interfaces.IRestObject = {
                    restServicePath: service3.servicePath,
                    restSchemaPath: service3.restSchemas![0].restSchemaPath,
                    restObjectPath: `/editedObject`,
                    accessControl: constants.accessControlDisabled,
                    requiresAuth: true,
                    dataMapping: {
                        dbObject: service3.restSchemas![0].restObjects![0].dataMapping?.dbObject,
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


                await dbTreeSection.openContextMenuAndSelect(service3.restSchemas![0].restObjects![0].restObjectPath!,
                    constants.editRESTObj);
                service3.restSchemas![0].restObjects![0] = await RestObjectDialog.set(editedObject);

                let ntf = `The MRS Database Object ${editedObject.dataMapping!.dbObject}`;
                ntf += ` was successfully updated.`;

                const notifications = await Misc.getToastNotifications(true);
                const messages = notifications.map((item: E2EToastNotification | undefined) => {
                    return item!.message;
                });

                expect(messages).toContain(ntf);
                await Promise.all([
                    notifications.map((item: E2EToastNotification | undefined) => {
                        return item!.close();
                    }),
                ]);

                await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                await dbTreeSection.openContextMenuAndSelect(service3.restSchemas![0].restObjects![0].restObjectPath!,
                    constants.editRESTObj);
                const thisObject = await RestObjectDialog.get();
                expect(thisObject).toStrictEqual(editedObject);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Open REST Object Request Path in Browser", async () => {
            try {
                let browserTabs: string[] = [];
                const addressTable = service3.restSchemas![0].restObjects![1].restObjectPath;
                await dbTreeSection.openContextMenuAndSelect(addressTable!, constants.openRESTObjReqPathInBrowser);
                await driver.wait(async () => {
                    browserTabs = await driver.getAllWindowHandles();
                    if (browserTabs.length > 1) {
                        await driver.switchTo().window(browserTabs[1]);

                        return true;
                    }
                }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

                const service = service3.servicePath;
                const sakila = service3.restSchemas![0].settings?.schemaName;
                const address = service3.restSchemas![0].restObjects![1].dataMapping?.dbObject;

                const regex = new RegExp(`localhost:(\\d+)${service}/${sakila}/${address}`);
                expect(await driver.getCurrentUrl()).toMatch(regex);
                await driver.switchTo().window(browserTabs[0]);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Delete REST Object", async () => {
            try {
                const objectToRemove = service3.restSchemas![0].restObjects![0].restObjectPath!;
                await dbTreeSection.openContextMenuAndSelect(objectToRemove, constants.deleteRESTObj);
                const dialog = await new ConfirmDialog().untilExists();
                await dialog.accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS DB object has been deleted successfully.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(objectToRemove), constants.wait5seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Authentication Apps", () => {

        let service4: interfaces.IRestService = {
            servicePath: `/service4`,
            name: "service4",
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
                },
            ],
        };

        const restUser = {
            username: "gui",
            authenticationApp: "new app",
            email: "user@oracle.com",
            assignedRoles: undefined,
            userOptions: "",
            permitLogin: true,
            vendorUserId: "1234",
            mappedUserId: "testing",
        };

        beforeAll(async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                service4 = await RestServiceDialog.set(service4);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service4.servicePath), constants.wait5seconds);
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_AuthenticationApps");
                throw e;
            }
        });

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_AuthenticationApps");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });

        afterAll(async () => {
            try {
                await dbTreeSection.collapseTreeItem(service4.servicePath);
            } catch (e) {
                await Misc.storeScreenShot("afterAll_AuthenticationApps");
                throw e;
            }
        });

        it("Add New Authentication App", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.restAuthenticationApps,
                    constants.addNewAuthenticationApp);
                await AuthenticationAppDialog.set(service4.authenticationApps![0]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS Authentication App has been added.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service4.authenticationApps![0].name),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Edit Authentication App", async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps![0].name,
                    constants.editAuthenticationApp);

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

                service4.authenticationApps![0] = await AuthenticationAppDialog.set(editedApp);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS Authentication App has been updated.");
                await notification!.close();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();

                await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps![0].name,
                    constants.editAuthenticationApp);
                const authApp = await AuthenticationAppDialog.get();
                expect(authApp).toStrictEqual(editedApp);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Link REST Authentication App", async () => {
            try {
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
                await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps![0].name,
                    constants.linkRestAuthenticationAppToRestService);
                const dialog = await new GenericDialog().untilExists();
                await dialog.selectFromList(service4.servicePath);
                await dialog.ok();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message)
                    .toBe(`The MRS Authentication App has been linked to service ${service4.name}`);
                await notification!.close();
                await dbTreeSection.collapseTreeItem(constants.restAuthenticationApps);
                await dbTreeSection.expandTreeItem(service4.servicePath);
                expect(await dbTreeSection.existsTreeItem(service4.authenticationApps![0].name)).toBe(true);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Add Rest user", async () => {
            try {
                await dbTreeSection.collapseTreeItem(service4.servicePath);
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
                await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps![0].name,
                    constants.addRESTUser);
                await RestUserDialog.set(restUser);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message)
                    .toBe(`The MRS User "${restUser.username}" has been added.`);
                await notification!.close();
                await dbTreeSection.expandTreeItem(service4.authenticationApps![0].name);
                await driver.wait(dbTreeSection.untilTreeItemExists(restUser.username),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Delete Authentication App", async () => {
            try {
                await dbTreeSection.collapseTreeItem(service4.servicePath);
                await dbTreeSection.openContextMenuAndSelect(service4.authenticationApps![0].name,
                    constants.deleteAuthenticationApp);

                await (await new ConfirmDialog().untilExists()).accept();

                let ntf = `The MRS Authentication App "${service4.authenticationApps![0].name}"`;
                ntf += ` has been deleted.`;

                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe(ntf);
                await notification!.close();

                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(service4.authenticationApps![0].name),
                    constants.wait3seconds);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

    describe("Rest Users", () => {

        const service5: interfaces.IRestService = {
            servicePath: `/service5`,
            name: "service4",
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
                    user: [{
                        username: "gui",
                        authenticationApp: "new app",
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

        beforeAll(async () => {
            try {
                await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
                await RestServiceDialog.set(service5);
                let notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemExists(service5.servicePath), constants.wait5seconds);

                await dbTreeSection.openContextMenuAndSelect(constants.restAuthenticationApps,
                    constants.addNewAuthenticationApp);
                await AuthenticationAppDialog.set(service5.authenticationApps![0]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS Authentication App has been added.");
                await notification!.close();
                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
                await driver.wait(dbTreeSection.untilTreeItemExists(service5.authenticationApps![0].name),
                    constants.wait3seconds);

                await dbTreeSection.expandTreeItem(constants.restAuthenticationApps);
                await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps![0].name,
                    constants.addRESTUser);
                await RestUserDialog.set(service5.authenticationApps![0].user![0]);
                notification = await new E2EToastNotification().create();
                expect(notification!.message)
                    .toBe(`The MRS User "${service5.authenticationApps![0].user![0].username}" has been added.`);
                await notification!.close();
                await dbTreeSection.expandTreeItem(service5.authenticationApps![0].name);
                await driver.wait(dbTreeSection.untilTreeItemExists(service5.authenticationApps![0].user![0].username),
                    constants.wait3seconds);
            } catch (e) {
                await Misc.storeScreenShot("beforeAll_Rest_Users");
                throw e;
            }
        });

        beforeEach(async () => {
            try {
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);
            } catch (e) {
                await Misc.storeScreenShot("beforeEach_Rest_Users");
                throw e;
            }
        });

        afterEach(async () => {
            if (testFailed) {
                testFailed = false;
                await Misc.storeScreenShot();
            }

            await Misc.dismissNotifications();
        });

        afterAll(async () => {
            try {
                await dbTreeSection.collapseTreeItem(service5.servicePath);
            } catch (e) {
                await Misc.storeScreenShot("afterAll_Rest_Users");
                throw e;
            }
        });

        it("Edit User", async () => {
            try {
                await dbTreeSection.expandTreeItem(service5.authenticationApps![0].name);
                await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps![0].user![0].username,
                    constants.editRESTUser);

                const editedUser: interfaces.IRestUser = {
                    username: "testUser",
                    authenticationApp: service5.authenticationApps![0].name,
                    email: "testuser@oracle.com",
                    assignedRoles: undefined,
                    userOptions: `{"test":"value"}`,
                    permitLogin: false,
                    vendorUserId: "123467",
                    mappedUserId: "stillTesting",
                };

                service5.authenticationApps![0].user![0] = await RestUserDialog.set(editedUser);
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe(`The MRS User "${editedUser.username}" has been updated.`);
                await notification!.close();

                await dbTreeSection.expandTreeItem(service5.authenticationApps![0].name);
                await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps![0].user![0].username,
                    constants.editRESTUser);

                const user = await RestUserDialog.get();
                editedUser.assignedRoles = "Full Access";
                editedUser.password = "[Stored Password]";
                expect(editedUser).toStrictEqual(user);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

        it("Delete User", async () => {
            try {
                await dbTreeSection.expandTree([service5.authenticationApps![0].name]);
                await dbTreeSection.openContextMenuAndSelect(service5.authenticationApps![0].user![0].username,
                    constants.deleteRESTUser);
                await (await new ConfirmDialog().untilExists()).accept();

                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe(`The MRS user ${service5.authenticationApps![0].user![0]
                    .username} has been deleted successfully.`);
                await notification!.close();
                const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
                expect(await dbTreeSection.existsTreeItem(service5.authenticationApps![0].user![0].username))
                    .toBe(false);
            } catch (e) {
                testFailed = true;
                throw e;
            }
        });

    });

});

describe("MYSQL REST SERVICE - CLIPBOARD", () => {

    let otherService: interfaces.IRestService = {
        servicePath: `/clipboardService`,
        name: "clipboardService",
        enabled: true,
        default: false,
        restSchemas: [
            {
                restServicePath: `/clipboardService`,
                restSchemaPath: `/sakila`,
                accessControl: constants.accessControlEnabled,
                requiresAuth: false,
                settings: {
                    schemaName: "sakila",
                    itemsPerPage: "35",
                    comments: "Hello",
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
            {
                restServicePath: `/clipboardService`,
                restSchemaPath: `/world_x_cst`,
                accessControl: constants.accessControlEnabled,
                requiresAuth: false,
                settings: {
                    schemaName: "world_x_cst",
                    itemsPerPage: "35",
                    comments: "Hello",
                },
                restObjects: [
                    {
                        dataMapping: {
                            dbObject: "city",
                        },
                    },
                ],
            },
        ],
    };

    beforeAll(async () => {

        await loadDriver(false);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await dbTreeSection.focus();

            if (!(await dbTreeSection.existsTreeItem(globalConn.caption!))) {
                await dbTreeSection.createDatabaseConnection(globalConn);
                await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
                await dbTreeSection.expandTreeItem(globalConn);
                await dbTreeSection.openContextMenuAndSelect(globalConn.caption!, constants.showSystemSchemas);

                if (!(await dbTreeSection.existsTreeItem("mysql_rest_service_metadata"))) {
                    await dbTreeSection.configureMySQLRestService(globalConn.caption!, globalConn);
                }
            } else {
                await dbTreeSection.expandTreeItem(globalConn);
            }

            await dbTreeSection.openContextMenuAndSelect(constants.mysqlRestService, constants.addRESTService);
            otherService = await RestServiceDialog.set(otherService);
            let notification = await new E2EToastNotification().create();
            await notification!.close();

            await dbTreeSection.expandTreeItem(constants.mysqlRestService);
            await driver.wait(dbTreeSection.untilTreeItemExists(otherService.servicePath),
                constants.wait10seconds);
            await Misc.dismissNotifications();

            await dbTreeSection.openContextMenuAndSelect(otherService.servicePath, constants.setAsCurrentREST);
            notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS service has been set as the new default service.");
            await notification!.close();

            await dbTreeSection.expandTree([otherService.restSchemas![0].settings!.schemaName!, "Tables"]);

            await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].settings!.schemaName!,
                constants.addSchemaToREST);

            otherService.restSchemas![0] = await RestSchemaDialog.set(otherService.restSchemas![0]);
            notification = await new E2EToastNotification().create();
            await notification!.close();

            await dbTreeSection.expandTreeItem(otherService.servicePath);
            await driver.wait(dbTreeSection.untilTreeItemExists(`${otherService.restSchemas![0]
                .restSchemaPath!} (${otherService.restSchemas![0].settings!.schemaName!})`),
                constants.wait10seconds);

            await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].restObjects![1].dataMapping!
                .dbObject!, constants.addDBObjToREST);

            await RestObjectDialog.set({ restServicePath: otherService.servicePath });
            await (await (await dbTreeSection.getTreeItem(globalConn.caption!))
                .getActionButton(constants.refreshConnection))!.click();

            await dbTreeSection.expandTree([
                otherService.servicePath,
                `${otherService.restSchemas![0].restSchemaPath!} (${otherService.restSchemas![0]
                    .settings!.schemaName})`,
            ]);

            await driver.wait(dbTreeSection
                .untilTreeItemExists(otherService.restSchemas![0].restObjects![1].restObjectPath!),
                constants.wait3seconds);

            notification = await new E2EToastNotification().create();
            const notifications = await Misc.getToastNotifications();

            for (const ntf of notifications) {
                await ntf?.close();
            }

        } catch (e) {
            await Misc.storeScreenShot("beforeAll_MysqlRESTService_CLIPBOARD");
            throw e;
        }
    });

    beforeEach(async () => {
        try {
            await TestQueue.push(expect.getState().currentTestName!);
            await driver.wait(TestQueue.poll(expect.getState().currentTestName!), constants.queuePollTimeout);

            await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                `${constants.dbTreeSection} is still loading`);
        } catch (e) {
            await Misc.storeScreenShot("beforeEach_MRS_clipboard");
            throw e;
        }
    });

    afterEach(async () => {
        await TestQueue.pop(expect.getState().currentTestName!);

        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot();
        }

        await Misc.dismissNotifications();
    });

    afterAll(async () => {
        await Os.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    it("Copy CREATE REST SERVICE Statement", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(otherService.servicePath,
                [constants.copyToClipboard.exists, constants.copyCreateRestServiceSt]);

            let notification = await new E2EToastNotification().create();
            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.openContextMenuAndSelect(otherService.servicePath,
                    [constants.copyToClipboard.exists, constants.copyCreateRestServiceSt]);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE REST SERVICE|${constants.jsError})`));

            await notification!.close();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy CREATE REST SCHEMA Statement", async () => {
        try {
            const restSchema = `${otherService.restSchemas![0]
                .restSchemaPath!} (${otherService.restSchemas![0].settings!.schemaName})`;

            await dbTreeSection.openContextMenuAndSelect(restSchema,
                [constants.copyToClipboard.exists, constants.copyCreateRestSchemaSt]);

            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.openContextMenuAndSelect(restSchema,
                    [constants.copyToClipboard.exists, constants.copyCreateRestSchemaSt]);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE OR REPLACE REST SCHEMA|${constants.jsError})`));

            await notification!.close();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy CREATE REST OBJECT Statement", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].restObjects![1].restObjectPath!,
                [constants.copyToClipboard.exists, constants.copyCreateRestObjSt]);


            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].restObjects![1]
                    .restObjectPath!,
                    [constants.copyToClipboard.exists, constants.copyCreateRestObjSt]);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE OR REPLACE REST VIEW|${constants.jsError})`));

            await notification!.close();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy REST Object Request Path to Clipboard", async () => {
        try {
            const service = otherService.servicePath;
            const sakila = otherService.restSchemas![0].settings?.schemaName;
            const address = otherService.restSchemas![0].restObjects![1].dataMapping?.dbObject;
            const regex = new RegExp(`(localhost:(\\d+)${service}/${sakila}/${address}|${constants.jsError})`);

            await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].restObjects![1].restObjectPath!,
                [constants.copyToClipboard.exists, constants.copyRESTObjReqPath]);


            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].restObjects![1]
                    .restObjectPath!,
                    [constants.copyToClipboard.exists,
                    constants.copyRESTObjReqPath]);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The DB Object Path was copied to the system clipboard");
            const clipboard = await Os.readClipboard();
            expect(clipboard).toMatch(regex);

            await Misc.dismissNotifications();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});
