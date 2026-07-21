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

        return "";
    };

    restrictWindowsAccess("C:\\Users\\example\\state.json", false, runCommand);

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "powershell.exe");
    assert.deepEqual(calls[0][1].slice(0, -1), [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
    ]);
    const script = Buffer.from(calls[0][1].at(-1), "base64").toString("utf16le");

    assert.match(script, /D:P\(A;;FA;;;\$currentUser\)\(A;;FA;;;BA\)\(A;;FA;;;SY\)/);
    assert.match(script, /SetSecurityDescriptorSddlForm\(\$sddl, .*::Access\)/);
    assert.equal(
        Buffer.from(script.match(/FromBase64String\("([^"]+)"\)/)[1], "base64").toString("utf8"),
        "C:\\Users\\example\\state.json",
    );
});

test("restrictWindowsAccess makes directory grants inheritable", () => {
    const calls = [];
    const runCommand = (command, args) => {
        calls.push([command, args]);

        return "";
    };

    restrictWindowsAccess("C:\\Users\\example\\data", true, runCommand);

    const script = Buffer.from(calls[0][1].at(-1), "base64").toString("utf16le");

    assert.match(script, /D:P\(A;OICI;FA;;;\$currentUser\)\(A;OICI;FA;;;BA\)\(A;OICI;FA;;;SY\)/);
});
