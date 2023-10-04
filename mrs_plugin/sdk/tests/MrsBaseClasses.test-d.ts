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
    IFindUniqueOptions, IFindAllOptions, IMrsResultList, MaybeNull, Point, MultiPoint, LineString, MultiLineString,
    Polygon,
    MultiPolygon,
    Geometry,
    GeometryCollection,
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
});
