/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    IFindManyOptions, IFindUniqueOptions, JsonValue, MrsBaseObjectQuery, MrsBaseSchema, MrsBaseService,
    MrsDownstreamDocumentData, MrsBaseObjectCreate, IFindFirstOptions, MrsDownstreamDocumentListData,
    MrsBaseObjectDelete, MrsBaseObjectUpdate, IMrsDeleteResult, IMrsFunctionJsonResponse, MrsBaseObjectFunctionCall,
    IMrsProcedureJsonResponse, MrsBaseObjectProcedureCall, JsonObject, MrsAuthenticate, MrsBaseObject,
    MrsBaseTaskStart, MrsBaseTaskWatch, MrsTask, MrsBaseTaskRun,
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
const schema: MrsBaseSchema = new MrsBaseSchema(service, "/bar");

interface IFetchMockCall {
    matchBody?: string;
    matchUrl?: string;
    response: string;
    statusCode: number;
}

class FetchMock {
    private static singleton: FetchMock;
    #calls: IFetchMockCall[] = [];

    private constructor() {

    }

    public static push({
        matchBody,
        matchUrl,
        response = "{}",
        statusCode = 200,
    }: {
        matchBody?: string,
        matchUrl?: string,
        response?: string,
        statusCode?: number,
    } = {
        response: "{}",
        statusCode: 200,
    }) {
        if (FetchMock.singleton !== undefined) {
            FetchMock.singleton.#calls.push({ matchBody, matchUrl, response, statusCode });

            return this;
        }

        FetchMock.singleton = new FetchMock();
        FetchMock.singleton.#calls.push({ matchBody, matchUrl, response, statusCode });

        vi.stubGlobal("fetch", vi.fn((url: string, { body }: { body: string }) => {
            const call = FetchMock.singleton.#calls.pop() ?? { response: "{}", statusCode: 200 };
            const { matchBody, matchUrl } = call;
            if ((matchUrl !== undefined && matchUrl !== url) || (matchBody !== undefined && matchBody !== body)) {
                // in the end, this just means it is a Bad Request
                return Promise.resolve(new Response(null, { status: 400 }));
            }

            const { response, statusCode } = call;
            const type = "application/json";

            return Promise.resolve(new Response(new Blob([response], { type }), { status: statusCode }));
        }));

        return this;
    }

    public static clear () {
        if (FetchMock.singleton !== undefined && FetchMock.singleton.#calls.length > 0) {
            FetchMock.singleton.#calls = [];
        }
    }
}

