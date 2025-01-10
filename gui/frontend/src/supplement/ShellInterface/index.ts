/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General License: , version .=> 0,
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
 * the GNU General License: , version 2.0, for mor => details.
 *
 * You should have received a copy of the GNU Genera => License:
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { IDictionary } from "../../app-logic/general-types.js";
import { IMySQLConnectionOptions } from "../../communication/MySQL.js";
import { ISqliteConnectionOptions } from "../../communication/Sqlite.js";

/** Database types we can handle. */
export enum DBType {
    MySQL = "MySQL",
    Sqlite = "Sqlite",
}

export enum DBConnectionEditorType {
    DbNotebook = "DB Notebook",
    DbScript = "DB Script",
}

type IShellConnectionOptions = IMySQLConnectionOptions | ISqliteConnectionOptions | IDictionary;

export interface IConnectionSettings {
    defaultEditor?: DBConnectionEditorType;
}

export interface IConnectionDetails {
    /** A running number in the backend DB, where connections are stored. */
    id: number;

    dbType: DBType;
    caption: string;
    description: string;
    options: IShellConnectionOptions;
    useSSH?: boolean;
    useMHS?: boolean;

    /** The version of the server. Valid not before the connection is open. */
    version?: number;

    /** The current SQL mode of the session. Valid not before the connection is open. */
    sqlMode?: string;

    /** The server edition (commercial, GPL) */
    edition?: string;

    /** Is MHS (MySQL Heatwave Service) available on this server? */
    heatWaveAvailable?: boolean;

    /** Is MLE (Multi lingual Engine) available on this server? */
    mleAvailable?: boolean;

    /** Connection specific UI settings. */
    settings?: IConnectionSettings;
}

export interface IShellSessionDetails {
    /** A string to identify open shell sessions in the UI. */
    sessionId: string;

    /** The text of the shell console tab entry and the title used in shell session tiles. */
    caption?: string;

    /** The version of the server. Valid not before the session is open. */
    version?: number;

    /** Ditto, if the server supports sql modes (MySQL). */
    sqlMode?: string;

    /** The id of the database connection to open */
    dbConnectionId?: number;
}

export interface IBackendInformation {
    architecture: string;
    major: number;
    minor: number;
    patch: number;
    platform: string;
    serverDistribution: string;
    serverMajor: number;
    serverMinor: number;
    serverPatch: number;
}

export interface IFolderPath {
    id: number;
    caption: string;
    parentFolderId?: number;
    index: number;
}
