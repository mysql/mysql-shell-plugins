/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

import Color from "color";

/**
 * Checks if a point is within a given rectangle.
 *
 * @param p The point to check for.
 * @param r The rectangle to check against.
 *
 * @returns True if the point is within the the rectangle bounds, false otherwise.
 */
export const pointInRect = (p: DOMPoint | undefined, r: DOMRect | undefined): boolean => {
    if (!p || !r) {
        return false;
    }

    return (
        r.x <= p.x && p.x <= (r.x + r.width)
        && r.y <= p.y && p.y <= (r.y + r.height)
    );
};

/**
 * Checks if two rectangles are equal.
 *
 * @param left The first rectangle to check.
 * @param right The second rectangle to check.
 *
 * @returns True, if both rects have the same dimensions and positions, false otherwise.
 */
export const rectsAreEqual = (left: DOMRect, right: DOMRect): boolean => {
    return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
};

/**
 * Creates a new rect with change bounds and location, depending on the inflation values.
 *
 * @param r The rectangle to change.
 * @param top The top delta to apply.
 * @param right The right delta to apply.
 * @param bottom The bottom delta to apply.
 * @param left The left delta to apply.
 *
 * @returns Undefined, if the given rect was undefined or the changed rectangle.
 */
export const inflateRect = (r: DOMRect | undefined,
    top: number, right: number, bottom: number, left: number): DOMRect | undefined => {
    if (!r) {
        return undefined;
    }

    return new DOMRect(r.x - left, r.y - top, r.width + right + left, r.height + top + bottom);
};

/**
 * Converts a color string or a color to a hex string.
 *
 * @param color The value to convert.
 *
 * @returns A hex string of the given color, including the alpha value.
 */
export const colorToHex = (color: string | Color | undefined): string | undefined => {
    if (!color) {
        return;
    }

    if (typeof color === "string") {
        color = new Color(color);
    }

    // Hex color values have no alpha component, so we have to add that explicitly.
    if (color.alpha() < 1) {
        let alpha = Math.round((color.alpha() * 255)).toString(16);
        if (alpha.length < 2) {
            alpha = "0" + alpha;
        }

        return color.hex() + alpha;
    } else {
        return color.hex();
    }
};
