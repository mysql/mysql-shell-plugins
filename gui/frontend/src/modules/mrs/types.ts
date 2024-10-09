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

import { IMrsLoginResult } from "./sdk/MrsBaseClasses.js";

/**
 * Defines the payload structure for the IServicePasswordRequest
 */
export interface IMrsAuthRequestPayload extends IMrsLoginResult {
    /** The authentication path of the service */
    authPath?: string;

    /** The name of the authApp to use */
    authApp?: string;

    /** The id of the calling context. */
    contextId?: string;

    /** The login result. */
    loginResult?: IMrsLoginResult;
}

export enum MrsSdkLanguage {
    TypeScript = "TypeScript"
}

export enum MrsObjectKind {
    Result = "RESULT",
    Parameters = "PARAMETERS",
}

export enum MrsDbObjectType {
    Table = "TABLE",
    View = "VIEW",
    Procedure = "PROCEDURE",
    Function = "FUNCTION",
    Script = "SCRIPT",

    Event = "EVENT", // Not yet supported by the backend.
}
