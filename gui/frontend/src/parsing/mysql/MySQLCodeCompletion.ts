/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

// cspell: disable

import { CandidatesCollection, CodeCompletionCore } from "antlr4-c3";
import { BufferedTokenStream, CommonTokenStream, CharStreams } from "antlr4ts";
import { ParseTreeWalker, ParseTreeListener } from "antlr4ts/tree";

import { MySQLLexer } from "./generated/MySQLLexer";
import { MySQLParser } from "./generated/MySQLParser";

import { Stack } from "../../supplement/Stack";
import { ICompletionData, LanguageCompletionKind, QueryType, Scanner } from "../parser-common";
import { MySQLTableRefListener } from "./MySQLTableRefListener";

import { unquote } from "../../utilities/string-helpers";

enum ObjectFlags {
    // For 3 part identifiers.
    ShowSchemas = 1 << 0,
    ShowTables = 1 << 1,
    ShowColumns = 1 << 2,

    // For 2 part identifiers.
    ShowFirst = 1 << 3,
    ShowSecond = 1 << 4,
}

export interface ITableReference {
    schema: string;
    table: string;
    alias: string;
}

export type CompletionSortKeys = Map<LanguageCompletionKind, string>;

const synonyms: Map<number, string[]> = new Map([
    [MySQLLexer.CHAR_SYMBOL, ["CHARACTER"]],
    [MySQLLexer.NOW_SYMBOL, ["CURRENT_TIMESTAMP", "LOCALTIME", "LOCALTIMESTAMP"]],
    [MySQLLexer.DAY_SYMBOL, ["DAYOFMONTH"]],
    [MySQLLexer.DECIMAL_SYMBOL, ["DEC"]],
    [MySQLLexer.DISTINCT_SYMBOL, ["DISTINCTROW"]],
    [MySQLLexer.CHAR_SYMBOL, ["CHARACTER"]],
    [MySQLLexer.COLUMNS_SYMBOL, ["FIELDS"]],
    [MySQLLexer.FLOAT_SYMBOL, ["FLOAT4"]],
    [MySQLLexer.DOUBLE_SYMBOL, ["FLOAT8"]],
    [MySQLLexer.INT_SYMBOL, ["INTEGER", "INT4"]],
    [MySQLLexer.RELAY_THREAD_SYMBOL, ["IO_THREAD"]],
    [MySQLLexer.SUBSTRING_SYMBOL, ["MID"]],
    [MySQLLexer.MID_SYMBOL, ["MEDIUMINT"]],
    [MySQLLexer.MEDIUMINT_SYMBOL, ["MIDDLEINT"]],
    [MySQLLexer.NDBCLUSTER_SYMBOL, ["NDB"]],
    [MySQLLexer.REGEXP_SYMBOL, ["RLIKE"]],
    [MySQLLexer.DATABASE_SYMBOL, ["SCHEMA"]],
    [MySQLLexer.DATABASES_SYMBOL, ["SCHEMAS"]],
    [MySQLLexer.USER_SYMBOL, ["SESSION_USER"]],
    [MySQLLexer.STD_SYMBOL, ["STDDEV", "STDDEV"]],
    [MySQLLexer.SUBSTRING_SYMBOL, ["SUBSTR"]],
    [MySQLLexer.VARCHAR_SYMBOL, ["VARCHARACTER"]],
    [MySQLLexer.VARIANCE_SYMBOL, ["VAR_POP"]],
    [MySQLLexer.TINYINT_SYMBOL, ["INT1"]],
    [MySQLLexer.SMALLINT_SYMBOL, ["INT2"]],
    [MySQLLexer.MEDIUMINT_SYMBOL, ["INT3"]],
    [MySQLLexer.BIGINT_SYMBOL, ["INT8"]],
    [MySQLLexer.SECOND_SYMBOL, ["SQL_TSI_SECOND"]],
    [MySQLLexer.MINUTE_SYMBOL, ["SQL_TSI_MINUTE"]],
    [MySQLLexer.HOUR_SYMBOL, ["SQL_TSI_HOUR"]],
    [MySQLLexer.DAY_SYMBOL, ["SQL_TSI_DAY"]],
    [MySQLLexer.WEEK_SYMBOL, ["SQL_TSI_WEEK"]],
    [MySQLLexer.MONTH_SYMBOL, ["SQL_TSI_MONTH"]],
    [MySQLLexer.QUARTER_SYMBOL, ["SQL_TSI_QUARTER"]],
    [MySQLLexer.YEAR_SYMBOL, ["SQL_TSI_YEAR"]],
]);

