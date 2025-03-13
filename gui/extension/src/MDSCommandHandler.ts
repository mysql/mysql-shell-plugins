/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { commands, languages, Range, Selection, TextDocument, Uri, window, workspace, WorkspaceEdit } from "vscode";

import { existsSync } from "fs";
import { homedir } from "os";

import { models } from "oci-mysql";

import { ICompartment, IPortForwardingSessionTargetResourceDetails } from "../../frontend/src/communication/index.js";
import { taskOutputChannel } from "./extension.js";

import { ExtensionHost } from "./ExtensionHost.js";
import { OciTreeDataProvider } from "./tree-providers/OCITreeProvider/index.js";
import { OciBastionTreeItem } from "./tree-providers/OCITreeProvider/OciBastionTreeItem.js";
import { OciCompartmentTreeItem } from "./tree-providers/OCITreeProvider/OciCompartmentTreeItem.js";
import { OciComputeInstanceTreeItem } from "./tree-providers/OCITreeProvider/OciComputeInstanceTreeItem.js";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem.js";
import { OciLoadBalancerTreeItem } from "./tree-providers/OCITreeProvider/OciLoadBalancerTreeItem.js";
import { OciConfigProfileTreeItem } from "./tree-providers/OCITreeProvider/OciProfileTreeItem.js";

import { DialogResponseClosure, IDictionary, MdsDialogType } from "../../frontend/src/app-logic/general-types.js";
import { ui } from "../../frontend/src/app-logic/UILayer.js";
import { MySQLConnCompression, MySQLConnectionScheme } from "../../frontend/src/communication/MySQL.js";
import { IMdsProfileData } from "../../frontend/src/communication/ProtocolMds.js";
import type { ICdmSchemaEntry } from "../../frontend/src/data-models/ConnectionDataModel.js";
import { requisitions } from "../../frontend/src/supplement/Requisitions.js";
import { DBType } from "../../frontend/src/supplement/ShellInterface/index.js";
import { ShellInterface } from "../../frontend/src/supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceShellSession } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceShellSession.js";
import { webSession } from "../../frontend/src/supplement/WebSession.js";
import { convertErrorToString } from "../../frontend/src/utilities/helpers.js";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem.js";
import { DialogWebviewManager } from "./WebviewProviders/DialogWebviewProvider.js";

export class MDSCommandHandler {
    private dialogManager = new DialogWebviewManager();
    private shellSession = new ShellInterfaceShellSession();
    private ociTreeDataProvider: OciTreeDataProvider;

