/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { describe, expect, it, vi } from "vitest";

import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceDbConnection } from "../../../../supplement/ShellInterface/ShellInterfaceDbConnection.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { getDbCredentials, mockClassMethods } from "../../test-helpers.js";

const connections: IConnectionDetails[] = [];

mockClassMethods(ShellInterfaceDbConnection, {
    listDbConnections: vi.fn().mockImplementation((profileId: string, folderPathId?: number) => {
        if (folderPathId === 42) {
            return Promise.resolve(connections);
        }

        return [];
    }),
    getDbConnection: vi.fn().mockImplementation((connectionId: number) => {
        const connection = connections.find((c) => {
            return c.id === connectionId;
        });

        if (connection) {
            return Promise.resolve({ ...connection });
        }

        return Promise.reject(new Error("Connection not found"));
    }),
    removeDbConnection: vi.fn(),
    addFolderPath: vi.fn().mockImplementation(() => {
        return { id: 42, name: "unit-tests" };
    }),
    removeFolderPath: vi.fn().mockImplementation((folderId: number) => {
        if (folderId === 42) {
            return Promise.resolve();
        }

        return Promise.reject(new Error("Folder not found"));
    }),
    addDbConnection: vi.fn().mockImplementation((profileId, connection: IConnectionDetails) => {
        connection.id = 1; // Mock ID for the new connection.
        connections.push(connection);

        return [connection.id];
    }),
    updateDbConnection: vi.fn().mockImplementation((profileId, connection: IConnectionDetails) => {
        const index = connections.findIndex((c) => {
            return c.id === connection.id;
        });
        if (index !== -1) {
            connections[index] = connection;

            return Promise.resolve();
        }

        return Promise.reject(new Error("Connection not found"));
    }),
});

describe("ShellInterfaceDbConnection Tests", () => {
    it("Add/remove/update a connection", async () => {
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
            index: -1,
            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options,
            settings: {},
        };

        let connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);
        const folder = await ShellInterface.dbConnections.addFolderPath(
            webSession.currentProfileId, "unit-tests", -1);
        testConnection.id = (await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, folder.id))[0];
        expect(testConnection.id).toBeGreaterThan(-1);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, 1);
        expect(connections.length).toBe(0);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, folder.id);
        expect(connections.length).toBe(1);

        // Add the same connection again, this time with no folder path.
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        testConnection.id = (await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection))[0];
        expect(testConnection.id).toBeGreaterThan(-1);

        const connection = await ShellInterface.dbConnections.getDbConnection(testConnection.id);
        expect(connection).toBeDefined();
        expect(connection).not.toBe(testConnection); // Not the same object.
        connection!.index = -1; // getDbConnection() returns no index.
        expect(connection).toEqual(testConnection); // Same content.

        (connection!.options as IMySQLConnectionOptions).user = "Paul";
        await ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, connection!);
        const connection2 = await ShellInterface.dbConnections.getDbConnection(testConnection.id);
        expect(connection2).not.toBe(testConnection);
        expect(connection2).not.toBe(testConnection);
        expect((connection2?.options as IMySQLConnectionOptions).user).toBe("Paul");

        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);

        await ShellInterface.dbConnections.removeFolderPath(folder.id);
    });
});
