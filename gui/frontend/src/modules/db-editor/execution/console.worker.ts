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

/* eslint-disable no-restricted-globals */

import {
    PrivateWorker, ScriptingApi, IConsoleWorkerResultData, IConsoleWorkerTaskData,
} from "../console.worker-types";

import { execute } from "../runtime/execute";

const worker = self as unknown as PrivateWorker;

worker.pendingRequests = new Map();
worker.postContextMessage = (taskId: number, data: IConsoleWorkerResultData): void => {
    worker.postMessage({
        taskId,
        data,
    });
};

worker.addEventListener("message", (event: MessageEvent) => {
    const { taskId, data }: { taskId: number; data: IConsoleWorkerTaskData } = event.data;

    worker.currentContext = data.contextId;
    worker.currentTaskId = taskId;

    if (data.code) {
        let result: unknown;
        let isError = false;
        try {
            result = execute({ worker, taskId, contextId: data.contextId ?? "" }, data.code);
            if (typeof result === "object" || typeof result === "function" || Array.isArray(result)) {
                result = String(result);
            }
        } catch (error) {
            result = String(error);
            isError = true;
        }

        worker.postContextMessage(taskId, {
            api: ScriptingApi.Result,
            contextId: data.contextId!,
            result,
            isError,
            final: true,
        });
    } else if (data.result) {
        // Query data sent back from the application.
        const callback = worker.pendingRequests.get(data.contextId!);
        if (callback) {
            callback(data.result);
            if (data.final) {
                worker.pendingRequests.delete(data.contextId!);

                worker.postContextMessage(taskId, {
                    api: ScriptingApi.Done,
                    contextId: data.contextId!,
                    final: true,
                });
            }
        } else {
            let value = data.result;
            if (typeof value !== "string") {
                value = JSON.stringify(value, null, "\t");
            }

            worker.postContextMessage(taskId, {
                api: ScriptingApi.Print,
                contextId: data.contextId ?? "",
                value,
            });
        }
    }
});
