/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { DBDataType, IColumnInfo, defaultValues } from "../../app-logic/general-types.js";
import { formatBase64ToHex } from "../../utilities/string-helpers.js";

/**
 * A class that manages the unique selector for a row in a data set.
 * It is used to generate a `where` clause for updating that row.
 */
export class QueryBuilder {
    #columns: IColumnInfo[];
    #pkColumns: IColumnInfo[];
    #upperCase: boolean;
    #tableName: string;

    public constructor(tableName: string, columns: IColumnInfo[], upperCase: boolean) {
        this.#columns = columns;
        this.#tableName = tableName;
        this.#upperCase = upperCase;

        // Filter out the PK columns for where clauses.
        this.#pkColumns = this.#columns.filter((column) => {
            return column.inPK;
        });
    }

    private static escapeControlChars(value: string): string {
        return value.replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t");
    }

    private static formatValue(column: IColumnInfo, value: unknown): string {
        switch (column.dataType.type) {
            case DBDataType.Char:
            case DBDataType.Nchar:
            case DBDataType.Varchar:
            case DBDataType.Nvarchar:
            case DBDataType.String:
            case DBDataType.TinyText:
            case DBDataType.Text:
            case DBDataType.MediumText:
            case DBDataType.LongText: {
                // Strings need to be quoted.
                return `'${String(value)}'`;
            }

            case DBDataType.Binary:
            case DBDataType.Varbinary: {
                // Strings need to be quoted.
                return formatBase64ToHex(value as string);
            }


            case DBDataType.DateTime:
            case DBDataType.Timestamp: {
                const date = value instanceof Date ? value : new Date(value as string);

                return `'${date.toISOString().slice(0, 19).replace("T", " ")}'`;
            }

            case DBDataType.Date: {
                const date = value instanceof Date ? value : new Date(value as string);

                return `'${date.toISOString().slice(0, 10)}'`;
            }

            case DBDataType.Time: {
                if (value instanceof Date) {
                    return `'${value.toISOString().slice(11, 19)}'`;
                }

                return `'${value as string}'`;

            }

            case DBDataType.Bit:
                return `b'${String(value)}'`;

            case DBDataType.TinyBlob:
            case DBDataType.Blob:
            case DBDataType.MediumBlob:
            case DBDataType.LongBlob: {
                // Blobs are stored as array buffers. Convert them to hex strings.
                const buffer = value as ArrayBuffer;
                const bytes = new Uint8Array(buffer);
                const hex = [];
                for (const byte of bytes) {
                    hex.push(byte.toString(16).padStart(2, "0"));
                }

                return `0x${hex.join("")}`;
            }

            default: {
                if (column.dataType.needsQuotes) {
                    return `'${String(value)}'`;
                }

                return `${String(value)}`;
            }
        }
    }

    public get columnNames(): string[] {
        return this.#columns.map((column) => { return column.title; });
    }

    public generateInsertStatement(newValues: unknown[]): string {
        // Collect only columns that are not auto-incrementing.
        const insertColumns: IColumnInfo[] = [];
        const insertValues: unknown[] = [];

        this.#columns.forEach((column, index) => {
            if (!column.autoIncrement) {
                insertColumns.push(column);
                let value = newValues[index];

                // Ensure to escape control chars of string values
                if (typeof value === "string") {
                    value = QueryBuilder.escapeControlChars(value);
                }
                insertValues.push(value);
            }
        });
        const columnNames = insertColumns.map((column) => { return column.title; }).join(", ");
        const mappedValues = this.mapValues(insertColumns, insertValues).join(", ");

        const insertKeyword = this.#upperCase ? "INSERT INTO" : "insert into";
        const valuesKeyword = this.#upperCase ? "VALUES" : "values";

        return `${insertKeyword} ${this.#tableName} (${columnNames}) ${valuesKeyword} (${mappedValues})`;
    }

    public generateDeleteStatement(pkValues: unknown[]): string {
        const deleteKeyword = this.#upperCase ? "DELETE FROM" : "delete from";
        const whereClause = this.whereClause(pkValues);

        return `${deleteKeyword} ${this.#tableName} ${whereClause}`;
    }

    public generateUpdateStatement(pkValues: unknown[], changedColumns: string[], newValues: unknown[]): string {
        const changes: string[] = [];

        const columns = changedColumns.map((column) => {
            return this.#columns.find((c) => { return c.title === column; })!;
        });
        const mappedValues = this.mapValues(columns, newValues);

        for (let i = 0; i < changedColumns.length; ++i) {
            const column = changedColumns[i];
            let value = mappedValues[i];

            // Ensure to escape control chars of string values
            if (typeof value === "string") {
                value = QueryBuilder.escapeControlChars(value);
            }
            changes.push(`${column} = ${value}`);
        }

        const update = this.#upperCase ? "UPDATE" : "update";
        const set = this.#upperCase ? "SET" : "set";

        return `${update} ${this.#tableName} ${set} ${changes.join(", ")} ${this.whereClause(pkValues)}`;
    }

    private whereClause(pkValues: unknown[]): string {
        const whereExpressions = this.#pkColumns.map((column, index) => {
            const value = QueryBuilder.formatValue(column, pkValues[index]);

            return `${column.title} = ${value}`;
        });

        // If we have more than one column, wrap each expression in parenthesis.
        if (whereExpressions.length > 1) {
            whereExpressions.forEach((clause, index) => {
                whereExpressions[index] = `(${clause})`;
            });
        }

        const whereKeyword = this.#upperCase ? "WHERE" : "where";
        const andKeyword = this.#upperCase ? " AND " : " and ";

        return whereKeyword + " " + whereExpressions.join(andKeyword);
    }

    private mapValues(columns: IColumnInfo[], values: unknown[]): string[] {
        // Process each value and convert it to a string.
        return values.map((value, index) => {
            // Both the values and columns arrays are the same length. But just in case, wrap around
            // if we run out of columns.
            const column = columns[index % columns.length];
            const dataType = column.dataType;

            if (value == null) { // null or undefined
                if (column.default) {
                    value = column.default;
                } else if (column.nullable) {
                    return this.#upperCase ? "NULL" : "null";
                } else {
                    value = defaultValues[dataType.type];
                }
            }

            return QueryBuilder.formatValue(column, value);
        });
    }
}
