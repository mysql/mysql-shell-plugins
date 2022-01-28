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
import { IDictionary } from "../../../../app-logic/Types";
import { ConnectedContainer } from "./ConnectedContainer";
import { MySQLServerInstanceState } from "./MysqlStates";

export class MysqlServerInstance extends ConnectedContainer {

    protected resources: any;
    protected options: IDictionary;

    public constructor(resources: any, options: any) {
        super();
        // Keep a reference to the image resources
        this.resources = resources;
        // Set default options
        this.options = {
            state: MySQLServerInstanceState.Configured,
            width: 250,
            height: 88,
            caption: "",
            subCaption: "",
            hostname: "",
            status: "",
            role: "PRIMARY",
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

    protected changeState(options: any): void {
        // Add new options or overwrite existing ones
        this.options = { ...this.options, ...options };

        let sizeChanged = true;

        // Check if the background graphics have already been added
        if (!this.gfx.bg) {
            this.initializeGfx();
        } else {
            // Check if size has changed
            sizeChanged =
                this.options.width !== this.gfx.bg.width - 2 ||
                this.options.height !== this.gfx.bg.height - 2;
        }
        if (sizeChanged) {
            this.updateGfx();
        }

        if (this.gfx.addInstance) {
            this.removeChild(this.gfx.addInstance);
        }
        if (this.gfx.instanceConfig) {
            this.removeChild(this.gfx.instanceConfig);
        }

        if (this.options.state === MySQLServerInstanceState.AddInstance) {
            if (!this.gfx.addInstance) {
                this.initializeGfxAddInstance();
            } else {
                if (sizeChanged) {
                    this.gfx.addInstance.y = Math.round(this.options.height as number / 2) - 18;
                }
                this.addChild(this.gfx.addInstance);
            }
        } else if (this.options.state === MySQLServerInstanceState.Configured) {
            if (!this.gfx.instanceConfig) {
                this.initializeGfxConfiguredInstance();
            } else {
                if (sizeChanged) {
                    this.updateGfxConfiguredInstance();
                }

                // Update labels
                if (this.gfx.captionLbl !== this.options.caption) {
                    this.gfx.captionLbl = this.options.caption as PIXI.Text;
                }
                if (this.gfx.networkLbl !== this.options.hostname) {
                    this.gfx.networkLbl = this.options.hostname as PIXI.Text;
                }
                if (this.gfx.statusLbl !== this.options.status) {
                    this.gfx.statusLbl = this.options.status as PIXI.Text;
                }
                if (this.gfx.roleLbl!.text !== this.options.role) {
                    this.gfx.roleLbl!.text = this.options.role as string;
                }

                this.addChild(this.gfx.instanceConfig);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected menuBtnClick = (event: any): void => {
        // Nothing to do yet.
    };

    private initializeGfx(): void {
        // Background
        const bg = (this.gfx.bg = new PIXI.Graphics());
        /*bg.lineStyle(2, 0x46464a, 1);
          bg.beginFill(0x1e1e1e, 1);
          bg.drawRoundedRect(0, 0,
              this.options.width, this.options.height, 8);
          bg.endFill();*/
        this.addChild(bg);

        /*// Draw shadow
          let shadow = new PIXI.Graphics();
          shadow.beginFill(0x000000, 0.7);
          shadow.drawRoundedRect(0, 2, 250, 100, 8);
          shadow.endFill();
          const blurFilter = new PIXI.filters.BlurFilter();
          blurFilter.blur = 3;
          shadow.filters = [blurFilter];
          this.addChild(shadow);*/

        // Sakila icon
        const sakila = (this.gfx.bgSakila = new PIXI.Sprite(
            this.resources.sakila.texture as PIXI.Texture<PIXI.Resource>,
        ));
        sakila.x = (this.options.width as number) - 72;
        sakila.y = 11;
        sakila.alpha = 0.1;
        this.addChild(sakila);
    }

    private initializeGfxAddInstance(): void {
        const addInstance = (this.gfx.addInstance = new PIXI.Container());
        // Add icon
        const add = new PIXI.Sprite(this.resources.add.texture as PIXI.Texture<PIXI.Resource>);
        add.x = 0;
        add.y = 3; //25;
        add.alpha = 0.6;
        addInstance.addChild(add);

        // Add text labels
        const title = new PIXI.Text(
            this.options.caption as string ?? "Add Instance",
            { fontFamily: "Helvetica", fontSize: 16, fill: 0xffffff },
        );
        title.x = 39;
        title.y = 0; //22;
        title.alpha = 0.6;
        addInstance.addChild(title);

        const subCaption = new PIXI.Text(
            this.options.subCaption as string ?? "Add MySQL Server Instance",
            { fontFamily: "Helvetica", fontSize: 11, fill: 0xffffff },
        );
        subCaption.x = 39;
        subCaption.y = 18; //40;
        subCaption.alpha = 0.4;
        addInstance.addChild(subCaption);

        addInstance.x = 16;
        addInstance.y = Math.round((this.options.height as number) / 2) - 18;

        this.addChild(addInstance);
    }

    private initializeGfxConfiguredInstance(): void {
        // Container to hold all instance configuration items
        const instanceConfig = (this.gfx.instanceConfig = new PIXI.Container());

        // Add text labels
        const captionLbl = (this.gfx.captionLbl = new PIXI.Text(
            this.options.caption as string,
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
        instanceConfig.addChild(captionLbl);

        // Add network host info
        const networkIco = new PIXI.Sprite(this.resources.iNetwork.texture as PIXI.Texture<PIXI.Resource>);
        networkIco.x = 15;
        networkIco.y = 33;
        networkIco.alpha = 0.3;
        instanceConfig.addChild(networkIco);

        const networkLbl = (this.gfx.networkLbl = new PIXI.Text(
            this.options.hostname as string,
            {
                fontFamily: "Helvetica",
                fontSize: 11,
                fill: 0xffffff,
                align: "left",
            },
        ));
        networkLbl.alpha = 0.5;
        networkLbl.x = 34;
        networkLbl.y = 34;
        instanceConfig.addChild(networkLbl);

        // Add status info
        const statusIco = new PIXI.Sprite(this.resources.iStatus.texture as PIXI.Texture<PIXI.Resource>);
        statusIco.x = 15;
        statusIco.y = 48;
        statusIco.alpha = 0.3;
        instanceConfig.addChild(statusIco);

        const statusLbl = (this.gfx.statusLblGfx = new PIXI.Text(
            this.options.status as string,
            {
                fontFamily: "Helvetica",
                fontSize: 11,
                fill: 0xffffff,
                align: "left",
            },
        ));
        statusLbl.alpha = 0.5;
        statusLbl.x = 34;
        statusLbl.y = 49;
        instanceConfig.addChild(statusLbl);

        // Add menu button
        const menuBtn = (this.gfx.menuBtn = new PIXI.Sprite(
            this.resources.menu.texture as PIXI.Texture<PIXI.Resource>,
        ));
        menuBtn.x = (this.options.width as number) - 28;
        menuBtn.y = 9;
        menuBtn.alpha = 0.8;
        menuBtn.interactive = true;
        menuBtn.buttonMode = true;
        menuBtn.on("click", this.menuBtnClick);
        instanceConfig.addChild(menuBtn);

        // Draw role footer
        // Prepare header mask
        const mask = (this.gfx.roleGfxMask = new PIXI.Graphics());
        mask.lineStyle(2, 0xff3300, 1);
        mask.beginFill(0xff3300, 1);
        mask.drawRect(0, 0, this.options.width as number, 18);
        mask.endFill();
        mask.x = 0;
        mask.y = (this.options.height as number) - 15;
        instanceConfig.addChild(mask);

        // Draw footer
        const roleGfx = (this.gfx.roleGfx = new PIXI.Graphics());
        roleGfx.lineStyle(2, 0x277f61, 1);
        roleGfx.beginFill(0x277f61, 1);
        roleGfx.drawRoundedRect(0, 0, this.options.width as number, this.options.height as number, 8);
        roleGfx.endFill();

        roleGfx.mask = mask;
        instanceConfig.addChild(roleGfx);

        const roleLbl = (this.gfx.roleLbl = new PIXI.Text(this.options.role as string, {
            fontFamily: "Helvetica",
            fontSize: 12,
            fill: 0xffffff,
            align: "left",
        }));
        roleLbl.alpha = 0.8;
        roleLbl.x = Math.round((this.options.width as number) - roleLbl.width) / 2;
        roleLbl.y = (this.options.height as number) - 15;
        instanceConfig.addChild(roleLbl);

        this.addChild(instanceConfig);
    }

    private updateGfx(): void {
        // Adjust background size
        const bg = this.gfx.bg!;
        bg.clear();
        bg.lineStyle(2, 0x46464a, 1);
        bg.beginFill(0x1e1e1e, 1);
        bg.drawRoundedRect(0, 0, this.options.width as number, this.options.height as number, 8);
        bg.endFill();

        const sakila = this.gfx.bgSakila!;
        sakila.x = (this.options.width as number) - 72;

        // Redraw all connections
        this.drawAllConnections();
    }

    private updateGfxConfiguredInstance(): void {
        this.gfx.menuBtn!.x = (this.options.width as number) - 28;

        const mask = this.gfx.roleGfxMask!;
        mask.clear();
        mask.lineStyle(2, 0xff3300, 1);
        mask.beginFill(0xff3300, 1);
        mask.drawRect(0, 0, this.options.width as number, 18);
        mask.endFill();
        mask.x = 0;
        mask.y = (this.options.height as number) - 18;

        const roleGfx = this.gfx.roleGfx!;
        roleGfx.clear();
        roleGfx.lineStyle(2, 0x277f61, 1);
        roleGfx.beginFill(0x277f61, 1);
        roleGfx.drawRoundedRect(0, 0, this.options.width as number, this.options.height as number, 8);
        roleGfx.endFill();

        const roleLbl = this.gfx.roleLbl!;
        roleLbl.x = Math.round((this.options.width as number) - roleLbl.width) / 2;
        roleLbl.y = (this.options.height as number) - 15;
    }

}
