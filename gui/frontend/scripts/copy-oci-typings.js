/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import glob from "glob";
import path from "path";
import fs from "fs";

const targetFolder = path.join("./src", "oci-typings");

const copyTypings = (folder) => {
    const typings = glob.sync(path.join("node_modules", folder, "**/*.d.ts"));

    typings.forEach((file) => {
        const targetName = path.join(targetFolder, file.substring("node_modules".length));

        fs.mkdirSync(path.dirname(targetName), { recursive: true });
        fs.copyFileSync(file, targetName);
    })

};

if (!fs.existsSync(targetFolder)) {
    console.log("Copying OCI typings...");

    copyTypings("oci-common");
    copyTypings("oci-core");
    copyTypings("oci-bastion");
    copyTypings("oci-mysql");
    copyTypings("oci-loadbalancer");
    // cspell: ignore workrequests
    copyTypings("oci-workrequests");
    copyTypings("oci-identity");

    console.log("done\n");
}
