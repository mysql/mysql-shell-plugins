/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { MessageScheduler } from "../../communication/MessageScheduler";
import { IShellDictionary } from "../../communication/Protocol";
import {
    ShellAPIMrs, IMrsStatusData, IMrsServiceData, IMrsAuthAppData, IMrsAuthVendorData, IMrsSchemaData,
    IShellMrsUpdateDbObjectKwargsValue, IMrsDbObjectData, IMrsAddContentSetData,
    IMrsContentSetData, IMrsContentFileData, IShellMrsUpdateAuthenticationAppKwargsValue, IMrsUserData,
    IShellMrsUpdateUserKwargsValue, IMrsRoleData, IMrsUserRoleData,
    IMrsRouterData, IMrsCurrentServiceMetadata, IMrsTableColumnWithReference, IMrsObjectFieldWithReference,
    IMrsObject, IMrsDbObjectParameterData,
} from "../../communication/ProtocolMrs";
import { webSession } from "../WebSession";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public async configure(enableMrs?: boolean, allowRecreationOnMajorUpgrade?: boolean): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsConfigure,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                    enableMrs,
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

    public async addService(urlContextRoot: string, urlProtocol: string[], urlHostName: string,
        comments: string, enabled: boolean, options: IShellDictionary | null,
        authPath: string, authCompletedUrl: string,
        authCompletedUrlValidation: string, authCompletedPageContent: string,
        authApps: IMrsAuthAppData[]): Promise<IMrsServiceData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddService,
            parameters: {
                kwargs: {
                    urlContextRoot,
                    urlHostName,
                    enabled,
                    moduleSessionId: this.moduleSessionId,
                    urlProtocol,
                    authPath,
                    comments,
                    options,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    authApps,
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


    public async addAuthApp(serviceId: string, authApp: IMrsAuthAppData, registerUsers: []): Promise<IMrsAuthAppData> {
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
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async getAuthApps(serviceId: string): Promise<IMrsAuthAppData[]> {
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

    public async addSchema(serviceId: string, schemaName: string, requestPath: string, requiresAuth: boolean,
        options: IShellDictionary | null,
        itemsPerPage: number | null, comments?: string): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddSchema,
            parameters: {
                kwargs: {
                    serviceId,
                    schemaName,
                    requestPath,
                    requiresAuth,
                    enabled: true,
                    itemsPerPage,
                    comments,
                    options,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async updateSchema(schemaId: string, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: boolean, itemsPerPage: number | null, comments: string,
        options: IShellDictionary | null): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateSchema,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    schemaId,
                    schemaName,
                    value: {
                        requestPath,
                        requiresAuth,
                        enabled,
                        itemsPerPage,
                        comments,
                        options,
                    },
                },
            },
        });
    }

    public async addDbObject(dbObjectName: string, dbObjectType: string,
        autoAddSchema: boolean, requestPath: string, enabled: boolean, crudOperations: string[],
        crudOperationFormat: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean,
        options: IShellDictionary | null,
        itemsPerPage: number | null,
        rowUserOwnershipColumn?: string,
        schemaId?: string, schemaName?: string,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string,
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
                    crudOperations,
                    crudOperationFormat,
                    requiresAuth,
                    itemsPerPage: itemsPerPage === null ? undefined : itemsPerPage,
                    rowUserOwnershipEnforced,
                    rowUserOwnershipColumn,
                    comments,
                    mediaType,
                    autoDetectMediaType,
                    authStoredProcedure,
                    options,
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
        enabled?: boolean, replaceExisting?: boolean,
        progress?: (message: string) => void): Promise<IMrsAddContentSetData> {
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
                },
            },
            onData: (data) => {
                if (progress && data.result.info) {
                    progress(data.result.info);
                }
            },
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
        serviceId?: string, sdkLanguage?: string, prepareForRuntime?: boolean): Promise<string> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetSdkServiceClasses,
            parameters: {
                kwargs: {
                    serviceId,
                    sdkLanguage,
                    prepareForRuntime,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async dumpSdkServiceFiles(serviceId: string, sdkLanguage: string, directory: string): Promise<boolean> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDumpSdkServiceFiles,
            parameters: {
                kwargs: {
                    serviceId,
                    sdkLanguage,
                    directory,
                    moduleSessionId: this.moduleSessionId,
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
        dbSchemaName?: string, dbObjectId?: string): Promise<IMrsDbObjectParameterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectParameters,
            parameters: {
                args: {
                },
                kwargs: {
                    dbObjectId,
                    dbSchemaName,
                    dbObjectName,
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
}
