/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { describe, expect, it, vi } from "vitest";

import { MessageType } from "../../../../../app-logic/general-types.js";
import { ScriptEditor } from "../../../../../modules/db-editor/ScriptEditor.js";
import {
    StandalonePresentationInterface,
} from "../../../../../modules/db-editor/execution/StandalonePresentationInterface.js";

describe("Standalone presentation interface tests", (): void => {
    it("keeps the embedded result pane visible when results are removed", () => {
        const setState = vi.fn();
        const host = {
            setState,
        } as unknown as ScriptEditor;
        const target = { current: document.createElement("div") };
        const presentation = new StandalonePresentationInterface("mysql");

        presentation.onMount(target, host);

        (presentation as unknown as { removeRenderTarget: () => void }).removeRenderTarget();

        expect(setState).toHaveBeenCalledWith({
            showResultPane: true,
            maximizeResultPane: false,
            hasResultContent: false,
        });

        presentation.dispose();
    });

    it("keeps the output tab when result sets have no textual output", () => {
        const host = {
            setState: vi.fn(),
        } as unknown as ScriptEditor;
        const targetElement = document.createElement("div");
        document.body.append(targetElement);

        const presentation = new StandalonePresentationInterface("mysql");
        presentation.onMount({ current: targetElement }, host);
        presentation.context = {
            id: "ctx-1",
        } as never;
        presentation.activate({
            getModel: () => {
                return null;
            },
        } as never);

        presentation.setResult({
            type: "resultSets",
            sets: [{
                type: "resultSet",
                resultId: "result-1",
                fullTableName: "",
                sql: "select 1",
                updatable: false,
                columns: [],
                data: {
                    rows: [{ value: 1 }],
                    currentPage: 0,
                    executionInfo: {
                        type: MessageType.Info,
                        text: "1 row returned",
                    },
                },
            }],
        });

        expect(targetElement.querySelector("#output")).toBeTruthy();

        presentation.dispose();
        targetElement.remove();
    });

    it("keeps image result sets with no rows when restoring results", () => {
        const host = {
            setState: vi.fn(),
        } as unknown as ScriptEditor;
        const targetElement = document.createElement("div");
        document.body.append(targetElement);

        const presentation = new StandalonePresentationInterface("mysql");
        presentation.onMount({ current: targetElement }, host);
        presentation.context = {
            id: "ctx-1",
        } as never;
        presentation.activate({
            getModel: () => {
                return null;
            },
        } as never);

        presentation.setResult({
            type: "resultSets",
            sets: [{
                type: "resultSet",
                resultId: "image-result",
                fullTableName: "",
                sql: "select 1",
                updatable: false,
                columns: [],
                viewType: "image",
                image: {
                    mimeType: "image/svg+xml",
                    data:
                        "<svg id=\"mysqlVisualExplain\" xmlns=\"http://www.w3.org/2000/svg\" " +
                        "width=\"10\" height=\"10\"><g data-estimated_total_cost=\"1\">" +
                        "<rect width=\"10\" height=\"10\" /></g></svg>",
                    caption: "Visual Explain",
                },
                caption: "Visual Explain",
                data: {
                    rows: [],
                    currentPage: 0,
                    executionInfo: {
                        type: MessageType.Info,
                        text: "OK, visual explain generated",
                    },
                },
            }],
        });

        expect(targetElement.querySelector(".imageResultView")).toBeTruthy();
        expect(targetElement.querySelector("svg#mysqlVisualExplain")).toBeTruthy();

        presentation.dispose();
        targetElement.remove();
    });
});
