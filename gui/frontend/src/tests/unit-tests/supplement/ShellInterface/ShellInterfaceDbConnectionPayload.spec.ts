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

import { describe, expect, it, vi } from "vitest";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { MessageScheduler } from "../../../../communication/MessageScheduler.js";
import { ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterfaceDbConnection } from "../../../../supplement/ShellInterface/ShellInterfaceDbConnection.js";
import { ShellInteractiveInterface } from "../../../../supplement/ShellInterface/ShellInteractiveInterface.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

describe("ShellInterfaceDbConnection payloads", (): void => {
    it("shows WebAuthn messages received while testing a connection", async () => {
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

        await new ShellInterfaceDbConnection().testConnection(42);

        // eslint-disable-next-line @typescript-eslint/unbound-method -- The mock is invoked by its owning UI layer.
        expect(vi.mocked(uiLayerMock.showInformationMessage)).toHaveBeenCalledWith(
            "Please perform the gesture action on your authenticator.", {},
        );
        interactiveSpy.mockRestore();
    });

    it("includes assigned connection tags in update payloads", async () => {
        const sendRequestSpy = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result: undefined,
        });
        const connection: IConnectionDetails = {
            id: 42,
            index: 0,
            dbType: DBType.MySQL,
            caption: "Tagged connection",
            description: "Tagged connection",
            options: {
                host: "localhost",
            },
            settings: {},
            tags: ["DEV", "QA"],
        };

        await new ShellInterfaceDbConnection().updateDbConnection(1, connection);

        expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateDbConnection,
            parameters: {
                args: expect.objectContaining({
                    connection: expect.objectContaining({
                        tags: ["DEV", "QA"],
                    }) as Record<string, unknown>,
                    connectionId: 42,
                    profileId: 1,
                }) as Record<string, unknown>,
            },
        }));
        sendRequestSpy.mockRestore();
    });

    it("sends null when connection tags are not provided", async () => {
        const sendRequestSpy = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result: undefined,
        });
        const connection: IConnectionDetails = {
            id: 42,
            index: 0,
            dbType: DBType.MySQL,
            caption: "Tagged connection",
            description: "Tagged connection",
            options: {
                host: "localhost",
            },
            settings: {},
        };

        await new ShellInterfaceDbConnection().updateDbConnection(1, connection);

        expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateDbConnection,
            parameters: {
                args: expect.objectContaining({
                    connection: expect.objectContaining({ tags: null }) as Record<string, unknown>,
                }) as Record<string, unknown>,
            },
        }));
        sendRequestSpy.mockRestore();
    });

    it("sends an empty list when all connection tags are removed", async () => {
        const sendRequestSpy = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            requestState: { type: "OK", msg: "" },
            result: undefined,
        });
        const connection: IConnectionDetails = {
            id: 42,
            index: 0,
            dbType: DBType.MySQL,
            caption: "Tagged connection",
            description: "Tagged connection",
            options: {
                host: "localhost",
            },
            settings: {},
            tags: [],
        };

        await new ShellInterfaceDbConnection().updateDbConnection(1, connection);

        expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
            requestType: ShellAPIGui.GuiDbConnectionsUpdateDbConnection,
            parameters: {
                args: expect.objectContaining({
                    connection: expect.objectContaining({ tags: [] }) as Record<string, unknown>,
                }) as Record<string, unknown>,
            },
        }));
        sendRequestSpy.mockRestore();
    });
});
