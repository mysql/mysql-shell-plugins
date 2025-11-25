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

import { getModifiers, getThemeColor, Modifier, type IDiagramValues } from "../canvas-helpers.js";
import type { ICanvasElement, ICanvasTheme } from "../Canvas.js";
import { Connection, type IConnectionHolder } from "./Connection.js";
import { Handle } from "./Handle.js";

const selectionBoxSize = 8;
const selectionBoxOffset = 4;

export interface IDrawable {
    render(): void;
}

export interface IFigureProps {
    diagramValues: IDiagramValues;

    /**
     * Determines how transparent the figure shall be on mouse hover. Can take an alpha value from 0 through 1.
     * Values >= 1 or undefined disable the hover effect.
     */
    hoverFade?: number;

    theme: ICanvasTheme;
}

/** Possible events of the figure you can subscribe to. */
export interface IFigureEventMap {
    /** The figure was selected by clicking on it. */
    select: (figure: Figure, modifiers: Set<Modifier>) => void,

    /** The figure was unselected by clicking somewhere else. */
    unselect: (figure: Figure, modifiers: Set<Modifier>) => void,

    /** The figure was resized by dragging one of the selection boxes. */
    resize: (figure: Figure, newWidth: number, newHeight: number) => void,

    /** The figure was moved by dragging it. */
    move: (figure: Figure, newX: number, newY: number) => void,

    /** The figure was collapsed to show only the header. */
    collapse: (figure: Figure) => void,

    /** The figure was expanded to show all contents. */
    expand: (figure: Figure) => void,
}

type ListenerBuckets<M extends { [K in keyof M]: M[K] }> = {
    [K in keyof M]: Array<M[K]>;
};

/** The base figure class for the canvas element hierarchy. */
export class Figure implements ICanvasElement, IConnectionHolder, IDrawable {
    /**
     * All connections going out or comming in from other figures. Used to update them when the figure moves.
     *
     * TODO: Define a primary connection holder and update only connections of that to avoid duplicates.
     */
    public connections: Connection[] = [];

    public isDraggable?: boolean;

    /**
     * The container holding the entire content. It clips everything outside.
     * Descendants should add background elements here. It's then rendered before the children.
     */
    protected content: pixi.Container;

    private children: Figure[] = [];

    /** The root container holding the content and the shadow. */
    private base = new pixi.Container();

    private shadow!: pixi.Graphics;

    private evenListeners: ListenerBuckets<IFigureEventMap> = {
        select: [],
        unselect: [],
        resize: [],
        move: [],
        collapse: [],
        expand: [],
    };

    public constructor(public props: IFigureProps) {
        const width = props.diagramValues.width;
        const height = props.diagramValues.height;

        this.content = new pixi.Container({
            boundsArea: new pixi.Rectangle(0, 0, width, height),
            layout: {
                flexDirection: "column",
            }
        });
        this.content.interactive = true;
        this.content.sortableChildren = true;
        this.base.addChild(this.content);
    }

    public get element(): pixi.Container {
        return this.base;
    }

    public get alpha(): number {
        return this.base.alpha;
    }

    public set alpha(value: number) {
        this.base.alpha = value;
    }

    public get layout(): boolean {
        return this.base.layout != null; // null or undefined means no layout
    }

    /** Switch on auto layout if not already done. This cannot be switched off. */
    public set layout(value: boolean) {
        this.base.layout ??= value;
    }

    public updateConnections(): void {
        for (const c of this.connections) {
            c.render();
        }
    }

    public get selected(): boolean {
        return !!this.props.diagramValues.selected;
    }

    public set selected(value: boolean) {
        const { diagramValues } = this.props;
        if (diagramValues.selectable && diagramValues.selected != value) {
            diagramValues.selected = value;

            if (value) {
                for (const listener of this.evenListeners.select) {
                    listener(this, new Set());
                }
                this.renderSelectionBoxes(diagramValues);
            } else {
                for (const listener of this.evenListeners.unselect) {
                    listener(this, new Set());
                }
                this.removeSelectionBoxes();
            }
        }
    }

    public updateTheme(theme: ICanvasTheme): void {
        this.props.theme = theme;
        this.render();
    }

