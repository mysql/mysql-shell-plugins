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

export enum ShellAPIMrs {
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
	/** Sets the default MRS service */
	MrsSetServiceDefault = "mrs.set.service.default",
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
	/** Enables a content_set of the given service */
	MrsDeleteContentSet = "mrs.delete.content_set",
	/** Add a db_object to the given MRS service schema */
	MrsAddDbObject = "mrs.add.db_object",
	/** Gets a specific MRS db_object */
	MrsGetDbObject = "mrs.get.db_object",
	/** Gets the list of possible row ownership fields for the given db_object */
	MrsGetDbObjectRowOwnershipFields = "mrs.get.db_object_row_ownership_fields",
	/** Gets the list of available row ownership fields for the given db_object */
	MrsGetDbObjectFields = "mrs.get.db_object_fields",
	/** Returns all db_objects for the given schema */
	MrsListDbObjects = "mrs.list.db_objects",
	/** Gets the list of parameters for the given db_object */
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
	/** Returns all db_objects for the given schema */
	MrsListContentFiles = "mrs.list.content_files",
	/** Adds an auth_app to the given MRS service */
	MrsGetAuthenticationVendors = "mrs.get.authentication_vendors",
	/** Adds an auth_app to the given MRS service */
	MrsAddAuthenticationApp = "mrs.add.authentication_app",
	/** Returns all authentication apps for the given MRS service */
	MrsListAuthenticationApps = "mrs.list.authentication_apps",
	/** Returns basic information about this plugin. */
	MrsInfo = "mrs.info",
	/** Returns the version number of the plugin */
	MrsVersion = "mrs.version",
	/** Lists the schemas that are currently offered via MRS */
	MrsLs = "mrs.ls",
	/** Initializes and configures the MySQL REST Data Service */
	MrsConfigure = "mrs.configure",
	/** Checks the MRS service status and prints its */
	MrsStatus = "mrs.status"
}

