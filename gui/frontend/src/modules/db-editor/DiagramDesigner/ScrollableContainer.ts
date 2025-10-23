/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
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

import { Viewport } from "pixi-viewport";

export enum ScrollBoxOverflow {
    None,
    Scroll,
    Hidden,
    Auto
}

export enum ScrollBoxUnderflow { // Actually IClampOptions from pixi-viewport, but can't import that here.
    None = "none",
    TopLeft = "top-left",
    TopRight = "top-right",
    TopCenter = "top-center",
    BottomLeft = "bottom-left",
    BottomRight = "bottom-right",
    BottomCenter = "bottom-center",
    Center = "center",
}

export interface IScrollableContainerOptions {
    /** Width of the box including scrollbar (in pixels). */
    boxWidth?: number,

    /** Height of the box including scrollbar (in pixels). */
    boxHeight?: number,

    /** Size of the scrollbar (in pixels, default: 8). */
    scrollbarSize?: number,

    /** The backgound color of the scrollbar. */
    scrollbarBackground?: number,

    /** Transparency of the scrollbar background. */
    scrollbarBackgroundAlpha?: number,

    /** The foreground color of the scrollbar. */
    scrollbarForeground?: number,

    /** Transparency of the scrollbar foreground. */
    scrollbarForegroundAlpha?: number,

    /** If true the user can drag the content to scroll (default: true). */
    dragScroll?: boolean,

    /** Call stopPropagation on all events that impact the scrollbox (default: true). */
    stopPropagation?: boolean,

    /** Offset of the horizontal scrollbar (in pixels, default: 0). */
    scrollbarOffsetHorizontal?: number,

    /** Offset of the vertical scrollbar (in pixels, default: 0). */
    scrollbarOffsetVertical?: number,

    overflowX?: ScrollBoxOverflow;
    overflowY?: ScrollBoxOverflow;
    underflow?: ScrollBoxUnderflow,

    /** Fade out the scrollbar if not in use (auto hide, default: true). */
    fadeScrollbar?: boolean,

    /** Time in milliseconds to fade out the scrollbar (default: 500). */
    fadeScrollbarTime?: number,

    /** Time in milliseconds to wait before starting to fade the scrollbar (default: 1000). */
    fadeScrollboxWait?: number,

    /** Propagate wheel events to the outside (default: false). */
    passiveWheel?: boolean,

    clampWheel?: boolean;

    /** Use this pixi.Ticker for updates (default: pixi.Ticker.shared). */
    ticker?: pixi.Ticker;

    /** Don't use a ticker for updates. If true you will have to call `updateLoop` manually. */
    noTicker?: boolean;

    /** The event system to use (usually from your pixi.Application). */
    events: pixi.EventSystem;
};

const defaultOptions: Partial<IScrollableContainerOptions> = {
    boxWidth: 100,
    boxHeight: 100,
    scrollbarSize: 8,
    scrollbarBackground: 14540253,
    scrollbarBackgroundAlpha: 1,
    scrollbarForeground: 0x404040,
    scrollbarForegroundAlpha: 1,
    dragScroll: true,
    stopPropagation: true,
    scrollbarOffsetHorizontal: 0,
    scrollbarOffsetVertical: 0,
    underflow: ScrollBoxUnderflow.TopLeft,
    fadeScrollbar: true,
    fadeScrollbarTime: 500,
    fadeScrollboxWait: 1000,
    passiveWheel: false,
    clampWheel: true
};

/**
 * A masked content box that can scroll vertically or horizontally with scrollbars.
 */
export class ScrollableContainer extends pixi.Container {
    /** Individual fields can be changed to modify the components behavior. */
    public readonly options: IScrollableContainerOptions;

    public content: Viewport;

    private scrollbar: pixi.Graphics;
    private maskContent: pixi.Graphics;

    private disabled = false;
    private hasVerticalScrollbar = true;
    private hasHorizontalScrollbar = true;
    private currentScrollWidth?: number;
    private currentScrollHeight?: number;

    private scrollbarTop = 0;
    private scrollbarHeight = 0;
    private scrollbarLeft = 0;
    private scrollbarWidth = 0;
    private fade?: { wait: number; duration: number; };

    private pointerDown?: { type: "horizontal" | "vertical"; last: pixi.PointData; };

    private tickerFunction?: () => void;

