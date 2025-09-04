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

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import type { DataCallback } from "../../../communication/MessageScheduler.js";
import type { IOpenConnectionData, ShellAPIGui } from "../../../communication/ProtocolGui.js";
import type {
    IMrsAuthAppData, IMrsContentFileData, IMrsContentSetData, IMrsRouterData, IMrsRouterService, IMrsSchemaData,
    IMrsServiceData, IMrsStatusData, IMrsUserData,
} from "../../../communication/ProtocolMrs.js";
import {
    CdmEntityType, ConnectionDataModel, type ConnectionDataModelEntry, type ICdmConnectionEntry,
    type ICdmConnectionGroupEntry,
} from "../../../data-models/ConnectionDataModel.js";
import { ShellInterfaceMrs } from "../../../supplement/ShellInterface/ShellInterfaceMrs.js";
import { ShellInterfaceCore } from "../../../supplement/ShellInterface/ShellInterfaceCore.js";
import { ShellInterfaceDbConnection } from "../../../supplement/ShellInterface/ShellInterfaceDbConnection.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { ILoginCredentials, webSession } from "../../../supplement/WebSession.js";
import { sleep } from "../../../utilities/helpers.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { checkNoUiWarningsOrErrors, mockClassMethods } from "../test-helpers.js";
import {
    authAppsData, cdmMockState, connectionDetailsMock1, connectionFolderMock1, extraConnectionDetails,
    mrsContentFileData, mrsContentSetData, mrsRouterData, mrsSchemaData, mrsServiceData, mrsServicesData,
    mrsStatusMock, mrsUserData, openConnectionDataMock1, routerServiceData,
} from "./data-model-test-data.js";

const dataModelChanged = vi.fn();

mockClassMethods(ShellInterfaceSqlEditor, {
    startSession: vi.fn(),
    closeSession: vi.fn(),
    openConnection: async (
        dbConnectionId: number,
        requestId?: string,
        credentials?: ILoginCredentials,
        callback?: DataCallback<ShellAPIGui.GuiSqlEditorOpenConnection>,
    ) => {
        await callback?.({
            result: cdmMockState.haveMockConnectionResponse ? openConnectionDataMock1 : {} as IOpenConnectionData,
            requestState: { type: "success", msg: "" },
        }, requestId!);

        return Promise.resolve(undefined);
    },
    getCatalogObjects: vi.fn().mockReturnValue([
        "sakila", "mysql_rest_service_metadata",
    ]),
    getSchemaObjectNames: vi.fn().mockReturnValue([
        "actor", "address", "category", "city", "country", "customer", "film", "film_actor",
        "film_category", "inventory", "language", "payment", "rental", "staff", "store",
    ]),
    getRoutinesMetadata: vi.fn().mockReturnValue([
        { type: "PROCEDURE", language: "SQL", name: "proc1" },
        { type: "PROCEDURE", language: "SQL", name: "proc2" },
        { type: "PROCEDURE", language: "SQL", name: "proc3" },
        { type: "PROCEDURE", language: "SQL", name: "proc4" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc5" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc6" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc7" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc8" },
        { type: "PROCEDURE", language: "SQL", name: "proc9" },
        { type: "PROCEDURE", language: "SQL", name: "proc10" },
        { type: "PROCEDURE", language: "SQL", name: "proc11" },
        { type: "PROCEDURE", language: "SQL", name: "proc12" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc13" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc14" },
        { type: "PROCEDURE", language: "JAVASCRIPT", name: "proc15" },
    ]),
    getLibrariesMetadata: vi.fn().mockReturnValue([
        { type: "LIBRARY", language: "JAVASCRIPT", name: "lib1" },
        { type: "LIBRARY", language: "JAVASCRIPT", name: "lib2" },
        { type: "LIBRARY", language: "JAVASCRIPT", name: "lib3" },
        { type: "LIBRARY", language: "JAVASCRIPT", name: "lib4" },
    ]),
    getTableObjectNames: vi.fn().mockReturnValue([
        "object1", "object1", // In lieu of any database object name.
    ]),
    getTableObject: vi.fn().mockReturnValue({
        name: "object1",
    }),
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
});

