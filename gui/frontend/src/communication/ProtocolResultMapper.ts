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

import {
    IBastionSession, IBastionSummary, ICompartment, IComputeInstance, ILoadBalancer, IMySQLDbSystem,
    IMySQLDbSystemShapeSummary, Protocol,
} from ".";
import { IConnectionDetails } from "../supplement/ShellInterface";
import { ShellAPIGui } from "./ProtocolGui";
import { ShellAPIMds } from "./ProtocolMds";
import { ShellAPIMrs } from "./ProtocolMrs";
import { IMrsDbObjectParameterData } from "./ShellParameterTypes";
import {
    IShellProfile,
    IDBDataTreeEntry, IMdsProfileData, IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IShellBackendInformation,
    IShellModuleDataCategoriesEntry, IShellModuleDataEntry, IShellResultType, IOpenConnectionData,
    IDbEditorResultSetData, IMrsStatusData, IMrsAuthVendorData, IMrsAuthAppData, IMrsAddContentSetData, IMrsContentSetData, IMrsContentFileData,
} from "./ShellResponseTypes";

/** The mapping between an API name and the results sent by it (held in the `event.data` member). */
export interface IProtocolResultMapper {
    // For debugging only.
    "native": INativeShellResponse;

    [Protocol.UserAuthenticate]: { activeProfile: IShellProfile };
    [Protocol.PromptReply]: {};

