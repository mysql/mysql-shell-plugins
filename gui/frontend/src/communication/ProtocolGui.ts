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

import { IDictionary } from "../app-logic/Types";
import { IConnectionDetails } from "../supplement/ShellInterface";
import { IShellDictionary } from "./Protocol";

export enum ShellAPIGui {
    //  Begin auto generated API names
    GuiClusterIsGuiModuleBackend = "gui.cluster.is_gui_module_backend",
    GuiClusterGetGuiModuleDisplayInfo = "gui.cluster.get_gui_module_display_info",
    GuiCoreSetLogLevel = "gui.core.set_log_level",
    GuiCoreGetLogLevel = "gui.core.get_log_level",
    GuiCoreListFiles = "gui.core.list_files",
    GuiCoreCreateFile = "gui.core.create_file",
    GuiCoreValidatePath = "gui.core.validate_path",
    GuiCoreGetBackendInformation = "gui.core.get_backend_information",
    GuiCoreIsShellWebCertificateInstalled = "gui.core.is_shell_web_certificate_installed",
    GuiCoreInstallShellWebCertificate = "gui.core.install_shell_web_certificate",
    GuiCoreRemoveShellWebCertificate = "gui.core.remove_shell_web_certificate",
    GuiDbconnectionsAddDbConnection = "gui.dbconnections.add_db_connection",
    GuiDbconnectionsUpdateDbConnection = "gui.dbconnections.update_db_connection",
    GuiDbconnectionsRemoveDbConnection = "gui.dbconnections.remove_db_connection",
    GuiDbconnectionsListDbConnections = "gui.dbconnections.list_db_connections",
    GuiDbconnectionsGetDbConnection = "gui.dbconnections.get_db_connection",
    GuiDbconnectionsGetDbTypes = "gui.dbconnections.get_db_types",
    GuiDbconnectionsSetCredential = "gui.dbconnections.set_credential",
    GuiDbconnectionsDeleteCredential = "gui.dbconnections.delete_credential",
    GuiDbconnectionsListCredentials = "gui.dbconnections.list_credentials",
    GuiDbconnectionsTestConnection = "gui.dbconnections.test_connection",
    GuiDbconnectionsMoveConnection = "gui.dbconnections.move_connection",
    GuiMdsIsGuiModuleBackend = "gui.mds.is_gui_module_backend",
    GuiMdsGetGuiModuleDisplayInfo = "gui.mds.get_gui_module_display_info",
    GuiModelerIsGuiModuleBackend = "gui.modeler.is_gui_module_backend",
    GuiModelerGetGuiModuleDisplayInfo = "gui.modeler.get_gui_module_display_info",
    GuiShellIsGuiModuleBackend = "gui.shell.is_gui_module_backend",
    GuiShellGetGuiModuleDisplayInfo = "gui.shell.get_gui_module_display_info",
    GuiShellStartSession = "gui.shell.start_session",
    GuiShellCloseSession = "gui.shell.close_session",
    GuiShellExecute = "gui.shell.execute",
    GuiShellComplete = "gui.shell.complete",
    GuiShellKillTask = "gui.shell.kill_task",
    GuiDbGetObjectsTypes = "gui.db.get_objects_types",
    GuiDbGetCatalogObjectNames = "gui.db.get_catalog_object_names",
    GuiDbGetSchemaObjectNames = "gui.db.get_schema_object_names",
    GuiDbGetTableObjectNames = "gui.db.get_table_object_names",
    GuiDbGetCatalogObject = "gui.db.get_catalog_object",
    GuiDbGetSchemaObject = "gui.db.get_schema_object",
    GuiDbGetTableObject = "gui.db.get_table_object",
    GuiDbStartSession = "gui.db.start_session",
    GuiDbCloseSession = "gui.db.close_session",
    GuiDbReconnect = "gui.db.reconnect",
    GuiSqleditorIsGuiModuleBackend = "gui.sqleditor.is_gui_module_backend",
    GuiSqleditorGetGuiModuleDisplayInfo = "gui.sqleditor.get_gui_module_display_info",
    GuiSqleditorStartSession = "gui.sqleditor.start_session",
    GuiSqleditorCloseSession = "gui.sqleditor.close_session",
    GuiSqleditorOpenConnection = "gui.sqleditor.open_connection",
    GuiSqleditorReconnect = "gui.sqleditor.reconnect",
    GuiSqleditorExecute = "gui.sqleditor.execute",
    GuiSqleditorKillQuery = "gui.sqleditor.kill_query",
    GuiSqleditorGetCurrentSchema = "gui.sqleditor.get_current_schema",
    GuiSqleditorSetCurrentSchema = "gui.sqleditor.set_current_schema",
    GuiSqleditorGetAutoCommit = "gui.sqleditor.get_auto_commit",
    GuiSqleditorSetAutoCommit = "gui.sqleditor.set_auto_commit",
    GuiUsersCreateUser = "gui.users.create_user",
    GuiUsersSetAllowedHosts = "gui.users.set_allowed_hosts",
    GuiUsersDeleteUser = "gui.users.delete_user",
    GuiUsersGrantRole = "gui.users.grant_role",
    GuiUsersGetUserId = "gui.users.get_user_id",
    GuiUsersListUsers = "gui.users.list_users",
    GuiUsersListUserRoles = "gui.users.list_user_roles",
    GuiUsersListRoles = "gui.users.list_roles",
    GuiUsersListRolePrivileges = "gui.users.list_role_privileges",
    GuiUsersListUserPrivileges = "gui.users.list_user_privileges",
    GuiUsersGetGuiModuleList = "gui.users.get_gui_module_list",
    GuiUsersListProfiles = "gui.users.list_profiles",
    GuiUsersGetProfile = "gui.users.get_profile",
    GuiUsersUpdateProfile = "gui.users.update_profile",
    GuiUsersAddProfile = "gui.users.add_profile",
    GuiUsersDeleteProfile = "gui.users.delete_profile",
    GuiUsersGetDefaultProfile = "gui.users.get_default_profile",
    GuiUsersSetDefaultProfile = "gui.users.set_default_profile",
    GuiUsersSetCurrentProfile = "gui.users.set_current_profile",
    GuiUsersListUserGroups = "gui.users.list_user_groups",
    GuiUsersCreateUserGroup = "gui.users.create_user_group",
    GuiUsersAddUserToGroup = "gui.users.add_user_to_group",
    GuiUsersRemoveUserFromGroup = "gui.users.remove_user_from_group",
    GuiUsersUpdateUserGroup = "gui.users.update_user_group",
    GuiUsersRemoveUserGroup = "gui.users.remove_user_group",
    GuiDebuggerIsGuiModuleBackend = "gui.debugger.is_gui_module_backend",
    GuiDebuggerGetGuiModuleDisplayInfo = "gui.debugger.get_gui_module_display_info",
    GuiDebuggerGetScripts = "gui.debugger.get_scripts",
    GuiDebuggerGetScriptContent = "gui.debugger.get_script_content",
    GuiModulesAddData = "gui.modules.add_data",
    GuiModulesListData = "gui.modules.list_data",
    GuiModulesGetDataContent = "gui.modules.get_data_content",
    GuiModulesShareDataToUserGroup = "gui.modules.share_data_to_user_group",
    GuiModulesAddDataToProfile = "gui.modules.add_data_to_profile",
    GuiModulesUpdateData = "gui.modules.update_data",
    GuiModulesDeleteData = "gui.modules.delete_data",
    GuiModulesListDataCategories = "gui.modules.list_data_categories",
    GuiModulesAddDataCategory = "gui.modules.add_data_category",
    GuiModulesRemoveDataCategory = "gui.modules.remove_data_category",
    GuiModulesGetDataCategoryId = "gui.modules.get_data_category_id",
    GuiModulesCreateProfileDataTree = "gui.modules.create_profile_data_tree",
    GuiModulesGetProfileDataTree = "gui.modules.get_profile_data_tree",
    GuiModulesCreateUserGroupDataTree = "gui.modules.create_user_group_data_tree",
    GuiModulesGetUserGroupDataTree = "gui.modules.get_user_group_data_tree",
    GuiModulesGetProfileTreeIdentifiers = "gui.modules.get_profile_tree_identifiers",
    GuiModulesMoveData = "gui.modules.move_data",
    GuiInfo = "gui.info",
    GuiVersion = "gui.version",
    //  End auto generated API names
}

export interface IShellDbConnection {
    dbType: string | null;
    caption: string | null;
    description: string | null;
    options: IDictionary | null;
}

export interface IShellQueryOptions {
    rowPacketSize?: number;
}

/** The mapping between a GUI module API name and the accepted parameters for it. */
export interface IProtocolGuiParameters {
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
}

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
    | IShellPasswordFeedbackRequest
    ;

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

export interface IProtocolGuiResults {
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
    // End auto generated API result mappings.
}

/**
 * A list of APIs that return more than a single result.
 * This is a temporary solution, until we get appropriate tags from the BE.
 */
export const multiResultAPIs = [
    ShellAPIGui.GuiCoreListFiles,
    ShellAPIGui.GuiDbGetSchemaObjectNames,
    ShellAPIGui.GuiDbconnectionsListDbConnections,
    ShellAPIGui.GuiModulesGetProfileDataTree,
    ShellAPIGui.GuiShellComplete,
    ShellAPIGui.GuiSqleditorExecute,
] as const;
