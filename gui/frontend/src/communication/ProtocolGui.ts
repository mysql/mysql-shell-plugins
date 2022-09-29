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

import { Protocol, IShellRequest, IShellDictionary } from ".";

import _ from "lodash";

export interface IConversionOptions {
    ignore?: string[];
}

export const convertCamelToSnakeCase = (o: object, options?: IConversionOptions): object => {
    return _.deepMapKeys(o, options?.ignore ?? [], (value, key) => {
        const snakeCased = key.replace(/([a-z])([A-Z])/g, (full, match1: string, match2: string) => {
            return `${match1}_${match2.toLowerCase()}`;
        });

        return snakeCased;
    });
};
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

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

//  Begin auto generated types

export interface IShellCoreIsShellWebCertificateInstalledKwargs {
    checkKeychain?: boolean;
}


export interface IShellCoreInstallShellWebCertificateKwargs {
    keychain?: boolean;
    replaceExisting?: boolean;
}


export interface IShellDbConnection {
    dbType: string | null;
    caption: string | null;
    description: string | null;
    options: IShellDictionary | null;
}


export interface IShellQueryOptions {
    rowPacketSize?: number;
}


export interface IShellUsersUpdateProfileProfile {
    id: number | null;
    name: string | null;
    description: string | null;
    options: IShellDictionary | null;
}


export interface IShellUsersAddProfileProfile {
    name: string | null;
    description: string | null;
    options: IShellDictionary | null;
}

//  End auto generated types

