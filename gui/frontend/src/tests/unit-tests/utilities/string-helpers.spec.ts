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

import {
    convertPropValue, filterInt, formatTime, formatWithNumber, isWhitespaceOnly, quote, unquote,
} from "../../../utilities/string-helpers";
import { loremIpsum } from "../test-helpers";

describe("String Helpers Tests", () => {
    it("Quoting and Unquoting", () => {
        // Default quote char.
        expect(quote("")).toBe("``");
        expect(quote("'''''''")).toBe("`'''''''`");

        expect(quote("Need a quote")).toBe("`Need a quote`");
        expect(quote("`Need a quote`")).toBe("`Need a quote`");

        // Other quote chars.
        expect(quote("`Need a quote`", "\"")).toBe("\"`Need a quote`\"");
        expect(quote("\"Need a quote\"", "\"")).toBe("\"Need a quote\"");
        expect(quote("Need a quote\"", "\"")).toBe("\"Need a quote\"\""); // Erroneous.
        expect(quote("\"Need a quote", "\"")).toBe("\"\"Need a quote\""); // Erroneous.

        expect(quote("Need a quote", "(")).toBe("(Need a quote)");
        expect(quote("Need a quote", "{")).toBe("{Need a quote}");
        expect(quote("Need a quote", "[")).toBe("[Need a quote]");

        expect(quote("(Need a quote)", "(")).toBe("(Need a quote)");
        expect(quote("{Need a quote}", "{")).toBe("{Need a quote}");
        expect(quote("[Need a quote]", "[")).toBe("[Need a quote]");

        expect(quote("ooo", "O")).toBe("OoooO");

        expect(unquote("")).toBe("");
        expect(unquote("``")).toBe("");
        expect(unquote("''''''")).toBe("''''");
        expect(unquote("`No quotes please`")).toBe("No quotes please");
        expect(unquote("\"No quotes please\"")).toBe("No quotes please");
        expect(unquote("'No quotes please'")).toBe("No quotes please");
        expect(unquote("(No quotes please)")).toBe("(No quotes please)");
        expect(unquote("(No quotes please)", "(")).toBe("No quotes please");
        expect(unquote("{No quotes please}", "{")).toBe("No quotes please");
        expect(unquote("[No quotes please]", "[")).toBe("No quotes please");

        expect(unquote("[No quotes please[", "[")).toBe("[No quotes please[");
    });

    it("Property Values", () => {
        expect(convertPropValue()).toBeUndefined();
        expect(convertPropValue(undefined)).toBeUndefined();
        expect(convertPropValue(undefined, "px")).toBeUndefined();

        expect(convertPropValue("value")).toBe("value");
        expect(convertPropValue("value", "em")).toBe("value");

        expect(convertPropValue(123)).toBe("123px");
        expect(convertPropValue(123, "em")).toBe("123em");
    });

    it("Formatting and Filtering", () => {
        expect(formatTime()).toBe("unknown time");
        expect(formatTime(0)).toBe("0s");
        expect(formatTime(0.123)).toBe("123ms");
        expect(formatTime(1)).toBe("1s");
        expect(formatTime(1.2345)).toBe("1.2345s");
        expect(formatTime(9.999)).toBe("9.999s");

        expect(formatTime(45)).toBe("45s");
        expect(formatTime(100)).toBe("01:40");
        expect(formatTime(7600)).toBe("02:06:40");
        expect(formatTime(1000025)).toBe("11d 13:47:05");

        expect(formatWithNumber("dolphin", 0)).toBe("0 dolphins");
        expect(formatWithNumber("dolphin", 1)).toBe("1 dolphin");
        expect(formatWithNumber("dolphin", -1)).toBe("-1 dolphin");
        expect(formatWithNumber("dolphin", 10)).toBe("10 dolphins");

        expect(filterInt("a")).toBe(NaN);
        expect(filterInt("1")).toBe(1);
        expect(filterInt("-Infinity")).toBe(-Infinity);
        expect(filterInt("1ae2")).toBe(NaN);
    });

    it("Misc", () => {
        expect(isWhitespaceOnly("")).toBeFalsy();
        expect(isWhitespaceOnly("   1   ")).toBeFalsy();
        expect(isWhitespaceOnly("\t\t\t")).toBeTruthy();
        expect(isWhitespaceOnly("   ")).toBeTruthy();
        expect(isWhitespaceOnly("\n\n\n")).toBeTruthy();
        expect(isWhitespaceOnly(loremIpsum)).toBeFalsy();
    });
});
