# Copyright (c) 2020, 2025, Oracle and/or its affiliates.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

node --no-warnings --loader ts-node/esm scripts/generate-mrs-grammar.ts
node --no-warnings --loader ts-node/esm scripts/copy-oci-typings.ts

Write-Host "Fixing node module(s)..."

# Fix for pixi-viewport: correct export path in TypeScript definition file
$pixiPath = "node_modules\pixi-viewport\dist\index.d.ts"
(Get-Content $pixiPath) -replace "^(export \* from './ease';)$", "export * from './ease.js';" | Set-Content $pixiPath
(Get-Content $pixiPath) -replace "^(export \* from './InputManager';)$", "export * from './InputManager.js';" | Set-Content $pixiPath
(Get-Content $pixiPath) -replace "^(export \* from './PluginManager';)$", "export * from './PluginManager.js';" | Set-Content $pixiPath
(Get-Content $pixiPath) -replace "^(export \* from './plugins';)$", "export * from './plugins/index.js';" | Set-Content $pixiPath
(Get-Content $pixiPath) -replace "^(export \* from './Viewport';)$", "export * from './Viewport.js';" | Set-Content $pixiPath

$pixiPath = "node_modules\pixi-viewport\dist\Viewport.d.ts"
(Get-Content $pixiPath) -replace "^(import { InputManager } from './InputManager';)$", "import { InputManager } from './InputManager.js';" | Set-Content $pixiPath
(Get-Content $pixiPath) -replace "^(import { PluginManager } from './PluginManager';)$", "import { PluginManager } from './PluginManager.js';" | Set-Content $pixiPath

$pixiPluginsPath = "node_modules\pixi-viewport\dist\plugins\index.d.ts"
(Get-Content $pixiPluginsPath) -replace "^export \* from '(./[^']*[^\.js])';", "export * from '$1.js';" | Set-Content $pixiPluginsPath

$dragPath = "node_modules\pixi-viewport\dist\plugins\Drag.d.ts"
(Get-Content $dragPath) -replace "^import { Plugin } from './Plugin';", "import { Plugin } from './Plugin.js';" | Set-Content $dragPath
(Get-Content $dragPath) -replace "^import type { Viewport } from '../Viewport';", "import type { Viewport } from '../Viewport.js';" | Set-Content $dragPath

$pluginPath = "node_modules\pixi-viewport\dist\plugins\Plugin.d.ts"
(Get-Content $pluginPath) -replace "^import type { Viewport } from '../Viewport';", "import type { Viewport } from '../Viewport.js';" | Set-Content $pluginPath

# Fix for monaco-editor: remove a missing source-map reference.
$monacoPath = "node_modules\monaco-editor\esm\vs\base\common\marked\marked.js"
(Get-Content $monacoPath) | Where-Object {$_ -notmatch "sourceMappingURL=marked.umd.js.map"} | Set-Content $monacoPath

# Fix for typescript: remove a missing source-map reference.
$typescriptPath = "node_modules\typescript\lib\typescript.js"
(Get-Content $typescriptPath) | Where-Object {$_ -notmatch "sourceMappingURL=typescript.js.map"} | Set-Content $typescriptPath

Write-Host ""

antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/MySQLLexer.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/MySQLParser.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/MySQLMRSLexer.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/MySQLMRSParser.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/SQLite/generated src/parsing/SQLite/SQLiteLexer.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/SQLite/generated src/parsing/SQLite/SQLiteParser.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/python/generated src/parsing/python/Python3Lexer.g4
antlr-ng -Dlanguage=TypeScript --exact-output-dir -o src/parsing/python/generated src/parsing/python/Python3Parser.g4

# Include required MRS plugin resources as part of the frontend build
$generate_sdk_resource_links_script = "$PSScriptRoot\generate-mrs-sdk-resource-links.ps1"
& $generate_sdk_resource_links_script

SET NODE_OPTIONS=--max-old-space-size=16000
SET SOURCE_MAPS=$1
node_modules/.bin/vite build
