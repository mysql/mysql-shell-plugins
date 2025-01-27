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

import { ComponentChild, createRef, render } from "preact";

import { ResultTabView } from "../components/ResultView/ResultTabView.js";
import { Monaco } from "../components/ui/CodeEditor/index.js";
import { DiagnosticSeverity, IDiagnosticEntry, QueryType, TextSpan } from "../parsing/parser-common.js";
import { type IColumnDetails } from "../supplement/RequisitionTypes.js";
import { requisitions } from "../supplement/Requisitions.js";
import { EditorLanguage } from "../supplement/index.js";
import { ExecutionContext } from "./ExecutionContext.js";
import {
    IExecutionResult, IExecutionResultData, IPresentationOptions, IResponseDataOptions,
    IResultSet,
    IResultSetRows, IResultSets, LoadingState,
} from "./index.js";

import { MessageType, type ISqlUpdateResult } from "../app-logic/general-types.js";
import { AboutHost } from "../components/About/AboutHost.js";
import { ChatAction, ChatHost } from "../components/Chat/ChatHost.js";
import { ActionOutput } from "../components/ResultView/ActionOutput.js";
import { ResultStatus } from "../components/ResultView/ResultStatus.js";
import { GraphHost } from "../components/graphs/GraphHost.js";
import { Container, Orientation } from "../components/ui/Container/Container.js";
import { SQLExecutionContext } from "./SQLExecutionContext.js";

/** Base class for handling of UI related elements like editor decorations and result display in execution contexts. */
export class PresentationInterface {

    /** A mapping from diagnostic categories to CSS class names. */
    public static validationClass: Map<DiagnosticSeverity, string> = new Map([
        [DiagnosticSeverity.Error, "error"],
        [DiagnosticSeverity.Warning, "warning"],
        [DiagnosticSeverity.Message, "message"],
        [DiagnosticSeverity.Suggestion, "suggestion"],
    ]);

    // The maximum height for the result area.
    protected static maxHeight = 800;
    protected static maxAutoHeight = {
        text: 352,
        resultSets: 352,
        graphData: 300,
        chat: 400,
        about: 200,
    };

    /** The size of the result area after adding data or manual resize by the user. */
    public currentHeight?: number;

    /** The currently selected result set (tab page). The value 0 represents the output page. */
    public currentSet: number = 1;

    /** A flag which indicates if the result pane shall be maximized. */
    public maximizedResult?: boolean;

    public resultData?: IExecutionResultData;
    public loadingState = LoadingState.Idle;

    public context?: ExecutionContext;

    /**
     * A function to send a notification if the current result is being replaced by nothing.
     * Useful for higher level consumers to update their storage (e.g. cached results).
     * Note: this is not used when disposing of the presentation (where we want to keep the data for later restore).
     */
    public onRemoveResult?: (resultIds: string[]) => Promise<void>;

    public onCommitChanges?: (resultSet: IResultSet, updateSql: string[]) => Promise<ISqlUpdateResult>;
    public updateRowsForResultId?: (resultSet: IResultSet) => Promise<void>;
    public onRollbackChanges?: (resultSet: IResultSet) => Promise<void>;

    // The target HTML element to which we render the React nodes dynamically.
    protected renderTarget?: HTMLDivElement;

    // Set, when user manually resized the height of the result view.
    protected manuallyResized = false;

    // The minimum for the result area. Depends on the content.
    protected minHeight = 180;

    // For text + result set output.
    protected alwaysShowTab = false;

    /** If this presentation interface maintains view zones, then this structure holds the relevant info. */
    protected zoneInfo?: {
        zoneId: string;
        zone: Monaco.IViewZone;
    };

    // Each line gets a margin decoration with varying content, depending where the context is used
    // and other conditions.
    private marginDecorationIDs: string[] = [];
    private markedLines: Set<number> = new Set();
    private markerClass = "";

    private waitTimer: ReturnType<typeof setTimeout> | null = null;

    // Only set for result set data.
    private resultRef = createRef<ResultTabView>();

    /**
     * Represents the full code editor of which this presentation is a part of. Only set when the
     * presentation is active.
     */
    #backend?: Monaco.IStandaloneCodeEditor;

    public constructor(public language: EditorLanguage) {
        this.prepareRenderTarget();

        requisitions.register("sqlUpdateColumnInfo", this.updateColumnInfo);
    }

