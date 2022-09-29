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

import { EventType, ListenerEntry } from "../Dispatch";
import {
    ICommErrorEvent, ICommMrsAddContentSetEvent, ICommMrsAddDbObjectEvent, ICommMrsAddSchemaEvent,
    ICommMrsAuthAppsEvent,
    ICommMrsAuthVendorsEvent,
    ICommMrsContentFileEvent,
    ICommMrsContentSetEvent,
    ICommMrsGetDbObjectFieldsEvent,
    ICommMrsGetDbObjectRowOwnershipFieldsEvent,
    ICommMrsSchemaEvent, ICommMrsServiceEvent,
    ICommMrsServiceRequestPathAvailabilityEvent,
    ICommMrsStatusEvent,
    ICommSimpleResultEvent,
    IMrsAddContentSetResultData,
    IMrsAddDbObjectResultData, IMrsAddSchemaResultData, IMrsAuthAppData, IMrsAuthAppsResultData,
    IMrsAuthVendorResultData,
    IMrsContentFileResultData, IMrsContentSetResultData,
    IMrsDbObjectFieldsResultData,
    IMrsDbObjectParameterData,
    IMrsGetDbObjectRowOwnershipFieldsResultData,
    IMrsSchemaResultData, IMrsServiceRequestPathAvailabilityResultData, IMrsServiceResultData,
    IMrsStatusResultData,
    MessageScheduler, ProtocolMrs,
} from "../../communication";
import { webSession } from "../WebSession";

export class ShellInterfaceMrs {

    // The key under which the module session is stored in the WebSession instance.
    public moduleSessionLookupId = "";

    public configure(enableMrs?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestConfigure({ moduleSessionId: this.moduleSessionId, enableMrs });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsConfigure" });
    }

