/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

// This file contains the main interface to all language services for MySQL.

/* eslint-disable no-underscore-dangle */

import {
    BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, ParseCancellationException,
    ParseTree, PredictionMode, TokenStreamRewriter, XPath, Token,
} from "antlr4ng";

import { MySQLMRSLexer } from "./generated/MySQLMRSLexer.js";
import {
    FromClauseContext, MySQLMRSParser, QueryContext, QueryExpressionContext, QuerySpecificationContext, SubqueryContext,
    TableFactorContext,
} from "./generated/MySQLMRSParser.js";

import { MySQLErrorListener } from "./MySQLErrorListener.js";
import { MySQLParseUnit } from "./MySQLServiceTypes.js";
import {
    ICompletionData, IParserErrorInfo, IPreprocessResult, IStatement, IStatementSpan, ISymbolInfo, ITokenInfo,
    QueryType, StatementFinishState, SymbolKind, TextSpan, tokenFromPosition,
} from "../parser-common.js";

import { SystemVariableSymbol, SystemFunctionSymbol, DBSymbolTable } from "../DBSymbolTable.js";
import { getCodeCompletionItems } from "./MySQLCodeCompletion.js";
import { unquote } from "../../utilities/string-helpers.js";
import { isKeyword, numberToVersion } from "./MySQLRecognizerCommon.js";
import { MySQLVersion } from "./mysql-keywords.js";

export class MySQLParsingServices {

    private static services?: MySQLParsingServices;
    private static readonly delimiterKeyword = /delimiter /i;

    private lexer = new MySQLMRSLexer(CharStream.fromString(""));
    private tokenStream = new CommonTokenStream(this.lexer);
    private parser = new MySQLMRSParser(this.tokenStream);
    private errors: IParserErrorInfo[] = [];

    private tree: ParseTree | undefined;

    // System functions and variables for quick info retrieval. This is a duplicate of the global symbols
    // loaded in MySQLWorker.ts, but we cannot use that as this services runs in a web worker.
    private globalSymbols: DBSymbolTable;

    private errorListener = new MySQLErrorListener(
        (message: string, tokenType: number, startIndex: number, line: number, column: number,
            length: number): void => {

            if (length === 0) {
                length = 1;
            }

            this.errors.push({ message, tokenType, charOffset: startIndex, line, offset: column, length });
        },
    );

    private constructor() {
        this.lexer.removeErrorListeners();
        this.lexer.addErrorListener(this.errorListener);

        this.globalSymbols = new DBSymbolTable("globals", { allowDuplicateSymbols: true });

        void import("./data/system-variables.json").then((systemVariables) => {
            for (const [key, value] of Object.entries(systemVariables.default)) {
                this.globalSymbols.addNewSymbolOfType(SystemVariableSymbol, undefined, key.toLowerCase(), value);
            }
        });

        void import("./data/system-functions.json").then((systemFunctions) => {
            for (const [key, value] of Object.entries(systemFunctions.default)) {
                this.globalSymbols.addNewSymbolOfType(SystemFunctionSymbol, undefined, key.toLowerCase(), value);
            }
        });

        void import("./data/rdbms-info.json").then((rdbmsInfo) => {
            Object.keys(rdbmsInfo.default.characterSets).forEach((set: string) => {
                this.lexer.charsets.add("_" + set.toLowerCase());
            });
        });

        this.parser.removeParseListeners();
        this.parser.removeErrorListeners();
        this.parser.addErrorListener(this.errorListener);
    }

    /**
     * Creates the parsing services instance on demand. This involves loading certain data files.
     *
     * @returns The singleton instance of the parsing services.
     */
    public static get instance(): MySQLParsingServices {
        if (!MySQLParsingServices.services) {
            MySQLParsingServices.services = new MySQLParsingServices();
        }

        return MySQLParsingServices.services;
    }

    /**
     * Quick check for syntax errors.
     *
     * @param text The text to parse.
     * @param unit The type of input. Can be used to limit the available syntax to certain constructs.
     * @param serverVersion The version of MySQL to use for checking.
     * @param sqlMode The current SQL mode in the server.
     *
     * @returns True if no error was found, otherwise false.
     */
    public errorCheck(text: string, unit: MySQLParseUnit, serverVersion: number, sqlMode: string): boolean {
        this.applyServerDetails(serverVersion, sqlMode);
        this.startParsing(text, true, unit);

        // Explicitly check for an unfinished multi-line comment and add this as an own error.
        const tokens = this.tokenStream.getTokens();
        if (tokens.length > 1) { // There's always the EOF token at the end.
            const lastToken = tokens[tokens.length - 2];
            if (lastToken.type === MySQLMRSLexer.INVALID_BLOCK_COMMENT) {
                this.errors.splice(0, 0, {
                    message: "Unfinished multi line comment",
                    tokenType: MySQLMRSLexer.INVALID_BLOCK_COMMENT,
                    charOffset: lastToken.start,
                    line: lastToken.line,
                    offset: lastToken.column,
                    length: 100,
                });
            }
        }

        return this.errors.length === 0;
    }

