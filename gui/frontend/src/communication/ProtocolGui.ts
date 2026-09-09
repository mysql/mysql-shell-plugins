/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
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
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { IConnectionDetails, IFolderPath } from "../supplement/ShellInterface/index.js";
import { IShellDictionary } from "./Protocol.js";

/* eslint-disable max-len, @stylistic/quotes */

export enum ShellAPIGui {
    /** Indicates whether this module is a GUI backend module */
    GuiClusterIsGuiModuleBackend = "gui.cluster.is_gui_module_backend",
    /** Returns display information about the module */
    GuiClusterGetGuiModuleDisplayInfo = "gui.cluster.get_gui_module_display_info",
    /** Sets the log level */
    GuiCoreSetLogLevel = "gui.core.set_log_level",
    /** Gets the current log level */
    GuiCoreGetLogLevel = "gui.core.get_log_level",
    /** Returns the contents of a directory. */
    GuiCoreListFiles = "gui.core.list_files",
    /** Creates a new file specified by the path. */
    GuiCoreCreateFile = "gui.core.create_file",
    /** Validates the specified path. */
    GuiCoreValidatePath = "gui.core.validate_path",
    /** Checks if a local database endpoint appears to be available. */
    GuiCoreProbeLocalConnectionEndpoint = "gui.core.probe_local_connection_endpoint",
    /** Deletes a file specified by the path. */
    GuiCoreDeleteFile = "gui.core.delete_file",
    /** Returns information about backend */
    GuiCoreGetBackendInformation = "gui.core.get_backend_information",
    /** Sets test-only plugin command mock rules. */
    GuiCoreSetPluginCommandMocks = "gui.core.set_plugin_command_mocks",
    /** Clears test-only plugin command mock rules. */
    GuiCoreClearPluginCommandMocks = "gui.core.clear_plugin_command_mocks",
    /** Add a new db_connection and associate the connection with a profile */
    GuiDbConnectionsAddDbConnection = "gui.dbConnections.add_db_connection",
    /** Import non-secret connections from classic Workbench XML. */
    GuiDbConnectionsImportWorkbenchConnections = "gui.dbConnections.import_workbench_connections",
    /** Update the data for a database connection */
    GuiDbConnectionsUpdateDbConnection = "gui.dbConnections.update_db_connection",
    /** Remove a db_connection by disassociating the connection from a profile */
    GuiDbConnectionsRemoveDbConnection = "gui.dbConnections.remove_db_connection",
    /** Lists the db_connections for the given profile */
    GuiDbConnectionsListDbConnections = "gui.dbConnections.list_db_connections",
    /** Get the db_connection */
    GuiDbConnectionsGetDbConnection = "gui.dbConnections.get_db_connection",
    /** Lists the connection tag definitions for a profile's user. */
    GuiDbConnectionsListConnectionTags = "gui.dbConnections.list_connection_tags",
    /** Updates the connection tag definitions for a profile's user. */
    GuiDbConnectionsUpdateConnectionTags = "gui.dbConnections.update_connection_tags",
    /** Gets cached server status sysvars for an offline module session. */
    GuiDbConnectionsGetServerStatusCache = "gui.dbConnections.get_server_status_cache",
    /** Get the list of db_types */
    GuiDbConnectionsGetDbTypes = "gui.dbConnections.get_db_types",
    /** Set the password of a db_connection url */
    GuiDbConnectionsSetCredential = "gui.dbConnections.set_credential",
    /** Deletes the password of a db_connection url */
    GuiDbConnectionsDeleteCredential = "gui.dbConnections.delete_credential",
    /** Lists the db_connection urls that have a password stored */
    GuiDbConnectionsListCredentials = "gui.dbConnections.list_credentials",
    /** Opens test connection */
    GuiDbConnectionsTestConnection = "gui.dbConnections.test_connection",
    /** Updates the connections sort order for the given profile */
    GuiDbConnectionsMoveConnection = "gui.dbConnections.move_connection",
    /** Add a new folder path */
    GuiDbConnectionsAddFolderPath = "gui.dbConnections.add_folder_path",
    /** Remove a folder path */
    GuiDbConnectionsRemoveFolderPath = "gui.dbConnections.remove_folder_path",
    /** Remove all empty folders */
    GuiDbConnectionsRemoveEmptyFolders = "gui.dbConnections.remove_empty_folders",
    /** Rename a folder path */
    GuiDbConnectionsRenameFolderPath = "gui.dbConnections.rename_folder_path",
    /** Move a folder path to a new parent folder */
    GuiDbConnectionsMoveFolder = "gui.dbConnections.move_folder",
    /** List folder paths */
    GuiDbConnectionsListFolderPaths = "gui.dbConnections.list_folder_paths",
    /** Lists all connections and folder paths for the given profile and folder */
    GuiDbConnectionsListAll = "gui.dbConnections.list_all",
    /** Rename a folder path */
    GuiDbConnectionsUpdateFolderSettings = "gui.dbConnections.update_folder_settings",
    /** Get folder */
    GuiDbConnectionsGetFolder = "gui.dbConnections.get_folder",
    /** Creates a new user account */
    GuiUsersCreateUser = "gui.users.create_user",
    /** Sets the allowed hosts for the given user. */
    GuiUsersSetAllowedHosts = "gui.users.set_allowed_hosts",
    /** Deletes a user account */
    GuiUsersDeleteUser = "gui.users.delete_user",
    /** Grant the given roles to the user. */
    GuiUsersGrantRole = "gui.users.grant_role",
    /** Gets the id for a given user. */
    GuiUsersGetUserId = "gui.users.get_user_id",
    /** Lists all user accounts. */
    GuiUsersListUsers = "gui.users.list_users",
    /** List the granted roles for a given user. */
    GuiUsersListUserRoles = "gui.users.list_user_roles",
    /** Lists all roles that can be assigned to users. */
    GuiUsersListRoles = "gui.users.list_roles",
    /** Lists all privileges of a role. */
    GuiUsersListRolePrivileges = "gui.users.list_role_privileges",
    /** Lists all privileges assigned to a user. */
    GuiUsersListUserPrivileges = "gui.users.list_user_privileges",
    /** Returns the list of modules for the given user. */
    GuiUsersGetGuiModuleList = "gui.users.get_gui_module_list",
    /** Returns the list of profile for the given user */
    GuiUsersListProfiles = "gui.users.list_profiles",
    /** Returns the specified profile. */
    GuiUsersGetProfile = "gui.users.get_profile",
    /** Updates a user profile. */
    GuiUsersUpdateProfile = "gui.users.update_profile",
    /** Returns the specified profile. */
    GuiUsersAddProfile = "gui.users.add_profile",
    /** Deletes a profile for the current user. */
    GuiUsersDeleteProfile = "gui.users.delete_profile",
    /** Returns the default profile for the given user. */
    GuiUsersGetDefaultProfile = "gui.users.get_default_profile",
    /** Sets the default profile for the given user. */
    GuiUsersSetDefaultProfile = "gui.users.set_default_profile",
    /** Sets the profile of the user's current web session. */
    GuiUsersSetCurrentProfile = "gui.users.set_current_profile",
    /** Returns the list of all groups or list all groups that given user belongs. */
    GuiUsersListUserGroups = "gui.users.list_user_groups",
    /** Creates user group. */
    GuiUsersCreateUserGroup = "gui.users.create_user_group",
    /** Adds user to user group. */
    GuiUsersAddUserToGroup = "gui.users.add_user_to_group",
    /** Removes user from user group. */
    GuiUsersRemoveUserFromGroup = "gui.users.remove_user_from_group",
    /** Updates user group. */
    GuiUsersUpdateUserGroup = "gui.users.update_user_group",
    /** Removes given user group. */
    GuiUsersRemoveUserGroup = "gui.users.remove_user_group",
    /** Discover validated legacy data that has not already been imported. */
    GuiLegacyDiscover = "gui.legacy.discover",
    /** Import discovered classic Workbench connections. */
    GuiLegacyImportDiscoveredWorkbenchConnections = "gui.legacy.import_discovered_workbench_connections",
    /** Import VS Code connections and remove obsolete extension logs. */
    GuiLegacyImportVsCode = "gui.legacy.import_vs_code",
    /** Copy and optionally remove legacy Migration Assistant projects. */
    GuiLegacyImportMigrationAssistantProjects = "gui.legacy.import_migration_assistant_projects",
    /** Indicates whether this module is a GUI backend module */
    GuiMdsIsGuiModuleBackend = "gui.mds.is_gui_module_backend",
    /** Returns display information about the module */
    GuiMdsGetGuiModuleDisplayInfo = "gui.mds.get_gui_module_display_info",
    /** Indicates whether this module is a GUI backend module */
    GuiModelerIsGuiModuleBackend = "gui.modeler.is_gui_module_backend",
    /** Returns display information about the module */
    GuiModelerGetGuiModuleDisplayInfo = "gui.modeler.get_gui_module_display_info",
    /** Indicates whether this module is a GUI backend module */
    GuiShellIsGuiModuleBackend = "gui.shell.is_gui_module_backend",
    /** Returns display information about the module */
    GuiShellGetGuiModuleDisplayInfo = "gui.shell.get_gui_module_display_info",
    /** Starts a new Shell Interactive Session */
    GuiShellStartSession = "gui.shell.start_session",
    /** Closes the Shell Interactive Session */
    GuiShellCloseSession = "gui.shell.close_session",
    /** Execute a shell command */
    GuiShellExecute = "gui.shell.execute",
    /** Retrieve options to complete the given text on the shell context */
    GuiShellComplete = "gui.shell.complete",
    /** Kill a shell task */
    GuiShellKillTask = "gui.shell.kill_task",
    /** Returns the database objects supported by a DBMS */
    GuiDbGetObjectsTypes = "gui.db.get_objects_types",
    /** Executes the given SQL on the DB service session. */
    GuiDbExecute = "gui.db.execute",
    /** Returns the names of the existing objects of the given     type. If a filter is provided, only the names matching the given filter will be returned. */
    GuiDbGetCatalogObjectNames = "gui.db.get_catalog_object_names",
    /** Returns the names of the existing objects of the given type in the given     schema that match the provided filter. */
    GuiDbGetSchemaObjectNames = "gui.db.get_schema_object_names",
    /** Returns the names of the existing objects of the given type in the given     table that match the provided filter. */
    GuiDbGetTableObjectNames = "gui.db.get_table_object_names",
    /** Returns a JSON representation of the object matching the given type and name. */
    GuiDbGetCatalogObject = "gui.db.get_catalog_object",
    /** Returns a JSON representation of the schema object matching the given type, schema and name. */
    GuiDbGetSchemaObject = "gui.db.get_schema_object",
    /** Returns a JSON representation of the table object matching the given type, schema, table and name. */
    GuiDbGetTableObject = "gui.db.get_table_object",
    /** Returns a JSON representation of the columns metadata. */
    GuiDbGetColumnsMetadata = "gui.db.get_columns_metadata",
    /** Starts a DB Session */
    GuiDbStartSession = "gui.db.start_session",
    /** Creates a profile-bound module session for offline administration. */
    GuiDbStartOfflineSession = "gui.db.start_offline_session",
    /** Closes the DB Session */
    GuiDbCloseSession = "gui.db.close_session",
    /** Reconnects the DB Session */
    GuiDbReconnect = "gui.db.reconnect",
    /** Returns the schema objects of the given type in the given schema. */
    GuiDbGetRoutinesMetadata = "gui.db.get_routines_metadata",
    /** Returns the schema objects of the given type in the given schema. */
    GuiDbGetLibrariesMetadata = "gui.db.get_libraries_metadata",
    /** Returns a JSON representation of table columns and its references which are needed to build a JDV */
    GuiDbGetJdvTableColumnsWithReferences = "gui.db.get_jdv_table_columns_with_references",
    /** Returns a JSON representation of the metadata of the JDV for a given schema and name. */
    GuiDbGetJdvViewInfo = "gui.db.get_jdv_view_info",
    /** Returns a JSON representation of jdv object fields and its references for a given jdv_object_id */
    GuiDbGetJdvObjectFieldsWithReferences = "gui.db.get_jdv_object_fields_with_references",
    /** Creates a new Module Data record for the given module    and associates it to the active user profile and personal user group. */
    GuiModulesAddData = "gui.modules.add_data",
    /** Get list of data */
    GuiModulesListData = "gui.modules.list_data",
    /** Gets content of the given module */
    GuiModulesGetDataContent = "gui.modules.get_data_content",
    /** Shares data to user group */
    GuiModulesShareDataToUserGroup = "gui.modules.share_data_to_user_group",
    /** Shares data to profile */
    GuiModulesAddDataToProfile = "gui.modules.add_data_to_profile",
    /** Update data of the given module */
    GuiModulesUpdateData = "gui.modules.update_data",
    /** Deletes data */
    GuiModulesDeleteData = "gui.modules.delete_data",
    /** Gets the list of available data categories and sub categories    for the given name. */
    GuiModulesListDataCategories = "gui.modules.list_data_categories",
    /** Add a new data category to the list of available data categories for this module */
    GuiModulesAddDataCategory = "gui.modules.add_data_category",
    /** Remove a data category from the list of available data categories for this module */
    GuiModulesRemoveDataCategory = "gui.modules.remove_data_category",
    /** Gets id for given name and module id. */
    GuiModulesGetDataCategoryId = "gui.modules.get_data_category_id",
    /** Creates the profile data tree for the given tree identifier and profile id. */
    GuiModulesCreateProfileDataTree = "gui.modules.create_profile_data_tree",
    /** Gets the profile data tree for the given tree identifier and profile id. */
    GuiModulesGetProfileDataTree = "gui.modules.get_profile_data_tree",
    /** Creates the user group data tree for the given tree identifier and user group id. */
    GuiModulesCreateUserGroupDataTree = "gui.modules.create_user_group_data_tree",
    /** Gets the user group data tree for the given tree identifier and user group id. */
    GuiModulesGetUserGroupDataTree = "gui.modules.get_user_group_data_tree",
    /** Gets the tree identifiers associated with the given profile. */
    GuiModulesGetProfileTreeIdentifiers = "gui.modules.get_profile_tree_identifiers",
    /** Moves data from source path to target path. */
    GuiModulesMoveData = "gui.modules.move_data",
    /** Indicates whether this module is a GUI backend module */
    GuiSqlEditorIsGuiModuleBackend = "gui.sqlEditor.is_gui_module_backend",
    /** Returns display information about the module */
    GuiSqlEditorGetGuiModuleDisplayInfo = "gui.sqlEditor.get_gui_module_display_info",
    /** Starts a SQL Editor Session */
    GuiSqlEditorStartSession = "gui.sqlEditor.start_session",
    /** Closes the SQL Editor Session */
    GuiSqlEditorCloseSession = "gui.sqlEditor.close_session",
    /** Opens the SQL Editor Session */
    GuiSqlEditorOpenConnection = "gui.sqlEditor.open_connection",
    /** Resets a password and refreshes this editor's reconnect credentials on success. */
    GuiSqlEditorResetPassword = "gui.sqlEditor.reset_password",
    /** Reconnects the SQL Editor Session */
    GuiSqlEditorReconnect = "gui.sqlEditor.reconnect",
    /** Starts a new transaction */
    GuiSqlEditorStartTransaction = "gui.sqlEditor.start_transaction",
    /** Starts a new transaction */
    GuiSqlEditorCommitTransaction = "gui.sqlEditor.commit_transaction",
    /** Starts a new transaction */
    GuiSqlEditorRollbackTransaction = "gui.sqlEditor.rollback_transaction",
    /** Executes the given SQL. */
    GuiSqlEditorExecute = "gui.sqlEditor.execute",
    /** Generates an SVG visual explain plan for the given SQL statement. */
    GuiSqlEditorVisualExplain = "gui.sqlEditor.visual_explain",
    /** Reformats a SQL statement or script. */
    GuiSqlEditorReformat = "gui.sqlEditor.reformat",
    /** Stops the query that is currently executing. */
    GuiSqlEditorKillQuery = "gui.sqlEditor.kill_query",
    /** Kills the database session that is currently executing. */
    GuiSqlEditorKillSession = "gui.sqlEditor.kill_session",
    /** Requests the current schema for this module. */
    GuiSqlEditorGetCurrentSchema = "gui.sqlEditor.get_current_schema",
    /** Requests to change the current schema for this module. */
    GuiSqlEditorSetCurrentSchema = "gui.sqlEditor.set_current_schema",
    /** Requests the auto-commit status for this module. */
    GuiSqlEditorGetAutoCommit = "gui.sqlEditor.get_auto_commit",
    /** Requests to change the auto-commit status for this module. */
    GuiSqlEditorSetAutoCommit = "gui.sqlEditor.set_auto_commit",
    /** Adds a new entry in the execution_history */
    GuiSqlEditorAddExecutionHistoryEntry = "gui.sqlEditor.add_execution_history_entry",
    /** Returns an entry of the execution_history */
    GuiSqlEditorGetExecutionHistoryEntry = "gui.sqlEditor.get_execution_history_entry",
    /** Returns the full list execution_history but truncates the code to truncate_code_length */
    GuiSqlEditorGetExecutionHistoryEntries = "gui.sqlEditor.get_execution_history_entries",
    /** Removes the execution_history entry with the given index */
    GuiSqlEditorRemoveExecutionHistoryEntry = "gui.sqlEditor.remove_execution_history_entry",
    /** Returns basic information about this plugin. */
    GuiInfo = "gui.info",
    /** Returns the version number of the plugin */
    GuiVersion = "gui.version",
    /** Reads one local MySQL error log page using backend-cached configuration. */
    GuiMysqlReadErrorLogFilePage = "gui.mysql.read_error_log_file_page",
    /** Copies the cached local MySQL error log file to a user-selected path. */
    GuiMysqlExportErrorLogFile = "gui.mysql.export_error_log_file",
    /** Exports all rows from the connected performance schema error log. */
    GuiMysqlExportErrorLogs = "gui.mysql.export_error_logs",
    /** Lists MySQL users using the provided session object. */
    GuiMysqlListUsers = "gui.mysql.list_users",
    /** Replaces the granted/default roles for the given MySQL user account. */
    GuiMysqlSetGrantedRoles = "gui.mysql.set_granted_roles",
    /** Lists global privileges supported by the connected MySQL server. */
    GuiMysqlListGlobalPrivilegeCatalog = "gui.mysql.list_global_privilege_catalog",
    /** Lists schema-level privileges supported by the connected MySQL server. */
    GuiMysqlListSchemaPrivilegeCatalog = "gui.mysql.list_schema_privilege_catalog",
    /** Lists tables and routines in a schema for object privilege assignment. */
    GuiMysqlListObjectPrivilegeSchemaTargets = "gui.mysql.list_object_privilege_schema_targets",
    /** Lists authentication plugins supported by the connected MySQL server. */
    GuiMysqlListAuthenticationPlugins = "gui.mysql.list_authentication_plugins",
    /** Returns authentication plugins bundled with MySQL Shell. */
    GuiMysqlGetBundledAuthenticationPlugins = "gui.mysql.get_bundled_authentication_plugins",
    /** Returns server default values used to initialize the create user dialog. */
    GuiMysqlGetCreateUserDefaults = "gui.mysql.get_create_user_defaults",
    /** Returns password reset metadata for an account. */
    GuiMysqlGetPasswordResetInfo = "gui.mysql.get_password_reset_info",
    /** Replaces the direct global privileges for the given MySQL user account. */
    GuiMysqlSetUserGlobalPrivileges = "gui.mysql.set_user_global_privileges",
    /** Replaces the direct object privileges for the given MySQL user account. */
    GuiMysqlSetUserObjectPrivileges = "gui.mysql.set_user_object_privileges",
    /** Retrieves a MySQL user by username and host using the provided session object. */
    GuiMysqlGetUser = "gui.mysql.get_user",
    /** Creates a MySQL user with the specified username, host, password and options using the provided session object. */
    GuiMysqlCreateUser = "gui.mysql.create_user",
    /** Deletes a MySQL user with the specified username and host using the provided session object. */
    GuiMysqlDeleteUser = "gui.mysql.delete_user",
    /** Updates a MySQL user details, specified by the user and host, with the options. */
    GuiMysqlUpdateUser = "gui.mysql.update_user",
    /** Returns local MySQL Enterprise Backup configuration and profile status. */
    GuiMebGetStatus = "gui.meb.get_status",
    /** Returns the local MEB setup state for the connected MySQL server. */
    GuiMebGetSetupState = "gui.meb.get_setup_state",
    /** Validates current-user access for local backup operations. */
    GuiMebValidateLocalBackupAccess = "gui.meb.validate_local_backup_access",
    /** Validates a local backup home path for the connected MySQL server. */
    GuiMebValidateBackupHome = "gui.meb.validate_backup_home",
    /** Creates a local backup home directory and validates it. */
    GuiMebCreateBackupHome = "gui.meb.create_backup_home",
    /** Validates and stores credentials for an existing MySQL backup account. */
    GuiMebValidateBackupMysqlUser = "gui.meb.validate_backup_mysql_user",
    /** Creates the MySQL backup account, grants privileges, and stores credentials. */
    GuiMebCreateBackupMysqlUser = "gui.meb.create_backup_mysql_user",
    /** Reapplies the required privileges and limits for an existing backup account. */
    GuiMebFixBackupMysqlUser = "gui.meb.fix_backup_mysql_user",
    /** Resets the MySQL backup account password and stores the credential. */
    GuiMebResetBackupMysqlUserPassword = "gui.meb.reset_backup_mysql_user_password",
    /** Persists local MEB support configuration in the backup home. */
    GuiMebApplySetup = "gui.meb.apply_setup",
    /** Creates or updates a MySQL Enterprise Backup profile. */
    GuiMebSaveProfile = "gui.meb.save_profile",
    /** Deletes a MySQL Enterprise Backup profile. */
    GuiMebDeleteProfile = "gui.meb.delete_profile",
    /** Starts executing a MySQL Enterprise Backup profile immediately. */
    GuiMebStartProfileExecution = "gui.meb.start_profile_execution",
    /** Deletes backup data associated with a recent activity log entry. */
    GuiMebDeleteBackup = "gui.meb.delete_backup",
    /** Runs mysqlbackup validation and returns its direct output. */
    GuiMebVerifyBackup = "gui.meb.verify_backup",
    /** Applies pending redo logs to a recent activity backup. */
    GuiMebApplyBackupLogs = "gui.meb.apply_backup_logs",
    /** Restores local backup data associated with a recent activity log entry. */
    GuiMebRestoreBackup = "gui.meb.restore_backup",
    /** Returns live output and state for a matching restore operation. */
    GuiMebGetRestoreProgress = "gui.meb.get_restore_progress",
    /** Aborts the matching active restore operation. */
    GuiMebAbortBackupRestore = "gui.meb.abort_backup_restore",
    /** Reads the table contents represented by a recent activity backup. */
    GuiMebReadBackupContent = "gui.meb.read_backup_content",
    /** Returns the local directory path represented by a recent activity backup. */
    GuiMebGetBackupPath = "gui.meb.get_backup_path",
    /** Reads a mysqlbackup log file discovered below a configured backup home. */
    GuiMebReadLog = "gui.meb.read_log",
    /** Indicates whether this module is a GUI backend module */
    GuiDebuggerIsGuiModuleBackend = "gui.debugger.is_gui_module_backend",
    /** Returns display information about the module */
    GuiDebuggerGetGuiModuleDisplayInfo = "gui.debugger.get_gui_module_display_info",
    /** Returns the list of available scripts */
    GuiDebuggerGetScripts = "gui.debugger.get_scripts",
    /** Returns the content of the given script */
    GuiDebuggerGetScriptContent = "gui.debugger.get_script_content"
}

