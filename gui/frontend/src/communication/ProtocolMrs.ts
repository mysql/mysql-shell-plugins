/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { IShellDictionary } from "./Protocol.js";
import { IDictionary } from "../app-logic/general-types.js";
import { MrsDbObjectType, MrsObjectKind, MrsSdkLanguage } from "../modules/mrs/types.js";

/* eslint-disable max-len */


export enum ShellAPIMrs {
    /** Returns basic information about this plugin. */
    MrsInfo = "mrs.info",
    /** Returns the version number of the plugin */
    MrsVersion = "mrs.version",
    /** Lists the schemas that are currently offered via MRS */
    MrsLs = "mrs.ls",
    /** Initializes and configures the MySQL REST Data Service */
    MrsConfigure = "mrs.configure",
    /** Checks the MRS service status and prints its */
    MrsStatus = "mrs.status",
    /** Marks the current version to be ignored during version upgrade checks */
    MrsIgnoreVersionUpgrade = "mrs.ignore_version_upgrade",
    /** Adds a new MRS service */
    MrsAddService = "mrs.add.service",
    /** Gets a specific MRS service */
    MrsGetService = "mrs.get.service",
    /** Get a list of MRS services */
    MrsListServices = "mrs.list.services",
    /** Enables a MRS service */
    MrsEnableService = "mrs.enable.service",
    /** Disables a MRS service */
    MrsDisableService = "mrs.disable.service",
    /** Deletes a MRS service */
    MrsDeleteService = "mrs.delete.service",
    /** Sets the url_context_root of a MRS service */
    MrsSetServiceContextPath = "mrs.set.service.context_path",
    /** Sets the protocol of a MRS service */
    MrsSetServiceProtocol = "mrs.set.service.protocol",
    /** Sets the comments of a MRS service */
    MrsSetServiceComments = "mrs.set.service.comments",
    /** Sets the options of a MRS service */
    MrsSetServiceOptions = "mrs.set.service.options",
    /** Sets all properties of a MRS service */
    MrsUpdateService = "mrs.update.service",
    /** Checks the availability of a given request path for the given service */
    MrsGetServiceRequestPathAvailability = "mrs.get.service_request_path_availability",
    /** Gets information about the current service */
    MrsGetCurrentServiceMetadata = "mrs.get.current_service_metadata",
    /** Sets the default MRS service */
    MrsSetCurrentService = "mrs.set.current_service",
    /** Returns the SDK base classes source for the given language */
    MrsGetSdkBaseClasses = "mrs.get.sdk_base_classes",
    /** Returns the SDK service classes source for the given language */
    MrsGetSdkServiceClasses = "mrs.get.sdk_service_classes",
    /** Dumps the SDK service files for a REST Service */
    MrsDumpSdkServiceFiles = "mrs.dump.sdk_service_files",
    /** Reads the SDK service option file located in a given directory */
    MrsGetSdkOptions = "mrs.get.sdk_options",
    /** Returns the SDK service classes source for the given language */
    MrsGetRuntimeManagementCode = "mrs.get.runtime_management_code",
    /** Returns the corresponding CREATE REST SERVICE SQL statement of the given MRS service object. */
    MrsGetServiceCreateStatement = "mrs.get.service_create_statement",
    /** Stores the corresponding CREATE REST SERVICE SQL statement of the given MRS service object into a file. */
    MrsDumpServiceCreateStatement = "mrs.dump.service_create_statement",
    /** Add a schema to the given MRS service */
    MrsAddSchema = "mrs.add.schema",
    /** Gets a specific MRS schema */
    MrsGetSchema = "mrs.get.schema",
    /** Returns all schemas for the given MRS service */
    MrsListSchemas = "mrs.list.schemas",
    /** Enables a schema of the given service */
    MrsEnableSchema = "mrs.enable.schema",
    /** Disables a schema of the given service */
    MrsDisableSchema = "mrs.disable.schema",
    /** Deletes a schema of the given service */
    MrsDeleteSchema = "mrs.delete.schema",
    /** Sets the name of a given schema */
    MrsSetSchemaName = "mrs.set.schema.name",
    /** Sets the request_path of a given schema */
    MrsSetSchemaRequestPath = "mrs.set.schema.request_path",
    /** Sets the requires_auth flag of the given schema */
    MrsSetSchemaRequiresAuth = "mrs.set.schema.requires_auth",
    /** Sets the items_per_page of a given schema */
    MrsSetSchemaItemsPerPage = "mrs.set.schema.items_per_page",
    /** Sets the comments of a given schema */
    MrsSetSchemaComments = "mrs.set.schema.comments",
    /** Updates the given schema */
    MrsUpdateSchema = "mrs.update.schema",
    /** Returns the corresponding CREATE REST SCHEMA SQL statement of the given MRS schema object. */
    MrsGetSchemaCreateStatement = "mrs.get.schema_create_statement",
    /** Stores the corresponding CREATE REST schema SQL statement of the given MRS schema object into a file. */
    MrsDumpSchemaCreateStatement = "mrs.dump.schema_create_statement",
    /** Adds an auth_app to the given MRS service */
    MrsGetAuthenticationVendors = "mrs.get.authentication_vendors",
    /** Adds an auth_app to the given MRS service */
    MrsAddAuthenticationApp = "mrs.add.authentication_app",
    /** Returns the requested authentication app */
    MrsGetAuthenticationApp = "mrs.get.authentication_app",
    /** Returns all authentication apps for the given MRS service */
    MrsListAuthenticationApps = "mrs.list.authentication_apps",
    /** Deletes an existing auth_app */
    MrsDeleteAuthenticationApp = "mrs.delete.authentication_app",
    /** Updates an existing auth_app */
    MrsUpdateAuthenticationApp = "mrs.update.authentication_app",
    /** Returns the corresponding CREATE REST AUTH APP SQL statement of the given MRS service object. */
    MrsGetAuthAppCreateStatement = "mrs.get.auth_app_create_statement",
    /** Stores the corresponding CREATE REST AUTH APP SQL statement of the given MRS schema object into a file. */
    MrsDumpAuthAppCreateStatement = "mrs.dump.auth_app_create_statement",
    /** Add a db_object to the given MRS schema */
    MrsAddDbObject = "mrs.add.db_object",
    /** Gets a specific MRS db_object */
    MrsGetDbObject = "mrs.get.db_object",
    /** Returns all db_objects for the given schema */
    MrsListDbObjects = "mrs.list.db_objects",
    /** Gets the list of available parameters given db_object representing a STORED PROCEDURE or FUNCTION */
    MrsGetDbObjectParameters = "mrs.get.db_object_parameters",
    /** Gets the return data type of the FUNCTION */
    MrsGetDbFunctionReturnType = "mrs.get.db_function_return_type",
    /** Sets the request_path of the given db_object */
    MrsSetDbObjectRequestPath = "mrs.set.dbObject.request_path",
    /** Enables a db_object of the given schema */
    MrsEnableDbObject = "mrs.enable.db_object",
    /** Disables a db_object of the given schema */
    MrsDisableDbObject = "mrs.disable.db_object",
    /** Deletes a db_object of the given schema */
    MrsDeleteDbObject = "mrs.delete.db_object",
    /** Update a db_object */
    MrsUpdateDbObject = "mrs.update.db_object",
    /** Gets the list of table columns and references */
    MrsGetTableColumnsWithReferences = "mrs.get.table_columns_with_references",
    /** Gets the list of objects for the given db_object */
    MrsGetObjects = "mrs.get.objects",
    /** Gets the list of object fields and references */
    MrsGetObjectFieldsWithReferences = "mrs.get.object_fields_with_references",
    /** Returns the corresponding CREATE REST <DB OBJECT> SQL statement of the given MRS service object. */
    MrsGetDbObjectCreateStatement = "mrs.get.db_object_create_statement",
    /** Stores the corresponding CREATE REST <DB OBJECT> SQL statement of the given MRS schema object into a file. */
    MrsDumpDbObjectCreateStatement = "mrs.dump.db_object_create_statement",
    /** Adds content to the given MRS service */
    MrsAddContentSet = "mrs.add.content_set",
    /** Returns all content sets for the given MRS service */
    MrsGetContentSetCount = "mrs.get.content_set_count",
    /** Returns all content sets for the given MRS service */
    MrsListContentSets = "mrs.list.content_sets",
    /** Gets a specific MRS content_set */
    MrsGetContentSet = "mrs.get.content_set",
    /** Enables a content set of the given service */
    MrsEnableContentSet = "mrs.enable.content_set",
    /** Enables a content_set of the given service */
    MrsDisableContentSet = "mrs.disable.content_set",
    /** Delete a content_set of the given service */
    MrsDeleteContentSet = "mrs.delete.content_set",
    /** Returns the MRS Scripts definitions for the given file */
    MrsGetFileMrsScriptDefinitions = "mrs.get.file_mrs_script_definitions",
    /** Checks if the given path contains MRS Scripts */
    MrsGetFolderMrsScriptLanguage = "mrs.get.folder_mrs_script_language",
    /** Returns the MRS Scripts definitions for the given folder */
    MrsGetFolderMrsScriptDefinitions = "mrs.get.folder_mrs_script_definitions",
    /** Updates db_schemas and db_objects based on script definitions of the content set */
    MrsUpdateMrsScriptsFromContentSet = "mrs.update.mrs_scripts_from_content_set",
    /** Returns the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service object. */
    MrsGetContentSetCreateStatement = "mrs.get.content_set_create_statement",
    /** Stores the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service into a file. */
    MrsDumpContentSetCreateStatement = "mrs.dump.content_set_create_statement",
    /** Returns all files for the given content set */
    MrsListContentFiles = "mrs.list.content_files",
    /** Returns the corresponding CREATE REST CONTENT FILE SQL statement of the given MRS service object. */
    MrsGetContentFileCreateStatement = "mrs.get.content_file_create_statement",
    /** Stores the corresponding CREATE REST CONTENT SET SQL statement of the given MRS service into a file. */
    MrsDumpContentFileCreateStatement = "mrs.dump.content_file_create_statement",
    /** Dumps the data for REST Service into a JSON file. */
    MrsDumpService = "mrs.dump.service",
    /** Exports the data for REST Schema into a JSON file. */
    MrsDumpSchema = "mrs.dump.schema",
    /** Exports the data for a REST Database Object into a JSON file. */
    MrsDumpObject = "mrs.dump.object",
    /** Loads data for a REST Schema from a JSON file into the target REST service */
    MrsLoadSchema = "mrs.load.schema",
    /** Loads data for a REST Database Object from a JSON file into the target REST Schema */
    MrsLoadObject = "mrs.load.object",
    /** Exports the MRS audit log to a file */
    MrsDumpAuditLog = "mrs.dump.audit_log",
    /** Get users configured within a service and/or auth_app */
    MrsListUsers = "mrs.list.users",
    /** Get user */
    MrsGetUser = "mrs.get.user",
    /** Update user */
    MrsAddUser = "mrs.add.user",
    /** Delete user */
    MrsDeleteUser = "mrs.delete.user",
    /** Update user */
    MrsUpdateUser = "mrs.update.user",
    /** Get all user roles */
    MrsListUserRoles = "mrs.list.user_roles",
    /** Add a user role */
    MrsAddUserRole = "mrs.add.user_role",
    /** Delete all user roles or a single one if the role id is also specified */
    MrsDeleteUserRoles = "mrs.delete.user_roles",
    /** Returns the corresponding CREATE REST SCHEMA SQL statement of the given MRS service object. */
    MrsGetUserCreateStatement = "mrs.get.user_create_statement",
    /** Stores the corresponding CREATE REST schema SQL statement of the given MRS schema object into a file. */
    MrsDumpUserCreateStatement = "mrs.dump.user_create_statement",
    /** List the roles for the specified service */
    MrsListRoles = "mrs.list.roles",
    /** Get a role by id or its caption. */
    MrsGetRole = "mrs.get.role",
    /** Add a new role */
    MrsAddRole = "mrs.add.role",
    /** Add a privilege to a role. */
    MrsAddRolePrivilege = "mrs.add.role_privilege",
    /** Delete a privilege from a role. */
    MrsDeleteRolePrivilege = "mrs.delete.role_privilege",
    /** Returns the corresponding CREATE REST ROLE SQL statement of the given MRS service object. */
    MrsGetRoleCreateStatement = "mrs.get.role_create_statement",
    /** Stores the corresponding CREATE REST role SQL statement of the given MRS role object into a file. */
    MrsDumpRoleCreateStatement = "mrs.dump.role_create_statement",
    /** List all router ids */
    MrsListRouterIds = "mrs.list.router_ids",
    /** List all configured routers */
    MrsListRouters = "mrs.list.routers",
    /** Delete an existing router */
    MrsDeleteRouter = "mrs.delete.router",
    /** List all services a router serves */
    MrsGetRouterServices = "mrs.get.router_services",
    /** Run the given MRS script */
    MrsRunScript = "mrs.run.script"
}

