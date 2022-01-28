/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as PIXI from "pixi.js";
import { InteractiveContainer } from "./InteractiveContainer";

export class ConnectedContainer extends InteractiveContainer {

    private connections: PIXI.Graphics[];

    public constructor() {
        super();

        // Interaction status trackers
        this.draggingStart = false;
        this.dragging = false;
        this.isOver = false;
        this.isDown = false;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;
        this.clickedBefore = false;
        this.doubleClickTimer = null;
        this.eventData = null;

        // Interaction options
        this.interactiveOptions = {
            reduceBgAlphaOnMouseOver: false,
        };

        // Event handler function cache
        this.eventHandlerFunctions = [];
        this.connections = [];
    }

    // Connect this container to another container. If the connection should
    public connectTo(container: any, hostingContainer: any): void {
        if (!hostingContainer) {
            throw new Error(
                "The container that should host the connection graphics " +
                "needs to be specified as second parameter",
            );
        }
        const con = new PIXI.Graphics();

        this.connections.push(con);
        container.connections.push(con);
        // @@FIXME -->
        // con.state = this;
        // con.end = container;
        // @@FIXME <--
        this.drawConnection(con);

        hostingContainer.addChild(con);
    }

    protected handleDrag(): void {
        this.drawAllConnections();
    }

    protected drawAllConnections(): void {
        // If dragging is going on, move element
        this.connections.forEach((element) => {
            this.drawConnection(element);
        });
    }
    private drawConnection(con: PIXI.Graphics): void {
        const conStartMidX = 0; // TODO: con.start.x + con.start.width / 2;
        const conStartMidY = 0; // TODO: con.start.y + con.start.height / 2;
        const conEndMidX = 0; // TODO: con.end.x + con.end.width / 2;
        const conEndMidY = 0; // TODO: con.end.y + con.end.height / 2;
        const f = 0; // TODO: con.end.width / con.end.height;
        let c1x;
        let c1y;
        let c2x;
        let c2y;
        let c3x;
        let c3y;

        // Check if conStartMid is in the left/lower half, seen from conEndMid
        if (conStartMidX <= conEndMidX - (conEndMidY - conStartMidY) * f) {
            // Check if conStartMid is in the lower or left quadrant, from conEndMid
            if (conStartMidY > conEndMidY + (conEndMidX - conStartMidX) * f) {
                // conStartMid is below of conEndMid
                con.x = conEndMidX;
                con.y = 0; // TODO: con.end.y + con.end.height;

                const p1 = conStartMidX - conEndMidX;
                const p2 = 0; // TODO: (con.start.y - con.y) / 2;

                // Bezierpoint 1
                c1x = 0;
                c1y = p2;
                // Bezierpoint 2
                c2x = p1;
                c2y = p2;
                // Endpoint
                c3x = p1;
                c3y = 0; // TODO: con.start.y - con.y;
            } else {
                // conStartMid is left of conEndMid
                con.x = 0; // TODO: con.start.x + con.start.width - 2; // removing the outline width
                con.y = 0; // TODO: con.start.y + con.start.height / 2;

                const p1 = 0; // TODO: (con.end.x - con.x) / 2;
                const p2 = 0; // TODO: con.end.y + con.end.height / 2 - con.y;

                // Bezierpoint 1
                c1x = p1;
                c1y = 0;
                // Bezierpoint 2
                c2x = p1;
                c2y = p2;
                // Endpoint
                c3x = 0; // TODO: con.end.x - con.x;
                c3y = p2;
            }
        } else {
            // Check if conStartMid is in the top or left quadrant, from conEndMid
            if (conStartMidY < conEndMidY + (conEndMidX - conStartMidX) * f) {
                // conStartMid is above of conEndMid
                con.x = conStartMidX;
                con.y = 0; // TODO: con.start.y + con.start.height;

                const p1 = conEndMidX - conStartMidX;
                const p2 = 0; // TODO: (con.end.y - con.y) / 2;

                // Bezierpoint 1
                c1x = 0;
                c1y = p2;
                // Bezierpoint 2
                c2x = p1;
                c2y = p2;
                // Endpoint
                c3x = p1;
                c3y = 0; // TODO: con.end.y - con.y;
            } else {
                // conStartMid is right of conEndMid
                con.x = 0; // TODO: con.end.x + con.end.width - 2; // removing the outline width
                con.y = 0; // TODO: con.end.y + con.end.height / 2;

                const p1 = 0; // TODO: (con.start.x - con.x) / 2;
                const p2 = 0; // TODO: con.start.y + con.start.height / 2 - con.y;

                // Bezierpoint 1
                c1x = p1;
                c1y = 0;
                // Bezierpoint 2
                c2x = p1;
                c2y = p2;
                // Endpoint
                c3x = 0; // TODO: con.start.x - con.x;
                c3y = p2;
            }
        }

        con.clear();

        con.lineStyle(2, 0x474747, 1);
        con.moveTo(0, 0).bezierCurveTo(c1x, c1y, c2x, c2y, c3x, c3y);

        con.lineStyle(2, 0x474747, 1);
        con.beginFill(0x1e1e1e, 1);
        con.drawCircle(0, 0, 4);
        con.endFill();

        con.beginFill(0x1e1e1e, 1);
        con.drawCircle(c3x, c3y, 4);
        con.endFill();
    }

}
