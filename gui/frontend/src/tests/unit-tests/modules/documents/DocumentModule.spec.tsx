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

import { mount, shallow } from "enzyme";
import { type ComponentChild } from "preact";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import type { IShellProfile, IWebSessionData } from "../../../../communication/ProtocolGui.js";
import type { ISqliteConnectionOptions } from "../../../../communication/Sqlite.js";
import { Button } from "../../../../components/ui/Button/Button.js";
import { Divider } from "../../../../components/ui/Divider/Divider.js";
import { DropdownItem } from "../../../../components/ui/Dropdown/DropdownItem.js";
import { ConnectionDataModel, type ICdmConnectionEntry } from "../../../../data-models/ConnectionDataModel.js";
import { DocumentModule, type IDocumentModuleState } from "../../../../modules/db-editor/DocumentModule.js";
import type { IDocumentSideBarSectionState } from "../../../../modules/db-editor/DocumentSideBar/DocumentSideBar.js";
import type { DocumentContextType } from "../../../../modules/db-editor/index.js";
import { appParameters } from "../../../../supplement/AppParameters.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { IExecutionContext, INewEditorRequest, type EditorLanguage } from "../../../../supplement/index.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import {
    getDbCredentials, ignoreSnapshotUuids, nextProcessTick, nextRunLoop,
    setupShellForTests,
} from "../../test-helpers.js";
import { sendSqlUpdatesFromModel } from "../../../../modules/db-editor/SqlQueryExecutor.js";

/**
 * This test module exists to isolate the different calls to private methods in the super class.
 * It's necessary to do it this way, because triggering these methods using the built-in handling requires way too
 * much setup and teardown.
 */
class TestDocumentModule extends DocumentModule {
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
        return (this.context as DocumentContextType).connectionsDataModel;
    }

    public override render(): ComponentChild {
        const result = super.render();

        return result;
    }
}

