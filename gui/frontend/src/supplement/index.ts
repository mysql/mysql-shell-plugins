/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { mysqlInfo, sqliteInfo } from "../app-logic/RdbmsInfo.js";
import { DBDataType, type IColumnInfo, type IDBDataTypeDetails, type IDictionary } from "../app-logic/general-types.js";
import { ITableColumn, IGetColumnsMetadataItem } from "../communication/ProtocolGui.js";
import { QueryType } from "../parsing/parser-common.js";
import { Base64Convert } from "../utilities/Base64Convert.js";
import { unquote } from "../utilities/string-helpers.js";
import { ShellInterfaceSqlEditor } from "./ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType } from "./ShellInterface/index.js";

export { Stack } from "./Stack.js";

// Commonly used data types and functions.

export const editorLanguages = [
    "text", "typescript", "javascript", "mysql", "sql", "python", "json", "markdown", "msg", "xml", "ini"] as const;

/**
 * These are the supported languages in the code editor.
 * This includes our mixed language (msg), which combines SQL, Python, JS and TS in one editor.
 */
export type EditorLanguage = typeof editorLanguages[number];

/**
 * Checks if a given value is a supported code editor language.
 *
 * @param value The value to check.
 *
 * @returns True if the value is a supported code editor language.
 */
export const isEditorLanguage = (value: unknown): value is EditorLanguage => {
    return typeof value === "string" && editorLanguages.includes(value as EditorLanguage);
};

/**
 * These are the supported language suffixes in the code editor (usually for syntax highlighting).
 */
export const editorLanguageSuffixes = [
    "txt", "ts", "js", "mysql", "sql", "py", "json", "md", "msg", "xml", "ini"] as const;

export type EditorLanguageSuffix = typeof editorLanguageSuffixes[number];

/**
 * Checks if a given value is a supported code editor language.
 *
 * @param value The value to check.
 *
 * @returns True if the value is a supported code editor language.
 */
export const isEditorLanguageSuffix = (value: unknown): value is EditorLanguageSuffix => {
    return typeof value === "string" && editorLanguageSuffixes.includes(value as EditorLanguageSuffix);
};

/**
 * These are the URLs for the existing help and documentation resources.
 */
export const helpUrlMap = new Map<string, string>([
    ["Learn More", "https://blogs.oracle.com/mysql/post/introducing-mysql-shell-for-vs-code"],
    ["Documentation", "https://dev.mysql.com/doc/mysql-shell-gui/en/"],
]);

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

/** A general request related to a code script (load/save etc.). */
export interface IScriptRequest {
    /** The data model id of the script to create/update/drop. */
    id: string;

    /** The caption that should be set in that editor. */
    caption: string;

    /** The content to load/save. */
    content: string;

    /** The language of the content. */
    language: EditorLanguage;

    /**
     * Used when executing SQL statements to tell the executor to add a hint to SELECT statements to use the secondary
     * engine (usually HeatWave).
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

export type WorkerExecutorType<T> = (
    onResult?: ((taskId: number, value: T) => void),
    onError?: ((taskId: number, reason?: unknown) => void)
) => void;

// A callback with a promise-like callback function.
export interface IThenableCallback<T> {
    then: (onResult?: ((taskId: number, value: T) => void)) => IThenableCallback<T>;
    catch: (onError?: ((taskId: number, reason?: unknown) => void)) => void;
}

/** This conditional type enforces type widening on generic parameter types. */
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

export const getDataTypeDetails = (dbType: DBType, dataType: string): IDBDataTypeDetails => {
    const dataTypes = dbType === DBType.MySQL ? mysqlInfo.dataTypes : sqliteInfo.dataTypes;

    return { // Make a copy of the data type details.
        ...dataTypes.get(dataType.toLowerCase()) ?? { type: DBDataType.Unknown },
    };
};

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
export const generateColumnInfo = (dbType: DBType, rawColumns?: ITableColumn[],
    useName?: boolean): IColumnInfo[] => {
    if (!rawColumns) {
        return [];
    }

    return rawColumns.map((entry, index) => {
        const dataType: IDBDataTypeDetails = getDataTypeDetails(dbType, entry.type);
        const typeName = entry.type.toLowerCase();
        switch (typeName) {
            case "bytes": {
                // The actual type depends on the length of the data.
                switch (entry.length) {
                    case 0xFF: {
                        dataType.type = DBDataType.TinyBlob;
                        break;
                    }

                    case 0xFFFF: {
                        dataType.type = DBDataType.Blob;
                        break;
                    }

                    case 0xFFFFFF: {
                        dataType.type = DBDataType.MediumBlob;
                        break;
                    }

                    case 0xFFFFFFFF: {
                        dataType.type = DBDataType.LongBlob;
                        break;
                    }

                    default: {
                        dataType.type = DBDataType.Binary; // or varbinary, but there's no way to tell.
                        break;
                    }
                }

                break;
            }

            case "int": {
                // If the display width is 1, assume it's a boolean.
                if (entry.length === 1) {
                    dataType.type = DBDataType.Boolean;
                }

                break;
            }

            case "timestamp": {
                dataType.type = DBDataType.DateTime;

                break;
            }

            case "string":
            case "str": {
                dataType.type = DBDataType.String;

                break;
            }

            default:
                break;
        }

        return {
            title: entry.name,
            field: useName ? entry.name : String(index),
            dataType,
            inPK: false, // Will be determined in another step.
            nullable: false, // ditto.
            autoIncrement: false, // ditto.
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
                if (entry[columnIndex] == null) {
                    row[column.field] = null;
                } else {
                    switch (column.dataType.type) {
                        case DBDataType.TinyBlob:
                        case DBDataType.Blob:
                        case DBDataType.MediumBlob:
                        case DBDataType.LongBlob: {
                            // Blobs are sent as base64 encoded strings. Convert them to array buffers.
                            row[column.field] = Base64Convert.decode(entry[columnIndex] as string);
                            break;
                        }
                        default: {
                            row[column.field] = entry[columnIndex];
                        }
                    }
                }
            });
            convertedRows.push(row);
        });

