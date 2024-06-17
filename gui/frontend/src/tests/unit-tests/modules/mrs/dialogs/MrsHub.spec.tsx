/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
 * separately licensed software that they have either included with
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

import { screen, waitFor } from "@testing-library/preact";
import { createRef } from "preact";
import { mount } from "enzyme";

import { DataCallback } from "../../../../../communication/MessageScheduler.js";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../../communication/MySQL.js";
import { IShellDictionary } from "../../../../../communication/Protocol.js";
import {
    IMrsAddAuthAppData, IMrsAddContentSetData, IMrsAuthAppData, IMrsServiceData, IMrsUserRoleData,
    IShellMrsUpdateDbObjectKwargsValue, ShellAPIMrs,
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { MrsDbObjectType } from "../../../../../modules/mrs/types.js";
import { IMrsDbObjectEditRequest } from "../../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, IConnectionDetails } from "../../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys, sleep } from "../../../../../utilities/helpers.js";
import {
    DialogHelper, JestReactWrapper, getDbCredentials, sendKeyPress, setupShellForTests,
} from "../../../test-helpers.js";
import {
    testReqShowMrsAuthAppDialog, testReqShowMrsContentSetDialog,
    testReqShowMrsDbObjectDialog, testReqShowMrsSchemaDialog,
    testReqShowMrsSdkExportDialog, testReqShowMrsServiceDialog,
    testReqShowMrsUserDialog,
} from "../../db-editor/DbEditorModuleRequisitionsMRSDialogs.js";