    public constructor(options: IScrollableContainerOptions) {
        super();

        this.options = Object.assign({}, defaultOptions, options);

        this.interactive = true;
        this.eventMode = "static";
        this.content = this.addChild(new Viewport({
            passiveWheel: options.passiveWheel,
            stopPropagation: this.options.stopPropagation,
            screenWidth: this.options.boxWidth,
            screenHeight: this.options.boxHeight,
            events: this.options.events,
            allowPreserveDragOutside: true,
        }));

        this.content.on("moved", () => {
            this.drawScrollbars();
        });

        this.options.ticker = options.ticker ?? pixi.Ticker.shared;

        this.scrollbar = new pixi.Graphics({ interactive: true, });
        this.scrollbar.on("pointerdown", this.scrollbarDown);
        this.on("pointermove", this.scrollbarMove);
        this.on("pointerup", this.scrollbarUp);
        this.on("pointercancel", this.scrollbarUp);
        this.on("pointerupoutside", this.scrollbarUp);

        this.addChild(this.scrollbar);
        this.maskContent = this.addChild(new pixi.Graphics());

        this.update();

        if (!this.options.noTicker) {
            this.tickerFunction = () => {
                this.updateLoop(Math.min(this.options.ticker!.elapsedMS, 16.6667));
            };
            this.options.ticker.add(this.tickerFunction);
        }
    }

    /**
     * @returns true if the scrollbox is disabled (no scrolling, no scrollbars).
     */
    public get isDisabled(): boolean {
        return this.disabled;
    }

    /** Enables or disables the scrollbox. */
    public set isDisabled(value: boolean) {
        if (this.disabled !== value) {
            this.disabled = value;
            this.update();
        }
    }

    /**
     * @returns the width of the scrollbox (without the scrollbar, if visible).
     */
    public get contentWidth(): number {
        const boxWidth = this.options.boxWidth ?? defaultOptions.boxWidth!;
        const scrollbarSize = this.options.scrollbarSize ?? defaultOptions.scrollbarSize!;

        return boxWidth - (this.hasVerticalScrollbar ? scrollbarSize : 0);
    }

    /**
     * @returns the height of scrollbox (without the scrollbar, if visible).
     */
    public get contentHeight(): number {
        const boxHeight = this.options.boxHeight ?? defaultOptions.boxHeight!;
        const scrollbarSize = this.options.scrollbarSize ?? defaultOptions.scrollbarSize!;

        return boxHeight - (this.hasHorizontalScrollbar ? scrollbarSize : 0);
    }

    /**
     * @returns true if the vertical scrollbar is visible.
     */
    public get isVerticalScrollbarVisibile() {
        return this.hasVerticalScrollbar;
    }

    /**
     * @returns true if the horizontal scrollbar is visible.
     */
    public get isHorizontalScrollbarVisible(): boolean {
        return this.hasHorizontalScrollbar;
    }

    /**
     * @returns the top coordinate of scrollbar.
     */
    public get scrollTop(): number {
        return this.content.top;
    }

    /**
     * Sets the top coordinate of scrollbar.
     */
    public set scrollTop(top: number) {
        this.content.top = top;
        this.drawScrollbars();
    }

    /**
     * @returns the left coordinate of scrollbar.
     */
    public get scrollLeft(): number {
        return this.content.left;
    }

    /**
      Sets the left coordinate of scrollbar.
     */
    public set scrollLeft(left: number) {
        this.content.left = left;
        this.drawScrollbars();
    }

    /**
     * @returns The width of content area or content.width, if not set.
     */
    public get scrollWidth(): number {
        return this.currentScrollWidth ?? this.content.width;
    }

    /**
     * @returns The height of content area or content.height, if not set.
     */
    public get scrollHeight(): number {
        return this.currentScrollHeight ?? this.content.height;
    }

    public override setSize(width: number, height: number): this {
        this.resize(width, height);

        return this;
    }

    /**
     * Resizes the content area of the scrollbox.
     *
     * @param boxWidth The new width of the scrollbox (including scrollbar, if visible).
     * @param boxHeight The new height of the scrollbox (including scrollbar, if visible).
     * @param scrollWidth The new scroll area width (leave undefined to use content.width).
     * @param scrollHeight The new scroll area height (leave undefined to use content.height).
     */
    public resize(boxWidth: number, boxHeight: number, scrollWidth?: number, scrollHeight?: number): void {
        this.options.boxWidth = boxWidth;
        this.options.boxHeight = boxHeight;

        if (scrollWidth !== undefined) {
            this.currentScrollWidth = scrollWidth;
        }

        if (scrollHeight !== undefined) {
            this.currentScrollHeight = scrollHeight;
        }

        this.content.resize(this.options.boxWidth, this.options.boxHeight, this.scrollWidth, this.scrollHeight);
        this.update();
    }

