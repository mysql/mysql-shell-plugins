/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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


import { PrivateWorker } from "../console.worker-types.js";
import { IDictionary } from "../../../app-logic/general-types.js";

/** This is a global var only in the current worker and used for all user-visible APIs. */
export let currentWorker!: PrivateWorker;

export class CodeExecutionError extends Error {
    public constructor(
        public override message: string,
        public override stack: string) {
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
 * @param globalScriptingObject The global object that should be made available to the evaluated code
 *
 * @returns whatever the evaluation returned.
 */
export const execute = async (worker: PrivateWorker, code: string,
    globalScriptingObject?: IDictionary): Promise<unknown> => {
    currentWorker = worker;

    /* eslint-disable @typescript-eslint/no-unused-vars */
    // Note: tree-shaking is disabled for this file in vite.config.ts to avoid optimizing out the
    //       "unused" imports.

    // APIs which are directly available in user code.
    const { runSql, runSqlIterative, runSqlWithCallback } = await import("./query.js");
    const { print, setGlobalScriptingObjectProperty } = await import("./simple-functions.js");

    const { webFetch: fetch } = await import("./web-functions.js");
    const { mrsPrintSdkCode, mrsSetCurrentService, mrsEditService, mrsExportServiceSdk, mrsSetServiceUrl,
        mrsAuthenticate, mrsEditSchema, mrsEditDbObject, mrsAddContentSet, mrsRefreshSdkCode,
    } = await import("./web-functions.js");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { GraphProxy: Graph } = await import("./GraphProxy.js");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { PieGraphProxy: PieGraph } = await import("./PieGraphProxy.js");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { PieGraphLayout } = await import("../console.worker-types.js");

    /* Define the variable $ as a proxy to the globalObject. This triggers the get/set functions of the proxy whenever
    a property of $ set or read. Use the set function to update the globalObject property.*/
    const $ = new Proxy<IDictionary>(globalScriptingObject ?? {}, {
        get: (obj, name) => {
            if (typeof name === "string" && Object.prototype.hasOwnProperty.call(obj, name)) {
                return obj[name];
            }
        },

        set: (obj, name, value): boolean => {
            if (typeof name === "string") {
                obj[name] = value;
                setGlobalScriptingObjectProperty(name, value);
            }

            return true;
        },
    });
    globalScriptingObject = undefined;

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

/**
 * There's no built-in way to test if a value is cloneable for use in postMessage.
 * Instead, we create a temporary message channel and see if that allows us to post the value.
 *
 * @param value The value to check.
 *
 * @returns true if the value is cloneable, false otherwise.
 */
export const isCloneable = (value: unknown): boolean => {
    try {
        new MessageChannel().port1.postMessage(value);

        return true;
    } catch (e) {
        return false;
    }
};
