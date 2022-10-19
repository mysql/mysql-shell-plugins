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

import { IPosition } from "monaco-editor";
import { FormattingProvider } from "../../../../../components/ui/CodeEditor/FormattingProvider";
import { ExecutionContext, PresentationInterface } from "../../../../../script-execution";
import { ScriptingLanguageServices } from "../../../../../script-execution/ScriptingLanguageServices";
import { mockTextModel, models } from "../../../__mocks__/CodeEditorMocks";

jest.mock("../../../../../script-execution/PresentationInterface");

describe("DocumentHighlightProvider tests", () => {

    it("Create instance and init", () => {
        const lang = { tabSize: 0, insertSpaces: false };
        const formattingProvider = new FormattingProvider();
        expect(formattingProvider).not.toBeNull();

        let result = formattingProvider.provideDocumentFormattingEdits(models, lang);
        expect(result).toBe(undefined);

        const pi = new (PresentationInterface as unknown as jest.Mock<PresentationInterface>)();
        expect(pi).toBeDefined();

        const execContext = new ExecutionContext(pi);
        execContext.toLocal = jest.fn().mockImplementation((_value: IPosition): IPosition => {
            return { lineNumber: 0, column: 0 };
        });
        models.executionContexts.contextFromPosition = jest.fn().mockReturnValue(
            execContext,
        );
        result = formattingProvider.provideDocumentFormattingEdits(models, lang);
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
        result = formattingProvider.provideDocumentFormattingEdits(models, lang);
        expect(result).not.toBe(undefined);

        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        jest.spyOn(execContext, "code", "get").mockReturnValue("my new test");
        result = formattingProvider.provideDocumentFormattingEdits(models, lang);
        expect(result).not.toBe(undefined);
    });
});