mockClassMethods(ShellInterfaceDbConnection, {
    listDbConnections: vi.fn().mockImplementation(() => {
        if (!cdmMockState.mockConnectedLoaded) { // Simulate varying connection loading conditions.
            cdmMockState.mockConnectedLoaded = true;

            return connectionDetailsMock1.slice(0, 1);
        }

        return [...connectionDetailsMock1];
    }),
    removeDbConnection: vi.fn(),
    listFolderPaths: vi.fn().mockImplementation(() => {
        return Promise.resolve([
            {
                id: 1,
                caption: "Test folder",
                parentFolderId: undefined,
            },
        ]);
    }),
    listAll: vi.fn().mockImplementation((profileId: number, folderId: number) => {
        if (profileId === -1 || folderId > 1) {
            return Promise.resolve([]);
        }

        if (!cdmMockState.mockConnectedLoaded) { // Simulate varying connection loading conditions.
            cdmMockState.mockConnectedLoaded = true;

            return connectionDetailsMock1.slice(0, 1);
        }

        return Promise.resolve([
            connectionFolderMock1,
            ...connectionDetailsMock1,
        ]);
    }),
});

mockClassMethods(ShellInterfaceCore, {
    createDatabaseFile: vi.fn(),
    validatePath: vi.fn().mockReturnValue(Promise.resolve(true)),
});

