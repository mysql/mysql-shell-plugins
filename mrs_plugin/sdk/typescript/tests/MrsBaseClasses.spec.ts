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

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    IFindManyOptions, IFindUniqueOptions, JsonValue, MrsBaseObjectQuery, MrsBaseSchema, MrsBaseService,
    MrsResourceObject, MrsBaseObjectCreate, IFindFirstOptions, IMrsResourceCollectionData, MrsBaseObjectDelete,
    MrsBaseObjectUpdate, IMrsDeleteResult, IMrsFunctionJsonResponse, MrsBaseObjectFunctionCall,
    IMrsProcedureJsonResponse, MrsBaseObjectProcedureCall, JsonObject,
} from "../MrsBaseClasses";

// fixtures
interface ITableMetadata1 {
    id?: number,
    str?: string,
    num?: number,
    bool?: boolean,
    json?: JsonValue,
    oneToMany?: ITableMetadata2[];
}

interface ITableMetadata2 {
    id?: number,
    str?: string,
    oneToOne?: ITableMetadata3;
}

interface ITableMetadata3 {
    id?: number,
    str?: string;
}

const service: MrsBaseService = new MrsBaseService("/foo");
const schema: MrsBaseSchema = { requestPath: "/bar", service };

const createFetchMock = (response: string = "{}") => {
    vi.stubGlobal("fetch", vi.fn(() => {
        return Promise.resolve({
            ok: true,
            json: (): JsonValue => {
                return JSON.parse(response) as JsonValue;
            },
        });
    }));
};

