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

import { mount, shallow } from "enzyme";
import { ICodeEditorModel, IEditorPersistentState } from "../../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../../../components/ui/CodeEditor/index.js";
import { ShellConsole } from "../../../../modules/shell/ShellConsole.js";
import { ExecutionContexts } from "../../../../script-execution/ExecutionContexts.js";

class TestShellConsole extends ShellConsole {
    public testHandleOptionsChanged = (): void => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        this.handleOptionsChanged();
    };

    public testContextRelativeLineNumbers = (originalLineNumber: number): string => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.contextRelativeLineNumbers(originalLineNumber);
    };
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

        const component = shallow<ShellConsole>(
            <ShellConsole
                editorState={editorState}
            />,
        );

        /*const props = component.dive().props();
        const componentWithoutName = component.dive().setProps({ ...props, name: undefined });

        expect(componentWithoutName).toMatchSnapshot();*/

        component.unmount();
    });

    it("Standard rendering", () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const component = mount(
            <ShellConsole
                editorState={editorState}
            />,
        );

        const editor = component.find("CodeEditor");
        expect(editor.length).toBe(1);
        expect(editor.props().font.fontFamily).toBe("var(--msg-monospace-font-family)");
        expect(editor.props().language).toBe("msg");

        component.unmount();
    });

    it("handleOptionsChanged function", () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const component = mount<TestShellConsole>(
            <TestShellConsole
                editorState={editorState}
            />,
        );

        component.instance().testHandleOptionsChanged();

        const statusBarItem = component.find("IStatusBarItem");
        expect(statusBarItem).toBeDefined();

        component.unmount();
    });

    it("contextRelativeLineNumbers function", () => {
        const editorState: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };

        const component = mount<TestShellConsole>(
            <TestShellConsole
                editorState={editorState}
            />,
        );

        let lineNumber = component.instance().testContextRelativeLineNumbers(1);

        expect(lineNumber).toEqual("");

        lineNumber = component.instance().testContextRelativeLineNumbers(10);

        expect(lineNumber).toEqual("10");

        component.unmount();
    });
});