describe("ConnectionDataModel", () => {
    const dataModel = new ConnectionDataModel(false, 500);
    dataModel.subscribe(dataModelChanged);

    beforeAll(async () => {
        // Without a (fake) profile, the data model will not start to load connections.
        webSession.profile = {
            description: "Test profile",
            id: 1,
            name: "Test profile",
            userId: 1,
            options: {},
        };
        registerUiLayer(uiLayerMock);
        await dataModel.initialize();
    });

    afterAll(() => {
        dataModel.unsubscribe(dataModelChanged);

        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        dataModelChanged.mockClear();
    });

    it("Connection handling", async () => {
        let roots = dataModel.roots;
        expect(roots.length).toBe(1);

        await dataModel.reloadConnections();
        roots = dataModel.roots;
        expect(roots.length).toBe(3);

        expect(roots[0].type).toBe(CdmEntityType.ConnectionGroup);
        const firstGroup = roots[0] as ICdmConnectionGroupEntry;
        expect(firstGroup.caption).toBe("Test folder 1");

        expect(roots[1].type).toBe(CdmEntityType.Connection);
        const firstConnection = roots[1] as ICdmConnectionEntry;

        expect(roots[2].type).toBe(CdmEntityType.Connection);
        const secondConnection = roots[2] as ICdmConnectionEntry;

        // The connection member of a connection points to itself.
        expect(firstConnection.connection).toEqual(firstConnection);
        expect(firstConnection.isOpen).toBe(false);

        // Open a connection.
        await firstConnection.refresh?.();
        expect(firstConnection.isOpen).toBe(false); // No data was provided yet.

        // Close the connection to reset its initialized state.
        await firstConnection.close();

        // Try again, this time with data.
        cdmMockState.haveMockConnectionResponse = true;
        await firstConnection.refresh?.();
        expect(firstConnection.isOpen).toBe(true);
        expect(await dataModel.isValidConnectionId(firstConnection.details.id)).toBe(true);

        // Run the MRS timer at least once. For this we need to expand the MRS item in the connection.
        // This test cannot be used when an MRS database upgrade is due.
        if (firstConnection.mrsEntry) {
            firstConnection.mrsEntry.state.expanded = true;

            expect(dataModel.autoRouterRefresh).toBe(false);
            dataModel.autoRouterRefresh = true;
            expect(dataModel.autoRouterRefresh).toBe(true);
            await sleep(1000); // Wait for the router auto refresh to happen.
            dataModel.autoRouterRefresh = false;
            expect(dataModel.autoRouterRefresh).toBe(false);
        }

        // We only opened the first connection. Check that again and then close all connections.
        expect(firstConnection.isOpen).toBe(true);
        expect(secondConnection.isOpen).toBe(false);
        await dataModel.closeAllConnections();
        expect(firstConnection.isOpen).toBe(false);
        expect(secondConnection.isOpen).toBe(false);

        // Creating a new connection entry does not add it to the data model.
        const connection = dataModel.createConnectionEntry(extraConnectionDetails);
        expect(dataModel.roots).toHaveLength(3);

        // Still you can open it.
        await connection.refresh!();
        expect(connection.isOpen).toBe(true);
        expect(await dataModel.isValidConnectionId(connection.details.id)).toBe(false); // Not in the DM.
        await connection.close();

        expect(await dataModel.isValidConnectionId(1)).toBe(true); // A connection with id 1 is in the DM.

        expect(await dataModel.findConnectionEntryById(1)).toEqual(roots[1]);

        expect(await dataModel.findConnectionEntryById(3)).toBeUndefined();
        await dataModel.addConnectionEntry(connection); // Now we have 3 connections.
        expect(dataModel.roots).toHaveLength(4);
        expect(await dataModel.findConnectionEntryById(3)).toEqual(connection);

        // Make the extra connection use the same id as the second connection and update that. This will replace
        // the details of the second connection by that of the 3rd. But first test they are not already equal.
        expect(secondConnection.details).not.toEqual(extraConnectionDetails);

        extraConnectionDetails.id = 2;
        await dataModel.updateConnectionDetails(extraConnectionDetails);
        expect(dataModel.roots).toHaveLength(4);
        expect(secondConnection.details).toEqual(extraConnectionDetails);

        // Now the same with the first DM connection entry. Make it use the second connection id and update it.
        connection.details.id = 1;
        expect(secondConnection.details).not.toEqual(firstConnection.details);
        await dataModel.updateConnectionDetails(connection);
        expect(secondConnection.details).toEqual(firstConnection.details);

        webSession.profile.id = -1; // Simulate no profile.
        await dataModel.reloadConnections();
        expect(dataModel.roots).toHaveLength(0);

        checkNoUiWarningsOrErrors();

        webSession.profile.id = 1;
    });

    it("Refreshing entries", async () => {
        // Refresh all children of the connections recursively.
        cdmMockState.haveMockConnectionResponse = true;

        await dataModel.reloadConnections();
        const roots = dataModel.roots;
        expect(roots).toHaveLength(3);

        const refresh = async (entry: ConnectionDataModelEntry) => {
            await entry.refresh?.();

            if (entry.getChildren) {
                for (const child of entry.getChildren()) {
                    await refresh(child);
                }
            }
        };

        for (const connection of roots) {
            await refresh(connection);
        }

        expect(roots[0].type).toBe(CdmEntityType.ConnectionGroup);
        const firstFolder = roots[0] as ICdmConnectionEntry;
        expect(firstFolder.caption).toBe("Test folder 1");

        expect(roots[1].type).toBe(CdmEntityType.Connection);
        const firstConnection = roots[1] as ICdmConnectionEntry;

        expect(roots[2].type).toBe(CdmEntityType.Connection);
        const secondConnection = roots[2] as ICdmConnectionEntry;

        // Now check if everything was loaded. We don't check everything here, just a few examples.
        // Also here, if there's an MRS db upgrade pending, we don't have an MRS item to check.
        if (firstConnection.mrsEntry) {
            expect(firstConnection.mrsEntry).toBeDefined();
            expect(firstConnection.mrsEntry.services).toHaveLength(1);
            expect(firstConnection.mrsEntry.routerGroup.routers).toHaveLength(1);
        }

        expect(firstConnection.adminEntry).toBeDefined();
        expect(secondConnection.schemaEntries).toHaveLength(2);

        expect(secondConnection.schemaEntries[0].procedures.getChildren!()).toHaveLength(15);
        expect(secondConnection.schemaEntries[0].procedures.members).toHaveLength(15);
        expect(secondConnection.schemaEntries[0].procedures.members[5].schema).toBe("sakila");
        expect(secondConnection.schemaEntries[1].tables.members[5].connection).toBe(roots[2]);
        expect(secondConnection.schemaEntries[1].tables.members[5].triggers.members).toHaveLength(2);
        expect(secondConnection.schemaEntries[1].tables.members[5].columns.members).toHaveLength(2);

        checkNoUiWarningsOrErrors();
    });

    it("MRS auth apps", async () => {
        cdmMockState.haveMockConnectionResponse = true;
        await dataModel.reloadConnections();
        const roots = dataModel.roots;
        await roots[0].refresh?.();

        checkNoUiWarningsOrErrors();
    });
});
