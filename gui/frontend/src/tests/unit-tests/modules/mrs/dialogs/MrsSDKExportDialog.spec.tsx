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
    IMrsServiceData, type IMrsAuthAppData, type IMrsAuthVendorData, type IMrsContentFileData,
    type IMrsContentSetData, type IMrsDbObjectData, type IMrsRoleData, type IMrsRouterData, type IMrsRouterService,
    type IMrsSchemaData, type IMrsStatusData, type IMrsTableColumnWithReference, type IMrsUserData
} from "../../../../../communication/ProtocolMrs.js";
import { MrsHub } from "../../../../../modules/mrs/MrsHub.js";
import type { IConnectionDetails } from "../../../../../supplement/ShellInterface/index.js";
import { ShellInterfaceDbConnection } from "../../../../../supplement/ShellInterface/ShellInterfaceDbConnection.js";
import { ShellInterfaceMrs } from "../../../../../supplement/ShellInterface/ShellInterfaceMrs.js";
import { ShellInterfaceSqlEditor } from "../../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import {
    authAppsData, cdmMockState, connectionDetailsMock1, connectionFolderMock1, extraConnectionDetails,
    mrsContentFileData, mrsContentSetData, mrsDbObjectData, mrsRouterData, mrsSchemaData, mrsServiceData,
    mrsServicesData, mrsStatusMock, mrsUserData, routerServiceData
} from "../../../data-models/data-model-test-data.js";
import { DialogHelper, mockClassMethods } from "../../../test-helpers.js";

mockClassMethods(ShellInterfaceDbConnection, {
    listDbConnections: () => {
        if (!cdmMockState.mockConnectedLoaded) { // Simulate varying connection loading conditions.
            cdmMockState.mockConnectedLoaded = true;

            return Promise.resolve(connectionDetailsMock1.slice(0, 1));
        }

        return Promise.resolve([...connectionDetailsMock1]);
    },
    getDbConnection: vi.fn().mockImplementation((connectionId: number): Promise<IConnectionDetails | undefined> => {
        return Promise.resolve(extraConnectionDetails);
    }),
    removeDbConnection: () => {
        return Promise.resolve();
    },
    listFolderPaths: () => {
        return Promise.resolve([
            {
                id: 1,
                index: -1,
                caption: "Test folder",
                parentFolderId: undefined,
            },
        ]);
    },
    listAll: (profileId: number, folderId = 0) => {
        if (profileId === -1 || folderId > 1) {
            return Promise.resolve([]);
        }

        if (!cdmMockState.mockConnectedLoaded) { // Simulate varying connection loading conditions.
            cdmMockState.mockConnectedLoaded = true;

            return Promise.resolve(connectionDetailsMock1.slice(0, 1));
        }

        return Promise.resolve([
            connectionFolderMock1,
            ...connectionDetailsMock1,
        ]);
    },
});

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
    },
    dumpSdkServiceFiles: vi.fn().mockResolvedValue(true),
});

describe("MRS SDK Export dialog tests", () => {
    const hubRef = createRef<MrsHub>();
    let dialogHelper: DialogHelper;
    const backend = new ShellInterfaceSqlEditor();

    let unmount: () => boolean;

    beforeAll(() => {
        registerUiLayer(uiLayerMock);

        const result = render(<MrsHub ref={hubRef} />);
        unmount = result.unmount;

        dialogHelper = new DialogHelper("mrsSdkExportDialog", "Export MRS SDK for /myService");
    });

    afterAll(() => {
        unmount();

        vi.resetAllMocks();
    });

    it("Show MRS SDK Export Dialog (snapshot) and escape", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", (portal) => {
            expect(portal).toMatchSnapshot();
            const cancelButton = portal.querySelector("#cancel");
            fireEvent.click(cancelButton!);
        });

        await hubRef.current!.showMrsSdkExportDialog(backend, "1", 1);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });

    it("Dialog error testing", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        dialogHelper.actOnDialogAppearance("valueEditDialog", (portal) => {
            const okButton = portal.querySelector("#ok");
            fireEvent.click(okButton!);
            dialogHelper.verifyErrors();
        });

        await hubRef.current!.showMrsSdkExportDialog(backend, "1", 1);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);
    });
});
