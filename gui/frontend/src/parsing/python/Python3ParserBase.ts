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

// Parts of this file are based on the Python3ParseBase class from the ANTLR4 grammar directory.

import { Parser, TokenStream } from "antlr4ng";

export enum PythonVersion {
    Auto = 0,
    Python2 = 2,
    Python3 = 3,
}

export abstract class Python3ParserBase extends Parser {
    public version = PythonVersion.Auto;

    public constructor(input: TokenStream) {
        super(input);
    }

    protected cannotBePlusMinus(): boolean {
        return true;
    }

    protected cannotBeDotLpEq(): boolean {
        return true;
    }
}
