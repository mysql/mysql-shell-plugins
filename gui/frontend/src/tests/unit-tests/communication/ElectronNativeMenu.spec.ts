/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { createRequire } from "module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
    buildNativeMenuTemplate,
    resolvePositioningItem,
    translatePopupCoordinates,
} = require("../../../../../electron/src/native-menu.cjs") as {
    buildNativeMenuTemplate: (items: unknown[], onSelect: (itemId: string) => void) => unknown[];
    resolvePositioningItem: (positioningItem?: number) => number | undefined;
    translatePopupCoordinates: (
        request: { x?: number; y?: number; },
        origin?: { x?: number; y?: number; },
        zoomFactor?: number,
    ) => { x?: number; y?: number; };
};

describe("Electron native menu helpers", () => {
    it("translates separators, checkbox items, and submenu selections", () => {
        const onSelect = vi.fn();
        const template = buildNativeMenuTemplate([
            {
                id: "checked",
                label: "Stop on Error",
                checked: true,
            },
            {
                id: "separator",
                type: "separator",
            },
            {
                id: "parent",
                label: "Copy Row",
                submenu: [{
                    id: "copy-row",
                    label: "Copy Row",
                }],
            },
        ], onSelect) as Array<{
            type?: string;
            label?: string;
            checked?: boolean;
            click?: () => void;
            submenu?: Array<{ click?: () => void; label?: string; }>;
        }>;

        expect(template[0]).toMatchObject({
            type: "checkbox",
            label: "Stop on Error",
            checked: true,
        });
        expect(template[1]).toMatchObject({ type: "separator" });
        expect(template[2]).toMatchObject({
            label: "Copy Row",
            submenu: [expect.objectContaining({ label: "Copy Row" })],
        });

        template[2].submenu?.[0]?.click?.();
        expect(onSelect).toHaveBeenCalledWith("copy-row");
    });

    it("only forwards explicit positioning items to the host popup options", () => {
        expect(resolvePositioningItem(undefined)).toBeUndefined();
        expect(resolvePositioningItem(-1)).toBeUndefined();
        expect(resolvePositioningItem(0)).toBe(0);
        expect(resolvePositioningItem(2)).toBe(2);
    });

    it("translates renderer popup coordinates into screen coordinates using content bounds and zoom", () => {
        expect(translatePopupCoordinates({ x: 120, y: 240 }, { x: -1920, y: 58 }, 0.9)).toEqual({
            x: -1812,
            y: 274,
        });
        expect(translatePopupCoordinates({ x: 30.6, y: 40.4 }, { x: 100, y: 20 })).toEqual({ x: 131, y: 60 });
        expect(translatePopupCoordinates({ x: undefined, y: 18.8 }, { x: 40, y: -10 }, 1.25)).toEqual({
            x: undefined,
            y: 14,
        });
        expect(translatePopupCoordinates({ x: 12, y: 18 })).toEqual({ x: 12, y: 18 });
    });
});
