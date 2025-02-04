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

/// <reference path="../components/CommunicationDebugger/debugger-runtime.d.ts"/>

/* eslint-disable max-len */

import { Protocol, ShellPromptResponseType } from "./Protocol.js";
import { IProtocolGuiParameters } from "./ProtocolGui.js";
import { IProtocolMdsParameters } from "./ProtocolMds.js";
import { IProtocolMrsParameters } from "./ProtocolMrs.js";
import { IProtocolMsmParameters } from "./ProtocolMsm.js";

// This file contains all interfaces describing response types for the various shell APIs.

/** The mapping between an API name and the accepted parameters for it. */
export interface IProtocolParameters extends IProtocolGuiParameters, IProtocolMdsParameters, IProtocolMrsParameters,
    IProtocolMsmParameters {
    // For debugging only.
    "native": INativeShellRequest;

    [Protocol.UserAuthenticate]: { username: string; password: string; };
    [Protocol.PromptReply]: { requestId: string; type: ShellPromptResponseType; reply: string; moduleSessionId: string; };
}
