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

import { CodeEditorMode, Monaco } from "../../../components/ui/CodeEditor";

import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts";
import { PresentationInterface } from "../../../script-execution/PresentationInterface";
import { ScriptingLanguageServices } from "../../../script-execution/ScriptingLanguageServices";
import { sleep } from "../../../utilities/helpers";

// TODO: using this code leads to a crash because the typescript language support is not loaded in time.
// Needs investigation what breaks it, as it seems to work fine when doing the editor tests.
describe("ScriptingLanguageServices Tests", () => {
    const services = ScriptingLanguageServices.instance;

    xit("Code Completion", async () => {
        await sleep(1000);
        const jsModel = Monaco.createModel("", "javascript") as ICodeEditorModel;
        if (jsModel.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            jsModel.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            // Necessary to counter the model version increase that happens when the other branch is taken.
            jsModel.setValue("");
        }

        jsModel.executionContexts = new ExecutionContexts(undefined, 80024, "", "");
        jsModel.editorMode = CodeEditorMode.Standard;
        const jsContext = jsModel.executionContexts.addContext(new PresentationInterface(undefined, "javascript"));

        const result = await services.getCodeCompletionItems(jsContext, { lineNumber: 1, column: 1 });
        expect(result).toBeDefined();
        expect(result?.suggestions.length).toBeGreaterThan(0);
    });

    it("Code Hint", () => {
        // TODO
    });

    it("Validation", () => {
        // TODO
    });

    it("Signature Help", () => {
        // TODO
    });

    it("Document Highlight", () => {
        // TODO
    });

    it("Symbol Rename", () => {
        // TODO
    });

    it("Peek Definition", () => {
        // TODO
    });

    it("Peek References", () => {
        // TODO
    });

    it("Format", () => {
        // TODO
    });

    it("Statement Ranges", () => {
        // TODO
    });

    it("Query Type", () => {
        // TODO
    });

    it("Statement Pre-Procession", () => {
        // TODO
    });

    it("Statement Check + Semicolon Handling", () => {
        // TODO
    });

    it("Extract Query Parameters", () => {
        // TODO
    });
});
