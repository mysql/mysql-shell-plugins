/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { filterInt } from "../../utilities/string-helpers.js";

/**
 * Parses a string version number from a MySQL server and returns that as a number ("8.0.1" => 80001).
 *
 * @param version The version to convert.
 *
 * @returns The version as a number.
 */
export const parseVersion = (version: string): number => {
    const parts = version.trim().split(".");

    let result = 0;
    if (parts.length > 0 && parts[0].length > 0) {
        result += filterInt(parts[0]) * 10000;
        if (parts.length > 1) {
            result += filterInt(parts[1]) * 100;
            if (parts.length > 2) {
                result += filterInt(parts[2]);
            }
        }
    }

    return result;
};
