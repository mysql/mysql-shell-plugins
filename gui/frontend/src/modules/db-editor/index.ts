/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

/// <reference types="./assets/typings/scripting-runtime.d.ts" />

import { ComponentChild } from "preact";

import { EditorLanguage } from "../../supplement/index.js";

/** The type of an entry in trees etc. */
export enum EntityType {
    Notebook,
    Script,
    Folder,
    Status,
    Connections,
    Dashboard,
    LakehouseNavigator,
}

export enum SchemaTreeType {
    Document,
    Schema,
    Table,
    StoredFunction,
    StoredProcedure,
    Event,
    Trigger,
    Column,
    View,
    Index,
    ForeignKey,
    GroupNode,
    UserVariable,
    User,
    Engine,
    Plugin,
    Character
}

export interface ISchemaTreeEntry<T = unknown> {
    type: SchemaTreeType;
    expanded: boolean;     // Currently expanded?
    expandedOnce: boolean; // Was expanded before?

    id: string;            // To uniquely address the entry.
    caption: string;       // The text to show in the tree.
    qualifiedName: {       // The parts of the FQN to access a db object.
        schema: string;
        table?: string;    // Table or view name
        name?: string;     // Column or index name.
    };

    details: T;
    children?: Array<ISchemaTreeEntry<T>>;
}

// Base fields for entries in the various sections on a scripting tab.
export interface IEntityBase {
    type: EntityType;

    id: string;
    caption: string;
}

export interface IDBDataEntry extends IEntityBase {
    // The id under which this entry is reachable in the backend.
    dbDataId: number;

    // The ID of the folder in which this entry resides.
    folderId: number;
}

export interface IFolderEntity extends IDBDataEntry {
    children: IDBDataEntry[];
}

export interface IDBEditorScriptState extends IDBDataEntry {
    language: EditorLanguage;
}

/**
 * Lists of items to be added to a toolbar. The receiving page can use this as base to add it's own
 * items, before it actually renders the toolbar.
 */
export interface IToolbarItems {
    /** Items used to navigate between documents and to create new documents. */
    navigation: ComponentChild[];

    /** Items to execute blocks, including transaction toggles. */
    execution: ComponentChild[];

    /** Items related to the code editor (format, clean, word wrap etc.) */
    editor: ComponentChild[];

    /** Additional items for special functionality, which are right aligned in the toolbar. */
    auxillary: ComponentChild[];
}

/** Predefined color schemes in graphs. */
export type ColorScheme = "classic" | "delectable" | "trello" | "brewing" | "light" | "lively" | "grays";

/** Cached data for the performance dashboard. */
export interface ISavedGraphData {
    /** The currently selected graph color scheme (default: classic). */
    activeColorScheme: ColorScheme;

    /** The currently selected display interval in line graphs. */
    displayInterval: number;

    /** The timestamp when this snapshot was taken. */
    timestamp: number;

    /** Last read values from the server (for computing differences). */
    currentValues: Map<string, number>;

    /** Computed values for labels and pie graphs.  */
    computedValues: { [key: string]: number; };

    /** Stored data per line graph. */
    series: Map<string, IXYDatum[]>;
}
