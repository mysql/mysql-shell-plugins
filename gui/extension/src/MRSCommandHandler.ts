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

import os from "os";
import path from "path";
import fs from "fs";

import { commands, env, ExtensionContext, TerminalExitStatus, Uri, ViewColumn, WebviewPanel, window } from "vscode";

import { DBType } from "../../frontend/src/supplement/ShellInterface";

import { ExtensionHost } from "./ExtensionHost";
import { MrsContentSetTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsContentSetTreeItem";
import { MrsSchemaTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsServiceTreeItem";
import { MrsTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsTreeItem";
import { MrsRouterTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsRouterTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { showMessageWithTimeout, showModalDialog } from "./utilities";
import { openSqlEditorSessionAndConnection, openSqlEditorConnection } from "./utilitiesShellGui";
import { IMrsServiceData } from "../../frontend/src/communication/ProtocolMrs";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor";
import { ConnectionMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionMySQLTreeItem";
import { MrsDbObjectTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsDbObjectTreeItem";
import { MrsAuthAppTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsAuthAppTreeItem";
import { MySQLShellLauncher } from "../../frontend/src/utilities/MySQLShellLauncher";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../frontend/src/communication/MySQL";
import { MrsUserTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsUserTreeItem";
import { findExecutable } from "../../frontend/src/utilities/file-utilities";
import { pathToCamelCase } from "../../frontend/src/utilities/string-helpers";
import { MrsContentFileTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsContentFileTreeItem";
import { DBEditorModuleId } from "../../frontend/src/modules/ModuleInfo";

export class MRSCommandHandler {
    #docsWebviewPanel?: WebviewPanel;
    #docsCurrentFile?: string;
    #host: ExtensionHost;

    public setup = (host: ExtensionHost): void => {
        this.#host = host;

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.configureMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.disableMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item, false);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.enableMySQLRestService",
            async (item?: ConnectionMySQLTreeItem) => {
                await this.configureMrs(item, true);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.bootstrapLocalRouter",
            async (item?: MrsTreeItem) => {
                await this.bootstrapLocalRouter(host.context, item);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.startLocalRouter",
            async (item?: MrsTreeItem) => {
                await this.startStopLocalRouter(host.context, item);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.killLocalRouters",
            () => {
                let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                if (term === undefined) {
                    term = window.createTerminal("MySQL Router MRS");
                }

                if (os.platform() === "win32") {
                    term.sendText("taskkill /IM mysqlrouter.exe /F", true);
                } else {
                    term.sendText("killall -9 mysqlrouter", true);
                }

                // Make sure to remove the .pid file
                try {
                    fs.unlinkSync(path.join(this.getLocalRouterConfigDir(), "mysqlrouter.pid"));
                } catch (error) {
                    //
                }
            }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.stopLocalRouter",
            async (item?: MrsTreeItem) => {
                await this.startStopLocalRouter(host.context, item, false);
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.docs", () => {
            this.browseDocs();
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.docs.service", () => {
            this.browseDocs("rest-service-properties");
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteRouter",
            async (item?: MrsRouterTreeItem) => {
                if (item) {
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS router ${item.value.address} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
                        try {
                            await item.entry.backend?.mrs.deleteRouter(item.value.id);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS Router has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error deleting the MRS Router: ${String(error)}`);
                        }
                    }
                }
            }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.addService", (item?: MrsTreeItem) => {
            if (item?.entry.backend) {
                const connectionId = String(item.entry.details.id);
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.runCommand("job", [
                        { requestType: "showModule", parameter: DBEditorModuleId },
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                        { requestType: "showMrsServiceDialog", parameter: undefined },
                    ], "newConnection");
                }
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.editService", (item?: MrsServiceTreeItem) => {
            if (item?.entry.backend) {
                const connectionId = String(item.entry.details.id);
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.runCommand("job", [
                        { requestType: "showModule", parameter: DBEditorModuleId },
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                        { requestType: "showMrsServiceDialog", parameter: item.value },
                    ], "newConnection");
                }
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteService",
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

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.setCurrentService",
            async (item?: MrsServiceTreeItem) => {
                if (item) {
                    try {
                        await item.entry.backend?.mrs.setCurrentService(item.value.id);
                        await commands.executeCommand("msg.refreshConnections");
                        showMessageWithTimeout("The MRS service has been set as the new default service.");

                    } catch (reason) {
                        void window.showErrorMessage(`Error setting the default MRS service: ${String(reason)}`);
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.exportServiceSdk",
            async (item?: MrsServiceTreeItem) => {
                if (item && item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showSaveDialog({
                        title: "Export REST Service SDK Files...",
                        defaultUri: Uri.file(`${os.homedir()}/${pathToCamelCase(item.value.urlContextRoot)}.mrs.sdk`),
                        saveLabel: "Export SDK Files",
                    }).then(async (value) => {
                        if (value !== undefined) {
                            try {
                                const path = value.fsPath;
                                await backend.mrs.dumpSdkServiceFiles(item.value.id, "TypeScript", path);
                                showMessageWithTimeout("MRS Service REST Files exported successfully.");
                            } catch (error) {
                                void window.showErrorMessage(
                                    `Error while exporting the REST Service SDK Files: ${String(error)}`);
                            }
                        }
                    });
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteSchema",
            async (item?: MrsSchemaTreeItem) => {
                if (item) {
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS schema ${item.value.name} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
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

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.editSchema", (item?: MrsSchemaTreeItem) => {
            if (item?.entry.backend) {
                const connectionId = String(item.entry.details.id);
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.runCommand("job", [
                        { requestType: "showModule", parameter: DBEditorModuleId },
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                        {
                            requestType: "showMrsSchemaDialog",
                            parameter: { schemaName: item.value.name, schema: item.value },
                        },
                    ], "newConnection");
                }
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.addSchema",
            async (item?: SchemaMySQLTreeItem) => {
                if (item?.entry.backend) {
                    const connectionId = String(item.entry.details.id);
                    const provider = this.#host.currentProvider;
                    if (provider) {
                        // Check if there is at least one MRS Service
                        const services = await item.entry.backend.mrs.listServices();

                        if (services.length > 0) {
                            void provider.runCommand("job", [
                                { requestType: "showModule", parameter: DBEditorModuleId },
                                {
                                    requestType: "showPage", parameter: {
                                        module: DBEditorModuleId, page: connectionId,
                                    },
                                },
                                {
                                    requestType: "showMrsSchemaDialog",
                                    parameter: { schemaName: item.schema },
                                },
                            ], "newConnection");
                        } else {
                            void window.showErrorMessage(`Please create a REST Service before adding a DB Schema.`);
                        }
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.copyDbObjectRequestPath",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const o = item.value;
                    await env.clipboard.writeText((o.hostCtx ?? "") + (o.schemaRequestPath ?? "") + o.requestPath);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.openDbObjectRequestPath",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const o = item.value;
                    let url = (o.hostCtx ?? "") + (o.schemaRequestPath ?? "") + o.requestPath;

                    if (url.startsWith("/")) {
                        url = `https://localhost:8443${url}`;
                    } else {
                        url = `https://${url}`;
                    }

                    await env.openExternal(Uri.parse(url));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.openContentFileRequestPath",
            async (item?: MrsContentFileTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const i = item.value;
                    let url = (i.hostCtx ?? "") + (i.contentSetRequestPath ?? "") + i.requestPath;

                    if (url.startsWith("/")) {
                        url = `https://localhost:8443${url}`;
                    } else {
                        url = `https://${url}`;
                    }

                    await env.openExternal(Uri.parse(url));
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteDbObject",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    const accepted = await showModalDialog(
                        `Are you sure you want to delete the REST DB Object ${item.value.name}?`,
                        "Delete DB Object",
                        "This operation cannot be reverted!");

                    if (accepted) {
                        try {
                            await backend.mrs.deleteDbObject(item.value.id);

                            // TODO: refresh only the affected connection.
                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(`The REST DB Object ${item.value.name} has been deleted.`);
                        } catch (reason) {
                            void window.showErrorMessage(`Error deleting the REST DB Object: ${String(reason)}`);
                        }
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.editAuthApp", (item?: MrsAuthAppTreeItem) => {
            if (item?.entry.backend) {
                const connectionId = String(item.entry.details.id);
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.runCommand("job", [
                        { requestType: "showModule", parameter: DBEditorModuleId },
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                        { requestType: "showMrsAuthAppDialog", parameter: { authApp: item.value } },
                    ], "newConnection");
                }
            }
        }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.addAuthApp", (item?: MrsServiceTreeItem) => {
            try {
                if (item?.entry.backend && item.value) {
                    const connectionId = String(item.entry.details.id);
                    const provider = this.#host.currentProvider;
                    if (provider) {
                        void provider.runCommand("job", [
                            { requestType: "showModule", parameter: DBEditorModuleId },
                            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                            { requestType: "showMrsAuthAppDialog", parameter: { service: item.value } },
                        ], "newConnection");
                    }
                }
            } catch (reason) {
                void window.showErrorMessage(`Error adding a new MRS Authentication App: ${String(reason)}`);
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteAuthApp",
            async (item?: MrsAuthAppTreeItem) => {
                try {
                    if (item?.entry.backend && item.value.id && item.value.name) {
                        const backend = item.entry.backend;
                        const answer = await window.showInformationMessage(
                            `Are you sure the MRS authentication app ${item.value.name} should be deleted?`,
                            "Yes", "No");

                        if (answer === "Yes") {
                            await backend.mrs.deleteAuthApp(item.value.id);//
                            // TODO: refresh only the affected connection.
                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(`The MRS Authentication App ${item.value.name} has been deleted.`);
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the MRS Authentication App: ${String(reason)}`);
                }

            }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteUser",
            async (item?: MrsUserTreeItem) => {
                try {
                    if (item?.entry.backend && item.value.id && item.value.name) {
                        const backend = item.entry.backend;

                        const answer = await window.showInformationMessage(
                            `Are you sure the MRS user ${item.value.name ?? "unknown"} should be deleted?`,
                            "Yes", "No");

                        if (answer === "Yes") {
                            await backend.mrs.deleteUser(item.value.id);

                            // TODO: refresh only the affected connection.
                            void commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout(`The MRS User ${item.value.name} has been deleted.`);
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the MRS User: ${String(reason)}`);
                }

            }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.addUser", (item?: MrsAuthAppTreeItem) => {
            if (item?.entry.backend && item.value) {
                const connectionId = String(item.entry.details.id);
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.runCommand("job", [
                        { requestType: "showModule", parameter: DBEditorModuleId },
                        { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                        { requestType: "showMrsUserDialog", parameter: { authApp: item.value } },
                    ], "newConnection");
                }
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.editUser", (item?: MrsUserTreeItem) => {
            const backend = item?.entry.backend;
            try {
                if (backend && item.value && item.value.authAppId) {
                    backend.mrs.getAuthApp(item.value.authAppId).then((authApp) => {
                        if (authApp) {
                            const connectionId = String(item.entry.details.id);
                            const provider = this.#host.currentProvider;
                            if (provider) {
                                void provider.runCommand("job", [
                                    { requestType: "showModule", parameter: DBEditorModuleId },
                                    {
                                        requestType: "showPage", parameter: {
                                            module: DBEditorModuleId, page: connectionId,
                                        },
                                    },
                                    { requestType: "showMrsUserDialog", parameter: { authApp, user: item.value } },
                                ], "newConnection");
                            }
                        } else {
                            throw new Error("Unable to find authApp");
                        }
                    }).catch((reason) => {
                        void window.showErrorMessage(`Error adding a new User: ${String(reason)}`);
                    });
                }
            } catch (reason) {
                void window.showErrorMessage(`Error adding a new User: ${String(reason)}`);
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.addFolderAsContentSet",
            async (directory?: Uri) => {
                if (directory) {
                    const connection = await host.determineConnection(DBType.MySQL);
                    if (connection) {
                        const provider = this.#host.currentProvider;
                        if (provider) {
                            void provider.runCommand("job", [
                                { requestType: "showModule", parameter: DBEditorModuleId },
                                {
                                    requestType: "showPage", parameter: {
                                        module: DBEditorModuleId, page: String(connection.details.id),
                                    },
                                },
                                {
                                    requestType: "showMrsContentSetDialog", parameter: {
                                        directory: directory.fsPath,
                                    },
                                },
                            ], "newConnection");
                        }
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.rebuildMrsSdk",
            async (directory?: Uri) => {
                if (directory) {
                    const connection = await host.determineConnection(DBType.MySQL);
                    if (connection) {
                        void window.showErrorMessage("Not yet implemented.");
                    }
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.deleteContentSet",
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

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.dumpSchemaToJSONFile",
            async (item?: MrsSchemaTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showSaveDialog({
                        title: "REST Schema Dump...",
                        saveLabel: "Select the target file",
                        defaultUri: Uri.file(`${os.homedir()}/${pathToCamelCase(item.value.requestPath)}.mrs.json`),
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            JSON: ["mrs.json"],
                        },
                    }).then(async (value) => {
                        if (value !== undefined) {
                            try {
                                const path = value.fsPath;
                                await backend.mrs.dumpSchema(path,
                                    item.value.serviceId,
                                    undefined,
                                    item.value.id);
                                showMessageWithTimeout("The REST Schema has been dumped successfully.");
                            } catch (error) {
                                void window.showErrorMessage(
                                    `Error dumping the REST Schema: ${String(error)}`);
                            }
                        }
                    });
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.dumpObjectToJSONFile",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showSaveDialog({
                        title: "REST Database Object Dump...",
                        saveLabel: "Select the target file",
                        defaultUri: Uri.file(`${os.homedir()}/${item.value.name}.mrs.json`),
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            JSON: ["mrs.json"],
                        },
                    }).then(async (value) => {
                        if (value !== undefined) {
                            try {
                                const path = value.fsPath;
                                await backend.mrs.dumpObject(path,
                                    item.value.serviceId,
                                    undefined,
                                    item.value.dbSchemaId,
                                    undefined,
                                    item.value.id);
                                showMessageWithTimeout("The REST Database Object has been dumped successfully.");
                            } catch (error) {
                                void window.showErrorMessage(
                                    `Error dumping the REST Database Object: ${String(error)}`);
                            }
                        }
                    });
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.loadSchemaFromJSONFile",
            async (item?: MrsServiceTreeItem | Uri) => {
                if (item instanceof MrsServiceTreeItem && item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showOpenDialog({
                        title: "REST Schema Load...",
                        openLabel: "Select the source file",
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            JSON: ["mrs.json"],
                        },
                    }).then(async (value) => {
                        if (value !== undefined) {
                            const statusbarItem = window.createStatusBarItem();
                            try {
                                statusbarItem.text = "$(loading~spin) Loading REST Schema ...";
                                statusbarItem.show();

                                const path = value[0].fsPath;
                                await backend.mrs.loadSchema(path,
                                    item.value.id);
                                void commands.executeCommand("msg.refreshConnections");
                                showMessageWithTimeout("The REST Schema has been loaded successfully.");
                            } catch (error) {
                                void window.showErrorMessage(
                                    `Error loading REST Schema: ${String(error)}`);
                            } finally {
                                statusbarItem.hide();
                            }
                        }
                    });
                } else if (item instanceof Uri && item) {
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

                            const services = await sqlEditor.mrs.listServices();
                            let service: IMrsServiceData | undefined;

                            if (services.length === 0) {
                                void window.showErrorMessage("No MRS Services available for this connection.");
                            } else if (services.length === 1) {
                                service = services[0];
                            } else {
                                statusbarItem.text = "Please select a MRS Service ...";

                                // No default connection set. Show a picker.
                                const items = services.map((service) => {
                                    return service.hostCtx;
                                });
                                const serviceHostCtx = await window.showQuickPick(items, {
                                    title: "Select a MRS Service to load the MRS schema dump",
                                    matchOnDescription: true,
                                    placeHolder: "Type the name of an existing MRS Service",
                                });

                                service = services.find((candidate) => {
                                    return candidate.hostCtx === serviceHostCtx;
                                });

                            }

                            if (service !== undefined) {
                                statusbarItem.text = "$(loading~spin) Loading REST Schema ...";
                                await sqlEditor.mrs.loadSchema(item.fsPath, service.id);
                                void commands.executeCommand("msg.refreshConnections");
                                showMessageWithTimeout("The REST Schema has been loaded successfully.");
                            }
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

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.loadObjectFromJSONFile",
            async (item?: MrsSchemaTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showOpenDialog({
                        title: "REST Database Object Load...",
                        openLabel: "Select the source file",
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            JSON: ["mrs.json"],
                        },
                    }).then(async (value) => {
                        if (value !== undefined) {
                            try {
                                const path = value[0].fsPath;
                                await backend.mrs.loadObject(path,
                                    item.value.serviceId,
                                    undefined,
                                    item.value.id);
                                void commands.executeCommand("msg.refreshConnections");
                                showMessageWithTimeout("The REST Database Object has been loaded successfully.");
                            } catch (error) {
                                void window.showErrorMessage(
                                    `Error loading REST Database Object: ${String(error)}`);
                            }
                        }
                    });
                }
            }));


        host.context.subscriptions.push(commands.registerCommand("msg.mrs.saveExampleProject",
            async (exampleCodePath: Uri) => {
                const path = exampleCodePath.fsPath;
                let m;
                if (os.platform() === "win32") {
                    m = path.match(/([^\\]*)\/*$/);
                } else {
                    m = path.match(/([^/]*)\/*$/);
                }
                if (m === null) {
                    void window.showErrorMessage(
                        `Error storing the MRS Project: Project folder contains no path.`);

                    return;
                }
                const dirName = m[1];

                await window.showOpenDialog({
                    title: `Saving MRS Example Project "${dirName}" ...`,
                    openLabel: `Save ${dirName} Project`,
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri: Uri.file(`${os.homedir()}/Documents`),
                }).then(async (value) => {
                    if (value !== undefined) {
                        try {
                            const targetPath = Uri.joinPath(value[0], dirName);
                            // Add filter to ignore node_modules folder
                            const filter = (src: string) => { return src.indexOf("node_modules") === -1; };
                            fs.cpSync(path, targetPath.fsPath, { filter, recursive: true });

                            showMessageWithTimeout(`The MRS Project ${dirName} has been stored successfully.`);

                            const answer = await window.showInformationMessage(
                                `Do you want to open the MRS Project ${dirName} ` +
                                `in a new VS Code Window?`, "Yes", "No");

                            if (answer === "Yes") {
                                void commands.executeCommand(`vscode.openFolder`, targetPath,
                                    { forceNewWindow: true });
                            }
                        } catch (error) {
                            void window.showErrorMessage(
                                `Error storing the MRS Project: ${String(error)}`);
                        }
                    }
                });
            }));
    };

    private configureMrs = async (item?: ConnectionMySQLTreeItem, enableMrs?: boolean): Promise<void> => {
        let answer: string | undefined = "Yes";

        if (enableMrs === undefined) {
            answer = await window.showInformationMessage(
                `Do you want to configure this instance for MySQL REST Service Support? ` +
                `This operation will create the MRS metadata database schema.`, "Yes", "No");
        }

        if (item && answer === "Yes") {
            const sqlEditor = new ShellInterfaceSqlEditor();
            try {
                await openSqlEditorSessionAndConnection(sqlEditor, item.entry.details.id,
                    "msg.mrs.configureMySQLRestService");

                const statusbarItem = window.createStatusBarItem();
                try {
                    statusbarItem.text = "$(loading~spin) Configuring the MySQL REST Service " +
                        "Metadata Schema ...";
                    statusbarItem.show();

                    await sqlEditor.mrs.configure(enableMrs);
                } finally {
                    statusbarItem.hide();
                }

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

    private bootstrapLocalRouter = async (context: ExtensionContext,
        item?: MrsTreeItem, waitAndClosedWhenFinished = false): Promise<TerminalExitStatus | undefined> => {
        if (item) {
            if (findExecutable("mysqlrouter_bootstrap").length > 0) {
                const shellConfDir = MySQLShellLauncher.getShellUserConfigDir(context.extensionPath);
                const certDir = path.join(shellConfDir, "plugin_data", "gui_plugin", "web_certs");

                const mysqlConnOptions = item.entry.details.options as IMySQLConnectionOptions;
                if (mysqlConnOptions.scheme !== MySQLConnectionScheme.MySQL) {
                    void window.showErrorMessage(
                        "Only DB Connections using classic MySQL protocol can be used for bootstrapping.");

                    return;
                }
                if (mysqlConnOptions.ssh !== undefined || mysqlConnOptions["mysql-db-system-id"] !== undefined) {
                    void window.showErrorMessage(
                        "DB Connection using SSH Tunneling or MDS Bastion settings cannot be used for bootstrapping.");

                    return;
                }
                const connString = `${mysqlConnOptions.user ?? ""}@${mysqlConnOptions.host}` +
                    ((mysqlConnOptions.port !== undefined) ? `:${mysqlConnOptions.port}` : "");

                let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                if (term === undefined) {
                    term = window.createTerminal("MySQL Router MRS");
                }

                let routerConfigDir: string;
                if (os.platform() === "win32") {
                    routerConfigDir = path.join(this.getBaseDir(), "mysqlrouter");
                } else {
                    routerConfigDir = path.join(this.getBaseDir(), ".mysqlrouter");
                }

                if (fs.existsSync(routerConfigDir)) {
                    const answer = await window.showInformationMessage(
                        `The MySQL Router config directory ${routerConfigDir} already exists. `
                        + "Do you want to rename the existing directory and proceed?",
                        "Yes", "No");
                    if (answer === "Yes") {
                        try {
                            fs.renameSync(routerConfigDir, routerConfigDir + "_old");
                        } catch (e) {
                            fs.rmSync(routerConfigDir + "_old", { recursive: true, force: true });
                            fs.renameSync(routerConfigDir, routerConfigDir + "_old");
                        }
                    } else {
                        return;
                    }
                }

                // cSpell:ignore consolelog
                if (term !== undefined) {
                    term.show();
                    term.sendText(
                        `mysqlrouter_bootstrap ${connString} --mrs --directory "${routerConfigDir}" ` +
                        `"--conf-set-option=http_server.ssl_cert=${path.join(certDir, "server.crt")}" ` +
                        `"--conf-set-option=http_server.ssl_key=${path.join(certDir, "server.key")}" ` +
                        `--conf-set-option=logger.level=DEBUG --conf-set-option=logger.sinks=consolelog`,
                        !waitAndClosedWhenFinished);

                    if (waitAndClosedWhenFinished) {
                        term.sendText("; exit");

                        return new Promise((resolve, reject) => {
                            const disposeToken = window.onDidCloseTerminal(
                                (closedTerminal) => {
                                    if (closedTerminal === term) {
                                        disposeToken.dispose();
                                        if (term.exitStatus !== undefined) {
                                            resolve(term.exitStatus);
                                        } else {
                                            reject("Terminal exited with undefined status");
                                        }
                                    }
                                },
                            );
                        });
                    }

                }
            } else {
                const answer = await window.showInformationMessage(
                    `The mysqlrouter_bootstrap executable could not be found. `
                    + "Do you want to download and install the MySQL Router now?",
                    "Yes", "No");
                if (answer === "Yes") {
                    const labsUrl = "https://downloads.mysql.com/snapshots/pb/mysql-router-8.0.32-labs-mrs/";

                    switch (os.platform()) {
                        case "darwin": {
                            switch (os.arch()) {
                                case "arm":
                                case "arm64": {
                                    void env.openExternal(Uri.parse(
                                        `${labsUrl}mysql-router-8.0.32-labs-mrs-macos13-arm64.dmg`));
                                    break;
                                }
                                default: {
                                    void env.openExternal(Uri.parse(
                                        `${labsUrl}mysql-router-8.0.32-labs-mrs-macos13-x86_64.dmg`));
                                    break;
                                }
                            }
                            break;
                        }
                        case "win32": {
                            void env.openExternal(Uri.parse(
                                `${labsUrl}mysql-router-8.0.32-labs-mrs-winx64.msi`));
                            break;
                        }
                        default: {
                            // Default to Linux
                            void env.openExternal(Uri.parse("https://labs.mysql.com"));
                            break;
                        }
                    }
                }
            }
        }
    };

    private getBaseDir = (): string => {
        if (os.platform() !== "win32") {
            return os.homedir();
        }

        return path.join(os.homedir(), "AppData", "Roaming", "MySQL");
    };

    private getLocalRouterConfigDir = (): string => {
        let routerConfigDir: string;
        if (os.platform() === "win32") {
            routerConfigDir = path.join(this.getBaseDir(), "mysqlrouter");
        } else {
            routerConfigDir = path.join(this.getBaseDir(), ".mysqlrouter");
        }

        return routerConfigDir;
    };

    private startStopLocalRouter = async (context: ExtensionContext,
        item?: MrsTreeItem, start = true): Promise<void> => {
        if (item) {
            if (findExecutable("mysqlrouter")) {
                const routerConfigDir = this.getLocalRouterConfigDir();

                if (fs.existsSync(routerConfigDir)) {
                    let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                    if (term === undefined) {
                        term = window.createTerminal("MySQL Router MRS");
                    }

                    if (term !== undefined) {
                        let cmd = (start ? "start" : "stop") + (os.platform() === "win32" ? ".ps1" : ".sh");
                        cmd = path.join(routerConfigDir, cmd);

                        if (cmd.includes(" ")) {
                            if (os.platform() === "win32") {

                                // If there is a space in the path, ensure to add the PowerShell call operator (&)
                                if (cmd.includes(" ")) {
                                    cmd = "& \"" + cmd + "\"";
                                }
                            } else {
                                cmd = "\"" + cmd + "\"";
                            }
                        }

                        term.show();
                        if (os.platform() === "win32") {
                            term.sendText("Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser", true);
                            term.sendText("clear", true);
                        }
                        term.sendText(cmd, true);
                    }
                } else {
                    if (start) {
                        const answer = await window.showInformationMessage(
                            `The MySQL Router config directory ${routerConfigDir} was not found. `
                            + "Do you want to bootstrap a local MySQL Router instance for development now?",
                            "Yes", "No");
                        if (answer === "Yes") {
                            await this.bootstrapLocalRouter(this.#host.context, item, true);
                            void this.startStopLocalRouter(this.#host.context, item);
                        }
                    } else {
                        showMessageWithTimeout(
                            `The MySQL Router config directory ${routerConfigDir} was not found. ` +
                            "Please bootstrap a local MySQL Router instance for development first.");
                    }
                }
            } else {
                const answer = await window.showInformationMessage(
                    `The mysqlrouter executable could not be found. `
                    + "Do you want to download and install the MySQL Router now?",
                    "Yes", "No");
                if (answer === "Yes") {
                    void env.openExternal(Uri.parse("https://labs.mysql.com"));
                }
            }
        }
    };

    private browseDocs = (id?: string, file = "index.html") => {
        const fileChange = this.#docsCurrentFile !== file;

        if (!this.#docsWebviewPanel || fileChange) {
            this.#docsCurrentFile = file;
            try {
                let data;
                let mrsPluginDir = path.join(this.#host.context.extensionPath, "shell", "lib",
                    "mysqlsh", "plugins", "mrs_plugin");
                let indexPath = path.join(mrsPluginDir, "docs", file);
                if (fs.existsSync(indexPath)) {
                    data = fs.readFileSync(indexPath, "utf8");
                } else {
                    if (os.platform() === "win32") {
                        mrsPluginDir = path.join(this.getBaseDir(), "mysqlsh",
                            "plugins", "mrs_plugin");
                    } else {
                        mrsPluginDir = path.join(this.getBaseDir(), ".mysqlsh", "plugins", "mrs_plugin");
                    }
                    indexPath = path.join(mrsPluginDir, "docs", file);

                    if (fs.existsSync(indexPath)) {
                        data = fs.readFileSync(indexPath, "utf8");
                    } else {
                        throw new Error(`MRS Documentation not found.`);
                    }
                }

                if (!this.#docsWebviewPanel) {
                    this.#docsWebviewPanel = window.createWebviewPanel(
                        "mrsDocs",
                        "MRS Docs",
                        ViewColumn.One,
                        {
                            enableScripts: true,
                            retainContextWhenHidden: true,
                            localResourceRoots: [
                                Uri.file(path.join(mrsPluginDir, "docs")),
                                Uri.file(path.join(mrsPluginDir, "docs", "style")),
                                Uri.file(path.join(mrsPluginDir, "docs", "images")),
                            ],
                        });
                    this.#docsWebviewPanel.onDidDispose(() => { this.handleDocsWebviewPanelDispose(); });

                    // Handle messages from the webview
                    this.#docsWebviewPanel.webview.onDidReceiveMessage(
                        (message) => {
                            if (message.path && typeof message.path === "string" && os.platform() === "win32") {
                                message.path = String(message.path).replaceAll("/", "\\");
                            }
                            switch (message.command) {
                                case "openSqlFile": {
                                    if (message.path && typeof message.path === "string") {
                                        const fullPath = Uri.file(path.join(mrsPluginDir, String(message.path)));

                                        void commands.executeCommand("msg.editInScriptEditor", fullPath);
                                    }

                                    break;
                                }

                                case "loadMrsDump": {
                                    if (message.path && typeof message.path === "string") {
                                        const fullPath = Uri.file(path.join(mrsPluginDir, String(message.path)));

                                        void commands.executeCommand("msg.mrs.loadSchemaFromJSONFile", fullPath);
                                    }

                                    break;
                                }

                                case "saveProject": {
                                    if (message.path && typeof message.path === "string") {
                                        const fullPath = Uri.file(path.join(mrsPluginDir, String(message.path)));

                                        void commands.executeCommand("msg.mrs.saveExampleProject", fullPath);
                                    }

                                    break;
                                }

                                case "goto": {
                                    let file: string | undefined;
                                    let id: string | undefined;

                                    if (message.path && typeof message.path === "string") {
                                        file = message.path;
                                    }
                                    if (message.id && typeof message.id === "string") {
                                        id = message.id;
                                    }
                                    this.browseDocs(id, file);

                                    break;
                                }

                                default:
                            }
                        });
                }

                const docUrl = this.#docsWebviewPanel.webview.asWebviewUri(
                    Uri.file(path.join(mrsPluginDir, "docs/")));

                data = data.replace("\"style/", `"${docUrl.toString()}style/`);
                data = data.replace(/(src=")(.*)(\/images)/gm, `$1${docUrl.toString()}$3`);
                data = data.replace(/(href=")((?!http).*?\.html)(#.*?)?(")/gm, `$1$2$3$4 onclick="` +
                    `document.vscode.postMessage({ command: 'goto', path: '$2', id: '$3' });" `);

                this.#docsWebviewPanel.webview.html = data;
            } catch (reason) {
                this.#docsWebviewPanel = undefined;
                void window.showErrorMessage(`${String(reason)}`);
            }
        } else {
            this.#docsWebviewPanel.reveal();
        }

        if (id && this.#docsWebviewPanel) {
            // Remove leading # if there
            if (id.startsWith("#")) {
                id = id.slice(1);
            }

            if (fileChange) {
                // If there was a file change, wait till the page is loaded
                setTimeout(() => {
                    void this.#docsWebviewPanel?.webview.postMessage({ command: "goToId", id });
                }, 200);
            } else {
                void this.#docsWebviewPanel.webview.postMessage({ command: "goToId", id });
            }
        }
    };

    private handleDocsWebviewPanelDispose = () => {
        this.#docsWebviewPanel = undefined;
    };
}
