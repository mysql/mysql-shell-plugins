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

import {
    commands, ExtensionContext, window, workspace, Uri, TextDocument, Range, Selection, languages,
    WorkspaceEdit,
} from "vscode";

import { homedir } from "os";
import { existsSync } from "fs";

import { ICommErrorEvent, ICommOciBastionEvent, ICommOciSessionResultEvent } from "../../frontend/src/communication";
import { IDispatchEvent, EventType } from "../../frontend/src/supplement/Dispatch";
import { ShellInterfaceShellSession } from "../../frontend/src/supplement/ShellInterface";
import { taskOutputChannel } from "./extension";

import { ExtensionHost } from "./ExtensionHost";
import { OciTreeDataProvider } from "./tree-providers/OCITreeProvider";
import { OciBastionTreeItem } from "./tree-providers/OCITreeProvider/OciBastionTreeItem";
import { OciCompartmentTreeItem } from "./tree-providers/OCITreeProvider/OciCompartmentTreeItem";
import { OciComputeInstanceTreeItem } from "./tree-providers/OCITreeProvider/OciComputeInstanceTreeItem";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem";
import { OciLoadBalancerTreeItem } from "./tree-providers/OCITreeProvider/OciLoadBalancerTreeItem";
import { OciConfigProfileTreeItem } from "./tree-providers/OCITreeProvider/OciProfileTreeItem";

export class MDSCommandHandler {
    private shellSession = new ShellInterfaceShellSession();

    private ociTreeDataProvider: OciTreeDataProvider;

