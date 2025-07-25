/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

// eslint-disable-next-line max-classes-per-file
import { ui } from "../app-logic/UILayer.js";
import type { DeepMutable, Mutable } from "../app-logic/general-types.js";
import type {
    IMrsAuthAppData, IMrsContentFileData, IMrsContentSetData, IMrsDbObjectData, IMrsRouterData, IMrsRouterService,
    IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../communication/ProtocolMrs.js";
import { EnabledState } from "../modules/mrs/mrs-helpers.js";
import { requisitions } from "../supplement/Requisitions.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails, type IFolderPath } from "../supplement/ShellInterface/index.js";
import { RunMode, webSession, type ILoginCredentials } from "../supplement/WebSession.js";
import { convertErrorToString, partition, uuid } from "../utilities/helpers.js";
import { compareVersionStrings, formatBytes } from "../utilities/string-helpers.js";
import { ConnectionEntryImpl } from "./ConnectionEntryImpl.js";
import { createDataModelEntryState } from "./data-model-helpers.js";
import {
    type AdminPageType, type Command, type DataModelSubscriber, type ICdmAccessManager, type IDataModelEntryState,
    type ISubscriberActionType, type ProgressCallback,
} from "./data-model-types.js";

/**
 * This file contains all interfaces which comprise the data model for the connections tree.
 * Each interface (except root items) has a parent entry, which determines the hierarchy of the tree.
 * Child interfaces are represented in individual arrays in the parent interface. There's not a single `children` member
 * in all interfaces, that are not leaf nodes, but the name depends on the type of the children. There can even be
 * multiple children arrays in a single interface.
 *
 * Each interface has a `type` member, which serves as a discriminator for the type of the entry.
 *
 * The prefix means: CDM = Connection Data Model
 */

/** The types of entries we can have in the model. */
export enum CdmEntityType {
    /** A group of connections. */
    ConnectionGroup,

    /** A database connection. */
    Connection,

    /** A schema in a connection. */
    Schema,

    /** A table in a schema. */
    Table,

    /** A view in a schema. */
    View,

    /** A stored function in a schema. */
    StoredFunction,

    /** A stored procedure in a schema. */
    StoredProcedure,

    /** A library in a schema. */
    Library,

    /** An event in a table. */
    Event,

    /** A trigger in a table. */
    Trigger,

    /** A column in a table. */
    Column,

    /** An index in a table. */
    Index,

    /** A foreign key in a table. */
    ForeignKey,

    /** Any of the groups in a table entry (e.g. columns). */
    TableGroup,

    /** Any of the groups in a view entry. */
    ViewGroup,

    /** Any of the groups in an event entry. */
    EventGroup,

    /** Any of the groups in a procedure entry. */
    ProcedureGroup,

    /** Any of the groups in a function entry. */
    FunctionGroup,

    /** Any of the groups in a schema entry (e.g. tables and views). */
    SchemaGroup,

    /** The root node for admin pages. */
    Admin,

    /** A page with administration functionality. */
    AdminPage,

    /** The root node for MRS. */
    MrsRoot,

    /** A service in MRS. */
    MrsService,

    /** A schema in a MySQL REST Service. */
    MrsSchema,

    /** A content set in MRS. */
    MrsContentSet,

    /** A user in MRS. */
    MrsUser,

    /** The group holding all auth app entries. */
    MrsAuthAppGroup,

    /** An auth app in MRS. */
    MrsAuthApp,

    /** The group holding all MRS service references listed to a specific auth app entry. */
    MrsAuthAppServiceGroup,

    /** A reference to an MRS service which is listed under an auth app entry. */
    MrsAuthAppService,

    /** A reference to an authentication app listed under an MRS service. */
    MrsServiceAuthApp,

    /** A file in an MRS content set. */
    MrsContentFile,

    /** A database object in an MRS schema. */
    MrsDbObject,

    /** Currently not used. */
    MrsDbObjectFunction,

    /** Currently not used. */
    MrsDbObjectProcedure,

    /** The group holding all router entries. */
    MrsRouterGroup,

    /** A router in MRS. */
    MrsRouter,

    /** A reference to an MRS service which is published and appears in a router tree. */
    MrsRouterService,
}

/** All DM types that represent a database object (can be handled with standard MySQL DDL). */
export const cdmDbEntityTypes = new Set<CdmEntityType>([
    CdmEntityType.Schema,
    CdmEntityType.Table,
    CdmEntityType.View,
    CdmEntityType.StoredProcedure,
    CdmEntityType.StoredFunction,
    CdmEntityType.Library,
    CdmEntityType.Event,
    CdmEntityType.Column,
    CdmEntityType.Index,
    CdmEntityType.ForeignKey,
    CdmEntityType.Trigger,
]);

/** A map from database entity types to their db entity name. */
export const cdbDbEntityTypeName = new Map<CdmEntityType, string>([
    [CdmEntityType.Schema, "schema"],
    [CdmEntityType.Table, "table"],
    [CdmEntityType.View, "view"],
    [CdmEntityType.StoredProcedure, "procedure"],
    [CdmEntityType.StoredFunction, "function"],
    [CdmEntityType.Library, "library"],
    [CdmEntityType.Event, "event"],
    [CdmEntityType.Column, "column"],
    [CdmEntityType.Index, "index"],
    [CdmEntityType.ForeignKey, ""],
    [CdmEntityType.Trigger, "trigger"],
]);

/** All type corresponding to a concrete database object type. */
export type CdmDbEntryType = ICdmSchemaEntry | ICdmTableEntry | ICdmViewEntry | ICdmRoutineEntry
    | ICdmLibraryEntry | ICdmEventEntry | ICdmColumnEntry | ICdmIndexEntry | ICdmForeignKeyEntry
    | ICdmTriggerEntry;

/** The base interface for all entries. */
export interface ICdmBaseEntry {
    /**
     * A unique identifier to find items independent of other properties (e.g. if they represent the same connection)
     * and to link items in the UI (e.g. between data models). This ID is transient and not stored in the backend.
     */
    id: string;

    /** The caption of the entry in the UI. */
    readonly caption: string;

    /** A description with additional information about the entry. */
    description?: string;

    /** The type of the entry. This is used a discriminator for the individual entries. */
    readonly type: CdmEntityType;

    /** The connection holding this entry. */
    readonly connection: ICdmConnectionEntry;

    /** Transient information related to initialization, UI and others. */
    readonly state: IDataModelEntryState;

    /**
     * Reloads the content of this data model entry, regardless of whether it was already initialized or not.
     * This should always be set if `initialize` is set.
     *
     * @param callback An optional callback to report progress.
     */
    refresh?(callback?: ProgressCallback): Promise<boolean>;

    /**
     * @returns a list of child entries in the order they should appear in the UI or is `undefined` if this entry
     *         is a leaf node {@link isLeaf} is true).
     */
    getChildren?(): ConnectionDataModelEntry[];
}

/** An entry for a routine (procedure, function, UDF). */
export interface ICdmRoutineEntry extends ICdmBaseEntry {
    readonly parent: ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure | CdmEntityType.StoredFunction>;

    readonly type: CdmEntityType.StoredProcedure | CdmEntityType.StoredFunction;
    readonly schema: string;
    readonly language: string;
}

/** An entry for a library. */
export interface ICdmLibraryEntry extends ICdmBaseEntry {
    readonly parent: ICdmSchemaGroupEntry<CdmEntityType.Library>;

    readonly type: CdmEntityType.Library;
    readonly schema: string;
    readonly language: string;
}

/** An entry for an event. */
export interface ICdmEventEntry extends ICdmBaseEntry {
    readonly parent: ICdmSchemaGroupEntry<CdmEntityType.Event>;

    readonly type: CdmEntityType.Event;
    readonly schema: string;
}

/** An entry for a column. */
export interface ICdmColumnEntry extends ICdmBaseEntry {
    readonly parent: ICdmTableGroupEntry<CdmEntityType.Column> | ICdmViewEntry;

    readonly type: CdmEntityType.Column;
    readonly schema: string;
    readonly table: string;

    /** Is this column part of the primary key? */
    readonly inPK: boolean;

    readonly autoIncrement: boolean;

    /** Can values of this column be set to null? */
    readonly nullable: boolean;

    /** The default value as defined in the table creation. */
    readonly default?: unknown;

}

/** An entry for a column index. */
export interface ICdmIndexEntry extends ICdmBaseEntry {
    readonly parent: ICdmTableGroupEntry<CdmEntityType.Index>;

    readonly type: CdmEntityType.Index;
    readonly schema: string;
    readonly table: string;
}

/** An entry for a foreign key. */
export interface ICdmForeignKeyEntry extends ICdmBaseEntry {
    readonly parent: ICdmTableGroupEntry<CdmEntityType.ForeignKey>;

    readonly type: CdmEntityType.ForeignKey;
    readonly schema: string;
    readonly table: string;
}

/** An entry for a trigger. */
export interface ICdmTriggerEntry extends ICdmBaseEntry {
    readonly parent: ICdmTableGroupEntry<CdmEntityType.Trigger>;

    readonly type: CdmEntityType.Trigger;
    readonly schema: string;
    readonly table: string;
}

/** A type union for all members of a table group. */
export type CdmTableGroupMemberType = CdmEntityType.Column | CdmEntityType.Index | CdmEntityType.ForeignKey
    | CdmEntityType.Trigger;

/**
 * A mapping from schema group types to their members. This is used to determine the type of the members in a
 * schema group entry.
 */
interface ICdmEntityTypeToTableMember {
    [CdmEntityType.Column]: ICdmColumnEntry,
    [CdmEntityType.Index]: ICdmIndexEntry,
    [CdmEntityType.ForeignKey]: ICdmForeignKeyEntry,
    [CdmEntityType.Trigger]: ICdmTriggerEntry;
}

export interface ICdmTableGroupEntry<T extends CdmTableGroupMemberType> extends ICdmBaseEntry {
    readonly parent: ICdmTableEntry;

    readonly type: CdmEntityType.TableGroup;
    readonly subType: T;
    readonly members: Array<ICdmEntityTypeToTableMember[T]>;
}

/** An entry for a table. */
export interface ICdmTableEntry extends ICdmBaseEntry {
    readonly parent: ICdmSchemaGroupEntry<CdmEntityType.Table>;

    readonly type: CdmEntityType.Table;
    readonly schema: string;

    readonly columns: ICdmTableGroupEntry<CdmEntityType.Column>;
    readonly indexes: ICdmTableGroupEntry<CdmEntityType.Index>;
    readonly foreignKeys: ICdmTableGroupEntry<CdmEntityType.ForeignKey>;
    readonly triggers: ICdmTableGroupEntry<CdmEntityType.Trigger>;
}

/** An entry for a view. */
export interface ICdmViewEntry extends ICdmBaseEntry {
    readonly parent: ICdmSchemaGroupEntry<CdmEntityType.View>;

    readonly type: CdmEntityType.View;
    readonly schema: string;

    readonly columns: ICdmColumnEntry[];
}

/** A type union for all members of a schema group. */
export type CdmSchemaGroupMemberType = CdmEntityType.StoredProcedure | CdmEntityType.StoredFunction
    | CdmEntityType.Library | CdmEntityType.Event | CdmEntityType.Table | CdmEntityType.View;

/**
 * A mapping from schema group types to their members. This is used to determine the type of the members in a
 * schema group entry.
 */
interface ICdmEntityTypeToSchemaMember {
    [CdmEntityType.StoredProcedure]: ICdmRoutineEntry,
    [CdmEntityType.StoredFunction]: ICdmRoutineEntry,
    [CdmEntityType.Library]: ICdmLibraryEntry,
    [CdmEntityType.Event]: ICdmEventEntry,
    [CdmEntityType.Table]: ICdmTableEntry,
    [CdmEntityType.View]: ICdmViewEntry;
}

/** An entry for a schema group. */
export interface ICdmSchemaGroupEntry<T extends CdmSchemaGroupMemberType> extends ICdmBaseEntry {
    readonly parent: ICdmSchemaEntry;

    readonly type: CdmEntityType.SchemaGroup;
    readonly subType: T;
    readonly members: Array<ICdmEntityTypeToSchemaMember[T]>;
}

/** An entry for a schema. */
export interface ICdmSchemaEntry extends ICdmBaseEntry {
    readonly parent: ICdmConnectionEntry;

    readonly type: CdmEntityType.Schema;

    readonly tables: ICdmSchemaGroupEntry<CdmEntityType.Table>;
    readonly views: ICdmSchemaGroupEntry<CdmEntityType.View>;
    readonly procedures: ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>;
    readonly functions: ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>;
    readonly libraries: ICdmSchemaGroupEntry<CdmEntityType.Library>;
    readonly events: ICdmSchemaGroupEntry<CdmEntityType.Event>;
}

/** An entry for an admin section. */
export interface ICdmAdminPageEntry extends ICdmBaseEntry {
    readonly parent: ICdmAdminEntry;

    readonly type: CdmEntityType.AdminPage;
    readonly pageType: AdminPageType;
    readonly command?: Command;
}

/** An entry for the admin subtree. */
export interface ICdmAdminEntry extends ICdmBaseEntry {
    readonly parent: ICdmConnectionEntry;

    readonly type: CdmEntityType.Admin;
    readonly pages: ICdmAdminPageEntry[];
}

/** An entry for an MRS DB object. */
export interface ICdmRestDbObjectEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestSchemaEntry;

    readonly type: CdmEntityType.MrsDbObject;
    readonly details: IMrsDbObjectData;
}

