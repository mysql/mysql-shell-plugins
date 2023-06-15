/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { mysqlInfo, sqliteInfo } from "../app-logic/RdbmsInfo";
import { DBDataType, IColumnInfo, IDictionary } from "../app-logic/Types";
import { DBType } from "./ShellInterface";

// Commonly used data types and functions.

/**
 * These are the supported languages in the code editor.
 * This includes our mixed language (msg), which combines SQL, Python, JS and TS in one editor.
 */
export type EditorLanguage = (
    "text" | "typescript" | "javascript" | "mysql" | "sql" | "python" | "json" | "markdown" | "msg" | "xml" | "ini"
);

export interface ITextRange {
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
}

export interface IExecutionContext {
    id: string;
    code: string;
    codeLength: number;
    language: EditorLanguage;
    isSQLLike: boolean;
    linkId?: number;

    endLine: number;
    startLine: number;
    isInternal: boolean;

    fullRange: ITextRange | undefined;
}

export interface ISqlPageRequest {
    context: IExecutionContext;
    oldResultId: string;
    page: number;
    sql: string;
}

export interface IRunQueryRequest {
    data: IDictionary;
    query: string;
    parameters: Array<[string, string]>;
    linkId: number;
}

export interface IScriptRequest {
    /** A unique ID to identify the script in this request. */
    scriptId: string;

    /** The language of the script. */
    language: EditorLanguage;

    name?: string;
    content: string;

    /**
     * Used when executing SQL statements to tell the executor to add a hint to SELECT statements to use the secondary
     * engine (usually HeatWave
     */
    forceSecondaryEngine?: boolean;
}

/**
 * Used to request the creation of a new editor. Depending on the language this either creates a script editor or
 * a notebook.
 */
export interface INewEditorRequest {
    /** The id of the page (connection tab) to open the new script in. */
    page: string;

    /** The language to use for the new script file. */
    language: EditorLanguage;

    /** Optional content to use for the new script file. */
    content?: string;
}

export { Stack } from "./Stack";

export type WorkerExecutorType<T> = (
    onResult?: ((taskId: number, value: T) => void),
    onError?: ((taskId: number, reason?: unknown) => void)
) => void;

// A callback with a promise-like callback function.
export interface IThenableCallback<T> {
    then: (onResult?: ((taskId: number, value: T) => void)) => IThenableCallback<T>;
    catch: (onError?: ((taskId: number, reason?: unknown) => void)) => void;
}

// This conditional type enforces type widening on generic parameter types.
export type ValueType<T> = T extends string
    ? string
    : T extends number
        ? number
        : T extends boolean
            ? boolean
            : T extends undefined
                ? undefined
                : [T] extends [unknown]
                    ? T
                    : object;

/**
 * Generates a generic column info record for each raw column returned from a request. The format of the
 * raw columns depends on the used RDBMS.
 *
 * @param dbType Determines for which DB type the conversion happens (MySQL, SQLite and so on).
 * @param rawColumns Column info as returned by the backend.
 * @param useName Use column name not index.
 *
 * @returns A list of columns with RDBMS-agnostic details.
 */
export const generateColumnInfo = (dbType: DBType, rawColumns?: Array<{ name: string; type: string; length: number; }>,
    useName?: boolean): IColumnInfo[] => {
    if (!rawColumns) {
        return [];
    }

    const dataTypes = dbType === DBType.MySQL ? mysqlInfo.dataTypes : sqliteInfo.dataTypes;

    return rawColumns.map((entry, index) => {
        let type;
        if (entry.type.toLowerCase() === "bytes") {
            // For now, use length to switch between binary and blob
            if (entry.length < 256) {
                type = DBDataType.Binary;
            } else {
                type = DBDataType.Blob;
            }
        } else {
            const foundType = dataTypes.get(entry.type.toLowerCase());
            type = foundType ? foundType.type : DBDataType.Unknown;
        }

        return {
            title: entry.name,
            field: useName ? entry.name : String(index),
            dataType: {
                type,
            },
        };
    });
};

/**
 * Converts the given rows into a dictionary format as required by the UI, if it isn't already in that format.
 *
 * @param columns Column informations to find column IDs.
 * @param rows The rows to convert.
 *
 * @returns The converted rows.
 */
export const convertRows = (columns: IColumnInfo[], rows?: unknown[]): IDictionary[] => {
    if (!rows || rows.length === 0) {
        return [];
    }

    if (Array.isArray(rows[0])) {
        // Data is array of arrays of fields.
        const convertedRows: IDictionary[] = [];
        rows.forEach((value): void => {
            const row: IDictionary = {};

            const entry = value as unknown[];
            columns.forEach((column: IColumnInfo, columnIndex: number): void => {
                row[column.field] = entry[columnIndex];
            });
            convertedRows.push(row);
        });

        return convertedRows;
    }

    return rows as IDictionary[];
};
