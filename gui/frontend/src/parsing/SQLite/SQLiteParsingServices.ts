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

/* eslint-disable no-underscore-dangle, @typescript-eslint/naming-convention */

import {
    BailErrorStrategy, CharStreams, CommonTokenStream, DefaultErrorStrategy, ParseCancellationException, ParseTree,
    PredictionMode, TokenStreamRewriter, XPath, Token,
} from "antlr4ng";

import {
    ICompletionData, IParserErrorInfo, IStatementSpan, ISymbolInfo, ITokenInfo, QueryType, StatementFinishState,
    tokenFromPosition,
} from "../parser-common";

import { SQLiteErrorListener } from "./SQLiteErrorListener";
import { SQLiteLexer } from "./generated/SQLiteLexer";
import { SQLiteParser, Select_stmtContext, Sql_stmt_listContext } from "./generated/SQLiteParser";
import { getCodeCompletionItems } from "./SqliteCodeCompletion";

import { unquote } from "../../utilities/string-helpers";
import { DBSymbolTable, SystemFunctionSymbol } from "../DBSymbolTable";
import { SQLiteVersion, determineQueryType, isKeyword } from "./SQLiteRecognizerCommon";

// This file contains the main interface to all language services for SQLite.

export class SQLiteParsingServices {
    private static services?: SQLiteParsingServices;
    private static readonly delimiterKeyword = /delimiter/i;

    private lexer = new SQLiteLexer(CharStreams.fromString(""));
    private tokenStream = new CommonTokenStream(this.lexer);
    private parser = new SQLiteParser(this.tokenStream);
    private errors: IParserErrorInfo[] = [];

    private tree: ParseTree | undefined;

    // Built-in functions for quick info retrieval. This is a duplicate of the global symbols
    // loaded in SQLiteWorker.ts, but we cannot use that as this services runs in a web worker.
    private globalSymbols: DBSymbolTable;

    private errorListener = new SQLiteErrorListener(
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

        this.parser.removeParseListeners();
        this.parser.removeErrorListeners();
        this.parser.addErrorListener(this.errorListener);

        this.globalSymbols = new DBSymbolTable("globals", {});
        void import("./data/builtin-functions.json").then((systemFunctions) => {
            Object.keys(systemFunctions.default).forEach((name: string) => {
                this.globalSymbols
                    .addNewSymbolOfType(SystemFunctionSymbol, undefined, name, systemFunctions[name] as []);
            });
        });
    }

    /**
     * Creates the parsing services instance on demand. This involves loading certain data files.
     *
     * @returns The singleton instance of the parsing services.
     */
    public static get instance(): SQLiteParsingServices {
        if (!SQLiteParsingServices.services) {
            SQLiteParsingServices.services = new SQLiteParsingServices();
        }

        return SQLiteParsingServices.services;
    }

