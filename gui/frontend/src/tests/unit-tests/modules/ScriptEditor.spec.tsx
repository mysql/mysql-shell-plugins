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

import { mount } from "enzyme";

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../components/ui/CodeEditor/index.js";
import { ScriptEditor } from "../../../modules/db-editor/ScriptEditor.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";
import { scriptDocumentMock } from "../__mocks__/DocumentModuleMocks.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import type { ISavedEditorState } from "../../../modules/db-editor/ConnectionTab.js";

describe("Script editor tests", (): void => {

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
        model.setValue("");
    }

    model.setValue(content);

    beforeAll(() => {
        registerUiLayer(uiLayerMock);
    });

    it("Script editor instantiation", () => {
        const savedState: ISavedEditorState = {
            documentStates: [{
                document: scriptDocumentMock,
                currentVersion: 1,
                state: {
                    viewState: null,
                    model,
                    options: {},
                },
            }],
            activeEntry: "1",
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
        };

        const component = mount<ScriptEditor>(
            <ScriptEditor
                savedState={savedState}
                standaloneMode={false}
                connectionId={-1}
                toolbarItemsTemplate={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const props = component.props();
        expect(props.savedState).toEqual(savedState);
        component.unmount();
    });
});
