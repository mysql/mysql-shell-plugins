/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import { act, cleanup, fireEvent, render } from "@testing-library/preact";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../utilities/helpers.js", async () => {
    const actual = await vi.importActual("../../../utilities/helpers.js");

    return {
        ...actual,
        isStandalone: vi.fn(() => false),
    };
});

import ApplicationHost from "../../../app-logic/ApplicationHost.js";
import { DialogResponseClosure, DialogType, IDialogResponse } from "../../../app-logic/general-types.js";
import { desktopCommandRegistry } from "../../../supplement/DesktopCommandRegistry.js";
import { appParameters } from "../../../supplement/AppParameters.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { RunMode, webSession } from "../../../supplement/WebSession.js";
import { isStandalone } from "../../../utilities/helpers.js";

import { createRef } from "preact";
import { registerUiLayer } from "../../../app-logic/UILayer.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { nextRunLoop } from "../test-helpers.js";

describe("Application host tests", () => {
    beforeAll(() => {
        appParameters.launchWithDebugger = true;
        registerUiLayer(uiLayerMock);
    });

    beforeEach(() => {
        vi.mocked(isStandalone).mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
        Reflect.deleteProperty(window, "electronHost");
    });

    afterAll(() => {
        appParameters.launchWithDebugger = false;
    });

    it("Reacts to commands + unmount", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        expect(requisitions.registrations("showAbout")).toBe(1);
        expect(requisitions.registrations("showPreferences")).toBe(1);

        await requisitions.execute("showAbout", undefined);
        expect(hostRef.current!.state).toMatchObject({ settingsVisible: false, aboutVisible: true });

        await requisitions.execute("showPreferences", undefined);
        expect(hostRef.current!.state).toMatchObject({ settingsVisible: true, aboutVisible: false });

        unmount();
        expect(requisitions.registrations("showAbout")).toBe(0);
        expect(requisitions.registrations("showPreferences")).toBe(0);
    });

    it("Standard Rendering", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        expect(container).toMatchSnapshot();
        expect(hostRef.current!.state).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        unmount();
    });

    it("Rendering About", async () => {
        vi.mocked(isStandalone).mockReturnValue(false);

        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await requisitions.execute("showAbout", undefined);

        expect(container).toMatchSnapshot();
        expect(hostRef.current!.state).toEqual({
            aboutVisible: true,
            settingsVisible: false,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        unmount();
    });

    it("Rendering Workbench About", async () => {
        Object.defineProperty(window, "electronHost", {
            configurable: true,
            value: {
                postMessage: vi.fn(),
            },
        });

        const hostRef = createRef<ApplicationHost>();
        const { getByText, queryByText, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await requisitions.execute("showAbout", undefined);

        expect(getByText("MySQL Workbench")).toBeTruthy();
        expect(queryByText("powered by MySQL Shell")).toBeNull();

        unmount();
    });

    it("Rendering Preferences", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await requisitions.execute("showPreferences", undefined);

        expect(container).toMatchSnapshot();
        expect(hostRef.current!.state).toEqual({
            aboutVisible: false,
            settingsVisible: true,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        unmount();
    });

    it("closes preferences from the settings back button", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await requisitions.execute("showPreferences", undefined);
        expect(hostRef.current!.state.settingsVisible).toBe(true);

        await act(async () => {
            fireEvent.click(container.querySelector("#settingsBackButton")!);
        });

        expect(hostRef.current!.state).toMatchObject({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: false,
        });

        unmount();
    });

    it("Rendering Debugger Normal", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await act(() => {
            hostRef.current!.setState({
                debuggerVisible: true,
                debuggerEnabledInBackground: true,
                debuggerMaximized: false,
            });
        });

        expect(container).toMatchSnapshot();
        expect(hostRef.current!.state).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: false,
        });

        unmount();
    });

    it("Rendering Debugger Maximized", async () => {
        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        await act(() => {
            hostRef.current!.setState({
                debuggerVisible: true,
                debuggerEnabledInBackground: true,
                debuggerMaximized: true,
            });
        });

        expect(container).toMatchSnapshot();
        expect(hostRef.current!.state).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: true,
        });

        unmount();
    });

    it("Debugger State Switches", async () => {
        webSession.runMode = RunMode.LocalUser;
        appParameters.embedded = false;

        const hostRef = createRef<ApplicationHost>();
        const { container, unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        const id = "debuggerPaneHost";

        // The debugger is only mounted when first activated (to allow receiving messages in background later on).
        let debugComponent = container.querySelectorAll(`#${id}`);
        expect(debugComponent.length).toBe(0);

        await act(() => {
            hostRef.current?.setState({
                debuggerVisible: true,
                debuggerEnabledInBackground: true,
                debuggerMaximized: true,
            });
        });

        debugComponent = container.querySelectorAll(`#${id}`);
        expect(debugComponent.length).toBe(1);

        const [firstEntry] = debugComponent.entries();
        expect(firstEntry[1].getAttribute("id")).toEqual(id);
        expect(firstEntry[1].classList.contains("stretch")).toBeTruthy();

        unmount();
    });

    it("exposes desktop app commands through the registry", async () => {
        const originalRunMode = webSession.runMode;
        const originalEmbedded = appParameters.embedded;
        webSession.runMode = RunMode.LocalUser;
        appParameters.embedded = false;

        const hostRef = createRef<ApplicationHost>();
        const { unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );

        await nextRunLoop();

        const initialState = desktopCommandRegistry.getState();
        expect(initialState.find((entry) => entry.id === "app.about")?.enabled).toBe(true);
        expect(initialState.find((entry) => entry.id === "app.preferences")?.enabled).toBe(true);
        expect(initialState.find((entry) => entry.id === "dev.toggleDebugger")).toMatchObject({
            enabled: true,
            checked: false,
        });

        expect(await desktopCommandRegistry.execute("app.about")).toBe(true);
        expect(hostRef.current!.state.aboutVisible).toBe(true);

        expect(await desktopCommandRegistry.execute("app.preferences")).toBe(true);
        expect(hostRef.current!.state.settingsVisible).toBe(true);

        expect(await desktopCommandRegistry.execute("dev.toggleDebugger")).toBe(true);
        expect(hostRef.current!.state.debuggerVisible).toBe(true);
        expect(desktopCommandRegistry.getState().find((entry) => entry.id === "dev.toggleDebugger")).toMatchObject({
            enabled: true,
            checked: true,
        });

        unmount();
        webSession.runMode = originalRunMode;
        appParameters.embedded = originalEmbedded;
    });

    it("Miscellaneous code", async () => {
        const data: IDialogResponse = {
            type: DialogType.Prompt,
            id: "appHostSpec",
            closure: DialogResponseClosure.Accept,
        };
        let result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(false);

        const hostRef = createRef<ApplicationHost>();
        const { unmount } = render(
            <ApplicationHost ref={hostRef} />,
        );
        await nextRunLoop();
        expect(hostRef.current).toBeDefined();

        result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(false);
        await nextRunLoop();

        unmount();
    });
});
