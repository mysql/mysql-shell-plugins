/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { ExecutionContext, IExecutionResult, IResultSet, SQLExecutionContext } from ".";
import { ApplicationDB, IDbModuleResultData, StoreType } from "../app-logic/ApplicationDB";
import { MessageType } from "../app-logic/Types";
import { IExecutionContextState, IPosition } from "../components/ui/CodeEditor";
import { CodeEditor, ResultPresentationFactory } from "../components/ui/CodeEditor/CodeEditor";
import { IStatementSpan } from "../parsing/parser-common";
import { EditorLanguage, ITextRange } from "../supplement";
import { PresentationInterface } from "./PresentationInterface";

/** A helper class to keep editor blocks that belong to a single text model together. */
export class ExecutionContexts {

    // Updated from the editor, as models don't have this value.
    public cursorPosition: IPosition = { lineNumber: 1, column: 1 };

    private content: ExecutionContext[] = [];

    public constructor(
        private store: StoreType = StoreType.Unused,
        private dbVersion: number,
        private sqlMode: string,
        private defaultSchema: string) {
    }

    public get count(): number {
        return this.content.length;
    }

    public contextAt(index: number): ExecutionContext | undefined {
        if (index < 0 || index > this.content.length - 1) {
            return;
        }

        return this.content[index];
    }

    public addContext(presentation: PresentationInterface): ExecutionContext {
        const context = this.createContext(presentation);
        this.content.push(context);

        return context;
    }

    /**
     * Removes the contexts at the given indices.
     *
     * @param indices The indices of the elements to remove. They must be ordered smallest to largest.
     */
    public removeContexts(indices: number[]): void {
        indices.reverse().forEach((index: number) => {
            this.content[index].dispose();
            this.content.splice(index, 1);
        });

    }

    public insertContext(index: number, presentation: PresentationInterface): ExecutionContext {
        const context = this.createContext(presentation);
        this.content.splice(index, 0, context);

        return context;
    }

    /**
     * Prepares the context list for removal. Each context removes its decorations and
     * a list of state objects is created to restore the previous state.
     *
     * @returns A list of context states that can be used to restore the previous execution context structure.
     */
    public cleanUpAndReturnState(): IExecutionContextState[] {
        const result: IExecutionContextState[] = [];

        this.content.forEach((context: ExecutionContext) => {
            result.push(context.state);
            context.dispose();
        });
        this.content = [];

        return result;
    }

    /**
     * Restores a previously saved list of execution contexts.
     *
     * @param editor The editor in which the context decorations must be set.
     * @param factory The generator of a presentation object to use for the new contexts.
     * @param states The list of context states to restore.
     */
    public restoreFromState(editor: CodeEditor, factory: ResultPresentationFactory,
        states: IExecutionContextState[]): void {
        this.content.forEach((context: ExecutionContext) => {
            return context.dispose();
        });

        this.content.splice(0, this.content.length);
        states.forEach((state: IExecutionContextState) => {
            const presentation = factory(editor, state.language);
            presentation.startLine = state.start;
            presentation.endLine = state.end;
            const context = this.createContext(presentation, state.statements);
            if (state.result) {
                switch (state.result.type) {
                    case "requestIds": {
                        // Convert result data references back to result data. Result set data is loaded from
                        // the storage DB, if possible.
                        const result: IExecutionResult = {
                            type: "resultSets",
                            sets: [],
                            output: [],
                        };

                        this.loadResultSets(state.result.list).then((resultSets) => {
                            // Remove any result with no columns or rows and add their execution info
                            // to the output list.
                            resultSets.forEach((set) => {
                                if (set.data.columns.length === 0 || set.data.rows.length === 0) {
                                    result.output?.push({
                                        type: set.data.executionInfo?.type ?? MessageType.Info,
                                        index: set.index,
                                        requestId: set.head.requestId,
                                        content: set.data.executionInfo?.text ?? "",
                                        language: "ansi",
                                    });
                                }
                            });

                            result.sets = resultSets.filter((value) => {
                                return value.data.columns.length > 0 && value.data.rows.length > 0;
                            });

                            context.setResult(result, state.currentHeight, state.currentSet, state.maximizeResultPane);
                        }).catch(() => {
                            // Ignore load errors.
                        });


                        break;
                    }

                    default: {
                        context.setResult(state.result, state.currentHeight);

                        break;
                    }
                }
            }

            this.content.push(context);
        });
    }

    /**
     * Searches the list of contexts for one that covers the given position and returns its index.
     *
     * @param position The line/column pair to search for.
     *
     * @returns The index of the context containing the given position or -1 if nothing matched.
     */
    public contextIndexFromPosition(position: IPosition | undefined | null): number {
        if (!position) {
            return -1;
        }

        return this.content.findIndex((context: ExecutionContext) => {
            return context.startLine <= position.lineNumber && position.lineNumber <= context.endLine;
        });
    }