export interface IShellMrsAddServiceKwargs {
	/** The protocols supported by this service */
	urlProtocol?: unknown[];
	/** Whether the new service should be the new default */
	isDefault?: boolean;
	/** Comments about the service */
	comments?: string;
	/** Options for the service */
	options?: string;
	/** The authentication path */
	authPath?: string;
	/** The redirection URL called after authentication */
	authCompletedUrl?: string;
	/** The regular expression that validates the app redirection URL specified by the /login?onCompletionRedirect parameter */
	authCompletedUrlValidation?: string;
	/** The custom page content to use of the authentication completed page */
	authCompletedPageContent?: string;
	/** The list of auth_apps in JSON format */
	authApps?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsGetServiceKwargs {
	/** Whether to return the default service */
	getDefault?: boolean;
	/** If there is a single service only, use that */
	autoSelectSingle?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsListServicesKwargs {
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsEnableServiceKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsDisableServiceKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsDeleteServiceKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetServiceDefaultKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetServiceContextPathKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The context_path */
	value?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetServiceProtocolKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS' */
	value?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetServiceCommentsKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The comments */
	value?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetServiceOptionsKwargs {
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The comments */
	value?: string;
	/** The id of the service */
	serviceId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsUpdateServiceKwargs {
	/** The id of the service */
	serviceId?: number;
	/** The context root for this service */
	urlContextRoot?: string;
	/** The host name for this service */
	urlHostName?: string;
	/** The protocol either 'HTTP', 'HTTPS' or 'HTTP,HTTPS' */
	urlProtocol?: unknown[];
	/** Whether the service should be enabled */
	enabled?: boolean;
	/** Comments about the service */
	comments?: string;
	/** Options of the service */
	options?: string;
	/** The authentication path */
	authPath?: string;
	/** The redirection URL called after authentication */
	authCompletedUrl?: string;
	/** The regular expression that validates the app redirection URL specified by the /login?onCompletionRedirect parameter */
	authCompletedUrlValidation?: string;
	/** The custom page content to use of the authentication completed page */
	authCompletedPageContent?: string;
	/** The list of auth_apps in JSON format */
	authApps?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsGetServiceRequestPathAvailabilityKwargs {
	/** The id of the service */
	serviceId?: number;
	/** The request path to check */
	requestPath?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsAddSchemaKwargs {
	/** The name of the schema to add */
	schemaName?: string;
	/** The id of the service the schema should be added to */
	serviceId?: number;
	/** The request_path */
	requestPath?: string;
	/** Whether authentication is required to access the schema */
	requiresAuth?: boolean;
	/** The enabled state */
	enabled?: boolean;
	/** The number of items returned per page */
	itemsPerPage?: number;
	/** Comments for the schema */
	comments?: string;
	/** The options for the schema */
	options?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsGetSchemaKwargs {
	/** The request_path of the schema */
	requestPath?: string;
	/** The name of the schema */
	schemaName?: string;
	/** The id of the schema */
	schemaId?: number;
	/** The id of the service */
	serviceId?: number;
	/** If there is a single service only, use that */
	autoSelectSingle?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If true exceptions are raised */
	raiseExceptions?: boolean;
	/** If true a human readable string is returned */
	returnFormatted?: boolean;
	/** Used for internal plugin calls */
	returnPythonObject?: boolean;
}
export interface IShellMrsListSchemasKwargs {
	/** The id of the service to list the schemas from */
	serviceId?: number;
	/** Only include schemas with the given enabled state */
	includeEnableState?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsEnableSchemaKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsDisableSchemaKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsDeleteSchemaKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetSchemaNameKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The value */
	value?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetSchemaRequestPathKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The value */
	value?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetSchemaRequiresAuthKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The value */
	value?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetSchemaItemsPerPageKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The value */
	value?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsSetSchemaCommentsKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The value */
	value?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsUpdateSchemaKwargs {
	/** The name of the schema */
	schemaName?: string;
	/** The id of the service */
	serviceId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The request_path */
	requestPath?: string;
	/** Whether authentication is required to access the schema */
	requiresAuth?: boolean;
	/** The enabled state */
	enabled?: boolean;
	/** The number of items returned per page */
	itemsPerPage?: number;
	/** Comments for the schema */
	comments?: string;
	/** The options for the schema */
	options?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsAddContentSetKwargs {
	/** The path to the content directory */
	contentDir?: string;
	/** The id of the service the schema should be added to */
	serviceId?: number;
	/** The request_path */
	requestPath?: string;
	/** Whether authentication is required to access the content */
	requiresAuth?: boolean;
	/** Comments about the content */
	comments?: string;
	/** Whether to enable the content set after all files are uploaded */
	enabled?: boolean;
	/** The options as JSON string */
	options?: string;
	/** Whether to replace a content set that uses the same request_path */
	replaceExisting?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsListContentSetsKwargs {
	/** Only include items with the given enabled state */
	includeEnableState?: boolean;
	/** The request_path of the content_set */
	requestPath?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to false, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsGetContentSetKwargs {
	/** The id of the content_set */
	contentSetId?: number;
	/** The id of the service */
	serviceId?: number;
	/** If there is a single service only, use that */
	autoSelectSingle?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsEnableContentSetKwargs {
	/** The id of the service */
	serviceId?: number;
	/** The id of the content_set */
	contentSetId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsDisableContentSetKwargs {
	/** The id of the service */
	serviceId?: number;
	/** The id of the content_set */
	contentSetId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsDeleteContentSetKwargs {
	/** The id of the service */
	serviceId?: number;
	/** The id of the content_set */
	contentSetId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsAddDbObjectKwargs {
	/** The name of the schema object add */
	dbObjectName?: string;
	/** Either TABLE, VIEW or PROCEDURE */
	dbObjectType?: string;
	/** The id of the schema the object should be added to */
	schemaId?: number;
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
	options?: string;
	/** The parameter definition in JSON format */
	parameters?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If true exceptions are raised */
	raiseExceptions?: boolean;
	/** If true a human readable string is returned */
	returnFormatted?: boolean;
	/** Used for internal plugin calls */
	returnPythonObject?: boolean;
}
export interface IShellMrsGetDbObjectKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsGetDbObjectRowOwnershipFieldsKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The name of the schema */
	schemaName?: string;
	/** The type of the db_object (TABLE, VIEW, PROCEDURE) */
	dbObjectType?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsGetDbObjectFieldsKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The name of the schema */
	schemaName?: string;
	/** The type of the db_object (TABLE, VIEW, PROCEDURE) */
	dbObjectType?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsListDbObjectsKwargs {
	/** The id of the schema to list the db_objects from */
	schemaId?: number;
	/** Only include db_objects with the given enabled state */
	includeEnableState?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsGetDbObjectParametersKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The id of the schema */
	schemaId?: number;
	/** The name of the schema */
	schemaName?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsSetDbObjectRequestPathKwargs {
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsSetDbObjectCrudOperationsKwargs {
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsEnableDbObjectKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsDisableDbObjectKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsDeleteDbObjectKwargs {
	/** The id of the db_object */
	dbObjectId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsUpdateDbObjectKwargs {
	/** The id of the db object */
	dbObjectId?: number;
	/** The name of the schema object add */
	dbObjectName?: string;
	/** The id of the schema the object should be added to */
	schemaId?: number;
	/** The request_path */
	requestPath?: string;
	/** The new name to apply to the database object */
	name?: string;
	/** If the DB Object is enabled or not */
	enabled?: boolean;
	/** The allowed CRUD operations for the object */
	crudOperations?: unknown[];
	/** The format to use for the CRUD operation */
	crudOperationFormat?: string;
	/** Whether authentication is required to access the schema */
	requiresAuth?: boolean;
	/** The number of items returned per page */
	itemsPerPage?: number;
	/** Whether the media type should be detected automatically */
	autoDetectMediaType?: boolean;
	/** Enable row ownership enforcement */
	rowUserOwnershipEnforced?: boolean;
	/** The column for row ownership enforcement */
	rowUserOwnershipColumn?: string;
	/** Comments for the schema */
	comments?: string;
	/** The media_type of the db object */
	mediaType?: string;
	/** The stored procedure that implements the authentication check for this db object */
	authStoredProcedure?: string;
	/** The options of this db object */
	options?: string;
	/** The db objects parameters as JSON string */
	parameters?: string;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If true exceptions are raised */
	raiseExceptions?: boolean;
	/** If true a human readable string is returned */
	returnFormatted?: boolean;
	/** Used for internal plugin calls */
	returnPythonObject?: boolean;
}
export interface IShellMrsListContentFilesKwargs {
	/** The id of the content_set to list the items from */
	contentSetId?: number;
	/** Only include db_objects with the given enabled state */
	includeEnableState?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsGetAuthenticationVendorsKwargs {
	/** Whether to return just the enabled vendors (default) or all */
	enabled?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsAddAuthenticationAppKwargs {
	/** The app_name */
	appName?: string;
	/** The id of the service the schema should be added to */
	serviceId?: number;
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
	/** Limit access to registered users */
	useBuiltInAuthorization?: boolean;
	/** List of registered users, separated by , */
	registeredUsers?: string;
	/** The default role to be assigned to new users */
	defaultAuthRoleId?: number;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
}
export interface IShellMrsListAuthenticationAppsKwargs {
	/** Only include items with the given enabled state */
	includeEnableState?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}
export interface IShellMrsConfigureKwargs {
	/** Whether MRS should be enabled or disabled */
	enableMrs?: boolean;
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
}
export interface IShellMrsStatusKwargs {
	/** The string id for the module session object, holding the database session to be used on the operation. */
	moduleSessionId?: string;
	/** Indicates whether to execute in interactive mode */
	interactive?: boolean;
	/** If set to true exceptions are raised */
	raiseExceptions?: boolean;
	/** If set to true, a list object is returned */
	returnFormatted?: boolean;
}

export interface IProtocolMrsParameters {
	[ShellAPIMrs.MrsAddService]: { args: {urlContextRoot?: string, urlHostName?: string, enabled?: boolean}; kwargs?: IShellMrsAddServiceKwargs };
	[ShellAPIMrs.MrsGetService]: { args: {urlContextRoot?: string, urlHostName?: string, serviceId?: number}; kwargs?: IShellMrsGetServiceKwargs };
	[ShellAPIMrs.MrsListServices]: { kwargs?: IShellMrsListServicesKwargs };
	[ShellAPIMrs.MrsEnableService]: { kwargs?: IShellMrsEnableServiceKwargs };
	[ShellAPIMrs.MrsDisableService]: { kwargs?: IShellMrsDisableServiceKwargs };
	[ShellAPIMrs.MrsDeleteService]: { kwargs?: IShellMrsDeleteServiceKwargs };
	[ShellAPIMrs.MrsSetServiceDefault]: { kwargs?: IShellMrsSetServiceDefaultKwargs };
	[ShellAPIMrs.MrsSetServiceContextPath]: { kwargs?: IShellMrsSetServiceContextPathKwargs };
	[ShellAPIMrs.MrsSetServiceProtocol]: { kwargs?: IShellMrsSetServiceProtocolKwargs };
	[ShellAPIMrs.MrsSetServiceComments]: { kwargs?: IShellMrsSetServiceCommentsKwargs };
	[ShellAPIMrs.MrsSetServiceOptions]: { kwargs?: IShellMrsSetServiceOptionsKwargs };
	[ShellAPIMrs.MrsUpdateService]: { kwargs?: IShellMrsUpdateServiceKwargs };
	[ShellAPIMrs.MrsGetServiceRequestPathAvailability]: { kwargs?: IShellMrsGetServiceRequestPathAvailabilityKwargs };
	[ShellAPIMrs.MrsAddSchema]: { kwargs?: IShellMrsAddSchemaKwargs };
	[ShellAPIMrs.MrsGetSchema]: { kwargs?: IShellMrsGetSchemaKwargs };
	[ShellAPIMrs.MrsListSchemas]: { kwargs?: IShellMrsListSchemasKwargs };
	[ShellAPIMrs.MrsEnableSchema]: { kwargs?: IShellMrsEnableSchemaKwargs };
	[ShellAPIMrs.MrsDisableSchema]: { kwargs?: IShellMrsDisableSchemaKwargs };
	[ShellAPIMrs.MrsDeleteSchema]: { kwargs?: IShellMrsDeleteSchemaKwargs };
	[ShellAPIMrs.MrsSetSchemaName]: { kwargs?: IShellMrsSetSchemaNameKwargs };
	[ShellAPIMrs.MrsSetSchemaRequestPath]: { kwargs?: IShellMrsSetSchemaRequestPathKwargs };
	[ShellAPIMrs.MrsSetSchemaRequiresAuth]: { kwargs?: IShellMrsSetSchemaRequiresAuthKwargs };
	[ShellAPIMrs.MrsSetSchemaItemsPerPage]: { kwargs?: IShellMrsSetSchemaItemsPerPageKwargs };
	[ShellAPIMrs.MrsSetSchemaComments]: { kwargs?: IShellMrsSetSchemaCommentsKwargs };
	[ShellAPIMrs.MrsUpdateSchema]: { kwargs?: IShellMrsUpdateSchemaKwargs };
	[ShellAPIMrs.MrsAddContentSet]: { kwargs?: IShellMrsAddContentSetKwargs };
	[ShellAPIMrs.MrsListContentSets]: { args: {serviceId?: number}; kwargs?: IShellMrsListContentSetsKwargs };
	[ShellAPIMrs.MrsGetContentSet]: { args: {requestPath?: string}; kwargs?: IShellMrsGetContentSetKwargs };
	[ShellAPIMrs.MrsEnableContentSet]: { kwargs?: IShellMrsEnableContentSetKwargs };
	[ShellAPIMrs.MrsDisableContentSet]: { kwargs?: IShellMrsDisableContentSetKwargs };
	[ShellAPIMrs.MrsDeleteContentSet]: { kwargs?: IShellMrsDeleteContentSetKwargs };
	[ShellAPIMrs.MrsAddDbObject]: { kwargs?: IShellMrsAddDbObjectKwargs };
	[ShellAPIMrs.MrsGetDbObject]: { args: {requestPath?: string, dbObjectName?: string}; kwargs?: IShellMrsGetDbObjectKwargs };
	[ShellAPIMrs.MrsGetDbObjectRowOwnershipFields]: { args: {requestPath?: string, dbObjectName?: string}; kwargs?: IShellMrsGetDbObjectRowOwnershipFieldsKwargs };
	[ShellAPIMrs.MrsGetDbObjectFields]: { args: {requestPath?: string, dbObjectName?: string}; kwargs?: IShellMrsGetDbObjectFieldsKwargs };
	[ShellAPIMrs.MrsListDbObjects]: { kwargs?: IShellMrsListDbObjectsKwargs };
	[ShellAPIMrs.MrsGetDbObjectParameters]: { args: {requestPath?: string, dbObjectName?: string}; kwargs?: IShellMrsGetDbObjectParametersKwargs };
	[ShellAPIMrs.MrsSetDbObjectRequestPath]: { args: {dbObjectId?: number, requestPath?: string}; kwargs?: IShellMrsSetDbObjectRequestPathKwargs };
	[ShellAPIMrs.MrsSetDbObjectCrudOperations]: { args: {dbObjectId?: number, crudOperations?: unknown[], crudOperationFormat?: string}; kwargs?: IShellMrsSetDbObjectCrudOperationsKwargs };
	[ShellAPIMrs.MrsEnableDbObject]: { args: {dbObjectName?: string, schemaId?: number}; kwargs?: IShellMrsEnableDbObjectKwargs };
	[ShellAPIMrs.MrsDisableDbObject]: { args: {dbObjectName?: string, schemaId?: number}; kwargs?: IShellMrsDisableDbObjectKwargs };
	[ShellAPIMrs.MrsDeleteDbObject]: { args: {dbObjectName?: string, schemaId?: number}; kwargs?: IShellMrsDeleteDbObjectKwargs };
	[ShellAPIMrs.MrsUpdateDbObject]: { kwargs?: IShellMrsUpdateDbObjectKwargs };
	[ShellAPIMrs.MrsListContentFiles]: { kwargs?: IShellMrsListContentFilesKwargs };
	[ShellAPIMrs.MrsGetAuthenticationVendors]: { kwargs?: IShellMrsGetAuthenticationVendorsKwargs };
	[ShellAPIMrs.MrsAddAuthenticationApp]: { kwargs?: IShellMrsAddAuthenticationAppKwargs };
	[ShellAPIMrs.MrsListAuthenticationApps]: { args: {serviceId?: number}; kwargs?: IShellMrsListAuthenticationAppsKwargs };
	[ShellAPIMrs.MrsInfo]: {};
	[ShellAPIMrs.MrsVersion]: {};
	[ShellAPIMrs.MrsLs]: { args: {path?: string, moduleSessionId?: string}; };
	[ShellAPIMrs.MrsConfigure]: { kwargs?: IShellMrsConfigureKwargs };
	[ShellAPIMrs.MrsStatus]: { kwargs?: IShellMrsStatusKwargs };

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
}

