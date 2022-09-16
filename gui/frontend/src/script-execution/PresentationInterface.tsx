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

import React from "react";
import { render } from "preact";
import { isNil } from "lodash";

import { ResultStatus } from "../components/ResultView";
import { ResultTabView } from "../components/ResultView/ResultTabView";
import { CodeEditor } from "../components/ui/CodeEditor/CodeEditor";
import { IExecutionResult, IResultSet, IResultSetRows, ITextResult, SQLExecutionContext } from ".";
import { DiagnosticSeverity, IDiagnosticEntry } from "../parsing/parser-common";
import { Monaco } from "../components/ui/CodeEditor";
import { ExecutionContext } from "./ExecutionContext";
import { requisitions } from "../supplement/Requisitions";
import { Container, ContentAlignment, Label, Orientation } from "../components/ui";
import { EditorLanguage } from "../supplement";

import { MessageType } from "../app-logic/Types";
import { GraphHost } from "../components/graphs/GraphHost";

// A flag telling if the result is currently being loaded.
export enum LoadingState {
    Idle = "idle",       // Nothing in the pipeline.
    Waiting = "waiting", // Waiting for the first result to arrive.
    Loading = "loading", // At least one result arrived. Waiting for the final result.
}

// Base class for handling of UI related elements like editor decorations and result display.
export class PresentationInterface {

    // A mapping from diagnostic categories to CSS class names.
    public static validationClass: Map<DiagnosticSeverity, string> = new Map([
        [DiagnosticSeverity.Error, "error"],
        [DiagnosticSeverity.Warning, "warning"],
        [DiagnosticSeverity.Message, "message"],
        [DiagnosticSeverity.Suggestion, "suggestion"],
    ]);

    // The maximum height for the result area.
    protected static maxHeight = 600;
    protected static maxAutoHeight = {
        text: 292,
        resultSets: 292,
        graphData: 300,
    };

    // The size of the result area after adding data or manual resize by the user.
    public currentHeight?: number;

    public currentSet?: number;

    // A flag which indicates if the result pane shall be maximized.
    public maximizedResult?: boolean;

    public resultData?: IExecutionResult;
    public loadingState = LoadingState.Idle;

    public readonly backend: Monaco.IStandaloneCodeEditor;
    public context?: ExecutionContext;

    // A function to send a notification if the current result is being replaced by nothing.
    // Useful for higher level consumers to update their storage (e.g. cached results).
    // Note: this is not used when disposing of the presentation (where we want to keep the data for later restore).
    public onRemoveResult?: (requestIds: string[]) => void;

    // The target HTML element to which we render the React nodes dynamically.
    protected renderTarget?: HTMLDivElement;

    // Set, when user manually resized the height of the result view.
    protected manuallyResized = false;

    // The minimum for the result area. Depends on the content.
    protected minHeight = 180;

    // Each line gets a margin decoration with varying content, depending where the context is used
    // and other conditions.
    private marginDecorationIDs: string[] = [];
    private markedLines: Set<number> = new Set();
    private markerClass = "";

    private waitTimer: ReturnType<typeof setTimeout> | null;

    // Only set for result set data.
    private resultRef = React.createRef<ResultTabView>();

    public constructor(protected editor: CodeEditor, public language: EditorLanguage) {
        this.backend = editor.backend!;
    }

    public dispose(): void {
        this.onRemoveResult = undefined;
        this.backend.deltaDecorations(this.marginDecorationIDs, []);
        this.setResult();
    }

    public get model(): Monaco.ITextModel | null {
        return this.backend.getModel();
    }

    public get code(): string {
        return this.backend.getValue();
    }

