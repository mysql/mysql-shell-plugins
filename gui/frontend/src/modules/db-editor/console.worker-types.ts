/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { IDictionary } from "../../app-logic/general-types.js";

/**
 * Define an own worker type to allow adding some private functionality.
 * However, Safari doesn't support the Worker type in worker code, so we have to repeat some definitions.
 */
export class PrivateWorker /*extends Worker*/ {
    public currentContext = "";
    public currentTaskId = -1;
    public pendingRequests = new Map<string, (res: unknown) => void>();

    /** Holds the inline source map, if one was found in the code to executed. */
    public sourceMap?: string;
    public libCodeLineNumbers = 0;

    public postContextMessage?: (taskId: number, message: IConsoleWorkerResultData) => void;

    /** Functions from Worker. */
    public postMessage?: (data: unknown, origin?: string) => void;
    public addEventListener?: <T extends Event>(message: string, callback: (event: T) => void) => void;
}

/**
 * API ids used in the communication between the scripting tab and its worker instance.
 * See also execute.ts.
 */
export enum ScriptingApi {
    /** Set when sending a task to a worker. */
    Request,

    // Results sent from a worker to the app.

    /** A status message without a result. */
    QueryStatus,

    /** To print something from the user. */
    Print,

    /** To set properties of the global object that is persisted between code blocks. */
    SetGlobalObjectProperty,

    /** Determine the type of a query. */
    QueryType,

    // Actions sent from a worker.

    /** A full query result + status. */
    Result,

    /** To execute an SQL statement. */
    RunSqlIterative,

    /** To execute an SQL statement and fetch a complete result set. */
    RunSql,

    /** A graph definition. */
    Graph,

    /** Prints the SDK code */
    MrsPrintSdkCode,

    /** Sets the current MRS service. */
    MrsSetCurrentService,

    /** Triggers the MRS service editor. */
    MrsEditService,

    /** Changes the MRS service URL. */
    MrsSetServiceUrl,

    /** Triggers a MRS authentication process to get the global MRS JWT. */
    MrsAuthenticate,

    /** Triggers the MRS schema editor. */
    MrsEditSchema,

    /** Triggers the MRS db object editor. */
    MrsEditDbObject,

    /** Trigger MRS SDK Export dialog */
    MrsExportServiceSdk,

    /** Trigger MRS Add Content Set dialog */
    MrsAddContentSet,

    /** Triggers an explicit update of the MRS SDK cache */
    MrsRefreshSdkCode,

    /** A special API to denote that everything is done in the console worker and the task can be removed. */
    Done,
}

export interface IConsoleWorkerTaskData {
    api: ScriptingApi;
    contextId?: string;

    libCodeLineNumbers?: number;
    code?: string;
    params?: unknown;
    result?: unknown;
    final?: boolean;

    globalScriptingObject?: IDictionary;
}

// TODO: make this union type for different APIs.
export interface IConsoleWorkerResultData extends IDictionary {
    api: ScriptingApi;
    contextId: string;

    /** True if this result is the last data block for the task. */
    final?: boolean;

    code?: string;
    params?: unknown;

    // Various result fields, depending on the executed API.
    result?: unknown;
    isError?: boolean;
    content?: unknown;
    value?: unknown;
    name?: string;

    // Graphs
    options?: IGraphOptions;

    // MRS
    serviceId?: string;
    serviceUrl?: string;
    authPath?: string;
    authApp?: string;
    userName?: string;
    directory?: string;
}

/** Same definition as in scripting-runtime.d.ts (modify in sync!). */
export enum PieGraphLayout {
    Donut,
    ThickDonut,
    ThinDonut,
    Pie,
}
