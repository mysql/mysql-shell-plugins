/*
 * Copyright (c) 2026 Oracle and/or its affiliates.
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
/* eslint-disable no-restricted-syntax */

import { readdirSync } from "fs";
import { join } from "path";
import { mysqlServerPort } from "../../../../../../playwright.config.js";
import { spawnSync } from "child_process";

const globalSetup = () => {

    // Deploy MySQL Sandbox instance
    spawnSync("mysqlsh", [
        "--",
        "dba",
        "deploy-sandbox-instance",
        `${mysqlServerPort}`,
        `--password=${process.env.DBROOTPASSWORD}`,
        `--sandbox-dir=${process.cwd()}`,
    ], { stdio: "inherit" });

    // Install SQL data
    const feSqlFiles = join(process.cwd(), "src", "tests", "e2e", "sql");
    const sqlFiles = readdirSync(feSqlFiles).map((item) => {
        return join(feSqlFiles, item);
    });

    for (const file of sqlFiles) {
        // eslint-disable-next-line max-len
        spawnSync(`mysqlsh root:${process.env.DBROOTPASSWORD}@localhost:${mysqlServerPort} --file ${file}`, { shell: true });
        console.log(`[OK] ${file} was executed successfully`);
    }
};

export default globalSetup;
