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

/* eslint-disable max-len */

/* eslint-disable max-len */

export enum ShellAPIMrs {
    //  Begin auto generated API names
    MrsAddService = "mrs.add.service",
    MrsGetService = "mrs.get.service",
    MrsListServices = "mrs.list.services",
    MrsEnableService = "mrs.enable.service",
    MrsDisableService = "mrs.disable.service",
    MrsDeleteService = "mrs.delete.service",
    MrsSetServiceDefault = "mrs.set.service.default",
    MrsSetServiceContextPath = "mrs.set.service.context_path",
    MrsSetServiceProtocol = "mrs.set.service.protocol",
    MrsSetServiceComments = "mrs.set.service.comments",
    MrsSetServiceOptions = "mrs.set.service.options",
    MrsUpdateService = "mrs.update.service",
    MrsGetServiceRequestPathAvailability = "mrs.get.service_request_path_availability",
    MrsAddSchema = "mrs.add.schema",
    MrsGetSchema = "mrs.get.schema",
    MrsListSchemas = "mrs.list.schemas",
    MrsEnableSchema = "mrs.enable.schema",
    MrsDisableSchema = "mrs.disable.schema",
    MrsDeleteSchema = "mrs.delete.schema",
    MrsSetSchemaName = "mrs.set.schema.name",
    MrsSetSchemaRequestPath = "mrs.set.schema.request_path",
    MrsSetSchemaRequiresAuth = "mrs.set.schema.requires_auth",
    MrsSetSchemaItemsPerPage = "mrs.set.schema.items_per_page",
    MrsSetSchemaComments = "mrs.set.schema.comments",
    MrsUpdateSchema = "mrs.update.schema",
    MrsAddContentSet = "mrs.add.content_set",
    MrsListContentSets = "mrs.list.content_sets",
    MrsGetContentSet = "mrs.get.content_set",
    MrsEnableContentSet = "mrs.enable.content_set",
    MrsDisableContentSet = "mrs.disable.content_set",
    MrsDeleteContentSet = "mrs.delete.content_set",
    MrsAddDbObject = "mrs.add.db_object",
    MrsGetDbObject = "mrs.get.db_object",
    MrsGetDbObjectRowOwnershipFields = "mrs.get.db_object_row_ownership_fields",
    MrsGetDbObjectFields = "mrs.get.db_object_fields",
    MrsListDbObjects = "mrs.list.db_objects",
    MrsGetDbObjectParameters = "mrs.get.db_object_parameters",
    MrsSetDbObjectRequestPath = "mrs.set.db_object.request_path",
    MrsSetDbObjectCrudOperations = "mrs.set.db_object.crud_operations",
    MrsEnableDbObject = "mrs.enable.db_object",
    MrsDisableDbObject = "mrs.disable.db_object",
    MrsDeleteDbObject = "mrs.delete.db_object",
    MrsUpdateDbObject = "mrs.update.db_object",
    MrsListContentFiles = "mrs.list.content_files",
    MrsGetAuthenticationVendors = "mrs.get.authentication_vendors",
    MrsAddAuthenticationApp = "mrs.add.authentication_app",
    MrsListAuthenticationApps = "mrs.list.authentication_apps",
    MrsInfo = "mrs.info",
    MrsVersion = "mrs.version",
    MrsLs = "mrs.ls",
    MrsConfigure = "mrs.configure",
    MrsStatus = "mrs.status",
    //  End auto generated API names
}

// Begin auto generated types

