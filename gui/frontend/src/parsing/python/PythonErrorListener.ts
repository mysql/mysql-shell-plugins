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
 * documentation. The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable no-underscore-dangle */

import { ATNSimulator, BaseErrorListener, RecognitionException, Recognizer, Token } from "antlr4ng";

import { ErrorReportCallback } from "../parser-common";

export class PythonErrorListener extends BaseErrorListener<ATNSimulator> {

    public constructor(private callback: ErrorReportCallback) {
        super();
    }

    public syntaxError<T extends Token>(_recognizer: Recognizer<ATNSimulator>,
        _offendingSymbol: T | null, _line: number, _charPositionInLine: number, _msg: string,
        _e: RecognitionException | null): void {
        // Nothing to do here.
    }
}