// Context class for code completion results.
export class AutoCompletionContext {
    private static noSeparatorRequiredFor: Set<number> = new Set([
        MySQLLexer.EQUAL_OPERATOR,
        MySQLLexer.ASSIGN_OPERATOR,
        MySQLLexer.NULL_SAFE_EQUAL_OPERATOR,
        MySQLLexer.GREATER_OR_EQUAL_OPERATOR,
        MySQLLexer.GREATER_THAN_OPERATOR,
        MySQLLexer.LESS_OR_EQUAL_OPERATOR,
        MySQLLexer.LESS_THAN_OPERATOR,
        MySQLLexer.NOT_EQUAL_OPERATOR,
        MySQLLexer.NOT_EQUAL2_OPERATOR,
        MySQLLexer.PLUS_OPERATOR,
        MySQLLexer.MINUS_OPERATOR,
        MySQLLexer.MULT_OPERATOR,
        MySQLLexer.DIV_OPERATOR,
        MySQLLexer.MOD_OPERATOR,
        MySQLLexer.LOGICAL_NOT_OPERATOR,
        MySQLLexer.BITWISE_NOT_OPERATOR,
        MySQLLexer.SHIFT_LEFT_OPERATOR,
        MySQLLexer.SHIFT_RIGHT_OPERATOR,
        MySQLLexer.LOGICAL_AND_OPERATOR,
        MySQLLexer.BITWISE_AND_OPERATOR,
        MySQLLexer.BITWISE_XOR_OPERATOR,
        MySQLLexer.LOGICAL_OR_OPERATOR,
        MySQLLexer.BITWISE_OR_OPERATOR,
        MySQLLexer.DOT_SYMBOL,
        MySQLLexer.COMMA_SYMBOL,
        MySQLLexer.SEMICOLON_SYMBOL,
        MySQLLexer.COLON_SYMBOL,
        MySQLLexer.OPEN_PAR_SYMBOL,
        MySQLLexer.CLOSE_PAR_SYMBOL,
        MySQLLexer.OPEN_CURLY_SYMBOL,
        MySQLLexer.CLOSE_CURLY_SYMBOL,
        MySQLLexer.PARAM_MARKER,
    ]);

    public completionCandidates = new CandidatesCollection();

    // A flat list of possible references for easier lookup.
    public references: ITableReference[] = [];

    private caretIndex = 0;

    // A hierarchical view of all table references in the code, updated by visiting all relevant FROM clauses after
    // the candidate collection.
    // Organized as stack to be able to easily remove sets of references when changing nesting level.
    private referencesStack: Stack<ITableReference[]> = new Stack();

    public constructor(private parser: MySQLParser, private scanner: Scanner, private lexer: MySQLLexer) {
    }

    /**
     * Adds a new table reference to the top level reference stack entry.
     *
     * @param reference The reference to add.
     */
    public pushTableReference(reference: ITableReference): void {
        this.referencesStack.top?.push(reference);
    }

    /**
     * @returns True if there's at least one table reference on the references stack.
     */
    public get hasTableReference(): boolean {
        return !this.referencesStack.empty && this.referencesStack.top!.length > 0;
    }

    /**
     * Sets the given alias to the last entry in the top level reference stack element.
     *
     * @param alias The alias to set.
     */
    public setLastAlias(alias: string): void {
        if (this.referencesStack.length > 0 && this.referencesStack[0].length > 0) {
            this.referencesStack[0][this.referencesStack[0].length - 1].alias = alias;
        }
    }

    /**
     * Removes the TOS element of the reference stack.
     */
    public popReferenceList(): void {
        this.referencesStack.pop();
    }

    /**
     * Adds a new, empty TOS element onto the reference stack. Used when entering a sub query.
     */
    public pushNewReferenceList(): void {
        this.referencesStack.push([]);
    }

