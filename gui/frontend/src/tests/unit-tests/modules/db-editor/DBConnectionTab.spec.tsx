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

import { mount } from "enzyme";

import { setupShellForTests } from "../../test-helpers.js";
import {
    DBConnectionTab, IOpenEditorState, IDBConnectionTabPersistentState,
} from "../../../../modules/db-editor/DBConnectionTab.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { ExecutionWorkerPool } from "../../../../modules/db-editor/execution/ExecutionWorkerPool.js";
import { DBType } from "../../../../supplement/ShellInterface/index.js";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { EntityType } from "../../../../modules/db-editor/index.js";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts.js";
import { CodeEditorMode, Monaco } from "../../../../components/ui/CodeEditor/index.js";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher.js";

jest.mock("../../../../components/ui/CodeEditor/CodeEditor");

describe("DBConnectionTab tests", (): void => {

    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;

    const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
        executionContexts: new ExecutionContexts(),
        editorMode: CodeEditorMode.Standard,
    });

    if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
        model.setEOL(Monaco.EndOfLineSequence.LF);
    } else {
        // Necessary to counter the model version increase that happens when the other branch is taken.
        model.setValue(content);
    }

    model.setValue(content);

    let launcher: MySQLShellLauncher;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true);
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
            connectionId: 0,
            dbType: DBType.MySQL,
            serverVersion: 1,
            serverEdition: "gpl",
            heatWaveEnabled: false,
            sqlMode: "mode1",
            editors: [edState],
            scripts: [],
            schemaTree: [],
            explorerState: new Map([["state1", {}]]),
            adminPageStates: {
                lakehouseNavigatorState: {
                    autoRefreshTablesAndTasks: true,
                    activeTabId: "overview",
                },
            },
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
            chatOptionsState: {
                chatOptionsExpanded: false,
                chatOptionsWidth: -1,
            },
        };

        const component = mount<DBConnectionTab>(
            <DBConnectionTab
                connectionId={0}
                dbType={DBType.MySQL}
                savedState={savedState}
                workerPool={wp}
                showAbout={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
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
