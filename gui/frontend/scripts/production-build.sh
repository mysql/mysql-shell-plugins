#!/bin/bash

# Copyright (c) 2020, 2025, Oracle and/or its affiliates.

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

cwd=`dirname $0`

node --no-warnings --loader ts-node/esm scripts/generate-mrs-grammar.ts
node --no-warnings --loader ts-node/esm scripts/copy-oci-typings.ts

echo "Fixing node module(s)..."

# Fix for pixi-viewport: correct export paths in TypeScript definition file.
sed -i.bak "s|^export \* from './ease';|export * from './ease.js';|" node_modules/pixi-viewport/dist/index.d.ts && rm node_modules/pixi-viewport/dist/index.d.ts.bak
sed -i.bak "s|^export \* from './InputManager';|export * from './InputManager.js';|" node_modules/pixi-viewport/dist/index.d.ts && rm node_modules/pixi-viewport/dist/index.d.ts.bak
sed -i.bak "s|^export \* from './PluginManager';|export * from './PluginManager.js';|" node_modules/pixi-viewport/dist/index.d.ts && rm node_modules/pixi-viewport/dist/index.d.ts.bak
sed -i.bak "s|^export \* from './plugins';|export * from './plugins/index.js';|" node_modules/pixi-viewport/dist/index.d.ts && rm node_modules/pixi-viewport/dist/index.d.ts.bak
sed -i.bak "s|^export \* from './Viewport';|export * from './Viewport.js';|" node_modules/pixi-viewport/dist/index.d.ts && rm node_modules/pixi-viewport/dist/index.d.ts.bak

sed -i.bak "s|^import { InputManager } from './InputManager';|import { InputManager } from './InputManager.js';|" node_modules/pixi-viewport/dist/Viewport.d.ts && rm node_modules/pixi-viewport/dist/Viewport.d.ts.bak
sed -i.bak "s|^import { PluginManager } from './PluginManager';|import { PluginManager } from './PluginManager.js';|" node_modules/pixi-viewport/dist/Viewport.d.ts && rm node_modules/pixi-viewport/dist/Viewport.d.ts.bak

sed -i.bak "s|^export \* from '\(\./[^']*[^.js]\)';|export * from '\1.js';|" node_modules/pixi-viewport/dist/plugins/index.d.ts && rm node_modules/pixi-viewport/dist/plugins/index.d.ts.bak
sed -i.bak "s|^import { Plugin } from './Plugin';|import { Plugin } from './Plugin.js';|" node_modules/pixi-viewport/dist/plugins/Drag.d.ts && rm node_modules/pixi-viewport/dist/plugins/Drag.d.ts.bak
sed -i.bak "s|^import type { Viewport } from '../Viewport';|import type { Viewport } from '../Viewport.js';|" node_modules/pixi-viewport/dist/plugins/Drag.d.ts && rm node_modules/pixi-viewport/dist/plugins/Drag.d.ts.bak

sed -i.bak "s|^import type { Viewport } from '../Viewport';|import type { Viewport } from '../Viewport.js';|" node_modules/pixi-viewport/dist/plugins/Plugin.d.ts && rm node_modules/pixi-viewport/dist/plugins/Plugin.d.ts.bak

# Fix a missing source-map in monaco-editor.
sed -i.bak "/sourceMappingURL=marked.umd.js.map/d" node_modules/monaco-editor/esm/vs/base/common/marked/marked.js && rm node_modules/monaco-editor/esm/vs/base/common/marked/marked.js.bak

# Fix a missing source-map in the typescript package.
sed -i.bak "/sourceMappingURL=typescript.js.map/d" node_modules/typescript/lib/typescript.js && rm node_modules/typescript/lib/typescript.js.bak

printf "\n"

# Generate parsers only if something in the source folder changed.
source=`ls -t src/parsing/mysql/MySQL* | head -1`
target=`ls -t src/parsing/mysql/generated/MySQL* 2> /dev/null | head -1`

if [[ $source -nt $target ]]; then
  printf "\x1b[1m\x1b[34mParser source files changed - regenerating target files..."
  printf "\x1b[0m\n\n"

  antlr-ng -Dlanguage=TypeScript --exact-output-dir -o ./src/parsing/mysql/generated src/parsing/mysql/MySQLMRS*.g4
  antlr-ng -Dlanguage=TypeScript --exact-output-dir -o ./src/parsing/SQLite/generated src/parsing/SQLite/*.g4
  antlr-ng -Dlanguage=TypeScript --exact-output-dir -o ./src/parsing/python/generated src/parsing/python/*.g4

  printf "\n"
fi

# Include required MRS plugin resources as part of the frontend build
bash $cwd/generate-mrs-sdk-resource-links.sh

# We need lots of RAM when building with source maps. Without them 8GB are enough.
export NODE_OPTIONS="--max-old-space-size=16384"
SOURCE_MAPS=$1 node_modules/.bin/vite build
