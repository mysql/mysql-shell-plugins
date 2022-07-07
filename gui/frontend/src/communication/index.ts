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

import { IDictionary } from "../app-logic/Types";

export * from "./Protocol";
export * from "./ProtocolGui";
export * from "./ProtocolMds";
export * from "./ProtocolMrs";

export * from "./MessageScheduler";
export * from "./GeneralEvents";
export * from "./OciEvents";
export * from "./Oci";

// Types for communication in various environments, like a browser, native platform wrappers or Visual Studio Code.

// Determines the origin of the message.
export type IEmbeddedSourceType =
    "app" | // The app itself.
    "host"  // The host where the app is embedded.
    ;

export interface IEmbeddedMessage {
    source: IEmbeddedSourceType;
    command: string;

    data?: IDictionary;
}
