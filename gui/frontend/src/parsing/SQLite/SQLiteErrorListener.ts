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

import {
    ATNSimulator, BaseErrorListener, FailedPredicateException, InputMismatchException, LexerNoViableAltException,
    NoViableAltException, RecognitionException, Recognizer, Token,
} from "antlr4ng";

import { ErrorReportCallback } from "../parser-common.js";
import { SQLiteParser } from "./generated/SQLiteParser.js";
import { SQLiteLexer } from "./generated/SQLiteLexer.js";

export class SQLiteErrorListener extends BaseErrorListener {

    public constructor(private callback: ErrorReportCallback) {
        super();
    }

    public override syntaxError<S extends Token, T extends ATNSimulator>(recognizer: Recognizer<T>,
        offendingSymbol: S | null, line: number, charPositionInLine: number, msg: string,
        e: RecognitionException | null): void {

        let message = "";

        // If not undefined then offendingSymbol is of type Token.
        if (offendingSymbol) {
            let token = offendingSymbol as Token;

            const parser = recognizer as unknown as SQLiteParser;
            const isEof = token.type === Token.EOF;
            if (isEof) {
                token = parser.inputStream.get(token.tokenIndex - 1);
            }

            const errorLength = token.stop - token.start + 1;
            let wrongText = token.text || "";

            // getExpectedTokens() ignores predicates, so it might include the token for which we got this syntax error,
            // if that was excluded by a predicate (which in our case is always a version check).
            // That's a good indicator to tell the user that this keyword is not valid *for the current server version*.
            const expected = parser.getExpectedTokens();
            const expectedText = "";

            if (!wrongText.startsWith("\"") && !wrongText.startsWith("'") && !wrongText.startsWith("`")) {
                wrongText = "\"" + wrongText + "\"";
            }

            if (!e) {
                // Missing or unwanted tokens.
                if (msg.includes("missing")) {
                    if (expected.length === 1) {
                        message = "Missing " + expectedText;
                    }
                } else {
                    message = `Extraneous input ${wrongText} found, expecting ${expectedText}`;
                }
            } else {
                if (e instanceof InputMismatchException) {
                    if (isEof) {
                        message = "Statement is incomplete";
                    } else {
                        message = wrongText + " is not valid at this position";

                        if (expectedText.length > 0) { message += ", expecting " + expectedText; }
                    }
                } else if (e instanceof FailedPredicateException) {
                    // For cases like "... | a ({condition}? b)", but not "... | a ({condition}? b)?".
                    // Remove parts of the message we don't want.
                    const condition = e.message.substring("predicate failed: ".length, -1);

                    condition.replace(/serverVersion/g, "server version");
                    condition.replace(/ && /g, "and");
                    message = wrongText + " is valid only for " + condition;
                } if (e instanceof NoViableAltException) {
                    if (isEof) {
                        message = "Statement is incomplete";
                    } else {
                        message = wrongText + " is not valid at this position";
                    }

                    if (expectedText.length > 0) {
                        message += ", expecting " + expectedText;
                    }
                }
            }

            this.callback(message, token.type, token.start, line, charPositionInLine, errorLength);
        } else {
            // No offending symbol, which indicates this is a lexer error.
            if (e instanceof LexerNoViableAltException) {
                const lexer = recognizer as unknown as SQLiteLexer;
                const input = lexer.inputStream;
                let text = lexer.getErrorDisplay(input.getTextFromRange(lexer.tokenStartCharIndex, input.index));
                if (text === "") {
                    text = " ";  // Should never happen, but we must ensure we have text.
                }

                switch (text[0]) {
                    case "/":
                        message = "Unfinished multiline comment";
                        break;
                    case '"':
                        message = "Unfinished double quoted string literal";
                        break;
                    case "'":
                        message = "Unfinished single quoted string literal";
                        break;
                    case "`":
                        message = "Unfinished back tick quoted string literal";
                        break;

                    default:
                        // Hex or bin string?
                        if (text.length > 1 && text[1] === "'" && (text.startsWith("x") || text.startsWith("b"))) {
                            message = "Unfinished " + (text.startsWith("x") ? "hex" : "binary") + " string literal";
                            break;
                        }

                        // Something else the lexer couldn't make sense of.
                        // Likely there is no rule that accepts this input.
                        message = "\"" + text + "\" is no valid input at all";
                        break;
                }

                this.callback(message, 0, lexer.tokenStartCharIndex, line, charPositionInLine,
                    input.index - lexer.tokenStartCharIndex);

            }

        }
    }
}
