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
import { IPosition } from "../../../../../components/ui/CodeEditor";
import { CodeCompletionProvider } from "../../../../../components/ui/CodeEditor/CodeCompletionProvider";
import { ExecutionContext } from "../../../../../script-execution";
import { PresentationInterface } from "../../../../../script-execution/PresentationInterface";
import { models, position } from "../../../__mocks__/CodeEditorMocks";

jest.mock("../../../../../script-execution/PresentationInterface");

describe("CodeCompletionProvider basic test", () => {

    it("Create instance and init", () => {
        const completionProvider = new CodeCompletionProvider();

        expect(completionProvider.triggerCharacters).toEqual(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.\\@(".split(""),
        );
        let items = completionProvider.provideCompletionItems(models, position);
        expect(items).toBeNull();

        const pi = new (PresentationInterface as unknown as jest.Mock<PresentationInterface>)();
        expect(pi).toBeDefined();

        pi.context = new ExecutionContext(pi);
        expect(pi.context).toBeDefined();

        const execContext = new ExecutionContext(pi);
        execContext.toLocal = jest.fn().mockImplementation((_value: IPosition): IPosition => {
            return { lineNumber: 0, column: 0};
        });
        models.executionContexts.contextFromPosition = jest.fn().mockReturnValue(
            execContext,
        );
        items = completionProvider.provideCompletionItems(models, position);
        expect(items).not.toBeNull();

        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        models.getWordUntilPosition = jest.fn().mockReturnValue({ startColumn: 10, endColumn: 10} );
        items = completionProvider.provideCompletionItems(models, position);
        expect(items).not.toBeNull();

    });
});
