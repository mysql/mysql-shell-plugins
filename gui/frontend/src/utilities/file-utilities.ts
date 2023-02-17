/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import path from "path";
import fs from "fs";

/** Contains code for use in a local environment (Node.js, native wrapper). */

/**
 * Checks if a given executable is in the OS path.
 * Absolute paths or such with a slash or back slash in it are returned as passed in.
 *
 * @param program The name of the program to find, without file extension.
 *
 * @returns Either the program path as given, if it is already absolute or contains a slash/back slash, or the first
 *          found path that can be used to access the given program. If none can be found then an empty string is
 *          returned.
 */
export const findExecutable = (program: string): string => {
    if (path.isAbsolute(program) || program.includes("/") || program.includes("\\")) {
        return program;
    }

    const envPath = process.env.PATH ?? "";
    const envExt = process.env.PATHEXT ?? "";
    const pathDirs = envPath.replace(/["]+/g, "").split(path.delimiter).filter(Boolean);
    const extensions = envExt.split(";");
    const candidates = pathDirs.flatMap((d) => {
        return extensions.map((ext) => {
            return path.join(d, program + ext);
        });
    });

    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }

    return "";
};
