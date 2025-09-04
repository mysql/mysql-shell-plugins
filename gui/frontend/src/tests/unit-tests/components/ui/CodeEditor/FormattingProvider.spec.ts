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

import { afterAll, describe, expect, it, vi } from "vitest";

import { FormattingProvider } from "../../../../../components/ui/CodeEditor/FormattingProvider.js";
import { PresentationInterface } from "../../../../../script-execution/PresentationInterface.js";
import { ScriptingLanguageServices } from "../../../../../script-execution/ScriptingLanguageServices.js";
import { mockModel } from "../../../__mocks__/CodeEditorMocks.js";

describe("DocumentHighlightProvider tests", () => {

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Create instance and init", () => {
        const lang = { tabSize: 0, insertSpaces: false };
        const formattingProvider = new FormattingProvider();

        const pi = new PresentationInterface("javascript");
        const execContext = mockModel.executionContexts!.addContext(pi);
        vi.spyOn(pi, "model", "get").mockReturnValue(mockModel);
        vi.spyOn(pi, "endLine", "get").mockReturnValue(1);
        vi.spyOn(execContext, "isInternal", "get").mockReturnValue(true);

        let result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);
        expect(result).toBeUndefined();

        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);
        expect(result).toBeUndefined();

        vi.spyOn(execContext, "isInternal", "get").mockReturnValue(false);
        const services = ScriptingLanguageServices.instance;
        services.format = vi.fn().mockReturnValue({
            uri: "",
            range: null,
        });
        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);

        // TODO: Improve mocking to actually get a result.
        expect(result).toBeUndefined();

        vi.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        vi.spyOn(execContext, "code", "get").mockReturnValue("my new test");
        result = formattingProvider.provideDocumentFormattingEdits(mockModel, lang);

        // TODO: Improve mocking to actually get a result.
        expect(result).toBeUndefined();
    });
});
