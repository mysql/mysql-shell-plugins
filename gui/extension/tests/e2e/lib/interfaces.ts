/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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
import { ExTester } from "vscode-extension-tester";

export interface ITestConfig {
    DBUSERNAME1: string;
    DBPASSWORD1: string;
    DBUSERNAME2: string;
    DBPASSWORD2: string;
    OCI_QA_COMPARTMENT_PATH: string;
    TEST_RESOURCES_PATH: string;
    CODE_VERSION: string;
    DBROOTPASSWORD: string;
    OCI_E2E_USER: string;
    OCI_E2E_FINGERPRINT: string;
    OCI_E2E_TENANCY: string;
    OCI_E2E_REGION: string;
    OCI_HW_USER: string;
    OCI_HW_FINGERPRINT: string;
    OCI_HW_TENANCY: string;
    OCI_HW_REGION: string;
    DISABLE_TESTS: string;
    OCI_E2E_KEY_FILE_PATH: string;
    OCI_HW_KEY_FILE_PATH: string;
    HWHOSTNAME: string;
    HWUSERNAME: string;
    HWPASSWORD: string;
    HWPORT: string;
    OCI_BASTION_HOSTNAME: string;
    OCI_BASTION_USERNAME: string;
    OCI_BASTION_PASSWORD: string;
    EXTENSIONS_DIR: string | undefined;
    UNINSTALL_EXTENSION: string | undefined;
    MYSQLSH_OCI_CONFIG_FILE: string | undefined
    TEST_SUITE: string;
    SSL_CERTIFICATES_PATH: string | undefined;
    MYSQL_PORT_1107: string;
    MYSQL_PORT_1108: string;
    MYSQL_PORT_1109: string;
    MYSQL_PORT_1110: string;
}

export interface IE2ECli {
    testSuite?: string;
    extensionPath?: string;
    mysqlPort?: string;
    generateWebCertificate?: boolean;
    log?: boolean;
    sourceTestSuite?: string;
}

export interface IE2ETestSuite {
    name: string;
    testResources?: string;
    extensionDir?: string;
    exTester?: ExTester;
}