    public setup = (context: ExtensionContext, host: ExtensionHost): void => {
        // Our tree providers.
        this.ociTreeDataProvider = new OciTreeDataProvider();
        context.subscriptions.push(window.registerTreeDataProvider("msg.oci", this.ociTreeDataProvider));

        // Register extension commands.
        context.subscriptions.push(commands.registerCommand("msg.mds.refreshOciProfiles", () => {
            this.ociTreeDataProvider.refresh();
        }));

        context.subscriptions.push(commands.registerCommand("msg.mds.configureOciProfiles", () => {
            const configFile: Uri = Uri.file(`${homedir()}/.oci/config`);

            // If the ~/.oci/config file does not exist yet, create it and open it
            if (!existsSync(configFile.fsPath)) {
                const workspaceEdit = new WorkspaceEdit();
                void workspaceEdit.createFile(configFile, { ignoreIfExists: true });
                void workspace.applyEdit(workspaceEdit).then(() => {
                    void workspace.openTextDocument(configFile).then((doc: TextDocument) => {
                        void window.showTextDocument(doc, 1, false).then((editor) => {
                            void editor.edit((edit) => {
                                const firstLine = doc.lineAt(0);
                                const lastLine = doc.lineAt(doc.lineCount - 1);
                                const textRange = new Range(firstLine.range.start, lastLine.range.end);
                                // cSpell:ignore devguidesetupprereq
                                edit.replace(textRange,
                                    ";To add a new OCI Profile, please follow these instructions.\n" +
                                    ";https://docs.oracle.com/en-us/iaas/Content/API/Concepts/" +
                                    "devguidesetupprereq.htm.\n" +
                                    ";Then paste your OCI Config here, replacing these lines and save.\n" +
                                    ";Click the Reload icon in the ORACLE CLOUD INFRASTRUCTURE View.");
                            }).then(() => {
                                const position = editor.selection.start;
                                editor.selection = new Selection(position, position);
                            });
                        });
                    });
                });
            } else {
                // If the ~/.oci/config file exists already, just open it
                void workspace.openTextDocument(configFile).then((doc: TextDocument) => {
                    void window.showTextDocument(doc, 1, false);
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mds.createRouterEndpoint",
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

                            void host.addNewShellTask("Create new Router Endpoint", shellArgs).then(() => {
                                void commands.executeCommand("msg.mds.refreshOciProfiles");
                            });
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getProfileInfo",
            (item?: OciConfigProfileTreeItem) => {
                if (item && item.profile.profile) {
                    this.showNewJsonDocument(
                        `${item.profile.profile.toString()} Info.json`,
                        JSON.stringify(item.profile, null, 4));
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.setDefaultProfile",
            (item?: OciConfigProfileTreeItem) => {
                if (item && item.profile.profile) {
                    window.setStatusBarMessage(`Setting current config profile to ${item.profile.profile} ...`, 10000);
                    this.shellSession.mds.setDefaultConfigProfile(item.profile.profile)
                        .then((event: IDispatchEvent) => {
                            if (event.eventType === EventType.FinalResponse) {
                                void commands.executeCommand("msg.mds.refreshOciProfiles");
                                window.setStatusBarMessage(`Default config profile set to ${item.profile.profile}.`,
                                    5000);
                            }
                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while setting default config profile: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getCompartmentInfo",
            (item?: OciCompartmentTreeItem) => {
                if (item && item.compartment.id) {
                    this.showNewJsonDocument(
                        `${item.compartment.name.toString()} Info.json`,
                        JSON.stringify(item.compartment, null, 4));
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.setCurrentCompartment",
            (item?: OciCompartmentTreeItem) => {
                if (item && item.compartment.id) {
                    window.setStatusBarMessage(`Setting current compartment to ${item.compartment.name} ...`, 10000);
                    this.shellSession.mds.setCurrentCompartment({
                        compartmentId: item.compartment.id,
                        configProfile: item.profile.profile,
                        interactive: false,
                        raiseExceptions: true,
                    }).then((event: IDispatchEvent) => {
                        if (event.eventType === EventType.FinalResponse) {
                            void commands.executeCommand("msg.mds.refreshOciProfiles");
                            window.setStatusBarMessage(`Current compartment set to ${item.compartment.name}.`, 5000);
                        }
                    }).catch((errorEvent: ICommErrorEvent): void => {
                        void window.showErrorMessage(`Error while setting current compartment: ` +
                            `${errorEvent.message ?? "<unknown>"}`);
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getDbSystemInfo",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    this.shellSession.mds.getMdsMySQLDbSystem(item.profile.profile, item.dbSystem.id)
                        .then((event: ICommOciBastionEvent) => {
                            if (event.eventType === EventType.FinalResponse) {
                                this.showNewJsonDocument(
                                    `${item.dbSystem.displayName ?? "<unknown>"} Info.json`,
                                    JSON.stringify(event.data?.result, null, 4));
                            }
                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while fetching the DB System data: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.startDbSystem",
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

                    void host.addNewShellTask("Start DB System", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });

                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.stopDbSystem",
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

                    void host.addNewShellTask("Stop DB System", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.restartDbSystem",
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

                    void host.addNewShellTask("Restart DB System", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.deleteDbSystem",
            (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "delete",
                        "db-system",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    void host.addNewShellTask("Delete DB System", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getComputeInstance",
            (item?: OciComputeInstanceTreeItem) => {
                if (item && item.compute.id) {
                    this.showNewJsonDocument(
                        `${item.compute.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.compute, null, 4));
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getBastion",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    this.shellSession.mds.getMdsBastion(item.profile.profile, item.bastion.id)
                        .then((event: ICommOciBastionEvent) => {
                            if (event.eventType === EventType.FinalResponse) {
                                this.showNewJsonDocument(
                                    `${item.bastion.name ?? "<unknown>"} Info.json`,
                                    JSON.stringify(event.data?.result, null, 4));
                            }
                        }).catch((errorEvent: ICommErrorEvent): void => {
                            void window.showErrorMessage(`Error while fetching the bastion data: ` +
                                `${errorEvent.message ?? "<unknown>"}`);
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.getLoadBalancer",
            (item?: OciLoadBalancerTreeItem) => {
                if (item && item.loadBalancer) {
                    this.showNewJsonDocument(
                        `${item.loadBalancer.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.loadBalancer, null, 4));
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showTaskOutput", () => {
            taskOutputChannel.show();
        }));

        context.subscriptions.push(commands.registerCommand("msg.mds.deleteBastion",
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

                    void host.addNewShellTask("Delete Bastion", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.setCurrentBastion",
            (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    window.setStatusBarMessage(`Setting current bastion to ${item.bastion.name} ...`, 10000);
                    this.shellSession.mds.setCurrentBastion({
                        bastionId: item.bastion.id,
                        configProfile: item.profile.profile,
                        interactive: false,
                        raiseExceptions: true,
                    }).then((event: IDispatchEvent) => {
                        if (event.eventType === EventType.FinalResponse) {
                            void commands.executeCommand("msg.mds.refreshOciProfiles");
                            window.setStatusBarMessage(`Current compartment set to ${item.bastion.name}.`, 5000);
                        }
                    }).catch((errorEvent: ICommErrorEvent): void => {
                        void window.showErrorMessage(`Error while setting current bastion: ` +
                            `${errorEvent.message ?? "<unknown>"}`);
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.refreshOnBastionActiveState",
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

                    void host.addNewShellTask("Refresh Bastion", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.deleteComputeInstance",
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

                    void host.addNewShellTask("Delete Compute Instance", shellArgs).then(() => {
                        void commands.executeCommand("msg.mds.refreshOciProfiles");
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.openBastionSshSession",
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

    };

    /**
     * Opens a new text document on a vscode tab, with the given text.
     *
     * @param title The title of the tab.
     * @param text The text to show, interpreted as JSON.
     */
    private showNewJsonDocument(title: string, text: string) {
        const path = `${homedir()}/${title}`;
        const scheme = existsSync(path) ? "file" : "untitled";
        const uri = Uri.parse(`${scheme}:${path}`);

        workspace.openTextDocument(uri).then((doc: TextDocument) => {
            void window.showTextDocument(doc, 1, false).then((editor) => {
                void editor.edit((edit) => {
                    const firstLine = doc.lineAt(0);
                    const lastLine = doc.lineAt(doc.lineCount - 1);
                    const textRange = new Range(firstLine.range.start, lastLine.range.end);
                    edit.replace(textRange, text);
                }).then(() => {
                    const position = editor.selection.start;
                    editor.selection = new Selection(position, position);
                });
                void languages.setTextDocumentLanguage(doc, "json");
            });
        }, (error) => {
            void window.showErrorMessage(`Error while showing the document: ${String(error)}`);
        });
    }

}
