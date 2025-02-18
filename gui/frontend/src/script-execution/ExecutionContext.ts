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

import { IPosition } from "monaco-editor";

import {
    IRange, Monaco, Position, tokenModifiers, tokenTypes, type IExecutionContextState,
} from "../components/ui/CodeEditor/index.js";
import { isTextSpan } from "../utilities/ts-helpers.js";
import { ScriptingLanguageServices } from "./ScriptingLanguageServices.js";
import { IDiagnosticEntry, IStatementSpan, QueryType, TextSpan } from "../parsing/parser-common.js";
import { PresentationInterface } from "./PresentationInterface.js";
import {
    IExecuteResultReference, IExecutionResult, IExecutionResultData, IPresentationOptions,
    IResponseDataOptions, IResultSets, LoadingState, type IResultSet,
} from "./index.js";
import { EditorLanguage, IExecutionContext, ITextRange } from "../supplement/index.js";
import { ApplicationDB, type IDbModuleResultData, type StoreType } from "../app-logic/ApplicationDB.js";
import { uuidBinary16Base64 } from "../utilities/helpers.js";

/**
 * This class is the base building block for code management in a code editor.
 * A context can be linked to other places by an optional link ID.
 */
export class ExecutionContext implements IExecutionContext {
    private static nextId = 1;

    protected disposed = false;

    private internalId: string;
    private decorationIDs: string[] = [];

    #showNextResultMaximized = false;
    #tokenList: Uint32Array | undefined;
    #frozen = false;

    // Only used when the context is frozen.
    #cachedResultIds: Set<string> = new Set();

    #cachedHeight: number | undefined;
    #cachedSetIndex: number | undefined;
    #cachedMaximized: boolean | undefined;

    public constructor(public presentation: PresentationInterface, private store: StoreType,
        public linkId?: number) {
        this.internalId = uuidBinary16Base64(); //`ec${ExecutionContext.nextId++}`;
        presentation.context = this;
    }

    public get tokenList(): Uint32Array | undefined {
        return this.#tokenList;
    }

    /**
     * Important: since we have no d-tors in JS/TS it is necessary to call `dispose` to remove editor
     * decorations created by this command and stop any ongoing tasks.
     */
    public dispose(): void {
        this.presentation.dispose();
        this.clearDecorations();

        this.disposed = true;
    }

    public get id(): string {
        return this.internalId;
    }

    public get code(): string {
        return this.presentation.code;
    }

    public get codeLength(): number {
        return this.presentation.codeLength;
    }

    public get language(): EditorLanguage {
        return this.presentation.language;
    }

    public set language(value: EditorLanguage) {
        this.presentation.language = value;
        void this.presentation.removeResult().then(() => {
            this.validateAll();
        });
    }

    public get isSQLLike(): boolean {
        return this.presentation.isSQLLike;
    }

    public get state(): IExecutionContextState {
        let result: IExecuteResultReference | undefined;
        const data = this.presentation.resultData;

        if (data) {
            switch (data.type) {
                case "resultSets": {
                    const list: string[] = [];
                    data.sets.forEach((value) => {
                        list.push(value.resultId);
                    });

                    data.output?.forEach((value) => {
                        if (value.resultId) {
                            list.push(value.resultId);
                        }
                    });

                    result = {
                        type: "resultIds",
                        list,
                    };

                    break;
                }


                default: {
                    result = data;

                    break;
                }
            }
        }

        return {
            start: this.presentation.startLine,
            end: this.presentation.endLine,
            language: this.language,
            result,
            currentHeight: this.presentation.cachedHeight,
            currentSet: this.presentation.currentSet,
            maximizeResultPane: this.presentation.maximizedResult,
            statements: this.statementSpans,
        };
    }

    /**
     * Returns the model which is associated with this context. By default that is the model for the entire
     * editor, but block oriented contexts can create local models, just for the code block they represent.
     *
     * @returns The model currently assigned to the editor associated with this execution context.
     */
    public get model(): Monaco.ITextModel | null {
        return this.presentation.model;
    }

