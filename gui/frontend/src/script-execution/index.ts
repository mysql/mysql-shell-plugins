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

export interface ITextResultEntry {
    type: MessageType;

    // An optional index to map a text result entry to a command that produced it in an editor.
    index?: number;

    // An option value to denote the request from which this output was generated.
    requestId?: string;

    content: string;
    language?: ResultTextLanguage;
}

export interface ITextResult {
    type: "text";

    text?: ITextResultEntry[];
    executionInfo?: IExecutionInfo;

    // When given, allows to set the given text as status to an existing result set.
    requestId?: string;
}

export interface IResultSetContent {
    requestId: string;

    columns: IColumnInfo[];
    rows: IDictionary[];    // Keys represent column IDs.

    // Paging support.
    currentPage: number;
    hasMoreRows?: boolean;

    // Set once the execution is finished. Can be a summary or error message or similar.
    executionInfo?: IExecutionInfo;
}

export interface IResultSetHead {
    requestId: string;

    // Set when this result set replaces an existing one from a previous request (e.g. when paging results).
    oldRequestId?: string;

    // Original query without automatic adjustments (like a LIMIT clause).
    sql: string;
}

export interface IResultSet {
    // An optional index to map a result set to a query that produced it.
    index?: number;

    head: IResultSetHead;
    data: IResultSetContent;
}

export interface IResultSets {
    type: "resultSets";

    output?: ITextResultEntry[]; // Simple text output in addition to the result set content.
    sets: IResultSet[];
}

// An own interface for incremental updates of result sets. Includes a status field for the final addition.
export interface IResultSetRows extends IResultSetContent {
    type: "resultSetRows";

    totalRowCount?: number;
}

export interface IGraphData {
    type: "graphData";

    options?: IGraphOptions;
}

export interface IRequestIds {
    type: "requestIds";

    list: string[];
}

// A set of fields that comprise the result of a script or shell execution.
export type IExecutionResult = ITextResult | IResultSets | IResultSetRows | IGraphData;

// A simplified form of the execution result interface, which only refers to actual data (in our storage DB).
export type IExecuteResultReference = ITextResult | IRequestIds | IGraphData;
