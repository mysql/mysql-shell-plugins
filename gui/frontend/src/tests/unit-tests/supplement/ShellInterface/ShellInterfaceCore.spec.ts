/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { existsSync, mkdirSync, rmSync } from "fs";
import { platform, arch, homedir } from "os";

import { ShellInterface, ShellInterfaceCore } from "../../../../supplement/ShellInterface";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";
import { setupShellForTests } from "../../test-helpers";

describe("ShellInterfaceCore Tests", () => {
    let launcher: MySQLShellLauncher;
    let core: ShellInterfaceCore;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG3");

        // All available interfaces from the ShellInterface interface are singletons.
        core = ShellInterface.core;
        expect(core).toBeDefined();
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Backend information", async () => {
        const info = await core.backendInformation;
        expect(info).toBeDefined();

        if (info) {
            switch (platform()) {
                case "darwin": {
                    expect(info.architecture === "arm64" || info.architecture === "x86_64").toBeTruthy();
                    break;
                }

                case "win32": {
                    expect(info.architecture === "Win32" || info.architecture === "Win64").toBeTruthy();
                    break;
                }

                case "linux": {
                    expect(info.architecture).toBe("x86_64");
                    break;
                }

                default:
            }

            switch (arch()) {
                case "arm": {
                    expect(info.architecture).toBe("arm");
                    break;
                }

                case "arm64": {
                    expect(info.architecture).toBe("arm64");
                    break;
                }

                case "x32": {
                    expect(info.architecture).toBe("x86");
                    break;
                }

                case "x64": {
                    expect(info.architecture).toBe("x86_64");
                    break;
                }

                default: {
                    // Anything else we cannot test.
                    break;
                }
            }

            expect(info.major).toBe(8);
            expect(info.minor).toBe(0);
        }
    });

    it("Log levels", async () => {
        let level = await core.getLogLevel();
        expect(level).toBe("DEBUG3"); // What we set when launching the shell.

        await core.setLogLevel("INFO");
        level = await core.getLogLevel();
        expect(level).toBe("INFO");
    });

    it("DB types", async () => {
        const types = await core.getDbTypes();
        expect(types).toStrictEqual(["Sqlite", "MySQL"]);
    });

    it("Validate path", async () => {
        let result = await core.validatePath("::");
        expect(result).toBeFalsy();

        result = await core.validatePath(""); // Resolves to the user's home dir.
        expect(result).toBeTruthy();

        // Absolute paths are valid anywhere.
        result = await core.validatePath(__dirname);
        expect(result).toBeTruthy();

        result = await core.validatePath(__dirname + "/non-existing");
        expect(result).toBeFalsy();
    });

    it("Create DB file", async () => {
        // Relative paths use the user's home dir as basis.
        await expect(core.createDatabaseFile("non-existing/test.sqlite3")).rejects
            .toBe("No permissions to access the directory.");
        expect(existsSync("non-existing/test.sqlite3")).toBeFalsy();

        const home = homedir();
        if (existsSync(home + "/local-test")) {
            // Maybe the folder is left over from a previous run.
            rmSync(home + "/local-test", { force: true, recursive: true });
        }
        mkdirSync(home + "/local-test");
        await core.createDatabaseFile("local-test/test.sqlite3");
        expect(existsSync("local-test/test.sqlite3")).toBeFalsy();
        expect(existsSync(home + "/local-test/test.sqlite3")).toBeTruthy();

        rmSync(home + "/local-test", { force: true, recursive: true });
    });

    it("Debugger", async () => {
        const names = await core.getDebuggerScriptNames();
        expect(names.length).toBeGreaterThan(20);
        expect(names).toContain("unit/authenticate/success_user.js");

        const content = await core.getDebuggerScriptContent("unit/authenticate/success_user.js");
        expect(content.length).toBeGreaterThan(100);
        expect(content).toContain(`"request": "authenticate",\n    "username": "user1",\n`);
    });
});
