/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event, Command } from "vscode";

import { EntityType } from "../../../../frontend/src/modules/db-editor/index.js";
import { EditorLanguage } from "../../../../frontend/src/supplement/index.js";

import {
    IEditorOpenChangeData, IEditorCloseChangeData, requisitions, IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../../../frontend/src/supplement/Requisitions.js";
import { DBType, IShellSessionDetails } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { EditorOverviewTreeItem } from "./EditorOverviewTreeItem.js";
import { EditorConnectionTreeItem } from "./EditorConnectionTreeItem.js";
import { EditorTabTreeItem } from "./EditorTabTreeItem.js";
import { EditorTreeItem } from "./EditorTreeItem.js";
import { ShellConsoleSessionTreeItem } from "../ShellTreeProvider/ShellConsoleSessionTreeItem.js";
import { ConnectionTreeItem } from "../ConnectionsTreeProvider/ConnectionTreeItem.js";

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

    /** Used in simple view mode */
    alternativeCaption: string;
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

    #openProviders = new Map<IWebviewProvider, IProviderEditorEntry>();
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

    /**
     * Removes the given provider from the list of open providers.
     *
     * @param provider The provider to remove. If not given, all providers are removed.
     *
     * @returns True if the list of open providers is empty after the removal, false otherwise.
     */
    public clear(provider?: IWebviewProvider): boolean {
        if (provider) {
            this.#openProviders.delete(provider);
        } else {
            this.#openProviders.clear();
        }

        this.#changeEvent.fire(undefined);

        return this.#openProviders.size === 0;
    }

    /**
     * Checks if the connection represented by the given tree item is already open in any webview provider.
     *
     * @param item The item to check.
     *
     * @returns True if the connection is already open, false otherwise.
     */
    public isOpen(item: ConnectionTreeItem): boolean {
        for (const [_, entry] of this.#openProviders.entries()) {
            if (entry.connections.some((connection) => {
                return connection.connectionId === item.details.id;
            })) {
                return true;
            }
        }

        return false;
    }

    /**
     * @returns the connection ID of the last selected item. If no item is selected, null is returned.
     *
     * @param provider The provider to get the connection ID for.
     */
    public currentConnectionId(provider: IWebviewProvider): number | null {
        const item = this.#lastSelectedItems.get(provider);
        if (item && item.type === "editor") {
            const parent = (item as IOpenEditorEntry).parent;

            return parent.connectionId;
        } else if (item && item.type === "connection") {
            return (item as IEditorConnectionEntry).connectionId;
        }

        return null;
    }

    /**
     * Creates a new caption for a new provider, based on the number of tabs already open.
     *
     * @returns The new caption.
     */
    public createUniqueCaption = (): string => {
        if (this.#openProviders.size === 0) {
            return "MySQL Shell";
        }

        let index = 2;
        while (index < 100) {
            const caption = `MySQL Shell (${index})`;
            let found = false;
            this.#openProviders.forEach((entry) => {
                if (entry.caption === caption) {
                    found = true;
                }
            });

            if (!found) {
                return caption;
            }

            ++index;
        }

        return "";
    };

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
            const connectionProviders = [...this.#openProviders.values()];
            const sessionProviders = [...this.#openSessions.values()];

            // If nothing is open currently, show the overview (and possible sessions).
            if (connectionProviders.length === 0) {
                return [this.#connectionOverview, ...sessionProviders.values()];
            }

            if (connectionProviders.length === 1) {
                // If there's only one provider active, do not show the provider entry.
                const provider = [...this.#openProviders.values()][0];

                return [
                    provider.connectionOverview!,
                    ...provider.connections,
                    ...sessionProviders.values(),
                ];
            }

            return [...this.#openProviders.values(), ...sessionProviders.values()];
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
            let entry = this.#openProviders.get(provider);
            if (!entry) {
                entry = {
                    type: "connectionProvider",
                    provider,
                    caption: provider.caption,
                    treeItem: new EditorTabTreeItem(provider.caption),
                    connections: [],
                };

                this.#openProviders.set(provider, entry);

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
                const alternativeCaption = `${details.editorCaption} (${details.connectionCaption})`;
                connection.editors.push({
                    type: "editor",
                    caption: details.editorCaption,
                    alternativeCaption,
                    id: details.editorId,
                    language: details.language,
                    editorType: details.editorType,

                    parent: connection,
                    treeItem: new EditorTreeItem(details.editorCaption, alternativeCaption, details.language,
                        details.editorType, editorCommand),
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

                const alternativeCaption = `${details.editorCaption} (${details.connectionCaption})`;
                connection.editors.push({
                    type: "editor",
                    caption: details.editorCaption,
                    alternativeCaption,
                    id: details.editorId,
                    language: details.language,
                    editorType: details.editorType,

                    parent: connection,
                    treeItem: new EditorTreeItem(details.editorCaption, alternativeCaption, details.language,
                        details.editorType, editorCommand),
                });

                entry.connections.push(connection);
            }

            const itemToSelect = connection.editors[connection.editors.length - 1];
            this.#changeEvent.fire(undefined);

            this.#lastSelectedItems.set(provider, itemToSelect);
            if (itemToSelect.caption !== "DB Connection Overview") {
                provider.caption = details.connectionCaption;
            }
            this.#selectCallback(itemToSelect);
        } else {
            const entry = this.#openProviders.get(provider);
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
                this.#openProviders.delete(provider);
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
            caption: "DB Connection Overview",
            treeItem: new EditorOverviewTreeItem("DB Connection Overview", "Open the DB Connection Overview",
                connectionCommand),
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
                const response = request.original.parameter as { connectionId: number, page: string; };

                return this.selectItem(request.provider, response.connectionId, response.page);
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
        const entry = this.#openProviders.get(provider);
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
            }) ?? connection.editors[0];

            if (editor) {
                this.#lastSelectedItems.set(provider, editor);
                this.#selectCallback(editor);
            }
        } else {
            this.#lastSelectedItems.set(provider, entry.connectionOverview!);
            if (editorOrPage === "DB Connection Overview") {
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
        for (const entry of this.#openProviders.values()) {
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

    /**
     * Updates the caption of all editor tree items of a provider entry, depending on the view mode.
     *
     * @param provider The provider entry to update.
     * @param simpleView True if the simple view is active, false otherwise.
     */
    private updateEditorItemCaptions = (provider: IProviderEditorEntry, simpleView: boolean): void => {
        for (const connection of provider.connections) {
            for (const editor of connection.editors) {
                editor.treeItem.updateLabel(simpleView);
            }
        }
    };
}
