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

/** A type to describe arbitrary result data. */
export type ShellDictionaryType = string | number | boolean | undefined | unknown | null | IShellDictionary;
export interface IShellDictionary {
    [key: string]: ShellDictionaryType | ShellDictionaryType[];
}

/**
 * Describes the type of a dispatched event. Also used for event logging/debugging.
 */
export enum EventType {
    /** A request sent to the backend/server. */
    Request = -1,

    /** A response indicating that something went wrong. Ends the request processing. */
    ErrorResponse = -2,

    /** The first response send back, immediately after the BE has received a request. */
    StartResponse = 1,

    /** A response carrying result data. */
    DataResponse = 2,

    /** The response ending the current data stream (sequence of data responses). */
    FinalResponse = 3,

    /** The response indicating that the entire request was finished. */
    DoneResponse = 4,

    Notification = 4,

    Unknown = 0,
}

export enum ShellPromptResponseType {
    Ok = "OK",
    Cancel = "CANCEL"
}

export interface IRequestState {
    type: string;
    msg: string;
}

export interface IGenericResponse {
    requestId: string;
    requestState: IRequestState;

    eventType: EventType;
    done?: boolean;
}

export enum Protocol {
    UserAuthenticate = "authenticate",
    PromptReply = "prompt_reply",

}

export interface IPromptReplyBackend {
    sendReply: (requestId: string, type: ShellPromptResponseType, reply: string) => Promise<void>;
}
