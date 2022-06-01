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

import { IPosition } from "monaco-editor";

import { IExecutionContextState, IRange, Monaco, Position } from "../components/ui/CodeEditor";
import { isTextSpan } from "../utilities/ts-helpers";
import { CodeEditorLanguageServices } from "./ScriptingLanguageServices";
import { IDiagnosticEntry, IStatementSpan, TextSpan } from "../parsing/parser-common";
import { LoadingState, PresentationInterface } from "./PresentationInterface";
import { IExecuteResultReference, IExecutionResult } from ".";
import { EditorLanguage, IExecutionContext } from "../supplement";

// This class is the base building block for code management in a code editor.
// A context can be linked to other code by an optional link ID.
export class ExecutionContext implements IExecutionContext {
    private static nextId = 1;

    protected splitTimer: ReturnType<typeof setTimeout> | null;
    protected validationTimer: ReturnType<typeof setTimeout> | null;

    protected disposed = false;

    private internalId: string;
    private decorationIDs: string[] = [];

    public constructor(protected presentation: PresentationInterface, public linkId?: number) {
        this.internalId = `ec${ExecutionContext.nextId++}`;
        presentation.context = this;
    }

    /**
     * Important: since we have no d-tors in JS/TS it is necessary to call `dispose` to remove editor
     * decorations created by this command.
     */
    public dispose(): void {
        if (this.splitTimer) {
            clearTimeout(this.splitTimer);
        }
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }

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
                        list.push(value.head.requestId);
                    });

                    data.output?.forEach((value) => {
                        if (value.requestId) {
                            list.push(value.requestId);
                        }
                    });

                    result = {
                        type: "requestIds",
                        list,
                    };

                    break;
                }


                case "resultSetRows": {
                    // This is a temporary format and not used for storage in the context.
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
            currentHeight: this.presentation.currentHeight,
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
    }

    public get endLine(): number {
        return this.presentation.endLine;
    }

    public set endLine(value: number) {
        this.presentation.endLine = value;
    }

    /**
     * @returns A flag indicating if this context represents an internal (control) command.
     */
    public get isInternal(): boolean {
        return this.presentation.isInternal;
    }

    /**
     * @returns A list of request ids from which the current result data was produced.
     */
    public get requestIds(): string[] {
        return this.presentation.requestIds;
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

    public setResult(data?: IExecutionResult, manualHeight?: number, currentSet?: number, maximized?: boolean): void {
        if (!this.disposed) {
            this.presentation.setResult(data, manualHeight, currentSet, maximized);
        }
    }

    public addResultPage(data: IExecutionResult): void {
        if (!this.disposed) {
            this.presentation.addResultPage(data);
        }
    }

    public async addResultData(data: IExecutionResult): Promise<boolean> {
        if (!this.disposed) {
            return this.presentation.addResultData(data);
        }

        return false;
    }

    public updateResultDisplay(): void {
        if (!this.disposed) {
            this.presentation.updateResultDisplay();
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
            const services = CodeEditorLanguageServices.instance;
            services.validate(this, "", (result: IDiagnosticEntry[]): void => {
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
            if (this.validationTimer) {
                clearTimeout(this.validationTimer);
            }

            this.validationTimer = setTimeout(() => {
                this.validationTimer = null;
                this.validateAll();
            }, 200);
        }
    }

    protected clearDecorations(): void {
        // Nothing to do here.
    }

    /**
     * @returns details about individual statements in contexts that support this feature.
     */
    protected get statementSpans(): IStatementSpan[] {
        return [];
    }

}
