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

import React from "react";
import Color from "color";

import { IComponentProperties, MouseEventType, Component } from "..";
import { themeManager } from "../../Theming/ThemeManager";
import { GeoViewport } from "./Topology/GeoViewport";
import { LogicalViewport } from "./Topology/LogicalViewport";

interface ICanvasProperties extends IComponentProperties {
    content?: any;
    disabled?: boolean;
    demo?: boolean;
    offsetWidth?: number;
    offsetHeight?: number;
    lowFPS: number;
    warmFPS: number;
    fullFPS: number;
    disableTickerOnMouseLeave: boolean;
}

interface ICanvasState {
    open: boolean;
}

export default class Canvas extends Component<ICanvasProperties, ICanvasState> {
    public static defaultProps = {
        maxFps: 60,
        offsetWidth: 1300,
        offsetHeight: 1200,
        lowFPS: 10,
        warmFPS: 30,
        fullFPS: 60,
        disableTickerOnMouseLeave: false,
    };

    private app: any;
    private pixiContent: any;

    public constructor(props: ICanvasProperties) {
        super(props);
        this.app = new PIXI.Application({
            antialias: true,
            //transparent: true,
            backgroundColor:
                themeManager.activeThemeType === "light"
                    ? Color.hsl(240, 5, 91).rgbNumber()
                    : Color.hsl(240, 5, 10).rgbNumber(),
            sharedTicker: true,
            width: props.offsetWidth,
            height: props.offsetHeight,

            // Make sure the canvas is displayed with correct resolution
            // on HiDPI displays
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });

        this.state = {
            open: false,
        };

        this.addHandledProperties(
            "maxFps",
            "demo",
            "lowFPS",
            "warmFPS",
            "offsetWidth",
            "offsetHeight",
            "fullFPS",
            "disableTickerOnMouseLeave",
        );
        this.connectEvents("onMouseLeave", "onMouseEnter", "onMouseUp", "onMouseDown");

        void this.initProject();
    }

    public render(): React.ReactNode {
        return (
            <div
                ref={this.updatePixiCnt}
                {...this.unhandledProperties}
            ></div>
        );
    }

    protected handleMouseEvent(type: MouseEventType, e: React.MouseEvent): boolean {
        if (this.props.disabled) {
            e.preventDefault();
        }

        switch (type) {
            case MouseEventType.Down: {
                PIXI.Ticker.shared.maxFPS = this.props.fullFPS;
                break;
            }

            case MouseEventType.Leave: {
                if (this.props.disableTickerOnMouseLeave) {
                    PIXI.Ticker.shared.stop();
                } else {
                    PIXI.Ticker.shared.maxFPS = this.props.lowFPS;
                }
                break;
            }

            case MouseEventType.Enter: {
                if (this.props.disableTickerOnMouseLeave) {
                    PIXI.Ticker.shared.start();
                }
                PIXI.Ticker.shared.maxFPS = this.props.warmFPS;
                break;
            }

            default: {
                PIXI.Ticker.shared.maxFPS = this.props.warmFPS;
                break;
            }
        }

        return true;
    }

    private initPixiApp(): void {
        // Set low FPS to minimize CPU load
        if (this.props.disableTickerOnMouseLeave) {
            PIXI.Ticker.shared.stop();
        } else {
            PIXI.Ticker.shared.maxFPS = this.props.lowFPS;
        }
    }

    private async initViewPorts(): Promise<void> {
        // Initialize the Geo Viewport
        this.app.geoViewport = new GeoViewport(this, {
            screenWidth: this.app.view.width,
            screenHeight: this.app.view.height,
            stopPropagation: false,
            interaction: this.app.renderer.plugins.interaction,
        });

        // Await the loading of countries and regions
        await this.app.geoViewport.loadCountriesAndRegions();

        //this.getOciCompartmentAndRegionInfo();

        // Initialize the Logical Viewport
        this.app.logicViewport = new LogicalViewport(this, {
            screenWidth: this.app.view.width,
            screenHeight: this.app.view.height,
            stopPropagation: false,
            interaction: this.app.renderer.plugins.interaction,
        });

        // Update renderer to new size
        //this.app.renderer.resize(800, 800);
        //this.app.geoViewport.resize(800, 800);
        //this.app.logicViewport.resize(800, 800);
    }

    private async initProject(): Promise<void> {
        // Load the project HTML content into the tab with the given tabId
        // and initialize the PixiApp
        // Initialize the PixiApp
        this.initPixiApp();
        // Initializes the application data and viewpoints
        await this.initViewPorts();
    }

    private updatePixiCnt = (element: any): void => {
        // the element is the DOM object that we will use as container to add pixi stage(canvas)
        if (element !== null) {
            this.pixiContent = element;
            this.pixiContent.appendChild(this.app.view);
            this.initPixiApp();
        }
    };
}
