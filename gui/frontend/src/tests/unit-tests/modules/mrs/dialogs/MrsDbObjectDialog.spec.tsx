/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

/* eslint-disable dot-notation */

import { createRef } from "preact";

import { mount } from "enzyme";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import { IShellMrsUpdateDbObjectKwargsValue } from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { MrsSdkLanguage } from "../../../../../modules/mrs/types.js";
import { IMrsDbObjectEditRequest } from "../../../../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { MySQLShellLauncher } from "../../../../../utilities/MySQLShellLauncher.js";
import { KeyboardKeys } from "../../../../../utilities/helpers.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    DialogHelper, JestReactWrapper, createBackend, nextRunLoop, recreateMrsData, sendKeyPress, setupShellForTests,
} from "../../../test-helpers.js";

describe("MRS Db Object dialog tests", () => {
    let host: JestReactWrapper;
    // let service: IMrsServiceData;
    let launcher: MySQLShellLauncher;
    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    let backend: ShellInterfaceSqlEditor;

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        launcher = await setupShellForTests(false, true, "DEBUG2");

        await recreateMrsData();

        host = mount<MrsHub>(<MrsHub ref={hubRef} />);

        dialogHelper = new DialogHelper("mrsDbObjectDialog", "MySQL REST Object");
    });

    afterAll(async () => {
        await backend.execute("DROP DATABASE IF EXISTS mysql_rest_service_metadata");
        await backend.execute("DROP DATABASE IF EXISTS MRS_TEST");
        await backend.closeSession();
        await launcher.exitProcess();
        host.unmount();
    });

    beforeEach(async () => {
        backend = await createBackend();
    });

    it("Show MRS DB Object Dialog (snapshot) and escape", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

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
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        // This check fails in CI, but not locally. A slider is not hidden in CI as it should be.
        // We have to rely on e2e tests for this.
        expect(portals[0]).toMatchSnapshot();

        setTimeout(() => {
            sendKeyPress(KeyboardKeys.Escape);
        }, 250);

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Show MRS DB Object Dialog and cancel", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

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
        await dialogHelper.waitForDialog();


        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const [dataMappingTab, settingsTab, authorizationsTab, optionsTab]
            = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

        {//  Data Mapping tab
            dataMappingTab.click();
            await nextRunLoop();

            const treeGrid = dialogHelper.searchChild<HTMLDivElement>({ class: "mrsObjectTreeGrid" });

            expect(treeGrid.children).toHaveLength(2);

            const treeGridHeader = treeGrid.children[0];

            expect(treeGridHeader.classList).toContain("tabulator-header");
            expect(treeGridHeader.classList).toContain("tabulator-header-hidden");

            // TODO: we should check the hidden column titles here...

            const treeGridTable = treeGrid.children[1] as HTMLElement;
            expect(treeGridTable.classList).toContain("tabulator-tableholder");

            //  TODO: the tree grid items are not showing up
            // expect(treeGridTable.children[0].childElementCount).toBe(6);

            // const treeGridRows = treeGridTable.children[0].children;

            // const tableName = dialogHelper.searchChildren({ class: "tableName", docRoot: treeGridTable });
        }
        {//  Settings tab
            settingsTab.click();
            await nextRunLoop();

            const contents = dialogHelper.searchChild<HTMLDivElement>({
                class: "msg container fixedScrollbar tabContent",
            });
            const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

            expect(gridCells).toHaveLength(5);

            //  cell 1
            expect(gridCells[0].children[0].textContent).toBe("Result Format");
            expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("FEED");

            // cell 2
            expect(gridCells[1].children[0].textContent).toBe("Items per Page");
            expect(gridCells[1].children[1].firstElementChild?.textContent).toBe("");

            // cell 3
            expect(gridCells[2].children[0].textContent).toBe("Comments");
            const commentsInput = gridCells[2].children[1].firstElementChild as HTMLInputElement;
            expect(commentsInput?.value).toBe("<this is a comment>");

            // cell 4
            expect(gridCells[3].children[0].textContent).toBe("Media Type");
            expect(gridCells[3].children[1].firstElementChild?.textContent).toBe("");

            // cell 5
            expect(gridCells[4].children[0].textContent).toBe("Automatically Detect Media Type");
            expect(gridCells[4].children[1].textContent).toBe("Automatically Detect Media Type");
        }

        //  authorization tab
        {
            authorizationsTab.click();
            await nextRunLoop();

            const contents = dialogHelper.searchChild<HTMLDivElement>({
                class: "msg container fixedScrollbar tabContent",
            });
            const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

            expect(gridCells).toHaveLength(1);

            //  cell 1
            expect(gridCells[0].children[0].textContent).toBe("Custom Stored Procedure used for Authorization");
            expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("");
        }

        //  options tab
        {
            optionsTab.click();
            await nextRunLoop();

            const contents = dialogHelper.searchChild<HTMLDivElement>({
                class: "msg container fixedScrollbar tabContent",
            });
            const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

            expect(gridCells).toHaveLength(2);

            //  cell 1
            expect(gridCells[0].children[0].textContent).toBe("Options");
            let element = gridCells[0].children[1].firstElementChild as HTMLInputElement;
            expect(element?.value).toBe("");
            expect(gridCells[0].children[2].textContent).toBe("Additional options in JSON format");

            //  cell 2
            expect(gridCells[1].children[0].textContent).toBe("Metadata");
            element = gridCells[1].children[1].firstElementChild as HTMLInputElement;
            expect(element?.value).toBe("null");
            expect(gridCells[1].children[2].textContent).toBe("Metadata settings in JSON format");
        }

        await dialogHelper.clickCancel();

        await promise;

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Dialog error testing [table]", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

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
                        sdkOptions: {
                            languageOptions: [{
                                language: MrsSdkLanguage.TypeScript,
                            }],
                        },
                        comments: undefined,
                        fields: [
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
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
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [dataMappingTab, _settingsTab, _authorizationsTab, _optionsTab]
            = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

        dataMappingTab.click();
        await nextRunLoop();

        await dialogHelper.clickButton({ class: "msg button imageOnly sqlPreviewBtn" });

        const sqlTextLines = dialogHelper.searchChildren({
            class: "view-line",
        });

        expect(sqlTextLines.length).toBeGreaterThan(0);


        await dialogHelper.clickButton({ class: "msg button imageOnly sqlCopyBtn" });

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
        expect(portals).toHaveLength(0);
    });

    it("Dialog error testing [function]", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        backend.mrs.updateDbObject = (dbObjectId: string, dbObjectName: string, requestPath: string,
            schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> => {
            // verify data here...
            expect(dbObjectName).toBe("actor_count");
            expect(requestPath).toBe("/actor_count");

            expect(value).toMatchObject({
                name: "actor_count",
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
                        dbObjectId,
                        name: "MyServiceMrsTestActor",
                        position: 0,
                        kind: "RESULT",
                        sdkOptions: {
                            languageOptions: [{
                                language: MrsSdkLanguage.TypeScript,
                            }],
                        },
                        comments: undefined,
                        fields: [
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
                                comments: undefined,
                                objectReference: undefined,
                            },
                            {
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
                                sdkOptions: {
                                    languageOptions: [{
                                        language: MrsSdkLanguage.TypeScript,
                                    }],
                                },
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
        await dialogHelper.waitForDialog();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

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
        expect(portals).toHaveLength(0);
    });

});
