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

    /** A response indicating that an ongoing process was cancelled and did not end with either data or an error. */
    CancelResponse = -3,

    /** The first response sent back, immediately after the BE has received a request. */
    StartResponse = 1,

    /** A response carrying result data. */
    DataResponse = 2,

    /** The response ending the current data stream (sequence of data responses). */
    EndResponse = 3,

    /**
     * The response indicating that the entire request was finished. No other response will be sent for this
     * request.
     */
    FinalResponse = 4,

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

/** Defines a common interface for Shell prompt replies (implemented by different parts of the app). */
export interface IPromptReplyBackend {
    /**
     * Sends a reply to a prompt request.
     *
     * @param requestId The ID of the request to reply to.
     * @param type The type of the reply.
     * @param reply The reply data.
     * @param moduleSessionId The ID of the module session to send the reply to. Given only if the request is part of
     *                        a session opening process. Usually the module session id is returned from the start
     *                        session request.
     */
    sendReply: (requestId: string, type: ShellPromptResponseType, reply: string,
        moduleSessionId?: string) => Promise<void>;
}