    public dispose(): void {
        requisitions.unregister("sqlUpdateColumnInfo", this.updateColumnInfo);
        this.freeze();
        void this.clearResult();
    }

    /**
     * Cleans up the presentation interface and removes all decorations and result data.
     * Ongoing processes are still allowed to finish. New data is however ignored here. Instead that is stored
     * in the application database and loaded when the presentation is restored.
     */
    public freeze(): void {
        const editorModel = this.#backend?.getModel?.();
        if (editorModel) {
            editorModel.deltaDecorations?.(this.marginDecorationIDs, []);
        }
        this.marginDecorationIDs = [];

        this.resultRef.current = null;
        if (this.resultData?.type === "resultSets") {
            this.resultData.sets = [];
        }

        this.removeRenderTarget();
        this.#backend = undefined;
    }

    /**
     * Reactivates the presentation interface after it was frozen.
     *
     * @param backend The editor backend to which this presentation is attached.
     * @param _cachedHeight Unused. Will be set when data is added.
     */
    public activate(backend: Monaco.IStandaloneCodeEditor, _cachedHeight?: number): void {
        this.#backend = backend;
        this.prepareRenderTarget();
    }

    /**
     * @returns true if this presentation can be closed/disposed of, otherwise false.
     *
     * If there are pending changes in the result view, then the user is asked to confirm the close operation.
     */
    public canClose(): Promise<boolean> {
        return this.resultRef.current?.canClose() ?? Promise.resolve(true);
    }

    public get backend(): Monaco.IStandaloneCodeEditor | undefined {
        return this.#backend;
    }

    public get model(): Monaco.ITextModel | null {
        if (this.#backend) {
            return this.#backend.getModel?.() ?? null;
        }

        return null;
    }

    public get code(): string {
        const model = this.model; // Full or block model.

        return model?.getValue() ?? "";
    }

    public get codeLength(): number {
        const model = this.model;

        return model ? model.getValueLength() : 0;
    }

    /**
     * @returns The offset of the first character within the overall editor content.
     */
    public get codeOffset(): number {
        return 0;
    }

    public get startLine(): number {
        return 1;
    }

    public set startLine(value: number) {
        // Nothing to do here.
    }

    public get endLine(): number {
        return this.model ? this.model.getLineCount() : 0;
    }

    public set endLine(value: number) {
        // Nothing to do here.
    }

    /**
     * @returns A list of result ids for the current result data (provided it is a result set).
     */
    public get resultIds(): string[] {
        switch (this.resultData?.type) {
            case "resultSets": {
                const set1 = this.resultData.sets.map((set) => {
                    return set.resultId;
                });
                const set2 = this.resultData.output?.map((entry) => {
                    return entry.resultId ?? "";
                });

                if (set2) {
                    return [...set1, ...set2];
                }

                return set1;
            }

            default: {
                return [];
            }
        }
    }

    /**
     * @returns The view zone details if this presentation interface maintains a view zone.
     */
    public get viewZone(): Monaco.IViewZone | undefined {
        return this.zoneInfo?.zone;
    }

    /**
     * Returns a height which can be used to set when restoring a view zone. This is either the height set by the user
     * by resizing the result view, or the height of the result view when it was last rendered.
     * If no height is available, the minimum height is returned.
     *
     * @returns The height in pixels.
     */
    public get cachedHeight(): number | undefined {
        return this.currentHeight ?? this.zoneInfo?.zone.heightInPx;
    }

