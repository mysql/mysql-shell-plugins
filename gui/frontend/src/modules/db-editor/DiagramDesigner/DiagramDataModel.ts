/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import type { Mutable } from "../../../app-logic/general-types.js";
import type { IDiagramValues } from "../../../components/ui/Canvas/canvas-helpers.js";
import type { IDataModelEntryState, ProgressCallback } from "../../../data-models/data-model-types.js";

/** Element types in the Diagram data model. */
export enum DdmEntityType {
    /** Groups multiple other elements. */
    Container,

    /** A piece of text placed anywhere in the diagram. */
    Note,

    /** An image placed anywhere in the diagram. */
    Image,

    /** A figure representing a table in a database. */
    Table,

    /** A figure representing a view in a database. */
    View,

    /** A figure representing a stored procedure or function in a database. */
    Routine,
}

export interface IDdmBaseEntry {
    /** The parent container of this entry, if any. Top level entries have no parent. */
    parent?: IDdmContainerEntry;

    /**
     * A unique identifier to find items independent of other properties and to link items in the UI
     * (e.g. between data models). This ID is transient and not stored in the backend.
     */
    id: string;

    /** The caption of the entry in the UI. */
    readonly caption: string;

    /** A description with additional information about the entry. */
    description?: string;

    /** The type of the entry. This is used a discriminator for the individual entries. */
    readonly type: DdmEntityType;

    /** Transient information related to initialization, UI and others. */
    readonly state: IDataModelEntryState;

    /** Data related to how the entry is shown in a diagram. */
    diagramValues: IDiagramValues;

    /**
     * Reloads the content of this data model entry, regardless of whether it was already initialized or not.
     * This should always be set if `initialize` is set.
     *
     * @param callback An optional callback to report progress.
     */
    refresh?(callback?: ProgressCallback): Promise<boolean>;
}

export interface IDdmContainerEntry extends IDdmBaseEntry {
    type: DdmEntityType.Container;

    /** The background color of the container area (default: canvas background). */
    fillColor?: string;

    /** The child entries of this container. */
    children: IDdmBaseEntry[];
}

export interface IDdmNoteEntry extends IDdmBaseEntry {
    type: DdmEntityType.Note;

    /** The text content of the note. */
    text: string;
}

export interface IDdmImageEntry extends IDdmBaseEntry {
    type: DdmEntityType.Image;

    /** The URL of the image to display. */
    url: string;
}

export interface IDdmTableEntry extends IDdmBaseEntry {
    type: DdmEntityType.Table;

    /** The name of the table in the database. */
    tableName: string;

    /** The name of the schema (database) the table belongs to. */
    schemaName: string;

    columns?: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
        unique: boolean;
        default?: string;
        extra?: string;
    }>;

    indexes?: Array<{
        name: string;
        columns: string[];
        unique: boolean;
        type?: string;
        comment?: string;
    }>;

    foreignKeys?: Array<{
        name: string;
        columns: string[];
        referencedTable: string;
        referencedColumns: string[];
        onUpdate?: string;
        onDelete?: string;
    }>;

    triggers?: Array<{
        name: string;
        timing: "BEFORE" | "AFTER" | "INSTEAD OF";
        event: "INSERT" | "UPDATE" | "DELETE";
        statement: string;
    }>;
}

export interface IDdmViewEntry extends IDdmBaseEntry {
    type: DdmEntityType.View;

    /** The name of the view in the database. */
    viewName: string;

    /** The name of the schema (database) the view belongs to. */
    schemaName: string;
}

export interface IDdmRoutineEntry extends IDdmBaseEntry {
    type: DdmEntityType.Routine;

    /** The name of the routine in the database. */
    routineName: string;

    /** The name of the schema (database) the routine belongs to. */
    schemaName: string;

    /** Whether this routine is a stored procedure or a function. */
    isFunction: boolean;
}

/** An entry in the Diagram data model, which can be any of the supported entity types. */
export type IDiagramDataModelEntry =
    IDdmContainerEntry |
    IDdmNoteEntry |
    IDdmImageEntry |
    IDdmTableEntry |
    IDdmViewEntry |
    IDdmRoutineEntry;

