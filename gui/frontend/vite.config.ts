/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */

import { defineConfig } from "vite";

import preact from "@preact/preset-vite";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import nodePolyfills from "rollup-plugin-polyfill-node";

import packageData from "./package.json";
import { execSync } from "child_process";
import { join } from "path";
import { platform } from "os";

const determineBuildNumber = (): string => {
    // First try to get the hash from an environment variable, if that exists.
    let sha = process.env.PUSH_REVISION;
    if (sha) {
        return `"${sha.substring(0, 7)}"`;
    }

    // Otherwise ask git directly.
    try {
        sha = execSync("git rev-parse --short HEAD", { timeout: 10000 }).toString();

        return `"${sha.trim()}"`;
    } catch (e) {
        return "<unknown>";
    }
};

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        preact({
            babel: {
                // Avoids repacking of chunks > 500KB.
                compact: false,
            },
        }),
        // @ts-ignore, because TS does not correctly type this plugin.
        monacoEditorPlugin.default({
            languageWorkers: ["typescript", "json", "editorWorkerService"],
            customDistPath: (root: string, outDir: string, base: string) => {
                return join(root, "build", base);
            },
        }),
    ],
    server: {
        host: "127.0.0.1",
        port: 3001,
    },
    define: {
        "process.env": process.env ?? {},
        "process.env.buildNumber": determineBuildNumber(),
        "process.env.versionNumber": JSON.stringify(packageData.version),
    },
    resolve: {
        alias: {
            util: "rollup-plugin-node-polyfills/polyfills/util",
            assert: "rollup-plugin-node-polyfills/polyfills/assert",
            os: "rollup-plugin-node-polyfills/polyfills/os",
            buffer: "rollup-plugin-node-polyfills/polyfills/buffer-es6",
            process: "rollup-plugin-node-polyfills/polyfills/process-es6",
            fs: "rollup-plugin-node-polyfills/polyfills/empty",
            net: "rollup-plugin-node-polyfills/polyfills/empty",
            perf_hooks: "rollup-plugin-node-polyfills/polyfills/empty",
            path: "rollup-plugin-node-polyfills/polyfills/path",
            child_process: "rollup-plugin-node-polyfills/polyfills/empty",
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                // @ts-ignore, because of incorrect type definitions.
                NodeModulesPolyfillPlugin(),
            ],
            // Node.js global to browser globalThis
            define: {
                global: "globalThis",
            },
            target: "es2022",
            logOverride: {
                "tsconfig.json": "silent",
            },
        },
        exclude: [
            "src/tests/*",
        ],
    },
    build: {
        chunkSizeWarningLimit: 1000,
        commonjsOptions: {
            dynamicRequireTargets: (platform() === "win32") ? [] : [
                "node_modules/antlr4ng/**/*.js",
            ],
        },
        minify: process.env.SOURCE_MAPS ? false : "terser",
        terserOptions: {
            ecma: 2020,
            format: {
                comments: false,
            },
            mangle: {
                keep_classnames: true,
            },
            keep_classnames: true,
        },
        sourcemap: Boolean(process.env.SOURCE_MAPS),
        assetsInlineLimit: 0,
        rollupOptions: {
            plugins: [
                // @ts-ignore, because of incorrect type definitions.
                nodePolyfills(),
                {
                    name: "no-treeshake",
                    transform: (_, id) => {
                        if (id.endsWith("/execute.ts")) {
                            return { moduleSideEffects: "no-treeshake" };
                        }
                    },
                },
            ],
            output: {
                dir: "build",
                format: "esm",
                esModule: true,
                exports: "auto",
                generatedCode: {
                    constBindings: true,
                    objectShorthand: true,
                },
                interop: "auto",
                manualChunks: (id: string): string | null => {
                    if (id.includes("node_modules/monaco-editor")) {
                        return "monaco-editor";
                    }

                    if (id.includes("node_modules/tabulator-tables")) {
                        return "tabulator-tables";
                    }

                    if (id.includes("node_modules")) {
                        return "dependencies";
                    }

                    return null;
                },
            },
            onLog: (level, log, defaultHandler) => {
                if (log.code !== "SHIMMED_EXPORT") { // Ignore shimmed export messages.
                    defaultHandler(level, log);
                }
            },
            shimMissingExports: true,
        },
    },
    worker: {
        format: "es",
    },
    css: {
        devSourcemap: false,
    },
});
