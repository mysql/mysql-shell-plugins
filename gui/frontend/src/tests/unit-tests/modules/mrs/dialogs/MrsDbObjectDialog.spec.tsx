/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { fireEvent, render } from "@testing-library/preact";
import { createRef } from "preact";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import {
    IShellMrsUpdateDbObjectKwargsValue, type IMrsAuthAppData, type IMrsAuthVendorData, type IMrsContentFileData,
    type IMrsContentSetData, type IMrsDbObjectData, type IMrsRoleData, type IMrsRouterData, type IMrsRouterService,
    type IMrsSchemaData, type IMrsServiceData, type IMrsStatusData, type IMrsTableColumnWithReference,
    type IMrsUserData
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import { IMrsDbObjectEditRequest } from "../../../../../supplement/RequisitionTypes.js";
import { ShellInterfaceMrs } from "../../../../../supplement/ShellInterface/ShellInterfaceMrs.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    authAppsData, mrsContentFileData, mrsContentSetData, mrsDbObjectData, mrsRouterData, mrsSchemaData, mrsServiceData,
    mrsServicesData, mrsStatusMock, mrsUserData, routerServiceData
} from "../../../data-models/data-model-test-data.js";
import { checkNoUiWarningsOrErrors, DialogHelper, mockClassMethods, nextRunLoop } from "../../../test-helpers.js";

mockClassMethods(ShellInterfaceMrs, {
    status: (): Promise<IMrsStatusData> => {
        return Promise.resolve(mrsStatusMock);
    },
    listServices: (): Promise<IMrsServiceData[]> => {
        return Promise.resolve(mrsServicesData);
    },
    listSchemas: (): Promise<IMrsSchemaData[]> => {
        return Promise.resolve(mrsSchemaData);
    },
    listRouters: (): Promise<IMrsRouterData[]> => {
        return Promise.resolve(mrsRouterData);
    },
    listContentSets: (): Promise<IMrsContentSetData[]> => {
        return Promise.resolve(mrsContentSetData);
    },
    listUsers: (): Promise<IMrsUserData[]> => {
        return Promise.resolve(mrsUserData);
    },
    listContentFiles: (): Promise<IMrsContentFileData[]> => {
        return Promise.resolve(mrsContentFileData);
    },
    getService: (): Promise<IMrsServiceData> => {
        return Promise.resolve(mrsServiceData);
    },
    getSchema: (): Promise<IMrsSchemaData> => {
        return Promise.resolve(mrsSchemaData[0]);
    },
    getRouterServices: (): Promise<IMrsRouterService[]> => {
        return Promise.resolve(routerServiceData);
    },
    listAuthApps: (): Promise<IMrsAuthAppData[]> => {
        return Promise.resolve(authAppsData);
    },
    listAppServices: (_appId?: string): Promise<IMrsServiceData[]> => {
        return Promise.resolve([]);
    },
    listRoles: (): Promise<IMrsRoleData[]> => {
        return Promise.resolve([]);
    },
    listDbObjects: (schemaId: string): Promise<IMrsDbObjectData[]> => {
        return Promise.resolve(mrsDbObjectData);
    },
    updateAuthApp: (): Promise<void> => {
        return Promise.resolve();
    },
    getAuthVendors: (): Promise<IMrsAuthVendorData[]> => {
        return Promise.resolve([{
            id: "MRS",
            name: "MRS",
            enabled: true,
        }]);
    },
    getTableColumnsWithReferences: (requestPath?: string, dbObjectName?: string,
        dbObjectId?: string, schemaId?: string, schemaName?: string,
        dbObjectType?: string): Promise<IMrsTableColumnWithReference[]> => {
        return Promise.resolve([{
            position: 1,
            name: "actorId",
            refColumnNames: "actor_id",
            tableSchema: "myschema",
            tableName: "actor",
        }]);
    }
});

