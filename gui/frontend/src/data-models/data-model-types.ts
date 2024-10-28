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

import type { ConnectionDataModelEntry } from "./ConnectionDataModel.js";

/**
 * This is the same interface as defined by VS Code. By defining a copy here we can use duck typing to
 * use both interfaces interchangeably.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface Command {
    /** Title of the command, like `save`. */
    title: string;

    /** The identifier of the actual command to handle. Can be an empty string. */
    command: string;

    /** A tooltip for the command, when represented in the UI. */
    tooltip?: string;

    /**
     * Arguments that the command handler should be invoked with.
     * Unfortunately, no type checking is done for the arguments.
     */
    arguments?: unknown[];
}

/** Identifiers for the type of admin page we have. */
export type AdminPageType = "serverStatus" | "clientConnections" | "performanceDashboard" | "lakehouseNavigator";

/**
 * The signature of a callback, which can be passed to any `initialize()` method.
 *
 * @param result The message to display to the user (if a string was given) or an error, which should be displayed.
 *               If no result is given or it is an error, the progress indicator should be hidden.
 */
export type ProgressCallback = (result?: string | Error) => void;

export interface ICdmInitializer {
    initializeEntry(entry: ConnectionDataModelEntry, callback?: ProgressCallback): Promise<boolean>;
}

export type SubscriberAction = "add" | "remove" | "update" | "clear";

/**
 * A record of the action that was performed on the data model, and the entry that was affected.
 */
export interface ISubscriberActionType<T> {
    readonly action: SubscriberAction,

    /**
     * This entry is always set for actions, except "clear". With the clear action an undefined entry means that the
     * entry data model was cleared. If the entry is set, it means that all child elements of the given entry were
     * removed.
     */
    readonly entry?: T;
}

/**
 * Used for parts of the code base, which need to be notified about specific data model changes.
 *
 * @param action The action that was performed on the data model.
 * @param list The list of actions that happened on last change. Parent elements are created before child elements, if
 *             they don't exist yet, and multiple elements can be created in one action.
 */
export type DataModelSubscriber<T> = (list: Readonly<Array<ISubscriberActionType<T>>>) => void;

/** Transient information related to initialization, UI and others. */
export interface IDataModelEntryState {
    /** Set to true, once the entry's content was loaded. */
    readonly initialized: boolean;

    /** Marks an entry as having no children. Useful for the UI to indicate if an entry can be expanded. */
    readonly isLeaf: boolean;

    /** Is the entry currently expanded? */
    expanded: boolean;

    /** Was the entry expanded before? If not it must be initialized on expand. */
    expandedOnce: boolean;
}
