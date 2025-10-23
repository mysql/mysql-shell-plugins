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

import type { ICanvasElement } from "../Canvas.js";

export interface IConnectionHolder {
    connections: Connection[];
}

export enum ConnectionType {
    /** A direct line between the two endpoints. */
    Straight,

    /** A curved line between the two endpoints. */
    Bezier,

    /** A line with a right angle elbow in the middle between the two endpoints. */
    Ellbow,
}

/**
 * A connection is a cubic bezier curve between two canvas elements.
 * It leaves the start element at its right edge, and enters the end element on the left edge.
 */
export class Connection extends pixi.Graphics {
    public constructor(private start: ICanvasElement, private end: ICanvasElement, private type: ConnectionType) {
        super();

        if (this.isConnectionHolder(start.element)) {
            start.element.connections.push(this);
        }

        if (this.isConnectionHolder(end.element)) {
            end.element.connections.push(this);
        }

        this.update();
    }

    public update(): void {
        this.x = this.start.element.x + this.start.element.width - 2; // removing the outline width
        this.y = this.start.element.y + (this.start.element.height / 2);

        const p1 = (this.end.element.x - this.x) / 2;
        const p2 = (this.end.element.y + (this.end.element.height / 2)) - this.y;

        this.clear();

        this.setStrokeStyle({ width: 2, color: 0xAA4747, alpha: 1 });

        switch (this.type) {
            case ConnectionType.Straight: {
                this.moveTo(0, 0).lineTo(this.end.element.x - this.x, p2).stroke();
                break;
            }

            case ConnectionType.Ellbow: {
                this.moveTo(0, 0).lineTo(p1, 0).lineTo(p1, p2).lineTo(this.end.element.x - this.x, p2).stroke();
                break;
            }

            case ConnectionType.Bezier: {
                this.moveTo(0, 0).bezierCurveTo(p1, 0, p1, p2, (this.end.element.x - this.x), p2).stroke();
                break;
            }

            default:
                break;
        }

        this.setStrokeStyle({ width: 2, color: 0x474747, alpha: 1 });
        this.circle(0, 0, 4).fill({ color: 0x1e1e1e, alpha: 1 }).stroke();
        this.circle(this.end.element.x - this.x, p2, 4).fill({ color: 0x1e1e1e, alpha: 1 }).stroke();
    }

    private isConnectionHolder(obj: unknown): obj is IConnectionHolder {
        return "connections" in (obj as IConnectionHolder);
    }
}