describe("MRS Db Object dialog tests", () => {
    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    const backend = new ShellInterfaceSqlEditor();
    let unmount: () => boolean;

    beforeAll(() => {
        registerUiLayer(uiLayerMock);

        const result = render(<MrsHub ref={hubRef} />);
        unmount = result.unmount;

        dialogHelper = new DialogHelper("mrsDbObjectDialog", "MySQL REST Object");
    });

    afterAll(() => {
        unmount();

        vi.resetAllMocks();
    });

    it("Show MRS DB Object Dialog (snapshot) and escape", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", (portal) => {
            expect(portal).toMatchSnapshot();
            const cancelButton = portal.querySelector("#cancel");
            fireEvent.click(cancelButton!);
        });

        const title = "Enter Configuration Values for the New MySQL REST Object";
        const schemas = await backend.mrs.listSchemas();
        const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
        const dialogRequest: IMrsDbObjectEditRequest = {
            id: "mrsDbObjectDialog",
            title,
            dbObject: dbObjects[0],
            createObject: false,
        };

        await hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        checkNoUiWarningsOrErrors();
    });

    it("Show MRS DB Object Dialog and cancel", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", async (portal) => {
            const [dataMappingTab, settingsTab, authorizationsTab, optionsTab]
                = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

            {   //  Data Mapping tab.
                dataMappingTab.click();
                await nextRunLoop();

                const treeGrids = portal.querySelectorAll(".mrsObjectTreeGrid");
                expect(treeGrids).toHaveLength(1);

                const treeGridHeader = treeGrids[0];

                expect(treeGridHeader.classList).toContain("mrsObjectTreeGrid");
            }
            {  //  Settings tab.
                settingsTab.click();
                await nextRunLoop();

                const gridCells = portal.querySelectorAll(".msg .container .tabContent .gridCell");
                expect(gridCells).toHaveLength(5);

                // cell 1
                expect(gridCells[0].children[0].textContent).toBe("Result Format");
                expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("FEED");

                // cell 2
                expect(gridCells[1].children[0].textContent).toBe("Items per Page");
                expect(gridCells[1].children[1].firstElementChild?.textContent).toBe("");

                // cell 3
                expect(gridCells[2].children[0].textContent).toBe("Comments");
                const commentsInput = gridCells[2].children[1].firstElementChild as HTMLInputElement | null;
                expect(commentsInput?.value).toBe("<this is a comment>");

                // cell 4
                expect(gridCells[3].children[0].textContent).toBe("Media Type");
                expect(gridCells[3].children[1].firstElementChild?.textContent).toBe("");

                // cell 5
                expect(gridCells[4].children[0].textContent).toBe("Automatically Detect Media Type");
            }

            {   // Authorization tab.
                authorizationsTab.click();
                await nextRunLoop();

                const gridCells = portal.querySelectorAll(".msg .container .tabContent .gridCell");
                expect(gridCells).toHaveLength(1);

                // cell 1
                expect(gridCells[0].children[0].textContent).toBe("Custom Stored Procedure used for Authorization");
                expect(gridCells[0].children[1].firstElementChild?.textContent).toBe("");
            }

            {   // Options tab.
                optionsTab.click();
                await nextRunLoop();

                const contents = dialogHelper.searchChild<HTMLDivElement>({
                    class: "msg container fixedScrollbar tabContent",
                });
                const gridCells = dialogHelper.searchChildren({ docRoot: contents, class: "gridCell" });

                expect(gridCells).toHaveLength(2);

                //  cell 1
                expect(gridCells[0].children[0].textContent).toBe("Options");
                let element = gridCells[0].children[1].firstElementChild as HTMLInputElement | null;
                expect(element?.value).toBe("");
                expect(gridCells[0].children[2].textContent).toBe("Additional options in JSON format");

                //  cell 2
                expect(gridCells[1].children[0].textContent).toBe("Metadata");
                element = gridCells[1].children[1].firstElementChild as HTMLInputElement | null;
                expect(element?.value).toBe("");
                expect(gridCells[1].children[2].textContent).toBe("Metadata settings in JSON format");
            }

            const cancelButton = portal.querySelector("#cancel");
            fireEvent.click(cancelButton!);
        });

        const title = "Enter Configuration Values for the New MySQL REST Object";
        const schemas = await backend.mrs.listSchemas();
        const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
        const dialogRequest: IMrsDbObjectEditRequest = {
            id: "mrsDbObjectDialog",
            title,
            dbObject: dbObjects[0],
            createObject: false,
        };

        await hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        checkNoUiWarningsOrErrors();
    });

    it("Dialog error testing [table]", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        backend.mrs.updateDbObject = (dbObjectId: string, dbObjectName: string, requestPath: string,
            schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> => {
            // verify data here...
            expect(dbObjectName).toBe("actor");
            expect(requestPath).toBe("/SomePath");

            expect(value).toMatchObject({
                name: "actor",
                dbSchemaId: schemaId,
                requestPath: "/SomePath",
                requiresAuth: true,
                autoDetectMediaType: true,
                enabled: 1,
                crudOperationFormat: "FEED",
                options: null,
                objects: [],
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

        dialogHelper.actOnDialogAppearance("valueEditDialog", async (portal) => {
            const [dataMappingTab, _settingsTab, _authorizationsTab, _optionsTab]
                = dialogHelper.getTabItems(["Data Mapping", "Settings", "Authorization", "Options"]);

            dataMappingTab.click();

            const previewButton = portal.querySelector(".sqlPreviewBtn");
            fireEvent.click(previewButton!);

            const sqlTextLines = portal.querySelector(".view-line");
            expect(sqlTextLines).toBeDefined();

            const copyButton = portal.querySelector<HTMLDivElement>(".sqlCopyBtn");
            expect(copyButton).toBeDefined();
            fireEvent.click(copyButton!);

            await dialogHelper.setInputText("requestPath", "");
            const okButton = portal.querySelector("#ok");
            fireEvent.click(okButton!);
            await nextRunLoop();
            dialogHelper.verifyErrors(["The request path must not be empty."]);

            await dialogHelper.setInputText("requestPath", "SomePath");
            fireEvent.click(okButton!);
            await nextRunLoop();
            dialogHelper.verifyErrors(["The request path must start with '/'."]);

            await dialogHelper.setInputText("requestPath", "/SomePath");
            fireEvent.click(okButton!);
            await nextRunLoop();
            dialogHelper.verifyErrors();
        });

        await hubRef.current!.showMrsDbObjectDialog(backend, dialogRequest);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        checkNoUiWarningsOrErrors();
    });
});
