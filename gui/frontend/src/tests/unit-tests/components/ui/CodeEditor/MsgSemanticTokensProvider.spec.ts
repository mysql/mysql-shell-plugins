/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { CodeEditorMode, Monaco, tokenModifiers, tokenTypes } from "../../../../../components/ui/CodeEditor/index.js";
import { ICodeEditorModel } from "../../../../../components/ui/CodeEditor/CodeEditor.js";
import { MsgSemanticTokensProvider } from "../../../../../components/ui/CodeEditor/MsgSemanticTokensProvider.js";
import {
    EmbeddedPresentationInterface,
} from "../../../../../modules/db-editor/execution/EmbeddedPresentationInterface.js";
import { ExecutionContexts } from "../../../../../script-execution/ExecutionContexts.js";
import { PresentationInterface } from "../../../../../script-execution/PresentationInterface.js";
import { nextProcessTick } from "../../../test-helpers.js";

jest.mock("../../../../../script-execution/PresentationInterface");

describe("MsgSemanticTokensProvider Tests", () => {
    const provider = new MsgSemanticTokensProvider();

    it("Token Types and Modifiers", () => {
        expect(tokenTypes).toEqual([
            "keyword",
            "identifier",
            "operator",
            "delimiter",
            "markup",
            "number",
            "string",
            "comment",
            "regexp",
            "support",
            "entity",
            "type",
            "operator",
            "namespace",
            "struct",
            "class",
            "interface",
            "enum",
            "typeParameter",
            "function",
            "member",
            "macro",
            "variable",
            "parameter",
            "property",
            "label",
            "command",
        ]);
        expect(tokenModifiers).toEqual([
            "other",
            "bracket",
            "square",
            "parenthesis",
            "float",
            "hex",
            "octal",
            "binary",
            "regexp",
            "escape",
            "invalid",
            "control",
            "line",
            "block",
            "doc",
            "quoted",
            "single",
            "double",
            "function",
            "variable",
            "user",
            "system",
            "entity",
            "name",
            "identifier",
            "language",
            "predefined",
            "angle",
        ]);

        const legend = provider.getLegend();
        expect(legend.tokenTypes).toEqual(tokenTypes);
        expect(legend.tokenModifiers).toEqual(tokenModifiers);
    });

    it("Empty Model", async () => {
        const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "javascript"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const cancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => { return { dispose: () => { /**/ } }; },
        };

        const tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens).toBeInstanceOf(Object);
        expect(tokens).toHaveProperty("data");

        expect(tokens.data).toBeInstanceOf(Uint32Array);
        expect(tokens.data).toHaveLength(0);
    });

    it("Single Language Model (MySQL)", async () => {
        const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "mysql"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const cancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => { return { dispose: () => { /**/ } }; },
        };

        const presentation = new PresentationInterface({ getModel: () => { return model; } }, "mysql");
        model.executionContexts?.addContext(presentation);
        await nextProcessTick(); // To allow the new context to process the text.

        let tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens.data).toHaveLength(0);

        model.setValue("SELECT * FROM t1;");
        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);

        // TODO: enable once we switched to vitest. Cannot test web workers with jest.
        // expect(tokens.data).toHaveLength(5 * 5);
    });

    it("Mixed Language Model with 3 Blocks in a Row with the same Language", async () => {
        let model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const cancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => { return { dispose: () => { /**/ } }; },
        };

        const sqlPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "sql");
        model.executionContexts?.addContext(sqlPresentation);
        model.executionContexts?.addContext(sqlPresentation);
        model.executionContexts?.addContext(sqlPresentation);
        await nextProcessTick(); // To allow the new context to process the text.

        let tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens.data).toHaveLength(0);

        model.setValue("SELECT * FROM t1;");
        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);

        // expect(tokens.data).toHaveLength(5 * 5);

        model = Object.assign(Monaco.createModel("", "msg"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const jsPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "javascript");
        model.executionContexts?.addContext(jsPresentation);
        model.executionContexts?.addContext(jsPresentation);
        model.executionContexts?.addContext(jsPresentation);
        await nextProcessTick();

        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens.data).toHaveLength(0);

        model.setValue("Math.random();");
        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);

        // expect(tokens.data).toHaveLength(5 * 5);

        model = Object.assign(Monaco.createModel("", "msg"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const tsPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "typescript");
        model.executionContexts?.addContext(tsPresentation);
        model.executionContexts?.addContext(tsPresentation);
        model.executionContexts?.addContext(tsPresentation);
        await nextProcessTick();

        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens.data).toHaveLength(0);

        model.setValue("const a: number = 123;");
        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);

        // expect(tokens.data).toHaveLength(7 * 5);
    });

    it("Mixed Language Model with All Supported Block Languages", async () => {
        const model: ICodeEditorModel = Object.assign(Monaco.createModel("", "msg"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const cancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => { return { dispose: () => { /**/ } }; },
        };

        const sqlPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "sql");
        model.executionContexts?.addContext(sqlPresentation);
        const jsPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "javascript");
        model.executionContexts?.addContext(jsPresentation);
        const tsPresentation = new EmbeddedPresentationInterface({ getModel: () => { return model; } },
            () => { return false; }, "typescript");
        model.executionContexts?.addContext(tsPresentation);
        await nextProcessTick();

        let tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);
        expect(tokens.data).toHaveLength(0);

        model.setValue("SELECT * FROM t1;\nMath.random();\nconst a: number = 123;");
        tokens = await provider.provideDocumentSemanticTokens(model, null, cancellationToken);

        // expect(tokens.data).toHaveLength(17 * 5);

    });
});
