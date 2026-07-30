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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IDesktopCommandDescriptor, IDesktopCommandProvider } from "../../../supplement/DesktopCommandRegistry.js";

interface IWebSessionStartedData {
    localUserMode: boolean;
    requestState: { msg: string; };
    sessionUuid: string;
}

describe("Electron desktop frontend integration", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "electronDesktopBackend");
        Reflect.deleteProperty(window, "electronHost");
    });

    it("uses the Electron host bridge for remote requisitions", async () => {
        let inboundHandler: ((message: { source: "host"; command: string; }) => void) | undefined;
        const postMessage = vi.fn();

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage,
                setMessageHandler: (handler: (message: { source: "host"; command: string; }) => void) => {
                    inboundHandler = handler;
                },
            },
        });

        const { requisitions } = await import("../../../supplement/Requisitions.js");
        const showAbout = vi.fn().mockResolvedValue(true);
        requisitions.register("showAbout", showAbout);

        expect(requisitions.executeRemote("showAbout", undefined)).toBe(true);
        expect(postMessage).toHaveBeenCalledWith({
            source: "app",
            command: "showAbout",
            data: undefined,
        });

        inboundHandler?.({ source: "host", command: "showAbout" });
        await Promise.resolve();

        expect(showAbout).toHaveBeenCalledWith(undefined);
    });

    it("treats Electron as an embedded host for frontend feature gating", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const { appParameters, parseAppParameters } = await import("../../../supplement/AppParameters.js");
        parseAppParameters();

        expect(appParameters.embedded).toBe(true);
    });

    it("uses the Electron desktop backend for bootstrap and request delivery", async () => {
        let messageListener: ((payload: string) => void) | undefined;
        const send = vi.fn();

        Object.defineProperty(window, "electronDesktopBackend", {
            configurable: true,
            value: {
                connect: vi.fn().mockResolvedValue([
                    JSON.stringify({
                        request_state: {
                            type: "OK",
                            msg: "A new session has been created",
                        },
                        session_uuid: "session-123",
                        local_user_mode: true,
                    }),
                ]),
                disconnect: vi.fn().mockResolvedValue(undefined),
                send,
                onMessage: (listener: (payload: string) => void) => {
                    messageListener = listener;

                    return () => {
                        messageListener = undefined;
                    };
                },
                onClose: () => {
                    return () => {
                        return undefined;
                    };
                },
                onError: () => {
                    return () => {
                        return undefined;
                    };
                },
            },
        });

        const { MessageScheduler } = await import("../../../communication/MessageScheduler.js");
        const { Protocol } = await import("../../../communication/Protocol.js");
        const { requisitions } = await import("../../../supplement/Requisitions.js");

        let webSessionStarted: IWebSessionStartedData | undefined;
        requisitions.register("webSessionStarted", async (data) => {
            webSessionStarted = data as IWebSessionStartedData;

            return true;
        });

        await MessageScheduler.get.connect();
        await Promise.resolve();

        expect(webSessionStarted).toMatchObject({
            requestState: {
                msg: "A new session has been created",
                type: "OK",
            },
            sessionUuid: "session-123",
            localUserMode: true,
        });

        const responsePromise = MessageScheduler.get.sendRequest({
            requestType: Protocol.UserAuthenticate,
            parameters: {
                username: "LocalAdministrator",
                password: "",
            },
        }, false);

        expect(send).toHaveBeenCalledTimes(1);
        const requestPayload = JSON.parse(send.mock.calls[0][0]) as { request_id: string; request: string; };
        expect(requestPayload.request).toBe("authenticate");

        messageListener?.(JSON.stringify({
            request_id: requestPayload.request_id,
            request_state: {
                type: "OK",
                msg: "User LocalAdministrator was successfully authenticated.",
            },
            active_profile: {
                id: 1,
                user_id: 1,
                name: "Default",
                description: "",
                options: {},
            },
        }));

        const response = await responsePromise;
        expect(response.activeProfile.id).toBe(1);
        expect(response.activeProfile.userId).toBe(1);

        MessageScheduler.get.disconnect();
    });

    it("allows reconnect after an Electron backend startup failure", async () => {
        const connect = vi.fn()
            .mockRejectedValueOnce(new Error("missing mysqlsh"))
            .mockResolvedValueOnce([
                JSON.stringify({
                    request_state: {
                        type: "OK",
                        msg: "A new session has been created",
                    },
                    session_uuid: "session-456",
                    local_user_mode: true,
                }),
            ]);

        Object.defineProperty(window, "electronDesktopBackend", {
            configurable: true,
            value: {
                connect,
                disconnect: vi.fn().mockResolvedValue(undefined),
                send: vi.fn(),
                onMessage: vi.fn(() => {
                    return () => {
                        return undefined;
                    };
                }),
                onClose: vi.fn(() => {
                    return () => {
                        return undefined;
                    };
                }),
                onError: vi.fn(() => {
                    return () => {
                        return undefined;
                    };
                }),
            },
        });

        const { MessageScheduler } = await import("../../../communication/MessageScheduler.js");
        const { appParameters } = await import("../../../supplement/AppParameters.js");
        const { registerUiLayer } = await import("../../../app-logic/UILayer.js");
        const { uiLayerMock } = await import("../__mocks__/UILayerMock.js");

        const originalTestsRunning = appParameters.testsRunning;
        appParameters.testsRunning = false;
        registerUiLayer(uiLayerMock);

        try {
            await expect(MessageScheduler.get.connect()).rejects.toThrow("missing mysqlsh");

            expect(MessageScheduler.get.isConnected).toBe(false);

            await MessageScheduler.get.connect();

            expect(connect).toHaveBeenCalledTimes(2);
            expect(MessageScheduler.get.isConnected).toBe(true);
        } finally {
            MessageScheduler.get.disconnect();
            appParameters.testsRunning = originalTestsRunning;
        }
    });

    it("bridges desktop command execution and state updates through the Electron host", async () => {
        type HostMessage = { source: "host"; command: string; data?: { id?: string; }; };
        let inboundHandler: ((message: HostMessage) => void) | undefined;
        const postMessage = vi.fn();
        const execute = vi.fn().mockResolvedValue(true);
        const { desktopCommandRegistry } = await import("../../../supplement/DesktopCommandRegistry.js");
        const provider = {
            getCommands: (): IDesktopCommandDescriptor[] => {
                return [{
                    id: "app.about",
                    label: "About MySQL Workbench",
                    enabled: true,
                }];
            },
            execute,
        } as IDesktopCommandProvider;

        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage,
                setMessageHandler: (handler: (message: HostMessage) => void) => {
                    inboundHandler = handler;
                },
            },
        });

        const { requisitions } = await import("../../../supplement/Requisitions.js");
        desktopCommandRegistry.registerProvider(provider);
        expect(requisitions.executeRemote("showAbout", undefined)).toBe(true);

        postMessage.mockClear();

        inboundHandler?.({ source: "host", command: "getDesktopCommandState" });
        await Promise.resolve();

        expect(postMessage).toHaveBeenCalledWith({
            source: "app",
            command: "desktopCommandStateChanged",
            data: {
                commands: [{
                    id: "app.about",
                    label: "About MySQL Workbench",
                    enabled: true,
                }],
            },
        });

        inboundHandler?.({ source: "host", command: "executeDesktopCommand", data: { id: "app.about" } });
        await Promise.resolve();

        expect(execute).toHaveBeenCalledWith("app.about");

        desktopCommandRegistry.unregisterProvider(provider);
    });
});
