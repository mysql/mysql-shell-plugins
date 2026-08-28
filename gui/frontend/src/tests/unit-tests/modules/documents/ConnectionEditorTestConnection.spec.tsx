/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IDialogValues } from "../../../../components/Dialogs/ValueEditDialog.js";
import { ConnectionEditor } from "../../../../modules/db-editor/ConnectionEditor.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

interface ITestableConnectionEditor {
    testConnection(values: IDialogValues): Promise<void>;
}

describe("ConnectionEditor", (): void => {
    beforeEach(() => {
        registerUiLayer(uiLayerMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("lets MySQL Shell resolve a saved password before prompting", async () => {
        const testConnectionSpy = vi.spyOn(ShellInterface.dbConnections, "testConnection").mockResolvedValue();
        const requestPasswordSpy = vi.spyOn(uiLayerMock, "requestPassword");
        const editor = new ConnectionEditor({ onAddConnection: vi.fn(), onUpdateConnection: vi.fn() });
        const testableEditor = editor as unknown as ITestableConnectionEditor;
        const values = {
            sections: new Map([
                ["general", { values: { databaseType: { value: DBType.MySQL } } }],
                ["information", { values: { caption: { value: "Test" }, description: { value: "" } } }],
                ["sqliteDetails", { values: {} }],
                ["sqliteAdvanced", { values: {} }],
                ["mysqlDetails", { values: {
                    scheme: { value: "mysql" }, userName: { value: "root" }, hostName: { value: "localhost" },
                    port: { value: 3306 }, defaultSchema: { value: "" },
                } }],
                ["mdsBastion", { values: {} }],
                ["ssh", { values: {} }],
                ["mysqlAdvanced", { values: {
                    compressionAlgorithms: { value: [] }, compression: { value: "" }, compressionLevel: { value: 0 },
                    timeout: { value: 10 }, disableHeatwaveCheck: { value: false }, extraOptions: { value: {} },
                } }],
                ["ssl", { values: {
                    sslMode: { value: "Disable" }, sslCaFile: { value: "" }, sslCertFile: { value: "" },
                    sslKeyFile: { value: "" }, sslCipher: { value: "" },
                } }],
            ]),
        } as unknown as IDialogValues;

        await testableEditor.testConnection(values);

        expect(requestPasswordSpy).not.toHaveBeenCalled();
        expect(testConnectionSpy).toHaveBeenCalledOnce();
        const [connection] = testConnectionSpy.mock.calls[0];
        expect(connection.dbType).toBe(DBType.MySQL);
        expect(connection.options).toMatchObject({ host: "localhost", user: "root" });
    });
});