        return convertedRows;
    }

    return rows as IDictionary[];
};

const dataTypeRegex = /^(\w+)(\(([^)]+)\))?/;

export const parseDataTypeFromRaw = (dbType: DBType, rawType: string): string => {
    const normalizedType = rawType.toLowerCase().trim();

    // Match the main type and parentheses content (if any).
    const match = normalizedType.match(dataTypeRegex);

    if (!match) {
        return rawType;
    }

    const mainType = match[1];
    const details = getDataTypeDetails(dbType, mainType);

    return details ? mainType : rawType;
};

const parseColumnLengthFromRaw = (rawType: string): number | undefined => {
    const normalizedType = rawType.toLowerCase().trim();

    // Match the main type and parentheses content (if any).
    const match = normalizedType.match(dataTypeRegex);

    if (!match || match[3] === undefined) {
        return undefined;
    }

    return parseInt(match[3], 10);
};

export const parseColumnLength = (rawType: string, characterMaximumLength?: number): number => {
    let length = 65535;
    const parsedLength = parseColumnLengthFromRaw(rawType);
    if (parsedLength) {
        length = parsedLength;
    } else if (characterMaximumLength) {
        length = characterMaximumLength;
    }

    return length;
};

export const parseSchemaTable = async (fullTableName: string, backend?: ShellInterfaceSqlEditor):
    Promise<{schema: string; table: string}> => {

    const parts = fullTableName.split(".");
    const table = unquote(parts.pop()!);
    let schema = "";
    if (parts.length > 0) {
        schema = unquote(parts.pop()!);
    }

    if (schema.length === 0) {
        schema = await backend?.getCurrentSchema() ?? "";
    }

    return { schema, table };
};

export const getColumnsMetadataForEmptyResultSet = async (
    fullTableName: string | undefined, queryType: QueryType, dbType: DBType, backend?: ShellInterfaceSqlEditor,
): Promise<Array<IGetColumnsMetadataItem & { length: number; }>> => {

    const metadata: Array<IGetColumnsMetadataItem & { length: number; }> = [];
    if (queryType !== QueryType.Select || !fullTableName || !backend) {
        return metadata;
    }

    const { schema, table } = await parseSchemaTable(fullTableName);

    const columnNames = await backend.getTableObjectNames(schema, table, "Column");
    const request = columnNames.map((column) => {
        return {
            schema,
            table,
            column,
        };
    });
    const response = await backend.getColumnsMetadata(request);

    // We need to preserve the same columns order as in getTableObjectNames,
    // therefore cannot iterate through getColumnsMetadata response directly.
    columnNames.forEach((column) => {
        const data = response.find((data) => {
            return data.name === column;
        });
        if (!data) {
            return;
        }

        const details = getDataTypeDetails(dbType, data.type);
        const type = parseDataTypeFromRaw(dbType, data.type);

        metadata.push({
            ...data,
            type,
            length: parseColumnLength(data.type, details.characterMaximumLength),
        });
    });

    return metadata;
};