export interface IShellDbConnection {
    /** The db type name */
    dbType: string | null;
    /** A name for this connection */
    caption: string | null;
    /** A longer description for this connection */
    description: string | null;
    /** The options specific for the current database type */
    options: IShellDictionary | null;
    /** The additional settings for the given connection */
    settings: IShellDictionary | null;
    /** The user-defined tags assigned to the connection */
    tags: string[] | null;
}

export interface IAny {}

export interface IDbSession {}

export interface IMySQLTablePrivilege {
    schema: string,
    table: string,
    privileges: string[]
}

export interface IMySQLColumnPrivilege {
    schema: string,
    table: string,
    column: string,
    privileges: string[]
}

export interface IMySQLRoutinePrivilege {
    schema: string,
    routine: string,
    routineType: string,
    privileges: string[]
}

export interface IMySQLUserListItemSSLOptions {
    requiresCertificate: boolean,
    sslCipher: string | null,
    x509Issuer: string | null,
    x509Subject: string | null
}

export interface IMySQLUserListItem {
    accountLocked: boolean,
    user: string,
    host: string,
    authenticationPlugins: string[],
    temporarilyLocked: boolean,
    isRole: boolean,
    globalPrivileges: string[],
    passwordExpired: boolean,
    passwordExpiration: string | null,
    roles: string[],
    defaultRoles: string[],
    schemaPrivileges: Record<string, string[]>,
    tablePrivileges: IMySQLTablePrivilege[],
    columnPrivileges: IMySQLColumnPrivilege[],
    routinePrivileges: IMySQLRoutinePrivilege[],
    partialRevokes: Record<string, string[]>,
    sslOptions: IMySQLUserListItemSSLOptions | null
}

