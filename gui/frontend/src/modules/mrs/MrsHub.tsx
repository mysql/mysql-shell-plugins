/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, RefObject } from "preact";

import {
    DialogResponseClosure, DialogType, IDialogRequest, IDictionary, MrsDialogType,
} from "../../app-logic/general-types.js";

import { IShellDictionary } from "../../communication/Protocol.js";

import type {
    IMrsAddContentSetData, IMrsAuthAppData, IMrsContentSetData, IMrsObject, IMrsSchemaData, IMrsServiceData,
    IMrsUserData, IMrsUserRoleData,
} from "../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../components/Dialogs/AwaitableValueEditDialog.js";
import { ComponentBase } from "../../components/ui/Component/ComponentBase.js";
import { requisitions } from "../../supplement/Requisitions.js";
import type { IMrsDbObjectEditRequest } from "../../supplement/RequisitionTypes.js";

import { DialogHost } from "../../app-logic/DialogHost.js";
import { ui } from "../../app-logic/UILayer.js";
import { getMySQLDbConnectionUri } from "../../communication/MySQL.js";
import { getRouterPortForConnection } from "../../modules/mrs/mrs-helpers.js";
import { IConnectionDetails } from "../../supplement/ShellInterface/index.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { convertSnakeToCamelCase } from "../../utilities/string-helpers.js";
import { IMrsAuthenticationAppDialogData, MrsAuthenticationAppDialog } from "./dialogs/MrsAuthenticationAppDialog.js";
import { IMrsContentSetDialogData, MrsContentSetDialog } from "./dialogs/MrsContentSetDialog.js";
import { MrsDbObjectDialog } from "./dialogs/MrsDbObjectDialog.js";
import { IMrsSchemaDialogData, MrsSchemaDialog } from "./dialogs/MrsSchemaDialog.js";
import { IMrsSdkExportDialogData, MrsSdkExportDialog } from "./dialogs/MrsSdkExportDialog.js";
import { IMrsServiceDialogData, MrsServiceDialog } from "./dialogs/MrsServiceDialog.js";
import { IMrsUserDialogData, MrsUserDialog } from "./dialogs/MrsUserDialog.js";
import { MrsDbObjectType } from "./types.js";

type DialogConstructor = new (props: {}) => AwaitableValueEditDialog;

interface IMrsEditObjectData extends IDictionary {
    serviceId: string,
    dbSchemaId: string,
    dbSchemaPath: string,
    name: string,
    requestPath: string,
    requiresAuth: boolean,
    enabled: number,
    itemsPerPage: number,
    comments: string,
    objectType: MrsDbObjectType,
    crudOperations: string[],
    crudOperationFormat: string,
    autoDetectMediaType: boolean,
    mediaType: string,
    options: string,
    metadata?: IShellDictionary;
    authStoredProcedure: string,
    objects: IMrsObject[];

    payload: IDictionary;
}