    public get startLine(): number {
        return this.presentation.startLine;
    }

    public set startLine(value: number) {
        this.presentation.startLine = value;
        this.clearDecorations();
    }

    public get endLine(): number {
        return this.presentation.endLine;
    }

    public set endLine(value: number) {
        this.presentation.endLine = value;
        this.clearDecorations();
    }

    /**
     * @returns A flag indicating if this context represents an internal (control) command.
     */
    public get isInternal(): boolean {
        return this.presentation.isInternal;
    }

    public get fullRange(): ITextRange | undefined {
        const range = this.model?.getFullModelRange();

        if (range) {
            return {
                startLine: range.startLineNumber,
                startColumn: range.startColumn,
                endLine: range.endLineNumber,
                endColumn: range.endColumn,
            };
        }

        return undefined;
    }

    /**
     * Prepares the context for putting it into a frozen state. This is used when the context is no longer in view
     * (e.g. when its connection page is unmounted). In this state it does not hold all resource data anymore, but
     * stores only the necessary information to restore the context when it is needed again.
     */
    public deactivate(): void {
        this.#frozen = true;
        this.presentation.resultIds.forEach((value) => {
            if (value) {
                this.#cachedResultIds.add(value);
            }
        });
        this.#cachedHeight = this.presentation.cachedHeight;
        this.clearDecorations();
        this.presentation.freeze();
    }

    /**
     * When loading contexts from persistent storage they must act as if they were frozen. Particularly
     * they must have cached result ids for later activation.
     *
     * @param cachedIds The list of result IDs that are cached for later activation.
     * @param currentHeight The height of the result pane, when the context was exported.
     * @param currentSet The index of the active result set, when the context was exported.
     * @param showMaximized A flag indicating if the result pane was maximized, when the context was exported.
     */
    public startFrozen(cachedIds: string[], currentHeight: number | undefined, currentSet: number | undefined,
        showMaximized: boolean | undefined): void {
        this.#frozen = true;
        this.#cachedResultIds = new Set(cachedIds);
        this.#cachedHeight = currentHeight;
        this.#cachedSetIndex = currentSet;
        this.#cachedMaximized = showMaximized;
    }

