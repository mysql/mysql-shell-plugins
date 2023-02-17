/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { MySQLConnectionScheme } from "../../../../communication/MySQL";
import { IShellDbConnection } from "../../../../communication/ProtocolGui";
import { ResponseError } from "../../../../communication/ResponseError";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface";
import { ShellInterfaceDb } from "../../../../supplement/ShellInterface/ShellInterfaceDb";
import { webSession } from "../../../../supplement/WebSession";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";

import { getDbCredentials, ITestDbCredentials, setupShellForTests } from "../../test-helpers";

describe("ShellInterfaceDb Tests", () => {
    let launcher: MySQLShellLauncher;
    let db: ShellInterfaceDb;

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
            useMDS: false,

        };

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);

        db = new ShellInterfaceDb();
    });

    afterAll(async () => {
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        await launcher.exitProcess();
    });

    it("Close session without opening one", async () => {
        await db.closeSession(); // Must not throw an error.
    });

    it("Stored connection, catalog objects", async () => {
        try {
            await db.startSession("test1", testConnection.id);

            const objects = await db.getCatalogObjects("Schema");
            expect(objects).toContain("mysql");
        } finally {
            await db.closeSession();
        }

        const objects = await db.getCatalogObjects("Schema");
        expect(objects).toHaveLength(0);
    });

    it("Connection from credentials, catalog/schema/table objects", async () => {
        const temp: IShellDbConnection = {
            dbType: testConnection.dbType,
            caption: testConnection.caption,
            description: testConnection.description,
            options: { ...testConnection.options },
        };

        try {
            await db.startSession("test1", temp);

            let objects = await db.getCatalogObjects("Schema");
            expect(objects).toContain("mysql");

            await expect(db.getSchemaObjects("mysql", "table")).rejects
                .toBeInstanceOf(ResponseError).catch((reason) => {
                    expect(reason.message).toEqual("Unsupported None object type (table)");
                });
            objects = await db.getSchemaObjects("mysql", "Table");
            expect(objects).toContain("help_topic");

            await expect(db.getTableObjects("mysql", "help_topic", "trigger")).rejects
                .toBeInstanceOf(ResponseError).catch((reason) => {
                    expect(reason.message).toEqual("Unsupported None object type (trigger)");
                });
            objects = await db.getTableObjects("mysql", "help_topic", "Column");
            expect(objects).toContain("help_topic_id");
        } finally {
            await db.closeSession();
        }

        let objects = await db.getCatalogObjects("Schema");
        expect(objects).toHaveLength(0);
        objects = await db.getSchemaObjects("mysql", "Table");
        expect(objects).toHaveLength(0);
        objects = await db.getTableObjects("mysql", "help_topic", "Column");
        expect(objects).toHaveLength(0);
    });

});