    /**
     * Updates the start and end line members only, without updating anything else (like decorations).
     * This is used after edit actions that affected a command before this one, where Monaco automatically updated
     * the decorations already. We only need to update our inner state to stay in sync.
     *
     * @param delta The number of lines we moved.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public movePosition(delta: number): void {
        // Nothing to do here.
    }

    /**
     * Removes result view content from the presentation. Regardless of the requestId parameter, the output area
     * will always be cleared and removed.
     *
     * @param resultId If specified only the tab which belongs to the given ID is removed.
     */
    public async clearResult(resultId?: string): Promise<void> {
        if (this.waitTimer) {
            clearTimeout(this.waitTimer);
            this.waitTimer = null;
        }
        this.changeLoadingState(LoadingState.Idle);

        if (!this.resultData) {
            return;
        }

        if (resultId) {
            await this.onRemoveResult?.([resultId]);
        } else {
            await this.onRemoveResult?.(this.resultIds);
        }

        if (!resultId) {
            this.resultData = undefined;
        } else {
            switch (this.resultData.type) {
                case "text": {
                    if (this.resultData.text) {
                        const index = this.resultData.text?.findIndex((candidate) => {
                            return candidate.resultId === resultId;
                        });

                        if (index > -1) {
                            this.resultData.text.splice(index, 1);
                            if (this.resultData.text.length === 0) {
                                // If the result data is empty now, remove it entirely.
                                this.resultData = undefined;
                            }
                        }
                    } else {
                        // Just for completeness. Will probably never happen.
                        this.resultData = undefined;
                    }

                    break;
                }

                case "resultSets": {
                    const resultSets = this.resultData.sets;
                    const index = resultSets.findIndex((candidate) => {
                        return candidate.resultId === resultId;
                    });

                    if (index > -1) {
                        this.resultData.sets.splice(index, 1);
                        if (this.resultData.sets.length === 0) {
                            this.resultData = undefined;
                        }
                    }

                    break;
                }

                default: {
                    this.resultData = undefined;

                    break;
                }
            }

            this.renderResults();
        }
    }

    public async removeResult(): Promise<void> {
        await this.clearResult();
        this.removeRenderTarget();
    }

    /**
     * Called by the code execution code to indicate that a new request just started.
     * @param initialState The initial state to set the loading state to. If not set then the state is set to pending.
     */
    public executionStarts(initialState?: LoadingState): void {
        if (this.waitTimer || this.loadingState !== LoadingState.Idle) {
            // No need for action if we already know we are waiting for results.
            return;
        }

        // Start the wait timer to show a waiting animation, if the first result takes too long to arrive.
        if (!initialState) {
            this.waitTimer = setTimeout(() => {
                this.waitTimer = null;
                this.changeLoadingState(LoadingState.Waiting);
            }, 500);
            this.changeLoadingState(LoadingState.Pending);
        } else {
            this.changeLoadingState(initialState);
        }
    }

    /**
     * Replaces the current content of the presentation with the given data. This method is usually used
     * to restore a previously saved data set.
     *
     * @param data The data to show.
     * @param presentationOptions Options to restore the visual state of the result area.
     */
    public setResult(data: IExecutionResultData, presentationOptions?: IPresentationOptions): void {
        if (this.waitTimer) {
            clearTimeout(this.waitTimer);
            this.waitTimer = null;
        }

        if (data.type === "resultSets") {
            // Empty results in sets are shown as text. This is already covered in the output field.
            // So simply filter out empty result sets.
            data.sets = data.sets.filter((set) => {
                return set.data.rows.length > 0;
            });
        }
        this.resultData = data;

        this.renderResults(presentationOptions);
    }