    /**
     * Reactivates this previously deactivated context. It restores its editor decorations and loads the result data
     * from the database.
     *
     * @param editor The editor to associate with this context.
     */
    public activate(editor: Monaco.IStandaloneCodeEditor): void {
        this.#frozen = false;
        this.presentation.activate(editor, this.#cachedHeight);

        if (this.#cachedResultIds.size > 0) {
            // Convert result data references back to result data. Result set data is loaded from
            // the application DB, if possible.
            // Keep previously generated output text.
            void this.loadResultSets().then((sets) => {
                let output;
                if (this.presentation.resultData?.type === "resultSets") {
                    output = this.presentation.resultData.output;
                }

                const result: IResultSets = {
                    type: "resultSets",
                    sets,
                    output,
                };

                result.sets = sets;
                this.#cachedResultIds.clear();
                this.presentation.setResult(result, {
                    manualHeight: this.#cachedHeight,
                    maximized: this.#cachedMaximized,
                    currentSet: this.#cachedSetIndex,
                });
            });

        } else if (this.presentation.resultData) {
            setTimeout(() => {
                this.presentation.setResult(this.presentation.resultData!);
            }, 0);
        }
    }

    public canClose(): Promise<boolean> {
        return this.presentation.canClose();
    }

    public showNextResultMaximized(): void {
        this.#showNextResultMaximized = true;
    }

    /**
     * Selects the statement with the given index (counting continuously from zero through all statements).
     * This is however only supported for languages we parse and hence know their statement positions (like SQL).
     *
     * @param index The zero based index of the statement to select.
     */
    public selectStatement(index: number): void {
        throw new Error(`Cannot select individual statements (index ${index})`);
    }

    /**
     * Updates the start and end line members only, without updating anything else (like decorations).
     * This is used after edit actions that affected a command before this one, where Monaco automatically updated
     * the decorations already. We only need to update our inner state to stay in sync.
     *
     * @param delta The number of lines we moved.
     */
    public movePosition(delta: number): void {
        this.presentation.movePosition(delta);
    }

    /**
     * Converts the given position to one which is relative to this context.
     *
     * @param value The position to convert.
     *
     * @returns The position in local space.
     */
    public toLocal(value: IPosition): IPosition {
        return {
            lineNumber: value.lineNumber - this.presentation.startLine + 1,
            column: value.column,
        };
    }

    /**
     * Converts the given local range or span to one which works in the owning editor.
     *
     * @param value The position/span values to convert. Possible types are Range and ts.TextSpan.
     *
     * @returns The global range.
     */
    public fromLocal(value: TextSpan | IRange): IRange {
        if (isTextSpan(value)) {
            const model = this.model;

            const startPosition = model ? model.getPositionAt(value.start) : new Position(0, 0);
            const endPosition = model ? model.getPositionAt(value.start + (value.length || 0)) : new Position(0, 0);

            return {
                startLineNumber: startPosition.lineNumber + this.startLine - 1,
                startColumn: startPosition.column,
                endLineNumber: endPosition.lineNumber + this.startLine - 1,
                endColumn: endPosition.column,
            };
        }

        return {
            startLineNumber: value.startLineNumber + this.startLine - 1,
            startColumn: value.startColumn,
            endLineNumber: value.endLineNumber + this.startLine - 1,
            endColumn: value.endColumn,
        };
    }

    /**
     * Converts a line/column position into an offset.
     *
     * @param position The position in the entire editor to convert.
     *
     * @returns The character offset from the start of the entire model text.
     */
    public getOffsetAt(position: Position): number {
        const model = this.model;
        if (model) {
            position = model.validatePosition(position);

            return model.getOffsetAt(position);
        }

        return 0;
    }

    /**
     * Converts a character offset into a line/column pair.
     *
     * @param offset The character offset from the start of the entire model text.
     *
     * @returns The line/column pair corresponding to this offset.
     */
    public getPositionAt(offset: number): Position {
        const model = this.model;
        if (model) {
            return model.getPositionAt(offset);
        }

        return new Position(1, 1);
    }

    /**
     * Removes the content of the result area.
     */
    public async clearResult(): Promise<void> {
        if (!this.disposed) {
            await this.presentation.clearResult();
        }
    }

    /**
     * Removes the entire result area.
     */
    public async removeResult(): Promise<void> {
        if (!this.disposed) {
            await this.presentation.removeResult();
        }
    }

    public executionStarts(): void {
        if (!this.disposed) {
            this.presentation.executionStarts();
        }
    }

    /**
     * Replaces the current content of the presentation with the given data. This method is usually used
     * to restore a previously saved data set.
     *
     * @param data The data to show.
     * @param presentationOptions Options to restore the visual state of the result area.
     */
    public setResult(data: IExecutionResultData, presentationOptions: IPresentationOptions): void {
        if (!this.disposed) {
            this.presentation.setResult(data, presentationOptions);
        }
    }

    /**
     * Adds the given execution result data to this context, by mapping the given request ID to one of the
     * already existing result tabs. If no set exists yet for that request, a new one will be created.
     *
     * @param data The data that must be visualized in the result (if not given then remove any existing result).
     * @param dataOptions Additional information for the result data.
     * @param presentationOptions Additional information about the data visualization.
     * @param queryType The type of query that was executed.
     *
     * @returns A promise resolving to true if the operation was concluded successfully, otherwise false.
     */
    public async addResultData(data: IExecutionResult, dataOptions: IResponseDataOptions,
        presentationOptions?: IPresentationOptions, queryType?: QueryType): Promise<void> {
        if (!this.disposed) {
            if (this.#frozen && data.type === "resultSetRows") {
                this.#cachedResultIds.add(dataOptions.resultId);
            }

            const options = presentationOptions ?? {};
            if (this.#showNextResultMaximized) {
                options.maximized = true;
                this.#showNextResultMaximized = false;
            }

            return this.presentation.addResultData(data, dataOptions, options, queryType);
        }
    }

    public get loadingState(): LoadingState {
        return this.presentation.loadingState;
    }

    /**
     * Called from the editor for any change going on there (user typing, pasting, undoing etc.).
     * This context's end line is already updated by the caller.
     * We always re-validate the full context here, as this is handled by the JS/TS backend.
     *
     * @param changes The original monaco-editor changes to apply.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public applyEditorChanges(changes: Monaco.IModelContentChange[]): void {
        if (!this.disposed) {
            this.scheduleFullValidation();
        }
    }

    /**
     * Validates the entire content of the editor.
     * SQL contexts overwrite this method for their own handling.
     */
    public validateAll(): void {
        if (!this.disposed) {
            const services = ScriptingLanguageServices.instance;

            // No need to send the model content here. The validator will get it from the model.
            void services.validate(this, "", (result: IDiagnosticEntry[]): void => {
                // Update the decorations in the editor.
                this.decorationIDs = this.presentation.updateDiagnosticsDecorations(this.decorationIDs, result);
            });
        }
    }

    /**
     * Starts a timer that triggers a full validation of the content if not canceled.
     */
    public scheduleFullValidation(): void {
        if (!this.isInternal && !this.disposed) {
            this.validateAll();
        }
    }

    /**
     * Triggered from the semantic token provider to let the context update its token list to allow construction
     * of semantic tokens.
     */
    public async updateTokenList(): Promise<void> {
        const services = ScriptingLanguageServices.instance;
        const list = await services.tokenize(this);

        /**
         * Local helper method to convert the token modifiers into a bit set.
         *
         * @param modifiers The list of modifiers to convert.
         *
         * @returns The bit set representing the given modifiers.
         */
        const getModifierSet = (modifiers: string[]): number => {
            let nModifiers = 0;
            for (const modifier of modifiers) {
                const nModifier = tokenModifiers.indexOf(modifier);
                if (nModifier > -1) {
                    nModifiers |= (1 << nModifier) >>> 0;
                } else if (modifier === "ts" || modifier === "js") {
                    // Ignore these.
                } else {
                    console.log(`Unknown modifier: ${modifier}`);
                }
            }

            return nModifiers;
        };

        // As we have to return relative line and column information, we can also compute relative to zero,
        let previousLine = 0;
        let previousColumn = 0;

        const data: number[] = [];

        list.forEach((line) => {
            line.forEach((token) => {
                if (token.type.length > 0) {
                    const parts = token.type.split(".");

                    if (parts.length > 0) {
                        const tokenTypeIndex = tokenTypes.indexOf(parts[0]);
                        if (tokenTypeIndex >= 0) {
                            parts.shift(); // Remove the token type.
                            const modifierIndexSet = getModifierSet(parts);

                            // 5 numbers per entry (line delta, column delta, length, token type, token modifier).
                            data.push(
                                token.line - previousLine,
                                previousLine === token.line ? token.column - previousColumn : token.column,
                                token.length,
                                tokenTypeIndex,
                                modifierIndexSet,
                            );

                            previousLine = token.line;
                            previousColumn = token.column;

                        }
                    }
                }
            });
        });

        this.#tokenList = new Uint32Array(data);
    }

    protected clearDecorations(): void {
        this.decorationIDs = this.presentation.updateDiagnosticsDecorations(this.decorationIDs, []);
    }

    /**
     * @returns details about individual statements in contexts that support this feature.
     */
    protected get statementSpans(): IStatementSpan[] {
        return [];
    }

    /**
     * Attempts to load all result sets back from the app DB into a result set structure.
     *
     * @returns A promise resolving to a list of result sets loaded from the app DB.
     */
    private async loadResultSets(): Promise<IResultSet[]> {
        const sets: IResultSet[] = [];

        let index = 0;
        for await (const id of this.#cachedResultIds) {
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
                    set.index = index++;
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

    private isDbModuleResultData(data: unknown[]): data is IDbModuleResultData[] {
        const array = data as IDbModuleResultData[];

        return array.length > 0 && array[0].tabId !== undefined;
    }

}