    /**
     * Searches the list of contexts for one that covers the given position.
     *
     * @param position The line/column pair to search for.
     *
     * @returns The context that contains the given position or undefined if nothing was found.
     */
    public contextFromPosition(position: IPosition | undefined | null): ExecutionContext | undefined {
        const index = this.contextIndexFromPosition(position);
        if (index > -1) {
            return this.content[index];
        }

        return undefined;
    }

    /**
     * Searches the list of contexts for one with the given id.
     *
     * @param id The context id.
     *
     * @returns The context with the given id or undefined if nothing was found.
     */
    public contextWithId(id: string): ExecutionContext | undefined {
        const index = this.content.findIndex((context: ExecutionContext) => {
            return context.id === id;
        });
        if (index > -1) {
            return this.content[index];
        }

        return undefined;
    }

    /**
     * Searches the list for all contexts that are within a given range.
     *
     * @param range The range to search for.
     *
     * @returns A list of indices of contexts that touch the given range.
     */
    public contextIndicesFromRange(range: ITextRange): number[] {
        const result: number[] = [];

        this.content.forEach((context: ExecutionContext, index: number) => {
            const rangeContainsBlockStart = range.startLine <= context.startLine
                && context.startLine <= range.endLine;
            const blockContainsRangeStart = context.startLine <= range.startLine
                && range.startLine <= context.endLine;
            if (rangeContainsBlockStart || blockContainsRangeStart) {
                result.push(index);
            }
        });

        return result;
    }

    /**
     * @returns The first context in the list.
     */
    public get first(): ExecutionContext | undefined {
        if (this.content.length > 0) {
            return this.content[0];
        }

        return undefined;
    }

    /**
     * @returns The last context in the list.
     */
    public get last(): ExecutionContext | undefined {
        if (this.content.length > 0) {
            return this.content[this.content.length - 1];
        }

        return undefined;
    }

    /**
     * @returns The language for new contexts (which is the language of the last element in the list).
     */
    public get language(): EditorLanguage | undefined {
        if (this.content.length > 0) {
            return this.content[this.content.length - 1].language;
        }

        return undefined;
    }

    public set currentSchema(schema: string) {
        if (this.defaultSchema !== schema) {
            this.defaultSchema = schema;
            this.content.forEach((context) => {
                if (context instanceof SQLExecutionContext) {
                    context.currentSchema = schema;
                }
            });
        }
    }

    private createContext(presentation: PresentationInterface, statementSpans?: IStatementSpan[]): ExecutionContext {
        presentation.onRemoveResult = this.onResultRemoval;
        if (presentation.isSQLLike) {
            return new SQLExecutionContext(presentation, this.dbVersion, this.sqlMode, this.defaultSchema,
                statementSpans);
        }

        return new ExecutionContext(presentation);
    }

    /**
     * Attempts to load all result sets back from the storage DB into a result set structure.
     *
     * @param requestIds A list of previous request ID used to get the result sets from the backend.
     *                   This is the ID under which the data was cached before.
     *
     * @returns If the given request ID was found the data is loaded and returned as a list of result sets.
     */
    private async loadResultSets(requestIds: string[]): Promise<IResultSet[]> {
        const sets: IResultSet[] = [];

        for await (const requestId of requestIds) {
            const values = await ApplicationDB.db.getAllFromIndex(this.store, "resultIndex", requestId);
            const set: IResultSet = {
                head: {
                    requestId,
                    sql: "",
                },
                data: {
                    requestId,
                    columns: [],
                    rows: [],
                    hasMoreRows: false,
                    currentPage: 0,
                },
            };
            sets.push(set);

            if (this.isDbModuleResultData(values)) {
                values.forEach((value) => {
                    set.index = value.index;
                    if (value.sql) {
                        set.head.sql = value.sql;
                    }

                    set.data.columns.push(...value.columns ?? []);
                    set.data.rows.push(...value.rows);

                    if (value.executionInfo) {
                        set.data.executionInfo = value.executionInfo;
                    }

                    if (value.hasMoreRows) {
                        set.data.hasMoreRows = true;
                        set.data.currentPage = value.currentPage;
                    }
                });
            }
        }

        return sets;
    }

    private onResultRemoval = (requestIds: string[]): void => {
        void ApplicationDB.removeDataByRequestIds(this.store, requestIds);
    };

    private isDbModuleResultData(data: unknown[]): data is IDbModuleResultData[] {
        const array = data as IDbModuleResultData[];

        return array.length > 0 && array[0].tabId !== undefined;
    }

}
