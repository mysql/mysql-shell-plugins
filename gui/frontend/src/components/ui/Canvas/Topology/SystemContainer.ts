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
import { DbSystemStateColor } from "./MysqlStates";

export class SystemContainer extends ConnectedContainer {
    public options: any;
    public resources: any;

    public constructor(resources: any, options: any) {
        super();
        this.options = {
            caption: "System",
            statusCaption: "Click the menu to add components to the container.",
            statusColor: DbSystemStateColor.OK,
            width: 300,
            height: 340,
        };
        // If options were passed to the constructor, add them to / overwrite
        // the default options
        if (options) {
            this.options = { ...this.options, ...options };
        }
        this.resources = resources;
        this.changeState(options);
        this.startInteractiveHandling(null);
    }

    public initializeGfx(): void {
        // Add background
        const bg = (this.gfx.bg = new PIXI.Graphics());
        //bg.selectable = true;
        bg.hitArea = bg.getLocalBounds();
        this.addChild(bg);
        // Prepare header mask
        const mask = (this.gfx.headerMask = new PIXI.Graphics());
        this.addChild(mask);
        // Header
        const headerGfx = (this.gfx.header = new PIXI.Graphics());
        headerGfx.mask = mask;
        this.addChild(headerGfx);
        // Icon
        let groupIcon;
        if (this.options.icon) {
            groupIcon = this.gfx.groupIcon = new PIXI.Sprite(this.options.icon as PIXI.Texture<PIXI.Resource>);
        } else {
            groupIcon = this.gfx.groupIcon =
                new PIXI.Sprite(this.resources.oncloud.texture as PIXI.Texture<PIXI.Resource>);
        }
        groupIcon.x = 10;
        groupIcon.y = 8;
        groupIcon.alpha = 0.8;
        this.addChild(groupIcon);
        // Label
        const captionLbl = (this.gfx.captionLbl = new PIXI.Text(this.options.caption as string, {
            fontFamily: "Helvetica",
            fontSize: 16,
            fill: 0xffffff,
            align: "left",
        }));
        captionLbl.x = 45;
        captionLbl.y = 10;
        captionLbl.alpha = 0.8;
        this.addChild(captionLbl);
        // Status indicator
        const statusIcon = (this.gfx.statusIcon = new PIXI.Graphics());
        statusIcon.y = 9;
        // statusIcon.statusColor = this.options.statusColor;
        this.addChild(statusIcon);
        // Status Label
        const statusLbl = (this.gfx.statusLbl = new PIXI.Text(this.options.statusCaption as string, {
            fontFamily: "Helvetica",
            fontSize: 13,
            fill: 0xffffff,
            align: "left",
        }));
        statusLbl.y = 12;
        statusLbl.alpha = 0.8;
        this.addChild(statusLbl);
        // Menu Icon
        const menuBtn = (this.gfx.menuBtn =
            new PIXI.Sprite(this.resources.menu.texture as PIXI.Texture<PIXI.Resource>));
        menuBtn.y = 13;
        menuBtn.alpha = 0.8;
        menuBtn.interactive = true;
        menuBtn.buttonMode = true;
        // menuBtn.on("click", (): void => {});
        this.addChild(menuBtn);
    }

    public updateGfx(): void {
        // Adjust background size
        const bg = this.gfx.bg!;
        bg.clear();
        bg.lineStyle(2, 0x46464a, 1);
        bg.beginFill(0x262628, 1);
        bg.drawRoundedRect(0, 0, this.options.width as number, this.options.height as number, 8);
        bg.endFill();

        // Head mask
        const mask = this.gfx.headerMask!;
        mask.clear();
        mask.beginFill(0xff3300);
        mask.drawRect(0, 0, this.options.width as number, 42);
        mask.endFill();

        // Draw actual header
        const headerGfx = this.gfx.header!;
        headerGfx.clear();
        headerGfx.lineStyle(2, 0x46464a, 1);
        headerGfx.beginFill(0x2b2b2e, 1);
        headerGfx.drawRoundedRect(0, 0, this.options.width as number, 60, 8);
        headerGfx.endFill();
        headerGfx.moveTo(0, 41);
        headerGfx.lineTo(this.options.width as number, 41);

        // Separator
        let xPos = this.gfx.captionLbl!.x + this.gfx.captionLbl!.width + 14;
        headerGfx.moveTo(xPos, 6);
        headerGfx.lineTo(xPos, 36);

        // Status indicator
        xPos += 12;
        const statusIcon = this.gfx.statusIcon!;
        statusIcon.clear();
        statusIcon.lineStyle(1, 0x45454a, 1);
        statusIcon.beginFill(this.options.statusColor as number, 1);
        statusIcon.drawRoundedRect(0, 0, 22, 22, 4);
        statusIcon.endFill();
        statusIcon.x = xPos;

        // Status label background
        xPos += 28;
        headerGfx.lineStyle(1, 0x45454a, 1);
        headerGfx.beginFill(0x272729, 1);
        headerGfx.drawRoundedRect(xPos, 9, this.options.width - xPos - 50, 22, 2);
        headerGfx.endFill();

        // Status Label
        const statusLbl = this.gfx.statusLbl!;
        statusLbl.x = xPos + 6;

        // Separator
        xPos = this.options.width - 50 + 12;
        headerGfx.lineStyle(2, 0x39393d, 1);
        headerGfx.moveTo(xPos, 6);
        headerGfx.lineTo(xPos, 36);

        // Menu Icon
        xPos += 12;
        const menuBtn = this.gfx.menuBtn!;
        menuBtn.x = xPos;
    }

    public changeState(newOptions: any): void {
        // Add new options or overwrite existing ones
        this.options = { ...this.options, ...newOptions };
        let sizeChanged = true;
        if (!this.gfx.bg) {
            this.initializeGfx();
        } else {
            // Check if size has changed
            sizeChanged =
                this.options.width !== this.gfx.bg.width - 2 ||
                this.options.height !== this.gfx.bg.height - 2;
        }
        // Update Status
        if (this.gfx.statusLbl!.text !== this.options.statusCaption) {
            this.gfx.statusLbl!.text = this.options.statusCaption;
        }

        const statusIcon = this.gfx.statusIcon!;
        if (statusIcon.statusColor !== this.options.statusColor) {
            statusIcon.statusColor = this.options.statusColor;
            statusIcon.clear();
            statusIcon.lineStyle(1, 0x45454a, 1);
            statusIcon.beginFill(statusIcon.statusColor, 1);
            statusIcon.drawRoundedRect(0, 0, 22, 22, 4);
            statusIcon.endFill();
        }
        if (sizeChanged) {
            this.updateGfx();
        }
    }
}
