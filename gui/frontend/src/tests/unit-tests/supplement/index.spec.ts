/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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
import { convertRows, generateColumnInfo, getColumnsMetadataForEmptyResultSet, getDataTypeDetails,
    parseColumnLength, parseDataTypeFromRaw, parseSchemaTable } from "../../../supplement/index.js";
import { DBType } from "../../../supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { QueryType } from "../../../parsing/parser-common.js";
import { IGetColumnsMetadataItem } from "../../../communication/ProtocolGui.js";

describe("General Supplement Tests", (): void => {
    const schema = "sakila";
    const table = "actor";
    const getColumnsMetadataResponse: IGetColumnsMetadataItem[] = [
        {
            name: "first_name",
            type: "varchar(45)",
            schema,
            table,
        },
        {
            name: "last_update",
            type: "timestamp",
            schema,
            table,
        },
        {
            name: "actor_id",
            type: "smallint",
            schema,
            table,
        },
    ];

    const mockBackend = {
        getCurrentSchema: jest.fn().mockResolvedValue(schema),
        getTableObjectNames: jest.fn().mockResolvedValue(["actor_id", "first_name", "last_update"]),
        getColumnsMetadata: jest.fn().mockResolvedValue(getColumnsMetadataResponse),
    } as unknown as ShellInterfaceSqlEditor;

    beforeAll(() => {
        // Add some mock types for lookup.
        mysqlInfo.dataTypes.clear();
        mysqlInfo.dataTypes.set("string", { type: DBDataType.String });
        mysqlInfo.dataTypes.set("smallint", { type: DBDataType.SmallInt, characterMaximumLength: 5 });
        mysqlInfo.dataTypes.set("char", { type: DBDataType.Char, characterMaximumLength: 255 });
        mysqlInfo.dataTypes.set("decimal", { type: DBDataType.Decimal, numericPrecision: 65, numericScale: 30 });
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

    describe("Test parseSchemaTable", () => {
        it("Test without quotes", async () => {
            const expected = { schema: "sakila", table: "actor" };
            const actual = await parseSchemaTable("sakila.actor");
            expect(expected).toEqual(actual);
        });

        it("Test with quotes and missing backend", async () => {
            const expected = { schema: "sakila", table: "actor" };
            const actual = await parseSchemaTable("`sakila`.`actor`");
            expect(expected).toEqual(actual);
        });

        it("Test missing schema", async () => {
            const expected = { schema: "", table };
            const actual = await parseSchemaTable(table);
            expect(expected).toEqual(actual);
        });

        it("Test schema provided by the backend", async () => {
            const expected = { schema, table };
            const actual = await parseSchemaTable(table, mockBackend);
            expect(expected).toEqual(actual);
        });
    });

    describe("Test parseColumnLength", () => {
        it("Test parsed length", () => {
            expect(parseColumnLength("VARCHAR(16)")).toEqual(16);
        });

        it("Test fallback length", () => {
            expect(parseColumnLength("varchar", 32)).toEqual(32);
        });

        it("Test default length", () => {
            expect(parseColumnLength("varchar")).toEqual(65535);
        });

        it("Test default when length is missing", () => {
            expect(parseColumnLength("set('Select','Insert','Update','Delete')")).toEqual(65535);
        });
    });

    describe("Test getDataTypeDetails", () => {
        it("Test unknown data type", () => {
            const actual = getDataTypeDetails(DBType.MySQL, "foo");
            expect(actual.type).toEqual(DBDataType.Unknown);
        });

        it("Test known data type", () => {
            const actual = getDataTypeDetails(DBType.MySQL, "smallint");
            expect(actual.type).toEqual(DBDataType.SmallInt);
        });

        it("Test characterMaximumLength", () => {
            const actual = getDataTypeDetails(DBType.MySQL, "CHAR");
            expect(actual.characterMaximumLength).toEqual(255);
        });

        it("Test numeric", () => {
            const actual = getDataTypeDetails(DBType.MySQL, "DeciMAL");
            expect(actual.numericPrecision).toEqual(65);
            expect(actual.numericScale).toEqual(30);
        });
    });

    describe("Test parseDataTypeFromRaw", () => {
        it("Parses as is", () => {
            const type = "int";
            expect(parseDataTypeFromRaw(DBType.MySQL, type)).toEqual(type);
            expect(parseDataTypeFromRaw(DBType.MySQL, type.toUpperCase())).toEqual(type);
        });

        it("Parses with white space characters", () => {
            expect(parseDataTypeFromRaw(DBType.MySQL, " int ")).toEqual("int");
        });

        it("Parses main type", () => {
            expect(parseDataTypeFromRaw(DBType.MySQL, "smallint unsigned")).toEqual("smallint");
            expect(parseDataTypeFromRaw(DBType.MySQL, "INT UNSIGNED")).toEqual("int");
        });

        it("Parses type with length", () => {
            expect(parseDataTypeFromRaw(DBType.MySQL, "VARCHAR(255)")).toEqual("varchar");
        });

        it("Parses enum", () => {
            expect(parseDataTypeFromRaw(DBType.MySQL, "ENUM('N','Y')")).toEqual("enum");
        });

        it("Returns itself when unknown", () => {
            expect(parseDataTypeFromRaw(DBType.MySQL, "unknown")).toEqual("unknown");
        });
    });

    describe("Test getColumnsMetadataForEmptyResultSet", () => {
        it("Test without full table name", async () => {
            const actual = await getColumnsMetadataForEmptyResultSet(
                "", QueryType.Select, DBType.MySQL, mockBackend,
            );
            expect(actual).toEqual([]);
        });

        it("Test with non select query", async () => {
            const actual = await getColumnsMetadataForEmptyResultSet(
                `${schema}.${table}`, QueryType.Update, DBType.MySQL, mockBackend,
            );
            expect(actual).toEqual([]);
        });

        it("Test with without backend", async () => {
            const actual = await getColumnsMetadataForEmptyResultSet(
                `${schema}.${table}`, QueryType.Select, DBType.MySQL,
            );
            expect(actual).toEqual([]);
        });

        it("Test with no database selected", async () => {
            const actual = await getColumnsMetadataForEmptyResultSet(
                table, QueryType.Select, DBType.MySQL, {
                    getCurrentSchema: jest.fn().mockResolvedValue(""),
                } as unknown as ShellInterfaceSqlEditor,
            );
            expect(actual).toEqual([]);
        });

        it("Test with empty table name", async () => {
            const actual = await getColumnsMetadataForEmptyResultSet(
                "``", QueryType.Select, DBType.MySQL, mockBackend,
            );
            expect(actual).toEqual([]);
        });

        it("Test with getColumnsMetadataResponse", async () => {
            const expected: Array<IGetColumnsMetadataItem & { length: number; }> = [
                {
                    name: "actor_id",
                    type: "smallint",
                    schema,
                    table,
                    length: 5,
                },
                {
                    name: "first_name",
                    type: "varchar",
                    schema,
                    table,
                    length: 45,
                },
                {
                    name: "last_update",
                    type: "timestamp",
                    schema,
                    table,
                    length: 65535,
                },
            ];
            const actual = await getColumnsMetadataForEmptyResultSet(
                `${schema}.${table}`, QueryType.Select, DBType.MySQL, mockBackend,
            );
            expect(actual).toEqual(expected);
        });
    });
});
