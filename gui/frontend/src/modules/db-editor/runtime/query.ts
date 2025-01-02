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

import { currentWorker, isCloneable } from "./execute.js";

export const runSqlIterative = (sql: string, callback?: (res: unknown) => void, params?: unknown): void => {
    if (!isCloneable(params)) {
        throw new Error("The given parameters cannot be used in this function, because they are not cloneable.");
    }

    if (callback) {
        currentWorker.pendingRequests.set(currentWorker.currentContext, callback);
    }

    currentWorker.postContextMessage?.(currentWorker.currentTaskId, {
        api: ScriptingApi.RunSqlIterative,
        contextId: currentWorker.currentContext,
        code: sql,
        params,
    });
};

export const runSqlWithCallback = (sql: string, callback?: (res: unknown) => void, params?: unknown): void => {
    if (!isCloneable(params)) {
        throw new Error("The given parameters cannot be used in this function, because they are not cloneable.");
    }

    if (callback) {
        currentWorker.pendingRequests.set(currentWorker.currentContext, callback);
    }

    currentWorker.postContextMessage?.(currentWorker.currentTaskId, {
        api: ScriptingApi.RunSql,
        contextId: currentWorker.currentContext,
        code: sql,
        params,
    });
};

export const runSql = async (sql: string, params?: unknown): Promise<unknown> => {
    return new Promise((resolve) => {
        runSqlWithCallback(sql, resolve, params);
    });
};
