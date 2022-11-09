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

import { IDictionary } from "../app-logic/Types";
import { IShellDictionary } from "./Protocol";

// This file contains all interfaces describing request parameter types for the various shell APIs.

// Begin auto generated types

export interface IShellDbConnection {
    dbType: string | null;
    caption: string | null;
    description: string | null;
    options: IDictionary | null;
}

export interface IShellQueryOptions {
    rowPacketSize?: number;
}

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

export interface IShellListConfigProfilesKwargs {
    configFilePath?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellSetCurrentCompartmentKwargs {
    compartmentPath?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    profileName?: string;
    cliRcFilePath?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellGetCurrentCompartmentIdKwargs {
    compartmentId?: string;
    config?: IShellDictionary;
    profileName?: string;
    cliRcFilePath?: string;
}

export interface IShellSetCurrentBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    profileName?: string;
    cliRcFilePath?: string;
    raiseExceptions?: boolean;
    interactive?: boolean;
}


export interface IShellGetAvailabilityDomainKwargs {
    availabilityDomain?: string;
    randomSelection?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListCompartmentsKwargs {
    compartmentId?: string;
    includeTenancy?: boolean;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}

export interface IShellGetCompartmentKwargs {
    parentCompartmentId?: string;
    config?: object;
    interactive?: boolean;
}

export interface IShellListComputeInstancesKwargs {
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellGetComputeInstanceKwargs {
    instanceName?: string;
    instanceId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListComputeShapesKwargs {
    limitShapesTo?: unknown[];
    availabilityDomain?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellDeleteComputeInstanceKwargs {
    instanceName?: string;
    instanceId?: string;
    awaitDeletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUtilHeatWaveLoadDataKwargs {
    schemas?: unknown[];
    mode?: string;
    output?: string;
    disableUnsupportedColumns?: boolean;
    optimizeLoadParallelism?: boolean;
    enableMemoryCheck?: boolean;
    sqlMode?: string;
    excludeList?: string;
    moduleSessionId?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUtilCreateMdsEndpointKwargs {
    instanceName?: string;
    dbSystemName?: string;
    dbSystemId?: string;
    privateKeyFilePath?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
}


export interface IShellGetDbSystemConfigurationKwargs {
    configName?: string;
    configurationId?: string;
    shape?: string;
    availabilityDomain?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListDbSystemShapesKwargs {
    isSupportedFor?: string;
    availabilityDomain?: string;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}


export interface IShellListDbSystemsKwargs {
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IShellGetDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
    returnFormatted?: boolean;
    returnPythonObject?: boolean;
}

export interface IShellGetDbSystemIdKwargs {
    dbSystemName?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

export interface IShellUpdateDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    newName?: string;
    newDescription?: string;
    newFreeformTags?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellCreateDbSystemKwargs {
    dbSystemName?: string;
    description?: string;
    availabilityDomain?: string;
    shape?: string;
    subnetId?: string;
    configurationId?: string;
    dataStorageSizeInGbs?: number;
    mysqlVersion?: string;
    adminUsername?: string;
    adminPassword?: string;
    privateKeyFilePath?: string;
    parUrl?: string;
    performCleanupAfterImport?: boolean;
    sourceMysqlUri?: string;
    sourceMysqlPassword?: string;
    sourceLocalDumpDir?: string;
    sourceBucket?: string;
    hostImageId?: string;
    definedTags?: IShellDictionary;
    freeformTags?: IShellDictionary;
    compartmentId?: string;
    config?: object;
    interactive?: boolean;
    returnObject?: boolean;
}


export interface IShellDeleteDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStopDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStartDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellRestartDbSystemKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStopHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellStartHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellRestartHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellCreateHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    clusterSize?: number;
    shapeName?: string;
    awaitCompletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellUpdateHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    ignoreCurrent?: boolean;
    clusterSize?: number;
    shapeName?: string;
    awaitCompletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellDeleteHeatWaveClusterKwargs {
    dbSystemName?: string;
    dbSystemId?: string;
    awaitCompletion?: boolean;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListLoadBalancersKwargs {
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellListBastionsKwargs {
    compartmentId?: string;
    validForDbSystemId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellGetBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    awaitState?: string;
    ignoreCurrent?: boolean;
    fallbackToAnyInCompartment?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellCreateBastionKwargs {
    bastionName?: string;
    dbSystemId?: string;
    clientCidr?: string;
    maxSessionTtlInSeconds?: number;
    targetSubnetId?: string;
    awaitActiveState?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellDeleteBastionKwargs {
    bastionName?: string;
    bastionId?: string;
    awaitDeletion?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}


export interface IShellListBastionSessionsKwargs {
    bastionId?: string;
    ignoreCurrent?: boolean;
    compartmentId?: string;
    config?: object;
    configProfile?: string;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellGetBastionSessionKwargs {
    sessionName?: string;
    sessionId?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellCreateBastionSessionKwargs {
    bastionName?: string;
    bastionId?: string;
    fallbackToAnyInCompartment?: boolean;
    sessionType?: string;
    sessionName?: string;
    targetId?: string;
    targetIp?: string;
    targetPort?: string;
    targetUser?: string;
    ttlInSeconds?: number;
    publicKeyFile?: string;
    publicKeyContent?: string;
    awaitCreation?: boolean;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    returnType?: string;
    raiseExceptions?: boolean;
}


export interface IShellDeleteBastionSessionKwargs {
    sessionName?: string;
    sessionId?: string;
    bastionName?: string;
    bastionId?: string;
    compartmentId?: string;
    config?: IShellDictionary;
    configProfile?: string;
    ignoreCurrent?: boolean;
    interactive?: boolean;
    raiseExceptions?: boolean;
}

//  End auto generated types