export interface IShellAddServiceKwargs {
    urlProtocol?: unknown[];
    isDefault?: boolean;
    comments?: string;
    options?: string;
    authPath?: string;
    authCompletedUrl?: string;
    authCompletedUrlValidation?: string;
    authCompletedPageContent?: string;
    authApps?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellGetServiceKwargs {
    getDefault?: boolean;
    autoSelectSingle?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellListServicesKwargs {
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellEnableServiceKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDisableServiceKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDeleteServiceKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetServiceDefaultKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetServiceContextPathKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    value?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetServiceProtocolKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    value?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetServiceCommentsKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    value?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellSetServiceOptionsKwargs {
    urlContextRoot?: string;
    urlHostName?: string;
    value?: string;
    serviceId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellUpdateServiceKwargs {
    serviceId?: number;
    urlContextRoot?: string;
    urlHostName?: string;
    urlProtocol?: unknown[];
    enabled?: boolean;
    comments?: string;
    options?: string;
    authPath?: string;
    authCompletedUrl?: string;
    authCompletedUrlValidation?: string;
    authCompletedPageContent?: string;
    authApps?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellGetServiceRequestPathAvailabilityKwargs {
    serviceId?: number;
    requestPath?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellAddSchemaKwargs {
    schemaName?: string;
    serviceId?: number;
    requestPath?: string;
    requiresAuth?: boolean;
    enabled?: boolean;
    itemsPerPage?: number;
    comments?: string;
    options?: string;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellGetSchemaKwargs {
    requestPath?: string;
    schemaName?: string;
    schemaId?: number;
    serviceId?: number;
    autoSelectSingle?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListSchemasKwargs {
    serviceId?: number;
    includeEnableState?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellEnableSchemaKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDisableSchemaKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDeleteSchemaKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetSchemaNameKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    value?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetSchemaRequestPathKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    value?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetSchemaRequiresAuthKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    value?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetSchemaItemsPerPageKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    value?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellSetSchemaCommentsKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    value?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellUpdateSchemaKwargs {
    schemaName?: string;
    serviceId?: number;
    schemaId?: number;
    requestPath?: string;
    requiresAuth?: boolean;
    enabled?: boolean;
    itemsPerPage?: number;
    comments?: string;
    options?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellAddContentSetKwargs {
    contentDir?: string;
    serviceId?: number;
    requestPath?: string;
    requiresAuth?: boolean;
    comments?: string;
    enabled?: boolean;
    options?: string;
    replaceExisting?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListContentSetsKwargs {
    includeEnableState?: boolean;
    requestPath?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellGetContentSetKwargs {
    contentSetId?: number;
    serviceId?: number;
    autoSelectSingle?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellEnableContentSetKwargs {
    serviceId?: number;
    contentSetId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellDisableContentSetKwargs {
    serviceId?: number;
    contentSetId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellDeleteContentSetKwargs {
    serviceId?: number;
    contentSetId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellAddDbObjectKwargs {
    dbObjectName?: string;
    dbObjectType?: string;
    schemaId?: number;
    schemaName?: string;
    autoAddSchema?: boolean;
    requestPath?: string;
    enabled?: boolean;
    crudOperations?: unknown[];
    crudOperationFormat?: string;
    requiresAuth?: boolean;
    itemsPerPage?: number;
    rowUserOwnershipEnforced?: boolean;
    rowUserOwnershipColumn?: string;
    comments?: string;
    mediaType?: string;
    autoDetectMediaType?: boolean;
    authStoredProcedure?: string;
    options?: string;
    parameters?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IMrsDbObjectParameterData {
    id?: number;
    dbObjectId?: number;
    position: number;
    name: string;
    bindColumnName: string;
    datatype: string;
    mode: string;
    comments?: string;
}

export interface IShellGetDbObjectKwargs {
    dbObjectId?: number;
    schemaId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellGetDbObjectRowOwnershipFieldsKwargs {
    dbObjectId?: number;
    schemaId?: number;
    schemaName?: string;
    dbObjectType?: string;
    moduleSessionId?: string;
    interactive?: boolean;
}

export interface IShellGetDbObjectFieldsKwargs {
    dbObjectId?: number;
    schemaId?: number;
    schemaName?: string;
    dbObjectType?: string;
    moduleSessionId?: string;
    interactive?: boolean;
}

export interface IShellListDbObjectsKwargs {
    schemaId?: number;
    includeEnableState?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellGetDbObjectParametersKwargs {
    dbObjectId?: number;
    schemaId?: number;
    schemaName?: string;
    moduleSessionId?: string;
    interactive?: boolean;
}

export interface IShellSetDbObjectRequestPathKwargs {
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellSetDbObjectCrudOperationsKwargs {
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellEnableDbObjectKwargs {
    dbObjectId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellDisableDbObjectKwargs {
    dbObjectId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellDeleteDbObjectKwargs {
    dbObjectId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
}

export interface IShellUpdateDbObjectKwargs {
    dbObjectId?: number;
    dbObjectName?: string;
    schemaId?: number;
    requestPath?: string;
    name?: string;
    enabled?: boolean;
    crudOperations?: unknown[];
    crudOperationFormat?: string;
    requiresAuth?: boolean;
    itemsPerPage?: number;
    autoDetectMediaType?: boolean;
    rowUserOwnershipEnforced?: boolean;
    rowUserOwnershipColumn?: string;
    comments?: string;
    mediaType?: string;
    authStoredProcedure?: string;
    options?: string;
    parameters?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IShellListContentFilesKwargs {
    contentSetId?: number;
    includeEnableState?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellGetAuthenticationVendorsKwargs {
    enabled?: boolean;
    moduleSessionId?: string;
    raiseExceptions?: boolean;
}

export interface IShellAddAuthenticationAppKwargs {
    appName?: string;
    serviceId?: number;
    authVendorId?: string;
    description?: string;
    url?: string;
    urlDirectAuth?: string;
    accessToken?: string;
    appId?: string;
    limitToRegisteredUsers?: boolean;
    useBuiltInAuthorization?: boolean;
    registeredUsers?: string;
    defaultAuthRoleId?: number;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListAuthenticationAppsKwargs {
    includeEnableState?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellConfigureKwargs {
    enableMrs?: boolean;
    moduleSessionId?: string;
    interactive?: boolean;
}


export interface IShellStatusKwargs {
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


//  End auto generated types

/** The mapping between an MRS module API name and the accepted parameters for it. */
export interface IProtocolMrsParameters {
    [ShellAPIMrs.MrsAddService]: { args: { urlContextRoot?: string; urlHostName?: string; enabled?: boolean }; kwargs?: IShellAddServiceKwargs };
    [ShellAPIMrs.MrsGetService]: { args: { urlContextRoot?: string; urlHostName?: string; serviceId?: number }; kwargs?: IShellGetServiceKwargs };
    [ShellAPIMrs.MrsListServices]: { kwargs?: IShellListServicesKwargs };
    [ShellAPIMrs.MrsEnableService]: { kwargs?: IShellEnableServiceKwargs };
    [ShellAPIMrs.MrsDisableService]: { kwargs?: IShellDisableServiceKwargs };
    [ShellAPIMrs.MrsDeleteService]: { kwargs?: IShellDeleteServiceKwargs };
    [ShellAPIMrs.MrsSetServiceDefault]: { kwargs?: IShellSetServiceDefaultKwargs };
    [ShellAPIMrs.MrsSetServiceContextPath]: { kwargs?: IShellSetServiceContextPathKwargs };
    [ShellAPIMrs.MrsSetServiceProtocol]: { kwargs?: IShellSetServiceProtocolKwargs };
    [ShellAPIMrs.MrsSetServiceComments]: { kwargs?: IShellSetServiceCommentsKwargs };
    [ShellAPIMrs.MrsSetServiceOptions]: { kwargs?: IShellSetServiceOptionsKwargs };
    [ShellAPIMrs.MrsUpdateService]: { kwargs?: IShellUpdateServiceKwargs };
    [ShellAPIMrs.MrsGetServiceRequestPathAvailability]: { kwargs?: IShellGetServiceRequestPathAvailabilityKwargs };
    [ShellAPIMrs.MrsAddSchema]: { kwargs?: IShellAddSchemaKwargs };
    [ShellAPIMrs.MrsGetSchema]: { kwargs?: IShellGetSchemaKwargs };
    [ShellAPIMrs.MrsListSchemas]: { kwargs?: IShellListSchemasKwargs };
    [ShellAPIMrs.MrsEnableSchema]: { kwargs?: IShellEnableSchemaKwargs };
    [ShellAPIMrs.MrsDisableSchema]: { kwargs?: IShellDisableSchemaKwargs };
    [ShellAPIMrs.MrsDeleteSchema]: { kwargs?: IShellDeleteSchemaKwargs };
    [ShellAPIMrs.MrsSetSchemaName]: { kwargs?: IShellSetSchemaNameKwargs };
    [ShellAPIMrs.MrsSetSchemaRequestPath]: { kwargs?: IShellSetSchemaRequestPathKwargs };
    [ShellAPIMrs.MrsSetSchemaRequiresAuth]: { kwargs?: IShellSetSchemaRequiresAuthKwargs };
    [ShellAPIMrs.MrsSetSchemaItemsPerPage]: { kwargs?: IShellSetSchemaItemsPerPageKwargs };
    [ShellAPIMrs.MrsSetSchemaComments]: { kwargs?: IShellSetSchemaCommentsKwargs };
    [ShellAPIMrs.MrsUpdateSchema]: { kwargs?: IShellUpdateSchemaKwargs };
    [ShellAPIMrs.MrsAddContentSet]: { kwargs?: IShellAddContentSetKwargs };
    [ShellAPIMrs.MrsListContentSets]: { args: { serviceId?: number }; kwargs?: IShellListContentSetsKwargs };
    [ShellAPIMrs.MrsGetContentSet]: { args: { requestPath?: string }; kwargs?: IShellGetContentSetKwargs };
    [ShellAPIMrs.MrsEnableContentSet]: { kwargs?: IShellEnableContentSetKwargs };
    [ShellAPIMrs.MrsDisableContentSet]: { kwargs?: IShellDisableContentSetKwargs };
    [ShellAPIMrs.MrsDeleteContentSet]: { kwargs?: IShellDeleteContentSetKwargs };
    [ShellAPIMrs.MrsAddDbObject]: { kwargs?: IShellAddDbObjectKwargs };
    [ShellAPIMrs.MrsGetDbObject]: { args: { requestPath?: string; dbObjectName?: string }; kwargs?: IShellGetDbObjectKwargs };
    [ShellAPIMrs.MrsGetDbObjectRowOwnershipFields]: { args: { requestPath?: string; dbObjectName?: string }; kwargs?: IShellGetDbObjectRowOwnershipFieldsKwargs };
    [ShellAPIMrs.MrsGetDbObjectFields]: { args: { requestPath?: string; dbObjectName?: string }; kwargs?: IShellGetDbObjectFieldsKwargs };
    [ShellAPIMrs.MrsListDbObjects]: { kwargs?: IShellListDbObjectsKwargs };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { args: { requestPath?: string; dbObjectName?: string }; kwargs?: IShellGetDbObjectParametersKwargs };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: { args: { dbObjectId?: number; requestPath?: string }; kwargs?: IShellSetDbObjectRequestPathKwargs };
    [ShellAPIMrs.MrsSetDbObjectCrudOperations]: { args: { dbObjectId?: number; crudOperations?: unknown[]; crudOperationFormat?: string }; kwargs?: IShellSetDbObjectCrudOperationsKwargs };
    [ShellAPIMrs.MrsEnableDbObject]: { args: { dbObjectName?: string; schemaId?: number }; kwargs?: IShellEnableDbObjectKwargs };
    [ShellAPIMrs.MrsDisableDbObject]: { args: { dbObjectName?: string; schemaId?: number }; kwargs?: IShellDisableDbObjectKwargs };
    [ShellAPIMrs.MrsDeleteDbObject]: { args: { dbObjectName?: string; schemaId?: number }; kwargs?: IShellDeleteDbObjectKwargs };
    [ShellAPIMrs.MrsUpdateDbObject]: { kwargs?: IShellUpdateDbObjectKwargs };
    [ShellAPIMrs.MrsListContentFiles]: { kwargs?: IShellListContentFilesKwargs };
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { kwargs?: IShellGetAuthenticationVendorsKwargs };
    [ShellAPIMrs.MrsAddAuthenticationApp]: { kwargs?: IShellAddAuthenticationAppKwargs };
    [ShellAPIMrs.MrsListAuthenticationApps]: { args: { serviceId?: number }; kwargs?: IShellListAuthenticationAppsKwargs };
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: { args: { path?: string; moduleSessionId?: string } };
    [ShellAPIMrs.MrsConfigure]: { kwargs?: IShellConfigureKwargs };
    [ShellAPIMrs.MrsStatus]: { kwargs?: IShellStatusKwargs };
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

export interface IMrsStatusData {
    enabled: boolean;
    serviceConfigured: boolean;
    serviceEnabled: boolean;
    serviceCount: number;
}

export interface IProtocolMrsResults {
    // Begin auto generated API result mappings.
    [ShellAPIMrs.MrsAddService]: {};
    [ShellAPIMrs.MrsGetService]: {};
    [ShellAPIMrs.MrsListServices]: { result: IMrsServiceData[] };
    [ShellAPIMrs.MrsEnableService]: {};
    [ShellAPIMrs.MrsDisableService]: {};
    [ShellAPIMrs.MrsDeleteService]: {};
    [ShellAPIMrs.MrsSetServiceDefault]: {};
    [ShellAPIMrs.MrsSetServiceContextPath]: {};
    [ShellAPIMrs.MrsSetServiceProtocol]: {};
    [ShellAPIMrs.MrsSetServiceComments]: {};
    [ShellAPIMrs.MrsSetServiceOptions]: {};
    [ShellAPIMrs.MrsUpdateService]: {};
    [ShellAPIMrs.MrsGetServiceRequestPathAvailability]: { result: boolean };
    [ShellAPIMrs.MrsAddSchema]: { result: number };
    [ShellAPIMrs.MrsGetSchema]: {};
    [ShellAPIMrs.MrsListSchemas]: { result: IMrsSchemaData[] };
    [ShellAPIMrs.MrsEnableSchema]: {};
    [ShellAPIMrs.MrsDisableSchema]: {};
    [ShellAPIMrs.MrsDeleteSchema]: {};
    [ShellAPIMrs.MrsSetSchemaName]: {};
    [ShellAPIMrs.MrsSetSchemaRequestPath]: {};
    [ShellAPIMrs.MrsSetSchemaRequiresAuth]: {};
    [ShellAPIMrs.MrsSetSchemaItemsPerPage]: {};
    [ShellAPIMrs.MrsSetSchemaComments]: {};
    [ShellAPIMrs.MrsUpdateSchema]: {};
    [ShellAPIMrs.MrsAddContentSet]: { result: IMrsAddContentSetData };
    [ShellAPIMrs.MrsListContentSets]: { result: IMrsContentSetData[] };
    [ShellAPIMrs.MrsGetContentSet]: {};
    [ShellAPIMrs.MrsEnableContentSet]: {};
    [ShellAPIMrs.MrsDisableContentSet]: {};
    [ShellAPIMrs.MrsDeleteContentSet]: {};
    [ShellAPIMrs.MrsAddDbObject]: { result: number };
    [ShellAPIMrs.MrsGetDbObject]: {};
    [ShellAPIMrs.MrsGetDbObjectRowOwnershipFields]: { result: string[] };
    [ShellAPIMrs.MrsGetDbObjectFields]: { result: IMrsDbObjectParameterData[] };
    [ShellAPIMrs.MrsListDbObjects]: { result: IMrsDbObjectData[] };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { result: IMrsDbObjectParameterData[] };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: {};
    [ShellAPIMrs.MrsSetDbObjectCrudOperations]: {};
    [ShellAPIMrs.MrsEnableDbObject]: {};
    [ShellAPIMrs.MrsDisableDbObject]: {};
    [ShellAPIMrs.MrsDeleteDbObject]: {};
    [ShellAPIMrs.MrsUpdateDbObject]: {};
    [ShellAPIMrs.MrsListContentFiles]: { result: IMrsContentFileData[] };
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { result: IMrsAuthVendorData[] };
    [ShellAPIMrs.MrsAddAuthenticationApp]: {};
    [ShellAPIMrs.MrsListAuthenticationApps]: { result: IMrsAuthAppData[] };
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: {};
    [ShellAPIMrs.MrsConfigure]: {};
    [ShellAPIMrs.MrsStatus]: { result: IMrsStatusData };

    // End auto generated API result mappings.
}
