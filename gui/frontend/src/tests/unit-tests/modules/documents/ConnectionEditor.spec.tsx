/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import { screen, waitFor } from "@testing-library/preact";

import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import {
    IDialogValidations, IDialogValues, type IDialogSection,
} from "../../../../components/Dialogs/ValueEditDialog.js";
import { ConnectionDataModel } from "../../../../data-models/ConnectionDataModel.js";
import { ConnectionEditor } from "../../../../modules/db-editor/ConnectionEditor.js";
import { DocumentContext, type DocumentContextType } from "../../../../modules/db-editor/index.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";
import {
    DialogHelper, changeInputValue, getDbCredentials, nextRunLoop, setupShellForTests,
} from "../../test-helpers.js";

class TestConnectionEditor extends ConnectionEditor {
    public testValidateConnectionValues = (closing: boolean, values: IDialogValues,
        data?: IDictionary): IDialogValidations => {
        return this.validateConnectionValues(closing, values, data);
    };

    public testGenerateEditorConfig = (details?: IConnectionDetails): IDialogValues => {
        // @ts-ignore
        return this.generateEditorConfig(details);
    };
}

describe("ConnectionEditor tests", (): void => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let connID: number;
    let dialogHelper: DialogHelper;
    let folderID: number;

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
        caption: "DocumentModule Test Connection 1",
        description: "DocumentModule Test MyQSL Connection",
        options,
    };

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        backend = new ShellInterfaceSqlEditor();

        launcher = await setupShellForTests(false, true, "DEBUG3");
        folderID = await ShellInterface.dbConnections.addFolderPath(
            webSession.currentProfileId, "unit-tests", -1);
        expect(folderID).toBeGreaterThan(-1);
        testMySQLConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testMySQLConnection, folderID) ?? -1;
        expect(testMySQLConnection.id).toBeGreaterThan(-1);
        connID = testMySQLConnection.id;

        await backend.startSession("documentModuleTests");
        await backend.openConnection(testMySQLConnection.id);
        dialogHelper = new DialogHelper("connectionEditor");
    });

    afterAll(async () => {
        await ShellInterface.dbConnections.removeFolderPath(folderID);
        await backend.closeSession();
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connID);
        await launcher.exitProcess();
    });

    it("Test ConnectionEditor match snapshot", () => {
        const component = mount<ConnectionEditor>(
            <ConnectionEditor onAddConnection={() => { }} onUpdateConnection={() => { }} />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test ConnectionEditor set connection timeout", async () => {
        const component = mount<ConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <ConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const editor = component.find<ConnectionEditor>(ConnectionEditor);
        await editor.instance().show("MySQL", false, testMySQLConnection);

        await waitFor(() => {
            expect(screen.getByText("Advanced")).toBeDefined();
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        const advanced = screen.getByText("Advanced");
        advanced.click();
        await waitFor(() => {
            expect(screen.getByText("Connection Timeout")).toBeDefined();
        });

        const timeout = screen.getByText("Connection Timeout");
        changeInputValue(timeout, "5");
        await nextRunLoop();

        dialogHelper.verifyErrors();
        await dialogHelper.clickOk();

        await nextRunLoop();
        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Test ConnectionEditor updating connection", async () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        await editor.instance().show("MySQL", false, testMySQLConnection);

        await waitFor(() => {
            expect(screen.getByText("Host Name or IP Address")).toBeDefined();
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        const timeout = screen.getByText("Host Name or IP Address");
        changeInputValue(timeout, "127.0.0.1");

        const protocol = screen.getByText("Protocol");
        changeInputValue(protocol, MySQLConnectionScheme.MySQL);

        const port = screen.getByText("Port");
        changeInputValue(port, "3308");

        const user = screen.getByText("User Name");
        changeInputValue(user, "user1");

        const clearPassword = screen.getByText("Clear Password");
        clearPassword.click();

        const defaultSchema = screen.getByText("Default Schema");
        changeInputValue(defaultSchema, "schema1");

        const useSSH = screen.getByText("Connect using SSH Tunnel");
        useSSH.click();

        const useBastion = screen.getByText("Connect using OCI Bastion service");
        useBastion.click();

        await nextRunLoop();

        dialogHelper.verifyErrors();
        await dialogHelper.clickOk();

        await nextRunLoop();
        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when databaseType is not selected", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "Connection 1", type: "text" },
                    },
                } as IDialogSection],
                ["mysqlDetails", {
                    values: {},
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {},
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(false, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ databaseType: "Select one of the database types for your connection" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when caption is empty", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "", type: "text" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        port: { value: 3306, type: "number" },
                        hostName: { value: "localhost", type: "text" },
                        userName: { value: "user1", type: "text" },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10, type: "number" },
                    },
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ caption: "The caption cannot be empty" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when dbFilePath is not specified for Sqlite", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "Sqlite", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "Connection 1", type: "text" },
                    },
                }],
                ["mysqlDetails", {
                    values: {},
                }],
                ["sqliteDetails", {
                    values: {
                        dbFilePath: { value: "", type: "text" },
                    },
                }],
                ["mysqlAdvanced", {
                    values: {},
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ dbFilePath: "Specify the path to an existing Sqlite DB file" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when hostName is not specified for MySQL", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "Connection 1", type: "text" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "", type: "text" },
                        userName: { value: "user1", type: "text" },
                        port: { value: 3306, type: "number" },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10, type: "number" },
                    },
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ hostName: "Specify a valid host name or IP address" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when userName is not specified for MySQL", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "Connection 1", type: "text" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "localhost", type: "text" },
                        userName: { value: "", type: "text" },
                        port: { value: 3306, type: "number" },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10, type: "number" },
                    },
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ userName: "The user name must not be empty" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when port is not a valid integer for MySQL", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL", type: "text" },
                    },
                } as IDialogSection],
                ["information", {
                    values: {
                        caption: { value: "Connection 1", type: "text" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "localhost", type: "text" },
                        userName: { value: "user1", type: "text" },
                        port: { value: -1, type: "number" },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10, type: "number" },
                    },
                }],
            ]),
        };

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ timeout: "The port must be a valid integer >= 0" });

        component.unmount();
    });

    it("Test ConnectionEditor generateEditorConfig function", () => {
        const component = mount<TestConnectionEditor>(
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: dataModel,
                } as DocumentContextType}>

                <TestConnectionEditor
                    onAddConnection={() => { }}
                    onUpdateConnection={() => { }} />,
            </DocumentContext.Provider>,
        );

        const editor = component.find<TestConnectionEditor>(TestConnectionEditor);
        const result = editor.instance().testGenerateEditorConfig(testMySQLConnection);

        expect(result.sections.get("information")!.values.caption.value).toEqual(testMySQLConnection.caption);
        expect(result.sections.get("information")!.values.description.value).toEqual(testMySQLConnection.description);

        const options = testMySQLConnection.options as IMySQLConnectionOptions;
        expect(result.sections.get("mysqlDetails")!.values.hostName.value).toEqual(options.host);
        expect(result.sections.get("mysqlDetails")!.values.userName.value).toEqual(options.user);

        component.unmount();
    });
});
