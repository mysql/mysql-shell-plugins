/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { mysqlInfo } from "../../../app-logic/RdbmsInfo.js";
import { DBDataType, IColumnInfo } from "../../../app-logic/general-types.js";
import { convertRows, generateColumnInfo } from "../../../supplement/index.js";
import { DBType } from "../../../supplement/ShellInterface/index.js";

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
        expect(info[0]).toEqual({
            title: "col1",
            field: "0",
            dataType: { type: DBDataType.Unknown },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        });
        expect(info[1]).toEqual({
            title: "col2",
            field: "1",
            dataType: { type: DBDataType.String },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        });
        expect(info[2]).toEqual({
            title: "col3",
            field: "2",
            dataType: { type: DBDataType.Binary },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        });
        expect(info[3]).toEqual({
            title: "col4",
            field: "3",
            dataType: { type: DBDataType.Binary },
            inPK: false,
            nullable: false,
            autoIncrement: false,
        });
    });

    it("convertRows", (): void => {
        const columns: IColumnInfo[] = [
            {
                title: "col1",
                field: "0",
                dataType: { type: DBDataType.String },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "col2",
                field: "1",
                dataType: { type: DBDataType.Geometry },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "∰",
                field: "2",
                dataType: { type: DBDataType.Numeric },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
            {
                title: "👊🖐",
                field: "3",
                dataType: { type: DBDataType.Bigint },
                inPK: false,
                nullable: false,
                autoIncrement: false,
            },
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
            { 0: "lorem", 1: "ipsum", 2: "dolor", 3: "sit" },
            { 0: "a", 1: "b", 2: "c", 3: "d" },
            { 0: 1, 1: 2, 2: 3, 3: 4 },
        ]);

        const converted2 = convertRows(columns, converted);
        expect(converted2).toEqual(converted);
    });

});