    /**
     * Returns a collection of errors from the last parser run. The start position is offset by the given
     * value (used to adjust error position in a larger context).
     *
     * @param offset The character offset to add for each error.
     *
     * @returns The updated error list from the last parse run.
     */
    public errorsWithOffset(offset: number): IParserErrorInfo[] {
        const result: IParserErrorInfo[] = [...this.errors];
        result.forEach((error: IParserErrorInfo) => {
            error.charOffset += offset;
        });

        return result;
    }

    /**
     * Returns information about the item at the given position.
     *
     * @param text The text to handle.
     * @param offset The character position in the input to start from.
     * @param serverVersion The version of MySQL to control the parsing process.
     *
     * @returns The information about the symbol at the given offset, if there's one.
     */
    public async getQuickInfo(text: string, offset: number, serverVersion: number): Promise<ISymbolInfo | undefined> {
        this.lexer.serverVersion = serverVersion;
        this.errors = [];
        this.lexer.inputStream = CharStream.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        const token = tokenFromPosition(this.tokenStream, offset);
        if (token) {
            this.tokenStream.seek(token.tokenIndex);
            const tokenText = (token.text || "").toLowerCase();
            switch (token.type) {
                case MySQLMRSLexer.IDENTIFIER:
                case MySQLMRSLexer.BACK_TICK_QUOTED_ID: {
                    const previousToken = this.tokenStream.LT(-1);
                    if (previousToken) {
                        if (previousToken.type === MySQLMRSLexer.AT_AT_SIGN_SYMBOL) {
                            // System variables.
                            const info = await this.globalSymbols.getSymbolInfo(unquote(tokenText));
                            if (info) {
                                info.definition = {
                                    text: tokenText,
                                    span: { start: token.start - 2, length: tokenText.length + 2 },
                                };

                                return info;
                            }
                        } else if (previousToken.type === MySQLMRSLexer.DOT_SYMBOL) {
                            // Could be a variable with preceding option type.
                            switch (this.tokenStream.LA(-2)) {
                                case MySQLMRSLexer.GLOBAL_SYMBOL:
                                case MySQLMRSLexer.LOCAL_SYMBOL:
                                case MySQLMRSLexer.SESSION_SYMBOL: {
                                    const info = await this.globalSymbols.getSymbolInfo(tokenText);
                                    if (info) {
                                        info.definition = {
                                            text: tokenText,
                                            span: { start: token.start, length: tokenText.length },
                                        };

                                        return info;
                                    }

                                    break;
                                }

                                default: {
                                    break;
                                }
                            }

                        }
                    }
                }
                // [falls-through]

                default: {
                    // Potentially something like a system function or similar.
                    const info = await this.globalSymbols.getSymbolInfo(tokenText);
                    if (info) {
                        info.definition = {
                            text: tokenText,
                            span: { start: token.start, length: tokenText.length },
                        };

                        return info;
                    }

                    break;
                }
            }
        }
    }

    /**
     * Creates a list of token info items for the given text.
     *
     * @param statements A list of statements to tokenize.
     * @param serverVersion The version of MySQL to control the parsing process.
     * @param sqlMode The current SQL mode in the server.
     *
     * @returns The information about the symbol at the given offset, if there's one.
     */
    public async tokenize(statements: IStatement[], serverVersion: number,
        sqlMode: string): Promise<ITokenInfo[]> {
        const result: ITokenInfo[] = [];

        for (const statement of statements) {
            // Special treatment for delimiters.
            if (statement.text.match(/^\s*delimiter /i)) {
                // Line and column values are one based.
                result.push({
                    type: "delimiter",
                    offset: statement.offset,
                    length: statement.text.length,
                });

                continue;
            }

            this.applyServerDetails(serverVersion, sqlMode);
            this.errors = [];
            this.lexer.inputStream = CharStream.fromString(statement.text);
            this.tokenStream.setTokenSource(this.lexer);
            this.tokenStream.fill();

            const tokens = this.tokenStream.getTokens();

            let variablePending = false;
            const version = numberToVersion(serverVersion);
            for (const token of tokens) {
                switch (token.type) {
                    case MySQLMRSLexer.WHITESPACE:
                    case MySQLMRSLexer.EOF: {
                        break;
                    }

                    default: {
                        let type = await this.lexerTypeToScope(token, version);

                        // System variables appear as two tokens, the first one being the @@ sign.
                        // Make both of them appear as variable.predefined.
                        if (type === "variable.predefined") {
                            variablePending = true;
                        } else if (variablePending) {
                            variablePending = false;
                            type = "variable.predefined";
                        }

                        result.push({
                            type,
                            offset: statement.offset + token.start,
                            length: token.stop - token.start + 1,
                        });
                    }
                }
            }
        }

        return result;
    }

