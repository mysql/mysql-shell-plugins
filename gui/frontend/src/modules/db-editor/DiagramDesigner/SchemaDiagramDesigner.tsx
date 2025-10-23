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

// Explicitly load our images as raw SVG so we can use them as pixi SVG graphics.
import mysqlConnectionIcon from "../../../assets/images/connectionMysql.svg?raw";
import networkIcon from "../../../assets/images/msm/info-network.svg?raw";

// Use a namespace import to avoid conflicts with our own classes named "Container", "Label", etc.
import * as pixi from "pixi.js";
import { ComponentChild, createRef } from "preact";

import { Canvas, type ICanvasElement } from "../../../components/ui/Canvas/Canvas.js";
import { Connection, ConnectionType } from "../../../components/ui/Canvas/Figures/Connection.js";
import { Figure } from "../../../components/ui/Canvas/Figures/Figure.js";
import { PageSettings } from "../../../components/ui/Canvas/PageSettings.js";
import {
    ComponentBase, IComponentProperties, IComponentState
} from "../../../components/ui/Component/ComponentBase.js";
import { IOdmSchemaDiagramEntry } from "../../../data-models/OpenDocumentDataModel.js";
import { prepareImage } from "./diagram-helpers.js";
import { DdmEntityType, DiagramDataModel } from "./DiagramDataModel.js";
import { SchemaDiagramToolbar, SchemaDiagramToolbarAction } from "./SchemaDiagramToolbar.js";
import { TableFigure } from "./TableFigure.js";

/** TODO: Replace with actual implementation */
type IDictionary = Record<string, unknown>;

/** Contains data to restore a previous state of a Entity-Relationship Diagram editor. */
export interface ISchemaDiagramPersistentState {
    xOffset: number;
    yOffset: number;
    zoom: number;

    diagramRootContainer?: ISchemaDiagram;
}

/** The actual Entity-Relationship Diagram */
export interface ISchemaDiagram {
    rootContainer: IDictionary;
}

export interface ISchemaDiagramDesignerProps extends IComponentProperties {
    savedState: ISchemaDiagramPersistentState;
    dataModelEntry: IOdmSchemaDiagramEntry;
}

interface ISchemaDiagramDesignerState extends IComponentState {
    // Used to trigger a re-render when the data model or the toolbar mode changes.
    revision: number;
    elements?: ICanvasElement[];
}

const defaultLabelStyle: pixi.TextStyleOptions = {
    fontFamily: "Helvetica",
    fontSize: 16,
    fill: 0xffffff,
    align: "left",
};

export class SchemaDiagramDesigner extends ComponentBase<ISchemaDiagramDesignerProps, ISchemaDiagramDesignerState> {
    private datamodel: DiagramDataModel = new DiagramDataModel();
    private canvasRef = createRef<Canvas>();
    private toolbarRef = createRef<SchemaDiagramToolbar>();

    public constructor(props: ISchemaDiagramDesignerProps) {
        super(props);

        this.state = {
            revision: 1,
        };
    }

    public render(): ComponentChild {
        const { elements } = this.state;

        const pageSettings = new PageSettings("A4", "portrait");
        pageSettings.setMargins(10, 10, 10, 10);

        return <>
            <SchemaDiagramToolbar
                ref={this.toolbarRef}
                state={this.datamodel.document.state}
                onAction={(action, value) => {
                    this.handleAction(action, value);
                }}
            />
            <Canvas
                className={this.getEffectiveClassNames(["schemaDiagramDesigner"])}
                key="schemaDiagramCanvas"
                ref={this.canvasRef}
                elements={elements ?? []}
                idleFPS={1}
                insideBackground="#282828"
                outsideBackground="#202020"
                pageSettings={pageSettings}
                pageCount={{ horizontal: 2, vertical: 2 }}
                gridSettings={{
                    horizontalDistance: 5,
                    verticalDistance: 5,
                    subCellCount: 5,
                }}
                onCanvasReady={this.onCanvasReady}
            />
        </>;
    }

