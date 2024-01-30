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

import { ScriptingApi } from "../console.worker-types.js";

import { currentWorker } from "./execute.js";

/**
 * Converts a given value to a string and triggers an output action in the execution block.
 *
 * @param value The value to print.
 */
export const print = (value: unknown): void => {
    if (typeof value !== "string") {
        value = JSON.stringify(value, null, 4);
    }

    currentWorker.postContextMessage?.(currentWorker.currentTaskId, {
        api: ScriptingApi.Print,
        contextId: currentWorker.currentContext,
        value,
    });
};

/**
 * Sets properties of the global object that is persisted between code blocks
 *
 * @param name The name of the property to set
 * @param value The value of the property.
 */
export const setGlobalScriptingObjectProperty = (name: string, value: unknown): void => {
    currentWorker.postContextMessage?.(currentWorker.currentTaskId, {
        api: ScriptingApi.SetGlobalObjectProperty,
        contextId: currentWorker.currentContext,
        name,
        value,
    });
};
