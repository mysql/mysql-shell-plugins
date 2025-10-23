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

import { getModifiers, Modifier, type IDiagramValues } from "../canvas-helpers.js";
import { Connection, type IConnectionHolder } from "./Connection.js";
import { Handle } from "./Handle.js";
import type { DeepPartial } from "../../../../app-logic/general-types.js";

const selectionBoxSize = 8;
const selectionBoxOffset = 4;
const selectionBoxBackgroundColor = "#303030";
const selectionBoxBorderColor = "#ffffff";

export interface IFigureProps {
    diagramValues: IDiagramValues;

    /**
     * Determines how transparent the figure shall be on mouse hover. Can take an alpha value from 0 through 1.
     * Values >= 1 or undefined disable the hover effect.
     */
    hoverFade?: number;

    children: pixi.Container[];
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

export class Figure extends pixi.Container implements IConnectionHolder {
    /** All connections going out or comming in from other figures. Used to update them when the figure moves. */
    public connections: Connection[] = [];

    protected root!: pixi.Container;

    private shadow!: pixi.Graphics;

    private evenListeners: ListenerBuckets<IFigureEventMap> = {
        select: [],
        unselect: [],
        resize: [],
        move: [],
        collapse: [],
        expand: [],
    };

    public constructor(private props: IFigureProps) {
        super();
        this.interactive = true;

        this.render();
    }

    public updateConnections(): void {
        for (const c of this.connections) {
            c.update();
        }
    }

    public get selected(): boolean {
        return !!this.props.diagramValues.selected;
    }

    public set selected(value: boolean) {
        if (this.props.diagramValues.selectable && this.props.diagramValues.selected != value) {
            this.props.diagramValues.selected = value;

            if (value) {
                for (const listener of this.evenListeners.select) {
                    listener(this, new Set());
                }
                this.renderSelectionBoxes(this.props.diagramValues);
            } else {
                for (const listener of this.evenListeners.unselect) {
                    listener(this, new Set());
                }
                this.removeSelectionBoxes();
            }
        }
    }

    public render(props?: DeepPartial<IFigureProps>): void {
        this.removeChildren();
        const effectiveProps = { ...this.props, ...props };
        const width = effectiveProps.diagramValues.width ?? 100;
        const height = effectiveProps.diagramValues.height ?? 200;

        // First element is a shadow, unclipped.
        this.shadow = new pixi.Graphics();
        this.shadow.roundRect(0, 2, width, height, 8)
            .fill({ color: 0x000000, alpha: 0.5 });
        this.shadow.filters = [new pixi.BlurFilter({ strength: 8, quality: 4, kernelSize: 9 })];
        this.addChild(this.shadow);

        // Then the content, clipped.
        this.root = new pixi.Container({
            boundsArea: new pixi.Rectangle(0, 0, width, height),
            layout: {
                flexDirection: "column",
            }
        });

        const clipMask = new pixi.Graphics().roundRect(0, 0, width, height, 8)
            .fill();
        this.root.mask = clipMask;
        this.root.addChild(clipMask);

        if (effectiveProps.hoverFade !== undefined && effectiveProps.hoverFade < 1 && effectiveProps.hoverFade >= 0) {
            this.on("pointerover", () => {
                this.alpha = effectiveProps.hoverFade!;
                this.shadow.alpha = 0;
            });

            this.on("pointerout", () => {
                this.alpha = 1;
                this.shadow.alpha = 0.5;
            });
        }

        const background = new pixi.Graphics();
        background.roundRect(0, 0, width, height, 8)
            .fill({ color: 0x1e1e1e });
        this.addChild(background);

        // Child elements, clipped as well.
        if (effectiveProps.children.length > 0) {
            this.root.addChild(...effectiveProps.children);
        }

        this.addChild(this.root);

        // Last regular element is a border.
        const border = new pixi.Graphics();
        border.roundRect(0, 0, width, height, 8);
        border.setStrokeStyle({ width: 2, color: 0x474747, alpha: 1 }).stroke();
        this.addChild(border);
        this.position.set(effectiveProps.diagramValues.x, effectiveProps.diagramValues.y);

        if (effectiveProps.diagramValues.selectable) {
            this.on("pointerdown", (event: pixi.FederatedPointerEvent) => {
                event.stopPropagation();
                const modifiers = getModifiers(event);

                // Toggle selection if command or shift are pressed. Otherwise only select.
                let newSelected = true;
                if (modifiers.has(Modifier.Ctrl) || modifiers.has(Modifier.Meta) || modifiers.has(Modifier.Shift)) {
                    newSelected = !this.props.diagramValues.selected;
                }

                if (newSelected != this.props.diagramValues.selected) {
                    this.props.diagramValues.selected = newSelected;
                    if (newSelected) {
                        for (const listener of this.evenListeners.select) {
                            listener(this, modifiers);
                        }
                        this.renderSelectionBoxes(this.props.diagramValues);
                    } else {
                        for (const listener of this.evenListeners.unselect) {
                            listener(this, modifiers);
                        }
                        this.removeSelectionBoxes();
                    }
                }
            });

            if (effectiveProps.diagramValues.selected) {
                this.renderSelectionBoxes(effectiveProps.diagramValues as IDiagramValues);
            }
        } else {
            this.removeAllListeners("pointerdown");
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

    protected renderSelectionBoxes(diagramValues: IDiagramValues): void {
        const boxes: Handle[] = [];

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
        this.addChild(...boxes);
    }

    protected removeSelectionBoxes(): void {
        const handles = this.children.filter((c) => {
            return c instanceof Handle;
        });

        for (const handle of handles) {
            this.removeChild(handle);
            handle.destroy();
        }
    }
}
