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

import {
    commands, ExtensionContext, window, workspace, ConfigurationChangeEvent, TextEditor, WorkspaceConfiguration, Uri,
    TextDocument, Position, languages,
} from "vscode";

import { isNil } from "lodash";

import {
    ICommAuthenticationEvent, ICommErrorEvent, ICommListDataCategoriesEvent, ICommProfileEvent, ICommShellProfile,
    ICommSimpleResultEvent, ICommWebSessionEvent, IMrsServiceData, ICommOciSessionResultEvent,
    IShellModuleDataCategoriesEntry, IMrsSchemaData, ICommMrsServiceEvent,
} from "../../frontend/src/communication";

import { eventFilterNoRequests, EventType, ListenerEntry } from "../../frontend/src/supplement/Dispatch";
import { ShellInterface, ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface";
import { webSession } from "../../frontend/src/supplement/WebSession";
import { DBEditorModuleId } from "../../frontend/src/modules/ModuleInfo";
import { ISettingCategory, settingCategories } from "../../frontend/src/supplement/Settings/SettingsRegistry";
import { settings } from "../../frontend/src/supplement/Settings/Settings";
import { ShellTask } from "../../frontend/src/shell-tasks/ShellTask";
import { DialogType, IDialogResponse } from "../../frontend/src/app-logic/Types";

import { ConnectionsTreeDataProvider } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider";


import { OciTreeDataProvider } from "./tree-providers/OCITreeProvider/OciTreeProvider";
import { ShellConsolesTreeDataProvider } from "./tree-providers/ShellTreeProvider/ShellConsolesTreeProvider";
import { ScriptsTreeDataProvider } from "./tree-providers/ScriptsTreeProvider";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { MrsTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsTreeItem";
import { ShellTasksTreeDataProvider } from "./tree-providers/ShellTreeProvider/ShellTasksTreeProvider";
import { taskOutputChannel } from "./extension";
import { MrsServiceTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsServiceTreeItem";
import { SchemaTableMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaTableMySQLTreeItem";
import { OciBastionTreeItem } from "./tree-providers/OCITreeProvider/OciBastionTreeItem";
import { MrsSchemaTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsSchemaTreeItem";
import { ConnectionMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionMySQLTreeItem";
import { OciComputeInstanceTreeItem } from "./tree-providers/OCITreeProvider/OciComputeInstanceItem";
import { OciLoadBalancerTreeItem } from "./tree-providers/OCITreeProvider/OciLoadBalancerTreeItem";
import { OciCompartmentTreeItem } from "./tree-providers/OCITreeProvider/OciCompartmentTreeItem";
import { OciConfigProfileTreeItem } from "./tree-providers/OCITreeProvider/OciProfileTreeItem";


import { CodeBlocks } from "./CodeBlocks";
import { DialogWebviewManager } from "./web-views/DialogWebviewProvider";
import { DbEditorCommandHandler } from "./DbEditorCommandHandler";
import { ShellConsoleCommandHandler } from "./ShellConsoleCommandHandler";

// This class manages some extension wide things like authentication handling etc.
export class ExtensionHost {
    private activeProfile?: ICommShellProfile;

    private dialogManager = new DialogWebviewManager();
    private dbEditorCommandHandler = new DbEditorCommandHandler();
    private shellConsoleCommandHandler = new ShellConsoleCommandHandler();

    // Tree data providers for the extension's sidebar.
    private connectionsProvider: ConnectionsTreeDataProvider;
    private ociTreeDataProvider: OciTreeDataProvider;
    private scriptsTreeDataProvider: ScriptsTreeDataProvider;
    private consoleTreeDataProvider: ShellConsolesTreeDataProvider;
    private shellTasksTreeDataProvider: ShellTasksTreeDataProvider;

    // List of shell tasks
    private shellTasks: ShellTask[] = [];

    // A mapping from data type captions to data type ids.
    private moduleDataCategories = new Map<string, IShellModuleDataCategoriesEntry>();

    // Listeners.
    private serverResponse: ListenerEntry;
    private webSession: ListenerEntry;

    private codeBlocks = new CodeBlocks();

    public constructor(private context: ExtensionContext) {
        this.setupEnvironment();

        this.serverResponse = ListenerEntry.createByClass("serverResponse", { persistent: true });
        this.serverResponse.catch((errorEvent: ICommErrorEvent) => {
            void window.showErrorMessage("Backend Error: " + (errorEvent.message ?? "Unknown error"));
        });

        this.webSession = ListenerEntry.createByClass("webSession",
            { filters: [eventFilterNoRequests], persistent: true });
        this.webSession.then((event: ICommWebSessionEvent) => {
            if (event.data?.sessionUuid) {
                webSession.sessionId = event.data.sessionUuid;
                webSession.localUserMode = event.data.localUserMode;
            }

            if (webSession.userName === "") {
                if (event.data?.localUserMode) {
                    ShellInterface.users.authenticate("LocalAdministrator", "")
                        .then((authEvent: ICommAuthenticationEvent) => {
                            this.onAuthentication(authEvent);
                        });
                }
            } else if (event.data) {
                webSession.loadProfile(event.data.activeProfile);
                this.activeProfile = event.data.activeProfile;
            }
        });
    }

    /**
     * Closes all webview tabs and frees their providers.
     */
    public closeAllTabs(): void {
        this.dbEditorCommandHandler.closeProviders();
        this.shellConsoleCommandHandler.closeProviders();
    }

    /**
     * Prepares all vscode providers for first use.
     */
    private setupEnvironment(): void {
        this.codeBlocks.setup(this.context);
        this.dbEditorCommandHandler.setup(this.context);
        this.shellConsoleCommandHandler.setup(this.context);

        this.context.subscriptions.push(workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("msg")) {
                this.updateProfileSettings();
            }
        }));

        // Our tree providers.
        this.connectionsProvider = new ConnectionsTreeDataProvider();
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.connections", this.connectionsProvider));

        this.ociTreeDataProvider = new OciTreeDataProvider();
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.oci", this.ociTreeDataProvider));

        this.consoleTreeDataProvider = new ShellConsolesTreeDataProvider();
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.consoles", this.consoleTreeDataProvider));

        this.shellTasksTreeDataProvider = new ShellTasksTreeDataProvider(this.shellTasks);
        this.context.subscriptions.push(window.registerTreeDataProvider("msg.shellTasks",
            this.shellTasksTreeDataProvider));

        // The scripts provider needs a module data category id and is created later, when this info is available.

        // Handling of extension commands.
        this.context.subscriptions.push(commands.registerCommand("msg.refreshOciProfiles", () => {
            this.ociTreeDataProvider.refresh();
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.configureMySQLRestService",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    const shellArgs = [
                        "--",
                        "mrs",
                        "configure",
                    ];

                    void this.addNewShellTask(
                        "Configure MySQL REST Service", shellArgs, item.entry.details.id)
                        .then(() => {
                            this.shellTasksTreeDataProvider.refresh();
                            void commands.executeCommand("msg.refreshConnections");
                        });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.addService", (item?: MrsTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend);
            }
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.editService", (item?: MrsServiceTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsServiceDialog(item.entry.backend, item.value);
            }
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteService",
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

                                }).catch((errorEvent: ICommErrorEvent): void => {
                                    void window.showErrorMessage(`Error adding the MRS service: ` +
                                        `${errorEvent.message ?? "<unknown>"}`);
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.setDefaultService",
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

                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error setting the default MRS service: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));


        this.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteSchema",
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

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.editSchema", (item?: MrsSchemaTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.value.name, item.value);
            }
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.addSchema", (item?: SchemaMySQLTreeItem) => {
            if (item && item.entry.backend) {
                this.showMrsSchemaDialog(item.entry.backend, item.schema);
            }
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mrs.addTable",
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

        this.context.subscriptions.push(commands.registerCommand("msg.selectProfile", () => {
            this.selectProfile();
        }));

        this.context.subscriptions.push(commands.registerTextEditorCommand("msg.executeSqlFromEditor",
            (editor: TextEditor) => {
                // Determine first where to execute the SQL.
                const connections = this.connectionsProvider.connections;
                const connectionName = workspace.getConfiguration("msg.editor").get<string>("defaultDbConnection");
                let connectionId = -1;
                if (connectionName) {
                    const connection = connections.find((candidate) => {
                        return candidate.details.caption === connectionName;
                    });

                    if (connection) {
                        connectionId = connection.details.id;
                    }
                }

                if (connectionName && connectionId > -1) {
                    this.codeBlocks.executeSqlFromEditor(editor, connectionName, connectionId);
                } else {
                    // No default connection set. Show a picker.
                    const items = connections.map((connection) => { return connection.details.caption; });
                    void window.showQuickPick(items, {
                        title: "Select a connection for SQL execution",
                        matchOnDescription: true,
                        placeHolder: "Type the name of an existing DB connection",
                    }).then((name) => {
                        const connection = connections.find((candidate) => {
                            return candidate.details.caption === name;
                        });

                        if (connection) {
                            this.codeBlocks.executeSqlFromEditor(editor, connection.details.caption,
                                connection.details.id);
                        }
                    });
                }

            }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDisk",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select an output folder for the dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "dump-schemas",
                                item.schema,
                                "--outputUrl",
                                targetUri[0].fsPath,
                            ];

                            void this.addNewShellTask(`Dump Schema ${item.schema} to Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.dumpSchemaToDiskForMds",
            (item?: SchemaMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select an output folder for the dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "dump-schemas",
                                item.schema,
                                "--outputUrl",
                                targetUri[0].fsPath,
                                "--ocimds",
                                "true",
                                "--compatibility",
                                "create_invisible_pks,force_innodb,skip_invalid_accounts," +
                                "strip_definers,strip_restricted_grants,strip_tablespaces",
                            ];

                            void this.addNewShellTask(`Dump Schema ${item.schema} to Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.loadDumpFromDisk",
            (item?: ConnectionMySQLTreeItem) => {
                if (item) {
                    void window.showOpenDialog({
                        title: "Select a folder that contains a MySQL Shell dump.",
                        openLabel: "Select Dump Folder",
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                    }).then((targetUri) => {
                        if (targetUri && targetUri.length === 1) {
                            const shellArgs = [
                                "--",
                                "util",
                                "load-dump",
                                targetUri[0].fsPath,
                            ];

                            let folderName = "";
                            const m = targetUri[0].fsPath.match(/([^/]*)\/*$/);
                            if (m && m.length > 1) {
                                folderName = m[1] + " ";
                            }

                            void this.addNewShellTask(`Loading Dump ${folderName}from Disk`, shellArgs,
                                item.entry.details.id)
                                .then(() => {
                                    this.shellTasksTreeDataProvider.refresh();
                                    void commands.executeCommand("msg.refreshConnections");
                                });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.createRouterEndpoint",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    void window.showInputBox({
                        title: `Please enter a name for this new MDS Endpoint [${item.name} Endpoint]:`,
                        value: `${item.name} Endpoint`,
                    }).then((endpointName) => {
                        if (endpointName) {
                            const shellArgs: string[] = [
                                "--",
                                "mds",
                                "util",
                                "create-mds-endpoint",
                                `--db_system_id=${item.dbSystem.id.toString()}`,
                                `--config_profile=${item.profile.profile.toString()}`,
                                `--instance_name=${endpointName}`,
                                "--raise_exceptions=true",
                            ];

                            void this.addNewShellTask("Create new Router Endpoint", shellArgs).then(() => {
                                this.shellTasksTreeDataProvider.refresh();
                                void commands.executeCommand("msg.refreshOciProfiles");
                            });
                        }
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getProfileInfo",
            (item?: OciConfigProfileTreeItem) => {
                if (item && item.profile.profile) {
                    this.showNewJsonDocument(
                        `${item.profile.profile.toString()} Info.json`,
                        JSON.stringify(item.profile, null, 4));
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getCompartmentInfo",
            (item?: OciCompartmentTreeItem) => {
                if (item && item.compartment.id) {
                    this.showNewJsonDocument(
                        `${item.compartment.name.toString()} Info.json`,
                        JSON.stringify(item.compartment, null, 4));
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getDbSystemInfo",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    this.showNewJsonDocument(
                        `${item.dbSystem.displayName.toString()} Info.json`,
                        JSON.stringify(item.dbSystem, null, 4));
                    /*const shellArgs: string[] = [
                        "--",
                        "mds",
                        "get",
                        "db-system",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--raise_exceptions=true",
                        "--return_formatted=false",
                    ];

                    void this.addNewShellTask("View DB System Information", shellArgs).then((result) => {
                        if (typeof result === "object") {
                            this.showNewJsonDocument(
                                `${item.dbSystem.displayName.toString()} Info.json`,
                                JSON.stringify(result, null, 4));
                        }

                        this.shellTasksTreeDataProvider.refresh();
                    });*/
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.startDbSystem",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "start",
                        "db-system",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Start DB System", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });

                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.stopDbSystem",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "stop",
                        "db-system",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Stop DB System", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.restartDbSystem",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "restart",
                        "db-system",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Restart DB System", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getComputeInstance",
            (item?: OciComputeInstanceTreeItem) => {
                if (item && item.compute.id) {
                    this.showNewJsonDocument(
                        `${item.compute.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.compute, null, 4));
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getBastion",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    this.showNewJsonDocument(
                        `${item.bastion.name ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.bastion, null, 4));
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.getLoadBalancer",
            (item?: OciLoadBalancerTreeItem) => {
                if (item && item.loadBalancer) {
                    this.showNewJsonDocument(
                        `${item.loadBalancer.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.loadBalancer, null, 4));
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.showTaskOutput", () => {
            taskOutputChannel.show();
        }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.deleteBastion",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "delete",
                        "bastion",
                        `--bastion_id=${item.bastion.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_deletion=true",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Delete Bastion", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.setCurrentBastion",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "set",
                        "current-bastion",
                        `--bastion_id=${item.bastion.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Set Current Bastion", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.refreshOnBastionActiveState",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "get",
                        "bastion",
                        `--bastion_id=${item.bastion.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_state=ACTIVE",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Refresh Bastion", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.deleteComputeInstance",
            (item?: OciComputeInstanceTreeItem) => {
                if (item && item.compute.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "delete",
                        "compute_instance",
                        `--instance_id=${item.compute.id}`,
                        `--config_profile=${item.profile.profile}`,
                        "--await_deletion=true",
                        "--raise_exceptions=true",
                    ];

                    void this.addNewShellTask("Delete Compute Instance", shellArgs).then(() => {
                        this.shellTasksTreeDataProvider.refresh();
                        void commands.executeCommand("msg.refreshOciProfiles");
                    });
                }
            }));

        this.context.subscriptions.push(commands.registerCommand("msg.mds.openBastionSshSession",
            (item?: OciComputeInstanceTreeItem) => {
                if (item && item.shellSession && item.shellSession.mds && item.compute.id) {
                    window.setStatusBarMessage("Opening Bastion Session ...", 10000);
                    item.shellSession.mds.createBastionSession(
                        item.profile.profile, item.compute.id, "MANAGED_SSH", item.compute.compartmentId, true)
                        .then((event: ICommOciSessionResultEvent) => {
                            switch (event.eventType) {
                                case EventType.DataResponse: {
                                    if (event.message) {
                                        window.setStatusBarMessage(event.message/*, 5000*/);
                                    }

                                    break;
                                }

                                case EventType.FinalResponse: {
                                    window.setStatusBarMessage("Bastion Session available, opening Terminal ...", 5000);
                                    const res = event.data?.result;
                                    if (res?.bastionId) {
                                        const terminal = window.createTerminal(`Terminal ${item.name}`);
                                        const sshHost = `${res.id}@host.bastion.` +
                                            `${item.profile.region}.oci.oraclecloud.com`;
                                        const sshTargetIp = res.targetResourceDetails.targetResourcePrivateIpAddress;
                                        if (sshTargetIp) {
                                            const sshTargetPort = res.targetResourceDetails.targetResourcePort;
                                            terminal.sendText(`ssh -o ProxyCommand="ssh -W %h:%p -p 22 ${sshHost}"` +
                                                ` -p ${sshTargetPort} opc@${sshTargetIp}`);
                                            terminal.sendText("clear");
                                            terminal.show();
                                        }
                                    }
                                    break;
                                }

                                default: {
                                    break;
                                }
                            }

                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while creating the bastion session: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));
    }

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
            type: DialogType.MrsService,
            title,
            parameters: { protocols: ["HTTPS", "HTTP"] },
            values: {
                serviceName: service?.urlContextRoot ?? "/mrs",
                protocols: service?.urlProtocol ?? "HTTPS,HTTP",
                isDefault: isNil(service?.isDefault) ? true : service?.isDefault !== 0,
                enabled: service?.enabled === 1 ?? true,
                comments: service?.comments ?? "",
            },
        };

        void this.dialogManager.showDialog(request, title).then((response?: IDialogResponse) => {
            // The request was not sent at all (e.g. there was already one running).
            if (!response || !response.accepted) {
                return;
            }

            if (response.values) {
                const urlContextRoot = response.values.serviceName as string;
                const protocols = (response.values.protocols as string[]).join(",");
                const hostName = response.values.hostName as string;
                const comments = response.values.comments as string;
                const isDefault = response.values.isDefault as boolean;
                const enabled = response.values.enabled as boolean;

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
                type: DialogType.MrsSchema,
                title,
                parameters: { services: event.data?.result },
                values: {
                    serviceId: schema?.serviceId,
                    name: schema?.name ?? schemaName,
                    requestPath: schema?.requestPath ?? `/${schemaName ?? ""}`,
                    requiresAuth: schema?.requiresAuth === 1 ?? false,
                    enabled: schema?.enabled === 1 ?? true,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                },
            };

            void this.dialogManager.showDialog(request, title).then((response?: IDialogResponse) => {
                // The request was not sent at all (e.g. there was already one running).
                if (!response || !response.accepted) {
                    return;
                }

                if (response.values) {
                    const serviceId = response.values.serviceId as number;
                    const name = response.values.name as string;
                    const requestPath = response.values.requestPath as string;
                    const requiresAuth = response.values.requiresAuth as boolean;
                    const itemsPerPage = response.values.itemsPerPage as number;
                    const comments = response.values.comments as string;

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

    private addNewShellTask(caption: string, shellArgs: string[], dbConnectionId?: number): Promise<unknown> {
        const task = new ShellTask(caption, this.taskPromptCallback, this.taskMessageCallback);
        this.shellTasks.push(task);
        this.shellTasksTreeDataProvider.refresh();

        taskOutputChannel.show();

        return task.runTask(shellArgs, dbConnectionId);
    }

    private onAuthentication(event: ICommAuthenticationEvent): void {
        this.activeProfile = event.data?.activeProfile;
        ShellInterface.modules.listModuleDataCategories(DBEditorModuleId)
            .then((list: ICommListDataCategoriesEvent) => {
                list.data?.result.forEach((row) => {
                    this.moduleDataCategories.set(row.name, row);
                });

                if (!this.scriptsTreeDataProvider) {
                    const category = this.moduleDataCategories.get("Script");
                    if (category) {
                        this.scriptsTreeDataProvider = new ScriptsTreeDataProvider(category.id);
                        this.context.subscriptions.push(window.registerTreeDataProvider("msg.scripts",
                            this.scriptsTreeDataProvider));
                    }
                } else {
                    this.scriptsTreeDataProvider.refresh();
                }

                // Refresh relevant tree providers.
                this.connectionsProvider.refresh();
                this.ociTreeDataProvider.refresh();
                this.consoleTreeDataProvider.refresh([]);
            });

    }

    /**
     * Triggered when the user changed a vscode setting. Updates the current profile.
     */
    private updateProfileSettings(): void {

        const updateFromChildren = (children?: ISettingCategory[], configuration?: WorkspaceConfiguration): void => {
            children?.forEach((child) => {
                child.values.forEach((value) => {
                    const configValue = configuration?.get(`${child.key}.${value.key}`);
                    if (!isNil(configValue)) {
                        settings.set(value.id, configValue);
                    }
                });

                updateFromChildren(child.children, configuration);
            });
        };

        const categories = settingCategories.children;
        if (categories) {
            categories.forEach((category) => {
                const configuration = workspace.getConfiguration(`msg.${category.key}`);
                category.values.forEach((value) => {
                    const configValue = configuration.get(value.key);
                    if (!isNil(configValue)) {
                        settings.set(value.id, configValue);
                    }
                });

                updateFromChildren(category.children, configuration);
            });
        }

        settings.saveSettings();
    }

    private selectProfile(): void {
        if (this.activeProfile) {
            ShellInterface.users.listProfiles(this.activeProfile.userId).then((event: ICommProfileEvent) => {
                if (event.data?.rows) {
                    const items = event.data.rows.map((value) => {
                        return value.name;
                    });

                    void window.showQuickPick(items, {
                        title: "Activate a Profile",
                        matchOnDescription: true,
                        placeHolder: "Type the name of an existing profile",
                    }).then((name) => {
                        if (name && event.data?.rows) {
                            const row = event.data.rows.find((candidate) => { return candidate.name === name; });
                            if (row) {
                                ShellInterface.users.setCurrentProfile(row.id).then(() => {
                                    window.setStatusBarMessage("Profile set successfully", 5000);
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    private taskPromptCallback = (text: string, isPassword: boolean): Promise<string | undefined> => {
        return new Promise((resolve) => {
            // Check if the text ends with "[yes/NO/...]: "
            const match = text.match(/\[([\w\d\s/]+)\]:\s*?$/);
            if (match && match.length === 2 && match.index) {
                const buttons: string[] = match[1].split("/");
                // Ensure first char is uppercase
                for (let i = 0; i < buttons.length; i++) {
                    buttons[i] = buttons[i].charAt(0).toUpperCase() + buttons[i].slice(1);
                }
                void window.showInformationMessage(
                    text.substr(0, match.index - 1) + "?", ...buttons)
                    .then((value) => {
                        resolve(value);
                    });

            } else {
                void window.showInputBox({ title: text, password: isPassword }).then((value) => {
                    resolve(value);
                });
            }
        });
    };

    private taskMessageCallback = (message: unknown): void => {
        if (typeof message === "string") {
            taskOutputChannel.append(message);
        } else {
            taskOutputChannel.append(JSON.stringify(message));
        }
    };

    private showNewJsonDocument(title: string, text: string) {
        const setting: Uri = Uri.parse(`untitled:~/${title}`);

        workspace.openTextDocument(setting).then((doc: TextDocument) => {
            void window.showTextDocument(doc, 1, false).then((editor) => {
                void editor.edit((edit) => {
                    edit.insert(new Position(0, 0), text);
                });
                void languages.setTextDocumentLanguage(doc, "json");
            });
        }, (error) => {
            console.error(error);
            debugger;
        });
    }

}
