#!/bin/bash

# Copyright (c) 2020, 2021, Oracle and/or its affiliates.

port=$1

target_path=./src/parsing/mysql/generated
run_generation=false
if [ ! -f $target_path/MySQLLexer.ts ] || [ ! -f $target_path/MySQLParser.ts ]
then
    run_generation=true
else
    # Files exist, now check their file time.
    if [ $target_path/../MySQLLexer.g4 -nt $target_path/MySQLLexer.ts ] || [ $target_path/../MySQLParser.g4 -nt $target_path/MySQLParser.ts ]
    then
        run_generation=true
    fi
fi

if [ "$run_generation" = true ]
then
    #echo "regenerate MySQL"
    antlr4ts -no-visitor -Xexact-output-dir -o $target_path src/parsing/mysql/*.g4
fi

target_path=./src/parsing/SQLite/generated
run_generation=false

if [ ! -f $target_path/SQLiteLexer.ts ] || [ ! -f $target_path/SQLiteParser.ts ]
then
    run_generation=true
else
    # Files exist, now check their file time.
    if [ $target_path/../SQLiteLexer.g4 -nt $target_path/SQLiteLexer.ts ] || [ $target_path/../SQLiteParser.g4 -nt $target_path/SQLiteParser.ts ]
    then
        run_generation=true
    fi
fi

if [ "$run_generation" = true ]
then
    #echo "regenerate SQLite"
    antlr4ts -no-visitor -Xexact-output-dir -o $target_path src/parsing/SQLite/*.g4
fi

target_path=./src/parsing/python/generated
run_generation=false

if [ ! -f $target_path/PythonLexer.ts ] || [ ! -f $target_path/PythonParser.ts ]
then
    run_generation=true
else
    # Files exist, now check their file time.
    if [ $target_path/../PythonLexer.g4 -nt $target_path/PythonLexer.ts ] || [ $target_path/../PythonParser.g4 -nt $target_path/PythonParser.ts ]
    then
        run_generation=true
    fi
fi

if [ "$run_generation" = true ]
then
    #echo "regenerate Python"
    antlr4ts -no-visitor -Xexact-output-dir -o $target_path src/parsing/python/*.g4
fi

echo "Fixing node module(s)..."
sed -ibackup "s/^\/\/\/ <reference types=\"react-dom\" \/>/ /" node_modules/react-scripts/lib/react-app.d.ts

CERT_PATH=../backend/gui_plugin/core/certificates
PORT=$port HTTPS=true SSL_CRT_FILE=$CERT_PATH/server.crt SSL_KEY_FILE=$CERT_PATH/server.key NODE_OPTIONS=--max-old-space-size=8192 react-app-rewired start --no-cache