    /**
     * Adds the given execution result data to this presentation, by mapping the given request ID to one of the
     * already existing result tabs. If no set exists yet for that request, a new one will be created.
     * There are two exceptions to this rule:
     * 1. If an old request ID is given in addition to the data, then the content of the tab with this old request ID
     *    is cleared before adding new data.
     * 2. If the new data is only text output then no tab is added but the
     *
     * @param data The data that must be visualized in the result (if not given then remove any existing result).
     * @param dataOptions Additional information for the result data.
     * @param presentationOptions Controls the result area presentation after adding the new data.
     *
     * @returns A promise resolving to true if the operation was concluded successfully, otherwise false.
     */
    public async addResultData(data: IExecutionResult, dataOptions: IResponseDataOptions,
        presentationOptions?: IPresentationOptions, queryType?: QueryType): Promise<void> {

        // If this is the first result we receive, switch to the loading state.
        const isBusy = this.loadingState === LoadingState.Loading || this.loadingState === LoadingState.Waiting;
        if (this.waitTimer || isBusy) {
            if (this.waitTimer) {
                clearTimeout(this.waitTimer);
                this.waitTimer = null;
            }

            // Execution is finished if either we have execution info (and no result data so far) or we got
            // a chat result with an answer.
            if (!this.resultData && "executionInfo" in data) {
                this.changeLoadingState(LoadingState.Idle);
            } else if (data.type === "chat" && "answer" in data && data.answer !== "") {
                this.changeLoadingState(LoadingState.Idle);
            } else if (data.type !== "chat") {
                this.changeLoadingState(LoadingState.Loading);
            }
        }

        switch (data.type) {
            case "text": {
                if (!this.resultData) {
                    // No data yet. Take the given one unchanged.
                    this.resultData = data;
                } else if (this.resultData.type === "resultSets") {
                    // There's result set data shown currently. In this case add the text to the output tab.
                    // If no output tab exists already, create it.
                    if (!this.resultData.output) {
                        this.resultData.output = [];
                    }

                    if (data.text) {
                        this.resultData.output.push(...data.text);
                    }
                } else if (this.resultData.type === "graphData") {
                    // TODO: If graph data is visible, add the text as another entry to the graph page.
                } else if (this.resultData.type === "chat") {
                    // TODO: If a chat result is visible, add the text as another entry to the page.
                } else if (this.resultData.type === "about") {
                    // TODO: If a about result is visible, add the text as another entry to the page.
                } else {
                    // Text data to render.
                    if (!this.resultData.text) {
                        this.resultData.text = data.text;
                    } else if (data.text) {
                        // If the last entry has the same language as the new data, then merge them.
                        const lastEntry = this.resultData.text[this.resultData.text.length - 1];
                        while (data.text.length > 0 && data.text[0].index === lastEntry.index
                            && data.text[0].language === lastEntry?.language) {
                            lastEntry.content += data.text[0].content;
                            data.text.shift();
                        }

                        // Add the remaining text data.
                        this.resultData.text.push(...data.text);
                        if (data.executionInfo) {
                            this.resultData.executionInfo = data.executionInfo;

                            // We got execution info, so we can return into idle state.
                            this.changeLoadingState(LoadingState.Idle);
                        }
                    }
                }

                break;
            }

            case "resultSetRows": {
                if (!this.resultData) {
                    if (data.rows.length === 0 && queryType !== QueryType.Select) {
                        this.addEmptyResultSetAsText(data, dataOptions);
                    } else {
                        this.resultData = {
                            type: "resultSets",
                            sets: [{
                                type: "resultSet",
                                index: dataOptions.index,
                                subIndex: dataOptions.subIndex,
                                resultId: dataOptions?.resultId,
                                sql: dataOptions.sql ?? "",
                                columns: data.columns ?? [],
                                data,
                                updatable: dataOptions.updatable ?? false,
                                fullTableName: dataOptions.fullTableName ?? "",
                            }],
                        };
                    }
                } else {
                    let needUpdate = true;
                    switch (this.resultData.type) {
                        case "resultSets": {
                            // Find the target set (tab) to add the data to or create a new one.
                            const resultSets = this.resultData.sets;

                            // Add the data to our internal storage, to support switching tabs
                            // for multiple result sets.
                            let index = -1;
                            const resultSet = resultSets.find((candidate, candidateIndex) => {
                                if (candidate.resultId === dataOptions.resultId) {
                                    index = candidateIndex;

                                    return true;
                                }

                                return false;
                            });

                            if (resultSet) {
                                // No need for re-rendering if the result set already exists and
                                // we only add new rows.
                                if (data.executionInfo) {
                                    resultSet.data.executionInfo = data.executionInfo;
                                } else {
                                    needUpdate = false;
                                }

                                // Internal storage to support result tab switching.
                                if (dataOptions.replaceData) {
                                    resultSet.data.rows = data.rows;
                                } else {
                                    resultSet.data.rows.push(...data.rows);
                                }

                                // Also update columns if they were given.
                                if (data.columns && data.columns.length > 0) {
                                    resultSet.columns = data.columns;
                                }

                                resultSet.data.currentPage = data.currentPage;
                                resultSet.data.hasMoreRows = data.hasMoreRows;

                                if (this.currentSet === index + 1) {
                                    // Tab is visible, so send it the new data.
                                    if (data.columns && data.columns.length > 0) {
                                        await this.resultRef.current?.updateColumns(dataOptions.resultId,
                                            data.columns);
                                    }
                                    await this.resultRef.current?.addData(data, dataOptions.resultId,
                                        dataOptions.replaceData);
                                }
                            } else {
                                if (data.rows.length === 0 && queryType !== QueryType.Select) {
                                    this.addEmptyResultSetAsText(data, dataOptions);
                                } else {
                                    // No existing result set tab found - create it.
                                    this.resultData.sets.push({
                                        type: "resultSet",
                                        index: dataOptions.index,
                                        subIndex: dataOptions.subIndex,
                                        resultId: dataOptions?.resultId,
                                        sql: dataOptions.sql ?? "",
                                        columns: data.columns ?? [],
                                        data,
                                        updatable: dataOptions.updatable ?? false,
                                        fullTableName: dataOptions.fullTableName ?? "",
                                    });
                                }
                            }

                            break;
                        }

                        case "text": {
                            if (data.rows.length === 0) {
                                this.addEmptyResultSetAsText(data, dataOptions);
                            } else {
                                // Move the text over to the output tab of the new result set data.
                                this.resultData = {
                                    type: "resultSets",
                                    sets: [{
                                        type: "resultSet",
                                        index: dataOptions.index,
                                        resultId: dataOptions?.resultId,
                                        sql: dataOptions.sql ?? "",
                                        columns: data.columns ?? [],
                                        data,
                                        updatable: dataOptions.updatable ?? false,
                                        fullTableName: dataOptions.fullTableName ?? "",
                                    }],
                                    output: this.resultData.text,
                                };
                            }

                            break;
                        }

                        default: {
                            // Replace the existing data entirely.
                            this.resultData = {
                                type: "resultSets",
                                sets: [{
                                    type: "resultSet",
                                    index: dataOptions.index,
                                    resultId: dataOptions?.resultId,
                                    sql: dataOptions.sql ?? "",
                                    columns: data.columns ?? [],
                                    data,
                                    updatable: dataOptions.updatable ?? false,
                                    fullTableName: dataOptions.fullTableName ?? "",
                                }],
                            };

                            break;
                        }
                    }

                    // Everything but result sets is finished implicitly when the result comes in.
                    let allFinished = true;
                    if (this.resultData.type === "resultSets") {
                        // Result sets may still be waiting for more row data.
                        allFinished = this.resultData.sets.every((value) => {
                            return value.data.executionInfo != null;
                        });

                    }

                    if (allFinished && this.loadingState !== LoadingState.Idle) {
                        this.changeLoadingState(LoadingState.Idle);
                    }

                    if (!needUpdate) {
                        return;
                    }
                }

                break;
            }

            case "graphData": {
                // New graph always replaces what was there before.
                this.resultData = data;
                this.minHeight = 200;

                break;
            }

            case "chat": {
                // Chat results display
                this.resultData = data;
                this.minHeight = 200;
                if (data.answer !== "") {
                    // We got the whole answer, so we can stop waiting.
                    this.changeLoadingState(LoadingState.Idle);
                }

                break;
            }

            case "about": {
                // About results display
                this.resultData = data;
                this.minHeight = 220;

                break;
            }

            default:
        }

        // The backend is only set when the presentation is active.
        if (this.#backend) {
            this.renderResults(presentationOptions);
        }
    }

