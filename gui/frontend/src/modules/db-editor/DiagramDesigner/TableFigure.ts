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

import tableIcon from "../../../assets/images/msm/schemaTable.svg?raw";
import columnIcon from "../../../assets/images/msm/schemaTableColumn.svg?raw";
import columnIconNotNull from "../../../assets/images/msm/schemaTableColumnNN.svg?raw";
import columnIconPk from "../../../assets/images/msm/schemaTableColumnPK.svg?raw";
// import indexIcon from "../../../assets/images/msm/schemaTableIndex.svg?raw";
// import foreignKeyIcon from "../../../assets/images/msm/schemaTableForeignKey.svg?raw";

import * as pixi from "pixi.js";

import { Figure } from "../../../components/ui/Canvas/Figures/Figure.js";
import type { IDdmTableEntry } from "./DiagramDataModel.js";
import { prepareImage } from "./diagram-helpers.js";
import { ScrollableContainer, ScrollBoxOverflow } from "./ScrollableContainer.js";

// TODO: synchronize colors with app theme.
export const foregroundColor = 0xdddddd;
const foregroundColorString = "#dddddd";

//const dimmedForegroundColor = 0x888888;
const dimmedForegroundColorString = "#888888";

export const tableTextStyle = {
    fontFamily: "Helvetica Neue, Arial, sans-serif",
    fontSize: 18,
    fill: foregroundColor,
};

const headerHeight = 30;

export class TableFigure extends Figure {
    /**
     * Creates a new Figure for the given data model entry.
     *
     * @param dmEntry The data model entry to represent.
     * @param events Since the Figure needs to handle events (internal viewport), the event system must be passed in.
     */
    public constructor(private dmEntry: IDdmTableEntry, private events: pixi.EventSystem) {
        dmEntry.diagramValues.collapsedHeight = headerHeight;
        const header = new pixi.Container({
            layout: {
                flexDirection: "row",
                paddingLeft: 10,
                paddingRight: 10,
                gap: 5,
                alignItems: "center",
                width: dmEntry.diagramValues.width,
                height: headerHeight,
                flex: 0,
            },
        });

        // No layout, just a background.
        const headerBackground = new pixi.Graphics();
        headerBackground.rect(0, 0, dmEntry.diagramValues.width, headerHeight);
        headerBackground.fill(0x51A3BD);
        header.addChild(headerBackground);

        const tableImage = prepareImage(tableIcon, { width: 15, height: 15, alpha: 1 }, foregroundColorString);
        tableImage.layout = true;

        const title = new pixi.Text({
            text: dmEntry.caption,
            style: { ...tableTextStyle, fontSize: 14, fontWeight: "bold", fill: foregroundColor },
            textureStyle: { scaleMode: "nearest", },
            layout: { flex: 0 },
        });

        const triangle = new pixi.Graphics({ layout: { width: 10, height: 10, marginLeft: "auto" } });
        triangle.moveTo(0, 0);
        triangle.lineTo(10, 0);
        triangle.lineTo(5, 10);
        triangle.fill(foregroundColor);
        triangle.interactive = true;

        triangle.on("pointertap", (e) => {
            dmEntry.state.expanded = !dmEntry.state.expanded;
            e.stopPropagation();

            this.render({
                diagramValues: {
                    width: dmEntry.diagramValues.width,
                    height: dmEntry.state.expanded
                        ? dmEntry.diagramValues.height
                        : dmEntry.diagramValues.collapsedHeight ?? dmEntry.diagramValues.height,
                },
                children: dmEntry.state.expanded ? [header, scrollbox] : [header],
            });
            triangle.rotation = dmEntry.state.expanded ? 0 : -Math.PI / 2;
        });

        header.addChild(tableImage, title, triangle);

        const scrollbox = new ScrollableContainer({
            events: events,
            boxWidth: dmEntry.diagramValues.width,
            boxHeight: dmEntry.diagramValues.height - 30,
            overflowX: ScrollBoxOverflow.Auto,
            overflowY: ScrollBoxOverflow.Auto,
            fadeScrollbar: false,
            scrollbarBackgroundAlpha: 0,
            scrollbarForegroundAlpha: 0.75,
            scrollbarOffsetHorizontal: -2,
            scrollbarOffsetVertical: -2,
            stopPropagation: true,
            passiveWheel: true,
        });

        scrollbox.layout = {
            x: 0,
            y: 30,
            width: dmEntry.diagramValues.width,
            height: dmEntry.diagramValues.width - 30,
        };

        const body = new pixi.Container({
            layout: {
                x: 0,
                y: 0,
                padding: 8,
                flexDirection: "column",
                alignItems: "flex-start",
                alignSelf: "stretch",
                overflow: "hidden",
            },
        });

        scrollbox.content.addChild(body);

        if (dmEntry.description) {
            const description = new pixi.HTMLText({
                text: dmEntry.description,
                style: {
                    ...tableTextStyle,
                    fontSize: 11,
                    fill: foregroundColor,
                    align: "left",
                    wordWrap: true,
                    whiteSpace: "pre-line",
                },
                textureStyle: { scaleMode: "nearest", },
                layout: {
                    flex: 1,
                    objectFit: "fill",
                },
            });

            body.addChild(description);
        }

        TableFigure.renderColumnNames(body, dmEntry);
        TableFigure.renderIndexNames(body, dmEntry);
        TableFigure.renderForeignKeyNames(body, dmEntry);
        scrollbox.update();

        super({
            diagramValues: {
                x: dmEntry.diagramValues.x,
                y: dmEntry.diagramValues.y,
                width: dmEntry.diagramValues.width,
                height: dmEntry.state.expanded ? dmEntry.diagramValues.height : dmEntry.diagramValues.collapsedHeight,
                selectable: dmEntry.diagramValues.selectable,
                resizable: dmEntry.diagramValues.resizable,
            },
            children: [header, scrollbox],
        });
    }

