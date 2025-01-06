/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import icon from "../../../../assets/images/modules/module-sql.svg";

import { mount, shallow } from "enzyme";
import { createRef, type ComponentChild } from "preact";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import type { ISqlUpdateResult } from "../../../../app-logic/general-types.js";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import type { IShellProfile, IWebSessionData } from "../../../../communication/ProtocolGui.js";
import type { ISqliteConnectionOptions } from "../../../../communication/Sqlite.js";
import { Button } from "../../../../components/ui/Button/Button.js";
import { Divider } from "../../../../components/ui/Divider/Divider.js";
import { DropdownItem } from "../../../../components/ui/Dropdown/DropdownItem.js";
import { ConnectionDataModel, type ICdmConnectionEntry } from "../../../../data-models/ConnectionDataModel.js";
import { IModuleProperties } from "../../../../modules/ModuleBase.js";
import { DBEditorModuleId } from "../../../../modules/ModuleInfo.js";
import { DBEditorModule, type IDBEditorModuleState } from "../../../../modules/db-editor/DBEditorModule.js";
import type { IDBEditorSideBarSectionState } from "../../../../modules/db-editor/DBEditorSideBar/DBEditorSideBar.js";
import type { DBEditorContextType } from "../../../../modules/db-editor/index.js";
import { appParameters, requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { IExecutionContext, INewEditorRequest, type EditorLanguage } from "../../../../supplement/index.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import { getDbCredentials, nextProcessTick, nextRunLoop, setupShellForTests } from "../../test-helpers.js";

/**
 * This test module exists to isolate the different calls to private methods in the super class.
 * It's necessary to do it this way, because triggering these methods using the built-in handling requires way too
 * much setup and teardown.
 */
class TestDBEditorModule extends DBEditorModule {
    public testSendSqlUpdatesFromModel = async (backend: ShellInterfaceSqlEditor,
        updates: string[]): Promise<ISqlUpdateResult> => {
        // @ts-expect-error Testing private method here.
        return this.sendSqlUpdatesFromModel(backend, updates);
    };

    public testHandleHelpCommand = (command: string, language: EditorLanguage): string | undefined => {
        return this["handleHelpCommand"](command, language);
    };

    public testHandleEditorRename = (id: string, editorId: string, newCaption: string): void => {
        this["handleEditorRename"](id, editorId, newCaption);
    };

    public testHandleAddConnection = (entry: ICdmConnectionEntry): void => {
        this["handleAddConnection"](entry);
    };

    public testHandleUpdateConnection = (entry: ICdmConnectionEntry): void => {
        this["handleUpdateConnection"](entry);
    };

    public dataModel(): ConnectionDataModel {
        return (this.context as DBEditorContextType).connectionsDataModel;
    }

    public override render(): ComponentChild {
        const result = super.render();

        return result;
    }
}

describe("DBEditor module tests", (): void => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let connID: number;

    const credentials = getDbCredentials();
    const dataModel = new ConnectionDataModel();

    const options: IMySQLConnectionOptions = {
        scheme: MySQLConnectionScheme.MySQL,
        user: credentials.userName,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
    };

    const testMySQLConnection: IConnectionDetails = {
        id: -1,
        dbType: DBType.MySQL,
        caption: "DBEditorModule Test Connection 1",
        description: "DBEditorModule Test MyQSL Connection",
        options,
    };

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        backend = new ShellInterfaceSqlEditor();

        launcher = await setupShellForTests(false, true, "DEBUG3");
        testMySQLConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testMySQLConnection, "unit-tests") ?? -1;
        expect(testMySQLConnection.id).toBeGreaterThan(-1);
        connID = testMySQLConnection.id;

        await backend.startSession("dbEditorModuleTests");
        await backend.openConnection(testMySQLConnection.id);
    });

    afterAll(async () => {
        await backend.closeSession();
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connID);
        await launcher.exitProcess();
    });

    it("Test DBEditorModule instantiation", () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = shallow<DBEditorModule>(
            <DBEditorModule
                innerRef={innerRef}
            />,
        );

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

    it("Test DBEditorModule embedded is true scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        expect(DBEditorModule.info).toStrictEqual({
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon,
        });

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const dropDownItemList = component.find(DropdownItem);
        expect(dropDownItemList).toHaveLength(0);

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule selectedPage is 'connections' scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);

        component.setState({ selectedPage: "connections" });
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
        component.setState({ selectedPage: "" });
        await nextProcessTick();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule getDerivedStateFromProps", () => {
        const props: IModuleProperties = {};
        const state: IDBEditorModuleState = {
            selectedPage: "",
            connectionTabs: [],
            documentTabs: [],
            shellSessionTabs: [],
            sidebarState: new Map<string, IDBEditorSideBarSectionState>(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
        };

        const newState = DBEditorModule.getDerivedStateFromProps(props, state);
        expect(newState).toBeDefined();
        expect(newState).toStrictEqual({ selectedPage: "connections" });

    });

    it("Test DBEditorModule adding connection tab", () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const entry = dataModel.createConnectionEntry(testMySQLConnection);
        component.instance().handlePushConnection(entry);

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

    it("Test DBEditorModule function requisitions.openConnectionTab for MySQL", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const initialSelectedPage = instance.state.selectedPage;

        // Open the same page again, but with force set to true, to add a new tab.
        await requisitions.execute("openConnectionTab", {
            connection: dataModel.createConnectionEntry(testMySQLConnection),
            force: true,
            initialEditor: "default",
        });

        const state = instance.state;
        expect(state.selectedPage).toBe(initialSelectedPage);
        component.unmount();
    });

    it("Test DBEditorModule function requisitions.showPage for `connections` page", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: "connections",
            editor: "default",
        });

        const state = instance.state;
        expect(state.selectedPage).toBeDefined();
        expect(state.selectedPage).toEqual("connections");

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.showPage for `other` page", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: "other",
            editor: "default",
        });

        const state = instance.state;
        expect(state.selectedPage).toBeDefined();
        expect(state.selectedPage).toEqual("connections");

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

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const result = await requisitions.execute("editorRunCommand", {
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

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await requisitions.execute("createNewEditor", newEditorRequest);

        expect(instance.state.connectionTabs).toHaveLength(1);
        const editorTab = instance.state.connectionTabs[0];

        expect(editorTab.dataModelEntry.details.options).toStrictEqual(options);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.profileLoaded", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        // Requisition methods (like profileLoaded) cannot really be tested, because they cannot be mocked.
        // And they often only set internal members, to which we have no access. So all we do here is to check
        // that the requisition was executed without errors. See below for more such tests.
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

        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);

        const result = await requisitions.execute("connectionAdded", newTestConnection);
        expect(result).toBe(true);

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

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const result = requisitions.execute("connectionUpdated", newTestConnection);
        await expect(result).resolves.toBe(true);

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

        let result = await requisitions.execute("connectionAdded", newTestConnection);
        expect(result).toBe(true);
        result = await requisitions.execute("connectionRemoved", newTestConnection);
        expect(result).toBe(true);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.refreshConnections", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        const result = await requisitions.execute("refreshConnection", undefined);
        expect(result).toBe(true);

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.webSessionStarted", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const profile: IShellProfile = {
            id: 1,
            userId: 1,
            name: "TestUser",
            description: "Description",
            options: {},
        };

        const webSessionData: IWebSessionData = {
            requestState: { msg: "test message" },
            localUserMode: true,
            activeProfile: profile,
        };

        const result = await requisitions.execute("webSessionStarted", webSessionData);
        expect(result).toBe(true);

        expect(component.instance().state.progressMessage).toBe("Connection opened, creating the editor...");

        component.unmount();
    });

    it("Test DBEditorModule function requisitions.openConnectionTab for Sqlite", async () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const initialSelectedPage = instance.state.selectedPage;

        const sqliteOptions: ISqliteConnectionOptions = {
            dbFile: "testDBEditorModule.sqlite",
            dbName: "main",
        };

        const testSqliteConnection: IConnectionDetails = {
            id: 2, // There's no connection with id 2.
            dbType: DBType.Sqlite,
            caption: "DBEditorModule Test Connection 2",
            description: "DBEditorModule Test Sqlite Connection",
            options: sqliteOptions,
        };

        await requisitions.execute("openConnectionTab", {
            connection: dataModel.createConnectionEntry(testSqliteConnection),
            force: true,
            initialEditor: "default",
        });
        await nextRunLoop();

        const state = instance.state;
        expect(state.selectedPage).toBe(initialSelectedPage);
        component.unmount();
    });

    it("Test DBEditorModule function requisitions.editorRunCommand wrong command scenario", async () => {
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

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        const result = await requisitions.execute("editorRunCommand", {
            command: "wrongCommand",
            context,
        });

        expect(result).toBe(false);

        component.unmount();
    });

    it("Test sendSqlUpdatesFromModel function", async () => {
        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await nextProcessTick();

        const result = await instance.testSendSqlUpdatesFromModel(backend, ["SELECT 1;"]);
        expect(result.affectedRows).toBe(0);

        component.unmount();
    });

    it("Test DBEditorModule handleHelpCommand handler", () => {
        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);
        const instance = component.instance();

        const expectedHelpJavaScript = `The DB Notebook's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value: any): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively.
`;

        const expectedHelpTypeScript = `The DB Notebook's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: unknown): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown[]): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown[]): void\`
      Run the given query and process the rows iteratively.
`;

        const expectedHelpMySQL = `The DB Notebook's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/`;

        let result = instance.testHandleHelpCommand("test command", "javascript");
        expect(result).toBe(expectedHelpJavaScript);

        result = instance.testHandleHelpCommand("test command", "typescript");
        expect(result).toBe(expectedHelpTypeScript);

        result = instance.testHandleHelpCommand("test command", "mysql");
        expect(result).toBe(expectedHelpMySQL);

        component.unmount();
    });

    it("Test DBEditorModule function handleEditorRename", async () => {
        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);
        const instance = component.instance();

        const newEditorRequest: INewEditorRequest = {
            page: "1",
            language: "msg",
        };

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await requisitions.execute("createNewEditor", newEditorRequest);

        expect(instance.state.connectionTabs).toHaveLength(1);
        const editorTab = instance.state.connectionTabs[0];

        expect(editorTab.dataModelEntry.details.options).toStrictEqual(options);

        instance.testHandleEditorRename(editorTab.dataModelEntry.id, String(connID), "newName");

        component.unmount();
    });

    it("Test DBEditorModule handleAddConnection handler", async () => {
        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);
        const instance: TestDBEditorModule = component.instance();

        const testAddMySQLConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "DBEditorModule Test Connection 99",
            description: "DBEditorModule Test MyQSL Connection",
            options,
        };
        const entry = dataModel.createConnectionEntry(testAddMySQLConnection);

        expect(instance.state.connectionTabs).toHaveLength(0);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await nextProcessTick();

        instance.testHandleAddConnection(entry);
        expect(instance.state.connectionTabs).toHaveLength(1);

        component.unmount();
    });

    it("Test DBEditorModule handleUpdateConnection handler", async () => {
        const component = mount<TestDBEditorModule>(<TestDBEditorModule />);
        const instance: TestDBEditorModule = component.instance();

        const testAddMySQLConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "DBEditorModule Test Connection 99",
            description: "DBEditorModule Test MyQSL Connection",
            options,
        };
        const entry = dataModel.createConnectionEntry(testAddMySQLConnection);

        expect(instance.state.connectionTabs).toHaveLength(0);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", {
            module: DBEditorModuleId,
            page: String(connID),
        });

        await nextProcessTick();

        instance.testHandleUpdateConnection(entry);

        component.unmount();
    });

});
