/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import "./ResultView.css";

import { ComponentChild, createRef } from "preact";

import { IImageResultData, IResultSet } from "../../script-execution/index.js";
import { ComponentBase, IComponentProperties } from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";

interface IImageResultViewProperties extends IComponentProperties {
    resultSet: IResultSet;
    zoom?: number;
}

interface IPoint {
    x: number;
    y: number;
}

interface IMinimapGeometry {
    imageWidth: number;
    imageHeight: number;
    minimapWidth: number;
    minimapHeight: number;
    viewportLeft: number;
    viewportTop: number;
    viewportWidth: number;
    viewportHeight: number;
    scrollLeft: number;
    scrollTop: number;
    visible: boolean;
}

interface IImageResultViewState {
    minimapGeometry?: IMinimapGeometry;
    minimapPosition: IPoint;
    isPanning: boolean;
}

interface ICostHeatmapCache {
    data: string;
    mimeType: string;
    source: string;
    hasHeatmap: boolean;
    maxCostLabel?: string;
}

interface ICostHeatmapResult {
    source: string;
    maxCost: number;
}

interface IInlineSvgCache {
    data: string;
    mimeType: string;
    svgText?: string;
}

const minimapMargin = 12;
const minimapMaxWidth = 220;
const minimapMaxHeight = 160;
const minimapMinWidth = 96;
const minimapMinHeight = 64;
const minimapDragThreshold = 3;
const defaultImageZoom = 1;
const minImageZoom = 0.25;
const maxImageZoom = 4;
const costHeatmapMissingColor = "#f0f0f0";
const costHeatmapColors = [
    "#2dc937",
    "#99c140",
    "#e7b416",
    "#db7b2b",
    "#cc3232",
    "#9b2226",
    "#641220",
];

export class ImageResultView extends ComponentBase<IImageResultViewProperties, IImageResultViewState> {
    private readonly containerRef = createRef<HTMLDivElement>();

    private imageElement?: HTMLElement;

    private readonly minimapRef = createRef<HTMLDivElement>();

    private resizeObserver?: ResizeObserver;

    private minimapPinned = false;

    private costHeatmapCache?: ICostHeatmapCache;

    private inlineSvgCache?: IInlineSvgCache;

    private initialScrollKey?: string;

    private initialScrollFrame?: number;

    private initialScrollAttempts = 0;

    private dragState?: {
        pointerId?: number;
        startClientX: number;
        startClientY: number;
        startPosition: IPoint;
        moved: boolean;
    };

    private panState?: {
        pointerId?: number;
        startClientX: number;
        startClientY: number;
        startScrollLeft: number;
        startScrollTop: number;
    };

    public constructor(props: IImageResultViewProperties) {
        super(props);

        this.addHandledProperties("resultSet", "zoom");
        this.state = {
            isPanning: false,
            minimapPosition: {
                x: minimapMargin,
                y: minimapMargin,
            },
        };
    }

    public override componentDidMount(): void {
        this.containerRef.current?.addEventListener("scroll", this.handleScroll);
        if (typeof ResizeObserver !== "undefined" && this.containerRef.current) {
            this.resizeObserver = new ResizeObserver(this.updateMinimapGeometry);
            this.resizeObserver.observe(this.containerRef.current);
        }

        window.addEventListener("resize", this.updateMinimapGeometry);
        this.scheduleInitialPosition();
        this.updateMinimapGeometry();
    }

    public override componentDidUpdate(previousProps: IImageResultViewProperties): void {
        if (previousProps.resultSet.image !== this.props.resultSet.image) {
            this.minimapPinned = false;
            this.initialScrollKey = undefined;
            this.initialScrollAttempts = 0;
            this.scheduleInitialPosition();
        }

        this.updateMinimapGeometry();
    }

    public override componentWillUnmount(): void {
        this.containerRef.current?.removeEventListener("scroll", this.handleScroll);
        this.resizeObserver?.disconnect();
        window.removeEventListener("resize", this.updateMinimapGeometry);
        this.cancelInitialPosition();
        this.removeDragListeners();
        this.removePanListeners(false);
    }

