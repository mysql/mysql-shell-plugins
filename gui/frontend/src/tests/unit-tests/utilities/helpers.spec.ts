/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { binarySearch, flattenObject } from "../../../utilities/helpers";

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
});
