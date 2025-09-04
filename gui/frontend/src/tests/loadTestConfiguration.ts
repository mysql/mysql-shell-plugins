/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

/** This script loads the .env.test.json file and registers it as a globalThis field (`globalThis.testConfig`). */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const filename = fileURLToPath(import.meta.url);
const testConfigFile = join(dirname(filename), "./.env.test.json");
let testConfig: Record<string, string> = {};

try {
    let configContent = "{}";
    if (existsSync(testConfigFile)) {
        configContent = readFileSync(testConfigFile, "utf-8");
    }

    testConfig = JSON.parse(configContent) as Record<string, string>;
} catch (e) {
    console.error(`Failed to read or parse the test configuration file: ${testConfigFile}`);
    console.error(e);
}

globalThis.testConfig = testConfig;

export default testConfig;
