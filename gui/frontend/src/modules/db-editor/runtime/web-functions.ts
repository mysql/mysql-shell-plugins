/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
import { print } from "./simple-functions.js";

export const webFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof window === "object") {
        return window.fetch(input, init);
    }

    return fetch(input, init);
};

export const mrsPrintSdkCode = (): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsPrintSdkCode,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsSetCurrentService = (serviceId: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsSetCurrentService,
            serviceId,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsEditService = (serviceId: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsEditService,
            serviceId,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsExportServiceSdk = (serviceId: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsExportServiceSdk,
            serviceId,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsAddContentSet = (serviceId: string, directory?: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsAddContentSet,
            serviceId,
            directory,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsSetServiceUrl = (serviceUrl: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsSetServiceUrl,
            serviceUrl,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsAuthenticate = (serviceUrl: string, authPath: string, authApp?: string, userName?: string): void => {
    print("Starting MRS authentication ...");

    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsAuthenticate,
            serviceUrl,
            authPath,
            authApp,
            userName,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsEditSchema = (schemaId: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsEditSchema,
            schemaId,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsEditDbObject = (dbObjectId: string): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsEditDbObject,
            dbObjectId,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};

export const mrsRefreshSdkCode = (): void => {
    currentWorker.postMessage?.({
        taskId: currentWorker.currentTaskId,
        data: {
            api: ScriptingApi.MrsRefreshSdkCode,
            contextId: currentWorker.currentContext,
            final: true,
        },
    });
};