    public render(): void {
        const { diagramValues, hoverFade, theme } = this.props;

        this.base.removeChildren();
        this.content.removeChildren();

        this.base.position.set(diagramValues.x, diagramValues.y);

        const width = diagramValues.width;
        const height = diagramValues.height;

        this.content.boundsArea = new pixi.Rectangle(0, 0, width, height);

        // First element is a shadow, unclipped.
        const shadowColor = getThemeColor(theme, "widget.shadow", "#000000");
        this.shadow = new pixi.Graphics();
        this.shadow.roundRect(0, 2, width, height, 8)
            .fill({ color: shadowColor, alpha: 0.5 });
        this.shadow.filters = [new pixi.BlurFilter({ strength: 8, quality: 4, kernelSize: 9 })];
        this.base.addChild(this.shadow);

        const clipMask = new pixi.Graphics().roundRect(0, 0, width, height, 8)
            .fill();
        this.content.mask = clipMask;
        this.content.addChild(clipMask);

        if (hoverFade !== undefined && hoverFade < 1 && hoverFade >= 0) {
            this.content.on("pointerover", () => {
                this.content.alpha = hoverFade!;
                this.shadow.alpha = 0;
            });

            this.content.on("pointerout", () => {
                this.content.alpha = 1;
                this.shadow.alpha = 0.5;
            });
        }

        const background = new pixi.Graphics();
        background.roundRect(0, 0, width, height, 8)
            .fill({ color: getThemeColor(theme, "editorPane.background", "#1e1e1e") });
        this.content.addChild(background);

        // Last regular element is a border.
        const border = new pixi.Graphics();
        border.roundRect(0, 0, width, height, 8);
        border.setStrokeStyle({ width: 2, color: getThemeColor(theme, "editorWidget.border", "#474747"), alpha: 1 })
            .stroke();
        this.content.addChild(border);

        for (const child of this.children) {
            child.updateTheme(theme);
            this.content.addChild(child.element);
        }

        this.base.addChild(this.content);

        if (diagramValues.selectable) {
            this.base.on("pointerdown", (event: pixi.FederatedPointerEvent) => {
                event.stopPropagation();
                const modifiers = getModifiers(event);

                // Toggle selection if command or shift are pressed. Otherwise only select.
                let newSelected = true;
                if (modifiers.has(Modifier.Ctrl) || modifiers.has(Modifier.Meta) || modifiers.has(Modifier.Shift)) {
                    newSelected = !diagramValues.selected;
                }

                if (newSelected != diagramValues.selected) {
                    diagramValues.selected = newSelected;
                    if (newSelected) {
                        for (const listener of this.evenListeners.select) {
                            listener(this, modifiers);
                        }
                        this.renderSelectionBoxes(diagramValues);
                    } else {
                        for (const listener of this.evenListeners.unselect) {
                            listener(this, modifiers);
                        }
                        this.removeSelectionBoxes();
                    }
                }
            });

            if (diagramValues.selected) {
                this.renderSelectionBoxes(diagramValues);
            }
        } else {
            this.content.removeAllListeners("pointerdown");
        }
    }

    /**
     * Subscribe to figure events.
     *
     * @param event The event to subscribe to.
     * @param listener The callback to call when the event occurs.
     *
     * @returns The Figure instance, for chaining.
     */
    public onFigureEvent<T extends keyof IFigureEventMap>(event: T, listener: IFigureEventMap[T]): this {
        this.evenListeners[event].push(listener);

        return this;
    }

    /**
     * Unsubscribe from figure events.
     *
     * @param event The event to unsubscribe from.
     * @param listener The callback to remove from the event.
     *
     * @returns The Figure instance, for chaining.
     */
    public offFigureEvent<T extends keyof IFigureEventMap>(event: T, listener: IFigureEventMap[T]): this {
        const index = this.evenListeners[event].indexOf(listener);
        if (index >= 0) {
            this.evenListeners[event].splice(index, 1);
        }

        return this;
    }

    /**
     * Emit an event to all listeners.
     *
     * @param event The event to emit.
     * @param args The arguments to pass to the event listeners, excluding the Figure instance itself, which is always
     *             passed as first argument.
     *
     * @returns The Figure instance, for chaining.
     */
    public emitFigureEvent<T extends keyof IFigureEventMap>(event: T,
        ...args: Parameters<IFigureEventMap[T]> extends [Figure, ...infer P] ? P : never
    ): this {
        for (const listener of this.evenListeners[event]) {
            // Combine the this-reference with args as tupel.
            (listener as (...args: unknown[]) => void).apply(null, [this, ...args]);
        }

        return this;
    }

