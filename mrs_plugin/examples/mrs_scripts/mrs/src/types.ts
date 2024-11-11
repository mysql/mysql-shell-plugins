/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

export interface IDictionary {
    [key: string]: unknown;
}

/**
 * A JSON object contains keys which are strings and values in a specific range of primitives.
 */
export type JsonObject = { [Key in string]: JsonValue } & { [Key in string]?: JsonValue | undefined };

/**
 * A JSON array is just a list of valid JSON values.
 * Since ReadonlyArray is a first-class type in TypeScript, it needs to be accounted for.
 */
export type JsonArray = JsonValue[] | readonly JsonValue[];

/**
 * JSON supports a set of primitives that includes strings, numbers, booleans and null.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON supports a set of values that includes specific primitive types, other JSON object definitions
 * and arrays of these.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * Columns can be assigned "NOT NULL" constraints, which can be enforced by the client type.
 * However, columns without that constraint should allow "null" assignments.
 */
export type MaybeNull<T> = T | null;

