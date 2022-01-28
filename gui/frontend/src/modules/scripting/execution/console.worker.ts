/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

/* eslint-disable no-restricted-globals */
/* eslint-disable no-eval */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-classes-per-file */

import {
    PrivateWorker, ScriptingApi, IConsoleWorkerResultData, IConsoleWorkerTaskData,
} from "../console.worker-types";
import { PieGraphProxy } from "../PieGraph";

const ctx = self as unknown as PrivateWorker;

ctx.pendingRequests = new Map();
ctx.postContextMessage = (taskId: number, data: IConsoleWorkerResultData): void => {
    ctx.postMessage({
        taskId,
        data,
    });
};

// Public classes to give access to the various proxies.
class PieGraph extends PieGraphProxy { }

ctx.addEventListener("message", (event: MessageEvent) => {
    const { taskId, data }: { taskId: number; data: IConsoleWorkerTaskData } = event.data;

    const print = (value: unknown): void => {
        if (typeof value !== "string") {
            value = JSON.stringify(value, null, "\t");
        }

        ctx.postContextMessage(taskId, {
            api: ScriptingApi.Print,
            contextId: data.contextId!,
            value,
        });
    };

    const runSql = (sql: string, callback?: (res: unknown) => void, params?: unknown): void => {
        if (callback) {
            ctx.pendingRequests.set(data.contextId!, callback);
        }

        ctx.postContextMessage(taskId, {
            api: ScriptingApi.RunSql,
            contextId: data.contextId!,
            code: sql,
            params,
        });
    };

    ctx.currentContext = data.contextId;
    ctx.currentTaskId = taskId;

    if (data.code) {
        let result = "";
        let isError = false;
        try {
            result = eval(data.code);
            if (typeof result === "object" || typeof result === "function" || Array.isArray(result)) {
                result = String(result);
            }
        } catch (error) {
            result = String(error);
            isError = true;
        }

        ctx.postContextMessage(taskId, {
            api: ScriptingApi.Result,
            contextId: data.contextId!,
            result,
            isError,
            final: true,
        });
    } else if (data.result) {
        // Query data sent back from the application.
        const callback = ctx.pendingRequests.get(data.contextId!);
        if (callback) {
            callback(data.result);
        } else if (data.final) {
            ctx.postContextMessage(taskId, {
                api: ScriptingApi.QueryStatus,
                contextId: data.contextId!,
                result: data.result,
                final: true,
            });
        }
    }
});
