/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

/**
 * Checks if a point is within a given rectangle.
 *
 * @param p The point to check for.
 * @param r The rectangle to check against.
 *
 * @returns True if the point is within the the rectangle bounds, false otherwise.
 */
export const pointInRect = (p?: DOMPoint, r?: DOMRect): boolean => {
    if (!p || !r) {
        return false;
    }

    return (
        p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
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
 * @param dLeft The left delta to apply.
 * @param dTop The top delta to apply.
 * @param dRight The right delta to apply.
 * @param dBottom The bottom delta to apply.
 *
 * @returns Undefined, if the given rect was undefined or the changed rectangle.
 */
export const inflateRect = (r: DOMRect, dLeft: number, dTop: number, dRight: number,
    dBottom: number): DOMRect | undefined => {

    return new DOMRect(r.x - dLeft, r.y - dTop, r.width + dRight + dLeft, r.height + dTop + dBottom);
};
