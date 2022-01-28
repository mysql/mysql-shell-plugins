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
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as PIXI from "pixi.js";

import { ConnectedContainer } from "./ConnectedContainer";

export class RapidInstance extends ConnectedContainer {
    public resources: any;
    public options: { width: number; height: number };

    public constructor(resources: any, options: any) {
        super();
        // Keep a reference to the image resources
        this.resources = resources;
        // Set default options
        this.options = {
            width: 260,
            height: 220,
        };
        // If options were passed to the constructor, add them to / overwrite
        // the default options
        if (options) {
            this.options = { ...this.options, ...options };
        }

        // Set initial state
        this.changeState(options);

        this.startInteractiveHandling({ reduceBgAlphaOnMouseOver: true });
    }

    public changeState(options: any): void {
        // Add new options or overwrite existing ones
        this.options = { ...this.options, ...options };
        // Check if the background graphics have already been added
        if (!this.gfx.bg) {
            // draw a rounded rectangle
            const bg = (this.gfx.bg = new PIXI.Graphics());
            bg.lineStyle(2, 0x46464a, 1);
            // bg.selectable = true;
            bg.beginFill(0x1e1e1e, 1);
            bg.drawRoundedRect(0, 0, this.options.width, this.options.height, 8);
            bg.endFill();
            bg.hitArea = bg.getLocalBounds();
            this.addChild(bg);

            // Add text labels
            const captionLbl = (this.gfx.captionLbl = new PIXI.Text(
                "RAPID Real Time Analytics",
                {
                    fontFamily: "Helvetica",
                    fontSize: 16,
                    fill: 0xffffff,
                    align: "left",
                },
            ));
            captionLbl.x = 15;
            captionLbl.y = 7;
            captionLbl.alpha = 0.8;
            this.addChild(captionLbl);

            // Add menu button
            const menuBtn = (this.gfx.menuBtn = new PIXI.Sprite(
                this.resources.menu.texture as PIXI.Texture<PIXI.Resource>,
            ));
            menuBtn.x = this.options.width - 28;
            menuBtn.y = 9;
            menuBtn.alpha = 0.8;
            this.addChild(menuBtn);

            // draw rapid nodes
            const nodes = (this.gfx.nodes = new PIXI.Graphics());
            nodes.lineStyle(1, 0x46464a, 1);
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    nodes.beginFill(0x282828, 1);
                    nodes.drawRoundedRect(17 + i * 60, 30 + j * 45, 45, 30, 2);
                    nodes.endFill();
                }
            }
            nodes.y = 10;
            this.addChild(nodes);
        }
    }

}