    private handleAction(action: SchemaDiagramToolbarAction, value: string | boolean) {
        switch (action) {
            case SchemaDiagramToolbarAction.ActiveTool: {
                const mode = value as "pointer" | "hand" | "zoom";
                this.datamodel.document.state.activeTool = mode;
                this.canvasRef.current?.updateUi({ mode: mode });

                // The toolbar will update itself. Don't force a re-render here or the canvas fully redraw.

                break;
            }

            case SchemaDiagramToolbarAction.GridVisible: {
                this.datamodel.document.state.gridVisible = value as boolean;
                this.canvasRef.current?.updateUi({ showGrid: value as boolean });

                break;
            }

            case SchemaDiagramToolbarAction.RulersVisible: {
                this.datamodel.document.state.rulersVisible = value as boolean;
                this.canvasRef.current?.updateUi({ showRulers: value as boolean });

                break;
            }

            case SchemaDiagramToolbarAction.MarginsVisible: {
                this.datamodel.document.state.marginsVisible = value as boolean;
                this.canvasRef.current?.updateUi({ showMargins: value as boolean });

                break;
            }

            case SchemaDiagramToolbarAction.PageBordersVisible: {
                this.datamodel.document.state.pageBordersVisible = value as boolean;
                this.canvasRef.current?.updateUi({ showPageBorders: value as boolean });

                break;
            }

            case SchemaDiagramToolbarAction.Locked: {
                this.datamodel.document.state.locked = value as boolean;
                this.canvasRef.current?.updateUi({ locked: value as boolean });

                break;
            }

            case SchemaDiagramToolbarAction.SelectedTopology: {
                this.datamodel.document.state.selectedTopology = value as "logical" | "physical";

                break;
            }

            case SchemaDiagramToolbarAction.ResetView: {
                this.canvasRef.current?.updateUi({ resetView: true });

                break;
            }

            default:
        }
    }

    private generateCanvasElementsFromDataModel(app: pixi.Application): ICanvasElement[] {
        const elements: ICanvasElement[] = [];

        const element1 = this.generateElement("localhost", "localhost:3306");
        element1.element.position.set(100, 100);
        elements.push(element1);

        const element2 = this.generateElement("Omega3", "192.168.0.11:3306");
        element2.element.position.set(500, 250);

        elements.push(element2);

        const element3 = this.generateElement("woodstock", "192.168.0.13:3306");
        element3.element.position.set(900, 150);
        elements.push(element3);

        const element4 = this.generateElement("AWS", "cloud.example.com:3306");
        element4.element.position.set(120, 400);
        elements.push(element4);

        const connection1 = new Connection(element1, element2, ConnectionType.Bezier);
        const connection2 = new Connection(element2, element3, ConnectionType.Ellbow);
        const connection3 = new Connection(element4, element2, ConnectionType.Straight);
        elements.push({ element: connection1 });
        elements.push({ element: connection2 });
        elements.push({ element: connection3 });

        const diagram = this.datamodel.document;
        for (const entry of diagram.entries) {
            switch (entry.type) {
                case DdmEntityType.Table: {
                    const tableCard = new TableFigure(entry, app.renderer.events);
                    tableCard.onFigureEvent("move", (card, newX, newY) => {
                        if (entry.diagramValues.x != newX || entry.diagramValues.y != newY) {
                            entry.diagramValues.x = newX;
                            entry.diagramValues.y = newY;
                            console.log(`Table ${entry.caption} moved to new position: ${newX}/${newY}`);
                        }
                    });

                    tableCard.onFigureEvent("select", (card) => {
                        if (!entry.diagramValues.selected) {
                            entry.diagramValues.selected = true;
                            console.log(`Table ${entry.caption} selected`);
                        }
                    });

                    tableCard.onFigureEvent("unselect", (card) => {
                        if (entry.diagramValues.selected) {
                            entry.diagramValues.selected = false;
                            console.log(`Table ${entry.caption} deselected`);
                        }
                    });

                    elements.push({ element: tableCard, isDraggable: true, layout: true });
                    break;
                }

                default:
            }
        }

        return elements;
    }

    private generateElement(caption: string, subCaption: string): ICanvasElement {
        const title = new pixi.Text({
            text: caption,
            style: defaultLabelStyle,
            textureStyle: {
                scaleMode: "nearest", // Pixel-perfect scaling
            }
        });
        title.position.set(15, 10);

        const networkLabel = new pixi.Text({
            text: subCaption,
            style: defaultLabelStyle,
            textureStyle: {
                scaleMode: "nearest",
            }
        });
        networkLabel.position.set(45, 36);

        const sakila = prepareImage(mysqlConnectionIcon, { x: 190, y: 20, alpha: 0.1 });
        const network = prepareImage(networkIcon, { x: 15, y: 38, width: 20, height: 17, alpha: 0.5 });
        const tile = new class extends Figure {
            public constructor() {
                super({
                    diagramValues: {
                        x: 200 + (Math.random() * 500),
                        y: 200 + (Math.random() * 500),
                        width: 250,
                        height: 100,
                    },
                    hoverFade: 0.5,
                    children: [title, networkLabel, sakila, network],
                });
            };
        };

        return { element: tile, isDraggable: true };
    }

    private onCanvasReady = (app: pixi.Application): void => {
        this.setState({ elements: this.generateCanvasElementsFromDataModel(app) });
    };
}
