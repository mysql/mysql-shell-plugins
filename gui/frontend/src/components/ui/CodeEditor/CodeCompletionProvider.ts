/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import {
    languages, Position, ProviderResult, CompletionList, CompletionItem, IRange, IProviderEditorModel, CodeEditorMode,
} from "./index.js";
import { ScriptingLanguageServices } from "../../../script-execution/ScriptingLanguageServices.js";

export class CodeCompletionProvider implements languages.CompletionItemProvider {

    public readonly triggerCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.\\@(".split("");

    public provideCompletionItems(model: IProviderEditorModel, position: Position): ProviderResult<CompletionList> {

        const services = ScriptingLanguageServices.instance;
        const sourceContext = model.executionContexts?.contextFromPosition(position);
        if (sourceContext) {
            if (sourceContext.isInternal) {
                const info = model.getWordUntilPosition(position);
                const replaceRange: IRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: info.startColumn - 1,
                    endLineNumber: position.lineNumber,
                    endColumn: info.endColumn - 1,
                };

                return {
                    incomplete: false,
                    suggestions: this.createInternalCompletionItems(replaceRange, model.editorMode),
                };
            }

            return services.getCodeCompletionItems(sourceContext, position);
        }
    }

    /*public resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        /*const services = CodeEditorLanguageServices.instance;
        const sourceContext = new SourceContext(model, model.executionBlocks.blockFromPosition(position));

        if (sourceContext.isInternal) {
            return services.resolve(sourceContext, item);
        }

        return item;
    }*/

    /**
     * Creates a list of items for our internal commands.
     *
     * @param range The character range for the items.
     * @param mode Determines what to show for the editor.
     *
     * @returns A list of completion items.
     */
    private createInternalCompletionItems(range: IRange, mode: CodeEditorMode): CompletionItem[] {
        switch (mode) {
            case CodeEditorMode.Terminal: {
                return [
                    {
                        label: "\\about",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\about",
                        detail: "Shows some general information.",
                    },
                    {
                        label: "\\sql",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\sql",
                        detail: "Executes SQL statement or switches to SQL processing mode when no statement is given.",
                    },
                    {
                        label: "\\js",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\js",
                        detail: "Command to switch the session to JavaScript mode",
                    },
                    {
                        label: "\\py",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\py",
                        detail: "Command to switch the session to Python mode",
                    },
                    {
                        label: "\\?",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\?",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\help",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\help",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\h",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\h",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\connect",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\connect",
                        detail: "Connects the shell to a MySQL server and assigns the global session.",
                    },
                    {
                        label: "\\c",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\c",
                        detail: "Connects the shell to a MySQL server and assigns the global session.",
                    },
                    {
                        label: "\\disconnect",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\disconnect",
                        detail: "Disconnects the current MySQL connection.",
                    },
                    {
                        label: "\\exit",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\exit",
                        detail: "Closes the session and the session tab, same as \\quit.",
                    },
                    {
                        label: "\\option",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\option",
                        detail: "Allows working with the available shell options.",
                    },
                    {
                        label: "\\quit",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\quit",
                        detail: "Closes the session and the session tab",
                    },
                    {
                        label: "\\q",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\q",
                        detail: "Closes the session and the session tab",
                    },
                    {
                        label: "\\reconnect",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\reconnect",
                        detail: "Reconnects the current MySQL connection",
                    },
                    {
                        label: "\\show",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\show",
                        detail: "Executes the given report with provided options and arguments",
                    },
                    {
                        label: "\\status",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\status",
                        detail: "Print information about the current session",
                    },
                    {
                        label: "\\s",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\s",
                        detail: "Print information about the current session",
                    },
                    {
                        label: "\\use",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\use",
                        detail: "Sets the active schema",
                    },
                    {
                        label: "\\u",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\u",
                        detail: "Sets the active schema",
                    },
                ];
            }

            default: {
                return [
                    {
                        label: "\\about",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\about",
                        detail: "Shows some general information.",
                    },
                    {
                        label: "\\sql",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\sql",
                        detail: "Executes SQL statement or switches to SQL processing mode when no statement is given.",
                    },
                    {
                        label: "\\js",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\js",
                        detail: "Command to switch the session to JavaScript mode",
                    },
                    {
                        label: "\\ts",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\ts",
                        detail: "Command to switch the session to TypeScript mode",
                    },
                    {
                        label: "\\?",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\?",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\help",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\help",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\h",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\h",
                        detail: "Prints help information about a specific topic",
                    },
                    {
                        label: "\\reconnect",
                        kind: languages.CompletionItemKind.Keyword,
                        range,
                        insertText: "\\reconnect",
                        detail: "Reconnects the current MySQL connection.",
                    },
                ];
            }
        }
    }
}
