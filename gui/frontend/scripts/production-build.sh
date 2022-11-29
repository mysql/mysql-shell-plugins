#!/bin/bash

# Copyright (c) 2020, 2022, Oracle and/or its affiliates.

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

node scripts/copy-oci-typings.js

antlr4ts -no-visitor -Xexact-output-dir -o ./src/parsing/mysql/generated src/parsing/mysql/*.g4
antlr4ts -no-visitor -Xexact-output-dir -o ./src/parsing/SQLite/generated src/parsing/SQLite/*.g4
antlr4ts -no-visitor -Xexact-output-dir -o ./src/parsing/python/generated src/parsing/python/*.g4

echo "Fixing node module(s)..."
sed -ibackup "s/^\/\/\/ <reference types=\"react-dom\" \/>/ /" node_modules/react-scripts/lib/react-app.d.ts
sed -ibackup "s/^export type ArrayKeys<T> = keyof { \[P in keyof T as T\[P] extends any\[] ? P : never]: P };/export type ArrayKeys<T> = { [P in keyof T]: T[P] extends any[] ? P : never }[keyof T];/" node_modules/@types/babel__traverse/index.d.ts

NODE_OPTIONS=--max-old-space-size=8192 GENERATE_SOURCEMAP=$1 react-app-rewired build
