/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MessageType } from "../../../../../app-logic/general-types.js";
import { registerUiLayer } from "../../../../../app-logic/UILayer.js";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../../../components/ui/CodeEditor/index.js";
import type { ISavedEditorState } from "../../../../../modules/db-editor/ConnectionWorkspace.js";
import { ScriptEditor } from "../../../../../modules/db-editor/ScriptEditor.js";
import { StandalonePresentationInterface } from "../../../../../modules/db-editor/execution/StandalonePresentationInterface.js";
import { ExecutionContexts } from "../../../../../script-execution/ExecutionContexts.js";
import { notebookDocumentMock } from "../../../__mocks__/DocumentModuleMocks.js";
import { uiLayerMock } from "../../../__mocks__/UILayerMock.js";
import { render } from "@testing-library/preact";

describe("Standalone presentation interface tests", (): void => {

    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;

    const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
        executionContexts: new ExecutionContexts(),
        editorMode: CodeEditorMode.Standard,
    });

    model.setEOL(Monaco.EndOfLineSequence.LF);
    model.setValue(content);

    beforeAll(() => {
        registerUiLayer(uiLayerMock);
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Standalone presentation interface instantiation", () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const savedState: ISavedEditorState = {
            documentStates: [{
                document: notebookDocumentMock,
                state: editorState,
                currentVersion: 1,
            }],
            activeEntry: "1",
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
        };

        const { unmount } = render(
            <ScriptEditor
                savedState={savedState}
                standaloneMode={false}
                connectionId={-1}
                connectionCaption="Test Connection"
                pageCaption="Test Connection"
                toolbarItemsTemplate={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        unmount();
    });

    it("keeps the embedded result pane visible when results are removed", () => {
        const host = {
            setState: vi.fn(),
        } as unknown as ScriptEditor;
        const target = { current: document.createElement("div") };
        const presentation = new StandalonePresentationInterface("mysql");

        presentation.onMount(target, host);

        (presentation as unknown as { removeRenderTarget: () => void }).removeRenderTarget();

        expect(host.setState).toHaveBeenCalledWith({
            showResultPane: true,
            maximizeResultPane: false,
            hasResultContent: false,
        });

        presentation.dispose();
    });

    it("keeps the output tab when result sets have no textual output", () => {
        const host = {
            setState: vi.fn(),
        } as unknown as ScriptEditor;
        const targetElement = document.createElement("div");
        document.body.append(targetElement);

        const presentation = new StandalonePresentationInterface("mysql");
        presentation.onMount({ current: targetElement }, host);
        presentation.context = {
            id: "ctx-1",
        } as never;
        presentation.activate({
            getModel: () => null,
        } as never);

        presentation.setResult({
            type: "resultSets",
            sets: [{
                type: "resultSet",
                resultId: "result-1",
                fullTableName: "",
                sql: "select 1",
                updatable: false,
                columns: [],
                data: {
                    rows: [{ value: 1 }],
                    currentPage: 0,
                    executionInfo: {
                        type: MessageType.Info,
                        text: "1 row returned",
                    },
                },
            }],
        });

        expect(targetElement.querySelector("#output")).toBeTruthy();

        presentation.dispose();
        targetElement.remove();
    });
});