    private static renderColumnNames(body: pixi.Container, dmEntry: IDdmTableEntry): void {
        if (!dmEntry.columns || dmEntry.columns.length === 0) {
            return;
        }

        const title = new pixi.Text({
            text: "Columns",
            style: { ...tableTextStyle, fontSize: 12, fontWeight: "bold", fill: foregroundColor },
            textureStyle: { scaleMode: "nearest", },
            layout: { marginBottom: 5, flex: 0 },
        });
        body.addChild(title);

        for (const col of dmEntry.columns) {
            const row = new pixi.Container({
                layout: {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    flex: 1,
                }
            });
            body.addChild(row);

            let width = 8;
            let height = 8;
            if (col.primaryKey) {
                width = 6;
                height = 12;
            }
            const image = prepareImage(
                col.primaryKey ? columnIconPk : (col.nullable ? columnIcon : columnIconNotNull),
                { width, height },
                foregroundColorString);
            image.layout = { flex: 0 };
            row.addChild(image);

            const colText = new pixi.HTMLText({
                text: `<span class="name">${col.name}</span> <span class="type">${col.type}</span>`,
                style: {
                    cssOverrides: [
                        `.name { color: ${foregroundColor}; }`,
                        `.type { font-style: italic; color: ${dimmedForegroundColorString}; }`,
                        `.name, .type { line-height: 1.1rem;  }`,
                    ],
                    ...tableTextStyle,
                    fontSize: 10,
                    align: "left",
                },
                textureStyle: { scaleMode: "nearest", },
                layout: {
                    flex: 1,
                    objectFit: "none",
                },
            });
            row.addChild(colText);
        }
    }

    private static renderIndexNames(body: pixi.Container, dmEntry: IDdmTableEntry): void {
        if (!dmEntry.indexes || dmEntry.indexes.length === 0) {
            return;
        }

        const title = new pixi.Text({
            text: "Indexes",
            style: { ...tableTextStyle, fontSize: 12, fontWeight: "bold", fill: foregroundColor },
            textureStyle: { scaleMode: "nearest", },
            layout: { marginTop: 10, marginBottom: 5, flex: 0 },
        });
        body.addChild(title);

        for (const index of dmEntry.indexes) {
            const indexText = new pixi.HTMLText({
                text: `<span class="name">${index.name}</span>`,
                style: {
                    cssOverrides: [
                        `.name { color: ${foregroundColor}; }`,
                        `.name { line-height: 1.1rem; }`,
                    ],
                    ...tableTextStyle,
                    fontSize: 10,
                },
                textureStyle: { scaleMode: "nearest", },
                layout: {
                    flex: 0,
                },
            });
            body.addChild(indexText);
        }
    }

    private static renderForeignKeyNames(body: pixi.Container, dmEntry: IDdmTableEntry): void {
        if (!dmEntry.foreignKeys || dmEntry.foreignKeys.length === 0) {
            return;
        }

        const title = new pixi.Text({
            text: "Foreign Keys",
            style: { ...tableTextStyle, fontSize: 12, fontWeight: "bold", fill: foregroundColor },
            textureStyle: { scaleMode: "nearest", },
            layout: { marginTop: 10, marginBottom: 5, flex: 0 },
        });
        body.addChild(title);

        for (const foreignKey of dmEntry.foreignKeys) {
            const fkText = new pixi.HTMLText({
                text: `<span class="name">${foreignKey.name}</span>`,
                style: {
                    cssOverrides: [
                        `.name { color: ${foregroundColor}; }`,
                        `.name { line-height: 1.1rem; }`,
                    ],
                    ...tableTextStyle,
                    fontSize: 10,
                },
                textureStyle: { scaleMode: "nearest", },
                layout: {
                    flex: 0,
                },
            });
            body.addChild(fkText);
        }
    }
}
