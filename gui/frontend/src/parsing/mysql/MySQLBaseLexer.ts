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

import { QueryType } from "../parser-common";

import { MySQLLexer } from "./generated/MySQLLexer";
import {
    IMySQLRecognizerCommon, SqlMode, isReservedKeyword, numberToVersion, isKeyword,
} from "./MySQLRecognizerCommon";

// The base lexer class provides a number of functions needed in actions in the lexer (grammar).
export abstract class MySQLBaseLexer extends Lexer implements IMySQLRecognizerCommon {
    public serverVersion = 0;
    public sqlModes = new Set<SqlMode>();

    public readonly charsets: Set<string> = new Set(); // Used to check repertoires.
    protected inVersionComment = false;

    private pendingTokens: Token[] = [];
    private symbols: Map<string, number> = new Map(); // A list of all defined symbols for lookup.

    /**
     * Determines if the given type is a relational operator.
     *
     * @param type The type to check.
     *
     * @returns True if the type is a relational operator.
     */
    public static isRelation(type: number): boolean {
        switch (type) {
            case MySQLLexer.EQUAL_OPERATOR:
            case MySQLLexer.ASSIGN_OPERATOR:
            case MySQLLexer.NULL_SAFE_EQUAL_OPERATOR:
            case MySQLLexer.GREATER_OR_EQUAL_OPERATOR:
            case MySQLLexer.GREATER_THAN_OPERATOR:
            case MySQLLexer.LESS_OR_EQUAL_OPERATOR:
            case MySQLLexer.LESS_THAN_OPERATOR:
            case MySQLLexer.NOT_EQUAL_OPERATOR:
            case MySQLLexer.NOT_EQUAL2_OPERATOR:
            case MySQLLexer.PLUS_OPERATOR:
            case MySQLLexer.MINUS_OPERATOR:
            case MySQLLexer.MULT_OPERATOR:
            case MySQLLexer.DIV_OPERATOR:
            case MySQLLexer.MOD_OPERATOR:
            case MySQLLexer.LOGICAL_NOT_OPERATOR:
            case MySQLLexer.BITWISE_NOT_OPERATOR:
            case MySQLLexer.SHIFT_LEFT_OPERATOR:
            case MySQLLexer.SHIFT_RIGHT_OPERATOR:
            case MySQLLexer.LOGICAL_AND_OPERATOR:
            case MySQLLexer.BITWISE_AND_OPERATOR:
            case MySQLLexer.BITWISE_XOR_OPERATOR:
            case MySQLLexer.LOGICAL_OR_OPERATOR:
            case MySQLLexer.BITWISE_OR_OPERATOR:
            case MySQLLexer.OR_SYMBOL:
            case MySQLLexer.XOR_SYMBOL:
            case MySQLLexer.AND_SYMBOL:
            case MySQLLexer.IS_SYMBOL:
            case MySQLLexer.BETWEEN_SYMBOL:
            case MySQLLexer.LIKE_SYMBOL:
            case MySQLLexer.REGEXP_SYMBOL:
            case MySQLLexer.IN_SYMBOL:
            case MySQLLexer.SOUNDS_SYMBOL:
            case MySQLLexer.NOT_SYMBOL: {
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
            case MySQLLexer.INT_NUMBER:
            case MySQLLexer.LONG_NUMBER:
            case MySQLLexer.ULONGLONG_NUMBER:
            case MySQLLexer.FLOAT_NUMBER:
            case MySQLLexer.HEX_NUMBER:
            case MySQLLexer.BIN_NUMBER:
            case MySQLLexer.DECIMAL_NUMBER: {
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
            case MySQLLexer.EQUAL_OPERATOR:
            case MySQLLexer.ASSIGN_OPERATOR:
            case MySQLLexer.NULL_SAFE_EQUAL_OPERATOR:
            case MySQLLexer.GREATER_OR_EQUAL_OPERATOR:
            case MySQLLexer.GREATER_THAN_OPERATOR:
            case MySQLLexer.LESS_OR_EQUAL_OPERATOR:
            case MySQLLexer.LESS_THAN_OPERATOR:
            case MySQLLexer.NOT_EQUAL_OPERATOR:
            case MySQLLexer.NOT_EQUAL2_OPERATOR:
            case MySQLLexer.PLUS_OPERATOR:
            case MySQLLexer.MINUS_OPERATOR:
            case MySQLLexer.MULT_OPERATOR:
            case MySQLLexer.DIV_OPERATOR:
            case MySQLLexer.MOD_OPERATOR:
            case MySQLLexer.LOGICAL_NOT_OPERATOR:
            case MySQLLexer.BITWISE_NOT_OPERATOR:
            case MySQLLexer.SHIFT_LEFT_OPERATOR:
            case MySQLLexer.SHIFT_RIGHT_OPERATOR:
            case MySQLLexer.LOGICAL_AND_OPERATOR:
            case MySQLLexer.BITWISE_AND_OPERATOR:
            case MySQLLexer.BITWISE_XOR_OPERATOR:
            case MySQLLexer.LOGICAL_OR_OPERATOR:
            case MySQLLexer.BITWISE_OR_OPERATOR:
            case MySQLLexer.DOT_SYMBOL:
            case MySQLLexer.COMMA_SYMBOL:
            case MySQLLexer.SEMICOLON_SYMBOL:
            case MySQLLexer.COLON_SYMBOL:
            case MySQLLexer.OPEN_PAR_SYMBOL:
            case MySQLLexer.CLOSE_PAR_SYMBOL:
            case MySQLLexer.AT_SIGN_SYMBOL:
            case MySQLLexer.AT_AT_SIGN_SYMBOL:
            case MySQLLexer.PARAM_MARKER:
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
        if (type === MySQLLexer.EOF) {
            return false;
        }

        if ((type === MySQLLexer.IDENTIFIER) || (type === MySQLLexer.BACK_TICK_QUOTED_ID)) {
            return true;
        }

        // Double quoted text represents identifiers only if the ANSI QUOTES sql mode is active.
        if (type === MySQLLexer.DOUBLE_QUOTED_TEXT) {
            return this.sqlModes.has(SqlMode.AnsiQuotes);
        }

        const symbol = this.getVocabulary().getSymbolicName(type);
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
            const max = this.getVocabulary().maxTokenType;
            for (let i = 0; i <= max; ++i) {
                const symbolName = this.getVocabulary().getSymbolicName(i);
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
            case MySQLLexer.ALTER_SYMBOL:
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLLexer.DATABASE_SYMBOL: {
                        return QueryType.AlterDatabase;
                    }

                    case MySQLLexer.LOGFILE_SYMBOL: {
                        return QueryType.AlterLogFileGroup;
                    }

                    case MySQLLexer.FUNCTION_SYMBOL: {
                        return QueryType.AlterFunction;
                    }

                    case MySQLLexer.PROCEDURE_SYMBOL: {
                        return QueryType.AlterProcedure;
                    }

                    case MySQLLexer.SERVER_SYMBOL: {
                        return QueryType.AlterServer;
                    }

                    case MySQLLexer.TABLE_SYMBOL:
                    case MySQLLexer.ONLINE_SYMBOL:  // Optional part of ALTER TABLE.
                    case MySQLLexer.OFFLINE_SYMBOL: // ditto
                    case MySQLLexer.IGNORE_SYMBOL: {
                        return QueryType.AlterTable;
                    }

                    case MySQLLexer.TABLESPACE_SYMBOL: {
                        return QueryType.AlterTableSpace;
                    }

                    case MySQLLexer.EVENT_SYMBOL: {
                        return QueryType.AlterEvent;
                    }

                    case MySQLLexer.VIEW_SYMBOL: {
                        return QueryType.AlterView;
                    }

                    case MySQLLexer.DEFINER_SYMBOL: { // Can be both event or view.
                        if (!this.skipDefiner()) {
                            return QueryType.Ambiguous;
                        }
                        token = this.nextDefaultChannelToken();

                        switch (token.type) {
                            case MySQLLexer.EVENT_SYMBOL: {
                                return QueryType.AlterEvent;
                            }

                            case MySQLLexer.SQL_SYMBOL:
                            case MySQLLexer.VIEW_SYMBOL: {
                                return QueryType.AlterView;
                            }

                            default: {
                                return QueryType.Unknown;
                            }
                        }
                    }

                    case MySQLLexer.ALGORITHM_SYMBOL: { // Optional part of CREATE VIEW.
                        return QueryType.AlterView;
                    }

                    case MySQLLexer.USER_SYMBOL: {
                        return QueryType.AlterUser;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }

            case MySQLLexer.CREATE_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLLexer.TEMPORARY_SYMBOL: // Optional part of CREATE TABLE.
                    case MySQLLexer.TABLE_SYMBOL: {
                        return QueryType.CreateTable;
                    }

                    case MySQLLexer.ONLINE_SYMBOL:
                    case MySQLLexer.OFFLINE_SYMBOL:
                    case MySQLLexer.INDEX_SYMBOL:
                    case MySQLLexer.UNIQUE_SYMBOL:
                    case MySQLLexer.FULLTEXT_SYMBOL:
                    case MySQLLexer.SPATIAL_SYMBOL: {
                        return QueryType.CreateIndex;
                    }

                    case MySQLLexer.DATABASE_SYMBOL: {
                        return QueryType.CreateDatabase;
                    }

                    case MySQLLexer.TRIGGER_SYMBOL: {
                        return QueryType.CreateTrigger;
                    }

                    case MySQLLexer.DEFINER_SYMBOL: { // Can be event, view, procedure, function, UDF, trigger.
                        if (!this.skipDefiner()) {
                            return QueryType.Ambiguous;
                        }

                        token = this.nextDefaultChannelToken();
                        switch (token.type) {
                            case MySQLLexer.EVENT_SYMBOL: {
                                return QueryType.CreateEvent;
                            }

                            case MySQLLexer.VIEW_SYMBOL:
                            case MySQLLexer.SQL_SYMBOL: {
                                return QueryType.CreateView;
                            }

                            case MySQLLexer.PROCEDURE_SYMBOL: {
                                return QueryType.CreateProcedure;
                            }

                            case MySQLLexer.FUNCTION_SYMBOL: {
                                token = this.nextDefaultChannelToken();
                                if (token.type === Token.EOF) {
                                    return QueryType.Ambiguous;
                                }

                                if (!this.isIdentifier(token.type)) {
                                    return QueryType.Ambiguous;
                                }

                                token = this.nextDefaultChannelToken();
                                if (token.type === MySQLLexer.RETURNS_SYMBOL) {
                                    return QueryType.CreateUdf;
                                }

                                return QueryType.CreateFunction;
                            }

                            case MySQLLexer.AGGREGATE_SYMBOL: {
                                return QueryType.CreateUdf;
                            }

                            case MySQLLexer.TRIGGER_SYMBOL: {
                                return QueryType.CreateTrigger;
                            }

                            default: {
                                return QueryType.Unknown;
                            }
                        }
                    }

                    case MySQLLexer.VIEW_SYMBOL:
                    case MySQLLexer.OR_SYMBOL:        // CREATE OR REPLACE ... VIEW
                    case MySQLLexer.ALGORITHM_SYMBOL: { // CREATE ALGORITHM ... VIEW
                        return QueryType.CreateView;
                    }

                    case MySQLLexer.EVENT_SYMBOL: {
                        return QueryType.CreateEvent;
                    }

                    case MySQLLexer.FUNCTION_SYMBOL: {
                        return QueryType.CreateFunction;
                    }

                    case MySQLLexer.AGGREGATE_SYMBOL: {
                        return QueryType.CreateUdf;
                    }

                    case MySQLLexer.PROCEDURE_SYMBOL: {
                        return QueryType.CreateProcedure;
                    }

                    case MySQLLexer.LOGFILE_SYMBOL: {
                        return QueryType.CreateLogFileGroup;
                    }

                    case MySQLLexer.SERVER_SYMBOL: {
                        return QueryType.CreateServer;
                    }

                    case MySQLLexer.TABLESPACE_SYMBOL: {
                        return QueryType.CreateTableSpace;
                    }

                    case MySQLLexer.USER_SYMBOL: {
                        return QueryType.CreateUser;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLLexer.DROP_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLLexer.DATABASE_SYMBOL: {
                        return QueryType.DropDatabase;
                    }

                    case MySQLLexer.EVENT_SYMBOL: {
                        return QueryType.DropEvent;
                    }

                    case MySQLLexer.PROCEDURE_SYMBOL: {
                        return QueryType.DropProcedure;
                    }

                    case MySQLLexer.FUNCTION_SYMBOL: {
                        return QueryType.DropFunction;
                    }

                    case MySQLLexer.ONLINE_SYMBOL:
                    case MySQLLexer.OFFLINE_SYMBOL:
                    case MySQLLexer.INDEX_SYMBOL: {
                        return QueryType.DropIndex;
                    }

                    case MySQLLexer.LOGFILE_SYMBOL: {
                        return QueryType.DropLogfileGroup;
                    }

                    case MySQLLexer.SERVER_SYMBOL: {
                        return QueryType.DropServer;
                    }

                    case MySQLLexer.TEMPORARY_SYMBOL:
                    case MySQLLexer.TABLE_SYMBOL:
                    case MySQLLexer.TABLES_SYMBOL: {
                        return QueryType.DropTable;
                    }

                    case MySQLLexer.TABLESPACE_SYMBOL: {
                        return QueryType.DropTablespace;
                    }

                    case MySQLLexer.TRIGGER_SYMBOL: {
                        return QueryType.DropTrigger;
                    }

                    case MySQLLexer.VIEW_SYMBOL: {
                        return QueryType.DropView;
                    }

                    case MySQLLexer.PREPARE_SYMBOL: {
                        return QueryType.Deallocate;
                    }

                    case MySQLLexer.USER_SYMBOL: {
                        return QueryType.DropUser;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLLexer.TRUNCATE_SYMBOL: {
                return QueryType.TruncateTable;
            }

            case MySQLLexer.CALL_SYMBOL: {
                return QueryType.Call;
            }

            case MySQLLexer.DELETE_SYMBOL: {
                return QueryType.Delete;
            }

            case MySQLLexer.DO_SYMBOL: {
                return QueryType.Do;
            }

            case MySQLLexer.HANDLER_SYMBOL: {
                return QueryType.Handler;
            }

            case MySQLLexer.INSERT_SYMBOL: {
                return QueryType.Insert;
            }

            case MySQLLexer.LOAD_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                switch (token.type) {
                    case MySQLLexer.DATA_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLLexer.FROM_SYMBOL) {
                            return QueryType.LoadDataMaster;
                        }

                        return QueryType.LoadData;
                    }
                    case MySQLLexer.XML_SYMBOL: {
                        return QueryType.LoadXML;
                    }

                    case MySQLLexer.TABLE_SYMBOL: {
                        return QueryType.LoadTableMaster;
                    }

                    case MySQLLexer.INDEX_SYMBOL: {
                        return QueryType.LoadIndex;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLLexer.REPLACE_SYMBOL: {
                return QueryType.Replace;
            }

            case MySQLLexer.SELECT_SYMBOL: {
                return QueryType.Select;
            }

            case MySQLLexer.TABLE_SYMBOL: {
                return QueryType.Table;
            }

            case MySQLLexer.VALUES_SYMBOL: {
                return QueryType.Values;
            }

            case MySQLLexer.UPDATE_SYMBOL: {
                return QueryType.Update;
            }

            case MySQLLexer.OPEN_PAR_SYMBOL: { // (((select ...)))
                while (token.type === MySQLLexer.OPEN_PAR_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.Ambiguous;
                    }
                }
                if (token.type === MySQLLexer.SELECT_SYMBOL) {
                    return QueryType.Select;
                }

                return QueryType.Unknown;
            }

            case MySQLLexer.START_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLLexer.TRANSACTION_SYMBOL) {
                    return QueryType.StartTransaction;
                }

                return QueryType.StartSlave;
            }

            case MySQLLexer.BEGIN_SYMBOL: { // Begin directly at the start of the query must be a transaction start.
                return QueryType.BeginWork;
            }

            case MySQLLexer.COMMIT_SYMBOL: {
                return QueryType.Commit;
            }

            case MySQLLexer.ROLLBACK_SYMBOL: {
                // We assume a transaction statement here unless we exactly know it's about a savepoint.
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.RollbackWork;
                }
                if (token.type === MySQLLexer.WORK_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.RollbackWork;
                    }
                }

                if (token.type === MySQLLexer.TO_SYMBOL) {
                    return QueryType.RollbackSavePoint;
                }

                return QueryType.RollbackWork;
            }

            case MySQLLexer.SET_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Set;
                }

                switch (token.type) {
                    case MySQLLexer.PASSWORD_SYMBOL: {
                        return QueryType.SetPassword;
                    }

                    case MySQLLexer.GLOBAL_SYMBOL:
                    case MySQLLexer.LOCAL_SYMBOL:
                    case MySQLLexer.SESSION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Set;
                        }
                        break;
                    }

