/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

/* eslint-disable max-classes-per-file */

import { PrivateWorker } from "../console.worker-types";

/** This is a global var only in the current worker and used for all user-visible APIs. */
export let currentWorker: PrivateWorker;

export class CodeExecutionError extends Error {
    public constructor(
        public message: string,
        public stack: string) {
        super(message);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, CodeExecutionError.prototype);
    }
}

/**
 * This function is the outer execution environment for JS/TS evaluation in SQL Notebooks.
 *
 * @param worker The worker details for the execution.
 * @param code The code to execute.
 *
 * @returns whatever the evaluation returned.
 */
export const execute = async (worker: PrivateWorker, code: string): Promise<unknown> => {
    currentWorker = worker;

    /* eslint-disable @typescript-eslint/no-unused-vars */
    // Note: tree-shaking is disabled for this file in vite.config.ts to avoid optimizing out the
    //       "unused" imports.

    // APIs which are directly available in user code.
    const { runSql, runSqlIterative } = await import("./query");
    const { print } = await import("./simple-functions");

    const { webFetch: fetch } = await import("./web-functions");
    const { mrsSetServiceUrl, mrsAuthenticate, mrsEditDbObject } = await import("./web-functions");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { GraphProxy: Graph } = await import("./GraphProxy");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { PieGraphProxy: PieGraph } = await import("./PieGraphProxy");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { PieGraphLayout } = await import("../console.worker-types");

    /* eslint-enable @typescript-eslint/no-unused-vars */

    try {
        // eslint-disable-next-line no-eval
        const res = eval(code);

        return Promise.resolve(res);
    } catch (e) {
        if (e instanceof Error) {
            const stack = e.stack;
            if (stack !== undefined) {
                throw new CodeExecutionError(e.message, stack);
            }
        }

        throw e;
    }
};
