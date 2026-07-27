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
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

const buildNativeMenuTemplate = (items, onSelect) => {
    return items.map((item) => {
        if (item.type === "separator") {
            return { type: "separator" };
        }

        const menuItem = {
            label: item.label ?? "",
            enabled: item.enabled ?? true,
            accelerator: item.accelerator,
        };

        if (Array.isArray(item.submenu) && item.submenu.length > 0) {
            menuItem.submenu = buildNativeMenuTemplate(item.submenu, onSelect);
            return menuItem;
        }

        if (typeof item.checked === "boolean") {
            menuItem.type = "checkbox";
            menuItem.checked = item.checked;
        }

        menuItem.click = () => {
            onSelect(item.id);
        };

        return menuItem;
    });
};

const resolvePositioningItem = (positioningItem) => {
    return Number.isInteger(positioningItem) && positioningItem > -1
        ? positioningItem
        : undefined;
};

const resolvePopupCoordinate = (value, origin, zoomFactor) => {
    if (!Number.isFinite(value)) {
        return undefined;
    }

    const safeOrigin = Number.isFinite(origin) ? origin : 0;
    const safeZoomFactor = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;

    return Math.round(safeOrigin + (value * safeZoomFactor));
};

const translatePopupCoordinates = (request, origin = {}, zoomFactor = 1) => {
    const x = resolvePopupCoordinate(request?.x, origin?.x, zoomFactor);
    const y = resolvePopupCoordinate(request?.y, origin?.y, zoomFactor);

    return {
        x,
        y,
    };
};

module.exports = {
    buildNativeMenuTemplate,
    resolvePositioningItem,
    translatePopupCoordinates,
};