export interface IMySQLGlobalPrivilegeCatalogItem {
    privilege: string,
    category: string,
    description: string
}

export interface IMySQLObjectPrivilegeSchemaTarget {
    kind: string,
    objectName: string,
    routineType: string | null
}

export interface IMySQLDefaultUserOptions {
    passwordLifetime: number,
    passwordReuseHistory: number,
    passwordReuseInterval: number,
    passwordRequireCurrent: boolean,
    maxUserConnections: number,
    authenticationPolicy: string | null,
    defaultAuthenticationPlugin: string | null,
    passwordValidationInstalled: boolean | null,
    passwordValidationPolicy: string | null,
    passwordValidationLength: number | null,
    requireSecureTransport: boolean | null
}

export interface IPasswordResetAccount {
    user: string | null,
    host: string | null
}

export interface IPasswordResetFactor {
    plugin: string,
    kind: "internalPassword" | "externalPassword",
    passwordless: boolean,
    requiresRegistration: boolean | null
}

export interface IPasswordResetCurrentPassword {
    accountSetting: "required" | "optional" | "default" | "unknown",
    requiredByPolicy: boolean | null,
    required: boolean
}

export interface IPasswordResetInfo {
    account: IPasswordResetAccount,
    factors: IPasswordResetFactor[],
    sqlResetSupported: boolean | null,
    retainCurrentPasswordSupported: boolean,
    currentPassword: IPasswordResetCurrentPassword
}

export interface IObjectPrivilegeTarget {
    kind: string,
    schema: string,
    objectName: string | null,
    routineType: string | null,
    column: string | null
}

export interface IAuthenticationFactor {
    plugin: string,
    password: string | null,
    authenticationString: string | null
}

export interface IMySQLUser {
    host: string,
    user: string,
    authenticationFactors: IAuthenticationFactor[],
    sslType: string | null,
    sslCipher: string | null,
    x509Issuer: string | null,
    x509Subject: string | null,
    maxQuestions: number | null,
    maxUpdates: number | null,
    maxConnections: number | null,
    maxUserConnections: number | null,
    passwordExpire: boolean | null,
    passwordLastChanged: string | null,
    passwordLifetime: number | null,
    accountLocked: boolean | null,
    passwordReuseHistory: number | null,
    passwordReuseInterval: number | null,
    passwordRequireCurrent: boolean | null,
    comment: string | null,
    failedLoginAttempts: number | null,
    passwordLockTime: number | null,
    randomPassword: boolean | null
}

