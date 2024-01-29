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

import { IResultSets, IResultSet, IContextProvider, IExecutionContextDetails } from "./index.js";
import { ApplicationDB, IDbModuleResultData, StoreType } from "../app-logic/ApplicationDB.js";
import { IExecutionContextState, IPosition, Monaco } from "../components/ui/CodeEditor/index.js";
import { CodeEditor, ResultPresentationFactory } from "../components/ui/CodeEditor/CodeEditor.js";
import { IStatementSpan } from "../parsing/parser-common.js";
import { EditorLanguage, IExecutionContext, ITextRange } from "../supplement/index.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { PresentationInterface } from "./PresentationInterface.js";
import { SQLExecutionContext } from "./SQLExecutionContext.js";
import { requisitions, type IColumnDetails } from "../supplement/Requisitions.js";
import type { ISqlUpdateResult } from "../app-logic/Types.js";

/**
 * A collection of optional parameters for the execution context list.
 */
export interface IExecutionContextsParameters {
    /** The application store to use for access to cached data. */
    store?: StoreType;

    /** The version of the MySQL server the editor is connected to, to which this list belongs. */
    dbVersion?: number;

    /** The current SQL mode of the MySQL server. */
    sqlMode?: string;

    /** The current schema of the MySQL server. */
    currentSchema?: string;

    /**
     * A callback to apply updates (usually from an edit operation).
     * @returns An error message or the number of affected rows if the update was successful.
     */
    runUpdates?: (sql: string[]) => Promise<ISqlUpdateResult>;
}

/** A helper class to keep editor blocks that belong to a single text model together. */
export class ExecutionContexts implements IContextProvider {

    /** Updated from the editor, as models don't have this value. */
    public cursorPosition: IPosition = { lineNumber: 1, column: 1 };

    public dbVersion: number;

    private content: ExecutionContext[] = [];

    private store: StoreType;
    private sqlMode: string;
    private defaultSchema: string;

    private runUpdates?: (sql: string[]) => Promise<ISqlUpdateResult>;

    public constructor(params: IExecutionContextsParameters = {}) {
        this.store = params.store ?? StoreType.Unused;
        this.dbVersion = params.dbVersion ?? 80200;
        this.sqlMode = params.sqlMode ?? "";
        this.defaultSchema = params.currentSchema ?? "";
        this.runUpdates = params.runUpdates;

        // Register the update handler the first time on construction. Usually we do that when restoring
        // the contexts, but that happens only when results existed before switching pages.
        // For the first run however we need this registration.
        requisitions.register("sqlUpdateColumnInfo", this.sqlUpdateColumnInfo);
    }

    public [Symbol.iterator](): Iterator<ExecutionContext> {
        return this.content[Symbol.iterator]();
    }

    public get count(): number {
        return this.content.length;
    }

    /**
     * @returns true if all contexts confirmed that they can be closed.
     */
    public async canClose(): Promise<boolean> {
        for (const context of this) {
            if (!await context.canClose()) {
                return false;
            }
        }

        return true;
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
        // We are going to be closed so we can unregister the requisition.
        requisitions.unregister("sqlUpdateColumnInfo", this.sqlUpdateColumnInfo);

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
    public restoreFromStates(editor: CodeEditor, factory: ResultPresentationFactory,
        states: IExecutionContextState[]): void {

        // The update handler again (first time is in the constructor). Double registration of the same handler
        // doesn't add it twice, and we need it ready before we even restore the first time.
        requisitions.register("sqlUpdateColumnInfo", this.sqlUpdateColumnInfo);

        if (states.length === 0) {
            // Do not touch the current context list if there's nothing to restore.
            return;
        }

        this.content.forEach((context: ExecutionContext) => {
            return context.dispose();
        });

        // Do the restoration in two stages. First, create the contexts and apply all editor related actions, like
        // setting decorations and adding view zones with the final height.
        // Then, load the result sets and render them.
        this.content = [];
        const presentations: PresentationInterface[] = [];
        states.forEach((state: IExecutionContextState) => {
            // Setting start and end line of the presentation object renders their gutter decorations.
            // This also creates the view zone for the result pane, if the presentation is embedded.
            const presentation = factory(editor, state.language);
            presentation.startLine = state.start;
            presentation.endLine = state.end;

            const context = this.createContext(presentation, state.statements);
            this.content.push(context);

            presentations.push(presentation);
        });

        editor.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
            for (let i = 0; i < presentations.length; ++i) {
                const presentation = presentations[i];
                const state = states[i];
                if (state.result) {
                    const zone = presentation.viewZone;
                    if (zone) {
                        zone.heightInPx = state.currentHeight;
                        presentation.viewZoneId = changeAccessor.addZone(zone);
                    }
                }
            }
        });