    /**
     * Ensures that the given area is visible in the scrollbox by scrolling if necessary.
     *
     * @param x The x coordinate of the area to make visible (local to the content box).
     * @param y The y coordinate of the area to make visible (local to the content box).
     * @param width The width of the area to make visible.
     * @param height The height of the area to make visible.
     */
    public ensureVisible(x: number, y: number, width: number, height: number) {
        this.content.ensureVisible(x, y, width, height);
        this.drawScrollbars();
    }

    /**
     * Updates the scrollbox (recalculates scrollbar visibility and position).
     */
    public update() {
        this.content.mask = null;
        this.maskContent.clear();

        if (!this.disabled) {
            this.drawScrollbars();
            this.drawMask();

            const direction = this.hasHorizontalScrollbar && this.hasVerticalScrollbar
                ? "all"
                : this.hasHorizontalScrollbar ? "x" : "y";

            if (this.options.dragScroll) {
                this.content.drag({ clampWheel: this.options.clampWheel, direction });
            }

            this.content.clamp({ direction, underflow: this.options.underflow });
        }
    }

    private drawScrollbars() {
        this.hasHorizontalScrollbar = this.options.overflowX === ScrollBoxOverflow.Scroll
            ? true
            : this.options.overflowX === ScrollBoxOverflow.Hidden || this.options.overflowX === ScrollBoxOverflow.None
                ? false
                : this.scrollWidth > this.options.boxWidth!;

        this.hasVerticalScrollbar = this.options.overflowY === ScrollBoxOverflow.Scroll
            ? true
            : this.options.overflowY === ScrollBoxOverflow.Hidden || this.options.overflowY === ScrollBoxOverflow.None
                ? false
                : this.scrollWidth > this.options.boxHeight!;

        this.scrollbar.clear();

        const boxHeight = this.options.boxHeight ?? 0;
        const boxWidth = this.options.boxWidth ?? 0;

        const width = this.scrollWidth + (this.hasVerticalScrollbar ? (this.options.scrollbarSize ?? 0) : 0);
        const height = this.scrollHeight + (this.hasHorizontalScrollbar ? (this.options.scrollbarSize ?? 0) : 0);
        this.scrollbarTop = (this.content.top / height) * boxHeight;
        this.scrollbarTop = this.scrollbarTop < 0 ? 0 : this.scrollbarTop;
        this.scrollbarHeight = ((this.options.boxHeight ?? 0) / height) * boxHeight;
        this.scrollbarHeight = this.scrollbarTop + this.scrollbarHeight > boxHeight
            ? boxHeight - this.scrollbarTop
            : this.scrollbarHeight;
        this.scrollbarLeft = (this.content.left / width) * boxWidth;
        this.scrollbarLeft = this.scrollbarLeft < 0 ? 0 : this.scrollbarLeft;
        this.scrollbarWidth = (boxWidth / width) * boxWidth;
        this.scrollbarWidth = this.scrollbarWidth + this.scrollbarLeft > boxWidth
            ? boxWidth - this.scrollbarLeft
            : this.scrollbarWidth;

        const scrollbarSize = this.options.scrollbarSize!;
        if (this.hasVerticalScrollbar) {
            this.scrollbar
                .rect(boxWidth - scrollbarSize + (this.options.scrollbarOffsetVertical ?? 0), 0, scrollbarSize,
                    boxHeight)
                .fill({ color: this.options.scrollbarBackground, alpha: this.options.scrollbarBackgroundAlpha });
        }

        if (this.hasHorizontalScrollbar) {
            this.scrollbar
                .rect(0, boxHeight - scrollbarSize + (this.options.scrollbarOffsetHorizontal ?? 0), boxWidth,
                    scrollbarSize)
                .fill({ color: this.options.scrollbarBackground, alpha: this.options.scrollbarBackgroundAlpha });
        }

        if (this.hasVerticalScrollbar) {
            this.scrollbar.roundRect(boxWidth - scrollbarSize + (this.options.scrollbarOffsetVertical ?? 0),
                this.scrollbarTop, scrollbarSize, this.scrollbarHeight)
                .fill({ color: this.options.scrollbarForeground, alpha: this.options.scrollbarForegroundAlpha });
        }

        if (this.hasHorizontalScrollbar) {
            this.scrollbar.roundRect(this.scrollbarLeft,
                boxHeight - scrollbarSize + (this.options.scrollbarOffsetHorizontal ?? 0), this.scrollbarWidth,
                scrollbarSize)
                .fill({ color: this.options.scrollbarForeground, alpha: this.options.scrollbarForegroundAlpha });
        }

        this.activateFade();
    }