export interface IUserInfo {
    generatedPassword: string | null
}

export interface IMebProfileSchedule {
    enabled: boolean,
    interval: number,
    frequency: number,
    monthDays: number[],
    weekDays: boolean[],
    hour: number,
    minute: number
}

export interface IMebBackupProfileInfo {
    uuid: string,
    label: string,
    type: string,
    destination: string,
    latest: string,
    nextFull: string,
    nextIncremental: string,
    status: string,
    schedulerLoginRequirement: "required" | "notRequired" | null,
    command: string | null,
    user: string | null,
    configPath: string | null,
    applyLog: boolean,
    comments: string | null,
    compress: boolean,
    compressLevel: string,
    compressMethod: string,
    storageType: "local",
    cloudService: string | null,
    cloudObject: string | null,
    cloudParUrl: string | null,
    cloudHost: string | null,
    cloudBucket: string | null,
    cloudObjectKey: string | null,
    cloudAccessKeyId: string | null,
    cloudAwsRegion: string | null,
    cloudContainer: string | null,
    cloudUserId: string | null,
    cloudTempAuthUrl: string | null,
    cloudBasicAuthUrl: string | null,
    cloudIdentityUrl: string | null,
    cloudTenant: string | null,
    cloudRegion: string | null,
    cloudChunkedTransfer: boolean,
    cloudChunkSize: string | null,
    cloudProxy: string | null,
    cloudCaInfo: string | null,
    cloudCaPath: string | null,
    cloudBufferSize: string | null,
    cloudTrace: boolean,
    excludeTables: string | null,
    fullSchedule: IMebProfileSchedule,
    includeTables: string | null,
    legacyPartialBackupConverted: boolean,
    legacyPartialBackupConversionMessage: string | null,
    incrementalBase: string,
    incrementalWithRedoLogOnly: boolean,
    incSchedule: IMebProfileSchedule,
    partial: boolean,
    skipUnusedPages: boolean,
    usingTts: "0" | "1" | "2",
    datadir: string | null,
    mysqlBasedir: string | null,
    mysqlVersion: string | null
}

export interface IMebStatusItem {
    label: string,
    value: string,
    tone: string
}

export interface IMebActivityItem {
    time: string,
    title: string,
    detail: string,
    tone: string,
    activityId: string | null,
    size: string | null,
    profile: string | null,
    profileId: string | null,
    status: string | null,
    backupType: string | null,
    isBackup: boolean,
    applyLogDone: boolean | null
}

export interface IMebStatus {
    configured: boolean,
    mysqlbackupCommand: string | null,
    backupHome: string | null,
    backupUser: string | null,
    mysqlVersion: string | null,
    mysqlEdition: string | null,
    mysqlBasedir: string | null,
    datadir: string | null,
    spaceAvailable: string | null,
    spaceUsed: string | null,
    spaceTotal: string | null,
    spaceUsedPercent: number | null,
    spaceOtherUsedPercent: number | null,
    profileTemplate: IMebBackupProfileInfo,
    profiles: IMebBackupProfileInfo[],
    statusItems: IMebStatusItem[],
    recentActivity: IMebActivityItem[]
}

export interface IMebSetupState {
    configured: boolean,
    needsSetup: boolean,
    localSupported: boolean,
    message: string,
    messageTone: string,
    backupHomePath: string | null,
    backupOsUser: string | null,
    runtimeHelperPath: string | null,
    mysqlbackupPath: string | null,
    mysqlbackupExists: boolean,
    mysqlBackupUser: string,
    datadir: string | null,
    datadirOwner: string | null,
    datadirGroup: string | null,
    currentOsUser: string | null,
    platform: string,
    mysqlVersion: string | null,
    mysqlEdition: string | null,
    mysqlBasedir: string | null,
    loginFile: string | null,
    loginPath: string | null,
    schedulerName: string,
    status: IMebStatus | null
}

export interface IMebValidationStatus {
    tone: string,
    message: string
}

export interface IMebPrerequisitesValidation {
    valid: boolean,
    osUser: string,
    mysqlbackupPath: string | null,
    mysqlbackupExists: boolean,
    datadir: string | null,
    datadirOwner: string | null,
    datadirGroup: string | null,
    currentOsUser: string | null,
    platform: string,
    schedulerName: string,
    userStatus: IMebValidationStatus,
    mysqlbackupStatus: IMebValidationStatus,
    datadirStatus: IMebValidationStatus
}

export interface IMebBackupHomeValidation {
    valid: boolean,
    backupHomePath: string | null,
    exists: boolean,
    owner: string | null,
    status: IMebValidationStatus,
    ownershipStatus: IMebValidationStatus,
    permissionsStatus: IMebValidationStatus,
    reuseStatus: IMebValidationStatus,
    accessStatus: IMebValidationStatus
}

export interface IMebMysqlBackupUserValidation {
    valid: boolean,
    exists: boolean,
    host: string | null,
    passwordStored: boolean,
    loginFile: string | null,
    loginPath: string | null,
    missingGrants: string[],
    status: IMebValidationStatus,
    passwordStatus: IMebValidationStatus
}

export interface IMebBackupProfile {
    applyLog: boolean,
    comments: string | null,
    compress: boolean,
    compressLevel: string,
    compressMethod: string,
    storageType: "local",
    cloudService: string | null,
    cloudObject: string | null,
    cloudParUrl: string | null,
    cloudHost: string | null,
    cloudBucket: string | null,
    cloudObjectKey: string | null,
    cloudAccessKeyId: string | null,
    cloudSecretAccessKey: string | null,
    cloudAwsRegion: string | null,
    cloudAccessKey: string | null,
    cloudSecretKey: string | null,
    cloudContainer: string | null,
    cloudUserId: string | null,
    cloudPassword: string | null,
    cloudTempAuthUrl: string | null,
    cloudBasicAuthUrl: string | null,
    cloudIdentityUrl: string | null,
    cloudTenant: string | null,
    cloudRegion: string | null,
    cloudChunkedTransfer: boolean,
    cloudChunkSize: string | null,
    cloudProxy: string | null,
    cloudCaInfo: string | null,
    cloudCaPath: string | null,
    cloudBufferSize: string | null,
    cloudTrace: boolean,
    label: string,
    destination: string,
    excludeTables: string | null,
    fullSchedule: IMebProfileSchedule,
    includeTables: string | null,
    incrementalBase: string,
    incrementalWithRedoLogOnly: boolean,
    incSchedule: IMebProfileSchedule,
    partial: boolean,
    skipUnusedPages: boolean,
    usingTts: "0" | "1" | "2",
    user: string | null,
    datadir: string | null,
    mysqlBasedir: string | null,
    configPath: string | null
}

export interface IMebLogContent {
    activityId: string,
    displayName: string,
    content: string,
    warnings: string[]
}

export interface IMebRestoreResult {
    succeeded: boolean,
    aborted: boolean,
    message: string,
    output: string,
    status: IMebStatus | null
}

export interface IMebRestoreProgress {
    state: string,
    operationId: string,
    output: string
}

export interface IMebBackupRestoreChainEntry {
    name: string,
    type: "Full" | "Incremental" | null,
    timestamp: string | null
}

export interface IMebBackupFileGroup {
    category: string,
    fileCount: number,
    description: string,
    sample: string,
    files: string[]
}

export interface IMebBackupContentRow {
    schema: string,
    table: string,
    engine: string,
    scope: string,
    coverage: string,
    inBackup: boolean,
    inInstance: boolean,
    action: string
}

export interface IMebBackupContent {
    backupHome: string,
    activityId: string,
    backupLabel: string,
    backupScope: string | null,
    applyLogDone: boolean,
    hasInstanceData: boolean,
    mysqlVersion: string | null,
    gtidExecuted: string | null,
    startTime: string | null,
    endTime: string | null,
    binlogFile: string | null,
    binlogPosition: string | null,
    restoreChain: IMebBackupRestoreChainEntry[],
    fileGroups: IMebBackupFileGroup[],
    rows: IMebBackupContentRow[],
    warnings: string[]
}

