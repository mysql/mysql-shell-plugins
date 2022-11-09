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

/// <reference path="../components/CommunicationDebugger/debugger-runtime.d.ts"/>

/* eslint-disable max-len */

import { IShellDictionary, Protocol, ShellPromptResponseType } from "./Protocol";
import { ShellAPIGui } from "./ProtocolGui";
import { ShellAPIMds } from "./ProtocolMds";
import { ShellAPIMrs } from "./ProtocolMrs";
import {
    IShellAddAuthenticationAppKwargs, IShellAddContentSetKwargs, IShellAddDbObjectKwargs, IShellAddSchemaKwargs,
    IShellAddServiceKwargs, IShellConfigureKwargs, IShellCreateBastionKwargs, IShellCreateBastionSessionKwargs,
    IShellCreateDbSystemKwargs, IShellCreateHeatWaveClusterKwargs, IShellDbConnection, IShellDeleteBastionKwargs,
    IShellDeleteBastionSessionKwargs, IShellDeleteComputeInstanceKwargs, IShellDeleteContentSetKwargs,
    IShellDeleteDbObjectKwargs, IShellDeleteDbSystemKwargs, IShellDeleteHeatWaveClusterKwargs, IShellDeleteSchemaKwargs,
    IShellDeleteServiceKwargs, IShellDisableContentSetKwargs, IShellDisableDbObjectKwargs, IShellDisableSchemaKwargs,
    IShellDisableServiceKwargs, IShellEnableContentSetKwargs, IShellEnableDbObjectKwargs, IShellEnableSchemaKwargs,
    IShellEnableServiceKwargs, IShellGetAuthenticationVendorsKwargs, IShellGetAvailabilityDomainKwargs, IShellGetBastionKwargs, IShellGetBastionSessionKwargs,
    IShellGetCompartmentKwargs, IShellGetComputeInstanceKwargs, IShellGetContentSetKwargs, IShellGetCurrentCompartmentIdKwargs, IShellGetDbObjectFieldsKwargs,
    IShellGetDbObjectKwargs, IShellGetDbObjectParametersKwargs,
    IShellGetDbObjectRowOwnershipFieldsKwargs, IShellGetDbSystemConfigurationKwargs, IShellGetDbSystemIdKwargs,
    IShellGetDbSystemKwargs, IShellGetSchemaKwargs, IShellGetServiceKwargs, IShellGetServiceRequestPathAvailabilityKwargs,
    IShellListAuthenticationAppsKwargs,
    IShellListBastionSessionsKwargs, IShellListBastionsKwargs, IShellListCompartmentsKwargs,
    IShellListComputeInstancesKwargs, IShellListComputeShapesKwargs, IShellListConfigProfilesKwargs,
    IShellListContentFilesKwargs, IShellListContentSetsKwargs, IShellListDbObjectsKwargs,
    IShellListDbSystemShapesKwargs, IShellListDbSystemsKwargs, IShellListLoadBalancersKwargs,
    IShellListSchemasKwargs, IShellListServicesKwargs, IShellQueryOptions, IShellRestartDbSystemKwargs,
    IShellRestartHeatWaveClusterKwargs, IShellSetCurrentBastionKwargs, IShellSetCurrentCompartmentKwargs,
    IShellSetDbObjectCrudOperationsKwargs, IShellSetDbObjectRequestPathKwargs, IShellSetSchemaCommentsKwargs,
    IShellSetSchemaItemsPerPageKwargs, IShellSetSchemaNameKwargs, IShellSetSchemaRequestPathKwargs,
    IShellSetSchemaRequiresAuthKwargs, IShellSetServiceCommentsKwargs, IShellSetServiceContextPathKwargs,
    IShellSetServiceDefaultKwargs, IShellSetServiceOptionsKwargs, IShellSetServiceProtocolKwargs, IShellStartDbSystemKwargs,
    IShellStartHeatWaveClusterKwargs, IShellStatusKwargs, IShellStopDbSystemKwargs, IShellStopHeatWaveClusterKwargs,
    IShellUpdateDbObjectKwargs,
    IShellUpdateDbSystemKwargs, IShellUpdateHeatWaveClusterKwargs, IShellUpdateSchemaKwargs, IShellUpdateServiceKwargs,
    IShellUtilCreateMdsEndpointKwargs,
    IShellUtilHeatWaveLoadDataKwargs,
} from "./ShellParameterTypes";

