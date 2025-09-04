/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import * as fs from "fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as os from "os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ResponseError } from "../../../../communication/ResponseError.js";

import { preferredShellVersion } from "../../../../app-logic/general-types.js";
import { ShellInterface } from "../../../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceCore } from "../../../../supplement/ShellInterface/ShellInterfaceCore.js";
import { convertErrorToString, versionMatchesExpected } from "../../../../utilities/helpers.js";
import { mockClassGetters, mockClassMethods } from "../../test-helpers.js";

let currentLogLevel = "DEBUG3"; // Default log level for the shell.

mockClassGetters(ShellInterfaceCore, {
    backendInformation: () => {
        return Promise.resolve({
            architecture: os.platform() === "win32" ? "x86_64" : "Win64",
            major: 9,
            minor: 0,
            patch: 1,
            platform: os.platform(),
            serverDistribution: "Test Distribution",
            serverMajor: 9,
            serverMinor: 0,
            serverPatch: 10
        });
    },
});

mockClassMethods(ShellInterfaceCore, {
    getLogLevel: () => {
        return Promise.resolve(currentLogLevel);
    },

    setLogLevel: (level: string) => {
        currentLogLevel = level;

        return Promise.resolve();
    },

    getDbTypes: () => {
        return Promise.resolve(["Sqlite", "MySQL"]);
    },

    validatePath: (path: string) => {
        if (path === "::") {
            return Promise.resolve(false);
        }

        if (path === "") {
            return Promise.resolve(true);
        }

        if (fs.existsSync(path)) {
            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    },

    createDatabaseFile: (path: string): Promise<void> => {
        if (path.startsWith("non-existing/")) {
            return Promise.reject(new ResponseError({ requestState: { msg: "No permissions to access the directory." } }));
        }

        const home = os.homedir();
        const fullPath = path.startsWith("/") ? path : `${home}/${path}`;

        if (!fs.existsSync(dirname(fullPath))) {
            fs.mkdirSync(dirname(fullPath), { recursive: true });
        }

        fs.writeFileSync(fullPath, "", { flag: "w" });

        return Promise.resolve();
    },

    getDebuggerScriptNames: () => {
        return Promise.resolve([
            "unit/authenticate/success_user.js",
            "unit/authenticate/failure_user.js",
            "unit/connection/create.js",
            "unit/connection/delete.js",
            "unit/connection/list.js",
            "unit/connection/update.js",
        ]);
    },

    getDebuggerScriptContent: (name: string) => {
        return Promise.resolve(`"request": "authenticate",
    "username": "user1",
    "password": "password1",
    "requestState": {
    "msg": "Authentication successful"`);
    }
});

describe("ShellInterfaceCore Tests", () => {
    let core: ShellInterfaceCore;

    beforeAll(() => {
        // All available interfaces from the ShellInterface interface are singletons.
        core = ShellInterface.core;
        expect(core).toBeDefined();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Backend information", async () => {
        const info = await core.backendInformation;
        expect(info).toBeDefined();

        if (info) {
            expect(info.architecture === "Win64" || info.architecture === "x86_64").toBeTruthy();
            expect(versionMatchesExpected([info.major, info.minor, 0], preferredShellVersion)).toBeTruthy();
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
        const fileName = fileURLToPath(import.meta.url);

        result = await core.validatePath(dirname(fileName));
        expect(result).toBeTruthy();

        result = await core.validatePath(dirname(fileName) + "/non-existing");
        expect(result).toBeFalsy();
    });

    it("Create DB file", async () => {
        // Relative paths use the user's home dir as basis.
        await expect(core.createDatabaseFile("non-existing/test.sqlite3")).rejects.toBeInstanceOf(ResponseError);

        try {
            await core.createDatabaseFile("non-existing/test.sqlite3");
        } catch (reason) {
            const message = convertErrorToString(reason);
            expect(message).toEqual("No permissions to access the directory.");
        }

        expect(fs.existsSync("non-existing/test.sqlite3")).toBeFalsy();

        const home = os.homedir();
        if (fs.existsSync(home + "/local-test")) {
            // Maybe the folder is left over from a previous run.
            fs.rmSync(home + "/local-test", { force: true, recursive: true });
        }
        fs.mkdirSync(home + "/local-test");
        await core.createDatabaseFile("local-test/test.sqlite3");
        expect(fs.existsSync("local-test/test.sqlite3")).toBeFalsy();
        expect(fs.existsSync(home + "/local-test/test.sqlite3")).toBeTruthy();

        fs.rmSync(home + "/local-test", { force: true, recursive: true });
    });

    it("Debugger", async () => {
        const names = await core.getDebuggerScriptNames();
        expect(names.length).toBeGreaterThan(5);
        expect(names).toContain("unit/authenticate/success_user.js");

        const content = await core.getDebuggerScriptContent("unit/authenticate/success_user.js");
        expect(content.length).toBeGreaterThan(100);
        expect(content).toContain(`"request": "authenticate",\n    "username": "user1",\n`);
    });
});
