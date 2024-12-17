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
                    treeName: `/actor (actor)`,
                    jsonRelDuality: {
                        dbObject: "actor",
                    },
                },
                {
                    treeName: `/city (city)`,
                    jsonRelDuality: {
                        dbObject: "city",
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
                    treeName: `/city (city)`,
                    jsonRelDuality: {
                        dbObject: "city",
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
                    treeName: `/actor (actor)`,
                    jsonRelDuality: {
                        dbObject: "actor",
                    },
                },
                {
                    treeName: `/city (city)`,
                    jsonRelDuality: {
                        dbObject: "city",
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
                    treeName: `/city (city)`,
                    jsonRelDuality: {
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
            await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait3seconds);
            await (await new E2EDatabaseConnectionOverview().getConnection(globalConn.caption!)).click();
            await driver.wait(new E2ENotebook().untilIsOpened(globalConn), constants.wait10seconds);
            Os.deleteShellCredentials();
            await dbTreeSection.tree.expandDatabaseConnection(globalConn);
            await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!, constants.showSystemSchemas);

            if (!(await dbTreeSection.tree.elementExists("mysql_rest_service_metadata"))) {
                await dbTreeSection.tree.configureMySQLRestService(globalConn);
            }

            await dbTreeSection.tree.expandElement([constants.mysqlRestService]);
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
            await dbTreeSection.tree.openContextMenuAndSelect(constants.mysqlRestService,
                constants.disableRESTService);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await dbTreeSection.tree.isMRSDisabled(constants.mysqlRestService)) === true;
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
            await dbTreeSection.tree.openContextMenuAndSelect(constants.mysqlRestService,
                constants.enableRESTService);
            await driver.wait(async () => {
                await dbTreeSection.clickToolbarButton(constants.refreshConnectionList);
                await driver.wait(dbTreeSection.untilIsNotLoading(), constants.wait20seconds,
                    `${constants.dbTreeSection} is still loading`);

                return (await dbTreeSection.tree.isMRSDisabled(constants.mysqlRestService)) === false;
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
            await dbTreeSection.tree.openContextMenuAndSelect(constants.mysqlRestService, constants.browseRESTDocs);
            await driver.wait(async () => {
                browserTabs = await driver.getAllWindowHandles();
                if (browserTabs.length > 1) {
                    await driver.switchTo().window(browserTabs[1]);

                    return true;
                }
            }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

            expect(await driver.getCurrentUrl()).toBe("https://dev.mysql.com/doc/dev/mysql-rest-service/latest/");
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

            for (let i = 0; i <= services.length - 1; i++) {
                await dbTreeSection.tree.openContextMenuAndSelect(constants.mysqlRestService,
                    constants.addRESTService);
                services[i] = await RestServiceDialog.set(services[i]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been created.");
                await notification!.close();

                await driver.wait(dbTreeSection.tree.untilExists(services[i].treeName!),
                    constants.wait10seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Service", async () => {
        try {
            await dbTreeSection.tree
                .openContextMenuAndSelect(serviceToEdit.treeName!, constants.editRESTService);

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
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            await driver.wait(dbTreeSection.tree.untilExists(serviceToEdit.treeName!), constants.wait10seconds);
            await dbTreeSection.tree.openContextMenuAndSelect(serviceToEdit.treeName!, constants.editRESTService);
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
                await dbTreeSection.tree.openContextMenuAndSelect(globalService.restSchemas![i].settings!.schemaName!,
                    constants.addSchemaToREST);
                globalService.restSchemas![i] = await RestSchemaDialog.set(globalService.restSchemas![i]);
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS schema has been added successfully.");
                await notification!.close();
                await dbTreeSection.tree
                    .expandElement([globalService.treeName!]);
                await driver.wait(dbTreeSection.tree.untilExists(globalService.restSchemas![i].treeName!),
                    constants.wait10seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Schema", async () => {
        try {
            await dbTreeSection.tree.expandElement([globalService.treeName!]);
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.restSchemas![1].treeName!,
                constants.editRESTSchema); // world_x_cst schema

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

            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            await dbTreeSection.tree.openContextMenuAndSelect(globalService
                .restSchemas![globalService.restSchemas!.length - 1].treeName!, constants.editRESTSchema);
            const thisSchema = await RestSchemaDialog.get();
            expect(thisSchema).toStrictEqual(editedSchema);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Set as Current REST Service", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.treeName!, constants.setAsCurrentREST);
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS service has been set as the new default service.");
            await notification!.close();
            await driver.wait(dbTreeSection.tree.untilIsDefault(globalService.treeName!, "rest"),
                constants.wait5seconds, "REST Service tree item did not became default");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add Tables to REST Service", async () => {
        try {
            const treeSakila = sakilaRestSchema.settings!.schemaName;
            await dbTreeSection.tree.expandElement([treeSakila!]);
            await dbTreeSection.tree.expandElement(["Tables"]);

            const tables = ["actor", "city"];

            for (const table of tables) {
                await Misc.dismissNotifications();
                await dbTreeSection.tree.openContextMenuAndSelect(table, constants.addDBObjToREST);
                await RestObjectDialog.set({
                    restServicePath: globalService.treeName,
                });

                const notifications = await Misc.getToastNotifications(true);
                const messages = notifications.map((item: E2EToastNotification | undefined) => {
                    return item!.message;
                });

                expect(messages).toContain(`The MRS Database Object ${table} was updated successfully.`);
                await Promise.all([
                    notifications.map((item: E2EToastNotification | undefined) => {
                        return item!.close();
                    }),
                ]);

                await dbTreeSection.tree.expandElement([globalService.restSchemas![0].treeName!]);
                await driver.wait(dbTreeSection.tree.untilExists(`/${table} (${table})`), constants.wait5seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit REST Object", async () => {
        try {
            const editedObject: interfaces.IRestObject = {
                treeName: `/editedObject (${globalService.restSchemas![0].restObjects![1].jsonRelDuality?.dbObject})`,
                restServicePath: globalService.treeName,
                restSchemaPath: globalService.restSchemas![0].restSchemaPath,
                restObjectPath: `/editedObject`,
                accessControl: constants.accessControlDisabled,
                requiresAuth: true,
                jsonRelDuality: {
                    dbObject: globalService.restSchemas![0].restObjects![0].jsonRelDuality?.dbObject,
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

            await dbTreeSection.tree.openContextMenuAndSelect(globalService.restSchemas![0].restObjects![0].treeName!,
                constants.editRESTObj);
            globalService.restSchemas![0].restObjects![0] = await RestObjectDialog.set(editedObject);

            let ntf = `The MRS Database Object ${editedObject.jsonRelDuality!.dbObject}`;
            ntf += ` was updated successfully.`;

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
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.restSchemas![0].restObjects![0].treeName!,
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
            const cityTree = globalService.restSchemas![0].restObjects![1].treeName!;
            await dbTreeSection.tree.openContextMenuAndSelect(cityTree, constants.openRESTObjReqPathInBrowser);
            await driver.wait(async () => {
                browserTabs = await driver.getAllWindowHandles();
                if (browserTabs.length > 1) {
                    await driver.switchTo().window(browserTabs[1]);

                    return true;
                }
            }, constants.wait5seconds, "A new tab was not opened to the MRS Documentation");

            const service = globalService.servicePath;
            const sakila = globalService.restSchemas![0].settings?.schemaName;
            const city = globalService.restSchemas![0].restObjects![1].jsonRelDuality?.dbObject;

            const regex = new RegExp(`localhost:(\\d+)${service}/${sakila}/${city}`);
            expect(await driver.getCurrentUrl()).toMatch(regex);
            await driver.switchTo().window(browserTabs[0]);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete REST Object", async () => {
        try {
            const objectToRemove = globalService.restSchemas![0].restObjects![0].treeName;
            await dbTreeSection.tree.openContextMenuAndSelect(objectToRemove!, constants.deleteRESTObj);
            const dialog = await new ConfirmDialog().untilExists();
            await dialog.accept();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS DB object has been deleted successfully.");
            await notification!.close();
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(objectToRemove!), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete REST Schema", async () => {
        try {
            await dbTreeSection.tree.expandElement([globalService.treeName!]);
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.restSchemas![0].treeName!,
                constants.deleteRESTSchema);
            const dialog = await new ConfirmDialog().untilExists();
            await dialog.accept();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS schema has been deleted successfully.");
            await notification!.close();
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(globalService.restSchemas![0].treeName!),
                constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add New REST Authentication App", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.treeName!, constants.addNewAuthApp);
            globalService.authenticationApps = [await AuthenticationAppDialog.set(restAuthenticationApp)];
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe("The MRS Authentication App has been added.");
            await notification!.close();

            await dbTreeSection.tree.expandElement([globalService.treeName!]);
            await driver.wait(dbTreeSection.tree
                .untilExists(globalService.authenticationApps[0].treeName!),
                constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add User", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
                constants.addRESTUser);
            globalService.authenticationApps![0].user = [await RestUserDialog.set(restAuthenticationApp.user![0])];
            const notification = await new E2EToastNotification().create();
            expect(notification!.message)
                .toBe(`The MRS User "${restAuthenticationApp.user![0].username}" has been added.`);
            await notification!.close();

            await dbTreeSection.tree.expandElement([globalService.authenticationApps![0].treeName!]);
            await driver.wait(dbTreeSection.tree.untilExists(restAuthenticationApp.user![0].username),
                constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit User", async () => {
        try {
            await dbTreeSection.tree.expandElement([globalService.authenticationApps![0].treeName!]);
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].user![0].username,
                constants.editRESTUser);

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
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(`The MRS User "${editedUser.username}" has been updated.`);
            await notification!.close();
            await dbTreeSection.tree.expandElement([globalService.authenticationApps![0].treeName!]);
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].user![0].username,
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

    it("Edit Authentication App", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
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
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();

            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
                constants.editAuthenticationApp);
            const authApp = await AuthenticationAppDialog.get();
            expect(authApp).toStrictEqual(editedApp);
            globalService.authenticationApps![0].user = [restAuthenticationApp.user![0]];
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete User", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].user![0].username,
                constants.deleteRESTUser);
            await (await new ConfirmDialog().untilExists()).accept();
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(`The MRS user ${globalService.authenticationApps![0].user![0]
                .username} has been deleted successfully.`);
            await notification!.close();
            await driver.wait(dbTreeSection.tree.untilDoesNotExist(globalService.authenticationApps![0].user![0]
                .username), constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete Authentication App", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(globalService.authenticationApps![0].treeName!,
                constants.deleteAuthenticationApp);
            await (await new ConfirmDialog().untilExists()).accept();
            await (await dbTreeSection.tree.getActionButton(globalConn.caption!, constants.refreshConnection))!.click();
            let ntf = `The MRS Authentication App "${globalService.authenticationApps![0].name}"`;
            ntf += ` has been deleted.`;

            const notification = await new E2EToastNotification().create();
            expect(notification!.message).toBe(ntf);
            await notification!.close();

            await driver.wait(dbTreeSection.tree.untilDoesNotExist(globalService.authenticationApps![0].treeName!),
                constants.wait5seconds);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Delete REST Services", async () => {
        try {
            const services = [globalService, serviceToEdit];
            for (const service of services) {
                await dbTreeSection.tree.openContextMenuAndSelect(service.treeName!,
                    constants.deleteRESTService);
                await (await new ConfirmDialog().untilExists()).accept();
                const notification = await new E2EToastNotification().create();
                expect(notification!.message).toBe("The MRS service has been deleted successfully.");
                await notification!.close();
                await driver.wait(dbTreeSection.tree.untilDoesNotExist(service.treeName!), constants.wait5seconds);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

describe("MYSQL REST SERVICE - CLIPBOARD", () => {

    beforeAll(async () => {

        await loadDriver(false);
        await driver.get(url);

        try {
            await driver.wait(Misc.untilHomePageIsLoaded(), constants.wait10seconds);
            await dbTreeSection.focus();

            if (!(await dbTreeSection.tree.elementExists(globalConn.caption!))) {
                await dbTreeSection.createDatabaseConnection(globalConn);
                await driver.wait(dbTreeSection.tree.untilExists(globalConn.caption!), constants.wait3seconds);
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
                await dbTreeSection.tree.openContextMenuAndSelect(globalConn.caption!, constants.showSystemSchemas);

                if (!(await dbTreeSection.tree.elementExists("mysql_rest_service_metadata"))) {
                    await dbTreeSection.tree.configureMySQLRestService(globalConn);
                }
            } else {
                await dbTreeSection.tree.expandDatabaseConnection(globalConn);
            }

            await dbTreeSection.tree.expandElement([constants.mysqlRestService]);
            await dbTreeSection.tree.openContextMenuAndSelect(constants.mysqlRestService,
                constants.addRESTService);
            otherService = await RestServiceDialog.set(otherService);
            let notification = await new E2EToastNotification().create();
            await notification!.close();

            await driver.wait(dbTreeSection.tree.untilExists(otherService.treeName!),
                constants.wait10seconds);
            await Misc.dismissNotifications();
            await dbTreeSection.tree.openContextMenuAndSelect(otherService.restSchemas![0].settings!.schemaName!,
                constants.addSchemaToREST);
            otherService.restSchemas![0] = await RestSchemaDialog.set(otherService.restSchemas![0]);
            notification = await new E2EToastNotification().create();
            await notification!.close();
            await dbTreeSection.tree
                .expandElement([otherService.treeName!]);
            await driver.wait(dbTreeSection.tree.untilExists(otherService.restSchemas![0].treeName!),
                constants.wait10seconds);

            await dbTreeSection.tree.expandElement([otherService.restSchemas![0].treeName!]);
            await dbTreeSection.tree.expandElement([otherService.restSchemas![0].settings!.schemaName!]);
            await dbTreeSection.tree.expandElement(["Tables"]);

            await dbTreeSection.tree.openContextMenuAndSelect("actor", constants.addDBObjToREST);
            await RestObjectDialog.set({ restServicePath: otherService.treeName });
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
            await dbTreeSection.tree.openContextMenuAndSelect(otherService.treeName!,
                constants.copyCreateRestServiceSt);

            let notification = await new E2EToastNotification().create();
            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.tree.openContextMenuAndSelect(otherService.treeName!,
                    constants.copyCreateRestServiceSt);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            await notification!.close();
            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE REST SERVICE|${constants.jsError})`));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy CREATE REST SCHEMA Statement", async () => {
        try {
            await dbTreeSection.tree.openContextMenuAndSelect(otherService.restSchemas![0].treeName!,
                constants.copyCreateRestSchemaSt);

            let notification = await new E2EToastNotification().create();
            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.tree.openContextMenuAndSelect(otherService.treeName!,
                    constants.copyCreateRestSchemaSt);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            await notification!.close();

            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE OR REPLACE REST SCHEMA|${constants.jsError})`));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy CREATE REST OBJECT Statement", async () => {
        try {
            await dbTreeSection.tree
                .openContextMenuAndSelect(otherService.restSchemas![0].restObjects![0].treeName!,
                    constants.copyCreateRestObjSt);
            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.tree.openContextMenuAndSelect(otherService.treeName!,
                    constants.copyCreateRestObjSt);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The CREATE statement was copied to the system clipboard");
            await notification!.close();
            expect(await Os.readClipboard())
                .toMatch(new RegExp(`(CREATE OR REPLACE REST VIEW|${constants.jsError})`));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy REST Object Request Path to Clipboard", async () => {
        try {
            const service = otherService.servicePath;
            const sakila = otherService.restSchemas![0].settings?.schemaName;
            const actor = otherService.restSchemas![0].restObjects![0].jsonRelDuality?.dbObject;
            const regex = new RegExp(`(localhost:(\\d+)${service}/${sakila}/${actor}|${constants.jsError})`);

            await dbTreeSection.tree
                .openContextMenuAndSelect(otherService.restSchemas![0].restObjects![0].treeName!,
                    constants.copyRESTObjReqPath);
            let notification = await new E2EToastNotification().create();

            if (notification?.message.includes("SDK")) {
                await notification.close();
                await dbTreeSection.tree
                    .openContextMenuAndSelect(otherService.restSchemas![0].restObjects![0].treeName!,
                        constants.copyRESTObjReqPath);
                notification = await new E2EToastNotification().create();
            }

            expect(notification!.message).toBe("The DB Object Path was copied to the system clipboard");
            await notification!.close();

            const clipboard = await Os.readClipboard();
            expect(clipboard).toMatch(regex);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});

