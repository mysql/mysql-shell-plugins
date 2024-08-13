/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { WebElement, Condition } from "selenium-webdriver";
import { CommandResultGrid } from "./CommandResultGrid.js";

export interface ICommandResult {
    id?: string;
    text?: string;
    json?: string;
    graph?: WebElement;
    tabs?: ICommandResultTab[];
    grid?: CommandResultGrid;
    preview?: ICommandResultPreview;
    toolbar?: ICommandResultToolbar;
    context?: WebElement;
    chat?: string;
    isHWAboutInfo?: boolean;
    copyToClipboard(): Promise<void>;
    selectTab(name: string): Promise<void>;
    clickSqlPreviewContent(): Promise<void>;
    normalize(): Promise<void>;
    untilIsMaximized(): Condition<boolean>;
    heatWaveChatIsDisplayed(): Condition<boolean>;
}

export interface ICurrentEditor {
    label: string;
    icon: string;
}

export interface ICommandResultToolbar {
    status?: string;
    setStatus(): Promise<void>;
    maximize(): Promise<void>;
    selectView(name: string): Promise<void>;
    selectSqlPreview(): Promise<void>;
    applyChanges(): Promise<void>;
    rollbackChanges(): Promise<void>;
    closeResultSet(): Promise<void>;
    untilStatusMatches(regex: RegExp): Condition<boolean>;
    getEditButton(): Promise<WebElement | undefined>;
    edit(): Promise<void>;
}

export interface ICommandResultTab {
    name: string;
    element: WebElement;
}

export interface ICommandResultPreview {
    text: string;
    link: WebElement;
}

export interface ICommandResultIdHolder {
    id?: string;
    suite?: string;
}

export interface IDBConnection {
    dbType?: string;
    caption?: string;
    description?: string;
    basic?: IConnBasicMySQL | IConnBasicSqlite;
    ssl?: IConnSSL;
    advanced?: IConnAdvancedMySQL | IConnAdvancedSqlite;
    ssh?: IConnSSH;
    mds?: IConnMDS;
}

export interface IConnSSH {
    uri: string;
    privateKey: string;
    customPath: string;
}

export interface IConnMDS {
    profile?: string;
    sshPrivateKey?: string;
    sshPublicKey?: string;
    dbSystemOCID?: string;
    bastionOCID?: string;
    dbSystemName?: string;
    bastionName?: string;
}

export interface IConnBasicMySQL {
    hostname?: string;
    protocol?: string;
    port?: number;
    portX?: number;
    username?: string;
    password?: string;
    schema?: string;
    sshTunnel?: boolean;
    ociBastion?: boolean;
}

export interface IConnBasicSqlite {
    dbPath?: string;
    dbName?: string;
    advanced?: IConnAdvancedSqlite;
}

export interface IConnSSL {
    mode?: string;
    ciphers?: string;
    caPath?: string;
    clientCertPath?: string;
    clientKeyPath?: string;
}

export interface IConnAdvancedMySQL {
    mode?: {
        ansi: boolean,
        traditional: boolean,
        allowInvalidDates: boolean,
        ansiQuotes: boolean,
        errorForDivisionByZero: boolean,
        highNotPrecedence: boolean,
        ignoreSpace: boolean,
        noAutoValueOnZero: boolean,
        noUnsignedSubtraction: boolean,
        noZeroDate: boolean,
        noZeroInDate: boolean,
        onlyFullGroupBy: boolean,
        padCharToFullLength: boolean,
        pipesAsConcat: boolean,
        realAsFloat: boolean,
        strictAllTables: boolean,
        strictTransTables: boolean,
        timeTruncateFractional: boolean,
    };
    timeout?: string;
    compression?: string;
    compressionLevel?: string;
    compressionAlgorithms?: string;
    disableHeatWave?: boolean;
}

export interface IConnAdvancedSqlite {
    params?: string;
}

export interface IResultGridCell {
    rowNumber?: number;
    columnName: string;
    value: string | boolean | number;
}

export interface INotification {
    id: string;
    type: string;
    message: string;
    webElement?: WebElement;
}

export const isMySQLConnection = (obj: unknown): obj is IConnBasicMySQL => {
    return (obj as IConnBasicMySQL).hostname !== undefined;
};

export const isSQLiteConnection = (obj: unknown): obj is IConnBasicSqlite => {
    return (obj as IConnBasicSqlite).dbName !== undefined;
};

export const isAdvancedMySQL = (obj: unknown): obj is IConnAdvancedMySQL => {
    return (obj as IConnAdvancedMySQL).mode !== undefined;
};

export const isAdvancedSqlite = (obj: unknown): obj is IConnAdvancedSqlite => {
    return (obj as IConnAdvancedSqlite).params !== undefined;
};