// This file contains all interfaces describing response types for the various shell APIs.

/** The mapping between an API name and the accepted parameters for it. */
export interface IProtocolParameters {
    // For debugging only.
    "native": INativeShellRequest;

    [Protocol.UserAuthenticate]: { username: string; password: string };
    [Protocol.PromptReply]: { requestId: string; type: ShellPromptResponseType; reply: string; moduleSessionId: string };

    // Begin auto generated API parameter mappings.
    [ShellAPIGui.GuiClusterIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiCoreSetLogLevel]: { args: { logLevel: string } };
    [ShellAPIGui.GuiCoreGetLogLevel]: {};
    [ShellAPIGui.GuiCoreListFiles]: { args: { path: string } };
    [ShellAPIGui.GuiCoreCreateFile]: { args: { path: string } };
    [ShellAPIGui.GuiCoreValidatePath]: { args: { path: string } };
    [ShellAPIGui.GuiCoreGetBackendInformation]: {};
    [ShellAPIGui.GuiCoreIsShellWebCertificateInstalled]: { kwargs?: { checkKeychain?: boolean } };
    [ShellAPIGui.GuiCoreInstallShellWebCertificate]: { kwargs?: { keychain?: boolean; replaceExisting?: boolean } };
    [ShellAPIGui.GuiCoreRemoveShellWebCertificate]: {};
    [ShellAPIGui.GuiDbconnectionsAddDbConnection]: { args: { profileId: number; connection: IShellDbConnection; folderPath: string } };
    [ShellAPIGui.GuiDbconnectionsUpdateDbConnection]: { args: { profileId: number; connectionId: number; connection: IShellDbConnection; folderPath: string } };
    [ShellAPIGui.GuiDbconnectionsRemoveDbConnection]: { args: { profileId: number; connectionId: number } };
    [ShellAPIGui.GuiDbconnectionsListDbConnections]: { args: { profileId: number; folderPath: string } };
    [ShellAPIGui.GuiDbconnectionsGetDbConnection]: { args: { dbConnectionId: number } };
    [ShellAPIGui.GuiDbconnectionsGetDbTypes]: {};
    [ShellAPIGui.GuiDbconnectionsSetCredential]: { args: { url: string; password: string } };
    [ShellAPIGui.GuiDbconnectionsDeleteCredential]: { args: { url: string } };
    [ShellAPIGui.GuiDbconnectionsListCredentials]: {};
    [ShellAPIGui.GuiDbconnectionsTestConnection]: { args: { connection: IShellDbConnection | number; password?: string } };
    [ShellAPIGui.GuiDbconnectionsMoveConnection]: { args: { profileId: number; folderPath: string; connectionIdToMove: number; connectionIdOffset: number; before: boolean } };
    [ShellAPIGui.GuiMdsIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiModelerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiShellGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellStartSession]: { args: { dbConnectionId?: number; shellArgs?: unknown[] } };
    [ShellAPIGui.GuiShellCloseSession]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiShellExecute]: { args: { command: string; moduleSessionId: string } };
    [ShellAPIGui.GuiShellComplete]: { args: { data: string; offset: number; moduleSessionId: string } };
    [ShellAPIGui.GuiShellKillTask]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiDbGetObjectsTypes]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiDbGetCatalogObjectNames]: { args: { moduleSessionId: string; type: string; filter?: string } };
    [ShellAPIGui.GuiDbGetSchemaObjectNames]: { args: { moduleSessionId: string; type: string; schemaName: string; filter?: string; routineType?: string } };
    [ShellAPIGui.GuiDbGetTableObjectNames]: { args: { moduleSessionId: string; type: string; schemaName: string; tableName: string; filter?: string } };
    [ShellAPIGui.GuiDbGetCatalogObject]: { args: { moduleSessionId: string; type: string; name: string } };
    [ShellAPIGui.GuiDbGetSchemaObject]: { args: { moduleSessionId: string; type: string; schemaName: string; name: string } };
    [ShellAPIGui.GuiDbGetTableObject]: { args: { moduleSessionId: string; type: string; schemaName: string; tableName: string; name: string } };
    [ShellAPIGui.GuiDbStartSession]: { args: { connection: IShellDbConnection | number; password?: string } };
    [ShellAPIGui.GuiDbCloseSession]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiDbReconnect]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiSqleditorGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiSqleditorStartSession]: {};
    [ShellAPIGui.GuiSqleditorCloseSession]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorOpenConnection]: { args: { dbConnectionId: number; moduleSessionId: string; password?: string } };
    [ShellAPIGui.GuiSqleditorReconnect]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorExecute]: { args: { moduleSessionId: string; sql: string; params?: unknown[]; options?: IShellQueryOptions } };
    [ShellAPIGui.GuiSqleditorKillQuery]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorGetCurrentSchema]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorSetCurrentSchema]: { args: { moduleSessionId: string; schemaName: string } };
    [ShellAPIGui.GuiSqleditorGetAutoCommit]: { args: { moduleSessionId: string } };
    [ShellAPIGui.GuiSqleditorSetAutoCommit]: { args: { moduleSessionId: string; state: boolean } };
    [ShellAPIGui.GuiUsersCreateUser]: { username: string; password: string; role?: string; allowedHosts?: string };
    [ShellAPIGui.GuiUsersSetAllowedHosts]: { args: { userId: number; allowedHosts: string } };
    [ShellAPIGui.GuiUsersDeleteUser]: { args: { username: string } };
    [ShellAPIGui.GuiUsersGrantRole]: { args: { username: string; role: string } };
    [ShellAPIGui.GuiUsersGetUserId]: { args: { username: string } };
    [ShellAPIGui.GuiUsersListUsers]: {};
    [ShellAPIGui.GuiUsersListUserRoles]: { args: { username: string } };
    [ShellAPIGui.GuiUsersListRoles]: {};
    [ShellAPIGui.GuiUsersListRolePrivileges]: { args: { role: string } };
    [ShellAPIGui.GuiUsersListUserPrivileges]: { args: { username: string } };
    [ShellAPIGui.GuiUsersGetGuiModuleList]: { args: { userId: number } };
    [ShellAPIGui.GuiUsersListProfiles]: { args: { userId: number } };
    [ShellAPIGui.GuiUsersGetProfile]: { args: { profileId: number } };
    [ShellAPIGui.GuiUsersUpdateProfile]: { args: { profile: { id?: number; name?: string; description?: string; options?: IShellDictionary } } };
    [ShellAPIGui.GuiUsersAddProfile]: { args: { userId: number; profile: { name?: string; description?: string; options?: IShellDictionary } } };
    [ShellAPIGui.GuiUsersDeleteProfile]: { args: { userId: number; profileId: number } };
    [ShellAPIGui.GuiUsersGetDefaultProfile]: { args: { userId: number } };
    [ShellAPIGui.GuiUsersSetDefaultProfile]: { args: { userId: number; profileId: number } };
    [ShellAPIGui.GuiUsersSetCurrentProfile]: { args: { profileId: number } };
    [ShellAPIGui.GuiUsersListUserGroups]: { args: { memberId?: number } };
    [ShellAPIGui.GuiUsersCreateUserGroup]: { args: { name: string; description: string } };
    [ShellAPIGui.GuiUsersAddUserToGroup]: { memberId: number; groupId: number; owner: number };
    [ShellAPIGui.GuiUsersRemoveUserFromGroup]: { args: { memberId: number; groupId: number } };
    [ShellAPIGui.GuiUsersUpdateUserGroup]: { args: { groupId: number; name?: string; description?: string } };
    [ShellAPIGui.GuiUsersRemoveUserGroup]: { args: { groupId: number } };
    [ShellAPIGui.GuiDebuggerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiDebuggerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiDebuggerGetScripts]: {};
    [ShellAPIGui.GuiDebuggerGetScriptContent]: { args: { path: string } };
    [ShellAPIGui.GuiModulesAddData]: { args: { caption: string; content: string; dataCategoryId: number; treeIdentifier: string; folderPath?: string; profileId?: number } };
    [ShellAPIGui.GuiModulesListData]: { args: { folderId: number; dataCategoryId?: number } };
    [ShellAPIGui.GuiModulesGetDataContent]: { args: { id: number } };
    [ShellAPIGui.GuiModulesShareDataToUserGroup]: { args: { id: number; userGroupId: number; readOnly: number; treeIdentifier: string; folderPath?: string } };
    [ShellAPIGui.GuiModulesAddDataToProfile]: { args: { id: number; profileId: number; readOnly: number; treeIdentifier: string; folderPath?: string } };
    [ShellAPIGui.GuiModulesUpdateData]: { args: { id: number; caption?: string; content?: string } };
    [ShellAPIGui.GuiModulesDeleteData]: { args: { id: number; folderId: number } };
    [ShellAPIGui.GuiModulesListDataCategories]: { args: { categoryId?: number } };
    [ShellAPIGui.GuiModulesAddDataCategory]: { args: { name: string; parentCategoryId?: number } };
    [ShellAPIGui.GuiModulesRemoveDataCategory]: { args: { categoryId: number } };
    [ShellAPIGui.GuiModulesGetDataCategoryId]: { args: { name: string } };
    [ShellAPIGui.GuiModulesCreateProfileDataTree]: { args: { treeIdentifier: string; profileId?: number } };
    [ShellAPIGui.GuiModulesGetProfileDataTree]: { args: { treeIdentifier: string; profileId?: number } };
    [ShellAPIGui.GuiModulesCreateUserGroupDataTree]: { args: { treeIdentifier: string; userGroupId?: number } };
    [ShellAPIGui.GuiModulesGetUserGroupDataTree]: { args: { treeIdentifier: string; userGroupId?: number } };
    [ShellAPIGui.GuiModulesGetProfileTreeIdentifiers]: { args: { profileId: number } };
    [ShellAPIGui.GuiModulesMoveData]: { args: { id: number; treeIdentifier: string; linkedTo: string; linkId: number; sourcePath: string; targetPath: string } };
    [ShellAPIGui.GuiInfo]: {};
    [ShellAPIGui.GuiVersion]: {};

    // MDS
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { kwargs?: IShellListConfigProfilesKwargs };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: { args: { profileName?: string; configFileLocation?: string; cliRcFileLocation?: string } };
    [ShellAPIMds.MdsGetDefaultConfigProfile]: { args: { cliRcFileLocation?: string } };
    [ShellAPIMds.MdsSetCurrentCompartment]: { kwargs?: IShellSetCurrentCompartmentKwargs };
    [ShellAPIMds.MdsGetCurrentCompartmentId]: { kwargs?: IShellGetCurrentCompartmentIdKwargs };
    [ShellAPIMds.MdsSetCurrentBastion]: { kwargs?: IShellSetCurrentBastionKwargs };
    [ShellAPIMds.MdsGetAvailabilityDomain]: { kwargs?: IShellGetAvailabilityDomainKwargs };
    [ShellAPIMds.MdsListCompartments]: { kwargs?: IShellListCompartmentsKwargs };
    [ShellAPIMds.MdsGetCompartment]: { args: { compartmentPath?: string }; kwargs?: IShellGetCompartmentKwargs };
    [ShellAPIMds.MdsListComputeInstances]: { kwargs?: IShellListComputeInstancesKwargs };
    [ShellAPIMds.MdsGetComputeInstance]: { kwargs?: IShellGetComputeInstanceKwargs };
    [ShellAPIMds.MdsListComputeShapes]: { kwargs?: IShellListComputeShapesKwargs };
    [ShellAPIMds.MdsDeleteComputeInstance]: { kwargs?: IShellDeleteComputeInstanceKwargs };
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: { kwargs?: IShellUtilHeatWaveLoadDataKwargs };
    [ShellAPIMds.MdsUtilCreateMdsEndpoint]: { kwargs?: IShellUtilCreateMdsEndpointKwargs };
    [ShellAPIMds.MdsGetDbSystemConfiguration]: { kwargs?: IShellGetDbSystemConfigurationKwargs };
    [ShellAPIMds.MdsListDbSystemShapes]: { kwargs?: IShellListDbSystemShapesKwargs };
    [ShellAPIMds.MdsListDbSystems]: { kwargs?: IShellListDbSystemsKwargs };
    [ShellAPIMds.MdsGetDbSystem]: { kwargs?: IShellGetDbSystemKwargs };
    [ShellAPIMds.MdsGetDbSystemId]: { kwargs?: IShellGetDbSystemIdKwargs };
    [ShellAPIMds.MdsUpdateDbSystem]: { kwargs?: IShellUpdateDbSystemKwargs };
    [ShellAPIMds.MdsCreateDbSystem]: { kwargs?: IShellCreateDbSystemKwargs };
    [ShellAPIMds.MdsDeleteDbSystem]: { kwargs?: IShellDeleteDbSystemKwargs };
    [ShellAPIMds.MdsStopDbSystem]: { kwargs?: IShellStopDbSystemKwargs };
    [ShellAPIMds.MdsStartDbSystem]: { kwargs?: IShellStartDbSystemKwargs };
    [ShellAPIMds.MdsRestartDbSystem]: { kwargs?: IShellRestartDbSystemKwargs };
    [ShellAPIMds.MdsStopHeatWaveCluster]: { kwargs?: IShellStopHeatWaveClusterKwargs };
    [ShellAPIMds.MdsStartHeatWaveCluster]: { kwargs?: IShellStartHeatWaveClusterKwargs };
    [ShellAPIMds.MdsRestartHeatWaveCluster]: { kwargs?: IShellRestartHeatWaveClusterKwargs };
    [ShellAPIMds.MdsCreateHeatWaveCluster]: { kwargs?: IShellCreateHeatWaveClusterKwargs };
    [ShellAPIMds.MdsUpdateHeatWaveCluster]: { kwargs?: IShellUpdateHeatWaveClusterKwargs };
    [ShellAPIMds.MdsDeleteHeatWaveCluster]: { kwargs?: IShellDeleteHeatWaveClusterKwargs };
    [ShellAPIMds.MdsListLoadBalancers]: { kwargs?: IShellListLoadBalancersKwargs };
    [ShellAPIMds.MdsListBastions]: { kwargs?: IShellListBastionsKwargs };
    [ShellAPIMds.MdsGetBastion]: { kwargs?: IShellGetBastionKwargs };
    [ShellAPIMds.MdsCreateBastion]: { kwargs?: IShellCreateBastionKwargs };
    [ShellAPIMds.MdsDeleteBastion]: { kwargs?: IShellDeleteBastionKwargs };
    [ShellAPIMds.MdsListBastionSessions]: { kwargs?: IShellListBastionSessionsKwargs };
    [ShellAPIMds.MdsGetBastionSession]: { kwargs?: IShellGetBastionSessionKwargs };
    [ShellAPIMds.MdsCreateBastionSession]: { kwargs?: IShellCreateBastionSessionKwargs };
    [ShellAPIMds.MdsDeleteBastionSession]: { kwargs?: IShellDeleteBastionSessionKwargs };

    // MRS
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

    // End auto generated API parameter mappings.
}