    /**
     * Determines the qualifier used for a qualified identifier with up to 2 parts (id or id.id).
     *
     * Note: it is essential to understand that we do the determination only up to the caret
     * (or the token following it, solely for getting a terminator). Since we cannot know the user's
     * intention, we never look forward.
     *
     * @returns Object containing a set of flags for required elements in code completion and the extracted qualifier.
     */
    public getQualifierInfo = (): { flags: ObjectFlags; qualifier: string } => {
        // Five possible positions here:
        //   - In the first id (including the position directly after the last char).
        //   - In the space between first id and a dot.
        //   - On a dot (visually directly before the dot).
        //   - In space after the dot, that includes the position directly after the dot.
        //   - In the second id.
        // All parts are optional (though not at the same time). The on-dot position is considered the same
        // as in first id as it visually belongs to the first id.

        const position = this.scanner.tokenIndex;

        if (this.scanner.tokenChannel !== 0) {
            this.scanner.next(); // First skip to the next non-hidden token.
        }

        if (!this.scanner.is(MySQLLexer.DOT_SYMBOL) && !this.lexer.isIdentifier(this.scanner.tokenType)) {
            // We are at the end of an incomplete identifier spec. Jump back, so that the other tests succeed.
            this.scanner.previous();
        }

        // Go left until we find something not related to an id or find at most 1 dot.
        if (position > 0) {
            if (this.lexer.isIdentifier(this.scanner.tokenType) && this.scanner.lookBack() === MySQLLexer.DOT_SYMBOL) {
                this.scanner.previous();
            }
            if (this.scanner.is(MySQLLexer.DOT_SYMBOL) && this.lexer.isIdentifier(this.scanner.lookBack())) {
                this.scanner.previous();
            }
        }

        // The scanner is now on the leading identifier or dot (if there's no leading id).
        let temp = "";
        if (this.lexer.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();
        }

        // Bail out if there is no more id parts or we are already behind the caret position.
        if (!this.scanner.is(MySQLLexer.DOT_SYMBOL) || position <= this.scanner.tokenIndex) {
            return { flags: ObjectFlags.ShowFirst | ObjectFlags.ShowSecond, qualifier: "" };
        }

        return { flags: ObjectFlags.ShowSecond, qualifier: temp };
    };

    /**
     * Enhanced variant of the previous function that determines schema and table qualifiers for
     * column references (and table_wild in multi table delete, for that matter).
     * Returns a set of flags that indicate what to show for that identifier, as well as schema and table
     * if given.
     * The returned schema can be either for a schema.table situation (which requires to show tables)
     * or a schema.table.column situation. Which one is determined by whether showing columns alone or not.
     *
     * @returns An object containing a set of flags for required elements in code completion and the extracted
     * schema and table qualifiers.
     */
    public determineSchemaTableQualifier = (): { flags: ObjectFlags; schema: string; table: string } => {
        const position = this.scanner.tokenIndex;
        if (this.scanner.tokenChannel !== 0) {
            this.scanner.next();
        }

        const tokenType = this.scanner.tokenType;
        if (tokenType !== MySQLLexer.DOT_SYMBOL && !this.lexer.isIdentifier(this.scanner.tokenType)) {
            // Just like in the simpler function. If we have found no identifier or dot then we are at the
            // end of an incomplete definition. Simply seek back to the previous non-hidden token.
            this.scanner.previous();
        }

        // Go left until we find something not related to an id or at most 2 dots.
        if (position > 0) {
            if (this.lexer.isIdentifier(this.scanner.tokenType)
                && (this.scanner.lookBack() === MySQLLexer.DOT_SYMBOL)) {
                this.scanner.previous();
            }

            if (this.scanner.is(MySQLLexer.DOT_SYMBOL) && this.lexer.isIdentifier(this.scanner.lookBack())) {
                this.scanner.previous();

                // And once more.
                if (this.scanner.lookBack() === MySQLLexer.DOT_SYMBOL) {
                    this.scanner.previous();
                    if (this.lexer.isIdentifier(this.scanner.lookBack())) {
                        this.scanner.previous();
                    }
                }
            }
        }

        // The scanner is now on the leading identifier or dot (if there's no leading id).
        let schema = "";
        let table = "";

        let temp = "";
        if (this.lexer.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();
        }

        // Bail out if there is no more id parts or we are already behind the caret position.
        if (!this.scanner.is(MySQLLexer.DOT_SYMBOL) || position <= this.scanner.tokenIndex) {
            return {
                flags: ObjectFlags.ShowSchemas | ObjectFlags.ShowTables | ObjectFlags.ShowColumns,
                schema: "",
                table: "",
            };
        }

        this.scanner.next(); // Skip dot.
        table = temp;
        schema = temp;
        if (this.lexer.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();

            if (!this.scanner.is(MySQLLexer.DOT_SYMBOL) || position <= this.scanner.tokenIndex) {
                // Schema only valid for tables. Columns must use default schema.
                return {
                    flags: ObjectFlags.ShowTables | ObjectFlags.ShowColumns,
                    schema,
                    table,
                };
            }

            table = temp;

            return {
                flags: ObjectFlags.ShowColumns,
                schema,
                table,
            };
        }

        // Schema only valid for tables. Columns must use default schema.
        return {
            flags: ObjectFlags.ShowTables | ObjectFlags.ShowColumns,
            schema,
            table,
        };
    };

