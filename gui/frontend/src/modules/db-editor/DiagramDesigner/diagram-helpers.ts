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

import * as pixi from "pixi.js";

export interface IPrepareImageProperties {
    x?: number,
    y?: number,
    width?: number,
    height?: number,
    alpha?: number;
}

/**
 * Takes the source of an SVG image and prepares it for use in pixi by ensuring it has a white fill.
 *
 * @param src The raw SVG source.
 *
 * @param properties Optional properties to set on the resulting Graphics object.
 * @param foregroundColor The color to use for the image foreground.
 *
 * @returns A pixi Graphics object containing the SVG image.
 */
export const prepareImage = (src: string, properties?: IPrepareImageProperties,
    foregroundColor?: string): pixi.Graphics => {
    // TODO: use forground color from theme?
    if (src.includes("fill=")) {
        src = src.replace(/fill="[^"]*"/g, `fill="${foregroundColor ?? "#ffffff"}"`);
    } else {
        src = src.replace(/<path /g, `fill="${foregroundColor ?? "#ffffff"} "`);
    }

    const graphic = new pixi.Graphics().svg(src);

    if (properties) {
        if (properties.x !== undefined) {
            graphic.x = properties.x;
        }

        if (properties.y !== undefined) {
            graphic.y = properties.y;
        }

        if (properties.width !== undefined) {
            graphic.width = properties.width;
        }

        if (properties.height !== undefined) {
            graphic.height = properties.height;
        }

        if (properties.alpha !== undefined) {
            graphic.alpha = properties.alpha;
        }
    }

    return graphic;
};
