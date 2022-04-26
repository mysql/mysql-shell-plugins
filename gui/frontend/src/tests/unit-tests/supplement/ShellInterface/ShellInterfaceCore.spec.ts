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

import { platform, arch } from "os";

import { ShellInterface } from "../../../../supplement/ShellInterface";
import { MySQLShellLauncher } from "../../../../utilities/MySQLShellLauncher";
import { setupShellForTests } from "../../test-helpers";

describe("ShellInterfaceCore Tests", () => {
    let launcher: MySQLShellLauncher;

    beforeAll(async () => {
        launcher = await setupShellForTests(false, true, "DEBUG3");
    });

    afterAll(async () => {
        await launcher.exitProcess();
    });

    it("Backend Informations", async () => {
        // All available interfaces from the ShellInterface interface are singletons.
        const core = ShellInterface.core;
        expect(core).toBeDefined();

        const info = await core.backendInformation;

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
    });

});
