/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { inflateRect, pointInRect, rectsAreEqual } from "../../../utilities/graphics";

describe("Graphics Tests", () => {
    it("Rectangles", () => {
        const point1 = new DOMPoint(2, 1, 3, 4);
        const point2: DOMPoint = new DOMPoint(-95, 3, 4, 1);
        const rect1: DOMRect = new DOMRect(0, 0, 0, 0);
        const rect2: DOMRect = new DOMRect(-100, 0, 10, 10);
        const rect3: DOMRect = new DOMRect(0, 0, 10, 10);
        const rect4: DOMRect = new DOMRect(0, 0, 10, 10);
        const rect5: DOMRect = new DOMRect(-1, -1, 12, 12);

        expect(pointInRect()).toBeFalsy();
        expect(pointInRect(point1)).toBeFalsy();
        expect(pointInRect(point1, rect1)).toBeFalsy();
        expect(pointInRect(point1, rect2)).toBeFalsy();
        expect(pointInRect(point2, rect2)).toBeTruthy();

        expect(rectsAreEqual(rect1, rect2)).toBeFalsy();
        expect(rectsAreEqual(rect3, rect4)).toBeTruthy();
        expect(rectsAreEqual(rect4, rect3)).toBeTruthy();

        expect(inflateRect(rect3, 1, 1, 1, 1)).toStrictEqual(rect5);
    });

});
