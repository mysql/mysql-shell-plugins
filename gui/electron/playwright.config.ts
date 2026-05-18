/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

const { defineConfig } = require("@playwright/test");

const host = process.env.ELECTRON_E2E_VITE_HOST ?? "127.0.0.1";
const port = process.env.ELECTRON_E2E_VITE_PORT ?? "5174";
const rendererUrl = process.env.ELECTRON_E2E_RENDERER_URL ?? `http://${host}:${port}/`;

module.exports = defineConfig({
    testDir: "./tests/e2e",
    timeout: 120000,
    expect: {
        timeout: 15000,
    },
    fullyParallel: false,
    workers: 4,
    projects: [
        {
            name: "warmup",
            testMatch: /setup\/warmup\.spec\.ts/,
            retries: 1,
        },
        {
            name: "electron",
            testMatch: /specs\/.*\.spec\.ts/,
            dependencies: ["warmup"],
        },
    ],
    reporter: [
        ["list"],
        ["html", {
            open: "never",
            outputFolder: "test-reports/electron-e2e",
        }],
    ],
    use: {
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: "retain-on-failure",
    },
    webServer: {
        command: `npm --prefix ../frontend run run-vite:dev-server -- --host ${host} --port ${port} --strictPort`,
        url: rendererUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
