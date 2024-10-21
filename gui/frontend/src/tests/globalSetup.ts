/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */

import type { Config } from "jest";
import { access, link, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const generateMrsSdkResourceLinks = async () => {
    const targetDir = resolve(__dirname, "..", "modules", "mrs", "sdk");
    const source = resolve(__dirname, "..", "..", "..", "..", "mrs_plugin", "sdk", "typescript",
        "MrsBaseClasses.ts");
    const target = resolve(targetDir, "MrsBaseClasses.ts");

    try {
        await access(target);
    } catch (err) {
        // file link does not exist
        try {
            await access(targetDir);
        } catch (err) {
            // directory does not exist
            await mkdir(targetDir, { recursive: true });
        } finally {
            // create file link
            await link(source, target);
        }
    }
};

module.exports = async (_globalConfig: unknown, _projectConfig: Config) => {
    await generateMrsSdkResourceLinks();
    process.chdir("./src/tests/unit-tests");
};