    public markLines(lines: Set<number>, cssClass: string): void {
        this.markedLines = lines;
        this.markerClass = cssClass;

        this.updateMarginDecorations();
    }

    /**
     * Updates the margin decorations that are responsible to show statement starts and other information.
     */
    public updateMarginDecorations(): void {
        const editorModel = this.#backend?.getModel?.();
        if (editorModel) {
            const newDecorations: Monaco.IModelDeltaDecoration[] = [];
            for (let i = this.startLine; i <= this.endLine; ++i) {
                const cssClass = this.getMarginClass(i - this.startLine + 1) + " ." + this.language;
                newDecorations.push({
                    range: {
                        startLineNumber: i,
                        startColumn: 1,
                        endLineNumber: i,
                        endColumn: 1,
                    },
                    options: {
                        stickiness: Monaco.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
                        isWholeLine: false,
                        linesDecorationsClassName: cssClass,
                    },

                });
            }

            this.marginDecorationIDs = editorModel.deltaDecorations?.(this.marginDecorationIDs, newDecorations) ?? [];
        }
    }

    /**
     * Applies the new diagnostics to the code block represented by this presentation interface.
     *
     * @param decorationIDs Previously set decorations. They will be updated with the new diagnostics.
     * @param diagnostics Records of data describing the new diagnostics.
     *
     * @returns A set of decoration IDs that can be used for further updates (or removal).
     */
    public updateDiagnosticsDecorations(decorationIDs: string[], diagnostics: IDiagnosticEntry[]): string[] {
        const editorModel = this.#backend?.getModel?.();

        if (editorModel) {
            const newDecorations = diagnostics.map((entry: IDiagnosticEntry) => {
                // Decorations must be specified in editor coordinates, so we use the editor model here.
                const startPosition = editorModel.getPositionAt(entry.span.start + this.codeOffset);
                const endPosition = editorModel.getPositionAt(entry.span.start + this.codeOffset + entry.span.length);

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
                        hoverMessage: { value: entry.message ?? "" },
                    },
                };
            });


