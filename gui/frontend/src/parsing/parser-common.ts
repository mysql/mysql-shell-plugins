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

// Common data structures/types used in all parser implementations.

import { BufferedTokenStream, CommonTokenStream, Token } from "antlr4ng";
import { IDictionary, ParameterFormatType } from "../app-logic/general-types.js";

import { Stack } from "../supplement/index.js";

/** Describes the type of an SQL query. Not all SQL flavours support all types. */
export enum QueryType {
    Unknown,
    Ambiguous,

    // DDL
    AlterDatabase,
    AlterLogFileGroup,
    AlterFunction,
    AlterProcedure,
    AlterServer,
    AlterTable,
    AlterTableSpace,
    AlterEvent,
    AlterView,

    CreateTable,
    CreateVirtualTable,
    CreateIndex,
    CreateDatabase,
    CreateEvent,
    CreateView,
    CreateRoutine, // All of procedure, function, UDF. Used for parse type.
    CreateProcedure,
    CreateFunction,
    CreateUdf,
    CreateTrigger,
    CreateLogFileGroup,
    CreateServer,
    CreateTableSpace,

    DropDatabase,
    DropEvent,
    DropFunction, // Includes UDF.
    DropProcedure,
    DropIndex,
    DropLogfileGroup,
    DropServer,
    DropTable,
    DropTablespace,
    DropTrigger,
    DropView,

    RenameTable,
    TruncateTable,

    // DML
    Call,
    Delete,
    Do,

    Handler,

    Insert,
    LoadData,
    LoadXML,
    Replace, // A variation of insert in SQLite.
    Select,
    Table,  // Explicit table statement (e.g. in MySQL).
    Values, // Table value constructor (e.g. in MySQL).
    Update,

    StartTransaction,
    BeginWork,
    Commit,
    RollbackWork,
    SetAutoCommit,
    SetTransaction,

    SavePoint,
    ReleaseSavePoint,
    RollbackSavePoint,

    Lock,
    Unlock,

    XA,

    Purge,
    ChangeMaster,
    Reset,
    ResetMaster,
    ResetSlave,
    StartSlave,
    StopSlave,
    LoadDataMaster,
    LoadTableMaster,

    Prepare,
    Execute,
    Deallocate,

    // Database administration
    AlterUser,
    CreateUser,
    DropUser,
    GrantProxy,
    Grant,
    RenameUser,
    RevokeProxy,
    Revoke,

    AnalyzeTable,
    CheckTable,
    ChecksumTable,
    OptimizeTable,
    RepairTable,
    BackUpTable,
    RestoreTable,

    InstallPlugin,
    UninstallPlugin,

    Set, // Any variable assignment.
    SetPassword,

    Show,
    ShowBinaryLogs,
    ShowBinLogEvents,
    ShowRelayLogEvents,
    ShowCharset,
    ShowCollation,
    ShowColumns,
    ShowCreateDatabase,
    ShowCreateEvent,
    ShowCreateFunction,
    ShowCreateProcedure,
    ShowCreateTable,
    ShowCreateTrigger,
    ShowCreateView,
    ShowDatabases,
    ShowEngineStatus,
    ShowStorageEngines,
    ShowErrors,
    ShowEvents,
    ShowFunctionCode,
    ShowFunctionStatus,
    ShowGrants,
    ShowIndexes, // Index, Indexes, Keys
    ShowMasterStatus,
    ShowOpenTables,
    ShowPlugins,
    ShowProcedureStatus,
    ShowProcedureCode,
    ShowPrivileges,
    ShowProcessList,
    ShowProfile,
    ShowProfiles,
    ShowSlaveHosts,
    ShowSlaveStatus,
    ShowStatus,
    ShowVariables,
    ShowTableStatus,
    ShowTables,
    ShowTriggers,
    ShowWarnings,

    CacheIndex,
    Flush,
    Kill, // Connection, Query
    LoadIndex,
    Attach,
    Detach,
    Pragma,
    ReIndex,
    Vacuum,

    ExplainTable,
    ExplainStatement,
    Help,
    Use,

    Sentinel,

    Rest,
    RestUse,
    RestShow,
}

