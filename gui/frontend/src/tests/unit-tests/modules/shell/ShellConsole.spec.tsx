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

import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import { createRef } from "preact";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../../components/ui/CodeEditor/index.js";
import { ShellConsole } from "../../../../modules/shell/ShellConsole.js";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts.js";
import { nextRunLoop } from "../../test-helpers.js";

// @ts-expect-error, we need access to a private members here.
class TestShellConsole extends ShellConsole {
    declare public handleOptionsChanged: () => void;
    declare public contextRelativeLineNumbers: (originalLineNumber: number) => string;
}

describe("ShellConsole tests", (): void => {
    const content = 'print("typescript");';

    const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
        executionContexts: new ExecutionContexts(),
        editorMode: CodeEditorMode.Standard,
    });

    model.setEOL(Monaco.EndOfLineSequence.LF);
    model.setValue(content);

    it("Matching snapshot", () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const { container, unmount } = render(
            <ShellConsole
                editorState={editorState}
            />,
        );

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("handleOptionsChanged function", async () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const consoleRef = createRef<TestShellConsole>();
        const { container, unmount } = render(
            <TestShellConsole
                ref={consoleRef}
                editorState={editorState}
            />,
        );

        await nextRunLoop();
        expect(consoleRef.current).toBeDefined();

        consoleRef.current!.handleOptionsChanged();

        const statusBarItem = container.querySelector("IStatusBarItem");
        expect(statusBarItem).toBeDefined();

        unmount();
    });

    it("contextRelativeLineNumbers function", async () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const consoleRef = createRef<TestShellConsole>();
        const { unmount } = render(
            <TestShellConsole
                ref={consoleRef}
                editorState={editorState}
            />,
        );

        await nextRunLoop();
        expect(consoleRef.current).toBeDefined();

        let lineNumber = consoleRef.current!.contextRelativeLineNumbers(1);

        expect(lineNumber).toEqual("");

        lineNumber = consoleRef.current!.contextRelativeLineNumbers(10);

        expect(lineNumber).toEqual("10");

        unmount();
    });
});
