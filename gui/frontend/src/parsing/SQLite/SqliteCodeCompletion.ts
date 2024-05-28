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

/* eslint-disable no-underscore-dangle */

import { CandidatesCollection, CodeCompletionCore } from "antlr4-c3";
import { BufferedTokenStream, CharStream, CommonTokenStream } from "antlr4ng";

import { SQLiteLexer } from "./generated/SQLiteLexer.js";
import { SQLiteParser } from "./generated/SQLiteParser.js";

import { Stack } from "../../supplement/Stack.js";
import { ICompletionData, ICompletionObjectDetails, LanguageCompletionKind, Scanner } from "../parser-common.js";
import { unquote } from "../../utilities/string-helpers.js";
import { isReservedKeyword, SQLiteVersion } from "./SQLiteRecognizerCommon.js";

interface ITableReference {
    schema: string;
    table: string;
    alias: string;
}

enum ObjectFlags {
    // For 3 part identifiers.
    ShowSchemas = 1 << 0,
    ShowTables = 1 << 1,
    ShowColumns = 1 << 2,

    // For 2 part identifiers.
    ShowFirst = 1 << 3,
    ShowSecond = 1 << 4,
}

// Context class for code completion results.
class AutoCompletionContext {
    private static noSeparatorRequiredFor: Set<number> = new Set([
        SQLiteLexer.SCOL,
        SQLiteLexer.DOT,
        SQLiteLexer.OPEN_PAR,
        SQLiteLexer.CLOSE_PAR,
        SQLiteLexer.COMMA,
        SQLiteLexer.ASSIGN,
        SQLiteLexer.STAR,
        SQLiteLexer.PLUS,
        SQLiteLexer.MINUS,
        SQLiteLexer.TILDE,
        SQLiteLexer.PIPE2,
        SQLiteLexer.DIV,
        SQLiteLexer.MOD,
        SQLiteLexer.LT2,
        SQLiteLexer.GT2,
        SQLiteLexer.AMP,
        SQLiteLexer.PIPE,
        SQLiteLexer.LT,
        SQLiteLexer.LT_EQ,
        SQLiteLexer.GT,
        SQLiteLexer.GT_EQ,
        SQLiteLexer.EQ,
        SQLiteLexer.NOT_EQ1,
        SQLiteLexer.NOT_EQ2,
    ]);

    public completionCandidates = new CandidatesCollection();

    // A flat list of possible references for easier lookup.
    public references: ITableReference[] = [];

    private caretIndex = 0;

    // A hierarchical view of all table references in the code, updated by visiting all relevant FROM clauses after
    // the candidate collection.
    // Organized as stack to be able to easily remove sets of references when changing nesting level.
    private referencesStack: Stack<ITableReference[]> = new Stack();