        for (let i = 0; i < states.length; ++i) {
            const state = states[i];
            const context = this.content[i];
            if (state.result) {
                switch (state.result.type) {
                    case "resultIds": {
                        // Convert result data references back to result data. Result set data is loaded from
                        // the application DB, if possible.
                        const result: IResultSets = {
                            type: "resultSets",
                            sets: [],
                            output: [],
                        };

                        this.loadResultSets(state.result.list).then((resultSets) => {
                            result.sets = resultSets;

                            context.setResult(result, {
                                manualHeight: state.currentHeight,
                                currentSet: state.currentSet,
                                maximized: state.maximizeResultPane,
                            });
                        }).catch(() => {
                            // Ignore load errors.
                        });


                        break;
                    }

                    default: {
                        context.setResult(state.result, { manualHeight: state.currentHeight });

                        break;
                    }
                }
            }
        }
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
    public contextFromPosition(position: IPosition | undefined | null): IExecutionContext | undefined {
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

    /**
     * @returns A promise that resolves to the list of contexts with their state and result data.
     */
    public async collectRawState(): Promise<IExecutionContextDetails[]> {
        const result: IExecutionContextDetails[] = [];
        for (const context of this.content) {
            const state = context.state;
            const entry: IExecutionContextDetails = {
                state,
                data: [],
            };

            if (state.result && state.result.type === "resultIds") {
                for (const id of state.result.list) {
                    const values = await ApplicationDB.db.getAllFromIndex(this.store, "resultIndex", id);
                    if (this.isDbModuleResultData(values)) {
                        entry.data!.push(...values);
                    }
                }
            }

            result.push(entry);
        }

        return result;
    }

    /**
     * Switches the language of the context at the given index to the new language.
     * This will actually replace the context with a new one, but the presentation will be kept.
     *
     * @param index The index of the context to switch.
     * @param language The new language to use.
     */
    public switchContextLanguage(index: number, language: EditorLanguage): void {
        if (index < 0 || index >= this.content.length) {
            return;
        }

        const context = this.content[index];
        if (context.language === language) {
            return;
        }

        context.dispose();

        const presentation = context.presentation;
        presentation.language = language;
        void presentation.removeResult().then(() => {
            const newContext = this.createContext(presentation);
            this.content[index] = newContext;

            if (!presentation.isSQLLike) {
                // SQL like contexts validate on constructor anyway.
                newContext.scheduleFullValidation();
            }
        });
    }

    /**
     * Removes the results from all contexts.
     */
    public async removeAllResults(): Promise<void> {
        for (const context of this.content) {
            await context.removeResult();
        }
    }

    private createContext(presentation: PresentationInterface, statementSpans?: IStatementSpan[]): ExecutionContext {
        presentation.onRemoveResult = this.onResultRemoval;
        presentation.onCommitChanges = this.onCommitChanges;
        presentation.onRollbackChanges = this.rollbackChanges;

        if (presentation.isSQLLike) {
            return new SQLExecutionContext(presentation, this.dbVersion, this.sqlMode, this.defaultSchema,
                statementSpans);
        }

        return new ExecutionContext(presentation);
    }

    /**
     * Attempts to load all result sets back from the app DB into a result set structure.
     *
     * @param resultIds A list of previous response qualifiers used to get the result sets from the backend.
     *                  This is the ID under which the data was cached before.
     *
     * @returns A promise resolving to a list of result sets loaded from the app DB.
     */
    private async loadResultSets(resultIds: string[]): Promise<IResultSet[]> {
        const sets: IResultSet[] = [];

        for await (const id of resultIds) {
            const values = await ApplicationDB.db.getAllFromIndex(this.store, "resultIndex", id);
            const set: IResultSet = {
                type: "resultSet",
                resultId: id,
                sql: "",
                columns: [],
                data: {
                    rows: [],
                    hasMoreRows: false,
                    currentPage: 0,
                },
                updatable: false,
                fullTableName: "",
            };
            sets.push(set);

            if (this.isDbModuleResultData(values)) {
                for (const value of values) {
                    set.index = value.index;
                    if (value.sql) {
                        set.sql = value.sql;
                    }

                    // The updatable flag indicates if a query as such is updatable. Only very specific
                    // queries are updatable, like simple SELECT * FROM table_name.
                    set.updatable = value.updatable ?? false;
                    set.fullTableName = value.fullTableName ?? "";

                    if (value.columns) {
                        // Columns are set only for the first entry of a result.
                        set.columns.push(...value.columns);
                    }

                    set.data.rows.push(...value.rows);

                    if (value.executionInfo) {
                        set.data.executionInfo = value.executionInfo;
                    }

                    if (value.hasMoreRows) {
                        set.data.hasMoreRows = true;
                        set.data.currentPage = value.currentPage;
                    }
                }
            }
        }

        return sets;
    }

    private onResultRemoval = (resultIds: string[]): Promise<void> => {
        return ApplicationDB.removeDataByResultIds(this.store, resultIds);
    };

    private onCommitChanges = async (resultSet: IResultSet, updateSql: string[]): Promise<ISqlUpdateResult> => {
        const result = await this.runUpdates?.(updateSql) ?? { affectedRows: 0, errors: [] };
        if (typeof result === "number") {
            await ApplicationDB.updateRowsForResultId(StoreType.DbEditor, resultSet.resultId, resultSet.data.rows);
        }

        return result;

    };

    private rollbackChanges = async (resultSet: IResultSet): Promise<void> => {
        const rows = await ApplicationDB.getRowsForResultId(StoreType.DbEditor, resultSet.resultId);
        resultSet.data.rows = rows;
    };

    private sqlUpdateColumnInfo = async (data: IColumnDetails): Promise<boolean> => {
        return ApplicationDB.updateColumnsForResultId(StoreType.DbEditor, data);
    };

    private isDbModuleResultData(data: unknown[]): data is IDbModuleResultData[] {
        const array = data as IDbModuleResultData[];

        return array.length > 0 && array[0].tabId !== undefined;
    }

}
