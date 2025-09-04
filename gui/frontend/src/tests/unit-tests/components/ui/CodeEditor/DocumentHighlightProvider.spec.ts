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

import { DocumentHighlightProvider } from "../../../../../components/ui/CodeEditor/DocumentHighlightProvider.js";
import { PresentationInterface } from "../../../../../script-execution/PresentationInterface.js";
import { ScriptingLanguageServices } from "../../../../../script-execution/ScriptingLanguageServices.js";
import { mockModel, position } from "../../../__mocks__/CodeEditorMocks.js";

// Mock the interface to avoid references to the monaco editor language services.
vi.mock("../../../../../script-execution/PresentationInterface.js");

describe("DocumentHighlightProvider tests", () => {

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Create instance and init", () => {
        const dhp = new DocumentHighlightProvider();
        expect(dhp).not.toBeNull();

        let result = dhp.provideDocumentHighlights(mockModel, position);
        expect(result).toBe(undefined);

        const pi = new PresentationInterface("javascript");
        vi.spyOn(pi, "model", "get").mockReturnValue(mockModel);
        vi.spyOn(pi, "endLine", "get").mockReturnValue(1);
        const execContext = mockModel.executionContexts!.addContext(pi);

        vi.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        result = dhp.provideDocumentHighlights(mockModel, position);
        expect(result).toBe(undefined);

        vi.spyOn(execContext, "isInternal", "get").mockReturnValue(false);
        const services = ScriptingLanguageServices.instance;
        services.findDefinition = vi.fn().mockReturnValue({
            uri: "",
            range: null,
        });
        result = dhp.provideDocumentHighlights(mockModel, position);
        expect(result).not.toBe(undefined);
    });
});
