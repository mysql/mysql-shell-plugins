/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../../../communication/MySQL.js";
import { IDialogValidations, IDialogValues } from "../../../../components/Dialogs/ValueEditDialog.js";
import { ConnectionEditor } from "../../../../modules/db-editor/ConnectionEditor.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { webSession } from "../../../../supplement/WebSession.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";
import {
    DialogHelper, changeInputValue, getDbCredentials, nextRunLoop, setupShellForTests,
} from "../../test-helpers.js";

class TestConnectionEditor extends ConnectionEditor {
    public testValidateConnectionValues = (closing: boolean, values: IDialogValues,
        data?: IDictionary): IDialogValidations => {
        return this.validateConnectionValues(closing, values, data);
    };

    public testGenerateEditorConfig = (details?: IConnectionDetails): IDialogValues => {
        return this.generateEditorConfig(details);
    };
}

describe("ConnectionEditor tests", (): void => {
    let launcher: MySQLShellLauncher;
    let backend: ShellInterfaceSqlEditor;
    let connID: number;
    let dialogHelper: DialogHelper;

    const credentials = getDbCredentials();

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
        backend = new ShellInterfaceSqlEditor();

        launcher = await setupShellForTests(false, true, "DEBUG3");
        testMySQLConnection.id = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
            testMySQLConnection, "unit-tests") ?? -1;
        expect(testMySQLConnection.id).toBeGreaterThan(-1);
        connID = testMySQLConnection.id;

        await backend.startSession("dbEditorModuleTests");
        await backend.openConnection(testMySQLConnection.id);
        dialogHelper = new DialogHelper("connectionEditor");
    });

    afterAll(async () => {
        await backend.closeSession();
        await ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, connID);
        await launcher.exitProcess();
    });

    it("Test ConnectionEditor match snapshot", () => {
        const component = mount<ConnectionEditor>(
            <ConnectionEditor connections={[]} onAddConnection={() => {}} onUpdateConnection={() => {}} />,
        );

        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test ConnectionEditor set connection timeout", async () => {
        const component = mount<ConnectionEditor>(
            <ConnectionEditor
                connections={[testMySQLConnection]}
                onAddConnection={() => { }}
                onUpdateConnection={() => { }} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        await component.instance().show("MySQL", false, testMySQLConnection);

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
        const component = mount<ConnectionEditor>(
            <ConnectionEditor
                connections={[testMySQLConnection]}
                onAddConnection={() => { }}
                onUpdateConnection={() => { }} />,
        );

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        await component.instance().show("MySQL", false, testMySQLConnection);

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
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "Connection 1" },
                    },
                }],
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

        const result = instance.testValidateConnectionValues(false, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ databaseType: "Select one of the database types for your connection" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when caption is empty", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        port: { value: 3306 },
                        hostName: { value: "localhost" },
                        userName: { value: "user1" },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10 },
                    },
                }],
            ]),
        };

        const result = instance.testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ caption: "The caption cannot be empty" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when dbFilePath is not specified for Sqlite", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "Sqlite" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "Connection 1" },
                    },
                }],
                ["mysqlDetails", {
                    values: {},
                }],
                ["sqliteDetails", {
                    values: {
                        dbFilePath: { value: "" },
                    },
                }],
                ["mysqlAdvanced", {
                    values: {},
                }],
            ]),
        };

        const result = instance.testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ dbFilePath: "Specify the path to an existing Sqlite DB file" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when hostName is not specified for MySQL", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "Connection 1" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "" },
                        userName: { value: "user1" },
                        port: { value: 3306 },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10 },
                    },
                }],
            ]),
        };

        const result = instance.testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ hostName: "Specify a valid host name or IP address" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when userName is not specified for MySQL", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "Connection 1" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "localhost" },
                        userName: { value: "" },
                        port: { value: 3306 },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10 },
                    },
                }],
            ]),
        };

        const result = instance.testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ userName: "The user name must not be empty" });

        component.unmount();
    });

    it("Test ConnectionEditor validateConnectionValues function when port is not a valid integer for MySQL", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const values: IDialogValues = {
            sections: new Map([
                ["general", {
                    values: {
                        databaseType: { value: "MySQL" },
                    },
                }],
                ["information", {
                    values: {
                        caption: { value: "Connection 1" },
                    },
                }],
                ["mysqlDetails", {
                    values: {
                        hostName: { value: "localhost" },
                        userName: { value: "user1" },
                        port: { value: -1 },
                    },
                }],
                ["sqliteDetails", {
                    values: {},
                }],
                ["mysqlAdvanced", {
                    values: {
                        timeout: { value: 10 },
                    },
                }],
            ]),
        };

        const result = instance.testValidateConnectionValues(true, values);

        expect(result.requiredContexts).toEqual([]);
        expect(result.messages).toEqual({ timeout: "The port must be a valid integer >= 0" });

        component.unmount();
    });

    it("Test ConnectionEditor generateEditorConfig function", () => {
        const component = mount<TestConnectionEditor>(<TestConnectionEditor
            connections={[testMySQLConnection]}
            onAddConnection={() => { }}
            onUpdateConnection={() => { }} />,
        );
        const instance = component.instance();

        const result = instance.testGenerateEditorConfig(testMySQLConnection);

        expect(result.sections.get("information")!.values.caption.value).toEqual(testMySQLConnection.caption);
        expect(result.sections.get("information")!.values.description.value).toEqual(testMySQLConnection.description);
        expect(result.sections.get("mysqlDetails")!.values.hostName.value).toEqual(testMySQLConnection.options.host);
        expect(result.sections.get("mysqlDetails")!.values.userName.value).toEqual(testMySQLConnection.options.user);

        component.unmount();
    });
});