    /**
     * Determines completion items at the given position.
     *
     * @param text The text to handle.
     * @param offset The character position in the input to start from.
     * @param line Line position of the invocation.
     * @param column Column position of the invocation.
     * @param defaultSchema The schema to be used if there's none specified in the text.
     * @param serverVersion The version of MySQL to control the parsing process.
     *
     * @returns A structure describing the completion items which much be shown.
     */
    public getCompletionsAtPosition(text: string, offset: number, line: number,
        column: number, defaultSchema: string, serverVersion: number): ICompletionData {

        this.lexer.serverVersion = serverVersion;
        this.parser.serverVersion = serverVersion;

        this.errors = [];
        this.lexer.inputStream = CharStream.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        let isQuoted = false;
        const token = tokenFromPosition(this.tokenStream, offset);
        if (token) {
            const tokenText = (token.text ?? "").trim();
            const unquoted = unquote(tokenText);
            isQuoted = unquoted.length < tokenText.length;
        }

        const items = getCodeCompletionItems(line, column, defaultSchema, this.parser);
        items.isQuoted = isQuoted;

        return items;
    }

    /**
     * Takes a block of SQL text and splits it into individual statements, by determining start position,
     * length and current delimiter for each. It is assumed the line break is a simple \n.
     * Note: the length includes anything up to (and including) the delimiter position.
     *
     * @param sql The SQL to split.
     * @param delimiter The initial delimiter to use.
     * @param serverVersion The version of MySQL to control the parsing process.
     * @returns A list of statement ranges.
     */
    public determineStatementRanges(sql: string, delimiter: string, serverVersion: number): IStatementSpan[] {
        const result: IStatementSpan[] = [];
        if (sql.length === 0) {
            return result;
        }

        let start = 0;    // Start of the current statement.
        let head = start; // Tracks the current content position in the current token.
        let tail = head;
        const end = head + sql.length;

        let haveContent = false; // Set when anything else but comments were found for the current statement.

        /**
         * Checks the current tail position if that touches a delimiter. If that's the case then the current statement
         * is finished and a new one starts.
         *
         * @returns True if a delimiter was found, otherwise false.
         */
        const checkDelimiter = (): boolean => {
            if (sql[tail] === delimiter[0]) {
                // Found possible start of the delimiter. Check if it really is.
                if (delimiter.length === 1) {
                    // Most common case.
                    ++tail;
                    result.push({
                        delimiter,
                        span: { start, length: tail - start },
                        contentStart: haveContent ? head : start,
                        state: StatementFinishState.Complete,
                    });

                    head = tail;
                    start = head;
                    haveContent = false;

                    return true;
                } else {
                    // Multi character delimiter?
                    const candidate = sql.substring(tail, tail + delimiter.length);
                    if (candidate === delimiter) {
                        // Multi char delimiter is complete. Tail still points to the start of the delimiter.
                        tail += delimiter.length;
                        result.push({
                            delimiter,
                            span: { start, length: tail - start },
                            contentStart: haveContent ? head : start,
                            state: StatementFinishState.Complete,
                        });

                        head = tail;
                        start = head;
                        haveContent = false;

                        return true;
                    }
                }
            }

            return false;
        };

        /**
         * Strings Comments and Delimiter switch case handler
         */
        const handleStringsCommentsAndDelimiter = (): void => {
            switch (sql[tail]) {
                case "/": { // Possible multi line comment or hidden (conditional) command.
                    if (sql[tail + 1] === "*") {
                        if (sql[tail + 2] === "!") { // Hidden command.
                            if (!haveContent) {
                                haveContent = true;
                                head = tail;
                            }
                            ++tail;
                        }
                        tail += 2;

                        while (true) {
                            while (tail < end && sql[tail] !== "*") {
                                ++tail;
                            }

                            if (tail === end) { // Unfinished multiline comment.
                                result.push({
                                    delimiter,
                                    span: { start, length: tail - start },
                                    contentStart: haveContent ? head : start,
                                    state: StatementFinishState.OpenComment,
                                });
                                start = tail;
                                head = tail;

                                break;
                            } else {
                                if (sql[++tail] === "/") {
                                    ++tail; // Skip the slash too.
                                    break;
                                }
                            }
                        }

                        if (!haveContent) {
                            head = tail; // Skip over the comment.
                        }

                    } else {
                        ++tail;
                        haveContent = true;
                    }

                    break;
                }

                case "-": { // Possible single line comment.
                    const temp = tail + 2;
                    if (sql[tail + 1] === "-" && (sql[temp] === " " || sql[temp] === "\t" ||
                        sql[temp] === "\n")) {
                        // Skip everything until the end of the line.
                        tail += 2;
                        while (tail < end && sql[tail] !== "\n") {
                            ++tail;
                        }

                        if (tail === end) { // Unfinished single line comment.
                            result.push({
                                delimiter,
                                span: { start, length: tail - start },
                                contentStart: haveContent ? head : start,
                                state: StatementFinishState.OpenComment,
                            });
                            start = tail;
                            head = tail;

                            break;
                        }

                        if (!haveContent) {
                            head = tail;
                        }
                    } else {
                        ++tail;
                        haveContent = true;
                    }

                    break;
                }

                case "#": { // MySQL single line comment.
                    while (tail < end && sql[tail] !== "\n") {
                        ++tail;
                    }

                    if (tail === end) { // Unfinished single line comment.
                        result.push({
                            delimiter,
                            span: { start, length: tail - start },
                            contentStart: haveContent ? head : start,
                            state: StatementFinishState.OpenComment,
                        });
                        start = tail;
                        head = tail;

                        break;
                    }

                    if (!haveContent) {
                        head = tail;
                    }

                    break;
                }

                case '"':
                case "'":
                case "`": { // Quoted string/id. Skip this in a local loop.
                    haveContent = true;
                    const quote = sql[tail++];
                    while (tail < end && sql[tail] !== quote) {
                        // Skip any escaped character too.
                        if (sql[tail] === "\\") {
                            ++tail;
                        }
                        ++tail;
                    }

                    if (sql[tail] === quote) {
                        ++tail; // Skip trailing quote char if one was there.
                    } else { // Unfinished single string.
                        result.push({
                            delimiter,
                            span: { start, length: tail - start },
                            contentStart: haveContent ? head : start,
                            state: StatementFinishState.OpenString,
                        });
                        start = tail;
                        head = tail;
                    }

                    break;
                }

                case "d":
                case "D": {
                    // Possible start of the DELIMITER word. Also consider the mandatory space char.
                    if (tail + 10 >= end) {
                        if (!haveContent) {
                            haveContent = true;
                            head = tail;
                        }
                        ++tail;
                        break; // Not enough input for that.
                    }

                    const candidate = sql.substring(tail, tail + 10);
                    if (candidate.match(MySQLParsingServices.delimiterKeyword)) {
                        // Delimiter keyword found - get the new delimiter (all consecutive letters).
                        // But first push anything we found so far and haven't pushed yet.
                        if (haveContent && tail > start) {
                            result.push({
                                delimiter,
                                span: { start, length: tail - start },
                                contentStart: head,
                                state: StatementFinishState.NoDelimiter,
                            });
                            start = tail;
                        }

                        head = tail;
                        tail += 10;
                        let run = tail;

                        // Skip leading spaces + tabs.
                        while (run < end && (sql[run] === " " || sql[run] === "\t")) {
                            ++run;
                        }
                        tail = run;

                        // Forward to the first whitespace after the current position (on this line).
                        while (run < end && sql[run] !== "\n" && sql[run] !== " " && sql[run] !== "\t") {
                            ++run;
                        }

                        delimiter = sql.substring(tail, run);
                        const length = delimiter.length;
                        if (length > 0) {
                            tail += length - delimiter.length;

                            result.push({
                                delimiter,
                                span: { start, length: run - start },
                                contentStart: head,
                                state: StatementFinishState.DelimiterChange,
                            });

                            tail = run;
                            head = tail;
                            start = head;
                            haveContent = false;
                        } else {
                            haveContent = true;
                            head = tail;
                        }
                    } else {
                        ++tail;

                        if (!haveContent) {
                            haveContent = true;
                            head = tail;
                        }
                    }

                    break;
                }

                default:
                    if (!haveContent && sql[tail] > " ") {
                        haveContent = true;
                        head = tail;
                    }
                    ++tail;

                    break;
            }
        };

        if (serverVersion >= 80100) {
            while (tail < end) {
                if (!checkDelimiter()) {
                    // dollar-quoted string
                    if (sql[tail] === "$") {
                        haveContent = true;

                        const quote = "$";
                        let dollarQuoteStartStr = "";
                        let dollarQuoteEndStr = "";

                        // To find the string content between two dollar sign after AS keyword
                        const dollarQuoteStartIndex = sql.indexOf("$", tail + 1);

                        if (dollarQuoteStartIndex > 0) {
                            dollarQuoteStartStr = sql.substring(tail, dollarQuoteStartIndex + 1);
                            tail = dollarQuoteStartIndex + 1;
                        }

                        while (tail < end) {
                            if (sql[tail] === quote) {
                                // To find the string content between two dollar sign in the body or end
                                const dollarQuoteEndIndex = sql.indexOf("$", tail + 1);

                                if (dollarQuoteEndIndex > 0) {
                                    dollarQuoteEndStr = sql.substring(tail, dollarQuoteEndIndex + 1);
                                    tail = dollarQuoteEndIndex;
                                }

                                if (dollarQuoteStartStr !== dollarQuoteEndStr) {
                                    dollarQuoteEndStr = "";
                                } else {
                                    break;
                                }
                            }
                            ++tail;
                        }

                        if (sql[tail] === quote) {
                            ++tail;
                        } else {
                            result.push({
                                delimiter,
                                span: { start, length: tail - start },
                                contentStart: haveContent ? head : start,
                                state: StatementFinishState.OpenString,
                            });
                            start = tail;
                            head = tail;
                        }
                    } else {
                        handleStringsCommentsAndDelimiter();
                    }
                }
            }
        } else {
            while (tail < end) {
                if (!checkDelimiter()) {
                    handleStringsCommentsAndDelimiter();
                }
            }
        }

        // Add remaining text to the range list.
        if (head < end) {
            result.push({
                span: { start, length: end - start },
                contentStart: haveContent ? head : start - 1, // -1 to indicate no content
                state: StatementFinishState.NoDelimiter,
            });
        } else if (head > start) {
            // Last statement consists solely of whitespaces and/or comments.
            // Which also means haveContent is false.
            result.push({
                span: { start, length: end - start },
                contentStart: start - 1,
                state: StatementFinishState.NoDelimiter,
            });
        }

        return result;
    }

