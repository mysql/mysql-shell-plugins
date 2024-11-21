/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import fs from "fs";
import os from "os";
import path, { join } from "path";

import {
    commands, env, ExtensionContext, ExtensionMode, TerminalExitStatus, Uri, ViewColumn, WebviewPanel, window,
} from "vscode";

import { DBType } from "../../frontend/src/supplement/ShellInterface/index.js";

import {
    IMySQLConnectionOptions, MySQLConnectionScheme,
} from "../../frontend/src/communication/MySQL.js";
import { IMrsServiceData } from "../../frontend/src/communication/ProtocolMrs.js";
import { DBEditorModuleId } from "../../frontend/src/modules/ModuleInfo.js";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { findExecutable } from "../../frontend/src/utilities/file-utilities.js";
import { MySQLShellLauncher } from "../../frontend/src/utilities/MySQLShellLauncher.js";
import { convertPathToCamelCase } from "../../frontend/src/utilities/string-helpers.js";
import { ExtensionHost } from "./ExtensionHost.js";
import {
    ICdmConnectionEntry,
    ICdmRestAuthAppEntry, ICdmRestContentFileEntry, ICdmRestContentSetEntry, ICdmRestDbObjectEntry, ICdmRestRootEntry,
    ICdmRestRouterEntry, ICdmRestSchemaEntry, ICdmRestServiceEntry, ICdmRestUserEntry, ICdmSchemaEntry,
} from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeDataModel.js";
import { showMessageWithTimeout, showModalDialog, switchVsCodeContext } from "./utilities.js";
import { openSqlEditorConnection, openSqlEditorSessionAndConnection } from "./utilitiesShellGui.js";
import { getRouterPortForConnection } from "../../frontend/src/modules/mrs/mrs-helpers.js";
import { MrsScriptBlocks } from "./MrsScriptBlocks.js";

export class MRSCommandHandler {
    #docsWebviewPanel?: WebviewPanel;
    #docsCurrentFile?: string;
    #host: ExtensionHost;
    #mrsScriptBlocks = new MrsScriptBlocks();
    #mrsScriptDecorationEnabled = false;

