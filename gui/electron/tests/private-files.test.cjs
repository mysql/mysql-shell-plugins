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

const assert = require("node:assert/strict");
const test = require("node:test");

const { restrictWindowsAccess } = require("../src/private-files.cjs");

test("restrictWindowsAccess grants file access to approved principals", () => {
    const calls = [];
    const runCommand = (command, args) => {
        calls.push([command, args]);

        return command === "whoami" ? "example\\user" : "";
    };

    restrictWindowsAccess("C:\\Users\\example\\state.json", false, runCommand);

    assert.deepEqual(calls, [
        ["whoami", []],
        ["icacls", [
            "C:\\Users\\example\\state.json",
            "/inheritance:r",
            "/grant:r", "example\\user:F",
            "/grant:r", "*S-1-5-32-544:F",
            "/grant:r", "*S-1-5-18:F",
        ]],
    ]);
});

test("restrictWindowsAccess makes directory grants inheritable", () => {
    const calls = [];
    const runCommand = (command, args) => {
        calls.push([command, args]);

        return command === "whoami" ? "example\\user" : "";
    };

    restrictWindowsAccess("C:\\Users\\example\\data", true, runCommand);

    assert.deepEqual(calls[1][1], [
        "C:\\Users\\example\\data",
        "/inheritance:r",
        "/grant:r", "example\\user:(OI)(CI)F",
        "/grant:r", "*S-1-5-32-544:(OI)(CI)F",
        "/grant:r", "*S-1-5-18:(OI)(CI)F",
    ]);
});
