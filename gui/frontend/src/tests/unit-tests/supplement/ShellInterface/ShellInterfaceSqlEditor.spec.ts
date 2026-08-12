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

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import type { IDbEditorResultSetData } from "../../../../communication/ProtocolGui.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { ShellInteractiveInterface } from "../../../../supplement/ShellInterface/ShellInteractiveInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

class TestBackend extends ShellInterfaceSqlEditor {
    public setModuleSession(sessionId: string): void {
        this.moduleSessionLookupId = sessionId;
        webSession.setModuleSessionId(sessionId, sessionId);
    }
}

describe("ShellInterfaceSqlEditor Tests", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        webSession.setModuleSessionId("reconnect-test");
    });

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

    it("caches performance report capabilities on the backend instance", async () => {
        class TestBackend extends ShellInterfaceSqlEditor {
            public calls: string[] = [];
            public response: IDbEditorResultSetData | undefined = { rows: [[1, 1, 1, 1, 1, 1]] };

            public override executeService(sql: string): Promise<IDbEditorResultSetData | undefined> {
                this.calls.push(sql);

                return Promise.resolve(this.response);
            }
        }

        const testBackend = new TestBackend();

        await expect(testBackend.getPerformanceReportCapabilities()).resolves.toEqual({
            performanceSchema: true,
            logStatus: true,
            memory: true,
            waits: true,
            slowQueries: true,
            statementHistogram: true,
        });
        await testBackend.getPerformanceReportCapabilities();

        expect(testBackend.calls).toHaveLength(1);
        expect(testBackend.calls[0]).toContain("events_statements_histogram_global");
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

    it("shows WebAuthn messages received while reconnecting", async () => {
        registerUiLayer(uiLayerMock);
        const interactiveSpy = vi.spyOn(ShellInteractiveInterface.prototype, "sendInteractiveRequest")
            .mockImplementation(async (details) => {
                const onData = details.onData as unknown as (data: unknown, requestId: string) => Promise<boolean>;
                await onData({
                    result: "Please perform the gesture action on your authenticator.",
                    attributes: { auth: "authentication_webauthn" },
                }, "request-id");

                return [] as never;
            });
        const editor = new TestBackend();
        editor.setModuleSession("reconnect-test");

        await editor.reconnect();

        expect(interactiveSpy).toHaveBeenCalledOnce();
        // eslint-disable-next-line @typescript-eslint/unbound-method -- The mock is invoked by its owning UI layer.
        expect(vi.mocked(uiLayerMock.showInformationMessage)).toHaveBeenCalledWith(
            "Please perform the gesture action on your authenticator.", {},
        );
    });
});
