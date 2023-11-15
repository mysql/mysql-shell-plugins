/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { SymbolTable } from "antlr4-c3";

import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { StoreType } from "../../../app-logic/ApplicationDB.js";
import { CodeEditorMode, Monaco, Position, Uri } from "../../../components/ui/CodeEditor/index.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";

const ec = new ExecutionContexts(StoreType.DbEditor, 1, "", "");
export const mockModel: ICodeEditorModel = {
    executionContexts: ec,
    symbols: new SymbolTable("myTable", {}), editorMode: CodeEditorMode.Standard,
    uri: new Uri(), id: "", getOptions: jest.fn(), getVersionId: jest.fn(), getAlternativeVersionId: jest.fn(),
    setValue: jest.fn(), getValue: jest.fn(), getValueLength: jest.fn(), getValueInRange: jest.fn(),
    getValueLengthInRange: jest.fn(), getCharacterCountInRange: jest.fn(), getLineCount: jest.fn(),
    getLineContent: jest.fn(), getLineLength: jest.fn(), getLinesContent: jest.fn(), getEOL: jest.fn(),
    getEndOfLineSequence: jest.fn(), getLineMinColumn: jest.fn(), getLineMaxColumn: jest.fn(),
    getLineFirstNonWhitespaceColumn: jest.fn(), getLineLastNonWhitespaceColumn: jest.fn(),
    validatePosition: jest.fn(), modifyPosition: jest.fn(), validateRange: jest.fn(), getOffsetAt: jest.fn(),
    getPositionAt: jest.fn(), getFullModelRange: jest.fn(), isDisposed: jest.fn(), findMatches: jest.fn(),
    findNextMatch: jest.fn(), findPreviousMatch: jest.fn(), getLanguageId: jest.fn(),
    getWordAtPosition: jest.fn(), getWordUntilPosition: jest.fn(), deltaDecorations: jest.fn(),
    getDecorationOptions: jest.fn(), getDecorationRange: jest.fn(), getLineDecorations: jest.fn(),
    getLinesDecorations: jest.fn(), getDecorationsInRange: jest.fn(), getAllDecorations: jest.fn(),
    getOverviewRulerDecorations: jest.fn(), getInjectedTextDecorations: jest.fn(),
    normalizeIndentation: jest.fn(), updateOptions: jest.fn(), detectIndentation: jest.fn(),
    pushStackElement: jest.fn(), popStackElement: jest.fn(), pushEditOperations: jest.fn(),
    pushEOL: jest.fn(), applyEdits: jest.fn(), setEOL: jest.fn(), onDidChangeContent: jest.fn(),
    onDidChangeDecorations: jest.fn(), onDidChangeOptions: jest.fn(), onDidChangeLanguage: jest.fn(),
    onDidChangeLanguageConfiguration: jest.fn(), onDidChangeAttached: jest.fn(), onWillDispose: jest.fn(),
    dispose: jest.fn(), isAttachedToEditor: jest.fn(), getAllMarginDecorations: jest.fn(),
    createSnapshot: jest.fn(),
};
export const position: Position = {
    lineNumber: 0, column: 0, with: jest.fn(), delta: jest.fn(), equals: jest.fn(),
    isBefore: jest.fn(), isBeforeOrEqual: jest.fn(), clone: jest.fn(),
};

export const mockTextModel: Monaco.ITextModel = {
    uri: new Uri(), id: "1", getOptions: jest.fn(), getVersionId: jest.fn(), getAlternativeVersionId: jest.fn(),
    setValue: jest.fn(), getValue: jest.fn(), getValueLength: jest.fn(), getValueInRange: jest.fn(),
    getValueLengthInRange: jest.fn(), getCharacterCountInRange: jest.fn(), getLineCount: jest.fn(),
    getLineContent: jest.fn(), getLineLength: jest.fn(), getLinesContent: jest.fn(), getEOL: jest.fn(),
    getEndOfLineSequence: jest.fn(), getLineMinColumn: jest.fn(), getLineMaxColumn: jest.fn(),
    getLineFirstNonWhitespaceColumn: jest.fn(), getLineLastNonWhitespaceColumn: jest.fn(),
    validatePosition: jest.fn(), modifyPosition: jest.fn(), validateRange: jest.fn(), getOffsetAt: jest.fn(),
    getPositionAt: jest.fn(), getFullModelRange: jest.fn(), isDisposed: jest.fn(), findMatches: jest.fn(),
    findNextMatch: jest.fn(), findPreviousMatch: jest.fn(), getLanguageId: jest.fn(), getWordAtPosition: jest.fn(),
    getWordUntilPosition: jest.fn(), deltaDecorations: jest.fn(), getDecorationOptions: jest.fn(),
    getDecorationRange: jest.fn(), getLineDecorations: jest.fn(), getLinesDecorations: jest.fn(),
    getDecorationsInRange: jest.fn(), getAllDecorations: jest.fn(), getOverviewRulerDecorations: jest.fn(),
    getInjectedTextDecorations: jest.fn(), normalizeIndentation: jest.fn(), updateOptions: jest.fn(),
    detectIndentation: jest.fn(), pushStackElement: jest.fn(), popStackElement: jest.fn(),
    pushEditOperations: jest.fn(), pushEOL: jest.fn(), applyEdits: jest.fn(), setEOL: jest.fn(),
    onDidChangeContent: jest.fn(), onDidChangeDecorations: jest.fn(), onDidChangeOptions: jest.fn(),
    onDidChangeLanguage: jest.fn(), onDidChangeLanguageConfiguration: jest.fn(), onDidChangeAttached: jest.fn(),
    onWillDispose: jest.fn(), dispose: jest.fn(), isAttachedToEditor: jest.fn(), getAllMarginDecorations: jest.fn(),
    createSnapshot: jest.fn(),
};
