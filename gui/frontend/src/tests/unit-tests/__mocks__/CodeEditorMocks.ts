/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { SymbolTable } from "antlr4-c3";
import { vi } from "vitest";

import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco, Position, Uri } from "../../../components/ui/CodeEditor/index.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";

const ec = new ExecutionContexts();
export const mockModel: ICodeEditorModel = {
    executionContexts: ec,
    symbols: new SymbolTable("myTable", {}), editorMode: CodeEditorMode.Standard,
    uri: new Uri(), id: "", getOptions: vi.fn(), getVersionId: vi.fn(), getAlternativeVersionId: vi.fn(),
    setValue: vi.fn(), getValue: vi.fn(), getValueLength: vi.fn(), getValueInRange: vi.fn(),
    getValueLengthInRange: vi.fn(), getCharacterCountInRange: vi.fn(), getLineCount: vi.fn(),
    getLineContent: vi.fn(), getLineLength: vi.fn(), getLinesContent: vi.fn(), getEOL: vi.fn(),
    getEndOfLineSequence: vi.fn(), getLineMinColumn: vi.fn(), getLineMaxColumn: vi.fn(),
    getLineFirstNonWhitespaceColumn: vi.fn(), getLineLastNonWhitespaceColumn: vi.fn(),
    validatePosition: vi.fn(), modifyPosition: vi.fn(), validateRange: vi.fn(), getOffsetAt: vi.fn(),
    getPositionAt: vi.fn(), getFullModelRange: vi.fn(), isDisposed: vi.fn(), findMatches: vi.fn(),
    findNextMatch: vi.fn(), findPreviousMatch: vi.fn(), getLanguageId: vi.fn(),
    getWordAtPosition: vi.fn(), getWordUntilPosition: vi.fn(), deltaDecorations: vi.fn(),
    getDecorationOptions: vi.fn(), getDecorationRange: vi.fn(), getLineDecorations: vi.fn(),
    getLinesDecorations: vi.fn(), getDecorationsInRange: vi.fn(), getAllDecorations: vi.fn(),
    getOverviewRulerDecorations: vi.fn(), getInjectedTextDecorations: vi.fn(),
    normalizeIndentation: vi.fn(), updateOptions: vi.fn(), detectIndentation: vi.fn(),
    pushStackElement: vi.fn(), popStackElement: vi.fn(), pushEditOperations: vi.fn(),
    pushEOL: vi.fn(), applyEdits: vi.fn(), setEOL: vi.fn(), onDidChangeContent: vi.fn(),
    onDidChangeDecorations: vi.fn(), onDidChangeOptions: vi.fn(), onDidChangeLanguage: vi.fn(),
    onDidChangeLanguageConfiguration: vi.fn(), onDidChangeAttached: vi.fn(), onWillDispose: vi.fn(),
    dispose: vi.fn(), isAttachedToEditor: vi.fn(), getAllMarginDecorations: vi.fn(),
    createSnapshot: vi.fn(),
};
export const position: Position = {
    lineNumber: 1, column: 0, with: vi.fn(), delta: vi.fn(), equals: vi.fn(),
    isBefore: vi.fn(), isBeforeOrEqual: vi.fn(), clone: vi.fn(), toJSON: vi.fn(),
};

export const mockTextModel: Monaco.ITextModel = {
    uri: new Uri(), id: "1", getOptions: vi.fn(), getVersionId: vi.fn(), getAlternativeVersionId: vi.fn(),
    setValue: vi.fn(), getValue: vi.fn(), getValueLength: vi.fn(), getValueInRange: vi.fn(),
    getValueLengthInRange: vi.fn(), getCharacterCountInRange: vi.fn(), getLineCount: vi.fn(),
    getLineContent: vi.fn(), getLineLength: vi.fn(), getLinesContent: vi.fn(), getEOL: vi.fn(),
    getEndOfLineSequence: vi.fn(), getLineMinColumn: vi.fn(), getLineMaxColumn: vi.fn(),
    getLineFirstNonWhitespaceColumn: vi.fn(), getLineLastNonWhitespaceColumn: vi.fn(),
    validatePosition: vi.fn(), modifyPosition: vi.fn(), validateRange: vi.fn(), getOffsetAt: vi.fn(),
    getPositionAt: vi.fn(), getFullModelRange: vi.fn(), isDisposed: vi.fn(), findMatches: vi.fn(),
    findNextMatch: vi.fn(), findPreviousMatch: vi.fn(), getLanguageId: vi.fn(), getWordAtPosition: vi.fn(),
    getWordUntilPosition: vi.fn(), deltaDecorations: vi.fn(), getDecorationOptions: vi.fn(),
    getDecorationRange: vi.fn(), getLineDecorations: vi.fn(), getLinesDecorations: vi.fn(),
    getDecorationsInRange: vi.fn(), getAllDecorations: vi.fn(), getOverviewRulerDecorations: vi.fn(),
    getInjectedTextDecorations: vi.fn(), normalizeIndentation: vi.fn(), updateOptions: vi.fn(),
    detectIndentation: vi.fn(), pushStackElement: vi.fn(), popStackElement: vi.fn(),
    pushEditOperations: vi.fn(), pushEOL: vi.fn(), applyEdits: vi.fn(), setEOL: vi.fn(),
    onDidChangeContent: vi.fn(), onDidChangeDecorations: vi.fn(), onDidChangeOptions: vi.fn(),
    onDidChangeLanguage: vi.fn(), onDidChangeLanguageConfiguration: vi.fn(), onDidChangeAttached: vi.fn(),
    onWillDispose: vi.fn(), dispose: vi.fn(), isAttachedToEditor: vi.fn(), getAllMarginDecorations: vi.fn(),
    createSnapshot: vi.fn(),
};