export interface IProtocolGuiParameters {
    [ShellAPIGui.GuiClusterIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiCoreSetLogLevel]: { args: { logLevel?: string; }; };
    [ShellAPIGui.GuiCoreGetLogLevel]: {};
    [ShellAPIGui.GuiCoreListFiles]: { args: { path?: string; }; };
    [ShellAPIGui.GuiCoreCreateFile]: { args: { path: string; }; };
    [ShellAPIGui.GuiCoreValidatePath]: { args: { path: string; }; };
    [ShellAPIGui.GuiCoreProbeLocalConnectionEndpoint]: { args: { kind: string; target: string; port?: number | null; }; };
    [ShellAPIGui.GuiCoreDeleteFile]: { args: { path: string; }; };
    [ShellAPIGui.GuiCoreGetBackendInformation]: {};
    [ShellAPIGui.GuiCoreSetPluginCommandMocks]: { args: { rules: { }; }; };
    [ShellAPIGui.GuiCoreClearPluginCommandMocks]: {};
    [ShellAPIGui.GuiDbConnectionsAddDbConnection]: { args: { profileId: number; connection: IShellDbConnection; folderPathId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsImportWorkbenchConnections]: { args: { profileId: number; xmlContent: string; }; };
    [ShellAPIGui.GuiDbConnectionsUpdateDbConnection]: { args: { profileId: number; connectionId: number; connection?: IShellDbConnection; folderPathId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsRemoveDbConnection]: { args: { profileId: number; connectionId: number; }; };
    [ShellAPIGui.GuiDbConnectionsListDbConnections]: { args: { profileId: number; folderPathId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsGetDbConnection]: { args: { dbConnectionId: number; profileId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsListConnectionTags]: { args: { profileId: number; }; };
    [ShellAPIGui.GuiDbConnectionsUpdateConnectionTags]: { args: { profileId: number; tags: { }; }; };
    [ShellAPIGui.GuiDbConnectionsGetServerStatusCache]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbConnectionsGetDbTypes]: {};
    [ShellAPIGui.GuiDbConnectionsSetCredential]: { args: { url: string; password: string; }; };
    [ShellAPIGui.GuiDbConnectionsDeleteCredential]: { args: { url: string; }; };
    [ShellAPIGui.GuiDbConnectionsListCredentials]: {};
    [ShellAPIGui.GuiDbConnectionsTestConnection]: { args: { connection: IShellDbConnection | number; password?: string; }; };
    [ShellAPIGui.GuiDbConnectionsMoveConnection]: { args: { profileId: number; folderId: number; connectionIdToMove: number; connectionIdOffset: number; before?: boolean; }; };
    [ShellAPIGui.GuiDbConnectionsAddFolderPath]: { args: { profileId: number; caption: string; settings?: { color?: string; }; parentFolderId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsRemoveFolderPath]: { args: { folderPathId: number; }; };
    [ShellAPIGui.GuiDbConnectionsRemoveEmptyFolders]: {};
    [ShellAPIGui.GuiDbConnectionsRenameFolderPath]: { args: { folderPathId: number; newCaption: string; }; };
    [ShellAPIGui.GuiDbConnectionsMoveFolder]: { args: { folderPathId: number; newParentFolderId: number; }; };
    [ShellAPIGui.GuiDbConnectionsListFolderPaths]: { args: { parentFolderId?: number; recursive?: boolean; }; };
    [ShellAPIGui.GuiDbConnectionsListAll]: { args: { profileId: number; folderId?: number; }; };
    [ShellAPIGui.GuiDbConnectionsUpdateFolderSettings]: { args: { folderPathId: number; newSettings: { color?: string; }; }; };
    [ShellAPIGui.GuiDbConnectionsGetFolder]: { args: { folderPathId: number; }; };
    [ShellAPIGui.GuiUsersCreateUser]: { args: { username: string; password: string; role?: string; allowedHosts?: string; }; };
    [ShellAPIGui.GuiUsersSetAllowedHosts]: { args: { userId: number; allowedHosts: string; }; };
    [ShellAPIGui.GuiUsersDeleteUser]: { args: { username: string; }; };
    [ShellAPIGui.GuiUsersGrantRole]: { args: { username: string; role: string; }; };
    [ShellAPIGui.GuiUsersGetUserId]: { args: { username: string; }; };
    [ShellAPIGui.GuiUsersListUsers]: {};
    [ShellAPIGui.GuiUsersListUserRoles]: { args: { username: string; }; };
    [ShellAPIGui.GuiUsersListRoles]: {};
    [ShellAPIGui.GuiUsersListRolePrivileges]: { args: { role: string; }; };
    [ShellAPIGui.GuiUsersListUserPrivileges]: { args: { username: string; }; };
    [ShellAPIGui.GuiUsersGetGuiModuleList]: { args: { userId: number; }; };
    [ShellAPIGui.GuiUsersListProfiles]: { args: { userId: number; }; };
    [ShellAPIGui.GuiUsersGetProfile]: { args: { profileId: number; }; };
    [ShellAPIGui.GuiUsersUpdateProfile]: { args: { profile: { id?: number; name?: string; description?: string; options?: IShellDictionary; state?: IShellDictionary; }; }; };
    [ShellAPIGui.GuiUsersAddProfile]: { args: { userId: number; profile: { name?: string; description?: string; options?: IShellDictionary; state?: IShellDictionary; }; }; };
    [ShellAPIGui.GuiUsersDeleteProfile]: { args: { userId: number; profileId: number; }; };
    [ShellAPIGui.GuiUsersGetDefaultProfile]: { args: { userId: number; }; };
    [ShellAPIGui.GuiUsersSetDefaultProfile]: { args: { userId: number; profileId: number; }; };
    [ShellAPIGui.GuiUsersSetCurrentProfile]: { args: { profileId: number; }; };
    [ShellAPIGui.GuiUsersListUserGroups]: { args: { memberId?: number; }; };
    [ShellAPIGui.GuiUsersCreateUserGroup]: { args: { name: string; description: string; }; };
    [ShellAPIGui.GuiUsersAddUserToGroup]: { args: { memberId: number; groupId: number; owner?: number; }; };
    [ShellAPIGui.GuiUsersRemoveUserFromGroup]: { args: { memberId: number; groupId: number; }; };
    [ShellAPIGui.GuiUsersUpdateUserGroup]: { args: { groupId: number; name?: string; description?: string; }; };
    [ShellAPIGui.GuiUsersRemoveUserGroup]: { args: { groupId: number; }; };
    [ShellAPIGui.GuiLegacyDiscover]: {};
    [ShellAPIGui.GuiLegacyImportDiscoveredWorkbenchConnections]: { args: { profileId: number; }; };
    [ShellAPIGui.GuiLegacyImportVsCode]: { args: { profileId: number; }; };
    [ShellAPIGui.GuiLegacyImportMigrationAssistantProjects]: { args: { options: { }; }; };
    [ShellAPIGui.GuiMdsIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiModelerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiShellGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellStartSession]: { args: { dbConnectionId?: number; shellArgs?: unknown[]; }; };
    [ShellAPIGui.GuiShellCloseSession]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiShellExecute]: { args: { command: string; moduleSessionId: string; }; };
    [ShellAPIGui.GuiShellComplete]: { args: { data: string; offset: number; moduleSessionId: string; }; };
    [ShellAPIGui.GuiShellKillTask]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbGetObjectsTypes]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbExecute]: { args: { moduleSessionId: string; sql: string; params?: unknown[]; options?: { }; }; };
    [ShellAPIGui.GuiDbGetCatalogObjectNames]: { args: { moduleSessionId: string; type: string; filter?: string; }; };
    [ShellAPIGui.GuiDbGetSchemaObjectNames]: { args: { moduleSessionId: string; type: string; schemaName: string; filter?: string; routineType?: string; }; };
    [ShellAPIGui.GuiDbGetTableObjectNames]: { args: { moduleSessionId: string; type: string; schemaName: string; tableName: string; filter?: string; }; };
    [ShellAPIGui.GuiDbGetCatalogObject]: { args: { moduleSessionId: string; type: string; name: string; }; };
    [ShellAPIGui.GuiDbGetSchemaObject]: { args: { moduleSessionId: string; type: string; schemaName: string; name: string; }; };
    [ShellAPIGui.GuiDbGetTableObject]: { args: { moduleSessionId: string; type: string; schemaName: string; tableName: string; name: string; }; };
    [ShellAPIGui.GuiDbGetColumnsMetadata]: { args: { moduleSessionId: string; names: unknown[]; }; };
    [ShellAPIGui.GuiDbStartSession]: { args: { connection: IShellDbConnection | number; password?: string; }; };
    [ShellAPIGui.GuiDbStartOfflineSession]: { args: { connectionId: number; }; };
    [ShellAPIGui.GuiDbCloseSession]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbReconnect]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbGetRoutinesMetadata]: { args: { moduleSessionId: string; schemaName: string; }; };
    [ShellAPIGui.GuiDbGetLibrariesMetadata]: { args: { moduleSessionId: string; schemaName: string; }; };
    [ShellAPIGui.GuiDbGetJdvTableColumnsWithReferences]: { args: { moduleSessionId: string; schemaName: string; tableName: string; }; };
    [ShellAPIGui.GuiDbGetJdvViewInfo]: { args: { moduleSessionId: string; jdvSchemaName: string; jdvName: string; }; };
    [ShellAPIGui.GuiDbGetJdvObjectFieldsWithReferences]: { args: { moduleSessionId: string; jdvSchemaName: string; jdvName: string; jdvObjectId: string; }; };
    [ShellAPIGui.GuiModulesAddData]: { args: { caption: string; content: string; dataCategoryId: number; treeIdentifier: string; folderPath?: string; profileId?: number; }; };
    [ShellAPIGui.GuiModulesListData]: { args: { folderId: number; dataCategoryId?: number; }; };
    [ShellAPIGui.GuiModulesGetDataContent]: { args: { id: number; }; };
    [ShellAPIGui.GuiModulesShareDataToUserGroup]: { args: { id: number; userGroupId: number; readOnly: number; treeIdentifier: string; folderPath?: string; }; };
    [ShellAPIGui.GuiModulesAddDataToProfile]: { args: { id: number; profileId: number; readOnly: number; treeIdentifier: string; folderPath?: string; }; };
    [ShellAPIGui.GuiModulesUpdateData]: { args: { id: number; caption?: string; content?: string; }; };
    [ShellAPIGui.GuiModulesDeleteData]: { args: { id: number; folderId: number; }; };
    [ShellAPIGui.GuiModulesListDataCategories]: { args: { categoryId?: number; }; };
    [ShellAPIGui.GuiModulesAddDataCategory]: { args: { name: string; parentCategoryId?: number; }; };
    [ShellAPIGui.GuiModulesRemoveDataCategory]: { args: { categoryId: number; }; };
    [ShellAPIGui.GuiModulesGetDataCategoryId]: { args: { name: string; }; };
    [ShellAPIGui.GuiModulesCreateProfileDataTree]: { args: { treeIdentifier: string; profileId?: number; }; };
    [ShellAPIGui.GuiModulesGetProfileDataTree]: { args: { treeIdentifier: string; profileId?: number; }; };
    [ShellAPIGui.GuiModulesCreateUserGroupDataTree]: { args: { treeIdentifier: string; userGroupId?: number; }; };
    [ShellAPIGui.GuiModulesGetUserGroupDataTree]: { args: { treeIdentifier: string; userGroupId?: number; }; };
    [ShellAPIGui.GuiModulesGetProfileTreeIdentifiers]: { args: { profileId?: number; }; };
    [ShellAPIGui.GuiModulesMoveData]: { args: { id: number; treeIdentifier: string; linkedTo: string; linkId: number; sourcePath: string; targetPath: string; }; };
    [ShellAPIGui.GuiSqlEditorIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiSqlEditorGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiSqlEditorStartSession]: {};
    [ShellAPIGui.GuiSqlEditorCloseSession]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorOpenConnection]: { args: { dbConnectionId: number; moduleSessionId: string; password?: string; }; };
    [ShellAPIGui.GuiSqlEditorResetPassword]: { args: { moduleSessionId: string; password: string; currentPassword?: string; retainCurrentPassword?: boolean; passwordExpired?: boolean; user?: string; host?: string; }; };
    [ShellAPIGui.GuiSqlEditorReconnect]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorStartTransaction]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorCommitTransaction]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorRollbackTransaction]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorExecute]: { args: { moduleSessionId: string; sql: string; params?: unknown[]; options?: { rowPacketSize?: number; featureId?: string; }; }; };
    [ShellAPIGui.GuiSqlEditorVisualExplain]: { args: { moduleSessionId: string; sql: string; options?: { analyze?: boolean; compact?: boolean; darkMode?: boolean; layout?: string; plan?: string; showDescription?: boolean; showQuery?: boolean; }; }; };
    [ShellAPIGui.GuiSqlEditorReformat]: { args: { sql: string; options?: { indentWidth?: number; keywordCase?: string; quoteIdentifiers?: boolean; maxInlineLength?: number; breakSelectItems?: boolean; breakFunctionArgs?: boolean; tableOptionsPerLine?: boolean; ansiQuotes?: boolean; noBackslashEscapes?: boolean; }; }; };
    [ShellAPIGui.GuiSqlEditorKillQuery]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorKillSession]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorGetCurrentSchema]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorSetCurrentSchema]: { args: { moduleSessionId: string; schemaName: string; }; };
    [ShellAPIGui.GuiSqlEditorGetAutoCommit]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiSqlEditorSetAutoCommit]: { args: { moduleSessionId: string; state: boolean; }; };
    [ShellAPIGui.GuiSqlEditorAddExecutionHistoryEntry]: { args: { connectionId: number; code: string; languageId: string; profileId?: number; }; };
    [ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntry]: { args: { connectionId: number; index: number; profileId?: number; }; };
    [ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntries]: { args: { connectionId: number; languageId?: string; truncateCodeLength?: number; profileId?: number; }; };
    [ShellAPIGui.GuiSqlEditorRemoveExecutionHistoryEntry]: { args: { connectionId: number; index?: number; profileId?: number; }; };
    [ShellAPIGui.GuiInfo]: {};
    [ShellAPIGui.GuiVersion]: {};
    [ShellAPIGui.GuiMysqlReadErrorLogFilePage]: { args: { moduleSessionId: string; page?: number; pageSize?: number; filters?: { }; }; };
    [ShellAPIGui.GuiMysqlExportErrorLogFile]: { args: { moduleSessionId: string; targetPath: string; }; };
    [ShellAPIGui.GuiMysqlExportErrorLogs]: { args: { targetPath: string; moduleSessionId: string; }; };
    [ShellAPIGui.GuiMysqlListUsers]: { args: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlSetGrantedRoles]: { args: { user: string; host: string; roles: string[]; moduleSessionId?: string; defaultRoles?: string[] | null; }; };
    [ShellAPIGui.GuiMysqlListGlobalPrivilegeCatalog]: { args: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlListSchemaPrivilegeCatalog]: { args: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlListObjectPrivilegeSchemaTargets]: { args: { schema: string; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlListAuthenticationPlugins]: { args: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlGetBundledAuthenticationPlugins]: {};
    [ShellAPIGui.GuiMysqlGetCreateUserDefaults]: { args: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlGetPasswordResetInfo]: { args: { user?: string | null; host?: string | null; passwordExpired?: boolean; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlSetUserGlobalPrivileges]: { args: { user: string; host: string; privileges: string[]; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlSetUserObjectPrivileges]: { args: { user: string; host: string; target: IObjectPrivilegeTarget; privileges: string[]; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlGetUser]: { args: { user: string; host: string; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlCreateUser]: { args: { options: IMySQLUser; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlDeleteUser]: { args: { user: string; host: string; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMysqlUpdateUser]: { args: { options: IMySQLUser; moduleSessionId?: string; }; };
    [ShellAPIGui.GuiMebGetStatus]: { args: { moduleSessionId: string; backupHomePath?: string | null; }; };
    [ShellAPIGui.GuiMebGetSetupState]: { args: { moduleSessionId: string; backupHomePath?: string | null; }; };
    [ShellAPIGui.GuiMebValidateLocalBackupAccess]: { args: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiMebValidateBackupHome]: { args: { moduleSessionId: string; backupHomePath: string; }; };
    [ShellAPIGui.GuiMebCreateBackupHome]: { args: { moduleSessionId: string; backupHomePath: string; }; };
    [ShellAPIGui.GuiMebValidateBackupMysqlUser]: { args: { moduleSessionId: string; backupHomePath: string; mysqlUser: string; password?: string | null; }; };
    [ShellAPIGui.GuiMebCreateBackupMysqlUser]: { args: { moduleSessionId: string; backupHomePath: string; mysqlUser: string; }; };
    [ShellAPIGui.GuiMebFixBackupMysqlUser]: { args: { moduleSessionId: string; backupHomePath: string; mysqlUser: string; }; };
    [ShellAPIGui.GuiMebResetBackupMysqlUserPassword]: { args: { moduleSessionId: string; backupHomePath: string; mysqlUser: string; password?: string | null; }; };
    [ShellAPIGui.GuiMebApplySetup]: { args: { moduleSessionId: string; backupHomePath: string; mysqlUser: string; }; };
    [ShellAPIGui.GuiMebSaveProfile]: { args: { moduleSessionId: string; backupHomePath: string; profile: IMebBackupProfile; }; };
    [ShellAPIGui.GuiMebDeleteProfile]: { args: { moduleSessionId: string; backupHomePath: string; profileUuid: string; }; };
    [ShellAPIGui.GuiMebStartProfileExecution]: { args: { moduleSessionId: string; backupHomePath: string; profileUuid: string; backupMode: string; }; };
    [ShellAPIGui.GuiMebDeleteBackup]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiMebVerifyBackup]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiMebApplyBackupLogs]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiMebRestoreBackup]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; operationId: string; force?: boolean; }; };
    [ShellAPIGui.GuiMebGetRestoreProgress]: { args: { moduleSessionId: string; backupHomePath: string; operationId: string; }; };
    [ShellAPIGui.GuiMebAbortBackupRestore]: { args: { moduleSessionId: string; backupHomePath: string; operationId: string; }; };
    [ShellAPIGui.GuiMebReadBackupContent]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiMebGetBackupPath]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiMebReadLog]: { args: { moduleSessionId: string; backupHomePath: string; activityId: string; }; };
    [ShellAPIGui.GuiDebuggerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiDebuggerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiDebuggerGetScripts]: {};
    [ShellAPIGui.GuiDebuggerGetScriptContent]: { args: { path: string; }; };

}

