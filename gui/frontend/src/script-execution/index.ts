/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { languages } from "monaco-editor";
import { IColumnInfo, IDictionary, IExecutionInfo, MessageType } from "../app-logic/Types";
import { ResultTextLanguage } from "../components/ResultView";

import { LanguageCompletionKind } from "../parsing/parser-common";

export * from "./ExecutionContext";
export * from "./SQLExecutionContext";
export * from "./PresentationInterface";

export const mapCompletionKind: Map<LanguageCompletionKind, languages.CompletionItemKind> = new Map([
    [LanguageCompletionKind.Keyword, languages.CompletionItemKind.Keyword],
    [LanguageCompletionKind.Schema, languages.CompletionItemKind.Struct],
    [LanguageCompletionKind.Table, languages.CompletionItemKind.Constant],
    [LanguageCompletionKind.View, languages.CompletionItemKind.Constant],
    [LanguageCompletionKind.Index, languages.CompletionItemKind.Field],
    [LanguageCompletionKind.Column, languages.CompletionItemKind.Field],
    [LanguageCompletionKind.Label, languages.CompletionItemKind.Text],
    [LanguageCompletionKind.SystemFunction, languages.CompletionItemKind.Function],
    [LanguageCompletionKind.Function, languages.CompletionItemKind.Function],
    [LanguageCompletionKind.Procedure, languages.CompletionItemKind.Function],
    [LanguageCompletionKind.Udf, languages.CompletionItemKind.Function],
    [LanguageCompletionKind.Engine, languages.CompletionItemKind.File],
    [LanguageCompletionKind.Tablespace, languages.CompletionItemKind.File],
    [LanguageCompletionKind.UserVariable, languages.CompletionItemKind.Variable],
    [LanguageCompletionKind.SystemVariable, languages.CompletionItemKind.Variable],
    [LanguageCompletionKind.Charset, languages.CompletionItemKind.Enum],
    [LanguageCompletionKind.Collation, languages.CompletionItemKind.Enum],
    [LanguageCompletionKind.Event, languages.CompletionItemKind.Event],
    [LanguageCompletionKind.User, languages.CompletionItemKind.User],
    [LanguageCompletionKind.Trigger, languages.CompletionItemKind.Interface],
    [LanguageCompletionKind.LogfileGroup, languages.CompletionItemKind.File],
    [LanguageCompletionKind.Plugin, languages.CompletionItemKind.Module],
]);

/**
 * An interface comprising text output, a type and a language to form output shown for actions like code execution,
 * query results and informational messages.
 */
export interface ITextResultEntry {
    type: MessageType;
    language?: ResultTextLanguage;

    /**
     * An optional index to map a text result entry to a command that produced it in an editor.
     * If given this index will be shown in front of the text label and also makes the label clickable, to allow
     * the UI to navigate to the origin of the text (e.q. a query which caused an error output).
     */
    index?: number;

    /** An option value to denote the request from which this output was generated. */
    resultId?: string;

    content: string;
}

export interface ITextResult {
    type: "text";

    text?: ITextResultEntry[];
    executionInfo?: IExecutionInfo;
}

export interface IResultSetContent {
    /** Keys represent column IDs. */
    rows: IDictionary[];

    /** Paging support. */
    currentPage: number;
    hasMoreRows?: boolean;

    /** Set once the execution is finished. Can be a summary or error message or similar. */
    executionInfo?: IExecutionInfo;
}

export interface IResultSet {
    type: "resultSet";

    /** An optional index to map a result set to a query that produced it. */
    index?: number;

    /** The qualifier of the request that generated this result set. */
    resultId: string;

    /** Original query without automatic adjustments (like a LIMIT clause). */
    sql: string;

    columns: IColumnInfo[];

    data: IResultSetContent;
}

export interface IResultSets {
    type: "resultSets";

    /** Simple text output in addition to the result set content. */
    output?: ITextResultEntry[];
    sets: IResultSet[];
}

/** An own interface for incremental updates of result sets. Includes a status field for the final addition. */
export interface IResultSetRows extends IResultSetContent {
    type: "resultSetRows";

    totalRowCount?: number;
    columns?: IColumnInfo[];
}

export interface IGraphResult {
    type: "graphData";

    options?: IGraphOptions;
}

export interface IResultIdentifiers {
    type: "resultIds";

    list: string[];
}

/** A set of fields that comprise the result of a script or shell execution. */
export type IExecutionResult = ITextResult | IResultSetRows | IGraphResult;

/** A simplified form of the execution result interface, which only refers to actual data (in our storage DB). */
export type IExecuteResultReference = ITextResult | IResultIdentifiers | IGraphResult;

/** A flag telling if the result is currently being loaded. */
export enum LoadingState {
    /** Nothing in the pipeline. */
    Idle = "idle",

    /**
     * No visual representation, but used to indicate that results are announced, but the wait time has not elapsed yet.
     */
    Pending = "pending",

    /** Waiting for the first result to arrive. */
    Waiting = "waiting",

    /** At least one result arrived. Waiting for the final result. */
    Loading = "loading",
}

/** Optional values which control how result data is presented. */
export interface IPresentationOptions {
    /** Specifies an explicit height of the result area. */
    manualHeight?: number;

    /** The index of the currently active result tab. */
    currentSet?: number;

    /** Indicates whether the result area should be shown maximized. */
    maximized?: boolean;

    /** Indicates whether the action output should use index numbers. */
    showIndexes?: boolean;
}

/**
 * Additional informations for a result that's going to be added to this presentation.
 */
export interface IResponseDataOptions {
    /** The ID of the result data. */
    resultId: string;

    /** If true, replace existing data with the new one, otherwise append. */
    replaceData?: boolean;

    /** The original query that was sent for this result data. */
    sql?: string;

    /** The index of the query that produced the result data. */
    index?: number;
}