describe("MRS SDK API", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        FetchMock.clear();
    });

    describe("when authenticating a user", () => {
        const username = "user";
        const password = "pwd";
        const authApp = "foobar";
        const vendorId = "0x31000000000000000000000000000000";

        beforeEach(() => {
            FetchMock
                .push({ matchUrl: "/foo/authentication/login" })
                .push({
                    matchUrl: "/foo/authentication/authApps",
                    response: JSON.stringify([{ name: authApp, vendorId }]),
                });
        });

        describe("and providing a vendor id", () => {
            it("no further vendor id lookup happens", async () => {
                const query = new MrsAuthenticate(service, authApp, username, password, vendorId);

                await query.submit();
                expect(fetch).toHaveBeenCalledOnce();
                expect(fetch).toHaveBeenNthCalledWith(1, "/foo/authentication/login", expect.anything());
            });
        });

        describe("and not providing a vendor id", () => {
            it("vendor id lookup finishes successfully", async () => {
                const query = new MrsAuthenticate(service, authApp, username, password);

                await query.submit();
                expect(fetch).toHaveBeenCalledTimes(2);
                expect(fetch).toHaveBeenNthCalledWith(1, "/foo/authentication/authApps", expect.anything());
                expect(fetch).toHaveBeenLastCalledWith("/foo/authentication/login", expect.anything());
            });

            it("command throws an authentication error", async () => {
                const query = new MrsAuthenticate(service, "<nonexisting>", username, password);

                await expect(async () => { await query.submit(); }).rejects
                    .toThrowError("Authentication failed. The authentication app does not exist.");
            });
        });
    });

    describe("when deauthenticating a user", () => {
        const accessToken = "ABC";

        beforeEach(() => {
            FetchMock.push();
        });

        it("fails if there is no user that is currently authenticated", async () => {
            await expect(async () => { await service.deauthenticate(); }).rejects
                .toThrowError("No user is currently authenticated.");
        });

        it("includes the appropriate access token in the request", async () => {
            service.session.accessToken = accessToken;

            await service.deauthenticate();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith("/foo/authentication/logout", expect.objectContaining({
                method: "POST",
                headers: {
                    // eslint-disable-next-line
                    "Authorization": `Bearer ${accessToken}`
                },
            }));
        });

        it("resets the existing session state", async () => {
            service.session.accessToken = accessToken;

            await service.deauthenticate();

            expect(service.session.accessToken).toBeUndefined();
        });
    });

    describe("when accessing REST objects", () => {
        it("selects fields to include in the result set using the field names", async () => {
            const options: IFindManyOptions<ITableMetadata1, unknown> = {
                select: ["str", "json", "oneToMany.oneToOne.str"],
            };

            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ f: "str,json,oneToMany.oneToOne.str" });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("selects fields to include in the result set using a field mapper", async () => {
            const options: IFindManyOptions<ITableMetadata1, unknown> = {
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
            const options: IFindManyOptions<ITableMetadata1, unknown> = {
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
            const options: IFindFirstOptions<ITableMetadata1, unknown, ["num"]> = { orderBy: { num: "DESC" } };
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options);
            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"$orderby":{"num":"DESC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                expect.anything());
        });

        it("sets the order of the records in the result set based on a given field using a numeric order identifier",
                async () => {
            const options: IFindFirstOptions<ITableMetadata1, unknown, ["num"]> = { orderBy: { num: -1 } };
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
            const options: IFindManyOptions<unknown, ITableMetadata1> = {
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
            const options: IFindManyOptions<unknown, ITableMetadata1> = { take: 2 };
            const query = new MrsBaseObjectQuery<unknown, ITableMetadata1>(schema, "/baz", options);
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?limit=2", expect.anything());
        });

        it("limits the number of items to include in the result set where a field matches a given value", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1> = {
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
            const options: IFindManyOptions<unknown, unknown> = { skip: 2 };
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz", options);
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?offset=2", expect.anything());
        });

        it("skips a number of items to not include in the result set where a field matches a given value", async () => {
            const options: IFindManyOptions<unknown, ITableMetadata1> = {
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
            const options: IFindManyOptions<unknown, { maybe: number | null }> = {
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
            const options: IFindManyOptions<unknown, { maybe: number | null }> = {
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
            const options: IFindManyOptions<unknown, { not: number | null }> = {
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
            const options: IFindManyOptions<unknown, { not: number | null }> = {
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
            const collectionResponse: MrsDownstreamDocumentListData<ITableMetadata1> = {
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
                        href: "http://localhost:8443/foo/bar/baz/1",
                        rel: "self",
                    }],
                }, {
                    id: 2,
                    str: "quux",
                    _metadata: {
                        etag: "ZYX",
                    },
                    links: [{
                        href: "http://localhost:8443/foo/bar/baz/2",
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

            FetchMock
                .push({ response: JSON.stringify(collectionResponse) })
                .push({ response: JSON.stringify(collectionResponse) });
        });

        it("metadata are not part of the JSON representation of an application resource instance",
                async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(JSON.stringify(collection)).toEqual('[{"id":1,"str":"qux"},{"id":2,"str":"quux"}]');

            const resource = await query.fetchOne();

            expect(JSON.stringify(resource)).toEqual('{"id":1,"str":"qux"}');
        });

        it("metadata are not enumerable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(Object.keys(collection)).toEqual([]);

            const resource = await query.fetchOne() || {};

            expect(Object.keys(resource)).toEqual(["id", "str"]);
        });

        it("metadata are not iterable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect("count" in collection).toBeFalsy();
            expect("hasMore" in collection).toBeFalsy();
            expect("items" in collection).toBeFalsy();
            expect("limit" in collection).toBeFalsy();
            expect("links" in collection).toBeFalsy();
            expect("offset" in collection).toBeFalsy();

            const resource = await query.fetchOne() as MrsDownstreamDocumentData<ITableMetadata1>;

            expect("_metadata" in resource).toBeFalsy();
            expect("links" in resource).toBeFalsy();
        });

        it("metadata are not writable in an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
            const collection = await query.fetch();

            expect(() => { collection.count = 0; }).toThrowError('The "count" property cannot be changed.');
            expect(() => { collection.hasMore = true; }).toThrowError('The "hasMore" property cannot be changed.');
            expect(() => { collection.limit = 0; }).toThrowError('The "limit" property cannot be changed.');
            expect(() => { collection.offset = 1; }).toThrowError('The "offset" property cannot be changed.');
            expect(() => { collection.links = []; }).toThrowError('The "links" property cannot be changed.');

            const resource = await query.fetchOne() as MrsDownstreamDocumentData<ITableMetadata1>;
            // eslint-disable-next-line no-underscore-dangle
            expect(() => { resource._metadata = { etag: "AAA" }; })
                .toThrowError('The "_metadata" property cannot be changed');
            expect(() => { resource.links = []; }).toThrowError('The "links" property cannot be changed');
        });

        it("metadata are not removable from an application resource instance", async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
            const collection = await query.fetch() as Omit<MrsDownstreamDocumentListData<ITableMetadata1>,
                "count" | "hasMore" | "limit" | "offset" | "links">;

            expect(() => { delete collection.count; }).toThrowError('The "count" property cannot be deleted.');
            expect(() => { delete collection.hasMore; }).toThrowError('The "hasMore" property cannot be deleted.');
            expect(() => { delete collection.limit; }).toThrowError('The "limit" property cannot be deleted.');
            expect(() => { delete collection.offset; }).toThrowError('The "offset" property cannot be deleted.');
            expect(() => { delete collection.links; }).toThrowError('The "links" property cannot be deleted.');

            const resource = await query.fetchOne() as Omit<MrsDownstreamDocumentData<ITableMetadata1>,
                "_metadata" | "links">;
            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete resource._metadata; }).toThrowError('The "_metadata" property cannot be deleted');
            expect(() => { delete resource.links; }).toThrowError('The "links" property cannot be deleted');
        });

        it("metadata and database object fields are directly accessible in an application resource instance",
                async () => {
            const query = new MrsBaseObjectQuery<unknown, unknown>(schema, "/baz");
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

            const resource = await query.fetchOne() as MrsDownstreamDocumentData<ITableMetadata1>;

            expect(resource.id).toEqual(1);
            expect(resource.str).toEqual("qux");
            // eslint-disable-next-line no-underscore-dangle
            expect(resource._metadata).toBeDefined();
            expect(resource.links).toBeDefined();
        });

        it("creates a query filter that includes the cursor in the absence of one", async () => {
            type Filterable = Pick<ITableMetadata1, "str">;
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, [], Iterable>(
                    schema, "/baz", { cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("includes the cursor in a query filter that does not include it", async () => {
            type Filterable = Pick<ITableMetadata1, "str">;
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, [], Iterable>(
                    schema, "/baz", { where: { str: "foo" }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"str":"foo","id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("overrides the cursor in a query filter that includes it", async () => {
            type Filterable = Pick<ITableMetadata1, "id" | "str">;
            type Iterable = Pick<ITableMetadata1, "id">;

            // implicit query filter
            let query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, [], Iterable>(
                    schema, "/baz", { where: { id: 5 }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenNthCalledWith(1, `/foo/bar/baz?${searchParams.toString()}`, expect.anything());

            // explicit query filter
            query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, [], Iterable>(
                schema, "/baz", { where: { id: { $gt: 5 } }, cursor: { id: 10 } });

            await query.fetch();

            searchParams.set("q", '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}');
            expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("ignores any offset in the presence of a cursor", async () => {
            type Iterable = Pick<ITableMetadata1, "id">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown, [], Iterable>(
                schema, "/baz", { skip: 20, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"id":{"$gt":10},"$orderby":{"id":"ASC"}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("overrides the sort order of a cursor field", async () => {
            type Iterable = Pick<ITableMetadata1, "id">;
            type Filterable = Pick<ITableMetadata1, "id" | "str">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, Filterable, [], Iterable>(
                schema, "/baz", { orderBy: { id: "DESC" }, cursor: { id: 10 } });

            await query.fetch();

            const searchParams = new URLSearchParams({ q: '{"$orderby":{"id":"ASC"},"id":{"$gt":10}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        it("accounts for multiple cursors", async () => {
            type Iterable = Pick<ITableMetadata1, "id" | "num">;
            const query = new MrsBaseObjectQuery<ITableMetadata1, unknown, [], Iterable>(
                schema, "/baz", { cursor: { id: 10, num: 20 } });

            await query.fetch();

            const searchParams = new URLSearchParams({
                q: '{"id":{"$gt":10},"$orderby":{"id":"ASC","num":"ASC"},"num":{"$gt":20}}' });
            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`, expect.anything());
        });

        describe("that require authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push()
                        .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");

                    await query.fetch();

                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                        headers: {
                            // eslint-disable-next-line
                            "Authorization": "Bearer ABC"
                        },
                    }));
                });
            });
        });
    });

    describe("when creating a REST document", () => {
        const response: MrsDownstreamDocumentData<ITableMetadata1> = {
            id: 1,
            str: "qux",
            _metadata: {
                etag: "XYZ",
            },
            links: [{
                href: "http://localhost:8443/foo/bar/baz/1",
                rel: "self",
            }],
        };

        beforeEach(() => {
            FetchMock.push({ response: JSON.stringify(response) });
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

        it("metadata are not part of the JSON representation of an application resource instance",
                async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect(JSON.stringify(res)).toEqual('{"id":1,"str":"qux"}');
        });

        it("metadata are not enumerable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect(Object.keys(res)).toEqual(["id", "str"]);
        });

        it("metadata are not iterable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            expect("_metadata" in res).toBeFalsy();
            expect("links" in res).toBeFalsy();
        });

        it("metadata are not writable in an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch();

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { res._metadata = { etag: "ZYX" }; })
                .toThrowError('The "_metadata" property cannot be changed.');
            expect(() => { res.links = []; }).toThrowError('The "links" property cannot be changed.');
        });

        it("metadata are not removable from an application resource instance", async () => {
            const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: { id: 1,
                str: "qux" } });
            const res = await query.fetch() as Omit<MrsDownstreamDocumentData<ITableMetadata1>, "_metadata" | "links">;

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete res._metadata; }).toThrowError('The "_metadata" property cannot be deleted.');
            expect(() => { delete res.links; }).toThrowError('The "links" property cannot be deleted.');
        });

        it("metadata and database object fields are directly accessible in an application resource instance",
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
                const response: MrsDownstreamDocumentData<ITableMetadata1> = {
                    id: 1,
                    str: "qux",
                    _metadata: {
                        etag: "XYZ",
                        gtid: "ABC",
                    },
                    links: [{
                        href: "http://localhost:8443/foo/bar/baz/1",
                        rel: "self",
                    }],
                };

                FetchMock.push({ response: JSON.stringify(response) });

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

        describe("in a REST object that requires authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push({ response: JSON.stringify(response) })
                        .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const query = new MrsBaseObjectCreate<ITableMetadata1, unknown>(schema, "/baz", { data: {
                        str: "foobar" } });
                    await query.fetch();

                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                        headers: {
                            // eslint-disable-next-line
                            "Authorization": "Bearer ABC"
                        },
                    }));
                });
            });
        });
    });

    describe("when updating a REST document", () => {
        const response: MrsDownstreamDocumentData<ITableMetadata1> = {
            id: 1,
            str: "qux",
            _metadata: {
                etag: "XYZ",
            },
            links: [{
                href: "http://localhost:8443/foo/bar/baz/1",
                rel: "self",
            }],
        };

        beforeEach(() => {
            FetchMock.push({ response: JSON.stringify(response) });
        });

        it("metadata are not part of the JSON representation of an application document instance",
                async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect(JSON.stringify(res)).toEqual('{"id":1,"str":"qux"}');
        });

        it("metadata are not enumerable in an application document instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect(Object.keys(res)).toEqual(["id", "str"]);
        });

        it("metadata are not iterable in an application document instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            expect("_metadata" in res).toBeFalsy();
            expect("links" in res).toBeFalsy();
        });

        it("metadata are not writable in an application document instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch();

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { res._metadata = { etag: "ZYX" }; })
                .toThrowError('The "_metadata" property cannot be changed.');
            expect(() => { res.links = []; }).toThrowError('The "links" property cannot be changed.');
        });

        it("metadata are not removable from an application document instance", async () => {
            const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz",
                { data: { id: 1, str: "qux" } }, ["id"]);
            const res = await query.fetch() as Omit<MrsDownstreamDocumentData<ITableMetadata1>, "_metadata" | "links">;

            // eslint-disable-next-line no-underscore-dangle
            expect(() => { delete res._metadata; }).toThrowError('The "_metadata" property cannot be deleted.');
            expect(() => { delete res.links; }).toThrowError('The "links" property cannot be deleted.');
        });

        it("metadata and database object fields are directly accessible in an application document instance",
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

        describe("and the document contains an etag", () => {
            beforeEach(() => {
                const response: MrsDownstreamDocumentListData<ITableMetadata1> = {
                    items: [{
                        id: 1,
                        str: "qux",
                        _metadata: {
                            etag: "XYZ",
                        },
                        links: [],
                    }],
                    count: 25,
                    hasMore: false,
                    offset: 0,
                    limit: 25,
                    links: [],
                };

                FetchMock.push({ response: JSON.stringify(response) });
            });

            it("includes the etag in subsequent updates to avoid mid-air collisions", async () => {
                const readQuery = new MrsBaseObjectQuery<ITableMetadata1, Pick<ITableMetadata1, "id">>(
                    schema, "/baz", { where: { id: 1 } });
                const doc = await readQuery.fetchOne();

                const updateQuery = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                    data: doc as ITableMetadata1 }, ["id"]);
                await updateQuery.fetch();

                expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz/${doc?.id}`, expect.objectContaining({
                    method: "PUT",
                    // eslint-disable-next-line no-underscore-dangle
                    body: JSON.stringify({ id: doc?.id, str: doc?.str, _metadata: doc?._metadata }),
                }));
            });
        });

        describe("when the server does not send back a GTID", () => {
            beforeEach(async () => {
                const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                    data: { id: 1, str: "qux" } }, ["id"]);
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
                const response: MrsDownstreamDocumentData<ITableMetadata1> = {
                    id: 1,
                    str: "qux",
                    _metadata: {
                        etag: "XYZ",
                        gtid: "ABC",
                    },
                    links: [{
                        href: "http://localhost:8443/foo/bar/baz/1",
                        rel: "self",
                    }],
                };

                FetchMock.push({ response: JSON.stringify(response) });

                const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                    data: { id: 1, str: "qux" } }, ["id"]);
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

        describe("of a REST object that requires authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push({ response: JSON.stringify(response) })
                        .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const data: ITableMetadata1 = { id: 1, str: "qux" };
                    const query = new MrsBaseObjectUpdate<ITableMetadata1, ["id"], unknown>(schema, "/baz", {
                        data }, ["id"]);
                    await query.fetch();

                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz/${data.id}`, expect.objectContaining({
                        body: JSON.stringify(data),
                        headers: {
                            // eslint-disable-next-line
                            "Authorization": "Bearer ABC",
                        },
                    }));
                });
            });
        });
    });

    describe("when deleting REST documents", () => {
        beforeEach(() => {
            FetchMock.push();
        });

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

                FetchMock.push({ response: JSON.stringify(response) });

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

        describe("of a REST object that requires authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push()
                            .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const query = new MrsBaseObjectDelete<ITableMetadata1>(schema, "/baz", { where: { id: 1 } });
                    await query.fetch();

                    const searchParams = new URLSearchParams({ q: '{"id":1}' });
                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz?${searchParams.toString()}`,
                        expect.objectContaining({
                            headers: {
                                // eslint-disable-next-line
                                "Authorization": "Bearer ABC",
                            },
                        }));
                });
            });
        });
    });

    describe("when calling a REST function", () => {
        beforeEach(() => {
            FetchMock.push();
        });

        it("sets the appropriate input parameters", async () => {
            interface IInputParameters { name: string }
            const args: IInputParameters = { name: "foobar" };
            const query = new MrsBaseObjectFunctionCall<IInputParameters, string>(schema, "/baz", args);
            await query.fetch();

            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                method: "POST",
                body: JSON.stringify(args),
            }));
        });

        describe("transactional metadata", () => {
            beforeEach(() => {
                const response: IMrsFunctionJsonResponse<string> = { result: "foo", _metadata: { gtid: "bar" } };
                FetchMock.push({ response: JSON.stringify(response) });
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
                FetchMock.push({ response: JSON.stringify(response) });

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

                FetchMock.push({ response: JSON.stringify(response) });

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

        describe("that requires authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push()
                        .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const query = new MrsBaseObjectFunctionCall<{ name: string }, string>(schema, "/baz", {
                        name: "foo" });
                    await query.fetch();

                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                        headers: {
                            // eslint-disable-next-line
                            "Authorization": "Bearer ABC",
                        },
                    }));
                });
            });
        });
    });

    describe("when calling a REST procedure", () => {
        const response: IMrsProcedureJsonResponse<unknown, unknown> = {
            resultSets: [],
        };

        beforeEach(() => {
            FetchMock.push({ response: JSON.stringify(response) });
        });

        it("sets the appropriate input parameters", async () => {
            interface IInputParameters { firstName: string, lastName: string }
            const args: IInputParameters = { firstName: "foo", lastName: "bar" };
            const query = new MrsBaseObjectProcedureCall<IInputParameters, { name: string },
                JsonObject>(schema, "/baz", args);

            await query.fetch();

            expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                method: "POST",
                body: JSON.stringify(args),
            }));
        });

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

                FetchMock.push({ response: JSON.stringify(response) });
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
                    resultSets: [],
                    _metadata: {
                        gtid: "ABC",
                    },
                };

                FetchMock.push({ response: JSON.stringify(response)} );

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

        describe("that requires authentication", () => {
            const username = "qux";
            const password = "quux";
            const authApp = "corge";

            describe("after authenticating using a MySQL Internal auth app", () => {
                const vendorId = "0x31000000000000000000000000000000";

                beforeEach(async () => {
                    FetchMock
                        .push({ response: JSON.stringify(response) })
                        .push({
                            matchUrl: "/foo/authentication/login",
                            matchBody: JSON.stringify({ username, password, authApp, sessionType: "bearer" }),
                            response: JSON.stringify({ accessToken: "ABC" }),
                        });

                    const request = new MrsAuthenticate(schema.service, authApp, username, password, vendorId);
                    await request.submit();
                });

                it("includes the appropriate access token in the request", async () => {
                    const query = new MrsBaseObjectProcedureCall<{ firstName: string, lastName: string }, {
                        name: string }, JsonObject>(schema, "/baz", { firstName: "foo", lastName: "bar" });
                    await query.fetch();

                    expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz`, expect.objectContaining({
                        headers: {
                            // eslint-disable-next-line
                            "Authorization": "Bearer ABC",
                        },
                    }));
                });
            });
        });
    });

    describe("when retrieving custom resource metadata", () => {
        const metadata = { name: "foobar" };

        describe("for a REST service", () => {
            beforeEach(() => {
                FetchMock.push({
                    matchUrl: "/foo/_metadata",
                    response: JSON.stringify(metadata),
                });
            });

            it("returns a plain JavaScript object with the metadata", async () => {
                expect(await service.getMetadata()).to.deep.equal(metadata);
            });
        });

        describe("for a REST schema", () => {
            describe("that requires authentication", () => {
                describe("and the client is authenticated", () => {
                    beforeEach(async () => {
                        FetchMock
                            .push({ matchUrl: "/foo/bar/_metadata", response: JSON.stringify(metadata) })
                            .push({
                                matchUrl: "/foo/authentication/login",
                                response: JSON.stringify({ accessToken: "ABC" }),
                            });

                        // specify a valid vendor id to avoid the additional round-trip to retrieve auth apps
                        const request = new MrsAuthenticate(schema.service, "qux", "quux", "biz",
                            "0x31000000000000000000000000000000");
                        await request.submit();
                    });

                    it("includes the appropriate access token in the request", async () => {
                        await schema.getMetadata();

                        expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/_metadata`, expect.objectContaining({
                            headers: {
                                // eslint-disable-next-line
                                "Authorization": "Bearer ABC",
                            },
                        }));
                    });

                    it("returns a plain JavaScript object with the metadata", async () => {
                        expect(await schema.getMetadata()).to.deep.equal(metadata);
                    });
                });

                describe("and the client is not authenticated", () => {
                    beforeEach(() => {
                        FetchMock.push({ matchUrl: "/foo/bar/_metadata", statusCode: 401 });
                    });

                    it("yields an authentication error", async () => {
                        await expect(async () => { await schema.getMetadata(); }).rejects.toThrowError(
                            "Not authenticated. Please authenticate first before accessing the path " +
                            "/foo/bar/_metadata.");
                    });
                });
            });

            describe("that does not require authentication", () => {
                beforeEach(() => {
                    FetchMock.push({ matchUrl: "/foo/bar/_metadata", response: JSON.stringify(metadata) });
                });

                it("returns a plain JavaScript object with the metadata", async () => {
                    expect(await schema.getMetadata()).to.deep.equal(metadata);
                });
            });
        });

        describe("for a REST object", () => {
            const restObject = new MrsBaseObject(schema, "/baz");

            describe("that requires authentication", () => {
                describe("and the client is authenticated", () => {
                    beforeEach(async () => {
                        FetchMock
                            .push({ matchUrl: "/foo/bar/baz/_metadata", response: JSON.stringify(metadata) })
                            .push({
                                matchUrl: "/foo/authentication/login",
                                response: JSON.stringify({ accessToken: "ABC" }),
                            });

                        // specify a valid vendor id to avoid the additional round-trip to retrieve auth apps
                        const request = new MrsAuthenticate(schema.service, "qux", "quux", "biz",
                            "0x31000000000000000000000000000000");
                        await request.submit();
                    });

                    it("includes the appropriate access token in the request", async () => {
                        await restObject.getMetadata();

                        expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz/_metadata`, expect.objectContaining({
                            headers: {
                                // eslint-disable-next-line
                                "Authorization": "Bearer ABC",
                            },
                        }));
                    });

                    it("returns a plain JavaScript object with the metadata", async () => {
                        expect(await restObject.getMetadata()).to.deep.equal(metadata);
                    });
                });

                describe("and the client is not authenticated", () => {
                    beforeEach(() => {
                        FetchMock.push({ matchUrl: "/foo/bar/baz/_metadata", statusCode: 401 });
                    });

                    it("yields an authentication error", async () => {
                        await expect(async () => { await restObject.getMetadata(); }).rejects.toThrowError(
                            "Not authenticated. Please authenticate first before accessing the path " +
                            "/foo/bar/baz/_metadata.");
                    });
                });
            });

            describe("that does not require authentication", () => {
                beforeEach(() => {
                    FetchMock.push({ matchUrl: "/foo/bar/baz/_metadata", response: JSON.stringify(metadata) });
                });

                it("returns a plain JavaScript object with the metadata", async () => {
                    expect(await restObject.getMetadata()).to.deep.equal(metadata);
                });
            });
        });
    });

    describe("when calling a long-running REST routine", () => {
        interface IAsyncProcResultData {
            salute: string
        }

        const taskId = "ABC";
        const input = { name: "friend" };

        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        describe("starting an asynchronous task", () => {
            beforeEach(() => {
                FetchMock
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "SCHEDULED" }) })
                    .push({ matchUrl: "/foo/bar/baz", response: JSON.stringify({ taskId }) });
            });

            it("schedules a new task for the routine", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                const iterator = watchTaskRequest.submit();
                const { value, done } = await iterator.next();
                expect(value).toHaveProperty("status", "SCHEDULED");
                expect(done).toBeFalsy();
            });

            it("does not fail if a refresh rate is not specified", () => {
                expect(() => {
                    return new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                        schema, "/baz", input);
                }).not.toThrowError();

                expect(() => {
                    return new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                        schema, "/baz", input, {});
                }).not.toThrowError();

                expect(() => {
                    return new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                        schema, "/baz", input, { timeout: 400 });
                }).not.toThrowError();
            });

            it("fails if the refresh rate is not equal to or greater than 500ms", () => {
                expect(() => {
                    return new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                        schema, "/baz", input, { refreshRate: 400 });
                }).toThrowError("Refresh rate needs to be a number greater than or equal to 500ms.");
            });
        });

        describe("while it is running", () => {
            // Async Procedures only produce out parameters in the task result data (WL#16788).
            const result: IAsyncProcResultData = { salute: `hello, ${input.name}` };

            beforeEach(() => {
                FetchMock
                    .push({
                        matchUrl: `/foo/bar/baz/${taskId}`,
                        response: JSON.stringify({ status: "COMPLETED", data: result }),
                    })
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "RUNNING" }) })
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "RUNNING" }) })
                    .push({ matchUrl: "/foo/bar/baz", response: JSON.stringify({ taskId }) });
            });

            it("retrieves an update every 2 seconds by omission", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                const iterator = watchTaskRequest.submit();
                expect((await iterator.next()).value).toHaveProperty("status", "RUNNING");
                void vi.advanceTimersByTimeAsync(2000);
                expect((await iterator.next()).value).toHaveProperty("status", "RUNNING");
            });

            it("executes a given progress callback every 2 seconds by omission", async () => {
                const progress = vi.fn();
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { progress });

                const iterator = watchTaskRequest.submit();
                const { value: value1 } = await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                const { value: value2 } = await iterator.next();
                expect(progress).toHaveBeenCalledTimes(2);
                expect(progress).toHaveBeenNthCalledWith(1, value1);
                expect(progress).toHaveBeenLastCalledWith(value2);
            });

            it("retrieves an update after every given amount of time", async () => {
                const refreshRate = 1000;
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { refreshRate });

                const iterator = watchTaskRequest.submit();
                expect((await iterator.next()).value).toHaveProperty("status", "RUNNING");
                void vi.advanceTimersByTimeAsync(refreshRate);
                expect((await iterator.next()).value).toHaveProperty("status", "RUNNING");
            });

            it("executes a given progress callback after every given amount of time", async () => {
                const progress = vi.fn();
                const refreshRate = 1000;
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { progress, refreshRate });

                const iterator = watchTaskRequest.submit();
                const { value: value1 } = await iterator.next();
                void vi.advanceTimersByTimeAsync(refreshRate);
                const { value: value2 } = await iterator.next();
                expect(progress).toHaveBeenCalledTimes(2);
                expect(progress).toHaveBeenNthCalledWith(1, value1);
                expect(progress).toHaveBeenLastCalledWith(value2);
            });

            it("stops retrieving updates when it finishes", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);

                const { value } = await iterator.next();
                expect(value).toHaveProperty("status", "COMPLETED");
                expect(value).toHaveProperty("data", result);

                const { done } = await iterator.next();
                expect(done).toBeTruthy();
            });

            it("does not execute a given progress callback when it finishes", async () => {
                const progress = vi.fn();
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { progress });

                for await (const _ of watchTaskRequest.submit()) {
                    void vi.advanceTimersByTimeAsync(4000);
                }

                expect(progress).toHaveBeenCalledTimes(2);
            });
        });

        describe("which can be cancelled when the application", () => {
            beforeEach(() => {
                FetchMock.push();
            });

            it("kills the underlying task", async () => {
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", taskId);
                await task.kill();

                expect(fetch).toHaveBeenCalledOnce();
                expect(fetch).toHaveBeenCalledWith(`/foo/bar/baz/${taskId}`, expect.objectContaining({
                    method: "DELETE",
                }));
            });
        });

        describe("when it is cancelled", () => {
            const message = "Task was killed.";

            beforeEach(() => {
                FetchMock
                    .push({
                        matchUrl: `/foo/bar/baz/${taskId}`,
                        response: JSON.stringify({ status: "CANCELLED", message }),
                    })
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "RUNNING" }) })
                    .push({ matchUrl: "/foo/bar/baz", response: JSON.stringify({ taskId }) });
            });

            it("stops retrieving status updates", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);

                const { value } = await iterator.next();
                expect(value).toHaveProperty("status", "CANCELLED");
                expect(value).toHaveProperty("message", message);

                const { done } = await iterator.next();
                expect(done).toBeTruthy();
            });

            it("does not execute a given progress callback", async () => {
                const progress = vi.fn();
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { progress });

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                await iterator.next();

                expect(progress).toHaveBeenCalledOnce();
            });
        });

        describe("when it fails with an error", () => {
            const message = "There was an error...";

            beforeEach(() => {
                FetchMock
                    .push({
                        matchUrl: `/foo/bar/baz/${taskId}`,
                        response: JSON.stringify({ status: "ERROR", message }),
                    })
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "RUNNING" }) })
                    .push({ matchUrl: "/foo/bar/baz", response: JSON.stringify({ taskId }) });
            });

            it("stops retrieving status updates when watching the task", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);

                const { value } = await iterator.next();
                expect(value).toHaveProperty("status", "ERROR");
                expect(value).toHaveProperty("message", message);

                const { done } = await iterator.next();
                expect(done).toBeTruthy();
            });

            it("fails with an error when running the routine", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const pollTaskRequest = new MrsBaseTaskRun<object, IAsyncProcResultData>(
                    schema, "/baz", task);

                void vi.advanceTimersByTimeAsync(2000);

                await expect(async () => { await pollTaskRequest.execute(); }).rejects
                    .toThrowError(message);
            });
        });

        describe("when it does not produce a result after a given time", () => {
            const timeout = 3000;
            const message = `The timeout of ${timeout} ms has been exceeded.`;

            beforeEach(() => {
                FetchMock
                    .push({ matchUrl: `/foo/bar/baz/${taskId}`, response: JSON.stringify({ status: "RUNNING" }) })
                    .push({ matchUrl: "/foo/bar/baz", response: JSON.stringify({ taskId }) });
            });

            it("produces a single timeout event", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { timeout: 3000 });

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                let { value } = await iterator.next();
                expect(value).toHaveProperty("status", "TIMEOUT");
                expect(value).toHaveProperty("message", message);

                // consume the additional "RUNNING" status update
                await iterator.next();

                // ensure the timeout status update is not produced twice
                void vi.advanceTimersByTimeAsync(2000);
                ({ value } = await iterator.next());
                expect(value).not.toHaveProperty("status", "TIMEOUT");
            });

            it("does not stop retrieving status updates when watching the task", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const watchTaskRequest = new MrsBaseTaskWatch<object, IAsyncProcResultData>(
                    schema, "/baz", task, { timeout: 3000 });

                const iterator = watchTaskRequest.submit();
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                await iterator.next();
                void vi.advanceTimersByTimeAsync(2000);
                const { done } = await iterator.next();
                expect(done).toBeFalsy();
            });

            it("fails with an error when running the routine", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const pollTaskRequest = new MrsBaseTaskRun<object, IAsyncProcResultData>(
                    schema, "/baz", task, { timeout: 3000 });

                void vi.advanceTimersByTimeAsync(4000);

                await expect(async () => { await pollTaskRequest.execute(); }).rejects
                    .toThrowError(message);
            });

            it("kills the task when running the routine", async () => {
                const startTaskRequest = new MrsBaseTaskStart<{ name: string }, unknown, unknown>(
                    schema, "/baz", input);
                const { taskId: startedTaskId } = await startTaskRequest.submit();
                expect(startedTaskId).to.equal(taskId);
                const task = new MrsTask<object, IAsyncProcResultData>(schema, "/baz", startedTaskId);
                const pollTaskRequest = new MrsBaseTaskRun<object, IAsyncProcResultData>(
                    schema, "/baz", task, { timeout: 3000 });

                void vi.advanceTimersByTimeAsync(4000);

                try {
                    await pollTaskRequest.execute();
                } catch {
                    expect(fetch).toHaveBeenLastCalledWith(`/foo/bar/baz/${taskId}`, expect.objectContaining({
                        method: "DELETE",
                    }));
                }
            });
        });
    });
});
