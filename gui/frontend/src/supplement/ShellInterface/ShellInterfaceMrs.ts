/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { DataCallback, MessageScheduler } from "../../communication/MessageScheduler.js";
import { IShellDictionary } from "../../communication/Protocol.js";
import {
    ShellAPIMrs, IMrsStatusData, IMrsServiceData, IMrsAuthAppData, IMrsAuthVendorData, IMrsSchemaData,
    IShellMrsUpdateDbObjectKwargsValue, IMrsDbObjectData, IMrsAddContentSetData,
    IMrsContentSetData, IMrsContentFileData, IShellMrsUpdateAuthenticationAppKwargsValue, IMrsUserData,
    IShellMrsUpdateUserKwargsValue, IMrsRoleData, IMrsUserRoleData,
    IMrsRouterData, IMrsCurrentServiceMetadata, IMrsTableColumnWithReference, IMrsObjectFieldWithReference,
    IMrsObject, IMrsDbObjectParameterData, IMrsSdkOptions, IMrsAddAuthAppData,
    IMrsRouterService, IMrsScriptDefinitions, IMrsScriptModuleDefinition,
} from "../../communication/ProtocolMrs.js";
import { MrsDbObjectType } from "../../modules/mrs/types.js";
import { webSession } from "../WebSession.js";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public async configure(enableMrs?: boolean, allowRecreationOnMajorUpgrade?: boolean,
        updateIfAvailable?: boolean, options?: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsConfigure,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                    enableMrs,
                    updateIfAvailable,
                    options,
                    allowRecreationOnMajorUpgrade,
                },
            },
        });
    }

    public async status(): Promise<IMrsStatusData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsStatus,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async ignoreVersionUpgrade(): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsIgnoreVersionUpgrade,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async listServices(): Promise<IMrsServiceData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListServices,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async addService(urlContextRoot: string, name: string, urlProtocol: string[], urlHostName: string,
        comments: string, enabled: boolean, options: IShellDictionary | null,
        authPath: string, authCompletedUrl: string,
        authCompletedUrlValidation: string, authCompletedPageContent: string,
        metadata?: IShellDictionary, published = false): Promise<IMrsServiceData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddService,
            parameters: {
                kwargs: {
                    urlContextRoot,
                    urlHostName,
                    enabled,
                    published,
                    moduleSessionId: this.moduleSessionId,
                    urlProtocol,
                    authPath,
                    comments,
                    options,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    metadata,
                    name,
                },
            },
        }, true, ["options"]);

        return response.result;
    }

    public async updateService(serviceId: string, urlContextRoot: string, urlHostName: string,
        value: IShellDictionary): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateService,
            parameters: {
                kwargs: {
                    serviceId,
                    urlContextRoot,
                    urlHostName,
                    value,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        }, true, ["options"]);
    }

    public async deleteService(serviceId: string | null): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteService,
            parameters: {
                kwargs: {
                    serviceId,
                    urlContextRoot: null,
                    urlHostName: null,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async getService(serviceId: string | null, urlContextRoot: string | null, urlHostName: string | null,
        getDefault: boolean | null, autoSelectSingle: boolean | null): Promise<IMrsServiceData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetService,
            parameters: {
                kwargs: {
                    serviceId,
                    urlContextRoot,
                    urlHostName,
                    getDefault,
                    autoSelectSingle,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async setCurrentService(serviceId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsSetCurrentService,
            parameters: {
                kwargs: {
                    serviceId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async getCurrentServiceMetadata(): Promise<IMrsCurrentServiceMetadata> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetCurrentServiceMetadata,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getAuthVendors(): Promise<IMrsAuthVendorData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetAuthenticationVendors,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }


    /**
     * Creates a new authentication app.
     *
     * @param authApp The authentication app data.
     * @param registerUsers The list of users to register.
     * @param serviceId When given adds a link from the new auth app to this service.
     *
     * @returns A promise resolving to the new authentication app data.
     */
    public async addAuthApp(authApp: IMrsAuthAppData, registerUsers: string[], serviceId?: string)
        : Promise<IMrsAddAuthAppData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddAuthenticationApp,
            parameters: {
                args: {
                    serviceId,
                    appName: authApp.name,
                },
                kwargs: {
                    authVendorId: authApp.authVendorId,
                    description: authApp.description,
                    url: authApp.url,
                    urlDirectAuth: authApp.urlDirectAuth,
                    accessToken: authApp.accessToken,
                    appId: authApp.appId,
                    limitToRegisteredUsers: authApp.limitToRegisteredUsers,
                    registeredUsers: registerUsers,
                    defaultRoleId: authApp.defaultRoleId,
                    options: authApp.options,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listAuthApps(serviceId?: string): Promise<IMrsAuthAppData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListAuthenticationApps,
            parameters: {
                args: {
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getAuthApp(appId: string): Promise<IMrsAuthAppData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetAuthenticationApp,
            parameters: {
                args: {
                    appId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async linkAuthAppToService(appId: string, serviceId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddAuthenticationAppLink,
            parameters: {
                args: {
                    appId,
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async unlinkAuthAppFromService(appId: string, serviceId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteAuthenticationAppLink,
            parameters: {
                args: {
                    appId,
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async deleteAuthApp(appId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteAuthenticationApp,
            parameters: {
                kwargs: {
                    appId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async updateAuthApp(appId: string,
        value: IShellMrsUpdateAuthenticationAppKwargsValue): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateAuthenticationApp,
            parameters: {
                kwargs: {
                    appId,
                    value,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async listAppServices(appId?: string): Promise<IMrsServiceData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListAuthenticationAppServices,
            parameters: {
                args: {
                    appId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listUsers(serviceId?: string, authAppId?: string): Promise<IMrsUserData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListUsers,
            parameters: {
                kwargs: {
                    serviceId,
                    authAppId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async deleteUser(userId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteUser,
            parameters: {
                args: {
                    userId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async addUser(authAppId: string, name: string, email: string, vendorUserId: string,
        loginPermitted: boolean, mappedUserId: string, appOptions: IShellDictionary | null,
        authString: string, userRoles: IMrsUserRoleData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddUser,
            parameters: {
                kwargs: {
                    authAppId,
                    name,
                    email,
                    vendorUserId,
                    loginPermitted,
                    mappedUserId,
                    appOptions,
                    authString,
                    userRoles,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async updateUser(userId: string, value: IShellMrsUpdateUserKwargsValue,
        userRoles: IMrsUserRoleData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateUser,
            parameters: {
                kwargs: {
                    userId,
                    value,
                    userRoles,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async listSchemas(serviceId?: string): Promise<IMrsSchemaData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListSchemas,
            parameters: {
                args: {
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getSchema(schemaId?: string, serviceId?: string, requestPath?: string,
        schemaName?: string, autoSelectSingle?: boolean): Promise<IMrsSchemaData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSchema,
            parameters: {
                kwargs: {
                    schemaId: schemaId ?? null,
                    serviceId: serviceId ?? null,
                    requestPath: requestPath ?? null,
                    schemaName: schemaName ?? null,
                    autoSelectSingle: autoSelectSingle ?? null,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async deleteSchema(schemaId: string, serviceId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteSchema,
            parameters: {
                kwargs: {
                    schemaId,
                    serviceId,
                    schemaName: null,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async addSchema(serviceId: string, schemaName: string, enabled: number, requestPath: string,
        requiresAuth: boolean, options: IShellDictionary | null,
        itemsPerPage: number | null, comments?: string, metadata?: IShellDictionary): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddSchema,
            parameters: {
                kwargs: {
                    serviceId,
                    schemaName,
                    requestPath,
                    requiresAuth,
                    enabled,
                    itemsPerPage,
                    comments,
                    options,
                    metadata,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async updateSchema(schemaId: string, serviceId: string, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: number, itemsPerPage: number | null, comments: string,
        options: IShellDictionary | null, metadata?: IShellDictionary): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateSchema,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    schemaId,
                    value: {
                        serviceId,
                        schemaName,
                        requestPath,
                        requiresAuth,
                        enabled,
                        itemsPerPage,
                        comments,
                        options,
                        metadata,
                    },
                },
            },
        });
    }

    public async addDbObject(dbObjectName: string, dbObjectType: MrsDbObjectType,
        autoAddSchema: boolean, requestPath: string, enabled: number,
        crudOperationFormat: string, requiresAuth: boolean,
        autoDetectMediaType: boolean,
        options: IShellDictionary | null,
        itemsPerPage: number | null,
        schemaId?: string, schemaName?: string,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string,
        metadata?: IShellDictionary | null,
        objects?: IMrsObject[]): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddDbObject,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectName,
                    dbObjectType,
                    schemaId,
                    schemaName,
                    autoAddSchema,
                    requestPath,
                    enabled,
                    crudOperationFormat,
                    requiresAuth,
                    itemsPerPage: itemsPerPage === null ? undefined : itemsPerPage,
                    comments,
                    mediaType,
                    autoDetectMediaType,
                    authStoredProcedure,
                    options,
                    metadata: metadata === null ? undefined : metadata,
                    objects,
                },
            },
        });

        return response.result;
    }

    public async updateDbObject(dbObjectId: string, dbObjectName: string, requestPath: string,
        schemaId: string, value: IShellMrsUpdateDbObjectKwargsValue): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateDbObject,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    schemaId,
                    dbObjectName,
                    requestPath,
                    value,
                },
            },
        });
    }

    public async listDbObjects(schemaId: string): Promise<IMrsDbObjectData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListDbObjects,
            parameters: {
                kwargs: {
                    schemaId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async deleteDbObject(dbObjectId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteDbObject,
            parameters: {
                args: {},
                kwargs: {
                    dbObjectId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async addContentSet(contentDir: string, requestPath: string,
        requiresAuth: boolean, options: IShellDictionary | null,
        serviceId?: string, comments?: string,
        enabled?: number, replaceExisting?: boolean,
        ignoreList?: string,
        callback?: DataCallback<ShellAPIMrs.MrsAddContentSet>): Promise<IMrsAddContentSetData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddContentSet,
            parameters: {
                args: {
                    serviceId,
                    contentDir,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    requestPath,
                    requiresAuth,
                    comments,
                    options,
                    enabled,
                    replaceExisting,
                    ignoreList,
                },
            },
            onData: callback,
        });

        return response.result;
    }

    public async getServiceRequestPathAvailability(serviceId: string, requestPath: string): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetServiceRequestPathAvailability,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                    requestPath,
                },
            },
        });

        return response.result;
    }

    public async getContentSetCount(serviceId: string): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetContentSetCount,
            parameters: {
                args: {
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listContentSets(serviceId: string, requestPath?: string): Promise<IMrsContentSetData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListContentSets,
            parameters: {
                args: {
                    serviceId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    requestPath,
                },
            },
        });

        return response.result;
    }

    public async listContentFiles(contentSetId: string, includeEnableState?: boolean): Promise<IMrsContentFileData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListContentFiles,
            parameters: {
                args: {
                    contentSetId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    includeEnableState,
                },
            },
        });

        return response.result;
    }

    public async deleteContentSet(contentSetId: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteContentSet,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    contentSetId,
                },
            },
        });
    }

    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }

    public async dumpSchema(path: string, serviceId?: string | undefined, serviceName?: string | undefined,
        schemaId?: string | undefined, schemaName?: string | undefined): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpSchema,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                    serviceName,
                    schemaId,
                    schemaName,
                },
            },
        });
    }

    public async dumpObject(path: string, serviceId?: string | undefined, serviceName?: string | undefined,
        schemaId?: string | undefined, schemaName?: string | undefined, objectId?: string | undefined,
        objectName?: string | undefined): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpObject,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                    serviceName,
                    schemaId,
                    schemaName,
                    objectId,
                    objectName,
                },
            },
        });
    }

    public async loadSchema(path: string, serviceId?: string | undefined,
        serviceName?: string | undefined): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsLoadSchema,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                    serviceName,
                },
            },
        });
    }

    public async loadObject(path: string, serviceId?: string | undefined, serviceName?: string | undefined,
        schemaId?: string | undefined, schemaName?: string | undefined): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsLoadObject,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                    serviceName,
                    schemaId,
                    schemaName,
                },
            },
        });
    }

    public async listRoles(serviceId?: string): Promise<IMrsRoleData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListRoles,
            parameters: {
                args: {
                    serviceId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listUserRoles(userId: string): Promise<IMrsUserRoleData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListUserRoles,
            parameters: {
                args: {
                    userId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listRouterIds(seenWithin?: number): Promise<number[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListRouterIds,
            parameters: {
                args: {
                    seenWithin,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listRouters(activeWhenSeenWithin?: number): Promise<IMrsRouterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListRouters,
            parameters: {
                args: {
                    activeWhenSeenWithin,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async deleteRouter(routerId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteRouter,
            parameters: {
                args: {
                    routerId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async getRouterServices(routerId?: number): Promise<IMrsRouterService[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetRouterServices,
            parameters: {
                args: {
                    routerId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getSdkBaseClasses(
        sdkLanguage?: string, prepareForRuntime?: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSdkBaseClasses,
            parameters: {
                kwargs: {
                    sdkLanguage,
                    prepareForRuntime,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getSdkServiceClasses(
        serviceId?: string, sdkLanguage?: string, prepareForRuntime?: boolean, serviceUrl?: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSdkServiceClasses,
            parameters: {
                kwargs: {
                    serviceId,
                    serviceUrl,
                    sdkLanguage,
                    prepareForRuntime,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getRuntimeManagementCode(): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetRuntimeManagementCode,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpSdkServiceFiles(directory?: string, options?: IMrsSdkOptions): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpSdkServiceFiles,
            parameters: {
                kwargs: {
                    directory,
                    options: (options as unknown) as IShellDictionary,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getSdkOptions(directory: string): Promise<IMrsSdkOptions | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSdkOptions,
            parameters: {
                args: {
                    directory,
                },
            },
        });

        return response.result;
    }


    public async getTableColumnsWithReferences(requestPath?: string, dbObjectName?: string,
        dbObjectId?: string, schemaId?: string, schemaName?: string,
        dbObjectType?: string): Promise<IMrsTableColumnWithReference[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetTableColumnsWithReferences,
            parameters: {
                args: {
                    dbObjectId,
                    schemaId,
                    requestPath,
                    dbObjectName,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    schemaName,
                    dbObjectType,
                },
            },
        });

        return response.result;
    }

    public async getDbObjectParameters(dbObjectName?: string,
        dbSchemaName?: string, dbObjectId?: string, dbType?: string): Promise<IMrsDbObjectParameterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectParameters,
            parameters: {
                args: {
                },
                kwargs: {
                    dbObjectId,
                    dbSchemaName,
                    dbObjectName,
                    dbType,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getDbFunctionReturnType(dbObjectName: string,
        dbSchemaName: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbFunctionReturnType,
            parameters: {
                args: {
                    dbSchemaName,
                    dbObjectName,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getDbObject(dbObjectId?: string,
        schemaId?: string, schemaName?: string, absoluteRequestPath?: string): Promise<IMrsDbObjectData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObject,
            parameters: {
                args: {
                },
                kwargs: {
                    dbObjectId,
                    schemaId,
                    schemaName,
                    absoluteRequestPath,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getObjects(dbObjectId?: string): Promise<IMrsObject[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetObjects,
            parameters: {
                args: {
                    dbObjectId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getObjectFieldsWithReferences(objectId?: string): Promise<IMrsObjectFieldWithReference[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetObjectFieldsWithReferences,
            parameters: {
                args: {
                    objectId,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getServiceCreateStatement(serviceId: string, includeAllObjects: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetServiceCreateStatement,
            parameters: {
                kwargs: {
                    serviceId,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getSchemaCreateStatement(schemaId: string, includeAllObjects: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSchemaCreateStatement,
            parameters: {
                kwargs: {
                    schemaId,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getAuthAppCreateStatement(authAppId: string, serviceId: string,
        includeAllObjects: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetAuthAppCreateStatement,
            parameters: {
                kwargs: {
                    authAppId,
                    serviceId,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getUserCreateStatement(userId: string, includeAllObjects: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetUserCreateStatement,
            parameters: {
                kwargs: {
                    userId,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getDbObjectCreateStatement(dbObjectId: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectCreateStatement,
            parameters: {
                kwargs: {
                    dbObjectId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }


    public async getContentSetCreateStatement(contentSetId: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetContentSetCreateStatement,
            parameters: {
                kwargs: {
                    contentSetId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }


    public async getContentFileCreateStatement(contentFileId: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetContentFileCreateStatement,
            parameters: {
                kwargs: {
                    contentFileId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpServiceCreateStatement(serviceId: string, filePath: string, overwrite: boolean,
        includeAllObjects: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpServiceCreateStatement,
            parameters: {
                kwargs: {
                    serviceId,
                    includeAllObjects,
                    filePath,
                    overwrite,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpSchemaCreateStatement(schemaId: string, filePath: string, overwrite: boolean
        , includeAllObjects: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpSchemaCreateStatement,
            parameters: {
                kwargs: {
                    schemaId,
                    filePath,
                    overwrite,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpDbObjectCreateStatement(dbObjectId: string,
        filePath: string, overwrite: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpDbObjectCreateStatement,
            parameters: {
                kwargs: {
                    dbObjectId,
                    filePath,
                    overwrite,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpAuthAppCreateStatement(authAppId: string, serviceId: string,
        filePath: string, overwrite: boolean, includeAllObjects: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpAuthAppCreateStatement,
            parameters: {
                kwargs: {
                    authAppId,
                    serviceId,
                    filePath,
                    overwrite,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpUserCreateStatement(userId: string,
        filePath: string, overwrite: boolean, includeAllObjects: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpUserCreateStatement,
            parameters: {
                kwargs: {
                    userId,
                    filePath,
                    overwrite,
                    includeAllObjects,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpContentSetCreateStatement(contentSetId: string,
        filePath: string, overwrite: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpContentSetCreateStatement,
            parameters: {
                kwargs: {
                    contentSetId,
                    filePath,
                    overwrite,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpContentFileCreateStatement(contentFileId: string,
        filePath: string, overwrite: boolean): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpContentFileCreateStatement,
            parameters: {
                kwargs: {
                    contentFileId,
                    filePath,
                    overwrite,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getFileMrsScriptDefinitions(path: string, language?: string): Promise<IMrsScriptModuleDefinition[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetFileMrsScriptDefinitions,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    language,
                },
            },
        });

        return response.result;
    }

    public async getFolderMrsScriptLanguage(path: string, ignoreList?: string): Promise<string | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetFolderMrsScriptLanguage,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    ignoreList,
                },
            },
        });

        return response.result;
    }

    public async getFolderMrsScriptDefinitions(path: string, language: string, ignoreList?: string,
        callback?: DataCallback<ShellAPIMrs.MrsGetFolderMrsScriptDefinitions>,
    ): Promise<IMrsScriptDefinitions | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetFolderMrsScriptDefinitions,
            parameters: {
                args: {
                    path,
                },
                kwargs: {
                    language,
                    ignoreList,
                },
            },
            onData: callback,
        });

        return response.result;
    }
}
