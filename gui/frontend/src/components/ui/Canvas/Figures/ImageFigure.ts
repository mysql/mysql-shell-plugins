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

import { Figure } from "./Figure.js";
import type { ICanvasTheme } from "../Canvas.js";
import { getThemeColor } from "../canvas-helpers.js";

/** A figure to show an image (svg). No background, border or shadow is drawn. */
export class ImageFigure extends Figure {
    private imageGraphic: pixi.Graphics;

    public constructor(private image: string, theme: ICanvasTheme) {
        const graphic = ImageFigure.prepareImage(image, theme);

        super({
            diagramValues: {
                x: 0,
                y: 0,
                width: graphic.width,
                height: graphic.height,
                selectable: false,
                resizable: false
            }, theme
        });

        this.imageGraphic = graphic;
        this.content.addChild(this.imageGraphic);
    }

    public override render(): void {
        // Do not render the standard figure content.

        // We have to completely replace the image in case its colors need to be updated.
        this.content.removeChildren();
        this.content.addChild(this.imageGraphic);
    }

    public override updateTheme(theme: ICanvasTheme): void {
        this.imageGraphic = ImageFigure.prepareImage(this.image, theme);
        super.updateTheme(theme);
    }

    /**
     * Sets the size of the image, not the entire figure.
     *
     * @param width The new width.
     * @param height The new height.
     */
    public setSize(width: number, height: number): void {
        this.imageGraphic.width = width;
        this.imageGraphic.height = height;
    }

    /**
     * Takes the source of an SVG image and prepares it for use in pixi by ensuring it has the correct fill color.
     *
     * @param src The raw SVG source.
     *
     * @param theme The current canvas theme.
     *
     * @returns A pixi Graphics object containing the SVG image.
     */
    private static prepareImage(src: string, theme: ICanvasTheme): pixi.Graphics {
        const foregroundColor = getThemeColor(theme, "foreground", "#ffffff");
        if (src.includes("fill=")) {
            src = src.replace(/fill="[^"]*"/g, `fill="${foregroundColor}"`);
        } else {
            src = src.replace(/<path /g, `<path fill="${foregroundColor} "`);
        }

        const result = new pixi.Graphics().svg(src);
        result.layout = { flex: 0 };

        return result;
    };
}