export interface IShellMrsAddServiceKwargs {
    /** The context root for this service */
    urlContextRoot?: string;
    /** The host name for this service */
    urlHostName?: string;
    /** Whether the new service should be enabled */
    enabled?: boolean;
    /** The protocols supported by this service */
    urlProtocol?: unknown[];
    /** Comments about the service */
    comments?: string;
    /** Options for the service */
    options: IShellDictionary | null;
    /** The authentication path */
    authPath?: string;
    /** The redirection URL called after authentication */
    authCompletedUrl?: string;
    /** The regular expression that validates the app redirection URL specified by the /login?onCompletionRedirect parameter */
    authCompletedUrlValidation?: string;
    /** The custom page content to use of the authentication completed page */
    authCompletedPageContent?: string;
    /** Metadata of the service */
    metadata?: IShellDictionary;
    /** Whether the new service should be published immediately */
    published?: boolean;
    /** The name of the service */
    name?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetServiceKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** Whether to return the default service */
    getDefault: boolean | null;
    /** If there is a single service only, use that */
    autoSelectSingle: boolean | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListServicesKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsEnableServiceKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDisableServiceKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDeleteServiceKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetServiceContextPathKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The context_path */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetServiceProtocolKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS' */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetServiceCommentsKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The comments */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetServiceOptionsKwargs {
    /** The context root for this service */
    urlContextRoot?: string;
    /** The host name for this service */
    urlHostName?: string;
    /** The comments */
    value?: string;
    /** The id of the service */
    serviceId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsUpdateServiceKwargsValue {
    /** The context root for this service */
    urlContextRoot?: string;
    /** The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS' */
    urlProtocol?: unknown[];
    /** The host name for this service */
    urlHostName?: string;
    /** Whether the service should be enabled */
    enabled?: boolean;
    /** Comments about the service */
    comments?: string;
    /** Options of the service */
    options?: IShellDictionary;
    /** The authentication path */
    authPath?: string;
    /** The redirection URL called after authentication */
    authCompletedUrl?: string;
    /** The regular expression that validates the app redirection URL specified by the /login?onCompletionRedirect parameter */
    authCompletedUrlValidation?: string;
    /** The custom page content to use of the authentication completed page */
    authCompletedPageContent?: string;
    /** The metadata of the service */
    metadata?: IShellDictionary;
    /** The development settings */
    inDevelopment?: IShellDictionary;
    /** Whether the service is published */
    published?: boolean;
    /** The name of the service */
    name?: string;
}

export interface IShellMrsUpdateServiceKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The context root for this service */
    urlContextRoot: string | null;
    /** The host name for this service */
    urlHostName: string | null;
    /** The values as dict */
    value: IShellMrsUpdateServiceKwargsValue | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetServiceRequestPathAvailabilityKwargs {
    /** The id of the service */
    serviceId?: string;
    /** The request path to check */
    requestPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetCurrentServiceMetadataKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetCurrentServiceKwargs {
    /** The id of the service */
    serviceId?: string;
    /** The context root for this service */
    urlContextRoot?: string;
    /** The host name for this service */
    urlHostName?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetSdkBaseClassesKwargs {
    /** The SDK language to generate */
    sdkLanguage?: string;
    /** Prepare code to be used in Monaco at runtime */
    prepareForRuntime?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetSdkServiceClassesKwargs {
    /** The id of the service */
    serviceId?: string;
    /** The url of the service */
    serviceUrl?: string;
    /** The SDK language to generate */
    sdkLanguage?: string;
    /** Prepare code to be used in Monaco at runtime */
    prepareForRuntime?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpSdkServiceFilesKwargsOptions {
    /** The ID of the service the SDK should be generated for. If not specified, the default service is used. */
    serviceId?: string;
    /** The dbConnectionUri that was used to export the SDK files */
    dbConnectionUri?: string;
    /** The SDK language to generate */
    sdkLanguage?: string;
    /** The additional AppBaseClass file name */
    addAppBaseClass?: string;
    /** The url of the service */
    serviceUrl?: string;
    /** The version of the generated files */
    version?: number;
    /** The generation date of the SDK files */
    generationDate?: string;
    /** The header to use for the SDK files */
    header?: string;
}

export interface IShellMrsDumpSdkServiceFilesKwargs {
    /** The directory to store the .mrs.sdk folder with the files */
    directory?: string;
    /** Several options how the SDK should be created */
    options?: IShellMrsDumpSdkServiceFilesKwargsOptions;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetRuntimeManagementCodeKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetServiceCreateStatementKwargs {
    /** The ID of the service to generate. */
    serviceId?: string;
    /** The identifier of the service. */
    service?: string;
    /** The context root for this service */
    urlContextRoot?: string;
    /** The host name for this service */
    urlHostName?: string;
    /** Include all objects that belong to the service. */
    includeAllObjects?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpServiceCreateStatementKwargs {
    /** The ID of the service to dump. */
    serviceId?: string;
    /** The identifier of the service. */
    service?: string;
    /** The context root for this service */
    urlContextRoot?: string;
    /** The host name for this service */
    urlHostName?: string;
    /** Include all objects that belong to the service. */
    includeAllObjects?: boolean;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddSchemaKwargs {
    /** The id of the service the schema should be added to */
    serviceId?: string;
    /** The name of the schema to add */
    schemaName?: string;
    /** The request_path */
    requestPath?: string;
    /** Whether authentication is required to access the schema */
    requiresAuth?: boolean;
    /** The enabled state */
    enabled?: number;
    /** The number of items returned per page */
    itemsPerPage: number | null;
    /** Comments for the schema */
    comments?: string;
    /** The options for the schema */
    options: IShellDictionary | null;
    /** The metadata settings of the schema */
    metadata?: IShellDictionary;
    /** Either 'DATABASE_SCHEMA' or 'SCRIPT_MODULE' */
    schemaType?: string;
    /** Whether the schema is for internal usage */
    internal?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetSchemaKwargs {
    /** The id of the service */
    serviceId: string | null;
    /** The request_path of the schema */
    requestPath: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The id of the schema */
    schemaId: string | null;
    /** If there is a single service only, use that */
    autoSelectSingle: boolean | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListSchemasKwargs {
    /** Only include schemas with the given enabled state */
    includeEnableState?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsEnableSchemaKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDisableSchemaKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDeleteSchemaKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetSchemaNameKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The value */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetSchemaRequestPathKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The value */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetSchemaRequiresAuthKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The value */
    value: boolean | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetSchemaItemsPerPageKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The value */
    value: number | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetSchemaCommentsKwargs {
    /** The id of the schema */
    schemaId: string | null;
    /** The id of the service */
    serviceId: string | null;
    /** The name of the schema */
    schemaName: string | null;
    /** The value */
    value: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsUpdateSchemaKwargsValue {
    /** The new service id for the schema */
    serviceId?: string;
    /** The name of the schema */
    schemaName?: string;
    /** The request_path */
    requestPath?: string;
    /** Whether authentication is required to access the schema */
    requiresAuth?: boolean;
    /** The enabled state */
    enabled?: number;
    /** The number of items returned per page */
    itemsPerPage: number | null;
    /** Comments for the schema */
    comments?: string;
    /** The options for the schema */
    options: IShellDictionary | null;
    /** The metadata settings of the schema */
    metadata?: IShellDictionary;
}

export interface IShellMrsUpdateSchemaKwargs {
    /** The id of the schema */
    schemaId?: string;
    /** The id of the service */
    serviceId?: string;
    /** (required) The name of the schema */
    schemaName?: string;
    /** The values as dict #TODO: check why dicts cannot be passed */
    value: IShellMrsUpdateSchemaKwargsValue | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetSchemaCreateStatementKwargs {
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The ID of the schema to generate. */
    schemaId?: string;
    /** The identifier of the schema. */
    schema?: string;
    /** Include all objects that belong to the schema. */
    includeAllObjects?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpSchemaCreateStatementKwargs {
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The ID of the schema to dump. */
    schemaId?: string;
    /** The identifier of the schema. */
    schema?: string;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** Include all objects that belong to the schema. */
    includeAllObjects?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetAuthenticationVendorsKwargs {
    /** Whether to return just the enabled vendors (default) or all */
    enabled?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddAuthenticationAppKwargs {
    /** The auth_vendor_id */
    authVendorId?: string;
    /** A description of the app */
    description?: string;
    /** url of the app */
    url?: string;
    /** url direct auth of the app */
    urlDirectAuth?: string;
    /** access_token of the app */
    accessToken?: string;
    /** app_id of the app */
    appId?: string;
    /** Limit access to registered users */
    limitToRegisteredUsers?: boolean;
    /** List of registered users */
    registeredUsers?: unknown[];
    /** The default role to be assigned to new users */
    defaultRoleId: string | null;
    /** Whether the Auth App is enabled */
    enabled?: number;
    /** Additional options */
    options?: IShellDictionary;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListAuthenticationAppsKwargs {
    /** Only include items with the given enabled state */
    includeEnableState?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDeleteAuthenticationAppKwargs {
    /** The application id */
    appId?: string;
    /** The id of the service that this auth_app belongs to */
    serviceId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsUpdateAuthenticationAppKwargsValue {
    /** The auth_vendor_id */
    authVendorId?: string;
    /** The new name for the app */
    name?: string;
    /** The new description */
    description?: string;
    /** The new url for the app */
    url?: string;
    /** The new url direct auth for the app */
    urlDirectAuth?: string;
    /** The new access token */
    accessToken?: string;
    /** The new application id */
    appId?: string;
    /** Set if it's enabled or not */
    enabled?: boolean;
    /** Set if limited to registered users */
    limitToRegisteredUsers?: boolean;
    /** The new default role id */
    defaultRoleId: string | null;
    /** Additional options */
    options?: IShellDictionary;
}

export interface IShellMrsUpdateAuthenticationAppKwargs {
    /** The application id */
    appId?: string;
    /** The values as dict */
    value: IShellMrsUpdateAuthenticationAppKwargsValue | null;
    /** The id of the service that this auth_app belongs to */
    serviceId?: string;
    /** The name of the auth_app to update */
    authAppName?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetAuthAppCreateStatementKwargs {
    /** The ID of the authentication app to generate. */
    authAppId?: string;
    /** The ID of the service where the authentication app belongs. */
    serviceId?: string;
    /** The identifier of the authentication app. */
    authApp?: string;
    /** Include all objects that belong to the authentication app. */
    includeAllObjects?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpAuthAppCreateStatementKwargs {
    /** The ID of the authentication app to generate. */
    authAppId?: string;
    /** The ID of the service where the authentication app belongs. */
    serviceId?: string;
    /** The identifier of the authentication app. */
    authApp?: string;
    /** Include all objects that belong to the schema. */
    includeAllObjects?: boolean;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddDbObjectKwargs {
    /** The name of the schema object add */
    dbObjectName?: string;
    /** Either TABLE, VIEW or PROCEDURE */
    dbObjectType?: string;
    /** The id of the schema the object should be added to */
    schemaId?: string;
    /** The name of the schema */
    schemaName?: string;
    /** If the schema should be added as well if it does not exist yet */
    autoAddSchema?: boolean;
    /** The request_path */
    requestPath?: string;
    /** Whether the db object is enabled */
    enabled?: number;
    /** The format to use for the CRUD operation */
    crudOperationFormat?: string;
    /** Whether authentication is required to access the schema */
    requiresAuth?: boolean;
    /** The number of items returned per page */
    itemsPerPage?: number;
    /** Enable row ownership enforcement */
    rowUserOwnershipEnforced?: boolean;
    /** The column for row ownership enforcement */
    rowUserOwnershipColumn?: string;
    /** Comments for the schema */
    comments?: string;
    /** The media_type of the db object */
    mediaType?: string;
    /** Whether to automatically detect the media type */
    autoDetectMediaType?: boolean;
    /** The stored procedure that implements the authentication check for this db object */
    authStoredProcedure?: string;
    /** The options of this db object */
    options: IShellDictionary | null;
    /** The metadata of this db object */
    metadata?: IShellDictionary;
    /** The result/parameters objects definition in JSON format */
    objects?: unknown[];
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetDbObjectKwargs {
    /** The id of the db_object */
    dbObjectId?: string;
    /** The id of the schema */
    schemaId?: string;
    /** The name of the schema */
    schemaName?: string;
    /** The absolute request_path to the db_object */
    absoluteRequestPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListDbObjectsKwargs {
    /** The id of the schema to list the db_objects from */
    schemaId?: string;
    /** Only include db_objects with the given enabled state */
    includeEnableState?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetDbObjectParametersKwargs {
    /** The id of the db_object */
    dbObjectId?: string;
    /** The name of the db_schema */
    dbSchemaName?: string;
    /** The name of the db_object */
    dbObjectName?: string;
    /** The type of the db_object, either PROCEDURE or FUNCTION */
    dbType?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetDbFunctionReturnTypeKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetDbObjectRequestPathKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsEnableDbObjectKwargs {
    /** The id of the db_object */
    dbObjectId: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDisableDbObjectKwargs {
    /** The id of the db_object */
    dbObjectId: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDeleteDbObjectKwargs {
    /** The id of the db_object */
    dbObjectId: string | null;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsUpdateDbObjectKwargsValue {
    /** The new name to apply to the database object */
    name?: string;
    /** The id of the schema to update in the database object */
    dbSchemaId?: string;
    /** If the database object is enabled or not */
    enabled?: number;
    /** The format to use for the CRUD operation */
    crudOperationFormat?: string;
    /** Whether authentication is required to access the database object */
    requiresAuth?: boolean;
    /** The number of items returned per page */
    itemsPerPage: number | null;
    /** The request_path */
    requestPath?: string;
    /** Whether the media type should be detected automatically */
    autoDetectMediaType?: boolean;
    /** Comments for the database object */
    comments?: string;
    /** The media_type of the db object */
    mediaType?: string;
    /** The stored procedure that implements the authentication check for this db object */
    authStoredProcedure?: string;
    /** The options of this db object */
    options: IShellDictionary | null;
    /** The metadata settings of the db object */
    metadata?: IShellDictionary;
    /** The result/parameters objects definition in JSON format */
    objects?: unknown[];
}

export interface IShellMrsUpdateDbObjectKwargs {
    /** The id of the database object */
    dbObjectId?: string;
    /** A list of database object ids to update */
    dbObjectIds?: unknown[];
    /** The name of the database object to update */
    dbObjectName?: string;
    /** The id of the schema that contains the database object to be updated */
    schemaId?: string;
    /** The request_path */
    requestPath?: string;
    /** The values to update */
    value?: IShellMrsUpdateDbObjectKwargsValue;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetTableColumnsWithReferencesKwargs {
    /** The name of the schema */
    schemaName?: string;
    /** The type of the db_object (TABLE, VIEW, PROCEDURE) */
    dbObjectType?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetObjectsKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetObjectFieldsWithReferencesKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetDbObjectCreateStatementKwargs {
    /** The ID of the service where the db_object belongs. */
    serviceId?: string;
    /** The ID of the schema where the db_object belongs. */
    schemaId?: string;
    /** The ID of the db_object to generate. */
    dbObjectId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpDbObjectCreateStatementKwargs {
    /** The ID of the service where the db_object belongs. */
    serviceId?: string;
    /** The ID of the schema where the db_object belongs. */
    schemaId?: string;
    /** The ID of the db_object to dump. */
    dbObjectId?: string;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddContentSetKwargs {
    /** The request_path */
    requestPath: string | null;
    /** Whether authentication is required to access the content */
    requiresAuth: boolean | null;
    /** Comments about the content */
    comments?: string;
    /** Whether to enable the content set after all files are uploaded */
    enabled?: number;
    /** The options as JSON string */
    options: IShellDictionary | null;
    /** Whether to replace a content set that uses the same request_path */
    replaceExisting?: boolean;
    /** List of files and directories to ignore, separated by comma */
    ignoreList?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
}

export interface IShellMrsGetContentSetCountKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListContentSetsKwargs {
    /** Only include items with the given enabled state */
    includeEnableState?: boolean;
    /** The request_path of the content_set */
    requestPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetContentSetKwargs {
    /** The id of the content_set */
    contentSetId?: string;
    /** The id of the service */
    serviceId?: string;
    /** The request_path of the content_set */
    requestPath?: string;
    /** If there is a single service only, use that */
    autoSelectSingle?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsEnableContentSetKwargs {
    /** The id of the service */
    serviceId?: string;
    /** The id of the content_set */
    contentSetId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDisableContentSetKwargs {
    /** The id of the service */
    serviceId?: string;
    /** The id of the content_set */
    contentSetId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDeleteContentSetKwargs {
    /** The id of the content_set */
    contentSetId?: string;
    /** The id of the service */
    serviceId?: string;
    /** The request_path of the content_set */
    requestPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetFileMrsScriptDefinitionsKwargs {
    /** The language the MRS Scripts are written in */
    language?: string;
}

export interface IShellMrsGetFolderMrsScriptLanguageKwargs {
    /** The list of file patterns to ignore, separated by comma */
    ignoreList?: string;
}

export interface IShellMrsGetFolderMrsScriptDefinitionsKwargs {
    /** The list of file patterns to ignore, separated by comma */
    ignoreList?: string;
    /** The language the MRS Scripts are written in */
    language?: string;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
}

export interface IShellMrsUpdateMrsScriptsFromContentSetKwargs {
    /** The id of the content_set */
    contentSetId?: string;
    /** The list of file patterns to ignore, separated by comma */
    ignoreList?: string;
    /** The MRS Scripting language used */
    language?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
    /** The function to send a message to he GUI. */
    sendGuiMessage?: object;
}

export interface IShellMrsGetContentSetCreateStatementKwargs {
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The ID of the content set to generate. */
    contentSetId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpContentSetCreateStatementKwargs {
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The ID of the content set to dump. */
    contentSetId?: string;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListContentFilesKwargs {
    /** Only include db_objects with the given enabled state */
    includeEnableState?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetContentFileCreateStatementKwargs {
    /** The ID of the content set to generate. */
    contentSetId?: string;
    /** The ID of the content file to generate. */
    contentFileId?: string;
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpContentFileCreateStatementKwargs {
    /** The ID of the content file to dump. */
    contentFileId?: string;
    /** The ID of the content set to dump. */
    contentSetId?: string;
    /** The ID of the service where the schema belongs. */
    serviceId?: string;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpServiceKwargs {
    /** The ID of the service to be exported. */
    serviceId?: string;
    /** The name of the service to be exported. */
    serviceName?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpSchemaKwargs {
    /** The ID of the service to be exported. */
    serviceId?: string;
    /** The name of the service to be exported. */
    serviceName?: string;
    /** The ID of the schema to be exported. */
    schemaId?: string;
    /** The name of the schema to be exported. */
    schemaName?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpObjectKwargs {
    /** The ID of the service to be exported. */
    serviceId?: string;
    /** The name of the service to be exported. */
    serviceName?: string;
    /** The ID of the schema to be exported. */
    schemaId?: string;
    /** The name of the schema to be exported. */
    schemaName?: string;
    /** The ID of the object to be exported. */
    objectId?: string;
    /** The name of the object to be exported. */
    objectName?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsLoadSchemaKwargs {
    /** The ID of target service. */
    serviceId?: string;
    /** The name of the target service. */
    serviceName?: string;
    /** Indicates whether the existing ids should be reused. */
    reuseIds?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsLoadObjectKwargs {
    /** The ID of target service. */
    serviceId?: string;
    /** The name of the target service. */
    serviceName?: string;
    /** The ID of the target schema. */
    schemaId?: string;
    /** The name of the target schema. */
    schemaName?: string;
    /** Indicates whether the existing ids should be reused. */
    reuseIds?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpAuditLogKwargs {
    /** The file containing the audit log position. If not provided, a mrs_audit_log_position.json file next to the file_path will be created. */
    auditLogPositionFile?: string;
    /** The audit log position to export from. Defaults to 0. */
    auditLogPosition?: number;
    /** Whether to start exporting from today. Defaults to true. */
    startingFromToday?: boolean;
    /** Whether to only write out the log when the MySQL server is writeable. Defaults to false. */
    whenServerIsWriteable?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsListUsersKwargs {
    /** Use this service_id to search for all users within this service. */
    serviceId?: string;
    /** Use this auth_app_id to list all the users for this auth_app. */
    authAppId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetUserKwargs {
    /** The user_id for the required user. */
    userId?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddUserKwargs {
    /** The id of the auth_app for which the user is being created for. */
    authAppId?: string;
    /** The name of the user. */
    name?: string;
    /** The email of the user */
    email?: string;
    /** The id of the vendor. */
    vendorUserId?: string;
    /** If permission is permitted by this user */
    loginPermitted?: boolean;
    /** The id for the mapped user */
    mappedUserId?: string;
    /** The authentication app options for this user */
    appOptions: IShellDictionary | null;
    /** The authentication string for the user. */
    authString?: string;
    /** The list of user roles for this user. This needs to be in the following format { "role_id": "0x......", "comments": "Add some comments" } */
    userRoles?: unknown[];
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsUpdateUserKwargsValue {
    /** The id of the auth_app for which the user is being created for. */
    authAppId?: string;
    /** The name of the user. */
    name: string | null;
    /** The email of the user */
    email: string | null;
    /** The id of the vendor. */
    vendorUserId: string | null;
    /** If permission is permitted by this user */
    loginPermitted?: boolean;
    /** The id for the mapped user */
    mappedUserId: string | null;
    /** The authentication app options for this user */
    appOptions: IShellDictionary | null;
    /** The authentication string for the user. */
    authString: string | null;
}

export interface IShellMrsUpdateUserKwargs {
    /** The id of the user to update */
    userId?: string;
    /** The values to be updated */
    value?: IShellMrsUpdateUserKwargsValue;
    /** The list of user roles for this user. This needs to be in the following format { "role_id": "0x......", "comments": "Add some comments" } */
    userRoles?: unknown[];
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsGetUserCreateStatementKwargs {
    /** The ID of the user to generate. */
    userId?: string;
    /** The identifier of the user. */
    user?: string;
    /** Include all objects that belong to the user. */
    includeAllObjects?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpUserCreateStatementKwargs {
    /** The ID of the user to generate. */
    userId?: string;
    /** The identifier of the user. */
    user?: string;
    /** Include all objects that belong to the user. */
    includeAllObjects?: boolean;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddRoleKwargs {
    /** The role from which this role derives */
    derivedFromRoleId?: string;
    /** The id for the service to which this role belongs */
    specificToServiceId?: string;
    /** The role description */
    description?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsAddRolePrivilegeKwargs {
    /** The service path or pattern to grant privileges on. */
    servicePath?: string;
    /** The schema path or pattern to grant privileges on. */
    schemaPath?: string;
    /** The object path or pattern to grant privileges on. */
    objectPath?: string;
}

export interface IShellMrsDeleteRolePrivilegeKwargs {
    /** The service path or pattern to revoke privileges from. */
    service?: string;
    /** The schema path or pattern to revoke privileges from. */
    schema?: string;
    /** The object path or pattern to revoke privileges from. */
    object?: string;
}

export interface IShellMrsGetRoleCreateStatementKwargs {
    /** The ID of the role to generate. */
    roleId?: string;
    /** The name of the role to generate. */
    roleName?: string;
    /** The identifier of the schema. */
    role?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpRoleCreateStatementKwargs {
    /** The ID of the role to generate. */
    roleId?: string;
    /** The name of the role to generate. */
    roleName?: string;
    /** The identifier of the schema. */
    role?: string;
    /** The path where to store the file. */
    filePath?: string;
    /** Overwrite the file, if already exists. */
    overwrite?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsRunScriptKwargs {
    /** The path of the script to run */
    path?: string;
    /** The id of the current service */
    currentServiceId?: string;
    /** The url_context_root of the current service */
    currentService?: string;
    /** The url_context_root of the current service URL */
    currentServiceHost?: string;
    /** The id of the current schema */
    currentSchemaId?: string;
    /** The full path of the current schema */
    currentSchema?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IProtocolMrsParameters {
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: { args: { path?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsConfigure]: { args: { moduleSessionId?: string; enableMrs?: boolean; options?: string; updateIfAvailable?: boolean; allowRecreationOnMajorUpgrade?: boolean; }; };
    [ShellAPIMrs.MrsStatus]: { args: { moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsIgnoreVersionUpgrade]: { args: { moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsAddService]: { kwargs?: IShellMrsAddServiceKwargs; };
    [ShellAPIMrs.MrsGetService]: { kwargs?: IShellMrsGetServiceKwargs; };
    [ShellAPIMrs.MrsListServices]: { kwargs?: IShellMrsListServicesKwargs; };
    [ShellAPIMrs.MrsEnableService]: { kwargs?: IShellMrsEnableServiceKwargs; };
    [ShellAPIMrs.MrsDisableService]: { kwargs?: IShellMrsDisableServiceKwargs; };
    [ShellAPIMrs.MrsDeleteService]: { kwargs?: IShellMrsDeleteServiceKwargs; };
    [ShellAPIMrs.MrsSetServiceContextPath]: { kwargs?: IShellMrsSetServiceContextPathKwargs; };
    [ShellAPIMrs.MrsSetServiceProtocol]: { kwargs?: IShellMrsSetServiceProtocolKwargs; };
    [ShellAPIMrs.MrsSetServiceComments]: { kwargs?: IShellMrsSetServiceCommentsKwargs; };
    [ShellAPIMrs.MrsSetServiceOptions]: { kwargs?: IShellMrsSetServiceOptionsKwargs; };
    [ShellAPIMrs.MrsUpdateService]: { kwargs?: IShellMrsUpdateServiceKwargs; };
    [ShellAPIMrs.MrsGetServiceRequestPathAvailability]: { kwargs?: IShellMrsGetServiceRequestPathAvailabilityKwargs; };
    [ShellAPIMrs.MrsGetCurrentServiceMetadata]: { kwargs?: IShellMrsGetCurrentServiceMetadataKwargs; };
    [ShellAPIMrs.MrsSetCurrentService]: { kwargs?: IShellMrsSetCurrentServiceKwargs; };
    [ShellAPIMrs.MrsGetSdkBaseClasses]: { kwargs?: IShellMrsGetSdkBaseClassesKwargs; };
    [ShellAPIMrs.MrsGetSdkServiceClasses]: { kwargs?: IShellMrsGetSdkServiceClassesKwargs; };
    [ShellAPIMrs.MrsDumpSdkServiceFiles]: { kwargs?: IShellMrsDumpSdkServiceFilesKwargs; };
    [ShellAPIMrs.MrsGetSdkOptions]: { args: { directory: string; }; };
    [ShellAPIMrs.MrsGetRuntimeManagementCode]: { kwargs?: IShellMrsGetRuntimeManagementCodeKwargs; };
    [ShellAPIMrs.MrsGetServiceCreateStatement]: { kwargs?: IShellMrsGetServiceCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpServiceCreateStatement]: { kwargs?: IShellMrsDumpServiceCreateStatementKwargs; };
    [ShellAPIMrs.MrsAddSchema]: { kwargs?: IShellMrsAddSchemaKwargs; };
    [ShellAPIMrs.MrsGetSchema]: { kwargs?: IShellMrsGetSchemaKwargs; };
    [ShellAPIMrs.MrsListSchemas]: { args: { serviceId?: string; }; kwargs?: IShellMrsListSchemasKwargs; };
    [ShellAPIMrs.MrsEnableSchema]: { kwargs?: IShellMrsEnableSchemaKwargs; };
    [ShellAPIMrs.MrsDisableSchema]: { kwargs?: IShellMrsDisableSchemaKwargs; };
    [ShellAPIMrs.MrsDeleteSchema]: { kwargs?: IShellMrsDeleteSchemaKwargs; };
    [ShellAPIMrs.MrsSetSchemaName]: { kwargs?: IShellMrsSetSchemaNameKwargs; };
    [ShellAPIMrs.MrsSetSchemaRequestPath]: { kwargs?: IShellMrsSetSchemaRequestPathKwargs; };
    [ShellAPIMrs.MrsSetSchemaRequiresAuth]: { kwargs?: IShellMrsSetSchemaRequiresAuthKwargs; };
    [ShellAPIMrs.MrsSetSchemaItemsPerPage]: { kwargs?: IShellMrsSetSchemaItemsPerPageKwargs; };
    [ShellAPIMrs.MrsSetSchemaComments]: { kwargs?: IShellMrsSetSchemaCommentsKwargs; };
    [ShellAPIMrs.MrsUpdateSchema]: { kwargs?: IShellMrsUpdateSchemaKwargs; };
    [ShellAPIMrs.MrsGetSchemaCreateStatement]: { kwargs?: IShellMrsGetSchemaCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpSchemaCreateStatement]: { kwargs?: IShellMrsDumpSchemaCreateStatementKwargs; };
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { kwargs?: IShellMrsGetAuthenticationVendorsKwargs; };
    [ShellAPIMrs.MrsAddAuthenticationApp]: { args: { appName?: string; serviceId?: string; }; kwargs?: IShellMrsAddAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsGetAuthenticationApp]: { args: { appId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsListAuthenticationApps]: { args: { serviceId?: string; }; kwargs?: IShellMrsListAuthenticationAppsKwargs; };
    [ShellAPIMrs.MrsDeleteAuthenticationApp]: { kwargs?: IShellMrsDeleteAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsUpdateAuthenticationApp]: { kwargs?: IShellMrsUpdateAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsGetAuthAppCreateStatement]: { kwargs?: IShellMrsGetAuthAppCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpAuthAppCreateStatement]: { kwargs?: IShellMrsDumpAuthAppCreateStatementKwargs; };
    [ShellAPIMrs.MrsAddDbObject]: { kwargs?: IShellMrsAddDbObjectKwargs; };
    [ShellAPIMrs.MrsGetDbObject]: { args: { requestPath?: string; dbObjectName?: string; }; kwargs?: IShellMrsGetDbObjectKwargs; };
    [ShellAPIMrs.MrsListDbObjects]: { kwargs?: IShellMrsListDbObjectsKwargs; };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { args: { requestPath?: string; }; kwargs?: IShellMrsGetDbObjectParametersKwargs; };
    [ShellAPIMrs.MrsGetDbFunctionReturnType]: { args: { dbSchemaName: string; dbObjectName: string; }; kwargs?: IShellMrsGetDbFunctionReturnTypeKwargs; };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: { args: { dbObjectId?: string; requestPath?: string; }; kwargs?: IShellMrsSetDbObjectRequestPathKwargs; };
    [ShellAPIMrs.MrsEnableDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsEnableDbObjectKwargs; };
    [ShellAPIMrs.MrsDisableDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsDisableDbObjectKwargs; };
    [ShellAPIMrs.MrsDeleteDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsDeleteDbObjectKwargs; };
    [ShellAPIMrs.MrsUpdateDbObject]: { kwargs?: IShellMrsUpdateDbObjectKwargs; };
    [ShellAPIMrs.MrsGetTableColumnsWithReferences]: { args: { dbObjectId?: string; schemaId?: string; requestPath?: string; dbObjectName?: string; }; kwargs?: IShellMrsGetTableColumnsWithReferencesKwargs; };
    [ShellAPIMrs.MrsGetObjects]: { args: { dbObjectId?: string; }; kwargs?: IShellMrsGetObjectsKwargs; };
    [ShellAPIMrs.MrsGetObjectFieldsWithReferences]: { args: { objectId?: string; }; kwargs?: IShellMrsGetObjectFieldsWithReferencesKwargs; };
    [ShellAPIMrs.MrsGetDbObjectCreateStatement]: { kwargs?: IShellMrsGetDbObjectCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpDbObjectCreateStatement]: { kwargs?: IShellMrsDumpDbObjectCreateStatementKwargs; };
    [ShellAPIMrs.MrsAddContentSet]: { args: { serviceId?: string; contentDir?: string; }; kwargs?: IShellMrsAddContentSetKwargs; };
    [ShellAPIMrs.MrsGetContentSetCount]: { args: { serviceId?: string; }; kwargs?: IShellMrsGetContentSetCountKwargs; };
    [ShellAPIMrs.MrsListContentSets]: { args: { serviceId?: string; }; kwargs?: IShellMrsListContentSetsKwargs; };
    [ShellAPIMrs.MrsGetContentSet]: { kwargs?: IShellMrsGetContentSetKwargs; };
    [ShellAPIMrs.MrsEnableContentSet]: { kwargs?: IShellMrsEnableContentSetKwargs; };
    [ShellAPIMrs.MrsDisableContentSet]: { kwargs?: IShellMrsDisableContentSetKwargs; };
    [ShellAPIMrs.MrsDeleteContentSet]: { kwargs?: IShellMrsDeleteContentSetKwargs; };
    [ShellAPIMrs.MrsGetFileMrsScriptDefinitions]: { args: { path: string; }; kwargs?: IShellMrsGetFileMrsScriptDefinitionsKwargs; };
    [ShellAPIMrs.MrsGetFolderMrsScriptLanguage]: { args: { path: string; }; kwargs?: IShellMrsGetFolderMrsScriptLanguageKwargs; };
    [ShellAPIMrs.MrsGetFolderMrsScriptDefinitions]: { args: { path: string; }; kwargs?: IShellMrsGetFolderMrsScriptDefinitionsKwargs; };
    [ShellAPIMrs.MrsUpdateMrsScriptsFromContentSet]: { kwargs?: IShellMrsUpdateMrsScriptsFromContentSetKwargs; };
    [ShellAPIMrs.MrsGetContentSetCreateStatement]: { kwargs?: IShellMrsGetContentSetCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpContentSetCreateStatement]: { kwargs?: IShellMrsDumpContentSetCreateStatementKwargs; };
    [ShellAPIMrs.MrsListContentFiles]: { args: { contentSetId: string; }; kwargs?: IShellMrsListContentFilesKwargs; };
    [ShellAPIMrs.MrsGetContentFileCreateStatement]: { kwargs?: IShellMrsGetContentFileCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpContentFileCreateStatement]: { kwargs?: IShellMrsDumpContentFileCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpService]: { args: { path: string; }; kwargs?: IShellMrsDumpServiceKwargs; };
    [ShellAPIMrs.MrsDumpSchema]: { args: { path: string; }; kwargs?: IShellMrsDumpSchemaKwargs; };
    [ShellAPIMrs.MrsDumpObject]: { args: { path: string; }; kwargs?: IShellMrsDumpObjectKwargs; };
    [ShellAPIMrs.MrsLoadSchema]: { args: { path: string; }; kwargs?: IShellMrsLoadSchemaKwargs; };
    [ShellAPIMrs.MrsLoadObject]: { args: { path: string; }; kwargs?: IShellMrsLoadObjectKwargs; };
    [ShellAPIMrs.MrsDumpAuditLog]: { args: { filePath: string; }; kwargs?: IShellMrsDumpAuditLogKwargs; };
    [ShellAPIMrs.MrsListUsers]: { kwargs?: IShellMrsListUsersKwargs; };
    [ShellAPIMrs.MrsGetUser]: { kwargs?: IShellMrsGetUserKwargs; };
    [ShellAPIMrs.MrsAddUser]: { kwargs?: IShellMrsAddUserKwargs; };
    [ShellAPIMrs.MrsDeleteUser]: { args: { userId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsUpdateUser]: { kwargs?: IShellMrsUpdateUserKwargs; };
    [ShellAPIMrs.MrsListUserRoles]: { args: { userId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsAddUserRole]: { args: { userId?: string; roleId?: string; comments?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsDeleteUserRoles]: { args: { userId?: string; roleId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsGetUserCreateStatement]: { kwargs?: IShellMrsGetUserCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpUserCreateStatement]: { kwargs?: IShellMrsDumpUserCreateStatementKwargs; };
    [ShellAPIMrs.MrsListRoles]: { args: { serviceId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsGetRole]: { args: { roleId?: string; moduleSessionId?: string; specificToServiceId?: string; caption?: string; }; };
    [ShellAPIMrs.MrsAddRole]: { args: { caption: string; }; kwargs?: IShellMrsAddRoleKwargs; };
    [ShellAPIMrs.MrsAddRolePrivilege]: { args: { roleId?: string; moduleSessionId?: string; operations?: unknown[]; }; kwargs?: IShellMrsAddRolePrivilegeKwargs; };
    [ShellAPIMrs.MrsDeleteRolePrivilege]: { args: { roleId?: string; moduleSessionId?: string; operations?: unknown[]; }; kwargs?: IShellMrsDeleteRolePrivilegeKwargs; };
    [ShellAPIMrs.MrsGetRoleCreateStatement]: { kwargs?: IShellMrsGetRoleCreateStatementKwargs; };
    [ShellAPIMrs.MrsDumpRoleCreateStatement]: { kwargs?: IShellMrsDumpRoleCreateStatementKwargs; };
    [ShellAPIMrs.MrsListRouterIds]: { args: { seenWithin?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsListRouters]: { args: { activeWhenSeenWithin?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsDeleteRouter]: { args: { routerId?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsGetRouterServices]: { args: { routerId?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsRunScript]: { args: { mrsScript?: string; }; kwargs?: IShellMrsRunScriptKwargs; };

}

export interface IMrsDbObjectParameterData {
    id?: string;
    position: number;
    name: string;
    mode: string;
    datatype: string;
    charset?: string;
    collation?: string;
}

export interface IMrsDbObjectData extends IDictionary {
    changedAt?: string;
    comments: string;
    crudOperations: string[];
    crudOperationFormat: string;
    dbSchemaId: string;
    enabled: number;
    hostCtx?: string;
    id: string;
    itemsPerPage?: number;
    name: string;
    objectType: MrsDbObjectType;
    requestPath: string;
    requiresAuth: number;
    schemaRequestPath?: string;
    schemaName?: string;
    qualifiedName?: string;
    serviceId: string;
    mediaType?: string;
    autoDetectMediaType: number;
    authStoredProcedure?: string;
    options?: IShellDictionary;
    metadata?: IShellDictionary;
    objects?: IMrsObject[];
}

export interface IMrsContentSetData {
    contentType: string;
    comments: string;
    enabled: number;
    hostCtx: string;
    id: string;
    requestPath: string;
    requiresAuth: number;
    serviceId: string;
    options: IShellDictionary;
    scriptModuleFiles?: IMrsScriptModuleFile[];
    scriptModuleDefinitions?: IMrsScriptDefinitions;
}

export interface IMrsContentFileData {
    id: string;
    contentSetId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: number;
    size: number;
    contentSetRequestPath: string;
    hostCtx: string;
    changedAt: string;
}

export interface IMrsAddContentSetData {
    contentSetId?: string;
    numberOfFilesUploaded?: number;
    info?: string;
}

export interface IMrsScriptModuleFile {
    fileInfo: IMrsScriptFileInfo;
    fileToLoad: string;
    className: string;
}

export interface IMrsServiceDevelopmentOptions {
    developers: string[];
}

export interface IMrsServiceData {
    enabled: number;
    published: number;
    hostCtx: string;
    fullServicePath?: string;
    name: string;
    sortedDevelopers?: string;
    id: string;
    isCurrent: number;
    urlContextRoot: string;
    urlHostName: string;
    urlProtocol: string;
    comments: string;
    options: IShellDictionary;
    authPath: string;
    authCompletedUrl: string;
    authCompletedUrlValidation: string;
    authCompletedPageContent: string;
    authApps?: IMrsAuthAppData[];
    enableSqlEndpoint?: number;
    customMetadataSchema?: string;
    metadata?: IShellDictionary;
    inDevelopment?: IMrsServiceDevelopmentOptions;
}

export interface IMrsAddAuthAppData {
    authAppId: string;
}

export interface IMrsAuthAppData {
    id?: string;
    authVendorId?: string;
    authVendor?: string;
    authVendorName?: string;
    serviceId?: string;
    name?: string;
    description?: string;
    url?: string;
    urlDirectAuth?: string;
    accessToken?: string;
    appId?: string;
    enabled: boolean;
    limitToRegisteredUsers: boolean;
    defaultRoleId: string | null;
    options?: IShellDictionary;
}

export interface IMrsAuthVendorData {
    id?: string;
    name: string;
    validationUrl?: string;
    enabled: boolean;
    comments?: string;
}

export interface IMrsUserData {
    id?: string;
    authAppId?: string;
    name?: string;
    email?: string;
    vendorUserId?: string;
    loginPermitted?: boolean;
    mappedUserId?: string;
    appOptions?: IShellDictionary;
    authString?: string;
}

export interface IMrsSchemaData {
    comments: string;
    enabled: number;
    hostCtx: string;
    id: string;
    itemsPerPage: number;
    name: string;
    requestPath: string;
    requiresAuth: number;
    serviceId: string;
    options?: IShellDictionary;
    metadata?: string;
    schemaType: string;
}

export interface IMrsStatusData {
    serviceConfigured: boolean;
    serviceCount: number;
    serviceEnabled: boolean;
    serviceUpgradeable: boolean;
    majorUpgradeRequired: boolean;
    minimumVersionRequired: number;
    currentMetadataVersion?: string;
    availableMetadataVersion?: string;
    requiredRouterVersion?: string;
    serviceUpgradeIgnored: boolean;
    serviceBeingUpgraded: boolean;
}

export interface IMrsRoleData {
    id: string,
    derivedFromRoleId: string,
    specificToServiceId: string,
    caption: string,
    description: string,
}

export interface IMrsUserRoleData {
    userId: string | null,
    roleId: string | null,
    comments: string | null,
}

export interface IMrsRouterData {
    id: number,
    routerName: string,
    address: string,
    productName: string,
    version: string,
    lastCheckIn: string,
    attributes: IShellDictionary,
    options: IShellDictionary,
    active: boolean,
    developer?: string,
}

export interface IMrsRouterService {
    routerId: number;
    routerName: string;
    address: string;
    routerDeveloper: string | null;
    serviceId: string;
    serviceUrlHostName: string;
    serviceUrlContextRoot: string;
    serviceHostCtx: string;
    published: number;
    inDevelopment: IMrsServiceDevelopmentOptions | null;
    sortedDevelopers: string | null;
}


export interface IMrsCurrentServiceMetadata {
    id?: string;
    hostCtx?: string;
    metadataVersion?: string;
}

export interface IMrsTableColumn {
    name: string;
    datatype: string;
    notNull: boolean;
    isPrimary: boolean;
    isUnique: boolean;
    isGenerated: boolean;
    idGeneration?: string;
    comment?: string;
    in?: boolean;
    out?: boolean;
    isArray?: boolean;
    readOnly?: boolean;
    charset?: string;
    collation?: string;
}

export interface IMrsColumnMapping {
    base: string;
    ref: string;
}

export interface IMrsTableReference {
    kind: string,
    constraint: string,
    toMany: boolean,
    referencedSchema: string,
    referencedTable: string,
    columnMapping: IMrsColumnMapping[];
}

export interface IMrsTableColumnWithReference {
    position: number,
    name: string,
    refColumnNames: string,
    dbColumn?: IMrsTableColumn,
    referenceMapping?: IMrsTableReference,
    tableSchema: string,
    tableName: string,
}

export interface IMrsObjectFieldSdkLanguageOptions {
    language: string,
    fieldName?: string;
}

export interface IMrsObjectFieldSdkOptions {
    datatypeName?: string,
    languageOptions?: IMrsObjectFieldSdkLanguageOptions[],
}

export interface IMrsObjectReferenceSdkLanguageOptions {
    language: string,
    interfaceName?: string,
}

export interface IMrsObjectReferenceSdkOptions {
    languageOptions?: IMrsObjectReferenceSdkLanguageOptions[],
}

export interface IMrsObjectReference {
    id: string,
    reduceToValueOfFieldId?: string,
    rowOwnershipFieldId?: string,
    referenceMapping: IMrsTableReference,
    unnest: boolean,
    options?: IMrsObjectOptions,
    sdkOptions?: IMrsObjectReferenceSdkOptions,
    comments?: string,
}

export interface IMrsObjectFieldWithReference {
    id: string,
    objectId: string,
    representsReferenceId?: string,
    parentReferenceId?: string,
    name: string,
    position: number,
    dbColumn?: IMrsTableColumn,
    enabled: boolean,
    allowFiltering: boolean,
    allowSorting: boolean,
    noCheck: boolean,
    noUpdate: boolean,
    sdkOptions?: IMrsObjectFieldSdkOptions,
    comments?: string,
    objectReference?: IMrsObjectReference,
    lev?: number,
    caption?: string,
    storedDbColumn?: IMrsTableColumn,
}

export interface IMrsObjectSdkLanguageOptions {
    language: MrsSdkLanguage;
    className?: string;
}

export interface IMrsObjectSdkOptions {
    languageOptions?: IMrsObjectSdkLanguageOptions[];
    className?: string;
    returnsArray?: boolean;
}

export interface IMrsObjectOptions {
    dualityViewInsert?: boolean,
    dualityViewUpdate?: boolean,
    dualityViewDelete?: boolean,
    dualityViewNoCheck?: boolean,
}

export interface IMrsObject {
    id: string,
    dbObjectId: string,
    name: string,
    position: number,
    kind: MrsObjectKind,
    options?: IMrsObjectOptions,
    sdkOptions?: IMrsObjectSdkOptions,
    rowOwnershipFieldId?: string,
    comments?: string,
    fields?: IMrsObjectFieldWithReference[],
    storedFields?: IMrsObjectFieldWithReference[],
}

export enum MrsScriptResultType {
    Success = "success",
    Error = "error",
}

export interface IMrsScriptResult {
    statementIndex: number,
    type: MrsScriptResultType,
    message: string,
    operation: string,
    id?: string,
    result?: IDictionary,
}

export interface IMrsSdkOptions {
    serviceId: string,
    dbConnectionUri: string,
    sdkLanguage: string,
    addAppBaseClass?: string,
    serviceUrl: string,
    version?: number,
    generationDate?: string,
    header?: string,
}

export interface IMrsScriptProperty {
    name: string;
    value: string | number | boolean | IDictionary;
}

export interface IMrsScriptParameter {
    name: string;
    type: string;
    isArray: boolean;
}

export interface IMrsScriptCodePosition {
    lineNumberStart: number;
    lineNumberEnd: number;
    characterStart: number;
    characterEnd: number;
}

export interface IMrsScriptFileInfo {
    fullFileName: string;
    relativeFileName: string;
    fileName: string;
    lastModification: string;
}

export interface IMrsScriptReturnType {
    type: string;
    isArray: boolean;
}

export interface IMrsScriptDefinition {
    functionName: string;
    codePosition: IMrsScriptCodePosition;
    parameters: IMrsScriptParameter[];
    returnType: IMrsScriptReturnType;
    properties: IMrsScriptProperty[];
}

export interface IMrsScriptInterfaceProperty {
    name: string;
    type: string;
    optional: boolean;
    readOnly: boolean;
    indexSignatureType?: string;
}

export interface IMrsScriptInterfaceDefinition {
    fileInfo: IMrsScriptFileInfo;
    name: string;
    extends?: string;
    codePosition: IMrsScriptCodePosition;
    properties: IMrsScriptInterfaceProperty[];
}

export interface IMrsScriptModuleDefinition {
    fileInfo: IMrsScriptFileInfo,
    className: string;
    schemaType: string;
    codePosition: IMrsScriptCodePosition;
    properties: IMrsScriptProperty[];
    scripts: IMrsScriptDefinition[];
    triggers: IMrsScriptDefinition[];
}

export interface IMrsScriptError {
    message: string;
    kind?: string;
    fileInfo?: IMrsScriptFileInfo;
    script?: IMrsScriptDefinition;
    interface?: IMrsScriptInterfaceDefinition;
}

export interface IMrsScriptDefinitions {
    scriptModules: IMrsScriptModuleDefinition[];
    interfaces: IMrsScriptInterfaceDefinition[];
    errors: IMrsScriptError[];
    buildFolder?: string;
    staticContentFolders?: string[];
    info?: string;
}

export interface IProtocolMrsResults {
    [ShellAPIMrs.MrsAddService]: { result: IMrsServiceData; };
    [ShellAPIMrs.MrsGetService]: { result: IMrsServiceData; };
    [ShellAPIMrs.MrsListServices]: { result: IMrsServiceData[]; };
    [ShellAPIMrs.MrsEnableService]: {};
    [ShellAPIMrs.MrsDisableService]: {};
    [ShellAPIMrs.MrsDeleteService]: {};
    [ShellAPIMrs.MrsSetCurrentService]: {};
    [ShellAPIMrs.MrsGetCurrentServiceMetadata]: { result: IMrsCurrentServiceMetadata; };
    [ShellAPIMrs.MrsSetServiceContextPath]: {};
    [ShellAPIMrs.MrsSetServiceProtocol]: {};
    [ShellAPIMrs.MrsSetServiceComments]: {};
    [ShellAPIMrs.MrsSetServiceOptions]: {};
    [ShellAPIMrs.MrsUpdateService]: {};
    [ShellAPIMrs.MrsGetServiceRequestPathAvailability]: { result: boolean; };
    [ShellAPIMrs.MrsAddSchema]: { result: string; };
    [ShellAPIMrs.MrsGetSchema]: { result: IMrsSchemaData; };
    [ShellAPIMrs.MrsListSchemas]: { result: IMrsSchemaData[]; };
    [ShellAPIMrs.MrsEnableSchema]: {};
    [ShellAPIMrs.MrsDisableSchema]: {};
    [ShellAPIMrs.MrsDeleteSchema]: {};
    [ShellAPIMrs.MrsSetSchemaName]: {};
    [ShellAPIMrs.MrsSetSchemaRequestPath]: {};
    [ShellAPIMrs.MrsSetSchemaRequiresAuth]: {};
    [ShellAPIMrs.MrsSetSchemaItemsPerPage]: {};
    [ShellAPIMrs.MrsSetSchemaComments]: {};
    [ShellAPIMrs.MrsUpdateSchema]: {};
    [ShellAPIMrs.MrsAddContentSet]: { result: IMrsAddContentSetData; };
    [ShellAPIMrs.MrsGetContentSetCount]: { result: number; };
    [ShellAPIMrs.MrsListContentSets]: { result: IMrsContentSetData[]; };
    [ShellAPIMrs.MrsGetContentSet]: {};
    [ShellAPIMrs.MrsEnableContentSet]: {};
    [ShellAPIMrs.MrsDisableContentSet]: {};
    [ShellAPIMrs.MrsDeleteContentSet]: {};
    [ShellAPIMrs.MrsGetFolderMrsScriptLanguage]: { result?: string; };
    [ShellAPIMrs.MrsGetFileMrsScriptDefinitions]: { result: IMrsScriptModuleDefinition[]; };
    [ShellAPIMrs.MrsGetFolderMrsScriptDefinitions]: { result?: IMrsScriptDefinitions; };
    [ShellAPIMrs.MrsUpdateMrsScriptsFromContentSet]: {};
    [ShellAPIMrs.MrsAddDbObject]: { result: string; };
    [ShellAPIMrs.MrsGetDbObject]: { result: IMrsDbObjectData; };
    [ShellAPIMrs.MrsListDbObjects]: { result: IMrsDbObjectData[]; };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { result: IMrsDbObjectParameterData[]; };
    [ShellAPIMrs.MrsGetDbFunctionReturnType]: { result: string; };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: {};
    [ShellAPIMrs.MrsEnableDbObject]: {};
    [ShellAPIMrs.MrsDisableDbObject]: {};
    [ShellAPIMrs.MrsDeleteDbObject]: {};
    [ShellAPIMrs.MrsUpdateDbObject]: {};
    [ShellAPIMrs.MrsListContentFiles]: { result: IMrsContentFileData[]; };
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { result: IMrsAuthVendorData[]; };
    [ShellAPIMrs.MrsAddAuthenticationApp]: { result: IMrsAddAuthAppData; };
    [ShellAPIMrs.MrsDeleteAuthenticationApp]: {};
    [ShellAPIMrs.MrsUpdateAuthenticationApp]: {};
    [ShellAPIMrs.MrsListAuthenticationApps]: { result: IMrsAuthAppData[]; };
    [ShellAPIMrs.MrsGetAuthenticationApp]: { result: IMrsAuthAppData; };
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: {};
    [ShellAPIMrs.MrsConfigure]: {};
    [ShellAPIMrs.MrsStatus]: { result: IMrsStatusData; };
    [ShellAPIMrs.MrsIgnoreVersionUpgrade]: {};
    [ShellAPIMrs.MrsDumpService]: {};
    [ShellAPIMrs.MrsDumpSchema]: {};
    [ShellAPIMrs.MrsDumpObject]: {};
    [ShellAPIMrs.MrsLoadSchema]: {};
    [ShellAPIMrs.MrsLoadObject]: {};
    [ShellAPIMrs.MrsListUsers]: { result: IMrsUserData[]; };
    [ShellAPIMrs.MrsDeleteUser]: {};
    [ShellAPIMrs.MrsAddUser]: {};
    [ShellAPIMrs.MrsUpdateUser]: {};
    [ShellAPIMrs.MrsGetUser]: { result: IMrsUserData; };
    [ShellAPIMrs.MrsListRoles]: { result: IMrsRoleData[]; };
    [ShellAPIMrs.MrsListUserRoles]: { result: IMrsUserRoleData[]; };
    [ShellAPIMrs.MrsAddUserRole]: {};
    [ShellAPIMrs.MrsDeleteUserRoles]: {};
    [ShellAPIMrs.MrsAddRole]: {};
    [ShellAPIMrs.MrsGetRole]: { result: IMrsRoleData; };
    [ShellAPIMrs.MrsAddRolePrivilege]: {};
    [ShellAPIMrs.MrsDeleteRolePrivilege]: {};
    [ShellAPIMrs.MrsListRouterIds]: { result: number[]; };
    [ShellAPIMrs.MrsListRouters]: { result: IMrsRouterData[]; };
    [ShellAPIMrs.MrsDeleteRouter]: {};
    [ShellAPIMrs.MrsGetRouterServices]: {result: IMrsRouterService[]; };
    [ShellAPIMrs.MrsGetObjects]: { result: IMrsObject[]; };
    [ShellAPIMrs.MrsGetSdkBaseClasses]: { result: string; };
    [ShellAPIMrs.MrsGetSdkServiceClasses]: { result: string; };
    [ShellAPIMrs.MrsGetRuntimeManagementCode]: { result: string; };
    [ShellAPIMrs.MrsGetTableColumnsWithReferences]: { result: IMrsTableColumnWithReference[]; };
    [ShellAPIMrs.MrsGetObjectFieldsWithReferences]: { result: IMrsObjectFieldWithReference[]; };
    [ShellAPIMrs.MrsDumpSdkServiceFiles]: { result: boolean; };
    [ShellAPIMrs.MrsGetSdkOptions]: { result: IMrsSdkOptions; };
    [ShellAPIMrs.MrsRunScript]: { result: IMrsScriptResult[]; };
    [ShellAPIMrs.MrsGetServiceCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetSchemaCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetDbObjectCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetContentSetCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetContentFileCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetAuthAppCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsGetUserCreateStatement]: { result: string; };
    [ShellAPIMrs.MrsDumpServiceCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpSchemaCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpDbObjectCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpContentSetCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpContentFileCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpAuthAppCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpUserCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsGetRoleCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpRoleCreateStatement]: { result: boolean; };
    [ShellAPIMrs.MrsDumpAuditLog]: { result: boolean; };
}

