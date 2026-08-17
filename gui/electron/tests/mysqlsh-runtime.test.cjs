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
const { mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const { hasCommunicationDebugger } = require("../src/mysqlsh-runtime.cjs");

const createRuntime = (context) => {
    const runtime = mkdtempSync(join(tmpdir(), "mysql-workbench-runtime-"));
    context.after(() => {
        rmSync(runtime, { recursive: true, force: true });
    });

    return runtime;
};

test("communication debugger is unavailable without a runtime", () => {
    assert.equal(hasCommunicationDebugger(undefined), false);
});

test("communication debugger is unavailable when its plugin directory is missing", (context) => {
    const runtime = createRuntime(context);

    assert.equal(hasCommunicationDebugger(runtime), false);
});

test("communication debugger is available when its plugin directory exists", (context) => {
    const runtime = createRuntime(context);
    mkdirSync(join(runtime, "lib", "mysqlsh", "plugins", "gui_plugin", "debugger"), {
        recursive: true,
    });

    assert.equal(hasCommunicationDebugger(runtime), true);
});
