/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { IRange } from "monaco-editor";

import { ITextRange } from "../../../supplement/index.js";
import { editorRangeToTextRange, isTextSpan, textRangeToEditorRange } from "../../../utilities/ts-helpers.js";

describe("TS Helper Tests", () => {
    it("Text Span", () => {
        const span1 = {
            start: 1,
            stop: 2,
        };
        const span2 = {
            length: 2,
        };
        const span3 = {
            value: true,
        };
        const span4 = {
            start: 1,
            length: 2,
        };

        expect(isTextSpan(span1)).toBeFalsy();
        expect(isTextSpan(span2)).toBeFalsy();
        expect(isTextSpan(span3)).toBeFalsy();
        expect(isTextSpan(span4)).toBeTruthy();
    });

    it("Range Conversion", () => {
        const textRange: ITextRange = {
            startLine: 1,
            startColumn: 2,
            endLine: 3,
            endColumn: 4,
        };

        const editorRange: IRange = {
            startLineNumber: 1,
            startColumn: 2,
            endLineNumber: 3,
            endColumn: 4,
        };

        expect(textRangeToEditorRange(textRange)).toStrictEqual(editorRange);
        expect(editorRangeToTextRange(editorRange)).toStrictEqual(textRange);
    });
});