export interface IDiagramState {
    zoom: number;
    xOffset: number;
    yOffset: number;
    activeTool: string;
    gridVisible: boolean;
    rulersVisible: boolean;
    marginsVisible: boolean;
    pageBordersVisible: boolean;
    locked: boolean;
    selectedTopology: string;
    debugLogging?: boolean;
}

export interface IDiagramDocument {
    state: IDiagramState;
    entries: IDiagramDataModelEntry[];
}

export class DiagramDataModel {
    private static readonly defaultState: IDiagramState = {
        zoom: 1,
        xOffset: 0,
        yOffset: 0,
        activeTool: "pointer",
        gridVisible: true,
        rulersVisible: true,
        marginsVisible: true,
        pageBordersVisible: true,
        locked: false,
        selectedTopology: "logical",
        debugLogging: false,
    };

    private diagram: IDiagramDocument = {
        state: { ...DiagramDataModel.defaultState },
        entries: [],
    };

    public constructor() {
        this.generateMockData();
    }

    /** @returns all top level entries in the data model. */
    public get document(): IDiagramDocument {
        return this.diagram;
    }

    public createEntry(entry: Omit<IDiagramDataModelEntry, "id" | "state" | "parent">,
        parent?: IDdmContainerEntry): IDiagramDataModelEntry {
        const newEntry: IDiagramDataModelEntry = {
            ...entry,
            id: crypto.randomUUID(),
            state: {},
            parent,
        } as IDiagramDataModelEntry;

        if (parent) {
            parent.children.push(newEntry);
        } else {
            this.diagram.entries.push(newEntry);
        }

        return newEntry;
    }

