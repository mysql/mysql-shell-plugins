/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { IShellDictionary } from "./Protocol";
import { IDictionary } from "../app-logic/Types";

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
    /** Add a db_object to the given MRS service schema */
    MrsAddDbObject = "mrs.add.db_object",
    /** Gets a specific MRS db_object */
    MrsGetDbObject = "mrs.get.db_object",
    /** Returns all db_objects for the given schema */
    MrsListDbObjects = "mrs.list.db_objects",
    /** Gets the list of available parameters given db_object representing a STORED PROCEDURE */
    MrsGetDbObjectParameters = "mrs.get.db_object_parameters",
    /** Sets the request_path of the given db_object */
    MrsSetDbObjectRequestPath = "mrs.set.dbObject.request_path",
    /** Sets the request_path of the given db_object */
    MrsSetDbObjectCrudOperations = "mrs.set.dbObject.crud_operations",
    /** Enables a db_object of the given schema */
    MrsEnableDbObject = "mrs.enable.db_object",
    /** Disables a db_object of the given service */
    MrsDisableDbObject = "mrs.disable.db_object",
    /** Deletes a schema of the given service */
    MrsDeleteDbObject = "mrs.delete.db_object",
    /** Update a db_object */
    MrsUpdateDbObject = "mrs.update.db_object",
    /** Gets the list of table columns and references */
    MrsGetTableColumnsWithReferences = "mrs.get.table_columns_with_references",
    /** Gets the list of objects for the given db_object */
    MrsGetObjects = "mrs.get.objects",
    /** Gets the list of object fields and references */
    MrsGetObjectFieldsWithReferences = "mrs.get.object_fields_with_references",
    /** Adds content to the given MRS service */
    MrsAddContentSet = "mrs.add.content_set",
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
    /** Returns all files for the given content set */
    MrsListContentFiles = "mrs.list.content_files",
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
    /** List the roles for the specified service */
    MrsListRoles = "mrs.list.roles",
    /** Add a new role */
    MrsAddRole = "mrs.add.role",
    /** List all router ids */
    MrsListRouterIds = "mrs.list.router_ids",
    /** List all configured routers */
    MrsListRouters = "mrs.list.routers",
    /** Delete an existing router */
    MrsDeleteRouter = "mrs.delete.router"
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
    /** The list of auth_apps in JSON format */
    authApps?: unknown[];
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
    /** The list of auth_apps in JSON format */
    authApps?: unknown[];
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
    /** The SDK language to generate */
    sdkLanguage?: string;
    /** Prepare code to be used in Monaco at runtime */
    prepareForRuntime?: boolean;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsDumpSdkServiceFilesKwargs {
    /** The ID of the service the SDK should be generated for. If not specified, the default service is used. */
    serviceId?: string;
    /** The SDK language to generate */
    sdkLanguage?: string;
    /** The directory to store the .mrs.sdk folder with the files */
    directory?: string;
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
    enabled?: boolean;
    /** The number of items returned per page */
    itemsPerPage: number | null;
    /** Comments for the schema */
    comments?: string;
    /** The options for the schema */
    options: IShellDictionary | null;
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
    /** The name of the schema */
    schemaName?: string;
    /** The request_path */
    requestPath?: string;
    /** Whether authentication is required to access the schema */
    requiresAuth?: boolean;
    /** The enabled state */
    enabled?: boolean;
    /** The number of items returned per page */
    itemsPerPage: number | null;
    /** Comments for the schema */
    comments?: string;
    /** The options for the schema */
    options: IShellDictionary | null;
}