    private drawMask(): void {
        this.maskContent.rect(0, 0, this.options.boxWidth ?? 0, (this.options.boxHeight ?? 0))
            .fill({ color: 0, alpha: 1 });
        this.mask = this.maskContent;
    }

    /**
     * Used to update the fade effect on the scrollbar.
     *
     * @param elapsed The time that passed since the last frame in milliseconds (usually capped at 16.6667).
     */
    private updateLoop(elapsed: number) {
        if (this.fade) {
            if (this.fade.wait > 0) {
                this.fade.wait -= elapsed;
                if (this.fade.wait <= 0) {
                    elapsed += this.fade.wait;
                } else {
                    return;
                }
            }

            this.fade.duration += elapsed;
            if (this.fade.duration >= this.options.fadeScrollbarTime!) {
                delete this.fade;
                this.scrollbar.alpha = 0;
            } else {
                this.scrollbar.alpha = this.easeInOutSine(this.fade.duration, 1, -1, this.options.fadeScrollbarTime!);
            }
            this.content.dirty = true;
        }
    }

    /**
     * Makes the scrollbar(s) visible and starts the fade-out timer.
     */
    private activateFade(): void {
        if (!this.fade && this.options.fadeScrollbar) {
            this.scrollbar.alpha = 1;
            this.fade = { wait: this.options.fadeScrollboxWait!, duration: 0 };
        }
    }

    /**
     * Handles pointer down events on the scrollbar.
     *
     * @param e The pointer event.
     */
    private scrollbarDown = (e: pixi.FederatedPointerEvent) => {
        const local = this.toLocal(e.global);
        if (this.hasHorizontalScrollbar) {
            if (local.y > this.options.boxHeight! - this.options.scrollbarSize!) {
                if (local.x >= this.scrollbarLeft && local.x <= this.scrollbarLeft + this.scrollbarWidth) {
                    this.pointerDown = { type: "horizontal", last: local };
                } else {
                    if (local.x > this.scrollbarLeft) {
                        this.content.left += this.content.worldScreenWidth;
                        this.update();
                    } else {
                        this.content.left -= this.content.worldScreenWidth;
                        this.update();
                    }
                }

                if (this.options.stopPropagation) {
                    e.stopPropagation();
                }

                return;
            }
        }

        if (this.hasVerticalScrollbar) {
            if (local.x > this.options.boxWidth! - this.options.scrollbarSize!) {
                if (local.y >= this.scrollbarTop && local.y <= this.scrollbarTop + this.scrollbarWidth) {
                    this.pointerDown = { type: "vertical", last: local };
                } else {
                    if (local.y > this.scrollbarTop) {
                        this.content.top += this.content.worldScreenHeight;
                        this.update();
                    } else {
                        this.content.top -= this.content.worldScreenHeight;
                        this.update();
                    }
                }

                if (this.options.stopPropagation) {
                    e.stopPropagation();
                }

                return;
            }
        }
    };

    /**
     * Handles pointer move events on the scrollbar.
     *
     * @param e The pointer event.
     */
    private scrollbarMove = (e: pixi.FederatedPointerEvent) => {
        if (this.pointerDown) {
            if (this.pointerDown.type === "horizontal") {
                const local = this.toLocal(e.global);
                const width = this.scrollWidth + (this.hasVerticalScrollbar ? this.options.scrollbarSize! : 0);
                this.scrollbarLeft += local.x - this.pointerDown.last.x;
                this.content.left = this.scrollbarLeft / this.options.boxWidth! * width;
                this.pointerDown.last = local;
                this.update();
            } else {
                const local = this.toLocal(e.data.global);
                const height = this.scrollHeight + (this.hasHorizontalScrollbar ? this.options.scrollbarSize! : 0);
                this.scrollbarTop += local.y - this.pointerDown.last.y;
                this.content.top = this.scrollbarTop / this.options.boxHeight! * height;
                this.pointerDown.last = local;
                this.update();
            }

        }

        if (this.options.stopPropagation) {
            e.stopPropagation();
        }
    };

    /**
     * Handles pointer up events on the scrollbar.
     */
    private scrollbarUp = () => {
        delete this.pointerDown;
    };

    private easeInOutSine(t: number, b: number, c: number, d: number): number {
        return -c / (((2 * Math.cos(Math.PI * t / d)) - 1 + b));
    }
}