    public collectCandidates(): void {
        const c3 = new CodeCompletionCore(this.parser);

        c3.ignoredTokens = new Set([
            MySQLLexer.EOF,
            MySQLLexer.EQUAL_OPERATOR,
            MySQLLexer.ASSIGN_OPERATOR,
            MySQLLexer.NULL_SAFE_EQUAL_OPERATOR,
            MySQLLexer.GREATER_OR_EQUAL_OPERATOR,
            MySQLLexer.GREATER_THAN_OPERATOR,
            MySQLLexer.LESS_OR_EQUAL_OPERATOR,
            MySQLLexer.LESS_THAN_OPERATOR,
            MySQLLexer.NOT_EQUAL_OPERATOR,
            MySQLLexer.NOT_EQUAL2_OPERATOR,
            MySQLLexer.PLUS_OPERATOR,
            MySQLLexer.MINUS_OPERATOR,
            MySQLLexer.MULT_OPERATOR,
            MySQLLexer.DIV_OPERATOR,
            MySQLLexer.MOD_OPERATOR,
            MySQLLexer.LOGICAL_NOT_OPERATOR,
            MySQLLexer.BITWISE_NOT_OPERATOR,
            MySQLLexer.SHIFT_LEFT_OPERATOR,
            MySQLLexer.SHIFT_RIGHT_OPERATOR,
            MySQLLexer.LOGICAL_AND_OPERATOR,
            MySQLLexer.BITWISE_AND_OPERATOR,
            MySQLLexer.BITWISE_XOR_OPERATOR,
            MySQLLexer.LOGICAL_OR_OPERATOR,
            MySQLLexer.BITWISE_OR_OPERATOR,
            MySQLLexer.DOT_SYMBOL,
            MySQLLexer.COMMA_SYMBOL,
            MySQLLexer.SEMICOLON_SYMBOL,
            MySQLLexer.COLON_SYMBOL,
            MySQLLexer.OPEN_PAR_SYMBOL,
            MySQLLexer.CLOSE_PAR_SYMBOL,
            MySQLLexer.OPEN_CURLY_SYMBOL,
            MySQLLexer.CLOSE_CURLY_SYMBOL,
            MySQLLexer.UNDERLINE_SYMBOL,
            MySQLLexer.AT_SIGN_SYMBOL,
            MySQLLexer.AT_AT_SIGN_SYMBOL,
            MySQLLexer.NULL2_SYMBOL,
            MySQLLexer.PARAM_MARKER,
            MySQLLexer.CONCAT_PIPES_SYMBOL,
            MySQLLexer.AT_TEXT_SUFFIX,
            MySQLLexer.BACK_TICK_QUOTED_ID,
            MySQLLexer.SINGLE_QUOTED_TEXT,
            MySQLLexer.DOUBLE_QUOTED_TEXT,
            MySQLLexer.NCHAR_TEXT,
            MySQLLexer.UNDERSCORE_CHARSET,
            MySQLLexer.IDENTIFIER,
            MySQLLexer.INT_NUMBER,
            MySQLLexer.LONG_NUMBER,
            MySQLLexer.ULONGLONG_NUMBER,
            MySQLLexer.DECIMAL_NUMBER,
            MySQLLexer.BIN_NUMBER,
            MySQLLexer.HEX_NUMBER,
        ]);

        c3.preferredRules = new Set([
            MySQLParser.RULE_schemaRef,

            MySQLParser.RULE_tableRef, MySQLParser.RULE_tableRefWithWildcard, MySQLParser.RULE_filterTableRef,

            MySQLParser.RULE_columnRef, MySQLParser.RULE_columnInternalRef, MySQLParser.RULE_tableWild,

            MySQLParser.RULE_functionRef, MySQLParser.RULE_functionCall, MySQLParser.RULE_runtimeFunctionCall,
            MySQLParser.RULE_triggerRef, MySQLParser.RULE_viewRef, MySQLParser.RULE_procedureRef,
            MySQLParser.RULE_logfileGroupRef, MySQLParser.RULE_tablespaceRef, MySQLParser.RULE_engineRef,
            MySQLParser.RULE_collationName, MySQLParser.RULE_charsetName, MySQLParser.RULE_eventRef,
            MySQLParser.RULE_serverRef, MySQLParser.RULE_user, MySQLParser.RULE_pluginRef,
            MySQLParser.RULE_componentRef,

            MySQLParser.RULE_userVariable, MySQLParser.RULE_labelRef,
            MySQLParser.RULE_setSystemVariable,

            // For better handling, but will be ignored.
            MySQLParser.RULE_parameterName, MySQLParser.RULE_procedureName, MySQLParser.RULE_identifier,
            MySQLParser.RULE_labelIdentifier,
        ]);

        // Certain tokens (like identifiers) must be treated as if the char directly following them still belongs to
        // that token (e.g. a whitespace after a name), because visually the caret is placed between that token and the
        // whitespace creating the impression we are still at the identifier (and we should show candidates for this
        // identifier position).
        // Other tokens (like operators) don't need a separator and hence we can take the caret index as is for them.
        this.caretIndex = this.scanner.tokenIndex;
        if (this.caretIndex > 0 && !AutoCompletionContext.noSeparatorRequiredFor.has(this.scanner.lookBack())) {
            --this.caretIndex;
        }

        c3.showResult = false;
        c3.showDebugOutput = false;
        this.referencesStack.push([]); // For the root level of table references.

        this.parser.reset();
        this.completionCandidates = c3.collectCandidates(this.caretIndex);

        // Post processing some entries.
        if (this.completionCandidates.tokens.has(MySQLLexer.NOT2_SYMBOL)) {
            // NOT2 is a NOT with special meaning in the operator precedence chain.
            // For code completion it's the same as NOT.
            this.completionCandidates.tokens.set(MySQLLexer.NOT_SYMBOL,
                this.completionCandidates.tokens.get(MySQLLexer.NOT2_SYMBOL)!);
            this.completionCandidates.tokens.delete(MySQLLexer.NOT2_SYMBOL);
        }

        // If a column reference is required then we have to continue scanning the query for table references.
        for (const ruleEntry of this.completionCandidates.rules) {
            if (ruleEntry[0] === MySQLParser.RULE_columnRef || ruleEntry[0] === MySQLParser.RULE_tableWild) {
                this.collectLeadingTableReferences(false);
                this.takeReferencesSnapshot();
                this.collectRemainingTableReferences();
                this.takeReferencesSnapshot();
                break;
            } else if (ruleEntry[0] === MySQLParser.RULE_columnInternalRef) {
                // Note: rule columnInternalRef is not only used for ALTER TABLE, but atm. we only support that here.
                this.collectLeadingTableReferences(true);
                this.takeReferencesSnapshot();
                break;
            }
        }

        return;
    }

