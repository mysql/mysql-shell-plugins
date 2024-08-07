/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
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

import { Lexer } from "antlr4ng";

import { SQLiteLexer } from "./generated/SQLiteLexer.js";
import { isReservedKeyword, SQLiteVersion } from "./SQLiteRecognizerCommon.js";

/** The base lexer class provides a number of functions needed in actions in the lexer (grammar). */
export abstract class SQLiteBaseLexer extends Lexer {

    /**
     * Determines if the given type is a relational operator.
     *
     * @param type The type to check.
     *
     * @returns True if the type is a relational operator.
     */
    public static isRelation(type: number): boolean {
        switch (type) {
            case SQLiteLexer.SCOL:
            case SQLiteLexer.ASSIGN:
            case SQLiteLexer.STAR:
            case SQLiteLexer.PLUS:
            case SQLiteLexer.MINUS:
            case SQLiteLexer.TILDE:
            case SQLiteLexer.PIPE2:
            case SQLiteLexer.DIV:
            case SQLiteLexer.MOD:
            case SQLiteLexer.LT2:
            case SQLiteLexer.GT2:
            case SQLiteLexer.AMP:
            case SQLiteLexer.PIPE:
            case SQLiteLexer.LT:
            case SQLiteLexer.LT_EQ:
            case SQLiteLexer.GT:
            case SQLiteLexer.GT_EQ:
            case SQLiteLexer.EQ:
            case SQLiteLexer.NOT_EQ1:
            case SQLiteLexer.NOT_EQ2: {
                return true;
            }

            default: {
                return false;
            }
        }
    }

    /**
     * Determines if the given type is a number type.
     *
     * @param type The type to check.
     *
     * @returns True if the type is a number type.
     */
    public isNumber(type: number): boolean {
        switch (type) {
            case SQLiteLexer.NUMERIC_LITERAL: {
                return true;
            }

            default: {
                return false;
            }
        }
    }

    /**
     * Determines if the given type is a delimiter.
     *
     * @param type The type to check.
     *
     * @returns True if the type is a delimiter.
     */
    public isDelimiter(type: number): boolean {
        switch (type) {
            case SQLiteLexer.SCOL:
            case SQLiteLexer.DOT:
            case SQLiteLexer.COMMA: {
                return true;
            }

            default:
                return false;
        }
    }

    /**
     * Determines if the given type is an operator.
     *
     * @param type The type to check.
     *
     * @returns True if the type is an operator.
     */
    public isOperator(type: number): boolean {
        switch (type) {
            case SQLiteLexer.OPEN_PAR:
            case SQLiteLexer.CLOSE_PAR:
            case SQLiteLexer.ASSIGN:
            case SQLiteLexer.STAR:
            case SQLiteLexer.PLUS:
            case SQLiteLexer.MINUS:
            case SQLiteLexer.TILDE:
            case SQLiteLexer.PIPE2:
            case SQLiteLexer.DIV:
            case SQLiteLexer.MOD:
            case SQLiteLexer.LT2:
            case SQLiteLexer.GT2:
            case SQLiteLexer.AMP:
            case SQLiteLexer.PIPE:
            case SQLiteLexer.LT:
            case SQLiteLexer.LT_EQ:
            case SQLiteLexer.GT:
            case SQLiteLexer.GT_EQ:
            case SQLiteLexer.EQ:
            case SQLiteLexer.NOT_EQ1:
            case SQLiteLexer.NOT_EQ2: {
                return true;
            }

            default:
                return false;
        }
    }

    /**
     * Returns true if the given token is an identifier. This includes all those keywords that are
     * allowed as identifiers when unquoted (non-reserved keywords).
     *
     * @param type The token type to check.
     *
     * @returns True if the given type is an identifier, which depends also on the current SQL mode.
     */
    public isIdentifier(type: number): boolean {
        if (type === SQLiteLexer.EOF) {
            return false;
        }

        if ((type === SQLiteLexer.IDENTIFIER)) {
            return true;
        }

        const symbol = this.vocabulary.getSymbolicName(type);
        if (symbol && symbol !== "" && !isReservedKeyword(symbol, SQLiteVersion.Standard)) {
            return true;
        }

        return false;
    }
}