/** An entry for an MRS Schema. */
export interface ICdmRestSchemaEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestServiceEntry;

    readonly type: CdmEntityType.MrsSchema;
    readonly dbObjects: ICdmRestDbObjectEntry[];
    readonly details: IMrsSchemaData;
}

/** An entry for an MRS content file. */
export interface ICdmRestContentFileEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestContentSetEntry;

    readonly type: CdmEntityType.MrsContentFile;
    readonly details: IMrsContentFileData;
}

/** An entry for an MRS content set. */
export interface ICdmRestContentSetEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestServiceEntry;

    readonly type: CdmEntityType.MrsContentSet;
    readonly files: ICdmRestContentFileEntry[];
    readonly details: IMrsContentSetData;
}

/** An entry for an MRS user. */
export interface ICdmRestUserEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestAuthAppEntry;

    readonly type: CdmEntityType.MrsUser;
    readonly details: IMrsUserData;
}

/** An entry for an MRS auth app. */
export interface ICdmRestAuthAppEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestAuthAppGroupEntry;

    readonly type: CdmEntityType.MrsAuthApp;
    readonly details: IMrsAuthAppData;

    readonly users: ICdmRestUserEntry[];
    readonly services: ICdmRestAuthAppServiceEntry[];
}

/** An entry for a service link in an MRS router. */
export interface ICdmRestAuthAppServiceEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestAuthAppEntry;

    readonly type: CdmEntityType.MrsAuthAppService;
    readonly details: IMrsServiceData;
}

/** An entry for a auth app link in an MRS service. */
export interface ICdmRestServiceAuthAppEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestServiceEntry;

    readonly type: CdmEntityType.MrsServiceAuthApp;
    readonly details: IMrsAuthAppData;
}

/** An entry for a service link in an MRS router. */
export interface ICdmRestAuthAppGroupEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRootEntry;

    readonly type: CdmEntityType.MrsAuthAppGroup;
    readonly authApps: ICdmRestAuthAppEntry[];
}

/** An entry for a MySQL REST service. */
export interface ICdmRestServiceEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRootEntry;

    readonly type: CdmEntityType.MrsService;
    readonly details: IMrsServiceData;

    readonly schemas: ICdmRestSchemaEntry[];
    readonly contentSets: ICdmRestContentSetEntry[];
    readonly authApps: ICdmRestServiceAuthAppEntry[];
}

/** The group node for MRS routers. */
export interface ICdmRestRouterGroupEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRootEntry;

    readonly type: CdmEntityType.MrsRouterGroup;
    readonly routers: ICdmRestRouterEntry[];
}

/** An entry for an MRS Router. */
export interface ICdmRestRouterEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRouterGroupEntry;

    readonly type: CdmEntityType.MrsRouter;
    readonly details: IMrsRouterData;

    requiresUpgrade: boolean;
    readonly services: ICdmRestRouterServiceEntry[];
}

/** An entry for a service link in an MRS Router. */
export interface ICdmRestRouterServiceEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRouterEntry;

    readonly type: CdmEntityType.MrsRouterService;
    readonly details: IMrsRouterService;
}

/** An entry for the MRS root. */
export interface ICdmRestRootEntry extends ICdmBaseEntry {
    readonly parent: ICdmConnectionEntry;

    readonly type: CdmEntityType.MrsRoot;

    readonly requiredRouterVersion: string;
    serviceEnabled: boolean;
    showUpdateAvailable: boolean;

    /** When true, show also all entries considered private in the MRS subtree (default: false). */
    showPrivateItems: boolean;

    readonly services: ICdmRestServiceEntry[];
    readonly routerGroup: ICdmRestRouterGroupEntry;
    readonly authAppGroup: ICdmRestAuthAppGroupEntry;
}

export type CdmRestTypes1 = ICdmRestRootEntry | ICdmRestServiceEntry | ICdmRestRouterEntry | ICdmRestSchemaEntry
    | ICdmRestContentSetEntry | ICdmRestAuthAppEntry | ICdmRestUserEntry | ICdmRestContentFileEntry
    | ICdmRestDbObjectEntry | ICdmRestRouterServiceEntry;

/** The top level entry for a connection. The entire data model is made of a list of these (possibly in a group). */
export interface ICdmConnectionEntry extends ICdmBaseEntry {
    readonly parent?: ICdmConnectionGroupEntry;

    readonly type: CdmEntityType.Connection;

    readonly details: IConnectionDetails;

    /**
     * The interface to be used for backend requests. There's one per connection and is shared by all sub items.
     */
    readonly backend: ShellInterfaceSqlEditor;

    /** Indicates if the editor session is open currently. This can change over time. */
    isOpen: boolean;

    /**
     * After opening an editor session, this entries tracks the current schema in that connection and can be used
     * to set the current schema of the connection.
     */
    currentSchema: string;

    /** The list of schemas available in this connection. */
    readonly schemaEntries: ICdmSchemaEntry[];

    /** Only used if MRS is configured for this connection. */
    readonly mrsEntry?: ICdmRestRootEntry;

    /** Only used for MySQL connections. */
    readonly adminEntry?: ICdmAdminEntry;

    /** Closes this connection and frees resources. Call {@link initialize} to open it again. */
    close(): Promise<void>;

    /** Creates a copy of this connection and opens it. */
    duplicate(): Promise<ICdmConnectionEntry>;
}

/** Connections can be grouped together and this is the entry for such groups. */
export interface ICdmConnectionGroupEntry extends Omit<ICdmBaseEntry, "connection"> {
    readonly parent?: ICdmConnectionGroupEntry;
    readonly type: CdmEntityType.ConnectionGroup;
    readonly folderPath: IFolderPath;
    readonly entries: Array<ICdmConnectionEntry | ICdmConnectionGroupEntry>;
}

/** A union type of all possible interfaces. */
export type ConnectionDataModelEntry =
    | ICdmConnectionGroupEntry
    | ICdmConnectionEntry
    | ICdmSchemaEntry
    | ICdmSchemaGroupEntry<CdmSchemaGroupMemberType>
    | ICdmTableEntry
    | ICdmViewEntry
    | ICdmEventEntry
    | ICdmRoutineEntry
    | ICdmLibraryEntry
    | ICdmAdminEntry
    | ICdmAdminPageEntry
    | ICdmTableGroupEntry<CdmTableGroupMemberType>
    | ICdmColumnEntry
    | ICdmIndexEntry
    | ICdmForeignKeyEntry
    | ICdmTriggerEntry
    | ICdmRestRootEntry
    | ICdmRestServiceEntry
    | ICdmRestRouterGroupEntry
    | ICdmRestRouterEntry
    | ICdmRestRouterServiceEntry
    | ICdmRestSchemaEntry
    | ICdmRestContentSetEntry
    | ICdmRestAuthAppGroupEntry
    | ICdmRestAuthAppEntry
    | ICdmRestAuthAppServiceEntry
    | ICdmRestServiceAuthAppEntry
    | ICdmRestUserEntry
    | ICdmRestContentFileEntry
    | ICdmRestDbObjectEntry;

/** All possible types except connection groups. */
export type ConnectionDataModelNoGroupEntry = Exclude<ConnectionDataModelEntry, ICdmConnectionGroupEntry>;

export type ConnectionDMActionList = Array<ISubscriberActionType<ConnectionDataModelEntry>>;

/** Given a specific connection group this type contains all subgroups and connections of that group, recursively. */
export interface IFlatGroupList {
    groups: ICdmConnectionGroupEntry[];
    connections: ICdmConnectionEntry[];
}

export class ConnectionDataModel implements ICdmAccessManager {
    private rootGroup: ICdmConnectionGroupEntry;

    private subscribers = new Set<DataModelSubscriber<ConnectionDataModelEntry>>();

    /** Used for auto refreshing router statuses. */
    private refreshMrsRoutersTimer?: ReturnType<typeof setInterval>;

    private routerRefreshTime: number;

    #initialized: boolean = false;

