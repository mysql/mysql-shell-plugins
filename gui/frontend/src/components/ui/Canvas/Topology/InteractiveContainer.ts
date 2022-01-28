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
import { DbSystemStateColor } from "./MysqlStates";

// Different types of TOPOLOGY_MODE
export enum ModeType {
    Geo,
    Logic,
}

export class InteractiveContainer extends PIXI.Container {

    protected gfx: {
        bg?: PIXI.Graphics;
        header?: PIXI.Graphics;
        headerMask?: PIXI.Graphics;
        statusLbl?: PIXI.Text;
        groupIcon?: PIXI.Sprite;
        captionLbl?: PIXI.Text;
        statusIcon?: PIXI.Graphics & { statusColor?: DbSystemStateColor };
        menuBtn?: PIXI.Sprite;
        addDbSystem?: PIXI.Container;
        networkLbl?: PIXI.Text;
        statusLblGfx?: PIXI.Text;
        roleGfxMask?: PIXI.Graphics;
        roleGfx?: PIXI.Graphics;
        roleLbl?: PIXI.Text;
        bgSakila?: PIXI.Sprite;
        nodes?: PIXI.Graphics;

        addInstance?: PIXI.DisplayObject;
        instanceConfig?: PIXI.DisplayObject;
    };

    protected eventHandlerFunctions: never[];
    protected interactiveOptions: { reduceBgAlphaOnMouseOver: boolean };
    protected draggingStart: boolean;
    protected dragging: boolean;
    protected isOver: boolean;
    protected isDown: boolean;
    protected dragStartOffsetX: number;
    protected dragStartOffsetY: number;
    protected clickedBefore: boolean;
    protected doubleClickTimer: ReturnType<typeof setTimeout> | null;
    protected eventData: any;

    private pixiApp: any;

    public constructor() {
        super();

        // Create object that will hold graphics which need the be directly
        // accessed later on
        this.gfx = {};

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
    }

    public startInteractiveHandling(options: any): void {
        if (options) {
            this.interactiveOptions = options;
        }

        if (this.interactive === false) {
            // Start listening to events
            this.interactive = true;
            // button mode means the hand cursor appears when the mouse rolls over
            this.buttonMode = true;

            this.on("pointerover", this.onPointerOver)
                .on("pointerout", this.onPointerOut)
                .on("pointerdown", this.onPointerDown)
                .on("pointerup", this.onPointerUp)
                .on("pointerupoutside", this.onPointerUp)
                .on("pointermove", this.onPointerMove);
        }
    }

    public addAndCacheEventHandler = (
        element: any,
        eventType: any,
        handlerFunc: any,
        handlerCache: any,
    ): void => {
        const cache = handlerCache ? handlerCache : this.eventHandlerFunctions;
        const funcBind = handlerFunc.bind(this);
        // Add { element, func } to cache
        cache.push({ element, eventType, funcBind });
        element.addEventListener(eventType, funcBind);
    };

    protected showPopupMenu(popupMenuItems: Array<{ id: string; icon: string; caption: string }>): void {
        if (!this.gfx || !this.gfx.menuBtn || !this.gfx.menuBtn.getGlobalPosition) {
            return;
        }

        const pos: { x: number; y: number } = this.gfx.menuBtn.getGlobalPosition();

        // Get the last element that still has a parent - which is the Viewport
        let el = this as InteractiveContainer;
        while (el.parent.parent) {
            el = el.parent as InteractiveContainer;
        }
        // If the Viewport has the property app assigned, get the offset of the
        // hosting <div>
        if (el.pixiApp) {
            const elemRect = el.pixiApp.contentDiv.getBoundingClientRect();
            pos.x += elemRect.left;
            pos.y += elemRect.top;
        }

        const popupMenuContainer = document.getElementById(
            "overlayPopupMenuContainer",
        );
        // Show popup menu
        if (popupMenuContainer !== null) {
            popupMenuContainer.style.display = "inherit";
        }

        const popupMenu = document.getElementById("overlayPopupMenu");
        if (popupMenu != null) {
            // Calculate and set position of popup menu
            popupMenu.style.left = `${pos.x - popupMenu.offsetWidth + 55}px`;
            popupMenu.style.top = `${pos.y + 24}px`;
        }

        // Create popup menu entries
        let html = "";
        popupMenuItems.forEach((item) => {
            html += this.popupMenuItem(item.id, item.icon, item.caption);
        });

        const menuItems = document.getElementById("overlayPopupMenuItems");
        if (menuItems != null) {
            // Load menu items
            menuItems.innerHTML = html;
        }

        // Add event handlers
        popupMenuItems.forEach((item) => {
            /*this.addAndCacheEventHandler(
                document.getElementById(item.id),
                "click",
                item.eventHandler,
                null,
            );*/
        });

        // Register container and button event listener
        this.addAndCacheEventHandler(
            document.getElementById("overlayPopupMenuContainer"),
            "click",
            this.handleClosePopupMenu,
            null,
        );
        this.addAndCacheEventHandler(
            document,
            "keydown",
            this.handleClosePopupMenu,
            null,
        );
    }

    protected handleDrag(event: any): void {
        console.log("handleDrag()");
    }

    protected handleClick(event: any): void {
        console.log("handleClick()");
    }

    protected handleDblClick(event: any): void {
        console.log("handleDblClick()");
    }

    protected handleMouseEnter(event: any): void {
        console.log("handleMouseEnter()");
    }

    protected handleMouseExit(event: any): void {
        console.log("handleMouseExit()");
    }

