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

import { ui } from "../app-logic/UILayer.js";
import type { DeepMutable, Mutable } from "../app-logic/general-types.js";
import type {
    IMrsAuthAppData, IMrsContentFileData, IMrsContentSetData, IMrsDbObjectData, IMrsRouterData, IMrsRouterService,
    IMrsSchemaData, IMrsServiceData, IMrsUserData,
} from "../communication/ProtocolMrs.js";
import { requisitions } from "../supplement/Requisitions.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType, type IConnectionDetails } from "../supplement/ShellInterface/index.js";
import { webSession } from "../supplement/WebSession.js";
import { convertErrorToString, uuid } from "../utilities/helpers.js";
import { compareVersionStrings, formatBytes } from "../utilities/string-helpers.js";
import { ConnectionEntryImpl } from "./ConnectionEntryImpl.js";
import { createDataModelEntryState } from "./data-model-helpers.js";
import {
    type AdminPageType, type Command, type DataModelSubscriber, type ICdmInitializer, type IDataModelEntryState,
    type ISubscriberActionType, type ProgressCallback, type SubscriberAction,
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

    /** A router in a MySQL REST Service. */
    MrsSchema,

    /** A content set in MRS. */
    MrsContentSet,

    /** A user in MRS. */
    MrsUser,

    /** An auth app in MRS. */
    MrsAuthApp,

    /** A file in an MRS content set. */
    MrsContentFile,

    /** A database object in an MRS schema. */
    MrsDbObject,

    /** Currently not used. */
    MrsDbObjectFunction,

    /** Currently not used. */
    MrsDbObjectProcedure,

    /** A router in MRS. */
    MrsRouter,

    /** A service in a router. */
    MrsRouterService,
}

/** All DM types that represent a database object (can be handled with standard MySQL DDL). */
export const cdmDbEntityTypes = new Set<CdmEntityType>([
    CdmEntityType.Schema,
    CdmEntityType.Table,
    CdmEntityType.View,
    CdmEntityType.StoredProcedure,
    CdmEntityType.StoredFunction,
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
    [CdmEntityType.Event, "event"],
    [CdmEntityType.Column, "column"],
    [CdmEntityType.Index, "index"],
    [CdmEntityType.ForeignKey, ""],
    [CdmEntityType.Trigger, "trigger"],
]);

/** All type corresponding to a concrete database object type. */
export type CdmDbEntryType = ICdmSchemaEntry | ICdmTableEntry | ICdmViewEntry | ICdmRoutineEntry | ICdmEventEntry
    | ICdmColumnEntry | ICdmIndexEntry | ICdmForeignKeyEntry | ICdmTriggerEntry;

/** The base interface for all entries. */
export interface ICdmBaseEntry {
    /**
     * A unique identifier to find items independent of other properties (e.g. if they represent the same connection)
     * and to link items in the UI (e.g. between data models). This ID is transient and not stored in the backend.
     */
    id: string;

    /** The caption of the entry. */
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
    | CdmEntityType.Event | CdmEntityType.Table | CdmEntityType.View;

/**
 * A mapping from schema group types to their members. This is used to determine the type of the members in a
 * schema group entry.
 */
interface ICdmEntityTypeToSchemaMember {
    [CdmEntityType.StoredProcedure]: ICdmRoutineEntry,
    [CdmEntityType.StoredFunction]: ICdmRoutineEntry,
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
    readonly parent: ICdmRestServiceEntry;

    readonly type: CdmEntityType.MrsAuthApp;
    readonly details: IMrsAuthAppData;

    readonly users: ICdmRestUserEntry[];
}

/** An entry for a MySQL REST Service. */
export interface ICdmRestServiceEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRootEntry;

    readonly type: CdmEntityType.MrsService;
    readonly details: IMrsServiceData;

    readonly schemas: ICdmRestSchemaEntry[];
    readonly contentSets: ICdmRestContentSetEntry[];
    readonly authApps: ICdmRestAuthAppEntry[];
}

