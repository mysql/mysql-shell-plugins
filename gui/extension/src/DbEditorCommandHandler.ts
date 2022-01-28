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

import { window, commands, ExtensionContext } from "vscode";
import { ICommErrorEvent, ICommSimpleResultEvent } from "../../frontend/src/communication";

import { requisitions } from "../../frontend/src/supplement/Requisitions";
import { EventType } from "../../frontend/src/supplement/Dispatch";

import { IConnectionDetails } from "../../frontend/src/supplement/ShellInterface";
import { ConnectionTreeItem } from "./tree-providers/ConnectionsTreeProvider/ConnectionTreeItem";
import { SchemaMySQLTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaMySQLTreeItem";
import { SchemaTableTreeItem } from "./tree-providers/ConnectionsTreeProvider/SchemaTableTreeItem";
import { OciDbSystemTreeItem } from "./tree-providers/OCITreeProvider/OciDbSystemTreeItem";
import { ScriptTreeItem } from "./tree-providers/ScriptTreeItem";

import { SqlEditorViewProvider } from "./web-views/SqlEditorViewProvider";
import { IRunQueryRequest } from "../../frontend/src/supplement";
import { IDBEditorScriptState } from "../../frontend/src/modules/scripting";

// A class to handle all DB editor related commands and jobs.
export class DbEditorCommandHandler {
    // All open DB editor view providers.
    private providers: SqlEditorViewProvider[] = [];
    private url?: URL;

    public setup(context: ExtensionContext): void {
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
            void provider?.runQuery(item.entry.details.caption, String(item.entry.details.id), {
                linkId: -1,
                query: `SELECT * FROM \`${item.schema}\`.\`${item.label as string}\``,
                data: {},
                parameters: [],
            });
        }));

        context.subscriptions.push(commands.registerCommand("msg.showServerStatus",
            (details: IConnectionDetails) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(details.caption, String(details.id), "showServerStatus");
            }));

        context.subscriptions.push(commands.registerCommand("msg.showPerformanceDashboard",
            (details: IConnectionDetails) => {
                const provider = this.currentProvider;
                void provider?.showPageSection(details.caption, String(details.id), "showPerformanceDashboard");
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
            if (item) {
                const schemaName = item.schema;
                void window.showInformationMessage(`Are you sure the schema ${schemaName} should be dropped?`,
                    "Yes", "No").then((answer) => {
                    if (answer === "Yes") {
                        item.entry.backend?.execute(`DROP SCHEMA \`${schemaName}\`;`)
                            .then((event: ICommSimpleResultEvent) => {
                                switch (event.eventType) {
                                    case EventType.DataResponse:
                                    case EventType.FinalResponse: {
                                        void commands.executeCommand("msg.refreshConnections");
                                        void window.showInformationMessage(
                                            `The schema ${schemaName} has been dropped successfully.`);

                                        break;
                                    }

                                    default: {
                                        break;
                                    }
                                }
                            })
                            .catch((errorEvent: ICommErrorEvent): void => {
                                void window.showErrorMessage(`Error dropping the schema: ` +
                                        `${errorEvent.message ?? "<unknown>"}`);
                            });
                    }
                });
            }
        }));

        context.subscriptions.push(commands.registerCommand("msg.mds.createConnectionViaBastionService",
            (item?: OciDbSystemTreeItem) => {
                if (item) {
                    const provider = this.currentProvider;
                    void provider?.addConnection("SQL Connections", item.dbSystem, item.profile.profile);
                }
            }));

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
}