/**
 * This is the same as in typescript.TextSpan (hence the missing leading I), but we cannot include typescript in a
 * web worker or it will grow tremendously.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface TextSpan {
    start: number;
    length: number;
}

/** Indicates how a statement ends. */
export enum StatementFinishState {
    /** Ends with a delimiter. */
    Complete,

    /** Ends with an open comment (multiline or single line w/o following new line). */
    OpenComment,

    /** A string (single, double or backtick quoted) wasn't closed. */
    OpenString,

    /** The delimiter is missing. */
    NoDelimiter,

    /** The statement changes the delimiter. */
    DelimiterChange,
}

export interface IStatementSpan {
    /**
     * The delimiter with which this statement ended or undefined if no delimiter was found.
     */
    delimiter?: string;

    /** Start and length of the entire statement, including leading whitespaces/comments. */
    span: TextSpan;

    /** An alternative start offset, for the first non-whitespace/non-comment character. */
    contentStart: number;

    /** The offset where non-whitespace content starts. */
    state: StatementFinishState;
}

export interface IParserErrorInfo {
    message: string;
    tokenType: number;

    /** Offset from the beginning of the input to the error position. */
    charOffset: number;

    /** Error line. */
    line: number;

    /** Char offset in the error line to the error start position. */
    offset: number;
    length: number;
}

/** The definition of a single symbol (range and content it is made of). */
export interface ISymbolDefinition {
    text: string;
    span: TextSpan;
}

export enum SymbolKind {
    Unknown,
    Catalog,
    Keyword,
    Schema,
    Table,
    Procedure,
    Function,
    Udf,
    View,
    Column,
    PrimaryKey,
    ForeignKey,
    Operator,
    Engine,
    Trigger,
    LogfileGroup,
    UserVariable,
    Tablespace,
    Event,
    Index,
    User,
    Charset,
    Collation,
    Plugin,

    SystemVariable,
    SystemFunction
}

export enum DiagnosticSeverity {
    Warning = 0,
    Error = 1,
    Suggestion = 2,
    Message = 3
}

/** Lexer type and position of a single token.  */
export interface ITokenInfo {
    /** The token type (highlighter scope). */
    type: string;

    /** The position of the first token character relative to its containing statement. */
    offset: number;

    /** The length of the token text. */
    length: number;
}

export interface ISymbolInfo {
    kind: SymbolKind;
    name: string;
    source: string;
    definition?: ISymbolDefinition;
    description?: string[];
}

export interface IDiagnosticEntry {
    span: TextSpan;
    severity: DiagnosticSeverity;
    source: string;
    message?: string;
}

/** Details about a specific group of DB objects. */
export interface ICompletionObjectDetails {
    kind: LanguageCompletionKind;
    schemas?: Set<string>;

    /** Only used for column references. */
    tables?: Set<string>;
}

/** Data collected during a code completion call. */
export interface ICompletionData {
    /** True if the text that is being completed is already quoted. */
    isQuoted: boolean;

    /** Possible keywords. */
    keywords: string[];

    /** Keywords which can also be functions. */
    functions: string[];

    /** Objects which can be collected from symbol tables. */
    dbObjects: ICompletionObjectDetails[];

    /** Table + alias references from code. */
    tables: string[];
}

/** Task data for an SQL split operation. */
export interface ILanguageWorkerSplitData {
    api: "split";
    language: ServiceLanguage;
    sql: string;
    delimiter: string;
    version: number;
}

/** Task data for SQL query determination */
export interface ILanguageWorkerQueryTypeData {
    api: "queryType";
    language: ServiceLanguage;
    sql: string;
    version: number;
}

/** Task data for query preprocessing. */
export interface ILanguageWorkerQueryPreprocessData {
    api: "preprocessStatement";
    language: ServiceLanguage;
    sql: string;
    offset: number;
    count: number;
    forceSecondaryEngine?: boolean;

    version: number;
    sqlMode: string;
}

/** Task data for semicolon append operation. */
export interface ILanguageWorkerApplySemicolonData {
    api: "addSemicolon";
    language: ServiceLanguage;
    sql: string;

    version: number;
    sqlMode: string;
}

/** Task data for an SQL validation operation. */
export interface ILanguageWorkerValidateData {
    api: "validate";
    language: ServiceLanguage;
    sql: string;
    version: number;
    sqlMode: string;
    offset: number;
}