    public constructor(private parser: SQLiteParser, private lexer: SQLiteLexer, private scanner: Scanner) {
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

    public collectCandidates(): void {
        const c3 = new CodeCompletionCore(this.parser);

        c3.ignoredTokens = new Set([
            SQLiteLexer.SCOL,
            SQLiteLexer.DOT,
            SQLiteLexer.OPEN_PAR,
            SQLiteLexer.CLOSE_PAR,
            SQLiteLexer.COMMA,
            SQLiteLexer.ASSIGN,
            SQLiteLexer.STAR,
            SQLiteLexer.PLUS,
            SQLiteLexer.MINUS,
            SQLiteLexer.TILDE,
            SQLiteLexer.PIPE2,
            SQLiteLexer.DIV,
            SQLiteLexer.MOD,
            SQLiteLexer.LT2,
            SQLiteLexer.GT2,
            SQLiteLexer.AMP,
            SQLiteLexer.PIPE,
            SQLiteLexer.LT,
            SQLiteLexer.LT_EQ,
            SQLiteLexer.GT,
            SQLiteLexer.GT_EQ,
            SQLiteLexer.EQ,
            SQLiteLexer.NOT_EQ1,
            SQLiteLexer.NOT_EQ2,
        ]);

        c3.preferredRules = new Set([
            SQLiteParser.RULE_function_name,
            SQLiteParser.RULE_schema_name,
            SQLiteParser.RULE_table_name,
            SQLiteParser.RULE_table_or_index_name,
            SQLiteParser.RULE_column_name,
            SQLiteParser.RULE_collation_name,
            SQLiteParser.RULE_foreign_table,
            SQLiteParser.RULE_index_name,
            SQLiteParser.RULE_trigger_name,
            SQLiteParser.RULE_view_name,
            SQLiteParser.RULE_module_name,
            SQLiteParser.RULE_pragma_name,
            SQLiteParser.RULE_savepoint_name,
            SQLiteParser.RULE_table_alias,
            SQLiteParser.RULE_transaction_name,
            SQLiteParser.RULE_window_name,
            SQLiteParser.RULE_alias,
            SQLiteParser.RULE_filename,
            SQLiteParser.RULE_base_window_name,
            SQLiteParser.RULE_simple_func,
            SQLiteParser.RULE_aggregate_func,
            SQLiteParser.RULE_table_function_name,
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
        //const context = this.parser.query();

        this.completionCandidates = c3.collectCandidates(this.caretIndex);

        // Post processing some entries.

        // If a column reference is required then we have to continue scanning the query for table references.
        for (const ruleEntry of this.completionCandidates.rules) {
            if (ruleEntry[0] === SQLiteParser.RULE_column_name) {
                this.collectLeadingTableReferences(false);
                this.takeReferencesSnapshot();
                this.collectRemainingTableReferences();
                this.takeReferencesSnapshot();
                break;
            }
        }

        return;
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
    public getQualifierInfo(): { flags: ObjectFlags; qualifier: string; } {
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

        if (!this.scanner.is(SQLiteLexer.DOT) && !this.isIdentifier(this.scanner.tokenType)) {
            // We are at the end of an incomplete identifier spec. Jump back, so that the other tests succeed.
            this.scanner.previous();
        }

        // Go left until we find something not related to an id or find at most 1 dot.
        if (position > 0) {
            if (this.isIdentifier(this.scanner.tokenType) && this.scanner.lookBack() === SQLiteLexer.DOT) {
                this.scanner.previous();
            }
            if (this.scanner.is(SQLiteLexer.DOT) && this.isIdentifier(this.scanner.lookBack())) {
                this.scanner.previous();
            }
        }

        // The this.scanner is now on the leading identifier or dot (if there's no leading id).
        let temp = "";
        if (this.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();
        }

        // Bail out if there is no more id parts or we are already behind the caret position.
        if (!this.scanner.is(SQLiteLexer.DOT) || position <= this.scanner.tokenIndex) {
            return { flags: ObjectFlags.ShowFirst | ObjectFlags.ShowSecond, qualifier: "" };
        }

        return { flags: ObjectFlags.ShowSecond, qualifier: temp };
    }

    /**
     * Enhanced variant of the previous function that determines schema and table qualifiers for
     * column references (and table_wild in multi table delete, for that matter).
     * Returns a set of flags that indicate what to show for that identifier, as well as schema and table
     * if given.
     * The returned schema can be either for a schema.table situation (which requires to show tables)
     * or a schema.table.column situation. Which one is determined by whether showing columns alone or not.
     *
     * @returns An object containing a set of flags for required elements in code completion and the extracted
     *          schema and table qualifiers.
     */
    public determineSchemaTableQualifier(): { flags: ObjectFlags; schema: string; table: string; } {
        const position = this.scanner.tokenIndex;
        if (this.scanner.tokenChannel !== 0) {
            this.scanner.next();
        }

        const tokenType = this.scanner.tokenType;
        if (tokenType !== SQLiteLexer.DOT && !this.isIdentifier(this.scanner.tokenType)) {
            // Just like in the simpler function. If we have found no identifier or dot then we are at the
            // end of an incomplete definition. Simply seek back to the previous non-hidden token.
            this.scanner.previous();
        }

        // Go left until we find something not related to an id or at most 2 dots.
        if (position > 0) {
            if (this.isIdentifier(this.scanner.tokenType) && (this.scanner.lookBack() === SQLiteLexer.DOT)) {
                this.scanner.previous();
            }

            if (this.scanner.is(SQLiteLexer.DOT) && this.isIdentifier(this.scanner.lookBack())) {
                this.scanner.previous();

                // And once more.
                if (this.scanner.lookBack() === SQLiteLexer.DOT) {
                    this.scanner.previous();
                    if (this.isIdentifier(this.scanner.lookBack())) {
                        this.scanner.previous();
                    }
                }
            }
        }

        // The this.scanner is now on the leading identifier or dot (if there's no leading id).
        let schema = "";
        let table = "";

        let temp = "";
        if (this.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();
        }

        // Bail out if there is no more id parts or we are already behind the caret position.
        if (!this.scanner.is(SQLiteLexer.DOT) || position <= this.scanner.tokenIndex) {
            return {
                flags: ObjectFlags.ShowSchemas | ObjectFlags.ShowTables | ObjectFlags.ShowColumns,
                schema: "",
                table: "",
            };
        }

        this.scanner.next(); // Skip dot.
        table = temp;
        schema = temp;
        if (this.isIdentifier(this.scanner.tokenType)) {
            temp = unquote(this.scanner.tokenText);
            this.scanner.next();

            if (!this.scanner.is(SQLiteLexer.DOT) || position <= this.scanner.tokenIndex) {
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
    }

    public handleIndexNames(): ICompletionObjectDetails[] {
        const result: ICompletionObjectDetails[] = [];

        const info = this.getQualifierInfo();

        if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
            result.push({ kind: LanguageCompletionKind.Table });
        }

        if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
            const tables = new Set<string>();
            if (info.qualifier.length > 0) {
                tables.add(info.qualifier);
            }

            result.push({ kind: LanguageCompletionKind.Index, tables });
        }

        return result;
    }

    public handleTableNames(defaultSchema: string): ICompletionObjectDetails[] {
        const result: ICompletionObjectDetails[] = [];

        const info = this.getQualifierInfo();

        if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
            result.push({ kind: LanguageCompletionKind.Schema });
        }

        if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
            const schemas = new Set<string>();
            const schema = info.qualifier.length === 0 ? defaultSchema : info.qualifier;
            schemas.add(schema);

            result.push({ kind: LanguageCompletionKind.Table, schemas });
            result.push({ kind: LanguageCompletionKind.View, schemas });
        }

        return result;
    }

    /**
     * Returns true if the given token is an identifier. This includes all those keywords that are
     * allowed as identifiers when unquoted (non-reserved keywords).
     *
     * @param type The token type to check.
     *
     * @returns True if the given type is an identifier, which depends also on the current SQL mode.
     */
    private isIdentifier(type: number): boolean {
        if (type === SQLiteLexer.IDENTIFIER) {
            return true;
        }

        const symbol = this.lexer.vocabulary.getSymbolicName(type);
        if (symbol && symbol !== "" && !isReservedKeyword(symbol, SQLiteVersion.Standard)) {
            return true;
        }

        return false;
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
            while (this.scanner.previous() && this.scanner.tokenType !== SQLiteLexer.ALTER_) {
                // Just loop.
            }

            if (this.scanner.tokenType === SQLiteLexer.ALTER_) {
                this.scanner.skipTokenSequence(SQLiteLexer.ALTER_, SQLiteLexer.TABLE_);

                let table = unquote(this.scanner.tokenText);
                let schema = "";
                if (this.scanner.next() && this.scanner.is(SQLiteLexer.DOT)) {
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
                let found = this.scanner.tokenType === SQLiteLexer.FROM_;
                while (!found) {
                    if (!this.scanner.next() || this.scanner.tokenIndex >= this.caretIndex) { break; }

                    switch (this.scanner.tokenType) {
                        case SQLiteLexer.OPEN_PAR:
                            ++level;
                            this.referencesStack.push();

                            break;

                        case SQLiteLexer.CLOSE_PAR:
                            if (level === 0) {
                                this.scanner.pop();

                                return; // We cannot go above the initial nesting level.
                            }

                            --level;
                            this.referencesStack.pop();

                            break;

                        case SQLiteLexer.FROM_:
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
                if (this.scanner.tokenType === SQLiteLexer.FROM_) {
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
            let found = this.scanner.tokenType === SQLiteLexer.FROM_;
            while (!found) {
                if (!this.scanner.next()) {
                    break;
                }

                switch (this.scanner.tokenType) {
                    case SQLiteLexer.OPEN_PAR: {
                        ++level;
                        break;
                    }

                    case SQLiteLexer.CLOSE_PAR: {
                        if (level > 0) { --level; }
                        break;
                    }

                    case SQLiteLexer.FROM_: {
                        // Open and close parentheses don't need to match, if we come from within a sub query.
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
            if (this.scanner.tokenType === SQLiteLexer.FROM_) {
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
        // We use a local parser just for the FROM clause to avoid messing up tokens on the completion
        // parser (which would affect the processing of the found candidates).
        const input = CharStream.fromString(fromClause);
        const lexer = new SQLiteLexer(input);
        const tokens = new CommonTokenStream(lexer);
        const fromParser = new SQLiteParser(tokens);

        fromParser.buildParseTrees = true;

        fromParser.removeErrorListeners();
        const tree = fromParser.from_clause();
        tree.table_or_subquery().forEach((entry) => {
            if (entry.table_name()) {
                const table = unquote(entry.table_name()!.getText(), "\"`'[(");

                let schema = "";
                if (entry.schema_name()) {
                    schema = unquote(entry.schema_name()!.getText(), "\"`'[(");
                }

                let alias = "";
                if (entry.table_alias()) {
                    alias = unquote(entry.table_alias()!.getText(), "\"`'[(");
                }

                this.pushTableReference({
                    schema,
                    table,
                    alias,
                });

            }
        });
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

const synonyms: Map<number, string[]> = new Map([

]);

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
    parser: SQLiteParser): ICompletionData => {

    // To be done yet.
    //const indexEntries: ILanguageCompletionItem[] = [];

    const result: ICompletionData = {
        isQuoted: false, // This will actually be set by the caller.
        keywords: [],
        functions: [],
        dbObjects: [],
        tables: [],
    };

    // Also create a separate this.scanner which allows us to easily navigate the tokens
    // without affecting the token stream used by the parser.
    const scanner = new Scanner(parser.inputStream as BufferedTokenStream);

    // Move to caret position and store that on the this.scanner stack.
    scanner.advanceToPosition(caretLine, caretOffset);
    scanner.push();

    const lexer = parser.inputStream.tokenSource as SQLiteLexer;
    const context = new AutoCompletionContext(parser, lexer, scanner);
    context.collectCandidates();

    const vocabulary = lexer.vocabulary;

    // Note: sorting within the lists is done using the `sortText` field in a completion item.
    for (const candidate of context.completionCandidates.tokens) {
        let entry = vocabulary.getDisplayName(candidate[0])!;
        if (entry.endsWith("_")) {
            entry = entry.substring(0, entry.length - 1);
        } else {
            entry = unquote(entry);
        }

        let isFunction = false;
        if (candidate[1].length > 0) {
            // A function call?
            if (candidate[1][0] === SQLiteLexer.OPEN_PAR) {
                isFunction = true;
            } else {
                for (const token of candidate[1]) {
                    let subEntry = vocabulary.getDisplayName(token)!;
                    if (subEntry.endsWith("_")) {
                        subEntry = subEntry.substring(0, subEntry.length - 1);
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
        // Restore the scanner position to the caret position and store that value again for the next round.
        scanner.pop();
        scanner.push();

        switch (candidate[0]) {
            case SQLiteParser.RULE_function_name:
            case SQLiteParser.RULE_table_function_name: {
                result.dbObjects.push({ kind: LanguageCompletionKind.SystemFunction });

                break;
            }

            case SQLiteParser.RULE_schema_name: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Schema });

                break;
            }

            case SQLiteParser.RULE_table_name: {
                result.dbObjects.push(...context.handleTableNames(defaultSchema));

                break;
            }

            case SQLiteParser.RULE_table_or_index_name: {
                result.dbObjects.push(...context.handleTableNames(defaultSchema));
                result.dbObjects.push(...context.handleIndexNames());

                break;
            }

            case SQLiteParser.RULE_index_name: {
                result.dbObjects.push(...context.handleIndexNames());

                break;
            }

            case SQLiteParser.RULE_column_name: {
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
                const schemas = new Set<string>();

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
                    // Duplicate the schemas Set or we will modify those entries here when we add more schemas below.
                    result.dbObjects.push({ kind: LanguageCompletionKind.Table, schemas: new Set(schemas) });
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

                if ((info.flags & ObjectFlags.ShowColumns) !== 0) {
                    // Schema and table are equal if it's not clear if we see a schema or table qualifier.
                    if (info.schema === info.table) {
                        schemas.add(defaultSchema);
                    }

                    // For the columns we use a similar approach like for the schemas.
                    // If a table is given, list only columns from this (use the set of schemas from above).
                    // If not and we have table references then show columns from them.
                    // Otherwise show no columns.
                    const tables = new Set<string>();
                    if (info.table.length > 0) {
                        tables.add(info.table);

                        // Could be an alias.
                        for (const reference of context.references) {
                            if (info.table.localeCompare(reference.alias) === 0) {
                                tables.add(reference.table);
                                schemas.add(reference.schema);
                                break;
                            }
                        }
                    } else if (context.references.length > 0 && candidate[0] === SQLiteParser.RULE_column_name) {
                        for (const reference of context.references) {
                            tables.add(reference.table);
                        }
                    }

                    if (tables.size > 0) {
                        result.dbObjects.push({ kind: LanguageCompletionKind.Column, schemas, tables });
                    }
                }

                break;
            }

            case SQLiteParser.RULE_trigger_name: {
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

            case SQLiteParser.RULE_view_name: {
                // View refs only (no table references), e.g. like in DROP VIEW ...
                const info = context.getQualifierInfo();

                if ((info.flags & ObjectFlags.ShowFirst) !== 0) {
                    result.dbObjects.push({ kind: LanguageCompletionKind.Schema });
                }

                if ((info.flags & ObjectFlags.ShowSecond) !== 0) {
                    const schemas = new Set<string>();
                    const schema = info.qualifier.length === 0 ? defaultSchema : info.qualifier;
                    schemas.add(schema);
                    result.dbObjects.push({ kind: LanguageCompletionKind.View, schemas });
                }

                break;
            }

            case SQLiteParser.RULE_collation_name: {
                result.dbObjects.push({ kind: LanguageCompletionKind.Collation });

                break;
            }

            default: {
                break;
            }
        }
    }

    scanner.pop(); // Clear the this.scanner stack.

    return result;
};
