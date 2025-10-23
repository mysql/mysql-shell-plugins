/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import * as pixi from "pixi.js";

/** Common types used by the Canvas and its elements. */

/** Keyboard modifiers for events. */
export enum Modifier {
    None,
    Shift,
    Ctrl,
    Alt,
    Meta,
}

/** Data related to how the entry is shown in a diagram. */
export interface IDiagramValues {
    x: number;
    y: number;
    width: number;
    height: number;

    /** Rotation in degrees, clockwise. */
    rotation?: number;

    backgroundColor?: string;

    /** The zoom level the entry was last edited in. Used to adjust sizes when zooming. */
    lastZoomLevel?: number;

    /** Whether the entry can be selected in the UI. Default is false. */
    selectable?: boolean;

    /** Whether the entry can be resized. Default is false. */
    resizable?: boolean;

    /** Whether the entry is currently selected in the UI. */
    selected?: boolean;

    /** Whether the entry is currently highlighted in the UI. */
    highlighted?: boolean;

    /** Used when the entry is not expanded @see {@link IDdmBaseEntry.state} */
    collapsedHeight?: number;
}

/**
 * Get the set of active modifiers from a pointer event.
 *
 * @param event The pointer event to extract the modifiers from.
 *
 * @returns A set of active modifiers.
 */
export const getModifiers = (event: pixi.FederatedPointerEvent | KeyboardEvent): Set<Modifier> => {
    const modifiers = new Set<Modifier>();

    if (event.shiftKey) {
        modifiers.add(Modifier.Shift);
    }

    if (event.ctrlKey) {
        modifiers.add(Modifier.Ctrl);
    }

    if (event.altKey) {
        modifiers.add(Modifier.Alt);
    }

    if (event.metaKey) {
        modifiers.add(Modifier.Meta);
    }

    return modifiers;
};
