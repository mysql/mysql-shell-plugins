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

/* eslint-disable no-underscore-dangle */

import { Lexer, Token } from "antlr4ng";

import { QueryType } from "../parser-common.js";

import { MySQLMRSLexer } from "./generated/MySQLMRSLexer.js";
import {
    IMySQLRecognizerCommon, SqlMode, isReservedKeyword, numberToVersion, isKeyword,
} from "./MySQLRecognizerCommon.js";

// The base lexer class provides a number of functions needed in actions in the lexer (grammar).
export abstract class MySQLBaseLexer extends Lexer implements IMySQLRecognizerCommon {
    public serverVersion = 0;
    public sqlModes = new Set<SqlMode>();

    /** Enable MRS specific language parts. */
    public supportMrs = true;

    /** Enable Multi Language Extension support. */
    public supportMle = true;

    public readonly charsets: Set<string> = new Set(); // Used to check repertoires.
    protected inVersionComment = false;

    private pendingTokens: Token[] = [];
    private symbols: Map<string, number> = new Map(); // A list of all defined symbols for lookup.

    static #longString = "2147483647";
    static #longLength = 10;
    static #signedLongString = "-2147483648";
    static #longLongString = "9223372036854775807";
    static #longLongLength = 19;
    static #signedLongLongString = "-9223372036854775808";
    static #signedLongLongLength = 19;
    static #unsignedLongLongString = "18446744073709551615";
    static #unsignedLongLongLength = 20;

