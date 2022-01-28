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
import { Viewport } from "pixi-viewport";
import { RegionContainer } from "./RegionContainer";
import { ModeType } from "./InteractiveContainer";
// import { MysqlServerInstanceOnPremise } from "./MysqlServerInstanceOnPremise";
// import { MYSQL_SERVER_INSTANCE_STATE, REGION_TYPE } from "./MysqlStates";
// import { DbSystemContainer } from "./DbSystemContainer";
import { RegionType, MySQLServerInstanceState } from "./MysqlStates";
import { DbSystemContainer, ISystemContainerOptions } from "./DbSystemContainer";
import { MysqlServerInstanceOnPremise } from "./MysqlServerInstanceOnPremise";

import Ease from "pixi-ease/dist/ease";

//window.PIXI = PIXI; //or require("pixi-compressed-textures")

export class LogicalViewport extends Viewport {
    private project: Partial<ISystemContainerOptions>;
    private pixiApp: any;
    private geoRegion: null;
    private regionContainer!: RegionContainer;
    //alpha: number = 0;
    //screenWidth: number = 0;
    private onPremRegion!: RegionContainer;

    public constructor(project: any, options = {}) {
        super(options);
        // Keep a reference to the project and the PIXI Application object
        this.project = project;
        this.pixiApp = project.app;
        // The geoRegion of this logicalViewport
        this.geoRegion = null;
        // Initialize viewport containers
        this.initLogicalViewport();
    }

    // Switch the app to logical topology mode
    public switchToLogicalTopologyMode(region: any, options: any): void {
        options = options || {
            animate: true,
        };
        // Set global topologyMode
        this.pixiApp.topologyMode = ModeType.Logic;
        // Set the logicViewport's geoRegion
        this.geoRegion = region;
        this.regionContainer.setCaption(region.properties.name);
        if (options.animate) {
            // Zoom in on region
            this.pixiApp.geoViewport.snapMoveAndZoom(region.geometry.coordinates, 5, {
                easeZoom: "easeInQuart",
                easeMove: "easeOutQuart",
                time: 2000,
            });
            // Fade out app.geoViewport and DCs
            Ease.ease.add(
                this.pixiApp.geoViewport,
                { alpha: 0 },
                { wait: 1000, duration: 1000, ease: "easeOutQuad" },
            );
            const doEase = Ease.ease.add(
                this.pixiApp.geoViewport.allRegionElementsContainer,
                { alpha: 0 },
                { wait: 1000, duration: 1000, ease: "easeOutQuad" },
            );
            doEase.once("complete", (): void => {
                this.pixiApp.stage.removeChild(this.pixiApp.geoViewport);
                this.pixiApp.stage.removeChild(
                    this.pixiApp.geoViewport.allRegionElementsContainer,
                );
                const topologyGeoToolbarItems = document.getElementById(
                    "TopologyGeoToolbarItems",
                );
                // Switch topology toolbars
                if (topologyGeoToolbarItems != null) {
                    topologyGeoToolbarItems.style.display = "none";
                }
                const topologyLogicalToolbarItems = document.getElementById(
                    "TopologyLogicalToolbarItems",
                );
                if (topologyLogicalToolbarItems != null) {
                    topologyLogicalToolbarItems.style.display = "inherit";
                }
            });
            // Add logical viewport
            this.alpha = 0;

            this.pixiApp.stage.addChild(this);
            // Fade in logical viewport
            Ease.ease.add(
                this,
                { alpha: 1 },
                { wait: 1500, duration: 500, ease: "easeInQuad" },
            );
        } else {
            // Add logical viewport
            this.alpha = 1;
            this.pixiApp.stage.addChild(this);
            // Remove geographical containers
            this.pixiApp.stage.removeChild(this.pixiApp.geoViewport);
            this.pixiApp.stage.removeChild(
                this.pixiApp.geoViewport.allRegionElementsContainer,
            );
            const topologyGeoToolbarItems = document.getElementById(
                "TopologyGeoToolbarItems",
            );
            // Switch topology toolbars
            if (topologyGeoToolbarItems != null) {
                topologyGeoToolbarItems.style.display = "none";
            }
            const topologyLogicalToolbarItems = document.getElementById(
                "TopologyLogicalToolbarItems",
            );
            if (topologyLogicalToolbarItems != null) {
                topologyLogicalToolbarItems.style.display = "inherit";
            }
        }
    }

