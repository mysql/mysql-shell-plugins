/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';

// Get the project folder from the current file path
const path = new URL(import.meta.url).pathname;
const folder = path.substring(0, path.lastIndexOf('/'));
console.warn(`Building in project folder ${folder}...`);

export default defineConfig([
    {
        input: 'tests/index.spec.ts',
        output: {
            dir: 'build',
            format: 'es',
            sourcemap: true,
        },
        plugins: [typescript({
            compilerOptions: {
                // Force the sourceRoot to be in the actual project folder, to ensure map files use the right paths,
                // e.g.: '/Users/user/git/shell-plugins/mrs_plugin/examples/mrs_scripts'
                sourceRoot: folder
            }
        }), nodeResolve()]
    },
]);
