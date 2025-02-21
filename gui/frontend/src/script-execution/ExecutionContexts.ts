/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { ApplicationDB, IDocumentResultData, StoreType } from "../app-logic/ApplicationDB.js";
import type { ISqlUpdateResult } from "../app-logic/general-types.js";
import { CodeEditor, ResultPresentationFactory } from "../components/ui/CodeEditor/CodeEditor.js";
import { IPosition, Monaco } from "../components/ui/CodeEditor/index.js";
import { IStatementSpan } from "../parsing/parser-common.js";
import { type IColumnDetails } from "../supplement/RequisitionTypes.js";
import { requisitions } from "../supplement/Requisitions.js";
import { EditorLanguage, ITextRange } from "../supplement/index.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { PresentationInterface } from "./PresentationInterface.js";
import { SQLExecutionContext } from "./SQLExecutionContext.js";
import { IContextProvider, IExecutionContextDetails, IResultSet } from "./index.js";

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

        requisitions.register("sqlUpdateColumnInfo", this.sqlUpdateColumnInfo);
    }

    public [Symbol.iterator](): Iterator<ExecutionContext> {
        return this.content[Symbol.iterator]();
    }

    public get count(): number {
        return this.content.length;
    }

    public dispose(): void {
        requisitions.unregister("sqlUpdateColumnInfo", this.sqlUpdateColumnInfo);

        this.content.forEach((context: ExecutionContext) => {
            context.dispose();
        });
        this.content = [];
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
     * Prepares the context list for the switch to a different list. Each context removes its decorations and
     * removes its result data (if any) from memory.
     */
    public deactivateContexts(): void {
        this.content.forEach((context: ExecutionContext) => {
            context.deactivate();
        });
    }

    /**
     * Restores a list of previously deactivated execution contexts and connects them with the given editor.
     *
     * @param backend The editor backend to connect the contexts to.
     */
    public activateContexts(backend: Monaco.IStandaloneCodeEditor): void {
        for (const context of this.content) {
            context.activate(backend);
        }
    }

    /**
     * Creates new contexts from the given states.
     *
     * @param editor The code editor to connect the contexts to.
     * @param factory The factory to create the presentation objects.
     * @param details The details for the contexts to restore.
     */
    public restoreFromStates(editor: CodeEditor, factory: ResultPresentationFactory,
        details: IExecutionContextDetails[]): void {

        if (details.length === 0 || !editor.backend) {
            // Do not touch the current context list if there's nothing to restore.
            return;
        }

        this.content.forEach((context: ExecutionContext) => {
            return context.dispose();
        });

        this.content = [];
        details.forEach((detail) => {
            // Setting start and end line of the presentation object renders their gutter decorations.
            // This also creates the view zone for the result pane, if the presentation is embedded.
            const presentation = factory(editor, detail.state.language);
            presentation.startLine = detail.state.start;
            presentation.endLine = detail.state.end;

            const context = this.createContext(presentation, detail.state.statements);
            if (detail.state.result) {
                switch (detail.state.result.type) {
                    case "resultIds": {
                        context.startFrozen(detail.state.result.list, detail.state.currentHeight,
                            detail.state.currentSet, detail.state.maximizeResultPane);

                        break;
                    }

                    default: {
                        context.startFrozen([], detail.state.currentHeight,
                            detail.state.currentSet, detail.state.maximizeResultPane);
                        context.setResult(detail.state.result, {});

                        break;
                    }
                }
            }

            this.content.push(context);
        });

        this.activateContexts(editor.backend);
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

        const backend = context.presentation.backend;
        context.dispose();

        if (backend) {
            const presentation = context.presentation;
            presentation.language = language;
            void presentation.removeResult().then(() => {
                const newContext = this.createContext(presentation);
                presentation.activate(backend);
                this.content[index] = newContext;

                if (!presentation.isSQLLike) {
                    // SQL like contexts validate on constructor anyway.
                    newContext.scheduleFullValidation();
                }
            });
        }
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
        presentation.updateRowsForResultId = this.updateRowsForResultId;
        presentation.onRollbackChanges = this.rollbackChanges;

        if (presentation.isSQLLike) {
            return new SQLExecutionContext(presentation, this.store, this.dbVersion, this.sqlMode, this.defaultSchema,
                statementSpans);
        }

        return new ExecutionContext(presentation, this.store);
    }

    private onResultRemoval = (resultIds: string[]): Promise<void> => {
        return ApplicationDB.removeDataByResultIds(this.store, resultIds);
    };

    private updateRowsForResultId = async (resultSet: IResultSet) => {
        await ApplicationDB.updateRowsForResultId(StoreType.Document, resultSet.resultId, resultSet.data.rows);
    };

    private onCommitChanges = async (resultSet: IResultSet, updateSql: string[]): Promise<ISqlUpdateResult> => {
        const result = await this.runUpdates?.(updateSql) ?? { affectedRows: 0, errors: [] };
        if (typeof result.affectedRows === "number") {
            await this.updateRowsForResultId(resultSet);
        }

        return result;
    };

    private rollbackChanges = async (resultSet: IResultSet): Promise<void> => {
        const rows = await ApplicationDB.getRowsForResultId(StoreType.Document, resultSet.resultId);
        resultSet.data.rows = rows;
    };

    private sqlUpdateColumnInfo = async (data: IColumnDetails): Promise<boolean> => {
        return ApplicationDB.updateColumnsForResultId(StoreType.Document, data);
    };

    private isDbModuleResultData(data: unknown[]): data is IDocumentResultData[] {
        const array = data as IDocumentResultData[];

        return array.length > 0 && array[0].tabId !== undefined;
    }

}
