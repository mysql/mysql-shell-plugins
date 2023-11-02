#!/bin/bash

# Copyright (c) 2020, 2023, Oracle and/or its affiliates.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

node --no-warnings --loader ts-node/esm scripts/generate-mrs-grammar.ts

# Generate parsers only if something in the source folder changed.
source=`ls -t src/parsing/mysql/MySQL* | head -1`
target=`ls -t src/parsing/mysql/generated/MySQL* 2> /dev/null | head -1`

if [[ $source -nt $target ]]; then
  printf "\x1b[1m\x1b[34mParser source files changed - regenerating target files..."
  printf "\x1b[0m\n\n"

  antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o ./src/parsing/mysql/generated src/parsing/mysql/MySQLMRS*.g4
  antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o ./src/parsing/SQLite/generated src/parsing/SQLite/*.g4
  antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o ./src/parsing/python/generated src/parsing/python/*.g4

  printf "\n"
fi

# We need lots of RAM when building with source maps. Without them 8GB are enough.
export NODE_OPTIONS="--max-old-space-size=16000"
SOURCE_MAPS=$1 node_modules/.bin/vite build
