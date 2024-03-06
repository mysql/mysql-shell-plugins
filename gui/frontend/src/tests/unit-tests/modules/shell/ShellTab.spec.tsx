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

import { shallow } from "enzyme";

import { ShellTab } from "../../../../modules/shell/ShellTab.js";
import { IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { ShellInterfaceShellSession } from "../../../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { IShellSimpleResult, ShellAPIGui } from "../../../../communication/ProtocolGui.js";
import { DataCallback } from "../../../../communication/MessageScheduler.js";

describe("Shell tab tests", (): void => {

    describe("Connection tests", () => {
        // Generate the set of initial component state props
        const tSavedState = (result: IShellSimpleResult) => {
            return {
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

        it("Connects using a connection string without a scheme", async () => {
            const shellResult = { info: "Creating a session to 'root@localhost:3307'\n" };
            const savedState = tSavedState(shellResult);
            const component = shallow<ShellTab>(
                <ShellTab
                    savedState={savedState}
                    onQuit={() => {}}
                />,
            );

            // This matches the handleExecution() private method on ShellTab.tsx...
            const onScriptExecution: (context: object, options: object) =>
                Promise<void> = component.find("#shellEditor").invoke("onScriptExecution");
            // ...which accept as parameters, an object with the execution context
            const executionContext = {
                // clearResult is not needed for this test
                clearResult: () => {},
                code: "\\connect root@localhost:3307",
            };
            // and an object with additional execution details, which is not needed for the test
            await onScriptExecution(executionContext, {});

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
                    onQuit={() => {}}
                />,
            );

            const onScriptExecution: (context: object, options: object) =>
                Promise<void> = component.find("#shellEditor").invoke("onScriptExecution");

            const executionContext = {
                clearResult: () => {},
                code: "\\connect mysql://root@localhost:3307",
            };

            await onScriptExecution(executionContext, {});

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
                    onQuit={() => {}}
                />,
            );

            const onScriptExecution: (context: object, options: object) =>
                Promise<void> = component.find("#shellEditor").invoke("onScriptExecution");

            const executionContext = {
                clearResult: () => {},
                code: "\\connect mysqlx://root@localhost:33070",
            };

            await onScriptExecution(executionContext, {});

            expect(savedState).toMatchObject({
                lastCommand: "\\connect mysqlx://root@localhost:33070",
                lastHost: "localhost",
                lastPort: 33070,
                lastUserName: "root",
            });

            component.unmount();
        });
    });
});
