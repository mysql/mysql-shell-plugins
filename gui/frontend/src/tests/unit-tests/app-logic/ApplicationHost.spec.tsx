/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
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

import { mount } from "enzyme";
import { act } from "preact/test-utils";
import React from "react";

import { ApplicationHost } from "../../../app-logic/ApplicationHost";
import { DialogResponseClosure, DialogType, IDialogResponse } from "../../../app-logic/Types";
import { IActivityBarItemProperties, IButtonProperties } from "../../../components/ui";
import { DBEditorModuleId, ShellModuleId } from "../../../modules/ModuleInfo";
import { ModuleRegistry } from "../../../modules/ModuleRegistry";
import { DBEditorModule } from "../../../modules/db-editor/DBEditorModule";
import { ShellModule } from "../../../modules/shell/ShellModule";
import { appParameters, requisitions } from "../../../supplement/Requisitions";
import { webSession } from "../../../supplement/WebSession";

import { eventMock } from "../__mocks__/MockEvents";
import { nextRunLoop, snapshotFromWrapper, stateChange } from "../test-helpers";
import { CommunicationDebugger } from "../../../components/CommunicationDebugger/CommunicationDebugger";

const toggleOptions = (): void => { };

describe("Application host tests", () => {
    it("Base tests", async (): Promise<void> => {
        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        expect(component.props().toggleOptions).toEqual(toggleOptions);
        expect(component.state()).toStrictEqual({
            settingsVisible: false,
            settingsPage: "settings",
            debuggerVisible: false,
            debuggerMaximized: true,
        });

        // No modules loaded/enabled at this point, so we cannot activate one.
        // There's another test below for the case that modules are available.
        const result = await requisitions.execute("showModule", DBEditorModuleId);
        expect(result).toBe(false);

        component.unmount();
    });

    it("Reacts to commands + unmount", async () => {
        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        expect(requisitions.registrations("showAbout")).toBe(1);
        expect(requisitions.registrations("showPreferences")).toBe(1);
        expect(requisitions.registrations("dialogResponse")).toBe(2);
        expect(requisitions.registrations("showModule")).toBe(1);

        await requisitions.execute("showAbout", undefined);
        expect(component.instance().state).toMatchObject({ settingsVisible: true, settingsPage: "about" });

        await requisitions.execute("showPreferences", undefined);
        expect(component.state()).toMatchObject({ settingsVisible: true, settingsPage: "settings" });

        component.unmount();
        expect(requisitions.registrations("showAbout")).toBe(0);
        expect(requisitions.registrations("showPreferences")).toBe(0);
        expect(requisitions.registrations("dialogResponse")).toBe(1);
        expect(requisitions.registrations("showModule")).toBe(0);
    });

    it("Select the first enabled module", () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        expect(component.state().activeModule).toBe(ShellModuleId);
        component.unmount();
    });

    it("Standard Rendering", () => {
        // Registration is a global thing, but if this test runs standalone it will need this extra registration.
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        expect(component.state()).toEqual({
            activeModule: "gui.shell",
            settingsPage: "settings",
            settingsVisible: false,
            debuggerVisible: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering About", async () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        await requisitions.execute("showAbout", undefined);
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        expect(component.state()).toEqual({
            activeModule: "gui.shell",
            settingsPage: "about",
            settingsVisible: true,
            debuggerVisible: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering Preferences", async () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        await requisitions.execute("showPreferences", undefined);
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        expect(component.state()).toEqual({
            activeModule: "gui.shell",
            settingsPage: "settings",
            settingsVisible: true,
            debuggerVisible: false,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Rendering Debugger Normal", () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        component.setState({ debuggerVisible: true, debuggerMaximized: false });
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        expect(component.state()).toEqual({
            activeModule: "gui.shell",
            settingsPage: "settings",
            settingsVisible: false,
            debuggerVisible: true,
            debuggerMaximized: false,
        });

        component.unmount();
    });

    it("Rendering Debugger Maximized", async () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        await stateChange(component, { debuggerVisible: true, debuggerMaximized: true });
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        expect(component.state()).toEqual({
            activeModule: "gui.shell",
            settingsPage: "settings",
            settingsVisible: false,
            debuggerVisible: true,
            debuggerMaximized: true,
        });

        component.unmount();
    });

    it("Activity Item Click", async () => {
        webSession.localUserMode = true;
        appParameters.embedded = false;

        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        let moduleToggleCount = 0;
        const moduleToggled = (_id: string): Promise<boolean> => {
            moduleToggleCount++;

            return Promise.resolve(true);
        };

        requisitions.register("moduleToggle", moduleToggled);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        expect(component.state().debuggerVisible).toBe(false);

        let wrapper = component.find(".activityBarItem#debugger");
        expect(wrapper.length).not.toBe(0);

        let onClick = (wrapper.at(0).props() as IActivityBarItemProperties).onClick;
        await act(() => {
            onClick?.(eventMock, {});
        });

        expect(moduleToggleCount).toBe(0);
        expect(component.state().debuggerVisible).toBe(true);
        expect(component.state().settingsVisible).toBe(false);

        wrapper = component.find(".activityBarItem#settings");
        expect(wrapper.length).not.toBe(0);

        onClick = (wrapper.at(0).props() as IActivityBarItemProperties).onClick;
        await act(() => {
            onClick?.(eventMock, {});
        });

        expect(moduleToggleCount).toBe(0);
        expect(component.state().debuggerVisible).toBe(false);
        expect(component.state().settingsVisible).toBe(true);

        // We cannot find elements with a dot in the ID (like our module buttons have).
        // So we list all items and pick the right one manually.
        wrapper = component.find(".activityBarItem");
        expect(wrapper.length).not.toBe(0);

        onClick = (wrapper.at(0).props() as IActivityBarItemProperties).onClick;
        await act(() => {
            onClick?.(eventMock, {});
        });

        expect(component.state().debuggerVisible).toBe(false);
        expect(component.state().settingsVisible).toBe(false);
        expect(moduleToggleCount).toBe(1);

        component.unmount();

        requisitions.unregister("moduleToggle", moduleToggled);
    });

    it("Debugger State Switches", async () => {
        webSession.localUserMode = true;
        appParameters.embedded = false;

        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );

        // The debugger is always rendered (to allow receiving messages all the time).
        const debugComponent = component.find(CommunicationDebugger);
        expect(debugComponent.length).toBe(1);

        let element = debugComponent.getDOMNode();
        expect(element.parentElement?.classList.contains("stretch")).toBeFalsy();

        await stateChange(component, { debuggerVisible: true, debuggerMaximized: true });

        element = debugComponent.getDOMNode();
        expect(element.parentElement?.classList.contains("stretch")).toBeTruthy();

        const wrapper = component.find(".activityBarItem#debugger"); // Debugger activity bar item.
        expect(wrapper.length).toBeGreaterThan(0);

        const onClick = (wrapper.at(0).props() as IButtonProperties).onClick;
        await act(() => {
            onClick?.(eventMock, {});
        });

        element = debugComponent.getDOMNode();
        expect(element.parentElement?.classList.contains("stretch")).toBeFalsy();

        component.unmount();
    });

    it("Miscellaneous code", async () => {
        ModuleRegistry.registerModule(ShellModule);
        ModuleRegistry.registerModule(DBEditorModule);
        ModuleRegistry.enableModule(ShellModuleId);
        ModuleRegistry.enableModule(DBEditorModuleId);

        const data: IDialogResponse = {
            type: DialogType.Prompt,
            closure: DialogResponseClosure.Accept,
        };
        let result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(false);

        const component = mount<ApplicationHost>(
            <ApplicationHost
                toggleOptions={toggleOptions}
            />,
        );
        await nextRunLoop();

        result = await requisitions.execute("dialogResponse", data);
        expect(result).toBe(true);
        await nextRunLoop();

        result = await requisitions.execute("showModule", DBEditorModuleId);
        expect(result).toBe(true);
        await nextRunLoop();

        component.unmount();
    });
});

