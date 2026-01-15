/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { describe, expect, it } from "vitest";

import {
    convertCamelToTitleCase,
    convertObjectKeysCamelToSnakeCase,
    convertObjectKeysSnakeToCamelCase,
    convertPropValue,
    convertTitleToCamelCase,
    extractFirstQuotedToken,
    filterInt,
    formatTime,
    formatWithNumber,
    isWhitespaceOnly,
    parseQuotedObjectName,
    quoteIdentifier,
    quoteObjectName,
    quoteString,
    unquote,
    unquoteIdentifier,
} from "../../../utilities/string-helpers.js";
import { loremIpsum } from "../test-helpers.js";

describe("String Helpers Tests", () => {
    it("Quoting and Unquoting", () => {
        // Default quote char.
        expect(quoteIdentifier("")).toBe("``");
        expect(quoteIdentifier("'''''''")).toBe("`'''''''`");

        expect(quoteIdentifier("Need a quote")).toBe("`Need a quote`");
        expect(quoteIdentifier("`Need a quote`")).toBe("```Need a quote```");

        expect(unquoteIdentifier("not quoted"), "not quoted");
        expect(unquoteIdentifier("`quoted`"), "quoted");
        expect(unquoteIdentifier("`quo``ted`"), "quo`ted");
        expect(unquoteIdentifier("```quoted```"), "`quoted`");

        // Other quote chars.
        expect(quoteString("`Need a quote`")).toBe("'`Need a quote`'");
        expect(quoteString("'Need a quote'")).toBe("'\\'Need a quote\\''");
        expect(quoteString("Need a quote'")).toBe("'Need a quote\\''"); // Erroneous.
        expect(quoteString("'Need a quote")).toBe("'\\'Need a quote'"); // Erroneous.

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

    it("Quoting and Unquoting objects", () => {
        expect(quoteObjectName("db")).toBe("`db`");
        expect(quoteObjectName("d`b")).toBe("`d``b`");
        expect(quoteObjectName("`db`")).toBe("```db```");
        expect(quoteObjectName("db", "table")).toBe("`db`.`table`");
        expect(quoteObjectName("db", "table", "column")).toBe("`db`.`table`.`column`");
        expect(quoteObjectName("db", "ta`.`ble")).toBe("`db`.`ta``.``ble`");

        expect(parseQuotedObjectName("`db`")).toStrictEqual({ schema: "db" });
        expect(parseQuotedObjectName("`d``b`")).toStrictEqual({ schema: "d`b" });
        expect(parseQuotedObjectName("```db```")).toStrictEqual({ schema: "`db`" });
        expect(parseQuotedObjectName("`db`.`table`")).toStrictEqual({ schema: "db", objectName: "table" });
        expect(parseQuotedObjectName("`db`.`ta``.``ble`")).toStrictEqual({ schema: "db", objectName: "ta`.`ble" });

        // Test extractFirstQuotedToken integration
        expect(parseQuotedObjectName("`db`.`table`.`trigger`")).toStrictEqual({
            schema: "db", objectName: "table", name: "trigger"
        });

        expect(parseQuotedObjectName("`db`.`table`.`trigger`.`extra`")).toBeNull(); // More than 3 parts
    });

    it("Extract First Quoted Token", () => {
        expect(extractFirstQuotedToken("`schema`")).toStrictEqual({ token: "schema", remaining: "" });
        expect(extractFirstQuotedToken("`schema`.`table`")).toStrictEqual({ token: "schema", remaining: ".`table`" });
        expect(extractFirstQuotedToken("`a``b`.`c`")).toStrictEqual({ token: "a`b", remaining: ".`c`" });
        expect(extractFirstQuotedToken("no quotes here")).toBeNull();
        expect(extractFirstQuotedToken("")).toBeNull();
        expect(extractFirstQuotedToken("`unclosed")).toStrictEqual({ token: "`unclosed", remaining: "" });
        expect(extractFirstQuotedToken("prefix `identifier` suffix")).toStrictEqual({
            token: "identifier", remaining: " suffix"
        });
        expect(extractFirstQuotedToken("`empty``backticks`")).toStrictEqual({
            token: "empty`backticks", remaining: ""
        });
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
        expect(formatTime()).toBe("invalid time");
        expect(formatTime(-100)).toBe("invalid time");

        expect(formatTime(0)).toBe("0s");
        expect(formatTime(0.123)).toBe("123ms");
        expect(formatTime(1)).toBe("1s");
        expect(formatTime(1.2345)).toBe("1.2345s");
        expect(formatTime(9.999)).toBe("9.999s");

        expect(formatTime(45)).toBe("45s");
        expect(formatTime(100)).toBe("01:40");
        expect(formatTime(155)).toBe("02:35");
        expect(formatTime(155.9999)).toBe("02:36");
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

    it("Convert Cases", () => {
        let result = convertObjectKeysCamelToSnakeCase({});
        expect(result).toStrictEqual({});

        result = convertObjectKeysCamelToSnakeCase({}, {});
        expect(result).toStrictEqual({});

        result = convertObjectKeysCamelToSnakeCase({}, { ignore: [] });
        expect(result).toStrictEqual({});

        result = convertObjectKeysCamelToSnakeCase({}, { ignore: ["xxx", "yyy"] });
        expect(result).toStrictEqual({});

        const e = Symbol("§");
        const source = {
            _: true,
            T: 123,
            e,
            var_1: "var_1",
            var2: "var2",
            VarVar1: "VarVar1",
            var_Var2: "Var_Var2",
            var_Var_3: "VarVar3",
            o1: {
                var_1: "var_1",
                var2: "var2",
            },
            o2: {
                var_1: "var_1",
                var2: "var2",
                o1: {
                    var_1: "var_1",
                    var2: "var2",
                },
            },
            a1: [
                {
                    var_1: "var_1",
                    var2: "var2",
                },
                {
                    xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                    xxy: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                    var2: "yyy",
                    anotherKey: "xyz",
                },
                {
                    o: { o: { o: { o: { o: {} } } } },
                },
                [
                    {
                        var_1: "var_1",
                        var2: "var2",
                        o1: {
                            var_1: "var_1",
                            var2: "var2",
                        },
                    },
                    [
                        [
                            [
                                [
                                    {
                                        var_1: "var_1",
                                        var2: "var2",
                                        VarVar1: "VarVar1",
                                        var_Var2: "Var_Var2",
                                        var_Var_3: "VarVar3",
                                    },
                                    {
                                        xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                                        xxy: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                                        var2: "yyy",
                                    },
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        };

        const snakeCaseTarget = {
            _: true,
            T: 123,
            e,
            var_1: "var_1",
            var2: "var2",
            Var_var1: "VarVar1",
            var_Var2: "Var_Var2",
            var_Var_3: "VarVar3",
            o1: {
                var_1: "var_1",
                var2: "var2",
            },
            o2: {
                var_1: "var_1",
                var2: "var2",
                o1: {
                    var_1: "var_1",
                    var2: "var2",
                },
            },
            a1: [
                {
                    var_1: "var_1",
                    var2: "var2",
                },
                {
                    xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                    xxy: ["memberOne", "memberTwo", { member_three: true, member_four: false }],
                    var2: "yyy",
                    another_key: "xyz",
                },
                {
                    o: { o: { o: { o: { o: {} } } } },
                },
                [
                    {
                        var_1: "var_1",
                        var2: "var2",
                        o1: {
                            var_1: "var_1",
                            var2: "var2",
                        },
                    },
                    [
                        [
                            [
                                [
                                    {
                                        var_1: "var_1",
                                        var2: "var2",
                                        Var_var1: "VarVar1",
                                        var_Var2: "Var_Var2",
                                        var_Var_3: "VarVar3",
                                    },
                                    {
                                        xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                                        xxy: ["memberOne", "memberTwo", { member_three: true, member_four: false }],
                                        var2: "yyy",
                                    },
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        };

        result = convertObjectKeysCamelToSnakeCase(source, { ignore: ["xxx", "yyy"] });
        expect(result).toStrictEqual(snakeCaseTarget);

        const camelCaseTarget = {
            _: true,
            T: 123,
            e,
            var1: "var_1",
            var2: "var2",
            VarVar1: "VarVar1",
            varVar2: "Var_Var2",
            varVar3: "VarVar3",
            o1: {
                var1: "var_1",
                var2: "var2",
            },
            o2: {
                var1: "var_1",
                var2: "var2",
                o1: {
                    var1: "var_1",
                    var2: "var2",
                },
            },
            a1: [
                {
                    var1: "var_1",
                    var2: "var2",
                },
                {
                    xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                    xxy: ["memberOne", "memberTwo", { memberThree: true, memberFour: false }],
                    var2: "yyy",
                    anotherKey: "xyz",
                },
                {
                    o: { o: { o: { o: { o: {} } } } },
                },
                [
                    {
                        var1: "var_1",
                        var2: "var2",
                        o1: {
                            var1: "var_1",
                            var2: "var2",
                        },
                    },
                    [
                        [
                            [
                                [
                                    {
                                        var1: "var_1",
                                        var2: "var2",
                                        VarVar1: "VarVar1",
                                        varVar2: "Var_Var2",
                                        varVar3: "VarVar3",
                                    },
                                    {
                                        xxx: ["memberOne", "memberTwo", { memberThree: true, member_four: false }],
                                        xxy: ["memberOne", "memberTwo", { memberThree: true, memberFour: false }],
                                        var2: "yyy",
                                    },
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        };

        result = convertObjectKeysSnakeToCamelCase(source, { ignore: ["xxx", "yyy"] });
        expect(result).toStrictEqual(camelCaseTarget);

        expect(convertCamelToTitleCase("")).toBe("");
        expect(convertCamelToTitleCase("ABC")).toBe("ABC");
        expect(convertCamelToTitleCase("Abc")).toBe("Abc");
        expect(convertCamelToTitleCase("abc")).toBe("Abc");
        expect(convertCamelToTitleCase("😀")).toBe("😀");
        expect(convertCamelToTitleCase("X😀")).toBe("X😀");
        expect(convertCamelToTitleCase("x😀")).toBe("X😀");
        expect(convertCamelToTitleCase("xXxXx")).toBe("XXxXx");

        expect(convertTitleToCamelCase("")).toBe("");
        expect(convertTitleToCamelCase("ABC")).toBe("aBC");
        expect(convertTitleToCamelCase("Abc")).toBe("abc");
        expect(convertTitleToCamelCase("abc")).toBe("abc");
        expect(convertTitleToCamelCase("😀")).toBe("😀");
        expect(convertTitleToCamelCase("X😀")).toBe("x😀");
        expect(convertTitleToCamelCase("x😀")).toBe("x😀");
        expect(convertTitleToCamelCase("xXxXx")).toBe("xXxXx");
    });

    it("Misc", () => {
        expect(isWhitespaceOnly("")).toBe(false);
        expect(isWhitespaceOnly("   1   ")).toBe(false);
        expect(isWhitespaceOnly("\t\t\t")).toBe(true);
        expect(isWhitespaceOnly("   ")).toBe(true);
        expect(isWhitespaceOnly("\n\n\n")).toBe(true);
        expect(isWhitespaceOnly(loremIpsum)).toBe(false);
    });
});
