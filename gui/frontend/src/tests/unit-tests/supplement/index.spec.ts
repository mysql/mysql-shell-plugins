/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { mysqlInfo } from "../../../app-logic/RdbmsInfo";
import { DBDataType } from "../../../app-logic/Types";
import { convertRows, generateColumnInfo } from "../../../supplement";
import { DBType } from "../../../supplement/ShellInterface";

describe("General Supplement Tests", (): void => {
    beforeAll(() => {
        // Add some mock types for lookup.
        mysqlInfo.dataTypes.clear();
        mysqlInfo.dataTypes.set("string", { type: DBDataType.String });
    });

    afterAll(() => {
        mysqlInfo.dataTypes.clear();
    });

    it("Generating Column Info", () => {
        let info = generateColumnInfo(DBType.MySQL);
        expect(info.length).toBe(0);

        const columns = [{
            name: "col1",
            type: "dog",
            length: 1,
        },
        {
            name: "col2",
            type: "StRiNg",
            length: 1,
        },
        {
            name: "col3",
            type: "BYTES",
            length: 100,
        },
        {
            name: "col4",
            type: "bytes",
            length: 1024,
        }];

        info = generateColumnInfo(DBType.MySQL, columns);
        expect(info.length).toBe(4);
        expect(info[0]).toEqual({ name: "col1", dataType: { type: DBDataType.Unknown } });
        expect(info[1]).toEqual({ name: "col2", dataType: { type: DBDataType.String } });
        expect(info[2]).toEqual({ name: "col3", dataType: { type: DBDataType.Binary } });
        expect(info[3]).toEqual({ name: "col4", dataType: { type: DBDataType.Blob } });
    });

    it("convertRows", (): void => {
        const columns = [
            { name: "col1", dataType: { type: DBDataType.String } },
            { name: "col2", dataType: { type: DBDataType.Geometry } },
            { name: "∰", dataType: { type: DBDataType.Numeric } },
            { name: "👊🖐", dataType: { type: DBDataType.Bigint } },
        ];

        let converted = convertRows(columns);
        expect(converted).toEqual([]);

        const rows = [
            ["lorem", "ipsum", "dolor", "sit"],
            ["a", "b", "c", "d"],
            [1, 2, 3, 4],
        ];

        converted = convertRows(columns, rows);
        expect(converted.length).toBe(3);

        expect(converted).toEqual([
            /* eslint-disable @typescript-eslint/naming-convention */
            { "col1": "lorem", "col2": "ipsum", "∰": "dolor", "👊🖐": "sit" },
            { "col1": "a", "col2": "b", "∰": "c", "👊🖐": "d" },
            { "col1": 1, "col2": 2, "∰": 3, "👊🖐": 4 },
            /* eslint-enable @typescript-eslint/naming-convention */
        ]);

        const converted2 = convertRows(columns, converted);
        expect(converted2).toEqual(converted);
    });

});
