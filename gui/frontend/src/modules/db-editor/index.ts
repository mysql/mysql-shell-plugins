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

import { ComponentChild, createContext } from "preact";

import type { ConnectionDataModel, ConnectionDataModelEntry } from "../../data-models/ConnectionDataModel.js";
import type { OciDataModel, OciDataModelEntry } from "../../data-models/OciDataModel.js";
import type { OpenDocumentDataModel, OpenDocumentDataModelEntry } from "../../data-models/OpenDocumentDataModel.js";
import type { ShellTaskDataModel } from "../../data-models/ShellTaskDataModel.js";

/** This is the base structure for a tree in the sidebar UI. */
export interface IBaseTreeItem<T> {
    /** This is a copy of the id from the data model entry to allow searching for it. */
    id: string;

    /** The data model entry that this interface represents. */
    dataModelEntry: T;

    /** The caption for the UI. Can change at any time. */
    caption: string;

    children?: Array<IBaseTreeItem<T>>;
}

/** Comprises the parts of a fully qualified name. */
export type QualifiedName = {
    /** Not assigned for connections. */
    schema?: string;

    /** Not assigned for connections and schema entries. Holds a table or view name. */
    table?: string;

    /** Assigned only for entries that have either a table or a schema as parent. */
    name?: string;
};

/** Represents the visual expression of a connection data model entry. */
export interface IConnectionTreeItem extends IBaseTreeItem<ConnectionDataModelEntry> {
    /** The parts of the FQN to access a db object. */
    qualifiedName: QualifiedName;

    children?: IConnectionTreeItem[];
}

/** Represents the visual expression of a connection data model entry. */
export interface IDocumentTreeItem extends IBaseTreeItem<OpenDocumentDataModelEntry> {
    children?: IDocumentTreeItem[];
}

/** Represents the visual expression of an OCI data model entry. */
export interface IOciTreeItem extends IBaseTreeItem<OciDataModelEntry> {
    children?: IOciTreeItem[];
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

/** The preact context holding shared data for all pages in the DB editor module. */
export type DBEditorContextType = {
    connectionsDataModel: ConnectionDataModel;
    documentDataModel: OpenDocumentDataModel;
    ociDataModel: OciDataModel;
    shellTaskDataModel: ShellTaskDataModel;
};

/**
 * The context class for the DB editor module. This is used to share data between the various
 * components in the module.
 * Note: have to include `undefined` in the type list here, to avoid being forced to provide a
 *       default value in the `createContext` call.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const DBEditorContext = createContext<DBEditorContextType | undefined>(undefined);

/** Describes possible results for a sidebar command. */
export interface ISideBarCommandResult {
    /** Indicates whether the command was successfully executed or cancelled (by the user or an error). */
    success: boolean;

    /** For MRS related commands: indicates the MRS service that was modified. */
    mrsServiceId?: string;

    /** For MRS related commands: indicates the MRS schema that was modified. */
    mrsSchemaId?: string;
}
