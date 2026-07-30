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

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRef } from "preact";
import { render } from "@testing-library/preact";

import { App } from "../../../app-logic/App.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import type { IBackendInformation } from "../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../supplement/WebSession.js";

const backendInformation = (major = 8, minor = 1, patch = 0): IBackendInformation => {
    return {
        architecture: "x64",
        major,
        minor,
        patch,
        platform: "test",
        serverDistribution: "test",
        serverMajor: 8,
        serverMinor: 4,
        serverPatch: 0,
    };
};

describe("Application desktop bootstrap", () => {
    afterEach(() => {
        Reflect.deleteProperty(window, "electronHost");
        Reflect.deleteProperty(window, "electronDesktopBackend");
        webSession.clearSessionData();
        vi.restoreAllMocks();
    });

    it("shows the loading state instead of the multi-user login page in Electron desktop mode", () => {
        Object.defineProperty(window, "electronDesktopBackend", {
            configurable: true,
            value: {
                connect: vi.fn(),
                disconnect: vi.fn(),
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

        const appRef = createRef<App>();
        const { container, unmount } = render(<App ref={appRef} />);

        expect(container.querySelector("#loginDialog")).toBeNull();
        expect(appRef.current?.state.loginInProgress).toBe(true);

        unmount();
    });

    it("does not fall back to the multi-user login page in Electron host mode", () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const appRef = createRef<App>();
        const { container, unmount } = render(<App ref={appRef} />);

        expect(container.querySelector("#loginDialog")).toBeNull();
        expect(appRef.current?.state.loginInProgress).toBe(true);

        unmount();
    });

    it("uses the bootstrapped desktop profile without a second authentication round-trip", async () => {
        Object.defineProperty(window, "electronDesktopBackend", {
            configurable: true,
            value: {
                connect: vi.fn(),
                disconnect: vi.fn(),
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

        const appRef = createRef<App>();
        const { unmount } = render(<App ref={appRef} />);
        vi.spyOn(ShellInterface.core, "backendInformation", "get")
            .mockReturnValue(Promise.resolve(backendInformation()));

        await requisitions.execute("webSessionStarted", {
            requestState: {
                msg: "A new session has been created",
            },
            sessionUuid: "desktop-session",
            localUserMode: true,
            activeProfile: {
                id: 1,
                userId: 7,
                name: "Default",
                description: "",
                options: {},
            },
        });
        await Promise.resolve();

        expect(appRef.current?.state.loginInProgress).toBe(false);

        unmount();
    });

    it("keeps the desktop bootstrap locked when the shell version is unsupported", async () => {
        Object.defineProperty(window, "electronDesktopBackend", {
            configurable: true,
            value: {
                connect: vi.fn(),
                disconnect: vi.fn(),
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
        vi.spyOn(ShellInterface.core, "backendInformation", "get")
            .mockReturnValue(Promise.resolve(backendInformation(8, 0, 0)));

        const appRef = createRef<App>();
        const { unmount } = render(<App ref={appRef} />);
        const showErrorMessage = vi.spyOn(appRef.current!, "showErrorMessage");

        await requisitions.execute("webSessionStarted", {
            requestState: {
                msg: "A new session has been created",
            },
            sessionUuid: "desktop-session",
            localUserMode: true,
            activeProfile: {
                id: 1,
                userId: 7,
                name: "Default",
                description: "",
                options: {},
            },
        });
        await Promise.resolve();

        expect(appRef.current?.state.loginInProgress).toBe(true);
        expect(showErrorMessage).toHaveBeenCalledWith("The connected shell has an unsupported version: 8.0.0", {});

        unmount();
    });
});
