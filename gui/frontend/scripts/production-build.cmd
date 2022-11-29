rem Copyright (c) 2020, 2022, Oracle and/or its affiliates.

rem This program is free software; you can redistribute it and/or modify
rem it under the terms of the GNU General Public License, version 2.0,
rem as published by the Free Software Foundation.
rem
rem This program is also distributed with certain software (including
rem but not limited to OpenSSL) that is licensed under separate terms, as
rem designated in a particular file or component or in included license
rem documentation.  The authors of MySQL hereby grant you an additional
rem permission to link the program and your derivative works with the
rem separately licensed software that they have included with MySQL.
rem This program is distributed in the hope that it will be useful,  but
rem WITHOUT ANY WARRANTY; without even the implied warranty of
rem MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
rem the GNU General Public License, version 2.0, for more details.
rem
rem You should have received a copy of the GNU General Public License
rem along with this program; if not, write to the Free Software Foundation, Inc.,
rem 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

node scripts/copy-oci-typings.js

call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/*.g4
call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/SQLite/generated src/parsing/SQLite/*.g4
call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/python/generated src/parsing/python/*.g4

echo "Fixing node module(s)..."
call powershell.exe -command "(Get-Content node_modules/react-scripts/lib/react-app.d.ts).Replace('/// <reference types=\"react-dom\" />', '') | Set-Content node_modules/react-scripts/lib/react-app.d.ts"
call powershell.exe -command "(Get-Content node_modules/@types/babel__traverse/index.d.ts).Replace('export type ArrayKeys<T> = keyof { [P in keyof T as T[P] extends any[] ? P : never]: P };', 'export type ArrayKeys<T> = { [P in keyof T]: T[P] extends any[] ? P : never }[keyof T];') | Set-Content node_modules/@types/babel__traverse/index.d.ts"

SET NODE_OPTIONS=--max-old-space-size=8192
SET GENERATE_SOURCEMAP=%1
react-app-rewired build

