/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
    commands, window, workspace, Uri, TextDocument, Range, Selection, languages, WorkspaceEdit,
} from "vscode";

import { homedir } from "os";
import { existsSync } from "fs";

import { ICompartment, IPortForwardingSessionTargetResourceDetails } from "../../frontend/src/communication";
import { taskOutputChannel } from "./extension";

import { ExtensionHost } from "./ExtensionHost";
import { OciTreeDataProvider } from "./tree-providers/OCITreeProvider";
import { OciBastionTreeItem } from "./tree-providers/OCITreeProvider/OciBastionTreeItem";
import { OciCompartmentTreeItem } from "./tree-providers/OCITreeProvider/OciCompartmentTreeItem";
import { OciComputeInstanceTreeItem } from "./tree-providers/OCITreeProvider/OciComputeInstanceTreeItem";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem";
import { OciLoadBalancerTreeItem } from "./tree-providers/OCITreeProvider/OciLoadBalancerTreeItem";
import { OciConfigProfileTreeItem } from "./tree-providers/OCITreeProvider/OciProfileTreeItem";
import { DbSystem } from "../../frontend/src/oci-typings/oci-mysql/lib/model";

import { DialogResponseClosure, IDictionary, MdsDialogType } from "../../frontend/src/app-logic/Types";
import { DialogWebviewManager } from "./web-views/DialogWebviewProvider";
import { ConnectionsTreeBaseItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeBaseItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { IMdsProfileData } from "../../frontend/src/communication/ProtocolMds";
import { ShellInterfaceShellSession } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceShellSession";

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
                    const endpointName = await window.showInputBox({
                        title: `Please enter a name for this new MDS Endpoint [${item.name} Endpoint]:`,
                        value: `${item.name} Endpoint`,
                    });
                    if (!endpointName) {
                        return;
                    }

                    // Get Shape
                    const shapes = await this.shellSession.mds.listComputeShapes(
                        item.profile.profile, item.dbSystem.compartmentId);
                    const shapeList = shapes.map((shape, _i, _a) => {
                        return shape.shape;
                    });
                    const defaultShape = "VM.Standard.E4.Flex";
                    const defaultShapeIndex = shapeList.indexOf(defaultShape);
                    if (defaultShapeIndex !== -1) {
                        shapeList.splice(defaultShapeIndex, 1);
                        shapeList.unshift(defaultShape);
                    }
                    const shape = (await window.showQuickPick(shapeList, {
                        title: "Please select a shape for the compute instance:",
                        placeHolder: defaultShape,
                        canPickMany: false,
                    })) || defaultShape;

                    // CPU Count
                    const cpuCountValue = await window.showInputBox({
                        title: `Please enter the number of OCPUs:`,
                        value: `1`,
                    });
                    if (!cpuCountValue) {
                        return;
                    }
                    const cpuCount = parseInt(cpuCountValue, 10);
                    if (isNaN(cpuCount)) {
                        // cspell:ignore OCPU
                        await window.showErrorMessage(`The OCPU count needs to be given as an integer.`);

                        return;
                    }

                    // Memory
                    const memorySizeValue = await window.showInputBox({
                        title: `Please enter the amount of Memory (in GB):`,
                        value: `16`,
                    });
                    if (!memorySizeValue) {
                        return;
                    }
                    const memorySize = parseInt(memorySizeValue, 10);
                    if (isNaN(memorySize)) {
                        // cspell:ignore OCPU
                        await window.showErrorMessage(`The amount of memory needs to be given as an integer.`);

                        return;
                    }

                    // MySQL User Name
                    const mysqlUserName = await window.showInputBox({
                        title: `Please enter the MySQL User Name for bootstrapping:`,
                        value: `dba`,
                    });
                    if (!mysqlUserName) {
                        return;
                    }

                    const shellArgs: string[] = [
                        "--",
                        "mds",
                        "util",
                        "create-mds-endpoint",
                        `--db_system_id=${item.dbSystem.id.toString()}`,
                        `--config_profile=${item.profile.profile}`,
                        `--instance_name=${endpointName}`,
                        `--shape=${shape}`,
                        `--cpu_count=${cpuCount}`,
                        `--memory_size=${memorySize}`,
                        `--mysql_user_name="${mysqlUserName}"`,
                        "--raise_exceptions=true",
                    ];

                    await host.addNewShellTask("Create new Router Endpoint", shellArgs);
                    await commands.executeCommand("msg.mds.refreshOciProfiles");
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
                        await this.shellSession.mds.setDefaultConfigProfile(item.profile.profile);
                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Default config profile set to ${item.profile.profile}.`, 5000);
                    } catch (reason) {
                        await window.showErrorMessage(`Error while setting default config profile: ${String(reason)}`);
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
                        await this.shellSession.mds.setCurrentCompartment({
                            compartmentId: item.compartment.id,
                            configProfile: item.profile.profile,
                            interactive: false,
                            raiseExceptions: true,
                        });

                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Current compartment set to ${item.compartment.name}.`, 5000);
                    } catch (reason) {
                        await window.showErrorMessage(`Error while setting current compartment: ${String(reason)}`);
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.getDbSystemInfo",
            async (item?: OciDbSystemTreeItem) => {
                if (item?.dbSystem.id) {
                    try {
                        const system = await this.shellSession.mds.getMdsMySQLDbSystem(item.profile.profile,
                            item.dbSystem.id);
                        this.showNewJsonDocument(`${item.dbSystem.displayName ?? "<unknown>"} Info.json`,
                            JSON.stringify(system, null, 4));
                    } catch (reason) {
                        void window.showErrorMessage(`Error while fetching the DB System data: ${String(reason)}`);
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
                        const bastion = await this.shellSession.mds.getMdsBastion(item.profile.profile,
                            item.bastion.id);
                        this.showNewJsonDocument(`${bastion.name ?? "<unknown>"} Info.json`,
                            JSON.stringify(bastion, null, 4));
                    } catch (reason) {
                        await window.showErrorMessage(`Error while fetching the bastion data: ${String(reason)}`);
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
                        await this.shellSession.mds.setCurrentBastion({
                            bastionId: item.bastion.id,
                            configProfile: item.profile.profile,
                            interactive: false,
                            raiseExceptions: true,
                        });

                        await commands.executeCommand("msg.mds.refreshOciProfiles");
                        window.setStatusBarMessage(`Current compartment set to ${item.bastion.name}.`, 5000);
                    } catch (reason) {
                        await window.showErrorMessage(`Error while setting current bastion: ` +
                            `${String(reason)}`);
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
                if (item && item.shellSession && item.shellSession.mds && item.compute.id) {
                    window.setStatusBarMessage("Opening Bastion Session ...", 10000);
                    try {
                        const session = await item.shellSession.mds.createBastionSession(
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
                        await window.showErrorMessage(`Error while creating the bastion session: ${String(reason)}`);
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mds.loadToHeatWave",
            async (item?: SchemaMySQLTreeItem, items?: ConnectionsTreeBaseItem[]) => {
                if (item) {
                    const schemas: string[] = [];
                    if (items && items.length > 0) {
                        items?.forEach((schema) => {
                            // Only consider SchemaMySQLTreeItems of the same connection
                            if (schema instanceof SchemaMySQLTreeItem
                                && schema.entry.details.caption === item.entry.details.caption) {
                                schemas.push(schema.name);
                            }
                        });
                    } else {
                        schemas.push(item.name);
                    }

                    if (schemas.length > 0) {
                        try {
                            const allSchemas = await item?.entry?.backend?.getCatalogObjects("Schema");
                            if (allSchemas) {
                                await this.showMdsHWLoadDataDialog(item.entry.details.id, schemas, allSchemas, host);
                            }
                        } catch (reason) {
                            await window.showErrorMessage(`Error retrieving schema list: ${String(reason)}`);
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


    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param dbSystem The dbSystem of the HW Cluster
     * @param compartment The compartment of the HW Cluster
     * @param profile The OCI profile
     * @param host The extension host
     */
    private async showMdsHWClusterDialog(dbSystem: DbSystem, compartment: ICompartment,
        profile: IMdsProfileData, host: ExtensionHost): Promise<void> {

        const statusbarItem = window.createStatusBarItem();
        statusbarItem.text = `$(loading~spin) Fetching List of MDS HeatWave Cluster Shapes...`;
        statusbarItem.show();

        try {
            // cSpell:ignore HEATWAVECLUSTER
            const summaries = await this.shellSession.mds.listDbSystemShapes("HEATWAVECLUSTER", profile.profile,
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
            await window.showErrorMessage(`Error while listing MySQL REST services: ${String(reason)}`);
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
            await window.showInformationMessage("The data load to the HeatWave cluster operation has finished.");
        }
    }

    private isPortForwardingData(candidate: unknown): candidate is IPortForwardingSessionTargetResourceDetails {
        return (candidate as IPortForwardingSessionTargetResourceDetails).targetResourcePrivateIpAddress !== undefined;
    }
}