/** An entry for an MRS Router. */
export interface ICdmRestRouterEntry extends ICdmBaseEntry {
    readonly parent: ICdmRestRootEntry;

    readonly type: CdmEntityType.MrsRouter;
    readonly details: IMrsRouterData;

    requiresUpgrade: boolean;
    readonly services: ICdmRestRouterServiceEntry[];
}

/** An entry for a service located in a MRS Router. */
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

    readonly services: ICdmRestServiceEntry[];
    readonly routers: ICdmRestRouterEntry[];
}

export type CdmRestTypes = ICdmRestRootEntry | ICdmRestServiceEntry | ICdmRestRouterEntry | ICdmRestSchemaEntry
    | ICdmRestContentSetEntry | ICdmRestAuthAppEntry | ICdmRestUserEntry | ICdmRestContentFileEntry
    | ICdmRestDbObjectEntry | ICdmRestRouterServiceEntry;

/** The top level entry for a connection. The entire data model is made of a list of these. */
export interface ICdmConnectionEntry extends ICdmBaseEntry {
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

    /** Close this connection and free resources. Call {@link initialize} to open it again. */
    close(): Promise<void>;

    /** Creates a copy of this connection and opens it. */
    duplicate(): Promise<ICdmConnectionEntry>;
}

/** A union type of all possible interfaces. */
export type ConnectionDataModelEntry =
    | ICdmConnectionEntry
    | ICdmSchemaEntry
    | ICdmSchemaGroupEntry<CdmSchemaGroupMemberType>
    | ICdmTableEntry
    | ICdmViewEntry
    | ICdmEventEntry
    | ICdmRoutineEntry
    | ICdmAdminEntry
    | ICdmAdminPageEntry
    | ICdmTableGroupEntry<CdmTableGroupMemberType>
    | ICdmColumnEntry
    | ICdmIndexEntry
    | ICdmForeignKeyEntry
    | ICdmTriggerEntry
    | ICdmRestRootEntry
    | ICdmRestServiceEntry
    | ICdmRestRouterEntry
    | ICdmRestRouterServiceEntry
    | ICdmRestSchemaEntry
    | ICdmRestContentSetEntry
    | ICdmRestAuthAppEntry
    | ICdmRestUserEntry
    | ICdmRestContentFileEntry
    | ICdmRestDbObjectEntry;

export class ConnectionDataModel implements ICdmInitializer {
    #connections: ICdmConnectionEntry[] = [];

    #initialized: boolean = false;
    #subscribers = new Set<DataModelSubscriber<ConnectionDataModelEntry>>();

    /** Used for auto refreshing router statuses. */
    #refreshMrsRoutersTimer?: ReturnType<typeof setInterval>;

    #routerRefreshTime: number;

    /**
     * Creates a new instance of the connection data model.
     *
     * @param refreshTime The time in milliseconds to wait between refreshing the MRS routers, when auto refresh
     *                    is enabled.
     */
    public constructor(refreshTime = 10000) {
        this.#routerRefreshTime = refreshTime;
    }
    /**
     * @returns the list of connections a user has stored in the backend.
     */
    public get connections(): ICdmConnectionEntry[] {
        return this.#connections;
    }

    public get autoRouterRefresh(): boolean {
        return !!this.#refreshMrsRoutersTimer;
    }

