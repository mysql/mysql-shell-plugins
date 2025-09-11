/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import preact from "@preact/preset-vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { StaticHtmlReporter } from "./src/tests/reporter/StaticHtmlReporter.js";

const fileName = fileURLToPath(import.meta.url);

export default defineConfig({
    plugins: [preact()],
    test: {
        globalSetup: "./src/tests/globalSetup.ts",
        setupFiles: ["./src/tests/setupTestEnv.ts"],
        logHeapUsage: false,
        isolate: true,
        environment: "jsdom",
        pool: "threads",
        coverage: {
            enabled: false, // Enable coverage on demand using CLI --coverage flag.
            provider: "v8",
            include: ["src/**/*.ts", "src/**/*.tsx"],
            exclude: [
                "**/.antlr/",
                "**/generated/",
                "src/oci-typings/",
                "**/test-reports/",
                "src/tests/",
            ],
        },
        reporters: ["default", new StaticHtmlReporter("MySQL Shell GUI Unit Test Report")],
        outputFile: resolve("./src/tests/unit-tests/test-report/unit-tests/index.html"),
    },
    resolve: {
        alias: [
            {
                find: /monaco-editor$/,
                replacement: "monaco-editor/esm/vs/editor/editor.api",
            },
            {
                find: /tabulator-tables$/,
                replacement: "tabulator-tables/dist/js/tabulator_esm.js",
            },
            {
                find: /.+\.worker\?worker$/,
                replacement: resolve(dirname(fileName), "src/tests/unit-tests/__mocks__/workerMock.ts"),
            },
        ],
    },
});
