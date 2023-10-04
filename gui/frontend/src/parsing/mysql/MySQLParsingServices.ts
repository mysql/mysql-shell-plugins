/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

// This file contains the main interface to all language services for MySQL.

/* eslint-disable no-underscore-dangle */

import {
    BailErrorStrategy, CharStreams, CommonTokenStream, DefaultErrorStrategy, ParseCancellationException,
    ParseTree, PredictionMode, TokenStreamRewriter, XPath,
} from "antlr4ng";

import { MySQLMRSLexer } from "./generated/MySQLMRSLexer";
import {
    MySQLMRSParser, QueryContext, QueryExpressionContext, QuerySpecificationContext, SubqueryContext,
} from "./generated/MySQLMRSParser";

import { MySQLErrorListener } from "./MySQLErrorListener";
import { MySQLParseUnit } from "./MySQLServiceTypes";
import {
    ICompletionData, IParserErrorInfo, IStatementSpan, ISymbolInfo, QueryType, StatementFinishState, TextSpan,
    tokenFromPosition,
} from "../parser-common";

import { SystemVariableSymbol, SystemFunctionSymbol, DBSymbolTable } from "../DBSymbolTable";
import { getCodeCompletionItems } from "./MySQLCodeCompletion";
import { unquote } from "../../utilities/string-helpers";

export class MySQLParsingServices {

    private static services?: MySQLParsingServices;
    private static readonly delimiterKeyword = /delimiter /i;

    private lexer = new MySQLMRSLexer(CharStreams.fromString(""));
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
            Object.keys(rdbmsInfo.characterSets).forEach((set: string) => {
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
        this.lexer.inputStream = CharStreams.fromString(text);
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
     * Determines completion items at the given position.
     *
     * @param text The input to handle.
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
        this.lexer.inputStream = CharStreams.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        let isQuoted = false;
        const token = tokenFromPosition(this.tokenStream, offset);
        if (token) {
            const tokenText = token.text.trim();
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
     *
     * @returns A list of statement ranges.
     */
    public determineStatementRanges(sql: string, delimiter: string): IStatementSpan[] {

        const result: IStatementSpan[] = [];

        let start = 0;
        let head = start;
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

        while (tail < end) {
            if (!checkDelimiter()) {
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
                        if (sql[tail + 1] === "-" && (sql[temp] === " " || sql[temp] === "\t" || sql[temp] === "\n")) {
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
            }
        }

        // Add remaining text to the range list.
        if (head < end) {
            result.push({
                span: { start, length: end - start },
                contentStart: haveContent ? head : start - 1, // -1 to indicate no content
                state: StatementFinishState.NoDelimiter,
            });
        }

        return result;
    }

    public determineQueryType(sql: string, serverVersion: number): QueryType {
        this.lexer.serverVersion = serverVersion;
        this.errors = [];
        this.lexer.inputStream = CharStreams.fromString(sql);

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
     * Parses the query to see if it is valid and applies a number of transformations, depending on the parameters:
     * - If there's no top-level limit clause, then one is added.
     * - If indicated adds an optimizer hint to use the secondary engine (usually HeatWave).
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
        count: number, forceSecondaryEngine?: boolean): [string, boolean] {

        this.applyServerDetails(serverVersion, sqlMode);
        const tree = this.startParsing(query, false, MySQLParseUnit.Generic);
        if (!tree || this.errors.length > 0) {
            return [query, false];
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

        // Optimizer hint.
        if (forceSecondaryEngine) {
            const specification = XPath.findAll(tree, "/query/simpleStatement/*/queryExpression/*/" +
                "queryPrimary/querySpecification", this.parser);

            if (specification.size > 0) {
                const context = specification.values().next().value as QuerySpecificationContext;
                rewriter.insertAfter(context.SELECT_SYMBOL()!.symbol, " /*+ SET_VAR(use_secondary_engine = FORCED) */");
                changed = true;
            }
        }

        return [rewriter.getText(), changed];
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
        this.lexer.inputStream = CharStreams.fromString(sql);
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
        this.lexer.inputStream = CharStreams.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);

        this.parser.reset();
        this.parser.buildParseTrees = !fast;

        // First parse with the bail error strategy to get quick feedback for correct queries.
        this.parser.errorHandler = new BailErrorStrategy();
        this.parser.interpreter.predictionMode = PredictionMode.SLL;

        /*this.tokenStream.fill();
        const tokens = this.tokenStream.getTokens();
        tokens.forEach((token) => {
            console.log(token.toString());
        });*/

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
}
