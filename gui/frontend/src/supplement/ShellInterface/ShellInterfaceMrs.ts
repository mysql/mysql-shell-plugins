/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { MessageScheduler, ShellAPIMrs } from "../../communication";
import { webSession } from "../WebSession";
import {
    IMrsAddContentSetData, IMrsAuthAppData, IMrsAuthVendorData, IMrsContentFileData, IMrsContentSetData,
    IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsStatusData,
} from "../../communication/ShellResponseTypes";
import { IMrsDbObjectParameterData } from "../../communication/ShellParameterTypes";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public async configure(enableMrs?: boolean, interactive?: boolean): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsConfigure,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    interactive,
                    enableMrs,
                },
            },
        });
    }

    public async status(): Promise<IMrsStatusData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsStatus,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async listServices(interactive?: boolean, raiseExceptions?: boolean,
        returnFormatted?: boolean): Promise<IMrsServiceData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListServices,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    interactive,
                    raiseExceptions,
                    returnFormatted,
                },
            },
        });

        const result: IMrsServiceData[] = [];
        response.forEach((list) => {
            result.push(...list.result);
        });

        return result;
    }

    public async addService(urlContextRoot: string, urlProtocol: string[], urlHostName: string, isDefault?: boolean,
        comments?: string, enabled?: boolean, options?: string,
        authPath?: string, authCompletedUrl?: string,
        authCompletedUrlValidation?: string, authCompletedPageContent?: string,
        authApps?: IMrsAuthAppData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddService,
            parameters: {
                args: {
                    urlContextRoot,
                    urlHostName,
                    enabled,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    urlProtocol,
                    isDefault,
                    authPath,
                    comments,
                    options,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    authApps: JSON.stringify(authApps),
                },
            },
        });
    }

    public async updateService(serviceId: number, urlContextRoot: string, urlHostName: string,
        urlProtocol: string[], enabled: boolean, comments: string, options: string,
        authPath: string, authCompletedUrl: string, authCompletedUrlValidation: string,
        authCompletedPageContent: string,
        authApps: IMrsAuthAppData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateService,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    urlContextRoot,
                    urlHostName,
                    enabled,
                    serviceId,
                    urlProtocol,
                    comments,
                    options,
                    authPath,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    authApps: JSON.stringify(authApps),
                },
            },
        });
    }

    public async deleteService(serviceId?: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteService,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                },
            },
        });
    }

    public async setDefaultService(serviceId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsSetServiceDefault,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                },
            },
        });
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

    public async getAuthApps(serviceId: number): Promise<IMrsAuthAppData[]> {
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

    public async listSchemas(serviceId: number): Promise<IMrsSchemaData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListSchemas,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    serviceId,
                },
            },
        });

        const result: IMrsSchemaData[] = [];
        response.forEach((list) => {
            result.push(...list.result);
        });

        return result;
    }

    public async deleteSchema(schemaId: number, serviceId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsDeleteSchema,
            parameters: {
                kwargs: {
                    schemaId,
                    serviceId,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });
    }

    public async addSchema(schemaName: string, requestPath: string, requiresAuth: boolean, serviceId?: number,
        itemsPerPage?: number, comments?: string, options?: string): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddSchema,
            parameters: {
                kwargs: {
                    schemaName,
                    requestPath,
                    requiresAuth,
                    serviceId,
                    itemsPerPage,
                    comments,
                    options,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    public async updateSchema(schemaId: number, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: boolean, itemsPerPage: number, comments: string,
        options: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateSchema,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    schemaId,
                    schemaName,
                    requestPath,
                    requiresAuth,
                    enabled,
                    itemsPerPage,
                    comments,
                    options,
                },
            },
        });
    }

    public async addDbObject(dbObjectName: string, dbObjectType: string,
        autoAddSchema: boolean, requestPath: string, enabled: boolean, crudOperations: string[],
        crudOperationFormat: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean,
        rowUserOwnershipColumn?: string,
        schemaId?: number, schemaName?: string, itemsPerPage?: number,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string, options?: string,
        parameters?: IMrsDbObjectParameterData[]): Promise<number> {
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
                    itemsPerPage,
                    rowUserOwnershipEnforced,
                    rowUserOwnershipColumn,
                    comments,
                    mediaType,
                    autoDetectMediaType,
                    authStoredProcedure,
                    options,
                    parameters: JSON.stringify(parameters),
                },
            },
        });

        return response.result;
    }

    public async updateDbObject(dbObjectId: number, dbObjectName: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean, name: string, requestPath: string,
        enabled: boolean, rowUserOwnershipColumn: string, schemaId: number, itemsPerPage: number, comments: string,
        mediaType: string, authStoredProcedure: string, crudOperations: string[], crudOperationFormat: string,
        options: string, parameters: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateDbObject,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    dbObjectName,
                    requiresAuth,
                    rowUserOwnershipEnforced,
                    autoDetectMediaType,
                    name, requestPath, enabled,
                    rowUserOwnershipColumn,
                    schemaId, itemsPerPage, comments,
                    mediaType, authStoredProcedure,
                    crudOperations,
                    crudOperationFormat,
                    options,
                    parameters,
                },
            },
        });
    }

    public async listDbObjects(schemaId: number): Promise<IMrsDbObjectData[]> {
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

    public async getDbObjectRowOwnershipFields(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectRowOwnershipFields,
            parameters: {
                args: {
                    requestPath,
                    dbObjectName,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    schemaId,
                    schemaName,
                    dbObjectType,
                    interactive,
                },
            },
        });

        return response.result;
    }

    public async getDbObjectParameters(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string,
        interactive?: boolean): Promise<IMrsDbObjectParameterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectParameters,
            parameters: {
                args: {
                    requestPath,
                    dbObjectName,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    schemaId,
                    schemaName,
                    interactive,
                },
            },
        });

        return response.result;
    }

    public async getDbObjectFields(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): Promise<IMrsDbObjectParameterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectFields,
            parameters: {
                args: {
                    requestPath,
                    dbObjectName,
                },
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    schemaId,
                    schemaName,
                    dbObjectType,
                    interactive,
                },
            },
        });

        return response.result;
    }

    public async deleteDbObject(dbObjectId?: number): Promise<void> {
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
        requiresAuth: boolean, serviceId?: number, comments?: string,
        options?: string, enabled?: boolean, replaceExisting?: boolean,
        progress?: (message: string) => void): Promise<IMrsAddContentSetData> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddContentSet,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    contentDir,
                    requestPath,
                    requiresAuth,
                    serviceId,
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

    public async getServiceRequestPathAvailability(serviceId: number, requestPath: string): Promise<boolean> {
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

    public async listContentSets(serviceId: number, requestPath?: string): Promise<IMrsContentSetData[]> {
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

    public async listContentFiles(contentSetId: number, includeEnableState?: boolean): Promise<IMrsContentFileData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsListContentFiles,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    contentSetId,
                    includeEnableState,
                },
            },
        });

        return response.result;
    }

    public async deleteContentSet(contentSetId: number): Promise<void> {
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
}
