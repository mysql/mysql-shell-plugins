/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

// This file contains all interfaces describing response types for the various shell APIs.

import { IShellDictionary } from "./Protocol";
import { ShellAPIGui } from "./ProtocolGui";
import { ShellAPIMrs } from "./ProtocolMrs";
import { IMrsDbObjectParameterData } from "./ShellParameterTypes";

/**
 * This interface contains the combined fields from the separate profile add/update APIs, plus the userId field
 *  which we need internally. The userId is never sent as part of a profile record to the backend.
 */
export interface IShellProfile {
    id: number;
    userId: number;
    name: string;
    description: string;
    options: IShellDictionary;
}

export interface IWebSessionData {
    requestState: { msg: string };
    sessionUuid?: string;
    localUserMode: boolean;
    activeProfile: IShellProfile;
}

export interface IAuthenticationData {
    activeProfile: IShellProfile;
}

export interface IShellBackendInformation {
    architecture: string;
    major: string;
    minor: string;
    patch: string;
    platform: string;
    serverDistribution: string;
    serverMajor: string;
    serverMinor: string;
    serverPatch: string;
}

export interface IOpenConnectionData {
    currentSchema?: string;
    info: {
        sqlMode?: string;
        version?: string;
        edition?: string;
        heatWaveAvailable?: boolean;
    };
    result?: IShellResultType;
}

export interface IMrsStatusData {
    enabled: boolean;
    serviceConfigured: boolean;
    serviceEnabled: boolean;
    serviceCount: number;
}

export interface IMdsProfileData {
    fingerprint: string;
    keyFile: string;
    profile: string;
    region: string;
    tenancy: string;
    user: string;
    isCurrent: boolean;
}

export interface IMrsDbObjectData {
    changedAt?: string;
    comments: string;
    crudOperations: string[];
    crudOperationFormat: string;
    dbSchemaId: number;
    enabled: number;
    hostCtx?: string;
    id: number;
    itemsPerPage?: number;
    name: string;
    objectType: string;
    requestPath: string;
    requiresAuth: number;
    rowUserOwnershipColumn?: string;
    rowUserOwnershipEnforced: number;
    schemaRequestPath?: string;
    qualifiedName?: string;
    serviceId: number;
    mediaType?: string;
    autoDetectMediaType: number;
    authStoredProcedure?: string;
    options?: string;
    parameters?: IMrsDbObjectParameterData[];
}

export interface IMrsContentSetData {
    comments: string;
    enabled: number;
    hostCtx: string;
    id: number;
    requestPath: string;
    requiresAuth: number;
    serviceId: number;
    options: string;
}

export interface IMrsContentFileData {
    id: number;
    contentSetId: number;
    requestPath: string;
    requiresAuth: boolean;
    enabled: boolean;
    size: number;
    contentSetRequestPath: string;
    hostCtx: string;
    changedAt: string;
}

export interface IMrsAddContentSetData {
    contentSetId?: number;
    numberOfFilesUploaded?: number;
    info?: string;
}

export interface IShellModuleDataEntry {
    id: number;
    dataCategoryId: number;
    caption: string;
}

export interface IDBDataTreeEntry {
    id: number;
    caption: string;
    parentFolderId: number;
}

export interface IShellModuleDataCategoriesEntry {
    id: number;
    name: string;
    parentCategoryId?: number;
}

export interface IMrsServiceData {
    enabled: number;
    hostCtx: string;
    id: number;
    isDefault: number;
    urlContextRoot: string;
    urlHostName: string;
    urlProtocol: string;
    comments: string;
    options: string;
    authPath: string;
    authCompletedUrl: string;
    authCompletedUrlValidation: string;
    authCompletedPageContent: string;
    authApps?: IMrsAuthAppData[];
}

export interface IMrsAuthAppData {
    id?: number;
    authVendorId?: number;
    authVendorName?: string;
    serviceId?: number;
    name?: string;
    description?: string;
    url?: string;
    urlDirectAuth?: string;
    accessToken?: string;
    appId?: string;
    enabled: boolean;
    useBuiltInAuthorization: boolean;
    limitToRegisteredUsers: boolean;
    defaultAuthRoleId?: number;
}

export interface IMrsAuthVendorData {
    id?: number;
    name: string;
    validationUrl?: string;
    enabled: boolean;
    comments?: string;
}

export interface IMrsSchemaData {
    comments: string;
    enabled: number;
    hostCtx: string;
    id: number;
    itemsPerPage: number;
    name: string;
    requestPath: string;
    requiresAuth: number;
    serviceId: number;
    options?: string;
}

export interface IShellPromptValues {
    promptDescriptor?: {
        user?: string;
        host?: string;
        port?: number;
        schema?: string;
        isProduction?: boolean; // If true we are on a production server.
        ssl?: string;
        socket?: string;
        session?: string;       // classic or X protocol.
        mode?: string;
    };
}

