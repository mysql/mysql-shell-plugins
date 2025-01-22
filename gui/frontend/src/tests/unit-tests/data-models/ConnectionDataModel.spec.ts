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

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import type {
    IMrsAuthAppData, IMrsContentFileData, IMrsContentSetData, IMrsRouterData, IMrsRouterService, IMrsSchemaData,
    IMrsServiceData, IMrsStatusData, IMrsUserData,
} from "../../../communication/ProtocolMrs.js";
import { ConnectionDataModel, type ConnectionDataModelEntry } from "../../../data-models/ConnectionDataModel.js";
import { webSession } from "../../../supplement/WebSession.js";
import { sleep } from "../../../utilities/helpers.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { checkNoUiWarningsOrErrors } from "../test-helpers.js";
import {
    authAppsData, cdmMockState, connectionDetailsMock1, extraConnectionDetails, mrsContentFileData, mrsContentSetData,
    mrsRouterData, mrsSchemaData, mrsServiceData, mrsServicesData, mrsStatusMock, mrsUserData, openConnectionDataMock1,
    routerServiceData, type OpenConnectionResponse,
} from "./data-model-test-data.js";

const dataModelChanged = jest.fn();

// Some variables to configure the mock functions during tests:

jest.mock("../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js", () => {
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ShellInterfaceSqlEditor: jest.fn().mockImplementation(() => {
            return {
                startSession: jest.fn(),
                closeSession: jest.fn(),
                openConnection: (id: string, requestId: string,
                    callback: (response: OpenConnectionResponse, resultId: string) => void) => {
                    callback({
                        result: cdmMockState.haveMockConnectionResponse ? openConnectionDataMock1 : undefined,
                    }, requestId);
                },
                getCatalogObjects: jest.fn().mockReturnValue([
                    "sakila", "mysql_rest_service_metadata",
                ]),
                getSchemaObjects: jest.fn().mockReturnValue([
                    "actor", "address", "category", "city", "country", "customer", "film", "film_actor",
                    "film_category", "inventory", "language", "payment", "rental", "staff", "store",
                ]),
                getTableObjectNames: jest.fn().mockReturnValue([
                    "object1", "object1", // In lieu of any database object name.
                ]),
                getTableObject: jest.fn().mockReturnValue({
                    name: "object1",
                }),

                mrs: {
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
                    getAuthApps: (): Promise<IMrsAuthAppData[]> => {
                        return Promise.resolve(authAppsData);
                    },
                    getSchema: (): Promise<IMrsSchemaData> => {
                        return Promise.resolve(mrsSchemaData[0]);
                    },
                    getRouterServices: (): Promise<IMrsRouterService[]> => {
                        return Promise.resolve(routerServiceData);
                    },
                },
            };
        }),
    };
});

jest.mock("../../../supplement/ShellInterface/ShellInterfaceDbConnection.js", () => {
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ShellInterfaceDbConnection: jest.fn().mockImplementation(() => {
            return {
                listDbConnections: jest.fn().mockImplementation(() => {
                    if (!cdmMockState.mockConnectedLoaded) { // Simulate varying connection loading conditions.
                        cdmMockState.mockConnectedLoaded = true;

                        return connectionDetailsMock1.slice(0, 1);
                    }

                    return [...connectionDetailsMock1];
                }),
                removeDbConnection: jest.fn(),
            };
        }),
    };
});

jest.mock("../../../supplement/ShellInterface/ShellInterfaceCore.js", () => {
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ShellInterfaceCore: jest.fn().mockImplementation(() => {
            return {
                createDatabaseFile: jest.fn(),
                validatePath: jest.fn().mockReturnValue(Promise.resolve(true)),
            };
        }),
    };
});