    // Begin auto generated API result mappings.
    [ShellAPIGui.GuiClusterIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiCoreSetLogLevel]: void;
    [ShellAPIGui.GuiCoreGetLogLevel]: { result: string };
    [ShellAPIGui.GuiCoreListFiles]: {};
    [ShellAPIGui.GuiCoreCreateFile]: {};
    [ShellAPIGui.GuiCoreValidatePath]: {};
    [ShellAPIGui.GuiCoreGetBackendInformation]: { info: IShellBackendInformation };
    [ShellAPIGui.GuiCoreIsShellWebCertificateInstalled]: {};
    [ShellAPIGui.GuiCoreInstallShellWebCertificate]: {};
    [ShellAPIGui.GuiCoreRemoveShellWebCertificate]: {};
    [ShellAPIGui.GuiDbconnectionsAddDbConnection]: { result: number };
    [ShellAPIGui.GuiDbconnectionsUpdateDbConnection]: {};
    [ShellAPIGui.GuiDbconnectionsRemoveDbConnection]: {};
    [ShellAPIGui.GuiDbconnectionsListDbConnections]: { result: IConnectionDetails[] };
    [ShellAPIGui.GuiDbconnectionsGetDbConnection]: { result: IConnectionDetails };
    [ShellAPIGui.GuiDbconnectionsGetDbTypes]: { result: string[] };
    [ShellAPIGui.GuiDbconnectionsSetCredential]: {};
    [ShellAPIGui.GuiDbconnectionsDeleteCredential]: {};
    [ShellAPIGui.GuiDbconnectionsListCredentials]: {};
    [ShellAPIGui.GuiDbconnectionsTestConnection]: {};
    [ShellAPIGui.GuiDbconnectionsMoveConnection]: {};
    [ShellAPIGui.GuiMdsIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiModelerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiShellGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellStartSession]: { result?: IShellResultType & { moduleSessionId?: string } };
    [ShellAPIGui.GuiShellCloseSession]: {};
    [ShellAPIGui.GuiShellExecute]: { result?: IShellResultType };
    [ShellAPIGui.GuiShellComplete]: { result?: { offset: number; options: string[] } };
    [ShellAPIGui.GuiShellKillTask]: {};
    [ShellAPIGui.GuiDbGetObjectsTypes]: {};
    [ShellAPIGui.GuiDbGetCatalogObjectNames]: { result: string[] };
    [ShellAPIGui.GuiDbGetSchemaObjectNames]: { result: string[] };
    [ShellAPIGui.GuiDbGetTableObjectNames]: { result: string[] };
    [ShellAPIGui.GuiDbGetCatalogObject]: {};
    [ShellAPIGui.GuiDbGetSchemaObject]: {};
    [ShellAPIGui.GuiDbGetTableObject]: {};
    [ShellAPIGui.GuiDbStartSession]: { result: { moduleSessionId: string } };
    [ShellAPIGui.GuiDbCloseSession]: {};
    [ShellAPIGui.GuiDbReconnect]: {};
    [ShellAPIGui.GuiSqleditorIsGuiModuleBackend]: { result: boolean };
    [ShellAPIGui.GuiSqleditorGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiSqleditorStartSession]: { result: { moduleSessionId?: string } };
    [ShellAPIGui.GuiSqleditorCloseSession]: {};
    [ShellAPIGui.GuiSqleditorOpenConnection]: IOpenConnectionData;
    [ShellAPIGui.GuiSqleditorReconnect]: {};
    [ShellAPIGui.GuiSqleditorExecute]: { result: IDbEditorResultSetData };
    [ShellAPIGui.GuiSqleditorKillQuery]: {};
    [ShellAPIGui.GuiSqleditorGetCurrentSchema]: { result: string };
    [ShellAPIGui.GuiSqleditorSetCurrentSchema]: {};
    [ShellAPIGui.GuiSqleditorGetAutoCommit]: { result: boolean };
    [ShellAPIGui.GuiSqleditorSetAutoCommit]: {};
    [ShellAPIGui.GuiUsersCreateUser]: {};
    [ShellAPIGui.GuiUsersSetAllowedHosts]: {};
    [ShellAPIGui.GuiUsersDeleteUser]: {};
    [ShellAPIGui.GuiUsersGrantRole]: {};
    [ShellAPIGui.GuiUsersGetUserId]: {};
    [ShellAPIGui.GuiUsersListUsers]: {};
    [ShellAPIGui.GuiUsersListUserRoles]: {};
    [ShellAPIGui.GuiUsersListRoles]: {};
    [ShellAPIGui.GuiUsersListRolePrivileges]: {};
    [ShellAPIGui.GuiUsersListUserPrivileges]: {};
    [ShellAPIGui.GuiUsersGetGuiModuleList]: { result: string[] };
    [ShellAPIGui.GuiUsersListProfiles]: { result: Array<{ id: number; name: string }> };
    [ShellAPIGui.GuiUsersGetProfile]: { result: IShellProfile };
    [ShellAPIGui.GuiUsersUpdateProfile]: { result: IShellProfile };
    [ShellAPIGui.GuiUsersAddProfile]: { result: IShellProfile };
    [ShellAPIGui.GuiUsersDeleteProfile]: {};
    [ShellAPIGui.GuiUsersGetDefaultProfile]: { profile: IShellProfile };
    [ShellAPIGui.GuiUsersSetDefaultProfile]: {};
    [ShellAPIGui.GuiUsersSetCurrentProfile]: {};
    [ShellAPIGui.GuiUsersListUserGroups]: {};
    [ShellAPIGui.GuiUsersCreateUserGroup]: {};
    [ShellAPIGui.GuiUsersAddUserToGroup]: {};
    [ShellAPIGui.GuiUsersRemoveUserFromGroup]: {};
    [ShellAPIGui.GuiUsersUpdateUserGroup]: {};
    [ShellAPIGui.GuiUsersRemoveUserGroup]: {};
    [ShellAPIGui.GuiDebuggerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiDebuggerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiDebuggerGetScripts]: { scripts: string[] };
    [ShellAPIGui.GuiDebuggerGetScriptContent]: { script: string };
    [ShellAPIGui.GuiModulesAddData]: { result: number };
    [ShellAPIGui.GuiModulesListData]: { result: IShellModuleDataEntry[] };
    [ShellAPIGui.GuiModulesGetDataContent]: { result: string };
    [ShellAPIGui.GuiModulesShareDataToUserGroup]: {};
    [ShellAPIGui.GuiModulesAddDataToProfile]: {};
    [ShellAPIGui.GuiModulesUpdateData]: {};
    [ShellAPIGui.GuiModulesDeleteData]: {};
    [ShellAPIGui.GuiModulesListDataCategories]: { result: IShellModuleDataCategoriesEntry[] };
    [ShellAPIGui.GuiModulesAddDataCategory]: {};
    [ShellAPIGui.GuiModulesRemoveDataCategory]: {};
    [ShellAPIGui.GuiModulesGetDataCategoryId]: {};
    [ShellAPIGui.GuiModulesCreateProfileDataTree]: {};
    [ShellAPIGui.GuiModulesGetProfileDataTree]: { result: IDBDataTreeEntry[] };
    [ShellAPIGui.GuiModulesCreateUserGroupDataTree]: {};
    [ShellAPIGui.GuiModulesGetUserGroupDataTree]: {};
    [ShellAPIGui.GuiModulesGetProfileTreeIdentifiers]: {};
    [ShellAPIGui.GuiModulesMoveData]: {};
    [ShellAPIGui.GuiInfo]: {};
    [ShellAPIGui.GuiVersion]: {};

