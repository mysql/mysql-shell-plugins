/*
 * Copyright (c) 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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
/* eslint-disable no-restricted-syntax */
import { defineConfig, devices } from "@playwright/test";

export const mysqlServerPort = 4407;

export default defineConfig({
    timeout: 200000,
    globalTimeout: 200000,
    webServer: {
        command: "npm run run-shell:single-user",
        timeout: 15000,
        port: 8000,
        name: "SHELL_SERVER",
        env: {
            ...process.env,
            MYSQLSH_USER_CONFIG_HOME: String(process.env.CONFIG_DIR)
        },
    },
    globalSetup: "./src/tests/e2e/migration_assistant/lib/setup/globalSetup.ts",
    globalTeardown: "./src/tests/e2e/migration_assistant/lib/setup/globalTearDown.ts",
    workers: 2,
    testDir: "src/tests/e2e/migration_assistant/tests",
    //testMatch: ["ui-migration-in-progress.spec.ts"],
    reporter: [
        ["html", { open: "never" }]
    ],
    use: {
        baseURL: "http://localhost:8000",
        navigationTimeout: 30000,
        actionTimeout: 5000,
        headless: true,
        screenshot: "only-on-failure",
        trace: "on-first-retry",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
