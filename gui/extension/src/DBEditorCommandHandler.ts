/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import fs from "fs";
import { basename } from "path";

import { window, commands, ExtensionContext, TextEditor, workspace, Uri } from "vscode";

import {
    IRequestListEntry, IRequestTypeMap, IWebviewProvider, requisitions,
} from "../../frontend/src/supplement/Requisitions";

import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider";
import { ScriptTreeItem } from "./tree-providers/ScriptTreeItem";

import { DBConnectionViewProvider } from "./web-views/DBConnectionViewProvider";
import { EditorLanguage, INewScriptRequest, IRunQueryRequest, IScriptRequest } from "../../frontend/src/supplement";
import { EntityType, IDBEditorScriptState } from "../../frontend/src/modules/db-editor";

import { CodeBlocks } from "./CodeBlocks";
import { uuid } from "../../frontend/src/utilities/helpers";
import { DBType } from "../../frontend/src/supplement/ShellInterface";
import { WebviewProvider } from "./web-views/WebviewProvider";
import { ExtensionHost } from "./ExtensionHost";
import { ConnectionMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionMySQLTreeItem";
import { ConnectionsTreeBaseItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeBaseItem";
import {
    ConnectionsTreeDataProvider, IConnectionEntry,
} from "./tree-providers/ConnectionsTreeProvider/ConnectionsTreeProvider";
import { ConnectionTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionTreeItem";
import { SchemaEventTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaEventTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { SchemaRoutineTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaRoutineTreeItem";
import { SchemaTableTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaTableTreeItem";
import { SchemaTableTriggerTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaTableTriggerTreeItem";
import { SchemaViewTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaViewTreeItem";
import {
    IEditorConnectionEntry,
    IOpenEditorBaseEntry,
    IOpenEditorEntry, OpenEditorsTreeDataProvider,
} from "./tree-providers/OpenEditorsTreeProvider/OpenEditorsTreeProvider";

// A class to handle all DB editor related commands and jobs.
export class DBEditorCommandHandler {
    // All open DB editor view providers.
    private providers: DBConnectionViewProvider[] = [];
    private lastActiveProvider?: DBConnectionViewProvider;

    private url?: URL;

    private codeBlocks = new CodeBlocks();

    // For each open editor a list of open scripts is held (via a mapping of script IDs and their target URI).
    private openScripts = new Map<DBConnectionViewProvider, Map<string, Uri>>();

    private openEditorsTreeDataProvider: OpenEditorsTreeDataProvider;

    public constructor(private connectionsProvider: ConnectionsTreeDataProvider) { }

    public setup(context: ExtensionContext, host: ExtensionHost): void {
        this.codeBlocks.setup(context);
        const dbConnectionsTreeView = window.createTreeView(
            "msg.connections",
            {
                treeDataProvider: this.connectionsProvider,
                showCollapseAll: true,
                canSelectMany: true,
            });
        context.subscriptions.push(dbConnectionsTreeView);

        // Register expand/collapse handlers
        dbConnectionsTreeView.onDidExpandElement((e) => {
            this.connectionsProvider.didExpandElement(e.element);
        });

        dbConnectionsTreeView.onDidCollapseElement((e) => {
            this.connectionsProvider.didCollapseElement(e.element);
        });

        this.openEditorsTreeDataProvider = new OpenEditorsTreeDataProvider();
        const openEditorsTreeView = window.createTreeView(
            "msg.openEditors",
            {
                treeDataProvider: this.openEditorsTreeDataProvider,
                showCollapseAll: true,
                canSelectMany: false,
            });
        context.subscriptions.push(openEditorsTreeView);
        this.openEditorsTreeDataProvider.onSelect = (item: IOpenEditorBaseEntry): void => {
            void openEditorsTreeView.reveal(item, { select: true, focus: false, expand: 3 });
        };

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("editorRunQuery", this.editorRunQuery);

        requisitions.register("proxyRequest", this.proxyRequest);

        context.subscriptions.push(commands.registerCommand("msg.refreshConnections", () => {
            void requisitions.execute("refreshConnections", undefined);
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshVisibleRouters", () => {
            this.connectionsProvider.refreshMrsRouters();
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.show(String(item.entry.details.id));
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNewTab",
            (params: ConnectionTreeItem) => {
                const provider = this.newProvider;
                void provider?.show(String(params.entry.details.id));
            }));

        context.subscriptions.push(commands.registerCommand("msg.showTableData", (item: SchemaTableTreeItem) => {
            const provider = this.currentProvider;

            const configuration = workspace.getConfiguration(`msg.dbEditor`);
            const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
            const select = uppercaseKeywords ? "SELECT" : "select";
            const from = uppercaseKeywords ? "FROM" : "from";

            void provider?.runQuery(String(item.entry.details.id), {
                linkId: -1,
                query: `${select} * ${from} \`${item.schema}\`.\`${item.label as string}\``,
                data: {},
                parameters: [],
            });
        }));

        context.subscriptions.push(commands.registerCommand("msg.showNotebook",
            (provider: IWebviewProvider | undefined, connectionId: number, itemId: string) => {
                provider ??= this.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Notebook, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showScript",
            (provider: IWebviewProvider | undefined, connectionId: number, itemId: string) => {
                provider ??= this.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Script, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showServerStatus",
            (provider: IWebviewProvider | undefined, connectionId: number, itemId: string) => {
                provider ??= this.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Status, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showClientConnections",
            (provider: IWebviewProvider | undefined, connectionId: number, itemId: string) => {
                provider ??= this.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Connections, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard",
            (provider: IWebviewProvider | undefined, connectionId: number, itemId: string) => {
                provider ??= this.currentProvider;
                if (provider instanceof DBConnectionViewProvider) {
                    void provider.showPageSection(String(connectionId), EntityType.Dashboard, itemId);
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.insertScript", (item: ScriptTreeItem) => {
            const provider = this.currentProvider;
            void provider?.insertScriptData(item.entry as IDBEditorScriptState);
        }));

        context.subscriptions.push(commands.registerCommand("msg.addConnection", () => {
            const provider = this.currentProvider;
            void provider?.addConnection();
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshConnection", (item?: ConnectionTreeItem) => {
            void requisitions.execute("refreshConnections", { item });
        }));

        context.subscriptions.push(commands.registerCommand("msg.removeConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.removeConnection(item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.editConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.editConnection(item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.duplicateConnection",
            (item: ConnectionTreeItem) => {
                const provider = this.currentProvider;
                void provider?.duplicateConnection(item.entry.details.id);
            }));

        context.subscriptions.push(commands.registerCommand("msg.showSystemSchemasOnConnection",
            (item: ConnectionTreeItem) => {
                item.entry.details.hideSystemSchemas = false;

                void requisitions.execute("refreshConnections", { item });
            }));

        context.subscriptions.push(commands.registerCommand("msg.hideSystemSchemasOnConnection",
            (item: ConnectionTreeItem) => {
                item.entry.details.hideSystemSchemas = true;

                void requisitions.execute("refreshConnections", { item });
            }));

        context.subscriptions.push(commands.registerCommand("msg.openDBBrowser", (provider?: IWebviewProvider) => {
            provider ??= this.currentProvider;
            if (provider instanceof DBConnectionViewProvider) {
                void provider.show("connections");
            } else {
                void this.currentProvider?.show("connections");
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropSchema", (item?: SchemaMySQLTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTable", (item?: SchemaTableTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropView", (item?: SchemaViewTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropRoutine", (item?: SchemaRoutineTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropTrigger", (item?: SchemaTableTriggerTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.dropEvent", (item?: SchemaEventTreeItem) => {
            item?.dropItem();
        }));

        context.subscriptions.push(commands.registerCommand("msg.defaultConnection", (item: ConnectionTreeItem) => {
            const configuration = workspace.getConfiguration(`msg.editor`);
            void configuration.update("defaultDbConnection", item.label as string).then(() => {
                void window.showInformationMessage(`"${item.label as string}" ` +
                    `has been set as default DB Connection for embedded SQL execution.`);
            });
        }));

        context.subscriptions.push(commands.registerCommand("msg.copyNameToClipboard",
            (item: ConnectionsTreeBaseItem) => {
                item.copyNameToClipboard();
            }));

        context.subscriptions.push(commands.registerCommand("msg.copyCreateScriptToClipboard",
            (item: ConnectionsTreeBaseItem) => {
                item.copyCreateScriptToClipboard();
            }));

        context.subscriptions.push(commands.registerCommand("msg.editInScriptEditor", async (uri?: Uri) => {
            if (uri?.scheme === "file") {
                if (!fs.existsSync(uri.path)) {
                    void window.showErrorMessage(`The file ${uri.path} could not be found.`);
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
                                const provider = this.currentProvider;

                                if (provider) {
                                    const name = basename(uri.fsPath);
                                    const details: IScriptRequest = {
                                        scriptId: uuid(),
                                        name,
                                        content,
                                        language: this.languageFromConnection(connection),
                                    };

                                    let scripts = this.openScripts.get(provider);
                                    if (!scripts) {
                                        scripts = new Map();
                                        this.openScripts.set(provider, scripts);
                                    }
                                    scripts.set(details.scriptId, uri);

                                    void provider.editScriptInNotebook(String(connection.details.id), details);
                                }
                            });
                        }
                    }
                }
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.loadScriptFromDisk",
            (item?: ConnectionMySQLTreeItem) => {
                if (item) {
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
                                    const provider = this.currentProvider;

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
                                                if (item.entry.details.dbType === DBType.Sqlite) {
                                                    language = "sql";
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

                                        let scripts = this.openScripts.get(provider);
                                        if (!scripts) {
                                            scripts = new Map();
                                            this.openScripts.set(provider, scripts);
                                        }
                                        scripts.set(details.scriptId, uri);

                                        void provider.editScriptInNotebook(String(item.entry.details.id), details);
                                    }
                                });
                            }
                        }
                    });
                }
            }));

        context.subscriptions.push(commands.registerCommand("msg.mds.createConnectionViaBastionService",
            (item?: OciDbSystemTreeItem) => {
                if (item) {
                    const provider = this.currentProvider;
                    void provider?.addConnection(item.dbSystem, item.profile.profile);
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeEmbeddedSqlFromEditor",
            (editor: TextEditor) => {
                void host.determineConnection().then((connection) => {
                    if (connection) {
                        this.codeBlocks.executeSqlFromEditor(editor, connection.details.caption, connection.details.id);
                    }
                });
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeSelectedSqlFromEditor", (editor) => {
            void host.determineConnection().then((connection) => {
                if (connection) {
                    const provider = this.currentProvider;
                    if (provider) {
                        let sql = "";
                        if (!editor.selection.isEmpty) {
                            editor.selections.forEach((selection) => {
                                sql += editor.document.getText(selection);
                            });
                        } else {
                            sql = editor.document.getText();
                        }

                        return provider.runScript(String(connection.details.id), {
                            scriptId: uuid(),
                            content: sql,
                            language: this.languageFromConnection(connection),
                        });
                    }
                }
            });
        }));

        context.subscriptions.push(commands.registerCommand("msg.closeEditor", (entry: IOpenEditorEntry) => {
            const provider = entry.parent.parent.provider;
            if (provider instanceof DBConnectionViewProvider) {
                void provider.closeEditor(entry.parent.connectionId, entry.id);
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookMysql", (entry: IEditorConnectionEntry) => {
            void this.editorCreateNewScript({ page: String(entry.connectionId), language: "msg" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newNotebookSqlite",
            (entry: IEditorConnectionEntry) => {
                void this.editorCreateNewScript({ page: String(entry.connectionId), language: "msg" });
            }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptJs", (entry: IEditorConnectionEntry) => {
            void this.editorCreateNewScript({ page: String(entry.connectionId), language: "javascript" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptMysql", (entry: IEditorConnectionEntry) => {
            void this.editorCreateNewScript({ page: String(entry.connectionId), language: "mysql" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptSqlite", (entry: IEditorConnectionEntry) => {
            void this.editorCreateNewScript({ page: String(entry.connectionId), language: "sql" });
        }));

        context.subscriptions.push(commands.registerCommand("msg.newScriptTs", (entry: IEditorConnectionEntry) => {
            void this.editorCreateNewScript({ page: String(entry.connectionId), language: "typescript" });
        }));
    }

    /**
     * Triggered on authentication, which means existing connections are no longer valid.
     */
    public refreshConnectionTree(): void {
        this.connectionsProvider.closeAllConnections();
        this.connectionsProvider.refresh();
    }

    public closeProviders(): void {
        this.providers.forEach((provider) => {
            provider.close();
        });
        this.providers = [];
        this.openEditorsTreeDataProvider.clear();
    }

    private get currentProvider(): DBConnectionViewProvider | undefined {
        if (this.lastActiveProvider) {
            return this.lastActiveProvider;
        }

        if (this.providers.length > 0) {
            return this.providers[this.providers.length - 1];
        }

        return this.newProvider;
    }

    private get newProvider(): DBConnectionViewProvider | undefined {
        if (this.url) {
            const caption = this.createTabCaption();
            const provider = new DBConnectionViewProvider(this.url, caption, this.providerDisposed,
                this.providerStateChanged);
            this.providers.push(provider);

            return provider;
        }

        return undefined;
    }

    private providerDisposed = (provider: WebviewProvider): void => {
        const index = this.providers.findIndex((candidate) => {
            return candidate === provider;
        });

        if (index > -1) {
            this.providers.splice(index, 1);
        }

        if (this.lastActiveProvider === provider) {
            this.lastActiveProvider = undefined;
        }

        // Remove also any open script entry.
        this.openScripts.delete(provider as DBConnectionViewProvider);

        // ... as well as any open editor.
        this.openEditorsTreeDataProvider.clear(provider as DBConnectionViewProvider);
    };

    private providerStateChanged = (provider: WebviewProvider, active: boolean): void => {
        if (active) {
            this.lastActiveProvider = provider as DBConnectionViewProvider;
            this.lastActiveProvider.reselectLastItem();
        }
    };

    private connectedToUrl = (url?: URL): Promise<boolean> => {
        this.url = url;
        this.closeProviders();

        return Promise.resolve(true);
    };

    /**
     * Triggered from CodeBlocks when an embedded query must be executed.
     *
     * @param details The request to send to the app.
     *
     * @returns A promise returning a flag if the task was successfully executed or not.
     */
    private editorRunQuery = (details: IRunQueryRequest): Promise<boolean> => {
        const provider = this.currentProvider;
        if (provider) {
            return provider.runQuery(details.data.connectionId as string, {
                linkId: details.linkId,
                query: details.query,
                data: {},
                parameters: [],
            });
        }

        return Promise.resolve(false);
    };

    private editorSaveScript = (details: IScriptRequest): Promise<boolean> => {
        const provider = this.currentProvider;
        if (provider) {
            const scripts = this.openScripts.get(provider);
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

    private editorCreateNewScript = (request: INewScriptRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            void workspace.openTextDocument({ language: request.language, content: request.content })
                .then((document) => {
                    const provider = this.currentProvider;

                    if (provider) {
                        const name = basename(document.fileName);
                        const details: IScriptRequest = {
                            scriptId: uuid(),
                            name,
                            content: document.getText(),
                            language: request.language,
                        };

                        let scripts = this.openScripts.get(provider);
                        if (!scripts) {
                            scripts = new Map();
                            this.openScripts.set(provider, scripts);
                        }
                        scripts.set(details.scriptId, document.uri);

                        void provider.editScriptInNotebook(request.page, details);
                    }

                    resolve(true);
                });
        });
    };

    private languageFromConnection = (connection: IConnectionEntry): EditorLanguage => {
        switch (connection.details.dbType) {
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

            case "createNewScript": {
                const response = request.original.parameter as INewScriptRequest;

                return this.editorCreateNewScript(response);
            }

            default:
        }

        return Promise.resolve(false);
    };

    private createTabCaption = (): string => {
        if (this.providers.length === 0) {
            return "MySQL Shell";
        }

        let index = 1;
        while (true) {
            const caption = `MySQL Shell (${index})`;
            if (!this.providers.find((candidate) => {
                return candidate.caption === caption;
            })) {
                return caption;
            }

            ++index;
        }
    };
}