/** Task data for quick info requests. */
export interface ILanguageWorkerInfoData {
    api: "info";
    language: ServiceLanguage;
    sql: string;
    offset: number;
    version: number;
}

/** Task data for an SQL code completion operation. */
export interface ILanguageWorkerSuggestionData {
    api: "suggestion";
    language: ServiceLanguage;
    sql: string;
    offset: number;
    line: number;
    column: number;
    currentSchema: string;
    version: number;
}

export interface ILanguageWorkerParameterData {
    api: "parameters";
    language: ServiceLanguage;
    sql: string;
    version: number;
    sqlMode: string;
}

interface ILanguageWorkerCleanupData {
    api: "cleanup";
    language: ServiceLanguage;
}

/** A statement consists of its text and its relative position within its block/context. */
export interface IStatement {
    /** The index of the statement in the statement list. */
    index: number;

    /** The text of the statement without delimiter. */
    text: string;

    /** The character offset of the statement in the containing model. */
    offset: number;

    /** The line number of the statement in the containing model. */
    line: number;

    /** Ditto for the column. */
    column: number;


    /** The length of the delimiter given for this statement. */
    delimiterLength?: number;
}

export interface ILanguageWorkerTokenizeData {
    api: "tokenize";
    language: ServiceLanguage;
    statements: IStatement[];
    version: number;
    sqlMode: string;
}

export type ILanguageWorkerTaskData =
    ILanguageWorkerSplitData |
    ILanguageWorkerQueryTypeData |
    ILanguageWorkerQueryPreprocessData |
    ILanguageWorkerApplySemicolonData |
    ILanguageWorkerValidateData |
    ILanguageWorkerInfoData |
    ILanguageWorkerSuggestionData |
    ILanguageWorkerParameterData |
    ILanguageWorkerCleanupData |
    ILanguageWorkerTokenizeData;

export interface ILanguageWorkerResultData extends IDictionary {
    content?: unknown;
    info?: ISymbolInfo;

    /** The rewritten query, after processing it. */
    query?: string;

    /** A flag, indicating that the query has been rewritten. */
    changed?: boolean;

    /** A flag, indicating that the query is updatable. */
    updatable?: boolean;

    /** The FQN of the table, if the query is a simple, single-table select. */
    fullTableName?: string;

    error?: string;
    tokens?: ITokenInfo[];

    completions?: ICompletionData;
    queryType?: QueryType;
    parameters?: Array<[string, string]>;

    /** A flag telling if this data block is the last one in a series. */
    final: boolean;
}

/** The record containing the result from the query pre-processing step. */
export interface IPreprocessResult {
    /** The rewritten query, after processing it. */
    query: string;

    /** A flag, indicating that the query has been rewritten. */
    changed: boolean;

    /** A flag, indicating that the query is updatable. */
    updatable: boolean;

    /** The FQN of the table, if the query is a simple, single-table select. */
    fullTableName?: string;
}

export enum ServiceLanguage {
    MySQL,
    Sqlite,
}

/** Note: changes here need to be reflected in the mapper to Monaco completion kinds (mapCompletionKind). */
export enum LanguageCompletionKind {
    Keyword,
    Schema,
    Table,
    View,
    Index,
    Column,
    Label,
    SystemFunction,
    Function,
    Procedure,
    Udf,
    Engine,
    Tablespace,
    UserVariable,
    SystemVariable,
    Charset,
    Collation,
    Event,
    User,
    Trigger,
    LogfileGroup,
    Plugin,
}

/** Describes the format of one data type entry in the JSON files for RDBMS data types. */
export interface IRdbmsDataTypeInfo {
    characterMaximumLength?: number;
    characterOctetLength?: number;
    numericPrecision?: number;
    numericPrecisionRadix?: number;
    numericScale?: number;
    dateTimePrecision?: number;
    intervalType?: string;
    intervalPrecision?: number;
    collation?: string;
    parameters?: ParameterFormatType[];
    description?: string;
    flags?: string[];
    needsQuotes?: boolean;
    parameterFormatType?: ParameterFormatType;
    synonyms?: string[];
}

export type ErrorReportCallback = (message: string, tokenType: number, start: number, line: number,
    column: number, length: number) => void;

