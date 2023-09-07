/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, RefObject } from "preact";
import { DialogResponseClosure, DialogType, IDialogRequest, IDictionary, MrsDialogType } from "../../app-logic/Types";

import { IShellDictionary } from "../../communication/Protocol";

import {
    IMrsAuthAppData, IMrsContentSetData, IMrsObject, IMrsSchemaData, IMrsServiceData, IMrsUserData,
    IMrsUserRoleData,
} from "../../communication/ProtocolMrs";
import { AwaitableValueEditDialog } from "../../components/Dialogs/AwaitableValueEditDialog";
import { ComponentBase } from "../../components/ui/Component/ComponentBase";
import { IMrsDbObjectEditRequest, requisitions } from "../../supplement/Requisitions";

import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { MrsDbObjectDialog } from "./dialogs/MrsDbObjectDialog";
import { IMrsSchemaDialogData, MrsSchemaDialog } from "./dialogs/MrsSchemaDialog";
import { IMrsContentSetDialogData, MrsContentSetDialog } from "./dialogs/MrsContentSetDialog";
import { IMrsAuthenticationAppDialogData, MrsAuthenticationAppDialog } from "./dialogs/MrsAuthenticationAppDialog";
import { IMrsUserDialogData, MrsUserDialog } from "./dialogs/MrsUserDialog";
import { IMrsServiceDialogData, MrsServiceDialog } from "./dialogs/MrsServiceDialog";
import { uuid } from "../../utilities/helpers";
import { DialogHost } from "../../app-logic/DialogHost";
import { snakeToCamelCase } from "../../utilities/string-helpers";

type DialogConstructor = new (props: {}) => AwaitableValueEditDialog;

