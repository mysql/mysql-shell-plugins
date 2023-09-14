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

import { AdminSectionTreeItem } from "./AdminSectionTreeItem";
import { AdminTreeItem } from "./AdminTreeItem";
import { ConnectionTreeItem } from "./ConnectionTreeItem";
import { MrsAuthAppTreeItem } from "./MrsAuthAppTreeItem";
import { MrsContentFileTreeItem } from "./MrsContentFileTreeItem";
import { MrsContentSetTreeItem } from "./MrsContentSetTreeItem";
import { MrsDbObjectTreeItem } from "./MrsDbObjectTreeItem";
import { MrsRouterTreeItem } from "./MrsRouterTreeItem";
import { MrsSchemaTreeItem } from "./MrsSchemaTreeItem";
import { MrsServiceTreeItem } from "./MrsServiceTreeItem";
import { MrsTreeItem } from "./MrsTreeItem";
import { MrsUserTreeItem } from "./MrsUserTreeItem";
import { SchemaEventTreeItem } from "./SchemaEventTreeItem";
import { SchemaGroupTreeItem } from "./SchemaGroupTreeItem";
import { SchemaRoutineTreeItem } from "./SchemaRoutineTreeItem";
import { SchemaTableColumnTreeItem } from "./SchemaTableColumnTreeItem";
import { SchemaTableForeignKeyTreeItem } from "./SchemaTableForeignKeyTreeItem";
import { TableGroupTreeItem } from "./SchemaTableGroupTreeItem";
import { SchemaTableIndexTreeItem } from "./SchemaTableIndexTreeItem";
import { SchemaTableTreeItem } from "./SchemaTableTreeItem";
import { SchemaTableTriggerTreeItem } from "./SchemaTableTriggerTreeItem";
import { SchemaTreeItem } from "./SchemaTreeItem";
import { SchemaViewMySQLTreeItem } from "./SchemaViewMySQLTreeItem";

/**
 * This file contains all interfaces which comprise the data model for the connections tree.
 *
 * The prefix means: CDM = Connections Data Model
 */

export interface ICdmRoutineEntry {
    parent: ICdmSchemaGroupEntry;

    type: "routine";
    treeItem: SchemaRoutineTreeItem;
}

export interface ICdmEventEntry {
    parent: ICdmSchemaGroupEntry;

    type: "event";
    treeItem: SchemaEventTreeItem;
}

export interface ICdmColumnEntry {
    parent: ICdmTableGroupEntry;

    type: "column";
    treeItem: SchemaTableColumnTreeItem;
}

export interface ICdmIndexEntry {
    parent: ICdmTableGroupEntry;

    type: "index";
    treeItem: SchemaTableIndexTreeItem;
}

export interface ICdmForeignKeyEntry {
    parent: ICdmTableGroupEntry;

    type: "foreignKey";
    treeItem: SchemaTableForeignKeyTreeItem;
}

export interface ICdmTriggerEntry {
    parent: ICdmTableGroupEntry;

    type: "trigger";
    treeItem: SchemaTableTriggerTreeItem;
}

export type CdmTableGroupMember = ICdmColumnEntry | ICdmIndexEntry | ICdmForeignKeyEntry | ICdmTriggerEntry;

export interface ICdmTableGroupEntry {
    parent: ICdmTableEntry;

    type: "tableMemberGroup";
    treeItem: TableGroupTreeItem;
    members: CdmTableGroupMember[];
}

export interface ICdmTableEntry {
    parent: ICdmSchemaGroupEntry;

    type: "table";
    treeItem: SchemaTableTreeItem;

    groups: ICdmTableGroupEntry[];
}

export interface ICdmViewEntry {
    parent: ICdmSchemaGroupEntry;

    type: "view";
    treeItem: SchemaViewMySQLTreeItem;
}

export type CdmSchemaGroupMember = ICdmRoutineEntry | ICdmEventEntry | ICdmTableEntry | ICdmViewEntry;

export interface ICdmSchemaGroupEntry {
    parent: ICdmSchemaEntry;