    /**
     * Called if one of the candidates is a column reference, for table references *before* the caret.
     * SQL code must be valid up to the caret, so we can check nesting strictly.
     *
     * @param forTableAlter Flags a specific mode where we can simplify backwards scanning.
     */
    private collectLeadingTableReferences(forTableAlter: boolean): void {
        this.scanner.push();

        if (forTableAlter) {
            // For ALTER TABLE commands we do a simple back scan (no nesting is allowed) until we find ALTER TABLE.
            while (this.scanner.previous() && this.scanner.tokenType !== MySQLLexer.ALTER_SYMBOL) {
                // Just loop.
            }

            if (this.scanner.tokenType === MySQLLexer.ALTER_SYMBOL) {
                this.scanner.skipTokenSequence(MySQLLexer.ALTER_SYMBOL, MySQLLexer.TABLE_SYMBOL);

                let table = unquote(this.scanner.tokenText);
                let schema = "";
                if (this.scanner.next() && this.scanner.is(MySQLLexer.DOT_SYMBOL)) {
                    schema = table;
                    this.scanner.next();
                    this.scanner.next();
                    table = unquote(this.scanner.tokenText);
                }
                this.referencesStack.top!.push({
                    table,
                    schema,
                    alias: "",
                });
            }
        } else {
            this.scanner.seek(0);

            let level = 0;
            while (true) {
                let found = this.scanner.tokenType === MySQLLexer.FROM_SYMBOL;
                while (!found) {
                    if (!this.scanner.next() || this.scanner.tokenIndex >= this.caretIndex) { break; }

                    switch (this.scanner.tokenType) {
                        case MySQLLexer.OPEN_PAR_SYMBOL:
                            ++level;
                            this.referencesStack.push();

                            break;

                        case MySQLLexer.CLOSE_PAR_SYMBOL:
                            if (level === 0) {
                                this.scanner.pop();

                                return; // We cannot go above the initial nesting level.
                            }

                            --level;
                            this.referencesStack.pop();

                            break;

                        case MySQLLexer.FROM_SYMBOL:
                            found = true;
                            break;

                        default:
                            break;
                    }
                }

                if (!found) {
                    this.scanner.pop();

                    return; // No more FROM clause found.
                }

                this.parseTableReferences(this.scanner.tokenSubText);
                if (this.scanner.tokenType === MySQLLexer.FROM_SYMBOL) {
                    this.scanner.next();
                }
            }
        }

        this.scanner.pop();
    }

