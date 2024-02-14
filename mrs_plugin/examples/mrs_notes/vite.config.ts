/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

/// <reference types="vitest" />

// https://vitejs.dev/config/

import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { existsSync, readFileSync } from "fs";
import { platform, homedir } from "os";
import { join } from "path";

// Use the MySQL Shell for VS Code certificate for HTTPS, if available
const shellUserConfigDir = (platform() === "win32")
    ? join(homedir(), "AppData", "Roaming", "MySQL", "mysqlsh-gui")
    : join(homedir(), ".mysqlsh-gui");
const certDir = join(shellUserConfigDir, "plugin_data", "gui_plugin", "web_certs");
const httpsSetting = existsSync(join(certDir, "server.key")) && existsSync(join(certDir, "server.crt")) && {
    key: readFileSync(join(certDir, "server.key")),
    cert: readFileSync(join(certDir, "server.crt")),
};

export default defineConfig({
    server: {
        https: httpsSetting,
    },
    base: "",
    define: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "import.meta.vitest": "undefined",
    },
    plugins: [preact()],
    test: {
        setupFiles: ["./vitest.setup.ts"],
        includeSource: ["src/**/*.{ts,tsx}"],
        coverage: {
            reporter: ["text-summary", "text"],
        },
        mockReset: true,
        restoreMocks: true,
    },
});
