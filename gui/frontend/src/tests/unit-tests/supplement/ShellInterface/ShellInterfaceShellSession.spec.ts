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

import { beforeAll, describe, expect, it, vi } from "vitest";

import { IDictionary } from "../../../../app-logic/general-types.js";
import type { DataCallback } from "../../../../communication/MessageScheduler.js";
import { MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { IShellPromptValues, type ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceShellSession } from "../../../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { ShellInterfaceDbConnection } from "../../../../supplement/ShellInterface/ShellInterfaceDbConnection.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { getDbCredentials, ITestDbCredentials, mockClassMethods } from "../../test-helpers.js";

const connections: IConnectionDetails[] = [];

mockClassMethods(ShellInterfaceDbConnection, {
    listDbConnections: vi.fn().mockImplementation((profileId: string, folderPathId?: number) => {
        if (folderPathId === 42) {
            return Promise.resolve(connections);
        }

        return [];
    }),
    addDbConnection: vi.fn().mockImplementation((profileId, connection: IConnectionDetails) => {
        connection.id = 1; // Mock ID for the new connection.
        connections.push(connection);

        return [connection.id];
    }),
});

mockClassMethods(ShellInterfaceShellSession, {
    startShellSession: vi.fn().mockImplementation((id: string, dbConnectionId?: number, shellArgs?: unknown[],
        requestId?: string, callback?: DataCallback<ShellAPIGui.GuiShellStartSession>) => {
        if (dbConnectionId === -1) {
            return Promise.reject(new Error("Invalid connection ID"));
        }

        if (webSession.moduleSessionId("xyz") === undefined) {
            webSession.setModuleSessionId("xyz", "session1");

            return Promise.resolve({ moduleSessionId: "session1" });
        }

        return Promise.resolve();
    }),

    execute: vi.fn().mockImplementation((command: string, requestId?: string) => {
        if (command === "\\sql") {
            return Promise.resolve({
                promptDescriptor: {
                    mode: "SQL",
                },
            } as IShellPromptValues);
        }

        return Promise.resolve();
    }),

    getCompletionItems: vi.fn().mockImplementation((command: string, position: number) => {
        if (command.startsWith("select sa") && position === 8) {
            return Promise.resolve([{
                label: "sample_table",
                kind: 10,
                options: [],
            }]);
        }

        return Promise.resolve([]);
    }),
});

describe("ShellInterfaceShellSession Tests", () => {
    let credentials: ITestDbCredentials;
    let testConnection: IConnectionDetails;

    beforeAll(async () => {
        // Create a connection for our tests.
        credentials = getDbCredentials();
        testConnection = {
            id: -1,
            index: -1,

            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options: {
                scheme: MySQLConnectionScheme.MySQL,
                user: credentials.userName,
                password: credentials.password,
                host: credentials.host,
                port: credentials.port,
            },
            useSSH: false,
            useMHS: false,

        };

        testConnection.id = (await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection))[0];
        expect(testConnection.id).toBeGreaterThan(-1);
    });

    it("Creation and interaction", async () => {
        let session = new ShellInterfaceShellSession("Lorem Ipsum");
        expect(session.hasSession).toBeTruthy();

        session = new ShellInterfaceShellSession();
        expect(session.hasSession).toBeFalsy();

        let response = await session.startShellSession("session1", testConnection.id);
        expect(response).toBeDefined();
        if (response) {
            expect((response as IDictionary).moduleSessionId).toBeDefined();
        }

        // Try to start session again, which will do nothing (and return nothing).
        response = await session.startShellSession("session1", testConnection.id);
        expect(response).toBeUndefined();

        response = await session.execute("\\sql");
        expect(response).toBeDefined();
        if (response) {
            expect((response as IShellPromptValues).promptDescriptor?.mode).toBe("SQL");
        }

        const candidates = await session.getCompletionItems("select sa", 8);
        expect(candidates.length).toBe(1);
        expect(candidates[0].options).toBeDefined();
        expect(candidates[0].options?.length).toBe(0); // TODO: should return a list.

        await session.closeShellSession();
    });

});