    /**
     * Quick check for syntax errors.
     *
     * @param text The text to parse.
     *
     * @returns True if no error was found, otherwise false.
     */
    public errorCheck(text: string): boolean {
        this.startParsing(text, true);

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
     *
     * @returns The information about the symbol at the given offset, if there's one.
     */
    public async getQuickInfo(text: string, offset: number): Promise<ISymbolInfo | undefined> {
        this.errors = [];
        this.lexer.inputStream = CharStreams.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        const token = tokenFromPosition(this.tokenStream, offset);
        if (token) {
            this.tokenStream.seek(token.tokenIndex);
            const tokenText = token.text || "";
            switch (token.type) {
                case SQLiteLexer.IDENTIFIER: {
                    // Possible built-in functions.
                    const info = await this.globalSymbols.getSymbolInfo(tokenText.toLowerCase());
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

        return undefined;
    }

    /**
     * Creates a list of token info items for the given text.
     *
     * @param text The text to handle.
     *
     * @returns The information about the symbol at the given offset, if there's one.
     */
    public tokenize(text: string): ITokenInfo[] {
        this.errors = [];
        this.lexer.inputStream = CharStreams.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);
        this.tokenStream.fill();

        return this.tokenStream.getTokens().map((token: Token) => {
            return {
                type: this.lexerTypeToScope(token),
                offset: token.start,
                line: token.line,
                column: token.column,
                length: token.stop - token.start + 1,
            };
        });
    }

    /**
     * Determines completion items at the given position.
     *
     * @param text The input to handle.
     * @param offset The character position in the input to start from.
     * @param line Line position of the invocation.
     * @param column Column position of the invocation.
     * @param defaultSchema The schema to be used if there's none specified in the text.
     *
     * @returns A structure describing the completion items which much be shown.
     */
    public getCompletionsAtPosition(text: string, offset: number, line: number,
        column: number, defaultSchema: string): ICompletionData {

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
     * length and current delimiter for each.
     * Note: the length includes anything up to (and including) the delimiter position.
     *
     * @param sql The SQL to split.
     * @param delimiter The initial delimiter to use.
     *
     * @returns A list of statement ranges.
     */
    public determineStatementRanges(sql: string, delimiter = ";"): IStatementSpan[] {

        const result: IStatementSpan[] = [];

        let start = 0;
        let head = start;
        let tail = head;
        const end = head + sql.length;

        let haveContent = false; // Set when anything else but comments were found for the current statement.

        while (tail < end) {
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
                                    contentStart: haveContent ? head : start - 1,
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
                                contentStart: haveContent ? head : start - 1,
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
                            contentStart: haveContent ? head : start - 1,
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
                            contentStart: haveContent ? head : start - 1,
                            state: StatementFinishState.OpenString,
                        });
                        start = tail;
                        head = tail;
                    }

                    break;
                }

                case "d":
                case "D": {
                    // Possible start of the DELIMITER word.
                    if (!haveContent) {
                        haveContent = true;
                        head = tail;
                    }
                    haveContent = true;

                    if (tail + 9 >= end) {
                        ++tail;
                        break; // Not enough input for that.
                    }

                    const candidate = sql.substring(tail, tail + 9);
                    if (candidate.match(SQLiteParsingServices.delimiterKeyword)) {
                        // Delimiter keyword found - get the new delimiter (everything until the end of the line).
                        // But first push anything we found so far and haven't pushed yet.
                        if (tail > start) {
                            result.push({
                                delimiter,
                                span: { start, length: tail - start },
                                contentStart: head,
                                state: StatementFinishState.NoDelimiter,
                            });
                        }

                        tail += 10; // Length of "delimiter" and a space char.
                        let run = tail;
                        while (run < end && sql[run] !== "\n") {
                            ++run;
                        }
                        delimiter = sql.substring(tail, run).trimRight(); // Remove trailing whitespaces.

                        result.push({
                            delimiter,
                            span: { start, length: run - start },
                            contentStart: haveContent ? head : start - 1,
                            state: StatementFinishState.DelimiterChange,
                        });

                        tail = run;
                        head = tail;
                        start = head;
                        haveContent = false;
                    } else {
                        ++tail;
                    }

                    break;
                }

                default:
                    if (sql[tail] === delimiter[0]) {
                        // Found possible start of the delimiter. Check if it really is.
                        if (delimiter.length === 1) {
                            // Most common case.
                            ++tail;
                            result.push({
                                delimiter,
                                span: { start, length: tail - start },
                                contentStart: haveContent ? head : start - 1,
                                state: StatementFinishState.Complete,
                            });

                            head = tail;
                            start = head;
                            haveContent = false;
                        } else {
                            // Multi character delimiter?
                            const candidate = sql.substring(tail, tail + delimiter.length);
                            if (candidate === delimiter) {
                                // Multi char delimiter is complete. Tail still points to the start of the delimiter.
                                tail += delimiter.length;
                                result.push({
                                    delimiter,
                                    span: { start, length: tail - start },
                                    contentStart: haveContent ? head : start - 1,
                                    state: StatementFinishState.Complete,
                                });

                                head = tail;
                                start = head;
                                haveContent = false;
                            } else {
                                // Not a delimiter.
                                ++tail;
                                if (!haveContent) {
                                    haveContent = true;
                                    head = tail;
                                }
                            }
                        }
                    } else {
                        if (!haveContent && sql[tail] > " ") {
                            haveContent = true;
                            head = tail;
                        }
                        ++tail;
                    }

                    break;
            }

        }

        // Add remaining text to the range list.
        if (head < end) {
            result.push({
                delimiter: "",
                span: { start, length: end - start },
                contentStart: haveContent ? head : start - 1, // -1 to indicate no content
                state: StatementFinishState.NoDelimiter,
            });
        }

        return result;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public determineQueryType(sql: string, serverVersion: number): QueryType {
        this.errors = [];
        this.lexer.inputStream = CharStreams.fromString(sql);
        this.tokenStream.setTokenSource(this.lexer);

        return determineQueryType(this.tokenStream);
    }

