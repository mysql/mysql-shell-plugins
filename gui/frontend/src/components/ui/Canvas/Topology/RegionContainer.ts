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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as PIXI from "pixi.js";
import { ConnectedContainer } from "./ConnectedContainer";
import { RegionType } from "./MysqlStates";
import { ComputeInstance } from "./ComputeInstance";

export class RegionContainer extends ConnectedContainer {
    public resources: any;
    public options: any;

    public constructor(caption: string, resources: any, options: any) {
        super();
        this.resources = resources;
        this.options = options || {
            regionType: RegionType.OnPremise,
        };
        this.addGraphics(caption, resources);
        this.startInteractiveHandling(null);
    }

    public addGraphics(caption: string, resources: any): void {
        const width = this.options.width ? this.options.width as number : 650;
        const height = this.options.height ? this.options.height as number : 150;
        // Set hitArea
        this.hitArea = new PIXI.RoundedRectangle(0, 0, width, height, 8);
        // Draw a background as rounded rectangle
        const bg = (this.gfx.bg = new PIXI.Graphics());
        bg.lineStyle(2, 0x8c8c94, 0.5);
        //bg.selectable = true; // FIXMEE@@
        bg.beginFill(0x000000, 0.2);
        bg.drawRoundedRect(0, 0, width, height, 8);
        bg.endFill();
        bg.hitArea = bg.getLocalBounds();
        this.addChild(bg);
        // Label
        const captionLbl = (this.gfx.captionLbl = new PIXI.Text(caption, {
            fontFamily: "Helvetica",
            fontSize: 16,
            fill: 0xffffff,
            align: "left",
        }));
        captionLbl.x = 10;
        captionLbl.y = 14 + captionLbl.width;
        captionLbl.angle = -90;
        captionLbl.alpha = 0.5;
        // Icon
        const mainIcon = (this.gfx.groupIcon =
            this.options.regionType === RegionType.OnCloud
                ? new PIXI.Sprite(resources.oncloud.texture as PIXI.Texture<PIXI.Resource>)
                : new PIXI.Sprite(resources.onpremise.texture as PIXI.Texture<PIXI.Resource>));
        mainIcon.x = 8;
        mainIcon.y = 14 + captionLbl.width + 32;
        mainIcon.angle = -90;
        mainIcon.alpha = 0.5;
        // Menu Icon
        const menuBtn = (this.gfx.menuBtn = new PIXI.Sprite(resources.menu.texture as PIXI.Texture<PIXI.Resource>));
        menuBtn.x = width - 28;
        menuBtn.y = 12;
        menuBtn.alpha = 0.8;
        menuBtn.interactive = true;
        menuBtn.buttonMode = true;
        menuBtn.on("click", this.menuBtnClick);
        // Add objects in right order
        this.addChild(mainIcon);
        this.addChild(menuBtn);
        this.addChild(captionLbl);
    }

    public setCaption(caption: any): void {
        const captionLbl = this.gfx.captionLbl!;
        captionLbl.text = caption;
        captionLbl.y = 14 + captionLbl.width;
        this.gfx.groupIcon!.y = 14 + captionLbl.width + 32;
    }

    public menuBtnClick = (event: any): void => {
        this.showPopupMenu([
            {
                id: "mnuAddComputeInstance",
                icon: "mnu-add-instance.png",
                caption: "Add Compute Instance",
                eventHandler: this.handleAddComputeInstance,
            },
            {
                id: "mnuAddDbSystem",
                icon: "mnu-add-instance.png",
                caption: "Add MySQLaaS DbSystem",
                eventHandler: this.handleAddComputeInstance,
            },
        ]);
    };

    public showPopupMenu(arg0: Array<{
        id: string;
        icon: string;
        caption: string;
        eventHandler: (event: any) => void;
    }>): void {
        throw new Error("Method not implemented.");
    }

    public handleAddComputeInstance = (): void => {
        const instance = new ComputeInstance(this.resources, {
            icon: this.resources.onpremise.texture,
            caption: "Compute",
            statusCaption: "Status OK.",
        });
        instance.x = 725;
        instance.y = 35;
        this.addChild(instance);
    };
}