    public determineQueryType(sql: string, serverVersion: number): QueryType {
        this.lexer.serverVersion = serverVersion;
        this.errors = [];
        this.lexer.inputStream = CharStream.fromString(sql);

        return this.lexer.determineQueryType();
    }

    /**
     * Returns the index of the statement that covers the given line.
     *
     * @param offset The character offset to search for.
     * @param list A list of statement ranges to search through.
     * @param strict If true then whitespaces before a statement belong to that statement, otherwise to the
     *               previous statement.
     *
     * @returns The index of the found statement or -1 if there's none at the given position.
     */
    public statementIndexFromPosition(offset: number, list: TextSpan[], strict: boolean): number {
        let low = 0;
        let high = list.length - 1;
        while (low < high) {
            const middle = low + (high - low + 1) / 2;
            if (list[middle].start > offset) {
                high = middle - 1;
            } else {
                const end = list[low].start + list[low].length;
                if (end >= offset) {
                    break;
                }
                low = middle;
            }
        }

        if (low === list.length) {
            return -1;
        }

        // If we are between two statements (in white spaces) then the algorithm above returns the lower one.
        if (strict) {
            if (list[low].start + list[low].length < offset) {
                ++low;
            }

            if (low === list.length) {
                return -1;
            }
        }

        return low;
    }

