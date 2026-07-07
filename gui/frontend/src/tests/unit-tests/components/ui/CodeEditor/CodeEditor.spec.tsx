/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@testing-library/preact";
import { CodeEditor, type IEditorPersistentState } from "../../../../../components/ui/CodeEditor/CodeEditor.js";
import { KeyCode, KeyMod } from "../../../../../components/ui/CodeEditor/index.js";
import { requisitions } from "../../../../../supplement/Requisitions.js";
import { mockModel } from "../../../__mocks__/CodeEditorMocks.js";

interface IEditorAction {
    id: string;
    run: () => void;
    label?: string;
    keybindings?: number[];
    contextMenuGroupId?: string;
    contextMenuOrder?: number;
    precondition?: string;
}

describe("CodeEditor component tests", (): void => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("Standard Rendering", () => {
        const { container, unmount } = render(
            <CodeEditor />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("routes save shortcuts through the provided save handler", async () => {
        vi.spyOn(requisitions, "register").mockImplementation(() => {
            return undefined;
        });

        const onSave = vi.fn();
        const actions = new Map<string, IEditorAction>();
        const editor = {
            addAction: vi.fn((action: IEditorAction) => {
                actions.set(action.id, action);

                return { dispose: vi.fn() };
            }),
            onDidChangeCursorPosition: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidChangeModelContent: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidPaste: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidScrollChange: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidChangeModelOptions: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            getDomNode: vi.fn(),
            dispose: vi.fn(),
        };

        const instance = new CodeEditor({ onSave });
        // @ts-expect-error accessing private members for focused action wiring verification
        instance.editor = editor;
        // @ts-expect-error accessing private method for focused action wiring verification
        instance.prepareUse();

        actions.get("save")?.run();
        actions.get("saveAs")?.run();
        await Promise.resolve();

        expect(onSave).toHaveBeenNthCalledWith(1, false);
        expect(onSave).toHaveBeenNthCalledWith(2, true);
    });

    it("registers notebook history actions with macOS shortcuts and navigation context", () => {
        const userAgentSpy = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Macintosh");
        const actions = new Map<string, IEditorAction>();
        const canGoBackSet = vi.fn();
        const canGoForwardSet = vi.fn();
        const editor = {
            addAction: vi.fn((action: IEditorAction) => {
                actions.set(action.id, action);

                return { dispose: vi.fn() };
            }),
            createContextKey: vi.fn((key: string) => {
                return {
                    key,
                    set: key === "notebookCanGoBackInHistory" ? canGoBackSet : canGoForwardSet,
                };
            }),
            onDidChangeCursorPosition: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidChangeModelContent: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidPaste: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidScrollChange: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            onDidChangeModelOptions: vi.fn(() => {
                return { dispose: vi.fn() };
            }),
            getDomNode: vi.fn(),
            dispose: vi.fn(),
        };
        const navigateHistory = vi.fn();

        const instance = new CodeEditor({
            language: "msg",
            notebookHistory: {
                navigate: navigateHistory,
                canGoBack: true,
                canGoForward: false,
            },
        });
        // @ts-expect-error accessing private members for focused action wiring verification
        instance.editor = editor;
        // @ts-expect-error accessing private method for focused action wiring verification
        instance.prepareUse();
        // @ts-expect-error accessing private method for focused action wiring verification
        instance.syncNotebookHistoryContextKeys();

        expect(actions.get("notebookPreviousCommand")).toMatchObject({
            label: "Previous Command",
            keybindings: [KeyMod.CtrlCmd | KeyCode.UpArrow],
            contextMenuGroupId: "navigation",
            contextMenuOrder: 1,
            precondition: expect.stringContaining("notebookCanGoBackInHistory"),
        });
        expect(actions.get("notebookNextCommand")).toMatchObject({
            label: "Next Command",
            keybindings: [KeyMod.CtrlCmd | KeyCode.DownArrow],
            contextMenuGroupId: "navigation",
            contextMenuOrder: 2,
            precondition: expect.stringContaining("notebookCanGoForwardInHistory"),
        });

        actions.get("notebookPreviousCommand")?.run();
        actions.get("notebookNextCommand")?.run();

        expect(navigateHistory).toHaveBeenNthCalledWith(1, true);
        expect(navigateHistory).toHaveBeenNthCalledWith(2, false);
        expect(canGoBackSet).toHaveBeenCalledWith(true);
        expect(canGoForwardSet).toHaveBeenCalledWith(false);

        userAgentSpy.mockRestore();
    });

    it("does not refocus Monaco on ordinary updates when autoFocus is already active", () => {
        const savedState: IEditorPersistentState = {
            model: mockModel,
            options: {},
            viewState: null,
        };
        const focus = vi.fn();
        const editor = {
            getModel: vi.fn(() => {
                return savedState.model;
            }),
            layout: vi.fn(),
            focus,
        };

        const instance = new CodeEditor({ savedState, autoFocus: true });
        // @ts-expect-error accessing private member for focused lifecycle verification
        instance.editor = editor;

        instance.componentDidUpdate({ ...instance.props });

        expect(focus).not.toHaveBeenCalled();
    });

    it("refocuses Monaco when autoFocus is active and the editor model changes", () => {
        const previousSavedState: IEditorPersistentState = {
            model: mockModel,
            options: {},
            viewState: null,
        };
        const savedState: IEditorPersistentState = {
            model: {
                ...mockModel,
                id: "nextModel",
            },
            options: {},
            viewState: null,
        };
        const focus = vi.fn();
        const editor = {
            getModel: vi.fn(() => {
                return savedState.model;
            }),
            layout: vi.fn(),
            focus,
        };

        const instance = new CodeEditor({ savedState, autoFocus: true });
        // @ts-expect-error accessing private member for focused lifecycle verification
        instance.editor = editor;

        instance.componentDidUpdate({ ...instance.props, savedState: previousSavedState });

        expect(focus).toHaveBeenCalledOnce();
    });

});
