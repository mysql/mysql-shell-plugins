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

import { languages, editor, IPosition } from "monaco-editor/esm/vs/editor/editor.api";
import { IStatementSpan } from "../../../parsing/parser-common";

import { IExecuteResultReference } from "../../../script-execution";
import { EditorLanguage } from "../../../supplement";

export type {
    IMarkdownString, IRange, IPosition, IDisposable, CancellationToken, Thenable,
} from "monaco-editor/esm/vs/editor/editor.api";

export {
    editor as Monaco, languages, KeyMod, KeyCode, Selection, Range, Position, Uri,
} from "monaco-editor/esm/vs/editor/editor.api";

export {
    ContextKeyExpr,
} from "monaco-editor/esm/vs/platform/contextkey/common/contextkey";

export type ProviderResult<T> = languages.ProviderResult<T>;

export type CompletionList = languages.CompletionList;
export type CompletionItem = languages.CompletionItem;
export type CompletionItemLabel = languages.CompletionItemLabel;
export type CompletionContext = languages.CompletionContext;

export type Hover = languages.Hover;

export type SignatureHelpContext = languages.SignatureHelpContext;
export type SignatureHelpResult = languages.SignatureHelpResult;
export type SignatureHelp = languages.SignatureHelp;
export type SignatureInformation = languages.SignatureInformation;
export type ParameterInformation = languages.ParameterInformation;

export type DocumentHighlight = languages.DocumentHighlight;

export type DocumentSymbol = languages.DocumentSymbol;

export type Definition = languages.Definition;
export type LocationLink = languages.LocationLink;

export type ReferenceContext = languages.ReferenceContext;
export type Location = languages.Location;

export type SelectionRange = languages.SelectionRange;

export type FormattingOptions = languages.FormattingOptions;
export type TextEdit = languages.TextEdit;
export type WorkspaceTextEdit = languages.WorkspaceTextEdit;

export type FoldingRange = languages.FoldingRange;
export type FoldingContext = languages.FoldingContext;

export type WorkspaceEdit = languages.WorkspaceEdit;
export type RenameLocation = languages.RenameLocation;
export type Rejection = languages.Rejection;

export type TypeScriptWorker = languages.typescript.TypeScriptWorker;

export type ICodeEditorViewState = editor.ICodeEditorViewState;

export interface ICodeEditorOptions {
    tabSize?: number;
    indentSize?: number;
    insertSpaces?: boolean;

    defaultEOL?: "LF" | "CRLF";
    trimAutoWhitespace?: boolean;
}

export interface IExecutionContextState {
    /** The start line for this context. */
    start: number;

    /** The end line for this context. */
    end: number;

    /** The language used in the context. */
    language: EditorLanguage;

    /** Optionally: an attached result (reference). */
    result?: IExecuteResultReference;

    /** The height of the result pane. Only considered if the pane is not maximized. */
    currentHeight?: number;

    /** The index of the active set, in a multi set result. */
    currentSet?: number;

    /** When true no editor is shown and the result pane takes the entire space. */
    maximizeResultPane?: boolean;

    /** Stored statement ranges. */
    statements: IStatementSpan[];
}

/** A statement consists of its text and its relative position within its block/context. */
export interface IStatement {
    /** The index of the statement in the statement list. */
    index: number;

    text: string;

    /** The character offset of the statement in the containing model. */
    offset: number;

    /** The line number of the statement in the containing model. */
    line: number;

    /** Ditto for the column. */
    column: number;
}

/** Options that control how SQL statements are executed. */
export interface IScriptExecutionOptions {
    /** Any additional named parameters for placeholders in the query. */
    params?: Array<[string, string]>;

    /**
     * Used when executing SQL statements to tell the executor to add a hint to SELECT statements to use the secondary
     * engine (usually HeatWave).
     */
    forceSecondaryEngine?: boolean;

    /**
     * Determines where the SQL code comes from that must be executed. If that's a position it means
     * to run only the code at that (caret) position. If a string is specified then it means to run
     * this (single) query only. If not given at all run the statements touched by the editor selection
     * or all statements, if there's no selection.
     */
    source?: IPosition | string;
}