    /**
     * Determines if the given type is a relational operator.
     *
     * @param type The type to check.
     *
     * @returns True if the type is a relational operator.
     */
    public static isRelation(type: number): boolean {
        switch (type) {
            case MySQLMRSLexer.EQUAL_OPERATOR:
            case MySQLMRSLexer.ASSIGN_OPERATOR:
            case MySQLMRSLexer.NULL_SAFE_EQUAL_OPERATOR:
            case MySQLMRSLexer.GREATER_OR_EQUAL_OPERATOR:
            case MySQLMRSLexer.GREATER_THAN_OPERATOR:
            case MySQLMRSLexer.LESS_OR_EQUAL_OPERATOR:
            case MySQLMRSLexer.LESS_THAN_OPERATOR:
            case MySQLMRSLexer.NOT_EQUAL_OPERATOR:
            case MySQLMRSLexer.NOT_EQUAL2_OPERATOR:
            case MySQLMRSLexer.PLUS_OPERATOR:
            case MySQLMRSLexer.MINUS_OPERATOR:
            case MySQLMRSLexer.MULT_OPERATOR:
            case MySQLMRSLexer.DIV_OPERATOR:
            case MySQLMRSLexer.MOD_OPERATOR:
            case MySQLMRSLexer.LOGICAL_NOT_OPERATOR:
            case MySQLMRSLexer.BITWISE_NOT_OPERATOR:
            case MySQLMRSLexer.SHIFT_LEFT_OPERATOR:
            case MySQLMRSLexer.SHIFT_RIGHT_OPERATOR:
            case MySQLMRSLexer.LOGICAL_AND_OPERATOR:
            case MySQLMRSLexer.BITWISE_AND_OPERATOR:
            case MySQLMRSLexer.BITWISE_XOR_OPERATOR:
            case MySQLMRSLexer.LOGICAL_OR_OPERATOR:
            case MySQLMRSLexer.BITWISE_OR_OPERATOR:
            case MySQLMRSLexer.OR_SYMBOL:
            case MySQLMRSLexer.XOR_SYMBOL:
            case MySQLMRSLexer.AND_SYMBOL:
            case MySQLMRSLexer.IS_SYMBOL:
            case MySQLMRSLexer.BETWEEN_SYMBOL:
            case MySQLMRSLexer.LIKE_SYMBOL:
            case MySQLMRSLexer.REGEXP_SYMBOL:
            case MySQLMRSLexer.IN_SYMBOL:
            case MySQLMRSLexer.SOUNDS_SYMBOL:
            case MySQLMRSLexer.NOT_SYMBOL: {
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
            case MySQLMRSLexer.INT_NUMBER:
            case MySQLMRSLexer.LONG_NUMBER:
            case MySQLMRSLexer.ULONGLONG_NUMBER:
            case MySQLMRSLexer.FLOAT_NUMBER:
            case MySQLMRSLexer.HEX_NUMBER:
            case MySQLMRSLexer.BIN_NUMBER:
            case MySQLMRSLexer.DECIMAL_NUMBER: {
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
     * @returns True if the type is an operator.
     */
    public isDelimiter(type: number): boolean {
        switch (type) {
            case MySQLMRSLexer.DOT_SYMBOL:
            case MySQLMRSLexer.COMMA_SYMBOL:
            case MySQLMRSLexer.SEMICOLON_SYMBOL:
            case MySQLMRSLexer.COLON_SYMBOL:
                return true;

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
            case MySQLMRSLexer.EQUAL_OPERATOR:
            case MySQLMRSLexer.ASSIGN_OPERATOR:
            case MySQLMRSLexer.NULL_SAFE_EQUAL_OPERATOR:
            case MySQLMRSLexer.GREATER_OR_EQUAL_OPERATOR:
            case MySQLMRSLexer.GREATER_THAN_OPERATOR:
            case MySQLMRSLexer.LESS_OR_EQUAL_OPERATOR:
            case MySQLMRSLexer.LESS_THAN_OPERATOR:
            case MySQLMRSLexer.NOT_EQUAL_OPERATOR:
            case MySQLMRSLexer.NOT_EQUAL2_OPERATOR:
            case MySQLMRSLexer.PLUS_OPERATOR:
            case MySQLMRSLexer.MINUS_OPERATOR:
            case MySQLMRSLexer.MULT_OPERATOR:
            case MySQLMRSLexer.DIV_OPERATOR:
            case MySQLMRSLexer.MOD_OPERATOR:
            case MySQLMRSLexer.LOGICAL_NOT_OPERATOR:
            case MySQLMRSLexer.BITWISE_NOT_OPERATOR:
            case MySQLMRSLexer.SHIFT_LEFT_OPERATOR:
            case MySQLMRSLexer.SHIFT_RIGHT_OPERATOR:
            case MySQLMRSLexer.LOGICAL_AND_OPERATOR:
            case MySQLMRSLexer.BITWISE_AND_OPERATOR:
            case MySQLMRSLexer.BITWISE_XOR_OPERATOR:
            case MySQLMRSLexer.LOGICAL_OR_OPERATOR:
            case MySQLMRSLexer.BITWISE_OR_OPERATOR:
            case MySQLMRSLexer.DOT_SYMBOL:
            case MySQLMRSLexer.COMMA_SYMBOL:
            case MySQLMRSLexer.SEMICOLON_SYMBOL:
            case MySQLMRSLexer.COLON_SYMBOL:
            case MySQLMRSLexer.OPEN_PAR_SYMBOL:
            case MySQLMRSLexer.CLOSE_PAR_SYMBOL:
            case MySQLMRSLexer.AT_SIGN_SYMBOL:
            case MySQLMRSLexer.AT_AT_SIGN_SYMBOL:
            case MySQLMRSLexer.PARAM_MARKER:
                return true;

            default:
                return false;
        }
    }

    /**
     * Determines if the given SQL mode is currently active in the lexer.
     *
     * @param mode The mode to check.
     *
     * @returns True if the mode is one of the currently active modes.
     */
    public isSqlModeActive(mode: SqlMode): boolean {
        return this.sqlModes.has(mode);
    }

    /**
     * Converts a mode string into individual mode flags.
     *
     * @param modes The input string to parse.
     */
    public sqlModeFromString(modes: string): void {
        this.sqlModes = new Set<SqlMode>();

        const parts = modes.toUpperCase().split(",");
        parts.forEach((mode: string) => {
            if (mode === "ANSI" || mode === "DB2" || mode === "MAXDB" || mode === "MSSQL" || mode === "ORACLE" ||
                mode === "POSTGRESQL") {
                this.sqlModes.add(SqlMode.AnsiQuotes).add(SqlMode.PipesAsConcat).add(SqlMode.IgnoreSpace);
            } else if (mode === "ANSI_QUOTES") {
                this.sqlModes.add(SqlMode.AnsiQuotes);
            } else if (mode === "PIPES_AS_CONCAT") {
                this.sqlModes.add(SqlMode.PipesAsConcat);
            } else if (mode === "NO_BACKSLASH_ESCAPES") {
                this.sqlModes.add(SqlMode.NoBackslashEscapes);
            } else if (mode === "IGNORE_SPACE") {
                this.sqlModes.add(SqlMode.IgnoreSpace);
            } else if (mode === "HIGH_NOT_PRECEDENCE" || mode === "MYSQL323" || mode === "MYSQL40") {
                this.sqlModes.add(SqlMode.HighNotPrecedence);
            }
        });
    }

    /**
     * Resets the lexer by setting initial values to transient member, resetting the input stream position etc.
     */
    public reset(): void {
        this.inVersionComment = false;
        super.reset();
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
        if (type === MySQLMRSLexer.EOF) {
            return false;
        }

        if ((type === MySQLMRSLexer.IDENTIFIER) || (type === MySQLMRSLexer.BACK_TICK_QUOTED_ID)) {
            return true;
        }

        // Double quoted text represents identifiers only if the ANSI QUOTES sql mode is active.
        if (type === MySQLMRSLexer.DOUBLE_QUOTED_TEXT) {
            return this.sqlModes.has(SqlMode.AnsiQuotes);
        }

        const symbol = this.vocabulary.getSymbolicName(type);
        if (symbol && symbol.endsWith("_SYMBOL")) {
            if (!isReservedKeyword(symbol.substring(0, symbol.length - "_SYMBOL".length),
                numberToVersion(this.serverVersion))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Converts a string to a keyword token type, if it represents a keyword.
     *
     * @param name The text to parse.
     *
     * @returns The type of the token in name (if valid) or -2, if not (-1 is reserved for EOF).
     */
    public keywordFromText(name: string): number {
        // (My)SQL only uses ASCII chars for keywords so we can do a simple case conversion here for comparison.
        name = name.toUpperCase();

        if (!isKeyword(name, numberToVersion(this.serverVersion))) {
            return -2; // -1 can be interpreted as EOF.
        }

        // Generate string -> enum value map, if not yet done.
        if (this.symbols.size === 0) {
            const max = this.vocabulary.maxTokenType;
            for (let i = 0; i <= max; ++i) {
                const symbolName = this.vocabulary.getSymbolicName(i);
                if (symbolName && symbolName.endsWith("_SYMBOL")) {
                    this.symbols.set(symbolName.substring(0, symbolName.length - "_SYMBOL".length).toUpperCase(), i);
                }
            }
        }

        // Here we know for sure we got a keyword.
        return this.symbols.get(name) ?? -2;
    }

    // Scans from the current token position to find out which query type we are dealing with in the input.
    public determineQueryType(): QueryType {
        let token = this.nextDefaultChannelToken();
        if (token.type === Token.EOF) {
            return QueryType.Unknown;
        }

        switch (token.type) {
            case MySQLMRSLexer.ALTER_SYMBOL:
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLMRSLexer.DATABASE_SYMBOL: {
                        return QueryType.AlterDatabase;
                    }

                    case MySQLMRSLexer.LOGFILE_SYMBOL: {
                        return QueryType.AlterLogFileGroup;
                    }

                    case MySQLMRSLexer.FUNCTION_SYMBOL: {
                        return QueryType.AlterFunction;
                    }

                    case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                        return QueryType.AlterProcedure;
                    }

                    case MySQLMRSLexer.SERVER_SYMBOL: {
                        return QueryType.AlterServer;
                    }

                    case MySQLMRSLexer.TABLE_SYMBOL:
                    case MySQLMRSLexer.ONLINE_SYMBOL:  // Optional part of ALTER TABLE.
                    case MySQLMRSLexer.OFFLINE_SYMBOL: // ditto
                    case MySQLMRSLexer.IGNORE_SYMBOL: {
                        return QueryType.AlterTable;
                    }

                    case MySQLMRSLexer.TABLESPACE_SYMBOL: {
                        return QueryType.AlterTableSpace;
                    }

                    case MySQLMRSLexer.EVENT_SYMBOL: {
                        return QueryType.AlterEvent;
                    }

                    case MySQLMRSLexer.VIEW_SYMBOL: {
                        return QueryType.AlterView;
                    }

                    case MySQLMRSLexer.DEFINER_SYMBOL: { // Can be both event or view.
                        if (!this.skipDefiner()) {
                            return QueryType.Ambiguous;
                        }
                        token = this.nextDefaultChannelToken();

                        switch (token.type) {
                            case MySQLMRSLexer.EVENT_SYMBOL: {
                                return QueryType.AlterEvent;
                            }

                            case MySQLMRSLexer.SQL_SYMBOL:
                            case MySQLMRSLexer.VIEW_SYMBOL: {
                                return QueryType.AlterView;
                            }

                            default: {
                                return QueryType.Unknown;
                            }
                        }
                    }

                    case MySQLMRSLexer.ALGORITHM_SYMBOL: { // Optional part of CREATE VIEW.
                        return QueryType.AlterView;
                    }

                    case MySQLMRSLexer.USER_SYMBOL: {
                        return QueryType.AlterUser;
                    }

                    case MySQLMRSLexer.REST_SYMBOL: {
                        return QueryType.Rest;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }

            case MySQLMRSLexer.CREATE_SYMBOL: {
                token = this.nextDefaultChannelToken();
                // Skip OR REPLACE
                if (token.type === MySQLMRSLexer.OR_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === MySQLMRSLexer.REPLACE_SYMBOL) {
                        token = this.nextDefaultChannelToken();
                    }
                }
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLMRSLexer.TEMPORARY_SYMBOL: // Optional part of CREATE TABLE.
                    case MySQLMRSLexer.TABLE_SYMBOL: {
                        return QueryType.CreateTable;
                    }

                    case MySQLMRSLexer.ONLINE_SYMBOL:
                    case MySQLMRSLexer.OFFLINE_SYMBOL:
                    case MySQLMRSLexer.INDEX_SYMBOL:
                    case MySQLMRSLexer.UNIQUE_SYMBOL:
                    case MySQLMRSLexer.FULLTEXT_SYMBOL:
                    case MySQLMRSLexer.SPATIAL_SYMBOL: {
                        return QueryType.CreateIndex;
                    }

                    case MySQLMRSLexer.DATABASE_SYMBOL: {
                        return QueryType.CreateDatabase;
                    }

                    case MySQLMRSLexer.TRIGGER_SYMBOL: {
                        return QueryType.CreateTrigger;
                    }

                    case MySQLMRSLexer.DEFINER_SYMBOL: { // Can be event, view, procedure, function, UDF, trigger.
                        if (!this.skipDefiner()) {
                            return QueryType.Ambiguous;
                        }

                        token = this.nextDefaultChannelToken();
                        switch (token.type) {
                            case MySQLMRSLexer.EVENT_SYMBOL: {
                                return QueryType.CreateEvent;
                            }

                            case MySQLMRSLexer.VIEW_SYMBOL:
                            case MySQLMRSLexer.SQL_SYMBOL: {
                                return QueryType.CreateView;
                            }

                            case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                                return QueryType.CreateProcedure;
                            }

                            case MySQLMRSLexer.FUNCTION_SYMBOL: {
                                token = this.nextDefaultChannelToken();
                                if (token.type === Token.EOF) {
                                    return QueryType.Ambiguous;
                                }

                                if (!this.isIdentifier(token.type)) {
                                    return QueryType.Ambiguous;
                                }

                                token = this.nextDefaultChannelToken();
                                if (token.type === MySQLMRSLexer.RETURNS_SYMBOL) {
                                    return QueryType.CreateUdf;
                                }

                                return QueryType.CreateFunction;
                            }

                            case MySQLMRSLexer.AGGREGATE_SYMBOL: {
                                return QueryType.CreateUdf;
                            }

                            case MySQLMRSLexer.TRIGGER_SYMBOL: {
                                return QueryType.CreateTrigger;
                            }

                            default: {
                                return QueryType.Unknown;
                            }
                        }
                    }

                    case MySQLMRSLexer.VIEW_SYMBOL:
                    case MySQLMRSLexer.ALGORITHM_SYMBOL: { // CREATE ALGORITHM ... VIEW
                        return QueryType.CreateView;
                    }

                    case MySQLMRSLexer.EVENT_SYMBOL: {
                        return QueryType.CreateEvent;
                    }

                    case MySQLMRSLexer.FUNCTION_SYMBOL: {
                        return QueryType.CreateFunction;
                    }

                    case MySQLMRSLexer.AGGREGATE_SYMBOL: {
                        return QueryType.CreateUdf;
                    }

                    case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                        return QueryType.CreateProcedure;
                    }

                    case MySQLMRSLexer.LOGFILE_SYMBOL: {
                        return QueryType.CreateLogFileGroup;
                    }

                    case MySQLMRSLexer.SERVER_SYMBOL: {
                        return QueryType.CreateServer;
                    }

                    case MySQLMRSLexer.TABLESPACE_SYMBOL: {
                        return QueryType.CreateTableSpace;
                    }

                    case MySQLMRSLexer.USER_SYMBOL: {
                        return QueryType.CreateUser;
                    }

                    case MySQLMRSLexer.REST_SYMBOL: {
                        return QueryType.Rest;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLMRSLexer.DROP_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLMRSLexer.DATABASE_SYMBOL: {
                        return QueryType.DropDatabase;
                    }

                    case MySQLMRSLexer.EVENT_SYMBOL: {
                        return QueryType.DropEvent;
                    }

                    case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                        return QueryType.DropProcedure;
                    }

                    case MySQLMRSLexer.FUNCTION_SYMBOL: {
                        return QueryType.DropFunction;
                    }

                    case MySQLMRSLexer.ONLINE_SYMBOL:
                    case MySQLMRSLexer.OFFLINE_SYMBOL:
                    case MySQLMRSLexer.INDEX_SYMBOL: {
                        return QueryType.DropIndex;
                    }

                    case MySQLMRSLexer.LOGFILE_SYMBOL: {
                        return QueryType.DropLogfileGroup;
                    }

                    case MySQLMRSLexer.SERVER_SYMBOL: {
                        return QueryType.DropServer;
                    }

                    case MySQLMRSLexer.TEMPORARY_SYMBOL:
                    case MySQLMRSLexer.TABLE_SYMBOL:
                    case MySQLMRSLexer.TABLES_SYMBOL: {
                        return QueryType.DropTable;
                    }

                    case MySQLMRSLexer.TABLESPACE_SYMBOL: {
                        return QueryType.DropTablespace;
                    }

                    case MySQLMRSLexer.TRIGGER_SYMBOL: {
                        return QueryType.DropTrigger;
                    }

                    case MySQLMRSLexer.VIEW_SYMBOL: {
                        return QueryType.DropView;
                    }

                    case MySQLMRSLexer.PREPARE_SYMBOL: {
                        return QueryType.Deallocate;
                    }

                    case MySQLMRSLexer.USER_SYMBOL: {
                        return QueryType.DropUser;
                    }

                    case MySQLMRSLexer.REST_SYMBOL: {
                        return QueryType.Rest;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLMRSLexer.TRUNCATE_SYMBOL: {
                return QueryType.TruncateTable;
            }

            case MySQLMRSLexer.CALL_SYMBOL: {
                return QueryType.Call;
            }

            case MySQLMRSLexer.DELETE_SYMBOL: {
                return QueryType.Delete;
            }

            case MySQLMRSLexer.DO_SYMBOL: {
                return QueryType.Do;
            }

            case MySQLMRSLexer.HANDLER_SYMBOL: {
                return QueryType.Handler;
            }

            case MySQLMRSLexer.INSERT_SYMBOL: {
                return QueryType.Insert;
            }

            case MySQLMRSLexer.LOAD_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLMRSLexer.DATA_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLMRSLexer.FROM_SYMBOL) {
                            return QueryType.LoadDataMaster;
                        }

                        return QueryType.LoadData;
                    }
                    case MySQLMRSLexer.XML_SYMBOL: {
                        return QueryType.LoadXML;
                    }

                    case MySQLMRSLexer.TABLE_SYMBOL: {
                        return QueryType.LoadTableMaster;
                    }

                    case MySQLMRSLexer.INDEX_SYMBOL: {
                        return QueryType.LoadIndex;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLMRSLexer.REPLACE_SYMBOL: {
                return QueryType.Replace;
            }

            case MySQLMRSLexer.SELECT_SYMBOL: {
                return QueryType.Select;
            }

            case MySQLMRSLexer.TABLE_SYMBOL: {
                return QueryType.Table;
            }

            case MySQLMRSLexer.VALUES_SYMBOL: {
                return QueryType.Values;
            }

            case MySQLMRSLexer.UPDATE_SYMBOL: {
                return QueryType.Update;
            }

            case MySQLMRSLexer.OPEN_PAR_SYMBOL: { // (((select ...)))
                while (token.type === MySQLMRSLexer.OPEN_PAR_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.Ambiguous;
                    }
                }
                if (token.type === MySQLMRSLexer.SELECT_SYMBOL) {
                    return QueryType.Select;
                }

                return QueryType.Unknown;
            }

            case MySQLMRSLexer.START_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLMRSLexer.TRANSACTION_SYMBOL) {
                    return QueryType.StartTransaction;
                }

                return QueryType.StartSlave;
            }

            case MySQLMRSLexer.BEGIN_SYMBOL: { // Begin directly at the start of the query must be a transaction start.
                return QueryType.BeginWork;
            }

            case MySQLMRSLexer.COMMIT_SYMBOL: {
                return QueryType.Commit;
            }

            case MySQLMRSLexer.ROLLBACK_SYMBOL: {
                // We assume a transaction statement here unless we exactly know it's about a savepoint.
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.RollbackWork;
                }
                if (token.type === MySQLMRSLexer.WORK_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.RollbackWork;
                    }
                }

                if (token.type === MySQLMRSLexer.TO_SYMBOL) {
                    return QueryType.RollbackSavePoint;
                }

                return QueryType.RollbackWork;
            }

            case MySQLMRSLexer.SET_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Set;
                }

