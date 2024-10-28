/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import type { Mutable } from "../app-logic/general-types.js";
import type { IDocumentCloseData, IWebviewProvider } from "../supplement/RequisitionTypes.js";
import type { IConnectionDetails, IShellSessionDetails } from "../supplement/ShellInterface/index.js";
import type { EditorLanguage } from "../supplement/index.js";
import { uuid } from "../utilities/helpers.js";
import { createDataModelEntryState } from "./data-model-helpers.js";
import type {
    AdminPageType, Command, DataModelSubscriber, IDataModelEntryState, ISubscriberActionType, SubscriberAction,
} from "./data-model-types.js";

/**
 * This file contains all interfaces which comprise the data model for the open documents tree.
 * Each interface (except root items) has a parent entry, which determines the hierarchy of the tree.
 *
 * Each interface has a `type` member, which serves as a discriminator for the type of the entry.
 *
 * The prefix means: ODM = Open Document Data Model (I don't like a double D in the abbreviation).
 */

/** The types of the entries that can appear in the open document data model. */
export enum OdmEntityType {
    /** The top level in the OD data model, if multiple app instances exist. */
    AppProvider,

    /** Used as root for shell sessions. */
    ShellSessionRoot,

    /**
     * A page hosts a single connection. One connection can be opened in multiple pages, by duplicating
     * it, so every page has its own session.
     */
    ConnectionPage,

    /** Represents the overview page in a connection page. */
    Overview,

    /** A notebook entry in a connection page. */
    Notebook,

    /** A standalone script in a connection page. */
    Script,

    /** An administrative page (e.g. the dashboard) in a connection page. */
    AdminPage,

    /** Represents a shell session. */
    ShellSession,

    /** A document not associated with a connection (like config files, generated info etc.). */
    StandaloneDocument,
}

/** The base entry for all interfaces here. */
export interface IOdmBaseEntry {
    /**
     * A unique identifier to find items independent of other properties (e.g. if they represent the same connection)
     * and to link items in the UI (e.g. between data models). This ID is transient and not stored in the backend.
     */
    id: string;

    //readonly type: OdmEntityType;

    /** Transient information related to initialization, UI and others. */
    readonly state: IDataModelEntryState;

    /** The caption for the UI. Can change at any time. */
    caption: string;

    /** Used in simple view mode */
    readonly alternativeCaption?: string;

    /** The command to execute when the item is selected in the UI. */
    readonly command?: Command;

    getChildren?(): OpenDocumentDataModelEntry[];
}

/** The interface for a notebook entry. */
export interface IOdmNotebookEntry extends IOdmBaseEntry {
    readonly parent?: IOdmConnectionPageEntry;
    readonly type: OdmEntityType.Notebook;
}

/** The interface for a standalone script entry. */
export interface IOdmScriptEntry extends IOdmBaseEntry {
    readonly parent?: IOdmConnectionPageEntry;
    readonly type: OdmEntityType.Script;

    readonly language: EditorLanguage;
}

export interface IOdmAdminEntry extends IOdmBaseEntry {
    readonly parent?: IOdmConnectionPageEntry;
    readonly type: OdmEntityType.AdminPage;
    readonly pageType: AdminPageType;
}

/** All document types that cannot have children. */
export type LeafDocumentType = OdmEntityType.Notebook | OdmEntityType.Script | OdmEntityType.AdminPage |
    OdmEntityType.StandaloneDocument;

/** All data model types that stand for a single document. */
export type LeafDocumentEntry = IOdmNotebookEntry | IOdmScriptEntry | IOdmAdminEntry | IOdmStandaloneDocumentEntry;

/** The interface for a connection overview entry. */
export interface IOdmConnectionOverviewEntry extends IOdmBaseEntry {
    readonly type: OdmEntityType.Overview;

    readonly parent: IOdmAppProviderEntry;
}

/** The interface for a connection page. */
export interface IOdmConnectionPageEntry extends IOdmBaseEntry {
    readonly type: OdmEntityType.ConnectionPage;

    readonly parent?: IOdmAppProviderEntry;

    readonly details: IConnectionDetails;
    readonly documents: LeafDocumentEntry[];
}

