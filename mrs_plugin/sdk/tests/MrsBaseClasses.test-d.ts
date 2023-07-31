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

import { describe, expectTypeOf, it } from "vitest";
import type {
    DataFilter, BooleanFieldMapSelect, ColumnOrder, FieldNameSelect, IFindFirstOptions, IFindManyOptions,
    IFindUniqueOptions, IFindAllOptions, IMrsResultList, MaybeNull,
} from "../MrsBaseClasses";

describe("MRS SDK base types", () => {
    describe("BooleanFieldMapSelect", () => {
        it("accepts boolean toggles any field in the record", () => {
            const select: BooleanFieldMapSelect<{name:string,age:number}> = {};
            expectTypeOf(select).toHaveProperty("name");
            expectTypeOf(select).toHaveProperty("age");
            expectTypeOf(select.name).toEqualTypeOf<boolean|undefined>();
        });
    });

    describe("FieldNameSelect", () => {
        it("accepts a list of field names", () => {
            const select: FieldNameSelect<{name:string,age:number}> = [];
            expectTypeOf(select).toBeArray();
            expectTypeOf(select[0]).toEqualTypeOf<"name"|"age">();
        });
    });

    describe("IColumnOrder", () => {
        it("accepts the appropriate options to order a given column", () => {
            const orderBy: ColumnOrder<{name:string}> = {name:1};
            expectTypeOf(orderBy).toBeObject();
            expectTypeOf(orderBy).toHaveProperty("name");
            expectTypeOf(orderBy.name).toEqualTypeOf<"DESC"|"ASC"|-1|1|undefined>();
        });
    });

    describe("IFindFirstOptions", () => {
        it("accepts the appropriate options to retrieve a single record", () => {
            const options: IFindFirstOptions<unknown, unknown> = {};
            expectTypeOf(options).toBeObject();
            expectTypeOf(options).toHaveProperty("orderBy");
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options).toHaveProperty("skip");
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options).not.toHaveProperty("fetchAll");
            expectTypeOf(options).not.toHaveProperty("take");
        });

        it("accepts the appropriate option to order the result set", () => {
            const options: IFindFirstOptions<unknown, {name:string}> = {};
            expectTypeOf(options.orderBy).toEqualTypeOf<ColumnOrder<{name:string}>|undefined>();
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindFirstOptions<{name:string}, unknown> = {};
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{name:string}>|FieldNameSelect<{name:string}>|undefined>();
        });

        it("accepts the number of records to skip in the result set", () => {
            const options: IFindFirstOptions<{name:string}, unknown> = {};
            expectTypeOf(options.skip).toEqualTypeOf<number|undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindFirstOptions<unknown, {name:string}> = {};
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{name:string}>|undefined>();
        });
    });

    describe("IFindManyOptions", () => {
        it("accepts the appropriate options to retrieve multiple records", () => {
            const options: IFindManyOptions<unknown, unknown> = {};
            expectTypeOf(options).toBeObject();
            expectTypeOf(options).toHaveProperty("orderBy");
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options).toHaveProperty("skip");
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options).toHaveProperty("fetchAll");
            expectTypeOf(options).toHaveProperty("take");
        });

        it("accepts the appropriate option to order the result set", () => {
            const options: IFindManyOptions<unknown, {name:string}> = {};
            expectTypeOf(options.orderBy).toEqualTypeOf<ColumnOrder<{name:string}>|undefined>();
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindManyOptions<{name:string}, unknown> = {};
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{name:string}>|FieldNameSelect<{name:string}>|undefined>();
        });

        it("accepts the number of records to skip in the result set", () => {
            const options: IFindManyOptions<{name:string}, unknown> = {};
            expectTypeOf(options.skip).toEqualTypeOf<number|undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindManyOptions<unknown, {name:string}> = {};
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{name:string}>|undefined>();
        });

        it("accepts the appropriate option to retrieve every record from every page", () => {
            const options: IFindManyOptions<{name:string}, unknown> = {};
            expectTypeOf(options.fetchAll).toEqualTypeOf<IFindAllOptions<{name:string}>|boolean|undefined>();
        });
    });

    describe("IFindAllOptions", () => {
        it("accepts the size of each page", () => {
            const fetchAll: IFindAllOptions<{name:string}> = {};
            expectTypeOf(fetchAll).toBeObject();
            expectTypeOf(fetchAll).toHaveProperty("pageSize");
        });

        it("accepts a progress callback", () => {
            const fetchAll: IFindAllOptions<{name:string}> = {};
            const callback: ((items: IMrsResultList<{name:string}>) => Promise<void>) = () => {
                return Promise.resolve();
            };

            expectTypeOf(fetchAll).toBeObject();
            expectTypeOf(fetchAll).toHaveProperty("progress");
            expectTypeOf(fetchAll.pageSize).toEqualTypeOf<number|undefined>();
            expectTypeOf(fetchAll.progress).toEqualTypeOf<typeof callback|undefined>();
        });
    });

    describe("IFindUniqueOptions", () => {
        it("accepts the appropriate options to retrieve unique records", () => {
            const options: IFindUniqueOptions<unknown, unknown> = {};
            expectTypeOf(options).toBeObject();
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options).not.toHaveProperty("fetchAll");
            expectTypeOf(options).not.toHaveProperty("orderBy");
            expectTypeOf(options).not.toHaveProperty("skip");
            expectTypeOf(options).not.toHaveProperty("take");
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindUniqueOptions<{name:string}, unknown> = {};
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{name:string}>|FieldNameSelect<{name:string}>|undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindUniqueOptions<unknown, {name:string}> = {};
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{name:string}>|undefined>();
        });
    });

    describe("MaybeNull", () => {
        it("accepts a value of a given type", () => {
            const value: MaybeNull<number> = 2;
            expectTypeOf(value).toBeNumber();
        });

        it("accepts a null value", () => {
            const value: MaybeNull<number> = null;
            expectTypeOf(value).toBeNull();
        });
    });
});