                    case MySQLLexer.IDENTIFIER: {
                        const text = (token.text || "").toLowerCase();
                        if (text === "autocommit") {
                            return QueryType.SetAutoCommit;
                        }
                        break;
                    }

                    case MySQLLexer.TRANSACTION_SYMBOL: {
                        return QueryType.SetTransaction;
                    }

                    default: {
                        return QueryType.Set;
                    }
                }

                return QueryType.Set;
            }

            case MySQLLexer.SAVEPOINT_SYMBOL: {
                return QueryType.SavePoint;
            }

            case MySQLLexer.RELEASE_SYMBOL: { // Release at the start of the query, obviously.
                return QueryType.ReleaseSavePoint;
            }

            case MySQLLexer.LOCK_SYMBOL: {
                return QueryType.Lock;
            }

            case MySQLLexer.UNLOCK_SYMBOL: {
                return QueryType.Unlock;
            }

            case MySQLLexer.XA_SYMBOL: {
                return QueryType.XA;
            }

            case MySQLLexer.PURGE_SYMBOL: {
                return QueryType.Purge;
            }

            case MySQLLexer.CHANGE_SYMBOL: {
                return QueryType.ChangeMaster;
            }

            case MySQLLexer.RESET_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Reset;
                }

                switch (token.type) {
                    case MySQLLexer.MASTER_SYMBOL: {
                        return QueryType.ResetMaster;
                    }
                    case MySQLLexer.SLAVE_SYMBOL: {
                        return QueryType.ResetSlave;
                    }
                    default: {
                        return QueryType.Reset;
                    }
                }
            }

            case MySQLLexer.STOP_SYMBOL: {
                return QueryType.StopSlave;
            }

            case MySQLLexer.PREPARE_SYMBOL: {
                return QueryType.Prepare;
            }

            case MySQLLexer.EXECUTE_SYMBOL: {
                return QueryType.Execute;
            }

            case MySQLLexer.DEALLOCATE_SYMBOL: {
                return QueryType.Deallocate;
            }

            case MySQLLexer.GRANT_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLLexer.PROXY_SYMBOL) {
                    return QueryType.GrantProxy;
                }

                return QueryType.Grant;
            }

            case MySQLLexer.RENAME_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLLexer.USER_SYMBOL) {
                    return QueryType.RenameUser;
                }

                return QueryType.RenameTable;
            }

            case MySQLLexer.REVOKE_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (token.type === MySQLLexer.PROXY_SYMBOL) {
                    return QueryType.RevokeProxy;
                }

                return QueryType.Revoke;
            }

            case MySQLLexer.ANALYZE_SYMBOL: {
                return QueryType.AnalyzeTable;
            }

            case MySQLLexer.CHECK_SYMBOL: {
                return QueryType.CheckTable;
            }

            case MySQLLexer.CHECKSUM_SYMBOL: {
                return QueryType.ChecksumTable;
            }

            case MySQLLexer.OPTIMIZE_SYMBOL: {
                return QueryType.OptimizeTable;
            }

            case MySQLLexer.REPAIR_SYMBOL: {
                return QueryType.RepairTable;
            }

            case MySQLLexer.BACKUP_SYMBOL: {
                return QueryType.BackUpTable;
            }

            case MySQLLexer.RESTORE_SYMBOL: {
                return QueryType.RestoreTable;
            }

            case MySQLLexer.INSTALL_SYMBOL: {
                return QueryType.InstallPlugin;
            }

            case MySQLLexer.UNINSTALL_SYMBOL: {
                return QueryType.UninstallPlugin;
            }

            case MySQLLexer.SHOW_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Show;
                }

                if (token.type === MySQLLexer.FULL_SYMBOL) {
                    // Not all SHOW cases allow an optional FULL keyword, but this is not about checking for
                    // a valid query but to find the most likely type.
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.Show;
                    }
                }

                switch (token.type) {
                    case MySQLLexer.GLOBAL_SYMBOL:
                    case MySQLLexer.LOCK_SYMBOL:
                    case MySQLLexer.SESSION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        if (token.type === MySQLLexer.STATUS_SYMBOL) {
                            return QueryType.ShowStatus;
                        }

                        return QueryType.ShowVariables;
                    }

                    case MySQLLexer.BINARY_SYMBOL: {
                        return QueryType.ShowBinaryLogs;
                    }

                    case MySQLLexer.BINLOG_SYMBOL: {
                        return QueryType.ShowBinLogEvents;
                    }

                    case MySQLLexer.RELAYLOG_SYMBOL: {
                        return QueryType.ShowRelayLogEvents;
                    }

                    case MySQLLexer.CHAR_SYMBOL:
                    case MySQLLexer.CHARSET_SYMBOL: {
                        return QueryType.ShowCharset;
                    }

                    case MySQLLexer.COLLATION_SYMBOL: {
                        return QueryType.ShowCollation;
                    }

                    case MySQLLexer.COLUMNS_SYMBOL: {
                        return QueryType.ShowColumns;
                    }

                    case MySQLLexer.COUNT_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLLexer.OPEN_PAR_SYMBOL) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLLexer.MULT_OPERATOR) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type !== MySQLLexer.CLOSE_PAR_SYMBOL) {
                            return QueryType.Show;
                        }

                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        switch (token.type) {
                            case MySQLLexer.WARNINGS_SYMBOL: {
                                return QueryType.ShowWarnings;
                            }

                            case MySQLLexer.ERRORS_SYMBOL: {
                                return QueryType.ShowErrors;
                            }

                            default: {
                                return QueryType.Show;
                            }
                        }
                    }

                    case MySQLLexer.CREATE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        switch (token.type) {
                            case MySQLLexer.DATABASE_SYMBOL: {
                                return QueryType.ShowCreateDatabase;
                            }

                            case MySQLLexer.EVENT_SYMBOL: {
                                return QueryType.ShowCreateEvent;
                            }

                            case MySQLLexer.FUNCTION_SYMBOL: {
                                return QueryType.ShowCreateFunction;
                            }

                            case MySQLLexer.PROCEDURE_SYMBOL: {
                                return QueryType.ShowCreateProcedure;
                            }

                            case MySQLLexer.TABLE_SYMBOL: {
                                return QueryType.ShowCreateTable;
                            }

                            case MySQLLexer.TRIGGER_SYMBOL: {
                                return QueryType.ShowCreateTrigger;
                            }

                            case MySQLLexer.VIEW_SYMBOL: {
                                return QueryType.ShowCreateView;
                            }

                            default: {
                                return QueryType.Show;
                            }
                        }
                    }

                    case MySQLLexer.DATABASES_SYMBOL: {
                        return QueryType.ShowDatabases;
                    }

                    case MySQLLexer.ENGINE_SYMBOL: {
                        return QueryType.ShowEngineStatus;
                    }

                    case MySQLLexer.STORAGE_SYMBOL:
                    case MySQLLexer.ENGINES_SYMBOL: {
                        return QueryType.ShowStorageEngines;
                    }

                    case MySQLLexer.ERRORS_SYMBOL: {
                        return QueryType.ShowErrors;
                    }

                    case MySQLLexer.EVENTS_SYMBOL: {
                        return QueryType.ShowEvents;
                    }

                    case MySQLLexer.FUNCTION_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLLexer.CODE_SYMBOL) {
                            return QueryType.ShowFunctionCode;
                        }

                        return QueryType.ShowFunctionStatus;
                    }

                    case MySQLLexer.GRANT_SYMBOL: {
                        return QueryType.ShowGrants;
                    }

                    case MySQLLexer.INDEX_SYMBOL:
                    case MySQLLexer.INDEXES_SYMBOL:
                    case MySQLLexer.KEY_SYMBOL: {
                        return QueryType.ShowIndexes;
                    }

                    case MySQLLexer.MASTER_SYMBOL: {
                        return QueryType.ShowMasterStatus;
                    }

                    case MySQLLexer.OPEN_SYMBOL: {
                        return QueryType.ShowOpenTables;
                    }

                    case MySQLLexer.PLUGIN_SYMBOL:
                    case MySQLLexer.PLUGINS_SYMBOL: {
                        return QueryType.ShowPlugins;
                    }

                    case MySQLLexer.PROCEDURE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Show;
                        }

                        if (token.type === MySQLLexer.STATUS_SYMBOL) {
                            return QueryType.ShowProcedureStatus;
                        }

                        return QueryType.ShowProcedureCode;
                    }

                    case MySQLLexer.PRIVILEGES_SYMBOL: {
                        return QueryType.ShowPrivileges;
                    }

                    case MySQLLexer.FULL_SYMBOL:
                    case MySQLLexer.PROCESSLIST_SYMBOL: {
                        return QueryType.ShowProcessList;
                    }

                    case MySQLLexer.PROFILE_SYMBOL: {
                        return QueryType.ShowProfile;
                    }

                    case MySQLLexer.PROFILES_SYMBOL: {
                        return QueryType.ShowProfiles;
                    }

                    case MySQLLexer.SLAVE_SYMBOL: {
                        token = this.nextDefaultChannelToken();
                        if (token.type === Token.EOF) {
                            return QueryType.Ambiguous;
                        }

                        if (token.type === MySQLLexer.HOSTS_SYMBOL) {
                            return QueryType.ShowSlaveHosts;
                        }

                        return QueryType.ShowSlaveStatus;
                    }

                    case MySQLLexer.STATUS_SYMBOL: {
                        return QueryType.ShowStatus;
                    }

                    case MySQLLexer.VARIABLES_SYMBOL: {
                        return QueryType.ShowVariables;
                    }

                    case MySQLLexer.TABLE_SYMBOL: {
                        return QueryType.ShowTableStatus;
                    }

                    case MySQLLexer.TABLES_SYMBOL: {
                        return QueryType.ShowTables;
                    }

                    case MySQLLexer.TRIGGERS_SYMBOL: {
                        return QueryType.ShowTriggers;
                    }

                    case MySQLLexer.WARNINGS_SYMBOL: {
                        return QueryType.ShowWarnings;
                    }

                    default: {
                        return QueryType.Unknown;
                    }
                }
            }

            case MySQLLexer.CACHE_SYMBOL: {
                return QueryType.CacheIndex;
            }

            case MySQLLexer.FLUSH_SYMBOL: {
                return QueryType.Flush;
            }

            case MySQLLexer.KILL_SYMBOL: {
                return QueryType.Kill;
            }

            case MySQLLexer.EXPLAIN_SYMBOL:
            case MySQLLexer.DESCRIBE_SYMBOL:
            case MySQLLexer.DESC_SYMBOL: {
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) {
                    return QueryType.Ambiguous;
                }

                if (this.isIdentifier(token.type) || token.type === MySQLLexer.DOT_SYMBOL) {
                    return QueryType.ExplainTable;
                }

                // EXTENDED is a bit special as it can be both, a table identifier or the keyword.
                if (token.type === MySQLLexer.EXTENDED_SYMBOL) {
                    token = this.nextDefaultChannelToken();
                    if (token.type === Token.EOF) {
                        return QueryType.ExplainTable;
                    }

                    switch (token.type) {
                        case MySQLLexer.DELETE_SYMBOL:
                        case MySQLLexer.INSERT_SYMBOL:
                        case MySQLLexer.REPLACE_SYMBOL:
                        case MySQLLexer.UPDATE_SYMBOL: {
                            return QueryType.ExplainStatement;
                        }
                        default: {
                            return QueryType.ExplainTable;
                        }
                    }
                }

                return QueryType.ExplainStatement;
            }

            case MySQLLexer.HELP_SYMBOL: {
                return QueryType.Help;
            }

            case MySQLLexer.USE_SYMBOL: {
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
        let input = String.fromCharCode(this._input.LA(1));
        if (this.isSqlModeActive(SqlMode.IgnoreSpace)) {
            while (input === " " || input === "\t" || input === "\r" || input === "\n") {
                this._interp.consume(this._input);
                this._channel = Lexer.HIDDEN;
                this._type = MySQLLexer.WHITESPACE;
                input = String.fromCharCode(this._input.LA(1));
            }
        }

        return input === "(" ? proposed : MySQLLexer.IDENTIFIER;

    }

    /**
     * Checks the given text and determines the smallest number type from it. Code has been taken from sql_lex.cc.
     *
     * @param text The text to parse (which must be a number).
     *
     * @returns The token type for that text.
     */
    protected determineNumericType(text: string): number {
        const longString = "2147483647";
        const longLength = 10;
        const signedLongString = "-2147483648";
        const longLongString = "9223372036854775807";
        const longLongLength = 19;
        const signedLongLongString = "-9223372036854775808";
        const signedLongLongLength = 19;
        const unsignedLongLongString = "18446744073709551615";
        const unsignedLongLongLength = 20;

        // The original code checks for leading +/- but actually that can never happen, neither in the
        // server parser (as a digit is used to trigger processing in the lexer) nor in our parser
        // as our rules are defined without signs. But we do it anyway for maximum compatibility.
        let length = text.length - 1;
        if (length < longLength) { // quick normal case
            return MySQLLexer.INT_NUMBER;
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

        if (length < longLength) {
            return MySQLLexer.INT_NUMBER;
        }

        let smaller: number;
        let bigger: number;
        let cmp: string;
        if (negative) {
            if (length === longLength) {
                cmp = signedLongString.substr(1);
                smaller = MySQLLexer.INT_NUMBER; // If <= signed_long_str
                bigger = MySQLLexer.LONG_NUMBER; // If >= signed_long_str
            } else if (length < signedLongLongLength) {
                return MySQLLexer.LONG_NUMBER;
            } else if (length > signedLongLongLength) {
                return MySQLLexer.DECIMAL_NUMBER;
            } else {
                cmp = signedLongLongString.substr(1);
                smaller = MySQLLexer.LONG_NUMBER; // If <= signed_longlong_str
                bigger = MySQLLexer.DECIMAL_NUMBER;
            }
        } else {
            if (length === longLength) {
                cmp = longString;
                smaller = MySQLLexer.INT_NUMBER;
                bigger = MySQLLexer.LONG_NUMBER;
            } else if (length < longLongLength) {
                return MySQLLexer.LONG_NUMBER;
            } else if (length > longLongLength) {
                if (length > unsignedLongLongLength) {
                    return MySQLLexer.DECIMAL_NUMBER;
                }
                cmp = unsignedLongLongString;
                smaller = MySQLLexer.ULONGLONG_NUMBER;
                bigger = MySQLLexer.DECIMAL_NUMBER;
            } else {
                cmp = longLongString;
                smaller = MySQLLexer.LONG_NUMBER;
                bigger = MySQLLexer.ULONGLONG_NUMBER;
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
        return this.charsets.has(text) ? MySQLLexer.UNDERSCORE_CHARSET : MySQLLexer.IDENTIFIER;
    }

    /**
     * Creates a DOT token in the token stream.
     */
    protected emitDot(): void {
        this.pendingTokens.push(this._factory.create([this, this._input], MySQLLexer.DOT_SYMBOL,
            null, this._channel, this._tokenStartCharIndex, this._tokenStartCharIndex, this._tokenStartLine,
            this._tokenStartCharPositionInLine,
        ));

        ++this._tokenStartCharIndex;
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
        if (token.type !== MySQLLexer.EQUAL_OPERATOR) {
            return false;
        }

        token = this.nextDefaultChannelToken();
        if (token.type === MySQLLexer.CURRENT_USER_SYMBOL) {
            token = this.nextDefaultChannelToken();
            if (token.type === MySQLLexer.OPEN_PAR_SYMBOL) {
                token = this.nextDefaultChannelToken();
                if (token.type !== MySQLLexer.CLOSE_PAR_SYMBOL) { return false; }
                token = this.nextDefaultChannelToken();
                if (token.type === Token.EOF) { return false; }
            }

            return true;
        }

        if (token.type === MySQLLexer.SINGLE_QUOTED_TEXT || this.isIdentifier(token.type)) {
            // First part of the user definition (mandatory).
            token = this.nextDefaultChannelToken();
            if (token.type === MySQLLexer.AT_SIGN_SYMBOL || token.type === MySQLLexer.AT_TEXT_SUFFIX) {
                // Second part of the user definition (optional).
                const needIdentifier = token.type === MySQLLexer.AT_SIGN_SYMBOL;
                token = this.nextDefaultChannelToken();
                if (needIdentifier) {
                    if (!this.isIdentifier(token.type) && token.type !== MySQLLexer.SINGLE_QUOTED_TEXT) {
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
