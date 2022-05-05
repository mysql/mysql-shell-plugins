/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IOpenConnectionData, IShellFeedbackRequest, IShellResultType } from "../../../communication";
import { PromptUtils } from "../../../modules/common/PromptUtils";
import { ShellInterfaceShellSession } from "../../../supplement/ShellInterface";
import {
    binarySearch, clampValue, convertCamelToSnakeCase, flattenObject, loadTextFile, selectFile, sleep, strictEval, uuid,
    waitFor, convertSnakeToCamelCase, convertCamelToTitleCase, convertTitleToCamelCase, stripAnsiCode, deepEqual,
} from "../../../utilities/helpers";
import { loremIpsum, nextProcessTick, uuidPattern } from "../test-helpers";

describe("Utilities Tests", (): void => {
    it("flattenObject", (): void => {
        let result = flattenObject({});
        expect(result).toEqual({});

        result = flattenObject({ a: 1, b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });

        result = flattenObject({ name: "mike" });
        expect(result).toEqual({ name: "mike" });

        result = flattenObject({ a: 1, b: [1, 2, 3] });
        expect(result).toEqual({ a: 1, b: "[1, 2, 3]" });

        result = flattenObject({ a: { c: "test" }, b: 2 });
        expect(result).toEqual({ a: "{ \"c\": \"test\" }", b: 2 });

        const date = new Date("2021-07-20T11:19:16.288Z");
        result = flattenObject({
            test: [{
                name: "mike", f: (): boolean => {
                    return false;
                },
            }, [[date, date]]],
        });

        // Note: functions are not flattened but just left out.
        expect(result).toEqual({
            test: "[{ \"name\": \"mike\" }, [[\"2021-07-20T11:19:16.288Z\", \"2021-07-20T11:19:16.288Z\"]]]",
        },
        );
    });

    it("binary search", (): void => {
        interface IEntry {
            name: string;
            id: number;
        }

        const entries: IEntry[] = [
            { name: "123", id: 1 },
            { name: "999", id: 2 },
            { name: "aaa", id: 3 },
            { name: "aab", id: 4 },
            { name: "hhh", id: 5 },
            { name: "xxx", id: 6 },
        ];

        let index = binarySearch(entries, (current) => {
            return "aab".localeCompare(current.name);
        });

        expect(index).toEqual(3);
        index = binarySearch(entries, (current) => { return "".localeCompare(current.name); });
        expect(index).toEqual(-1);
        index = binarySearch(entries, (current) => { return "z".localeCompare(current.name); });
        expect(index).toEqual(-7);
        index = binarySearch(entries, (current) => { return "aac".localeCompare(current.name); });
        expect(index).toEqual(-5);
        index = binarySearch(entries, (current) => { return "123".localeCompare(current.name); });
        expect(index).toEqual(0);
        index = binarySearch(entries, (current) => { return "xxx".localeCompare(current.name); });
        expect(index).toEqual(5);
        index = binarySearch([] as IEntry[], (current) => { return "test".localeCompare(current.name); });
        expect(index).toEqual(-1);

        index = binarySearch(entries, (current) => { return 5 - current.id; });
        expect(index).toEqual(4);
        index = binarySearch(entries, (current) => { return -current.id; });
        expect(index).toEqual(-1);
        index = binarySearch(entries, (current) => { return 5e4 - current.id; });
        expect(index).toEqual(-7);
    });

    it("Build password request", (): void => {
        const result: IShellFeedbackRequest = {};
        result.password = "1234567";
        let passwordRequest = PromptUtils.splitAndBuildPasswdRequest(result,
            "request1", {} as ShellInterfaceShellSession);

        expect(passwordRequest).toBeDefined();
        expect(passwordRequest.caption).toEqual("1234567");

        result.password = "[1mPlease provide the password for 'root@localhost:3306': [0m";
        passwordRequest = PromptUtils.splitAndBuildPasswdRequest(result,
            "request1", {} as ShellInterfaceShellSession);

        expect(passwordRequest).toBeDefined();
        expect(passwordRequest.caption).toEqual("Open MySQL Connection in Shell Session");
        expect(passwordRequest.user).toEqual("root");
        expect(passwordRequest.service).toEqual("root@localhost:3306");

        result.password = "Please provide the password for ssh://user1@viking01:22:";
        passwordRequest = PromptUtils.splitAndBuildPasswdRequest(result,
            "request1", {} as ShellInterfaceShellSession);

        expect(passwordRequest).toBeDefined();
        expect(passwordRequest.caption).toEqual("Open SSH tunnel in Shell Session");
        expect(passwordRequest.service).toEqual("ssh://user1@viking01:22");
        expect(passwordRequest.user).toEqual("user1");

    });

    it("Load File", () => {
        const xhrMock: Partial<XMLHttpRequest> = {
            open: jest.fn(),
            send: jest.fn(),
            setRequestHeader: jest.fn(),
            readyState: 4,
            status: 200,
            responseText: "Hello World!",
        };

        jest.spyOn(window, "XMLHttpRequest").mockImplementation(() => {
            return xhrMock as XMLHttpRequest;
        });

        const callback = jest.fn();
        loadTextFile("a-file", true, callback);
        expect(xhrMock.open).toBeCalledWith("GET", "a-file", true);
        expect(xhrMock.setRequestHeader).toBeCalledWith("Accept", "text/plain");
        (xhrMock.onreadystatechange as EventListener)(new Event(""));
        expect(callback.mock.calls).toEqual([["Hello World!"]]);
    });

    it ("Shell prompt result test", (): void => {
        const val1 = { rows: [] };
        let result = val1 as IShellResultType;
        const val2 = { result: { prompt: "" }, requestState: { type: "error", msg: "test" } };
        const result2 = val2 as IOpenConnectionData;
        expect(PromptUtils.isShellPasswordResult(result)).toBe(false);
        expect(PromptUtils.isShellPromptResult(result)).toBe(false);
        expect(PromptUtils.isShellMdsPromptResult(result2)).toBe(true);

        const val3 = { password: "" };
        result = val3 as IShellResultType;
        expect(PromptUtils.isShellPasswordResult(result)).toBe(true);
        expect(PromptUtils.isShellPromptResult(result)).toBe(false);

        const val4 = { prompt: "" };
        result = val4 as IShellResultType;
        expect(PromptUtils.isShellPasswordResult(result)).toBe(false);
        expect(PromptUtils.isShellPromptResult(result)).toBe(true);
    });

    it("Select File", async () => {
        // Single file.
        let promise = selectFile("json", false);
        let inputs = document.getElementsByTagName("input");
        expect(inputs).toHaveLength(1);
        await nextProcessTick();

        // Fake file selection from the user. I cannot get a fake file to be inserted here, so we test with
        // an empty file list.
        const e = new Event("change", { bubbles: true });
        inputs[0].dispatchEvent(e);

        const singleValue = await promise;
        expect(singleValue).toBeNull();

        promise = selectFile("json", true);
        inputs = document.getElementsByTagName("input");
        expect(inputs).toHaveLength(1);
        await nextProcessTick();

        inputs[0].dispatchEvent(e);

        const valueList = await promise;
        expect(valueList).toHaveLength(0);
    });

    it("Various Tools", async () => {
        const result = await strictEval("1+2+3");
        expect(result).toBe(6);

        expect(() => { strictEval("nonExistingVariable + 1"); })
            .toThrowError("nonExistingVariable is not defined");

        expect(uuid()).toMatch(uuidPattern);

        expect(clampValue(0)).toBe(0);
        expect(clampValue(NaN)).toBe(NaN);
        expect(clampValue(NaN, undefined, undefined)).toBe(NaN);
        expect(clampValue(NaN, NaN, NaN)).toBe(NaN);
        expect(clampValue(100, NaN, NaN)).toBe(100);
        expect(clampValue(100, NaN, 80)).toBe(80);
        expect(clampValue(-1e6, -1e5, 0)).toBe(-1e5);
        expect(clampValue(0, 10, 5)).toBe(10);
        expect(clampValue(6, 10, 5)).toBe(10);
        expect(clampValue(11, 10, 5)).toBe(5);

        let timeout = false;
        let timer = setTimeout(() => {
            timeout = true;
        }, 1000);
        await sleep(800);
        clearTimeout(timer);
        expect(timeout).toBeFalsy();

        timeout = false;
        timer = setTimeout(() => {
            timeout = true;
        }, 1000);
        await sleep(1200);
        clearTimeout(timer);
        expect(timeout).toBeTruthy();

        timeout = false;
        timer = setTimeout(() => {
            timeout = true;
        }, 1000);

        let waitResult = await waitFor(500, () => {
            return timeout;
        });
        clearTimeout(timer);
        expect(waitResult).toBeFalsy();

        timeout = false;
        timer = setTimeout(() => {
            timeout = true;
        }, 250);

        waitResult = await waitFor(500, () => {
            return timeout;
        });
        clearTimeout(timer);
        expect(waitResult).toBeTruthy();

        expect(stripAnsiCode("")).toBe("");
        expect(stripAnsiCode(loremIpsum)).toBe(loremIpsum);

        const tail = "And another text";
        expect(stripAnsiCode(`\u001b[0;90m${loremIpsum}\u001b[0m${tail}`)).toBe(`${loremIpsum}${tail}`);
        expect(stripAnsiCode(`\u001b[?109h\u001b🖖NO-CODE\u001b[38;2;10;20;30`)).toBe("\u001b🖖NO-CODE");
    });

    it("Convert Cases", () => {
        let result = convertCamelToSnakeCase({});
        expect(result).toStrictEqual({});

        result = convertCamelToSnakeCase({}, {});
        expect(result).toStrictEqual({});

        result = convertCamelToSnakeCase({}, { ignore: [] });
        expect(result).toStrictEqual({});

        result = convertCamelToSnakeCase({}, { ignore: ["xxx", "yyy"] });
        expect(result).toStrictEqual({});

        /* eslint-disable @typescript-eslint/naming-convention */
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

        result = convertCamelToSnakeCase(source, { ignore: ["xxx", "yyy"] });
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

        result = convertSnakeToCamelCase(source, { ignore: ["xxx", "yyy"] });
        expect(result).toStrictEqual(camelCaseTarget);

        /* eslint-enable @typescript-eslint/naming-convention */

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

    it("Deep Equal", () => {
        expect(deepEqual(undefined, undefined)).toBeTruthy();
        expect(deepEqual(undefined, {})).toBeFalsy();

        const invalidMarker = {
            symbol: Symbol(),
        };

        const ignoreMarker = {
            symbol: Symbol("ignore"),
        };

        const ignoreMarker2 = {
            symbol: Symbol("ignore"),
        };

        const regexMarker = {
            symbol: Symbol("regex"),
            parameters: "[a-zA-Z0-9]+",
        };

        const listMarker = {
            symbol: Symbol("list"),
            parameters: {
                list: ["a", "b", "c"],
                full: true,
            },
        };

        const listMarker2 = {
            symbol: Symbol("list"),
            parameters: {
                list: ["a", "b", "c"],
                full: false,
            },
        };

        expect(deepEqual({}, {})).toBeTruthy();
        expect(deepEqual({ var1: true }, { var1: true })).toBeTruthy();
        expect(deepEqual({ var2: false, var1: true }, { var1: true, var2: false })).toBeTruthy();
        expect(deepEqual({ var2: false, o: { var1: true } }, { var1: true, o: { var2: false } })).toBeFalsy();
        expect(deepEqual({ var: 1 }, { var: 1, rav: 2 })).toBeFalsy();

        expect(deepEqual(ignoreMarker, ignoreMarker)).toBeTruthy(); // Same object.
        expect(deepEqual(ignoreMarker, ignoreMarker2)).toBeFalsy(); // Ignored values, but on both sides.
        expect(deepEqual(undefined, ignoreMarker)).toBeFalsy();

        // Order doesn't matter.
        expect(deepEqual([{ var: 1 }], ignoreMarker)).toBeTruthy();
        expect(deepEqual([{ var: 1 }], invalidMarker)).toBeFalsy();
        expect(deepEqual(ignoreMarker, [{ var: 1 }])).toBeTruthy();

        // Regex with and w/o string.
        expect(deepEqual([{ var: 1 }], regexMarker)).toBeFalsy();
        expect(deepEqual([{ var: 1 }], [{ var: regexMarker }])).toBeFalsy();
        expect(deepEqual([{ var: "" }], [{ var: regexMarker }])).toBeFalsy();
        expect(deepEqual([{ var: regexMarker }], [{ var: "AbC123" }])).toBeTruthy();

        // List.
        expect(deepEqual([[[[]]]], [[[[]]]])).toBeTruthy();
        expect(deepEqual([[[["ABC"]]]], [[[[ignoreMarker]]]])).toBeTruthy();
        expect(deepEqual([[[["ABC"]]]], [[[["123"]]]])).toBeFalsy();
        expect(deepEqual([[[["a", "b", "c"]]]], [[[listMarker]]])).toBeTruthy();
        expect(deepEqual([[[listMarker]]], [[[["1", "b", "c"]]]])).toBeFalsy();
        expect(deepEqual([[[["a", "b"]]]], [[[listMarker]]])).toBeFalsy(); // Full list.
        expect(deepEqual([[[["a", "b", "c", "d"]]]], [[[listMarker]]])).toBeFalsy(); // Full list.
        expect(deepEqual([[[["a", "b"]]]], [[[listMarker2]]])).toBeFalsy(); // Partial list.
        expect(deepEqual([[[["a", "b", "c", "d"]]]], [[[listMarker2]]])).toBeTruthy(); // Partial list.

        expect(deepEqual([[[{ var: 2 }]]], [[[listMarker]]])).toBeFalsy(); // Not a list.

        expect(deepEqual([[[["1", { var: "2" }, "3"]]]], [[[["1", { var: "2" }, "3"]]]])).toBeTruthy();
        expect(deepEqual([[[["1", { var: "b" }, "3"]]]], [[[["1", { var: "2" }, "3"]]]])).toBeFalsy();
        expect(deepEqual([[[["1", { var: "2" }, "3"]]]], [[[["1", "2", "3"]]]])).toBeFalsy();
    });
});
