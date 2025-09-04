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

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { IShellDbConnection, ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { ResponseError } from "../../../../communication/ResponseError.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterfaceDb } from "../../../../supplement/ShellInterface/ShellInterfaceDb.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

import { MessageScheduler, type ISendRequestParameters } from "../../../../communication/MessageScheduler.js";
import type { IShellDictionary } from "../../../../communication/Protocol.js";
import type { IProtocolResults } from "../../../../communication/ProtocolResultMapper.js";
import { convertErrorToString } from "../../../../utilities/helpers.js";
import { getDbCredentials, ITestDbCredentials } from "../../test-helpers.js";

vi.spyOn(MessageScheduler.get, "sendRequest").mockImplementation(
    <K extends keyof IProtocolResults>(details: ISendRequestParameters<K>) => {
        switch (details.requestType) {
            case ShellAPIGui.GuiDbStartSession: {
                return Promise.resolve({ result: { moduleSessionId: "testSessionId" } });
            }

            case ShellAPIGui.GuiDbGetCatalogObjectNames: {
                return Promise.resolve([{ result: ["mysql", "sys"] }]);
            }

            case ShellAPIGui.GuiDbGetSchemaObjectNames: {
                const parameters = details.parameters as { args: { schemaName: string; type: string; }; };
                if (parameters.args.schemaName === "mysql" && parameters.args.type === "Table") {
                    return Promise.resolve([{ result: ["help_topic"] }]);
                }

                return Promise.reject(new ResponseError(
                    { requestState: { msg: `Unsupported None object type (${parameters.args.type})` } }));
            }

            case ShellAPIGui.GuiDbGetTableObjectNames: {
                const parameters =
                    details.parameters as { args: { schemaName: string; tableName: string; type: string; }; };
                if (parameters.args.schemaName === "mysql" && parameters.args.tableName === "help_topic"
                    && parameters.args.type === "Column") {
                    return Promise.resolve([{ result: ["help_topic_id"] }]);
                }

                return Promise.reject(new ResponseError(
                    { requestState: { msg: `Unsupported None object type (${parameters.args.type})` } }));
            }
            default: {
                return Promise.resolve();
            }
        }
    }
);

describe("ShellInterfaceDb Tests", () => {
    let db: ShellInterfaceDb;

    let credentials: ITestDbCredentials;

    let testConnection: IConnectionDetails;

    beforeAll(() => {
        registerUiLayer(uiLayerMock);

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

        db = new ShellInterfaceDb();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Close session without opening one", async () => {
        expect(db.moduleSessionId).toBeUndefined();
        await db.closeSession();
        expect(db.moduleSessionId).toBeUndefined();
    });

    it("Stored connection, catalog objects", async () => {
        try {
            await db.startSession("test1", testConnection.id);
            expect(db.moduleSessionId).toBe("testSessionId");

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
            options: { ...testConnection.options } as IShellDictionary,
            settings: {},
        };

        try {
            await db.startSession("test1", temp);

            let objects = await db.getCatalogObjects("Schema");
            expect(objects).toContain("mysql");

            await expect(db.getSchemaObjectNames("mysql", "table")).rejects.toBeInstanceOf(ResponseError);
            try {
                await db.getSchemaObjectNames("mysql", "table");
            } catch (reason) {
                const message = convertErrorToString(reason);
                expect(message).toEqual("Unsupported None object type (table)");
            }

            objects = await db.getSchemaObjectNames("mysql", "Table");
            expect(objects).toContain("help_topic");

            await expect(db.getTableObjectNames("mysql", "help_topic", "trigger")).rejects
                .toBeInstanceOf(ResponseError);

            try {
                await db.getTableObjectNames("mysql", "help_topic", "trigger");
            } catch (reason) {
                const message = convertErrorToString(reason);
                expect(message).toEqual("Unsupported None object type (trigger)");
            }

            objects = await db.getTableObjectNames("mysql", "help_topic", "Column");
            expect(objects).toContain("help_topic_id");
        } finally {
            await db.closeSession();
        }

        let objects = await db.getCatalogObjects("Schema");
        expect(objects).toHaveLength(0);
        objects = await db.getSchemaObjectNames("mysql", "Table");
        expect(objects).toHaveLength(0);
        objects = await db.getTableObjectNames("mysql", "help_topic", "Column");
        expect(objects).toHaveLength(0);
    });

});