    public addChild(...child: Figure[]): this {
        this.children.push(...child);

        return this;
    }

    public move(newX: number, newY: number): void {
        this.props.diagramValues.x = newX;
        this.props.diagramValues.y = newY;
        this.base.position.set(newX, newY);
        this.updateConnections();
    }

    public moveBy(deltaX: number, deltaY: number): void {
        this.props.diagramValues.x += deltaX;
        this.props.diagramValues.y += deltaY;
        this.base.position.set(this.props.diagramValues.x, this.props.diagramValues.y);
        this.updateConnections();
    }

    protected renderSelectionBoxes(diagramValues: IDiagramValues): void {
        const { theme } = this.props;

        const boxes: Handle[] = [];

        const selectionBoxBackgroundColor = getThemeColor(theme, "profileBadge.background", "#303030");
        const selectionBoxBorderColor = getThemeColor(theme, "profileBadge.foreground", "#ffffff");

        // Top-left
        let box = new Handle("resize")
            .rect(-selectionBoxOffset, -selectionBoxOffset, selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();

        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "nwse-resize";
        }
        boxes.push(box);

        // Top-middle
        box = new Handle("resize")
            .rect((diagramValues.width / 2) - (selectionBoxSize / 2), -selectionBoxOffset, selectionBoxSize,
                selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "ns-resize";
        }
        boxes.push(box);

        // Top-right
        box = new Handle("resize")
            .rect(diagramValues.width + selectionBoxOffset - selectionBoxSize, -selectionBoxOffset,
                selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "nesw-resize";
        }
        boxes.push(box);

        // Middle-left
        box = new Handle("resize")
            .rect(-selectionBoxOffset, (diagramValues.height / 2) - (selectionBoxSize / 2), selectionBoxSize,
                selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "ew-resize";
        }
        boxes.push(box);

        // Middle-right
        box = new Handle("resize")
            .rect(diagramValues.width + selectionBoxOffset - selectionBoxSize,
                (diagramValues.height / 2) - (selectionBoxSize / 2), selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "ew-resize";
        }
        boxes.push(box);

        // Bottom-left
        box = new Handle("resize")
            .rect(-selectionBoxOffset, diagramValues.height + selectionBoxOffset - selectionBoxSize,
                selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "nesw-resize";
        }
        boxes.push(box);

        // Bottom-right
        box = new Handle("resize")
            .rect(diagramValues.width + selectionBoxOffset - selectionBoxSize,
                diagramValues.height + selectionBoxOffset - selectionBoxSize, selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "nwse-resize";
        }
        boxes.push(box);

        // Bottom-middle
        box = new Handle("resize")
            .rect((diagramValues.width / 2) - (selectionBoxSize / 2),
                diagramValues.height + selectionBoxOffset - selectionBoxSize, selectionBoxSize, selectionBoxSize)
            .fill({ color: selectionBoxBackgroundColor })
            .setStrokeStyle({ width: 1, color: selectionBoxBorderColor }).stroke();
        if (diagramValues.resizable) {
            box.interactive = true;
            box.cursor = "ns-resize";
        }
        boxes.push(box);

        for (const box of boxes) {
            /*if (props.diagramValues.resizable) {
                box.on("pointerdown", (event: pixi.FederatedPointerEvent) => {
                    event.stopPropagation();
                    const startX = event.global.x;
                    const startY = event.global.y;
                    const startWidth = props.diagramValues.width;
                    const startHeight = props.diagramValues.height;

                    const onMove = (moveEvent: pixi.FederatedPointerEvent) => {
                        const newWidth = Math.max(50, startWidth + (moveEvent.global.x - startX));
                        const newHeight = Math.max(50, startHeight + (moveEvent.global.y - startY));
                        this.render({ width: newWidth, height: newHeight });
                        this.updateConnections();
                    };

                    const onUp = () => {
                        window.removeEventListener("pointermove", onMove as any);
                        window.removeEventListener("pointerup", onUp);
                    };

                    window.addEventListener("pointermove", onMove as any);
                    window.addEventListener("pointerup", onUp);
                });
            }*/

        }
        this.base.addChild(...boxes);
    }

    protected removeSelectionBoxes(): void {
        const handles = this.base.children.filter((c) => {
            return c instanceof Handle;
        });

        for (const handle of handles) {
            this.base.removeChild(handle);
            handle.destroy();
        }
    }
}
