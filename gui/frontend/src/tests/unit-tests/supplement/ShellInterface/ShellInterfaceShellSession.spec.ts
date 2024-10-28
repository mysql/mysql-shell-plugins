/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { IDictionary } from "../../../../app-logic/general-types.js";
import { MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { IShellPromptValues } from "../../../../communication/ProtocolGui.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceShellSession } from "../../../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { getDbCredentials, ITestDbCredentials, setupShellForTests } from "../../test-helpers.js";

describe("ShellInterfaceShellSession Tests", () => {
    let launcher: MySQLShellLauncher;
    let credentials: ITestDbCredentials;
    let testConnection: IConnectionDetails;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG3");

        // Create a connection for our tests.
        credentials = getDbCredentials();
        testConnection = {
            id: -1,

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

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);
    });

    afterAll(async () => {
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        await launcher.exitProcess();
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