export interface IErrorResult {
    requestState: {
        msg: string;
        code?: number;
    };
}

export interface IShellProfile {
    id: number;
    userId: number;
    name: string;
    description: string;
    options: IShellDictionary;
    state: IShellDictionary;
}

export interface IWebSessionData {
    requestState: { msg: string; };
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
        connectionId?: number;
        serviceConnectionId?: number;
        sqlMode?: string;
        version?: string;
        versionComment?: string;
        edition?: string;
        heatWaveAvailable?: boolean;
        mleAvailable?: boolean;
        isCloudInstance?: boolean;
        hasExplainError?: boolean;
    };
}

export interface IStatusData {
    result: string;
}

export interface IRequestState {
    type: string;
    msg: string;
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
    executionTime: string;
    affectedItemsCount: number;
    warningsCount: number;
    warnings: IShellDocumentWarning[];
    info: string;
    autoIncrementValue: number;
}

export interface IShellDocumentData extends IShellResultData {
    documents: unknown[];
}

export interface ITableColumn { name: string; type: string; length: number; }

export interface IDbEditorResultSetData {
    executionTime?: number;
    rows?: unknown[];
    columns?: ITableColumn[];
    totalRowCount?: number;
    rowsAffected?: number;
}

export interface IVisualExplainData {
    svg: string;
    plan?: string;
    executionTime?: number;
}

