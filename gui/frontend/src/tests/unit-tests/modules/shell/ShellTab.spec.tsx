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

/* eslint-disable dot-notation */

import { shallow } from "enzyme";

import { DataCallback } from "../../../../communication/MessageScheduler.js";
import { IShellSimpleResult, ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import type { IOdmShellSessionEntry } from "../../../../data-models/OpenDocumentDataModel.js";
import { IShellTabPersistentState, ShellTab } from "../../../../modules/shell/ShellTab.js";
import { ExecutionContext } from "../../../../script-execution/ExecutionContext.js";
import { IExecutionResult } from "../../../../script-execution/index.js";
import { ShellInterfaceShellSession } from "../../../../supplement/ShellInterface/ShellInterfaceShellSession.js";

describe("Shell tab tests", (): void => {
    const toolbarItemsTemplate = {
        navigation: [],
        execution: [],
        editor: [],
        auxiliary: [],
    };

    describe("Connection tests", () => {
        // Generate the set of initial component state props
        const tSavedState = (result: IShellSimpleResult) => {
            return {
                dataModelEntry: {} as IOdmShellSessionEntry,
                backend: {
                    execute: (_command: string, _requestId: string,
                        callback: DataCallback<ShellAPIGui.GuiShellExecute>) => {
                        return callback({ result }, "");
                    },
                } as ShellInterfaceShellSession,
                serverEdition: "foo",
                serverVersion: 0,
                sqlMode: "bar",
                state: {
                    model: {
                        getVersionId: () => {
                            return 0;
                        },
                    },
                } as IEditorPersistentState,
            };
        };

        it("Test ShellModule instantiation", () => {
            const mockSavedState = (result: IShellSimpleResult) => {
                return {
                    dataModelEntry: {} as IOdmShellSessionEntry,
                    backend: {
                        execute: (_command: string, _requestId: string,
                            callback: DataCallback<ShellAPIGui.GuiShellExecute>) => {
                            return callback({ result }, "");
                        },
                    } as ShellInterfaceShellSession,
                    serverEdition: "foo",
                    serverVersion: 0,
                    sqlMode: "bar",
                    state: {
                        model: {
                            getVersionId: () => {
                                return 0;
                            },
                        },
                    } as IEditorPersistentState,
                };
            };

            const savedState = mockSavedState({ info: "" });
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            expect(component).toMatchSnapshot();
            component.unmount();
        });

        it("Connects using a connection string without a scheme", async () => {
            const shellResult = { info: "Creating a session to 'root@localhost:3307'\n" };
            const savedState = tSavedState(shellResult);
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const executionContext = {
                // clearResult is not needed for this test
                clearResult: () => { },
                code: "\\connect root@localhost:3307",
            };

            await component.instance()["handleExecution"](executionContext as ExecutionContext, {});

            // Ultimately, the component props should include all the details needed for calling "openDbSession()"
            expect(savedState).toMatchObject({
                lastCommand: "\\connect root@localhost:3307",
                lastHost: "localhost",
                lastPort: 3307,
                lastUserName: "root",
            });

            component.unmount();
        });

        it("Connects on Classic using a connection string with the corresponding scheme", async () => {
            const shellResult = { info: "Creating a Classic session to 'root@localhost:3307'\n" };
            const savedState = tSavedState(shellResult);
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const executionContext = {
                clearResult: () => { },
                code: "\\connect mysql://root@localhost:3307",
            };

            await component.instance()["handleExecution"](executionContext as ExecutionContext, {});

            expect(savedState).toMatchObject({
                lastCommand: "\\connect mysql://root@localhost:3307",
                lastHost: "localhost",
                lastPort: 3307,
                lastUserName: "root",
            });

            component.unmount();
        });

        it("Connects on X protocol using a connection string with the corresponding scheme", async () => {
            const shellResult = { info: "Creating an X protocol session to 'root@localhost:33070'\n" };
            const savedState = tSavedState(shellResult);
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const executionContext = {
                clearResult: () => { },
                code: "\\connect mysqlx://root@localhost:33070",
            };

            await component.instance()["handleExecution"](executionContext as ExecutionContext, {});

            expect(savedState).toMatchObject({
                lastCommand: "\\connect mysqlx://root@localhost:33070",
                lastHost: "localhost",
                lastPort: 33070,
                lastUserName: "root",
            });

            component.unmount();
        });

    });

    describe("Other tests", () => {
        const tSavedState = (result: IShellSimpleResult): IShellTabPersistentState => {
            return {
                dataModelEntry: {} as IOdmShellSessionEntry,
                backend: {
                    execute: (_command: string, _requestId: string,
                        callback: DataCallback<ShellAPIGui.GuiShellExecute>) => {
                        return callback({ result }, "");
                    },
                } as ShellInterfaceShellSession,
                serverEdition: "foo",
                serverVersion: 0,
                sqlMode: "bar",
                state: {
                    model: {
                        getVersionId: () => {
                            return 0;
                        },
                    },
                } as IEditorPersistentState,
            };
        };

        it("Test handleExecution function", async () => {
            const savedState = tSavedState({ info: "" });
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const shellTabInstance = component.instance();

            const executionContext = {
                clearResult: async () => { },
                code: "\\quit",
                language: "",
            };

            let result = await shellTabInstance["handleExecution"](executionContext as ExecutionContext, {});

            expect(result).toBe(true);

            executionContext.code = "\\js";

            result = await shellTabInstance["handleExecution"](executionContext as ExecutionContext, {});

            expect(result).toBe(true);
            expect(shellTabInstance["currentLanguage"]).toBe("javascript");

            executionContext.code = "\\py";

            result = await shellTabInstance["handleExecution"](executionContext as ExecutionContext, {});

            expect(result).toBe(true);
            expect(shellTabInstance["currentLanguage"]).toBe("python");

            executionContext.code = "\\sql";

            result = await shellTabInstance["handleExecution"](executionContext as ExecutionContext, {});

            expect(result).toBe(true);
            expect(shellTabInstance["currentLanguage"]).toBe("sql");

            executionContext.code = "SELECT 1;";
            executionContext.language = "sql";

            result = await shellTabInstance["handleExecution"](executionContext as ExecutionContext, {});

            expect(result).toBe(true);
            expect(shellTabInstance["currentLanguage"]).toBe("sql");

            component.unmount();
        });

        it("Test addTimedResult function", () => {
            const savedState = tSavedState({ info: "" });
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const shellTabInstance = component.instance();

            const executionContext = {
                clearResult: async () => { },
                code: "SELECT 1;",
                language: "sql",
            };

            const executionResult = {
                type: "text",
                text: "1\n",
            };

            expect(shellTabInstance["resultTimers"].size).toBe(0);

            shellTabInstance["addTimedResult"](executionContext as ExecutionContext,
                executionResult as IExecutionResult, "1");

            expect(shellTabInstance["resultTimers"].size).toBe(1);

            component.unmount();
        });

        it("Test listSchemas function", async () => {
            const savedState = tSavedState({ info: "" });
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const shellTabInstance = component.instance();

            const result = await shellTabInstance["listSchemas"]();

            expect(result).toStrictEqual([]);

            component.unmount();
        });

        it("Test getPasswordFromLastCommand function", () => {
            const savedState = tSavedState({ info: "" });
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    toolbarItemsTemplate={toolbarItemsTemplate}
                    onQuit={() => { }}
                />,
            );

            const shellTabInstance = component.instance();
            savedState.lastCommand = "mysqlx://root:password@localhost:33060";
            component.setProps({ savedState });

            const result = shellTabInstance["getPasswordFromLastCommand"]();

            expect(result).toBe("password");

            component.unmount();
        });
    });
});
