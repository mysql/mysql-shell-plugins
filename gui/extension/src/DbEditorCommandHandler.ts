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

import { window, commands, ExtensionContext, TextEditor, workspace } from "vscode";

import { requisitions } from "../../frontend/src/supplement/Requisitions";

import {
    ConnectionsTreeBaseItem,
    ConnectionsTreeDataProvider, ConnectionTreeItem, IConnectionEntry, SchemaEventTreeItem, SchemaMySQLTreeItem,
    SchemaRoutineTreeItem, SchemaTableTreeItem, SchemaTableTriggerTreeItem, SchemaViewTreeItem,
} from "./tree-providers/ConnectionsTreeProvider";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider";
import { ScriptTreeItem } from "./tree-providers/ScriptTreeItem";

import { SqlEditorViewProvider } from "./web-views/SqlEditorViewProvider";
import { IRunQueryRequest } from "../../frontend/src/supplement";
import { IDBEditorScriptState } from "../../frontend/src/modules/SQLNotebook";

import { CodeBlocks } from "./CodeBlocks";

// A class to handle all DB editor related commands and jobs.
export class DbEditorCommandHandler {
    private connectionsProvider = new ConnectionsTreeDataProvider();

    // All open DB editor view providers.
    private providers: SqlEditorViewProvider[] = [];
    private url?: URL;

    private codeBlocks = new CodeBlocks();

    public setup(context: ExtensionContext): void {
        this.codeBlocks.setup(context);
        context.subscriptions.push(window.registerTreeDataProvider("msg.connections", this.connectionsProvider));

        requisitions.register("connectedToUrl", this.connectedToUrl);
        requisitions.register("editorRunQuery", this.editorRunQuery);

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
                void provider?.showPageSection(caption, String(id), "serverStatus");
            }));

        context.subscriptions.push(commands.registerCommand("msg.showClientConnections",
            (caption: string, id: number) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(caption, String(id), "clientConnections");
            }));

        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard",
            (caption: string, id: number) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(caption, String(id), "performanceDashboard");
            }));

        context.subscriptions.push(commands.registerCommand("msg.insertScript", (item: ScriptTreeItem) => {
            const provider = this.currentProvider;
            void provider?.insertScriptData(item.entry as IDBEditorScriptState);
        }));

        context.subscriptions.push(commands.registerCommand("msg.addConnection", () => {
            const provider = this.currentProvider;
            void provider?.addConnection("SQL Connections");
        }));

        context.subscriptions.push(commands.registerCommand("msg.refreshConnection", (item?: ConnectionTreeItem) => {
            void requisitions.execute("refreshConnections", { item });

        }));

        context.subscriptions.push(commands.registerCommand("msg.removeConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.removeConnection("SQL Connections", item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.editConnection", (item: ConnectionTreeItem) => {
            const provider = this.currentProvider;
            void provider?.editConnection("SQL Connections", item.entry.details.id);
        }));

        context.subscriptions.push(commands.registerCommand("msg.duplicateConnection",
            (item: ConnectionTreeItem) => {
                const provider = this.currentProvider;
                void provider?.duplicateConnection("SQL Connections", item.entry.details.id);
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
            void provider?.show("SQL Connections", "connections");
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

        context.subscriptions.push(commands.registerCommand("msg.mds.createConnectionViaBastionService",
            (item?: OciDbSystemTreeItem) => {
                if (item) {
                    const provider = this.currentProvider;
                    void provider?.addConnection("SQL Connections", item.dbSystem, item.profile.profile);
                }
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeEmbeddedSqlFromEditor",
            (editor: TextEditor) => {
                void this.determineConnection().then((connection) => {
                    if (connection) {
                        this.codeBlocks.executeSqlFromEditor(editor, connection.details.caption, connection.details.id);
                    }
                });
            }));

        context.subscriptions.push(commands.registerTextEditorCommand("msg.executeSelectedSqlFromEditor", (editor) => {
            void this.determineConnection().then((connection) => {
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
                            content: sql,
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

    private get currentProvider(): SqlEditorViewProvider | undefined {
        if (this.providers.length > 0) {
            return this.providers[this.providers.length - 1];
        } else {
            return this.newProvider;
        }
    }

    private get newProvider(): SqlEditorViewProvider | undefined {
        if (this.url) {
            const provider = new SqlEditorViewProvider(this.url, (view) => {
                const index = this.providers.findIndex((candidate) => { return candidate === view; });
                if (index > -1) {
                    this.providers.splice(index, 1);
                }
            });

            this.providers.push(provider);

            return provider;
        }

        return undefined;
    }

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

    /**
     * Determines a connection to run SQL code with.
     *
     * @returns A promise resolving to a connection entry or undefined if no entry was found.
     */
    private determineConnection = async (): Promise<IConnectionEntry | undefined> => {
        const connections = this.connectionsProvider.connections;
        const connectionName = workspace.getConfiguration("msg.editor").get<string>("defaultDbConnection");
        if (connectionName) {
            const connection = connections.find((candidate) => {
                return candidate.details.caption === connectionName;
            });

            if (connection) {
                return connection;
            }
        } else {
            // No default connection set. Show a picker.
            const items = connections.map((connection) => { return connection.details.caption; });
            const name = await window.showQuickPick(items, {
                title: "Select a connection for SQL execution",
                matchOnDescription: true,
                placeHolder: "Type the name of an existing DB connection",
            });

            const connection = connections.find((candidate) => {
                return candidate.details.caption === name;
            });

            if (connection) {
                return connection;
            }
        }

    };
}