export interface IErrorLogFileRow {
    line: number;
    logged: string;
    threadId: string;
    prio: string;
    errorCode: string;
    subsystem: string;
    data: string;
}

export interface IErrorLogFilePage {
    path: string;
    isTruncated?: boolean;
    page: number;
    pageSize: number;
    startLine: number;
    totalLines: number;
    totalPages: number;
    errorCodeValues: string[];
    subsystemValues: string[];
    hasNext: boolean;
    rows: IErrorLogFileRow[];
}

/**
 * The members of this record come with pascal case naming, which is not processed by our snake-to-camel
 * case processing. So for now we define this with the original names here, until this is fixed.
 */
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

export type IShellColumnsMetaData = Record<string, IShellColumnMetadataEntry>;

export interface IShellRowData extends IShellResultData {
    rows: unknown[];
}

export interface IShellSimpleResult extends IShellPromptValues {
    info?: string;
    error?: string | { message: string; type: string; };
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

    /**
     * If specified use that as session ID to send prompt replies. Used for prompts while a session is being
     * opened.
     */
    moduleSessionId?: string;
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

export interface ITableObjectInfo {
    name: string,
    type?: string,
    notNull?: number,
    default?: unknown,
    isPk?: number,
    autoIncrement?: number,
}

export type IGetColumnsMetadataItem = ITableObjectInfo & {
    type: string;
    schema: string;
    table: string;
};

export interface ISqlEditorHistoryEntry {
    index: number;
    code: string;
    languageId: string;
    currentTimestamp: string;
}

export interface IDBSchemaObjectEntry {
    name: string;
    type: string;
    language: string;
}

export interface IDBTableObjectEntry {
    name: string;
    type: string;
    notNull: boolean;
    isPk: boolean;
    autoIncrement: boolean;
    default: unknown;
}

export interface IJdvTableColumn {
    dbName: string;
    datatype: string;
    isPrimary: boolean;
    isGenerated: boolean;
    notNull: boolean;
}

export interface IJdvTableReference {
    kind: string;
    baseColumn: string;
    referencedColumn: string;
    referencedTable: string;
    referencedSchema: string;
}

export interface IJdvTableColumnWithReference {
    name: string;
    position: number;
    dbColumn?: IJdvTableColumn;
    referenceMapping?: IJdvTableReference;
    table: string;
    schema: string;
}

export interface IJdvObjectFieldWithReference {
    fieldId: string, // item id
    parentReferenceId?: string, // link to the parent item id
    jsonKeyname: string,
    dbName: string,
    position: number,
    dbColumn?: IJdvTableColumn,
    objectReferenceId?: string, // id of current table
    objectReference?: IJdvTableReference, // jdv link
    dbReference?: IJdvTableReference, // pk-fk relationship
    options?: IJdvObjectOptions,
    lev: number,
    selected: boolean,
    aliasName?: string
}

export interface IJdvObjectOptions {
    dataMappingViewInsert?: boolean,
    dataMappingViewUpdate?: boolean,
    dataMappingViewDelete?: boolean,
    dataMappingViewNoCheck?: boolean,
}

export interface IJdvObject {
    id: string,
    table: string,
    schema: string,
    isRoot: boolean,
    options?: IJdvObjectOptions,
    fields?: IJdvObjectFieldWithReference[],
    storedFields?: IJdvObjectFieldWithReference[],
}

export interface IJdvViewInfo {
    id: string;
    name: string;
    schema: string;
    rootTableName: string;
    rootTableSchema: string;
    objects?: IJdvObject[];
}

export interface IProtocolGuiResults {
    [ShellAPIGui.GuiClusterIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiCoreSetLogLevel]: void;
    [ShellAPIGui.GuiCoreGetLogLevel]: { result: string; };
    [ShellAPIGui.GuiCoreGetBackendInformation]: { result: IShellBackendInformation; };
    [ShellAPIGui.GuiDbConnectionsAddDbConnection]: { result: [number, number, number]; };
    [ShellAPIGui.GuiDbConnectionsUpdateDbConnection]: {};
    [ShellAPIGui.GuiDbConnectionsRemoveDbConnection]: {};
    [ShellAPIGui.GuiDbConnectionsListDbConnections]: { result: IConnectionDetails[]; };
    [ShellAPIGui.GuiDbConnectionsGetDbConnection]: { result: IConnectionDetails; };
    [ShellAPIGui.GuiDbConnectionsListConnectionTags]: { result: Record<string, string>; };
    [ShellAPIGui.GuiDbConnectionsUpdateConnectionTags]: {};
    [ShellAPIGui.GuiDbConnectionsGetDbTypes]: { result: string[]; };
    [ShellAPIGui.GuiDbConnectionsSetCredential]: {};
    [ShellAPIGui.GuiDbConnectionsDeleteCredential]: {};
    [ShellAPIGui.GuiDbConnectionsListCredentials]: { result: string[]; };
    [ShellAPIGui.GuiDbConnectionsTestConnection]: { result?: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiDbConnectionsMoveConnection]: {};
    [ShellAPIGui.GuiDbConnectionsAddFolderPath]: { result: IFolderPath; };
    [ShellAPIGui.GuiDbConnectionsRemoveFolderPath]: {};
    [ShellAPIGui.GuiDbConnectionsRemoveEmptyFolders]: {};
    [ShellAPIGui.GuiDbConnectionsRenameFolderPath]: {};
    [ShellAPIGui.GuiDbConnectionsMoveFolder]: {};
    [ShellAPIGui.GuiDbConnectionsListFolderPaths]: { result: IFolderPath[]; };
    [ShellAPIGui.GuiDbConnectionsListAll]: { result: Array<IConnectionDetails | IFolderPath>; };
    [ShellAPIGui.GuiDbConnectionsUpdateFolderSettings]: {};
    [ShellAPIGui.GuiDbConnectionsGetFolder]: { result: IFolderPath; };
    [ShellAPIGui.GuiDbConnectionsImportWorkbenchConnections]: { result: unknown; };
    [ShellAPIGui.GuiMdsIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiModelerIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellIsGuiModuleBackend]: {};
    [ShellAPIGui.GuiShellGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiShellStartSession]: { result?: IShellResultType & { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiShellCloseSession]: {};
    [ShellAPIGui.GuiShellExecute]: { result?: IShellResultType; };
    [ShellAPIGui.GuiShellComplete]: { result?: { offset: number; options: string[]; }; };
    [ShellAPIGui.GuiShellKillTask]: {};
    [ShellAPIGui.GuiDbGetObjectsTypes]: {};
    [ShellAPIGui.GuiDbExecute]: { result: IDbEditorResultSetData; };
    [ShellAPIGui.GuiMysqlReadErrorLogFilePage]: { result: IErrorLogFilePage; };
    [ShellAPIGui.GuiDbGetCatalogObjectNames]: { result: string[]; };
    [ShellAPIGui.GuiDbGetSchemaObjectNames]: { result: string[]; };
    [ShellAPIGui.GuiDbGetTableObjectNames]: { result: string[]; };
    [ShellAPIGui.GuiDbGetColumnsMetadata]: { result: IGetColumnsMetadataItem[]; };
    [ShellAPIGui.GuiDbGetCatalogObject]: {};
    [ShellAPIGui.GuiDbGetSchemaObject]: {};
    [ShellAPIGui.GuiDbGetTableObject]: { result: ITableObjectInfo; };
    [ShellAPIGui.GuiDbStartSession]: { result: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbStartOfflineSession]: { result: { moduleSessionId: string; }; };
    [ShellAPIGui.GuiDbCloseSession]: {};
    [ShellAPIGui.GuiDbReconnect]: {};
    [ShellAPIGui.GuiSqlEditorIsGuiModuleBackend]: { result: boolean; };
    [ShellAPIGui.GuiSqlEditorGetGuiModuleDisplayInfo]: {};
    [ShellAPIGui.GuiSqlEditorStartSession]: { result: { moduleSessionId?: string; }; };
    [ShellAPIGui.GuiSqlEditorCloseSession]: {};
    [ShellAPIGui.GuiSqlEditorOpenConnection]: { result: IOpenConnectionData | IShellPasswordFeedbackRequest | IStatusData; requestState: IRequestState; };
    [ShellAPIGui.GuiSqlEditorResetPassword]: {};
    [ShellAPIGui.GuiSqlEditorReconnect]: {};
    [ShellAPIGui.GuiSqlEditorExecute]: { result: IDbEditorResultSetData; };
    [ShellAPIGui.GuiSqlEditorVisualExplain]: { result: IVisualExplainData; };
    [ShellAPIGui.GuiSqlEditorKillQuery]: {};
    [ShellAPIGui.GuiSqlEditorKillSession]: {};
    [ShellAPIGui.GuiSqlEditorGetCurrentSchema]: { result: string; };
    [ShellAPIGui.GuiSqlEditorSetCurrentSchema]: {};
    [ShellAPIGui.GuiSqlEditorGetAutoCommit]: { result: boolean; };
    [ShellAPIGui.GuiSqlEditorSetAutoCommit]: {};
    [ShellAPIGui.GuiSqlEditorAddExecutionHistoryEntry]: { result: number; };
    [ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntry]: { result: ISqlEditorHistoryEntry; };
    [ShellAPIGui.GuiSqlEditorGetExecutionHistoryEntries]: { result: ISqlEditorHistoryEntry[]; };
    [ShellAPIGui.GuiSqlEditorRemoveExecutionHistoryEntry]: {};
    [ShellAPIGui.GuiSqlEditorStartTransaction]: {};
    [ShellAPIGui.GuiSqlEditorCommitTransaction]: {};
    [ShellAPIGui.GuiSqlEditorRollbackTransaction]: {};
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
    [ShellAPIGui.GuiUsersGetGuiModuleList]: { result: string[]; };
    [ShellAPIGui.GuiUsersListProfiles]: { result: Array<{ id: number; name: string; }>; };
    [ShellAPIGui.GuiUsersGetProfile]: { result: IShellProfile; };
    [ShellAPIGui.GuiUsersUpdateProfile]: { result: IShellProfile; };
    [ShellAPIGui.GuiUsersAddProfile]: { result: number; };
    [ShellAPIGui.GuiUsersDeleteProfile]: {};
    [ShellAPIGui.GuiUsersGetDefaultProfile]: { result: IShellProfile; };
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
    [ShellAPIGui.GuiModulesAddData]: { result: number; };
    [ShellAPIGui.GuiModulesListData]: { result: IShellModuleDataEntry[]; };
    [ShellAPIGui.GuiModulesGetDataContent]: { result: string; };
    [ShellAPIGui.GuiModulesShareDataToUserGroup]: {};
    [ShellAPIGui.GuiModulesAddDataToProfile]: {};
    [ShellAPIGui.GuiModulesUpdateData]: {};
    [ShellAPIGui.GuiModulesDeleteData]: {};
    [ShellAPIGui.GuiModulesListDataCategories]: { result: IShellModuleDataCategoriesEntry[]; };
    [ShellAPIGui.GuiModulesAddDataCategory]: {};
    [ShellAPIGui.GuiModulesRemoveDataCategory]: {};
    [ShellAPIGui.GuiModulesGetDataCategoryId]: {};
    [ShellAPIGui.GuiModulesCreateProfileDataTree]: {};
    [ShellAPIGui.GuiModulesGetProfileDataTree]: { result: IDBDataTreeEntry[]; };
    [ShellAPIGui.GuiModulesCreateUserGroupDataTree]: {};
    [ShellAPIGui.GuiModulesGetUserGroupDataTree]: {};
    [ShellAPIGui.GuiModulesGetProfileTreeIdentifiers]: {};
    [ShellAPIGui.GuiModulesMoveData]: {};
    [ShellAPIGui.GuiInfo]: {};
    [ShellAPIGui.GuiVersion]: {};
    [ShellAPIGui.GuiDbGetRoutinesMetadata]: { result: IDBSchemaObjectEntry[]; };
    [ShellAPIGui.GuiDbGetLibrariesMetadata]: { result: IDBSchemaObjectEntry[]; };
    [ShellAPIGui.GuiDbGetJdvTableColumnsWithReferences]: { result: IJdvTableColumnWithReference[]; };
    [ShellAPIGui.GuiDbGetJdvViewInfo]: { result: IJdvViewInfo; };
    [ShellAPIGui.GuiDbGetJdvObjectFieldsWithReferences]: { result: IJdvObjectFieldWithReference[]; };
    [ShellAPIGui.GuiCoreListFiles]: { result: string[]; };
    [ShellAPIGui.GuiCoreCreateFile]: { result: string; };
    [ShellAPIGui.GuiCoreValidatePath]: { result: string; };
    [ShellAPIGui.GuiCoreProbeLocalConnectionEndpoint]: { result: IShellDictionary; };
    [ShellAPIGui.GuiCoreDeleteFile]: {};
    [ShellAPIGui.GuiCoreSetPluginCommandMocks]: { result: boolean; };
    [ShellAPIGui.GuiCoreClearPluginCommandMocks]: { result: boolean; };
    [ShellAPIGui.GuiDbConnectionsGetServerStatusCache]: { result: Record<string, IAny> | null; };
    [ShellAPIGui.GuiLegacyDiscover]: { result: IShellDictionary; };
    [ShellAPIGui.GuiLegacyImportDiscoveredWorkbenchConnections]: { result: IShellDictionary; };
    [ShellAPIGui.GuiLegacyImportVsCode]: { result: IShellDictionary[]; };
    [ShellAPIGui.GuiLegacyImportMigrationAssistantProjects]: { result: IShellDictionary[]; };
    [ShellAPIGui.GuiSqlEditorReformat]: { result: string; };
    [ShellAPIGui.GuiMysqlExportErrorLogFile]: {};
    [ShellAPIGui.GuiMysqlExportErrorLogs]: {};
    [ShellAPIGui.GuiMysqlListUsers]: { result: IMySQLUserListItem[]; };
    [ShellAPIGui.GuiMysqlSetGrantedRoles]: {};
    [ShellAPIGui.GuiMysqlListGlobalPrivilegeCatalog]: { result: IMySQLGlobalPrivilegeCatalogItem[]; };
    [ShellAPIGui.GuiMysqlListSchemaPrivilegeCatalog]: { result: IMySQLGlobalPrivilegeCatalogItem[]; };
    [ShellAPIGui.GuiMysqlListObjectPrivilegeSchemaTargets]: { result: IMySQLObjectPrivilegeSchemaTarget[]; };
    [ShellAPIGui.GuiMysqlListAuthenticationPlugins]: { result: string[]; };
    [ShellAPIGui.GuiMysqlGetBundledAuthenticationPlugins]: { result: string[]; };
    [ShellAPIGui.GuiMysqlGetCreateUserDefaults]: { result: IMySQLDefaultUserOptions; };
    [ShellAPIGui.GuiMysqlGetPasswordResetInfo]: { result: IPasswordResetInfo; };
    [ShellAPIGui.GuiMysqlSetUserGlobalPrivileges]: {};
    [ShellAPIGui.GuiMysqlSetUserObjectPrivileges]: {};
    [ShellAPIGui.GuiMysqlGetUser]: { result: IMySQLUser | null; };
    [ShellAPIGui.GuiMysqlCreateUser]: { result: IUserInfo; };
    [ShellAPIGui.GuiMysqlDeleteUser]: {};
    [ShellAPIGui.GuiMysqlUpdateUser]: { result: IUserInfo; };
    [ShellAPIGui.GuiMebGetStatus]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebGetSetupState]: { result: IMebSetupState; };
    [ShellAPIGui.GuiMebValidateLocalBackupAccess]: { result: IMebPrerequisitesValidation; };
    [ShellAPIGui.GuiMebValidateBackupHome]: { result: IMebBackupHomeValidation; };
    [ShellAPIGui.GuiMebCreateBackupHome]: { result: IMebBackupHomeValidation; };
    [ShellAPIGui.GuiMebValidateBackupMysqlUser]: { result: IMebMysqlBackupUserValidation; };
    [ShellAPIGui.GuiMebCreateBackupMysqlUser]: { result: IMebMysqlBackupUserValidation; };
    [ShellAPIGui.GuiMebFixBackupMysqlUser]: { result: IMebMysqlBackupUserValidation; };
    [ShellAPIGui.GuiMebResetBackupMysqlUserPassword]: { result: IMebMysqlBackupUserValidation; };
    [ShellAPIGui.GuiMebApplySetup]: { result: IMebSetupState; };
    [ShellAPIGui.GuiMebSaveProfile]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebDeleteProfile]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebStartProfileExecution]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebDeleteBackup]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebVerifyBackup]: { result: IMebLogContent; };
    [ShellAPIGui.GuiMebApplyBackupLogs]: { result: IMebStatus; };
    [ShellAPIGui.GuiMebRestoreBackup]: { result: IMebRestoreResult; };
    [ShellAPIGui.GuiMebGetRestoreProgress]: { result: IMebRestoreProgress; };
    [ShellAPIGui.GuiMebAbortBackupRestore]: { result: IMebRestoreProgress; };
    [ShellAPIGui.GuiMebReadBackupContent]: { result: IMebBackupContent; };
    [ShellAPIGui.GuiMebGetBackupPath]: { result: string; };
    [ShellAPIGui.GuiMebReadLog]: { result: IMebLogContent; };
    [ShellAPIGui.GuiDebuggerGetScripts]: { result: string[]; };
    [ShellAPIGui.GuiDebuggerGetScriptContent]: { result: string; };
}

/**
 * A list of APIs that return more than a single result.
 * This is a temporary solution, until we get appropriate tags from the BE.
 */
export const multiResultAPIs = [
    ShellAPIGui.GuiCoreListFiles,
    ShellAPIGui.GuiDbExecute,
    ShellAPIGui.GuiDbGetSchemaObjectNames,
    ShellAPIGui.GuiDbGetRoutinesMetadata,
    ShellAPIGui.GuiDbGetLibrariesMetadata,
    ShellAPIGui.GuiDbConnectionsListDbConnections,
    ShellAPIGui.GuiModulesGetProfileDataTree,
    ShellAPIGui.GuiShellComplete,
    ShellAPIGui.GuiSqlEditorExecute,
    ShellAPIGui.GuiSqlEditorVisualExplain,
    ShellAPIGui.GuiDbGetCatalogObjectNames,
    ShellAPIGui.GuiDbGetTableObjectNames,
] as const;