/** A component to host all MRS dialogs of the application and the handling of dialog results. */
export class MrsHub extends ComponentBase {
    // Lists the dialog types and their corresponding dialog components.
    // These dialogs are registered and instantiated in the render() method.
    static readonly #dialogTypes = new Map<MrsDialogType, DialogConstructor>([
        [MrsDialogType.MrsService, MrsServiceDialog],
        [MrsDialogType.MrsSchema, MrsSchemaDialog],
        [MrsDialogType.MrsDbObject, MrsDbObjectDialog],
        [MrsDialogType.MrsContentSet, MrsContentSetDialog],
        [MrsDialogType.MrsAuthenticationApp, MrsAuthenticationAppDialog],
        [MrsDialogType.MrsUser, MrsUserDialog],
        [MrsDialogType.MrsSdkExport, MrsSdkExportDialog],
    ]);

    // Holds the currently running dialog type (only one of each type can run at the same time) and last
    // active HTML element, when this dialog was launched.
    #runningDialogs = new Map<MrsDialogType, Element | null>();
    #dialogRefs = new Map<MrsDialogType, RefObject<AwaitableValueEditDialog>>();

    public render(): ComponentChild {
        const dialogs: ComponentChild[] = [];

        // The name of the variable must be PascalCase for JSX.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        MrsHub.#dialogTypes.forEach((Dialog: DialogConstructor, type) => {
            const ref = createRef<InstanceType<typeof Dialog>>();
            this.#dialogRefs.set(type, ref);

            dialogs.push(<Dialog
                key={Dialog.name}
                ref={ref}
            />);
        });

        return (
            <>
                {dialogs}
            </>
        );
    }

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param service If not assigned then a new service must be created otherwise this contains the existing values.
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public showMrsServiceDialog = async (backend: ShellInterfaceSqlEditor,
        service?: IMrsServiceData): Promise<boolean> => {

        const authVendors = await backend.mrs.getAuthVendors();

        const title = service
            ? "Adjust the REST Service Configuration"
            : "Enter Configuration Values for the New REST Service";

        const defaultOptions = {
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "Access-Control-Allow-Credentials": "true",
                // eslint-disable-next-line @typescript-eslint/naming-convention, max-len
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            },
            http: {
                allowedOrigin: "auto",
            },
            logging: {
                exceptions: true,
                request: {
                    body: true,
                    headers: true,
                },
                response: {
                    body: true,
                    headers: true,
                },
            },
            returnInternalErrorDetails: true,
            includeLinksInResults: false,
        };

        let serviceOptions = "";
        if (service?.options) {
            serviceOptions = JSON.stringify(service.options, undefined, 4);
        } else if (!service) {
            serviceOptions = JSON.stringify(defaultOptions, undefined, 4);
        }

        const dialogRequest = {
            id: "mrsServiceDialog",
            type: MrsDialogType.MrsService,
            title,
            parameters: {
                protocols: ["HTTPS"],
                authVendors,
            },
            values: {
                serviceId: service?.id ?? 0,
                servicePath: service?.urlContextRoot ?? "/myService",
                name: service?.name ?? "MyService",
                hostName: service?.urlHostName,
                protocols: service?.urlProtocol ?? ["HTTPS"],
                isCurrent: !service || service.isCurrent === 1,
                enabled: !service || service.enabled === 1,
                published: service === undefined ? false : service.published === 1,
                comments: service?.comments ?? "",
                options: serviceOptions,
                authPath: service?.authPath ?? "/authentication",
                authCompletedUrlValidation: service?.authCompletedUrlValidation ?? "",
                authCompletedUrl: service?.authCompletedUrl ?? "",
                authCompletedPageContent: service?.authCompletedPageContent ?? "",
                metadata: service?.metadata ? JSON.stringify(service.metadata, undefined, 4) : "",
            },
        };

        const result = await this.showDialog(dialogRequest);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsServiceDialogData;

        const urlContextRoot = data.servicePath;
        const name = data.name;
        const protocols = data.protocols;
        const hostName = data.hostName;
        const comments = data.comments;
        const isCurrent = data.isCurrent;
        const enabled = data.enabled;
        const published = data.published;
        const options = data.options === "" ?
            null : JSON.parse(data.options) as IShellDictionary;
        const authPath = data.authPath;
        const authCompletedUrl = data.authCompletedUrl;
        const authCompletedUrlValidation = data.authCompletedUrlValidation;
        const authCompletedPageContent = data.authCompletedPageContent;
        const metadata = data.metadata === "" ? undefined : JSON.parse(data.metadata) as IShellDictionary;

        if (!service) {
            try {
                const service = await backend.mrs.addService(urlContextRoot, name, protocols, hostName ?? "", comments,
                    enabled, options, authPath, authCompletedUrl, authCompletedUrlValidation, authCompletedPageContent,
                    metadata, published);

                if (isCurrent) {
                    await backend.mrs.setCurrentService(service.id);
                }

                if (data.mrsAdminUser && data.mrsAdminUserPassword) {
                    const authApp = await backend.mrs.addAuthApp({
                        id: "",
                        authVendorId: "MAAAAAAAAAAAAAAAAAAAAA==",
                        authVendorName: "MRS",
                        serviceId: "",
                        name: "MRS",
                        description: "MRS Auth App",
                        url: "",
                        urlDirectAuth: "",
                        accessToken: "",
                        appId: "",
                        enabled: true,
                        limitToRegisteredUsers: true,
                        defaultRoleId: "MQAAAAAAAAAAAAAAAAAAAA==",
                    }, [], service.id);

                    await backend.mrs.addUser(authApp.authAppId, data.mrsAdminUser, "", "", true, "", null,
                        data.mrsAdminUserPassword, []);
                }

                void ui.showInformationMessage("The MRS service has been created.", {});
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while adding MySQL REST service: ${message}`, {});
            }
        } else {
            // Send update request.
            try {
                await backend.mrs.updateService(
                    service.id,
                    service.urlContextRoot,
                    service.urlHostName,
                    {
                        urlContextRoot,
                        name,
                        urlProtocol: protocols,
                        urlHostName: hostName,
                        enabled,
                        published,
                        comments,
                        options,
                        authPath,
                        authCompletedUrl,
                        authCompletedUrlValidation,
                        authCompletedPageContent,
                        metadata,
                    },
                );

                if (isCurrent) {
                    await backend.mrs.setCurrentService(service.id);
                }

                void ui.showInformationMessage("The MRS service has been successfully updated.", {});

            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while updating MySQL REST service: ${message}`, {});
            }
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS schema.
     *
     * @param backend The interface for sending the requests.
     * @param schemaName The name of the database schema.
     * @param schema If not assigned then a new schema must be created otherwise this contains the existing values.
     *
     * @returns A promise resolving to the id of the REST service, being modified, when the dialog was closed.
     *          This path is empty if the dialog was cancelled.
     */
    public showMrsSchemaDialog = async (backend: ShellInterfaceSqlEditor, schemaName?: string,
        schema?: IMrsSchemaData): Promise<string> => {

        try {
            const services = await backend.mrs.listServices();
            const title = schema
                ? "Adjust the REST Schema Configuration"
                : "Enter Configuration Values for the New REST Schema";

            const request = {
                id: "mrsSchemaDialog",
                type: MrsDialogType.MrsSchema,
                title,
                parameters: { services },
                values: {
                    serviceId: schema?.serviceId,
                    dbSchemaName: schema?.name ?? schemaName,
                    requestPath: schema?.requestPath ?? `/${convertSnakeToCamelCase(schemaName ?? "schema")}`,
                    requiresAuth: schema?.requiresAuth === 1,
                    enabled: !schema ? 1 : schema.enabled,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                    options: schema?.options ? JSON.stringify(schema?.options, undefined, 4) : "",
                    metadata: schema?.metadata ? JSON.stringify(schema.metadata, undefined, 4) : "",
                },
            };

            const result = await this.showDialog(request);

            // The request was not sent at all (e.g. there was already one running).
            if (result === DialogResponseClosure.Cancel) {
                return "";
            }

            const data = result as IMrsSchemaDialogData;
            const serviceId = data.serviceId;
            const dbSchemaName = data.dbSchemaName;
            const requestPath = data.requestPath;
            const requiresAuth = data.requiresAuth;
            const itemsPerPage = data.itemsPerPage ? data.itemsPerPage : null;
            const comments = data.comments;
            const enabled = data.enabled;
            const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;
            const metadata = data.metadata === "" ? undefined : JSON.parse(data.metadata) as IShellDictionary;

            if (!schema) {
                try {
                    await backend.mrs.addSchema(
                        serviceId, dbSchemaName, enabled, requestPath, requiresAuth, options,
                        itemsPerPage, comments, metadata);

                    void requisitions.executeRemote("refreshConnection", undefined);
                    void ui.showInformationMessage("The MRS schema has been added successfully.", {});

                    return data.serviceId;
                } catch (reason) {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    void ui.showErrorMessage(`Error while adding MRS schema: ${message}`, {});
                }
            } else {
                try {
                    await backend.mrs.updateSchema(schema.id, serviceId, dbSchemaName, requestPath, requiresAuth,
                        enabled, itemsPerPage, comments, options, metadata);

                    // Updating a schema can change the service it is associated with. Check that and update the
                    // parent details accordingly.
                    if (schema.serviceId !== serviceId) {
                        const service = services.find((service) => {
                            return service.id === serviceId;
                        });

                        if (service) {
                            schema.serviceId = service.id;
                            schema.hostCtx = service.hostCtx;
                        }
                    }

                    void requisitions.executeRemote("refreshConnection", undefined);
                    void ui.showInformationMessage("The MRS schema has been updated successfully.", {});

                    return data.serviceId;
                } catch (reason) {
                    const message = convertErrorToString(reason);
                    void ui.showErrorMessage(`Error while updating MRS schema: ${message}`, {});
                }
            }
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while listing MySQL REST services: ${message}`, {});
        }

        return "";
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS DB Object.
     *
     * @param backend The interface for sending the requests.
     * @param request Details about the object to edit.
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public async showMrsDbObjectDialog(backend: ShellInterfaceSqlEditor,
        request: IMrsDbObjectEditRequest): Promise<boolean> {

        const dbObject = request.dbObject;

        const services = await backend.mrs.listServices();
        const schemas = await backend.mrs.listSchemas(dbObject.serviceId === "" ? undefined : dbObject.serviceId);
        let rowOwnershipFields: string[];
        if (dbObject.objectType !== MrsDbObjectType.Procedure && dbObject.objectType !== MrsDbObjectType.Function
            && dbObject.objectType !== MrsDbObjectType.Script
        ) {
            const tableColumnsWithReferences = await backend.mrs.getTableColumnsWithReferences(
                undefined, dbObject.name,
                undefined, undefined, dbObject.schemaName,
                dbObject.objectType);
            rowOwnershipFields = tableColumnsWithReferences.filter((f) => {
                return f.referenceMapping === undefined || f.referenceMapping === null;
            }).map((f) => {
                return f.name;
            });
        } else {
            const params = await backend.mrs.getDbObjectParameters(
                dbObject.name, dbObject.schemaName, undefined, dbObject.objectType);
            rowOwnershipFields = params.map((p) => {
                return p.name;
            });
        }

        const dialogRequest = {
            id: "mrsDbObjectDialog",
            type: MrsDialogType.MrsDbObject,
            title: undefined,
            parameters: { services, schemas, rowOwnershipFields },
            values: {
                id: dbObject.id,
                serviceId: dbObject.serviceId,
                dbSchemaId: dbObject.dbSchemaId,
                name: dbObject.name,
                requestPath: dbObject.requestPath,
                requiresAuth: dbObject.requiresAuth === 1,
                enabled: dbObject.enabled,
                itemsPerPage: dbObject.itemsPerPage,
                comments: dbObject.comments ?? "",
                objectType: dbObject.objectType,
                crudOperations: dbObject.crudOperations,
                crudOperationFormat: dbObject.crudOperationFormat,
                autoDetectMediaType: dbObject.autoDetectMediaType === 1,
                mediaType: dbObject.mediaType,
                options: dbObject?.options ? JSON.stringify(dbObject?.options, undefined, 4) : "",
                authStoredProcedure: dbObject.authStoredProcedure,
                metadata: dbObject?.metadata,

                payload: {
                    backend,
                    dbObject,
                    createObject: request.createObject,
                },
            },
        };

        const result = await this.showDialog(dialogRequest);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsEditObjectData;
        const servicePath = data.servicePath as string;
        const schemaId = data.dbSchemaId;
        const schemaPath = data.dbSchemaPath;
        const name = data.name;
        const requestPath = data.requestPath;
        const requiresAuth = data.requiresAuth;
        const itemsPerPage = data.itemsPerPage;
        const comments = data.comments;
        const enabled = data.enabled;
        const objectType = data.objectType;
        const crudOperationFormat = data.crudOperationFormat ?? "FEED";
        const mediaType = data.mediaType;
        const autoDetectMediaType = data.autoDetectMediaType;
        const authStoredProcedure = data.authStoredProcedure;
        const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;
        const objects = data.objects;
        const metadata = data.metadata as IShellDictionary;

        const newService = services.find((service) => {
            return service.urlContextRoot === servicePath;
        });

        const serviceSchemas = await backend.mrs.listSchemas(newService?.id);
        const newSchema = serviceSchemas.find((schema) => {
            return schema.requestPath === schemaPath;
        });

        if (newService) {
            dbObject.serviceId = newService.id;
        }

        if (request.createObject) {
            // Create new DB Object
            try {
                await backend.mrs.addDbObject(name, objectType,
                    false, requestPath, enabled,
                    crudOperationFormat, requiresAuth,
                    autoDetectMediaType,
                    options, itemsPerPage,
                    newSchema?.id, undefined, comments,
                    mediaType, "",
                    metadata,
                    objects);

                requisitions.executeRemote("refreshConnection", undefined);
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`The MRS Database Object ${name} could not be created: ${message}`, {});

                return true;
            }
        } else {
            // Update existing DB Object
            try {
                await backend.mrs.updateDbObject(
                    dbObject.id, dbObject.name,
                    dbObject.requestPath,
                    schemaId,
                    {
                        name,
                        dbSchemaId: newSchema?.id,
                        requestPath,
                        requiresAuth,
                        autoDetectMediaType,
                        enabled,
                        itemsPerPage,
                        comments,
                        mediaType,
                        authStoredProcedure,
                        crudOperationFormat,
                        options,
                        objects,
                        metadata: metadata === null ? undefined : metadata,
                    });

                requisitions.executeRemote("refreshConnection", undefined);
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`The MRS Database Object ${name} could not be updated: ${message}`, {});

                return true;
            }
        }

        const changeString = data.createObject ? "created" : "updated";
        void ui.showInformationMessage(`The MRS Database Object ${name} was successfully ${changeString}.`, {});

        void requisitions.execute("refreshMrsServiceSdk", {});


        return true;
    }

    /**
     * Shows a dialog to create a new or edit an existing MRS content set.
     *
     * @param backend The interface for sending the requests.
     * @param directory The directory to upload as content set
     * @param contentSet If not assigned then a new schema must be created otherwise this contains the existing values.
     * @param requestPath The requestPath to use for the content set
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public showMrsContentSetDialog = async (backend: ShellInterfaceSqlEditor, directory?: string,
        contentSet?: IMrsContentSetData, requestPath?: string): Promise<boolean> => {

        try {
            const services = await backend.mrs.listServices();
            const title = contentSet
                ? "Adjust the MRS Static Content Set Configuration"
                : "Enter Configuration Values for the New MRS Static Content Set";

            let newRequestPath = contentSet?.requestPath ?? requestPath;
            if (!newRequestPath) {
                if (directory) {
                    const getOneBeforeLastFolder = () => {
                        const lastSlash = directory.lastIndexOf("/");

                        return directory.substring(directory.substring(0, lastSlash).lastIndexOf("/"), lastSlash);
                    };

                    // If the given directory path ends with common build folder names, pick the folder before
                    if (directory.endsWith("/build") || directory.endsWith("/output") ||
                        directory.endsWith("/out") || directory.endsWith("/web")) {
                        newRequestPath = getOneBeforeLastFolder();
                    } else {
                        newRequestPath = directory.substring(directory.lastIndexOf("/"));
                    }

                    newRequestPath = convertSnakeToCamelCase(newRequestPath) + "Content";

                    if (!newRequestPath.startsWith("/")) {
                        newRequestPath = "/" + newRequestPath;
                    }
                } else {
                    newRequestPath = "/content";
                }
            }

            const request = {
                id: "mrsContentSetDialog",
                type: MrsDialogType.MrsContentSet,
                title,
                parameters: { services, backend },
                values: {
                    directory,
                    serviceId: contentSet?.serviceId,
                    requestPath: contentSet?.requestPath ?? newRequestPath,
                    requiresAuth: contentSet?.requiresAuth === 1,
                    enabled: !contentSet ? 1 : contentSet.enabled,
                    comments: contentSet?.comments ?? "",
                    options: contentSet?.options ? JSON.stringify(contentSet?.options) : "",
                    payload: {
                        backend,
                    },
                },
            };

            const result = await this.showDialog(request);

            // The request was not sent at all (e.g. there was already one running).
            if (result === DialogResponseClosure.Cancel) {
                return true;
            }

            const data = result as IMrsContentSetDialogData;
            const serviceId = data.serviceId;
            newRequestPath = data.requestPath;
            const requiresAuth = data.requiresAuth;
            const comments = data.comments;
            const enabled = data.enabled;
            const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;
            const ignoreList = data.ignoreList;

            // Check if the request path is valid for this service and does not overlap with other services
            let requestPathValid = false;
            try {
                requestPathValid = await backend.mrs.getServiceRequestPathAvailability(serviceId, newRequestPath);
                if (!requestPathValid) {
                    // Check if the request path is taken by another content set.
                    const existingContentSets = await backend.mrs.listContentSets(serviceId, newRequestPath);
                    if (existingContentSets.length > 0) {
                        const response = await DialogHost.showDialog({
                            id: "mrsContentSetPathConfirmation",
                            type: DialogType.Confirm,
                            title: "Confirmation",
                            parameters: {
                                prompt: `The request path ${newRequestPath} is already used by another ` +
                                    "static content set. Do you want to replace the existing one?",
                                accept: "Yes",
                                refuse: "No",
                                default: "No",
                            },
                        });

                        if (response.closure === DialogResponseClosure.Accept) {
                            requestPathValid = true;
                        } else {
                            void ui.showInformationMessage("Cancelled the upload.", {});
                        }
                    } else {
                        void ui.showErrorMessage(`The request path ${requestPath} is already used on ` +
                            `this service.`, {});
                    }
                }
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while checking the MRS content set request path: ${message}`, {});
            }

            if (requestPathValid) {
                if (!contentSet) {
                    const statusBarItem = ui.createStatusBarItem();

                    try {
                        statusBarItem.text = "$(loading~spin) Starting to load static content set ...";
                        let addedContentSet: IMrsAddContentSetData = {};
                        void await backend.mrs.addContentSet(data.directory, newRequestPath,
                            requiresAuth, options, serviceId, comments, enabled, true, ignoreList, (data) => {
                                if (data.result.info) {
                                    ui.setStatusBarMessage("$(loading~spin) " + data.result.info);
                                } else {
                                    addedContentSet = data.result;
                                }
                            },
                        );

                        statusBarItem.dispose();

                        void requisitions.executeRemote("refreshConnection", undefined);
                        if (addedContentSet.numberOfFilesUploaded !== undefined) {
                            void ui.showInformationMessage("The MRS static content set has been added " +
                                `successfully. ${addedContentSet.numberOfFilesUploaded} file` +
                                `${addedContentSet.numberOfFilesUploaded > 1 ? "s" : ""} have been uploaded`, {});
                        }
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error while adding MRS content set: ${message}`, {});
                    } finally {
                        statusBarItem.dispose();
                    }
                } else {
                    try {
                        // TODO: Implement update of content set
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error while updating MRS content set: ${message}`, {});
                    }
                }
            }
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while listing MySQL REST services: ${message}`, {});
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param authApp If not assigned then a new service must be created otherwise this contains the existing values.
     * @param service When given the new auth app is linked to this service.
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public showMrsAuthAppDialog = async (backend: ShellInterfaceSqlEditor,
        authApp?: IMrsAuthAppData, service?: IMrsServiceData): Promise<boolean> => {

        const title = authApp
            ? "Adjust the MRS Authentication App Configuration"
            : "Enter Configuration Values for the New MRS Authentication App";

        const authVendors = await backend.mrs.getAuthVendors();
        const roles = await backend.mrs.listRoles();

        const authVendorName = authVendors.find((vendor) => {
            return authApp?.authVendorId === vendor.id;
        })?.name ?? "";

        const defaultRole = roles.find((role) => {
            return authApp?.defaultRoleId === role.id;
        })?.caption ?? (roles.length > 0) ? roles[0].caption : "";

        const request = {
            id: "mrsAuthenticationAppDialog",
            type: MrsDialogType.MrsAuthenticationApp,
            title,
            parameters: {
                protocols: ["HTTPS"],
                authVendors,
                roles,
            },
            values: {
                create: authApp !== undefined,
                id: "",
                authVendorName,
                name: authApp?.name,
                description: authApp?.description,
                accessToken: authApp?.accessToken,
                appId: authApp?.appId,
                url: authApp?.url,
                urlDirectAuth: authApp?.urlDirectAuth,
                enabled: authApp?.enabled ?? true,
                limitToRegisteredUsers: authApp?.limitToRegisteredUsers,
                defaultRoleId: defaultRole,
                options: (authApp?.options !== undefined && authApp?.options !== null)
                    ? JSON.stringify(authApp.options, undefined, 4) : undefined,
            },
        };

        const result = await this.showDialog(request);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsAuthenticationAppDialogData;
        const authVendorId = authVendors.find((vendor) => {
            return data.authVendorName === vendor.name;
        })?.id ?? "";

        const defaultRoleId = roles.find((role) => {
            return data.defaultRoleName === role.caption;
        })?.id ?? null;

        const options = (data.options !== undefined) ? JSON.parse(data.options) : undefined;

        if (authApp) {
            try {
                await backend.mrs.updateAuthApp(authApp.id as string, {
                    authVendorId,
                    name: data.name,
                    description: data.description,
                    url: data.url,
                    urlDirectAuth: data.urlDirectAuth,
                    accessToken: data.accessToken,
                    appId: data.appId,
                    enabled: data.enabled,
                    limitToRegisteredUsers: data.limitToRegisteredUsers,
                    defaultRoleId,
                    options,
                });

                // For local use update the auth app with the returned values.
                authApp.authVendor = authVendors.find((vendor) => {
                    return vendor.id === authVendorId;
                })?.name;
                authApp.authVendorId = authVendorId;
                authApp.name = data.name;
                authApp.description = data.description;
                authApp.options = options;
                authApp.url = data.url;
                authApp.urlDirectAuth = data.urlDirectAuth;
                authApp.accessToken = data.accessToken;
                authApp.appId = data.appId;
                authApp.enabled = data.enabled;
                authApp.limitToRegisteredUsers = data.limitToRegisteredUsers;
                authApp.defaultRoleId = defaultRoleId;

                void requisitions.executeRemote("refreshConnection", undefined);
                void ui.showInformationMessage("The MRS Authentication App has been updated.", {});
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while updating MySQL REST Authentication App: ${message}`, {});
            }
        } else {
            try {
                await backend.mrs.addAuthApp({
                    authVendorId,
                    name: data.name,
                    description: data.description,
                    url: data.url,
                    urlDirectAuth: data.urlDirectAuth,
                    accessToken: data.accessToken,
                    appId: data.appId,
                    enabled: data.enabled,
                    limitToRegisteredUsers: data.limitToRegisteredUsers,
                    defaultRoleId,
                    options,
                }, [], service?.id);

                void requisitions.executeRemote("refreshConnection", undefined);
                void ui.showInformationMessage("The MRS Authentication App has been added.", {});
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while adding MySQL REST Authentication App: ${message}`, {});
            }
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param authApp If the user is not assigned, the authApp must be available, so that we can create
     * @param user If not assigned then a new user must be created otherwise this contains the existing values.
     * a new authApp for this service.
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public showMrsUserDialog = async (backend: ShellInterfaceSqlEditor,
        authApp: IMrsAuthAppData, user?: IMrsUserData): Promise<boolean> => {

        const title = user ? `Adjust the REST User` : `Enter new MySQL REST User Values`;

        const availableRoles = await backend.mrs.listRoles(authApp?.serviceId);

        let userRoles: IMrsUserRoleData[] = [];

        if (user && user.id) {
            userRoles = await backend.mrs.listUserRoles(user.id);
        } else if (authApp.defaultRoleId) {
            userRoles = [{
                userId: null,
                roleId: authApp.defaultRoleId,
                comments: null,
            }];
        }

        const request = {
            id: "mrsUserDialog",
            type: MrsDialogType.MrsUser,
            title,
            parameters: {
                authApp,
                availableRoles,
                userRoles,
            },
            values: {
                name: user?.name,
                email: user?.email,
                vendorUserId: user?.vendorUserId,
                loginPermitted: user?.loginPermitted ?? true,
                mappedUserId: user?.mappedUserId,
                appOptions: user?.appOptions,
                authString: user?.authString,
            },
        };

        const result = await this.showDialog(request);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsUserDialogData;

        const rolesToUpdate = (data.userRoles).map((roleToUpdate) => {
            return {
                userId: user?.id ?? null,
                roleId: availableRoles.find((availableRole) => {
                    return availableRole.caption === roleToUpdate;
                })!.id,
                comments: null,
            };
        });

        if (user) {
            if (user.id) {
                try {
                    await backend.mrs.updateUser(user.id, {
                        authAppId: authApp.id,
                        name: data.name ?? null,
                        email: data.email ?? null,
                        vendorUserId: data.vendorUserId ?? null,
                        loginPermitted: data.loginPermitted,
                        mappedUserId: data.mappedUserId ?? null,
                        appOptions: data.appOptions ? JSON.parse(data.appOptions) as IShellDictionary : null,
                        authString: data.authString ?? null,
                    }, rolesToUpdate);

                    // For local use update the auth app with the returned values.
                    user.name = data.name;
                    user.email = data.email;
                    user.vendorUserId = data.vendorUserId;
                    user.loginPermitted = data.loginPermitted;
                    user.mappedUserId = data.mappedUserId;
                    user.appOptions = data.appOptions ? JSON.parse(data.appOptions) as IShellDictionary : undefined;
                    user.authString = data.authString;


                    void requisitions.executeRemote("refreshConnection", undefined);
                    void ui.showInformationMessage(`The MRS User "${data.name}" has been updated.`, {});
                } catch (reason) {
                    const message = convertErrorToString(reason);
                    void ui.showErrorMessage(`Error while updating MySQL REST User: ${message}`, {});
                }
            }
        } else {
            try {
                if (authApp && authApp.id) {
                    await backend.mrs.addUser(authApp.id, data.name!, data.email!, data.vendorUserId!,
                        data.loginPermitted, data.mappedUserId!,
                        data.appOptions ? JSON.parse(data.appOptions) as IShellDictionary : null,
                        data.authString!, rolesToUpdate);
                }

                void requisitions.executeRemote("refreshConnection", undefined);
                void ui.showInformationMessage(`The MRS User "${data.name}" has been added.`, {});
            } catch (reason) {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error while adding MySQL REST User: ${message}`, {});
            }
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param serviceId The id of the REST service
     * @param connectionId The id of the DB Connection
     * @param connectionDetails The DB Connection details
     * @param directory The directory that holds or should hold the exported SDK
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public showMrsSdkExportDialog = async (backend: ShellInterfaceSqlEditor,
        serviceId: string, connectionId: number, connectionDetails?: IConnectionDetails,
        directory?: string): Promise<boolean> => {

        if (connectionDetails === undefined) {
            connectionDetails = await ShellInterface.dbConnections.getDbConnection(connectionId);

            if (connectionDetails === undefined) {
                return false;
            }
        }

        // const authApps = await backend.mrs.getAuthApps(authApp.serviceId ?? "unknown");
        const service = await backend.mrs.getService(
            serviceId, null, null, null, null);
        let serviceUrl;
        if (!service.hostCtx.toLowerCase().startsWith("http")) {
            serviceUrl =
                `https://localhost:${getRouterPortForConnection(connectionId)}${service.urlContextRoot}`;
        } else {
            serviceUrl = service.hostCtx;
        }

        const currentSdkOptions = directory ? await backend.mrs.getSdkOptions(directory) : undefined;

        const request = {
            id: "mrsSdkExportDialog",
            type: MrsDialogType.MrsSdkExport,
            title: `Export MRS SDK Files for ${service.fullServicePath}`,
            parameters: {
                serviceName: service.hostCtx,
                languages: ["TypeScript", "Python"],
                appBaseClasses: [
                    {
                        language: "TypeScript",
                        appBaseClasses: ["MrsBaseAppPreact.ts"],
                    },
                ],
            },
            values: {
                directory,
                serviceUrl: currentSdkOptions?.serviceUrl ?? serviceUrl,
                serviceId,
                sdkLanguage: currentSdkOptions?.sdkLanguage ?? "TypeScript",
                addAppBaseClass: currentSdkOptions?.addAppBaseClass,
                header: currentSdkOptions?.header,
            },
        };

        const result = await this.showDialog(request);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsSdkExportDialogData;

        // Write SDK
        try {
            await backend.mrs.dumpSdkServiceFiles(
                data.directory, {
                serviceId,
                dbConnectionUri: getMySQLDbConnectionUri(
                    connectionDetails),
                sdkLanguage: data.sdkLanguage,
                serviceUrl: data.serviceUrl,
                addAppBaseClass: data.addAppBaseClass,
            });
            void ui.showInformationMessage("MRS SDK Files exported successfully.", {});
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while exporting the REST Service SDK Files: ${message}`, {});
        }

        return true;
    };

    private showDialog = (request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> => {
        // Check if a dialog of the given type is already active.
        // Only one of each type can be active at any time.
        const type = request.type as MrsDialogType;
        if (!this.#runningDialogs.has(type)) {
            const ref = this.#dialogRefs.get(type);
            if (ref && ref.current) {
                this.#runningDialogs.set(type, document.activeElement);
                const result = ref.current.show(request);

                const element = this.#runningDialogs.get(type);
                this.#runningDialogs.delete(type);

                if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
                    element.focus();
                }

                return result;
            }
        }

        return Promise.resolve(DialogResponseClosure.Cancel);
    };

}