describe("MrsHub Tests", () => {
    let host: JestReactWrapper;

    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;

    let service: IMrsServiceData;
    let authApp: IMrsAuthAppData;
    let dialogHelper: DialogHelper;
    let serviceID: string;
    let connID: number;

    const hubRef = createRef<MrsHub>();

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG2");

        const credentials = getDbCredentials();

        const options: IMySQLConnectionOptions = {
            scheme: MySQLConnectionScheme.MySQL,
            user: credentials.userName,
            password: credentials.password,
            host: credentials.host,
            port: credentials.port,
        };

        const testConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options,
        };

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "unit-tests") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);
        connID = testConnection.id;

        backend = new ShellInterfaceSqlEditor();
        await backend.startSession("mrsHubTests");
        await backend.openConnection(testConnection.id);

        // Some preparation for the tests.
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.execute("CREATE DATABASE MRS_TEST");
        await backend.execute("CREATE TABLE MRS_TEST.actor (actor_id INT NOT NULL, first_name VARCHAR(45) NOT NULL, " +
            "last_name VARCHAR(45) NOT NULL, last_update TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY " +
            "(actor_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

        await backend.mrs.configure();
        service = await backend.mrs.addService("/myService", ["HTTPS"], "", "", true, {}, "/unit-tests", "", "", "",
            []);

        const authAppId = await backend.mrs.addAuthApp(service.id, {
            authVendorId: "0x30000000000000000000000000000000",
            name: "MRS",
            serviceId: service.id,
            enabled: true,
            limitToRegisteredUsers: false,
            defaultRoleId: "0x31000000000000000000000000000000",
        }, []);
        authApp = await backend.mrs.getAuthApp(authAppId.authAppId);
        serviceID = service.id;
        const schemaId = await backend.mrs.addSchema(service.id, "MRS_TEST", "/mrs-test", false, null, null);
        const dbObjectResult = await backend.mrs.addDbObject("actor", MrsDbObjectType.Table, false, "/actor", true,
            ["READ"], "FEED", false, false, false, null, null, undefined, schemaId);
        await backend.mrs.getDbObject(dbObjectResult);
        host = mount<MrsHub>(<MrsHub ref={hubRef} />);
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.closeSession();
        await launcher.exitProcess();
        host.unmount();
    });

    it("Standard Rendering (snapshot)", () => {
        // The host itself has no properties, but implicit children (the different dialogs).
        expect(host.props().children).toEqual([]);
        expect(host).toMatchSnapshot();
    });

    describe("MRS Service dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsServiceDialog");
        });

        it("Show MRS Service Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Service")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS Service Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Service")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            backend.mrs.addService = async (urlContextRoot: string, urlProtocol: string[], urlHostName: string,
                comments: string, enabled: boolean, options: IShellDictionary | null,
                authPath: string, authCompletedUrl: string,
                authCompletedUrlValidation: string, authCompletedPageContent: string,
                authApps: IMrsAuthAppData[]): Promise<IMrsServiceData> => {
                return Promise.resolve({
                    enabled: Number(enabled),
                    hostCtx: "",
                    id: "",
                    isCurrent: 1,
                    urlContextRoot,
                    urlHostName,
                    urlProtocol: urlProtocol.join(","),
                    comments,
                    options: options ?? {},
                    authPath,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    authApps,
                    enableSqlEndpoint: 0,
                    customMetadataSchema: "",
                });
            };

            backend.mrs.updateService = async (serviceId: string, urlContextRoot: string, urlHostName: string,
                value: IShellDictionary): Promise<void> => {
                expect(serviceId).toBeDefined();
                expect(urlContextRoot).toBeDefined();
                expect(urlHostName).toBeDefined();
                expect(value).toBeDefined();

                return Promise.resolve();
            };

            await sleep(500);
            const promise = hubRef.current!.showMrsServiceDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Service")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);
            dialogHelper.verifyErrors();

            expect(dialogHelper.getInputText("servicePath")).toBe("/myService");

            await dialogHelper.setInputText("servicePath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The service name must not be empty."]);

            await dialogHelper.setInputText("servicePath", "/mrs");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path `/mrs` is reserved and cannot be used."]);

            await dialogHelper.setInputText("servicePath", "/MRS");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path `/MRS` is reserved and cannot be used."]);

            await dialogHelper.setInputText("servicePath", "/myService2");

            await dialogHelper.setInputText("comments", "some comments");
            await dialogHelper.setInputText("hostName", "localhost");

            await dialogHelper.clickOk();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("MRS Schema dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsSchemaDialog");
        });

        it("Show MRS Schema Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Schema")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS Schema Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Schema")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            backend.mrs.addSchema = (serviceId: string, schemaName: string, requestPath: string, requiresAuth: boolean,
                options: IShellDictionary | null,
                itemsPerPage: number | null, comments?: string): Promise<string> => {
                expect(serviceId).not.toBeNull();
                expect(schemaName).toBe("mySchema");
                expect(requestPath).toBe("/schema");
                expect(requiresAuth).toBeFalsy();
                expect(itemsPerPage).toBeNull();
                expect(options).toBeNull();
                expect(comments).toBe("");

                return Promise.resolve("done");
            };

            const promise = hubRef.current!.showMrsSchemaDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Schema")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.setInputText("dbSchemaName", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The database schema name must not be empty."]);

            await dialogHelper.setInputText("dbSchemaName", "mySchema");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("MRS AuthApp dialog tests", () => {

        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsAuthenticationAppDialog");
        });

        it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Authentication App")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS Authentication App Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Authentication App")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsAuthAppDialog(backend);

            backend.mrs.addAuthApp = (serviceId: string, authApp: IMrsAuthAppData, registerUsers: [])
                : Promise<IMrsAddAuthAppData> => {
                expect(serviceId.length).toBeGreaterThan(0);
                expect(authApp.name).toBe("MyAuthApp");
                expect(authApp.appId?.length).toBeGreaterThan(0);

                expect(registerUsers).toBeDefined();

                return Promise.resolve({ authAppId: "can't calculate the id at this stage of the tests" });
            };

            await waitFor(() => {
                expect(screen.getByText("MySQL REST Authentication App")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The vendor name must not be empty.", "The name must not be empty."]);

            await dialogHelper.setInputText("name", "MyAuthApp");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The vendor name must not be empty."]);

            await dialogHelper.setComboBoxItem("authVendorName", 3);
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("MRS Db Object dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsDbObjectDialog");
        });

        it("Show MRS DB Object Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Object")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            // This check fails in CI, but not locally. A slider is not hidden in CI as it should be.
            // We have to rely on e2e tests for this.
            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS DB Object Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Object")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            backend.mrs.updateDbObject = (dbObjectId: string, dbObjectName: string, requestPath: string,
                schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> => {
                // verify data here...
                expect(dbObjectName).toBe("actor");
                expect(requestPath).toBe("/actor");

                expect(value).toMatchObject({
                    name: "actor",
                    dbSchemaId: schemaId,
                    requestPath: "/SomePath",
                    requiresAuth: false,
                    autoDetectMediaType: false,
                    enabled: true,
                    rowUserOwnershipEnforced: false,
                    rowUserOwnershipColumn: null,
                    itemsPerPage: null,
                    comments: "",
                    mediaType: null,
                    authStoredProcedure: null,
                    crudOperations: [
                        "READ",
                    ],
                    crudOperationFormat: "FEED",
                    options: null,
                    objects: [
                        {
                            // id: the returned id
                            dbObjectId,
                            name: "MyServiceMrsTestActor",
                            position: 0,
                            kind: "RESULT",
                            sdkOptions: undefined,
                            comments: undefined,
                            fields: [
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "actorId",
                                    position: 1,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "int",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: true,
                                        isUnique: false,
                                        name: "actor_id",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: true,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: undefined,
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "firstName",
                                    position: 2,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "first_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: undefined,
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastName",
                                    position: 3,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "varchar(45)",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_name",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: undefined,
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                                {
                                    // id: the returned id
                                    // objectId: the returned objectId
                                    representsReferenceId: undefined,
                                    parentReferenceId: undefined,
                                    name: "lastUpdate",
                                    position: 4,
                                    dbColumn: {
                                        comment: "",
                                        datatype: "timestamp",
                                        idGeneration: null,
                                        isGenerated: false,
                                        isPrimary: false,
                                        isUnique: false,
                                        name: "last_update",
                                        notNull: true,
                                        srid: null,
                                    },
                                    storedDbColumn: undefined,
                                    enabled: true,
                                    allowFiltering: true,
                                    allowSorting: false,
                                    noCheck: false,
                                    noUpdate: false,
                                    sdkOptions: undefined,
                                    comments: undefined,
                                    objectReference: undefined,
                                },
                            ],
                            storedFields: undefined,
                        },
                    ],
                });

                return Promise.resolve();
            };

            const title = "Enter Configuration Values for the New MySQL REST Object";
            const schemas = await backend.mrs.listSchemas();
            const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
            const dialogRequest: IMrsDbObjectEditRequest = {
                id: "mrsDbObjectDialog",
                title,
                dbObject: dbObjects[0],
                createObject: false,
            };

            const promise = hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST Object")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.setInputText("requestPath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must start with '/'."]);

            await dialogHelper.setInputText("requestPath", "/SomePath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("MRS User dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsUserDialog");
        });

        it("Show MRS User Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST User")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS User Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST User")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            backend.mrs.addUser = (authAppId: string, name: string, email: string, vendorUserId: string,
                loginPermitted: boolean, mappedUserId: string, appOptions: IShellDictionary | null,
                authString: string, userRoles: IMrsUserRoleData[]): Promise<void> => {
                expect(name).toBe("MyUser");
                expect(authString).toBe("AAAAAA");
                expect(authAppId.length).toBeGreaterThan(0);

                expect(email).toBeDefined();
                expect(vendorUserId).toBeDefined();
                expect(loginPermitted).toBeDefined();
                expect(mappedUserId).toBeDefined();
                expect(appOptions).toBeDefined();
                expect(userRoles).toBeDefined();

                return Promise.resolve();
            };

            const promise = hubRef.current!.showMrsUserDialog(backend, authApp);
            await waitFor(() => {
                expect(screen.getByText("MySQL REST User")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.setInputText("name", "");
            await dialogHelper.setInputText("authString", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors([
                "The authentication string is required for this app.",
                "The user name or email are required for this app.",
            ]);

            await dialogHelper.setInputText("name", "My User");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The authentication string is required for this app."]);

            await dialogHelper.setInputText("authString", "SomePassword");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

    });

    describe("MRS Content Set dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsContentSetDialog");
        });

        it("Show MRS Content Set Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MRS Content Set")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS Content Set Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MRS Content Set")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);

            backend.mrs.addContentSet = (contentDir: string, requestPath: string,
                requiresAuth: boolean, options: IShellDictionary | null,
                serviceId?: string, comments?: string,
                enabled?: boolean, replaceExisting?: boolean,
                callback?: DataCallback<ShellAPIMrs.MrsAddContentSet>): Promise<IMrsAddContentSetData> => {
                expect(requestPath).toBe("/someRequestPath");

                expect(contentDir).toBeDefined();
                expect(requiresAuth).toBeDefined();
                expect(options).toBeDefined();
                expect(serviceId).toBeDefined();
                expect(comments).toBeDefined();
                expect(enabled).toBeDefined();
                expect(replaceExisting).toBeDefined();
                expect(callback).toBeDefined();

                return Promise.resolve({});
            };

            const promise = hubRef.current!.showMrsContentSetDialog(backend);
            await waitFor(() => {
                expect(screen.getByText("MRS Content Set")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.setInputText("requestPath", "");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "someRequestPath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors(["The request path must start with /."]);

            await dialogHelper.setInputText("requestPath", "/someRequestPath");
            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("MRS SDK Export dialog tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsSdkExportDialog");
        });

        it("Show MRS SDK Export Dialog (snapshot) and escape", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await waitFor(() => {
                expect(screen.getByText("Export MRS SDK for /myService")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            setTimeout(() => {
                sendKeyPress(KeyboardKeys.Escape);
            }, 250);

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Show MRS SDK Export Dialog and cancel", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await waitFor(() => {
                expect(screen.getByText("Export MRS SDK for /myService")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            expect(portals[0]).toMatchSnapshot();

            await dialogHelper.clickCancel();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });

        it("Dialog error testing", async () => {
            let portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
            const promise = hubRef.current!.showMrsSdkExportDialog(backend, service.id, 1);
            await waitFor(() => {
                expect(screen.getByText("Export MRS SDK for /myService")).toBeDefined();
            });

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(1);

            await dialogHelper.clickOk();
            dialogHelper.verifyErrors();

            await promise;

            portals = document.getElementsByClassName("portal");
            expect(portals.length).toBe(0);
        });
    });

    describe("DBEditorModule requisitions MRS Dialogs Tests", () => {
        beforeAll(() => {
            dialogHelper = new DialogHelper("mrsRequisitionsDialogTests");
        });

        it("Test DBEditorModule function requisitions.showMrsDbObjectDialog", async () => {
            await testReqShowMrsDbObjectDialog(dialogHelper, serviceID, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsServiceDialog", async () => {
            await testReqShowMrsServiceDialog(dialogHelper, serviceID, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsSchemaDialog", async () => {
            await testReqShowMrsSchemaDialog(dialogHelper, serviceID, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsContentSetDialog", async () => {
            await testReqShowMrsContentSetDialog(dialogHelper, serviceID, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsAuthAppDialog", async () => {
            await testReqShowMrsAuthAppDialog(dialogHelper, authApp, serviceID, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsUserDialog", async () => {
            await testReqShowMrsUserDialog(dialogHelper, authApp, connID);
        });

        it("Test DBEditorModule function requisitions.showMrsSdkExportDialog", async () => {
            await testReqShowMrsSdkExportDialog(dialogHelper, serviceID, connID);
        });

    });
});
