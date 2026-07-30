/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 */

declare interface INativeShellDictionary {
    [key: string]: string | number | boolean | undefined | INativeShellDictionary[] | INativeShellDictionary;
}

/** A raw request sent through the desktop stdio bridge. */
declare interface INativeShellRequest extends INativeShellDictionary {
    request_id: string;
    request: string;
    command?: string;
    args?: INativeShellDictionary;
}

/** A raw response received through the desktop stdio bridge. */
declare interface INativeShellResponse extends INativeShellDictionary {
    request_id: string;
    request_state: {
        type: string;
        msg: string;
    };
}

/** API made available to Communication Debugger scripts by the desktop bridge. */
declare const ws: {
    isConnected: boolean;
    lastResponse?: unknown;
    send: (request: INativeShellRequest) => Promise<INativeShellResponse>;
    execute: (request: INativeShellRequest) => Promise<INativeShellResponse>;
};
