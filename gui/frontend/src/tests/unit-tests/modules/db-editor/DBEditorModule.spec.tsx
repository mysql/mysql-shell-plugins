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


import icon from "../../../../assets/images/modules/module-sql.svg";

import { createRef } from "preact";
import { mount } from "enzyme";

import { DBEditorModuleId } from "../../../../modules/ModuleInfo.js";
import {
    IDBEditorModuleState,
    IDBEditorTabInfo,
    DBEditorModule,
} from "../../../../modules/db-editor/DBEditorModule.js";
import { appParameters, requisitions } from "../../../../supplement/Requisitions.js";
import { Button } from "../../../../components/ui/Button/Button.js";
import { Divider } from "../../../../components/ui/Divider/Divider.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { Dropdown } from "../../../../components/ui/Dropdown/Dropdown.js";
import { getDbCredentials, nextProcessTick, nextRunLoop, setupShellForTests } from "../../test-helpers.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import {
    IMySQLConnectionOptions,
    MySQLConnectionScheme,
} from "../../../../communication/MySQL.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { IModuleProperties } from "../../../../modules/ModuleBase.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { IExecutionContext, INewEditorRequest } from "../../../../supplement/index.js";
import { sleep } from "../../../../utilities/helpers.js";

describe("DBEditor module tests", (): void => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let connID: number;
    const credentials = getDbCredentials();

    const options: IMySQLConnectionOptions = {
        scheme: MySQLConnectionScheme.MySQL,
        user: credentials.userName,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
    };

    const testConnection: IConnectionDetails = {
        id: -1,
        dbType: DBType.MySQL,
        caption: "DBEditorModule Test Connection 1",
        description: "DBEditorModule Test Connection",
        options,
    };

    beforeAll(async () => {
        backend = new ShellInterfaceSqlEditor();

        launcher = await setupShellForTests(false, true, "DEBUG2");
        testConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testConnection, "unit-tests") ?? -1;
        expect(testConnection.id).toBeGreaterThan(-1);
        connID = testConnection.id;

        await backend.startSession("dbEditorModuleTests");
        await backend.openConnection(testConnection.id);
    });

    afterAll(async () => {
        await backend.closeSession();
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connID);
        await launcher.exitProcess();
    });

    it("Test DBEditorModule instantiation", () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<DBEditorModule>(
            <DBEditorModule
                innerRef={innerRef}
            />,
        );
        const props = component.props();
        expect(props.innerRef).toEqual(innerRef);
        expect(DBEditorModule.info).toStrictEqual({
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon,
        });
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBEditorModule get info", () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const info = DBEditorModule.info;
        expect(info.id).toBe(DBEditorModuleId);
        expect(info.caption).toBe("DB Editor");
        expect(info.icon).toBeDefined();
        component.unmount();
    });

    it("Test DBEditorModule embedded is true scenario", () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        expect(DBEditorModule.info).toStrictEqual({
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon,
        });

        const dropDownItemList = component.find(Dropdown.Item);
        expect(dropDownItemList).toHaveLength(0);

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule selectedPage is 'connections' scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const toolbarItems = {
            navigation: [],
        };
        component.setState({ selectedPage: "connections", toolbarItems });
        await nextProcessTick();

        const button = component.find(Button).at(0);
        expect(button).toBeDefined();

        const divider = component.find(Divider);
        expect(divider).toBeDefined();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });


    it("Test DBEditorModule selectedPage is empty", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const toolbarItems = {
            navigation: [],
        };
        component.setState({ selectedPage: "", toolbarItems });
        await nextProcessTick();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule editorTabs are not empty scenario", () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;

        const connection1: IConnectionDetails = {
            id: 1,
            dbType: DBType.MySQL,
            caption: "Mysql1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const connection2: IConnectionDetails = {
            id: 2,
            dbType: DBType.Sqlite,
            caption: "Sqlite1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const editorTabs: IDBEditorTabInfo[] = [
            { tabId: "tab1", caption: "Tab 1", details: connection1, suppressAbout: false },
            { tabId: "tab2", caption: "Tab 2", details: connection2, suppressAbout: false },
        ];

        const component = mount<DBEditorModule>(<DBEditorModule/>);

        const instance = component.instance();
        instance.setState({ editorTabs, connections: [connection1, connection2] });

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule handlePushConnection", () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;

        const connection1: IConnectionDetails = {
            id: 1,
            dbType: DBType.MySQL,
            caption: "Mysql1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const connection2: IConnectionDetails = {
            id: 2,
            dbType: DBType.Sqlite,
            caption: "Sqlite1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const component = mount<DBEditorModule>(<DBEditorModule />);

        const instance = component.instance();
        instance.handlePushConnection(connection1);
        instance.handlePushConnection(connection2);

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule getDerivedStateFromProps", () => {
        const props: IModuleProperties = {};
        const state: IDBEditorModuleState = {
            selectedPage: "",
            editorTabs: [],
            connections: [],
            dirtyEditors: new Set<string>(),
            showExplorer: false,
            showTabs: false,
            connectionsLoaded: false,
            loading: false,
            progressMessage: "",

        };

        const newState = DBEditorModule.getDerivedStateFromProps(props, state);
        expect(newState).toBeDefined();
        expect(newState).toStrictEqual({ selectedPage: "connections" });

    });

    it("Test DBEditorModule adding connection tab", () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        component.instance().handlePushConnection(testConnection);

        const docSelector = document.getElementById("documentSelector");
        expect(docSelector).toBeDefined();
        const closeButton = document.getElementById("itemCloseButton");
        expect(closeButton).toBeDefined();

        component.unmount();
    });

    it("Test DBEditorModule componentDidMount and componentWillUnmount", () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        component.instance().componentDidMount();
        component.instance().componentWillUnmount();

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.sqlSetCurrentSchema", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await requisitions.execute("sqlSetCurrentSchema", {
            id: "",
            connectionId: 1,
            schema: "mysql",
        });

        const state = instance.state;
        expect(state).toBeDefined();
        expect(state.editorTabs).toBeDefined();
        expect(state.editorTabs[0].details.options).toStrictEqual(options);
        component.unmount();
    });

    it("Test DBEditorModule function requisitions.openConnectionTab", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const initialSelectedPage = instance.state.selectedPage;

        await requisitions.execute("openConnectionTab", {
            details: testConnection,
            force: true,
            initialEditor: "default",
        });

        const state = instance.state;
        expect(state).toBeDefined();
        expect(state.selectedPage).not.toBe(initialSelectedPage);
        component.unmount();
    });

    it("Test DBEditorModule function requisitions.showPage for `connections` page", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: "connections",
            noEditor: false,
        });

        const state = instance.state;
        expect(state).toBeDefined();
        expect(state.selectedPage).toBeDefined();
        expect(state.selectedPage).toEqual("connections");

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.showPage for `other` page", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: "other",
            noEditor: false,
        });

        const state = instance.state;
        expect(state).toBeDefined();
        expect(state.selectedPage).toBeDefined();
        expect(state.selectedPage).toEqual("connections");

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.moduleToggle", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        let state = instance.state;
        expect(state).toBeDefined();
        const showExplorer = state.showExplorer;

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });


        await requisitions.execute("moduleToggle", DBEditorModuleId);

        state = instance.state;
        expect(state).toBeDefined();
        expect(state.showExplorer).toBeDefined();
        expect(state.showExplorer).toEqual(!showExplorer);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.editorShowConnections", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        let state = instance.state;
        const initialSelectedPage = state.selectedPage;

        await requisitions.execute("openConnectionTab", {
            details: testConnection,
            force: true,
            initialEditor: "default",
        });

        state = instance.state;
        expect(state.selectedPage).not.toBe(initialSelectedPage);

        await requisitions.execute("editorShowConnections", null);

        state = instance.state;
        expect(state.selectedPage).toEqual("connections");
        expect(state.progressMessage).toEqual("Connection opened, creating the editor...");

        component.unmount();
    });


    it("Test DBEditorModule function requisitions.editorRunCommand", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const context: IExecutionContext = {
            id: "test",
            code: "SELECT * FROM test",
            codeLength: 1,
            language: "sql",
            isSQLLike: true,
            linkId: 1,
            endLine: 1,
            startLine: 1,
            isInternal: false,
            fullRange: undefined,
        };

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const result =  await requisitions.execute("editorRunCommand", {
            command: "sendBlockUpdates",
            context,
        });

        expect(result).toBe(true);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.createNewEditor", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        const newEditorRequest: INewEditorRequest = {
            page: "1",
            language: "msg",
        };

        expect(instance.state.connections).toHaveLength(0);

        await requisitions.execute("refreshConnections", undefined);

        expect(instance.state.connections).toHaveLength(1);

        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await requisitions.execute("createNewEditor", newEditorRequest);

        expect(instance.state.connections).toHaveLength(1);
        expect(instance.state.editorTabs).toHaveLength(1);
        const editorTab = instance.state.editorTabs[0];

        expect(editorTab.details.options).toStrictEqual(options);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.profileLoaded", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        const result = await requisitions.execute("profileLoaded", null);

        expect(result).toBe(true);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.connectionAdded", async () => {
        const credentials = getDbCredentials();

        const options: IMySQLConnectionOptions = {
            scheme: MySQLConnectionScheme.MySQL,
            user: credentials.userName,
            password: credentials.password,
            host: credentials.host,
            port: credentials.port,
        };

        const newTestConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "DBEditorModule Test Connection 2",
            description: "DBEditorModule Test Connection 2",
            options,
        };

        const component = mount<DBEditorModule>(<DBEditorModule />);

        let state = component.instance().state;
        expect(state.connections).toHaveLength(0);

        const result = await requisitions.execute("connectionAdded", newTestConnection);
        expect(result).toBe(true);

        state = component.instance().state;
        expect(state.connections).toHaveLength(1);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.connectionUpdated", async () => {
        const newTestConnection: IConnectionDetails = {
            id: connID,
            dbType: DBType.MySQL,
            caption: "ShellInterfaceDb Test Connection 2",
            description: "ShellInterfaceDb Test Connection 2",
            options,
        };

        const component = mount<DBEditorModule>(<DBEditorModule />);

        let state = component.instance().state;
        expect(state.connections).toHaveLength(0);

        await requisitions.execute("refreshConnections", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        state = component.instance().state;
        expect(state.connections).toHaveLength(1);

        const result = requisitions.execute("connectionUpdated", newTestConnection);

        await expect(result).resolves.toBe(true);
        state = component.instance().state;
        expect(state.connections).toHaveLength(1);
        expect(state.connections[0].caption).toEqual(newTestConnection.caption);
        expect(state.connections[0].description).toEqual(newTestConnection.description);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.connectionRemoved", async () => {
        const newOptions: IMySQLConnectionOptions = {
            scheme: MySQLConnectionScheme.MySQL,
            user: "user1",
            password: "",
            host: "localhost",
            port: 3301,
        };

        const newTestConnection: IConnectionDetails = {
            id: 2,
            dbType: DBType.MySQL,
            caption: "DBEditorModule Test Connection 2",
            description: "DBEditorModule Test Connection 2",
            options: newOptions,
        };

        const component = mount<DBEditorModule>(<DBEditorModule />);

        let state = component.instance().state;
        expect(state.connections).toHaveLength(0);

        await requisitions.execute("connectionAdded", newTestConnection);

        state = component.instance().state;
        expect(state.connections).toHaveLength(1);

        const result = await requisitions.execute("connectionRemoved", newTestConnection);
        expect(result).toBe(true);

        await nextRunLoop();
        await sleep(500);

        state = component.instance().state;
        expect(state.connections).toHaveLength(0);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.refreshConnections", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        let state = component.instance().state;
        expect(state.connections).toHaveLength(0);

        const result = requisitions.execute("refreshConnections", undefined);

        await expect(result).resolves.toBe(true);
        state = component.instance().state;
        expect(state.connections).toHaveLength(1);

        component.unmount();
    });
});
