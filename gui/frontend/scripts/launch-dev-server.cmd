rem Copyright (c) 2020, 2022, Oracle and/or its affiliates.

setlocal enabledelayedexpansion

SET target_path=src/parsing/mysql/generated
SET run_generation=false
IF NOT EXIST "%target_path%/MySQLLexer.ts" SET run_generation=true
IF NOT EXIST "%target_path%/MySQLParser.ts" SET run_generation=true

IF %run_generation%==false (
    for %%? in ("%target_path%/MySQLLexer.ts") do (
        set MySQLLexerTime=%%~t?
    )
    for %%? in ("%target_path%/MySQLParser.ts") do (
        set MySQLParserTime=%%~t?
    )
    for %%? in ("%target_path%/../MySQLLexer.g4") do (
        set GrammaFileTime1=%%~t?
    )
    for %%? in ("%target_path%/../MySQLParser.g4") do (
        set GrammaFileTime2=%%~t?
    )
    IF !GrammaFileTime1! GTR !MySQLLexerTime! SET run_generation=true
    IF !GrammaFileTime2! GTR !MySQLParserTime! SET run_generation=true
)

if %run_generation%==true (
    echo "regenerate MySQL ..."
    call antlr4ts -no-visitor -Xexact-output-dir -o %target_path% src/parsing/mysql/*.g4
)

SET target_path=src/parsing/SQLite/generated
SET run_generation=false
IF NOT EXIST "%target_path%/SQLiteLexer.ts" SET run_generation=true
IF NOT EXIST "%target_path%/SQLiteParser.ts" SET run_generation=true

IF %run_generation%==false (
    for %%? in ("%target_path%/SQLiteLexer.ts") do (
        set SQLiteLexerTime=%%~t?
    )
    for %%? in ("%target_path%/SQLiteParser.ts") do (
        set SQLiteParserTime=%%~t?
    )
    for %%? in ("%target_path%/../SQLiteLexer.g4") do (
        set GrammaFileTime1=%%~t?
    )
    for %%? in ("%target_path%/../SQLiteParser.g4") do (
        set GrammaFileTime2=%%~t?
    )
    IF !GrammaFileTime1! GTR !SQLiteLexerTime! SET run_generation=true
    IF !GrammaFileTime2! GTR !SQLiteParserTime! SET run_generation=true
)

if %run_generation%==true (
    echo "regenerate SQLite ..."
    call antlr4ts -no-visitor -Xexact-output-dir -o %target_path% src/parsing/SQLite/*.g4
)

SET target_path=src/parsing/python/generated
SET run_generation=false
IF NOT EXIST "%target_path%/PythonLexer.ts" SET run_generation=true
IF NOT EXIST "%target_path%/PythonParser.ts" SET run_generation=true

IF %run_generation%==false (
    for %%? in ("%target_path%/PythonLexer.ts") do (
        set SQLiteLexerTime=%%~t?
    )
    for %%? in ("%target_path%/PythonParser.ts") do (
        set SQLiteParserTime=%%~t?
    )
    for %%? in ("%target_path%/../PythonLexer.g4") do (
        set GrammaFileTime1=%%~t?
    )
    for %%? in ("%target_path%/../PythonParser.g4") do (
        set GrammaFileTime2=%%~t?
    )
    IF !GrammaFileTime1! GTR !PythonLexerTime! SET run_generation=true
    IF !GrammaFileTime2! GTR !PythonParserTime! SET run_generation=true
)

if %run_generation%==true (
    echo "regenerate Python ..."
    call antlr4ts -no-visitor -Xexact-output-dir -o %target_path% src/parsing/python/*.g4
)

echo "Fixing node module(s)..."
call powershell.exe -command "(Get-Content node_modules/react-scripts/lib/react-app.d.ts).Replace('/// <reference types=\"react-dom\" />', '') | Set-Content node_modules/react-scripts/lib/react-app.d.ts"

SET NODE_OPTIONS=--max-old-space-size=8192
react-app-rewired start
