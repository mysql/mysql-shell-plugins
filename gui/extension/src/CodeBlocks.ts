/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import * as path from "path";

import {
    DecorationRangeBehavior, ExtensionContext, OverviewRulerLane, Range, TextDocument, TextDocumentChangeEvent,
    TextDocumentShowOptions, TextEditor, TextEditorDecorationType, Uri, ViewColumn, window, workspace,
} from "vscode";

import { CharStream, CommonTokenStream } from "antlr4ng";

import { PythonLexer } from "../../frontend/src/parsing/python/generated/PythonLexer.js";

import { ui } from "../../frontend/src/app-logic/UILayer.js";
import {
    ICodeBlockExecutionOptions, IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../frontend/src/supplement/RequisitionTypes.js";
import { requisitions } from "../../frontend/src/supplement/Requisitions.js";
import { printChannelOutput } from "./extension.js";

/** A record of white spaces in a code block, which must be re-applied when replacing the original block. */
interface IWhiteSpaces {
    leading: string;
    indentation: string;
    trailing: string;
}

/** Describes a block of code that was sent to the application. */
interface ILinkedCodeBlock {
    /** A unique id to link code blocks between the extension and the app. */
    id: number;

    /** The code as it was when the span was created. Allows to compare for code updates. */
    originalCode: string;

    whiteSpaces: IWhiteSpaces;

    /** The start offset of the code block in the text editor document. */
    start: number;

    /** The length of the code block in characters. */
    length: number;
}

/** A class to manage code blocks that are synchronized with the web app. */
export class CodeBlocks {
    private static nextSpanId = 1;

    // Decoration handle for code markup.
    private blockDecorationType: TextEditorDecorationType;

    // All marked code ranges we manage here. These are linked to an editor in the web app.
    private codeBlocks = new Map<Uri, ILinkedCodeBlock[]>();

    public setup(context: ExtensionContext): void {
        this.initializeBlockDecorations();

        requisitions.register("proxyRequest", this.proxyRequest);

        // Ensure the code block markers are actually deleted when the document closes
        context.subscriptions.push(workspace.onDidCloseTextDocument((document: TextDocument) => {
            if (document.uri.scheme === "file") {
                this.codeBlocks.delete(document.uri);
            }
        }));

        context.subscriptions.push(window.onDidChangeActiveTextEditor((editor?: TextEditor) => {
            if (editor && this.codeBlocks.has(editor.document.uri)) {
                this.updateCodeDecorations(editor.document);
            }
        }));

        context.subscriptions.push(workspace.onDidChangeTextDocument((event: TextDocumentChangeEvent) => {
            const spans = this.codeBlocks.get(event.document.uri);
            if (spans) {
                event.contentChanges.forEach((change) => {
                    const changeLength = change.text.length - change.rangeLength;

                    // Check all spans if they overlap the current change. If the change goes beyond an affected span
                    // remove that span entirely. Otherwise update the length of the span (there can only be one).
                    let startIndex = -1;
                    let count = 0;
                    spans.forEach((current, index) => {
                        if (this.spansOverlap(current.start, current.length, change.rangeOffset, changeLength)) {
                            if (startIndex === -1) {
                                startIndex = index;
                            }
                            ++count;
                        }
                    });

                    let needUpdate = false;
                    if (count > 0) {
                        // If only one span was touched but the change range goes beyond the span's range,
                        // this is also a reason to remove that span.
                        const startSpan = spans[startIndex];
                        if (count > 1 || change.rangeOffset < startSpan.start
                            || change.rangeOffset + change.rangeLength > startSpan.start + startSpan.length) {
                            // Decrement the start index after removal, to counter the +1 in the following
                            // update loop.
                            spans.splice(startIndex--, count);
                            needUpdate = true;
                        } else {
                            spans[startIndex].length -= changeLength;
                        }
                    }

                    // Finally update all spans in the list which follow the first touched span.
                    for (let i = startIndex + 1; i < spans.length; ++i) {
                        spans[i].start -= changeLength;
                    }

                    if (needUpdate) {
                        // Usually decorations are updated automatically, but if we have removed spans
                        // we have to do an explicit update.
                        this.updateCodeDecorations(event.document);
                    }
                });
            }
        }));
    }

    public executeSqlFromEditor(editor: TextEditor, caption: string, connectionId: number): void {
        const content = editor.document.getText();
        const { line, character } = editor.selection.active;

        const input = CharStream.fromString(content);

        let lexer;
        let stringType;
        switch (editor.document.languageId) {
            case "python": {
                lexer = new PythonLexer(input);
                stringType = PythonLexer.STRING;
                break;
            }

            case "javascript":
            case "typescript": {
                return;
            }

            default: {
                return;
            }
        }

        const tokenStream = new CommonTokenStream(lexer);

        try {
            tokenStream.fill();
            const tokens = tokenStream.getTokens();

            // Find the token which contains the caret.
            let index = 0;
            while (index < tokens.length) {
                let token = tokens[index];
                const tokenLine = token.line - 1; // ANTLR lines are one-based.
                if (tokenLine > line || (tokenLine === line && token.column > character)) {
                    // First token starting after the caret.
                    if (index > 0) {
                        // See if the previous token starts before or on the caret.
                        token = tokens[index - 1];
                        if (token.line - 1 < line || token.column <= character) {
                            if (token.type === stringType && token.text) {
                                const [prefix, postfix] = this.determinePythonQuotes(token.text);
                                const sql = token.text.substring(prefix, token.text.length - postfix);
                                const [beautified, whiteSpaces] = this.beautifyQuery(sql);

                                // Mark the code block in the editor.
                                const span: ILinkedCodeBlock = {
                                    id: CodeBlocks.nextSpanId++,
                                    originalCode: sql,
                                    whiteSpaces,
                                    start: token.start + prefix,
                                    length: token.stop + 1 - postfix - (token.start + prefix),
                                };

                                // Do we already have this range linked?
                                let ranges = this.codeBlocks.get(editor.document.uri);
                                if (!ranges) {
                                    ranges = [];
                                    this.codeBlocks.set(editor.document.uri, ranges);
                                }

                                const existing = ranges.findIndex((candidate) => {
                                    return candidate.start === span.start;
                                });

                                if (existing === -1) {
                                    ranges.push(span);
                                    ranges.sort((lhs, rhs) => { // Ranges never overlap.
                                        return lhs.start - rhs.start;
                                    });
                                    this.updateCodeDecorations(editor.document);
                                } else {
                                    // Replace the found entry with new one. This way we remove the
                                    // association with the previous code block in the app and establish a new one.
                                    ranges[existing] = span;
                                }

                                const options: ICodeBlockExecutionOptions = {
                                    caption,
                                    connectionId,
                                    query: beautified,
                                    linkId: span.id,
                                };
                                void requisitions.execute("executeCodeBlock", options);
                            }

                            break;
                        }
                    }
                }

                ++index;
            }
        } catch (reason) {
            printChannelOutput(String(reason));
        }
    }

    /**
     * Registers a block decoration type used to mark linked code blocks.
     */
    private initializeBlockDecorations(): void {
        this.blockDecorationType = window.createTextEditorDecorationType({
            isWholeLine: false,
            rangeBehavior: DecorationRangeBehavior.OpenOpen,
            overviewRulerLane: OverviewRulerLane.Left,
            light: {
                backgroundColor: "#db8f0015",
                overviewRulerColor: "#db8f00",
                gutterIconPath: path.join(__dirname, "..", "images", "light", "query-marker.svg"),
                before: {
                    contentIconPath: path.join(__dirname, "..", "images", "light", "sqlBlockStart.svg"),
                    width: "24px",
                    height: "14px",
                    margin: "0px 6px 0px 6px",
                    color: "#db8f00",
                },
                after: {
                    contentIconPath: path.join(__dirname, "..", "images", "light", "sqlBlockEnd.svg"),
                    width: "24px",
                    height: "14px",
                    margin: "0px 6px 0px 6px",
                    color: "#db8f00",
                },
            },
            dark: {
                backgroundColor: "#db8f0015",
                overviewRulerColor: "#db8f00",
                gutterIconPath: path.join(__dirname, "..", "images", "dark", "query-marker.svg"),
                before: {
                    contentIconPath: path.join(__dirname, "..", "images", "dark", "sqlBlockStart.svg"),
                    width: "24px",
                    height: "14px",
                    margin: "0px 6px 0px 6px",
                    color: "#db8f00",
                },
                after: {
                    contentIconPath: path.join(__dirname, "..", "images", "dark", "sqlBlockEnd.svg"),
                    width: "24px",
                    height: "14px",
                    margin: "0px 6px 0px 6px",
                    color: "#db8f00",
                },
            },
        });
    }

    /**
     * Triggered when the application sent code that must be written to a text document.
     *
     * @param data The details of the code block to update.
     *
     * @param data.linkId The code block's ID.
     * @param data.code The new code to set for that block.
     *
     * @returns A promise which immediately resolves.
     */
    private codeBlocksUpdate = (data: { linkId: number; code: string; }): Promise<boolean> => {
        let entry: ILinkedCodeBlock | undefined;
        let documentUri: Uri | undefined;
        this.codeBlocks.forEach((blocks, uri) => {
            blocks.forEach((block) => {
                if (block.id === data.linkId) {
                    entry = block;
                    documentUri = uri;
                }
            });
        });

        if (entry && documentUri) {
            // Check if the code block was changed.
            if (window.activeTextEditor?.document.uri !== documentUri) {
                const options: TextDocumentShowOptions = {
                    viewColumn: ViewColumn.One,
                    preserveFocus: true,
                };

                // Activate the editor with the changes, if it is not the active one.
                void window.showTextDocument(documentUri, options).then((editor: TextEditor) => {
                    this.checkAndApplyCodeBlockChanges(editor, data.code, entry);
                });
            } else {
                this.checkAndApplyCodeBlockChanges(window.activeTextEditor, data.code, entry);
            }
        } else {
            void ui.showInformationMessage("The original code block no longer exists and cannot be updated.", {});
        }

        return Promise.resolve(true);
    };

    /**
     * Examines the given text, which must be a Python string and determines the number of leading and trailing
     * quote characters. This includes also string prefixes.
     *
     * @param text The text to check.
     *
     * @returns A pair of numbers, holding the leading and trailing quote count, respectively.
     */
    private determinePythonQuotes(text: string): [number, number] {
        const match = text.match(/^(u|br?|r(f|b)?|fr?)?(["']{1,3})/i);
        if (match) {
            const prefixLength = match[0].length;
            const postfixLength = prefixLength - (match[1] ?? "").length;

            return [prefixLength, postfixLength];
        }

        return [0, 0];
    }

    /**
     * Makes the given query text a bit friendlier by removing leading and trailing line breaks and removes
     * unnecessary indentation.
     *
     * @param text The text to beautify.
     *
     * @returns A pair with the converted text and the removed indentation.
     */
    private beautifyQuery(text: string): [string, IWhiteSpaces] {
        const whiteSpaces = {
            leading: "",
            indentation: "",
            trailing: "",
        };

        text = text.replace(/\t/g, "    ");
        const lines = text.split("\n");
        let count = 0;
        for (const line of lines) {
            if (line.trim().length === 0) {
                ++count;
                whiteSpaces.leading += line + "\n";
            } else {
                break;
            }
        }
        lines.splice(0, count); // Remove leading line breaks.

        count = 0;
        for (const line of lines.reverse()) {
            if (line.trim().length === 0) {
                ++count;
                whiteSpaces.trailing += "\n" + line;
            } else {
                break;
            }
        }
        lines.splice(0, count); // Remove trailing line breaks.
        lines.reverse();

        if (lines.length > 0) {
            const match = lines[0].match(/(:?\s+).*/);
            whiteSpaces.indentation = match?.[1] ?? "";
            if (whiteSpaces.indentation) {
                lines.forEach((line, index) => {
                    if (line.startsWith(whiteSpaces.indentation)) {
                        lines[index] = line.substring(whiteSpaces.indentation.length);
                    }
                });
            }
        }

        return [lines.join("\n"), whiteSpaces];
    }

    private updateCodeDecorations(document: TextDocument): void {
        const blocks = this.codeBlocks.get(document.uri);
        if (blocks) {
            const ranges = blocks.map((block) => {
                const startPosition = document.positionAt(block.start);
                const endPosition = document.positionAt(block.start + block.length);

                return new Range(startPosition, endPosition);
            });

            window.activeTextEditor?.setDecorations(this.blockDecorationType, ranges);
        }
    }

    /**
     * @param start1 The begin of the first span.
     * @param length1 The length of the first span.
     * @param start2 The begin of the second span.
     * @param length2 The length of the second span.
     *
     * @returns True if the given spans overlap each other. Otherwise false.
     */
    private spansOverlap(start1: number, length1: number, start2: number, length2: number): boolean {
        const end1 = start1 + length1;
        const end2 = start2 + length2;
        if (start1 <= start2) {
            return start2 <= end1;
        }

        return start1 <= end2;
    }

    /**
     * Applies the new code to the range given by the block. Checks, if the original code was changed in the text
     * editor and asks the user if it's still ok to overwrite that code, if that's the case.
     *
     * @param editor The editor to update.
     * @param newCode The new code to write.
     * @param block The block description for the part in the editor to change.
     */
    private checkAndApplyCodeBlockChanges(editor: TextEditor, newCode: string, block?: ILinkedCodeBlock): void {
        if (block) {
            // First reapply the previously removed indentation.
            const lines = newCode.split("\n").map((line) => {
                return line.trim().length === 0 ? "" : block.whiteSpaces.indentation + line;
            });
            newCode = block.whiteSpaces.leading + lines.join("\n") + block.whiteSpaces.trailing;

            // If the current code in the editor was changed since it was sent to the app, ask the user
            // if it is ok to overwrite it.
            const start = editor.document.positionAt(block.start);
            const end = editor.document.positionAt(block.start + block.length);
            const range = new Range(start, end);
            const currentText = editor.document.getText(range);

            if (currentText !== block.originalCode) {
                void ui.showWarningMessage("The original code was changed meanwhile. Do you still want to update " +
                    "it with your application code?", {}, "Update", "Cancel").then((input) => {
                        if (input === "Update") {
                            void editor.edit((builder) => {
                                builder.replace(range, newCode);
                            }).then((success) => {
                                if (!success) {
                                    void ui.showErrorMessage("The changes could not be applied.", {});
                                } else {
                                    block.originalCode = newCode;
                                }
                            });
                        }
                    });
            } else {
                void editor.edit((builder) => {
                    builder.replace(range, newCode);
                }).then((success) => {
                    if (!success) {
                        void ui.showErrorMessage("The changes could not be applied.", {});
                    } else {
                        block.originalCode = newCode;
                    }
                });
            }
        }
    }

    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "codeBlocksUpdate": {
                const response = request.original.parameter as { linkId: number; code: string; };

                return this.codeBlocksUpdate(response);
            }

            default:
        }

        return Promise.resolve(false);
    };

}