/**
 * Searches the list of tokens in the token stream to find one that covers the given position.
 *
 * @param stream The stream with the tokens.
 * @param offset The character offset in the stream.
 *
 * @returns A token, if found at that position or undefined, if not.
 */
export const tokenFromPosition = (stream: CommonTokenStream, offset: number): Token | undefined => {
    const tokens = stream.getTokens();
    let low = 0;
    let high = tokens.length - 1;
    while (low < high) {
        const middle = low + Math.floor((high - low + 1) / 2);
        if (tokens[middle].start > offset) {
            high = middle - 1;
        } else {
            low = middle;
        }
    }

    // Do not count EOF as matchable token.
    if (low < tokens.length - 1) {
        return tokens[low];
    }

    // If we are at the end of the input then use the last non-EOF token.
    if (low > 0) {
        return tokens[low - 1];
    }

    // Happens only for empty input.
    return undefined;
};

/** A scanner adds some functionality on top of a token stream, for navigation between tokens, token checks and more. */
export class Scanner {

    private index = 0;
    private tokens: Token[] = [];
    private tokenStack: Stack<number> = new Stack();

    public constructor(private input: BufferedTokenStream) {
        this.input.fill();

        // The tokens are managed by the token stream, hence this must stay alive
        // at least as long as the scanner class that holds references to the stream's tokens.
        this.tokens = input.getTokens();
    }

    /**
     * Advances to the next token.
     *
     * @param skipHidden If true ignore hidden tokens.
     *
     * @returns False if we hit the last token before we could advance, true otherwise.
     */
    public next(skipHidden = true): boolean {
        while (this.index < this.tokens.length - 1) {
            ++this.index;
            if (this.tokens[this.index].channel === Token.DEFAULT_CHANNEL || !skipHidden) {
                return true;
            }
        }

        return false;
    }

    /**
     * Moves back to the previous token.
     *
     * @param skipHidden If true ignore hidden tokens.
     *
     * @returns False if we hit the last token before we could fully go back, true otherwise.
     */
    public previous(skipHidden = true): boolean {
        while (this.index > 0) {
            --this.index;
            if (this.tokens[this.index].channel === 0 || !skipHidden) {
                return true;
            }
        }

        return false;
    }

    /**
     * Advances to the token that covers the given line and char offset.
     *
     * Note: this function also considers hidden token.
     *
     * @param line One-base line number.
     * @param offset Zero-based column number.
     *
     * @returns True if such a node exists, false otherwise (no change performed then).
     */
    public advanceToPosition(line: number, offset: number): boolean {
        let i = 0;
        for (; i < this.tokens.length; i++) {
            const run = this.tokens[i];
            const tokenLine = run.line;
            if (tokenLine >= line) {
                const tokenOffset = run.column;
                const tokenLength = run.stop - run.start + 1;
                if (tokenLine === line && tokenOffset <= offset && offset < tokenOffset + tokenLength) {
                    this.index = i;
                    break;
                }

                if (tokenLine > line || tokenOffset > offset) {
                    // We reached a token after the current offset. Take the previous one as result then.
                    if (i === 0) {
                        return false;
                    }

                    this.index = i - 1;
                    break;
                }
            }
        }

        if (i === this.tokens.length) {
            this.index = i - 1; // Nothing found, take the last token instead.
        }

        return true;
    }

    /**
     * Advances to the next token with the given lexical type.
     *
     * @param type The token type to search.
     *
     * @returns True if such a node exists, false otherwise (no change performed then).
     */
    public advanceToType(type: number): boolean {
        for (let i = this.index + 1; i < this.tokens.length; ++i) {
            if (this.tokens[i].type === type) {
                this.index = i;

                return true;
            }
        }

        return false;
    }