            // Update the decorations in the editor.
            return editorModel.deltaDecorations?.(decorationIDs, newDecorations) ?? [];
        }

        return [];
    }

    /**
     * @returns A flag indicating if this context represents an internal (control) command.
     */
    public get isInternal(): boolean {
        // Go through all lines until a non-empty one is found.
        // Check its text for a command starter.
        let run = this.startLine;
        const model = this.#backend?.getModel?.(); // Need the editor model here.
        if (model) {
            const endLine = Math.min(this.endLine, model.getLineCount());
            while (run <= endLine) {
                const text = model.getLineContent(run).trim();
                if (text.length > 0) {
                    if (text.startsWith("\\")) {
                        // The current line is the last one and starts with a backslash.
                        return true;
                    } else {
                        return false;
                    }
                }
                ++run;
            }
        }

        return false;
    }

    public get isSQLLike(): boolean {
        return this.language === "sql" || this.language === "mysql";
    }

    public selectRange(span: TextSpan): void {
        if (this.context && this.#backend) {
            const range = this.context.fromLocal(span);
            this.#backend.setSelection?.(range);
            this.#backend.revealLines?.(range.startLineNumber, range.endLineNumber);
        }
    }

    /**
     * Entry point to update the presentation of the result view (maximized or normal).
     */
    public toggleResultPane = (): void => {
        if (this.maximizedResult === undefined) {
            this.maximizedResult = true;
        } else {
            this.maximizedResult = !this.maximizedResult;
        }
        this.renderResults();
        this.updateRenderTarget(this.currentHeight);
    };

    protected getMarginClass(line: number): string {
        if (this.markedLines.has(line)) {
            return this.markerClass;
        }

        return "";
    }

    /**
     * Allows descendants to render a separator after a result element (e.g. for resizing).
     *
     * @returns The separator node or undefined, if not used.
     */
    protected get resultDivider(): ComponentChild {
        return undefined;
    }

    /**
     * Allows descendants to modify the tab area presentation.
     *
     * @returns A string determining how to show the tab area.
     */
    protected get hideTabs(): "always" | "single" | "never" {
        return this.maximizedResult ? "always" : "single";
    }

    protected removeRenderTarget(): void {
        if (this.renderTarget) {
            // Explicitly replace the render target content with null, to avoid memory leaks
            // (by unmounting the preact tree used for it).
            render(null, this.renderTarget);
            this.renderTarget = undefined;
        }
        this.currentHeight = undefined;
        this.maximizedResult = undefined;
        this.manuallyResized = false;
    }

    protected updateRenderTarget(_height?: number): void {
        // Overridden by descendants.
    }

    protected defineRenderTarget(): HTMLDivElement | undefined {
        // Overridden by descendants.
        return undefined;
    }

    /** @returns a string determining where to show the maximize button. */
    protected showMaximizeButton(): "never" | "tab" | "statusBar" {
        return this.maximizedResult ? "tab" : "statusBar";
    }

    /** Used to let descendants prepare whatever they need for result rendering, without actually showing the target. */
    protected prepareRenderTarget(): void {
        // Nothing to do here.
    }

    /**
     * Called for result set data, which is empty (no rows, only execution info is set).
     *
     * @param data The empty result set. Add it's execution info as plain text to whatever is visible currently.
     * @param dataOptions Additional information for the result data.
     */
    private addEmptyResultSetAsText(data: IResultSetRows, dataOptions: IResponseDataOptions): void {
        if (!this.resultData || this.resultData.type === "graphData") {
            // No result data yet or (incompatible) graph data. Convert the execution info to text data.
            this.resultData = {
                type: "text",
                text: [{
                    type: data.executionInfo?.type ?? MessageType.Info,
                    index: dataOptions.index,
                    resultId: dataOptions.resultId,
                    content: data.executionInfo?.text ?? "",
                    subIndex: dataOptions.subIndex,
                }],
            };
        } else if (this.resultData.type === "text") {
            if (!this.resultData.text) {
                this.resultData.text = [];
            }

            this.resultData.text.push({
                type: data.executionInfo?.type ?? MessageType.Info,
                index: dataOptions.index,
                resultId: dataOptions.resultId,
                content: data.executionInfo?.text ?? "",
                subIndex: dataOptions.subIndex,
            });
        } else if (this.resultData.type !== "chat" && this.resultData.type !== "about") {
            if (!this.resultData.output) {
                this.resultData.output = [];
            }

            this.resultData.output.push({
                type: data.executionInfo?.type ?? MessageType.Info,
                index: dataOptions.index,
                resultId: dataOptions.resultId,
                content: data.executionInfo?.text ?? "",
                subIndex: dataOptions.subIndex,
            });
        }
    }

    /**
     * Creates or updates the embedded result rendering.
     *
     * @param options Controls the result area presentation after adding the new data.
     */
    private renderResults(options?: IPresentationOptions): void {
        // Adding additional check because switching away from the current DB Connection Tab
        // when rolling back changes at the same time causes re-rendering with emptied result set,
        // so we have to destroy renderTarget in this case
        const hasEmptyResultSet = this.resultData?.type === "resultSets" && !this.resultData.sets.length;

        if (!this.resultData || hasEmptyResultSet || !this.context) {
            this.removeRenderTarget();

            return;
        }

        options = Object.assign({}, {
            currentSet: this.currentSet,
            manualHeight: this.currentHeight,
            maximized: this.maximizedResult,
        }, options);

        this.currentHeight = options.manualHeight;
        if (options.currentSet !== undefined) {
            this.currentSet = options.currentSet;
        }

        // Query execution triggers tab re-creation,
        // requiring currentSet to be reset or adjusted to prevent an out-of-bounds index
        // when the new query(ies) produces fewer tabs than the previous one.
        // This has no impact on cases with output-only results.
        if (this.resultData?.type === "resultSets" && this.currentSet > this.resultData.sets.length) {
            this.currentSet = 1;
        }

        this.maximizedResult = options.maximized;

        let element: ComponentChild | undefined;
        const contextId = this.context.id;
        switch (this.resultData.type) {
            case "text": {
                if (this.alwaysShowTab) {
                    const data: IResultSets = {
                        type: "resultSets",
                        output: this.resultData.text,
                        sets: [],
                    };

                    element = <ResultTabView
                        ref={this.resultRef}
                        resultSets={data}
                        contextId={contextId}
                        currentSet={this.currentSet}
                        showMaximizeButton={this.showMaximizeButton()}
                        hideTabs={this.hideTabs}
                        onResultPageChange={this.handleResultPageChange}
                        onToggleResultPaneViewState={this.toggleResultPane}
                        onSelectTab={this.handleSelectTab}
                        onCommitChanges={this.commitChanges}
                        updateRowsForResultId={this.updateRowsForResultId}
                        onRollbackChanges={this.rollbackChanges}
                        onRemoveResult={this.handleRemoveResult}
                    />;

                    this.minHeight = 36;
                } else {
                    element = <Container
                        className="outputHost"
                        orientation={Orientation.TopDown}
                        fixedScrollbars={false}
                    >
                        <ActionOutput
                            output={this.resultData.text}
                            contextId={contextId}
                            showIndexes={options?.showIndexes}
                        />
                        {this.resultData.executionInfo &&
                            <ResultStatus statusInfo={this.resultData.executionInfo} />}
                    </Container>;
                    this.minHeight = 28;
                }

                break;
            }

            case "resultSets": {
                const hasOutput = this.resultData?.output && this.resultData.output.length > 0;

                // Switch the tab if we're currently on the output tab re-running the query,
                // results are present but output is missing.
                if (!hasOutput && this.resultData.sets.length > 0 && this.currentSet === 0) {
                    this.currentSet = 1;
                }

                element = <ResultTabView
                    ref={this.resultRef}
                    resultSets={this.resultData}
                    contextId={contextId}
                    currentSet={this.currentSet}
                    showMaximizeButton={this.showMaximizeButton()}
                    hideTabs={this.hideTabs}
                    showMaximized={this.maximizedResult}
                    onResultPageChange={this.handleResultPageChange}
                    onToggleResultPaneViewState={this.toggleResultPane}
                    onSelectTab={this.handleSelectTab}
                    onCommitChanges={this.commitChanges}
                    updateRowsForResultId={this.updateRowsForResultId}
                    onRollbackChanges={this.rollbackChanges}
                    onRemoveResult={this.handleRemoveResult}
                />;
                this.minHeight = 36;

                break;
            }

            case "graphData": {
                element = <GraphHost
                    options={this.resultData.options ?? {}}
                />;
                this.minHeight = 200;

                break;
            }

            case "chat": {
                element = <ChatHost
                    info={this.resultData.info}
                    answer={this.resultData.answer}
                    error={this.resultData.error}
                    options={this.resultData.options ?? {}}
                    onAction={this.handleChatAction}
                    onUpdateOptions={this.resultData.updateOptions}
                />;
                this.minHeight = 40;

                break;
            }

            case "about": {
                element = <AboutHost
                    title={this.resultData.title}
                    info={this.resultData.info}
                />;
                this.minHeight = 200;

                break;
            }

            default:
        }

        // Do we have a result view already?
        if (this.renderTarget) {
            if (element) {
                // Update it.
                render(
                    <>
                        {element}
                        {this.resultDivider}
                    </>, this.renderTarget,
                );
            } else {
                // Remove it.
                this.removeRenderTarget();
            }
        } else if (element) {
            // No result yet, so add the one given.
            this.renderTarget = this.defineRenderTarget();
            if (this.renderTarget) {
                render(
                    <>
                        {element}
                        {this.resultDivider}
                    </>, this.renderTarget,
                );
            }
        }
    }

    private handleResultPageChange = (resultId: string, currentPage: number, sql: string): void => {
        if (this.context instanceof SQLExecutionContext) {
            // Currently paging is only supported for SQL execution blocks.
            void requisitions.execute("sqlShowDataAtPage",
                { context: this.context, oldResultId: resultId, page: currentPage, sql });
        }
    };

    private handleSelectTab = (index: number): void => {
        this.renderResults({currentSet: index});
    };

    private changeLoadingState = (newState: LoadingState): void => {
        if (this.loadingState !== newState) {
            this.loadingState = newState;
            this.updateMarginDecorations();

            if (this.context) {
                void requisitions.execute("editorContextStateChanged", this.context.id);
            }
        }
    };

    private commitChanges = async (resultSet: IResultSet, updateSql: string[]): Promise<ISqlUpdateResult> => {
        // No need to re-render the result view, as the caller will run a refresh query anyway (e.g. to update auto
        // incremented fields).
        return this.onCommitChanges?.(resultSet, updateSql) ?? { affectedRows: 0, errors: [] };
    };

    private rollbackChanges = (resultSet: IResultSet): void => {
        void this.onRollbackChanges?.(resultSet).then(() => {
            this.renderResults();
        });
    };

    private handleRemoveResult = (resultId: string): void => {
        void this.clearResult(resultId);
    };

    /**
     * Sent when new column details are available for a specific result set.
     *
     * @param data The new column details.
     *
     * @returns A promise resolving to true if affected one of the result sets here, otherwise false.
     */
    private updateColumnInfo = async (data: IColumnDetails): Promise<boolean> => {
        // Is the update relevant for our result sets?
        if (this.resultData?.type === "resultSets") {
            let index = -1;
            const resultSet = this.resultData.sets.find((candidate, currentIndex) => {
                if (candidate.resultId === data.resultId) {
                    index = currentIndex;

                    return true;
                }

                return false;
            });

            if (resultSet && resultSet.columns.length === data.columns.length) {
                for (const [index, column] of data.columns.entries()) {
                    const target = resultSet.columns[index];
                    target.inPK = column.inPK;
                    target.autoIncrement = column.autoIncrement;
                    target.nullable = column.nullable;
                    target.default = column.default;
                }

                if (this.resultRef.current && this.currentSet === index + 1) {
                    await this.resultRef.current.updateColumns(data.resultId, resultSet.columns);
                } else {
                    this.renderResults();
                }

                return true;
            }
        }

        return Promise.resolve(false);
    };

    private handleChatAction = (action: ChatAction): void => {
        switch (action) {
            case ChatAction.Execute: {
                if (this.context) {
                    void requisitions.execute("editorExecute",
                        { advance: false, forceSecondaryEngine: false, asText: false, context: this.context });
                }

                break;
            }

            case ChatAction.UpdateOptions: {
                if (this.context) {
                    //
                }
                break;
            }

            default:
        }
    };

}