    public get codeLength(): number {
        const model = this.model; // Full or block model.

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
     * @returns A list of request ids from which the current result data was produced.
     */
    public get requestIds(): string[] {
        switch (this.resultData?.type) {
            case "resultSetRows": {
                return [this.resultData.requestId];
            }

            case "resultSets": {
                const set1 = this.resultData.sets.map((set) => { return set.head.requestId; });
                const set2 = this.resultData.output?.map((entry) => { return entry.requestId ?? ""; });

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
     * Replaces the current result with one created from the given data. If there's no result yet, a new one is added.
     *
     * @param data The data that must be visualized in the result (if not given then remove any existing result).
     * @param manualHeight Set to restore the size of the result area, when a user had resized it before.
     * @param currentSet The index of the currently visible set (tab page), for multi set results.
     * @param maximized Indicates that the result page is to be maximized.
     */
    public setResult(data?: IExecutionResult, manualHeight?: number, currentSet?: number, maximized?: boolean): void {
        let element: React.ReactNode | undefined;

        if (this.waitTimer) {
            clearTimeout(this.waitTimer);
        }

        // Send out a notification that the current data is about to be replaced.
        this.onRemoveResult?.(this.requestIds);

        let pendingPurge;
        if (data) {
            switch (data.type) {
                case "text": {
                    [data, element] = this.prepareTextEntries(undefined, data);
                    this.minHeight = 28;

                    break;
                }

                case "resultSets": {
                    if (!data.output) {
                        data.output = [];
                    }

                    pendingPurge = data.sets.length > 0 ? data.sets[0].head.requestId : undefined;
                    element = <ResultTabView
                        ref={this.resultRef}
                        resultSets={data}
                        currentSet={currentSet}
                        resultPaneMaximized={this.maximizedResult}
                        onResultPageChange={this.handleResultPageChange}
                        onSetResultPaneViewState={this.handleResultPaneChange}
                        onSelectTab={this.handleSelectTab}
                    />;
                    this.minHeight = 36;

                    const allFinished = data.sets.every((value) => {
                        return !isNil(value.data.executionInfo);
                    });

                    // Start the wait timer. If not cancelled it will cause the wait animation to show.
                    // However, it's not needed to show the wait animation if we got a full result here already.
                    if (!allFinished) {
                        this.waitTimer = setTimeout(() => {
                            this.waitTimer = null;
                            this.loadingState = LoadingState.Waiting;
                            this.updateMarginDecorations();
                        }, 500);
                    }

                    break;
                }

                case "graphData": {
                    element = <GraphHost
                        options={data.options ?? {}}
                    />;
                    this.minHeight = 200;

                    break;
                }

                default: {
                    break;
                }
            }
        }

        if (manualHeight) {
            this.currentHeight = manualHeight;
        }

        this.currentSet = currentSet;
        this.maximizedResult = maximized;

        // Do we have a result already?
        if (this.renderTarget) {
            // Clear existing data. We need this extra step, as we enter new data via direct calls, not properties.
            if (pendingPurge) {
                this.resultRef.current?.markPendingReplace(pendingPurge);
            }

            if (element) {
                // Update it.
                render(
                    <>
                        {element}
                        {this.resultDivider}
                    </>, this.renderTarget,
                );
                this.updateRenderTarget();
            } else {
                // Remove it.
                this.removeRenderTarget();
            }
        } else {
            // No result yet, so add the one given.
            if (data && element) {
                this.renderTarget = this.defineRenderTarget();
                if (this.renderTarget) {
                    render(
                        <>
                            {element}
                            {this.resultDivider}
                        </>, this.renderTarget,
                    );

                    // Note: the render target is updated in `defineRenderTarget`.
                }
            }
        }

        this.resultData = data;
    }

    /**
     * Adds a new page (in a tabview) for multi-page data like result sets. If no initial page exist, a new tabview
     * is created and an initial page is added.
     *
     * @param data The data to place on that new page.
     */
    public addResultPage(data: IExecutionResult): void {
        if (!this.renderTarget) {
            this.setResult(data);

            return;
        }

        let element: React.ReactElement;

        if (!this.manuallyResized) {
            // Reset the current height to make the target compute the height again.
            this.currentHeight = undefined;
        }

        switch (data.type) {
            // For now only result sets support multiple pages (e.g. for multiple queries).
            case "resultSets": {
                let existingSets: IResultSet[];
                if (!this.resultData || this.resultData.type !== "resultSets") {
                    existingSets = [];
                    this.resultData = {
                        type: "resultSets",
                        sets: [],
                    };
                } else {
                    existingSets = this.resultData.sets;
                }

                let needUpdate = false;
                data.sets.forEach((set) => {
                    let addNew = true;
                    if (set.head.oldRequestId) {
                        // When an old request id is specified that means we are actually replacing a page, not adding
                        // a new one.
                        const existing = existingSets.find((candidate) => {
                            return candidate.head.requestId === set.head.oldRequestId;
                        });

                        if (existing) {
                            addNew = false;
                            existing.head.requestId = set.head.requestId;
                            existing.head.sql = set.head.sql;
                            existing.data.requestId = set.data.requestId;
                            existing.data.rows = set.data.rows;
                            existing.data.columns = set.data.columns;
                            existing.data.executionInfo = set.data.executionInfo;

                            if (this.resultRef.current) {
                                this.resultRef.current.reassignData(set.head.oldRequestId, set.head.requestId);
                            }
                        }
                    }

                    if (addNew) {
                        needUpdate = true;
                        existingSets.push(...data.sets);
                    }
                });

                if (!needUpdate) {
                    return;
                }

                element = <ResultTabView
                    ref={this.resultRef}
                    resultSets={this.resultData}
                    resultPaneMaximized={this.maximizedResult}
                    onResultPageChange={this.handleResultPageChange}
                    onSetResultPaneViewState={this.handleResultPaneChange}
                    onSelectTab={this.handleSelectTab}
                />;

                break;
            }

            default: {
                return;
            }
        }


        if (element) {
            render(
                <>
                    {element}
                    {this.resultDivider}
                </>, this.renderTarget,
            );
        }
    }

    /**
     * Incrementally adds new data to the last result page we got.
     * If nothing was set yet, sets the given data as initial result.
     *
     * @param data The data to add.
     *
     * @returns A promise resolving to a boolean indicating if data was added (true) or just set (false).
     */
    public async addResultData(data: IExecutionResult): Promise<boolean> {
        if (!this.renderTarget || !this.resultData) {
            this.setResult(data);

            return false;
        }

        let element: React.ReactNode;

        if (!this.manuallyResized) {
            // Reset the current height to make the target compute the height again.
            this.currentHeight = undefined;
        }

        switch (data.type) {
            case "text": {
                // Stop any wait animation if this is the last result.
                if (data.executionInfo) {
                    if (this.waitTimer) {
                        clearTimeout(this.waitTimer);
                        this.waitTimer = null;
                    }

                    if (this.loadingState !== LoadingState.Idle) {
                        this.loadingState = LoadingState.Idle;
                        this.updateMarginDecorations();
                    }
                }

                if (this.resultData.type === "resultSets") {
                    // If we have results currently then add the text to the output list and remove the affected tab.
                    if (data.text) {
                        this.resultData.output?.push(...data.text);
                    } else {
                        this.resultData.output?.push({
                            type: data.executionInfo?.type ?? MessageType.Error,
                            requestId: data.requestId,
                            content: data.executionInfo?.text ?? "<no info>",
                            language: "ansi",
                        });
                    }

                    const index = this.resultData.sets.findIndex((candidate) => {
                        return candidate.head.requestId === data.requestId;
                    });
                    if (index > -1) {
                        this.resultData.sets.splice(index, 1);
                    }

                    element = <ResultTabView
                        ref={this.resultRef}
                        resultSets={this.resultData}
                        resultPaneMaximized={this.maximizedResult}
                        onResultPageChange={this.handleResultPageChange}
                        onSetResultPaneViewState={this.handleResultPaneChange}
                        onSelectTab={this.handleSelectTab}
                    />;

                    break;
                } else if (this.resultData.type !== "text") {
                    [this.resultData, element] = this.prepareTextEntries(undefined, data);
                } else {
                    [this.resultData, element] = this.prepareTextEntries(this.resultData, data);
                }

                break;
            }

            case "resultSetRows": {
                const result = await this.handleNewRows(data);
                if (typeof result === "boolean") {
                    return result;
                }
                element = result;

                break;
            }

            case "graphData": {
                if (this.resultData.type !== "graphData") {
                    return false;
                }

                element = <GraphHost
                    options={data.options ?? {}}
                />;

                break;
            }

            default: {
                return false;
            }
        }

        if (this.renderTarget) {
            if (element) {
                render(
                    <>
                        {element}
                        {this.resultDivider}
                    </>, this.renderTarget,
                );
                this.updateRenderTarget();
            }
        }

        return true;
    }

    /**
     * Called when a visual update of the result should happen (e.g. to resize for changed data).
     */
    public updateResultDisplay = (): void => {
        this.updateRenderTarget();
    };

    public markLines(lines: Set<number>, cssClass: string): void {
        this.markedLines = lines;
        this.markerClass = cssClass;

        this.updateMarginDecorations();
    }

    /**
     * Updates the margin decorations that are responsible to show statement starts and other information.
     */
    public updateMarginDecorations(): void {
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

        this.marginDecorationIDs = this.backend.deltaDecorations(this.marginDecorationIDs, newDecorations);
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
        const model = this.backend.getModel();

        if (model) {
            const newDecorations = diagnostics.map((entry: IDiagnosticEntry) => {
                // Decorations must be specified in editor coordinates, so we use the editor model here.
                const startPosition = model.getPositionAt(entry.span.start + this.codeOffset);
                const endPosition = model.getPositionAt(entry.span.start + this.codeOffset + entry.span.length);

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
            return this.backend.deltaDecorations(decorationIDs, newDecorations);
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
        const model = this.backend.getModel();
        if (model) {
            while (run <= this.endLine) {
                const text = model.getLineContent(run).trim();
                if (text.length > 0) {
                    if (text.startsWith("\\")) {
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
    protected get resultDivider(): React.ReactNode {
        return undefined;
    }

    protected removeRenderTarget(): void {
        this.renderTarget = undefined;
        this.currentHeight = undefined;
        this.maximizedResult = undefined;
        this.manuallyResized = false;
    }

    protected updateRenderTarget(): void {
        // Overridden by descendants.
    }

    protected defineRenderTarget(): HTMLDivElement | undefined {
        // Overridden by descendants.
        return undefined;
    }

    /**
     * Takes the given data and merges that with existing data, by combining text entries with the same type and
     * language together.
     *
     * @param existing The existing data to use.
     * @param data The new data to merge.
     *
     * @returns A new text result record with combined data and the resulting React element structure.
     */
    private prepareTextEntries(existing: ITextResult | undefined, data: ITextResult): [ITextResult, React.ReactNode] {
        const result = existing ?? { ...data };

        const entries = existing?.text ?? [];
        data.text?.forEach((entry) => {
            if (entries.length === 0) {
                entries.push(entry);
            } else {
                // If the last entry in the text list has the same type and language like this entry
                // combine both. Otherwise add this entry as a new one to the list.
                const last = entries[entries.length - 1];
                if (last.type === entry.type && last.language === entry.language) {
                    last.content += entry.content;
                } else {
                    entries.push(entry);
                }
            }
        });

        result.text = entries;
        if (data.executionInfo) {
            result.executionInfo = data.executionInfo;
        }

        const texts: React.ReactElement[] = [];
        entries.forEach((entry, index) => {
            texts.push(
                <Label
                    language={entry.language}
                    key={`text${index}`}
                    caption={entry.content}
                    type={entry.type}
                />,
            );
        });

        const element = <>
            <Container
                innerRef={React.createRef<HTMLElement>()}
                className="textHost"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                scrollPosition={1e10}
            >
                {texts}
            </Container>
            {
                data.executionInfo && <ResultStatus executionInfo={data.executionInfo} />
            }
        </>;

        return [result, element];
    }

    private handleResultPageChange = (requestId: string, currentPage: number, sql: string): void => {
        if (this.context instanceof SQLExecutionContext) {
            // Currently paging is only supported for SQL execution blocks.
            void requisitions.execute("sqlShowDataAtPage",
                { context: this.context, oldRequestId: requestId, page: currentPage, sql });
        }
    };

    private handleResultPaneChange = (maximized: boolean): void => {
        this.maximizedResult = maximized;

        this.updateRenderTarget();
    };

    private handleSelectTab = (index: number): void => {
        this.currentSet = index;
    };

    private handleNewRows = async (data: IResultSetRows): Promise<boolean | React.ReactNode> => {
        if (!this.resultData) {
            return false;
        }

        if (this.waitTimer || this.loadingState === LoadingState.Waiting) {
            // This is the first result, which arrives here. Switch to the loading state.
            if (this.waitTimer) {
                clearTimeout(this.waitTimer);
                this.waitTimer = null;
            }
            this.loadingState = LoadingState.Loading;
            this.updateMarginDecorations();
        }

        if (this.resultData.type !== "resultSets") {
            return false;
        }

        const resultSets = this.resultData.sets;
        if (resultSets.length === 0 && data.executionInfo) {
            this.resultData.output?.push({
                type: MessageType.Info,
                requestId: data.requestId,
                content: data.executionInfo.text,
                language: "ansi",
            });

            return <ResultTabView
                ref={this.resultRef}
                resultSets={this.resultData}
                resultPaneMaximized={this.maximizedResult}
                onResultPageChange={this.handleResultPageChange}
                onSetResultPaneViewState={this.handleResultPaneChange}
                onSelectTab={this.handleSelectTab}
            />;

        }

        // Add the data to our internal storage, to support switching tabs for multiple result sets.
        const index = resultSets.findIndex((candidate) => {
            return candidate.head.requestId === data.requestId;
        });

        const resultSet = index > - 1 ? resultSets[index] : undefined;

        if (resultSet) {
            const columnCount = data.columns.length;
            const rowCount = data.rows.length;

            if (data.executionInfo) {
                resultSet.data.executionInfo = data.executionInfo;
                resultSet.data.hasMoreRows = data.hasMoreRows;
                resultSet.data.currentPage = data.currentPage;

                // This is the last result call, if a status is given.
                // So stop also any wait/load animation.
                this.loadingState = LoadingState.Idle;
                this.updateMarginDecorations();

                // Special treatment: if there's no data in the result after the final response, convert it to
                // simple output.
                if (resultSet.data.columns.length + columnCount === 0 || resultSet.data.rows.length + rowCount === 0) {
                    this.resultData.sets.splice(index, 1);
                    this.resultData.output?.push({
                        type: data.executionInfo.type ?? MessageType.Info,
                        index: resultSet.index,
                        requestId: resultSet.head.requestId,
                        content: data.executionInfo.text,
                        language: "ansi",
                    });

                    return <ResultTabView
                        ref={this.resultRef}
                        resultSets={this.resultData}
                        resultPaneMaximized={this.maximizedResult}
                        onResultPageChange={this.handleResultPageChange}
                        onSetResultPaneViewState={this.handleResultPaneChange}
                        onSelectTab={this.handleSelectTab}
                    />;
                }
            }

            if (columnCount > 0) {
                if (data.columns) {
                    resultSet.data.columns.push(...data.columns);
                }
                await this.resultRef.current?.updateColumns(data.requestId, resultSet.data.columns);
            }

            if (rowCount > 0) {
                resultSet.data.rows.push(...data.rows);

                if (this.resultRef.current) {
                    await this.resultRef.current.addData(data);
                }
            } else if (data.executionInfo) {
                // Also sent a data call if the execution info came in, even if no additional data exist.
                if (this.resultRef.current) {
                    await this.resultRef.current.addData(data);
                }
            }

        }

        return true;
    };
}

