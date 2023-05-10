/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { ScriptEditor } from "../../../modules/db-editor/ScriptEditor";
import { CodeEditorMode, Monaco } from "../../../components/ui/CodeEditor";
import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts";
import { ISavedEditorState } from "../../../modules/db-editor/DBConnectionTab";
import { EntityType } from "../../../modules/db-editor";

describe("Script editor tests", (): void => {

    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;
    const model = Monaco.createModel("", "msg") as ICodeEditorModel;
    if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
        model.setEOL(Monaco.EndOfLineSequence.LF);
    } else {
        // Necessary to counter the model version increase that happens when the other branch is taken.
        model.setValue("");
    }

    model.executionContexts = new ExecutionContexts(undefined, 80024, "", "");
    model.editorMode = CodeEditorMode.Standard;
    model.setValue(content);

    it("Script editor instantiation", () => {
        const savedState: ISavedEditorState = {
            editors: [{
                type: EntityType.Notebook,
                id: "1",
                caption: "Test",
                currentVersion: 1,
                state: {
                    viewState: null,
                    model,
                    options: {},
                },
            }],
            activeEntry: "1",
            heatWaveEnabled: false,
            connectionId: -1,
        };

        const component = mount<ScriptEditor>(
            <ScriptEditor
                savedState={savedState}
                standaloneMode={false}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );
        const props = component.props();
        expect(props.savedState).toEqual(savedState);
        component.unmount();
    });
});
