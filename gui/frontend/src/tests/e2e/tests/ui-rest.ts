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

import { error } from "selenium-webdriver";
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

const globalService: interfaces.IRestService = {
    servicePath: `/service1`,
    enabled: true,
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
    restSchemas: [
        {
            restServicePath: `/service1`,
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
                    treeName: `/actor`,
                    dataMapping: {
                        dbObject: "actor",
                    },
                },
                {
                    treeName: `/address`,
                    dataMapping: {
                        dbObject: "address",
                    },
                },
            ],
        },
        {
            restServicePath: `/service1`,
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
                    treeName: `/address`,
                    dataMapping: {
                        dbObject: "address",
                    },
                },
            ],
        },
    ],
};

let serviceToEdit: interfaces.IRestService = {
    treeName: ``,
    servicePath: `/service2`,
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
            vendor: "MRS",
            name: "test",
            enabled: false,
            limitToRegisteredUsers: false,
            settings: {
                description: "testing",
            },
            oauth2settings: {
                appId: "OAuth2",
                appSecret: "1234",
                customURL: "http://testing",
                customURLforAccessToken: "http://testing/1234",
            },
        },
    ],
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

const restAuthenticationApp: interfaces.IRestAuthenticationApp = {
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
};

let otherService: interfaces.IRestService = {
    servicePath: `/clipboardService`,
    enabled: true,
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
                    treeName: `/actor`,
                    dataMapping: {
                        dbObject: "actor",
                    },
                },
                {
                    treeName: `/address`,
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
                    treeName: `/city`,
                    dataMapping: {
                        dbObject: "city",
                    },
                },
            ],
        },
    ],
};

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
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await treeGlobalConn.expand(globalConn);
            await treeGlobalConn.openContextMenuAndSelect(constants.showSystemSchemas);

            if (!(await dbTreeSection.existsTreeItem("mysql_rest_service_metadata"))) {
                await treeGlobalConn.configureMySQLRestService(globalConn);
            }

            await (await dbTreeSection.getTreeItem(constants.mysqlRestService))?.expand();
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
            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
            await treeMySQLRestService.openContextMenuAndSelect(constants.disableRESTService);

            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

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
            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
            await treeMySQLRestService.openContextMenuAndSelect(constants.enableRESTService);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

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

    it("Browse the MySQL REST Service Documentation", async () => {
        let browserTabs: string[] = [];
        try {
            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
            await treeMySQLRestService.openContextMenuAndSelect(constants.browseRESTDocs);
            await driver.wait(async () => {
                browserTabs = await driver.getAllWindowHandles();
                if (browserTabs.length > 1) {
                    await driver.switchTo().window(browserTabs[1]);

                    return true;
                }
            }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

            expect(await driver.getCurrentUrl()).toContain("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/");

            await driver.close();
            await driver.switchTo().window(browserTabs[0]);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Create Rest Services", async () => {
        try {
            const services = [globalService, serviceToEdit];
            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);

            for (let i = 0; i <= services.length - 1; i++) {
                await treeMySQLRestService.openContextMenuAndSelect(constants.addRESTService);
                services[i] = await RestServiceDialog.set(services[i]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();

                await driver.wait(dbTreeSection.untilTreeItemExists(services[i].treeName!),
                    constants.wait10seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Service", async () => {
        try {
            const treeServiceToEdit = await dbTreeSection.getTreeItem(serviceToEdit.treeName!);
            await treeServiceToEdit.openContextMenuAndSelect(constants.editRESTService);

            const editedService = {
                treeName: "/edited",
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

            serviceToEdit = await RestServiceDialog.set(editedService);
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS service has been successfully updated.");
            await notification!.close();

            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            await driver.wait(dbTreeSection.untilTreeItemExists(serviceToEdit.treeName!), constants.wait10seconds);
            await dbTreeSection.openContextMenuAndSelect(serviceToEdit.treeName!, constants.editRESTService);

            const service = await RestServiceDialog.get();
            expect(editedService).toStrictEqual(service);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add REST Service Schemas", async () => {
        try {
            for (let i = 0; i <= globalService.restSchemas!.length - 1; i++) {
                const treeSchema = await dbTreeSection.getTreeItem(globalService.restSchemas![i].settings!.schemaName!);
                await treeSchema.openContextMenuAndSelect(constants.addSchemaToREST);
                globalService.restSchemas![i] = await RestSchemaDialog.set(globalService.restSchemas![i]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been added successfully.");
                await notification!.close();
                const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);
                await treeGlobalService.expand();
                await driver.wait(dbTreeSection.untilTreeItemExists(globalService.restSchemas![i].treeName!),
                    constants.wait10seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Schema", async () => {
        try {
            const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);
            await treeGlobalService.expand();
            let treeRestWorldSchema = await dbTreeSection.getTreeItem(globalService.restSchemas![1].treeName!);
            await treeRestWorldSchema.openContextMenuAndSelect(constants.editRESTSchema);

            const editedSchema: interfaces.IRestSchema = {
                restServicePath: globalService.servicePath,
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

            globalService.restSchemas![globalService.restSchemas!
                .length - 1] = await RestSchemaDialog.set(editedSchema);
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS schema has been updated successfully.");
            await notification!.close();

            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            treeRestWorldSchema = await dbTreeSection.getTreeItem(globalService.restSchemas![1].treeName!);
            await treeRestWorldSchema.openContextMenuAndSelect(constants.editRESTSchema);
            const thisSchema = await RestSchemaDialog.get();
            expect(thisSchema).toStrictEqual(editedSchema);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Set as Current REST Service", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(globalService.treeName!, constants.setAsCurrentREST);
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS service has been set as the new default service.");
            await notification!.close();

            await driver.wait(async () => {
                try {
                    const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);

                    return treeGlobalService.isDefault();
                } catch (e) {
                    if (!(e instanceof error.StaleElementReferenceError)) {
                        throw e;
                    }
                }
            }, constants.wait3seconds, `${globalService.treeName!} was not marked as DEFAULT`);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add Tables to REST Service", async () => {
        try {
            const sakila = sakilaRestSchema.settings!.schemaName!;
            const treeSakila = await dbTreeSection.getTreeItem(sakila);
            await treeSakila.expand();
            await (await dbTreeSection.getTreeItem("Tables")).expand();

            const tables = ["actor", "address"];

            for (const table of tables) {
                await Misc.dismissNotifications();
                const treeTable = await dbTreeSection.getTreeItem(table);
                await treeTable.openContextMenuAndSelect(constants.addDBObjToREST);
                await RestObjectDialog.set({
                    restServicePath: globalService.treeName,
                });

                const notifications = await Misc.getToastNotifications(true);
                const messages = notifications.map((item: E2EToastNotification | undefined) => {
                    return item!.message;
                });

                expect(messages).toContain(`The MRS Database Object ${table} was successfully updated.`);
                await Promise.all([
                    notifications.map((item: E2EToastNotification | undefined) => {
                        return item!.close();
                    }),
                ]);

                const treeRestSakila = await dbTreeSection.getTreeItem(globalService.restSchemas![0].treeName!);
                await treeRestSakila.expand();
                await driver.wait(dbTreeSection.untilTreeItemExists(`/${table}`), constants.wait5seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Object", async () => {
        try {
            const editedObject: interfaces.IRestObject = {
                treeName: `/editedObject`,
                restServicePath: globalService.treeName,
                restSchemaPath: globalService.restSchemas![0].restSchemaPath,
                restObjectPath: `/editedObject`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                dataMapping: {
                    dbObject: globalService.restSchemas![0].restObjects![0].dataMapping?.dbObject,
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

            let treeRestActor = await dbTreeSection
                .getTreeItem(globalService.restSchemas![0].restObjects![0].treeName!);
            await treeRestActor.openContextMenuAndSelect(constants.editRESTObj);

            globalService.restSchemas![0].restObjects![0] = await RestObjectDialog.set(editedObject);

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
            treeRestActor = await dbTreeSection
                .getTreeItem(globalService.restSchemas![0].restObjects![0].treeName!);
            await treeRestActor.openContextMenuAndSelect(constants.editRESTObj);
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
            const addressTable = globalService.restSchemas![0].restObjects![1].treeName!;
            const treeAddressTable = await dbTreeSection.getTreeItem(addressTable);
            await treeAddressTable.openContextMenuAndSelect(constants.openRESTObjReqPathInBrowser);
            await driver.wait(async () => {
                browserTabs = await driver.getAllWindowHandles();
                if (browserTabs.length > 1) {
                    await driver.switchTo().window(browserTabs[1]);

                    return true;
                }
            }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

            const service = globalService.servicePath;
            const sakila = globalService.restSchemas![0].settings?.schemaName;
            const address = globalService.restSchemas![0].restObjects![1].dataMapping?.dbObject;

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
            const objectToRemove = globalService.restSchemas![0].restObjects![0].treeName!;
            const treeRestObject = await dbTreeSection.getTreeItem(objectToRemove);
            await treeRestObject.openContextMenuAndSelect(constants.deleteRESTObj);
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

    it("Delete REST Schema", async () => {
        try {
            const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);
            await treeGlobalService.expand();
            const treeRestSakila = await dbTreeSection.getTreeItem(globalService.restSchemas![0].treeName!);
            await treeRestSakila.openContextMenuAndSelect(constants.deleteRESTSchema);

            const dialog = await new ConfirmDialog().untilExists();
            await dialog.accept();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS schema has been deleted successfully.");
            await notification!.close();
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            expect(await treeRestSakila.exists()).toBe(false);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add and Link New REST Authentication App", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(globalService.treeName!, constants.addLinkAuthApp);
            globalService.authenticationApps = [await AuthenticationAppDialog.set(restAuthenticationApp)];
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS Authentication App has been added.");
            await notification!.close();

            const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);
            await treeGlobalService.expand();
            await driver.wait(dbTreeSection.untilTreeItemExists(globalService.authenticationApps[0].treeName!),
                constants.wait5seconds);

            const restAuthenticationApps = await dbTreeSection.getTreeItem(constants.restAuthenticationApps);
            await restAuthenticationApps.expand();
            const childApp = await restAuthenticationApps.findChildItem(globalService.authenticationApps[0].treeName!);
            expect(childApp).toBeDefined();
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add User", async () => {
        try {
            const treeRestAuthenticationApps = await dbTreeSection.getTreeItem(constants.restAuthenticationApps);
            await treeRestAuthenticationApps.expand();
            const treeGlobalService = await dbTreeSection.getTreeItem(globalService.treeName!);
            await treeGlobalService.collapse();
            const treeRestAuthenticationApp = await dbTreeSection
                .getTreeItem(globalService.authenticationApps![0].treeName!);
            await treeRestAuthenticationApp.openContextMenuAndSelect(constants.addRESTUser);

            globalService.authenticationApps![0].user = [await RestUserDialog.set(restAuthenticationApp.user![0])];
            const notification = await new E2EToastNotification().create();
            expect(notification!.message)
                .toBe(`The MRS User "${restAuthenticationApp.user![0].username}" has been added.`);
            await notification!.close();

            const treeRestAuthApp = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].treeName!);
            await treeRestAuthApp.expand();
            await driver.wait(dbTreeSection.untilTreeItemExists(restAuthenticationApp.user![0].username),
                constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit User", async () => {
        try {
            let treeRestAuthApp = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].treeName!);
            await treeRestAuthApp.expand();

            let treeUser = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].user![0].username);
            await treeUser.openContextMenuAndSelect(constants.editRESTUser);

            const editedUser: interfaces.IRestUser = {
                username: "testUser",
                authenticationApp: globalService.authenticationApps![0].name,
                email: "testuser@oracle.com",
                assignedRoles: undefined,
                userOptions: `{"test":"value"}`,
                permitLogin: false,
                vendorUserId: "123467",
                mappedUserId: "stillTesting",
            };

            globalService.authenticationApps![0].user![0] = await RestUserDialog.set(editedUser);
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(`The MRS User "${editedUser.username}" has been updated.`);
            await notification!.close();

            treeRestAuthApp = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].treeName!);
            await treeRestAuthApp.expand();
            treeUser = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].user![0].username);
            await treeUser.openContextMenuAndSelect(constants.editRESTUser);

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
            const treeRestAuthApp = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].treeName!);
            await treeRestAuthApp.expand();

            const treeUser = await dbTreeSection.getTreeItem(globalService.authenticationApps![0].user![0].username);
            await treeUser.openContextMenuAndSelect(constants.deleteRESTUser);
            await (await new ConfirmDialog().untilExists()).accept();

            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(`The MRS user ${globalService.authenticationApps![0].user![0]
                .username} has been deleted successfully.`);
            await notification!.close();
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            expect(await treeUser.exists()).toBe(false);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit Authentication App", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
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

            globalService.authenticationApps![0] = await AuthenticationAppDialog.set(editedApp);
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS Authentication App has been updated.");
            await notification!.close();
            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();

            await dbTreeSection.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
                constants.editAuthenticationApp);
            const authApp = await AuthenticationAppDialog.get();
            expect(authApp).toStrictEqual(editedApp);
            globalService.authenticationApps![0].user = [restAuthenticationApp.user![0]];
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete Authentication App", async () => {
        try {
            await dbTreeSection.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
                constants.deleteAuthenticationApp);

            await (await new ConfirmDialog().untilExists()).accept();

            let ntf = `The MRS Authentication App "${globalService.authenticationApps![0].name}"`;
            ntf += ` has been deleted.`;

            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(ntf);
            await notification!.close();

            const treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();
            await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(globalService.authenticationApps![0].treeName!),
                constants.wait3seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete REST Services", async () => {
        try {
            const services = [globalService, serviceToEdit];

            for (const service of services) {
                await driver.wait(async () => {
                    try {
                        const treeRestService = await dbTreeSection.getTreeItem(service.treeName!);
                        await treeRestService.openContextMenuAndSelect(constants.deleteRESTService);

                        return true;
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        }
                    }
                }, constants.wait5seconds, `${service.treeName} was always Staled`);


                await (await new ConfirmDialog().untilExists()).accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been deleted successfully.");
                await notification!.close();
                await driver.wait(dbTreeSection.untilTreeItemDoesNotExists(service.treeName!), constants.wait5seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("MYSQL REST SERVICE - CLIPBOARD", () => {

    let treeGlobalConn: E2ETreeItem | undefined;

    beforeAll(async () => {

        await loadDriver(false);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await dbTreeSection.focus();

            if (!(await dbTreeSection.existsTreeItem(globalConn.caption!))) {
                await dbTreeSection.createDatabaseConnection(globalConn);
                await driver.wait(dbTreeSection.untilTreeItemExists(globalConn.caption!), constants.wait3seconds);
                treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.expand(globalConn);
                treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.openContextMenuAndSelect(constants.showSystemSchemas);

                if (!(await dbTreeSection.existsTreeItem("mysql_rest_service_metadata"))) {
                    await treeGlobalConn.configureMySQLRestService(globalConn);
                }
            } else {
                treeGlobalConn = await dbTreeSection.getTreeItem(globalConn.caption!);
                await treeGlobalConn.expand(globalConn);
            }

            const treeMySQLRestService = await dbTreeSection.getTreeItem(constants.mysqlRestService);
            await treeMySQLRestService.click();
            await treeMySQLRestService.openContextMenuAndSelect(constants.addRESTService);

            otherService = await RestServiceDialog.set(otherService);
            let notification = await new E2EToastNotification().create();
            await notification!.close();

            await driver.wait(dbTreeSection.untilTreeItemExists(otherService.treeName!),
                constants.wait10seconds);
            await Misc.dismissNotifications();

            await dbTreeSection.expandTree([otherService.restSchemas![0].settings!.schemaName!, "Tables"]);

            await dbTreeSection.openContextMenuAndSelect(otherService.restSchemas![0].settings!.schemaName!,
                constants.addSchemaToREST);

            otherService.restSchemas![0] = await RestSchemaDialog.set(otherService.restSchemas![0]);
            notification = await new E2EToastNotification().create();
            await notification!.close();

            await (await dbTreeSection.getTreeItem(otherService.treeName!)).expand();
            await driver.wait(dbTreeSection.untilTreeItemExists(otherService.restSchemas![0].treeName!),
                constants.wait10seconds);

            await dbTreeSection.openContextMenuAndSelect("address", constants.addDBObjToREST);
            await RestObjectDialog.set({ restServicePath: otherService.treeName });
            await (await treeGlobalConn.getActionButton(constants.refreshConnection))!.click();

            await dbTreeSection.expandTree([
                otherService.servicePath,
                otherService.restSchemas![0].treeName!,
            ]);

            await driver.wait(dbTreeSection
                .untilTreeItemExists(otherService.restSchemas![0].restObjects![1].treeName!), constants.wait3seconds);

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
            const treeOtherService = await dbTreeSection.getTreeItem(otherService.treeName!);

            await treeOtherService.openContextMenuAndSelect(
                [constants.copyToClipboard.exists, constants.copyCreateRestServiceSt]);

            let notification = await new E2EToastNotification().create();
            if (notification?.message.includes("SDK")) {
                await notification.close();
                await treeOtherService.openContextMenuAndSelect(
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
            const treeRestSchema = await dbTreeSection.getTreeItem(otherService.restSchemas![0].treeName!);

            await treeRestSchema.openContextMenuAndSelect(
                [constants.copyToClipboard.exists, constants.copyCreateRestSchemaSt]);

            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await treeRestSchema.openContextMenuAndSelect(
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
            const treeRestObject = await dbTreeSection
                .getTreeItem(otherService.restSchemas![0].restObjects![1].treeName!);

            await treeRestObject.openContextMenuAndSelect([constants.copyToClipboard.exists,
            constants.copyCreateRestObjSt]);

            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await treeRestObject.openContextMenuAndSelect(
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

            const treeRestObject = await dbTreeSection
                .getTreeItem(otherService.restSchemas![0].restObjects![1].treeName!);

            await treeRestObject.openContextMenuAndSelect([constants.copyToClipboard.exists,
            constants.copyRESTObjReqPath]);

            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await treeRestObject.openContextMenuAndSelect([constants.copyToClipboard.exists,
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
