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
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
    assert.match(script, /\$acl = New-Object Security\.AccessControl\.FileSecurity/);
    assert.match(script, /\[IO\.File\]::SetAccessControl\(\$targetPath, \$acl\)/);
    assert.doesNotMatch(script, /\b(?:Get|Set)-Acl\b/);
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
    assert.match(script, /\$acl = New-Object Security\.AccessControl\.DirectorySecurity/);
    assert.match(script, /\[IO\.Directory\]::SetAccessControl\(\$targetPath, \$acl\)/);
    assert.doesNotMatch(script, /\b(?:Get|Set)-Acl\b/);
});

test("restrictWindowsAccess is idempotent for files", { skip: process.platform !== "win32" }, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mysql-workbench-private-file-"));
    const filePath = path.join(directory, "state.json");
    fs.writeFileSync(filePath, "");
    t.after(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    restrictWindowsAccess(filePath, false);
    restrictWindowsAccess(filePath, false);
});

test("restrictWindowsAccess is idempotent for directories", { skip: process.platform !== "win32" }, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mysql-workbench-private-directory-"));
    t.after(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    restrictWindowsAccess(directory, true);
    restrictWindowsAccess(directory, true);
});