                switch (token.type) {
                    case MySQLMRSLexer.PASSWORD_SYMBOL: {
                        return QueryType.SetPassword;
                    }

                    case MySQLMRSLexer.GLOBAL_SYMBOL:
                    case MySQLMRSLexer.LOCAL_SYMBOL:
                    case MySQLMRSLexer.SESSION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Set;
                        }
                        break;
                    }

                    case MySQLMRSLexer.IDENTIFIER: {
                        const text = (token.text || "").toLowerCase();
                        if (text === "autocommit") {
                            return QueryType.SetAutoCommit;
                        }
                        break;
                    }

                    case MySQLMRSLexer.TRANSACTION_SYMBOL: {
                        return QueryType.SetTransaction;
                    }

                    default: {
                        return QueryType.Set;
                    }
                }

                return QueryType.Set;
            }

            case MySQLMRSLexer.SAVEPOINT_SYMBOL: {
                return QueryType.SavePoint;
            }

            case MySQLMRSLexer.RELEASE_SYMBOL: { // Release at the start of the query, obviously.
                return QueryType.ReleaseSavePoint;
            }

            case MySQLMRSLexer.LOCK_SYMBOL: {
                return QueryType.Lock;
            }

            case MySQLMRSLexer.UNLOCK_SYMBOL: {
                return QueryType.Unlock;
            }

            case MySQLMRSLexer.XA_SYMBOL: {
                return QueryType.XA;
            }

            case MySQLMRSLexer.PURGE_SYMBOL: {
                return QueryType.Purge;
            }

            case MySQLMRSLexer.CHANGE_SYMBOL: {
                return QueryType.ChangeMaster;
            }

            case MySQLMRSLexer.RESET_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Reset;
                }

                switch (token.type) {
                    case MySQLMRSLexer.MASTER_SYMBOL: {
                        return QueryType.ResetMaster;
                    }
                    case MySQLMRSLexer.SLAVE_SYMBOL: {
                        return QueryType.ResetSlave;
                    }
                    default: {
                        return QueryType.Reset;
                    }
                }
            }

            case MySQLMRSLexer.STOP_SYMBOL: {
                return QueryType.StopSlave;
            }

            case MySQLMRSLexer.PREPARE_SYMBOL: {
                return QueryType.Prepare;
            }

            case MySQLMRSLexer.EXECUTE_SYMBOL: {
                return QueryType.Execute;
            }

            case MySQLMRSLexer.DEALLOCATE_SYMBOL: {
                return QueryType.Deallocate;
            }

            case MySQLMRSLexer.GRANT_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLMRSLexer.PROXY_SYMBOL) {
                    return QueryType.GrantProxy;
                }

                return QueryType.Grant;
            }

            case MySQLMRSLexer.RENAME_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLMRSLexer.USER_SYMBOL) {
                    return QueryType.RenameUser;
                }

                return QueryType.RenameTable;
            }

            case MySQLMRSLexer.REVOKE_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLMRSLexer.PROXY_SYMBOL) {
                    return QueryType.RevokeProxy;
                }

                return QueryType.Revoke;
            }

            case MySQLMRSLexer.ANALYZE_SYMBOL: {
                return QueryType.AnalyzeTable;
            }

            case MySQLMRSLexer.CHECK_SYMBOL: {
                return QueryType.CheckTable;
            }

            case MySQLMRSLexer.CHECKSUM_SYMBOL: {
                return QueryType.ChecksumTable;
            }

            case MySQLMRSLexer.OPTIMIZE_SYMBOL: {
                return QueryType.OptimizeTable;
            }

            case MySQLMRSLexer.REPAIR_SYMBOL: {
                return QueryType.RepairTable;
            }

            case MySQLMRSLexer.BACKUP_SYMBOL: {
                return QueryType.BackUpTable;
            }

            case MySQLMRSLexer.RESTORE_SYMBOL: {
                return QueryType.RestoreTable;
            }

            case MySQLMRSLexer.INSTALL_SYMBOL: {
                return QueryType.InstallPlugin;
            }

            case MySQLMRSLexer.UNINSTALL_SYMBOL: {
                return QueryType.UninstallPlugin;
            }

            case MySQLMRSLexer.SHOW_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Show;
                }

                if (token.type === MySQLMRSLexer.FULL_SYMBOL) {
                    // Not all SHOW cases allow an optional FULL keyword, but this is not about checking for
                    // a valid query but to find the most likely type.
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.Show;
                    }
                }

                switch (token.type) {
                    case MySQLMRSLexer.GLOBAL_SYMBOL:
                    case MySQLMRSLexer.LOCK_SYMBOL:
                    case MySQLMRSLexer.SESSION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        if (token.type === MySQLMRSLexer.STATUS_SYMBOL) {
                            return QueryType.ShowStatus;
                        }

                        return QueryType.ShowVariables;
                    }

                    case MySQLMRSLexer.BINARY_SYMBOL: {
                        return QueryType.ShowBinaryLogs;
                    }

                    case MySQLMRSLexer.BINLOG_SYMBOL: {
                        return QueryType.ShowBinLogEvents;
                    }

                    case MySQLMRSLexer.RELAYLOG_SYMBOL: {
                        return QueryType.ShowRelayLogEvents;
                    }

                    case MySQLMRSLexer.CHAR_SYMBOL:
                    case MySQLMRSLexer.CHARSET_SYMBOL: {
                        return QueryType.ShowCharset;
                    }

                    case MySQLMRSLexer.COLLATION_SYMBOL: {
                        return QueryType.ShowCollation;
                    }

                    case MySQLMRSLexer.COLUMNS_SYMBOL: {
                        return QueryType.ShowColumns;
                    }

                    case MySQLMRSLexer.COUNT_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLMRSLexer.OPEN_PAR_SYMBOL) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLMRSLexer.MULT_OPERATOR) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLMRSLexer.CLOSE_PAR_SYMBOL) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        switch (token.type) {
                            case MySQLMRSLexer.WARNINGS_SYMBOL: {
                                return QueryType.ShowWarnings;
                            }

                            case MySQLMRSLexer.ERRORS_SYMBOL: {
                                return QueryType.ShowErrors;
                            }

                            default: {
                                return QueryType.Show;
                            }
                        }
                    }

                    case MySQLMRSLexer.CREATE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        switch (token.type) {
                            case MySQLMRSLexer.DATABASE_SYMBOL: {
                                return QueryType.ShowCreateDatabase;
                            }

                            case MySQLMRSLexer.EVENT_SYMBOL: {
                                return QueryType.ShowCreateEvent;
                            }

                            case MySQLMRSLexer.FUNCTION_SYMBOL: {
                                return QueryType.ShowCreateFunction;
                            }

                            case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                                return QueryType.ShowCreateProcedure;
                            }

                            case MySQLMRSLexer.TABLE_SYMBOL: {
                                return QueryType.ShowCreateTable;
                            }

                            case MySQLMRSLexer.TRIGGER_SYMBOL: {
                                return QueryType.ShowCreateTrigger;
                            }

                            case MySQLMRSLexer.VIEW_SYMBOL: {
                                return QueryType.ShowCreateView;
                            }

                            case MySQLMRSLexer.REST_SYMBOL: {
                                return QueryType.Rest;
                            }

                            default: {
                                return QueryType.Show;
                            }
                        }
                    }

                    case MySQLMRSLexer.DATABASES_SYMBOL: {
                        return QueryType.ShowDatabases;
                    }

                    case MySQLMRSLexer.ENGINE_SYMBOL: {
                        return QueryType.ShowEngineStatus;
                    }

                    case MySQLMRSLexer.STORAGE_SYMBOL:
                    case MySQLMRSLexer.ENGINES_SYMBOL: {
                        return QueryType.ShowStorageEngines;
                    }

                    case MySQLMRSLexer.ERRORS_SYMBOL: {
                        return QueryType.ShowErrors;
                    }

                    case MySQLMRSLexer.EVENTS_SYMBOL: {
                        return QueryType.ShowEvents;
                    }

                    case MySQLMRSLexer.FUNCTION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLMRSLexer.CODE_SYMBOL) {
                            return QueryType.ShowFunctionCode;
                        }

                        return QueryType.ShowFunctionStatus;
                    }

                    case MySQLMRSLexer.GRANT_SYMBOL: {
                        return QueryType.ShowGrants;
                    }

                    case MySQLMRSLexer.INDEX_SYMBOL:
                    case MySQLMRSLexer.INDEXES_SYMBOL:
                    case MySQLMRSLexer.KEY_SYMBOL: {
                        return QueryType.ShowIndexes;
                    }

                    case MySQLMRSLexer.MASTER_SYMBOL: {
                        return QueryType.ShowMasterStatus;
                    }

                    case MySQLMRSLexer.OPEN_SYMBOL: {
                        return QueryType.ShowOpenTables;
                    }

                    case MySQLMRSLexer.PLUGIN_SYMBOL:
                    case MySQLMRSLexer.PLUGINS_SYMBOL: {
                        return QueryType.ShowPlugins;
                    }

                    case MySQLMRSLexer.PROCEDURE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        if (token.type === MySQLMRSLexer.STATUS_SYMBOL) {
                            return QueryType.ShowProcedureStatus;
                        }

                        return QueryType.ShowProcedureCode;
                    }

                    case MySQLMRSLexer.PRIVILEGES_SYMBOL: {
                        return QueryType.ShowPrivileges;
                    }

                    case MySQLMRSLexer.FULL_SYMBOL:
                    case MySQLMRSLexer.PROCESSLIST_SYMBOL: {
                        return QueryType.ShowProcessList;
                    }

                    case MySQLMRSLexer.PROFILE_SYMBOL: {
                        return QueryType.ShowProfile;
                    }

                    case MySQLMRSLexer.PROFILES_SYMBOL: {
                        return QueryType.ShowProfiles;
                    }

                    case MySQLMRSLexer.SLAVE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLMRSLexer.HOSTS_SYMBOL) {
                            return QueryType.ShowSlaveHosts;
                        }

                        return QueryType.ShowSlaveStatus;
                    }

                    case MySQLMRSLexer.STATUS_SYMBOL: {
                        return QueryType.ShowStatus;
                    }

                    case MySQLMRSLexer.VARIABLES_SYMBOL: {
                        return QueryType.ShowVariables;
                    }

                    case MySQLMRSLexer.TABLE_SYMBOL: {
                        return QueryType.ShowTableStatus;
                    }

                    case MySQLMRSLexer.TABLES_SYMBOL: {
                        return QueryType.ShowTables;
                    }

                    case MySQLMRSLexer.TRIGGERS_SYMBOL: {
                        return QueryType.ShowTriggers;
                    }

                    case MySQLMRSLexer.WARNINGS_SYMBOL: {
                        return QueryType.ShowWarnings;
                    }

                    case MySQLMRSLexer.REST_SYMBOL: {
                        return QueryType.Rest;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLMRSLexer.CACHE_SYMBOL: {
                return QueryType.CacheIndex;
            }

            case MySQLMRSLexer.FLUSH_SYMBOL: {
                return QueryType.Flush;
            }

            case MySQLMRSLexer.KILL_SYMBOL: {
                return QueryType.Kill;
            }

            case MySQLMRSLexer.EXPLAIN_SYMBOL:
            case MySQLMRSLexer.DESCRIBE_SYMBOL:
            case MySQLMRSLexer.DESC_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (this.isIdentifier(token.type) || token.type === MySQLMRSLexer.DOT_SYMBOL) {
                    return QueryType.ExplainTable;
                }

                // EXTENDED is a bit special as it can be both, a table identifier or the keyword.
                if (token.type === MySQLMRSLexer.EXTENDED_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.ExplainTable;
                    }

                    switch (token.type) {
                        case MySQLMRSLexer.DELETE_SYMBOL:
                        case MySQLMRSLexer.INSERT_SYMBOL:
                        case MySQLMRSLexer.REPLACE_SYMBOL:
                        case MySQLMRSLexer.UPDATE_SYMBOL: {
                            return QueryType.ExplainStatement;
                        }
                        default: {
                            return QueryType.ExplainTable;
                        }
                    }
                }

                return QueryType.ExplainStatement;
            }

            case MySQLMRSLexer.HELP_SYMBOL: {
                return QueryType.Help;
            }

            case MySQLMRSLexer.USE_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === MySQLMRSLexer.REST_SYMBOL) {
                    return QueryType.RestUse;
                }

                return QueryType.Use;
            }

            default: {
                return QueryType.Unknown;
            }
        }
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
     * Checks if the version number in the token text is less than or equal to the current server version.
     *
     * @param text The text from a matched token.
     * @returns True if so the number matches, otherwise false.
     */
    protected checkMySQLVersion(text: string): boolean {
        if (text.length < 8) {// Minimum is: /*!12345
            return false;
        }

        // Skip version comment introducer.
        const version = parseInt(text.substr(3), 10);
        if (version <= this.serverVersion) {
            this.inVersionComment = true;

            return true;
        }

        return false;
    }

    /**
     * Called when a keyword was consumed that represents an internal MySQL function and checks if that keyword is
     * followed by an open parenthesis. If not then it is not considered a keyword but treated like a normal identifier.
     *
     * @param proposed The token type to use if the check succeeds.
     *
     * @returns If a function call is found then return the proposed token type, otherwise just IDENTIFIER.
     */
    protected determineFunction(proposed: number): number {
        // Skip any whitespace character if the sql mode says they should be ignored,
        // before actually trying to match the open parenthesis.
        let input = String.fromCharCode(this.inputStream.LA(1));
        if (this.isSqlModeActive(SqlMode.IgnoreSpace)) {
            while (input === " " || input === "\t" || input === "\r" || input === "\n") {
                this.interpreter.consume(this.inputStream);
                this._channel = Lexer.HIDDEN;
                this._type = MySQLMRSLexer.WHITESPACE;
                input = String.fromCharCode(this.inputStream.LA(1));
            }
        }

        return input === "(" ? proposed : MySQLMRSLexer.IDENTIFIER;

    }

    /**
     * Checks the given text and determines the smallest number type from it. Code has been taken from sql_lex.cc.
     *
     * @param text The text to parse (which must be a number).
     *
     * @returns The token type for that text.
     */
    protected determineNumericType(text: string): number {
        // The original code checks for leading +/- but actually that can never happen, neither in the
        // server parser (as a digit is used to trigger processing in the lexer) nor in our parser
        // as our rules are defined without signs. But we do it anyway for maximum compatibility.
        let length = text.length - 1;
        if (length < MySQLBaseLexer.#longLength) { // quick normal case
            return MySQLMRSLexer.INT_NUMBER;
        }

        let negative = false;
        let index = 0;
        if (text.charAt(index) === "+") { // Remove sign and pre-zeros
            ++index;
            --length;
        } else if (text.charAt(index) === "-") {
            ++index;
            --length;
            negative = true;
        }

        while (text.charAt(index) === "0" && length > 0) {
            ++index;
            --length;
        }

        if (length < MySQLBaseLexer.#longLength) {
            return MySQLMRSLexer.INT_NUMBER;
        }

        let smaller: number;
        let bigger: number;
        let cmp: string;
        if (negative) {
            if (length === MySQLBaseLexer.#longLength) {
                cmp = MySQLBaseLexer.#signedLongString.substr(1);
                smaller = MySQLMRSLexer.INT_NUMBER; // If <= signed_long_str
                bigger = MySQLMRSLexer.LONG_NUMBER; // If >= signed_long_str
            } else if (length < MySQLBaseLexer.#signedLongLongLength) {
                return MySQLMRSLexer.LONG_NUMBER;
            } else if (length > MySQLBaseLexer.#signedLongLongLength) {
                return MySQLMRSLexer.DECIMAL_NUMBER;
            } else {
                cmp = MySQLBaseLexer.#signedLongLongString.substr(1);
                smaller = MySQLMRSLexer.LONG_NUMBER; // If <= signed_longlong_str
                bigger = MySQLMRSLexer.DECIMAL_NUMBER;
            }
        } else {
            if (length === MySQLBaseLexer.#longLength) {
                cmp = MySQLBaseLexer.#longString;
                smaller = MySQLMRSLexer.INT_NUMBER;
                bigger = MySQLMRSLexer.LONG_NUMBER;
            } else if (length < MySQLBaseLexer.#longLongLength) {
                return MySQLMRSLexer.LONG_NUMBER;
            } else if (length > MySQLBaseLexer.#longLongLength) {
                if (length > MySQLBaseLexer.#unsignedLongLongLength) {
                    return MySQLMRSLexer.DECIMAL_NUMBER;
                }
                cmp = MySQLBaseLexer.#unsignedLongLongString;
                smaller = MySQLMRSLexer.ULONGLONG_NUMBER;
                bigger = MySQLMRSLexer.DECIMAL_NUMBER;
            } else {
                cmp = MySQLBaseLexer.#longLongString;
                smaller = MySQLMRSLexer.LONG_NUMBER;
                bigger = MySQLMRSLexer.ULONGLONG_NUMBER;
            }
        }

        let otherIndex = 0;
        while (index < text.length && cmp.charAt(otherIndex++) === text.charAt(index++)) {
            //
        }

        return text.charAt(index - 1) <= cmp.charAt(otherIndex - 1) ? smaller : bigger;
    }

    /**
     * Checks if the given text corresponds to a charset defined in the server (text is preceded by an underscore).
     *
     * @param text The text to check.
     *
     * @returns UNDERSCORE_CHARSET if so, otherwise IDENTIFIER.
     */
    protected checkCharset(text: string): number {
        return this.charsets.has(text) ? MySQLMRSLexer.UNDERSCORE_CHARSET : MySQLMRSLexer.IDENTIFIER;
    }

    /**
     * Creates a DOT token in the token stream.
     */
    protected emitDot(): void {
        this.pendingTokens.push(this._factory.create([this, this.inputStream], MySQLMRSLexer.DOT_SYMBOL,
            null, this._channel, this._tokenStartCharIndex, this._tokenStartCharIndex, this._tokenStartLine,
            this._tokenStartColumn,
        ));

        ++this._tokenStartColumn;
        ++this._tokenStartCharIndex;
        ++this._tokenStartCharPositionInLine;
    }

    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * @returns the next token in the token stream that is on the default channel (not a hidden or other one).
     */
    private nextDefaultChannelToken(): Token {
        do {
            const token = this.nextToken();
            if (token.channel === Token.DEFAULT_CHANNEL) {
                return token;
            }

        } while (true);
    }

    /**
     * Skips over a definer clause if possible. Returns true if it was successful and points to the
     * token after the last definer part.
     * On entry the DEFINER symbol has been consumed already.
     *
     * @returns If the syntax is wrong false is returned and the token source state is undetermined.
     */
    private skipDefiner(): boolean {
        let token = this.nextDefaultChannelToken();
        if (token.type !== MySQLMRSLexer.EQUAL_OPERATOR) {
            return false;
        }

        token = this.nextDefaultChannelToken();
        if (token.type === MySQLMRSLexer.CURRENT_USER_SYMBOL) {
            token = this.nextDefaultChannelToken();
            if (token.type === MySQLMRSLexer.OPEN_PAR_SYMBOL) {
                token = this.nextDefaultChannelToken();
                if (token.type !== MySQLMRSLexer.CLOSE_PAR_SYMBOL) { return false; }
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) { return false; }
            }

            return true;
        }

        if (token.type === MySQLMRSLexer.SINGLE_QUOTED_TEXT || this.isIdentifier(token.type)) {
            // First part of the user definition (mandatory).
            token = this.nextDefaultChannelToken();
            if (token.type === MySQLMRSLexer.AT_SIGN_SYMBOL || token.type === MySQLMRSLexer.AT_TEXT_SUFFIX) {
                // Second part of the user definition (optional).
                const needIdentifier = token.type === MySQLMRSLexer.AT_SIGN_SYMBOL;
                token = this.nextDefaultChannelToken();
                if (needIdentifier) {
                    if (!this.isIdentifier(token.type) && token.type !== MySQLMRSLexer.SINGLE_QUOTED_TEXT) {
                        return false;
                    }

                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return false;
                    }
                }
            }

            return true;
        }

        return false;
    }
}