interface IMrsEditObjectData extends IDictionary {
    serviceId: string,
    dbSchemaId: string,
    dbSchemaPath: string,
    name: string,
    requestPath: string,
    requiresAuth: boolean,
    enabled: boolean,
    itemsPerPage: number,
    comments: string,
    rowUserOwnershipEnforced: boolean,
    rowUserOwnershipColumn: string,
    objectType: string,
    crudOperations: string[],
    crudOperationFormat: string,
    autoDetectMediaType: boolean,
    mediaType: string,
    options: string,
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
     * @returns A promise resolving to true if the dialog was closed with OK, false otherwise.
     */
    public showMrsServiceDialog = async (backend: ShellInterfaceSqlEditor,
        service?: IMrsServiceData): Promise<boolean> => {

        const authVendors = await backend.mrs.getAuthVendors();

        const title = service
            ? "Adjust the REST Service Configuration"
            : "Enter Configuration Values for the New REST Service";
        const authAppNewItem: IMrsAuthAppData = {
            id: "",
            authVendorId: "",
            authVendorName: "",
            serviceId: "",
            name: "<new>",
            description: "",
            url: "",
            urlDirectAuth: "",
            accessToken: "",
            appId: "",
            enabled: true,
            limitToRegisteredUsers: true,
            defaultRoleId: "MQAAAAAAAAAAAAAAAAAAAA==",
        };

        if (service && (!service.authApps)) {
            service.authApps = await backend.mrs.getAuthApps(service.id);

            // Add entry for <new> item.
            service.authApps.push(authAppNewItem);

            // Set the authVendorName fields of the app list so it can be used for the dropdown.
            for (const app of service.authApps) {
                app.authVendorName = authVendors.find((vendor) => {
                    return app.authVendorId === vendor.id;
                })?.name ?? "";
            }
        }

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
                protocols: ["HTTPS", "HTTP"],
                authVendors,
            },
            values: {
                serviceId: service?.id ?? 0,
                servicePath: service?.urlContextRoot ?? "/myService",
                hostName: service?.urlHostName,
                protocols: service?.urlProtocol ?? ["HTTPS"],
                isCurrent: !service || service.isCurrent === 1,
                enabled: !service || service.enabled === 1,
                comments: service?.comments ?? "",
                options: serviceOptions,
                authPath: service?.authPath ?? "/authentication",
                authCompletedUrlValidation: service?.authCompletedUrlValidation ?? "",
                authCompletedUrl: service?.authCompletedUrl ?? "",
                authCompletedPageContent: service?.authCompletedPageContent ?? "",
                authApps: service?.authApps ?? [authAppNewItem],
            },
        };

        const result = await this.showDialog(dialogRequest);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IMrsServiceDialogData;

        const urlContextRoot = data.servicePath;
        const protocols = data.protocols;
        const hostName = data.hostName;
        const comments = data.comments;
        const isCurrent = data.isCurrent;
        const enabled = data.enabled;
        const options = data.options === "" ?
            null : JSON.parse(data.options) as IShellDictionary;
        const authPath = data.authPath;
        const authCompletedUrl = data.authCompletedUrl;
        const authCompletedUrlValidation = data.authCompletedUrlValidation;
        const authCompletedPageContent = data.authCompletedPageContent;

        // Remove entry for <new> item.
        const authApps = (data.authApps as IMrsAuthAppData[]).filter((a: IMrsAuthAppData) => {
            return a.id !== "";
        });

        // Set the authVendorId based on the authVendorName.
        for (const app of authApps) {
            app.authVendorId = authVendors.find((vendor) => {
                return app.authVendorName === vendor.name;
            })?.id ?? "";
            app.serviceId = app.serviceId === "" ? undefined : app.serviceId;
            app.authVendorId = app.authVendorId === "" ? undefined : app.authVendorId;
            app.defaultRoleId = app.defaultRoleId === "" ? null : app.defaultRoleId;
        }

        if (!service) {
            try {
                const service = await backend.mrs.addService(urlContextRoot, protocols, hostName ?? "",
                    comments, enabled,
                    options,
                    authPath, authCompletedUrl, authCompletedUrlValidation, authCompletedPageContent,
                    authApps);

                if (isCurrent) {
                    await backend.mrs.setCurrentService(service.id);
                }

                void requisitions.executeRemote("refreshConnections", undefined);
                void requisitions.execute("showInfo", ["The MRS service has been created."]);
            } catch (error) {
                void requisitions.execute("showError", [`Error while adding MySQL REST service: ${String(error)}`]);
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
                        urlProtocol: protocols,
                        urlHostName: hostName,
                        enabled,
                        comments,
                        options,
                        authPath,
                        authCompletedUrl,
                        authCompletedUrlValidation,
                        authCompletedPageContent,
                        authApps,
                    },
                );

                if (isCurrent) {
                    await backend.mrs.setCurrentService(service.id);
                }

                void requisitions.execute("refreshConnections", undefined);
                void requisitions.execute("showInfo", ["The MRS service has been successfully updated."]);

            } catch (error) {
                void requisitions.execute("showError",
                    [`Error while updating MySQL REST service: ${String(error)}`]);
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
     * @returns A promise resolving to true if the dialog was closed with OK, false otherwise.
     */
    public showMrsSchemaDialog = async (backend: ShellInterfaceSqlEditor, schemaName?: string,
        schema?: IMrsSchemaData): Promise<boolean> => {

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
                    requestPath: schema?.requestPath ?? `/${snakeToCamelCase(schemaName ?? "schema")}`,
                    requiresAuth: schema?.requiresAuth === 1,
                    enabled: !schema || schema.enabled === 1,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                    options: schema?.options ? JSON.stringify(schema?.options) : "",
                },
            };

            const result = await this.showDialog(request);
            // The request was not sent at all (e.g. there was already one running).
            if (result === DialogResponseClosure.Cancel) {
                return true;
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

            if (!schema) {
                try {
                    await backend.mrs.addSchema(
                        serviceId, dbSchemaName, requestPath, requiresAuth, options,
                        itemsPerPage, comments);

                    void requisitions.executeRemote("refreshConnections", undefined);
                    void requisitions.execute("showInfo", ["The MRS schema has been added successfully."]);
                } catch (error) {
                    await requisitions.execute("showError",
                        [`Error while adding MRS schema: ${String(error) ?? "<unknown>"}`]);
                }
            } else {
                try {
                    await backend.mrs.updateSchema(schema.id, serviceId, dbSchemaName,
                        requestPath, requiresAuth, enabled,
                        itemsPerPage, comments, options);

                    void requisitions.executeRemote("refreshConnections", undefined);
                    void requisitions.execute("showInfo", ["The MRS schema has been updated successfully."]);
                } catch (error) {
                    await requisitions.execute("showError",
                        [`Error while updating MRS schema: ${String(error) ?? "<unknown>"}`]);
                }
            }
        } catch (error) {
            await requisitions.execute("showError",
                [`Error while listing MySQL REST services: ${String(error) ?? "<unknown>"}`]);
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS DB Object.
     *
     * @param backend The interface for sending the requests.
     * @param request Details about the object to edit.
     *
     * @returns A promise resolving to true if the dialog was closed with OK, false otherwise.
     */
    public async showMrsDbObjectDialog(backend: ShellInterfaceSqlEditor,
        request: IMrsDbObjectEditRequest): Promise<boolean> {

        const dbObject = request.dbObject;

        const services = await backend.mrs.listServices();
        const schemas = await backend.mrs.listSchemas(dbObject.serviceId === "" ? undefined : dbObject.serviceId);
        let rowOwnershipFields: string[];
        if (dbObject.objectType !== "PROCEDURE") {
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
                dbObject.name, dbObject.schemaName);
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
                enabled: dbObject.enabled === 1,
                itemsPerPage: dbObject.itemsPerPage,
                comments: dbObject.comments ?? "",
                rowUserOwnershipEnforced: dbObject.rowUserOwnershipEnforced === 1,
                rowUserOwnershipColumn: dbObject.rowUserOwnershipColumn,
                objectType: dbObject.objectType,
                crudOperations: dbObject.crudOperations,
                crudOperationFormat: dbObject.crudOperationFormat,
                autoDetectMediaType: dbObject.autoDetectMediaType === 1,
                mediaType: dbObject.mediaType,
                options: dbObject?.options ? JSON.stringify(dbObject?.options) : "",
                authStoredProcedure: dbObject.authStoredProcedure,

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
        const rowUserOwnershipEnforced = data.rowUserOwnershipEnforced;
        const rowUserOwnershipColumn = data.rowUserOwnershipColumn;
        const objectType = data.objectType;
        const crudOperations = objectType === "PROCEDURE" ? ["UPDATE"] : (data.crudOperations ?? ["READ"]);
        const crudOperationFormat = data.crudOperationFormat ?? "FEED";
        const mediaType = data.mediaType;
        const autoDetectMediaType = data.autoDetectMediaType;
        const authStoredProcedure = data.authStoredProcedure;
        const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;
        const objects = data.objects;

        const newService = services.find((service) => {
            return service.urlContextRoot === servicePath;
        });

        const serviceSchemas = await backend.mrs.listSchemas(newService?.id);
        const newSchema = serviceSchemas.find((schema) => {
            return schema.requestPath === schemaPath;
        });

        if (request.createObject) {
            // Create new DB Object
            try {
                await backend.mrs.addDbObject(name, objectType,
                    false, requestPath, enabled, crudOperations,
                    crudOperationFormat, requiresAuth,
                    rowUserOwnershipEnforced, autoDetectMediaType,
                    options, itemsPerPage,
                    rowUserOwnershipColumn,
                    newSchema?.id, undefined, comments,
                    mediaType, "",
                    objects);

                requisitions.executeRemote("refreshConnections", undefined);
            } catch (error) {
                void requisitions.execute("showError", [
                    `The MRS Database Object ${name} could not be created.`,
                    `${String(error)}`,
                ]);

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
                        rowUserOwnershipEnforced,
                        rowUserOwnershipColumn,
                        itemsPerPage,
                        comments,
                        mediaType,
                        authStoredProcedure,
                        crudOperations,
                        crudOperationFormat,
                        options,
                        objects,
                    });

                requisitions.executeRemote("refreshConnections", undefined);
            } catch (error) {
                void requisitions.execute("showError", [
                    `The MRS Database Object ${name} could not be updated.`,
                    `${String(error)}`,
                ]);

                return true;
            }
        }

        void requisitions.execute("showInfo", [
            `The MRS Database Object ${name} was ${data.createObject ? "created" : "updated"} successfully.`]);

        void requisitions.execute("refreshMrsServiceSdk", {});


        return true;
    }

    /**
     * Shows a dialog to create a new or edit an existing MRS content set.
     *
     * @param backend The interface for sending the requests.
     * @param directory The directory to upload as content set
     * @param contentSet If not assigned then a new schema must be created otherwise this contains the existing values.
     *
     * @returns A promise resolving to true if the dialog was closed with OK, false otherwise.
     */
    public showMrsContentSetDialog = async (backend: ShellInterfaceSqlEditor, directory?: string,
        contentSet?: IMrsContentSetData): Promise<boolean> => {

        try {
            const services = await backend.mrs.listServices();
            const title = contentSet
                ? "Adjust the MRS Static Content Set Configuration"
                : "Enter Configuration Values for the New MRS Static Content Set";

            let requestPath = contentSet?.requestPath;
            if (!requestPath) {
                if (directory) {
                    const getOneBeforeLastFolder = () => {
                        const lastSlash = directory.lastIndexOf("/");

                        return directory.substring(directory.substring(0, lastSlash).lastIndexOf("/"), lastSlash);
                    };

                    // If the given directory path ends with common build folder names, pick the folder before
                    if (directory.endsWith("/build") || directory.endsWith("/output") ||
                        directory.endsWith("/out") || directory.endsWith("/web")) {
                        requestPath = getOneBeforeLastFolder();
                    } else {
                        requestPath = directory.substring(directory.lastIndexOf("/"));
                    }
                } else {
                    requestPath = "/content";
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
                    requestPath: contentSet?.requestPath ?? requestPath,
                    requiresAuth: contentSet?.requiresAuth === 1,
                    enabled: !contentSet || contentSet.enabled === 1,
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
            requestPath = data.requestPath;
            const requiresAuth = data.requiresAuth;
            const comments = data.comments;
            const enabled = data.enabled;
            const options = data.options === "" ? null : JSON.parse(data.options) as IShellDictionary;

            // Check if the request path is valid for this service and does not overlap with other services
            let requestPathValid = false;
            try {
                requestPathValid = await backend.mrs.getServiceRequestPathAvailability(serviceId, requestPath);
                if (!requestPathValid) {
                    // Check if the request path is taken by another content set.
                    const existingContentSets = await backend.mrs.listContentSets(serviceId, requestPath);
                    if (existingContentSets.length > 0) {
                        const response = await DialogHost.showDialog({
                            id: "mrsContentSetPathConfirmation",
                            type: DialogType.Confirm,
                            title: "Confirmation",
                            parameters: {
                                prompt: `The request path ${requestPath} is already used by another ` +
                                    "static content set. Do you want to replace the existing one?",
                                accept: "Yes",
                                refuse: "No",
                                default: "No",
                            },
                        });

                        if (response.closure === DialogResponseClosure.Accept) {
                            requestPathValid = true;
                        } else {
                            void requisitions.execute("showInfo", ["Cancelled the upload."]);
                        }
                    } else {
                        void requisitions.execute("showError",
                            [`The request path ${requestPath} is already used on this service.`]);
                    }
                }
            } catch (error) {
                void requisitions.execute("showError",
                    [`Error while checking the MRS content set request path: ${String(error) ?? "<unknown>"}`]);
            }

            if (requestPathValid) {
                if (!contentSet) {
                    const sbId = uuid();
                    const updateStatusbar = (text?: string, timeout?: number) => {
                        // Removes the statusbar item, if the text is undefined.
                        requisitions.executeRemote("updateStatusbar", [{
                            id: sbId, text, visible: text !== undefined, hideAfter: timeout,
                        }]);
                    };

                    try {
                        updateStatusbar(`$(loading~spin) Starting to load static content set ...`);

                        const addedContentSet = await backend.mrs.addContentSet(data.directory, requestPath,
                            requiresAuth, options, serviceId, comments, enabled, true, (message) => {
                                updateStatusbar("$(loading~spin) " + message);
                            },
                        );

                        updateStatusbar();

                        void requisitions.executeRemote("refreshConnections", undefined);
                        void requisitions.execute("showInfo", [
                            "The MRS static content set has been added successfully. " +
                            `${addedContentSet.numberOfFilesUploaded ?? ""} file` +
                            `${addedContentSet.numberOfFilesUploaded ?? 2 > 1 ? "s" : ""} have been uploaded`,
                        ]);
                    } catch (error) {
                        void requisitions.execute("showError",
                            [`Error while adding MRS content set: ${String(error) ?? "<unknown>"}`]);
                    } finally {
                        updateStatusbar();
                    }
                } else {
                    try {
                        // Todo
                    } catch (error) {
                        void requisitions.execute("showError",
                            [`Error while updating MRS content set: ${String(error) ?? "<unknown>"}`]);
                    }
                }
            }
        } catch (error) {
            void requisitions.execute("showError",
                [`Error while listing MySQL REST services: ${String(error) ?? "<unknown>"}`]);
        }

        return true;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param authApp If not assigned then a new service must be created otherwise this contains the existing values.
     * @param service If the authApp is not assigned, the service must be available, so that we can create
     *                a new authApp for this service.
     *
     * @returns A promise resolving to true if the dialog was closed with OK, false otherwise.
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
                protocols: ["HTTPS", "HTTP"],
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
                });

                void requisitions.executeRemote("refreshConnections", undefined);
                void requisitions.execute("showInfo", ["The MRS Authentication App has been updated."]);
            } catch (error) {
                void requisitions.execute("showError",
                    [`Error while updating MySQL REST Authentication App: ${String(error)}`]);
            }
        } else {
            try {
                if (service) {
                    await backend.mrs.addAuthApp(service.id, {
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
                    }, []);
                }

                void requisitions.executeRemote("refreshConnections", undefined);
                void requisitions.execute("showInfo", ["The MRS Authentication App has been added."]);
            } catch (error) {
                void requisitions.execute("showError",
                    [`Error while adding MySQL REST Authentication App: ${String(error)}`]);
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
     * @returns true if the dialog was closed correctly
     */
    public showMrsUserDialog = async (backend: ShellInterfaceSqlEditor,
        authApp: IMrsAuthAppData, user?: IMrsUserData): Promise<boolean> => {

        const title = user ? `Adjust the REST User` : `Enter new MySQL REST User Values`;

        const authApps = await backend.mrs.getAuthApps(authApp.serviceId ?? "unknown");
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
                authApps,
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
        const authAppId = authApps.find((authApp) => {
            return authApp.name === data.authAppName;
        })?.id;

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
                        authAppId,
                        name: data.name ?? null,
                        email: data.email ?? null,
                        vendorUserId: data.vendorUserId ?? null,
                        loginPermitted: data.loginPermitted,
                        mappedUserId: data.mappedUserId ?? null,
                        appOptions: data.appOptions ? JSON.parse(data.appOptions) as IShellDictionary : null,
                        authString: data.authString ?? null,
                    }, rolesToUpdate);

                    void requisitions.executeRemote("refreshConnections", undefined);
                    void requisitions.execute("showInfo", ["The MRS User has been updated."]);
                } catch (error) {
                    void requisitions.execute("showError",
                        [`Error while updating MySQL REST User: ${String(error)}`]);
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

                void requisitions.executeRemote("refreshConnections", undefined);
                void requisitions.execute("showInfo", ["The MRS User has been added."]);
            } catch (error) {
                void requisitions.execute("showError", [`Error while adding MySQL REST User: ${String(error)}`]);
            }
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