export class ProtocolGui extends Protocol {
    //  Begin auto generated content
    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns False
     */
    public static getRequestClusterIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiClusterIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns A dict with display information for the module
     */
    public static getRequestClusterGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiClusterGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Sets the log level
     *
     * @param logLevel Level of logging
     *
     * @returns Not documented
     *
     * Change the logging level for the Backend Server, or disable logging.
     *
     * <b>The 'log_level' argument can be one of:</b>
     *
     *     - none,     - internal_error,     - error,     - warning,     - info,
     * - debug,     - debug2,     - debug3
     *
     * Specifying 'none' disables logging. Level `info` is the default if you do
     * not specify this option.
     *
     * <b>Returns:</b>
     *
     *     The generated shell request record.
     */
    public static getRequestCoreSetLogLevel(logLevel = "INFO"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreSetLogLevel,
            {
                args: {
                    log_level: logLevel,
                },
            });
    }

    /**
     * Gets the current log level
     *
     * @returns The generated shell request record.
     */
    public static getRequestCoreGetLogLevel(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreGetLogLevel,
            {
                args: {},
            });
    }

    /**
     * Returns the contents of a directory.
     *
     * @param path The path to get the contents from
     *
     * @returns Not documented
     *
     * It gets the contents of the specified directory and returns them. If
     * running in multi-user mode, the directory is relative to the user space and
     * requests outside the user space will result in error. If running in single-
     * user mode, absolute paths area allowed, but if a relative path is supplied,
     * then it will be relative to the system user home directory. If the path is
     * empty, "." or "./" it will be resolved as the root to the relative path in
     * the running mode.
     *
     * <b>Returns:</b>
     *
     *     A list of files that exist in the requested directory
     */
    public static getRequestCoreListFiles(path = ""): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreListFiles,
            {
                args: {
                    path,
                },
            });
    }

    /**
     * Creates a new file specified by the path.
     *
     * @param path The path and file name relative to the user space
     *
     * @returns Not documented
     *
     * If running in multi-user mode, the directory is relative to the user space
     * and requests outside the user space will result in error. If running in
     * single-user mode, absolute paths area allowed, but if a relative path is
     * supplied, then it will be relative to the system user home directory. If
     * the path starts with "." or "./" it will be resolved as the root to the
     * relative path in the running mode.
     *
     * The file type to be created is determined by the file extension.
     *
     * <b>The supported file types are as follows:</b>
     *
     *     - SQLITE (use the .sqlite or .sqlite3 extensions)
     *
     * <b>Returns:</b>
     *
     *     The path to the created file on success.
     */
    public static getRequestCoreCreateFile(path: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreCreateFile,
            {
                args: {
                    path,
                },
            });
    }

    /**
     * Validates the specified path.
     *
     * @param path The path to a directory or file
     *
     * @returns Not documented
     *
     * If running in multi-user mode, the directory is relative to the user space
     * and requests outside the user space will result in error. If running in
     * single-user mode, absolute paths area allowed, but if a relative path is
     * supplied, then it will be relative to the system user home directory. If
     * the path is empty, "." or "./" it will be resolved as the root to the
     * relative path in the running mode.
     *
     * <b>Returns:</b>
     *
     *     The path to the created file on success.
     */
    public static getRequestCoreValidatePath(path: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreValidatePath,
            {
                args: {
                    path,
                },
            });
    }

    /**
     * Returns information about backend
     *
     * @returns A dict with information about backend
     */
    public static getRequestCoreGetBackendInformation(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreGetBackendInformation,
            {
                args: {},
            });
    }

    /**
     * Checks if the MySQL Shell GUI webserver certificate is installed
     *
     * @param kwargs Optional parameters
     *
     * @returns True if installed
     */
    public static getRequestCoreIsShellWebCertificateInstalled(kwargs?: IShellCoreIsShellWebCertificateInstalledKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                check_keychain: kwargs.checkKeychain,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreIsShellWebCertificateInstalled,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Installs the MySQL Shell GUI webserver certificate
     *
     * @param kwargs Optional parameters
     *
     * @returns True if successfully installed
     */
    public static getRequestCoreInstallShellWebCertificate(kwargs?: IShellCoreInstallShellWebCertificateKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                keychain: kwargs.keychain,
                replace_existing: kwargs.replaceExisting,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreInstallShellWebCertificate,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Removes the MySQL Shell GUI webserver certificate
     *
     * @returns True if successfully removed
     */
    public static getRequestCoreRemoveShellWebCertificate(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiCoreRemoveShellWebCertificate,
            {
                args: {},
            });
    }

    /**
     * Add a new db_connection and associate the connection with a profile
     *
     * @param profileId The id of the profile
     * @param connection The connection information as a dict, e.g. { "db_type": "MySQL", "caption": "Local MySQL Server", "description": "Connection to local MySQL Server on 3306", "options": { "uri": "mysql://mike@localhost:3306/test", "password": "myPassword2BeStoredEncrypted" }}
     * @param folderPath The folder path used for grouping and nesting connections, optional
     *
     * @returns int: The connection ID
     */
    public static getRequestDbconnectionsAddDbConnection(profileId: number, connection: IShellDbConnection, folderPath = ""): IShellRequest {

        const connectionToUse = {
            db_type: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: connection.options,
        };

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsAddDbConnection,
            {
                args: {
                    profile_id: profileId,
                    connection: connectionToUse,
                    folder_path: folderPath,
                },
            });
    }

    /**
     * Update the data for a database connection
     *
     * @param profileId The id of the profile
     * @param connectionId The id of the connection to update
     * @param connection The connection information as a dict, e.g. { "caption": "Local MySQL Server", "description": "Connection to local MySQL Server on 3306", "options": { "uri": "mysql://mike@localhost:3306/test", "password": "myPassword2BeStoredEncrypted" }, }
     * @param folderPath The folder path used for grouping and nesting connections, optional
     *
     * @returns None
     */
    public static getRequestDbconnectionsUpdateDbConnection(profileId: number, connectionId: number, connection: IShellDbConnection, folderPath = ""): IShellRequest {

        const connectionToUse = {
            db_type: connection.dbType,
            caption: connection.caption,
            description: connection.description,
            options: connection.options,
        };

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsUpdateDbConnection,
            {
                args: {
                    profile_id: profileId,
                    connection_id: connectionId,
                    connection: connectionToUse,
                    folder_path: folderPath,
                },
            });
    }

    /**
     * Remove a db_connection by disassociating the connection from a profile
     *
     * @param profileId The id of the profile
     * @param connectionId The connection id to remove
     *
     * @returns None
     */
    public static getRequestDbconnectionsRemoveDbConnection(profileId: number, connectionId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsRemoveDbConnection,
            {
                args: {
                    profile_id: profileId,
                    connection_id: connectionId,
                },
            });
    }

    /**
     * Lists the db_connections for the given profile
     *
     * @param profileId The id of the profile
     * @param folderPath The folder path used for grouping and nesting connections, optional
     *
     * @returns list: the list of connections
     */
    public static getRequestDbconnectionsListDbConnections(profileId: number, folderPath = ""): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsListDbConnections,
            {
                args: {
                    profile_id: profileId,
                    folder_path: folderPath,
                },
            });
    }

    /**
     * Get the a db_connection
     *
     * @param dbConnectionId The id of the db_connection
     *
     * @returns dict: The db connection
     */
    public static getRequestDbconnectionsGetDbConnection(dbConnectionId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsGetDbConnection,
            {
                args: {
                    db_connection_id: dbConnectionId,
                },
            });
    }

    /**
     * Get the list of db_types
     *
     * @returns list: The list of db types
     */
    public static getRequestDbconnectionsGetDbTypes(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsGetDbTypes,
            {
                args: {},
            });
    }

    /**
     * Set the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     * @param password The password
     *
     * @returns None
     */
    public static getRequestDbconnectionsSetCredential(url: string, password: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsSetCredential,
            {
                args: {
                    url,
                    password,
                },
            });
    }

    /**
     * Deletes the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     *
     * @returns None
     */
    public static getRequestDbconnectionsDeleteCredential(url: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsDeleteCredential,
            {
                args: {
                    url,
                },
            });
    }

    /**
     * Lists the db_connection urls that have a password stored
     *
     * @returns list: The list of db_connection urls that have a password stored
     */
    public static getRequestDbconnectionsListCredentials(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsListCredentials,
            {
                args: {},
            });
    }

    /**
     * Opens test connection
     *
     * @param connection The id of the db_connection or connection information
     * @param password The password to use when opening the connection. If not supplied, then use the password defined in the database options.
     *
     * @returns Not documented
     *
     * <b>Allowed options for connection:</b>
     *
     *     db_type (str,required): The db type name     options (dict,required):
     * The options specific for the current database type
     *
     * <b>Returns:</b>
     *
     *     None
     */
    public static getRequestDbconnectionsTestConnection(connection: IShellDbConnection | number, password?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsTestConnection,
            {
                args: {
                    connection,
                    password,
                },
            });
    }

    /**
     * Updates the connections sort order for the given profile
     *
     * @param profileId The id of the profile
     * @param folderPath The folder path used for grouping and nesting connections
     * @param connectionIdToMove The id of the connection to move
     * @param connectionIdOffset The id of the offset connection
     * @param before Indicates whether connection_id_to_move should be moved before connection_id_offset or after
     *
     * @returns None
     */
    public static getRequestDbconnectionsMoveConnection(profileId: number, folderPath: string, connectionIdToMove: number, connectionIdOffset: number, before = false): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbconnectionsMoveConnection,
            {
                args: {
                    profile_id: profileId,
                    folder_path: folderPath,
                    connection_id_to_move: connectionIdToMove,
                    connection_id_offset: connectionIdOffset,
                    before,
                },
            });
    }

    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns False
     */
    public static getRequestMdsIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiMdsIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns A dict with display information for the module
     */
    public static getRequestMdsGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiMdsGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns False
     */
    public static getRequestModelerIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModelerIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns A dict with display information for the module
     */
    public static getRequestModelerGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModelerGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns bool: True
     */
    public static getRequestShellIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns dict: display information for the module
     */
    public static getRequestShellGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Starts a new Shell Interactive Session
     *
     * @param dbConnectionId The id of the connection id to use on the shell session.
     * @param shellArgs The list of command line arguments required to execute a specific operation.
     *
     * @returns None
     */
    public static getRequestShellStartSession(dbConnectionId?: number, shellArgs?: unknown[]): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellStartSession,
            {
                args: {
                    db_connection_id: dbConnectionId,
                    shell_args: shellArgs,
                },
            });
    }

    /**
     * Closes the Shell Interactive Session
     *
     * @param moduleSessionId The string id for the module session object that should be closed
     *
     * @returns None
     */
    public static getRequestShellCloseSession(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellCloseSession,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Execute a shell command
     *
     * @param command The shell command to run in the interactive shell
     * @param moduleSessionId The string id for the module session object where the command will be executed
     *
     * @returns None
     */
    public static getRequestShellExecute(command: string, moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellExecute,
            {
                args: {
                    command,
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Retrieve options to complete the given text on the shell context
     *
     * @param data The shell text to be completed
     * @param offset Completion offset
     * @param moduleSessionId The string id for the module session object where the completion will be executed
     *
     * @returns None
     */
    public static getRequestShellComplete(data: string, offset: number, moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellComplete,
            {
                args: {
                    data,
                    offset,
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Kill a shell task
     *
     * @param moduleSessionId The module_session object that should be closed
     *
     * @returns None
     */
    public static getRequestShellKillTask(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiShellKillTask,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Returns the database objects supported by a DBMS
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     *
     * @returns object: The list of the database objects
     */
    public static getRequestDbGetObjectsTypes(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetObjectsTypes,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Returns the names of the existing objects of the given     type. If a filter is provided, only the names matching the given filter will be returned.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the catalog object type
     * @param filter object filter
     *
     * @returns object: The list of names
     */
    public static getRequestDbGetCatalogObjectNames(moduleSessionId: string, type: string, filter = "%"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetCatalogObjectNames,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    filter,
                },
            });
    }

    /**
     * Returns the names of the existing objects of the given type in the given     schema that match the provided filter.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the schema object type
     * @param schemaName schema name
     * @param filter object filter
     * @param routineType type of the routine ['procedure'|'function']
     *
     * @returns object: The list of names
     */
    public static getRequestDbGetSchemaObjectNames(moduleSessionId: string, type: string, schemaName: string, filter = "%", routineType?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetSchemaObjectNames,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    schema_name: schemaName,
                    filter,
                    routine_type: routineType,
                },
            });
    }

    /**
     * Returns the names of the existing objects of the given type in the given     table that match the provided filter.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the table object type
     * @param schemaName schema name
     * @param tableName table name
     * @param filter object filter
     *
     * @returns object: The list of names
     */
    public static getRequestDbGetTableObjectNames(moduleSessionId: string, type: string, schemaName: string, tableName: string, filter = "%"): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetTableObjectNames,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    schema_name: schemaName,
                    table_name: tableName,
                    filter,
                },
            });
    }

    /**
     * Returns a JSON representation of the object matching the given type and name.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the catalog object type
     * @param name object name
     *
     * @returns object: The catalog object
     */
    public static getRequestDbGetCatalogObject(moduleSessionId: string, type: string, name: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetCatalogObject,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    name,
                },
            });
    }

    /**
     * Returns a JSON representation of the schema object matching the given type, schema and name.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the database object type
     * @param schemaName schema name
     * @param name object name
     *
     * @returns object: The database object
     */
    public static getRequestDbGetSchemaObject(moduleSessionId: string, type: string, schemaName: string, name: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetSchemaObject,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    schema_name: schemaName,
                    name,
                },
            });
    }

    /**
     * Returns a JSON representation of the table object matching the given type, schema, table and name.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param type the database object type
     * @param schemaName schema name
     * @param tableName table name
     * @param name object name
     *
     * @returns object: The database object
     */
    public static getRequestDbGetTableObject(moduleSessionId: string, type: string, schemaName: string, tableName: string, name: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbGetTableObject,
            {
                args: {
                    module_session_id: moduleSessionId,
                    type,
                    schema_name: schemaName,
                    table_name: tableName,
                    name,
                },
            });
    }

    /**
     * Starts a DB Session
     *
     * @param connection The id of the db_connection or connection information
     * @param password The password to use when opening the connection. If not supplied, then use the password defined in the database options.
     *
     * @returns A dict holding the result message
     */
    public static getRequestDbStartSession(connection: IShellDbConnection | number, password?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbStartSession,
            {
                args: {
                    connection: typeof connection === "number" ? connection : convertCamelToSnakeCase(connection),
                    password,
                },
            });
    }

    /**
     * Closes the DB Session
     *
     * @param moduleSessionId The string id for the module session object that should be closed
     *
     * @returns A dict holding the result message
     */
    public static getRequestDbCloseSession(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbCloseSession,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Reconnects the DB Session
     *
     * @param moduleSessionId The session where the session will be reconnected
     *
     * @returns A dict holding the result message and the connection information     when available.
     */
    public static getRequestDbReconnect(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDbReconnect,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns bool: True
     */
    public static getRequestSqleditorIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns dict: display information for the module
     */
    public static getRequestSqleditorGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Starts a SQL Editor Session
     *
     * @returns dict: contains module session ID
     */
    public static getRequestSqleditorStartSession(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorStartSession,
            {
                args: {},
            });
    }

    /**
     * Closes the SQL Editor Session
     *
     * @param moduleSessionId The string id for the module session object that should be closed
     *
     * @returns None
     */
    public static getRequestSqleditorCloseSession(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorCloseSession,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Opens the SQL Editor Session
     *
     * @param dbConnectionId The id of the db_connection
     * @param moduleSessionId The session where the connection will open
     * @param password The password to use when opening the connection. If not supplied, then use the password defined in the database options.
     *
     * @returns None
     */
    public static getRequestSqleditorOpenConnection(dbConnectionId: number, moduleSessionId: string, password?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorOpenConnection,
            {
                args: {
                    db_connection_id: dbConnectionId,
                    module_session_id: moduleSessionId,
                    password,
                },
            });
    }

    /**
     * Reconnects the SQL Editor Session
     *
     * @param moduleSessionId The session where the session will be reconnected
     *
     * @returns None
     */
    public static getRequestSqleditorReconnect(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorReconnect,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Executes the given SQL.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param sql The sql command to execute.
     * @param params The parameters for the sql command.
     * @param options A dictionary that holds additional options, e.g. {"row_packet_size": -1}
     *
     * @returns dict: the result message
     */
    public static getRequestSqleditorExecute(moduleSessionId: string, sql: string, params?: unknown[], options?: IShellQueryOptions): IShellRequest {

        let optionsToUse;
        if (options) {
            optionsToUse = {
                row_packet_size: options.rowPacketSize,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorExecute,
            {
                args: {
                    module_session_id: moduleSessionId,
                    sql,
                    params,
                    options: optionsToUse,
                },
            });
    }

    /**
     * Stops the query that is currently executing.
     *
     * @param moduleSessionId The string id for the module session object where the query is running
     *
     * @returns None
     */
    public static getRequestSqleditorKillQuery(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorKillQuery,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Requests the current schema for this module.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     *
     * @returns str: current schema name
     */
    public static getRequestSqleditorGetCurrentSchema(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorGetCurrentSchema,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Requests to change the current schema for this module.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param schemaName The name of the schema to use
     *
     * @returns None
     */
    public static getRequestSqleditorSetCurrentSchema(moduleSessionId: string, schemaName: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorSetCurrentSchema,
            {
                args: {
                    module_session_id: moduleSessionId,
                    schema_name: schemaName,
                },
            });
    }

    /**
     * Requests the auto-commit status for this module.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     *
     * @returns int: auto-commit status
     */
    public static getRequestSqleditorGetAutoCommit(moduleSessionId: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorGetAutoCommit,
            {
                args: {
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Requests to change the auto-commit status for this module.
     *
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     * @param state The auto-commit state to set for the module session
     *
     * @returns None
     */
    public static getRequestSqleditorSetAutoCommit(moduleSessionId: string, state: boolean): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiSqleditorSetAutoCommit,
            {
                args: {
                    module_session_id: moduleSessionId,
                    state,
                },
            });
    }

    /**
     * Creates a new user account
     *
     * @param username The name of the user
     * @param password The user's password
     * @param role The role that should be granted to the user, optional
     * @param allowedHosts Allowed hosts that user can connect from
     *
     * @returns int: the user ID.
     */
    public static getRequestUsersCreateUser(username: string, password: string, role?: string, allowedHosts?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersCreateUser,
            {
                args: {
                    username,
                    password,
                    role,
                    allowed_hosts: allowedHosts,
                },
            });
    }

    /**
     * Sets the allowed hosts for the given user.
     *
     * @param userId The id of the user.
     * @param allowedHosts Allowed hosts that user can connect from
     *
     * @returns None
     */
    public static getRequestUsersSetAllowedHosts(userId: number, allowedHosts: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersSetAllowedHosts,
            {
                args: {
                    user_id: userId,
                    allowed_hosts: allowedHosts,
                },
            });
    }

    /**
     * Deletes a user account
     *
     * @param username    The name of the user
     *
     * @returns None
     */
    public static getRequestUsersDeleteUser(username: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersDeleteUser,
            {
                args: {
                    username,
                },
            });
    }

    /**
     * Grant the given roles to the user.
     *
     * @param username The name of the user
     * @param role The list of roles that should be assigned to the user. Use listRoles() to list all available roles.
     *
     * @returns None
     */
    public static getRequestUsersGrantRole(username: string, role: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersGrantRole,
            {
                args: {
                    username,
                    role,
                },
            });
    }

    /**
     * Gets the id for a given user.
     *
     * @param username The user for which the id will be returned.
     *
     * @returns int: the user ID.
     */
    public static getRequestUsersGetUserId(username: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersGetUserId,
            {
                args: {
                    username,
                },
            });
    }

    /**
     * Lists all user accounts.
     *
     * @returns list: the list of users.
     */
    public static getRequestUsersListUsers(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListUsers,
            {
                args: {},
            });
    }

    /**
     * List the granted roles for a given user.
     *
     * @param username The name of the user
     *
     * @returns list: the list of roles.
     */
    public static getRequestUsersListUserRoles(username: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListUserRoles,
            {
                args: {
                    username,
                },
            });
    }

    /**
     * Lists all roles that can be assigned to users.
     *
     * @returns list: the list of roles.
     */
    public static getRequestUsersListRoles(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListRoles,
            {
                args: {},
            });
    }

    /**
     * Lists all privileges of a role.
     *
     * @param role The name of the role.
     *
     * @returns list: the list of privileges.
     */
    public static getRequestUsersListRolePrivileges(role: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListRolePrivileges,
            {
                args: {
                    role,
                },
            });
    }

    /**
     * Lists all privileges assigned to a user.
     *
     * @param username The name of the user.
     *
     * @returns list: the list of privileges.
     */
    public static getRequestUsersListUserPrivileges(username: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListUserPrivileges,
            {
                args: {
                    username,
                },
            });
    }

    /**
     * Returns the list of modules for the given user.
     *
     * @param userId The id of the user.
     *
     * @returns list: the list of modules.
     */
    public static getRequestUsersGetGuiModuleList(userId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersGetGuiModuleList,
            {
                args: {
                    user_id: userId,
                },
            });
    }

    /**
     * Returns the list of profile for the given user
     *
     * @param userId The id of the user.
     *
     * @returns list: the list of profiles.
     */
    public static getRequestUsersListProfiles(userId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListProfiles,
            {
                args: {
                    user_id: userId,
                },
            });
    }

    /**
     * Returns the specified profile.
     *
     * @param profileId The id of the profile.
     *
     * @returns dict: the user profile.
     */
    public static getRequestUsersGetProfile(profileId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersGetProfile,
            {
                args: {
                    profile_id: profileId,
                },
            });
    }

    /**
     * Updates a user profile.
     *
     * @param profile A dictionary with the profile information
     *
     * @returns None
     */
    public static getRequestUsersUpdateProfile(profile: IShellUsersUpdateProfileProfile): IShellRequest {

        const profileToUse = {
            id: profile.id,
            name: profile.name,
            description: profile.description,
            options: profile.options,
        };

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersUpdateProfile,
            {
                args: {
                    profile: profileToUse,
                },
            });
    }

    /**
     * Returns the specified profile.
     *
     * @param userId The id of the user.
     * @param profile The profile to add
     *
     * @returns int: the profile ID.
     */
    public static getRequestUsersAddProfile(userId: number, profile: IShellUsersAddProfileProfile): IShellRequest {

        const profileToUse = {
            name: profile.name,
            description: profile.description,
            options: profile.options,
        };

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersAddProfile,
            {
                args: {
                    user_id: userId,
                    profile: profileToUse,
                },
            });
    }

    /**
     * Deletes a profile for the current user.
     *
     * @param userId The id of the user to which the profile belongs to.
     * @param profileId The ID of the profile to delete.
     *
     * @returns None
     */
    public static getRequestUsersDeleteProfile(userId: number, profileId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersDeleteProfile,
            {
                args: {
                    user_id: userId,
                    profile_id: profileId,
                },
            });
    }

    /**
     * Returns the default profile for the given user.
     *
     * @param userId The id of the user.
     *
     * @returns dict: the user profile.
     */
    public static getRequestUsersGetDefaultProfile(userId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersGetDefaultProfile,
            {
                args: {
                    user_id: userId,
                },
            });
    }

    /**
     * Sets the default profile for the given user.
     *
     * @param userId The id of the user.
     * @param profileId The id of the profile to become the default profile
     *
     * @returns None
     */
    public static getRequestUsersSetDefaultProfile(userId: number, profileId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersSetDefaultProfile,
            {
                args: {
                    user_id: userId,
                    profile_id: profileId,
                },
            });
    }

    /**
     * Sets the profile of the user's current web session.
     *
     * @param profileId The id of the profile to become the current profile
     *
     * @returns None
     */
    public static getRequestUsersSetCurrentProfile(profileId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersSetCurrentProfile,
            {
                args: {
                    profile_id: profileId,
                },
            });
    }

    /**
     * Returns the list of all groups or list all groups that given user belongs.
     *
     * @param memberId User ID
     *
     * @returns list: the list od user groups.
     */
    public static getRequestUsersListUserGroups(memberId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersListUserGroups,
            {
                args: {
                    member_id: memberId,
                },
            });
    }

    /**
     * Creates user group.
     *
     * @param name Group name
     * @param description Description of the group
     *
     * @returns int: the group ID.
     */
    public static getRequestUsersCreateUserGroup(name: string, description: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersCreateUserGroup,
            {
                args: {
                    name,
                    description,
                },
            });
    }

    /**
     * Adds user to user group.
     *
     * @param memberId User ID
     * @param groupId Group ID
     * @param owner If user is owner
     *
     * @returns None
     */
    public static getRequestUsersAddUserToGroup(memberId: number, groupId: number, owner = 0): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersAddUserToGroup,
            {
                args: {
                    member_id: memberId,
                    group_id: groupId,
                    owner,
                },
            });
    }

    /**
     * Removes user from user group.
     *
     * @param memberId User ID
     * @param groupId Group ID
     *
     * @returns None
     */
    public static getRequestUsersRemoveUserFromGroup(memberId: number, groupId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersRemoveUserFromGroup,
            {
                args: {
                    member_id: memberId,
                    group_id: groupId,
                },
            });
    }

    /**
     * Updates user group.
     *
     * @param groupId Group ID
     * @param name Group name
     * @param description Description of the group
     *
     * @returns None
     */
    public static getRequestUsersUpdateUserGroup(groupId: number, name?: string, description?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersUpdateUserGroup,
            {
                args: {
                    group_id: groupId,
                    name,
                    description,
                },
            });
    }

    /**
     * Removes given user group.
     *
     * @param groupId Group ID
     *
     * @returns None
     */
    public static getRequestUsersRemoveUserGroup(groupId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiUsersRemoveUserGroup,
            {
                args: {
                    group_id: groupId,
                },
            });
    }

    /**
     * Indicates whether this module is a GUI backend module
     *
     * @returns True
     */
    public static getRequestDebuggerIsGuiModuleBackend(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDebuggerIsGuiModuleBackend,
            {
                args: {},
            });
    }

    /**
     * Returns display information about the module
     *
     * @returns A dict with display information for the module
     */
    public static getRequestDebuggerGetGuiModuleDisplayInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDebuggerGetGuiModuleDisplayInfo,
            {
                args: {},
            });
    }

    /**
     * Returns the list of available scripts
     *
     * @returns A dict holding the result message
     */
    public static getRequestDebuggerGetScripts(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDebuggerGetScripts,
            {
                args: {},
            });
    }

    /**
     * Returns the content of the given script
     *
     * @param path The path to the script
     *
     * @returns A dict holding the result message
     *
     * The default behavior of this function is to return the script content
     * exactly as defined.
     */
    public static getRequestDebuggerGetScriptContent(path: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiDebuggerGetScriptContent,
            {
                args: {
                    path,
                },
            });
    }

    /**
     * Creates a new Module Data record for the given module    and associates it to the active user profile and personal user group.
     *
     * @param caption The data caption
     * @param content The content of data module
     * @param dataCategoryId The id of data category
     * @param treeIdentifier The identifier of the tree
     * @param folderPath The folder path f.e. "/scripts/server1"
     * @param profileId The id of profile
     *
     * @returns int: the id of the new record.
     */
    public static getRequestModulesAddData(caption: string, content: string, dataCategoryId: number, treeIdentifier: string, folderPath?: string, profileId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesAddData,
            {
                args: {
                    caption,
                    content,
                    data_category_id: dataCategoryId,
                    tree_identifier: treeIdentifier,
                    folder_path: folderPath,
                    profile_id: profileId,
                },
            });
    }

    /**
     * Get list of data
     *
     * @param folderId The id of the folder
     * @param dataCategoryId The id of data category
     *
     * @returns list: the list of the data.
     */
    public static getRequestModulesListData(folderId: number, dataCategoryId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesListData,
            {
                args: {
                    folder_id: folderId,
                    data_category_id: dataCategoryId,
                },
            });
    }

    /**
     * Gets content of the given module
     *
     * @param id The id of the data
     *
     * @returns dict: the content of the data.
     */
    public static getRequestModulesGetDataContent(id: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesGetDataContent,
            {
                args: {
                    id,
                },
            });
    }

    /**
     * Shares data to user group
     *
     * @param id The id of the data
     * @param userGroupId The id of user group
     * @param readOnly The flag that specifies whether the data is read only
     * @param treeIdentifier The identifier of the tree
     * @param folderPath The folder path f.e. "/scripts/server1"
     *
     * @returns int: the id of the folder to which the data was shared.
     */
    public static getRequestModulesShareDataToUserGroup(id: number, userGroupId: number, readOnly: number, treeIdentifier: string, folderPath?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesShareDataToUserGroup,
            {
                args: {
                    id,
                    user_group_id: userGroupId,
                    read_only: readOnly,
                    tree_identifier: treeIdentifier,
                    folder_path: folderPath,
                },
            });
    }

    /**
     * Shares data to profile
     *
     * @param id The id of the data
     * @param profileId The id of profile
     * @param readOnly The flag that specifies whether the data is read only
     * @param treeIdentifier The identifier of the tree
     * @param folderPath The folder path f.e. "/scripts/server1"
     *
     * @returns The id of the folder to which the data was shared.
     */
    public static getRequestModulesAddDataToProfile(id: number, profileId: number, readOnly: number, treeIdentifier: string, folderPath?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesAddDataToProfile,
            {
                args: {
                    id,
                    profile_id: profileId,
                    read_only: readOnly,
                    tree_identifier: treeIdentifier,
                    folder_path: folderPath,
                },
            });
    }

    /**
     * Update data of the given module
     *
     * @param id The id of the data
     * @param caption Caption
     * @param content The content data
     *
     * @returns int: the id of the updated record.
     */
    public static getRequestModulesUpdateData(id: number, caption?: string, content?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesUpdateData,
            {
                args: {
                    id,
                    caption,
                    content,
                },
            });
    }

    /**
     * Deletes data
     *
     * @param id The id of the data
     * @param folderId The id of the folder
     *
     * @returns int: the id of the deleted record.
     */
    public static getRequestModulesDeleteData(id: number, folderId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesDeleteData,
            {
                args: {
                    id,
                    folder_id: folderId,
                },
            });
    }

    /**
     * Gets the list of available data categories and sub categories    for the given name.
     *
     * @param categoryId The id of the data category
     *
     * @returns The list of available data categories
     */
    public static getRequestModulesListDataCategories(categoryId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesListDataCategories,
            {
                args: {
                    category_id: categoryId,
                },
            });
    }

    /**
     * Add a new data category to the list of available data categories for this module
     *
     * @param name The name of the data category
     * @param parentCategoryId The id of the parent category
     *
     * @returns int: the id of added category.
     */
    public static getRequestModulesAddDataCategory(name: string, parentCategoryId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesAddDataCategory,
            {
                args: {
                    name,
                    parent_category_id: parentCategoryId,
                },
            });
    }

    /**
     * Remove a data category from the list of available data categories for this module
     *
     * @param categoryId The id of the data category
     *
     * @returns int: the id of the removed category.
     */
    public static getRequestModulesRemoveDataCategory(categoryId: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesRemoveDataCategory,
            {
                args: {
                    category_id: categoryId,
                },
            });
    }

    /**
     * Gets id for given name and module id.
     *
     * @param name The name of the data category
     *
     * @returns int: the id of the data category.
     */
    public static getRequestModulesGetDataCategoryId(name: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesGetDataCategoryId,
            {
                args: {
                    name,
                },
            });
    }

    /**
     * Creates the profile data tree for the given tree identifier and profile id.
     *
     * @param treeIdentifier The identifier of the tree
     * @param profileId The id of profile
     *
     * @returns int: the id of the root folder.
     */
    public static getRequestModulesCreateProfileDataTree(treeIdentifier: string, profileId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesCreateProfileDataTree,
            {
                args: {
                    tree_identifier: treeIdentifier,
                    profile_id: profileId,
                },
            });
    }

    /**
     * Gets the profile data tree for the given tree identifier and profile id.
     *
     * @param treeIdentifier The identifier of the tree
     * @param profileId The id of profile
     *
     * @returns list: the list of all folders in data tree.
     */
    public static getRequestModulesGetProfileDataTree(treeIdentifier: string, profileId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesGetProfileDataTree,
            {
                args: {
                    tree_identifier: treeIdentifier,
                    profile_id: profileId,
                },
            });
    }

    /**
     * Creates the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree
     * @param userGroupId The id of user group
     *
     * @returns int: the id of the root folder.
     */
    public static getRequestModulesCreateUserGroupDataTree(treeIdentifier: string, userGroupId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesCreateUserGroupDataTree,
            {
                args: {
                    tree_identifier: treeIdentifier,
                    user_group_id: userGroupId,
                },
            });
    }

    /**
     * Gets the user group data tree for the given tree identifier and user group id.
     *
     * @param treeIdentifier The identifier of the tree
     * @param userGroupId The id of user group
     *
     * @returns list: the list of all folders in data tree.
     */
    public static getRequestModulesGetUserGroupDataTree(treeIdentifier: string, userGroupId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesGetUserGroupDataTree,
            {
                args: {
                    tree_identifier: treeIdentifier,
                    user_group_id: userGroupId,
                },
            });
    }

    /**
     * Gets the tree identifiers associated with the given profile.
     *
     * @param profileId The id of profile
     *
     * @returns list: the list of tree identifiers.
     */
    public static getRequestModulesGetProfileTreeIdentifiers(profileId?: number): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesGetProfileTreeIdentifiers,
            {
                args: {
                    profile_id: profileId,
                },
            });
    }

    /**
     * Moves data from source path to target path.
     *
     * @param id The id of the data
     * @param treeIdentifier The identifier of the tree
     * @param linkedTo ['profile'|'group']
     * @param linkId The profile id or the group id (depending on linked_to)
     * @param sourcePath The source folder path f.e. "/scripts/server1"
     * @param targetPath The target folder path f.e. "/scripts/server2"
     *
     * @returns int: the id of the moved record.
     */
    public static getRequestModulesMoveData(id: number, treeIdentifier: string, linkedTo: string, linkId: number, sourcePath: string, targetPath: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiModulesMoveData,
            {
                args: {
                    id,
                    tree_identifier: treeIdentifier,
                    linked_to: linkedTo,
                    link_id: linkId,
                    source_path: sourcePath,
                    target_path: targetPath,
                },
            });
    }

    /**
     * Returns basic information about this plugin.
     *
     * @returns str
     */
    public static getRequestInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiInfo,
            {
                args: {},
            });
    }

    /**
     * Returns the version number of the plugin
     *
     * @returns str
     */
    public static getRequestVersion(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIGui.GuiVersion,
            {
                args: {},
            });
    }

    //  End auto generated content
}