describe("Document module tests", (): void => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let connectionId: number;

    const credentials = getDbCredentials();
    const dataModel = new ConnectionDataModel(false);

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
        caption: "DocumentModule Test Connection 1",
        description: "DocumentModule Test MyQSL Connection",
        options,
        folderPath: "/",
        index: -1,
    };

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        backend = new ShellInterfaceSqlEditor();

        launcher = await setupShellForTests(false, true, "DEBUG3");
        const connectionResult = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testMySQLConnection);
        testMySQLConnection.id = Array.isArray(connectionResult) ? connectionResult[0] : -1;
        expect(testMySQLConnection.id).toBeGreaterThan(-1);
        connectionId = testMySQLConnection.id;

        await backend.startSession("DocumentModuleTests");
        await backend.openConnection(testMySQLConnection.id);
    });

    afterAll(async () => {
        await backend.closeSession();
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connectionId);
        await launcher.exitProcess();
    });

    it("Test DocumentModule instantiation", () => {
        const component = shallow<DocumentModule>(
            <DocumentModule />,
        );

        ignoreSnapshotUuids();

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DocumentModule embedded is true scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DocumentModule>(<DocumentModule />);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        const dropDownItemList = component.find(DropdownItem);
        expect(dropDownItemList).toHaveLength(0);

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DocumentModule selectedPage is 'connections' scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DocumentModule>(<DocumentModule />);

        await nextProcessTick();

        const button = component.find(Button).at(0);
        expect(button).toBeDefined();

        const divider = component.find(Divider);
        expect(divider).toBeDefined();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DocumentModule getDerivedStateFromProps", () => {
        const overviewId = "abc-def";
        const state: IDocumentModuleState = {
            selectedPage: "",
            connectionTabs: [],
            documentTabs: [],
            shellSessionTabs: [],
            sidebarState: new Map<string, IDocumentSideBarSectionState>(),
            showSidebar: false,
            showTabs: true,
            loading: false,
            progressMessage: "",
            overviewId,
        };

        const newState = DocumentModule.getDerivedStateFromProps({}, state);
        expect(newState).toBeDefined();
        expect(newState).toStrictEqual({ selectedPage: overviewId });

    });

    it("Test DocumentModule adding connection tab", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const entry = dataModel.createConnectionEntry(testMySQLConnection);
        await component.instance().handlePushConnection(entry);

        const docSelector = document.getElementById("documentSelector");
        expect(docSelector).toBeDefined();
        const closeButton = document.getElementById("itemCloseButton");
        expect(closeButton).toBeDefined();

        component.unmount();
    });

    it("Test DocumentModule function requisitions.openConnectionTab for MySQL", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        const initialSelectedPage = instance.state.selectedPage;

        // Open the same page again, but with force set to true, to add a new tab.
        await requisitions.execute("openConnectionTab", {
            connection: dataModel.createConnectionEntry(testMySQLConnection),
            force: true,
            initialEditor: "default",
        });

        const state = instance.state;

        // The selectedPage is expected to change, but its ID (actually now UUID) is generated
        // within DBEditorModule::activateConnectionTab, so we cannot assert its exact value here.
        expect(state.selectedPage).not.toBe(initialSelectedPage);
        component.unmount();
    });

    it("Test DocumentModule function requisitions.showPage for `connections` page", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { editor: "default" });

        const state = instance.state;
        expect(state.selectedPage).toBeDefined();
        expect(state.selectedPage).toEqual(state.overviewId);

        component.unmount();
    });

    it("Test DocumentModule function requisitions.showPage for `other` page", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { editor: "default" });
        const state = instance.state;

        await requisitions.execute("showPage", { connectionId: 999, editor: "default" }); // Connection does not exist.
        expect(state.selectedPage).toBeDefined();
        expect(instance.state.selectedPage).toEqual(state.overviewId);

        await requisitions.execute("showPage", { pageId: "abc-def", editor: "default" }); // Connection does not exist.
        expect(state.selectedPage).toBeDefined();
        expect(instance.state.selectedPage).toEqual(state.overviewId);

        component.unmount();
    });

    it("Test DocumentModule function requisitions.createNewEditor", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const instance = component.instance();

        const newEditorRequest: INewEditorRequest = {
            connectionId: 1,
            language: "msg",
        };

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });
        await requisitions.execute("createNewEditor", newEditorRequest);

        expect(instance.state.connectionTabs).toHaveLength(1);
        const editorTab = instance.state.connectionTabs[0];

        expect(editorTab.dataModelEntry.details.options).toStrictEqual(options);

        component.unmount();
    });

    it("Test DocumentModule function requisitions.webSessionStarted", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

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
            singleServerMode: false,
            activeProfile: profile,
        };

        const result = await requisitions.execute("webSessionStarted", webSessionData);
        expect(result).toBe(true);

        expect(component.instance().state.progressMessage).toBe("Connection opened, creating the editor...");

        component.unmount();
    });

    it("Test DocumentModule function requisitions.openConnectionTab for Sqlite", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
        const instance = component.instance();

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        const initialSelectedPage = instance.state.selectedPage;

        const sqliteOptions: ISqliteConnectionOptions = {
            dbFile: "testDocumentModule.sqlite",
            dbName: "main",
        };

        const testSqliteConnection: IConnectionDetails = {
            id: 2, // There's no connection with id 2.
            dbType: DBType.Sqlite,
            caption: "DocumentModule Test Connection 2",
            description: "DocumentModule Test Sqlite Connection",
            options: sqliteOptions,
            folderPath: "/",
            index: -1,
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

    it("Test DocumentModule function requisitions.editorRunCommand wrong command scenario", async () => {
        const component = mount<DocumentModule>(<DocumentModule />);
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
        await requisitions.execute("showPage", { connectionId });

        const result = await requisitions.execute("editorRunCommand", {
            command: "wrongCommand",
            context,
        });

        expect(result).toBe(false);

        component.unmount();
    });

    it("Test sendSqlUpdatesFromModel function", async () => {
        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        await nextProcessTick();

        const result = await sendSqlUpdatesFromModel(undefined, backend, ["SELECT 1;"]);
        expect(result.affectedRows).toBe(0);
    });

    it("Test DocumentModule handleHelpCommand handler", () => {
        const component = mount<TestDocumentModule>(<TestDocumentModule />);
        const instance = component.instance();

        const expectedHelpJavaScript = `The DB Notebook's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value)\`
      Send a value to the output area.
    - \`async runSql(code, params?), params?)\`
      Run the given query and wait for the returned promise to resolve when done.
    - \`runSqlWithCallback(sql, callback?, params?)\`
      Run the query and process the rows in the given callback, once all are received.
    - \`runSqlIterative(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively as they arrive.
`;

        const expectedHelpTypeScript = `The DB Notebook's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: unknown): void\`
      Send a value to the output area.
    - \`async runSql(code: string, params?: unknown), params?: unknown[]): Promise<unknown>\`
      Run the given query and wait for the returned promise to resolve when done.
    - \`runSqlWithCallback(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
    Run the query and process the rows in the given callback, once all are received.
    - \`runSqlIterative(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively as they arrive.
`;

        const expectedHelpMySQL = `The DB Notebook's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/
`;

        let result = instance.testHandleHelpCommand("test command", "javascript");
        expect(result).toBe(expectedHelpJavaScript);

        result = instance.testHandleHelpCommand("test command", "typescript");
        expect(result).toBe(expectedHelpTypeScript);

        result = instance.testHandleHelpCommand("test command", "mysql");
        expect(result).toBe(expectedHelpMySQL);

        component.unmount();
    });

    it("Test DocumentModule function handleEditorRename", async () => {
        const component = mount<TestDocumentModule>(<TestDocumentModule />);
        const instance = component.instance();

        const newEditorRequest: INewEditorRequest = {
            connectionId: 1,
            language: "msg",
        };

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        await requisitions.execute("createNewEditor", newEditorRequest);

        expect(instance.state.connectionTabs).toHaveLength(1);
        const editorTab = instance.state.connectionTabs[0];

        expect(editorTab.dataModelEntry.details.options).toStrictEqual(options);

        instance.testHandleEditorRename(editorTab.dataModelEntry.id, String(connectionId), "newName");

        component.unmount();
    });

    it("Test DocumentModule handleAddConnection handler", async () => {
        const component = mount<TestDocumentModule>(<TestDocumentModule />);
        const instance: TestDocumentModule = component.instance();

        const testAddMySQLConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "DocumentModule Test Connection 99",
            description: "DocumentModule Test MyQSL Connection",
            options,
            folderPath: "/",
            index: -1,
        };
        const entry = dataModel.createConnectionEntry(testAddMySQLConnection);

        expect(instance.state.connectionTabs).toHaveLength(0);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        await nextProcessTick();

        instance.testHandleAddConnection(entry);
        expect(instance.state.connectionTabs).toHaveLength(1);

        component.unmount();
    });

    it("Test DocumentModule handleUpdateConnection handler", async () => {
        const component = mount<TestDocumentModule>(<TestDocumentModule />);
        const instance: TestDocumentModule = component.instance();

        const testAddMySQLConnection: IConnectionDetails = {
            id: -1,
            dbType: DBType.MySQL,
            caption: "DocumentModule Test Connection 99",
            description: "DocumentModule Test MyQSL Connection",
            options,
            folderPath: "/",
            index: -1,
        };
        const entry = dataModel.createConnectionEntry(testAddMySQLConnection);

        expect(instance.state.connectionTabs).toHaveLength(0);

        await requisitions.execute("refreshConnection", undefined);
        await requisitions.execute("showPage", { connectionId });

        await nextProcessTick();

        instance.testHandleUpdateConnection(entry);

        component.unmount();
    });

});
