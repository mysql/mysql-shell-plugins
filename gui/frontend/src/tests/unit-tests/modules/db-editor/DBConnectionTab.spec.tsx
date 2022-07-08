/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import React from "react";

import { setupShellForTests } from "../../test-helpers";
import {
    DBConnectionTab, IOpenEditorState, IDBConnectionTabPersistentState,
} from "../../../../modules/db-editor/DBConnectionTab";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { ExecutionWorkerPool } from "../../../../modules/db-editor/execution/ExecutionWorkerPool";
import { DBType } from "../../../../supplement/ShellInterface";
import {
    CodeEditorMode, ICodeEditorModel, IEditorPersistentState,
} from "../../../../components/ui/CodeEditor/CodeEditor";
import { EntityType } from "../../../../modules/db-editor";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts";
import { Monaco } from "../../../../components/ui/CodeEditor";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";

jest.mock("../../../../components/ui/CodeEditor/CodeEditor");

describe("DBConnectionTab tests", (): void => {

    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;
    const model = Monaco.createModel("", "msg") as ICodeEditorModel;
    model.executionContexts = new ExecutionContexts(undefined, 80024, "", "");
    model.editorMode = CodeEditorMode.Standard;
    model.setValue(content);

    let launcher: MySQLShellLauncher;

    beforeAll(async () => {
        launcher = await setupShellForTests("DBEditor", false, true, "DEBUG2");
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Test DBConnectionTab instantiation", () => {
        const wp = new ExecutionWorkerPool();
        const eps: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const edState: IOpenEditorState = {
            state: eps,
            currentVersion: 0,
            type: EntityType.Notebook,
            id: "SQLEditor",
            caption: "",
        };

        const backend = new ShellInterfaceSqlEditor();
        const savedState: IDBConnectionTabPersistentState = {
            backend,
            serverVersion: 1,
            serverEdition: "gpl",
            sqlMode: "mode1",
            editors: [edState],
            scripts: [],
            schemaTree: [],
            explorerState: new Map([["state1", {}]]),
            activeEntry: "SQLEditor",
            currentSchema: "myDb",
            explorerWidth: 200,
            graphData: {
                timestamp: new Date().getTime(),
                activeColorScheme: "grays",
                displayInterval: 300,
                currentValues: new Map(),
                computedValues: {},
                series: new Map(),
            },
        };

        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connectionId={0}
                dbType={DBType.MySQL}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
            />,
        );

        const props = component.props();
        expect(props.connectionId).toEqual(0);
        expect(props.dbType).toEqual(DBType.MySQL);
        expect(props.savedState).toEqual(savedState);
        expect(props.workerPool).toEqual(wp);

        component.unmount();
    });

});