    /**
     * Parses the query (which must be a SELECT) to see if it is valid and applies a number of transformations,
     * depending on the parameters:
     * - If there's no top-level limit clause, then one is added.
     * - If indicated adds an optimizer hint to use the secondary engine (usually HeatWave).
     *
     * Furthermore the query is checked if it can be updated, which requires a number of conditions
     * (e.g. no join or union parts).
     *
     * @param query The query to check and modify.
     * @param serverVersion The version of MySQL to use for checking.
     * @param sqlMode The current SQL mode in the server.
     * @param offset The limit offset to add.
     * @param count The row count value to add.
     * @param forceSecondaryEngine Add the optimizer hint.
     *
     * @returns The rewritten query if the original query is error free and contained no top-level LIMIT clause.
     *          Otherwise the original query is returned.
     */
    public preprocessStatement(query: string, serverVersion: number, sqlMode: string, offset: number,
        count: number, forceSecondaryEngine?: boolean): IPreprocessResult {

        this.applyServerDetails(serverVersion, sqlMode);
        const tree = this.startParsing(query, false, MySQLParseUnit.Generic) as QueryContext;
        if (!tree || this.errors.length > 0) {
            return { query, changed: false, updatable: false };
        }

        const rewriter = new TokenStreamRewriter(this.tokenStream);

        // LIMIT clause.
        let changed = false;
        const expressions = XPath.findAll(tree, "/query/simpleStatement//queryExpression", this.parser);
        if (expressions.size > 0) {
            // There can only be one top-level query expression where we can add a LIMIT clause.
            const candidate: ParseTree = expressions.values().next().value;

            // Check if the candidate comes from a subquery.
            let run: ParseTree | null = candidate;
            let invalid = false;
            while (run) {
                if (run instanceof SubqueryContext) {
                    invalid = true;
                    break;
                }

                run = run.parent;
            }

            if (!invalid && candidate instanceof QueryExpressionContext) {
                // Top level query expression here. Check if there's already a LIMIT clause before adding one.
                if (!candidate.limitClause() && candidate.stop) {
                    // OK, ready to add an own limit clause.
                    rewriter.insertAfter(candidate.stop, ` LIMIT ${offset}, ${count}`);
                    changed = true;
                }
            }
        }

        const updatable = this.isUpdatable(tree);
        const specification = XPath.findAll(tree, "/query/simpleStatement/*/queryExpression/*/" +
            "queryPrimary/querySpecification", this.parser) as Set<QuerySpecificationContext>;
        let fullTableName = "";

        if (specification.size > 0) {
            const [context] = specification;

            // Optimizer hint.
            if (forceSecondaryEngine) {
                rewriter.insertAfter(context.SELECT_SYMBOL().symbol, " /*+ SET_VAR(use_secondary_engine = FORCED) */");
                changed = true;
            }

            if (updatable) {
                // Extract the name of the table to update.
                const fromClauses = XPath.findAll(context, "//fromClause", this.parser) as Set<FromClauseContext>;
                if (fromClauses.size === 1) {
                    const [fromClause] = fromClauses;
                    const tableFactors = XPath.findAll(fromClause, "//tableReferenceList/tableReference/tableFactor",
                        this.parser) as Set<TableFactorContext>;
                    if (tableFactors.size === 1) {
                        const [tableFactor] = tableFactors;
                        let singleTable;
                        if (tableFactor.singleTable()) {
                            singleTable = tableFactor.singleTable()!;
                        } else if (tableFactor.singleTableParens()) {
                            singleTable = tableFactor.singleTableParens()!.singleTable()!;
                        }
                        fullTableName = singleTable?.tableRef().getText() ?? "";
                    }
                }
            }
        }

        return { query: rewriter.getText(), changed, updatable, fullTableName };
    }