export interface IOdmStandaloneDocumentEntry extends IOdmBaseEntry {
    readonly type: OdmEntityType.StandaloneDocument;
    readonly parent?: IOdmAppProviderEntry;
    readonly language?: EditorLanguage;
}

/** The interface for a shell session. */
export interface IOdmShellSessionEntry extends IOdmBaseEntry {
    readonly parent: IOdmShellSessionRootEntry;

    readonly type: OdmEntityType.ShellSession;

    readonly details: IShellSessionDetails;
}

/** The interface representing the root of all shell sessions. */
export interface IOdmShellSessionRootEntry extends IOdmBaseEntry {
    readonly parent: IOdmAppProviderEntry;
    readonly type: OdmEntityType.ShellSessionRoot;
    readonly sessions: IOdmShellSessionEntry[];
}

/**
 * The interface for a web provider.
 * This is only used in embedded scenarios, where multiple instances of the app can exist and each instance
 * is managed by such a provider.
 */
export interface IOdmAppProviderEntry extends IOdmBaseEntry {
    type: OdmEntityType.AppProvider;

    readonly provider: IWebviewProvider;

    /** A single page representing all stored connections. This page always exists. */
    readonly connectionOverview: IOdmConnectionOverviewEntry;

    /** A list pages for individual connections. Multiple pages can use the same connection. */
    readonly connectionPages: IOdmConnectionPageEntry[];

    /** A list of standalone documents that are not related to a connection. */
    readonly documentPages: IOdmStandaloneDocumentEntry[];

    /** The root entry for open shell sessions. */
    readonly shellSessionRoot: IOdmShellSessionRootEntry;
}

/**
 * The default provider entry is a dummy structure to hold elements if no provider is defined in the data model.
 * This entry or the provider list are used alternatively, never at the same time.
 */
export interface IOdmAppDefaultProviderEntry extends IOdmAppProviderEntry {
    readonly provider: never;
}

/** A union type of all possible interfaces. */
export type OpenDocumentDataModelEntry =
    | LeafDocumentEntry
    | IOdmConnectionPageEntry
    | IOdmConnectionOverviewEntry
    | IOdmStandaloneDocumentEntry
    | IOdmAppProviderEntry
    | IOdmShellSessionEntry
    | IOdmShellSessionRootEntry;

/** Maps a document type to its associated interface type. */
export interface IDocumentTypeMap {
    [OdmEntityType.Notebook]: IOdmNotebookEntry;
    [OdmEntityType.Script]: IOdmScriptEntry;
    [OdmEntityType.AdminPage]: IOdmAdminEntry;
    [OdmEntityType.StandaloneDocument]: IOdmStandaloneDocumentEntry;
    [OdmEntityType.ConnectionPage]: IOdmConnectionPageEntry;
    [OdmEntityType.Overview]: IOdmConnectionOverviewEntry;
    [OdmEntityType.AppProvider]: IOdmAppProviderEntry;
    [OdmEntityType.ShellSessionRoot]: IOdmShellSessionRootEntry;
    [OdmEntityType.ShellSession]: IOdmShellSessionEntry;
}

export interface IBaseDocumentParameters {
    pageId: string;
    id: string;
    caption: string;
    connection?: IConnectionDetails;
}

/** Maps a document type to a set of parameters for opening/creating a document of this type. */
export interface IDocumentOpenParameterMap {
    [OdmEntityType.Notebook]: IBaseDocumentParameters;
    [OdmEntityType.Script]: IBaseDocumentParameters & { language: EditorLanguage; };
    [OdmEntityType.AdminPage]: IBaseDocumentParameters & { pageType: AdminPageType; };
    [OdmEntityType.StandaloneDocument]: { id: string; caption: string; language: EditorLanguage; };
    [OdmEntityType.ConnectionPage]: IBaseDocumentParameters;
    [OdmEntityType.Overview]: IBaseDocumentParameters;
    [OdmEntityType.AppProvider]: never;
    [OdmEntityType.ShellSessionRoot]: never;
    [OdmEntityType.ShellSession]: IShellSessionDetails;
}

/** Typed parameters for the document creation call. */
export interface IDocumentCreateParameters<K extends keyof IDocumentOpenParameterMap> {
    type: K;
    parameters: IDocumentOpenParameterMap[K];
}