export interface IConnBasicMySQL {
    hostname?: string;
    protocol?: string;
    port?: number;
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

export interface IConnMDS {
    profile?: string;
    sshPrivateKey?: string;
    sshPublicKey?: string;
    dbSystemOCID?: string;
    bastionOCID?: string;
    dbSystemName?: string;
    bastionName?: string;
}

export interface IDBConnection {
    dbType?: string;
    caption?: string;
    description?: string;
    folderPath?: {
        new?: boolean;
        value?: string;
    };
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

export interface IRestServiceSettings {
    comments?: string;
}

export interface IRestServiceAuthentication {
    authenticationPath?: string;
    redirectionUrl?: string;
    redirectionUrlValid?: string;
    authCompletedChangeCont?: string;
}

export interface IRestService {
    servicePath: string;
    enabled?: boolean;
    default?: boolean;
    published?: boolean;
    settings?: IRestServiceSettings;
    options?: string;
    authentication?: IRestServiceAuthentication;
    advanced?: IRestServiceAdvanced;
    authenticationApps?: IRestAuthenticationApp[];
    restSchemas?: IRestSchema[];
}

export interface IRestServiceAdvanced {
    protocols?: string[];
}

export interface IRestSchema {
    restServicePath?: string;
    restSchemaPath?: string;
    accessControl?: string;
    requiresAuth?: boolean;
    settings?: IRestSchemaSettings;
    options?: string;
    restObjects?: IRestObject[];
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
    accessControl?: string;
    requiresAuth?: boolean;
    dataMapping?: IDataMapping;
    settings?: IRestObjectSettings;
    authorization?: IRestObjectAuthorization;
    options?: string;
}

export interface IDataMapping {
    dbObject?: string;
    sdkLanguage?: string;
    columns?: IRestObjectColumn[];
    crud?: IRestObjectCrud;
}

export interface IRestObjectCrud {
    insert: boolean | undefined;
    update: boolean | undefined;
    delete: boolean | undefined;
}

export interface IRestObjectColumn {
    name?: string;
    isSelected?: boolean;
    rowOwnership?: boolean;
    allowSorting?: boolean;
    preventFiltering?: boolean;
    preventUpdates?: boolean;
    excludeETAG?: boolean;
}

export interface IRestObjectSettings {
    resultFormat?: string;
    itemsPerPage?: string;
    comments?: string;
    mediaType?: string;
    autoDetectMediaType?: boolean;
}

export interface IRestObjectAuthorization {
    authStoredProcedure?: string;
}

export interface IRestAuthenticationApp {
    vendor: string;
    name: string;
    enabled?: boolean;
    limitToRegisteredUsers?: boolean;
    settings: {
        description?: string;
        defaultRole?: string;
    },
    oauth2settings?: {
        appId?: string;
        appSecret?: string;
        customURL?: string;
        customURLforAccessToken?: string;
    },
    options?: string;
    user?: IRestUser[];
}

export interface IRestUser {
    username: string;
    password?: string;
    authenticationApp?: string;
    email?: string;
    assignedRoles?: string;
    userOptions?: string;
    permitLogin?: boolean;
    vendorUserId?: string;
    mappedUserId?: string;
}

export interface ITreeDBConnection {
    name: string;
    isMySQL: boolean;
}

export interface ICurrentEditor {
    label: string;
    icon: string;
}

export interface IOciProfileConfig {
    name: string;
    user?: string;
    fingerprint?: string;
    tenancy?: string;
    region?: string;
    keyFile?: string;
}

export interface ICommandResultToolbar {
    status?: string;
    setStatus(): Promise<void>;
    maximize(): Promise<void>;
    selectView(name: string): Promise<void>;
    selectSqlPreview(): Promise<void>;
    applyChanges(): Promise<void>;
    refresh(): Promise<void>;
    rollbackChanges(): Promise<void>;
    closeResultSet(): Promise<void>;
    untilStatusMatches(regex: RegExp): Condition<boolean>;
    getEditButton(): Promise<WebElement | undefined>;
    edit(): Promise<void>;
}

export interface ICommandResultPreview {
    text: string;
    link: WebElement;
}

export interface ICommandResultTab {
    name: string;
    element: WebElement;
}

export interface IExportMrsSdk {
    directory: string;
    url: string;
    apiLanguage: string;
    appBaseClass: string;
    sdkFileHeader: string;
}

export interface IResultGridCell {
    rowNumber?: number;
    columnName: string;
    value: string | boolean | number;
}

export interface INewLoadingTask {
    name?: string;
    description?: string;
    targetDatabaseSchema?: string;
    formats?: string;
}

export interface ILakeHouseTable {
    tableName?: string;
    hasProgressBar?: boolean;
    loaded?: string;
    hasLoadingSpinner?: boolean;
    rows?: string;
    size?: string;
    date?: string;
    comment?: string;
}

export interface ICurrentTask {
    name?: string;
    hasProgressBar?: boolean;
    status?: string;
    startTime?: string;
    endTime?: string;
    message?: string;
}

export interface IHeatWaveProfileHistory {
    userMessage?: string;
    chatBotOptions?: string;
}

export interface IHeatWaveProfileMatchedDocument {
    title?: string;
    segment?: string;
}

export interface IOption {
    name: string;
    value: string;
}

export interface IRestServiceConfig {
    status?: string;
    currentVersion?: string;
    updateToVersion?: string;
    authentication?: {
        createDefaultApp?: boolean;
        username?: string;
        password?: string;
    },
    authenticationThrottling?: {
        preAccountThrottling?: {
            minTimeBetweenRequests?: string;
            maxAttemptsPerMinute?: string;
        },
        perHostThrottling?: {
            minTimeBetweenRequests?: string;
            maxAttemptsPerMinute?: string;
        },
        throttlingGeneral?: {
            blockTimeout?: string;
        },
    };
    caches?: {
        endPointResponseCache?: string;
        staticFileCache?: string;
        gtidCache?: boolean;
        refreshRate?: string;
        refreshWhenIncreased?: string;
    }
    redirectsStaticContent?: {
        endPointResponseCacheOptions?: IOption[];
        defaultRedirects?: IOption[];
    };
    options?: string;
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