    public render(): ComponentChild {
        const { resultSet } = this.props;
        const image = resultSet.image;
        const { minimapGeometry } = this.state;
        const source = image ? this.getImageSource(image) : undefined;
        const inlineSvgText = image ? this.getInlineSvgText(image) : undefined;
        const imageStyle = image ? this.getImageStyle() : undefined;
        const minimapSource = source && image ? this.getMinimapSource(image, source) : undefined;
        const minimap = minimapSource && source && image && image.showMinimap !== false && minimapGeometry?.visible
            ? this.renderMinimap(
                minimapSource,
                image.caption ?? resultSet.caption ?? "Visual explain minimap",
                this.costHeatmapCache?.hasHeatmap ?? false,
            )
            : null;

        return (
            <Container
                className={this.getEffectiveClassNames([
                    "resultView",
                    "imageResultView",
                    this.state.isPanning ? "panning" : undefined,
                ])}
                innerRef={this.containerRef}
                orientation={Orientation.TopDown}
                onPointerDown={this.handleViewportPointerDown}
                onMouseDown={this.handleViewportMouseDown}
                {...this.unhandledProperties}
            >
                {inlineSvgText
                    ? <div
                        ref={this.setImageRef}
                        className="imageResultViewImage imageResultViewSvg"
                        role="img"
                        aria-label={image?.caption ?? resultSet.caption ?? "Visual explain plan"}
                        style={imageStyle}
                        onLoad={this.handleImageLoad}
                        dangerouslySetInnerHTML={{ __html: inlineSvgText }}
                    />
                    : source
                    ? <img
                        ref={this.setImageRef}
                        className="imageResultViewImage"
                        src={source}
                        alt={image?.caption ?? resultSet.caption ?? "Visual explain plan"}
                        style={imageStyle}
                        onLoad={this.handleImageLoad}
                    />
                    : <div className="imageResultViewEmpty">No visual explain image generated.</div>}
                {minimap}
            </Container>
        );
    }

    private getInlineSvgText = (image: IImageResultData): string | undefined => {
        if (this.inlineSvgCache
            && this.inlineSvgCache.data === image.data
            && this.inlineSvgCache.mimeType === image.mimeType) {
            return this.inlineSvgCache.svgText;
        }

        const svgText = this.createInlineSvgText(image);
        this.inlineSvgCache = {
            data: image.data,
            mimeType: image.mimeType,
            svgText,
        };

        return svgText;
    };

    private createInlineSvgText = (image: IImageResultData): string | undefined => {
        const svgText = this.getSvgText(image);
        if (!svgText || typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
            return undefined;
        }

        const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
        if (svgDocument.querySelector("parsererror")) {
            return undefined;
        }

        const annotatedNodes = Array.from(svgDocument.querySelectorAll<SVGGElement>("[data-estimated_total_cost]"));
        if (annotatedNodes.length === 0) {
            return undefined;
        }

        annotatedNodes.forEach((node) => {
            const tooltip = this.getAnnotationTooltip(node);
            if (!tooltip) {
                return;
            }

            node.setAttribute("data-tooltip", tooltip);
            Array.from(node.querySelectorAll<SVGElement>("*")).forEach((element) => {
                if (element.closest("[data-estimated_total_cost]") === node) {
                    element.setAttribute("data-tooltip", "inherit");
                }
            });
        });

        return new XMLSerializer().serializeToString(svgDocument.documentElement);
    };

    private getAnnotationTooltip = (node: Element): string => {
        const operation = node.getAttribute("data-operation");
        const annotationNames = node.getAttributeNames()
            .filter((name) => {
                return name.startsWith("data-") && name !== "data-tooltip" && name !== "data-operation";
            });

        const detailLines = this.orderAnnotationTooltipNames(annotationNames)
            .map((name) => {
                const value = node.getAttribute(name);

                return value ? `${this.formatAnnotationName(name.slice(5))}: ${value}` : undefined;
            })
            .filter((line): line is string => {
                return line !== undefined;
            });

        if (operation && detailLines.length > 0) {
            return `${operation}\n\n${detailLines.join("\n")}`;
        }

        return operation || detailLines.join("\n");
    };

