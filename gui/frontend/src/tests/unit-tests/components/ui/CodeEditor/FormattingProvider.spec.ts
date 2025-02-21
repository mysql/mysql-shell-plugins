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

import { IPosition } from "monaco-editor";
import { StoreType } from "../../../../../app-logic/ApplicationDB.js";
import { FormattingProvider } from "../../../../../components/ui/CodeEditor/FormattingProvider.js";
import { ExecutionContext } from "../../../../../script-execution/ExecutionContext.js";
import { PresentationInterface } from "../../../../../script-execution/PresentationInterface.js";
import { ScriptingLanguageServices } from "../../../../../script-execution/ScriptingLanguageServices.js";
import { mockModel, mockTextModel } from "../../../__mocks__/CodeEditorMocks.js";

jest.mock("../../../../../script-execution/PresentationInterface");

describe("DocumentHighlightProvider tests", () => {

    it("Create instance and init", () => {
        const lang = { tabSize: 0, insertSpaces: false };
        const formattingProvider = new FormattingProvider();
        expect(formattingProvider).not.toBeNull();

        let result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);
        expect(result).toBeNull();

        const pi = new (PresentationInterface as unknown as jest.Mock<PresentationInterface>)();
        expect(pi).toBeDefined();

        const execContext = new ExecutionContext(pi, StoreType.Document);
        execContext.toLocal = jest.fn().mockImplementation((_value: IPosition): IPosition => {
            return { lineNumber: 0, column: 0 };
        });
        mockModel.executionContexts!.contextFromPosition = jest.fn().mockReturnValue(
            execContext,
        );
        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);
        expect(result).toBe(undefined);

        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(false);
        if (execContext.model) {
            execContext.model.isDisposed = jest.fn().mockReturnValue(false);
        } else {
            jest.spyOn(execContext, "model", "get").mockReturnValue(mockTextModel);
        }
        const services = ScriptingLanguageServices.instance;
        services.format = jest.fn().mockReturnValue({
            uri: "",
            range: null,
        });
        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);

        // TODO: Improve mocking to actually get a result.
        expect(result).toBeUndefined();

        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        jest.spyOn(execContext, "code", "get").mockReturnValue("my new test");
        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);

        // TODO: Improve mocking to actually get a result.
        expect(result).toBeUndefined();
    });
});
