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

import { commands, ExtensionContext, window } from "vscode";
import { DialogResponseClosure, DialogType, IDialogResponse } from "../../frontend/src/app-logic/Types";
import {
    ICommErrorEvent, ICommMrsServiceEvent, ICommSimpleResultEvent, IMrsSchemaData, IMrsServiceData,
} from "../../frontend/src/communication";
import { EventType } from "../../frontend/src/supplement/Dispatch";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface";

import { ExtensionHost } from "./ExtensionHost";
import { MrsSchemaTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsServiceTreeItem";
import { MrsTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { SchemaTableMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaTableMySQLTreeItem";
import { DialogWebviewManager } from "./web-views/DialogWebviewProvider";

export class MRSCommandHandler {
    private dialogManager = new DialogWebviewManager();

    public setup = (context: ExtensionContext, host: ExtensionHost): void => {
        context.subscriptions.push(commands.registerCommand("msg.mrs.configureMySQLRestService",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    const shellArgs = [
                        "--",
                        "mrs",
                        "configure",
                    ];

                    void host.addNewShellTask("Configure MySQL REST Service", shellArgs, item.entry.details.id)
                        .then(() => {
                            void commands.executeCommand("msg.refreshConnections");
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addService", (item?: MrsTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editService", (item?: MrsServiceTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend, item.value);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteService",
            (item?: MrsServiceTreeItem) => {
                if (item) {
                    void window.showInformationMessage(
                        `Are you sure the MRS service ${item.value.urlContextRoot} should be deleted?`, "Yes", "No",
                    ).then((answer) => {
                        if (answer === "Yes") {
                            item.entry.backend?.mrs.deleteService(item.value.id)
                                .then((deleteServiceEvent: ICommSimpleResultEvent) => {
                                    switch (deleteServiceEvent.eventType) {
                                        case EventType.DataResponse:
                                        case EventType.FinalResponse: {
                                            void commands.executeCommand("msg.refreshConnections");
                                            void window.showInformationMessage(
                                                "The MRS service has been deleted successfully.");

                                            break;
                                        }

                                        default: {
                                            break;
                                        }
                                    }
                                })
                                .catch((errorEvent: ICommErrorEvent): void => {
                                    void window.showErrorMessage(`Error adding the MRS service: ` +
                                        `${errorEvent.message ?? "<unknown>"}`);
                                });
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.setDefaultService",
            (item?: MrsServiceTreeItem) => {
                if (item) {
                    item.entry.backend?.mrs.setDefaultService(item.value.id)
                        .then((setDefaultServiceEvent: ICommSimpleResultEvent) => {
                            switch (setDefaultServiceEvent.eventType) {
                                case EventType.DataResponse:
                                case EventType.FinalResponse: {
                                    void commands.executeCommand("msg.refreshConnections");
                                    void window.showInformationMessage(
                                        "The MRS service has been set as the new default service.");

                                    break;
                                }

                                default: {
                                    break;
                                }
                            }

                        })
                        .catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error setting the default MRS service: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteSchema",
            (item?: MrsSchemaTreeItem) => {
                if (item) {
                    void window.showInformationMessage(
                        `Are you sure the MRS schema ${item.value.name} should be deleted?`, "Yes", "No",
                    ).then((answer) => {
                        if (answer === "Yes") {
                            item.entry.backend?.mrs.deleteSchema(item.value.id, item.value.serviceId)
                                .then((deleteServiceEvent: ICommSimpleResultEvent) => {
                                    switch (deleteServiceEvent.eventType) {
                                        case EventType.DataResponse:
                                        case EventType.FinalResponse: {
                                            void commands.executeCommand("msg.refreshConnections");
                                            void window.showInformationMessage(
                                                "The MRS schema has been deleted successfully.");

                                            break;
                                        }

                                        default: {
                                            break;
                                        }
                                    }

                                }).catch((errorEvent: ICommErrorEvent): void => {
                                    void window.showErrorMessage(`Error removing an MRS schema: ` +
                                        `${errorEvent.message ?? "<unknown>"}`);
                                });
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editSchema", (item?: MrsSchemaTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.value.name, item.value);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addSchema", (item?: SchemaMySQLTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.schema);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addTable",
            (item?: SchemaTableMySQLTreeItem) => {
                if (item) {
                    void window.showInputBox({
                        title: `Please enter the request path for this table [/${item.name}]:`,
                        value: `/${item.name}`,
                    }).then((requestPath) => {
                        if (requestPath) {
                            item.entry.backend?.mrs.addDbObject(item.name, "TABLE", item.schema, true, requestPath,
                                ["READ"], "FEED", false, false)
                                .then((addServiceEvent: ICommSimpleResultEvent) => {
                                    switch (addServiceEvent.eventType) {
                                        case EventType.DataResponse:
                                        case EventType.FinalResponse: {
                                            void commands.executeCommand("msg.refreshConnections");
                                            void window.showInformationMessage(
                                                `The Table ${item.name} has been added successfully.`);

                                            break;
                                        }

                                        default: {
                                            break;
                                        }
                                    }

                                }).catch((errorEvent: ICommErrorEvent): void => {
                                    void window.showErrorMessage(`Error adding the Table to the MRS service: ` +
                                        `${errorEvent.message ?? "<unknown>"}`);
                                });
                        }
                    });
                }
            }));
    };

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param service If not assigned then a new service must be created otherwise this contains the existing values.
     */
    private showMrsServiceDialog(backend: ShellInterfaceSqlEditor, service?: IMrsServiceData): void {
        const title = service
            ? "Adjust the MySQL REST Service Configuration"
            : "Enter Configuration Values for the New MySQL REST Service";

        const request = {
            id: "mrsServiceDialog",
            type: DialogType.MrsService,
            title,
            parameters: { protocols: ["HTTPS", "HTTP"] },
            values: {
                serviceName: service?.urlContextRoot ?? "/mrs",
                hostName: service?.urlHostName,
                protocols: service?.urlProtocol ?? "HTTPS,HTTP",
                isDefault: !service || service.isDefault === 1,
                enabled: !service || service.enabled === 1,
                comments: service?.comments ?? "",
            },
        };

        void this.dialogManager.showDialog(request, title).then((response?: IDialogResponse) => {
            // The request was not sent at all (e.g. there was already one running).
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                return;
            }

            if (response.data) {
                const urlContextRoot = response.data.serviceName as string;
                const protocols = (response.data.protocols as string[]).join(",");
                const hostName = response.data.hostName as string;
                const comments = response.data.comments as string;
                const isDefault = response.data.isDefault as boolean;
                const enabled = response.data.enabled as boolean;

                if (!service) {
                    backend.mrs.addService(urlContextRoot, protocols, hostName, isDefault, comments, enabled)
                        .then((addServiceEvent: ICommSimpleResultEvent) => {
                            switch (addServiceEvent.eventType) {
                                case EventType.DataResponse:
                                case EventType.FinalResponse: {
                                    void commands.executeCommand("msg.refreshConnections");
                                    void window.setStatusBarMessage(
                                        "The MRS service has been added successfully.", 5000);

                                    break;
                                }

                                default: {
                                    break;
                                }
                            }

                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while adding MySQL REST service: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                } else {
                    // Send update request.
                    backend.mrs.updateService(
                        service.id, urlContextRoot, hostName)
                        .then((addServiceEvent: ICommSimpleResultEvent) => {
                            switch (addServiceEvent.eventType) {
                                case EventType.DataResponse:
                                case EventType.FinalResponse: {
                                    void commands.executeCommand("msg.refreshConnections");
                                    void window.setStatusBarMessage(
                                        "The MRS service has been successfully updated.", 5000);

                                    break;
                                }

                                default: {
                                    break;
                                }
                            }

                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while adding MySQL REST service: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }
        });
    }

    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param schemaName The name of the database schema.
     * @param schema If not assigned then a new schema must be created otherwise this contains the existing values.
     */
    private showMrsSchemaDialog(backend: ShellInterfaceSqlEditor, schemaName?: string, schema?: IMrsSchemaData): void {
        backend.mrs.listServices().then((event: ICommMrsServiceEvent) => {
            const title = schema
                ? "Adjust the MySQL REST Schema Configuration"
                : "Enter Configuration Values for the New MySQL REST Schema";

            const request = {
                id: "mrsSchemaDialog",
                type: DialogType.MrsSchema,
                title,
                parameters: { services: event.data?.result },
                values: {
                    serviceId: schema?.serviceId,
                    name: schema?.name ?? schemaName,
                    requestPath: schema?.requestPath ?? `/${schemaName ?? ""}`,
                    requiresAuth: schema?.requiresAuth === 1 || schema?.requiresAuth !== undefined,
                    enabled: !schema || schema.enabled === 1,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                },
            };

            void this.dialogManager.showDialog(request, title).then((response?: IDialogResponse) => {
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

                    if (!schema) {
                        backend.mrs.addSchema(name, requestPath, requiresAuth, serviceId, itemsPerPage, comments)
                            .then((addSchemaEvent: ICommSimpleResultEvent) => {
                                switch (addSchemaEvent.eventType) {
                                    case EventType.FinalResponse: {
                                        void commands.executeCommand("msg.refreshConnections");
                                        void window.setStatusBarMessage(
                                            "The MRS schema has been added successfully.", 5000);

                                        break;
                                    }

                                    default: {
                                        break;
                                    }
                                }

                            }).catch((errorEvent: ICommErrorEvent): void => {
                                void window.showErrorMessage(`Error while adding MRS schema: ` +
                                    `${errorEvent.message ?? "<unknown>"}`);
                            });
                    } else {
                        // Send update request.
                        backend.mrs.updateSchema(
                            schema.id, name, requestPath, requiresAuth, serviceId)
                            .then((addSchemaEvent: ICommSimpleResultEvent) => {
                                switch (addSchemaEvent.eventType) {
                                    case EventType.DataResponse:
                                    case EventType.FinalResponse: {
                                        void commands.executeCommand("msg.refreshConnections");
                                        void window.setStatusBarMessage(
                                            "The MRS schema has been successfully updated.", 5000);

                                        break;
                                    }

                                    default: {
                                        break;
                                    }
                                }

                            }).catch((errorEvent: ICommErrorEvent): void => {
                                void window.showErrorMessage(`Error while updating MRS schema: ` +
                                    `${errorEvent.message ?? "<unknown>"}`);
                            });
                    }
                }
            });
        }).catch((errorEvent: ICommErrorEvent) => {
            void window.showErrorMessage(`Error while listing MySQL REST services: ` +
                `${errorEvent.message ?? "<unknown>"}`);
        });
    }
}
