/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { WorkerPool } from "../../../supplement/WorkerPool";
import { IConsoleWorkerTaskData, IConsoleWorkerResultData } from "../console.worker-types";

/* eslint import/no-webpack-loader-syntax: off */
import ConsoleWorker from "worker-loader?filename=static/workers/[name].[contenthash].js!./console.worker";

/** A specialized worker pool for interactive console tasks. */
export class ExecutionWorkerPool extends WorkerPool<IConsoleWorkerTaskData, IConsoleWorkerResultData> {

    private static nextId = 0;

    protected createNewWorker(): ConsoleWorker {
        const worker = new ConsoleWorker();
        worker.id = "ew" + String(ExecutionWorkerPool.nextId++);

        return worker;
    }
}
