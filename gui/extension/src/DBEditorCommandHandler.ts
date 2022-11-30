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

import { basename } from "path";

import { window, commands, ExtensionContext, TextEditor, workspace, Uri } from "vscode";

import { requisitions } from "../../frontend/src/supplement/Requisitions";

import {
    ConnectionMySQLTreeItem,
    ConnectionsTreeBaseItem,
    ConnectionsTreeDataProvider, ConnectionTreeItem, SchemaEventTreeItem, SchemaMySQLTreeItem,
    SchemaRoutineTreeItem, SchemaTableTreeItem, SchemaTableTriggerTreeItem, SchemaViewTreeItem, IConnectionEntry,
} from "./tree-providers/ConnectionsTreeProvider";
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

// A class to handle all DB editor related commands and jobs.
export class DBEditorCommandHandler {
    // All open DB editor view providers.
    private providers: DBConnectionViewProvider[] = [];
    private lastActiveProvider?: DBConnectionViewProvider;

    private url?: URL;

    private codeBlocks = new CodeBlocks();

    // For each open editor a list of open scripts is held (via a mapping of script IDs and their target URI).
    private openScripts = new Map<DBConnectionViewProvider, Map<string, Uri>>();

    public constructor(private connectionsProvider: ConnectionsTreeDataProvider) { }

    public setup(context: ExtensionContext, host: ExtensionHost): void {
        this.codeBlocks.setup(context);
        context.subscriptions.push(window.createTreeView(
            "msg.connections",
            {
                treeDataProvider: this.connectionsProvider,
                showCollapseAll: true,
                canSelectMany: true,
            }));

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("editorRunQuery", this.editorRunQuery);
        requisitions.register("editorSaveScript", this.editorSaveScript);
        requisitions.register("createNewScript", this.editorCreateNewScript);

        context.subscriptions.push(commands.registerCommand("msg.refreshConnections", () => {
            void requisitions.execute("refreshConnections", undefined);
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.show(item.entry.details.caption, String(item.entry.details.id));
        }));

        context.subscriptions.push(commands.registerCommand("msg.openConnectionNewTab",
            (params: ConnectionTreeItem) => {
                const provider = this.newProvider;
                void provider?.show(params.entry.details.caption, String(params.entry.details.id));
            }));

        context.subscriptions.push(commands.registerCommand("msg.showTableData", (item: SchemaTableTreeItem) => {
            const provider = this.currentProvider;

            const configuration = workspace.getConfiguration(`msg.dbEditor`);
            const uppercaseKeywords = configuration.get("upperCaseKeywords", true);
            const select = uppercaseKeywords ? "SELECT" : "select";
            const from = uppercaseKeywords ? "FROM" : "from";

            void provider?.runQuery(item.entry.details.caption, String(item.entry.details.id), {
                linkId: -1,
                query: `${select} * ${from} \`${item.schema}\`.\`${item.label as string}\``,
                data: {},
                parameters: [],
            });
        }));

        context.subscriptions.push(commands.registerCommand("msg.showServerStatus",
            (caption: string, id: number) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(caption, String(id), EntityType.Status);
            }));

        context.subscriptions.push(commands.registerCommand("msg.showClientConnections",
            (caption: string, id: number) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(caption, String(id), EntityType.Connections);
            }));

        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard",
            (caption: string, id: number) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(caption, String(id), EntityType.Dashboard);
            }));

        context.subscriptions.push(commands.registerCommand("msg.insertScript", (item: ScriptTreeItem) => {
            const provider = this.currentProvider;
            void provider?.insertScriptData(item.entry as IDBEditorScriptState);
        }));

        context.subscriptions.push(commands.registerCommand("msg.addConnection", () => {
            const provider = this.currentProvider;
            void provider?.addConnection("DB Connections");
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshConnection", (item?: ConnectionTreeItem) => {
            void requisitions.execute("refreshConnections", { item });

        }));

        context.subscriptions.push(commands.registerCommand("msg.removeConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.removeConnection("DB Connections", item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.editConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.editConnection("DB Connections", item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.duplicateConnection",
            (item: ConnectionTreeItem) => {
                const provider = this.currentProvider;
                void provider?.duplicateConnection("DB Connections", item.entry.details.id);
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

        context.subscriptions.push(commands.registerCommand("msg.openDBBrowser", () => {
            const provider = this.currentProvider;
            void provider?.show("DB Connections", "connections");
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

                                void provider.editScriptInNotebook(connection.details.caption,
                                    String(connection.details.id), details);
                            }
                        });
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

                                        void provider.editScriptInNotebook(item.entry.details.caption,
                                            String(item.entry.details.id), details);
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
                    void provider?.addConnection("DB Connections", item.dbSystem, item.profile.profile);
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

                        return provider.runScript(connection.details.caption, String(connection.details.id), {
                            scriptId: uuid(),
                            content: sql,
                            language: this.languageFromConnection(connection),
                        });
                    }
                }
            });

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
            const provider = new DBConnectionViewProvider(this.url, this.providerDisposed, this.providerStateChanged);

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
    };

    private providerStateChanged = (provider: WebviewProvider, active: boolean): void => {
        if (active) {
            this.lastActiveProvider = provider as DBConnectionViewProvider;
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
            return provider.runQuery(details.data.caption as string, details.data.connectionId as string, {
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
                                scripts.set(details.scriptId, value);
                                void provider.renameFile({
                                    scriptId: details.scriptId,
                                    name: basename(value.fsPath),
                                    language: details.language,
                                    content: details.content,
                                });

                                const buffer = Buffer.from(details.content, "utf-8");
                                void workspace.fs.writeFile(value, buffer);
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

                        void provider.editScriptInNotebook("", request.page, details);
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
}
