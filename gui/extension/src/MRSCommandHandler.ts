/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IShellDictionary } from "../../frontend/src/communication";
import { commands, ExtensionContext, Uri, window } from "vscode";
import { DialogResponseClosure, DialogType } from "../../frontend/src/app-logic/Types";
import {
    IMrsDbObjectParameterData, IMrsAuthAppData, IMrsContentSetData, IMrsDbObjectData, IMrsSchemaData, IMrsServiceData,
} from "../../frontend/src/communication/";

import { DBType, ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface";

import { ExtensionHost } from "./ExtensionHost";
import {
    ConnectionMySQLTreeItem, ConnectionsTreeBaseItem, MrsDbObjectTreeItem,
} from "./tree-providers/ConnectionsTreeProvider";
import { MrsContentSetTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsContentSetTreeItem";
import { MrsSchemaTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsServiceTreeItem";
import { MrsTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { showMessageWithTimeout, showModalDialog } from "./utilities";
import { openSqlEditorSessionAndConnection, openSqlEditorConnection } from "./utilitiesShellGui";
import { DialogWebviewManager } from "./web-views/DialogWebviewProvider";

export class MRSCommandHandler {
    private dialogManager = new DialogWebviewManager();

    public setup = (context: ExtensionContext, host: ExtensionHost): void => {
        context.subscriptions.push(commands.registerCommand("msg.mrs.configureMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.disableMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item, false);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.enableMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item, true);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addService", (item?: MrsTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editService", (item?: MrsServiceTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend, item.value).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteService",
            async (item?: MrsServiceTreeItem) => {
                if (item) {
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS service ${item.value.urlContextRoot} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
                        try {
                            await item.entry.backend?.mrs.deleteService(item.value.id);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS service has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error adding the MRS service: ${String(error)}`);
                        }
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.setDefaultService",
            async (item?: MrsServiceTreeItem) => {
                if (item) {
                    try {
                        await item.entry.backend?.mrs.setDefaultService(item.value.id);
                        await commands.executeCommand("msg.refreshConnections");
                        showMessageWithTimeout("The MRS service has been set as the new default service.");

                    } catch (reason) {
                        void window.showErrorMessage(`Error setting the default MRS service: ${String(reason)}`);
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteSchema",
            async (item?: MrsSchemaTreeItem) => {
                if (item) {
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS schema ${item.value.name} should be deleted?`, "Yes", "No");

                    if (answer) {
                        try {
                            await item.entry.backend?.mrs.deleteSchema(item.value.id, item.value.serviceId);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS schema has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error removing an MRS schema: ${String(error)}`);
                        }
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editSchema", (item?: MrsSchemaTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.value.name, item.value).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addSchema", (item?: SchemaMySQLTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.schema).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteDbObject",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    const accepted = await showModalDialog(
                        `Are you sure you want to delete the DB Object ${item.value.name}?`,
                        "Delete DB Object",
                        "This operation cannot be reverted!");

                    if (accepted) {
                        try {
                            await backend.mrs.deleteDbObject(item.value.id);

                            // TODO: refresh only the affected connection.
                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(`The DB Object ${item.value.name} has been deleted.`);
                        } catch (reason) {
                            void window.showErrorMessage(`Error deleting the DB Object: ${String(reason)}`);
                        }
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editDbObject", (item?: MrsDbObjectTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsDbObjectDialog(item.entry.backend, item.value, false).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addDbObject", (item?: ConnectionsTreeBaseItem) => {
            if (item?.entry.backend) {
                const backend = item.entry.backend;
                const objectType = item.dbType.toUpperCase();

                if (objectType === "TABLE" || objectType === "VIEW" || objectType === "PROCEDURE") {
                    // First, create a new temporary dbObject, then call the DbObject dialog
                    this.createNewDbObject(backend, item, objectType).then((dbObject) => {
                        this.showMrsDbObjectDialog(backend, dbObject, true, item.schema).catch((reason) => {
                            void window.showErrorMessage(`${String(reason)}`);
                        });
                    }).catch((reason) => {
                        void window.showErrorMessage(`${String(reason)}`);
                    });
                } else {
                    void window.showErrorMessage(
                        `The database object type '${objectType}' is not supported at this time`);
                }

            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addFolderAsContentSet",
            async (directory?: Uri) => {
                if (directory) {
                    const connection = await host.determineConnection(DBType.MySQL);
                    if (connection) {
                        const sqlEditor = new ShellInterfaceSqlEditor();
                        const statusbarItem = window.createStatusBarItem();
                        try {
                            statusbarItem.text = "$(loading~spin) Starting Database Session ...";
                            statusbarItem.show();

                            statusbarItem.text = "$(loading~spin) Starting Database Session ...";
                            await sqlEditor.startSession(connection.id + "MRSContentSetDlg");

                            statusbarItem.text = "$(loading~spin) Opening Database Connection ...";
                            await openSqlEditorConnection(sqlEditor, connection.details.id, (message) => {
                                statusbarItem.text = "$(loading~spin) " + message;
                            });

                            statusbarItem.hide();

                            await this.showMrsContentSetDialog(sqlEditor, directory);
                        } catch (error) {
                            void window.showErrorMessage("A error occurred when trying to show the MRS Static " +
                                `Content Set Dialog. Error: ${error instanceof Error ? error.message : String(error)}`);
                        } finally {
                            statusbarItem.hide();
                            await sqlEditor.closeSession();
                        }
                    }
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteContentSet",
            async (item?: MrsContentSetTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    const accepted = await showModalDialog(
                        `Are you sure you want to drop the static content set ${item.value.requestPath}?`,
                        "Delete Static Content Set",
                        "This operation cannot be reverted!");

                    if (accepted) {
                        try {
                            await backend.mrs.deleteContentSet(item.value.id);

                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(
                                "The MRS static content set has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(
                                `Error deleting the Static Content Set: ${String(error)}`);
                        }
                    }
                }
            }));
    };

    private configureMrs = async (item?: ConnectionMySQLTreeItem, enableMrs?: boolean): Promise<void> => {
        if (item) {
            const sqlEditor = new ShellInterfaceSqlEditor();
            try {
                await openSqlEditorSessionAndConnection(sqlEditor, item.entry.details.id,
                    "msg.mrs.configureMySQLRestService");

                await sqlEditor.mrs.configure(enableMrs);

                void commands.executeCommand("msg.refreshConnections");
                showMessageWithTimeout("MySQL REST Service configured successfully.");
            } catch (error) {
                void window.showErrorMessage("A error occurred when trying to " +
                    "configure the MySQL REST Service. " +
                    `Error: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                await sqlEditor.closeSession();
            }
        }
    };

    private createNewDbObject = async (backend: ShellInterfaceSqlEditor,
        item: ConnectionsTreeBaseItem, objectType: string): Promise<IMrsDbObjectData> => {

        const params = await backend.mrs.getDbObjectFields(undefined, item.name,
            undefined, undefined, item.schema, objectType);

        // Add entry for <new> item
        params.push({
            id: 0,
            dbObjectId: 0,
            position: 0,
            name: "<new>",
            bindColumnName: "",
            datatype: "STRING",
            mode: "IN",
            comments: "",
        });

        const dbObject: IMrsDbObjectData = {
            comments: "",
            crudOperations: (objectType === "PROCEDURE") ? ["UPDATE"] : ["READ"],
            crudOperationFormat: "FEED",
            dbSchemaId: 0,
            enabled: 1,
            id: 0,
            name: item.name,
            objectType,
            requestPath: `/${item.name}`,
            requiresAuth: 1,
            rowUserOwnershipEnforced: 0,
            serviceId: 0,
            autoDetectMediaType: 0,
            parameters: params,
        };

        const services = await backend.mrs.listServices();
        let service;
        if (services.length === 1) {
            service = services[0];
        } else if (services.length > 1) {
            // Lookup default service
            service = services.find((service) => {
                return service.isDefault;
            });

            if (!service) {
                // No default connection set. Show a picker.
                const items = services.map((s) => {
                    return s.urlContextRoot;
                });

                const name = await window.showQuickPick(items, {
                    title: "Select a connection for SQL execution",
                    matchOnDescription: true,
                    placeHolder: "Type the name of an existing DB connection",
                });

                if (name) {
                    service = services.find((candidate) => {
                        return candidate.urlContextRoot === name;
                    });
                }

            }
        }

        if (service) {
            const schemas = await backend.mrs.listSchemas(service.id);
            const schema = schemas.find((schema) => {
                return schema.name === item.schema;
            });

            // Check if the DbObject's schema is already exposed as an MRS schema
            if (schema) {
                dbObject.dbSchemaId = schema.id;
            } else {
                const answer = await window.showInformationMessage(
                    `The database schema ${item.schema} has not been added to the `
                    + "REST Service. Do you want to add the schema now?",
                    "Yes", "No");
                if (answer === "Yes") {
                    dbObject.dbSchemaId = await backend.mrs.addSchema(service.id,
                        item.schema, `/${item.schema}`, true, undefined, undefined, undefined);

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout(`The MRS schema ${item.schema} has been added successfully.`, 5000);
                } else {
                    throw new Error("Operation cancelled.");
                }
            }
        } else {
            if (services.length === 0) {
                throw new Error("Please create a REST Service before adding DB Objects.");
            } else {
                throw new Error("No REST Service selected.");
            }
        }

        return dbObject;
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param service If not assigned then a new service must be created otherwise this contains the existing values.
     */
    private showMrsServiceDialog = async (backend: ShellInterfaceSqlEditor,
        service?: IMrsServiceData): Promise<void> => {

        const authVendors = await backend.mrs.getAuthVendors();

        const title = service
            ? "Adjust the MySQL REST Service Configuration"
            : "Enter Configuration Values for the New MySQL REST Service";
        const tabTitle = service
            ? "Edit REST Service"
            : "Add REST Service";
        const authAppNewItem: IMrsAuthAppData = {
            id: 0,
            authVendorId: 0,
            authVendorName: "",
            serviceId: 0,
            name: "<new>",
            description: "",
            url: "",
            urlDirectAuth: "",
            accessToken: "",
            appId: "",
            enabled: true,
            useBuiltInAuthorization: true,
            limitToRegisteredUsers: true,
            defaultAuthRoleId: 1,
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

        let defaultOptions = {};
        if (!service) {
            defaultOptions = {
                header: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "Access-Control-Allow-Origin": "*",
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                },
            };
        }
        const request = {
            id: "mrsServiceDialog",
            type: DialogType.MrsService,
            title,
            parameters: {
                protocols: ["HTTPS", "HTTP"],
                authVendors,
            },
            values: {
                serviceId: service?.id ?? 0,
                servicePath: service?.urlContextRoot ?? "/mrs",
                hostName: service?.urlHostName,
                protocols: service?.urlProtocol ?? ["HTTPS", "HTTP"],
                isDefault: !service || service.isDefault === 1,
                enabled: !service || service.enabled === 1,
                comments: service?.comments ?? "",
                options: JSON.stringify(service?.options ?? defaultOptions),
                authPath: service?.authPath ?? "/authentication",
                authCompletedUrlValidation: service?.authCompletedUrlValidation ?? "",
                authCompletedUrl: service?.authCompletedUrl ?? "",
                authCompletedPageContent: service?.authCompletedPageContent ?? "",
                authApps: service?.authApps ?? [authAppNewItem],
            },
        };

        const response = await this.dialogManager.showDialog(request, tabTitle);
        if (!response || response.closure !== DialogResponseClosure.Accept) {
            return;
        }

        if (response.data) {
            const urlContextRoot = response.data.servicePath as string;
            const protocols = response.data.protocols as string[];
            const hostName = response.data.hostName as string;
            const comments = response.data.comments as string;
            const isDefault = response.data.isDefault as boolean;
            const enabled = response.data.enabled as boolean;
            const options = response.data.options as string;
            const authPath = response.data.authPath as string;
            const authCompletedUrl = response.data.authCompletedUrl as string;
            const authCompletedUrlValidation = response.data.authCompletedUrlValidation as string;
            const authCompletedPageContent = response.data.authCompletedPageContent as string;

            // Remove entry for <new> item.
            const authApps = (response.data.authApps as IMrsAuthAppData[]).filter((a: IMrsAuthAppData) => {
                return a.id !== 0;
            });

            // Set the authVendorId based on the authVendorName.
            for (const app of authApps) {
                app.authVendorId = authVendors.find((vendor) => {
                    return app.authVendorName === vendor.name;
                })?.id ?? 0;
            }


            if (!service) {
                try {
                    await backend.mrs.addService(urlContextRoot, protocols, hostName ?? "",
                        isDefault, comments, enabled,
                        JSON.parse(options ?? "{}") as IShellDictionary,
                        authPath, authCompletedUrl, authCompletedUrlValidation, authCompletedPageContent,
                        authApps);

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS service has been created.", 5000);
                } catch (error) {
                    void window.showErrorMessage(`Error while adding MySQL REST service: ${String(error)}`);
                }
            } else {
                // Send update request.
                try {
                    await backend.mrs.updateService(service.id, service.urlContextRoot,
                        service.urlHostName, {
                            urlContextRoot,
                            urlProtocol: protocols,
                            urlHostName: hostName,
                            enabled,
                            isDefault,
                            comments,
                            options: JSON.parse(options ?? "{}") as IShellDictionary,
                            authPath,
                            authCompletedUrl,
                            authCompletedUrlValidation,
                            authCompletedPageContent,
                            authApps,
                        },
                    );

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS service has been successfully updated.", 5000);

                } catch (error) {
                    void window.showErrorMessage(`Error while updating MySQL REST service: ${String(error)}`);
                }
            }
        }
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS schema.
     *
     * @param backend The interface for sending the requests.
     * @param schemaName The name of the database schema.
     * @param schema If not assigned then a new schema must be created otherwise this contains the existing values.
     */
    private showMrsSchemaDialog = async (backend: ShellInterfaceSqlEditor, schemaName?: string,
        schema?: IMrsSchemaData): Promise<void> => {

        try {
            const services = await backend.mrs.listServices();
            const title = schema
                ? "Adjust the MySQL REST Schema Configuration"
                : "Enter Configuration Values for the New MySQL REST Schema";

            const request = {
                id: "mrsSchemaDialog",
                type: DialogType.MrsSchema,
                title,
                parameters: { services },
                values: {
                    serviceId: schema?.serviceId,
                    name: schema?.name ?? schemaName,
                    requestPath: schema?.requestPath ?? `/${schemaName ?? ""}`,
                    requiresAuth: schema?.requiresAuth === 1,
                    enabled: !schema || schema.enabled === 1,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                    options: JSON.stringify(schema?.options ?? {}),
                },
            };

            const response = await this.dialogManager.showDialog(request, title);
            // The request was not sent at all (e.g. there was already one running).
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                return;
            }

            if (response.data) {
                const serviceId = response.data.serviceId as number;
                const name = response.data.name as string;
                const requestPath = response.data.requestPath as string;
                const requiresAuth = response.data.requiresAuth as boolean;
                const itemsPerPage = response.data.itemsPerPage as number;
                const comments = response.data.comments as string;
                const enabled = response.data.enabled as boolean;
                const options = response.data.options as string;

                if (!schema) {
                    try {
                        await backend.mrs.addSchema(
                            serviceId, name, requestPath, requiresAuth,
                            itemsPerPage, comments, JSON.parse(options ?? "{}") as IShellDictionary);

                        void commands.executeCommand("msg.refreshConnections");
                        showMessageWithTimeout(
                            "The MRS schema has been added successfully.", 5000);
                    } catch (error) {
                        void window.showErrorMessage(`Error while adding MRS schema: ` +
                            `${String(error) ?? "<unknown>"}`);
                    }
                } else {
                    try {
                        await backend.mrs.updateSchema(schema.id, name, requestPath,
                            requiresAuth, enabled, itemsPerPage, comments,
                            JSON.parse(options ?? "{}") as IShellDictionary);

                        void commands.executeCommand("msg.refreshConnections");
                        showMessageWithTimeout(
                            "The MRS schema has been updated successfully.", 5000);
                    } catch (error) {
                        void window.showErrorMessage(`Error while updating MRS schema: ` +
                            `${String(error) ?? "<unknown>"}`);
                    }
                }
            }
        } catch (error) {
            void window.showErrorMessage(`Error while listing MySQL REST services: ` +
                `${String(error) ?? "<unknown>"}`);
        }
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS schema.
     *
     * @param backend The interface for sending the requests.
     * @param dbObject The DbObject to create or to edit.
     * @param createObject Whether a new DbObject should be created.
     * @param schemaName The name of the DbObject's schema, needed when creating a new DbObject
     */
    private showMrsDbObjectDialog = async (backend: ShellInterfaceSqlEditor, dbObject: IMrsDbObjectData,
        createObject: boolean, schemaName?: string): Promise<void> => {

        if (createObject && schemaName === undefined) {
            void window.showErrorMessage("When creating a new DB Object the schema name must be valid.");

            return;
        }

        const services = await backend.mrs.listServices();
        const schemas = await backend.mrs.listSchemas(dbObject.serviceId);
        const rowOwnershipFields = await backend.mrs.getDbObjectRowOwnershipFields(dbObject.requestPath, dbObject.name,
            dbObject.id, dbObject.dbSchemaId, schemaName, dbObject.objectType);

        const title = dbObject
            ? "Adjust the MySQL REST Object Configuration"
            : "Enter Configuration Values for the New MySQL REST Object";
        const parameterNewItem: IMrsDbObjectParameterData = {
            id: 0,
            dbObjectId: dbObject.id,
            position: 0,
            name: "<new>",
            bindColumnName: "",
            datatype: "STRING",
            mode: "IN",
            comments: "",
        };

        if (dbObject.id && (!dbObject.parameters)) {
            dbObject.parameters = await backend.mrs.getDbObjectParameters(dbObject.requestPath, dbObject.name,
                dbObject.id, dbObject.dbSchemaId, schemaName);

            // Add entry for <new> item.
            dbObject.parameters.push(parameterNewItem);
        }

        const request = {
            id: "mrsDbObjectDialog",
            type: DialogType.MrsDbObject,
            title,
            parameters: { services, schemas, rowOwnershipFields },
            values: {
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
                options: JSON.stringify(dbObject?.options ?? {}),
                authStoredProcedure: dbObject.authStoredProcedure,
                parameters: dbObject.parameters ?? [parameterNewItem],
            },
        };

        const response = await this.dialogManager.showDialog(request, title);
        if (!response || response.closure !== DialogResponseClosure.Accept || !response.data) {
            return;
        }

        const schemaId = response.data.dbSchemaId as number;
        const name = response.data.name as string;
        const requestPath = response.data.requestPath as string;
        const requiresAuth = response.data.requiresAuth as boolean;
        const itemsPerPage = response.data.itemsPerPage as number;
        const comments = response.data.comments as string;
        const enabled = response.data.enabled as boolean;
        const rowUserOwnershipEnforced = response.data.rowUserOwnershipEnforced as boolean;
        const rowUserOwnershipColumn = response.data.rowUserOwnershipColumn as string;
        const objectType = response.data.objectType as string;
        const crudOperations = response.data.crudOperations as string[] ?? ["READ"];
        const crudOperationFormat = response.data.crudOperationFormat as string ?? "FEED";
        const mediaType = response.data.mediaType as string;
        const autoDetectMediaType = response.data.autoDetectMediaType as boolean;
        const authStoredProcedure = response.data.authStoredProcedure as string;
        const options = response.data.options as string;

        // Remove entry for <new> item
        const parameters = (response.data.parameters as IMrsDbObjectParameterData[]).filter(
            (p: IMrsDbObjectParameterData) => {
                return p.id !== 0;
            });

        if (createObject) {
            // Create new DB Object
            try {
                await backend.mrs.addDbObject(name, objectType,
                    false, requestPath, enabled, crudOperations,
                    crudOperationFormat, requiresAuth,
                    rowUserOwnershipEnforced, autoDetectMediaType,
                    rowUserOwnershipColumn,
                    schemaId, undefined, itemsPerPage, comments,
                    mediaType, "",
                    JSON.parse(options ?? "{}") as IShellDictionary,
                    parameters);

                void commands.executeCommand("msg.refreshConnections");
                showMessageWithTimeout(
                    `The MRS Database Object ${name} has been added successfully.`, 5000);
            } catch (error) {
                void window.showErrorMessage(
                    `The MRS Database Object ${name} could not be created. ${String(error)}`);
            }
        } else {
            // Update existing DB Object
            try {
                await backend.mrs.updateDbObject(
                    dbObject.id, dbObject.name,
                    requiresAuth,
                    rowUserOwnershipEnforced,
                    autoDetectMediaType,
                    name,
                    requestPath,
                    enabled,
                    rowUserOwnershipColumn,
                    schemaId,
                    itemsPerPage,
                    comments,
                    mediaType,
                    authStoredProcedure,
                    crudOperations,
                    crudOperationFormat,
                    JSON.parse(options ?? "{}") as IShellDictionary,
                    parameters);

                void commands.executeCommand("msg.refreshConnections");
                showMessageWithTimeout(
                    `The MRS Database Object ${name} has been updated successfully.`, 5000);
            } catch (error) {
                void window.showErrorMessage(
                    `The MRS Database Object ${name} could not be updated. ${String(error)}`);
            }

        }
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS content set.
     *
     * @param backend The interface for sending the requests.
     * @param directory The directory to upload as content set
     * @param contentSet If not assigned then a new schema must be created otherwise this contains the existing values.
     */
    private showMrsContentSetDialog = async (backend: ShellInterfaceSqlEditor, directory?: Uri,
        contentSet?: IMrsContentSetData): Promise<void> => {

        try {
            const services = await backend.mrs.listServices();
            const title = contentSet
                ? "Adjust the MRS Static Content Set Configuration"
                : "Enter Configuration Values for the New MRS Static Content Set";

            let requestPath = contentSet?.requestPath;
            if (!requestPath) {
                if (directory) {
                    const getOneBeforeLastFolder = (dir: Uri) => {
                        const lastSlash = dir.path.lastIndexOf("/");

                        return dir.fsPath.substring(dir.path.substring(0, lastSlash).lastIndexOf("/"), lastSlash);
                    };

                    // If the given directory path ends with common build folder names, pick the folder before
                    if (directory.path.endsWith("/build") || directory.path.endsWith("/output") ||
                        directory.path.endsWith("/out") || directory.path.endsWith("/web")) {
                        requestPath = getOneBeforeLastFolder(directory);
                    } else {
                        requestPath = directory.fsPath.substring(directory.path.lastIndexOf("/"));
                    }
                } else {
                    requestPath = "/content";
                }
            }

            const request = {
                id: "mrsContentSetDialog",
                type: DialogType.MrsContentSet,
                title,
                parameters: { services, backend },
                values: {
                    directory: directory?.fsPath,
                    serviceId: contentSet?.serviceId,
                    requestPath: contentSet?.requestPath
                        ?? requestPath,
                    requiresAuth: contentSet?.requiresAuth === 1,
                    enabled: !contentSet || contentSet.enabled === 1,
                    comments: contentSet?.comments ?? "",
                    options: JSON.stringify(contentSet?.options ?? {}),
                },
            };

            const response = await this.dialogManager.showDialog(request, title);
            // The request was not sent at all (e.g. there was already one running).
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                return;
            }

            if (response.data) {
                const serviceId = response.data.serviceId as number;
                const requestPath = response.data.requestPath as string;
                const requiresAuth = response.data.requiresAuth as boolean;
                const comments = response.data.comments as string;
                const enabled = response.data.enabled as boolean;
                const options = response.data.options as string;
                const directory = response.data.directory as string;


                let requestPathValid = false;
                // Check if the request path is valid for this service and does not overlap with other services
                try {
                    requestPathValid = await backend.mrs.getServiceRequestPathAvailability(serviceId, requestPath);
                    if (!requestPathValid) {
                        // Check if the request path is taken by another content set
                        const existingContentSets = await backend.mrs.listContentSets(serviceId, requestPath);
                        if (existingContentSets.length > 0) {
                            const answer = await window.showInformationMessage(
                                `The request path ${requestPath} is already used by another ` +
                                "static content set. Do you want to replace the existing one?", "Yes", "No");

                            if (answer === "Yes") {
                                requestPathValid = true;
                            } else {
                                showMessageWithTimeout("Cancelled the upload.");
                            }
                        } else {
                            void window.showErrorMessage(
                                `The request path ${requestPath} is already used on this service.`);
                        }
                    }
                } catch (error) {
                    void window.showErrorMessage(`Error while checking the MRS content set request path: ` +
                        `${String(error) ?? "<unknown>"}`);
                }

                if (requestPathValid) {
                    if (!contentSet) {
                        const statusbarItem = window.createStatusBarItem();
                        try {
                            statusbarItem.text = `$(loading~spin) Starting to load static content set ...`;
                            statusbarItem.show();

                            const contentSet = await backend.mrs.addContentSet(
                                directory, requestPath,
                                requiresAuth, serviceId, comments,
                                JSON.parse(options ?? "{}") as IShellDictionary, enabled, true, (message) => {
                                    statusbarItem.text = "$(loading~spin) " + message;
                                });

                            statusbarItem.hide();

                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(
                                "The MRS static content set has been added successfully. " +
                                `${contentSet.numberOfFilesUploaded ?? ""} file` +
                                `${contentSet.numberOfFilesUploaded ?? 2 > 1 ? "s" : ""} have been uploaded`);
                        } catch (error) {
                            void window.showErrorMessage(`Error while adding MRS content set: ` +
                                `${String(error) ?? "<unknown>"}`);
                        } finally {
                            statusbarItem.hide();
                        }
                    } else {
                        try {
                            // Todo
                        } catch (error) {
                            void window.showErrorMessage(`Error while updating MRS content set: ` +
                                `${String(error) ?? "<unknown>"}`);
                        }
                    }
                }
            }
        } catch (error) {
            void window.showErrorMessage(`Error while listing MySQL REST services: ` +
                `${String(error) ?? "<unknown>"}`);
        }
    };
}
