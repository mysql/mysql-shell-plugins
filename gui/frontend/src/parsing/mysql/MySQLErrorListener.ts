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
    ATNSimulator,
    BaseErrorListener, FailedPredicateException, InputMismatchException, IntervalSet, Lexer, NoViableAltException,
    Parser, RecognitionException, Recognizer, Token, Vocabulary,
} from "antlr4ng";

import { MySQLMRSParser } from "./generated/MySQLMRSParser.js";
import { MySQLMRSLexer } from "./generated/MySQLMRSLexer.js";
import { MySQLBaseLexer } from "./MySQLBaseLexer.js";
import { ErrorReportCallback } from "../parser-common.js";

export class MySQLErrorListener extends BaseErrorListener {

    private static simpleRules: Set<number> = new Set([
        MySQLMRSParser.RULE_identifier,
        MySQLMRSParser.RULE_qualifiedIdentifier,
    ]);

    private static objectNames: Map<number, string> = new Map([
        [MySQLMRSParser.RULE_columnName, "column"],
        [MySQLMRSParser.RULE_columnRef, "column"],
        [MySQLMRSParser.RULE_columnInternalRef, "column"],
        [MySQLMRSParser.RULE_indexName, "index"],
        [MySQLMRSParser.RULE_indexRef, "index"],
        [MySQLMRSParser.RULE_schemaName, "schema"],
        [MySQLMRSParser.RULE_schemaRef, "schema"],
        [MySQLMRSParser.RULE_procedureName, "procedure"],
        [MySQLMRSParser.RULE_procedureRef, "procedure"],
        [MySQLMRSParser.RULE_functionName, "function"],
        [MySQLMRSParser.RULE_functionRef, "function"],
        [MySQLMRSParser.RULE_triggerName, "trigger"],
        [MySQLMRSParser.RULE_triggerRef, "trigger"],
        [MySQLMRSParser.RULE_viewName, "view"],
        [MySQLMRSParser.RULE_viewRef, "view"],
        [MySQLMRSParser.RULE_tablespaceName, "tablespace"],
        [MySQLMRSParser.RULE_tablespaceRef, "tablespace"],
        [MySQLMRSParser.RULE_logfileGroupName, "logfile group"],
        [MySQLMRSParser.RULE_logfileGroupRef, "logfile group"],
        [MySQLMRSParser.RULE_eventName, "event"],
        [MySQLMRSParser.RULE_eventRef, "event"],
        [MySQLMRSParser.RULE_udfName, "udf"],
        [MySQLMRSParser.RULE_serverName, "server"],
        [MySQLMRSParser.RULE_serverRef, "server"],
        [MySQLMRSParser.RULE_engineRef, "engine"],
        [MySQLMRSParser.RULE_tableName, "table"],
        [MySQLMRSParser.RULE_tableRef, "table"],
        [MySQLMRSParser.RULE_filterTableRef, "table"],
        [MySQLMRSParser.RULE_tableRefWithWildcard, "table"],
        [MySQLMRSParser.RULE_parameterName, "parameter"],
        [MySQLMRSParser.RULE_labelIdentifier, "label"],
        [MySQLMRSParser.RULE_labelRef, "label"],
        [MySQLMRSParser.RULE_roleIdentifier, "role"],
        [MySQLMRSParser.RULE_pluginRef, "plugin"],
        [MySQLMRSParser.RULE_componentRef, "component"],
        [MySQLMRSParser.RULE_resourceGroupRef, "resource group"],
        [MySQLMRSParser.RULE_windowName, "window"],
    ]);

    public constructor(private callback: ErrorReportCallback) {
        super();
    }

