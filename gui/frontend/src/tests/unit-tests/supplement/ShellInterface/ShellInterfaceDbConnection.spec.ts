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

import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { getDbCredentials, setupShellForTests } from "../../test-helpers.js";

describe("ShellInterfaceDbConnection Tests", () => {
    let launcher: MySQLShellLauncher;
    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG3");
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

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
            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options,
            settings: {},
        };

        let connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);
        const folderID = await ShellInterface.dbConnections.addFolderPath(
            webSession.currentProfileId, "unit-tests", -1);
        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, folderID) ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, 1);
        expect(connections.length).toBe(0);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, folderID);
        expect(connections.length).toBe(1);

        // Add the same connection again, this time with no folder path.
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection) ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        const connection = await ShellInterface.dbConnections.getDbConnection(testConnection.id);
        expect(connection).toBeDefined();
        expect(connection).not.toBe(testConnection);
        expect(connection).toEqual(testConnection);

        (connection!.options as IMySQLConnectionOptions).user = "Paul";
        await ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, connection!);
        const connection2 = await ShellInterface.dbConnections.getDbConnection(testConnection.id);
        expect(connection2).not.toBe(testConnection);
        expect(connection2).not.toBe(testConnection);
        expect(connection2).not.toEqual(testConnection);
        expect((connection2?.options as IMySQLConnectionOptions).user).toBe("Paul");

        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);

        connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);
        expect(connections.length).toBe(0);

        await ShellInterface.dbConnections.removeFolderPath(folderID);
    });
});
