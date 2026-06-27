/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { describe, expect, it } from "vitest";

import { OdmEntityType } from "../../../../data-models/OpenDocumentDataModel.js";
import type { IOpenDocumentState } from "../../../../modules/db-editor/ConnectionWorkspace.js";
import {
    getDefaultDocumentFileName, getOpenDocumentDisplayCaption, getUntitledFileIndex,
} from "../../../../modules/db-editor/DocumentCaptionHelpers.js";

describe("DocumentModule caption tests", (): void => {
    it("prefers the known file name for document captions", () => {
        const openDocumentState = {
            document: {
                caption: "Notebook 1",
            },
            currentVersion: 0,
            fileName: "/tmp/query-results.sql",
        } as unknown as IOpenDocumentState;

        expect(getOpenDocumentDisplayCaption(openDocumentState)).toBe("query-results.sql");
    });

    it("uses Untitled for unsaved script and notebook captions", () => {
        const scriptState = {
            document: {
                caption: "Script 1",
                type: OdmEntityType.Script,
                language: "mysql",
            },
            currentVersion: 0,
        } as unknown as IOpenDocumentState;
        const notebookState = {
            document: {
                caption: "Notebook 1",
                type: OdmEntityType.Notebook,
            },
            currentVersion: 0,
        } as unknown as IOpenDocumentState;

        expect(getOpenDocumentDisplayCaption(scriptState)).toBe("Untitled.sql");
        expect(getOpenDocumentDisplayCaption(notebookState)).toBe("Untitled.mysql-notebook");
    });

    it("uses duplicate numbering in the generated default file name", () => {
        const scriptState = {
            document: {
                caption: "Script 1",
                type: OdmEntityType.Script,
                language: "mysql",
            },
            currentVersion: 0,
        } as unknown as IOpenDocumentState;

        expect(getUntitledFileIndex("Local MySQL", "Local MySQL (2)")).toBe(1);
        expect(getDefaultDocumentFileName(scriptState, "Local MySQL", "Local MySQL (2)")).toBe("Untitled-1.sql");
        expect(getOpenDocumentDisplayCaption(scriptState, {
            connectionCaption: "Local MySQL",
            pageCaption: "Local MySQL (2)",
        })).toBe("Untitled-1.sql");
    });
});