    // MDS
    [ShellAPIMds.MdsGetRegions]: {};
    [ShellAPIMds.MdsListConfigProfiles]: { result: IMdsProfileData[] };
    [ShellAPIMds.MdsSetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsGetDefaultConfigProfile]: {};
    [ShellAPIMds.MdsSetCurrentCompartment]: {};
    [ShellAPIMds.MdsGetCurrentCompartmentId]: {};
    [ShellAPIMds.MdsSetCurrentBastion]: {};
    [ShellAPIMds.MdsGetAvailabilityDomain]: {};
    [ShellAPIMds.MdsListCompartments]: { result: ICompartment[] };
    [ShellAPIMds.MdsGetCompartment]: {};
    [ShellAPIMds.MdsListComputeInstances]: { result: IComputeInstance[] };
    [ShellAPIMds.MdsGetComputeInstance]: {};
    [ShellAPIMds.MdsListComputeShapes]: {};
    [ShellAPIMds.MdsDeleteComputeInstance]: {};
    [ShellAPIMds.MdsUtilHeatWaveLoadData]: {};
    [ShellAPIMds.MdsUtilCreateMdsEndpoint]: {};
    [ShellAPIMds.MdsGetDbSystemConfiguration]: {};
    [ShellAPIMds.MdsListDbSystemShapes]: { result: IMySQLDbSystemShapeSummary[] };
    [ShellAPIMds.MdsListDbSystems]: { result: IMySQLDbSystem[] };
    [ShellAPIMds.MdsGetDbSystem]: { result: IMySQLDbSystem };
    [ShellAPIMds.MdsGetDbSystemId]: {};
    [ShellAPIMds.MdsUpdateDbSystem]: {};
    [ShellAPIMds.MdsCreateDbSystem]: {};
    [ShellAPIMds.MdsDeleteDbSystem]: {};
    [ShellAPIMds.MdsStopDbSystem]: {};
    [ShellAPIMds.MdsStartDbSystem]: {};
    [ShellAPIMds.MdsRestartDbSystem]: {};
    [ShellAPIMds.MdsStopHeatWaveCluster]: {};
    [ShellAPIMds.MdsStartHeatWaveCluster]: {};
    [ShellAPIMds.MdsRestartHeatWaveCluster]: {};
    [ShellAPIMds.MdsCreateHeatWaveCluster]: {};
    [ShellAPIMds.MdsUpdateHeatWaveCluster]: {};
    [ShellAPIMds.MdsDeleteHeatWaveCluster]: {};
    [ShellAPIMds.MdsListLoadBalancers]: { result: ILoadBalancer[] };
    [ShellAPIMds.MdsListBastions]: { result: IBastionSummary[] };
    [ShellAPIMds.MdsGetBastion]: { result: IBastionSummary };
    [ShellAPIMds.MdsCreateBastion]: { result: IBastionSummary };
    [ShellAPIMds.MdsDeleteBastion]: {};
    [ShellAPIMds.MdsListBastionSessions]: {};
    [ShellAPIMds.MdsGetBastionSession]: {};
    [ShellAPIMds.MdsCreateBastionSession]: { result: IBastionSession };
    [ShellAPIMds.MdsDeleteBastionSession]: {};

    // MRS
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