describe("MRS SDK API", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("when retrieving resources", () => {
        it("selects fields to include in the result set using the field names", async () => {
            const options: IFindManyOptions<ITableMetadata1, unknown, unknown> = {
                select: ["str", "json", "oneToMany.oneToOne.str"],
            };

            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ f: "str,json,oneToMany.oneToOne.str" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("selects fields to include in the result set using a field mapper", async () => {
            const options: IFindManyOptions<ITableMetadata1, unknown, unknown> = {
                select: {
                    str: true,
                    json: true,
                    oneToMany: {
                        oneToOne: {
                            str: true,
                        },
                    },
                },
            };

            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ f: "str,json,oneToMany.oneToOne.str" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("selects fields to exclude from the result set using a field mapper", async () => {
            const options: IFindManyOptions<ITableMetadata1, unknown, unknown> = {
                select: {
                    id: false,
                    json: false,
                    oneToMany: {
                        id: false,
                        oneToOne: {
                            id: false,
                        },
                    },
                },
            };

            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ f: "!id,!json,!oneToMany.id,!oneToMany.oneToOne.id" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("sets the order of the records in the result set based on a given field using a literal order keyword",
                async () => {
            const options: IFindFirstOptions<ITableMetadata1, unknown, unknown> = { orderBy: { num: "DESC" } };
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"$orderby":{"num":"DESC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("sets the order of the records in the result set based on a given field using a numeric order identifier",
                async () => {
            const options: IFindFirstOptions<ITableMetadata1, unknown, unknown> = { orderBy: { num: -1 } };
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"$orderby":{"num":-1}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("filters items where a field is implicitly equal to a given value", async () => {
            const options: IFindUniqueOptions<unknown, ITableMetadata1> = { where: { id: 1 } };
            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":1}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("filters items where a field explicitly matches a given value", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1, unknown> = {
                where: {
                    str: {
                        $like: "%foo%",
                    },
                },
            };

            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"str":{"$like":"%foo%"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("limits the number of items to include in the result set", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1, unknown> = { take: 2 };
            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?limit=2", expect.anything());
        });

        it("limits the number of items to include in the result set where a field matches a given value", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1, unknown> = {
                take: 2,
                where: {
                    id: {
                        $gt: 10,
                    },
                },
            };

            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10}}', limit: "2" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("skips a number of items to not include in the result set", async () => {
            const options: IFindManyOptions<unknown, unknown, unknown> = { skip: 2 };
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?offset=2", expect.anything());
        });

        it("skips a number of items to not include in the result set where a field matches a given value", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1, unknown> = {
                skip: 2,
                where: {
                    bool: true,
                },
            };

            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"bool":true}', offset: "2" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("filters items where a field is NULL", async () => {
            const options: IFindManyOptions<unknown, { maybe: number | null }, unknown> = {
                where: {
                    maybe: null,
                },
            };

            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"maybe":{"$null":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("filters items where a field is not NULL", async () => {
            const options: IFindManyOptions<unknown, { maybe: number | null }, unknown> = {
                where: {
                    maybe: {
                        not: null,
                    },
                },
            };

            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"maybe":{"$notnull":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it(`filters items where a field called "not" is NULL`, async () => {
            const options: IFindManyOptions<unknown, { not: number | null }, unknown> = {
                where: {
                    not: null,
                },
            };

            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"not":{"$null":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it(`filters items where a field called "not" is not NULL`, async () => {
            const options: IFindManyOptions<unknown, { not: number | null }, unknown> = {
                where: {
                    not: {
                        not: null,
                    },
                },
            };

            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"not":{"$notnull":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        beforeEach(() => {
            const collectionResponse: IMrsResourceCollectionData<ITableMetadata1> = {
                count: 2,
                hasMore: false,
                limit: 25,
                offset: 0,
                items: [{
                    id: 1,
                    str: "qux",
                    _metadata: {
                        etag: "XYZ",
                    },
                    links: [{
                        href: "http://localhost:8444/foo/bar/baz/1",
                        rel: "self",
                    }],
                }, {
                    id: 2,
                    str: "quux",
                    _metadata: {
                        etag: "ZYX",
                    },
                    links: [{
                        href: "http://localhost:8444/foo/bar/baz/2",
                        rel: "self",
                    }],
                }],
                links: [{
                    rel: "self",
                    href: "foo/bar/baz/",
                }, {
                    rel: "next",
                    href: "foo/bar/baz/?offset=25",
                }],
            };

            createFetchMock(JSON.stringify(collectionResponse));
        });

        it("hypermedia options are not part of the JSON representation of an application resource instance",
                async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(JSON.stringify(collection)).toEqual('[{"id":1,"str":"qux"},{"id":2,"str":"quux"}]');

            const resource = await query.fetchOne();

            expect(JSON.stringify(resource)).toEqual('{"id":1,"str":"qux"}');
        });

        it("hypermedia options are not enumerable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(Object.keys(collection)).toEqual([]);

            const resource = await query.fetchOne() || {};

            expect(Object.keys(resource)).toEqual(["id", "str"]);
        });

        it("hypermedia options are not iterable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect("count" in collection).toBeFalsy();
            expect("hasMore" in collection).toBeFalsy();
            expect("items" in collection).toBeFalsy();
            expect("limit" in collection).toBeFalsy();
            expect("links" in collection).toBeFalsy();
            expect("offset" in collection).toBeFalsy();

            const resource = await query.fetchOne() as MrsResourceObject<ITableMetadata1>;

            expect("_metadata" in resource).toBeFalsy();
            expect("links" in resource).toBeFalsy();
        });

        it("hypermedia options are not writable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(() => { collection.count = 0; }).toThrowError('The "count" property cannot be changed.');
            expect(() => { collection.hasMore = true; }).toThrowError('The "hasMore" property cannot be changed.');
            expect(() => { collection.limit = 0; }).toThrowError('The "limit" property cannot be changed.');
            expect(() => { collection.offset = 1; }).toThrowError('The "offset" property cannot be changed.');
            expect(() => { collection.links = []; }).toThrowError('The "links" property cannot be changed.');

            const resource = await query.fetchOne() as MrsResourceObject<ITableMetadata1>;
            // eslint-disable-next-line no-underscore-dangle
            expect(() => { resource._metadata = { etag: "AAA" }; })
                .toThrowError('The "_metadata" property cannot be changed');
            expect(() => { resource.links = []; }).toThrowError('The "links" property cannot be changed');
        });

        it("hypermedia options are not removable from an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch() as Omit<IMrsResourceCollectionData<ITableMetadata1>,
                "count" | "hasMore" | "limit" | "offset" | "links">;

            expect(() => { delete collection.count; }).toThrowError('The "count" property cannot be deleted.');
            expect(() => { delete collection.hasMore; }).toThrowError('The "hasMore" property cannot be deleted.');
            expect(() => { delete collection.limit; }).toThrowError('The "limit" property cannot be deleted.');
            expect(() => { delete collection.offset; }).toThrowError('The "offset" property cannot be deleted.');
            expect(() => { delete collection.links; }).toThrowError('The "links" property cannot be deleted.');

            const resource = await query.fetchOne() as Omit<MrsResourceObject<ITableMetadata1>, "_metadata" | "links">;
            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete resource._metadata; }).toThrowError('The "_metadata" property cannot be deleted');
            expect(() => { delete resource.links; }).toThrowError('The "links" property cannot be deleted');
        });

        it("hypermedia and database object fields are directly accessible in an application resource instance",
                async () => {
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(collection.items).toHaveLength(2);
            expect(collection.items[0].id).toEqual(1);
            expect(collection.items[0].str).toEqual("qux");
            expect(collection.items[1].id).toEqual(2);
            expect(collection.items[1].str).toEqual("quux");
            expect(collection.count).toBeDefined();
            expect(collection.hasMore).toBeDefined();
            expect(collection.limit).toBeDefined();
            expect(collection.links).toBeDefined();

            const resource = await query.fetchOne() as MrsResourceObject<ITableMetadata1>;

            expect(resource.id).toEqual(1);
            expect(resource.str).toEqual("qux");
            // eslint-disable-next-line no-underscore-dangle
            expect(resource._metadata).toBeDefined();
            expect(resource.links).toBeDefined();
        });

        it("creates a query filter that includes the cursor in the absence of one", async () => {
            type Filterable = Pick<ITableMetadata1, "str">;
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, Iterable>(
                    schema, "/baz", { cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("includes the cursor in a query filter that does not include it", async () => {
            type Filterable = Pick<ITableMetadata1, "str">;
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, Iterable>(
                    schema, "/baz", { where: { str: "foo" }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"str":"foo","id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("overrides the cursor in a query filter that includes it", async () => {
            type Filterable = Pick<ITableMetadata1, "id" | "str">;
            type Iterable = Pick<ITableMetadata1, "id">;

            // implicit query filter
            let query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, Iterable>(
                    schema, "/baz", { where: { id: 5 }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenNthCalledWith(1, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());

            // explicit query filter
            query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, Iterable>(
                schema, "/baz", { where: { id: { $gt: 5 } }, cursor: { id: 10 } });

            await query.fetch();

            searchParams.set("q", '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}');
            expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("ignores any offset in the presence of a cursor", async () => {
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown, Iterable>(
                schema, "/baz", { skip: 20, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("overrides the sort order of a cursor field", async () => {
            type Iterable = Pick<ITableMetadata1, "id">;
            type Filterable = Pick<ITableMetadata1, "id" | "str">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, Iterable>(
                schema, "/baz", { orderBy: { id: "DESC" }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"$orderby":{"id":"ASC"},"id":{"$gt":10}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("accounts for multiple cursors", async () => {
            type Iterable = Pick<ITableMetadata1, "id" | "num">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown, Iterable>(
                schema, "/baz", { cursor: { id: 10, num: 20 } });

            await query.fetch();

            const searchParams = new URLSearchParams({
                q: '{"id":{"$gt":10},"$orderby":{"id":"ASC","num":"ASC"},"num":{"$gt":20}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });
    });

    describe("when creating a resource", () => {
        beforeEach(() => {
            const singleResourceResponse: MrsResourceObject<ITableMetadata1> = {
                id: 1,
                str: "qux",
                _metadata: {
                    etag: "XYZ",
                },
                links: [{
                    href: "http://localhost:8444/foo/bar/baz/1",
                    rel: "self",
                }],
            };

            createFetchMock(JSON.stringify(singleResourceResponse));
        });

        it("encodes the resource as a JSON string in the request body", async () => {
            const data = { id: 1, str: "qux" };
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data });
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith("/foo/bar/baz", expect.objectContaining({
                method: "POST",
                body: JSON.stringify(data),
            }));
        });

        it("hypermedia properties are not part of the JSON representation of an application resource instance",
                async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect(JSON.stringify(res)).toEqual('{"id":1,"str":"qux"}');
        });

        it("hypermedia properties are not enumerable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect(Object.keys(res)).toEqual(["id", "str"]);
        });

        it("hypermedia properties are not iterable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect("_metadata" in res).toBeFalsy();
            expect("links" in res).toBeFalsy();
        });

        it("hypermedia properties are not writable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { res._metadata = { etag: "ZYX" }; })
                .toThrowError('The "_metadata" property cannot be changed.');
            expect(() => { res.links = []; }).toThrowError('The "links" property cannot be changed.');
        });

        it("hypermedia properties are not removable from an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch() as Omit<MrsResourceObject<ITableMetadata1>, "_metadata" | "links">;

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete res._metadata; }).toThrowError('The "_metadata" property cannot be deleted.');
            expect(() => { delete res.links; }).toThrowError('The "links" property cannot be deleted.');
        });

        it("hypermedia and database object fields are directly accessible in an application resource instance",
                async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect(res.id).toEqual(1);
            expect(res.str).toEqual("qux");
            // eslint-disable-next-line no-underscore-dangle
            expect(res._metadata).toBeDefined();
            expect(res.links).toBeDefined();
        });

        describe("when the server does not send back a GTID", () => {
            beforeEach(async () => {
                const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: {
                    str: "qux" }});
                await query.fetch();
            });

            it("subsequent GET requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });

        describe("when the server sends back a GTID", () => {
            beforeEach(async () => {
                const response: MrsResourceObject<ITableMetadata1> = {
                    id: 1,
                    str: "qux",
                    _metadata: {
                        etag: "XYZ",
                        gtid: "ABC",
                    },
                    links: [{
                        href: "http://localhost:8444/foo/bar/baz/1",
                        rel: "self",
                    }],
                };

                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: {
                    str: "qux" }});
                await query.fetch();
            });

            it("subsequent GET requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent GET requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });
    });

    describe("when updating a resource", () => {
        beforeEach(() => {
            const response: MrsResourceObject<ITableMetadata1> = {
                id: 1,
                str: "qux",
                _metadata: {
                    etag: "XYZ",
                },
                links: [{
                    href: "http://localhost:8444/foo/bar/baz/1",
                    rel: "self",
                }],
            };

            createFetchMock(JSON.stringify(response));
        });

        it("hypermedia properties are not part of the JSON representation of an application resource instance",
                async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect(JSON.stringify(res)).toEqual('{"id":1,"str":"qux"}');
        });

        it("hypermedia properties are not enumerable in an application resource instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect(Object.keys(res)).toEqual(["id", "str"]);
        });

        it("hypermedia properties are not iterable in an application resource instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect("_metadata" in res).toBeFalsy();
            expect("links" in res).toBeFalsy();
        });

        it("hypermedia properties are not writable in an application resource instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { res._metadata = { etag: "ZYX" }; })
                .toThrowError('The "_metadata" property cannot be changed.');
            expect(() => { res.links = []; }).toThrowError('The "links" property cannot be changed.');
        });

        it("hypermedia properties are not removable from an application resource instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch() as Omit<MrsResourceObject<ITableMetadata1>, "_metadata" | "links">;

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete res._metadata; }).toThrowError('The "_metadata" property cannot be deleted.');
            expect(() => { delete res.links; }).toThrowError('The "links" property cannot be deleted.');
        });

        it("hypermedia and database object fields are directly accessible in an application resource instance",
                async () => {
                    const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                        { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect(res.id).toEqual(1);
            expect(res.str).toEqual("qux");
            // eslint-disable-next-line no-underscore-dangle
            expect(res._metadata).toBeDefined();
            expect(res.links).toBeDefined();
        });

        describe("when the server does not send back a GTID", () => {
            beforeEach(async () => {
                const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                    data: { id:1, str: "qux" } }, ["id"]);
                await query.fetch();
            });

            it("subsequent GET requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });

        describe("when the server sends back a GTID", () => {
            beforeEach(async () => {
                const response: MrsResourceObject<ITableMetadata1> = {
                    id: 1,
                    str: "qux",
                    _metadata: {
                        etag: "XYZ",
                        gtid: "ABC",
                    },
                    links: [{
                        href: "http://localhost:8444/foo/bar/baz/1",
                        rel: "self",
                    }],
                };

                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                    data: { id:1, str: "qux" } }, ["id"]);
                await query.fetch();
            });

            it("subsequent GET requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent GET requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });
    });

    describe("when deleting resources", () => {
        it("removes all records where a given field is NULL", async () => {
            const query = new MrsBaseObjectDelete<{ maybe: number | null }>(schema, "/baz", { where: { maybe: null }});
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"maybe":{"$null":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.objectContaining({
                method: "DELETE",
            }));
        });

        it("removes all records where a given field is not NULL", async () => {
            const query = new MrsBaseObjectDelete<{ maybe: number | null }>(schema, "/baz", { where: { maybe: {
                not: null }}});
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"maybe":{"$notnull":null}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.objectContaining({
                method: "DELETE",
            }));
        });

        describe("when the server does not send back a GTID", () => {
            beforeEach(async () => {
                createFetchMock();

                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 }});
                await query.fetch();
            });

            it("subsequent GET requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });

        describe("when the server sends back a GTID", () => {
            beforeEach(async () => {
                const response: IMrsDeleteResult = {
                    itemsDeleted: 1,
                    _metadata: {
                        gtid: "ABC",
                    },
                };

                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 }});
                await query.fetch();
            });

            it("subsequent GET requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent GET requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: false });
                    await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });
    });

    describe("when calling a function", () => {
        describe("transactional metadata", () => {
            beforeEach(() => {
                const response: IMrsFunctionJsonResponse<string> = { result: "foo", _metadata: { gtid: "bar" } };
                createFetchMock(JSON.stringify(response));
            });

            it("are not part of the JSON representation of the function result",
                async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();

                expect(JSON.stringify(result)).toEqual('{"result":"foo"}');
            });

            it("are not enumerable in the function result", async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();

                expect(Object.keys(result)).toEqual(["result"]);
            });

            it("are not iterable in the function result", async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();

                expect("_metadata" in result).toBeFalsy();
            });

            it("are not writable in the function result", async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { result._metadata = { gtid: "qux" }; })
                    .toThrowError('The "_metadata" property cannot be changed.');
            });

            it("are not removable from the function result", async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { delete result._metadata; }).toThrowError('The "_metadata" property cannot be deleted.');
            });

            it("are directly accessible in the function result",
                    async () => {
                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(result._metadata?.gtid).toEqual("bar");
            });
        });

        describe("if the server does not send back a GTID", () => {
            beforeEach(async () => {
                const response: IMrsFunctionJsonResponse<string> = { result: "foo" };
                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                await query.fetch();
            });

            it("subsequent GET requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });

        describe("if the server sends back a GTID", () => {
            beforeEach(async () => {
                const response: IMrsFunctionJsonResponse<string> = {
                    result: "foo",
                    _metadata: {
                        gtid: "ABC",
                    },
                };

                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", { name: "foo" });
                await query.fetch();
            });

            it("subsequent GET requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent GET requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: false });
                    await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });
    });

    describe("when calling a procedure", () => {
        describe("transactional and column metadata", () => {
            beforeEach(() => {
                const response: IMrsProcedureJsonResponse<{ name: string }, {}> = {
                    resultSets: [{
                        type: "IMrsProcedureResultSet1",
                        items: [{
                            name: "foobar",
                        }],
                        _metadata: {
                            columns: [{
                                name: "qux",
                                type: "VARCHAR(3)",
                            }],
                        },
                    }],
                    _metadata: {
                        gtid: "baz",
                    },
                };
                createFetchMock(JSON.stringify(response));
            });

            it("are not part of the JSON representation of the function result",
                async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();

                expect(JSON.stringify(result))
                    .toEqual('{"resultSets":[{"type":"IMrsProcedureResultSet1","items":[{"name":"foobar"}]}]}');
            });

            it("are not enumerable in the function result", async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();

                expect(Object.keys(result)).toEqual(["resultSets"]);
                expect(Object.keys(result.resultSets[0])).toEqual(["type", "items"]);
            });

            it("are not iterable in the function result", async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();

                expect("_metadata" in result).toBeFalsy();
                expect("_metadata" in result.resultSets[0]).toBeFalsy();
            });

            it("are not writable in the function result", async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { result._metadata = { gtid: "qux" }; })
                    .toThrowError('The "_metadata" property cannot be changed.');
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { result.resultSets[0]._metadata = { gtid: "qux" }; })
                    .toThrowError('The "_metadata" property cannot be changed.');
            });

            it("are not removable from the function result", async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { delete result._metadata; })
                    .toThrowError('The "_metadata" property cannot be deleted.');
                // eslint-disable-next-line no-underscore-dangle
                expect(() => { delete result.resultSets[0]._metadata; })
                    .toThrowError('The "_metadata" property cannot be deleted.');
            });

            it("are directly accessible in the function result",
                    async () => {
                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                const result = await query.fetch();
                // eslint-disable-next-line no-underscore-dangle
                expect(result._metadata?.gtid).toEqual("baz");
                // eslint-disable-next-line no-underscore-dangle
                expect(result.resultSets[0]._metadata).toBeTypeOf("object");
                // eslint-disable-next-line no-underscore-dangle
                expect(result.resultSets[0]._metadata).toHaveProperty("columns", [{name: "qux", type: "VARCHAR(3)"}]);
            });
        });

        describe("if the server does not send back a GTID", () => {
            beforeEach(async () => {
                const response: IMrsProcedureJsonResponse<{ name: string }, {}> = {
                    outParams: {
                        name: "foobar",
                    },
                    resultSets: [],
                };
                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                await query.fetch();
            });

            it("subsequent GET requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the $asof operator if the application wants read consistency",
                    async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });

        describe("if the server sends back a GTID", () => {
            beforeEach(async () => {
                const response: IMrsProcedureJsonResponse<{ name: string }, {}> = {
                    outParams: {
                        name: "foobar",
                    },
                    resultSets: [],
                    _metadata: {
                        gtid: "ABC",
                    },
                };
                createFetchMock(JSON.stringify(response));

                const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, { name: string },
                    JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                await query.fetch();
            });

            it("subsequent GET requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent GET requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 }, readOwnWrites: false });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests include the GTID if the application wants read consistency", async () => {
                const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: true });
                await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1,"$asof":"ABC"}' });
                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });

            it("subsequent DELETE requests do not include the GTID if the application does not want read consistency",
                    async () => {
                let query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                await query.fetch();

                query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 },
                    readOwnWrites: false });
                    await query.fetch();

                const searchParams = new URLSearchParams({ q: '{"id":1}' });
                // first call is on beforeEach
                expect(fetch).toHaveBeenNthCalledWith(2, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
                expect(fetch).toHaveBeenNthCalledWith(3, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());
            });
        });
    });
});