    private generateMockData(): void {
        const tableEntry1: IDdmTableEntry = {
            id: "1",
            type: DdmEntityType.Table,
            caption: "Actor",
            description: "A list of all actors in the database.",
            tableName: "actor",
            schemaName: "sakila",
            state: {
                initialized: true,
                expanded: true,
                expandedOnce: true,
                isLeaf: true,
            },
            columns: [
                { name: "actor_id", type: "INT", nullable: false, primaryKey: true, unique: true },
                { name: "first_name", type: "VARCHAR(45)", nullable: false, primaryKey: false, unique: false },
                { name: "last_name", type: "VARCHAR(45)", nullable: false, primaryKey: false, unique: false },
                { name: "last_update", type: "TIMESTAMP", nullable: false, primaryKey: false, unique: false },
            ],
            indexes: [
                { name: "PRIMARY", columns: ["actor_id"], unique: true },
                { name: "idx_actor_last_name", columns: ["last_name"], unique: false },

            ],
            foreignKeys: [],
            diagramValues: {
                x: 500,
                y: 400,
                width: 200,
                height: 300,
                selectable: true,
                resizable: true,
            }
        };

        const tableEntry2: IDdmTableEntry = {
            id: "2",
            type: DdmEntityType.Table,
            caption: "Film",
            tableName: "film",
            schemaName: "sakila",
            state: {
                initialized: true,
                expanded: true,
                expandedOnce: true,
                isLeaf: true,
            },
            columns: [
                { name: "film_id", type: "INT", nullable: false, primaryKey: true, unique: true },
                { name: "title", type: "VARCHAR(255)", nullable: false, primaryKey: false, unique: false },
                { name: "description", type: "TEXT", nullable: true, primaryKey: false, unique: false },
                { name: "release_year", type: "YEAR(4)", nullable: true, primaryKey: false, unique: false },
                { name: "language_id", type: "TINYINT", nullable: false, primaryKey: false, unique: false },
                { name: "original_language_id", type: "TINYINT", nullable: true, primaryKey: false, unique: false },
                { name: "rental_duration", type: "TINYINT", nullable: false, primaryKey: false, unique: false },
                { name: "rental_rate", type: "DECIMAL(4,2)", nullable: false, primaryKey: false, unique: false },
                { name: "length", type: "SMALLINT", nullable: true, primaryKey: false, unique: false },
                { name: "replacement_cost", type: "DECIMAL(5,2)", nullable: false, primaryKey: false, unique: false },
                {
                    name: "rating",
                    type: "ENUM('G','PG','PG-13','R','NC-17')",
                    nullable: true,
                    primaryKey: false,
                    unique: false
                },
                {
                    name: "special_features",
                    type: "SET('Trailers','Commentaries','Deleted Scenes','Behind the Scenes')",
                    nullable: true,
                    primaryKey: false,
                    unique: false
                },
                {
                    name: "last_update",
                    type: "TIMESTAMP",
                    nullable: false,
                    primaryKey: false,
                    unique: false
                },
            ],
            indexes: [
                { name: "PRIMARY", columns: ["film_id"], unique: true },
                { name: "idx_title", columns: ["title"], unique: false },
                { name: "idx_fk_language_id", columns: ["language_id"], unique: false },
                { name: "idx_fk_original_language_id", columns: ["original_language_id"], unique: false },
            ],
            foreignKeys: [
                {
                    name: "fk_language_id",
                    columns: ["language_id"],
                    referencedTable: "language",
                    referencedColumns: ["language_id"]
                },
                {
                    name: "fk_original_language_id",
                    columns: ["original_language_id"],
                    referencedTable: "language",
                    referencedColumns: ["language_id"]
                },
            ],
            triggers: [
                {
                    name: "ins_film",
                    timing: "AFTER",
                    event: "INSERT",
                    statement: "CREATE DEFINER=`root`@`localhost` TRIGGER `ins_film` AFTER INSERT ON `film` FOR EACH " +
                        "ROW BEGIN INSERT INTO film_text(film_id, title, description) " +
                        "VALUES(new.film_id, new.title, new.description); END"
                },
                { name: "upd_film", timing: "AFTER", event: "UPDATE", statement: "" },
                { name: "del_film", timing: "AFTER", event: "DELETE", statement: "" },
            ],
            diagramValues: {
                x: 700,
                y: 450,
                width: 200,
                height: 300,
                selectable: true,
                resizable: true,
            }
        };

        const tableEntry3 = JSON.parse(JSON.stringify(tableEntry1)) as Mutable<IDdmTableEntry>;
        tableEntry3.id = "3";
        tableEntry3.caption = "Customer";
        tableEntry3.tableName = "customer";
        tableEntry3.diagramValues.x = 50;
        tableEntry3.diagramValues.y = 20;

        const tableEntry4 = JSON.parse(JSON.stringify(tableEntry2)) as Mutable<IDdmTableEntry>;
        tableEntry4.id = "4";
        tableEntry4.caption = "Address";
        tableEntry4.tableName = "address";
        tableEntry4.diagramValues.x = 230;
        tableEntry4.diagramValues.y = 40;

        const containerEntry1: IDdmContainerEntry = {
            id: "container-1",
            type: DdmEntityType.Container,
            caption: "User Tables",
            description: "A container grouping two tables.",
            fillColor: "#d07070ff",
            state: {
                initialized: true,
                expanded: true,
                expandedOnce: true,
                isLeaf: false,
            },
            diagramValues: {
                x: 100,
                y: 50,
                width: 650,
                height: 400,
                selectable: true,
                resizable: true,
            },
            children: [tableEntry3, tableEntry4],
        };

        const containerEntry2: IDdmContainerEntry = {
            id: "container-2",
            type: DdmEntityType.Container,
            caption: "Audit Log",
            description: "A group for audit related tables.",
            fillColor: "#c1ce8fff",
            state: {
                initialized: true,
                expanded: true,
                expandedOnce: true,
                isLeaf: false,
            },
            diagramValues: {
                x: 200,
                y: 750,
                width: 800,
                height: 600,
                selectable: true,
                resizable: true,
            },
            children: [containerEntry1],
        };

        this.diagram.entries.push(tableEntry1, tableEntry2, containerEntry2);
    }
}
