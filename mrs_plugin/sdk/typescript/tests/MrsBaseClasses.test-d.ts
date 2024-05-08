/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { assertType, describe, expectTypeOf, it } from "vitest";
import {
    type PureFilter, type DataFilter, type BooleanFieldMapSelect, type ColumnOrder, type FieldNameSelect, type IFindFirstOptions, type IFindManyOptions,
    type IFindUniqueOptions, type IFindAllOptions, type IMrsResourceCollectionData, type MaybeNull, type Point, type MultiPoint, type LineString,
    type MultiLineString, type Polygon, type MultiPolygon, type Geometry, type GeometryCollection, type HighOrderFilter, type ComparisonOpExpr,
    type MrsResourceObject,
    type Cursor,
    IDeleteOptions,
} from "../MrsBaseClasses";

describe("MRS SDK base types", () => {
    describe("BooleanFieldMapSelect", () => {
        it("accepts boolean toggles any field in the record", () => {
            const select: BooleanFieldMapSelect<{ name: string, age: number; }> = {};
            expectTypeOf(select).toHaveProperty("name");
            expectTypeOf(select).toHaveProperty("age");
            expectTypeOf(select.name).toEqualTypeOf<boolean | undefined>();
        });
    });

    describe("FieldNameSelect", () => {
        it("allows a non-empty list of field names", () => {
            assertType<FieldNameSelect<{ foo: string }>>(["foo"]);
            // @ts-expect-error Empty arrays are not allowed.
            assertType<FieldNameSelect<{ foo: string }>>([]);
        });
    });

    describe("IColumnOrder", () => {
        it("accepts the appropriate options to order a given column", () => {
            const orderBy: ColumnOrder<{ name: string; }> = { name: 1 };
            expectTypeOf(orderBy).toBeObject();
            expectTypeOf(orderBy).toHaveProperty("name");
            expectTypeOf(orderBy.name).toEqualTypeOf<"DESC" | "ASC" | -1 | 1 | undefined>();
        });
    });

    describe("ComparisonOpExpr", () => {
        it("allows to check if some specific types of fields are equal to a given value", () => {
            // allowed
            expectTypeOf({ $eq: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $eq: "foo" }).toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $eq: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $eq: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $eq: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $eq: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if some specific types of fields are not equal to a given value", () => {
            // allowed
            expectTypeOf({ $ne: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $ne: "foo" }).toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $ne: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $ne: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $ne: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $ne: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if some specific types of fields are greater than a given value", () => {
            // allowed
            expectTypeOf({ $gt: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $gt: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $gt: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $gt: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $gt: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $gt: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if some specific types of fields are greater or equal than a given value", () => {
            // allowed
            expectTypeOf({ $gte: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $gte: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $gte: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $gte: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $gte: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $gte: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if some specific types of fields are lower than a given value", () => {
            // allowed
            expectTypeOf({ $lt: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $lt: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $lt: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $lt: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $lt: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $lt: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if some specific types of fields are lower or equal than a given value", () => {
            // allowed
            expectTypeOf({ $lte: 2 }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $lte: new Date() }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            // not allowed
            expectTypeOf({ $lte: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<string>>();
            expectTypeOf({ $lte: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $lte: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $lte: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if a textual field matches a given pattern", () => {
            // allowed
            expectTypeOf({ $like: "%foo%" }).toMatchTypeOf<ComparisonOpExpr<string>>();
            // not allowed
            expectTypeOf({ $like: 2 }).not.toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $like: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<Date>>();
            expectTypeOf({ $like: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $like: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $like: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if a textual field is a substring of a given string", () => {
            // allowed
            expectTypeOf({ $instr: "foo" }).toMatchTypeOf<ComparisonOpExpr<string>>();
            // not allowed
            expectTypeOf({ $instr: 2 }).not.toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $instr: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<Date>>();
            expectTypeOf({ $instr: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $instr: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $instr: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if a textual field is not a substring of a given string", () => {
            // allowed
            expectTypeOf({ $ninstr: "foo" }).toMatchTypeOf<ComparisonOpExpr<string>>();
            // not allowed
            expectTypeOf({ $ninstr: 2 }).not.toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $ninstr: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<Date>>();
            expectTypeOf({ $ninstr: true }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $ninstr: false }).not.toMatchTypeOf<ComparisonOpExpr<boolean>>();
            expectTypeOf({ $ninstr: null }).not.toMatchTypeOf<ComparisonOpExpr<null>>();
        });

        it("allows to check if a field is null", () => {
            // allowed
            expectTypeOf({ $null: true }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: false }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $null: null }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            // not allowed
            expectTypeOf({ $null: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $null: 2 }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $null: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
        });

        it("allows to check if a field is not null", () => {
            // allowed
            expectTypeOf({ not: null }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $null: false }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: true }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: null }).toMatchTypeOf<ComparisonOpExpr<unknown>>();
            // not allowed
            expectTypeOf({ not: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ not: 2 }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ not: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ not: true }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ not: false }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: "foo" }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: 2 }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $notnull: new Date() }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
        });

        it("allows to check if a field is between two values", () => {
            // allowed
            expectTypeOf({ $between: [1, 2] as const }).toMatchTypeOf<ComparisonOpExpr<number>>();
            expectTypeOf({ $between: [1, null] as const }).toMatchTypeOf<ComparisonOpExpr<number>>(); // same as $gte
            expectTypeOf({ $between: [null, 2] as const }).toMatchTypeOf<ComparisonOpExpr<number>>(); // same as $lte
            expectTypeOf({ $between: ["A", "C"] as const }).toMatchTypeOf<ComparisonOpExpr<string>>();

            const now = new Date(); // now
            const then = new Date(); // 2 days from now
            then.setUTCDate(now.getUTCDate() + 3);
            expectTypeOf({ $between: [now, then] as const }).toMatchTypeOf<ComparisonOpExpr<Date>>();
            expectTypeOf({ $between: [now, null] as const }).toMatchTypeOf<ComparisonOpExpr<Date>>(); // same as $lte
            expectTypeOf({ $between: [null, then] as const }).toMatchTypeOf<ComparisonOpExpr<Date>>(); // same as $gte

            // not allowed
            expectTypeOf({ $between: [true, false] as const }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
            expectTypeOf({ $between: [null, null] as const }).not.toMatchTypeOf<ComparisonOpExpr<unknown>>();
        });
    });

    describe("PureFilter", () => {
        it("allows checking if a field is implicitly equal to a value", () => {
            interface ITestType { x: string, y: number, z: boolean; }
            expectTypeOf<ITestType>().toMatchTypeOf<PureFilter<ITestType>>();
        });

        it("allows checking field value using an explicit operator", () => {
            interface IImplicitFilter { x: string; }
            interface IExplicitFilter { x: ComparisonOpExpr<string>; }
            expectTypeOf<IExplicitFilter>().toMatchTypeOf<PureFilter<IImplicitFilter>>();
        });
    });

    describe("HighOrderFilter", () => {
        it("allows a list of items containing implicit field checks", () => {
            expectTypeOf({ $and: [{ x: "foo" }, { y: "bar" }] })
                .toMatchTypeOf<HighOrderFilter<{ x: string, y: string; }>>();
        });

        it("allows a list of items containing explicit field checks", () => {
            expectTypeOf({ $and: [{ x: { $eq: "foo" } }, { y: { $eq: "bar" } }] })
                .toMatchTypeOf<HighOrderFilter<{ x: string, y: string; }>>();
        });

        it("allows a list of items containing other high order filters", () => {
            expectTypeOf({ $or: [{ $and: [{ x: "foo" }] }, { $and: [{ y: "bar" }] }] })
                .toMatchTypeOf<HighOrderFilter<{ x: string, y: string; }>>();

            expectTypeOf({ $or: [{ $and: [{ x: { $eq: "foo" } }] }, { $and: [{ y: { $eq: "bar" } }] }] })
                .toMatchTypeOf<HighOrderFilter<{ x: string, y: string; }>>();
        });
    });

    describe("DataFilter", () => {
        it("allows AND/OR operators defined at the first level of the JSON tree", () => {
            interface ITestType { x: string; }
            type ITestFilter = HighOrderFilter<ITestType>;
            expectTypeOf<ITestFilter>().toMatchTypeOf<DataFilter<ITestType>>();
        });
    });

    describe("Cursor", () => {
        it("allows to set a cursor of the given type", () => {
            expectTypeOf({ x: "foo" }).toMatchTypeOf<Cursor<{ x: string }>>();
        });

        it("does not allow undefined cursors", () => {
            expectTypeOf({ x: undefined }).not.toMatchTypeOf<Cursor<{ x: string }>>();
        });

        it("does not allow an empty set of cursors", () => {
            expectTypeOf({}).not.toMatchTypeOf<Cursor<{ x: string }>>();
        });
    });

    describe("IFindFirstOptions", () => {
        it("accepts the appropriate option to order the result set", () => {
            const options: IFindFirstOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("orderBy");
            expectTypeOf(options.orderBy).toEqualTypeOf<ColumnOrder<{ name: string; }> | undefined>();
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindFirstOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{ name: string; }> | FieldNameSelect<{ name: string; }> | undefined>();
        });

        it("accepts the number of records to skip in the result set", () => {
            const options: IFindFirstOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("skip");
            expectTypeOf(options.skip).toEqualTypeOf<number | undefined>();
        });

        it("does not accept the maximum number of records to include in the result set", () => {
            expectTypeOf<{ take: number }>().not.toMatchTypeOf<IFindFirstOptions<unknown, unknown, unknown>>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindFirstOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{ name: string; }> | undefined>();
        });

        it("does not allow to enable or disable iterator behavior", () => {
            expectTypeOf<IFindFirstOptions<unknown, unknown, unknown>>().not.toHaveProperty("iterator");
        });

        it("allows to set a pagination cursor when there is an eligible field", () => {
            interface IIterable { id: string }
            const options: IFindFirstOptions<unknown, unknown, IIterable> = {};
            expectTypeOf(options).toHaveProperty("cursor");
            expectTypeOf(options.cursor).toEqualTypeOf<Cursor<IIterable> | undefined>();
        });

        it("does not allow to set a pagination cursor when there are no eligible fields", () => {
            expectTypeOf<IFindFirstOptions<unknown, unknown>>().not.toHaveProperty("cursor");
        });
    });

    describe("IFindManyOptions", () => {
        it("accepts the appropriate option to order the result set", () => {
            const options: IFindManyOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("orderBy");
            expectTypeOf(options.orderBy).toEqualTypeOf<ColumnOrder<{ name: string; }> | undefined>();
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindManyOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{ name: string; }> | FieldNameSelect<{ name: string; }> | undefined>();
        });

        it("accepts the number of records to skip in the result set", () => {
            const options: IFindManyOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("skip");
            expectTypeOf(options.skip).toEqualTypeOf<number | undefined>();
        });

        it("accepts the maximum number of records to include the result set", () => {
            const options: IFindManyOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("take");
            expectTypeOf(options.take).toEqualTypeOf<number | undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindManyOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{ name: string; }> | undefined>();
        });

        it("allows to enable or disable iterator behavior", () => {
            const options: IFindManyOptions<unknown, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("iterator");
            expectTypeOf(options.iterator).toEqualTypeOf<boolean | undefined>();
        });

        it("does not accept a progress callback with the list of items retrieved", () => {
            expectTypeOf<IFindManyOptions<unknown, unknown, unknown>>().not.toHaveProperty("progress");
        });

        it("allows to set a pagination cursor when there is an eligible field", () => {
            interface IIterable { id: string }
            const options: IFindManyOptions<unknown, unknown, IIterable> = {};
            expectTypeOf(options).toHaveProperty("cursor");
            expectTypeOf(options.cursor).toEqualTypeOf<Cursor<IIterable> | undefined>();
        });

        it("does not allow to set a pagination cursor when there are no eligible fields", () => {
            expectTypeOf<IFindManyOptions<unknown, unknown>>().not.toHaveProperty("cursor");
        });
    });

    describe("IFindAllOptions", () => {
        it("accepts the appropriate option to order the result set", () => {
            const options: IFindAllOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("orderBy");
            expectTypeOf(options.orderBy).toEqualTypeOf<ColumnOrder<{ name: string; }> | undefined>();
        });

        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindAllOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{ name: string; }> | FieldNameSelect<{ name: string; }> | undefined>();
        });

        it("does not accept the maximum number of records to include in the result set", () => {
            expectTypeOf<IFindAllOptions<unknown, unknown, unknown>>().not.toHaveProperty("take");
        });

        it("accepts the number for records to skip in the result set", () => {
            const options: IFindAllOptions<{ name: string; }, unknown, unknown> = {};
            expectTypeOf(options).toHaveProperty("skip");
            expectTypeOf(options.skip).toEqualTypeOf<number | undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindAllOptions<unknown, { name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{ name: string; }> | undefined>();
        });

        it("does not allow to enable or disable iterator behavior", () => {
            expectTypeOf<IFindAllOptions<unknown, unknown, unknown>>().not.toHaveProperty("iterator");
        });

        it("accepts a progress callback with the list of items retrieved at each step", () => {
            interface IItem { name: string }
            const fetchAll: IFindAllOptions<IItem, unknown, unknown> = {};
            const callback: ((items: IItem[]) => Promise<void>) = () => {
                return Promise.resolve();
            };

            expectTypeOf(fetchAll).toHaveProperty("progress");
            expectTypeOf(fetchAll.progress).toEqualTypeOf<typeof callback | undefined>();
        });

        it("allows to set a pagination cursor when there is an eligible field", () => {
            interface IIterable { id: string }
            const options: IFindAllOptions<unknown, unknown, IIterable> = {};
            expectTypeOf(options).toHaveProperty("cursor");
            expectTypeOf(options.cursor).toEqualTypeOf<Cursor<IIterable> | undefined>();
        });

        it("does not allow to set a pagination cursor when there are no eligible fields", () => {
            expectTypeOf<IFindAllOptions<unknown, unknown>>().not.toHaveProperty("cursor");
        });
    });

    describe("IFindUniqueOptions", () => {
        it("accepts the appropriate option to select specific fields from the records in the result set", () => {
            const options: IFindUniqueOptions<{ name: string; }, unknown> = {};
            expectTypeOf(options).toHaveProperty("select");
            expectTypeOf(options.select).toEqualTypeOf<
                BooleanFieldMapSelect<{ name: string; }> | FieldNameSelect<{ name: string; }> | undefined>();
        });

        it("accepts the appropriate option to filter the records in the result set", () => {
            const options: IFindUniqueOptions<unknown, { name: string; }> = {};
            expectTypeOf(options).toHaveProperty("where");
            expectTypeOf(options.where).toEqualTypeOf<DataFilter<{ name: string; }> | undefined>();
        });

        it("does not accept the maximum number of records to include in the result set", () => {
            expectTypeOf<IFindUniqueOptions<unknown, unknown>>().not.toHaveProperty("take");
        });

        it("does not accept the number for records to skip in the result set", () => {
            expectTypeOf<IFindUniqueOptions<unknown, unknown>>().not.toHaveProperty("skip");
        });

        it("does not accept an option to order the result set", () => {
            expectTypeOf<IFindUniqueOptions<unknown, unknown>>().not.toHaveProperty("orderBy");
        });

        it("does not allow to enable or disable iterator behavior", () => {
            expectTypeOf<IFindUniqueOptions<unknown, unknown>>().not.toHaveProperty("iterator");
        });

        it("does not allow to set a pagination cursor", () => {
            expectTypeOf<IFindUniqueOptions<unknown, unknown>>().not.toHaveProperty("cursor");
        });
    });

    describe("IDeleteOptions", () => {
        it("allows matching fields from the underlying type", () => {
            expectTypeOf({ where: { name: "foo" } }).toMatchTypeOf<IDeleteOptions<{ name: string }, { many: true }>>();
            expectTypeOf({ where: { name: "foo" } }).toMatchTypeOf<IDeleteOptions<{ name: string }, { many: false }>>();
        });

        it("allows high order operators for multiple matches", () => {
            expectTypeOf({ where: { $or: [{ name: "foo" }, { age: 42 }] } })
                .toMatchTypeOf<IDeleteOptions<{ name: string, age: number }, { many: true }>>();
        });

        it("does not allow high order operators for unique matches", () => {
            expectTypeOf({ where: { $or: [{ name: "foo" }, { age: 42 }] } })
                .not.toMatchTypeOf<IDeleteOptions<{ name: string, age: number }, { many: false }>>();
        })
    })

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

    describe("Point", () => {
        it("accepts a Well-Known Text string value", () => {
            const point: Point = "Point(15 20)";
            expectTypeOf(point).toBeString();
        });

        it("accepts a GeoJSON object value", () => {
            const point: Point = { type: "Point", coordinates: [15, 20] };
            expectTypeOf(point).toBeObject();
            expectTypeOf(point).toHaveProperty("type");
            expectTypeOf(point).toHaveProperty("coordinates");
            expectTypeOf(point.type).toBeString();
            expectTypeOf(point.coordinates).toBeArray();
            point.coordinates.forEach((coordinate) => {
                expectTypeOf(coordinate).toBeNumber();
            });
        });
    });

    describe("MultiPoint", () => {
        it("accepts a Well-Known Text string value", () => {
            const multiPoint: MultiPoint = "MultiPoint(0 0, 20 20, 60 60)";
            expectTypeOf(multiPoint).toBeString();
        });

        it("accepts a GeoJSON object value", () => {
            const multiPoint: MultiPoint = { type: "MultiPoint", coordinates: [[0, 0], [20, 20], [60, 60]] };
            expectTypeOf(multiPoint).toBeObject();
            expectTypeOf(multiPoint).toHaveProperty("type");
            expectTypeOf(multiPoint).toHaveProperty("coordinates");
            expectTypeOf(multiPoint.type).toBeString();
            expectTypeOf(multiPoint.coordinates).toBeArray();
            multiPoint.coordinates.forEach((point) => {
                expectTypeOf(point).toBeArray();
                point.forEach((coordinate) => {
                    expectTypeOf(coordinate).toBeNumber();
                });
            });
        });
    });

    describe("LineString", () => {
        it("accepts a Well-Known Text string value", () => {
            let lineString: LineString = "LINESTRING(0 0, 10 10, 20 25, 50 60)";
            expectTypeOf(lineString).toBeString();

            lineString = "LineString(0 0, 10 10, 20 25, 50 60)";
            expectTypeOf(lineString).toBeString();

            // @ts-expect-error
            lineString = "linestring(0 0, 10 10, 20 25, 50 60)";
        });

        it("accepts a GeoJSON object value", () => {
            const lineString: LineString = { type: "LineString", coordinates: [[0, 0], [10, 10], [20, 25], [50, 60]] };
            expectTypeOf(lineString).toBeObject();
            expectTypeOf(lineString).toHaveProperty("type");
            expectTypeOf(lineString).toHaveProperty("coordinates");
            expectTypeOf(lineString.type).toBeString();
            expectTypeOf(lineString.coordinates).toBeArray();
            lineString.coordinates.forEach((point) => {
                expectTypeOf(point).toBeArray();
                point.forEach((coordinate) => {
                    expectTypeOf(coordinate).toBeNumber();
                });
            });
        });
    });

    describe("MultiLineString", () => {
        it("accepts a Well-Known Text string value", () => {
            let lineString: MultiLineString = "MULTILINESTRING((10 10, 20 20), (15 15, 30 15))";
            expectTypeOf(lineString).toBeString();

            lineString = "MultiLineString((10 10, 20 20), (15 15, 30 15))";
            expectTypeOf(lineString).toBeString();

            // @ts-expect-error
            lineString = "multilinestring((10 10, 20 20), (15 15, 30 15))";
        });

        it("accepts a GeoJSON object value", () => {
            const lineString: MultiLineString = {
                type: "MultiLineString",
                coordinates: [[[10, 10], [20, 20]], [[15, 15], [30, 15]]],
            };

            expectTypeOf(lineString).toBeObject();
            expectTypeOf(lineString).toHaveProperty("type");
            expectTypeOf(lineString).toHaveProperty("coordinates");
            expectTypeOf(lineString.type).toBeString();
            expectTypeOf(lineString.coordinates).toBeArray();
            lineString.coordinates.forEach((linestring) => {
                expectTypeOf(linestring).toBeArray();
                linestring.forEach((point) => {
                    expectTypeOf(point).toBeArray();
                    point.forEach((coordinate) => {
                        expectTypeOf(coordinate).toBeNumber();
                    });
                });
            });
        });
    });

    describe("Polygon", () => {
        it("accepts a Well-Known Text string value", () => {
            let polygon: Polygon = "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))";
            expectTypeOf(polygon).toBeString();

            polygon = "Polygon((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))";
            expectTypeOf(polygon).toBeString();

            // @ts-expect-error
            polygon = "polygon((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))";
        });

        it("accepts a GeoJSON object value", () => {
            const polygon: Polygon = {
                type: "Polygon",
                coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]],
            };

            expectTypeOf(polygon).toBeObject();
            expectTypeOf(polygon).toHaveProperty("type");
            expectTypeOf(polygon).toHaveProperty("coordinates");
            expectTypeOf(polygon.type).toBeString();
            expectTypeOf(polygon.coordinates).toBeArray();
            polygon.coordinates.forEach((linearRing) => {
                expectTypeOf(linearRing).toBeArray();
                linearRing.forEach((point) => {
                    expectTypeOf(point).toBeArray();
                    point.forEach((coordinate) => {
                        expectTypeOf(coordinate).toBeNumber();
                    });
                });
            });
        });
    });

    describe("MultiPolygon", () => {
        it("accepts a Well-Known Text string value", () => {
            let multiPolygon: MultiPolygon =
                "MULTIPOLYGON(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
            expectTypeOf(multiPolygon).toBeString();

            multiPolygon = "MultiPolygon(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
            expectTypeOf(multiPolygon).toBeString();

            // @ts-expect-error
            multiPolygon = "multipolygon(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
            // @ts-expect-error
            multiPolygon = "Multipolygon(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
        });

        it("accepts a GeoJSON object value", () => {
            const multiPolygon: MultiPolygon = {
                type: "MultiPolygon",
                coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
                [[[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]]],
            };

            expectTypeOf(multiPolygon).toBeObject();
            expectTypeOf(multiPolygon).toHaveProperty("type");
            expectTypeOf(multiPolygon).toHaveProperty("coordinates");
            expectTypeOf(multiPolygon.type).toBeString();
            expectTypeOf(multiPolygon.coordinates).toBeArray();
            multiPolygon.coordinates.forEach((polygon) => {
                expectTypeOf(polygon).toBeArray();
                polygon.forEach((linearRing) => {
                    expectTypeOf(linearRing).toBeArray();
                    linearRing.forEach((point) => {
                        expectTypeOf(point).toBeArray();
                        point.forEach((coordinate) => {
                            expectTypeOf(coordinate).toBeNumber();
                        });
                    });
                });
            });
        });
    });

    describe("Geometry", () => {
        it("accepts a Well-Known Text string representing an object of a single-value spatial datatype", () => {
            let geometry: Geometry = "Point(15 20)";
            expectTypeOf(geometry).toMatchTypeOf<Point>();

            geometry = "LineString(0 0, 10 10, 20 25, 50 60)";
            expectTypeOf(geometry).toMatchTypeOf<LineString>();

            geometry = "Polygon((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))";
            expectTypeOf(geometry).toMatchTypeOf<Polygon>();

            // @ts-expect-error
            geometry = "MultiPoint(0 0, 20 20, 60 60)";
            // @ts-expect-error
            geometry = "MultiLineString((10 10, 20 20), (15 15, 30 15))";
            // @ts-expect-error
            geometry = "MultiPolygon(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
        });

        it("accepts a GeoJSON object representing an object of a single-value spatial datatype", () => {
            let geometry: Geometry = { type: "Point", coordinates: [15, 20] };
            expectTypeOf(geometry).toMatchTypeOf<Point>();

            geometry = { type: "LineString", coordinates: [[0, 0], [10, 10], [20, 25], [50, 60]] };
            expectTypeOf(geometry).toMatchTypeOf<LineString>();

            geometry = {
                type: "Polygon",
                coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]],
            };
            expectTypeOf(geometry).toMatchTypeOf<Polygon>();

            // @ts-expect-error
            geometry = { type: "MultiPoint", coordinates: [[0, 0], [20, 20], [60, 60]] };
            // @ts-expect-error
            geometry = { type: "MultiLineString", coordinates: [[[10, 10], [20, 20]], [[15, 15], [30, 15]]] };
            geometry = {
                // @ts-expect-error
                type: "MultiPolygon",
                // @ts-expect-error
                coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
                // @ts-expect-error
                [[[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]]],
            };
        });
    });

    describe("GeometryCollection", () => {
        it("accepts a Well-Known Text string representing a collection of objects of a spatial datatype", () => {
            let geometryCollection: GeometryCollection = "MultiPoint(0 0, 20 20, 60 60)";
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiPoint>();

            geometryCollection = "MultiLineString((10 10, 20 20), (15 15, 30 15))";
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiLineString>();

            geometryCollection = "MultiPolygon(((0 0, 10 0, 10 10, 0 10, 0 0)),((5 5, 7 5, 7 7, 5 7, 5 5)))";
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiPolygon>();

            // @ts-expect-error
            geometryCollection = "Point(15 20)";
            // @ts-expect-error
            geometryCollection = "LineString(0 0, 10 10, 20 25, 50 60)";
            // @ts-expect-error
            geometryCollection = "Polygon((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))";
        });

        it("accepts a GeoJSON object representing a collection of objects of a spatial datatype", () => {
            let geometryCollection: GeometryCollection = {
                type: "MultiPoint",
                coordinates: [[0, 0], [20, 20], [60, 60]],
            };
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiPoint>();

            geometryCollection = { type: "MultiLineString", coordinates: [[[10, 10], [20, 20]], [[15, 15], [30, 15]]] };
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiLineString>();

            geometryCollection = {
                type: "MultiPolygon",
                coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
                [[[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]]],
            };
            expectTypeOf(geometryCollection).toMatchTypeOf<MultiPolygon>();

            // @ts-expect-error
            geometryCollection = { type: "Point", coordinates: [15, 20] };
            // @ts-expect-error
            geometryCollection = { type: "LineString", coordinates: [[0, 0], [10, 10], [20, 25], [50, 60]] };
            geometryCollection = {
                // @ts-expect-error
                type: "Polygon",
                // @ts-ignore
                coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[5, 5], [7, 5], [7, 7], [5, 7], [5, 5]]],
            };
        });
    });

    describe("MrsResourceObject", () => {
        it("contains hypermedia-related properties and data fields of a single resource", () => {
            const resource = {
                _metadata: {
                    etag: "AAA",
                },
                links: [{
                    rel: "self",
                    href: "https://www.example.com/resources/1",
                }],
                name: "foo",
                age: 42,
            };

            expectTypeOf(resource).toMatchTypeOf<MrsResourceObject<{ name: string, age: number }>>();
        });
    });

    describe("IMrsResourceCollectionData", () => {
        it("contains hypermedia-related properties and the list of individual resources in a collection", () => {
            const collection = {
                items: [{
                    _metadata: {
                        etag: "AAA",
                    },
                    links: [{
                        rel: "self",
                        href: "https://www.example.com/resources/1",
                    }],
                    name: "foo",
                    age: 42,
                }],
                hasMore: false,
                count: 1,
                limit: 25,
                offset: 0,
                links: [{
                    rel: "next",
                    href: "https://www.example.com/resources?offset=25",
                }],
            };

            expectTypeOf(collection).toMatchTypeOf<IMrsResourceCollectionData<{ name: string, age: number }>>();
        });
    });
});