    /**
     * Steps over a number of tokens and positions.
     * The tokens are traversed in exactly the given order without intermediate tokens. The current token must be
     * startToken. Any non-default channel token is skipped before testing for the next token in the sequence.
     *
     * @param sequence A list of token types to skip.
     *
     * @returns True if all the given tokens were found and there is another token after the last token
     *          in the list, false otherwise. If the token sequence could not be found or there is no more
     *          token the internal state is undefined.
     */
    public skipTokenSequence(...sequence: number[]): boolean {
        for (const token of sequence) {
            if (this.tokens[this.index].type !== token) {
                return false;
            }

            while (++this.index < this.tokens.length && this.tokens[this.index].channel !== Token.DEFAULT_CHANNEL) {
                // Just loop.
            }

            if (this.index === this.tokens.length) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns the type of the next token without changing the internal state.
     *
     * @param skipHidden Indicates if hidden tokens should be ignored.
     *
     * @returns The next token type.
     */
    public lookAhead(skipHidden = true): number {
        let index = this.index;
        while (index < this.tokens.length - 1) {
            ++index;
            if (this.tokens[index].channel === Token.DEFAULT_CHANNEL || !skipHidden) {
                return this.tokens[index].type;
            }
        }

        return Token.INVALID_TYPE;
    }

    /**
     * Look back in the stream (physical order) what was before the current token, without
     * modifying the current position.
     *
     * @param skipHidden Indicates if hidden tokens should be ignored.
     *
     * @returns The previous token type.
     */
    public lookBack(skipHidden = true): number {
        let index = this.index;
        while (index > 0) {
            --index;
            if (this.tokens[index].channel === Token.DEFAULT_CHANNEL || !skipHidden) {
                return this.tokens[index].type;
            }
        }

        return Token.INVALID_TYPE;
    }

    /**
     * Sets the internal token index to the given value. Following navigation is done relative to this new index.
     *
     * @param index The index to set. Must be within the valid token range.
     */
    public seek(index: number): void {
        if (index >= 0 && index < this.tokens.length) {
            this.index = index;
        }
    }

    /**
     * Resets the walker to position 0 and removes all stacked positions.
     *
     * @param reloadInput If true the input is reloaded from the token stream.
     */
    public reset(reloadInput = false): void {
        this.index = 0;
        this.tokenStack = new Stack();

        if (reloadInput) {
            this.input.reset();
            this.tokens = this.input.getTokens();
        }
    }

    /**
     * Stores the current node on the stack, so we can easily come back when needed.
     */
    public push(): void {
        this.tokenStack.push(this.index);
    }

    /**
     * Returns to the location at the top of the token stack (if any).
     *
     * @returns True if we could move, false otherwise.
     */
    public pop(): boolean {
        if (this.tokenStack.empty) {
            return false;
        }

        this.index = this.tokenStack.top!;
        this.tokenStack.pop();

        return true;
    }

    /**
     * Removes the current top of stack entry without restoring the internal state.
     * Does nothing if the stack is empty.
     */
    public removeTos(): void {
        if (!this.tokenStack.empty) {
            this.tokenStack.pop();
        }
    }

    /**
     * Returns true if the current token is of the given type.
     *
     * @param type The token type to check for.
     *
     * @returns True if the current token is of the given type, false otherwise.
     */
    public is(type: number): boolean {
        return this.tokens[this.index].type === type;
    }

    /**
     * @returns The text of the current token.
     */
    public get tokenText(): string {
        return this.tokens[this.index].text ?? "";
    }

    /**
     * @returns The type of the current token. Same as the type you can specify in advanceTo().
     */
    public get tokenType(): number {
        return this.tokens[this.index].type;
    }

    /**
     * @returns The (one-base) line number of the token.
     */
    public get tokenLine(): number {
        return this.tokens[this.index].line;
    }

    /**
     * @returns The (zero-based) character offset of the token on its line.
     */
    public get tokenStart(): number {
        return this.tokens[this.index].column;
    }

    /**
     * @returns The (zero-based) index of the current token within the input.
     */
    public get tokenIndex(): number {
        return this.tokens[this.index].tokenIndex; // Usually the same as this.index.
    }

    /**
     * @returns The offset of the token in its source string.
     */
    public get tokenOffset(): number {
        return this.tokens[this.index].start;
    }

    /**
     * @returns The length of the token in bytes.
     */
    public get tokenLength(): number {
        const token = this.tokens[this.index];

        return token.stop - token.start + 1;
    }

    /**
     * @returns The channel of the current token.
     */
    public get tokenChannel(): number {
        return this.tokens[this.index].channel;
    }

    /**
     * @returns All the original text from the current token to the end.
     */
    public get tokenSubText(): string {
        const cs = this.tokens[this.index].tokenSource?.inputStream;

        return cs?.getTextFromRange(this.tokens[this.index].start, 1e100) ?? "";
    }

}
