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
import * as d3 from "d3";
import Color from "color";

import * as topology from "./InteractiveContainer";
import * as topojson from "topojson-client";
import { Objects, Topology } from "topojson-specification";
import * as GeoJSON from "geojson";

import Ease from "pixi-ease/dist/ease";

const regionMarkerWidth = 16;
const skipPlannedRegions = false;

interface IRegion {
    geometry: {
        coordinates: number[];
        projectedCoords?: number[];
    };
    properties: {
        caption: string;
        align: string;
        status: string;
    };
    markerContainer?: PIXI.Container;
    labelContainer?: PIXI.Container;
}

export class GeoViewport extends Viewport {
    private pixiApp: any;
    private regions: IRegion[];
    private markersGraphics: PIXI.Graphics;
    private markerLinesGraphics: PIXI.Graphics;
    private labelsContainer: PIXI.Container;
    private allRegionElementsContainer: PIXI.Container;
    private projection: any;

    public constructor(private project: any, options = {}) {
        super(options);

        // Keep a reference to the project and the PIXI Application object
        this.pixiApp = project.app;

        // The available regions
        void this.loadCountriesAndRegions();

        // Init the PIXI Containers holding the region markers and labels
        this.markersGraphics = new PIXI.Graphics();
        this.markerLinesGraphics = new PIXI.Graphics();
        this.labelsContainer = new PIXI.Container();
        this.allRegionElementsContainer = new PIXI.Container();

        // Set the geographical projection to be used
        this.projection = d3.geoNaturalEarth1();

        // Activate drag, pinch and wheel functionality
        this.drag()
            .pinch()
            .wheel();

        // Set min- and max-zoom values
        this.clampZoom({ maxWidth: 3500, minWidth: 5 });
    }

    private async loadCountriesAndRegions(): Promise<void> {
        await this.loadCountries();
        await this.loadRegions();
    }

    private async loadCountries(): Promise<void> {
        // Load the country data
        const topoJsonData: Topology<Objects<GeoJSON.GeoJsonProperties>> | undefined
            = await d3.json("/data/countries-110m.json");

        // Add new new PIXI graphics to hold the countries
        const geoGraphics = new PIXI.Graphics();
        const path = d3
            .geoPath()
            //.projection(this.projection)
            .context((geoGraphics as unknown) as d3.GeoContext);

        // Get the paths in TopoJSON format
        const countries = topojson.feature(
            topoJsonData!,
            topoJsonData!.objects.countries,
        );

        // Scale to the desired size
        this.projection.fitExtent(
            [
                [-60, 0],
                [
                    1900, 1200,
                    //this.pixiApp.contentDiv.offsetWidth,
                    //this.pixiApp.contentDiv.offsetHeight
                ],
            ],
            countries,
        );

        // Draw countries
        const lightTheme =
            document.documentElement.getAttribute("data-theme") === "light";

        geoGraphics.beginFill(
            lightTheme ? Color.hsl(240, 5, 75).rgbNumber() : Color.hsl(240, 5, 24).rgbNumber(),
            1,
        );
        geoGraphics.lineStyle(
            0.15,
            lightTheme ? Color.hsl(240, 5, 65).rgbNumber() : Color.hsl(240, 5, 14).rgbNumber(),
            1,
        );

        path(countries);
        geoGraphics.endFill();

        // Add drawing to geoGraphics
        this.addChild(geoGraphics);

        // if (urlParams.get("topology") !== "logical") {
        //this.pixiApp.stage.addChild(geoGraphics);
        //}
        this.pixiApp.geoGraphics = geoGraphics;

        // On geoViewport move, recalculated regions
        this.on("moved", () => {
            return this.layoutRegions();
        });
    }

