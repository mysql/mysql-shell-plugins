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

import { MessageScheduler, ShellAPIMrs, IShellDictionary } from "../../communication";
import {
    IMrsAddContentSetData, IMrsAuthAppData, IMrsAuthVendorData, IMrsContentFileData, IMrsContentSetData,
    IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsStatusData, IMrsDbObjectParameterData,
} from "../../communication/";
import { webSession } from "../WebSession";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public async configure(enableMrs?: boolean): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsConfigure,
            parameters: {
                args: {
                    moduleSessionId: this.moduleSessionId,
                    enableMrs,
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

    public async addService(urlContextRoot: string, urlProtocol: string[], urlHostName: string, isDefault: boolean,
        comments: string, enabled: boolean, options: IShellDictionary,
        authPath: string, authCompletedUrl: string,
        authCompletedUrlValidation: string, authCompletedPageContent: string,
        authApps: IMrsAuthAppData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddService,
            parameters: {
                kwargs: {
                    urlContextRoot,
                    urlHostName,
                    enabled,
                    moduleSessionId: this.moduleSessionId,
                    urlProtocol,
                    isDefault,
                    authPath,
                    comments,
                    options,
                    authCompletedUrl,
                    authCompletedUrlValidation,
                    authCompletedPageContent,
                    authApps,
                },
            },
        });
    }

    public async updateService(serviceId: number, urlContextRoot: string, urlHostName: string,
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
        });
    }

    public async deleteService(serviceId: number | null): Promise<void> {
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

    public async setDefaultService(serviceId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsSetServiceDefault,
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

    public async deleteSchema(schemaId: number, serviceId: number): Promise<void> {
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

    public async addSchema(serviceId: number, schemaName: string, requestPath: string, requiresAuth: boolean,
        itemsPerPage?: number, comments?: string,
        options?: IShellDictionary): Promise<number> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsAddSchema,
            parameters: {
                args: {
                    serviceId,
                },
                kwargs: {
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

    public async updateSchema(schemaId: number, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: boolean, itemsPerPage: number, comments: string,
        options: IShellDictionary): Promise<void> {
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
        rowUserOwnershipColumn?: string,
        schemaId?: number, schemaName?: string, itemsPerPage?: number,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string, options?: IShellDictionary,
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
                    parameters,
                },
            },
        });

        return response.result;
    }

    public async updateDbObject(dbObjectId: number, dbObjectName: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean, name: string, requestPath: string,
        enabled: boolean, rowUserOwnershipColumn: string, schemaId: number, itemsPerPage: number, comments: string,
        mediaType: string, authStoredProcedure: string, crudOperations: string[], crudOperationFormat: string,
        options: IShellDictionary, parameters: IMrsDbObjectParameterData[]): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsUpdateDbObject,
            parameters: {
                kwargs: {
                    moduleSessionId: this.moduleSessionId,
                    dbObjectId,
                    schemaId,
                    dbObjectName,
                    requestPath,
                    value: {
                        requiresAuth,
                        rowUserOwnershipEnforced,
                        autoDetectMediaType,
                        name, enabled,
                        rowUserOwnershipColumn,
                        itemsPerPage, comments,
                        mediaType, authStoredProcedure,
                        crudOperations,
                        crudOperationFormat,
                        options,
                        parameters,
                    },
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
        dbObjectId?: number, schemaId?: number, schemaName?: string,
        dbObjectType?: string): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectRowOwnershipFields,
            parameters: {
                kwargs: {
                    dbObjectId,
                    requestPath,
                    dbObjectName,
                    moduleSessionId: this.moduleSessionId,
                    schemaId,
                    schemaName,
                    dbObjectType,
                },
            },
        });

        return response.result;
    }

    public async getDbObjectParameters(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string,
    ): Promise<IMrsDbObjectParameterData[]> {
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
                },
            },
        });

        return response.result;
    }

    public async getDbObjectFields(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string,
        dbObjectType?: string): Promise<IMrsDbObjectParameterData[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIMrs.MrsGetDbObjectFields,
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

    public async deleteDbObject(dbObjectId: number): Promise<void> {
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
        options?: IShellDictionary, enabled?: boolean, replaceExisting?: boolean,
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
