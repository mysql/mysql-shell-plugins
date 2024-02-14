/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
    binarySearch, clampValue, flattenObject, selectFile, sleep, strictEval, uuid, waitFor, deepEqual,
} from "../../../utilities/helpers.js";
import { nextProcessTick, uuidPattern } from "../test-helpers.js";

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

    it("Select File", async () => {
        // Single file.
        let promise = selectFile([".json"], false);
        let inputs = document.getElementsByTagName("input");
        expect(inputs).toHaveLength(1);
        await nextProcessTick();

        // Fake file selection from the user. I cannot get a fake file to be inserted here, so we test with
        // an empty file list.
        const e = new Event("change", { bubbles: true });
        inputs[0].dispatchEvent(e);

        const singleValue = await promise;
        expect(singleValue).not.toBeNull();
        expect(singleValue).toHaveLength(0);

        promise = selectFile([".json"], true);
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
        expect(timeout).toBe(true);

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
        expect(waitResult).toBe(true);

    });

    it("Deep Equal", () => {
        expect(deepEqual(undefined, undefined)).toBe(true);
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

        expect(deepEqual({}, {})).toBe(true);
        expect(deepEqual({ var1: true }, { var1: true })).toBe(true);
        expect(deepEqual({ var2: false, var1: true }, { var1: true, var2: false })).toBe(true);
        expect(deepEqual({ var2: false, o: { var1: true } }, { var1: true, o: { var2: false } })).toBeFalsy();
        expect(deepEqual({ var: 1 }, { var: 1, rav: 2 })).toBeFalsy();

        expect(deepEqual(ignoreMarker, ignoreMarker)).toBe(true); // Same object.
        expect(deepEqual(ignoreMarker, ignoreMarker2)).toBeFalsy(); // Ignored values, but on both sides.
        expect(deepEqual(undefined, ignoreMarker)).toBeFalsy();

        // Order doesn't matter.
        expect(deepEqual([{ var: 1 }], ignoreMarker)).toBe(true);
        expect(deepEqual([{ var: 1 }], invalidMarker)).toBeFalsy();
        expect(deepEqual(ignoreMarker, [{ var: 1 }])).toBe(true);

        // Regex with and w/o string.
        expect(deepEqual([{ var: 1 }], regexMarker)).toBeFalsy();
        expect(deepEqual([{ var: 1 }], [{ var: regexMarker }])).toBeFalsy();
        expect(deepEqual([{ var: "" }], [{ var: regexMarker }])).toBeFalsy();
        expect(deepEqual([{ var: regexMarker }], [{ var: "AbC123" }])).toBe(true);

        // List.
        expect(deepEqual([[[[]]]], [[[[]]]])).toBe(true);
        expect(deepEqual([[[["ABC"]]]], [[[[ignoreMarker]]]])).toBe(true);
        expect(deepEqual([[[["ABC"]]]], [[[["123"]]]])).toBeFalsy();
        expect(deepEqual([[[["a", "b", "c"]]]], [[[listMarker]]])).toBe(true);
        expect(deepEqual([[[listMarker]]], [[[["1", "b", "c"]]]])).toBeFalsy();
        expect(deepEqual([[[["a", "b"]]]], [[[listMarker]]])).toBeFalsy(); // Full list.
        expect(deepEqual([[[["a", "b", "c", "d"]]]], [[[listMarker]]])).toBeFalsy(); // Full list.
        expect(deepEqual([[[["a", "b"]]]], [[[listMarker2]]])).toBeFalsy(); // Partial list.
        expect(deepEqual([[[["a", "b", "c", "d"]]]], [[[listMarker2]]])).toBe(true); // Partial list.

        expect(deepEqual([[[{ var: 2 }]]], [[[listMarker]]])).toBeFalsy(); // Not a list.

        expect(deepEqual([[[["1", { var: "2" }, "3"]]]], [[[["1", { var: "2" }, "3"]]]])).toBe(true);
        expect(deepEqual([[[["1", { var: "b" }, "3"]]]], [[[["1", { var: "2" }, "3"]]]])).toBeFalsy();
        expect(deepEqual([[[["1", { var: "2" }, "3"]]]], [[[["1", "2", "3"]]]])).toBeFalsy();
    });
});
