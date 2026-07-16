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

const fs = require("fs");
const { spawnSync } = require("child_process");

const privateDirectoryMode = 0o700;
const privateFileMode = 0o600;
const administratorsSid = "*S-1-5-32-544";
const systemSid = "*S-1-5-18";

const run = (command, args) => {
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
    }

    return result.stdout.trim();
};

const restrictWindowsAccess = (targetPath, isDirectory, runCommand = run) => {
    const username = runCommand("whoami", []);
    const access = isDirectory ? "(OI)(CI)F" : "F";

    runCommand("icacls", [
        targetPath,
        "/inheritance:r",
        "/grant:r", `${username}:${access}`,
        "/grant:r", `${administratorsSid}:${access}`,
        "/grant:r", `${systemSid}:${access}`,
    ]);
};

const createPrivateFiles = ({ platform = process.platform, runCommand = run } = {}) => {
    const restrictAccess = (targetPath, isDirectory) => {
        if (platform === "win32") {
            restrictWindowsAccess(targetPath, isDirectory, runCommand);
        } else {
            fs.chmodSync(targetPath, isDirectory ? privateDirectoryMode : privateFileMode);
        }
    };

    return {
        ensurePrivateDirectory: (directory) => {
            fs.mkdirSync(directory, { recursive: true, mode: privateDirectoryMode });
            restrictAccess(directory, true);
        },
        ensurePrivateFile: (filePath) => {
            restrictAccess(filePath, false);
        },
        privateFileMode,
    };
};

module.exports = { createPrivateFiles, restrictWindowsAccess };