    /**
     * Called if one of the candidates is a column reference, for table references *after* the caret.
     * The function attempts to get table references together with aliases where possible. This is the only place
     * where we actually look beyond the caret and hence different rules apply: the query doesn't need to be valid
     * beyond that point. We simply scan forward until we find a FROM keyword and work from there. This makes it much
     * easier to work on incomplete queries, which nonetheless need e.g. columns from table references.
     * Because inner queries can use table references from outer queries we can simply scan for all outer FROM clauses
     * (skip over sub queries).
     */
    private collectRemainingTableReferences(): void {
        this.scanner.push();

        // Continuously scan forward to all FROM clauses on the current or any higher nesting level.
        // With certain syntax errors this can lead to a wrong FROM clause (e.g. if parentheses don't match).
        // But that is acceptable.
        let level = 0;
        while (true) {
            let found = this.scanner.tokenType === MySQLLexer.FROM_SYMBOL;
            while (!found) {
                if (!this.scanner.next()) {
                    break;
                }

                switch (this.scanner.tokenType) {
                    case MySQLLexer.OPEN_PAR_SYMBOL: {
                        ++level;
                        break;
                    }

                    case MySQLLexer.CLOSE_PAR_SYMBOL: {
                        if (level > 0) {
                            --level;
                        }
                        break;
                    }

                    case MySQLLexer.FROM_SYMBOL: {
                        // Open and close parentheses don't need to match, if we come from within a subquery.
                        if (level === 0) {
                            found = true;
                        }
                        break;
                    }

                    default: {
                        break;
                    }
                }
            }

            if (!found) {
                this.scanner.pop();

                return; // No more FROM clause found.
            }

            this.parseTableReferences(this.scanner.tokenSubText);
            if (this.scanner.tokenType === MySQLLexer.FROM_SYMBOL) {
                this.scanner.next();
            }
        }
    }

    /**
     * Parses the given FROM clause text using a local parser and collects all found table references.
     *
     * @param fromClause The text of the FROM clause.
     */
    private parseTableReferences(fromClause: string): void {
        // We use a local parser just for the FROM clause to avoid messing up tokens on the code completion
        // parser (which would affect the processing of the found candidates).
        const input = CharStreams.fromString(fromClause);
        const lexer = new MySQLLexer(input);
        const tokens = new CommonTokenStream(lexer);
        const fromParser = new MySQLParser(tokens);

        this.lexer.serverVersion = this.parser.serverVersion;
        this.lexer.sqlModes = this.parser.sqlModes;
        fromParser.serverVersion = this.parser.serverVersion;
        fromParser.sqlModes = this.parser.sqlModes;
        fromParser.buildParseTree = true;

        fromParser.removeErrorListeners();
        const tree = fromParser.fromClause();

        const listener = new MySQLTableRefListener(this, true);
        ParseTreeWalker.DEFAULT.walk(listener as ParseTreeListener, tree);
    }

    /**
     * Copies the current references stack into the references map.
     */
    private takeReferencesSnapshot(): void {
        // Don't clear the references map here. Can happen we have to take multiple snapshots.
        // We automatically remove duplicates by using a map.
        for (const entry of this.referencesStack) {
            for (const reference of entry) {
                this.references.push(reference);
            }
        }
    }
}

/**
 * Generates a list of completion items for MySQL code.
 *
 * @param caretLine The line on which to show code completion.
 * @param caretOffset The column for which to show code completion.
 * @param defaultSchema The MySQL schema to be used for lookup of tables/columns, if no schema was given.
 * @param parser A MySQL parser instance for various data structures need in this process.
 *
 * @returns A list of completion items.
 */
