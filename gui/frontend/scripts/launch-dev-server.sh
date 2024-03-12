#!/bin/bash
# Copyright (c) 2020, 2024, Oracle and/or its affiliates.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

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
    antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o $target_path src/parsing/mysql/*.g4
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
    antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o $target_path src/parsing/SQLite/*.g4
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
    antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o $target_path src/parsing/python/*.g4
fi

echo "Fixing node module(s)..."
sed -ibackup "s/^\/\/\/ <reference types=\"react-dom\" \/>/ /" node_modules/react-scripts/lib/react-app.d.ts

CERT_PATH=~/.mysqlsh/plugin_data/gui_plugin/web_certs
PORT=$port HTTPS=true SSL_CRT_FILE=$CERT_PATH/server.crt SSL_KEY_FILE=$CERT_PATH/server.key NODE_OPTIONS=--max-old-space-size=8192 react-app-rewired start --no-cache
