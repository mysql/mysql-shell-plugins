/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { parseVersion } from "../../../../parsing/mysql/mysql-helpers.js";

describe("MySQL helpers", () => {
    it("Version conversions", () => {
        // Only integer values are valid version number parts and can be converted.
        // Missing parts are interpreted as 0.
        expect(parseVersion("")).toBe(0);
        expect(parseVersion("abc")).toBe(NaN);
        expect(parseVersion("123   ")).toBe(1230000);
        expect(parseVersion("   123")).toBe(1230000);
        expect(parseVersion("00001")).toBe(10000);

        // The second part is larger than 99, so it runs over into the the major version value.
        expect(parseVersion("00001.666")).toBe(76600);
        expect(parseVersion("0x123.456.0b1001")).toBe(NaN);

        // Values beyond a 3rd version part are ignored.
        expect(parseVersion("10.20.30.40.50.60.............")).toBe(102030);

        // Outer whitespaces are ignored. Inner ones not, however.
        expect(parseVersion("    8.      0.28")).toBe(NaN);
        expect(parseVersion("  \n  8.0.28\n")).toBe(80028);
    });
});
