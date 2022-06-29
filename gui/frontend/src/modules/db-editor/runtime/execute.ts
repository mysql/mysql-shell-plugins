/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IConsoleWorkerEnvironment } from "../console.worker-types";
import { runSqlImpl, runSqlIterativeImpl } from "./query";
import { GraphProxy } from "./GraphProxy";
import { printImpl } from "./simple-functions";
import { PieGraphProxy } from "./PieGraphProxy";

/**
 * This function is the outer execution environment for JS/TS evaluation in SQL Notebooks.
 *
 * @param env Values that define the environment in which the execution happens.
 * @param code The code to execute.
 *
 * @returns whatever the evaluation returned.
 */
export const execute = async (env: IConsoleWorkerEnvironment, code: string): Promise<unknown> => {
    /* eslint-disable @typescript-eslint/no-unused-vars */

    // APIs which are directly available in user code.
    const print = printImpl.bind(undefined, env);
    const runSqlIterative = runSqlIterativeImpl.bind(undefined, env);
    const runSql = runSqlImpl.bind(undefined, env);

    class Graph extends GraphProxy { }
    GraphProxy.env = env;

    class PieGraph extends PieGraphProxy { }
    PieGraphProxy.env = env;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { PieGraphLayout } = await import("../console.worker-types");

    /* eslint-enable @typescript-eslint/no-unused-vars */

    // eslint-disable-next-line no-eval
    return Promise.resolve(eval(code));
};
