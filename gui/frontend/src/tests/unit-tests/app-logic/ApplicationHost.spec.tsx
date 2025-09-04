/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { act, render } from "@testing-library/preact";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import ApplicationHost from "../../../app-logic/ApplicationHost.js";
import { DialogResponseClosure, DialogType, IDialogResponse } from "../../../app-logic/general-types.js";
import { appParameters } from "../../../supplement/AppParameters.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { RunMode, webSession } from "../../../supplement/WebSession.js";

import { createRef } from "preact";
import { registerUiLayer } from "../../../app-logic/UILayer.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { nextRunLoop } from "../test-helpers.js";

describe("Application host tests", () => {
    beforeAll(() => {
        appParameters.launchWithDebugger = true;
        registerUiLayer(uiLayerMock);
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

        const [[_, element]] = debugComponent.entries();
        expect(element.getAttribute("id")).toEqual(id);
        expect(element.classList.contains("stretch")).toBeTruthy();

        unmount();
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