    /**
     * Creates a new instance of the connection data model.
     *
     * @param singleServerMode Set to true if the data model should only create a temporary connection to the server.
     * @param refreshTime The time in milliseconds to wait between refreshing the MRS routers, when auto refresh
     *                    is enabled.
     */
    public constructor(private singleServerMode: boolean, refreshTime = 10000) {
        this.rootGroup = {
            id: uuid(),
            caption: "",
            type: CdmEntityType.ConnectionGroup,
            folderPath: { id: 1, caption: "/", index: 0 },
            entries: [],
            state: createDataModelEntryState(),
        };

        if (singleServerMode) {
            // In single server mode we only have one connection, with no details. The backend will ignore the values
            // and open a connection to a server, configured in the startup details.
            const details: IConnectionDetails = {
                id: 0,
                index: 0,
                dbType: DBType.MySQL,
                caption: "MySQL AI Server",
                description: "",
                options: {},
            };

            const connection = new ConnectionEntryImpl(details.caption, details, this, false);
            this.rootGroup.entries.push(connection);
        } else {
            this.rootGroup.refresh = () => { return this.updateConnectionGroup(this.rootGroup); };
        }

        this.routerRefreshTime = refreshTime;
    }
    /**
     * @returns the list of connections a user has stored in the backend.
     */
    public get roots(): Array<ICdmConnectionGroupEntry | ICdmConnectionEntry> {
        return this.rootGroup.entries;
    }

    public get autoRouterRefresh(): boolean {
        return !!this.refreshMrsRoutersTimer;
    }

    public set autoRouterRefresh(value: boolean) {
        if (value) {
            this.refreshMrsRoutersTimer = setInterval(() => {
                void this.connectionList().then((list) => {
                    list.forEach((c) => {
                        if (c.mrsEntry?.state.expanded) {
                            void c.mrsEntry.refresh!();
                        }
                    });
                });
            }, this.routerRefreshTime);
        } else {
            clearInterval(this.refreshMrsRoutersTimer);
            this.refreshMrsRoutersTimer = undefined;
        }
    }

    /**
     * Initializes the data model. This will load the list of connections from the backend and create the initial
     * data model. This method can be called multiple times, but will only do work once.
     *
     * Loading the connections requires a valid profile id. If no profile is loaded, the method will close all
     * connections and return without doing anything else.
     */
    public async initialize(): Promise<void> {
        if (!this.#initialized) {
            this.#initialized = true;
            await this.updateConnections();
        }
    }

    public get initialized(): boolean {
        return this.#initialized;
    }

    /**
     * Adds the given subscriber to the internal subscriber list for change notifications.
     *
     * @param subscriber The subscriber to add.
     */
    public subscribe(subscriber: DataModelSubscriber<ConnectionDataModelEntry>): void {
        this.subscribers.add(subscriber);
    }

    /**
     * Removes the given subscriber from the internal subscriber list.
     *
     * @param subscriber The subscriber to remove.
     */
    public unsubscribe(subscriber: DataModelSubscriber<ConnectionDataModelEntry>): void {
        this.subscribers.delete(subscriber);
    }

    /** Empties the data model and resets it to uninitialized. */
    public async clear(): Promise<void> {
        await this.closeAllConnections();
        this.rootGroup.entries.length = 0;
        this.#initialized = false;
        this.notifySubscribers([{ action: "clear" }]);
    }

    /**
     * Reloads all connections (e.g. to update after changes in the connection list).
     * This optimizes the connections list by only adding new connections and removing old ones.
     * In particular open sessions are kept open and not closed and reopened.
     *
     * Like with {@link initialize}, this method requires a valid profile id.
     */
    public async reloadConnections(): Promise<void> {
        this.#initialized = true;
        await this.updateConnections();
    }

    /** Closes all connections, but keeps them in the data model. */
    public async closeAllConnections(): Promise<void> {
        const connections = await this.connectionList();
        for (const connection of connections) {
            await connection.close();
        }
    }

    /**
     * Tries to drop the given item from it's remote location (e.g. database server, OCI etc.). The caller must ensure
     * the user confirms the action. The entry remains in the data model and must be removed explicitly
     * using {@link removeEntry}. Especially for connections call {@link removeEntry} before dropping the entry, to
     * ensure the connection is closed.
     *
     * @param entry The entry to drop.
     *
     * @returns A promise that resolves once the item is dropped.
     */
    public async dropItem(entry: ConnectionDataModelEntry): Promise<void> {
        switch (entry.type) {
            case CdmEntityType.ConnectionGroup: {
                const folder = entry.folderPath;
                const list = await ShellInterface.dbConnections.listAll(webSession.currentProfileId,
                    folder.id);
                if (list.length > 0) {
                    throw new Error("Cannot drop a connection group, which is not empty.");
                }

                await ShellInterface.dbConnections.removeFolderPath(folder.id);

                return;
            }

            case CdmEntityType.Connection: {
                return ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, entry.details.id);
            }

            default:
        }

        const connection = entry.connection;
        if (!connection) {
            throw new Error(`Cannot drop the item ${entry.caption} as it is not a database object.`);
        }

