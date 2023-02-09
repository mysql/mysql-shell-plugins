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

import { IShellDictionary } from "../../frontend/src/communication";
import { commands, env, ExtensionContext, TerminalExitStatus, Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { DialogResponseClosure, DialogType } from "../../frontend/src/app-logic/Types";
import {
    IMrsDbObjectFieldData, IMrsAuthAppData, IMrsContentSetData,
    IMrsDbObjectData, IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../../frontend/src/communication/";

import { DBType, ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface";

import { ExtensionHost } from "./ExtensionHost";
import {
    ConnectionMySQLTreeItem, ConnectionsTreeBaseItem, MrsDbObjectTreeItem,
    MrsAuthAppTreeItem, MrsUserTreeItem,
} from "./tree-providers/ConnectionsTreeProvider";
import { MrsContentSetTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsContentSetTreeItem";
import { MrsSchemaTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsServiceTreeItem";
import { MrsTreeItem } from "./tree-providers/ConnectionsTreeProvider/MrsTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { findExecutable, showMessageWithTimeout, showModalDialog } from "./utilities";
import { openSqlEditorSessionAndConnection, openSqlEditorConnection } from "./utilitiesShellGui";
import { DialogWebviewManager } from "./web-views/DialogWebviewProvider";
import { homedir, platform } from "os";
import path, { join } from "path";
import { cpSync, existsSync, readFileSync, renameSync, rmSync } from "fs";
import { IMySQLConnectionOptions, MySQLConnectionScheme } from "../../frontend/src/communication/MySQL";
import { MySQLShellLauncher } from "../../frontend/src/utilities/MySQLShellLauncher";

export class MRSCommandHandler {
    protected docsWebviewPanel?: WebviewPanel;
    private context: ExtensionContext;

    private dialogManager = new DialogWebviewManager();

    public setup = (context: ExtensionContext, host: ExtensionHost): void => {
        this.context = context;

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

        context.subscriptions.push(commands.registerCommand("msg.mrs.bootstrapLocalRouter",
            async (item?: MrsTreeItem) => {
                await this.bootstrapLocalRouter(context, item);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.runLocalRouter",
            async (item?: MrsTreeItem) => {
                await this.runLocalRouter(context, item);
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.docs", () => {
            this.browseDocs();
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.docs.service", () => {
            this.browseDocs("rest-service-properties");
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
                        await item.entry.backend?.mrs.setCurrentService(item.value.id);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.editAuthApp", (item?: MrsAuthAppTreeItem) => {
            if (item?.entry.backend) {
                this.showMrsAuthAppDialog(item.entry.backend, item.value).catch((reason) => {
                    void window.showErrorMessage(`${String(reason)}`);
                });
            }
        }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.addAuthApp",
            (item?: MrsServiceTreeItem) => {
                try {
                    if (item?.entry.backend && item.value) {
                        this.showMrsAuthAppDialog(item.entry.backend, undefined, item.value).catch((reason) => {
                            void window.showErrorMessage(`${String(reason)}`);
                        });
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error adding a new Authentication App: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteAuthApp",
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
                            showMessageWithTimeout(`The Authentication App ${item.value.name} has been deleted.`);
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the Authentication App: ${String(reason)}`);
                }

            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.deleteUser",
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
                            showMessageWithTimeout(`The Authentication App ${item.value.name} has been deleted.`);
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error deleting the Authentication App: ${String(reason)}`);
                }

            }));


        context.subscriptions.push(commands.registerCommand("msg.mrs.addUser",
            (item?: MrsAuthAppTreeItem) => {
                try {
                    if (item?.entry.backend && item.value) {
                        this.showMrsUserDialog(item.entry.backend, item.value).catch((reason) => {
                            void window.showErrorMessage(`${String(reason)}`);
                        });
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error adding a new User: ${String(reason)}`);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editUser",
            async (item?: MrsUserTreeItem) => {
                const backend = item?.entry.backend;
                try {
                    if (backend && item.value && item.value.authAppId) {
                        const authApp = await backend.mrs.getAuthApp(item.value.authAppId);
                        if (authApp) {
                            this.showMrsUserDialog(backend, authApp, item.value).catch((reason) => {
                                void window.showErrorMessage(`${String(reason)}`);
                            });
                        } else {
                            throw new Error("Unable to find authApp");
                        }
                    }
                } catch (reason) {
                    void window.showErrorMessage(`Error adding a new User: ${String(reason)}`);
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.dumpSchemaToJSONFile",
            async (item?: MrsSchemaTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showSaveDialog({
                        title: "REST Schema Dump...",
                        saveLabel: "Select the target file",
                        defaultUri: Uri.file(`${homedir()}/${item.value.name}.mrs.json`),
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.dumpObjectToJSONFile",
            async (item?: MrsDbObjectTreeItem) => {
                if (item?.entry.backend && item.value) {
                    const backend = item.entry.backend;

                    await window.showSaveDialog({
                        title: "REST Database Object Dump...",
                        saveLabel: "Select the target file",
                        defaultUri: Uri.file(`${homedir()}/${item.value.name}.mrs.json`),
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

        context.subscriptions.push(commands.registerCommand("msg.mrs.loadSchemaFromJSONFile",
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
                                await sqlEditor.mrs.loadSchema(item.path, service.id);
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


        context.subscriptions.push(commands.registerCommand("msg.mrs.saveExampleProject",
            async (exampleCodePath: Uri) => {
                const path = exampleCodePath.fsPath;
                const m = path.match(/([^/]*)\/*$/);
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
                    defaultUri: Uri.file(`${homedir()}/Documents`),
                }).then(async (value) => {
                    if (value !== undefined) {
                        try {
                            const targetPath = Uri.joinPath(value[0], dirName);
                            cpSync(path, targetPath.fsPath, { recursive: true });

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

    private bootstrapLocalRouter = async (context: ExtensionContext,
        item?: MrsTreeItem, waitAndClosedWhenFinished = false): Promise<TerminalExitStatus | undefined> => {
        if (item) {
            if (findExecutable("mysqlrouter_bootstrap")) {
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
                if (platform() === "win32") {
                    routerConfigDir = join(homedir(), "AppData", "Roaming", "MySQL", "mysqlrouter");
                } else {
                    routerConfigDir = join(homedir(), ".mysqlrouter");
                }

                if (existsSync(routerConfigDir)) {
                    const answer = await window.showInformationMessage(
                        `The MySQL Router config directory ${routerConfigDir} already exists. `
                        + "Do you want to rename the existing directory and proceed?",
                        "Yes", "No");
                    if (answer === "Yes") {
                        try {
                            renameSync(routerConfigDir, routerConfigDir + "_old");
                        } catch (e) {
                            rmSync(routerConfigDir + "_old", { recursive: true, force: true });
                            renameSync(routerConfigDir, routerConfigDir + "_old");
                        }
                    } else {
                        return;
                    }
                }

                // cSpell:ignore consolelog
                if (term !== undefined) {
                    term.show();
                    term.sendText(
                        `mysqlrouter_bootstrap ${connString} --mrs --directory ${routerConfigDir} ` +
                        `--conf-set-option=http_server.ssl_cert=${path.join(certDir, "server.crt")} ` +
                        `--conf-set-option=http_server.ssl_key=${path.join(certDir, "server.key")} ` +
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
                    void env.openExternal(Uri.parse("https://labs.mysql.com"));
                }
            }
        }
    };

    private runLocalRouter = async (context: ExtensionContext, item?: MrsTreeItem): Promise<void> => {
        if (item) {
            if (findExecutable("mysqlrouter")) {
                let routerConfigDir: string;
                if (platform() === "win32") {
                    routerConfigDir = join(homedir(), "AppData", "Roaming", "MySQL", "mysqlrouter");
                } else {
                    routerConfigDir = join(homedir(), ".mysqlrouter");
                }

                if (existsSync(routerConfigDir)) {
                    let term = window.terminals.find((t) => { return t.name === "MySQL Router MRS"; });
                    if (term === undefined) {
                        term = window.createTerminal("MySQL Router MRS");
                    }

                    if (term !== undefined) {
                        term.show();
                        term.sendText(`mysqlrouter -c ${path.join(routerConfigDir, "mysqlrouter.conf")}`, true);
                    }
                } else {
                    const answer = await window.showInformationMessage(
                        `The MySQL Router config directory ${routerConfigDir} was not found. `
                        + "Do you want to bootstrap a local MySQL Router instance for development now?",
                        "Yes", "No");
                    if (answer === "Yes") {
                        await this.bootstrapLocalRouter(context, item, true);
                        void this.runLocalRouter(context, item);
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

    private createNewDbObject = async (backend: ShellInterfaceSqlEditor,
        item: ConnectionsTreeBaseItem, objectType: string): Promise<IMrsDbObjectData> => {

        const params = await backend.mrs.getDbObjectFields(undefined, item.name,
            undefined, undefined, item.schema, item.dbType);

        // Add entry for <new> item
        params.push({
            id: "",
            dbObjectId: "0",
            position: 0,
            name: "<new>",
            bindFieldName: "",
            datatype: "STRING",
            mode: "IN",
            comments: "",
        });

        const dbObject: IMrsDbObjectData = {
            comments: "",
            crudOperations: (objectType === "PROCEDURE") ? ["UPDATE"] : ["READ"],
            crudOperationFormat: "FEED",
            dbSchemaId: "",
            enabled: 1,
            id: "",
            name: item.name,
            objectType,
            requestPath: `/${item.name}`,
            requiresAuth: 1,
            rowUserOwnershipEnforced: 0,
            serviceId: "",
            autoDetectMediaType: 0,
            fields: params,
        };

        const services = await backend.mrs.listServices();
        let service;
        if (services.length === 1) {
            service = services[0];
        } else if (services.length > 1) {
            // Lookup default service
            service = services.find((service) => {
                return service.isCurrent;
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
                        item.schema, `/${item.schema}`, true, null, undefined, undefined);

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
     * @param authApp If not assigned then a new service must be created otherwise this contains the existing values.
     * @param service If the authApp is not assigned, the service must be available, so that we can create
     * a new authApp for this service.
     */
    private showMrsAuthAppDialog = async (backend: ShellInterfaceSqlEditor,
        authApp?: IMrsAuthAppData, service?: IMrsServiceData): Promise<void> => {

        const title = authApp
            ? "Adjust the MySQL REST Authentication App Configuration"
            : "Enter Configuration Values for the New MySQL REST Authentication App";
        const tabTitle = authApp
            ? "Edit REST Authentication App"
            : "Add REST Authentication App";


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
            type: DialogType.MrsAuthenticationApp,
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

        const response = await this.dialogManager.showDialog(request, tabTitle);
        if (!response || response.closure !== DialogResponseClosure.Accept) {
            return;
        }

        const authVendorId = authVendors.find((vendor) => {
            return response.data?.authVendorName === vendor.name;
        })?.id ?? "";

        const defaultRoleId = roles.find((role) => {
            return response.data?.defaultRoleName === role.caption;
        })?.id ?? null;


        if (authApp) {
            if (response.data) {
                try {
                    await backend.mrs.updateAuthApp(authApp.id as string, {
                        name: response.data.name as string,
                        description: response.data.description as string,
                        url: response.data.url as string,
                        urlDirectAuth: response.data.urlDirectAuth as string,
                        accessToken: response.data.accessToken as string,
                        appId: response.data.appId as string,
                        enabled: response.data.enabled as boolean,
                        limitToRegisteredUsers: response.data.limitToRegisteredUsers as boolean,
                        defaultRoleId,
                    });

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS service has been updated.", 5000);
                } catch (error) {
                    void window.showErrorMessage(`Error while adding MySQL REST service: ${String(error)}`);
                }
            }
        } else {
            if (response.data) {
                try {
                    if (service) {
                        await backend.mrs.addAuthApp(service.id, {
                            authVendorId,
                            name: response.data.name as string,
                            description: response.data.description as string,
                            url: response.data.url as string,
                            urlDirectAuth: response.data.urlDirectAuth as string,
                            accessToken: response.data.accessToken as string,
                            appId: response.data.appId as string,
                            enabled: response.data.enabled as boolean,
                            limitToRegisteredUsers: response.data.limitToRegisteredUsers as boolean,
                            defaultRoleId,
                        }, []);
                    }

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS service has been updated.", 5000);
                } catch (error) {
                    void window.showErrorMessage(`Error while adding MySQL REST service: ${String(error)}`);
                }
            }
        }

        return;
    };


    /**
     * Shows a dialog to create a new or edit an existing MRS service.
     *
     * @param backend The interface for sending the requests.
     * @param authApp If the user is not assigned, the authApp must be available, so that we can create
     * @param user If not assigned then a new user must be created otherwise this contains the existing values.
     * a new authApp for this service.
     */
    private showMrsUserDialog = async (backend: ShellInterfaceSqlEditor,
        authApp: IMrsAuthAppData, user?: IMrsUserData): Promise<void> => {

        const title = user
            ? `Adjust the MySQL REST User`
            : `Enter new MySQL REST User Values`;
        const tabTitle = user
            ? "Edit REST User"
            : "Add REST User";

        const authApps = await backend.mrs.getAuthApps(authApp.serviceId ?? "unknown");

        const request = {
            id: "mrsUserDialog",
            type: DialogType.MrsUser,
            title,
            parameters: {
                authApp,
                authApps,
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

        const response = await this.dialogManager.showDialog(request, tabTitle);
        if (!response || response.closure !== DialogResponseClosure.Accept) {
            return;
        }

        const authAppId = authApps.find((authApp) => {
            return authApp.name === response.data?.authAppName;
        })?.id;

        if (user) {
            if (response.data && user.id) {
                try {
                    await backend.mrs.updateUser(user.id, {
                        authAppId,
                        name: response.data.name as string || null,
                        email: response.data.email as string || null,
                        vendorUserId: response.data.vendorUserId as string || null,
                        loginPermitted: response.data.loginPermitted as boolean,
                        mappedUserId: response.data.mappedUserId as string || null,
                        appOptions: response.data.appOptions ?
                            JSON.parse(response.data.appOptions as string) as IShellDictionary : null,
                        authString: response.data.authString as string || null,
                    });

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS user has been updated.", 5000);
                } catch (error) {
                    void window.showErrorMessage(`Error while updating MySQL REST user: ${String(error)}`);
                }
            }
        } else {
            try {
                if (response.data && authApp && authApp.id) {
                    await backend.mrs.addUser(authApp.id,
                        response.data.name as string,
                        response.data.email as string,
                        response.data.vendorUserId as string,
                        response.data.loginPermitted as boolean,
                        response.data.mappedUserId as string,
                        response.data.appOptions ?
                            JSON.parse(response.data.appOptions as string) as IShellDictionary : null,
                        response.data.authString as string);
                }

                void commands.executeCommand("msg.refreshConnections");
                showMessageWithTimeout("The MRS service has been updated.", 5000);
            } catch (error) {
                void window.showErrorMessage(`Error while adding MySQL REST service: ${String(error)}`);
            }
        }

        return;
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
                // eslint-disable-next-line @typescript-eslint/naming-convention
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

        const response = await this.dialogManager.showDialog(request, tabTitle);
        if (!response || response.closure !== DialogResponseClosure.Accept) {
            return;
        }

        if (response.data) {
            const urlContextRoot = response.data.servicePath as string;
            const protocols = response.data.protocols as string[];
            const hostName = response.data.hostName as string;
            const comments = response.data.comments as string;
            const isCurrent = response.data.isCurrent as boolean;
            const enabled = response.data.enabled as boolean;
            const options = response.data.options === "" ?
                null : JSON.parse(response.data.options as string) as IShellDictionary;
            const authPath = response.data.authPath as string;
            const authCompletedUrl = response.data.authCompletedUrl as string;
            const authCompletedUrlValidation = response.data.authCompletedUrlValidation as string;
            const authCompletedPageContent = response.data.authCompletedPageContent as string;

            // Remove entry for <new> item.
            const authApps = (response.data.authApps as IMrsAuthAppData[]).filter((a: IMrsAuthAppData) => {
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

                    void commands.executeCommand("msg.refreshConnections");
                    showMessageWithTimeout("The MRS service has been created.", 5000);
                } catch (error) {
                    void window.showErrorMessage(`Error while adding MySQL REST service: ${String(error)}`);
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
            const tabTitle = schema
                ? "Edit REST Schema"
                : "Add REST Schema";

            const request = {
                id: "mrsSchemaDialog",
                type: DialogType.MrsSchema,
                title,
                parameters: { services },
                values: {
                    serviceId: schema?.serviceId,
                    name: schema?.name ?? schemaName,
                    requestPath: schema?.requestPath ?? `/${schemaName ?? ""}`,
                    requiresAuth: !schema || schema?.requiresAuth === 1,
                    enabled: !schema || schema.enabled === 1,
                    itemsPerPage: schema?.itemsPerPage,
                    comments: schema?.comments ?? "",
                    options: schema?.options ? JSON.stringify(schema?.options) : "",
                },
            };

            const response = await this.dialogManager.showDialog(request, tabTitle);
            // The request was not sent at all (e.g. there was already one running).
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                return;
            }

            if (response.data) {
                const serviceId = response.data.serviceId as string;
                const name = response.data.name as string;
                const requestPath = response.data.requestPath as string;
                const requiresAuth = response.data.requiresAuth as boolean;
                const itemsPerPage = response.data.itemsPerPage as number;
                const comments = response.data.comments as string;
                const enabled = response.data.enabled as boolean;
                const options = response.data.options === "" ?
                    null : JSON.parse(response.data.options as string) as IShellDictionary;

                if (!schema) {
                    try {
                        await backend.mrs.addSchema(
                            serviceId, name, requestPath, requiresAuth, options,
                            itemsPerPage, comments);

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
                            options);

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
        const schemas = await backend.mrs.listSchemas(dbObject.serviceId === "" ? undefined : dbObject.serviceId);
        const rowOwnershipFields = await backend.mrs.getDbObjectRowOwnershipFields(dbObject.requestPath,
            dbObject.name,
            dbObject.id === "" ? undefined : dbObject.id,
            dbObject.dbSchemaId === "" ? undefined : dbObject.dbSchemaId,
            schemaName, dbObject.objectType);

        const title = dbObject
            ? "Adjust the MySQL REST Object Configuration"
            : "Enter Configuration Values for the New MySQL REST Object";
        const tabTitle = dbObject
            ? "Edit REST Object"
            : "Add REST Object";
        const parameterNewItem: IMrsDbObjectFieldData = {
            id: "",
            dbObjectId: dbObject.id,
            position: 0,
            name: "<new>",
            bindFieldName: "",
            datatype: "STRING",
            mode: "IN",
            comments: "",
        };

        if (dbObject.id && (!dbObject.fields)) {
            dbObject.fields = await backend.mrs.getDbObjectSelectedFields(dbObject.requestPath, dbObject.name,
                dbObject.id, dbObject.dbSchemaId, schemaName);

            // Add entry for <new> item.
            dbObject.fields.push(parameterNewItem);
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
                options: dbObject?.options ? JSON.stringify(dbObject?.options) : "",
                authStoredProcedure: dbObject.authStoredProcedure,
                parameters: dbObject.fields ?? [parameterNewItem],
            },
        };

        const response = await this.dialogManager.showDialog(request, tabTitle);
        if (!response || response.closure !== DialogResponseClosure.Accept || !response.data) {
            return;
        }

        const schemaId = response.data.dbSchemaId as string;
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
        const options = response.data.options === "" ?
            null : JSON.parse(response.data.options as string) as IShellDictionary;

        // Remove entry for <new> item
        const fields = (response.data.parameters as IMrsDbObjectFieldData[]).filter(
            (p: IMrsDbObjectFieldData) => {
                return p.id !== "";
            });

        if (createObject) {
            // Create new DB Object
            try {
                await backend.mrs.addDbObject(name, objectType,
                    false, requestPath, enabled, crudOperations,
                    crudOperationFormat, requiresAuth,
                    rowUserOwnershipEnforced, autoDetectMediaType,
                    options,
                    rowUserOwnershipColumn,
                    schemaId, undefined, itemsPerPage, comments,
                    mediaType, "",
                    fields);

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
                    dbObject.requestPath,
                    schemaId,
                    {
                        name,
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
                        fields,
                    });

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
                    options: contentSet?.options ? JSON.stringify(contentSet?.options) : "",
                },
            };

            const response = await this.dialogManager.showDialog(request, title);
            // The request was not sent at all (e.g. there was already one running).
            if (!response || response.closure !== DialogResponseClosure.Accept) {
                return;
            }

            if (response.data) {
                const serviceId = response.data.serviceId as string;
                const requestPath = response.data.requestPath as string;
                const requiresAuth = response.data.requiresAuth as boolean;
                const comments = response.data.comments as string;
                const enabled = response.data.enabled as boolean;
                const options = response.data.options === "" ?
                    null : JSON.parse(response.data.options as string) as IShellDictionary;
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
                                requiresAuth, options, serviceId, comments,
                                enabled, true, (message) => {
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

    private browseDocs = (id?: string) => {
        if (!this.docsWebviewPanel) {
            try {
                let data;
                let mrsPluginDir = join(this.context.extensionPath, "/shell/lib/mysqlsh/plugins/mrs_plugin/");
                let indexPath = join(mrsPluginDir, "docs/index.html");
                if (existsSync(indexPath)) {
                    data = readFileSync(indexPath, "utf8");
                } else {
                    mrsPluginDir = join(homedir(), ".mysqlsh/plugins/mrs_plugin");
                    indexPath = join(mrsPluginDir, "docs/index.html");

                    if (existsSync(indexPath)) {
                        data = readFileSync(indexPath, "utf8");
                    } else {
                        throw new Error(`MRS Documentation not found.`);
                    }
                }

                this.docsWebviewPanel = window.createWebviewPanel(
                    "mrsDocs",
                    "MRS Docs",
                    ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [
                            Uri.file(join(mrsPluginDir, "docs/style/")),
                            Uri.file(join(mrsPluginDir, "docs/images/")),
                        ],
                    });
                this.docsWebviewPanel.onDidDispose(() => { this.handleDocsWebviewPanelDispose(); });

                // Handle messages from the webview
                this.docsWebviewPanel.webview.onDidReceiveMessage(
                    (message) => {
                        switch (message.command) {
                            case "openSqlFile": {
                                if (message.path && typeof message.path === "string") {
                                    const fullPath = Uri.file(join(mrsPluginDir, String(message.path)));

                                    void commands.executeCommand("msg.editInScriptEditor", fullPath);
                                }

                                break;
                            }

                            case "loadMrsDump": {
                                if (message.path && typeof message.path === "string") {
                                    const fullPath = Uri.file(join(mrsPluginDir, String(message.path)));

                                    void commands.executeCommand("msg.mrs.loadSchemaFromJSONFile", fullPath);
                                }

                                break;
                            }

                            case "saveProject": {
                                if (message.path && typeof message.path === "string") {
                                    const fullPath = Uri.file(join(mrsPluginDir, String(message.path)));

                                    void commands.executeCommand("msg.mrs.saveExampleProject", fullPath);
                                }

                                break;
                            }

                            default:
                        }
                    });

                const styleUrl = this.docsWebviewPanel.webview.asWebviewUri(
                    Uri.file(join(mrsPluginDir, "docs/")));

                data = data.replace("\"style/", `"${styleUrl.toString()}style/`);
                data = data.replace(/(src=")(.*)(\/images)/gm, `$1${styleUrl.toString()}$3`);

                this.docsWebviewPanel.webview.html = data;
            } catch (reason) {
                this.docsWebviewPanel = undefined;
                void window.showErrorMessage(`${String(reason)}`);
            }
        } else {
            this.docsWebviewPanel.reveal();
        }

        if (id && this.docsWebviewPanel) {
            void this.docsWebviewPanel.webview.postMessage({ command: "goToId", id });
        }
    };

    private handleDocsWebviewPanelDispose = () => {
        this.docsWebviewPanel = undefined;
    };
}


