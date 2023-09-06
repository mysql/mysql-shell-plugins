/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

export interface IConnAdvancedSqlite {
    params?: string;
}

export interface IConnSSL {
    mode?: string;
    ciphers?: string;
    caPath?: string;
    clientCertPath?: string;
    clientKeyPath?: string;
}

export interface IConnAdvanced {
    mode?: string;
    timeout?: number;
    compression?: string;
    compLevel?: string;
    compAlgorithms?: string;
    disableHW?: boolean;
}

export interface IConnMDS {
    profile?: string;
    sshPrivKey?: string;
    sshPubKey?: string;
    dbSystemOCID?: string;
    bastionOCID?: string;
}

export interface IDBConnection {
    dbType?: string;
    caption?: string;
    description?: string;
    basic?: IConnBasicMySQL | IConnBasicSqlite;
    ssl?: IConnSSL;
    advanced?: IConnAdvanced;
    mds?: IConnMDS;
}

export interface IRestServiceSettings {
    comments?: string;
    hostNameFilter?: string;
}

export interface IRestServiceAuthentication {
    authenticationPath?: string;
    redirectionUrl?: string;
    redirectionUrlValid?: string;
    authCompletedChangeCont?: string;
}

export interface IRestServiceAuthApps {
    vendor?: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    limitToRegisteredUsers?: boolean;
    appId?: string;
    accessToken?: string;
    customUrl?: string;
    customUrlForAccessToken?: string;
}

export interface IRestService {
    servicePath: string;
    enabled?: boolean;
    default?: boolean
    settings?: IRestServiceSettings;
    options?: string;
    authentication?: IRestServiceAuthentication;
    authenticationApps?: IRestServiceAuthApps;
}

export interface IRestSchema {
    restServicePath?: string;
    restSchemaPath?: string;
    enabled?: boolean;
    requiresAuth?: boolean;
    settings?: IRestSchemaSettings;
    options?: string;
}

export interface IRestSchemaSettings {
    schemaName?: string;
    itemsPerPage?: string;
    comments?: string;
}

export interface IRestObject {
    restServicePath?: string;
    restSchemaPath?: string;
    restObjectPath?: string;
    enabled?: boolean;
    requiresAuth?: boolean;
    jsonRelDuality?: IRestObjectJsonDual;
    settings?: IRestObjectSettings;
    authorization?: IRestObjectAuthorization;
    options?: string;
}

export interface IRestObjectJsonDual {
    dbObject?: string;
    sdkLanguange?: string;
    columns?: string[];
    crud?: string[];
}

export interface IRestObjectSettings {
    resultFormat?: string;
    itemsPerPage?: string;
    comments?: string;
    mediaType?: string;
    autoDetectMediaType?: boolean;
}

export interface IRestObjectAuthorization {
    enforceRowUserOwner?: boolean;
    rowOwnerShipField?: string;
    customStoredProcedure?: string;
}

export interface IRestAuthenticationApp {
    vendor: string;
    name: string;
    description?: string;
    accessToken?: string;
    appId?: string;
    customURL?: string;
    customURLforAccessToken?: string;
    defaultRole?: string;
    enabled?: boolean;
    limitToRegisteredUsers?: boolean;
}

export interface IRestUser {
    username: string;
    password: string;
    authenticationApp?: string;
    email?: string;
    assignedRoles?: string;
    userOptions?: string;
    permitLogin?: boolean;
    vendorUserId?: string;
    mappedUserId?: string;
}
