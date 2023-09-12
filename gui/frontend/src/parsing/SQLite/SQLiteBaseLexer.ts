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

import { Lexer, Token } from "antlr4ng";

import { SQLiteLexer } from "./generated/SQLiteLexer";
import { isReservedKeyword, SQLiteVersion } from "./SQLiteRecognizerCommon";

// The base lexer class provides a number of functions needed in actions in the lexer (grammar).
export abstract class SQLiteBaseLexer extends Lexer {

    private pendingTokens: Token[] = [];

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
     * Determines if the given type is an operator.
     *
     * @param type The type to check.
     *
     * @returns True if the type is an operator.
     */
    public isOperator(type: number): boolean {
        switch (type) {
            case SQLiteLexer.SCOL:
            case SQLiteLexer.DOT:
            case SQLiteLexer.OPEN_PAR:
            case SQLiteLexer.CLOSE_PAR:
            case SQLiteLexer.COMMA:
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

        const symbol = this.getVocabulary().getSymbolicName(type);
        if (symbol && symbol !== "" && !isReservedKeyword(symbol, SQLiteVersion.Standard)) {
            return true;
        }

        return false;
    }

    /**
     * Implements the multi token feature required in our lexer.
     * A lexer rule can emit more than a single token, if needed.
     *
     * @returns The next token in the token stream.
     */
    public nextToken(): Token {
        // First respond with pending tokens to the next token request, if there are any.
        let pending = this.pendingTokens.shift();
        if (pending) {
            return pending;
        }

        // Let the main lexer class run the next token recognition.
        // This might create additional tokens again.
        const next = super.nextToken();
        pending = this.pendingTokens.shift();
        if (pending) {
            this.pendingTokens.push(next);

            return pending;
        }

        return next;
    }

    /**
     * Creates a DOT token in the token stream.
     */
    protected emitDot(): void {
        this.pendingTokens.push(this._factory.create([this, this._input], SQLiteLexer.DOT,
            this.text, this._channel, this._tokenStartCharIndex, this._tokenStartCharIndex, this._tokenStartLine,
            this._tokenStartCharPositionInLine,
        ));

        ++this._tokenStartCharIndex;
    }

    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * Returns the next token in the token stream that is on the default channel (not a hidden or other one).
     *
     * @returns The next token. Can be EOF to denote the end of input.
     */
    private nextDefaultChannelToken(): Token {
        do {
            const token = this.nextToken();
            if (token.channel === Token.DEFAULT_CHANNEL) {
                return token;
            }

        } while (true);
    }
}
