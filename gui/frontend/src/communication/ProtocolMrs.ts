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

import { Protocol, IShellRequest } from ".";


/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

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

//  Begin auto generated types

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

export class ProtocolMrs extends Protocol {
    //  Begin auto generated content
    /**
     * Adds a new MRS service
     *
     * @param urlContextRoot The context root for this service
     * @param urlHostName The host name for this service
     * @param enabled Whether the new service should be enabled
     * @param kwargs Additional options
     *
     * @returns None in interactive mode, a dict holding the new service id otherwise
     */
    public static getRequestAddService(urlContextRoot?: string, urlHostName?: string, enabled = true, kwargs?: IShellAddServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_protocol: kwargs.urlProtocol,
                is_default: kwargs.isDefault,
                comments: kwargs.comments,
                options: kwargs.options,
                auth_path: kwargs.authPath,
                auth_completed_url: kwargs.authCompletedUrl,
                auth_completed_url_validation: kwargs.authCompletedUrlValidation,
                auth_completed_page_content: kwargs.authCompletedPageContent,
                auth_apps: kwargs.authApps,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsAddService,
            {
                args: {
                    url_context_root: urlContextRoot,
                    url_host_name: urlHostName,
                    enabled,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a specific MRS service
     *
     * @param urlContextRoot The context root for this service
     * @param urlHostName The host name for this service
     * @param serviceId The id of the service
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * If no service is specified, the service that is set as current service is
     * returned if it was defined before
     *
     * <b>Returns:</b>
     *
     *     The service as dict or None on error in interactive mode
     */
    public static getRequestGetService(urlContextRoot?: string, urlHostName?: string, serviceId?: number, kwargs?: IShellGetServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                get_default: kwargs.getDefault,
                auto_select_single: kwargs.autoSelectSingle,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetService,
            {
                args: {
                    url_context_root: urlContextRoot,
                    url_host_name: urlHostName,
                    service_id: serviceId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Get a list of MRS services
     *
     * @param kwargs Additional options
     *
     * @returns Either a string listing the services when interactive is set or list     of dicts representing the services
     */
    public static getRequestListServices(kwargs?: IShellListServicesKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListServices,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * If there is no service yet, a service with default values will be created
     * and set as default.
     *
     * <b>Returns:</b>
     *
     *     The result message as string
     */
    public static getRequestEnableService(kwargs?: IShellEnableServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsEnableService,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Disables a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDisableService(kwargs?: IShellDisableServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDisableService,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDeleteService(kwargs?: IShellDeleteServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDeleteService,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the default MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetServiceDefault(kwargs?: IShellSetServiceDefaultKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetServiceDefault,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the url_context_root of a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetServiceContextPath(kwargs?: IShellSetServiceContextPathKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                value: kwargs.value,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetServiceContextPath,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the protocol of a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetServiceProtocol(kwargs?: IShellSetServiceProtocolKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                value: kwargs.value,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetServiceProtocol,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the comments of a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetServiceComments(kwargs?: IShellSetServiceCommentsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                value: kwargs.value,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetServiceComments,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the options of a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetServiceOptions(kwargs?: IShellSetServiceOptionsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                value: kwargs.value,
                service_id: kwargs.serviceId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetServiceOptions,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets all properties of a MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestUpdateService(kwargs?: IShellUpdateServiceKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                url_context_root: kwargs.urlContextRoot,
                url_host_name: kwargs.urlHostName,
                url_protocol: kwargs.urlProtocol,
                enabled: kwargs.enabled,
                comments: kwargs.comments,
                options: kwargs.options,
                auth_path: kwargs.authPath,
                auth_completed_url: kwargs.authCompletedUrl,
                auth_completed_url_validation: kwargs.authCompletedUrlValidation,
                auth_completed_page_content: kwargs.authCompletedPageContent,
                auth_apps: kwargs.authApps,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsUpdateService,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Checks the availability of a given request path for the given service
     *
     * @param kwargs Additional options
     *
     * @returns True or False
     */
    public static getRequestGetServiceRequestPathAvailability(kwargs?: IShellGetServiceRequestPathAvailabilityKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                request_path: kwargs.requestPath,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetServiceRequestPathAvailability,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Add a schema to the given MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The schema_id of the created schema when not in interactive mode
     */
    public static getRequestAddSchema(kwargs?: IShellAddSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                request_path: kwargs.requestPath,
                requires_auth: kwargs.requiresAuth,
                enabled: kwargs.enabled,
                items_per_page: kwargs.itemsPerPage,
                comments: kwargs.comments,
                options: kwargs.options,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsAddSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a specific MRS schema
     *
     * @param kwargs Additional options
     *
     * @returns The schema as dict or None on error in interactive mode
     */
    public static getRequestGetSchema(kwargs?: IShellGetSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                request_path: kwargs.requestPath,
                schema_name: kwargs.schemaName,
                schema_id: kwargs.schemaId,
                service_id: kwargs.serviceId,
                auto_select_single: kwargs.autoSelectSingle,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns all schemas for the given MRS service
     *
     * @param kwargs Additional options
     *
     * @returns Either a string listing the schemas when interactive is set or list     of dicts representing the schemas
     */
    public static getRequestListSchemas(kwargs?: IShellListSchemasKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                include_enable_state: kwargs.includeEnableState,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListSchemas,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a schema of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestEnableSchema(kwargs?: IShellEnableSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsEnableSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Disables a schema of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDisableSchema(kwargs?: IShellDisableSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDisableSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes a schema of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDeleteSchema(kwargs?: IShellDeleteSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDeleteSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the name of a given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetSchemaName(kwargs?: IShellSetSchemaNameKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                value: kwargs.value,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetSchemaName,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the request_path of a given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetSchemaRequestPath(kwargs?: IShellSetSchemaRequestPathKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                value: kwargs.value,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetSchemaRequestPath,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the requires_auth flag of the given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetSchemaRequiresAuth(kwargs?: IShellSetSchemaRequiresAuthKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                value: kwargs.value,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetSchemaRequiresAuth,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the items_per_page of a given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetSchemaItemsPerPage(kwargs?: IShellSetSchemaItemsPerPageKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                value: kwargs.value,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetSchemaItemsPerPage,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the comments of a given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestSetSchemaComments(kwargs?: IShellSetSchemaCommentsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                value: kwargs.value,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetSchemaComments,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Updates the given schema
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestUpdateSchema(kwargs?: IShellUpdateSchemaKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_name: kwargs.schemaName,
                service_id: kwargs.serviceId,
                schema_id: kwargs.schemaId,
                request_path: kwargs.requestPath,
                requires_auth: kwargs.requiresAuth,
                enabled: kwargs.enabled,
                items_per_page: kwargs.itemsPerPage,
                comments: kwargs.comments,
                options: kwargs.options,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsUpdateSchema,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Adds content to the given MRS service
     *
     * @param kwargs Additional options
     *
     * @returns None in interactive mode, a dict with content_set_id and         number_of_files_uploaded
     */
    public static getRequestAddContentSet(kwargs?: IShellAddContentSetKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                content_dir: kwargs.contentDir,
                service_id: kwargs.serviceId,
                request_path: kwargs.requestPath,
                requires_auth: kwargs.requiresAuth,
                comments: kwargs.comments,
                enabled: kwargs.enabled,
                options: kwargs.options,
                replace_existing: kwargs.replaceExisting,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsAddContentSet,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns all content sets for the given MRS service
     *
     * @param serviceId The id of the service to list the schemas from
     * @param kwargs Additional options
     *
     * @returns Either a string listing the content sets when interactive is set or list     of dicts representing the content sets
     */
    public static getRequestListContentSets(serviceId?: number, kwargs?: IShellListContentSetsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                include_enable_state: kwargs.includeEnableState,
                request_path: kwargs.requestPath,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListContentSets,
            {
                args: {
                    service_id: serviceId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a specific MRS content_set
     *
     * @param requestPath The request_path of the content_set
     * @param kwargs Additional options
     *
     * @returns The schema as dict or None on error in interactive mode
     */
    public static getRequestGetContentSet(requestPath?: string, kwargs?: IShellGetContentSetKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                content_set_id: kwargs.contentSetId,
                service_id: kwargs.serviceId,
                auto_select_single: kwargs.autoSelectSingle,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetContentSet,
            {
                args: {
                    request_path: requestPath,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a content set of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestEnableContentSet(kwargs?: IShellEnableContentSetKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                content_set_id: kwargs.contentSetId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsEnableContentSet,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a content_set of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDisableContentSet(kwargs?: IShellDisableContentSetKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                content_set_id: kwargs.contentSetId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDisableContentSet,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a content_set of the given service
     *
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDeleteContentSet(kwargs?: IShellDeleteContentSetKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                service_id: kwargs.serviceId,
                content_set_id: kwargs.contentSetId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDeleteContentSet,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Add a db_object to the given MRS service schema
     *
     * @param kwargs Additional options
     *
     * @returns Not documented
     *
     * <b>Allowed options for parameters:</b>
     *
     *     id (int,optional): The id of the parameter or a negative value when it
     * is a new parameter     db_object_id (int,optional): The id of the
     * corresponding db object     position (int): The position of the parameter;
     * name (str): The name of the parameter;     bind_column_name (str): The
     * column name of the TABLE or VIEW or parameter name the PROCEDURE
     * this parameter maps to     datatype (str): The datatype, 'STRING', 'INT',
     * 'DOUBLE', 'BOOLEAN', 'LONG', 'TIMESTAMP', 'JSON'     mode (str): The
     * parameter mode, "IN", "OUT", "INOUT"     comments (str,optional): The
     * comments for the parameter
     *
     * <b>Returns:</b>
     *
     *     None
     */
    public static getRequestAddDbObject(kwargs?: IShellAddDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_name: kwargs.dbObjectName,
                db_object_type: kwargs.dbObjectType,
                schema_id: kwargs.schemaId,
                schema_name: kwargs.schemaName,
                auto_add_schema: kwargs.autoAddSchema,
                request_path: kwargs.requestPath,
                enabled: kwargs.enabled,
                crud_operations: kwargs.crudOperations,
                crud_operation_format: kwargs.crudOperationFormat,
                requires_auth: kwargs.requiresAuth,
                items_per_page: kwargs.itemsPerPage,
                row_user_ownership_enforced: kwargs.rowUserOwnershipEnforced,
                row_user_ownership_column: kwargs.rowUserOwnershipColumn,
                comments: kwargs.comments,
                media_type: kwargs.mediaType,
                auto_detect_media_type: kwargs.autoDetectMediaType,
                auth_stored_procedure: kwargs.authStoredProcedure,
                options: kwargs.options,
                parameters: kwargs.parameters,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsAddDbObject,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets a specific MRS db_object
     *
     * @param requestPath The request_path of the schema
     * @param dbObjectName The name of the schema
     * @param kwargs Additional options
     *
     * @returns The db_object as dict
     */
    public static getRequestGetDbObject(requestPath?: string, dbObjectName?: string, kwargs?: IShellGetDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                schema_id: kwargs.schemaId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetDbObject,
            {
                args: {
                    request_path: requestPath,
                    db_object_name: dbObjectName,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets the list of possible row ownership fields for the given db_object
     *
     * @param requestPath The request_path of the schema
     * @param dbObjectName The name of the db_object
     * @param kwargs Additional options
     *
     * @returns The list of possible row ownership fields names
     */
    public static getRequestGetDbObjectRowOwnershipFields(requestPath?: string, dbObjectName?: string, kwargs?: IShellGetDbObjectRowOwnershipFieldsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                schema_id: kwargs.schemaId,
                schema_name: kwargs.schemaName,
                db_object_type: kwargs.dbObjectType,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetDbObjectRowOwnershipFields,
            {
                args: {
                    request_path: requestPath,
                    db_object_name: dbObjectName,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets the list of available row ownership fields for the given db_object
     *
     * @param requestPath The request_path of the schema
     * @param dbObjectName The name of the db_object
     * @param kwargs Additional options
     *
     * @returns The list of available db object fields
     */
    public static getRequestGetDbObjectFields(requestPath?: string, dbObjectName?: string, kwargs?: IShellGetDbObjectFieldsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                schema_id: kwargs.schemaId,
                schema_name: kwargs.schemaName,
                db_object_type: kwargs.dbObjectType,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetDbObjectFields,
            {
                args: {
                    request_path: requestPath,
                    db_object_name: dbObjectName,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns all db_objects for the given schema
     *
     * @param kwargs Additional options
     *
     * @returns A list of dicts representing the db_objects of the schema
     */
    public static getRequestListDbObjects(kwargs?: IShellListDbObjectsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                schema_id: kwargs.schemaId,
                include_enable_state: kwargs.includeEnableState,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListDbObjects,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Gets the list of parameters for the given db_object
     *
     * @param requestPath The request_path of the schema
     * @param dbObjectName The name of the db_object
     * @param kwargs Additional options
     *
     * @returns The list of db object parameters
     */
    public static getRequestGetDbObjectParameters(requestPath?: string, dbObjectName?: string, kwargs?: IShellGetDbObjectParametersKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                schema_id: kwargs.schemaId,
                schema_name: kwargs.schemaName,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetDbObjectParameters,
            {
                args: {
                    request_path: requestPath,
                    db_object_name: dbObjectName,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the request_path of the given db_object
     *
     * @param dbObjectId The id of the schema to list the db_objects from
     * @param requestPath The request_path that should be set
     * @param kwargs Additional options
     *
     * @returns None
     */
    public static getRequestSetDbObjectRequestPath(dbObjectId?: number, requestPath?: string, kwargs?: IShellSetDbObjectRequestPathKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetDbObjectRequestPath,
            {
                args: {
                    db_object_id: dbObjectId,
                    request_path: requestPath,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Sets the request_path of the given db_object
     *
     * @param dbObjectId The id of the schema to list the db_objects from
     * @param crudOperations The allowed CRUD operations for the object
     * @param crudOperationFormat The format to use for the CRUD operation
     * @param kwargs Additional options
     *
     * @returns None
     */
    public static getRequestSetDbObjectCrudOperations(dbObjectId?: number, crudOperations?: unknown[], crudOperationFormat?: string, kwargs?: IShellSetDbObjectCrudOperationsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsSetDbObjectCrudOperations,
            {
                args: {
                    db_object_id: dbObjectId,
                    crud_operations: crudOperations,
                    crud_operation_format: crudOperationFormat,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Enables a db_object of the given schema
     *
     * @param dbObjectName The name of the db_object
     * @param schemaId The id of the schema
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestEnableDbObject(dbObjectName?: string, schemaId?: number, kwargs?: IShellEnableDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsEnableDbObject,
            {
                args: {
                    db_object_name: dbObjectName,
                    schema_id: schemaId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Disables a db_object of the given service
     *
     * @param dbObjectName The name of the db_object
     * @param schemaId The id of the schema
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDisableDbObject(dbObjectName?: string, schemaId?: number, kwargs?: IShellDisableDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDisableDbObject,
            {
                args: {
                    db_object_name: dbObjectName,
                    schema_id: schemaId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Deletes a schema of the given service
     *
     * @param dbObjectName The name of the db_object
     * @param schemaId The id of the schema
     * @param kwargs Additional options
     *
     * @returns The result message as string
     */
    public static getRequestDeleteDbObject(dbObjectName?: string, schemaId?: number, kwargs?: IShellDeleteDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsDeleteDbObject,
            {
                args: {
                    db_object_name: dbObjectName,
                    schema_id: schemaId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Update a db_object
     *
     * @param kwargs Additional options
     *
     * @returns None
     */
    public static getRequestUpdateDbObject(kwargs?: IShellUpdateDbObjectKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                db_object_id: kwargs.dbObjectId,
                db_object_name: kwargs.dbObjectName,
                schema_id: kwargs.schemaId,
                request_path: kwargs.requestPath,
                name: kwargs.name,
                enabled: kwargs.enabled,
                crud_operations: kwargs.crudOperations,
                crud_operation_format: kwargs.crudOperationFormat,
                requires_auth: kwargs.requiresAuth,
                items_per_page: kwargs.itemsPerPage,
                auto_detect_media_type: kwargs.autoDetectMediaType,
                row_user_ownership_enforced: kwargs.rowUserOwnershipEnforced,
                row_user_ownership_column: kwargs.rowUserOwnershipColumn,
                comments: kwargs.comments,
                media_type: kwargs.mediaType,
                auth_stored_procedure: kwargs.authStoredProcedure,
                options: kwargs.options,
                parameters: kwargs.parameters,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
                return_python_object: kwargs.returnPythonObject,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsUpdateDbObject,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns all db_objects for the given schema
     *
     * @param kwargs Additional options
     *
     * @returns A list of dicts representing the db_objects of the schema
     */
    public static getRequestListContentFiles(kwargs?: IShellListContentFilesKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                content_set_id: kwargs.contentSetId,
                include_enable_state: kwargs.includeEnableState,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListContentFiles,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Adds an auth_app to the given MRS service
     *
     * @param kwargs Additional options
     *
     * @returns The list of vendor objects
     */
    public static getRequestGetAuthenticationVendors(kwargs?: IShellGetAuthenticationVendorsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                enabled: kwargs.enabled,
                module_session_id: kwargs.moduleSessionId,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsGetAuthenticationVendors,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Adds an auth_app to the given MRS service
     *
     * @param kwargs Additional options
     *
     * @returns None in interactive mode, a dict with content_set_id and         number_of_files_uploaded
     */
    public static getRequestAddAuthenticationApp(kwargs?: IShellAddAuthenticationAppKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                app_name: kwargs.appName,
                service_id: kwargs.serviceId,
                auth_vendor_id: kwargs.authVendorId,
                description: kwargs.description,
                url: kwargs.url,
                url_direct_auth: kwargs.urlDirectAuth,
                access_token: kwargs.accessToken,
                app_id: kwargs.appId,
                limit_to_registered_users: kwargs.limitToRegisteredUsers,
                use_built_in_authorization: kwargs.useBuiltInAuthorization,
                registered_users: kwargs.registeredUsers,
                default_auth_role_id: kwargs.defaultAuthRoleId,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsAddAuthenticationApp,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns all authentication apps for the given MRS service
     *
     * @param serviceId The id of the service to list the schemas from
     * @param kwargs Additional options
     *
     * @returns Either a string listing the content sets when interactive is set or list     of dicts representing the content sets
     */
    public static getRequestListAuthenticationApps(serviceId?: number, kwargs?: IShellListAuthenticationAppsKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                include_enable_state: kwargs.includeEnableState,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsListAuthenticationApps,
            {
                args: {
                    service_id: serviceId,
                },
                kwargs: kwargsToUse,
            });
    }

    /**
     * Returns basic information about this plugin.
     *
     * @returns str
     */
    public static getRequestInfo(): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsInfo,
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

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsVersion,
            {
                args: {},
            });
    }

    /**
     * Lists the schemas that are currently offered via MRS
     *
     * @param path The path to use.
     * @param moduleSessionId The string id for the module session object, holding the database session to be used on the operation.
     *
     * @returns None
     */
    public static getRequestLs(path?: string, moduleSessionId?: string): IShellRequest {

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsLs,
            {
                args: {
                    path,
                    module_session_id: moduleSessionId,
                },
            });
    }

    /**
     * Initializes and configures the MySQL REST Data Service
     *
     * @param kwargs Additional options
     *
     * @returns True on success, None in interactive mode
     */
    public static getRequestConfigure(kwargs?: IShellConfigureKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                enable_mrs: kwargs.enableMrs,
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsConfigure,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    /**
     * Checks the MRS service status and prints its
     *
     * @param kwargs Additional options
     *
     * @returns None
     */
    public static getRequestStatus(kwargs?: IShellStatusKwargs): IShellRequest {

        let kwargsToUse;
        if (kwargs) {
            kwargsToUse = {
                module_session_id: kwargs.moduleSessionId,
                interactive: kwargs.interactive,
                raise_exceptions: kwargs.raiseExceptions,
                return_formatted: kwargs.returnFormatted,
            };
        }

        return Protocol.getRequestCommandExecute(ShellAPIMrs.MrsStatus,
            {
                args: {},
                kwargs: kwargsToUse,
            });
    }

    //  End auto generated content
}