    public setup = (host: ExtensionHost): void => {
        this.#host = host;
        const context = host.context;

        this.#mrsScriptBlocks.setup(context);

        context.subscriptions.push(commands.registerCommand("msg.mrs.configureMySQLRestService",
            async (entry?: ICdmConnectionEntry) => {
                await this.configureMrs(entry);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.disableMySQLRestService",
            async (entry?: ICdmRestRootEntry) => {
                await this.configureMrs(entry?.parent, false);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.enableMySQLRestService",
            async (entry?: ICdmRestRootEntry) => {
                await this.configureMrs(entry?.parent, true);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.bootstrapLocalRouter",
            async (entry?: ICdmRestRootEntry) => {
                await this.bootstrapLocalRouter(context, entry);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.startLocalRouter",
            async (entry?: ICdmRestRootEntry) => {
                await this.startStopLocalRouter(context, entry);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.killLocalRouters",
            (entry?: ICdmRestRootEntry) => {
                let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                if (term === undefined) {
                    term = window.createTerminal("MySQL Router MRS");
                }

                if (term) {
                    term.show();
                    if (os.platform() === "win32") {
                        term.sendText("taskkill /IM mysqlrouter.exe /F", true);
                    } else {
                        term.sendText("killall -9 mysqlrouter", true);
                    }

                    // Make sure to remove the .pid file
                    try {
                        fs.unlinkSync(path.join(this.getRouterConfigDir(context, entry), "mysqlrouter.pid"));
                    } catch (error) {
                        //
                    }
                }

            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.stopLocalRouter",
            async (item?: ICdmRestRootEntry) => {
                await this.startStopLocalRouter(context, item, false);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.docs", () => {
            this.browseDocs();
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.docs.service", () => {
            this.browseDocs("rest-service-properties");
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteRouter",
            async (entry?: ICdmRestRouterEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS router ${item.value.address} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
                        try {
                            await item.backend?.mrs.deleteRouter(item.value.id);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS Router has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error deleting the MRS Router: ${String(error)}`);
                        }
                    }
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.addService", (entry?: ICdmRestRootEntry) => {
            if (entry) {
                const item = entry.treeItem;
                const connectionId = String(item.connectionId);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.editService",
            (entry?: ICdmRestServiceEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const connectionId = String(item.connectionId);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteService",
            async (entry?: ICdmRestServiceEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS service ${item.value.urlContextRoot} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
                        try {
                            await item.backend?.mrs.deleteService(item.value.id);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS service has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error adding the MRS service: ${String(error)}`);
                        }
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.setCurrentService",
            async (entry?: ICdmRestServiceEntry) => {
                if (entry) {
                    try {
                        const item = entry.treeItem;
                        await item.backend?.mrs.setCurrentService(item.value.id);
                        await commands.executeCommand("msg.refreshConnections");
                        showMessageWithTimeout("The MRS service has been set as the new default service.");

                    } catch (reason) {
                        void window.showErrorMessage(`Error setting the default MRS service: ${String(reason)}`);
                    }
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.exportCreateServiceSql",
            async (entry?: ICdmRestServiceEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Service`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    const convertedUrl = convertPathToCamelCase(item.value.urlContextRoot);
                    const overwrite = true;

                    const value = await window.showSaveDialog({
                        title: "Export REST Service SQL to file...",
                        defaultUri: Uri.file(`${os.homedir()}/${convertedUrl}.mrs.sql`),
                        saveLabel: "Export SQL File",
                    });

                    if (value === undefined) {
                        return;
                    }

                    const result = await item.backend.mrs.dumpServiceCreateStatement(
                        item.value.id, value.fsPath, overwrite);

                    if (result) {
                        void window.showInformationMessage(`The REST Service SQL was exported`);
                    } else {
                        void window.showErrorMessage(`Error creating the SQL for this REST Service`);
                    }

                } catch (reason) {
                    void window.showErrorMessage(`Error setting the default REST Service: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.exportCreateSchemaSql",
            async (entry?: ICdmRestSchemaEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Schema`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    const convertedUrl = convertPathToCamelCase(item.value.requestPath) + "."
                        + convertPathToCamelCase(item.value.hostCtx);
                    const overwrite = true;

                    const value = await window.showSaveDialog({
                        title: "Export REST Schema SQL to file...",
                        defaultUri: Uri.file(`${os.homedir()}/${convertedUrl}.mrs.sql`),
                        saveLabel: "Export SQL File",
                    });

                    if (value === undefined) {
                        return;
                    }

                    const result = await item.backend.mrs.dumpSchemaCreateStatement(
                        item.value.id, value.fsPath, overwrite);

                    if (result) {
                        void window.showInformationMessage(`The REST Schema SQL was exported`);
                    } else {
                        void window.showErrorMessage(`Error creating the SQL for this REST Schema`);
                    }

                } catch (reason) {
                    void window.showErrorMessage(`Error setting the default REST Schema: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.exportCreateDbObjectSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST DB Object`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined ||
                        item.value.schemaRequestPath === undefined || item.value.hostCtx === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST DB Object`);

                        return;
                    }

                    const convertedUrl = convertPathToCamelCase(item.value.requestPath) + "." +
                        convertPathToCamelCase(item.value.schemaRequestPath) + "." +
                        convertPathToCamelCase(item.value.hostCtx);
                    const overwrite = true;

                    const value = await window.showSaveDialog({
                        title: "Export REST DB Object SQL to file...",
                        defaultUri: Uri.file(`${os.homedir()}/${convertedUrl}.mrs.sql`),
                        saveLabel: "Export SQL File",
                    });

                    if (value === undefined) {
                        return;
                    }

                    const result = await item.backend.mrs.dumpDbObjectCreateStatement(
                        item.value.id, value.fsPath, overwrite);

                    if (result) {
                        void window.showInformationMessage(`The REST DB Object SQL was exported`);
                    } else {
                        void window.showErrorMessage(`Error creating the SQL for this REST DB Object`);
                    }

                } catch (reason) {
                    void window.showErrorMessage(`Error setting the default REST DB Object: ${String(reason)}`);
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.copyCreateServiceSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Service`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST Service`);

                        return;
                    }

                    const result = await item.backend.mrs.getServiceCreateStatement(
                        item.value.id);

                    void env.clipboard.writeText(result).then(() => {
                        showMessageWithTimeout("The CREATE statement was copied to the system clipboard");
                    });

                } catch (reason) {
                    void window.showErrorMessage(`Error getting the SQL for this REST Service`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.copyCreateSchemaSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Schema`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST Schema`);

                        return;
                    }

                    const result = await item.backend.mrs.getSchemaCreateStatement(
                        item.value.id);

                    void env.clipboard.writeText(result).then(() => {
                        showMessageWithTimeout("The CREATE statement was copied to the system clipboard");
                    });

                } catch (reason) {
                    void window.showErrorMessage(`Error getting the SQL for this REST Schema`);
                }
            }));
        context.subscriptions.push(commands.registerCommand("msg.mrs.copyCreateDbObjectSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST DB Object`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST DB Object`);

                        return;
                    }

                    const result = await item.backend.mrs.getDbObjectCreateStatement(
                        item.value.id);

                    void env.clipboard.writeText(result).then(() => {
                        showMessageWithTimeout("The CREATE statement was copied to the system clipboard");
                    });

                } catch (reason) {
                    void window.showErrorMessage(`Error getting the SQL for this REST DB Object`);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.copyCreateContentSetSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Content Set`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST Content Set`);

                        return;
                    }

                    const result = await item.backend.mrs.getContentSetCreateStatement(
                        item.value.id);

                    void env.clipboard.writeText(result).then(() => {
                        showMessageWithTimeout("The CREATE statement was copied to the system clipboard");
                    });

                } catch (reason) {
                    void window.showErrorMessage(`Error getting the SQL for this REST Content Set`);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.openContentSetRequestPath",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`No tree item given when calling msg.mrs.openContentSetRequestPath`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item.value) {
                        const o = item.value;
                        const port = getRouterPortForConnection(entry.treeItem.connectionId);
                        let url = (o.hostCtx ?? "") + o.requestPath + "/";

                        if (url.startsWith("/")) {
                            url = `https://localhost:${port}${url}`;
                        } else {
                            url = `https://${url}`;
                        }

                        await env.openExternal(Uri.parse(url));
                    }

                } catch (reason) {
                    void window.showErrorMessage(
                        `An error occurred while opening the REST Content Set request path. ${String(reason)}`);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.copyCreateContentFileSql",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (!entry) {
                    void window.showErrorMessage(`Error creating the SQL for this REST Content File`);

                    return;
                }

                try {
                    const item = entry.treeItem;
                    if (item === undefined || item.value === undefined) {
                        void window.showErrorMessage(`Error creating the SQL for this REST Content File`);

                        return;
                    }

                    const result = await item.backend.mrs.getContentFileCreateStatement(
                        item.value.id);

                    void env.clipboard.writeText(result).then(() => {
                        showMessageWithTimeout("The CREATE statement was copied to the system clipboard");
                    });

                } catch (reason) {
                    void window.showErrorMessage(
                        `Error getting the SQL for this REST Content File.  ${String(reason)}`);
                }
            }));

        host.context.subscriptions.push(commands.registerCommand("msg.mrs.exportServiceSdk",
            async (entry?: ICdmRestServiceEntry) => {
                if (entry && entry.treeItem && entry.treeItem.value && this.#host.currentProvider) {
                    const item = entry.treeItem;

                    try {
                        const convertedUrl = convertPathToCamelCase(item.value.urlContextRoot);
                        const value = await window.showSaveDialog({
                            title: "Export REST Service SDK Files...",
                            defaultUri: Uri.file(`${os.homedir()}/${convertedUrl}.mrs.sdk`),
                            saveLabel: "Export SDK Files",
                        });

                        if (value !== undefined) {
                            const connectionId = entry.parent.parent.id;

                            void this.#host.currentProvider.runCommand("job", [
                                { requestType: "showModule", parameter: DBEditorModuleId },
                                {
                                    requestType: "showPage", parameter: {
                                        module: DBEditorModuleId, page: connectionId,
                                    },
                                },
                                {
                                    requestType: "showMrsSdkExportDialog", parameter: {
                                        serviceId: item.value.id,
                                        routerPort: getRouterPortForConnection(connectionId),
                                        connectionId,
                                        connectionDetails: entry.parent.parent.treeItem.details,
                                        directory: value.fsPath,
                                    },
                                },
                            ], "newConnection");
                        }
                    } catch (e) {
                        // do nothing
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.rebuildMrsSdk",
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
                            await sqlEditor.startSession(String(connection.treeItem.details.id) + "MrsSdkGeneration");

                            statusbarItem.text = "$(loading~spin) Opening Database Connection ...";
                            await openSqlEditorConnection(sqlEditor, connection.treeItem.details.id, (message) => {
                                statusbarItem.text = "$(loading~spin) " + message;
                            });

                            await sqlEditor.mrs.dumpSdkServiceFiles(directory.fsPath);
                            showMessageWithTimeout("MRS SDK Files exported successfully.");
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteSchema",
            async (entry?: ICdmRestSchemaEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const answer = await window.showInformationMessage(
                        `Are you sure the MRS schema ${item.value.name} should be deleted?`, "Yes", "No");

                    if (answer === "Yes") {
                        try {
                            await entry.treeItem.backend.mrs.deleteSchema(item.value.id, item.value.serviceId);
                            await commands.executeCommand("msg.refreshConnections");
                            showMessageWithTimeout("The MRS schema has been deleted successfully.");
                        } catch (error) {
                            void window.showErrorMessage(`Error removing an MRS schema: ${String(error)}`);
                        }
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editSchema",
            (entry?: ICdmRestSchemaEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const connectionId = String(item.connectionId);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.addSchema",
            async (entry?: ICdmSchemaEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const connectionId = String(item.connectionId);
                    const provider = this.#host.currentProvider;
                    if (provider) {
                        // Check if there is at least one MRS Service
                        const services = await item.backend.mrs.listServices();

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

        context.subscriptions.push(commands.registerCommand("msg.mrs.copyDbObjectRequestPath",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (entry) {
                    const dbObjectPath = this.buildDbObjectRequestPath(entry);
                    if (dbObjectPath) {
                        await env.clipboard.writeText(String(dbObjectPath));
                        showMessageWithTimeout("The DB Object Path was copied to the system clipboard");
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.openDbObjectRequestPath",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (entry) {
                    const dbObjectPath = this.buildDbObjectRequestPath(entry);
                    if (dbObjectPath) {
                        await env.openExternal(dbObjectPath);
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.openContentFileRequestPath",
            async (entry?: ICdmRestContentFileEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const o = item.value;
                        const port = getRouterPortForConnection(entry.treeItem.connectionId);
                        let url = (o.hostCtx ?? "") + (o.contentSetRequestPath ?? "") + o.requestPath;

                        if (url.startsWith("/")) {
                            url = `https://localhost:${port}${url}`;
                        } else {
                            url = `https://${url}`;
                        }

                        await env.openExternal(Uri.parse(url));
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteDbObject",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const backend = item.backend;

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
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editAuthApp",
            (entry?: ICdmRestAuthAppEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    const connectionId = String(item.connectionId);
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


        context.subscriptions.push(commands.registerCommand("msg.mrs.addAuthApp",
            (entry?: ICdmRestServiceEntry) => {
                try {
                    if (entry) {
                        const item = entry.treeItem;
                        if (item.value) {
                            const connectionId = String(item.connectionId);
                            const provider = this.#host.currentProvider;
                            if (provider) {
                                void provider.runCommand("job", [
                                    { requestType: "showModule", parameter: DBEditorModuleId },
                                    {
                                        requestType: "showPage",
                                        parameter: { module: DBEditorModuleId, page: connectionId },
                                    },
                                    { requestType: "showMrsAuthAppDialog", parameter: { service: item.value } },
                                ], "newConnection");
                            }
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error while adding a new MRS Authentication App: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addContentSet",
            (entry?: ICdmRestServiceEntry) => {
                try {
                    if (entry) {
                        const item = entry.treeItem;
                        if (item.connectionId) {
                            const connectionId = String(item.connectionId);
                            const provider = this.#host.currentProvider;
                            if (provider) {
                                void provider.runCommand("job", [
                                    { requestType: "showModule", parameter: DBEditorModuleId },
                                    {
                                        requestType: "showPage", parameter: {
                                            module: DBEditorModuleId, page: connectionId,
                                        },
                                    },
                                    {
                                        requestType: "showMrsContentSetDialog", parameter: {
                                        },
                                    },
                                ], "newConnection");
                            }
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error while adding a new MRS Content Set: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addOpenApiUiContentSet",
            (entry?: ICdmRestServiceEntry) => {
                try {
                    if (entry) {
                        const item = entry.treeItem;
                        if (item.connectionId) {
                            const connectionId = String(item.connectionId);
                            const provider = this.#host.currentProvider;
                            if (provider) {
                                void provider.runCommand("job", [
                                    { requestType: "showModule", parameter: DBEditorModuleId },
                                    {
                                        requestType: "showPage", parameter: {
                                            module: DBEditorModuleId, page: connectionId,
                                        },
                                    },
                                    {
                                        requestType: "showMrsContentSetDialog", parameter: {
                                            directory: "open-api-ui",
                                        },
                                    },
                                ], "newConnection");
                            }
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error while adding a the OpenAPI UI: ${String(reason)}`);
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteAuthApp",
            async (entry?: ICdmRestAuthAppEntry) => {
                try {
                    if (entry) {
                        const serviceId = entry.parent.treeItem.value.id;
                        const item = entry.treeItem;
                        if (item.value?.name !== undefined && serviceId) {
                            const backend = item.backend;
                            const answer = await window.showInformationMessage(
                                `Are you sure the MRS authentication app ${item.value.name} should be deleted?`,
                                "Yes", "No");

                            if (answer === "Yes") {
                                await backend.mrs.deleteAuthApp(serviceId, item.value.id!);

                                // TODO: refresh only the affected connection.
                                void commands.executeCommand("msg.refreshConnections");
                                showMessageWithTimeout(`The MRS Authentication App ${item.value.name} ` +
                                    `has been deleted.`);
                            }
                        } else {
                            throw new Error("Unable to identify the id of the MRS service or the Auth App name.");
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the MRS Authentication App: ${String(reason)}`);
                }

            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteUser",
            async (entry?: ICdmRestUserEntry) => {
                try {
                    if (entry) {
                        const item = entry.treeItem;
                        if (item.value.id && item.value.name) {
                            const backend = item.backend;

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
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the MRS User: ${String(reason)}`);
                }

            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.addUser", (entry?: ICdmRestAuthAppEntry) => {
            if (entry) {
                const item = entry.treeItem;
                if (item.value) {
                    const connectionId = String(item.connectionId);
                    const provider = this.#host.currentProvider;
                    if (provider) {
                        void provider.runCommand("job", [
                            { requestType: "showModule", parameter: DBEditorModuleId },
                            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: connectionId } },
                            { requestType: "showMrsUserDialog", parameter: { authApp: item.value } },
                        ], "newConnection");
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editUser", (entry?: ICdmRestUserEntry) => {
            const item = entry?.treeItem;
            const backend = item?.backend;
            try {
                if (backend && item.value && item.value.authAppId) {
                    backend.mrs.getAuthApp(item.value.authAppId).then((authApp) => {
                        if (authApp) {
                            const connectionId = String(item.connectionId);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.addFolderAsContentSet",
            async (directory?: Uri) => {
                if (directory) {
                    const connection = await host.determineConnection(DBType.MySQL, false, false);
                    if (connection) {
                        const provider = this.#host.currentProvider;
                        if (provider) {
                            void provider.runCommand("job", [
                                { requestType: "showModule", parameter: DBEditorModuleId },
                                {
                                    requestType: "showPage", parameter: {
                                        module: DBEditorModuleId, page: String(connection.treeItem.details.id),
                                    },
                                },
                                {
                                    requestType: "showMrsContentSetDialog", parameter: {
                                        directory: directory.fsPath,
                                    },
                                },
                            ], "newConnection");
                        }
                    } else {
                        void window.showErrorMessage(
                            "Please open the MySQL Shell extension prior to using this feature and ensure " +
                            "that there is at least one MySQL connection available.");
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteContentSet",
            async (entry?: ICdmRestContentSetEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const backend = item.backend;

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
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.dumpSchemaToJSONFile",
            async (entry?: ICdmRestSchemaEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const backend = item.backend;

                        const convertedPath = convertPathToCamelCase(item.value.requestPath);
                        await window.showSaveDialog({
                            title: "REST Schema Dump...",
                            saveLabel: "Select the target file",
                            defaultUri: Uri.file(`${os.homedir()}/${convertedPath}.mrs.json`),
                            filters: {
                                // eslint-disable-next-line @typescript-eslint/naming-convention
                                JSON: ["mrs.json"],
                            },
                        }).then(async (value) => {
                            if (value !== undefined) {
                                try {
                                    const path = value.fsPath;
                                    await backend.mrs.dumpSchema(path, item.value.serviceId, undefined, item.value.id);
                                    showMessageWithTimeout("The REST Schema has been dumped successfully.");
                                } catch (error) {
                                    void window.showErrorMessage(
                                        `Error dumping the REST Schema: ${String(error)}`);
                                }
                            }
                        });
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.dumpObjectToJSONFile",
            async (entry?: ICdmRestDbObjectEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const backend = item.backend;

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
                                    await backend.mrs.dumpObject(path, item.value.serviceId, undefined,
                                        item.value.dbSchemaId, undefined, item.value.id);
                                    showMessageWithTimeout("The REST Database Object has been dumped successfully.");
                                } catch (error) {
                                    void window.showErrorMessage(
                                        `Error dumping the REST Database Object: ${String(error)}`);
                                }
                            }
                        });
                    }
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.loadSchemaFromJSONFile",
            async (entry?: ICdmRestServiceEntry | Uri) => {
                if (!entry) {
                    return;
                }

                if (!(entry instanceof Uri)) {
                    if (!entry.treeItem.value) {
                        return;
                    }

                    const backend = entry.treeItem.backend;

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
                                await backend.mrs.loadSchema(path, entry.treeItem.value.id);
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
                } else {
                    const connection = await host.determineConnection(DBType.MySQL);
                    if (connection) {
                        const sqlEditor = new ShellInterfaceSqlEditor();
                        const statusbarItem = window.createStatusBarItem();
                        try {
                            statusbarItem.text = "$(loading~spin) Starting Database Session ...";
                            statusbarItem.show();

                            statusbarItem.text = "$(loading~spin) Starting Database Session ...";
                            await sqlEditor.startSession(String(connection.treeItem.details.id) + "MRSContentSetDlg");

                            statusbarItem.text = "$(loading~spin) Opening Database Connection ...";
                            await openSqlEditorConnection(sqlEditor, connection.treeItem.details.id, (message) => {
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
                                    return service.fullServicePath ?? "";
                                });
                                const serviceHostCtx = await window.showQuickPick(items, {
                                    title: "Select a MRS Service to load the MRS schema dump",
                                    matchOnDescription: true,
                                    placeHolder: "Type the name of an existing MRS Service",
                                });

                                service = services.find((candidate) => {
                                    return candidate.fullServicePath === serviceHostCtx;
                                });

                            }

                            if (service !== undefined) {
                                statusbarItem.text = "$(loading~spin) Loading REST Schema ...";
                                await sqlEditor.mrs.loadSchema(entry.fsPath, service.id);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.loadObjectFromJSONFile",
            async (entry?: ICdmRestSchemaEntry) => {
                if (entry) {
                    const item = entry.treeItem;
                    if (item.value) {
                        const backend = item.backend;

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
                                    await backend.mrs.loadObject(path, item.value.serviceId, undefined, item.value.id);
                                    void commands.executeCommand("msg.refreshConnections");
                                    showMessageWithTimeout("The REST Database Object has been loaded successfully.");
                                } catch (error) {
                                    void window.showErrorMessage(
                                        `Error loading REST Database Object: ${String(error)}`);
                                }
                            }
                        });
                    }
                }
            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.saveExampleProject",
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

        const enableAutomaticDecoration = async (status: boolean) => {
            this.#mrsScriptDecorationEnabled = status;

            await switchVsCodeContext(
                "Oracle.mysql-shell-for-vs-code.mrsScriptDecorationEnabled",
                this.#mrsScriptDecorationEnabled);

            void this.#mrsScriptBlocks.enableAutomaticDecoration(this.#mrsScriptDecorationEnabled);
        };

        context.subscriptions.push(commands.registerCommand("msg.mrs.enableScriptHelpers",
            async () => {
                await enableAutomaticDecoration(true);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.disableScriptHelpers",
            async () => {
                await enableAutomaticDecoration(false);
            }));
    };

    private configureMrs = async (entry?: ICdmConnectionEntry, enableMrs?: boolean): Promise<void> => {
        let answer: string | undefined = "Yes";

        if (enableMrs === undefined) {
            answer = await window.showInformationMessage(
                `Do you want to configure this instance for MySQL REST Service Support? ` +
                `This operation will create the MRS metadata database schema.`, "Yes", "No");
        }

        if (entry && answer === "Yes") {
            const sqlEditor = new ShellInterfaceSqlEditor();
            try {
                await openSqlEditorSessionAndConnection(sqlEditor, entry.treeItem.details.id,
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

    private getRouterConfigDir = (context: ExtensionContext, entry?: ICdmRestRootEntry): string => {
        const shellConfDir = MySQLShellLauncher.getShellUserConfigDir(
            context.extensionMode === ExtensionMode.Development);
        const routerConfigBaseDir = path.join(shellConfDir, "plugin_data", "mrs_plugin", "router_configs");

        return (process.env.MYSQL_ROUTER_CUSTOM_DIR !== undefined)
            ? process.env.MYSQL_ROUTER_CUSTOM_DIR
            : path.join(routerConfigBaseDir, entry?.parent.id.toString() ?? "default", "mysqlrouter");
    };

    private getEmbeddedRouterBinPath = (context: ExtensionContext): string | undefined => {
        const routerBinDir = join(context.extensionPath, "router", "bin");

        if (fs.existsSync(routerBinDir)) {
            return routerBinDir;
        }

        return undefined;
    };

    private bootstrapLocalRouter = async (context: ExtensionContext,
        entry?: ICdmRestRootEntry, waitAndClosedWhenFinished = false): Promise<TerminalExitStatus | undefined> => {
        if (entry) {
            const routerBinDir = this.getEmbeddedRouterBinPath(context);

            if (routerBinDir !== undefined || findExecutable("mysqlrouter_bootstrap").length > 0) {
                const shellConfDir = MySQLShellLauncher.getShellUserConfigDir(
                    context.extensionMode === ExtensionMode.Development);
                const certDir = path.join(shellConfDir, "plugin_data", "gui_plugin", "web_certs");

                const mysqlConnOptions = entry.parent.treeItem.details.options as IMySQLConnectionOptions;
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

                const routerConfigDir = this.getRouterConfigDir(context, entry);

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
                } else {
                    fs.mkdirSync(routerConfigDir, { recursive: true });
                }

                // cSpell:ignore consolelog
                if (term !== undefined) {
                    term.show();
                    const routerBootstrapPath = routerBinDir !== undefined
                        ? join(routerBinDir, "mysqlrouter_bootstrap") : "mysqlrouter_bootstrap";
                    const basePort = 6446 + (entry?.parent.id ?? 0) * 4;
                    const httpPort = 8443 + (entry?.parent.id ?? 0);
                    let bootstrapCommand =
                        `${routerBootstrapPath} ${connString} --mrs --directory "${routerConfigDir}" ` +
                        `"--conf-set-option=http_server.ssl_cert=${path.join(certDir, "server.crt")}" ` +
                        `"--conf-set-option=http_server.ssl_key=${path.join(certDir, "server.key")}" ` +
                        `--conf-set-option=logger.level=INFO --conf-set-option=logger.sinks=consolelog ` +
                        `--conf-base-port=${basePort.toString()} ` +
                        `--conf-set-option=http_server.port=${httpPort.toString()}`;
                    // Add --mrs-developer option to set the development user for this router instance
                    if (mysqlConnOptions.user) {
                        bootstrapCommand += ` --mrs-developer "${mysqlConnOptions.user}"`;
                    }
                    term.sendText(bootstrapCommand, !waitAndClosedWhenFinished);

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
                    "The mysqlrouter_bootstrap executable could not be found in any directory listed in the " +
                    "PATH environment variable. This seems to indicate that MySQL Router has not been installed. " +
                    "Do you want to download and install the MySQL Router now?",
                    "Yes", "No");
                if (answer === "Yes") {
                    const labsUrl = "https://downloads.mysql.com/snapshots/pb/mysql-8.2.0-labs-mrs7-preview-release/";
                    let fileUrl: string;

                    switch (os.platform()) {
                        case "darwin": {
                            switch (os.arch()) {
                                case "arm":
                                case "arm64": {
                                    fileUrl = `${labsUrl}mysql-router-8.2.0-labs-mrs-7-macos13-arm64.dmg`;
                                    break;
                                }
                                default: {
                                    fileUrl = `${labsUrl}mysql-router-8.2.0-labs-mrs-7-macos13-x86_64.dmg`;
                                    break;
                                }
                            }
                            break;
                        }
                        case "win32": {
                            fileUrl = `${labsUrl}mysql-router-8.2.0-labs-mrs-7-winx64.msi`;
                            break;
                        }
                        default: {
                            // Default to generic URL
                            fileUrl = "https://labs.mysql.com";
                            break;
                        }
                    }

                    await env.openExternal(Uri.parse(fileUrl));

                    await window.showInformationMessage(
                        "After installing MySQL Router, VS Code needs to be restarted to read " +
                        "the updated PATH environment variable. Please manually restart VS Code after " +
                        "completing the installation process.",
                        "OK");
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

    private startStopLocalRouter = async (context: ExtensionContext,
        entry?: ICdmRestRootEntry, start = true): Promise<void> => {
        if (entry) {
            const routerBinDir = this.getEmbeddedRouterBinPath(context);

            if (routerBinDir !== undefined || findExecutable("mysqlrouter")) {
                const routerConfigDir = this.getRouterConfigDir(context, entry);

                if (fs.existsSync(routerConfigDir)) {
                    let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                    if (term === undefined) {
                        term = window.createTerminal("MySQL Router MRS");
                    } else {
                        term.show();
                    }

                    if (start) {
                        // If there is a pid file, try to kill the router and remove the pid file
                        const pidFilePath = path.join(this.getRouterConfigDir(context, entry), "mysqlrouter.pid");
                        try {
                            await fs.promises.access(pidFilePath);
                            const answer = await window.showInformationMessage(
                                `A MySQL Router instance might already to be running. `
                                + "Do you want to force a start/restart of the MySQL Router?",
                                "Yes", "No");
                            if (answer === "Yes") {
                                if (os.platform() === "win32") {
                                    term.sendText("taskkill /IM mysqlrouter.exe /F", true);
                                } else {
                                    term.sendText("killall -9 mysqlrouter", true);
                                }

                                // Make sure to remove the .pid file
                                await fs.promises.unlink(pidFilePath);
                            } else {
                                return;
                            }
                        } catch (error) {
                            // do nothing
                        }
                    }

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

                    if (os.platform() === "win32") {
                        term.sendText("Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser", true);
                        term.sendText("clear", true);
                    }
                    term.sendText(cmd, true);
                } else {
                    if (start) {
                        const answer = await window.showInformationMessage(
                            `The MySQL Router config directory ${routerConfigDir} was not found. `
                            + "Do you want to bootstrap a local MySQL Router instance for development now?",
                            "Yes", "No");
                        if (answer === "Yes") {
                            await this.bootstrapLocalRouter(this.#host.context, entry, true);
                            void this.startStopLocalRouter(this.#host.context, entry);
                        }
                    } else {
                        await window.showInformationMessage(
                            `The MySQL Router config directory ${routerConfigDir} was not found. ` +
                            "Please bootstrap a local MySQL Router instance for development first.",
                            "OK");
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

    private buildDbObjectRequestPath = (entry: ICdmRestDbObjectEntry): Uri | undefined => {
        const item = entry.treeItem;
        if (item.value) {
            try {
                const o = item.value;
                const port = getRouterPortForConnection(entry.treeItem.connectionId);
                let url = (o.hostCtx ?? "") + (o.schemaRequestPath ?? "") + o.requestPath;

                if (url.startsWith("/")) {
                    url = `https://localhost:${port}${url}`;
                } else {
                    url = `https://${url}`;
                }

                return Uri.parse(url);
            } catch (error) {
                let errorMsg = `An error occurred when trying to build the DB Object Path.`;
                errorMsg += ` Error: ${error instanceof Error ? error.message : String(error)}`;
                void window.showErrorMessage(errorMsg);
            }
        }
    };
}
