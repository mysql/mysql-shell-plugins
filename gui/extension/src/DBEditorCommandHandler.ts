/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
import { basename } from "path";

import { commands, ConfigurationTarget, TextEditor, Uri, window, workspace } from "vscode";

import {
    ICodeBlockExecutionOptions, InitialEditor, IRequestListEntry, IRequestTypeMap, IWebviewProvider, requisitions,
} from "../../frontend/src/supplement/Requisitions.js";

import { ScriptTreeItem } from "./tree-providers/ScriptTreeItem.js";

import { EntityType, IDBEditorScriptState } from "../../frontend/src/modules/db-editor/index.js";
import { EditorLanguage, INewEditorRequest, IScriptRequest } from "../../frontend/src/supplement/index.js";
import { DBConnectionViewProvider } from "./WebviewProviders/DBConnectionViewProvider.js";

import { IMrsDbObjectData } from "../../frontend/src/communication/ProtocolMrs.js";
import { DBType } from "../../frontend/src/supplement/ShellInterface/index.js";
import { ShellInterfaceSqlEditor } from "../../frontend/src/supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { uuid } from "../../frontend/src/utilities/helpers.js";
import { CodeBlocks } from "./CodeBlocks.js";
import { WebviewProvider } from "./WebviewProviders/WebviewProvider.js";
import { ExtensionHost } from "./ExtensionHost.js";
import { ConnectionsTreeBaseItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeBaseItem.js";
import {
    CdmSchemaGroupMember,
    ConnectionsTreeDataModelEntry, ICdmConnectionEntry, ICdmRestDbObjectEntry, ICdmRoutineEntry, ICdmSchemaEntry,
    ICdmTableEntry, ICdmTriggerEntry, ICdmEventEntry,
    ICdmSchemaGroupEntry,
} from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeDataModel.js";
import {
    ConnectionsTreeDataProvider,
} from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider.js";
import { ConnectionTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionTreeItem.js";
import {
    IEditorConnectionEntry, IOpenEditorBaseEntry, IOpenEditorEntry, OpenEditorsTreeDataProvider,
} from "./tree-providers/OpenEditorsTreeProvider/OpenEditorsTreeProvider.js";
import { showMessageWithTimeout } from "./utilities.js";
import { convertSnakeToCamelCase } from "../../frontend/src/utilities/string-helpers.js";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem.js";
import { MrsDbObjectType } from "../../frontend/src/modules/mrs/types.js";

/** A class to handle all DB editor related commands and jobs. */
export class DBEditorCommandHandler {
    #isConnected = false;
    #host: ExtensionHost;

    #codeBlocks = new CodeBlocks();

    // For each open editor a list of open scripts is held (via a mapping of script IDs and their target URI).
    #openScripts = new Map<DBConnectionViewProvider, Map<string, Uri>>();

    #openEditorsTreeDataProvider: OpenEditorsTreeDataProvider;
    #initialDisplayOfOpenEditorsView = true;
    #displayDbConnectionOverviewWhenConnected = false;

    public constructor(private connectionsProvider: ConnectionsTreeDataProvider) { }

    public setup(host: ExtensionHost): void {
        this.#host = host;
        const context = host.context;

        this.#codeBlocks.setup(context);
        const dbConnectionsTreeView = window.createTreeView(
            "msg.connections",
            {
                treeDataProvider: this.connectionsProvider,
                showCollapseAll: true,
                canSelectMany: false,
            });
        context.subscriptions.push(dbConnectionsTreeView);

        // Register expand/collapse handlers
        dbConnectionsTreeView.onDidExpandElement((event) => {
            this.connectionsProvider.didExpandElement(event.element);
        });

        dbConnectionsTreeView.onDidCollapseElement((event) => {
            this.connectionsProvider.didCollapseElement(event.element);
        });

        this.#openEditorsTreeDataProvider = new OpenEditorsTreeDataProvider();
        const openEditorsTreeView = window.createTreeView(
            "msg.openEditors",
            {
                treeDataProvider: this.#openEditorsTreeDataProvider,
                showCollapseAll: true,
                canSelectMany: false,
            });
        context.subscriptions.push(openEditorsTreeView);
        this.#openEditorsTreeDataProvider.onSelect = (item: IOpenEditorBaseEntry): void => {
            void openEditorsTreeView.reveal(item, { select: true, focus: false, expand: 3 });
        };

        // Display the DB Connection Overview together with the initial display of the OPEN EDITORS view
        openEditorsTreeView.onDidChangeVisibility((e) => {
            // Get the user setting for msg.startup.showDbConnectionsTab
            const showDbConnectionsTab = workspace.getConfiguration(`msg.startup`)
                .get<boolean>("showDbConnectionsTab", true);

            if (e.visible && this.#initialDisplayOfOpenEditorsView && showDbConnectionsTab) {
                this.#initialDisplayOfOpenEditorsView = false;

                // If the extension is already connected to the MySQL Shell websocket,
                // open the DB Connection Overview right away
                if (this.#isConnected) {
                    void commands.executeCommand("msg.openDBBrowser");
                } else {
                    // Otherwise open the DB Connection Overview when connected
                    this.#displayDbConnectionOverviewWhenConnected = true;
                }
            }
        });

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("executeCodeBlock", this.executeCodeBlock);
        requisitions.register("proxyRequest", this.proxyRequest);

        context.subscriptions.push(commands.registerCommand("msg.refreshConnections", () => {
            void requisitions.execute("refreshConnections", undefined);
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshVisibleRouters", () => {
            this.connectionsProvider.refreshMrsRouters();
        }));

        const openConnection = (entry?: ICdmConnectionEntry, editor?: InitialEditor) => {
            if (entry) {
                // "Open connection" acts differently, depending on whether the same connection is already open or not.
                let provider;
                if (this.#openEditorsTreeDataProvider.isOpen(entry.treeItem)) {
                    provider = this.#host.newProvider;
                } else {
                    provider = this.#host.currentProvider;
                }

                void provider?.show(String(entry.treeItem.details.id), editor);
            }
        };

        context.subscriptions.push(commands.registerCommand("msg.openConnection", (entry?: ICdmConnectionEntry) => {
            openConnection(entry);
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNotebook",
            (entry?: ICdmConnectionEntry) => {
                openConnection(entry, "notebook");
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionSqlScript",
            (entry?: ICdmConnectionEntry) => {
                openConnection(entry, "script");
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNewTab",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const provider = this.#host.newProvider;
                    void provider?.show(String(entry.treeItem.details.id));
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showTableData", (entry?: ICdmTableEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;

                const configuration = workspace.getConfiguration(`msg.dbEditor`);
                const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
                const select = uppercaseKeywords ? "SELECT" : "select";
                const from = uppercaseKeywords ? "FROM" : "from";

                const item = entry.treeItem;
                const query = `${select} * ${from} \`${item.schema}\`.\`${item.label as string}\``;
                const name = `${item.schema}.${item.label as string} - Data`;
                void provider?.runScript(String(item.connectionId), {
                    scriptId: uuid(),
                    language: "mysql",
                    content: query,
                    name,
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.selectTableRows", (entry?: ICdmTableEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;

                const configuration = workspace.getConfiguration(`msg.dbEditor`);
                const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
                const select = uppercaseKeywords ? "SELECT" : "select";
                const from = uppercaseKeywords ? "FROM" : "from";

                const item = entry.treeItem;
                const query = `${select} * ${from} \`${item.schema}\`.\`${item.label as string}\``;
                void provider?.runCode(String(item.connectionId), {
                    code: query,
                    language: "mysql",
                    linkId: -1,
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.showNotebook",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Notebook, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showScript",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Script, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showServerStatus",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Status, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showClientConnections",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Connections, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Dashboard, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showLakehouseNavigator",
            (provider: IWebviewProvider | undefined, caption: string, connectionId: number, itemId: string) => {
                provider ??= this.#host.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    provider.caption = caption;
                    void provider.showPageSection(String(connectionId), EntityType.LakehouseNavigator, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.insertScript", (item?: ScriptTreeItem) => {
            if (item) {
                const provider = this.#host.currentProvider;
                void provider?.insertScriptData(item.entry as IDBEditorScriptState);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.addConnection", () => {
            const provider = this.#host.currentProvider;
            void provider?.addConnection();
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshConnection",
            (item?: ConnectionTreeItem) => {
                void requisitions.execute("refreshConnections", { item });
            }));

        context.subscriptions.push(commands.registerCommand("msg.removeConnection", (entry?: ICdmConnectionEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;
                void provider?.removeConnection(entry.treeItem.details.id);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.editConnection", (entry?: ICdmConnectionEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;
                void provider?.editConnection(entry?.treeItem.details.id);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.duplicateConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const provider = this.#host.currentProvider;
                    void provider?.duplicateConnection(entry.treeItem.details.id);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showSystemSchemasOnConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    entry.treeItem.details.hideSystemSchemas = false;

                    void requisitions.execute("refreshConnections", { entry });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.hideSystemSchemasOnConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    entry.treeItem.details.hideSystemSchemas = true;

                    void requisitions.execute("refreshConnections", { entry });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.openDBBrowser", (provider?: IWebviewProvider) => {
            provider ??= this.#host.currentProvider;
            if (provider instanceof DBConnectionViewProvider) {
                void provider.show("connections");
            } else {
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider.show("connections");
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.makeCurrentSchema", (entry?: ICdmSchemaEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;
                if (provider) {
                    void provider?.makeCurrentSchema(entry.parent.treeItem.details.id, entry.treeItem.name)
                        .then((success) => {
                            if (success) {
                                this.connectionsProvider.makeCurrentSchema(entry);
                            }
                        });
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.createProcedure", (entry?: ICdmSchemaGroupEntry) => {
            if (entry) {
                void this.addNewSqlScript(
                    entry.parent.parent.treeItem.details.id, "msg.createProcedure",
                    entry.parent.treeItem.name, "New Procedure", "my_procedure");
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.createFunction", (entry?: ICdmSchemaGroupEntry) => {
            if (entry) {
                void this.addNewSqlScript(
                    entry.parent.parent.treeItem.details.id, "msg.createFunction",
                    entry.parent.treeItem.name, "New Function", "my_function");
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.createFunctionJs", (entry?: ICdmSchemaGroupEntry) => {
            if (entry) {
                void this.addNewSqlScript(
                    entry.parent.parent.treeItem.details.id, "msg.createFunctionJs",
                    entry.parent.treeItem.name, "New Function", "my_function");
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.editRoutine", async (entry?: ICdmRoutineEntry) => {
            if (entry) {
                const sql = await entry.treeItem.getCreateSqlScript(true, true);

                void this.addNewSqlScript(entry.parent.parent.parent.treeItem.details.id, "msg.editRoutine",
                    entry.parent.parent.treeItem.name, "Edit Routine", sql);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropSchema", (entry?: ICdmSchemaEntry) => {
            entry?.treeItem.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTable", (entry?: ICdmSchemaEntry) => {
            entry?.treeItem.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropView", (entry?: ICdmSchemaEntry) => {
            entry?.treeItem.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropRoutine", (entry?: ICdmRoutineEntry) => {
            entry?.treeItem.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTrigger", (entry?: ICdmTriggerEntry) => {
            entry?.treeItem.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropEvent", (item?: ICdmEventEntry) => {
            item?.treeItem?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.defaultConnection",
            (entry?: ICdmConnectionEntry) => {
                if (entry) {
                    const configuration = workspace.getConfiguration(`msg.editor`);
                    void configuration.update("defaultDbConnection", entry.treeItem.details.caption,
                        ConfigurationTarget.Global).then(() => {
                            void window.showInformationMessage(
                                `"${entry.treeItem.label as string}" has been set as default DB Connection.`);
                        });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyNameToClipboard",
            (entry?: ConnectionsTreeDataModelEntry) => {
                if (entry && entry.treeItem instanceof ConnectionsTreeBaseItem) {
                    entry.treeItem.copyNameToClipboard();
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyCreateScriptToClipboard",
            (entry?: ConnectionsTreeDataModelEntry) => {
                if (entry && entry.treeItem instanceof ConnectionsTreeBaseItem) {
                    void entry.treeItem.copyCreateScriptToClipboard();
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyCreateScriptWithDelimitersToClipboard",
            (entry?: ConnectionsTreeDataModelEntry) => {
                if (entry && entry.treeItem instanceof ConnectionsTreeBaseItem) {
                    void entry.treeItem.copyCreateScriptToClipboard(true);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyDropCreateScriptWithDelimitersToClipboard",
            (entry?: ConnectionsTreeDataModelEntry) => {
                if (entry && entry.treeItem instanceof ConnectionsTreeBaseItem) {
                    void entry.treeItem.copyCreateScriptToClipboard(true, true);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.editInScriptEditor", async (uri?: Uri) => {
            if (uri?.scheme === "file") {
                if (!fs.existsSync(uri.fsPath)) {
                    void window.showErrorMessage(`The file ${uri.fsPath} could not be found.`);
                } else {
                    const stat = await workspace.fs.stat(uri);

                    if (stat.size >= 10000000) {
                        await window.showInformationMessage(`The file "${uri.fsPath}" ` +
                            `is too large to edit it in a web view. Instead use the VS Code built-in editor.`);
                    } else {
                        const connection = await host.determineConnection();
                        if (connection) {
                            await workspace.fs.readFile(uri).then((value) => {
                                const content = value.toString();
                                const provider = this.#host.currentProvider;

                                if (provider) {
                                    const name = basename(uri.fsPath);
                                    const details: IScriptRequest = {
                                        scriptId: uuid(),
                                        name,
                                        content,
                                        language: this.languageFromConnection(connection),
                                    };

                                    let scripts = this.#openScripts.get(provider);
                                    if (!scripts) {
                                        scripts = new Map();
                                        this.#openScripts.set(provider, scripts);
                                    }
                                    scripts.set(details.scriptId, uri);

                                    void provider.editScript(String(connection.treeItem.details.id), details);
                                }
                            });
                        }
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.loadScriptFromDisk", (
            entry?: ICdmConnectionEntry | IEditorConnectionEntry) => {
            if (entry) {
                void window.showOpenDialog({
                    title: "Select the script file to load to MySQL Shell",
                    openLabel: "Select Script File",
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        SQL: ["sql", "mysql"], TypeScript: ["ts"], JavaScript: ["js"],
                    },
                }).then(async (value) => {
                    if (value && value.length === 1) {
                        const uri = value[0];
                        const stat = await workspace.fs.stat(uri);

                        if (stat.size >= 10000000) {
                            await window.showInformationMessage(`The file "${uri.fsPath}" ` +
                                `is too large to edit it in a web view. Instead use the VS Code built-in editor.`);
                        } else {
                            await workspace.fs.readFile(uri).then((value) => {
                                const content = value.toString();
                                const provider = this.#host.currentProvider;

                                if (provider) {
                                    let language: EditorLanguage = "mysql";
                                    const name = basename(uri.fsPath);
                                    const ext = name.substring(name.lastIndexOf(".") ?? 0);
                                    switch (ext) {
                                        case ".ts": {
                                            language = "typescript";
                                            break;
                                        }

                                        case ".js": {
                                            language = "javascript";
                                            break;
                                        }

                                        case ".sql": {
                                            if ("dbType" in entry.treeItem) {
                                                if (entry.treeItem.dbType === DBType.Sqlite) {
                                                    language = "sql";
                                                }
                                            } else if ("details" in entry.treeItem) {
                                                if (entry.treeItem.details.dbType === DBType.Sqlite) {
                                                    language = "sql";
                                                }
                                            }

                                            break;
                                        }

                                        default:
                                    }

                                    const details: IScriptRequest = {
                                        scriptId: uuid(),
                                        name,
                                        content,
                                        language,
                                    };

                                    let scripts = this.#openScripts.get(provider);
                                    if (!scripts) {
                                        scripts = new Map();
                                        this.#openScripts.set(provider, scripts);
                                    }
                                    scripts.set(details.scriptId, uri);

                                    if ("connectionId" in entry) {
                                        void provider.editScript(String(entry.connectionId), details);
                                    } else if ("details" in entry.treeItem) {
                                        void provider.editScript(String(entry.treeItem.details.id), details);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }));

        host.context.subscriptions.push(commands.registerCommand("msg.openScriptWithConnection", async (uri?: Uri) => {
            if (!uri) {
                return;
            }

            const connection = await host.determineConnection(DBType.MySQL, true);
            if (connection) {
                const stat = await workspace.fs.stat(uri);

                if (stat.size >= 10000000) {
                    await window.showInformationMessage(`The file "${uri.fsPath}" ` +
                        `is too large to edit it in a web view. Instead use the VS Code built-in editor.`);
                } else {
                    const content = (await workspace.fs.readFile(uri)).toString();
                    const provider = this.#host.currentProvider;

                    if (provider) {
                        // We load only sql and mysql scripts here.
                        const language: EditorLanguage = "mysql";
                        const name = basename(uri.fsPath);

                        const request: IScriptRequest = {
                            scriptId: uuid(),
                            name,
                            content,
                            language,
                        };

                        let scripts = this.#openScripts.get(provider);
                        if (!scripts) {
                            scripts = new Map();
                            this.#openScripts.set(provider, scripts);
                        }
                        scripts.set(request.scriptId, uri);

                        const details = connection.treeItem.details;
                        void provider.editScript(String(details.id), request);
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mds.createConnectionViaBastionService",
            (item?: OciDbSystemTreeItem) => {
                if (item) {
                    const provider = this.#host.currentProvider;
                    void provider?.addConnection(item.dbSystem, item.profile.profile);
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeEmbeddedSqlFromEditor",
            (editor?: TextEditor) => {
                if (editor) {
                    void host.determineConnection().then((connection) => {
                        if (connection) {
                            this.#codeBlocks.executeSqlFromEditor(editor, connection.treeItem.details.caption,
                                connection.treeItem.details.id);
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeSelectedSqlFromEditor",
            (editor?: TextEditor) => {
                if (editor) {
                    void host.determineConnection().then((connection) => {
                        if (connection) {
                            const provider = this.#host.currentProvider;
                            if (provider) {
                                let sql = "";
                                if (!editor.selection.isEmpty) {
                                    editor.selections.forEach((selection) => {
                                        sql += editor.document.getText(selection);
                                    });
                                } else {
                                    sql = editor.document.getText();
                                }

                                return provider.runScript(String(connection.treeItem.details.id), {
                                    scriptId: uuid(),
                                    content: sql,
                                    language: this.languageFromConnection(connection),
                                });
                            }
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.closeEditor", (entry?: IOpenEditorEntry) => {
            if (entry) {
                const provider = entry.parent.parent.provider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.closeEditor(entry.parent.connectionId, entry.id);
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookMysql",
            (entry?: IEditorConnectionEntry) => {
                void this.createNewEditor({ entry, language: "msg" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookSqlite",
            (entry?: IEditorConnectionEntry) => {
                void this.createNewEditor({ entry, language: "msg" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptJs", (entry?: IEditorConnectionEntry) => {
            void this.createNewEditor({ entry, language: "javascript" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptMysql", (entry?: IEditorConnectionEntry) => {
            void this.createNewEditor({ entry, language: "mysql" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptSqlite",
            (entry?: IEditorConnectionEntry) => {
                void this.createNewEditor({ entry, language: "sql" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptTs", (entry?: IEditorConnectionEntry) => {
            void this.createNewEditor({ entry, language: "typescript" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.addDbObject", (entry?: CdmSchemaGroupMember) => {
            if (entry) {
                const objectType = entry.treeItem.dbType;
                const item = entry.treeItem;
                if (objectType === MrsDbObjectType.Table || objectType === MrsDbObjectType.View
                    || objectType === MrsDbObjectType.Procedure || objectType === MrsDbObjectType.Function) {
                    // First, create a new temporary dbObject, then call the DbObject dialog
                    this.createNewDbObject(entry.treeItem.backend, item, objectType).then((dbObject) => {
                        const provider = this.#host.currentProvider;
                        void provider?.editMrsDbObject(String(item.connectionId),
                            { dbObject, createObject: true });
                    }).catch((reason) => {
                        void window.showErrorMessage(`${String(reason)}`);
                    });
                } else {
                    void window.showErrorMessage(
                        `The database object type '${objectType}' is not supported at this time`);
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mrs.editDbObject", (entry?: ICdmRestDbObjectEntry) => {
            if (entry) {
                const provider = this.#host.currentProvider;
                void provider?.editMrsDbObject(String(entry.treeItem.connectionId),
                    { dbObject: entry.treeItem.value, createObject: false });
            }
        }));
    }

    public async addNewSqlScript(connectionId: number, command: string, schemaName: string,
        scriptName: string, placeHolder: string): Promise<void> {

        let name: string | undefined = "";
        let sql = "";
        // If the commands is a create command, get the name of the new routine
        if (command.startsWith("msg.create")) {
            name = await window.showInputBox({
                title: `New Routine on Schema \`${schemaName}\``,
                placeHolder,
                prompt: "Please enter a name for the new routine:",
                value: "",
            });

            if (name === undefined) {
                return;
            }
            if (name === "") {
                name = placeHolder;
            }
        }

        switch (command) {
            case "msg.createProcedure": {
                sql = `DELIMITER %%\nDROP PROCEDURE IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                    + `/* Add or remove procedure IN/OUT/INOUT parameters as needed. */\n`
                    + `CREATE PROCEDURE \`${schemaName}\`.\`${name}\`(IN arg1 INTEGER, OUT arg2 INTEGER)\n`
                    + `SQL SECURITY DEFINER\nNOT DETERMINISTIC\nBEGIN\n`
                    + `    /* Insert the procedure code here. */\n    SET arg2 = arg1 * 2;\n`
                    + `END%%\nDELIMITER ;\n\n`
                    + `CALL \`${schemaName}\`.\`${name}\`(1, @arg2);\nSELECT @arg2;`;
                break;
            }

            case "msg.createFunction": {
                sql = `DELIMITER %%\nDROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                    + `/* Add or remove function parameters as needed. */\n`
                    + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\nRETURNS INTEGER\n`
                    + `SQL SECURITY DEFINER\nDETERMINISTIC\nBEGIN\n`
                    + `    /* Insert the function code here. */\n    return arg1;\nEND%%\nDELIMITER ;`
                    + `\n\nSELECT \`${schemaName}\`.\`${name}\`(1);`;
                break;
            }

            case "msg.createFunctionJs": {
                sql = `DELIMITER %%\n`
                    + `DROP FUNCTION IF EXISTS \`${schemaName}\`.\`${name}\`%%\n`
                    + `/* Add or remove function parameters as needed. */\n`
                    + `CREATE FUNCTION \`${schemaName}\`.\`${name}\`(arg1 INTEGER)\n`
                    + `RETURNS INTEGER\n`
                    + `SQL SECURITY DEFINER\n`
                    + `DETERMINISTIC LANGUAGE JAVASCRIPT\nAS $js$\n`
                    + `    /* Insert the function code here. */\n`
                    + `    console.log("Hello World!");\n\n`
                    + `    console.log('{"info": "This is MLE."}');\n`
                    + `    /* throw("Custom Error"); */\n\n`
                    + `    return arg1;\n`
                    + `$js$%%\n`
                    + `DELIMITER ;\n\n`
                    + `SELECT \`${schemaName}\`.\`${name}\`(1);`;
                break;
            }

            case "msg.editRoutine": {
                sql = placeHolder;
                break;
            }

            default:
        }

        const provider = this.#host.currentProvider ?? this.#host.newProvider;
        if (provider) {
            this.createNewScriptEditor(
                provider, scriptName, sql, "mysql", connectionId,
            );
        }
    }

    /**
     * Triggered on authentication, which means existing connections are no longer valid.
     */
    public async refreshConnectionTree(): Promise<void> {
        await this.connectionsProvider.closeAllConnections();
        this.connectionsProvider.refresh();
    }

    public clear(): void {
        this.#openEditorsTreeDataProvider.clear();
    }

    public providerClosed(provider: DBConnectionViewProvider): void {
        this.#openScripts.delete(provider);
        if (this.#openEditorsTreeDataProvider.clear(provider)) {
            // No provider remained open. Reset the current schemas.
            this.connectionsProvider.resetCurrentSchemas();
        }
    }


    /**
     * Helper to create a unique caption for a new provider.
     *
     * @returns The new caption.
     */
    public generateNewProviderCaption(): string {
        return this.#openEditorsTreeDataProvider.createUniqueCaption();
    }

    public providerStateChanged(provider: DBConnectionViewProvider, active: boolean): void {
        this.connectionsProvider.providerStateChanged(provider, active);
    }

    private createNewDbObject = async (backend: ShellInterfaceSqlEditor,
        item: ConnectionsTreeBaseItem, objectType: MrsDbObjectType): Promise<IMrsDbObjectData> => {

        const dbObject: IMrsDbObjectData = {
            comments: "",
            crudOperations: (objectType === MrsDbObjectType.Procedure) ? ["UPDATE"] : ["READ"],
            crudOperationFormat: "FEED",
            dbSchemaId: "",
            enabled: 1,
            id: "",
            name: item.name,
            objectType,
            requestPath: `/${convertSnakeToCamelCase(item.name)}`,
            requiresAuth: 1,
            rowUserOwnershipEnforced: 0,
            serviceId: "",
            autoDetectMediaType: 0,
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
            dbObject.schemaName = item.schema;
            if (schema) {
                dbObject.dbSchemaId = schema.id;
            } else {
                const answer = await window.showInformationMessage(
                    `The database schema ${item.schema} has not been added to the `
                    + "REST Service. Do you want to add the schema now?",
                    "Yes", "No");
                if (answer === "Yes") {
                    dbObject.dbSchemaId = await backend.mrs.addSchema(service.id,
                        item.schema, 1, `/${convertSnakeToCamelCase(item.schema)}`, false, null, null, undefined);

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

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.#isConnected = url !== undefined;

        if (this.#displayDbConnectionOverviewWhenConnected) {
            this.#displayDbConnectionOverviewWhenConnected = false;
            void commands.executeCommand("msg.openDBBrowser");
        }

        return Promise.resolve(true);
    };

    /**
     * Triggered from CodeBlocks when an embedded query must be executed.
     *
     * @param details The request to send to the app.
     *
     * @returns A promise returning a flag whether the task was successfully executed or not.
     */
    private executeCodeBlock = (details: ICodeBlockExecutionOptions): Promise<boolean> => {
        const provider = this.#host.currentProvider;
        if (provider) {
            return provider.runCode(String(details.connectionId), {
                linkId: details.linkId,
                code: details.query,
                language: "mysql",
            });
        }

        return Promise.resolve(false);
    };

    private editorLoadScript = (details: IScriptRequest): Promise<boolean> => {
        // The user has to select a target file.
        const filters: { [key: string]: string[]; } = {};

        switch (details.language) {
            case "mysql": {
                filters.SQL = ["mysql", "sql"];
                break;
            }

            case "sql": {
                filters.SQL = ["sql"];
                break;
            }

            case "typescript": {
                filters.TypeScript = ["ts"];
                break;
            }

            case "javascript": {
                filters.JavaScript = ["js"];
                break;
            }

            default:
        }

        void window.showOpenDialog({
            title: "Load Script File",
            filters,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
        }).then((list: Uri[]) => {
            if (list.length > 0) {
                void workspace.fs.readFile(list[0]).then((content) => {
                    const provider = this.#host.currentProvider;
                    if (provider) {
                        const scripts = this.#openScripts.get(provider);
                        if (scripts) {
                            scripts.set(details.scriptId, list[0]);
                            const newName = basename(list[0].fsPath);

                            void provider.renameFile({
                                scriptId: details.scriptId,
                                name: newName,
                                language: details.language,
                                content: details.content,
                            });

                            void requisitions.execute("editorSaved",
                                { id: details.scriptId, newName, saved: false });
                        }

                        details.content = content.toString();
                        const connectionId = this.#openEditorsTreeDataProvider.currentConnectionId(provider) ?? -1;

                        void provider.loadScript(String(connectionId), details);
                    }
                });

            }
        });

        return Promise.resolve(true);
    };

    private editorSaveScript = (details: IScriptRequest): Promise<boolean> => {
        const provider = this.#host.currentProvider;
        if (provider) {
            const scripts = this.#openScripts.get(provider);
            if (scripts) {
                const uri = scripts.get(details.scriptId);
                if (uri) {
                    if (uri.scheme === "untitled") {
                        // The user has to select a target file.
                        const filters: { [key: string]: string[]; } = {};

                        switch (details.language) {
                            case "mysql": {
                                filters.SQL = ["mysql", "sql"];
                                break;
                            }

                            case "sql": {
                                filters.SQL = ["sql"];
                                break;
                            }

                            case "typescript": {
                                filters.TypeScript = ["ts"];
                                break;
                            }

                            case "javascript": {
                                filters.JavaScript = ["js"];
                                break;
                            }

                            default:
                        }

                        void window.showSaveDialog({
                            title: "Save Script File",
                            filters,
                        }).then((value: Uri) => {
                            if (value) {
                                const newName = basename(value.fsPath);
                                scripts.set(details.scriptId, value);
                                void provider.renameFile({
                                    scriptId: details.scriptId,
                                    name: newName,
                                    language: details.language,
                                    content: details.content,
                                });

                                const buffer = Buffer.from(details.content, "utf-8");

                                void workspace.fs.writeFile(value, buffer);
                                void requisitions.execute("editorSaved",
                                    { id: details.scriptId, newName, saved: value !== undefined });
                            }
                        });
                    } else {
                        const buffer = Buffer.from(details.content, "utf-8");
                        void workspace.fs.writeFile(uri, buffer);
                    }
                }
            }
        }

        return Promise.resolve(true);
    };

    private createNewScriptEditor = (
        dbProvider: DBConnectionViewProvider, name: string, content: string, language: string,
        connectionId: number, uri?: Uri): void => {
        // A new script.
        const request: IScriptRequest = {
            scriptId: uuid(),
            name,
            content,
            language: language as EditorLanguage,
        };

        let scripts = this.#openScripts.get(dbProvider);
        if (!scripts) {
            scripts = new Map();
            this.#openScripts.set(dbProvider, scripts);
        }
        if (uri) {
            scripts.set(request.scriptId, uri);
        }

        void dbProvider.editScript(String(connectionId), request);
    };

    private createNewEditor = (params: {
        provider?: IWebviewProvider,
        language: string,
        entry?: IEditorConnectionEntry,
        content?: string;
        connectionId?: number;
    }): Promise<boolean> => {
        return new Promise((resolve) => {
            let connectionId = params.connectionId ?? -1;
            let provider: IWebviewProvider | undefined;
            if (params.entry?.parent?.provider) {
                connectionId = params.entry.connectionId;
                provider = params.entry.parent.provider;
            } else if (connectionId === -1) {
                provider = this.#host.currentProvider;
                if (provider) {
                    connectionId = this.#openEditorsTreeDataProvider.currentConnectionId(provider) ?? -1;
                }
            }

            if (connectionId === -1) {
                void window.showErrorMessage("Please select a connection first.");
                resolve(false);

                return;
            }

            void workspace.openTextDocument({ language: params.language, content: params.content })
                .then((document) => {
                    const dbProvider = (params.provider
                        ? params.provider
                        : provider) as DBConnectionViewProvider;
                    if (dbProvider) {
                        const name = basename(document.fileName);
                        if (params.language === "msg") {
                            // A new notebook.
                            void dbProvider.createNewEditor({
                                page: String(connectionId),
                                language: params.language,
                                content: params.content,
                            });
                        } else {
                            // A new script
                            this.createNewScriptEditor(
                                dbProvider, name, document.getText(), params.language as EditorLanguage,
                                connectionId, document.uri);
                        }
                    }

                    resolve(true);
                });
        });
    };

    private languageFromConnection = (entry: ICdmConnectionEntry): EditorLanguage => {
        switch (entry.treeItem.details.dbType) {
            case DBType.MySQL: {
                return "mysql";
            }

            default: {
                return "sql";
            }
        }
    };

    private proxyRequest = (request: {
        provider: WebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "editorSaveScript": {
                const response = request.original.parameter as IScriptRequest;

                return this.editorSaveScript(response);
            }

            case "editorLoadScript": {
                const response = request.original.parameter as IScriptRequest;

                return this.editorLoadScript(response);
            }

            case "createNewEditor": {
                const response = request.original.parameter as INewEditorRequest;

                return this.createNewEditor({
                    provider: request.provider, language: response.language, content: response.content,
                });
            }

            default:
        }

        return Promise.resolve(false);
    };
}
