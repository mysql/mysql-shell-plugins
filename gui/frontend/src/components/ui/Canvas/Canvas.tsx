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

import "./Canvas.css";

// Needed for mixins.
import "@pixi/layout";

import mysqlFontUrl from "../../../assets/fonts/MySQL.ttf";

import { type IViewportOptions, Viewport, Drag } from "pixi-viewport";
import * as pixi from "pixi.js";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { getModifiers, Modifier } from "./canvas-helpers.js";
import type { Connection } from "./Figures/Connection.js";
import { Figure } from "./Figures/Figure.js";
import { PageSettings } from "./PageSettings.js";
import { PerformanceOverlay } from "./PerformanceOverlay.js";

const debug = true;

const canvasDefaults = {
    /** Base cell size in millimeters at scale 1.0. */
    baseCellSize: 10,

    /** Distance from the edge in pixels to start scrolling when selecting or dragging. */
    edgeDistance: 20,

    /** Scroll speed in pixels per frame when selecting or dragging near the edge. */
    scrollSpeed: 10,

    /** Size of the rulers in pixels (width for the vertical ruler, height for the horizontal one). */
    rulerSize: 20,
};

const rulerTextStyle = {
    fontFamily: "SourceCodePro+Powerline+Awesome+MySQL, Helvetica Neue, Arial, sans-serif",
    fontSize: 10,
    fill: 0xFFFFFF,
};

/** Describes the layout of the grid on the canvas. */
export interface IGridSettings {
    /** The horizontal distance between two main grid lines in mm. */
    horizontalDistance: number;

    /** The vertical distance between two main grid lines in mm. */
    verticalDistance: number;

    /** The number of sub-cells between two main grid lines. */
    subCellCount: number;
}

/**
 * Possible values for the `updateUI` method of the canvas.
 * Everything is optional, but nothing will happen if no property is set.
 */
export interface ICanvasUiChanges {
    /** Reset the view to 100% zoom and top-left position. */
    resetView?: boolean,

    /** Show or hide the grid. */
    showGrid?: boolean,

    /** Show or hide the rulers. */
    showRulers?: boolean;

    /** Show or hide page borders. */
    showPageBorders?: boolean;

    /** Show or hide margins. */
    showMargins?: boolean;

    /** Change the interaction mode. */
    mode?: "pointer" | "hand" | "zoom";

    /** Lock or unlock the canvas (if locked, no interaction except zoom and pan is possible). */
    locked?: boolean;

    /** The paper format that determines the layout on the canvas.*/
    pageSettings?: PageSettings;

    /** The number of pages horizontally and vertically. */
    pageCount?: { horizontal: number, vertical: number; };
}

/** A drawable element on the canvas. */
export interface ICanvasElement {
    element: Figure | Connection;
    isDraggable?: boolean;

    /** Use the pixi-layout system. */
    layout?: boolean;
}

export interface ICanvasProperties extends IComponentProperties {
    /**
     * Maximum frames per second to render when the canvas is idle (not mouse or keyboard input and no animation).
     * Default is 60.
     */
    idleFPS?: number;

    /** A CSS color value for the background within pages. Default is "#000000" (black). */
    insideBackground?: string;

    /** A CSS color value for the background not covered by pages. Default is "#000000" (black). */
    outsideBackground?: string;

    /** Page settings that determine the page format, orientation and zoom level. Default is: no pages are shown. */
    pageSettings?: PageSettings;

    /**
     * The number of pages horizontally and vertically. Default is 1x1. This value is not used if no page
     * settings are given.
     */
    pageCount?: { horizontal: number, vertical: number; };

    /** Details of the grid. */
    gridSettings?: IGridSettings;

    /** The elements to draw on the canvas. */
    elements: ICanvasElement[];

    onCanvasReady?: (app: pixi.Application) => void;
}

/** A component to draw graphical content in a component. */
export class Canvas extends ComponentBase<ICanvasProperties> {
    public static override defaultProps: ICanvasProperties = {
        idleFPS: 60,
        insideBackground: "#000000",
        outsideBackground: "#000000",
        elements: [],
        gridSettings: {
            horizontalDistance: 10,
            verticalDistance: 10,
            subCellCount: 10,
        },
    };

    // Idle handling.
    private lastActivity = performance.now();
    private idleTimer?: ReturnType<typeof setInterval>;

    private app!: pixi.Application<pixi.Renderer>;
    private viewport?: Viewport;
    private performanceOverlay?: PerformanceOverlay;

    private grid = new pixi.Graphics();
    private outerArea = new pixi.Graphics();
    private rulers = new pixi.Container();

    private pageMarks = new pixi.Container();
    private pageBorders = new pixi.Graphics();
    private pageMargins = new pixi.Graphics();
    private pageText?: pixi.Text;

    private resizeObserver?: ResizeObserver;
    private hostRef = createRef<HTMLDivElement>();

    // Record whether the space key is currently pressed.
    private spaceDown = false;

