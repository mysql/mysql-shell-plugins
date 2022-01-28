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
import { ConnectedContainer } from "./ConnectedContainer";
import { RapidInstance } from "./RapidInstance";
import {
    DbSystemState, DbSystemStateColor, MySQLServerInstanceState,
} from "./MysqlStates";
import { MysqlServerInstance } from "./MysqlServerInstance";

export interface ISystemContainerOptions {
    project?: Partial<ISystemContainerOptions>;
    state: DbSystemState;
    caption: string;
    statusCaption: string;
    statusColor: DbSystemStateColor;
    instanceHostname: string;
    width: number;
    height: number;
}

export class DbSystemContainer extends ConnectedContainer {

    private options: ISystemContainerOptions;
    private resources: any;
    private mysqlServerInstance: any;
    private rapidInstance: RapidInstance | undefined;

    public constructor(resources: any, options: Partial<ISystemContainerOptions>) {
        super();
        this.options = {
            state: DbSystemState.NotYetConfigured,
            caption: "DbSystem",
            statusCaption: "Click the area below to initialize a new MySQL DB System.",
            statusColor: DbSystemStateColor.Inactive,
            instanceHostname: "",
            width: 650,
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

    protected handleClick = (): void => {
        if (this.options.state === DbSystemState.NotYetConfigured) {
            void this.showCreateDbSystemDlg();
        }
    };
    private initializeGfx(): void {
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
        const groupIcon = (this.gfx.groupIcon = new PIXI.Sprite(
            this.resources.dbsystem.texture as PIXI.Texture<PIXI.Resource>,
        ));
        groupIcon.x = 10;
        groupIcon.y = 8;
        groupIcon.alpha = 0.8;
        this.addChild(groupIcon);
        // Label
        const captionLbl = (this.gfx.captionLbl = new PIXI.Text(
            this.options.caption,
            {
                fontFamily: "Helvetica",
                fontSize: 16,
                fill: 0xffffff,
                align: "left",
            },
        ));
        captionLbl.x = 45;
        captionLbl.y = 10;
        captionLbl.alpha = 0.8;
        this.addChild(captionLbl);
        // Status indicator
        const statusIco = (this.gfx.statusIcon = new PIXI.Graphics());
        statusIco.y = 9;
        //statusIco.statusColor = this.options.statusColor; //FIXMEE@@
        this.addChild(statusIco);
        // Status Label
        const statusLbl = (this.gfx.statusLbl = new PIXI.Text(
            this.options.statusCaption,
            {
                fontFamily: "Helvetica",
                fontSize: 13,
                fill: 0xffffff,
                align: "left",
            },
        ));
        statusLbl.y = 12;
        statusLbl.alpha = 0.8;
        this.addChild(statusLbl);
        // Menu Icon
        const menuBtn = (this.gfx.menuBtn = new PIXI.Sprite(
            this.resources.menu.texture as PIXI.Texture<PIXI.Resource>,
        ));
        menuBtn.y = 13;
        menuBtn.alpha = 0.8;
        this.addChild(menuBtn);
    }

    private updateGfx(): void {
        // Adjust background size
        const bg = this.gfx.bg!;
        bg.clear();
        bg.lineStyle(2, 0x46464a, 1);
        bg.beginFill(0x262628, 1);
        bg.drawRoundedRect(0, 0, this.options.width, this.options.height, 8);
        bg.endFill();

        // Head mask
        const mask = this.gfx.headerMask!;
        mask.clear();
        mask.beginFill(0xff3300);
        mask.drawRect(0, 0, this.options.width, 42);
        mask.endFill();

        // Draw actual header
        const headerGfx = this.gfx.header!;
        headerGfx.clear();
        headerGfx.lineStyle(2, 0x46464a, 1);
        headerGfx.beginFill(0x2b2b2e, 1);
        headerGfx.drawRoundedRect(0, 0, this.options.width, 60, 8);
        headerGfx.endFill();
        headerGfx.moveTo(0, 41);
        headerGfx.lineTo(this.options.width, 41);

        // Separator
        let xPos = this.gfx.captionLbl!.x + this.gfx.captionLbl!.width + 14;
        headerGfx.moveTo(xPos, 6);
        headerGfx.lineTo(xPos, 36);

        // Status indicator
        xPos += 12;
        const statusIco = this.gfx.statusIcon!;
        statusIco.clear();
        statusIco.lineStyle(1, 0x45454a, 1);
        statusIco.beginFill(this.options.statusColor, 1);
        statusIco.drawRoundedRect(0, 0, 22, 22, 4);
        statusIco.endFill();
        statusIco.x = xPos;

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
        if (this.gfx.addDbSystem) {
            const addDbSystem = this.gfx.addDbSystem;
            addDbSystem.x = this.width / 2 - addDbSystem.width / 2;
            addDbSystem.y = this.height / 2 - addDbSystem.height / 2;
        }
    }

    private initializeGfxAddDbSystem(): void {
        // The Add button to create the DbSystem
        const addDbSystem = (this.gfx.addDbSystem = new PIXI.Container());
        // Add icon
        const add = new PIXI.Sprite(this.resources.add.texture as PIXI.Texture<PIXI.Resource>);
        add.x = 0;
        add.y = 3;
        add.alpha = 0.6;
        addDbSystem.addChild(add);
        // Add text labels
        const title = new PIXI.Text("Create MySQL DB System", {
            fontFamily: "Helvetica",
            fontSize: 16,
            fill: 0xffffff,
        });
        title.x = 39;
        title.y = 0;
        title.alpha = 0.6;
        addDbSystem.addChild(title);
        const subCaption = new PIXI.Text("Configure a MySQL Server Instance", {
            fontFamily: "Helvetica",
            fontSize: 11,
            fill: 0xffffff,
        });
        subCaption.x = 39;
        subCaption.y = 18;
        subCaption.alpha = 0.4;
        addDbSystem.addChild(subCaption);
        addDbSystem.x = this.width / 2 - addDbSystem.width / 2;
        addDbSystem.y = this.height / 2 - addDbSystem.height / 2;
        this.addChild(addDbSystem);
    }

    private changeState(newOptions: Partial<ISystemContainerOptions>): void {
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
        if (this.options.state === DbSystemState.NotYetConfigured) {
            if (!this.gfx.addDbSystem) {
                this.initializeGfxAddDbSystem();
            } else {
                // Ensure the addDbSystem Container is added
                this.removeChild(this.gfx.addDbSystem);
                this.addChild(this.gfx.addDbSystem);
            }
        } else if (this.options.state === DbSystemState.Configured) {
            if (this.gfx.addDbSystem) {
                this.removeChild(this.gfx.addDbSystem);
            }
            this.gfx.captionLbl!.text = this.options.caption;
            if (!this.mysqlServerInstance) {
                // Add MySQL Server instance
                const instance = (this.mysqlServerInstance = new MysqlServerInstance(
                    this.resources,
                    {
                        state: MySQLServerInstanceState.Configured,
                        caption: "MySQL Server Instance",
                        hostname: this.options.instanceHostname,
                        status: "PROVISIONING",
                    },
                ));
                instance.x = 40;
                instance.y = 80;
                this.addChild(instance);
                // Add Rapid instance
                const rapid = (this.rapidInstance = new RapidInstance(
                    this.resources,
                    null,
                ));
                rapid.x = 350;
                rapid.y = 80;
                this.addChild(rapid);
                // Add connection between instance and rapid
                instance.connectTo(rapid, this);
                // this.options.project.addEventLogItem({
                //     type: logEvent.EVENT_LOG_ITEM_TYPE.WORKER,
                //     caption: "Provisioning MySQLaaS instance...",
                //     message: "Provisioning a new MySQLaaS DbSystem " +
                //         "instance the selected OCI compartment...\n",
                //     status: logEvent.EVENT_LOG_ITEM_STATE.WORKING
                // });
            }
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

    private async fetchHtmlAsText(url: string): Promise<string> {
        return (await fetch(url)).text();
    }

    private async showCreateDbSystemDlg(): Promise<void> {
        // Load dialog content
        const content = document.getElementById("overlayDialog");
        if (content != null) {
            content.innerHTML = await this.fetchHtmlAsText(
                "./inc/mysqlaas/dlg.createDBSystem.html",
            );
        }
        // Show the dialog
        const overlayDialogBg = document.getElementById("overlayDialogBg");
        if (overlayDialogBg != null) {
            overlayDialogBg.style.display = "inherit";
        }
        // Register Button event listener
        const overlayDialogOKBtn = document.getElementById("overlayDialogOKBtn");
        if (overlayDialogOKBtn != null) {
            overlayDialogOKBtn.addEventListener("click", this.handleEvent);
        }
        const overlayDialogCancelBtn = document.getElementById(
            "overlayDialogCancelBtn",
        );
        if (overlayDialogCancelBtn != null) {
            overlayDialogCancelBtn.addEventListener("click", this.handleClick);
        }
        // Make Enter Key work
        document.addEventListener("keydown", this.handleEvent);
    }

    private handleEvent = (event: Event): void => {
        switch (event.type) {
            case "keydown":
            case "click":
                if ((event as KeyboardEvent).key !== "Enter") {
                    break;
                }

                // Hide dialog
                const overlayDialogBg = document.getElementById("overlayDialogBg");
                if (overlayDialogBg != null) {
                    overlayDialogBg.style.display = "none";
                }

                // Remove keydown event listener
                document.removeEventListener("keydown", this.handleEvent);

                // Remove button click event listener
                const overlayDialogOKBtn = document.getElementById("overlayDialogOKBtn");
                if (overlayDialogOKBtn != null) {
                    overlayDialogOKBtn.removeEventListener("click", this.handleClick);
                }
                const overlayDialogCancelBtn = document.getElementById(
                    "overlayDialogCancelBtn",
                );
                if (overlayDialogCancelBtn != null) {
                    overlayDialogCancelBtn.removeEventListener("click", this.handleClick);
                }
                if ((event.target as HTMLElement).id === "overlayDialogOKBtn" ||
                    (event as KeyboardEvent).key === "Enter") {
                    // Change the DBSystem options
                    const form = document.getElementById("dbSystemForm") as HTMLFormElement;
                    if (form != null) {
                        this.changeState({
                            // state: DB_SYSTEM_STATE.CONFIGURED, // FIXMEE@@
                            // caption: form.elements.displayName.value,
                            statusCaption: "The MySQL DB Service is currently being provisioned.",
                            statusColor: DbSystemStateColor.Waiting,
                            // instanceHostname: form.elements.hostname.value //FIXMEE@@
                        });
                    }
                }
                break;
            default:
                return;
        }
    };

}