export interface IShellMrsUpdateSchemaKwargs {
    /** The id of the schema */
    schemaId?: string;
    /** The id of the service */
    serviceId?: string;
    /** The name of the schema */
    schemaName?: string;
    /** The values as dict #TODO: check why dicts cannot be passed */
    value: IShellMrsUpdateSchemaKwargsValue | null;
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
    /** List of registered users, separated by , */
    registeredUsers?: unknown[];
    /** The default role to be assigned to new users */
    defaultRoleId: string | null;
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
    enabled?: boolean;
    /** The allowed CRUD operations for the object */
    crudOperations?: unknown[];
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
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetDbObjectRequestPathKwargs {
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMrsSetDbObjectCrudOperationsKwargs {
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
    enabled?: boolean;
    /** The allowed CRUD operations for the object */
    crudOperations?: unknown[];
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
    /** Enable row ownership enforcement */
    rowUserOwnershipEnforced?: boolean;
    /** The column for row ownership enforcement */
    rowUserOwnershipColumn?: string;
    /** Comments for the database object */
    comments?: string;
    /** The media_type of the db object */
    mediaType?: string;
    /** The stored procedure that implements the authentication check for this db object */
    authStoredProcedure?: string;
    /** The options of this db object */
    options: IShellDictionary | null;
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

export interface IShellMrsAddContentSetKwargs {
    /** The request_path */
    requestPath: string | null;
    /** Whether authentication is required to access the content */
    requiresAuth: boolean | null;
    /** Comments about the content */
    comments?: string;
    /** Whether to enable the content set after all files are uploaded */
    enabled?: boolean;
    /** The options as JSON string */
    options: IShellDictionary | null;
    /** Whether to replace a content set that uses the same request_path */
    replaceExisting?: boolean;
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

export interface IShellMrsListContentFilesKwargs {
    /** Only include db_objects with the given enabled state */
    includeEnableState?: boolean;
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

export interface IProtocolMrsParameters {
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: { args: { path?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsConfigure]: { args: { moduleSessionId?: string; enableMrs?: boolean; allowRecreationOnMajorUpgrade?: boolean; }; };
    [ShellAPIMrs.MrsStatus]: { args: { moduleSessionId?: string; }; };
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
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { kwargs?: IShellMrsGetAuthenticationVendorsKwargs; };
    [ShellAPIMrs.MrsAddAuthenticationApp]: { args: { appName?: string; serviceId?: string; }; kwargs?: IShellMrsAddAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsGetAuthenticationApp]: { args: { appId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsListAuthenticationApps]: { args: { serviceId?: string; }; kwargs?: IShellMrsListAuthenticationAppsKwargs; };
    [ShellAPIMrs.MrsDeleteAuthenticationApp]: { kwargs?: IShellMrsDeleteAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsUpdateAuthenticationApp]: { kwargs?: IShellMrsUpdateAuthenticationAppKwargs; };
    [ShellAPIMrs.MrsAddDbObject]: { kwargs?: IShellMrsAddDbObjectKwargs; };
    [ShellAPIMrs.MrsGetDbObject]: { args: { requestPath?: string; dbObjectName?: string; }; kwargs?: IShellMrsGetDbObjectKwargs; };
    [ShellAPIMrs.MrsListDbObjects]: { kwargs?: IShellMrsListDbObjectsKwargs; };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { args: { requestPath?: string; }; kwargs?: IShellMrsGetDbObjectParametersKwargs; };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: { args: { dbObjectId?: string; requestPath?: string; }; kwargs?: IShellMrsSetDbObjectRequestPathKwargs; };
    [ShellAPIMrs.MrsSetDbObjectCrudOperations]: { args: { dbObjectId?: string; crudOperations?: unknown[]; crudOperationFormat?: string; }; kwargs?: IShellMrsSetDbObjectCrudOperationsKwargs; };
    [ShellAPIMrs.MrsEnableDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsEnableDbObjectKwargs; };
    [ShellAPIMrs.MrsDisableDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsDisableDbObjectKwargs; };
    [ShellAPIMrs.MrsDeleteDbObject]: { args: { dbObjectName?: string; schemaId?: string; }; kwargs?: IShellMrsDeleteDbObjectKwargs; };
    [ShellAPIMrs.MrsUpdateDbObject]: { kwargs?: IShellMrsUpdateDbObjectKwargs; };
    [ShellAPIMrs.MrsGetTableColumnsWithReferences]: { args: { dbObjectId?: string; schemaId?: string; requestPath?: string; dbObjectName?: string; }; kwargs?: IShellMrsGetTableColumnsWithReferencesKwargs; };
    [ShellAPIMrs.MrsGetObjects]: { args: { dbObjectId?: string; }; kwargs?: IShellMrsGetObjectsKwargs; };
    [ShellAPIMrs.MrsGetObjectFieldsWithReferences]: { args: { objectId?: string; }; kwargs?: IShellMrsGetObjectFieldsWithReferencesKwargs; };
    [ShellAPIMrs.MrsAddContentSet]: { args: { serviceId?: string; contentDir?: string; }; kwargs?: IShellMrsAddContentSetKwargs; };
    [ShellAPIMrs.MrsListContentSets]: { args: { serviceId?: string; }; kwargs?: IShellMrsListContentSetsKwargs; };
    [ShellAPIMrs.MrsGetContentSet]: { kwargs?: IShellMrsGetContentSetKwargs; };
    [ShellAPIMrs.MrsEnableContentSet]: { kwargs?: IShellMrsEnableContentSetKwargs; };
    [ShellAPIMrs.MrsDisableContentSet]: { kwargs?: IShellMrsDisableContentSetKwargs; };
    [ShellAPIMrs.MrsDeleteContentSet]: { kwargs?: IShellMrsDeleteContentSetKwargs; };
    [ShellAPIMrs.MrsListContentFiles]: { args: { contentSetId: string; }; kwargs?: IShellMrsListContentFilesKwargs; };
    [ShellAPIMrs.MrsDumpService]: { args: { path: string; }; kwargs?: IShellMrsDumpServiceKwargs; };
    [ShellAPIMrs.MrsDumpSchema]: { args: { path: string; }; kwargs?: IShellMrsDumpSchemaKwargs; };
    [ShellAPIMrs.MrsDumpObject]: { args: { path: string; }; kwargs?: IShellMrsDumpObjectKwargs; };
    [ShellAPIMrs.MrsLoadSchema]: { args: { path: string; }; kwargs?: IShellMrsLoadSchemaKwargs; };
    [ShellAPIMrs.MrsLoadObject]: { args: { path: string; }; kwargs?: IShellMrsLoadObjectKwargs; };
    [ShellAPIMrs.MrsListUsers]: { kwargs?: IShellMrsListUsersKwargs; };
    [ShellAPIMrs.MrsGetUser]: { kwargs?: IShellMrsGetUserKwargs; };
    [ShellAPIMrs.MrsAddUser]: { kwargs?: IShellMrsAddUserKwargs; };
    [ShellAPIMrs.MrsDeleteUser]: { args: { userId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsUpdateUser]: { kwargs?: IShellMrsUpdateUserKwargs; };
    [ShellAPIMrs.MrsListUserRoles]: { args: { userId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsAddUserRole]: { args: { userId?: string; roleId?: string; comments?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsDeleteUserRoles]: { args: { userId?: string; roleId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsListRoles]: { args: { serviceId?: string; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsAddRole]: { args: { caption: string; }; kwargs?: IShellMrsAddRoleKwargs; };
    [ShellAPIMrs.MrsListRouterIds]: { args: { seenWithin?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsListRouters]: { args: { activeWhenSeenWithin?: number; moduleSessionId?: string; }; };
    [ShellAPIMrs.MrsDeleteRouter]: { args: { routerId?: number; moduleSessionId?: string; }; };

}

export interface IMrsDbObjectParameterData {
    id?: string;
    position: number;
    name: string;
    mode: string;
    datatype: string;
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
    objectType: string;
    requestPath: string;
    requiresAuth: number;
    rowUserOwnershipColumn?: string;
    rowUserOwnershipEnforced: number;
    schemaRequestPath?: string;
    schemaName?: string;
    qualifiedName?: string;
    serviceId: string;
    mediaType?: string;
    autoDetectMediaType: number;
    authStoredProcedure?: string;
    options?: IShellDictionary;
    objects?: IMrsObject[];
}

export interface IMrsContentSetData {
    comments: string;
    enabled: number;
    hostCtx: string;
    id: string;
    requestPath: string;
    requiresAuth: number;
    serviceId: string;
    options: IShellDictionary;
}

export interface IMrsContentFileData {
    id: string;
    contentSetId: string;
    requestPath: string;
    requiresAuth: boolean;
    enabled: boolean;
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

export interface IMrsServiceData {
    enabled: number;
    hostCtx: string;
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
}

export interface IMrsStatusData {
    serviceConfigured: boolean;
    serviceCount: number;
    serviceEnabled: boolean;
    serviceUpgradeable: boolean;
    majorUpgradeRequired: boolean;
    currentMetadataVersion?: string;
    requiredMetadataVersion?: string;
    requiredRouterVersion?: string;
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
}

export interface IMrsCurrentServiceMetadata {
    id?: string,
    hostCtx?: string,
    metadataVersion?: string,
}

export interface IMrsTableColumn {
    name: string,
    datatype: string,
    notNull: boolean,
    isPrimary: boolean,
    isUnique: boolean,
    isGenerated: boolean,
    idGeneration?: string,
    comment?: string,
    in?: boolean,
    out?: boolean,
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
    referenceMapping: IMrsTableReference,
    unnest: boolean,
    crudOperations: string,
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
    language: string,
    className?: string,
}

export interface IMrsObjectSdkOptions extends IShellDictionary {
    languageOptions?: IMrsObjectSdkLanguageOptions[],
}

export interface IMrsObject {
    id: string,
    dbObjectId: string,
    name: string,
    position: number,
    kind: string,
    sdkOptions?: IMrsObjectSdkOptions,
    comments?: string,
    fields?: IMrsObjectFieldWithReference[],
    storedFields?: IMrsObjectFieldWithReference[],
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
    [ShellAPIMrs.MrsGetSchema]: {};
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
    [ShellAPIMrs.MrsListContentSets]: { result: IMrsContentSetData[]; };
    [ShellAPIMrs.MrsGetContentSet]: {};
    [ShellAPIMrs.MrsEnableContentSet]: {};
    [ShellAPIMrs.MrsDisableContentSet]: {};
    [ShellAPIMrs.MrsDeleteContentSet]: {};
    [ShellAPIMrs.MrsAddDbObject]: { result: string; };
    [ShellAPIMrs.MrsGetDbObject]: { result: IMrsDbObjectData; };
    [ShellAPIMrs.MrsListDbObjects]: { result: IMrsDbObjectData[]; };
    [ShellAPIMrs.MrsGetDbObjectParameters]: { result: IMrsDbObjectParameterData[]; };
    [ShellAPIMrs.MrsSetDbObjectRequestPath]: {};
    [ShellAPIMrs.MrsSetDbObjectCrudOperations]: {};
    [ShellAPIMrs.MrsEnableDbObject]: {};
    [ShellAPIMrs.MrsDisableDbObject]: {};
    [ShellAPIMrs.MrsDeleteDbObject]: {};
    [ShellAPIMrs.MrsUpdateDbObject]: {};
    [ShellAPIMrs.MrsListContentFiles]: { result: IMrsContentFileData[]; };
    [ShellAPIMrs.MrsGetAuthenticationVendors]: { result: IMrsAuthVendorData[]; };
    [ShellAPIMrs.MrsAddAuthenticationApp]: { result: IMrsAuthAppData; };
    [ShellAPIMrs.MrsDeleteAuthenticationApp]: {};
    [ShellAPIMrs.MrsUpdateAuthenticationApp]: {};
    [ShellAPIMrs.MrsListAuthenticationApps]: { result: IMrsAuthAppData[]; };
    [ShellAPIMrs.MrsGetAuthenticationApp]: { result: IMrsAuthAppData; };
    [ShellAPIMrs.MrsInfo]: {};
    [ShellAPIMrs.MrsVersion]: {};
    [ShellAPIMrs.MrsLs]: {};
    [ShellAPIMrs.MrsConfigure]: {};
    [ShellAPIMrs.MrsStatus]: { result: IMrsStatusData; };
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
    [ShellAPIMrs.MrsListRouterIds]: { result: number[]; };
    [ShellAPIMrs.MrsListRouters]: { result: IMrsRouterData[]; };
    [ShellAPIMrs.MrsDeleteRouter]: {};
    [ShellAPIMrs.MrsGetObjects]: { result: IMrsObject[]; };
    [ShellAPIMrs.MrsGetSdkBaseClasses]: { result: string; };
    [ShellAPIMrs.MrsGetSdkServiceClasses]: { result: string; };
    [ShellAPIMrs.MrsGetTableColumnsWithReferences]: { result: IMrsTableColumnWithReference[]; };
    [ShellAPIMrs.MrsGetObjectFieldsWithReferences]: { result: IMrsObjectFieldWithReference[]; };
    [ShellAPIMrs.MrsDumpSdkServiceFiles]: { result: boolean; };
}