    public setup = (host: ExtensionHost): void => {
        // Our tree providers.
        this.ociTreeDataProvider = new OciTreeDataProvider();
        host.context.subscriptions.push(window.registerTreeDataProvider("msg.oci", this.ociTreeDataProvider));

        // Register extension commands.
        host.context.subscriptions.push(commands.registerCommand("msg.mds.refreshOciProfiles", () => {
            this.ociTreeDataProvider.refresh();
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.configureOciProfiles", () => {
            let ociConfigFilePath = `${homedir()}/.oci/config`;

            // If the MYSQLSH_OCI_CONFIG_FILE env_var is set, use its value instead
            if (process.env.MYSQLSH_OCI_CONFIG_FILE !== undefined) {
                ociConfigFilePath = process.env.MYSQLSH_OCI_CONFIG_FILE;
            }
            const configFile: Uri = Uri.file(ociConfigFilePath);

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

        host.context.subscriptions.push(commands.registerCommand("msg.mds.createRouterEndpoint",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    await this.showMdsEndpointDialog(item.dbSystem, item.compartment, item.profile, host);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getProfileInfo",
            (item?: OciConfigProfileTreeItem) => {
                if (item && item.profile.profile) {
                    this.showNewJsonDocument(
                        `${item.profile.profile.toString()} Info.json`,
                        JSON.stringify(item.profile, null, 4));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.setDefaultProfile",
            async (item?: OciConfigProfileTreeItem) => {
                if (item && item.profile.profile) {
                    window.setStatusBarMessage(`Setting current config profile to ${item.profile.profile} ...`, 10000);
                    try {
                        await this.shellSession.mhs.setDefaultConfigProfile(item.profile.profile);
                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Default config profile set to ${item.profile.profile}.`, 5000);
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        await ui.showErrorMessage(`Error while setting default config profile: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getCompartmentInfo",
            (item?: OciCompartmentTreeItem) => {
                if (item && item.compartment.id) {
                    this.showNewJsonDocument(
                        `${item.compartment.name.toString()} Info.json`,
                        JSON.stringify(item.compartment, null, 4));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.setCurrentCompartment",
            async (item?: OciCompartmentTreeItem) => {
                if (item && item.compartment.id) {
                    window.setStatusBarMessage(`Setting current compartment to ${item.compartment.name} ...`, 10000);
                    try {
                        await this.shellSession.mhs.setCurrentCompartment({
                            compartmentId: item.compartment.id,
                            configProfile: item.profile.profile,
                            interactive: false,
                            raiseExceptions: true,
                        });

                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Current compartment set to ${item.compartment.name}.`, 5000);
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        await ui.showErrorMessage(`Error while setting current compartment: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getDbSystemInfo",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    try {
                        const system = await this.shellSession.mhs.getMdsMySQLDbSystem(item.profile.profile,
                            item.dbSystem.id);
                        this.showNewJsonDocument(`${item.dbSystem.displayName ?? "<unknown>"} Info.json`,
                            JSON.stringify(system, null, 4));
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        void ui.showErrorMessage(`Error while fetching the DB System data: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.startDbSystem",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
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

                    await host.addNewShellTask("Start DB System", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.stopDbSystem",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
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

                    await host.addNewShellTask("Stop DB System", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.restartDbSystem",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
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

                    await host.addNewShellTask("Restart DB System", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.addHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem && item.dbSystem.id && item.compartment && item.profile) {
                    await this.showMdsHWClusterDialog(item.dbSystem, item.compartment, item.profile, host);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.deleteDbSystem",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
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

                    await host.addNewShellTask("Delete DB System", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.startHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "start",
                        "heat-wave-cluster",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Start HeatWave Cluster", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.stopHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "stop",
                        "heat-wave-cluster",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Stop HeatWave Cluster", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.restartHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "restart",
                        "heat-wave-cluster",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Restart HeatWave Cluster", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.rescaleHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item && item.dbSystem && item.dbSystem.id && item.compartment && item.profile) {
                    await this.showMdsHWClusterDialog(item.dbSystem, item.compartment, item.profile, host);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.deleteHWCluster",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "delete",
                        "heat-wave-cluster",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Delete HeatWave Cluster", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getComputeInstance",
            (item?: OciComputeInstanceTreeItem) => {
                if (item && item.compute.id) {
                    this.showNewJsonDocument(
                        `${item.compute.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.compute, null, 4));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getBastion",
            async (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    try {
                        const bastion = await this.shellSession.mhs.getMdsBastion(item.profile.profile,
                            item.bastion.id);
                        this.showNewJsonDocument(`${bastion.name ?? "<unknown>"} Info.json`,
                            JSON.stringify(bastion, null, 4));
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        await ui.showErrorMessage(`Error while fetching the bastion data: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getLoadBalancer",
            (item?: OciLoadBalancerTreeItem) => {
                if (item && item.loadBalancer) {
                    this.showNewJsonDocument(
                        `${item.loadBalancer.displayName ?? "<unknown>"} Info.json`,
                        JSON.stringify(item.loadBalancer, null, 4));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.showTaskOutput", () => {
            taskOutputChannel.show();
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.deleteBastion",
            async (item?: OciBastionTreeItem) => {
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

                    await host.addNewShellTask("Delete Bastion", shellArgs);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");

                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.setCurrentBastion",
            async (item?: OciBastionTreeItem) => {
                if (item && item.bastion.id) {
                    window.setStatusBarMessage(`Setting current bastion to ${item.bastion.name} ...`, 10000);
                    try {
                        await this.shellSession.mhs.setCurrentBastion({
                            bastionId: item.bastion.id,
                            configProfile: item.profile.profile,
                            interactive: false,
                            raiseExceptions: true,
                        });

                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Current compartment set to ${item.bastion.name}.`, 5000);
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        await ui.showErrorMessage(`Error while setting current bastion: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.refreshOnBastionActiveState",
            async (item?: OciBastionTreeItem) => {
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

                    await host.addNewShellTask("Refresh Bastion", shellArgs);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.deleteComputeInstance",
            async (item?: OciComputeInstanceTreeItem) => {
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

                    await host.addNewShellTask("Delete Compute Instance", shellArgs);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.openBastionSshSession",
            async (item?: OciComputeInstanceTreeItem) => {
                if (item && item.shellSession && item.shellSession.mhs && item.compute.id) {
                    window.setStatusBarMessage("Opening Bastion Session ...", 10000);
                    try {
                        const session = await item.shellSession.mhs.createBastionSession(
                            item.profile.profile, item.compute.id, "MANAGED_SSH", item.compute.compartmentId, true,
                            (data: IDictionary) => {
                                if (data.message) {
                                    window.setStatusBarMessage(data.message as string);
                                }
                            });

                        window.setStatusBarMessage("Bastion Session available, opening Terminal ...", 5000);
                        if (session?.bastionId && this.isPortForwardingData(session.targetResourceDetails)) {
                            const terminal = window.createTerminal(`Terminal ${item.name}`);
                            const sshHost = `${session.id}@host.bastion. ${item.profile.region}.oci.oraclecloud.com`;
                            const sshTargetIp = session.targetResourceDetails.targetResourcePrivateIpAddress;
                            if (sshTargetIp) {
                                const sshTargetPort = session.targetResourceDetails.targetResourcePort;
                                if (sshTargetPort) {
                                    terminal.sendText(`ssh -o ProxyCommand="ssh -W %h:%p -p 22 ${sshHost}"` +
                                        ` -p ${sshTargetPort} opc@${sshTargetIp}`);
                                    terminal.sendText("clear");
                                    terminal.show();
                                }
                            }
                        }
                    } catch (reason) {
                        const message = convertErrorToString(reason);
                        await ui.showErrorMessage(`Error while creating the bastion session: ${message}`, {});
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.loadToHeatWave",
            async (entry?: ICdmSchemaEntry, items?: ICdmSchemaEntry[]) => {
                if (entry) {
                    const schemas: string[] = [];
                    if (items && items.length > 0) {
                        items?.forEach((schema) => {
                            // Only consider SchemaMySQLTreeItems of the same connection
                            if (schema instanceof SchemaMySQLTreeItem
                                && schema.connection.details.caption === entry.connection.details.caption) {
                                schemas.push(schema.caption);
                            }
                        });
                    } else {
                        schemas.push(entry.caption);
                    }

                    if (schemas.length > 0) {
                        try {
                            const allSchemas = await entry?.parent.backend.getCatalogObjects("Schema");
                            if (allSchemas) {
                                await this.showMdsHWLoadDataDialog(entry.connection.details.id, schemas, allSchemas,
                                    host);
                            }
                        } catch (reason) {
                            const message = convertErrorToString(reason);
                            await ui.showErrorMessage(`Error retrieving schema list: ${message}`, {});
                        }
                    }
                }
            }));

    };

    /**
     * Opens a new text document on a VS Code tab, with the given text.
     *
     * @param title The title of the tab.
     * @param text The text to show, interpreted as JSON.
     */
    private showNewJsonDocument(title: string, text: string) {
        const path = `${homedir()}/${title}`;
        const scheme = existsSync(path) ? "file" : "untitled"; // Must be lower case "untitled" to make the URI work.
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
        }, (reason) => {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while showing the document: ${message}`, {});
        });
    }


    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param dbSystem The dbSystem of the HW Cluster
     * @param compartment The compartment of the HW Cluster
     * @param profile The OCI profile
     * @param host The extension host
     */
    private async showMdsHWClusterDialog(dbSystem: models.DbSystem, compartment: ICompartment,
        profile: IMdsProfileData, host: ExtensionHost): Promise<void> {

        const statusbarItem = window.createStatusBarItem();
        statusbarItem.text = `$(loading~spin) Fetching List of MDS HeatWave Cluster Shapes...`;
        statusbarItem.show();

        try {
            // cSpell:ignore HEATWAVECLUSTER
            const summaries = await this.shellSession.mhs.listDbSystemShapes("HEATWAVECLUSTER", profile.profile,
                compartment.id);

            statusbarItem.hide();

            const title = (dbSystem.heatWaveCluster && dbSystem.heatWaveCluster.lifecycleState !== "DELETED")
                ? "Rescale the MySQL HeatWave Cluster"
                : "Configure the MySQL HeatWave Cluster";

            const request = {
                id: "mdsHWClusterDialog",
                type: MdsDialogType.MdsHeatWaveCluster,
                title,
                parameters: { shapes: summaries },
                values: {
                    clusterSize: dbSystem?.heatWaveCluster?.clusterSize,
                    shapeName: dbSystem?.heatWaveCluster?.shapeName,
                },
            };

            const response = await this.dialogManager.showDialog(request, title);
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                // Either the request was not sent at all (e.g. there was already one running) or the user cancelled it.
                return;
            }

            if (response.data) {
                const clusterSize = response.data.clusterSize as number;
                const shapeName = response.data.shapeName as string;

                if (!dbSystem.heatWaveCluster || dbSystem.heatWaveCluster.lifecycleState === "DELETED") {
                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "create",
                        "heat-wave-cluster",
                        `--db_system_id=${dbSystem.id.toString()}`,
                        `--cluster_size=${clusterSize.toString()}`,
                        `--shape_name=${shapeName}`,
                        `--config_profile=${profile.profile.toString()}`,
                        "--await_completion=true",
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Create HeatWave Cluster", shellArgs, undefined, false);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
                } else {
                    if (dbSystem.heatWaveCluster && clusterSize === dbSystem.heatWaveCluster.clusterSize
                        && shapeName === dbSystem.heatWaveCluster.shapeName) {
                        window.setStatusBarMessage("The HeatWave Cluster parameters remained unchanged.", 6000);
                    } else {
                        const shellArgs: string[] = [
                            "--",
                            "mds",
                            "update",
                            "heat-wave-cluster",
                            `--db_system_id=${dbSystem.id.toString()}`,
                            `--cluster_size=${clusterSize.toString()}`,
                            `--shape_name=${shapeName}`,
                            `--config_profile=${profile.profile.toString()}`,
                            "--await_completion=true",
                            "--raise_exceptions=true",
                        ];

                        await host.addNewShellTask("Rescale HeatWave Cluster", shellArgs, undefined, false);
                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                    }
                }
            }
        } catch (reason) {
            statusbarItem.hide();
            const message = convertErrorToString(reason);
            await ui.showErrorMessage(`Error while listing MySQL REST services: ${message}`, {});
        }
    }

    /**
     * Shows a dialog to load data to HeatWave
     *
     * @param connectionId The id of the database connection to use
     * @param selectedSchemas The list of schemas to load
     * @param allSchemas The list of all available schemas
     * @param host The extension host
     */
    private async showMdsHWLoadDataDialog(connectionId: number, selectedSchemas: string[],
        allSchemas: string[], host: ExtensionHost): Promise<void> {

        const title = "Load Data to HeatWave";

        const request = {
            id: "mdsHWLoadDataDialog",
            type: MdsDialogType.MdsHeatWaveLoadData,
            title,
            parameters: {},
            values: {
                selectedSchemas,
                allSchemas,
            },
        };

        const response = await this.dialogManager.showDialog(request, title);
        if (!response || response.closure !== DialogResponseClosure.Accept) {
            return;
        }

        if (response.data) {
            const schemaList = response.data.schemas as string[];
            const mode = response.data.mode as string;
            const output = response.data.output as string;
            const disableUnsupportedColumns = response.data.disableUnsupportedColumns as boolean;
            const optimizeLoadParallelism = response.data.optimizeLoadParallelism as boolean;
            const enableMemoryCheck = response.data.enableMemoryCheck as boolean;
            const sqlMode = response.data.sqlMode as string;
            const excludeList = response.data.excludeList as string;

            const shellArgs: string[] = [
                "--",
                "mds",
                "util",
                "heat-wave-load-data",
                `--schemas=${schemaList.join(",")}`,
                `--mode=${mode}`,
                `--output=${output}`,
                `--disable-unsupported-columns=${disableUnsupportedColumns ? "1" : "0"}`,
                `--optimize-load-parallelism=${optimizeLoadParallelism ? "1" : "0"}`,
                `--enable-memory-check=${enableMemoryCheck ? "1" : "0"}`,
                `--sql-mode="${sqlMode}"`,
                `--exclude-list=${excludeList}`,
                "--raise-exceptions=1",
                "--interactive=1",
            ];

            await host.addNewShellTask("Load Data to HeatWave Cluster", shellArgs, connectionId);
            await ui.showInformationMessage("The data load to the HeatWave cluster operation has finished.", {});
        }
    }


    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param dbSystem The dbSystem of the HW Cluster
     * @param compartment The compartment of the HW Cluster
     * @param profile The OCI profile
     * @param host The extension host
     */
    private async showMdsEndpointDialog(dbSystem: models.DbSystem, compartment: ICompartment,
        profile: IMdsProfileData, host: ExtensionHost): Promise<void> {

        const statusbarItem = window.createStatusBarItem();
        statusbarItem.text = `$(loading~spin) Fetching List of Compute Shapes...`;
        statusbarItem.show();

        try {
            // Get Shape
            const shapes = await this.shellSession.mhs.listComputeShapes(
                profile.profile, dbSystem.compartmentId);
            const shapeList = shapes.map((shape, _i, _a) => {
                return shape.shape;
            });

            statusbarItem.hide();
            const title = "MySQL Endpoint Configuration";

            const request = {
                id: "mdsEndpointDialog",
                type: MdsDialogType.MdsEndpoint,
                title,
                parameters: { shapes: shapeList },
                values: {
                    instanceName: `${dbSystem?.displayName} Endpoint`,
                    shapeName: "VM.Standard.E4.Flex",
                    cpuCount: 1,
                    memorySize: 16,
                    mysqlUserName: "dba",
                },
            };

            const response = await this.dialogManager.showDialog(request, title);
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                // Either the request was not sent at all (e.g. there was already one running) or the user cancelled it.
                return;
            }

            if (response.data) {
                const instanceName = response.data.instanceName as string;
                const shapeName = response.data.shapeName as string;
                const cpuCount = response.data.cpuCount as number;
                const memorySize = response.data.memorySize as number;

                const mysqlUserName = response.data.mysqlUserName as string;
                const mysqlUserPassword = response.data.mysqlUserPassword as string;
                const createDbConnection = response.data.createDbConnection as boolean;

                const publicIp = response.data.publicIp as boolean;
                const domainName = response.data.domainName as string;
                const sslCertificate = response.data.sslCertificate as boolean;

                const portForwarding = response.data.portForwarding as boolean;
                const mrs = response.data.mrs as boolean;

                const jwtSecret = response.data.jwtSecret as string;

                const shellArgs: string[] = [
                    "--",
                    "mds",
                    "util",
                    "create-endpoint",
                    `--db_system_id=${dbSystem.id}`,
                    `--config_profile=${profile.profile}`,
                    `--instance_name=${instanceName}`,
                    `--shape=${shapeName}`,
                    `--cpu_count=${cpuCount}`,
                    `--memory_size=${memorySize}`,
                    `--mysql_user_name="${mysqlUserName}"`,
                    `--public_ip=${publicIp ? "true" : "false"}`,
                    `--port_forwarding=${portForwarding ? "true" : "false"}`,
                    `--mrs=${mrs ? "true" : "false"}`,
                    `--domain_name=${domainName}`,
                    `--ssl_cert=${sslCertificate ? "true" : "false"}`,
                    "--raise_exceptions=true",
                ];

                if (jwtSecret !== "") {
                    shellArgs.push(`--jwt_secret="${jwtSecret}"`);
                }

                // Pass mysqlUserPassword on stdin to the shell task so it is not written to logs
                await host.addNewShellTask("Create new Router Endpoint",
                    shellArgs, undefined, true, [mysqlUserPassword]);

                // Refresh OCI Profiles to show new compute instance
                await commands.executeCommand("msg.mds.refreshOciProfiles");

                if (createDbConnection) {
                    const details = {
                        id: 0, // Will be replaced with the ID returned from the BE call.
                        dbType: DBType.MySQL,
                        caption: instanceName,
                        description: "MySQL Router Connection",
                        useSSH: false,
                        useMDS: false,
                        options: {
                            /* eslint-disable @typescript-eslint/naming-convention */
                            "scheme": MySQLConnectionScheme.MySQL,
                            "host": domainName ?? publicIp,
                            "port": 6446,
                            "user": mysqlUserName,
                            "schema": "",
                            // "useSSL": useSsl ? undefined : "no",
                            "ssl-mode": undefined,
                            "compression": MySQLConnCompression.Preferred,
                        },
                    };

                    ShellInterface.dbConnections.addDbConnection(
                        webSession.currentProfileId, details).then((connectionId) => {
                            if (connectionId !== undefined) {
                                void requisitions.broadcastRequest(undefined, "refreshConnection", undefined);
                            }
                        }).catch((reason) => {
                            const message = convertErrorToString(reason);
                            void ui.showErrorMessage(`Error while adding the DB Connection: ${message}`, {});
                        });
                }
            }

        } catch (reason) {
            statusbarItem.hide();
            const message = convertErrorToString(reason);
            await ui.showErrorMessage(`Error while listing Compute Shapes: ${message}`, {});
        }
    }

    private isPortForwardingData(candidate: unknown): candidate is IPortForwardingSessionTargetResourceDetails {
        return (candidate as IPortForwardingSessionTargetResourceDetails).targetResourcePrivateIpAddress !== undefined;
    }
}
