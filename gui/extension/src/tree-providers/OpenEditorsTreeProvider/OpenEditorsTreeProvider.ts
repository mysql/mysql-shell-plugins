/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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
    TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event, Command,
} from "vscode";
import { EntityType } from "../../../../frontend/src/modules/db-editor";
import { EditorLanguage } from "../../../../frontend/src/supplement";

import {
    IEditorOpenChangeData, IEditorCloseChangeData, requisitions, IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../../../frontend/src/supplement/Requisitions";
import { DBType, IShellSessionDetails } from "../../../../frontend/src/supplement/ShellInterface";
import { EditorOverviewTreeItem } from "./EditorOverviewTreeItem";
import { EditorConnectionTreeItem } from "./EditorConnectionTreeItem";
import { EditorTabTreeItem } from "./EditorTabTreeItem";
import { EditorTreeItem } from "./EditorTreeItem";
import { ShellConsoleSessionTreeItem } from "../ShellTreeProvider/ShellConsoleSessionTreeItem";

export interface IOpenEditorBaseEntry {
    type: string;

    caption: string;
    treeItem: TreeItem;
}

export interface IOpenEditorEntry extends IOpenEditorBaseEntry {
    type: "editor";

    id: string;
    language: EditorLanguage;
    editorType: EntityType,

    parent: IEditorConnectionEntry;
    treeItem: EditorTreeItem;
}

export interface IEditorConnectionOverviewEntry extends IOpenEditorBaseEntry {
    type: "connectionOverview";

    parent: IProviderEditorEntry | null;
    treeItem: EditorOverviewTreeItem;
}

export interface IEditorConnectionEntry extends IOpenEditorBaseEntry {
    type: "connection";

    connectionId: number;
    dbType: DBType;
    editors: IOpenEditorEntry[];

    parent: IProviderEditorEntry;
    treeItem: EditorConnectionTreeItem;
}

export interface IProviderEditorEntry extends IOpenEditorBaseEntry {
    type: "connectionProvider";

    provider: IWebviewProvider;

    connectionOverview?: IEditorConnectionOverviewEntry;
    connections: IEditorConnectionEntry[];
}

export interface IShellSessionEntry extends IOpenEditorBaseEntry {
    type: "shellSession";

    details: IShellSessionDetails;
    parent: IProviderSessionEntry;
}

export interface IProviderSessionEntry extends IOpenEditorBaseEntry {
    type: "sessionProvider";

    provider: IWebviewProvider;
    sessions: IShellSessionEntry[];
}

/**
 * The provider for the open editors section in the extension.
 */
export class OpenEditorsTreeDataProvider implements TreeDataProvider<IOpenEditorBaseEntry> {

    #openConnections = new Map<IWebviewProvider, IProviderEditorEntry>();
    #openSessions = new Map<IWebviewProvider, IProviderSessionEntry>();

    #lastSelectedItems = new Map<IWebviewProvider, IOpenEditorBaseEntry>();

    #changeEvent = new EventEmitter<IOpenEditorBaseEntry | undefined>();
    #selectCallback: (item: IOpenEditorBaseEntry) => void;

    // Standalone overview entry which is used if no provider exists.
    #connectionOverview: IEditorConnectionOverviewEntry;

    public get onDidChangeTreeData(): Event<IOpenEditorBaseEntry | undefined> {
        return this.#changeEvent.event;
    }

    public set onSelect(callback: (item: IOpenEditorBaseEntry) => void) {
        this.#selectCallback = callback;
    }

    public constructor() {
        requisitions.register("proxyRequest", this.proxyRequest);
        requisitions.register("editorSaved", this.editorSaved);

        this.#connectionOverview = this.createOverviewItems(null);
    }

    public dispose(): void {
        requisitions.unregister("proxyRequest", this.proxyRequest);
        requisitions.unregister("editorSaved", this.editorSaved);
    }

    public clear(provider?: IWebviewProvider): void {
        if (provider) {
            this.#openConnections.delete(provider);
        } else {
            this.#openConnections.clear();
        }

        this.#changeEvent.fire(undefined);
    }

    public getTreeItem(element: IOpenEditorBaseEntry): TreeItem {
        return element.treeItem;
    }

    public getParent(element: IOpenEditorBaseEntry): ProviderResult<IOpenEditorBaseEntry> {
        if (element.type === "editor") {
            return (element as IOpenEditorEntry).parent;
        }

        if (element.type === "connection") {
            return (element as IEditorConnectionEntry).parent;
        }

        return null;
    }

    public getChildren(element?: IOpenEditorBaseEntry): ProviderResult<IOpenEditorBaseEntry[]> {
        if (!element) {
            const connectionProviders = [...this.#openConnections.values()];
            const sessionProviders = [...this.#openSessions.values()];

            if (connectionProviders.length === 0) {
                return [this.#connectionOverview, ...sessionProviders.values()];
            }

            if (connectionProviders.length === 1) {
                // If there's only one provider active, do not show the provider entry.
                const provider = [...this.#openConnections.values()][0];

                return [
                    provider.connectionOverview!,
                    ...provider.connections,
                    ...sessionProviders.values(),
                ];
            }

            return [...this.#openConnections.values(), ...sessionProviders.values()];
        }

        if (element.type === "connectionProvider") {
            const provider = element as IProviderEditorEntry;

            return [provider.connectionOverview!, ...provider.connections];
        }

        if (element.type === "sessionProvider") {
            const provider = element as IProviderSessionEntry;

            return [...provider.sessions];
        }

        if (element.type === "connection") {
            return (element as IEditorConnectionEntry).editors;
        }

        return null;
    }

    private updateEditors = (provider: IWebviewProvider,
        details: IEditorOpenChangeData | IEditorCloseChangeData): void => {

        if (details.opened) {
            let entry = this.#openConnections.get(provider);
            if (!entry) {
                entry = {
                    type: "connectionProvider",
                    provider,
                    caption: provider.caption,
                    treeItem: new EditorTabTreeItem(provider.caption),
                    connections: [],
                };

                this.#openConnections.set(provider, entry);

                entry.connectionOverview = this.createOverviewItems(provider);
                entry.connectionOverview.parent = entry;
            }

            let connection = entry.connections.find((item) => {
                return item.connectionId === details.connectionId;
            });

            const editorCommand: Command = {
                title: "",
                command: "",
                arguments: [provider, details.connectionCaption, details.connectionId, details.editorId],
            };

            switch (details.editorType) {
                case EntityType.Notebook: {
                    editorCommand.command = "msg.showNotebook";

                    break;
                }

                case EntityType.Script: {
                    editorCommand.command = "msg.showScript";

                    break;
                }

                case EntityType.Status: {
                    editorCommand.command = "msg.showServerStatus";

                    break;
                }

                case EntityType.Connections: {
                    editorCommand.command = "msg.showClientConnections";

                    break;
                }

                case EntityType.Dashboard: {
                    editorCommand.command = "msg.showPerformanceDashboard";

                    break;
                }

                default:
            }

            if (connection) {
                connection.editors.push({
                    type: "editor",
                    caption: details.editorCaption,
                    id: details.editorId,
                    language: details.language,
                    editorType: details.editorType,

                    parent: connection,
                    treeItem: new EditorTreeItem(details, editorCommand),
                });
            } else {
                connection = {
                    type: "connection",
                    connectionId: details.connectionId,
                    caption: details.connectionCaption,
                    dbType: details.dbType,
                    editors: [],

                    parent: entry,
                    treeItem: new EditorConnectionTreeItem(details.connectionCaption, details.dbType,
                        details.connectionId),
                };

                connection.editors.push({
                    type: "editor",
                    caption: details.editorCaption,
                    id: details.editorId,
                    language: details.language,
                    editorType: details.editorType,

                    parent: connection,
                    treeItem: new EditorTreeItem(details, editorCommand),
                });

                entry.connections.push(connection);
            }

            const itemToSelect = connection.editors[connection.editors.length - 1];
            this.#changeEvent.fire(undefined);

            this.#lastSelectedItems.set(provider, itemToSelect);
            if (itemToSelect.caption !== "DB Connections") {
                provider.caption = details.connectionCaption;
            }
            this.#selectCallback(itemToSelect);
        } else {
            const entry = this.#openConnections.get(provider);
            if (!entry) {
                return;
            }

            const connectionIndex = entry.connections.findIndex((item) => {
                return item.connectionId === details.connectionId;
            });

            if (connectionIndex > -1) {
                const connection = entry.connections[connectionIndex];
                if (details.editorId === undefined) {
                    connection.editors = [];
                } else {
                    const editorIndex = connection.editors.findIndex((item) => {
                        return item.id === details.editorId;
                    });

                    if (editorIndex !== -1) {
                        connection.editors.splice(editorIndex, 1);
                    }
                }

                if (connection.editors.length === 0) {
                    entry.connections.splice(connectionIndex, 1);
                }
            }

            if (entry.connections.length === 0) {
                this.#openConnections.delete(provider);
            }

            this.#changeEvent.fire(undefined);
        }
    };

    private createOverviewItems = (
        provider: IWebviewProvider | null): IEditorConnectionOverviewEntry => {
        const connectionCommand = {
            command: "msg.openDBBrowser",
            arguments: [provider],
        } as Command;

        const connectionOverview: IEditorConnectionOverviewEntry = {
            type: "connectionOverview",
            caption: "DB Connections",
            treeItem: new EditorOverviewTreeItem("DB Connections", "Open the DB Connection Browse", connectionCommand),
            parent: null,
        };

        return connectionOverview;
    };

    /**
     * Requests sent from one of the providers.
     *
     * @param request The request to handle.
     * @param request.provider The provider that sent the request.
     * @param request.original The original request.
     *
     * @returns A promise that resolves to true if the request was handled.
     */
    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "editorsChanged": {
                const response = request.original.parameter as IEditorOpenChangeData | IEditorCloseChangeData;
                this.updateEditors(request.provider, response);

                return Promise.resolve(true);
            }

            case "editorSelect": {
                const response = request.original.parameter as { connectionId: number, editorId: string; };

                return this.selectItem(request.provider, response.connectionId, response.editorId);
            }

            case "selectConnectionTab": {
                const response = request.original.parameter as { page: string; };

                return this.selectItem(request.provider, -1, response.page);
            }

            case "refreshSessions": {
                const response = request.original.parameter as IShellSessionDetails[];

                return this.refreshSessions(request.provider, response);
            }

            default:
        }

        return Promise.resolve(false);
    };

    private selectItem = (provider: IWebviewProvider, connectionId: number, editorOrPage: string): Promise<boolean> => {
        const entry = this.#openConnections.get(provider);
        if (!entry) {
            return Promise.resolve(false);
        }

        // If no connection was given or the editorId is empty then select the last active item
        // for the given provider.
        if (connectionId < 0 && editorOrPage.length === 0) {
            const lastItem = this.#lastSelectedItems.get(provider);
            if (lastItem) {
                this.#selectCallback(lastItem);
            }

            return Promise.resolve(true);
        }

        const connection = entry.connections.find((item) => {
            return item.connectionId === connectionId;
        });

        if (connection) {
            const editor = connection.editors.find((item) => {
                return item.id === editorOrPage;
            });

            if (editor) {
                this.#lastSelectedItems.set(provider, editor);
                this.#selectCallback(editor);
            }
        } else {
            this.#lastSelectedItems.set(provider, entry.connectionOverview!);
            if (editorOrPage === "DB Connections") {
                provider.caption = entry.caption;
            } else {
                provider.caption = editorOrPage ?? entry.caption;
            }
            this.#selectCallback(entry.connectionOverview!);
        }

        return Promise.resolve(false);
    };

    private refreshSessions = (provider: IWebviewProvider, sessions: IShellSessionDetails[]): Promise<boolean> => {
        if (sessions.length === 0) {
            // No sessions means: remove the provider.
            provider.close();
            this.#openSessions.delete(provider);
        } else {
            let entry = this.#openSessions.get(provider);
            if (!entry) {
                entry = {
                    type: "sessionProvider",
                    provider,
                    caption: provider.caption,
                    treeItem: new EditorTabTreeItem(provider.caption),
                    sessions: [],
                };

                this.#openSessions.set(provider, entry);
            }

            entry.sessions = sessions.map((details) => {
                return {
                    type: "shellSession",
                    caption: details.caption,
                    id: details.sessionId,
                    parent: entry,
                    details,
                    treeItem: new ShellConsoleSessionTreeItem(details.caption ?? "Unknown", {
                        title: "Open Shell GUI Console",
                        command: "msg.openSession",
                        arguments: [details],
                    }),
                } as IShellSessionEntry;
            });
        }

        this.#changeEvent.fire(undefined);

        return Promise.resolve(true);
    };

    private editorSaved = (details: { id: string, newName: string, saved: boolean; }): Promise<boolean> => {
        // There's no information about which provider sent the request so we have to search for the
        // scriptId in all providers.
        for (const entry of this.#openConnections.values()) {
            for (const connection of entry.connections) {
                for (const editor of connection.editors) {
                    if (editor.id === details.id) {
                        editor.caption = details.newName;
                        editor.treeItem.label = details.newName;
                        this.#changeEvent.fire(editor);
                    }
                }
            }
        }

        return Promise.resolve(true);
    };
}