    public set autoRouterRefresh(value: boolean) {
        if (value) {
            this.#refreshMrsRoutersTimer = setInterval(() => {
                this.#connections.forEach((c) => {
                    if (c.mrsEntry?.state.expanded) {
                        void c.mrsEntry.refresh!();
                    }
                });
            }, this.#routerRefreshTime);
        } else {
            clearInterval(this.#refreshMrsRoutersTimer);
            this.#refreshMrsRoutersTimer = undefined;
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

    /**
     * Adds the given subscriber to the internal subscriber list for change notifications.
     *
     * @param subscriber The subscriber to add.
     */
    public subscribe(subscriber: DataModelSubscriber<ConnectionDataModelEntry>): void {
        this.#subscribers.add(subscriber);
    }

    /**
     * Removes the given subscriber from the internal subscriber list.
     *
     * @param subscriber The subscriber to remove.
     */
    public unsubscribe(subscriber: DataModelSubscriber<ConnectionDataModelEntry>): void {
        this.#subscribers.delete(subscriber);
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
        for (const connection of this.#connections) {
            const entry = connection as Mutable<ICdmConnectionEntry>;
            await entry.close();
        }
    }

    /**
     * Tries to drop the given item, if it is a database object or a connection. The caller must ensure the user
     * confirms the action. The entry remains in the data model and must be removed explicitly
     * using {@link removeEntry}. Especially for connections call {@link removeEntry} before dropping the entry, to
     * ensure the connection is closed.
     *
     * @param entry The entry to drop. If that is not a database object, an error is thrown.
     *
     * @returns A promise that resolves once the item is dropped.
     */
    public async dropItem(entry: ConnectionDataModelEntry): Promise<void> {
        switch (entry.type) {
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
    public isValidConnectionId(connectionId: number): boolean {
        return this.#connections.some((e) => { return e.details.id === connectionId; });
    }

    /**
     * Creates the qualified name for a database object entry (schema, schema.table, schema.table.column etc.).
     *
     * @param entry The entry to create the qualified name for.
     *
     * @returns The qualified name for the entry.
     * @throws An error if the entry is not a database object.
     */
    public getQualifiedName(entry: ConnectionDataModelEntry): string {
        // Find the schema name from the entry, if it is a database object.
        let schema = "";
        let tableOrView = "";
        let objectName = "";
        switch (entry.type) {
            case CdmEntityType.Table:
            case CdmEntityType.View:
            case CdmEntityType.StoredProcedure:
            case CdmEntityType.StoredFunction:
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
     * Otherwise no further action is taken.
     *
     * @param entry The entry to remove. Note: group entries are never removed.
     */
    public async removeEntry(entry: ConnectionDataModelEntry): Promise<void> {
        const actions: Array<{ action: SubscriberAction, entry?: ConnectionDataModelEntry; }> = [];

        switch (entry.type) {
            case CdmEntityType.Connection: {
                const index = this.#connections.indexOf(entry);
                if (index >= 0) {
                    await entry.close();
                    const removed = this.#connections.splice(index, 1);
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
        return new ConnectionEntryImpl(details.caption, details, this);
    }

    /**
     * Adds the given entry (usually created by {@link createConnectionEntry}) to the model.
     *
     * @param entry The entry to add.
     */
    public addConnectionEntry(entry: ICdmConnectionEntry): void {
        this.#connections.push(entry);
        this.notifySubscribers([{ action: "add", entry }]);
    }

    /**
     * @returns The connection entry with the given id, or `undefined` if no such entry exists.
     *
     * @param id The id of the connection to find.
     */
    public findConnectionEntryById(id: number): ICdmConnectionEntry | undefined {
        return this.#connections.find((e) => { return e.details.id === id; });
    }

    public updateConnectionDetails(data: IConnectionDetails | ICdmConnectionEntry): ICdmConnectionEntry | undefined {
        let details: IConnectionDetails;

        let id;
        if ("type" in data && data.type === CdmEntityType.Connection) {
            id = data.details.id;
            details = data.details;
        } else {
            details = data as IConnectionDetails;
            id = details.id;
        }

        const entry = this.findConnectionEntryById(id) as Mutable<ICdmConnectionEntry>;
        if (entry) {
            entry.details = details;
            entry.caption = details.caption;
            this.notifySubscribers([{ action: "update", entry }]);
        }

        return entry;
    }

    /**
     * This method is called by entries that are implemented in own files to initialize their content.
     * This avoids dragging all initialization code into their file.
     *
     * @param entry The entry to initialize.
     * @param callback An optional callback to report progress.
     *
     * @returns A promise that resolves once the entry is initialized.
     */
    public async initializeEntry(entry: ConnectionDataModelEntry, callback?: ProgressCallback): Promise<boolean> {

        switch (entry.type) {
            case CdmEntityType.Connection: {
                this.initializeConnection(entry as ConnectionEntryImpl);

                return true;
            }

            case CdmEntityType.MrsRoot: {
                return this.updateMrsRoot(entry as Mutable<ICdmRestRootEntry>, callback);
            }

            default: {
                return Promise.resolve(true);
            }
        }
    }

    /**
     * Queries the backend for a list of stored user DB connections and updates the connection list.
     * It does a diff between the current list and the new list and closes all connections that are no longer in the
     * new list, while keeping existing connections open.
     */
    private async updateConnections(): Promise<void> {
        const actions: Array<{ action: SubscriberAction, entry?: ConnectionDataModelEntry; }> = [];

        if (webSession.currentProfileId === -1) {
            await this.closeAllConnections();

            this.#initialized = false;
            this.#connections = [];
            actions.push({ action: "clear" });
        } else {
            try {
                const detailList = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId);

                // Close and remove all open connections that are no longer in the new list.
                // Sort in new connection entries on the way. Keep in mind they are ordered by what the user has set!
                let left = 0;  // The current index into the existing entries.
                let right = 0; // The current index into the new entries while looking for a match.
                while (left < this.#connections.length && detailList.length > 0) {
                    if (this.#connections[left].details.caption === detailList[right].caption) {
                        // Entries match.
                        if (right > 0) {
                            // We had to jump over other entries to arrive here. Add those
                            // as new entries in our current list.
                            for (let i = 0; i < right; ++i) {
                                const details = detailList[i];
                                const connection = new ConnectionEntryImpl(details.caption, details, this);
                                this.#connections.splice(left, 0, connection);
                            }

                            detailList.splice(0, right);
                            right = 0;
                        }

                        // Advance to the next entry.
                        ++left;
                        detailList.shift();
                    } else {
                        // Entries don't match. Check if we can find the current entry in the new
                        // list at a higher position (which would mean we have new entries before
                        // the current one).
                        while (++right < detailList.length) {
                            if (this.#connections[left].details.caption === detailList[right].caption) {
                                break;
                            }
                        }

                        if (right === detailList.length) {
                            // Current entry no longer exists. Close the session (if one is open)
                            // and remove it from the current list.
                            const entry = this.#connections.splice(left, 1)[0];
                            await entry.close();

                            // Reset the right index to the top of the list and keep the current
                            // index where it is (points already to the next entry after removal).
                            right = 0;
                        }
                    }
                }

                // Take over all remaining entries from the new list.
                while (detailList.length > 0) {
                    ++left;

                    const details = detailList.shift()!;
                    const connection = new ConnectionEntryImpl(details.caption, details, this);
                    this.#connections.push(connection);
                    actions.push({ action: "add", entry: connection });
                }

                // Remove all remaining entries we haven't touched yet.
                while (left < this.#connections.length) {
                    const entry = this.#connections.splice(left, 1)[0];
                    await entry.close();
                    actions.push({ action: "remove", entry });
                }
            } catch (reason) {
                void ui.showErrorNotification(`Cannot load DB connections: ${String(reason)}`);

                throw reason;
            }
        }

        this.notifySubscribers(actions);
        requisitions.executeRemote("connectionsUpdated", undefined);
    }

    /**
     * Fills the schema list of the given connection entry, and adds the fixed group entries to each schema entry.
     * This is used for initialization of the data model, so we do not send out notifications. Same for all other
     * initialization methods below.
     *
     * @param connection The connection entry to update.
     */
    private initializeConnection(connection: ConnectionEntryImpl): void {
        connection.schemaEntries.length = 0;
        for (const schema of connection.schemaNames) {
            const schemaEntry: Partial<Mutable<ICdmSchemaEntry>> = {
                parent: connection,
                type: CdmEntityType.Schema,
                id: uuid(),
                state: createDataModelEntryState(),
                caption: schema,
                connection,
                refresh: () => { return this.initializeSchema(connection, schema); },
                getChildren: () => { return []; },
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
                return this.initializeTablesSchemaGroup(tablesSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Table>);
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

            viewsSchemaGroup.refresh = () => { return this.initializeViewsSchemaGroup(viewsSchemaGroup); };
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
                return this.initializeEventsSchemaGroup(eventsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.Event>);
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
                return this.initializeProceduresSchemaGroup(
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
                return this.initializeFunctionsSchemaGroup(
                    functionsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>,
                );
            };
            functionsSchemaGroup.getChildren = () => { return functionsSchemaGroup.members; };

            schemaEntry.functions = functionsSchemaGroup as ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>;

            schemaEntry.getChildren = () => {
                return [
                    schemaEntry.tables!,
                    schemaEntry.views!,
                    schemaEntry.procedures!,
                    schemaEntry.functions!,
                    schemaEntry.events!,
                ];
            };
            connection.schemaEntries.push(schemaEntry as ICdmSchemaEntry);
        }
    }

    private async initializeSchema(connection: ICdmConnectionEntry, schema: string): Promise<boolean> {
        const entry: DeepMutable<ICdmSchemaEntry> = connection.schemaEntries.find((e) => {
            return e.caption === schema;
        })!;

        if (entry.state.initialized) {
            return true;
        }

        entry.state.initialized = true;
        if (entry.connection.details.dbType === DBType.MySQL) {
            //
        }

        return Promise.resolve(true);
    }

    private async initializeTablesSchemaGroup(
        tableGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.Table>>): Promise<boolean> {
        tableGroup.state.initialized = true;
        tableGroup.members.length = 0;

        const schema = tableGroup.parent.caption;
        const tableNames = await tableGroup.connection.backend.getSchemaObjects(schema, "Table");
        for (const table of tableNames) {
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
                return this.initializeColumnsTableGroup(columnsTableGroup);
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
                return this.initializeIndexesTableGroup(indexesTableGroup as ICdmTableGroupEntry<CdmEntityType.Index>);
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
                return this.initializeForeignKeysTableGroup(
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
                state: createDataModelEntryState(),
                subType: CdmEntityType.Trigger,
                members: [],
                connection: tableEntry.connection as ICdmConnectionEntry,
            };

            triggersTableGroup.refresh = () => {
                return this.initializeTriggersTableGroup(
                    triggersTableGroup as ICdmTableGroupEntry<CdmEntityType.Trigger>);
            };
            triggersTableGroup.getChildren = () => {
                return [
                    ...triggersTableGroup.members,
                ];
            };

            tableEntry.triggers = triggersTableGroup;
            tableEntry.refresh = () => {
                return this.initializeTable(tableEntry as ICdmTableEntry);
            };

            tableEntry.getChildren = () => {
                return [
                    tableEntry.columns!,
                    tableEntry.indexes!,
                    tableEntry.foreignKeys!,
                    tableEntry.triggers!,
                ];
            };

            tableGroup.members.push(tableEntry as ICdmTableEntry);
        }

        return true;
    }

    private async initializeViewsSchemaGroup(
        viewGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.View>>): Promise<boolean> {
        viewGroup.state.initialized = true;

        const schema = viewGroup.parent.caption;
        const viewNames = await viewGroup.connection.backend.getSchemaObjects(schema, "View");
        for (const view of viewNames) {
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
                return this.initializeView(viewEntry);
            };

            viewGroup.members.push(viewEntry);
        }

        return true;
    }

    private async initializeEventsSchemaGroup(
        eventGroup: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.Event>>): Promise<boolean> {
        eventGroup.state.initialized = true;

        const schema = eventGroup.parent.caption;
        const eventNames = await eventGroup.connection.backend.getSchemaObjects(schema, "Event");
        for (const event of eventNames) {
            const eventEntry: Mutable<ICdmEventEntry> = {
                parent: eventGroup as ICdmSchemaGroupEntry<CdmEntityType.Event>,
                type: CdmEntityType.Event,
                id: uuid(),
                state: createDataModelEntryState(true),
                caption: event,
                schema,
                connection: eventGroup.parent.parent as ICdmConnectionEntry,
            };

            eventEntry.refresh = () => {
                return this.initializeEvent(eventEntry as ICdmEventEntry);
            };

            eventGroup.members.push(eventEntry as ICdmEventEntry);
        }

        return true;
    }

    private async initializeProceduresSchemaGroup(
        group: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.StoredProcedure>>): Promise<boolean> {
        group.state.initialized = true;

        const schema = group.parent.caption;
        const procedureNames = await group.connection.backend.getSchemaObjects(schema, "Routine", "procedure");
        for (const procedure of procedureNames) {
            const procedureEntry: DeepMutable<ICdmRoutineEntry> = {
                parent: group,
                type: CdmEntityType.StoredProcedure,
                id: uuid(),
                state: createDataModelEntryState(true),
                caption: procedure,
                schema,
                connection: group.connection,
            };

            procedureEntry.refresh = () => {
                return this.initializeProcedure(procedureEntry);
            };

            group.members.push(procedureEntry);
        }

        return true;
    }

    private async initializeFunctionsSchemaGroup(
        group: DeepMutable<ICdmSchemaGroupEntry<CdmEntityType.StoredFunction>>): Promise<boolean> {
        group.state.initialized = true;

        const schema = group.parent.caption;
        const functionNames = await group.connection.backend.getSchemaObjects(schema, "Routine", "function");
        for (const func of functionNames) {
            const functionEntry: DeepMutable<ICdmRoutineEntry> = {
                parent: group,
                type: CdmEntityType.StoredFunction,
                id: uuid(),
                state: createDataModelEntryState(true),
                caption: func,
                schema,
                connection: group.parent.parent,
            };

            functionEntry.refresh = () => {
                return this.initializeFunction(functionEntry as ICdmRoutineEntry);
            };

            group.members.push(functionEntry as ICdmRoutineEntry);
        }

        return true;
    }

    private async initializeTable(tableEntry: DeepMutable<ICdmTableEntry>): Promise<boolean> {
        tableEntry.state.initialized = true;

        // Nothing to do here. All children are group nodes.
        return Promise.resolve(true);
    }

    private async initializeView(viewEntry: DeepMutable<ICdmViewEntry>): Promise<boolean> {
        viewEntry.state.initialized = true;

        // Unlike tables, there are no column group nodes. Instead, columns are attached directly to a view node.
        const columnNames = await viewEntry.connection.backend.getTableObjectNames(viewEntry.schema, viewEntry.caption,
            "Column");
        for (const column of columnNames) {
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

            viewEntry.columns.push(columnEntry);
        }

        return Promise.resolve(true);
    }

    private async initializeEvent(eventEntry: DeepMutable<ICdmEventEntry>): Promise<boolean> {
        eventEntry.state.initialized = true;

        return Promise.resolve(true);
    }

    private async initializeProcedure(procedureEntry: DeepMutable<ICdmRoutineEntry>): Promise<boolean> {
        procedureEntry.state.initialized = true;

        return Promise.resolve(true);
    }

    private async initializeFunction(functionEntry: DeepMutable<ICdmRoutineEntry>): Promise<boolean> {
        functionEntry.state.initialized = true;

        return Promise.resolve(true);
    }

    private async initializeColumnsTableGroup(
        columnGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Column>>): Promise<boolean> {
        columnGroup.state.initialized = true;

        const schema = columnGroup.parent.schema;
        const table = columnGroup.parent.caption;
        const columnNames = await columnGroup.connection.backend.getTableObjectNames(schema, table, "Column");
        for (const column of columnNames) {
            const info = await columnGroup.connection.backend.getTableObject(schema, table, "Column", column);
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

            columnGroup.members.push(columnEntry);
        }

        return true;
    }

    private async initializeIndexesTableGroup(
        indexGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Index>>): Promise<boolean> {
        indexGroup.state.initialized = true;

        const schema = indexGroup.parent.schema;
        const table = indexGroup.parent.caption;
        const indexNames = await indexGroup.connection.backend.getTableObjectNames(schema, table, "Index");
        for (const index of indexNames) {
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

            indexGroup.members.push(indexEntry);
        }

        return true;
    }

    private async initializeForeignKeysTableGroup(
        foreignKeyGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.ForeignKey>>): Promise<boolean> {
        foreignKeyGroup.state.initialized = true;

        const schema = foreignKeyGroup.parent.schema;
        const table = foreignKeyGroup.parent.caption;
        const foreignKeyNames = await foreignKeyGroup.connection.backend.getTableObjectNames(schema, table,
            "Foreign Key");
        for (const foreignKey of foreignKeyNames) {
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

            foreignKeyGroup.members.push(foreignKeyEntry);
        }

        return true;
    }

    private async initializeTriggersTableGroup(
        triggerGroup: DeepMutable<ICdmTableGroupEntry<CdmEntityType.Trigger>>): Promise<boolean> {
        triggerGroup.state.initialized = true;

        const schema = triggerGroup.parent.schema;
        const table = triggerGroup.parent.caption;
        const triggerNames = await triggerGroup.connection.backend.getTableObjectNames(schema, table, "Foreign Key");
        for (const foreignKey of triggerNames) {
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

            triggerGroup.members.push(triggerEntry);
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

        const actions: Array<{ action: SubscriberAction, entry?: ConnectionDataModelEntry; }> = [];
        try {
            const backend = mrsRoot.parent.backend;

            callback?.("Loading MRS services and routers");
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

            const removedRouters = mrsRoot.routers.filter((s) => {
                return !routers.find((router) => {
                    return router.id === s.details.id;
                });
            }) as ICdmRestRouterEntry[];

            removedRouters.forEach((s) => {
                actions.push({ action: "remove", entry: s });
            });

            const newRouterList: ICdmRestRouterEntry[] = [];
            for (const router of routers) {
                const existing = mrsRoot.routers.find((s) => {
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

                const routerEntry = this.createMrsRouterEntry(mrsRoot as ICdmRestRootEntry, router, description);
                newRouterList.push(routerEntry as ICdmRestRouterEntry);
                actions.push({ action: "add", entry: routerEntry });
            }

            mrsRoot.routers = newRouterList;

            this.notifySubscribers(actions);
        } catch (error) {
            const message = convertErrorToString(error);
            void ui.showErrorNotification(`An error occurred while retrieving MRS content: ${message}`);

            return false;
        }

        return true;
    }

    private async updateMrsService(serviceEntry: DeepMutable<ICdmRestServiceEntry>): Promise<boolean> {
        try {
            serviceEntry.state.initialized = true;

            const backend = serviceEntry.parent.parent.backend;
            serviceEntry.details = await backend.mrs.getService(serviceEntry.details.id,
                serviceEntry.details.urlContextRoot, serviceEntry.details.urlHostName, null, null);
            serviceEntry.caption = serviceEntry.details.urlContextRoot;

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
                schemaEntry.getChildren = () => { return schemaEntry.dbObjects; };

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
                    return this.initializeMrsContentSet(contentSetEntry as ICdmRestContentSetEntry);
                };
                contentSetEntry.getChildren = () => { return contentSetEntry.files; };

                serviceEntry.contentSets.push(contentSetEntry as ICdmRestContentSetEntry);
            }

            // Get all MRS auth apps.
            serviceEntry.authApps.length = 0;
            const authApps = await backend.mrs.getAuthApps(serviceEntry.details.id);
            for (const authApp of authApps) {
                const name = authApp.name ?? "unknown";
                const vendor = authApp.authVendor ?? "unknown";

                const authAppEntry: Mutable<ICdmRestAuthAppEntry> = {
                    parent: serviceEntry as ICdmRestServiceEntry,
                    type: CdmEntityType.MrsAuthApp,
                    id: uuid(),
                    state: createDataModelEntryState(),
                    details: authApp,
                    caption: `${name} (${vendor})`,
                    users: [],
                    connection: serviceEntry.connection as ICdmConnectionEntry,
                };

                authAppEntry.refresh = () => {
                    return this.initializeMrsAuthApp(authAppEntry as ICdmRestAuthAppEntry);
                };
                authAppEntry.getChildren = () => { return authAppEntry.users; };

                serviceEntry.authApps.push(authAppEntry as ICdmRestAuthAppEntry);
            }
        } catch (error) {
            void ui.showErrorNotification(`An error occurred while retrieving MRS service details: ` +
                `${error instanceof Error ? error.message : String(error)}`);

            return false;
        }

        return true;
    }

    private async initializeMrsAuthApp(authAppEntry: ICdmRestAuthAppEntry): Promise<boolean> {
        try {
            const backend = authAppEntry.connection.backend;

            const name = authAppEntry.details.name ?? "unknown";
            const vendor = authAppEntry.details.authVendor ?? "unknown";

            (authAppEntry as Mutable<ICdmRestAuthAppEntry>).caption = `${name} (${vendor})`;
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
                    return this.initializeMrsUser(userEntry as ICdmRestUserEntry);
                };

                authAppEntry.users.push(userEntry as ICdmRestUserEntry);
            }
        } catch (error) {
            void ui.showErrorNotification(`An error occurred while retrieving MRS auth app details: ` +
                `${error instanceof Error ? error.message : String(error)}`);

            return false;
        }

        return true;
    }

    private initializeMrsUser(userEntry: ICdmRestUserEntry): Promise<boolean> {
        if (userEntry.details.name !== undefined) {
            (userEntry as Mutable<ICdmRestUserEntry>).caption = userEntry.details.name;
        }

        return Promise.resolve(true);
    }

    private async initializeMrsContentSet(contentSetEntry: ICdmRestContentSetEntry): Promise<boolean> {
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
            void ui.showErrorNotification(`An error occurred while retrieving MRS content files: ` +
                `${error instanceof Error ? error.message : String(error)}`);

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
            void ui.showErrorNotification(`An error occurred while retrieving MRS DB objects: ${message}`);

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
            void ui.showErrorNotification(`An error occurred while retrieving MRS router services. ${message}`);

            return false;
        }

        return true;
    }

    private notifySubscribers = (list: Readonly<Array<ISubscriberActionType<ConnectionDataModelEntry>>>): void => {
        for (const subscriber of this.#subscribers) {
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
            return [
                ...serviceEntry.schemas,
                ...serviceEntry.contentSets,
                ...serviceEntry.authApps,
            ];
        };

        return serviceEntry;
    }

    private createMrsRouterEntry(mrsRoot: ICdmRestRootEntry, router: IMrsRouterData,
        description: string): Mutable<ICdmRestRouterEntry> {
        const requiresUpgrade = mrsRoot.requiredRouterVersion !== undefined
            ? compareVersionStrings(mrsRoot.requiredRouterVersion, router.version) > 0
            : false;

        const routerEntry: Mutable<ICdmRestRouterEntry> = {
            parent: mrsRoot,
            type: CdmEntityType.MrsRouter,
            id: uuid(),
            state: createDataModelEntryState(),
            details: router,
            caption: router.address,
            description,
            requiresUpgrade,
            connection: mrsRoot.parent,
            services: [],
            getChildren: () => { return []; },
        };

        routerEntry.refresh = () => {
            return this.updateMrsRouter(routerEntry as ICdmRestRouterEntry);
        };
        routerEntry.getChildren = () => { return routerEntry.services; };

        return routerEntry;
    }
}
