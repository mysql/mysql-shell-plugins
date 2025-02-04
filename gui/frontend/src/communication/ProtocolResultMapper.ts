/*
 * Copyright (c) 2022, 2025 Oracle and/or its affiliates.
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

import { Protocol } from "./Protocol.js";
import { IProtocolGuiResults, IShellProfile } from "./ProtocolGui.js";
import { IProtocolMdsResults } from "./ProtocolMds.js";
import { IProtocolMrsResults } from "./ProtocolMrs.js";
import { IProtocolMsmResults } from "./ProtocolMsm.js";

/** The mapping between an API name and the results sent by it (held in the `event.data` member). */
export interface IProtocolResults extends IProtocolGuiResults, IProtocolMdsResults, IProtocolMrsResults,
    IProtocolMsmResults {
    // For debugging only.
    "native": INativeShellResponse;

    [Protocol.UserAuthenticate]: { activeProfile: IShellProfile; };
    [Protocol.PromptReply]: {};
}
