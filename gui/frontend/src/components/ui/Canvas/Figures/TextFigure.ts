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

/** A simple figure showing only some text. No background, border or shadow is draw. */
export class TextFigure extends Figure {
    public constructor(private caption: string, private textStyle: pixi.TextStyleOptions, theme: ICanvasTheme) {
        super({ diagramValues: { x: 0, y: 0, width: 100, height: 30, selectable: false, resizable: false }, theme });
    }

    public override render(): void {
        // Do not render the standard figure content.
        this.content.removeChildren();

        const title = new pixi.Text({
            text: this.caption,
            style: this.textStyle,
            textureStyle: {
                scaleMode: "nearest", // Pixel-perfect scaling
            }
        });
        this.content.addChild(title);
    }

    public override updateTheme(theme: ICanvasTheme): void {
        this.textStyle.fill = getThemeColor(theme, "foreground", "#FFFFFF");
        super.updateTheme(theme);
    }
}
