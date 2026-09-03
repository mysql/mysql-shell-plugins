/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
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

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, readdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const test = require("node:test");

const { handleVersionCommand } = require("../src/version-command.cjs");
const packageVersion = require("../package.json").version;

const versionCases = [
    [undefined, `MySQL Workbench ${packageVersion}\n`],
    ["-commercial", `MySQL Workbench ${packageVersion}-commercial\n`],
];

for (const [desktopPackageSuffix, expectedOutput] of versionCases) {
    test(`--version prints the ${desktopPackageSuffix ? "commercial" : "community"} version`, () => {
        let output = "";
        const packageMetadata = {
            productName: "MySQL Workbench",
            version: packageVersion,
            desktopPackageSuffix,
        };

        const handled = handleVersionCommand(
            ["mysql-workbench", "--version"],
            packageMetadata,
            (value) => {
                output += value;
            },
        );

        assert.equal(handled, true);
        assert.equal(output, expectedOutput);
    });
}

for (const argument of ["-v", "--version=commercial", "--help"]) {
    test(`${argument} is not handled as the version command`, () => {
        let output = "";
        const handled = handleVersionCommand(
            ["mysql-workbench", argument],
            { productName: "MySQL Workbench", version: packageVersion },
            (value) => {
                output += value;
            },
        );

        assert.equal(handled, false);
        assert.equal(output, "");
    });
}

test("Electron --version runs without a display or application profile", {
    skip: process.platform !== "linux",
}, (t) => {
    const electronExecutable = process.env.ELECTRON_EXECUTABLE_PATH
        ?? resolve(__dirname, `../packaging/electron/linux-${process.arch}/electron`);
    if (!existsSync(electronExecutable)) {
        t.skip(`Electron executable is not available at ${electronExecutable}`);

        return;
    }

    const configDirectory = mkdtempSync(join(tmpdir(), "mysql-workbench-version-"));
    t.after(() => {
        rmSync(configDirectory, { recursive: true, force: true });
    });

    const environment = {
        ...process.env,
        XDG_CONFIG_HOME: configDirectory,
    };
    for (const name of [
        "DISPLAY",
        "ELECTRON_NO_ATTACH_CONSOLE",
        "ELECTRON_RUN_AS_NODE",
        "MIR_SOCKET",
        "WAYLAND_DISPLAY",
        "XDG_SESSION_TYPE",
    ]) {
        delete environment[name];
    }

    const result = spawnSync(
        electronExecutable,
        [resolve(__dirname, ".."), "--version"],
        {
            encoding: "utf8",
            env: environment,
            timeout: 15000,
        },
    );

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `MySQL Workbench ${packageVersion}\n`);
    assert.equal(result.stderr, "");
    assert.deepEqual(readdirSync(configDirectory), []);
});
