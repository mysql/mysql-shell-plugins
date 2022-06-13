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
import { StandaloneScriptEditor } from "../../../modules/db-editor/StandaloneScriptEditor";
import { Monaco } from "../../../components/ui/CodeEditor";
import {
    CodeEditor, CodeEditorMode, ICodeEditorModel, IEditorPersistentState,
} from "../../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts";
import {
    StandalonePresentationInterface,
} from "../../../modules/db-editor/execution/StandalonePresentationInterface";


describe("Standalone presentation interface tests", (): void => {

    let content = `\nprint("typescript");\n\\js\n`;
    content += `\nprint("javascript");\n\\sql\n`;
    content += `\nselect "(my)sql" from dual;\n\\py\n`;
    content += `\nprint("python");\n`;
    const model = Monaco.createModel("", "msg") as ICodeEditorModel;
    model.executionContexts = new ExecutionContexts(undefined, 80024, "", "");
    model.editorMode = CodeEditorMode.Standard;
    model.setValue(content);

    it("Standalone presentation interface instantiation", () => {
        const innerRef = React.createRef<HTMLDivElement>();
        const eps: IEditorPersistentState = {
            viewState: null,
            model,
            options: {},
        };
        const component = mount<StandaloneScriptEditor>(
            <StandaloneScriptEditor
                editorState={eps}
            />,
        );
        const spi = new StandalonePresentationInterface(
            new StandaloneScriptEditor({ editorState: eps }),
            new CodeEditor({ allowSoftWrap: true }),
            "sql",
            innerRef,
        );
        expect(spi.language).toEqual("sql");
        component.unmount();
    });
});