    private initLogicalViewport(): void {
        this.bounce({ time: 0, underflow: "left" });
        // Set min- and max-zoom values
        this.clampZoom({ maxWidth: 3500, minWidth: 5 });
        // Load Images, setup compressedTextures extension

        // const extensions = PIXI.compressedTextures.detectExtensions(
        //   this.pixiApp.renderer
        // );
        const loader = this.pixiApp.loader;
        //loader.pre(PIXI.compressedTextures.extensionChooser(extensions));
        // Allow for @2.png images for HiDPI displays
        const textureOptions = { metadata: { choice: ["@2x.png"] } };
        // Load images and assign to sprites to draw them
        loader
            .add("sakila", "/images/textures/sakila.png", textureOptions)
            .add("iNetwork", "/images/textures/instance-network.png", textureOptions)
            .add("iStatus", "/images/textures/instance-status.png", textureOptions)
            .add("add", "/images/textures/add.png", textureOptions)
            .add("gridtile", "/images/textures/gridtilewhite.png", textureOptions)
            .add("dbsystem", "/images/textures/dbsystem.png", textureOptions)
            .add("onpremise", "/images/textures/on-premise.png", textureOptions)
            .add("oncloud", "/images/textures/on-cloud.png", textureOptions)
            .add("menu", "/images/menu.png", textureOptions)
            .load((loaderInstance: any, resources: any): void => {
                // Setup Grid
                const gridSprite = new PIXI.TilingSprite(
                    resources.gridtile.texture as PIXI.Texture<PIXI.Resource>,
                    this.pixiApp.screen.width as number,
                    this.pixiApp.screen.height * 2,
                );
                gridSprite.alpha = 0.05;
                this.addChild(gridSprite);
                // Create RegionContainer for selected region
                this.regionContainer = new RegionContainer("On-Cloud", resources, {
                    width: this.screenWidth - 50,
                    height: 430,
                    regionType: RegionType.OnCloud,
                });
                const selectedRegion = this.regionContainer;
                selectedRegion.x = 25;
                selectedRegion.y = 25;
                this.addChild(selectedRegion);
                // Add a DbSystemContainer
                const dbSystem = new DbSystemContainer(resources, {
                    project: this.project,
                });
                dbSystem.x = 50;
                dbSystem.y = 35;
                selectedRegion.addChild(dbSystem);
                // Create On-Premise RegionContainer
                const onPremRegion = (this.onPremRegion = new RegionContainer(
                    "On-Premise",
                    resources,
                    {
                        width: this.screenWidth - 50,
                    },
                ));
                onPremRegion.x = 25;
                onPremRegion.y = 500;
                this.addChild(onPremRegion);
                // Add a first MySQL Server Instance in ADD_INSTANCE mode
                const instance = new MysqlServerInstanceOnPremise(resources, {
                    state: MySQLServerInstanceState.AddInstance,
                    caption: "Add Instance",
                    subCaption: "Add MySQL Server Instance",
                    onPremRegion,
                    project: this.project,
                });
                instance.x = 50;
                instance.y = 35;
                onPremRegion.addChild(instance);
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get("topology") === "logical") {
                    const regions = this.pixiApp.geoViewport.regions;
                    let region = regions[0];
                    for (const item of regions) {
                        if (item.properties.caption === "ASHBURN, VA") {
                            region = item;
                            break;
                        }
                    }
                    this.switchToLogicalTopologyMode(region, { animate: false });
                }
            });
    }
}