    /**
     * Parses the query to see if it contains a ending semicolon (keep in mind there can be a trailing comment).
     * If no semicolon exists one is added.
     *
     * @param query The query to check and modify.
     * @param serverVersion The version of MySQL to use for checking.
     * @param sqlMode The current SQL mode in the server.
     *
     * @returns The rewritten query if the original query is error free and contained no semicolon.
     *          Otherwise the original query is returned.
     */
    public checkAndAddSemicolon(query: string, serverVersion: number, sqlMode: string): [string, boolean] {
        this.applyServerDetails(serverVersion, sqlMode);
        const tree = this.startParsing(query, false, MySQLParseUnit.Generic);
        if (!tree || this.errors.length > 0) {
            return [query, false];
        }

        const rewriter = new TokenStreamRewriter(this.tokenStream);
        let changed = false;
        const expressions = XPath.findAll(tree, "/query", this.parser);
        if (expressions.size > 0) {
            // There can only be one top-level query.
            const candidate: ParseTree = expressions.values().next().value;

            // Top level query expression here. Check if there's already a LIMIT clause before adding one.
            const context = candidate as QueryContext;
            if (!context.SEMICOLON_SYMBOL()) {
                const statementContext = context.simpleStatement();
                if (statementContext && statementContext.stop) {
                    rewriter.insertAfter(statementContext.stop, ";");
                    changed = true;
                }
            }
        }

        return [rewriter.getText(), changed];
    }

