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

import { IPosition } from "monaco-editor";

import type { StoreType } from "../app-logic/ApplicationDB.js";
import { Monaco } from "../components/ui/CodeEditor/index.js";
import { IDiagnosticEntry, IStatement, IStatementSpan, StatementFinishState } from "../parsing/parser-common.js";
import { requisitions } from "../supplement/Requisitions.js";
import { Semaphore } from "../supplement/Semaphore.js";
import { binarySearch } from "../utilities/helpers.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { PresentationInterface } from "./PresentationInterface.js";
import { ScriptingLanguageServices } from "./ScriptingLanguageServices.js";

interface IStatementDetails extends IStatementSpan {
    diagnosticDecorationIDs: string[];
}

/**
 * This class specializes a base context to provide SQL specific functionality (statement splitting, optimized editing).
 */
export class SQLExecutionContext extends ExecutionContext {
    private statementDetails: IStatementDetails[] = [];

    // A list of indices of statements that must be run through the statement splitter.
    private pendingSplitActions = new Set<number>();

    // The set of currently running split actions with the statement index and a timestamp.
    private splitActionsRunning = new Map<number, number>();

    // A list of statement indices that still need validation.
    private pendingValidations = new Set<number>();

    // The set of currently running validations with the statement index and a timestamp.
    private validationsRunning = new Map<number, number>();

    // A signal that is set when the splitter is currently running. Can be awaited to wait for the splitter to finish.
    #splitterSignal?: Semaphore<void>;

    #validationTimer?: ReturnType<typeof setTimeout> | null;

