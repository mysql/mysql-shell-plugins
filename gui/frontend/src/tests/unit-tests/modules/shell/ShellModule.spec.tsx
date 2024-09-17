/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

/* eslint-disable dot-notation */

import icon from "../../../../assets/images/modules/module-shell.svg";

import { mount } from "enzyme";
import { createRef } from "preact";

import { waitFor } from "@testing-library/preact";
import { MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { IModuleProperties } from "../../../../modules/ModuleBase.js";
import { ShellModuleId } from "../../../../modules/ModuleInfo.js";
import { ShellModule } from "../../../../modules/shell/ShellModule.js";
import { DBType, IConnectionDetails, IShellSessionDetails } from "../../../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { getDbCredentials, ITestDbCredentials, setupShellForTests } from "../../test-helpers.js";
import { appParameters } from "../../../../supplement/Requisitions.js";

describe("Shell module tests", (): void => {
    let launcher: MySQLShellLauncher;
    let credentials: ITestDbCredentials;
    let testConnection: IConnectionDetails;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG3");

        credentials = getDbCredentials();
        testConnection = {
            id: -1,

            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 1",
            description: "ShellInterfaceDb Test Connection",
            options: {
                scheme: MySQLConnectionScheme.MySQL,
                user: credentials.userName,
                password: credentials.password,
                host: credentials.host,
                port: credentials.port,
            },
            useSSH: false,
            useMDS: false,

        };

        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);
    });

    afterAll(async () => {
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, testConnection.id);
        await launcher.exitProcess();
    });

    it("Test ShellModule instantiation", () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<IModuleProperties>(
            <ShellModule
                innerRef={innerRef}
            />,
        );
        const props = component.props();
        expect(props.innerRef).toEqual(innerRef);
        expect(ShellModule.info).toStrictEqual({
            id: ShellModuleId,
            caption: "Shell",
            icon,
        });
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test ShellModule render", () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<IModuleProperties>(
            <ShellModule
                innerRef={innerRef}
            />,
        );

        const view = component.find("Tabview");
        expect(view.length).toBe(1);
        expect(view.props().id).toBe("shellModuleTabview");

        component.unmount();
    });

    it("Test DBEditorModule embedded is true scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<ShellModule>(
            <ShellModule
                innerRef={innerRef}
            />,
        );

        const shellModuleInstance = component.instance();

        const result = await shellModuleInstance["showPage"]({
            module: ShellModuleId,
            page: "sessions",
        });

        expect(result).toBe(true);

        const view = component.find("Tabview");
        expect(view.length).toBe(1);
        expect(view.props().id).toBe("shellModuleTabview");


        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test ShellModule showPage resolves to false", async () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<ShellModule>(
            <ShellModule
                innerRef={innerRef}
            />,
        );

        const shellModuleInstance = component.instance();

        const result = await shellModuleInstance["showPage"]({
            module: "WrongModuleID",
            page: "sessions",
        });

        expect(result).toBe(false);

        component.unmount();
    });

    it("Test ShellModule showPage resolves to true", async () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<ShellModule>(
            <ShellModule
                innerRef={innerRef}
            />,
        );

        const shellModuleInstance = component.instance();

        const result = await shellModuleInstance["showPage"]({
            module: ShellModuleId,
            page: "sessions",
        });

        expect(result).toBe(true);

        component.unmount();
    });


    it("Test opening and closing tab function", async () => {
        const shellSession: IShellSessionDetails = {
            sessionId: -1,
            description: "Description 1",
            dbConnectionId: testConnection.id,
        };

        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<ShellModule>(
            <ShellModule
                innerRef={innerRef}
            />,
        );

        const shellModuleInstance = component.instance();

        await shellModuleInstance["addTabForNewSession"](shellSession);

        let state = component.state();
        expect(state.pendingConnectionProgress).toStrictEqual("inactive");
        expect(state.shellTabs.length).toStrictEqual(1);
        expect(state.shellTabs[0].id).toStrictEqual("session_1");
        expect(state.shellTabs[0].caption).toMatch(/^Session \d+$/);

        const mockEvent = new MouseEvent("click", { bubbles: true });
        Object.defineProperty(mockEvent, "currentTarget", { value: { id: "session_1" } });

        shellModuleInstance["closeTab"](mockEvent);

        state = component.state();

        await waitFor(() => {
            expect(state.shellTabs.length).toStrictEqual(0);
        }, { timeout: 3000 });

        component.unmount();
    });
});
