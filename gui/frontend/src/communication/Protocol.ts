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

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

import { ListenerEntry } from "../supplement/Dispatch";
import { uuid } from "../utilities/helpers";

export type ShellDictionaryType = string | number | boolean | undefined | unknown | null | IShellDictionary;
export interface IShellDictionary {
    [key: string]: ShellDictionaryType | ShellDictionaryType[];
}

export enum ShellPromptResponseType {
    Ok = "OK",
    Cancel = "CANCEL"
}

// The request structure sent to the backend. That's why it uses snake case.
export interface IShellRequest extends IShellDictionary {
    request_id: string; // A unique ID to identify this request. It's used for all responses.
    request: string;    // The requested operation.

    command?: string;        // Optional field to carry the command if this is an execution request.
    args?: IShellDictionary; // Optional arguments for the command.
}

//  Begin auto generated types

//  End auto generated types

export class Protocol {

    public static getRequestCommandExecute(command: string, rest: IShellDictionary): IShellRequest {
        return Protocol.getStandardRequest("execute", { command, ...rest });
    }

    public static getRequestUsersAuthenticate(username: string, password: string): IShellRequest {
        return Protocol.getStandardRequest("authenticate", {
            username,
            password,
        });
    }

    public static getRequestPromptReply(request_id: string, type: ShellPromptResponseType, reply: string, moduleSessionId: string): IShellRequest {
        const result = Protocol.getStandardRequest("prompt_reply", {
            request_id,
            type,
            reply,
            module_session_id: moduleSessionId,
        });

        return result;
    }

    public static getStandardRequest(request: string, rest?: IShellDictionary): IShellRequest {
        return {
            request_id: uuid(),
            request,
            ...rest,
        };
    }
}

export interface IPromptReplyBackend {
    sendReply: (requestId: string, type: ShellPromptResponseType, reply: string) => ListenerEntry;
}
