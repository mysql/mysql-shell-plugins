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

import {
    IFindOptions, MrsBaseObjectQuery, MrsBaseSchema, MrsBaseService,
} from "../MrsBaseClasses";

// fixtures
interface ITableMetadata1 {
    id?: number,
    str?: string,
    num?: number,
    isActive?: boolean,
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

const fetchTestDouble = jest.fn(() => {
    return Promise.resolve({
        ok: true,
        json: () => {
            return;
        },
    });
}) as jest.Mock;

describe("MRS SDK", (): void => {
    // more fixtures
    const service: MrsBaseService = new MrsBaseService("/foo");
    const schema: MrsBaseSchema = { requestPath: "/bar", service };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = fetchTestDouble;
    });

    it("select fields to include in the result set using the field names", async () => {
        const options: IFindOptions<ITableMetadata1, unknown> = { select: ["str", "oneToMany.oneToOne.str"] };
        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options.select);
        await query.fetch();

        expect(fetchTestDouble).toHaveBeenCalledWith("/foo/bar/baz?f=str,oneToMany.oneToOne.str",
            expect.anything());
    });

    it("select fields to include in the result set using a field mapper", async () => {
        const options: IFindOptions<ITableMetadata1, unknown> = {
            select: {
                str: true,
                oneToMany: {
                    oneToOne: {
                        str: true,
                    },
                },
            },
        };

        const query = new MrsBaseObjectQuery<ITableMetadata1, unknown>(schema, "/baz", options.select);
        await query.fetch();

        expect(fetchTestDouble).toHaveBeenCalledWith("/foo/bar/baz?f=str,oneToMany.oneToOne.str",
            expect.anything());
    });

    it("select fields to exclude from the result set using a field mapper", async () => {
        const options: IFindOptions<ITableMetadata1, unknown> = {
            select: {
                id: false,
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

        expect(fetchTestDouble).toHaveBeenCalledWith("/foo/bar/baz?f=!id,!oneToMany.id,!oneToMany.oneToOne.id",
            expect.anything());
    });
});
