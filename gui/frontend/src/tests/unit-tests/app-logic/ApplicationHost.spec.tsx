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

/* eslint-disable @typescript-eslint/no-empty-function */

import { mount, shallow } from "enzyme";

import ApplicationHost from "../../../app-logic/ApplicationHost.js";
import { DialogResponseClosure, DialogType, IDialogResponse } from "../../../app-logic/general-types.js";
import { appParameters } from "../../../supplement/AppParameters.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { RunMode, webSession } from "../../../supplement/WebSession.js";

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { ignoreSnapshotUuids, nextRunLoop, stateChange } from "../test-helpers.js";

describe("Application host tests", () => {
    beforeAll(() => {
        appParameters.launchWithDebugger = true;
        registerUiLayer(uiLayerMock);
    });


    afterAll(() => {
        appParameters.launchWithDebugger = false;
    });

    it("Reacts to commands + unmount", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        expect(requisitions.registrations("showAbout")).toBe(1);
        expect(requisitions.registrations("showPreferences")).toBe(1);

        await requisitions.execute("showAbout", undefined);
        expect(component.instance().state).toMatchObject({ settingsVisible: false, aboutVisible: true });

        await requisitions.execute("showPreferences", undefined);
        expect(component.state()).toMatchObject({ settingsVisible: true, aboutVisible: false });

        component.unmount();
        expect(requisitions.registrations("showAbout")).toBe(0);
        expect(requisitions.registrations("showPreferences")).toBe(0);
    });

    it("Standard Rendering", () => {
        const component = shallow<ApplicationHost>(
            <ApplicationHost />,
        );

        expect(component).toMatchSnapshot();
        expect(component.state()).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering About", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        await requisitions.execute("showAbout", undefined);

        ignoreSnapshotUuids();

        expect(component).toMatchSnapshot();
        expect(component.state()).toEqual({
            aboutVisible: true,
            settingsVisible: false,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering Preferences", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        await requisitions.execute("showPreferences", undefined);

        expect(component).toMatchSnapshot();
        expect(component.state()).toEqual({
            aboutVisible: false,
            settingsVisible: true,
            debuggerVisible: false,
            debuggerEnabledInBackground: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering Debugger Normal", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        await stateChange(component, {
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: false,
        });

        expect(component).toMatchSnapshot();
        expect(component.state()).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: false,
        });

        component.unmount();
    });

    it("Rendering Debugger Maximized", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        await stateChange(component, {
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: true,
        });

        expect(component).toMatchSnapshot();
        expect(component.state()).toEqual({
            aboutVisible: false,
            settingsVisible: false,
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Debugger State Switches", async () => {
        webSession.runMode = RunMode.LocalUser;
        appParameters.embedded = false;

        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );

        const id = "debuggerPaneHost";

        // The debugger is only mounted when first activated (to allow receiving messages in background later on).
        let debugComponent = component.find(`#${id}`);
        expect(debugComponent.length).toBe(0);

        await stateChange(component, {
            debuggerVisible: true,
            debuggerEnabledInBackground: true,
            debuggerMaximized: true,
        });

        debugComponent = component.find(`#${id}`);

        const element = debugComponent.last().getDOMNode();
        expect(element?.getAttribute("id")).toEqual(id);
        expect(element?.classList.contains("stretch")).toBeTruthy();

        component.unmount();
    });

    it("Miscellaneous code", async () => {
        const data: IDialogResponse = {
            type: DialogType.Prompt,
            id: "appHostSpec",
            closure: DialogResponseClosure.Accept,
        };
        let result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(false);

        const component = mount<ApplicationHost>(
            <ApplicationHost />,
        );
        await nextRunLoop();

        result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(false);
        await nextRunLoop();

        component.unmount();
    });
});