    /**
     * Parses the query to see if it is valid and applies a number of transformations, depending on the parameters:
     * - If there's no top-level limit clause, then one is added.
     * - If indicated adds an optimizer hint to use the secondary engine (usually HeatWave).
     *
     * @param query The query to check and modify.
     * @param serverVersion The version of MySQL to use for checking (not used for SQLite).
     * @param sqlMode The current SQL mode in the server (not used for SQLite).
     * @param offset The limit offset to add.
     * @param count The row count value to add.
     * @param forceSecondaryEngine Add the optimizer hint (not used for SQLite).
     *
     * @returns The rewritten query if the original query is error free and contained no top-level LIMIT clause.
     *          Otherwise the original query is returned. Additionally, a flag is returned telling if the query
     *          was actually changed or not.
     */
    public preprocessStatement(query: string, serverVersion: number, sqlMode: string, offset: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        count: number, forceSecondaryEngine?: boolean): [string, boolean] {
        const tree = this.startParsing(query, false);
        if (!tree || this.errors.length > 0) {
            return [query, false];
        }

        const rewriter = new TokenStreamRewriter(this.tokenStream);
        const statements = XPath.findAll(tree, "/parse/sql_stmt_list/sql_stmt/select_stmt", this.parser);
        let changed = false;
        if (statements.size > 0) {
            // There can only be one such statement.
            const candidate: ParseTree = statements.values().next().value;

            // Top level query expression here. Check if there's already a LIMIT clause before adding one.
            const context = candidate as Select_stmtContext;
            if (!context.limit_stmt() && context.stop) {
                // OK, ready to add an own limit clause.
                rewriter.insertAfter(context.stop, ` LIMIT ${offset}, ${count}`);
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
     * @param serverVersion The version of MySQL to use for checking (not used for SQLite).
     * @param sqlMode The current SQL mode in the server (not used for SQLite).
     *
     * @returns The rewritten query if the original query is error free and contained no semicolon.
     *          Otherwise the original query is returned.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public checkAndAddSemicolon(query: string, serverVersion: number, sqlMode: string): [string, boolean] {
        const tree = this.startParsing(query, false);
        if (!tree || this.errors.length > 0) {
            return [query, false];
        }

        const rewriter = new TokenStreamRewriter(this.tokenStream);
        const expressions = XPath.findAll(tree, "/sql_stmt_list", this.parser);
        let changed = false;
        if (expressions.size > 0) {
            // There can only be one top-level query.
            const candidate: ParseTree = expressions.values().next().value;

            // Top level query expression here. Check if there's already a LIMIT clause before adding one.
            const context = candidate as Sql_stmt_listContext;

            // There can be multiple semicolons in this context, so we have to check the last one.
            if (context.stop && context.stop.type !== SQLiteLexer.SCOL) {
                rewriter.insertAfter(context.stop, ";");
                changed = true;
            }
        }

        return [rewriter.getText(), changed];
    }

    /**
     * Examines the given query text if there are embedded parameters. Currently that's used only for MySQL code.
     * (like in `select * from actor where actor_id = ? /*=1* /`)
     *
     * @param sql The query to examine.
     * @param serverVersion The version of MySQL to use for checking.
     * @param sqlMode The current SQL mode in the server.
     *
     * @returns The list of found parameters. The first entry in each pair represents the parameter name and can be
     *          empty if not given, while the second entry represents the set value.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public extractQueryParameters(sql: string, serverVersion: number, sqlMode: string): Array<[string, string]> {
        const result: Array<[string, string]> = [];

        return result;
    }

    /**
     * This is the method to parse text. Depending on fast mode it creates a syntax tree and otherwise
     * bails out if an error was found, asap.
     *
     * @param text The text to parse.
     * @param fast If true use fast mode (no parse tree creation, fast bail out in case of errors).
     *
     * @returns A parse tree if enabled.
     */
    private startParsing(text: string, fast: boolean): ParseTree | undefined {
        this.errors = [];
        this.lexer.inputStream = CharStreams.fromString(text);
        this.tokenStream.setTokenSource(this.lexer);

        this.parser.reset();
        this.parser.buildParseTrees = !fast;

        // First parse with the bail error strategy to get quick feedback for correct queries.
        this.parser.errorHandler = new BailErrorStrategy();
        this.parser.interpreter.predictionMode = PredictionMode.SLL;

        try {
            this.tree = this.parser.parse();
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
                    this.tree = this.parser.parse();
                }
            } else {
                throw e;
            }
        }

        return this.tree;
    }

    /**
     * Converts the lexer token type to a scope name.
     *
     * @param token The token to convert.
     *
     * @returns The scope name.
     */
    private lexerTypeToScope(token: Token): string {
        if (isKeyword(token.text ?? "", SQLiteVersion.Standard)) {
            return "keyword";
        }

        if (this.lexer.isIdentifier(token.type)) {
            return "identifier";
        }

        if (this.lexer.isNumber(token.type)) {
            return "number";
        }

        if (this.lexer.isOperator(token.type)) {
            return "operator";
        }

        if (this.lexer.isDelimiter(token.type)) {
            return "delimiter";
        }

        switch (token.type) {
            case SQLiteLexer.STRING_LITERAL: {
                return "string";
            }

            case SQLiteLexer.MULTILINE_COMMENT: {
                return "comment.block";
            }

            case SQLiteLexer.SINGLE_LINE_COMMENT: {
                return "comment.line";
            }

            case SQLiteLexer.UNEXPECTED_CHAR: {
                return "invalid";
            }

            default: {
                return "";
            }
        }
    }
}
