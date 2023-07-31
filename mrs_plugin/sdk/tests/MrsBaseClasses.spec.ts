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

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    IFindManyOptions, IFindUniqueOptions, JsonValue, MrsBaseObjectQuery, MrsBaseSchema, MrsBaseService,
} from "../MrsBaseClasses";

// fixtures
interface ITableMetadata1 {
    id?: number,
    str?: string,
    num?: number,
    isActive?: boolean,
    json?: JsonValue,
    oneToMany?: ITableMetadata2[]
}

interface ITableMetadata2 {
    id?: number,
    str?: string,
    oneToOne?: ITableMetadata3
}

interface ITableMetadata3 {
    id?: number,
    str?: string
}

const fetchTestDouble = vi.fn(() => {
    return Promise.resolve({
        ok: true,
        json: () => {
            return;
        },
    });
});

vi.stubGlobal("fetch", fetchTestDouble);

describe("MRS SDK API", () => {
    // more fixtures
    const service: MrsBaseService = new MrsBaseService("/foo");
    const schema: MrsBaseSchema = { requestPath: "/bar", service };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("selects fields to include in the result set using the field names", async () => {
        const options: IFindManyOptions<ITableMetadata1, unknown> = {
            select: ["str", "json", "oneToMany.oneToOne.str"],
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options.select);
        await query.fetch();

        expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?f=str,json,oneToMany.oneToOne.str",
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

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options.select);
        await query.fetch();

        expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?f=str,json,oneToMany.oneToOne.str",
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

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options.select);
        await query.fetch();

        expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?f=!id,!json,!oneToMany.id,!oneToMany.oneToOne.id",
            expect.anything());
    });

    it("sets the order of the records in the result set based on a given field using a literal order keyword",
            async () => {
        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.orderBy({ num: "DESC" }).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"$orderby":{"num":"DESC"}}',
            expect.anything());
    });

    it("sets the order of the records in the result set based on a given field using a numeric order identifier",
            async () => {
        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.orderBy({ num: -1 }).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"$orderby":{"num":-1}}',
            expect.anything());
    });

    it("retrieves the first page of records that match a given implicit filter", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            where: {
                id: 1,
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"id":1}', expect.anything());
    });

    it("retrieves the first page of records that match a given explicit filter", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            where: {
                str: {
                    $like: "%foo%",
                },
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"str":{"$like":"%foo%"}}', expect.anything());
    });

    it("retrieves a limited number of records from the first page", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            take: 2,
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.limit(options.take).fetch();

        expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?limit=2", expect.anything());
    });

    it("retrieves a limited number of records from the first page that match a given filter", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            take: 2,
            where: {
                id: {
                    $gt: 10,
                },
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).limit(options.take).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"id":{"$gt":10}}&limit=2', expect.anything());
    });

    it("skips a number of records from the first page", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            skip: 2,
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.offset(options.skip).fetch();

        expect(fetch).toHaveBeenCalledWith("/foo/bar/baz?offset=2", expect.anything());
    });

    it("skips a number of records that match a given filter", async () => {
        const options: IFindManyOptions<unknown, ITableMetadata1> = {
            skip: 2,
            where: {
                isActive: true,
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).offset(options.skip).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"isActive":true}&offset=2', expect.anything());
    });

    it("retrieves the record that matches the given identifier or primary key", async () => {
        const options: IFindUniqueOptions<unknown, ITableMetadata1> = {
            where: {
                id: 2,
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"id":2}', expect.anything());
    });

    it("retrieves all records where a given field is NULL", async () => {
        const options: IFindManyOptions<unknown, { maybe: number | null }> = {
            where: {
                maybe: null,
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"maybe":{"$null":"null"}}', expect.anything());
    });

    it("retrieves all records where a given field is not NULL", async () => {
        const options: IFindManyOptions<unknown, { maybe: number | null }> = {
            where: {
                maybe: {
                    not: null,
                },
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"maybe":{"$notnull":"null"}}', expect.anything());
    });

    it(`retrieves all records where a field called "not" is NULL`, async () => {
        const options: IFindManyOptions<unknown, { not: number | null }> = {
            where: {
                not: null,
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"not":{"$null":"null"}}', expect.anything());
    });

    it(`retrieves all records where a field called "not" is not NULL`, async () => {
        const options: IFindManyOptions<unknown, { not: number | null }> = {
            where: {
                not: {
                    not: null,
                },
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz");
        await query.where(options.where).fetch();

        expect(fetch).toHaveBeenCalledWith('/foo/bar/baz?q={"not":{"$notnull":"null"}}', expect.anything());
    });
});