    /**
     * Examines the given query text if there are embedded parameters
     * (like in `select * from actor where actor_id = ? /*:name=value* /`)
     *
     * @param sql The query to examine.
     * @param serverVersion The version of MySQL to use for checking.
     * @param sqlMode The current SQL mode in the server.
     *
     * @returns The list of found parameters. The first entry in each pair represents the parameter name , while
     *          the second entry represents the set value. Both can be empty.
     */
    public extractQueryParameters(sql: string, serverVersion: number, sqlMode: string): Array<[string, string]> {
        const result: Array<[string, string]> = [];

        this.applyServerDetails(serverVersion, sqlMode);
        this.errors = [];
        this.lexer.inputStream = CharStream.fromString(sql);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        const tokens = this.tokenStream.getTokens();
        for (const token of tokens) {
            switch (token.type) {
                case MySQLMRSLexer.POUND_COMMENT:
                case MySQLMRSLexer.BLOCK_COMMENT: {
                    let text = token.text;
                    if (text) {
                        if (token.type === MySQLMRSLexer.POUND_COMMENT) {
                            text = text.substring(1);
                        } else {
                            text = text.substring(2, text.length - 2);
                        }

                        if (text.length > 0) {
                            switch (text[0]) {
                                case "=": {
                                    result.push(["", text.substring(1)]);
                                    break;
                                }

                                case ":": {
                                    const index = text.indexOf("=");
                                    if (index > -1) {
                                        result.push([
                                            text.substring(1, index),
                                            text.substring(index + 1),
                                        ]);
                                    }

                                    break;
                                }

                                default: {
                                    break;
                                }
                            }
                        }
                    }

                    break;
                }

                default: {
                    break;
                }
            }
        }

        return result;
    }

    /**
     * This is the method to parse text. Depending on fast mode it creates a syntax tree and otherwise
     * bails out if an error was found, asap.
     *
     * @param text The text to parse.
     * @param fast If true use fast mode (no parse tree creation, fast bail out in case of errors).
     * @param unit The type of input to parse.
     *
     * @returns A parse tree if enabled.
     */
    private startParsing(text: string, fast: boolean, unit: MySQLParseUnit): ParseTree | undefined {
        this.errors = [];
        this.lexer.inputStream = CharStream.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);

        this.parser.reset();
        this.parser.buildParseTrees = true; // !fast;

        // First parse with the bail error strategy to get quick feedback for correct queries.
        this.parser.errorHandler = new BailErrorStrategy();
        this.parser.interpreter.predictionMode = PredictionMode.SLL;

        /*
        this.tokenStream.fill();
        const tokens = this.tokenStream.getTokens();
        tokens.forEach((token) => {
            console.log(token.toString());
        }); // */

        try {
            this.tree = this.parseUnit(unit);
        } catch (e) {
            if (e instanceof ParseCancellationException) {
                // Even in fast mode we have to do a second run if we got no error yet (BailErrorStrategy
                // does not do full processing).
                if (fast && this.errors.length > 0) {
                    this.tree = undefined;
                } else {
                    // If parsing was canceled we either really have a syntax error or we need to do a second step,
                    // now with the default strategy and LL parsing.
                    this.tokenStream.seek(0);
                    this.parser.reset();
                    this.errors = [];
                    this.parser.errorHandler = new DefaultErrorStrategy();
                    this.parser.interpreter.predictionMode = PredictionMode.LL;
                    this.tree = this.parseUnit(unit);
                }
            } else {
                throw e;
            }
        }

        /*
        if (this.tree instanceof ParserRuleContext) {
            console.log(this.tree.toStringTree(null, this.parser));
        } // */