    private async loadRegions(): Promise<void> {
        const app = this.pixiApp;

        // Load region information
        const regionData: { type: string; regions: IRegion[] } | undefined = await d3.json("/data/regions.json");

        // Store reference to regions in app
        if (regionData) {
            this.regions = regionData.regions;
        } else {
            this.regions = [];
        }

        const textStyle = {
            fontFamily: "Arial",
            fontSize: 13,
            fill: "#c0c0c0",
            dropShadow: true,
            dropShadowColor: "#101010",
            dropShadowBlur: 2,
            dropShadowDistance: 0,
        };

        // Filter out all planned regions
        if (skipPlannedRegions) {
            for (let i = 0; i < app.regions.length; i++) {
                if (app.regions[i].properties.status === "planned") {
                    app.regions.splice(i, 1);
                    i--;
                }
            }
        }

        // Sort regions by vertical coordinates
        this.regions.sort((a: any, b: any) => {
            return a.geometry.coordinates[1] > b.geometry.coordinates[1] ? 1 : -1;
        },
        );

        // Cache projected coords and render text labels
        this.regions.forEach((region: any): void => {
            region.regions = this.regions;
            region.pixiApp = this.pixiApp;

            // Cache projected coords
            region.geometry.projectedCoords = this.projection(
                region.geometry.coordinates,
            );

            // -------------------------------------------
            // Create Pixi Container holding DC text label
            region.labelContainer = new PIXI.Container();
            region.labelContainer.region = region;

            // PanelText
            const labelText = (region.labelContainer.labelText = new PIXI.Text(
                region.properties.caption as string,
                new PIXI.TextStyle(textStyle),
            ));
            labelText.x = 4;
            labelText.y = 1;

            // Draw Panel Background
            const labelBackground = (region.labelContainer.labelBackground = new PIXI.Graphics());
            labelBackground.lineStyle();
            labelBackground.beginFill(0x333333, 1);
            labelBackground.drawRoundedRect(
                0,
                0,
                labelText.width + 8,
                labelText.height + 2,
                4,
            );
            labelBackground.endFill();

            // Add label background, then label text to labelContainer
            region.labelContainer.addChild(labelBackground).addChild(labelText);

            // Add mouse handling to labelContainer
            if (region.properties.status !== "planned") {
                region.labelContainer.interactive = true;
                region.labelContainer.buttonMode = true;
                region.labelContainer.on("pointerup", () => {
                    return this.pixiApp.logicViewport.switchToLogicalTopologyMode(
                        region.markerContainer.region,
                    );
                },
                );
            } else {
                region.labelContainer.alpha = 0.5;
            }

            // Add labelContainer to labelsContainer that holds all labels
            this.labelsContainer.addChild(region.labelContainer);
            //app.stage.addChild(region.labelContainer);
            //app.stage.addChild(t);

            // -----------------------------------------------
            // Create Pixi Container holding DC marker
            region.markerContainer = new PIXI.Container();
            region.markerContainer.region = region;

            // Draw Marker
            const markerGraphics = (region.markerContainer.gfx = new PIXI.Graphics());
            if (region.properties.status === "planned") {
                markerGraphics.lineStyle(2, 0x888888, 0.4);
                markerGraphics.beginFill(0x141415, 0.2);
            } else {
                markerGraphics.lineStyle(2, 0x37b58a, 0.8);
                markerGraphics.beginFill(0x141415, 0.4);
            }
            // Draw Marker
            markerGraphics.drawRect(0, 0, regionMarkerWidth, regionMarkerWidth);
            markerGraphics.endFill();

            // Add markerGraphics to markerContainer
            region.markerContainer.addChild(markerGraphics);

            // Add mouse handling to markerContainer
            region.markerContainer.interactive = true;
            region.markerContainer.buttonMode = true;
            region.markerContainer.on("pointerup", () => {
                return this.pixiApp.switchToLogicalTopologyMode(
                    region.markerContainer.region,
                    null,
                );
            },
            );

            this.markersGraphics.addChild(region.markerContainer);
        });
        // Add markersGraphics, markerLinesGraphics and
        // labelsContainer directly to app stage in order
        // to prevent zooming via geoViewport
        this.allRegionElementsContainer
            .addChild(this.markersGraphics)
            .addChild(this.markerLinesGraphics)
            .addChild(this.labelsContainer);

        // Trigger first layout of regions
        this.layoutRegions();

        // Switch to logical topology view immediately, URL param topology is set
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("topology") !== "logical") {
            app.stage.addChild(this);
            app.stage.addChild(this.allRegionElementsContainer);
        }
    }

    // Performs a dynamic layout of the Region markers and labels
    private layoutRegions(): void {
        const regions = this.regions;
        const markerLinesGraphics = this.markerLinesGraphics;

        // Clear marker line graphics for new layout
        markerLinesGraphics.clear();

        // Store array of labelBoundingBoxes to detect overlapping texts
        const labelBoundingBoxes = [];

        // Layout each region
        for (const region of regions) {
            // Calculated Marker position based on geoViewport position and zoom
            const x =
                (region.geometry.projectedCoords![0] - this.left) * this.scaled -
                regionMarkerWidth / 2;
            const y =
                (region.geometry.projectedCoords![1] - this.top) * this.scaled -
                regionMarkerWidth / 2;

            // Position Marker
            region.markerContainer!.x = x;
            region.markerContainer!.y = y;

            region.labelContainer!.x =
                region.properties.align === "right"
                    ? x - regionMarkerWidth - region.labelContainer!.width + 12
                    : (region.labelContainer!.x = x + regionMarkerWidth + 4);

            region.labelContainer!.y = y;

            // Move labels to avoid overlapping text
            let isOverlapping;
            let lineLength = 0;
            let maxOverlap = 45;
            // Repeat until the label does not overlap with any other label
            // already placed
            do {
                isOverlapping = false;
                maxOverlap--;

                // Move label up in 5px steps until it does not overlap anymore
                for (const box of labelBoundingBoxes) {
                    const label = region.labelContainer!;
                    // Detect intersection
                    if (
                        label.x < box.x + box.width &&
                        label.x + label.width > box.x &&
                        label.y < box.y + box.height &&
                        label.y + label.height + 4 > box.y
                    ) {
                        // If there is an overlap, move labelContainer
                        isOverlapping = true;
                        lineLength++;
                        // Move up
                        region.labelContainer!.y = region.labelContainer!.y - 5;
                        // Also shift to the left / right
                        region.labelContainer!.x =
                            region.properties.align === "right"
                                ? region.labelContainer!.x - 5
                                : region.labelContainer!.x + 5;
                        break;
                    }
                }
            } while (isOverlapping && maxOverlap > 0);

            // Draw guiding line from larker to label if label had to be moved
            if (lineLength > 0) {
                markerLinesGraphics.lineStyle(
                    1,
                    region.properties.status === "planned" ? 0x777777 : 0x37b58a,
                    0.8,
                );

                if (region.properties.align === "right") {
                    markerLinesGraphics
                        .moveTo(x, y + regionMarkerWidth / 2)
                        .lineTo(
                            x - 5 * lineLength,
                            y + regionMarkerWidth / 2 - 5 * lineLength,
                        )
                        .lineTo(
                            x - 5 * lineLength - 5,
                            y + regionMarkerWidth / 2 - 5 * lineLength,
                        );
                } else {
                    markerLinesGraphics
                        .moveTo(x + regionMarkerWidth, y + regionMarkerWidth / 2)
                        .lineTo(
                            x + regionMarkerWidth + 5 * lineLength,
                            y + regionMarkerWidth / 2 - 5 * lineLength,
                        )
                        .lineTo(
                            x + regionMarkerWidth + 5 * lineLength + 5,
                            y + regionMarkerWidth / 2 - 5 * lineLength,
                        );
                }
            }

            // Add bounding box of this label to the array of labelBoundingBoxes
            labelBoundingBoxes.push({
                x: region.labelContainer!.x,
                y: region.labelContainer!.y,
                width: region.labelContainer!.width,
                height: region.labelContainer!.height,
            });
        }
    }

    /*private setHomeRegion(region: IRegion): void {
        const gfx = region.markerContainer!.gfx;
        gfx.clear();
        gfx.lineStyle(2, 0x37b58a, 0.8);
        gfx.beginFill(0x37b58a, 0.8);
        gfx.drawRect(0, 0, regionMarkerWidth, regionMarkerWidth);
        gfx.endFill();

        const labelText = region.labelContainer!.labelText;
        labelText.style.fontWeight = 800;
        labelText.style.fill = "#303030";
        labelText.style.dropShadow = false;

        const labelBackground = region.labelContainer!.labelBackground;
        labelBackground.clear();
        labelBackground.lineStyle();
        labelBackground.beginFill(0xc0c0c0, 1);
        labelBackground.drawRoundedRect(
            0,
            0,
            region.labelContainer!.labelText.width + 8,
            region.labelContainer!.labelText.height + 2,
            4,
        );
        labelBackground.endFill();
    }*/

    // Switch the app to geographical topology mode
    private switchToGeographicalTopologyMode(options: any): void {
        options = options || {
            animate: true,
        };

        // Switch topology toolbars
        const topologyGeoToolbarItems = document.getElementById(
            "TopologyGeoToolbarItems",
        );
        if (topologyGeoToolbarItems != null) {
            topologyGeoToolbarItems.style.display = "inherit";
        }
        const topologyLogicalToolbarItems = document.getElementById(
            "TopologyLogicalToolbarItems",
        );
        if (topologyLogicalToolbarItems != null) {
            topologyLogicalToolbarItems.style.display = "none";
        }

        this.pixiApp.topologyMode = topology.ModeType.Geo;
        // this.project.addEventLogItem({
        //   type: logEvent.EVENT_LOG_ITEM_TYPE.INFO,
        //   caption: "Switching to geographical view",
        //   message: "Switching the canvas to geographical mode.\n",
        //   status: logEvent.EVENT_LOG_ITEM_STATE.OK
        // });
        if (options.animate) {
            // Zoom app.geoViewport back
            this.snapMoveAndZoom([10, 0], this.pixiApp.contentDiv.offsetWidth as number, {
                easeZoom: "easeOutQuart",
                easeMove: "easeInQuart",
                time: 2000,
            });

            // Fade out app.logicViewport
            Ease.ease.add(
                this.pixiApp.logicViewport,
                { alpha: 0 },
                { wait: 0, duration: 500, ease: "easeOutQuad" },
            );

            // Add geoViewport containers again
            this.alpha = 0;
            this.allRegionElementsContainer.alpha = 0;
            this.pixiApp.stage.addChild(this);
            this.pixiApp.stage.addChild(this.allRegionElementsContainer);

            // Fade in app.geoViewport and regions
            Ease.ease.add(
                this,
                { alpha: 1 },
                { wait: 0, duration: 1000, ease: "easeInQuad" },
            );
            const doEase = Ease.ease.add(
                this.allRegionElementsContainer,
                { alpha: 1 },
                { wait: 0, duration: 1000, ease: "easeInQuad" },
            );
            doEase.once("complete", (): void => {
                // Remove logical viewport
                this.pixiApp.stage.removeChild(this.pixiApp.logicViewport);
            });
        } else {
            // Add geographical containers
            this.alpha = 1;
            this.allRegionElementsContainer.alpha = 1;
            this.pixiApp.stage.addChild(this);
            this.pixiApp.stage.addChild(this.allRegionElementsContainer);

            // Remove logical viewport
            this.pixiApp.stage.removeChild(this.pixiApp.logicViewport);
        }
    }

    // Move and Zoom to a specific point on the geoViewport
    private snapMoveAndZoom(coords: any, width: number, options: any): void {
        const projectedCoords = this.projection(coords);
        options = options || {
            easeZoom: "easeInOutSine",
            easeMove: "easeInOutSine",
            time: 1000,
        };

        this.snapZoom({
            width,
            removeOnComplete: true,
            removeOnInterrupt: false,
            time: options.time,
            ease: options.easeZoom,
        }).snap(projectedCoords[0] as number, projectedCoords[1] as number, {
            removeOnComplete: true,
            removeOnInterrupt: false,
            time: options.time,
            ease: options.easeMove,
            forceStart: true,
        });
    }
}
