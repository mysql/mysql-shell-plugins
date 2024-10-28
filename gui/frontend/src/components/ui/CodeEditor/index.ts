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

import { languages, editor, IPosition } from "monaco-editor/esm/vs/editor/editor.api.js";
import { IStatementSpan } from "../../../parsing/parser-common.js";

import { IContextProvider, IExecuteResultReference } from "../../../script-execution/index.js";
import { EditorLanguage } from "../../../supplement/index.js";

export type {
    IMarkdownString, IRange, IPosition, IDisposable, CancellationToken, Thenable,
} from "monaco-editor/esm/vs/editor/editor.api.js";

export {
    editor as Monaco, languages, KeyMod, KeyCode, Selection, Range, Position, Uri,
} from "monaco-editor/esm/vs/editor/editor.api.js";

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
export type IWorkspaceTextEdit = languages.IWorkspaceTextEdit;

export type FoldingRange = languages.FoldingRange;
export type FoldingContext = languages.FoldingContext;

export type WorkspaceEdit = languages.WorkspaceEdit;
export type RenameLocation = languages.RenameLocation;
export type Rejection = languages.Rejection;

export type TypeScriptWorker = languages.typescript.TypeScriptWorker;

export type TokensProvider = languages.TokensProvider;
export type DocumentSemanticTokensProvider = languages.DocumentSemanticTokensProvider;
export type SemanticTokens = languages.SemanticTokens;
export type SemanticTokensLegend = languages.SemanticTokensLegend;

export type ICodeEditorViewState = editor.ICodeEditorViewState;

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
     * to run only the code at that (caret) position. If not given at all run the statements touched by the editor
     * selection or all statements, if there's no selection.
     */
    source?: IPosition;

    /** When true render the query and the result as plain text. */
    asText?: boolean;
}

/** Determines the behavior of the code editor. */
export enum CodeEditorMode {
    Standard,

    /** Different set of code completion values. Allows for language switch commands. */
    Terminal
}

/** A stripped down model interface for the various code editor providers. */
export interface IProviderEditorModel extends editor.ITextModel {
    executionContexts?: IContextProvider;

    /** Functionality differs depending on where the code editor is used. */
    editorMode: CodeEditorMode;
}

/** The structure of a monaco-editor language definition. */
export interface ILanguageDefinition {
    language: languages.IMonarchLanguage;
    languageConfiguration: languages.LanguageConfiguration;
}

/** Base scope names used for syntax highlighting. These are combined with the modifiers below. */
export const tokenTypes = [
    "keyword",
    "identifier",
    "operator",
    "delimiter",
    "markup",
    "number",
    "string",
    "comment",
    "regexp",
    "support",
    "entity",
    "type",
    "operator",
    "namespace",
    "struct",
    "class",
    "interface",
    "enum",
    "typeParameter",
    "function",
    "member",
    "macro",
    "variable",
    "parameter",
    "property",
    "label",
    "command",
];

/**
 * Identifiers attached to a base scope to form a full scope. Any number of modifiers can be used, separated by a dot.
 *
 * Important note: each entry is represented by a bit in the final unsigned integer. This means that the maximum number
 * of entries is 32.
 */
export const tokenModifiers = [
    "other",
    "bracket",
    "square",
    "parenthesis",
    "float",
    "hex",
    "octal",
    "binary",
    "regexp",
    "escape",
    "invalid",
    "control",
    "line",
    "block",
    "doc",
    "quoted",
    "single",
    "double",
    "function",
    "variable",
    "user",
    "system",
    "entity",
    "name",
    "identifier",
    "language",
    "predefined",
    "angle",
];