    public override syntaxError<S extends Token, T extends ATNSimulator>(recognizer: Recognizer<T>,
        offendingSymbol: S | null, line: number, charPositionInLine: number, msg: string,
        e: RecognitionException | null): void {

        let message = "";

        // If not undefined then offendingSymbol is of type Token and the recognizer is of type Parser.
        if (offendingSymbol) {
            let token = offendingSymbol as Token;

            if (!(recognizer instanceof Parser)) {
                throw new Error("Unexpected type of recognizer in MySQLErrorListener.syntaxError()");
            }

            const parser = recognizer as MySQLMRSParser;
            const lexer = parser.inputStream.tokenSource as MySQLBaseLexer;

            const isEof = token.type === Token.EOF;
            if (isEof) {
                token = parser.inputStream.get(token.tokenIndex - 1);
            }

            const errorLength = token.stop - token.start + 1;
            let wrongText = token.text || "";

            // getExpectedTokens() ignores predicates, so it might include the token for which we got this syntax error,
            // if that was excluded by a predicate (which in our case is always a version check).
            // That's a good indicator to tell the user that this keyword is not valid *for the current server version*.
            let expected = parser.getExpectedTokens();
            let invalidForVersion = false;
            let tokenType = token.type;
            if (tokenType !== MySQLMRSLexer.IDENTIFIER && expected.contains(tokenType)) {
                invalidForVersion = true;
            } else {
                tokenType = lexer.keywordFromText(wrongText);
                if (expected.contains(tokenType)) {
                    invalidForVersion = true;
                }
            }

            if (invalidForVersion) {
                // The expected tokens set is read-only, so make a copy.
                expected = new IntervalSet(expected);
                expected.removeOne(tokenType);
            }

            // Try to find the expected input by examining the current parser context and
            // the expected interval set. The latter often lists useless keywords, especially if they are allowed
            // as identifiers.
            let expectedText = "";

            // Walk up from generic rules to reach something that gives us more context, if needed.
            let context = parser.context!;
            while (MySQLErrorListener.simpleRules.has(context.ruleIndex) && context.parent) {
                context = context.parent;
            }

            switch (context.ruleIndex) {
                case MySQLMRSParser.RULE_functionCall:
                    expectedText = "a complete function call or other expression";
                    break;

                case MySQLMRSParser.RULE_expr:
                    expectedText = "an expression";
                    break;

                case MySQLMRSParser.RULE_columnName:
                case MySQLMRSParser.RULE_indexName:
                case MySQLMRSParser.RULE_schemaName:
                case MySQLMRSParser.RULE_procedureName:
                case MySQLMRSParser.RULE_functionName:
                case MySQLMRSParser.RULE_triggerName:
                case MySQLMRSParser.RULE_viewName:
                case MySQLMRSParser.RULE_tablespaceName:
                case MySQLMRSParser.RULE_logfileGroupName:
                case MySQLMRSParser.RULE_eventName:
                case MySQLMRSParser.RULE_udfName:
                case MySQLMRSParser.RULE_serverName:
                case MySQLMRSParser.RULE_tableName:
                case MySQLMRSParser.RULE_parameterName:
                case MySQLMRSParser.RULE_labelIdentifier:
                case MySQLMRSParser.RULE_roleIdentifier:
                case MySQLMRSParser.RULE_windowName: {
                    const name = MySQLErrorListener.objectNames.get(context.ruleIndex);
                    if (!name) {
                        expectedText = "a new object name";
                    } else {
                        expectedText = `a new ${name} name`;
                    }
                    break;
                }

                case MySQLMRSParser.RULE_columnRef:
                case MySQLMRSParser.RULE_indexRef:
                case MySQLMRSParser.RULE_schemaRef:
                case MySQLMRSParser.RULE_procedureRef:
                case MySQLMRSParser.RULE_functionRef:
                case MySQLMRSParser.RULE_triggerRef:
                case MySQLMRSParser.RULE_viewRef:
                case MySQLMRSParser.RULE_tablespaceRef:
                case MySQLMRSParser.RULE_logfileGroupRef:
                case MySQLMRSParser.RULE_eventRef:
                case MySQLMRSParser.RULE_serverRef:
                case MySQLMRSParser.RULE_engineRef:
                case MySQLMRSParser.RULE_tableRef:
                case MySQLMRSParser.RULE_filterTableRef:
                case MySQLMRSParser.RULE_tableRefWithWildcard:
                case MySQLMRSParser.RULE_labelRef:
                case MySQLMRSParser.RULE_pluginRef:
                case MySQLMRSParser.RULE_componentRef:
                case MySQLMRSParser.RULE_resourceGroupRef: {
                    const name = MySQLErrorListener.objectNames.get(context.ruleIndex);
                    if (!name) {
                        expectedText = "the name of an existing object";
                    } else {
                        expectedText = "the name of an existing " + name;
                    }
                    break;
                }

                case MySQLMRSParser.RULE_columnInternalRef: {
                    expectedText = "a column name from this table";
                    break;
                }

                default: {
                    // If the expected set contains the IDENTIFIER token we likely want an identifier at this position.
                    // Due to the fact that MySQL defines a number of keywords as possible identifiers, we get all those
                    // whenever an identifier is actually required, bloating so the expected set with irrelevant
                    // elements. Hence we check for the identifier entry and assume we *only* want an identifier.
                    // This gives an imprecise result if both certain keywords *and* an identifier are expected.
                    if (expected.contains(MySQLMRSLexer.IDENTIFIER)) {
                        expectedText = "an identifier";
                    } else {
                        expectedText = this.intervalToString(expected, 6, parser.vocabulary);
                    }
                    break;
                }
            }

            if (!wrongText.startsWith("\"") && !wrongText.startsWith("'") && !wrongText.startsWith("`")) {
                wrongText = "\"" + wrongText + "\"";
            }

            if (!e) {
                // Missing or unwanted tokens.
                const oneOf = expectedText.length > 1 ? "one of " : "";
                if (msg.includes("missing")) {
                    message = `Missing ${oneOf}${expectedText} before ${wrongText}`;
                } else {
                    message = `Extraneous input ${wrongText} found, expecting ${oneOf}${expectedText}`;
                }
            } else {
                if (e instanceof InputMismatchException) {
                    if (isEof) {
                        message = "Statement is incomplete";
                    } else {
                        message = wrongText + " is not valid at this position";

                        if (expectedText.length > 0) {
                            message += ", expecting " + expectedText;
                        }
                    }
                } else if (e instanceof FailedPredicateException) {
                    // For cases like "... | a ({condition}? b)", but not "... | a ({condition}? b)?".
                    // Remove parts of the message we don't want.
                    const condition = e.message.substring("failed predicate: ".length);

                    condition.replace(/serverVersion/g, "server version");
                    condition.replace(/ && /g, "and");
                    message = wrongText + " is valid only for " + condition;
                } if (e instanceof NoViableAltException) {
                    if (isEof) {
                        message = "Statement is incomplete";
                    } else {
                        message = wrongText + " is not valid at this position";
                        if (invalidForVersion) {
                            message += " for this server version";
                        }
                    }

                    if (expectedText.length > 0) {
                        message += ", expecting " + expectedText;
                    }
                }
            }

            this.callback(message, token.type, token.start, line, charPositionInLine, errorLength);
        } else {
            // No offending symbol, which indicates this is a lexer error.
            if (e instanceof NoViableAltException) {
                if (!(recognizer instanceof Lexer)) {
                    throw new Error("Unexpected type of recognizer in MySQLErrorListener.syntaxError()");
                }

                const lexer = recognizer as MySQLMRSLexer;
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

    private intervalToString(set: IntervalSet, maxCount: number, vocabulary: Vocabulary): string {
        const symbols = set.toArray();

        if (symbols.length === 0) {
            return "";
        }

        let result = "";
        let firstEntry = true;
        maxCount = Math.min(maxCount, symbols.length);
        for (let i = 0; i < maxCount; ++i) {
            const symbol = symbols[i];
            if (!firstEntry) {
                result += ", ";
            }
            firstEntry = false;

            if (symbol < 0) {
                result += "EOF";
            } else {
                let name = vocabulary.getDisplayName(symbol) ?? "";
                switch (name) {
                    case "BACK_TICK_QUOTED_ID": {
                        name = "`text`";

                        break;
                    }

                    case "DOUBLE_QUOTED_TEXT": {
                        name = "\"text\"";

                        break;
                    }

                    case "SINGLE_QUOTED_TEXT": {
                        name = "'text'";

                        break;
                    }

                    case "DOLLAR_QUOTED_STRING_TEXT": {
                        name = "a tagged string";

                        break;
                    }

                    default: {
                        name = name.replace("_SYMBOL", "");
                        name = name.replace("_OPERATOR", "");
                        name = name.replace("_NUMBER", "");
                    }
                }
                result += name;
            }
        }

        if (maxCount < symbols.length) {
            result += ", ...";
        }

        if (maxCount > 1) {
            return `{ ${result} }`;
        }

        return result;
    }
}
