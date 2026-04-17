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

import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeEditorMode, languages, Monaco } from "../../../components/ui/CodeEditor/index.js";

import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { MessageScheduler } from "../../../communication/MessageScheduler.js";
import { ShellAPIGui } from "../../../communication/ProtocolGui.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";
import { PresentationInterface } from "../../../script-execution/PresentationInterface.js";
import { ScriptingLanguageServices } from "../../../script-execution/ScriptingLanguageServices.js";
import { Settings } from "../../../supplement/Settings/Settings.js";
import { sleep } from "../../../utilities/helpers.js";

describe("ScriptingLanguageServices Tests", () => {
    const services = ScriptingLanguageServices.instance;

    afterEach(() => {
        Settings.set("editor.reformatter.breakSelectItems", false);
        vi.restoreAllMocks();
    });

    // TODO: cannot test the services, because workers are mocked.
    it("Code Completion", async () => {
        await sleep(1000);
        const jsModel: ICodeEditorModel = Object.assign(Monaco.createModel("", "javascript"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        if (jsModel.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            jsModel.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            // Necessary to counter the model version increase that happens when the other branch is taken.
            jsModel.setValue("");
        }

        const jsContext = jsModel.executionContexts!.addContext(new PresentationInterface("javascript"));

        const result = await services.getCodeCompletionItems(jsContext, { lineNumber: 1, column: 1 });
        const availableLanguages = languages as Partial<typeof languages>;
        if (availableLanguages.typescript) {
            expect(result).toBeDefined();
            expect(result?.suggestions.length).toBeGreaterThan(0);
        } else {
            expect(result).toBeUndefined();
        }
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

    it("Format MySQL", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            result: "SELECT 1",
        } as never);
        const range = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 9,
        };
        const editorRange = {
            startLineNumber: 7,
            startColumn: 1,
            endLineNumber: 7,
            endColumn: 9,
        };
        const context = {
            language: "mysql",
            sqlMode: "ANSI_QUOTES,NO_BACKSLASH_ESCAPES",
            code: "select 1",
            fromLocal: vi.fn().mockReturnValue(editorRange),
            model: {
                isDisposed: () => {
                    return false;
                },
            },
        };

        const result = await services.format(context as never, range, { tabSize: 2, insertSpaces: true });

        expect(sendRequest).toHaveBeenCalledWith({
            requestType: ShellAPIGui.GuiSqlEditorReformat,
            caseConversionIgnores: ["options"],
            parameters: {
                args: {
                    sql: "select 1",
                    options: {
                        indentWidth: 4,
                        keywordCase: "upper",
                        quoteIdentifiers: false,
                        maxInlineLength: 80,
                        breakSelectItems: false,
                        breakFunctionArgs: false,
                        tableOptionsPerLine: false,
                        ansiQuotes: true,
                        noBackslashEscapes: true,
                    },
                },
            },
        });
        expect(context.fromLocal).toHaveBeenCalledWith(range);
        expect(result).toEqual([{
            range: editorRange,
            text: "SELECT 1",
            eol: Monaco.EndOfLineSequence.LF,
        }]);
    });

    it("does not format SQLite through the MySQL formatter", async () => {
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest").mockResolvedValue({
            result: "SELECT 1",
        } as never);
        const range = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 9,
        };
        const context = {
            language: "sql",
            sqlMode: "",
            code: "select 1",
            fromLocal: vi.fn().mockImplementation((value: typeof range): typeof range => {
                return value;
            }),
            model: {
                isDisposed: () => {
                    return false;
                },
            },
        };

        const result = await services.format(context as never, range, { tabSize: 4, insertSpaces: true });

        expect(sendRequest).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
    });

    it("passes Break SELECT Items to the SQL formatter", async () => {
        const compactSql = [
            "SELECT customer_id, first_name, last_name, email",
            "FROM",
            "    customer",
            "WHERE",
            "    active = 1;",
        ].join("\n");
        const formattedSql = [
            "SELECT",
            "    customer_id,",
            "    first_name,",
            "    last_name,",
            "    email",
            "FROM",
            "    customer",
            "WHERE",
            "    active = 1;",
        ].join("\n");
        const sendRequest = vi.spyOn(MessageScheduler.get, "sendRequest")
            .mockResolvedValueOnce({ result: compactSql } as never)
            .mockResolvedValueOnce({ result: formattedSql } as never);
        const range = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 77,
        };
        const context = {
            language: "mysql",
            sqlMode: "",
            code: "select customer_id, first_name, last_name, email from customer where active = 1;",
            fromLocal: vi.fn().mockImplementation((value: typeof range): typeof range => {
                return value;
            }),
            model: {
                isDisposed: () => {
                    return false;
                },
            },
        };

        Settings.set("editor.reformatter.breakSelectItems", false);
        const compactResult = await services.format(context as never, range, { tabSize: 4, insertSpaces: true });

        expect(sendRequest.mock.calls[0]?.[0]).toMatchObject({
            caseConversionIgnores: ["options"],
            parameters: {
                args: {
                    options: {
                        breakSelectItems: false,
                    },
                },
            },
        });
        expect(compactResult?.[0].text).toBe(compactSql);

        Settings.set("editor.reformatter.breakSelectItems", true);
        const formattedResult = await services.format(context as never, range, { tabSize: 4, insertSpaces: true });

        expect(sendRequest.mock.calls[1]?.[0]).toMatchObject({
            caseConversionIgnores: ["options"],
            parameters: {
                args: {
                    options: {
                        breakSelectItems: true,
                    },
                },
            },
        });
        expect(formattedResult?.[0].text).toBe(formattedSql);
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