    public constructor(presentation: PresentationInterface, store: StoreType, public dbVersion: number,
        public sqlMode: string,
        public currentSchema: string, statementSpans?: IStatementSpan[]) {
        super(presentation, store);

        if (statementSpans) {
            this.statementDetails = statementSpans.map((span) => {
                return { ...span, diagnosticDecorationIDs: [] };
            });
            this.updateLineStartMarkers();

            // (Re) run the validation for all (restored) statements.
            for (let i = 0; i < this.statementDetails.length; ++i) {
                this.pendingValidations.add(i);
            }
            this.#validationTimer = setTimeout(() => {
                this.validateNextStatement();
            }, 0);
        } else {
            this.#validationTimer = setTimeout(() => {
                this.scheduleFullValidation();
            }, 0);
        }
    }

    /**
     * Important: since we have no d-tors in JS/TS it is necessary to call `dispose` to clean up the context.
     */
    public dispose(): void {
        if (this.#validationTimer) {
            clearTimeout(this.#validationTimer);
            this.#validationTimer = null;
        }

        super.dispose();

        this.splittingFinished();

        this.pendingSplitActions.clear();
        this.splitActionsRunning.clear();
        this.pendingValidations.clear();
        this.validationsRunning.clear();
    }

    /**
     * Called from the editor for any change going on there (user typing, pasting, undoing etc.).
     * This context's end line is already updated by the caller.
     *
     * @param changes The original monaco-editor changes to apply.
     */
    public applyEditorChanges(changes: Monaco.IModelContentChange[]): void {
        if (this.disposed) {
            return;
        }

        changes.forEach((change) => {
            if (this.statementDetails.length === 0) {
                // No statements yet. Add the entire text as the first statement.
                this.statementDetails.push({
                    delimiter: ";",
                    span: {
                        start: 0,
                        length: this.model?.getValue().length ?? 0,
                    },
                    contentStart: 0,
                    state: StatementFinishState.Complete,
                    diagnosticDecorationIDs: [],
                });
                this.pushSplitRequest(0);
            } else {
                const changeLength = change.text.length - change.rangeLength;
                const changeOffset = change.rangeOffset - this.presentation.codeOffset;
                let startIndex = binarySearch(this.statementDetails, (current) => {
                    if (changeOffset < current.span.start) {
                        return -1;
                    }
                    if (changeOffset >= current.span.start + current.span.length) {
                        return 1;
                    }

                    return 0;
                });

                let done = false;

                if (startIndex < 0) {
                    // Only happens when adding or removing text at the very end of the block.
                    // Can also result from combining this context with the following one.
                    // Hence assign the entire remaining text to the last statement and start validation of it.
                    const lastDetails = this.statementDetails[this.statementDetails.length - 1];
                    const fullLength = this.model?.getValue().length ?? 0;
                    lastDetails.span.length = fullLength - lastDetails.span.start;
                    this.pushSplitRequest(this.statementDetails.length - 1);
                    done = true;
                }

                if (!done) {
                    let startDetails = this.statementDetails[startIndex];

                    // We found a statement touched by the begin of the range that was changed.
                    // If the change is at the first position of the start statement and there's a delimiter change
                    // before the start statement, then use this delimiter change instead as start statement and
                    // add modify that (which may ultimately change following statements).
                    if (startIndex > 0 && changeOffset === startDetails.span.start
                        && this.statementDetails[startIndex - 1].state === StatementFinishState.DelimiterChange) {
                        --startIndex;
                        startDetails = this.statementDetails[startIndex];
                    }

                    // Now check if we can find one for the end of that range.
                    // At this point newly added text is not relevant.
                    const rangeEnd = changeOffset + change.rangeLength;
                    let endIndex = binarySearch(this.statementDetails, (current) => {
                        if (rangeEnd < current.span.start) {
                            return -1;
                        }
                        if (rangeEnd >= current.span.start + current.span.length) {
                            return 1;
                        }

                        return 0;
                    });

                    if (endIndex < 0) {
                        // A negative index means we went beyond the last available statement, which means that
                        // this change goes beyond this context (i.e. it was combined with a following context).
                        // All statements following the start statement are hence invalid and the entire remaining
                        // text will be assigned to the start statement.

                        // If the start statement was a delimiter changer then reset the delimiter to
                        // the previous or the default one.
                        if (startDetails.state === StatementFinishState.DelimiterChange) {
                            if (startIndex > 0) {
                                startDetails.delimiter = this.statementDetails[startIndex - 1].delimiter;
                            } else {
                                startDetails.delimiter = ";";
                            }
                        }

                        // Remove the now obsolete statements.
                        endIndex = this.statementDetails.length - 1;
                        this.clearDecorations(startIndex + 1, endIndex);
                        this.statementDetails.splice(startIndex + 1, endIndex - startIndex);

                        // Add all remaining text to the start statement. This includes also text that was added
                        // to this context as a result of merging multiple contexts.
                        startDetails.span.length = this.presentation.codeLength - startDetails.span.start;
                    } else {
                        // Add all range lengths of touched statements to the first statement.
                        let run = startIndex + 1;
                        while (run <= endIndex) {
                            if (run === this.statementDetails.length) {
                                break;
                            }

                            startDetails.span.length += this.statementDetails[run++].span.length;
                        }

                        // If the start statement was either a delimiter changer, or an incomplete delimiter change,
                        // or the changed text contains a delimiter keyword, then scan further in the statement list
                        // until the next delimiter change statement or the end of the list.
                        if (startDetails.state === StatementFinishState.DelimiterChange
                            || startDetails.state === StatementFinishState.NoDelimiter
                            || change.text.includes("delimiter ")) {
                            while (run < this.statementDetails.length) {
                                const detail = this.statementDetails[run];
                                if (detail.state === StatementFinishState.DelimiterChange) {
                                    break;
                                }
                                startDetails.span.length += detail.span.length;
                                ++run;
                            }
                            endIndex = run - 1;

                            // Also reset the current delimiter to that of the previous statement (or the default).
                            if (startIndex > 0) {
                                startDetails.delimiter = this.statementDetails[startIndex - 1].delimiter;
                            } else {
                                startDetails.delimiter = ";";
                            }
                        }

                        // Remove the now obsolete statements.
                        this.clearDecorations(startIndex + 1, endIndex);
                        this.statementDetails.splice(startIndex + 1, endIndex - startIndex);

                        // Finally update the current statement range length and all following range starts, with
                        // respect to the current change.
                        startDetails.span.length += changeLength;
                        run = startIndex + 1;
                        while (run < this.statementDetails.length) {
                            const details = this.statementDetails[run++];
                            details.span.start += changeLength;
                            details.contentStart += changeLength;
                        }
                    }

                    this.pushSplitRequest(startIndex);
                }
            }

        });
    }

    /**
     * Allows callers to wait for the completion of the current statement splitting run.
     */
    public async splittingDone(): Promise<void> {
        if (this.#splitterSignal) {
            await this.#splitterSignal.wait();
        }
    }

    /**
     * @returns a promise that resolves to a list of executable statements from the context, that is, without delimiter
     * changes. The promise is resolved as soon as all pending/ongoing statement split actions are finished.
     * If there's a selection in the editor then only statements touched by that selection are returned.
     *
     * The line numbers in the returned statements are relative to the start of this context and one-based.
     */
    public async getExecutableStatements(): Promise<IStatement[]> {
        const model = this.model;
        if (!model || model.isDisposed()) {
            return Promise.resolve([]);
        }

        if (this.#splitterSignal) {
            // Wait for the splitter to finish.
            await this.#splitterSignal.wait();
        }

        const result: IStatement[] = [];

        // This selection is from the entire editor. Have to convert the start and end position to the local model.
        const selection = this.presentation.backend?.getSelection?.();
        const startOffset = selection ?
            (model.getOffsetAt(selection.getStartPosition()) - this.presentation.codeOffset) : 0;
        const endOffset = selection ?
            (model.getOffsetAt(selection.getEndPosition()) - this.presentation.codeOffset) : 0;
        if (startOffset < endOffset) {
            // Collect indices of statements that overlap with the selection.
            const indices: number[] = [];

            let index = -1;
            while (++index < this.statementDetails.length) {
                const details = this.statementDetails[index];
                if (details.span.start + details.span.length < startOffset) {
                    continue;
                }
                if (details.span.start > endOffset) {
                    break;
                }
                indices.push(index);
            }

            for (const rangeIndex of indices) {
                const currentDetails = this.statementDetails[rangeIndex];
                if (currentDetails.state === StatementFinishState.DelimiterChange) {
                    continue;
                }

                const rangeStart = model.getPositionAt(currentDetails.span.start);
                const rangeEnd = model.getPositionAt(
                    currentDetails.span.start + currentDetails.span.length,
                );

                const text = model.getValueInRange({
                    startLineNumber: rangeStart.lineNumber,
                    startColumn: rangeStart.column,
                    endLineNumber: rangeEnd.lineNumber,
                    endColumn: rangeEnd.column,
                }, Monaco.EndOfLinePreference.LF);

                result.push({
                    index: rangeIndex,
                    text,
                    offset: currentDetails.span.start,
                    line: rangeStart.lineNumber,
                    column: rangeStart.column,
                });
            }
        } else {
            for (let index = 0; index < this.statementDetails.length; ++index) {
                const currentDetails = this.statementDetails[index];
                if (currentDetails.state === StatementFinishState.DelimiterChange) {
                    continue;
                }

                const rangeStart = model.getPositionAt(currentDetails.span.start);
                let end = currentDetails.span.start + currentDetails.span.length;
                if (currentDetails.state === StatementFinishState.Complete) {
                    end -= currentDetails.delimiter!.length;
                }
                const rangeEnd = model.getPositionAt(end);
                const text = model.getValueInRange({
                    startLineNumber: rangeStart.lineNumber,
                    startColumn: rangeStart.column,
                    endLineNumber: rangeEnd.lineNumber,
                    endColumn: rangeEnd.column,
                }, Monaco.EndOfLinePreference.LF);

                result.push({
                    index,
                    text,
                    offset: currentDetails.span.start,
                    line: rangeStart.lineNumber,
                    column: rangeStart.column,
                });
            }
        }

        return result;
    }

    /**
     * @returns a promise that resolves to all statements from the context. This list includes delimiter changes and is
     * not affect by a selection in the editor. The promise is resolved as soon as all pending/ongoing statement split
     * actions are finished.
     *
     * The line numbers in the returned statements are relative to the start of this context and one-based.
     */
    public async getAllStatements(): Promise<IStatement[]> {
        const model = this.model;
        if (!model || model.isDisposed()) {
            return [];
        }

        if (this.#splitterSignal) {
            // Wait for the splitter to finish.
            await this.#splitterSignal.wait();
        }

        const result: IStatement[] = [];
        for (let index = 0; index < this.statementDetails.length; ++index) {
            const currentDetails = this.statementDetails[index];
            const rangeStart = model.getPositionAt(currentDetails.span.start);
            let end = currentDetails.span.start + currentDetails.span.length;

            let delimiterLength = 0;
            if (currentDetails.state === StatementFinishState.Complete) {
                delimiterLength = currentDetails.delimiter!.length;
                end -= currentDetails.delimiter!.length;
            }
            const rangeEnd = model.getPositionAt(end);

            const text = model.getValueInRange({
                startLineNumber: rangeStart.lineNumber,
                startColumn: rangeStart.column,
                endLineNumber: rangeEnd.lineNumber,
                endColumn: rangeEnd.column,
            }, Monaco.EndOfLinePreference.LF);

            result.push({
                index,
                text,
                offset: currentDetails.span.start,
                line: rangeStart.lineNumber,
                column: rangeStart.column,
                delimiterLength,
            });
        }

        return result;
    }

    /**
     * Returns the statement at the given position. If no statement is found at that position the text before that
     * position is used instead (usually for code completion).
     *
     * @param position A position in the context.
     *
     * @returns The statement at the given position, if there's any, or undefined.
     */
    public async getStatementAtPosition(position: IPosition): Promise<IStatement | undefined> {
        if (this.disposed) {
            return undefined;
        }

        if (this.#splitterSignal) {
            // Wait for the splitter to finish.
            await this.#splitterSignal.wait();
        }

        const model = this.model;
        if (!model || model.isDisposed() || this.statementDetails.length === 0) {
            return undefined;
        }

        const offset = model.getOffsetAt(position);
        let index = this.statementDetails.findIndex((details: IStatementDetails) => {
            return details.span.start <= offset && details.span.start + details.span.length >= offset;
        });

        if (index < 0) {
            // Just in case the position is at the end of the context, return the last statement.
            index = this.statementDetails.length - 1;
        }

        const details = this.statementDetails[index];
        const hitStart = model.getPositionAt(details.span.start);
        const hitEnd = model.getPositionAt(details.span.start + details.span.length);

        const text = model.getValueInRange({
            startLineNumber: hitStart.lineNumber,
            startColumn: hitStart.column,
            endLineNumber: hitEnd.lineNumber,
            endColumn: hitEnd.column,
        }, Monaco.EndOfLinePreference.LF);

        return {
            index,
            text,
            offset: details.span.start,
            line: hitStart.lineNumber,
            column: hitStart.column,
        };
    }

    /**
     * @returns The model currently assigned to the editor associated with this execution context.
     */
    public get model(): Monaco.ITextModel | null {
        return this.presentation.model;
    }

    /**
     * Validates the entire block content by splitting statements (if necessary) and validating each of them.
     * Called when loading the block initially.
     */
    public validateAll(): void {
        if (!this.disposed) {
            // Replace the entire statement details list with a single entry covering all text.
            this.pendingValidations.clear();
            this.validationsRunning.clear();
            this.pendingSplitActions = new Set([0]);
            this.splitActionsRunning.clear();
            this.statementDetails = [{
                delimiter: ";",
                span: { start: 0, length: this.codeLength },
                contentStart: 0,
                state: StatementFinishState.Complete,
                diagnosticDecorationIDs: [],
            }];

            // Notify already waiting consumers that the current splitter run is done.
            this.splittingFinished();

            this.#splitterSignal = new Semaphore<void>();
            this.splitNextStatement();
        }
    }

    public selectStatement(index: number): void {
        if (index < 0 || index >= this.statementDetails.length) {
            return;
        }

        const details = this.statementDetails[index];
        const span = { ...details.span };
        span.length -= details.contentStart - span.start;
        span.start = details.contentStart;

        this.presentation.selectRange(span);
    }

    /**
     * Removes text decorations from the editor in the given range (inclusive).
     *
     * @param startIndex The first entry index or 0.
     * @param endIndex The last entry index or the total number of detail entries.
     */
    protected clearDecorations(startIndex?: number, endIndex?: number): void {
        // No check for the disposed state here. Clearing decorations is part of the shutdown procedure
        // where all values are still valid.
        startIndex = startIndex ?? 0;
        endIndex = endIndex ?? this.statementDetails.length - 1;
        if (endIndex >= this.statementDetails.length) {
            endIndex = this.statementDetails.length - 1;
        }

        const editorModel = this.presentation.backend?.getModel?.();
        if (editorModel) {
            while (startIndex <= endIndex) {
                const details = this.statementDetails[startIndex++];
                editorModel.deltaDecorations?.(details.diagnosticDecorationIDs, []);
            }
        }
    }

    protected get statementSpans(): IStatementSpan[] {
        return this.statementDetails;
    }

    /**
     * Gets the next pending statement index from the split queue and executes the splitter on it.
     * This may result in multiple new statements, if that original SQL contained multiple entries.
     */
    private splitNextStatement(): void {
        if (this.disposed) {
            return;
        }

        const editor = this.presentation.backend;
        const model = editor?.getModel?.();

        if (model && this.pendingSplitActions.size > 0) {
            const [next] = this.pendingSplitActions;
            this.pendingSplitActions.delete(next);
            if (next >= this.statementDetails.length) {
                this.updateLineStartMarkers();

                return;
            }

            const services = ScriptingLanguageServices.instance;

            const nextDetails = this.statementDetails[next];
            const start = nextDetails.span.start + this.presentation.codeOffset;

            const rangeStart = model.getPositionAt(start);
            const rangeEnd = model.getPositionAt(start + nextDetails.span.length);

            const sql = model.getValueInRange({
                startLineNumber: rangeStart.lineNumber,
                startColumn: rangeStart.column,
                endLineNumber: rangeEnd.lineNumber,
                endColumn: rangeEnd.column,
            }, Monaco.EndOfLinePreference.LF);

            if (sql === "") {
                this.splittingFinished();

                return;
            }

            if (sql.trimStart().startsWith("\\")) {
                // This is (now) an internal command. Remove any decoration for it and stop splitting.
                this.splittingFinished();

                model.deltaDecorations?.(nextDetails.diagnosticDecorationIDs, []);
                this.updateLineStartMarkers();

                return;
            }

            // Check if the statement must be split.
            const timestamp = new Date().getTime();
            this.splitActionsRunning.set(next, timestamp);
            services.determineStatementRanges(this, nextDetails.delimiter ?? ";", (ranges): void => {
                // Check if meanwhile another split action has started for the same statement index or the
                // request has been cancelled.
                const actionTimestamp = this.splitActionsRunning.get(next);
                if (actionTimestamp === undefined || actionTimestamp > timestamp) {
                    return;
                }

                this.splitActionsRunning.delete(next);
                if (ranges.length === 1) {
                    // A single statement. Check if it will affect following statements. If so, we have to combine
                    // it with the next statement(s) and re-schedule the split action.
                    const storeValuesAndValidate = (): void => {
                        // For the last statement, if no final delimiter was provided, no delimiter is returned.
                        // In that case use the delimiter which was set for the previous statement details entry.
                        let delimiter = ranges[0].delimiter;
                        if (!delimiter) {
                            if (next > 0) {
                                delimiter = this.statementDetails[next - 1].delimiter;
                            } else {
                                delimiter = ";";
                            }
                        }
                        nextDetails.delimiter = delimiter;
                        nextDetails.state = ranges[0].state;
                        nextDetails.contentStart = nextDetails.span.start + ranges[0].contentStart;

                        this.splittingFinished();
                        this.validateNextStatement(next);
                        this.updateLineStartMarkers();
                    };

                    switch (ranges[0].state) {
                        case StatementFinishState.DelimiterChange: {
                            // A DELIMITER statement can affect more than a single following statement, without
                            // the splitter noticing it (this differs from open strings and comments).
                            // So we have to combine all following statements until we reach another DELIMITER statement
                            // or the end of the input.
                            if (next + 1 < this.statementDetails.length) {
                                let run = next + 1;
                                while (run < this.statementDetails.length) {
                                    const detail = this.statementDetails[run];
                                    if (detail.state === StatementFinishState.DelimiterChange) {
                                        break;
                                    }
                                    nextDetails.span.length += detail.span.length;
                                    ++run;
                                }

                                if (run > next + 1) {
                                    this.clearDecorations(next + 1, run - 1);
                                    this.statementDetails.splice(next + 1, run - next - 1);
                                }
                                this.pendingSplitActions.add(next);

                                setTimeout(() => {
                                    return this.splitNextStatement();
                                }, 0);
                            } else {
                                // This is a DELIMITER statement with no following code.
                                storeValuesAndValidate();
                            }

                            break;
                        }

                        case StatementFinishState.OpenString:
                        case StatementFinishState.OpenComment: {
                            // Combine this with the next statement, if there's any left.
                            // Otherwise just validate what we have.
                            if (next + 1 < this.statementDetails.length) {
                                this.clearDecorations(next + 1, next + 1);
                                const temp = this.statementDetails.splice(next + 1, 1);
                                nextDetails.span.length += temp[0].span.length;
                                this.pendingSplitActions.add(next);

                                setTimeout(() => {
                                    return this.splitNextStatement();
                                }, 0);
                            } else {
                                storeValuesAndValidate();
                            }

                            break;
                        }

                        default: {
                            storeValuesAndValidate();

                            break;
                        }
                    }
                } else {
                    // Either the given statement had to be split or there was no real statement at all.
                    // Replace the original statement with the list of new statements
                    // and add them all for validation (if there are any new ones).
                    if (next < this.statementDetails.length) {
                        const newStatements: IStatementDetails[] = [];
                        let lastDelimiter = ";";
                        ranges.forEach((range: IStatementSpan) => {
                            newStatements.push({
                                delimiter: range.delimiter ?? lastDelimiter,
                                span: {
                                    start: range.span.start + nextDetails.span.start,
                                    length: range.span.length,
                                },
                                contentStart: range.contentStart + nextDetails.span.start,
                                state: range.state,
                                diagnosticDecorationIDs: [],
                            });

                            if (range.delimiter) {
                                lastDelimiter = range.delimiter;
                            }
                        });

                        this.clearDecorations(next, next);

                        this.statementDetails.splice(next, 1, ...newStatements);
                        this.updateLineStartMarkers();
                        this.updateValidationIndices(next, ranges.length);

                        // Add new statements to our validation queue.
                        for (let i = 0, run = next; i < newStatements.length; ++i, ++run) {
                            this.pendingValidations.add(run);
                            this.validationsRunning.delete(run); // Just in case it was already running.
                        }

                        // Trigger a validation run for the first statement in the new list.
                        this.validateNextStatement();

                        // If this operation left us with no further split requests then we are done with the split run.
                        if (this.pendingSplitActions.size === 0) {
                            this.splittingFinished();
                        }
                    }
                }
            }, sql);
        } else {
            // We are done with the split run. Send notification and start validating.
            this.splittingFinished();

            this.validateNextStatement();
        }
    }

    private validateNextStatement(preferred?: number): void {
        if (this.disposed) {
            return;
        }

        const editor = this.presentation.backend;
        const editorModel = editor?.getModel?.();

        // Either run validation for the given statement index or pick the next one in our wait list.
        if (editorModel && (this.pendingValidations.size > 0 || preferred !== undefined)) {
            let next: number;
            if (preferred !== undefined) {
                next = preferred;
            } else {
                [next] = this.pendingValidations;
            }

            this.pendingValidations.delete(next);
            const services = ScriptingLanguageServices.instance;

            const nextDetails = this.statementDetails[next];
            if (nextDetails) {
                if (nextDetails.state === StatementFinishState.DelimiterChange) {
                    // The DELIMITER command is not valid SQL.
                    editorModel.deltaDecorations?.(nextDetails.diagnosticDecorationIDs, []);
                    this.updateLineStartMarkers();

                    // Trigger validation for the next statement.
                    setTimeout(() => {
                        return this.validateNextStatement();
                    }, 0);

                    return;
                }

                const start = nextDetails.span.start + this.presentation.codeOffset;

                const rangeStart = editorModel.getPositionAt(start);
                let end = start + nextDetails.span.length;
                if (nextDetails.state === StatementFinishState.Complete) {
                    end -= nextDetails.delimiter!.length;
                }
                const rangeEnd = editorModel.getPositionAt(end);

                // Check if meanwhile the dimensions of the context have changed and no longer include the
                // statement we want to validate.
                if (rangeStart.lineNumber < this.startLine || rangeEnd.lineNumber > this.endLine) {
                    // Trigger validation for the next statement.
                    setTimeout(() => {
                        return this.validateNextStatement();
                    }, 0);

                    return;
                }

                const sql = editorModel.getValueInRange({
                    startLineNumber: rangeStart.lineNumber,
                    startColumn: rangeStart.column,
                    endLineNumber: rangeEnd.lineNumber,
                    endColumn: rangeEnd.column,
                }, Monaco.EndOfLinePreference.LF);

                const timestamp = new Date().getTime();
                this.validationsRunning.set(next, timestamp);
                void services.validate(this, sql, (result): void => {
                    // Check if meanwhile another split action has started for the same statement index or the
                    // request has been cancelled.
                    const actionTimestamp = this.validationsRunning.get(next);
                    if (actionTimestamp === timestamp) {
                        this.validationsRunning.delete(next);

                        const newDecorations = result.map((entry: IDiagnosticEntry) => {
                            const startPosition = editorModel.getPositionAt(entry.span.start + start);
                            const endPosition = editorModel.getPositionAt(entry.span.start + start + entry.span.length);

                            return {
                                range: {
                                    startLineNumber: startPosition.lineNumber,
                                    startColumn: startPosition.column,
                                    endLineNumber: endPosition.lineNumber,
                                    endColumn: endPosition.column,
                                },
                                options: {
                                    stickiness: Monaco.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                                    isWholeLine: false,
                                    inlineClassName: PresentationInterface.validationClass.get(entry.severity),
                                    minimap: {
                                        position: Monaco.MinimapPosition.Inline,
                                        color: "red",
                                    },
                                    hoverMessage: { value: entry.message || "" },
                                },
                            };
                        });

                        // Update the decorations in the editor.
                        // Take care for the case where the statement details have been modified while
                        // the validation ran.
                        if (next < this.statementDetails.length) {
                            nextDetails.diagnosticDecorationIDs =
                                editorModel.deltaDecorations?.(nextDetails.diagnosticDecorationIDs, newDecorations)
                                ?? [];
                        }
                    }

                    // Trigger validation for the next statement.
                    setTimeout(() => {
                        return this.validateNextStatement();
                    }, 0);
                });

                return;
            }
        }

        this.updateLineStartMarkers();
        void requisitions.execute("editorValidationDone", this.id);

        return;
    }

    /**
     * If an edit action changed the structure of the statements list then we need to update any index currently
     * registered for validation.
     *
     * @param threshold The minimum index for which to apply the offset.
     * @param delta A list of indices to remove.
     */
    private updateValidationIndices(threshold: number, delta: number): void {
        const indexes = Array.from(this.pendingValidations);
        indexes.forEach((value: number, index: number) => {
            if (value >= threshold) {
                indexes[index] += delta;
            }
        });

        this.pendingSplitActions = new Set(indexes);

        // Do not touch the splitter signal. We are not starting or ending the splitter process here.
    }

    /**
     * Puts a new statement index for splitting on the split action queue, at the first position. This is to have this
     * index processed as soon as possible (only used during change handling).
     * If that index is already in the split or validation queues then it is first removed from there.
     *
     * @param index The index to push.
     */
    private pushSplitRequest(index: number): void {
        if (!this.disposed) {
            const oldSize = this.pendingSplitActions.size;

            // Remove all occurrences of the index from the split and validation queues.
            this.pendingValidations.delete(index);
            this.splitActionsRunning.delete(index);
            this.validationsRunning.delete(index);

            this.pendingSplitActions = new Set([index, ...this.pendingSplitActions]);

            if (oldSize === 0) {
                // Starting a new splitter run.
                if (!this.#splitterSignal) {
                    this.#splitterSignal = new Semaphore<void>();
                }
                this.splitNextStatement();
            }
        }
    }

    /**
     * Collects a line numbers that begin a statement and triggers a margin decoration update in the presentation
     * management class.
     */
    private updateLineStartMarkers(): void {
        if (!this.disposed) {
            const model = this.model;

            if (model) {
                const lines = new Set<number>();
                const count = model.getLineCount();
                this.statementDetails.forEach((details: IStatementDetails) => {
                    if (details.contentStart >= details.span.start) {
                        // Only mark lines with content.
                        const position = model.getPositionAt(details.contentStart);
                        if (position.lineNumber <= count) {
                            lines.add(position.lineNumber);
                        }
                    }
                });
                this.presentation.markLines(lines, "statementStart");
            }
        }
    }

    /** Notifies all consumers that are waiting for the current splitter run. */
    private splittingFinished(): void {
        this.#splitterSignal?.notifyAll();
        this.#splitterSignal = undefined;
    }
}