/**
 * This data model is used to represent the open documents in an application. It can show single documents or
 * a tree of documents. The tree can be used to represent the open documents in a connection or a provider.
 */
export class OpenDocumentDataModel {
    #defaultProvider: IOdmAppDefaultProviderEntry;

    #appProviders = new Map<IWebviewProvider, IOdmAppProviderEntry>();
    #subscribers = new Set<DataModelSubscriber<OpenDocumentDataModelEntry>>();

    public constructor() {
        this.#defaultProvider = this.createAppProviderEntry("MySQL Shell") as IOdmAppDefaultProviderEntry;
    }

    /**
     * Determines if a given document type is one of a list of document types.
     *
     * @param candidate The document type to check.
     * @param validTypes The types to check against.
     *
     * @returns True if the candidate is one of the valid types, false otherwise.
     */
    public static isDocumentType(candidate: OdmEntityType, ...validTypes: OdmEntityType[]): boolean {
        return validTypes.includes(candidate);
    }

    /**
     * @returns the adapted list of root items for the open documents tree.
     *
     * This list contains no empty entries and always returns at least the default connection overview.
     */
    public get roots(): OpenDocumentDataModelEntry[] {
        if (this.#appProviders.size > 0) {
            return [...this.#appProviders.values()];
        }

        if (this.#defaultProvider.shellSessionRoot.sessions.length === 0) {
            return [
                this.#defaultProvider.connectionOverview,
                ...this.#defaultProvider.connectionPages,
                ...this.#defaultProvider.documentPages];
        }

        return [
            this.#defaultProvider.connectionOverview,
            ...this.#defaultProvider.connectionPages,
            ...this.#defaultProvider.documentPages,
            this.#defaultProvider.shellSessionRoot];
    }

    /**
     * Adds the given subscriber to the internal subscriber list for change notifications.
     *
     * @param subscriber The subscriber to add.
     */
    public subscribe(subscriber: DataModelSubscriber<OpenDocumentDataModelEntry>): void {
        this.#subscribers.add(subscriber);
    }

    /**
     * Removes the given subscriber from the internal subscriber list.
     *
     * @param subscriber The subscriber to remove.
     */
    public unsubscribe(subscriber: DataModelSubscriber<OpenDocumentDataModelEntry>): void {
        this.#subscribers.delete(subscriber);
    }

    /**
     * Removes the given provider from the list of open app providers.
     *
     * @param provider The provider to remove. If not given, all providers are removed.
     *
     * @returns True if the list of existing app providers is empty after the removal, false otherwise.
     */
    public closeProvider(provider?: IWebviewProvider): boolean {
        if (provider) {
            const entry = this.#appProviders.get(provider);
            this.#appProviders.delete(provider);
            this.notifySubscribers([{ action: "remove", entry }]);
        } else {
            this.#appProviders.clear();
            this.notifySubscribers([{ action: "clear" }]);
        }

        return this.#appProviders.size === 0;
    }

    /**
     * Checks if the connection represented by the given tree item is already open in any webview provider.
     *
     * @param candidate The connection to check.
     *
     * @returns True if the connection is already open, false otherwise.
     */
    public isOpen(candidate: IConnectionDetails): boolean {
        for (const [_, entry] of this.#appProviders.entries()) {
            if (entry.connectionPages.some((page) => {
                return page.details.id === candidate.id;
            })) {
                return true;
            }
        }

        return false;
    }

    /**
     * Creates a new caption for a new provider, based on the number of already open providers.
     *
     * @returns The new caption.
     */
    public createUniqueCaption(): string {
        if (this.#appProviders.size === 0) {
            return "MySQL Shell";
        }

        let index = 2;
        while (index < 100) {
            const caption = `MySQL Shell (${index})`;
            let found = false;
            this.#appProviders.forEach((entry) => {
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
    }

    /**
     * Adds a new provider to the data model, if it doesn't exist yet.
     *
     * @param provider The provider to add. If not assigned the call is ignored.
     *
     * @returns The new provider entry or undefined if the provider is not given.
     */
    public openProvider(provider?: IWebviewProvider): IOdmAppProviderEntry | undefined {
        if (!provider) {
            return undefined;
        }

        let entry = this.#appProviders.get(provider);
        if (!entry) {
            // The provider is not yet known. Add a record for it.
            entry = this.createAppProviderEntry(provider.caption, provider);
            this.#appProviders.set(provider, entry);
            this.notifySubscribers([{ action: "add", entry }]);
        }

        return entry;
    }

    /**
     * Called to open a new document in the data model.
     *
     * @param provider The provider which hosts the app that opens the editor. If not given, the document is
     *                 opened in the default (dummy) provider.
     * @param data The details of the document to be opened.
     *
     * @returns The new document entry or undefined if essential data is missing.
     */
    public openDocument<T extends keyof IDocumentOpenParameterMap>(provider: IWebviewProvider | undefined,
        data: IDocumentCreateParameters<T>): IDocumentTypeMap[T] | undefined {
        const actions: Array<{ action: SubscriberAction, entry?: OpenDocumentDataModelEntry; }> = [];

        // The editor was opened.
        let pageList;
        let entry: IOdmAppProviderEntry | undefined;

        // If a provider is specified, use it to look up the connection.
        if (provider) {
            entry = this.#appProviders.get(provider);
            if (!entry) {
                // The provider is not yet known. Add a record for it.
                entry = this.createAppProviderEntry(provider.caption, provider);
                this.#appProviders.set(provider, entry);
                actions.push({ action: "add", entry });
            }
        } else {
            entry = this.#defaultProvider;
        }

        switch (data.type) {
            case OdmEntityType.StandaloneDocument: {
                const parameters = data.parameters as IDocumentOpenParameterMap[OdmEntityType.StandaloneDocument];
                let document = entry.documentPages.find((item) => {
                    return item.id === parameters.id;
                });

                if (document) {
                    // The document is already open.
                    if (actions.length > 0) {
                        this.notifySubscribers(actions);
                    }

                    return document as IDocumentTypeMap[T];
                }

                document = {
                    id: parameters.id,
                    type: data.type,
                    caption: parameters.caption,
                    language: parameters.language,
                    state: createDataModelEntryState(true),
                    command: {
                        title: "",
                        command: "msg.selectDocument",
                        arguments: [document],
                    },
                };

                entry.documentPages.push(document);
                actions.push({ action: "add", entry: document });

                this.notifySubscribers(actions);

                return document as IDocumentTypeMap[T];
            }

            case OdmEntityType.Overview: {
                // The overview page is always open, so we return it.
                return entry.connectionOverview as IDocumentTypeMap[T];
            }

            case OdmEntityType.ConnectionPage: {
                pageList = entry.connectionPages;

                const parameters = data.parameters as IBaseDocumentParameters;
                let page = pageList.find((page) => {
                    return page.id === parameters.pageId;
                });

                if (!page) {
                    // No page registered yet. Create a new one.
                    page = {
                        type: OdmEntityType.ConnectionPage,
                        state: createDataModelEntryState(),
                        id: parameters.pageId,
                        details: parameters.connection!,
                        caption: parameters.caption,
                        parent: entry,
                        documents: [],
                    };

                    page.getChildren = () => { return page!.documents; };
                    pageList.push(page);
                    actions.push({ action: "add", entry: page });
                }

                return page as IDocumentTypeMap[T];
            }

            case OdmEntityType.AppProvider: {
                return entry as IDocumentTypeMap[T];
            }

            case OdmEntityType.ShellSession: {
                return this.addShellSession(provider, data.parameters as IShellSessionDetails) as IDocumentTypeMap[T];
            }

            case OdmEntityType.ShellSessionRoot: {
                return undefined;
            }

            default: { // Documents associated with a connection.
                pageList = entry.connectionPages;

                const parameters = data.parameters as IBaseDocumentParameters;
                let page = pageList.find((page) => {
                    return page.id === parameters.pageId;
                });

                if (!page) {
                    // No page registered yet. Create a new one.
                    page = {
                        type: OdmEntityType.ConnectionPage,
                        state: createDataModelEntryState(),
                        id: parameters.pageId,
                        details: parameters.connection!,
                        caption: parameters.connection!.caption,
                        parent: entry,
                        documents: [],
                    };

                    page.getChildren = () => { return page!.documents; };
                    pageList.push(page);
                    actions.push({ action: "add", entry: page });
                }

                // Does the document already exist?
                const existing = page.documents.find((item) => {
                    return item.id === parameters.id;
                });

                if (existing) {
                    // The document is already open.
                    if (actions.length > 0) {
                        this.notifySubscribers(actions);
                    }

                    return existing as IDocumentTypeMap[T];
                }

                const document: Partial<Mutable<OpenDocumentDataModelEntry>> = {
                    id: parameters.id,
                    type: data.type,
                    caption: parameters.caption,
                    alternativeCaption: `${parameters.caption} (${page.caption})`,
                    parent: page,
                    state: createDataModelEntryState(true),
                };

                const command: Command = {
                    title: "",
                    command: "msg.selectDocument",
                    arguments: [document],
                };
                document.command = command;

                switch (data.type) {
                    case OdmEntityType.Script: {
                        const p = data.parameters as IDocumentOpenParameterMap[OdmEntityType.Script];
                        (document as Mutable<IOdmScriptEntry>).language = p.language;

                        break;
                    }

                    case OdmEntityType.AdminPage: {
                        const p = data.parameters as IDocumentOpenParameterMap[OdmEntityType.AdminPage];
                        (document as Mutable<IOdmAdminEntry>).pageType = p.pageType;

                        break;
                    }

                    default:
                }

                page.documents.push(document as LeafDocumentEntry);
                actions.push({ action: "add", entry: document as LeafDocumentEntry });

                this.notifySubscribers(actions);

                return document as IDocumentTypeMap[T];

            }
        }
    }

    /**
     * Called before an editor is closed in a provider.
     *
     * @param provider The provider which hosts the app that opened/closed the editor.
     * @param data The details of the editor change.
     *
     * @returns The new document entry if the editor was opened, undefined if it was closed.
     */
    public closeDocument(provider: IWebviewProvider | undefined, data: IDocumentCloseData): void {
        const actions: Array<{ action: SubscriberAction, entry?: OpenDocumentDataModelEntry; }> = [];

        const appProvider = provider ? this.#appProviders.get(provider) : this.#defaultProvider;
        if (!appProvider) {
            return undefined;
        }

        // Check first if the document is a standalone document.
        const documentIndex = appProvider.documentPages.findIndex((item) => {
            return item.id === data.id;
        });

        if (documentIndex > -1) {
            const removed = appProvider.documentPages.splice(documentIndex, 1);
            actions.push({ action: "remove", entry: removed[0] });
            this.notifySubscribers(actions);

            return;
        }

        const pageList = appProvider.connectionPages;

        const pageIndex = pageList.findIndex((page) => {
            return page.id === data.pageId;
        });

        // Remove the document entry from the connection, if we can find it.
        if (pageIndex > -1) {
            const page = pageList[pageIndex];
            if (data.id === undefined) {
                // No editor id given, remove all documents from the connection.
                page.documents.splice(0, page.documents.length);
                actions.push({ action: "clear", entry: page });
            } else {
                const editorIndex = page.documents.findIndex((item) => {
                    return item.id === data.id;
                });

                // Ignore the editor if it is not found.
                if (editorIndex !== -1) {
                    const removed = page.documents.splice(editorIndex, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }
            }

            // Remove the connection if it has no documents left.
            if (page.documents.length === 0) {
                pageList.splice(pageIndex, 1);
                actions.push({ action: "remove", entry: page });
            }
        }

        // Remove the provider if it has no connections left.
        if (appProvider !== this.#defaultProvider && pageList.length === 0
            && appProvider.shellSessionRoot.sessions.length === 0) {
            this.#appProviders.delete(provider!);
        }

        this.notifySubscribers(actions);
    }

    /**
     * Adds a new connection tab to the data model, if it doesn't exist yet.
     *
     * @param provider The provider which hosts the app that contains the document.
     * @param connection If the tab page doesn't exist yet, a new one is created, using this connection record.
     *
     * @returns The connection page entry which was found or has been created.
     */
    public addConnectionTab(provider: IWebviewProvider | undefined,
        connection: IConnectionDetails): IOdmConnectionPageEntry {
        const entry = this.openProvider(provider);
        const pageList = entry?.connectionPages ?? this.#defaultProvider.connectionPages;

        const page = pageList.find((item) => {
            return item.details.id === connection.id;
        });

        if (!page) {
            // XXX: convert this to use uuid().
            const tabId = String(connection.id);

            const newPage: Mutable<IOdmConnectionPageEntry> = {
                type: OdmEntityType.ConnectionPage,
                id: tabId,
                state: createDataModelEntryState(),
                parent: entry,
                details: connection,
                caption: connection.caption,
                documents: [],
                getChildren: () => { return newPage.documents; },
            };

            pageList.push(newPage);
            this.notifySubscribers([{ action: "add", entry: newPage }]);

            return newPage;
        }

        return page;
    }

    public addShellSession(provider: IWebviewProvider | undefined,
        session: IShellSessionDetails): IOdmShellSessionEntry {
        const actions: Array<{ action: SubscriberAction, entry?: OpenDocumentDataModelEntry; }> = [];
        let shellSessionRoot: IOdmShellSessionRootEntry;
        if (provider) {
            let entry = this.#appProviders.get(provider);
            if (!entry) {
                entry = this.createAppProviderEntry(provider.caption, provider);
                this.#appProviders.set(provider, entry);
                actions.push({ action: "add", entry });
            }
            shellSessionRoot = entry.shellSessionRoot;
        } else {
            shellSessionRoot = this.#defaultProvider.shellSessionRoot;
        }

        let shellSession = shellSessionRoot.sessions.find((item) => {
            return item.details.sessionId === session.sessionId;
        });

        if (shellSession) {
            shellSession.caption = session.caption!;
            (shellSession as Mutable<IOdmShellSessionEntry>).details = session;
            actions.push({ action: "update", entry: shellSession });
        } else {
            shellSession = {
                type: OdmEntityType.ShellSession,
                id: session.sessionId,
                state: createDataModelEntryState(true),
                parent: shellSessionRoot,
                details: session,
                caption: session.caption ?? "",
                command: {
                    title: "",
                    command: "msg.selectDocument",
                    arguments: [shellSession],
                },
            };
            shellSessionRoot.sessions.push(shellSession);
            actions.push({ action: "add", entry: shellSession });
        }

        this.notifySubscribers(actions);

        return shellSession;
    }

    public removeShellSession(provider: IWebviewProvider | undefined, sessionId: string): void {
        const actions: Array<{ action: SubscriberAction, entry?: OpenDocumentDataModelEntry; }> = [];

        let shellSessionRoot: IOdmShellSessionRootEntry | undefined;
        if (provider) {
            const entry = this.#appProviders.get(provider);
            if (entry) {
                shellSessionRoot = entry.shellSessionRoot;
            }
        } else {
            shellSessionRoot = this.#defaultProvider.shellSessionRoot;
        }

        if (shellSessionRoot) {
            const index = shellSessionRoot.sessions.findIndex((item) => {
                return item.details.sessionId === sessionId;
            });

            if (index > -1) {
                const removed = shellSessionRoot.sessions.splice(index, 1);
                actions.push({ action: "remove", entry: removed[0] });
            }

        }
        this.notifySubscribers(actions);
    }

    /**
     * Synchronizes the open shell sessions with the data model. Used by updates from any app provider in the extension.
     *
     * @param provider The provider which hosts the app that needs the update.
     * @param sessions All open shell sessions.
     */
    public updateSessions = (provider: IWebviewProvider, sessions: IShellSessionDetails[]): void => {
        let entry = this.#appProviders.get(provider);
        if (!entry) {
            entry = this.createAppProviderEntry(provider.caption, provider);
            this.#appProviders.set(provider, entry);
            this.notifySubscribers([{ action: "add", entry }]);
        } else {
            this.notifySubscribers([{ action: "update", entry }]);
        }

        const shellSessionRoot = entry.shellSessionRoot;

        // Remove all sessions that are not in the list.
        for (let i = shellSessionRoot.sessions.length - 1; i >= 0; --i) {
            const index = sessions.findIndex((item) => {
                return item.sessionId === shellSessionRoot.sessions[i].details.sessionId;
            });

            if (index === -1) {
                const removed = shellSessionRoot.sessions.splice(i, 1);
                this.notifySubscribers([{ action: "remove", entry: removed[0] }]);
            }
        }

        // Add new entries and update existing ones.
        for (const session of sessions) {
            const index = shellSessionRoot.sessions.findIndex((item) => {
                return item.details.sessionId === session.sessionId;
            });

            if (index === -1) {
                const newEntry: IOdmShellSessionEntry = {
                    type: OdmEntityType.ShellSession,
                    id: uuid(),
                    state: createDataModelEntryState(true),
                    caption: session.caption ?? "",
                    parent: shellSessionRoot,
                    details: session,
                };
                shellSessionRoot.sessions.push(newEntry);
                this.notifySubscribers([{ action: "add", entry: newEntry }]);
            } else {
                shellSessionRoot.sessions[index].caption = session.caption!;
                this.notifySubscribers([{ action: "update", entry: shellSessionRoot.sessions[index] }]);
            }
        }
    };

    public findDocument(webViewProvider: IWebviewProvider | undefined,
        documentId: string): LeafDocumentEntry | IOdmShellSessionEntry | undefined {
        const document = this.findConnectionDocument(webViewProvider, -1, documentId);
        if (document) {
            return document;
        }

        const provider = webViewProvider ? this.findProvider(webViewProvider) : this.#defaultProvider;
        if (provider) {
            const document = provider.documentPages.find((item) => {
                return item.id === documentId;
            });

            if (document) {
                return document;
            }

            return provider.shellSessionRoot.sessions.find((item) => {
                return item.id === documentId;
            });
        }

        return undefined;
    }

    /**
     * @returns the document with the given id from the first connection page with the given connection id.
     *
     * @param webViewProvider The provider which hosts the app that contains the document. If not given, the document is
     *                searched in all providers.
     * @param connectionId The id of the connection. If the connection is open in more than one page,
     *                     the first found entry is returned.
     * @param documentId The id of the document.
     */
    public findConnectionDocument(webViewProvider: IWebviewProvider | undefined, connectionId: number,
        documentId: string): LeafDocumentEntry | undefined {
        let provider: IOdmAppProviderEntry | undefined = this.#defaultProvider;
        if (webViewProvider) {
            provider = this.#appProviders.get(webViewProvider);
        }

        if (provider) {
            if (connectionId === -1) {
                // Search in all connections.
                for (const page of provider.connectionPages) {
                    const result = page.documents.find((item) => {
                        return item.id === documentId;
                    });

                    if (result) {
                        return result;
                    }
                }
            } else {
                const page = provider.connectionPages.find((item) => {
                    return item.details.id === connectionId;
                });

                if (page) {
                    return page.documents.find((item) => {
                        return item.id === documentId;
                    });
                }
            }
        }

        return undefined;
    }

    /**
     * @returns the document with the given id from the first connection page with the given connection id.
     *
     * @param provider The provider which hosts the app that contains the document. If not given, the document is
     *                searched in all providers.
     * @param sessionId The id of the session to return.
     */
    public findSessionDocument(provider: IWebviewProvider | undefined,
        sessionId: string): IOdmShellSessionEntry | undefined {

        const appProvider = provider ? this.#appProviders.get(provider) : this.#defaultProvider;
        if (appProvider) {
            return appProvider.shellSessionRoot.sessions.find((item) => {
                return item.id === sessionId;
            });
        }

        return undefined;
    }

    /**
     * @returns all documents of the given type from the first connection page with the given connection id.
     *
     * @param provider The provider which hosts the app that contains the document.
     * @param connectionId The id of the connection. If the connection is open in more than one page,
     *                     the first found entry is returned.
     * @param type The type of the document to return. Usually, one would look up admin pages here, but it can be
     *             any leaf document type.
     */
    public findConnectionDocumentsByType(provider: IWebviewProvider | undefined, connectionId: number,
        type: LeafDocumentType): LeafDocumentEntry[] {

        const result: LeafDocumentEntry[] = [];
        let entry;
        if (!provider) {
            entry = this.#defaultProvider;
        } else {
            entry = this.#appProviders.get(provider);
        }

        if (entry) {
            if (connectionId === -1) {
                const documents = this.getAllDocuments(entry);
                documents.forEach((item) => {
                    if (item.type === type) {
                        result.push(item);
                    }
                });
            } else {
                const page = entry.connectionPages.find((item) => {
                    return item.details.id === connectionId;
                });

                if (page) {
                    page.documents.forEach((item) => {
                        if (item.type === type) {
                            result.push(item);
                        }
                    });
                }
            }
        }

        return result;
    }

    /**
     * @returns a list of connection entries with the given id.
     *
     * A connection can be open in multiple pages, so the list can contain more than one entry.
     *
     * @param provider The provider which hosts the app that contains the connection.
     * @param connectionId The id of the connection.
     */
    public findConnections(provider: IWebviewProvider | undefined, connectionId: number): IOdmConnectionPageEntry[] {
        const result: IOdmConnectionPageEntry[] = [];

        if (!provider) {
            for (const page of this.#defaultProvider.connectionPages) {
                if (page.details.id === connectionId) {
                    result.push(page);
                }
            }

            return result;
        }

        const entry = this.#appProviders.get(provider);
        if (entry) {
            const item = entry.connectionPages.find((page) => {
                return page.details.id === connectionId;
            });

            if (item) {
                result.push(item);
            }
        }

        return result;
    }

    /**
     * Maps a web view provider to either an app or a session provider entry.
     *
     * @param provider The provider to map.
     *
     * @returns The app or session provider entry, if it exists.
     */
    public findProvider(provider: IWebviewProvider): IOdmAppProviderEntry | undefined {
        return this.#appProviders.get(provider);
    }

    /**
     * @param provider If given only the documents of the given provider are returned.
     *
     * @returns all documents in the given or all providers.
     *
     */
    private getAllDocuments(provider?: IOdmAppProviderEntry): LeafDocumentEntry[] {
        const result: LeafDocumentEntry[] = [];

        if (provider) {
            for (const page of provider.connectionPages) {
                result.push(...page.documents);
            }

            result.push(...provider.documentPages);
        } else if (this.#appProviders.size > 0) {
            for (const [_, entry] of this.#appProviders.entries()) {
                for (const page of entry.connectionPages) {
                    result.push(...page.documents);
                }
                result.push(...entry.documentPages);
            }
        } else {
            for (const page of this.#defaultProvider.connectionPages) {
                result.push(...page.documents);
            }
            result.push(...this.#defaultProvider.documentPages);
        }

        return result;
    }

    private createAppProviderEntry(caption: string, provider?: IWebviewProvider): IOdmAppProviderEntry {
        const entry: Partial<Mutable<IOdmAppProviderEntry | IOdmAppDefaultProviderEntry>> = {
            type: OdmEntityType.AppProvider,
            id: uuid(),
            provider: provider ?? undefined as never,
            state: createDataModelEntryState(),
            caption,
            connectionPages: [],
            documentPages: [],
        };

        entry.shellSessionRoot = {
            type: OdmEntityType.ShellSessionRoot,
            id: uuid(),
            parent: entry as IOdmAppProviderEntry,
            state: createDataModelEntryState(),
            sessions: [],
            caption: "MySQL Shell Consoles",
            getChildren: () => {
                return entry.shellSessionRoot!.sessions;
            },
        };

        entry.connectionOverview = this.createOverviewItem(entry as IOdmAppProviderEntry, provider);
        entry.getChildren = () => {
            return [
                entry.connectionOverview!,
                ...entry.connectionPages!,
                ...entry.documentPages!,
                entry.shellSessionRoot!,
            ];
        };


        return entry as IOdmAppProviderEntry;
    }

    private createOverviewItem(parent: IOdmAppProviderEntry, provider?: IWebviewProvider): IOdmConnectionOverviewEntry {
        const command = { command: "msg.openDBBrowser", arguments: [provider] } as Command;
        const connectionOverview: IOdmConnectionOverviewEntry = {
            type: OdmEntityType.Overview,
            id: uuid(),
            parent,
            state: createDataModelEntryState(true),
            caption: "DB Connection Overview",
            command,
        };

        return connectionOverview;
    }

    private notifySubscribers(list: Array<ISubscriberActionType<OpenDocumentDataModelEntry>>): void {
        for (const subscriber of this.#subscribers) {
            subscriber(list);
        }
    }
}
