/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { IDictionary } from "../app-logic/Types";

// Commonly used data types.

// These are the supported languages in the code editor.
// This includes our mixed language (msg), which combines SQL, Python, JS and TS in one editor.
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
}

export interface ISqlPageRequest {
    context: IExecutionContext;
    oldRequestId: string;
    page: number;
    sql: string;
}

export interface IRunQueryRequest {
    data: IDictionary;
    query: string;
    parameters: Array<[string, string]>;
    linkId: number;
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