    // Determines what happens when the primary mouse button is pressed.
    // In "normal" mode, a selection rectangle is started (if no figure is clicked).
    // In "move" mode, the viewport is dragged.
    // In "zoom" mode, zooming is done.
    //
    // Additionally there are 2 special modes:
    // - "zoom-move": Zooming is done, but if the space key is pressed, the viewport is moved.
    // - "move-zoom": The viewport is moved, but if the alt key is pressed, zooming is done.
    private pointerMode: "normal" | "move" | "zoom" | "zoom-move" | "move-zoom" = "normal";

    // Current UI mode as set by the user via UI updates. Closely follows `pointerMode`,
    // which is dynamically changed when modifier keys are pressed, and provides the mode
    // to set back when modifier keys are released.
    private uiPointerMode: "normal" | "move" | "zoom" = "normal";

    // If set to true, the canvas is locked and no interaction is possible (except zoom and pan).
    private locked = false;

    // Modifier keys currently pressed. Set on key up/down events (if no selection is active) or
    // when starting a selection.
    private currentModifierKeys = new Set<Modifier>();

    private viewportDragging = false;

    private elementDagging = false;
    private dragTarget: ICanvasElement | null = null;
    private dragOffset = { x: 0, y: 0 };

    private isSelecting = false;
    private selectionStart = { x: 0, y: 0 };
    private lastGlobalMousePosition = { x: 0, y: 0 };
    private selectionGraphic?: pixi.Graphics;

    // List of Figures which are currently in the selection rectangle.
    private lastSelectionList: Figure[] = [];

    // To block any mouse event from the canvas.
    private overlay?: pixi.Graphics;

    private appReady = false;

    public constructor(props: ICanvasProperties) {
        super(props);

        this.addHandledProperties(
            "maxFps",
            "lowFPS",
            "warmFPS",
            "fullFPS",
            "disableTickerOnMouseLeave",
            "background",
            "elements",
            "onCanvasReady",
        );
    }

    public override componentDidMount(): void {
        void this.initPixiApplication().then(() => {
            const { onCanvasReady } = this.props;

            this.hostRef.current?.appendChild(this.app.canvas);
            onCanvasReady?.(this.app);
        });
    }

    public override componentDidUpdate(): void {
        if (!this.appReady || !this.viewport) {
            return;
        }

        const { elements } = this.props;

        this.viewport.removeChildren();
        const drawables = elements.map((o) => {
            return o.element;
        });

        const draggables: ICanvasElement[] = [];
        elements.forEach((o) => {
            if (o.layout && !o.element.layout) {
                o.element.layout = true;
            }

            if (o.isDraggable) {
                draggables.push(o);

                o.element.interactive = true;
                o.element.eventMode = "static";
                o.element.cursor = "grab";
                o.element.on("pointerdown", (event: pixi.FederatedPointerEvent) => {
                    if (!this.locked && event.buttons === 1) {
                        this.lastGlobalMousePosition = new pixi.Point(event.global.x, event.global.y);
                        this.elementDagging = true;
                        this.dragTarget = o;
                        this.dragOffset = o.element.parent ? event.getLocalPosition(o.element.parent) : { x: 0, y: 0 };
                        event.stopPropagation();

                        this.autoScroll();
                    }
                });

                if (o.element instanceof Figure) {
                    o.element.onFigureEvent("select", (figure, modifiers) => {
                        if (!this.locked) {
                            if (modifiers.has(Modifier.Ctrl) || modifiers.has(Modifier.Meta)
                                || modifiers.has(Modifier.Shift)) {
                                // Toggle selection, already handled by the Figure.
                            } else if (!this.isSelecting) {
                                this.unselectAll(figure);
                            }
                        }
                    });
                }
            }
        });

        this.viewport.addChild(this.outerArea, this.grid, this.pageMarks);
        this.drawGrid();
        this.drawPageBordersAndMargins();

        const root = new pixi.Container();
        root.zIndex = 10;
        root.sortableChildren = true;
        this.viewport.addChild(root);
        root.addChild(...drawables);
    }

    public override componentWillUnmount(): void {
        if (this.idleTimer) {
            clearInterval(this.idleTimer);
        }

        this.performanceOverlay?.dispose();
        this.stopInteraction();
        if (this.resizeObserver && this.hostRef.current) {
            this.resizeObserver.unobserve(this.hostRef.current);
        }

        this.app.destroy(true, { children: true, texture: true });
        this.viewport = undefined;
    }