    public configureWithPromise(enableMrs?: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this.configure(enableMrs).then((event: ICommSimpleResultEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve();

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public status(): ListenerEntry {
        const request = ProtocolMrs.getRequestStatus({ moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsStatus" });
    }

    public statusWithPromise(): Promise<IMrsStatusResultData> {
        return new Promise((resolve, reject) => {
            this.status().then((event: ICommMrsStatusEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public listServices(): ListenerEntry {
        const request = ProtocolMrs.getRequestListServices({ moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListServices" });
    }

    public listServicesWithPromise(): Promise<IMrsServiceResultData> {
        return new Promise((resolve, reject) => {
            this.listServices().then((event: ICommMrsServiceEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public addService(urlContextRoot: string, urlProtocol: string[], urlHostName: string, isDefault?: boolean,
        comments?: string, enabled?: boolean, options?: string,
        authPath?: string, authCompletedUrl?: string,
        authCompletedUrlValidation?: string, authCompletedPageContent?: string,
        authApps?: IMrsAuthAppData[]): ListenerEntry {
        const request = ProtocolMrs.getRequestAddService(urlContextRoot, urlHostName, enabled, {
            moduleSessionId: this.moduleSessionId,
            urlProtocol,
            isDefault,
            comments,
            options,
            authPath, authCompletedUrl, authCompletedUrlValidation, authCompletedPageContent,
            authApps: JSON.stringify(authApps),
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddService" });
    }

    public addServiceWithPromise(
        urlContextRoot: string, urlProtocol: string[], urlHostName: string, isDefault?: boolean,
        comments?: string, enabled?: boolean, options?: string,
        authPath?: string, authCompletedUrl?: string,
        authCompletedUrlValidation?: string, authCompletedPageContent?: string,
        authApps?: IMrsAuthAppData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.addService(urlContextRoot, urlProtocol, urlHostName, isDefault,
                comments, enabled, options,
                authPath, authCompletedUrl,
                authCompletedUrlValidation, authCompletedPageContent,
                authApps)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public updateService(serviceId: number, urlContextRoot: string, urlHostName: string,
        urlProtocol: string[], enabled: boolean, comments: string, options: string,
        authPath: string, authCompletedUrl: string, authCompletedUrlValidation: string,
        authCompletedPageContent: string,
        authApps: IMrsAuthAppData[]): ListenerEntry {
        const request = ProtocolMrs.getRequestUpdateService({
            moduleSessionId: this.moduleSessionId,
            serviceId,
            urlContextRoot,
            urlHostName,
            urlProtocol,
            enabled,
            comments,
            options,
            authPath,
            authCompletedUrl,
            authCompletedUrlValidation,
            authCompletedPageContent,
            authApps: JSON.stringify(authApps),
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsUpdateService" });
    }

    public updateServiceWithPromise(serviceId: number, urlContextRoot: string, urlHostName: string,
        urlProtocol: string[], enabled: boolean, comments: string, options: string,
        authPath: string, authCompletedUrl: string, authCompletedUrlValidation: string,
        authCompletedPageContent: string,
        authApps: IMrsAuthAppData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.updateService(serviceId, urlContextRoot, urlHostName,
                urlProtocol, enabled, comments, options,
                authPath, authCompletedUrl, authCompletedUrlValidation,
                authCompletedPageContent, authApps)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public deleteService(serviceId?: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteService({ moduleSessionId: this.moduleSessionId, serviceId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteService" });
    }

    public deleteServiceWithPromise(serviceId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleteService(serviceId)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public setDefaultService(serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestSetServiceDefault({
            moduleSessionId: this.moduleSessionId,
            serviceId,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsSetDefaultService" });
    }

    public getAuthVendors(): ListenerEntry {
        const request = ProtocolMrs.getRequestGetAuthenticationVendors({ moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsGetAuthVendors" });
    }

    public getAuthVendorsWithPromise(): Promise<IMrsAuthVendorResultData> {
        return new Promise((resolve, reject) => {
            this.getAuthVendors().then((event: ICommMrsAuthVendorsEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public getAuthApps(serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestListAuthenticationApps(serviceId,
            { moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListAuthenticationApps" });
    }

    public getAuthAppsWithPromise(serviceId: number): Promise<IMrsAuthAppsResultData> {
        return new Promise((resolve, reject) => {
            this.getAuthApps(serviceId).then((event: ICommMrsAuthAppsEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public listSchemas(serviceId?: number): ListenerEntry {
        const request = ProtocolMrs.getRequestListSchemas({ serviceId, moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListSchemas" });
    }

    public listSchemasWithPromise(serviceId?: number): Promise<IMrsSchemaResultData> {
        return new Promise((resolve, reject) => {
            this.listSchemas(serviceId).then((event: ICommMrsSchemaEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public deleteSchema(schemaId: number, serviceId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteSchema({
            moduleSessionId: this.moduleSessionId,
            schemaId,
            serviceId,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteSchema" });
    }

    public deleteSchemaWithPromise(schemaId: number, serviceId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleteSchema(schemaId, serviceId)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public addSchema(schemaName: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, itemsPerPage?: number, comments?: string,
        options?: string): ListenerEntry {
        const request = ProtocolMrs.getRequestAddSchema({
            moduleSessionId: this.moduleSessionId,
            schemaName,
            requestPath,
            requiresAuth,
            serviceId,
            itemsPerPage,
            comments,
            options,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddSchema" });
    }

    public addSchemaWithPromise(schemaName: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, itemsPerPage?: number,
        comments?: string, options?: string): Promise<IMrsAddSchemaResultData> {
        return new Promise((resolve, reject) => {
            this.addSchema(schemaName, requestPath,
                requiresAuth, serviceId, itemsPerPage,
                comments, options)
                .then((event: ICommMrsAddSchemaEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public updateSchema(schemaId: number, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: boolean, itemsPerPage: number, comments: string,
        options: string): ListenerEntry {

        const request = ProtocolMrs.getRequestUpdateSchema({
            moduleSessionId: this.moduleSessionId,
            schemaId,
            schemaName,
            requestPath,
            requiresAuth,
            enabled,
            itemsPerPage,
            comments,
            options,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsUpdateSchema" });
    }

    public updateSchemaWithPromise(schemaId: number, schemaName: string, requestPath: string,
        requiresAuth: boolean, enabled: boolean, itemsPerPage: number, comments: string,
        options: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.updateSchema(schemaId, schemaName, requestPath,
                requiresAuth, enabled, itemsPerPage, comments,
                options)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public addDbObject(dbObjectName: string, dbObjectType: string,
        autoAddSchema: boolean, requestPath: string, enabled: boolean, crudOperations: string[],
        crudOperationFormat: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean,
        rowUserOwnershipColumn?: string,
        schemaId?: number, schemaName?: string, itemsPerPage?: number,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string, options?: string, parameters?: IMrsDbObjectParameterData[]): ListenerEntry {
        const request = ProtocolMrs.getRequestAddDbObject({
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
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddDbObject" });
    }

    public addDbObjectWithPromise(dbObjectName: string, dbObjectType: string,
        autoAddSchema: boolean, requestPath: string, enabled: boolean, crudOperations: string[],
        crudOperationFormat: string, requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean, autoDetectMediaType: boolean,
        rowUserOwnershipColumn?: string,
        schemaId?: number, schemaName?: string, itemsPerPage?: number,
        comments?: string, mediaType?: string,
        authStoredProcedure?: string, options?: string,
        parameters?: IMrsDbObjectParameterData[]): Promise<IMrsAddDbObjectResultData> {
        return new Promise((resolve, reject) => {
            this.addDbObject(dbObjectName, dbObjectType,
                autoAddSchema, requestPath, enabled, crudOperations,
                crudOperationFormat, requiresAuth,
                rowUserOwnershipEnforced, autoDetectMediaType,
                rowUserOwnershipColumn,
                schemaId, schemaName, itemsPerPage, comments,
                mediaType, authStoredProcedure,
                options, parameters)
                .then((event: ICommMrsAddDbObjectEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public updateDbObject(dbObjectId: number, dbObjectName: string,
        requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean,
        autoDetectMediaType: boolean,
        name: string,
        requestPath: string,
        enabled: boolean,
        rowUserOwnershipColumn: string,
        schemaId: number,
        itemsPerPage: number,
        comments: string,
        mediaType: string,
        authStoredProcedure: string,
        crudOperations: string[],
        crudOperationFormat: string,
        options: string,
        parameters: string): ListenerEntry {
        const request = ProtocolMrs.getRequestUpdateDbObject({
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
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsUpdateDbObject" });
    }

    public updateDbObjectWithPromise(dbObjectId: number, dbObjectName: string,
        requiresAuth: boolean,
        rowUserOwnershipEnforced: boolean,
        autoDetectMediaType: boolean,
        name: string,
        requestPath: string,
        enabled: boolean,
        rowUserOwnershipColumn: string,
        schemaId: number,
        itemsPerPage: number,
        comments: string,
        mediaType: string,
        authStoredProcedure: string,
        crudOperations: string[],
        crudOperationFormat: string,
        options: string,
        parameters: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.updateDbObject(dbObjectId, dbObjectName,
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
                parameters)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public listDbObjects(schemaId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestListDbObjects({ schemaId, moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListDbObjects" });
    }

    public getDbObjectRowOwnershipFields(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestGetDbObjectRowOwnershipFields(requestPath, dbObjectName,
            {
                moduleSessionId: this.moduleSessionId,
                dbObjectId,
                schemaId,
                schemaName,
                dbObjectType,
                interactive,
            });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsGetDbObjectRowOwnershipFields" });
    }

    public getDbObjectRowOwnershipFieldsWithPromise(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): Promise<IMrsGetDbObjectRowOwnershipFieldsResultData> {
        return new Promise((resolve, reject) => {
            this.getDbObjectRowOwnershipFields(requestPath, dbObjectName,
                dbObjectId, schemaId, schemaName, dbObjectType,
                interactive)
                .then((event: ICommMrsGetDbObjectRowOwnershipFieldsEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public getDbObjectParameters(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string,
        interactive?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestGetDbObjectParameters(requestPath, dbObjectName,
            {
                moduleSessionId: this.moduleSessionId,
                dbObjectId,
                schemaId,
                schemaName,
                interactive,
            });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsGetDbObjectRowOwnershipFields" });
    }

    public getDbObjectParametersWithPromise(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): Promise<IMrsDbObjectFieldsResultData> {
        return new Promise((resolve, reject) => {
            this.getDbObjectParameters(requestPath, dbObjectName,
                dbObjectId, schemaId, schemaName,
                interactive)
                .then((event: ICommMrsGetDbObjectFieldsEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public getDbObjectFields(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestGetDbObjectFields(requestPath, dbObjectName,
            {
                moduleSessionId: this.moduleSessionId,
                dbObjectId,
                schemaId,
                schemaName,
                dbObjectType,
                interactive,
            });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsGetRequestGetDbObjectFields" });
    }

    public getDbObjectFieldsWithPromise(requestPath?: string, dbObjectName?: string,
        dbObjectId?: number, schemaId?: number, schemaName?: string, dbObjectType?: string,
        interactive?: boolean): Promise<IMrsDbObjectFieldsResultData> {
        return new Promise((resolve, reject) => {
            this.getDbObjectFields(requestPath, dbObjectName,
                dbObjectId, schemaId, schemaName, dbObjectType,
                interactive)
                .then((event: ICommMrsGetDbObjectFieldsEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public deleteDbObject(dbObjectId?: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteDbObject(undefined, undefined,
            { moduleSessionId: this.moduleSessionId, dbObjectId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteDbObject" });
    }

    public deleteDbObjectWithPromise(dbObjectId?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleteDbObject(dbObjectId)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public addContentSet(contentDir: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, comments?: string,
        options?: string, enabled?: boolean, replaceExisting?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestAddContentSet({
            moduleSessionId: this.moduleSessionId,
            contentDir, serviceId,
            requestPath,
            requiresAuth,
            comments,
            options,
            enabled,
            replaceExisting,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsAddContentSet" });
    }

    public addContentSetWithPromise(contentDir: string, requestPath: string,
        requiresAuth: boolean, serviceId?: number, comments?: string,
        options?: string, enabled?: boolean, replaceExisting?: boolean,
        progress?: (message: string) => void): Promise<IMrsAddContentSetResultData> {
        return new Promise((resolve, reject) => {
            this.addContentSet(contentDir, requestPath,
                requiresAuth, serviceId, comments,
                options, enabled, replaceExisting)
                .then((event: ICommMrsAddContentSetEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        case EventType.DataResponse: {

                            if (progress && event.data?.result?.info) {
                                progress(event.data?.result?.info);
                            }

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public getServiceRequestPathAvailability(serviceId: number, requestPath: string): ListenerEntry {
        const request = ProtocolMrs.getRequestGetServiceRequestPathAvailability({
            moduleSessionId: this.moduleSessionId,
            serviceId,
            requestPath,
        });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsGetServiceRequestPathAvailability" });
    }

    public getServiceRequestPathAvailabilityWithPromise(
        serviceId: number, requestPath: string): Promise<IMrsServiceRequestPathAvailabilityResultData> {
        return new Promise((resolve, reject) => {
            this.getServiceRequestPathAvailability(serviceId, requestPath)
                .then((event: ICommMrsServiceRequestPathAvailabilityEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve(event.data);

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }

    public listContentSets(serviceId: number, requestPath?: string): ListenerEntry {
        const request = ProtocolMrs.getRequestListContentSets(serviceId,
            { requestPath, moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListContentSets" });
    }

    public listContentSetsWithPromise(serviceId: number, requestPath?: string): Promise<IMrsContentSetResultData> {
        return new Promise((resolve, reject) => {
            this.listContentSets(serviceId, requestPath).then((event: ICommMrsContentSetEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public listContentFiles(contentSetId: number, includeEnableState?: boolean): ListenerEntry {
        const request = ProtocolMrs.getRequestListContentFiles(
            { contentSetId, includeEnableState, moduleSessionId: this.moduleSessionId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsListContentFiles" });
    }

    public listContentFilesWithPromise(contentSetId: number,
        includeEnableState?: boolean): Promise<IMrsContentFileResultData> {
        return new Promise((resolve, reject) => {
            this.listContentFiles(contentSetId, includeEnableState).then((event: ICommMrsContentFileEvent) => {
                switch (event.eventType) {
                    case EventType.FinalResponse: {
                        resolve(event.data);

                        break;
                    }

                    default:
                }
            }).catch((event: ICommErrorEvent) => {
                reject(event.message);
            });
        });
    }

    public deleteContentSet(contentSetId: number): ListenerEntry {
        const request = ProtocolMrs.getRequestDeleteContentSet({ moduleSessionId: this.moduleSessionId, contentSetId });

        return MessageScheduler.get.sendRequest(request, { messageClass: "mrsDeleteContentSet" });
    }

    public deleteContentSetWithPromise(contentSetId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleteContentSet(contentSetId)
                .then((event: ICommSimpleResultEvent) => {
                    switch (event.eventType) {
                        case EventType.FinalResponse: {
                            resolve();

                            break;
                        }

                        default:
                    }
                }).catch((event: ICommErrorEvent) => {
                    reject(event.message);
                });
        });
    }


    private get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }
}
