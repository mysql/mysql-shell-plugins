/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { existsSync } from "fs";
import { join } from "path";
import { E2ETests } from "../lib/E2ETests";

const results: number[] = [];

const main = async () => {
    try {

        const cliArguments = E2ETests.getCliArguments();

        cliArguments.testSuite ? E2ETests.setTestSuite(cliArguments.testSuite) : E2ETests.readTestSuites();

        for (const testSuite of E2ETests.testSuites) {
            await E2ETests.installTestResources(testSuite);
            await E2ETests.installExtension(testSuite);
            E2ETests.setup(cliArguments);
            E2ETests.generateWebCertificate();
            results.push(await E2ETests.run(testSuite));
        }

        if (results.map((item) => { return item !== 0; }).length > 0) {
            throw new Error("Tests failed");
        }
    }
    finally {

        if (E2ETests.mysqlPort === "3308") {

            if (existsSync(join(E2ETests.mysqlSandboxDir, E2ETests.mysqlPort))) {

                try {
                    E2ETests.runShellCommand([
                        "--",
                        "dba",
                        "kill-sandbox-instance",
                        E2ETests.mysqlPort,
                        `--sandbox-dir=${E2ETests.mysqlSandboxDir}`,
                    ]);

                    console.log("[OK] Killed MySQL sandbox instance successfully");
                } catch (e) {
                    if (!String(e).includes("Unable to find pid file")) {
                        // eslint-disable-next-line no-unsafe-finally
                        throw e;
                    }
                    console.log("[OK] MySQL PID file not found. Continuing...");
                }

                E2ETests.runShellCommand([
                    "--",
                    "dba",
                    "delete-sandbox-instance",
                    E2ETests.mysqlPort,
                    `--sandbox-dir=${E2ETests.mysqlSandboxDir}`,
                ]);
                console.log("[OK] Deleted MySQL sandbox instance successfully");
            }
        }

        E2ETests.generateReport();
    }
};

void main().catch((err) => {
    throw err;
});
