rem Copyright (c) 2020, 2024, Oracle and/or its affiliates.

rem This program is free software; you can redistribute it and/or modify
rem it under the terms of the GNU General Public License, version 2.0,
rem as published by the Free Software Foundation.
rem
rem This program is designed to work with certain software (including
rem but not limited to OpenSSL) that is licensed under separate terms, as
rem designated in a particular file or component or in included license
rem documentation.  The authors of MySQL hereby grant you an additional
rem permission to link the program and your derivative works with the
rem separately licensed software that they have either included with
rem the program or referenced in the documentation.
rem
rem This program is distributed in the hope that it will be useful,  but
rem WITHOUT ANY WARRANTY; without even the implied warranty of
rem MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
rem the GNU General Public License, version 2.0, for more details.
rem
rem You should have received a copy of the GNU General Public License
rem along with this program; if not, write to the Free Software Foundation, Inc.,
rem 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

node --no-warnings --loader ts-node/esm scripts/generate-mrs-grammar.ts
node --no-warnings --loader ts-node/esm scripts/copy-oci-typings.ts

antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/*.g4
antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o src/parsing/SQLite/generated src/parsing/SQLite/*.g4
antlr4ng -Dlanguage=TypeScript -no-visitor -Xexact-output-dir -o src/parsing/python/generated src/parsing/python/*.g4

rem Include required MRS plugin resources as part of the frontend build
set cwd="%~dp0"
set target_dir="%cwd%..\src\modules\mrs\sdk"
if not exist %target_dir% (md %target_dir%)
set source="%cwd%..\..\..\mrs_plugin\sdk\typescript\MrsBaseClasses.ts"
set target="%target_dir%\MrsBaseClasses.ts"
if not exist %target% (mklink /h %target% %source%)

set NODE_OPTIONS=--max-old-space-size=16000
set SOURCE_MAPS=$1
node_modules/.bin/vite build
