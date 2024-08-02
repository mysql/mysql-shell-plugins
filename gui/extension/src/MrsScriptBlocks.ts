/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import path from "path";

import {
    window, TextEditorDecorationType, Uri, ExtensionContext, TextEditor,
    DecorationRangeBehavior, OverviewRulerLane, workspace, TextDocument, TextDocumentChangeEvent, Range,
} from "vscode";
import { ShellInterfaceMrs } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceMrs.js";
import { IMrsSchemaDefinition, IMrsScriptDefinition } from "../../frontend/src/communication/ProtocolMrs.js";


/** Describes a block of code that was sent to the application. */
export interface IMrsScriptCodeBlock {
    /** A unique id to link code blocks between the extension and the app. */
    id: number;

    type: string;

    schema: IMrsSchemaDefinition;
    script?: IMrsScriptDefinition;
    mtime?: number;

    /** The start offset of the code block in the text editor document. */
    start: number;

    /** The length of the code block in characters. */
    length: number;
}

/** A class to manage code blocks that are synchronized with the web app. */
export class MrsScriptBlocks {
    private static nextSpanId = 1;

    #updateTimer: ReturnType<typeof setTimeout> | null = null;

    // Decoration handle for code markup.
    #blockDecorationType: TextEditorDecorationType;

    // All marked code ranges we manage here. These are linked to an editor in the web app.
    #codeBlocks = new Map<Uri, IMrsScriptCodeBlock[]>();

    public setup(context: ExtensionContext): void {
        this.initializeBlockDecorations();

        // Ensure the code block markers are actually deleted when the document closes
        context.subscriptions.push(workspace.onDidCloseTextDocument((document: TextDocument) => {
            if (document.uri.scheme === "file") {
                this.clearCodeDecorations(document);
            }
        }));

        context.subscriptions.push(window.onDidChangeActiveTextEditor((editor?: TextEditor) => {
            if (editor && this.#codeBlocks.has(editor.document.uri)) {
                this.updateCodeDecorations(editor.document);
            }
        }));

        context.subscriptions.push(workspace.onDidChangeTextDocument((event: TextDocumentChangeEvent) => {
            const spans = this.#codeBlocks.get(event.document.uri);
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

    public async enableAutomaticDecoration(status: boolean): Promise<void> {
        if (status) {
            await this.decorationTimerExecution();
        } else {
            // Clear the timer
            if (this.#updateTimer !== null) {
                clearTimeout(this.#updateTimer);
                this.#updateTimer = null;
            }
            if (window.activeTextEditor) {
                this.clearCodeDecorations(window.activeTextEditor.document);
            }
        }
    }

    public async setCodeDecorations(document: TextDocument): Promise<void> {
        const fileStats = await workspace.fs.stat(document.uri);

        // If there is an existing scriptCodeBlock for this document, get the modificationDate
        const scriptCodeBlocks = this.#codeBlocks.get(document.uri);
        if (scriptCodeBlocks && scriptCodeBlocks.at(0)?.mtime === fileStats.mtime) {
            return;
        }

        this.#codeBlocks.delete(document.uri);

        const mrs = new ShellInterfaceMrs();
        const scriptDefs = await mrs.getFileMrsScriptDefinitions(
            document.uri.path, "TypeScript");

        if (scriptDefs !== undefined && scriptDefs.length > 0) {
            scriptDefs.forEach((schema) => {
                // Mark the code block in the editor.
                const span: IMrsScriptCodeBlock = {
                    id: MrsScriptBlocks.nextSpanId++,
                    schema,
                    mtime: fileStats.mtime,
                    type: schema.schemaType,
                    start: schema.characterStart,
                    length: schema.characterEnd - schema.characterStart,
                };

                // Do we already have this range linked?
                let ranges = this.#codeBlocks.get(document.uri);
                if (!ranges) {
                    ranges = [];
                    this.#codeBlocks.set(document.uri, ranges);
                }

                const existing = ranges.findIndex((candidate) => {
                    return candidate.start === span.start;
                });

                if (existing === -1) {
                    ranges.push(span);
                    ranges.sort((lhs, rhs) => { // Ranges never overlap.
                        return lhs.start - rhs.start;
                    });
                    this.updateCodeDecorations(document);
                } else {
                    // Replace the found entry with new one. This way we remove the
                    // association with the previous code block in the app and establish a new one.
                    ranges[existing] = span;
                }
            });
        } else {
            this.clearCodeDecorations(document);
        }
    }

    public getCodeDecorations(document: TextDocument): IMrsScriptCodeBlock[] | undefined {
        return this.#codeBlocks.get(document.uri);
    }

    public clearCodeDecorations(document: TextDocument): void {
        this.#codeBlocks.delete(document.uri);
        this.updateCodeDecorations(document);
    }

    private async decorationTimerExecution(): Promise<void> {
        this.#updateTimer = null;
        if (window.activeTextEditor && !window.activeTextEditor.document.isDirty) {
            await this.setCodeDecorations(window.activeTextEditor.document);
        }

        // Start a 1s timer to check if new invitations have been created
        this.#updateTimer = setTimeout(() => {
            void this.decorationTimerExecution();
        }, 1000);
    }

    /**
     * Registers a block decoration type used to mark linked code blocks.
     */
    private initializeBlockDecorations(): void {
        this.#blockDecorationType = window.createTextEditorDecorationType({
            isWholeLine: true,
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

    private updateCodeDecorations(document: TextDocument): void {
        const blocks = this.#codeBlocks.get(document.uri);
        if (window.activeTextEditor?.document.uri.path === document.uri.path) {
            if (blocks) {
                const ranges = blocks.map((block) => {
                    const startPosition = document.positionAt(block.start);
                    const endPosition = document.positionAt(block.start + block.length);

                    return new Range(startPosition, endPosition);
                });

                window.activeTextEditor?.setDecorations(this.#blockDecorationType, ranges);
            } else {
                window.activeTextEditor?.setDecorations(this.#blockDecorationType, []);
            }
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

}