        return this.tree;
    }

    /**
     * Starts a single parse run for a given input type.
     *
     * @param unit The type of input to parse.
     *
     * @returns A parse tree, if enabled.
     */
    private parseUnit(unit: MySQLParseUnit): ParseTree | undefined {
        switch (unit) {
            case MySQLParseUnit.CreateRoutine:
                return this.parser.createRoutine();

            case MySQLParseUnit.DataType:
                return this.parser.dataTypeDefinition();

            default: // Generic.
                return this.parser.query();
        }
    }

    private applyServerDetails(serverVersion: number, sqlMode: string): void {
        this.lexer.serverVersion = serverVersion;
        this.lexer.sqlModeFromString(sqlMode);
        this.parser.serverVersion = serverVersion;
        this.parser.sqlModes = this.lexer.sqlModes;
    }

    /**
     * Converts the lexer token type to a scope name.
     *
     * @param token The token to convert.
     * @param serverVersion The version of MySQL to use for checking.
     *
     * @returns The scope name.
     */
    private async lexerTypeToScope(token: Token, serverVersion: MySQLVersion): Promise<string> {
        switch (token.type) {
            case MySQLMRSLexer.AT_TEXT_SUFFIX: {
                return "variable.language";
            }

            case MySQLMRSLexer.AT_AT_SIGN_SYMBOL: {
                return "variable.predefined";
            }

            case MySQLMRSLexer.SINGLE_QUOTED_TEXT: {
                return "string.quoted.single";
            }

            case MySQLMRSLexer.DOLLAR_QUOTED_STRING_TEXT:
            case MySQLMRSLexer.DOUBLE_QUOTED_TEXT: {
                return "string.quoted.double";
            }

            case MySQLMRSLexer.BLOCK_COMMENT:
            case MySQLMRSLexer.INVALID_BLOCK_COMMENT:
            case MySQLMRSLexer.VERSION_COMMENT_START:
            case MySQLMRSLexer.VERSION_COMMENT_END: {
                return "comment.block";
            }

            // cspell:ignore DASHDASH
            case MySQLMRSLexer.POUND_COMMENT:
            case MySQLMRSLexer.DASHDASH_COMMENT: {
                return "comment.line";
            }

            case MySQLMRSLexer.INVALID_INPUT: {
                return "invalid";
            }

            default: {
                if (this.lexer.isNumber(token.type)) {
                    return "number";
                }

                if (this.lexer.isOperator(token.type)) {
                    return "operator";
                }

                if (this.lexer.isDelimiter(token.type)) {
                    return "delimiter";
                }

                const name = token.text!;
                if (isKeyword(name, serverVersion)) {
                    if (name.length > 2) {
                        const info = await this.globalSymbols.getSymbolInfo(name.toLowerCase());
                        if (info) {
                            switch (info.kind) {
                                case SymbolKind.SystemFunction: {
                                    return "support.function";
                                }

                                case SymbolKind.SystemVariable: {
                                    return "variable.predefined";
                                }

                                default:
                            }
                        }
                    }

                    return "keyword";
                }

                if (this.lexer.isIdentifier(token.type)) {
                    if (name.length > 2) {
                        const info = await this.globalSymbols.getSymbolInfo(name.toLocaleLowerCase());
                        if (info) {
                            switch (info.kind) {
                                case SymbolKind.SystemFunction: {
                                    return "support.function";
                                }

                                case SymbolKind.SystemVariable: {
                                    return "variable.predefined";
                                }

                                default:
                            }
                        }
                    }

                    return "identifier";
                }

                return "";
            }
        }
    }

    /**
     * Inspects the given tree to see if it represents an updatable query.
     *
     * @param tree The query tree to inspect.
     *
     * @returns True if the query is updatable, otherwise false.
     */
    private isUpdatable(tree: QueryContext): boolean {
        const select = tree.simpleStatement()?.selectStatement();
        let updatable = select != null;
        if (!select || select.selectStatementWithInto() || select?.lockingClauseList()) {
            updatable = false;
        } else {
            const expression = select.queryExpression()!; // Must be assigned at this point.
            if (expression.withClause()) {
                updatable = false;
            } else {
                const body = expression.queryExpressionBody();
                if (body.UNION_SYMBOL().length > 0 || body.INTERSECT_SYMBOL().length > 0
                    || body.EXCEPT_SYMBOL().length > 0 || !body.queryPrimary()) {
                    updatable = false;
                } else {
                    const spec = body.queryPrimary()?.querySpecification();
                    if (!spec || spec.selectOption().length > 0 || spec.intoClause() || spec.intoClause()
                        || spec.groupByClause() || spec.havingClause() || spec.windowClause()) {
                        updatable = false;
                    } else if (!spec.fromClause() || spec.fromClause()?.DUAL_SYMBOL()) {
                        updatable = false;
                    } else {
                        const tableRefList = spec.fromClause()!.tableReferenceList()!;
                        if (tableRefList.tableReference().length > 1) {
                            // More than one table reference.
                            updatable = false;
                        } else {
                            const ref = tableRefList.tableReference()[0];
                            if (ref.joinedTable().length > 0 || ref.OPEN_CURLY_SYMBOL()) {
                                // No joins or ODBC tables.
                                updatable = false;
                            } else if (ref.tableFactor()?.singleTable() || ref.tableFactor()?.singleTableParens()) {
                                // Having all the table related stuff checked, we can focus now on the select list.
                                // There can either be a wildcard or a list of expressions.
                                if (!spec.selectItemList().MULT_OPERATOR()) {
                                    // Each select item must consist solely of a column reference.
                                    for (const item of spec.selectItemList().selectItem()) {
                                        if (item.tableWild()) {
                                            // Also table wildcards do not prevent the query from being updatable.
                                            continue;
                                        }

                                        // Only direct column references are allowed.
                                        const columnRef = XPath.findAll(item,
                                            "/selectItem/expr/boolPri/predicate/bitExpr/simpleExpr/columnRef",
                                            this.parser);
                                        if (columnRef.size !== 1) {
                                            updatable = false;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return updatable;
    }

}
