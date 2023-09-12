/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { CharStreams } from "antlr4ng";

import { MySQLLexer } from "../../../../parsing/mysql/generated/MySQLLexer";
import { SqlMode } from "../../../../parsing/mysql/MySQLRecognizerCommon";
import { QueryType } from "../../../../parsing/parser-common";

describe("MySQLBaseLexer Tests", (): void => {
    // Note: do not create a base lexer as such (which is abstract) but instead use the MySQLLexer (for which
    // own tests exist) and test only the features implemented in the base lexer.
    const stream = CharStreams.fromString("select * from sakila.actor");

    it("Static Methods", () => {
        expect(MySQLLexer.isRelation(MySQLLexer.GREATER_THAN_OPERATOR)).toBeTruthy();
        expect(MySQLLexer.isRelation(MySQLLexer.IDENTIFIER)).toBeFalsy();
    });

    it("Type Checks", () => {
        const lexer = new MySQLLexer(stream);

        expect(lexer.serverVersion).toBe(0);

        expect(lexer.isNumber(MySQLLexer.HEX_NUMBER)).toBeTruthy();
        expect(lexer.isNumber(MySQLLexer.COMMA_SYMBOL)).toBeFalsy();

        expect(lexer.isOperator(MySQLLexer.HEX_NUMBER)).toBeFalsy();
        expect(lexer.isOperator(MySQLLexer.COMMA_SYMBOL)).toBeTruthy();
    });

    it("SQL Mode", () => {
        const lexer = new MySQLLexer(stream);

        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeFalsy();
        lexer.sqlModes.add(SqlMode.AnsiQuotes);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();

        lexer.sqlModes.clear();
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeFalsy();

        lexer.sqlModeFromString("POSTGRESQL");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("oracle");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("maxdb");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("mssql");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("db2");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("ansi");
        expect(lexer.sqlModes.size).toBe(3);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("pipes_as_concat");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeFalsy();
        expect(lexer.isSqlModeActive(SqlMode.PipesAsConcat)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeFalsy();

        lexer.sqlModeFromString("ansi_quotes");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.AnsiQuotes)).toBeTruthy();

        lexer.sqlModeFromString("NO_BACKSLASH_ESCAPES");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.NoBackslashEscapes)).toBeTruthy();

        lexer.sqlModeFromString("NO_BACKSLASH_ESCAPES,ignore_space");
        expect(lexer.sqlModes.size).toBe(2);
        expect(lexer.isSqlModeActive(SqlMode.NoBackslashEscapes)).toBeTruthy();
        expect(lexer.isSqlModeActive(SqlMode.IgnoreSpace)).toBeTruthy();

        lexer.sqlModeFromString("HIGH_NOT_PRECEDENCE");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.HighNotPrecedence)).toBeTruthy();

        lexer.sqlModeFromString("MYSQL323");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.HighNotPrecedence)).toBeTruthy();

        lexer.sqlModeFromString("MYSQL40");
        expect(lexer.sqlModes.size).toBe(1);
        expect(lexer.isSqlModeActive(SqlMode.HighNotPrecedence)).toBeTruthy();

        lexer.sqlModeFromString("MYSQL80");
        expect(lexer.sqlModes.size).toBe(0);
        expect(lexer.isSqlModeActive(SqlMode.HighNotPrecedence)).toBeFalsy();
    });

    it("Identifier and Keyword Tests", () => {
        const lexer = new MySQLLexer(stream);
        lexer.reset();

        expect(lexer.isIdentifier(MySQLLexer.EOF)).toBeFalsy();
        expect(lexer.isIdentifier(MySQLLexer.IDENTIFIER)).toBeTruthy();
        expect(lexer.isIdentifier(MySQLLexer.BACK_TICK_QUOTED_ID)).toBeTruthy();

        // Depends on SQL mode.
        expect(lexer.isIdentifier(MySQLLexer.DOUBLE_QUOTED_TEXT)).toBeFalsy();
        lexer.sqlModeFromString("ansi_quotes");
        expect(lexer.isIdentifier(MySQLLexer.DOUBLE_QUOTED_TEXT)).toBeTruthy();

        // Server version 0. All keywords can be identifiers.
        expect(lexer.isIdentifier(MySQLLexer.ACCESSIBLE_SYMBOL)).toBeTruthy(); // Not a reserved keyword.
        expect(lexer.isIdentifier(MySQLLexer.SELECT_SYMBOL)).toBeTruthy(); // Reserved keyword.

        lexer.serverVersion = 80030;
        expect(lexer.isIdentifier(MySQLLexer.ORDINALITY_SYMBOL)).toBeTruthy(); // Not a reserved keyword.
        expect(lexer.isIdentifier(MySQLLexer.SELECT_SYMBOL)).toBeFalsy(); // Reserved keyword.

        expect(lexer.isIdentifier(MySQLLexer.MULT_OPERATOR)).toBeFalsy(); // Operator.
    });

    it("Identifier and Keyword Tests", () => {
        const lexer = new MySQLLexer(stream);
        lexer.serverVersion = 80030;

        expect(lexer.keywordFromText("")).toBe(-2);
        expect(lexer.keywordFromText("EoF")).toBe(-2); // Not a keyword.

        expect(lexer.keywordFromText("selEct")).toBe(MySQLLexer.SELECT_SYMBOL);
        expect(lexer.keywordFromText("selEct2")).toBe(-2);
        expect(lexer.keywordFromText("div")).toBe(MySQLLexer.DIV_SYMBOL);

        expect(lexer.keywordFromText("a * b")).toBe(-2);
    });

    it("Query Type Tests", () => {
        const checkQueryType = (query: string, expected: number): void => {
            const lexer = new MySQLLexer(CharStreams.fromString(query));
            lexer.serverVersion = 80020;
            expect(lexer.determineQueryType()).toBe(expected);
        };

        checkQueryType("", QueryType.Unknown);
        checkQueryType("Accentuate the positive", QueryType.Unknown);
        checkQueryType("alter", QueryType.Ambiguous);
        checkQueryType("alter database", QueryType.AlterDatabase);
        checkQueryType("alter logfile group", QueryType.AlterLogFileGroup);
        checkQueryType("alter function", QueryType.AlterFunction);
        checkQueryType("alter procedure", QueryType.AlterProcedure);
        checkQueryType("alter server a", QueryType.AlterServer);
        checkQueryType("alter table if exists", QueryType.AlterTable);
        checkQueryType("alter online table", QueryType.AlterTable);
        checkQueryType("alter tablespace 1", QueryType.AlterTableSpace);
        checkQueryType("alter event", QueryType.AlterEvent);
        checkQueryType("alter view", QueryType.AlterView);
        checkQueryType("create table if not exists", QueryType.CreateTable);
        checkQueryType("create index", QueryType.CreateIndex);
        checkQueryType("create database", QueryType.CreateDatabase);
        checkQueryType("create event", QueryType.CreateEvent);
        checkQueryType("create view", QueryType.CreateView);
        checkQueryType("create procedure", QueryType.CreateProcedure);
        checkQueryType("create function", QueryType.CreateFunction);
        checkQueryType("create aggregate function a()", QueryType.CreateUdf);
        checkQueryType("create trigger", QueryType.CreateTrigger);
        checkQueryType("create logfile group", QueryType.CreateLogFileGroup);
        checkQueryType("create server", QueryType.CreateServer);
        checkQueryType("create tablespace", QueryType.CreateTableSpace);
        checkQueryType("drop database", QueryType.DropDatabase);
        checkQueryType("drop event", QueryType.DropEvent);
        checkQueryType("drop function", QueryType.DropFunction);
        checkQueryType("drop procedure", QueryType.DropProcedure);
        checkQueryType("drop index", QueryType.DropIndex);
        checkQueryType("drop logfile group", QueryType.DropLogfileGroup);
        checkQueryType("drop server", QueryType.DropServer);
        checkQueryType("drop table", QueryType.DropTable);
        checkQueryType("drop tablespace", QueryType.DropTablespace);
        checkQueryType("drop trigger", QueryType.DropTrigger);
        checkQueryType("drop view", QueryType.DropView);
        checkQueryType("rename table", QueryType.RenameTable);
        checkQueryType("truncate table", QueryType.TruncateTable);
        checkQueryType("call abc", QueryType.Call);
        checkQueryType("delete from a", QueryType.Delete);
        checkQueryType("do delete from a", QueryType.Do);
        checkQueryType("handler a open b", QueryType.Handler);
        checkQueryType("insert ignore into a", QueryType.Insert);
        checkQueryType("load data", QueryType.Ambiguous);
        checkQueryType("load data local infile", QueryType.LoadData);
        checkQueryType("load xml", QueryType.LoadXML);
        checkQueryType("replace low_priority into a", QueryType.Replace);
        checkQueryType("select 1 from dual", QueryType.Select);
        checkQueryType("table a order by a.x", QueryType.Table);
        checkQueryType("values row(), row()", QueryType.Values);
        checkQueryType("update ignore a, b, c", QueryType.Update);
        checkQueryType("start transaction", QueryType.StartTransaction);
        checkQueryType("begin", QueryType.BeginWork);
        checkQueryType("commit", QueryType.Commit);
        checkQueryType("rollback", QueryType.RollbackWork);
        checkQueryType("set autocommit", QueryType.SetAutoCommit);
        checkQueryType("set transaction isolation level serializable", QueryType.SetTransaction);
        checkQueryType("savepoint here", QueryType.SavePoint);
        checkQueryType("release savepoint here", QueryType.ReleaseSavePoint);
        checkQueryType("rollback work to savepoint here", QueryType.RollbackSavePoint);
        checkQueryType("lock tables", QueryType.Lock);
        checkQueryType("unlock tables", QueryType.Unlock);
        checkQueryType("xa start 'abc'", QueryType.XA);
        checkQueryType("purge master logs", QueryType.Purge);
        checkQueryType("change master", QueryType.ChangeMaster);
        checkQueryType("reset persists a", QueryType.Reset);
        checkQueryType("reset master", QueryType.ResetMaster);
        checkQueryType("reset slave", QueryType.ResetSlave);
        checkQueryType("start slave", QueryType.StartSlave);
        checkQueryType("stop slave", QueryType.StopSlave);
        checkQueryType("load data from master", QueryType.LoadDataMaster);
        checkQueryType("load table a from master", QueryType.LoadTableMaster);
        checkQueryType("prepare a from ''", QueryType.Prepare);
        checkQueryType("execute a", QueryType.Execute);
        checkQueryType("deallocate prepare a", QueryType.Deallocate);
        checkQueryType("alter user mike", QueryType.AlterUser);
        checkQueryType("create user mike", QueryType.CreateUser);
        checkQueryType("drop user mike", QueryType.DropUser);
        checkQueryType("grant proxy on mike", QueryType.GrantProxy);
        checkQueryType("grant all on", QueryType.Grant);
        checkQueryType("rename user mike", QueryType.RenameUser);
        checkQueryType("revoke proxy on mike", QueryType.RevokeProxy);
        checkQueryType("revoke all", QueryType.Revoke);
        checkQueryType("analyze table a", QueryType.AnalyzeTable);
        checkQueryType("check table a", QueryType.CheckTable);
        checkQueryType("checksum table a", QueryType.ChecksumTable);
        checkQueryType("optimize table a", QueryType.OptimizeTable);
        checkQueryType("repair table a", QueryType.RepairTable);
        checkQueryType("backup table a", QueryType.BackUpTable);
        checkQueryType("restore table a", QueryType.RestoreTable);
        checkQueryType("install plugin xyz", QueryType.InstallPlugin);
        checkQueryType("uninstall plugin xyz", QueryType.UninstallPlugin);
        checkQueryType("set @a = 1", QueryType.Set);
        checkQueryType("set password for user mike", QueryType.SetPassword);
        checkQueryType("show", QueryType.Show);
        checkQueryType("Show Binary Logs", QueryType.ShowBinaryLogs);
        checkQueryType("Show BinLog Events", QueryType.ShowBinLogEvents);
        checkQueryType("Show RelayLog Events", QueryType.ShowRelayLogEvents);
        checkQueryType("Show Charset", QueryType.ShowCharset);
        checkQueryType("Show Char Set", QueryType.ShowCharset);
        checkQueryType("Show Collation", QueryType.ShowCollation);
        checkQueryType("Show Columns", QueryType.ShowColumns);
        checkQueryType("Show Create Database", QueryType.ShowCreateDatabase);
        checkQueryType("Show Create Event", QueryType.ShowCreateEvent);
        checkQueryType("Show Create Function", QueryType.ShowCreateFunction);
        checkQueryType("Show Create Procedure", QueryType.ShowCreateProcedure);
        checkQueryType("Show Create Table", QueryType.ShowCreateTable);
        checkQueryType("Show Create Trigger", QueryType.ShowCreateTrigger);
        checkQueryType("Show Create View", QueryType.ShowCreateView);
        checkQueryType("Show Databases", QueryType.ShowDatabases);
        checkQueryType("Show Engine Status", QueryType.ShowEngineStatus);
        checkQueryType("Show Storage Engines", QueryType.ShowStorageEngines);
        checkQueryType("Show Errors", QueryType.ShowErrors);
        checkQueryType("Show Events", QueryType.ShowEvents);
        checkQueryType("Show Function Code", QueryType.ShowFunctionCode);
        checkQueryType("Show Function Status", QueryType.ShowFunctionStatus);
        checkQueryType("Show Grant", QueryType.ShowGrants);
        checkQueryType("Show Indexes", QueryType.ShowIndexes);
        checkQueryType("Show Master Status", QueryType.ShowMasterStatus);
        checkQueryType("Show Open Tables", QueryType.ShowOpenTables);
        checkQueryType("Show Plugins", QueryType.ShowPlugins);
        checkQueryType("Show Procedure Status", QueryType.ShowProcedureStatus);
        checkQueryType("Show Procedure Code", QueryType.ShowProcedureCode);
        checkQueryType("Show Privileges", QueryType.ShowPrivileges);
        checkQueryType("Show full Processlist", QueryType.ShowProcessList);
        checkQueryType("Show Processlist", QueryType.ShowProcessList);
        checkQueryType("Show Profile", QueryType.ShowProfile);
        checkQueryType("Show Profiles", QueryType.ShowProfiles);
        checkQueryType("Show Slave Hosts", QueryType.ShowSlaveHosts);
        checkQueryType("Show Slave Status", QueryType.ShowSlaveStatus);
        checkQueryType("Show Status", QueryType.ShowStatus);
        checkQueryType("Show Variables", QueryType.ShowVariables);
        checkQueryType("Show Table Status", QueryType.ShowTableStatus);
        checkQueryType("Show Tables", QueryType.ShowTables);
        checkQueryType("Show Triggers", QueryType.ShowTriggers);
        checkQueryType("Show Warnings", QueryType.ShowWarnings);
        checkQueryType("cache index a in default", QueryType.CacheIndex);
        checkQueryType("flush privileges", QueryType.Flush);
        checkQueryType("kill query 1", QueryType.Kill);
        checkQueryType("load index into cache", QueryType.LoadIndex);
        checkQueryType("explain abc", QueryType.ExplainTable);
        checkQueryType("explain for me", QueryType.ExplainStatement);
        checkQueryType("help select", QueryType.Help);
        checkQueryType("use sakila", QueryType.Use);
    });
});