export const getCodeCompletionItems = (caretLine: number, caretOffset: number, defaultSchema: string,
    parser: MySQLParser): ICompletionData => {

    const result: ICompletionData = {
        isQuoted: false, // This will actually be set by the caller.
        keywords: [],
        functions: [],
        dbObjects: [],
        tables: [],
    };

    // Also create a separate scanner which allows us to easily navigate the tokens
    // without affecting the token stream used by the parser.
    const scanner = new Scanner(parser.inputStream as BufferedTokenStream);

    // Move to caret position and store that on the this.scanner stack.
    scanner.advanceToPosition(caretLine, caretOffset);
    scanner.push();

    let queryType = QueryType.Unknown;
    const lexer = parser.inputStream.tokenSource as MySQLLexer;
    if (lexer) {
        lexer.reset(); // Set back the input position to the beginning for query type determination.
        queryType = lexer.determineQueryType();
    }

    const context = new AutoCompletionContext(parser, scanner, lexer);
    context.collectCandidates();

    const vocabulary = parser.vocabulary;

    for (const candidate of context.completionCandidates.tokens) {
        let entry = vocabulary.getDisplayName(candidate[0]);
        if (entry.endsWith("_SYMBOL")) {
            entry = entry.substr(0, entry.length - 7);
        } else {
            entry = unquote(entry);
        }

        let isFunction = false;
        if (candidate[1].length > 0) {
            // A function call?
            if (candidate[1][0] === MySQLLexer.OPEN_PAR_SYMBOL) {
                isFunction = true;
            } else {
                for (const token of candidate[1]) {
                    let subEntry = vocabulary.getDisplayName(token);
                    if (subEntry.endsWith("_SYMBOL")) {
                        subEntry = subEntry.substr(0, subEntry.length - 7);
                    } else {
                        subEntry = unquote(subEntry);
                    }
                    entry += " " + subEntry;
                }
            }
        }

        if (isFunction) {
            result.functions.push(entry.toLowerCase() + "()");
        } else {
            result.keywords.push(entry);

            // Add also synonyms, if there are any.
            const candidates = synonyms.get(candidate[0]);
            if (candidates) {
                for (const synonym of candidates) {
                    result.keywords.push(synonym);
                }
            }
        }
    }

    for (const candidate of context.completionCandidates.rules) {
        // Restore the this.scanner position to the caret position and store that value again for the next round.
        scanner.pop();
        scanner.push();

        switch (candidate[0]) {
            case MySQLParser.RULE_runtimeFunctionCall: {
                result.dbObjects.push({ kind: LanguageCompletionKind.SystemFunction });

                break;
            }

            case MySQLParser.RULE_functionRef:
            case MySQLParser.RULE_functionCall: {
                const info = context.getQualifierInfo();

                if (info.qualifier.length === 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Udf });
                }

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    if (info.qualifier.length === 0) {
                        info.qualifier = defaultSchema;
                    }


                    result.dbObjects.push({
                        kind: LanguageCompletionKind.Function,
                        schemas: new Set([info.qualifier]),
                    });
                }

                break;
            }

            case MySQLParser.RULE_engineRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Engine });

                break;
            }

            case MySQLParser.RULE_schemaRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Schema });

                break;
            }

            case MySQLParser.RULE_procedureRef: {
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    if (info.qualifier.length === 0) {
                        info.qualifier = defaultSchema;
                    }

                    result.dbObjects.push({
                        kind: LanguageCompletionKind.Procedure,
                        schemas: new Set([info.qualifier]),
                    });
                }

                break;
            }

            case MySQLParser.RULE_tableRefWithWildcard: {
                // A special form of table references (id.id.*) used only in multi-table delete.
                // Handling is similar as for column references (just that we have table/view objects instead
                // of column refs).
                const info = context.determineSchemaTableQualifier();
                if ((info.flags & ObjectFlags.ShowSchemas) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                const schemas = new Set([info.schema.length === 0 ? defaultSchema : info.schema]);

                if ((info.flags & ObjectFlags.ShowTables) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Table, schemas });
                    result.dbObjects.push({ kind: LanguageCompletionKind.View, schemas });
                }

                break;
            }

            case MySQLParser.RULE_tableRef:
            case MySQLParser.RULE_filterTableRef: {
                // Tables refs - also allow view refs.
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    const schemas = new Set([info.qualifier.length === 0 ? defaultSchema : info.qualifier]);

                    result.dbObjects.push({ kind: LanguageCompletionKind.Table, schemas });
                    result.dbObjects.push({ kind: LanguageCompletionKind.View, schemas });
                }

                break;
            }

            case MySQLParser.RULE_tableWild:
            case MySQLParser.RULE_columnRef: {
                // Try limiting what to show to the smallest set possible.
                // If we have table references show columns only from them.
                // Show columns from the default schema only if there are no _
                const info = context.determineSchemaTableQualifier();
                if ((info.flags & ObjectFlags.ShowSchemas) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                // If a schema is given then list only tables + columns from that schema.
                // If no schema is given but we have table references use the schemas from them.
                // Otherwise use the default schema.
                // TODO: case sensitivity.
                const schemas: Set<string> = new Set();

                if (info.schema.length > 0) {
                    schemas.add(info.schema);
                } else if (context.references.length > 0) {
                    for (const reference of context.references) {
                        if (reference.schema.length > 0) {
                            schemas.add(reference.schema);
                        }
                    }
                }

                if (schemas.size === 0) {
                    schemas.add(defaultSchema);
                }

                if ((info.flags & ObjectFlags.ShowTables) !== 0) {
                    // Store a duplicate of the current schema set, as we are going to modify it below.
                    result.dbObjects.push({ kind: LanguageCompletionKind.Table, schemas: new Set(schemas) });
                    if (candidate[0] === MySQLParser.RULE_columnRef) {
                        // Insert also views.
                        result.dbObjects.push({ kind: LanguageCompletionKind.View, schemas: new Set(schemas) });

                        // Insert also tables from our references list.
                        for (const reference of context.references) {
                            // If no schema was specified then allow also tables without a given schema. Otherwise
                            // the reference's schema must match any of the specified schemas
                            // (which include those from the ref list).
                            if (info.schema.length === 0 && reference.schema.length === 0) {
                                if (schemas.has(reference.schema)) {
                                    const table = reference.alias.length === 0 ? reference.table : reference.alias;
                                    result.tables.push(table);
                                }
                            }
                        }
                    }
                }

                if ((info.flags & ObjectFlags.ShowColumns) !== 0) {
                    // Schema and table are equal if it's not clear if we see a schema or table qualifier.
                    if (info.schema === info.table) {
                        schemas.add(defaultSchema);
                    }

                    // For the columns we use a similar approach like for the schemas.
                    // If a table is given, list only columns from this (use the set of schemas from above).
                    // If not and we have table references then show columns from them.
                    // Otherwise show no columns.
                    let tables: Set<string> = new Set();
                    if (info.table.length > 0) {
                        tables.add(info.table);

                        // Could be an alias.
                        for (const reference of context.references) {
                            if (info.table === reference.alias) {
                                tables.add(reference.table);
                                schemas.add(reference.schema);

                                break;
                            }
                        }
                    } else if (context.references.length > 0 && candidate[0] === MySQLParser.RULE_columnRef) {
                        for (const reference of context.references) {
                            tables.add(reference.table);
                        }
                    }

                    if (tables.size > 0) {
                        result.dbObjects.push({ kind: LanguageCompletionKind.Column, schemas, tables });
                    }

                    // Special deal here: triggers. Show columns for the "new" and "old" qualifiers too.
                    // Use the first reference in the list, which is the table to which this trigger belongs
                    // (there can be more if the trigger body references other tables).
                    if (queryType === QueryType.CreateTrigger && context.references.length > 0 &&
                        ((info.table === "old") || (info.table === "new"))) {
                        tables = new Set([context.references[0].table]);
                        result.dbObjects.push({ kind: LanguageCompletionKind.Column, schemas, tables });
                    }
                }

                break;
            }

            case MySQLParser.RULE_columnInternalRef: {
                const schemas = new Set<string>();
                const tables = new Set<string>();
                if (context.references.length > 0) {
                    tables.add(context.references[0].table);

                    if (context.references[0].schema.length === 0) {
                        schemas.add(defaultSchema);
                    } else {
                        schemas.add(context.references[0].schema);
                    }
                }

                if (tables.size > 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Column, schemas, tables });
                }

                break;
            }

            case MySQLParser.RULE_triggerRef: {
                // While triggers are bound to a table they are schema objects and are referenced as "[schema.]trigger"
                // e.g. in DROP TRIGGER.
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Trigger, schemas: new Set([info.qualifier]) });
                }
                break;
            }

            case MySQLParser.RULE_viewRef: {
                // View refs only (no table references), e.g. like in DROP VIEW ...
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    const schemas = new Set([info.qualifier.length === 0 ? defaultSchema : info.qualifier]);
                    result.dbObjects.push({ kind: LanguageCompletionKind.View, schemas });
                }

                break;
            }

            case MySQLParser.RULE_logfileGroupRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.LogfileGroup });

                break;
            }

            case MySQLParser.RULE_tablespaceRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Tablespace });

                break;
            }

            case MySQLParser.RULE_userVariable: {
                result.dbObjects.push({ kind: LanguageCompletionKind.UserVariable });

                break;
            }

            case MySQLParser.RULE_labelRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Label });
                break;
            }

            case MySQLParser.RULE_setSystemVariable: {
                result.dbObjects.push({ kind: LanguageCompletionKind.SystemVariable });

                break;
            }

            case MySQLParser.RULE_charsetName: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Charset });

                break;
            }

            case MySQLParser.RULE_collationName: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Collation });

                break;
            }

            case MySQLParser.RULE_eventRef: {
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    if (info.qualifier.length === 0) {
                        info.qualifier = defaultSchema;
                    }

                    result.dbObjects.push({ kind: LanguageCompletionKind.Event });
                }

                break;
            }

            case MySQLParser.RULE_user: {
                result.dbObjects.push({ kind: LanguageCompletionKind.User });

                break;
            }

            case MySQLParser.RULE_pluginRef: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Plugin });

                break;
            }

            default: {
                break;
            }
        }
    }

    scanner.pop(); // Clear the scanner stack.

    return result;
};
