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

import { readdirSync, existsSync, statSync } from "fs";
import { platform } from "os";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const scriptFolder = dirname(fileURLToPath(import.meta.url));
const frontEndFolder = resolve(scriptFolder, "..");
const guiFolder = resolve(frontEndFolder, "..");
const shellPluginsFolder = resolve(guiFolder, "..");

const buildMarker = join(frontEndFolder, "build", "index.html");
const buildInputs = [
    join(frontEndFolder, "src"),
    join(frontEndFolder, "scripts"),
    join(frontEndFolder, "public"),
    join(frontEndFolder, "index.html"),
    join(frontEndFolder, "package.json"),
    join(frontEndFolder, "package-lock.json"),
    join(frontEndFolder, "tsconfig.json"),
    join(frontEndFolder, "vite.config.ts"),
    join(frontEndFolder, "postcss.config.cjs"),
    join(frontEndFolder, "src", "vite-env.d.ts"),
    join(shellPluginsFolder, "mrs_plugin", "grammar"),
    join(shellPluginsFolder, "mrs_plugin", "sdk", "typescript", "MrsBaseClasses.ts"),
];

const withMaps = process.argv.includes("--with-maps");

const getLatestPathMtime = (targetPath: string): number => {
    if (!existsSync(targetPath)) {
        return Number.NEGATIVE_INFINITY;
    }

    const targetStats = statSync(targetPath);
    let latestMtime = targetStats.mtimeMs;

    if (!targetStats.isDirectory()) {
        return latestMtime;
    }

    for (const entry of readdirSync(targetPath)) {
        latestMtime = Math.max(latestMtime, getLatestPathMtime(join(targetPath, entry)));
    }

    return latestMtime;
};

const shouldRebuildFrontend = (): boolean => {
    if (!existsSync(buildMarker)) {
        return true;
    }

    const buildMarkerMtime = statSync(buildMarker).mtimeMs;
    const latestInputMtime = buildInputs.reduce((latest, targetPath) => {
        return Math.max(latest, getLatestPathMtime(targetPath));
    }, Number.NEGATIVE_INFINITY);

    return latestInputMtime > buildMarkerMtime;
};

const runCommand = (command: string): void => {
    const result = spawnSync(command, {
        cwd: frontEndFolder,
        shell: true,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        throw new Error(`Command failed: ${command}`);
    }
};

if (!shouldRebuildFrontend()) {
    console.log("[OK] Frontend build is up to date, skipping rebuild.");
    process.exit(0);
}

if (platform() === "win32") {
    const command = withMaps
        ? "pwsh scripts/production-build.ps1 true && tsc -p tsconfig.json"
        : "pwsh scripts/production-build.ps1 && tsc -p tsconfig.json";
    runCommand(command);
} else {
    const command = withMaps
        ? "bash ./scripts/production-build.sh true"
        : "bash ./scripts/production-build.sh";
    runCommand(command);
}