    protected removeCachedEventHandlers(handlerCache: any): void {
        const cache = handlerCache ? handlerCache : this.eventHandlerFunctions;
        let item = cache.pop();

        while (item) {
            item.element.removeEventListener(item.eventType, item.funcBind);
            item = cache.pop();
        }
    }

    protected handleClosePopupMenu = (event: any): void => {
        if (
            (event.type === "keydown" && event.key !== "Escape") ||
            event.type === "click"
        ) {
            const mnuContainer = document.getElementById("overlayPopupMenuContainer");
            if (mnuContainer != null) {
                // Hide popup menu
                mnuContainer.style.display = "none";
            }

            // Remove cached event handlers
            this.removeCachedEventHandlers(null);

            // Remove menu items
            const items = document.getElementById("overlayPopupMenuItems");
            while (items?.firstChild) {
                items.removeChild(items.firstChild);
            }
        }
    };

    protected stopInteractiveHandling(): void {
        if (this.interactive === false) {
            // Start listening to events
            this.interactive = false;
            // button mode means the hand cursor appears when the mouse rolls over
            this.buttonMode = false;

            this.off("pointerover", this.onPointerOver)
                .off("pointerout", this.onPointerOut)
                .off("pointerdown", this.onPointerDown)
                .off("pointerup", this.onPointerUp)
                .off("pointerupoutside", this.onPointerUp)
                .off("pointermove", this.onPointerMove);
        }
    }

    private onPointerOver = (event: any): void => {
        this.isOver = true;
        if (this.isDown || this.dragging) {
            return;
        }

        if (this.interactiveOptions.reduceBgAlphaOnMouseOver && this.gfx.bg) {
            this.gfx.bg.alpha = 0.7;
        }

        this.handleMouseEnter(event);
    };

    private onPointerOut = (event: any): void => {
        this.isOver = false;
        if (this.isDown || this.dragging) {
            return;
        }
        this.draggingStart = false;

        if (this.interactiveOptions.reduceBgAlphaOnMouseOver && this.gfx.bg) {
            this.gfx.bg.alpha = 1;
        }

        this.handleMouseExit(event);
    };

    private onPointerDown = (event: any): void => {
        // If the event is not triggered by this object, ignore it
        if (event.target !== this) {
            return;
        }
        // Make sure the parent does not get the event as well
        event.stopPropagation();

        // store a reference to the data
        // the reason for this is because of multi touch
        // we want to track the movement of this particular touch
        this.eventData = event.data;

        const cursorPosition = this.eventData.getLocalPosition(this.parent);
        this.dragStartOffsetX = cursorPosition.x - this.x;
        this.dragStartOffsetY = cursorPosition.y - this.y;

        // Don't start dragging immediately, use a threshold
        this.draggingStart = true;
    };

    private onPointerUp = (event: any): void => {
        // If the event is not triggered by this object, ignore it
        if (event.target !== this && !this.dragging) {
            return;
        }
        // Make sure the parent does not get the event as well
        //event.stopPropagation();

        if (this.dragging) {
            this.alpha = 1;
            this.dragging = false;
            // set the interaction data to null
            this.eventData = null;
        } else {
            this.draggingStart = false;

            // Detect dblclick if it was clicked before
            if (this.clickedBefore) {
                this.clickedBefore = false;

                // Clear doubleClickTimer to not also fire onClick
                if (this.doubleClickTimer) {
                    clearTimeout(this.doubleClickTimer);
                }

                // Call this.onDblClick
                this.handleDblClick(event);
            } else {
                this.clickedBefore = true;
                // Set a timer for double click detection, only fire onClick if there
                // is no second click within 200ms
                this.doubleClickTimer = setTimeout((): void => {
                    this.clickedBefore = false;
                    clearTimeout(this.doubleClickTimer as ReturnType<typeof setTimeout>);

                    // Call this.onClick
                    this.handleClick(event);
                }, 200);
            }
        }
    };

    private onPointerMove = (event: any): void => {
        // If the event is not triggered by this object, ignore it
        if (event.target !== this && !this.dragging) {
            return;
        }
        // Make sure the parent does not get the event as well
        //event.stopPropagation();

        // Do drag threshold detection of 3 px
        if (this.draggingStart && !this.dragging && !!this.eventData) {
            const newPosition = this.eventData.getLocalPosition(this.parent);

            if (
                Math.abs(newPosition.x - (this.dragStartOffsetX + this.x)) > 2 ||
                Math.abs(newPosition.y - (this.dragStartOffsetY + this.y)) > 2
            ) {
                this.draggingStart = false;
                this.dragging = true;
            }
        }

        // If dragging is going on, move element
        if (this.dragging) {
            if (this.alpha !== 0.3) {
                this.alpha = 0.3;
            }
            const newPosition = this.eventData.getLocalPosition(this.parent);
            this.x = newPosition.x - this.dragStartOffsetX;
            this.y = newPosition.y - this.dragStartOffsetY;

            this.handleDrag(event);
        }
    };

    private popupMenuItem(id: string, imageFileName: string, caption: string): string {
        const imgFileNameNoExt = imageFileName.replace(/\.[^/.]+$/, "");
        const imgFileNameExtOnly = imageFileName.split(".").pop() ?? "";

        return (
            `<div id="${id}" class="overlayPopupMenuItem">
                <img src="images/icons/popup-menu/${imageFileName}"
                    srcset="images/icons/popup-menu/${imgFileNameNoExt}@2x.${imgFileNameExtOnly} 2x">
                <p>${caption}</p>
            </div>`
        );
    }

}