    type: "schemaMemberGroup";
    treeItem: SchemaGroupTreeItem;
    members: CdmSchemaGroupMember[];
}

export interface ICdmSchemaEntry {
    parent: ICdmConnectionEntry;

    type: "schema";
    treeItem: SchemaTreeItem;
    groups: ICdmSchemaGroupEntry[];
}

export interface ICdmAdminSectionEntry {
    parent: ICdmAdminEntry;

    type: "adminSection";
    treeItem: AdminSectionTreeItem;
}

interface ICdmAdminEntry {
    parent: ICdmConnectionEntry;

    type: "admin";
    treeItem: AdminTreeItem;
    sections: ICdmAdminSectionEntry[];
}

export interface ICdmRestDbObjectEntry {
    parent: ICdmRestSchemaEntry;

    type: "mrsDbObject";
    treeItem: MrsDbObjectTreeItem;
}

export interface ICdmRestSchemaEntry {
    parent: ICdmRestServiceEntry;

    type: "mrsSchema";
    treeItem: MrsSchemaTreeItem;
    dbObjects: ICdmRestDbObjectEntry[];
}

export interface ICdmRestContentFileEntry {
    parent: ICdmRestContentSetEntry;

    type: "mrsContentFile";
    treeItem: MrsContentFileTreeItem;
}

export interface ICdmRestContentSetEntry {
    parent: ICdmRestServiceEntry;

    type: "mrsContentSet";
    treeItem: MrsContentSetTreeItem;
    files: ICdmRestContentFileEntry[];
}

export interface ICdmRestUserEntry {
    parent: ICdmRestAuthAppEntry;

    type: "mrsUser";
    treeItem: MrsUserTreeItem;
}

export interface ICdmRestAuthAppEntry {
    parent: ICdmRestServiceEntry;

    type: "mrsAuthApp";
    treeItem: MrsAuthAppTreeItem;
    users: ICdmRestUserEntry[];
}

export interface ICdmRestServiceEntry {
    parent: ICdmRestRootEntry;

    type: "mrsService";
    treeItem: MrsServiceTreeItem;
    schemas: ICdmRestSchemaEntry[];
    contentSets: ICdmRestContentSetEntry[];
    authApps: ICdmRestAuthAppEntry[];
}

export interface ICdmRestRouterEntry {
    parent: ICdmRestRootEntry;

    type: "mrsRouter";
    treeItem: MrsRouterTreeItem;
}

export interface ICdmRestRootEntry {
    parent: ICdmConnectionEntry;

    type: "mrs",
    treeItem: MrsTreeItem;
    services: ICdmRestServiceEntry[];
    routers: ICdmRestRouterEntry[];
}

export interface ICdmConnectionEntry {
    type: "connection";
    id: number;
    treeItem: ConnectionTreeItem;

    isOpen: boolean;
    currentSchema: string;

    /** The number of open editors for this connection. */
    openEditors: number;

    /** Only used if MRS is configured for this connection. */
    mrsEntry?: ICdmRestRootEntry;

    /** Only used for MySQL connections. */
    adminEntry?: ICdmAdminEntry;
    schemaEntries: ICdmSchemaEntry[];
}

export type ConnectionsTreeDataModelEntry =
    | ICdmConnectionEntry
    | ICdmSchemaEntry
    | ICdmSchemaGroupEntry
    | ICdmTableEntry
    | ICdmViewEntry
    | ICdmEventEntry
    | ICdmRoutineEntry
    | ICdmAdminEntry
    | ICdmAdminSectionEntry
    | ICdmTableGroupEntry
    | ICdmColumnEntry
    | ICdmIndexEntry
    | ICdmForeignKeyEntry
    | ICdmTriggerEntry
    | ICdmRestRootEntry
    | ICdmRestServiceEntry
    | ICdmRestRouterEntry
    | ICdmRestSchemaEntry
    | ICdmRestContentSetEntry
    | ICdmRestAuthAppEntry
    | ICdmRestUserEntry
    | ICdmRestContentFileEntry
    | ICdmRestDbObjectEntry;
