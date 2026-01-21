/*
 * Copyright (c) 2026 Oracle and/or its affiliates.
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

import { spawnSync } from "child_process";
import { mkdirSync, rmSync, symlinkSync } from "fs";
import { join, resolve } from "path";

if (!process.env.DBROOTPASSWORD) {
    throw new Error("Please define env:DBROOTPASSWORD for the MySQL Server sandbox instance");
}

const configDirs = [join(process.cwd(), "shell-migration-default"), join(process.cwd(), "shell-migration-invalid")];
process.env.CONFIG_DIR_DEFAULT = configDirs[0];
process.env.CONFIG_DIR_INVALID = configDirs[1];

for (const configDir of configDirs) {
    rmSync(configDir, { recursive: true, force: true });

    // Install shell plugins on temp directory
    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(configDir, "plugins"), { recursive: true });

    const beGuiPlugin = resolve(process.cwd(), "..", "backend", "gui_plugin");
    const buildFolder = join(process.cwd(), "build");
    const webRootFolder = join(beGuiPlugin, "core", "webroot");
    const mrsPlugin = resolve(process.cwd(), "..", "..", "mrs_plugin");
    const mdsPlugin = resolve(process.cwd(), "..", "..", "mds_plugin");
    const msmPlugin = resolve(process.cwd(), "..", "..", "msm_plugin");
    const migrationPlugin = resolve(process.cwd(), "..", "..", "migration_plugin");

    symlinkSync(beGuiPlugin, join(configDir, "plugins", "gui_plugin"));
    rmSync(webRootFolder, { force: true });
    symlinkSync(buildFolder, webRootFolder);
    symlinkSync(mrsPlugin, join(configDir, "plugins", "mrs_plugin"));
    symlinkSync(mdsPlugin, join(configDir, "plugins", "mds_plugin"));
    symlinkSync(msmPlugin, join(configDir, "plugins", "msm_plugin"));
    symlinkSync(migrationPlugin, join(configDir, "plugins", "migration_plugin"));
}

const args = process.argv.toString().split(",");
const cmd = `playwright test`;
const path = `src/tests/e2e/migration_assistant/tests/`;

for (const arg of args) {
    if (arg.includes("--suite")) {
        const suite = arg.replace("--suite=", "");
        console.log(`Running suite '${suite}'...`);
        const result = spawnSync(`${cmd} ${path}ui-${suite}.spec.ts --trace on`,
            { shell: true, stdio: "inherit" });

        if (result.status !== 0) {
            process.exit(1);
        }

        process.exit(0);
    }
}

console.log("Running all test suites...");
const result = spawnSync(`playwright test --trace on`, { shell: true, stdio: "inherit" });

if (result.status !== 0) {
    process.exit(1);
}