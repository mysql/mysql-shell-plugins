/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { describe, expect, it } from "vitest";

import type { IDbEditorResultSetData } from "../../../../communication/ProtocolGui.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";

describe("ShellInterfaceSqlEditor Tests", () => {
    it("caches performance schema availability on the backend instance", async () => {
        class TestBackend extends ShellInterfaceSqlEditor {
            public calls: string[] = [];
            public response: IDbEditorResultSetData | undefined = { rows: [["1"]] };

            public override executeService(sql: string): Promise<IDbEditorResultSetData | undefined> {
                this.calls.push(sql);

                return Promise.resolve(this.response);
            }
        }

        const testBackend = new TestBackend();

        expect(await testBackend.isPerformanceSchemaAvailable()).toBe(true);
        expect(await testBackend.isPerformanceSchemaAvailable()).toBe(true);
        expect(testBackend.calls).toEqual(["select @@performance_schema"]);
    });

    it("caches partial revokes availability on the backend instance", async () => {
        class TestBackend extends ShellInterfaceSqlEditor {
            public calls: string[] = [];
            public response: IDbEditorResultSetData | undefined = { rows: [[1]] };

            public override async executeService(sql: string): Promise<IDbEditorResultSetData | undefined> {
                this.calls.push(sql);

                return Promise.resolve(this.response);
            }
        }

        const testBackend = new TestBackend();

        expect(await testBackend.isPartialRevokesEnabled()).toBe(true);
        expect(await testBackend.isPartialRevokesEnabled()).toBe(true);
        expect(testBackend.calls).toEqual(["SELECT @@GLOBAL.partial_revokes"]);
    });
});
