/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import {
    CancellationToken, DocumentSemanticTokensProvider, IDisposable, SemanticTokens, SemanticTokensLegend,
    tokenModifiers, tokenTypes,
} from "./index.js";
import { ICodeEditorModel } from "./CodeEditor.js";

/** A record holding start + end line of changes and other info for a specific model. */
interface IModelDetails {
    disposables: IDisposable[];
    firstLine: number;
    lastLine: number;
}

export class MsgSemanticTokensProvider implements DocumentSemanticTokensProvider {
    // A map of a model id to the lines that have changed since the last call to provideDocumentSemanticTokens.
    readonly #changedLines = new Map<string, IModelDetails>();

    public getLegend(): SemanticTokensLegend {
        return {
            tokenTypes,
            tokenModifiers,
        };
    }

    /**
     * Provides semantic tokens for the given model, which is a combination of the semantic tokens of each
     * execution context in the model. To avoid frequent expensive scan operations, the semantic tokens are
     * cached in the provider and only those are updated that have changed since the last call.
     *
     * @param model The model for which to provide semantic tokens.
     * @param _lastResultId unused
     * @param cancellationToken unused
     *
     * @returns The semantic tokens for the given model.
     */
    public async provideDocumentSemanticTokens(model: ICodeEditorModel, _lastResultId: string | null,
        cancellationToken: CancellationToken): Promise<SemanticTokens> {

        // Local models have no execution contexts. They are not tokenized because they are not used
        // for display.
        if (!model.executionContexts || cancellationToken.isCancellationRequested) {
            return { data: new Uint32Array(0) };
        }

        // First check if we already have registered our event handlers.
        let details = this.#changedLines.get(model.id);
        if (!details) {
            // If not, register them now.
            details = {
                disposables: [],
                firstLine: 1,
                lastLine: model.getLineCount(),
            };

            // Change handler to update the lines that have changed.
            // Assuming here no other code sets these event handlers (which is true for now). Content changes are
            // handled by the CodeEditor component (via `editor.onDidChangeModelContent`).
            details.disposables.push(model.onDidChangeContent((event) => {
                event.changes.forEach((change) => {
                    if (details!.firstLine === -1 || change.range.startLineNumber < details!.firstLine) {
                        details!.firstLine = change.range.startLineNumber;
                    }

                    // If a change spans multiple lines, we need to update all of them.
                    const endLine = change.text.split("\n").length + change.range.endLineNumber - 1;
                    if (details!.lastLine === - 1 || endLine > details!.lastLine) {
                        details!.lastLine = endLine;
                    }
                });
            }));

            // Dispose handler to remove the model details from the map.
            details.disposables.push(model.onWillDispose(() => {
                const details = this.#changedLines.get(model.id);
                if (details) {
                    details.disposables.forEach((d) => { return d.dispose(); });
                }
                this.#changedLines.delete(model.id);
            }));

            this.#changedLines.set(model.id, details);
        }

        const indices = model.executionContexts.contextIndicesFromRange({
            startLine: details.firstLine,
            startColumn: 0,
            endLine: details.lastLine,
            endColumn: 0,
        });

        // Now that we have the indices of all changed execution contexts, we can update the cached semantic tokens
        // and reset the changed lines.
        details.firstLine = -1;
        details.lastLine = -1;

        for (const index of indices) {
            await model.executionContexts.contextAt(index)?.updateTokenList();

            if (cancellationToken.isCancellationRequested) {
                return { data: new Uint32Array(0) };
            }
        }

        // Finally put all the semantic tokens together.
        const subLists: Uint32Array[] = [];
        for (const context of model.executionContexts) {
            const contextTokens = context.tokenList;
            if (contextTokens) {
                // Make a copy of the list. We are going to modify it.
                subLists.push(contextTokens.slice());
            } else {
                subLists.push(new Uint32Array(0));
            }
        }

        // Each sub list uses a relative offset, so we need to compute the line offset to the previous sub list.
        // The (relative) line information is the first field in each set of 5 values.
        let lastLine = 0;
        for (let i = 0; i < subLists.length; i++) {
            const subList = subLists[i];
            if (subList.length === 0) {
                continue;
            }

            // There are as many sub lists as contexts.
            const context = model.executionContexts.contextAt(i)!;

            // Update this list's start line offset from the running last line (startLine is 1-based, hence the -1).
            // We only have to set the first line number. All following ones are relative anyway.
            subList[0] += context.startLine - lastLine - 1;

            // Then update the last line offset for the next list.
            for (let j = 0; j < subList.length; j += 5) {
                lastLine += subList[j];
            }
        }

        // Allocate an array large enough to hold all sub lists.
        const data = new Uint32Array(subLists.reduce((acc, val) => { return acc + val.length; }, 0));
        let offset = 0;
        for (const subList of subLists) {
            data.set(subList, offset);
            offset += subList.length;
        }

        return {
            data,
        };
    }

    public releaseDocumentSemanticTokens(_resultId: string | undefined): void {
        // Nothing to do.
    }
}