describe("ConnectionDataModel", () => {
    const dataModel = new ConnectionDataModel(500);
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

        jest.restoreAllMocks();
        jest.unmock("../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js");
        jest.unmock("../../../supplement/ShellInterface/ShellInterfaceDbConnection.js");
        jest.unmock("../../../supplement/ShellInterface/ShellInterfaceCore.js");
    });

    beforeEach(() => {
        jest.clearAllMocks();
        dataModelChanged.mockClear();
    });

    it("Connection handling", async () => {
        let connections = dataModel.connections;
        expect(connections.length).toBe(1);

        await dataModel.reloadConnections();
        connections = dataModel.connections;
        expect(connections.length).toBe(2);

        // The connection member of a connection points to itself.
        expect(connections[0].connection).toEqual(connections[0]);
        expect(connections[0].isOpen).toBe(false);

        // Open a connection.
        await connections[0].refresh?.();
        expect(connections[0].isOpen).toBe(false); // No data was provided yet.

        // Close the connection to reset its initialized state.
        await connections[0].close?.();

        // Try again, this time with data.
        cdmMockState.haveMockConnectionResponse = true;
        await connections[0].refresh?.();
        expect(connections[0].isOpen).toBe(true);
        expect(dataModel.isValidConnectionId(connections[0].details.id)).toBe(true);

        // Run the MRS timer at least once. For this we need to expand the MRS item in the connection.
        // This test cannot be used when an MRS database upgrade is due.
        if (connections[0].mrsEntry) {
            connections[0].mrsEntry.state.expanded = true;

            expect(dataModel.autoRouterRefresh).toBe(false);
            dataModel.autoRouterRefresh = true;
            expect(dataModel.autoRouterRefresh).toBe(true);
            await sleep(1000); // Wait for the router auto refresh to happen.
            dataModel.autoRouterRefresh = false;
            expect(dataModel.autoRouterRefresh).toBe(false);
        }

        // We only opened the first connection. Check that again and then close all connections.
        expect(connections[0].isOpen).toBe(true);
        expect(connections[1].isOpen).toBe(false);
        await dataModel.closeAllConnections();
        expect(connections[0].isOpen).toBe(false);
        expect(connections[1].isOpen).toBe(false);

        // Creating a new connection entry does not add it to the data model.
        const connection = dataModel.createConnectionEntry(extraConnectionDetails);
        expect(dataModel.connections).toHaveLength(2);

        // Still you can open it.
        await connection.refresh!();
        expect(connection.isOpen).toBe(true);
        expect(dataModel.isValidConnectionId(connection.details.id)).toBe(false); // Not in the DM.
        await connection.close();

        expect(dataModel.isValidConnectionId(1)).toBe(true); // A connection with id 1 is in the DM.

        expect(dataModel.findConnectionEntryById(1)).toEqual(connections[0]);

        expect(dataModel.findConnectionEntryById(3)).toBeUndefined();
        dataModel.addConnectionEntry(connection); // Now we have 3 connections.
        expect(dataModel.connections).toHaveLength(3);
        expect(dataModel.findConnectionEntryById(3)).toEqual(connection);

        // Make the extra connection use the same id as the second connection and update that. This will replace
        // the details of the second connection by that of the 3rd. But first test they are not already equal.
        expect(dataModel.connections[1].details).not.toEqual(extraConnectionDetails);

        extraConnectionDetails.id = 2;
        dataModel.updateConnectionDetails(extraConnectionDetails);
        expect(dataModel.connections).toHaveLength(3);
        expect(dataModel.connections[1].details).toEqual(extraConnectionDetails);

        // Now the same with the first DM connection entry. Make it use the second connection id and update it.
        connection.details.id = 1;
        expect(dataModel.connections[1].details).not.toEqual(dataModel.connections[0].details);
        dataModel.updateConnectionDetails(connection);
        expect(dataModel.connections[1].details).toEqual(dataModel.connections[0].details);

        webSession.profile.id = -1; // Simulate no profile.
        await dataModel.reloadConnections();
        expect(dataModel.connections).toHaveLength(0);

        checkNoUiWarningsOrErrors();

        webSession.profile.id = 1;
    });

    it("Refreshing entries", async () => {
        // Refresh all children of the connections recursively.
        cdmMockState.haveMockConnectionResponse = true;

        await dataModel.reloadConnections();
        const connections = dataModel.connections;
        expect(connections).toHaveLength(2);

        const refresh = async (entry: ConnectionDataModelEntry) => {
            await entry.refresh?.();

            if (entry.getChildren) {
                for (const child of entry.getChildren()) {
                    await refresh(child);
                }
            }
        };

        for (const connection of connections) {
            await refresh(connection);
        }

        // Now check if everything was loaded. We don't check everything here, just a few examples.
        // Also here, if there's an MRS db upgrade pending, we don't have an MRS item to check.
        if (connections[0].mrsEntry) {
            expect(connections[0].mrsEntry).toBeDefined();
            expect(connections[0].mrsEntry.services).toHaveLength(1);
            expect(connections[0].mrsEntry.routers).toHaveLength(1);
        }

        expect(connections[0].adminEntry).toBeDefined();
        expect(connections[1].schemaEntries).toHaveLength(2);

        expect(connections[1].schemaEntries[0].procedures.getChildren!()).toHaveLength(15);
        expect(connections[1].schemaEntries[0].procedures.members).toHaveLength(15);
        expect(connections[1].schemaEntries[0].procedures.members[5].schema).toBe("sakila");
        expect(connections[1].schemaEntries[1].tables.members[5].connection).toBe(connections[1]);
        expect(connections[1].schemaEntries[1].tables.members[5].triggers.members).toHaveLength(2);
        expect(connections[1].schemaEntries[1].tables.members[5].columns.members).toHaveLength(2);

        checkNoUiWarningsOrErrors();
    });
});
