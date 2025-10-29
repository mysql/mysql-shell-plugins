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

import type { ICanvasTheme } from "../../../components/ui/Canvas/Canvas.js";
import { Figure } from "../../../components/ui/Canvas/Figures/Figure.js";
import type { IDdmContainerEntry } from "./DiagramDataModel.js";

export const tableTextStyle = {
    fontFamily: "Helvetica Neue, Arial, sans-serif",
    fontSize: 14,
};

const titleHeight = 24;

export class ContainerFigure extends Figure {
    // Empty class as a placeholder for recent edits context
    public constructor(private dmEntry: IDdmContainerEntry, theme: ICanvasTheme) {
        const children: pixi.Container[] = [];

        // The main background.
        if (dmEntry.fillColor) {
            const headerBackground = new pixi.Graphics();
            headerBackground.rect(0, 0, dmEntry.diagramValues.width, dmEntry.diagramValues.height);
            headerBackground.fill(dmEntry.fillColor);
            children.push(headerBackground);
        }

        // The tile background. It's drawn as a rect with the lower right corener rounded.
        const titleBackground = new pixi.Graphics();
        titleBackground.moveTo(0, 0)
            .lineTo(200, 0)
            .lineTo(200, titleHeight - 8)
            .arcTo(200, titleHeight, 200 - 8, titleHeight, 8)
            .lineTo(0, titleHeight)
            .lineTo(0, 0)
            .fill("#C0C0C0");
        children.push(titleBackground);

        const title = new pixi.Text({
            text: dmEntry.caption,
            style: tableTextStyle,
            textureStyle: { scaleMode: "nearest", },
            layout: { flex: 0 },
        });
        title.x = 8;
        title.y = (titleHeight - title.height) / 2;
        title.style.fill = "#404040";
        children.push(title);

        super({
            diagramValues: {
                x: dmEntry.diagramValues.x,
                y: dmEntry.diagramValues.y,
                width: dmEntry.diagramValues.width,
                height: dmEntry.diagramValues.height,
                selectable: dmEntry.diagramValues.selectable,
                resizable: dmEntry.diagramValues.resizable,
            },
            theme,
            children,
        });
    }
}