export interface IShellDocumentWarning {
    level: "Note" | "Warning" | "Error";
    code: number;
    message: string;
}

export interface IShellResultData extends IShellPromptValues {
    hasData: boolean;
    affectedRowCount?: number;
    executionTime: string;
    affectedItemsCount: number;
    warningCount: number;
    warningsCount: number;
    warnings: IShellDocumentWarning[];
    info: string;
    autoIncrementValue: number;
}

export interface IShellDocumentData extends IShellResultData {
    documents: unknown[];
}

export interface IDbEditorResultSetData {
    executionTime?: number;
    rows?: unknown[];
    columns?: Array<{ name: string; type: string; length: number }>;
    totalRowCount?: number;
}

/**
 * The members of this record come with pascal case naming, which is not processed by our snake-to-camel
 * case processing. So for now we define this with the original names here, until this is fixed.
 */
/* eslint-disable @typescript-eslint/naming-convention */
export interface IShellColumnMetadataEntry {
    Name: string;
    OrgName: string;
    Catalog: string;
    Database: string;
    Table: string;
    OrgTable: string;
    Type: string;
    DbType: string;
    Collation: string;
    Length: number;
    Decimals: number;
    Flags: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface IShellColumnsMetaData {
    [key: string]: IShellColumnMetadataEntry;
}

export interface IShellRowData extends IShellResultData {
    rows: unknown[];
}

export interface IShellSimpleResult extends IShellPromptValues {
    info?: string;
    error?: string | { message: string; type: string };
    warning?: string;
    note?: string;
    status?: string;
}

export interface IShellValueResult extends IShellPromptValues {
    value: string | number;
}

export interface IShellObjectResult extends IShellPromptValues {
    class: string;
    name: string;
}

/**
 * Defines the common fields for all shell prompt requests.
 */
export interface IShellBaseFeedbackRequest {
    /** The request text to show. This is usually the question the user answers. */
    prompt: string;

    /** A custom title for the request dialog. */
    title?: string;

    /** Defines some context for the actual feedback request. It is a string list where every item is a paragraph. */
    description?: string[];
}

/**
 * Defines a simple text feedback request.
 */
export interface IShellTextFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "text";
}

/**
 * Defines a confirmation feedback request. Used for simple yes/no/alt questions.
 * Note: the yes/no/alt fields may contain shortcut markup (by prefixing a letter with &).
 */
export interface IShellConfirmFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "confirm";

    /** If given this defines the text for the accept option. Use "Yes" otherwise. */
    yes?: string;

    /** If given this defines the text for the deny option. Use "No" otherwise. */
    no?: string;

    /** If given this defines the text for an alternative option. Otherwise show nothing for this field. */
    alt?: string;

    /**
     * Defines which of the values above is to be marked as default and can also be selected using the <enter> key.
     */
    defaultValue?: string;
}

/**
 * Defines a selection feedback request, which allows the user to pick one option from a list.
 */
export interface IShellSelectFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "select";

    /** The elements of the selection list. */
    options: string[];

    /**
     * Defines the index of the option in the list above, which should be marked as the default and
     * represents the initial value to be shown in the UI, so it can be taken over with a single click/<enter>.
     */
    defaultValue?: number;
}

export interface IShellDirectoryFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "directory";

    defaultValue?: string;
}

// cspell: ignore filesave, fileopen

export interface IShellFileSaveFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "filesave";

    defaultValue?: string;
}

export interface IShellFileOpenFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "fileopen";

    defaultValue?: string;
}

export interface IShellPasswordFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "password";
}

/**
 * This interface represents input requests from the BE.
 */
export type IShellFeedbackRequest =
    IShellTextFeedbackRequest
    | IShellConfirmFeedbackRequest
    | IShellSelectFeedbackRequest
    | IShellDirectoryFeedbackRequest
    | IShellFileSaveFeedbackRequest
    | IShellFileOpenFeedbackRequest
    | IShellPasswordFeedbackRequest;

/** The collection of all possible result types. */
export type IShellResultType =
    IShellFeedbackRequest
    | IShellObjectResult
    | IShellObjectResult[]
    | IShellValueResult
    | IShellSimpleResult
    | IShellDocumentData
    | IShellRowData
    | IShellColumnsMetaData
    ;

// Begin autogenerated multi result type.

/** A list of APIs that return more than a single result. */
export const multiResultAPIs = [
    ShellAPIGui.GuiCoreListFiles,
    ShellAPIGui.GuiDbGetSchemaObjectNames,
    ShellAPIGui.GuiDbconnectionsListDbConnections,
    ShellAPIGui.GuiModulesGetProfileDataTree,
    ShellAPIMrs.MrsListServices,
    ShellAPIMrs.MrsListSchemas,
    ShellAPIGui.GuiShellComplete,
    ShellAPIGui.GuiSqleditorExecute,
] as const;

// End autogenerated multi result type.
