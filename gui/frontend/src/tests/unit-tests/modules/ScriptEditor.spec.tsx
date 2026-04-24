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

import { render } from "@testing-library/preact";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MessageType } from "../../../app-logic/general-types.js";
import { registerUiLayer } from "../../../app-logic/UILayer.js";
import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../components/ui/CodeEditor/index.js";
import type { ISavedEditorState } from "../../../modules/db-editor/ConnectionTab.js";
import { ScriptEditor } from "../../../modules/db-editor/ScriptEditor.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { scriptDocumentMock } from "../__mocks__/DocumentModuleMocks.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";

const readFrontendSourceFile = (path: string): string => {
    let directory = process.cwd();

    for (let i = 0; i < 8; i++) {
        const candidate = join(directory, path);

        if (existsSync(candidate)) {
            return readFileSync(candidate, "utf-8");
        }

        directory = dirname(directory);
    }

    throw new Error(`Unable to find ${path}`);
};

const readCssRule = (css: string, selector: string): string => {
    const escapedSelector = selector.replaceAll(".", "\\.").replaceAll("#", "\\#");
    const match = new RegExp(`${escapedSelector}\\s*{(?<rule>[^}]*)}`, "s").exec(css);

    return match?.groups?.rule ?? "";
};

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

    afterAll(() => {
        vi.clearAllMocks();
    });

    it("Script editor instantiation", () => {
        const savedState: ISavedEditorState = {
            documentStates: [{
                document: scriptDocumentMock,
                currentVersion: 1,
                fileName: "/tmp/loaded-query.sql",
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

        const { container, unmount } = render(
            <ScriptEditor
                savedState={savedState}
                standaloneMode={false}
                connectionId={-1}
                toolbarItemsTemplate={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        expect(container.querySelector("#documentToolbar")).toBeFalsy();
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("reserves space for the embedded statusbar below the editor pane", () => {
        const documentCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");
        const editorPaneRule = readCssRule(documentCss,
            ".msg.dbModuleTabview .standaloneScriptHost #editorPaneHost");

        expect(editorPaneRule).toContain("box-sizing: border-box;");
        expect(editorPaneRule).toContain("padding-bottom: 24px;");
    });

    it("uses 12px as the default Monaco editor font size", () => {
        const scriptEditorSource = readFrontendSourceFile("src/modules/db-editor/ScriptEditor.tsx");
        const notebookSource = readFrontendSourceFile("src/modules/db-editor/Notebook.tsx");

        expect(scriptEditorSource).toContain("fontSize: fontSize ?? 12,");
        expect(scriptEditorSource).toContain("lineHeight: 18,");
        expect(notebookSource).toContain("fontSize: fontSize ?? 12,");
        expect(notebookSource).toContain("lineHeight: 18,");
        expect(scriptEditorSource).not.toContain("fontSize: fontSize ?? 15,");
        expect(notebookSource).not.toContain("fontSize: fontSize ?? 15,");
        expect(scriptEditorSource).not.toContain("lineHeight: 24,");
        expect(notebookSource).not.toContain("lineHeight: 24,");
    });

    it("uses thinner Monaco editor scrollbars", () => {
        const scriptEditorSource = readFrontendSourceFile("src/modules/db-editor/ScriptEditor.tsx");
        const notebookSource = readFrontendSourceFile("src/modules/db-editor/Notebook.tsx");

        expect(scriptEditorSource).toContain("verticalScrollbarSize: 12,");
        expect(scriptEditorSource).toContain("horizontalScrollbarSize: 12,");
        expect(notebookSource).toContain("verticalScrollbarSize: 12,");
        expect(notebookSource).toContain("horizontalScrollbarSize: 12,");
    });

    it("uses the provided default caption when saving", () => {
        const executeRemoteSpy = vi.spyOn(requisitions, "executeRemote").mockReturnValue(true);
        const savedState: ISavedEditorState = {
            documentStates: [{
                document: scriptDocumentMock,
                currentVersion: 1,
                fileName: "/tmp/loaded-query.sql",
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

        const editor = new ScriptEditor({
            savedState,
            standaloneMode: false,
            connectionId: -1,
            defaultSaveCaption: "Untitled-1.sql",
            toolbarItemsTemplate: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        (editor as unknown as { handleEditorSave: () => void }).handleEditorSave();
        editor.saveActiveScript(true);

        expect(executeRemoteSpy).toHaveBeenCalledWith("editorSaveScript", expect.objectContaining({
            caption: "Untitled-1.sql",
            fileName: "/tmp/loaded-query.sql",
        }));
        expect(executeRemoteSpy).toHaveBeenCalledWith("editorSaveScript", expect.objectContaining({
            caption: "Untitled-1.sql",
            fileName: "/tmp/loaded-query.sql",
            saveAs: true,
        }));
    });

    it("keeps the lower result pane visible by default and when switching scripts", () => {
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

        const editor = new ScriptEditor({
            savedState,
            standaloneMode: false,
            connectionId: -1,
            toolbarItemsTemplate: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        expect(editor.state.showResultPane).toBe(true);
        expect(editor.state.hasResultContent).toBe(false);
        expect(ScriptEditor.getDerivedStateFromProps({
            ...editor.props,
            savedState: {
                ...savedState,
                activeEntry: "2",
            },
        }, editor.state)).toEqual({
            currentId: "2",
            showResultPane: true,
            maximizeResultPane: false,
            hasResultContent: false,
            cursorPositionText: "Ln 1, Col 1",
        });
    });

    it("requests loading a replacement file for the active script", async () => {
        const executeSpy = vi.spyOn(requisitions, "execute").mockReturnValue(Promise.resolve(true));

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

        const editor = new ScriptEditor({
            savedState,
            standaloneMode: false,
            connectionId: -1,
            toolbarItemsTemplate: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        (editor as unknown as { handleEditorLoad: () => void }).handleEditorLoad();
        await Promise.resolve();

        expect(executeSpy).toHaveBeenCalledWith("editorLoadScript", expect.objectContaining({
            id: scriptDocumentMock.id,
            caption: scriptDocumentMock.caption,
            content: "",
            openFromFile: true,
        }));
    });

    it("restores existing results when switching back to a script with result data", () => {
        const resultData = {
            type: "text",
            text: [{
                type: MessageType.Info,
                content: "1 row returned",
            }],
        } as const;
        const presentationWithResults = {
            onMount: vi.fn(),
            setResult: vi.fn(),
            resultData,
            currentSet: 0,
            currentHeight: 240,
            maximizedResult: true,
        } as unknown as {
            onMount: (target: unknown, host?: ScriptEditor) => void;
            setResult: (data: typeof resultData, options: {
                currentSet?: number;
                manualHeight?: number;
                maximized?: boolean;
            }) => void;
            resultData: typeof resultData;
            currentSet: number;
            currentHeight: number;
            maximizedResult: boolean;
        };

        const firstDocument = {
            ...scriptDocumentMock,
            id: "1",
            caption: "Script 1",
        };
        const secondDocument = {
            ...scriptDocumentMock,
            id: "2",
            caption: "Script 2",
        };
        const firstModel = {
            executionContexts: {
                count: 0,
                contextAt: vi.fn(),
                contextFromPosition: vi.fn(),
                cursorPosition: 0,
            },
        } as unknown as ICodeEditorModel;
        const secondModel = {
            executionContexts: {
                count: 1,
                contextAt: vi.fn().mockReturnValue({
                    presentation: presentationWithResults,
                }),
                contextFromPosition: vi.fn().mockReturnValue({
                    presentation: presentationWithResults,
                }),
                cursorPosition: 0,
            },
        } as unknown as ICodeEditorModel;

        const savedState: ISavedEditorState = {
            documentStates: [{
                document: firstDocument,
                currentVersion: 1,
                state: {
                    viewState: null,
                    model: firstModel,
                    options: {},
                },
            }, {
                document: secondDocument,
                currentVersion: 1,
                state: {
                    viewState: null,
                    model: secondModel,
                    options: {},
                },
            }],
            activeEntry: "1",
            heatWaveEnabled: false,
            mleEnabled: false,
            isCloudInstance: false,
        };

        const editor = new ScriptEditor({
            savedState,
            standaloneMode: false,
            connectionId: -1,
            toolbarItemsTemplate: { navigation: [], execution: [], editor: [], auxiliary: [] },
        });

        (editor as unknown as {
            setState: (update: Partial<typeof editor.state>
                | ((state: typeof editor.state) => Partial<typeof editor.state>)) => void;
        }).setState = (update) => {
            const nextState = typeof update === "function" ? update(editor.state) : update;
            editor.state = { ...editor.state, ...nextState };
        };
        (editor as unknown as { resultRef: { current: HTMLDivElement; }; }).resultRef.current = document.createElement("div");

        const nextProps = {
            ...editor.props,
            savedState: {
                ...savedState,
                activeEntry: "2",
            },
        };
        editor.state = {
            ...editor.state,
            ...ScriptEditor.getDerivedStateFromProps(nextProps, editor.state),
        };
        (editor as unknown as { props: typeof nextProps; }).props = nextProps;

        (editor as unknown as { updatePresentationInterface: (restoreExistingResult?: boolean) => void; })
            .updatePresentationInterface(true);

        expect(presentationWithResults.onMount).toHaveBeenCalled();
        expect(presentationWithResults.setResult).toHaveBeenCalledWith(resultData, {
            currentSet: 0,
            manualHeight: 240,
            maximized: true,
        });
        expect(editor.state.hasResultContent).toBe(true);
        expect(editor.state.maximizeResultPane).toBe(true);
    });
});