    private orderAnnotationTooltipNames = (names: string[]): string[] => {
        if (!names.includes("data-access_type")) {
            return names;
        }

        const detailsBelowAccessType = ["data-table_name", "data-index_name", "data-index"].filter((name) => {
            return names.includes(name);
        });
        if (detailsBelowAccessType.length === 0) {
            return names;
        }

        const details = new Set(detailsBelowAccessType);
        const orderedNames: string[] = [];
        names.forEach((name) => {
            if (details.has(name)) {
                return;
            }

            orderedNames.push(name);
            if (name === "data-access_type") {
                orderedNames.push(...detailsBelowAccessType);
            }
        });

        return orderedNames;
    };

    private formatAnnotationName = (name: string): string => {
        return name.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => {
            return letter.toUpperCase();
        });
    };

    private getImageSource = (image: IImageResultData): string => {
        return image.data.startsWith("data:")
            ? image.data
            : `data:${image.mimeType};charset=utf-8,${encodeURIComponent(image.data)}`;
    };

    private getImageStyle = (): { zoom?: number } | undefined => {
        const zoom = this.getImageZoom();

        return zoom === defaultImageZoom ? undefined : { zoom };
    };

    private getImageZoom = (): number => {
        const zoom = this.props.zoom ?? this.props.resultSet.image?.zoom ?? defaultImageZoom;

        return Math.min(maxImageZoom, Math.max(minImageZoom, zoom));
    };

    private getMinimapSource = (image: IImageResultData, fallbackSource: string): string => {
        if (this.costHeatmapCache
            && this.costHeatmapCache.data === image.data
            && this.costHeatmapCache.mimeType === image.mimeType) {
            return this.costHeatmapCache.source;
        }

        const heatmapSource = this.createCostHeatmapSource(image);
        this.costHeatmapCache = {
            data: image.data,
            mimeType: image.mimeType,
            source: heatmapSource?.source ?? fallbackSource,
            hasHeatmap: heatmapSource !== undefined,
            maxCostLabel: heatmapSource ? this.formatHeatmapCostLabel(heatmapSource.maxCost) : undefined,
        };

        return this.costHeatmapCache.source;
    };

    private createCostHeatmapSource = (image: IImageResultData): ICostHeatmapResult | undefined => {
        const svgText = this.getSvgText(image);
        if (!svgText || typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
            return undefined;
        }

        const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
        if (svgDocument.querySelector("parsererror")) {
            return undefined;
        }

        const costNodes = Array.from(svgDocument.querySelectorAll<SVGGElement>("[data-estimated_total_cost]"));
        const costs = costNodes.map((node) => {
            return this.parseEstimatedCost(node.getAttribute("data-estimated_total_cost"));
        });
        const numericCosts = costs.filter((cost): cost is number => {
            return cost !== undefined;
        });
        if (numericCosts.length === 0) {
            return undefined;
        }

        const heatmapCosts = numericCosts.map((cost) => {
            return this.normalizeCostForHeatmap(cost);
        });
        const minHeatmapCost = Math.min(...heatmapCosts);
        const maxHeatmapCost = Math.max(...heatmapCosts);
        const maxCost = Math.max(...numericCosts);

        costNodes.forEach((node, index) => {
            const color = this.getCostHeatmapColor(costs[index], minHeatmapCost, maxHeatmapCost);
            this.applyCostHeatmapToNode(node, color);
        });

        return {
            source: `data:image/svg+xml;charset=utf-8,${
                encodeURIComponent(new XMLSerializer().serializeToString(svgDocument.documentElement))
            }`,
            maxCost,
        };
    };

    private getSvgText = (image: IImageResultData): string | undefined => {
        const fallbackMimeType = image.mimeType.toLowerCase();
        if (!image.data.startsWith("data:")) {
            return fallbackMimeType.includes("svg") ? image.data : undefined;
        }

        const commaIndex = image.data.indexOf(",");
        if (commaIndex < 0) {
            return undefined;
        }

        const header = image.data.slice(5, commaIndex).toLowerCase();
        const payload = image.data.slice(commaIndex + 1);
        const mimeType = header.split(";")[0] || fallbackMimeType;
        if (!mimeType.includes("svg")) {
            return undefined;
        }

        if (header.split(";").includes("base64")) {
            try {
                return atob(payload);
            } catch {
                return undefined;
            }
        }

        try {
            return decodeURIComponent(payload);
        } catch {
            return payload;
        }
    };

    private parseEstimatedCost = (value: string | null): number | undefined => {
        if (!value) {
            return undefined;
        }

        const cost = Number(value.trim());

        return Number.isFinite(cost) ? cost : undefined;
    };

    private getCostHeatmapColor = (cost: number | undefined, minCost: number, maxCost: number): string => {
        if (cost === undefined) {
            return costHeatmapMissingColor;
        }

        const normalizedCost = this.normalizeCostForHeatmap(cost);
        const percentage = maxCost <= minCost
            ? 0
            : Math.min(1, Math.max(0, (normalizedCost - minCost) / (maxCost - minCost)));

        return this.interpolateCostHeatmapColor(percentage);
    };

    private normalizeCostForHeatmap = (cost: number): number => {
        return Math.log10(Math.max(0, cost) + 1);
    };

    private formatHeatmapCostLabel = (cost: number): string => {
        if (cost >= 1000000) {
            return `${(cost / 1000000).toFixed(1)}M`;
        }

        if (cost >= 1000) {
            return `${(cost / 1000).toFixed(1)}K`;
        }

        if (cost >= 100) {
            return cost.toFixed(0);
        }

        if (cost >= 10) {
            return cost.toFixed(1);
        }

        return cost.toFixed(2).replace(/\.?0+$/, "");
    };

    private interpolateCostHeatmapColor = (percentage: number): string => {
        const position = percentage * (costHeatmapColors.length - 1);
        const index = Math.floor(position);
        const fraction = position - index;

        if (index >= costHeatmapColors.length - 1) {
            return costHeatmapColors[costHeatmapColors.length - 1]!;
        }

        const start = this.hexToRgb(costHeatmapColors[index]!);
        const end = this.hexToRgb(costHeatmapColors[index + 1]!);

        return this.rgbToHex([
            Math.round(start[0] + (end[0] - start[0]) * fraction),
            Math.round(start[1] + (end[1] - start[1]) * fraction),
            Math.round(start[2] + (end[2] - start[2]) * fraction),
        ]);
    };

    private applyCostHeatmapToNode = (node: SVGGElement, color: string): void => {
        const strokeColor = this.darkenCostHeatmapColor(color);
        const shapes = Array.from(node.querySelectorAll<SVGElement>("rect,path,circle,ellipse,polygon,polyline,line"));
        shapes.forEach((shape) => {
            if (shape.closest("[data-estimated_total_cost]") !== node) {
                return;
            }

            const tagName = shape.localName.toLowerCase();
            if (tagName !== "line" && tagName !== "polyline") {
                const fill = (shape.getAttribute("fill") ?? shape.style.getPropertyValue("fill")).trim().toLowerCase();
                if (fill !== "transparent" && fill !== "none") {
                    shape.setAttribute("fill", color);
                    shape.style.setProperty("fill", color);
                }
            }

            shape.setAttribute("stroke", strokeColor);
            shape.style.setProperty("stroke", strokeColor);
        });
    };

    private darkenCostHeatmapColor = (color: string): string => {
        const rgb = this.hexToRgb(color);

        return this.rgbToHex([
            Math.round(rgb[0] * 0.62),
            Math.round(rgb[1] * 0.62),
            Math.round(rgb[2] * 0.62),
        ]);
    };

    private hexToRgb = (color: string): [number, number, number] => {
        const hex = color.slice(1);

        return [
            Number.parseInt(hex.slice(0, 2), 16),
            Number.parseInt(hex.slice(2, 4), 16),
            Number.parseInt(hex.slice(4, 6), 16),
        ];
    };

    private rgbToHex = (color: [number, number, number]): string => {
        return `#${color.map((part) => {
            return Math.min(255, Math.max(0, part)).toString(16).padStart(2, "0");
        }).join("")}`;
    };

    private renderMinimap = (source: string, alt: string, showHeatmapGradient: boolean): ComponentChild => {
        const { minimapGeometry, minimapPosition } = this.state;

        if (!minimapGeometry?.visible) {
            return null;
        }

        const left = minimapGeometry.scrollLeft + minimapPosition.x;
        const top = minimapGeometry.scrollTop + minimapPosition.y;

        return (
            <div
                ref={this.minimapRef}
                className="imageResultViewMinimap"
                style={{
                    left,
                    top,
                    width: minimapGeometry.minimapWidth,
                    height: minimapGeometry.minimapHeight,
                }}
                title="Drag to move. Click to select viewport."
                onPointerDown={this.handleMinimapPointerDown}
                onMouseDown={this.handleMinimapMouseDown}
            >
                <img
                    className="imageResultViewMinimapImage"
                    src={source}
                    alt={alt}
                />
                {showHeatmapGradient
                    ? <div
                        className="imageResultViewMinimapHeatmapLegend"
                        aria-label="Low to high estimated cost"
                        title="Low to high estimated cost"
                    >
                        <div className="imageResultViewMinimapHeatmapCaption">Total est. cost</div>
                        <div
                            className="imageResultViewMinimapHeatmapGradient"
                            style={{
                                background: `linear-gradient(to right, ${costHeatmapColors.join(", ")})`,
                            }}
                        />
                        <div className="imageResultViewMinimapHeatmapLabels">
                            <span>0</span>
                            <span>{this.costHeatmapCache?.maxCostLabel}</span>
                        </div>
                    </div>
                    : null}
                <div
                    className="imageResultViewMinimapViewport"
                    style={{
                        left: minimapGeometry.viewportLeft,
                        top: minimapGeometry.viewportTop,
                        width: minimapGeometry.viewportWidth,
                        height: minimapGeometry.viewportHeight,
                    }}
                />
            </div>
        );
    };

    private setImageRef = (element: HTMLElement | null): void => {
        this.imageElement = element ?? undefined;
        if (element) {
            this.scheduleInitialPosition();
        }
    };

    private handleImageLoad = (): void => {
        this.cancelInitialPosition();
        this.scrollToInitialPosition();
        this.updateMinimapGeometry();
    };

    private scheduleInitialPosition = (): void => {
        if (this.initialScrollFrame !== undefined) {
            return;
        }

        this.initialScrollFrame = window.requestAnimationFrame(() => {
            this.initialScrollFrame = undefined;
            const applied = this.scrollToInitialPosition();
            this.updateMinimapGeometry();
            if (!applied && this.initialScrollAttempts < 10) {
                ++this.initialScrollAttempts;
                this.scheduleInitialPosition();
            }
        });
    };

    private cancelInitialPosition = (): void => {
        if (this.initialScrollFrame !== undefined) {
            window.cancelAnimationFrame(this.initialScrollFrame);
            this.initialScrollFrame = undefined;
        }
    };

    private scrollToInitialPosition = (): boolean => {
        const { resultSet } = this.props;
        const container = this.containerRef.current;
        if (!container || !resultSet.image) {
            return false;
        }

        const key = this.getInitialScrollKey(resultSet.image);
        if (key === this.initialScrollKey) {
            return true;
        }

        const targetScrollLeft = resultSet.image.scrollToRight
            ? Math.max(0, container.scrollWidth - container.clientWidth)
            : 0;
        if (resultSet.image.scrollToRight && targetScrollLeft === 0) {
            return false;
        }

        container.scrollLeft = targetScrollLeft;
        this.initialScrollKey = key;
        this.initialScrollAttempts = 0;

        return true;
    };

    private getInitialScrollKey = (image: IImageResultData): string => {
        return `${image.mimeType}\n${image.data}\n${image.scrollToRight === true}`;
    };

    private handleScroll = (): void => {
        this.updateMinimapGeometry();
    };

    private updateMinimapGeometry = (): void => {
        const container = this.containerRef.current;
        const image = this.imageElement;
        if (!container || !image) {
            this.setHiddenMinimap();

            return;
        }

        const clientWidth = container.clientWidth;
        const clientHeight = container.clientHeight;
        const naturalImageSize = this.getNaturalImageSize(image);
        const imageZoom = this.getImageZoom();
        const measuredImageWidth = naturalImageSize.width > 0
            ? naturalImageSize.width * imageZoom
            : Math.max(image.offsetWidth, image.clientWidth);
        const measuredImageHeight = naturalImageSize.height > 0
            ? naturalImageSize.height * imageZoom
            : Math.max(image.offsetHeight, image.clientHeight);
        const imageWidth = measuredImageWidth > 0 ? measuredImageWidth : container.scrollWidth;
        const imageHeight = measuredImageHeight > 0 ? measuredImageHeight : container.scrollHeight;

        if (clientWidth <= 0 || clientHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
            this.setHiddenMinimap();

            return;
        }

        const availableWidth = Math.max(1, clientWidth - 2 * minimapMargin);
        const availableHeight = Math.max(1, clientHeight - 2 * minimapMargin);
        const maxWidth = Math.min(minimapMaxWidth, availableWidth);
        const maxHeight = Math.min(minimapMaxHeight, availableHeight);
        const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
        const minimapWidth = Math.min(maxWidth, Math.max(Math.min(minimapMinWidth, maxWidth), imageWidth * scale));
        const minimapHeight = Math.min(maxHeight, Math.max(Math.min(minimapMinHeight, maxHeight), imageHeight * scale));
        const scaleX = minimapWidth / imageWidth;
        const scaleY = minimapHeight / imageHeight;
        const viewportWidth = Math.min(minimapWidth, Math.max(8, clientWidth * scaleX));
        const viewportHeight = Math.min(minimapHeight, Math.max(8, clientHeight * scaleY));
        const nextGeometry: IMinimapGeometry = {
            imageWidth,
            imageHeight,
            minimapWidth,
            minimapHeight,
            viewportLeft: Math.min(minimapWidth - viewportWidth, Math.max(0, container.scrollLeft * scaleX)),
            viewportTop: Math.min(minimapHeight - viewportHeight, Math.max(0, container.scrollTop * scaleY)),
            viewportWidth,
            viewportHeight,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            visible: true,
        };

        const nextPosition = this.minimapPinned
            ? this.clampMinimapPosition(this.state.minimapPosition, nextGeometry)
            : this.defaultMinimapPosition(nextGeometry);

        this.setMinimapState(nextGeometry, nextPosition);
    };

    private getNaturalImageSize = (image: HTMLElement): { width: number; height: number } => {
        const naturalWidth = "naturalWidth" in image ? Number(image.naturalWidth) : 0;
        const naturalHeight = "naturalHeight" in image ? Number(image.naturalHeight) : 0;
        if (naturalWidth > 0 || naturalHeight > 0) {
            return {
                width: naturalWidth,
                height: naturalHeight,
            };
        }

        const svg = image instanceof SVGSVGElement ? image : image.querySelector("svg");
        if (!svg) {
            return { width: 0, height: 0 };
        }

        const width = this.parseSvgLength(svg.getAttribute("width"));
        const height = this.parseSvgLength(svg.getAttribute("height"));
        if (width > 0 || height > 0) {
            return { width, height };
        }

        const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
        if (viewBox?.length === 4) {
            return {
                width: Number.isFinite(viewBox[2]!) ? viewBox[2]! : 0,
                height: Number.isFinite(viewBox[3]!) ? viewBox[3]! : 0,
            };
        }

        return { width: 0, height: 0 };
    };

    private parseSvgLength = (value: string | null): number => {
        if (!value) {
            return 0;
        }

        const parsed = Number.parseFloat(value);

        return Number.isFinite(parsed) ? parsed : 0;
    };

    private setHiddenMinimap = (): void => {
        if (this.state.minimapGeometry?.visible) {
            this.setState({ minimapGeometry: undefined });
        }
    };

    private defaultMinimapPosition = (geometry: IMinimapGeometry): IPoint => {
        return this.clampMinimapPosition({
            x: minimapMargin,
            y: minimapMargin,
        }, geometry);
    };

    private clampMinimapPosition = (position: IPoint, geometry: IMinimapGeometry): IPoint => {
        const container = this.containerRef.current;
        if (!container) {
            return position;
        }

        const maxX = Math.max(minimapMargin, container.clientWidth - geometry.minimapWidth - minimapMargin);
        const maxY = Math.max(minimapMargin, container.clientHeight - geometry.minimapHeight - minimapMargin);

        return {
            x: Math.min(maxX, Math.max(minimapMargin, position.x)),
            y: Math.min(maxY, Math.max(minimapMargin, position.y)),
        };
    };

    private setMinimapState = (geometry: IMinimapGeometry, position: IPoint): void => {
        const currentGeometry = this.state.minimapGeometry;
        const currentPosition = this.state.minimapPosition;
        if (currentGeometry
            && this.nearlyEqual(currentGeometry.imageWidth, geometry.imageWidth)
            && this.nearlyEqual(currentGeometry.imageHeight, geometry.imageHeight)
            && this.nearlyEqual(currentGeometry.minimapWidth, geometry.minimapWidth)
            && this.nearlyEqual(currentGeometry.minimapHeight, geometry.minimapHeight)
            && this.nearlyEqual(currentGeometry.viewportLeft, geometry.viewportLeft)
            && this.nearlyEqual(currentGeometry.viewportTop, geometry.viewportTop)
            && this.nearlyEqual(currentGeometry.viewportWidth, geometry.viewportWidth)
            && this.nearlyEqual(currentGeometry.viewportHeight, geometry.viewportHeight)
            && this.nearlyEqual(currentGeometry.scrollLeft, geometry.scrollLeft)
            && this.nearlyEqual(currentGeometry.scrollTop, geometry.scrollTop)
            && currentGeometry.visible === geometry.visible
            && this.nearlyEqual(currentPosition.x, position.x)
            && this.nearlyEqual(currentPosition.y, position.y)) {
            return;
        }

        this.setState({
            minimapGeometry: geometry,
            minimapPosition: position,
        });
    };

    private nearlyEqual = (a: number, b: number): boolean => {
        return Math.abs(a - b) < 0.5;
    };

    private handleMinimapPointerDown = (event: PointerEvent): void => {
        this.startMinimapDrag(event);
    };

    private handleMinimapMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0) {
            return;
        }

        this.startMinimapDrag(event);
    };

    private startMinimapDrag = (event: PointerEvent | MouseEvent): void => {
        const geometry = this.state.minimapGeometry;
        if (!geometry || this.dragState) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.dragState = {
            pointerId: "pointerId" in event ? event.pointerId : undefined,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPosition: this.state.minimapPosition,
            moved: false,
        };

        document.addEventListener("pointermove", this.handleMinimapPointerMove);
        document.addEventListener("pointerup", this.handleMinimapPointerUp);
        document.addEventListener("pointercancel", this.handleMinimapPointerUp);
        document.addEventListener("mousemove", this.handleMinimapMouseMove);
        document.addEventListener("mouseup", this.handleMinimapMouseUp);
    };

    private handleMinimapPointerMove = (event: PointerEvent): void => {
        this.moveMinimap(event);
    };

    private handleMinimapMouseMove = (event: MouseEvent): void => {
        this.moveMinimap(event);
    };

    private moveMinimap = (event: PointerEvent | MouseEvent): void => {
        const dragState = this.dragState;
        const geometry = this.state.minimapGeometry;
        if (!dragState || !geometry || !this.eventMatchesDragState(event)) {
            return;
        }

        const dx = event.clientX - dragState.startClientX;
        const dy = event.clientY - dragState.startClientY;
        if (!dragState.moved && Math.abs(dx) + Math.abs(dy) < minimapDragThreshold) {
            return;
        }

        dragState.moved = true;
        this.minimapPinned = true;
        this.setState({
            minimapPosition: this.clampMinimapPosition({
                x: dragState.startPosition.x + dx,
                y: dragState.startPosition.y + dy,
            }, geometry),
        });
    };

    private handleMinimapPointerUp = (event: PointerEvent): void => {
        this.releaseMinimap(event);
    };

    private handleMinimapMouseUp = (event: MouseEvent): void => {
        this.releaseMinimap(event);
    };

    private releaseMinimap = (event: PointerEvent | MouseEvent): void => {
        const dragState = this.dragState;
        if (!dragState || !this.eventMatchesDragState(event)) {
            return;
        }

        this.removeDragListeners();
        if (!dragState.moved) {
            this.selectViewport(event.clientX, event.clientY);
        }
    };

    private removeDragListeners = (): void => {
        document.removeEventListener("pointermove", this.handleMinimapPointerMove);
        document.removeEventListener("pointerup", this.handleMinimapPointerUp);
        document.removeEventListener("pointercancel", this.handleMinimapPointerUp);
        document.removeEventListener("mousemove", this.handleMinimapMouseMove);
        document.removeEventListener("mouseup", this.handleMinimapMouseUp);
        this.dragState = undefined;
    };

    private eventMatchesDragState = (event: PointerEvent | MouseEvent): boolean => {
        const pointerId = "pointerId" in event ? event.pointerId : undefined;

        return this.dragState?.pointerId === undefined || this.dragState.pointerId === pointerId;
    };

    private handleViewportPointerDown = (event: PointerEvent): void => {
        this.startViewportPan(event);
    };

    private handleViewportMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0) {
            return;
        }

        this.startViewportPan(event);
    };

    private startViewportPan = (event: PointerEvent | MouseEvent): void => {
        const container = this.containerRef.current;
        if (!container || this.panState || this.dragState) {
            return;
        }

        const target = event.target as Element | null;
        if (target?.closest(".imageResultViewMinimap")) {
            return;
        }

        const canPan = container.scrollWidth > container.clientWidth || container.scrollHeight > container.clientHeight;
        if (!canPan) {
            return;
        }

        event.preventDefault();

        this.panState = {
            pointerId: "pointerId" in event ? event.pointerId : undefined,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollLeft: container.scrollLeft,
            startScrollTop: container.scrollTop,
        };
        this.setState({ isPanning: true });

        document.addEventListener("pointermove", this.handleViewportPointerMove);
        document.addEventListener("pointerup", this.handleViewportPointerUp);
        document.addEventListener("pointercancel", this.handleViewportPointerUp);
        document.addEventListener("mousemove", this.handleViewportMouseMove);
        document.addEventListener("mouseup", this.handleViewportMouseUp);
    };

    private handleViewportPointerMove = (event: PointerEvent): void => {
        this.panViewport(event);
    };

    private handleViewportMouseMove = (event: MouseEvent): void => {
        this.panViewport(event);
    };

    private panViewport = (event: PointerEvent | MouseEvent): void => {
        const container = this.containerRef.current;
        const panState = this.panState;
        if (!container || !panState || !this.eventMatchesPanState(event)) {
            return;
        }

        container.scrollLeft = panState.startScrollLeft - (event.clientX - panState.startClientX);
        container.scrollTop = panState.startScrollTop - (event.clientY - panState.startClientY);
        this.updateMinimapGeometry();
    };

    private handleViewportPointerUp = (event: PointerEvent): void => {
        this.releaseViewportPan(event);
    };

    private handleViewportMouseUp = (event: MouseEvent): void => {
        this.releaseViewportPan(event);
    };

    private releaseViewportPan = (event: PointerEvent | MouseEvent): void => {
        if (!this.panState || !this.eventMatchesPanState(event)) {
            return;
        }

        this.removePanListeners();
    };

    private removePanListeners = (updateState = true): void => {
        document.removeEventListener("pointermove", this.handleViewportPointerMove);
        document.removeEventListener("pointerup", this.handleViewportPointerUp);
        document.removeEventListener("pointercancel", this.handleViewportPointerUp);
        document.removeEventListener("mousemove", this.handleViewportMouseMove);
        document.removeEventListener("mouseup", this.handleViewportMouseUp);
        this.panState = undefined;
        if (updateState && this.state.isPanning) {
            this.setState({ isPanning: false });
        }
    };

    private eventMatchesPanState = (event: PointerEvent | MouseEvent): boolean => {
        const pointerId = "pointerId" in event ? event.pointerId : undefined;

        return this.panState?.pointerId === undefined || this.panState.pointerId === pointerId;
    };

    private selectViewport = (clientX: number, clientY: number): void => {
        const container = this.containerRef.current;
        const minimap = this.minimapRef.current;
        const geometry = this.state.minimapGeometry;
        if (!container || !minimap || !geometry) {
            return;
        }

        const bounds = minimap.getBoundingClientRect();
        const localX = Math.min(geometry.minimapWidth, Math.max(0, clientX - bounds.left));
        const localY = Math.min(geometry.minimapHeight, Math.max(0, clientY - bounds.top));
        const targetX = (localX / geometry.minimapWidth) * geometry.imageWidth;
        const targetY = (localY / geometry.minimapHeight) * geometry.imageHeight;

        container.scrollLeft = Math.max(0, Math.min(
            geometry.imageWidth - container.clientWidth,
            targetX - container.clientWidth / 2,
        ));
        container.scrollTop = Math.max(0, Math.min(
            geometry.imageHeight - container.clientHeight,
            targetY - container.clientHeight / 2,
        ));
        this.updateMinimapGeometry();
    };
}
