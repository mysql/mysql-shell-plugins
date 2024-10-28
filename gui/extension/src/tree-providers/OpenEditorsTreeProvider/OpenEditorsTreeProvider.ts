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

import { Event, EventEmitter, TreeDataProvider, TreeItem, type ProviderResult } from "vscode";
import {
    OdmEntityType, OpenDocumentDataModel, type IOdmAdminEntry, type OpenDocumentDataModelEntry,
} from "../../../../frontend/src/data-models/OpenDocumentDataModel.js";

import type {
    IDocumentCloseData, IDocumentOpenData, IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../../../frontend/src/supplement/RequisitionTypes.js";
import { requisitions } from "../../../../frontend/src/supplement/Requisitions.js";
import { IShellSessionDetails } from "../../../../frontend/src/supplement/ShellInterface/index.js";
import { ShellConsoleSessionRootTreeItem } from "../ShellTreeProvider/ShellConsoleSessionRootTreeItem.js";
import { ShellConsoleSessionTreeItem } from "../ShellTreeProvider/ShellConsoleSessionTreeItem.js";
import { ConnectionOverviewTreeItem } from "./ConnectionOverviewTreeItem.js";
import { DocumentConnectionPageTreeItem } from "./DocumentConnectionPageTreeItem.js";
import { DocumentProviderTreeItem } from "./DocumentProviderTreeItem.js";
import { DocumentTreeItem } from "./DocumentTreeItem.js";

/**
 * The provider for the open editors section in the extension.
 */
export class OpenEditorsTreeDataProvider implements TreeDataProvider<OpenDocumentDataModelEntry> {

    #lastSelectedItems = new Map<IWebviewProvider, OpenDocumentDataModelEntry>();
    #dataModel: OpenDocumentDataModel;

    #changeEvent = new EventEmitter<OpenDocumentDataModelEntry | undefined>();
    #selectCallback: (item: OpenDocumentDataModelEntry | undefined) => void;

    public constructor(dataModel: OpenDocumentDataModel) {
        this.#dataModel = dataModel;
        requisitions.register("proxyRequest", this.proxyRequest);
        requisitions.register("editorSaved", this.editorSaved);
    }

    public dispose(): void {
        requisitions.unregister("proxyRequest", this.proxyRequest);
        requisitions.unregister("editorSaved", this.editorSaved);
    }

    public get onDidChangeTreeData(): Event<OpenDocumentDataModelEntry | undefined> {
        return this.#changeEvent.event;
    }

    public set onSelect(callback: (item: OpenDocumentDataModelEntry) => void) {
        this.#selectCallback = callback;
    }

    public refresh(document?: OpenDocumentDataModelEntry): void {
        this.#changeEvent.fire(document);
    }

    /**
     * Removes the given provider from the list of open providers.
     *
     * @param provider The provider to remove. If not given, all providers are removed.
     *
     * @returns True if the list of open providers is empty after the removal, false otherwise.
     */
    public clear(provider?: IWebviewProvider): boolean {
        const result = this.#dataModel.closeProvider(provider);

        this.#changeEvent.fire(undefined);

        return result;
    }

    /**
     * @returns the connection ID of the last selected item. If no item is selected, null is returned.
     *
     * @param provider The provider to get the connection ID for.
     */
    public currentConnectionId(provider: IWebviewProvider): number | null {
        const item = this.#lastSelectedItems.get(provider);
        if (!item) {
            return null;
        }

        switch (item.type) {
            case OdmEntityType.ConnectionPage: {
                return item.details.id;
            }

            case OdmEntityType.Notebook:
            case OdmEntityType.Script:
            case OdmEntityType.AdminPage: {
                return item.parent?.details.id ?? null;
            }

            default: {
                return null;
            }
        }
    }

    public getTreeItem(entry: OpenDocumentDataModelEntry): TreeItem {
        switch (entry.type) {
            case OdmEntityType.AppProvider: {
                return new DocumentProviderTreeItem(entry);
            }

            case OdmEntityType.Overview: {
                return new ConnectionOverviewTreeItem(entry);
            }

            case OdmEntityType.ConnectionPage: {
                return new DocumentConnectionPageTreeItem(entry);
            }

            case OdmEntityType.Notebook:
            case OdmEntityType.Script:
            case OdmEntityType.AdminPage: {
                return new DocumentTreeItem(entry);
            }

            case OdmEntityType.ShellSession: {
                return new ShellConsoleSessionTreeItem(entry);
            }

            case OdmEntityType.ShellSessionRoot: {
                return new ShellConsoleSessionRootTreeItem(entry);
            }

            default: {
                return new TreeItem("Invalid entry type");
            }
        }
    }

    public getParent(element: OpenDocumentDataModelEntry): OpenDocumentDataModelEntry | undefined {
        if ("parent" in element) {
            return element.parent as OpenDocumentDataModelEntry;
        }

        return undefined;
    }

    public getChildren(element?: OpenDocumentDataModelEntry): ProviderResult<OpenDocumentDataModelEntry[]> {
        if (!element) {
            return this.#dataModel.roots;
        }

        switch (element.type) {
            case OdmEntityType.AppProvider: {
                if (element.shellSessionRoot.sessions.length > 0) {
                    return [element.connectionOverview, ...element.connectionPages, element.shellSessionRoot];
                } else {
                    return [element.connectionOverview, ...element.connectionPages];
                }
            }

            case OdmEntityType.ShellSessionRoot: {
                return element.sessions;
            }

            case OdmEntityType.ConnectionPage: {
                return element.documents;
            }

            default: {
                return null;
            }
        }
    }

    /**
     * Looks up the corresponding open document for the given admin page entry.
     *
     * @param provider The owning provider.
     * @param connectionId The connection ID to search for.
     *
     * @returns The open document entry if found, undefined otherwise.
     */
    public findAdminDocument(provider: IWebviewProvider, connectionId: number): IOdmAdminEntry[] {
        return this.#dataModel.findConnectionDocumentsByType(provider, connectionId,
            OdmEntityType.AdminPage) as IOdmAdminEntry[];
    }

    /**
     * Requests sent from one of the providers.
     *
     * @param request The request to handle.
     * @param request.provider The provider that sent the request.
     * @param request.original The original request.
     *
     * @returns A promise that resolves to true if the request was handled.
     */
    private proxyRequest = async (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "documentOpened": {
                const response = request.original.parameter as IDocumentOpenData;
                const dmProvider = this.#dataModel.findProvider(request.provider);

                if (!response.connection) {
                    break;
                }

                const connectionId = response.connection.id;
                const document = this.#dataModel.openDocument(request.provider, {
                    type: response.documentDetails.type,
                    parameters: {
                        ...response.documentDetails,
                        pageId: response.pageId,
                        connection: response.connection,
                    },
                });

                if (!document) {
                    break;
                }

                this.#changeEvent.fire(dmProvider);

                if (OpenDocumentDataModel.isDocumentType(document.type, OdmEntityType.AdminPage,
                    OdmEntityType.Notebook, OdmEntityType.Script)) {
                    return this.selectItem(request.provider, connectionId, document.id);
                }

                return Promise.resolve(true);
            }

            case "documentClosed": {
                const response = request.original.parameter as IDocumentCloseData;
                this.#dataModel.closeDocument(request.provider, response);
                this.#changeEvent.fire(undefined);
                this.#selectCallback(undefined);

                return Promise.resolve(true);
            }

            case "selectDocument": {
                const response = request.original.parameter as { connectionId: number, documentId: string; };
                setTimeout(() => {
                    void this.selectItem(request.provider, response.connectionId, response.documentId);
                }, 100);

                return Promise.resolve(true);
            }

            case "selectConnectionTab": {
                const response = request.original.parameter as { connectionId: number; };

                return this.selectItem(request.provider, response.connectionId);
            }

            case "refreshSessions": {
                const response = request.original.parameter as IShellSessionDetails[];

                return this.refreshSessions(request.provider, response);
            }

            case "sessionAdded": {
                const response = request.original.parameter as IShellSessionDetails;
                this.#dataModel.addShellSession(request.provider, response);
                this.refresh();

                return Promise.resolve(true);
            }

            case "sessionRemoved": {
                const response = request.original.parameter as IShellSessionDetails;
                this.#dataModel.removeShellSession(request.provider, response.sessionId);
                this.refresh();

                return Promise.resolve(true);
            }

            default:
        }

        return Promise.resolve(false);
    };

    private selectItem = (provider: IWebviewProvider, connectionId: number, documentId?: string): Promise<boolean> => {
        // If no connection was given and the document id is empty then select the last active item
        // for the given provider.
        if (connectionId < 0 && !documentId) {
            const lastItem = this.#lastSelectedItems.get(provider);
            if (lastItem) {
                this.#selectCallback(lastItem);
            } else {
                // No last item found, so the provider is not open.
                // We need to open the provider and select the connection overview.
                let entry = this.#dataModel.findProvider(provider);
                if (!entry) {
                    entry = this.#dataModel.openProvider(provider);
                    this.#changeEvent.fire(undefined);
                }

                if (entry) {
                    this.#lastSelectedItems.set(provider, entry.connectionOverview);
                    this.#selectCallback(entry.connectionOverview);
                }
            }

            return Promise.resolve(true);
        }

        let document;
        if (connectionId > -1) {
            document = this.#dataModel.findConnectionDocument(provider, connectionId, documentId ?? "");
        } else {
            // Must be a shell session document.
            document = this.#dataModel.findSessionDocument(provider, documentId!);
        }

        if (document) {
            this.#lastSelectedItems.set(provider, document);
            this.#selectCallback(document);
            if (document.alternativeCaption) {
                provider.caption = document.alternativeCaption;
            }
        } else {
            const entry = this.#dataModel.findProvider(provider);
            if (entry && entry.type === OdmEntityType.AppProvider) {
                this.#lastSelectedItems.set(provider, entry.connectionOverview);

                provider.caption = entry.caption;
                this.#selectCallback(entry.connectionOverview);
            }
        }

        return Promise.resolve(false);
    };

    private refreshSessions = (provider: IWebviewProvider, sessions: IShellSessionDetails[]): Promise<boolean> => {
        this.#dataModel.updateSessions(provider, sessions);

        const appProvider = this.#dataModel.findProvider(provider);
        this.#changeEvent.fire(appProvider?.shellSessionRoot);

        return Promise.resolve(true);
    };

    private editorSaved = (details: { id: string, newName: string, saved: boolean; }): Promise<boolean> => {
        // There's no information about which provider sent the request so we have to search for the
        // scriptId in all providers.
        // TODO: pass the provider reference in the request.
        const document = this.#dataModel.findConnectionDocument(undefined, -1, details.id);
        if (document) {
            document.caption = details.newName;
            this.#changeEvent.fire(document);
        }

        return Promise.resolve(true);
    };

}