        const qualifiedName = this.getQualifiedName(entry);
        const typeName = cdbDbEntityTypeName.get(entry.type);
        if (typeName) {
            const query = `drop ${typeName} ${qualifiedName}`;
            await connection.backend.execute(query);
        }
    }

    /**
     * @returns True if the given connection id corresponds to a valid (and hence open) connection.
     *
     * @param connectionId The id of the connection to check.
     */
    public async isValidConnectionId(connectionId: number): Promise<boolean> {
        return (await this.findConnectionEntryById(connectionId)) !== undefined;
    }

    /**
     * Creates the qualified name for a database object entry (schema, schema.table, schema.table.column etc.).
     *
     * @param entry The entry to create the qualified name for.
     *
     * @returns The qualified name for the entry.
     * @throws An error if the entry is not a database object.
     */
    public getQualifiedName(entry: ConnectionDataModelNoGroupEntry): string {
        // Find the schema name from the entry, if it is a database object.
        let schema = "";
        let tableOrView = "";
        let objectName = "";
        switch (entry.type) {
            case CdmEntityType.Table:
            case CdmEntityType.View:
            case CdmEntityType.StoredProcedure:
            case CdmEntityType.StoredFunction:
            case CdmEntityType.Library:
            case CdmEntityType.Event: {
                schema = entry.parent.parent.caption;
                tableOrView = entry.caption;
                break;
            }

            case CdmEntityType.Column:
            case CdmEntityType.Index:
            case CdmEntityType.ForeignKey:
            case CdmEntityType.Trigger: {
                const owner = entry.parent;
                if (owner.type === CdmEntityType.View) {
                    schema = owner.parent.parent.caption;
                    tableOrView = owner.caption;
                } else {
                    schema = owner.parent.parent.parent.caption;
                    tableOrView = owner.parent.caption;
                }
                objectName = entry.caption;

                break;
            }

            default:
        }

        if (!schema && entry.type !== CdmEntityType.Schema) {
            throw new Error(`Cannot determine the fully qualified name of the item ${entry.caption}`);
        }

        let qualifiedName;
        if (entry.type === CdmEntityType.Schema) {
            qualifiedName = entry.caption;
        } else if (objectName === "") {
            qualifiedName = `\`${schema}\`.\`${tableOrView}\``;
        } else {
            qualifiedName = `\`${schema}\`.\`${tableOrView}\`.\`${objectName}\``;
        }

        return qualifiedName;
    }

    /**
     * Removes the given entry from the data model. If the entry is a connection, its session will be closed.
     *
     * @param entry The entry to remove.
     */
    public async removeEntry(entry: ConnectionDataModelEntry): Promise<void> {
        const actions: ConnectionDMActionList = [];

        switch (entry.type) {
            case CdmEntityType.ConnectionGroup:
            case CdmEntityType.Connection: {
                const parent = entry.parent ?? this.rootGroup;
                const index = parent.entries.indexOf(entry);
                if (index >= 0) {
                    if (entry.type === CdmEntityType.Connection) {
                        await entry.close();
                    }

                    const removed = parent.entries.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.Schema: {
                const index = entry.parent.schemaEntries.indexOf(entry);
                if (index >= 0) {
                    if (entry.parent.currentSchema === entry.caption) {
                        entry.parent.currentSchema = "";
                    }
                    const removed = entry.parent.schemaEntries.splice(index, 1);

                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.Table:
            case CdmEntityType.View:
            case CdmEntityType.StoredFunction:
            case CdmEntityType.StoredProcedure:
            case CdmEntityType.Library:
            case CdmEntityType.Event:
            case CdmEntityType.Trigger:
            case CdmEntityType.Index:
            case CdmEntityType.ForeignKey: {
                const index = entry.parent.members.indexOf(entry as never);
                if (index >= 0) {
                    const removed = entry.parent.members.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.Column: {
                if (entry.parent.type === CdmEntityType.View) {
                    const index = entry.parent.columns.indexOf(entry);
                    if (index >= 0) {
                        const removed = entry.parent.columns.splice(index, 1);
                        actions.push({ action: "remove", entry: removed[0] });
                    }
                } else {
                    const index = entry.parent.members.indexOf(entry);
                    if (index >= 0) {
                        const removed = entry.parent.members.splice(index, 1);
                        actions.push({ action: "remove", entry: removed[0] });
                    }
                }

                break;
            }

            /* TODO: should we allow to remove the admin entry?
            case CdmEntityType.Admin: {
                delete entry.parent.adminEntry;

                break;
            }*/

            case CdmEntityType.AdminPage: {
                const index = entry.parent.pages.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.pages.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            /* TODO: should we allow to remove the MRS root entry?
            case CdmEntityType.MrsRoot: {
                delete entry.parent.mrsEntry;

                break;
            }*/

            case CdmEntityType.MrsService: {
                const index = entry.parent.services.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.services.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsSchema: {
                const index = entry.parent.schemas.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.schemas.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsContentSet: {
                const index = entry.parent.contentSets.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.contentSets.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsUser: {
                const index = entry.parent.users.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.users.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsAuthApp: {
                const index = entry.parent.authApps.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.authApps.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsServiceAuthApp: {
                const index = entry.parent.authApps.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.authApps.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsContentFile: {
                const index = entry.parent.files.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.files.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsDbObject: {
                const index = entry.parent.dbObjects.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.dbObjects.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            case CdmEntityType.MrsRouter: {
                const index = entry.parent.routers.indexOf(entry);
                if (index >= 0) {
                    const removed = entry.parent.routers.splice(index, 1);
                    actions.push({ action: "remove", entry: removed[0] });
                }

                break;
            }

            default: {
                throw new Error(`Invalid entry ${entry.caption} given for removal.`);
            }
        }

        this.notifySubscribers(actions);
    }

    /**
     * Creates a new data model connection entry without adding it to this data model. This is useful for creating
     * new connections that are not yet stored in the backend.
     *
     * @param details The details (defaults) for the new connection.
     *
     * @returns The new connection entry.
     */
    public createConnectionEntry(details: IConnectionDetails): ICdmConnectionEntry {
        return new ConnectionEntryImpl(details.caption, details, this, webSession.runMode !== RunMode.SingleServer);
    }

    /**
     * Adds the given entry (usually created by {@link createConnectionEntry}) to the model.
     *
     * @param entry The entry to add.
     */
    public async addConnectionEntry(entry: ICdmConnectionEntry): Promise<void> {
        const actions: ConnectionDMActionList = [];

        const group = await this.groupFromPath(entry.details.folderPath, actions);
        group.entries.push(entry);
        (entry as ConnectionEntryImpl).parent = group;

        this.notifySubscribers(actions);
    }

    /**
     * Finds a connection entry by its ID, optionally restricting the search to a specific folder path.
     * Providing the folderPath parameter improves performance by limiting the search scope instead of
     * refreshing all connection groups, which can be inefficient with many connections.
     *
     * @param id The id of the connection to find.
     * @param folderPath A path under which the connection is organized.
     *
     * @returns The connection entry with the given id, or `undefined` if no such entry exists.
     */
    public async findConnectionEntryById(id: number, folderPath?: string): Promise<ICdmConnectionEntry | undefined> {
        return (await this.connectionList(folderPath)).find((entry) => { return entry.details.id === id; });
    }

    /**
     * @returns The connection group entry with the given id, or `undefined` if no such entry exists.
     *
     * @param id The id of the connection group to find.
     * @param folderPath A path under which the group is organized.
     */
    public async findConnectionGroupEntryById(id: number, folderPath = "/")
        : Promise<ICdmConnectionGroupEntry | undefined> {
        return (await this.groupList(folderPath)).find((entry) => { return entry.folderPath.id === id; });
    }

    /**
     * @returns The first connection entry with the given title/caption, or `undefined` if no such entry exists.
     *
     * @param caption The caption of the connection to find.
     */
    public async findConnectionEntryByCaption(caption: string): Promise<ICdmConnectionEntry | undefined> {
        return (await this.connectionList()).find((entry) => { return entry.details.caption === caption; });
    }

    public async updateConnectionDetails(data: IConnectionDetails | ICdmConnectionEntry)
        : Promise<ICdmConnectionEntry | undefined> {
        let details: IConnectionDetails;

        let id;
        if ("type" in data && data.type === CdmEntityType.Connection) {
            id = data.details.id;
            details = data.details;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            details = data as IConnectionDetails; // ESLint is wrong here.
            id = details.id;
        }

        const entry = await this.findConnectionEntryById(id, details.folderPath) as Mutable<ICdmConnectionEntry>;
        if (entry) {
            entry.details = details;
            entry.caption = details.caption;
            this.notifySubscribers([{ action: "update", entry }]);
        }

        return entry;
    }

    /**
     * This method is called by entries that are implemented in own files to update their content.
     * This avoids dragging all initialization code into their files.
     *
     * @param entry The entry to update.
     * @param callback An optional callback to report progress.
     *
     * @returns A promise that resolves once the entry is updated.
     */
    public async updateEntry(entry: ConnectionDataModelEntry, callback?: ProgressCallback): Promise<boolean> {
        switch (entry.type) {
            case CdmEntityType.Connection: {
                return this.updateConnection(entry as ConnectionEntryImpl);
            }

            case CdmEntityType.MrsRoot: {
                return this.updateMrsRoot(entry as Mutable<ICdmRestRootEntry>, callback);
            }

            case CdmEntityType.MrsAuthAppGroup: {
                return this.updateMrsAuthAppGroup(entry as Mutable<ICdmRestAuthAppGroupEntry>, callback);
            }

            default: {
                return Promise.resolve(true);
            }
        }
    }

    public groupList = async (folderPath = "/"): Promise<ICdmConnectionGroupEntry[]> => {
        const predicate = (entry: ICdmConnectionGroupEntry | ICdmConnectionEntry) => {
            return entry.type === CdmEntityType.ConnectionGroup;
        };

        return this.collectEntries<ICdmConnectionGroupEntry>(
            folderPath,
            predicate,
        );
    };

    public connectionList = async (folderPath = "/"): Promise<ICdmConnectionEntry[]> => {
        const predicate = (entry: ICdmConnectionGroupEntry | ICdmConnectionEntry) => {
            return entry.type === CdmEntityType.Connection;
        };

        return this.collectEntries<ICdmConnectionEntry>(
            folderPath,
            predicate,
        );
    };

    public async getCredentials(): Promise<ILoginCredentials | undefined> {
        return webSession.decryptCredentials();
    }

    /**
     * Makes sure there are group entries in this data model for the path segments in the given path.
     * This will also create the folders in the backend.
     *
     * @param folderPath The path to create (or verify).
     * @param actions Used to add action info for changes done in this method.
     *
     * @returns The group entry for the last part of the path.
     */
    public async groupFromPath(folderPath?: string,
        actions?: ConnectionDMActionList): Promise<ICdmConnectionGroupEntry> {
        if (!folderPath || folderPath === "/") {
            // This is a top level entry and has no parent folder.
            return this.rootGroup;
        }

        const path = folderPath.substring(1);

        // Walk the full path and create group entries as needed.
        const parts = path.split("/");
        let currentGroup = this.rootGroup;
        let currentList = this.rootGroup.entries;

        const findGroup = (name: string): ICdmConnectionGroupEntry | undefined => {
            return currentList.find((e) => {
                return e.caption === name && e.type === CdmEntityType.ConnectionGroup;
            }) as ICdmConnectionGroupEntry | undefined;
        };

        for (const part of parts) {
            // Does a group with this name already exist?
            let group = findGroup(part);

            if (group === undefined) {
                await this.updateConnectionGroup(currentGroup);
                currentList = currentGroup.entries;
                group = findGroup(part);
            }

            if (group === undefined) {
                const folderPath = await ShellInterface.dbConnections.addFolderPath(webSession.currentProfileId, part,
                    currentGroup?.folderPath.id);

                group = {
                    type: CdmEntityType.ConnectionGroup,
                    id: uuid(),
                    caption: part,
                    parent: currentGroup,
                    entries: [],
                    state: createDataModelEntryState(false, false),
                    folderPath,
                    getChildren: () => { return group!.entries; },
                    refresh: () => { return this.updateConnectionGroup(group!); },
                };

                actions?.push({ action: "add", entry: group });

                currentList.push(group);
            }
            currentGroup = group;
            currentList = group.entries;
        }

        return currentGroup;
    }

    public findConnectionGroupByName(path: string[]): ICdmConnectionGroupEntry | undefined {
        let group: ICdmConnectionGroupEntry | undefined = this.rootGroup;
        path.shift(); // Remove the first entry which is our root group.
        for (const part of path) {
            group = group.entries.find((e) => {
                return e.type === CdmEntityType.ConnectionGroup && e.folderPath.caption === part;
            }) as ICdmConnectionGroupEntry | undefined;

            if (!group) {
                break;
            }
        }

        return group;
    }

    public findConnectionGroupById(path: number[]): ICdmConnectionGroupEntry | undefined {
        let group: ICdmConnectionGroupEntry | undefined = this.rootGroup;
        path.shift(); // Remove the first entry which is our root group.
        for (const part of path) {
            group = group.entries.find((e) => {
                return e.type === CdmEntityType.ConnectionGroup && e.folderPath.id === part;
            }) as ICdmConnectionGroupEntry | undefined;

            if (!group) {
                break;
            }
        }

        return group;
    }

    /**
     * Scans the given connection group and returns a flat list of all groups and connections in that group.
     * This will refresh the group and all it's subgroups, if needed.
     *
     * @param group The group to flatten. It will be included in the result.
     *
     * @returns A flat list of all groups and connections in the given group.
     */
    public async flattenGroupList(group: ICdmConnectionGroupEntry): Promise<IFlatGroupList> {
        const result: IFlatGroupList = {
            groups: [group],
            connections: [],
        };

        await group.refresh?.();
        const addEntry = async (entry: ICdmConnectionGroupEntry | ICdmConnectionEntry) => {
            if (entry.type === CdmEntityType.ConnectionGroup) {
                result.groups.push(entry);
                await entry.refresh?.();
                for (const child of entry.entries) {
                    await addEntry(child);
                }
            } else {
                result.connections.push(entry);
            }
        };

        for (const entry of group.entries) {
            await addEntry(entry);
        }

        return result;
    }

    private async collectEntries<T extends ICdmConnectionGroupEntry | ICdmConnectionEntry>(folderPath: string,
        filterFn: (entry: ICdmConnectionGroupEntry | ICdmConnectionEntry) => boolean): Promise<T[]> {
        const result: T[] = [];

        const addEntry = async (entry: ICdmConnectionGroupEntry | ICdmConnectionEntry) => {
            if (entry.type === CdmEntityType.ConnectionGroup) {
                if (!entry.state.initialized) {
                    await entry.refresh?.();
                }
                if (filterFn(entry)) {
                    result.push(entry as T);
                }
                for (const child of entry.entries) {
                    await addEntry(child);
                }
            } else {
                if (filterFn(entry)) {
                    result.push(entry as T);
                }
            }
        };

        const group = await this.groupFromPath(folderPath);
        if (!group.state.initialized) {
            await group.refresh?.();
        }

        for (const entry of group.entries) {
            await addEntry(entry);
        }

        return result;
    }

    /**
     * Queries the backend for a list of stored user DB connections and updates the connection list.
     * It does a diff between the current list and the new list and closes all connections that are no longer in the
     * new list, while keeping existing connections open.
     *
     * @returns A promise that resolves once the connections are updated (true means success).
     */
    private async updateConnections(): Promise<boolean> {
        if (!this.singleServerMode) {
            const promise = this.updateConnectionGroup(this.rootGroup);
            requisitions.executeRemote("connectionsUpdated", undefined);

            return promise;
        }

        return false;
    }

    /**
     * Fills the schema list of the given connection entry, and adds the fixed group entries to each schema entry.
     * This is used for initialization of the data model, so we do not send out notifications. Same for all other
     * initialization methods below.
     *
     * @param connection The connection entry to update.
     *
     * @returns True if the operation was successful, false otherwise.
     */
    private updateConnection(connection: Mutable<ConnectionEntryImpl>): boolean {
        const actions: ConnectionDMActionList = [];
        try {
            // The schemaNames list is updated in ConnectionEntryImpl right before this method is called.

            // Remove entries no longer in the schema list.
            const removedSchemas = connection.schemaEntries.filter((e) => {
                return !connection.schemaNames.includes(e.caption);
            });

            for (const schema of removedSchemas) {
                actions.push({ action: "remove", entry: schema });
            }

            // Create a new schema entries list from the schema names in their order. Take over existing
            // schema entries.
            const newSchemaEntries: ICdmSchemaEntry[] = [];
            for (const schema of connection.schemaNames) {
                const existing = connection.schemaEntries.find((e) => { return e.caption === schema; });
                if (existing) {
                    newSchemaEntries.push(existing);

                    continue;
                }

                const schemaEntry: Partial<Mutable<ICdmSchemaEntry>> = {
                    parent: connection,
                    type: CdmEntityType.Schema,
                    id: uuid(),
                    state: createDataModelEntryState(false, true),
                    caption: schema,
                    connection,
                    getChildren: () => { return []; }, // Updated below.
                };

                const tablesSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.Table>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Tables",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.Table,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                tablesSchemaGroup.refresh = () => {
                    return this.updateTablesSchemaGroup(tablesSchemaGroup);
                };
                tablesSchemaGroup.getChildren = () => { return tablesSchemaGroup.members; };

                schemaEntry.tables = tablesSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Table>;

                const viewsSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.View>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Views",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.View,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                viewsSchemaGroup.refresh = () => { return this.updateViewsSchemaGroup(viewsSchemaGroup); };
                viewsSchemaGroup.getChildren = () => { return viewsSchemaGroup.members; };

                schemaEntry.views = viewsSchemaGroup;

                const eventsSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.Event>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Events",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.Event,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                eventsSchemaGroup.refresh = () => {
                    return this.updateEventsSchemaGroup(
                        eventsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Event>);
                };
                eventsSchemaGroup.getChildren = () => { return eventsSchemaGroup.members; };

                schemaEntry.events = eventsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Event>;

                const proceduresSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Procedures",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.StoredProcedure,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                proceduresSchemaGroup.refresh = () => {
                    return this.updateProceduresSchemaGroup(
                        proceduresSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>);
                };
                proceduresSchemaGroup.getChildren = () => { return proceduresSchemaGroup.members; };

                schemaEntry.procedures = proceduresSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>;

                const functionsSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Functions",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.StoredFunction,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                functionsSchemaGroup.refresh = () => {
                    return this.updateFunctionsSchemaGroup(
                        functionsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>,
                    );
                };
                functionsSchemaGroup.getChildren = () => { return functionsSchemaGroup.members; };

                schemaEntry.functions = functionsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>;

                const librariesSchemaGroup: Mutable<ICdmSchemaGroupEntry<CdmEntityType.Library>> = {
                    parent: schemaEntry as ICdmSchemaEntry,
                    id: uuid(),
                    caption: "Libraries",
                    type: CdmEntityType.SchemaGroup,
                    state: createDataModelEntryState(),
                    subType: CdmEntityType.Library,
                    members: [],
                    connection: schemaEntry.connection!,
                    getChildren: () => { return []; },
                };

                librariesSchemaGroup.refresh = () => {
                    return this.updateLibrariesSchemaGroup(
                        librariesSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Library>,
                    );
                };
                librariesSchemaGroup.getChildren = () => { return librariesSchemaGroup.members; };

                schemaEntry.libraries = librariesSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Library>;

                schemaEntry.getChildren = () => {
                    return [
                        schemaEntry.tables!,
                        schemaEntry.views!,
                        schemaEntry.procedures!,
                        schemaEntry.functions!,
                        schemaEntry.libraries!,
                        schemaEntry.events!,
                    ];
                };

                newSchemaEntries.push(schemaEntry as ICdmSchemaEntry);
            }

            // Update the schema entries list.
            connection.schemaEntries = newSchemaEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load schemas for connection ${connection.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateTablesSchemaGroup(
        tableGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.Table>>): Promise<boolean> {
        tableGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = tableGroup.parent.caption;
            const tableNames = await tableGroup.connection.backend.getSchemaObjectNames(schema, "Table");

            // Remove entries no longer in the table list.
            const removedTables = tableGroup.members.filter((e) => {
                return !tableNames.includes(e.caption);
            });

            for (const table of removedTables) {
                actions.push({ action: "remove", entry: table as ConnectionDataModelEntry });
            }

            // Create a new table entries list from the table names in their order. Take over existing
            // table entries.
            const newTableEntries: ICdmTableEntry[] = [];
            for (const table of tableNames) {
                const existing = tableGroup.members.find((e) => { return e.caption === table; });
                if (existing) {
                    newTableEntries.push(existing as ICdmTableEntry);

                    continue;
                }

                const tableEntry: Partial<Mutable<ICdmTableEntry>> = {
                    parent: tableGroup as ICdmSchemaGroupEntry<CdmEntityType.Table>,
                    type: CdmEntityType.Table,
                    id: uuid(),
                    state: createDataModelEntryState(),
                    caption: table,
                    schema,
                    connection: tableGroup.parent.parent as ICdmConnectionEntry,
                };

                const columnsTableGroup: Mutable<ICdmTableGroupEntry<CdmEntityType.Column>> = {
                    parent: tableEntry as ICdmTableEntry,
                    caption: "Columns",
                    type: CdmEntityType.TableGroup,
                    state: createDataModelEntryState(),
                    id: uuid(),
                    subType: CdmEntityType.Column,
                    members: [],
                    connection: tableEntry.connection as ICdmConnectionEntry,
                };

                columnsTableGroup.refresh = () => {
                    return this.updateColumnsTableGroup(columnsTableGroup);
                };
                columnsTableGroup.getChildren = () => {
                    return columnsTableGroup.members;
                };

                tableEntry.columns = columnsTableGroup as ICdmTableGroupEntry<CdmEntityType.Column>;

                const indexesTableGroup: Mutable<ICdmTableGroupEntry<CdmEntityType.Index>> = {
                    parent: tableEntry as ICdmTableEntry,
                    caption: "Indexes",
                    type: CdmEntityType.TableGroup,
                    state: createDataModelEntryState(),
                    id: uuid(),
                    subType: CdmEntityType.Index,
                    members: [],
                    connection: tableEntry.connection as ICdmConnectionEntry,
                };

                indexesTableGroup.refresh = () => {
                    return this.updateIndexesTableGroup(
                        indexesTableGroup as ICdmTableGroupEntry<CdmEntityType.Index>);
                };
                indexesTableGroup.getChildren = () => {
                    return indexesTableGroup.members;
                };

                tableEntry.indexes = indexesTableGroup as ICdmTableGroupEntry<CdmEntityType.Index>;

                const foreignKeysTableGroup: Mutable<ICdmTableGroupEntry<CdmEntityType.ForeignKey>> = {
                    parent: tableEntry as ICdmTableEntry,
                    caption: "Foreign Keys",
                    type: CdmEntityType.TableGroup,
                    state: createDataModelEntryState(),
                    id: uuid(),
                    subType: CdmEntityType.ForeignKey,
                    members: [],
                    connection: tableEntry.connection as ICdmConnectionEntry,
                    getChildren: () => { return []; },
                };

                foreignKeysTableGroup.refresh = () => {
                    return this.updateForeignKeysTableGroup(
                        foreignKeysTableGroup as ICdmTableGroupEntry<CdmEntityType.ForeignKey>);
                };
                foreignKeysTableGroup.getChildren = () => {
                    return foreignKeysTableGroup.members;
                };

                tableEntry.foreignKeys = foreignKeysTableGroup as ICdmTableGroupEntry<CdmEntityType.ForeignKey>;

                const triggersTableGroup: Mutable<ICdmTableGroupEntry<CdmEntityType.Trigger>> = {
                    parent: tableEntry as ICdmTableEntry,
                    caption: "Triggers",
                    type: CdmEntityType.TableGroup,
                    id: uuid(),
                    state: createDataModelEntryState(false, true),
                    subType: CdmEntityType.Trigger,
                    members: [],
                    connection: tableEntry.connection as ICdmConnectionEntry,
                };

                triggersTableGroup.refresh = () => {
                    return this.updateTriggersTableGroup(
                        triggersTableGroup as ICdmTableGroupEntry<CdmEntityType.Trigger>);
                };
                triggersTableGroup.getChildren = () => {
                    return [
                        ...triggersTableGroup.members,
                    ];
                };

                tableEntry.triggers = triggersTableGroup;

                tableEntry.getChildren = () => {
                    return [
                        tableEntry.columns!,
                        tableEntry.indexes!,
                        tableEntry.foreignKeys!,
                        tableEntry.triggers!,
                    ];
                };

                newTableEntries.push(tableEntry as ICdmTableEntry);
            }

            tableGroup.members = newTableEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load tables for schema ${tableGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateViewsSchemaGroup(
        viewGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.View>>): Promise<boolean> {
        viewGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = viewGroup.parent.caption;
            const viewNames = await viewGroup.connection.backend.getSchemaObjectNames(schema, "View");

            // Remove entries no longer in the view list.
            const removedViews = viewGroup.members.filter((e) => {
                return !viewNames.includes(e.caption);
            });

            for (const view of removedViews) {
                actions.push({ action: "remove", entry: view as ConnectionDataModelEntry });
            }

            // Create a new view entries list from the view names in their order. Take over existing
            // view entries.
            const newViewEntries: ICdmViewEntry[] = [];
            for (const view of viewNames) {
                const existing = viewGroup.members.find((e) => { return e.caption === view; });
                if (existing) {
                    newViewEntries.push(existing as ICdmViewEntry);

                    continue;
                }

                const viewEntry: Mutable<ICdmViewEntry> = {
                    parent: viewGroup as ICdmSchemaGroupEntry<CdmEntityType.View>,
                    type: CdmEntityType.View,
                    id: uuid(),
                    state: createDataModelEntryState(true),
                    caption: view,
                    schema,
                    connection: viewGroup.connection as ICdmConnectionEntry,
                    columns: [],
                };

                viewEntry.refresh = () => {
                    return this.updateView(viewEntry);
                };

                newViewEntries.push(viewEntry);
            }

            viewGroup.members = newViewEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load views for schema ${viewGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateEventsSchemaGroup(
        eventGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.Event>>): Promise<boolean> {
        eventGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = eventGroup.parent.caption;
            const eventNames = await eventGroup.connection.backend.getSchemaObjectNames(schema, "Event");

            // Remove entries no longer in the event list.
            const removedEvents = eventGroup.members.filter((e) => {
                return !eventNames.includes(e.caption);
            });

            for (const event of removedEvents) {
                actions.push({ action: "remove", entry: event as ConnectionDataModelEntry });
            }

            // Create a new event entries list from the event names in their order. Take over existing
            // event entries.
            const newEventEntries: ICdmEventEntry[] = [];
            for (const event of eventNames) {
                const existing = eventGroup.members.find((e) => { return e.caption === event; });
                if (existing) {
                    newEventEntries.push(existing as ICdmEventEntry);

                    continue;
                }

                const eventEntry: Mutable<ICdmEventEntry> = {
                    parent: eventGroup as ICdmSchemaGroupEntry<CdmEntityType.Event>,
                    type: CdmEntityType.Event,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    caption: event,
                    schema,
                    connection: eventGroup.parent.parent as ICdmConnectionEntry,
                };

                newEventEntries.push(eventEntry as ICdmEventEntry);
            }

            eventGroup.members = newEventEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load events for schema ${eventGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateProceduresSchemaGroup(
        group: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>>): Promise<boolean> {
        group.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = group.parent.caption;
            const procedures = await group.connection.backend
                .getRoutinesMetadata(schema);

            // Remove entries no longer in the procedure list.
            const procedureNames = procedures.map((e) => { return e.name; });
            const removedProcedures = group.members.filter((e) => {
                return !procedureNames.includes(e.caption);
            });

            for (const procedure of removedProcedures) {
                actions.push({ action: "remove", entry: procedure as ConnectionDataModelEntry });
            }

            // Create a new procedure entries list from the procedure names in their order. Take over existing
            // procedure entries.
            const newProcedureEntries: ICdmRoutineEntry[] = [];
            for (const procedure of procedures) {
                if (procedure.type === "PROCEDURE") {
                    const existing = group.members.find((e) => { return e.caption === procedure.name; });
                    if (existing) {
                        newProcedureEntries.push(existing as ICdmRoutineEntry);

                        continue;
                    }

                    const procedureEntry: DeepMutable<ICdmRoutineEntry> = {
                        parent: group,
                        type: CdmEntityType.StoredProcedure,
                        id: uuid(),
                        state: createDataModelEntryState(true, true),
                        caption: procedure.name,
                        language: procedure.language,
                        schema,
                        connection: group.connection,
                    };

                    newProcedureEntries.push(procedureEntry as ICdmRoutineEntry);
                }
            }

            group.members = newProcedureEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load procedures for schema ${group.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateFunctionsSchemaGroup(
        group: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>>): Promise<boolean> {
        group.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = group.parent.caption;
            const functions = await group.connection.backend
                .getRoutinesMetadata(schema);

            // Remove entries no longer in the function list.
            const functionNames = functions.map((e) => { return e.name; });
            const removedFunctions = group.members.filter((e) => {
                return !functionNames.includes(e.caption);
            });

            for (const func of removedFunctions) {
                actions.push({ action: "remove", entry: func as ConnectionDataModelEntry });
            }

            // Create a new function entries list from the function names in their order. Take over existing
            // function entries.
            const newFunctionEntries: ICdmRoutineEntry[] = [];
            for (const func of functions) {
                if (func.type === "FUNCTION") {
                    const existing = group.members.find((e) => { return e.caption === func.name; });
                    if (existing) {
                        newFunctionEntries.push(existing as ICdmRoutineEntry);

                        continue;
                    }

                    const functionEntry: DeepMutable<ICdmRoutineEntry> = {
                        parent: group,
                        type: CdmEntityType.StoredFunction,
                        id: uuid(),
                        state: createDataModelEntryState(true, true),
                        caption: func.name,
                        schema,
                        connection: group.parent.parent,
                        language: func.language,
                    };

                    newFunctionEntries.push(functionEntry as ICdmRoutineEntry);
                }
            }

            group.members = newFunctionEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load functions for schema ${group.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateLibrariesSchemaGroup(
        group: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.Library>>): Promise<boolean> {
        group.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = group.parent.caption;
            const libraries = await group.connection.backend
                .getLibrariesMetadata(schema);

            // Remove entries no longer in the function list.
            const libraryNames = libraries.map((e) => { return e.name; });
            const removedLibraries = group.members.filter((e) => {
                return !libraryNames.includes(e.caption);
            });

            for (const lib of removedLibraries) {
                actions.push({ action: "remove", entry: lib as ConnectionDataModelEntry });
            }

            // Create a new function entries list from the function names in their order. Take over existing
            // function entries.
            const newLibraryEntries: ICdmLibraryEntry[] = [];
            for (const lib of libraries) {
                const existing = group.members.find((e) => { return e.caption === lib.name; });
                if (existing) {
                    newLibraryEntries.push(existing as ICdmLibraryEntry);

                    continue;
                }

                const libraryEntry: DeepMutable<ICdmLibraryEntry> = {
                    parent: group,
                    type: CdmEntityType.Library,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    caption: lib.name,
                    schema,
                    connection: group.parent.parent,
                    language: lib.language,
                };

                newLibraryEntries.push(libraryEntry as ICdmLibraryEntry);
            }

            group.members = newLibraryEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load libraries for schema ${group.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateView(viewEntry: DeepMutable<ICdmViewEntry>): Promise<boolean> {
        viewEntry.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            // Unlike tables, there are no column group nodes. Instead, columns are attached directly to a view node.
            const columnNames = await viewEntry.connection.backend.getTableObjectNames(viewEntry.schema,
                viewEntry.caption, "Column");

            // Remove entries no longer in the column list.
            const removedColumns = viewEntry.columns.filter((e) => {
                return !columnNames.includes(e.caption);
            });

            for (const column of removedColumns) {
                actions.push({ action: "remove", entry: column as ConnectionDataModelEntry });
            }

            // Create a new column entries list from the column names in their order. Take over existing
            // column entries.
            const newColumnEntries: ICdmColumnEntry[] = [];
            for (const column of columnNames) {
                const existing = viewEntry.columns.find((e) => { return e.caption === column; });
                if (existing) {
                    newColumnEntries.push(existing as ICdmColumnEntry);

                    continue;
                }

                const columnEntry: ICdmColumnEntry = {
                    parent: viewEntry as ICdmViewEntry,
                    id: uuid(),
                    type: CdmEntityType.Column,
                    state: createDataModelEntryState(true),
                    caption: column,
                    schema: viewEntry.schema,
                    table: viewEntry.caption,
                    connection: viewEntry.parent.parent.parent as ICdmConnectionEntry,
                    inPK: false,
                    default: "",
                    nullable: true,
                    autoIncrement: false,
                };

                newColumnEntries.push(columnEntry);
            }

            viewEntry.columns = newColumnEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load columns for view ${viewEntry.caption}: ${message}`, {});

            return false;
        }

        return Promise.resolve(true);
    }

    private async updateColumnsTableGroup(
        columnGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Column>>): Promise<boolean> {
        columnGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = columnGroup.parent.schema;
            const table = columnGroup.parent.caption;
            const columnNames = await columnGroup.connection.backend.getTableObjectNames(schema, table, "Column");

            // Remove entries no longer in the column list.
            const removedColumns = columnGroup.members.filter((e) => {
                return !columnNames.includes(e.caption);
            });

            for (const column of removedColumns) {
                actions.push({ action: "remove", entry: column as ConnectionDataModelEntry });
            }

            // Create a new column entries list from the column names in their order. Take over existing
            // column entries.
            const newColumnEntries: ICdmColumnEntry[] = [];
            for (const column of columnNames) {
                const info = await columnGroup.connection.backend.getTableObject(schema, table, "Column", column);
                const existing = columnGroup.members.find((e) => { return e.caption === column; });
                if (existing) {
                    existing.inPK = info.isPk === 1;
                    existing.default = info.default;
                    existing.nullable = info.notNull === 0;
                    existing.autoIncrement = info.autoIncrement === 1;

                    newColumnEntries.push(existing as ICdmColumnEntry);
                    continue;
                }

                const columnEntry: DeepMutable<ICdmColumnEntry> = {
                    parent: columnGroup,
                    id: uuid(),
                    type: CdmEntityType.Column,
                    state: createDataModelEntryState(true, true),
                    caption: column,
                    schema,
                    table,
                    inPK: info.isPk === 1,
                    default: info.default,
                    nullable: info.notNull === 0,
                    autoIncrement: info.autoIncrement === 1,
                    connection: columnGroup.connection,

                };

                newColumnEntries.push(columnEntry as ICdmColumnEntry);
            }

            columnGroup.members = newColumnEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load columns for table ${columnGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateIndexesTableGroup(
        indexGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Index>>): Promise<boolean> {
        indexGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = indexGroup.parent.schema;
            const table = indexGroup.parent.caption;
            const indexNames = await indexGroup.connection.backend.getTableObjectNames(schema, table, "Index");

            // Remove entries no longer in the index list.
            const removedIndexes = indexGroup.members.filter((e) => {
                return !indexNames.includes(e.caption);
            });

            for (const index of removedIndexes) {
                actions.push({ action: "remove", entry: index as ConnectionDataModelEntry });
            }

            // Create a new index entries list from the index names in their order. Take over existing
            // index entries.
            const newIndexEntries: ICdmIndexEntry[] = [];
            for (const index of indexNames) {
                const existing = indexGroup.members.find((e) => { return e.caption === index; });
                if (existing) {
                    newIndexEntries.push(existing as ICdmIndexEntry);

                    continue;
                }

                const indexEntry: DeepMutable<ICdmIndexEntry> = {
                    parent: indexGroup,
                    id: uuid(),
                    type: CdmEntityType.Index,
                    state: createDataModelEntryState(true, true),
                    caption: index,
                    schema,
                    table,
                    connection: indexGroup.connection,
                };

                newIndexEntries.push(indexEntry as ICdmIndexEntry);
            }

            indexGroup.members = newIndexEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load indexes for table ${indexGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateForeignKeysTableGroup(
        foreignKeyGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.ForeignKey>>): Promise<boolean> {
        foreignKeyGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = foreignKeyGroup.parent.schema;
            const table = foreignKeyGroup.parent.caption;
            const foreignKeyNames = await foreignKeyGroup.connection.backend.getTableObjectNames(schema, table,
                "Foreign Key");

            // Remove entries no longer in the foreign key list.
            const removedForeignKeys = foreignKeyGroup.members.filter((e) => {
                return !foreignKeyNames.includes(e.caption);
            });

            for (const foreignKey of removedForeignKeys) {
                actions.push({ action: "remove", entry: foreignKey as ConnectionDataModelEntry });
            }

            // Create a new foreign key entries list from the foreign key names in their order. Take over existing
            // foreign key entries.
            const newForeignKeyEntries: ICdmForeignKeyEntry[] = [];
            for (const foreignKey of foreignKeyNames) {
                const existing = foreignKeyGroup.members.find((e) => { return e.caption === foreignKey; });
                if (existing) {
                    newForeignKeyEntries.push(existing as ICdmForeignKeyEntry);

                    continue;
                }

                const foreignKeyEntry: DeepMutable<ICdmForeignKeyEntry> = {
                    parent: foreignKeyGroup,
                    id: uuid(),
                    type: CdmEntityType.ForeignKey,
                    state: createDataModelEntryState(true, true),
                    caption: foreignKey,
                    schema,
                    table,
                    connection: foreignKeyGroup.connection,
                };

                newForeignKeyEntries.push(foreignKeyEntry as ICdmForeignKeyEntry);
            }

            foreignKeyGroup.members = newForeignKeyEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load foreign keys for table ${foreignKeyGroup.parent.caption}: ` +
                `${message}`, {});

            return false;
        }

        return true;
    }

    private async updateTriggersTableGroup(
        triggerGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Trigger>>): Promise<boolean> {
        triggerGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            const schema = triggerGroup.parent.schema;
            const table = triggerGroup.parent.caption;
            const triggerNames = await triggerGroup.connection.backend.getTableObjectNames(schema, table,
                "Foreign Key");

            // Remove entries no longer in the trigger list.
            const removedTriggers = triggerGroup.members.filter((e) => {
                return !triggerNames.includes(e.caption);
            });

            for (const trigger of removedTriggers) {
                actions.push({ action: "remove", entry: trigger as ConnectionDataModelEntry });
            }

            // Create a new trigger entries list from the trigger names in their order. Take over existing
            // trigger entries.
            const newTriggerEntries: ICdmTriggerEntry[] = [];
            for (const foreignKey of triggerNames) {
                const existing = triggerGroup.members.find((e) => { return e.caption === foreignKey; });
                if (existing) {
                    newTriggerEntries.push(existing as ICdmTriggerEntry);

                    continue;
                }

                const triggerEntry: DeepMutable<ICdmTriggerEntry> = {
                    parent: triggerGroup,
                    id: uuid(),
                    type: CdmEntityType.Trigger,
                    state: createDataModelEntryState(true, true),
                    caption: foreignKey,
                    schema,
                    table,
                    connection: triggerGroup.connection,
                };

                newTriggerEntries.push(triggerEntry as ICdmTriggerEntry);
            }

            triggerGroup.members = newTriggerEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load triggers for table ${triggerGroup.parent.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

    /**
     * Updates all child entries of the MRS root (like MRS services and routers).
     *
     * @param mrsRoot The MRS root element.
     * @param callback An optional callback to report progress.
     *
     * @returns A promise that resolves once the MRS services/routers have been loaded.
     */
    private async updateMrsRoot(mrsRoot: DeepMutable<ICdmRestRootEntry>,
        callback?: ProgressCallback): Promise<boolean> {

        const actions: ConnectionDMActionList = [];
        try {
            const backend = mrsRoot.parent.backend;

            callback?.("Loading MRS services and routers ...");
            const services = await backend.mrs.listServices();

            const status = await backend.mrs.status();

            mrsRoot.serviceEnabled = status.serviceEnabled;

            // Remove all services that are no longer in the new list.
            const removedServices = mrsRoot.services.filter((s) => {
                return !services.find((service) => {
                    return service.id === s.details.id;
                });
            }) as ICdmRestServiceEntry[];

            removedServices.forEach((s) => {
                actions.push({ action: "remove", entry: s });
            });

            mrsRoot.services = mrsRoot.services.filter((s) => {
                return services.find((service) => {
                    return service.id === s.details.id;
                });
            });

            // Next insert all new entries and take over existing entries.
            const newList: ICdmRestServiceEntry[] = [];
            for (const service of services) {
                let label = service.urlContextRoot;
                if (service.urlHostName) {
                    label = label + ` (${service.urlHostName})`;
                }

                // If this service exists already in the current list, update it.
                const existing = mrsRoot.services.find((s) => {
                    return s.details.id === service.id;
                });

                if (existing) {
                    // Entries match. Update certain values and move on to the next one.
                    newList.push(existing as ICdmRestServiceEntry);
                    existing.details = service;
                    existing.caption = label;
                    this.updateServiceFields(existing as ICdmRestServiceEntry);

                    actions.push({ action: "update", entry: existing as ICdmRestServiceEntry });

                    continue;
                }

                // Must be a new entry then.
                const serviceEntry = this.createMrsServiceEntry(mrsRoot as ICdmRestRootEntry, service, label);
                newList.push(serviceEntry);
                actions.push({ action: "add", entry: serviceEntry });
            }

            mrsRoot.services = newList;

            // We do the same here for routers.
            const routers = await backend.mrs.listRouters(10);

            const removedRouters = mrsRoot.routerGroup.routers.filter((s) => {
                return !routers.find((router) => {
                    return router.id === s.details.id;
                });
            }) as ICdmRestRouterEntry[];

            removedRouters.forEach((s) => {
                actions.push({ action: "remove", entry: s });
            });

            const newRouterList: ICdmRestRouterEntry[] = [];
            for (const router of routers) {
                const existing = mrsRoot.routerGroup.routers.find((s) => {
                    return s.details.id === router.id;
                });

                let description: string;
                if (router.options && router.options.developer) {
                    description = `[${String(router.options.developer)}] ${router.version}`;
                } else {
                    description = router.version;
                }

                if (existing) {
                    existing.details = router;
                    existing.caption = router.address;
                    existing.description = description;

                    newRouterList.push(existing as ICdmRestRouterEntry);
                    actions.push({ action: "update", entry: existing as ICdmRestRouterEntry });

                    continue;
                }

                const routerEntry = this.createMrsRouterEntry(mrsRoot.routerGroup as ICdmRestRouterGroupEntry, router,
                    description);
                newRouterList.push(routerEntry as ICdmRestRouterEntry);
                actions.push({ action: "add", entry: routerEntry });
            }

            mrsRoot.routerGroup.routers = newRouterList;

            this.notifySubscribers(actions);
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS content: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateMrsAuthAppGroup(authAppGroup: DeepMutable<ICdmRestAuthAppGroupEntry>,
        callback?: ProgressCallback): Promise<boolean> {
        const actions: ConnectionDMActionList = [];

        try {
            const backend = authAppGroup.connection.backend;
            authAppGroup.state.initialized = true;
            authAppGroup.authApps.length = 0;

            callback?.("Loading MRS auth apps ...");
            const authApps = await backend.mrs.listAuthApps();
            for (const authApp of authApps) {
                const name = authApp.name ?? "unknown";
                const vendor = authApp.authVendor ?? "unknown";

                const authAppEntry: Mutable<ICdmRestAuthAppEntry> = {
                    parent: authAppGroup as ICdmRestAuthAppGroupEntry,
                    type: CdmEntityType.MrsAuthApp,
                    id: uuid(),
                    state: createDataModelEntryState(),
                    details: authApp,
                    caption: name,
                    description: vendor,
                    users: [],
                    services: [],
                    connection: authAppGroup.connection as ICdmConnectionEntry,
                };

                authAppEntry.refresh = () => {
                    return this.updateMrsAuthApp(authAppEntry as ICdmRestAuthAppEntry);
                };
                authAppEntry.getChildren = () => {
                    return [
                        ...authAppEntry.users,
                        //...authAppEntry.services // This list is a candidate to be moved to an own group.
                    ];
                };

                authAppGroup.authApps.push(authAppEntry as ICdmRestAuthAppEntry);
                actions.push({ action: "add", entry: authAppEntry });
            }

            this.notifySubscribers(actions);
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS content: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateMrsService(serviceEntry: DeepMutable<ICdmRestServiceEntry>): Promise<boolean> {
        const actions: ConnectionDMActionList = [];

        try {
            serviceEntry.state.initialized = true;

            const backend = serviceEntry.parent.parent.backend;
            serviceEntry.details = await backend.mrs.getService(serviceEntry.details.id,
                serviceEntry.details.urlContextRoot, serviceEntry.details.urlHostName, null, null);
            serviceEntry.caption = serviceEntry.details.urlContextRoot;

            this.updateServiceFields(serviceEntry as ICdmRestServiceEntry);

            const showPrivateItems = serviceEntry.parent.showPrivateItems;

            // Get all MRS schemas.
            serviceEntry.schemas.length = 0;
            const schemas = await backend.mrs.listSchemas(serviceEntry.details.id);
            for (const schema of schemas) {
                const schemaEntry: Mutable<ICdmRestSchemaEntry> = {
                    parent: serviceEntry as ICdmRestServiceEntry,
                    type: CdmEntityType.MrsSchema,
                    id: uuid(),
                    state: createDataModelEntryState(),
                    details: schema,
                    caption: `${schema.requestPath} (${schema.name})`,
                    dbObjects: [],
                    connection: serviceEntry.parent.parent as ICdmConnectionEntry,
                    getChildren: () => { return []; },
                };

                schemaEntry.refresh = () => {
                    return this.updateMrsSchema(schemaEntry);
                };

                schemaEntry.getChildren = () => {
                    return schemaEntry.dbObjects.filter((s) => {
                        return showPrivateItems || (s.details.enabled !== EnabledState.PrivateOnly);
                    });
                };

                serviceEntry.schemas.push(schemaEntry as ICdmRestSchemaEntry);
            }

            // Get all MRS content sets.
            serviceEntry.contentSets.length = 0;
            const contentSets = await backend.mrs.listContentSets(serviceEntry.details.id);
            for (const contentSet of contentSets) {
                const contentSetEntry: Mutable<ICdmRestContentSetEntry> = {
                    parent: serviceEntry as ICdmRestServiceEntry,
                    type: CdmEntityType.MrsContentSet,
                    id: uuid(),
                    state: createDataModelEntryState(),
                    details: contentSet,
                    caption: contentSet.requestPath,
                    files: [],
                    connection: serviceEntry.parent.parent as ICdmConnectionEntry,
                    getChildren: () => { return []; },
                };

                contentSetEntry.refresh = () => {
                    return this.updateMrsContentSet(contentSetEntry as ICdmRestContentSetEntry);
                };

                contentSetEntry.getChildren = () => {
                    return contentSetEntry.files.filter((s) => {
                        return showPrivateItems || s.details.enabled !== EnabledState.PrivateOnly;
                    });
                };

                serviceEntry.contentSets.push(contentSetEntry as ICdmRestContentSetEntry);
            }

            // Authentication apps.
            serviceEntry.authApps.length = 0;
            const authApps = await backend.mrs.listAuthApps(serviceEntry.details.id);
            for (const authApp of authApps) {
                const name = authApp.name ?? "unknown";
                const vendor = authApp.authVendor ?? "unknown";

                const authAppEntry: Mutable<ICdmRestServiceAuthAppEntry> = {
                    parent: serviceEntry as ICdmRestServiceEntry,
                    type: CdmEntityType.MrsServiceAuthApp,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    details: authApp,
                    caption: name,
                    description: vendor,
                    connection: serviceEntry.connection as ICdmConnectionEntry,
                };

                serviceEntry.authApps.push(authAppEntry as ICdmRestServiceAuthAppEntry);
                actions.push({ action: "add", entry: authAppEntry });
            }

            this.notifySubscribers(actions);
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS service details: ${message}`, {});

            return false;
        }

        return true;
    }

    private updateServiceFields(serviceEntry: ICdmRestServiceEntry) {
        const developers = serviceEntry.details.inDevelopment?.developers?.join(",");
        let description: string;
        if (serviceEntry.details.enabled && serviceEntry.details.inDevelopment?.developers) {
            description = `In Development [${developers}]`;
        } else {
            description = !serviceEntry.details.enabled
                ? "Disabled"
                : (serviceEntry.details.published ? "Published" : "Unpublished");
        }
        serviceEntry.description = description;
    }

    private async updateMrsAuthApp(authAppEntry: ICdmRestAuthAppEntry): Promise<boolean> {
        try {
            const backend = authAppEntry.connection.backend;

            const name = authAppEntry.details.name ?? "unknown";
            const vendor = authAppEntry.details.authVendor ?? "unknown";

            (authAppEntry as Mutable<ICdmRestAuthAppEntry>).caption = name;
            (authAppEntry as Mutable<ICdmRestAuthAppEntry>).description = vendor;

            authAppEntry.services.length = 0;
            const services = await backend.mrs.listAppServices(authAppEntry.details.id);
            for (const service of services) {
                const serviceEntry: Mutable<ICdmRestAuthAppServiceEntry> = {
                    parent: authAppEntry,
                    type: CdmEntityType.MrsAuthAppService,
                    id: uuid(),
                    details: service,
                    state: createDataModelEntryState(true, true),
                    caption: service.hostCtx,
                    connection: authAppEntry.connection,
                };

                authAppEntry.services.push(serviceEntry as ICdmRestAuthAppServiceEntry);
            }

            authAppEntry.users.length = 0;
            const users = await backend.mrs.listUsers(authAppEntry.details.serviceId, authAppEntry.details.id);
            for (const user of users) {
                const userEntry: Mutable<ICdmRestUserEntry> = {
                    parent: authAppEntry,
                    type: CdmEntityType.MrsUser,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    details: user,
                    caption: user.name ?? "<unknown>",
                    connection: authAppEntry.connection,
                };

                userEntry.refresh = () => {
                    return this.updateMrsUser(userEntry as ICdmRestUserEntry);
                };

                authAppEntry.users.push(userEntry as ICdmRestUserEntry);
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS auth app details: ${message}`, {});

            return false;
        }

        return true;
    }

    private updateMrsUser(userEntry: ICdmRestUserEntry): Promise<boolean> {
        if (userEntry.details.name !== undefined) {
            (userEntry as Mutable<ICdmRestUserEntry>).caption = userEntry.details.name;
        }

        return Promise.resolve(true);
    }

    private async updateMrsContentSet(contentSetEntry: ICdmRestContentSetEntry): Promise<boolean> {
        try {
            const backend = contentSetEntry.connection.backend;

            contentSetEntry.files.length = 0;
            const contentFiles = await backend.mrs.listContentFiles(contentSetEntry.details.id);
            for (const file of contentFiles) {
                const fileEntry: ICdmRestContentFileEntry = {
                    parent: contentSetEntry,
                    type: CdmEntityType.MrsContentFile,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    details: file,
                    caption: `${file.requestPath}`,
                    description: formatBytes(file.size),
                    connection: contentSetEntry.connection,
                };

                contentSetEntry.files.push(fileEntry);
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS content files: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateMrsSchema(mrsSchemaEntry: DeepMutable<ICdmRestSchemaEntry>): Promise<boolean> {
        try {
            const backend = mrsSchemaEntry.connection.backend;

            const schema = await backend.mrs.getSchema(mrsSchemaEntry.details.id, mrsSchemaEntry.details.serviceId);

            // MRS schemas can be moved between services. If that's the case here initialize the MRS root instead.
            // Check the host context without the host name filter applied to it.
            const hostCtx = schema.hostCtx.substring(schema.hostCtx.indexOf("/"));
            if (hostCtx !== mrsSchemaEntry.parent.caption) {
                return this.updateMrsRoot(mrsSchemaEntry.parent.parent as Mutable<ICdmRestRootEntry>);
            }


            mrsSchemaEntry.dbObjects.length = 0;

            mrsSchemaEntry.details = schema;
            mrsSchemaEntry.caption = `${schema.requestPath} (${schema.name})`;

            const objects = await backend.mrs.listDbObjects(mrsSchemaEntry.details.id);
            for (const object of objects) {
                const objectEntry: DeepMutable<ICdmRestDbObjectEntry> = {
                    parent: mrsSchemaEntry,
                    type: CdmEntityType.MrsDbObject,
                    id: uuid(),
                    state: createDataModelEntryState(true, true),
                    details: object,
                    caption: object.requestPath,
                    description: object.name,
                    connection: mrsSchemaEntry.connection,
                };

                mrsSchemaEntry.dbObjects.push(objectEntry);
            }
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS DB objects: ${message}`, {});

            return false;
        }

        return true;
    }

    private async updateMrsRouter(router: ICdmRestRouterEntry): Promise<boolean> {
        try {
            const backend = router.connection.backend;
            const routerServices = await backend.mrs.getRouterServices(router.details.id);

            router.services.length = 0;
            routerServices.forEach((service) => {
                const urlHostName = !service.serviceUrlHostName ? "" : service.serviceUrlHostName;
                const caption = urlHostName + service.serviceUrlContextRoot;

                let description: string;
                if (service.inDevelopment?.developers) {
                    description = `In Development`;
                } else {
                    description = service.published ? "Published" : "Unpublished";
                }

                router.services.push({
                    type: CdmEntityType.MrsRouterService,
                    id: uuid(),
                    parent: router,
                    connection: router.connection,
                    caption,
                    description,
                    details: service,
                    state: createDataModelEntryState(true, true),
                });
            });
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorMessage(`An error occurred while retrieving MRS router services. ${message}`, {});

            return false;
        }

        return true;
    }

    private notifySubscribers = (list: Readonly<Array<ISubscriberActionType<ConnectionDataModelEntry>>>): void => {
        for (const subscriber of this.subscribers) {
            subscriber(list);
        }
    };

    private createMrsServiceEntry(mrsRoot: ICdmRestRootEntry, service: IMrsServiceData,
        label: string): Mutable<ICdmRestServiceEntry> {

        const developers = service.inDevelopment?.developers?.join(",");
        let description: string;
        if (service.enabled && service.inDevelopment?.developers) {
            description = `In Development [${developers}]`;
        } else {
            description = !service.enabled ? "Disabled" : (service.published ? "Published" : "Unpublished");
        }

        const serviceEntry: Mutable<ICdmRestServiceEntry> = {
            parent: mrsRoot,
            type: CdmEntityType.MrsService,
            id: service.id,
            state: createDataModelEntryState(),
            details: service,
            caption: label,
            description,
            schemas: [],
            contentSets: [],
            authApps: [],
            connection: mrsRoot.parent,
            getChildren: () => { return []; },
        };

        serviceEntry.refresh = () => {
            return this.updateMrsService(serviceEntry);
        };

        serviceEntry.getChildren = () => {
            const showPrivateItems = mrsRoot.showPrivateItems;

            return [
                ...serviceEntry.schemas.filter((s) => {
                    return showPrivateItems || s.details.enabled !== EnabledState.PrivateOnly;
                }),
                ...serviceEntry.contentSets.filter((s) => {
                    return showPrivateItems || s.details.enabled !== EnabledState.PrivateOnly;
                }),
                ...serviceEntry.authApps,
            ];
        };

        return serviceEntry;
    }

    private createMrsRouterEntry(routerRoot: ICdmRestRouterGroupEntry, router: IMrsRouterData,
        description: string): Mutable<ICdmRestRouterEntry> {
        const requiresUpgrade = routerRoot.parent.requiredRouterVersion !== undefined
            ? compareVersionStrings(routerRoot.parent.requiredRouterVersion, router.version) > 0
            : false;

        const routerEntry: Mutable<ICdmRestRouterEntry> = {
            parent: routerRoot,
            type: CdmEntityType.MrsRouter,
            id: uuid(),
            state: createDataModelEntryState(),
            details: router,
            caption: router.address,
            description,
            requiresUpgrade,
            connection: routerRoot.parent.parent,
            services: [],
            getChildren: () => { return []; },
        };

        routerEntry.refresh = () => {
            return this.updateMrsRouter(routerEntry as ICdmRestRouterEntry);
        };
        routerEntry.getChildren = () => { return routerEntry.services; };

        return routerEntry;
    }

    private async updateConnectionGroup(group: ICdmConnectionGroupEntry): Promise<boolean> {
        const mutableGroup = group as DeepMutable<ICdmConnectionGroupEntry>;
        mutableGroup.state.initialized = true;

        const actions: ConnectionDMActionList = [];
        try {
            // TODO: update the group caption and folder path, once we have a `getFolder` method in the backend.
            const newList = await ShellInterface.dbConnections.listAll(webSession.currentProfileId,
                group.folderPath.id === -1 ? undefined : group.folderPath.id);

            const predicate = (left: ICdmConnectionEntry | ICdmConnectionGroupEntry,
                right: IConnectionDetails | IFolderPath) => {
                if ((left.type === CdmEntityType.Connection) !== (right.type === "connection")) {
                    // Not the same type (group vs. connection).
                    return false;
                }

                if (left.type === CdmEntityType.Connection) {
                    return left.details.id === right.id;
                }

                return left.folderPath.id === right.id;
            };

            // Remove entries no longer in the list.
            const [_, entriesToRemove] = partition(group.entries, (e) => {
                return newList.find((newEntry) => {
                    return predicate(e, newEntry);
                }) !== undefined;
            });

            for (const connection of entriesToRemove) {
                actions.push({ action: "remove", entry: connection });
            }

            // Create a new list from the remaining entries in their order.
            const newGroupEntries: Array<ICdmConnectionEntry | ICdmConnectionGroupEntry> = [];
            for (const newEntry of newList) {
                const existing = group.entries.find((e) => {
                    return predicate(e, newEntry);
                }) as Mutable<ICdmConnectionEntry | ICdmConnectionGroupEntry> | undefined;

                if (existing) {
                    if (existing.type === CdmEntityType.Connection) {
                        // Copy the new values to the existing entry and keep those that are not in the new entry
                        // (e.g. the folder path).
                        existing.details = Object.assign(existing.details, newEntry as IConnectionDetails);
                        existing.caption = newEntry.caption;
                    } else {
                        const connectionEntry = existing as Mutable<ICdmConnectionGroupEntry>;
                        connectionEntry.folderPath = newEntry as IFolderPath;
                        connectionEntry.caption = newEntry.caption;
                    }

                    newGroupEntries.push(existing);
                    actions.push({ action: "update", entry: existing });

                    continue;
                }

                if (newEntry.type === "connection") { // A connection (details actually).
                    const connectionEntry = new ConnectionEntryImpl(newEntry.caption, newEntry, this, true);
                    connectionEntry.parent = group;
                    newGroupEntries.push(connectionEntry);
                    actions.push({ action: "add", entry: connectionEntry });
                } else {
                    const newGroup = {
                        type: CdmEntityType.ConnectionGroup,
                        id: uuid(),
                        parent: mutableGroup,
                        caption: newEntry.caption,
                        entries: [],
                        state: createDataModelEntryState(false, false),
                        folderPath: newEntry,
                        getChildren: () => { return newGroup.entries; },
                        refresh: () => { return this.updateConnectionGroup(newGroup); },
                        flattenedEntries: async (): Promise<IFlatGroupList> => {
                            return this.flattenGroupList(newGroup);
                        },
                    } as ICdmConnectionGroupEntry;

                    newGroupEntries.push(newGroup);

                    actions.push({ action: "add", entry: newGroup });
                }
            }

            mutableGroup.entries = newGroupEntries;

            this.notifySubscribers(actions);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Cannot load connections for group ${group.caption}: ${message}`, {});

            return false;
        }

        return true;
    }

}