    public render(): ComponentChild {
        return (
            <Container
                className={this.getEffectiveClassNames(["canvas"])}
                innerRef={this.hostRef}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Stretch}
                {...this.unhandledProperties}
            />
        );
    }

    /**
     * Used to update the canvas presentation. This is usually called from the host of the canvas,
     * in response to user actions.
     *
     * @param changes One or more changes to apply.
     */
    public updateUi(changes: ICanvasUiChanges): void {
        this.lastActivity = performance.now();

        this.stopInteraction();
        this.spaceDown = false;

        if (changes.showRulers != undefined && this.rulers.visible !== changes.showRulers) {
            this.rulers.visible = changes.showRulers;

            if (this.viewport) {
                if (changes.showRulers) {
                    this.viewport.x += canvasDefaults.rulerSize;
                    this.viewport.y += canvasDefaults.rulerSize;
                } else {
                    this.viewport.x -= canvasDefaults.rulerSize;
                    this.viewport.y -= canvasDefaults.rulerSize;
                }
            }
        }

        if (changes.showGrid != undefined && this.grid.visible !== changes.showGrid) {
            this.grid.visible = changes.showGrid;
            this.drawGrid();
        }

        if (changes.showMargins != undefined && this.pageMargins.visible !== changes.showMargins) {
            this.pageMargins.visible = changes.showMargins;
        }

        if (changes.showPageBorders != undefined && this.pageBorders.visible !== changes.showPageBorders) {
            this.pageBorders.visible = changes.showPageBorders;
            this.pageText!.visible = changes.showPageBorders;
            this.drawGrid();
        }

        const offsetX = this.rulers.visible ? canvasDefaults.rulerSize : 0;
        const offsetY = this.rulers.visible ? canvasDefaults.rulerSize : 0;
        if (changes.resetView) {
            if (this.viewport) {
                this.viewport.x = offsetX;
                this.viewport.y = offsetY;
                this.viewport.scale.set(1.0);
                this.drawGrid();
                this.drawPageBordersAndMargins();
                this.drawRulers();
            }
        }

        if (changes.mode != undefined) {
            if (changes.mode === "pointer") {
                this.uiPointerMode = "normal";
            } else if (changes.mode === "hand") {
                this.uiPointerMode = "move";
            } else {
                this.uiPointerMode = "zoom";
            }

            this.returnToCurrentUiPointerMode();
        }

        if (changes.locked !== undefined) {
            this.locked = changes.locked;
        }
    }

    private handleResize = (entries: readonly ResizeObserverEntry[]): void => {
        if (entries.length > 0) {
            this.viewport?.resize(
                entries[0].contentRect.width,
                entries[0].contentRect.height,
            );
        }
    };

    private async initPixiApplication(): Promise<void> {
        const { insideBackground: background } = this.props;

        await pixi.Assets.load(mysqlFontUrl);

        this.app = new pixi.Application<pixi.Renderer>();

        const appOptions: Partial<pixi.ApplicationOptions> = {
            powerPreference: "high-performance",

            // "webgl" for debugging in browsers (Pixi DevTools), "webgpu" for performance (if available)
            preference: "webgpu",
            antialias: false,
            backgroundColor: background,
            sharedTicker: false,
            resizeTo: this.hostRef.current ?? undefined,
            autoDensity: true,
            resolution: window.devicePixelRatio,
            roundPixels: true,
        };

        await this.app.init(appOptions);
        this.app.ticker.minFPS = 5;

        const viewportOptions: IViewportOptions = {
            events: this.app.renderer.events,
            allowPreserveDragOutside: true,
        };

        this.viewport = new Viewport(viewportOptions);
        this.viewport.sortableChildren = true;
        this.viewport.wheel().clampZoom({ minScale: 0.1, maxScale: 2 });

        this.app.stage.addChild(this.viewport);
        this.updateDraggingMode("space");

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (debug) {
            this.performanceOverlay = new PerformanceOverlay(this.app);
        }

        this.viewport.addChild(this.outerArea, this.grid, this.pageMarks);
        this.outerArea.zIndex = 1;
        this.grid.zIndex = 2;
        this.pageMarks.zIndex = 3;

        this.app.stage.addChild(this.rulers);
        this.rulers.zIndex = 2000;

        this.updateUi({ resetView: true });

        this.app.stage.eventMode = "static";

        window.addEventListener("keydown", (event) => {
            this.lastActivity = performance.now();

            // Debounce keys (mostly "space") to avoid multiple events when held down.
            if (event.repeat) {
                return;
            }

            if (event.code === "Escape") {
                this.returnToCurrentUiPointerMode();

                return;
            }

            this.currentModifierKeys = getModifiers(event);
            switch (this.uiPointerMode) {
                case "move": {
                    // In move mode, allow zooming temporarily.
                    if (this.currentModifierKeys.has(Modifier.Alt)
                        || this.currentModifierKeys.has(Modifier.Meta)) {
                        this.pointerMode = "move-zoom";
                        this.updateDraggingMode("disabled");
                        if (this.currentModifierKeys.has(Modifier.Alt)) {
                            this.updateActiveCursor("zoom-out");
                        } else {
                            this.updateActiveCursor("zoom-in");
                        }
                    }

                    break;
                }

                case "zoom": {
                    if (event.code === "Space") {
                        // In zoom mode, allow moving temporarily.
                        this.spaceDown = true;
                        this.pointerMode = "zoom-move";
                        this.updateActiveCursor("grab");
                        this.updateDraggingMode("space", true);
                    } else if (!this.spaceDown) {
                        if (this.currentModifierKeys.has(Modifier.Alt)) {
                            this.updateActiveCursor("zoom-out");
                        } else {
                            this.updateActiveCursor("zoom-in");
                        }
                    }

                    break;
                }

                default: { // Normal mode.
                    if (!this.isSelecting) {
                        switch (event.code) {
                            case "Space": {
                                // Set the cursor to grabbing, if the use pressed the space key.
                                if (!this.spaceDown) {
                                    this.spaceDown = true;
                                    this.pointerMode = "move";
                                    this.updateActiveCursor("grab");
                                } else if (this.currentModifierKeys.has(Modifier.Alt)
                                    || this.currentModifierKeys.has(Modifier.Meta)) {
                                    // In normal mode, when the space key is already down,
                                    // allow zooming temporarily.
                                    this.pointerMode = "move-zoom";
                                    if (this.currentModifierKeys.has(Modifier.Alt)) {
                                        this.updateActiveCursor("zoom-out");
                                    } else {
                                        this.updateActiveCursor("zoom-in");
                                    }
                                }

                                break;
                            }

                            default:
                        }
                    }
                }
            }

        });

        this.idleTimer = setInterval(() => {
            this.checkIdleState();
        }, 500);

        window.addEventListener("keyup", (event) => {
            this.lastActivity = performance.now();
            this.currentModifierKeys = getModifiers(event);

            if (event.code === "Space") {
                this.spaceDown = false;
            }

            if (this.isSelecting) {
                return;
            }

            if (!this.spaceDown && this.currentModifierKeys.size === 0) {
                this.returnToCurrentUiPointerMode();

                return;
            }
        });

        this.viewport.on("moved", () => {
            this.lastActivity = performance.now();

            // Both grid and page marks are children of the viewport and are moved automatically.
            // However, we need to redraw them as parts of them might have become visible or invisible.
            this.drawGrid();
            this.drawPageBordersAndMargins();

            this.drawRulers();
        });

        this.viewport.on("drag-start", () => {
            this.lastActivity = performance.now();
            this.viewportDragging = true;
            this.updateActiveCursor("grabbing");
        });

        this.viewport.on("drag-end", () => {
            this.lastActivity = performance.now();
            this.viewportDragging = false;

            if (this.pointerMode === "normal") {
                if (this.spaceDown) {
                    this.updateActiveCursor("grab");
                } else {
                    this.updateActiveCursor("default");
                }
            } else {
                this.updateActiveCursor("grab");
            }
        });

        this.app.stage.on("pointerdown", (event: pixi.FederatedPointerEvent) => {
            if (!this.viewport) {
                return;
            }

            this.lastActivity = performance.now();
            switch (this.pointerMode) {
                case "zoom-move":
                case "move": {
                    // Handled by pixi-viewport.
                    break;
                }

                case "move-zoom":
                case "zoom": {
                    if (event.buttons === 1) {
                        const modifiers = getModifiers(event);
                        const delta = modifiers.has(Modifier.Alt) ? -0.1 : 0.1;
                        const before = this.viewport.toWorld(event.global.x, event.global.y);
                        this.viewport.zoomPercent(delta, false);
                        const after = this.viewport.toWorld(event.global.x, event.global.y);

                        const dx = after.x - before.x;
                        const dy = after.y - before.y;
                        this.viewport.moveCorner(this.viewport.corner.x - dx, this.viewport.corner.y - dy);

                        this.drawGrid();
                        this.drawPageBordersAndMargins();
                        this.drawRulers();
                    }

                    break;
                }

                default: {
                    if (event.buttons === 1 && !this.elementDagging && !this.spaceDown) {
                        this.currentModifierKeys = getModifiers(event);

                        if (!(this.currentModifierKeys.has(Modifier.Ctrl) || this.currentModifierKeys.has(Modifier.Meta)
                            || this.currentModifierKeys.has(Modifier.Shift))) {
                            this.unselectAll();
                        }

                        this.isSelecting = true;
                        this.selectionStart = this.viewport.toWorld(event.global.x, event.global.y);

                        this.selectionGraphic = new pixi.Graphics();
                        this.selectionGraphic.zIndex = 100;
                        this.viewport.addChild(this.selectionGraphic);

                        this.overlay = new pixi.Graphics();
                        this.overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
                        this.overlay.fill({ color: 0x0, alpha: 0 });
                        this.overlay.interactive = true;
                        this.lastGlobalMousePosition = new pixi.Point(event.global.x, event.global.y);

                        this.app.stage.addChild(this.overlay);

                        this.selectionGraphic.clear();
                        this.selectionGraphic.rect(this.selectionStart.x, this.selectionStart.y, 1, 1);
                        this.selectionGraphic
                            .fill({ color: "#57b8fd", alpha: 0.25 })
                            .stroke({ width: 1, color: "#0095ff", alpha: 0.5 });

                        this.autoScroll();
                    }

                    break;
                }
            }
        });

        // Note: globalpointermove is called even when the mouse is outside the canvas.
        this.app.stage.on("globalpointermove", (event) => {
            // Restart the idle time only, if the mouse is within the application bounds.
            if (event.global.x >= 0 && event.global.y >= 0 && event.global.x < this.app.renderer.width
                && event.global.y < this.app.renderer.height) {
                this.lastActivity = performance.now();
            }

            this.lastGlobalMousePosition = new pixi.Point(event.global.x, event.global.y);
            if (this.elementDagging && this.dragTarget) {
                const element = this.dragTarget.element;
                const newPosition = event.getLocalPosition(element.parent!);
                const deltaX = newPosition.x - this.dragOffset.x;
                const deltaY = newPosition.y - this.dragOffset.y;

                element.x += deltaX;
                element.y += deltaY;
                this.dragOffset = newPosition;

                if (element instanceof Figure) {
                    element.emitFigureEvent("move", this.dragTarget.element.x, this.dragTarget.element.y);
                    element.updateConnections();
                }

                // Move also other selected elements.
                const { elements } = this.props;
                elements.forEach((o) => {
                    if (o.element instanceof Figure && o.element.selected && o.element !== element) {
                        o.element.x += deltaX;
                        o.element.y += deltaY;

                        o.element.updateConnections();
                        o.element.emitFigureEvent("move", o.element.x, o.element.y);
                    }
                });
            } else if (this.isSelecting) {
                this.drawSelectionRectangle();
            }
        });

        this.app.stage.on("pointerup", this.stopInteraction);
        this.app.stage.on("pointercancel", this.stopInteraction);
        this.app.stage.on("pointerupoutside", this.stopInteraction);

        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.hostRef.current!);
        }

        this.appReady = true;
    }

    private drawGrid() {
        if (!this.viewport) {
            return;
        }

        const {
            pageSettings, pageCount = { horizontal: 1, vertical: 1 }, gridSettings, outsideBackground
        } = this.props;

        this.grid.clear();
        this.outerArea.clear();

        const scale = this.viewport.scale.x;

        // Note: the rulers are children of the viewport and have to be drawn with viewport coordinates.
        let left = this.viewport.left;
        let top = this.viewport.top;
        let right = this.viewport.right;
        let bottom = this.viewport.bottom;

        let viewWidth = this.viewport.worldWidth;
        let viewHeight = this.viewport.worldHeight;

        // Restrict the view to the page area, if pages are shown. Also determine grid margins and cell dimensions.
        if (pageSettings && this.pageBorders.visible) {
            viewWidth = Math.floor(this.mmToPixels(pageSettings.pageWidth * pageCount.horizontal));
            viewHeight = Math.floor(this.mmToPixels(pageSettings.pageHeight * pageCount.vertical));

            // Fill the area outside the pages with dark gray.
            if (left < 0) {
                this.outerArea.rect(left, top, -left, bottom - top).fill({ color: outsideBackground });
            }

            if (right > viewWidth) {
                this.outerArea.rect(viewWidth, top, right - viewWidth, bottom - top).fill({ color: outsideBackground });
            }

            if (top < 0) {
                this.outerArea.rect(0, top, viewWidth, -top).fill({ color: outsideBackground });
            }

            if (bottom > viewHeight) {
                this.outerArea.rect(0, viewHeight, viewWidth, bottom - viewHeight).fill({ color: outsideBackground });
            }

            // Restrict the grid to the page area.
            if (left < 0) {
                left = 0;
            }

            if (top < 0) {
                top = 0;
            }

            if (right > viewWidth) {
                right = viewWidth;
            }

            if (bottom > viewHeight) {
                bottom = viewHeight;
            }
        }

        let lineCount = 0;

        // Compute everything in mm first to avoid rounding errors, then convert to pixels.

        let verticalDistance = gridSettings?.verticalDistance ?? canvasDefaults.baseCellSize;
        if (verticalDistance <= 1) {
            verticalDistance = canvasDefaults.baseCellSize;
        }

        let horizontalDistance = gridSettings?.horizontalDistance ?? canvasDefaults.baseCellSize;
        if (horizontalDistance <= 1) {
            horizontalDistance = canvasDefaults.baseCellSize;
        }

        let horizontalSubCellSize = horizontalDistance / (gridSettings?.subCellCount ?? 10);
        let verticalSubCellSize = verticalDistance / (gridSettings?.subCellCount ?? 10);

        // Convert to pixels and round to the nearest integer.
        horizontalSubCellSize = Math.floor(this.mmToPixels(horizontalSubCellSize));
        const horizontalMainCellSize = Math.floor(this.mmToPixels(horizontalDistance));
        verticalSubCellSize = Math.floor(this.mmToPixels(verticalSubCellSize));
        const verticalMainCellSize = Math.floor(this.mmToPixels(verticalDistance));

        // Draw the subgrid first. But only if the zoom level is high enough (> 0.6).
        if (scale > 0.6) {
            // Horizontal lines.
            for (let y = Math.floor(top / verticalSubCellSize) * verticalSubCellSize; y < bottom;
                y += verticalSubCellSize) {
                if (y >= top && y < bottom) {
                    this.grid.moveTo(left, y);
                    this.grid.lineTo(right, y);
                    ++lineCount;
                }
            }

            // Vertical lines.
            for (let x = Math.floor(left / horizontalSubCellSize) * horizontalSubCellSize; x < right;
                x += horizontalSubCellSize) {
                if (x >= left && x < right) {
                    this.grid.moveTo(x, top);
                    this.grid.lineTo(x, bottom);
                    ++lineCount;
                }
            }

            this.grid.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.1, pixelLine: true });
        }

        // Then the main grid (which draws over the subgrid).

        // Horizontal lines.
        for (let y = Math.floor(top / verticalMainCellSize) * verticalMainCellSize; y < bottom;
            y += verticalMainCellSize) {
            this.grid.moveTo(left, y);
            this.grid.lineTo(right, y);
            ++lineCount;
        }

        // Vertical lines.
        for (let x = Math.floor(left / horizontalMainCellSize) * horizontalMainCellSize; x < right;
            x += horizontalMainCellSize) {
            this.grid.moveTo(x, top);
            this.grid.lineTo(x, bottom);
            ++lineCount;
        }

        this.grid.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.25, pixelLine: true });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (debug) {
            console.log(`Grid lines: ${lineCount}, scale: ${this.viewport.scale.x}`);
        }
    }

    private drawPageBordersAndMargins() {
        const { pageSettings, pageCount } = this.props;
        if (!this.viewport || !pageSettings) {
            return;
        }

        this.pageMarks.removeChildren();

        let visible = this.pageBorders.visible;
        this.pageBorders = new pixi.Graphics();
        this.pageBorders.visible = visible;
        this.pageMarks.addChild(this.pageBorders);

        visible = this.pageMargins.visible;
        this.pageMargins = new pixi.Graphics();
        this.pageMargins.visible = visible;
        this.pageMarks.addChild(this.pageMargins);

        // Note: the page borders are children of the viewport and have to be drawn with viewport coordinates.
        const left = this.viewport.left;
        const top = this.viewport.top;
        const right = this.viewport.right;
        const bottom = this.viewport.bottom;

        const pageWidth = this.mmToPixels(pageSettings.pageWidth);
        const pageHeight = this.mmToPixels(pageSettings.pageHeight);

        if (pageWidth <= 0 || pageHeight <= 0) {
            return;
        }

        const { left: marginLeft, top: marginTop, right: marginRight, bottom: marginBottom } =
            pageSettings.getMargins();

        for (let i = 0; i < (pageCount?.horizontal ?? 1); ++i) {
            for (let j = 0; j < (pageCount?.vertical ?? 1); ++j) {
                const x = i * pageWidth;
                const y = j * pageHeight;

                if (x + pageWidth < left || x > right || y + pageHeight < top || y > bottom) {
                    continue;
                }

                this.pageBorders.rect(Math.floor(x), Math.floor(y), Math.floor(pageWidth), Math.floor(pageHeight))
                    .stroke({ width: 1, color: 0xC0C0C0, alpha: 1, pixelLine: true });

                // Draw margins.
                if (marginLeft > 0 && + marginRight > 0 && marginTop > 0 && marginBottom > 0) {
                    const marginLeftPx = this.mmToPixels(marginLeft);
                    const marginRightPx = this.mmToPixels(marginRight);
                    const marginTopPx = this.mmToPixels(marginTop);
                    const marginBottomPx = this.mmToPixels(marginBottom);

                    this.pageMargins.rect(
                        Math.floor(x + marginLeftPx),
                        Math.floor(y + marginTopPx),
                        Math.floor(pageWidth - marginLeftPx - marginRightPx),
                        Math.floor(pageHeight - marginTopPx - marginBottomPx),
                    ).stroke({ width: 1, color: 0x57A0E5, alpha: 1, pixelLine: true });
                }
            }
        }

        visible = this.pageText?.visible ?? false;
        this.pageText = new pixi.Text({
            text: `Page size: ${pageSettings.pageWidth} mm x ${pageSettings.pageHeight} mm (${pageSettings.name})`,
            style: { ...rulerTextStyle, fill: "#C0C0C0" },
            textureStyle: { scaleMode: "nearest", },
        });

        this.pageText.visible = visible;
        this.pageText.position.set(0, -15);
        this.pageMarks.addChild(this.pageText);

        this.pageBorders.stroke({ width: 1, color: 0xC0C0C0 });
    }

    private drawRulers() {
        if (!this.viewport) {
            return;
        }

        this.rulers.removeChildren();
        const bars = this.rulers.addChild(new pixi.Graphics());

        const scale = this.viewport.scale.x;

        // Note: the rulers are not children of the viewport and have to be drawn with world coordinates.
        const left = this.pixelsToMm(this.viewport.left);
        const top = this.pixelsToMm(this.viewport.top);
        const right = this.pixelsToMm(this.viewport.right);
        const bottom = this.pixelsToMm(this.viewport.bottom);

        let mainCellSize = canvasDefaults.baseCellSize;
        let subCellSize = mainCellSize / 10;

        while (mainCellSize * scale < canvasDefaults.baseCellSize / 2) {
            mainCellSize *= 2;
        }

        while (mainCellSize * scale > 2 * canvasDefaults.baseCellSize) {
            mainCellSize /= 2;
        }

        mainCellSize = Math.round(mainCellSize * 100) / 100;
        subCellSize = Math.round(mainCellSize / 10);

        // Horizontal ruler background.
        bars.rect(0, 0, this.app.screen.width, 20).fill({ color: 0x222222, alpha: 0.9 });

        // Vertical ruler background.
        bars.rect(0, canvasDefaults.rulerSize, canvasDefaults.rulerSize,
            this.app.screen.height - canvasDefaults.rulerSize)
            .fill({ color: 0x222222, alpha: 0.9 });

        // Ruler lines and labels.
        bars.setStrokeStyle({ width: 1, color: 0xFFFFFF, alpha: 0.5, pixelLine: true });

        // Horizontal labels and ticks.
        for (let x = Math.floor(left / subCellSize) * subCellSize; x < right; x += subCellSize) {
            const screenPos = this.viewport.toScreen(this.mmToPixels(x), 0);
            if (screenPos.x < canvasDefaults.rulerSize) {
                // Left to the right edge of the vertical ruler.
                continue;
            }

            if (Math.abs(x % mainCellSize) < 0.01) {
                bars.moveTo(screenPos.x, canvasDefaults.rulerSize);
                bars.lineTo(screenPos.x, canvasDefaults.rulerSize / 2);
                const text = new pixi.Text({
                    text: `${Math.round(x)}`,
                    style: rulerTextStyle,
                    textureStyle: { scaleMode: "nearest", },
                });

                text.position.set(screenPos.x + 2, 2);
                this.rulers.addChild(text);
            } else {
                bars.moveTo(screenPos.x, canvasDefaults.rulerSize);
                bars.lineTo(screenPos.x, 3 * canvasDefaults.rulerSize / 4);

            }
        }

        // Vertical labels and ticks.
        for (let y = Math.floor(top / subCellSize) * subCellSize; y < bottom; y += subCellSize) {
            const screenPos = this.viewport.toScreen(0, this.mmToPixels(y));
            if (screenPos.y < canvasDefaults.rulerSize) {
                continue;
            }

            if (Math.abs(y % mainCellSize) < 0.01) {
                bars.moveTo(canvasDefaults.rulerSize, screenPos.y);
                bars.lineTo(canvasDefaults.rulerSize / 2, screenPos.y);

                const text = new pixi.Text({
                    text: `${Math.round(y)}`,
                    style: { ...rulerTextStyle, ...{ align: "right" as const } },
                    textureStyle: { scaleMode: "nearest", },
                });

                text.position.set(2, screenPos.y + 2);
                text.rotation = -Math.PI / 2;
                this.rulers.addChild(text);
            } else {
                bars.moveTo(canvasDefaults.rulerSize, screenPos.y);
                bars.lineTo(3 * canvasDefaults.rulerSize / 4, screenPos.y);
            }
        }

        bars.stroke();
    }

    private stopInteraction = (): void => {
        this.lastSelectionList = [];
        if (this.elementDagging && this.dragTarget) {
            const element = this.dragTarget.element;
            if (element instanceof Figure) {
                element.emitFigureEvent("move", element.x, element.y);
            }

            this.elementDagging = false;
            this.dragTarget = null;
        } else if (this.isSelecting) {
            this.isSelecting = false;
            if (this.selectionGraphic) {
                this.selectionGraphic.clear();
                this.app.stage.removeChild(this.selectionGraphic);
                this.selectionGraphic = undefined;
            }

            if (this.overlay) {
                this.app.stage.removeChild(this.overlay);
                this.overlay = undefined;
            }
        }
    };

    private autoScroll = () => {
        if (this.isSelecting || this.elementDagging) {
            this.lastActivity = performance.now();

            let needRedraw = false;
            const x = this.lastGlobalMousePosition.x;
            const y = this.lastGlobalMousePosition.y;

            if (x < canvasDefaults.edgeDistance) {
                const diff = canvasDefaults.edgeDistance - x;
                this.viewport!.x += canvasDefaults.scrollSpeed * diff / canvasDefaults.edgeDistance;
                needRedraw = true;
            } else if (x > this.app.screen.width - canvasDefaults.edgeDistance) {
                const diff = x - (this.app.screen.width - canvasDefaults.edgeDistance);
                this.viewport!.x -= canvasDefaults.scrollSpeed * diff / canvasDefaults.edgeDistance;
                needRedraw = true;
            }

            if (y < canvasDefaults.edgeDistance) {
                const diff = canvasDefaults.edgeDistance - y;
                this.viewport!.y += canvasDefaults.scrollSpeed * diff / canvasDefaults.edgeDistance;
                needRedraw = true;
            } else if (y > this.app.screen.height - canvasDefaults.edgeDistance) {
                const diff = y - (this.app.screen.height - canvasDefaults.edgeDistance);
                this.viewport!.y -= canvasDefaults.scrollSpeed * diff / canvasDefaults.edgeDistance;
                needRedraw = true;
            }

            if (needRedraw) {
                this.drawSelectionRectangle();
                this.drawGrid();
                this.drawPageBordersAndMargins();
                this.drawRulers();
            }

            requestAnimationFrame(this.autoScroll);
        }
    };

    private drawSelectionRectangle() {
        if (this.isSelecting && this.viewport) {
            const { x, y, width, height } = this.computeSelectionRectangle();

            this.selectionGraphic!.clear();
            this.selectionGraphic!.rect(x, y, width, height);
            this.selectionGraphic!
                .fill({ color: "#57b8fd", alpha: 0.25 })
                .stroke({ width: 1, color: "#0095ff", alpha: 0.5 });

            // Determine the list of figures within the selection rectangle and compare it to the
            // last selection. If it changed, select, unselect or toggle the selection as needed,
            // depending on the modifier keys pressed when selection started.
            const { elements } = this.props;
            const toggle = this.currentModifierKeys.has(Modifier.Ctrl) || this.currentModifierKeys.has(Modifier.Meta)
                || this.currentModifierKeys.has(Modifier.Shift);

            const newSelectionList: Figure[] = [];
            elements.forEach((o) => {
                if (o.element instanceof Figure) {
                    const figureBounds = o.element.getBounds();
                    const viewportPos = this.viewport!.toWorld(figureBounds.x, figureBounds.y);
                    const intersects = x < (viewportPos.x + figureBounds.width)
                        && (x + width) > viewportPos.x
                        && y < (viewportPos.y + figureBounds.height)
                        && (y + height) > viewportPos.y;

                    if (intersects) {
                        newSelectionList.push(o.element);
                    }
                }
            });

            const added = newSelectionList.filter((o) => {
                return !this.lastSelectionList.includes(o);
            });

            const removed = this.lastSelectionList.filter((o) => {
                return !newSelectionList.includes(o);
            });

            if (added.length > 0 || removed.length > 0) {
                if (toggle) {
                    added.forEach((o) => {
                        o.selected = !o.selected;
                    });

                    removed.forEach((o) => {
                        o.selected = !o.selected;
                    });
                } else {
                    added.forEach((o) => {
                        o.selected = true;
                    });

                    removed.forEach((o) => {
                        o.selected = false;
                    });
                }

                this.lastSelectionList = newSelectionList;
            }
        }
    }

    private computeSelectionRectangle(): pixi.Rectangle {
        const currentPosition = this.viewport!.toWorld(this.lastGlobalMousePosition);
        const x = Math.min(this.selectionStart.x, currentPosition.x);
        const y = Math.min(this.selectionStart.y, currentPosition.y);
        const width = Math.abs(this.selectionStart.x - currentPosition.x);
        const height = Math.abs(this.selectionStart.y - currentPosition.y);

        return new pixi.Rectangle(x, y, width, height);
    }

    /**
     * Rewmoves the selection from all figures, except the given one (if any).
     *
     * @param figure The figure which should not be unselected.
     */
    private unselectAll(figure?: Figure): void {
        if (!this.viewport) {
            return;
        }

        const { elements } = this.props;
        elements.forEach((o) => {
            if ((o.element !== figure) && (o.element instanceof Figure)) {
                o.element.selected = false;
            }
        });
    }

    private updateDraggingMode(mode: "disabled" | "space" | "always", keyIsPressed?: boolean): void {
        if (!this.viewport) {
            return;
        }

        this.viewport.plugins.remove("drag");
        if (mode === "disabled") {
            return;
        }

        const drag = new InstantDrag(this.viewport, {
            wheel: false,          // Don't drag with wheel, by default.
            mouseButtons: "left",
            keyToPress: mode === "always" ? undefined : ["Space"], // Hold space to drag the viewport or do it always.
        });
        this.viewport.plugins.add("drag", drag);

        if (keyIsPressed) {
            drag.keyIsPressed = true;
        }
    }

    private checkIdleState(): void {
        const { idleFPS } = this.props;

        if (this.lastActivity + 5000 < performance.now()) {
            this.app.ticker.maxFPS = idleFPS ?? 5;
        } else {
            this.app.ticker.maxFPS = 60;
        }
        this.performanceOverlay?.update();
    }

    /**
     * Sets the new viewport cursor. To have an immediate effect, the canvas cursor style is also updated.
     * Otherwise the update happens only when the mouse is moved.
     *
     * @param cursor The new cursor to set.
     */
    private updateActiveCursor(cursor: pixi.Cursor): void {
        this.viewport!.cursor = cursor;
        this.app.renderer.canvas.style.cursor = cursor;
    }

    /**
     * Converts millimeters to pixels, taking the current zoom level into account.
     * A static 120 DPI is assumed. For better pixel alignment, 24 mm is used as base unit
     * (instead of 25.4mm for an inch).
     *
     * @param mm The value in millimeters.
     *
     * @returns The value in pixels.
     */
    private mmToPixels(mm: number): number {
        return mm / 24 * 120 * (this.props.pageSettings?.scale ?? 1);
    }

    /**
     * Converts pixels to millimeters, taking the current zoom level into account.
     * A static 120 DPI is assumed. For better pixel alignment, 24 mm is used as base unit
     * (instead of 25.4mm for an inch).
     *
     * @param pixels The value in pixels.
     *
     * @returns The value in millimeters.
     */
    private pixelsToMm(pixels: number): number {
        return pixels * 24 / 120 / (this.props.pageSettings?.scale ?? 1);
    }

    private returnToCurrentUiPointerMode() {
        this.pointerMode = this.uiPointerMode;
        this.stopInteraction();

        this.spaceDown = false;
        this.currentModifierKeys.clear();

        switch (this.pointerMode) {
            case "move": {
                this.updateDraggingMode("always");
                this.updateActiveCursor("grab");

                break;
            }

            case "zoom": {
                this.updateDraggingMode("disabled");
                this.updateActiveCursor("zoom-in");

                break;
            }

            default: {
                this.updateDraggingMode("space");
                this.updateActiveCursor("default");

                break;
            }

        }
    }
}

/**
 * A simple class to allow us to access the keyIsPressed member, which we need when adding the drag plugin,
 * while hnandling the "space" key for dragging.
 */
class InstantDrag extends Drag {
    declare public keyIsPressed: boolean;
}
